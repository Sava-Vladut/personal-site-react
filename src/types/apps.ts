export type OnlineLogResponse = {
  ok: boolean
  error?: string
}

export type OnlineTableResponse = {
  ok: boolean
  rows?: string[]
  error?: string
}

export type OnlineRemoveResponse = {
  ok: boolean
  removed?: string
  error?: string
}

export type OnlineRemoveTarget = {
  index: number
  timestamp: string
}

export type InstagramTrackerState = Record<string, {
  followers?: number
  following?: number
  isPrivate?: boolean
  lastChecked?: string
  lastChanged?: string
}>

export type InstagramTrackerResponse = {
  ok: boolean
  users?: string[]
  rows?: string[]
  state?: InstagramTrackerState
  csvPath?: string
  usersPath?: string
  error?: string
  removed?: string
}

export type InstagramRemoveTarget = {
  index: number
  loggedAt: string
  username: string
}

export type InstagramLogRow = {
  index: number
  loggedAt: string
  username: string
  followers: string
  following: string
  privacy: string
  status: string
  error: string
}

export type WindowPosition = {
  x: number
  y: number
}

export type WeatherState = {
  temperatureC: number
  apparentTemperatureC: number
  windKmh: number
  weatherCode: number
  observedAt: string
}

export type DesktopTheme = {
  id: string
  name: string
  shell: string
  grid: string
  text: string
  icon: string
  iconBorder: string
  accent: string
  window: string
  windowPanel: string
  danger: string
}
