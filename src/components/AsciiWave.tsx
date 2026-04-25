import { useMemo } from 'react'

type AsciiWaveProps = {
  text: string
}

const AsciiWave = ({ text }: AsciiWaveProps) => {
  const lines = useMemo(() => text.split('\n'), [text])

  return (
    <div className="ascii-wave">
      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          className="ascii-wave-line"
          style={{ animationDelay: `${lineIndex * 0.12}s` }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

export default AsciiWave
