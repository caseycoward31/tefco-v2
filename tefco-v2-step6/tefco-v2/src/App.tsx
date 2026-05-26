import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Company = {
  id: string
  name: string
  active?: boolean | null
  created_at?: string | null
}

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
  proving_frequency_days?: number | null
  last_proving_date?: string | null
  next_proving_due?: string | null
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
  is_locked?: boolean | null
  locked_at?: string | null
  locked_by?: string | null
  api_gravity_60?: number | null
  density_60?: number | null
  observed_api_gravity?: number | null
  observed_temperature?: number | null
  observed_pressure?: number | null
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
  observed_api_gravity?: number
  observed_temperature?: number
  api_gravity_60?: number
  bsw?: number
  csw?: number
  sample_temperature?: number
  notes?: string
}

function roundFactor(value: number) {
  return Number(value.toFixed(4))
}




type UserRole = {
  id: string
  company_id?: string | null
  user_id: string
  role: string
  active?: boolean | null
}

type RolePermission = {
  id: string
  role: string
  module: string
  can_view?: boolean | null
  can_create?: boolean | null
  can_edit?: boolean | null
  can_approve?: boolean | null
  can_delete?: boolean | null
}

type TicketAuditLog = {
  id: string
  ticket_id?: string | null
  company_id?: string | null
  action: string
  old_status?: string | null
  new_status?: string | null
  notes?: string | null
  changed_by?: string | null
  created_at?: string | null
}

type ContractProfile = {
  id: string
  company_id?: string | null
  producer_id?: string | null
  name: string
  standard?: string | null
  calculation_method?: string | null
  contract_profile_id?: string | null
  factor_type?: string | null
  api_rounding?: number | null
  ctl_rounding?: number | null
  cpl_rounding?: number | null
  ctlp_rounding?: number | null
  volume_rounding?: number | null
  use_pressure?: boolean | null
  use_shrink?: boolean | null
  shrink_factor?: number | null
  product_group?: string | null
  active?: boolean | null
  proving_frequency_days?: number | null
  last_proving_date?: string | null
  next_proving_due?: string | null
}





function hasPermission(
  permissions: RolePermission[],
  role: string,
  module: string,
  action:
    | 'can_view'
    | 'can_create'
    | 'can_edit'
    | 'can_approve'
    | 'can_delete'
) {
  const allPermission = permissions.find(
    (p) => p.role === role && p.module === 'all'
  )

  if (allPermission?.[action]) return true

  const modulePermission = permissions.find(
    (p) => p.role === role && p.module === module
  )

  return Boolean(modulePermission?.[action])
}

function getProducerProfile(
  profiles: ContractProfile[],
  producerId?: string | null
) {
  const producerProfile = profiles.find(
    (p) => p.producer_id === producerId && p.active !== false
  )

  if (producerProfile) return producerProfile

  return (
    profiles.find(
      (p) =>
        (!p.producer_id || p.producer_id === '') &&
        p.active !== false
    ) || null
  )
}


function daysBetween(dateA?: string | null, dateB?: string | null) {
  if (!dateA || !dateB) return null

  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()

  return Math.floor((b - a) / (1000 * 60 * 60 * 24))
}

function calculateNextDueDate(
  lastDate?: string | null,
  frequencyDays?: number | null
) {
  if (!lastDate) return null

  const next = new Date(lastDate)
  next.setDate(next.getDate() + Number(frequencyDays || 30))

  return next.toISOString().split('T')[0]
}

function getProvingComplianceStatus(nextDue?: string | null) {
  if (!nextDue) return 'UNKNOWN'

  const today = new Date()
  const due = new Date(nextDue)

  const diff =
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)

  if (diff < 0) return 'OVERDUE'
  if (diff <= 7) return 'DUE_SOON'

  return 'COMPLIANT'
}

function formatOneDecimal(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(1) : ''
}

function roundTo(value: number, decimals: number) {
  if (!Number.isFinite(value)) return 0
  const p = Math.pow(10, decimals)
  return Math.round(value * p) / p
}

function apiToDensityKgM3(apiGravity: number) {
  if (!Number.isFinite(apiGravity)) return 0
  return (999.016 * 141.5) / (apiGravity + 131.5)
}

function densityKgM3ToApi(density: number) {
  if (!Number.isFinite(density) || density <= 0) return 0
  return (141.5 * 999.016) / density - 131.5
}

function its90ToIpts68F(tempF: number) {
  const tempC = (Number(tempF || 60) - 32) / 1.8
  const scaled = tempC / 630
  const coeffs = [
    -0.148759,
    -0.267408,
    1.080760,
    1.269056,
    -4.089591,
    -1.871251,
    7.438081,
    -3.536296,
  ]

  let correctionC = 0

  for (let i = 0; i < coeffs.length; i += 1) {
    correctionC += coeffs[i] * Math.pow(scaled, i + 1)
  }

  return (tempC + correctionC) * 1.8 + 32
}

function getApi11Coefficients(productGroup: string, density60: number) {
  const group = (productGroup || 'crude').toLowerCase()

  if (group.includes('lube')) {
    return {
      k0: 0,
      k1: 0.34878,
      k2: 0,
      d: 1.0,
      groupName: 'lube',
    }
  }

  if (
    group.includes('refined') ||
    group.includes('product') ||
    group.includes('gasoline') ||
    group.includes('diesel') ||
    group.includes('jet') ||
    group.includes('fuel')
  ) {
    if (density60 >= 838.3127) {
      return {
        k0: 103.8720,
        k1: 0.2701,
        k2: 0,
        d: 1.3,
        groupName: 'fuel_oil',
      }
    }

    if (density60 >= 787.5195) {
      return {
        k0: 330.3010,
        k1: 0,
        k2: 0,
        d: 2.0,
        groupName: 'jet_fuel',
      }
    }

    if (density60 >= 770.3520) {
      return {
        k0: 1489.0670,
        k1: 0,
        k2: -0.00186840,
        d: 8.5,
        groupName: 'transition',
      }
    }

    return {
      k0: 192.4571,
      k1: 0.2438,
      k2: 0,
      d: 1.5,
      groupName: 'gasoline',
    }
  }

  return {
    k0: 341.0957,
    k1: 0,
    k2: 0,
    d: 2.0,
    groupName: 'crude',
  }
}

