import { useEffect, useRef, useState } from 'react'
import './styles/terminal.css'
import './styles/theme.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'
import downloadsText from '../downloads.txt?raw'
import userText from '../user.txt?raw'
import commandsText from '../commands.txt?raw'
import AsciiWave from './components/AsciiWave'
import LinkifiedText from './components/LinkifiedText'
import TerminalBody from './components/TerminalBody'
import TerminalHeader from './components/TerminalHeader'
import type { HistoryItem } from './types/terminal'

type DownloadItem = {
  label: string
  url: string
  folder: string
}

type OnlineEntry = {
  onlineTimeRomania: string
}

const ONLINE_STORAGE_KEY = 'grim-online-log'
const MAX_ONLINE_OFFSET_MS = 12 * 60 * 60 * 1000
const ONLINE_TABLE_PAGE_SIZE = 10

const downloadList = downloadsText
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const parts = line.includes('|')
      ? line.split('|').map((part) => part.trim())
      : ['', line]
    const [labelPart, urlPart, folderPart] = parts
    const url = urlPart || line
    const label = labelPart || url.split('/').pop() || url
    const folder = folderPart || 'general'
    return { label, url, folder } satisfies DownloadItem
  })

const DEFAULT_COMMANDS = ['help', 'user', 'projects', 'links', 'theme', 'miner', 'online', 'table', 'clear']

const parseCommandAliases = (text: string, fallback: string[]) => {
  const aliasMap = new Map<string, string>()
  const canonicalSet = new Set<string>()
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  if (lines.length === 0) {
    fallback.forEach((command) => {
      const normalized = command.toLowerCase()
      aliasMap.set(normalized, normalized)
      canonicalSet.add(normalized)
    })
  } else {
    lines.forEach((line) => {
      const [canonicalPart, aliasPart = ''] = line.split(':')
      const canonical = canonicalPart.trim().toLowerCase()
      if (!canonical) return
      canonicalSet.add(canonical)
      aliasMap.set(canonical, canonical)
      aliasPart
        .split(',')
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean)
        .forEach((alias) => aliasMap.set(alias, canonical))
    })
  }

  return {
    aliasMap,
    commands: Array.from(aliasMap.keys())
  }
}

const createId = () => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
    }
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const formatRomaniaTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

const parseOnlineOffset = (value?: string) => {
  if (!value) return { offsetMs: 0 }
  const match = value.toLowerCase().match(/^(\d+)(m|h)$/)
  if (!match) {
    return { error: 'Usage: online, online 5m, online 30m, online 1h, up to online 12h.' }
  }
  const amount = Number(match[1])
  const unit = match[2]
  const offsetMs = unit === 'h'
    ? amount * 60 * 60 * 1000
    : amount * 60 * 1000
  if (amount <= 0 || offsetMs > MAX_ONLINE_OFFSET_MS) {
    return { error: 'Offset must be more than 0 and no more than 12h.' }
  }
  return { offsetMs }
}

const parseOnlineCsv = (csv: string): OnlineEntry[] =>
  csv
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^"((?:[^"]|"")*)"/)
      const onlineCell = match?.[1]?.replaceAll('""', '"') ?? ''
      return {
        onlineTimeRomania: onlineCell,
      }
    })

const readStoredOnlineEntries = () => {
  try {
    return JSON.parse(localStorage.getItem(ONLINE_STORAGE_KEY) ?? '[]') as OnlineEntry[]
  } catch {
    return []
  }
}

const saveStoredOnlineEntries = (entries: OnlineEntry[]) => {
  localStorage.setItem(ONLINE_STORAGE_KEY, JSON.stringify(entries))
}

