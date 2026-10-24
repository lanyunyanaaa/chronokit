import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { App, Button, DatePicker, InputNumber, Segmented, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClearOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { buildEditsPlan, type FileEdits } from '@core/plan'
import type { JournalOp } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useMediaStore } from '@renderer/store/mediaStore'
import { useTableStore } from '@renderer/store/tableStore'
import { useTaskStore } from '@renderer/store/taskStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PlanModal from '@renderer/components/PlanModal'
import PageShell from '@renderer/components/PageShell'
import OptionBar from '@renderer/components/OptionBar'
import Thumb from '@renderer/components/Thumb'
import { formatDuration } from '@renderer/utils/format'

const isWin = navigator.userAgent.includes('Windows')
const fmt = (ms: number): string => dayjs(ms).format('YYYY-MM-DD HH:mm:ss')

type TimeField = 'metadata' | 'mtime' | 'ctime'
type BatchOp = 'set' | 'shift' | 'copy'

/** The effective (edited-or-original) value of one time field, ms or undefined. */
function effectiveValue(
  item: { creationTimeIso?: string; mtimeMs: number; birthtimeMs: number },
  edit: FileEdits | undefined,
  field: TimeField
): number | undefined {
  if (field === 'metadata') return edit?.metadataMs ?? (item.creationTimeIso ? new Date(item.creationTimeIso).getTime() : undefined)
  if (field === 'mtime') return edit?.mtimeMs ?? item.mtimeMs
  return edit?.ctimeMs ?? item.birthtimeMs
}

