import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import JSZip from 'jszip'

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
  created_at?: string | null
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
  const [systemHealthChecks, setSystemHealthChecks] = useState<any[]>([])
  const [systemHealthRunning, setSystemHealthRunning] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [meterCsvFile, setMeterCsvFile] = useState<File | null>(null)
  const [strappingCsvFile, setStrappingCsvFile] = useState<File | null>(null)
  const [selectedStrappingTankId, setSelectedStrappingTankId] = useState('')
  const [newTankNumber, setNewTankNumber] = useState('')
  const [newTankName, setNewTankName] = useState('')
  const [newTankSegmentId, setNewTankSegmentId] = useState('')
  const [newLineFillName, setNewLineFillName] = useState('')
  const [newLineFillSegmentId, setNewLineFillSegmentId] = useState('')
  const [newLineFillCapacity, setNewLineFillCapacity] = useState('')
  const [flowxCsvFile, setFlowxCsvFile] = useState<File | null>(null)
  const [flowxMappingRows, setFlowxMappingRows] = useState<any[]>([])
  const [flowxMappingHeaders, setFlowxMappingHeaders] = useState<string[]>([])
  const [flowxColumnMap, setFlowxColumnMap] = useState<any>({
    ticket_number: '',
    batch_number: '',
    truck_number: '',
    driver_name: '',
    customer_name: '',
    producer_name: '',
    transporter_name: '',
    lease_name: '',
    meter_number: '',
    segment_name: '',
    gross_volume_bbl: '',
    net_volume_bbl: '',
    api_gravity: '',
    observed_temperature: '',
    bsw_percent: '',
    open_datetime: '',
    close_datetime: '',
  })
  const [flowxLactName, setFlowxLactName] = useState('')
  const [flowxDefaultSegmentId, setFlowxDefaultSegmentId] = useState('')
  const [flowxTransporter1, setFlowxTransporter1] = useState('')
  const [flowxTransporter2, setFlowxTransporter2] = useState('')
  const [flowxTransporter3, setFlowxTransporter3] = useState('')
  const [flowxTransporter4, setFlowxTransporter4] = useState('')
  const [flowxPercent1, setFlowxPercent1] = useState('')
  const [flowxPercent2, setFlowxPercent2] = useState('')
  const [flowxPercent3, setFlowxPercent3] = useState('')
  const [flowxPercent4, setFlowxPercent4] = useState('')
    const [flowxCustomer1, setFlowxCustomer1] = useState('')
  const [flowxCustomer2, setFlowxCustomer2] = useState('')
  const [flowxCustomer3, setFlowxCustomer3] = useState('')
  const [flowxCustomer4, setFlowxCustomer4] = useState('')
const [flowxManualSplitOverride, setFlowxManualSplitOverride] = useState(false)
  const [flowxAutoSplits, setFlowxAutoSplits] = useState<any[]>([])
  const [inventoryStartDate, setInventoryStartDate] = useState('')
  const [inventoryEndDate, setInventoryEndDate] = useState('')
  const [inventorySegmentId, setInventorySegmentId] = useState('')
  const [overShortStartDate, setOverShortStartDate] = useState('')
  const [overShortEndDate, setOverShortEndDate] = useState('')
  const [overShortSegmentId, setOverShortSegmentId] = useState('')
  const [reportCenterSection, setReportCenterSection] = useState('tickets')
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportProducerId, setReportProducerId] = useState('')
  const [reportSegmentId, setReportSegmentId] = useState('')
  const [deadwoodTankId, setDeadwoodTankId] = useState('')
  const [deadwoodStartGauge, setDeadwoodStartGauge] = useState('')
  const [deadwoodEndGauge, setDeadwoodEndGauge] = useState('')
  const [deadwoodAdjustmentBbl, setDeadwoodAdjustmentBbl] = useState('')
  const [deadwoodAdjustmentType, setDeadwoodAdjustmentType] = useState('add')
  const [deadwoodDescription, setDeadwoodDescription] = useState('')
  const [meterCsvImporting, setMeterCsvImporting] = useState(false)
  const [hasLocalTicketDraft, setHasLocalTicketDraft] = useState(false)
  const [draftRestoredMessage, setDraftRestoredMessage] = useState('')
  const [isActionRunning, setIsActionRunning] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [pdfBundleStartDate, setPdfBundleStartDate] = useState('')
  const [pdfBundleEndDate, setPdfBundleEndDate] = useState('')
  const [pdfBundleProducerId, setPdfBundleProducerId] = useState('')
  const [potCsvStartDate, setPotCsvStartDate] = useState('')
  const [potCsvEndDate, setPotCsvEndDate] = useState('')
  const [potCsvProducerId, setPotCsvProducerId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [companyNameInput, setCompanyNameInput] = useState('')
  const [companyAddress1Input, setCompanyAddress1Input] = useState('')
  const [companyAddress2Input, setCompanyAddress2Input] = useState('')
  const [companyPhoneInput, setCompanyPhoneInput] = useState('')
  const [companyAccentInput, setCompanyAccentInput] = useState('#c46a2b')
  const [loading, setLoading] = useState(true)

  const [areas, setAreas] = useState<Area[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [tanks, setTanks] = useState<any[]>([])
  const [lineFills, setLineFills] = useState<any[]>([])
  const [meterAssetConfigs, setMeterAssetConfigs] = useState<any[]>([])
  const [tankCalibrationVersions, setTankCalibrationVersions] = useState<any[]>([])
  const [tankStrappingRows, setTankStrappingRows] = useState<any[]>([])
  const [tankDeadwoodRules, setTankDeadwoodRules] = useState<any[]>([])
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
  const [transporterPotRules, setTransporterPotRules] = useState<any[]>([])
  const [newTransporterPotName, setNewTransporterPotName] = useState('')
  const [newTransporterPotId, setNewTransporterPotId] = useState('')
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
  const [selectedTank, setSelectedTank] = useState('')
  const [selectedLineFill, setSelectedLineFill] = useState('')
  const [openingGauge, setOpeningGauge] = useState('')
  const [closingGauge, setClosingGauge] = useState('')
  const [tankMovementDirection, setTankMovementDirection] = useState('delivery')
  const [tankClosingFeet, setTankClosingFeet] = useState('')
  const [tankClosingInches, setTankClosingInches] = useState('')
  const [tankClosingEighths, setTankClosingEighths] = useState('')
  const [tankAverageTemp, setTankAverageTemp] = useState('')
  const [tankAmbientTemp, setTankAmbientTemp] = useState('')
  const [tankObservedGravity, setTankObservedGravity] = useState('')
  const [tankObservedTemp, setTankObservedTemp] = useState('')
  const [tankSwPercent, setTankSwPercent] = useState('')
  const [manualClosingReading, setManualClosingReading] = useState('')
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
    function handleMobileResize() {
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setMobileMenuOpen(true)
      }
    }

    handleMobileResize()
    window.addEventListener('resize', handleMobileResize)
    return () => window.removeEventListener('resize', handleMobileResize)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMobileMenuOpen(window.innerWidth <= 768)
    }
  }, [])

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

  const userIsSuperAdmin = currentUserRole === 'super_admin'
  const userIsCompanyAdmin = currentUserRole === 'admin'
  const userCanManageCompanySetup = userIsSuperAdmin || userIsCompanyAdmin
  const userCanCreateCompanyScopedUsers = userIsSuperAdmin || userIsCompanyAdmin
