const durationPattern = /^(\d+)([mh])$/i

const pad = (value: number) => value.toString().padStart(2, '0')

export const formatLocalTimestamp = (date: Date) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export const getAdjustedOnlineTimestamp = (duration?: string) => {
  if (!duration) {
    return {
      ok: true as const,
      timestamp: formatLocalTimestamp(new Date()),
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
    timestamp: formatLocalTimestamp(new Date(Date.now() - offsetMs)),
  }
}
