# Release Notes: v2025.08.25-1906

Date: 2025-08-25

## Highlights
- Safe Migration groundwork: unified `outlets_unified` table and handlers; legacy `locations`/`locations_view` removed. Safe migration flow and status endpoints available.
- Order Management UX: major improvements across Admin and Public flows, including edit capabilities, delivery assignments, and payment refresh UX.
- Shipping Images: end-to-end fixes for reliable display and upload without auth issues.

## Features
- Unified Outlets & Migration
  - API `GET /api/outlets` reads from `outlets_unified` (legacy outlets deprecated).
  - FE fallback to `/api/outlets` when admin outlets unavailable; normalized response.
  - Added safe-drop migration logic and removed legacy locations handler/view.
- Admin Orders & Delivery
  - Outlet dropdown for delivery location and assignment.
  - Deliveryman dropdown for Kurir Toko assignment.
  - Several UX tweaks: “Outlet Yang Mengirimkan”, removal of duplicate fields, improved responsiveness.
- Admin Order Editing
  - Comprehensive edit form on `AdminOrderDetailPage` with improved header UI and badges.
- Public Orders & Payments
  - Optimistic payment refresh UX; robust refetch guard; treat capture as paid.
  - “Perbarui Pembayaran” wired to `POST /api/orders/:id/refresh-status`.

## Fixes
- Auth
  - Login resilient to missing `password_hash` column (select *).
  - Reverted to plaintext password check for production compatibility.
- Build & Tooling
  - Resolved duplicate JSX/TSX conflicts and entry point issues.
  - Fixed `adminApi` URL declaration/import conflicts.
  - CI: switch to `wrangler-action@v3`.
- Admin Orders
  - Corrected edit flow using `updateOrderDetails`.
  - Fixed shipping status update signature.
  - Prevent manual edits to payment fields where not allowed.
- Shipping Images
  - Stable endpoint behavior for unauthenticated public display.
  - Fixed upload parsing and display across order types.
  - Added CORS and preflight handling.
  - Numerous debug/format fixes to eliminate 401/500s.
- APIs
  - Fixed 500 in `getOrderById`.
  - Auth and endpoint alignment fixes for public order endpoints.

## Chore/Docs
- Track migration and password hashing scripts.
- Add AI maintainer guide and deployment updates.
- Cloudflare Pages deployment triggers and wrangler config updates.

## Breaking/Behavior Changes
- Legacy outlets table/view deprecated: APIs/UI should rely on `outlets_unified`.
- Migration required: execute the safe migration to create/populate unified outlets before relying on the new handler.

## Upgrade Notes
1. Run safe migration via admin UI or API to create/populate `outlets_unified`.
2. Verify endpoints:
   - `GET /api/outlets` returns unified outlets.
   - Public and Admin order pages display shipping images correctly.
3. Environment/CI:
   - Confirm Cloudflare/wrangler updates are applied in CI.
   - If moving to hashed passwords, run the provided scripts and ensure schema alignment.

## Credits
Thanks to contributors for features, fixes, and deployment improvements in this release.
