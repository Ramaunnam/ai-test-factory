/**
 * Headless smoke test: renders every page with the real providers and the real
 * simulation data, and fails if any of them throws.
 *
 *   npm run smoke
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const g = globalThis as unknown as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
try {
  g.navigator = dom.window.navigator
} catch {
  /* node 24 defines navigator as a getter; the DOM one is not needed */
}
g.HTMLElement = dom.window.HTMLElement
g.Element = dom.window.Element
g.Node = dom.window.Node
g.getComputedStyle = dom.window.getComputedStyle
g.localStorage = dom.window.localStorage
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number
g.cancelAnimationFrame = (id: number) => clearTimeout(id)
dom.window.matchMedia =
  dom.window.matchMedia ??
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList)
g.matchMedia = dom.window.matchMedia

const { renderToString } = await import('react-dom/server')
const { MemoryRouter, Route, Routes } = await import('react-router-dom')
const { ThemeProvider } = await import('@/providers/ThemeProvider')
const { RoleProvider } = await import('@/providers/RoleProvider')
const { ToastProvider } = await import('@/providers/ToastProvider')
const { DrawerProvider } = await import('@/providers/DrawerProvider')

const cc = await import('@/pages/CommandCentre')
const landscape = await import('@/pages/Landscape')
const ontology = await import('@/pages/Ontology')
const discovery = await import('@/pages/Discovery')
const studio = await import('@/pages/Studio')
const flow = await import('@/pages/Flow')
const run = await import('@/pages/RunCentre')
const interfaces = await import('@/pages/Interfaces')
const regression = await import('@/pages/Regression')
const { store } = await import('@/data/appStore')
const govern = await import('@/pages/Govern')
const reports = await import('@/pages/Reports')
const misc = await import('@/pages/Misc')
const journey = await import('@/pages/Journey')

type Case = [label: string, pattern: string, path: string, Comp: React.ComponentType]

const sourceNote = await import('@/components/domain/SourceNote')

/**
 * Drawer and toast content is rendered by the providers, not by the page. If the
 * router is not above them, anything in a drawer that navigates throws and the
 * whole app goes blank. This case renders exactly that content.
 */
const DrawerContentProbe = () => (
  <sourceNote.SourceDetail
    reads={[{ table: 'MSEG', note: 'goods receipts' }, { label: 'Live checks', route: '/flow/checks' }]}
    computes="compares the weighbridge against SAP"
    feeds={[{ label: 'Confidence score', route: '/' }]}
    steps={['one', 'two']}
  />
)

