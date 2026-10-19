# J2W AI Test Factory — end-to-end guide

Everything this application is, how it works inside, and where every number on every screen
comes from.

- **What it is**: a client-demo POC of AI-driven end-to-end test automation for a steel and
  recycling application landscape.
- **Size**: 55 TypeScript files, about 15 100 lines, 7 runtime dependencies.
- **Backend**: none. A simulated plant runs in the browser and produces all the live data.
- **Naming**: every company, person, location and in-house system name is generic. Nothing in
  this repository identifies a real client.

---

## Table of contents

1. [The idea in one page](#1-the-idea-in-one-page)
2. [Running and verifying it](#2-running-and-verifying-it)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [The simulated plant](#4-the-simulated-plant)
5. [The data model](#5-the-data-model)
6. [The fourteen live checks](#6-the-fourteen-live-checks)
7. [Trace: following one load](#7-trace-following-one-load)
8. [The confidence score](#8-the-confidence-score)
9. [Navigation and the app shell](#9-navigation-and-the-app-shell)
10. [Theming](#10-theming)
11. [Provenance: where every number comes from](#11-provenance-where-every-number-comes-from)
12. [Page by page](#12-page-by-page)
13. [What is live and what is fixture](#13-what-is-live-and-what-is-fixture)
14. [Verification](#14-verification)
15. [Extending it](#15-extending-it)
16. [Known limits](#16-known-limits)

---

## 1. The idea in one page

A steel and recycling group runs ten systems — a yard app, a scrap yard app, a laboratory app, a
mill execution system, two SAP S/4HANA instances, D365, Esker, Lasernet and Reval — plus four
outside finance services: VAT validation, sanctions screening, an eBanking gateway and an
exchange-rate service. Nineteen interfaces move data between them. Nobody can answer the question a board actually asks:

> *Can we trust this landscape enough to release on Friday and close the month on time?*

The factory answers it in one number, and then lets you walk all the way down from that number to
a single truck that was weighed wrong at 09:42.

It does that in four moves:

The whole thing is laid out as eight steps on the **Testing Journey** (`/journey`), which is the
page to open first in a demo: each step says what goes in, what the AI does, what comes out, who
checks it, which of the client's requirements it covers, and opens the screen where it really
happens.

| Move | What happens | Where |
|---|---|---|
| **Learn** | Watch people work, read the system log, read the procedures, and write down the process | Process Discovery → Process Ontology |
| **Build** | Turn each stage and its rule into positive, negative and regression scenarios, plus the test data they need | Test Studio |
| **Run** | Execute the scenarios, watch every interface, compare every record across systems | Run Centre · Live Data Flow · Interface Testing |
| **Govern** | Score it, gate the release, prove segregation of duty, lock the evidence | Command Centre · Release & Close · Roles & SoD · Evidence |

The demo's credibility rests on one thing: **the failures are not written into the data**. A
simulated plant produces records, ten fault switches damage some of them in transit, and fourteen
checks then find the damage by comparing systems. Turn the faults off and replay, and every check
goes green. That is provable from the command line in four seconds (`npm run selftest`).

---

## 2. Running and verifying it

```bash
npm install
npm run dev        # http://localhost:5173, or the next free port
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then build static output into `dist/` |
| `npm run preview` | Serve the built output |
| `npm run typecheck` | `tsc --noEmit`, strict, no unused locals or parameters |
| `npm run selftest` | Runs the plant headlessly and proves the fault/check invariant |
| `npm run smoke` | Renders all 45 views in jsdom and fails if any throws |
| `npm run verify` | typecheck → selftest → smoke → build, in that order |

The build is fully static (`base: './'`, `HashRouter`), so `dist/` can be opened from any web
server, an S3 bucket, or a shared drive.

---

## 3. Architecture at a glance

```
                         ┌─────────────────────────────────────────┐
  src/sim/               │  SimEngine (engine.ts)                  │
  the plant              │   seeded RNG → event queue → 22 tables  │
                         │   + messages in flight + event log      │
                         └───────────────┬─────────────────────────┘
                                         │ useSyncExternalStore
                         ┌───────────────▼─────────────────────────┐
  src/sim/checks.ts      │  9 live checks   ·   trace(key)         │
  src/sim/trace.ts       │  compare systems ·   follow one load    │
                         └───────────────┬─────────────────────────┘
                                         │
  src/lib/               │  live.ts (counts) · interfaceStats.ts   │
  derived numbers        │  score.ts (confidence) · useThemeTokens │
                         └───────────────┬─────────────────────────┘
                                         │
  src/pages/             │  32 routes across 12 menu items         │
  src/app/               │  shell · nav.config · command palette   │
  src/components/        │  ui primitives · charts · domain        │
                         └─────────────────────────────────────────┘
```

Folder map:

```
src/
  app/          AppShell, Sidebar, Header, TabBar, CommandPalette, ShortcutsModal, routes
                nav.config.ts — the single source of truth for the whole menu
  providers/    ThemeProvider, RoleProvider, ToastProvider, DrawerProvider
  components/
    ui/         Button, Card, Badge, DataTable, Drawer, Modal, Gauge, LiveLog, … (one file)
    charts/     theme-aware recharts wrappers
    domain/     FlowMap, WorkflowFlow, TraceTimeline, SourceNote, RoleGuard, ErrorBoundary
  pages/        one file per nav item, one exported component per tab
  sim/          engine.ts · checks.ts · trace.ts · rng.ts · types.ts · useSim.ts · selftest.ts
  data/         systems, interfaces, processes, scenarios, findings, changes, SoD, requirements
                appStore.ts — the only mutable application state
  lib/          cn, format, score, live, interfaceStats, useConfidenceInput, useThemeTokens
```

**Two stores, deliberately separate.**

- `engine` (src/sim/engine.ts) owns the plant. It never imports React. The UI subscribes through
  `useSyncExternalStore`, so a component re-renders when the plant moves and not otherwise.
- `store` (src/data/appStore.ts) owns what the *user* changes: findings raised, approvals decided,
  scenarios approved, runs recorded, evidence packs locked, connections added. Same subscription
  pattern.

Nothing else holds state. There is no Redux, no Zustand, no query cache.

---

## 4. The simulated plant

`src/sim/engine.ts`, about 700 lines. It is an event-driven simulation, not a random number
generator behind a chart.

### 4.1 Time

Simulated time is **minutes since 06:00 on 14 October 2026**, held as a single number (`engine.now`).
`fmtSim(now)` renders `14 Oct 14:22`.

When running, a browser interval ticks every 200 ms and advances the clock by `speed × 0.2`
minutes, where speed is 1, 4, 10 or 30 simulated minutes per real second. At 4x — the default —
one real minute is about four simulated hours.

### 4.2 Determinism

All randomness comes from `mulberry32` seeded once per reset (`src/sim/rng.ts`). The same seed
always produces the same plant: the same trucks, the same weights, the same faults, in the same
order. That is what makes the demo repeatable and the selftest meaningful.

### 4.3 The event queue

```ts
private at(delay: number, run: () => void)   // schedule work `delay` minutes from now
private advance(minutes: number)             // pop and run everything due, then prune
```

`advance` pops due events in time order, sets `now` to each event's time before running it, and
stops at the target. A `reset(seed, warmupHours = 8)` runs eight simulated hours instantly, which
is why the first screen you ever see is already full of data.

### 4.4 The three business flows

**P1 — steel truck, gate to invoice** (about one every 4–9 minutes, at PL01 or PL03)

```
gate pass GP-PL01-2026-####  +  vehicle VH-####
  gross 30 000–44 000 kg, tare 12 000–16 500 kg, rounded to 20 kg
  net = gross − tare
  registered tare (vehicle master) = tare ± 860–1 240 kg   ← the stale-tare trap
        │
        │ IF-01, travel 2–6 min
        ▼
  SAP MSEG row: menge = whatever the message carried, meins = KG
        │
        │ 35–110 min later the supplier invoices the real net weight
        ▼
  Esker captured_invoice  ──IF-06, 3–8 min──►  SAP three-way match
        │                                        no PO        → Parked "No purchase order reference"
        │                                        no GR        → Parked "Goods receipt not found"
        │                                        |Δqty| > 1 %  → Parked "Quantity differs by X kg"
        │                                        otherwise    → Posted
        ▼
  Posted  ──IF-09, 2–5 min──►  Lasernet invoice copy
  Hourly payment run ──IF-11──►  Reval payment
```

**P2 — recycling load, scrap to stock** (one every 7–13 minutes, at YD02 or YD05, by wagon
`WGN-#####`, truck `VH-####` or container `CNU-#######`)

```
weighed  ──IF-02, 2–6 min──►  Scrap Yard receipt
        │
        │ 8–25 min later: sorted into 1–3 batches whose weights sum exactly to the receipt
        ▼
  scrap_batch (grades SCR-304-BALE, SCR-316L-SOLID, SCR-430-TURN, SCR-321-SHRED)
        ├── 10–30 min: lab sample ──IF-14, 2–6 min──► chemistry (Ni, Cr, Mo near the grade nominal)
        └──  5–15 min: ──IF-03, 2–5 min──► D365 stock_posting (qty, unit, warehouse RAW)
```

**P4 — mill heat** (one every 40–60 minutes)

```
heat HT-26-#####, 2–4 coils, 18 000–32 000 kg
  ──IF-04, 3–10 min normally──►  SAP AFRU confirmation (delay_min recorded)
  ──IF-10, 2–6 min──────────►  Lasernet mill certificate
```

### 4.5 Messages

Anything crossing a system boundary becomes a `Message`:

```ts
{ id, interfaceId, from, to, key, summary, payload,
  sentAt, arriveAt, status: 'in flight' | 'delivered' | 'lost' | 'duplicate', fault? }
```

`key` is the business reference (gate pass, heat, `payment-run`) and is what ties a message to the
records on both sides. The dots moving on the Live Flow map are these messages, positioned by
interpolating `(now − sentAt) / (arriveAt − sentAt)` along the interface's curve.

The engine also keeps an **event log** of plain-language lines
(`VH-7741 weighed: gross 38 420 kg, tare 13 560 kg, net 24 860 kg`), each tagged with its key, so
clicking a line can open the trace. Process Discovery reads this same log as its "plant log" input.

### 4.6 The ten fault switches

All on by default. Each one changes the data for real — nothing is cosmetic.

| # | Fault | Interface | Rate | What it actually does |
|---|---|---|---|---|
| F1 | Kilogram / tonne mix-up | IF-01 | 8 % | Sends `net / 1000` still labelled KG, so SAP books 21.92 KG instead of 21 920 kg |
| F2 | Stale tare | IF-01 | 7 % | Uses the vehicle master's registered tare instead of the tare just weighed |
| F3 | Gateway retry duplicate | IF-01 | 5 % | Delivers the same ticket twice, 1–3 min apart, creating two MSEG rows |
| F4 | Lost message | IF-02 | 6 % | The recycling receipt never arrives; nothing is written |
| F5 | Molybdenum renamed | IF-14 | 20 % | `mo_pct` arrives empty, so the grade cannot be certified |
| F6 | Tonnes not converted to kilograms | IF-03, IF-19 | 7 % | The × 1000 step is skipped, so stock and transfers are 1 000 times wrong |
| F7 | No purchase order | IF-06 | 6 % | Esker capture carries no PO, so the match parks it |
| F8 | Late mill file | IF-04 | 25 % | Confirmation takes 25–45 min instead of 3–10 |
| F9 | Sanctions list not refreshed | IF-16 | 3 % | The vendor is screened against yesterday's list before the invoice is booked |
| F10 | Exchange rate missing | IF-18 | 10 % of days | No rate file arrives, so foreign-currency invoices use the day before's rate |

F1 and F2 are mutually exclusive on a single message (a ticket is either divided or stale, not
both), which is why C1 can always name one specific cause.

### 4.7 Retention and performance

Only the last 24 simulated hours are kept. On every `advance`, rows older than that are pruned
from the tables and from the message list (the daily exchange rates are capped by row count
instead, because an invoice booked just before midnight still needs the rate of its own day), so a demo left running for an hour stays fast. The
event log keeps 400 lines, the message list 600.

### 4.8 The engine API

```ts
engine.start() / stop() / toggle()
engine.setSpeed(1 | 4 | 10 | 30)
engine.addTruck() / addWagon()      // force an arrival now
engine.fastForward(60)              // skip an hour
engine.reset(seed, warmupHours = 8) // replay from a clean start
engine.setFault(id, on) / setAllFaults(on)
engine.fixAndReplay(['F1','F2'])    // turn those off, then reset and replay
engine.subscribe(fn) / getVersion()  // for useSyncExternalStore
```

---

## 5. The data model

Twenty-two tables across thirteen simulated systems: the nine applications, plus the four outside
finance services. SAP Service Centre is on the map for landscape completeness and carries no live
traffic.

| System | Tables | Key columns |
|---|---|---|
| Yard Management | `gate_pass` | gate_pass, site, vehicle, transport, vendor, po, process, arrived |
| | `weighbridge_ticket` | ticket, gate_pass, vehicle, gross_kg, tare_kg, net_kg, registered_tare_kg, weighed |
| SAP S/4HANA – Steel | `EKPO` | ebeln, vendor, material, price_eur_t, open_qty_kg |
| | `MSEG` | mblnr, **xblnr = gate_pass**, ebeln, menge, meins, posted |
| | `RBKP` | belnr, ext_invoice, gate_pass, ebeln, qty_kg, amount_eur, status, reason, currency, fx_rate_used, posted |
| | `AFRU` | rueck, heat, coils, weight_kg, delay_min, received |
| Esker | `captured_invoice` | doc, ext_invoice, gate_pass, po, qty_kg, amount_eur, captured |
| Lasernet | `output_document` | doc, type, **ref** (belnr or heat), created |
| Scrap Yard Operations | `receipt` | receipt, gate_pass, vehicle, site, weight_kg, received |
| | `scrap_batch` | batch, receipt, grade, weight_kg, created |
| | `chemistry` | sample, batch, ni_pct, cr_pct, mo_pct, tested |
| | `transfer` | transfer, batch, from_site, to_site, weight_kg, received_kg, unit, sent, received |
| Laboratory app | `lab_result` | sample, batch, grade, status, tested |
| D365 F&O – Recycling | `stock_posting` | journal, batch, item, qty, unit, warehouse, posted |
| | `issue` | issue, batch, qty_kg, unit, issued |
| | `quality_order` | order, batch, grade, ni_pct, cr_pct, mo_pct, result, created |
| Mill Execution System | `heat` | heat, coils, weight_kg, started |
| Reval | `payment` | pay, belnr, vendor, amount_eur, run_at |
| VAT validation service | `vat_check` | check, belnr, vendor, vat_number, valid, checked |
| Sanctions screening service | `sanctions_screen` | screen, belnr, vendor, list_day, list_date, hit, screened |
| eBanking gateway | `bank_ack` | ack, pay_run, invoices, amount_eur, status, acked |
| Exchange-rate service | `fx_rate` | day, date, pair, rate, loaded |

**The join keys are the whole point.** This is how one truck is followed across nine systems:

```
gate_pass ─┬─ weighbridge_ticket.gate_pass
           ├─ MSEG.xblnr
           ├─ captured_invoice.gate_pass ── RBKP.ext_invoice
           │                                  └─ output_document.ref = RBKP.belnr
           │                                  └─ payment.belnr
           └─ receipt.gate_pass ── scrap_batch.receipt ─┬─ chemistry.batch
                                                        ├─ lab_result.batch
                                                        └─ stock_posting.batch
heat ──┬─ AFRU.heat
       └─ output_document.ref
```

### The nineteen interfaces

| Id | Carries | From → to | Live |
|---|---|---|---|
| IF-01 | Weighbridge ticket | Yard → SAP Steel | ● |
| IF-02 | Recycling receipt | Yard → Scrap Yard | ● |
| IF-03 | Stock posting | Scrap Yard → D365 | ● |
| IF-04 | Production confirmation | Mill → SAP Steel | ● |
| IF-05 | Delivery note | SAP Steel → Lasernet | ○ |
| IF-06 | Captured invoice | Esker → SAP Steel | ● |
| IF-07 | Stock transfer | SAP Steel → SAP Service Centre | ○ |
| IF-08 | Inventory sync | D365 → SAP Steel | ○ |
| IF-09 | Invoice copy | SAP Steel → Lasernet | ● |
| IF-10 | Mill certificate | Mill → Lasernet | ● |
| IF-11 | Payment file | SAP Steel → Reval | ● |
| IF-12 | Charge plan | Yard → Mill | ○ |
| IF-13 | Recycling documents | D365 → Lasernet | ● |
| IF-14 | Chemistry result | Laboratory → Scrap Yard | ● |
| IF-15 | VAT validation | SAP Steel → VAT service | ● |
| IF-16 | Sanctions screening | SAP Steel → Sanctions service | ● |
| IF-17 | Payment instruction | SAP Steel → eBanking gateway | ● |
| IF-18 | Exchange rates | Exchange-rate service → SAP Steel | ● |
| IF-19 | Stock transfer | Scrap Yard → D365 | ● |

Fifteen carry live traffic; the four marked ○ exist so the landscape is complete and are drawn
dashed on the map. Screens that measure agreement count only the live ones rather than counting
the quiet ones as healthy.

---

## 6. The fourteen live checks

`src/sim/checks.ts`. Each check is one business rule, a readable SQL string, a set of columns, and
a `run()` that joins the live tables with `Map` indexes and returns failing rows **with a
plain-language cause**.

| Id | Rule | Compares | Broken by |
|---|---|---|---|
| C1 | Weighbridge net equals the goods receipt quantity, within 20 kg | `weighbridge_ticket` ↔ `MSEG` | F1, F2 |
| C2 | Exactly one goods receipt per truck | `gate_pass` ↔ `MSEG` | F3 |
| C3 | Every recycling load reached the scrap yard | `gate_pass` ↔ `receipt` | F4 |
| C4 | Batch weights add up to the receipt | `receipt` ↔ `scrap_batch` | — |
| C5 | Chemistry complete (Ni, Cr, Mo) for every batch | `scrap_batch` ↔ `chemistry` | F5 |
| C6 | Stock in kilograms matches the tonnes received | `scrap_batch` ↔ `stock_posting` | F6 |
| C6b | Issued kilograms never exceed stock | `stock_posting` ↔ `issue` | F6 |
| C7 | Invoices pass the three-way match | `RBKP` | F1, F2, F7 |
| C8 | Every booking has its document in Lasernet | `RBKP`, `stock_posting` ↔ `output_document` | — |
| C9 | Mill confirmations arrive within 15 minutes | `heat` ↔ `AFRU` | F8 |
| C10 | Every vendor paid was screened against today's sanctions list | `RBKP` ↔ `sanctions_screen` | F9 |
| C11 | Every foreign-currency invoice used that day's exchange rate | `RBKP` ↔ `fx_rate` | F10 |
| C12 | Transfers arrive with the same weight | `transfer` | F6 |
| C13 | Every tested batch has a quality order with the right result | `chemistry` ↔ `quality_order` | F5 |

**Settle times matter.** A check must never fail because a message has not landed yet, so each one
ignores records younger than a settle window: 10–12 minutes for the gate interfaces, 15–20 for the
compliance and transfer checks, 25–50 for sortation and chemistry, 55 for mill confirmations. Those
windows are above the maximum travel time of the relevant interface, including when the late-file
fault is on.

**Causes are derived, not guessed.** C1 decides between the two possible causes arithmetically:

```
if |menge × 1000 − net_kg| ≤ 20      → "Unit mix-up: 21.92 was sent as KG but is really tonnes"
else if |Δ − |tare − registered|| ≤ 20 → "Stale tare: the message used the registered tare …"
else                                  → the generic difference
```

C4 and C8 have no fault wired to them, and C10 and C11 are rare by design (3 % of screenings,
10 % of days), so with every fault on the honest result is usually **4 or 5 of 14 checks pass**.
With every fault off it is always **14 of 14**, and `npm run selftest` fails the build if it is
not.

---

## 7. Trace: following one load

`src/sim/trace.ts` takes anything a user might paste and resolves it to a gate pass or a heat:

| Input | Resolution |
|---|---|
| `VH-####`, `WGN-#####`, `CNU-#######` | the vehicle's **latest** visit |
| `GP-…` | the gate pass itself |
| `BT-…` | batch → receipt → gate pass |
| `RC-…` | receipt → gate pass |
| `LAB-…` | sample → batch → receipt → gate pass |
| `INV-…`, `51…`, `50…` | invoice or material document → gate pass |
| `HT-26-…` | the heat (its own chain) |

It then walks the join keys, returns the records in time order with **flagged fields** (wrong MSEG
quantity, empty Mo, unit not KG, Parked status, missing PO), interleaves the messages that carried
them, and produces a one-sentence verdict:

> *"SAP booked 17.38 KG instead of 17 380 kg, and 1 more problem."*

---

## 8. The confidence score

`src/lib/score.ts`. Deterministic: the same inputs always give the same number, and every input is
measured, never typed.

| Weight | Input | How it is measured |
|---|---|---|
| 35 % | Data agreement across systems | `(compared − disagree) / compared` over all nine checks — **record level**, not check level |
| 30 % | Scenario results | passed / total in the most recent run |
| 20 % | Interface messages intact | messages that arrived undamaged / messages sent — **message level** |
| 15 % | Open findings | `max(10, 100 − 15×critical − 6×high − 2×medium − 1×low)` |

Then: **if any critical finding is open, the result is capped at 79.** A landscape with a known
critical defect can never look healthy, however good the other numbers are.

Worked example, with every fault on:

```
  91 × 35 %   487 of 538 records compared agree (2 of 9 checks fully green)
  80 × 30 %   24 of 30 scenarios passed in RUN-1042
  90 × 20 %   413 of 461 messages arrived undamaged
  16 × 15 %   13 open: 3 critical, 5 high, 5 other
  ─────────
  76          raw 76, no cap applied
```

Turn every fault off and replay: data 100, interfaces 100 → raw **81**, capped to **79** because
three critical findings are still open. Closing them is what lifts it past 79, which is exactly the
behaviour the release gate depends on.

**Why record level.** Scoring "2 of 9 checks green" gave 22 and a total of 37, which reads as a
broken product. One failing rule across 500 clean records is a problem worth seeing, not grounds to
distrust the whole landscape. The record-level number is both higher and more defensible.

The Command Centre's **What to do next** list uses the same function: for each candidate action it
recomputes the score with that one input repaired and shows the difference as `+N`.

---

## 9. Navigation and the app shell

### 9.1 One source of truth

`src/app/nav.config.ts` defines 12 items in 4 groups. The sidebar, the breadcrumb, the tab bars,
the command palette, the role guard and the document title are all derived from it. Adding a menu
item is one object plus one `<Route>`.

```
OVERVIEW   Command Centre   /  · /release · /load · /simulator
           Enterprise Map   /landscape
           Process Ontology /ontology · /ontology/objects · /ontology/agents · /coverage
BUILD      Process Discovery /discovery
           Test Studio      /studio · /test-data
RUN        Live Data Flow   /flow · /flow/data · /flow/checks · /flow/trace
           Run Centre       /run · /evidence
           Interface Testing /interfaces
           Change & Regression /regression · /self-healing · /reconciliation
GOVERN     Approvals        /approvals          (Key User only)
           Roles & SoD      /access-sod
           Connected Systems /systems           (Key User only)
```

Plus four print-ready pages outside the shell — `/finding/:id`, `/report/:runId`,
`/release-report/:id`, `/evidence-pack/:runId` — a hidden `/kitchen-sink`, and a designed 404.
**Every tab is its own route**, so deep links, bookmarks, the back button and ⌘-click all work.

### 9.2 Roles

No login. The app opens as Key User.

| Role | Sees | Lands on |
|---|---|---|
| Key User | everything | Command Centre |
| QA Lead | build and run, no governance | Run Centre |
| Plant Head | read-only business view | Impact Simulator |
| Auditor | evidence and access, read only | Evidence & Reports |

Hidden pages are removed from the menu, not greyed out. Opening one by URL shows a panel that
explains why it is not in that view and offers to switch. Read-only roles can press Run buttons and
get a toast explaining the restriction — better than a dead control.

### 9.3 Keyboard and the command palette

| Key | Action |
|---|---|
| `Ctrl K` | Command palette |
| `?` | Shortcut list |
| `\` | Collapse or expand the sidebar |
| `[` `]` | Previous and next tab |
| `Shift D` | Light → dark → follow the system |
| `g` then `h f c t r i o a` | Health, Flow, Checks, Trace, Run, Interfaces, Ontology, Approvals |
| `Space` | Run or pause the plant (on Live Data Flow) |
| `Esc` | Close the top-most overlay |

The palette is fuzzy-ranked across pages, tabs, systems, interfaces, all 30 scenarios, open
findings, processes **and commands** — "Truck arrives now", "All faults off", "Switch role to Plant
Head", "Toggle the theme". Recent choices persist in `localStorage`.

### 9.4 Shell behaviour

The header carries the change-project selector, the role selector, a currency selector (EUR · USD ·
INR at illustrative rates, kept for the session; money is stored in euro and only the display
converts) and the light/dark toggle.

The main area is the only scroll container. Navigation resets it to the top; going back restores
the previous offset from a per-location map. Pages are lazy-loaded with a skeleton that matches the
layout. An `ErrorBoundary` wraps everything, so a crash shows a panel with the message and a *Try
again* button rather than a blank page.

> **Provider order matters.** `HashRouter` is the outermost provider. Drawers, toasts and modals are
> rendered by the providers, not by the page, and their content may navigate. With the router inside
> them, `useNavigate()` throws and React unmounts the whole tree. The smoke suite has a dedicated
> case that renders drawer content to prevent that regression.

---

## 10. Theming

Three modes: light, dark and **system**, chosen in the header or with `Shift D`, stored under
`j2w.theme`.

- **No flash.** A small blocking script in `index.html` reads `localStorage` and sets the `dark`
  class before first paint.
- **One token set, defined twice.** About 30 CSS custom properties on `:root`, redefined under
  `.dark`, mapped into Tailwind so components say `bg-surface` and never a hex.
- **Dark is designed, not inverted.** A deep steel navy, lighter and slightly desaturated accents,
  and elevation carried by borders rather than big black shadows.
- **Charts and SVG follow.** `useThemeTokens()` reads the computed variables and re-reads on theme
  change, so recharts, the flow map, the ontology graph and the gauges re-colour instantly.
- **Print** forces the light tokens, hides the shell and expands drawers, so the four report pages
  print cleanly from either theme.

---

## 11. Provenance: where every number comes from

Most cards carry a strip:

```
from  sap.mseg 77   yard.weighbridge_ticket 74  →  compares net weight against what SAP booked
                                                →  into  Confidence score       How this works
```

Every chip links to that table, filtered. **How this works** opens a panel with a drawn flow
(sources → computation → outputs), the steps in order, and **the newest five live rows from the
source table**. One component (`components/domain/SourceNote.tsx`) fed by `lib/live.ts`, used on
eleven pages, so the answer to "where does this come from" is identical everywhere.

---

## 12. Page by page

### Testing Journey (`/journey`)

The whole testing process as eight steps, in order: learn the process, confirm it with key users,
write the tests, make the test data, run them, check the data across systems, fix and re-test,
prove and release. Each step shows what goes in → what the AI does → what comes out, who checks
it, *today* against *with the factory*, the client requirements it covers (CORE-01…06 and
ADV-01…04, each chip opening the screen that proves it), and a button into the screen where that
step really happens. **Play the journey** walks all eight with a live log, and *Follow one truck
through the journey* pins a real vehicle from the running plant and shows where it is.

### Command Centre · Health (`/`)

The landing page, and the only one that has to work in the first ten seconds of a demo.

- **The plant, right now** — plant clock, vehicles this hour, records created this hour, messages
  delivered, in flight, damaged. Run/pause and *Send a truck* are here, so it is immediately
  obvious the data is live.
- **Confidence score** — the gauge plus all four contributing bars inline, with the full
  calculation in a drawer.
- **What to do next** — up to four ranked actions, each showing the points the score would gain.
- **Where the data is flowing** — records produced per system in the last hour, and the busiest
  interfaces with a clean/damaged badge.
- **Trend** — 30 days, ending on today's live score.
- **Month-end readiness** — 10 days against a 3-day target, naming the one blocker.
- **Workflow health** — all six processes with live volume, the checks covering them, open
  findings, and the stage strip.
- **Projects** — the three change projects running at once, each with its scenarios, open findings
  and schedules, plus **the next three runs** the factory will start on its own. Pressing one sets
  the project filter the whole app follows.
- **Findings** by severity with the top five listed, **requirements** with scenario counts, and the
  **run history**.

### Command Centre · Release & Close (`/release`)

Gate decision (GO / CONDITIONAL / NO-GO) derived from **six computed exit criteria**: no critical
finding, every live check agrees, regression green, evidence locked and signed, backlog zero at
month-end volume, and every payment screened and priced correctly (C10 and C11). Each states why it failed and links to the proof. Plus the close calendar with five
milestones, and a sign-off panel for the four roles.

### Command Centre · Month-End Load (`/load`)

Normal / 2x / 5x profiles against a per-interface capacity model. Charts carry target lines, and
the callout names the interface that **bends first** — IF-06 Captured invoice, saturating at 3x —
which ties directly to the two invoices still in flight at the cut-off (finding F-008). An
interface-by-interface table shows throughput, p95, errors, backlog and capacity used.

### Command Centre · Impact Simulator (`/simulator`)

Pick a release or individual changes, simulate, and get: a verdict, the **confidence score today
against the score if it shipped**, the systems changed and the systems downstream, the workflow
stages hit, and one card per change with what stops and a timed recommendation.

### Command Centre · Framework & Pod (`/offer`)

What is being offered, rather than what the tool does: the framework in five steps (Learn → Build
→ Run → Watch → Prove) with a **See it** button into the working screen for each, the pod roles,
**what we commit to** (targets to agree, with today's value read live where the factory already
measures it), **expected benefits** (illustrative before/after bars), how a pilot starts, and a
tool-demo-against-pod comparison.

### Enterprise Map (`/landscape`)

Ten systems and four outside finance services in three bands, nineteen interfaces, live record
counts, red borders where a check disagrees. A second view turns a plain-English rule into a query, runs it against live data and
shows the rows.

### Process Ontology (`/ontology`, `/ontology/objects`, `/ontology/agents`, `/coverage`)

The swim-lane table per stage: who, the three SOP steps, system, data, rule tested, AI agents,
tests, and the **live row count** for that stage's tables. **Business Objects** is the data model:
eighteen objects down the left, and for the selected one its grain, primary key, every property
with its meaning, source, type and status, a small graph of what it joins to, and where the data
comes from — system, table, interface, live rows now, refresh and the checks that guard it. One
large graph underneath shows all eighteen in four bands with the relation on every arrow.
Objects and fields that still need a key user to agree the mapping are marked **To confirm**.
The Agents tab lists the eleven agents (reads → produces → works on). Coverage maps the client's
CORE-01…06 and ADV-01…04 to the screens that prove them.

### Process Discovery (`/discovery`, `/discovery/map`, `/discovery/compare`)

Three tabs. **Inputs** is alive before anything is pressed:

- a clickable diagram of three inputs → the agent's four steps → a process map
- **the six recordings**, each with who recorded it, why it was requested, and what it showed, each
  opening its click-by-click trail
- the **plant log**, which is the live event stream from the running simulation
- the four SOPs in full

**Process map** draws the discovered process as boxes left to right, every arrow carrying the
number of cases that made that move in the last 24 hours, the clean path in green and the rework
loops curving back underneath in red with what they cost in a day. Pressing any box, arrow or loop
opens it and asks the key user whether it is right: **Correct**, **Not right** with a reason (wrong
order · missing step · not a real step · wrong system · other) or a comment. The feedback list below
shows every correction as Open, Applied or Dismissed; **Apply feedback** redraws the map as
version 2 and the scenario writer then says which version it worked from. A compare toggle puts
version 1 beside it with the corrections listed. The activities table and the rework loops live
here too.

**Procedure vs reality** turns the five written rules into queries and runs them against the live
plant, with the clean-versus-rework split underneath.

### Test Studio (`/studio`, `/test-data`, `/studio/master-data`, `/studio/record`)

Generate scenarios from the ontology and the failing checks; they arrive Pending approval. Each
scenario drawer shows business steps with the technical detail behind a toggle. Test Data generates
linked records and loads them into the test environment.

**Master Data Check** scans the master records behind the tests before they run: the vehicle master
is compared live against the last weighings on the weighbridge, and anything more than 500 kg out
is listed with the fix. Authored sample problems (a vendor with no VAT number, a closed purchase
order still receiving, a duplicate vendor, a material with no grade window) are marked *sample*.
Each row can have a **clean copy** prepared for the test environment or a **finding** raised.

**Record** watches a key user do the work once: every click is captured with the screen it touched,
including the pauses and the mis-clicks. **Turn into a test with AI** strips those out, swaps typed
values for test-data placeholders, adds the checks the rule needs, and writes a scenario that lands
in Scenarios as Pending approval.

### Live Data Flow (`/flow`, `/flow/data`, `/flow/checks`, `/flow/trace`)

The heart of the demo. The map with moving dots, the ten fault switches with hit counts, the
event feed, the raw tables per system, the fourteen checks with failing rows and causes — including
**Raise finding** and **Fix the cause and replay** — and Trace.

### Run Centre (`/run`, `/run/schedules`, `/evidence`)

A live run, step by step, with the workflow strip lighting up: one step self-heals, one negative
step is blocked as expected, one data check fails and raises F-001, and it ends CONDITIONAL with an
evidence pack. Every step keeps a drawn screenshot of the screen it touched and its own log lines,
both of which go into the evidence pack. Findings are filterable by severity and follow the project
filter. Evidence lists locked, hashed bundles.

**Schedules** is what makes it a factory rather than a demo: five seeded schedules (nightly at
02:00, after every SAP transport, after every D365 update, before the month-end close, weekly),
each with what it runs, its project, its last result, its next run and an on/off switch. **Run now**
starts a real run in the Run Centre, records the verdict against the schedule and sends the report
to the people named on it, with a link to the run. **New schedule** adds one.

### Interface Testing (`/interfaces`)

Totals (sent, received, matched, mismatched, missing, duplicated), the nineteen interfaces, and a
field-by-field comparison of any message with *Follow the truck*. A filter bar narrows everything
below it at once — the totals, the table, the records and *Follow the truck* — by search, source
system, target system, business process, status (matched · mismatched · missing · duplicated),
health, type (shop-floor · financial), format (IDoc · API · file), time window and *only live*.
Active filters show as removable chips with *Clear all*, and the whole filter state is kept in the
address bar so a filtered view can be shared as a link.

### Change & Regression (`/regression`, `/self-healing`, `/reconciliation`)

Change feed with risk dials, following the project chosen in the header; each change told as
*what changed → what could go wrong → what we do* plus a business line; where it lands in the workflows; regression before and after a baseline.
Self-healing shows before/after diffs with confidence and an approval. Reconciliation shows source
against target with differences explained.

### Govern (`/approvals`, `/access-sod`, `/systems`)

The approval queue with comments. The SoD conflict matrix, where **Prove it** actually attempts the
forbidden action and raises a finding with the evidence. Connected systems with test/sync and an
add-connection modal.

### Report pages

`/finding/:id`, `/report/:runId`, `/release-report/:id`, `/evidence-pack/:runId` — no shell, print
button, and they come out clean on paper from either theme.

---

## 13. What is live and what is fixture

Being straight about this in front of a client is worth more than pretending everything is real.

| Live — computed from the running simulation | Fixture — authored content |
|---|---|
| All 22 tables and every row in them | The 10 systems, 4 outside services, 19 interfaces and 6 processes |
| The fourteen checks, their rows and causes | The ~30 scenarios and their steps |
| Trace, end to end | The 6 changes, 7 healing events, 4 recon sets, SoD rules |
| Interface totals and field comparisons | The 16 seeded findings (new ones are real) |
| The confidence score and all four inputs | The six Discovery recordings and the four SOPs |
| The release exit criteria | The 30-day trend (except today's point, which is live) |
| Discovery's activity counts, arrow counts, procedure verdicts and rework cost | The month-end load capacity model |
| Record counts per system, interface and workflow | The six historic runs and the five seeded schedules |
| The vehicle-master drift found by the Master Data Check | The four sample master-data problems, marked *sample* |
| Today's values on Framework & Pod marked *live* | The illustrative before/after benefit bars |

The AI output — scenario generation, discovery, impact analysis, self-healing — is pre-written
content revealed through a live log. Every score and verdict is computed in code, never random.

---

## 14. Verification

Three gates, all runnable from the command line, all part of `npm run verify`.

**`npm run typecheck`** — strict TypeScript, no unused locals or parameters, no implicit `any`.

**`npm run selftest`** — runs the plant headlessly and prints both halves of the invariant:

```
ALL FAULTS ON     4 of 14 checks pass · 881 records compared · 80 disagree
ALL FAULTS OFF   14 of 14 checks pass · 892 records compared ·  0 disagree
```

It exits non-zero if the clean run is not perfect, or if the faulty run looks too healthy. This is
the proof that the failures come from the simulation rather than from fixtures.

**`npm run smoke`** — renders all 45 views in jsdom with the real providers and the real live data,
and fails if any throws. The last six render the states a visitor only reaches after pressing
something: the corrected process map, a chosen project, a filtered interface list. Case 1 renders drawer content specifically, to protect the provider order.

---

## 15. Extending it

| To add | Do this |
|---|---|
| A business object | One entry in `src/data/objects.ts`, plus its links. Business Objects picks it up. |
| A menu item | One object in `src/app/nav.config.ts` plus a `<Route>` in `src/app/routes.tsx`. Sidebar, breadcrumb, palette, role guard and title follow automatically. |
| A theme token | Add it to both blocks in `src/index.css` and to `tailwind.config.js`. |
| A live check | A definition in `CHECK_DEFS` and a case in `runCheck` (`src/sim/checks.ts`). It appears on Live Checks, in the score and in the release criteria with no other change. |
| A fault | An entry in `FAULTS` and a `this.fault('F11')` call where it should bite (`src/sim/engine.ts`). |
| A provenance strip | `<SourceNote reads={[…]} computes="…" feeds={[…]} steps={[…]} />` at the bottom of a card. |
| A real backend | Replace `src/sim/engine.ts` with a client that fills the same tables and message list, and keep `subscribe`/`getVersion`. Checks, trace, scoring and every page work unchanged. |

---

## 16. Known limits

Worth knowing before anyone asks.

1. **No backend and no persistence.** Everything lives in memory; a refresh replays the plant from
   the seed. `localStorage` holds only the theme, the sidebar state and recent palette entries.
2. **The month-end load model is a formula, not a measurement.** Each interface has an authored
   baseline rate and saturation point. It is internally consistent and clickable, but it is the one
   place on the Command Centre where numbers are modelled rather than observed.
3. **Discovery recordings and SOPs are authored.** The log, the activity counts, the procedure
   verdicts and the rework split are live; the six session transcripts are not.
4. **No test runner is really executing.** The Run Centre plays a scripted run. The data check
   inside it is real, but no Playwright process exists.
5. **Accessibility is good, not audited.** Landmarks, focus traps, roving tabindex, `aria-current`,
   `aria-sort`, reduced-motion support and keyboard reachability are all implemented; no screen
   reader pass has been done.
6. **Two large bundles.** Command Centre and the index chunk carry recharts. Fine for a demo,
   worth splitting for production.

---

J2W · POC – mock data for demonstration
