import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import authRouter from "./auth";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import statsRouter from "./stats";
import storageRouter from "./storage";
import telegramRouter from "./telegram";
import reviewsRouter from "./reviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/accounts", accountsRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/settings", settingsRouter);
router.use("/admin/settings", settingsRouter);
router.use("/stats", statsRouter);
router.use("/storage", storageRouter);
router.use("/telegram", telegramRouter);
router.use("/reviews", reviewsRouter);
router.use("/", reviewsRouter);

export default router;
