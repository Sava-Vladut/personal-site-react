export const getTimePassed = (timestamp: string) => {
  const normalizedTimestamp = timestamp.replace(' ', 'T')
  const timestampMs = new Date(normalizedTimestamp).getTime()

  if (Number.isNaN(timestampMs)) {
    return 'Unknown'
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000))
  const days = Math.floor(elapsedSeconds / 86_400)
  const hours = Math.floor((elapsedSeconds % 86_400) / 3_600)
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return 'Just now'
}
