import type { KeyboardEvent, RefObject } from 'react'
import type { HistoryItem } from '../types/terminal'

type TerminalBodyProps = {
  history: HistoryItem[]
  input: string
  inputRef: RefObject<HTMLInputElement | null>
  bottomRef: RefObject<HTMLDivElement | null>
  onInputChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

const TerminalBody = ({
  history,
  input,
  inputRef,
  bottomRef,
  onInputChange,
  onKeyDown,
}: TerminalBodyProps) => {
  return (
    <div className="terminal-body">
      {history.map((item) => (
        <div key={item.id} className={item.type === 'command' ? 'command-line' : 'output-line'}>
          {item.type === 'command' && <span className="prompt">{'>'}</span>}
          {item.content}
        </div>
      ))}

      <div className="input-line">
        <span className="prompt">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="terminal-input"
          autoFocus
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

export default TerminalBody
