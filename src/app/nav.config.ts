import {
  Activity,
  ListOrdered,
  CheckSquare,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  PlugZap,
  Radar,
  ShieldCheck,
  Share2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/providers/RoleProvider'

export type NavGroup = 'OVERVIEW' | 'BUILD' | 'RUN' | 'GOVERN'

export interface NavTab {
  label: string
  path: string
}

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  group: NavGroup
  path: string
  tabs?: NavTab[]
  roles: Role[]
  counter?: 'approvals' | 'failingChecks' | 'runningRuns'
  blurb: string
}

const ALL: Role[] = ['Key User', 'QA Lead', 'Plant Head', 'Auditor']

export const NAV: NavItem[] = [
  {
    id: 'command-centre',
    label: 'Command Centre',
    icon: LayoutDashboard,
    group: 'OVERVIEW',
    path: '/',
    roles: ['Key User', 'QA Lead', 'Plant Head', 'Auditor'],
    blurb: 'Confidence score, workflow health and month-end readiness',
    tabs: [
      { label: 'Health', path: '/' },
      { label: 'Release & Close', path: '/release' },
      { label: 'Month-End Load', path: '/load' },
      { label: 'Impact Simulator', path: '/simulator' },
    ],
  },
  {
    id: 'landscape',
    label: 'Enterprise Map',
    icon: MapIcon,
    group: 'OVERVIEW',
    path: '/landscape',
    roles: ALL,
    blurb: 'Ten systems, four outside services, nineteen interfaces',
  },
  {
    id: 'journey',
    label: 'Testing Journey',
    icon: ListOrdered,
    group: 'OVERVIEW',
    path: '/journey',
    roles: ALL,
    blurb: 'The whole testing process as eight clear steps',
  },
  {
    id: 'ontology',
    label: 'Process Ontology',
    icon: Network,
    group: 'OVERVIEW',
    path: '/ontology',
    roles: ALL,
    blurb: 'How each workflow is modelled, and which agent works where',
    tabs: [
      { label: 'Workflows', path: '/ontology' },
      { label: 'Business Objects', path: '/ontology/objects' },
      { label: 'AI Agents', path: '/ontology/agents' },
      { label: 'Requirement Coverage', path: '/coverage' },
    ],
  },
  {
    id: 'discovery',
    label: 'Process Discovery',
    icon: Radar,
    group: 'BUILD',
    path: '/discovery',
    roles: ['Key User', 'QA Lead'],
    blurb: 'Turn recorded sessions and logs into a process map',
    tabs: [
      { label: 'Inputs', path: '/discovery' },
      { label: 'Process map', path: '/discovery/map' },
      { label: 'Procedure vs reality', path: '/discovery/compare' },
    ],
  },
  {
    id: 'studio',
    label: 'Test Studio',
    icon: FlaskConical,
    group: 'BUILD',
    path: '/studio',
    roles: ['Key User', 'QA Lead'],
    blurb: 'Generate, review and approve scenarios and test data',
    tabs: [
      { label: 'Scenarios', path: '/studio' },
      { label: 'Test Data', path: '/test-data' },
      { label: 'Master Data Check', path: '/studio/master-data' },
      { label: 'Record', path: '/studio/record' },
    ],
  },
  {
    id: 'flow',
    label: 'Live Data Flow',
    icon: Activity,
    group: 'RUN',
    path: '/flow',
    roles: ALL,
    counter: 'failingChecks',
    blurb: 'Watch the plant run and the data move between systems',
    tabs: [
      { label: 'Live Flow', path: '/flow' },
      { label: 'System Data', path: '/flow/data' },
      { label: 'Live Checks', path: '/flow/checks' },
      { label: 'Trace', path: '/flow/trace' },
    ],
  },
  {
    id: 'run',
    label: 'Run Centre',
    icon: Workflow,
    group: 'RUN',
    path: '/run',
    roles: ALL,
    blurb: 'Run scenarios step by step and keep the evidence',
    tabs: [
      { label: 'Runs', path: '/run' },
      { label: 'Schedules', path: '/run/schedules' },
      { label: 'Evidence & Reports', path: '/evidence' },
    ],
  },
  {
    id: 'interfaces',
    label: 'Interface Testing',
    icon: Share2,
    group: 'RUN',
    path: '/interfaces',
    roles: ['Key User', 'QA Lead', 'Auditor'],
    blurb: 'Every handoff between two systems, field by field',
  },
  {
    id: 'regression',
    label: 'Change & Regression',
    icon: GitCompareArrows,
    group: 'RUN',
    path: '/regression',
    roles: ALL,
    blurb: 'What a change touches, what healed, and what still differs',
    tabs: [
      { label: 'Change Impact', path: '/regression' },
      { label: 'Self-Healing', path: '/self-healing' },
      { label: 'Migration Reconciliation', path: '/reconciliation' },
    ],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: CheckSquare,
    group: 'GOVERN',
    path: '/approvals',
    roles: ['Key User'],
    counter: 'approvals',
    blurb: 'The key user queue for scenarios, healing and releases',
  },
  {
    id: 'access-sod',
    label: 'Roles & SoD',
    icon: ShieldCheck,
    group: 'GOVERN',
    path: '/access-sod',
    roles: ['Key User', 'Auditor'],
    blurb: 'Conflict matrix, users in conflict, and proof',
  },
  {
    id: 'systems',
    label: 'Connected Systems',
    icon: PlugZap,
    group: 'GOVERN',
    path: '/systems',
    roles: ['Key User'],
    blurb: 'Connections, service accounts and sync status',
  },
]

export const GROUP_ORDER: NavGroup[] = ['OVERVIEW', 'BUILD', 'RUN', 'GOVERN']

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role))
}

/** All routed paths, including tabs. */
export function allPaths(): { path: string; item: NavItem; tab?: NavTab }[] {
  const out: { path: string; item: NavItem; tab?: NavTab }[] = []
  NAV.forEach((item) => {
    if (item.tabs) item.tabs.forEach((tab) => out.push({ path: tab.path, item, tab }))
    else out.push({ path: item.path, item })
  })
  return out
}

export function locate(pathname: string) {
  const exact = allPaths().find((p) => p.path === pathname)
  if (exact) return exact
  // nested routes such as /finding/F-001 have no nav entry
  const prefix = allPaths()
    .filter((p) => p.path !== '/' && pathname.startsWith(p.path))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return prefix
}

export function itemOwning(pathname: string): NavItem | undefined {
  return locate(pathname)?.item
}
