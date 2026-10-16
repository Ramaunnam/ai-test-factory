import { engine } from '@/sim/engine'
import type { Role } from '@/providers/RoleProvider'

export interface TourScene {
  id: string
  title: string
  /** Navigate here first. */
  route?: string
  /** What the narrator says, shown as the caption. */
  caption: string
  /** CSS selector of the thing to point at. */
  target?: string
  /** Really click the target, not just point at it. */
  click?: boolean
  /** Press Escape after clicking, to close whatever opened. */
  closeAfter?: boolean
  /** Visual zoom on the target. 1 is none. */
  zoom?: number
  /** Milliseconds to hold once the cursor has arrived. */
  hold: number
  /** Anything to do to the plant before the scene starts. */
  before?: () => void
  /** View the app as this role for the scene. */
  role?: Role
}

export const TOUR_SCENES: TourScene[] = [
  {
    id: 'opening',
    title: 'The question',
    route: '/',
    target: '[data-tour="gauge"]',
    zoom: 1.2,
    hold: 7000,
    caption:
      'This is the J2W AI Test Factory. It answers one question: can we trust this application landscape enough to release on Friday and close the month on time? Today the answer is a measured number out of a hundred.',
  },
  {
    id: 'live',
    title: 'It really is live',
    route: '/',
    target: '[data-tour="send-truck"]',
    click: true,
    zoom: 1.15,
    hold: 6500,
    caption:
      'The clock is the plant’s, not ours. A truck arrives every few minutes, a recycling wagon every ten, a mill heat every hour. I have just forced one through the gate — watch the counters move. Nothing here is a fixed number.',
  },
  {
    id: 'provenance',
    title: 'Where every number comes from',
    route: '/',
    target: '[data-tour="how"]',
    click: true,
    closeAfter: true,
    hold: 8000,
    caption:
      'Every card says where its numbers came from and where they go next. And it is not a diagram — these are the five newest rows the plant produced, right now. You are never more than one click from the raw data.',
  },
  {
    id: 'score',
    title: 'What the score is made of',
    route: '/',
    target: '[data-tour="calc"]',
    click: true,
    closeAfter: true,
    hold: 9000,
    caption:
      'Four measured inputs, weighted: how many records agree across systems, the last run, how many interface messages arrived undamaged, and what is still open. If a critical finding is open, the score is capped at seventy-nine — a landscape with a known critical defect can never look healthy.',
  },
  {
    id: 'next',
    title: 'What to do about it',
    route: '/',
    target: '[data-tour="actions"]',
    zoom: 1.15,
    hold: 7000,
    caption:
      'The same formula answers the next question: what should we fix first? Each action shows the points the score would gain, calculated by recomputing it with that one thing repaired.',
  },
  {
    id: 'flow',
    title: 'Watching the data move',
    route: '/flow',
    target: '[data-tour="flow-map"]',
    hold: 10000,
    caption:
      'Nine systems in three bands, and the interfaces between them. Every dot is one real message in flight, drawn at its actual position between sending and arrival.',
  },
  {
    id: 'faults',
    title: 'What can go wrong',
    route: '/flow',
    target: '[data-tour="faults"]',
    zoom: 1.1,
    hold: 9000,
    caption:
      'Eight switches. A kilogram sent as a tonne. A stale tare weight. A gateway that delivers twice. A lost message. Each one damages the data for real as it travels — nothing is written into a fixture.',
  },
  {
    id: 'checks',
    title: 'The checks find it',
    route: '/flow/checks',
    target: '[data-tour="checks-summary"]',
    hold: 9000,
    caption:
      'Nine rules in business language, running against live data. The weighbridge measured twenty-one thousand nine hundred and twenty kilograms; SAP booked twenty-one point nine two. The system names the cause: a unit mix-up.',
  },
  {
    id: 'fix',
    title: 'Fixing the cause',
    route: '/flow/checks',
    target: '[data-tour="fix-cause"]',
    click: true,
    hold: 9000,
    caption:
      'Now the other direction. This switches off the faults behind check one and replays the last eight hours. Same engine, same rules — and the check turns green. That is the proof the failures came from the data, not from me.',
  },
  {
    id: 'run',
    title: 'A run, step by step',
    route: '/run',
    target: '[data-tour="run-demo"]',
    click: true,
    hold: 16000,
    caption:
      'Ten steps across the gate-to-invoice journey, with the workflow lighting up as each stage is proven. One step heals itself after a field was renamed. One negative test is blocked, which is a pass. One data check fails and raises a finding while we watch.',
  },
  {
    id: 'discovery',
    title: 'How it learned the process',
    route: '/discovery',
    target: '[data-tour="sessions"]',
    click: true,
    closeAfter: true,
    hold: 10000,
    caption:
      'None of this was configured by hand. Six recorded sessions, the live system log and the written procedures. Each recording says who made it, why it was requested, and what it showed that the manual does not.',
  },
  {
    id: 'simulator',
    title: 'The business view',
    role: 'Plant Head',
    route: '/simulator',
    target: '[data-tour="simulate"]',
    click: true,
    hold: 12000,
    caption:
      'The plant head sees a shorter menu and a different landing page. Three changes are queued for this release. Two are not safe before the close — and confidence would drop from seventy-nine to the high fifties if we shipped them.',
  },
  {
    id: 'gate',
    title: 'The release gate',
    role: 'Key User',
    route: '/release',
    target: '[data-tour="exit-criteria"]',
    hold: 11000,
    caption:
      'The gate is not an opinion. Five conditions, each computed from live data, each one clickable. It says exactly what would turn a conditional into a go.',
  },
  {
    id: 'close',
    title: 'Everything is traceable',
    route: '/',
    target: '[data-tour="gauge"]',
    zoom: 1.15,
    hold: 9000,
    before: () => engine.start(),
    caption:
      'One number, every input measured, and every number traceable to the record behind it. The factory learns the process, writes the tests, runs them, watches every handoff and gates the release. This is a working application — no slides, no screenshots.',
  },
]

export const TOUR_TOTAL_MS = TOUR_SCENES.reduce((s, sc) => s + sc.hold + 2200, 0)
