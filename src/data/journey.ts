/* -------------------------------------------------------------------------- */
/* The client's requirements                                                  */
/* -------------------------------------------------------------------------- */

export interface JourneyRequirement {
  id: string
  group: 'Core' | 'Advanced'
  /** Two or three words, for a chip. */
  short: string
  /** The requirement as the client wrote it. */
  full: string
}

export const JOURNEY_REQUIREMENTS: JourneyRequirement[] = [
  {
    id: 'CORE-01',
    group: 'Core',
    short: 'Script preparation',
    full: 'AI writes test scripts from process discovery',
  },
  {
    id: 'CORE-02',
    group: 'Core',
    short: 'Positive testing',
    full: 'The normal journey works',
  },
  {
    id: 'CORE-03',
    group: 'Core',
    short: 'Negative testing',
    full: 'Wrong actions are blocked',
  },
  {
    id: 'CORE-04',
    group: 'Core',
    short: 'Regression testing',
    full: 'Re-test after every change',
  },
  {
    id: 'CORE-05',
    group: 'Core',
    short: 'Result documentation',
    full: 'Logs, step evidence, audit-ready reports',
  },
  {
    id: 'CORE-06',
    group: 'Core',
    short: 'Test master data',
    full: 'AI creates the test data',
  },
  {
    id: 'ADV-01',
    group: 'Advanced',
    short: 'Cross-system integration',
    full: 'Cross-system integration and API testing',
  },
  {
    id: 'ADV-02',
    group: 'Advanced',
    short: 'Performance and load',
    full: 'Performance and load testing (month-end peak)',
  },
  {
    id: 'ADV-03',
    group: 'Advanced',
    short: 'Security and roles',
    full: 'Security and roles (segregation of duties)',
  },
  {
    id: 'ADV-04',
    group: 'Advanced',
    short: 'Migration reconciliation',
    full: 'Data migration reconciliation',
  },
]

export function requirementById(id: string): JourneyRequirement {
  return JOURNEY_REQUIREMENTS.find((r) => r.id === id) ?? JOURNEY_REQUIREMENTS[0]
}

/* -------------------------------------------------------------------------- */
/* The eight steps                                                            */
/* -------------------------------------------------------------------------- */

export interface StepRequirement {
  id: string
  /** One plain sentence: how this step covers it. */
  how: string
  /** Where that part of it happens, when it is not the step's own page. */
  opens?: { label: string; route: string }
}

