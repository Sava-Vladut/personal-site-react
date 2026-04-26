import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { request } from 'node:https'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = dirname(__dirname)
export const usersPath = process.env.INSTAGRAM_USERS_PATH || join(rootDir, 'instagram-users.txt')
export const csvPath = process.env.INSTAGRAM_COUNTS_CSV || join(rootDir, 'data', 'instagram-counts.csv')
export const statePath = process.env.INSTAGRAM_STATE_PATH || join(rootDir, 'data', 'instagram-state.json')
const minIntervalMinutes = Number(process.env.INSTAGRAM_MIN_INTERVAL_MINUTES || 30)
const maxIntervalMinutes = Number(process.env.INSTAGRAM_MAX_INTERVAL_MINUTES || 40)
const requestDelayMs = Number(process.env.INSTAGRAM_REQUEST_DELAY_MS || 2500)
const cookie = process.env.INSTAGRAM_COOKIE || ''

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const timestamp = () => {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-')
    + ' '
    + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(':')
}

const csvEscape = (value) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const decodeHtml = (value) => value
  .replaceAll('&quot;', '"')
  .replaceAll('&#34;', '"')
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')

const parseCompactCount = (value) => {
  const normalizedValue = value.trim().replaceAll(',', '')
  const match = normalizedValue.match(/^(\d+(?:\.\d+)?)([km])?$/i)

  if (!match) return Number.NaN

  const number = Number(match[1])
  const suffix = match[2]?.toLowerCase()

  if (suffix === 'k') return Math.round(number * 1_000)
  if (suffix === 'm') return Math.round(number * 1_000_000)

  return number
}

const getHttpsText = (url, headers) => new Promise((resolve, reject) => {
  const requestHandle = request(url, { headers }, (response) => {
    let body = ''

    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      body += chunk
    })
    response.on('end', () => {
      resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode ?? 0,
        body,
      })
    })
  })

  requestHandle.on('error', reject)
  requestHandle.end()
})

const appendCsvRow = async (row) => {
  await mkdir(dirname(csvPath), { recursive: true })

  const exists = await stat(csvPath)
    .then(() => true)
    .catch((error) => {
      if (error?.code === 'ENOENT') return false
      throw error
    })

  if (!exists) {
    await writeFile(csvPath, 'timestamp,username,followers,following,privacy,status,error\n', 'utf8')
  }

  await appendFile(csvPath, `${row.map(csvEscape).join(',')}\n`, 'utf8')
}

const readState = async () => {
  const contents = await readFile(statePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '{}'
    throw error
  })

  try {
    return JSON.parse(contents)
  } catch {
    return {}
  }
}

const writeState = async (state) => {
  await mkdir(dirname(statePath), { recursive: true })
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export const readUsers = async () => {
  const contents = await readFile(usersPath, 'utf8')
  const users = contents
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((line) => line.replace(/^@/, '').toLowerCase())

  return [...new Set(users)]
}

export const readTrackerState = async () => readState()

const getProfileCountsFromApi = async (username) => {
  const response = await getHttpsText(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      accept: 'application/json',
      'x-ig-app-id': '936619743392459',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      ...(cookie ? { cookie } : {}),
    },
  )

  if (!response.ok) {
    throw new Error(`Instagram returned HTTP ${response.status}`)
  }

  const payload = JSON.parse(response.body)
  const user = payload?.data?.user

  if (!user) {
    throw new Error('Profile data was missing from Instagram response')
  }

  return {
    followers: user.edge_followed_by?.count,
    following: user.edge_follow?.count,
    isPrivate: user.is_private,
  }
}

const getProfileCountsFromPage = async (username) => {
  const response = await getHttpsText(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      ...(cookie ? { cookie } : {}),
  })

  if (!response.ok) {
    throw new Error(`Instagram profile page returned HTTP ${response.status}`)
  }

  const html = response.body
  const descriptionMatch = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i)
  const description = descriptionMatch ? decodeHtml(descriptionMatch[1]) : ''
  const countsMatch = description.match(/([\d,.]+[km]?)\s+Followers,\s+([\d,.]+[km]?)\s+Following/i)

  if (!countsMatch) {
    throw new Error('Unable to parse counts from Instagram profile page')
  }

  return {
    followers: parseCompactCount(countsMatch[1]),
    following: parseCompactCount(countsMatch[2]),
    isPrivate: undefined,
  }
}

