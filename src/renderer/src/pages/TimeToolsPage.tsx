import { useMemo, useState } from 'react'
import { App, Button, DatePicker, InputNumber, Segmented } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import { buildToolPlan, type SyncOptions, type PlanFileFacts, type ToolPlanParams } from '@core/plan'
import type { JournalOp } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useMediaStore, type VideoItem } from '@renderer/store/mediaStore'
import { useTaskStore } from '@renderer/store/taskStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PlanModal from '@renderer/components/PlanModal'
import PageShell from '@renderer/components/PageShell'
import OptionBar from '@renderer/components/OptionBar'

const isWin = navigator.userAgent.includes('Windows')

export default function TimeToolsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const toolPaths = useMediaStore((s) => s.lists.tools)
  const items = useMediaStore((s) => s.items)
  const busy = useTaskStore((s) => s.busy)

  const [sel, setSel] = useState<string[]>([])
  const [mode, setMode] = useState<ToolPlanParams['mode']>('shift')
  const [absolute, setAbsolute] = useState<Dayjs | null>(null)
  const [hours, setHours] = useState(8)
  const [minutes, setMinutes] = useState(0)
  const [opts, setOpts] = useState<SyncOptions>({ metadata: true, mtime: true, ctime: false })
  const [planOpen, setPlanOpen] = useState(false)

  const toolItems = useMemo(
    () => toolPaths.flatMap((p) => (items[p] ? [items[p]] : [])) as VideoItem[],
    [toolPaths, items]
  )

  const scope = useMemo(
    () => (sel.length ? toolItems.filter((i) => sel.includes(i.path)) : toolItems),
    [toolItems, sel]
  )

  const plan = useMemo(() => {
    const files: PlanFileFacts[] = scope.map((i: VideoItem) => ({
      path: i.path,
      name: i.name,
      creationTimeIso: i.creationTimeIso ?? null,
      filenameTimeIso: i.filenameTimeIso ?? null,
      mtimeMs: i.mtimeMs,
      birthtimeMs: i.birthtimeMs
    }))
    const params: ToolPlanParams = {
      mode,
      absoluteIso: absolute ? absolute.toDate().toISOString() : undefined,
      shift: { hours, minutes }
    }
    return buildToolPlan(files, params, opts, isWin)
  }, [scope, mode, absolute, hours, minutes, opts])

  const kind: JournalOp['kind'] =
    mode === 'absolute' ? 'set-time' : mode === 'shift' ? 'shift-time' : 'from-filename'

  const execute = async (): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const res = await ck.applyChanges(
        plan.items.map((i) => i.apply),
        kind,
        t(`exec.label${mode === 'absolute' ? 'Set' : mode === 'shift' ? 'Shift' : 'Filename'}`)
      )
      if (res.failCount > 0) {
        message.warning(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      } else {
        message.success(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      }
      await useMediaStore.getState().reprobe('tools', plan.items.map((i) => i.path))
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  const modeStrip = (
    <>
      <span className="ck-panel-subbar-label">{t('tools.mode')}</span>
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as ToolPlanParams['mode'])}
        options={[
          { label: t('tools.modeShift'), value: 'shift' },
          { label: t('tools.modeAbsolute'), value: 'absolute' },
          { label: t('tools.modeFilename'), value: 'filename' }
        ]}
      />
      {mode === 'absolute' && (
        <DatePicker showTime value={absolute} onChange={(v) => setAbsolute(v)} placeholder={t('tools.absoluteTime')} />
      )}
      {mode === 'shift' && (
        <>
          <InputNumber
            size="small"
            addonAfter={t('tools.shiftHours')}
            value={hours}
            onChange={(v) => setHours(v ?? 0)}
            style={{ width: 118 }}
          />
          <InputNumber
            size="small"
            addonAfter={t('tools.shiftMinutes')}
            value={minutes}
            onChange={(v) => setMinutes(v ?? 0)}
            style={{ width: 126 }}
          />
          <Button
            size="small"
            onClick={() => {
              setHours(8)
              setMinutes(0)
            }}
          >
            {t('tools.quickPlus8')}
          </Button>
          <Button
            size="small"
            onClick={() => {
              setHours(-8)
              setMinutes(0)
            }}
          >
            {t('tools.quickMinus8')}
          </Button>
        </>
      )}
      {mode === 'filename' && <span className="ck-hint">{t('tools.filenameHint')}</span>}
    </>
  )

  const scopeHint = sel.length
    ? t('tools.scopeSelected', { n: scope.length })
    : t('tools.scopeAll', { n: scope.length })

  return (
    <PageShell
      title={t('menu.tools')}
      desc={t('desc.tools')}
      pageProps={{ className: 'ck-page--fill' }}
      footer={
        <>
          <span className="ck-actionbar-label">{t('common.writeTargets')}</span>
          <OptionBar value={opts} onChange={setOpts} showCtime={isWin} />
          <div className="ck-bar-sep" />
          <span className="ck-hint">{scopeHint}</span>
          <div className="ck-actionbar-spacer" />
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            disabled={busy || plan.items.length === 0 || (mode === 'absolute' && !absolute)}
            onClick={() => setPlanOpen(true)}
          >
            {t('common.preview')}
          </Button>
        </>
      }
    >
      <FileListPanel
        kind="tools"
        title={t('tools.title')}
        fill
        toolbar={modeStrip}
        selectedPaths={sel}
        onSelectionChange={setSel}
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
