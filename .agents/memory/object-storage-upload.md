---
name: Object Storage image upload
description: How image uploads work after migrating from multer disk storage to GCS-backed Replit Object Storage
---

## The rule
Files are uploaded via a **server-side proxy endpoint** — NOT direct browser→GCS PUT (CORS blocks it).

**Why:** Direct browser PUT to `storage.googleapis.com` hangs forever in Replit preview because GCS CORS rejects the preflight OPTIONS from the Replit preview domain. The fix is to route uploads through our API server which PUTs server-side (no CORS).

**Why NOT presigned URL direct upload:** The presigned URL PUT works from curl/server but is blocked by GCS CORS from the browser. `fetch()` hangs without throwing, causing infinite loading state.

## How to apply
- Admin frontend posts `multipart/form-data` to `POST /api/storage/uploads/upload-file` (auth required)
- Backend accepts via `multer({ storage: multer.memoryStorage() })`, uploads buffer to GCS via `@google-cloud/storage` SDK (`file.save(buffer)`)
- Returns `{ objectPath, servingUrl }` — servingUrl = `/api/storage/objects/uploads/<uuid>`
- Utility function: `artifacts/palestine-store/src/lib/uploadImage.ts` → `uploadFileToStorage(file)`
- Also keep `POST /api/storage/uploads/request-url` for any server→server presigned URL flows
- Storage router mounted at `/storage` in `routes/index.ts` — do NOT prefix routes inside storage.ts with `/storage/`
- Objects served at `GET /api/storage/objects/*` (public, no auth needed)

## objectPath normalization
`normalizeObjectEntityPath()` is designed for presigned URL strings ONLY. Do NOT pass `https://storage.googleapis.com/` + path to it — double-slash bug. Instead compute objectPath directly: entityId = objectName after `privateObjectDir/` prefix → return `/objects/${entityId}`.
