import React, { useEffect, useState } from 'react'

interface DbHealth {
  ok: boolean
  configured?: boolean
  mongooseState?: number
  ping?: string | null
  error?: string
}

export default function DebugDbPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DbHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHealth() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/health/db')
        const json = await res.json()
        setData(json)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>/debug/db</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {data && (
        <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <p>
            <strong>Status:</strong> {data.ok ? 'Connected' : 'Not Connected'}
          </p>
          {data.configured === false && (
            <p style={{ color: 'orange' }}>MONGODB_URI not set</p>
          )}
          <p>
            <strong>Mongoose State:</strong> {String(data.mongooseState)} (0=disc,1=conn,2=connecting,3=disconnecting)
          </p>
          <p>
            <strong>Ping:</strong> {data.ping ?? 'n/a'}
          </p>
          {data.error && (
            <p style={{ color: 'crimson' }}>
              <strong>Error:</strong> {data.error}
            </p>
          )}
          <button onClick={() => location.reload()} style={{ marginTop: 8 }}>Refresh</button>
        </div>
      )}
    </div>
  )
}