const syncOnlineEntry = async (entry: OnlineEntry) => {
  const fallbackEntries = [...readStoredOnlineEntries(), entry]
  saveStoredOnlineEntries(fallbackEntries)

  try {
    const response = await fetch('/api/online-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!response.ok) throw new Error('Unable to write CSV.')
    const data = await response.json() as { csv: string }
    const fileEntries = parseOnlineCsv(data.csv)
    saveStoredOnlineEntries(fileEntries)
    return { entries: fileEntries, persistedToCsv: true }
  } catch {
    return { entries: fallbackEntries, persistedToCsv: false }
  }
}

const loadOnlineEntries = async () => {
  try {
    const response = await fetch('/api/online-log')
    if (!response.ok) throw new Error('Unable to read CSV.')
    const data = await response.json() as { csv: string }
    const fileEntries = parseOnlineCsv(data.csv)
    saveStoredOnlineEntries(fileEntries)
    return { entries: fileEntries, persistedToCsv: true }
  } catch {
    return { entries: readStoredOnlineEntries(), persistedToCsv: false }
  }
}

const saveOnlineEntries = async (entries: OnlineEntry[]) => {
  saveStoredOnlineEntries(entries)

  try {
    const response = await fetch('/api/online-log', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    if (!response.ok) throw new Error('Unable to update CSV.')
    const data = await response.json() as { csv: string }
    const fileEntries = parseOnlineCsv(data.csv)
    saveStoredOnlineEntries(fileEntries)
    return { entries: fileEntries, persistedToCsv: true }
  } catch {
    return { entries, persistedToCsv: false }
  }
}

const OnlineTable = ({
  entries,
  startIndex,
}: {
  entries: OnlineEntry[]
  startIndex: number
}) => (
  <div className="online-table-wrap">
    <table className="online-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Time when online</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={`${entry.onlineTimeRomania}-${index}`}>
            <td>{startIndex + index + 1}</td>
            <td>{entry.onlineTimeRomania}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

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
    const selection = window.getSelection?.()
    if (selection && selection.toString()) return
    inputRef.current?.focus()
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const themes = ['matrix', 'amber', 'solar']
  const { aliasMap, commands } = parseCommandAliases(commandsText, DEFAULT_COMMANDS)
  const projectFolders = Array.from(
    new Set(downloadList.map((archive) => archive.folder))
  ).sort((a, b) => a.localeCompare(b))

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
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>miner</span> &nbsp;Open mining dashboard</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>online</span> &nbsp;Log current Romania time, optionally minus 5m-12h</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>table</span> &nbsp;&nbsp;Show last 10 online times; use table &lt;page&gt; or table remove &lt;index&gt;</div>
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
        const availableFolders = Array.from(
          new Set(downloadList.map((archive) => archive.folder))
        ).sort((a, b) => a.localeCompare(b))
        if (!folderFilter) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: (
              <div>
                <div>Usage: <span style={{color: '#ce9178'}}>projects</span> &lt;folder&gt;</div>
                <div>Available folders: {availableFolders.join(', ')}</div>
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
                  <div>Available folders: {availableFolders.join(', ')}</div>
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

      case 'miner':
        window.open('http://grimnetwork.srvp.ro:5000/', '_blank', 'noopener,noreferrer')
        newHistory.push({
          id: createId(),
          type: 'output',
          content: <span style={{color: '#4ec9b0'}}>Opening mining dashboard...</span>,
        })
        break

      case 'online': {
        const parsedOffset = parseOnlineOffset(parts[1])
        if ('error' in parsedOffset) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>{parsedOffset.error}</span>,
          })
          break
        }
        const onlineTime = new Date(Date.now() - parsedOffset.offsetMs)
        const entry = {
          onlineTimeRomania: formatRomaniaTime(onlineTime),
        }
        const { persistedToCsv } = await syncOnlineEntry(entry)
        newHistory.push({
          id: createId(),
          type: 'output',
          content: (
            <div>
              <div style={{color: '#4ec9b0'}}>Saved online time: {entry.onlineTimeRomania}</div>
              {!persistedToCsv && (
                <div style={{color: '#d7ba7d'}}>Stored in browser storage. Start the Vite site locally to write online-times.csv.</div>
              )}
            </div>
          ),
        })
        break
      }

      case 'table': {
        const { entries, persistedToCsv } = await loadOnlineEntries()
        if (parts[1]?.toLowerCase() === 'remove') {
          const indexToRemove = Number(parts[2])
          if (!Number.isInteger(indexToRemove) || indexToRemove < 1) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>Usage: table remove &lt;index&gt;</span>,
            })
            break
          }
          const newestFirst = [...entries].reverse()
          const removedEntry = newestFirst[indexToRemove - 1]
          if (!removedEntry) {
            newHistory.push({
              id: createId(),
              type: 'output',
              content: <span style={{color: '#e81123'}}>No table entry found at index {indexToRemove}.</span>,
            })
            break
          }
          newestFirst.splice(indexToRemove - 1, 1)
          const updatedEntries = newestFirst.reverse()
          const { persistedToCsv: removePersistedToCsv } = await saveOnlineEntries(updatedEntries)
          newHistory.push({
            id: createId(),
            type: 'output',
            content: (
              <div>
                <div style={{color: '#4ec9b0'}}>Removed #{indexToRemove}: {removedEntry.onlineTimeRomania}</div>
                {!removePersistedToCsv && (
                  <div style={{color: '#d7ba7d'}}>Removed from browser storage. Start the Vite site locally to update online-times.csv.</div>
                )}
              </div>
            ),
          })
          break
        }
        const requestedPage = parts[1] ? Number(parts[1]) : 1
        if (!Number.isInteger(requestedPage) || requestedPage < 1) {
          newHistory.push({
            id: createId(),
            type: 'output',
            content: <span style={{color: '#e81123'}}>Usage: table or table &lt;page number&gt;</span>,
          })
          break
        }
        const newestFirst = [...entries].reverse()
        const totalPages = Math.max(1, Math.ceil(newestFirst.length / ONLINE_TABLE_PAGE_SIZE))
        const page = Math.min(requestedPage, totalPages)
        const startIndex = (page - 1) * ONLINE_TABLE_PAGE_SIZE
        const visibleEntries = newestFirst.slice(startIndex, startIndex + ONLINE_TABLE_PAGE_SIZE)
        newHistory.push({
          id: createId(),
          type: 'output',
          content: entries.length === 0 ? (
            <span>No online times logged yet.</span>
          ) : (
            <div>
              <div style={{color: '#4ec9b0', marginBottom: '8px'}}>Page {page}/{totalPages} - newest first</div>
              <OnlineTable entries={visibleEntries} startIndex={startIndex} />
              {requestedPage > totalPages && (
                <div style={{color: '#d7ba7d', marginTop: '8px'}}>Page {requestedPage} does not exist yet, showing page {totalPages}.</div>
              )}
              {!persistedToCsv && (
                <div style={{color: '#d7ba7d', marginTop: '8px'}}>Showing browser-stored entries because the CSV endpoint is unavailable.</div>
              )}
            </div>
          ),
        })
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
        const matches = themes
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
