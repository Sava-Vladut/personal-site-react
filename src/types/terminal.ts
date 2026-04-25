import type { ReactNode } from 'react'

export type HistoryItem = {
  id: string
  type: 'command' | 'output'
  content: ReactNode
}
