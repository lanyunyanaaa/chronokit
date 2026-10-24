import { useMemo, useState } from 'react'
import { App, Button, Tooltip } from 'antd'
import {
  ClearOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  PlayCircleOutlined,
  RedoOutlined
} from '@ant-design/icons'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import {
  buildIssuePlan,
  runCheckup,
  type CheckupFacts,
  type CheckupIssue
} from '@core/checkup'
import type { PlanFileFacts, SyncOptions } from '@core/plan'
import type { JournalOp, PlanItem, PlanSkipped } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useMediaStore } from '@renderer/store/mediaStore'
import { useTaskStore } from '@renderer/store/taskStore'
import { useDropPaths } from '@renderer/hooks/useDropPaths'
import PageShell from '@renderer/components/PageShell'
import PlanModal from '@renderer/components/PlanModal'
import EmptyState from '@renderer/components/EmptyState'
import OptionBar from '@renderer/components/OptionBar'
import { CheckIcon, HealthIcon } from '@renderer/components/icons'

const isWin = navigator.userAgent.includes('Windows')

const fmt = (ms: number): string => dayjs(ms).format('YYYY-MM-DD HH:mm:ss')
const fmtIso = (iso?: string): string => (iso ? fmt(new Date(iso).getTime()) : '—')

const KIND_BY_FIX: Record<string, JournalOp['kind']> = {
  filename: 'from-filename',
  shift: 'shift-time',
  ctime: 'set-time'
}

