# J2W AI Test Factory

A client-demo-ready POC: AI-driven end-to-end test automation for a steel and recycling application
landscape. There is no backend. The plant, the nine systems and every message between them are
simulated in the browser, so the failures you see on screen are produced by the simulation rather
than hard-coded.

All data is mock data. No real company, person, location or in-house system name appears anywhere.

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
| `npm run selftest` | Proves the simulation: all faults off → all nine checks pass |
| `npm run smoke` | Renders all 31 pages headlessly and fails if any throws |
| `npm run verify` | typecheck → selftest → smoke → build |

## The 15-minute demo path

1. **Command Centre** — the confidence score, how it is calculated, and workflow health stage by stage.
2. **Process Ontology** — how a workflow is modelled, then the Ontology graph and the 11 AI agents.
3. **Live Data Flow** — press *Run the plant*. Dots are real messages moving between systems. Click one
   for its payload.
4. **Live Checks** — open C1. Three trucks disagree between the weighbridge and SAP. Press
   **Raise finding**, then **Fix the cause and replay** and watch the check turn green.
5. **Trace** — paste a failing gate pass and follow it through every system, record by record.
6. **Run Centre** — *Run the P1 demo now*. One step self-heals, one negative step is blocked as
   expected, one data check fails and raises F-001. End with the evidence pack.
7. **Interface Testing** — open IF-01 and compare a damaged message field by field.
8. **Change & Regression** — CH-204, then *Run regression* to compare before and after.
9. **Impact Simulator as Plant Head** — switch role in the header; the menu and the landing page change.
10. **Release & Close** — the GO / CONDITIONAL / NO-GO gate and the freeze calendar.

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
  sim/        engine.ts the plant · checks.ts the nine rules · trace.ts follow one load
  data/       systems, interfaces, processes, scenarios, findings, changes, SoD, requirements
  lib/        cn, formatting, score, theme tokens
```

### The simulation

`src/sim/engine.ts` runs an event queue on a seeded random generator (mulberry32), so every replay is
identical. Simulated time runs from 06:00 on 14 Oct 2026 and the engine pre-runs eight hours on reset,
which is why the first screen is already full of data.

Three business flows produce records: a steel truck (gate → weighbridge → goods receipt → invoice →
payment), a recycling load (gate → sortation → chemistry → stock) and a mill heat (confirmation and
certificate). Everything that crosses a system boundary becomes a message with a payload, a travel time
and a status, which is what the moving dots on the map are.

Eight **fault switches** are on by default and each one damages the data for real — a kilogram sent as a
tonne, a stale tare, a gateway retry, a lost message, a renamed chemistry field, a wrong unit, a missing
purchase order, a late mill file. Nine **live checks** compare the systems and explain each failing row in
plain language.

```
$ npm run selftest
ALL FAULTS ON   2 of 9 checks pass · 538 records compared · 51 disagree
ALL FAULTS OFF  9 of 9 checks pass · 542 records compared ·  0 disagree
```

### Adding things

- **A nav item**: one entry in `src/app/nav.config.ts` plus a route in `src/app/routes.tsx`. The sidebar,
  breadcrumb, command palette and role guard pick it up automatically.
- **A theme token**: add it to both blocks in `src/index.css` and to `tailwind.config.js`.
- **A live check**: add a definition to `CHECK_DEFS` and a case to `runCheck` in `src/sim/checks.ts`.
- **A fault**: add it to `FAULTS` in `src/sim/engine.ts` and call `this.fault('F9')` where it should bite.

---

J2W · POC – mock data for demonstration
