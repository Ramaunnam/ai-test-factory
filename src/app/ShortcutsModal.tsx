import { Modal } from '@/components/ui'

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navigation',
    items: [
      ['Ctrl K', 'Open the command palette'],
      ['g then h', 'Command Centre health'],
      ['g then f', 'Live Data Flow'],
      ['g then c', 'Live checks'],
      ['g then t', 'Trace'],
      ['g then r', 'Run Centre'],
      ['[  ]', 'Previous and next tab'],
    ],
  },
  {
    title: 'View',
    items: [
      ['\\', 'Collapse or expand the menu'],
      ['Shift D', 'Light, dark, then follow the system'],
      ['?', 'This list'],
      ['Esc', 'Close the top-most panel'],
    ],
  },
  {
    title: 'Simulation',
    items: [
      ['Space', 'Run or pause the plant (on Live Data Flow)'],
      ['Ctrl K then “truck”', 'Send a truck through the gate'],
      ['Ctrl K then “faults off”', 'Turn every fault off and replay'],
    ],
  },
]

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" subtitle="Everything here is reachable without a mouse." width={620}>
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2 text-label font-semibold uppercase text-subtle">{g.title}</div>
            <ul className="space-y-1.5">
              {g.items.map(([key, what]) => (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{what}</span>
                  <kbd className="shrink-0">{key}</kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
