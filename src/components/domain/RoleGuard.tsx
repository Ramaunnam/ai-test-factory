import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Button, Card, CardBody } from '@/components/ui'
import { useRole } from '@/providers/RoleProvider'
import { locate } from '@/app/nav.config'

export function RoleGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { role, setRole } = useRole()
  const navigate = useNavigate()
  const here = locate(pathname)

  if (!here || here.item.roles.includes(role)) return <>{children}</>

  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface2 text-subtle">
          <Lock size={18} />
        </div>
        <h1 className="text-lg font-semibold text-text">{here.item.label} is not part of the {role} view</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {here.item.blurb}. The {role} view leaves this page out on purpose, so the menu stays short and the numbers
          stay relevant.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setRole('Key User')
            }}
          >
            Switch to Key User
          </Button>
          <Button onClick={() => navigate('/')}>Back to the Command Centre</Button>
        </div>
      </CardBody>
    </Card>
  )
}
