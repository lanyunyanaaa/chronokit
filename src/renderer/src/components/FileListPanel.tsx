import { useState, type ReactNode } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { ClearOutlined, DownOutlined, FileAddOutlined, FolderAddOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { RecentDir } from '@shared/index'
import { ck } from '@renderer/services/ck'
import { useMediaStore, type Kind } from '@renderer/store/mediaStore'
import { useDropPaths } from '@renderer/hooks/useDropPaths'
import MediaList from './MediaList'
import EmptyState from './EmptyState'
import { FilmIcon, RecentIcon, SelectAllIcon } from './icons'

interface Props {
  kind: Kind
  title: string
  selectedPaths: string[]
  onSelectionChange: (paths: string[]) => void
  /** Fill the remaining page height instead of a bounded scroll box. */
  fill?: boolean
  /** Config strip rendered between the panel head and the list (e.g. the batch
      editor's mode picker). */
  toolbar?: ReactNode
  extra?: ReactNode
}

function dirName(p: string): string {
  return p.replace(/[\\/][^\\/]*$/, '') || p
}

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

/** Panel with header actions + a virtualized, selectable media list. */
export default function FileListPanel({
  kind,
  title,
  selectedPaths,
  onSelectionChange,
  fill,
  toolbar,
  extra
}: Props) {
  const { t } = useTranslation()
  const paths = useMediaStore((s) => s.lists[kind])
  const count = paths.length
  const [recents, setRecents] = useState<RecentDir[]>([])

  const { dragOver, dragProps } = useDropPaths((dropped) => {
    void useMediaStore.getState().addPaths(kind, dropped)
  })

  const refreshRecents = async (): Promise<void> => {
    setRecents(await ck.recentsList().catch(() => []))
  }

  const addRecentFolder = async (dir: string): Promise<void> => {
    setRecents(await ck.recentsAdd(dir).catch(() => []))
    await useMediaStore.getState().addPaths(kind, [dir])
  }

  const addFromDialog = async (type: 'files' | 'folder'): Promise<void> => {
    const raw = type === 'files' ? await ck.selectFiles() : await ck.selectFolder()
    if (!raw) return
    const pathsIn = Array.isArray(raw) ? raw : [raw]
    if (!pathsIn.length) return
    // remember where imports come from so the next one is one click away
    const dir = type === 'folder' ? pathsIn[0] : dirName(pathsIn[0])
    if (dir) setRecents(await ck.recentsAdd(dir).catch(() => []))
    await useMediaStore.getState().addPaths(kind, pathsIn)
  }

  const removeSelected = (): void => {
    useMediaStore.getState().removePaths(kind, selectedPaths)
    onSelectionChange([])
  }

  const removeOne = (path: string): void => {
    useMediaStore.getState().removePaths(kind, [path])
    if (selectedPaths.includes(path)) onSelectionChange(selectedPaths.filter((p) => p !== path))
  }

  const clear = (): void => {
    useMediaStore.getState().clearKind(kind)
    onSelectionChange([])
  }

  const allSelected = count > 0 && selectedPaths.length === count
  const toggleSelectAll = (): void => onSelectionChange(allSelected ? [] : [...paths])

  const menuItems: MenuProps['items'] = [
    ...(recents.length
      ? ([
          { key: '_recents', label: t('common.recent'), type: 'group' as const },
          ...recents.map((r) => ({
            key: `r:${r.path}`,
            icon: <RecentIcon size={16} />,
            label: (
              <span className="ck-recent-item" title={r.path}>
                <span className="ck-recent-name">{baseName(r.path)}</span>
                <span className="ck-recent-path">{r.path}</span>
              </span>
            )
          })),
          { type: 'divider' as const }
        ] as NonNullable<MenuProps['items']>)
      : []),
    { key: 'folder', icon: <FolderAddOutlined />, label: t('common.addFolder') }
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('r:')) void addRecentFolder(key.slice(2))
    else if (key === 'folder') void addFromDialog('folder')
  }

  return (
    <div
      className={`ck-panel ${fill ? 'ck-panel--fill' : ''} ${dragOver ? 'ck-drop-active' : ''}`}
      {...dragProps}
    >
      <div className="ck-panel-head">
        <div className="ck-panel-title">
          <span className="ck-truncate">{title}</span>
          {count > 0 && <span className="ck-count">{count}</span>}
          {selectedPaths.length > 0 && (
            <span className="ck-chip ck-chip-blue">{t('common.selectedN', { n: selectedPaths.length })}</span>
          )}
        </div>
        <div className="ck-panel-actions">
          {extra}
          {count > 0 && (
            <Tooltip title={allSelected ? t('common.unselectAll') : t('common.selectAll')}>
              <Button
                size="small"
                type="text"
                aria-label={allSelected ? t('common.unselectAll') : t('common.selectAll')}
                icon={<SelectAllIcon size={15} />}
                onClick={toggleSelectAll}
              />
            </Tooltip>
          )}
          {selectedPaths.length > 0 && (
            <Button size="small" onClick={removeSelected}>
              {t('common.remove')} {selectedPaths.length}
            </Button>
          )}
          <Tooltip title={t('common.clear')}>
            <Button
              size="small"
              type="text"
              aria-label={t('common.clear')}
              icon={<ClearOutlined />}
              disabled={!count}
              onClick={clear}
            />
          </Tooltip>
          <Dropdown.Button
            size="small"
            trigger={['click']}
            icon={<DownOutlined style={{ fontSize: 10 }} />}
            onOpenChange={(open) => {
              if (open) void refreshRecents()
            }}
            menu={{ items: menuItems, onClick: onMenuClick }}
            onClick={() => void addFromDialog('files')}
          >
            {t('common.add')}
          </Dropdown.Button>
        </div>
      </div>
      {toolbar && <div className="ck-panel-subbar">{toolbar}</div>}
      <div className="ck-panel-body ck-panel-body--flush">
        {count === 0 ? (
          <EmptyState
            icon={<FilmIcon size={22} />}
            title={t('common.dropHint')}
            hint={t('common.dropHintSub')}
            dropActive={dragOver}
            actions={
              <>
                <Button size="small" icon={<FileAddOutlined />} onClick={() => void addFromDialog('files')}>
                  {t('common.addFiles')}
                </Button>
                <Button size="small" icon={<FolderAddOutlined />} onClick={() => void addFromDialog('folder')}>
                  {t('common.addFolder')}
                </Button>
              </>
            }
          />
        ) : (
          <MediaList
            paths={paths}
            selectedPaths={selectedPaths}
            onSelectionChange={onSelectionChange}
            onRemove={removeOne}
            fill={fill}
          />
        )}
      </div>
    </div>
  )
}
