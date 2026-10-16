import { Suspense } from 'react'
import { HashRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/routes'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { RoleProvider } from '@/providers/RoleProvider'
import { ToastProvider } from '@/providers/ToastProvider'
import { DrawerProvider } from '@/providers/DrawerProvider'

export default function App() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <ToastProvider>
          <DrawerProvider>
            <HashRouter>
              <a
                href="#main-scroll"
                className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-fg"
              >
                Skip to content
              </a>
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading…</div>}>
                <AppRoutes />
              </Suspense>
            </HashRouter>
          </DrawerProvider>
        </ToastProvider>
      </RoleProvider>
    </ThemeProvider>
  )
}
