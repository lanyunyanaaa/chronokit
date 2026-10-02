import { useEffect, useState } from 'react'
import { Button, Modal, Radio, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { formatLocal } from '@core/time-engine'
import type { SmartFile } from '@core/smart-import'
import { formatSize } from '@renderer/utils/format'

interface Props {
  groups: SmartFile[][]
  open: boolean
  onCancel: () => void
  /** One entry per group: the chosen source file, or null to skip the group. */
  onConfirm: (choices: (SmartFile | null)[]) => void
}

function dirName(p: string): string {
  return p.replace(/[\\/][^\\/]*$/, '') || p
}

/**
 * Shown after a smart import when some names map to 3+ files. Each group is
 * sorted most-likely-source first, so the preselection is usually right.
 */
export default function SmartImportModal({ groups, open, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  const [sel, setSel] = useState<number[]>(() => groups.map(() => 0))

  useEffect(() => {
    setSel(groups.map(() => 0))
  }, [groups])

  const confirm = (): void => {
    onConfirm(groups.map((g, i) => (sel[i] >= 0 ? g[sel[i]] : null)))
  }

  return (
    <Modal
      open={open}
      title={t('sync.ambiguousTitle')}
      width={720}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('common.cancel')}
        </Button>,
        <Button key="ok" type="primary" onClick={confirm}>
          {t('common.execute')}
        </Button>
      ]}
    >
      <div className="ck-ambig-desc">{t('sync.ambiguousDesc')}</div>
      <div className="ck-ambig-list">
        {groups.map((g, gi) => (
          <div key={g[0].path} className="ck-ambig-group">
            <div className="ck-ambig-name">
              {g[0].name.replace(/\.[^.]+$/, '')}
              <span className="ck-chip ck-chip-neutral" style={{ marginInlineStart: 8 }}>
                {t('sync.candidatesN', { n: g.length })}
              </span>
            </div>
            <Radio.Group
              value={sel[gi]}
              onChange={(e) => setSel((s) => s.map((v, i) => (i === gi ? e.target.value : v)))}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {g.map((f, fi) => (
                  <Radio key={f.path} value={fi} className="ck-cand-radio">
                    <span className="ck-cand">
                      <span className="ck-cand-name">{f.name}</span>
                      <span className="ck-cand-dir" title={f.path}>
                        {dirName(f.path)}
                      </span>
                      <span className="ck-cand-meta">
                        {formatSize(f.size)} · {formatLocal(new Date(f.mtimeMs))}
                      </span>
                    </span>
                  </Radio>
                ))}
                <Radio value={-1}>{t('sync.skipGroup')}</Radio>
              </Space>
            </Radio.Group>
          </div>
        ))}
      </div>
    </Modal>
  )
}
