import type { PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import type { InstagramLogRow, InstagramRemoveTarget, WindowPosition } from '../types/apps'

type InstagramAppWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  users: string[]
  rows: InstagramLogRow[]
  selectedUser: string
  message: string
  loading: boolean
  removeTarget: InstagramRemoveTarget | null
  lastChecked?: string
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onSelectedUserChange: (value: string) => void
  onRemoveTargetChange: (target: InstagramRemoveTarget | null) => void
  onRemove: () => void
  onRefresh: () => void
}

const InstagramAppWindow = ({
  windowRef,
  maximized,
  position,
  users,
  rows,
  selectedUser,
  message,
  loading,
  removeTarget,
  lastChecked,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onSelectedUserChange,
  onRemoveTargetChange,
  onRemove,
  onRefresh,
}: InstagramAppWindowProps) => (
  <div
    ref={windowRef}
    className={`app-window instagram-app-window ${maximized ? 'maximized' : ''} ${position ? 'drag-positioned' : ''}`}
    style={position && !maximized ? { left: position.x, top: position.y } : undefined}
  >
    <TerminalHeader
      title="instagram tracker"
      icon="IG"
      onDragStart={onDragStart}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    />

    <div className="instagram-app-body">
      <div className="instagram-app-toolbar">
        <div>
          <div className="instagram-app-title">Followers / Following</div>
          <div className="instagram-app-subtitle">
            {users.length} watched user{users.length === 1 ? '' : 's'} · last checked {lastChecked ?? 'never'}
          </div>
        </div>
        <button
          className="online-app-button primary"
          type="button"
          disabled={loading}
          onClick={onRefresh}
        >
          Refresh now
        </button>
      </div>

      {message && (
        <div className="online-app-message">{message}</div>
      )}

      <div className="instagram-user-list">
        {users.length === 0 ? (
          <span className="instagram-user-empty">Add usernames to instagram-users.txt.</span>
        ) : (
          users.map((user) => {
            const selected = selectedUser === user
            return (
              <button
                className={`instagram-user-pill ${selected ? 'selected' : ''}`}
                type="button"
                key={user}
                aria-pressed={selected}
                onClick={() => onSelectedUserChange(selected ? '' : user)}
              >
                @{user}
              </button>
            )
          })
        )}
      </div>

      <div className="online-app-table-wrap instagram-table-wrap">
        {rows.length === 0 ? (
          <div className="online-app-empty">
            {loading ? 'Loading Instagram counts...' : 'No Instagram rows logged yet.'}
          </div>
        ) : (
          <div className="instagram-table">
            <div className="instagram-table-row instagram-table-header">
              <span>Timestamp</span>
              <span>User</span>
              <span>Followers</span>
              <span>Following</span>
              <span>Privacy</span>
              <span>Action</span>
            </div>
            {rows.map((row, index) => (
              <div className="instagram-table-row" key={`${row.loggedAt}-${row.username}-${index}`}>
                <span>{row.loggedAt}</span>
                <span>@{row.username}</span>
                <span>{row.followers || '-'}</span>
                <span>{row.following || '-'}</span>
                <span>{row.privacy || 'unknown'}</span>
                <span>
                  <button
                    className="online-app-link-button danger"
                    type="button"
                    disabled={loading}
                    onClick={() => onRemoveTargetChange({
                      index: row.index,
                      loggedAt: row.loggedAt,
                      username: row.username,
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
    </div>

    {removeTarget && (
      <div className="online-modal-backdrop" role="presentation">
        <div className="online-modal" role="dialog" aria-modal="true" aria-labelledby="instagram-remove-title">
          <div id="instagram-remove-title" className="online-modal-title">Remove log entry?</div>
          <div className="online-modal-body">
            Entry {removeTarget.index}: {removeTarget.loggedAt} @{removeTarget.username}
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

export default InstagramAppWindow
