import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Role = 'Key User' | 'QA Lead' | 'Plant Head' | 'Auditor'

export interface RoleDef {
  id: Role
  description: string
  landing: string
  readOnly: boolean
}

export const ROLES: RoleDef[] = [
  {
    id: 'Key User',
    description: 'Super user. Sees and approves everything.',
    landing: '/',
    readOnly: false,
  },
  {
    id: 'QA Lead',
    description: 'Builds and runs tests. No governance pages.',
    landing: '/run',
    readOnly: false,
  },
  {
    id: 'Plant Head',
    description: 'Business view of risk and readiness. Read only.',
    landing: '/simulator',
    readOnly: true,
  },
  {
    id: 'Auditor',
    description: 'Evidence and access control. Read only.',
    landing: '/evidence',
    readOnly: true,
  },
]

interface RoleCtx {
  role: Role
  def: RoleDef
  setRole: (r: Role) => void
}

const Ctx = createContext<RoleCtx | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('Key User')
  const setRole = useCallback((r: Role) => setRoleState(r), [])
  const def = ROLES.find((r) => r.id === role) ?? ROLES[0]
  const value = useMemo(() => ({ role, def, setRole }), [role, def, setRole])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRole() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRole must be used inside RoleProvider')
  return ctx
}
