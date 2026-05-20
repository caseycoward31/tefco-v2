import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Area = { id: string; name: string }
type Segment = { id: string; name: string }
type Lease = { id: string; lease_name: string; lease_number?: string }
type Meter = {
  id: string
  meter_number: string
  meter_name?: string
  area_id?: string
  lease_id?: string
  producer_id?: string
}
type Profile = { id: string; name: string; standard: string; version: string }
type Producer = { id: string; name: string; calculation_profile_id?: string | null }
type Ticket = {
  id: string
  ticket_number: string
  ticket_type: string
  status: string
  producer_id?: string | null
  meter_id?: string | null
  segment_id?: string | null
  tank_id?: string | null
  observed_inputs?: any
  calculation_results?: any
  calculation_profile_snapshot?: any
  approved_by?: string | null
  approved_at?: string | null
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState('dashboard')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(true)

  const [areas, setAreas] = useState<Area[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [readings, setReadings] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const [newArea, setNewArea] = useState('')
  const [newSegment, setNewSegment] = useState('')
  const [newLeaseName, setNewLeaseName] = useState('')
  const [newLeaseNumber, setNewLeaseNumber] = useState('')
  const [newMeter, setNewMeter] = useState('')
  const [newMeterName, setNewMeterName] = useState('')
  const [newProducer, setNewProducer] = useState('')
  const [newProducerProfile, setNewProducerProfile] = useState('')

  const [selectedArea, setSelectedArea] = useState('')
  const [selectedSegment, setSelectedSegment] = useState('')
  const [selectedLease, setSelectedLease] = useState('')
  const [selectedProducer, setSelectedProducer] = useState('')
  const [selectedMeter, setSelectedMeter] = useState('')
  const [ticketType, setTicketType] = useState('meter')
  const [autofillPreview, setAutofillPreview] = useState<any>(null)

  const [selectedReadingMeter, setSelectedReadingMeter] = useState('')
  const [selectedReadingSegment, setSelectedReadingSegment] = useState('')
  const [readingOpen, setReadingOpen] = useState('')
  const [readingClose, setReadingClose] = useState('')
  const [readingGravity, setReadingGravity] = useState('')
  const [readingTemp, setReadingTemp] = useState('')
  const [readingBSW, setReadingBSW] = useState('')
  const [readingMF, setReadingMF] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) loadAll()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadAll()
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const latestReading = readings.find((r) => r.meter_id === selectedMeter)
    const producer = producers.find((p) => p.id === selectedProducer)
    const profile = profiles.find((p) => p.id === producer?.calculation_profile_id)

    setAutofillPreview({
      reading: latestReading || null,
      producer: producer || null,
      profile: profile || null,
    })
  }, [selectedMeter, selectedProducer, readings, producers, profiles])

  async function loadAll() {
    const { data: cu } = await supabase.from('company_users').select('company_id').single()
    if (cu) setCompanyId(cu.company_id)

    const { data: areaData } = await supabase.from('areas').select('*').order('name')
    const { data: segData } = await supabase.from('segments').select('*').order('name')
    const { data: leaseData } = await supabase.from('leases').select('*').order('lease_name')
    const { data: meterData } = await supabase.from('meters').select('*').order('meter_number')
    const { data: ticketData } = await supabase.from('tickets').select('*').order('created_at', { ascending: false })
    const { data: profileData } = await supabase.from('calculation_profiles').select('*').order('name')
    const { data: producerData } = await supabase.from('producers').select('*').order('name')
    const { data: readingData } = await supabase.from('operator_readings').select('*').order('created_at', { ascending: false })

    if (areaData) setAreas(areaData)
    if (segData) setSegments(segData)
    if (leaseData) setLeases(leaseData)
    if (meterData) setMeters(meterData)
    if (ticketData) setTickets(ticketData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
  }

  async function addArea() {
    if (!newArea || !companyId) return
    await supabase.from('areas').insert({ company_id: companyId, name: newArea })
    setNewArea('')
    loadAll()
  }

  async function addSegment() {
    if (!newSegment || !companyId) return
    await supabase.from('segments').insert({ company_id: companyId, name: newSegment })
    setNewSegment('')
    loadAll()
  }

  async function addProducer() {
    if (!newProducer || !companyId) return
    await supabase.from('producers').insert({
      company_id: companyId,
      name: newProducer,
      calculation_profile_id: newProducerProfile || null,
    })
    setNewProducer('')
    setNewProducerProfile('')
    loadAll()
  }

  async function addLease() {
    if (!newLeaseName || !companyId) return
    await supabase.from('leases').insert({
      company_id: companyId,
      area_id: selectedArea || null,
      segment_id: selectedSegment || null,
      producer_id: selectedProducer || null,
      lease_name: newLeaseName,
      lease_number: newLeaseNumber,
    })
    setNewLeaseName('')
    setNewLeaseNumber('')
    loadAll()
  }

  async function addMeter() {
    if (!newMeter || !companyId) return
    await supabase.from('meters').insert({
      company_id: companyId,
      meter_number: newMeter,
      meter_name: newMeterName,
      area_id: selectedArea || null,
      lease_id: selectedLease || null,
      producer_id: selectedProducer || null,
    })
    setNewMeter('')
    setNewMeterName('')
    loadAll()
  }

  async function saveReading() {
    if (!companyId) return

    const iv = Number(readingClose || 0) - Number(readingOpen || 0)

    await supabase.from('operator_readings').insert({
      company_id: companyId,
      meter_id: selectedReadingMeter || null,
      segment_id: selectedReadingSegment || null,
      opening_reading: Number(readingOpen || 0),
      closing_reading: Number(readingClose || 0),
      indicated_volume: iv,
      api_gravity: Number(readingGravity || 0),
      temperature: Number(readingTemp || 0),
      bsw: Number(readingBSW || 0),
      meter_factor: Number(readingMF || 0),
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
    if (!companyId) return

    const { data: generatedNumber, error } = await supabase.rpc('generate_ticket_number', {
      p_company_id: companyId,
    })

    if (error || !generatedNumber) {
      alert('Could not generate ticket number.')
      return
    }

    const producer = producers.find((p) => p.id === selectedProducer)
    const profile = profiles.find((p) => p.id === producer?.calculation_profile_id)
    const latestReading = readings.find((r) => r.meter_id === selectedMeter)

    const iv = Number(latestReading?.indicated_volume || 0)
    const ctl = 1
    const cpl = 1
    const ctlp = 1
    const mf = Number(latestReading?.meter_factor || 1)
    const csw = 1 - Number(latestReading?.bsw || 0) / 100
    const isApi12 = profile?.standard === 'API 12'
    const ccf = ctl * ctlp * mf
    const gsv = isApi12 ? iv * ctl * cpl * mf : iv * ccf
    const nsv = gsv * csw

    await supabase.from('tickets').insert({
      company_id: companyId,
      ticket_number: generatedNumber,
      ticket_type: ticketType,
      status: 'draft',
      producer_id: selectedProducer || null,
      segment_id: selectedSegment || latestReading?.segment_id || null,
      meter_id: selectedMeter || null,
      linked_reading_id: latestReading?.id || null,
      calculation_profile_id: profile?.id || null,
      calculation_profile_snapshot: profile || {},
      observed_inputs: {
        iv,
        ctl,
        cpl,
        ctlp,
        mf,
        csw,
        api_gravity: latestReading?.api_gravity || null,
        temperature: latestReading?.temperature || null,
        bsw_percent: latestReading?.bsw || null,
        source: 'autofill_from_latest_reading',
      },
      calculation_results: {
        ccf,
        gsv,
        nsv,
        formula_profile: isApi12 ? 'API 12 2021' : 'API 11.1',
      },
    })

    alert(`Draft ticket created: ${generatedNumber}`)
    loadAll()
  }

  async function updateTicketStatus(ticket: Ticket, status: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id

    const updateData: any = { status }

    if (status === 'approved') {
      updateData.approved_by = userId
      updateData.approved_at = new Date().toISOString()
    }

    await supabase.from('tickets').update(updateData).eq('id', ticket.id)

    await supabase.from('audit_logs').insert({
      company_id: companyId,
      user_id: userId,
      action: `ticket_status_changed_to_${status}`,
      entity_type: 'ticket',
      entity_id: ticket.id,
      before_data: ticket,
      after_data: updateData,
    })

    setSelectedTicket({ ...ticket, ...updateData })
    loadAll()
  }

  function generatePdfPreview(ticket: Ticket) {
    const producer = producers.find((p) => p.id === ticket.producer_id)
    const meter = meters.find((m) => m.id === ticket.meter_id)
    const segment = segments.find((s) => s.id === ticket.segment_id)

    const html = `
      <html>
        <head>
          <title>${ticket.ticket_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
            h1 { margin-bottom: 4px; }
            .box { border: 1px solid #333; padding: 12px; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 6px 0; }
          </style>
        </head>
        <body>
          <h1>TEFCO Measurement Ticket</h1>
          <h2>${ticket.ticket_number}</h2>

          <div class="box">
            <div class="row"><strong>Status</strong><span>${ticket.status}</span></div>
            <div class="row"><strong>Type</strong><span>${ticket.ticket_type}</span></div>
            <div class="row"><strong>Producer</strong><span>${producer?.name || ''}</span></div>
            <div class="row"><strong>Meter</strong><span>${meter?.meter_number || ''}</span></div>
            <div class="row"><strong>Segment</strong><span>${segment?.name || ''}</span></div>
            <div class="row"><strong>Profile</strong><span>${ticket.calculation_profile_snapshot?.name || ''}</span></div>
          </div>

          <div class="box">
            <h3>Inputs</h3>
            <div class="row"><strong>IV</strong><span>${ticket.observed_inputs?.iv ?? ''}</span></div>
            <div class="row"><strong>CTL</strong><span>${ticket.observed_inputs?.ctl ?? ''}</span></div>
            <div class="row"><strong>CPL</strong><span>${ticket.observed_inputs?.cpl ?? ''}</span></div>
            <div class="row"><strong>CTLP</strong><span>${ticket.observed_inputs?.ctlp ?? ''}</span></div>
            <div class="row"><strong>MF</strong><span>${ticket.observed_inputs?.mf ?? ''}</span></div>
            <div class="row"><strong>CSW</strong><span>${ticket.observed_inputs?.csw ?? ''}</span></div>
          </div>

          <div class="box">
            <h3>Results</h3>
            <div class="row"><strong>GSV</strong><span>${ticket.calculation_results?.gsv ?? ''}</span></div>
            <div class="row"><strong>NSV</strong><span>${ticket.calculation_results?.nsv ?? ''}</span></div>
          </div>

          <p>Generated preview. Formal PDF storage will be added next.</p>
          <script>window.print()</script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const box: CSSProperties = { background: '#0f172a', padding: 20, borderRadius: 10, marginBottom: 20 }
  const card: CSSProperties = { background: '#1e293b', padding: 15, borderRadius: 10, marginBottom: 10 }
  const input: CSSProperties = { width: '100%', padding: 12, marginTop: 10, color: 'black', background: 'white', borderRadius: 6, border: 'none' }
  const button: CSSProperties = { width: '100%', padding: 12, marginTop: 10, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }

  if (loading) return <div style={{ padding: 40, color: 'white' }}>Loading...</div>
  if (!session) return <Login />

  return (
    <div style={{ background: '#020617', color: 'white', minHeight: '100vh', display: 'flex' }}>
      <aside style={{ width: 220, background: '#0f172a', padding: 20 }}>
        <h2>TEFCO V2</h2>
        {['dashboard', 'areas', 'segments', 'leases', 'producers', 'meters', 'readings', 'tickets'].map((p) => (
          <button key={p} onClick={() => setPage(p)} style={button}>{p.toUpperCase()}</button>
        ))}
        <button onClick={logout} style={{ ...button, background: '#dc2626', marginTop: 30 }}>Logout</button>
      </aside>

      <main style={{ flex: 1, padding: 30 }}>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 20 }}>
              <div style={box}>Areas<h2>{areas.length}</h2></div>
              <div style={box}>Segments<h2>{segments.length}</h2></div>
              <div style={box}>Leases<h2>{leases.length}</h2></div>
              <div style={box}>Producers<h2>{producers.length}</h2></div>
              <div style={box}>Meters<h2>{meters.length}</h2></div>
              <div style={box}>Readings<h2>{readings.length}</h2></div>
              <div style={box}>Tickets<h2>{tickets.length}</h2></div>
            </div>
          </>
        )}

        {page === 'areas' && (
          <>
            <h1>Areas</h1>
            <div style={box}>
              <input style={input} placeholder="Area Name" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
              <button style={button} onClick={addArea}>Add Area</button>
            </div>
            {areas.map((a) => <div key={a.id} style={box}>{a.name}</div>)}
          </>
        )}

        {page === 'segments' && (
          <>
            <h1>Segments</h1>
            <div style={box}>
              <input style={input} placeholder="Segment Name" value={newSegment} onChange={(e) => setNewSegment(e.target.value)} />
              <button style={button} onClick={addSegment}>Add Segment</button>
            </div>
            {segments.map((s) => <div key={s.id} style={box}>{s.name}</div>)}
          </>
        )}

        {page === 'producers' && (
          <>
            <h1>Producers</h1>
            <div style={box}>
              <input style={input} placeholder="Producer Name" value={newProducer} onChange={(e) => setNewProducer(e.target.value)} />
              <select style={input} value={newProducerProfile} onChange={(e) => setNewProducerProfile(e.target.value)}>
                <option value="">Select API Chapter</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button style={button} onClick={addProducer}>Add Producer</button>
            </div>
            {producers.map((p) => <div key={p.id} style={box}>{p.name}</div>)}
          </>
        )}

        {page === 'leases' && (
          <>
            <h1>Leases</h1>
            <div style={box}>
              <input style={input} placeholder="Lease Name" value={newLeaseName} onChange={(e) => setNewLeaseName(e.target.value)} />
              <input style={input} placeholder="Lease Number" value={newLeaseNumber} onChange={(e) => setNewLeaseNumber(e.target.value)} />
              <select style={input} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                <option value="">Select Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select style={input} value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)}>
                <option value="">Select Segment</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select style={input} value={selectedProducer} onChange={(e) => setSelectedProducer(e.target.value)}>
                <option value="">Select Producer</option>
                {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button style={button} onClick={addLease}>Add Lease</button>
            </div>
            {leases.map((l) => <div key={l.id} style={box}><strong>{l.lease_name}</strong><div>{l.lease_number}</div></div>)}
          </>
        )}

        {page === 'meters' && (
          <>
            <h1>Master Meter List</h1>
            <div style={box}>
              <input style={input} placeholder="Meter Number" value={newMeter} onChange={(e) => setNewMeter(e.target.value)} />
              <input style={input} placeholder="Meter Name" value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} />
              <select style={input} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                <option value="">Select Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select style={input} value={selectedLease} onChange={(e) => setSelectedLease(e.target.value)}>
                <option value="">Select Lease</option>
                {leases.map((l) => <option key={l.id} value={l.id}>{l.lease_name}</option>)}
              </select>
              <select style={input} value={selectedProducer} onChange={(e) => setSelectedProducer(e.target.value)}>
                <option value="">Select Producer</option>
                {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button style={button} onClick={addMeter}>Add Meter</button>
            </div>
            {meters.map((m) => <div key={m.id} style={box}><strong>{m.meter_number}</strong><div>{m.meter_name}</div></div>)}
          </>
        )}

        {page === 'readings' && (
          <>
            <h1>Operator Readings</h1>
            <div style={box}>
              <select style={input} value={selectedReadingMeter} onChange={(e) => setSelectedReadingMeter(e.target.value)}>
                <option value="">Select Meter</option>
                {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}</option>)}
              </select>
              <select style={input} value={selectedReadingSegment} onChange={(e) => setSelectedReadingSegment(e.target.value)}>
                <option value="">Select Segment</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input style={input} placeholder="Opening Reading" value={readingOpen} onChange={(e) => setReadingOpen(e.target.value)} />
              <input style={input} placeholder="Closing Reading" value={readingClose} onChange={(e) => setReadingClose(e.target.value)} />
              <input style={input} placeholder="API Gravity" value={readingGravity} onChange={(e) => setReadingGravity(e.target.value)} />
              <input style={input} placeholder="Temperature" value={readingTemp} onChange={(e) => setReadingTemp(e.target.value)} />
              <input style={input} placeholder="BS&W %" value={readingBSW} onChange={(e) => setReadingBSW(e.target.value)} />
              <input style={input} placeholder="Meter Factor" value={readingMF} onChange={(e) => setReadingMF(e.target.value)} />
              <div style={{ marginTop: 15 }}>IV: {(Number(readingClose || 0) - Number(readingOpen || 0)).toFixed(2)}</div>
              <button style={button} onClick={saveReading}>Save Reading</button>
            </div>
          </>
        )}

        {page === 'tickets' && (
          <>
            <h1>Ticket Workflow</h1>
            <div style={box}>
              <h3>Create Draft Ticket</h3>
              <select style={input} value={selectedProducer} onChange={(e) => setSelectedProducer(e.target.value)}>
                <option value="">Select Producer</option>
                {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={input} value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)}>
                <option value="">Select Meter</option>
                {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}</option>)}
              </select>
              <select style={input} value={ticketType} onChange={(e) => setTicketType(e.target.value)}>
                <option value="meter">Meter Ticket</option>
                <option value="tank">Tank Ticket</option>
                <option value="truck">Truck Ticket</option>
              </select>

              <div style={card}>
                <h3>Autofill Preview</h3>
                <div>Profile: {autofillPreview?.profile?.name || 'None'}</div>
                <div>IV: {autofillPreview?.reading?.indicated_volume ?? 'None'}</div>
                <div>Gravity: {autofillPreview?.reading?.api_gravity ?? 'None'}</div>
                <div>Temp: {autofillPreview?.reading?.temperature ?? 'None'}</div>
                <div>MF: {autofillPreview?.reading?.meter_factor ?? 'None'}</div>
              </div>

              <button style={button} onClick={createTicket}>Auto Build Draft Ticket</button>
            </div>

            <div style={box}>
              <h3>Workflow Queue</h3>
              {tickets.map((t) => (
                <div key={t.id} style={card}>
                  <strong>{t.ticket_number}</strong>
                  <div>Status: {t.status}</div>
                  <div>Type: {t.ticket_type}</div>
                  <div>GSV: {t.calculation_results?.gsv ?? 'None'}</div>
                  <div>NSV: {t.calculation_results?.nsv ?? 'None'}</div>
                  <button style={button} onClick={() => setSelectedTicket(t)}>Open Ticket</button>
                </div>
              ))}
            </div>

            {selectedTicket && (
              <div style={box}>
                <h2>Ticket Detail</h2>
                <div><strong>Ticket:</strong> {selectedTicket.ticket_number}</div>
                <div><strong>Status:</strong> {selectedTicket.status}</div>
                <div><strong>Type:</strong> {selectedTicket.ticket_type}</div>
                <div><strong>Profile:</strong> {selectedTicket.calculation_profile_snapshot?.name || 'None'}</div>

                {selectedTicket.approved_at && (
                  <div style={{ color: '#86efac', marginTop: 10 }}>
                    Approved At: {new Date(selectedTicket.approved_at).toLocaleString()}
                  </div>
                )}

                {selectedTicket.status === 'approved' && (
                  <div style={{ background: '#14532d', padding: 12, borderRadius: 8, marginTop: 12 }}>
                    Approved ticket is locked for custody transfer.
                  </div>
                )}

                <div style={card}>
                  <h3>Inputs</h3>
                  <div>IV: {selectedTicket.observed_inputs?.iv}</div>
                  <div>CTL: {selectedTicket.observed_inputs?.ctl}</div>
                  <div>CPL: {selectedTicket.observed_inputs?.cpl}</div>
                  <div>CTLP: {selectedTicket.observed_inputs?.ctlp}</div>
                  <div>MF: {selectedTicket.observed_inputs?.mf}</div>
                  <div>CSW: {selectedTicket.observed_inputs?.csw}</div>
                </div>

                <div style={card}>
                  <h3>Results</h3>
                  <div>GSV: {selectedTicket.calculation_results?.gsv}</div>
                  <div>NSV: {selectedTicket.calculation_results?.nsv}</div>
                </div>

                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'submitted')}>Submit Ticket</button>
                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'approved')}>Approve Ticket</button>
                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'draft')}>Reject to Draft</button>
                <button style={{ ...button, background: '#dc2626' }} onClick={() => updateTicketStatus(selectedTicket, 'voided')}>Void Ticket</button>
                <button style={{ ...button, background: '#16a34a' }} onClick={() => generatePdfPreview(selectedTicket)}>Generate PDF Preview</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
