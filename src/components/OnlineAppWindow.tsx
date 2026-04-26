import type { FormEvent, PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import { getTimePassed } from '../lib/timePassed'
import { formatRomaniaTimestamp, parseRomaniaTimestamp } from '../lib/romaniaTime'
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

const THREE_DAYS_MS = 3 * 86_400_000

const formatTimelineLabel = (date: Date, fallback: string) => {
  const todayKey = formatRomaniaTimestamp(new Date()).slice(0, 10)
  const dateKey = formatRomaniaTimestamp(date).slice(0, 10)

  if (dateKey === todayKey) return 'Today'

  return fallback
}

const getThreeDayTimeline = (rows: string[]) => {
  const nowMs = Date.now()
  const startMs = nowMs - THREE_DAYS_MS
  const dayMs = 86_400_000
  const entries = rows
    .map((timestamp) => ({
      timestamp,
      timestampMs: parseRomaniaTimestamp(timestamp),
    }))
    .filter(({ timestampMs }) => !Number.isNaN(timestampMs) && timestampMs >= startMs && timestampMs <= nowMs)
    .map(({ timestamp, timestampMs }) => ({
      timestamp,
      position: ((timestampMs - startMs) / THREE_DAYS_MS) * 100,
    }))

  const markers = Array.from({ length: 4 }, (_, index) => {
    const markerMs = startMs + index * dayMs
    const date = new Date(markerMs)
    const timestamp = formatRomaniaTimestamp(date)

    return {
      key: timestamp,
      label: index === 3 ? 'Now' : formatTimelineLabel(date, timestamp.slice(5, 10)),
      position: (index / 3) * 100,
    }
  })

  return { entries, markers }
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
  const graphTimeline = getThreeDayTimeline(rows)

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
          <div className="online-graph-heading">
            <div className="online-graph-title">Last 3 Days Activity</div>
            <div className="online-graph-count">{graphTimeline.entries.length} entries</div>
          </div>
          <div className="online-graph">
            <div
              className="online-graph-track"
              aria-label={`${graphTimeline.entries.length} online entries from the last 3 days`}
            >
              {graphTimeline.markers.map((marker) => (
                <div
                  className="online-graph-marker"
                  key={marker.key}
                  style={{ left: `${marker.position}%` }}
                  aria-hidden="true"
                />
              ))}
              {graphTimeline.entries.map((entry, index) => (
                <span
                  className="online-graph-dot"
                  key={`${entry.timestamp}-${index}`}
                  style={{ left: `${entry.position}%` }}
                  title={entry.timestamp}
                  aria-label={entry.timestamp}
                />
              ))}
            </div>
            <div className="online-graph-labels" aria-hidden="true">
              {graphTimeline.markers.map((marker) => (
                <span key={marker.key} style={{ left: `${marker.position}%` }}>
                  {marker.label}
                </span>
              ))}
            </div>
          </div>
          <div className="online-graph-note">
            Dots are placed by exact Romania timestamp across the last 72 hours.
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
