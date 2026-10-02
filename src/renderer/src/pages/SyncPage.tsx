import { useMemo, useState } from 'react'
import { App, Button, Dropdown, InputNumber, Select, Space, Table, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LinkOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { buildSyncPlan, type SyncOptions, type PlanFileFacts, type SyncPlanEntry } from '@core/plan'
import { formatLocal, parseFfprobeDate, pickSourceTime } from '@core/time-engine'
import { analyzeSmartImport, type SmartFile, type SmartImportPlan } from '@core/smart-import'
import type { MatchMethod, RecentDir } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useMediaStore, type VideoItem } from '@renderer/store/mediaStore'
import { useMatchStore } from '@renderer/store/matchStore'
import { useTaskStore } from '@renderer/store/taskStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PlanModal from '@renderer/components/PlanModal'
import PageShell from '@renderer/components/PageShell'
import OptionBar from '@renderer/components/OptionBar'
import SmartImportModal from '@renderer/components/SmartImportModal'
import Thumb from '@renderer/components/Thumb'
import EmptyState from '@renderer/components/EmptyState'
import { ArrowRightIcon, ClockIcon, FolderImportIcon, InboxIcon, RecentIcon } from '@renderer/components/icons'

const isWin = navigator.userAgent.includes('Windows')

/** Match method → chip tone (semantic tokens, not antd preset colors). */
const METHOD_TONE: Record<MatchMethod, string> = {
  'exact-name': 'ck-chip-green',
  'fuzzy-name': 'ck-chip-blue',
  size: 'ck-chip-warn',
  duration: 'ck-chip-purple',
  manual: 'ck-chip-neutral'
}

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export default function SyncPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const sourcePaths = useMediaStore((s) => s.lists.sources)
  const targetPaths = useMediaStore((s) => s.lists.targets)
  const items = useMediaStore((s) => s.items)
  const pairs = useMatchStore((s) => s.pairs)
  const threshold = useMatchStore((s) => s.threshold)
  const setThreshold = useMatchStore((s) => s.setThreshold)
  const runMatch = useMatchStore((s) => s.runMatch)
  const rebind = useMatchStore((s) => s.rebind)
  const busy = useTaskStore((s) => s.busy)

  const [selSources, setSelSources] = useState<string[]>([])
  const [selTargets, setSelTargets] = useState<string[]>([])
  const [opts, setOpts] = useState<SyncOptions>({ metadata: true, mtime: true, ctime: false })
  const [planOpen, setPlanOpen] = useState(false)
  const [smartBusy, setSmartBusy] = useState(false)
  const [smartRecents, setSmartRecents] = useState<RecentDir[]>([])
  const [ambig, setAmbig] = useState<{ groups: SmartFile[][]; plan: SmartImportPlan } | null>(null)

  const sourceMap = useMemo(() => {
    const map = new Map<string, VideoItem>()
    for (const p of sourcePaths) {
      const it = items[p]
      if (it) map.set(p, it)
    }
    return map
  }, [sourcePaths, items])

  const targetItems = useMemo(
    () => targetPaths.flatMap((p) => (items[p] ? [items[p]] : [])),
    [targetPaths, items]
  )

  const toFacts = (i: VideoItem): PlanFileFacts => ({
    path: i.path,
    name: i.name,
    creationTimeIso: i.creationTimeIso ?? null,
    filenameTimeIso: i.filenameTimeIso ?? null,
    mtimeMs: i.mtimeMs,
    birthtimeMs: i.birthtimeMs
  })

  const plan = useMemo(() => {
    const entries: SyncPlanEntry[] = []
    for (const tg of targetItems) {
      const p = pairs[tg.path]
      if (!p) continue
      const src = sourceMap.get(p.sourcePath)
      if (!src) continue
      entries.push({ target: toFacts(tg), source: toFacts(src) })
    }
    return buildSyncPlan(entries, opts, isWin)
  }, [targetItems, pairs, sourceMap, opts])

  const bindSelected = (): void => {
    if (selSources.length !== 1 || selTargets.length === 0) {
      message.warning(t('sync.bindHint'))
      return
    }
    for (const tp of selTargets) rebind(tp, selSources[0])
  }

  const execute = async (): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const res = await ck.applyChanges(
        plan.items.map((i) => i.apply),
        'sync',
        t('exec.labelSync')
      )
      if (res.failCount > 0) {
        message.warning(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      } else {
        message.success(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      }
      await useMediaStore.getState().reprobe('targets', plan.items.map((i) => i.path))
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  /**
   * Smart import: scan one root folder, pair files that share a normalized
   * name, and let the user break ties when a name maps to 3+ files.
   */
  const applySmartPlan = async (
    planIn: SmartImportPlan,
    choices: (SmartFile | null)[]
  ): Promise<void> => {
    const pairsResolved = [...planIn.pairs]
    const skipped: SmartFile[] = []
    planIn.ambiguous.forEach((g, i) => {
      const src = choices[i] ?? null
      if (src) pairsResolved.push({ source: src, targets: g.filter((f) => f !== src) })
      else skipped.push(...g)
    })
    const sourcePathsIn = pairsResolved.map((p) => p.source.path)
    const targetPathsIn = [
      ...pairsResolved.flatMap((p) => p.targets.map((tg) => tg.path)),
      ...skipped.map((s) => s.path),
      ...planIn.singletons.map((s) => s.path)
    ]
    if (!sourcePathsIn.length && !targetPathsIn.length) return

    useTaskStore.getState().setBusy(true)
    try {
      await useMediaStore.getState().addPaths('sources', sourcePathsIn, { autoMatch: false })
      await useMediaStore.getState().addPaths('targets', targetPathsIn, { autoMatch: false })
      for (const p of pairsResolved) {
        for (const tg of p.targets) rebind(tg.path, p.source.path, 'exact-name')
      }
      message.success(
        t('sync.smartSummary', {
          pairs: pairsResolved.length,
          unpaired: skipped.length + planIn.singletons.length
        })
      )
    } finally {
      useTaskStore.getState().setBusy(false)
    }
  }

  const runSmartImport = async (dir?: string): Promise<void> => {
    if (smartBusy) return
    setSmartBusy(true)
    useTaskStore.getState().setBusy(true)
    try {
      const folder = dir ?? (await ck.selectFolder())
      if (!folder) return
      setSmartRecents(await ck.recentsAdd(folder).catch(() => []))
      const paths = await ck.resolvePaths([folder])
      if (!paths.length) {
        message.info(t('sync.smartEmpty'))
        return
      }
      const stats = await ck.statFiles(paths)
      const smartPlan = analyzeSmartImport(
        stats.map((s) => ({ path: s.path, name: s.name, size: s.size, mtimeMs: s.mtimeMs }))
      )
      if (smartPlan.ambiguous.length) {
        // ties are settled by the user before anything is added
        setAmbig({ groups: smartPlan.ambiguous, plan: smartPlan })
        return
      }
      await applySmartPlan(smartPlan, [])
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      setSmartBusy(false)
      useTaskStore.getState().setBusy(false)
    }
  }

  const smartMenuItems: MenuProps['items'] = [
    ...(smartRecents.length
      ? ([
          { key: '_recents', label: t('common.recent'), type: 'group' as const },
          ...smartRecents.map((r) => ({
            key: `r:${r.path}`,
            icon: <RecentIcon size={16} />,
            label: (
              <span className="ck-recent-item" title={r.path}>
                <span className="ck-recent-name">{baseName(r.path)}</span>
                <span className="ck-recent-path">{r.path}</span>
              </span>
            )
          })),
          { type: 'divider' as const }
        ] as NonNullable<MenuProps['items']>)
      : []),
    { key: 'pick', label: t('sync.smartPickFolder') }
  ]

  const onSmartMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('r:')) void runSmartImport(key.slice(2))
    else if (key === 'pick') void runSmartImport()
  }

  const columns: ColumnsType<VideoItem> = [
    {
      title: '',
      dataIndex: 'thumb',
      width: 58,
      render: (_, rec) => <Thumb item={rec} size={48} />
    },
    {
      title: t('sync.targets'),
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, rec) => (
        <span className="ck-truncate" title={rec.path} style={{ display: 'block' }}>
          {name}
        </span>
      )
    },
    {
      title: t('sync.targetTime'),
      width: 158,
      render: (_, rec) => {
        const meta = rec.creationTimeIso ? parseFfprobeDate(rec.creationTimeIso) : null
        return (
          <div className="ck-col" style={{ gap: 2 }}>
            {meta ? (
              <span className="ck-chip ck-chip-blue ck-nowrap">{formatLocal(meta)}</span>
            ) : (
              <span className="ck-chip ck-chip-dash">{t('common.noTime')}</span>
            )}
            <span
              className="ck-faint ck-time ck-nowrap"
              style={{ fontSize: 'var(--ck-fs-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={t('time.mtime')}
            >
              <ClockIcon size={10} />
              {formatLocal(new Date(rec.mtimeMs))}
            </span>
          </div>
        )
      }
    },
    {
      title: '',
      width: 34,
      align: 'center',
      render: () => (
        <Tooltip title={t('sync.directionHint')}>
          <span className="ck-plan-arrow">
            <ArrowRightIcon size={16} />
          </span>
        </Tooltip>
      )
    },
    {
      title: t('sync.sourceTime'),
      width: 196,
      render: (_, rec) => {
        const p = pairs[rec.path]
        const src = p ? sourceMap.get(p.sourcePath) : null
        if (!src) return <span className="ck-faint">—</span>
        const picked = pickSourceTime({
          metadataTime: src.creationTimeIso ? parseFfprobeDate(src.creationTimeIso) : null,
          filenameTime: src.filenameTimeIso ? new Date(src.filenameTimeIso) : null,
          fsTime: new Date(src.mtimeMs)
        })
        if (!picked) return <span className="ck-chip ck-chip-dash">{t('common.noTime')}</span>
        return (
          <span className="ck-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <span className="ck-chip ck-chip-neutral">{t(`time.${picked.source}`)}</span>
            <span className="ck-time ck-nowrap">{formatLocal(picked.date)}</span>
          </span>
        )
      }
    },
    {
      title: t('sync.method'),
      width: 170,
      render: (_, rec) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={pairs[rec.path]?.sourcePath ?? null}
          allowClear
          placeholder={t('sync.unlinked')}
          onChange={(v) => rebind(rec.path, v ?? null)}
          options={sourcePaths.map((p) => ({ value: p, label: sourceMap.get(p)?.name ?? p }))}
        />
      )
    },
    {
      title: t('sync.score'),
      width: 116,
      render: (_, rec) => {
        const p = pairs[rec.path]
        if (!p) return <span className="ck-faint">—</span>
        return (
          <span className={`ck-chip ${METHOD_TONE[p.method]}`}>
            {t(`match.${p.method}`)}
            <span className="ck-time ck-faint">{p.score.toFixed(2)}</span>
          </span>
        )
      }
    }
  ]

  const planned = plan.items.length
  const pairCount = Object.keys(pairs).length

  return (
    <PageShell
      title={t('menu.sync')}
      badge={
        pairCount > 0 ? (
          <span className="ck-chip ck-chip-neutral">{t('sync.pairedN', { n: pairCount })}</span>
        ) : undefined
      }
      desc={t('desc.sync')}
      actions={
        <Dropdown.Button
          type="primary"
          disabled={smartBusy || busy}
          icon={<FolderImportIcon size={15} />}
          menu={{ items: smartMenuItems, onClick: onSmartMenuClick }}
          onClick={() => void runSmartImport()}
        >
          {t('sync.smartImport')}
        </Dropdown.Button>
      }
      footer={
        <>
          <span className="ck-actionbar-label">{t('common.writeTargets')}</span>
          <OptionBar value={opts} onChange={setOpts} showCtime={isWin} />
          <div className="ck-bar-sep" />
          <span className="ck-hint">
            {planned > 0 ? t('sync.planReady', { n: planned }) : t('sync.planNone')}
          </span>
          <div className="ck-actionbar-spacer" />
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            disabled={busy || planned === 0}
            onClick={() => setPlanOpen(true)}
          >
            {t('common.preview')}
          </Button>
        </>
      }
    >
      <div className="ck-sync-grid">
        <FileListPanel
          kind="sources"
          title={t('sync.sources')}
          selectedPaths={selSources}
          onSelectionChange={setSelSources}
        />
        <FileListPanel
          kind="targets"
          title={t('sync.targets')}
          selectedPaths={selTargets}
          onSelectionChange={setSelTargets}
        />
      </div>

      <div className="ck-panel ck-panel--fill">
        <div className="ck-panel-head">
          <div className="ck-panel-title">
            {t('sync.matchResult')}
            <span className="ck-count">
              {pairCount}/{targetPaths.length}
            </span>
          </div>
          <Space size={8}>
            <span className="ck-hint">{t('sync.threshold')}</span>
            <InputNumber
              size="small"
              min={0.5}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(v) => setThreshold(v ?? 0.75)}
              style={{ width: 74 }}
            />
            <Button
              size="small"
              icon={<LinkOutlined />}
              disabled={!sourcePaths.length || !targetPaths.length || busy}
              onClick={runMatch}
            >
              {t('sync.autoMatch')}
            </Button>
            <Button size="small" onClick={bindSelected} disabled={busy}>
              {t('sync.bindSelected')}
            </Button>
          </Space>
        </div>
        <div className="ck-panel-body ck-panel-body--tight">
          <Table
            size="small"
            tableLayout="fixed"
            virtual
            rowKey="path"
            dataSource={targetItems}
            columns={columns}
            pagination={false}
            scroll={{ x: 1120, y: 'max(220px, calc(100vh - 500px))' }}
            locale={{
              emptyText: (
                <EmptyState
                  icon={<InboxIcon size={22} />}
                  title={t('sync.tableEmpty')}
                  hint={t('sync.tableEmptyHint')}
                />
              )
            }}
          />
        </div>
      </div>

      <PlanModal
        open={planOpen}
        items={plan.items}
        skippedCount={plan.skipped.length}
        loading={busy}
        onCancel={() => setPlanOpen(false)}
        onConfirm={() => void execute()}
      />

      <SmartImportModal
        open={!!ambig}
        groups={ambig?.groups ?? []}
        onCancel={() => setAmbig(null)}
        onConfirm={(choices) => {
          const a = ambig
          setAmbig(null)
          if (a) void applySmartPlan(a.plan, choices)
        }}
      />
    </PageShell>
  )
}
