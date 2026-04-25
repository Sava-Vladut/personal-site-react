export const parseCommandAliases = (text: string, fallback: string[]) => {
  const aliasMap = new Map<string, string>()
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  if (lines.length === 0) {
    fallback.forEach((command) => {
      const normalized = command.toLowerCase()
      aliasMap.set(normalized, normalized)
    })
  } else {
    lines.forEach((line) => {
      const [canonicalPart, aliasPart = ''] = line.split(':')
      const canonical = canonicalPart.trim().toLowerCase()
      if (!canonical) return
      aliasMap.set(canonical, canonical)
      aliasPart
        .split(',')
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean)
        .forEach((alias) => aliasMap.set(alias, canonical))
    })
  }

  return {
    aliasMap,
    commands: Array.from(aliasMap.keys()),
  }
}
