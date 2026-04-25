export const parseCsvRow = (row: string) => {
  const values: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    const nextChar = row[index + 1]

    if (char === '"' && quoted && nextChar === '"') {
      value += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      values.push(value)
      value = ''
      continue
    }

    value += char
  }

  values.push(value)
  return values
}
