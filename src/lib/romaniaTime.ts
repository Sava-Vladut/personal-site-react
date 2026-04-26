export const ROMANIA_TIME_ZONE = 'Europe/Bucharest'

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

const timestampFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ROMANIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const getRomaniaParts = (date: Date) => Object.fromEntries(
  timestampFormatter
    .formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]),
) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>

export const formatRomaniaTimestamp = (date: Date) => {
  const parts = getRomaniaParts(date)

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export const parseRomaniaTimestamp = (timestamp: string) => {
  const match = timestampPattern.exec(timestamp)

  if (!match) return Number.NaN

  const [, year, month, day, hour, minute, second] = match
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  const parts = getRomaniaParts(new Date(utcGuess))
  const romaniaAtUtcGuess = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )

  return utcGuess - (romaniaAtUtcGuess - utcGuess)
}
