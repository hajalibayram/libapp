# Volunteer Bookshop Inventory — MVP Specification

**Document purpose:** implementation specification for Codex / software developers  
**Status:** Final MVP definition  
**Primary goal:** allow volunteers to add and remove books from a bookshop inventory by scanning ISBN barcodes, with book metadata populated automatically from public book-data sources.

---

## 1. Product Summary

Build a small web application for a volunteer bookshop.

The application tracks how many physical copies of each ISBN/edition are currently in stock.

A volunteer must be able to:

1. Log in.
2. Enter **Add mode** or **Remove mode**.
3. Scan an ISBN barcode using a USB/Bluetooth barcode scanner.
4. Have the system identify the book automatically using public metadata.
5. Increase or decrease the inventory quantity.
6. Search the inventory manually by title, author, or ISBN.
7. Remove a book manually from search/book detail.
8. Review recent inventory activity.
9. Undo accidental inventory actions.
10. Export the inventory.

The system tracks **quantity per ISBN**, not individual physical copies.

---

# 2. Core Product Rules

These rules are authoritative for the MVP.

## 2.1 ISBN identifies a book edition

One database book record corresponds to one ISBN/edition.

Example:

```text
ISBN: 9780141187761
Title: 1984
Quantity: 4
```

Scanning the same ISBN again does not create another book record.

Instead:

```text
ADD scan:
quantity 4 -> 5

REMOVE scan:
quantity 5 -> 4
```

---

## 2.2 No price tracking

The MVP MUST NOT contain:

- price
- purchase price
- selling price
- discounts
- payment information

Price functionality is out of scope.

---

## 2.3 No shelf/location tracking

The MVP MUST NOT contain:

- shelf
- room
- storage location
- bin
- rack
- physical location metadata

Location functionality is out of scope.

---

## 2.4 Unknown ISBN behavior

When an ISBN is scanned in **Add mode**:

1. Normalize and validate the ISBN.
2. Check the local database.
3. If the ISBN already exists locally:
   - increment quantity by 1.
4. If it does not exist locally:
   - query configured public metadata providers.
5. If metadata is found:
   - create the book record.
   - set quantity to 1.
   - create an ADD transaction.
6. If metadata is not found:
   - DO NOT create a book record.
   - DO NOT create inventory.
   - DO NOT create a transaction.
   - DO NOT open a manual-entry form.
   - DO NOT guess metadata.

The UI may show a short non-blocking status such as:

```text
Book not found
```

After that, the scanner input should immediately be ready for the next scan.

**Database result for an unknown ISBN: no change.**

---

## 2.5 Unknown ISBN in Remove mode

If an ISBN is scanned in Remove mode and no local inventory record exists:

- make no database change;
- create no transaction;
- show a short status such as `Book not in inventory`;
- return focus to the scanner input.

Do not query metadata providers during Remove mode unless required for a future feature.

---

## 2.6 Zero stock

When the last copy is removed:

```text
quantity 1 -> 0
```

Do NOT delete the book record.

The book remains searchable and is considered out of stock.

This preserves history and avoids retrieving metadata again if another copy is later donated.

---

## 2.7 Negative inventory is forbidden

Inventory quantity MUST never be below zero.

If:

```text
quantity = 0
```

and a REMOVE action is requested:

- make no inventory change;
- create no REMOVE transaction;
- show `Already out of stock`.

---

# 3. MVP Features

## 3.1 Authentication

Users must log in before accessing inventory functions.

Two roles are sufficient:

### VOLUNTEER

Can:

- add books by barcode;
- remove books by barcode;
- search inventory;
- view book details;
- manually add/remove quantity from an existing book;
- view recent activity;
- undo their permitted inventory actions.

### ADMIN

Can do everything a volunteer can, plus:

- manage users;
- export inventory;
- perform stock corrections;
- access full activity history.

Complex permissions are out of scope.

---

# 4. Main Navigation

Recommended navigation:

```text
Dashboard

Scan
  Add Books
  Remove Books

Inventory

Activity

Export          [Admin]

Users           [Admin]
```

The application should favor scanning speed over visual complexity.

---

# 5. Dashboard

The dashboard is the landing page after login.

Minimum content:

```text
Volunteer Bookshop

[ ADD BOOKS ]     [ REMOVE BOOKS ]

Search inventory
[ title, author or ISBN ]

Total titles
Total books
Out of stock

Recent activity
```

Definitions:

- **Total titles** = number of book records with quantity > 0.
- **Total books** = sum of all quantities.
- **Out of stock** = number of known book records where quantity = 0.

The primary actions must be visually prominent:

- Add Books
- Remove Books

---

# 6. Add Books Workflow

Route suggestion:

```text
/scan/add
```

## 6.1 Scanner input

The page contains a barcode/ISBN input.

It must automatically receive focus when the page opens.

Expected hardware behavior:

A typical USB/Bluetooth barcode scanner acts as a keyboard and sends:

```text
9780141187761 + ENTER
```

When ENTER is received:

1. read input;
2. clear input;
3. process ISBN;
4. display result;
5. return focus to input.

The volunteer should not need to click between scans.

---

## 6.2 Successful scan — existing book

Example:

```text
ADDED

1984
George Orwell

ISBN 9780141187761

Stock
3 -> 4

[ Undo ]

Ready for next scan...
```

Required behavior:

```text
existing ISBN
-> quantity + 1
-> transaction created
-> result shown
-> scanner ready again
```

---

## 6.3 Successful scan — new known book

Example:

```text
ADDED

The Master and Margarita
Mikhail Bulgakov

Penguin Classics
ISBN 9780140455465

Stock
0 -> 1

[ Undo ]

Ready for next scan...
```

The system should NOT require confirmation before adding the book.

Required behavior:

```text
ISBN not local
-> metadata lookup
-> metadata found
-> create book
-> quantity = 1
-> transaction created
-> show success
-> scanner ready again
```

---

## 6.4 ISBN not found

Example:

```text
Book not found

ISBN 9781234567890

Ready for next scan...
```

Required behavior:

```text
ISBN not local
-> metadata lookup
-> no metadata found
-> no DB mutation
-> no manual form
-> scanner ready again
```

---

# 7. Remove Books Workflow

Route suggestion:

```text
/scan/remove
```

The screen must clearly indicate that the current mode is REMOVE.

Example:

```text
REMOVE BOOKS

Scan barcode

[________________________]
```

A different visual treatment from Add mode is recommended to reduce mistakes.

---

## 7.1 Successful removal

Example:

```text
REMOVED

The Trial
Franz Kafka

ISBN 9780241197790

Stock
4 -> 3

[ Undo ]

Ready for next scan...
```

Required behavior:

```text
known ISBN
and quantity > 0
-> quantity - 1
-> transaction created
-> result shown
-> scanner ready again
```

---

## 7.2 Quantity already zero

Example:

```text
Already out of stock

The Trial
Stock: 0

Ready for next scan...
```

Required behavior:

```text
quantity = 0
-> no DB mutation
-> no transaction
-> scanner ready again
```

