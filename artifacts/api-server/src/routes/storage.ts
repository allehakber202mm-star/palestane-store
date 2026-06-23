import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload (server-to-server flows).
 */
router.post("/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads/upload-file
 *
 * Proxy file upload: client sends multipart/form-data with field "file".
 * Server receives buffer and uploads directly to GCS — no CORS issues.
 * Returns { objectPath, servingUrl }
 */
router.post(
  "/uploads/upload-file",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided (expected field name: file)" });
      return;
    }
    req.log.info(
      { name: file.originalname, size: file.size, type: file.mimetype },
      "[Upload] استلم الملف من المتصفح",
    );
    try {
      const objectPath = await objectStorageService.uploadObjectEntityBuffer(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      const servingUrl = `/api/storage${objectPath}`;
      req.log.info({ objectPath, servingUrl }, "[Upload] تم الرفع إلى GCS بنجاح");
      res.json({ objectPath, servingUrl });
    } catch (error) {
      req.log.error({ err: error }, "[Upload] فشل رفع الملف إلى GCS");
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `فشل رفع الملف: ${msg}` });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectFile = await objectStorageService.searchPublicObject(filePath);
    if (!objectFile) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    await streamObjectToResponse(req, res, objectFile);
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities with full HTTP Range support.
 * Safari and iOS require Accept-Ranges + 206 Partial Content for video playback.
 */
router.get("/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await streamObjectToResponse(req, res, objectFile);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

// ─── Shared streaming helper with Range support ───────────────────────────────
import type { File as GCSFile } from "@google-cloud/storage";

async function streamObjectToResponse(
  req: Request,
  res: Response,
  objectFile: GCSFile,
): Promise<void> {
  const [metadata] = await objectFile.getMetadata();
  const contentType = (metadata.contentType as string) || "application/octet-stream";
  const totalSize = Number(metadata.size) || 0;

  // Always advertise range support — required for Safari/iOS video
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");

  const rangeHeader = req.headers.range;

  if (rangeHeader && totalSize > 0) {
    // Safari/iOS sends "Range: bytes=0-1" first, then the real range
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      res.status(416).end();
      return;
    }

    const startStr = match[1];
    const endStr   = match[2];
    const start    = startStr !== "" ? parseInt(startStr, 10) : totalSize - (endStr !== "" ? parseInt(endStr, 10) : 1);
    const end      = endStr   !== "" ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1;

    if (start > end || start >= totalSize) {
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      res.status(416).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    res.setHeader("Content-Length", String(chunkSize));
    res.status(206);

    const readStream = objectFile.createReadStream({ start, end });
    readStream.on("error", () => res.end());
    readStream.pipe(res);
  } else {
    // Full file
    if (totalSize > 0) {
      res.setHeader("Content-Length", String(totalSize));
    }
    res.status(200);

    const readStream = objectFile.createReadStream();
    readStream.on("error", () => res.end());
    readStream.pipe(res);
  }
}

export default router;
