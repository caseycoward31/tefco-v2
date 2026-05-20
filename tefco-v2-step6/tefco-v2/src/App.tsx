import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Area = { id: string; name: string }
type Segment = { id: string; name: string }
type Lease = { id: string; lease_name: string; lease_number?: string }
type Meter = { id: string; meter_number: string; meter_name?: string; active?: boolean }
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
  observed_inputs?: any
  calculation_results?: any
  calculation_profile_snapshot?: any
  approved_at?: string | null
}

type Proving = {
  id: string
  meter_id: string
  proving_date: string
  observed_meter_factor?: number
  accepted_meter_factor?: number
  factor_type?: string
  status: string
  witness?: string
  pdf_url?: string
  pdf_file_name?: string
  approved_at?: string | null
}

function roundFactor(value: number) {
  return Number(value.toFixed(4))
}

function isThisMonth(dateValue?: string) {
  if (!dateValue) return false
  const d = new Date(dateValue)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
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
  const [provings, setProvings] = useState<Proving[]>([])
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

  const [provingMeter, setProvingMeter] = useState('')
  const [provingDate, setProvingDate] = useState('')
  const [proverVolume, setProverVolume] = useState('')
  const [provingIndicatedVolume, setProvingIndicatedVolume] = useState('')
  const [acceptedMF, setAcceptedMF] = useState('')
  const [provingWitness, setProvingWitness] = useState('')
  const [provingFactorType, setProvingFactorType] = useState('MF')
  const [provingPdfFile, setProvingPdfFile] = useState<File | null>(null)

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
    const latestApprovedProving = provings.find(
      (p) => p.meter_id === selectedMeter && p.status === 'approved'
    )
    const producer = producers.find((p) => p.id === selectedProducer)
    const profile = profiles.find((p) => p.id === producer?.calculation_profile_id)

    setAutofillPreview({
      reading: latestReading || null,
      proving: latestApprovedProving || null,
      producer: producer || null,
      profile: profile || null,
    })
  }, [selectedMeter, selectedProducer, readings, provings, producers, profiles])

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
    const { data: provingData } = await supabase.from('meter_provings').select('*').order('proving_date', { ascending: false })

    if (areaData) setAreas(areaData)
    if (segData) setSegments(segData)
    if (leaseData) setLeases(leaseData)
    if (meterData) setMeters(meterData)
    if (ticketData) setTickets(ticketData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
    if (provingData) setProvings(provingData)
  }

  const activeMeters = meters.filter((m) => m.active !== false)
  const approvedThisMonth = provings.filter((p) => p.status === 'approved' && isThisMonth(p.proving_date))
  const provedMeterIds = new Set(approvedThisMonth.map((p) => p.meter_id))
  const provedThisMonthCount = activeMeters.filter((m) => provedMeterIds.has(m.id)).length
  const remainingProvingCount = Math.max(activeMeters.length - provedThisMonthCount, 0)
  const provingCompliance =
    activeMeters.length > 0 ? Math.round((provedThisMonthCount / activeMeters.length) * 100) : 0

  const pendingProvings = provings.filter((p) => p.status !== 'approved')
  const approvedProvings = provings.filter((p) => p.status === 'approved')

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
      active: true,
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

  async function uploadProvingPdf(provingId: string) {
    if (!provingPdfFile || !companyId) {
      return { pdfUrl: null, fileName: null }
    }

    const safeName = provingPdfFile.name.replace(/\s+/g, '_')
    const filePath = `${companyId}/${provingId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from('proving-reports')
      .upload(filePath, provingPdfFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (error) {
      alert('PDF upload failed: ' + error.message)
      return { pdfUrl: null, fileName: null }
    }

    return { pdfUrl: filePath, fileName: provingPdfFile.name }
  }

  async function viewProvingPdf(filePath?: string) {
    if (!filePath) return

    const { data, error } = await supabase.storage
      .from('proving-reports')
      .createSignedUrl(filePath, 60 * 10)

    if (error || !data?.signedUrl) {
      alert('Could not open proving PDF: ' + (error?.message || 'unknown error'))
      return
    }

    window.open(data.signedUrl, '_blank')
  }
    async function saveProving() {
    if (!companyId || !provingMeter || !provingDate) {
      alert('Select meter and proving date first.')
      return
    }

    const observedMF =
      Number(proverVolume || 0) > 0 &&
      Number(provingIndicatedVolume || 0) > 0
        ? roundFactor(
            Number(proverVolume) /
              Number(provingIndicatedVolume)
          )
        : 0

    const finalAcceptedMF = roundFactor(
      Number(acceptedMF || observedMF || 0)
    )

    const { data: inserted, error } = await supabase
      .from('meter_provings')
      .insert({
        company_id: companyId,
        meter_id: provingMeter,
        proving_date: provingDate,
        prover_volume: Number(proverVolume || 0),
        indicated_volume: Number(provingIndicatedVolume || 0),
        observed_meter_factor: observedMF,
        accepted_meter_factor: finalAcceptedMF,
        factor_type: provingFactorType,
        witness: provingWitness,
        status: 'draft',
      })
      .select()
      .single()

    if (error || !inserted) {
      alert(
        'Could not save proving: ' +
          (error?.message || 'unknown error')
      )
      return
    }

    const uploaded = await uploadProvingPdf(
      inserted.id
    )

    if (uploaded.pdfUrl) {
      const { error: updateError } =
        await supabase
          .from('meter_provings')
          .update({
            pdf_url: uploaded.pdfUrl,
            pdf_file_name: uploaded.fileName,
          })
          .eq('id', inserted.id)

      if (updateError) {
        alert(
          'Proving saved, but PDF link failed: ' +
            updateError.message
        )
        return
      }
    }

    setProvingMeter('')
    setProvingDate('')
    setProverVolume('')
    setProvingIndicatedVolume('')
    setAcceptedMF('')
    setProvingWitness('')
    setProvingFactorType('MF')
    setProvingPdfFile(null)

    alert('Proving saved successfully.')

    loadAll()
  }

  async function approveProving(
    proving: Proving
  ) {
    const { data: userData } =
      await supabase.auth.getUser()

    const { error: updateError } =
      await supabase
        .from('meter_provings')
        .update({
          status: 'approved',
          approved_by: userData.user?.id,
          approved_at:
            new Date().toISOString(),
        })
        .eq('id', proving.id)

    if (updateError) {
      alert(
        'Could not approve proving: ' +
          updateError.message
      )
      return
    }

    alert('Proving approved.')

    loadAll()
  }

  async function createTicket() {
    if (!companyId) return

    const {
      data: generatedNumber,
      error,
    } = await supabase.rpc(
      'generate_ticket_number',
      {
        p_company_id: companyId,
      }
    )

    if (error || !generatedNumber) {
      alert(
        'Could not generate ticket number.'
      )
      return
    }

    const producer = producers.find(
      (p) => p.id === selectedProducer
    )

    const profile = profiles.find(
      (p) =>
        p.id === producer?.calculation_profile_id
    )

    const latestReading = readings.find(
      (r) => r.meter_id === selectedMeter
    )

    const latestApprovedProving =
      provings.find(
        (p) =>
          p.meter_id === selectedMeter &&
          p.status === 'approved'
      )

    const iv = Number(
      latestReading?.indicated_volume || 0
    )

    const ctl = 1
    const cpl = 1
    const ctlp = 1

    const factorToUse = Number(
      latestApprovedProving?.accepted_meter_factor ||
        latestReading?.meter_factor ||
        1
    )

    const mf = roundFactor(factorToUse)

    const csw =
      1 -
      Number(latestReading?.bsw || 0) / 100

    const isApi12 =
      profile?.standard === 'API 12'

    const ccf = roundFactor(
      ctl * ctlp * mf
    )

    const gsv = isApi12
      ? iv * ctl * cpl * mf
      : iv * ccf

    const nsv = gsv * csw

    await supabase.from('tickets').insert({
      company_id: companyId,
      ticket_number: generatedNumber,
      ticket_type: ticketType,
      status: 'draft',
      producer_id:
        selectedProducer || null,
      segment_id:
        selectedSegment ||
        latestReading?.segment_id ||
        null,
      meter_id: selectedMeter || null,
      linked_reading_id:
        latestReading?.id || null,
      linked_proving_id:
        latestApprovedProving?.id || null,
      calculation_profile_id:
        profile?.id || null,
      calculation_profile_snapshot:
        profile || {},
      observed_inputs: {
        iv,
        ctl,
        cpl,
        ctlp,
        mf,
        factor_type:
          latestApprovedProving?.factor_type ||
          'MF',
        csw,
        api_gravity:
          latestReading?.api_gravity ||
          null,
        temperature:
          latestReading?.temperature ||
          null,
        bsw_percent:
          latestReading?.bsw || null,
        mf_source:
          latestApprovedProving
            ? 'latest_approved_proving'
            : 'reading_fallback',
      },
      calculation_results: {
        ccf,
        gsv,
        nsv,
        formula_profile: isApi12
          ? 'API 12 2021'
          : 'API 11.1',
      },
    })

    alert(
      `Draft ticket created: ${generatedNumber}`
    )

    loadAll()
  }

  async function updateTicketStatus(
    ticket: Ticket,
    status: string
  ) {
    const { data: userData } =
      await supabase.auth.getUser()

    const updateData: any = {
      status,
    }

    if (status === 'approved') {
      updateData.approved_by =
        userData.user?.id
      updateData.approved_at =
        new Date().toISOString()
    }

    await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticket.id)

    setSelectedTicket({
      ...ticket,
      ...updateData,
    })

    loadAll()
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const box: CSSProperties = {
    background: '#0f172a',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  }

  const card: CSSProperties = {
    background: '#1e293b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  }

  const input: CSSProperties = {
    width: '100%',
    padding: 12,
    marginTop: 10,
    color: 'black',
    background: 'white',
    borderRadius: 6,
    border: 'none',
  }

  const button: CSSProperties = {
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
          'provings',
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
                  'repeat(4, 1fr)',
                gap: 20,
              }}
            >
              <div style={box}>
                Active Meters
                <h2>
                  {activeMeters.length}
                </h2>
              </div>

              <div style={box}>
                Proved This Month
                <h2>
                  {provedThisMonthCount}
                </h2>
              </div>

              <div style={box}>
                Remaining
                <h2>
                  {remainingProvingCount}
                </h2>
              </div>

              <div style={box}>
                Compliance
                <h2>
                  {provingCompliance}%
                </h2>
              </div>
            </div>
          </>
        )}

        {page === 'provings' && (
          <>
            <h1>Meter Provings</h1>

            <div style={box}>
              <h2>
                Monthly Proving KPI
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4, 1fr)',
                  gap: 20,
                  marginTop: 20,
                }}
              >
                <div style={card}>
                  Active Meters
                  <h2>
                    {activeMeters.length}
                  </h2>
                </div>

                <div style={card}>
                  Proved This Month
                  <h2>
                    {provedThisMonthCount}
                  </h2>
                </div>

                <div style={card}>
                  Remaining
                  <h2>
                    {remainingProvingCount}
                  </h2>
                </div>

                <div style={card}>
                  Compliance
                  <h2>
                    {provingCompliance}%
                  </h2>
                </div>
              </div>
            </div>

            <div style={box}>
              <h2>New Proving</h2>

              <select
                style={input}
                value={provingMeter}
                onChange={(e) =>
                  setProvingMeter(
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
                    {m.meter_number}
                  </option>
                ))}
              </select>

              <select
                style={input}
                value={provingFactorType}
                onChange={(e) =>
                  setProvingFactorType(
                    e.target.value
                  )
                }
              >
                <option value="MF">
                  MF
                </option>
                <option value="CMF">
                  CMF
                </option>
              </select>

              <input
                style={input}
                type="date"
                value={provingDate}
                onChange={(e) =>
                  setProvingDate(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Prover Volume"
                value={proverVolume}
                onChange={(e) =>
                  setProverVolume(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Indicated Volume"
                value={
                  provingIndicatedVolume
                }
                onChange={(e) =>
                  setProvingIndicatedVolume(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Accepted MF/CMF"
                value={acceptedMF}
                onChange={(e) =>
                  setAcceptedMF(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                placeholder="Witness"
                value={provingWitness}
                onChange={(e) =>
                  setProvingWitness(
                    e.target.value
                  )
                }
              />

              <input
                style={input}
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  setProvingPdfFile(
                    e.target.files?.[0] ||
                      null
                  )
                }
              />

              <div style={card}>
                Calculated{' '}
                {provingFactorType}:{' '}
                {Number(
                  proverVolume || 0
                ) > 0 &&
                Number(
                  provingIndicatedVolume ||
                    0
                ) > 0
                  ? roundFactor(
                      Number(
                        proverVolume
                      ) /
                        Number(
                          provingIndicatedVolume
                        )
                    ).toFixed(4)
                  : '0.0000'}
              </div>

              <button
                style={button}
                onClick={saveProving}
              >
                Save Draft Proving
              </button>
            </div>

            <div style={box}>
              <h2>
                Needs Approval
              </h2>

              {pendingProvings.length ===
                0 && (
                <div style={card}>
                  No pending provings.
                </div>
              )}

              {pendingProvings.map(
                (p) => {
                  const meter =
                    meters.find(
                      (m) =>
                        m.id ===
                        p.meter_id
                    )

                  return (
                    <div
                      key={p.id}
                      style={card}
                    >
                      <strong>
                        {meter?.meter_number ||
                          'Meter'}
                      </strong>

                      <div>
                        Date:{' '}
                        {p.proving_date}
                      </div>

                      <div>
                        Status:{' '}
                        {p.status}
                      </div>

                      <div>
                        Type:{' '}
                        {p.factor_type ||
                          'MF'}
                      </div>

                      <div>
                        Accepted{' '}
                        {p.factor_type ||
                          'MF'}
                        :{' '}
                        {Number(
                          p.accepted_meter_factor ||
                            0
                        ).toFixed(4)}
                      </div>

                      <div>
                        Witness:{' '}
                        {p.witness ||
                          ''}
                      </div>

                      <div>
                        PDF:{' '}
                        {p.pdf_file_name ||
                          'None'}
                      </div>

                      {p.pdf_url && (
                        <button
                          style={
                            button
                          }
                          onClick={() =>
                            viewProvingPdf(
                              p.pdf_url
                            )
                          }
                        >
                          View
                          Proving
                          PDF
                        </button>
                      )}

                      <button
                        style={
                          button
                        }
                        onClick={() =>
                          approveProving(
                            p
                          )
                        }
                      >
                        Approve
                        Proving
                      </button>
                    </div>
                  )
                }
              )}
            </div>

            <div style={box}>
              <h2>
                Approved History
              </h2>

              {approvedProvings.map(
                (p) => {
                  const meter =
                    meters.find(
                      (m) =>
                        m.id ===
                        p.meter_id
                    )

                  return (
                    <div
                      key={p.id}
                      style={card}
                    >
                      <strong>
                        {meter?.meter_number ||
                          'Meter'}
                      </strong>

                      <div>
                        Date:{' '}
                        {p.proving_date}
                      </div>

                      <div>
                        Approved:{' '}
                        {p.approved_at
                          ? new Date(
                              p.approved_at
                            ).toLocaleString()
                          : 'No'}
                      </div>

                      <div>
                        {p.factor_type ||
                          'MF'}
                        :{' '}
                        {Number(
                          p.accepted_meter_factor ||
                            0
                        ).toFixed(4)}
                      </div>

                      {p.pdf_url && (
                        <button
                          style={
                            button
                          }
                          onClick={() =>
                            viewProvingPdf(
                              p.pdf_url
                            )
                          }
                        >
                          View
                          Proving
                          PDF
                        </button>
                      )}
                    </div>
                  )
                }
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
