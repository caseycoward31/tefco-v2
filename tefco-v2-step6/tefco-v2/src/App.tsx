import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Segment = {
  id: string
  name: string
}

type Tank = {
  id: string
  tank_number: string
}

type Meter = {
  id: string
  meter_number: string
}

export default function App() {
  const [session, setSession] = useState<any>(null)

  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])

  const [newSegment, setNewSegment] = useState('')
  const [newTank, setNewTank] = useState('')
  const [newMeter, setNewMeter] = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)

      if (data.session) {
        loadAll()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      if (session) {
        loadAll()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadAll() {
    loadSegments()
    loadTanks()
    loadMeters()
  }

  async function loadSegments() {
    const { data } = await supabase
      .from('segments')
      .select('*')
      .order('name')

    if (data) setSegments(data)
  }

  async function loadTanks() {
    const { data } = await supabase
      .from('tanks')
      .select('*')
      .order('tank_number')

    if (data) setTanks(data)
  }

  async function loadMeters() {
    const { data } = await supabase
      .from('meters')
      .select('*')
      .order('meter_number')

    if (data) setMeters(data)
  }

  async function addSegment() {
    if (!newSegment) return

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .single()

    if (!companyUser) return

    await supabase.from('segments').insert({
      name: newSegment,
      company_id: companyUser.company_id,
    })

    setNewSegment('')
    loadSegments()
  }

  async function addTank() {
    if (!newTank) return

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .single()

    if (!companyUser) return

    await supabase.from('tanks').insert({
      tank_number: newTank,
      company_id: companyUser.company_id,
    })

    setNewTank('')
    loadTanks()
  }

  async function addMeter() {
    if (!newMeter) return

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .single()

    if (!companyUser) return

    await supabase.from('meters').insert({
      meter_number: newMeter,
      company_id: companyUser.company_id,
    })

    setNewMeter('')
    loadMeters()
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div style={{ color: 'white', padding: 40 }}>Loading...</div>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 20,
            marginTop: 30,
          }}
        >
          <div
            style={{
              background: '#1e293b',
              padding: 20,
              borderRadius: 10,
            }}
          >
            <h3>Segments</h3>

            <input
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              placeholder="New Segment"
              style={{
                width: '100%',
                padding: 10,
                marginTop: 10,
              }}
            />

            <button
              onClick={addSegment}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 10,
              }}
            >
              Add Segment
            </button>

            {segments.map((segment) => (
              <div
                key={segment.id}
                style={{
                  marginTop: 10,
                  background: '#334155',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                {segment.name}
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#1e293b',
              padding: 20,
              borderRadius: 10,
            }}
          >
            <h3>Tanks</h3>

            <input
              value={newTank}
              onChange={(e) => setNewTank(e.target.value)}
              placeholder="Tank Number"
              style={{
                width: '100%',
                padding: 10,
                marginTop: 10,
              }}
            />

            <button
              onClick={addTank}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 10,
              }}
            >
              Add Tank
            </button>

            {tanks.map((tank) => (
              <div
                key={tank.id}
                style={{
                  marginTop: 10,
                  background: '#334155',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                Tank {tank.tank_number}
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#1e293b',
              padding: 20,
              borderRadius: 10,
            }}
          >
            <h3>Meters</h3>

            <input
              value={newMeter}
              onChange={(e) => setNewMeter(e.target.value)}
              placeholder="Meter Number"
              style={{
                width: '100%',
                padding: 10,
                marginTop: 10,
              }}
            />

            <button
              onClick={addMeter}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 10,
              }}
            >
              Add Meter
            </button>

            {meters.map((meter) => (
              <div
                key={meter.id}
                style={{
                  marginTop: 10,
                  background: '#334155',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                Meter {meter.meter_number}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
