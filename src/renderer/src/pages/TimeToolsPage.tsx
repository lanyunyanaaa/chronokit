import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  InputNumber,
  Progress,
  Segmented,
  Space,
  Typography
} from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import { buildToolPlan, type PlanFileFacts, type ToolPlanParams } from '@core/plan'
import type { JournalOp } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useAppStore, type VideoItem } from '@renderer/store/appStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PlanModal from '@renderer/components/PlanModal'

const isWin = navigator.userAgent.includes('Windows')

export default function TimeToolsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const items = useAppStore((s) => s.toolItems)
  const busy = useAppStore((s) => s.busy)
  const progress = useAppStore((s) => s.progress)
  const reprobe = useAppStore((s) => s.reprobe)

  const [sel, setSel] = useState<string[]>([])
  const [mode, setMode] = useState<ToolPlanParams['mode']>('shift')
  const [absolute, setAbsolute] = useState<Dayjs | null>(null)
  const [hours, setHours] = useState(8)
  const [minutes, setMinutes] = useState(0)
  const [optMetadata, setOptMetadata] = useState(true)
  const [optMtime, setOptMtime] = useState(true)
  const [optCtime, setOptCtime] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const scope = useMemo(
    () => (sel.length ? items.filter((i) => sel.includes(i.path)) : items),
    [items, sel]
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
    return buildToolPlan(
      files,
      params,
      { metadata: optMetadata, mtime: optMtime, ctime: optCtime },
      isWin
    )
  }, [scope, mode, absolute, hours, minutes, optMetadata, optMtime, optCtime])

  const kind: JournalOp['kind'] =
    mode === 'absolute' ? 'set-time' : mode === 'shift' ? 'shift-time' : 'from-filename'

  const execute = async (): Promise<void> => {
    useAppStore.getState().setBusy(true)
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
      await reprobe('tools', plan.items.map((i) => i.path))
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useAppStore.getState().setBusy(false)
      useAppStore.getState().setProgress(null)
      setPlanOpen(false)
    }
  }

  return (
    <div>
      <FileListPanel
        kind="tools"
        title={t('tools.title')}
        selectedPaths={sel}
        onSelectionChange={setSel}
      />

      <Card size="small" style={{ marginTop: 12 }}>
        <Space wrap align="center">
          <span style={{ color: '#8a8a8a' }}>{t('tools.mode')}</span>
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
            <>
              <span style={{ color: '#8a8a8a' }}>{t('tools.absoluteTime')}</span>
              <DatePicker showTime value={absolute} onChange={(v) => setAbsolute(v)} />
            </>
          )}

          {mode === 'shift' && (
            <>
              <InputNumber addonAfter={t('tools.shiftHours')} value={hours} onChange={(v) => setHours(v ?? 0)} style={{ width: 120 }} />
              <InputNumber addonAfter={t('tools.shiftMinutes')} value={minutes} onChange={(v) => setMinutes(v ?? 0)} style={{ width: 130 }} />
              <Button size="small" onClick={() => { setHours(8); setMinutes(0) }}>
                {t('tools.quickPlus8')}
              </Button>
              <Button size="small" onClick={() => { setHours(-8); setMinutes(0) }}>
                {t('tools.quickMinus8')}
              </Button>
            </>
          )}

          {mode === 'filename' && (
            <Typography.Text type="secondary">{t('tools.filenameHint')}</Typography.Text>
          )}
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Space wrap align="center">
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
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={busy || plan.items.length === 0 || (mode === 'absolute' && !absolute)}
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
        </Space>
      </Card>

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
