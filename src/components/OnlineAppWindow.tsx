import type { FormEvent, PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import { getTimePassed } from '../lib/timePassed'
import { formatRomaniaTimestamp } from '../lib/romaniaTime'
import type { OnlineRemoveTarget, WindowPosition } from '../types/apps'

type OnlineTab = 'log' | 'graph'

type OnlineAppWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  rows: string[]
  pageRows: string[]
  pageStart: number
  normalizedPage: number
  pageCount: number
  duration: string
  message: string
  loading: boolean
  removeTarget: OnlineRemoveTarget | null
  activeTab: OnlineTab
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDurationChange: (value: string) => void
  onRefresh: () => void
  onPageChange: (updater: (page: number) => number) => void
  onTabChange: (tab: OnlineTab) => void
  onRemoveTargetChange: (target: OnlineRemoveTarget | null) => void
  onRemove: () => void
}

const getLastThreeDayBuckets = (rows: string[]) => {
  const today = new Date()
  const buckets = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(today.getTime() - (2 - index) * 86_400_000)
    const key = formatRomaniaTimestamp(date).slice(0, 10)

    return {
      key,
      label: index === 2 ? 'Today' : key.slice(5),
      count: 0,
    }
  })
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  rows.forEach((timestamp) => {
    const bucket = bucketMap.get(timestamp.slice(0, 10))
    if (bucket) {
      bucket.count += 1
    }
  })

  return buckets
}

const OnlineAppWindow = ({
  windowRef,
  maximized,
  position,
  rows,
  pageRows,
  pageStart,
  normalizedPage,
  pageCount,
  duration,
  message,
  loading,
  removeTarget,
  activeTab,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onSubmit,
  onDurationChange,
  onRefresh,
  onPageChange,
  onTabChange,
  onRemoveTargetChange,
  onRemove,
}: OnlineAppWindowProps) => {
  const graphRows = getLastThreeDayBuckets(rows)
  const maxGraphCount = Math.max(1, ...graphRows.map((bucket) => bucket.count))

  return (
  <div
    ref={windowRef}
    className={`app-window online-app-window ${maximized ? 'maximized' : ''} ${position ? 'drag-positioned' : ''}`}
    style={position && !maximized ? { left: position.x, top: position.y } : undefined}
  >
    <TerminalHeader
      title="online log"
      icon="●"
      onDragStart={onDragStart}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    />

    <div className="online-app-body">
      <form className="online-app-form" onSubmit={onSubmit}>
        <label className="online-app-label" htmlFor="online-duration">Command</label>
        <input
          id="online-duration"
          className="online-app-input"
          type="text"
          value={duration}
          onChange={(event) => onDurationChange(event.target.value)}
          placeholder="online 15m, 15m, 5h"
          autoComplete="off"
          spellCheck="false"
        />
        <button className="online-app-button primary" type="submit" disabled={loading}>
          Add
        </button>
        <button className="online-app-button" type="button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </form>

      {message && (
        <div className="online-app-message">{message}</div>
      )}

      <div className="online-app-tabs" role="tablist" aria-label="Online views">
        <button
          className={activeTab === 'log' ? 'selected' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'log'}
          onClick={() => onTabChange('log')}
        >
          Log
        </button>
        <button
          className={activeTab === 'graph' ? 'selected' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'graph'}
          onClick={() => onTabChange('graph')}
        >
          Graph
        </button>
      </div>

      {activeTab === 'log' ? (
        <>
          <div className="online-app-table-wrap">
            {rows.length === 0 ? (
              <div className="online-app-empty">
                {loading ? 'Loading online log...' : 'No online log entries found.'}
              </div>
            ) : (
              <div className="online-table online-app-table">
                <div className="online-table-row online-table-header">
                  <span>#</span>
                  <span>Timestamp</span>
                  <span>Time passed</span>
                  <span>Action</span>
                </div>
                {pageRows.map((timestamp, index) => (
                  <div className="online-table-row" key={`${timestamp}-${pageStart + index}`}>
                    <span>{pageStart + index + 1}</span>
                    <span>{timestamp}</span>
                    <span>{getTimePassed(timestamp)}</span>
                    <span>
                      <button
                        className="online-app-link-button danger"
                        type="button"
                        disabled={loading}
                        onClick={() => onRemoveTargetChange({
                          index: pageStart + index + 1,
                          timestamp,
                        })}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="online-app-pagination">
            <button
              className="online-app-button"
              type="button"
              onClick={() => onPageChange((page) => Math.max(1, page - 1))}
              disabled={loading || normalizedPage === 1}
            >
              Prev
            </button>
            <span>Page {normalizedPage} of {pageCount} ({rows.length})</span>
            <button
              className="online-app-button"
              type="button"
              onClick={() => onPageChange((page) => Math.min(pageCount, page + 1))}
              disabled={loading || normalizedPage === pageCount}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="online-graph-panel">
          <div className="online-graph-title">Last 3 Days Activity</div>
          <div className="online-graph">
            {graphRows.map((bucket) => (
              <div className="online-graph-bar-row" key={bucket.key}>
                <span>{bucket.label}</span>
                <div className="online-graph-track" aria-label={`${bucket.count} entries on ${bucket.key}`}>
                  <div style={{ width: `${Math.max(4, (bucket.count / maxGraphCount) * 100)}%` }} />
                </div>
                <strong>{bucket.count}</strong>
              </div>
            ))}
          </div>
          <div className="online-graph-note">
            Counts are grouped by Romania calendar day.
          </div>
        </div>
      )}
    </div>

    {removeTarget && (
      <div className="online-modal-backdrop" role="presentation">
        <div className="online-modal" role="dialog" aria-modal="true" aria-labelledby="online-remove-title">
          <div id="online-remove-title" className="online-modal-title">Remove entry?</div>
          <div className="online-modal-body">
            Entry {removeTarget.index}: {removeTarget.timestamp}
          </div>
          <div className="online-modal-actions">
            <button
              className="online-app-button"
              type="button"
              disabled={loading}
              onClick={() => onRemoveTargetChange(null)}
            >
              Cancel
            </button>
            <button
              className="online-app-button danger"
              type="button"
              disabled={loading}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  )
}

export default OnlineAppWindow