---

## 7.3 ISBN not in local inventory

Example:

```text
Book not in inventory

Ready for next scan...
```

Required behavior:

```text
ISBN absent locally
-> no DB mutation
-> no transaction
-> scanner ready again
```

---

# 8. Inventory Search

Route suggestion:

```text
/inventory
```

The inventory must be searchable by:

- title;
- author;
- ISBN-10;
- ISBN-13.

Minimum table:

```text
Cover | Title | Author | ISBN | Quantity
```

Example:

```text
1984          George Orwell   9780141187761   4
The Trial     Franz Kafka     9780241197790   2
The Stranger  Albert Camus    9780141198064   0
```

Suggested filters:

```text
All
In stock
Out of stock
```

No price/location filters exist in the MVP.

---

# 9. Book Detail Page

Route suggestion:

```text
/books/:id
```

Minimum content:

```text
[Cover]

The Trial
Franz Kafka

ISBN-13
ISBN-10
Publisher
Publication date
Language

Stock: 3

[ + Add copy ]
[ - Remove copy ]

Recent activity
```

This page allows manual inventory adjustment without scanning.

## Manual Add

```text
+ Add copy
```

Equivalent to scanning the ISBN once in Add mode.

It must:

- increase quantity by 1;
- create an ADD transaction.

## Manual Remove

```text
- Remove copy
```

Equivalent to scanning in Remove mode.

It must:

- decrease quantity by 1 when quantity > 0;
- create a REMOVE transaction;
- refuse the operation when quantity = 0.

---

# 10. Metadata

For newly scanned ISBNs, retrieve public book metadata.

Recommended provider order:

```text
1. Open Library
2. Google Books fallback
```

Provider integration must be isolated behind a backend service so providers can later be replaced or reordered.

Example internal interface:

```ts
interface BookMetadataProvider {
  lookupByIsbn(isbn: string): Promise<BookMetadata | null>;
}
```

Expected normalized metadata:

```ts
type BookMetadata = {
  isbn13: string;
  isbn10?: string | null;
  title: string;
  subtitle?: string | null;
  authors: string[];
  publisher?: string | null;
  publicationDate?: string | null;
  language?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  source: string;
};
```

Only `isbn` and `title` are strictly required to create a usable record.

If a provider returns incomplete optional fields, the book can still be added.

If no provider returns enough metadata to identify the book, do nothing.

---

# 11. ISBN Processing

All ISBN processing must happen on the backend as well as being optionally validated on the frontend.

Normalize input by removing:

- spaces;
- hyphens;
- surrounding whitespace.

Example:

```text
978-0-14-118776-1
```

becomes:

```text
9780141187761
```

Support:

- ISBN-10;
- ISBN-13.

Validate checksum before metadata lookup or inventory mutation.

Invalid input behavior:

```text
Invalid ISBN
```

and:

- no DB mutation;
- no transaction;
- scanner returns to ready state.

If the scanner reads a non-ISBN retail barcode, treat it as invalid/unsupported.

---

# 12. Database Model

The MVP can be implemented with the following core tables.

---

## 12.1 users

```text
users
--------------------------------
id              UUID PRIMARY KEY
name            VARCHAR NOT NULL
email           VARCHAR UNIQUE NOT NULL
role            ENUM('VOLUNTEER', 'ADMIN')
active          BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

If using an external auth provider, its user ID can be used as the primary identity.

---

## 12.2 books

```text
books
--------------------------------
id                  UUID PRIMARY KEY
isbn13              VARCHAR UNIQUE
isbn10              VARCHAR UNIQUE NULL
title               VARCHAR NOT NULL
subtitle            VARCHAR NULL
publisher           VARCHAR NULL
publication_date    VARCHAR NULL
language            VARCHAR NULL
description         TEXT NULL
cover_url           TEXT NULL
metadata_source     VARCHAR NULL
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

Notes:

- ISBN-13 should be preferred as the canonical ISBN when available.
- Publication date may be stored as text because public metadata may contain only a year or partial date.

---

## 12.3 authors

```text
authors
--------------------------------
id              UUID PRIMARY KEY
name            VARCHAR NOT NULL
```

---

## 12.4 book_authors

```text
book_authors
--------------------------------
book_id         UUID REFERENCES books(id)
author_id       UUID REFERENCES authors(id)

PRIMARY KEY(book_id, author_id)
```

---

## 12.5 inventory

One inventory row per book.

```text
inventory
--------------------------------
book_id         UUID PRIMARY KEY REFERENCES books(id)
quantity        INTEGER NOT NULL DEFAULT 0
updated_at      TIMESTAMP

CHECK(quantity >= 0)
```

There are deliberately no price or shelf fields.

---

## 12.6 inventory_transactions

```text
inventory_transactions
--------------------------------
id                  UUID PRIMARY KEY
book_id             UUID REFERENCES books(id)
user_id             UUID REFERENCES users(id)

action              ENUM(
                      'ADD',
                      'REMOVE',
                      'CORRECTION',
                      'UNDO'
                    )

quantity_delta      INTEGER NOT NULL
quantity_before     INTEGER NOT NULL
quantity_after      INTEGER NOT NULL

reverses_transaction_id UUID NULL
created_at          TIMESTAMP
```

Example:

```text
ADD
quantity_delta: +1
quantity_before: 3
quantity_after: 4
```

Example removal:

```text
REMOVE
quantity_delta: -1
quantity_before: 4
quantity_after: 3
```

---

# 13. Transaction / Audit Rules

Every successful inventory change must create a transaction.

Do not silently modify quantities.

The transaction log is the audit trail.

A failed scan must not create a transaction.

Examples of failed/no-op events:

- invalid ISBN;
- metadata not found for new Add scan;
- Remove scan for unknown ISBN;
- Remove when quantity = 0.

These may be logged in application logs if desired, but not as inventory transactions.

---

# 14. Undo

A successful ADD or REMOVE action should expose an Undo action in the UI.

Undo must NOT delete the original transaction.

Instead, create another transaction reversing it.

Example:

```text
Transaction A
ADD
3 -> 4

Transaction B
UNDO
4 -> 3
reverses_transaction_id = Transaction A
```

Undo should only be allowed if doing so keeps inventory valid.

For MVP, the simplest safe behavior is:

- allow undo immediately from the scan result;
- optionally allow undo from recent activity;
- once a transaction has already been reversed, it cannot be reversed again through the same action.

---

# 15. Activity Page

Route suggestion:

```text
/activity
```

Show chronological inventory actions.

Minimum columns:

```text
Time | Book | Action | Before | After | User
```

Example:

```text
26 Sep 14:32 | 1984       | ADD    | 3 | 4 | Anna
26 Sep 14:25 | The Trial  | REMOVE | 2 | 1 | Marco
```

Optional filters:

- date;
- user;
- Add/Remove;
- book.

---

# 16. Export

Admin only.

Minimum export format:

```text
CSV
```

Suggested columns:

```text
ISBN-13
ISBN-10
Title
Authors
Publisher
Publication Date
Language
Quantity
```

