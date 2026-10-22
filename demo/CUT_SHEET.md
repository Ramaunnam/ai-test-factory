# J2W AI Test Factory — demo video cut sheet

`j2w_ai_test_factory_demo.mp4` · 1920×1080 · 25 fps · H.264/AAC · 3:28 (207.7s)
Voice: `en-US-AvaMultilingualNeural` at `+8%` · Loudness: -15.9 LUFS integrated, -1.5 dBFS true peak

The cut follows the app's own Testing Journey — what the factory is, the ten client requirements it
exists to satisfy, how a step is specified, one real load end to end — then the live screens that
prove each stage, including a scene each for the four advanced requirements. The app runs in its
light theme and switches to dark on camera in the last scene, so the title card is light and the
closing card is dark.

| Time | Scene | Screen | Narration |
|---|---|---|---|
| 0:00 | `01_title` | Title card | *(silent)* — JoulesToWatts logo, J2W AI Test Factory, strapline |
| 0:03 | `02_what` | Testing Journey — the eight steps | "The AI Test Factory takes an enterprise landscape from how people actually work today, to a release you can trust, in eight steps: learn the process, confirm it with key users, write the tests, prepare the data, run them, check every system against every other, fix, and prove." |
| 0:19 | `03_requirements` | Requirements row — CORE-01…ADV-04 | "Those steps exist to satisfy ten requirements the client set, six core and four advanced. Pick any one, and the factory shows which steps cover it and the screen that proves it. Today, ten of ten are covered." |
| 0:32 | `04_step` | Step 1 of 8 detail card | "Every step is specified the same way: what goes in, what the AI does, what comes out, and who signs it off. Step one turns key-user recordings, the plant's own log and the written procedures into a process map." |
| 0:45 | `05_truck` | "Follow one truck through the journey" | "And it isn't theory. Pick one real load and the factory follows it through all eight steps: arriving at the gate, weighed, booked, checked across systems, invoiced and posted, each step showing the actual record it produced." |
| 0:59 | `06_discovery` | Process Discovery — the three inputs | "Step one in the live app. Six recorded sessions, the plant's running log and four written procedures go in. The discovery agent groups the clicks, orders them by the log, and finds the loops people actually work around." |
| 1:13 | `07_studio` | Test Studio — rule to data check | "Step three. Scenarios are written from that model and the live data, positive, negative and regression, and nothing runs until a key user approves it. A rule typed in plain English becomes a data check inside the test." |
| 1:26 | `08_run` | Run Centre — the P1 run, then the verdict | "Step five runs them end to end. One step heals itself, mapping a renamed field automatically. One negative test is blocked, which counts as a pass. One genuinely fails and raises a finding while it happens. The verdict is conditional: not a green tick, and not a red cross." |
| 1:45 | `09_checks` | Live Checks, then the provenance drawer | "Step six compares every system against every other. This check doesn't just flag a mismatch, it names the cause: a weight sent in kilograms, booked as tonnes. And every number opens its own panel, showing the source tables behind it." |
| 2:00 | `10_interfaces` | Interface Testing — 19 handoffs, filtered | "The first advanced requirement is the joins between systems. Interface testing counts every handoff, YardLink into SAP, dOps into D365, and compares them field by field, whether they travel as an IDoc, an API call or a file." |
| 2:16 | `11_load` | Month-End Load — **the 5× test runs live on camera** | "The second is what happens at month-end volume, so let's run it. This pushes five times a normal day through every interface at once. Watch the error rate climb far past its one percent target, and four of the nine interfaces break under the load. Invoice capture gives way first: it starts to struggle at about three times a normal day, which is why supplier invoices miss the close cut-off." |
| 2:40 | `12_governance` | Roles & SoD → Migration Reconciliation | "The other two are about trusting people and data. Segregation of duties isn't a document here: the forbidden action is actually attempted, and every conflict it finds is listed by role and by user. And migration reconciliation compares source against target, row counts and totals, explaining each difference down to the field." |
| 2:59 | `13_gate` | Release & Close — verdict card, then all six criteria, then dark mode | "Step eight is the gate, and it isn't an opinion. Six conditions, each computed from live data, including the interface backlog at month-end volume, which is exactly what that load test just measured. Every condition not met is named, along with what would turn the gate into a go. And the whole application re-colours in dark mode, charts and all." |
| 3:20 | `14_close` | Closing card | "J2W AI Test Factory, by JoulesToWatts." |

