type TerminalHeaderProps = {
  title: string
  icon?: string
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
}

const TerminalHeader = ({
  title,
  icon = '_>',
  onMinimize,
  onToggleMaximize,
  onClose,
}: TerminalHeaderProps) => {
  return (
    <div className="terminal-header">
      <div className="terminal-title">
        <span className="terminal-icon">{icon}</span>
        {title}
      </div>
      <div className="window-controls">
        <button className="control-btn minimize" aria-label="Minimize" onClick={onMinimize}>
          <svg width="10" height="1" viewBox="0 0 10 1"><path d="M0 0h10v1H0z" fill="currentColor"/></svg>
        </button>
        <button className="control-btn maximize" aria-label="Maximize" onClick={onToggleMaximize}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1v8h8V1H1zm9 9H0V0h10v10z" fill="currentColor"/></svg>
        </button>
        <button className="control-btn close" aria-label="Close" onClick={onClose}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
      </div>
    </div>
  )
}

export default TerminalHeader