Only current inventory/book data is required in the standard inventory export.

A separate transaction export can be added later.

---

# 17. API Specification

Exact route naming can change, but behavior should remain consistent.

---

## 17.1 Scan

```http
POST /api/scan
```

Request:

```json
{
  "isbn": "9780141187761",
  "mode": "ADD"
}
```

Allowed mode values:

```text
ADD
REMOVE
```

---

## 17.2 Successful Add response

```json
{
  "status": "SUCCESS",
  "action": "ADD",
  "book": {
    "id": "uuid",
    "isbn13": "9780141187761",
    "title": "1984",
    "authors": ["George Orwell"],
    "coverUrl": null
  },
  "inventory": {
    "before": 3,
    "after": 4
  },
  "transactionId": "uuid"
}
```

---

## 17.3 New ISBN with metadata found

Same success response.

The backend transparently:

1. fetches metadata;
2. creates book;
3. creates inventory;
4. applies quantity change;
5. creates transaction.

The frontend does not need a separate workflow.

---

## 17.4 Metadata not found

Suggested response:

```json
{
  "status": "NOT_FOUND",
  "isbn": "9781234567890"
}
```

No database mutation occurs.

---

## 17.5 Invalid ISBN

```json
{
  "status": "INVALID_ISBN"
}
```

No database mutation occurs.

---

## 17.6 Remove absent ISBN

```json
{
  "status": "NOT_IN_INVENTORY"
}
```

No database mutation occurs.

---

## 17.7 Remove at zero

```json
{
  "status": "OUT_OF_STOCK",
  "book": {
    "id": "uuid",
    "title": "The Trial"
  },
  "inventory": {
    "before": 0,
    "after": 0
  }
}
```

No transaction is created.

---

# 18. Other Suggested API Routes

```text
GET    /api/books
GET    /api/books/:id
GET    /api/books/isbn/:isbn

POST   /api/books/:id/add
POST   /api/books/:id/remove

GET    /api/activity
POST   /api/transactions/:id/undo

GET    /api/export/inventory.csv

GET    /api/users
POST   /api/users
PATCH  /api/users/:id
```

Direct deletion of books is not required for volunteers.

Admin deletion should not be part of the first implementation unless there is a strong operational need.

---

# 19. Search API

Example:

```http
GET /api/books?query=kafka
```

Search should match:

- title;
- author;
- ISBN-10;
- ISBN-13.

Optional stock filter:

```http
GET /api/books?query=kafka&stock=in
```

Suggested values:

```text
all
in
out
```

---

# 20. Scan Session

A scan session is useful but should remain lightweight.

When a volunteer opens Add or Remove mode, create a logical session in the frontend or backend.

Example:

```text
ADD BOOKS

Session:
42 successful scans

New titles: 28
Existing titles: 14
Not found: 2
```

The session counters do not need to be persisted for the initial implementation if that complicates the MVP.

The important requirement is continuous scanning without navigation between scans.

A future version may persist donation/import sessions.

---

# 21. Frontend State Machine

The scan screen should follow a small predictable state machine.

```text
READY
  |
  | scan
  v
PROCESSING
  |
  +---- SUCCESS ------> RESULT_SUCCESS
  |
  +---- NOT_FOUND ----> RESULT_NOT_FOUND
  |
  +---- INVALID ------> RESULT_INVALID
  |
  +---- NO_STOCK -----> RESULT_NO_STOCK
  |
  +---- ERROR --------> RESULT_ERROR
                          |
                          v
                        READY
```

After every result:

- clear scanner input;
- restore focus;
- allow another scan immediately.

Do not block scanning with modal confirmation dialogs.

---

# 22. Concurrency

Inventory updates must be atomic.

Two volunteers may scan the same ISBN at nearly the same time.

Do NOT implement quantity changes as:

```text
read quantity
modify in application
write quantity
```

without transactional protection.

Use a database transaction or atomic update.

Example conceptual SQL:

```sql
UPDATE inventory
SET quantity = quantity + 1,
    updated_at = NOW()
WHERE book_id = :book_id
RETURNING quantity;
```

For REMOVE, protect against negative quantity:

```sql
UPDATE inventory
SET quantity = quantity - 1,
    updated_at = NOW()
WHERE book_id = :book_id
  AND quantity > 0
RETURNING quantity;
```

The inventory change and inventory transaction creation should occur within the same database transaction.

---

# 23. Idempotency / Double Submission Protection

Barcode scanners and browsers may occasionally submit twice.

The frontend should disable duplicate submission while a scan is processing.

The backend should be designed so that adding an idempotency key later is easy.

For the initial MVP, one active scan request at a time per scanning screen is acceptable.

Do not allow the Enter key to create multiple parallel requests for the same input.

---

# 24. Error Handling

Network/API errors must never create partial inventory.

If metadata lookup fails because the external provider is unavailable:

```text
Lookup failed
Try again
```

No book or inventory row should be created.

If the book already exists locally, Add/Remove should continue to work even when external metadata APIs are unavailable.

External metadata lookup is required only for a previously unseen ISBN.

---

# 25. Recommended Architecture

A straightforward implementation:

```text
Browser
  |
  v
Next.js / React frontend
  |
  v
Application API
  |
  +------ PostgreSQL
  |
  +------ Metadata service
             |
             +-- Open Library
             |
             +-- Google Books fallback
```

Possible stack:

```text
Frontend / web server:
Next.js + TypeScript

Database:
PostgreSQL

Auth:
Supabase Auth or equivalent

Hosting:
Vercel / similar

Database hosting:
Supabase / managed PostgreSQL
```

The architecture is a recommendation, not a hard product requirement.

Codex may use an equivalent stack if explicitly instructed.

---

# 26. Suggested Project Structure

Example for a Next.js implementation:

```text
src/
  app/
    page.tsx

    scan/
      add/
        page.tsx
      remove/
        page.tsx

    inventory/
      page.tsx

    books/
      [id]/
        page.tsx

    activity/
      page.tsx

    admin/
      users/
        page.tsx

    api/
      scan/
        route.ts

      books/
        route.ts
        [id]/
          route.ts

      activity/
        route.ts

      transactions/
        [id]/
          undo/
            route.ts

      export/
        inventory/
          route.ts

  components/
    BarcodeInput.tsx
    ScanResult.tsx
    BookCard.tsx
    BookTable.tsx
    SearchInput.tsx

  lib/
    db/
    auth/
    isbn/
      normalize.ts
      validate.ts

    metadata/
      types.ts
      service.ts
      openLibrary.ts
      googleBooks.ts

    inventory/
      addBook.ts
      removeBook.ts
      undoTransaction.ts

  types/
```

---

# 27. Environment Variables

Example:

```env
DATABASE_URL=

AUTH_SECRET=

GOOGLE_BOOKS_API_KEY=
```

Open Library may not require a key depending on the integration used.

Secrets must remain server-side.

---

# 28. Security Requirements

Minimum MVP requirements:

