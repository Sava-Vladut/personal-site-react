import type { PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import type { InstagramLogRow, WindowPosition } from '../types/apps'

type InstagramAppWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  users: string[]
  visibleUsers: string[]
  rows: InstagramLogRow[]
  filter: string
  message: string
  loading: boolean
  lastChecked?: string
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onFilterChange: (value: string) => void
  onRefresh: () => void
}

const InstagramAppWindow = ({
  windowRef,
  maximized,
  position,
  users,
  visibleUsers,
  rows,
  filter,
  message,
  loading,
  lastChecked,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onFilterChange,
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
        <input
          className="instagram-filter-input"
          type="search"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="filter user"
          autoComplete="off"
          spellCheck="false"
        />
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
          <span>Add usernames to instagram-users.txt.</span>
        ) : visibleUsers.length === 0 ? (
          <span>No users match filter.</span>
        ) : (
          visibleUsers.map((user) => <span key={user}>@{user}</span>)
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
            </div>
            {rows.map((row, index) => (
              <div className="instagram-table-row" key={`${row.loggedAt}-${row.username}-${index}`}>
                <span>{row.loggedAt}</span>
                <span>@{row.username}</span>
                <span>{row.followers || '-'}</span>
                <span>{row.following || '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)

export default InstagramAppWindow
