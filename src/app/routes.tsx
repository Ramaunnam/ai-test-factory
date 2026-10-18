import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'

const page = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() =>
    loader().then((m) => ({ default: m[name] as unknown as React.ComponentType })),
  )

const cc = () => import('@/pages/CommandCentre')
const flow = () => import('@/pages/Flow')
const ontology = () => import('@/pages/Ontology')
const studio = () => import('@/pages/Studio')
const run = () => import('@/pages/RunCentre')
const regression = () => import('@/pages/Regression')
const govern = () => import('@/pages/Govern')
const reports = () => import('@/pages/Reports')
const misc = () => import('@/pages/Misc')

const HealthPage = page(cc, 'HealthPage')
const ReleasePage = page(cc, 'ReleasePage')
const LoadPage = page(cc, 'LoadPage')
const SimulatorPage = page(cc, 'SimulatorPage')
const OfferPage = page(cc, 'OfferPage')
const JourneyPage = page(() => import('@/pages/Journey'), 'JourneyPage')
const LandscapePage = page(() => import('@/pages/Landscape'), 'LandscapePage')
const OntologyPage = page(ontology, 'OntologyPage')
const AgentsPage = page(ontology, 'AgentsPage')
const CoveragePage = page(ontology, 'CoveragePage')
const discovery = () => import('@/pages/Discovery')
const DiscoveryPage = page(discovery, 'DiscoveryPage')
const ProcessMapPage = page(discovery, 'ProcessMapPage')
const ProcedureComparePage = page(discovery, 'ProcedureComparePage')
const StudioPage = page(studio, 'StudioPage')
const TestDataPage = page(studio, 'TestDataPage')
const RecordPage = page(studio, 'RecordPage')
const MasterDataPage = page(studio, 'MasterDataPage')
const LiveFlowPage = page(flow, 'LiveFlowPage')
const SystemDataPage = page(flow, 'SystemDataPage')
const LiveChecksPage = page(flow, 'LiveChecksPage')
const TracePage = page(flow, 'TracePage')
const RunCentrePage = page(run, 'RunCentrePage')
const EvidencePage = page(run, 'EvidencePage')
const SchedulesPage = page(run, 'SchedulesPage')
const InterfacesPage = page(() => import('@/pages/Interfaces'), 'InterfacesPage')
const ChangeImpactPage = page(regression, 'ChangeImpactPage')
const SelfHealingPage = page(regression, 'SelfHealingPage')
const ReconciliationPage = page(regression, 'ReconciliationPage')
const ApprovalsPage = page(govern, 'ApprovalsPage')
const AccessSodPage = page(govern, 'AccessSodPage')
const SystemsPage = page(govern, 'SystemsPage')
const FindingPage = page(reports, 'FindingPage')
const RunReportPage = page(reports, 'RunReportPage')
const ReleaseReportPage = page(reports, 'ReleaseReportPage')
const EvidencePackPage = page(reports, 'EvidencePackPage')
const NotFoundPage = page(misc, 'NotFoundPage')
const KitchenSinkPage = page(misc, 'KitchenSinkPage')

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HealthPage />} />
        <Route path="/release" element={<ReleasePage />} />
        <Route path="/load" element={<LoadPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/offer" element={<OfferPage />} />
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/landscape" element={<LandscapePage />} />
        <Route path="/ontology" element={<OntologyPage />} />
        <Route path="/ontology/agents" element={<AgentsPage />} />
        <Route path="/coverage" element={<CoveragePage />} />
        <Route path="/discovery" element={<DiscoveryPage />} />
        <Route path="/discovery/map" element={<ProcessMapPage />} />
        <Route path="/discovery/compare" element={<ProcedureComparePage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/test-data" element={<TestDataPage />} />
        <Route path="/studio/master-data" element={<MasterDataPage />} />
        <Route path="/studio/record" element={<RecordPage />} />
        <Route path="/flow" element={<LiveFlowPage />} />
        <Route path="/flow/data" element={<SystemDataPage />} />
        <Route path="/flow/checks" element={<LiveChecksPage />} />
        <Route path="/flow/trace" element={<TracePage />} />
        <Route path="/run" element={<RunCentrePage />} />
        <Route path="/run/schedules" element={<SchedulesPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/interfaces" element={<InterfacesPage />} />
        <Route path="/regression" element={<ChangeImpactPage />} />
        <Route path="/self-healing" element={<SelfHealingPage />} />
        <Route path="/reconciliation" element={<ReconciliationPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/access-sod" element={<AccessSodPage />} />
        <Route path="/systems" element={<SystemsPage />} />
        <Route path="/kitchen-sink" element={<KitchenSinkPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* print-ready pages, no app shell */}
      <Route path="/finding/:id" element={<FindingPage />} />
      <Route path="/report/:runId" element={<RunReportPage />} />
      <Route path="/release-report/:id" element={<ReleaseReportPage />} />
      <Route path="/evidence-pack/:runId" element={<EvidencePackPage />} />
    </Routes>
  )
}
