# متجر فلسطين - Palestine Store

منصة فلسطينية متخصصة في بيع حسابات السوشيال ميديا (TikTok, Instagram, Facebook) بشكل آمن وسريع.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxy at /api)
- `pnpm --filter @workspace/palestine-store run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + ShadCN UI + next-themes (dark/light mode)
- API: Express 5 + JWT auth (jsonwebtoken) + bcryptjs + helmet + express-rate-limit + multer
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/palestine-store/src/`
  - Pages: `src/pages/` (home, accounts, admin/login, admin/dashboard, admin/accounts, admin/settings)
  - Components: `src/components/` (AccountCard, WhatsAppButton, layout/PublicLayout, layout/AdminLayout)
  - Auth context: `src/contexts/AuthContext.tsx`
- API routes: `artifacts/api-server/src/routes/` (accounts, auth, admin, settings, stats)
- Auth middleware: `artifacts/api-server/src/middlewares/auth.ts`
- DB schema: `lib/db/src/schema/` (accounts, settings, stats)
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Uploaded images: `artifacts/api-server/uploads/`

## Architecture decisions

- RTL Arabic interface throughout (dir="rtl", lang="ar", Tajawal Google Font)
- No cart/checkout — all purchases routed via WhatsApp (wa.me/972566112031)
- JWT auth stored in localStorage ("admin_token") — admin panel at /admin only
- Site settings stored as key-value pairs in PostgreSQL settings table
- Image uploads served from /api/uploads/ via Express static middleware
- File upload endpoint at POST /api/admin/accounts/upload-image (not in OpenAPI spec to avoid multipart/Blob type issues)

## Product

- Public store: Hero banner, accounts by platform (TikTok/Instagram/Facebook), payment methods, contact
- Floating WhatsApp button on all public pages
- Admin panel at /admin (not linked publicly): dashboard stats, CRUD accounts via modals, site settings
- Dark/Light mode toggle

## Admin credentials

- Email: admin@palestinestore.com
- Password: Admin123@

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- multipart/form-data upload endpoint is NOT in openapi.yaml (causes Blob/File type errors in api-zod); handled manually
- Admin routes under /admin/* all require JWT Bearer token (requireAuth middleware)
- Settings route registered twice (GET /settings public, PATCH /admin/settings protected)
- WhatsAppButton is at components/WhatsAppButton.tsx — import as "../WhatsAppButton" from layout/ directory

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