const CASES: Case[] = [
  ['Drawer content (navigates)', '/', '/', DrawerContentProbe],
  ['Testing Journey', '/journey', '/journey?step=5', journey.JourneyPage],
  ['Command Centre / Health', '/', '/', cc.HealthPage],
  ['Command Centre / Release', '/release', '/release', cc.ReleasePage],
  ['Command Centre / Load', '/load', '/load', cc.LoadPage],
  ['Command Centre / Simulator', '/simulator', '/simulator', cc.SimulatorPage],
  ['Command Centre / Framework & Pod', '/offer', '/offer', cc.OfferPage],
  ['Enterprise Map', '/landscape', '/landscape', landscape.LandscapePage],
  ['Ontology / Workflows', '/ontology', '/ontology', ontology.OntologyPage],
  ['Ontology / Business Objects', '/ontology/objects', '/ontology/objects', ontology.BusinessObjectsPage],
  ['Ontology / Agents', '/ontology/agents', '/ontology/agents', ontology.AgentsPage],
  ['Ontology / Coverage', '/coverage', '/coverage', ontology.CoveragePage],
  ['Process Discovery', '/discovery', '/discovery', discovery.DiscoveryPage],
  ['Process Discovery / Process map', '/discovery/map', '/discovery/map', discovery.ProcessMapPage],
  ['Process Discovery / Compare', '/discovery/compare', '/discovery/compare', discovery.ProcedureComparePage],
  ['Test Studio / Scenarios', '/studio', '/studio', studio.StudioPage],
  ['Test Studio / Test Data', '/test-data', '/test-data', studio.TestDataPage],
  ['Test Studio / Master Data', '/studio/master-data', '/studio/master-data', studio.MasterDataPage],
  ['Test Studio / Record', '/studio/record', '/studio/record', studio.RecordPage],
  ['Live Data Flow / Live Flow', '/flow', '/flow', flow.LiveFlowPage],
  ['Live Data Flow / System Data', '/flow/data', '/flow/data?system=sap-steel', flow.SystemDataPage],
  ['Live Data Flow / Live Checks', '/flow/checks', '/flow/checks', flow.LiveChecksPage],
  ['Live Data Flow / Trace', '/flow/trace', '/flow/trace', flow.TracePage],
  ['Run Centre / Runs', '/run', '/run', run.RunCentrePage],
  ['Run Centre / Schedules', '/run/schedules', '/run/schedules', run.SchedulesPage],
  ['Run Centre / Evidence', '/evidence', '/evidence', run.EvidencePage],
  ['Interface Testing', '/interfaces', '/interfaces', interfaces.InterfacesPage],
  ['Interface Testing (one)', '/interfaces', '/interfaces?interface=IF-01', interfaces.InterfacesPage],
  ['Change Impact', '/regression', '/regression?change=CH-205', regression.ChangeImpactPage],
  ['Self-Healing', '/self-healing', '/self-healing', regression.SelfHealingPage],
  ['Reconciliation', '/reconciliation', '/reconciliation', regression.ReconciliationPage],
  ['Approvals', '/approvals', '/approvals', govern.ApprovalsPage],
  ['Roles & SoD', '/access-sod', '/access-sod', govern.AccessSodPage],
  ['Connected Systems', '/systems', '/systems', govern.SystemsPage],
  ['Finding card', '/finding/:id', '/finding/F-001', reports.FindingPage],
  ['Run report', '/report/:runId', '/report/RUN-1042', reports.RunReportPage],
  ['Release report', '/release-report/:id', '/release-report/R-2026.10', reports.ReleaseReportPage],
  ['Evidence pack', '/evidence-pack/:runId', '/evidence-pack/RUN-1042', reports.EvidencePackPage],
  ['Studio AI review', '/studio-review', '/studio-review', reports.StudioReviewPage],
  ['404', '*', '/nope', misc.NotFoundPage],
  ['Design system', '/kitchen-sink', '/kitchen-sink', misc.KitchenSinkPage],
]

// the states a visitor reaches after pressing something: discovery run, the
// map corrected, and a project chosen in the header
store.setDiscoveryRun()
store.applyProcessFeedback()

const SECOND_PASS: Case[] = [
  ['Discovery map, corrected', '/discovery/map', '/discovery/map', discovery.ProcessMapPage],
  ['Discovery compare, run', '/discovery/compare', '/discovery/compare', discovery.ProcedureComparePage],
  ['Schedules, one project', '/run/schedules', '/run/schedules?project=sap-nov', run.SchedulesPage],
  ['Run Centre, one project', '/run', '/run?project=d365-recycling', run.RunCentrePage],
  ['Regression, one project', '/regression', '/regression?project=yard-app', regression.ChangeImpactPage],
  ['Interfaces, filtered', '/interfaces', '/interfaces?type=Financial&status=matched', interfaces.InterfacesPage],
]
CASES.push(...SECOND_PASS)

let failed = 0
for (const [label, pattern, path, Comp] of CASES) {
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <RoleProvider>
            <ToastProvider>
              <DrawerProvider>
                <Routes>
                  <Route path={pattern} element={<Comp />} />
                </Routes>
              </DrawerProvider>
            </ToastProvider>
          </RoleProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )
    if (html.length < 400) throw new Error(`rendered only ${html.length} characters`)
    console.log(`  ok    ${label.padEnd(32)} ${String(html.length).padStart(7)} chars`)
  } catch (err) {
    failed += 1
    console.error(`  FAIL  ${label}`)
    console.error(`        ${(err as Error).message}`)
  }
}

console.log('')
if (failed) {
  console.error(`${failed} of ${CASES.length} pages failed to render.`)
  process.exit(1)
}
console.log(`All ${CASES.length} pages rendered without throwing.\n`)
process.exit(0)
