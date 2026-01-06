import { useMemo } from 'react'

type AsciiWaveProps = {
  text: string
}

const AsciiWave = ({ text }: AsciiWaveProps) => {
  const lines = useMemo(() => text.split('\n'), [text])

  return (
    <div style={{ lineHeight: '1.2', fontSize: '0.64rem', fontFamily: 'monospace', whiteSpace: 'pre' }}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex}>{line}</div>
      ))}
    </div>
  )
}

export default AsciiWave
