import { useEffect, useState } from 'react'
import { App, Button, Collapse, Spin, Table } from 'antd'
import { FileSearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { formatDuration, formatSize } from '@renderer/utils/format'
import { formatLocal, parseFfprobeDate } from '@core/time-engine'
import type { MediaInfo } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useDropPaths } from '@renderer/hooks/useDropPaths'
import PageShell from '@renderer/components/PageShell'
import EmptyState from '@renderer/components/EmptyState'
import { SearchIcon } from '@renderer/components/icons'

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

interface Cell {
  key: string
  label: string
  value: React.ReactNode
  wide?: boolean
}

export default function InspectorPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (paths: string[]): Promise<void> => {
    if (!paths.length) return
    setLoading(true)
    try {
      const res = await ck.probeFiles([paths[0]])
      const first = res[0]
      if (first) setInfo(first)
      else message.error(t('inspector.probeFailed'))
    } finally {
      setLoading(false)
    }
  }

  const pick = async (): Promise<void> => {
    await load(await ck.selectFiles())
  }

  useEffect(() => {
    // Dev-only automation hook (screenshot mode)
    ;(window as any).__ckInspect = (p: string) => void load([p])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { dragOver, dragProps } = useDropPaths((paths) => {
    void load(paths)
  })

  const copyJson = async (): Promise<void> => {
    if (!info) return
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2))
    message.success(t('common.copy'))
  }

  const creation = info?.creationTimeIso ? parseFfprobeDate(info.creationTimeIso) : null
  const video = info?.streams.find((s) => s.type === 'video')
  const audio = info?.streams.find((s) => s.type === 'audio')

  const cells: Cell[] = info
    ? [
        { key: 'container', label: t('inspector.container'), value: info.formatName ?? '—' },
        { key: 'size', label: t('inspector.size'), value: formatSize(info.size) },
        {
          key: 'duration',
          label: t('inspector.duration'),
          value: formatDuration(info.durationSec) || '—'
        },
        {
          key: 'bitrate',
          label: t('inspector.bitrate'),
          value: info.bitrate ? `${Math.round(info.bitrate / 1000)} kbps` : '—'
        },
        {
          key: 'res',
          label: t('inspector.resolution'),
          value: video?.width ? `${video.width}×${video.height}` : '—'
        },
        { key: 'fps', label: t('inspector.fps'), value: video?.fps ? String(video.fps) : '—' },
        { key: 'vcodec', label: t('inspector.video'), value: video?.codec ?? '—' },
        { key: 'acodec', label: t('inspector.audio'), value: audio?.codec ?? '—' },
        {
          key: 'creation',
          label: t('time.creationTime'),
          value: creation ? (
            <span className="ck-time">{formatLocal(creation)}</span>
          ) : (
            <span className="ck-chip ck-chip-dash">{t('common.noTime')}</span>
          )
        },
        {
          key: 'path',
          label: t('inspector.file'),
          value: <span className="ck-mono">{info.path}</span>,
          wide: true
        }
      ]
    : []

  return (
    <PageShell
      title={t('menu.inspector')}
      desc={t('desc.inspector')}
      pageProps={{ ...dragProps, className: dragOver ? 'ck-drop-active' : undefined }}
      actions={
        <Button type="primary" icon={<FileSearchOutlined />} onClick={() => void pick()}>
          {t('common.pickFile')}
        </Button>
      }
    >
      <Spin spinning={loading}>
        {!info ? (
          <div className="ck-panel ck-panel--fill">
            <EmptyState
              icon={<SearchIcon size={22} />}
              title={t('inspector.noFile')}
              hint={t('common.dropHintSub')}
              dropActive={dragOver}
              actions={
                <Button size="small" icon={<FileSearchOutlined />} onClick={() => void pick()}>
                  {t('common.pickFile')}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="ck-panel">
              <div className="ck-panel-head">
                <div className="ck-panel-title">
                  <span className="ck-truncate" title={info.path}>
                    {baseName(info.path)}
                  </span>
                  {info.formatName && <span className="ck-chip ck-chip-neutral">{info.formatName}</span>}
                </div>
                <div className="ck-panel-actions">
                  <Button size="small" onClick={() => void copyJson()}>
                    {t('inspector.copyJson')}
                  </Button>
                  <Button size="small" onClick={() => setInfo(null)}>
                    {t('common.close')}
                  </Button>
                </div>
              </div>
              <div className="ck-panel-body">
                <div className="ck-kv">
                  {cells.map((c) => (
                    <div key={c.key} className={`ck-kv-cell ${c.wide ? 'is-wide' : ''}`}>
                      <div className="ck-kv-label">{c.label}</div>
                      <div className="ck-kv-value">{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ck-panel">
              <div className="ck-panel-head">
                <div className="ck-panel-title">{t('inspector.streams')}</div>
                <span className="ck-count">{info.streams.length}</span>
              </div>
              <div className="ck-panel-body">
                <Collapse
                  className="ck-collapse"
                  defaultActiveKey={info.streams.map((s) => String(s.index))}
                  items={info.streams.map((s) => ({
                    key: String(s.index),
                    label: (
                      <span className="ck-stream-line">
                        <span className="ck-chip ck-chip-neutral ck-mono">#{s.index}</span>
                        <span className="ck-stream-head">
                          {t(`inspector.${s.type}`, { defaultValue: s.type })}
                        </span>
                        {s.codec && <span className="ck-chip ck-chip-blue">{s.codec}</span>}
                        {s.width ? (
                          <span className="ck-chip ck-chip-neutral ck-mono">
                            {s.width}×{s.height}
                          </span>
                        ) : null}
                        {s.fps ? (
                          <span className="ck-chip ck-chip-neutral ck-mono">{s.fps} fps</span>
                        ) : null}
                        {s.sampleRate ? (
                          <span className="ck-chip ck-chip-neutral ck-mono">{s.sampleRate} Hz</span>
                        ) : null}
                        {s.channels ? (
                          <span className="ck-chip ck-chip-neutral ck-mono">{s.channels} ch</span>
                        ) : null}
                      </span>
                    ),
                    children: (
                      <div className="ck-kv">
                        {[
                          { k: 'type', v: s.type },
                          { k: 'codec', v: s.codec ?? '—' },
                          ...(s.width ? [{ k: 'resolution', v: `${s.width}×${s.height}` }] : []),
                          ...(s.fps ? [{ k: 'fps', v: String(s.fps) }] : []),
                          ...(s.sampleRate ? [{ k: 'sample rate', v: `${s.sampleRate} Hz` }] : []),
                          ...(s.channels ? [{ k: 'channels', v: String(s.channels) }] : []),
                          ...(s.durationSec ? [{ k: 'duration', v: formatDuration(s.durationSec) }] : [])
                        ].map((kv) => (
                          <div key={kv.k} className="ck-kv-cell">
                            <div className="ck-kv-label">{kv.k}</div>
                            <div className="ck-kv-value ck-mono">{kv.v}</div>
                          </div>
                        ))}
                      </div>
                    )
                  }))}
                />
              </div>
            </div>

            <div className="ck-panel">
              <div className="ck-panel-head">
                <div className="ck-panel-title">{t('inspector.tags')}</div>
                <span className="ck-count">{Object.keys(info.tags).length}</span>
              </div>
              <div className="ck-panel-body ck-panel-body--tight">
                <Table
                  size="small"
                  rowKey={(r) => r.k}
                  dataSource={Object.entries(info.tags).map(([k, v]) => ({ k, v }))}
                  pagination={false}
                  scroll={{ y: 260 }}
                  columns={[
                    {
                      title: 'key',
                      dataIndex: 'k',
                      width: 260,
                      render: (v: string) => <span className="ck-mono">{v}</span>
                    },
                    { title: 'value', dataIndex: 'v', ellipsis: true }
                  ]}
                  locale={{ emptyText: '—' }}
                />
              </div>
            </div>
          </>
        )}
      </Spin>
    </PageShell>
  )
}
