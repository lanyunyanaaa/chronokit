import { Modal, Table, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { PlanItem } from '@shared/index'

interface Props {
  open: boolean
  items: PlanItem[]
  skippedCount?: number
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const FIELD_KEY: Record<string, string> = {
  creation_time: 'time.creationTime',
  mtime: 'time.mtime',
  ctime: 'time.ctime'
}

const FIELD_COLOR: Record<string, string> = {
  creation_time: 'blue',
  mtime: 'green',
  ctime: 'purple'
}

export default function PlanModal({ open, items, skippedCount = 0, loading, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()

  const rows = items.flatMap((it) =>
    it.changes.map((c, i) => ({
      key: `${it.path}_${c.field}_${i}`,
      name: it.name,
      field: c.field,
      from: c.from ?? '—',
      to: c.to,
      timeSource: it.timeSource
    }))
  )

  return (
    <Modal
      open={open}
      title={t('plan.title')}
      width={880}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={t('common.execute')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !items.length, loading }}
    >
      <Table
        size="small"
        dataSource={rows}
        pagination={rows.length > 20 ? { pageSize: 20 } : false}
        scroll={{ y: 420 }}
        columns={[
          { title: t('plan.file'), dataIndex: 'name', ellipsis: true },
          {
            title: t('plan.field'),
            dataIndex: 'field',
            width: 150,
            render: (f: string) => (
              <Tag color={FIELD_COLOR[f]}>{t(FIELD_KEY[f] ?? f)}</Tag>
            )
          },
          { title: t('plan.from'), dataIndex: 'from', width: 175 },
          { title: t('plan.to'), dataIndex: 'to', width: 175 },
          {
            title: t('time.source'),
            dataIndex: 'timeSource',
            width: 100,
            render: (s?: string) => (s ? t(`time.${s}`) : '—')
          }
        ]}
      />
      {skippedCount > 0 && (
        <div style={{ color: '#faad14', marginTop: 8 }}>{t('plan.skipped', { n: skippedCount })}</div>
      )}
    </Modal>
  )
}
