import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  DataTable,
  Disclosure,
  EmptyState,
  Gauge,
  Input,
  Modal,
  Progress,
  RiskDial,
  SearchInput,
  SectionTitle,
  SegmentedControl,
  Skeleton,
  StatTile,
  Switch,
  type Tone,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'
import { useTheme } from '@/providers/ThemeProvider'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={<Compass size={30} />}
      title="That page does not exist"
      description="The address you opened is not part of the factory. These are the three places people usually want."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => navigate('/')}>
            Command Centre
          </Button>
          <Button onClick={() => navigate('/flow')}>Live Data Flow</Button>
          <Button onClick={() => navigate('/run')}>Run Centre</Button>
        </div>
      }
    />
  )
}

const TONES: Tone[] = ['neutral', 'primary', 'success', 'danger', 'warning', 'info', 'ai']

export function KitchenSinkPage() {
  const drawer = useDrawer()
  const toast = useToast()
  const { mode, setMode } = useTheme()
  const [on, setOn] = useState(true)
  const [seg, setSeg] = useState('a')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)

  return (
    <>
      <PageHeader
        title="Design system"
        subtitle="Every primitive in one page, so light and dark can be checked at a glance. Not in the menu; reachable from the command palette."
        actions={
          <SegmentedControl
            value={mode}
            onChange={setMode}
            ariaLabel="Theme"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        }
      />

      <SectionTitle title="Buttons" />
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          {(['primary', 'secondary', 'ghost', 'danger', 'ai', 'link'] as const).map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
          <Button loading>loading</Button>
          <Button disabled>disabled</Button>
          <Button size="sm">small</Button>
          <Button size="lg">large</Button>
        </CardBody>
      </Card>

      <SectionTitle title="Badges and chips" />
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          {TONES.map((t) => (
            <Badge key={t} tone={t} dot>
              {t}
            </Badge>
          ))}
          <Chip selected>selected chip</Chip>
          <Chip>plain chip</Chip>
          <Chip tone="danger">failing chip</Chip>
        </CardBody>
      </Card>

      <SectionTitle title="Form controls" />
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-4">
          <Input placeholder="Input" className="w-48" />
          <SearchInput value={q} onChange={setQ} className="w-56" />
          <Switch checked={on} onChange={setOn} label="A switch" description="With a description" />
          <SegmentedControl
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'a', label: 'One' },
              { value: 'b', label: 'Two' },
              { value: 'c', label: 'Three' },
            ]}
          />
        </CardBody>
      </Card>

      <SectionTitle title="Data display" />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gauge, dial and progress" />
          <CardBody className="flex flex-wrap items-center gap-6">
            <Gauge value={79} caption="Confidence" />
            <RiskDial value={86} />
            <div className="w-40 space-y-2">
              <Progress value={82} tone="success" />
              <Progress value={54} tone="warning" />
              <Progress value={23} tone="danger" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tiles and skeletons" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Plain tile" value="1 284" hint="with a hint" />
              <StatTile label="Clickable" value="9" tone="danger" hint="opens something" onClick={() => toast({ title: 'Tile clicked', tone: 'info' })} />
            </div>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </CardBody>
        </Card>
      </div>

      <SectionTitle title="Table" />
      <Card className="mb-4">
        <DataTable
          rows={[
            { id: 'GP-PL01-2026-4182', net: 24860, status: 'Clean' },
            { id: 'GP-PL01-2026-4190', net: 21920, status: 'Failing' },
            { id: 'GP-PL03-2026-1174', net: 26040, status: 'Clean' },
          ]}
          rowKey={(r) => r.id}
          searchable
          rowTone={(r) => (r.status === 'Failing' ? 'danger' : undefined)}
          onRowClick={() => toast({ title: 'Row clicked', tone: 'info' })}
          columns={[
            { key: 'id', header: 'Gate pass', mono: true },
            { key: 'net', header: 'Net kg', align: 'right', mono: true },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Clean' ? 'success' : 'danger'}>{r.status}</Badge> },
          ]}
        />
      </Card>

      <SectionTitle title="Overlays" />
      <Card>
        <CardBody className="flex flex-wrap gap-2">
          <Button onClick={() => drawer.open({ title: 'A drawer', subtitle: 'Esc closes it', content: <p className="text-sm text-muted">Drawers stack up to two levels and trap focus.</p> })}>
            Open a drawer
          </Button>
          <Button onClick={() => setModal(true)}>Open a modal</Button>
          {TONES.slice(0, 5).map((t) => (
            <Button
              key={t}
              onClick={() =>
                toast({
                  title: `A ${t} toast`,
                  description: 'With an optional action.',
                  tone: t === 'primary' ? 'info' : (t as 'neutral' | 'success' | 'danger' | 'warning' | 'info'),
                  action: { label: 'Do the thing', onClick: () => undefined },
                })
              }
            >
              {t} toast
            </Button>
          ))}
          <Disclosure summary="A disclosure">
            <p className="text-sm text-muted">Hidden technical detail lives here.</p>
          </Disclosure>
        </CardBody>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="A modal" subtitle="Esc, the scrim and the close button all work." footer={<Button variant="primary" onClick={() => setModal(false)}>Done</Button>}>
        <p className="text-sm text-muted">Modals are centred, trap focus and never scroll the page behind them.</p>
      </Modal>
    </>
  )
}
