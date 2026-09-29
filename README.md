# Volunteer Bookshop Inventory

Next.js + TypeScript application for barcode-based volunteer bookshop inventory.
It uses Supabase Auth and PostgreSQL for authenticated production storage.

## Current Status

Done:

- Next.js App Router
- TypeScript
- Supabase email/password login
- Supabase/PostgreSQL persistence
- Atomic inventory updates through database RPC functions
- Add Books and Remove Books scan screens
- Scanner-friendly ISBN input with automatic focus
- Camera barcode scanning where supported by the browser
- ISBN normalization and checksum validation
- Quantity tracking per ISBN
- Inventory search by title, author, or ISBN
- Book detail page with manual add/remove controls
- Recent activity/audit log
- Undo via reversing transaction
- Admin-only CSV export
- API-backed storage through Next.js route handlers
- Server-side Open Library and Google Books metadata lookup
- Core inventory rule tests

The app intentionally contains no price fields and no shelf/location fields.

## Requirements

- Node.js
- npm
- A modern browser
- A Supabase project with the migrations in `supabase/migrations` applied

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use:

```bash
npm run dev -- -p 3001
```

Then open:

```text
http://localhost:3001
```

## Login

Create users in Supabase Authentication, then log in with their email/password.
The profile trigger creates matching application profiles. To grant admin access,
set the user's profile role to `ADMIN`.

Local development and production deployments should set the Supabase environment
variables shown in `.env.example`.

## Configuration

Production and normal local development should use Supabase-backed storage:

```text
BOOKSHOP_STORAGE=supabase
```

Required Supabase variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The equivalent newer Supabase variable names in `.env.example` are also
supported. Keep service-role credentials server-side only.

`src/lib/server/memoryStore.ts` is retained for isolated tests and temporary
local fallback only. It stores data in process memory, resets when the server
restarts, and must not be used for production inventory. The application rejects
`BOOKSHOP_STORAGE=memory` when `NODE_ENV=production`.

## Scanner Test Flow

Before using the app with a physical scanner:

1. Open a plain text editor.
2. Scan a book barcode.
3. Confirm the scanner types an ISBN such as `9780141187761`.
4. Confirm it sends Enter automatically.
5. Open `http://localhost:3000/#/scan/add`.
6. Scan the same barcode in the app.

The scan input should stay focused after every scan, so repeated scanning should
not require mouse clicks.

## Useful Test ISBNs

Seeded locally:

```text
9780141187761  1984
9780241197790  The Trial
9780141198064  The Stranger
9780140455465  The Master and Margarita
```

Suggested checks:

1. Scan `9780141187761` in Add mode and confirm quantity increases.
2. Scan it again and confirm the same book record is reused.
3. Scan it in Remove mode and confirm quantity decreases.
4. Keep removing until quantity reaches zero, then confirm it cannot go negative.
5. Use Undo after a successful add/remove.
6. Search inventory by title, author, and ISBN.
7. Log in as Admin and download the CSV export.

## Verify

Run the core rule tests:

```bash
npm test
```

Run the TypeScript checker:

```bash
npm run typecheck
```

Run a production build:

```bash
npm run build
```

The tests cover:

- ISBN normalization and validation
- Add/remove inventory rules
- Unknown ISBN no-op behavior
- Metadata failure no-op behavior
- Zero-stock protection
- Undo transaction behavior
- Search behavior
- CSV export field constraints

## Project Structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    BookshopApp.tsx
  lib/
    core.ts
    metadata/
      googleBooks.ts
      openLibrary.ts
      service.ts
    server/
      auth.ts
      memoryStore.ts
      store.ts
      supabaseStore.ts
tests/
  core.test.ts
  server-store.test.ts
```

## Metadata Lookup

Seeded ISBNs work without network lookup.

For newly scanned ISBNs, the Next.js API attempts lookup from:

1. Open Library
2. Google Books

The provider logic is isolated under `src/lib/metadata/`. Seeded ISBNs work
without network lookup.

## API Routes

The UI calls Next.js route handlers for inventory reads and mutations:

```text
GET  /api/app/state
POST /api/scan
GET  /api/books
GET  /api/books/:id
POST /api/books/:id/add
POST /api/books/:id/remove
GET  /api/activity
POST /api/transactions/:id/undo
GET  /api/export/inventory.csv
GET  /api/users
```

All routes require an authenticated Supabase session. Admin-only routes also
check the user's application profile role.

## Production Notes

1. Apply all SQL files in `supabase/migrations` to the target Supabase project.
2. Set `BOOKSHOP_STORAGE=supabase`.
3. Set Supabase public and service-role environment variables in the hosting platform.
4. Keep service-role keys server-side only.
5. Run `npm run check` before deployment.

## Support

For questions, issues, or collaboration:

- GitHub: [hajalibayram](https://github.com/hajalibayram)
- LinkedIn: [hajalibayram](https://www.linkedin.com/in/hajalibayram)

## License

This project is open source under the [MIT License](LICENSE).
