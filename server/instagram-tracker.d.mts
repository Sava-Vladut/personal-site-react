export const usersPath: string
export const csvPath: string

export function readUsers(): Promise<string[]>
export function readLogRows(): Promise<string[]>
export function logAllUsers(): Promise<void>
export function startInstagramTracker(): () => void
