import type { PointerEventHandler, RefObject } from 'react'
import { DESKTOP_THEMES } from '../config/desktopThemes'
import type { DesktopTheme, WindowPosition } from '../types/apps'
import TerminalHeader from './TerminalHeader'

type SettingsAppWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  theme: DesktopTheme
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onThemeChange: (theme: DesktopTheme) => void
  onThemeValueChange: (key: keyof DesktopTheme, value: string) => void
}

const colorFields: Array<{
  key: keyof DesktopTheme
  label: string
}> = [
  { key: 'shell', label: 'Desktop' },
  { key: 'grid', label: 'Grid' },
  { key: 'text', label: 'Text' },
  { key: 'icon', label: 'Icons' },
  { key: 'iconBorder', label: 'Icon line' },
  { key: 'accent', label: 'Accent' },
  { key: 'window', label: 'Windows' },
  { key: 'windowPanel', label: 'Panels' },
  { key: 'danger', label: 'Danger' },
]

const SettingsAppWindow = ({
  windowRef,
  maximized,
  position,
  theme,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onThemeChange,
  onThemeValueChange,
}: SettingsAppWindowProps) => (
  <div
    ref={windowRef}
    className={`app-window settings-app-window ${maximized ? 'maximized' : ''} ${position ? 'drag-positioned' : ''}`}
    style={position && !maximized ? { left: position.x, top: position.y } : undefined}
  >
    <TerminalHeader
      title="settings"
      icon="S"
      onDragStart={onDragStart}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    />

    <div className="settings-app-body">
      <div className="settings-section">
        <div className="settings-section-title">Desktop Theme</div>
        <div className="settings-theme-grid">
          {DESKTOP_THEMES.map((preset) => (
            <button
              className={`settings-theme-option ${theme.id === preset.id ? 'selected' : ''}`}
              type="button"
              key={preset.id}
              onClick={() => onThemeChange(preset)}
            >
              <span className="settings-theme-preview" aria-hidden="true">
                <span style={{ background: preset.shell }} />
                <span style={{ background: preset.grid }} />
                <span style={{ background: preset.accent }} />
              </span>
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Colors</div>
        <div className="settings-color-grid">
          {colorFields.map((field) => (
            <label className="settings-color-row" key={field.key}>
              <span>{field.label}</span>
              <input
                type="color"
                value={String(theme[field.key])}
                onChange={(event) => onThemeValueChange(field.key, event.target.value)}
                aria-label={field.label}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  </div>
)

export default SettingsAppWindow
