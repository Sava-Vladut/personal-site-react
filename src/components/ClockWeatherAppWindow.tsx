import type { PointerEventHandler, RefObject } from 'react'
import TerminalHeader from './TerminalHeader'
import type { WeatherState, WindowPosition } from '../types/apps'

type ClockWeatherAppWindowProps = {
  windowRef: RefObject<HTMLDivElement | null>
  maximized: boolean
  position: WindowPosition | null
  now: Date
  weather: WeatherState | null
  weatherMessage: string
  loading: boolean
  onDragStart: PointerEventHandler<HTMLDivElement>
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  onRefreshWeather: () => void
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const weatherLabels = new Map([
  [0, 'Clear'],
  [1, 'Mostly clear'],
  [2, 'Partly cloudy'],
  [3, 'Cloudy'],
  [45, 'Fog'],
  [48, 'Fog'],
  [51, 'Light drizzle'],
  [53, 'Drizzle'],
  [55, 'Heavy drizzle'],
  [61, 'Light rain'],
  [63, 'Rain'],
  [65, 'Heavy rain'],
  [71, 'Light snow'],
  [73, 'Snow'],
  [75, 'Heavy snow'],
  [80, 'Rain showers'],
  [81, 'Rain showers'],
  [82, 'Heavy showers'],
  [95, 'Thunderstorm'],
])

const getWeatherLabel = (code: number) => weatherLabels.get(code) ?? 'Mixed weather'

const ClockWeatherAppWindow = ({
  windowRef,
  maximized,
  position,
  now,
  weather,
  weatherMessage,
  loading,
  onDragStart,
  onMinimize,
  onToggleMaximize,
  onClose,
  onRefreshWeather,
}: ClockWeatherAppWindowProps) => (
  <div
    ref={windowRef}
    className={`app-window clock-app-window ${maximized ? 'maximized' : ''} ${position ? 'drag-positioned' : ''}`}
    style={position && !maximized ? { left: position.x, top: position.y } : undefined}
  >
    <TerminalHeader
      title="now"
      icon="N"
      onDragStart={onDragStart}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    />

    <div className="clock-app-body">
      <section className="clock-panel">
        <div className="clock-label">Romania time</div>
        <time className="clock-time" dateTime={now.toISOString()}>{timeFormatter.format(now)}</time>
        <div className="clock-date">{dateFormatter.format(now)}</div>
      </section>

      <section className="clock-panel weather-panel">
        <div className="clock-panel-header">
          <div>
            <div className="clock-label">Miercurea Ciuc weather</div>
            <div className="clock-weather-status">
              {weather ? getWeatherLabel(weather.weatherCode) : weatherMessage || 'Loading...'}
            </div>
          </div>
          <button className="online-app-button" type="button" disabled={loading} onClick={onRefreshWeather}>
            Refresh
          </button>
        </div>

        {weather && (
          <div className="weather-grid">
            <div>
              <span>Temp</span>
              <strong>{Math.round(weather.temperatureC)}°C</strong>
            </div>
            <div>
              <span>Feels</span>
              <strong>{Math.round(weather.apparentTemperatureC)}°C</strong>
            </div>
            <div>
              <span>Wind</span>
              <strong>{Math.round(weather.windKmh)} km/h</strong>
            </div>
          </div>
        )}

        <div className="clock-footnote">
          {weather?.observedAt ? `Observed ${weather.observedAt}` : weatherMessage}
        </div>
      </section>
    </div>
  </div>
)

export default ClockWeatherAppWindow
