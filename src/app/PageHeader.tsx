import type { ReactNode } from 'react'
import { TabBar, type TabBarTab } from './TabBar'

export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  tabs?: TabBarTab[]
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <div className="mt-3 no-print">
          <TabBar tabs={tabs} />
        </div>
      )}
    </div>
  )
}
