import { useEffect, useRef, useState } from 'react'
import './styles/terminal.css'
import './styles/theme.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'
import downloadsText from '../downloads.txt?raw'
import userText from '../user.txt?raw'
import minecraftText from '../minecraft.txt?raw'
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

const DEFAULT_COMMANDS = ['help', 'user', 'minecraft', 'projects', 'links', 'theme', 'miner', 'clear']
const minecraftIp = (() => {
  const match = minecraftText.match(/SERVER IP:\s*(.+)/i)
  return match ? match[1].trim() : minecraftText.trim()
})()

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

  const handleCopyMinecraftIp = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (!minecraftIp) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(minecraftIp)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = minecraftIp
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    } catch {
      setHistory((prev) => [
        ...prev,
        {
          id: createId(),
          type: 'output',
          content: <span style={{color: '#e81123'}}>Failed to copy Minecraft IP.</span>
        }
      ])
    }
  }

  const fetchMinecraftStatus = async () => {
    const response = await fetch(`https://api.mcsrvstat.us/2/${minecraftIp}`)
    if (!response.ok) {
      throw new Error('Status request failed')
    }
    const data = await response.json()
    const online = Boolean(data?.online)
    const playersOnline = data?.players?.online
    const playersMax = data?.players?.max
    return { online, playersOnline, playersMax }
  }

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
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>minecraft</span> &nbsp;Show Minecraft server info</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>projects</span> &nbsp;&lt;folder&gt; List projects in a folder</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>links</span> &nbsp;List all project links</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>theme</span> &nbsp;Switch color theme</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>miner</span> &nbsp;Open mining dashboard</div>
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

      case 'minecraft': {
        newHistory.push({
          id: createId(),
          type: 'output',
          content: (
            <div className="project-item">
              <span>SERVER IP: {minecraftIp}</span>
              <a className="download-link" href="#" onClick={handleCopyMinecraftIp}>
                [COPY]
              </a>
            </div>
          )
        })
        setHistory(newHistory)
        setInput('')
        fetchMinecraftStatus()
          .then((status) => {
            const statusText = status.online
              ? `Players online: ${status.playersOnline ?? 0}${status.playersMax ? `/${status.playersMax}` : ''}`
              : 'Server is offline.'
            setHistory((prev) => [
              ...prev,
              {
                id: createId(),
                type: 'output',
                content: <span>{statusText}</span>
              }
            ])
          })
          .catch(() => {
            setHistory((prev) => [
              ...prev,
              {
                id: createId(),
                type: 'output',
                content: <span style={{color: '#e81123'}}>Failed to fetch server status.</span>
              }
            ])
          })
        return
      }

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