function calculateType1FromDensity60(
  density60: number,
  tempF: number,
  pressurePsig: number,
  productGroup: string
) {
  const safePressure = Math.max(0, Number(pressurePsig || 0))
  const shiftedTemp = its90ToIpts68F(Number(tempF || 60))
  const deltaT = shiftedTemp - 60.0068749
  const delta60 = 0.01374979547
  const coeff = getApi11Coefficients(productGroup, density60)

  const a =
    (delta60 / 2) *
    (((coeff.k0 / density60) + coeff.k1) / density60 + coeff.k2)

  const b =
    ((2 * coeff.k0) + (coeff.k1 * density60)) /
    (coeff.k0 + (coeff.k1 * density60) + (coeff.k2 * density60 * density60))

  const density60Star =
    density60 *
    Math.exp(
      (a * (1 + 0.8 * a)) /
        (1 + a * (1 + 1.6 * a) * b)
    )

  const alpha60 =
    ((coeff.k0 / density60Star) + coeff.k1) / density60Star + coeff.k2

  const ctl = Math.exp(
    -alpha60 *
      deltaT *
      (1 + 0.8 * alpha60 * (deltaT + delta60))
  )

  const fp = Math.exp(
    -1.9947 +
      0.00013427 * shiftedTemp +
      (793920 + 2326.0 * shiftedTemp) /
        (density60Star * density60Star)
  )

  const cpl = 1 / (1 - 0.00001 * fp * safePressure)
  const ctlp = ctl * cpl

  return {
    ctl,
    cpl,
    ctlp,
    ccf: ctlp,
    fp,
    alpha60,
    density60Star,
    productSubGroup: coeff.groupName,
  }
}

function calculateDensity60FromObservedApi(
  observedApiGravity: number,
  observedTempF: number,
  observedPressurePsig: number,
  productGroup: string
) {
  const observedDensity = apiToDensityKgM3(Number(observedApiGravity || 0))

  if (!observedDensity) {
    return {
      density60: 0,
      apiGravity60: 0,
      ctlObserved: 1,
      cplObserved: 1,
      ctlpObserved: 1,
      iterations: 0,
      converged: false,
    }
  }

  let density60 = observedDensity

  for (let i = 0; i < 20; i += 1) {
    const calc = calculateType1FromDensity60(
      density60,
      observedTempF,
      observedPressurePsig,
      productGroup
    )

    const estimatedObservedDensity = density60 * calc.ctlp
    const error = observedDensity - estimatedObservedDensity

    if (Math.abs(error) < 0.000001) {
      return {
        density60,
        apiGravity60: densityKgM3ToApi(density60),
        ctlObserved: calc.ctl,
        cplObserved: calc.cpl,
        ctlpObserved: calc.ctlp,
        iterations: i + 1,
        converged: true,
      }
    }

    const bump = Math.max(0.001, Math.abs(density60) * 0.000001)
    const calcBump = calculateType1FromDensity60(
      density60 + bump,
      observedTempF,
      observedPressurePsig,
      productGroup
    )

    const estimatedBumpDensity = (density60 + bump) * calcBump.ctlp
    const slope =
      (estimatedBumpDensity - estimatedObservedDensity) / bump

    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) {
      density60 += error
    } else {
      density60 += error / slope
    }

    density60 = Math.min(Math.max(density60, 470), 1210)
  }

  const finalCalc = calculateType1FromDensity60(
    density60,
    observedTempF,
    observedPressurePsig,
    productGroup
  )

  return {
    density60,
    apiGravity60: densityKgM3ToApi(density60),
    ctlObserved: finalCalc.ctl,
    cplObserved: finalCalc.cpl,
    ctlpObserved: finalCalc.ctlp,
    iterations: 20,
    converged: false,
  }
}

function calculateApi11Corrections(input: {
  productGroup?: string
  observedApiGravity?: number
  observedTemperature?: number
  observedPressure?: number
  averageTemperature?: number
  averagePressure?: number
  apiRounding?: number
}) {
  const productGroup = input.productGroup || 'crude'
  const observedApiGravity = Number(input.observedApiGravity || 0)
  const observedTemperature = Number(input.observedTemperature || 60)
  const observedPressure = Number(input.observedPressure || 0)
  const averageTemperature = Number(
    input.averageTemperature || observedTemperature || 60
  )
  const averagePressure = Number(input.averagePressure || 0)

  const base = calculateDensity60FromObservedApi(
    observedApiGravity,
    observedTemperature,
    observedPressure,
    productGroup
  )

  const volumeCorrection = calculateType1FromDensity60(
    base.density60,
    averageTemperature,
    averagePressure,
    productGroup
  )

  return {
    observed_api_gravity: roundTo(observedApiGravity, 5),
    observed_temperature: roundTo(observedTemperature, 2),
    observed_pressure: roundTo(observedPressure, 2),
    api_gravity_60: roundTo(base.apiGravity60, Number(input.apiRounding || 1)),
    density_60: roundTo(base.density60, 6),
    average_temperature: roundTo(averageTemperature, 2),
    average_pressure: roundTo(averagePressure, 2),
    ctl: roundTo(volumeCorrection.ctl, 5),
    cpl: roundTo(volumeCorrection.cpl, 5),
    ctlp: roundTo(volumeCorrection.ctlp, 5),
    ccf: roundTo(volumeCorrection.ccf, 5),
    product_sub_group: volumeCorrection.productSubGroup,
    api_engine: 'API MPMS 11.1 Stage 1',
    api_engine_note: base.converged
      ? 'Calculated from observed API gravity and observed temperature.'
      : 'Calculated but density iteration did not fully converge.',
  }
}


