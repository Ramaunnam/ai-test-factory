import { useSearchParams } from 'react-router-dom'

/**
 * Several change projects run at the same time. Everything the factory holds —
 * scenarios, runs, changes, findings and schedules — belongs to one of them, so
 * a QA lead can look at one project without losing the others.
 */
export interface Project {
  id: string
  name: string
  short: string
  release: string
  owner: string
  /** The systems this project changes. Anything touching them belongs to it. */
  systems: string[]
  /** The same systems by map id, so a change row can be matched too. */
  systemIds: string[]
  blurb: string
}

export const ALL_PROJECTS = 'all'

export const PROJECTS: Project[] = [
  {
    id: 'sap-nov',
    name: 'SAP release Nov',
    short: 'SAP Nov',
    release: 'R-2026.11',
    owner: 'QA Lead',
    systems: ['SAP S/4HANA – Steel', 'SAP S/4HANA – Service Centre', 'Esker', 'Lasernet', 'Reval'],
    systemIds: ['sap-steel', 'sap-sc', 'esker', 'lasernet', 'reval', 'vat', 'sanctions', 'ebanking', 'fx'],
    blurb: 'The November SAP transport: invoice matching, document output and the payment run.',
  },
  {
    id: 'd365-recycling',
    name: 'D365 recycling update',
    short: 'D365',
    release: 'R-2026.11-D365',
    owner: 'Key User',
    systems: ['D365 F&O – Recycling', 'Scrap Yard Operations', 'Laboratory app'],
    systemIds: ['d365', 'scrap', 'lab'],
    blurb: 'Stock units, quality orders and yard transfers in the recycling business.',
  },
  {
    id: 'yard-app',
    name: 'Yard app release',
    short: 'Yard',
    release: 'R-2026.10-YD',
    owner: 'Plant Head',
    systems: ['Yard Management', 'Mill Execution System'],
    systemIds: ['yard', 'mill'],
    blurb: 'The gate, the weighbridge and the mill confirmation.',
  },
]

export function projectById(id: string | null | undefined): Project | undefined {
  return PROJECTS.find((p) => p.id === id)
}

/** The project that owns a system, by display name or by map id. */
export function projectOfSystem(system: string | null | undefined): string | undefined {
  if (!system) return undefined
  const hit = PROJECTS.find((p) => p.systems.includes(system) || p.systemIds.includes(system))
  return hit?.id
}

/** Where a scenario lands decides who owns it, so the last system wins. */
export function projectOfSystems(systems: string[]): string | undefined {
  for (let i = systems.length - 1; i >= 0; i -= 1) {
    const hit = projectOfSystem(systems[i])
    if (hit) return hit
  }
  return undefined
}

const PROCESS_PROJECT: Record<string, string> = {
  P1: 'sap-nov',
  P2: 'd365-recycling',
  P3: 'sap-nov',
  P4: 'yard-app',
  P5: 'sap-nov',
  P6: 'd365-recycling',
}

/**
 * A run covering one workflow belongs to that workflow's project. A run that
 * covers everything belongs to all of them, so it is never filtered away.
 */
export function projectOfProcess(process: string | null | undefined): string | undefined {
  if (!process || process === 'All') return undefined
  return PROCESS_PROJECT[process]
}

/** The project filter, kept in the address bar so a view can be shared. */
export function useProjectFilter() {
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') ?? ALL_PROJECTS
  const project = projectById(projectId)

  const setProject = (id: string) => {
    const next = new URLSearchParams(params)
    if (!id || id === ALL_PROJECTS) next.delete('project')
    else next.set('project', id)
    setParams(next, { replace: true })
  }

  /** Undefined means "belongs to every project", so it always shows. */
  const matches = (owner: string | undefined) => projectId === ALL_PROJECTS || !owner || owner === projectId

  return { projectId, project, setProject, matches, filtering: projectId !== ALL_PROJECTS }
}
