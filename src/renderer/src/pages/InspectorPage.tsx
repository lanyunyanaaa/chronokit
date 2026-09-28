import { useState } from 'react'
import { App, Button, Collapse, Descriptions, Spin, Table, Tag } from 'antd'
import { FileSearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { formatDuration, formatSize } from '@renderer/components/FileListPanel'
import { formatLocal, parseFfprobeDate } from '@core/time-engine'
import type { MediaInfo } from '@shared/index'
import { ck } from '@renderer/services/ck'
import PageHeader from '@renderer/components/PageHeader'
import EmptyState from '@renderer/components/EmptyState'

export default function InspectorPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const load = async (p: string): Promise<void> => {
    setLoading(true)
    try {
      const res = await ck.probeFiles([p])
      const first = res[0]
      if (first) setInfo(first)
      else message.error(t('inspector.probeFailed'))
    } finally {
      setLoading(false)
    }
  }

  const pick = async (): Promise<void> => {
    const files = await ck.selectFiles()
    if (files.length) await load(files[0])
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.ckApi.getPathForFile(f))
      .filter(Boolean)
    if (paths.length) await load(paths[0])
  }

  const copyJson = async (): Promise<void> => {
    if (!info) return
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2))
    message.success(t('common.copy'))
  }

  const creation = info?.creationTimeIso ? parseFfprobeDate(info.creationTimeIso) : null

  return (
    <div
      className={dragOver ? 'ck-drop-active' : undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        void onDrop(e)
      }}
    >
      <PageHeader
        title={t('menu.inspector')}
        desc={t('desc.inspector')}
        actions={
          <Button type="primary" icon={<FileSearchOutlined />} onClick={() => void pick()}>
            {t('common.pickFile')}
          </Button>
        }
      />

      <Spin spinning={loading}>
        {!info ? (
          <div className="ck-panel">
            <EmptyState icon="🔍" title={t('inspector.noFile')} hint={t('common.dropHint')} />
          </div>
        ) : (
          <div>
            <div className="ck-panel">
              <div className="ck-panel-head">
                <div className="ck-panel-title">
                  <span title={info.path}>{info.path}</span>
                </div>
                <Button size="small" onClick={() => void copyJson()}>
                  {t('inspector.copyJson')}
                </Button>
              </div>
              <div className="ck-panel-body">
                <Descriptions
                  size="small"
                  bordered
                  column={3}
                  items={[
                    { key: 'container', label: t('inspector.container'), children: info.formatName ?? '—' },
                    { key: 'size', label: t('inspector.size'), children: formatSize(info.size) },
                    {
                      key: 'duration',
                      label: t('inspector.duration'),
                      children: formatDuration(info.durationSec) || '—'
                    },
                    {
                      key: 'bitrate',
                      label: t('inspector.bitrate'),
                      children: info.bitrate ? `${Math.round(info.bitrate / 1000)} kbps` : '—'
                    },
                    {
                      key: 'creation',
                      label: t('time.creationTime'),
                      span: 2,
                      children: creation ? (
                        <span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatLocal(creation)}</span>
                          <Tag color="blue" style={{ marginInlineStart: 10 }}>
                            {t('time.metadata')}
                          </Tag>
                        </span>
                      ) : (
                        <Tag color="warning">--</Tag>
                      )
                    }
                  ]}
                />
              </div>
            </div>

            <div className="ck-panel" style={{ marginTop: 12 }}>
              <div className="ck-panel-head">
                <div className="ck-panel-title">{t('inspector.streams')}</div>
              </div>
              <div className="ck-panel-body">
                <Collapse
                  items={info.streams.map((s) => ({
                    key: String(s.index),
                    label: `#${s.index} ${s.type} · ${s.codec ?? ''}${
                      s.width ? ` · ${s.width}×${s.height}` : ''
                    }${s.fps ? ` · ${s.fps} fps` : ''}`,
                    children: (
                      <Descriptions
                        size="small"
                        bordered
                        column={2}
                        items={[
                          { key: 'type', label: 'type', children: s.type },
                          { key: 'codec', label: 'codec', children: s.codec ?? '—' },
                          ...(s.width
                            ? [{ key: 'res', label: 'resolution', children: `${s.width}×${s.height}` }]
                            : []),
                          ...(s.fps ? [{ key: 'fps', label: 'fps', children: String(s.fps) }] : []),
                          ...(s.sampleRate
                            ? [{ key: 'sr', label: 'sample rate', children: `${s.sampleRate} Hz` }]
                            : []),
                          ...(s.channels
                            ? [{ key: 'ch', label: 'channels', children: String(s.channels) }]
                            : []),
                          ...(s.durationSec
                            ? [{ key: 'dur', label: 'duration', children: formatDuration(s.durationSec) }]
                            : [])
                        ]}
                      />
                    )
                  }))}
                />
              </div>
            </div>

            <div className="ck-panel" style={{ marginTop: 12 }}>
              <div className="ck-panel-head">
                <div className="ck-panel-title">{t('inspector.tags')}</div>
              </div>
              <div className="ck-panel-body">
                <Table
                  size="small"
                  rowKey={(r) => r.k}
                  dataSource={Object.entries(info.tags).map(([k, v]) => ({ k, v }))}
                  pagination={false}
                  scroll={{ y: 240 }}
                  columns={[
                    { title: 'key', dataIndex: 'k', width: 280 },
                    { title: 'value', dataIndex: 'v' }
                  ]}
                  locale={{ emptyText: '—' }}
                />
              </div>
            </div>
          </div>
        )}
      </Spin>
    </div>
  )
}