- authenticated users only;
- server-side authorization;
- admin-only user management and export;
- validate all API input;
- never trust role information supplied by the browser;
- metadata requests happen server-side;
- SQL must be parameterized / ORM-generated;
- rate-limit or debounce scan API if necessary;
- no secrets exposed to frontend bundles.

---

# 29. Accessibility / Volunteer UX

The scanning UI should be usable by non-technical volunteers.

Requirements:

- large Add/Remove actions;
- obvious current scan mode;
- keyboard-first interaction;
- high readability;
- immediate scan feedback;
- scanner input always restored automatically;
- no unnecessary confirmation screens;
- avoid modal dialogs during scanning;
- visible Undo after successful changes;
- clear difference between success, not found, and failure.

The goal is that a volunteer can learn the basic workflow in less than a minute.

---

# 30. Explicitly Out of Scope

Do NOT implement these features in the MVP unless requirements are changed:

- price tracking;
- shelf/location tracking;
- individual copy IDs;
- custom barcode labels;
- condition grading;
- loans;
- library members;
- reservations;
- customer accounts;
- ecommerce;
- checkout/POS;
- payment processing;
- donation accounting;
- recommendation engine;
- manual creation of an unknown book;
- manual metadata form after failed ISBN lookup;
- cover uploads;
- advanced analytics;
- multi-shop inventory;
- stock transfer;
- mobile camera barcode scanning.

Phone-camera barcode scanning may be added later, but USB/Bluetooth keyboard-style barcode scanners are the MVP input method.

---

# 31. Acceptance Criteria

The MVP is complete when all of the following are true.

## Authentication

- [ ] A volunteer can log in.
- [ ] An admin can log in.
- [ ] Unauthenticated users cannot change inventory.

## Add scanning

- [ ] Scanner input is automatically focused.
- [ ] ISBN-10 and ISBN-13 can be processed.
- [ ] Hyphenated ISBNs are normalized.
- [ ] Invalid ISBNs cause no inventory change.
- [ ] Scanning an existing ISBN increases quantity by exactly 1.
- [ ] Scanning an unknown ISBN triggers metadata lookup.
- [ ] Metadata found -> book is created and quantity becomes 1.
- [ ] Metadata not found -> no book, inventory, or transaction is created.
- [ ] No manual entry form appears when metadata is not found.
- [ ] Input is ready for the next scan automatically.

## Remove scanning

- [ ] Scanning an in-stock ISBN decreases quantity by exactly 1.
- [ ] Quantity cannot become negative.
- [ ] Removing an ISBN at quantity 0 causes no mutation.
- [ ] Removing an ISBN absent from the database causes no mutation.
- [ ] Input is ready for the next scan automatically.

## Inventory

- [ ] Books can be searched by title.
- [ ] Books can be searched by author.
- [ ] Books can be searched by ISBN.
- [ ] Current quantity is visible.
- [ ] Out-of-stock titles remain in the database.
- [ ] No price information exists.
- [ ] No shelf/location information exists.

## Manual controls

- [ ] Existing books can be incremented manually.
- [ ] Existing books can be decremented manually.
- [ ] Manual decrement cannot reduce quantity below zero.

## Transactions

- [ ] Every successful inventory change creates a transaction.
- [ ] Failed/no-op scans do not create inventory transactions.
- [ ] Successful Add/Remove can be undone.
- [ ] Undo creates a reversing transaction rather than deleting history.

## Metadata

- [ ] Metadata providers are called only for unseen ISBNs in Add mode.
- [ ] Metadata is normalized before storage.
- [ ] Provider failure cannot create partial book/inventory records.
- [ ] Existing local inventory remains usable when metadata providers are unavailable.

## Export

- [ ] Admin can export current inventory as CSV.
- [ ] Export includes ISBN, title, authors, available metadata, and quantity.
- [ ] Export contains no price or shelf fields.

---

# 32. Recommended Implementation Order for Codex

Implement in this sequence.

## Phase 1 — Foundation

1. Create application.
2. Configure database.
3. Create schema/migrations.
4. Configure authentication.
5. Implement role model.

## Phase 2 — ISBN and Metadata

6. Implement ISBN normalization.
7. Implement ISBN-10 validation.
8. Implement ISBN-13 validation.
9. Implement normalized metadata types.
10. Implement Open Library provider.
11. Implement Google Books fallback.
12. Implement metadata service tests.

## Phase 3 — Inventory Domain Logic

13. Implement atomic ADD operation.
14. Implement atomic REMOVE operation.
15. Implement transaction creation.
16. Implement Undo.
17. Add concurrency tests.

## Phase 4 — Scan API

18. Implement `POST /api/scan`.
19. Handle SUCCESS.
20. Handle INVALID_ISBN.
21. Handle NOT_FOUND.
22. Handle NOT_IN_INVENTORY.
23. Handle OUT_OF_STOCK.
24. Add API tests.

## Phase 5 — Scanner UI

25. Build Add scan page.
26. Build Remove scan page.
27. Auto-focus barcode input.
28. Handle Enter submission.
29. Prevent duplicate parallel submissions.
30. Display scan result.
31. Restore focus automatically.
32. Add Undo.

## Phase 6 — Inventory UI

33. Inventory list.
34. Search.
35. Stock filter.
36. Book detail.
37. Manual Add.
38. Manual Remove.

## Phase 7 — Activity and Administration

39. Activity page.
40. User administration.
41. CSV export.

## Phase 8 — QA

42. Test with a physical USB barcode scanner.
43. Test rapid consecutive scanning.
44. Test simultaneous scans from two users.
45. Test external metadata outage.
46. Test unknown ISBN.
47. Test invalid retail barcode.
48. Test zero-stock removal.
49. Test undo.
50. Test CSV export.

---

# 33. Codex Implementation Directive

When implementing this specification:

1. Treat the **Core Product Rules** as authoritative.
2. Do not add product features that are explicitly out of scope.
3. Do not create price or shelf/location fields.
4. Do not create manual metadata entry for ISBNs that cannot be found.
5. An unknown ISBN must result in no database mutation.
6. Preserve book records when stock reaches zero.
7. Never permit negative inventory.
8. Use atomic database transactions for stock changes.
9. Record every successful inventory mutation in the audit trail.
10. Optimize the scan workflow for repeated hands-free barcode scanning.
11. Prefer simple, maintainable code over unnecessary abstractions.
12. Add automated tests for inventory rules before polishing the UI.

If an implementation decision is not specified here, choose the simplest design consistent with these rules.

---

# 34. MVP Definition in One Sentence

> An authenticated volunteer can continuously scan ISBN barcodes to add or remove known books from a quantity-based inventory; unseen ISBNs are automatically enriched from public metadata sources when possible, while unidentified ISBNs are ignored without creating any records.

---

# 35. First Local Trial — Technical Requirements and Setup

This section defines the recommended technical setup for the **first working local demo**.

The objective is:

> Run the web application locally on one computer, connect a real USB/Bluetooth barcode scanner, use a hosted free PostgreSQL/Auth service, and verify the entire Add/Remove workflow with real books before deploying the application publicly.

