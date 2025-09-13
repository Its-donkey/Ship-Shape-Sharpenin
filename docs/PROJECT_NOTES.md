Project Notes and Roadmap
Date: ${TODAY}

Summary of recent changes
- ABN Handling (frontend + validation)
  - Input caps to 11 digits and formats live as "XX XXX XXX XXX".
  - Green border + light green background when checksum is valid.
  - Shows "Insufficient digits" when 1–10 digits are entered.
  - Company/Trading names auto-filled from ABR once ABN is valid; fields lock after auto-fill.
  - Changing the ABN clears Company/Trading names and unlocks editing; ABR options reset.
  - Registration page: Account Type selector (Personal/Business). Business-only fields (ABN, Company Name, Trading Name, Billing options) are hidden for Personal.
  - First name and Last name introduced (both required). Field-level validation and green success state added for first/last name, email, phone, password, confirm.

- ABR Integration (API + Web)
  - New route: GET /api/abr/abn/:abn (uses ABR_GUID). Normalizes JSON/JSONP. Returns { ok, entityName, businessNames, raw }.
  - Register/Profile pages fetch ABR once ABN is valid and populate Company/Trading Name.

- Validation package updates
  - abn.ts: abnIsValid strips non-digits and validates only when exactly 11 digits.
  - normalizeAbn caps to 11 digits; formatAbn respects the cap.
  - name.ts: added validateFirstName/validateLastName with field-aware messages.

- API structure & hardening
  - DB module renamed: apps/api/src/db/client.ts → apps/api/src/db/database.ts.
  - Customers split into service + controller; routes are now thin. Added request validation parsers.
  - New admin middleware requireAdmin (based on ADMIN_EMAILS env list).
  - Items route: file size limit (10MB), admin protection on upload/clear, logs unexpected MIME.
  - TLD monthly job: downloads IANA TLDs; schema now has active flag. Ingest marks current set active and clears old ones.
  - TLD API: summary, clear (admin), update (admin).

- Admin UI
  - Admin page split into tabs: Items, Top Level Domains, Customers.
  - Items tab: file upload/import, preview, clear, export button, compact table.
  - TLDs tab: last updated date, count of active TLDs, Update Now, Clear All.
  - Customers tab: list all customers (id, email, name, created, company, phone), Reset Password action.

Environment and config
- apps/api/.env.development (used by `npm run dev:api`)
  - ABR_GUID=your-abr-guid-here
  - ADMIN_EMAILS=comma or space separated admin emails (e.g., admin@example.com, owner@example.com)
  - COOKIE_SECURE=false
- apps/api/.env (used in production)

How to run (dev)
- From repo root: npm run dev
  - Web: http://localhost:5173
  - API: http://localhost:5001
- Registration page: /customer/register
- Admin page: /admin (Customers/TLDs actions require admin session)
  - For dev, you can enable a quick session via "Dev: Skip Passwords" toggle then use /api/auth/devlogin; ensure the email for id=1 is in ADMIN_EMAILS for admin routes.

Manual test checklist
- Registration
  - Personal: ABN/Company/Trading/Billing fields hidden. Required first/last name. Email/password validation.
  - Business: ABN formats and caps at 11; insufficient digits message; green on valid; ABR fills Company/Trading and locks; changing ABN clears & unlocks.
- Profile: ABN formatting and ABR auto-fill; submission normalizes ABN.
- Admin
  - Items tab: Upload valid ITEMS file; preview loads; clear database works (admin only).
  - TLDs tab: Update Now ingests list; count reflects active; Clear All wipes (admin only).
  - Customers tab: Refresh loads customers; Reset Password validates and updates (admin only).

Security and best practices implemented
- Admin routes protected by requireAdmin.
  - A user is considered admin if customers.is_admin = 1 OR their email appears in ADMIN_EMAILS (comma/space separated).
  - Dev-only `/api/auth/devlogin` is disabled in production unless `VITE_DEV_SERVER=1` is set.
- Session cookie: HttpOnly, SameSite=Lax, Secure in non-dev.
- Input validation centralized for customers (login/register/profile update).
- TLD ingest idempotent and explicit active flag maintained.

Potential next steps (nice-to-haves)
- Move auth helpers to apps/api/src/lib/auth.ts and unify imports.
- Replace custom parsers with zod schemas for stronger typing.
- Add customers.is_admin column and migrate away from ADMIN_EMAILS env.
- Add rate limiting for login/reset-password.
- Extract decode helpers to lib and add unit tests.
- Add supertest-based API tests for key routes.

Suggestions Backlog
- Customers table: show business name beside ID (join or map) in the Admin UI.
- Customers table: replace link/unlink prompt with a searchable business picker.
- Businesses: inline edit UX polish (validation, ABN normalization/format, better toasts).
- Special pricing: bulk import/export CSV for overrides.
- Special pricing: audit logging on add/update/remove.
- Pricing page: toggle to show only items with special pricing.
- Admin: allow linking a customer to a business from the customer's profile page.
- API: endpoints to search businesses by name/ABN for the UI picker.
- Security: rate-limit admin mutation routes (per IP and per session).
