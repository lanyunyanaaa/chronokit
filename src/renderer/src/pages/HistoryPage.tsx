import { useEffect, useState } from 'react'
import { App, Button, Popconfirm, Table, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { formatLocal } from '@core/time-engine'
import type { JournalFileEntry, JournalOp } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useAppInfo } from '@renderer/hooks/useAppInfo'
import PageShell from '@renderer/components/PageShell'
import EmptyState from '@renderer/components/EmptyState'
import { CheckIcon, HistoryIcon } from '@renderer/components/icons'

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const info = useAppInfo()
  const [ops, setOps] = useState<JournalOp[]>([])
  const [loading, setLoading] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    try {
      setOps(await ck.journalList())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const undo = async (op: JournalOp): Promise<void> => {
    setUndoing(op.id)
    try {
      const res = await ck.journalUndo(op.id)
      if (res.ok) message.success(t('history.undoOk'))
      else message.error(t('history.undoFail', { msg: res.message }))
      await refresh()
    } finally {
      setUndoing(null)
    }
  }

  const entryColumns: ColumnsType<JournalFileEntry> = [
    {
      title: t('plan.file'),
      dataIndex: 'path',
      ellipsis: true,
      render: (path: string) => (
        <span title={path}>
          {baseName(path)} <span className="ck-faint ck-mono">{path.replace(/[\\/][^\\/]*$/, '')}</span>
        </span>
      )
    },
    {
      title: t('history.backup'),
      dataIndex: 'backupPath',
      width: 96,
      render: (v?: string) =>
        v ? (
          <Tooltip title={v}>
            <span className="ck-chip ck-chip-green">
              <CheckIcon size={10} />
              {t('common.yes')}
            </span>
          </Tooltip>
        ) : (
          <span className="ck-faint">—</span>
        )
    },
    {
      title: t('history.error'),
      dataIndex: 'error',
      width: 240,
      ellipsis: true,
      render: (v?: string) => (v ? <span className="ck-chip ck-chip-red">{v}</span> : <span className="ck-faint">—</span>)
    }
  ]

  const columns: ColumnsType<JournalOp> = [
    {
      title: t('history.time'),
      dataIndex: 'ts',
      width: 172,
      render: (ts: number) => <span className="ck-time">{formatLocal(new Date(ts))}</span>
    },
    {
      title: t('history.operation'),
      dataIndex: 'label',
      render: (label: string, op) => {
        const kindLabel = t(`history.kind.${op.kind}`, { defaultValue: op.kind })
        return (
          <span className="ck-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <span>{label}</span>
            {kindLabel !== label && <span className="ck-chip ck-chip-neutral">{kindLabel}</span>}
          </span>
        )
      }
    },
    {
      title: t('history.files'),
      width: 84,
      align: 'right',
      render: (_, op) => <span className="ck-time">{op.entries.length}</span>
    },
    {
      title: t('history.status'),
      dataIndex: 'status',
      width: 96,
      render: (s: string) =>
        s === 'done' ? (
          <span className="ck-chip ck-chip-green">{t('history.done')}</span>
        ) : (
          <span className="ck-chip ck-chip-neutral">{t('history.undone')}</span>
        )
    },
    {
      title: '',
      width: 96,
      align: 'right',
      render: (_, op) =>
        op.status === 'done' ? (
          <Popconfirm
            title={t('history.confirmUndo')}
            onConfirm={() => void undo(op)}
            okText={t('common.execute')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger loading={undoing === op.id}>
              {t('common.undo')}
            </Button>
          </Popconfirm>
        ) : null
    }
  ]

  return (
    <PageShell
      title={t('menu.history')}
      badge={ops.length ? <span className="ck-chip ck-chip-neutral">{ops.length}</span> : undefined}
      desc={t('desc.history')}
      pageProps={{ className: 'ck-page--fill' }}
      actions={
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>
          {t('common.refresh')}
        </Button>
      }
      footer={
        <>
          <span className="ck-hint">{t('history.footHint')}</span>
          <div className="ck-actionbar-spacer" />
          {info?.dataRoot && (
            <>
              <span className="ck-actionbar-label">{t('history.journalPath')}</span>
              <span className="ck-mono ck-faint" title={info.dataRoot}>
                {info.dataRoot}
              </span>
            </>
          )}
        </>
      }
    >
      <div className="ck-panel ck-panel--fill">
        <div className="ck-panel-body ck-panel-body--tight">
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={[...ops].reverse()}
            columns={columns}
            pagination={{
              pageSize: 15,
              hideOnSinglePage: true,
              showSizeChanger: false,
              showTotal: (total) => t('common.totalN', { n: total })
            }}
            locale={{
              emptyText: (
                <EmptyState
                  icon={<HistoryIcon size={22} />}
                  title={t('history.empty')}
                  hint={t('history.emptyHint')}
                />
              )
            }}
            expandable={{
              expandedRowRender: (op) => (
                <Table
                  size="small"
                  rowKey={(e) => `${op.id}_${e.path}`}
                  dataSource={op.entries}
                  columns={entryColumns}
                  pagination={false}
                />
              )
            }}
          />
        </div>
      </div>
    </PageShell>
  )
}
