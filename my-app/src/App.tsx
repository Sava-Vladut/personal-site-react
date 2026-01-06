import { useState, useEffect, useRef, useMemo } from 'react'
import './App.css'
import asciiArt from './assets/ascii.txt?raw'
import linksText from '../links.txt?raw'

type ProjectLink = {
  label: string
  url: string
}

type ProjectData = {
  title: string
  description: string
  year?: string
  date?: string
  role?: string
  tags?: string[]
  size?: string
  filename?: string
  links?: ProjectLink[]
}

type HistoryItem = {
  id: string
  type: 'command' | 'output'
  content: React.ReactNode
}

const projectModules = import.meta.glob<{ default: ProjectData }>(
  './projects/*/project.json',
  { eager: true },
)

const projects = Object.entries(projectModules)
  .map(([path, module]) => {
    const data = module.default
    const folder = path.split('/').slice(0, -1).join('/')
    const slug = folder.split('/').pop() ?? folder
    return { ...data, slug }
  })
  .sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''))

const AsciiWave = ({ text }: { text: string }) => {
  const lines = useMemo(() => text.split('\n'), [text])
  
  return (
    <div style={{ lineHeight: '1.2', fontSize: '0.64rem', fontFamily: 'monospace', whiteSpace: 'pre' }}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex}>
          {line.split('').map((char, charIndex) => {
            if (char === ' ') return ' '
            return (
              <span
                key={charIndex}
                className="wave-char"
                style={{
                  animationDelay: `${(charIndex + lineIndex) * 0.02}s`
                }}
              >
                {char}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function App() {
  const [input, setInput] = useState('')
  const [maximized, setMaximized] = useState(true)
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

  const handleCommand = () => {
    if (!input.trim()) return

    const cmd = input.trim()
    const lowerCmd = cmd.toLowerCase()

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
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>ls</span>   &nbsp;&nbsp;&nbsp;&nbsp;List all projects</div>
              <div><span style={{color: '#ce9178', fontWeight: 'bold'}}>links</span> &nbsp;List all project links</div>
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

      case 'ls':
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: (
            <div className="project-list-container">
              <ul className="project-list">
                {projects.map((p) => (
                  <li key={p.slug} className="project-item">
                    <span className="owner"> vlad </span>
                    <span className="size"> {p.size || '4096'} </span>
                    <span className="date"> {p.date || p.year || '2024'} </span>
                    <span className="name">{p.filename || p.title}</span>
                    <div className="details">
                       {p.description}
                     {p.links && p.links.length > 0 && (
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       <span className="links"> [ {p.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>).reduce((prev, curr) => [prev, ', ', curr] as any)} ]</span>
                     )}
                  </div>
                </li>
              ))}
            </ul>
            </div>
          )
        })
        break

      case 'links':
        newHistory.push({
          id: crypto.randomUUID(),
          type: 'output',
          content: (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {linksText.trim() ? linksText : 'No links found.'}
            </pre>
          ),
        })
        break

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

  return (
    <div className={`terminal-window ${maximized ? 'maximized' : ''}`} onClick={focusInput}>
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-icon">_&gt;</span>
          guest@portfolio: ~
        </div>
        <div className="window-controls">
          <button className="control-btn minimize" aria-label="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1"><path d="M0 0h10v1H0z" fill="currentColor"/></svg>
          </button>
          <button className="control-btn maximize" aria-label="Maximize" onClick={() => setMaximized(!maximized)}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1v8h8V1H1zm9 9H0V0h10v10z" fill="currentColor"/></svg>
          </button>
          <button className="control-btn close" aria-label="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
        </div>
      </div>
      <div className="terminal-body">
        {history.map(item => (
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommand()
            }}
            className="terminal-input"
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
export default App
