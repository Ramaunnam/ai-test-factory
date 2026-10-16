# J2W AI Test Factory — recording script

A shot-by-shot script for a 13-minute end-to-end walkthrough: what to click, what to say, and
where to zoom. Read the narration as written or in your own words; the click path is the part that
matters, because every scene sets up the next one.

There is a 3-minute cut-down at the end.

---

## Before you record

**The app**

```bash
npm run dev
```

Open the URL, then:

1. Press `Ctrl K`, type **faults on**, press Enter. (Guarantees a known starting state and replays
   the plant.)
2. Set the theme to **light** in the header. You will switch to dark on camera in scene 11.
3. Make sure the plant is **running** — the Command Centre header button should read *Pause the
   plant*, and the green dot next to "running at 4x" should be pulsing.
4. Collapse nothing. Start with the full sidebar.

**The window**

| Setting | Value |
|---|---|
| Browser zoom | 100 % — the layout is designed for 1366 / 1536 / 1920 |
| Window | Maximised at 1920 × 1080 if you have it, 1536 wide minimum |
| Browser chrome | Hide the bookmarks bar; close other tabs |
| Notifications | Windows Focus Assist on |

**The recorder.** On Windows, in rough order of ease:

- **Clipchamp** (preinstalled) — screen record, then add zoom/pan keyframes and a cursor highlight
  in the editor. Easiest route to the zoom effects you want.
- **ScreenPal** or **Camtasia** — record with automatic cursor magnification and click highlights,
  best quality for a client.
- **Xbox Game Bar** (`Win + G`) — fastest, but no zoom and no cursor effects.
- **OBS Studio** — free, add a *Display Capture* source plus a zoom hotkey filter.

Enable **click highlighting** and **cursor magnification** in whichever tool you use. Move the
mouse slowly and deliberately; pause for half a second before each click so the viewer's eye
arrives before the page changes.

---

## Scene 1 · The question (0:00 – 0:45)

**Route** `/` — Command Centre, Health

**Do**: start with the page still, no movement.

**Zoom**: slow push from the full page into the confidence gauge.

> "This is the J2W AI Test Factory. It answers one question for a board: can we trust this
> application landscape enough to release on Friday and close the month on time?
>
> Today that answer is seventy-six out of a hundred. Everything you are about to see explains that
> number, and everything is live — this is a steel and recycling plant running in the browser right
> now, producing real records in nine systems."

---

## Scene 2 · It really is live (0:45 – 1:40)

**Route** `/` — the *"The plant, right now"* card at the top

**Do**
1. Point at the pulsing green dot and the plant clock. Let two seconds pass so the clock visibly
   moves.
2. Click **Send a truck**.
3. Point at *Vehicles in the last hour* and *Records created in the last hour* — they tick up.

**Zoom**: medium zoom on the six tiles.

> "The clock is the plant's clock, not ours. A truck arrives every few minutes, a recycling wagon
> every ten, a mill heat every hour.
>
> I can force one — watch the counters. That truck has just been weighed, and in a moment its
> weight will travel to SAP and be booked as a goods receipt. Nothing here is a fixed number on a
> slide."

---

## Scene 3 · Where every number comes from (1:40 – 2:40)

**Route** `/` — the provenance strip under the same card

**Do**
1. Point at the strip: *from gate_pass … → counts rows created in the last 60 minutes → into
   Confidence score*.
2. Click **How this works**.
3. In the panel, scroll to **Live rows from yard.gate_pass** and point at the five rows.
4. Close the panel (`Esc`).

**Zoom**: tight on the strip, then on the live rows table.

> "Every card tells you where its numbers came from and where they go next. This one reads the gate
> pass and goods receipt tables and feeds the confidence score.
>
> And it is not a diagram — here are the five newest rows the plant produced, right now. On any
> screen in this app, you are never more than one click from the raw data behind a number."

---

## Scene 4 · The score, and what to do about it (2:40 – 3:50)

**Route** `/` — gauge card, then *What to do next*

**Do**
1. Click **Show the full calculation**. Read the four bars.
2. Close it.
3. Move to **What to do next** and point at the `+` badges.

**Zoom**: on the four weighted bars, then on the ranked action list.

> "The score is four measured inputs, weighted. Thirty-five per cent is how many records agree
> across systems — four hundred and eighty-seven of five hundred and thirty-eight today. Thirty per
> cent is the last run. Twenty per cent is how many interface messages arrived undamaged. Fifteen
> per cent is what is still open.
>
> And if a critical finding is open, the score is capped at seventy-nine. A landscape with a known
> critical defect can never look healthy.
>
> Underneath, the same formula answers the next question: what should we fix first? Each action
> shows the points the score would gain. That is not a guess — it recalculates the score with that
> one thing repaired."

---

## Scene 5 · Watching the data move (3:50 – 5:20)

