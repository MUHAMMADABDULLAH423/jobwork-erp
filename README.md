# JobWork ERP

A mini ERP for a job-work factory. Vendors send material with **their** challan
for processing; you note the vendor's challan number, do the work, then issue
**your own** challan back to the vendor. The app keeps the daily register
digitally and builds each vendor's month-end bill automatically — no manual
month-end compilation.

## Workflow

1. **Vendors** — add your fixed vendors and set each vendor's **rate card**
   (fixed rate per item + process).
2. **Inward** — when material arrives, enter the vendor's challan number, date,
   item, qty and the required process. This becomes a *pending job*.
3. **Outward** — when the work is done, issue your challan. You can link a
   pending inward (autofills item/qty/process); the rate is auto-filled from
   the rate card and **frozen** on the challan. Challan numbers are
   auto-generated (`JW-0001`, `JW-0002`, …). Print the challan right away.
4. **Register** — date-wise combined view of the day's inward + outward
   entries, like the paper register.
5. **Billing** — pick vendor + month: the statement (date-wise lines, totals)
   builds itself from outward challans. Save as **Draft** while the month is
   open, **Mark Final** to freeze it, then print.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
(Auth + Postgres + RLS) · `@supabase/ssr`.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the whole `supabase/schema.sql` file. It creates
   all tables, the challan counter, the `next_challan_no()` function, the
   amount/status triggers, and RLS policies (single tenant: full access for
   authenticated users).
3. Create your login user: **Authentication → Users → Add user** (email +
   password). The app uses email/password sign-in only.

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in from **Supabase → Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `anon`/`public` key — never the
  `service_role` key)

### 3. Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run typecheck
npm run build
```

### 4. Deploy (Vercel)

Push to GitHub, import in Vercel, add the two env vars above in
**Project Settings → Environment Variables**, deploy. No other config needed.

## How challan numbering works

Outward challan numbers come from a single-row `challan_counter` table.
`next_challan_no()` is a `SECURITY DEFINER` Postgres function that increments
the counter with `UPDATE … RETURNING` — atomic inside its transaction, so two
users saving at the same moment can never receive the same number. The app
calls it via `supabase.rpc("next_challan_no")` right before inserting the
challan, and retries with a fresh number if the (extremely rare) unique
violation on `challan_no` ever fires.

## How rate snapshots work

- The rate card (`rate_cards`) is the editable master: one fixed rate per
  `(vendor, item, process)`, managed on the Vendors page.
- When you create an outward challan, the rate is auto-filled from the
  matching rate-card row (you can still override it per challan).
- The rate is stored **on the outward challan line itself** — a snapshot.
  Changing the rate card later never touches old challans or bills.
- A database trigger (`trg_outward_amount`) keeps `amount = qty × rate` on
  every insert/update, so amounts are always consistent.

## How month-end billing works

- **Draft:** the statement is recomputed live from `outward_challans` every
  time you open the vendor + month, so late entries are picked up
  automatically. "Save as Draft" stores the current lines as a snapshot.
- **Final:** "Mark Final" freezes the snapshot into `month_bills`. Final
  bills always show their stored snapshot — later entries don't change them.
- One row per `(vendor, month)` (`unique` constraint); saving again for the
  same month updates the draft in place.

## Project layout

```
supabase/schema.sql          # tables, RLS, counter, triggers
src/app/layout.tsx           # root layout
src/app/globals.css          # Tailwind + print styles
src/app/login/               # sign-in page
src/app/(app)/               # authenticated routes (sidebar shell)
  page.tsx                   # dashboard: today's counts + pending jobs
  vendors/                   # vendor CRUD + rate card editor
  inward/                    # inward challan entries + history
  outward/                   # outward challans + print
  register/                  # daily register view
  billing/                   # month-end statements + print
src/components/
  ui.tsx                     # shared inputs/buttons/table/badge
  Shell.tsx                  # sidebar nav + logout
  ChallanDoc.tsx             # printable outward challan
  BillDoc.tsx                # printable month-end bill
src/lib/
  supabase/client.ts         # browser Supabase client
  supabase/server.ts         # server Supabase client (cookies)
  types.ts                   # shared TypeScript types
  format.ts                  # date/number/month helpers
middleware.ts                # session refresh + auth guard for every page
```

## Notes

- All pages are `force-dynamic` (rendered on demand) since every view reads
  live data.
- Print views hide the navigation and buttons via `.no-print` / `.print-only`
  CSS in `globals.css`.
- No seed or demo data — the app starts empty and everything is entered
  through the UI.
