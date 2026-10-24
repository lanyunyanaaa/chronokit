import { Modal, Table } from 'antd'
import { useTranslation } from 'react-i18next'
import type { PlanItem } from '@shared/index'
import { ArrowRightIcon, ShieldIcon } from './icons'

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

const FIELD_CHIP: Record<string, string> = {
  creation_time: 'ck-chip-blue',
  mtime: 'ck-chip-green',
  ctime: 'ck-chip-purple'
}

/**
 * Dry-run preview. Rows are grouped per file and read as a before → after
 * diff, with the time source that produced the new value; nothing is written
 * until the user confirms here.
 */
export default function PlanModal({
  open,
  items,
  skippedCount = 0,
  loading,
  onCancel,
  onConfirm
}: Props) {
  const { t } = useTranslation()

  const rows = items.flatMap((it) =>
    it.changes.map((c, i) => ({
      key: `${it.path}_${c.field}_${i}`,
      name: it.name,
      path: it.path,
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
      width={900}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={t('common.execute')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !items.length, loading }}
    >
      <div className="ck-plan-summary">
        <span className="ck-chip ck-chip-blue">{t('plan.filesN', { n: items.length })}</span>
        <span className="ck-chip ck-chip-neutral">{t('plan.changesN', { n: rows.length })}</span>
        {skippedCount > 0 && (
          <span className="ck-chip ck-chip-warn">{t('plan.skippedN', { n: skippedCount })}</span>
        )}
        <span className="ck-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ShieldIcon size={13} />
          {t('plan.safety')}
        </span>
      </div>
      <Table
        size="small"
        dataSource={rows}
        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
        scroll={{ y: 360 }}
        columns={[
          {
            title: t('plan.file'),
            dataIndex: 'name',
            ellipsis: true,
            render: (name: string, r: { path: string }) => (
              <span title={r.path}>{name}</span>
            )
          },
          {
            title: t('plan.field'),
            dataIndex: 'field',
            width: 132,
            render: (f: string) => (
              <span className={`ck-chip ${FIELD_CHIP[f] ?? 'ck-chip-neutral'}`}>
                {t(FIELD_KEY[f] ?? f)}
              </span>
            )
          },
          {
            title: t('plan.from'),
            dataIndex: 'from',
            width: 172,
            render: (v: string) => <span className="ck-mono ck-faint">{v}</span>
          },
          {
            title: '',
            width: 34,
            align: 'center',
            render: () => (
              <span className="ck-plan-arrow">
                <ArrowRightIcon size={15} />
              </span>
            )
          },
          {
            title: t('plan.to'),
            dataIndex: 'to',
            width: 178,
            render: (v: string) => <span className="ck-mono">{v}</span>
          },
          {
            title: t('time.source'),
            dataIndex: 'timeSource',
            width: 92,
            render: (s?: string) =>
              s ? <span className="ck-chip ck-chip-neutral ck-nowrap">{t(`time.${s}`)}</span> : '—'
          }
        ]}
      />
    </Modal>
  )
}
