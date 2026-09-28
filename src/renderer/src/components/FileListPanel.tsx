import { useState, type ReactNode } from 'react'
import { Button, Card, Empty, List, Space } from 'antd'
import { ClearOutlined, FileAddOutlined, FolderAddOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ck } from '@renderer/services/ck'
import { useAppStore, type Kind, type VideoItem } from '@renderer/store/appStore'
import Thumb from './Thumb'
import TimeBadges from './TimeBadges'

interface Props {
  kind: Kind
  title: string
  selectedPaths: string[]
  onSelectionChange: (paths: string[]) => void
  extra?: ReactNode
}

export function formatSize(n: number): string {
  let v = n
  for (const u of ['B', 'KB', 'MB', 'GB']) {
    if (v < 1024) return `${v.toFixed(u === 'B' || v >= 100 ? 0 : 1)} ${u}`
    v /= 1024
  }
  return `${v.toFixed(1)} TB`
}

export function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

export default function FileListPanel({ kind, title, selectedPaths, onSelectionChange, extra }: Props) {
  const { t } = useTranslation()
  const items = useAppStore((s) =>
    kind === 'sources' ? s.sources : kind === 'targets' ? s.targets : s.toolItems
  )
  const [dragOver, setDragOver] = useState(false)

  const addFromDialog = async (type: 'files' | 'folder'): Promise<void> => {
    const raw = type === 'files' ? await ck.selectFiles() : await ck.selectFolder()
    if (!raw) return
    const paths = Array.isArray(raw) ? raw : [raw]
    if (!paths.length) return
    await useAppStore.getState().addPaths(kind, paths)
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.ckApi.getPathForFile(f))
      .filter(Boolean)
    if (paths.length) await useAppStore.getState().addPaths(kind, paths)
  }

  const toggleSelect = (path: string): void => {
    if (selectedPaths.includes(path)) {
      onSelectionChange(selectedPaths.filter((p) => p !== path))
    } else {
      onSelectionChange([...selectedPaths, path])
    }
  }

  const removeSelected = (): void => {
    useAppStore.getState().removePaths(kind, selectedPaths)
    onSelectionChange([])
  }

  const clear = (): void => {
    useAppStore.getState().clearKind(kind)
    onSelectionChange([])
  }

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
      <Card
        size="small"
        title={title}
        styles={{ body: { padding: 6 } }}
        extra={
          <Space size={4} wrap>
            {extra}
            <Button size="small" icon={<FileAddOutlined />} onClick={() => void addFromDialog('files')}>
              {t('common.addFiles')}
            </Button>
            <Button size="small" icon={<FolderAddOutlined />} onClick={() => void addFromDialog('folder')}>
              {t('common.addFolder')}
            </Button>
            {selectedPaths.length > 0 && (
              <Button size="small" onClick={removeSelected}>
                {t('common.undo')}({selectedPaths.length})
              </Button>
            )}
            <Button size="small" icon={<ClearOutlined />} disabled={!items.length} onClick={clear}>
              {t('common.clear')}
            </Button>
          </Space>
        }
      >
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('common.dropHint')}
              style={{ padding: '28px 0' }}
            />
          ) : (
            <List
              dataSource={items}
              rowKey={(i: VideoItem) => i.path}
              split={false}
              renderItem={(item) => {
                const selected = selectedPaths.includes(item.path)
                return (
                  <List.Item
                    onClick={() => toggleSelect(item.path)}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: selected ? 'rgba(22, 119, 255, 0.18)' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                      <Thumb item={item} kind={kind} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          title={item.path}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {item.name}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <TimeBadges item={item} />
                        </div>
                        <div style={{ color: '#8a8a8a', fontSize: 12, marginTop: 2 }}>
                          {formatSize(item.size)}
                          {item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ''}
                          {item.probing ? ` · ${t('common.loading')}` : ''}
                          {item.probeFailed ? ' · !' : ''}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