## The four advanced requirements, and where each is shown

| Requirement | Scene | Screen it is proven on |
|---|---|---|
| Cross-system integration & API testing | `10_interfaces` | Interface Testing — 19 interfaces, filterable by IDoc / API / file, source and target system, compared field by field |
| Performance & load | `11_load` | Month-End Load — the 5× profile is actually run on camera: virtual users ramp, transactions per minute, average and slowest-5% response, error rate against its 1% target, and 4 of 9 interfaces breaking with IF-06 named |
| Security & segregation of duties | `11_governance` | Roles & SoD — the conflict matrix, users in conflict, and conflicts proven by a run |
| Data migration reconciliation | `11_governance` | Migration Reconciliation — source vs target row counts and totals, including dOps Core against D365 F&O live, with differences explained by cause |

## Two bugs found and fixed in this round

- **Right-hand panels were off-frame.** Everything in this app that "pops up information" opens as a
  `[role=dialog]` drawer on the right. The camera had been aimed at the button that opened it, so it
  held on the dimmed background. Drawers are now a zoom target in their own right.
- **Test Studio recorded as a blank page.** The DOM was fine (verified at 2x with the same
  injections: opacity 1, full height, content present). Chrome's screencast only emits a frame when
  something changes; the navigation produced one half-painted frame and then the page sat perfectly
  still for the rest of the scene, so the encoder repeated that frame. Every navigation in
  `story.mjs` is now followed by a pointer move, which repaints and forces a complete frame to be
  captured. This is the same root cause as the calibration-flash failure fixed earlier.

## Live data on camera

Two scenes show real output rather than a static screen:

- **Month-End Load** picks the 5× profile and runs it. The counter reads "running · second N of 20"
  while the metric tiles populate and the response-time and throughput charts draw themselves. The
  narration deliberately avoids quoting the run's numbers, because they differ slightly on every run
  (transactions per minute and error rate varied between 248-291 and 18.9-22.1% across sample runs).
  What it does state is stable, coming from the capacity model rather than the run: four of nine
  interfaces break, and IF-06 (captured invoice) gives way first at about 3× a normal day.
- **Release & Close** walks the verdict card and then all six exit criteria with their live detail —
  open findings by id, how many live checks pass, the regression run's verdict, the signed evidence
  hash, and EC-5, which reads "at 5×, invoice capture runs over capacity and two invoices are still
  in flight at the cut-off" — the same finding the load test had just produced on screen.

## What was verified (by measurement, not by watching or listening)

- **Format**: `ffprobe` confirms H.264, 1920×1080, 25/1 fps (constant), AAC 48kHz stereo, `+faststart`.
- **Loudness**: `ebur128` reports -15.9 LUFS integrated, true peak -1.6 dBFS.
- **Record log**: the final take logged zero `late`, `nothing to click`, `no region`, `cannot frame`
  or `did not happen` warnings.
- **Visual**: all 15 zoom targets pass `check_focus`; frame strips were reviewed for the Test Studio
  scene (now rendering fully) and full-resolution frames for the drawer and the reconciliation list.

No one has listened to the narration or watched the video played back in real time.

## Accuracy note

An earlier draft claimed confidence "would drop sharply" in the Impact Simulator; the live build
computes 77 → 76. That scene is not in this cut, and nothing in the current script quotes a run-time
figure — every claim describes what a screen does.

## Notes for re-running

- Serve a production build on `http://localhost:4173` (`npm run build`, then `npm run preview`).
- Generic pipeline files carrying app-specific fixes, all commented in place:
  - `record.mjs` — calibration flash held 900ms and repainted every 90ms (a short static flash is
    never captured on a still page).
  - `assemble.mjs` — final pass forces `-r 25 -fps_mode cfr`; without it concat+fade lands on 299/12.
- Locator roles: sidebar items are `link`, sub-tabs are `tab`, ordinary actions are `button`.
- Picking a requirement chip re-selects the journey step that covers it, so the story clicks step 1
  again before narrating step one.
- Wording or voice change → `gen_audio.mjs` (`FORCE=1`) → `verify_cues.mjs` → re-record. Only zooms
  or cards → `make_cards.mjs` then `assemble.mjs`; `out/master/` and `out/timeline.json` are kept.
