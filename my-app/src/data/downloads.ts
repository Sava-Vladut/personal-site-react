import downloadsText from '../../downloads.txt?raw'
import type { DownloadItem } from '../types/content'

export const downloadList = downloadsText
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const parts = line.includes('|')
      ? line.split('|').map((part) => part.trim())
      : ['', line]
    const [labelPart, urlPart, folderPart] = parts
    const url = urlPart || line
    const label = labelPart || url.split('/').pop() || url
    const folder = folderPart || 'general'
    return { label, url, folder } satisfies DownloadItem
  })

export const getProjectFolders = () =>
  Array.from(new Set(downloadList.map((archive) => archive.folder))).sort((a, b) =>
    a.localeCompare(b),
  )