export const getProfileCounts = async (username) => {
  try {
    return await getProfileCountsFromApi(username)
  } catch (apiError) {
    const apiMessage = apiError instanceof Error ? apiError.message : 'Instagram API failed'

    try {
      return await getProfileCountsFromPage(username)
    } catch (pageError) {
      const pageMessage = pageError instanceof Error ? pageError.message : 'Instagram page fallback failed'
      throw new Error(`${apiMessage}; fallback failed: ${pageMessage}`)
    }
  }
}

const logOneUser = async (username) => {
  const checkedAt = timestamp()

  try {
    const counts = await getProfileCounts(username)

    if (!Number.isFinite(counts.followers) || !Number.isFinite(counts.following)) {
      throw new Error('Follower or following count was missing')
    }

    const state = await readState()
    const previous = state[username]
    const privacy = typeof counts.isPrivate === 'boolean' ? (counts.isPrivate ? 'private' : 'public') : 'unknown'
    const changed = previous?.followers !== counts.followers
      || previous?.following !== counts.following
      || (typeof counts.isPrivate === 'boolean' && previous?.isPrivate !== counts.isPrivate)

    state[username] = {
      followers: counts.followers,
      following: counts.following,
      ...(typeof counts.isPrivate === 'boolean' ? { isPrivate: counts.isPrivate } : {}),
      lastChecked: checkedAt,
      lastChanged: changed ? checkedAt : previous?.lastChanged,
    }

    await writeState(state)

    if (changed) {
      await appendCsvRow([checkedAt, username, counts.followers, counts.following, privacy, 'ok', ''])
      console.log(`${username}: ${counts.followers} followers, ${counts.following} following, ${privacy}`)
      return
    }

    console.log(`${username}: unchanged (${counts.followers} followers, ${counts.following} following, ${privacy})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const state = await readState()
    state[username] = {
      ...state[username],
      lastChecked: checkedAt,
    }
    await writeState(state)
    console.error(`${username}: ${message}`)
  }
}

export const logAllUsers = async () => {
  const users = await readUsers()

  if (users.length === 0) {
    console.log(`No users found in ${usersPath}`)
    return
  }

  console.log(`Checking ${users.length} Instagram user(s). CSV: ${csvPath}`)

  for (const [index, username] of users.entries()) {
    await logOneUser(username)

    if (index < users.length - 1) {
      await sleep(requestDelayMs)
    }
  }
}

const getNextIntervalMs = () => {
  const minMinutes = Math.min(minIntervalMinutes, maxIntervalMinutes)
  const maxMinutes = Math.max(minIntervalMinutes, maxIntervalMinutes)
  const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes)
  return Math.round(minutes * 60_000)
}

export const readLogRows = async () => {
  const contents = await readFile(csvPath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return ''
    throw error
  })
  const rows = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return rows[0]?.startsWith('timestamp,') ? rows.slice(1) : rows
}

export const startInstagramTracker = () => {
  let stopped = false

  const tick = async () => {
    if (stopped) return

    await logAllUsers()

    if (stopped) return

    const waitMs = getNextIntervalMs()
    console.log(`Next Instagram check in ${Math.round(waitMs / 60_000)} minute(s).`)
    setTimeout(() => {
      void tick().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown tracker error'
        console.error(`Instagram tracker failed: ${message}`)
      })
    }, waitMs)
  }

  void tick().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown tracker error'
    console.error(`Instagram tracker failed: ${message}`)
  })

  return () => {
    stopped = true
  }
}

const run = async () => {
  const once = process.argv.includes('--once')

  await logAllUsers()

  if (once) return

  startInstagramTracker()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown tracker error'
    console.error(message)
    process.exitCode = 1
  })
}
