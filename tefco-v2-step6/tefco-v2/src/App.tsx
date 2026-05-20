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

type Ticket = {
  id: string
  ticket_number: string
  ticket_type: string
  status: string
}

export default function App() {
  const [session, setSession] = useState<any>(null)

  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])

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
    loadSegments()
    loadTanks()
    loadMeters()
    loadTickets()
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

  async function loadTickets() {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setTickets(data)
  }

  async function createTicket() {
    if (!ticketNumber) return

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .single()

    if (!companyUser) return

    await supabase.from('tickets').insert({
      company_id: companyUser.company_id,
      ticket_number: ticketNumber,
      ticket_type: ticketType,
      status: 'draft',
      segment_id: selectedSegment || null,
      tank_id: selectedTank || null,
      meter_id: selectedMeter || null,
    })

    setTicketNumber('')
    loadTickets()
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
        <h1>Ticket Engine</h1>

        <div
          style={{
            background: '#1e293b',
            padding: 20,
            borderRadius: 10,
            marginTop: 20,
          }}
        >
          <h2>Create Ticket</h2>

          <input
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            placeholder="Ticket Number"
            style={{
              width: '100%',
              padding: 10,
              marginTop: 10,
            }}
          />

          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              marginTop: 10,
            }}
          >
            <option value="tank">Tank Ticket</option>
            <option value="meter">Meter Ticket</option>
            <option value="truck">Truck Ticket</option>
            <option value="plains_style">Plains Style</option>
          </select>

          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              marginTop: 10,
            }}
          >
            <option value="">Select Segment</option>

            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTank}
            onChange={(e) => setSelectedTank(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              marginTop: 10,
            }}
          >
            <option value="">Select Tank</option>

            {tanks.map((tank) => (
              <option key={tank.id} value={tank.id}>
                Tank {tank.tank_number}
              </option>
            ))}
          </select>

          <select
            value={selectedMeter}
            onChange={(e) => setSelectedMeter(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              marginTop: 10,
            }}
          >
            <option value="">Select Meter</option>

            {meters.map((meter) => (
              <option key={meter.id} value={meter.id}>
                Meter {meter.meter_number}
              </option>
            ))}
          </select>

          <button
            onClick={createTicket}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 15,
            }}
          >
            Save Draft Ticket
          </button>
        </div>

        <div style={{ marginTop: 40 }}>
          <h2>Draft Tickets</h2>

          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              style={{
                background: '#1e293b',
                padding: 15,
                borderRadius: 8,
                marginTop: 10,
              }}
            >
              <div>
                <strong>{ticket.ticket_number}</strong>
              </div>

              <div>
                Type: {ticket.ticket_type}
              </div>

              <div>
                Status: {ticket.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
