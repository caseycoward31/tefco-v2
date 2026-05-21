import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Area = { id: string; name: string }
type Segment = { id: string; name: string }

type Lease = {
  id: string
  lease_name: string
  lease_number?: string
  segment_id?: string
  producer_id?: string
}

type Meter = {
  id: string
  meter_number: string
  meter_name?: string
  active?: boolean
  lease_id?: string
  producer_id?: string
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
  meter_id?: string | null
  segment_id?: string | null
  observed_inputs?: any
  calculation_results?: any
  calculation_profile_snapshot?: any
  approved_at?: string | null
  pdf_url?: string | null
  pdf_file_name?: string | null
  pdf_generated_at?: string | null
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

type PotQuality = {
  id: string
  segment_id?: string
  producer_id?: string
  lease_id?: string
  sample_date: string
  api_gravity?: number
  bsw?: number
  csw?: number
  sample_temperature?: number
  notes?: string
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
  const [potQuality, setPotQuality] = useState<PotQuality[]>([])
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
  const [selectedProducer, setSelectedProducer] = useState('')
  const [selectedLease, setSelectedLease] = useState('')
  const [selectedMeter, setSelectedMeter] = useState('')
  const [ticketType, setTicketType] = useState('meter')
  const [autofillPreview, setAutofillPreview] = useState<any>(null)

  const [selectedReadingMeter, setSelectedReadingMeter] = useState('')
  const [selectedReadingSegment, setSelectedReadingSegment] = useState('')
  const [readingOpen, setReadingOpen] = useState('')
  const [readingClose, setReadingClose] = useState('')
  const [readingGravity, setReadingGravity] = useState('')
  const [readingTemp, setReadingTemp] = useState('')
  const [readingAvgTemp, setReadingAvgTemp] = useState('')
  const [readingAvgPressure, setReadingAvgPressure] = useState('')
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

  const [potSegment, setPotSegment] = useState('')
  const [potProducer, setPotProducer] = useState('')
  const [potLease, setPotLease] = useState('')
  const [potDate, setPotDate] = useState('')
  const [potGravity, setPotGravity] = useState('')
  const [potBSW, setPotBSW] = useState('')
  const [potTemp, setPotTemp] = useState('')
  const [potNotes, setPotNotes] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) loadAll()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const latestPot = potQuality.find(
      (p) =>
        (!selectedSegment || p.segment_id === selectedSegment) &&
        (!selectedProducer || p.producer_id === selectedProducer) &&
        (!selectedLease || p.lease_id === selectedLease)
    )

    setAutofillPreview({
      reading: latestReading || null,
      proving: latestApprovedProving || null,
      producer: producer || null,
      profile: profile || null,
      pot: latestPot || null,
    })
  }, [
    selectedMeter,
    selectedProducer,
    selectedSegment,
    selectedLease,
    readings,
    provings,
    producers,
    profiles,
    potQuality,
  ])

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
    const { data: potData } = await supabase.from('pot_quality').select('*').order('sample_date', { ascending: false })

    if (areaData) setAreas(areaData)
    if (segData) setSegments(segData)
    if (leaseData) setLeases(leaseData)
    if (meterData) setMeters(meterData)
    if (ticketData) setTickets(ticketData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
    if (provingData) setProvings(provingData)
    if (potData) setPotQuality(potData)
  }

  const activeMeters = meters.filter((m) => m.active !== false)
  const approvedThisMonth = provings.filter((p) => p.status === 'approved' && isThisMonth(p.proving_date))
  const provedMeterIds = new Set(approvedThisMonth.map((p) => p.meter_id))
  const provedThisMonthCount = activeMeters.filter((m) => provedMeterIds.has(m.id)).length
  const remainingProvingCount = Math.max(activeMeters.length - provedThisMonthCount, 0)
  const provingCompliance = activeMeters.length > 0 ? Math.round((provedThisMonthCount / activeMeters.length) * 100) : 0
  const pendingProvings = provings.filter((p) => p.status !== 'approved')
  const approvedProvings = provings.filter((p) => p.status === 'approved')
  const activeTickets = tickets.filter((t) => t.status !== 'approved')
  const approvedTickets = tickets.filter((t) => t.status === 'approved')

  const filteredProducers = selectedSegment
    ? producers.filter((p) => leases.some((l) => l.segment_id === selectedSegment && l.producer_id === p.id))
    : producers

  const filteredLeases = leases.filter(
    (l) =>
      (!selectedSegment || l.segment_id === selectedSegment) &&
      (!selectedProducer || l.producer_id === selectedProducer)
  )

  const filteredMeters = meters.filter(
    (m) =>
      (!selectedProducer || m.producer_id === selectedProducer) &&
      (!selectedLease || m.lease_id === selectedLease)
  )

  const filteredPotProducers = potSegment
    ? producers.filter((p) => leases.some((l) => l.segment_id === potSegment && l.producer_id === p.id))
    : producers

  const filteredPotLeases = leases.filter(
    (l) =>
      (!potSegment || l.segment_id === potSegment) &&
      (!potProducer || l.producer_id === potProducer)
  )

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
      average_temperature: Number(readingAvgTemp || 0),
      average_pressure: Number(readingAvgPressure || 0),
      bsw: Number(readingBSW || 0),
      meter_factor: Number(readingMF || 0),
    })

    setReadingOpen('')
    setReadingClose('')
    setReadingGravity('')
    setReadingTemp('')
    setReadingAvgTemp('')
    setReadingAvgPressure('')
    setReadingBSW('')
    setReadingMF('')
    loadAll()
  }

  async function savePotQuality() {
    if (!companyId || !potSegment || !potProducer || !potLease || !potDate) {
      alert('Select segment, producer, lease, and sample date first.')
      return
    }

    const bswNumber = Number(potBSW || 0)
    const csw = 1 - bswNumber / 100

    const { error } = await supabase.from('pot_quality').insert({
      company_id: companyId,
      segment_id: potSegment,
      producer_id: potProducer,
      lease_id: potLease,
      sample_date: potDate,
      api_gravity: Number(potGravity || 0),
      bsw: bswNumber,
      csw,
      sample_temperature: Number(potTemp || 0),
      notes: potNotes,
    })

    if (error) {
      alert('Could not save POT quality: ' + error.message)
      return
    }

    setPotDate('')
    setPotGravity('')
    setPotBSW('')
    setPotTemp('')
    setPotNotes('')
    alert('POT quality saved.')
    loadAll()
  }

  async function uploadProvingPdf(provingId: string) {
    if (!provingPdfFile || !companyId) return { pdfUrl: null, fileName: null }

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
      Number(proverVolume || 0) > 0 && Number(provingIndicatedVolume || 0) > 0
        ? roundFactor(Number(proverVolume) / Number(provingIndicatedVolume))
        : 0

    const finalAcceptedMF = roundFactor(Number(acceptedMF || observedMF || 0))

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
      alert('Could not save proving: ' + (error?.message || 'unknown error'))
      return
    }

    const uploaded = await uploadProvingPdf(inserted.id)

    if (uploaded.pdfUrl) {
      const { error: updateError } = await supabase
        .from('meter_provings')
        .update({
          pdf_url: uploaded.pdfUrl,
          pdf_file_name: uploaded.fileName,
        })
        .eq('id', inserted.id)

      if (updateError) {
        alert('Proving saved, but PDF link failed: ' + updateError.message)
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

    alert('Proving saved.')
    loadAll()
  }

  async function approveProving(proving: Proving) {
    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('meter_provings')
      .update({
        status: 'approved',
        approved_by: userData.user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', proving.id)

    if (error) {
      alert('Could not approve proving: ' + error.message)
      return
    }

    alert('Proving approved.')
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
    const latestApprovedProving = provings.find((p) => p.meter_id === selectedMeter && p.status === 'approved')
    const latestPot = potQuality.find(
      (p) => p.segment_id === selectedSegment && p.producer_id === selectedProducer && p.lease_id === selectedLease
    )

    const iv = Number(latestReading?.indicated_volume || 0)
    const ctl = 1
    const cpl = 1
    const ctlp = 1
    const factorToUse = Number(latestApprovedProving?.accepted_meter_factor || latestReading?.meter_factor || 1)
    const mf = roundFactor(factorToUse)
    const csw = Number(latestPot?.csw || 1)
    const isApi12 = profile?.standard === 'API 12'
    const ccf = roundFactor(ctl * ctlp * mf)
    const gsv = isApi12 ? iv * ctl * cpl * mf : iv * ccf
    const nsv = gsv * csw

    await supabase.from('tickets').insert({
      company_id: companyId,
      ticket_number: generatedNumber,
      ticket_type: ticketType,
      status: 'draft',
      producer_id: selectedProducer || null,
      segment_id: selectedSegment || null,
      meter_id: selectedMeter || null,
      linked_reading_id: latestReading?.id || null,
      linked_proving_id: latestApprovedProving?.id || null,
      calculation_profile_id: profile?.id || null,
      calculation_profile_snapshot: profile || {},
      observed_inputs: {
        iv,
        ctl,
        cpl,
        ctlp,
        mf,
        factor_type: latestApprovedProving?.factor_type || 'MF',
        api_gravity: latestPot?.api_gravity || null,
        temperature: latestPot?.sample_temperature || null,
        average_temperature: latestReading?.average_temperature || null,
        average_pressure: latestReading?.average_pressure || null,
        bsw_percent: latestPot?.bsw || null,
        csw,
        mf_source: latestApprovedProving ? 'latest_approved_proving' : 'reading_fallback',
        pot_source: latestPot ? 'latest_pot_quality' : 'none',
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

    const updateData: any = { status }

    if (status === 'approved') {
      updateData.approved_by = userData.user?.id
      updateData.approved_at = new Date().toISOString()
    }

    await supabase.from('tickets').update(updateData).eq('id', ticket.id)

    setSelectedTicket({ ...ticket, ...updateData })
    loadAll()
  }

  function buildTicketHtml(ticket: Ticket) {
    const producer = producers.find((p) => p.id === ticket.producer_id)
    const meter = meters.find((m) => m.id === ticket.meter_id)
    const segment = segments.find((s) => s.id === ticket.segment_id)

    return `
      <html>
        <head>
          <title>${ticket.ticket_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
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
            <div class="row"><strong>${ticket.observed_inputs?.factor_type || 'MF'}</strong><span>${ticket.observed_inputs?.mf ?? ''}</span></div>
            <div class="row"><strong>API Gravity</strong><span>${ticket.observed_inputs?.api_gravity ?? ''}</span></div>
            <div class="row"><strong>Temp</strong><span>${ticket.observed_inputs?.temperature ?? ''}</span></div>
            <div class="row"><strong>Avg Temp</strong><span>${ticket.observed_inputs?.average_temperature ?? ''}</span></div>
            <div class="row"><strong>Avg Pressure</strong><span>${ticket.observed_inputs?.average_pressure ?? ''}</span></div>
            <div class="row"><strong>BS&W %</strong><span>${ticket.observed_inputs?.bsw_percent ?? ''}</span></div>
            <div class="row"><strong>CSW</strong><span>${ticket.observed_inputs?.csw ?? ''}</span></div>
          </div>
          <div class="box">
            <h3>Results</h3>
            <div class="row"><strong>CCF</strong><span>${ticket.calculation_results?.ccf ?? ''}</span></div>
            <div class="row"><strong>GSV</strong><span>${ticket.calculation_results?.gsv ?? ''}</span></div>
            <div class="row"><strong>NSV</strong><span>${ticket.calculation_results?.nsv ?? ''}</span></div>
          </div>
        </body>
      </html>
    `
  }

  function generatePdfPreview(ticket: Ticket) {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(buildTicketHtml(ticket) + '<script>window.print()</script>')
      printWindow.document.close()
    }
  }

  function escapePdfText(value: any) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  }

  function buildTicketPdfBlob(ticket: Ticket) {
    const producer = producers.find((p) => p.id === ticket.producer_id)
    const meter = meters.find((m) => m.id === ticket.meter_id)
    const segment = segments.find((s) => s.id === ticket.segment_id)

    const lines = [
      'TEFCO Measurement Ticket',
      `Ticket: ${ticket.ticket_number}`,
      `Status: ${ticket.status}`,
      `Type: ${ticket.ticket_type}`,
      `Producer: ${producer?.name || ''}`,
      `Meter: ${meter?.meter_number || ''}`,
      `Segment: ${segment?.name || ''}`,
      `Profile: ${ticket.calculation_profile_snapshot?.name || ''}`,
      '',
      'Inputs',
      `IV: ${ticket.observed_inputs?.iv ?? ''}`,
      `CTL: ${ticket.observed_inputs?.ctl ?? ''}`,
      `CPL: ${ticket.observed_inputs?.cpl ?? ''}`,
      `CTLP: ${ticket.observed_inputs?.ctlp ?? ''}`,
      `${ticket.observed_inputs?.factor_type || 'MF'}: ${ticket.observed_inputs?.mf ?? ''}`,
      `API Gravity: ${ticket.observed_inputs?.api_gravity ?? ''}`,
      `Temp: ${ticket.observed_inputs?.temperature ?? ''}`,
      `Avg Temp: ${ticket.observed_inputs?.average_temperature ?? ''}`,
      `Avg Pressure: ${ticket.observed_inputs?.average_pressure ?? ''}`,
      `BS&W %: ${ticket.observed_inputs?.bsw_percent ?? ''}`,
      `CSW: ${ticket.observed_inputs?.csw ?? ''}`,
      '',
      'Results',
      `CCF: ${ticket.calculation_results?.ccf ?? ''}`,
      `GSV: ${ticket.calculation_results?.gsv ?? ''}`,
      `NSV: ${ticket.calculation_results?.nsv ?? ''}`,
    ]

    let y = 760
    const textCommands = lines.map((line) => {
      const command = `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`
      y -= 18
      return command
    }).join('\n')

    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream\nendobj\n`,
    ]

    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((obj) => {
      offsets.push(pdf.length)
      pdf += obj
    })

    const xrefStart = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n`
    pdf += '0000000000 65535 f \n'
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
    })
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    return new Blob([pdf], { type: 'application/pdf' })
  }

  async function saveTicketPdf(ticket: Ticket) {
    if (!companyId) {
      alert('Missing company ID.')
      return
    }

    const fileName = `${ticket.ticket_number || ticket.id}.pdf`
    const filePath = `${companyId}/${ticket.id}/${Date.now()}-${fileName}`
    const pdfBlob = buildTicketPdfBlob(ticket)

    const { error: uploadError } = await supabase.storage
      .from('ticket-pdfs')
      .upload(filePath, pdfBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) {
      alert('Ticket PDF upload failed: ' + uploadError.message)
      return
    }

    const generatedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        pdf_url: filePath,
        pdf_file_name: fileName,
        pdf_generated_at: generatedAt,
      })
      .eq('id', ticket.id)

    if (updateError) {
      alert('PDF uploaded, but ticket link failed: ' + updateError.message)
      return
    }

    const updatedTicket = { ...ticket, pdf_url: filePath, pdf_file_name: fileName, pdf_generated_at: generatedAt }
    setSelectedTicket(updatedTicket)
    alert('Ticket PDF saved.')
    loadAll()
  }

  async function viewTicketPdf(ticket: Ticket) {
    if (!ticket.pdf_url) {
      alert('No saved ticket PDF found.')
      return
    }

    const { data, error } = await supabase.storage
      .from('ticket-pdfs')
      .createSignedUrl(ticket.pdf_url, 60 * 10)

    if (error || !data?.signedUrl) {
      alert('Could not open ticket PDF: ' + (error?.message || 'unknown error'))
      return
    }

    window.open(data.signedUrl, '_blank')
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

        {['dashboard', 'areas', 'segments', 'leases', 'producers', 'meters', 'readings', 'pot', 'provings', 'tickets'].map((p) => (
          <button key={p} onClick={() => setPage(p)} style={button}>
            {p.toUpperCase()}
          </button>
        ))}

        <button onClick={logout} style={{ ...button, background: '#dc2626', marginTop: 30 }}>
          Logout
        </button>
      </aside>

      <main style={{ flex: 1, padding: 30 }}>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 20 }}>
              <div style={box}>Areas<h2>{areas.length}</h2></div>
              <div style={box}>Segments<h2>{segments.length}</h2></div>
              <div style={box}>Leases<h2>{leases.length}</h2></div>
              <div style={box}>Producers<h2>{producers.length}</h2></div>
              <div style={box}>Meters<h2>{meters.length}</h2></div>
              <div style={box}>Readings<h2>{readings.length}</h2></div>
              <div style={box}>Provings<h2>{provings.length}</h2></div>
              <div style={box}>Tickets<h2>{tickets.length}</h2></div>
            </div>

            <div style={box}>
              <h2>Monthly Proving KPI</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <div style={card}>Active Meters<h2>{activeMeters.length}</h2></div>
                <div style={card}>Proved This Month<h2>{provedThisMonthCount}</h2></div>
                <div style={card}>Remaining<h2>{remainingProvingCount}</h2></div>
                <div style={card}>Compliance<h2>{provingCompliance}%</h2></div>
              </div>
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
              <input style={input} placeholder="Average Temperature" value={readingAvgTemp} onChange={(e) => setReadingAvgTemp(e.target.value)} />
              <input style={input} placeholder="Average Pressure" value={readingAvgPressure} onChange={(e) => setReadingAvgPressure(e.target.value)} />
              <input style={input} placeholder="BS&W %" value={readingBSW} onChange={(e) => setReadingBSW(e.target.value)} />
              <input style={input} placeholder="Fallback Meter Factor" value={readingMF} onChange={(e) => setReadingMF(e.target.value)} />
              <div style={{ marginTop: 15 }}>IV: {(Number(readingClose || 0) - Number(readingOpen || 0)).toFixed(2)}</div>
              <button style={button} onClick={saveReading}>Save Reading</button>
            </div>
          </>
        )}

        {page === 'pot' && (
          <>
            <h1>POT Quality</h1>
            <div style={box}>
              <h3>New POT Quality</h3>
              <select style={input} value={potSegment} onChange={(e) => { setPotSegment(e.target.value); setPotProducer(''); setPotLease('') }}>
                <option value="">Select Segment</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select style={input} value={potProducer} onChange={(e) => { setPotProducer(e.target.value); setPotLease('') }}>
                <option value="">Select Producer</option>
                {filteredPotProducers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={input} value={potLease} onChange={(e) => setPotLease(e.target.value)}>
                <option value="">Select Lease</option>
                {filteredPotLeases.map((l) => <option key={l.id} value={l.id}>{l.lease_name}</option>)}
              </select>
              <input style={input} type="date" value={potDate} onChange={(e) => setPotDate(e.target.value)} />
              <input style={input} placeholder="API Gravity" value={potGravity} onChange={(e) => setPotGravity(e.target.value)} />
              <input style={input} placeholder="BS&W %" value={potBSW} onChange={(e) => setPotBSW(e.target.value)} />
              <input style={input} placeholder="Sample Temperature" value={potTemp} onChange={(e) => setPotTemp(e.target.value)} />
              <input style={input} placeholder="Notes" value={potNotes} onChange={(e) => setPotNotes(e.target.value)} />
              <div style={card}>CSW: {(1 - Number(potBSW || 0) / 100).toFixed(6)}</div>
              <button style={button} onClick={savePotQuality}>Save POT Quality</button>
            </div>
            <div style={box}>
              <h3>Recent POT Quality</h3>
              {potQuality.map((p) => {
                const seg = segments.find((s) => s.id === p.segment_id)
                const prod = producers.find((x) => x.id === p.producer_id)
                const lease = leases.find((l) => l.id === p.lease_id)
                return (
                  <div key={p.id} style={card}>
                    <strong>{lease?.lease_name || 'Lease'}</strong>
                    <div>Segment: {seg?.name || ''}</div>
                    <div>Producer: {prod?.name || ''}</div>
                    <div>Date: {p.sample_date}</div>
                    <div>API Gravity: {p.api_gravity}</div>
                    <div>BS&W: {p.bsw}</div>
                    <div>CSW: {p.csw}</div>
                    <div>Temp: {p.sample_temperature}</div>
                    <div>Notes: {p.notes || ''}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {page === 'provings' && (
          <>
            <h1>Meter Provings</h1>
            <div style={box}>
              <h2>Monthly Proving KPI</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 20 }}>
                <div style={card}>Active Meters<h2>{activeMeters.length}</h2></div>
                <div style={card}>Proved This Month<h2>{provedThisMonthCount}</h2></div>
                <div style={card}>Remaining<h2>{remainingProvingCount}</h2></div>
                <div style={card}>Compliance<h2>{provingCompliance}%</h2></div>
              </div>
            </div>

            <div style={box}>
              <h2>New Proving</h2>
              <select style={input} value={provingMeter} onChange={(e) => setProvingMeter(e.target.value)}>
                <option value="">Select Meter</option>
                {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}</option>)}
              </select>
              <select style={input} value={provingFactorType} onChange={(e) => setProvingFactorType(e.target.value)}>
                <option value="MF">MF</option>
                <option value="CMF">CMF</option>
              </select>
              <input style={input} type="date" value={provingDate} onChange={(e) => setProvingDate(e.target.value)} />
              <input style={input} placeholder="Prover Volume" value={proverVolume} onChange={(e) => setProverVolume(e.target.value)} />
              <input style={input} placeholder="Indicated Volume" value={provingIndicatedVolume} onChange={(e) => setProvingIndicatedVolume(e.target.value)} />
              <input style={input} placeholder="Accepted MF/CMF" value={acceptedMF} onChange={(e) => setAcceptedMF(e.target.value)} />
              <input style={input} placeholder="Witness" value={provingWitness} onChange={(e) => setProvingWitness(e.target.value)} />
              <input style={input} type="file" accept="application/pdf" onChange={(e) => setProvingPdfFile(e.target.files?.[0] || null)} />
              <div style={card}>
                Calculated {provingFactorType}:{' '}
                {Number(proverVolume || 0) > 0 && Number(provingIndicatedVolume || 0) > 0
                  ? roundFactor(Number(proverVolume) / Number(provingIndicatedVolume)).toFixed(4)
                  : '0.0000'}
              </div>
              <button style={button} onClick={saveProving}>Save Draft Proving</button>
            </div>

            <div style={box}>
              <h2>Needs Approval</h2>
              {pendingProvings.length === 0 && <div style={card}>No pending provings.</div>}
              {pendingProvings.map((p) => {
                const meter = meters.find((m) => m.id === p.meter_id)
                return (
                  <div key={p.id} style={card}>
                    <strong>{meter?.meter_number || 'Meter'}</strong>
                    <div>Date: {p.proving_date}</div>
                    <div>Status: {p.status}</div>
                    <div>Type: {p.factor_type || 'MF'}</div>
                    <div>Accepted {p.factor_type || 'MF'}: {Number(p.accepted_meter_factor || 0).toFixed(4)}</div>
                    <div>Witness: {p.witness || ''}</div>
                    <div>PDF: {p.pdf_file_name || 'None'}</div>
                    {p.pdf_url && <button style={button} onClick={() => viewProvingPdf(p.pdf_url)}>View Proving PDF</button>}
                    <button style={button} onClick={() => approveProving(p)}>Approve Proving</button>
                  </div>
                )
              })}
            </div>

            <div style={box}>
              <h2>Approved History</h2>
              {approvedProvings.map((p) => {
                const meter = meters.find((m) => m.id === p.meter_id)
                return (
                  <div key={p.id} style={card}>
                    <strong>{meter?.meter_number || 'Meter'}</strong>
                    <div>Date: {p.proving_date}</div>
                    <div>Approved: {p.approved_at ? new Date(p.approved_at).toLocaleString() : 'No'}</div>
                    <div>{p.factor_type || 'MF'}: {Number(p.accepted_meter_factor || 0).toFixed(4)}</div>
                    {p.pdf_url && <button style={button} onClick={() => viewProvingPdf(p.pdf_url)}>View Proving PDF</button>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {page === 'tickets' && (
          <>
            <h1>Ticket Workflow</h1>
            <div style={box}>
              <h3>Create Draft Ticket</h3>
              <select style={input} value={selectedSegment} onChange={(e) => { setSelectedSegment(e.target.value); setSelectedProducer(''); setSelectedLease(''); setSelectedMeter('') }}>
                <option value="">Select Segment</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select style={input} value={selectedProducer} onChange={(e) => { setSelectedProducer(e.target.value); setSelectedLease(''); setSelectedMeter('') }}>
                <option value="">Select Producer</option>
                {filteredProducers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={input} value={selectedLease} onChange={(e) => { setSelectedLease(e.target.value); setSelectedMeter('') }}>
                <option value="">Select Lease</option>
                {filteredLeases.map((l) => <option key={l.id} value={l.id}>{l.lease_name}</option>)}
              </select>
              <select style={input} value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)}>
                <option value="">Select Meter</option>
                {filteredMeters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}</option>)}
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
                <div>Avg Temp: {autofillPreview?.reading?.average_temperature ?? 'None'}</div>
                <div>Avg Pressure: {autofillPreview?.reading?.average_pressure ?? 'None'}</div>
                <div>Latest Approved {autofillPreview?.proving?.factor_type || 'MF'}: {autofillPreview?.proving?.accepted_meter_factor ?? 'None'}</div>
                <div>POT API Gravity: {autofillPreview?.pot?.api_gravity ?? 'None'}</div>
                <div>POT BS&W: {autofillPreview?.pot?.bsw ?? 'None'}</div>
                <div>POT CSW: {autofillPreview?.pot?.csw ?? 'None'}</div>
              </div>

              <button style={button} onClick={createTicket}>Auto Build Draft Ticket</button>
            </div>

            <div style={box}>
              <h3>Workflow Queue</h3>
              {activeTickets.map((t) => (
                <div key={t.id} style={card}>
                  <strong>{t.ticket_number}</strong>
                  <div>Status: {t.status}</div>
                  <div>Type: {t.ticket_type}</div>
                  <div>Factor Type: {t.observed_inputs?.factor_type || 'MF'}</div>
                  <div>Factor Source: {t.observed_inputs?.mf_source || 'None'}</div>
                  <div>POT Source: {t.observed_inputs?.pot_source || 'None'}</div>
                  <div>GSV: {t.calculation_results?.gsv ?? 'None'}</div>
                  <div>NSV: {t.calculation_results?.nsv ?? 'None'}</div>
                  <button style={button} onClick={() => setSelectedTicket(t)}>Open Ticket</button>
                </div>
              ))}
            </div>

            <div style={box}>
              <h3>Approved Tickets</h3>
              {approvedTickets.length === 0 && <div style={card}>No approved tickets yet.</div>}
              {approvedTickets.map((t) => (
                <div key={t.id} style={card}>
                  <strong>{t.ticket_number}</strong>
                  <div>Status: {t.status}</div>
                  <div>NSV: {t.calculation_results?.nsv ?? 'None'}</div>
                  <button style={button} onClick={() => setSelectedTicket(t)}>Open Approved Ticket</button>
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
                <div><strong>Saved PDF:</strong> {selectedTicket.pdf_file_name || 'None'}</div>

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
                  <div>{selectedTicket.observed_inputs?.factor_type || 'MF'}: {selectedTicket.observed_inputs?.mf}</div>
                  <div>API Gravity: {selectedTicket.observed_inputs?.api_gravity}</div>
                  <div>Temp: {selectedTicket.observed_inputs?.temperature}</div>
                  <div>Avg Temp: {selectedTicket.observed_inputs?.average_temperature}</div>
                  <div>Avg Pressure: {selectedTicket.observed_inputs?.average_pressure}</div>
                  <div>BS&W %: {selectedTicket.observed_inputs?.bsw_percent}</div>
                  <div>CSW: {selectedTicket.observed_inputs?.csw}</div>
                </div>

                <div style={card}>
                  <h3>Results</h3>
                  <div>CCF: {selectedTicket.calculation_results?.ccf}</div>
                  <div>GSV: {selectedTicket.calculation_results?.gsv}</div>
                  <div>NSV: {selectedTicket.calculation_results?.nsv}</div>
                </div>

                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'submitted')}>Submit Ticket</button>
                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'approved')}>Approve Ticket</button>
                <button style={button} onClick={() => updateTicketStatus(selectedTicket, 'draft')}>Reject to Draft</button>
                <button style={{ ...button, background: '#dc2626' }} onClick={() => updateTicketStatus(selectedTicket, 'voided')}>Void Ticket</button>
                <button style={{ ...button, background: '#16a34a' }} onClick={() => generatePdfPreview(selectedTicket)}>Generate PDF Preview</button>
                <button style={{ ...button, background: '#15803d' }} onClick={() => saveTicketPdf(selectedTicket)}>Generate & Save Ticket PDF</button>
                {selectedTicket.pdf_url && (
                  <button style={{ ...button, background: '#047857' }} onClick={() => viewTicketPdf(selectedTicket)}>
                    View Saved Ticket PDF
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