The first local trial should use the same architecture that can later be deployed online.

Do **not** build a throwaway local-only version.

---

# 36. First Local Trial Architecture

Recommended architecture:

```text
USB/Bluetooth Barcode Scanner
            |
            | keyboard input
            v
+------------------------------+
| Volunteer computer           |
|                              |
| Browser                      |
| http://localhost:3000        |
|                              |
| Next.js application          |
+--------------+---------------+
               |
               | HTTPS
               |
       +-------+-------------------+
       |                           |
       v                           v
+--------------+           +----------------+
| Supabase     |           | Book Metadata  |
|              |           |                |
| PostgreSQL   |           | Open Library   |
| Auth         |           | Google Books   |
+--------------+           +----------------+
```

Important:

- The **web application runs locally**.
- The **database and authentication run in Supabase**.
- New ISBN metadata is retrieved from public APIs.
- Existing books are handled entirely from the application database.
- The scanner requires no custom driver integration if it operates in USB HID / keyboard mode.

This configuration has several advantages:

- no local PostgreSQL installation;
- no local authentication server;
- no Docker requirement;
- production-like architecture from day one;
- easy migration to an online deployment;
- near-zero infrastructure cost.

---

# 37. Estimated Cost for the First Trial

Expected cost:

```text
Next.js development          €0
Supabase free tier           €0
Open Library                 €0
Google Books                 €0 for normal MVP usage
GitHub                       €0
Local browser/server         €0
--------------------------------
Software cost                €0/month
```

Optional cost:

```text
USB barcode scanner          approximately €20–€50 one time
Domain name                  not required for local trial
```

A domain should NOT be purchased before the local workflow has been validated.

---

# 38. Local Trial Hardware Requirements

## 38.1 Computer

Any reasonably modern computer is sufficient.

Supported development/demo environments:

- Windows 10/11
- macOS
- Linux

Recommended minimum:

```text
CPU        Any modern dual-core or better
RAM        8 GB recommended
Storage    2 GB free workspace is more than enough
Internet   Required for Supabase and first-time metadata lookups
USB        Required if using a USB scanner
```

The application itself has extremely low resource requirements.

---

## 38.2 Barcode Scanner

Recommended scanner type:

```text
USB HID barcode scanner
```

or:

```text
Bluetooth scanner operating in keyboard/HID mode
```

Required barcode support:

- EAN-13
- Bookland EAN / ISBN-13
- ideally ISBN-10 recognition where applicable

The scanner should be configured to send:

```text
SCANNED_BARCODE + ENTER
```

Example:

```text
9780141187761
ENTER
```

The scanner should behave exactly like a keyboard.

No vendor SDK should be required.

---

# 39. Software Requirements

Install the following on the development computer.

## Required

```text
Git
Node.js — current LTS version
npm or pnpm
A modern browser
A code editor
```

Recommended editor:

```text
VS Code
```

Codex or another coding assistant may be used from the repository.

## Optional

```text
Docker
Postman / Insomnia
Supabase CLI
```

Docker is explicitly **not required** for the first local trial.

The Supabase CLI is useful later for schema management and local emulation, but the first test can use hosted Supabase directly.

---

# 40. Recommended Technology Stack

Lock the first implementation to the following stack unless there is a compelling reason to change it.

```text
Language
  TypeScript

Framework
  Next.js

Frontend
  React

Styling
  Tailwind CSS

Database
  PostgreSQL

Database hosting
  Supabase

Authentication
  Supabase Auth

Book metadata
  Open Library
  Google Books fallback

Version control
  Git + GitHub

Development environment
  localhost

Initial scanner
  USB/Bluetooth HID keyboard scanner

Export
  CSV
```

Avoid introducing:

- Redux;
- a separate FastAPI backend;
- MongoDB;
- Kafka;
- microservices;
- Kubernetes;
- Redis;
- local PostgreSQL;

for the MVP.

They provide no meaningful benefit for this application.

---

# 41. Repository Layout

Recommended repository:

```text
bookshop-inventory/
|
|-- src/
|   |-- app/
|   |-- components/
|   |-- lib/
|   |-- types/
|
|-- public/
|
|-- tests/
|
|-- supabase/
|   |-- migrations/
|
|-- docs/
|   |-- MVP_SPEC.md
|
|-- .env.example
|-- .gitignore
|-- package.json
|-- README.md
|-- tsconfig.json
```

This MVP specification should be placed at:

```text
docs/MVP_SPEC.md
```

Codex should treat it as the authoritative product specification.

---

# 42. Create the Project

Example initial command:

```bash
npx create-next-app@latest bookshop-inventory
```

Recommended selections:

```text
TypeScript:       Yes
ESLint:           Yes
Tailwind CSS:     Yes
src/ directory:   Yes
App Router:       Yes
Import alias:     Yes
```

Then:

```bash
cd bookshop-inventory
```

Install Supabase client dependencies:

```bash
npm install @supabase/supabase-js
```

If using server-side authentication helpers, install the current official Supabase packages recommended for Next.js.

Avoid copying outdated authentication examples from old tutorials.

---

# 43. Git Setup

Initialize Git if the project generator did not already do so:

```bash
git init
git add .
git commit -m "Initial Next.js project"
```

Create a private or public GitHub repository.

Then:

```bash
git remote add origin <repository-url>
git push -u origin main
```

Do not commit `.env.local`.

---

# 44. Create a Supabase Project

For the first local trial:

1. Create a Supabase account.
2. Create one project for the demo.
3. Choose a nearby region.
4. Set a strong database password.
5. Save the project URL.
6. Save the public anonymous/publishable key.
7. Save server-side secrets only where required.

The free tier is sufficient for the MVP/demo.

The database should initially contain:

```text
users / profiles
books
authors
book_authors
inventory
inventory_transactions
```

The exact schema is defined earlier in this document.

---

# 45. Authentication Setup

For the local demo, use:

```text
Email + Password
```

Do not implement:

- Google login;
- Apple login;
- magic links;
- public registration;

unless explicitly required later.

Recommended behavior:

- an Admin account is created manually;
- Admin creates or invites volunteer accounts;
- the login page accepts email/password;
- logged-out users cannot access inventory operations.

For the first demo, one Admin and one Volunteer account are enough.

---

# 46. User Profile / Role Mapping

Supabase Auth stores authentication identity.

Application-specific roles should be stored separately.

Example:

```text
profiles
--------------------------------
id          UUID PRIMARY KEY
name        VARCHAR
role        VOLUNTEER | ADMIN
active      BOOLEAN
```

The `id` should match the Supabase Auth user ID.

Authorization must always be checked server-side.

Never trust:

```text
role = "ADMIN"
```

sent by the browser.

---

# 47. Environment Variables

Create:

```text
.env.local
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_BOOKS_API_KEY=
```

Only include a service-role key if the implementation actually needs it.

Important rules:

- `.env.local` must be in `.gitignore`;
- secrets must never be committed;
- service-role keys must never be exposed in client-side code;
- variables beginning with `NEXT_PUBLIC_` are visible to the browser.

