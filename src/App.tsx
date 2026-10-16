import { Suspense } from 'react'
import { HashRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/routes'
import { ErrorBoundary } from '@/components/domain/ErrorBoundary'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { RoleProvider } from '@/providers/RoleProvider'
import { ToastProvider } from '@/providers/ToastProvider'
import { DrawerProvider } from '@/providers/DrawerProvider'

export default function App() {
  return (
    // The router is outermost on purpose: drawers, toasts and modals are
    // rendered by the providers, and anything inside them may navigate.
    <HashRouter>
      <ThemeProvider>
        <RoleProvider>
          <ToastProvider>
            <DrawerProvider>
              <ErrorBoundary>
                <button
                  type="button"
                  onClick={() => document.getElementById('main-scroll')?.focus()}
                  className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-fg"
                >
                  Skip to content
                </button>
                <Suspense
                  fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading…</div>}
                >
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </DrawerProvider>
          </ToastProvider>
        </RoleProvider>
      </ThemeProvider>
    </HashRouter>
  )
}
