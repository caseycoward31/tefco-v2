import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Segment = { id: string; name: string }
type Tank = { id: string; tank_number: string }
type Meter = { id: string; meter_number: string }

type Ticket = {
  id: string
  ticket_number: string
  ticket_type: string
  status: string
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState('dashboard')
  const [companyId, setCompanyId] = useState('')

  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const [newSegment, setNewSegment] = useState('')
  const [newTank, setNewTank] = useState('')
  const [newMeter, setNewMeter] = useState('')

  const [ticketNumber, setTicketNumber] = useState('')
  const [ticketType, setTicketType] = useState('tank')

  const [selectedSegment, setSelectedSegment] = useState('')
  const [selectedTank, setSelectedTank] = useState('')
  const [selectedMeter, setSelectedMeter] = useState('')

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
      .order('created_at', { ascending: false })

    if (segs) setSegments(segs)
    if (tankData) setTanks(tankData)
    if (meterData) setMeters(meterData)
    if (ticketData) setTickets(ticketData)
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

  async function createTicket() {
    if (!ticketNumber || !companyId) return

    await supabase.from('tickets').insert({
      company_id: companyId,
      ticket_number: ticketNumber,
      ticket_type: ticketType,
      status: 'draft',
      segment_id: selectedSegment || null,
      tank_id: selectedTank || null,
      meter_id: selectedMeter || null,
    })

    setTicketNumber('')
    loadAll()
  }

  async function updateTicketStatus(
    ticketId: string,
    status: string
  ) {
    await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId)

    loadAll()
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  function statusColor(status: string) {
    if (status === 'approved') return '#16a34a'
    if (status === 'submitted') return '#f59e0b'
    if (status === 'voided') return '#dc2626'
    return '#475569'
  }

  const box = {
    background: '#1e293b',
    padding: 20,
    borderRadius: 10,
    marginTop: 20,
  }

  const input = {
    width: '100%',
    padding: 10,
    marginTop: 10,
  }

  const button = {
    width: '100%',
    padding: 10,
    marginTop: 10,
    cursor: 'pointer',
  }

  if (loading) {
    return (
      <div style={{ color: 'white', padding: 40 }}>
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
          width: 240,
          background: '#0f172a',
          padding: 20,
        }}
      >
        <h2>TEFCO V2</h2>

        <p style={{ color: '#94a3b8' }}>
          Measurement Platform
        </p>

        {[
          'dashboard',
          'segments',
          'tanks',
          'meters',
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
            marginTop: 30,
          }}
        >
          Logout
        </button>
      </aside>

      <main style={{ flex: 1, padding: 30 }}>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr 1fr 1fr',
                gap: 20,
              }}
            >
              <div style={box}>
                Segments:
                <h2>{segments.length}</h2>
              </div>

              <div style={box}>
                Tanks:
                <h2>{tanks.length}</h2>
              </div>

              <div style={box}>
                Meters:
                <h2>{meters.length}</h2>
              </div>

              <div style={box}>
                Tickets:
                <h2>{tickets.length}</h2>
              </div>
            </div>
          </>
        )}

        {page === 'segments' && (
          <>
            <h1>Segments</h1>

            <div style={box}>
              <input
                style={input}
                value={newSegment}
                onChange={(e) =>
                  setNewSegment(e.target.value)
                }
                placeholder="New Segment"
              />

              <button
                style={button}
                onClick={addSegment}
              >
                Add Segment
              </button>

              {segments.map((s) => (
                <div key={s.id} style={box}>
                  {s.name}
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'tanks' && (
          <>
            <h1>Tanks</h1>

            <div style={box}>
              <input
                style={input}
                value={newTank}
                onChange={(e) =>
                  setNewTank(e.target.value)
                }
                placeholder="Tank Number"
              />

              <button
                style={button}
                onClick={addTank}
              >
                Add Tank
              </button>

              {tanks.map((t) => (
                <div key={t.id} style={box}>
                  Tank {t.tank_number}
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'meters' && (
          <>
            <h1>Meters</h1>

            <div style={box}>
              <input
                style={input}
                value={newMeter}
                onChange={(e) =>
                  setNewMeter(e.target.value)
                }
                placeholder="Meter Number"
              />

              <button
                style={button}
                onClick={addMeter}
              >
                Add Meter
              </button>

              {meters.map((m) => (
                <div key={m.id} style={box}>
                  Meter {m.meter_number}
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'tickets' && (
          <>
            <h1>Tickets</h1>

            <div style={box}>
              <h2>Create Draft Ticket</h2>

              <input
                style={input}
                value={ticketNumber}
                onChange={(e) =>
                  setTicketNumber(e.target.value)
                }
                placeholder="Ticket Number"
              />

              <select
                style={input}
                value={ticketType}
                onChange={(e) =>
                  setTicketType(e.target.value)
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

                <option value="plains_style">
                  Plains Style
                </option>
              </select>

              <select
                style={input}
                value={selectedSegment}
                onChange={(e) =>
                  setSelectedSegment(
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

              <select
                style={input}
                value={selectedTank}
                onChange={(e) =>
                  setSelectedTank(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Tank
                </option>

                {tanks.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                  >
                    Tank {t.tank_number}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={selectedMeter}
                onChange={(e) =>
                  setSelectedMeter(
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

              <button
                style={button}
                onClick={createTicket}
              >
                Save Draft Ticket
              </button>
            </div>

            <div style={box}>
              <h2>Workflow Queue</h2>

              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    ...box,
                    borderLeft:
                      '8px solid ' +
                      statusColor(t.status),
                  }}
                >
                  <strong>
                    {t.ticket_number}
                  </strong>

                  <div>
                    Type: {t.ticket_type}
                  </div>

                  <div>
                    Status: {t.status}
                  </div>

                  <button
                    style={button}
                    onClick={() =>
                      setSelectedTicket(t)
                    }
                  >
                    Open Ticket
                  </button>
                </div>
              ))}
            </div>

            {selectedTicket && (
              <div style={box}>
                <h2>
                  Ticket Detail
                </h2>

                <div>
                  Ticket:
                  {' '}
                  {selectedTicket.ticket_number}
                </div>

                <div>
                  Type:
                  {' '}
                  {selectedTicket.ticket_type}
                </div>

                <div>
                  Status:
                  {' '}
                  {selectedTicket.status}
                </div>

                <button
                  style={button}
                  onClick={() =>
                    updateTicketStatus(
                      selectedTicket.id,
                      'submitted'
                    )
                  }
                >
                  Submit Ticket
                </button>

                <button
                  style={button}
                  onClick={() =>
                    updateTicketStatus(
                      selectedTicket.id,
                      'approved'
                    )
                  }
                >
                  Approve Ticket
                </button>

                <button
                  style={button}
                  onClick={() =>
                    updateTicketStatus(
                      selectedTicket.id,
                      'draft'
                    )
                  }
                >
                  Reject to Draft
                </button>

                <button
                  style={button}
                  onClick={() =>
                    updateTicketStatus(
                      selectedTicket.id,
                      'voided'
                    )
                  }
                >
                  Void Ticket
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