Also create:

```text
.env.example
```

with empty placeholders:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_BOOKS_API_KEY=
```

Do not include real credentials.

---

# 48. Database Migration Strategy

All schema changes should be written as migrations.

Do not manually modify production-like tables without preserving migration history.

Recommended location:

```text
supabase/migrations/
```

Example:

```text
001_initial_schema.sql
002_add_inventory_constraints.sql
003_add_indexes.sql
```

The schema should be reproducible from the repository.

---

# 49. Required Database Constraints

At minimum:

## books

```text
isbn13 UNIQUE where non-null
isbn10 UNIQUE where non-null
title NOT NULL
```

## inventory

```text
book_id PRIMARY KEY
quantity NOT NULL
CHECK quantity >= 0
```

## book_authors

```text
PRIMARY KEY(book_id, author_id)
```

## inventory_transactions

Must reference:

- book;
- user;
- optional reversed transaction.

Use foreign keys.

---

# 50. Recommended Database Indexes

Add indexes for search and audit queries.

At minimum:

```text
books(isbn13)
books(isbn10)
books(title)
authors(name)
inventory_transactions(book_id)
inventory_transactions(user_id)
inventory_transactions(created_at)
```

For early MVP search volume, simple PostgreSQL search is sufficient.

Do not add Elasticsearch.

---

# 51. Row-Level Security

If the browser communicates directly with Supabase for any operation, enable Row-Level Security.

However, inventory mutation logic should preferably pass through server-side application code.

Server-side business logic must enforce:

```text
quantity >= 0
valid user
authorized action
valid ISBN
transaction audit creation
```

Do not rely on frontend validation for data integrity.

---

# 52. ISBN Utility Module

Create:

```text
src/lib/isbn/
  normalize.ts
  validate.ts
```

Required functions should include concepts equivalent to:

```ts
normalizeIsbn(input: string): string
isValidIsbn10(input: string): boolean
isValidIsbn13(input: string): boolean
isValidIsbn(input: string): boolean
```

Normalize:

```text
978-0-14-118776-1
```

to:

```text
9780141187761
```

before database lookup.

Tests must cover:

- valid ISBN-10;
- valid ISBN-13;
- spaces;
- hyphens;
- lowercase/uppercase X in ISBN-10;
- invalid checksum;
- random EAN barcode;
- empty input.

---

# 53. Metadata Provider Layer

Create a provider abstraction.

Recommended directory:

```text
src/lib/metadata/
  types.ts
  service.ts
  openLibrary.ts
  googleBooks.ts
```

Lookup strategy:

```text
new ISBN
   |
   v
Open Library
   |
   +-- found ------> normalize metadata
   |
   +-- not found --> Google Books
                         |
                         +-- found --> normalize metadata
                         |
                         +-- not found --> return null
```

The UI should not know which provider succeeded.

The backend should return one normalized result.

---

# 54. Metadata Cache Rule

The local database is the metadata cache.

If an ISBN already exists in `books`:

```text
DO NOT call Open Library
DO NOT call Google Books
```

Use the stored record.

This reduces:

- API traffic;
- latency;
- dependency on external services;
- risk during temporary API outages.

---

# 55. Metadata Failure Rules

For a new ISBN:

```text
metadata API unavailable
```

must result in:

```text
no book created
no inventory created
no transaction created
```

UI result:

```text
Lookup failed
```

The user may rescan later.

For an existing ISBN, external API failure is irrelevant.

Existing inventory must still work.

---

# 56. Atomic Inventory Operations

All successful quantity updates and transaction-log creation must occur in one database transaction.

Conceptually:

```text
BEGIN

update inventory

insert inventory_transaction

COMMIT
```

If either operation fails:

```text
ROLLBACK
```

Never allow:

```text
inventory changed
but transaction missing
```

or:

```text
transaction exists
but inventory did not change
```

---

# 57. Add Operation

Pseudo-flow:

```text
receive ISBN
   |
normalize
   |
validate
   |
check local books
   |
   +-- exists -------------------+
   |                             |
   |                             v
   |                         quantity + 1
   |
   +-- absent
          |
          v
     metadata lookup
          |
          +-- not found -> return NOT_FOUND
          |
          +-- found
                 |
                 v
              create book
                 |
                 v
             quantity = 1
```

Successful path always creates an ADD transaction.

---

# 58. Remove Operation

Pseudo-flow:

```text
receive ISBN
   |
normalize
   |
validate
   |
local DB lookup
   |
   +-- absent -> NOT_IN_INVENTORY
   |
   +-- exists
          |
          v
      quantity?
       /      \
      0       >0
      |        |
      |        v
 OUT_OF_STOCK quantity - 1
               |
               v
          REMOVE transaction
```

Remove mode should not query metadata providers.

---

# 59. Undo Operation

Undo should reference the original transaction.

Example:

```text
Original:
ADD
3 -> 4

Undo:
UNDO
4 -> 3
reverses_transaction_id = original transaction id
```

The original transaction must remain in history.

Never delete audit records to implement Undo.

---

# 60. Scanner Input Component

Recommended component:

```text
src/components/BarcodeInput.tsx
```

Responsibilities:

- automatically focus on mount;
- accept scanner/keyboard input;
- submit on Enter;
- reject empty values;
- prevent concurrent submissions;
- clear input after submission;
- restore focus after result;
- allow manual ISBN typing.

The input may remain visible so volunteers can see what was scanned.

---

# 61. Scanner UX Timing

Do not require a confirmation dialog.

Expected interaction:

```text
scan
-> short result
-> immediately ready
```

Target behavior:

```text
Volunteer scans Book A
Volunteer moves Book A aside
Volunteer scans Book B
Volunteer moves Book B aside
...
```

The application should not force mouse usage during a scan batch.

---

# 62. Scan State Machine

Implement explicit UI states:

```text
READY
PROCESSING
SUCCESS
NOT_FOUND
INVALID_ISBN
NOT_IN_INVENTORY
OUT_OF_STOCK
ERROR
```

After every result, transition back to READY.

The scanner input must regain focus.

---

# 63. Add Scan Page

Local URL:

```text
http://localhost:3000/scan/add
```

Minimum screen:

```text
ADD BOOKS

Scan ISBN

[____________________________]

Last result
```

After success:

```text
ADDED

1984
George Orwell

Stock: 3 -> 4

[Undo]

Ready for next scan...
```

Unknown ISBN:

```text
Book not found

Ready for next scan...
```

No form should appear.

---

# 64. Remove Scan Page

Local URL:

```text
http://localhost:3000/scan/remove
```

The screen must have clearly different wording from Add mode.

Minimum:

```text
REMOVE BOOKS

Scan ISBN

[____________________________]
```

Success:

```text
REMOVED

1984
Stock: 4 -> 3