**Route** click **Watch the flow** → `/flow`

**Do**
1. Let the map run for five seconds without saying anything. Dots move.
2. Click a **moving dot** → the payload panel opens.
3. Point at the JSON, then click **Follow through every system**.
4. You land on Trace. Come straight back (`Alt + ←`) to `/flow`.
5. Scroll to the fault switches. Point at the hit counts.

**Zoom**: wide on the whole map first, then tight on one dot as it travels, then on the payload.

> "This is the landscape: nine systems in three bands, and the interfaces between them. Every dot
> is one real message in flight, drawn at its actual position between sending and arrival.
>
> Here is one. This is the payload the yard sent to SAP — gate pass, vehicle, gross, tare, quantity,
> unit.
>
> And this is what makes the demo honest: these eight switches. A kilogram sent as a tonne. A stale
> tare weight. A gateway that delivers twice. A lost message. Each one damages the data for real, as
> it travels. Nothing is written into a fixture."

---

## Scene 6 · The checks find it (5:20 – 6:40)

**Route** `/flow/checks`

**Do**
1. Point at the summary: *2 of 9 checks pass · 538 records compared · 51 disagree*.
2. Expand **C1** (it is open by default).
3. Point at the **Why** column on a failing row.
4. Click **Show the query**, then collapse it.

**Zoom**: on the summary line, then on the Why column.

> "Nine rules, written in business language, running against live data. Two pass. Fifty-one records
> disagree.
>
> Check one: the weighbridge measured twenty-one thousand nine hundred and twenty kilograms, SAP
> booked twenty-one point nine two. The system does not just flag a difference, it names the cause —
> a unit mix-up. The one below it is a stale tare, a different fault entirely, and it says so.
>
> And here is the SQL, in case the client's IT team asks. This is a real comparison, not a label."

---

## Scene 7 · From a failure to a finding (6:40 – 7:40)

**Route** `/flow/checks` → finding card

**Do**
1. On C1, click **Raise finding**.
2. You land on the new finding card. Point at **Records affected**.
3. Click one of the red gate-pass chips → Trace opens on that load.
4. Point at the red verdict banner and scroll the timeline once.

**Zoom**: on the verdict banner, then follow the timeline down.

> "One click turns those rows into a finding, with the evidence and the exact loads attached.
>
> And from the finding I can follow one of those loads through every system it touched. Gate pass,
> weighbridge ticket, the message that carried it, what SAP stored, the supplier invoice, the fact
> that it parked. Nine systems, one screen, in the order it happened.
>
> This is the thing people normally spend two days reconstructing from spreadsheets."

---

## Scene 8 · Fixing the cause (7:40 – 8:30)

**Route** back to `/flow/checks`

**Do**
1. On C1, click **Fix the cause and replay**.
2. Wait for the toast. C1 turns green.
3. Point at the summary line — the pass count has risen.

**Zoom**: on C1's badge as it flips from fail to pass.

> "Now the other direction. This switches off the two faults behind check one and replays the last
> eight hours of the plant.
>
> Same engine, same rules, same comparison — and the check is green. That is the proof that the
> failures were produced by the data and not by me. You can do this from the command line too:
> `npm run selftest` turns every fault off and proves all nine checks pass."

---

## Scene 9 · The run (8:30 – 9:45)

**Route** `Ctrl K` → type **demo** → *Run the P1 demo now*

**Do**
1. Let the run play. Do not click during it.
2. Point at the **workflow strip** as stages light up.
3. Point at the **healed** step when it appears (amber, sparkle icon).
4. Point at the **blocked as expected** step.
5. Point at the **failed** step and the F-001 button.
6. When it finishes, point at the CONDITIONAL verdict.

**Zoom**: on the workflow strip during the run, then on the healed and failed steps.

> "This is a run: ten steps across the gate-to-invoice journey, and the workflow lights up as each
> stage is proven.
>
> Step three healed itself. A field was renamed, the agent mapped the old name to the new one with
> ninety-six per cent confidence, and the run carried on instead of failing overnight.
>
> Step seven is a negative test — an invoice with no purchase order. It was blocked, which is a pass.
>
> Step six failed: three trucks booked with the wrong weight. That raised finding F-001 while we
> watched. Verdict: conditional. Not a green tick, and not a red cross — the honest answer."

---

## Scene 10 · The business view (9:45 – 11:15)

**Route** header → role switcher → **Plant Head**

**Do**
1. Open the role popover, read one description aloud, pick **Plant Head**.
2. Note the sidebar shrinking and the landing page changing to the Impact Simulator.
3. Click **Simulate impact**. Let the log play.
4. Point at the verdict, then at **79 → 58** and the delta badge.
5. Scroll to *What it means for the plant* and read one card's recommendation.

