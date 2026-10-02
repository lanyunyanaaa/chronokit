import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import type { BackupFileRow, BackupGroup } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useTaskStore } from '@renderer/store/taskStore'
import PageShell from '@renderer/components/PageShell'
import EmptyState from '@renderer/components/EmptyState'
import { formatSize } from '@renderer/utils/format'
import { ShieldIcon } from '@renderer/components/icons'

/** Suggested cleanup age and the footprint threshold that nags the user. */
const CLEANUP_DAYS = 30
const SOFT_QUOTA = 5 * 1024 * 1024 * 1024

export default function BackupCenterPage() {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const busy = useTaskStore((s) => s.busy)
  const [groups, setGroups] = useState<BackupGroup[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setGroups(await ck.backupsList())
    } catch {
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats = useMemo(() => {
    const withBackups = groups.filter((g) => g.files.length > 0)
    const totalSize = withBackups.reduce((n, g) => n + g.totalSize, 0)
    const fileCount = withBackups.reduce((n, g) => n + g.files.filter((f) => !f.missing).length, 0)
    return { totalSize, fileCount, ops: withBackups.length }
  }, [groups])

  const overQuota = stats.totalSize > SOFT_QUOTA
  const cleanupCandidates = useMemo(
    () =>
      groups
        .filter((g) => g.files.length > 0 && Date.now() - g.ts > CLEANUP_DAYS * 86_400_000)
        .flatMap((g) => g.files.filter((f) => !f.missing).map((f) => f.backupPath)),
    [groups]
  )

  const undoOp = async (opId: string): Promise<void> => {
    useTaskStore.getState().setBusy(true)
    try {
      const res = await ck.journalUndo(opId)
      if (res.ok) message.success(t('history.undone'))
      else message.warning(res.message)
      await refresh()
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    } finally {
      useTaskStore.getState().setBusy(false)
      useTaskStore.getState().setProgress(null)
    }
  }

  const restoreOne = async (f: BackupFileRow): Promise<void> => {
    try {
      await ck.backupsRestore(f.backupPath, f.path, f.mtimeMs)
      message.success(t('backups.restoredOne'))
      await refresh()
    } catch (e: any) {
      message.error(String(e?.message ?? e))
    }
  }

  const deleteFiles = (paths: string[], confirmTitle: string): void => {
    modal.confirm({
      title: confirmTitle,
      content: t('backups.deleteConfirmN', { n: paths.length }),
      okText: t('backups.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        const n = await ck.backupsDelete(paths)
        message.success(t('backups.deletedN', { n }))
        await refresh()
      }
    })
  }

  const fileColumns: ColumnsType<BackupFileRow> = [
    {
      title: t('backups.col.original'),
      dataIndex: 'path',
      ellipsis: true,
      render: (v: string, f) => (
        <span title={v} className={f.missing ? 'ck-faint' : ''}>
          {v.split(/[\\/]/).pop()}
        </span>
      )
    },
    {
      title: t('backups.col.size'),
      dataIndex: 'size',
      width: 96,
      render: (v: number, f) => <span className="ck-mono ck-faint">{f.missing ? '—' : formatSize(v)}</span>
    },
    {
      title: '',
      width: 170,
      render: (_, f) =>
        f.missing ? (
          <span className="ck-chip ck-chip-warn">{t('backups.backupGone')}</span>
        ) : (
          <>
            <Button size="small" onClick={() => void restoreOne(f)}>
              {t('backups.restoreOne')}
            </Button>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => deleteFiles([f.backupPath], t('backups.deleteOneTitle'))}
            />
          </>
        )
    }
  ]

  const groupColumns: ColumnsType<BackupGroup> = [
    {
      title: t('backups.col.when'),
      dataIndex: 'ts',
      width: 150,
      render: (v: number) => <span className="ck-mono">{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>
    },
    {
      title: t('backups.col.label'),
      dataIndex: 'label',
      ellipsis: true
    },
    {
      title: t('backups.col.files'),
      dataIndex: 'files',
      width: 90,
      render: (_: unknown, g) => <span className="ck-mono">{g.files.length}</span>
    },
    {
      title: t('backups.col.size'),
      dataIndex: 'totalSize',
      width: 96,
      render: (v: number) => <span className="ck-mono ck-faint">{v ? formatSize(v) : '—'}</span>
    },
    {
      title: '',
      width: 210,
      render: (_, g) => (
        <>
          {g.active && g.files.length > 0 && (
            <Button size="small" danger onClick={() => void undoOp(g.opId)}>
              {t('backups.undoOp')}
            </Button>
          )}
          {g.status === 'undone' && <span className="ck-chip ck-chip-neutral">{t('history.undoneTag')}</span>}
          {g.files.length > 0 && (
            <Tooltip title={t('backups.deleteOp')}>
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  deleteFiles(
                    g.files.filter((f) => !f.missing).map((f) => f.backupPath),
                    t('backups.deleteOpTitle')
                  )
                }
              />
            </Tooltip>
          )}
        </>
      )
    }
  ]

  return (
    <PageShell
      title={t('menu.backups')}
      desc={t('desc.backups')}
      actions={
        <Tooltip title={t('backups.refresh')}>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading} />
        </Tooltip>
      }
      pageProps={{ className: 'ck-page--fill' }}
    >
      <div className="ck-backup-stats">
        <span className="ck-chip ck-chip-neutral">{t('backups.opsN', { n: stats.ops })}</span>
        <span className="ck-chip ck-chip-neutral">{t('backups.filesN', { n: stats.fileCount })}</span>
        <span className={`ck-chip ${overQuota ? 'ck-chip-warn' : 'ck-chip-green'}`}>
          {formatSize(stats.totalSize)}
        </span>
        {overQuota && <span className="ck-hint">{t('backups.overQuota')}</span>}
        <div className="ck-actionbar-spacer" />
        {cleanupCandidates.length > 0 && (
          <Button
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => deleteFiles(cleanupCandidates, t('backups.cleanupTitle'))}
          >
            {t('backups.cleanup', { n: cleanupCandidates.length })}
          </Button>
        )}
      </div>

      <div className="ck-panel ck-panel--fill">
        <div className="ck-panel-body ck-panel-body--flush">
          {groups.length === 0 && !loading ? (
            <EmptyState
              icon={<ShieldIcon size={22} />}
              title={t('backups.emptyTitle')}
              hint={t('backups.emptyHint')}
            />
          ) : (
            <div className="ck-backup-table">
              <Table
                size="small"
                rowKey="opId"
                loading={loading}
                dataSource={groups}
                columns={groupColumns}
                pagination={false}
                expandable={{
                  expandedRowRender: (g) => (
                    <Table
                      size="small"
                      rowKey="backupPath"
                      dataSource={g.files}
                      columns={fileColumns}
                      pagination={false}
                    />
                  ),
                  rowExpandable: (g) => g.files.length > 0
                }}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
