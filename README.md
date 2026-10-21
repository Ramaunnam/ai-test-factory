# J2W AI Test Factory

A client-demo-ready POC: AI-driven end-to-end test automation for a steel and recycling application
landscape. There is no backend. The plant, the ten systems, the four outside finance services and
every message between them are simulated in the browser, so the failures you see on screen are
produced by the simulation rather than hard-coded.

All data is mock data. No real company, person or location name appears anywhere.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (Vite picks the next free port if that one is busy)
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Type-checks and builds to `dist/` (static, works from any host) |
| `npm run preview` | Serves the built app |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run selftest` | Proves the simulation: all faults off → every check passes |
| `npm run smoke` | Renders all 45 views headlessly and fails if any throws |
| `npm run verify` | typecheck → selftest → smoke → build |

## The 15-minute demo path

1. **Testing Journey** — the whole process as eight steps, each one saying what goes in, what the AI
   does, what comes out, which client requirement it covers, and opening the screen that proves it.
2. **Command Centre** — the confidence score, how it is calculated, and **What to do next**: the four
   actions ranked by the points each would add to the score. The **Projects** card shows the three
   change projects running at once and the next three runs the factory will start on its own.
3. **Process Discovery** — *Inputs*, then the **Process map**: press a box, say *Not right*, give the
   reason, press **Apply feedback** and watch the map redraw as version 2.
4. **Process Ontology** — how a workflow is modelled, then the Ontology graph and the 11 AI agents.
5. **Live Data Flow** — press *Run the plant*. Dots are real messages moving between systems. Click one
   for its payload.
6. **Live Checks** — open C1. Three trucks disagree between the weighbridge and SAP. Press
   **Raise finding**, then **Fix the cause and replay** and watch the check turn green.
7. **Trace** — paste a failing gate pass and follow it through every system, record by record.
8. **Run Centre** — *Run the P1 demo now*. One step self-heals, one negative step is blocked as
   expected, one data check fails and raises F-001. End with the evidence pack.
9. **Run Centre → Schedules** — five schedules, *Run now* on one, and the report lands with a link.
10. **Interface Testing** — filter to financial API traffic, then open IF-01 and compare a damaged
    message field by field.
11. **Change & Regression** — CH-204, then *Run regression* to compare before and after.
12. **Month-End Load** — run the 5x profile. The interface-by-interface table names the one that
    bends first (invoice capture, saturating at 3x) and ties it to the two invoices lost at the
    cut-off.
13. **Impact Simulator as Plant Head** — switch role in the header; the menu and the landing page change.
    The verdict carries a number: the confidence score today against the score if the release shipped.
14. **Release & Close** — the gate decision with its **six computed exit criteria**, so anyone can ask
    "what turns this into GO?" and get an answer, plus the close calendar and the sign-off state.

Press <kbd>Ctrl</kbd>+<kbd>K</kbd> at any point: the command palette reaches every page, system,
interface, scenario, finding and simulation command.

## Navigation

| Key | Action |
|---|---|
| `Ctrl K` | Command palette |
| `?` | Shortcut list |
| `\` | Collapse or expand the sidebar |
| `[` `]` | Previous and next tab |
| `Shift D` | Light → dark → follow the system |
| `g` then `h f c t r i o a` | Jump to Health, Flow, Checks, Trace, Run, Interfaces, Ontology, Approvals |
| `Space` | Run or pause the plant (on Live Data Flow) |
| `Esc` | Close the top-most panel |

Every tab is its own route, so deep links, bookmarks and the browser back button all work. Roles
(Key User, QA Lead, Plant Head, Auditor) change which menu items exist and where the app lands; opening
a hidden page by URL shows a friendly panel rather than a blank screen.

## Theme

Light, dark and *follow the system*, chosen in the header or with `Shift D`, remembered in
`localStorage` and applied before first paint, so a reload never flashes white. Every colour is a CSS
variable defined twice in `src/index.css` (`:root` and `.dark`), mapped into Tailwind in
`tailwind.config.js`. Charts and SVG maps read those variables through `useThemeTokens()`, so they
re-colour instantly on a theme switch. Printing forces the light tokens and hides the shell.

## How it is put together

```
src/
  app/        shell, sidebar, header, tab bar, command palette, routes
              nav.config.ts is the single source of truth for the whole menu
  providers/  theme, role, toast, drawer
  components/ ui/ primitives · charts/ theme-aware recharts · domain/ map, workflow, trace
  pages/      one file per nav item, exporting one component per tab
  sim/        engine.ts the plant · checks.ts the fourteen rules · trace.ts follow one load
  data/       systems, interfaces, processes, scenarios, findings, changes, SoD, requirements
  lib/        cn, formatting, score, theme tokens
```

### Every number says where it came from

Most cards carry a provenance strip: `from yard.weighbridge_ticket 74 → compares net against SAP → into
Confidence score`. Every part of it is a link, and **How this works** opens a panel with the flow drawn
out, the steps in order, and the newest five live rows from the source table. It is one component
(`components/domain/SourceNote.tsx`) fed by `lib/live.ts`, so the answer to "where does this come from"
is the same on every page.

### The simulation

`src/sim/engine.ts` runs an event queue on a seeded random generator (mulberry32), so every replay is
identical. Simulated time runs from 06:00 on 14 Oct 2026 and the engine pre-runs eight hours on reset,
which is why the first screen is already full of data.

Three business flows produce records: a steel truck (gate → weighbridge → goods receipt → VAT and
sanctions checks → invoice → payment → bank acknowledgement), a recycling load (gate → sortation →
chemistry → stock → quality order → yard transfer) and a mill heat (confirmation and certificate).
The exchange-rate file loads once a day at 06:00. Everything that crosses a system boundary becomes a message with a payload, a travel time
and a status, which is what the moving dots on the map are.

Ten **fault switches** are on by default and each one damages the data for real — a kilogram sent as a
tonne, a stale tare, a gateway retry, a lost message, a renamed chemistry field, tonnes never converted
to kilograms, a missing purchase order, a late mill file, a sanctions list that was not refreshed and a
day with no exchange rate. Fourteen **live checks** compare the systems and explain each failing row in
plain language.

```
$ npm run selftest
ALL FAULTS ON    4 of 14 checks pass · 881 records compared · 80 disagree
ALL FAULTS OFF  14 of 14 checks pass · 892 records compared ·  0 disagree
```

### Adding things

- **A nav item**: one entry in `src/app/nav.config.ts` plus a route in `src/app/routes.tsx`. The sidebar,
  breadcrumb, command palette and role guard pick it up automatically.
- **A theme token**: add it to both blocks in `src/index.css` and to `tailwind.config.js`.
- **A live check**: add a definition to `CHECK_DEFS` and a case to `runCheck` in `src/sim/checks.ts`.
- **A fault**: add it to `FAULTS` in `src/sim/engine.ts` and call `this.fault('F11')` where it should bite.

---

J2W · POC – mock data for demonstration