**Zoom**: on the sidebar as items disappear, then on the two confidence numbers.

> "Same application, different person. The plant head does not need the Run Centre, so it is not
> there — the menu is shorter and it lands on the simulator.
>
> Three changes are queued for this release. Simulate: two of them are not safe before the close.
>
> And here is the number that matters: confidence is seventy-nine today. If we shipped this release,
> it would be fifty-eight. That is the same formula as the gauge, with each unsafe change added as a
> projected finding.
>
> In plain language: hold the weighbridge change until after the close on the twenty-ninth."

---

## Scene 11 · The gate, dark mode, and the paper trail (11:15 – 12:30)

**Route** `/release`

**Do**
1. Press `Shift D` to switch to dark. Let the whole page re-colour on camera.
2. Point at the GO / CONDITIONAL / NO-GO badge.
3. Walk down the five **exit criteria**, pointing at the two red ones.
4. Click the red *Interface backlog* criterion → `/load`.
5. Click **Run the load profile** at 5x; when it stops, point at the callout naming IF-06.
6. Go to `/evidence`, open any pack, press **Print / Save as PDF**, then cancel the dialog.

**Zoom**: wide for the theme switch, then tight on the exit criteria list.

> "Dark mode, since someone always asks — and notice the charts and the map re-colour with it. Both
> themes are designed, not inverted.
>
> The release gate is not an opinion. Five conditions, each computed from live data, each one
> clickable. Two are not met, so the gate is conditional, and it says exactly what would turn it into
> a go.
>
> This one — interface backlog at month-end volume — takes me to the load test. At five times volume,
> invoice capture is the interface that bends first. It saturates at three times, and that is why two
> invoices are still in flight when the period closes.
>
> And everything is locked into a hashed evidence pack that prints for an auditor."

---

## Scene 12 · Close (12:30 – 13:00)

**Route** `/` (press `g` then `h`)

**Do**: return to the Command Centre and leave the page still.

> "So: one number, with every input measured and every number traceable to the record behind it.
> The factory learns the process, writes the tests, runs them, watches every handoff, and gates the
> release.
>
> Everything you saw is a working application. No backend, no slides, no screenshots."

---

## The 3-minute cut-down

For a first meeting or a slot inside a bigger deck:

| Time | Scene | One line |
|---|---|---|
| 0:00 | Health, gauge | "One number: can we trust this landscape?" |
| 0:25 | *The plant, right now* + Send a truck | "It is live, not a slide." |
| 0:50 | `/flow`, the moving dots | "Every dot is a real message between two systems." |
| 1:20 | `/flow/checks`, C1 | "The weighbridge says 21 920 kg, SAP booked 21.92. It names the cause." |
| 1:50 | Raise finding → trace | "One click to a finding, one more to the whole journey." |
| 2:20 | Fix the cause and replay | "Faults off, the check goes green. The failures are real." |
| 2:45 | Back to Health | "That is the score, and what to fix first." |

---

## If something drifts mid-recording

| Problem | Fix |
|---|---|
| Too few failing rows to point at | `Ctrl K` → **faults on** (resets and replays with all eight faults) |
| Everything is green and you wanted red | Same: `Ctrl K` → **faults on** |
| You want a clean landscape instead | `Ctrl K` → **faults off** |
| The plant has drifted far from 06:00 | `Ctrl K` → **replay** (eight-hour warm-up from the seed) |
| You need a truck on screen now | `Ctrl K` → **truck** |
| A page looks wrong after many changes | Refresh; the plant replays deterministically from the seed |

Two habits that make the recording look rehearsed: use `Ctrl K` instead of hunting through the
menu when you need to jump, and pause for a full second on each landing page before speaking.

---

## Questions you will be asked, and the honest answer

**"Is this connected to our systems?"**
No. A simulated plant runs in the browser and produces every record. The point of the POC is the
method — the checks, the trace, the scoring, the gate — not the connection. Replacing the simulator
with real connectors is one module; the checks, trace and scoring work unchanged.

**"Are the failures scripted?"**
No, and it is provable. `npm run selftest` runs the plant with every fault off and shows all nine
checks passing, then with every fault on and shows the same checks failing with causes. Same code,
same rules.

**"What is real and what is mocked?"**
Live: all fifteen tables, the nine checks, trace, the interface comparisons, the confidence score,
the release criteria, the discovery activity counts. Authored: the landscape and process
definitions, the scenario library, the six discovery recordings, the SOPs, the historic runs and
the load capacity model. There is a full table in `APPLICATION-GUIDE.md`, section 13.

**"How long did this take to build?"**
Say what is true for your engagement. What you can say about the app: 55 files, about 15 000 lines,
7 dependencies, no backend.

**"Can we have it?"**
It is a static build — `npm run build` produces a `dist/` folder that runs from any web server or
a shared drive.
