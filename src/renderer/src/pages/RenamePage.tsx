import { useMemo, useState } from 'react'
import { App, Button, Input, Modal, Segmented, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowRightIcon, ShieldIcon } from '@renderer/components/icons'
import { CheckOutlined, CloseOutlined, SyncOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { buildRenamePlan, type RenameEntry, type RenameOptions, type RenamePattern } from '@core/rename'
import { ck } from '@renderer/services/ck'
import { useMediaStore } from '@renderer/store/mediaStore'
import { useTaskStore } from '@renderer/store/taskStore'
import FileListPanel from '@renderer/components/FileListPanel'
import PageShell from '@renderer/components/PageShell'

const PATTERNS: { label: string; value: RenamePattern }[] = [
  { label: '20230101_120305', value: 'stamp' },
  { label: '2023-01-01_120305', value: 'stamp-dash' },
  { label: '20230101_120305_原名', value: 'date-prefix' }
]

export default function RenamePage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const renamePaths = useMediaStore((s) => s.lists.rename)
  const items = useMediaStore((s) => s.items)
  const busy = useTaskStore((s) => s.busy)

  const [sel, setSel] = useState<string[]>([])
  const [options, setOptions] = useState<RenameOptions>({
    pattern: 'stamp',
    prefix: '',
    suffix: '',
    conflict: 'sequence'
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  const scope = useMemo(
    () => (sel.length ? sel : renamePaths),
    [sel, renamePaths]
  )

  // names of every listed file sharing the folder with a scoped file — those
  // are the collisions we can see from the renderer; the main process still
  // re-checks the real filesystem at execution time
  const takenNames = useMemo(() => {
    const dirs = new Set(scope.map((p) => p.replace(/[\\/][^\\/]*$/, '')))
    const lowerDirs = new Set([...dirs].map((d) => d.toLowerCase()))
    return renamePaths
      .filter((p) => lowerDirs.has(p.replace(/[\\/][^\\/]*$/, '').toLowerCase()))
      .map((p) => items[p]?.name ?? p.split(/[\\/]/).pop() ?? p)
  }, [scope, renamePaths, items])

  const plan = useMemo(
    () =>
      buildRenamePlan(
        scope.flatMap((p) => {
          const i = items[p]
          if (!i) return []
          return [
            {
              path: i.path,
              name: i.name,
              creationTimeIso: i.creationTimeIso ?? null,
              filenameTimeIso: i.filenameTimeIso ?? null,
              mtimeMs: i.mtimeMs
            }
          ]
        }),
        options,
        takenNames
      ),
    [scope, items, options, takenNames]
  )

  const execute = async (): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const res = await ck.applyRenames(
        plan.renames.map((r) => ({ path: r.path, to: r.to })),
        t('rename.execLabel')
      )
      if (res.failCount > 0) message.warning(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      else message.success(t('sync.executed', { ok: res.okCount, fail: res.failCount }))
      // full new path = old folder + new name, keeping the original separator
      const pairs = plan.renames.map((r) => {
        const sep = r.path.includes('\\') ? '\\' : '/'
        const dir = r.path.slice(0, r.path.lastIndexOf(sep))
        return { from: r.path, to: `${dir}${sep}${r.to}`, toName: r.to }
      })
      useMediaStore.getState().renamePaths(pairs)
      await useMediaStore.getState().reprobe('rename')
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
      setConfirmOpen(false)
    }
  }

  const columns: ColumnsType<RenameEntry> = [
    {
      title: t('rename.from'),
      dataIndex: 'from',
      ellipsis: true,
      render: (v: string, r) => (
        <span className="ck-mono ck-faint" title={r.path}>
          {v}
        </span>
      )
    },
    {
      title: '',
      width: 40,
      align: 'center' as const,
      render: () => <ArrowRightIcon size={14} />
    },
    {
      title: t('rename.to'),
      dataIndex: 'to',
      ellipsis: true,
      render: (v: string) => <span className="ck-mono">{v}</span>
    }
  ]

  const subbar = (
    <>
      <span className="ck-panel-subbar-label">{t('rename.pattern')}</span>
      <Segmented
        size="small"
        value={options.pattern}
        onChange={(v) => setOptions((o) => ({ ...o, pattern: v as RenamePattern }))}
        options={PATTERNS}
      />
      <Input
        size="small"
        placeholder={t('rename.prefix')}
        value={options.prefix}
        onChange={(e) => setOptions((o) => ({ ...o, prefix: e.target.value }))}
        style={{ width: 110 }}
      />
      <Input
        size="small"
        placeholder={t('rename.suffix')}
        value={options.suffix}
        onChange={(e) => setOptions((o) => ({ ...o, suffix: e.target.value }))}
        style={{ width: 110 }}
      />
      <Segmented
        size="small"
        value={options.conflict}
        onChange={(v) => setOptions((o) => ({ ...o, conflict: v as RenameOptions['conflict'] }))}
        options={[
          { label: t('rename.conflictSkip'), value: 'skip', icon: <CloseOutlined /> },
          { label: t('rename.conflictSeq'), value: 'sequence', icon: <CheckOutlined /> }
        ]}
      />
      <span className="ck-hint">
        {sel.length ? t('tools.scopeSelected', { n: scope.length }) : t('tools.scopeAll', { n: scope.length })}
      </span>
      <div className="ck-actionbar-spacer" />
      <span className="ck-chip ck-chip-neutral">{t('rename.renamesN', { n: plan.renames.length })}</span>
    </>
  )

  return (
    <PageShell
      title={t('menu.rename')}
      desc={t('desc.rename')}
      pageProps={{ className: 'ck-page--fill' }}
      footer={
        <>
          <span className="ck-hint">{t('rename.hint')}</span>
          <div className="ck-actionbar-spacer" />
          <Button
            type="primary"
            size="large"
            icon={<SyncOutlined />}
            disabled={busy || plan.renames.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            {t('rename.apply')}
          </Button>
        </>
      }
    >
      <FileListPanel
        kind="rename"
        title={t('rename.title')}
        fill
        toolbar={subbar}
        selectedPaths={sel}
        onSelectionChange={setSel}
        body={
          plan.renames.length === 0 ? (
            <div className="ck-empty">
              <p className="ck-faint">{t('rename.noRenames')}</p>
            </div>
          ) : (
            <div className="ck-rename-list">
              <Table
                size="small"
                rowKey="path"
                dataSource={plan.renames}
                columns={columns}
                pagination={false}
              />
            </div>
          )
        }
      />

      <Modal
        open={confirmOpen}
        title={t('rename.confirmTitle')}
        onCancel={() => setConfirmOpen(false)}
        onOk={() => void execute()}
        okText={t('rename.apply')}
        cancelText={t('common.cancel')}
        okButtonProps={{ loading: busy }}
        width={720}
      >
        <div className="ck-plan-summary">
          <span className="ck-chip ck-chip-blue">{t('rename.renamesN', { n: plan.renames.length })}</span>
          <span className="ck-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldIcon size={13} />
            {t('rename.undoHint')}
          </span>
        </div>
        <Table
          size="small"
          rowKey="path"
          dataSource={plan.renames}
          columns={columns}
          pagination={false}
          scroll={{ y: 320 }}
        />
      </Modal>
    </PageShell>
  )
}
