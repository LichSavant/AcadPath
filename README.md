# AcadPath

A USC-themed academic pathway planner built on the existing Vinext/React, TypeScript, and Cloudflare D1 architecture. Uses text branding and a generic academic icon, without official university assets.

## Run

Requires Node.js 24 and npm. In Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

The dev/build commands prepare local PDF and OCR worker assets automatically. Open the server's Local URL, normally http://localhost:3000. Local development uses one development identity; new databases start without a curriculum. Production authentication remains the existing Sites/ChatGPT integration. Host behind Sites, which owns trusted identity headers and sign-in routes.

No new database migration is required for this update. Existing records remain compatible. `db:migrate` applies the existing schema to a fresh local database.

## Student flow

1. A new account sees only the setup invitation.
2. Choose a PDF, PNG, JPG, or JPEG prospectus. Replace/remove the file or cancel processing at any time.
3. Review real extracted rows. Correct code, name, units, prerequisites, year, and semester; add missing rows or remove unwanted ones. Source text and optional corequisites are available per row.
4. Confirm the reviewed curriculum. This persists the curriculum with setup incomplete, without assumed progress or plans.
5. Review completed, currently taking, remaining, and failed statuses, then save. Only then do the dashboard, map, planner, and simulator become available.
6. Plan semesters using real prerequisites and explicit planning assumptions. Simulations never save changes to the real record.

Replacing an existing curriculum requires confirmation and resets its statuses and plan. The selected file and extracted text stay in the browser; only the confirmed structured curriculum and filename/extraction method are saved.

## Extraction

PDF.js reads PDF text. Tesseract performs English OCR for images and scanned PDF pages. Worker code and language data are served locally from generated `public/extraction/` assets; no document is sent to an OCR service and no API key is required.

Limits: 20 MB, 20 PDF pages, 25-megapixel images, and 300 subjects. Row recognition is conservative and heuristic. Uncertain values remain blank and must be corrected. Unrecognized documents show an empty review, never substitute subjects. Complex or side-by-side tables, low-resolution scans, unusual course codes, and wrapped cells may require manual reconstruction. Password-protected PDFs require an unlocked copy.

Review is mandatory: OCR and document layout recognition are fallible. Prerequisites use all-of semantics. Offered semesters follow the reviewed semester; alternate offerings cannot currently be edited through the review screen. Legacy CSV/JSON validation remains for existing tests/data compatibility but is no longer the student upload flow.

## Academic model and persistence

`lib/academic.ts` owns prerequisites, eligibility, blockers, progress, planning, graduation projections, and simulation. `lib/import.ts` validates confirmed curricula and saved records. `lib/prospectus.ts` parses source rows without UI dependencies; `lib/extract-prospectus.ts` handles browser PDF/OCR processing.

The D1 `student_records` table stores each authenticated student's validated document atomically with revision checks. Setup state is stored in the same document. No academic records are stored in browser storage. Existing records without a setup flag remain available.

Only completed subjects satisfy prerequisites today. Current subjects count toward future projections only when the student enables the pass assumption. Corequisites require completed or concurrent enrollment. Both UI and API reject conflicting new plans/settings; grade changes can retain an existing plan with visible conflicts. Invalid saved plans suppress graduation estimates.

## Verify

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
# With the local development server running:
npm.cmd run test:flow
```

Unit tests cover academic rules, parsing, incomplete extraction, file limits, setup state, and simulation isolation. HTTP tests cover confirmation, status completion, persistence, revisions, planning, validation, and authentication. They restore an existing record; a fresh test database retains its test fixture.

Use a separate local D1 store for verification to preserve your development record:

```powershell
npx.cmd wrangler d1 migrations apply DB --local --config wrangler.local.json --persist-to .wrangler/prospectus-verification
$env:ACADPATH_TEST_STATE='.wrangler/prospectus-verification'
npm.cmd run dev
# Run test:flow in a second terminal.
```

Clear `ACADPATH_TEST_STATE` before returning to your normal local database. The frontend was visually reviewed at desktop (1440x1000), tablet (820x1000), and mobile (390x844) sizes. Wide curriculum tables scroll within their containers; the academic timeline stacks vertically on smaller screens. Browser checks cover prerequisite tracing, subject drawers, keyboard focus, reduced motion, mobile navigation, and page overflow.

## Limitations

- Two regular semesters only: no summer calendar, section capacity, grade thresholds, OR prerequisites, residency rules, or institutional overrides.
- Graduation estimates use a deterministic scheduler with a 24-term horizon and assumed future passes, not guaranteed enrollment dates.
- Simulation compares one scenario at a time and cannot be applied to the real record.
- Complex prospectus layouts may need manual corrections; extraction is not official curriculum verification.
- Hosted authentication continues to require the existing Sites integration.
