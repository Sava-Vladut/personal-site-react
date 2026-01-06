import { useEffect, useRef, useState } from 'react'
import './styles/terminal.css'
import './styles/theme.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'
import AsciiWave from './components/AsciiWave'
import LinkifiedText from './components/LinkifiedText'
import TerminalBody from './components/TerminalBody'
import TerminalHeader from './components/TerminalHeader'
import type { HistoryItem } from './types/terminal'

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(true)
  const [theme, setTheme] = useState('matrix')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'banner',
      type: 'output',
      content: <AsciiWave text={asciiArt} />
    },
    {
      id: 'init',
      type: 'output',
      content: <span>Type <span style={{color: '#ce9178'}}>'help'</span> to view available commands.</span>
    }
  ])

  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-focus input on click anywhere
  const focusInput = () => {
    inputRef.current?.focus()
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const themes = ['matrix', 'amber', 'solar']
  const commands = ['help', 'user', 'links', 'theme', 'clear']

  const handleCommand = () => {
    if (!input.trim()) return

    const cmd = input.trim()
    const parts = cmd.split(/\s+/)
    const lowerCmd = parts[0]?.toLowerCase() ?? ''
    setCommandHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)

    // Add command to history
    const newHistory = [...history, {
      id: crypto.randomUUID(),
      type: 'command',
      content: cmd
    } as HistoryItem]

    // Process command
    switch (lowerCmd) {
      case 'help':
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: (
            <div>
              <div style={{color: '#4ec9b0', marginBottom: '8px'}}>Available Commands:</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>user</span> &nbsp;&nbsp;Display user profile info</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>links</span> &nbsp;List all project links</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>theme</span> &nbsp;Switch color theme</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>clear</span> &nbsp;Clear the terminal screen</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>help</span>  &nbsp;&nbsp;Show this help message</div>
            </div>
          )
        })
        break

      case 'user':
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: (
            <div>
              NAME: Vlad<br/>
              ROLE: Full Stack Developer<br/>
              STATUS: Online<br/>
              MISSION: Building digital experiences.
            </div>
          )
        })
        break

      case 'links':
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: (
            <div style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              <LinkifiedText text={linksText} />
            </div>
          ),
        })
        break

      case 'theme': {
        if (parts.length === 1) {
          newHistory.push({
            id: crypto.randomUUID(),
            type: 'output',
            content: (
              <div>
                <div>Current theme: <span style={{color: '#ce9178'}}>{theme}</span></div>
                <div>Available: {themes.join(', ')}</div>
                <div>Usage: <span style={{color: '#ce9178'}}>theme</span> &lt;name&gt;</div>
              </div>
            ),
          })
          break
        }
        const nextTheme = parts[1].toLowerCase()
        if (!themes.includes(nextTheme)) {
          newHistory.push({
            id: crypto.randomUUID(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Unknown theme: {nextTheme}</span>,
          })
          break
        }
        setTheme(nextTheme)
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: <span style={{color: '#4ec9b0'}}>Theme switched to {nextTheme}</span>,
        })
        break
      }

      case 'clear':
        setHistory([])
        setInput('')
        return

      default:
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: <span style={{color: '#e81123'}}>Command not found: {cmd}</span>
        })
    }

    setHistory(newHistory)
    setInput('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCommand()
      return
    }

    if (event.key === 'ArrowUp') {
      if (commandHistory.length === 0) return
      event.preventDefault()
      const nextIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex])
      return
    }

    if (event.key === 'ArrowDown') {
      if (commandHistory.length === 0) return
      if (historyIndex === -1) return
      event.preventDefault()
      const nextIndex = historyIndex + 1
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1)
        setInput('')
        return
      }
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex])
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const raw = input.trim()
      if (!raw) return
      const matches = commands.filter((cmd) => cmd.startsWith(raw.toLowerCase()))
      if (matches.length === 1) {
        setInput(matches[0])
        return
      }
      if (matches.length > 1) {
        setHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'output',
            content: <span>{matches.join('  ')}</span>
          }
        ])
      }
    }
  }

  return (
    <div className={`terminal-window theme-${theme} ${maximized ? 'maximized' : ''}`} onClick={focusInput}>
      <TerminalHeader
        title="grim@portofolio: ~"
        onToggleMaximize={() => setMaximized(!maximized)}
      />
      <TerminalBody
        history={history}
        input={input}
        inputRef={inputRef}
        bottomRef={bottomRef}
        onInputChange={(value) => {
          setInput(value)
          setHistoryIndex(-1)
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
export default App
