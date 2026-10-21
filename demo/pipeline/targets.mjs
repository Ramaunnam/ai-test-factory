import { A } from './focuslib.mjs';

export const T = {
  gauge:        { t: A(/Confidence score/), max: 1.35, padY: 30 },
  sendTruck:    { t: A(/Send a truck/), max: 1.4, padX: 40 },
  scoreCalc:    { t: A(/Show the full calculation/), max: 1.3, padX: 30, clipW: 700 },
  whatNext:     { t: A(/What to do next/), max: 1.3, padX: 30, clipW: 700 },
  checksC1:     { t: A(/^C1$/), max: 1.3, padX: 30, clipW: 760 },
  checksQuery:  { t: A(/Show the query/), max: 1.3, padX: 30 },
  raiseFinding: { t: A(/Raise finding/), max: 1.4, padX: 40 },
  fixCause:     { t: A(/Fix the cause and replay/), max: 1.4, padX: 40 },
  runDemo:      { t: A(/Run the P1 demo now/), max: 1.4, padX: 40 },
  simulate:     { t: A(/Simulate impact/), max: 1.35, padX: 40 },
  gateDecision: { t: A(/exit criteria/), max: 1.3, padX: 30, clipW: 700 },
};
