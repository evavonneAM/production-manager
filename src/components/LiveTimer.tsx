import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

/** Display-only running timer counting up from an ISO timestamp. */
export function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return (
    <span className="tabular-nums">
      {h > 0 ? `${h}:` : ''}
      {pad(m)}:{pad(s)}
    </span>
  )
}
