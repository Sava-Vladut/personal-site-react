const linkRegex = /https?:\/\/[^\s]+/g

type LinkifiedTextProps = {
  text: string
}

const LinkifiedText = ({ text }: LinkifiedTextProps) => {
  if (!text.trim()) return <>No links found.</>
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, lineIndex) => {
        const parts = line.split(linkRegex)
        const matches = line.match(linkRegex) ?? []
        return (
          <div key={`line-${lineIndex}`}>
            {parts.map((part, index) => {
              const match = matches[index]
              if (!match) return <span key={`part-${lineIndex}-${index}`}>{part}</span>
              return (
                <span key={`part-${lineIndex}-${index}`}>
                  {part}
                  <a className="linkified" href={match} target="_blank" rel="noreferrer">
                    {match}
                  </a>
                </span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

export default LinkifiedText
