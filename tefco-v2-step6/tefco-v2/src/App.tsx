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

type Profile = {
  id: string
  name: string
  standard: string
  version: string
}

type Producer = {
  id: string
  name: string
  calculation_profile_id?: string | null
}

type Ticket = {
  id: string
  ticket_number: string
  ticket_type: string
  status: string
  producer_id?: string | null
  observed_inputs?: any
  calculation_results?: any
  calculation_profile_snapshot?: any
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState('dashboard')
  const [companyId, setCompanyId] = useState('')

  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [readings, setReadings] = useState<any[]>([])

  const [selectedTicket, setSelectedTicket] =
    useState<Ticket | null>(null)

  const [newSegment, setNewSegment] = useState('')
  const [newTank, setNewTank] = useState('')
  const [newMeter, setNewMeter] = useState('')

  const [newProducer, setNewProducer] =
    useState('')
  const [newProducerProfile, setNewProducerProfile] =
    useState('')

  const [ticketNumber, setTicketNumber] =
    useState('')

  const [ticketType, setTicketType] =
    useState('tank')

  const [selectedProducer, setSelectedProducer] =
    useState('')

  const [selectedSegment, setSelectedSegment] =
    useState('')

  const [selectedTank, setSelectedTank] =
    useState('')

  const [selectedMeter, setSelectedMeter] =
    useState('')

  const [selectedReadingMeter, setSelectedReadingMeter] =
    useState('')

  const [selectedReadingSegment, setSelectedReadingSegment] =
    useState('')

  const [readingOpen, setReadingOpen] =
    useState('')

  const [readingClose, setReadingClose] =
    useState('')

  const [readingGravity, setReadingGravity] =
    useState('')

  const [readingTemp, setReadingTemp] =
    useState('')

  const [readingBSW, setReadingBSW] =
    useState('')

  const [readingMF, setReadingMF] =
    useState('')

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
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)

        if (session) {
          loadAll()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadAll() {
    const { data: cu } = await supabase
      .from('company_users')
      .select('company_id')
      .single()

    if (cu) {
      setCompanyId(cu.company_id)
    }

    const { data: segs } = await supabase
      .from('segments')
      .select('*')
      .order('name')

    const { data: tankData } = await supabase
      .from('tanks')
      .select('*')
      .order('tank_number')

    const { data: meterData } = await supabase
      .from('meters')
      .select('*')
      .order('meter_number')

    const { data: ticketData } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    const { data: profileData } = await supabase
      .from('calculation_profiles')
      .select('*')
      .order('name')

    const { data: producerData } = await supabase
      .from('producers')
      .select('*')
      .order('name')

    const { data: readingData } = await supabase
      .from('operator_readings')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (segs) setSegments(segs)
    if (tankData) setTanks(tankData)
    if (meterData) setMeters(meterData)
    if (ticketData) setTickets(ticketData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
  }

  async function addSegment() {
    if (!newSegment || !companyId) return

    await supabase.from('segments').insert({
      company_id: companyId,
      name: newSegment,
    })

    setNewSegment('')
    loadAll()
  }

  async function addTank() {
    if (!newTank || !companyId) return

    await supabase.from('tanks').insert({
      company_id: companyId,
      tank_number: newTank,
    })

    setNewTank('')
    loadAll()
  }

  async function addMeter() {
    if (!newMeter || !companyId) return

    await supabase.from('meters').insert({
      company_id: companyId,
      meter_number: newMeter,
    })

    setNewMeter('')
    loadAll()
  }

  async function addProducer() {
    if (!newProducer || !companyId) return

    await supabase.from('producers').insert({
      company_id: companyId,
      name: newProducer,
      calculation_profile_id:
        newProducerProfile || null,
    })

    setNewProducer('')
    setNewProducerProfile('')

    loadAll()
  }

  async function saveReading() {
    if (!companyId) return

    const iv =
      Number(readingClose || 0) -
      Number(readingOpen || 0)

    await supabase
      .from('operator_readings')
      .insert({
        company_id: companyId,
        meter_id:
          selectedReadingMeter || null,
        segment_id:
          selectedReadingSegment || null,
        opening_reading:
          Number(readingOpen || 0),
        closing_reading:
          Number(readingClose || 0),
        indicated_volume: iv,
        api_gravity:
          Number(readingGravity || 0),
        temperature:
          Number(readingTemp || 0),
        bsw: Number(readingBSW || 0),
        meter_factor:
          Number(readingMF || 0),
      })

    setReadingOpen('')
    setReadingClose('')
    setReadingGravity('')
    setReadingTemp('')
    setReadingBSW('')
    setReadingMF('')

    loadAll()
  }

  async function createTicket() {
    if (!ticketNumber || !companyId) return

    const producer = producers.find(
      (p) => p.id === selectedProducer
    )

    const profile = profiles.find(
      (p) =>
        p.id === producer?.calculation_profile_id
    )

    await supabase.from('tickets').insert({
      company_id: companyId,
      ticket_number: ticketNumber,
      ticket_type: ticketType,
      status: 'draft',
      producer_id:
        selectedProducer || null,
      segment_id:
        selectedSegment || null,
      tank_id: selectedTank || null,
      meter_id: selectedMeter || null,
      calculation_profile_snapshot:
        profile || {},
    })

    setTicketNumber('')
    loadAll()
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const box = {
    background: '#0f172a',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  }

  const input = {
    width: '100%',
    padding: 12,
    marginTop: 10,
    color: 'black',
    background: 'white',
    borderRadius: 6,
    border: 'none',
  }

  const button = {
    width: '100%',
    padding: 12,
    marginTop: 10,
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          color: 'white',
        }}
      >
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
      <aside
        style={{
          width: 220,
          background: '#0f172a',
          padding: 20,
        }}
      >
        <h2>TEFCO V2</h2>

        {[
          'dashboard',
          'producers',
          'segments',
          'tanks',
          'meters',
          'readings',
          'tickets',
        ].map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            style={button}
          >
            {p.toUpperCase()}
          </button>
        ))}

        <button
          onClick={logout}
          style={{
            ...button,
            background: '#dc2626',
            marginTop: 30,
          }}
        >
          Logout
        </button>
      </aside>

      <main
        style={{
          flex: 1,
          padding: 30,
        }}
      >
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(6, 1fr)',
                gap: 20,
              }}
            >
              <div style={box}>
                Producers
                <h2>{producers.length}</h2>
              </div>

              <div style={box}>
                Segments
                <h2>{segments.length}</h2>
              </div>

              <div style={box}>
                Tanks
                <h2>{tanks.length}</h2>
              </div>

              <div style={box}>
                Meters
                <h2>{meters.length}</h2>
              </div>

              <div style={box}>
                Readings
                <h2>{readings.length}</h2>
              </div>

              <div style={box}>
                Tickets
                <h2>{tickets.length}</h2>
              </div>
            </div>
          </>
        )}

        {page === 'producers' && (
          <>
            <h1>
              Producers / Calculation Profiles
            </h1>

            <div style={box}>
              <input
                style={input}
                placeholder="Producer Name"
                value={newProducer}
                onChange={(e) =>
                  setNewProducer(
                    e.target.value
                  )
                }
              />

              <select
                style={input}
                value={newProducerProfile}
                onChange={(e) =>
                  setNewProducerProfile(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select API Chapter
                </option>

                {profiles.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                style={button}
                onClick={addProducer}
              >
                Add Producer
              </button>
            </div>

            {producers.map((producer) => (
              <div
                key={producer.id}
                style={box}
              >
                <h3>{producer.name}</h3>
              </div>
            ))}
          </>
        )}

        {page === 'segments' && (
          <>
            <h1>Segments</h1>

            <div style={box}>
              <input
                style={input}
                placeholder="New Segment"
                value={newSegment}
                onChange={(e) =>
                  setNewSegment(
                    e.target.value
                  )
                }
              />

              <button
                style={button}
                onClick={addSegment}
              >
                Add Segment
              </button>
            </div>

            {segments.map((s) => (
              <div key={s.id} style={box}>
                {s.name}
              </div>
            ))}
          </>
        )}

        {page === 'tanks' && (
          <>
            <h1>Tanks</h1>

            <div style={box}>
              <input
                style={input}
                placeholder="Tank Number"
                value={newTank}
                onChange={(e) =>
                  setNewTank(
                    e.target.value
                  )
                }
              />

              <button
                style={button}
                onClick={addTank}
              >
                Add Tank
              </button>
            </div>

            {tanks.map((t) => (
              <div key={t.id} style={box}>
                Tank {t.tank_number}
              </div>
            ))}
          </>
        )}

        {page === 'meters' && (
          <>
            <h1>Meters</h1>

            <div style={box}>
              <input
                style={input}
                placeholder="Meter Number"
                value={newMeter}
                onChange={(e) =>
                  setNewMeter(
                    e.target.value
                  )
                }
              />

              <button
                style={button}
                onClick={addMeter}
              >
                Add Meter
              </button>
            </div>

            {meters.map((m) => (
              <div key={m.id} style={box}>
                Meter {m.meter_number}
              </div>
            ))}
          </>
        )}

        {page === 'readings' && (
          <>
            <h1>Operator Readings</h1>

            <div style={box}>
              <h3>New Reading</h3>

              <select
                style={input}
                value={selectedReadingMeter}
                onChange={(e) =>
                  setSelectedReadingMeter(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Meter
                </option>

                {meters.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                  >
                    Meter {m.meter_number}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={
                  selectedReadingSegment
                }
                onChange={(e) =>
                  setSelectedReadingSegment(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Segment
                </option>

                {segments.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                  >
                    {s.name}
                  </option>
                ))}
              </select>

              <input
                style={input}
                placeholder="Opening Reading"
                value={readingOpen}
                onChange={(e) =>
                  setReadingOpen(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Closing Reading"
                value={readingClose}
                onChange={(e) =>
                  setReadingClose(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="API Gravity"
                value={readingGravity}
                onChange={(e) =>
                  setReadingGravity(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Temperature"
                value={readingTemp}
                onChange={(e) =>
                  setReadingTemp(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="BS&W %"
                value={readingBSW}
                onChange={(e) =>
                  setReadingBSW(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Meter Factor"
                value={readingMF}
                onChange={(e) =>
                  setReadingMF(
                    e.target.value
                  )
                }
              />

              <div
                style={{
                  marginTop: 15,
                }}
              >
                IV:
                {' '}
                {(
                  Number(
                    readingClose || 0
                  ) -
                  Number(
                    readingOpen || 0
                  )
                ).toFixed(2)}
              </div>

              <button
                style={button}
                onClick={saveReading}
              >
                Save Reading
              </button>
            </div>

            <div style={box}>
              <h3>
                Recent Readings
              </h3>

              {readings.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background:
                      '#1e293b',
                    padding: 15,
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <strong>
                      IV:
                    </strong>
                    {' '}
                    {
                      r.indicated_volume
                    }
                  </div>

                  <div>
                    Gravity:
                    {' '}
                    {
                      r.api_gravity
                    }
                  </div>

                  <div>
                    Temp:
                    {' '}
                    {
                      r.temperature
                    }
                  </div>

                  <div>
                    MF:
                    {' '}
                    {
                      r.meter_factor
                    }
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'tickets' && (
          <>
            <h1>Ticket Engine</h1>

            <div style={box}>
              <h3>
                Create Draft Ticket
              </h3>

              <input
                style={input}
                placeholder="Ticket Number"
                value={ticketNumber}
                onChange={(e) =>
                  setTicketNumber(
                    e.target.value
                  )
                }
              />

              <select
                style={input}
                value={selectedProducer}
                onChange={(e) =>
                  setSelectedProducer(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Producer
                </option>

                {producers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={ticketType}
                onChange={(e) =>
                  setTicketType(
                    e.target.value
                  )
                }
              >
                <option value="tank">
                  Tank Ticket
                </option>

                <option value="meter">
                  Meter Ticket
                </option>

                <option value="truck">
                  Truck Ticket
                </option>
              </select>

              <button
                style={button}
                onClick={createTicket}
              >
                Save Draft Ticket
              </button>
            </div>

            <div style={box}>
              <h3>
                Workflow Queue
              </h3>

              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background:
                      '#1e293b',
                    padding: 20,
                    borderRadius: 10,
                    marginBottom: 15,
                  }}
                >
                  <strong>
                    {t.ticket_number}
                  </strong>

                  <div>
                    Type:
                    {' '}
                    {t.ticket_type}
                  </div>

                  <div>
                    Status:
                    {' '}
                    {t.status}
                  </div>

                  <div>
                    Profile:
                    {' '}
                    {t
                      .calculation_profile_snapshot
                      ?.name ||
                      'None'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
