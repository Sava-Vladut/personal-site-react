export const usersPath: string
export const csvPath: string
export const statePath: string

export function readUsers(): Promise<string[]>
export function readLogRows(): Promise<string[]>
export function readTrackerState(): Promise<Record<string, unknown>>
export function logAllUsers(): Promise<void>
export function startInstagramTracker(): () => void
