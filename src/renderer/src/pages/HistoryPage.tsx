import { useEffect, useState } from 'react'
import { App, Button, Popconfirm, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { formatLocal } from '@core/time-engine'
import type { JournalFileEntry, JournalOp } from '@shared/index'
import { ck } from '@renderer/services/ck'
import PageHeader from '@renderer/components/PageHeader'

export default function HistoryPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
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
    { title: 'file', dataIndex: 'path', ellipsis: true },
    {
      title: 'backup',
      dataIndex: 'backupPath',
      width: 90,
      render: (v?: string) => (v ? <Tag color="gold">✓</Tag> : <span style={{ color: '#5f6879' }}>—</span>)
    },
    {
      title: 'error',
      dataIndex: 'error',
      width: 260,
      ellipsis: true,
      render: (v?: string) => (v ? <Tag color="error">{v}</Tag> : <span style={{ color: '#5f6879' }}>—</span>)
    }
  ]

  const columns: ColumnsType<JournalOp> = [
    {
      title: t('history.time'),
      dataIndex: 'ts',
      width: 175,
      render: (ts: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatLocal(new Date(ts))}</span>
      )
    },
    { title: t('history.operation'), dataIndex: 'label' },
    { title: t('history.files'), width: 90, render: (_, op) => op.entries.length },
    {
      title: t('history.status'),
      dataIndex: 'status',
      width: 110,
      render: (s: string) =>
        s === 'done' ? (
          <Tag color="processing">{t('history.done')}</Tag>
        ) : (
          <Tag>{t('history.undone')}</Tag>
        )
    },
    {
      title: '',
      width: 110,
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
    <div>
      <PageHeader title={t('menu.history')} desc={t('desc.history')} />
      <div className="ck-panel">
        <div className="ck-panel-body" style={{ padding: 4 }}>
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={[...ops].reverse()}
            columns={columns}
            pagination={{ pageSize: 15 }}
            locale={{ emptyText: t('history.empty') }}
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
    </div>
  )
}
