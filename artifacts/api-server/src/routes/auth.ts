import { Router } from "express";
import bcrypt from "bcryptjs";
import { AdminLoginBody } from "@workspace/api-zod";
import { signToken } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@palestinestore.com";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD ?? "Admin123@", 10);

router.post("/login", async (req, res) => {
  const parse = AdminLoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parse.data;
  if (email !== ADMIN_EMAIL) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(email);
  res.json({ token });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ email: (req as any).admin.email });
});

export default router;
