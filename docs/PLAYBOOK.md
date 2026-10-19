# J2W AI Test Factory — Playbook

Everything in this playbook was read out of the code as it stands today. Screen names, numbers,
table names, check names and fault names match the application exactly.

Plain words come first. The technical term is in brackets the first time it appears.

---

## Table of contents

1. [What this application is](#1-what-this-application-is)
2. [The big picture](#2-the-big-picture)
3. [The landscape](#3-the-landscape)
4. [The business flows, step by step](#4-the-business-flows-step-by-step)
5. [Follow one truck end to end](#5-follow-one-truck-end-to-end)
6. [Every fault switch F1–F10](#6-every-fault-switch-f1f10)
7. [Every live check](#7-every-live-check)
8. [The confidence score](#8-the-confidence-score)
9. [The release gate](#9-the-release-gate)
10. [Page by page](#10-page-by-page)
11. [Requirement coverage](#11-requirement-coverage)
12. [The AI agents](#12-the-ai-agents)
13. [Roles](#13-roles)
14. [Demo scripts](#14-demo-scripts)
15. [Questions the client will ask](#15-questions-the-client-will-ask-and-honest-answers)
16. [What is live and what is written content](#16-what-is-live-and-what-is-written-content)
17. [Glossary](#17-glossary)
18. [Counts shown on screen](#18-counts-shown-on-screen)

---

## 1. What this application is

1. **The problem.** Testing is 100 % manual. Key users click through every screen by hand, there is
   no standard report at the end, and the month-end freeze takes 10 days because nobody can prove
   the landscape is safe.
2. **What the factory does.** It learns the real process from recordings and system logs, writes
   the tests itself, runs them on a schedule, and compares every record across every system while
   the plant is running.
3. **What it catches.** A weight that changes between the weighbridge and SAP, a tonne booked as a
   kilogram, a missing message, a vendor paid without a sanctions check — each one named, with the
   cause and the exact records.
4. **What the client gets.** One confidence score, a release gate (GO / CONDITIONAL / NO-GO) with
   six computed criteria, and a sealed evidence pack per release that an auditor can read.
5. **What is on offer.** Not only a tool: a testing framework plus a team (a pod) that owns the
   result. See **Command Centre → Framework & Pod**.

---

## 2. The big picture

The whole process is eight steps. The **Testing Journey** page (`/journey`) is the map of it.

```
            THE TESTING JOURNEY — 8 STEPS
            (screen in the app · who approves)

  1  LEARN THE PROCESS
     Recordings + system log + written procedures
     ──> Discovery agent ──> a process map
     Process Discovery → Inputs  (/discovery)                     · Key User
                 |
                 v
  2  CONFIRM WITH KEY USERS
     Key users press every box, arrow and loop: Correct / Not right / comment
     ──> map redrawn as version 2
     Process Discovery → Process map  (/discovery/map)            · Key User
                 |
                 v
  3  WRITE THE TESTS
     Approved map + business rules
     ──> Scenario Writer agent ──> positive, negative, re-test scenarios
     Test Studio  (/studio)                                       · Key User approves each one
                 |
                 v
  4  PREPARE TEST DATA
     Find bad master data, then create clean linked records
     Test Studio → Master Data Check  (/studio/master-data)
     Test Studio → Test Data          (/test-data)                · QA Lead
                 |
                 v
  5  RUN THE TESTS
     Every step with a screenshot and a log; a broken step heals itself
     Runs on a schedule, after every change, for every project
     Run Centre  (/run)  ·  Run Centre → Schedules (/run/schedules)   · QA Lead
                 |
                 v
  6  CHECK DATA ACROSS SYSTEMS
     Compare what every system holds for the same load, every few minutes
     Live Data Flow → Live Checks  (/flow/checks)
     also Interface Testing (/interfaces) and Migration Reconciliation (/reconciliation)
                                                                  · Key User
                 |
                 v
  7  FIX AND RE-TEST
     Raise a finding, work out what the change touches, re-run only those tests
     Change & Regression  (/regression)                           · Key User
                 |
                 v
  8  PROVE AND RELEASE
     Seal the evidence pack, score the gate
     Command Centre → Release & Close  (/release)
     also Month-End Load (/load) and Roles & SoD (/access-sod)
                                              · Key User signs off · Auditor can view
```

Underneath all eight steps, the simulated plant keeps running and the live checks keep comparing.
That is why the numbers on every screen move while you watch.

---

## 3. The landscape

### 3.1 The systems

Three bands on the **Enterprise Map** (`/landscape`): the shop floor, the core ERP, and finance and
output. Ten application systems plus four outside finance services. Thirteen of them produce data
in the simulation; SAP S/4HANA – Service Centre is drawn for completeness and carries no live
traffic.

| Band | System | Role in the business | Tables it owns | Key columns |
|---|---|---|---|---|
| Shop floor | **Yard Management** | The gate and the weighbridge | `gate_pass` | gate_pass, site, vehicle, transport, vendor, po, process, arrived |
| | | | `weighbridge_ticket` | ticket, gate_pass, vehicle, gross_kg, tare_kg, net_kg, registered_tare_kg, unit, weighed |
| Shop floor | **Mill Execution System** | Melting and casting | `heat` | heat, coils, weight_kg, started |
| Shop floor | **Scrap Yard Operations** | Receiving, sorting and moving scrap | `receipt` | receipt, gate_pass, vehicle, site, weight_kg, received |
| | | | `scrap_batch` | batch, receipt, grade, weight_kg, created |
| | | | `chemistry` | sample, batch, ni_pct, cr_pct, mo_pct, tested |
| | | | `transfer` | transfer, batch, from_site, to_site, weight_kg, received_kg, unit, sent, received |
| Shop floor | **Laboratory app** | Measures the chemistry of a sample | `lab_result` | sample, batch, grade, status, tested |
| Core ERP | **SAP S/4HANA – Steel** | Purchasing, delivery booking, invoices, payments | `EKPO` (purchase order line) | ebeln, vendor, material, price_eur_t, open_qty_kg |
| | | | `MSEG` (delivery booked / goods receipt) | mblnr, **xblnr = gate pass**, ebeln, menge, meins, posted |
| | | | `RBKP` (invoice record) | belnr, ext_invoice, gate_pass, ebeln, qty_kg, amount_eur, status, reason, currency, fx_rate_used, posted |
| | | | `AFRU` (production confirmation) | rueck, heat, coils, weight_kg, delay_min, received |
| Core ERP | **D365 F&O – Recycling** | Stock, issues and quality for recycling | `stock_posting` | journal, batch, item, qty, unit, warehouse, posted |
| | | | `issue` | issue, batch, qty_kg, unit, issued |
| | | | `quality_order` | order, batch, grade, ni_pct, cr_pct, mo_pct, result, created |
| Core ERP | **SAP S/4HANA – Service Centre** | Second SAP instance, on the map only | — | no live traffic |
| Finance | **Esker** | Captures the supplier invoice | `captured_invoice` | doc, ext_invoice, gate_pass, po, qty_kg, amount_eur, captured |
| Finance | **Lasernet** | Prints and archives documents | `output_document` | doc, type, **ref** (invoice number or batch), created |
| Finance | **Reval** | Treasury and payments | `payment` | pay, belnr, vendor, amount_eur, run_at |
| Finance | **VAT validation service** | Checks the vendor's VAT number | `vat_check` | check, belnr, vendor, vat_number, valid, checked |
| Finance | **Sanctions screening service** | Screens the vendor against the day's list | `sanctions_screen` | screen, belnr, vendor, list_day, list_date, hit, screened |
| Finance | **eBanking gateway** | Acknowledges the payment run | `bank_ack` | ack, pay_run, invoices, amount_eur, status, acked |
| Finance | **Exchange-rate service** | Loads the daily rates at 06:00 | `fx_rate` | day, date, pair, rate, loaded |

That is **22 tables**. Only the last 24 simulated hours are kept; the daily exchange rates are kept
by row count instead, because an invoice booked just before midnight still needs the rate of its
own day.

### 3.2 The interfaces

Nineteen links between systems. Fifteen carry live traffic (●); four are drawn dashed (○) because
they exist in the landscape but are quiet in this demo.

| Id | What it carries | From → to | Format | Live | How often |
|---|---|---|---|---|---|
| IF-01 | Weighbridge ticket | Yard Management → SAP Steel | API (REST) | ● | Per vehicle |
| IF-02 | Recycling receipt | Yard Management → Scrap Yard | API (REST) | ● | Per vehicle |
| IF-03 | Stock posting | Scrap Yard → D365 | API (OData) | ● | Per batch |
| IF-04 | Production confirmation | Mill → SAP Steel | File drop | ● | Per heat |
| IF-05 | Delivery note | SAP Steel → Lasernet | IDoc | ○ | Per delivery |
| IF-06 | Captured invoice | Esker → SAP Steel | API (REST) | ● | Per invoice |
| IF-07 | Stock transfer | SAP Steel → SAP Service Centre | IDoc | ○ | Hourly |
| IF-08 | Inventory sync | D365 → SAP Steel | API (OData) | ○ | Nightly |
| IF-09 | Invoice copy | SAP Steel → Lasernet | File drop | ● | Per invoice |
| IF-10 | Mill certificate | Mill → Lasernet | File drop | ● | Per heat |
| IF-11 | Payment file | SAP Steel → Reval | File (SFTP) | ● | Hourly |
| IF-12 | Charge plan | Yard Management → Mill | API (REST) | ○ | Per shift |
| IF-13 | Recycling documents (self-billing) | D365 → Lasernet | File drop | ● | Per posting |
| IF-14 | Chemistry result | Laboratory → Scrap Yard | API (REST) | ● | Per sample |
| IF-15 | VAT validation | SAP Steel → VAT service | API (REST) | ● | Per invoice |
| IF-16 | Sanctions screening | SAP Steel → Sanctions service | API (REST) | ● | Per invoice |
| IF-17 | Payment instruction | SAP Steel → eBanking gateway | File (SFTP) | ● | Hourly |
| IF-18 | Exchange rates | Exchange-rate service → SAP Steel | API (REST) | ● | Daily at 06:00 |
| IF-19 | Stock transfer between yards | Scrap Yard → D365 | API (OData) | ● | Per transfer |

On **Interface Testing** the type column calls IF-06, IF-09, IF-11, IF-13 and IF-15 to IF-18
**Financial**; everything else is **Shop-floor**.

---

## 4. The business flows, step by step

The simulated clock starts at 06:00 on 14 Oct 2026. Eight hours are pre-run on reset, which is why
the first screen is already full. Times below are simulated minutes.

### 4.1 Truck to invoice — workflow P1 *Gate to Invoice (steel)*

A steel truck arrives roughly every 4 to 9 minutes.

| # | What happens | System | Table that gets a row | Interface | Timing | Check that guards it |
|---|---|---|---|---|---|---|
| 1 | Gate pass created for the transport | Yard Management | `gate_pass` | — | on arrival | C2 |
| 2 | Weighed full and empty; load weight = full − empty (gross − tare = net) | Yard Management | `weighbridge_ticket` | — | same minute | C1 |
| 3 | Ticket sent to SAP | Yard Management → SAP Steel | — | **IF-01** | travels 2–6 min | C1, C2 |
| 4 | Delivery booked in SAP (goods receipt, `MSEG`) | SAP Steel | `MSEG` | IF-01 arrives | — | C1, C2 |
| 5 | Supplier invoice captured | Esker | `captured_invoice` | — | 35–110 min after the gate | C7 |
| 6 | Capture sent to SAP | Esker → SAP Steel | — | **IF-06** | travels 3–8 min | C7 |
| 7 | VAT number checked | SAP Steel → VAT service | `vat_check` | **IF-15** | travels 1–3 min | — |
| 8 | Vendor screened against the day's sanctions list | SAP Steel → Sanctions service | `sanctions_screen` | **IF-16** | travels 1–3 min | C10 |
| 9 | Invoice check (three-way match): order vs delivery vs invoice. Booked (posted) or on hold (parked) | SAP Steel | `RBKP` | — | on arrival of IF-06 | C7, C11 |
| 10 | Invoice copy rendered and archived | SAP Steel → Lasernet | `output_document` | **IF-09** | travels 2–5 min | C8 |
| 11 | Hourly payment run sends the payment file | SAP Steel → Reval | `payment` | **IF-11** | travels 2–6 min, every 60 min | — |
| 12 | Same run sends the payment instruction to the bank | SAP Steel → eBanking | `bank_ack` | **IF-17** | travels 3–9 min | — |

The invoice is parked when: no purchase order reference, no delivery booking found, or the quantity
differs by more than 1 %.

### 4.2 Scrap to stock — workflow P2 *Scrap to Stock (recycling)*

A recycling load arrives roughly every 7 to 13 minutes. **The recycling yard weighs in tonnes.**

| # | What happens | System | Table | Interface | Timing | Check |
|---|---|---|---|---|---|---|
| 1 | Gate pass for the wagon, truck or container | Yard Management | `gate_pass` | — | on arrival | C3 |
| 2 | Weighed in **tonnes** (e.g. 42.26 t) | Yard Management | `weighbridge_ticket` (`unit = 't'`) | — | same minute | C3 |
| 3 | Receipt sent to the scrap yard | Yard → Scrap Yard | — | **IF-02** | travels 2–6 min | C3 |
| 4 | Scrap Yard converts to **kilograms** (42.26 t → 42 260 kg) | Scrap Yard | `receipt` | IF-02 arrives | — | C3, C4 |
| 5 | Sorted into 1 to 3 batches; the batches must add up | Scrap Yard | `scrap_batch` | — | 8–25 min later | C4 |
| 6 | Sample sent to the laboratory and measured | Laboratory | `lab_result` | — | 10–30 min after sorting | C5 |
| 7 | Chemistry result returned (Ni, Cr, Mo) | Laboratory → Scrap Yard | `chemistry` | **IF-14** | travels 2–6 min | C5, C13 |
| 8 | **Quality order** raised against the grade window | D365 | `quality_order` | — | 3–8 min after the chemistry | C13 |
| 9 | Stock posted in kilograms | Scrap Yard → D365 | `stock_posting` | **IF-03** | 5–15 min after sorting, travels 2–5 min | C6 |
| 10 | Self-billing document for the booked scrap purchase | D365 → Lasernet | `output_document` | **IF-13** | travels 2–5 min | C8 |
| 11 | **Melt shop issues** part or all of the batch, always in kilograms | D365 | `issue` | — | 20–60 min after the stock posting | C6b |
| 12 | About one batch in three is **transferred to the other yard** (YD02 ↔ YD05) | Scrap Yard → D365 | `transfer` | **IF-19** | 25–70 min later, travels 3–9 min | C12 |

**Tonnes received → kilograms issued** is the heart of this flow. The yard says 42.26 t, D365 must
hold 42 260 KG, and the melt shop takes kilograms out of it. If the × 1 000 step is skipped
(fault F6), stock reads 42.26 KG and the melt shop has issued more than exists — C6 and C6b both
light up, and the same fault makes a transfer arrive 1 000 times light (C12).

**The quality order result** compares the measured values with the window for the grade. Nickel may
be ±0.28 %, chromium ±0.38 %, molybdenum ±0.095 % around the nominal for that grade. Inside the
window → **Pass**. Outside → **Fail**. A value missing → **Incomplete**, which C13 treats as a
failure, because a quality order that cannot say anything is not a quality order.

### 4.3 Mill to SAP — workflow P4 *Produce to Dispatch*

A heat finishes roughly every 40 to 60 minutes.

| # | What happens | System | Table | Interface | Timing | Check |
|---|---|---|---|---|---|---|
| 1 | Heat finished, with its coils and weight | Mill | `heat` | — | — | C9 |
| 2 | Production confirmation sent | Mill → SAP Steel | `AFRU` | **IF-04** | normally 3–10 min | C9 |
| 3 | Mill certificate rendered | Mill → Lasernet | `output_document` | **IF-10** | travels 2–6 min | — |

The rule is 15 minutes. A late file (fault F8) takes 25 to 45 minutes and C9 names it.

### 4.4 Finance and compliance

| What | When | System | Table | Interface | Check |
|---|---|---|---|---|---|
| VAT number validated | Before every invoice is booked | VAT service | `vat_check` | IF-15 | — |
| Vendor screened against the sanctions list of the day | Before every invoice is booked | Sanctions service | `sanctions_screen` | IF-16 | **C10** |
| Payment instruction and bank acknowledgement | With every hourly payment run | eBanking gateway | `bank_ack` | IF-17 | — |
| Exchange rates loaded | Once a day at 06:00, for USD/EUR and GBP/EUR | Exchange-rate service | `fx_rate` | IF-18 | **C11** |

About one supplier invoice in four is in a currency other than euro. It is booked at the latest
rate the service has loaded. If no file arrived for that day (fault F10), the invoice is booked at
the day before's rate and C11 names it.

### 4.5 D365 → Lasernet

Every booked scrap purchase produces a **self-billing document** in Lasernet over IF-13, keyed on
the batch. C8 covers both document types: an invoice copy for every booked invoice, and a
self-billing document for every stock posting.

---

## 5. Follow one truck end to end

Use **Live Data Flow → Trace** (`/flow/trace`). It accepts a vehicle (`VH-`, `WGN-`, `CNU-`), a
gate pass (`GP-`), a heat (`HT-`), a batch (`BT-`), a receipt (`RC-`), an external invoice (`INV-`),
a sample (`LAB-`), an SAP invoice number or an SAP material document number.

### 5.1 The clean journey

| Time | Where | What was recorded |
|---|---|---|
| 09:42 | Yard Management | Gate pass **GP-PL01-2026-4182**, vehicle **VH-7741**, vendor **VEND-1042**, purchase order **4500012044** |
| 09:42 | Yard Management | Weighed: full **38 420 kg**, empty **13 560 kg**, load **24 860 kg** (`weighbridge_ticket`, unit kg) |
| 09:42 | IF-01 | Message sent: `gatePass, vehicle, grossKg 38420, tareKg 13560, quantity 24860, unit KG, purchaseOrder 4500012044` |
| 09:46 | SAP Steel | Delivery booked (`MSEG`) **5000001842**, quantity **24 860 KG**, reference = the gate pass |
| 11:05 | Esker | Supplier invoice **INV-418203** captured (`captured_invoice` ESK-00412), 24 860 kg, **€ 50 963** |
| 11:11 | IF-06 | Capture sent to SAP |
| 11:12 | VAT service | `vat_check` VAT-00231: VEND-1042, GB 418 7721 03, valid |
| 11:12 | Sanctions service | `sanctions_screen` SCR-00231: list of **14 Oct 2026**, no hit |
| 11:11 | SAP Steel | Invoice check passes. Invoice record (`RBKP`) **5100001193** **Posted**, currency EUR |
| 11:15 | Lasernet | Invoice copy **LN-00517** archived against 5100001193 |
| 12:00 | Reval | Payment **PY-00188** for 5100001193, € 50 963 |
| 12:06 | eBanking | Acknowledgement **ACK-00042** for payment run PR-00031 |

Trace verdict: **"Every system agrees on this one."**

### 5.2 The same truck with the kilogram / tonne mix-up (F1)

Only one thing changes: the quantity on the IF-01 message.

| Time | Where | What went wrong |
|---|---|---|
| 09:42 | IF-01 | The message carries `quantity 24.86` and still says `unit KG` |
| 09:46 | SAP Steel | Delivery booked as **24.86 KG** instead of 24 860 kg |
| 09:52 | **C1** fails | *"Unit mix-up: 24.86 was sent as KG but is really tonnes. SAP is short by 24 835 kg."* |
| 11:11 | SAP Steel | Invoice check compares 24 860 kg invoiced against 24.86 KG booked → **Parked**, reason *"Quantity differs by 24 835 kg"* |
| 11:11 | **C7** fails | *"Parked by the three-way match: quantity differs by 24 835 kg."* |
| — | Lasernet | No invoice copy, because nothing was posted |
| — | Reval | No payment |

One wrong field at 09:42 stops the money at 11:11. That is the sentence to say out loud.

### 5.3 The same truck with the stale empty weight (F2)

| Where | What went wrong |
|---|---|
| IF-01 | The message uses the **registered** empty weight from the vehicle master (14 600 kg) instead of the one just weighed (13 560 kg), so the load is sent as 23 820 kg |
| SAP Steel | Delivery booked as 23 820 KG |
| **C1** | *"Stale tare: the message used the registered tare 14 600 kg instead of the weighed tare 13 560 kg."* |
| **C7** | The invoice is parked: *"Quantity differs by 1 040 kg."* |

Both faults produce a wrong weight. The check tells them apart arithmetically and names the right
cause, which is what makes the finding actionable.

---

## 6. Every fault switch F1–F10

All ten are **on by default**. Each one changes the data for real — none of them is cosmetic. They
live on **Live Data Flow → Live Flow**, in the card *"What can go wrong"*.

| # | Fault | Interface | How often | What it breaks | Caught by | The cause text the user reads |
|---|---|---|---|---|---|---|
| **F1** | Kilogram / tonne mix-up | IF-01 | 8 % of trucks | Sends load ÷ 1000 but still labelled KG | **C1**, C7 | *"Unit mix-up: 24.86 was sent as KG but is really tonnes. SAP is short by 24 835 kg."* |
| **F2** | Stale tare weight | IF-01 | 7 % of trucks | Uses the vehicle master's registered empty weight instead of the one just weighed | **C1**, C7 | *"Stale tare: the message used the registered tare 14 600 kg instead of the weighed tare 13 560 kg."* |
| **F3** | Gateway retry duplicate | IF-01 | 5 % of trucks | Delivers the same ticket twice, 1–3 min apart, so SAP holds two delivery bookings | **C2** | *"The gateway delivered the ticket twice, so the quantity is counted twice."* |
| **F4** | Lost message | IF-02 | 6 % of loads | The recycling receipt never arrives; nothing is written in the scrap yard | **C3** | *"The load was weighed at the gate but never reached Scrap Yard Operations."* |
| **F5** | Molybdenum field renamed | IF-14 | 20 % of samples | `mo_pct` arrives empty, so the grade cannot be certified | **C5**, **C13** | *"The laboratory renamed the field, so molybdenum arrives empty and the grade cannot be certified."* and *"The chemistry is incomplete, so the quality order cannot say whether the batch meets its grade."* |
| **F6** | Tonnes not converted to kilograms | IF-03 and IF-19 | 7 % of batches | The × 1 000 step is skipped, so stock and transfers are 1 000 times light | **C6**, **C6b**, **C12** | *"Received 21.14 t, stock shows 21.14 KG — not converted (should be 21 140 KG)."* |
| **F7** | No purchase order on capture | IF-06 | 6 % of invoices | Esker sends no purchase order reference, so the invoice check parks it | **C7** | *"Parked by the three-way match: no purchase order reference."* |
| **F8** | Late mill file | IF-04 | 25 % of heats | The production confirmation takes 25–45 min instead of 3–10 | **C9** | *"The confirmation took 28 minutes, over the 15 minute limit."* |
| **F9** | Sanctions list not refreshed | IF-16 | 3 % of screenings | The vendor is screened against yesterday's list | **C10** | *"The vendor was screened against the list published 13 Oct 2026, not the list of the day the invoice was booked."* |
| **F10** | Exchange rate missing | IF-18 | 10 % of days | No rate file arrives, so foreign-currency invoices use the day before's rate | **C11** | *"No exchange rate was loaded for USD/EUR on that day, so the invoice used the rate of the day before."* |

F1 and F2 can never hit the same message. A ticket is either divided or stale, never both, which is
why C1 can always name one specific cause.

### "Fix the cause and replay" — the proof

On **Live Data Flow → Live Checks**, open a failing check and press **Fix the cause and replay**.

1. The faults listed against that check are switched off.
2. The plant is reset with the next seed and eight hours are replayed.
3. The same check is run again over the new data, and turns green.

Nothing in the check changed. The data changed. That is the whole argument: the failures are
produced by the simulation, not written into fixtures.

The same thing is provable from the command line in a few seconds:

```
$ npm run selftest
ALL FAULTS ON     4 of 14 checks pass · 881 records compared · 80 disagree
ALL FAULTS OFF   14 of 14 checks pass · 892 records compared ·  0 disagree
OK: faults off → every check passes; faults on → the data really breaks.
```

`npm run verify` fails the build if that is ever untrue.

---

## 7. Every live check

Fourteen checks. The ids run C1 to C13 with **C6b** between C6 and C7, which is why there are
fourteen rather than thirteen. (There is no check called C14.) They are on
**Live Data Flow → Live Checks** (`/flow/checks`).

**Settle time** is the age a record must reach before a check will judge it. It is always longer
than the slowest travel time on that interface, so a check can never fail just because a message is
still on its way.

---

### C1 · Weighbridge net weight equals the goods receipt quantity
*What the weighbridge measured must be what SAP booked, within 20 kg.*

| | |
|---|---|
| Compares | `weighbridge_ticket` ↔ `MSEG` (Yard Management ↔ SAP Steel) |
| Interface | IF-01 · Stage: Goods receipt · Workflow P1 |
| Settle | 10 minutes |
| Broken by | F1, F2 |

```sql
select t.gate_pass, t.vehicle, t.net_kg, m.menge, m.meins,
       abs(t.net_kg - m.menge) as difference
from   yard.weighbridge_ticket t
join   sap.mseg m on m.xblnr = t.gate_pass
where  abs(t.net_kg - m.menge) > 20
```

Example failing row: `GP-PL01-2026-4182 · VH-7741 · 24 860 · 24.86 · KG · 24 835` —
*"Unit mix-up: 24.86 was sent as KG but is really tonnes. SAP is short by 24 835 kg."*

---

### C2 · Exactly one goods receipt per truck
*One truck through the gate must create one delivery booking in SAP — never none, never two.*

| | |
|---|---|
| Compares | `gate_pass` ↔ `MSEG` |
| Interface | IF-01 · Settle 12 minutes · Broken by F3 |

```sql
select g.gate_pass, g.vehicle, count(m.mblnr) as receipts
from   yard.gate_pass g
left   join sap.mseg m on m.xblnr = g.gate_pass
where  g.process = 'P1'
group  by g.gate_pass, g.vehicle
having count(m.mblnr) <> 1
```

Example: `GP-PL03-2026-5485 · VH-3310 · 2 · 5000001901, 5000001902` —
*"The gateway delivered the ticket twice, so the quantity is counted twice."*

---

### C3 · Every recycling load reached the scrap yard
*A load weighed at the gate must exist as a receipt in Scrap Yard Operations.*

| | |
|---|---|
| Compares | `gate_pass` + `weighbridge_ticket` ↔ `receipt` |
| Interface | IF-02 · Settle 12 minutes · Broken by F4 |

```sql
select g.gate_pass, g.vehicle, g.site, t.net_kg, r.receipt
from   yard.gate_pass g
join   yard.weighbridge_ticket t on t.gate_pass = g.gate_pass
left   join scrap.receipt r on r.gate_pass = g.gate_pass
where  g.process = 'P2' and r.receipt is null
```

Example: `GP-YD02-2026-7741 · WGN-41882 · YD02 · 42.26 t · —` —
*"The load was weighed at the gate but never reached Scrap Yard Operations."*

---

### C4 · Batch weights add up to the receipt
*Sorting must not create or lose material.*

| | |
|---|---|
| Compares | `receipt` ↔ `scrap_batch` · Settle 35 minutes · No fault wired to it |

```sql
select r.receipt, r.weight_kg, count(b.batch) as batches, sum(b.weight_kg) as sorted
from   scrap.receipt r
join   scrap.scrap_batch b on b.receipt = r.receipt
group  by r.receipt, r.weight_kg
having abs(r.weight_kg - sum(b.weight_kg)) > 1
```

Example cause: *"Sorting lost 340 kg against the weight received."* With every fault on this check
still passes, which is the honest point: nobody is breaking it.

---

### C5 · Chemistry is complete for every batch
*Every batch needs nickel, chromium and molybdenum before it can be certified.*

| | |
|---|---|
| Compares | `scrap_batch` ↔ `chemistry` · Interface IF-14 · Settle 50 minutes · Broken by F5 |

```sql
select b.batch, b.grade, c.ni_pct, c.cr_pct, c.mo_pct
from   scrap.scrap_batch b
left   join scrap.chemistry c on c.batch = b.batch
where  c.batch is null or c.ni_pct is null or c.cr_pct is null or c.mo_pct is null
```

Example: `BT-00231 · SCR-316L-SOLID · 10.4 · 16.9 · — · Mo` —
*"The laboratory renamed the field, so molybdenum arrives empty and the grade cannot be certified."*

---

### C6 · Stock in kilograms matches the tonnes received
*The yard receives tonnes. D365 must hold the same material in kilograms: tonnes × 1 000.*

| | |
|---|---|
| Compares | `scrap_batch` ↔ `stock_posting` · Interface IF-03 · Settle 25 minutes · Broken by F6 |

```sql
select b.batch, b.weight_kg, s.qty, s.unit, s.journal
from   scrap.scrap_batch b
left   join d365.stock_posting s on s.batch = b.batch
where  s.journal is null or s.unit <> 'KG' or abs(s.qty - b.weight_kg) > 1
```

Example: `BT-00231 · 21.14 t · 21 140 · 21.14 KG · JR-00318` —
*"Received 21.14 t, stock shows 21.14 KG — not converted (should be 21 140 KG)."*

---

### C6b · Issued kilograms never exceed stock
*The melt shop cannot take out more kilograms than D365 shows in stock for that batch.*

| | |
|---|---|
| Compares | `issue` ↔ `stock_posting` · Interface IF-03 · Settle 10 minutes · Broken by F6 |

```sql
select i.batch, sum(i.qty_kg) as issued, s.qty, s.unit
from   d365.issue i
join   d365.stock_posting s on s.batch = i.batch
group  by i.batch, s.qty, s.unit
having sum(i.qty_kg) > s.qty + 1
```

Example: `BT-00231 · 12 680 · 21.14 KG · KG · 12 659` —
*"The melt shop issued 12 680 kg but D365 only shows 21.14 KG, because the tonnes were never
converted."*

A batch with no stock posting at all is C6's business, not this one's, so the two checks never
double-count the same problem.

---

### C7 · Supplier invoices pass the three-way match
*Purchase order, delivery booking and invoice must agree, otherwise the invoice is put on hold.*

| | |
|---|---|
| Looks at | `RBKP` · Interface IF-06 · Settle 5 minutes · Broken by F1, F2, F7 |

```sql
select r.ext_invoice, r.gate_pass, r.qty_kg, r.amount_eur, r.status, r.reason
from   sap.rbkp r
where  r.status = 'Parked'
```

Example: `INV-418203 · GP-PL01-2026-4182 · 24 860 · € 50 963 · Parked · Quantity differs by 24 835 kg`
— *"Parked by the three-way match: quantity differs by 24 835 kg."*

A parked invoice is the control working. The check exists so that nobody has to go looking for them.

---

### C8 · Every booking has its document in Lasernet
*A booked invoice must produce an invoice copy, and a booked scrap purchase a self-billing
document.*

| | |
|---|---|
| Compares | `RBKP` and `stock_posting` ↔ `output_document` · Interfaces IF-09, IF-13 · Settle 12 minutes · No fault wired to it |

```sql
select r.ext_invoice, r.belnr, 'Invoice copy', d.doc
from   sap.rbkp r
left   join lasernet.output_document d on d.ref = r.belnr
where  r.status = 'Posted' and d.doc is null
union  all
select s.journal, s.batch, 'Self-billing document', d.doc
from   d365.stock_posting s
left   join lasernet.output_document d on d.ref = s.batch
where  d.doc is null
```

Example cause: *"The invoice is posted but Lasernet never produced the copy."* or *"D365 booked the
scrap purchase but Lasernet never produced the self-billing document."*

---

### C9 · Mill confirmations arrive within 15 minutes
*A finished heat must be confirmed in SAP within 15 minutes, or the shift report is wrong.*

| | |
|---|---|
| Compares | `heat` ↔ `AFRU` · Interface IF-04 · Settle 55 minutes · Broken by F8 |

```sql
select h.heat, h.coils, h.weight_kg, a.delay_min, a.rueck
from   mill.heat h
left   join sap.afru a on a.heat = h.heat
where  a.rueck is null or a.delay_min > 15
```

Example: `HT-26-48211 · 3 · 24 980 · 28 · AF-000412` —
*"The confirmation took 28 minutes, over the 15 minute limit."*

---

### C10 · Every vendor paid was screened against today's sanctions list
*No supplier invoice may be booked unless the vendor was screened against the list published that
day.*

| | |
|---|---|
| Compares | `RBKP` ↔ `sanctions_screen` · Interface IF-16 · Settle 15 minutes · Broken by F9 |

```sql
select r.belnr, s.vendor, s.list_date, s.screened
from   sap.rbkp r
left   join sanctions.sanctions_screen s on s.belnr = r.belnr
where  r.status = 'Posted'
and    (s.screen is null or s.list_day <> day(s.screened))
```

Example: `5100001193 · VEND-1044 · 13 Oct 2026 · 14 Oct 11:12 · List out of date` —
*"The vendor was screened against the list published 13 Oct 2026, not the list of the day the
invoice was booked."*

---

### C11 · Every foreign-currency invoice used that day's exchange rate
*An invoice in a currency other than euro must be booked at the rate loaded for the day it was
booked.*

| | |
|---|---|
| Compares | `RBKP` ↔ `fx_rate` · Interface IF-18 · Settle 20 minutes · Broken by F10 |

```sql
select r.belnr, r.currency, r.fx_rate_used, f.rate
from   sap.rbkp r
left   join fx.fx_rate f on f.pair = concat(r.currency, '/EUR') and f.day = day(r.posted)
where  r.currency <> 'EUR'
and    (f.rate is null or r.fx_rate_used <> f.rate)
```

Example: `5100001207 · USD · 0.9162 · — · 15 Oct 08:41` —
*"No exchange rate was loaded for USD/EUR on that day, so the invoice used the rate of the day
before."*

An invoice booked before the file arrives on a day when the file *does* arrive is not a failure.
The check only reports a day where no rate was loaded at all, or a rate that does not match.

---

### C12 · Transfers arrive with the same weight
*A batch moved between the two recycling yards must be booked in D365 with the weight it left with.*

| | |
|---|---|
| Looks at | `transfer` · Interface IF-19 · Settle 15 minutes · Broken by F6 |

```sql
select t.transfer, t.batch, t.from_site, t.to_site, t.weight_kg, t.received_kg
from   scrap.transfer t
where  t.received_kg is null or abs(t.received_kg - t.weight_kg) > 1
```

Example: `TR-00118 · BT-00231 · YD05 · YD02 · 15 200 · 15.2` —
*"YD05 sent 15 200 kg, YD02 booked 15.2 KG — the tonnes were not converted."*

---

### C13 · Every tested batch has a quality order with the right result
*D365 must raise a quality order for every tested batch, and judge it against the window for its
grade.*

| | |
|---|---|
| Compares | `chemistry` + `scrap_batch` ↔ `quality_order` · Interface IF-03 · Settle 15 minutes · Broken by F5 |

```sql
select c.batch, b.grade, c.ni_pct, c.cr_pct, c.mo_pct, q.order, q.result
from   scrap.chemistry c
join   scrap.scrap_batch b on b.batch = c.batch
left   join d365.quality_order q on q.batch = c.batch
where  q.order is null or q.result = 'Incomplete' or q.result <> expected(b.grade, c)
```

Example: `BT-00231 · SCR-316L-SOLID · 10.4 · 16.9 · — · QO-00188 · Incomplete` —
*"The chemistry is incomplete, so the quality order cannot say whether the batch meets its grade."*

A batch that genuinely fails its grade window is **not** a check failure: the quality order says
Fail, the measured values say Fail, they agree. The check is about D365 judging correctly, not
about the scrap being good.

---

### Why not all fourteen fail at once

C4 and C8 have no fault wired to them. C10 and C11 are rare by design (3 % of screenings, 10 % of
days). So with every fault on, the honest result is usually **4 or 5 of 14 pass**. With every fault
off it is always **14 of 14**.

---

## 8. The confidence score

One number, 0 to 100, on **Command Centre → Health**. Four inputs, each weighted.

| Input | Weight | How it is measured |
|---|---|---|
| **Data agreement across systems** | 35 % | Records compared by the fourteen live checks, minus the records that disagree, as a percentage. Measured at record level, not check level. |
| **Scenario results** | 30 % | Scenarios passed ÷ scenarios in the last run. |
| **Interface messages intact** | 20 % | Messages that arrived undamaged ÷ messages sent. |
| **Open findings** | 15 % | Starts at 100 and loses 15 per open critical, 6 per high, 2 per medium, 1 per low. Never falls below 10. |

**The cap.** While any critical finding is open, the score cannot go above **79**, whatever the
other inputs say. The gauge says so on screen.

### A worked example

| Input | Measurement | Value | × weight |
|---|---|---|---|
| Data agreement | 881 records compared, 80 disagree → 801 agree | 90.9 | × 0.35 = 31.8 |
| Scenario results | 24 of 30 passed in the last run | 80.0 | × 0.30 = 24.0 |
| Interfaces intact | 1 180 of 1 265 arrived undamaged | 93.3 | × 0.20 = 18.7 |
| Open findings | 1 critical, 2 high, 3 medium → 100 − 15 − 12 − 6 | 67.0 | × 0.15 = 10.1 |
| **Raw total** | | | **84.6 → 85** |
| **Capped** | one critical finding is open | | **79** |

Close the critical finding and the score jumps to 85 at once. That is the single most persuasive
click in the demo.

### How "What to do next" calculates the + points

The card under the gauge ranks up to four actions. For each one, the factory **re-runs the same
calculation with that one thing fixed** and shows the difference:

- *Close finding F-001* → recompute the score with that finding removed from the list → **+6**.
- *Fix the cause of C1 and replay* → recompute with those records agreeing → **+4**.
- And so on.

The number is not an estimate. It is the same maths as the gauge, run twice.

---

## 9. The release gate

**Command Centre → Release & Close** (`/release`). One decision for release **R-2026.10**:
**GO**, **CONDITIONAL** or **NO-GO**.

| Id | Exit criterion | How it is computed | Met when |
|---|---|---|---|
| **EC-1** | No critical finding is open | Counts findings with severity Critical and status Open | the count is 0 |
| **EC-2** | All live checks agree | Counts the live checks that pass, out of all of them | every check passes |
| **EC-3** | The regression pack is green | Reads the latest run's failures and healed steps | the run has 0 failures |
| **EC-4** | Evidence is locked and signed | Looks for an evidence pack for the latest run | a signed pack exists |
| **EC-5** | Interface backlog reaches zero at month-end volume | Reads whether finding F-008 is closed | F-008 is closed |
| **EC-6** | Every payment was screened and priced correctly | Reads C10 and C11 | both pass |

**The decision.** All six met → **GO**. One or two unmet → **CONDITIONAL**. Three or more unmet →
**NO-GO**.

### What turns CONDITIONAL into GO

Work down the unmet criteria. Each one links to the proof:

1. **EC-1** — open the critical finding, fix the cause, close it.
2. **EC-2** — open the failing check, press **Fix the cause and replay**.
3. **EC-3** — re-run the regression pack on **Change & Regression** after the fix.
4. **EC-4** — seal the evidence pack for the latest run on **Evidence & Reports**.
5. **EC-5** — re-run the 5× profile on **Month-End Load** and close F-008 once the backlog clears.
6. **EC-6** — C10 and C11 go green once F9 and F10 are off and the plant is replayed.

The page also carries the **close calendar** for October 2026 (freeze from the 22nd; milestones on
the 22nd, 23rd, 25th, 27th and 29th), a **safe to change before the close** list, and a
**sign-off** panel for the four roles.

---

## 10. Page by page

In menu order. Each entry says what the screen is for, what is on it from top to bottom, what every
button does, where the numbers come from, which journey step and requirement it proves, and the one
line to say when showing it.

---

### OVERVIEW · Command Centre

#### Tab 1 — Health (`/`)

**Purpose.** How much you can trust the landscape today, and what to do next.

**On the screen, top to bottom**

1. **Projects** — the three change projects running at once (SAP release Nov, D365 recycling
   update, Yard app release), each with its scenarios, open findings and schedules switched on.
   Underneath: **the next three runs** the factory will start on its own.
2. **The plant, right now** — plant clock, vehicles in the last hour, records created in the last
   hour, messages delivered, in flight, and damaged/lost/doubled.
3. **Confidence score** — the gauge, the four contributing bars, and four tiles: live checks
   passing, open findings, scenarios, interfaces agreeing.
4. **What to do next** — up to four ranked actions with the points each would add.
5. **Where the data is flowing** — records produced per system in the last hour; busiest interfaces
   with a clean/damaged badge.
6. **Confidence over the last 30 days** — today's point is the live gauge.
7. **Month-end readiness** — freeze days today against the 3-day target, naming the blocker.
8. **Workflow health** — all six workflows with live volume, the checks covering them, open
   findings and the stage strip.
9. **Open findings**, **Requirements proven**, **Last runs**.

**Buttons**

| Button | What it does |
|---|---|
| Run the plant / Pause the plant | Starts or stops the simulated plant |
| Run the P1 demo | Goes to the Run Centre and starts the step-by-step run |
| Any project card | Sets the project filter the whole app follows |
| Any tile or row | Opens the screen behind that number |

**Data.** Everything except the 30-day trend line is live from the running plant. The trend's
history is written content; today's point is live.

**Journey step** 8 (prove and release) · **Requirements** CORE-05, and the gateway to all others.

**Say this.** *"One number. Everything under it is live, and every part of it is clickable down to
a single truck."*

---

#### Tab 2 — Release & Close (`/release`)

**Purpose.** One gate decision, with the evidence behind it.

**On the screen.** The decision badge (GO / CONDITIONAL / NO-GO) with how many criteria are met →
**Exit criteria** list (section 9) → **Close calendar** for October → **Safe to change before the
close** → **Sign-off** for the four roles.

**Buttons.** Each criterion row opens the proof (a finding, the live checks, a run report, the
evidence packs, the load page). Clicking a calendar day explains that milestone. Sign-off buttons
record who agreed.

**Data.** Live: criteria 1, 2, 3, 4 and 6 read findings, checks, runs and packs. Written content:
the close calendar milestones and the release id.

**Journey step** 8 · **Requirement** CORE-05.

**Say this.** *"Nobody has to argue about whether we are ready. Six conditions, each one computed,
each one clickable."*

---

#### Tab 3 — Month-End Load (`/load`)

**Purpose.** Push the month-end volume through every interface and find out which one bends first.

**On the screen.** Profile chooser (Normal day 40 users · Month-end peak 150 · 2× 80 · 5× 200 ·
Custom) → KPI tiles (virtual users, transactions per minute, average response, slowest 5 %, error
rate, interfaces that break) → four charts (response time, transactions per minute, error rate,
backlog per interface) → **Interface by interface** table (per minute, per second, average, slowest
5 %, errors, backlog, capacity used, status) → **Result against the targets** → **Last load tests**
→ **A month-end day, hour by hour**.

**Targets.** Slowest 5 % under 2 s · errors under 1 % · no documents lost · backlog cleared within
15 minutes.

**Buttons.** *Run the load test* (about 20 seconds of live charting) · *Print* · any interface row
opens what it means for the plant if that one gives way.

**Data.** Modelled, and labelled as such: a capacity model per interface. The hour-by-hour profile
is labelled *Illustrative*. The interface list itself is real.

**Journey step** 8 · **Requirement** ADV-02 (performance and load).

**Say this.** *"At five times volume, invoice capture is the one that gives way — and that is
exactly where the two invoices go missing at the cut-off."*

---

#### Tab 4 — Impact Simulator (`/simulator`)

**Purpose.** If we ship this, what breaks in the plant?

**On the screen.** Pick the whole release or individual changes → **Working it out** (map the
change, walk the workflows, score the risk) → verdict → **Effect on confidence** (score today vs
score if it shipped) → tiles (changes, systems changed, systems downstream, workflows touched) →
**Which systems feel it** → **Where it lands in the workflows** → one card per change with what
stops and a timed recommendation.

**Buttons.** *Simulate* runs the three steps with a live log. Each change card links to the change.

**Data.** The change list is written content (6 changes). The confidence comparison uses the live
score and the same maths as the gauge.

**Journey step** 7 · **Requirement** CORE-04.

**Say this.** *"The verdict carries a number, not an adjective: the score today against the score
if this shipped."*

---

#### Tab 5 — Framework & Pod (`/offer`)

**Purpose.** What is being offered — a framework plus a team, not a licence.

**On the screen.** **The framework in five steps** (Learn → Build → Run → Watch → Prove), each with
a **See it** button into the working screen → **The pod** (Pod lead · SAP and D365 test specialists
· Automation engineers · AI agent engineer; *Pod size is set per phase*) → **What we commit to**
(badge *Targets to agree*) → **Expected benefits** (badge *Illustrative*) → **How we start**
(Pilot 6 weeks → Extend → Run) → **A tool demo, against a framework and a pod**.

**What we commit to** — today's value is live where the factory already measures it:

| Commitment | Where it stands today | Live? |
|---|---|---|
| A full re-test inside 1 day of a change being ready | About 3 weeks of key-user testing | illustrative |
| 100 % of the main workflows automated within 12 weeks | the share of the six workflows that have scenarios | **live** |
| An evidence pack sealed for every release | the number of packs sealed and locked | **live** |
| Month-end freeze down from 10 days to 3 | the days on the current close calendar | **live** |
| Key-user manual testing hours cut by three quarters | around 160 hours a release | illustrative |

**Buttons.** *Open the Testing Journey* · five *See it* buttons · *Walk the journey*.

**Journey step** all eight · **Requirement** the whole set.

**Say this.** *"Everything on this page is already working in this demo. The confidence score was
produced by the running plant, not written into a slide."*

---

### OVERVIEW · Enterprise Map (`/landscape`)

**Purpose.** The whole landscape on one picture, coloured by health.

**On the screen.** Four tiles (systems and services, interfaces, records held, systems with failing
records) → **The landscape** map in three bands, with the four outside services drawn as small
dashed nodes in the finance band → **Every interface** table → **Write a rule in plain English**,
which turns a sentence into a query, runs it against live data and shows the rows.

**Buttons.** Click a system → its tables and record counts. Click an interface → its traffic.
*Run the rule* → the query and the rows it compared.

**Data.** The landscape is fixed reference data. The record counts, the red borders and the rule
results are live.

**Journey step** 6 · **Requirement** ADV-01.

**Say this.** *"Ten systems, four outside services, nineteen links. The red borders are live — that
system has records a check disagrees with right now."*

---

### OVERVIEW · Testing Journey (`/journey`)

**Purpose.** The whole testing process as eight clear steps. The page to open first.

**On the screen.** **Your requirements and where they are covered** (ten chips, CORE-01 to ADV-04;
pick one and the steps that cover it light up) → the eight-step strip → the selected step card
(what goes in → what the AI does → what comes out, who checks it, *today* against *with the
factory*, the requirement chips with one sentence each) → **Follow one truck through the journey**:
the most recent steel truck in the running plant, pinned, with where it has got to.

**Buttons**

| Button | What it does |
|---|---|
| Play the journey / Pause | Walks all eight steps with a live log |
| Open this step | Goes to the screen where that step really happens |
| Open this step in the app · *name* | The same, named |
| A requirement chip | Highlights the steps covering it and links to the screen that proves it |
| The pinned truck | Stays pinned in the address bar (`?truck=GP-…`), so a refresh keeps it |

**Data.** The eight steps and the requirement wording are written content. The truck is live.

**Say this.** *"This is the whole programme on one page. Every step opens the screen that does it."*

---

### OVERVIEW · Process Ontology

#### Tab 1 — Workflows (`/ontology`)

**Purpose.** Every workflow written down once: who does it, in which system, against which rule,
proven by which test.

**On the screen.** Workflow chips (P1 to P6) → **Stage by stage** table (who, the three procedure
steps, system, data, rule tested, AI agents, tests, and the live row count for that stage's tables)
→ **Ontology graph** (workflow → stages → systems → business data → AI agents).

**Buttons.** Click a stage → its rule, its agents, its live data and the open findings against it.

**Data.** The model is written content. Every row count is live.

**Journey step** 2 and 3 · **Requirement** CORE-01.

**Say this.** *"This is the single source of truth the scripts are written from. The counts beside
each stage are today's real volume."*

#### Tab 2 — AI Agents (`/ontology/agents`)

Eleven agents in three groups (Build, Run, Govern). Each one says what it reads, what it produces
and which screen shows it. Clicking an agent opens that screen. See section 12.

#### Tab 3 — Requirement Coverage (`/coverage`)

The client's ten requirements — **CORE-01 to CORE-06** and **ADV-01 to ADV-04** — read from the
same source as the Testing Journey chips. Each card shows the id, Core or Advanced, the short name,
the client's own wording, the journey steps that cover it, and the screens that prove it. Four
tiles above: requirements, core, advanced, and how many are covered by a journey step.

---

### BUILD · Process Discovery

#### Tab 1 — Inputs (`/discovery`)

**Purpose.** Before a single test is written, learn how the plant actually works.

**On the screen.** **What happens on this page** — a clickable diagram: three inputs → the agent's
four steps → a process map → **The three inputs**: 6 recorded key-user sessions (123 clicks), the
live plant log, 4 written procedures (SOP-114 gate and weighbridge, SOP-121 invoice capture and
matching, SOP-203 sortation and grading, SOP-240 laboratory release) → four tiles → **The
recordings** table → **What "Discover the process" will do** → the **Discovery agent** log once it
runs → **The map is drawn** with two buttons.

**Buttons.** *Discover the process* runs the agent. Each input box opens the material behind it:
all six recordings with why each was requested and what it showed, the live log, the four
procedures in full.

**Data.** The recordings and procedures are written content. The plant log and the counts are live.

**Journey step** 1 · **Requirement** CORE-01.

**Say this.** *"Nobody was interviewed. This is what the systems and the recordings already knew."*

#### Tab 2 — Process map (`/discovery/map`)

**Purpose.** The map the factory drew, for the key users to correct.

**On the screen.** Four tiles (stages, rework loops, corrections from key users, map version) →
**The process it found**: boxes left to right, every arrow carrying the number of cases that made
that move in the last 24 hours, the clean path in green, rework loops curving back underneath in
red with what they cost a day → **the Map agent log** once feedback is applied → **What the key
users said** (the feedback list) → **Where each stage came from** → **Activities it recognised** →
**Rework loops**.

**Feedback.** Press any box, arrow or loop. The panel offers **Correct**, **Not right** with a
reason (Wrong order · Missing step · Not a real step · Wrong system · Other) and a comment, or
**Add a comment**. Every correction shows as Open, Applied or Dismissed.

**Buttons**

| Button | What it does |
|---|---|
| Generate scenarios | Opens Test Studio with this map's version named |
| Apply feedback | Redraws the map as version 2 and marks every open correction as applied |
| Compare with version 1 | Shows the old map beside it with the three corrections listed |
| Dismiss | Leaves the map as it is |
| Run discovery (empty state) | Runs the agent first |

**Data.** The map shape and the three seeded corrections are written content. Every arrow count,
every loop count and every daily cost is live.

**Journey step** 2 · **Requirement** CORE-01.

**Say this.** *"Three corrections from your own people, applied in one click, and the scenarios
then say they came from version 2."*

#### Tab 3 — Procedure vs reality (`/discovery/compare`)

**Purpose.** What the written procedure promises, against what the systems actually did.

**On the screen.** Four tiles → **What the procedure says, against what the systems actually did**
(five written rules turned into queries and run against the last 24 hours, each with a Followed /
Not followed verdict) → **How often it runs clean** (straight through, invoice parked, chemistry
incomplete).

**Buttons.** Each rule row opens the live data behind the verdict.

**Journey step** 1 · **Requirement** CORE-01.

**Say this.** *"The procedure is not wrong because somebody says so. It is wrong because the data
says so."*

---

### BUILD · Test Studio

#### Tab 1 — Scenarios (`/studio`)

**Purpose.** Scenarios written from the ontology and the live data, then approved by a key user.

**On the screen.** Workflow chips → the **Scenario Writer agent** log (badged *Based on process map
v1* or *v2*) → four tiles (scenarios for this workflow, approved, pending approval, failing last
run) → **Turn a business rule into a data check** → the scenario list by type (Positive, Negative,
Regression).

**Buttons.** *Generate scenarios with AI* writes three new ones, pending approval. A scenario row
opens its steps in business language with the technical detail behind a toggle. *Approve* / *Reject*.

**Data.** Thirty written scenarios plus anything generated or recorded in the session. The counts
are live.

**Journey step** 3 · **Requirements** CORE-01, CORE-02, CORE-03, CORE-04.

**Say this.** *"Positive, negative and re-test, written from the approved map — and nothing runs
until a key user says yes."*

#### Tab 2 — Test Data (`/test-data`)

**Purpose.** Linked records that are safe to use.

**On the screen.** The **Test Data agent** log → **Generated records**: a purchase order arrives
with its vendor and material, a scrap batch with its chemistry, all linked to each other, with no
real personal data.

**Buttons.** *Generate linked records* then *Load into the test environment*.

**Journey step** 4 · **Requirement** CORE-06.

**Say this.** *"Not a spreadsheet of test values — records that point at each other, so a scenario
can actually run."*

#### Tab 3 — Master Data Check (`/studio/master-data`)

**Purpose.** Bad master data makes a good test fail for the wrong reason. This finds it first.

**On the screen.** Empty state until you scan → the **Master Data agent** log → four tiles (records
scanned, clean %, high risk, clean copies prepared) → **Problems by type** → **What the scan found**.

**What is live.** The vehicle master is compared against the last weighings on the weighbridge.
Anything more than 500 kg out is listed with the drift and the fix. Four authored problems (a
vendor with no VAT number, a closed purchase order still receiving, a duplicate vendor, a material
with no grade window or unit) are marked **sample**.

**Buttons.** *Scan master data* · *Use clean copy* (prepares a clean record for the test
environment without touching the real one) · *Raise finding*.

**Journey step** 4 · **Requirement** CORE-06.

**Say this.** *"Half of all test failures are bad master data. We find them before the run, not
during it."*

#### Tab 4 — Record (`/studio/record`)

**Purpose.** Watch a key user do the work once; the AI turns that into a test.

**On the screen.** Workflow and system choosers → the live capture (every click with the screen it
touched, including the two pauses and the two mis-clicks) → the **Scenario Writer agent** log →
the before-and-after summary (14 recorded actions → 8 test steps, 4 pauses and mis-clicks removed,
2 checks added) → the **Recordings** table.

**Buttons.** *Start recording* / *Stop recording* · *Turn into a test with AI* · *Open SC-040 in
Scenarios* · *Play back in the Run Centre*.

**Journey step** 3 · **Requirement** CORE-01.

**Say this.** *"Your key user works once. The factory keeps the clicks, drops the mistakes and
writes the test."*

---

### RUN · Live Data Flow

#### Tab 1 — Live Flow (`/flow`)

**Purpose.** Watch the plant run and the data move.

**On the screen.** Run/pause, speed chips (1×, 4×, 10×, 30×), *Send a truck*, *Send a wagon*,
*Skip one hour*, *Replay 8 hours* → six tiles → **How the data moves** (the map with moving dots)
→ **What can go wrong** (the ten fault switches with hit counts) → **What just happened** (the
plain-language event stream) → **Last messages**.

**Buttons.** Every dot opens that message's payload. Every fault switch turns a fault on or off.
*All faults on* / *All faults off*.

**Data.** All live.

**Journey step** 6 · **Requirement** ADV-01.

**Say this.** *"Each dot is a real message, drawn at its real position between sending and
arrival."*

#### Tab 2 — System Data (`/flow/data`)

**Purpose.** The actual tables behind each system.

**On the screen.** A system chooser, a table chooser, and the rows. Red rows are the ones a live
check disagrees with.

**Buttons.** Pick a system, pick a table, click a row to follow it in Trace.

**Say this.** *"This is not a report about the data. This is the data."*

#### Tab 3 — Live Checks (`/flow/checks`)

**Purpose.** Business rules run against the real data in every system.

**On the screen.** A *Re-check as data arrives* switch → **How a live check works** → the list of
checks with pass/fail, records compared and records that disagree → an open check shows its
business sentence, its SQL, its columns and every failing row with the cause in plain words.

**Buttons.** *Run all checks now* · **Raise finding** (creates a real finding with the rows as
evidence) · **Fix the cause and replay** (turns off the faults behind that check, replays eight
hours, and the check turns green) · **Follow this load through every system**.

**Journey step** 6 · **Requirement** ADV-01.

**Say this.** *"Press Fix the cause and replay. Nothing in the check changed — the data did."*

#### Tab 4 — Trace (`/flow/trace`)

**Purpose.** Start from anything and follow it through every system it touched.

**On the screen.** A search box with suggested references → the verdict line → **Record by record**
in the order they happened, every field shown, the wrong ones flagged → the messages that carried
it.

**Buttons.** Paste or click a reference. Each record links to its table.

**Say this.** *"One reference, every system, in order, with the field that changed highlighted."*

---

### RUN · Run Centre

#### Tab 1 — Runs (`/run`)

**Purpose.** Run scenarios step by step and keep the evidence.

**On the screen.** Speed chips (1×, 2×, 4×) → the live run card with the workflow strip lighting up
→ tiles (passed, failed, healed, verdict) → each step with its **drawn screenshot** of the screen
it touched and its own log lines → **Choose what to run** (filtered by workflow, by type and by the
project in the header) → **Findings**.

**What happens in the demo run.** Ten steps. One step self-heals. One negative step is blocked as
expected and counts as a pass. One data check fails and raises finding **F-001**. The run ends
**CONDITIONAL** with an evidence pack.

**Buttons.** *Run the P1 demo now* · click a step screenshot to enlarge it, with Previous/Next ·
*Open the finding* · severity chips on the findings list.

**Journey step** 5 · **Requirements** CORE-02, CORE-03, CORE-05.

**Say this.** *"Every step keeps a picture of the screen it touched and its own log. That is what
goes into the evidence pack."*

#### Tab 2 — Schedules (`/run/schedules`)

**Purpose.** Tests do not wait to be asked.

**On the screen.** Four tiles (schedules switched on, next run, failing last time, reports sent) →
**Schedules** table → **Next three runs** → **Reports sent**.

**The five seeded schedules**

| Id | Name | What it runs | When | Project |
|---|---|---|---|---|
| SCH-01 | Nightly regression | Every approved scenario in every workflow | Nightly at 02:00 | All projects |
| SCH-02 | SAP transport check | Gate to invoice, plus the finance links | After every SAP transport | SAP release Nov |
| SCH-03 | Recycling smoke test | Scrap to stock, quality orders and yard transfers | After every D365 update | D365 recycling update |
| SCH-04 | Month-end readiness | The close checklist and the month-end load profile | Before the month-end close | All projects |
| SCH-05 | Yard app weekly | Gate, weighbridge and mill confirmation | Weekly on Sunday | Yard app release |

**Buttons.** *New schedule* (name, what it runs, when, project, scenarios) · the on/off switch ·
**Run now**, which starts a real run in the Run Centre, records the verdict against the schedule and
sends the report to the people named on it, with a link.

**Journey step** 5 · **Requirement** CORE-04.

**Say this.** *"Nightly, after every transport, after every D365 update, before the close. The
report arrives without anyone asking for it."*

#### Tab 3 — Evidence & Reports (`/evidence`)

**Purpose.** Every run can be locked into a hashed bundle.

**On the screen.** Four tiles → **Locked evidence packs** (each with a tamper-proof fingerprint and
who signed it) → **All runs**.

**Buttons.** Open a pack → what is inside, the integrity hash, and every step with its screenshot
and log. Open a run → the run summary report. Both print cleanly.

**Journey step** 8 · **Requirement** CORE-05.

**Say this.** *"The hash covers every item in the pack. Change one thing and the hash changes, so
an auditor can see it was not touched."*

---

### RUN · Interface Testing (`/interfaces`)

**Purpose.** Every handoff between two systems, field by field.

**On the screen.** Two explainer cards (journey testing vs interface testing) → the **filter bar**
→ six tiles (sent, received, matched, mismatched, missing, duplicated) → the interface table → an
open interface shows its messages, newest first, with travel time and status.

**The filter bar** narrows everything below it at once — the tiles, the table, the records list and
*Follow the truck*:

| Filter | Options |
|---|---|
| Search | interface, system or field name |
| Source system / Target system | any system in the landscape |
| Business process | P1 to P6 |
| Status chips | Matched · Mismatched · Missing · Duplicated |
| Health | Clean · Problems · No traffic |
| Type | Shop-floor · Financial |
| Format | IDoc · API · File |
| Time window | Last 24 hours · Last 4 hours · Last hour · Last 15 minutes |
| Only live | switch |

Active filters appear as removable chips with **Clear all**, the header says *Showing X of Y
interfaces*, and the whole filter state is kept in the address bar so a filtered view can be shared
as a link. If nothing matches, the empty state offers **Clear filters**.

**Buttons.** *Follow the truck* (follows the newest record still inside the filter) · *Watch it
live* · click a message → the field-by-field comparison, sent against stored, with the damaged
fields in red, plus the raw payload.

**Journey step** 6 · **Requirement** ADV-01.

**Say this.** *"Filter to financial API traffic in the last hour. Three messages mismatched — and
here is the field that changed."*

---

### RUN · Change & Regression

#### Tab 1 — Change Impact (`/regression`)

**Purpose.** What a change touches, and what to do about it.

**On the screen.** **Change feed** (six changes with risk dials, following the project in the
header) → the selected change told as *what changed → what could go wrong → what we do*, plus a
business line → **Where the change hits your workflows** → **Regression: before the change and
after**.

**Buttons.** Pick a change · *Run regression* compares the same scenarios against the last good run
(baseline) and the changed build.

**Journey step** 7 · **Requirement** CORE-04.

**Say this.** *"CH-204 is the weighbridge change. This is exactly which tests have to run again, and
nothing else."*

#### Tab 2 — Self-Healing (`/self-healing`)

**Purpose.** When a change breaks a step, the agent proposes a repair and a key user decides.

**On the screen.** Four tiles (repairs proposed, pending, approved, average confidence) →
**Repairs**, newest first → an open repair shows the before and after, side by side, with a
confidence score.

**Buttons.** *Approve the repair* · *Reject*.

**Journey step** 5 and 7 · **Requirement** CORE-04.

**Say this.** *"The script repaired itself, but it still needs a human yes. 96 % confident is not
the same as allowed."*

#### Tab 3 — Migration Reconciliation (`/reconciliation`)

**Purpose.** Source against target, row counts and totals, every difference explained.

**On the screen.** Four comparison sets → tiles (source rows, target rows, source total, target
total) → **Row sample** → **Differences explained**, grouped by cause → **Systems compared**.

| Set | Source → target |
|---|---|
| RS-01 | Legacy ERP extract → SAP S/4HANA – Steel (open purchase orders) |
| RS-02 | Scrap Yard Operations → D365 F&O – Recycling (batches against stock) — reads live plant data |
| RS-03 | Legacy ERP extract → SAP S/4HANA – Steel (vendor master) |
| RS-04 | SAP S/4HANA – Steel → Reval (open invoices against payments) — reads live plant data |

**Journey step** 6 · **Requirement** ADV-04.

**Say this.** *"Not 'the totals differ by 4 200'. Every difference grouped by cause, down to the
field."*

---

### GOVERN · Approvals (`/approvals`)

**Purpose.** Nothing the AI produces goes live without a key user saying yes.

**On the screen.** Four tiles → **Waiting for you** → **Already decided**.

**Buttons.** *Approve* and *Reject*, each with a comment box. Empty state when the queue is clear.

**Journey step** 2, 3 and 8 · **Requirement** CORE-01, CORE-05.

**Say this.** *"This is the control. The AI proposes; your key user disposes."*

---

### GOVERN · Roles & SoD (`/access-sod`)

**Purpose.** Segregation of duty (conflicting access) is not a document here. It is tested.

**On the screen.** Four tiles (rules, users in conflict, open conflicts, proven by a run) →
**Conflict matrix** (a cross means the two roles must never be held by the same person) → **The
rules** (SOD-01 to SOD-05) → **Users in conflict**.

| Id | Rule | Risk |
|---|---|---|
| SOD-01 | Create and approve a purchase order | High |
| SOD-02 | Post a goods receipt and post the invoice | High |
| SOD-03 | Maintain the vendor master and run payments | High |
| SOD-04 | Change the weighbridge tare and release a ticket | Medium |
| SOD-05 | Release a laboratory result and sort batches | Medium |

**Buttons.** **Prove it** actually attempts the forbidden action in the test environment, captures
what happened, and offers *Raise it as a finding with this evidence*.

**Journey step** 8 · **Requirement** ADV-03.

**Say this.** *"We did not read the role matrix. We tried the forbidden action, and the system let
us."*

---

### GOVERN · Connected Systems (`/systems`)

**Purpose.** Every connection, its service account and its sync status.

**On the screen.** Four tiles (connections, connected, degraded, pending) → the connection table
with type, method, endpoint, service account, response time and last sync.

**Buttons.** *Test* and *Sync* per connection · **Add a connection** (read-only credentials only;
the vault reference is stored, never the secret).

**Say this.** *"Every connection is read only. The factory observes the landscape; it never writes
to production."*

---

### Report pages (no menu, no shell)

| Route | What it is |
|---|---|
| `/finding/:id` | One finding: what is wrong, the records affected, the evidence, what now |
| `/report/:runId` | Run summary: result, workflow coverage, scenarios, findings raised |
| `/release-report/:id` | Release report: changes, blockers, recommendation |
| `/evidence-pack/:runId` | Evidence pack: integrity hash, what is inside, every step with its screenshot and log |
| `/kitchen-sink` | The design system, reachable from the command palette only |

All four reports have a print button and come out clean on paper from either theme.

---

## 11. Requirement coverage

The ten requirements as the client wrote them, where they are covered, and the exact click that
proves each one. The chips are on the **Testing Journey** page.

| Id | The client's wording | Journey step | Screen | The click that proves it | Say this |
|---|---|---|---|---|---|
| **CORE-01** | AI writes test scripts from process discovery | 1, 2, 3 | Process Discovery → Process map, then Test Studio | On the map press a box → *Not right* → *Apply feedback* → **Generate scenarios** | *"The script came from the map your own people corrected."* |
| **CORE-02** | The normal journey works | 3, 5 | Run Centre | *Run the P1 demo now* and watch the workflow strip light up | *"Every stage it proves lights up as it passes."* |
| **CORE-03** | Wrong actions are blocked | 3, 5 | Run Centre | In the run, step 7 is refused — and counts as a pass | *"A step the system correctly refuses is a passing test."* |
| **CORE-04** | Re-test after every change | 3, 7 | Change & Regression, and Run Centre → Schedules | *Run regression* on CH-204; then *Run now* on SCH-02 | *"Only the affected tests run again, against the last good run."* |
| **CORE-05** | Logs, step evidence, audit-ready reports | 5, 8 | Evidence & Reports | Open a pack → every step with its screenshot and log, under one hash | *"Sealed as the run finishes, not gathered afterwards."* |
| **CORE-06** | AI creates the test data | 4 | Test Studio → Master Data Check, then Test Data | *Scan master data* → *Use clean copy* → *Generate linked records* | *"Bad master data found first, then clean linked records with no personal data."* |
| **ADV-01** | Cross-system integration and API testing | 6 | Interface Testing (also Live Checks) | Filter to Financial + API → open a mismatched message → field by field | *"One message, two systems, every field compared."* |
| **ADV-02** | Performance and load testing (month-end peak) | 8 | Command Centre → Month-End Load | Pick 5× → *Run the load test* → read the interface that breaks | *"Invoice capture gives way at three times volume."* |
| **ADV-03** | Security and roles (segregation of duty) | 8 | Roles & SoD | **Prove it** on an open conflict → *Raise it as a finding* | *"We attempted the forbidden action for real."* |
| **ADV-04** | Data migration reconciliation | 6 | Change & Regression → Migration Reconciliation | Open RS-02 → **Differences explained** | *"Every difference grouped by cause, down to the field."* |

The same ten requirements are listed on **Process Ontology → Requirement Coverage**, read from the
same source (`src/data/journey.ts`), so that tab and the Testing Journey can never disagree.

---

## 12. The AI agents

Eleven agents, on **Process Ontology → AI Agents** (`/ontology/agents`).

| Id | Agent | Group | Reads | Produces | Screen |
|---|---|---|---|---|---|
| A1 | **Discovery** | Build | Recorded key-user sessions and system logs | A process map with rework loops | Process Discovery (`/discovery`) |
| A2 | **Scenario Writer** | Build | The process map and business rules | Positive, negative and regression scenarios | Test Studio (`/studio`) |
| A3 | **Test Data** | Build | Entity definitions and linked master data | Linked test records with no personal data | Test Data (`/test-data`) |
| A4 | **Execution** | Run | Approved scenarios | Run results with evidence per step | Run Centre (`/run`) |
| A5 | **Interface Watch** | Run | Messages on every interface | Field-by-field mismatches and missing messages | Interface Testing (`/interfaces`) |
| A6 | **Reconciliation** | Run | Source and target data sets | Explained difference groups | Migration Reconciliation (`/reconciliation`) |
| A7 | **Self-Healing** | Run | Failing steps and the change feed | Repaired selectors and field names | Self-Healing (`/self-healing`) |
| A8 | **Change Impact** | Run | Transports, releases and the code graph | Which workflows a change hits | Change Impact (`/regression`) |
| A9 | **Load** | Run | Month-end volume profiles | Throughput, slowest 5 % and backlog curves | Month-End Load (`/load`) |
| A10 | **Access** | Govern | Roles, rules and user assignments | Segregation of duty conflicts with proof | Roles & SoD (`/access-sod`) |
| A11 | **Evidence** | Govern | Run results and approvals | Locked, hashed evidence packs | Evidence & Reports (`/evidence`) |

Two more agents appear by name on their own screens: the **Master Data agent** on Test Studio →
Master Data Check, and the **Map agent** that redraws the process map when key-user feedback is
applied.

---

## 13. Roles

Switch role in the header. The menu and the landing page change with it.

| Role | Sees | Lands on | Can change things? |
|---|---|---|---|
| **Key User** | Everything, including Approvals, Roles & SoD and Connected Systems | Command Centre → Health (`/`) | Yes — approves everything |
| **QA Lead** | Everything except the governance pages (Approvals, Roles & SoD, Connected Systems) | Run Centre (`/run`) | Yes |
| **Plant Head** | Business view of risk and readiness; no Process Discovery, no Test Studio, no Approvals | Impact Simulator (`/simulator`) | **Read only** |
| **Auditor** | Evidence, access control, the maps and the checks; no Discovery, no Studio, no Approvals | Evidence & Reports (`/evidence`) | **Read only** |

Opening a hidden page by URL shows a friendly panel, not a blank screen. A read-only role that
presses *Run* gets a short explanation instead of a dead click.

---

## 14. Demo scripts

### 14.1 Before the call — 3 minutes of setup

1. `npm run dev`, open the app, and let the plant run for a minute so the tables are full.
2. Press <kbd>Ctrl</kbd>+<kbd>K</kbd>, type **faults on**, choose *Turn all faults on*. The demo
   needs broken data to be interesting.
3. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> → *Run all checks now*, and confirm 4 or 5 of 14 pass.
4. Set the theme deliberately: <kbd>Shift</kbd>+<kbd>D</kbd> cycles light → dark → follow the
   system. Dark looks better on a projector; light prints better.
5. Zoom the browser to 100 % at 1920 wide, or 90 % at 1366. Both layouts are built for it.
6. Check the role is **Key User** (top right) and the project filter is **All projects**.
7. Have one failing gate pass copied ready, from Live Checks → C1.

### 14.2 The 15-minute run sheet

| Time | Screen | Click | Say |
|---|---|---|---|
| 0:00 | **Testing Journey** (`/journey`) | *Play the journey* | *"Eight steps, from how your people work today to a release you can trust. Every step opens the screen that does it."* |
| 1:30 | **Command Centre → Health** (`/`) | Point at the gauge, then **What to do next** | *"One number, four inputs, and the four actions ranked by the points each would add."* |
| 3:00 | Same page | The **Projects** card | *"Three change projects at once. Pick one and the whole factory follows it."* |
| 4:00 | **Process Discovery → Process map** | Press a box → *Not right* → *Wrong system* → *Apply feedback* | *"Your key user corrects the map on screen. Version 2 is what the scripts come from."* |
| 5:30 | **Live Data Flow → Live Flow** | *Run the plant*, point at the dots | *"Each dot is a real message, at its real position between sending and arrival."* |
| 7:00 | **Live Data Flow → Live Checks** | Open **C1**, read the cause, press **Fix the cause and replay** | *"Nothing in the check changed. The data changed."* |
| 8:30 | **Trace** | Paste the failing gate pass | *"One reference, every system, in order, with the field that changed."* |
| 10:00 | **Run Centre** | *Run the P1 demo now* | *"One step heals itself, one wrong action is correctly refused, one data check fails and raises a finding."* |
| 11:30 | **Run Centre → Schedules** | *Run now* on SCH-02 | *"Nightly, after every transport, before the close. The report arrives on its own."* |
| 12:30 | **Interface Testing** | Filter Financial + API, open a mismatched message | *"One message, two systems, every field compared."* |
| 13:30 | **Month-End Load** | Pick 5× → *Run the load test* | *"Invoice capture gives way first, which is exactly where the two invoices are lost at the cut-off."* |
| 14:30 | **Release & Close** | Read the six exit criteria | *"Nobody has to argue about readiness. Six conditions, each computed, each clickable."* |
| 15:00 | **Framework & Pod** | The five steps and the pod | *"Not just a tool. A framework and a team that owns the result."* |

### 14.3 The 3-minute version

| Time | Screen | Click | Say |
|---|---|---|---|
| 0:00 | **Command Centre → Health** | Point at the gauge | *"One number for the whole landscape, live."* |
| 0:40 | **Live Checks** | Open C1, read the cause | *"A kilogram sent as a tonne. Found at 09:52, before the invoice at 11:11."* |
| 1:30 | **Fix the cause and replay** | Watch it turn green | *"The failure is in the data, not in the slide."* |
| 2:10 | **Run Centre** | The last run's steps with screenshots | *"Every step keeps a picture and a log. That is the evidence pack."* |
| 2:40 | **Release & Close** | The gate decision | *"GO, CONDITIONAL or NO-GO, with six computed reasons."* |

### 14.4 If something drifts

| Problem | Recovery |
|---|---|
| Every check is green and the demo looks dull | <kbd>Ctrl</kbd>+<kbd>K</kbd> → *Turn all faults on*, then *Replay eight hours* |
| Too few records on screen | <kbd>Ctrl</kbd>+<kbd>K</kbd> → *Replay eight hours*, or *Skip one hour* |
| The plant is running too fast to narrate | Speed chip **1×**, or *Pause the plant* |
| A screen looks empty | Check the project filter in the header — set it back to **All projects** |
| You cannot find a page | <kbd>Ctrl</kbd>+<kbd>K</kbd> reaches every page, system, interface, scenario and finding |
| A button says the view is read only | The role is Plant Head or Auditor. Switch to Key User |
| You need a clean start | <kbd>Ctrl</kbd>+<kbd>K</kbd> → *Replay eight hours*; the same seed gives the same data every time |

---

## 15. Questions the client will ask, and honest answers

**1. Is this connected to our systems?**
No. Not today. Everything you see is a simulated plant running in the browser — no backend, no
production data. In a pilot we connect to your **TEST** systems with read-only service accounts.

**2. Are the failures fake?**
No. The records are produced by a simulation, and ten fault switches damage some of them in
transit. The checks then find the damage by comparing systems. Turn the faults off, replay, and
every check turns green. It is provable from the command line in a few seconds.

**3. So the data is fake, but the logic is real?**
Yes, and that is the honest split. The comparison logic, the scoring, the trace and the gate
decision are real code. The records they run over are simulated until we connect to your TEST
systems.

**4. How are test scripts created?**
Three ways, all shown: from the discovered process map (Process Discovery → Test Studio), from a
recording of a key user working once (Test Studio → Record), and from a business rule typed in
plain English (Test Studio, and Enterprise Map). A key user approves every one before it runs.

**5. What happens when a screen or a field changes?**
The step fails, and the Self-Healing agent proposes a repair with a confidence score — for example
`chemistry.mo_pct` → `chemistry.molybdenum_pct ?? chemistry.mo_pct` at 96 %. A key user approves or
rejects it. Nothing self-heals silently.

**6. Tonnes versus kilograms — is that really a problem?**
It is the one we see most. The recycling yard weighs in tonnes, D365 holds kilograms. If the
× 1 000 step is skipped, stock reads 42.26 KG instead of 42 260 KG, and the melt shop has issued
more than exists. Three checks catch it (C6, C6b, C12), and each one names the batch.

**7. Do you really keep a screenshot of every step?**
Yes. Every run step keeps a drawn picture of the screen it touched and its own log lines, and both
go into the evidence pack. Open the pack and scroll — the pictures are there.

**8. Can the tests run without anyone starting them?**
Yes. Run Centre → Schedules: nightly at 02:00, after every SAP transport, after every D365 update,
before the month-end close, and weekly. The report is sent to the people named on the schedule with
a link to the run.

**9. We have several projects running at once. Does that work?**
Yes. Pick a project in the header — SAP release Nov, D365 recycling update, Yard app release — and
the scenarios, runs, changes, findings and schedules all follow it. The choice is kept in the
address bar, so a filtered view can be shared as a link.

**10. Does it cover finance, or only the shop floor?**
Both. VAT validation, sanctions screening, the eBanking gateway and the daily exchange-rate file
are all modelled as interfaces (IF-15 to IF-18), with two compliance checks: every vendor paid was
screened against that day's list (C10), and every foreign-currency invoice used that day's rate
(C11).

**11. What about load testing at month-end?**
Month-End Load pushes a chosen volume (40 to 500 virtual users) through every live interface
against a capacity model, and reports the slowest 5 %, the error rate, the backlog and the one
interface that gives way first. The model is labelled as modelled; the interfaces are real.

**12. Is our data safe?**
Three answers. Today there is no connection at all. In a pilot, every connection is **read only**,
and the vault reference is stored, never the secret. And the generated test data carries no real
personal data — that is the whole point of the Test Data agent.

**13. How are you different from a test tool vendor?**
A tool gives you a licence and the work of running it. We give you the framework **and** the pod
that owns the result. There is a table on Command Centre → Framework & Pod that answers this in
five rows: who writes the tests, who keeps them working, what happens when one fails, what an
auditor gets, and what you are actually buying.

**14. How long before we see something real?**
Six weeks. The pilot takes one workflow end to end — gate to invoice — through discovery,
scenarios, test data, runs, live checks and one evidence pack, and measures the re-test time.
Weeks 7 to 12 extend it to the remaining main processes.

**15. What does it save?**
The targets we are asking you to agree: a full re-test inside 1 day instead of about three weeks;
100 % of the main workflows automated within 12 weeks; an evidence pack every release; the
month-end freeze down from 10 days to 3; key-user manual testing hours cut by about three quarters.
They are labelled *Targets to agree* on screen, and where the factory already measures something,
today's value is shown live beside it.

**16. Who approves what the AI produces?**
A key user, every time. Scenarios arrive *Pending approval*. Self-healing repairs wait for a yes.
The release gate needs sign-off. The Approvals page is that queue.

**17. Can an auditor trust the evidence?**
The pack carries a tamper-proof fingerprint (hash) over every item in it. Change one line and the
fingerprint changes. The Auditor role can open everything and change nothing.

**18. What if our process is not what the map says?**
That is step 2 and it is built in. On the process map a key user presses any box, arrow or loop and
says Correct, or Not right with a reason — wrong order, missing step, not a real step, wrong
system. Apply feedback redraws the map as version 2, and the scenarios then say which version they
came from.

**19. Does it need our people full time?**
No. The pod does the building. Your key users are needed to correct the map once, approve the
scenarios, and sign off the gate.

**20. What happens to the simulator in a real pilot?**
It is replaced by a connector that fills the same tables from your TEST systems. The checks, the
trace, the scoring and every screen work unchanged, because they only ever read those tables.

---

## 16. What is live and what is written content

| Live — computed from the running simulation | Written content — authored for the demo |
|---|---|
| All 22 tables and every row in them | The 10 systems, 4 outside services, 19 interfaces and 6 workflows |
| The fourteen live checks, their rows and their causes | The ~30 scenarios and their steps |
| Trace, end to end, including the finance and quality records | The 6 changes, 7 self-healing events, 4 reconciliation sets, 5 SoD rules |
| Interface totals, filters and field-by-field comparisons | The 16 seeded findings (anything you raise is real) |
| The confidence score and all four of its inputs | The 6 Discovery recordings and the 4 written procedures |
| The release exit criteria | The 30-day trend, except today's point, which is live |
| Discovery's activity counts, arrow counts, procedure verdicts and rework cost | The month-end load capacity model and the hour-by-hour profile |
| The vehicle-master drift found by the Master Data Check | The 4 sample master-data problems, marked *sample* |
| Record counts per system, per interface and per workflow | The 6 historic runs and the 5 seeded schedules |
| Today's values on Framework & Pod marked *live* | The illustrative before/after benefit bars |

The AI output — discovery, scenario generation, impact analysis, self-healing, evidence — is
pre-written content revealed through a live log. Every score and every verdict is computed in code.
Nothing is random: the same seed gives the same plant every time.

### What changes in a real pilot

1. **Connect to TEST systems** with read-only service accounts, one per system, with the vault
   reference stored and never the secret.
2. **Replace the simulator** with a connector that fills the same tables and the same message list.
   Nothing above it has to change.
3. **Keep the checks, the trace and the scoring exactly as they are.** They only ever read the
   tables, so they work the moment real rows arrive.
4. **Re-point the interfaces** to the real middleware (EAI) queues and file drops.
5. **Re-measure the targets.** The commitments on Framework & Pod stop being illustrative and start
   being reported.

---

## 17. Glossary

| Plain meaning | Technical term |
|---|---|
| Weight of the lorry full | Gross weight |
| Weight of the lorry empty | Tare weight |
| Weight of the load | Net weight (gross − tare) |
| The empty weight stored on the vehicle record | Registered tare, `registered_tare_kg` |
| Permission slip for a lorry to enter the site | Gate pass, `gate_pass` |
| Delivery booked in SAP | Goods receipt, posted with MIGO, stored in `MSEG` |
| The booking's reference back to the gate | `xblnr` (the gate pass number) |
| Invoice record in SAP | `RBKP` |
| Purchase order line | `EKPO` |
| Production confirmation in SAP | `AFRU` |
| Invoice check: order vs delivery vs invoice | Three-way match |
| Invoice accepted and booked | Posted |
| Invoice held back for review | Parked |
| Supplier reference number on the purchase order | `ebeln` |
| Message format SAP uses between systems | IDoc |
| Web service call between systems | API, REST, OData |
| The middleware that moves messages | EAI / integration layer |
| The content of a message | Payload |
| One melt of steel | Heat |
| Judgement of a batch against its grade window | Quality order |
| The laboratory's measured values | Lab value table, `chemistry` (Ni, Cr, Mo) |
| Moving a batch between the two yards | Stock transfer, `transfer` |
| Taking material out of stock for the melt shop | Issue, `issue` |
| Document printed and archived | Output document, Lasernet |
| Supplier invoice the buyer raises on the supplier's behalf | Self-billing document |
| Test that the normal journey works | Positive test |
| Test that a wrong action is refused | Negative test |
| Re-test after a change | Regression test |
| The last known-good run to compare against | Baseline |
| A script repairing itself after a screen change | Self-healing |
| Records created so a test has something to run against | Test master data |
| Two jobs one person must never hold together | Segregation of duty (SoD) |
| Comparing two systems row by row | Reconciliation |
| Simulated people hitting the system at once | Virtual users |
| The response time 95 % of calls beat | p95, "slowest 5 %" |
| Transactions per minute | Throughput |
| Work waiting in a queue | Backlog |
| The sealed bundle an auditor reads | Evidence pack |
| Tamper-proof fingerprint over that bundle | Hash |
| The days when nothing may change before the close | Change freeze |
| Moving a change from one SAP system to the next | Transport |
| The go/no-go decision before a release | Release gate |
| How much of an interface's capacity is in use | Saturation |
| Time a record must reach before a check will judge it | Settle time |
| The same inputs always give the same output | Deterministic, seeded |
| Work that goes backwards and has to be redone | Rework loop |
| The strip under each card saying where the number came from | Provenance |

---

## 18. Counts shown on screen

Every count a screen states is now **computed from the data**, not typed into a string. Five
wordings that had fallen behind were fixed, and the Requirement Coverage tab was moved onto the
same source as the Testing Journey.

| Screen | Was | Now | Where the number comes from |
|---|---|---|---|
| Live Data Flow → Live Checks, subtitle | *"Nine rules … in all nine systems"* | *"14 rules … in all 13 systems"* | the checks that ran, and the systems that hold tables |
| Command Centre → Release & Close, Exit criteria | *"Five conditions … all five are met"* | *"6 conditions … all 6 are met"* | the length of the criteria list |
| Command Centre → Health, Month-end readiness | *"Freeze takes 10 days today"* | *"Freeze takes 8 days today"* | `freezeDays()`, the same close calendar that Framework & Pod reads |
| Live Data Flow → Live Flow, tiles | *"nine systems"*, *"across 9 live interfaces"* | *"13 systems"*, *"across 15 live interfaces"* | the systems with simulated data, and the interfaces marked live |
| Command Centre → Health, records card | *"Nine systems, measured…"* | *"13 systems, measured…"* | the systems the card actually lists |
| Process Ontology → Requirement Coverage | the older `R1`–`R10` list | **CORE-01…06 and ADV-01…04** | `src/data/journey.ts`, the same source as the Testing Journey chips |

Because the freeze window is now read from one place, **Health and Framework & Pod always show the
same number**. Change a milestone in the close calendar and both pages follow.

The Requirement Coverage tab now shows, for each of the ten requirements: the id, Core or Advanced,
the short name, the client's own wording, the journey steps that cover it, and the screens that
prove it — all read from the journey data, so the tab and the Testing Journey can never disagree.

### One wording still to confirm

| Screen | Says | Would be |
|---|---|---|
| Command Centre → Health, *The plant, right now* tile hint | *"… held across nine systems"* | *"… held across 13 systems"* |

It was not in the list of fixes, so it has been left alone. Say the word and it takes one line.
