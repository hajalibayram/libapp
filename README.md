# Volunteer Bookshop Inventory Demo

Next.js + TypeScript local demo for the Volunteer Bookshop Inventory MVP in
`volunteer_bookshop_mvp_spec.md`.

This is still a local demo, not the final Supabase/PostgreSQL implementation. It
is intended to validate the volunteer scanning workflow before wiring real auth,
database transactions, and server-side metadata providers.

## Current Status

Done:

- Next.js App Router
- TypeScript
- Supabase email/password login
- Add Books and Remove Books scan screens
- Scanner-friendly ISBN input with automatic focus
- ISBN normalization and checksum validation
- Quantity tracking per ISBN
- Inventory search by title, author, or ISBN
- Book detail page with manual add/remove controls
- Recent activity/audit log
- Undo via reversing transaction
- Admin-only CSV export
- API-backed demo storage through Next.js route handlers
- Server-side Open Library and Google Books metadata lookup
- Core inventory rule tests

Not done yet:

- Supabase Auth
- PostgreSQL persistence wiring
- Atomic database transactions
- Applying the Supabase migration
- Real user management

The demo intentionally contains no price fields and no shelf/location fields.

## Requirements

- Node.js
- npm
- A modern browser

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
For the setup guide, use:

```text
admin@bookshop.test
volunteer@bookshop.test
```

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

## Reset Demo Data

On the Dashboard, use `Reset demo data`.

This clears local demo inventory/activity data and restores the seeded books.

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
    BookshopDemo.tsx
  lib/
    core.ts
tests/
  core.test.ts
```

## Metadata Lookup

Seeded ISBNs work without network lookup.

For newly scanned ISBNs, the Next.js API attempts lookup from:

1. Open Library
2. Google Books

The provider logic is isolated under `src/lib/metadata/`. Seeded ISBNs work
without network lookup.

## Demo API Routes

The UI now calls Next.js route handlers for inventory mutations:

```text
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

The current storage adapter is an in-process demo store. It serializes mutations
for local testing, but it is not a replacement for PostgreSQL transactions.

## Path Toward The Full MVP

Next implementation steps:

1. Run the Supabase setup in `docs/SUPABASE_SETUP.md`.
2. Add Supabase Auth.
3. Replace the temporary demo login selector with real email/password screens.
4. Add Admin user-management actions.
5. Add Supabase integration tests around atomic database updates.
