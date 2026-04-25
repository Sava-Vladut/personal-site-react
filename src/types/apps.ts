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
}

export type InstagramLogRow = {
  loggedAt: string
  username: string
  followers: string
  following: string
  status: string
  error: string
}

export type WindowPosition = {
  x: number
  y: number
}
