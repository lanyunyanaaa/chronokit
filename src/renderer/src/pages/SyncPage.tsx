import { useMemo, useState } from 'react'
import { App, Button, Checkbox, InputNumber, Progress, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LinkOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { buildSyncPlan, type PlanFileFacts, type SyncPlanEntry } from '@core/plan'
import { formatLocal, parseFfprobeDate, pickSourceTime } from '@core/time-engine'
import type { MatchMethod } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useAppStore, type VideoItem } from '@renderer/store/appStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PlanModal from '@renderer/components/PlanModal'
import PageHeader from '@renderer/components/PageHeader'

const isWin = navigator.userAgent.includes('Windows')

export default function SyncPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const sources = useAppStore((s) => s.sources)
  const targets = useAppStore((s) => s.targets)
  const pairs = useAppStore((s) => s.pairs)
  const busy = useAppStore((s) => s.busy)
  const progress = useAppStore((s) => s.progress)
  const threshold = useAppStore((s) => s.threshold)
  const setThreshold = useAppStore((s) => s.setThreshold)
  const runMatch = useAppStore((s) => s.runMatch)
  const rebind = useAppStore((s) => s.rebind)
  const reprobe = useAppStore((s) => s.reprobe)

  const [selSources, setSelSources] = useState<string[]>([])
  const [selTargets, setSelTargets] = useState<string[]>([])
  const [optMetadata, setOptMetadata] = useState(true)
  const [optMtime, setOptMtime] = useState(true)
  const [optCtime, setOptCtime] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.path, s])), [sources])

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
    for (const tg of targets) {
      const p = pairs[tg.path]
      if (!p) continue
      const src = sourceMap.get(p.sourcePath)
      if (!src) continue
      entries.push({ target: toFacts(tg), source: toFacts(src) })
    }
    return buildSyncPlan(entries, { metadata: optMetadata, mtime: optMtime, ctime: optCtime }, isWin)
  }, [targets, pairs, sourceMap, optMetadata, optMtime, optCtime])

  const bindSelected = (): void => {
    if (selSources.length !== 1 || selTargets.length === 0) {
      message.warning(t('sync.bindHint'))
      return
    }
    for (const tp of selTargets) rebind(tp, selSources[0])
  }

  const execute = async (): Promise<void> => {
    useAppStore.getState().setBusy(true)
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
      await reprobe('targets', plan.items.map((i) => i.path))
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useAppStore.getState().setBusy(false)
      useAppStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  const columns: ColumnsType<VideoItem> = [
    {
      title: t('sync.targets'),
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, rec) => <span title={rec.path}>{name}</span>
    },
    {
      title: t('sync.targetTime'),
      width: 150,
      render: (_, rec) => {
        const meta = rec.creationTimeIso ? parseFfprobeDate(rec.creationTimeIso) : null
        return (
          <span>
            {meta ? formatLocal(meta) : <Tag color="warning">--</Tag>}
            <div style={{ color: '#5f6879', fontSize: 11.5 }}>{formatLocal(new Date(rec.mtimeMs))}</div>
          </span>
        )
      }
    },
    {
      title: t('sync.method'),
      width: 165,
      render: (_, rec) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={pairs[rec.path]?.sourcePath ?? null}
          allowClear
          placeholder={t('sync.unlinked')}
          onChange={(v) => rebind(rec.path, v ?? null)}
          options={sources.map((s) => ({ value: s.path, label: s.name }))}
        />
      )
    },
    {
      title: t('sync.score'),
      width: 88,
      render: (_, rec) => {
        const p = pairs[rec.path]
        if (!p) return <span style={{ color: '#5f6879' }}>—</span>
        const color: Record<MatchMethod, string> = {
          'exact-name': 'success',
          'fuzzy-name': 'processing',
          size: 'gold',
          duration: 'cyan',
          manual: 'purple'
        }
        return <Tag color={color[p.method]}>{`${t(`match.${p.method}`)} ${p.score.toFixed(2)}`}</Tag>
      }
    },
    {
      title: t('sync.sourceTime'),
      width: 200,
      render: (_, rec) => {
        const p = pairs[rec.path]
        const src = p ? sourceMap.get(p.sourcePath) : null
        if (!src) return <span style={{ color: '#5f6879' }}>—</span>
        const picked = pickSourceTime({
          metadataTime: src.creationTimeIso ? parseFfprobeDate(src.creationTimeIso) : null,
          filenameTime: src.filenameTimeIso ? new Date(src.filenameTimeIso) : null,
          fsTime: new Date(src.mtimeMs)
        })
        if (!picked) return <Tag color="warning">--</Tag>
        return (
          <span style={{ whiteSpace: 'nowrap' }}>
            <Tag style={{ marginInlineEnd: 5 }}>{t(`time.${picked.source}`)}</Tag>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatLocal(picked.date)}</span>
          </span>
        )
      }
    }
  ]

  return (
    <div>
      <PageHeader title={t('menu.sync')} desc={t('desc.sync')} />

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

      <div className="ck-panel" style={{ marginTop: 12 }}>
        <div className="ck-panel-head">
          <div className="ck-panel-title">
            {t('sync.matchResult')}
            <span className="ck-count">
              {Object.keys(pairs).length}/{targets.length}
            </span>
          </div>
          <Space size={8}>
            <span style={{ color: '#9aa3b4', fontSize: 12.5 }}>{t('sync.threshold')}</span>
            <InputNumber
              size="small"
              min={0.5}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(v) => setThreshold(v ?? 0.75)}
              style={{ width: 78 }}
            />
            <Button
              size="small"
              icon={<LinkOutlined />}
              disabled={!sources.length || !targets.length || busy}
              onClick={runMatch}
            >
              {t('sync.autoMatch')}
            </Button>
            <Button size="small" onClick={bindSelected} disabled={busy}>
              {t('sync.bindSelected')}
            </Button>
          </Space>
        </div>
        <div className="ck-panel-body" style={{ paddingTop: 4 }}>
          <Table
            size="small"
            tableLayout="fixed"
            rowKey="path"
            dataSource={targets}
            columns={columns}
            pagination={false}
            locale={{ emptyText: t('sync.tableEmpty') }}
          />
        </div>
      </div>

      <div className="ck-toolbar" style={{ marginTop: 12 }}>
        <Checkbox checked={optMetadata} onChange={(e) => setOptMetadata(e.target.checked)}>
          {t('sync.optMetadata')}
        </Checkbox>
        <Checkbox checked={optMtime} onChange={(e) => setOptMtime(e.target.checked)}>
          {t('sync.optMtime')}
        </Checkbox>
        {isWin && (
          <Checkbox checked={optCtime} onChange={(e) => setOptCtime(e.target.checked)}>
            {t('sync.optCtime')}
          </Checkbox>
        )}
        <div className="ck-toolbar-sep" />
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={busy || plan.items.length === 0}
          onClick={() => setPlanOpen(true)}
        >
          {t('common.preview')}
        </Button>
        {busy && progress && progress.task === 'exec' && (
          <Progress
            percent={progress.total ? Math.round((progress.done / progress.total) * 100) : 0}
            style={{ width: 220, marginBottom: 0 }}
          />
        )}
      </div>

      <PlanModal
        open={planOpen}
        items={plan.items}
        skippedCount={plan.skipped.length}
        loading={busy}
        onCancel={() => setPlanOpen(false)}
        onConfirm={() => void execute()}
      />
    </div>
  )
}
