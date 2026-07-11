---
name: Full Audit Fixes
description: Bugs found and fixed during comprehensive audit of Palestine Store — prevents repeating the same investigation
---

## Confirmed Bugs Fixed

### 1. Missing `/api/accounts/:id/click` endpoint
`useTrackAccountClick` in `account-details.tsx` calls `POST /api/accounts/:id/click` (in OpenAPI spec, generated client) but the handler was never implemented in `accounts.ts`. Every WhatsApp click on an account detail page returned 404. `clickCount` was always 0.  
**Fix:** Added `router.post("/:id/click")` handler that increments `clickCount` and returns the new value.

### 2. `fixMisclassifiedAccounts` log spam every 30 seconds
The function logged every account (even when `needsFix: false`) at INFO level on every Telegram sync tick. With 14 accounts = ~40,320 extra log lines/day.  
**Fix:** Removed per-account INFO logging. Now only logs accounts being fixed (WARN) + one summary line per tick.

### 3. Missing DB indexes (11 new indexes across 4 tables)
- `accounts`: `telegram_message_id` (partial), `status`, `platform`, `platform+status`
- `account_visits`: `account_id`, `visitor_id+account_id`
- `site_visits`: `created_at`, `visitor_id+page`
- `stats`: `account_id`, `event_type`, `created_at`, `account_id+event_type`

### 4. Settings PATCH: SELECT+INSERT race condition (N+1 queries)
`PATCH /api/settings` looped over each key doing SELECT then INSERT or UPDATE. Race: two concurrent updates could both SELECT "no row" → both INSERT → unique constraint violation (500).  
**Fix:** Replaced with `INSERT ... ON CONFLICT DO UPDATE` (upsert) for each key.

### 5. Admin DELETE returns 200 on non-existent account
`DELETE /api/admin/accounts/:id` always returned `{success:true}` even if no row was deleted.  
**Fix:** Added `.returning()` to the delete query; returns 404 if no row was deleted.

### 6. No global JSON error handler in Express
Express default error handler returns HTML. API clients cannot parse HTML as JSON.  
**Fix:** Added 4-argument error handler middleware at bottom of `app.ts` that returns `{error: message}` JSON.

### 7. Analytics tables grew indefinitely with no cleanup
`stats` and `site_visits` tables had no pruning mechanism. Could cause unbounded growth.  
**Fix:** Created `lib/dataPruning.ts` with `startDataPruning()` — runs 10 min after startup then daily; keeps last 180 days.

## What Was Verified as Working Correctly
- "زيارة الحساب" button: uses `buildProfileUrl(platform, username, accountUrl)` which falls back accountUrl → username → null. Shows when truthy. ✓
- Sold status protection: telegramSync skips update if `account.status === "sold"` and post doesn't say "مباع". ✓  
- `visitCount` rate-limiting: 30-min dedup per visitorId per account. ✓
- Telegram deduplication: messageId + accountUrl + username+platform all covered. ✓
- Data persisted in PostgreSQL (not in-memory) — survives restarts. ✓

**Why:** These were the sources of silent data inconsistency or log floods that weren't immediately obvious from the code structure.
