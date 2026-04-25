import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
import { DEFAULT_COMMANDS, HIDDEN_COMMANDS, THEMES } from './config/terminal'
import { downloadList, getProjectFolders } from './data/downloads'
import { parseCommandAliases } from './lib/commandAliases'
import { createId } from './lib/ids'
import { getAdjustedOnlineTimestamp } from './lib/onlineLog'
import type { HistoryItem } from './types/terminal'

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

const ONLINE_TABLE_PAGE_SIZE = 10

const getTimePassed = (timestamp: string) => {
  const normalizedTimestamp = timestamp.replace(' ', 'T')
  const timestampMs = new Date(normalizedTimestamp).getTime()

  if (Number.isNaN(timestampMs)) {
    return 'Unknown'
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000))
  const days = Math.floor(elapsedSeconds / 86_400)
  const hours = Math.floor((elapsedSeconds % 86_400) / 3_600)
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return 'Just now'
}

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [onlineMaximized, setOnlineMaximized] = useState(false)
  const [onlineRows, setOnlineRows] = useState<string[]>([])
  const [onlinePage, setOnlinePage] = useState(1)
  const [onlineDuration, setOnlineDuration] = useState('')
  const [onlineMessage, setOnlineMessage] = useState('')
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineRemoveTarget, setOnlineRemoveTarget] = useState<{
    index: number
    timestamp: string
  } | null>(null)
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

  const openTerminal = () => {
    setTerminalOpen(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const closeTerminal = () => {
    setTerminalOpen(false)
    setMaximized(false)
  }

  const refreshOnlineRows = useCallback(async () => {
    const response = await fetch('/api/online')
    const data = await response.json() as OnlineTableResponse

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to read online log.')
    }

    setOnlineRows(data.rows ?? [])
  }, [])

  const openOnlineApp = () => {
    setOnlineOpen(true)
  }

  const closeOnlineApp = () => {
    setOnlineOpen(false)
    setOnlineMaximized(false)
  }

  const handleOnlineRefresh = useCallback(async () => {
    setOnlineLoading(true)
    setOnlineMessage('')

    try {
      await refreshOnlineRows()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read online log.'
      setOnlineMessage(`Refresh failed: ${message}`)
    } finally {
      setOnlineLoading(false)
    }
  }, [refreshOnlineRows])

  const handleOnlineAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOnlineLoading(true)
    setOnlineMessage('')

    const rawDuration = onlineDuration.trim()
    const durationParts = rawDuration.split(/\s+/)
    if (durationParts[0]?.toLowerCase() === 'online' && durationParts.length > 2) {
      setOnlineMessage('Usage: online <duration>')
      setOnlineLoading(false)
      return
    }
    const duration = durationParts[0]?.toLowerCase() === 'online'
      ? durationParts[1]
      : rawDuration || undefined
    const result = getAdjustedOnlineTimestamp(duration)
    if (!result.ok) {
      setOnlineMessage(result.error)
      setOnlineLoading(false)
      return
    }

    try {
      const response = await fetch('/api/online', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timestamp: result.timestamp }),
      })
      const data = await response.json() as OnlineLogResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to write online log.')
      }

      setOnlineDuration('')
      setOnlineMessage(`Added ${result.timestamp}`)
      await refreshOnlineRows()
      setOnlinePage(1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to write online log.'
      setOnlineMessage(`Add failed: ${message}`)
    } finally {
      setOnlineLoading(false)
    }
  }

  const handleOnlineRemove = async () => {
    if (!onlineRemoveTarget) return

    setOnlineLoading(true)
    setOnlineMessage('')

    try {
      const response = await fetch('/api/online', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ index: onlineRemoveTarget.index }),
      })
      const data = await response.json() as OnlineRemoveResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to remove online log entry.')
      }

      setOnlineMessage(`Removed entry ${onlineRemoveTarget.index}: ${data.removed}`)
      setOnlineRemoveTarget(null)
      await refreshOnlineRows()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove online log entry.'
      setOnlineMessage(`Remove failed: ${message}`)
    } finally {
      setOnlineLoading(false)
    }
  }

  // Auto-focus input on click anywhere
  const focusInput = () => {
    if (!terminalOpen) return
    const selection = window.getSelection?.()
    if (selection && selection.toString()) return
    inputRef.current?.focus()
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    if (!onlineOpen) return

    handleOnlineRefresh()
  }, [handleOnlineRefresh, onlineOpen])

  useEffect(() => {
    setOnlinePage((currentPage) => Math.min(currentPage, Math.max(1, Math.ceil(onlineRows.length / ONLINE_TABLE_PAGE_SIZE))))
  }, [onlineRows.length])

  const onlinePageCount = Math.max(1, Math.ceil(onlineRows.length / ONLINE_TABLE_PAGE_SIZE))
  const normalizedOnlinePage = Math.min(onlinePage, onlinePageCount)
  const onlinePageStart = (normalizedOnlinePage - 1) * ONLINE_TABLE_PAGE_SIZE
  const onlinePageRows = onlineRows.slice(onlinePageStart, onlinePageStart + ONLINE_TABLE_PAGE_SIZE)

  const { aliasMap, commands } = parseCommandAliases(commandsText, DEFAULT_COMMANDS)
  const projectFolders = getProjectFolders()

  const handleCommand = async () => {
    const cmd = input.trim()
    const parts = cmd.split(/\s+/)
    const rawCmd = parts[0]?.toLowerCase() ?? ''
    const lowerCmd = aliasMap.get(rawCmd) ?? rawCmd

    // Add command to history
    const newHistory = [...history, {
      id: createId(),
      type: 'command',
      content: cmd
    } as HistoryItem]

    if (!cmd) {
      setHistory(newHistory)
      setInput('')
      return
    }

    setCommandHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)

    // Process command
    switch (lowerCmd) {
      case 'help':
        newHistory.push({
          id: createId(),
          type: 'output',
          content: (
            <div>
              <div style={{color: '#4ec9b0', marginBottom: '8px'}}>Available Commands:</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>user</span> &nbsp;&nbsp;Display user profile info</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>projects</span> &nbsp;&lt;folder&gt; List projects in a folder</div>
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
          id: createId(),
          type: 'output',
          content: (
            <div style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {userText}
            </div>
          )
        })
        break

      case 'projects': {
        const folderFilter = parts[1]?.toLowerCase()
        if (!folderFilter) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: (
              <div>
                <div>Usage: <span style={{color: '#ce9178'}}>projects</span> &lt;folder&gt;</div>
                <div>Available folders: {projectFolders.join(', ')}</div>
              </div>
            )
          })
          break
        }
        const filteredDownloads = downloadList.filter(
          (archive) => archive.folder.toLowerCase() === folderFilter
        )
        newHistory.push({
          id: createId(),
          type: 'output',
          content: (
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
        })
        break
      }

      case 'links':
        newHistory.push({
          id: createId(),
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
            id: createId(),
            type: 'output',
            content: (
              <div>
                <div>Current theme: <span style={{color: '#ce9178'}}>{theme}</span></div>
                <div>Available: {THEMES.join(', ')}</div>
                <div>Usage: <span style={{color: '#ce9178'}}>theme</span> &lt;name&gt;</div>
              </div>
            ),
          })
          break
        }
        const nextTheme = parts[1].toLowerCase()
        if (!THEMES.includes(nextTheme)) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Unknown theme: {nextTheme}</span>,
          })
          break
        }
        setTheme(nextTheme)
        newHistory.push({
          id: createId(),
          type: 'output',
          content: <span style={{color: '#4ec9b0'}}>Theme switched to {nextTheme}</span>,
        })
        break
      }

      case 'online': {
        if (parts.length > 2) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Usage: online &lt;duration&gt;</span>,
          })
          break
        }

        const result = getAdjustedOnlineTimestamp(parts[1])
        if (!result.ok) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>{result.error}</span>,
          })
          break
        }

        try {
          const response = await fetch('/api/online', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ timestamp: result.timestamp }),
          })
          const data = await response.json() as OnlineLogResponse

          if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Unable to write online log.')
          }

          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#4ec9b0'}}>Online time logged: {result.timestamp}</span>,
          })
          if (onlineOpen) {
            await refreshOnlineRows()
            setOnlinePage(1)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to write online log.'
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Online log failed: {message}</span>,
          })
        }
        break
      }

      case 'table': {
        const tableAction = parts[1]?.toLowerCase()
        const isPageShortcut = Boolean(tableAction && /^\d+$/.test(tableAction))

        if (parts.length === 1 || tableAction === 'index' || isPageShortcut) {
          if ((tableAction === 'index' && parts.length > 3) || (isPageShortcut && parts.length > 2)) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Usage: table index [page]</span>,
            })
            break
          }

          const pageToken = tableAction === 'index' ? parts[2] : parts[1]
          const page = pageToken ? Number(pageToken) : 1
          if (!Number.isSafeInteger(page) || page < 1) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Page must be a positive number.</span>,
            })
            break
          }

          try {
            const response = await fetch('/api/online')
            const data = await response.json() as OnlineTableResponse

            if (!response.ok || !data.ok) {
              throw new Error(data.error || 'Unable to read online log.')
            }

            const rows = data.rows ?? []
            const pageCount = Math.max(1, Math.ceil(rows.length / ONLINE_TABLE_PAGE_SIZE))
            const normalizedPage = Math.min(page, pageCount)
            const pageStart = (normalizedPage - 1) * ONLINE_TABLE_PAGE_SIZE
            const pageRows = rows.slice(pageStart, pageStart + ONLINE_TABLE_PAGE_SIZE)
            newHistory.push({
              id: createId(),
              type: 'output',
              content: rows.length === 0 ? (
                <div>No online log entries found.</div>
              ) : (
                <div className="online-table">
                  <div className="online-table-row online-table-header">
                    <span>#</span>
                    <span>Timestamp</span>
                    <span>Time passed</span>
                  </div>
                  {pageRows.map((timestamp, index) => (
                    <div className="online-table-row" key={`${timestamp}-${index}`}>
                      <span>{pageStart + index + 1}</span>
                      <span>{timestamp}</span>
                      <span>{getTimePassed(timestamp)}</span>
                    </div>
                  ))}
                  <div className="online-table-pagination">
                    Page {normalizedPage} of {pageCount} ({rows.length} entries)
                    {page > pageCount ? `, showing last page` : ''}
                  </div>
                </div>
              ),
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to read online log.'
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Table failed: {message}</span>,
            })
          }
          break
        }

        if (tableAction === 'remove') {
          if (parts.length !== 3) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Usage: table remove &lt;index&gt;</span>,
            })
            break
          }

          const index = Number(parts[2])
          if (!Number.isSafeInteger(index) || index < 1) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Index must be a positive number.</span>,
            })
            break
          }

          try {
            const response = await fetch('/api/online', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ index }),
            })
            const data = await response.json() as OnlineRemoveResponse

            if (!response.ok || !data.ok) {
              throw new Error(data.error || 'Unable to remove online log entry.')
            }

            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#4ec9b0'}}>Removed entry {index}: {data.removed}</span>,
            })
            if (onlineOpen) {
              await refreshOnlineRows()
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to remove online log entry.'
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Remove failed: {message}</span>,
            })
          }
          break
        }

        if (parts.length > 1) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Usage: table [page] | table index [page] | table remove &lt;index&gt;</span>,
          })
          break
        }
        break
      }

      case 'clear':
        setHistory([])
        setInput('')
        return

      default:
        newHistory.push({
          id: createId(),
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
        .filter((cmd) => !HIDDEN_COMMANDS.includes(aliasMap.get(cmd) ?? cmd))
        .filter((cmd) => cmd.startsWith(trimmed.toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
      if (matches.length > 0) {
        setInput(matches[0])
      }
    }
  }

  return (
    <div className="desktop-shell">
      <main className="desktop-surface" aria-label="Desktop">
        <button className="desktop-icon" type="button" onDoubleClick={openTerminal} onClick={openTerminal}>
          <span className="desktop-icon-glyph" aria-hidden="true">_&gt;</span>
          <span>Terminal</span>
        </button>

        <button className="desktop-icon" type="button" onDoubleClick={openOnlineApp} onClick={openOnlineApp}>
          <span className="desktop-icon-glyph online-icon-glyph" aria-hidden="true">●</span>
          <span>Online</span>
        </button>

        {terminalOpen && (
          <div className={`terminal-window theme-${theme} ${maximized ? 'maximized' : ''}`} onClick={focusInput}>
            <TerminalHeader
              title="grim@portofolio: ~"
              onMinimize={() => setTerminalOpen(false)}
              onToggleMaximize={() => setMaximized(!maximized)}
              onClose={closeTerminal}
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
        )}

        {onlineOpen && (
          <div className={`app-window online-app-window ${onlineMaximized ? 'maximized' : ''}`}>
            <TerminalHeader
              title="online log"
              icon="●"
              onMinimize={() => setOnlineOpen(false)}
              onToggleMaximize={() => setOnlineMaximized(!onlineMaximized)}
              onClose={closeOnlineApp}
            />

            <div className="online-app-body">
              <form className="online-app-form" onSubmit={handleOnlineAdd}>
                <label className="online-app-label" htmlFor="online-duration">Command</label>
                <input
                  id="online-duration"
                  className="online-app-input"
                  type="text"
                  value={onlineDuration}
                  onChange={(event) => setOnlineDuration(event.target.value)}
                  placeholder="online 15m, 15m, 5h"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button className="online-app-button primary" type="submit" disabled={onlineLoading}>
                  Add
                </button>
                <button className="online-app-button" type="button" onClick={handleOnlineRefresh} disabled={onlineLoading}>
                  Refresh
                </button>
              </form>

              {onlineMessage && (
                <div className="online-app-message">{onlineMessage}</div>
              )}

              <div className="online-app-table-wrap">
                {onlineRows.length === 0 ? (
                  <div className="online-app-empty">
                    {onlineLoading ? 'Loading online log...' : 'No online log entries found.'}
                  </div>
                ) : (
                  <div className="online-table online-app-table">
                    <div className="online-table-row online-table-header">
                      <span>#</span>
                      <span>Timestamp</span>
                      <span>Time passed</span>
                      <span>Action</span>
                    </div>
                    {onlinePageRows.map((timestamp, index) => (
                      <div className="online-table-row" key={`${timestamp}-${onlinePageStart + index}`}>
                        <span>{onlinePageStart + index + 1}</span>
                        <span>{timestamp}</span>
                        <span>{getTimePassed(timestamp)}</span>
                        <span>
                          <button
                            className="online-app-link-button danger"
                            type="button"
                            disabled={onlineLoading}
                            onClick={() => setOnlineRemoveTarget({
                              index: onlinePageStart + index + 1,
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
                  onClick={() => setOnlinePage((page) => Math.max(1, page - 1))}
                  disabled={onlineLoading || normalizedOnlinePage === 1}
                >
                  Prev
                </button>
                <span>Page {normalizedOnlinePage} of {onlinePageCount} ({onlineRows.length})</span>
                <button
                  className="online-app-button"
                  type="button"
                  onClick={() => setOnlinePage((page) => Math.min(onlinePageCount, page + 1))}
                  disabled={onlineLoading || normalizedOnlinePage === onlinePageCount}
                >
                  Next
                </button>
              </div>
            </div>

            {onlineRemoveTarget && (
              <div className="online-modal-backdrop" role="presentation">
                <div className="online-modal" role="dialog" aria-modal="true" aria-labelledby="online-remove-title">
                  <div id="online-remove-title" className="online-modal-title">Remove entry?</div>
                  <div className="online-modal-body">
                    Entry {onlineRemoveTarget.index}: {onlineRemoveTarget.timestamp}
                  </div>
                  <div className="online-modal-actions">
                    <button
                      className="online-app-button"
                      type="button"
                      disabled={onlineLoading}
                      onClick={() => setOnlineRemoveTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="online-app-button danger"
                      type="button"
                      disabled={onlineLoading}
                      onClick={handleOnlineRemove}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="desktop-taskbar">
        <button
          className={`taskbar-app ${terminalOpen ? 'active' : ''}`}
          type="button"
          aria-label="Terminal"
          onClick={openTerminal}
        >
          <span className="taskbar-icon" aria-hidden="true">_&gt;</span>
        </button>
        <button
          className={`taskbar-app online-taskbar-app ${onlineOpen ? 'active' : ''}`}
          type="button"
          aria-label="Online"
          onClick={openOnlineApp}
        >
          <span className="taskbar-icon" aria-hidden="true">●</span>
        </button>
        <div className="taskbar-spacer" />
        <div className="taskbar-clock">grimOS</div>
      </footer>
    </div>
  )
}
export default App