[Undo]
```

If absent:

```text
Book not in inventory
```

If zero:

```text
Already out of stock
```

---

# 65. Search / Inventory Page

Local URL:

```text
http://localhost:3000/inventory
```

Search fields:

```text
Title
Author
ISBN
```

A single search input may match all three.

Display:

```text
Cover
Title
Author
ISBN
Quantity
```

Filters:

```text
All
In stock
Out of stock
```

No price or location fields.

---

# 66. Book Detail Page

Local URL pattern:

```text
http://localhost:3000/books/<id>
```

Display:

```text
Cover
Title
Authors
ISBN-13
ISBN-10
Publisher
Publication Date
Language
Quantity
```

Controls:

```text
+ Add copy
- Remove copy
```

These controls use the same domain logic as scanning.

Do not duplicate inventory business logic in UI-specific code.

---

# 67. Activity Page

Local URL:

```text
http://localhost:3000/activity
```

Display:

```text
Timestamp
Book
Action
Quantity before
Quantity after
User
```

The activity page is important for identifying accidental scans.

---

# 68. CSV Export

Admin-only.

Example route:

```text
http://localhost:3000/api/export/inventory
```

Columns:

```text
ISBN-13
ISBN-10
Title
Authors
Publisher
Publication Date
Language
Quantity
```

No:

```text
Price
Shelf
Location
```

should exist.

---

# 69. Development Commands

Typical workflow:

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Expected output should expose:

```text
http://localhost:3000
```

Build test:

```bash
npm run build
```

Production-like local run:

```bash
npm run start
```

Lint:

```bash
npm run lint
```

Tests should have an explicit project script, for example:

```bash
npm test
```

or:

```bash
npm run test
```

The exact test runner may be selected during implementation.

---

# 70. Recommended Testing Tools

For unit/integration testing, use a mainstream TypeScript test runner compatible with the chosen Next.js version.

Good choices include:

```text
Vitest
Jest
```

For browser/end-to-end tests:

```text
Playwright
```

Do not introduce multiple overlapping test frameworks without need.

---

# 71. Minimum Automated Tests Before Hardware Trial

The local hardware demo should not start until these pass.

## ISBN

- valid ISBN-10;
- valid ISBN-13;
- invalid checksum;
- hyphen removal;
- space removal;
- unsupported barcode.

## Add

- existing ISBN increments by exactly 1;
- new ISBN + metadata creates book;
- metadata missing creates nothing;
- metadata API error creates nothing.

## Remove

- existing in-stock ISBN decrements by exactly 1;
- zero-stock ISBN remains zero;
- absent ISBN changes nothing.

## Transactions

- successful Add creates transaction;
- successful Remove creates transaction;
- failed scan creates no inventory transaction;
- Undo creates reverse transaction;
- Undo does not delete original.

## Concurrency

- simultaneous Add actions cannot lose increments;
- simultaneous Remove actions cannot cause negative inventory.

---

# 72. Physical Barcode Scanner Setup

Before opening the application:

1. Connect scanner.
2. Open a plain text editor.
3. Scan a book.
4. Verify the scanner types something like:

```text
9780141187761
```

5. Verify it sends Enter automatically.

If not, configure the scanner according to its manual to add:

```text
ENTER / CR / LF suffix
```

Then open:

```text
http://localhost:3000/scan/add
```

Scan again.

The application should process the input without any mouse click.

---

# 73. First Real-Book Test Set

Prepare approximately 20–50 books.

The batch should intentionally include:

```text
multiple copies of the same ISBN
different authors
different publishers
older books
new books
at least one ISBN expected to be absent from metadata services
one non-book barcode if available
```

Also test the same ISBN repeatedly.

Example:

```text
Book A scan -> 1
Book A scan -> 2
Book A scan -> 3
```

Then switch to Remove mode:

```text
Book A scan -> 2
Book A scan -> 1
Book A scan -> 0
Book A scan -> remains 0
```

---

# 74. First Local Demo Checklist

Before the first volunteer demo:

## Application

- [ ] Application starts with `npm run dev`.
- [ ] Login works.
- [ ] Add page opens.
- [ ] Remove page opens.
- [ ] Inventory page opens.
- [ ] Activity page opens.

## Scanner

- [ ] Scanner works in plain text editor.
- [ ] Scanner sends Enter.
- [ ] Scanner input automatically receives focus.
- [ ] Multiple scans do not require clicking.

## Add

- [ ] Known ISBN adds one copy.
- [ ] Repeated ISBN increases quantity.
- [ ] New known ISBN retrieves metadata.
- [ ] Unknown ISBN creates nothing.
- [ ] Invalid barcode creates nothing.
- [ ] Undo works.

## Remove

- [ ] Existing book removes one copy.
- [ ] Unknown local ISBN does nothing.
- [ ] Zero quantity cannot become negative.
- [ ] Undo works.

## Search

- [ ] Title search works.
- [ ] Author search works.
- [ ] ISBN search works.
- [ ] Quantity is correct.

## Audit

- [ ] Add transaction appears.
- [ ] Remove transaction appears.
- [ ] Undo transaction appears.
- [ ] Failed scans do not appear as inventory transactions.

---

# 75. Recommended Demo Procedure

Use this exact workflow for the first demonstration.

## Step 1

Log in as Volunteer.

## Step 2

Open:

```text
Add Books
```

## Step 3

Scan approximately 10 books continuously.

Do not use the mouse between scans.

## Step 4

Scan one duplicate ISBN three times.

Verify quantity increments three times.

## Step 5

Scan an unknown or unsupported ISBN.

Verify:

```text
Book not found
```

and no record is created.

## Step 6

Search for one of the added books.

Verify metadata and quantity.

## Step 7

Open Remove mode.

Scan the same book.

Verify quantity decreases.

## Step 8

Use Undo.

Verify quantity returns to its previous value.

## Step 9

Open Activity.

Verify all successful changes are visible.

## Step 10

Log in as Admin and export inventory CSV.

---

# 76. Internet Failure Test

Because the local application still uses cloud services, test degraded behavior.

## Existing ISBN

Disconnect or block metadata API access.

Existing ISBN should still work as long as the application can reach Supabase.

## New ISBN

If metadata cannot be retrieved:

```text
Lookup failed
```

No record should be created.

## Supabase unavailable

If the database cannot be reached:

```text
Inventory service unavailable
```

No local guess or offline stock mutation should occur in the MVP.

Offline-first functionality is out of scope.

---

# 77. Basic Performance Expectations

The application does not require high-performance infrastructure.

Target interaction:

```text
Existing ISBN scan:
typically near-instant

New ISBN:
depends on external metadata API response
```

Avoid artificial delays.

For newly encountered books, if API latency is noticeable, display:

```text
Looking up book...
```

Do not freeze the entire page.

---

# 78. Metadata API Rate Handling

Volunteers may scan faster than external APIs should be called.

Use a controlled lookup flow for unseen ISBNs.

Existing ISBNs must bypass metadata APIs.

Possible approach:

```text
scanner input
    |
    v
local DB lookup
    |
    +-- exists -> immediate inventory operation
    |
    +-- new -> metadata request
