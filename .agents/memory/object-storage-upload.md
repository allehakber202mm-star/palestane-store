---
name: Object Storage image upload
description: How image uploads work after migrating from multer disk storage to GCS-backed Replit Object Storage
---

## The rule
Images are uploaded via presigned URL (GCS signed PUT). No multer on the server.

**Why:** Multer diskStorage writes to `artifacts/api-server/uploads/` which is ephemeral — wiped on redeploy/restart. GCS-backed Object Storage is permanent.

## How to apply
- Admin frontend calls `POST /api/storage/uploads/request-url` (auth required, Bearer JWT) with `{ name, size, contentType }`
- Backend returns `{ uploadURL, objectPath }` — uploadURL is a GCS signed PUT URL
- Frontend PUTs the file to `uploadURL` directly (no API server in the middle)
- Serving URL to store in DB = `/api/storage` + objectPath (e.g. `/api/storage/objects/uploads/uuid`)
- Utility function: `artifacts/palestine-store/src/lib/uploadImage.ts`
- Route: `POST /api/storage/uploads/request-url` in `artifacts/api-server/src/routes/storage.ts`
- Storage router mounted at `/storage` in `routes/index.ts` — do NOT prefix routes inside storage.ts with `/storage/`
- Objects served at `GET /api/storage/objects/*` (public, no auth needed)
