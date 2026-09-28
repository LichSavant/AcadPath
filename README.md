# AcadPath

A prerequisite-aware academic pathway planner for University of San Carlos (USC), Cebu students. Built on the existing Sites Vinext/React, TypeScript, and Cloudflare D1 architecture. The USC-inspired green, white, and restrained gold interface uses text branding and a generic academic icon; no official logo or institutional curriculum is implied.

## Run locally

Requires Node.js 24 (the test runner uses native TypeScript support) and npm. In Windows PowerShell, use `npm.cmd` / `npx.cmd` if script execution is disabled.

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

Open the Local URL printed by the server (normally http://localhost:3000). The local sign-in creates one development-only profile, Seedy. The Sites development plugin handles this identity only for loopback requests. It is not a production password system.

Production sign-in uses ChatGPT through the Sites dispatcher; production records are scoped to its stable user ID. Host behind Sites, which owns the trusted identity headers and sign-in/sign-out routes. Do not expose the raw Worker as a standalone public authentication service.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
# With the development server running and the local migration applied:
npm.cmd run test:flow
```

The 28 academic tests cover eligibility, all-of prerequisites, chains, failed grades, progress, unit limits, offerings, corequisites, invalid plans, CSV/JSON errors, forecast delays, simulation isolation, invalid concurrent chains, saved-plan projections, profile validation, and future retakes. The HTTP flow checks sign-in, import, mark/save, reload, planning, scenario isolation, stale revision rejection, invalid input, conflicting plan rejection, retained grade-induced conflicts, profile persistence, cross-origin rejection, and server-rendered workspace output. It restores an existing local record; on a fresh database it leaves the test fixture. Run it against the local development profile only.

Lint targets application-owned code; the generated shadcn catalog is retained unchanged. The optional WebMCP read tool requires a browser exposing `document.modelContext`.

## Student flow

1. Sign in and import a CSV/JSON curriculum, or choose the clearly labeled sample.
2. Review/edit names, units, year/semester, prerequisites, corequisites, and offerings. Mark completed, current, remaining, or failed subjects.
3. Save the review. Dashboard statistics and the curriculum map derive from this saved record.
4. Set the first future term and unit limit. Explicitly choose whether to assume current subjects pass.
5. Generate a suggested plan or arrange subjects manually. Missing prerequisites, corequisites, duplicate enrollment, unavailable offerings, and excessive loads are shown; a conflicting draft plan cannot be saved from the planner.
6. Explore fail, pass, delay, move, add, or remove scenarios. Simulator state never calls the save API. A failed future attempt postpones its retake; removing a planned subject defers it without waiving its required units.
7. Set your preferred name, academic program, and curriculum edition in Profile / Settings.

A new curriculum replaces the previous curriculum, statuses, and plan only when its review is saved. Both the planner and API reject new conflicting plan/settings edits. Grade or curriculum updates may make an unchanged existing plan invalid; those warnings remain visible rather than silently discarding the real record change.

## Import format

Download `public/curriculum-template.csv` from the upload screen. Required columns:

`code,name,units,year,semester`

Optional columns:

`prerequisites,corequisites,offered`

Use semicolons between requirement codes and between offered semesters. Codes are case-insensitive and normalized to uppercase. CSV supports quoted fields, escaped quotes, CRLF, and UTF-8 BOMs. JSON accepts:

```json
{
  "name": "My degree",
  "subjects": [
    {"code":"CS101","name":"Programming","units":3,"year":1,"semester":1,"prerequisites":[],"corequisites":[],"offered":[1,2]},
    {"code":"CS102","name":"Advanced Programming","units":3,"year":1,"semester":2,"prerequisites":["CS101"],"corequisites":[],"offered":[2]}
  ]
}
```

Limits: 1 MB, 300 subjects, year levels 1–8, semesters 1–2, 0–30 units per subject. Missing requirement references, duplicate codes, self requirements, and prerequisite cycles are rejected. A missing offered field means the listed semester only. PDF/image/Word parsing is deliberately unsupported; transcribe these into the template.

## Model and academic rules

- **Student**: server-authenticated user ID and display name.
- **Curriculum**: name, optional program and curriculum year, source (`sample` or `imported`), subjects.
- **Profile**: optional preferred student name, stored in the same validated record.
- **Subject**: unique code, name, units, recommended year/semester, offered semesters.
- **Relationships**: prerequisite and corequisite code arrays validated against the curriculum.
- **Academic record**: per-subject status; omitted status means remaining.
- **Semester plan**: zero-based future-term offsets and subject codes.
- **Settings**: first future academic year/semester, unit cap, current-pass assumption.

`student_records` stores each student's validated document atomically, plus revision and update time. This compact document model avoids partially replacing a curriculum without its statuses/plan. Queries use prepared statements and the authenticated primary key. Revision checks reject stale writes. No academic data is persisted in browser storage.

Prerequisites require **completed** status. Current subjects never affect eligibility today. Future projections can assume they pass only through the explicit setting. Corequisites must be completed or concurrently planned. Recommended year level is informational; actual term offerings constrain scheduling. Academic years have two regular semesters.

`lib/academic.ts` owns eligibility, summaries, chains, plan validation, term labels, forecasting, and simulation. `lib/import.ts` owns file and API validation. UI pages reuse these functions.

The profile and curriculum context fields are optional additions to the existing JSON record. Existing records remain compatible; no new database migration is required.

## Migrations and deployment

Schema: `db/schema.ts`. To extend it, run `npm.cmd run db:generate`, inspect the generated migration, then `npm.cmd run db:migrate` locally. Retain applied migrations and metadata. Sites applies packaged migrations to its production D1 database during deployment. Local and hosted databases are separate.

`.openai/hosting.json` identifies the private Sites project and the logical D1 binding. No production credentials are stored in this repository.

## Scope and limitations

- Two-semester calendars only; no summer terms, irregular offering dates, section capacity, grade thresholds, alternative/OR prerequisites, residency rules, or institutional overrides.
- The automatic scheduler is a deterministic heuristic with a 24-term horizon, not an optimal graduation guarantee. It assumes future passes and repeats reviewed semester offerings annually.
- Dashboard and simulator projections retain valid saved placements and fill remaining terms with the automatic scheduler. Invalid saved plans suppress graduation estimates until resolved.
- Simulation compares one change at a time and is never saved. It does not change the real grade record or existing plan.
- Local authentication is a development identity; production accounts require Sites/ChatGPT sign-in.
- CSV/JSON parsing is real. Unstructured document OCR is not implemented.
- Browser verification covered desktop dashboard/map/planner/simulator, subject details, status editing with saved recalculation, disabled invalid-plan saving, a 390px mobile viewport with no horizontal overflow, and mobile navigation. The original local fixture status was restored after the check.

