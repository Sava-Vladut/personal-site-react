import { useEffect, useRef, useState } from 'react'
import './styles/terminal.css'
import './styles/theme.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'
import userText from '../user.txt?raw'
import commandsText from '../commands.txt?raw'
import AsciiWave from './components/AsciiWave'
import LinkifiedText from './components/LinkifiedText'
import TerminalBody from './components/TerminalBody'
import TerminalHeader from './components/TerminalHeader'
import { DEFAULT_COMMANDS, THEMES } from './config/terminal'
import { downloadList, getProjectFolders } from './data/downloads'
import { parseCommandAliases } from './lib/commandAliases'
import { createId } from './lib/ids'
import { getAdjustedOnlineTimestamp } from './lib/onlineLog'
import type { HistoryItem } from './types/terminal'

const onlineLogTokenKey = 'personal-site-online-log-token'

type OnlineLogResponse = {
  ok: boolean
  error?: string
}

type OnlineTableResponse = {
  ok: boolean
  rows?: string[]
  error?: string
}

type OnlineRemoveResponse = {
  ok: boolean
  removed?: string
  error?: string
}

const getOnlineLogToken = () => {
  const cachedToken = sessionStorage.getItem(onlineLogTokenKey)
  if (cachedToken) return cachedToken

  const token = window.prompt('Online log token')
  if (!token) return null

  sessionStorage.setItem(onlineLogTokenKey, token)
  return token
}

