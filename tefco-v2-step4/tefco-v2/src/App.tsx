import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Segment = {
  id: string
  name: string
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)

      if (data.session) {
        loadSegments()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      if (session) {
        loadSegments()
      } else {
        setSegments([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadSegments() {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .order('name')

    if (!error && data) {
      setSegments(data)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'white' }}>
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div
      style={{
        background: '#020617',
        color: 'white',
        minHeight: '100vh',
        display: 'flex',
      }}
    >
      <div
        style={{
          width: 240,
          background: '#0f172a',
          padding: 20,
        }}
      >
        <h2>TEFCO V2</h2>

        <button
          onClick={logout}
          style={{
            marginTop: 20,
            padding: 10,
            width: '100%',
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ flex: 1, padding: 30 }}>
        <h1>Dashboard</h1>

        <h2 style={{ marginTop: 40 }}>
          Segments
        </h2>

        {segments.map((segment) => (
          <div
            key={segment.id}
            style={{
              background: '#1e293b',
              padding: 15,
              marginTop: 10,
              borderRadius: 8,
            }}
          >
            {segment.name}
          </div>
        ))}
      </div>
    </div>
  )
}
