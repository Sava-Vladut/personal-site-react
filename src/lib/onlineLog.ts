import { formatRomaniaTimestamp } from './romaniaTime'

const durationPattern = /^(\d+)([mh])$/i

export const getAdjustedOnlineTimestamp = (duration?: string) => {
  if (!duration) {
    return {
      ok: true as const,
      timestamp: formatRomaniaTimestamp(new Date()),
    }
  }

  const match = durationPattern.exec(duration)
  if (!match) {
    return {
      ok: false as const,
      error: 'Invalid duration. Use examples like 15m, 50m, or 5h.',
    }
  }

  const value = Number(match[1])
  if (!Number.isSafeInteger(value) || value <= 0) {
    return {
      ok: false as const,
      error: 'Duration must be a positive number.',
    }
  }

  const unit = match[2].toLowerCase()
  const offsetMs = value * (unit === 'm' ? 60_000 : 3_600_000)

  return {
    ok: true as const,
    timestamp: formatRomaniaTimestamp(new Date(Date.now() - offsetMs)),
  }
}
