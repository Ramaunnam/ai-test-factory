import { A, S, U } from './focuslib.mjs';

// Regions are chosen to be information-dense (a panel, a list, a dialog) rather than the small
// control that triggered them -- a zoom aimed at a button leaves the content it opened off-frame.
export const T = {
  journeySteps: { t: U(A(/Learn the process/), A(/Prove and release/)), max: 1.35, padX: 8, padY: 12 },
  requirements: { t: A(/requirements you set/), max: 1.3, padX: 30 },
  stepDetail:   { t: A(/what goes in/i), max: 1.25, padX: 30, clipH: 560 },
  truckJourney: { t: U(A(/Arrived at site/), A(/archived/)), max: 1.25, padX: 20, padY: 16, clipH: 620 },
  discoveryIn:  { t: A(/Three sources go in/), max: 1.3, padX: 30 },
  studioRule:   { t: A(/Turn a business rule into a data check/), max: 1.3, padX: 30, clipW: 820 },
  runStrip:     { t: A(/Gate to Invoice/), max: 1.25, padX: 30, clipH: 600 },
  runVerdict:   { t: A(/CONDITIONAL/), max: 1.35, padX: 40 },
  checksC1:     { t: A(/^C1$/), max: 1.3, padX: 30, clipW: 760 },
  drawer:       { t: S('[role="dialog"]'), max: 1.3, padX: 16, padY: 16, clipH: 620 },
  interfaceTbl: { t: S('table', { level: 0 }), max: 1.25, padX: 20, padY: 20, clipH: 600 },
  loadMetrics:  { t: U(A(/transactions per minute/i), A(/error rate/i)), max: 1.3, padX: 20, padY: 20 },
  loadBreaks:   { t: A(/gives way first/), max: 1.3, padX: 24, clipH: 560 },
  gateVerdict:  { t: A(/Gate decision/), max: 1.35, padX: 30 },
  sodMatrix:    { t: A(/Conflict matrix/), max: 1.25, padX: 20, clipH: 600 },
  reconList:    { t: A(/Open purchase orders migrated/), max: 1.25, padX: 20, clipH: 580 },
  // the decision card and the criteria list are two separate cards; targeting "exit criteria"
  // matches the decision card's own summary line, so anchor the list on its subtitle instead.
  exitCriteria: { t: A(/conditions, each computed from live data/), max: 1.25, padX: 24, clipH: 600 },
};