export interface JourneyStep {
  n: number
  name: string
  goesIn: string
  aiDoes: string
  comesOut: string
  checkedBy: string
  requirements: StepRequirement[]
  /** The one-line before and after. */
  today: string
  withFactory: string
  /** Short labels for the input → AI → output picture. */
  inShort: string
  aiShort: string
  outShort: string
  /** Where this step really happens in the app. */
  opens: { label: string; route: string }
  /** One line for the live log while the journey plays. */
  logLine: string
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    n: 1,
    name: 'Learn the process',
    goesIn: 'Key-user screen recordings from Test Studio → Record, the system log, the written procedures.',
    aiDoes: 'The discovery agent finds the real process, its steps and where rework happens.',
    comesOut: 'A process map.',
    checkedBy: 'Key User',
    requirements: [
      { id: 'CORE-01', how: 'Discovery is where script preparation starts: the map it produces is what the scripts are later written from.' },
    ],
    today: 'The process lives in people’s heads and an out-of-date procedure.',
    withFactory: 'The real process is read from recordings and the system log in minutes.',
    inShort: 'Recordings, log, procedures',
    aiShort: 'Discovery agent',
    outShort: 'A process map',
    opens: { label: 'Process Discovery → Inputs', route: '/discovery' },
    logLine: 'Reading 6 recordings, the plant log and 4 written procedures…',
  },
  {
    n: 2,
    name: 'Confirm with key users',
    goesIn: 'The process map.',
    aiDoes: "Takes Correct, Not right and comments on every box, arrow and loop, then redraws the map with the key users' corrections.",
    comesOut: 'An approved process map.',
    checkedBy: 'Key User',
    requirements: [
      { id: 'CORE-01', how: 'Nothing is written from a guess: the map a key user approves is the one the scripts come from.' },
    ],
    today: 'Workshops over several weeks to agree how the work actually runs.',
    withFactory: 'Key users correct one map on screen and approve it.',
    inShort: 'The process map',
    aiShort: 'Redraw with corrections',
    outShort: 'An approved map',
    opens: { label: 'Process Discovery → Process map', route: '/discovery/map' },
    logLine: 'Walking the map with the key users and folding in their corrections…',
  },
  {
    n: 3,
    name: 'Write the tests',
    goesIn: 'The approved map and its business rules.',
    aiDoes: 'Turns the recordings into tests and writes positive, negative and re-test (regression) scenarios.',
    comesOut: 'Scenarios waiting for approval.',
    checkedBy: 'Key User approves each one',
    requirements: [
      { id: 'CORE-01', how: 'The scripts are drafted straight from the approved map, one scenario per rule.' },
      { id: 'CORE-02', how: 'Every stage gets a normal-path scenario that proves the journey works end to end.' },
      { id: 'CORE-03', how: 'Each rule also gets a scenario that does the wrong thing and must be refused.' },
      { id: 'CORE-04', how: 'Anything a current change could break gets a re-test scenario at the same time.' },
    ],
    today: 'Scripts are written by hand, when somebody has time.',
    withFactory: 'Scripts are drafted from the approved map and wait for a key user to approve them.',
    inShort: 'Approved map and rules',
    aiShort: 'Scenario writer',
    outShort: 'Scenarios to approve',
    opens: { label: 'Test Studio', route: '/studio' },
    logLine: 'Writing the normal paths first, then what must be refused, then the re-tests…',
  },
  {
    n: 4,
    name: 'Prepare test data',
    goesIn: 'The scenarios.',
    aiDoes: 'Finds bad master data, then creates clean, linked test records (vendor, order, vehicle, batch) that match each other across systems.',
    comesOut: 'Test data loaded in the TEST environment.',
    checkedBy: 'QA Lead',
    requirements: [
      { id: 'CORE-06', how: 'The records are generated and linked to each other, so a scenario has something real to run against, with no real personal data.' },
    ],
    today: 'Test data is copied out of production or typed in by hand.',
    withFactory: 'Linked records are generated on demand, and carry no real personal data.',
    inShort: 'The scenarios',
    aiShort: 'Test data agent',
    outShort: 'Linked records in TEST',
    opens: { label: 'Test Studio → Test Data', route: '/test-data' },
    logLine: 'Generating linked records so a scenario has something real to run against…',
  },
  {
    n: 5,
    name: 'Run the tests',
    goesIn: 'Approved scenarios and test data.',
    aiDoes: 'Runs every step, and heals a step when a screen or field changed.',
    comesOut: 'Pass, fail or blocked-as-expected per step, each step with a screenshot and log.',
    checkedBy: 'QA Lead',
    requirements: [
      { id: 'CORE-02', how: 'The normal journey is run end to end and every stage it proves lights up as it passes.' },
      { id: 'CORE-03', how: 'The negative steps are run too, and a step that is correctly refused counts as a pass.' },
      { id: 'CORE-05', how: 'Every step keeps its result, its timestamp, a screenshot of the screen it touched and its log, as it runs.' },
    ],
    today: 'Key users click through every screen by hand.',
    withFactory: 'It runs on its own, with evidence for every step.',
    inShort: 'Scenarios and data',
    aiShort: 'Execution agent',
    outShort: 'Each step with a screenshot and log',
    opens: { label: 'Run Centre', route: '/run' },
    logLine: 'Running the steps, healing the one whose field was renamed…',
  },
  {
    n: 6,
    name: 'Check data across systems',
    goesIn: 'The records each system created.',
    aiDoes: 'Follows one truck through every system and compares the data at each hand-over.',
    comesOut: 'Matched and mismatched records, with the reason. Also checks tonnes received against kilograms in stock. Finance links too: VAT, sanctions, eBanking, exchange rates.',
    checkedBy: 'Key User',
    requirements: [
      {
        id: 'ADV-01',
        how: 'Every hand-over between two systems is compared field by field, so a weight that changes on the way is caught where it changed.',
        opens: { label: 'Interface Testing', route: '/interfaces' },
      },
      {
        id: 'ADV-04',
        how: 'The same comparison runs over a migrated or cross-system data set, row by row, with each difference explained.',
        opens: { label: 'Change & Regression → Migration Reconciliation', route: '/reconciliation' },
      },
    ],
    today: 'Differences surface weeks later, in the month-end numbers.',
    withFactory: 'Every hand-over is compared as it happens, and names its own cause.',
    inShort: 'Records in every system',
    aiShort: 'Compare at each hand-over',
    outShort: 'Matches and mismatches',
    opens: { label: 'Live Data Flow → Live Checks', route: '/flow/checks' },
    logLine: 'Comparing what each system holds for the same load…',
  },
  {
    n: 7,
    name: 'Fix and re-test',
    goesIn: 'The mismatches and the changes made.',
    aiDoes: 'Raises a finding, works out which processes a change touches, and re-runs only the affected tests.',
    comesOut: 'Findings, and a before-and-after re-test result.',
    checkedBy: 'Key User',
    requirements: [
      { id: 'CORE-04', how: 'A change is mapped onto the processes it touches, and only those tests run again, compared against the last good run.' },
    ],
    today: 'A change means re-testing everything, or hoping nothing else broke.',
    withFactory: 'Only the affected tests re-run, against the last good run.',
    inShort: 'Mismatches and changes',
    aiShort: 'Change impact agent',
    outShort: 'Findings and a re-test',
    opens: { label: 'Change & Regression', route: '/regression' },
    logLine: 'Working out what the change touches, then re-running only those tests…',
  },
  {
    n: 8,
    name: 'Prove and release',
    goesIn: 'All results.',
    aiDoes: 'Builds a locked evidence pack — every step with its screenshot and log — and scores readiness.',
    comesOut: 'GO, CONDITIONAL or NO-GO, with the evidence behind it.',
    checkedBy: 'Key User signs off; Auditor can view',
    requirements: [
      { id: 'CORE-05', how: 'The run, its steps with their screenshots and logs, its data and its approvals are sealed into one pack an auditor can read unchanged.' },
      {
        id: 'ADV-02',
        how: 'Before the gate is given, the month-end peak is pushed through and the point where it would struggle is reported.',
        opens: { label: 'Command Centre → Month-End Load', route: '/load' },
      },
      {
        id: 'ADV-03',
        how: 'The forbidden combinations of access are attempted for real, and anything the system allows becomes a finding with its evidence.',
        opens: { label: 'Roles & SoD', route: '/access-sod' },
      },
    ],
    today: 'Evidence is gathered by hand for the auditor, after the fact.',
    withFactory: 'The pack is sealed as the run finishes, and the gate decision is scored.',
    inShort: 'Every result',
    aiShort: 'Evidence agent',
    outShort: 'A gate decision',
    opens: { label: 'Command Centre → Release & Close', route: '/release' },
    logLine: 'Sealing the evidence and scoring the gate…',
  },
]

export const JOURNEY_TOTAL = JOURNEY_STEPS.length

export function journeyStep(n: number): JourneyStep {
  return JOURNEY_STEPS.find((s) => s.n === n) ?? JOURNEY_STEPS[0]
}

/** Which steps cover a requirement. */
export function stepsCovering(reqId: string): number[] {
  return JOURNEY_STEPS.filter((s) => s.requirements.some((r) => r.id === reqId)).map((s) => s.n)
}

/** How many of the client's requirements at least one step covers. */
export function coveredRequirementCount(): number {
  return JOURNEY_REQUIREMENTS.filter((r) => stepsCovering(r.id).length > 0).length
}
