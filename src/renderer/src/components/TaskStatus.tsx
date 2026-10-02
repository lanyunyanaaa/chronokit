import { Progress } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '@renderer/store/taskStore'

/**
 * Global task pill, mounted once in App. Appears whenever a main-process task
 * is running and reporting progress (probe, exec, …); takes over the per-page
 * progress bars.
 */
export default function TaskStatus() {
  const { t } = useTranslation()
  const busy = useTaskStore((s) => s.busy)
  const progress = useTaskStore((s) => s.progress)
  if (!busy || !progress) return null

  const label = t(`task.${progress.task}`, { defaultValue: '' })
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="ck-taskpill" role="status">
      <LoadingOutlined spin style={{ fontSize: 13, color: 'var(--ck-accent)' }} />
      {label && <span className="ck-taskpill-label">{label}</span>}
      <Progress
        percent={pct}
        size="small"
        showInfo={false}
        strokeLinecap="round"
        style={{ width: 160, marginBottom: 0 }}
      />
      <span className="ck-taskpill-count">
        {progress.done}/{progress.total}
      </span>
    </div>
  )
}