const getOnlineMutationHeaders = () => {
  const token = getOnlineLogToken()
  if (!token) return null

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

const forgetOnlineLogToken = () => {
  sessionStorage.removeItem(onlineLogTokenKey)
}

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(false)
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
    const selection = window.getSelection?.()
    if (selection && selection.toString()) return
    inputRef.current?.focus()
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const { aliasMap, commands } = parseCommandAliases(commandsText, DEFAULT_COMMANDS)
  const projectFolders = getProjectFolders()

  const handleCommand = async () => {
    const cmd = input.trim()
    const parts = cmd.split(/\s+/)
    const rawCmd = parts[0]?.toLowerCase() ?? ''
    const lowerCmd = aliasMap.get(rawCmd) ?? rawCmd
    const appendOutput = (content: HistoryItem['content']) => {
      setHistory((prev) => [...prev, {
        id: createId(),
        type: 'output',
        content,
      }])
    }

    setHistory((prev) => [...prev, {
      id: createId(),
      type: 'command',
      content: cmd,
    }])
    setInput('')

    if (!cmd) {
      return
    }

    setCommandHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)

    // Process command
    switch (lowerCmd) {
      case 'help':
        appendOutput(
          <div>
            <div style={{color: '#4ec9b0', marginBottom: '8px'}}>Available Commands:</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>user</span> &nbsp;&nbsp;Display user profile info</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>projects</span> &nbsp;&lt;folder&gt; List projects in a folder</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>links</span> &nbsp;List all project links</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>theme</span> &nbsp;Switch color theme</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>online</span> &nbsp;&lt;duration&gt; Log adjusted online time</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>table</span> &nbsp;Show or remove online log entries</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>clear</span> &nbsp;Clear the terminal screen</div>
            <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>help</span>  &nbsp;&nbsp;Show this help message</div>
          </div>
        )
        break

      case 'user':
        appendOutput(
          <div style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {userText}
          </div>
        )
        break

      case 'projects': {
        const folderFilter = parts[1]?.toLowerCase()
        if (!folderFilter) {
          appendOutput(
            <div>
              <div>Usage: <span style={{color: '#ce9178'}}>projects</span> &lt;folder&gt;</div>
              <div>Available folders: {projectFolders.join(', ')}</div>
            </div>
          )
          break
        }
        const filteredDownloads = downloadList.filter(
          (archive) => archive.folder.toLowerCase() === folderFilter
        )
        appendOutput(
          <div className="project-list">
            {downloadList.length === 0 ? (
              <div>No project downloads found.</div>
            ) : filteredDownloads.length === 0 ? (
              <div>
                <div>No projects found in folder: {folderFilter}</div>
                <div>Available folders: {projectFolders.join(', ')}</div>
              </div>
            ) : (
              filteredDownloads.map((archive) => (
                <div className="project-item" key={archive.label}>
                  <span>{archive.label} </span>
                  <a className="download-link" href={archive.url} target="_blank" rel="noreferrer">
                    [DOWNLOAD]
                  </a>
                </div>
              ))
            )}
          </div>
        )
        break
      }

      case 'links':
        appendOutput(
          <div style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            <LinkifiedText text={linksText} />
          </div>
        )
        break

      case 'theme': {
        if (parts.length === 1) {
          appendOutput(
            <div>
              <div>Current theme: <span style={{color: '#ce9178'}}>{theme}</span></div>
              <div>Available: {THEMES.join(', ')}</div>
              <div>Usage: <span style={{color: '#ce9178'}}>theme</span> &lt;name&gt;</div>
            </div>
          )
          break
        }
        const nextTheme = parts[1].toLowerCase()
        if (!THEMES.includes(nextTheme)) {
          appendOutput(<span style={{color: '#e81123'}}>Unknown theme: {nextTheme}</span>)
          break
        }
        setTheme(nextTheme)
        appendOutput(<span style={{color: '#4ec9b0'}}>Theme switched to {nextTheme}</span>)
        break
      }

      case 'online': {
        if (parts.length > 2) {
          appendOutput(<span style={{color: '#e81123'}}>Usage: online &lt;duration&gt;</span>)
          break
        }

        const result = getAdjustedOnlineTimestamp(parts[1])
        if (!result.ok) {
          appendOutput(<span style={{color: '#e81123'}}>{result.error}</span>)
          break
        }

        const headers = getOnlineMutationHeaders()
        if (!headers) {
          appendOutput(<span style={{color: '#e81123'}}>Online log token is required.</span>)
          break
        }

        try {
          const response = await fetch('/api/online', {
            method: 'POST',
            headers,
            body: JSON.stringify({ timestamp: result.timestamp }),
          })
          const data = await response.json() as OnlineLogResponse

          if (response.status === 401) {
            forgetOnlineLogToken()
          }

          if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Unable to write online log.')
          }

          appendOutput(<span style={{color: '#4ec9b0'}}>Online time logged: {result.timestamp}</span>)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to write online log.'
          appendOutput(<span style={{color: '#e81123'}}>Online log failed: {message}</span>)
        }
        break
      }

      case 'table': {
        const tableAction = parts[1]?.toLowerCase()

        if (parts.length === 1 || tableAction === 'index') {
          if (parts.length > 2) {
            appendOutput(<span style={{color: '#e81123'}}>Usage: table index</span>)
            break
          }

          try {
            const response = await fetch('/api/online')
            const data = await response.json() as OnlineTableResponse

            if (!response.ok || !data.ok) {
              throw new Error(data.error || 'Unable to read online log.')
            }

            const rows = data.rows ?? []
            appendOutput(rows.length === 0 ? (
              <div>No online log entries found.</div>
            ) : (
              <div className="online-table">
                <div className="online-table-row online-table-header">
                  <span>#</span>
                  <span>Timestamp</span>
                </div>
                {rows.map((timestamp, index) => (
                  <div className="online-table-row" key={`${timestamp}-${index}`}>
                    <span>{index + 1}</span>
                    <span>{timestamp}</span>
                  </div>
                ))}
              </div>
            ))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to read online log.'
            appendOutput(<span style={{color: '#e81123'}}>Table failed: {message}</span>)
          }
          break
        }

        if (tableAction === 'remove') {
          if (parts.length !== 3) {
            appendOutput(<span style={{color: '#e81123'}}>Usage: table remove &lt;index&gt;</span>)
            break
          }

          const index = Number(parts[2])
          if (!Number.isSafeInteger(index) || index < 1) {
            appendOutput(<span style={{color: '#e81123'}}>Index must be a positive number.</span>)
            break
          }

          const headers = getOnlineMutationHeaders()
          if (!headers) {
            appendOutput(<span style={{color: '#e81123'}}>Online log token is required.</span>)
            break
          }

          try {
            const response = await fetch('/api/online', {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ index }),
            })
            const data = await response.json() as OnlineRemoveResponse

            if (response.status === 401) {
              forgetOnlineLogToken()
            }

            if (!response.ok || !data.ok) {
              throw new Error(data.error || 'Unable to remove online log entry.')
            }

            appendOutput(<span style={{color: '#4ec9b0'}}>Removed entry {index}: {data.removed}</span>)
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to remove online log entry.'
            appendOutput(<span style={{color: '#e81123'}}>Remove failed: {message}</span>)
          }
          break
        }

        if (parts.length > 1) {
          appendOutput(<span style={{color: '#e81123'}}>Usage: table index | table remove &lt;index&gt;</span>)
          break
        }
        break
      }

      case 'clear':
        setHistory([])
        setInput('')
        return

      default:
        appendOutput(<span style={{color: '#e81123'}}>Command not found: {cmd}</span>)
    }
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
      const rawInput = input
      const trimmed = rawInput.trim()
      if (!trimmed) return
      const parts = trimmed.split(/\s+/)
      const commandToken = parts[0] ?? ''
      const canonicalCommand = aliasMap.get(commandToken.toLowerCase()) ?? commandToken.toLowerCase()
      const hasTrailingSpace = /\s$/.test(rawInput)

      if (canonicalCommand === 'projects') {
        const arg = hasTrailingSpace ? '' : (parts[1] ?? '')
        const matches = projectFolders
          .filter((folder) => folder.toLowerCase().startsWith(arg.toLowerCase()))
          .sort((a, b) => a.localeCompare(b))
        if (matches.length > 0) {
          setInput(`${commandToken} ${matches[0]}`)
        }
        return
      }

      if (canonicalCommand === 'theme') {
        const arg = hasTrailingSpace ? '' : (parts[1] ?? '')
        const matches = THEMES
          .filter((themeOption) => themeOption.toLowerCase().startsWith(arg.toLowerCase()))
          .sort((a, b) => a.localeCompare(b))
        if (matches.length > 0) {
          setInput(`${commandToken} ${matches[0]}`)
        }
        return
      }

      const matches = commands
        .filter((cmd) => cmd.startsWith(trimmed.toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
      if (matches.length > 0) {
        setInput(matches[0])
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