export default function BatchTablePage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const tablePaths = useMediaStore((s) => s.lists.table)
  const items = useMediaStore((s) => s.items)
  const busy = useTaskStore((s) => s.busy)
  const edits = useTableStore((s) => s.edits)

  const [sel, setSel] = useState<string[]>([])
  const [opts, setOpts] = useState({ metadata: true, mtime: true, ctime: false })
  const [planOpen, setPlanOpen] = useState(false)
  const [editing, setEditing] = useState<{ path: string; field: TimeField } | null>(null)

  // batch op toolbar state
  const [op, setOp] = useState<BatchOp>('shift')
  const [targetField, setTargetField] = useState<TimeField>('metadata')
  const [sourceField, setSourceField] = useState<TimeField | 'filename'>('filename')
  const [opDate, setOpDate] = useState<Dayjs | null>(null)
  const [opHours, setOpHours] = useState(8)
  const [opMinutes, setOpMinutes] = useState(0)

  // measured panel height -> antd virtual scroll.y
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tableH, setTableH] = useState(420)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTableH(Math.max(200, el.clientHeight - 56)))
    ro.observe(el)
    setTableH(Math.max(200, el.clientHeight - 56))
    return () => ro.disconnect()
  }, [])

  const rows = useMemo(
    () =>
      tablePaths.flatMap((p) => {
        const i = items[p]
        if (!i) return []
        return [{ ...i, edit: edits[p] }]
      }),
    [tablePaths, items, edits]
  )

  const dirtyCount = Object.keys(edits).filter((p) => p in items).length

  const plan = useMemo(
    () =>
      buildEditsPlan(
        rows.map((r) => ({
          path: r.path,
          name: r.name,
          creationTimeIso: r.creationTimeIso ?? null,
          filenameTimeIso: r.filenameTimeIso ?? null,
          mtimeMs: r.mtimeMs,
          birthtimeMs: r.birthtimeMs
        })),
        edits,
        isWin
      ),
    [rows, edits]
  )

  const applyBatch = (): void => {
    const scope = sel.length ? sel : tablePaths
    const opShiftMs = opHours * 3600_000 + opMinutes * 60_000
    let applied = 0
    for (const p of scope) {
      const item = items[p]
      if (!item) continue
      if (op === 'set') {
        if (!opDate) continue
        useTableStore.getState().setEdit(p, {
          [targetField]: opDate.valueOf()
        } as FileEdits)
        applied++
      } else if (op === 'shift') {
        const base = effectiveValue(item, edits[p], targetField)
        if (base == null) continue
        useTableStore.getState().setEdit(p, {
          [targetField]: base + opShiftMs
        } as FileEdits)
        applied++
      } else {
        const src =
          sourceField === 'filename'
            ? item.filenameTimeIso
              ? new Date(item.filenameTimeIso).getTime()
              : undefined
            : effectiveValue(item, edits[p], sourceField)
        if (src == null) continue
        useTableStore.getState().setEdit(p, { [targetField]: src } as FileEdits)
        applied++
      }
    }
    if (applied) message.info(t('table.markedN', { n: applied }))
  }

  const execute = async (): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const res = await ck.applyChanges(
        plan.items.map((i) => i.apply),
        'metadata',
        t('table.execLabel')
      )
      if (res.failCount > 0) message.warning(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      else message.success(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      const paths = plan.items.map((i) => i.path)
      useTableStore.getState().dropEdits(paths)
      if (paths.length) await useMediaStore.getState().reprobe('table', paths)
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  const renderTimeCell = (r: (typeof rows)[number], field: TimeField): React.ReactNode => {
    const v = effectiveValue(r, r.edit, field)
    const isEditing = editing?.path === r.path && editing.field === field
    const dirty = r.edit?.[field === 'metadata' ? 'metadataMs' : field === 'mtime' ? 'mtimeMs' : 'ctimeMs'] != null
    if (isEditing) {
      return (
        <DatePicker
          showTime
          size="small"
          autoFocus
          open
          value={v != null ? dayjs(v) : null}
          onChange={(d) => {
            if (d) useTableStore.getState().setEdit(r.path, { [field]: d.valueOf() } as FileEdits)
            setEditing(null)
          }}
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
        />
      )
    }
    return (
      <button
        className={`ck-cell-time ${dirty ? 'is-dirty' : ''}`}
        onClick={() => setEditing({ path: r.path, field })}
        title={t('table.editHint')}
      >
        {v != null ? fmt(v) : <span className="ck-faint">{t('common.noTime')}</span>}
      </button>
    )
  }

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: '',
      dataIndex: 'thumb',
      width: 96,
      render: (_, r) => <Thumb item={r} size={72} />
    },
    {
      title: t('table.col.name'),
      dataIndex: 'name',
      ellipsis: true,
      width: 240,
      sorter: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
      render: (name: string, r) => (
        <span title={r.path} className={r.edit ? 'ck-row-dirty-name' : ''}>
          {name}
        </span>
      )
    },
    {
      title: t('time.creationTime'),
      key: 'metadata',
      width: 190,
      sorter: (a, b) =>
        (effectiveValue(a, a.edit, 'metadata') ?? 0) - (effectiveValue(b, b.edit, 'metadata') ?? 0),
      render: (_, r) => renderTimeCell(r, 'metadata')
    },
    {
      title: t('time.mtime'),
      key: 'mtime',
      width: 190,
      sorter: (a, b) => (effectiveValue(a, a.edit, 'mtime') ?? 0) - (effectiveValue(b, b.edit, 'mtime') ?? 0),
      render: (_, r) => renderTimeCell(r, 'mtime')
    },
    ...(isWin
      ? [
          {
            title: t('time.ctime'),
            key: 'ctime',
            width: 190,
            sorter: (a: (typeof rows)[number], b: (typeof rows)[number]) =>
              (effectiveValue(a, a.edit, 'ctime') ?? 0) - (effectiveValue(b, b.edit, 'ctime') ?? 0),
            render: (_: unknown, r: (typeof rows)[number]) => renderTimeCell(r, 'ctime')
          } as ColumnsType<(typeof rows)[number]>[number]
        ]
      : []),
    {
      title: t('table.col.duration'),
      dataIndex: 'durationSec',
      width: 84,
      render: (v?: number) => <span className="ck-mono ck-faint">{formatDuration(v) || '—'}</span>
    },
    {
      title: t('table.col.status'),
      key: 'status',
      width: 96,
      render: (_, r) =>
        r.probing ? (
          <span className="ck-chip ck-chip-neutral">{t('table.statusProbing')}</span>
        ) : r.probeFailed ? (
          <span className="ck-chip ck-chip-red">{t('table.statusFailed')}</span>
        ) : (
          <span className="ck-status-dot" />
        )
    }
  ]

  const toolbar = (
    <>
      <span className="ck-panel-subbar-label">{t('table.batch.target')}</span>
      <Segmented
        size="small"
        value={targetField}
        onChange={(v) => setTargetField(v as TimeField)}
        options={[
          { label: t('time.creationTime'), value: 'metadata' },
          { label: t('time.mtime'), value: 'mtime' },
          ...(isWin ? [{ label: t('time.ctime'), value: 'ctime' as const }] : [])
        ]}
      />
      <Segmented
        size="small"
        value={op}
        onChange={(v) => setOp(v as BatchOp)}
        options={[
          { label: t('table.batch.set'), value: 'set' },
          { label: t('table.batch.shift'), value: 'shift' },
          { label: t('table.batch.copy'), value: 'copy' }
        ]}
      />
      {op === 'set' && (
        <DatePicker showTime size="small" value={opDate} onChange={(v) => setOpDate(v)} />
      )}
      {op === 'shift' && (
        <>
          <InputNumber
            size="small"
            addonAfter={t('tools.shiftHours')}
            value={opHours}
            onChange={(v) => setOpHours(v ?? 0)}
            style={{ width: 112 }}
          />
          <InputNumber
            size="small"
            addonAfter={t('tools.shiftMinutes')}
            value={opMinutes}
            onChange={(v) => setOpMinutes(v ?? 0)}
            style={{ width: 120 }}
          />
        </>
      )}
      {op === 'copy' && (
        <Segmented
          size="small"
          value={sourceField}
          onChange={(v) => setSourceField(v as TimeField | 'filename')}
          options={[
            { label: t('time.filename'), value: 'filename' },
            { label: t('time.creationTime'), value: 'metadata' },
            { label: t('time.mtime'), value: 'mtime' },
            ...(isWin ? [{ label: t('time.ctime'), value: 'ctime' as const }] : [])
          ]}
        />
      )}
      <Button size="small" type="primary" ghost disabled={op === 'set' && !opDate} onClick={applyBatch}>
        {t('table.batch.apply')}
      </Button>
      <span className="ck-bar-summary">
        {sel.length ? t('tools.scopeSelected', { n: sel.length }) : t('tools.scopeAll', { n: tablePaths.length })}
      </span>
      <div className="ck-actionbar-spacer" />
      {dirtyCount > 0 && (
        <Tooltip title={t('table.clearEdits')}>
          <Button size="small" icon={<ClearOutlined />} onClick={() => useTableStore.getState().clearAll()}>
            {t('table.dirtyN', { n: dirtyCount })}
          </Button>
        </Tooltip>
      )}
    </>
  )

  useEffect(() => {
    // selection may reference removed rows; prune it
    if (sel.some((p) => !tablePaths.includes(p))) setSel(sel.filter((p) => tablePaths.includes(p)))
  }, [tablePaths, sel])

  return (
    <PageShell
      title={t('menu.table')}
      desc={t('desc.table')}
      pageProps={{ className: 'ck-page--fill' }}
      footer={
        <>
          <span className="ck-actionbar-label">{t('common.writeTargets')}</span>
          <OptionBar value={opts} onChange={setOpts} showCtime={isWin} />
          <div className="ck-bar-sep" />
          <span className={`ck-bar-summary ${plan.items.length > 0 ? 'is-positive' : ''}`}>
            {t('table.planHint', { n: plan.items.length })}
          </span>
          <div className="ck-actionbar-spacer" />
          <Button
            type="primary"
            size="large"
            disabled={busy || plan.items.length === 0}
            onClick={() => setPlanOpen(true)}
          >
            {t('table.apply')}
          </Button>
        </>
      }
    >
      <FileListPanel
        kind="table"
        title={t('table.title')}
        fill
        toolbar={toolbar}
        selectedPaths={sel}
        onSelectionChange={setSel}
        body={
          <div ref={bodyRef} className="ck-table-holder">
            <Table
              size="small"
              virtual
              rowKey="path"
              dataSource={rows}
              columns={columns}
              scroll={{ x: 1100, y: tableH }}
              pagination={false}
              rowSelection={{
                selectedRowKeys: sel,
                onChange: (keys) => setSel(keys as string[])
              }}
              rowClassName={(r) => (r.edit ? 'ck-row-dirty' : '')}
              locale={{ emptyText: ' ' }}
            />
          </div>
        }
      />

      <PlanModal
        open={planOpen}
        items={plan.items}
        skippedCount={plan.skipped.length}
        loading={busy}
        onCancel={() => setPlanOpen(false)}
        onConfirm={() => void execute()}
      />
    </PageShell>
  )
}
