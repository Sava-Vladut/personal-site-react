import { useCallback, useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import './styles/terminal.css'
import './styles/theme.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'
import userText from '../user.txt?raw'
import commandsText from '../commands.txt?raw'
import AsciiWave from './components/AsciiWave'
import ClockWeatherAppWindow from './components/ClockWeatherAppWindow'
import InstagramAppWindow from './components/InstagramAppWindow'
import LinkifiedText from './components/LinkifiedText'
import OnlineAppWindow from './components/OnlineAppWindow'
import SettingsAppWindow from './components/SettingsAppWindow'
import TerminalWindow from './components/TerminalWindow'
import { DEFAULT_DESKTOP_THEME } from './config/desktopThemes'
import { DESKTOP_THEME_STORAGE_KEY, DESKTOP_WALLPAPER_STORAGE_KEY, SYSTEM_APPS_VISIBLE_STORAGE_KEY } from './config/storage'
import { DEFAULT_COMMANDS, HIDDEN_COMMANDS, THEMES } from './config/terminal'
import { downloadList, getProjectFolders } from './data/downloads'
import { parseCommandAliases } from './lib/commandAliases'
import { parseCsvRow } from './lib/csv'
import { createId } from './lib/ids'
import { getAdjustedOnlineTimestamp } from './lib/onlineLog'
import { getTimePassed } from './lib/timePassed'
import { startWindowDrag } from './lib/windowDrag'
import type {
  InstagramLogRow,
  InstagramRemoveTarget,
  InstagramTrackerResponse,
  InstagramTrackerState,
  OnlineLogResponse,
  OnlineRemoveResponse,
  OnlineRemoveTarget,
  OnlineTableResponse,
  WindowPosition,
  DesktopTheme,
  WeatherState,
} from './types/apps'
import type { HistoryItem } from './types/terminal'

const ONLINE_TABLE_PAGE_SIZE = 10

const readDesktopTheme = () => {
  const storedTheme = window.localStorage.getItem(DESKTOP_THEME_STORAGE_KEY)
  if (!storedTheme) return DEFAULT_DESKTOP_THEME

  try {
    const parsedTheme = JSON.parse(storedTheme) as Partial<DesktopTheme>
    return {
      ...DEFAULT_DESKTOP_THEME,
      ...parsedTheme,
      id: parsedTheme.id ?? 'custom',
      name: parsedTheme.name ?? 'Custom',
    } as DesktopTheme
  } catch {
    return DEFAULT_DESKTOP_THEME
  }
}

const createDesktopThemeStyle = (desktopTheme: DesktopTheme) => ({
  '--desktop-shell': desktopTheme.shell,
  '--desktop-grid': desktopTheme.grid,
  '--desktop-text': desktopTheme.text,
  '--desktop-icon': desktopTheme.icon,
  '--desktop-icon-border': desktopTheme.iconBorder,
  '--desktop-accent': desktopTheme.accent,
  '--desktop-window': desktopTheme.window,
  '--desktop-window-panel': desktopTheme.windowPanel,
  '--desktop-danger': desktopTheme.danger,
}) as CSSProperties

const readDesktopWallpaper = () => window.localStorage.getItem(DESKTOP_WALLPAPER_STORAGE_KEY) ?? ''

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [terminalPosition, setTerminalPosition] = useState<WindowPosition | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [clockOpen, setClockOpen] = useState(true)
  const [clockMaximized, setClockMaximized] = useState(false)
  const [clockPosition, setClockPosition] = useState<WindowPosition | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [weatherMessage, setWeatherMessage] = useState('')
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [onlineMaximized, setOnlineMaximized] = useState(false)
  const [onlinePosition, setOnlinePosition] = useState<WindowPosition | null>(null)
  const [instagramOpen, setInstagramOpen] = useState(false)
  const [instagramMaximized, setInstagramMaximized] = useState(false)
  const [instagramPosition, setInstagramPosition] = useState<WindowPosition | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMaximized, setSettingsMaximized] = useState(false)
  const [settingsPosition, setSettingsPosition] = useState<WindowPosition | null>(null)
  const [desktopTheme, setDesktopTheme] = useState(readDesktopTheme)
  const [desktopWallpaper, setDesktopWallpaper] = useState(readDesktopWallpaper)
  const [wallpaperMessage, setWallpaperMessage] = useState('')
  const [instagramUsers, setInstagramUsers] = useState<string[]>([])
  const [instagramRows, setInstagramRows] = useState<string[]>([])
  const [instagramState, setInstagramState] = useState<InstagramTrackerState>({})
  const [selectedInstagramUser, setSelectedInstagramUser] = useState('')
  const [instagramMessage, setInstagramMessage] = useState('')
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [instagramRemoveTarget, setInstagramRemoveTarget] = useState<InstagramRemoveTarget | null>(null)
  const [onlineRows, setOnlineRows] = useState<string[]>([])
  const [onlinePage, setOnlinePage] = useState(1)
  const [onlineDuration, setOnlineDuration] = useState('')
  const [onlineMessage, setOnlineMessage] = useState('')
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineRemoveTarget, setOnlineRemoveTarget] = useState<OnlineRemoveTarget | null>(null)
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
      content: <AsciiWave text={asciiArt} />,
    },
    {
      id: 'init',
      type: 'output',
      content: <span>Type <span style={{color: '#ce9178'}}>'help'</span> to view available commands.</span>,
    },
  ])

  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const terminalWindowRef = useRef<HTMLDivElement>(null)
  const clockWindowRef = useRef<HTMLDivElement>(null)
  const onlineWindowRef = useRef<HTMLDivElement>(null)
  const instagramWindowRef = useRef<HTMLDivElement>(null)
  const settingsWindowRef = useRef<HTMLDivElement>(null)

  const openTerminal = () => {
    setTerminalOpen(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const closeTerminal = () => {
    setTerminalOpen(false)
    setMaximized(false)
  }

  const closeClockApp = () => {
    setClockOpen(false)
    setClockMaximized(false)
  }

  const refreshOnlineRows = useCallback(async () => {
    const response = await fetch('/api/online')
    const data = await response.json() as OnlineTableResponse

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to read online log.')
    }

    setOnlineRows(data.rows ?? [])
  }, [])

  const refreshWeather = useCallback(async () => {
    setWeatherLoading(true)
    setWeatherMessage('')

    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=46.357&longitude=25.804&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FBucharest')
      const data = await response.json() as {
        current?: {
          time?: string
          temperature_2m?: number
          apparent_temperature?: number
          weather_code?: number
          wind_speed_10m?: number
        }
        reason?: string
      }

      if (!response.ok || !data.current) {
        throw new Error(data.reason || 'Unable to read weather.')
      }

      setWeather({
        temperatureC: Number(data.current.temperature_2m ?? 0),
        apparentTemperatureC: Number(data.current.apparent_temperature ?? 0),
        windKmh: Number(data.current.wind_speed_10m ?? 0),
        weatherCode: Number(data.current.weather_code ?? 0),
        observedAt: data.current.time?.replace('T', ' ') ?? '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read weather.'
      setWeatherMessage(`Weather unavailable: ${message}`)
    } finally {
      setWeatherLoading(false)
    }
  }, [])

  const closeOnlineApp = () => {
    setOnlineOpen(false)
    setOnlineMaximized(false)
  }

  const closeInstagramApp = () => {
    setInstagramOpen(false)
    setInstagramMaximized(false)
  }

  const closeSettingsApp = () => {
    setSettingsOpen(false)
    setSettingsMaximized(false)
  }

  const handleDesktopThemeChange = (nextTheme: DesktopTheme) => {
    setDesktopTheme(nextTheme)
    window.localStorage.setItem(DESKTOP_THEME_STORAGE_KEY, JSON.stringify(nextTheme))
  }

  const handleDesktopThemeValueChange = (key: keyof DesktopTheme, value: string) => {
    setDesktopTheme((currentTheme) => {
      const nextTheme = {
        ...currentTheme,
        id: 'custom',
        name: 'Custom',
        [key]: value,
      }
      window.localStorage.setItem(DESKTOP_THEME_STORAGE_KEY, JSON.stringify(nextTheme))
      return nextTheme
    })
  }

  const handleWallpaperUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setWallpaperMessage('Choose an image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        setWallpaperMessage('Wallpaper upload failed.')
        return
      }

      try {
        window.localStorage.setItem(DESKTOP_WALLPAPER_STORAGE_KEY, result)
        setDesktopWallpaper(result)
        setWallpaperMessage(`${file.name} saved.`)
      } catch {
        setWallpaperMessage('That image is too large for browser storage.')
      }
    }
    reader.onerror = () => setWallpaperMessage('Wallpaper upload failed.')
    reader.readAsDataURL(file)
  }

  const handleWallpaperClear = () => {
    window.localStorage.removeItem(DESKTOP_WALLPAPER_STORAGE_KEY)
    setDesktopWallpaper('')
    setWallpaperMessage('Wallpaper cleared.')
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

  const handleInstagramRemove = async () => {
    if (!instagramRemoveTarget) return

    setInstagramLoading(true)
    setInstagramMessage('')

    try {
      const response = await fetch('/api/instagram', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ index: instagramRemoveTarget.index }),
      })
      const data = await response.json() as InstagramTrackerResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to remove Instagram log entry.')
      }

      setInstagramUsers(data.users ?? [])
      setInstagramRows(data.rows ?? [])
      setInstagramState(data.state ?? {})
      setInstagramMessage(`Removed entry ${instagramRemoveTarget.index}: ${data.removed ?? instagramRemoveTarget.loggedAt}`)
      setInstagramRemoveTarget(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove Instagram log entry.'
      setInstagramMessage(`Remove failed: ${message}`)
    } finally {
      setInstagramLoading(false)
    }
  }

  const focusInput = () => {
    if (!terminalOpen) return
    const selection = window.getSelection?.()
    if (selection && selection.toString()) return
    inputRef.current?.focus()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!clockOpen) return

    void refreshWeather()
  }, [clockOpen, refreshWeather])

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
  const instagramLogRows: InstagramLogRow[] = instagramRows
    .map((row, index) => {
      const values = parseCsvRow(row)
      const [loggedAt = '', username = '', followers = '', following = ''] = values
      const hasPrivacyColumn = values.length >= 7
      const privacy = hasPrivacyColumn ? values[4] ?? '' : ''
      const status = hasPrivacyColumn ? values[5] ?? '' : values[4] ?? ''
      const error = hasPrivacyColumn ? values[6] ?? '' : values[5] ?? ''
      const statePrivacy = instagramState[username]?.isPrivate
      return {
        index: index + 1,
        loggedAt,
        username,
        followers,
        following,
        privacy: privacy || (typeof statePrivacy === 'boolean' ? (statePrivacy ? 'private' : 'public') : ''),
        status,
        error,
      }
    })
    .filter((row) => row.status !== 'error')
    .filter((row) => !selectedInstagramUser || row.username.toLowerCase() === selectedInstagramUser.toLowerCase())
    .slice(-30)
    .reverse()
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

    const newHistory = [...history, {
      id: createId(),
      type: 'command',
      content: cmd,
    } as HistoryItem]

    if (!cmd) {
      setHistory(newHistory)
      setInput('')
      return
    }

    setCommandHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)

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
          ),
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
          ),
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
            ),
          })
          break
        }
        const filteredDownloads = downloadList.filter(
          (archive) => archive.folder.toLowerCase() === folderFilter,
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
          ),
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
          content: <span style={{color: '#e81123'}}>Command not found: {cmd}</span>,
        })
    }

    setHistory(newHistory)
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
    <div className="desktop-shell" style={createDesktopThemeStyle(desktopTheme)}>
      <main
        className={`desktop-surface ${desktopWallpaper ? 'has-wallpaper' : ''}`}
        style={desktopWallpaper ? { backgroundImage: `url(${desktopWallpaper})` } : undefined}
        aria-label="Desktop"
      >
        <button className="desktop-icon" type="button" onDoubleClick={openTerminal} onClick={openTerminal}>
          <span className="desktop-icon-glyph" aria-hidden="true">_&gt;</span>
          <span>Terminal</span>
        </button>

        <button className="desktop-icon" type="button" onDoubleClick={() => setClockOpen(true)} onClick={() => setClockOpen(true)}>
          <span className="desktop-icon-glyph clock-icon-glyph" aria-hidden="true">N</span>
          <span>Now</span>
        </button>

        {systemAppsVisible && (
          <>
            <button className="desktop-icon" type="button" onDoubleClick={() => setOnlineOpen(true)} onClick={() => setOnlineOpen(true)}>
              <span className="desktop-icon-glyph online-icon-glyph" aria-hidden="true">●</span>
              <span>Online</span>
            </button>

            <button className="desktop-icon" type="button" onDoubleClick={() => setInstagramOpen(true)} onClick={() => setInstagramOpen(true)}>
              <span className="desktop-icon-glyph instagram-icon-glyph" aria-hidden="true">IG</span>
              <span>Instagram</span>
            </button>
          </>
        )}

        <button className="desktop-icon" type="button" onDoubleClick={() => setSettingsOpen(true)} onClick={() => setSettingsOpen(true)}>
          <span className="desktop-icon-glyph settings-icon-glyph" aria-hidden="true">S</span>
          <span>Settings</span>
        </button>

        {terminalOpen && (
          <TerminalWindow
            windowRef={terminalWindowRef}
            inputRef={inputRef}
            bottomRef={bottomRef}
            maximized={maximized}
            position={terminalPosition}
            theme={theme}
            history={history}
            input={input}
            onClick={focusInput}
            onDragStart={(event) => startWindowDrag(event, terminalWindowRef.current, setTerminalPosition, maximized)}
            onMinimize={() => setTerminalOpen(false)}
            onToggleMaximize={() => setMaximized(!maximized)}
            onClose={closeTerminal}
            onInputChange={(value) => {
              setInput(value)
              setHistoryIndex(-1)
            }}
            onKeyDown={handleKeyDown}
          />
        )}

        {clockOpen && (
          <ClockWeatherAppWindow
            windowRef={clockWindowRef}
            maximized={clockMaximized}
            position={clockPosition}
            now={now}
            weather={weather}
            weatherMessage={weatherMessage}
            loading={weatherLoading}
            onDragStart={(event) => startWindowDrag(event, clockWindowRef.current, setClockPosition, clockMaximized)}
            onMinimize={() => setClockOpen(false)}
            onToggleMaximize={() => setClockMaximized(!clockMaximized)}
            onClose={closeClockApp}
            onRefreshWeather={refreshWeather}
          />
        )}

        {onlineOpen && (
          <OnlineAppWindow
            windowRef={onlineWindowRef}
            maximized={onlineMaximized}
            position={onlinePosition}
            rows={onlineRows}
            pageRows={onlinePageRows}
            pageStart={onlinePageStart}
            normalizedPage={normalizedOnlinePage}
            pageCount={onlinePageCount}
            duration={onlineDuration}
            message={onlineMessage}
            loading={onlineLoading}
            removeTarget={onlineRemoveTarget}
            onDragStart={(event) => startWindowDrag(event, onlineWindowRef.current, setOnlinePosition, onlineMaximized)}
            onMinimize={() => setOnlineOpen(false)}
            onToggleMaximize={() => setOnlineMaximized(!onlineMaximized)}
            onClose={closeOnlineApp}
            onSubmit={handleOnlineAdd}
            onDurationChange={setOnlineDuration}
            onRefresh={handleOnlineRefresh}
            onPageChange={(updater) => setOnlinePage(updater)}
            onRemoveTargetChange={setOnlineRemoveTarget}
            onRemove={handleOnlineRemove}
          />
        )}

        {instagramOpen && (
          <InstagramAppWindow
            windowRef={instagramWindowRef}
            maximized={instagramMaximized}
            position={instagramPosition}
            users={instagramUsers}
            rows={instagramLogRows}
            selectedUser={selectedInstagramUser}
            message={instagramMessage}
            loading={instagramLoading}
            removeTarget={instagramRemoveTarget}
            lastChecked={instagramLastChecked}
            onDragStart={(event) => startWindowDrag(event, instagramWindowRef.current, setInstagramPosition, instagramMaximized)}
            onMinimize={() => setInstagramOpen(false)}
            onToggleMaximize={() => setInstagramMaximized(!instagramMaximized)}
            onClose={closeInstagramApp}
            onSelectedUserChange={setSelectedInstagramUser}
            onRemoveTargetChange={setInstagramRemoveTarget}
            onRemove={handleInstagramRemove}
            onRefresh={() => refreshInstagramRows('POST')}
          />
        )}

        {settingsOpen && (
          <SettingsAppWindow
            windowRef={settingsWindowRef}
            maximized={settingsMaximized}
            position={settingsPosition}
            theme={desktopTheme}
            wallpaper={desktopWallpaper}
            wallpaperMessage={wallpaperMessage}
            onDragStart={(event) => startWindowDrag(event, settingsWindowRef.current, setSettingsPosition, settingsMaximized)}
            onMinimize={() => setSettingsOpen(false)}
            onToggleMaximize={() => setSettingsMaximized(!settingsMaximized)}
            onClose={closeSettingsApp}
            onThemeChange={handleDesktopThemeChange}
            onThemeValueChange={handleDesktopThemeValueChange}
            onWallpaperUpload={handleWallpaperUpload}
            onWallpaperClear={handleWallpaperClear}
          />
        )}
      </main>
    </div>
  )
}

export default App