export default function CheckupPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const checkupPaths = useMediaStore((s) => s.lists.checkup)
  const items = useMediaStore((s) => s.items)
  const busy = useTaskStore((s) => s.busy)

  const [opts, setOpts] = useState<SyncOptions>({ metadata: true, mtime: true, ctime: false })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [planOpen, setPlanOpen] = useState(false)

  const { dragOver, dragProps } = useDropPaths((dropped) => {
    void useMediaStore.getState().addPaths('checkup', dropped)
  })

  const facts: CheckupFacts[] = useMemo(
    () =>
      checkupPaths.flatMap((p) => {
        const i = items[p]
        if (!i) return []
        return [
          {
            path: i.path,
            name: i.name,
            size: i.size,
            mtimeMs: i.mtimeMs,
            birthtimeMs: i.birthtimeMs,
            durationSec: i.durationSec,
            creationTimeIso: i.creationTimeIso,
            filenameTimeIso: i.filenameTimeIso,
            probing: i.probing,
            probeFailed: i.probeFailed
          }
        ]
      }),
    [checkupPaths, items]
  )

  const report = useMemo(() => runCheckup(facts), [facts])
  const probing = facts.filter((f) => f.probing).length

  const planFacts: PlanFileFacts[] = useMemo(
    () =>
      facts.map((f) => ({
        path: f.path,
        name: f.name,
        creationTimeIso: f.creationTimeIso ?? null,
        filenameTimeIso: f.filenameTimeIso ?? null,
        mtimeMs: f.mtimeMs,
        birthtimeMs: f.birthtimeMs
      })),
    [facts]
  )

  const buildPlan = (issues: CheckupIssue[]): { items: PlanItem[]; skipped: PlanSkipped[] } => {
    const out: { items: PlanItem[]; skipped: PlanSkipped[] } = { items: [], skipped: [] }
    for (const issue of issues) {
      if (!issue.fix) continue
      const r = buildIssuePlan(issue, planFacts, { isWin, opts })
      out.items.push(...r.items)
      out.skipped.push(...r.skipped)
    }
    return out
  }

  const fixable = report.issues.filter((i) => i.fix)
  const [pendingIssues, setPendingIssues] = useState<CheckupIssue[]>([])
  const preview = (issues: CheckupIssue[]): void => {
    setPendingIssues(issues)
    setPlanOpen(true)
  }
  const pendingPlan = useMemo(() => buildPlan(pendingIssues), [pendingIssues, opts, planFacts])

  const execute = async (): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const combined = pendingIssues.length > 1
      const kind: JournalOp['kind'] = combined
        ? 'metadata'
        : (KIND_BY_FIX[pendingIssues[0]?.fix?.kind ?? ''] ?? 'metadata')
      const label = combined
        ? t('checkup.execLabelBatch', { n: pendingIssues.length })
        : t(`checkup.execLabel.${pendingIssues[0].rule}`)
      const res = await ck.applyChanges(
        pendingPlan.items.map((i) => i.apply),
        kind,
        label
      )
      if (res.failCount > 0) message.warning(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      else message.success(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      const paths = [...new Set(pendingPlan.items.map((i) => i.path))]
      if (paths.length) await useMediaStore.getState().reprobe('checkup', paths)
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  const addFromDialog = async (type: 'files' | 'folder'): Promise<void> => {
    const raw = type === 'files' ? await ck.selectFiles() : await ck.selectFolder()
    if (!raw) return
    const paths = Array.isArray(raw) ? raw : [raw]
    if (paths.length) await useMediaStore.getState().addPaths('checkup', paths)
  }

  const detail = (issue: CheckupIssue, path: string): string => {
    const i = items[path]
    if (!i) return path
    const md = fmtIso(i.creationTimeIso)
    const fn = fmtIso(i.filenameTimeIso)
    switch (issue.rule) {
      case 'R1':
        return `${t('time.metadata')}: ${i.creationTimeIso ? md : t('checkup.detail.missing')} · ${t('time.filename')}: ${fn}`
      case 'R2':
      case 'R5':
      case 'R6':
        return `${t('time.metadata')}: ${md} · ${t('time.filename')}: ${fn}`
      case 'R3':
        return `${t('time.ctime')}: ${fmt(i.birthtimeMs)} · ${t('time.mtime')}: ${fmt(i.mtimeMs)}`
      case 'R4':
        return `${t('time.metadata')}: ${md}`
      case 'R7':
        return i.probeFailed
          ? t('checkup.detail.probeFailed')
          : i.size === 0
            ? t('checkup.detail.zeroBytes')
            : t('checkup.detail.badDuration')
      default:
        return i.name
    }
  }

  const stats = (
    <>
      <span className="ck-chip ck-chip-neutral">{t('checkup.totalN', { n: report.counts.total })}</span>
      {report.counts.error > 0 && (
        <span className="ck-chip ck-chip-red">{t('checkup.errorsN', { n: report.counts.error })}</span>
      )}
      {report.counts.warn > 0 && (
        <span className="ck-chip ck-chip-warn">{t('checkup.warnsN', { n: report.counts.warn })}</span>
      )}
      {report.counts.info > 0 && (
        <span className="ck-chip ck-chip-blue">{t('checkup.infosN', { n: report.counts.info })}</span>
      )}
      {report.counts.healthy > 0 && (
        <span className="ck-chip ck-chip-green">{t('checkup.healthyN', { n: report.counts.healthy })}</span>
      )}
      {probing > 0 && <span className="ck-chip ck-chip-neutral">{t('checkup.probingN', { n: probing })}</span>}
    </>
  )

  const bar = (
    <div className="ck-panel-head">
      <div className="ck-panel-title">
        <span>{t('checkup.reportTitle')}</span>
        {stats}
      </div>
      <div className="ck-panel-actions">
        {report.counts.total > 0 && (
          <Tooltip title={t('checkup.rescan')}>
            <Button
              size="small"
              type="text"
              aria-label={t('checkup.rescan')}
              icon={<RedoOutlined />}
              onClick={() => void useMediaStore.getState().reprobe('checkup')}
            />
          </Tooltip>
        )}
        <Tooltip title={t('common.clear')}>
          <Button
            size="small"
            type="text"
            aria-label={t('common.clear')}
            icon={<ClearOutlined />}
            disabled={!checkupPaths.length}
            onClick={() => useMediaStore.getState().clearKind('checkup')}
          />
        </Tooltip>
        <Button size="small" icon={<FileAddOutlined />} onClick={() => void addFromDialog('files')}>
          {t('common.addFiles')}
        </Button>
        <Button size="small" type="primary" icon={<FolderAddOutlined />} onClick={() => void addFromDialog('folder')}>
          {t('common.addFolder')}
        </Button>
      </div>
    </div>
  )

  return (
    <PageShell
      title={t('menu.checkup')}
      desc={t('desc.checkup')}
      pageProps={{
        className: `ck-page--fill ${dragOver ? 'ck-drop-active' : ''}`,
        ...dragProps
      }}
      footer={
        <>
          <span className="ck-actionbar-label">{t('common.writeTargets')}</span>
          <OptionBar value={opts} onChange={setOpts} showCtime={isWin} />
          <div className="ck-bar-sep" />
          <span className={`ck-bar-summary ${fixable.length ? 'is-positive' : ''}`}>
            {fixable.length
              ? t('checkup.fixableHint', {
                  n: fixable.length,
                  files: new Set(fixable.flatMap((i) => i.paths)).size
                })
              : t('checkup.noFixHint')}
          </span>
          <div className="ck-actionbar-spacer" />
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            disabled={busy || fixable.length === 0 || probing > 0}
            onClick={() => preview(fixable)}
          >
            {t('checkup.fixAll')}
          </Button>
        </>
      }
    >
      <div className="ck-panel ck-panel--fill ck-checkup">
        {bar}
        <div className="ck-panel-body ck-panel-body--flush ck-checkup-list">
          {report.counts.total === 0 ? (
            <EmptyState
              icon={<HealthIcon size={22} />}
              title={t('checkup.emptyTitle')}
              hint={t('checkup.emptyHint')}
              dropActive={dragOver}
              actions={
                <>
                  <Button size="small" icon={<FileAddOutlined />} onClick={() => void addFromDialog('files')}>
                    {t('common.addFiles')}
                  </Button>
                  <Button size="small" icon={<FolderAddOutlined />} onClick={() => void addFromDialog('folder')}>
                    {t('common.addFolder')}
                  </Button>
                </>
              }
            />
          ) : report.issues.length === 0 ? (
            <EmptyState
              icon={<CheckIcon size={22} />}
              title={t('checkup.allCleanTitle', { n: report.counts.total })}
              hint={t('checkup.allCleanHint')}
            />
          ) : (
            report.issues.map((issue) => {
              const key = `${issue.rule}:${issue.paths[0]}`
              const open = expanded === key
              return (
                <div className={`ck-issue is-${issue.severity}`} key={key}>
                  <div className="ck-issue-main">
                    <button
                      className="ck-issue-head"
                      onClick={() => setExpanded(open ? null : key)}
                      aria-expanded={open}
                    >
                      <span className={`ck-sev-dot sev-${issue.severity}`} />
                      <span className="ck-issue-rule">{issue.rule}</span>
                      <span className="ck-issue-title">
                        {t(issue.messageKey, issue.params as Record<string, unknown>)}
                      </span>
                      <span className="ck-count">{issue.paths.length}</span>
                      <span className="ck-issue-caret">{open ? <UpOutlined /> : <DownOutlined />}</span>
                    </button>
                    {issue.fix && (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        disabled={probing > 0}
                        onClick={() => preview([issue])}
                      >
                        {t('checkup.previewFix')}
                      </Button>
                    )}
                  </div>
                  {open && (
                    <div className="ck-issue-files">
                      {issue.paths.map((p) => (
                        <div className="ck-issue-file" key={p} title={p}>
                          <span className="ck-truncate ck-issue-name">{items[p]?.name ?? p}</span>
                          <span className="ck-issue-detail">{detail(issue, p)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <PlanModal
        open={planOpen}
        items={pendingPlan.items}
        skippedCount={pendingPlan.skipped.length}
        loading={busy}
        onCancel={() => setPlanOpen(false)}
        onConfirm={() => void execute()}
      />
    </PageShell>
  )
}
