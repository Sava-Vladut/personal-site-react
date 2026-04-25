import type { FormEvent, PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import { getTimePassed } from '../lib/timePassed'
import type { OnlineRemoveTarget, WindowPosition } from '../types/apps'

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
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDurationChange: (value: string) => void
  onRefresh: () => void
  onPageChange: (updater: (page: number) => number) => void
  onRemoveTargetChange: (target: OnlineRemoveTarget | null) => void
  onRemove: () => void
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
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onSubmit,
  onDurationChange,
  onRefresh,
  onPageChange,
  onRemoveTargetChange,
  onRemove,
}: OnlineAppWindowProps) => (
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

export default OnlineAppWindow
