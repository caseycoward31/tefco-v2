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
  observed_inputs?: any
  calculation_results?: any
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

    if (cu) setCompanyId(cu.company_id)

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

  async function updateTicketStatus(ticketId: string, status: string) {
    await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId)

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
    return <div style={{ padding: 40, color: 'white' }}>Loading...</div>
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

        {['dashboard', 'segments', 'tanks', 'meters', 'tickets'].map(
          (p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={button}
            >
              {p.toUpperCase()}
            </button>
          )
        )}

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

      <main style={{ flex: 1, padding: 30 }}>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: 20,
              }}
            >
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
                Tickets
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
                placeholder="New Segment"
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value)}
              />

              <button style={button} onClick={addSegment}>
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
                onChange={(e) => setNewTank(e.target.value)}
              />

              <button style={button} onClick={addTank}>
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
                onChange={(e) => setNewMeter(e.target.value)}
              />

              <button style={button} onClick={addMeter}>
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

        {page === 'tickets' && (
          <>
            <h1>Ticket Engine</h1>

            <div style={box}>
              <h3>Create Draft Ticket</h3>

              <input
                style={input}
                placeholder="Ticket Number"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
              />

              <select
                style={input}
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
              >
                <option value="tank">Tank Ticket</option>
                <option value="meter">Meter Ticket</option>
                <option value="truck">Truck Ticket</option>
                <option value="plains_style">Plains Style</option>
              </select>

              <select
                style={input}
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
              >
                <option value="">Select Segment</option>

                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={selectedTank}
                onChange={(e) => setSelectedTank(e.target.value)}
              >
                <option value="">Select Tank</option>

                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tank {t.tank_number}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={selectedMeter}
                onChange={(e) => setSelectedMeter(e.target.value)}
              >
                <option value="">Select Meter</option>

                {meters.map((m) => (
                  <option key={m.id} value={m.id}>
                    Meter {m.meter_number}
                  </option>
                ))}
              </select>

              <button style={button} onClick={createTicket}>
                Save Draft Ticket
              </button>
            </div>

            <div style={box}>
              <h3>Workflow Queue</h3>

              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: '#1e293b',
                    padding: 20,
                    borderRadius: 10,
                    marginBottom: 15,
                  }}
                >
                  <div>
                    <strong>{t.ticket_number}</strong>
                  </div>

                  <div>Type: {t.ticket_type}</div>
                  <div>Status: {t.status}</div>

                  <button
                    style={button}
                    onClick={() => setSelectedTicket(t)}
                  >
                    Open Ticket
                  </button>
                </div>
              ))}
            </div>

            {selectedTicket && (
              <div style={box}>
                <h2>Ticket Detail</h2>

                <div>
                  <strong>Ticket:</strong>{' '}
                  {selectedTicket.ticket_number}
                </div>

                <div style={{ marginTop: 10 }}>
                  <strong>Type:</strong>{' '}
                  {selectedTicket.ticket_type}
                </div>

                <div style={{ marginTop: 10 }}>
                  <strong>Status:</strong>{' '}
                  {selectedTicket.status}
                </div>

                <hr style={{ margin: '20px 0' }} />

                <CalculationSection
                  ticket={selectedTicket}
                  refresh={loadAll}
                />

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
                  style={{
                    ...button,
                    background: '#dc2626',
                  }}
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

function CalculationSection({ ticket, refresh }: any) {
  const existingInputs = ticket.observed_inputs || {}

  const [iv, setIv] = useState(existingInputs.iv || '')
  const [ctl, setCtl] = useState(existingInputs.ctl || '')
  const [cpl, setCpl] = useState(existingInputs.cpl || '')
  const [mf, setMf] = useState(existingInputs.mf || '')
  const [bsw, setBsw] = useState(existingInputs.bsw || '')

  const gsv =
    Number(iv || 0) *
    Number(ctl || 0) *
    Number(cpl || 0) *
    Number(mf || 0)

  const nsv =
    gsv * (1 - Number(bsw || 0) / 100)

  async function saveCalculations() {
    await supabase
      .from('tickets')
      .update({
        observed_inputs: {
          iv,
          ctl,
          cpl,
          mf,
          bsw,
        },
        calculation_results: {
          gsv,
          nsv,
        },
      })
      .eq('id', ticket.id)

    alert('Calculations Saved')

    refresh()
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

  return (
    <div
      style={{
        background: '#1e293b',
        padding: 20,
        borderRadius: 10,
        marginTop: 20,
      }}
    >
      <h3>Calculation Engine</h3>

      <input
        style={input}
        placeholder="IV"
        value={iv}
        onChange={(e) => setIv(e.target.value)}
      />

      <input
        style={input}
        placeholder="CTL"
        value={ctl}
        onChange={(e) => setCtl(e.target.value)}
      />

      <input
        style={input}
        placeholder="CPL"
        value={cpl}
        onChange={(e) => setCpl(e.target.value)}
      />

      <input
        style={input}
        placeholder="MF"
        value={mf}
        onChange={(e) => setMf(e.target.value)}
      />

      <input
        style={input}
        placeholder="BS&W %"
        value={bsw}
        onChange={(e) => setBsw(e.target.value)}
      />

      <div style={{ marginTop: 20 }}>
        <div>IV × CTL × CPL × MF = GSV</div>
        <div style={{ marginTop: 10 }}>
          GSV × (1 - BS&W%) = NSV
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div>
          <strong>GSV:</strong>{' '}
          {isNaN(gsv) ? '0.00' : gsv.toFixed(2)}
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>NSV:</strong>{' '}
          {isNaN(nsv) ? '0.00' : nsv.toFixed(2)}
        </div>
      </div>

      <button
        style={button}
        onClick={saveCalculations}
      >
        Save Calculations
      </button>
    </div>
  )
}