useEffect(() => {
  const loadBranding = async () => {
    const targetCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    if (!targetCompanyId) return

    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', targetCompanyId)
      .maybeSingle()

    if (data) {
      setCompanySettings(data)
      setCompanyNameInput(data.company_name || '')
      setCompanyAddress1Input(data.address_line1 || '')
      setCompanyAddress2Input(data.address_line2 || '')
      setCompanyPhoneInput(data.phone || '')
      setCompanyAccentInput(data.accent_color || '#c46a2b')
    }
  }

  loadBranding()
}, [companyId, selectedAdminCompanyId, userIsSuperAdmin])
  async function runSafeAction(label: string, action: () => Promise<void> | void) {
    if (isActionRunning) return

    setIsActionRunning(true)
    setActionMessage(label)

    try {
      await action()
    } catch (error: any) {
      console.error(`${label} failed:`, error)
      alert(error?.message || `${label} failed.`)
    } finally {
      setIsActionRunning(false)
      setActionMessage('')
    }
  }

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

    const { data: tankData } = await supabase.from('tanks').select('*').order('tank_number')
    const { data: lineFillData } = await supabase.from('line_fills').select('*').order('line_name')
    const { data: meterAssetConfigData } = await supabase.from('meter_asset_config').select('*')
    const { data: tankCalibrationData } = await supabase.from('tank_calibration_versions').select('*').order('created_at', { ascending: false })
    const { data: tankStrappingData } = await supabase.from('tank_strapping_rows').select('*').order('gauge_decimal')
    const { data: tankDeadwoodData } = await supabase.from('tank_deadwood_rules').select('*').eq('active', true)

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
    if (tankData) setTanks(tankData)
    if (lineFillData) setLineFills(lineFillData)
    if (meterAssetConfigData) setMeterAssetConfigs(meterAssetConfigData)
    if (tankCalibrationData) setTankCalibrationVersions(tankCalibrationData)
    if (tankStrappingData) setTankStrappingRows(tankStrappingData)
    if (tankDeadwoodData) setTankDeadwoodRules(tankDeadwoodData)

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
const canViewAdmin = userCanManageCompanySetup

  const canEditAdmin = userCanManageCompanySetup
    userIsCompanyAdmin
    userIsCompanyAdmin ||
    userRoles.some((role) => role.active !== false && ['super_admin', 'admin'].includes(role.role))
    userIsCompanyAdmin ||
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
    await supabase.from('areas').insert({ company_id: userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId, name: newArea })
    setNewArea('')
    loadAll()
  }

  async function addSegment() {
    if (!newSegment || !companyId) return
    await supabase.from('segments').insert({ company_id: userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId, name: newSegment })
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


  function normalizeGaugeToDecimal(feetOrDecimal: any, inches?: any, fraction?: any) {
    const feetValue = Number(feetOrDecimal || 0)
    const inchesValue = Number(inches || 0)
    const fractionValue = Number(fraction || 0)

    if (inches !== undefined || fraction !== undefined) {
      return feetValue + (inchesValue / 12) + (fractionValue / 12)
    }

    return feetValue
  }

  function getActiveTankCalibration(tankId: string) {
    return (
      tankCalibrationVersions.find((version: any) => version.tank_id === tankId && version.active !== false) ||
      tankCalibrationVersions.find((version: any) => version.tank_id === tankId)
    )
  }

  function getTankBarrelsAtGauge(tankId: string, gauge: number) {
    const calibration = getActiveTankCalibration(tankId)

    if (!calibration || !Number.isFinite(gauge)) return 0

    const rows = tankStrappingRows
      .filter((row: any) => row.tank_id === tankId && row.calibration_version_id === calibration.id)
      .sort((a: any, b: any) => Number(a.gauge_decimal) - Number(b.gauge_decimal))

    if (rows.length === 0) return 0

    const exact = rows.find((row: any) => Number(row.gauge_decimal) === gauge)
    if (exact) return Number(exact.barrels || 0)

    const lower = rows.filter((row: any) => Number(row.gauge_decimal) <= gauge).pop()
    const upper = rows.find((row: any) => Number(row.gauge_decimal) >= gauge)

    if (!lower && upper) return Number(upper.barrels || 0)
    if (lower && !upper) return Number(lower.barrels || 0)
    if (!lower || !upper) return 0

    const lowerGauge = Number(lower.gauge_decimal)
    const upperGauge = Number(upper.gauge_decimal)
    const lowerBbl = Number(lower.barrels || 0)
    const upperBbl = Number(upper.barrels || 0)

    if (upperGauge === lowerGauge) return lowerBbl

    const ratio = (gauge - lowerGauge) / (upperGauge - lowerGauge)
    return lowerBbl + ((upperBbl - lowerBbl) * ratio)
  }

  function getDeadwoodAdjustment(tankId: string, gauge: number) {
    const calibration = getActiveTankCalibration(tankId)

    if (!calibration) return 0

    return tankDeadwoodRules
      .filter((rule: any) =>
        rule.tank_id === tankId &&
        rule.calibration_version_id === calibration.id &&
        Number(rule.start_gauge || 0) <= gauge &&
        Number(rule.end_gauge || 0) >= gauge
      )
      .reduce((sum: number, rule: any) => {
        const value = Number(rule.adjustment_bbl || 0)
        return rule.adjustment_type === 'subtract' ? sum - value : sum + value
      }, 0)
  }

  function calculateTankMovement(tankId: string, opening: number, closing: number, direction: string) {
    const openingGross = getTankBarrelsAtGauge(tankId, opening)
    const closingGross = getTankBarrelsAtGauge(tankId, closing)
    const openingCorrected = openingGross + getDeadwoodAdjustment(tankId, opening)
    const closingCorrected = closingGross + getDeadwoodAdjustment(tankId, closing)
    const rawMovement = direction === 'receipt'
      ? closingCorrected - openingCorrected
      : openingCorrected - closingCorrected

    return {
      openingGross,
      closingGross,
      openingCorrected,
      closingCorrected,
      movementBbl: Math.abs(rawMovement),
      signedMovementBbl: rawMovement,
    }
  }


  function gaugePartsToDecimal(feet: any, inches: any, eighths: any) {
    return Number(feet || 0) + (Number(inches || 0) / 12) + ((Number(eighths || 0) / 8) / 12)
  }

  function decimalGaugeToParts(decimalGauge: any) {
    const decimal = Number(decimalGauge || 0)
    const feet = Math.floor(decimal)
    const totalInches = (decimal - feet) * 12
    const inches = Math.floor(totalInches)
    const eighths = Math.round((totalInches - inches) * 8)

    return { feet, inches, eighths }
  }

  function getPreviousTankTicket(tankId: string) {
    if (!tankId) return null

    return tickets
      .filter((ticket: any) =>
        ticket.status === 'approved' &&
        (ticket.tank_id === tankId || ticket.observed_inputs?.tank_id === tankId)
      )
      .sort((a: any, b: any) =>
        new Date(b.approved_at || b.created_at || 0).getTime() -
        new Date(a.approved_at || a.created_at || 0).getTime()
      )[0] || null
  }

  function getPreviousTankClosingGauge(tankId: string) {
    const previous = getPreviousTankTicket(tankId)

    return (
      (previous as any)?.closing_gauge ||
      previous?.observed_inputs?.closing_gauge ||
      previous?.observed_inputs?.closing_gauge_decimal ||
      ''
    )
  }

  function calculateTankTicketSnapshot(tankId: string) {
    const openingGaugeDecimal = Number(getPreviousTankClosingGauge(tankId) || openingGauge || 0)
    const closingGaugeDecimal = gaugePartsToDecimal(tankClosingFeet, tankClosingInches, tankClosingEighths)

    const movement = tankId
      ? calculateTankMovement(tankId, openingGaugeDecimal, closingGaugeDecimal, tankMovementDirection)
      : {
          openingGross: 0,
          closingGross: 0,
          openingCorrected: 0,
          closingCorrected: 0,
          movementBbl: 0,
          signedMovementBbl: 0,
        }

    const corrections = calculateApi11Corrections({
      productGroup: 'crude',
      observedApiGravity: Number(tankObservedGravity || 0),
      observedTemperature: Number(tankObservedTemp || tankAverageTemp || 60),
      observedPressure: 0,
      averageTemperature: Number(tankAverageTemp || tankObservedTemp || 60),
      averagePressure: 0,
      apiRounding: 1,
    })

    const ctl = roundTo(corrections.ctl, 5)
    const cpl = roundTo(corrections.cpl, 5)
    const ctlp = roundTo(corrections.ctlp, 5)
    const ccf = corrections.ccf
    const swDecimal = Number(tankSwPercent || 0) / 100
    const gov = Number(movement.movementBbl || 0)
    const gsv = gov * ccf
    const nsv = gsv * (1 - swDecimal)

    return {
      openingGaugeDecimal,
      closingGaugeDecimal,
      closingGaugeParts: decimalGaugeToParts(closingGaugeDecimal),
      movement,
      corrections,
      ctl,
      cpl,
      ctlp,
      ccf,
      gov,
      gsv,
      nsv,
      swDecimal,
      swPercent: Number(tankSwPercent || 0),
      averageTemp: Number(tankAverageTemp || 0),
      ambientTemp: Number(tankAmbientTemp || 0),
      observedGravity: Number(tankObservedGravity || 0),
      observedTemp: Number(tankObservedTemp || 0),
    }
  }

  function getPreviousClosingForLease(leaseId: string, meterId?: string) {
    const previous = tickets
      .filter((ticket: any) =>
        ticket.status === 'approved' &&
        (ticket.lease_id === leaseId || ticket.observed_inputs?.lease_id === leaseId) &&
        (!meterId || ticket.meter_id === meterId)
      )
      .sort((a: any, b: any) => new Date(b.approved_at || b.created_at || 0).getTime() - new Date(a.approved_at || a.created_at || 0).getTime())[0]

    return (
      (previous as any)?.closing_reading ||
      previous?.observed_inputs?.closing_reading ||
      previous?.observed_inputs?.closing_meter_reading ||
      previous?.observed_inputs?.ending_reading ||
      ''
    )
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

    const tankTicketSnapshot = ticketType === 'tank' && selectedTank
      ? calculateTankTicketSnapshot(selectedTank)
      : null

    const previousClosingReading = getPreviousClosingForLease(selectedLease, selectedMeter)
    const openingReading = Number(previousClosingReading || 0)
    const closingReading = Number(manualClosingReading || latestReading?.indicated_volume || 0)

    const tankCalculation = tankTicketSnapshot?.movement || null

    const iv = tankTicketSnapshot
      ? Number(tankTicketSnapshot.gov || 0)
      : Number(closingReading || latestReading?.indicated_volume || 0)
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

    const finalCtl = tankTicketSnapshot ? tankTicketSnapshot.ctl : ctl
    const finalCpl = tankTicketSnapshot ? tankTicketSnapshot.cpl : cpl
    const finalCtlp = tankTicketSnapshot ? tankTicketSnapshot.ctlp : ctlp
    const finalCcf = tankTicketSnapshot ? tankTicketSnapshot.ccf : ccf

    const factorToUse = Number(latestApprovedProving?.accepted_meter_factor || latestReading?.meter_factor || 1)
    const mf = roundTo(factorToUse, 4)
    const csw = Number(latestPot?.csw || 1)
    const isApi12 = selectedContractStandard.includes('API 12')
    const gsv = tankTicketSnapshot
      ? tankTicketSnapshot.gsv
      : isApi12 ? iv * ctl * cpl * mf : iv * ccf * mf
    const nsv = tankTicketSnapshot
      ? tankTicketSnapshot.nsv
      : gsv * csw

    const ticketInsertPayload: any = {
      company_id: companyId,
      ticket_number: generatedNumber,
      ticket_type: ticketType,
      status: 'draft',
      producer_id: selectedProducer || null,
      segment_id: selectedSegment || null,
      lease_id: selectedLease || null,
      tank_id: selectedTank || null,
      line_fill_id: selectedLineFill || null,
      opening_reading: openingReading || null,
      closing_reading: closingReading || null,
      opening_gauge: tankTicketSnapshot?.openingGaugeDecimal ?? (openingGauge ? Number(openingGauge) : null),
      closing_gauge: tankTicketSnapshot?.closingGaugeDecimal ?? (closingGauge ? Number(closingGauge) : null),
      movement_direction: ticketType === 'tank' ? tankMovementDirection : null,
      meter_id: selectedMeter || null,
      linked_reading_id: latestReading?.id || null,
      linked_proving_id: latestApprovedProving?.id || null,
      calculation_profile_id: profile?.id || null,
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
        lease_id: selectedLease || null,
        opening_reading: openingReading || null,
        closing_reading: closingReading || null,
        previous_closing_source: previousClosingReading ? 'previous_approved_ticket_for_lease' : 'none',
        tank_id: selectedTank || null,
        line_fill_id: selectedLineFill || null,
        opening_gauge: openingGauge || null,
        closing_gauge: closingGauge || null,
        tank_movement_direction: ticketType === 'tank' ? tankMovementDirection : null,
        tank_opening_bbl: tankCalculation?.openingCorrected ?? null,
        tank_closing_bbl: tankCalculation?.closingCorrected ?? null,
        tank_gov: tankTicketSnapshot?.gov ?? null,
        tank_gsv: tankTicketSnapshot?.gsv ?? null,
        tank_nsv: tankTicketSnapshot?.nsv ?? null,
        tank_closing_feet: tankClosingFeet || null,
        tank_closing_inches: tankClosingInches || null,
        tank_closing_eighths: tankClosingEighths || null,
        tank_average_temp: tankAverageTemp || null,
        tank_ambient_temp: tankAmbientTemp || null,
        tank_observed_gravity: tankObservedGravity || null,
        tank_observed_temp: tankObservedTemp || null,
        tank_sw_percent: tankSwPercent || null,
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
        tank_opening_bbl: tankCalculation?.openingCorrected ?? null,
        tank_closing_bbl: tankCalculation?.closingCorrected ?? null,
        tank_movement_bbl: tankCalculation?.movementBbl ?? null,
        gsv: roundTo(gsv, volumeRounding),
        nsv: roundTo(nsv, volumeRounding),
        api_gravity_60: corrections.api_gravity_60,
        density_60: corrections.density_60,
        product_sub_group: corrections.product_sub_group,
        formula_profile: isApi12 ? 'API 12 2021' : 'API 11.1',
      },
    }
    let ticketInsertResult = await supabase.from('tickets').insert(ticketInsertPayload).select().maybeSingle()

    if (ticketInsertResult.error) {
      console.error('Full ticket insert failed:', ticketInsertResult.error)

      if (String(ticketInsertResult.error.message || '').includes('contract_profile_id')) {
        delete ticketInsertPayload.contract_profile_id
      }

      const fallbackTicketPayload: any = {
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
        observed_api_gravity: tankTicketSnapshot?.observedGravity || corrections.observed_api_gravity,
        observed_temperature: tankTicketSnapshot?.observedTemp || corrections.observed_temperature,
        observed_pressure: corrections.observed_pressure,
        api_gravity_60: tankTicketSnapshot?.corrections?.api_gravity_60 || corrections.api_gravity_60,
        density_60: tankTicketSnapshot?.corrections?.density_60 || corrections.density_60,
        ctl: tankTicketSnapshot?.ctl || ctl,
        cpl: tankTicketSnapshot?.cpl || cpl,
        ctlp: tankTicketSnapshot?.ctlp || ctlp,
        ccf: tankTicketSnapshot?.ccf || ccf,
        observed_inputs: {
          ...(ticketInsertPayload.observed_inputs || {}),
          lease_id: selectedLease || null,
          tank_id: selectedTank || null,
          line_fill_id: selectedLineFill || null,
          opening_reading: openingReading || null,
          closing_reading: closingReading || null,
          opening_gauge: tankTicketSnapshot?.openingGaugeDecimal ?? (openingGauge ? Number(openingGauge) : null),
          closing_gauge: tankTicketSnapshot?.closingGaugeDecimal ?? (closingGauge ? Number(closingGauge) : null),
          movement_direction: ticketType === 'tank' ? tankMovementDirection : null,
        },
        calculation_results: ticketInsertPayload.calculation_results || {},
      }

      ticketInsertResult = await supabase.from('tickets').insert(fallbackTicketPayload).select().maybeSingle()

      if (ticketInsertResult.error) {
        alert('Could not create ticket: ' + ticketInsertResult.error.message)
        return
      }
    }

    if (ticketInsertResult.data) {
      setSelectedTicket(ticketInsertResult.data as any)
    }

    alert(`Draft ticket created: ${generatedNumber}. If it does not show, press Force Refresh Tickets.`)
    setTankClosingFeet('')
    setTankClosingInches('')
    setTankClosingEighths('')
    setTankAverageTemp('')
    setTankAmbientTemp('')
    setTankObservedGravity('')
    setTankObservedTemp('')
    setTankSwPercent('')
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


  function formatGaugeFeetInchesEighths(decimalGauge: any) {
    const parts = decimalGaugeToParts(decimalGauge)
    return `${parts.feet}' ${parts.inches}-${parts.eighths}/8"`
  }

  function getTankDisplayName(tankId?: string | null) {
    const tank = tanks.find((t: any) => t.id === tankId)
    if (!tank) return ''
    return `${tank.tank_number || ''}${tank.tank_name ? ` - ${tank.tank_name}` : ''}`
  }


  function formatTicketNumberValue(value: any) {
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  function formatBbl(value: any) {
    const num = Number(value || 0)
    return Number.isFinite(num) ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
  }

  function formatMeasurementNumber(value: any, digits = 4) {
    const num = Number(value || 0)
    return Number.isFinite(num) ? num.toFixed(digits) : '0'
  }

  function uniqueCsvCount(value: any) {
    const items = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    return new Set(items).size
  }

  function generatePdfPreview(ticket: any) {
    const producer = producers.find((item: any) => item.id === ticket.producer_id)
    const meter = meters.find((item: any) => item.id === ticket.meter_id)
    const segment = segments.find((item: any) => item.id === ticket.segment_id)
    const lease = leases.find((item: any) => item.id === ticket.lease_id)

    const observed = ticket.observed_inputs || {}
    const calc = ticket.calculation_results || {}
    const isFlowX = observed.source === 'flowx_transporter_summary'

    const companyName = getCompanyDisplayName ? getCompanyDisplayName() : (companySettings?.company_name || 'Measurement Platform')
    const logoUrl = (typeof getCompanyLogoUrl === 'function' ? getCompanyLogoUrl() : '') || companySettings?.logo_url || ''
    const ticketNumber = ticket.ticket_number || ticket.id || 'Ticket'
    const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : new Date().toLocaleString()
    const approvedAt = ticket.approved_at ? new Date(ticket.approved_at).toLocaleString() : 'Pending Approval'

    const transporter = ticket.transporter_name || observed.transporter_name || ticket.customer_name || '—'
    const assignedPot = observed.assigned_pot_label || ticket.assigned_pot_id || '—'
    const sourceTicketCount = uniqueCsvCount(observed.ticket_numbers)
    const sourceBatchCount = uniqueCsvCount(observed.batch_numbers)
    const sourceTruckCount = uniqueCsvCount(observed.truck_numbers)
    const sourceLeaseCount = uniqueCsvCount(observed.leases)

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${ticketNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f5f7;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      margin: 0 auto;
      background: #fff;
      padding: 0.45in;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      border-bottom: 4px solid #c46a2b;
      padding-bottom: 14px;
      margin-bottom: 16px;
      align-items: center;
    }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo {
      width: 110px;
      max-height: 62px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.2px;
      margin-bottom: 4px;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .ticket-box {
      border: 2px solid #111827;
      padding: 10px 14px;
      text-align: right;
      min-width: 220px;
    }
    .ticket-box .label {
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .ticket-box .number {
      font-size: 19px;
      font-weight: 900;
      margin-top: 4px;
    }
    .status {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      background: ${ticket.status === 'approved' ? '#dcfce7' : '#fef3c7'};
      color: ${ticket.status === 'approved' ? '#166534' : '#92400e'};
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
    }
    .section {
      border: 1px solid #d1d5db;
      margin-top: 12px;
      break-inside: avoid;
    }
    .section-title {
      background: #111827;
      color: #fff;
      font-weight: 900;
      padding: 8px 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-size: 11px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .cell {
      padding: 8px 10px;
      border-right: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      min-height: 38px;
    }
    .cell:nth-child(2n) { border-right: 0; }
    .grid-3 .cell:nth-child(2n) { border-right: 1px solid #e5e7eb; }
    .grid-3 .cell:nth-child(3n) { border-right: 0; }
    .small-label {
      color: #6b7280;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 3px;
    }
    .value {
      font-size: 13px;
      font-weight: 800;
      word-break: break-word;
    }
    .volume {
      font-size: 18px;
      font-weight: 900;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f3f4f6;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #374151;
      padding: 7px 8px;
      border-bottom: 1px solid #d1d5db;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 700;
    }
    .right { text-align: right; }
    .notes {
      white-space: pre-wrap;
      min-height: 45px;
      padding: 10px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 34px;
    }
    .sig-line {
      border-top: 1px solid #111827;
      padding-top: 7px;
      color: #374151;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .footer {
      margin-top: 24px;
      border-top: 1px solid #d1d5db;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      color: #6b7280;
      font-size: 10px;
    }
    @media print {
      body { background: #fff; }
      .page { margin: 0; width: auto; min-height: auto; }
      @page { size: letter; margin: 0.35in; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ''}
        <div>
          <div class="brand-title">${companyName}</div>
          <div class="brand-subtitle">Measurement Ticket</div>
        </div>
      </div>
      <div class="ticket-box">
        <div class="label">Ticket Number</div>
        <div class="number">${ticketNumber}</div>
        <div class="status">${ticket.status || 'draft'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Ticket Information</div>
      <div class="grid-3">
        <div class="cell"><div class="small-label">Ticket Type</div><div class="value">${ticket.ticket_type || '—'}</div></div>
        <div class="cell"><div class="small-label">Created</div><div class="value">${createdAt}</div></div>
        <div class="cell"><div class="small-label">Approved</div><div class="value">${approvedAt}</div></div>
        <div class="cell"><div class="small-label">Segment</div><div class="value">${segment?.name || observed.segment_name || '—'}</div></div>
        <div class="cell"><div class="small-label">Producer</div><div class="value">${producer?.name || observed.producer_name || '—'}</div></div>
        <div class="cell"><div class="small-label">Lease</div><div class="value">${((lease as any)?.name || (lease as any)?.lease_name || (lease as any)?.lease_number) || observed.leases || observed.lease_name || '—'}</div></div>
        <div class="cell"><div class="small-label">Meter / Rack</div><div class="value">${meter?.meter_number || observed.meter_number || '—'}</div></div>
        <div class="cell"><div class="small-label">Transporter</div><div class="value">${transporter}</div></div>
        <div class="cell"><div class="small-label">Assigned POT</div><div class="value">${assignedPot}</div></div>
      </div>
    </div>

    ${isFlowX ? `
    <div class="section">
      <div class="section-title">Flow-X Import Summary</div>
      <div class="grid-3">
        <div class="cell"><div class="small-label">Source Rows</div><div class="value">${observed.source_rows || '—'}</div></div>
        <div class="cell"><div class="small-label">Source Ticket Count</div><div class="value">${sourceTicketCount || '—'}</div></div>
        <div class="cell"><div class="small-label">Source Batch Count</div><div class="value">${sourceBatchCount || '—'}</div></div>
        <div class="cell"><div class="small-label">Truck Count</div><div class="value">${sourceTruckCount || '—'}</div></div>
        <div class="cell"><div class="small-label">Lease Count</div><div class="value">${sourceLeaseCount || '—'}</div></div>
        <div class="cell"><div class="small-label">LACT</div><div class="value">${observed.lact_name || ticket.lact_name || '—'}</div></div>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">Volumes</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Barrels</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Gross Observed / GOV</td><td class="right volume">${formatBbl(calc.gov || observed.gross_volume_bbl)}</td></tr>
          <tr><td>Gross Standard / GSV</td><td class="right volume">${formatBbl(calc.gsv || observed.gross_volume_bbl)}</td></tr>
          <tr><td>Net Standard / NSV</td><td class="right volume">${formatBbl(calc.nsv || observed.net_volume_bbl)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Quality / Corrections</div>
      <div class="grid-3">
        <div class="cell"><div class="small-label">API Gravity</div><div class="value">${formatMeasurementNumber(calc.api_gravity || observed.api_gravity, 2)}</div></div>
        <div class="cell"><div class="small-label">BS&W %</div><div class="value">${formatMeasurementNumber(calc.bsw_percent || observed.bsw_percent, 4)}</div></div>
        <div class="cell"><div class="small-label">Average Temp °F</div><div class="value">${formatMeasurementNumber(calc.average_temperature || observed.average_temperature, 2)}</div></div>
        <div class="cell"><div class="small-label">Average Pressure</div><div class="value">${formatMeasurementNumber(calc.average_pressure || observed.average_pressure, 2)}</div></div>
        <div class="cell"><div class="small-label">CTL</div><div class="value">${formatMeasurementNumber(calc.ctl || observed.ctl, 5)}</div></div>
        <div class="cell"><div class="small-label">CPL</div><div class="value">${formatMeasurementNumber(calc.cpl || observed.cpl, 5)}</div></div>
        <div class="cell"><div class="small-label">CTPL</div><div class="value">${formatMeasurementNumber(calc.ctpl || observed.ctpl, 5)}</div></div>
        <div class="cell"><div class="small-label">POT Quality Source</div><div class="value">${assignedPot}</div></div>
        <div class="cell"><div class="small-label">Calculation Method</div><div class="value">${observed.calculation_method || ticket.calculation_profile_snapshot?.selected_calculation_method || 'Standard'}</div></div>
      </div>
    </div>

    ${isFlowX ? `
    <div class="section">
      <div class="section-title">Source References</div>
      <div class="grid-2">
        <div class="cell"><div class="small-label">Ticket Numbers</div><div class="value">${formatTicketNumberValue(observed.ticket_numbers)}</div></div>
        <div class="cell"><div class="small-label">Batch Numbers</div><div class="value">${formatTicketNumberValue(observed.batch_numbers)}</div></div>
        <div class="cell"><div class="small-label">Truck Numbers</div><div class="value">${formatTicketNumberValue(observed.truck_numbers)}</div></div>
        <div class="cell"><div class="small-label">Drivers</div><div class="value">${formatTicketNumberValue(observed.driver_names)}</div></div>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">Notes</div>
      <div class="notes">${ticket.notes || observed.notes || ''}</div>
    </div>

    <div class="signatures">
      <div class="sig-line">Prepared By</div>
      <div class="sig-line">Approved By</div>
    </div>

    <div class="footer">
      <div>Generated by TEFCO Measurement Platform</div>
      <div>${new Date().toLocaleString()}</div>
    </div>
  </div>
  <script>
    window.onload = () => {
      window.focus();
    };
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to preview PDF.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  
  
  
  

  
  async function getImageDataUrl(url: string) {
    if (!url) return ''

    try {
      const response = await fetch(url)
      const blob = await response.blob()

      return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result || ''))
        reader.onerror = () => resolve('')
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Logo load failed:', error)
      return ''
    }
  }

function getCompanyDisplayName() {
    const targetCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    const selectedCompany = companies.find((company: any) => company.id === targetCompanyId)

    return (
      companySettings?.company_name ||
      companyNameInput ||
      selectedCompany?.name ||
      'Measurement App'
    )
  }

  function getCompanyAccentColor() {
    return companySettings?.accent_color || companyAccentInput || '#c46a2b'
  }

  function hexToRgb(hex: string) {
    const cleaned = String(hex || '#c46a2b').replace('#', '')
    const value = cleaned.length === 3
      ? cleaned.split('').map((char) => char + char).join('')
      : cleaned

    const bigint = parseInt(value, 16)

    if (Number.isNaN(bigint)) {
      return { r: 196, g: 106, b: 43 }
    }

    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    }
  }

  function accentRgba(alpha: number) {
    const { r, g, b } = hexToRgb(getCompanyAccentColor())
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function accentGradient() {
    return `linear-gradient(135deg, ${getCompanyAccentColor()}, ${accentRgba(0.55)})`
  }

  function getCompanyLogoUrl() {
    return companySettings?.logo_url || ''
  }

  async function saveCompanySettings() {
    const targetCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    if (!targetCompanyId) {
      alert('No company selected.')
      return
    }

    let logoUrl = companySettings?.logo_url || ''

    if (companyLogoFile) {
      const fileExt = companyLogoFile.name.split('.').pop() || 'png'
      const filePath = `${targetCompanyId}/logo-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, companyLogoFile, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        alert('Logo upload failed: ' + uploadError.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath)

      logoUrl = publicUrlData.publicUrl
    }

    const payload = {
      company_id: targetCompanyId,
      company_name: companyNameInput || '',
      address_line1: companyAddress1Input || '',
      address_line2: companyAddress2Input || '',
      phone: companyPhoneInput || '',
      accent_color: companyAccentInput || '#c46a2b',
      logo_url: logoUrl || companySettings?.logo_url || '',
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select()
      .single()

    if (error) {
      alert('Could not save company branding: ' + error.message)
      return
    }

    if (companyNameInput) {
      await supabase
        .from('companies')
        .update({ name: companyNameInput })
        .eq('id', targetCompanyId)
    }

    setCompanySettings(data as any)
    logo_url: logoUrl || companySettings?.logo_url || '',
    setCompanyNameInput((data as any).company_name || '')
    setCompanyAddress1Input((data as any).address_line1 || '')
    setCompanyAddress2Input((data as any).address_line2 || '')
    setCompanyPhoneInput((data as any).phone || '')
    setCompanyAccentInput((data as any).accent_color || '#c46a2b')

    await loadAll()
    alert('Company branding saved.')
  }

async function createCompany() {
    if (!userIsSuperAdmin) {
      alert('Only super admins can create companies.')
      return
    }


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


  function parseMeterCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) return []

    const headers = lines[0].split(',').map((header) => header.trim().toLowerCase())

    return lines.slice(1).map((line) => {
      const values = line.split(',').map((value) => value.trim())
      const row: Record<string, string> = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      return row
    })
  }

  async function findOrCreateByName(tableName: string, nameColumn: string, name: string, extra: Record<string, any> = {}) {
    if (!name) return null

    const { data: existing } = await supabase
      .from(tableName)
      .select('*')
      .eq(nameColumn, name)
      .maybeSingle()

    if (existing) return existing

    const { data, error } = await supabase
      .from(tableName)
      .insert({
        company_id: userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId,
        [nameColumn]: name,
        ...extra,
      })
      .select()
      .single()

    if (error) throw error

    return data
  }


  async function createTankAsset() {
    if (!newTankNumber) {
      alert('Enter tank number.')
      return
    }

    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    const { error } = await supabase.from('tanks').insert({
      company_id: targetCompanyId,
      segment_id: newTankSegmentId || null,
      tank_number: newTankNumber,
      tank_name: newTankName || null,
      active: true,
    })

    if (error) {
      alert('Could not create tank: ' + error.message)
      return
    }

    setNewTankNumber('')
    setNewTankName('')
    setNewTankSegmentId('')
    await loadAll()
  }

  async function createLineFillAsset() {
    if (!newLineFillName) {
      alert('Enter line fill name.')
      return
    }

    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    const { error } = await supabase.from('line_fills').insert({
      company_id: targetCompanyId,
      segment_id: newLineFillSegmentId || null,
      line_name: newLineFillName,
      capacity_bbl: newLineFillCapacity ? Number(newLineFillCapacity) : null,
      active: true,
    })

    if (error) {
      alert('Could not create line fill: ' + error.message)
      return
    }

    setNewLineFillName('')
    setNewLineFillSegmentId('')
    setNewLineFillCapacity('')
    await loadAll()
  }


  async function saveDeadwoodRule() {
    if (!deadwoodTankId) {
      alert('Select a tank.')
      return
    }

    if (!deadwoodStartGauge || !deadwoodEndGauge || !deadwoodAdjustmentBbl) {
      alert('Enter start gauge, end gauge, and adjustment barrels.')
      return
    }

    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    const calibration = getActiveTankCalibration(deadwoodTankId)

    if (!calibration) {
      alert('This tank needs a strapping calibration version before adding deadwood rules.')
      return
    }

    const { error } = await supabase.from('tank_deadwood_rules').insert({
      company_id: targetCompanyId,
      tank_id: deadwoodTankId,
      calibration_version_id: calibration.id,
      start_gauge: Number(deadwoodStartGauge),
      end_gauge: Number(deadwoodEndGauge),
      adjustment_bbl: Number(deadwoodAdjustmentBbl),
      adjustment_type: deadwoodAdjustmentType,
      description: deadwoodDescription || null,
      active: true,
    })

    if (error) {
      alert('Could not save deadwood rule: ' + error.message)
      return
    }

    setDeadwoodStartGauge('')
    setDeadwoodEndGauge('')
    setDeadwoodAdjustmentBbl('')
    setDeadwoodAdjustmentType('add')
    setDeadwoodDescription('')
    alert('Deadwood rule saved.')
    await loadAll()
  }

  async function deleteDeadwoodRule(ruleId: string) {
    const { error } = await supabase
      .from('tank_deadwood_rules')
      .update({ active: false })
      .eq('id', ruleId)

    if (error) {
      alert('Could not delete deadwood rule: ' + error.message)
      return
    }

    await loadAll()
  }


  function columnLettersToIndex(letters: string) {
    return letters.split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1
  }

  function cellRefToPosition(ref: string) {
    const match = String(ref || '').match(/^([A-Z]+)(\d+)$/i)

    if (!match) return { row: 0, col: 0 }

    return {
      col: columnLettersToIndex(match[1].toUpperCase()),
      row: Number(match[2]) - 1,
    }
  }

  function parseXmlText(xml: string) {
    return new DOMParser().parseFromString(xml, 'application/xml')
  }

  async function readXlsxSheets(file: File) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const workbookXml = await zip.file('xl/workbook.xml')?.async('text')
    const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('text')

    if (!workbookXml || !relsXml) {
      throw new Error('Could not read XLSX workbook.')
    }

    const workbook = parseXmlText(workbookXml)
    const rels = parseXmlText(relsXml)

    const relMap: Record<string, string> = {}
    Array.from(rels.getElementsByTagName('Relationship')).forEach((rel: any) => {
      relMap[rel.getAttribute('Id')] = rel.getAttribute('Target')
    })

    const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text')
    const sharedStrings = sharedStringsXml
      ? Array.from(parseXmlText(sharedStringsXml).getElementsByTagName('si')).map((si: any) =>
          Array.from(si.getElementsByTagName('t')).map((t: any) => t.textContent || '').join('')
        )
      : []

    const sheets = await Promise.all(
      Array.from(workbook.getElementsByTagName('sheet')).map(async (sheet: any) => {
        const name = sheet.getAttribute('name') || 'Sheet'
        const relId = sheet.getAttribute('r:id')
        const target = relMap[relId] || ''
        const sheetPath = target.startsWith('worksheets/')
          ? `xl/${target}`
          : `xl/worksheets/${target.split('/').pop()}`
        const sheetXml = await zip.file(sheetPath)?.async('text')

        if (!sheetXml) return { name, rows: [] as any[][] }

        const doc = parseXmlText(sheetXml)
        const rows: any[][] = []

        Array.from(doc.getElementsByTagName('c')).forEach((cell: any) => {
          const ref = cell.getAttribute('r') || ''
          const type = cell.getAttribute('t') || ''
          const { row, col } = cellRefToPosition(ref)
          const v = cell.getElementsByTagName('v')[0]?.textContent || ''
          const inline = cell.getElementsByTagName('t')[0]?.textContent || ''
          let value: any = ''

          if (type === 's') {
            value = sharedStrings[Number(v)] || ''
          } else if (type === 'inlineStr') {
            value = inline
          } else {
            value = v
          }

          if (value !== '' && !Number.isNaN(Number(value))) {
            value = Number(value)
          }

          rows[row] = rows[row] || []
          rows[row][col] = value
        })

        return { name, rows }
      })
    )

    return sheets
  }

  function parseGaugeTextToDecimal(value: any) {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value

    const textValue = String(value).trim()

    const feetInchMatch = textValue.match(/(\d+(?:\.\d+)?)\s*'\s*[-]?\s*(\d+(?:\.\d+)?)?/)
    if (feetInchMatch) {
      return Number(feetInchMatch[1]) + (Number(feetInchMatch[2] || 0) / 12)
    }

    const numeric = Number(textValue.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(numeric) ? numeric : null
  }

  function extractRefineryStrappingRowsFromSheet(rows: any[][]) {
    const output: any[] = []

    // Detect multi-pair refinery format:
    // FT-IN | Barrels | FT-IN | Barrels
    // Yellow rows are whole feet, but the cell value is the foot number, not inch 12/13/14/etc.
    // Following rows 1-11 are inches under that current foot.
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] || []

      for (let c = 0; c < row.length - 1; c += 1) {
        const leftHeader = String((row || [])[c] ?? '').trim().toLowerCase()
        const rightHeader = String((row || [])[c + 1] ?? '').trim().toLowerCase()

        if (leftHeader === 'ft-in' && rightHeader.includes('barrel')) {
          let currentFeet: number | null = null

          for (let rr = r + 1; rr < rows.length; rr += 1) {
            const dataRow = rows[rr] || []
            const gaugeCell = dataRow[c]
            const barrels = Number(dataRow[c + 1])
            const gaugeValue = Number(gaugeCell)

            if (!Number.isFinite(gaugeValue) || !Number.isFinite(barrels)) continue

            let inches = gaugeValue

            // In this format, a value greater than 11 means a new whole-foot row.
            // Example: 12 with 396.50 = 12' 0", then 1 = 12' 1", etc.
            if (currentFeet === null || gaugeValue > 11) {
              currentFeet = gaugeValue
              inches = 0
            }

            const gaugeDecimal = currentFeet + (inches / 12)

            output.push({
              gauge_decimal: gaugeDecimal,
              gauge_feet: currentFeet,
              gauge_inches: inches,
              gauge_fraction: null,
              barrels,
              increment_bbl: null,
              notes: 'Imported from XLSX refinery strapping table',
            })
          }
        }
      }
    }

    return output
  }

  function extractIncrementFactorSheetRows(rows: any[][]) {
    const output: any[] = []

    const headerRowIndex = rows.findIndex((row) => {
      const safeRow = Array.isArray(row) ? row : []

      return (
        safeRow.some((value) => String(value ?? '').toLowerCase().includes('gauge from')) &&
        safeRow.some((value) => String(value ?? '').toLowerCase().includes('total volume'))
      )
    })

    if (headerRowIndex < 0) return output

    const headers = (rows[headerRowIndex] || []).map((value) => String(value || '').trim().toLowerCase())
    const gaugeFromIndex = headers.findIndex((header) => String(header ?? '').includes('gauge from'))
    const totalVolumeIndex = headers.findIndex((header) => String(header ?? '').includes('total volume'))
    const incrementalVolumeIndex = headers.findIndex((header) => String(header ?? '').includes('incremental volume'))

    for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r] || []
      const gauge = parseGaugeTextToDecimal(row[gaugeFromIndex])
      const barrels = Number(row[totalVolumeIndex])
      const increment = Number(row[incrementalVolumeIndex])

      if (gauge === null || !Number.isFinite(barrels)) continue

      output.push({
        gauge_decimal: gauge,
        gauge_feet: Math.floor(gauge),
        gauge_inches: Number(((gauge - Math.floor(gauge)) * 12).toFixed(4)),
        gauge_fraction: null,
        barrels,
        increment_bbl: Number.isFinite(increment) ? increment : null,
        notes: 'Imported from XLSX increment factor sheet',
      })
    }

    return output
  }

  async function parseStrappingFileRows(file: File) {
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.xlsx')) {
      const sheets = await readXlsxSheets(file)
      let rows: any[] = []

      for (const sheet of sheets) {
        const refineryRows = extractRefineryStrappingRowsFromSheet(sheet.rows)
        const ifsRows = extractIncrementFactorSheetRows(sheet.rows)

        rows = [...rows, ...refineryRows, ...ifsRows]
      }

      const unique = new Map<string, any>()
      rows.forEach((row) => {
        const key = Number(row.gauge_decimal).toFixed(6)
        if (!unique.has(key)) unique.set(key, row)
      })

      return Array.from(unique.values()).sort((a, b) => Number(a.gauge_decimal) - Number(b.gauge_decimal))
    }

    const csvText = await file.text()
    return parseMeterCsv(csvText)
  }

  async function importTankStrappingCsv() {
    if (!selectedStrappingTankId || !strappingCsvFile) {
      alert('Select a tank and CSV/XLSX file.')
      return
    }

    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    const { data: latestVersions } = await supabase
      .from('tank_calibration_versions')
      .select('version_number')
      .eq('tank_id', selectedStrappingTankId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = Number(latestVersions?.[0]?.version_number || 0) + 1

    const { data: version, error: versionError } = await supabase
      .from('tank_calibration_versions')
      .insert({
        company_id: targetCompanyId,
        tank_id: selectedStrappingTankId,
        version_number: nextVersion,
        name: `Version ${nextVersion}`,
        active: true,
      })
      .select()
      .single()

    if (versionError || !version) {
      alert('Could not create calibration version: ' + (versionError?.message || 'unknown error'))
      return
    }

    await supabase
      .from('tank_calibration_versions')
      .update({ active: false })
      .eq('tank_id', selectedStrappingTankId)
      .neq('id', version.id)

    const rows = await parseStrappingFileRows(strappingCsvFile)

    const insertRows = rows
      .map((row: any) => {
        const gaugeDecimal = Number(
          row.gauge_decimal ||
          row.gauge ||
          normalizeGaugeToDecimal(row.gauge_feet || row.feet, row.gauge_inches || row.inches, row.gauge_fraction || row.fraction)
        )

        const barrels = Number(row.barrels || row.bbl || row.volume_bbl || row.volume)

        if (!Number.isFinite(gaugeDecimal) || !Number.isFinite(barrels)) return null

        return {
          company_id: targetCompanyId,
          tank_id: selectedStrappingTankId,
          calibration_version_id: version.id,
          gauge_decimal: gaugeDecimal,
          gauge_feet: row.gauge_feet || row.feet || null,
          gauge_inches: row.gauge_inches || row.inches || null,
          gauge_fraction: row.gauge_fraction || row.fraction || null,
          barrels,
          increment_bbl: row.increment || row.increment_bbl || null,
          notes: row.notes || null,
        }
      })
      .filter(Boolean) as any[]

    if (insertRows.length === 0) {
      await supabase.from('tank_calibration_versions').delete().eq('id', version.id)
      alert('No valid strapping rows found.')
      return
    }

    const { error } = await supabase.from('tank_strapping_rows').insert(insertRows)

    if (error) {
      await supabase.from('tank_calibration_versions').delete().eq('id', version.id)
      alert('Could not import strapping chart: ' + error.message)
      return
    }

    setStrappingCsvFile(null)
    setSelectedStrappingTankId('')
    alert(`Imported ${insertRows.length} strapping rows as calibration Version ${nextVersion}. Test 14 ft 4 in should now lookup around 474.60 bbl on the Delek 401 low leg chart.`)
    await loadAll()
  }


  function normalizeFlowXHeader(header: string) {
    return String(header || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function parseGenericCsv(textValue: string) {
    const rows: string[][] = []
    let current = ''
    let row: string[] = []
    let inQuotes = false

    for (let i = 0; i < textValue.length; i += 1) {
      const char = textValue[i]
      const next = textValue[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (current || row.length) {
          row.push(current.trim())
          rows.push(row)
          row = []
          current = ''
        }
        if (char === '\r' && next === '\n') i += 1
      } else {
        current += char
      }
    }

    if (current || row.length) {
      row.push(current.trim())
      rows.push(row)
    }

    if (rows.length < 2) return []

    const headers = rows[0].map(normalizeFlowXHeader)

    return rows.slice(1).map((values) => {
      const output: Record<string, string> = {}
      headers.forEach((header, index) => {
        output[header] = values[index] || ''
      })
      return output
    })
  }

  function getFlowXValue(row: any, names: string[]) {
    for (const name of names) {
      const key = normalizeFlowXHeader(name)
      if (row[key] !== undefined && row[key] !== '') return row[key]
    }

    return ''
  }

  function getFlowXNumber(row: any, names: string[]) {
    const raw = getFlowXValue(row, names)
    const value = Number(String(raw).replace(/,/g, ''))
    return Number.isFinite(value) ? value : 0
  }

  function getFlowXDate(row: any, names: string[]) {
    const raw = getFlowXValue(row, names)
    if (!raw) return null

    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  function getFlowXSplits() {
    const splits = [
      { customer: flowxTransporter1, percent: Number(flowxPercent1 || 0) },
      { customer: flowxTransporter2, percent: Number(flowxPercent2 || 0) },
      { customer: flowxTransporter3, percent: Number(flowxPercent3 || 0) },
      { customer: flowxTransporter4, percent: Number(flowxPercent4 || 0) },
    ].filter((split) => split.customer && split.percent > 0)

    const total = splits.reduce((sum, split) => sum + split.percent, 0)

    if (splits.length === 0) return []

    return splits.map((split) => ({
      ...split,
      normalizedPercent: total > 0 ? split.percent / total : 0,
    }))
  }


  function parseFlowXCsvForMapping(csvText: string) {
    const rows: string[][] = []
    let current = ''
    let row: string[] = []
    let inQuotes = false

    for (let i = 0; i < csvText.length; i += 1) {
      const char = csvText[i]
      const next = csvText[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else if ((char === '\n' || char === '\n') && !inQuotes) {
        if (current || row.length) {
          row.push(current.trim())
          rows.push(row)
          row = []
          current = ''
        }
        if (char === '\n' && next === '\n') i += 1
      } else {
        current += char
      }
    }

    if (current || row.length) {
      row.push(current.trim())
      rows.push(row)
    }

    if (rows.length === 0) return { headers: [], data: [] }

    const normalize = (value: any) => String(value || '').trim().toLowerCase()

    // Flow-X daily ticket files often have report title / total rows / blank lines first.
    // Find the real header row by looking for known fields.
    let headerIndex = rows.findIndex((candidate) => {
      const joined = candidate.map(normalize).join('|')
      return (
        joined.includes('start time') &&
        joined.includes('stop time') &&
        (joined.includes('ticket nr') || joined.includes('ticket no') || joined.includes('ticket number')) &&
        (joined.includes('batch nr') || joined.includes('batch no') || joined.includes('batch number'))
      )
    })

    if (headerIndex < 0) {
      headerIndex = rows.findIndex((candidate) => {
        const joined = candidate.map(normalize).join('|')
        return joined.includes('ticket') && joined.includes('truck') && (joined.includes('gsv') || joined.includes('nsv') || joined.includes('gross'))
      })
    }

    if (headerIndex < 0) headerIndex = 0

    const headers = rows[headerIndex].map((header) => String(header || '').trim())
    const data = rows
      .slice(headerIndex + 1)
      .filter((values) => values.some((value) => String(value || '').trim()))
      .filter((values) => {
        // Skip separator/blank rows directly below header.
        const joined = values.map(normalize).join('|')
        if (!joined.replace(/\|/g, '').trim()) return false
        if (joined.includes('start time') && joined.includes('stop time')) return false
        return true
      })
      .map((values) => {
        const output: any = {}
        headers.forEach((header, index) => {
          output[header] = values[index] || ''
        })
        return output
      })

    return { headers, data }
  }

  function guessFlowXColumn(headers: string[], options: string[]) {
    const normalized = headers.map((header) => ({
      raw: header,
      key: String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    }))

    for (const option of options) {
      const optionKey = option.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const match = normalized.find((header) => header.key === optionKey || header.key.includes(optionKey))
      if (match) return match.raw
    }

    return ''
  }

  async function previewFlowXCsv(file?: File | null) {
    const selectedFile = file || flowxCsvFile

    if (!selectedFile) {
      alert('Choose a Flow-X CSV first.')
      return
    }

    const csvText = await selectedFile.text()
    const parsed = parseFlowXCsvForMapping(csvText)
    setFlowxMappingHeaders(parsed.headers)
    setFlowxMappingRows(parsed.data.slice(0, 10))
    setTimeout(() => refreshFlowXAutoSplits(parsed.data), 0)

    setFlowxColumnMap({
      ticket_number: guessFlowXColumn(parsed.headers, ['ticket nr', 'ticket_number', 'ticket no', 'ticket']),
      batch_number: guessFlowXColumn(parsed.headers, ['batch nr', 'batch_number', 'batch no', 'batch', 'load_number']),
      truck_number: guessFlowXColumn(parsed.headers, ['truck nr', 'truck_number', 'truck no', 'truck']),
      driver_name: guessFlowXColumn(parsed.headers, ['driver name', 'driver_name', 'driver']),
      customer_name: guessFlowXColumn(parsed.headers, ['customer', 'customer_name']),
      producer_name: guessFlowXColumn(parsed.headers, ['producer_name', 'producer']),
      transporter_name: guessFlowXColumn(parsed.headers, ['transporter', 'transporter_name']),
      lease_name: guessFlowXColumn(parsed.headers, ['lease_name', 'lease']),
      meter_number: guessFlowXColumn(parsed.headers, ['rack nr', 'meter_number', 'meter']),
      segment_name: guessFlowXColumn(parsed.headers, ['site', 'segment_name', 'segment']),
      gross_volume_bbl: guessFlowXColumn(parsed.headers, ['gsv batch', 'iv batch', 'driver obs gross bbls', 'gross_volume_bbl', 'gross volume', 'gross', 'gov', 'gsv']),
      net_volume_bbl: guessFlowXColumn(parsed.headers, ['nsv batch', 'net_volume_bbl', 'net volume', 'net', 'nsv']),
      api_gravity: guessFlowXColumn(parsed.headers, ['api 60f', 'driver obs api', 'api_gravity', 'api', 'gravity']),
      observed_temperature: guessFlowXColumn(parsed.headers, ['temperature', 'driver obs temp', 'observed_temperature', 'observed temp', 'obs_temp']),
      bsw_percent: guessFlowXColumn(parsed.headers, ['bs&w', 'driver obs bs&w', 'bsw_percent', 'bsw', 's&w', 'sw']),
      open_datetime: guessFlowXColumn(parsed.headers, ['start time', 'open_datetime', 'open time', 'start_time']),
      close_datetime: guessFlowXColumn(parsed.headers, ['stop time', 'close_datetime', 'close time', 'end_time']),
    })
  }

  function getMappedFlowXValue(row: any, field: string) {
    const header = flowxColumnMap[field]

    if (header && row[header] !== undefined) return row[header]

    const aliases: Record<string, string[]> = {
      ticket_number: ['Ticket Nr.', 'Ticket Nr', 'Ticket No', 'Ticket Number', 'Ticket'],
      batch_number: ['Batch Nr.', 'Batch Nr', 'Batch No', 'Batch Number', 'Batch'],
      truck_number: ['Truck Nr.', 'Truck Nr', 'Truck No', 'Truck Number', 'Truck'],
      driver_name: ['Driver Name', 'Driver'],
      producer_name: ['Producer'],
      transporter_name: ['Transporter', 'Transporter Name', 'Carrier', 'Shipper'],
      customer_name: ['Customer', 'Customer Name'],
      lease_name: ['Lease', 'Lease Name'],
      meter_number: ['Rack Nr.', 'Rack Nr', 'Meter Number', 'Meter'],
      segment_name: ['Site', 'Segment', 'Segment Name'],
      gross_volume_bbl: ['GSV Batch', 'IV Batch', 'Driver Obs Gross Bbls.', 'Driver Obs Gross Bbls', 'Gross Volume', 'GSV'],
      net_volume_bbl: ['NSV Batch', 'Net Volume', 'NSV'],
      api_gravity: ['API 60F', 'Driver Obs API', 'API Gravity', 'API'],
      observed_temperature: ['Temperature', 'Driver Obs Temp', 'Observed Temp'],
      bsw_percent: ['BS&W', 'Driver Obs BS&W', 'BSW', 'S&W'],
      open_datetime: ['Start Time', 'Open Time'],
      close_datetime: ['Stop Time', 'Close Time'],
    }

    const possibleHeaders = aliases[field] || []

    for (const possibleHeader of possibleHeaders) {
      if (row[possibleHeader] !== undefined && row[possibleHeader] !== '') return row[possibleHeader]
    }

    const normalizedFieldHeaders = Object.keys(row).reduce((acc: Record<string, string>, key) => {
      acc[String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_')] = key
      return acc
    }, {})

    for (const possibleHeader of possibleHeaders) {
      const normalized = possibleHeader.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const realHeader = normalizedFieldHeaders[normalized]
      if (realHeader && row[realHeader] !== undefined && row[realHeader] !== '') return row[realHeader]
    }

    return ''
  }

  function getMappedFlowXNumber(row: any, field: string) {
    const raw = getMappedFlowXValue(row, field)
    const value = Number(String(raw || '').replace(/,/g, ''))
    return Number.isFinite(value) ? value : 0
  }

  function getMappedFlowXDate(row: any, field: string) {
    const raw = getMappedFlowXValue(row, field)
    if (!raw) return null
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  function updateFlowXColumnMap(field: string, value: string) {
    setFlowxColumnMap((prev: any) => ({ ...prev, [field]: value }))
  }

  function getFlowXSplitsFromForm() {
    const splits = [
      { customer: flowxTransporter1, percent: Number(flowxPercent1 || 0) },
      { customer: flowxTransporter2, percent: Number(flowxPercent2 || 0) },
      { customer: flowxTransporter3, percent: Number(flowxPercent3 || 0) },
      { customer: flowxTransporter4, percent: Number(flowxPercent4 || 0) },
    ].filter((split) => split.customer && split.percent > 0)

    const total = splits.reduce((sum, split) => sum + split.percent, 0)

    return splits.map((split) => ({
      ...split,
      normalizedPercent: total ? split.percent / total : 0,
    }))
  }



  function calculateFlowXTransporterSplitsFromRows(rows: any[]) {
    const totals: Record<string, number> = {}
    let grandTotal = 0

    rows.forEach((row) => {
      const transporter = String(
        getMappedFlowXValue(row, 'transporter_name') ||
        getMappedFlowXValue(row, 'producer_name') ||
        getMappedFlowXValue(row, 'customer_name') ||
        'Unknown Transporter'
      ).trim()

      const nsv = getMappedFlowXNumber(row, 'net_volume_bbl') || getMappedFlowXNumber(row, 'gross_volume_bbl') || Number(row['NSV Batch'] || row['GSV Batch'] || row['IV Batch'] || 0)

      if (!transporter || !Number.isFinite(nsv) || nsv <= 0) return

      totals[transporter] = (totals[transporter] || 0) + nsv
      grandTotal += nsv
    })

    return Object.entries(totals)
      .map(([transporter, total]) => ({
        customer: transporter,
        transporter,
        percent: grandTotal ? (total / grandTotal) * 100 : 0,
        normalizedPercent: grandTotal ? total / grandTotal : 0,
        totalNsv: total,
      }))
      .sort((a, b) => b.totalNsv - a.totalNsv)
  }

  function refreshFlowXAutoSplits(rows?: any[]) {
    const sourceRows = rows || flowxMappingRows || []
    const splits = calculateFlowXTransporterSplitsFromRows(sourceRows)
    setFlowxAutoSplits(splits)
    return splits
  }

  function getFlowXAutoTransporterSplits(rows: any[]) {
    const totals: Record<string, number> = {}
    let grandTotal = 0

    rows.forEach((row) => {
      const transporter = String(getMappedFlowXValue(row, 'transporter_name') || getMappedFlowXValue(row, 'producer_name') || 'Unknown Transporter').trim()
      const nsv = getMappedFlowXNumber(row, 'net_volume_bbl') || getMappedFlowXNumber(row, 'gross_volume_bbl') || Number(row['NSV Batch'] || row['GSV Batch'] || row['IV Batch'] || 0)

      if (!transporter || !nsv) return

      totals[transporter] = (totals[transporter] || 0) + nsv
      grandTotal += nsv
    })

    return Object.entries(totals).map(([transporter, total]) => ({
      customer: transporter,
      transporter,
      percent: grandTotal ? (total / grandTotal) * 100 : 0,
      normalizedPercent: grandTotal ? total / grandTotal : 0,
      totalNsv: total,
    }))
  }

  function getFlowXSplitsForImport(rows: any[]) {
    if (flowxManualSplitOverride) {
      const manualSplits = getFlowXSplitsFromForm()

      if (manualSplits.length > 0) {
        return manualSplits.map((split: any) => ({
          ...split,
          transporter: split.customer,
        }))
      }
    }

    return calculateFlowXTransporterSplitsFromRows(rows)
  }

  function getLatestPotForTransporter(transporterName: string) {
    if (!transporterName) return null

    return potQuality
      .filter((pot: any) => {
        const potTransporter = String(
          pot.transporter ||
          pot.transporter_name ||
          pot.customer ||
          pot.customer_name ||
          pot.producer_name ||
          ''
        ).toLowerCase()

        return potTransporter === transporterName.toLowerCase()
      })
      .sort((a: any, b: any) =>
        new Date(b.created_at || b.sample_date || 0).getTime() -
        new Date(a.created_at || a.sample_date || 0).getTime()
      )[0] || null
  }

  async function importMappedFlowXTruckTickets() {
    if (!flowxCsvFile) {
      alert('Choose a Flow-X CSV file first.')
      return
    }

    const csvText = await flowxCsvFile.text()
    const parsed = parseFlowXCsvForMapping(csvText)
    const splits = getFlowXSplitsForImport(parsed.data)

    if (splits.length === 0) {
      alert('No transporter volumes found in the CSV. Check Transporter and NSV/GSV column mapping, or enable manual override.')
      return
    }
    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!targetCompanyId) {
      alert('No company selected.')
      return
    }

    const { data: batch, error: batchError } = await supabase
      .from('flowx_import_batches')
      .insert({
        company_id: targetCompanyId,
        lact_name: flowxLactName || null,
        source_file_name: flowxCsvFile.name,
        imported_count: parsed.data.length,
      })
      .select()
      .single()

    if (batchError || !batch) {
      alert('Could not create import batch: ' + (batchError?.message || 'unknown error'))
      return
    }

    let createdTickets = 0

    for (const row of parsed.data) {
      const sourceTicketNumber = getMappedFlowXValue(row, 'ticket_number')
      const batchNumber = getMappedFlowXValue(row, 'batch_number')
      const truckNumber = getMappedFlowXValue(row, 'truck_number')
      const driverName = getMappedFlowXValue(row, 'driver_name')
      const fileTransporterName = getMappedFlowXValue(row, 'customer_name')
      const producerName = getMappedFlowXValue(row, 'producer_name')
      const transporterName = getMappedFlowXValue(row, 'transporter_name') || producerName
      const leaseName = getMappedFlowXValue(row, 'lease_name')
      const meterNumber = getMappedFlowXValue(row, 'meter_number')
      const segmentName = getMappedFlowXValue(row, 'segment_name')
      const grossVolume = getMappedFlowXNumber(row, 'gross_volume_bbl')
      const netVolume = getMappedFlowXNumber(row, 'net_volume_bbl') || grossVolume
      const apiGravity = getMappedFlowXNumber(row, 'api_gravity')
      const observedTemp = getMappedFlowXNumber(row, 'observed_temperature')
      const bswPercent = getMappedFlowXNumber(row, 'bsw_percent')

      const { data: flowxRow } = await supabase
        .from('flowx_truck_import_rows')
        .insert({
          company_id: targetCompanyId,
          import_batch_id: batch.id,
          lact_name: flowxLactName || null,
          batch_number: batchNumber || null,
          ticket_number: sourceTicketNumber || null,
          truck_number: truckNumber || null,
          driver_name: driverName || null,
          producer_name: producerName || null,
          transporter_name: transporterName || null,
          lease_name: leaseName || null,
          meter_number: meterNumber || null,
          segment_name: segmentName || null,
          open_datetime: getMappedFlowXDate(row, 'open_datetime'),
          close_datetime: getMappedFlowXDate(row, 'close_datetime'),
          gross_volume_bbl: grossVolume || null,
          net_volume_bbl: netVolume || null,
          api_gravity: apiGravity || null,
          observed_temperature: observedTemp || null,
          bsw_percent: bswPercent || null,
          raw_row: row,
        })
        .select()
        .single()

      for (const split of splits) {
        const { data: generatedNumber } = await supabase.rpc('generate_ticket_number', {
          p_company_id: targetCompanyId,
        })

        const splitTransporter = split.transporter || split.customer || transporterName
        const assignedPot = getLatestPotForTransporter(splitTransporter)
        const splitGross = grossVolume * split.normalizedPercent
        const splitNet = netVolume * split.normalizedPercent

        const ticketPayload: any = {
          company_id: targetCompanyId,
          ticket_number: generatedNumber || `${sourceTicketNumber || batchNumber}-${splitTransporter}`,
          ticket_type: 'truck',
          status: 'draft',
          segment_id: flowxDefaultSegmentId || null,
          import_batch_id: batch.id,
          flowx_row_id: flowxRow?.id || null,
          truck_number: truckNumber || null,
          driver_name: driverName || null,
          customer_name: split.customer || fileTransporterName,
          split_parent_ticket: sourceTicketNumber || batchNumber || null,
          split_percent: split.percent,
          lact_name: flowxLactName || null,
          observed_inputs: {
            source: 'flowx_csv_mapped',
            lact_name: flowxLactName || null,
            source_ticket_number: sourceTicketNumber || null,
            batch_number: batchNumber || null,
            truck_number: truckNumber || null,
            driver_name: driverName || null,
            producer_name: producerName || null,
            lease_name: leaseName || null,
            meter_number: meterNumber || null,
            customer_name: splitTransporter,
            transporter_name: splitTransporter,
            assigned_pot_id: assignedPot?.id || null,
            assigned_pot_sample_date: assignedPot?.sample_date || (assignedPot as any)?.created_at || null,
            split_percent: split.percent,
            gross_volume_bbl: splitGross,
            net_volume_bbl: splitNet,
            api_gravity: apiGravity || null,
            observed_temperature: observedTemp || null,
            bsw_percent: bswPercent || null,
          },
          calculation_results: {
            gov: splitGross,
            gsv: splitGross,
            nsv: splitNet,
            split_percent: split.percent,
            assigned_pot_id: assignedPot?.id || null,
          },
        }

        const { error } = await supabase.from('tickets').insert(ticketPayload)

        if (!error) createdTickets += 1
        else console.error('Flow-X mapped ticket insert failed:', error)
      }
    }

    alert(`Flow-X import complete. Created ${createdTickets} draft truck tickets.`)
    setFlowxCsvFile(null)
    setFlowxMappingRows([])
    setFlowxMappingHeaders([])
    await loadAll()
    setPage('tickets')
  }


  function getFlowXRowValue(row: any, field: string, headers: string[] = []) {
    const mapped = typeof getMappedFlowXValue === 'function' ? getMappedFlowXValue(row, field) : ''
    if (mapped) return mapped
    for (const h of headers) if (row[h] !== undefined && row[h] !== '') return row[h]
    return ''
  }

  function getFlowXRowNumber(row: any, field: string, headers: string[] = []) {
    const raw = getFlowXRowValue(row, field, headers)
    const value = Number(String(raw || '').replace(/,/g, ''))
    return Number.isFinite(value) ? value : 0
  }

  function buildFlowXTransporterSummaries(rows: any[]) {
    const map: Record<string, any> = {}

    rows.forEach((row: any) => {
      const transporter = String(getFlowXRowValue(row, 'transporter_name', ['Transporter', 'Transporter Name', 'Customer']) || 'Unknown Transporter').trim()
      const gross = getFlowXRowNumber(row, 'gross_volume_bbl', ['GSV Batch', 'IV Batch', 'Driver Obs Gross Bbls.', 'Driver Obs Gross Bbls'])
      const net = getFlowXRowNumber(row, 'net_volume_bbl', ['NSV Batch']) || gross
      if (!transporter || (!gross && !net)) return

      if (!map[transporter]) {
        map[transporter] = { transporter, gross: 0, net: 0, temp: 0, pressure: 0, api: 0, bsw: 0, ctl: 0, cpl: 0, ctpl: 0, weight: 0, rows: 0, tickets: new Set(), batches: new Set(), trucks: new Set(), drivers: new Set(), leases: new Set() }
      }

      const weight = net || gross || 1
      const s = map[transporter]
      s.gross += gross
      s.net += net
      s.weight += weight
      s.rows += 1
      s.temp += getFlowXRowNumber(row, 'observed_temperature', ['Temperature', 'Driver Obs Temp']) * weight
      s.pressure += getFlowXRowNumber(row, 'pressure', ['Pressure']) * weight
      s.api += getFlowXRowNumber(row, 'api_gravity', ['API 60F', 'Driver Obs API']) * weight
      s.bsw += getFlowXRowNumber(row, 'bsw_percent', ['BS&W', 'Driver Obs BS&W']) * weight
      s.ctl += getFlowXRowNumber(row, 'ctl', ['CTL']) * weight
      s.cpl += getFlowXRowNumber(row, 'cpl', ['CPL']) * weight
      s.ctpl += getFlowXRowNumber(row, 'ctpl', ['CTPL']) * weight

      const ticket = getFlowXRowValue(row, 'ticket_number', ['Ticket Nr.', 'Ticket Nr', 'Ticket Number'])
      const batch = getFlowXRowValue(row, 'batch_number', ['Batch Nr.', 'Batch Nr', 'Batch Number'])
      const truck = getFlowXRowValue(row, 'truck_number', ['Truck Nr.', 'Truck Nr', 'Truck Number'])
      const driver = getFlowXRowValue(row, 'driver_name', ['Driver Name'])
      const lease = getFlowXRowValue(row, 'lease_name', ['Lease'])
      if (ticket) s.tickets.add(ticket)
      if (batch) s.batches.add(batch)
      if (truck) s.trucks.add(truck)
      if (driver) s.drivers.add(driver)
      if (lease) s.leases.add(lease)
    })

    return Object.values(map).map((s: any) => ({
      ...s,
      avgTemp: s.weight ? s.temp / s.weight : 0,
      avgPressure: s.weight ? s.pressure / s.weight : 0,
      avgApi: s.weight ? s.api / s.weight : 0,
      avgBsw: s.weight ? s.bsw / s.weight : 0,
      avgCtl: s.weight ? s.ctl / s.weight : 0,
      avgCpl: s.weight ? s.cpl / s.weight : 0,
      avgCtpl: s.weight ? s.ctpl / s.weight : 0,
      ticketList: Array.from(s.tickets).join(', '),
      batchList: Array.from(s.batches).join(', '),
      truckList: Array.from(s.trucks).join(', '),
      driverList: Array.from(s.drivers).join(', '),
      leaseList: Array.from(s.leases).join(', '),
    }))
  }


  function normalizeTransporterName(value: any) {
    return String(value || '').trim().toLowerCase()
  }

  function getAssignedPotForTransporter(transporterName: string) {
    const normalized = normalizeTransporterName(transporterName)

    const rule = transporterPotRules.find((item: any) =>
      normalizeTransporterName(item.transporter_name) === normalized
    )

    if (rule?.pot_quality_id) {
      const pot = potQuality.find((p: any) => p.id === rule.pot_quality_id)
      if (pot) return pot
    }

    const directPot = potQuality
      .filter((pot: any) => {
        const potTransporter = normalizeTransporterName(
          pot.transporter_name ||
          pot.transporter ||
          pot.customer_name ||
          pot.customer ||
          pot.producer_name ||
          ''
        )
        return potTransporter === normalized
      })
      .sort((a: any, b: any) =>
        new Date((b as any).created_at || b.sample_date || 0).getTime() -
        new Date((a as any).created_at || a.sample_date || 0).getTime()
      )[0]

    return directPot || null
  }

  async function loadTransporterPotRules() {
    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!targetCompanyId) return

    const { data, error } = await supabase
      .from('transporter_pot_rules')
      .select('*')
      .eq('company_id', targetCompanyId)
      .order('transporter_name')

    if (!error) setTransporterPotRules(data || [])
  }

  async function saveTransporterPotRule() {
    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!targetCompanyId) {
      alert('No company selected.')
      return
    }

    if (!newTransporterPotName || !newTransporterPotId) {
      alert('Enter transporter and select POT.')
      return
    }

    const { error } = await supabase
      .from('transporter_pot_rules')
      .upsert({
        company_id: targetCompanyId,
        transporter_name: newTransporterPotName.trim(),
        pot_quality_id: newTransporterPotId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,transporter_name' })

    if (error) {
      alert('Could not save transporter POT rule: ' + error.message)
      return
    }

    setNewTransporterPotName('')
    setNewTransporterPotId('')
    await loadTransporterPotRules()
    alert('Transporter POT rule saved.')
  }

  async function deleteTransporterPotRule(ruleId: string) {
    const { error } = await supabase.from('transporter_pot_rules').delete().eq('id', ruleId)
    if (error) {
      alert('Could not delete rule: ' + error.message)
      return
    }
    await loadTransporterPotRules()
  }


  function getPotNumberLabel(pot: any) {
    if (!pot) return ''
    return (
      (pot as any).pot_number ||
      (pot as any).sample_id ||
      (pot as any).sample_number ||
      (pot as any).id ||
      ''
    )
  }

  function getPotApiGravity(pot: any, fallback = 0) {
    return Number(
      (pot as any)?.api_gravity_60 ||
      (pot as any)?.api_gravity ||
      (pot as any)?.observed_api_gravity ||
      fallback ||
      0
    )
  }

  function getPotBswPercent(pot: any, fallback = 0) {
    return Number(
      (pot as any)?.bsw_percent ||
      (pot as any)?.bsw ||
      (pot as any)?.sw_percent ||
      fallback ||
      0
    )
  }

  async function importFlowXTransporterSummaryTickets() {
    if (!flowxCsvFile) {
      alert('Choose a Flow-X CSV file first.')
      return
    }

    const csvText = await flowxCsvFile.text()
    const parsed = parseFlowXCsvForMapping(csvText)
    const summaries = buildFlowXTransporterSummaries(parsed.data || [])
    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!targetCompanyId) {
      alert('No company selected.')
      return
    }

    if (summaries.length === 0) {
      alert('No transporter totals found. Check Transporter and NSV/GSV columns.')
      return
    }

    const { data: batch, error: batchError } = await supabase
      .from('flowx_import_batches')
      .insert({
        company_id: targetCompanyId,
        lact_name: flowxLactName || null,
        source_file_name: flowxCsvFile.name,
        imported_count: parsed.data.length,
        imported_by: session?.user?.email || null,
      })
      .select()
      .single()

    if (batchError || !batch) {
      alert('Could not create Flow-X import batch: ' + (batchError?.message || 'unknown error'))
      return
    }

    const ticketPayloads = summaries.map((s: any, i: number) => {
      const assignedPot = getAssignedPotForTransporter(s.transporter)
      const potApiGravity = getPotApiGravity(assignedPot, s.avgApi)
      const potBswPercent = getPotBswPercent(assignedPot, s.avgBsw)
      const potLabel = getPotNumberLabel(assignedPot)

      return ({
      company_id: targetCompanyId,
      ticket_number: `FLOWX-${flowxLactName || 'LACT'}-${s.transporter}-${Date.now()}-${i + 1}`,
      ticket_type: 'truck',
      status: 'draft',
      segment_id: flowxDefaultSegmentId || null,
      import_batch_id: batch.id,
      truck_number: s.truckList || null,
      driver_name: s.driverList || null,
      customer_name: s.transporter,
      transporter_name: s.transporter,
      split_parent_ticket: s.ticketList || s.batchList || null,
      split_percent: 100,
      lact_name: flowxLactName || null,
      observed_inputs: {
        source: 'flowx_transporter_summary',
        assigned_pot_id: assignedPot?.id || null,
        assigned_pot_label: potLabel || null,
        lact_name: flowxLactName || null,
        transporter_name: s.transporter,
        ticket_numbers: s.ticketList,
        batch_numbers: s.batchList,
        truck_numbers: s.truckList,
        driver_names: s.driverList,
        leases: s.leaseList,
        source_rows: s.rows,
        gross_volume_bbl: s.gross,
        net_volume_bbl: s.net,
        average_temperature: s.avgTemp,
        average_pressure: s.avgPressure,
        api_gravity: potApiGravity,
        bsw_percent: potBswPercent,
        ctl: Number((assignedPot as any)?.ctl || s.avgCtl || 0),
        cpl: Number((assignedPot as any)?.cpl || s.avgCpl || 0),
        ctpl: Number((assignedPot as any)?.ctpl || s.avgCtpl || 0),
      },
      calculation_results: {
        gov: s.gross,
        gsv: s.gross,
        nsv: s.net,
        average_temperature: s.avgTemp,
        average_pressure: s.avgPressure,
        api_gravity: potApiGravity,
        bsw_percent: potBswPercent,
        ctl: Number((assignedPot as any)?.ctl || s.avgCtl || 0),
        cpl: Number((assignedPot as any)?.cpl || s.avgCpl || 0),
        ctpl: Number((assignedPot as any)?.ctpl || s.avgCtpl || 0),
      },
    })
    })

    const { error } = await supabase.from('tickets').insert(ticketPayloads)
    if (error) {
      alert('Could not create transporter tickets: ' + error.message)
      return
    }

    alert(`Flow-X summary import complete. Created ${ticketPayloads.length} transporter ticket(s). POT rules applied where matched.`)
    setFlowxCsvFile(null)
    setFlowxMappingRows([])
    setFlowxMappingHeaders([])
    await loadAll()
    setPage('tickets')
  }

  async function importFlowXTruckTickets() {
    if (!flowxCsvFile) {
      alert('Choose a Flow-X CSV file first.')
      return
    }

    const csvText = await flowxCsvFile.text()
    const parsed = parseFlowXCsvForMapping(csvText)
    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!targetCompanyId) {
      alert('No company selected.')
      return
    }

    const rows = parsed.data || []

    const transporterTotals: Record<string, { gross: number; net: number; rows: any[] }> = {}

    rows.forEach((row: any) => {
      const transporter = String(
        row['Transporter'] ||
        row['Transporter Name'] ||
        getMappedFlowXValue(row, 'transporter_name') ||
        row['Customer'] ||
        'Unknown Transporter'
      ).trim()

      const gross = Number(String(
        row['GSV Batch'] ||
        row['IV Batch'] ||
        row['Driver Obs Gross Bbls.'] ||
        getMappedFlowXValue(row, 'gross_volume_bbl') ||
        0
      ).replace(/,/g, ''))

      const net = Number(String(
        row['NSV Batch'] ||
        getMappedFlowXValue(row, 'net_volume_bbl') ||
        gross ||
        0
      ).replace(/,/g, ''))

      if (!transporter || (!net && !gross)) return

      if (!transporterTotals[transporter]) transporterTotals[transporter] = { gross: 0, net: 0, rows: [] }
      transporterTotals[transporter].gross += gross || 0
      transporterTotals[transporter].net += net || gross || 0
      transporterTotals[transporter].rows.push(row)
    })

    const splits = Object.entries(transporterTotals).map(([transporter, totals]) => ({
      transporter,
      customer: transporter,
      gross: totals.gross,
      net: totals.net,
      percent: 100,
      normalizedPercent: 1,
      rows: totals.rows,
    }))

    if (splits.length === 0) {
      alert('No transporter allocations were detected from the CSV. The file must have Transporter and NSV Batch/GSV Batch columns.')
      return
    }

    const { data: batch, error: batchError } = await supabase
      .from('flowx_import_batches')
      .insert({
        company_id: targetCompanyId,
        lact_name: flowxLactName || null,
        source_file_name: flowxCsvFile.name,
        imported_count: rows.length,
        imported_by: session?.user?.email || null,
      })
      .select()
      .single()

    if (batchError || !batch) {
      alert('Could not create Flow-X import batch: ' + (batchError?.message || 'unknown error'))
      return
    }

    let createdTickets = 0

    for (const split of splits) {
      const firstRow = split.rows[0] || {}
      const sourceTicketNumber = firstRow['Ticket Nr.'] || firstRow['Ticket Nr'] || firstRow['Ticket Number'] || ''
      const batchNumber = firstRow['Batch Nr.'] || firstRow['Batch Nr'] || firstRow['Batch Number'] || ''
      const truckNumber = firstRow['Truck Nr.'] || firstRow['Truck Nr'] || firstRow['Truck Number'] || ''
      const driverName = firstRow['Driver Name'] || ''
      const leaseName = firstRow['Lease'] || ''
      const apiGravity = Number(firstRow['API 60F'] || firstRow['Driver Obs API'] || 0)
      const observedTemp = Number(firstRow['Temperature'] || firstRow['Driver Obs Temp'] || 0)
      const bswPercent = Number(firstRow['BS&W'] || firstRow['Driver Obs BS&W'] || 0)

      const { data: generatedNumber } = await supabase.rpc('generate_ticket_number', {
        p_company_id: targetCompanyId,
      })

      const ticketPayload: any = {
        company_id: targetCompanyId,
        ticket_number: generatedNumber || `FLOWX-${split.transporter}-${Date.now()}`,
        ticket_type: 'truck',
        status: 'draft',
        segment_id: flowxDefaultSegmentId || null,
        import_batch_id: batch.id,
        truck_number: truckNumber || null,
        driver_name: driverName || null,
        customer_name: split.transporter,
        transporter_name: split.transporter,
        split_parent_ticket: sourceTicketNumber || batchNumber || null,
        split_percent: split.percent,
        lact_name: flowxLactName || null,
        observed_inputs: {
          source: 'flowx_csv_transporter_auto',
          lact_name: flowxLactName || null,
          transporter_name: split.transporter,
          source_ticket_number: sourceTicketNumber || null,
          batch_number: batchNumber || null,
          truck_number: truckNumber || null,
          driver_name: driverName || null,
          lease_name: leaseName || null,
          gross_volume_bbl: split.gross,
          net_volume_bbl: split.net,
          api_gravity: apiGravity || null,
          observed_temperature: observedTemp || null,
          bsw_percent: bswPercent || null,
          source_rows: split.rows.length,
        },
        calculation_results: {
          gov: split.gross,
          gsv: split.gross,
          nsv: split.net,
          split_percent: split.percent,
        },
      }

      const { error } = await supabase.from('tickets').insert(ticketPayload)
      if (!error) createdTickets += 1
      else console.error('Flow-X transporter ticket insert failed:', error)
    }

    alert(`Flow-X import complete. Created ${createdTickets} transporter draft truck ticket(s).`)
    setFlowxCsvFile(null)
    await loadAll()
    setPage('tickets')
  }


  function getTicketDateForBalance(ticket: any) {
    return ticket.approved_at || ticket.ticket_date || ticket.created_at || ticket.updated_at || ''
  }

  function isTicketInOverShortRange(ticket: any) {
    const ticketDateRaw = getTicketDateForBalance(ticket)
    if (!ticketDateRaw) return true

    const ticketDate = new Date(ticketDateRaw)

    if (overShortStartDate && ticketDate < new Date(`${overShortStartDate}T00:00:00`)) return false
    if (overShortEndDate && ticketDate > new Date(`${overShortEndDate}T23:59:59`)) return false

    return true
  }

  function getTicketVolumeForBalance(ticket: any) {
    return Number(
      selectedTicket!.calculation_results?.nsv ??
      ticket.calculation_results?.tank_nsv ??
      selectedTicket!.calculation_results?.gsv ??
      ticket.calculation_results?.tank_gsv ??
      ticket.calculation_results?.gov ??
      ticket.calculation_results?.tank_gov ??
      0
    )
  }

  function getMeterBalanceRole(ticket: any) {
    const meter = meters.find((m: any) => m.id === ticket.meter_id)
    return String(
      ticket.meter_direction ||
      ticket.observed_inputs?.meter_direction ||
      (meter as any)?.meter_role ||
      (meter as any)?.meter_direction ||
      (meter as any)?.direction ||
      ''
    ).toLowerCase()
  }

  function getTankSignedMovement(ticket: any) {
    const direction = String(ticket.movement_direction || ticket.observed_inputs?.tank_movement_direction || '').toLowerCase()
    const volume = Number(
      ticket.calculation_results?.tank_nsv ??
      ticket.calculation_results?.tank_movement_bbl ??
      selectedTicket!.calculation_results?.nsv ??
      0
    )

    if (direction === 'receipt') return volume
    if (direction === 'delivery') return -volume

    return volume
  }

  function getActualTankInventoryForSegment(segmentId: string) {
    const segmentTanks = tanks.filter((tank: any) => tank.segment_id === segmentId)

    return segmentTanks.reduce((sum: number, tank: any) => {
      const latestTankTicket = tickets
        .filter((ticket: any) =>
          ticket.status === 'approved' &&
          ticket.ticket_type === 'tank' &&
          (ticket.tank_id === tank.id || ticket.observed_inputs?.tank_id === tank.id) &&
          isTicketInOverShortRange(ticket)
        )
        .sort((a: any, b: any) =>
          new Date(getTicketDateForBalance(b) || 0).getTime() -
          new Date(getTicketDateForBalance(a) || 0).getTime()
        )[0]

      return sum + Number(
        latestTankTicket?.calculation_results?.tank_closing_bbl ??
        latestTankTicket?.observed_inputs?.tank_closing_bbl ??
        latestTankTicket?.calculation_results?.tank_gsv ??
        0
      )
    }, 0)
  }

  function getOverShortRows() {
    return segments
      .filter((segment: any) => !overShortSegmentId || segment.id === overShortSegmentId)
      .map((segment: any) => {
        const segmentTickets = tickets.filter((ticket: any) =>
          ticket.status === 'approved' &&
          ticket.segment_id === segment.id &&
          isTicketInOverShortRange(ticket)
        )

        const receipts = segmentTickets
          .filter((ticket: any) => ticket.ticket_type !== 'tank' && getMeterBalanceRole(ticket) === 'receipt')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const deliveries = segmentTickets
          .filter((ticket: any) => ticket.ticket_type !== 'tank' && getMeterBalanceRole(ticket) === 'delivery')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const truckTickets = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'truck')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const tankChange = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'tank')
          .reduce((sum: number, ticket: any) => sum + getTankSignedMovement(ticket), 0)

        const lineFillChange = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'line_fill')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const bookInventory = receipts - deliveries - truckTickets + tankChange + lineFillChange
        const actualInventory = getActualTankInventoryForSegment(segment.id)
        const overShort = actualInventory - bookInventory
        const overShortPercent = bookInventory !== 0 ? (overShort / Math.abs(bookInventory)) * 100 : 0

        return {
          segment,
          receipts,
          deliveries,
          truckTickets,
          tankChange,
          lineFillChange,
          bookInventory,
          actualInventory,
          overShort,
          overShortPercent,
        }
      })
  }


  function xmlEscape(value: any) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function excelCell(value: any, type: 'String' | 'Number' = 'String') {
    const numeric = type === 'Number' && value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))

    return `<Cell><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(numeric ? Number(value) : value)}</Data></Cell>`
  }

  function excelRow(values: any[], numericIndexes: number[] = []) {
    return `<Row>${values.map((value, index) => excelCell(value, numericIndexes.includes(index) ? 'Number' : 'String')).join('')}</Row>`
  }

  function downloadExcelXml(filename: string, sheets: { name: string; rows: any[][]; numericIndexes?: number[] }[]) {
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${sheets.map((sheet) => `
 <Worksheet ss:Name="${xmlEscape(sheet.name.slice(0, 31))}">
  <Table>
   ${sheet.rows.map((row, rowIndex) => {
     const xmlRow = excelRow(row, rowIndex === 0 ? [] : (sheet.numericIndexes || []))
     return rowIndex === 0 ? xmlRow.replace(/<Cell>/g, '<Cell ss:StyleID="header">') : xmlRow
   }).join('\n')}
  </Table>
 </Worksheet>`).join('\n')}
</Workbook>`

    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }


  function isDateInReportRange(value?: string | null) {
    if (!value) return true

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return true

    if (reportStartDate && date < new Date(`${reportStartDate}T00:00:00`)) return false
    if (reportEndDate && date > new Date(`${reportEndDate}T23:59:59`)) return false

    return true
  }

  function getTicketReportDate(ticket: any) {
    return ticket.approved_at || ticket.ticket_date || ticket.created_at || ticket.updated_at || ''
  }

  function getReportFilteredTickets(type?: string) {
    return tickets.filter((ticket: any) => {
      const typeOk = type ? ticket.ticket_type === type : true
      const producerOk = reportProducerId ? ticket.producer_id === reportProducerId : true
      const segmentOk = reportSegmentId ? ticket.segment_id === reportSegmentId : true
      const dateOk = isDateInReportRange(getTicketReportDate(ticket))

      return typeOk && producerOk && segmentOk && dateOk
    })
  }

  function exportReportTicketsCsv(type?: string) {
    const rows = getReportFilteredTickets(type)
    const header = [
      'Ticket #',
      'Type',
      'Status',
      'Producer',
      'Segment',
      'Meter',
      'GSV',
      'NSV',
      'Date',
    ]

    const csvRows = rows.map((ticket: any) => {
      const producer = producers.find((p: any) => p.id === ticket.producer_id)
      const segment = segments.find((s: any) => s.id === ticket.segment_id)
      const meter = meters.find((m: any) => m.id === ticket.meter_id)

      return [
        ticket.ticket_number || ticket.id,
        ticket.ticket_type || '',
        ticket.status || '',
        producer?.name || '',
        segment?.name || '',
        meter?.meter_number || '',
        selectedTicket!.calculation_results?.gsv ?? ticket.calculation_results?.tank_gsv ?? '',
        selectedTicket!.calculation_results?.nsv ?? ticket.calculation_results?.tank_nsv ?? '',
        getTicketReportDate(ticket),
      ]
    })

    downloadCsv(`${type || 'all'}-tickets-${reportStartDate || 'all'}-to-${reportEndDate || 'all'}.csv`, [header, ...csvRows])
  }

  function exportReportTicketsExcel(type?: string) {
    const rows = getReportFilteredTickets(type)
    const sheetRows = [
      ['Ticket #', 'Type', 'Status', 'Producer', 'Segment', 'Meter', 'GSV', 'NSV', 'Date'],
      ...rows.map((ticket: any) => {
        const producer = producers.find((p: any) => p.id === ticket.producer_id)
        const segment = segments.find((s: any) => s.id === ticket.segment_id)
        const meter = meters.find((m: any) => m.id === ticket.meter_id)

        return [
          ticket.ticket_number || ticket.id,
          ticket.ticket_type || '',
          ticket.status || '',
          producer?.name || '',
          segment?.name || '',
          meter?.meter_number || '',
          Number(selectedTicket!.calculation_results?.gsv ?? ticket.calculation_results?.tank_gsv ?? 0).toFixed(2),
          Number(selectedTicket!.calculation_results?.nsv ?? ticket.calculation_results?.tank_nsv ?? 0).toFixed(2),
          getTicketReportDate(ticket),
        ]
      }),
    ]

    downloadExcelXml(`${type || 'all'}-tickets-${reportStartDate || 'all'}-to-${reportEndDate || 'all'}.xls`, [
      { name: `${type || 'All'} Tickets`, rows: sheetRows, numericIndexes: [6, 7] },
    ])
  }

  function getFlowXImportedTickets() {
    return getReportFilteredTickets('truck').filter((ticket: any) =>
      ticket.import_batch_id || ticket.flowx_row_id || ticket.observed_inputs?.source === 'flowx_csv'
    )
  }

  function exportFlowXImportedTicketsExcel() {
    const rows = getFlowXImportedTickets()
    const sheetRows = [
      ['Ticket #', 'Truck #', 'Driver', 'Transporter', 'Split %', 'GSV', 'NSV', 'LACT', 'Date'],
      ...rows.map((ticket: any) => [
        ticket.ticket_number || ticket.id,
        ticket.truck_number || ticket.observed_inputs?.truck_number || '',
        ticket.driver_name || ticket.observed_inputs?.driver_name || '',
        (ticket as any).customer_name || ticket.observed_inputs?.customer_name || '',
        ticket.split_percent || ticket.observed_inputs?.split_percent || '',
        Number(selectedTicket!.calculation_results?.gsv ?? 0).toFixed(2),
        Number(selectedTicket!.calculation_results?.nsv ?? 0).toFixed(2),
        ticket.lact_name || ticket.observed_inputs?.lact_name || '',
        getTicketReportDate(ticket),
      ]),
    ]

    downloadExcelXml(`flowx-truck-tickets-${reportStartDate || 'all'}-to-${reportEndDate || 'all'}.xls`, [
      { name: 'FlowX Truck Tickets', rows: sheetRows, numericIndexes: [4, 5, 6] },
    ])
  }

  function exportOverShortExcel() {
    const rows = getOverShortRows()

    const summaryRows = [
      [
        'Segment',
        'Receipts',
        'Deliveries',
        'Truck Tickets',
        'Tank Change',
        'Line Fill Change',
        'Book Inventory',
        'Actual Inventory',
        'Over / Short',
        'Over / Short %',
      ],
      ...rows.map((row: any) => [
        row.segment.name,
        row.receipts.toFixed(2),
        row.deliveries.toFixed(2),
        row.truckTickets.toFixed(2),
        row.tankChange.toFixed(2),
        row.lineFillChange.toFixed(2),
        row.bookInventory.toFixed(2),
        row.actualInventory.toFixed(2),
        row.overShort.toFixed(2),
        row.overShortPercent.toFixed(4),
      ]),
    ]

    const segmentSheets = rows.map((row: any) => {
      const segmentTickets = tickets
        .filter((ticket: any) =>
          ticket.status === 'approved' &&
          ticket.segment_id === row.segment.id &&
          isTicketInOverShortRange(ticket)
        )

      return {
        name: row.segment.name || 'Segment',
        numericIndexes: [4, 5, 6, 7],
        rows: [
          ['Ticket #', 'Type', 'Status', 'Meter Role', 'Volume', 'Tank Change', 'Date', 'Transporter'],
          ...segmentTickets.map((ticket: any) => [
            ticket.ticket_number || ticket.id,
            ticket.ticket_type || '',
            ticket.status || '',
            getMeterBalanceRole(ticket) || ticket.observed_inputs?.tank_movement_direction || '',
            getTicketVolumeForBalance(ticket).toFixed(2),
            ticket.ticket_type === 'tank' ? getTankSignedMovement(ticket).toFixed(2) : '',
            getTicketDateForBalance(ticket),
            (ticket as any).customer_name || ticket.observed_inputs?.customer_name || '',
          ]),
        ],
      }
    })

    downloadExcelXml(`segment-over-short-${overShortStartDate || 'all'}-to-${overShortEndDate || 'all'}.xls`, [
      { name: 'Segment Summary', rows: summaryRows, numericIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      ...segmentSheets,
    ])
  }

  function exportOverShortCsv() {
    const rows = getOverShortRows()
    const header = [
      'Segment',
      'Receipts',
      'Deliveries',
      'Truck Tickets',
      'Tank Change',
      'Line Fill Change',
      'Book Inventory',
      'Actual Inventory',
      'Over Short',
      'Over Short Percent',
    ]

    const csvRows = rows.map((row: any) => [
      row.segment.name,
      row.receipts.toFixed(2),
      row.deliveries.toFixed(2),
      row.truckTickets.toFixed(2),
      row.tankChange.toFixed(2),
      row.lineFillChange.toFixed(2),
      row.bookInventory.toFixed(2),
      row.actualInventory.toFixed(2),
      row.overShort.toFixed(2),
      row.overShortPercent.toFixed(4),
    ])

    downloadCsv(`over-short-${overShortStartDate || 'all'}-to-${overShortEndDate || 'all'}.csv`, [header, ...csvRows])
  }

  function getSegmentInventoryRows() {
    return segments.map((segment: any) => {
      const segmentTickets = tickets.filter((ticket: any) => ticket.segment_id === segment.id && ticket.status === 'approved')
      const receiptVolume = segmentTickets
        .filter((ticket: any) => {
          const meter = meters.find((m: any) => m.id === ticket.meter_id)
          return ((meter as any)?.meter_role || (meter as any)?.meter_direction || (meter as any)?.direction) === 'receipt'
        })
        .reduce((sum: number, ticket: any) => sum + Number(selectedTicket!.calculation_results?.nsv || selectedTicket!.calculation_results?.gsv || 0), 0)

      const deliveryVolume = segmentTickets
        .filter((ticket: any) => {
          const meter = meters.find((m: any) => m.id === ticket.meter_id)
          return ((meter as any)?.meter_role || (meter as any)?.meter_direction || (meter as any)?.direction) === 'delivery'
        })
        .reduce((sum: number, ticket: any) => sum + Number(selectedTicket!.calculation_results?.nsv || selectedTicket!.calculation_results?.gsv || 0), 0)

      const tankMovement = segmentTickets
        .filter((ticket: any) => ticket.ticket_type === 'tank')
        .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.tank_nsv || ticket.calculation_results?.tank_movement_bbl || 0), 0)

      const truckVolume = segmentTickets
        .filter((ticket: any) => ticket.ticket_type === 'truck')
        .reduce((sum: number, ticket: any) => sum + Number(selectedTicket!.calculation_results?.nsv || 0), 0)

      const overShort = receiptVolume - deliveryVolume + tankMovement - truckVolume

      return {
        segment,
        receiptVolume,
        deliveryVolume,
        tankMovement,
        truckVolume,
        overShort,
      }
    })
  }

  async function importMetersCsv() {
    if (!meterCsvFile) {
      alert('Choose a CSV file first.')
      return
    }

    const targetCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!targetCompanyId) {
      alert('Select or load a company before importing.')
      return
    }

    setMeterCsvImporting(true)

    try {
      const csvText = await meterCsvFile.text()
      const rows = parseMeterCsv(csvText)

      if (rows.length === 0) {
        alert('CSV has no rows.')
        return
      }

      let imported = 0

      for (const row of rows) {
        const areaName = row.area || row.area_name || ''
        const segmentName = row.segment || row.segment_name || ''
        const producerName = row.producer || row.producer_name || ''
        const leaseName = row.lease || row.lease_name || ''
        const meterNumber = row.meter_number || row.meter || row.meter_name || ''
        const meterDirection = row.meter_direction || row.direction || ''
        const defaultTicketType = row.default_ticket_type || row.ticket_type || ''
        const sourceTankNumber = row.source_tank || row.source_tank_number || ''
        const destinationTankNumber = row.destination_tank || row.destination_tank_number || ''
        const lineFillName = row.line_fill || row.line_fill_name || ''

        if (!meterNumber) continue

        const area = await findOrCreateByName('areas', 'name', areaName)
        const segment = await findOrCreateByName('segments', 'name', segmentName, {
          area_id: area?.id || null,
        })
        const producer = await findOrCreateByName('producers', 'name', producerName)
        const lease = await findOrCreateByName('leases', 'lease_name', leaseName, {
          area_id: area?.id || null,
          segment_id: segment?.id || null,
          producer_id: producer?.id || null,
        })



        const sourceTank = sourceTankNumber
          ? tanks.find((tank: any) => tank.tank_number === sourceTankNumber) || await findOrCreateByName('tanks', 'tank_number', sourceTankNumber, { segment_id: segment?.id || null })
          : null

        const destinationTank = destinationTankNumber
          ? tanks.find((tank: any) => tank.tank_number === destinationTankNumber) || await findOrCreateByName('tanks', 'tank_number', destinationTankNumber, { segment_id: segment?.id || null })
          : null

        const lineFill = lineFillName
          ? lineFills.find((line: any) => line.line_name === lineFillName) || await findOrCreateByName('line_fills', 'line_name', lineFillName, { segment_id: segment?.id || null })
          : null

        const { data: existingMeter } = await supabase
          .from('meters')
          .select('*')
          .eq('meter_number', meterNumber)
          .maybeSingle()

        if (existingMeter) {
          await supabase
            .from('meters')
            .update({
              company_id: targetCompanyId,
              area_id: area?.id || existingMeter.area_id || null,
              segment_id: segment?.id || existingMeter.segment_id || null,
              producer_id: producer?.id || existingMeter.producer_id || null,
              lease_id: lease?.id || existingMeter.lease_id || null,
              active: true,
              direction: meterDirection || existingMeter.direction || null,
              default_ticket_type: defaultTicketType || existingMeter.default_ticket_type || null,
              source_tank_id: sourceTank?.id || existingMeter.source_tank_id || null,
              destination_tank_id: destinationTank?.id || existingMeter.destination_tank_id || null,
              line_fill_id: lineFill?.id || existingMeter.line_fill_id || null,
            })
            .eq('id', existingMeter.id)
        } else {
          const { error } = await supabase.from('meters').insert({
            company_id: targetCompanyId,
            meter_number: meterNumber,
            area_id: area?.id || null,
            segment_id: segment?.id || null,
            producer_id: producer?.id || null,
            lease_id: lease?.id || null,
            active: true,
            direction: meterDirection || null,
            default_ticket_type: defaultTicketType || null,
            source_tank_id: sourceTank?.id || null,
            destination_tank_id: destinationTank?.id || null,
            line_fill_id: lineFill?.id || null,
          })

          if (error) throw error
        }

        imported += 1
      }

      setMeterCsvFile(null)
      alert(`Imported ${imported} meters.`)
      await loadAll()
    } catch (error: any) {
      console.error('Meter CSV import failed:', error)
      alert(error?.message || 'Meter CSV import failed.')
    } finally {
      setMeterCsvImporting(false)
    }
  }

  async function createCompanyAdminUser() {
    if (!userIsSuperAdmin) {
      alert('Only super admins can create company admins.')
      return
    }


    if (!userIsSuperAdmin && userRoles.length > 0) {
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
    if (userIsCompanyAdmin && (newAdminRole === 'admin' || newAdminRole === 'super_admin')) {
      alert('Company admins cannot create admin or super admin users.')
      return
    }

    if (userIsCompanyAdmin && !companyId) {
      alert('Your company is not loaded yet.')
      return
    }


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



  function getTicketAuditRows(ticketId?: string | null) {
    if (!ticketId) return []

    return ticketAuditLogs
      .filter((log: any) => log.ticket_id === ticketId || log.ticketId === ticketId)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.created_at || a.createdAt || 0).getTime()
        const bTime = new Date(b.created_at || b.createdAt || 0).getTime()
        return bTime - aTime
      })
  }

  function formatAuditDate(value?: string | null) {
    if (!value) return 'No timestamp'

    try {
      return new Date(value).toLocaleString()
    } catch {
      return String(value)
    }
  }

  function getAuditLabel(log: any) {
    return (
      log.action ||
      log.event ||
      log.status ||
      log.new_status ||
      log.newStatus ||
      'Activity'
    )
  }

  const timelineDot: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: 'linear-gradient(135deg, #c46a2b, #e08745)',
    boxShadow: '0 0 12px rgba(196,106,43,0.55)',
    marginTop: 5,
  }


  const gqLiquidImportHeaders = ["Number", "Column Type", "EffectiveDate", "", "Sample Date", "Sample Type", "BTU Base", "Heating Value (measured)", "Relative Density (specific gravity)", "Viscosity", "Specific Heat Ratio", "Heating Value Pressure Base", "Carbon Dioxide (co2)", "Nitrogen (n2)", "Methane (c1)", "Ethane (c2)", "Propane (c3)", "Iso Butane (iso_c4)", "N Butane (n_c4)", "Iso Pentane (iso_c5)", "N Pentane (n_c5)", "Neo Pentane (neo_c5)", "Hexane (c6)", "Heptane (c7)", "Octane (c8)", "Nonane (c9)", "Decane (c10)", "Argon (ar)", "Carbon Monoxide (co)", "Hydrogen (h2)", "Oxygen (o2)", "Water Vapor (h2o)", "Hydrogen Sulfide (h2s)", "Helium (he)", "Hydrogen Sulfide (H2S)", "Carbon Sulfoxide (COS)", "Methyl Mercaptan (MeSH)", "Methyl Ethyl Sulfide (MES)", "Ethyl Mercaptan (EtSH)", "Dimethyl Sulfide (DMS)", "Total Sulfur", "H2O Per Volume", "Measured GPM Content", "Sample Count", "Heating Value Dry", "Condensate GPM", "Hexane Plus Heating Value (c6_plus_hv)", "Field Remarks", "Office Remarks", "Sample Technician", "Analysis Technician", "Instrument Number", "Sample Pressure", "Temp", "User defined number 1", "User defined number 2", "User defined number 3", "User defined number 4", "User defined number 5", "User defined string 1", "User defined string 2", "User defined string 3", "User defined string 4", "User defined string 5", "Full Well Stream Factor", "Ethane GPM (c2_gpm)", "Propane GPM (c3_gpm)", "Iso Butane GPM (iso_c4_gpm)", "N Butane GPM(n_c4_gpm)", "Iso Pentane GPM (iso_c5_gpm)", "N Pentane GPM(n_c5_gpm)", "Hexane GPM (c6_gpm)", "Heptane GPM (c7_gpm)", "Heating Value Wet", "Heating Value As Delivered", "Analysis Date", "Cylinder Number", "", "", "", "Octane GPM (c8_gpm)", "Nonane GPM (c9_gpm)", "Decane GPM (c10_gpm)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "BSW", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Grav"]

  function csvEscape(value: any) {
    if (value === null || value === undefined) return ''

    const textValue = String(value)

    if (/[",\n\r]/.test(textValue)) {
      return `"${textValue.replace(/"/g, '""')}"`
    }

    return textValue
  }

  function formatCsvDate(value: any) {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()

    return `${month}/${day}/${year}`
  }

  function downloadCsv(filename: string, rows: any[][]) {
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function getPotExportNumber(pot: any, index: number) {
    return (
      pot.number ||
      pot.import_number ||
      pot.grindout_number ||
      pot.sample_number ||
      pot.ticket_number ||
      pot.id ||
      index + 1
    )
  }

  async function exportPotWorkingsCsv() {
    if (!potCsvStartDate || !potCsvEndDate) {
      alert('Select a POT export start date and end date.')
      return
    }

    const start = new Date(`${potCsvStartDate}T00:00:00`)
    const end = new Date(`${potCsvEndDate}T23:59:59`)

    const rowsToExport = potQuality.filter((pot: any) => {
      const sampleDate = pot.sample_date || pot.sampleDate || pot.effective_date || (pot as any).created_at || ''
      const dateOk = sampleDate ? new Date(sampleDate) >= start && new Date(sampleDate) <= end : false
      const producerOk = potCsvProducerId ? pot.producer_id === potCsvProducerId || pot.producerId === potCsvProducerId : true
      return dateOk && producerOk
    })

    if (rowsToExport.length === 0) {
      alert('No POT workings found for that date range.')
      return
    }

    const dataRows = rowsToExport.map((pot: any, index: number) => {
      const row = Array(gqLiquidImportHeaders.length).fill('')
      const sampleDate = pot.sample_date || pot.sampleDate || pot.effective_date || (pot as any).created_at || ''
      const bsw = (pot as any).bsw ?? (pot as any).bsw_percent ?? pot.bs_w ?? ''
      const grav = (pot as any).observed_api_gravity ?? (pot as any).api_gravity ?? pot.gravity ?? ''
      const temp = pot.observed_temperature ?? pot.sample_temperature ?? pot.temp ?? ''

      // Match uploaded GQ liquid import header structure exactly by column position.
      row[0] = getPotExportNumber(pot, index)           // Number
      row[1] = pot.column_type || 'A'                   // Column Type
      row[2] = formatCsvDate(sampleDate)                // EffectiveDate
      row[4] = formatCsvDate(sampleDate)                // Sample Date
      row[53] = temp                                    // Temp
      row[59] = pot.user_defined_string_1 || 'L'        // User defined string 1, template sample uses L
      row[181] = bsw                                    // BSW - FZ column
      row[201] = grav                                   // Grav

      return row
    })

    const producer = producers.find((p) => p.id === potCsvProducerId)
    const producerName = producer?.name || 'all-producers'
    const filename = `pot-workings-${producerName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${potCsvStartDate}-to-${potCsvEndDate}.csv`

    downloadCsv(filename, [gqLiquidImportHeaders, ...dataRows])
  }

  async function exportProducerPdfBundle() {
    if (!pdfBundleStartDate || !pdfBundleEndDate) {
      alert('Select a start date and end date.')
      return
    }

    const start = new Date(`${pdfBundleStartDate}T00:00:00`)
    const end = new Date(`${pdfBundleEndDate}T23:59:59`)

    const getTicketDate = (ticket: any) =>
      ticket.ticket_date ||
      ticket.ticketDate ||
      ticket.created_at ||
      ticket.createdAt ||
      ticket.updated_at ||
      ticket.updatedAt ||
      ticket.approved_at ||
      ticket.approvedAt ||
      ''

    const getTicketProducerId = (ticket: any) =>
      ticket.producer_id ||
      ticket.producerId ||
      ticket.observed_inputs?.producer_id ||
      ticket.calculation_profile_snapshot?.producer_id ||
      ''

    const ticketsToExport = tickets.filter((ticket: any) => {
      const statusOk = ticket.status === 'approved'
      const ticketDateValue = getTicketDate(ticket)

      const dateOk = ticketDateValue
        ? new Date(ticketDateValue) >= start && new Date(ticketDateValue) <= end
        : true

      const producerOk = pdfBundleProducerId
        ? getTicketProducerId(ticket) === pdfBundleProducerId
        : true

      return statusOk && dateOk && producerOk
    })

    if (ticketsToExport.length === 0) {
      alert('No approved tickets found for that producer/date range.')
      return
    }

    const zip = new JSZip()
    let addedCount = 0

    const makeTicketHtml = async (ticket: any) => {
      const companyName = getCompanyDisplayName()
      const companyLogoUrl = getCompanyLogoUrl()
      const companyAccent = getCompanyAccentColor()
      const companyLogoDataUrl = companyLogoUrl ? await getImageDataUrl(companyLogoUrl) : ''
      const producer = producers.find((p) => p.id === ticket.producer_id)
      const meter = meters.find((m) => m.id === ticket.meter_id)
      const segment = segments.find((s) => s.id === ticket.segment_id)
      const value = (v: any) => v === null || v === undefined || v === '' ? '—' : v

      return `
        <html>
          <head>
            <title>${ticket.ticket_number || 'Ticket'}</title>
            <style>
              @page { size: letter portrait; margin: 0.35in; }
              * { box-sizing: border-box; }
              body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; line-height: 1.15; }
              .page { width: 100%; max-width: 7.8in; margin: 0 auto; }
              .brand-header { border-bottom: 3px solid ${companyAccent}; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
              .brand-name { font-size: 24px; font-weight: 900; color: ${companyAccent}; }
              .brand-subtitle { font-size: 10.5px; color: #111; margin-top: 2px; }
              .brand-logo { max-height: 42px; max-width: 140px; object-fit: contain; }
              .ticket-title { text-align: center; font-size: 24px; font-weight: 900; margin: 8px 0 10px; letter-spacing: 0.4px; }
              .section { border: 1.4px solid #111; margin-bottom: 10px; page-break-inside: avoid; }
              .section-title { text-align: center; font-size: 14px; font-weight: 900; border-bottom: 1.2px solid #111; padding: 5px 8px; background: #fafafa; }
              .grid-two { display: grid; grid-template-columns: 1fr 1fr; }
              .row { display: grid; grid-template-columns: 48% 52%; min-height: 21px; border-bottom: 1px solid #d6d6d6; }
              .grid-two > .row:nth-child(odd) { border-right: 1px solid #111; }
              .label { font-weight: 900; padding: 5px 7px; }
              .val { text-align: right; padding: 5px 7px; }
              .footer { border-top: 1.4px solid #111; margin-top: 10px; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="brand-header">
                <div>
                  <div class="brand-name">${getCompanyDisplayName()}</div>
                  <div class="brand-subtitle">Custody Transfer Ticket</div>
                </div>
                ${companyLogoDataUrl ? `<img class="brand-logo" src="${companyLogoDataUrl}" />` : ''}
              </div>

              <div class="ticket-title">${ticket.ticket_number || 'Ticket'}</div>

              <div class="section">
                <div class="grid-two">
                  <div class="row"><div class="label">Status:</div><div class="val">${value(ticket.status)}</div></div>
                  <div class="row"><div class="label">Contract Profile:</div><div class="val">${value(ticket.observed_inputs?.contract_profile_name || ticket.calculation_profile_snapshot?.contract_profile?.name || 'Default')}</div></div>
                  <div class="row"><div class="label">Type:</div><div class="val">${value(ticket.ticket_type)}</div></div>
                  <div class="row"><div class="label">Calculation Method:</div><div class="val">${value(ticket.observed_inputs?.calculation_method || ticket.calculation_profile_snapshot?.selected_calculation_method || 'CTPL')}</div></div>
                  <div class="row"><div class="label">Producer:</div><div class="val">${value(producer?.name)}</div></div>
                  <div class="row"><div class="label">Ticket Created:</div><div class="val">${value(getTicketDate(ticket) ? new Date(getTicketDate(ticket)).toLocaleString() : '')}</div></div>
                  <div class="row"><div class="label">Meter:</div><div class="val">${value(meter?.meter_number)}</div></div>
                  <div class="row"><div class="label">Segment:</div><div class="val">${value(segment?.name)}</div></div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Observed Inputs</div>
                <div class="grid-two">
                  <div class="row"><div class="label">IV:</div><div class="val">${value(ticket.observed_inputs?.iv)}</div></div>
                  <div class="row"><div class="label">Density @60 kg/m³:</div><div class="val">${value(ticket.observed_inputs?.density_60)}</div></div>
                  <div class="row"><div class="label">CTL:</div><div class="val">${value(ticket.observed_inputs?.ctl)}</div></div>
                  <div class="row"><div class="label">Avg Temp (°F):</div><div class="val">${value(ticket.observed_inputs?.average_temperature)}</div></div>
                  <div class="row"><div class="label">CPL:</div><div class="val">${value(ticket.observed_inputs?.cpl)}</div></div>
                  <div class="row"><div class="label">Avg Pressure (psi):</div><div class="val">${value(ticket.observed_inputs?.average_pressure)}</div></div>
                  <div class="row"><div class="label">CTLP:</div><div class="val">${value(ticket.observed_inputs?.ctlp)}</div></div>
                  <div class="row"><div class="label">BS&W %:</div><div class="val">${value(ticket.observed_inputs?.bsw_percent)}</div></div>
                  <div class="row"><div class="label">CMF:</div><div class="val">${value(ticket.observed_inputs?.cmf)}</div></div>
                  <div class="row"><div class="label">CSW:</div><div class="val">${value(ticket.observed_inputs?.csw)}</div></div>
                  <div class="row"><div class="label">Observed API Gravity:</div><div class="val">${value(ticket.observed_inputs?.observed_api_gravity)}</div></div>
                  <div class="row"><div class="label">API Gravity @60°F:</div><div class="val">${value(ticket.observed_inputs?.api_gravity_60 || ticket.observed_inputs?.corrected_api)}</div></div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Calculated Results</div>
                <div class="grid-two">
                  <div class="row"><div class="label">CCF:</div><div class="val">${value(ticket.calculation_results?.ccf)}</div></div>
                  <div class="row"><div class="label">Flowing Volume (bbl):</div><div class="val">${value(ticket.calculation_results?.flowing_volume || ticket.calculation_results?.gross_volume)}</div></div>
                  <div class="row"><div class="label">GSV:</div><div class="val">${value(selectedTicket!.calculation_results?.gsv)}</div></div>
                  <div class="row"><div class="label">Net Volume (bbl):</div><div class="val">${value(ticket.calculation_results?.net_volume || selectedTicket!.calculation_results?.nsv)}</div></div>
                  <div class="row"><div class="label">NSV:</div><div class="val">${value(selectedTicket!.calculation_results?.nsv)}</div></div>
                  <div class="row"><div class="label">Water Volume (bbl):</div><div class="val">${value(ticket.calculation_results?.water_volume)}</div></div>
                </div>
              </div>

              <div class="footer">
                <div><strong>Notes:</strong><br />${value(ticket.notes)}</div>
                <div>
                  <div><strong>Approved By:</strong> ${value(ticket.approved_by_name || ticket.approved_by_email)}</div>
                  <div style="margin-top: 10px;"><strong>Approved Date:</strong> ${value(ticket.approved_at ? new Date(ticket.approved_at).toLocaleString() : '')}</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    }

    for (const ticket of ticketsToExport as any[]) {
      const pdfUrl = ticket.pdf_url || ticket.pdfUrl
      const ticketLabel =
        ticket.ticket_number ||
        ticket.ticket_no ||
        ticket.id ||
        `ticket-${ticketsToExport.indexOf(ticket) + 1}`

      const safeLabel = String(ticketLabel).replace(/[^a-zA-Z0-9-_]/g, '_')

      if (pdfUrl) {
        try {
          const response = await fetch(pdfUrl)
          if (response.ok) {
            const blob = await response.blob()
            if (blob.size > 0) {
              zip.file(`${safeLabel}.pdf`, blob)
              addedCount += 1
              continue
            }
          }
        } catch (error) {
          console.error('PDF fetch failed, falling back to HTML:', error)
        }
      }

      const html = await makeTicketHtml(ticket)
      zip.file(`${safeLabel}.html`, html)
      addedCount += 1
    }

    if (addedCount === 0) {
      alert('No files could be added to the ZIP.')
      return
    }

    zip.file(
      'README.txt',
      `Producer PDF Bundle\nTickets exported: ${addedCount}\nIf PDF files were not stored yet, the app included printable HTML custody transfer tickets instead. Open the HTML files in your browser and save/print as PDF.\n`
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    const producer = producers.find((p) => p.id === pdfBundleProducerId)
    const producerName = producer?.name || 'all-producers'
    const fileName = `producer-tickets-${producerName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${pdfBundleStartDate}-to-${pdfBundleEndDate}.zip`

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const box: CSSProperties = {
    background: 'linear-gradient(145deg, rgba(28,32,35,0.98), rgba(10,15,18,0.98))',
    border: `1px solid ${accentRgba(0.28)}`,
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
    minHeight: 44,
  }
  const button: CSSProperties = {
    width: '100%',
    padding: 12,
    marginTop: 10,
    background: accentGradient(),
    color: 'white',
    border: `1px solid ${accentRgba(0.9)}`,
    borderRadius: 12,
    cursor: 'pointer',
    opacity: isActionRunning ? 0.65 : 1,
    fontWeight: 700,
    boxShadow: `0 0 18px ${accentRgba(0.24)}`,
    minHeight: 44,
  }

  const sidebarBrandCard: CSSProperties = {
    background: 'linear-gradient(145deg, rgba(20,25,28,1), rgba(9,13,16,1))',
    border: `1px solid ${accentRgba(0.28)}`,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
  }

  const sidebarLogoBox: CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  }



  const kpiCard: CSSProperties = {
    ...card,
    minHeight: 92,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    border: `1px solid ${accentRgba(0.22)}`,
  }

  const reportPanel: CSSProperties = {
    ...box,
    border: `1px solid ${accentRgba(0.30)}`,
  }

  const reportGrid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 12,
    marginBottom: 18,
  }

  const compactMetric: CSSProperties = {
    ...card,
    minHeight: 76,
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



  function getLatestProvingForMeter(meterId: string) {
    return provings
      .filter((proving: any) => proving.meter_id === meterId || proving.meterId === meterId)
      .sort((a: any, b: any) => {
        const aDate = new Date(a.proving_date || a.created_at || 0).getTime()
        const bDate = new Date(b.proving_date || b.created_at || 0).getTime()
        return bDate - aDate
      })[0]
  }

  function getLatestReadingForMeter(meterId: string) {
    return readings
      .filter((reading: any) => reading.meter_id === meterId || reading.meterId === meterId)
      .sort((a: any, b: any) => {
        const aDate = new Date(a.reading_date || a.created_at || 0).getTime()
        const bDate = new Date(b.reading_date || b.created_at || 0).getTime()
        return bDate - aDate
      })[0]
  }

  function daysSince(value?: string | null) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const meterIntelligence = meters.map((meter: any) => {
    const latestProving = getLatestProvingForMeter(meter.id)
    const latestReading = getLatestReadingForMeter(meter.id)
    const provingDate = latestProving?.proving_date || (latestProving as any)?.created_at || null
    const readingDate = latestReading?.reading_date || (latestReading as any)?.created_at || null
    const provingAgeDays = daysSince(provingDate)
    const readingAgeDays = daysSince(readingDate)
    const provingFrequencyDays = Number(meter.proving_frequency_days || meter.provingFrequencyDays || 30)
    const isOverdue = provingAgeDays === null || provingAgeDays > provingFrequencyDays
    const isDueSoon = provingAgeDays !== null && !isOverdue && provingAgeDays >= Math.max(provingFrequencyDays - 7, 0)
    const readingStale = readingAgeDays === null || readingAgeDays > 7

    return {
      meter,
      latestProving,
      latestReading,
      provingDate,
      readingDate,
      provingAgeDays,
      readingAgeDays,
      provingFrequencyDays,
      isOverdue,
      isDueSoon,
      readingStale,
    }
  })

  const opsOverdueMeters = meterIntelligence.filter((item) => item.isOverdue)
  const opsDueSoonMeters = meterIntelligence.filter((item) => item.isDueSoon)
  const staleReadingMeters = meterIntelligence.filter((item) => item.readingStale)
  const opsCompliantMeters = meterIntelligence.filter((item) => !item.isOverdue)
  const opsProvingCompliancePercent =
    meters.length > 0 ? Math.round((opsCompliantMeters.length / meters.length) * 100) : 100


  const ticketDraftStorageKey = `measurement-ticket-draft-${companyId || 'global'}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ticketDraftStorageKey)
      setHasLocalTicketDraft(Boolean(saved))
    } catch {
      setHasLocalTicketDraft(false)
    }
  }, [ticketDraftStorageKey])

  useEffect(() => {
    try {
      const draftPayload = {
        selectedSegment,
        selectedProducer,
        selectedLease,
        selectedMeter,
        ticketType,
        savedAt: new Date().toISOString(),
      }

      const hasDraftWork =
        selectedSegment ||
        selectedProducer ||
        selectedLease ||
        selectedMeter ||
        ticketType !== 'meter'

      if (hasDraftWork) {
        localStorage.setItem(ticketDraftStorageKey, JSON.stringify(draftPayload))
        setHasLocalTicketDraft(true)
      }
    } catch (error) {
      console.error('Autosave failed:', error)
    }
  }, [
    ticketDraftStorageKey,
    selectedSegment,
    selectedProducer,
    selectedLease,
    selectedMeter,
    ticketType,
  ])

  function restoreLocalTicketDraft() {
    try {
      const saved = localStorage.getItem(ticketDraftStorageKey)
      if (!saved) return

      const draft = JSON.parse(saved)
      setSelectedSegment(draft.selectedSegment || '')
      setSelectedProducer(draft.selectedProducer || '')
      setSelectedLease(draft.selectedLease || '')
      setSelectedMeter(draft.selectedMeter || '')
      setTicketType(draft.ticketType || 'meter')
      setDraftRestoredMessage(`Restored draft saved ${draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'earlier'}.`)
      setPage('tickets')
    } catch (error) {
      console.error('Restore draft failed:', error)
      alert('Could not restore local draft.')
    }
  }

  function clearLocalTicketDraft() {
    try {
      localStorage.removeItem(ticketDraftStorageKey)
      setHasLocalTicketDraft(false)
      setDraftRestoredMessage('')
    } catch (error) {
      console.error('Clear draft failed:', error)
    }
  }


  const workflowTickets = tickets
    .filter((ticket: any) => {
      const status = String(ticket.status || 'draft').toLowerCase()
      return !['approved', 'voided'].includes(status) && !ticket.is_superseded
    })
    .sort((a: any, b: any) =>
      new Date(b.created_at || b.updated_at || 0).getTime() -
      new Date(a.created_at || a.updated_at || 0).getTime()
    )



  const mobileHomeModules = [
    { key: 'dashboard', label: 'Dashboard', description: 'Totals and quick status' },
    { key: 'tickets', label: 'Tickets', description: 'Create, open, approve tickets' },
    { key: 'readings', label: 'Readings', description: 'Operator readings' },
    { key: 'pot', label: 'POT', description: 'Quality and S&W' },
    { key: 'provings', label: 'Provings', description: 'Meter proving records' },
    { key: 'reports', label: 'Reports', description: 'Reports Center' },
    { key: 'system_health', label: 'System Health', description: 'Setup checks' },
    ...(canViewAdmin ? [{ key: 'admin', label: 'Admin', description: 'Company setup and imports' }] : []),
    { key: 'operations', label: 'Operations', description: 'Over / short and alerts' },
  ]

  function openMobileModule(moduleKey: string) {
    setPage(moduleKey)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  async function runSystemHealthCheck() {
    setSystemHealthRunning(true)

    const checks: any[] = []
    const addCheck = (name: string, ok: boolean, detail: string, severity: 'ok' | 'warning' | 'error' = ok ? 'ok' : 'error') => {
      checks.push({ name, ok, detail, severity })
    }

    const targetCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    try {
      addCheck('Company selected', !!targetCompanyId, targetCompanyId ? `Company ID: ${targetCompanyId}` : 'No company is selected.')

      const requiredTables = [
        'companies',
        'company_settings',
        'areas',
        'segments',
        'producers',
        'leases',
        'meters',
        'readings',
        'tickets',
        'pot_quality',
        'provings',
        'tanks',
        'tank_calibration_versions',
        'tank_strapping_rows',
        'tank_deadwood_rules',
        'line_fills',
      ]

      for (const tableName of requiredTables) {
        const { error } = await supabase.from(tableName).select('*').limit(1)
        addCheck(`Table: ${tableName}`, !error, error ? error.message : 'Available')
      }

      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
      const hasLogoBucket = !!buckets?.some((bucket: any) => bucket.name === 'company-logos')
      addCheck('Storage bucket: company-logos', !bucketError && hasLogoBucket, bucketError ? bucketError.message : hasLogoBucket ? 'Available' : 'Bucket missing')

      const companySettingsOk = !!companySettings?.company_name || !!companySettings?.accent_color || !!companySettings?.logo_url
      addCheck('Company branding configured', companySettingsOk, companySettingsOk ? 'Branding row is loaded.' : 'No company branding loaded.', companySettingsOk ? 'ok' : 'warning')

      const missingMeterDirections = meters.filter((meter: any) => !meter.direction && !meter.meter_direction && !meter.meter_role)
      addCheck(
        'Meter receipt/delivery roles',
        missingMeterDirections.length === 0,
        missingMeterDirections.length === 0 ? 'All meters have role/direction fields.' : `${missingMeterDirections.length} meter(s) missing receipt/delivery role.`,
        missingMeterDirections.length === 0 ? 'ok' : 'warning'
      )

      const tanksMissingCharts = tanks.filter((tank: any) =>
        !tankCalibrationVersions.some((version: any) => version.tank_id === tank.id)
      )
      addCheck(
        'Tank strapping charts',
        tanksMissingCharts.length === 0,
        tanks.length === 0 ? 'No tanks configured yet.' : tanksMissingCharts.length === 0 ? 'All tanks have calibration versions.' : `${tanksMissingCharts.length} tank(s) missing strapping chart calibration.`,
        tanksMissingCharts.length === 0 ? 'ok' : 'warning'
      )

      const pendingTickets = tickets.filter((ticket: any) => !['approved', 'voided'].includes(String(ticket.status || 'draft').toLowerCase()))
      addCheck(
        'Pending ticket workflow',
        true,
        `${pendingTickets.length} draft/submitted ticket(s) pending.`,
        pendingTickets.length > 0 ? 'warning' : 'ok'
      )

      const approvedUnposted = tickets.filter((ticket: any) =>
        ticket.status === 'approved' && ticket.observed_inputs?.inventory_posted !== true
      )
      addCheck(
        'Inventory posting status',
        approvedUnposted.length === 0,
        approvedUnposted.length === 0 ? 'Approved tickets appear posted or inventory posting not required.' : `${approvedUnposted.length} approved ticket(s) not marked inventory_posted.`,
        approvedUnposted.length === 0 ? 'ok' : 'warning'
      )

      const flowxReady = !!flowxTransporter1 || !!flowxTransporter2 || !!flowxTransporter3 || !!flowxTransporter4
      addCheck(
        'Flow-X split setup',
        flowxReady,
        flowxReady ? 'At least one Flow-X transporter split is configured in the current form.' : 'No Flow-X transporter split is currently configured.',
        flowxReady ? 'ok' : 'warning'
      )

      setSystemHealthChecks(checks)
    } catch (error: any) {
      addCheck('System health check failed', false, error?.message || 'Unknown error')
      setSystemHealthChecks(checks)
    } finally {
      setSystemHealthRunning(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'white' }}>Loading...</div>
  if (!session) return <Login />

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          body {
            overflow-x: hidden;
          }

          .desktop-sidebar {
            display: none !important;
          }

          .mobile-home {
            display: block !important;
            padding: 14px;
          }

          .mobile-page-header {
            display: flex !important;
          }

          .app-content {
            margin-left: 0 !important;
            width: 100% !important;
            padding: 12px !important;
          }

          .responsive-grid {
            grid-template-columns: 1fr !important;
          }

          input,
          select,
          button {
            min-height: 44px;
            font-size: 16px !important;
          }

          h1 {
            font-size: 22px !important;
          }

          h2 {
            font-size: 18px !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-home {
            display: none !important;
          }

          .mobile-page-header {
            display: none !important;
          }
        }
      
        @media (max-width: 768px) {
          .desktop-sidebar,
          aside,
          nav[aria-label="sidebar"],
          [data-sidebar="true"] {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }

          .mobile-home {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 14px !important;
            margin: 0 !important;
          }

          .mobile-home button {
            width: 100% !important;
          }

          .app-content,
          main,
          .main-content {
            margin-left: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            width: 100% !important;
            max-width: 100% !important;
            transform: none !important;
          }

          body,
          #root {
            overflow-x: hidden !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
`}</style>
<style>{`
        input::placeholder { color: rgba(248,250,252,0.48); }
        select option { background: #0b1117; color: #f8fafc; }
        button:hover { filter: brightness(1.08); }
        h1, h2, h3 { color: #f8fafc; }

        @media (max-width: 900px) {
          .app-shell { flex-direction: column !important; }
          .app-sidebar {
            width: 100% !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 50 !important;
            padding: 12px !important;
          }
          .app-main { padding: 14px !important; }
          .desktop-nav { display: none !important; }
          .mobile-nav-toggle { display: block !important; }
          .mobile-nav { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
          .responsive-grid { grid-template-columns: 1fr !important; }
          button, input, select { min-height: 44px; font-size: 16px; }
          h1 { font-size: 26px !important; }
          h2 { font-size: 21px !important; }
        }

        @media (min-width: 901px) {
          .mobile-nav-toggle { display: none !important; }
          .mobile-nav { display: none !important; }
        }

      `}</style>
    <div className="app-shell" style={{
      background: 'radial-gradient(circle at top left, rgba(196,106,43,0.16), transparent 28%), #070a0d',
      color: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    }}>
      <aside className="app-sidebar" style={{
        width: 250,
        background: 'linear-gradient(180deg, #111820 0%, #070a0d 100%)',
        padding: 20,
        borderRight: `1px solid ${accentRgba(0.28)}`,
        boxShadow: '10px 0 30px rgba(0,0,0,0.35)',
      }}>
        <div style={sidebarBrandCard}>
          <div style={sidebarLogoBox}>
            {getCompanyLogoUrl() ? (
              <img
                src={getCompanyLogoUrl()}
                alt="Company Logo"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${getCompanyAccentColor()}, #7a3b18)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                {getCompanyDisplayName().slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

         <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.3 }}>
  {getCompanyDisplayName()}
          </div>
          <div style={{ fontSize: 12, color: '#a8b3bd', marginTop: 4 }}>
            Measurement Platform
          </div>
        </div>

        {['dashboard', 'admin', 'operations', 'reports', 'readings', 'pot', 'pot_map', 'provings', 'tickets'].filter((p) => p !== 'admin' || canViewAdmin).map((p) => (
          <button key={p} onClick={() => { setPage(p); setMobileNavOpen(false) }} style={button}>
            {p === 'pot_map' ? 'POT MAP' : p.toUpperCase()}
          </button>
        ))}

        <button onClick={logout} style={{ ...button, background: '#dc2626', marginTop: 30 }}>
          Logout
        </button>
      </aside>

      <main className="app-main" style={{
        flex: 1,
        padding: 30,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), #070a0d',
      }}>
        {/* Offline Warning */}
        {typeof navigator !== 'undefined' && !navigator.onLine && (
          <div style={{ ...card, border: '1px solid rgba(220,38,38,0.45)', marginBottom: 14 }}>
            <strong>Offline</strong>
            <div style={{ color: '#fecaca', fontSize: 12, marginTop: 4 }}>
              You appear to be offline. Saves may fail until connection is restored.
            </div>
          </div>
        )}

        {/* Production Hardening Saving Banner */}
        {isActionRunning && (
          <div
            style={{
              ...card,
              position: 'sticky',
              top: 10,
              zIndex: 60,
              border: `1px solid ${accentRgba(0.45)}`,
              marginBottom: 14,
            }}
          >
            <strong>{actionMessage || 'Working...'}</strong>
            <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 4 }}>
              Please wait. This prevents duplicate saves or duplicate submissions.
            </div>
          </div>
        )}

        {/* Autosave Draft Restore Banner */}
        {hasLocalTicketDraft && page !== 'tickets' && (
          <div
            style={{
              ...card,
              border: `1px solid ${accentRgba(0.45)}`,
              marginBottom: 14,
            }}
          >
            <strong>Unsaved ticket draft found</strong>
            <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 4 }}>
              A ticket draft was saved on this device.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={{ ...button, width: 'auto' }} onClick={restoreLocalTicketDraft}>
                Restore Draft
              </button>
              <button style={{ ...button, width: 'auto', background: '#374151', borderColor: '#4b5563' }} onClick={clearLocalTicketDraft}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {draftRestoredMessage && (
          <div style={{ ...card, border: '1px solid rgba(22,163,74,0.45)', marginBottom: 14 }}>
            {draftRestoredMessage}
          </div>
        )}

        {/* Company Accent Header */}
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${getCompanyAccentColor()}, rgba(196,106,43,0))`,
            marginBottom: 18,
          }}
        />

        {/* Mobile Module Home */}
        {(mobileMenuOpen || !page) && (
          <div className="mobile-home">
            <div style={{ ...box, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {getCompanyLogoUrl() ? (
                  <img src={getCompanyLogoUrl()} style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 12, background: '#fff' }} />
                ) : (
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: accentGradient(), display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 22 }}>
                    $
                  </div>
                )}
                <div>
                  <h1 style={{ margin: 0 }}>{getCompanyDisplayName()}</h1>
                  <div style={{ color: '#a8b3bd' }}>Measurement Platform</div>
                </div>
              </div>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {mobileHomeModules.map((module) => (
                <button
                  key={module.key}
                  style={{
                    ...card,
                    textAlign: 'left',
                    minHeight: 104,
                    border: `1px solid ${accentRgba(0.45)}`,
                    background: 'rgba(15, 23, 42, 0.92)',
                    color: '#fff',
                  }}
                  onClick={() => openMobileModule(module.key)}
                >
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{module.label}</div>
                  <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 6 }}>{module.description}</div>
                </button>
              ))}
            </div>

            <button style={{ ...button, background: '#dc2626', borderColor: '#ef4444', marginTop: 16 }} onClick={logout}>
              Logout
            </button>
          </div>
        )}

        {/* Mobile Page Header */}
        {!mobileMenuOpen && page && (
          <div className="mobile-page-header" style={{ display: 'none', gap: 10, alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, zIndex: 80, background: '#050b12', padding: '10px 0' }}>
            <button style={{ ...button, width: 'auto', padding: '10px 14px' }} onClick={() => setMobileMenuOpen(true)}>
              Home
            </button>
            <div style={{ fontWeight: 900, textTransform: 'uppercase' }}>{page}</div>
          </div>
        )}

        {!mobileMenuOpen && (
          <>
        {page === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            <div style={box}>
              <h2>Over / Short Summary</h2>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {getOverShortRows().slice(0, 4).map((row: any) => (
                  <div key={row.segment.id} style={card}>
                    <strong>{row.segment.name}</strong>
                    <div>Book: {row.bookInventory.toFixed(2)}</div>
                    <div>Actual: {row.actualInventory.toFixed(2)}</div>
                    <div style={{ color: Math.abs(row.overShort) > 0.01 ? '#fca5a5' : '#86efac' }}>
                      O/S: {row.overShort.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Phase 3 Dashboard KPIs */}
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Total Tickets</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Approved</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.filter((t) => t.status === 'approved').length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Draft / Working</div><div style={{ fontSize: 30, fontWeight: 900 }}>{tickets.filter((t) => !t.status || t.status === 'draft').length}</div></div>
              <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Meters</div><div style={{ fontSize: 30, fontWeight: 900 }}>{meters.length}</div></div>
            </div>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 20 }}>
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
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <div style={card}>Active Meters<h2>{activeMeters.length}</h2></div>
                <div style={card}>Proved This Month<h2>{provedThisMonthCount}</h2></div>
                <div style={card}>Remaining<h2>{remainingProvingCount}</h2></div>
                <div style={card}>Compliance<h2>{provingCompliance}%</h2></div>
              </div>
            </div>
          </>
        )}


        {page === 'admin' && !canViewAdmin && (
          <div style={box}>
            <h1>Admin</h1>

            <div style={box}>
              <h2>Transporter → POT Assignment</h2>
              <p style={{ color: '#a8b3bd' }}>
                Set which POT quality should be used for each Flow-X transporter summary ticket.
              </p>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
                <input
                  style={input}
                  placeholder="Transporter Name exactly as Flow-X shows it"
                  value={newTransporterPotName}
                  onChange={(e) => setNewTransporterPotName(e.target.value)}
                />

                <select style={input} value={newTransporterPotId} onChange={(e) => setNewTransporterPotId(e.target.value)}>
                  <option value="">Select POT Quality</option>
                  {potQuality.map((pot: any) => (
                    <option key={pot.id} value={pot.id}>
                      {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {(pot as any).bsw_percent || (pot as any).bsw || ''}
                    </option>
                  ))}
                </select>

                <button style={button} onClick={() => runSafeAction('Saving transporter POT rule', saveTransporterPotRule)}>
                  Save Rule
                </button>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {transporterPotRules.length === 0 && (
                  <div style={card}>No transporter POT rules saved yet.</div>
                )}

                {transporterPotRules.map((rule: any) => {
                  const pot = potQuality.find((item: any) => item.id === rule.pot_quality_id)

                  return (
                    <div key={rule.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <strong>{rule.transporter_name}</strong>
                        <div style={{ color: '#a8b3bd' }}>
                          POT: {pot ? ((pot as any).pot_number || (pot as any).sample_id || pot.id) : rule.pot_quality_id}
                        </div>
                      </div>
                      <button style={{ ...button, background: '#dc2626', width: 110 }} onClick={() => deleteTransporterPotRule(rule.id)}>
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>


            <p>You do not have permission to view Admin.</p>
            <button style={button} onClick={() => setPage('dashboard')}>
              Back to Dashboard
            </button>
          </div>
        )}

        {page === 'admin' && canViewAdmin && (
          <>
            <div style={adminHeaderCard}>
              <div>
                <h1 style={{ margin: 0 }}>
                  Admin <span style={{ color: getCompanyAccentColor() }}>/</span> Settings
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

            {userIsSuperAdmin && (
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
                    <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Creating company', createCompany)}>
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

                    <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Creating company admin', createCompanyAdminUser)}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                      <input
                        style={input}
                        placeholder="Accent Color"
                        value={companyAccentInput}
                        onChange={(e) => setCompanyAccentInput(e.target.value)}
                      />
                      <input
                        style={{ ...input, padding: 4, width: 58 }}
                        type="color"
                        value={companyAccentInput}
                        onChange={(e) => setCompanyAccentInput(e.target.value)}
                      />
                    </div>

                    <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Saving company branding', saveCompanySettings)}>
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
                    {userIsCompanyAdmin && ' Company admins can create operators and measurement techs for their own company only.'}
                    {userIsSuperAdmin && ' Super admins can create companies, company admins, and global super admins.'}
                  </p>

                  {userIsSuperAdmin && (
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
                      {userIsSuperAdmin && (
                        <>
                          <option value="admin">Company Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </>
                      )}
                    </select>

                    <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Creating user', createAppUser)}>
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
                      {userRoles.filter((role: any) => userIsSuperAdmin || !role.company_id || role.company_id === companyId).map((role) => (
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
                    <div style={{ ...card, gridColumn: '1 / -1' }}>
                      <h3>Import Meters CSV</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        CSV headers supported: area, segment, producer, lease, meter_number.
                      </p>
                      <input
                        style={input}
                        type="file"
                        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(e) => setMeterCsvFile(e.target.files?.[0] || null)}
                      />
                      <button
                        disabled={isActionRunning || meterCsvImporting}
                        style={button}
                        onClick={() => runSafeAction('Importing meters CSV', importMetersCsv)}
                      >
                        {meterCsvImporting ? 'Importing...' : 'Import Meters CSV'}
                      </button>
                    </div>

                    <div style={{ ...card, gridColumn: '1 / -1' }}>
                      <h3>Flow-X Truck Ticket CSV Import</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        Import Flow-X LACT truck CSV rows and split each load into up to 4 customer draft truck tickets.
                      </p>
                <div style={{ ...card, marginTop: 14 }}>
                  <h3>Transporter → POT Assignment</h3>
                  <p style={{ color: '#a8b3bd' }}>
                    Assign Flow-X transporter names to POT quality records. These rules apply to generated transporter summary tickets.
                  </p>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
                    <input
                      style={input}
                      placeholder="Transporter Name exactly as Flow-X shows it"
                      value={newTransporterPotName}
                      onChange={(e) => setNewTransporterPotName(e.target.value)}
                    />

                    <select style={input} value={newTransporterPotId} onChange={(e) => setNewTransporterPotId(e.target.value)}>
                      <option value="">Select POT Quality</option>
                      {potQuality.map((pot: any) => (
                        <option key={pot.id} value={pot.id}>
                          {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {(pot as any).bsw_percent || (pot as any).bsw || ''}
                        </option>
                      ))}
                    </select>

                    <button style={button} onClick={() => runSafeAction('Saving transporter POT rule', saveTransporterPotRule)}>
                      Save Rule
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {transporterPotRules.length === 0 && (
                      <div style={{ color: '#a8b3bd' }}>No transporter POT rules saved yet.</div>
                    )}

                    {transporterPotRules.map((rule: any) => {
                      const pot = potQuality.find((item: any) => item.id === rule.pot_quality_id)

                      return (
                        <div key={rule.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <strong>{rule.transporter_name}</strong>
                            <div style={{ color: '#a8b3bd' }}>
                              POT: {pot ? ((pot as any).pot_number || (pot as any).sample_id || pot.id) : rule.pot_quality_id}
                            </div>
                          </div>
                          <button style={{ ...button, background: '#dc2626', width: 110 }} onClick={() => deleteTransporterPotRule(rule.id)}>
                            Delete
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>


                      <input style={input} placeholder="LACT Name" value={flowxLactName} onChange={(e) => setFlowxLactName(e.target.value)} />

                      <select style={input} value={flowxDefaultSegmentId} onChange={(e) => setFlowxDefaultSegmentId(e.target.value)}>
                        <option value="">Default Segment</option>
                        {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                      </select>

                      <div style={card}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={flowxManualSplitOverride}
                      onChange={(e) => setFlowxManualSplitOverride(e.target.checked)}
                    />
                    Manual transporter split override
                  </label>

                  {!flowxManualSplitOverride && (
                    <div style={{ marginTop: 10 }}>
                      <h3>Auto Transporter Allocation</h3>
                      {flowxAutoSplits.length === 0 ? (
                        <div style={{ color: '#a8b3bd' }}>
                          Upload and map a CSV with Transporter and NSV/GSV columns to calculate allocations.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 6 }}>Transporter</th>
                                <th style={{ textAlign: 'right', borderBottom: '1px solid #374151', padding: 6 }}>NSV Total</th>
                                <th style={{ textAlign: 'right', borderBottom: '1px solid #374151', padding: 6 }}>Split %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {flowxAutoSplits.map((split: any) => (
                                <tr key={split.transporter}>
                                  <td style={{ borderBottom: '1px solid #1f2937', padding: 6 }}>{split.transporter}</td>
                                  <td style={{ textAlign: 'right', borderBottom: '1px solid #1f2937', padding: 6 }}>{split.totalNsv.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', borderBottom: '1px solid #1f2937', padding: 6 }}>{split.percent.toFixed(4)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {flowxManualSplitOverride && (
                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginTop: 12 }}>
                      <input style={input} placeholder="Transporter 1" value={flowxCustomer1} onChange={(e) => setFlowxCustomer1(e.target.value)} />
                      <input style={input} placeholder="% 1" value={flowxPercent1} onChange={(e) => setFlowxPercent1(e.target.value)} />
                      <input style={input} placeholder="Transporter 2" value={flowxCustomer2} onChange={(e) => setFlowxCustomer2(e.target.value)} />
                      <input style={input} placeholder="% 2" value={flowxPercent2} onChange={(e) => setFlowxPercent2(e.target.value)} />
                      <input style={input} placeholder="Transporter 3" value={flowxCustomer3} onChange={(e) => setFlowxCustomer3(e.target.value)} />
                      <input style={input} placeholder="% 3" value={flowxPercent3} onChange={(e) => setFlowxPercent3(e.target.value)} />
                      <input style={input} placeholder="Transporter 4" value={flowxCustomer4} onChange={(e) => setFlowxCustomer4(e.target.value)} />
                      <input style={input} placeholder="% 4" value={flowxPercent4} onChange={(e) => setFlowxPercent4(e.target.value)} />
                    </div>
                  )}
                </div>

                      <input style={input} type="file" accept=".csv,text/csv" onChange={(e) => setFlowxCsvFile(e.target.files?.[0] || null)} />

                      <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Importing transporter summary tickets', importFlowXTransporterSummaryTickets)}>
                        Import Transporter Summary Tickets
                      </button>
                    </div>

                    <div style={{ ...card, gridColumn: '1 / -1' }}>
                      <h3>Tank / Line Fill Setup</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        Tanks and line fills are company-specific assets. Strapping charts are uploaded per tank as calibration versions.
                      </p>

                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={card}>
                          <h4>Create Tank</h4>
                          <input style={input} placeholder="Tank Number" value={newTankNumber} onChange={(e) => setNewTankNumber(e.target.value)} />
                          <input style={input} placeholder="Tank Name" value={newTankName} onChange={(e) => setNewTankName(e.target.value)} />
                          <select style={input} value={newTankSegmentId} onChange={(e) => setNewTankSegmentId(e.target.value)}>
                            <option value="">Select Segment</option>
                            {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                          </select>
                          <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Creating tank', createTankAsset)}>Create Tank</button>
                        </div>

                        <div style={card}>
                          <h4>Create Line Fill</h4>
                          <input style={input} placeholder="Line Fill Name" value={newLineFillName} onChange={(e) => setNewLineFillName(e.target.value)} />
                          <input style={input} placeholder="Capacity BBLS" value={newLineFillCapacity} onChange={(e) => setNewLineFillCapacity(e.target.value)} />
                          <select style={input} value={newLineFillSegmentId} onChange={(e) => setNewLineFillSegmentId(e.target.value)}>
                            <option value="">Select Segment</option>
                            {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                          </select>
                          <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Creating line fill', createLineFillAsset)}>Create Line Fill</button>
                        </div>
                      </div>

                      <div style={card}>
                        <h4>Upload Tank Strapping Chart CSV/XLSX</h4>
                        <p style={{ color: '#a8b3bd' }}>
                          CSV headers supported: gauge_decimal, gauge_feet, gauge_inches, gauge_fraction, barrels, increment_bbl, notes. XLSX refinery strapping tables with FT-IN/Barrels pairs are detected automatically.
                        </p>
                        <select style={input} value={selectedStrappingTankId} onChange={(e) => setSelectedStrappingTankId(e.target.value)}>
                          <option value="">Select Tank</option>
                          {tanks.map((tank: any) => <option key={tank.id} value={tank.id}>{tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}</option>)}
                        </select>
                        <input style={input} type="file" accept=".csv,text/csv" onChange={(e) => setStrappingCsvFile(e.target.files?.[0] || null)} />
                        <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Importing strapping chart', importTankStrappingCsv)}>
                          Import Strapping Chart
                        </button>
                      </div>

                      <div style={card}>
                        <h4>Deadwood / Tank Adjustment Rules</h4>
                        <p style={{ color: '#a8b3bd' }}>
                          Add or subtract barrels by gauge range. These rules are applied automatically on tank tickets.
                        </p>

                        <select style={input} value={deadwoodTankId} onChange={(e) => setDeadwoodTankId(e.target.value)}>
                          <option value="">Select Tank</option>
                          {tanks.map((tank: any) => (
                            <option key={tank.id} value={tank.id}>
                              {tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}
                            </option>
                          ))}
                        </select>

                        {deadwoodTankId && (
                          <div style={{ color: '#a8b3bd', fontSize: 12, marginBottom: 8 }}>
                            Active Calibration: {getActiveTankCalibration(deadwoodTankId)?.name || getActiveTankCalibration(deadwoodTankId)?.version_number || 'None'}
                          </div>
                        )}

                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <input style={input} placeholder="Start Gauge" value={deadwoodStartGauge} onChange={(e) => setDeadwoodStartGauge(e.target.value)} />
                          <input style={input} placeholder="End Gauge" value={deadwoodEndGauge} onChange={(e) => setDeadwoodEndGauge(e.target.value)} />
                        </div>

                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <input style={input} placeholder="Adjustment BBLS" value={deadwoodAdjustmentBbl} onChange={(e) => setDeadwoodAdjustmentBbl(e.target.value)} />
                          <select style={input} value={deadwoodAdjustmentType} onChange={(e) => setDeadwoodAdjustmentType(e.target.value)}>
                            <option value="add">Add Barrels</option>
                            <option value="subtract">Subtract Barrels</option>
                          </select>
                        </div>

                        <input style={input} placeholder="Description / Rule Note" value={deadwoodDescription} onChange={(e) => setDeadwoodDescription(e.target.value)} />

                        <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Saving deadwood rule', saveDeadwoodRule)}>
                          Save Deadwood Rule
                        </button>

                        {deadwoodTankId && (
                          <div style={{ marginTop: 14 }}>
                            <h4>Active Rules</h4>
                            {tankDeadwoodRules
                              .filter((rule: any) => rule.tank_id === deadwoodTankId)
                              .map((rule: any) => (
                                <div key={rule.id} style={card}>
                                  <strong>{rule.adjustment_type === 'subtract' ? 'Subtract' : 'Add'} {rule.adjustment_bbl} bbl</strong>
                                  <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                                    Gauge {rule.start_gauge} to {rule.end_gauge}
                                  </div>
                                  {rule.description && <div>{rule.description}</div>}
                                  <button
                                    disabled={isActionRunning}
                                    style={{ ...button, background: '#991b1b', borderColor: '#ef4444' }}
                                    onClick={() => runSafeAction('Disabling deadwood rule', () => deleteDeadwoodRule(rule.id))}
                                  >
                                    Disable Rule
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
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

        
        {page === 'pot_map' && (
          <>
            <h1>Transporter → POT Assignment</h1>

            <div style={box}>
              <h2>Assign Transporter to POT</h2>
              <p style={{ color: '#a8b3bd' }}>
                Set which POT quality record should be used when Flow-X transporter summary tickets are generated.
              </p>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
                <input
                  style={input}
                  placeholder="Transporter Name exactly as Flow-X shows it"
                  value={newTransporterPotName}
                  onChange={(e) => setNewTransporterPotName(e.target.value)}
                />

                <select style={input} value={newTransporterPotId} onChange={(e) => setNewTransporterPotId(e.target.value)}>
                  <option value="">Select POT Quality</option>
                  {potQuality.map((pot: any) => (
                    <option key={pot.id} value={pot.id}>
                      {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {(pot as any).bsw_percent || (pot as any).bsw || ''}
                    </option>
                  ))}
                </select>

                <button style={button} onClick={() => runSafeAction('Saving transporter POT rule', saveTransporterPotRule)}>
                  Save Rule
                </button>
              </div>
            </div>

            <div style={box}>
              <h2>Saved Rules</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {transporterPotRules.length === 0 && (
                  <div style={card}>No transporter POT rules saved yet.</div>
                )}

                {transporterPotRules.map((rule: any) => {
                  const pot = potQuality.find((item: any) => item.id === rule.pot_quality_id)

                  return (
                    <div key={rule.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <strong>{rule.transporter_name}</strong>
                        <div style={{ color: '#a8b3bd' }}>
                          POT: {pot ? ((pot as any).pot_number || (pot as any).sample_id || pot.id) : rule.pot_quality_id}
                        </div>
                      </div>
                      <button style={{ ...button, background: '#dc2626', width: 110 }} onClick={() => deleteTransporterPotRule(rule.id)}>
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {page === 'pot' && (
          <>
            <h1>POT Quality</h1>
            <div style={box}>
              <h3>POT Workings CSV Export</h3>
              <p style={{ color: '#a8b3bd' }}>
                Export POT workings into the GQ liquid import header CSV layout.
              </p>
              <select style={input} value={potCsvProducerId} onChange={(e) => setPotCsvProducerId(e.target.value)}>
                <option value="">All Producers</option>
                {producers.map((producer) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
              </select>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input style={input} type="date" value={potCsvStartDate} onChange={(e) => setPotCsvStartDate(e.target.value)} />
                <input style={input} type="date" value={potCsvEndDate} onChange={(e) => setPotCsvEndDate(e.target.value)} />
              </div>
              <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Exporting POT workings CSV', exportPotWorkingsCsv)}>
                Export POT Workings CSV
              </button>
            </div>
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
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 20 }}>
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

        {page === 'operations' && (
          <>
            <h1>Operations Intelligence</h1>

            {/* Phase 24 Inventory / Over-Short */}
            <div style={box}>
              <h2>Segment-Based Over / Short Detail Engine</h2>
              <p style={{ color: '#a8b3bd' }}>
                Approved tickets only. Uses meter receipt/delivery role, tank movements, truck tickets, and latest tank inventory.
              </p>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <input style={input} type="date" value={overShortStartDate} onChange={(e) => setOverShortStartDate(e.target.value)} />
                <input style={input} type="date" value={overShortEndDate} onChange={(e) => setOverShortEndDate(e.target.value)} />
                <select style={input} value={overShortSegmentId} onChange={(e) => setOverShortSegmentId(e.target.value)}>
                  <option value="">All Segments</option>
                  {segments.map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.name}</option>
                  ))}
                </select>
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button style={button} onClick={exportOverShortCsv}>
                  Export CSV
                </button>
                <button style={button} onClick={exportOverShortExcel}>
                  Export Excel Spreadsheet
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {getOverShortRows().map((row: any) => (
                  <div key={row.segment.id} style={card}>
                    <h3>{row.segment.name}</h3>
                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      <div>Receipts: <strong>{row.receipts.toFixed(2)}</strong></div>
                      <div>Deliveries: <strong>{row.deliveries.toFixed(2)}</strong></div>
                      <div>Truck Tickets: <strong>{row.truckTickets.toFixed(2)}</strong></div>
                      <div>Tank Change: <strong>{row.tankChange.toFixed(2)}</strong></div>
                      <div>Line Fill: <strong>{row.lineFillChange.toFixed(2)}</strong></div>
                      <div>Book Inv: <strong>{row.bookInventory.toFixed(2)}</strong></div>
                      <div>Actual Inv: <strong>{row.actualInventory.toFixed(2)}</strong></div>
                      <div>O/S: <strong style={{ color: Math.abs(row.overShort) > 0.01 ? '#fca5a5' : '#86efac' }}>{row.overShort.toFixed(2)}</strong></div>
                      <div>O/S %: <strong>{row.overShortPercent.toFixed(4)}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ color: '#a8b3bd' }}>
                Uses approved tickets, meter receipt/delivery roles, tank movements, and truck tickets to calculate segment balance.
              </p>

              <div style={{ display: 'grid', gap: 10 }}>
                {getSegmentInventoryRows().map((row: any) => (
                  <div key={row.segment.id} style={card}>
                    <strong>{row.segment.name}</strong>
                    <div>Receipts: {row.receiptVolume.toFixed(2)}</div>
                    <div>Deliveries: {row.deliveryVolume.toFixed(2)}</div>
                    <div>Tank Movement: {row.tankMovement.toFixed(2)}</div>
                    <div>Truck Tickets: {row.truckVolume.toFixed(2)}</div>
                    <div><strong>Over / Short: {row.overShort.toFixed(2)}</strong></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={kpiCard}>
                <div style={{ color: '#a8b3bd', fontSize: 13 }}>Proving Compliance</div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>{opsProvingCompliancePercent}%</div>
                <div style={{ color: '#a8b3bd', fontSize: 12 }}>{opsCompliantMeters.length} of {meters.length} meters</div>
              </div>

              <div style={kpiCard}>
                <div style={{ color: '#a8b3bd', fontSize: 13 }}>Overdue Proving</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: opsOverdueMeters.length ? '#fecaca' : '#bbf7d0' }}>{opsOverdueMeters.length}</div>
                <div style={{ color: '#a8b3bd', fontSize: 12 }}>Needs attention</div>
              </div>

              <div style={kpiCard}>
                <div style={{ color: '#a8b3bd', fontSize: 13 }}>Due Soon</div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>{opsDueSoonMeters.length}</div>
                <div style={{ color: '#a8b3bd', fontSize: 12 }}>Within 7 days</div>
              </div>

              <div style={kpiCard}>
                <div style={{ color: '#a8b3bd', fontSize: 13 }}>Stale Readings</div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>{staleReadingMeters.length}</div>
                <div style={{ color: '#a8b3bd', fontSize: 12 }}>No recent reading</div>
              </div>
            </div>

            <div style={box}>
              <h2>Proving Watchlist</h2>
              <p style={{ color: '#a8b3bd' }}>
                Meters are flagged overdue when no proving exists or the latest proving age exceeds the meter proving frequency.
              </p>

              {opsOverdueMeters.length === 0 && (
                <div style={card}>No overdue provings found.</div>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {(opsOverdueMeters as any[]).slice(0, 20).map((item: any) => (
                  <div
                    key={(item as any).meter.id}
                    style={{
                      ...card,
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 140px auto',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>{(item as any).meter.meter_number || (item as any).meter.name || (item as any).meter.id}</strong>
                      <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                        Last proving: {(item as any).provingDate || 'None'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#a8b3bd', fontSize: 12 }}>Age</div>
                      <strong>{(item as any).provingAgeDays === null ? 'None' : `${(item as any).provingAgeDays} days`}</strong>
                    </div>

                    <div>
                      <div style={{ color: '#a8b3bd', fontSize: 12 }}>Frequency</div>
                      <strong>{(item as any).provingFrequencyDays} days</strong>
                    </div>

                    <button style={button} onClick={() => setPage('provings')}>
                      Open Provings
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={box}>
                <h2>Due Soon</h2>
                {opsDueSoonMeters.length === 0 && <div style={card}>Nothing due soon.</div>}
                {(opsDueSoonMeters as any[]).slice(0, 10).map((item: any) => (
                  <div key={(item as any).meter.id} style={card}>
                    <strong>{(item as any).meter.meter_number || (item as any).meter.name || (item as any).meter.id}</strong>
                    <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                      Last proving: {(item as any).provingDate || 'None'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={box}>
                <h2>Reading Freshness</h2>
                {staleReadingMeters.length === 0 && <div style={card}>All meters have recent readings.</div>}
                {(staleReadingMeters as any[]).slice(0, 10).map((item: any) => (
                  <div key={(item as any).meter.id} style={card}>
                    <strong>{(item as any).meter.meter_number || (item as any).meter.name || (item as any).meter.id}</strong>
                    <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                      Last reading: {(item as any).readingDate || 'None'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
                      <div style={box}>
              <h2>Segment Over / Short</h2>
              <p style={{ color: '#a8b3bd' }}>
                Early over/short model: approved receipt meters minus delivery meters plus tank/line-fill movements. This becomes more accurate as meter directions, tank assets, and line fills are configured.
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {segments.map((segment: any) => {
                  const segmentTickets = tickets.filter((ticket: any) => ticket.segment_id === segment.id && ticket.status === 'approved')
                  const receipts = segmentTickets
                    .filter((ticket: any) => {
                      const meter = meters.find((m: any) => m.id === ticket.meter_id)
                      return (meter as any)?.direction === 'receipt'
                    })
                    .reduce((sum: number, ticket: any) => sum + Number(selectedTicket!.calculation_results?.nsv || selectedTicket!.calculation_results?.gsv || 0), 0)
                  const deliveries = segmentTickets
                    .filter((ticket: any) => {
                      const meter = meters.find((m: any) => m.id === ticket.meter_id)
                      return (meter as any)?.direction === 'delivery'
                    })
                    .reduce((sum: number, ticket: any) => sum + Number(selectedTicket!.calculation_results?.nsv || selectedTicket!.calculation_results?.gsv || 0), 0)
                  const tankMovements = segmentTickets
                    .filter((ticket: any) => ticket.ticket_type === 'tank')
                    .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.tank_movement_bbl || 0), 0)
                  const overShort = receipts - deliveries + tankMovements

                  return (
                    <div key={segment.id} style={card}>
                      <strong>{segment.name}</strong>
                      <div>Receipts: {receipts.toFixed(2)}</div>
                      <div>Deliveries: {deliveries.toFixed(2)}</div>
                      <div>Tank Movement: {tankMovements.toFixed(2)}</div>
                      <div><strong>Over / Short: {overShort.toFixed(2)}</strong></div>
                    </div>
                  )
                })}
              </div>
            </div>

</>
        )}

        {page === 'system_health' && (
          <>
            <h1>System Health</h1>

            <div style={box}>
              <h2>Setup Validation</h2>
              <p style={{ color: '#a8b3bd' }}>
                Checks Supabase tables, storage, company branding, meter roles, tank charts, pending tickets, inventory posting, and Flow-X setup.
              </p>

              <button style={button} disabled={systemHealthRunning} onClick={runSystemHealthCheck}>
                {systemHealthRunning ? 'Running Checks...' : 'Run System Health Check'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {systemHealthChecks.length === 0 && (
                <div style={card}>
                  No checks have been run yet.
                </div>
              )}

              {systemHealthChecks.map((check: any, index: number) => (
                <div
                  key={`${check.name}-${index}`}
                  style={{
                    ...card,
                    borderColor: check.severity === 'error' ? '#ef4444' : check.severity === 'warning' ? '#f59e0b' : '#22c55e',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{check.name}</strong>
                    <span>
                      {check.severity === 'error' ? '❌' : check.severity === 'warning' ? '⚠️' : '✅'}
                    </span>
                  </div>
                  <div style={{ color: '#a8b3bd', marginTop: 6 }}>
                    {check.detail}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'reports' && (
          <>
            <h1>Reports Center</h1>

            <div style={box}>
              <h2>Report Filters</h2>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <input style={input} type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                <input style={input} type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />

                <select style={input} value={reportProducerId} onChange={(e) => setReportProducerId(e.target.value)}>
                  <option value="">All Producers</option>
                  {producers.map((producer: any) => (
                    <option key={producer.id} value={producer.id}>{producer.name}</option>
                  ))}
                </select>

                <select style={input} value={reportSegmentId} onChange={(e) => setReportSegmentId(e.target.value)}>
                  <option value="">All Segments</option>
                  {segments.map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
              {[
                ['tickets', 'Custody Tickets'],
                ['tank', 'Tank Tickets'],
                ['pot', 'POT Exports'],
                ['flowx', 'Flow-X Imports'],
                ['over_short', 'Over & Short'],
                ['inventory', 'Inventory Balances'],
                ['daily', 'Daily Reports'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    ...button,
                    background: reportCenterSection === key ? accentGradient() : '#1f2937',
                    borderColor: reportCenterSection === key ? accentRgba(0.75) : '#374151',
                  }}
                  onClick={() => setReportCenterSection(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {reportCenterSection === 'tickets' && (
              <div style={box}>
                <h2>Custody Transfer Tickets</h2>
                <p style={{ color: '#a8b3bd' }}>Export meter/custody tickets by date, producer, and segment.</p>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <button style={button} onClick={() => exportReportTicketsCsv('meter')}>Export Meter CSV</button>
                  <button style={button} onClick={() => exportReportTicketsExcel('meter')}>Export Meter Excel</button>
                  <button style={button} onClick={() => runSafeAction('Exporting producer PDF bundle', exportProducerPdfBundle)}>Producer PDF Bundle</button>
                </div>
                <div style={card}>Matching Tickets: {getReportFilteredTickets('meter').length}</div>
              </div>
            )}

            {reportCenterSection === 'tank' && (
              <div style={box}>
                <h2>Tank Tickets</h2>
                <p style={{ color: '#a8b3bd' }}>Tank ticket exports with opening/closing gauge, GOV, GSV, NSV, and corrections.</p>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button style={button} onClick={() => exportReportTicketsCsv('tank')}>Export Tank CSV</button>
                  <button style={button} onClick={() => exportReportTicketsExcel('tank')}>Export Tank Excel</button>
                </div>
                <div style={card}>Matching Tank Tickets: {getReportFilteredTickets('tank').length}</div>
              </div>
            )}

            {reportCenterSection === 'pot' && (
              <div style={box}>
                <h2>POT Exports</h2>
                <p style={{ color: '#a8b3bd' }}>GQ liquid import format and POT quality exports.</p>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <input style={input} type="date" value={potCsvStartDate} onChange={(e) => setPotCsvStartDate(e.target.value)} />
                  <input style={input} type="date" value={potCsvEndDate} onChange={(e) => setPotCsvEndDate(e.target.value)} />
                  <select style={input} value={potCsvProducerId} onChange={(e) => setPotCsvProducerId(e.target.value)}>
                    <option value="">All Producers</option>
                    {producers.map((producer: any) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
                  </select>
                </div>
                <button style={button} onClick={() => runSafeAction('Exporting POT workings CSV', exportPotWorkingsCsv)}>
                  Export GQ POT CSV
                </button>
              </div>
            )}

            {reportCenterSection === 'flowx' && (
              <div style={box}>
                <h2>Flow-X Mapping Import</h2>
                <p style={{ color: '#a8b3bd' }}>
                  Upload a Flow-X CSV, map the columns, set up to 4 transporter splits, and generate draft truck tickets.
                </p>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input style={input} placeholder="LACT Name" value={flowxLactName} onChange={(e) => setFlowxLactName(e.target.value)} />
                  <select style={input} value={flowxDefaultSegmentId} onChange={(e) => setFlowxDefaultSegmentId(e.target.value)}>
                    <option value="">Default Segment</option>
                    {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                  </select>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                  <input style={input} placeholder="Transporter 1" value={flowxTransporter1} onChange={(e) => setFlowxTransporter1(e.target.value)} />
                  <input style={input} placeholder="% 1" value={flowxPercent1} onChange={(e) => setFlowxPercent1(e.target.value)} />
                  <input style={input} placeholder="Transporter 2" value={flowxTransporter2} onChange={(e) => setFlowxTransporter2(e.target.value)} />
                  <input style={input} placeholder="% 2" value={flowxPercent2} onChange={(e) => setFlowxPercent2(e.target.value)} />
                  <input style={input} placeholder="Transporter 3" value={flowxTransporter3} onChange={(e) => setFlowxTransporter3(e.target.value)} />
                  <input style={input} placeholder="% 3" value={flowxPercent3} onChange={(e) => setFlowxPercent3(e.target.value)} />
                  <input style={input} placeholder="Transporter 4" value={flowxTransporter4} onChange={(e) => setFlowxTransporter4(e.target.value)} />
                  <input style={input} placeholder="% 4" value={flowxPercent4} onChange={(e) => setFlowxPercent4(e.target.value)} />
                </div>

                <input
                  style={input}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setFlowxCsvFile(file)
                    if (file) previewFlowXCsv(file)
                  }}
                />

                {flowxMappingHeaders.length > 0 && (
                  <div style={card}>
                    <h3>Column Mapping</h3>
                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      {[
                        ['ticket_number', 'Ticket Number'],
                        ['batch_number', 'Batch Number'],
                        ['truck_number', 'Truck Number'],
                        ['driver_name', 'Driver Name'],
                        ['producer_name', 'Producer'],
                        ['transporter_name', 'Transporter'],
                        ['customer_name', 'Customer'],
                        ['lease_name', 'Lease'],
                        ['meter_number', 'Meter Number'],
                        ['segment_name', 'Segment'],
                        ['gross_volume_bbl', 'Gross Volume'],
                        ['net_volume_bbl', 'Net Volume'],
                        ['api_gravity', 'API Gravity'],
                        ['observed_temperature', 'Observed Temp'],
                        ['bsw_percent', 'BSW / S&W %'],
                        ['open_datetime', 'Open Date/Time'],
                        ['close_datetime', 'Close Date/Time'],
                      ].map(([field, label]) => (
                        <label key={field} style={{ display: 'grid', gap: 4 }}>
                          <span>{label}</span>
                          <select style={input} value={flowxColumnMap[field] || ''} onChange={(e) => { updateFlowXColumnMap(field, e.target.value); setTimeout(() => refreshFlowXAutoSplits(flowxMappingRows), 0) }}>
                            <option value="">Not mapped</option>
                            {flowxMappingHeaders.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {flowxMappingRows.length > 0 && (
                  <div style={card}>
                    <h3>Preview First 10 Rows</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {flowxMappingHeaders.slice(0, 8).map((header) => (
                              <th key={header} style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 6 }}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {flowxMappingRows.map((row: any, index: number) => (
                            <tr key={index}>
                              {flowxMappingHeaders.slice(0, 8).map((header) => (
                                <td key={header} style={{ borderBottom: '1px solid #1f2937', padding: 6 }}>{row[header]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Importing transporter summary tickets', importFlowXTransporterSummaryTickets)}>
                  Generate Transporter Summary Tickets
                </button>
              </div>
            )}

            {reportCenterSection === 'over_short' && (
              <div style={box}>
                <h2>Over & Short</h2>
                <p style={{ color: '#a8b3bd' }}>Segment-based inventory balance export.</p>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <input style={input} type="date" value={overShortStartDate} onChange={(e) => setOverShortStartDate(e.target.value)} />
                  <input style={input} type="date" value={overShortEndDate} onChange={(e) => setOverShortEndDate(e.target.value)} />
                  <select style={input} value={overShortSegmentId} onChange={(e) => setOverShortSegmentId(e.target.value)}>
                    <option value="">All Segments</option>
                    {segments.map((segment: any) => (
                      <option key={segment.id} value={segment.id}>{segment.name}</option>
                    ))}
                  </select>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button style={button} onClick={exportOverShortCsv}>Export O/S CSV</button>
                  <button style={button} onClick={exportOverShortExcel}>Export O/S Excel</button>
                </div>
              </div>
            )}

            {reportCenterSection === 'inventory' && (
              <div style={box}>
                <h2>Inventory Balances</h2>
                <p style={{ color: '#a8b3bd' }}>Inventory roll-forward and segment balance report foundation.</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {getOverShortRows().map((row: any) => (
                    <div key={row.segment.id} style={card}>
                      <strong>{row.segment.name}</strong>
                      <div>Book Inventory: {row.bookInventory.toFixed(2)}</div>
                      <div>Actual Inventory: {row.actualInventory.toFixed(2)}</div>
                      <div>Over / Short: {row.overShort.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportCenterSection === 'daily' && (
              <div style={box}>
                <h2>Daily Reports</h2>
                <p style={{ color: '#a8b3bd' }}>
                  Daily balance exports will use the same segment inventory engine. Next phase will add save-to-database daily balance snapshots.
                </p>
              </div>
            )}
          </>
        )}

        {page === 'tickets' && (
          <>
            <h1>Ticket Workflow</h1>

            {/* Ticket Debug Counts */}
            <div style={{ ...card, marginBottom: 12 }}>
              Total tickets loaded: {tickets.length} • Pending workflow tickets: {workflowTickets.length}<br /><button style={{ ...button, width: 'auto', marginTop: 8 }} onClick={loadAll}>Force Refresh Tickets</button>
            </div>

            {/* All Pending Ticket Approval Queue */}
            <div style={box}>
              <h2>Workflow Queue ({workflowTickets.length})</h2>
              {workflowTickets.length === 0 && (
                <div style={card}>
                  No draft or submitted tickets are waiting for approval.
                </div>
              )}

              {/* All Loaded Tickets Fallback */}
              {workflowTickets.length === 0 && tickets.length > 0 && (
                <div style={card}>
                  <strong>Loaded tickets exist, but none are pending.</strong>
                  <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                    This means they may already be approved/voided or status is not draft/submitted.
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {workflowTickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    style={{
                      ...card,
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>{ticket.ticket_number || ticket.id}</strong>
                      <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                        Type: {ticket.ticket_type || 'meter'} • Status: {ticket.status || 'draft'}
                      </div>
                      {ticket.ticket_type === 'tank' && (
                        <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                          Tank: {tanks.find((tank: any) => tank.id === ticket.tank_id)?.tank_number || ticket.tank_id || 'None'}
                        </div>
                      )}
                    </div>

                    <span style={getTicketStatusStyle(ticket.status)}>{ticket.status || 'draft'}</span>

                    <button
                      disabled={isActionRunning}
                      style={button}
                      onClick={() => { setSelectedTicket(ticket); setPage('tickets') }}
                    >
                      Open Ticket
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Selected Ticket Quick View */}
            {selectedTicket && (
              <div style={box}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>Open Ticket: {selectedTicket!.ticket_number || selectedTicket!.id}</h2>
                  <span style={getTicketStatusStyle(selectedTicket!.status)}>{selectedTicket!.status || 'draft'}</span>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
                  <div style={card}>
                    <h3>Ticket Info</h3>
                    <div>Type: {selectedTicket!.ticket_type}</div>
                    <div>Producer ID: {selectedTicket!.producer_id || 'None'}</div>
                    <div>Meter ID: {selectedTicket!.meter_id || 'None'}</div>
                    <div>Segment ID: {selectedTicket!.segment_id || 'None'}</div>
                  </div>

                  <div style={card}>
                    <h3>Volumes</h3>
                    {selectedTicket!.ticket_type === 'tank' && (
                      <>
                        <div><strong>Tank Results</strong></div>
                        <div>Opening Gauge: {(selectedTicket as any).opening_gauge ?? selectedTicket!.observed_inputs?.opening_gauge ?? 'None'}</div>
                        <div>Closing Gauge: {(selectedTicket as any).closing_gauge ?? selectedTicket!.observed_inputs?.closing_gauge ?? 'None'}</div>
                        <div>GOV: {selectedTicket!.calculation_results?.tank_gov ?? selectedTicket!.calculation_results?.tank_movement_bbl ?? 'None'}</div>
                      </>
                    )}
                    <div>GSV: {selectedTicket!.calculation_results?.gsv ?? 'None'}</div>
                    <div>NSV: {selectedTicket!.calculation_results?.nsv ?? 'None'}</div>
                    <div>CCF: {selectedTicket!.calculation_results?.ccf ?? 'None'}</div>
                  </div>

                  <div style={card}>
                    <h3>Inputs</h3>
                    <div>IV: {selectedTicket!.observed_inputs?.iv ?? 'None'}</div>
                    <div>CTL: {selectedTicket!.observed_inputs?.ctl ?? 'None'}</div>
                    <div>CPL: {selectedTicket!.observed_inputs?.cpl ?? 'None'}</div>
                    <div>API @ 60: {selectedTicket!.observed_inputs?.api_gravity_60 ?? selectedTicket!.observed_inputs?.corrected_api ?? 'None'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
                  <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Submitting ticket', () => updateTicketStatus(selectedTicket, 'submitted'))}>Submit</button>
                  <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Approving ticket', () => updateTicketStatus(selectedTicket, 'approved'))}>Approve Tank/Draft Ticket</button>
                  <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Generating PDF preview', () => generatePdfPreview(selectedTicket))}>PDF Preview</button>
                  <button style={{ ...button, background: '#374151', borderColor: '#4b5563' }} onClick={() => setSelectedTicket(null)}>Close</button>
                </div>
              </div>
            )}
            {hasLocalTicketDraft && (
              <div style={card}>
                <strong>Autosave is active</strong>
                <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 4 }}>
                  Draft selections are being saved on this device.
                </div>
                <button style={{ ...button, width: 'auto' }} onClick={clearLocalTicketDraft}>
                  Clear Autosaved Draft
                </button>
              </div>
            )}
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
                <option value="line_fill">Line Fill Ticket</option>
                <option value="transfer">Transfer Ticket</option>
                <option value="truck">Truck Ticket</option>
              </select>

              {(ticketType === 'tank' || ticketType === 'transfer') && (
                <div style={card}>
                  <h3>Tank Ticket Inputs</h3>
                  <select style={input} value={selectedTank} onChange={(e) => setSelectedTank(e.target.value)}>
                    <option value="">Select Tank</option>
                    {tanks
                      .filter((tank: any) => !selectedSegment || tank.segment_id === selectedSegment)
                      .map((tank: any) => (
                        <option key={tank.id} value={tank.id}>
                          {tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}
                        </option>
                      ))}
                  </select>

                  <select style={input} value={tankMovementDirection} onChange={(e) => setTankMovementDirection(e.target.value)}>
                    <option value="delivery">Delivery / Drawdown</option>
                    <option value="receipt">Receipt / Fill</option>
                  </select>

                  <div style={card}>
                    <strong>Opening Gauge Auto-Fill</strong>
                    <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                      Opening comes from the last approved tank ticket closing gauge when available.
                    </div>
                    <div>
                      Opening Decimal: {selectedTank ? getPreviousTankClosingGauge(selectedTank) || openingGauge || 'None' : 'Select tank'}
                    </div>
                    <input
                      style={input}
                      placeholder="Manual Opening Gauge Override (decimal feet)"
                      value={openingGauge}
                      onChange={(e) => setOpeningGauge(e.target.value)}
                    />
                  </div>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <input style={input} placeholder="Closing Feet" value={tankClosingFeet} onChange={(e) => setTankClosingFeet(e.target.value)} />
                    <input style={input} placeholder="Closing Inches" value={tankClosingInches} onChange={(e) => setTankClosingInches(e.target.value)} />
                    <input style={input} placeholder="Closing 8ths" value={tankClosingEighths} onChange={(e) => setTankClosingEighths(e.target.value)} />
                  </div>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <input style={input} placeholder="Average Temp" value={tankAverageTemp} onChange={(e) => setTankAverageTemp(e.target.value)} />
                    <input style={input} placeholder="Ambient Temp" value={tankAmbientTemp} onChange={(e) => setTankAmbientTemp(e.target.value)} />
                    <input style={input} placeholder="Observed Gravity" value={tankObservedGravity} onChange={(e) => setTankObservedGravity(e.target.value)} />
                    <input style={input} placeholder="Observed Temp" value={tankObservedTemp} onChange={(e) => setTankObservedTemp(e.target.value)} />
                    <input style={input} placeholder="S&W %" value={tankSwPercent} onChange={(e) => setTankSwPercent(e.target.value)} />
                  </div>

                  {selectedTank && tankClosingFeet !== '' && (
                    <div style={card}>
                      <h4>Tank Calculation Preview</h4>
                      <div>Opening Gauge: {calculateTankTicketSnapshot(selectedTank).openingGaugeDecimal.toFixed(4)}</div>
                      <div>Closing Gauge: {calculateTankTicketSnapshot(selectedTank).closingGaugeDecimal.toFixed(4)}</div>
                      <div>Opening BBLS: {calculateTankTicketSnapshot(selectedTank).movement.openingCorrected.toFixed(2)}</div>
                      <div>Closing BBLS: {calculateTankTicketSnapshot(selectedTank).movement.closingCorrected.toFixed(2)}</div>
                      <div>GOV: {calculateTankTicketSnapshot(selectedTank).gov.toFixed(2)}</div>
                      <div>API @60: {calculateTankTicketSnapshot(selectedTank).corrections.api_gravity_60.toFixed(1)}</div>
                      <div>CTL: {calculateTankTicketSnapshot(selectedTank).ctl.toFixed(5)}</div>
                      <div>CPL: {calculateTankTicketSnapshot(selectedTank).cpl.toFixed(5)}</div>
                      <div>CCF: {calculateTankTicketSnapshot(selectedTank).ccf.toFixed(5)}</div>
                      <div>GSV: {calculateTankTicketSnapshot(selectedTank).gsv.toFixed(2)}</div>
                      <div>NSV: {calculateTankTicketSnapshot(selectedTank).nsv.toFixed(2)}</div>
                      <div>Deadwood Opening Adj: {getDeadwoodAdjustment(selectedTank, calculateTankTicketSnapshot(selectedTank).openingGaugeDecimal).toFixed(2)} bbl</div>
                      <div>Deadwood Closing Adj: {getDeadwoodAdjustment(selectedTank, calculateTankTicketSnapshot(selectedTank).closingGaugeDecimal).toFixed(2)} bbl</div>
                    </div>
                  )}
                </div>
              )}

              {ticketType === 'line_fill' && (
                <div style={card}>
                  <h3>Line Fill Ticket Inputs</h3>
                  <select style={input} value={selectedLineFill} onChange={(e) => setSelectedLineFill(e.target.value)}>
                    <option value="">Select Line Fill</option>
                    {lineFills
                      .filter((line: any) => !selectedSegment || line.segment_id === selectedSegment)
                      .map((line: any) => (
                        <option key={line.id} value={line.id}>{line.line_name}</option>
                      ))}
                  </select>
                </div>
              )}

              <input
                style={input}
                placeholder="Closing Reading (optional — opening auto-fills from previous approved lease ticket)"
                value={manualClosingReading}
                onChange={(e) => setManualClosingReading(e.target.value)}
              />

              <div style={card}>
                <h3>Autofill Preview</h3>
                <div>Profile: {autofillPreview?.profile?.name || 'None'}</div>
                <div>IV: {autofillPreview?.reading?.indicated_volume ?? 'None'}</div>
                <div>Previous Closing Reading: {selectedLease ? getPreviousClosingForLease(selectedLease, selectedMeter) || 'None' : 'Select lease'}</div>
                <div>Avg Temp: {autofillPreview?.reading?.average_temperature ?? 'None'}</div>
                <div>Avg Pressure: {autofillPreview?.reading?.average_pressure ?? 'None'}</div>
                <div>Latest Approved {autofillPreview?.proving?.factor_type || 'MF'}: {autofillPreview?.proving?.accepted_meter_factor ?? 'None'}</div>
                <div>POT Observed API Gravity: {autofillPreview?.pot?.observed_api_gravity ?? autofillPreview?.pot?.api_gravity ?? 'None'}</div>
                <div>POT Observed Temp: {autofillPreview?.pot?.observed_temperature ?? autofillPreview?.pot?.sample_temperature ?? 'None'}</div>
                <div>POT API Gravity @60: {autofillPreview?.pot?.api_gravity_60 ?? autofillPreview?.pot?.api_gravity ?? 'None'}</div>
                <div>POT BS&W: {autofillPreview?.pot?.bsw ?? 'None'}</div>
                <div>POT CSW: {autofillPreview?.pot?.csw ?? 'None'}</div>
              </div>

              <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Creating ticket', async () => { await createTicket(); clearLocalTicketDraft() })}>Auto Build Draft Ticket</button>
            </div>

            <div style={box}>
              <h3>Workflow Queue</h3>
              {workflowTickets.map((t) => (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>Ticket Detail</h2>
                  <span style={getTicketStatusStyle(selectedTicket!.status)}>{selectedTicket!.status || 'draft'}</span>
                </div>
                <div><strong>Ticket:</strong> {selectedTicket!.ticket_number}</div>
                <div><strong>Locked:</strong> {(selectedTicket as any).is_locked ? 'Yes' : 'No'}</div>
                <div><strong>Locked At:</strong> {selectedTicket.locked_at || 'N/A'}</div>
                <div><strong>Status:</strong> {selectedTicket!.status}</div>
                <div><strong>Type:</strong> {selectedTicket!.ticket_type}</div>
                <div><strong>Profile:</strong> {selectedTicket.calculation_profile_snapshot?.name || 'None'}</div>
                <div><strong>Contract Profile:</strong> {selectedTicket!.observed_inputs?.contract_profile_name || selectedTicket.calculation_profile_snapshot?.contract_profile?.name || 'Default'}</div>
                <div><strong>Calculation Method:</strong> {selectedTicket!.observed_inputs?.calculation_method || selectedTicket.calculation_profile_snapshot?.selected_calculation_method || 'CTPL'}</div>

                {selectedTicket.approved_at && (
                  <div style={{ color: '#86efac', marginTop: 10 }}>
                    Approved At: {new Date(selectedTicket.approved_at).toLocaleString()}
                  </div>
                )}

                {selectedTicket!.status === 'approved' && (
                  <div style={{ background: '#14532d', padding: 12, borderRadius: 8, marginTop: 12 }}>
                    Approved ticket is locked for custody transfer.
                  </div>
                )}

                <div style={card}>
                  <h3>Observed Inputs</h3>
                  <div>IV: {selectedTicket!.observed_inputs?.iv}</div>
                  <div>CTL: {selectedTicket!.observed_inputs?.ctl}</div>
                  <div>CPL: {selectedTicket!.observed_inputs?.cpl}</div>
                  <div>CTLP: {selectedTicket!.observed_inputs?.ctlp}</div>
                  <div>{selectedTicket!.observed_inputs?.factor_type || 'MF'}: {selectedTicket!.observed_inputs?.mf}</div>
                  <div>API Gravity: {selectedTicket!.observed_inputs?.api_gravity}</div>
                  <div>Temp: {selectedTicket!.observed_inputs?.temperature}</div>
                  <div>Avg Temp: {selectedTicket!.observed_inputs?.average_temperature}</div>
                  <div>Avg Pressure: {selectedTicket!.observed_inputs?.average_pressure}</div>
                  <div>BS&W %: {selectedTicket!.observed_inputs?.bsw_percent}</div>
                  <div>CSW: {selectedTicket!.observed_inputs?.csw}</div>
                </div>

                <div style={card}>
                  <h3>Calculated Results</h3>
                  <div>CCF: {selectedTicket!.calculation_results?.ccf}</div>
                  <div>GSV: {selectedTicket!.calculation_results?.gsv}</div>
                  <div>NSV: {selectedTicket!.calculation_results?.nsv}</div>
                </div>

                {(selectedTicket as any).is_locked && (
                  <div
                    style={{
                      ...card,
                      border: '1px solid rgba(234,179,8,0.45)',
                      background: 'rgba(234,179,8,0.10)',
                    }}
                  >
                    <strong>Locked Ticket</strong>
                    <div style={{ color: '#fde68a', marginTop: 6 }}>
                      This ticket is locked. Create a revision if changes are needed.
                    </div>
                  </div>
                )}

                {((selectedTicket as any).revision_number || (selectedTicket as any).is_superseded || (selectedTicket as any).original_ticket_id) && (
                  <div style={card}>
                    <h3>Revision Status</h3>
                    <div>Revision #: {(selectedTicket as any).revision_number ?? 'Original'}</div>
                    <div>Original Ticket: {(selectedTicket as any).original_ticket_id || 'None'}</div>
                    <div>Superseded: {(selectedTicket as any).is_superseded ? 'Yes' : 'No'}</div>
                    {(selectedTicket as any).revision_reason && (
                      <div>Reason: {(selectedTicket as any).revision_reason}</div>
                    )}
                  </div>
                )}

                <div style={card}>
                  <h3>Ticket Audit Timeline</h3>

                  {getTicketAuditRows(selectedTicket!.id).length === 0 && (
                    <div style={{ color: '#a8b3bd' }}>
                      No audit events recorded yet.
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 12 }}>
                    {getTicketAuditRows(selectedTicket!.id).map((log: any) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '20px 1fr',
                          gap: 10,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={timelineDot} />
                        <div
                          style={{
                            paddingBottom: 10,
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <strong>{getAuditLabel(log)}</strong>
                          <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                            {formatAuditDate(log.created_at || log.createdAt)}
                          </div>
                          {(log.user_email || log.user_id || log.userId) && (
                            <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                              By: {log.user_email || log.user_id || log.userId}
                            </div>
                          )}
                          {(log.notes || log.note || log.message) && (
                            <div style={{ marginTop: 6 }}>
                              {log.notes || log.note || log.message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Submitting ticket', () => updateTicketStatus(selectedTicket, 'submitted'))}>Submit Ticket</button>
                <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Approving ticket', () => updateTicketStatus(selectedTicket, 'approved'))}>Approve Ticket</button>
                <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Returning ticket to draft', () => updateTicketStatus(selectedTicket, 'draft'))}>Reject to Draft</button>
                <button style={{ ...button, background: '#dc2626' }} disabled={isActionRunning} onClick={() => runSafeAction('Voiding ticket', () => updateTicketStatus(selectedTicket, 'voided'))}>Void Ticket</button>
                <button style={{ ...button, background: '#16a34a' }} disabled={isActionRunning} onClick={() => runSafeAction('Generating PDF preview', () => generatePdfPreview(selectedTicket))}>Generate PDF Preview</button>
              </div>
            )}
          </>
        )}
                </>
        )}
      </main>
    </div>
    </>
  )
}

export default App