```

If needed later, unseen ISBN lookups may be queued.

Do not add complex infrastructure for this during the initial implementation unless real-world testing demonstrates a need.

---

# 79. Error Messages for Volunteers

Keep messages short.

Recommended:

```text
Added
Removed
Book not found
Book not in inventory
Already out of stock
Invalid ISBN
Lookup failed
Inventory service unavailable
```

Avoid technical errors such as:

```text
HTTP 500
PostgREST failure
fetch exception
constraint violation
```

Technical details belong in application logs.

---

# 80. Logging

During development, log:

```text
scan request
normalized ISBN
operation mode
metadata provider used
metadata provider failure
database failure
transaction ID
```

Do NOT log:

- passwords;
- auth tokens;
- service keys.

Production logging may be reduced later.

---

# 81. Backup During the Trial

For the earliest demo, sophisticated backups are not required.

However, once real shop inventory starts being entered:

1. regularly export inventory CSV;
2. preserve database migrations;
3. keep the Git repository backed up;
4. consider scheduled database backups before the system becomes operationally important.

The first 20–100 test books may be disposable test data.

Clearly distinguish:

```text
DEMO DATA
```

from the future real shop inventory.

---

# 82. Demo Database Reset

During development it should be easy to reset the demo database.

Provide a documented development-only mechanism to:

```text
delete transactions
delete inventory
delete books
delete authors
```

while preserving authentication accounts if convenient.

Never expose a database reset button to normal volunteers.

Any reset script must be clearly marked as development-only.

---

# 83. Seed Data

Optional but recommended.

Provide a small seed script with a few books for UI development.

For example:

```text
1984
The Trial
The Stranger
```

Seed data should never be mixed with real production inventory.

The scanner workflow must also be tested using real API-retrieved books.

---

# 84. `.gitignore`

At minimum include:

```text
node_modules
.next
.env
.env.local
.env.*.local
coverage
playwright-report
```

Never commit:

```text
database password
Supabase service key
Google Books secret/API key if restricted
```

---

# 85. README Requirements

The project README should contain:

```text
Project purpose
Architecture
Prerequisites
Installation
Environment setup
Supabase setup
Database migrations
How to run locally
How to create demo users
How to test scanner
How to run tests
How to build
Troubleshooting
```

The README should point to:

```text
docs/MVP_SPEC.md
```

for full product rules.

---

# 86. Troubleshooting — Scanner Types Digits but Does Not Submit

Symptom:

```text
9780141187761
```

appears in the field but nothing happens.

Likely cause:

Scanner is not configured to send Enter.

Fix:

Configure scanner suffix:

```text
CR
ENTER
CR/LF
```

according to scanner documentation.

---

# 87. Troubleshooting — Scanner Opens Browser Shortcuts

Likely cause:

The scan input does not have focus.

Required application behavior:

- focus input on page load;
- focus after each result;
- focus after clicking anywhere appropriate on scan screen.

Provide a visible:

```text
Click here to resume scanning
```

fallback only if browser focus is lost.

---

# 88. Troubleshooting — Barcode Is Rejected

Possible reasons:

- barcode is not an ISBN;
- invalid checksum;
- scanner read error;
- barcode is another product identifier.

Show:

```text
Invalid ISBN
```

Do not create inventory.

---

# 89. Troubleshooting — Book Not Found

Expected behavior:

```text
Book not found
```

No manual form.

No database mutation.

Volunteer simply places the book aside for whatever manual process the bookshop chooses outside the MVP.

---

# 90. Troubleshooting — Metadata Provider Down

Expected behavior for a new ISBN:

```text
Lookup failed
```

No database mutation.

Existing ISBNs should remain functional.

---

# 91. Troubleshooting — Duplicate Scan

The frontend must allow only one active request at a time per scan input.

During processing:

```text
PROCESSING
```

additional Enter events from the same input should not create parallel requests.

If accidental repeated physical scans happen sequentially, each scan is legitimate and should increment/decrement once.

Undo is the correction mechanism.

---

# 92. First Local Trial Success Criteria

The local trial is considered successful when:

1. the application runs on `localhost`;
2. login works;
3. a physical scanner can add books without mouse interaction;
4. existing ISBNs increment correctly;
5. new identifiable ISBNs are created automatically;
6. unidentifiable ISBNs create nothing;
7. Remove mode decrements correctly;
8. quantity never becomes negative;
9. manual search works;
10. activity history is correct;
11. Undo works;
12. CSV export works;
13. at least 20–50 real books have been processed;
14. at least one duplicate ISBN has been tested;
15. at least one unknown ISBN has been tested.

Do not deploy publicly until these criteria are satisfied.

---

# 93. Transition From Local Trial to Online Pilot

After the local trial succeeds, deployment should require minimal architectural change.

Current:

```text
Browser
  |
localhost Next.js
  |
Supabase
```

Online:

```text
Browser
  |
Hosted Next.js application
  |
Supabase
```

The database can remain the same.

The main changes are:

```text
deploy application
configure production environment variables
configure production URL
configure auth redirect URLs
enable HTTPS
optionally add custom domain
```

No inventory-domain rewrite should be necessary.

---

# 94. Recommended Deployment Timing

Do not deploy online merely because the application compiles.

Deploy after:

```text
20–50 real books
+
real scanner
+
duplicate ISBN test
+
unknown ISBN test
+
remove-to-zero test
+
undo test
+
two-user concurrency test if possible
```

This validates the actual volunteer workflow before adding hosting concerns.

---

# 95. Technical Decision for the First Trial

The recommended first trial is therefore:

```text
APPLICATION
Next.js + TypeScript + React + Tailwind

RUNNING
localhost on one development/demo computer

DATABASE
Supabase hosted PostgreSQL

AUTH
Supabase Auth

METADATA
Open Library
Google Books fallback

SCANNER
USB/Bluetooth HID keyboard scanner

COST
€0/month software infrastructure

DATA MODEL
quantity per ISBN

UNKNOWN ISBN
no record created

PRICE
not implemented

SHELF / LOCATION
not implemented
```

This should be treated as the default technical baseline for Codex implementation.

---

# 96. Codex Task for the First Local Trial

Codex should be given the following implementation goal:

> Build the application defined in this specification as a locally runnable Next.js/TypeScript application using Supabase for PostgreSQL and authentication. The first milestone is not public deployment. The milestone is a working localhost demo with a physical HID barcode scanner and 20–50 real books. Follow all MVP business rules exactly, particularly: no price/location features, no manual creation of unknown books, no negative inventory, no database mutation for unidentified ISBNs, and transaction logging for every successful stock change.

Recommended execution order:

```text
1. Scaffold Next.js project
2. Configure Supabase
3. Create migrations
4. Implement auth
5. Implement ISBN utilities
6. Implement metadata providers
7. Implement atomic inventory operations
8. Implement scan API
9. Implement Add scanner UI
10. Implement Remove scanner UI
11. Implement inventory search
12. Implement book detail page
13. Implement activity
14. Implement Undo
15. Implement CSV export
16. Add automated tests
17. Test physical scanner
18. Process first 20–50 real books
19. Fix workflow issues
20. Only then prepare online deployment
```
