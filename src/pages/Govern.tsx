import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Map as MapIcon, Plus, RefreshCw, ShieldAlert, Signal, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Input,
  LiveLog,
  Modal,
  SectionTitle,
  Select,
  StatTile,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { SOD_CONFLICTS, SOD_RULES } from '@/data'
import { SourceNote } from '@/components/domain/SourceNote'
import { store, useStore } from '@/data/appStore'
import { useToast } from '@/providers/ToastProvider'
import { useDrawer } from '@/providers/DrawerProvider'
import { num } from '@/lib/format'

/* -------------------------------------------------------------------------- */
/* Approvals                                                                  */
/* -------------------------------------------------------------------------- */

export function ApprovalsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const appState = useStore()
  const [comment, setComment] = useState<Record<string, string>>({})

  const pending = appState.approvals.filter((a) => a.status === 'Pending')
  const decided = appState.approvals.filter((a) => a.status !== 'Pending')

  const decide = (id: string, status: 'Approved' | 'Rejected') => {
    store.decideApproval(id, status, comment[id])
    toast({
      title: `${id} ${status.toLowerCase()}`,
      description: comment[id] ? `Comment: ${comment[id]}` : undefined,
      tone: status === 'Approved' ? 'success' : 'warning',
    })
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Nothing the AI produces goes live without a key user saying yes. This is that queue."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Pending" value={num(pending.length)} tone={pending.length ? 'warning' : 'success'} />
        <StatTile label="Approved" value={num(appState.approvals.filter((a) => a.status === 'Approved').length)} tone="success" />
        <StatTile label="Rejected" value={num(appState.approvals.filter((a) => a.status === 'Rejected').length)} tone="danger" />
        <StatTile label="Scenarios waiting" value={num(Object.values(appState.scenarioStatus).filter((s) => s === 'Pending approval').length)} onClick={() => navigate('/studio')} />
      </div>

      <SectionTitle title="Waiting for you" />
      {pending.length === 0 ? (
        <EmptyState
          icon={<Check size={26} />}
          title="The queue is empty"
          description="Generate scenarios or let self-healing propose a repair, and they will appear here."
          action={<Button onClick={() => navigate('/studio')}>Open Test Studio</Button>}
        />
      ) : (
        <div className="mb-5 grid gap-3">
          {pending.map((a) => (
            <Card key={a.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <Badge tone={a.kind === 'Release' ? 'danger' : a.kind === 'Self-healing' ? 'ai' : 'info'}>{a.kind}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text">{a.title}</div>
                    <div className="text-xs text-muted">{a.detail}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-subtle">
                      {a.id} · requested {a.requested}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(a.route)}>
                    Look at it
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Add a comment (optional)"
                    value={comment[a.id] ?? ''}
                    onChange={(e) => setComment((c) => ({ ...c, [a.id]: e.target.value }))}
                    className="min-w-[220px] flex-1"
                  />
                  <Button variant="primary" leftIcon={<Check size={15} />} onClick={() => decide(a.id, 'Approved')}>
                    Approve
                  </Button>
                  <Button variant="danger" leftIcon={<X size={15} />} onClick={() => decide(a.id, 'Rejected')}>
                    Reject
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <SectionTitle title="Already decided" />
          <Card>
            <DataTable
              rows={decided}
              rowKey={(a) => a.id}
              onRowClick={(a) => navigate(a.route)}
              columns={[
                { key: 'id', header: 'Item', mono: true, width: 90 },
                { key: 'kind', header: 'Kind', width: 130 },
                { key: 'title', header: 'What it was' },
                { key: 'comment', header: 'Comment', render: (a) => a.comment ?? '—' },
                {
                  key: 'status',
                  header: 'Decision',
                  width: 120,
                  render: (a) => <Badge tone={a.status === 'Approved' ? 'success' : 'danger'}>{a.status}</Badge>,
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Roles and SoD                                                              */
/* -------------------------------------------------------------------------- */

export function AccessSodPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const drawer = useDrawer()
  const appState = useStore()
  const [proving, setProving] = useState<string | null>(null)

  const roles = Array.from(new Set(SOD_RULES.flatMap((r) => [r.roleA, r.roleB])))

  const prove = (conflictUser: string, ruleId: string) => {
    const rule = SOD_RULES.find((r) => r.id === ruleId)!
    setProving(conflictUser)
    const lines = [
      `Signing in to the test environment as ${conflictUser}…`,
      `Attempting the first action: ${rule.roleA}…`,
      'First action completed.',
      `Attempting the forbidden second action: ${rule.roleB}…`,
      'Second action completed. The system allowed it.',
      'Capturing the screen, the document numbers and the timestamps as evidence.',
    ]
    drawer.open({
      title: `Proving ${rule.id} for ${conflictUser}`,
      subtitle: rule.name,
      width: 'lg',
      content: (
        <div className="space-y-4">
          <LiveLog lines={lines} running height={180} />
          <div className="rounded-md border border-danger/40 bg-danger-soft/40 px-4 py-3">
            <div className="text-sm font-semibold text-danger">Result: Allowed</div>
            <p className="mt-1 text-xs text-muted">
              The forbidden combination completed without a block. {rule.why}
            </p>
          </div>
          <Button
            variant="danger"
            fullWidth
            leftIcon={<ShieldAlert size={15} />}
            onClick={() => {
              const id = store.addFinding({
                title: `${rule.name} is allowed for ${conflictUser}`,
                severity: rule.risk === 'High' ? 'Critical' : 'High',
                status: 'Open',
                process: 'P3',
                stage: 'Purchase order',
                system: 'SAP S/4HANA Stainless',
                raised: new Date().toLocaleString('en-GB'),
                raisedBy: 'Access agent',
                detail: `${rule.why} The proof run completed both actions as ${conflictUser} with no block.`,
                evidence: [`SoD rule ${rule.id}`, 'Proof run just now', 'Screen capture and document numbers'],
                affectedKeys: [],
              })
              toast({ title: `Finding ${id} raised`, tone: 'danger' })
              drawer.closeAll()
              setProving(null)
              navigate(`/finding/${id}`)
            }}
          >
            Raise it as a finding with this evidence
          </Button>
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Roles & SoD"
        subtitle="Segregation of duty is not a document. Here it is tested: the forbidden action is actually attempted."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Rules" value={num(SOD_RULES.length)} />
        <StatTile label="Users in conflict" value={num(SOD_CONFLICTS.length)} tone="warning" />
        <StatTile label="Open conflicts" value={num(SOD_CONFLICTS.filter((c) => c.status === 'Open').length)} tone="danger" />
        <StatTile label="Proven by a run" value={num(SOD_CONFLICTS.filter((c) => c.status === 'Proven').length)} tone="danger" />
      </div>

      <Card className="mb-4">
        <CardHeader title="Conflict matrix" subtitle="A cross means the two roles must never be held by the same person." />
        <div className="j2w-scroll overflow-x-auto p-4">
          <table className="min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-2 text-left text-label uppercase text-subtle">Role</th>
                {roles.map((r) => (
                  <th key={r} className="border-b border-line px-3 py-2 text-left text-label uppercase text-subtle">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((a) => (
                <tr key={a} className="border-b border-line/70">
                  <td className="px-3 py-2 font-medium text-text">{a}</td>
                  {roles.map((b) => {
                    const rule = SOD_RULES.find(
                      (r) => (r.roleA === a && r.roleB === b) || (r.roleA === b && r.roleB === a),
                    )
                    return (
                      <td key={b} className="px-3 py-2">
                        {a === b ? (
                          <span className="text-subtle">—</span>
                        ) : rule ? (
                          <button
                            type="button"
                            title={`${rule.id} · ${rule.name}`}
                            onClick={() => navigate('/access-sod')}
                            className={cn(
                              'grid h-6 w-6 place-items-center rounded-sm font-mono text-[11px]',
                              rule.risk === 'High' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent',
                            )}
                          >
                            ×
                          </button>
                        ) : (
                          <span className="text-subtle">·</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="The rules" />
        <DataTable
          rows={SOD_RULES}
          rowKey={(r) => r.id}
          columns={[
            { key: 'id', header: 'Rule', mono: true, width: 90 },
            { key: 'name', header: 'Must not be combined' },
            { key: 'roleA', header: 'Role A', width: 160 },
            { key: 'roleB', header: 'Role B', width: 170 },
            { key: 'risk', header: 'Risk', width: 100, render: (r) => <Badge tone={r.risk === 'High' ? 'danger' : 'warning'}>{r.risk}</Badge> },
            { key: 'why', header: 'Why it matters', render: (r) => <span className="text-xs text-muted">{r.why}</span> },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Users in conflict" subtitle="Prove it runs the forbidden action in the test environment and captures the evidence." />
        <DataTable
          rows={SOD_CONFLICTS}
          rowKey={(c) => c.user}
          rowTone={(c) => (c.status === 'Open' || c.status === 'Proven' ? 'danger' : undefined)}
          columns={[
            { key: 'user', header: 'User', width: 140 },
            { key: 'role', header: 'Roles held' },
            { key: 'rule', header: 'Rule', mono: true, width: 100 },
            {
              key: 'status',
              header: 'Status',
              width: 120,
              render: (c) => (
                <Badge tone={c.status === 'Accepted' ? 'neutral' : c.status === 'Proven' ? 'danger' : 'warning'}>{c.status}</Badge>
              ),
            },
            {
              key: 'proof',
              header: 'Finding',
              width: 110,
              render: (c) =>
                c.proof ? (
                  <Button size="sm" variant="link" onClick={() => navigate(`/finding/${c.proof}`)}>
                    {c.proof}
                  </Button>
                ) : (
                  '—'
                ),
            },
            {
              key: 'prove',
              header: '',
              sortable: false,
              width: 110,
              render: (c) => (
                <Button size="sm" loading={proving === c.user} onClick={() => prove(c.user, c.rule)}>
                  Prove it
                </Button>
              ),
            },
          ]}
        />
        <SourceNote
          title="How a conflict is proven"
          reads={[
            { label: 'Role assignments', note: 'who holds which role in the test environment' },
            { label: 'SoD rules', note: 'the combinations that must never meet' },
          ]}
          computes="signs in as the user, attempts the forbidden second action, and records what the system allowed"
          feeds={[{ label: 'Findings', route: '/run' }, { label: 'Release gate', route: '/release' }]}
          steps={[
            'The rule says two roles must not be held by one person.',
            'Prove it signs in as that user and performs the first action.',
            'It then attempts the forbidden second action and records the result.',
            'Allowed means the control does not work, which becomes a finding with the evidence attached.',
          ]}
        />
      </Card>

      <p className="mt-3 text-xs text-subtle">
        {appState.findings.filter((f) => f.raisedBy === 'Access agent').length} findings on this page were raised by the
        Access agent.
      </p>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Connected systems                                                          */
/* -------------------------------------------------------------------------- */

export function SystemsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const appState = useStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'ERP', method: 'REST', endpoint: '', account: '' })

  return (
    <>
      <PageHeader
        title="Connected Systems"
        subtitle="Every connection is read only. The factory observes the landscape; it never writes to production."
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            Add a connection
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Connections" value={num(appState.connections.length)} />
        <StatTile label="Connected" value={num(appState.connections.filter((c) => c.status === 'Connected').length)} tone="success" />
        <StatTile label="Degraded" value={num(appState.connections.filter((c) => c.status === 'Degraded').length)} tone="warning" />
        <StatTile label="Pending" value={num(appState.connections.filter((c) => c.status === 'Pending').length)} tone="info" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {appState.connections.map((c) => (
          <Card key={c.id} tone={c.status === 'Degraded' ? 'warning' : c.status === 'Pending' ? 'ai' : 'default'}>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2">
                <Signal
                  size={16}
                  className={cn(
                    'mt-0.5 shrink-0',
                    c.status === 'Connected' ? 'text-success' : c.status === 'Degraded' ? 'text-accent' : 'text-info',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-text">{c.name}</div>
                  <div className="truncate text-xs text-muted">
                    {c.type} · {c.method}
                  </div>
                </div>
                <Badge tone={c.status === 'Connected' ? 'success' : c.status === 'Degraded' ? 'warning' : 'info'}>{c.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <div className="text-label uppercase text-subtle">Response</div>
                  <div className={cn('font-mono', c.responseMs > 250 ? 'text-accent' : 'text-text')}>
                    {c.responseMs ? `${c.responseMs} ms` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-label uppercase text-subtle">Last sync</div>
                  <div className="font-mono text-text">{c.lastSync}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-label uppercase text-subtle">Service account</div>
                  <div className="truncate font-mono text-text">{c.account}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-label uppercase text-subtle">Endpoint</div>
                  <div className="truncate font-mono text-[11px] text-muted" title={c.endpoint}>
                    {c.endpoint}
                  </div>
                </div>
              </div>

              {c.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.sources.map((s) => (
                    <Badge key={s} mono>
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={testing === c.id}
                  onClick={() => {
                    setTesting(c.id)
                    window.setTimeout(() => {
                      setTesting(null)
                      const ms = 60 + Math.round(Math.random() * 240)
                      store.setConnectionStatus(c.id, ms > 250 ? 'Degraded' : 'Connected', ms)
                      toast({
                        title: `${c.name} answered in ${ms} ms`,
                        tone: ms > 250 ? 'warning' : 'success',
                      })
                    }, 900)
                  }}
                >
                  Test connection
                </Button>
                <Button
                  size="sm"
                  leftIcon={<RefreshCw size={13} />}
                  onClick={() => {
                    store.setConnectionStatus(c.id, c.status === 'Pending' ? 'Connected' : c.status)
                    toast({ title: `${c.name} synced`, description: 'Read-only pull of the latest records.', tone: 'info' })
                  }}
                >
                  Sync
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<MapIcon size={13} />} onClick={() => navigate(`/landscape?system=${c.id}`)}>
                  On map
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a connection"
        subtitle="Read-only credentials only. The vault reference is stored, never the secret."
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!form.name || !form.endpoint}
              onClick={() => {
                store.addConnection({
                  id: form.name.toLowerCase().replace(/\s+/g, '-'),
                  name: form.name,
                  type: form.type,
                  method: form.method,
                  endpoint: form.endpoint,
                  account: form.account || 'vault://j2w/test/readonly',
                })
                setAddOpen(false)
                setForm({ name: '', type: 'ERP', method: 'REST', endpoint: '', account: '' })
                toast({ title: `${form.name} added`, description: 'Status is Pending until the first successful test.', tone: 'info' })
              }}
            >
              Add the connection
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Warehouse Control System" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-label font-semibold uppercase text-subtle">Type</label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option>ERP</option>
                <option>MES</option>
                <option>LIMS</option>
                <option>In-house web app</option>
                <option>Document output</option>
                <option>Treasury</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-label font-semibold uppercase text-subtle">Method</label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option>REST</option>
                <option>OData</option>
                <option>IDoc</option>
                <option>File drop</option>
                <option>SFTP</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Endpoint</label>
            <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://wcs.test.internal/api" />
          </div>
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Vault reference</label>
            <Textarea
              rows={2}
              value={form.account}
              onChange={(e) => setForm({ ...form, account: e.target.value })}
              placeholder="vault://j2w/test/wcs-readonly"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