function isThisMonth(dateValue?: string) {
  if (!dateValue) return false
  const d = new Date(dateValue)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function getHighestRole(roles: any[]) {
  const rank: Record<string, number> = {
    super_admin: 5,
    admin: 4,
    measurement_tech: 3,
    operator: 2,
    auditor: 1,
  }

  const activeRoles = (roles || []).filter((role) => role.active !== false)

  if (activeRoles.length === 0) return 'operator'

  return activeRoles
    .slice()
    .sort((a, b) => (rank[b.role] || 0) - (rank[a.role] || 0))[0].role
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState('dashboard')
  const [companyId, setCompanyId] = useState('')
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [companyNameInput, setCompanyNameInput] = useState('')
  const [companyAddress1Input, setCompanyAddress1Input] = useState('')
  const [companyAddress2Input, setCompanyAddress2Input] = useState('')
  const [companyPhoneInput, setCompanyPhoneInput] = useState('')
  const [loading, setLoading] = useState(true)

  const [areas, setAreas] = useState<Area[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketAuditLogs, setTicketAuditLogs] = useState<TicketAuditLog[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string>('operator')
  const [newAdminUserId, setNewAdminUserId] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('operator')
  const [showActiveUsers, setShowActiveUsers] = useState(false)
  const [showCompanyBranding, setShowCompanyBranding] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(true)
  const [showContractProfiles, setShowContractProfiles] = useState(false)
  const [showCompanySetupHub, setShowCompanySetupHub] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [selectedAdminCompanyId, setSelectedAdminCompanyId] = useState('')
  const [newCompanyAdminEmail, setNewCompanyAdminEmail] = useState('')
  const [newCompanyAdminPassword, setNewCompanyAdminPassword] = useState('')
  const [newContractName, setNewContractName] = useState('')
  const [newContractProducer, setNewContractProducer] = useState('')
  const [newContractStandard, setNewContractStandard] = useState('API 11.1 2021')
  const [newContractMethod, setNewContractMethod] = useState('CTPL')
  const [newContractFactorType, setNewContractFactorType] = useState('MF')
  const [newContractProductGroup, setNewContractProductGroup] = useState('crude')
  const [newContractApiRounding, setNewContractApiRounding] = useState('1')
  const [newContractCtlRounding, setNewContractCtlRounding] = useState('5')
  const [newContractCplRounding, setNewContractCplRounding] = useState('5')
  const [newContractCtlpRounding, setNewContractCtlpRounding] = useState('5')
  const [newContractVolumeRounding, setNewContractVolumeRounding] = useState('2')
  const [newContractUsePressure, setNewContractUsePressure] = useState(true)
  const [newContractUseShrink, setNewContractUseShrink] = useState(false)
  const [newContractShrinkFactor, setNewContractShrinkFactor] = useState('1')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [readings, setReadings] = useState<any[]>([])
  const [provings, setProvings] = useState<Proving[]>([])
  const [potQuality, setPotQuality] = useState<PotQuality[]>([])
  const [contractProfiles, setContractProfiles] = useState<ContractProfile[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
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
    const latestReading = readings.find((r: any) => r.meter_id === selectedMeter)
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
  async function reloadCurrentUserRole() {
    const authResult = await supabase.auth.getUser()
    const authUser = authResult.data.user

    if (!authUser) {
      setCurrentUserRole('operator')
      setUserRoles([])
      setCompanyId('')
      return
    }

    const { data: roleRows, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('active', true)

    if (error) {
      console.error('Role load error:', error)
      setCurrentUserRole('operator')
      setUserRoles([])
      return
    }

    const rows = roleRows || []
    setUserRoles(rows)

    const highestRole = getHighestRole(rows)
    setCurrentUserRole(highestRole)

    const companyRole =
      rows.find((role: any) => role.active !== false && role.role !== 'super_admin' && role.company_id) ||
      rows.find((role: any) => role.active !== false && role.company_id)

    setCompanyId(companyRole?.company_id || '')
  }


  async function loadAll() {
    await reloadCurrentUserRole()
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .order('name')

    if (companiesError) {
      console.error('Companies load error:', companiesError)
    }

    if (companiesData) {
      setCompanies(companiesData)
      if (!selectedAdminCompanyId && companiesData.length > 0) {
        setSelectedAdminCompanyId(companiesData[0].id)
      }
    }

    const { data: cu } = await supabase.from('company_users').select('company_id').single()
    if (cu) setCompanyId(cu.company_id)

    const { data: areaData } = await supabase.from('areas').select('*').order('name')
    const { data: segData } = await supabase.from('segments').select('*').order('name')
    const { data: leaseData } = await supabase.from('leases').select('*').order('lease_name')
    const { data: meterData } = await supabase.from('meters').select('*').order('meter_number')
    const { data: ticketData } = await supabase.from('tickets').select('*').order('created_at', { ascending: false })

    const { data: auditData } = await supabase
      .from('ticket_audit_log')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('*')
      .eq('active', true)

    const { data: permissionData } = await supabase
      .from('role_permissions')
      .select('*')
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
    if (auditData) setTicketAuditLogs(auditData)
    if (roleData) setUserRoles(roleData)
    if (permissionData) setRolePermissions(permissionData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
    if (provingData) setProvings(provingData)
    if (potData) setPotQuality(potData)

    const { data: contractProfileData } = await supabase
      .from('contract_profiles')
      .select('*')
      .eq('active', true)
      .order('name')

    if (contractProfileData) setContractProfiles(contractProfileData)
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
  const overdueMeters = meters.filter(
    (m) => getProvingComplianceStatus(m.next_proving_due) === 'OVERDUE'
  )

  const dueSoonMeters = meters.filter(
    (m) => getProvingComplianceStatus(m.next_proving_due) === 'DUE_SOON'
  )

  const compliantMeters = meters.filter(
    (m) => getProvingComplianceStatus(m.next_proving_due) === 'COMPLIANT'
  )

  
  const canViewTickets = hasPermission(
    rolePermissions,
    currentUserRole,
    'tickets',
    'can_view'
  )

  const canCreateTickets = hasPermission(
    rolePermissions,
    currentUserRole,
    'tickets',
    'can_create'
  )

  const canApproveTickets = hasPermission(
    rolePermissions,
    currentUserRole,
    'tickets',
    'can_approve'
  )

  const canApproveProvings = hasPermission(
    rolePermissions,
    currentUserRole,
    'provings',
    'can_approve'
  )

  const canViewAudit = hasPermission(
    rolePermissions,
    currentUserRole,
    'audit',
    'can_view'
  )

  const isReadOnly =
    currentUserRole === 'auditor'

    const isSuperAdmin = currentUserRole === 'super_admin'

const canViewAdmin =
    currentUserRole === 'super_admin' ||
    currentUserRole === 'admin'

  const canEditAdmin =
    currentUserRole === 'super_admin' ||
    currentUserRole === 'admin'
    currentUserRole === 'admin' ||
    userRoles.some((role) => role.active !== false && ['super_admin', 'admin'].includes(role.role))
    currentUserRole === 'admin' ||
    userRoles.length === 0 ||
    !currentUserRole

const provingCompliancePercent =
    meters.length > 0
      ? Math.round((compliantMeters.length / meters.length) * 100)
      : 100

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
    await supabase.from('areas').insert({ company_id: isSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId, name: newArea })
    setNewArea('')
    loadAll()
  }

  async function addSegment() {
    if (!newSegment || !companyId) return
    await supabase.from('segments').insert({ company_id: currentUserRole === 'super_admin' && selectedAdminCompanyId ? selectedAdminCompanyId : companyId, name: newSegment })
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
      proving_frequency_days: 30,
    })
    setNewMeter('')
    setNewMeterName('')
    loadAll()
  }

  async function saveReading() {
    if (isReadOnly) {
      alert('System is in read-only auditor mode.')
      return
    }

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
      api_gravity: Number(
        calculateApi11Corrections({
          productGroup: 'crude',
          observedApiGravity: Number(potGravity || 0),
          observedTemperature: Number(potTemp || 60),
          observedPressure: 0,
          averageTemperature: Number(potTemp || 60),
          averagePressure: 0,
        }).api_gravity_60
      ),
      observed_api_gravity: Number(potGravity || 0),
      observed_temperature: Number(potTemp || 0),
      api_gravity_60: Number(
        calculateApi11Corrections({
          productGroup: 'crude',
          observedApiGravity: Number(potGravity || 0),
          observedTemperature: Number(potTemp || 60),
          observedPressure: 0,
          averageTemperature: Number(potTemp || 60),
          averagePressure: 0,
        }).api_gravity_60
      ),
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
    const latestReading = readings.find((r: any) => r.meter_id === selectedMeter)
    const latestApprovedProving = provings.find((p) => p.meter_id === selectedMeter && p.status === 'approved')
    const latestPot = potQuality.find(
      (p) => p.segment_id === selectedSegment && p.producer_id === selectedProducer && p.lease_id === selectedLease
    )

    const iv = Number(latestReading?.indicated_volume || 0)
    const contractProfile = getProducerProfile(
      contractProfiles,
      selectedProducer || null
    )

    const selectedContractStandard =
      contractProfile?.standard || profile?.standard || ''

    const selectedCalculationMethod =
      contractProfile?.calculation_method || 'CTPL'

    const selectedProductGroup =
      contractProfile?.product_group || 'crude'

    const selectedFactorType =
      contractProfile?.factor_type || latestApprovedProving?.factor_type || 'MF'

    const apiRounding = Number(contractProfile?.api_rounding ?? 1)
    const ctlRounding = Number(contractProfile?.ctl_rounding ?? 5)
    const cplRounding = Number(contractProfile?.cpl_rounding ?? 5)
    const ctlpRounding = Number(contractProfile?.ctlp_rounding ?? 5)
    const volumeRounding = Number(contractProfile?.volume_rounding ?? 2)
    const usePressure = contractProfile?.use_pressure !== false
    const shrinkFactor = contractProfile?.use_shrink
      ? Number(contractProfile?.shrink_factor || 1)
      : 1

    const avgTemp = Number(latestReading?.average_temperature || latestReading?.temperature || 60)
    const avgPressure = Number(latestReading?.average_pressure || 0)

    const productGroup = selectedProductGroup

    const corrections = calculateApi11Corrections({
      productGroup,
      observedApiGravity: Number(
        latestPot?.observed_api_gravity ||
          latestPot?.api_gravity ||
          latestPot?.api_gravity_60 ||
          0
      ),
      observedTemperature: Number(
        latestPot?.observed_temperature ||
          latestPot?.sample_temperature ||
          60
      ),
      observedPressure: 0,
      averageTemperature: avgTemp,
      averagePressure: usePressure ? avgPressure : 0,
      apiRounding,
    })

    const ctl = roundTo(corrections.ctl, ctlRounding)
    const cpl = roundTo(corrections.cpl, cplRounding)
    const ctlp = roundTo(corrections.ctlp, ctlpRounding)
    const ccf = corrections.ccf

    const factorToUse = Number(latestApprovedProving?.accepted_meter_factor || latestReading?.meter_factor || 1)
    const mf = roundTo(factorToUse, 4)
    const csw = Number(latestPot?.csw || 1)
    const isApi12 = selectedContractStandard.includes('API 12')
    const gsv = isApi12 ? iv * ctl * cpl * mf : iv * ccf * mf
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
      contract_profile_id: contractProfile?.id || null,
      calculation_profile_snapshot: {
        ...(profile || {}),
        contract_profile: contractProfile || null,
        selected_standard: selectedContractStandard,
        selected_calculation_method: selectedCalculationMethod,
        selected_product_group: selectedProductGroup,
        selected_factor_type: selectedFactorType,
      },
      api_chapter: profile?.standard || null,
      calculation_method: corrections.api_engine,
      observed_api_gravity: corrections.observed_api_gravity,
      observed_temperature: corrections.observed_temperature,
      observed_pressure: corrections.observed_pressure,
      api_gravity_60: corrections.api_gravity_60,
      density_60: corrections.density_60,
      ctl,
      cpl,
      ctlp,
      ccf,
      observed_inputs: {
        iv,
        ctl,
        cpl,
        ctlp,
        mf,
        factor_type: selectedFactorType,
        observed_api_gravity: corrections.observed_api_gravity,
        observed_temperature: corrections.observed_temperature,
        observed_pressure: corrections.observed_pressure,
        api_gravity_60: corrections.api_gravity_60,
        density_60: corrections.density_60,
        api_gravity: corrections.api_gravity_60,
        temperature: corrections.observed_temperature,
        average_temperature: corrections.average_temperature,
        average_pressure: corrections.average_pressure,
        bsw_percent: latestPot?.bsw || null,
        csw,
        mf_source: latestApprovedProving ? 'latest_approved_proving' : 'reading_fallback',
        pot_source: latestPot ? 'latest_pot_quality' : 'none',
        api_engine: corrections.api_engine,
        api_engine_note: corrections.api_engine_note,
        contract_profile_name: contractProfile?.name || null,
        calculation_method: selectedCalculationMethod,
        product_group: selectedProductGroup,
        shrink_factor: shrinkFactor,
        product_sub_group: corrections.product_sub_group,
      },
      calculation_results: {
        ctl,
        cpl,
        ctlp,
        ccf,
        gsv: roundTo(gsv, volumeRounding),
        nsv: roundTo(nsv, volumeRounding),
        api_gravity_60: corrections.api_gravity_60,
        density_60: corrections.density_60,
        product_sub_group: corrections.product_sub_group,
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
            .box { border: 1px solid #333; padding: 12px; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 6px 0; }
          </style>
        </head>
        <body>
          <h1>TEFCO Measurement Ticket</h1>
          <h2>${ticket.ticket_number}</h2>
          <div class="box">
            <div class="row"><strong>Status</strong><span>${ticket.status}{ticket.is_locked ? ' • LOCKED' : ''}</span></div>
            <div class="row"><strong>Type</strong><span>${ticket.ticket_type}</span></div>
            <div class="row"><strong>Producer</strong><span>${producer?.name || ''}</span></div>
            <div class="row"><strong>Meter</strong><span>${meter?.meter_number || ''}</span></div>
            <div class="row"><strong>Segment</strong><span>${segment?.name || ''}</span></div>
            <div class="row"><strong>Profile</strong><span>${ticket.calculation_profile_snapshot?.name || ''}</span></div>
            <div class="row"><strong>Contract Profile</strong><span>${ticket.observed_inputs?.contract_profile_name || ticket.calculation_profile_snapshot?.contract_profile?.name || 'Default'}</span></div>
            <div class="row"><strong>Calculation Method</strong><span>${ticket.observed_inputs?.calculation_method || ticket.calculation_profile_snapshot?.selected_calculation_method || 'CTPL'}</span></div>
          </div>
          <div class="box">
            <h3>Observed Inputs</h3>
            <div class="row"><strong>IV</strong><span>${ticket.observed_inputs?.iv ?? ''}</span></div>
            <div class="row"><strong>CTL</strong><span>${ticket.observed_inputs?.ctl ?? ''}</span></div>
            <div class="row"><strong>CPL</strong><span>${ticket.observed_inputs?.cpl ?? ''}</span></div>
            <div class="row"><strong>CTLP</strong><span>${ticket.observed_inputs?.ctlp ?? ''}</span></div>
            <div class="row"><strong>${ticket.observed_inputs?.factor_type || 'MF'}</strong><span>${ticket.observed_inputs?.mf ?? ''}</span></div>
            <div class="row"><strong>Observed API Gravity</strong><span>${ticket.observed_inputs?.observed_api_gravity ?? ticket.observed_inputs?.api_gravity ?? ''}</span></div>
            <div class="row"><strong>Observed Temp</strong><span>${ticket.observed_inputs?.observed_temperature ?? ticket.observed_inputs?.temperature ?? ''}</span></div>
            <div class="row"><strong>API Gravity @60</strong><span>${formatOneDecimal(ticket.observed_inputs?.api_gravity_60 ?? ticket.api_gravity_60)}</span></div>
            <div class="row"><strong>Density @60 kg/m³</strong><span>${ticket.observed_inputs?.density_60 ?? ticket.density_60 ?? ''}</span></div>
            <div class="row"><strong>Avg Temp</strong><span>${ticket.observed_inputs?.average_temperature ?? ''}</span></div>
            <div class="row"><strong>Avg Pressure</strong><span>${ticket.observed_inputs?.average_pressure ?? ''}</span></div>
            <div class="row"><strong>BS&W %</strong><span>${ticket.observed_inputs?.bsw_percent ?? ''}</span></div>
            <div class="row"><strong>CSW</strong><span>${ticket.observed_inputs?.csw ?? ''}</span></div>
          </div>
          <div class="box">
            <h3>Calculated Results</h3>
            <div class="row"><strong>CCF</strong><span>${ticket.calculation_results?.ccf ?? ''}</span></div>
            <div class="row"><strong>GSV</strong><span>${ticket.calculation_results?.gsv ?? ''}</span></div>
            <div class="row"><strong>NSV</strong><span>${ticket.calculation_results?.nsv ?? ''}</span></div>
          </div>
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

  
  
  
  
  function getCompanyLogoUrl() {
    if (companyLogoFile) {
      return URL.createObjectURL(companyLogoFile)
    }

    return companySettings?.logo_url || ''
  }

  async function saveCompanySettings() {
    if (!companyId && currentUserRole !== 'super_admin') {
      alert('Company not loaded.')
      return
    }

    let logoUrl = companySettings?.logo_url || null

    if (companyLogoFile && companyId) {
      const ext = companyLogoFile.name.split('.').pop() || 'png'
      const logoPath = `${companyId}/company-logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(logoPath, companyLogoFile, {
          upsert: true,
          contentType: companyLogoFile.type || 'image/png',
        })

      if (uploadError) {
        alert('Could not upload logo: ' + uploadError.message)
        return
      }

      const { data } = supabase.storage.from('company-logos').getPublicUrl(logoPath)
      logoUrl = data?.publicUrl || null
    }

    const payload = {
      company_id: companyId || null,
      company_name: companyNameInput || null,
      address_line1: companyAddress1Input || null,
      address_line2: companyAddress2Input || null,
      phone: companyPhoneInput || null,
      logo_url: logoUrl,
    }

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select()
      .maybeSingle()

    if (error) {
      alert('Could not save company branding: ' + error.message)
      return
    }

    if (data) setCompanySettings(data)
    setCompanyLogoFile(null)
    alert('Company branding saved.')
  }

async function createCompany() {
    const name = newCompanyName.trim()

    if (!name) {
      alert('Enter company name.')
      return
    }

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name,
        slug,
        active: true,
      })
      .select()
      .single()

    if (error) {
      alert('Could not create company: ' + error.message)
      return
    }

    if (data) {
      setCompanies((prev) => {
        const exists = prev.some((company) => company.id === data.id)
        return exists ? prev : [data, ...prev]
      })
      setSelectedAdminCompanyId(data.id)
    }

    setNewCompanyName('')
    alert('Company created.')
  }

  async function createCompanyAdminUser() {
    if (!isSuperAdmin && userRoles.length > 0) {
      alert('Only a Super Admin can create company admins.')
      return
    }

    if (!selectedAdminCompanyId || !newCompanyAdminEmail || !newCompanyAdminPassword) {
      alert('Select company and enter admin email/password.')
      return
    }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: newCompanyAdminEmail,
        password: newCompanyAdminPassword,
        role: 'admin',
        company_id: selectedAdminCompanyId,
      },
    })

    if (error || data?.error) {
      alert(data?.error || error?.message || 'Could not create company admin.')
      return
    }

    setNewCompanyAdminEmail('')
    setNewCompanyAdminPassword('')
    alert('Company admin created.')
    loadAll()
  }

async function createAppUser() {
    if (!newAdminEmail || !newAdminPassword) {
      alert('Enter email and temporary password.')
      return
    }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: newAdminEmail,
        password: newAdminPassword,
        role: newAdminRole,
        company_id: companyId,
      },
    })

    if (error || data?.error) {
      alert(data?.error || error?.message || 'Could not create user.')
      return
    }

    setNewAdminEmail('')
    setNewAdminPassword('')
    setNewAdminUserId('')
    setNewAdminRole('operator')

    alert('User created successfully.')
  }

async function saveUserRole() {
    if (!canEditAdmin) {
      alert('You do not have permission to manage users.')
      return
    }

    if (!companyId || !newAdminUserId || !newAdminRole) {
      alert('Enter a user ID and role.')
      return
    }

    const { error } = await supabase.from('user_roles').insert({
      company_id: companyId,
      user_id: newAdminUserId,
      role: newAdminRole,
      active: true,
    })

    if (error) {
      alert('Could not save user role: ' + error.message)
      return
    }

    setNewAdminUserId('')
    setNewAdminRole('operator')
    alert('User role saved.')
    loadAll()
  }

  async function deactivateUserRole(roleId: string) {
    if (!canEditAdmin) {
      alert('You do not have permission to manage users.')
      return
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ active: false })
      .eq('id', roleId)

    if (error) {
      alert('Could not deactivate role: ' + error.message)
      return
    }

    loadAll()
  }

  async function saveContractProfile() {
    if (!canEditAdmin) {
      alert('You do not have permission to manage contract profiles.')
      return
    }

    if (!companyId || !newContractName) {
      alert('Enter a contract profile name.')
      return
    }

    const { error } = await supabase.from('contract_profiles').insert({
      company_id: companyId,
      producer_id: newContractProducer || null,
      name: newContractName,
      standard: newContractStandard,
      calculation_method: newContractMethod,
      factor_type: newContractFactorType,
      product_group: newContractProductGroup,
      api_rounding: Number(newContractApiRounding || 1),
      ctl_rounding: Number(newContractCtlRounding || 5),
      cpl_rounding: Number(newContractCplRounding || 5),
      ctlp_rounding: Number(newContractCtlpRounding || 5),
      volume_rounding: Number(newContractVolumeRounding || 2),
      use_pressure: newContractUsePressure,
      use_shrink: newContractUseShrink,
      shrink_factor: Number(newContractShrinkFactor || 1),
      active: true,
    })

    if (error) {
      alert('Could not save contract profile: ' + error.message)
      return
    }

    setNewContractName('')
    setNewContractProducer('')
    setNewContractStandard('API 11.1 2021')
    setNewContractMethod('CTPL')
    setNewContractFactorType('MF')
    setNewContractProductGroup('crude')
    setNewContractApiRounding('1')
    setNewContractCtlRounding('5')
    setNewContractCplRounding('5')
    setNewContractCtlpRounding('5')
    setNewContractVolumeRounding('2')
    setNewContractUsePressure(true)
    setNewContractUseShrink(false)
    setNewContractShrinkFactor('1')

    alert('Contract profile saved.')
    loadAll()
  }

  async function deactivateContractProfile(profileId: string) {
    if (!canEditAdmin) {
      alert('You do not have permission to manage contract profiles.')
      return
    }

    const { error } = await supabase
      .from('contract_profiles')
      .update({ active: false })
      .eq('id', profileId)

    if (error) {
      alert('Could not deactivate contract profile: ' + error.message)
      return
    }

    loadAll()
  }

async function logout() {
    await supabase.auth.signOut()
  }

  const box: CSSProperties = {
    background: 'linear-gradient(145deg, rgba(28,32,35,0.98), rgba(10,15,18,0.98))',
    border: '1px solid rgba(196,106,43,0.28)',
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
    color: '#f8fafc',
    boxShadow: '0 18px 40px rgba(0,0,0,0.32)',
  }
  const card: CSSProperties = {
    background: 'linear-gradient(145deg, rgba(20,25,28,1), rgba(9,13,16,1))',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: 15,
    borderRadius: 14,
    marginBottom: 10,
    color: '#f8fafc',
    boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
  }
  const input: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    marginTop: 10,
    color: '#f8fafc',
    background: '#0b1117',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    outline: 'none',
  }
  const button: CSSProperties = {
    width: '100%',
    padding: 12,
    marginTop: 10,
    background: 'linear-gradient(135deg, #c46a2b, #7a3b18)',
    color: 'white',
    border: '1px solid #e08745',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 0 18px rgba(196,106,43,0.24)',
  }

  const kpiCard: CSSProperties = {
    ...card,
    minHeight: 92,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    border: '1px solid rgba(196,106,43,0.22)',
  }

  const ticketRow: CSSProperties = {
    ...card,
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr auto',
    gap: 12,
    alignItems: 'center',
  }

  function getTicketStatusStyle(status?: string | null): CSSProperties {
    const normalized = status || 'draft'
    const base: CSSProperties = {
      display: 'inline-block',
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    }
    if (normalized === 'approved') return { ...base, color: '#bbf7d0', background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(34,197,94,0.36)' }
    if (normalized === 'submitted') return { ...base, color: '#fde68a', background: 'rgba(202,138,4,0.18)', border: '1px solid rgba(234,179,8,0.36)' }
    if (normalized === 'voided') return { ...base, color: '#fecaca', background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(248,113,113,0.36)' }
    return { ...base, color: '#fed7aa', background: 'rgba(196,106,43,0.16)', border: '1px solid rgba(196,106,43,0.36)' }
  }



  const adminHeaderCard: CSSProperties = {
    ...box,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  }

  const sectionToggle: CSSProperties = {
    ...button,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    background: 'linear-gradient(135deg, rgba(196,106,43,0.95), rgba(122,59,24,0.95))',
  }

  const adminGrid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  }

  const rolePill: CSSProperties = {
    display: 'inline-block',
    padding: '4px 9px',
    borderRadius: 999,
    background: 'rgba(196,106,43,0.16)',
    border: '1px solid rgba(196,106,43,0.36)',
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 700,
  }


  if (loading) return <div style={{ padding: 40, color: 'white' }}>Loading...</div>
  if (!session) return <Login />

  return (
    <>
      <style>{`
        input::placeholder { color: rgba(248,250,252,0.48); }
        select option { background: #0b1117; color: #f8fafc; }
        button:hover { filter: brightness(1.08); }
        h1, h2, h3 { color: #f8fafc; }
      `}</style>
    <div style={{
      background: 'radial-gradient(circle at top left, rgba(196,106,43,0.16), transparent 28%), #070a0d',
      color: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    }}>
      <aside style={{
        width: 250,
        background: 'linear-gradient(180deg, #111820 0%, #070a0d 100%)',
        padding: 20,
        borderRight: '1px solid rgba(196,106,43,0.28)',
        boxShadow: '10px 0 30px rgba(0,0,0,0.35)',
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>
            TEFCO <span style={{ color: '#c46a2b' }}>V2</span>
          </div>
          <div style={{ fontSize: 12, color: '#a8b3bd', marginTop: 4 }}>
            Measurement Platform
          </div>
        </div>

        {['dashboard', 'admin', 'reports', 'readings', 'pot', 'provings', 'tickets'].map((p) => (
          <button key={p} onClick={() => setPage(p)} style={button}>
            {p.toUpperCase()}
          </button>
        ))}

        <button onClick={logout} style={{ ...button, background: '#dc2626', marginTop: 30 }}>
          Logout
        </button>
      </aside>

      <main style={{
        flex: 1,
        padding: 30,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), #070a0d',
      }}>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            {/* Phase 3 Dashboard KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Total Tickets</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Approved</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.filter((t) => t.status === 'approved').length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Draft / Working</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.filter((t) => !t.status || t.status === 'draft').length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Meters</div><div style={{ fontSize: 30, fontWeight: 900 }}>{meters.length}</div></div>
            </div>
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


        {page === 'admin' && (
          <>
            <div style={adminHeaderCard}>
              <div>
                <h1 style={{ margin: 0 }}>
                  Admin <span style={{ color: '#c46a2b' }}>/</span> Settings
                </h1>
                <div style={{ color: '#a8b3bd', marginTop: 6 }}>
                  Company setup, users, roles, branding, and contract configuration.
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={rolePill}>{currentUserRole}</div>
                <div style={{ fontSize: 12, color: '#a8b3bd', marginTop: 6 }}>
                  Company: {companyId || 'none'}
                </div>
              </div>
            </div>

            {currentUserRole === 'super_admin' && (
              <div style={box}>
                <h2>Super Admin: Companies</h2>
                <p style={{ color: '#a8b3bd' }}>
                  Create customer companies and assign the first company admin.
                  Company admins will only manage their own company setup.
                </p>

                <div style={adminGrid}>
                  <div style={card}>
                    <h3>Create Company</h3>
                    <input
                      style={input}
                      placeholder="Company Name"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                    />
                    <button style={button} onClick={createCompany}>
                      Create Company
                    </button>
                  </div>

                  <div style={card}>
                    <h3>Create First Admin</h3>

                    <select
                      style={input}
                      value={selectedAdminCompanyId}
                      onChange={(e) => setSelectedAdminCompanyId(e.target.value)}
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>

                    <input
                      style={input}
                      placeholder="Admin Email"
                      value={newCompanyAdminEmail}
                      onChange={(e) => setNewCompanyAdminEmail(e.target.value)}
                    />

                    <input
                      style={input}
                      type="password"
                      placeholder="Temporary Password"
                      value={newCompanyAdminPassword}
                      onChange={(e) => setNewCompanyAdminPassword(e.target.value)}
                    />

                    <button style={button} onClick={createCompanyAdminUser}>
                      Create Company Admin
                    </button>
                  </div>
                </div>

                <button style={{ ...button, marginTop: 16 }} onClick={loadAll}>
                  Refresh Companies
                </button>

                <div style={{ marginTop: 14 }}>
                  <h3>Companies ({companies.length})</h3>
                  <div style={adminGrid}>
                    {companies.map((company) => (
                      <div key={company.id} style={card}>
                        <strong>{company.name}</strong>
                        <div style={{ fontSize: 12, color: '#a8b3bd', marginTop: 6 }}>
                          ID: {company.id}
                        </div>
                        <div style={{ color: '#16a34a', marginTop: 6 }}>
                          {company.active === false ? 'Inactive' : 'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={box}>
              <button
                style={sectionToggle}
                onClick={() => setShowCompanyBranding(!showCompanyBranding)}
              >
                <span>{showCompanyBranding ? '▼' : '▶'} Company Branding</span>
                <span>Logo / Theme</span>
              </button>

              {showCompanyBranding && (
                <div style={adminGrid}>
                  <div style={card}>
                    <h3>Company Info</h3>

                    <input
                      style={input}
                      placeholder="Company Name"
                      value={companyNameInput}
                      onChange={(e) => setCompanyNameInput(e.target.value)}
                    />

                    <input
                      style={input}
                      placeholder="Address Line 1"
                      value={companyAddress1Input}
                      onChange={(e) => setCompanyAddress1Input(e.target.value)}
                    />

                    <input
                      style={input}
                      placeholder="Address Line 2"
                      value={companyAddress2Input}
                      onChange={(e) => setCompanyAddress2Input(e.target.value)}
                    />

                    <input
                      style={input}
                      placeholder="Phone"
                      value={companyPhoneInput}
                      onChange={(e) => setCompanyPhoneInput(e.target.value)}
                    />

                    <button style={button} onClick={saveCompanySettings}>
                      Save Company Branding
                    </button>
                  </div>

                  <div style={card}>
                    <h3>Logo</h3>
                    {getCompanyLogoUrl() ? (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                        <img
                          src={getCompanyLogoUrl()}
                          alt="Company Logo"
                          style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div style={{ color: '#a8b3bd', marginBottom: 12 }}>
                        No logo uploaded yet.
                      </div>
                    )}

                    <input
                      style={input}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCompanyLogoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={box}>
              <button
                style={sectionToggle}
                onClick={() => setShowUserManagement(!showUserManagement)}
              >
                <span>{showUserManagement ? '▼' : '▶'} User Management</span>
                <span>Create / Manage</span>
              </button>

              {showUserManagement && (
                <>
                  <p style={{ color: '#a8b3bd' }}>
                    Create users by email/password. UUIDs are handled automatically in the background.
                  </p>

                  {currentUserRole === 'super_admin' && (
                    <select
                      style={input}
                      value={selectedAdminCompanyId}
                      onChange={(e) => setSelectedAdminCompanyId(e.target.value)}
                    >
                      <option value="">Select Company For New User</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <div style={adminGrid}>
                    <input
                      style={input}
                      placeholder="User Email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />

                    <input
                      style={input}
                      type="password"
                      placeholder="Temporary Password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                    />

                    <select
                      style={input}
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value)}
                    >
                      <option value="operator">Operator</option>
                      <option value="measurement_tech">Measurement Tech</option>
                      <option value="admin">Admin</option>
                      {currentUserRole === 'super_admin' && (
                        <option value="super_admin">Super Admin</option>
                      )}
                    </select>

                    <button style={button} onClick={createAppUser}>
                      Create User
                    </button>
                  </div>

                  <button
                    style={{ ...sectionToggle, marginTop: 14 }}
                    onClick={() => setShowActiveUsers(!showActiveUsers)}
                  >
                    <span>{showActiveUsers ? '▼' : '▶'} Active Users ({userRoles.length})</span>
                    <span>Manage</span>
                  </button>

                  {showActiveUsers && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {userRoles.map((role) => (
                        <div
                          key={role.id}
                          style={{
                            ...card,
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 12,
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong>{role.role}</strong>
                            <div style={{ fontSize: 12, color: '#a8b3bd' }}>
                              User ID: {role.user_id}
                            </div>
                            <div style={{ fontSize: 12, color: '#a8b3bd' }}>
                              Company: {role.company_id || 'global'}
                            </div>
                          </div>

                          {role.active !== false && (
                            <button
                              style={{ ...button, background: '#991b1b', borderColor: '#ef4444' }}
                              onClick={() => deactivateUserRole(role.id)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={box}>
              <button
                style={sectionToggle}
                onClick={() => setShowContractProfiles(!showContractProfiles)}
              >
                <span>{showContractProfiles ? '▼' : '▶'} Contract Profiles</span>
                <span>Profiles / Standards</span>
              </button>

              {showContractProfiles && (
                <div>
                  <p style={{ color: '#a8b3bd' }}>
                    Contract profiles control API chapter, rounding, factor type, and product calculation method.
                  </p>

                  <div style={adminGrid}>
                    <input
                      style={input}
                      placeholder="Contract Name"
                      value={newContractName}
                      onChange={(e) => setNewContractName(e.target.value)}
                    />

                    <select style={input} value={newContractProducer} onChange={(e) => setNewContractProducer(e.target.value)}>
                      <option value="">Default / All Producers</option>
                      {producers.map((producer) => (
                        <option key={producer.id} value={producer.id}>{producer.name}</option>
                      ))}
                    </select>

                    <select style={input} value={newContractStandard} onChange={(e) => setNewContractStandard(e.target.value)}>
                      <option value="API 11.1 2021">API 11.1 2021</option>
                      <option value="API 11.1 2004">API 11.1 2004</option>
                      <option value="Chapter 12.2.1 2021">Chapter 12.2.1 2021</option>
                    </select>

                    <button style={button} onClick={saveContractProfile}>
                      Create Contract Profile
                    </button>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    {contractProfiles.map((profile) => (
                      <div key={profile.id} style={card}>
                        <strong>{profile.name}</strong>
                        <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                          {profile.standard} / {profile.calculation_method}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={box}>
              <button
                style={sectionToggle}
                onClick={() => setShowCompanySetupHub(!showCompanySetupHub)}
              >
                <span>{showCompanySetupHub ? '▼' : '▶'} Company Setup Hub</span>
                <span>Areas / Leases / Meters</span>
              </button>

              {showCompanySetupHub && (
                <div>
                  <p style={{ color: '#a8b3bd' }}>
                    Manage operational setup for this company.
                  </p>

                  <div style={adminGrid}>
                    <button style={button} onClick={() => setPage('areas')}>Manage Areas</button>
                    <button style={button} onClick={() => setPage('segments')}>Manage Segments</button>
                    <button style={button} onClick={() => setPage('leases')}>Manage Leases</button>
                    <button style={button} onClick={() => setPage('producers')}>Manage Producers</button>
                    <button style={button} onClick={() => setPage('meters')}>Manage Meters</button>
                  </div>
                </div>
              )}
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
              <input style={input} placeholder="Observed API Gravity" value={potGravity} onChange={(e) => setPotGravity(e.target.value)} />
              <input style={input} placeholder="Observed Temperature" value={potTemp} onChange={(e) => setPotTemp(e.target.value)} />
              <div style={card}>
                Calculated API Gravity @60:{' '}
                {calculateApi11Corrections({
                  productGroup: 'crude',
                  observedApiGravity: Number(potGravity || 0),
                  observedTemperature: Number(potTemp || 60),
                  observedPressure: 0,
                  averageTemperature: Number(potTemp || 60),
                  averagePressure: 0,
                }).api_gravity_60}
              </div>
              <input style={input} placeholder="BS&W %" value={potBSW} onChange={(e) => setPotBSW(e.target.value)} />
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
                    <div>Observed API Gravity: {p.observed_api_gravity ?? p.api_gravity}</div>
                    <div>Observed Temp: {p.observed_temperature ?? p.sample_temperature}</div>
                    <div>API Gravity @60: {p.api_gravity_60 ?? p.api_gravity}</div>
                    <div>BS&W: {p.bsw}</div>
                    <div>CSW: {p.csw}</div>
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
                <div>POT Observed API Gravity: {autofillPreview?.pot?.observed_api_gravity ?? autofillPreview?.pot?.api_gravity ?? 'None'}</div>
                <div>POT Observed Temp: {autofillPreview?.pot?.observed_temperature ?? autofillPreview?.pot?.sample_temperature ?? 'None'}</div>
                <div>POT API Gravity @60: {autofillPreview?.pot?.api_gravity_60 ?? autofillPreview?.pot?.api_gravity ?? 'None'}</div>
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
                  <div><span style={getTicketStatusStyle(t.status)}>{t.status || 'draft'}</span></div>
                  <div>Type: {t.ticket_type}</div>
                  <div>Factor Type: {t.observed_inputs?.factor_type || 'MF'}</div>
                  <div>Factor Source: {t.observed_inputs?.mf_source || 'None'}</div>
                  <div>POT Source: {t.observed_inputs?.pot_source || 'None'}</div>
                  <div>GSV: {t.calculation_results?.gsv ?? 'None'}</div>
                  <div>NSV: {t.calculation_results?.nsv ?? 'None'}</div>
                  <button style={button} onClick={() => { setSelectedTicket(t); setPage('tickets') }}>Open Ticket →</button>
                </div>
              ))}
            </div>

            <div style={box}>
              <h3>Approved Tickets</h3>
              {approvedTickets.length === 0 && <div style={card}>No approved tickets yet.</div>}
              {approvedTickets.map((t) => (
                <div key={t.id} style={card}>
                  <strong>{t.ticket_number}</strong>
                  <div><span style={getTicketStatusStyle(t.status)}>{t.status || 'draft'}</span></div>
                  <div>NSV: {t.calculation_results?.nsv ?? 'None'}</div>
                  <button style={button} onClick={() => { setSelectedTicket(t); setPage('tickets') }}>Open Approved Ticket</button>
                </div>
              ))}
            </div>

            {selectedTicket && canViewAudit && (
              <div style={box}>
                <h2>Ticket Detail</h2>
                <div><strong>Ticket:</strong> {selectedTicket.ticket_number}</div>
                <div><strong>Locked:</strong> {selectedTicket.is_locked ? 'Yes' : 'No'}</div>
                <div><strong>Locked At:</strong> {selectedTicket.locked_at || 'N/A'}</div>
                <div><strong>Status:</strong> {selectedTicket.status}</div>
                <div><strong>Type:</strong> {selectedTicket.ticket_type}</div>
                <div><strong>Profile:</strong> {selectedTicket.calculation_profile_snapshot?.name || 'None'}</div>
                <div><strong>Contract Profile:</strong> {selectedTicket.observed_inputs?.contract_profile_name || selectedTicket.calculation_profile_snapshot?.contract_profile?.name || 'Default'}</div>
                <div><strong>Calculation Method:</strong> {selectedTicket.observed_inputs?.calculation_method || selectedTicket.calculation_profile_snapshot?.selected_calculation_method || 'CTPL'}</div>

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
                  <h3>Observed Inputs</h3>
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
                  <h3>Calculated Results</h3>
                  <div>CCF: {selectedTicket.calculation_results?.ccf}</div>
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
    </>
  )
}

export default App
