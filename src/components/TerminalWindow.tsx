import type { KeyboardEvent, PointerEventHandler, RefObject } from 'react'
import TerminalBody from './TerminalBody'
import TerminalHeader from './TerminalHeader'
import type { WindowPosition } from '../types/apps'
import type { HistoryItem } from '../types/terminal'

type TerminalWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  bottomRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  theme: string
  history: HistoryItem[]
  input: string
  onClick: () => void
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onInputChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

const TerminalWindow = ({
  windowRef,
  inputRef,
  bottomRef,
  maximized,
  position,
  theme,
  history,
  input,
  onClick,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onInputChange,
  onKeyDown,
}: TerminalWindowProps) => (
  <div
    ref={windowRef}
    className={`terminal-window theme-${theme} ${maximized ? 'maximized' : ''} ${position ? 'drag-positioned' : ''}`}
    style={position && !maximized ? { left: position.x, top: position.y } : undefined}
    onClick={onClick}
  >
    <TerminalHeader
      title="grim@portofolio: ~"
      onDragStart={onDragStart}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    />
    <TerminalBody
      history={history}
      input={input}
      inputRef={inputRef}
      bottomRef={bottomRef}
      onInputChange={onInputChange}
      onKeyDown={onKeyDown}
    />
  </div>
)

export default TerminalWindow
