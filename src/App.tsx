import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
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

type InstagramTrackerResponse = {
  ok: boolean
  users?: string[]
  rows?: string[]
  state?: InstagramTrackerState
  csvPath?: string
  usersPath?: string
  error?: string
}

type InstagramTrackerState = Record<string, {
  followers?: number
  following?: number
  lastChecked?: string
  lastChanged?: string
}>

const ONLINE_TABLE_PAGE_SIZE = 10
const WINDOW_EDGE_PADDING = 12
const SYSTEM_APPS_VISIBLE_STORAGE_KEY = 'grimOS.systemAppsVisible'

type WindowPosition = {
  x: number
  y: number
}

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

const parseCsvRow = (row: string) => {
  const values: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    const nextChar = row[index + 1]

    if (char === '"' && quoted && nextChar === '"') {
      value += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      values.push(value)
      value = ''
      continue
    }

    value += char
  }

  values.push(value)
  return values
}

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [terminalPosition, setTerminalPosition] = useState<WindowPosition | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [onlineMaximized, setOnlineMaximized] = useState(false)
  const [onlinePosition, setOnlinePosition] = useState<WindowPosition | null>(null)
  const [instagramOpen, setInstagramOpen] = useState(false)
  const [instagramMaximized, setInstagramMaximized] = useState(false)
  const [instagramPosition, setInstagramPosition] = useState<WindowPosition | null>(null)
  const [instagramUsers, setInstagramUsers] = useState<string[]>([])
  const [instagramRows, setInstagramRows] = useState<string[]>([])
  const [instagramState, setInstagramState] = useState<InstagramTrackerState>({})
  const [instagramFilter, setInstagramFilter] = useState('')
  const [instagramMessage, setInstagramMessage] = useState('')
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [onlineRows, setOnlineRows] = useState<string[]>([])
  const [onlinePage, setOnlinePage] = useState(1)
  const [onlineDuration, setOnlineDuration] = useState('')
  const [onlineMessage, setOnlineMessage] = useState('')
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineRemoveTarget, setOnlineRemoveTarget] = useState<{
    index: number
    timestamp: string
  } | null>(null)
  const [systemAppsVisible, setSystemAppsVisible] = useState(() => (
    window.localStorage.getItem(SYSTEM_APPS_VISIBLE_STORAGE_KEY) === 'true'
  ))
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
  const terminalWindowRef = useRef<HTMLDivElement>(null)
  const onlineWindowRef = useRef<HTMLDivElement>(null)
  const instagramWindowRef = useRef<HTMLDivElement>(null)

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

  const openInstagramApp = () => {
    setInstagramOpen(true)
  }

  const closeInstagramApp = () => {
    setInstagramOpen(false)
    setInstagramMaximized(false)
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

  const refreshInstagramRows = useCallback(async (method: 'GET' | 'POST' = 'GET') => {
    setInstagramLoading(true)
    setInstagramMessage('')

    try {
      const response = await fetch('/api/instagram', { method })
      const data = await response.json() as InstagramTrackerResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to read Instagram tracker.')
      }

      setInstagramUsers(data.users ?? [])
      setInstagramRows(data.rows ?? [])
      setInstagramState(data.state ?? {})
      setInstagramMessage(method === 'POST' ? 'Refresh complete.' : '')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read Instagram tracker.'
      setInstagramMessage(`Instagram tracker failed: ${message}`)
    } finally {
      setInstagramLoading(false)
    }
  }, [])

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

  const startWindowDrag = (
    event: PointerEvent<HTMLDivElement>,
    windowElement: HTMLDivElement | null,
    setPosition: React.Dispatch<React.SetStateAction<WindowPosition | null>>,
    isMaximized: boolean,
  ) => {
    if (isMaximized || !windowElement || event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return

    const rect = windowElement.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - WINDOW_EDGE_PADDING - rect.height
    const dragHandle = event.currentTarget
    let animationFrame = 0
    let currentPosition = {
      x: Math.min(Math.max(rect.left, 0), Math.max(0, maxX)),
      y: Math.min(Math.max(rect.top, 0), Math.max(0, maxY)),
    }

    const applyPosition = () => {
      animationFrame = 0
      windowElement.style.left = `${currentPosition.x}px`
      windowElement.style.top = `${currentPosition.y}px`
    }

    dragHandle.setPointerCapture(event.pointerId)
    setPosition(currentPosition)
    applyPosition()

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextX = moveEvent.clientX - offsetX
      const nextY = moveEvent.clientY - offsetY

      currentPosition = {
        x: Math.min(Math.max(nextX, 0), Math.max(0, maxX)),
        y: Math.min(Math.max(nextY, 0), Math.max(0, maxY)),
      }

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(applyPosition)
      }
    }

    const stopDrag = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        applyPosition()
      }

      setPosition(currentPosition)
      if (dragHandle.hasPointerCapture(event.pointerId)) {
        dragHandle.releasePointerCapture(event.pointerId)
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
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
    if (!instagramOpen) return

    refreshInstagramRows()
  }, [instagramOpen, refreshInstagramRows])

  useEffect(() => {
    setOnlinePage((currentPage) => Math.min(currentPage, Math.max(1, Math.ceil(onlineRows.length / ONLINE_TABLE_PAGE_SIZE))))
  }, [onlineRows.length])

  const onlinePageCount = Math.max(1, Math.ceil(onlineRows.length / ONLINE_TABLE_PAGE_SIZE))
  const normalizedOnlinePage = Math.min(onlinePage, onlinePageCount)
  const onlinePageStart = (normalizedOnlinePage - 1) * ONLINE_TABLE_PAGE_SIZE
  const onlinePageRows = onlineRows.slice(onlinePageStart, onlinePageStart + ONLINE_TABLE_PAGE_SIZE)
  const instagramLogRows = instagramRows
    .map((row) => {
      const [loggedAt = '', username = '', followers = '', following = '', status = '', error = ''] = parseCsvRow(row)
      return { loggedAt, username, followers, following, status, error }
    })
    .filter((row) => row.status !== 'error')
    .filter((row) => row.username.toLowerCase().includes(instagramFilter.trim().toLowerCase()))
    .slice(-30)
    .reverse()
  const visibleInstagramUsers = instagramUsers.filter((user) => (
    user.toLowerCase().includes(instagramFilter.trim().toLowerCase())
  ))
  const instagramLastChecked = instagramUsers
    .map((user) => instagramState[user]?.lastChecked)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

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

      case 'grim':
        setSystemAppsVisible(true)
        window.localStorage.setItem(SYSTEM_APPS_VISIBLE_STORAGE_KEY, 'true')
        newHistory.push({
          id: createId(),
          type: 'output',
          content: <span style={{color: '#4ec9b0'}}>System apps unlocked.</span>,
        })
        break

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

        {systemAppsVisible && (
          <>
            <button className="desktop-icon" type="button" onDoubleClick={openOnlineApp} onClick={openOnlineApp}>
              <span className="desktop-icon-glyph online-icon-glyph" aria-hidden="true">●</span>
              <span>Online</span>
            </button>

            <button className="desktop-icon" type="button" onDoubleClick={openInstagramApp} onClick={openInstagramApp}>
              <span className="desktop-icon-glyph instagram-icon-glyph" aria-hidden="true">IG</span>
              <span>Instagram</span>
            </button>
          </>
        )}

        {terminalOpen && (
          <div
            ref={terminalWindowRef}
            className={`terminal-window theme-${theme} ${maximized ? 'maximized' : ''} ${terminalPosition ? 'drag-positioned' : ''}`}
            style={terminalPosition && !maximized ? { left: terminalPosition.x, top: terminalPosition.y } : undefined}
            onClick={focusInput}
          >
            <TerminalHeader
              title="grim@portofolio: ~"
              onDragStart={(event) => startWindowDrag(event, terminalWindowRef.current, setTerminalPosition, maximized)}
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
          <div
            ref={onlineWindowRef}
            className={`app-window online-app-window ${onlineMaximized ? 'maximized' : ''} ${onlinePosition ? 'drag-positioned' : ''}`}
            style={onlinePosition && !onlineMaximized ? { left: onlinePosition.x, top: onlinePosition.y } : undefined}
          >
            <TerminalHeader
              title="online log"
              icon="●"
              onDragStart={(event) => startWindowDrag(event, onlineWindowRef.current, setOnlinePosition, onlineMaximized)}
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

        {instagramOpen && (
          <div
            ref={instagramWindowRef}
            className={`app-window instagram-app-window ${instagramMaximized ? 'maximized' : ''} ${instagramPosition ? 'drag-positioned' : ''}`}
            style={instagramPosition && !instagramMaximized ? { left: instagramPosition.x, top: instagramPosition.y } : undefined}
          >
            <TerminalHeader
              title="instagram tracker"
              icon="IG"
              onDragStart={(event) => startWindowDrag(event, instagramWindowRef.current, setInstagramPosition, instagramMaximized)}
              onMinimize={() => setInstagramOpen(false)}
              onToggleMaximize={() => setInstagramMaximized(!instagramMaximized)}
              onClose={closeInstagramApp}
            />

            <div className="instagram-app-body">
              <div className="instagram-app-toolbar">
                <div>
                  <div className="instagram-app-title">Followers / Following</div>
                  <div className="instagram-app-subtitle">
                    {instagramUsers.length} watched user{instagramUsers.length === 1 ? '' : 's'} · last checked {instagramLastChecked ?? 'never'}
                  </div>
                </div>
                <input
                  className="instagram-filter-input"
                  type="search"
                  value={instagramFilter}
                  onChange={(event) => setInstagramFilter(event.target.value)}
                  placeholder="filter user"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  className="online-app-button primary"
                  type="button"
                  disabled={instagramLoading}
                  onClick={() => refreshInstagramRows('POST')}
                >
                  Refresh now
                </button>
              </div>

              {instagramMessage && (
                <div className="online-app-message">{instagramMessage}</div>
              )}

              <div className="instagram-user-list">
                {instagramUsers.length === 0 ? (
                  <span>Add usernames to instagram-users.txt.</span>
                ) : visibleInstagramUsers.length === 0 ? (
                  <span>No users match filter.</span>
                ) : (
                  visibleInstagramUsers.map((user) => <span key={user}>@{user}</span>)
                )}
              </div>

              <div className="online-app-table-wrap instagram-table-wrap">
                {instagramLogRows.length === 0 ? (
                  <div className="online-app-empty">
                    {instagramLoading ? 'Loading Instagram counts...' : 'No Instagram rows logged yet.'}
                  </div>
                ) : (
                  <div className="instagram-table">
                    <div className="instagram-table-row instagram-table-header">
                      <span>Timestamp</span>
                      <span>User</span>
                      <span>Followers</span>
                      <span>Following</span>
                    </div>
                    {instagramLogRows.map((row, index) => (
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
        )}
      </main>
    </div>
  )
}
export default App
