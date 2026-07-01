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
type Segment = { id: string; name: string; segment_name?: string; area_id?: string | null; company_id?: string | null; active?: boolean | null }

type Lease = {
  id: string
  lease_name: string
  name?: string
  lease_number?: string
  segment_id?: string
  area_id?: string | null
  producer_id?: string
  active?: boolean | null
}

type Meter = {
  id: string
  meter_number: string
  meter_name?: string
  active?: boolean
  lease_id?: string
  segment_id?: string | null
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
  producer_name?: string | null
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
  lease_id?: string | null
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
  ticket_pdf_url?: string | null
  ticket_pdf_path?: string | null
  ticket_pdf_file_name?: string | null
  ticket_pdf_saved_at?: string | null
}

type Proving = {
  id: string
  meter_id: string
  proving_date: string
  company_id?: string | null
  area_id?: string | null
  segment_id?: string | null
  lease_id?: string | null
  producer_id?: string | null
  observed_meter_factor?: number
  accepted_meter_factor?: number
  mf?: number | null
  cpl?: number | null
  calculated_cmf?: number | null
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

function roundApiHalfEven(value: number, decimals = 5) {
  if (!Number.isFinite(value)) return 0
  const increment = 10 ** -decimals
  const sign = value < 0 ? -1 : 1
  const normalized = Math.abs(value) / increment
  const floorValue = Math.floor(normalized)
  const fraction = normalized - floorValue
  const epsilon = 1e-12

  let roundedInteger = floorValue
  if (Math.abs(fraction - 0.5) <= epsilon) {
    roundedInteger = floorValue % 2 === 0 ? floorValue : floorValue + 1
  } else {
    roundedInteger = Math.floor(normalized + 0.5)
  }

  return sign * roundedInteger * increment
}

function roundApiFactor(value: number, decimals = 6) {
  return roundApiHalfEven(value, decimals)
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

  // API MPMS 11.1 11.1.5.3: t68 = t90 - Δt, then convert back to °F.
  return (tempC - correctionC) * 1.8 + 32
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

  const apiDecimals = Number(input.apiRounding ?? 1)
  const factorDecimals = 6

  return {
    observed_api_gravity: roundTo(observedApiGravity, 5),
    observed_temperature: roundTo(observedTemperature, 2),
    observed_pressure: roundTo(observedPressure, 2),

    // Display value: API gravity @60 is rounded to nearest tenth for tickets.
    api_gravity_60: roundApiHalfEven(base.apiGravity60, apiDecimals),
    density_60: roundTo(base.density60, 6),
    average_temperature: roundTo(averageTemperature, 2),
    average_pressure: roundTo(averagePressure, 2),

    // Display / ticket factors. Chapter 12.2 R2021 tickets use these rounded factors.
    ctl: roundApiFactor(volumeCorrection.ctl, factorDecimals),
    cpl: roundApiFactor(volumeCorrection.cpl, factorDecimals),
    ctlp: roundApiFactor(volumeCorrection.ctlp, factorDecimals),
    ccf: roundApiFactor(volumeCorrection.ccf, factorDecimals),

    // Audit values: full precision is retained for validation and troubleshooting.
    raw_api_gravity_60: base.apiGravity60,
    raw_density_60: base.density60,
    raw_ctl: volumeCorrection.ctl,
    raw_cpl: volumeCorrection.cpl,
    raw_ctlp: volumeCorrection.ctlp,
    raw_ccf: volumeCorrection.ccf,
    raw_fp: volumeCorrection.fp,
    raw_alpha60: volumeCorrection.alpha60,
    product_sub_group: volumeCorrection.productSubGroup,
    api_engine: 'API MPMS 11.1 / 11.1.6.1',
    api_engine_note: base.converged
      ? 'Calculated using API MPMS 11.1 implementation procedure with rounded display factors.'
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
    super_admin: 6,
    admin: 5,
    company_admin: 5,
    measurement_tech: 3,
    operator: 2,
    auditor: 1,
  }

  const activeRoles = (roles || []).filter((role) => role.active !== false)

  if (activeRoles.length === 0) return 'operator'

  const normalize = (value: any) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')

  return normalize(
    activeRoles
      .slice()
      .sort((a, b) => (rank[normalize(b.role)] || 0) - (rank[normalize(a.role)] || 0))[0].role
  ) || 'operator'
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState('dashboard')
  const [provingTab, setProvingTab] = useState<'create' | 'drafts' | 'pending' | 'approved' | 'kpi' | 'schedule'>('create')
  const [potTab, setPotTab] = useState<'create' | 'history' | 'export'>('create')
  const [readingTab, setReadingTab] = useState<'new' | 'history' | 'photos'>('new')
  const [readingQueueMonthFilter, setReadingQueueMonthFilter] = useState('')
  const [readingQueueSegmentFilter, setReadingQueueSegmentFilter] = useState('')
  const [potQueueMonthFilter, setPotQueueMonthFilter] = useState('')
  const [potQueueSegmentFilter, setPotQueueSegmentFilter] = useState('')
  const [potQueueProducerFilter, setPotQueueProducerFilter] = useState('')
  const [provingQueueMonthFilter, setProvingQueueMonthFilter] = useState('')
  const [provingQueueSegmentFilter, setProvingQueueSegmentFilter] = useState('')
  const [provingQueueProducerFilter, setProvingQueueProducerFilter] = useState('')
  const [ticketArchiveProducerFilter, setTicketArchiveProducerFilter] = useState('')
  const [hierarchySegmentId, setHierarchySegmentId] = useState('')
  const [hierarchyAreaId, setHierarchyAreaId] = useState('')
  const [hierarchyLeaseId, setHierarchyLeaseId] = useState('')
  const [hierarchyLeaseSegmentId, setHierarchyLeaseSegmentId] = useState('')
  const [hierarchyMeterId, setHierarchyMeterId] = useState('')
  const [hierarchyMeterLeaseId, setHierarchyMeterLeaseId] = useState('')
  const [userAreaAccess, setUserAreaAccess] = useState<any[]>([])
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('')
  const [selectedAccessAreaIds, setSelectedAccessAreaIds] = useState<string[]>([])
  const [contractProfiles, setContractProfiles] = useState<any[]>([])
  const [newContractName, setNewContractName] = useState('')
  const [newContractTransporter, setNewContractTransporter] = useState('')
  const [newContractMethod, setNewContractMethod] = useState('chapter12_2021')
  const [newContractMf, setNewContractMf] = useState('1')
  const [newContractApiVersion, setNewContractApiVersion] = useState('api_11_1_2021')
  const [newContractCorrectionSource, setNewContractCorrectionSource] = useState('app_calculated')
  const [contractAreaId, setContractAreaId] = useState('')
  const [contractSegmentId, setContractSegmentId] = useState('')
  const [contractLeaseId, setContractLeaseId] = useState('')
  const [contractProductGroup, setContractProductGroup] = useState('crude')
  const [apiTesterVersion, setApiTesterVersion] = useState('api_11_1_2021')
  const [apiTesterGravity, setApiTesterGravity] = useState('40')
  const [apiTesterTemp, setApiTesterTemp] = useState('80')
  const [apiTesterPressure, setApiTesterPressure] = useState('50')
  const [apiTesterIv, setApiTesterIv] = useState('1000')
  const [apiTesterMf, setApiTesterMf] = useState('1')
  const [apiTesterBsw, setApiTesterBsw] = useState('0')
  const [systemHealthChecks, setSystemHealthChecks] = useState<any[]>([])
  const [systemHealthRunning, setSystemHealthRunning] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [meterCsvFile, setMeterCsvFile] = useState<File | null>(null)
  const [strappingCsvFile, setStrappingCsvFile] = useState<File | null>(null)
  const [selectedStrappingTankId, setSelectedStrappingTankId] = useState('')
  const [strappingLegType, setStrappingLegType] = useState('')
  const [strappingRoofMode, setStrappingRoofMode] = useState('fra')
  const [strappingRoofWeightLbs, setStrappingRoofWeightLbs] = useState('')
  const [strappingRoofReferenceApi, setStrappingRoofReferenceApi] = useState('')
  const [strappingRoofReferenceSg, setStrappingRoofReferenceSg] = useState('')
  const [strappingRoofCriticalGauge, setStrappingRoofCriticalGauge] = useState('')

  const [newTankNumber, setNewTankNumber] = useState('')
  const [newTankName, setNewTankName] = useState('')
  const [newTankSegmentId, setNewTankSegmentId] = useState('')
  const [editingTankId, setEditingTankId] = useState('')
  const [editingTankNumber, setEditingTankNumber] = useState('')
  const [editingTankName, setEditingTankName] = useState('')
  const [editingTankSegmentId, setEditingTankSegmentId] = useState('')
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
    observed_temperature: '',
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
  const [currentAuthUserId, setCurrentAuthUserId] = useState('')
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
  const [balanceCheckGroups, setBalanceCheckGroups] = useState<any[]>([])
  const [balanceCheckGroupMeters, setBalanceCheckGroupMeters] = useState<any[]>([])
  const [balanceEquations, setBalanceEquations] = useState<any[]>([])
  const [balanceEquationItems, setBalanceEquationItems] = useState<any[]>([])
  const [balanceInventoryEntries, setBalanceInventoryEntries] = useState<any[]>([])
  const [balanceButaneAdjustments, setBalanceButaneAdjustments] = useState<any[]>([])
  const [segmentBalanceSettings, setSegmentBalanceSettings] = useState<any[]>([])
  const [segmentProvingSettings, setSegmentProvingSettings] = useState<any[]>([])
  const [provingKpiMonth, setProvingKpiMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [provingScheduleRows, setProvingScheduleRows] = useState<any[]>([])
  const [scheduleSegmentId, setScheduleSegmentId] = useState('')
  const [scheduleAssignedTo, setScheduleAssignedTo] = useState('')
  const [meterAssetConfigs, setMeterAssetConfigs] = useState<any[]>([])
  const [tankCalibrationVersions, setTankCalibrationVersions] = useState<any[]>([])
  const [tankStrappingRows, setTankStrappingRows] = useState<any[]>([])
  const [tankDeadwoodRules, setTankDeadwoodRules] = useState<any[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketAuditLogs, setTicketAuditLogs] = useState<TicketAuditLog[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [allUserRoles, setAllUserRoles] = useState<UserRole[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [Role, setCurrentUserRole] = useState<string>('operator')
  const [newAdminUserId, setNewAdminUserId] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('operator')
  const [showActiveUsers, setShowActiveUsers] = useState(false)
  const [showCompanyBranding, setShowCompanyBranding] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(true)
  const [showContractProfiles, setShowContractProfiles] = useState(true)
  const [showCompanySetupHub, setShowCompanySetupHub] = useState(true)
  const [adminSection, setAdminSection] = useState<'company' | 'users' | 'contracts' | 'hierarchy' | 'meters' | 'checks' | 'equations' | 'imports' | 'tanks'>('company')
  const [newCheckGroupName, setNewCheckGroupName] = useState('')
  const [newCheckGroupSegmentId, setNewCheckGroupSegmentId] = useState('')
  const [newCheckGroupCheckMeterId, setNewCheckGroupCheckMeterId] = useState('')
  const [newCheckGroupCheckMeterIds, setNewCheckGroupCheckMeterIds] = useState<string[]>([])
  const [newCheckGroupInputMeterIds, setNewCheckGroupInputMeterIds] = useState<string[]>([])
  const [editingCheckGroupId, setEditingCheckGroupId] = useState('')
  const [checkGroupMeterSearch, setCheckGroupMeterSearch] = useState('')
  const [newBalanceEquationName, setNewBalanceEquationName] = useState('')
  const [newBalanceEquationSegmentId, setNewBalanceEquationSegmentId] = useState('')
  const [newEquationSideAMeterIds, setNewEquationSideAMeterIds] = useState<string[]>([])
  const [newEquationSideBMeterIds, setNewEquationSideBMeterIds] = useState<string[]>([])
  const [newEquationSideACheckGroupIds, setNewEquationSideACheckGroupIds] = useState<string[]>([])
  const [newEquationSideBCheckGroupIds, setNewEquationSideBCheckGroupIds] = useState<string[]>([])
  const [equationMeterSearch, setEquationMeterSearch] = useState('')
  const [newEquationIncludeTankChange, setNewEquationIncludeTankChange] = useState(false)
  const [newEquationIncludeLineFillChange, setNewEquationIncludeLineFillChange] = useState(false)
  const [editingBalanceEquationId, setEditingBalanceEquationId] = useState('')
  const [meterMasterSegmentFilterId, setMeterMasterSegmentFilterId] = useState('')
  const [selectedMeterMasterId, setSelectedMeterMasterId] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [selectedAdminCompanyId, setSelectedAdminCompanyId] = useState('')
  const [newCompanyAdminEmail, setNewCompanyAdminEmail] = useState('')
  const [newCompanyAdminPassword, setNewCompanyAdminPassword] = useState('')
  const [newContractProducer, setNewContractProducer] = useState('')
  const [newContractStandard, setNewContractStandard] = useState('API 11.1 2021')
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
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isDraftTicketEditOpen, setIsDraftTicketEditOpen] = useState(false)
  const [draftTicketEditValues, setDraftTicketEditValues] = useState<Record<string, string>>({})
  const [openApprovedTicketMonths, setOpenApprovedTicketMonths] = useState<Record<string, boolean>>({})
  const [openWorkflowTicketGroups, setOpenWorkflowTicketGroups] = useState<Record<string, boolean>>({})
  const [ticketArchiveMonthFilter, setTicketArchiveMonthFilter] = useState('')
  const [ticketArchiveSegmentFilter, setTicketArchiveSegmentFilter] = useState('')
  const [openTicketArchiveSections, setOpenTicketArchiveSections] = useState<Record<string, boolean>>({})
  const [ticketWorkflowTab, setTicketWorkflowTab] = useState<'create' | 'drafts' | 'pending' | 'approved'>('create')
  const [ticketOpenDate, setTicketOpenDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ticketOpenTime, setTicketOpenTime] = useState('07:00')
  const [ticketCloseDate, setTicketCloseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ticketCloseTime, setTicketCloseTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

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
  const [selectedTicketArea, setSelectedTicketArea] = useState('')
  const [ticketType, setTicketType] = useState('meter')
  const [refinedProductType, setRefinedProductType] = useState('')
  const [refinedProductCode, setRefinedProductCode] = useState('')
  const [refinedMovementDestination, setRefinedMovementDestination] = useState('')
  const [ticketBatchNumber, setTicketBatchNumber] = useState('')
  const [selectedTank, setSelectedTank] = useState('')
  const [selectedTankCalibrationVersionId, setSelectedTankCalibrationVersionId] = useState('')
  const [selectedLineFill, setSelectedLineFill] = useState('')
  const [openingGauge, setOpeningGauge] = useState('')
  const [closingGauge, setClosingGauge] = useState('')
  const [tankMovementDirection, setTankMovementDirection] = useState('delivery')
  const [tankClosingFeet, setTankClosingFeet] = useState('')
  const [tankClosingInches, setTankClosingInches] = useState('')
  const [tankClosingEighths, setTankClosingEighths] = useState('')
  const [tankOpeningWaterFeet, setTankOpeningWaterFeet] = useState('')
  const [tankOpeningWaterInches, setTankOpeningWaterInches] = useState('')
  const [tankOpeningWaterEighths, setTankOpeningWaterEighths] = useState('')
  const [tankClosingWaterFeet, setTankClosingWaterFeet] = useState('')
  const [tankClosingWaterInches, setTankClosingWaterInches] = useState('')
  const [tankClosingWaterEighths, setTankClosingWaterEighths] = useState('')
  const [tankUsePreviousOpeningTicket, setTankUsePreviousOpeningTicket] = useState(true)
  const [tankAverageTemp, setTankAverageTemp] = useState('')
  const [tankAmbientTemp, setTankAmbientTemp] = useState('')
  const [tankShellReferenceTemp, setTankShellReferenceTemp] = useState('60')
  const [tankShellCoefficient, setTankShellCoefficient] = useState('0.0000062')
  const [tankIsInsulated, setTankIsInsulated] = useState(false)
  const [tankOpeningRoofAdjustment, setTankOpeningRoofAdjustment] = useState('')
  const [tankClosingRoofAdjustment, setTankClosingRoofAdjustment] = useState('')
  const [tankAutoRoofCorrection, setTankAutoRoofCorrection] = useState(true)
  const [tankRoofCorrectionMode, setTankRoofCorrectionMode] = useState('fra')
  const [tankRoofReferenceApi, setTankRoofReferenceApi] = useState('')
  const [tankRoofBblPerApi, setTankRoofBblPerApi] = useState('')
  const [tankRoofWeightLbs, setTankRoofWeightLbs] = useState('')
  const [tankRoofFixedCorrectionBbl, setTankRoofFixedCorrectionBbl] = useState('')
  const [tankRoofCriticalGauge, setTankRoofCriticalGauge] = useState('')
  const [tankObservedGravity, setTankObservedGravity] = useState('')
  const [tankObservedTemp, setTankObservedTemp] = useState('')
  const [tankSwPercent, setTankSwPercent] = useState('')
  const [manualClosingReading, setManualClosingReading] = useState('')
  const [autofillPreview, setAutofillPreview] = useState<any>(null)

    const [selectedReadingArea, setSelectedReadingArea] = useState('')
  const [selectedReadingSegment, setSelectedReadingSegment] = useState('')
  const [readingMovementType, setReadingMovementType] = useState('receipt')
const [selectedReadingMeter, setSelectedReadingMeter] = useState('')
  const [provingMeter, setProvingMeter] = useState('')
  const [selectedPotArea, setSelectedPotArea] = useState('')
  const [selectedPotSegment, setSelectedPotSegment] = useState('')
  const [selectedPotLease, setSelectedPotLease] = useState('')
  const [selectedPotMeter, setSelectedPotMeter] = useState('')
  const [selectedProvingArea, setSelectedProvingArea] = useState('')
  const [selectedProvingSegment, setSelectedProvingSegment] = useState('')
  const [selectedProvingLease, setSelectedProvingLease] = useState('')
  const [selectedReadingLease, setSelectedReadingLease] = useState('')
  const [readingOpen, setReadingOpen] = useState('')
  const [readingClose, setReadingClose] = useState('')
  const [readingGravity, setReadingGravity] = useState('')
  const [readingTemp, setReadingTemp] = useState('')
  const [readingAvgTemp, setReadingAvgTemp] = useState('')
  const [readingAvgPressure, setReadingAvgPressure] = useState('')
  const [readingBSW, setReadingBSW] = useState('')
  const [readingMF, setReadingMF] = useState('')
  const [readingPhotoFiles, setReadingPhotoFiles] = useState<File[]>([])
  const [readingPhotoUploading, setReadingPhotoUploading] = useState(false)
  const [readingPhotos, setReadingPhotos] = useState<any[]>([])
  const [editingReadingId, setEditingReadingId] = useState('')

  const [provingDate, setProvingDate] = useState('')
  const [proverVolume, setProverVolume] = useState('')
  const [provingIndicatedVolume, setProvingIndicatedVolume] = useState('')
  const [acceptedMF, setAcceptedMF] = useState('')
  const [provingCpl, setProvingCpl] = useState('')
  const [provingWitness, setProvingWitness] = useState('')
  const [provingFactorType, setProvingFactorType] = useState('MF')
  const [provingPdfFile, setProvingPdfFile] = useState<File | null>(null)
  const [provingPhotoFiles, setProvingPhotoFiles] = useState<File[]>([])
  const [editingProvingId, setEditingProvingId] = useState('')
  const [editingProvingOriginalStatus, setEditingProvingOriginalStatus] = useState('')

  const [potSegment, setPotSegment] = useState('')
  const [potProducer, setPotProducer] = useState('')
  const [potLease, setPotLease] = useState('')
  const [potDate, setPotDate] = useState('')
  const [potGravity, setPotGravity] = useState('')
  const [potBSW, setPotBSW] = useState('')
  const [potTemp, setPotTemp] = useState('')
  const [potRvp, setPotRvp] = useState('')
  const [potSulfur, setPotSulfur] = useState('')
  const [potNotes, setPotNotes] = useState('')
  const [potShakeoutPhotoFiles, setPotShakeoutPhotoFiles] = useState<File[]>([])
  const [potPhotoUploading, setPotPhotoUploading] = useState(false)
  const [potShakeoutPhotos, setPotShakeoutPhotos] = useState<any[]>([])
  const [editingPotId, setEditingPotId] = useState('')



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
    const defaultAreaId = getDefaultVisibleAreaId()
    if (defaultAreaId && !selectedPotArea) {
      setSelectedPotArea(defaultAreaId)
    }
    if (defaultAreaId && !selectedReadingArea) {
      setSelectedReadingArea(defaultAreaId)
    }
  }, [areas.length, selectedPotArea, selectedReadingArea])

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
    const hasTicketSelection = Boolean(selectedSegment || selectedProducer || selectedLease || selectedMeter)

    if (!hasTicketSelection) {
      setAutofillPreview({
        reading: null,
        proving: null,
        producer: null,
        profile: null,
        pot: null,
      })
      return
    }

    const latestReading = selectedMeter
      ? readings.find((r: any) => String(r.meter_id || '') === String(selectedMeter))
      : null
    const latestApprovedProving = selectedMeter
      ? provings.find(
          (p: any) => String(p.meter_id || '') === String(selectedMeter) && String(p.status || '').toLowerCase() === 'approved'
        )
      : null
    const producer = selectedProducer ? producers.find((p) => String(p.id || '') === String(selectedProducer)) : null
    const profile = profiles.find((p) => p.id === producer?.calculation_profile_id)
    const latestPot =
      selectedSegment && selectedLease
        ? potQuality.find(
            (p: any) =>
              String(p.segment_id || '') === String(selectedSegment) &&
              String(p.lease_id || '') === String(selectedLease) &&
              (!selectedProducer || String(p.producer_id || '') === String(selectedProducer))
          )
        : null

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

  
  function getPotBswPercentValue(pot: any) {
    if (!pot) return null

    const directValue =
      (pot as any).bsw_percent ??
      (pot as any).sw_percent ??
      (pot as any).bsw ??
      (pot as any).bs_and_w ??
      (pot as any).sandw ??
      (pot as any).s_and_w ??
      (pot as any).water_percent

    if (directValue !== undefined && directValue !== null && directValue !== '') {
      const value = Number(directValue)
      return Number.isFinite(value) ? value : null
    }

    const cswValue = (pot as any).csw
    if (cswValue !== undefined && cswValue !== null && cswValue !== '') {
      const value = (1 - Number(cswValue)) * 100
      return Number.isFinite(value) ? value : null
    }

    return null
  }

  function formatPotBswPercent(pot: any) {
    const value = getPotBswPercentValue(pot)
    return value === null ? 'None' : value.toFixed(4)
  }


  function normalizeRoleName(value: any) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
  }

  function hasLoadedRole(...roleNames: string[]) {
    const wanted = new Set(roleNames.map(normalizeRoleName))
    const current = normalizeRoleName(Role)

    if (wanted.has(current)) return true

    return asArray(userRoles).some((row: any) => {
      if (row.active === false) return false
      return wanted.has(normalizeRoleName(row.role))
    })
  }


  function isActuallyAdminUser() {
    const current = normalizeRoleName(Role)

    if (current === 'super_admin' || current === 'admin' || current === 'company_admin') return true

    return asArray(userRoles).some((row: any) => {
      const role = normalizeRoleName(row.role)
      return row.active !== false && (role === 'super_admin' || role === 'admin' || role === 'company_admin')
    })
  }

const userIsSuperAdmin = hasLoadedRole('super_admin') || asArray(userRoles).some((row: any) => row.active !== false && normalizeRoleName(row.role) === 'super_admin')
  const userIsCompanyAdmin = isActuallyAdminUser() && !userIsSuperAdmin
  const userCanManageCompanySetup = userIsSuperAdmin || userIsCompanyAdmin
  const userCanCreateCompanyScopedUsers = userIsSuperAdmin || userIsCompanyAdmin
useEffect(() => {
  const loadBranding = async () => {
    const activeAreaCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    if (!(userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId)) return

    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId))
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
    setCurrentAuthUserId(authUser?.id || '')

    const emptyScope = {
      authUserId: '',
      role: 'operator',
      roles: [] as any[],
      companyId: '',
      isSuperAdmin: false,
      isCompanyAdmin: false,
    }

    if (!authUser) {
      setCurrentUserRole('operator')
      setUserRoles([])
      setCompanyId('')
      setCurrentAuthUserId('')
      return emptyScope
    }

    // Read the logged-in user's role two ways:
    // 1) direct table read when RLS allows it
    // 2) SECURITY DEFINER RPC helper when RLS hides the row from the browser
    const [roleResult, rpcRoleResult, rpcCompanyResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authUser.id),
      supabase.rpc('tefco_current_role'),
      supabase.rpc('tefco_current_company_id'),
    ])

    if (roleResult.error) {
      console.error('Role table load error:', roleResult.error)
    }
    if (rpcRoleResult.error) {
      console.warn('Role RPC fallback unavailable:', rpcRoleResult.error)
    }
    if (rpcCompanyResult.error) {
      console.warn('Company RPC fallback unavailable:', rpcCompanyResult.error)
    }

    const directRows = (roleResult.data || []).filter((role: any) => role.active !== false)
    const rpcRole = normalizeRoleName(rpcRoleResult.data || '')
    const rpcCompanyId = String(rpcCompanyResult.data || '')

    let highestRole = getHighestRole(directRows)

    // If the direct RLS table read returns nothing/operator but the server helper knows
    // the real role, trust the helper. This prevents valid admins from falling back to operator.
    if (rpcRole && rpcRole !== 'operator') {
      const directRank = getHighestRole([{ role: highestRole, active: true }])
      const rpcRank = getHighestRole([{ role: rpcRole, active: true }])
      const rankValue: Record<string, number> = {
        super_admin: 6,
        admin: 5,
        company_admin: 5,
        measurement_tech: 3,
        operator: 2,
        auditor: 1,
      }
      if ((rankValue[rpcRank] || 0) >= (rankValue[directRank] || 0)) {
        highestRole = rpcRank
      }
    }

    let resolvedCompanyId = ''

    const companyRole =
      directRows.find((role: any) => normalizeRoleName(role.role) !== 'super_admin' && role.company_id) ||
      directRows.find((role: any) => role.company_id)

    resolvedCompanyId = companyRole?.company_id || rpcCompanyId || ''

    if (!resolvedCompanyId) {
      const { data: companyUserRow, error: companyUserError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (!companyUserError && companyUserRow?.company_id) {
        resolvedCompanyId = companyUserRow.company_id
      }
    }

    const rowsForState = directRows.length > 0
      ? directRows
      : highestRole !== 'operator'
        ? [{
            id: `runtime-${authUser.id}`,
            user_id: authUser.id,
            role: highestRole,
            company_id: resolvedCompanyId || null,
            active: true,
          }]
        : []

    setUserRoles(rowsForState)
    setCurrentUserRole(highestRole)
    setCompanyId(resolvedCompanyId)

    const normalizedRole = normalizeRoleName(highestRole)

    return {
      authUserId: authUser.id,
      role: highestRole,
      roles: rowsForState,
      companyId: resolvedCompanyId,
      isSuperAdmin: normalizedRole === 'super_admin',
      isCompanyAdmin: normalizedRole === 'admin' || normalizedRole === 'company_admin',
    }
  }


  async function loadAll() {
    const scope = await reloadCurrentUserRole()
    const activeCompanyIdForLoad = scope.isSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : scope.companyId
    const applyCompanyScope = (query: any) => activeCompanyIdForLoad ? query.eq('company_id', activeCompanyIdForLoad) : query

    async function loadCompanyRows(tableName: string, orderColumn = 'id') {
      const allRows: any[] = []
      const pageSize = 1000
      let from = 0

      while (true) {
        let query = supabase.from(tableName).select('*').order(orderColumn)
        if (activeCompanyIdForLoad) query = query.eq('company_id', activeCompanyIdForLoad)
        const { data, error } = await query.range(from, from + pageSize - 1)

        if (error) {
          console.warn(`${tableName} paged load error:`, error)
          break
        }

        const pageRows = Array.isArray(data) ? data : []
        allRows.push(...pageRows)

        if (pageRows.length < pageSize) break
        from += pageSize
      }

      return allRows
    }

    const companiesQuery = scope.isSuperAdmin || !activeCompanyIdForLoad
      ? supabase.from('companies').select('*').order('name')
      : supabase.from('companies').select('*').eq('id', activeCompanyIdForLoad).order('name')

    const { data: companiesData, error: companiesError } = await companiesQuery

    if (companiesError) {
      console.error('Companies load error:', companiesError)
    }

    if (companiesData) {
      setCompanies(companiesData)
      if (scope.isSuperAdmin && !selectedAdminCompanyId && companiesData.length > 0) {
        setSelectedAdminCompanyId(companiesData[0].id)
      }
    }

    // Company id is resolved only from the logged-in user's own role/company row.

    const { data: areaData, error: areaLoadError } = await applyCompanyScope(supabase.from('areas').select('*')).order('name')
    const { data: segData, error: segmentLoadError } = await applyCompanyScope(supabase.from('segments').select('*')).order('name')
    const { data: leaseData, error: leaseLoadError } = await applyCompanyScope(supabase.from('leases').select('*')).order('lease_name')
    const { data: meterData, error: meterLoadError } = await applyCompanyScope(supabase.from('meters').select('*')).order('meter_number')
    const { data: hierarchyData, error: hierarchyRpcError } = activeCompanyIdForLoad
      ? await supabase.rpc('tefco_dropdown_hierarchy_for_app', { p_company_id: activeCompanyIdForLoad })
      : { data: null, error: null } as any
    if (areaLoadError || segmentLoadError || leaseLoadError || meterLoadError || hierarchyRpcError) {
      console.warn('Hierarchy dropdown load status:', { areaLoadError, segmentLoadError, leaseLoadError, meterLoadError, hierarchyRpcError })
    }
    const hierarchyPayload: any = Array.isArray(hierarchyData) ? hierarchyData[0] : hierarchyData
    const resolvedAreaData = Array.isArray(hierarchyPayload?.areas) && hierarchyPayload.areas.length ? hierarchyPayload.areas : areaData
    const resolvedSegmentData = Array.isArray(hierarchyPayload?.segments) && hierarchyPayload.segments.length ? hierarchyPayload.segments : segData
    const resolvedLeaseData = Array.isArray(hierarchyPayload?.leases) && hierarchyPayload.leases.length ? hierarchyPayload.leases : leaseData
    const resolvedMeterData = Array.isArray(hierarchyPayload?.meters) && hierarchyPayload.meters.length ? hierarchyPayload.meters : meterData

    const areaAccessQuery = (scope.isSuperAdmin || scope.isCompanyAdmin)
      ? applyCompanyScope(supabase.from('user_area_access').select('*'))
      : supabase
          .from('user_area_access')
          .select('*')
          .eq('user_id', scope.authUserId)

    const { data: areaAccessData, error: areaAccessLoadError } = await areaAccessQuery
    if (areaAccessLoadError) {
      console.warn('Area access load error:', areaAccessLoadError)
    }
    const resolvedAreaAccessData = Array.isArray(areaAccessData) ? areaAccessData : []

    const { data: ticketData } = await applyCompanyScope(supabase.from('tickets').select('*')).order('created_at', { ascending: false })

    const { data: auditData } = await applyCompanyScope(
      supabase.from('ticket_audit_log').select('*')
    ).order('created_at', { ascending: false })

    const roleQuery = scope.isSuperAdmin
      ? supabase.from('user_roles').select('*').eq('active', true)
      : activeCompanyIdForLoad
        ? supabase.from('user_roles').select('*').eq('active', true).eq('company_id', activeCompanyIdForLoad)
        : supabase.from('user_roles').select('*').eq('user_id', scope.authUserId).eq('active', true)

    const [{ data: roleData, error: roleListError }, { data: manageableUserData, error: manageableUserError }] = await Promise.all([
      roleQuery,
      (scope.isSuperAdmin || scope.isCompanyAdmin)
        ? supabase.rpc('tefco_manageable_users', { p_company_id: activeCompanyIdForLoad || null })
        : Promise.resolve({ data: null, error: null } as any),
    ])

    if (roleListError) {
      console.warn('Active users direct role list blocked or unavailable:', roleListError)
    }
    if (manageableUserError) {
      console.warn('Active users RPC fallback unavailable:', manageableUserError)
    }

    const { data: permissionData } = await supabase
      .from('role_permissions')
      .select('*')
    const { data: profileData } = await applyCompanyScope(supabase.from('calculation_profiles').select('*')).order('name')
    const { data: producerData } = await applyCompanyScope(supabase.from('producers').select('*')).order('name')
    const { data: readingData } = await applyCompanyScope(supabase.from('operator_readings').select('*')).order('created_at', { ascending: false })
    const { data: readingPhotoData, error: readingPhotoLoadError } = await applyCompanyScope(supabase.from('operator_reading_photos').select('*')).order('created_at', { ascending: false })
    if (readingPhotoLoadError) {
      console.warn('Operator reading photo table unavailable:', readingPhotoLoadError)
    }
    const { data: provingData } = await applyCompanyScope(supabase.from('meter_provings').select('*')).order('proving_date', { ascending: false })
    const { data: potData } = await applyCompanyScope(supabase.from('pot_quality').select('*')).order('sample_date', { ascending: false })
    const { data: potPhotoData, error: potPhotoLoadError } = await applyCompanyScope(supabase.from('pot_quality_photos').select('*')).order('created_at', { ascending: false })
    if (potPhotoLoadError) {
      console.warn('POT shakeout photo table unavailable:', potPhotoLoadError)
    }

    const { data: tankData } = await applyCompanyScope(supabase.from('tanks').select('*')).order('tank_number')
    const { data: lineFillData } = await applyCompanyScope(supabase.from('line_fills').select('*')).order('line_name')
    const { data: meterAssetConfigData } = await applyCompanyScope(supabase.from('meter_asset_config').select('*'))
    const { data: tankCalibrationData } = await applyCompanyScope(supabase.from('tank_calibration_versions').select('*')).order('created_at', { ascending: false })
    const tankStrappingData = await loadCompanyRows('tank_strapping_rows', 'gauge_decimal')
    const { data: tankDeadwoodData } = await applyCompanyScope(supabase.from('tank_deadwood_rules').select('*').eq('active', true))

    // Balance Center tables are optional. If the SQL has not been run yet, the app keeps working with empty balance setup.
    const { data: balanceCheckGroupData, error: balanceCheckGroupError } = await applyCompanyScope(supabase.from('balance_check_groups').select('*')).order('name')
    const { data: balanceCheckGroupMeterData, error: balanceCheckGroupMeterError } = await applyCompanyScope(supabase.from('balance_check_group_meters').select('*'))
    const { data: balanceEquationData, error: balanceEquationError } = await applyCompanyScope(supabase.from('balance_equations').select('*')).order('name')
    const { data: balanceEquationItemData, error: balanceEquationItemError } = await applyCompanyScope(supabase.from('balance_equation_items').select('*'))
    const { data: balanceInventoryEntryData, error: balanceInventoryEntryError } = await applyCompanyScope(supabase.from('balance_inventory_entries').select('*')).order('period_start', { ascending: false })
    const { data: balanceButaneAdjustmentData, error: balanceButaneAdjustmentError } = await applyCompanyScope(supabase.from('balance_butane_adjustments').select('*')).order('period_start', { ascending: false })
    const { data: segmentBalanceSettingData, error: segmentBalanceSettingError } = await applyCompanyScope(supabase.from('segment_balance_settings').select('*'))
    const { data: segmentProvingSettingData, error: segmentProvingSettingError } = await applyCompanyScope(supabase.from('segment_proving_settings').select('*'))
    const { data: provingScheduleData, error: provingScheduleError } = await applyCompanyScope(supabase.from('proving_schedule_rows').select('*')).order('due_date', { ascending: true })
    if (balanceCheckGroupError || balanceCheckGroupMeterError || balanceInventoryEntryError || balanceButaneAdjustmentError || segmentBalanceSettingError || segmentProvingSettingError || balanceEquationError || balanceEquationItemError || provingScheduleError) {
      console.warn('Balance Center optional tables unavailable:', { balanceCheckGroupError, balanceCheckGroupMeterError, balanceInventoryEntryError, balanceButaneAdjustmentError, segmentBalanceSettingError, segmentProvingSettingError, balanceEquationError, balanceEquationItemError, provingScheduleError })
    }

    setUserAreaAccess(resolvedAreaAccessData)
    if (resolvedAreaData) setAreas(resolvedAreaData)
    if (resolvedSegmentData) setSegments(resolvedSegmentData)
    if (resolvedLeaseData) setLeases(resolvedLeaseData)
    if (resolvedMeterData) setMeters(resolvedMeterData)
    if (ticketData) setTickets(ticketData)
    if (auditData) setTicketAuditLogs(auditData)
    const visibleActiveUsers = Array.isArray(manageableUserData) && manageableUserData.length
      ? manageableUserData
      : (roleData || [])

    setAllUserRoles(visibleActiveUsers as any)
    if (permissionData) setRolePermissions(permissionData)
    if (profileData) setProfiles(profileData)
    if (producerData) setProducers(producerData)
    if (readingData) setReadings(readingData)
    if (readingPhotoData) setReadingPhotos(readingPhotoData)
    if (potPhotoData) setPotShakeoutPhotos(potPhotoData)
    if (provingData) setProvings(provingData)
    if (potData) setPotQuality(potData)
    if (tankData) setTanks(tankData)
    if (lineFillData) setLineFills(lineFillData)
    if (meterAssetConfigData) setMeterAssetConfigs(meterAssetConfigData)
    if (tankCalibrationData) setTankCalibrationVersions(tankCalibrationData)
    if (tankStrappingData) setTankStrappingRows(tankStrappingData)
    if (tankDeadwoodData) setTankDeadwoodRules(tankDeadwoodData)
    if (balanceCheckGroupData) setBalanceCheckGroups(balanceCheckGroupData)
    if (balanceCheckGroupMeterData) setBalanceCheckGroupMeters(balanceCheckGroupMeterData)
    if (balanceEquationData) setBalanceEquations(balanceEquationData)
    if (balanceEquationItemData) setBalanceEquationItems(balanceEquationItemData)
    if (balanceInventoryEntryData) setBalanceInventoryEntries(balanceInventoryEntryData)
    if (balanceButaneAdjustmentData) setBalanceButaneAdjustments(balanceButaneAdjustmentData)
    if (segmentBalanceSettingData) setSegmentBalanceSettings(segmentBalanceSettingData)
    if (segmentProvingSettingData) setSegmentProvingSettings(segmentProvingSettingData)
    if (provingScheduleData) setProvingScheduleRows(provingScheduleData)

    const { data: contractProfileData } = await supabase
      .from('contract_profiles')
      .select('*')
      .eq('active', true)
      .order('name')

    if (contractProfileData) setContractProfiles(contractProfileData)
  }

  // Proving schedule is now stored in Supabase so all devices/users see the same KPI.
  // This keeps old browser-only schedules as a one-time fallback until they are resaved.
  useEffect(() => {
    if (typeof window === 'undefined' || !companyId) return
    if (provingScheduleRows.length > 0) return

    try {
      const raw = window.localStorage.getItem(`proving_schedule_${companyId}`)
      if (raw) setProvingScheduleRows(JSON.parse(raw))
    } catch (error) {
      console.warn('Could not load legacy local proving schedule:', error)
    }
  }, [companyId])

  function getScheduledRowsForMonth(monthKey = provingKpiMonth) {
    return asArray(provingScheduleRows).filter((row: any) =>
      row?.active !== false && String(row.month_key || '') === String(monthKey)
    )
  }

  function getScheduleRow(monthKey: string, meterId: string) {
    return getScheduledRowsForMonth(monthKey).find((row: any) => String(row.meter_id || '') === String(meterId)) || null
  }

  function getApprovedProvingForScheduledRow(row: any) {
    if (!row?.meter_id) return null
    return asArray(provings)
      .filter((proving: any) =>
        String(proving.status || '').toLowerCase() === 'approved' &&
        String(proving.meter_id || '') === String(row.meter_id || '') &&
        isProvingInKpiMonth(proving, row.month_key || provingKpiMonth)
      )
      .sort((a: any, b: any) => new Date(a.proving_date || a.approved_at || a.created_at || 0).getTime() - new Date(b.proving_date || b.approved_at || b.created_at || 0).getTime())[0] || null
  }

  function getScheduleStatus(row: any) {
    const completed = getApprovedProvingForScheduledRow(row)
    const today = new Date()
    const due = row?.due_date ? makeLocalDateTime(row.due_date) : null
    if (completed) {
      const provedDate = makeLocalDateTime(completed.proving_date || completed.approved_at || completed.created_at)
      if (due && provedDate && provedDate.getTime() > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59).getTime()) {
        return { label: 'Completed Late', color: '#f59e0b', completed }
      }
      return { label: 'Completed On Time', color: '#16a34a', completed }
    }
    if (due && today.getTime() > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59).getTime()) {
      return { label: 'Overdue', color: '#dc2626', completed: null }
    }
    return { label: 'Scheduled', color: '#2563eb', completed: null }
  }

  async function upsertProvingScheduleRow(meter: any, patch: any) {
    const meterId = String(meter?.id || patch?.meter_id || '')
    if (!meterId) return

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('Select a company first.')
      return
    }

    const leaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(meter?.lease_id || patch?.lease_id || ''))
    const segmentId = String(patch.segment_id || meter?.segment_id || leaseRow?.segment_id || scheduleSegmentId || '')
    const leaseId = String(patch.lease_id || meter?.lease_id || '')
    const existing = getScheduleRow(provingKpiMonth, meterId)
    const nextRow: any = {
      ...(existing || {}),
      ...patch,
      company_id: activeCompanyID,
      month_key: provingKpiMonth,
      segment_id: segmentId || null,
      lease_id: leaseId || null,
      meter_id: meterId,
      frequency: patch.frequency || existing?.frequency || 'monthly',
      due_date: patch.due_date || existing?.due_date || `${provingKpiMonth}-15`,
      assigned_to: patch.assigned_to ?? existing?.assigned_to ?? scheduleAssignedTo ?? '',
      active: patch.active ?? existing?.active ?? true,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('proving_schedule_rows')
      .upsert(nextRow, { onConflict: 'company_id,month_key,meter_id' })

    if (error) {
      alert('Could not save proving schedule to shared database. Run the proving schedule SQL first. ' + error.message)
      return
    }

    setProvingScheduleRows((prev: any[]) => {
      const others = asArray(prev).filter((row: any) => !(String(row.month_key || '') === String(provingKpiMonth) && String(row.meter_id || '') === meterId))
      return [...others, nextRow]
    })
  }

  async function removeProvingScheduleRow(monthKey: string, meterId: string) {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (activeCompanyID) {
      const { error } = await supabase
        .from('proving_schedule_rows')
        .delete()
        .eq('company_id', activeCompanyID)
        .eq('month_key', monthKey)
        .eq('meter_id', meterId)

      if (error) {
        alert('Could not delete proving schedule row: ' + error.message)
        return
      }
    }

    setProvingScheduleRows((prev: any[]) =>
      asArray(prev).filter((row: any) => !(String(row.month_key || '') === String(monthKey) && String(row.meter_id || '') === String(meterId)))
    )
  }

  function getScheduleSegmentMeters() {
    if (!scheduleSegmentId) return []
    return sortMetersForDropdown(
      asArray(meters).filter((meter: any) => meter.active !== false && String(getMeterSegmentId(meter)) === String(scheduleSegmentId))
    )
  }

  function getScheduledKpiSummary(monthKey = provingKpiMonth) {
    const scheduledRows = getScheduledRowsForMonth(monthKey)
    const completedRows = scheduledRows.filter((row: any) => !!getApprovedProvingForScheduledRow(row))
    const overdueRows = scheduledRows.filter((row: any) => getScheduleStatus(row).label === 'Overdue')
    const remaining = Math.max(scheduledRows.length - completedRows.length, 0)
    const compliance = scheduledRows.length > 0 ? Math.round((completedRows.length / scheduledRows.length) * 100) : 0
    return {
      scheduled: scheduledRows.length,
      completed: completedRows.length,
      remaining,
      overdue: overdueRows.length,
      compliance,
      rows: scheduledRows,
    }
  }

  function exportProvingScheduleCsv() {
    const rows = getScheduledRowsForMonth(provingKpiMonth)
    const header = ['Month', 'Segment', 'Lease', 'Meter', 'Due Date', 'Frequency', 'Assigned To', 'Status', 'Completed Date']
    const body = rows.map((row: any) => {
      const meter = getMeterById(row.meter_id)
      const lease = getLeaseById(row.lease_id || meter?.lease_id || '')
      const segment = asArray(segments).find((s: any) => String(s.id || '') === String(row.segment_id || getMeterSegmentId(meter)))
      const status = getScheduleStatus(row)
      return [
        row.month_key,
        segment?.segment_name || segment?.name || '',
        lease?.lease_name || lease?.name || lease?.lease_number || '',
        meter?.meter_number || meter?.meter_name || '',
        row.due_date || '',
        row.frequency || '',
        row.assigned_to || '',
        status.label,
        status.completed?.proving_date || '',
      ]
    })
    downloadCsv(`proving_schedule_${provingKpiMonth}.csv`, [header, ...body])
  }

  const activeMeters = meters.filter((m) => m.active !== false)
  const provingScheduleSummary = getScheduledKpiSummary(provingKpiMonth)
  const provedThisMonthCount = provingScheduleSummary.completed
  const remainingProvingCount = provingScheduleSummary.remaining
  const provingCompliance = provingScheduleSummary.compliance
  const pendingProvings = provings.filter((p) => p.status !== 'approved')
  const draftProvings = provings.filter((p) => String(p.status || '').toLowerCase() === 'draft')
  const approvalProvings = provings.filter((p) => p.status !== 'approved' && String(p.status || '').toLowerCase() !== 'draft')
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
    Role,
    'tickets',
    'can_view'
  )

  const canCreateTickets = hasPermission(
    rolePermissions,
    Role,
    'tickets',
    'can_create'
  )

  const canApproveTickets = hasPermission(
    rolePermissions,
    Role,
    'tickets',
    'can_approve'
  )

  const canApproveProvings = hasPermission(
    rolePermissions,
    Role,
    'provings',
    'can_approve'
  )

  const canViewAudit = hasPermission(
    rolePermissions,
    Role,
    'audit',
    'can_view'
  )

  const isReadOnly =
    Role === 'auditor'
const canViewAdmin = userCanManageCompanySetup

  const canEditAdmin = userCanManageCompanySetup

const provingCompliancePercent =
    meters.length > 0
      ? Math.round((compliantMeters.length / meters.length) * 100)
      : 100

  const approvedTickets = tickets.filter((t) => t.status === 'approved')

  const selectedTicketSegmentLeases = selectedSegment ? getVisibleLeases(selectedSegment) : []
  const filteredLeases = sortLeasesForDropdown(selectedTicketSegmentLeases)
  const selectedTicketLeaseMeters = selectedLease ? getVisibleMeters(selectedLease) : []
  const filteredMeters = sortMetersForDropdown(selectedTicketLeaseMeters)
  const selectedTicketLeaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(selectedLease))
  const selectedTicketMeterRow: any = asArray(meters).find((meter: any) => String(meter.id || '') === String(selectedMeter))
  const selectedTicketProducerKey = String(
    selectedTicketLeaseRow?.producer_id ||
    selectedTicketMeterRow?.producer_id ||
    selectedTicketLeaseRow?.producer ||
    selectedTicketLeaseRow?.producer_name ||
    selectedTicketMeterRow?.producer ||
    selectedTicketMeterRow?.producer_name ||
    ''
  ).trim()
  const selectedTicketProducerRow: any = asArray(producers).find((producer: any) => {
    const producerId = String(producer.id || '').trim()
    const producerName = String(producer.name || (producer as any).producer_name || '').trim().toLowerCase()
    return (producerId && producerId === selectedTicketProducerKey) ||
      (producerName && producerName === selectedTicketProducerKey.toLowerCase())
  })
  const selectedTicketProducerDisplay =
    selectedTicketProducerRow?.name ||
    selectedTicketProducerRow?.producer_name ||
    selectedTicketLeaseRow?.producer_name ||
    selectedTicketLeaseRow?.producer ||
    selectedTicketMeterRow?.producer_name ||
    selectedTicketMeterRow?.producer ||
    (selectedTicketProducerKey ? 'Producer linked' : '')

  const contractSegments = contractAreaId ? getVisibleSegments(contractAreaId) : []
  const contractLeases = contractSegmentId ? sortLeasesForDropdown(getVisibleLeases(contractSegmentId)) : []
  const selectedContractLeaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(contractLeaseId))
  const selectedContractProducerRow: any = asArray(producers).find((producer: any) => String(producer.id || '') === String(selectedContractLeaseRow?.producer_id || ''))

  const effectivePotAreaId = selectedPotArea || getDefaultVisibleAreaId()
  const selectedPotSegmentLeases = selectedPotSegment ? getVisibleLeases(selectedPotSegment) : []
  const filteredPotLeases = sortLeasesForDropdown(selectedPotSegmentLeases)
  const selectedPotLeaseMeters = selectedPotLease ? getVisibleMeters(selectedPotLease) : []
  const selectedPotMeterRow: any = asArray(meters).find((meter: any) => String(meter.id || '') === String(selectedPotMeter))

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







  function asArray(value: any): any[] {
    return Array.isArray(value) ? value : []
  }


  function getCurrentAuthUserIdForAreaAccess() {
    return currentAuthUserId || asArray(userRoles)?.[0]?.user_id || ''
  }

  function getAllowedAreaIdsForCurrentUser() {
    const areaRows = asArray(areas)
    if (userIsSuperAdmin || userIsCompanyAdmin) return areaRows.map((area: any) => String(area.id))

    const uid = getCurrentAuthUserIdForAreaAccess()
    if (!uid) return []

    return asArray(userAreaAccess)
      .filter((row: any) => String(row.user_id || row.profile_id || '') === String(uid))
      .map((row: any) => String(row.area_id))
  }

  function getScopedAreas(): any[] {
    const areaRows = asArray(areas)
    if (userIsSuperAdmin || userIsCompanyAdmin) return areaRows

    const allowed = getAllowedAreaIdsForCurrentUser()
    return areaRows.filter((area: any) => allowed.includes(String(area.id)))
  }

  function getVisibleAreas() {
    return getScopedAreas()
  }

  function getDefaultWorkflowAreaId() {
    const visibleAreas = getVisibleAreas()
    if (visibleAreas.length === 1) return String(visibleAreas[0].id || '')
    return ''
  }

  function shouldHideAreaSelector() {
    return !userIsSuperAdmin && !userIsCompanyAdmin && getVisibleAreas().length === 1
  }

  function getDefaultVisibleAreaId() {
    const visibleAreas = getVisibleAreas()
    return visibleAreas.length === 1 ? String(visibleAreas[0]?.id || '') : ''
  }

  function userCanAccessArea(areaId: string) {
    if (userIsSuperAdmin || userIsCompanyAdmin) return true
    return getAllowedAreaIdsForCurrentUser().includes(String(areaId))
  }

  function buildScopedHierarchyIds(areaIdsInput?: Set<string>) {
    const areaIds = areaIdsInput || new Set(getScopedAreas().map((area: any) => String(area.id || '')))
    const segmentIds = new Set<string>()
    const leaseIds = new Set<string>()
    const meterIds = new Set<string>()

    const add = (set: Set<string>, value: any) => {
      const normalized = String(value || '')
      if (!normalized || set.has(normalized)) return false
      set.add(normalized)
      return true
    }

    let changed = true
    let guard = 0
    while (changed && guard < 10) {
      changed = false
      guard += 1

      asArray(segments).forEach((segment: any) => {
        if (areaIds.has(String(segment.area_id || ''))) {
          changed = add(segmentIds, segment.id) || changed
        }
      })

      asArray(leases).forEach((lease: any) => {
        if (
          areaIds.has(String(lease.area_id || '')) ||
          segmentIds.has(String(lease.segment_id || ''))
        ) {
          changed = add(leaseIds, lease.id) || changed
          changed = add(segmentIds, lease.segment_id) || changed
        }
      })

      asArray(meters).forEach((meter: any) => {
        if (
          areaIds.has(String(meter.area_id || '')) ||
          segmentIds.has(String(meter.segment_id || '')) ||
          leaseIds.has(String(meter.lease_id || ''))
        ) {
          changed = add(meterIds, meter.id) || changed
          changed = add(leaseIds, meter.lease_id) || changed
          changed = add(segmentIds, meter.segment_id) || changed
        }
      })

      asArray(leases).forEach((lease: any) => {
        if (leaseIds.has(String(lease.id || ''))) {
          changed = add(segmentIds, lease.segment_id) || changed
        }
      })
    }

    return { areaIds, segmentIds, leaseIds, meterIds }
  }

  function getScopedSegments(): any[] {
    const segmentRows = asArray(segments)
    if (userIsSuperAdmin || userIsCompanyAdmin) return segmentRows

    const { segmentIds } = buildScopedHierarchyIds()
    return segmentRows.filter((segment: any) => segmentIds.has(String(segment.id || '')))
  }

  function getScopedLeases(): any[] {
    const leaseRows = asArray(leases)
    if (userIsSuperAdmin || userIsCompanyAdmin) return leaseRows

    const { leaseIds } = buildScopedHierarchyIds()
    return leaseRows.filter((lease: any) => leaseIds.has(String(lease.id || '')))
  }

  function getScopedMeters(): any[] {
    const meterRows = asArray(meters)
    if (userIsSuperAdmin || userIsCompanyAdmin) return meterRows

    const { meterIds } = buildScopedHierarchyIds()
    return meterRows.filter((meter: any) => meterIds.has(String(meter.id || '')))
  }

  function getVisibleSegments(areaId: string) {
    if (!areaId) return []
    if (!userCanAccessArea(areaId)) return []

    const areaIds = new Set([String(areaId)])
    const { segmentIds } = buildScopedHierarchyIds(areaIds)
    const rows = getScopedSegments().filter((segment: any) =>
      segmentIds.has(String(segment.id || '')) || String(segment.area_id || '') === String(areaId)
    )

    return rows.sort((a: any, b: any) =>
      String(a.segment_name || a.name || '').localeCompare(String(b.segment_name || b.name || ''))
    )
  }

  function sortLeasesForDropdown(rows: any[]) {
    return asArray(rows).sort((a: any, b: any) =>
      String(a.lease_name || a.name || a.lease_number || '').localeCompare(String(b.lease_name || b.name || b.lease_number || ''))
    )
  }

  function sortMetersForDropdown(rows: any[]) {
    return asArray(rows).sort((a: any, b: any) =>
      String(a.meter_number || a.meter_name || '').localeCompare(String(b.meter_number || b.meter_name || ''))
    )
  }

  function getVisibleLeases(segmentId: string) {
    if (!segmentId) return []

    const scopedLeaseRows = getScopedLeases()
    const selectedSegmentRow: any = asArray(segments).find((segment: any) => String(segment.id || '') === String(segmentId))
    const selectedSegmentName = String(selectedSegmentRow?.segment_name || selectedSegmentRow?.name || '').trim().toLowerCase()

    // Primary behavior: selecting a segment only shows leases linked to that segment.
    const exactSegmentMatches = scopedLeaseRows.filter((lease: any) => String(lease.segment_id || '') === String(segmentId))
    if (exactSegmentMatches.length > 0) return sortLeasesForDropdown(exactSegmentMatches)

    // Legacy data safety: support old rows that stored the segment name instead of segment_id.
    // Do NOT fall back to all leases here, because that defeats segment segregation.
    const nameMatches = selectedSegmentName
      ? scopedLeaseRows.filter((lease: any) => {
          const leaseSegmentName = String(
            lease.segment_name || lease.segment || lease.route_segment || lease.system_segment || ''
          ).trim().toLowerCase()
          return leaseSegmentName === selectedSegmentName
        })
      : []

    return sortLeasesForDropdown(nameMatches)
  }

  function getVisibleMeters(leaseId: string) {
    if (!leaseId) return []

    const scopedMeterRows = getScopedMeters()

    // Primary behavior: selecting a lease only shows meters linked to that lease.
    const exactLeaseMatches = scopedMeterRows.filter((meter: any) => String(meter.lease_id || '') === String(leaseId))
    if (exactLeaseMatches.length > 0) return sortMetersForDropdown(exactLeaseMatches)

    // Legacy data safety: support old rows that stored the lease name/number instead of lease_id.
    // Do NOT fall back to all meters here, because that defeats lease segregation.
    const selectedLeaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(leaseId))
    const selectedLeaseName = String(selectedLeaseRow?.lease_name || selectedLeaseRow?.name || '').trim().toLowerCase()
    const selectedLeaseNumber = String(selectedLeaseRow?.lease_number || '').trim().toLowerCase()

    const nameMatches = scopedMeterRows.filter((meter: any) => {
      const meterLeaseName = String(meter.lease_name || meter.lease || meter.lease_number || '').trim().toLowerCase()
      return Boolean(meterLeaseName) && (meterLeaseName === selectedLeaseName || meterLeaseName === selectedLeaseNumber)
    })

    return sortMetersForDropdown(nameMatches)
  }

  function getScopedReadings(): any[] {
    const readingRows = asArray(readings)
    if (userIsSuperAdmin || userIsCompanyAdmin) return readingRows

    const areaIds = new Set(getScopedAreas().map((area: any) => String(area.id)))
    const meterIds = new Set(getScopedMeters().map((meter: any) => String(meter.id)))
    const leaseIds = new Set(getScopedLeases().map((lease: any) => String(lease.id)))

    return readingRows.filter((reading: any) =>
      areaIds.has(String(reading.area_id || '')) ||
      meterIds.has(String(reading.meter_id || '')) ||
      leaseIds.has(String(reading.lease_id || ''))
    )
  }

  function getScopedTickets(): any[] {
    const ticketRows = asArray(tickets)
    if (userIsSuperAdmin || userIsCompanyAdmin) return ticketRows

    const areaIds = new Set(getScopedAreas().map((area: any) => String(area.id)))
    const segmentIds = new Set(getScopedSegments().map((segment: any) => String(segment.id)))
    const leaseIds = new Set(getScopedLeases().map((lease: any) => String(lease.id)))
    const meterIds = new Set(getScopedMeters().map((meter: any) => String(meter.id)))

    return ticketRows.filter((ticket: any) =>
      areaIds.has(String(ticket.area_id || ticket.observed_inputs?.area_id || '')) ||
      segmentIds.has(String(ticket.segment_id || ticket.observed_inputs?.segment_id || '')) ||
      leaseIds.has(String(ticket.lease_id || ticket.observed_inputs?.lease_id || '')) ||
      meterIds.has(String(ticket.meter_id || ticket.observed_inputs?.meter_id || ''))
    )
  }

  function getScopedPotQuality(): any[] {
    const rows = asArray(potQuality)
    if (userIsSuperAdmin || userIsCompanyAdmin) return rows

    const areaIds = new Set(getScopedAreas().map((area: any) => String(area.id)))
    const segmentIds = new Set(getScopedSegments().map((segment: any) => String(segment.id)))
    const leaseIds = new Set(getScopedLeases().map((lease: any) => String(lease.id)))

    return rows.filter((pot: any) =>
      areaIds.has(String(pot.area_id || '')) ||
      segmentIds.has(String(pot.segment_id || '')) ||
      leaseIds.has(String(pot.lease_id || ''))
    )
  }

  function getScopedProvings(): any[] {
    const rows = asArray(provings)
    if (userIsSuperAdmin || userIsCompanyAdmin) return rows

    const areaIds = new Set(getScopedAreas().map((area: any) => String(area.id)))
    const leaseIds = new Set(getScopedLeases().map((lease: any) => String(lease.id)))
    const meterIds = new Set(getScopedMeters().map((meter: any) => String(meter.id)))

    return rows.filter((proving: any) =>
      areaIds.has(String(proving.area_id || '')) ||
      leaseIds.has(String(proving.lease_id || '')) ||
      meterIds.has(String(proving.meter_id || ''))
    )
  }

  function getAreaAccessDebugText() {
    if (userIsSuperAdmin || userIsCompanyAdmin) return 'Admin view: all areas'
    const uid = getCurrentAuthUserIdForAreaAccess()
    const allowed = getScopedAreas().map((area: any) => area.name || area.area_name || area.id).join(', ')
    return `User ${uid || 'unknown'} allowed areas: ${allowed || 'none assigned'}`
  }

  function getAreaAccessUsers() {
    const activeCompany = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    return asArray(allUserRoles.length ? allUserRoles : userRoles)
      .filter((role: any) => {
        const rowCompanyId = role.company_id || role.companyId
        return !activeCompany || !rowCompanyId || String(rowCompanyId) === String(activeCompany)
      })
      .filter((role: any) => role.active !== false)
  }

  function toggleAccessArea(areaId: string) {
    setSelectedAccessAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    )
  }

  function beginEditAreaAccess(userId: string) {
    setSelectedAccessUserId(userId)

    const current = userAreaAccess
      .filter((row: any) => String(row.user_id || row.profile_id || '') === String(userId))
      .map((row: any) => String(row.area_id))

    setSelectedAccessAreaIds(current)
  }


  async function saveSegmentAreaLink() {
    if (!hierarchySegmentId || !hierarchyAreaId) {
      alert('Select a segment and area first.')
      return
    }

    const { error } = await supabase
      .from('segments')
      .update({ area_id: hierarchyAreaId })
      .eq('id', hierarchySegmentId)

    if (error) {
      alert('Could not save segment area: ' + error.message)
      return
    }

    await loadAll()
    setHierarchySegmentId('')
    setHierarchyAreaId('')
    alert('Segment assigned to area.')
  }

  async function saveLeaseSegmentLink() {
    if (!hierarchyLeaseId || !hierarchyLeaseSegmentId) {
      alert('Select a lease and segment first.')
      return
    }

    const selectedSegment = segments.find((s: any) => String(s.id) === String(hierarchyLeaseSegmentId))

    const { error } = await supabase
      .from('leases')
      .update({
        segment_id: hierarchyLeaseSegmentId,
        area_id: (selectedSegment as any)?.area_id || null,
      })
      .eq('id', hierarchyLeaseId)

    if (error) {
      alert('Could not save lease segment: ' + error.message)
      return
    }

    await loadAll()
    setHierarchyLeaseId('')
    setHierarchyLeaseSegmentId('')
    alert('Lease assigned to segment.')
  }

  async function saveMeterLeaseLink() {
    if (!hierarchyMeterId || !hierarchyMeterLeaseId) {
      alert('Select a meter and lease first.')
      return
    }

    const selectedLease = leases.find((l: any) => String(l.id) === String(hierarchyMeterLeaseId))

    const { error } = await supabase
      .from('meters')
      .update({
        lease_id: hierarchyMeterLeaseId,
        segment_id: (selectedLease as any)?.segment_id || null,
        area_id: (selectedLease as any)?.area_id || null,
      })
      .eq('id', hierarchyMeterId)

    if (error) {
      alert('Could not save meter lease: ' + error.message)
      return
    }

    await loadAll()
    setHierarchyMeterId('')
    setHierarchyMeterLeaseId('')
    alert('Meter assigned to lease.')
  }

  async function saveUserAreaAccess() {
    if (!selectedAccessUserId) {
      alert('Select a user first.')
      return
    }

    const activeAreaCompanyId = (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId)

    if (!(userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId)) {
      alert('No company selected.')
      return
    }

    const { error: deleteError } = await supabase
      .from('user_area_access')
      .delete()
      .eq('company_id', (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId))
      .eq('user_id', selectedAccessUserId)

    if (deleteError) {
      alert('Could not clear old area access: ' + deleteError.message)
      return
    }

    if (selectedAccessAreaIds.length) {
      const inserts = selectedAccessAreaIds.map((areaId) => ({
        company_id: (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId),
        user_id: selectedAccessUserId,
        area_id: areaId,
      }))

      const { error: insertError } = await supabase.from('user_area_access').insert(inserts)

      if (insertError) {
        alert('Could not save area access: ' + insertError.message)
        return
      }
    }

    await loadAll()
    alert('Area access saved.')
  }
function handleTicketAreaSelect(areaId: string) {
    setSelectedTicketArea(areaId)
    setSelectedSegment('')
    setSelectedLease('')
    setSelectedMeter('')
    setSelectedProducer('')
  }

  function handleTicketSegmentSelect(segmentId: string) {
    setSelectedSegment(segmentId)
    setSelectedLease('')
    setSelectedMeter('')
    setSelectedProducer('')
  }

  function handleTicketLeaseSelect(leaseId: string) {
    setSelectedLease(leaseId)

    const leaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(leaseId))
    const leaseMeters = getVisibleMeters(leaseId)
    const onlyMeter: any = leaseMeters.length === 1 ? leaseMeters[0] : null
    const producerKey = leaseRow?.producer_id || onlyMeter?.producer_id || leaseRow?.producer || leaseRow?.producer_name || onlyMeter?.producer || onlyMeter?.producer_name || ''
    const producerRow: any = asArray(producers).find((producer: any) => {
      const producerId = String(producer.id || '').trim()
      const producerName = String(producer.name || (producer as any).producer_name || '').trim().toLowerCase()
      const key = String(producerKey || '').trim()
      return (producerId && producerId === key) || (producerName && producerName === key.toLowerCase())
    })
    setSelectedProducer(producerRow?.id ? String(producerRow.id) : (producerKey ? String(producerKey) : ''))

    setSelectedMeter(onlyMeter ? String(onlyMeter.id) : '')
  }

function handleReadingAreaSelect(areaId: string) {
    setSelectedReadingArea(areaId)
    setSelectedReadingSegment('')
    setSelectedReadingLease('')
    setSelectedReadingMeter('')
  }

  function handleReadingSegmentSelect(segmentId: string) {
    setSelectedReadingSegment(segmentId)
    setSelectedReadingLease('')
    setSelectedReadingMeter('')
  }

  function handleReadingLeaseSelect(leaseId: string) {
    setSelectedReadingLease(leaseId)

    const leaseMeters = getVisibleMeters(leaseId)

    if (leaseMeters.length === 1) {
      setSelectedReadingMeter(leaseMeters[0].id)
      autofillOpeningReadingForLease(leaseId, leaseMeters[0].id)
    } else {
      setSelectedReadingMeter('')
      autofillOpeningReadingForLease(leaseId)
    }
  }


  function getPreviousClosingReadingForLease(leaseId: string, meterId = '') {
    const pickNumber = (...values: any[]) => {
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        const n = Number(value)
        if (Number.isFinite(n)) return n
      }
      return null
    }

    const getTicketCloseMs = (ticket: any) => {
      const observed = ticket?.observed_inputs || {}
      const calc = ticket?.calculation_results || {}
      const closeDateTime =
        observed.close_datetime ||
        calc.close_datetime ||
        ticket.close_datetime ||
        observed.closing_datetime ||
        ticket.closing_datetime
      if (closeDateTime) return new Date(closeDateTime).getTime()

      const closeDate = observed.close_date || calc.close_date || ticket.close_date || observed.closing_date || ticket.closing_date
      const closeTime = observed.close_time || calc.close_time || ticket.close_time || observed.closing_time || ticket.closing_time
      const localClose = makeLocalDateTime(closeDate, closeTime)
      if (localClose) return localClose.getTime()

      return new Date(ticket.approved_at || ticket.updated_at || ticket.created_at || 0).getTime()
    }

    // Preferred source: last ticket close for this lease/meter.
    // This lets back-entered monthly tickets feed the next Operator Reading opening.
    const matchingTickets = (Array.isArray(tickets) ? tickets : [])
      .filter((ticket: any) => {
        const status = String(ticket.status || 'draft').toLowerCase()
        const observed = ticket?.observed_inputs || {}
        const sameLease = leaseId && (
          String(ticket.lease_id || '') === String(leaseId) ||
          String(observed.lease_id || '') === String(leaseId)
        )
        const sameMeter = meterId ? (
          String(ticket.meter_id || '') === String(meterId) ||
          String(observed.meter_id || '') === String(meterId)
        ) : true
        const close = pickNumber(
          (ticket as any).closing_reading,
          (ticket as any).closing_meter_reading,
          observed.closing_reading,
          observed.closing_meter_reading,
          observed.close_reading,
          observed.close_meter_reading,
          observed.close_meter,
          (ticket as any).close_reading,
          (ticket as any).close_meter_reading,
          (ticket as any).close_meter,
          ticket.calculation_results?.closing_reading,
          ticket.calculation_results?.closing_meter_reading
        )
        return sameLease && sameMeter && ['approved', 'submitted', 'draft'].includes(status) && close !== null
      })
      .sort((a: any, b: any) => getTicketCloseMs(b) - getTicketCloseMs(a))

    const latestTicket = matchingTickets[0]
    if (latestTicket) {
      const observed = latestTicket.observed_inputs || {}
      const calc = latestTicket.calculation_results || {}
      const ticketClose = pickNumber(
        (latestTicket as any).closing_reading,
        (latestTicket as any).closing_meter_reading,
        observed.closing_reading,
        observed.closing_meter_reading,
        observed.close_reading,
        observed.close_meter_reading,
        observed.close_meter,
        (latestTicket as any).close_reading,
        (latestTicket as any).close_meter_reading,
        (latestTicket as any).close_meter,
        calc.closing_reading,
        calc.closing_meter_reading
      )
      if (ticketClose !== null) return ticketClose
    }

    // Fallback source: previous operator reading close.
    const readingRows = typeof readings !== 'undefined' ? readings : []
    const matchingRows = (readingRows || [])
      .filter((row: any) => {
        const sameLease = leaseId && String(row.lease_id || '') === String(leaseId)
        const sameMeter = meterId ? String(row.meter_id || '') === String(meterId) : true
        const close = pickNumber(row.closing_reading, row.closing_meter_reading, row.close_reading)
        return sameLease && sameMeter && close !== null
      })
      .sort((a: any, b: any) => {
        const ad = new Date(a.reading_date || a.created_at || 0).getTime()
        const bd = new Date(b.reading_date || b.created_at || 0).getTime()
        return bd - ad
      })

    const previousReadingClose = pickNumber(
      matchingRows[0]?.closing_reading,
      matchingRows[0]?.closing_meter_reading,
      matchingRows[0]?.close_reading
    )
    return previousReadingClose ?? ''
  }

  function autofillOpeningReadingForLease(leaseId: string, meterId = '') {
    const previousClosing = getPreviousClosingReadingForLease(leaseId, meterId)
    if (previousClosing !== '' && previousClosing !== null && previousClosing !== undefined) {
      setReadingOpen(String(previousClosing))
    }
  }

  function getSelectedReadingMeterNumber() {
    const meter = meters.find((m: any) => String(m.id) === String(selectedReadingMeter))
    return meter?.meter_number || meter?.meter_name || ''
  }

  function getPotPhotosForPot(potId: string) {
    if (!potId) return []
    return potShakeoutPhotos.filter((photo: any) => String(photo.pot_quality_id || photo.pot_id || '') === String(potId))
  }

  function getPotPhotosForLease(leaseId: string) {
    if (!leaseId) return []
    return potShakeoutPhotos
      .filter((photo: any) => String(photo.lease_id || '') === String(leaseId))
      .slice(0, 12)
  }

  function getReadingPhotosForLease(leaseId: string) {
    if (!leaseId) return []
    return readingPhotos
      .filter((photo: any) => String(photo.lease_id || '') === String(leaseId))
      .slice(0, 12)
  }

  function safePhotoFileName(file: File) {
    return String(file.name || 'photo.jpg')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120)
  }


  function clearReadingForm() {
    setEditingReadingId('')
    setSelectedReadingArea('')
    setSelectedReadingSegment('')
    setSelectedReadingLease('')
    setSelectedReadingMeter('')
    setReadingOpen('')
    setReadingClose('')
    setReadingGravity('')
    setReadingTemp('')
    setReadingAvgTemp('')
    setReadingAvgPressure('')
    setReadingBSW('')
    setReadingMF('')
    setReadingPhotoFiles([])
  }

  function editOperatorReading(row: any) {
    if (!row?.id) return

    const segmentId = String(row.segment_id || '')
    const leaseId = String(row.lease_id || '')
    const meterId = String(row.meter_id || '')
    const segmentRow: any = asArray(segments).find((s: any) => String(s.id || '') === segmentId)
    const areaId = String(row.area_id || segmentRow?.area_id || '')

    setEditingReadingId(String(row.id))
    setSelectedReadingArea(areaId)
    setSelectedReadingSegment(segmentId)
    setSelectedReadingLease(leaseId)
    setSelectedReadingMeter(meterId)
    setReadingOpen(String(row.opening_reading ?? row.opening_meter_reading ?? row.open_reading ?? ''))
    setReadingClose(String(row.closing_reading ?? row.closing_meter_reading ?? row.close_reading ?? ''))
    setReadingAvgTemp(String(row.average_temperature ?? row.avg_temp ?? ''))
    setReadingAvgPressure(String(row.average_pressure ?? row.avg_pressure ?? ''))
    setReadingMF(String(row.meter_factor ?? row.mf ?? ''))
    setReadingTab('new')
  }

  async function deleteOperatorReading(row: any) {
    if (!row?.id) return
    if (!confirm('Delete this operator reading?')) return

    const { error } = await supabase.from('operator_readings').delete().eq('id', row.id)
    if (error) {
      alert('Could not delete reading: ' + error.message)
      return
    }

    if (String(editingReadingId) === String(row.id)) clearReadingForm()
    loadAll()
  }

  async function uploadReadingPhotosForReading(readingId: string) {
    if (!readingId || readingPhotoFiles.length === 0) return
    setReadingPhotoUploading(true)
    try {
      const uploadedRows: any[] = []
      for (const file of readingPhotoFiles) {
        const path = `${companyId}/${selectedReadingLease || 'unassigned'}/${readingId}/${Date.now()}-${safePhotoFileName(file)}`
        const { error: uploadError } = await supabase.storage
          .from('reading-photos')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('reading-photos').getPublicUrl(path)
        uploadedRows.push({
          company_id: companyId,
          area_id: selectedReadingArea || null,
          segment_id: selectedReadingSegment || null,
          lease_id: selectedReadingLease || null,
          meter_id: selectedReadingMeter || null,
          reading_id: readingId,
          file_name: file.name,
          file_path: path,
          public_url: urlData?.publicUrl || '',
          content_type: file.type || 'image/jpeg',
          size_bytes: file.size || 0,
        })
      }

      if (uploadedRows.length) {
        const { error: insertError } = await supabase.from('operator_reading_photos').insert(uploadedRows)
        if (insertError) throw insertError
      }
      setReadingPhotoFiles([])
    } catch (error: any) {
      console.error('Reading photo upload failed:', error)
      alert(`Reading saved, but photo upload failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setReadingPhotoUploading(false)
    }
  }

  async function saveReading() {
    if (isReadOnly) {
      alert('System is in read-only auditor mode.')
      return
    }

    if (!companyId) return

    const iv = Number(readingClose || 0) - Number(readingOpen || 0)
    const readingPayload: any = {
      company_id: companyId,
      area_id: selectedReadingArea || null,
      segment_id: selectedReadingSegment || null,
      lease_id: selectedReadingLease || null,
      meter_id: selectedReadingMeter || null,
      movement_type: getSelectedReadingMovementType(),
      opening_reading: Number(readingOpen || 0),
      closing_reading: Number(readingClose || 0),
      indicated_volume: iv,
      average_temperature: Number(readingAvgTemp || 0),
      average_pressure: Number(readingAvgPressure || 0),
      meter_factor: Number(readingMF || 0),
    }

    let savedReading: any = null
    let readingSaveError: any = null

    if (editingReadingId) {
      const result = await supabase
        .from('operator_readings')
        .update(readingPayload)
        .eq('id', editingReadingId)
        .select('id')
        .single()
      savedReading = result.data
      readingSaveError = result.error
    } else {
      const result = await supabase
        .from('operator_readings')
        .insert(readingPayload)
        .select('id')
        .single()
      savedReading = result.data
      readingSaveError = result.error
    }

    if (readingSaveError) {
      alert(`Could not save reading: ${readingSaveError.message}`)
      return
    }

    await uploadReadingPhotosForReading(savedReading?.id || editingReadingId)

    clearReadingForm()
    loadAll()
  }

  function handlePotAreaSelect(areaId: string) {
    setSelectedPotArea(areaId)
    setSelectedPotSegment('')
    setSelectedPotLease('')
    setSelectedPotMeter('')
  }

  function handlePotSegmentSelect(segmentId: string) {
    setSelectedPotSegment(segmentId)
    setPotSegment(segmentId)
    setSelectedPotLease('')
    setPotLease('')
    setSelectedPotMeter('')
  }

  function handlePotLeaseSelect(leaseId: string) {
    setSelectedPotLease(leaseId)
    setPotLease(leaseId)

    const leaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(leaseId))
    setPotProducer(leaseRow?.producer_id ? String(leaseRow.producer_id) : '')

    const leaseMeters = getVisibleMeters(leaseId)
    setSelectedPotMeter(leaseMeters.length === 1 ? String(leaseMeters[0].id) : '')
  }

  function parsePotExtra(notes: any, key: 'rvp' | 'sulfur' | 'sulphur') {
    const match = String(notes || '').match(new RegExp(`(?:^|\\n)${key.toUpperCase()}:\\s*([^\\n]+)`, 'i'))
    return match ? match[1].trim() : ''
  }

  function cleanPotNotes(notes: any) {
    return String(notes || '')
      .split('\n')
      .filter((line) => !/^\s*(RVP|SULFUR)\s*:/i.test(line))
      .join('\n')
      .trim()
  }

  function buildPotNotesWithExtras(notes: string, rvp: string, sulfur: string) {
    const lines = []
    if (String(rvp || '').trim()) lines.push(`RVP: ${String(rvp).trim()}`)
    if (String(sulfur || '').trim()) lines.push(`Sulfur: ${String(sulfur).trim()}`)
    const cleaned = cleanPotNotes(notes)
    if (cleaned) lines.push(cleaned)
    return lines.join('\n')
  }

  function clearPotForm() {
    const defaultAreaId = getDefaultVisibleAreaId()
    setEditingPotId('')
    setSelectedPotArea(defaultAreaId)
    setSelectedPotSegment('')
    setSelectedPotLease('')
    setSelectedPotMeter('')
    setPotSegment('')
    setPotProducer('')
    setPotLease('')
    setPotDate('')
    setPotGravity('')
    setPotBSW('')
    setPotTemp('')
    setPotRvp('')
    setPotSulfur('')
    setPotNotes('')
    setPotShakeoutPhotoFiles([])
  }

  function editPotQuality(p: any) {
    const meterId = String(p?.meter_id || p?.meterId || '')
    const meterRow: any = asArray(meters).find((meter: any) => String(meter.id || '') === meterId)
    const leaseId = String(p?.lease_id || p?.leaseId || meterRow?.lease_id || '')
    const leaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === leaseId)
    const segmentId = String(p?.segment_id || p?.segmentId || leaseRow?.segment_id || '')
    const segmentRow: any = asArray(segments).find((segment: any) => String(segment.id || '') === segmentId)
    const areaId = String(p?.area_id || p?.areaId || segmentRow?.area_id || '')

    setEditingPotId(String(p.id || ''))
    setSelectedPotArea(areaId)
    setSelectedPotSegment(segmentId)
    setSelectedPotLease(leaseId)
    setSelectedPotMeter(meterId || '')
    setPotSegment(segmentId)
    setPotLease(leaseId)
    setPotProducer(String(p?.producer_id || leaseRow?.producer_id || ''))
    setPotDate(String(p?.sample_date || '').slice(0, 10))
    setPotGravity(String(p?.observed_api_gravity ?? p?.api_gravity ?? ''))
    setPotTemp(String(p?.observed_temperature ?? p?.sample_temperature ?? ''))
    setPotRvp(String(((p as any)?.rvp ?? parsePotExtra(p?.notes, 'rvp')) || ''))
    setPotSulfur(String(((p as any)?.sulfur ?? parsePotExtra(p?.notes, 'sulfur')) || ''))
    const bswValue = getPotBswPercentValue(p)
    setPotBSW(bswValue === null ? '' : String(Number(bswValue.toFixed(4))))
    setPotNotes(cleanPotNotes(p?.notes))
    setPotTab('create')
  }

  async function deletePotQuality(p: any) {
    if (!p?.id) return
    if (!confirm('Delete this POT quality record?')) return

    const { error } = await supabase.from('pot_quality').delete().eq('id', p.id)
    if (error) {
      alert('Could not delete POT quality: ' + error.message)
      return
    }

    if (String(editingPotId) === String(p.id)) clearPotForm()
    loadAll()
  }

  async function uploadPotShakeoutPhotosForPot(potId: string) {
    if (!potId || potShakeoutPhotoFiles.length === 0) return
    setPotPhotoUploading(true)

    try {
      const uploadedRows: any[] = []
      for (const file of potShakeoutPhotoFiles) {
        const path = `${companyId}/${selectedPotLease || 'unassigned'}/${potId}/${Date.now()}-${safePhotoFileName(file)}`
        const { error: uploadError } = await supabase.storage
          .from('pot-shakeout-photos')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('pot-shakeout-photos').getPublicUrl(path)
        uploadedRows.push({
          company_id: companyId,
          area_id: effectivePotAreaId || null,
          segment_id: selectedPotSegment || null,
          producer_id: potProducer || null,
          lease_id: selectedPotLease || null,
          meter_id: selectedPotMeter || null,
          pot_quality_id: potId,
          photo_type: 'shakeout',
          file_name: file.name,
          file_path: path,
          public_url: urlData?.publicUrl || '',
          content_type: file.type || 'image/jpeg',
          size_bytes: file.size || 0,
        })
      }

      if (uploadedRows.length) {
        const { error: insertError } = await supabase.from('pot_quality_photos').insert(uploadedRows)
        if (insertError) throw insertError
      }

      setPotShakeoutPhotoFiles([])
    } catch (error: any) {
      console.error('POT shakeout photo upload failed:', error)
      alert(`POT saved, but shakeout photo upload failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setPotPhotoUploading(false)
    }
  }

  async function savePotQuality() {
    if (!companyId || !effectivePotAreaId || !selectedPotSegment || !selectedPotLease || !potDate) {
      alert('Select area, segment, lease, and sample date first.')
      return
    }

    const bswNumber = Number(potBSW || 0)
    const csw = 1 - bswNumber / 100

    const apiGravity60 = Number(
      calculateApi11Corrections({
        productGroup: 'crude',
        observedApiGravity: Number(potGravity || 0),
        observedTemperature: Number(potTemp || 60),
        observedPressure: 0,
        averageTemperature: Number(potTemp || 60),
        averagePressure: 0,
      }).api_gravity_60
    )

    const potPayload = {
      company_id: companyId,
      area_id: effectivePotAreaId || null,
      segment_id: selectedPotSegment || null,
      producer_id: potProducer || null,
      lease_id: selectedPotLease || null,
      sample_date: potDate,
      api_gravity: apiGravity60,
      observed_api_gravity: Number(potGravity || 0),
      observed_temperature: Number(potTemp || 0),
      api_gravity_60: apiGravity60,
      bsw: bswNumber,
      csw,
      sample_temperature: Number(potTemp || 0),
      notes: buildPotNotesWithExtras(potNotes, potRvp, potSulfur),
    }

    let savedPotId = editingPotId
    const result = editingPotId
      ? await supabase.from('pot_quality').update(potPayload).eq('id', editingPotId).select('id').single()
      : await supabase.from('pot_quality').insert(potPayload).select('id').single()

    if (result.error) {
      alert('Could not save POT quality: ' + result.error.message)
      return
    }

    savedPotId = result.data?.id || savedPotId

    if (savedPotId && potShakeoutPhotoFiles.length > 0) {
      await uploadPotShakeoutPhotosForPot(savedPotId)
    }

    const wasEditingPot = Boolean(editingPotId)
    clearPotForm()
    alert(wasEditingPot ? 'POT quality updated.' : 'POT quality saved.')
    loadAll()
  }

  function sanitizeFileName(value: any, fallback = 'file') {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return cleaned || fallback
  }

  function bytesFromBase64(base64: string) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  function concatBytes(parts: Uint8Array[]) {
    const length = parts.reduce((sum, part) => sum + part.length, 0)
    const output = new Uint8Array(length)
    let offset = 0
    for (const part of parts) {
      output.set(part, offset)
      offset += part.length
    }
    return output
  }

  async function imageFileToJpeg(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
    const objectUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Could not read image'))
        img.src = objectUrl
      })

      // Browser-only document scan approximation: find the bright report page,
      // crop away background, then enhance to a high-contrast grayscale image.
      // This keeps proving reports looking like scanned pages without adding new dependencies.
      const maxWidth = 1800
      const maxHeight = 2400
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))

      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = width
      sourceCanvas.height = height
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
      if (!sourceCtx) throw new Error('Could not create scan canvas')
      sourceCtx.fillStyle = '#ffffff'
      sourceCtx.fillRect(0, 0, width, height)
      sourceCtx.drawImage(image, 0, 0, width, height)

      let cropX = 0
      let cropY = 0
      let cropW = width
      let cropH = height

      try {
        const sourceData = sourceCtx.getImageData(0, 0, width, height)
        const data = sourceData.data
        const rowCounts = new Array(height).fill(0)
        const colCounts = new Array(width).fill(0)

        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            const i = (y * width + x) * 4
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const max = Math.max(r, g, b)
            const min = Math.min(r, g, b)
            const brightness = (r + g + b) / 3
            const looksLikePaper = brightness > 118 && max - min < 70
            if (looksLikePaper) {
              rowCounts[y] += 1
              colCounts[x] += 1
            }
          }
        }

        const rowThreshold = Math.max(6, Math.floor(width * 0.025))
        const colThreshold = Math.max(6, Math.floor(height * 0.025))
        let top = 0
        let bottom = height - 1
        let left = 0
        let right = width - 1

        while (top < height - 1 && rowCounts[top] < rowThreshold) top += 1
        while (bottom > 0 && rowCounts[bottom] < rowThreshold) bottom -= 1
        while (left < width - 1 && colCounts[left] < colThreshold) left += 1
        while (right > 0 && colCounts[right] < colThreshold) right -= 1

        const pad = Math.round(Math.min(width, height) * 0.018)
        const detectedW = right - left
        const detectedH = bottom - top
        if (detectedW > width * 0.35 && detectedH > height * 0.35) {
          cropX = Math.max(0, left - pad)
          cropY = Math.max(0, top - pad)
          cropW = Math.min(width - cropX, detectedW + pad * 2)
          cropH = Math.min(height - cropY, detectedH + pad * 2)
        }
      } catch (scanError) {
        console.warn('Scan crop fallback used:', scanError)
      }

      const outCanvas = document.createElement('canvas')
      const targetW = 1650
      const targetH = Math.max(1, Math.round((cropH / cropW) * targetW))
      outCanvas.width = targetW
      outCanvas.height = targetH
      const outCtx = outCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
      if (!outCtx) throw new Error('Could not create scanned output canvas')
      outCtx.fillStyle = '#ffffff'
      outCtx.fillRect(0, 0, targetW, targetH)
      outCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH)

      const imageData = outCtx.getImageData(0, 0, targetW, targetH)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        // push paper toward white and text toward dark, while preserving fine print
        let enhanced = (gray - 128) * 1.85 + 150
        if (enhanced > 218) enhanced = 255
        if (enhanced < 52) enhanced = 0
        enhanced = Math.max(0, Math.min(255, enhanced))
        d[i] = enhanced
        d[i + 1] = enhanced
        d[i + 2] = enhanced
        d[i + 3] = 255
      }
      outCtx.putImageData(imageData, 0, 0)

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92)
      return { bytes: bytesFromBase64(dataUrl.split(',')[1] || ''), width: targetW, height: targetH }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  async function buildPdfFromImages(files: File[], title = 'Proving Report') {
    const encoder = new TextEncoder()
    const pageWidth = 612
    const pageHeight = 792
    const margin = 24
    const images = [] as Array<{ bytes: Uint8Array; width: number; height: number }>

    for (const file of files) images.push(await imageFileToJpeg(file))

    const objectParts: Uint8Array[] = []
    const offsets: number[] = []
    let currentOffset = 0
    const addChunk = (chunk: Uint8Array) => { objectParts.push(chunk); currentOffset += chunk.length }
    const addText = (text: string) => addChunk(encoder.encode(text))
    const addObject = (number: number, body: Uint8Array | string) => {
      offsets[number] = currentOffset
      addText(`${number} 0 obj\n`)
      if (typeof body === 'string') addText(body)
      else addChunk(body)
      addText('\nendobj\n')
    }

    const pageObjectNumbers = images.map((_, index) => 3 + index * 3)
    const pagesKids = pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')

    addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
    addObject(1, '<< /Type /Catalog /Pages 2 0 R >>')
    addObject(2, `<< /Type /Pages /Kids [${pagesKids}] /Count ${images.length} >>`)

    images.forEach((img, index) => {
      const pageObj = 3 + index * 3
      const contentObj = pageObj + 1
      const imageObj = pageObj + 2
      const drawScale = Math.min((pageWidth - margin * 2) / img.width, (pageHeight - margin * 2) / img.height)
      const drawWidth = img.width * drawScale
      const drawHeight = img.height * drawScale
      const x = (pageWidth - drawWidth) / 2
      const y = (pageHeight - drawHeight) / 2
      const imageName = `Im${index + 1}`
      const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/${imageName} Do\nQ`

      addObject(pageObj, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`)
      addObject(contentObj, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`)
      const header = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`)
      const footer = encoder.encode('\nendstream')
      addObject(imageObj, concatBytes([header, img.bytes, footer]))
    })

    const xrefOffset = currentOffset
    addText(`xref\n0 ${offsets.length}\n`)
    addText('0000000000 65535 f \n')
    for (let i = 1; i < offsets.length; i += 1) {
      addText(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`)
    }
    addText(`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info << /Title (${title.replace(/[()\\]/g, '')}) >> >>\nstartxref\n${xrefOffset}\n%%EOF`)

    const pdfBytes = concatBytes(objectParts)
    const pdfArrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer
    return new Blob([pdfArrayBuffer], { type: 'application/pdf' })
  }

  async function uploadProvingOriginalPhotos(provingId: string, files: File[]) {
    if (!companyId || files.length === 0) return

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const safeName = sanitizeFileName(file.name || `photo-${index + 1}.jpg`)
      const photoPath = `${companyId}/${provingId}/original-photos/${Date.now()}-${index + 1}-${safeName}`
      const { error } = await supabase.storage
        .from('proving-reports')
        .upload(photoPath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' })

      if (!error) {
        const { error: insertError } = await supabase.from('proving_report_photos').insert({
          company_id: companyId,
          proving_id: provingId,
          area_id: selectedProvingArea || null,
          segment_id: selectedProvingSegment || null,
          lease_id: selectedProvingLease || null,
          meter_id: provingMeter || null,
          file_path: photoPath,
          file_name: file.name || safeName,
          content_type: file.type || 'image/jpeg',
          photo_order: index + 1,
        })
        if (insertError) console.warn('Could not save proving photo row:', insertError.message)
      } else {
        console.warn('Could not upload proving photo:', error.message)
      }
    }
  }

  async function uploadProvingPdf(provingId: string) {
    if (!companyId) return { pdfUrl: null, fileName: null }

    const selectedMeter = meters.find((m: any) => String(m.id) === String(provingMeter))
    const baseFileName = `${sanitizeFileName(selectedMeter?.meter_number || 'meter')}_${sanitizeFileName(provingDate || new Date().toISOString().slice(0, 10))}`

    if (provingPdfFile) {
      const safeName = sanitizeFileName(provingPdfFile.name || `${baseFileName}.pdf`)
      const filePath = `${companyId}/${provingId}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage
        .from('proving-reports')
        .upload(filePath, provingPdfFile, { cacheControl: '3600', upsert: true, contentType: 'application/pdf' })

      if (error) {
        alert('PDF upload failed: ' + error.message)
        return { pdfUrl: null, fileName: null }
      }

      return { pdfUrl: filePath, fileName: safeName }
    }

    if (provingPhotoFiles.length > 0) {
      const pdfBlob = await buildPdfFromImages(provingPhotoFiles, 'Proving Report')
      const fileName = `${baseFileName}_proving_report.pdf`
      const filePath = `${companyId}/${provingId}/${Date.now()}-${fileName}`
      const { error } = await supabase.storage
        .from('proving-reports')
        .upload(filePath, pdfBlob, { cacheControl: '3600', upsert: true, contentType: 'application/pdf' })

      if (error) {
        alert('Proving photo PDF upload failed: ' + error.message)
        return { pdfUrl: null, fileName: null }
      }

      await uploadProvingOriginalPhotos(provingId, provingPhotoFiles)
      return { pdfUrl: filePath, fileName }
    }

    return { pdfUrl: null, fileName: null }
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

  function getSegmentProvingSetting(segmentId: string) {
    return segmentProvingSettings.find((setting: any) => String(setting.segment_id) === String(segmentId)) || null
  }

  function isSegmentIncludedInProvingKpi(segmentId: string) {
    const setting = getSegmentProvingSetting(segmentId)
    return !!setting?.include_in_kpi
  }

  function getMeterSegmentId(meter: any) {
    if (meter?.segment_id) return meter.segment_id
    const lease = leases.find((l: any) => String(l.id) === String(meter?.lease_id))
    return lease?.segment_id || null
  }

  function getProvingKpiMonthRange(monthKey: string) {
    const fallback = new Date().toISOString().slice(0, 7)
    const key = monthKey || fallback
    const start = new Date(`${key}-01T00:00:00`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    return { start, end, key }
  }

  function isProvingInKpiMonth(proving: any, monthKey: string) {
    const { start, end } = getProvingKpiMonthRange(monthKey)
    const value = proving?.approved_at || proving?.proving_date || proving?.created_at
    if (!value) return false
    const date = new Date(value)
    return !Number.isNaN(date.getTime()) && date >= start && date < end
  }

  function getSegmentProvingKpiRows(monthKey = provingKpiMonth) {
    const scheduledRows = getScheduledRowsForMonth(monthKey)
    const segmentIds = Array.from(new Set(scheduledRows.map((row: any) => String(row.segment_id || getMeterSegmentId(getMeterById(row.meter_id)) || '')).filter(Boolean)))
    return segmentIds.map((segmentId: string) => {
      const segment: any = asArray(segments).find((s: any) => String(s.id || '') === segmentId) || { id: segmentId, name: 'Unassigned Segment' }
      const rows = scheduledRows.filter((row: any) => String(row.segment_id || getMeterSegmentId(getMeterById(row.meter_id)) || '') === segmentId)
      const completed = rows.filter((row: any) => !!getApprovedProvingForScheduledRow(row)).length
      const scheduled = rows.length
      const remaining = Math.max(scheduled - completed, 0)
      const compliance = scheduled > 0 ? (completed / scheduled) * 100 : 0
      return { segment, scheduled, completed, remaining, compliance }
    })
  }

  async function saveSegmentProvingSetting(segmentId: string, includeInKpi: boolean) {
    const segment = segments.find((s: any) => String(s.id) === String(segmentId))
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    const payload: any = {
      company_id: activeCompanyID || segment?.company_id || null,
      segment_id: segmentId,
      include_in_kpi: includeInKpi,
      required_frequency: 'monthly',
      meter_scope: 'all_active',
      active: true,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('segment_proving_settings')
      .upsert(payload, { onConflict: 'company_id,segment_id' })

    if (error) {
      alert('Could not save proving KPI setting: ' + error.message)
      return
    }

    await loadAll()
  }

function handleProvingAreaSelect(areaId: string) {
    setSelectedProvingArea(areaId)
    setSelectedProvingSegment('')
    setSelectedProvingLease('')
    setProvingMeter('')
  }

  function handleProvingSegmentSelect(segmentId: string) {
    setSelectedProvingSegment(segmentId)
    setSelectedProvingLease('')
    setProvingMeter('')
  }

  function handleProvingLeaseSelect(leaseId: string) {
    setSelectedProvingLease(leaseId)

    const leaseMeters = getVisibleMeters(leaseId)

    if (leaseMeters.length === 1) {
      setProvingMeter(leaseMeters[0].id)
    } else {
      setProvingMeter('')
    }
  }

  function clearProvingForm() {
    setEditingProvingId('')
    setEditingProvingOriginalStatus('')
    setSelectedProvingArea(getDefaultVisibleAreaId())
    setSelectedProvingSegment('')
    setSelectedProvingLease('')
    setProvingMeter('')
    setProvingDate('')
    setProverVolume('')
    setProvingIndicatedVolume('')
    setAcceptedMF('')
    setProvingCpl('')
    setProvingWitness('')
    setProvingFactorType('MF')
    setProvingPdfFile(null)
    setProvingPhotoFiles([])
  }

  function editProving(proving: any) {
    if (!proving?.id) return

    const meterRow: any = asArray(meters).find((m: any) => String(m.id || '') === String(proving.meter_id || ''))
    const leaseId = String(proving.lease_id || meterRow?.lease_id || '')
    const leaseRow: any = asArray(leases).find((l: any) => String(l.id || '') === leaseId)
    const segmentId = String(proving.segment_id || meterRow?.segment_id || leaseRow?.segment_id || '')
    const segmentRow: any = asArray(segments).find((s: any) => String(s.id || '') === segmentId)
    const areaId = String(proving.area_id || segmentRow?.area_id || getDefaultVisibleAreaId() || '')

    setEditingProvingId(String(proving.id))
    setEditingProvingOriginalStatus(String(proving.status || 'draft').toLowerCase())
    setSelectedProvingArea(areaId)
    setSelectedProvingSegment(segmentId)
    setSelectedProvingLease(leaseId)
    setProvingMeter(String(proving.meter_id || ''))
    setProvingDate(String(proving.proving_date || '').slice(0, 10))
    setProverVolume(String((proving as any).prover_volume ?? ''))
    setProvingIndicatedVolume(String((proving as any).indicated_volume ?? ''))
    setAcceptedMF(String(proving.mf ?? proving.accepted_meter_factor ?? ''))
    setProvingCpl(String(proving.cpl ?? ''))
    setProvingWitness(String(proving.witness || ''))
    setProvingFactorType(String(proving.factor_type || 'MF'))
    setProvingPdfFile(null)
    setProvingPhotoFiles([])
    setProvingTab('create')
  }

  async function deleteDraftProving(proving: any) {
    if (!proving?.id) return
    if (String(proving.status || 'draft').toLowerCase() !== 'draft') {
      alert('Only draft provings can be deleted.')
      return
    }
    if (!confirm('Delete this draft proving?')) return

    const { error } = await supabase
      .from('meter_provings')
      .delete()
      .eq('id', proving.id)
      .eq('status', 'draft')

    if (error) {
      alert('Could not delete draft proving: ' + error.message)
      return
    }

    if (String(editingProvingId) === String(proving.id)) clearProvingForm()
    await loadAll()
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
    const finalCpl = Number(provingCpl || 1)
    const calculatedCMF = roundFactor(finalAcceptedMF * finalCpl)
    const finalAcceptedFactor = provingFactorType === 'CMF' ? calculatedCMF : finalAcceptedMF
    const leaseProducerId = leases.find((l: any) => String(l.id) === String(selectedProvingLease))?.producer_id || meters.find((m: any) => String(m.id) === String(provingMeter))?.producer_id || null

    const provingPayload: any = {
      company_id: companyId,
      area_id: selectedProvingArea || null,
      segment_id: selectedProvingSegment || null,
      lease_id: selectedProvingLease || null,
      producer_id: leaseProducerId,
      meter_id: provingMeter,
      proving_date: provingDate,
      prover_volume: Number(proverVolume || 0),
      indicated_volume: Number(provingIndicatedVolume || 0),
      observed_meter_factor: observedMF,
      accepted_meter_factor: finalAcceptedFactor,
      mf: finalAcceptedMF,
      cpl: provingFactorType === 'CMF' ? finalCpl : null,
      calculated_cmf: provingFactorType === 'CMF' ? calculatedCMF : null,
      factor_type: provingFactorType,
      witness: provingWitness,
      status: editingProvingId ? (editingProvingOriginalStatus || 'draft') : 'draft',
    }

    const result = editingProvingId
      ? await supabase
          .from('meter_provings')
          .update(provingPayload)
          .eq('id', editingProvingId)
          .select()
          .single()
      : await supabase
          .from('meter_provings')
          .insert(provingPayload)
          .select()
          .single()

    const inserted = result.data
    const error = result.error

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

    const wasEditing = Boolean(editingProvingId)
    clearProvingForm()

    alert(wasEditing ? 'Proving updated.' : 'Proving saved.')
    loadAll()
  }

  async function approveProving(proving: Proving) {
    const { error } = await supabase
      .from('meter_provings')
      .update({
        status: 'approved',
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
      // fraction is normally eighths of an inch, not decimal feet.
      const fractionInches = Math.abs(fractionValue) >= 1 ? (fractionValue / 8) : fractionValue
      return feetValue + (inchesValue / 12) + (fractionInches / 12)
    }

    return feetValue
  }

  function getActiveTankCalibration(tankId: string, calibrationVersionId = '') {
    return (
      (calibrationVersionId ? tankCalibrationVersions.find((version: any) => String(version.id) === String(calibrationVersionId) && String(version.tank_id) === String(tankId)) : null) ||
      (selectedTankCalibrationVersionId && String(selectedTank) === String(tankId)
        ? tankCalibrationVersions.find((version: any) => String(version.id) === String(selectedTankCalibrationVersionId) && String(version.tank_id) === String(tankId))
        : null) ||
      tankCalibrationVersions.find((version: any) => String(version.tank_id) === String(tankId) && version.active !== false) ||
      tankCalibrationVersions.find((version: any) => String(version.tank_id) === String(tankId))
    )
  }

  function getTankCalibrationLabel(version: any) {
    const rawName = version?.name || version?.calibration_name || version?.strap_name || `Version ${version?.version_number || ''}`
    const leg = version?.leg_type || version?.strap_type || version?.table_type || version?.roof_leg || ''
    return `${rawName}${leg ? ` - ${leg}` : ''}`.trim()
  }

  function getTankBarrelsAtGauge(tankId: string, gauge: number, calibrationVersionId = '') {
    const calibration = getActiveTankCalibration(tankId, calibrationVersionId)

    if (!calibration || !Number.isFinite(gauge)) return 0

    const rows = tankStrappingRows
      .filter((row: any) => String(row.tank_id) === String(tankId) && String(row.calibration_version_id) === String(calibration.id))
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
    const interpolated = lowerBbl + ((upperBbl - lowerBbl) * ratio)

    return interpolated
  }

  function getDeadwoodAdjustment(tankId: string, gauge: number, calibrationVersionId = '') {
    const calibration = getActiveTankCalibration(tankId, calibrationVersionId)

    if (!calibration) return 0

    return tankDeadwoodRules
      .filter((rule: any) =>
        String(rule.tank_id) === String(tankId) &&
        String(rule.calibration_version_id) === String(calibration.id) &&
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
    const previous: any = getPreviousTankTicket(tankId)
    const observed = previous?.observed_inputs || {}

    if (
      observed.tank_closing_feet !== null &&
      observed.tank_closing_feet !== undefined &&
      observed.tank_closing_feet !== ''
    ) {
      return gaugePartsToDecimal(
        observed.tank_closing_feet,
        observed.tank_closing_inches || 0,
        observed.tank_closing_eighths || 0
      )
    }

    return (
      (previous as any)?.closing_gauge ||
      observed.closing_gauge_decimal ||
      observed.closing_gauge ||
      ''
    )
  }

  function getPreviousTankClosingWaterGauge(tankId: string) {
    const previous = getPreviousTankTicket(tankId)

    return (
      previous?.observed_inputs?.closing_water_gauge_decimal ||
      previous?.observed_inputs?.tank_closing_water_gauge_decimal ||
      ''
    )
  }

  function calculateTankShellTemp() {
    const liquidTemp = Number(tankAverageTemp || tankObservedTemp || 60)
    const ambientTemp = Number(tankAmbientTemp || liquidTemp)
    if (tankIsInsulated) return liquidTemp
    return ((7 * liquidTemp) + ambientTemp) / 8
  }

  function calculateTankShellCorrectionFactor() {
    const alpha = Number(tankShellCoefficient || 0.0000062)
    const deltaT = calculateTankShellTemp() - Number(tankShellReferenceTemp || 60)
    return 1 + (2 * alpha * deltaT) + (alpha * alpha * deltaT * deltaT)
  }

  function apiToSpecificGravity(apiGravity: number) {
    if (!Number.isFinite(apiGravity) || apiGravity <= -131.5) return 0
    return 141.5 / (apiGravity + 131.5)
  }

  function getTankRoofConfig() {
    const calibration: any = selectedTank ? getActiveTankCalibration(selectedTank) : null
    const roofWeightLbs = Number(
      calibration?.roof_weight_lbs ||
      calibration?.floating_roof_weight_lbs ||
      calibration?.roof_weight ||
      calibration?.fra_roof_weight_lbs ||
      0
    )
    const referenceApi = Number(
      calibration?.roof_reference_api ||
      calibration?.floating_roof_reference_api ||
      calibration?.reference_api ||
      calibration?.fra_reference_api ||
      0
    )
    const referenceSg = Number(
      calibration?.roof_reference_sg ||
      calibration?.floating_roof_reference_sg ||
      calibration?.reference_sg ||
      calibration?.fra_reference_sg ||
      0
    ) || apiToSpecificGravity(referenceApi)
    const criticalGauge = Number(
      calibration?.roof_critical_gauge ||
      calibration?.critical_gauge ||
      calibration?.floating_roof_critical_gauge ||
      calibration?.fra_critical_gauge ||
      0
    )
    const mode = String(
      calibration?.roof_correction_mode ||
      calibration?.roof_mode ||
      calibration?.floating_roof_mode ||
      calibration?.fra_mode ||
      'fra'
    ).toLowerCase()

    return { calibration, roofWeightLbs, referenceApi, referenceSg, criticalGauge, mode }
  }

  function getTankCorrectedApi60() {
    const observedApi = Number(tankObservedGravity || 0)
    if (!Number.isFinite(observedApi) || observedApi <= 0) return 0

    const corrections = calculateApi11Corrections({
      productGroup: 'crude',
      observedApiGravity: observedApi,
      observedTemperature: Number(tankObservedTemp || tankAverageTemp || 60),
      observedPressure: 0,
      averageTemperature: Number(tankAverageTemp || tankObservedTemp || 60),
      averagePressure: 0,
      apiRounding: 1,
    })

    return Number(corrections.api_gravity_60 || observedApi || 0)
  }

  function calculateAutomaticTankRoofAdjustment(gaugeDecimal: number) {
    const { roofWeightLbs, referenceSg, criticalGauge, mode } = getTankRoofConfig()

    if (mode === 'none') return 0
    if (criticalGauge > 0 && gaugeDecimal < criticalGauge) return 0
    if (!Number.isFinite(roofWeightLbs) || roofWeightLbs <= 0) return 0
    if (!referenceSg || !Number.isFinite(referenceSg)) return 0

    const api60 = getTankCorrectedApi60()
    const actualSg = apiToSpecificGravity(api60)
    if (!actualSg) return 0

    const referenceDisplacement = roofWeightLbs / (350.16 * referenceSg)
    const actualDisplacement = roofWeightLbs / (350.16 * actualSg)

    // FRC is used when the roof displacement is not built into the table.
    if (mode === 'frc') return -actualDisplacement

    // FRA is used when the roof displacement is already built into the table at reference SG.
    return referenceDisplacement - actualDisplacement
  }

  function calculateTankObservedPoint(tankId: string, gaugeDecimal: number, waterGaugeDecimal: number, roofAdjustmentBbl: number) {
    const calibration = getActiveTankCalibration(tankId)
    const calibrationId = calibration?.id || ''
    const tov = getTankBarrelsAtGauge(tankId, gaugeDecimal, calibrationId) + getDeadwoodAdjustment(tankId, gaugeDecimal, calibrationId)
    const fw = waterGaugeDecimal > 0 ? getTankBarrelsAtGauge(tankId, waterGaugeDecimal, calibrationId) + getDeadwoodAdjustment(tankId, waterGaugeDecimal, calibrationId) : 0
    const netObservedBeforeShell = tov - fw
    const ctsh = calculateTankShellCorrectionFactor()
    const shellCorrected = netObservedBeforeShell * ctsh
    const gov = shellCorrected + Number(roofAdjustmentBbl || 0)

    return {
      gaugeDecimal,
      waterGaugeDecimal,
      tov,
      fw,
      netObservedBeforeShell,
      ctsh,
      shellTemp: calculateTankShellTemp(),
      shellCorrected,
      roofAdjustmentBbl: Number(roofAdjustmentBbl || 0),
      gov,
    }
  }

  function getPreviousTankOpeningStandardPoint(tankId: string) {
    const previous: any = getPreviousTankTicket(tankId)
    if (!previous) return null

    const observed = previous.observed_inputs || {}
    const calc = previous.calculation_results || {}

    const gov = Number(
      observed.tank_closing_gov ??
      observed.closing_gov ??
      calc.tank_closing_gov ??
      calc.tank_closing_bbl ??
      observed.tank_closing_bbl ??
      0
    )

    const gsv = Number(
      observed.tank_closing_gsv ??
      observed.tank_gsv ??
      calc.tank_closing_gsv ??
      calc.gsv ??
      0
    )

    const nsv = Number(
      observed.tank_closing_nsv ??
      observed.tank_nsv ??
      calc.tank_closing_nsv ??
      calc.nsv ??
      0
    )

    const waterGaugeDecimal = Number(
      observed.closing_water_gauge_decimal ??
      observed.tank_closing_water_gauge_decimal ??
      0
    )

    const tov = Number(
      observed.tank_closing_tov ??
      calc.tank_closing_tov ??
      observed.tank_closing_bbl ??
      calc.tank_closing_bbl ??
      0
    )

    const fw = Number(observed.tank_closing_free_water_bbl ?? calc.tank_closing_free_water_bbl ?? 0)

    return {
      sourceTicketNumber: previous.ticket_number || previous.ticket_no || '',
      gaugeDecimal: Number(getPreviousTankClosingGauge(tankId) || 0),
      waterGaugeDecimal,
      tov,
      fw,
      gov,
      gsv,
      nsv,
    }
  }

  function calculateTankTicketSnapshot(tankId: string) {
    const previousOpeningStandard = getPreviousTankOpeningStandardPoint(tankId)
    const openingGaugeDecimal = Number(previousOpeningStandard?.gaugeDecimal || 0)
    const closingGaugeDecimal = gaugePartsToDecimal(tankClosingFeet, tankClosingInches, tankClosingEighths)
    const openingWaterGaugeDecimal = Number(previousOpeningStandard?.waterGaugeDecimal || 0)
    const closingWaterGaugeDecimal = gaugePartsToDecimal(tankClosingWaterFeet, tankClosingWaterInches, tankClosingWaterEighths)

    const openingRoofAdjustment = calculateAutomaticTankRoofAdjustment(openingGaugeDecimal)
    const closingRoofAdjustment = calculateAutomaticTankRoofAdjustment(closingGaugeDecimal)

    const calculatedOpeningPoint = tankId
      ? calculateTankObservedPoint(tankId, openingGaugeDecimal, openingWaterGaugeDecimal, openingRoofAdjustment)
      : { tov: 0, fw: 0, gov: 0, shellCorrected: 0, ctsh: 1, shellTemp: 60, roofAdjustmentBbl: 0, netObservedBeforeShell: 0, gaugeDecimal: 0, waterGaugeDecimal: 0 }

    const openingPoint = previousOpeningStandard
      ? {
          ...calculatedOpeningPoint,
          tov: previousOpeningStandard.tov || calculatedOpeningPoint.tov,
          fw: previousOpeningStandard.fw || calculatedOpeningPoint.fw,
          gov: previousOpeningStandard.gov || calculatedOpeningPoint.gov,
          gsv: previousOpeningStandard.gsv || 0,
          nsv: previousOpeningStandard.nsv || 0,
          sourceTicketNumber: previousOpeningStandard.sourceTicketNumber,
          waterGaugeDecimal: previousOpeningStandard.waterGaugeDecimal || calculatedOpeningPoint.waterGaugeDecimal,
          source: 'previous_approved_tank_ticket',
        }
      : { ...calculatedOpeningPoint, source: 'calculated_from_opening_gauge' }

    const closingPoint = tankId
      ? calculateTankObservedPoint(tankId, closingGaugeDecimal, closingWaterGaugeDecimal, closingRoofAdjustment)
      : { tov: 0, fw: 0, gov: 0, shellCorrected: 0, ctsh: 1, shellTemp: 60, roofAdjustmentBbl: 0, netObservedBeforeShell: 0, gaugeDecimal: 0, waterGaugeDecimal: 0 }

    const sign = tankMovementDirection === 'receipt' ? 1 : -1
    const tovMovement = sign * (closingPoint.tov - openingPoint.tov)
    const fwMovement = sign * (closingPoint.fw - openingPoint.fw)
    const govSigned = sign * (closingPoint.gov - openingPoint.gov)
    const gov = Math.abs(govSigned)

    const movement = {
      openingGross: openingPoint.tov,
      closingGross: closingPoint.tov,
      openingCorrected: openingPoint.gov,
      closingCorrected: closingPoint.gov,
      movementBbl: gov,
      signedMovementBbl: govSigned,
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
    const closingGsv = closingPoint.gov * ccf
    const closingNsv = closingGsv * (1 - swDecimal)
    const openingGsv = Number((openingPoint as any).gsv || (openingPoint.gov * ccf))
    const openingNsv = Number((openingPoint as any).nsv || (openingGsv * (1 - swDecimal)))
    const gsv = Math.abs(sign * (closingGsv - openingGsv))
    const nsv = Math.abs(sign * (closingNsv - openingNsv))

    return {
      openingGaugeDecimal,
      closingGaugeDecimal,
      openingWaterGaugeDecimal,
      closingWaterGaugeDecimal,
      closingGaugeParts: decimalGaugeToParts(closingGaugeDecimal),
      openingPoint,
      closingPoint,
      movement,
      corrections,
      ctl,
      cpl,
      ctlp,
      ccf,
      selectedCalibration: getActiveTankCalibration(tankId),
      openingGsv,
      closingGsv,
      openingNsv,
      closingNsv,
      openingSource: (openingPoint as any).source || '',
      openingSourceTicketNumber: (openingPoint as any).sourceTicketNumber || '',
      roofConfig: getTankRoofConfig(),
      ctsh: openingPoint.ctsh,
      tankShellTemp: openingPoint.shellTemp,
      tovMovement: Math.abs(tovMovement),
      fwMovement: Math.abs(fwMovement),
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

  function getSelectedTicketContractProfile() {
    return getProducerProfile(contractProfiles, selectedProducer || null)
  }

  function getRefinedProductOptions() {
    return [
      'BBL',
      'GAL',
      'Gross Gallons',
      'Net Gallons',
      'Barrels',
      'Loads',
      'Other',
    ]
  }

  function getRefinedProductCodeOptions() {
    return ['Crude Oil', 'Diesel', 'UL-84', 'AZRBOB', 'PCBOB', 'GAS', 'JET', 'NEP', 'UL83S', 'PUL']
  }

  function getTicketBatchNumberValue(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}
    return observed.batch_number || calc.batch_number || ticket?.batch_number || observed.batch_no || ''
  }

  function getTicketPdfFileName(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}
    const meter = meters.find((m: any) => String(m.id || '') === String(ticket?.meter_id || observed.meter_id || ''))
    const lease = leases.find((l: any) => String(l.id || '') === String(ticket?.lease_id || observed.lease_id || meter?.lease_id || ''))
    const leaseName = getTicketPdfLeaseName(ticket, meter, lease, observed) || observed.lease_name || 'Lease'
    const ticketNumberValue = ticket?.ticket_number || ticket?.id || 'Ticket'
    const batchValue = getTicketBatchNumberValue(ticket) || 'NoBatch'
    const dateValue = observed.close_date || observed.ticket_date || (getTicketReportDate(ticket) ? new Date(getTicketReportDate(ticket)).toISOString().slice(0,10) : new Date().toISOString().slice(0,10))
    return sanitizeFileName(`${leaseName}_${ticketNumberValue}_${batchValue}_${dateValue}`, 'ticket')
  }

  function isRefinedTicketContext() {
    const contractProfile = getSelectedTicketContractProfile()
    const selectedMeterRow: any = asArray(meters).find((meter: any) => String(meter.id || '') === String(selectedMeter || ''))
    const selectedProductGroup = String(contractProfile?.product_group || '').toLowerCase()
    const selectedProductType = String(selectedMeterRow?.product_type || selectedMeterRow?.product || selectedMeterRow?.commodity || '').toLowerCase()
    const selectedStandard = String(contractProfile?.standard || contractProfile?.calculation_method || '').toLowerCase()

    return (
      selectedProductGroup.includes('refined') ||
      selectedProductGroup.includes('diesel') ||
      selectedProductGroup.includes('gasoline') ||
      selectedProductGroup.includes('butane') ||
      selectedProductType.includes('refined') ||
      selectedProductType.includes('diesel') ||
      selectedProductType.includes('gasoline') ||
      selectedProductType.includes('butane') ||
      selectedStandard.includes('refined') ||
      ticketType === 'truck'
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
      (p: any) =>
        String(p.segment_id || '') === String(selectedSegment) &&
        String(p.lease_id || '') === String(selectedLease) &&
        (!selectedProducer || !p.producer_id || String(p.producer_id || '') === String(selectedProducer))
    )

    const tankTicketSnapshot = ticketType === 'tank' && selectedTank
      ? calculateTankTicketSnapshot(selectedTank)
      : null

    const previousClosingReading = getPreviousClosingForLease(selectedLease, selectedMeter)
    const ticketOpenDateTime = ticketOpenDate ? `${ticketOpenDate}T${ticketOpenTime || '00:00'}` : null
    const ticketCloseDateTime = ticketCloseDate ? `${ticketCloseDate}T${ticketCloseTime || '00:00'}` : null
    const openingReading = Number(previousClosingReading || 0)
    const closingReading = Number(manualClosingReading || latestReading?.indicated_volume || 0)

    const tankCalculation = tankTicketSnapshot?.movement || null

    const iv = tankTicketSnapshot
      ? Number(tankTicketSnapshot.gov || 0)
      : Number(closingReading || latestReading?.indicated_volume || 0)
    const contractProfile = getSelectedTicketContractProfile()

    const selectedContractStandard =
      contractProfile?.standard || profile?.standard || ''

    const selectedCalculationMethod =
      contractProfile?.calculation_method || 'CTPL'

    const selectedProductGroup =
      contractProfile?.product_group || 'crude'

    const selectedFactorType =
      contractProfile?.factor_type || latestApprovedProving?.factor_type || 'MF'

    const selectedApiVersion = String((contractProfile as any)?.api_version || (selectedContractStandard.includes('12.2') || selectedCalculationMethod === 'chapter12_2021' || selectedCalculationMethod === 'chapter12_2_2021' ? 'api_chapter_12_2_r2021' : ''))
    const isChapter122021Ticket =
      selectedApiVersion === 'api_chapter_12_2_r2021' ||
      selectedApiVersion === 'chapter12_2_2021' ||
      selectedApiVersion === 'chapter12_2021' ||
      selectedCalculationMethod === 'chapter12_2_2021' ||
      selectedCalculationMethod === 'chapter12_2021' ||
      selectedContractStandard.includes('12.2') ||
      selectedContractStandard.includes('Chapter 12.2') ||
      selectedContractStandard.includes('Chapter 12')

    // Do not let older contract profile rows with 3/5-decimal factor settings override Ch. 12.2 R2021.
    // Ch. 12.2 display profile here is API @60 to 0.1, CTL/CPL/CTPL to 6, MF/CMF to 4, volumes to 2.
    const apiRounding = isChapter122021Ticket ? 1 : Number(contractProfile?.api_rounding ?? 1)
    const ctlRounding = isChapter122021Ticket ? 6 : Number(contractProfile?.ctl_rounding ?? 6)
    const cplRounding = isChapter122021Ticket ? 6 : Number(contractProfile?.cpl_rounding ?? 6)
    const ctlpRounding = isChapter122021Ticket ? 6 : Number(contractProfile?.ctlp_rounding ?? 6)
    const volumeRounding = isChapter122021Ticket ? 2 : Number(contractProfile?.volume_rounding ?? 2)
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
        ((latestPot as any)?.observed_api_gravity_raw) ??
          ((latestPot as any)?.observed_api_raw) ??
          ((latestPot as any)?.sample_gravity_raw) ??
          ((latestPot as any)?.observed_api_exact) ??
          ((latestPot as any)?.api_gravity_exact) ??
          latestPot?.observed_api_gravity ??
          latestPot?.api_gravity ??
          latestPot?.api_gravity_60 ??
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

    const ctl = roundApiFactor(corrections.ctl, ctlRounding)
    const cpl = roundApiFactor(corrections.cpl, cplRounding)
    const ctlp = roundApiFactor(corrections.ctlp, ctlpRounding)
    const ccf = corrections.ccf

    const finalCtl = tankTicketSnapshot ? tankTicketSnapshot.ctl : ctl
    const finalCpl = tankTicketSnapshot ? tankTicketSnapshot.cpl : cpl
    const finalCtlp = tankTicketSnapshot ? tankTicketSnapshot.ctlp : ctlp
    const finalCcf = tankTicketSnapshot ? tankTicketSnapshot.ccf : ccf

    const factorToUse = Number(latestApprovedProving?.accepted_meter_factor || latestReading?.meter_factor || 1)
    const mf = roundApiHalfEven(factorToUse, 4)
    const csw = Number(latestPot?.csw || 1)
    const bswPercent = getPotBswPercentValue(latestPot) ?? roundTo((1 - csw) * 100, 4)
    const isApi12 = isChapter122021Ticket || selectedContractStandard.includes('API 12') || selectedCalculationMethod === 'chapter12_2_2021' || selectedCalculationMethod === 'chapter12_2021'
    const gsvRaw = tankTicketSnapshot
      ? tankTicketSnapshot.gsv
      : isApi12 ? iv * mf * ctl * cpl : iv * ccf * mf
    const gsv = roundApiHalfEven(gsvRaw, volumeRounding)
    const nsv = tankTicketSnapshot
      ? roundApiHalfEven(tankTicketSnapshot.nsv, volumeRounding)
      : roundApiHalfEven(gsvRaw * csw, volumeRounding)

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
      open_datetime: ticketOpenDateTime,
      close_datetime: ticketCloseDateTime,
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
        refined_unit_type: refinedProductType || null,
        refined_product_type: refinedProductCode || null,
        product_code: refinedProductCode || null,
        refined_destination: refinedMovementDestination || null,
        batch_number: ticketBatchNumber || null,
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
        open_datetime: ticketOpenDateTime,
        close_datetime: ticketCloseDateTime,
        open_date: ticketOpenDate || null,
        open_time: ticketOpenTime || null,
        close_date: ticketCloseDate || null,
        close_time: ticketCloseTime || null,
        previous_closing_source: previousClosingReading ? 'previous_approved_ticket_for_lease' : 'none',
        tank_id: selectedTank || null,
        tank_calibration_version_id: tankTicketSnapshot?.selectedCalibration?.id || selectedTankCalibrationVersionId || null,
        tank_calibration_name: tankTicketSnapshot?.selectedCalibration ? getTankCalibrationLabel(tankTicketSnapshot.selectedCalibration) : null,
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
        tank_opening_water_gauge_decimal: tankTicketSnapshot?.openingWaterGaugeDecimal ?? null,
        tank_closing_water_gauge_decimal: tankTicketSnapshot?.closingWaterGaugeDecimal ?? null,
        tank_opening_tov: tankTicketSnapshot?.openingPoint?.tov ?? null,
        tank_closing_tov: tankTicketSnapshot?.closingPoint?.tov ?? null,
        tank_opening_free_water_bbl: tankTicketSnapshot?.openingPoint?.fw ?? null,
        tank_closing_free_water_bbl: tankTicketSnapshot?.closingPoint?.fw ?? null,
        tank_opening_gov: tankTicketSnapshot?.openingPoint?.gov ?? null,
        tank_closing_gov: tankTicketSnapshot?.closingPoint?.gov ?? null,
        tank_opening_gsv: tankTicketSnapshot?.openingGsv ?? null,
        tank_closing_gsv: tankTicketSnapshot?.closingGsv ?? null,
        tank_opening_nsv: tankTicketSnapshot?.openingNsv ?? null,
        tank_closing_nsv: tankTicketSnapshot?.closingNsv ?? null,
        tank_opening_source: tankTicketSnapshot?.openingSource ?? null,
        tank_opening_source_ticket_number: tankTicketSnapshot?.openingSourceTicketNumber ?? null,
        tank_shell_temp: tankTicketSnapshot?.tankShellTemp ?? null,
        tank_shell_reference_temp: tankShellReferenceTemp || null,
        tank_shell_correction_factor: tankTicketSnapshot?.ctsh ?? null,
        tank_opening_roof_adjustment_bbl: tankTicketSnapshot?.openingPoint?.roofAdjustmentBbl ?? null,
        tank_closing_roof_adjustment_bbl: tankTicketSnapshot?.closingPoint?.roofAdjustmentBbl ?? null,
        tank_auto_roof_correction: tankAutoRoofCorrection,
        tank_roof_correction_mode: tankRoofCorrectionMode,
        tank_roof_reference_api: tankRoofReferenceApi || null,
        tank_roof_bbl_per_api: tankRoofBblPerApi || null,
        tank_roof_weight_lbs: tankRoofWeightLbs || null,
        tank_roof_fixed_correction_bbl: tankRoofFixedCorrectionBbl || null,
        tank_use_previous_opening_ticket: true,
        tank_roof_critical_gauge: tankRoofCriticalGauge || null,
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
        average_temperature: corrections.average_temperature,
        average_pressure: corrections.average_pressure,
        csw,
        bsw_percent: bswPercent,
        sw_percent: bswPercent,
        rvp: latestPot ? (((latestPot as any).rvp ?? parsePotExtra((latestPot as any).notes, 'rvp')) || null) : null,
        sulfur: latestPot ? (((latestPot as any).sulfur ?? parsePotExtra((latestPot as any).notes, 'sulfur')) || null) : null,
        mf_source: latestApprovedProving ? 'latest_approved_proving' : 'reading_fallback',
        pot_source: latestPot ? 'latest_pot_quality' : 'none',
        api_engine: corrections.api_engine,
        api_engine_note: corrections.api_engine_note,
        api_11_1_section: '11.1.6.1',
        rounding_profile_used: isChapter122021Ticket ? 'API Ch. 12.2 R2021: API@60 0.1, CTL/CPL 6, MF 4, Volumes 2' : 'Contract profile',
        chapter_12_2_formula: isApi12 ? 'GSV = IV × MF × CTL × CPL; NSV = GSV × CSW' : null,
        raw_observed_api_used: Number(
          ((latestPot as any)?.observed_api_gravity_raw) ??
            ((latestPot as any)?.observed_api_raw) ??
            ((latestPot as any)?.sample_gravity_raw) ??
            ((latestPot as any)?.observed_api_exact) ??
            ((latestPot as any)?.api_gravity_exact) ??
            latestPot?.observed_api_gravity ??
            latestPot?.api_gravity ??
            latestPot?.api_gravity_60 ??
            0
        ),
        raw_api_gravity_60: corrections.raw_api_gravity_60 ?? null,
        raw_ctl: corrections.raw_ctl ?? null,
        raw_cpl: corrections.raw_cpl ?? null,
        raw_ctlp: corrections.raw_ctlp ?? null,
        contract_profile_name: contractProfile?.name || null,
        calculation_method: isChapter122021Ticket ? 'API Chapter 12.2 R2021' : selectedCalculationMethod,
        product_group: selectedProductGroup,
        calculation_formula: isApi12 ? 'GSV = IV × MF × CTL × CPL; NSV = GSV × CSW' : 'GSV = IV × CTPL × MF; NSV = GSV × CSW',
        refined_unit_type: refinedProductType || null,
        unit_of_measure_type: refinedProductType || null,
        refined_product_type: refinedProductCode || null,
        product_code: refinedProductCode || null,
        product_type: refinedProductCode || selectedProductGroup || null,
        refined_destination: refinedMovementDestination || null,
        movement_destination: refinedMovementDestination || null,
        destination: refinedMovementDestination || null,
        batch_number: ticketBatchNumber || null,
        batch_no: ticketBatchNumber || null,
        shrink_factor: shrinkFactor,
        product_sub_group: corrections.product_sub_group,
      },
      calculation_results: {
        iv: roundTo(iv, volumeRounding),
        indicated_volume: roundTo(iv, volumeRounding),
        ctl,
        cpl,
        ctlp,
        ccf,
        tank_opening_bbl: tankCalculation?.openingCorrected ?? null,
        tank_closing_bbl: tankCalculation?.closingCorrected ?? null,
        tank_movement_bbl: tankCalculation?.movementBbl ?? null,
        tank_tov_movement_bbl: tankTicketSnapshot?.tovMovement ?? null,
        tank_free_water_movement_bbl: tankTicketSnapshot?.fwMovement ?? null,
        tank_opening_gsv: tankTicketSnapshot?.openingGsv ?? null,
        tank_closing_gsv: tankTicketSnapshot?.closingGsv ?? null,
        tank_opening_nsv: tankTicketSnapshot?.openingNsv ?? null,
        tank_closing_nsv: tankTicketSnapshot?.closingNsv ?? null,
        tank_ctsh: tankTicketSnapshot?.ctsh ?? null,
        tank_shell_temp: tankTicketSnapshot?.tankShellTemp ?? null,
        gsv: roundTo(gsv, volumeRounding),
        nsv: roundTo(nsv, volumeRounding),
        api_gravity_60: corrections.api_gravity_60,
        density_60: corrections.density_60,
        bsw_percent: bswPercent,
        sw_percent: bswPercent,
        csw,
        product_sub_group: corrections.product_sub_group,
        api_engine: corrections.api_engine,
        calculation_formula: isApi12 ? 'GSV = IV × MF × CTL × CPL; NSV = GSV × CSW' : 'GSV = IV × CTPL × MF; NSV = GSV × CSW',
        raw_api_gravity_60: corrections.raw_api_gravity_60 ?? null,
        raw_ctl: corrections.raw_ctl ?? null,
        raw_cpl: corrections.raw_cpl ?? null,
        raw_ctlp: corrections.raw_ctlp ?? null,
        refined_unit_type: refinedProductType || null,
        unit_of_measure_type: refinedProductType || null,
        refined_product_type: refinedProductCode || null,
        product_code: refinedProductCode || null,
        product_type: refinedProductCode || selectedProductGroup || null,
        refined_destination: refinedMovementDestination || null,
        movement_destination: refinedMovementDestination || null,
        batch_number: ticketBatchNumber || null,
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

    setSelectedSegment('')
    setSelectedProducer('')
    setSelectedLease('')
    setSelectedMeter('')
    setManualClosingReading('')
    setRefinedProductType('')
    setRefinedProductCode('')
    setRefinedMovementDestination('')
    setTicketBatchNumber('')
    setAutofillPreview(null)
    loadAll()
  }

  async function updateTicketStatus(ticket: Ticket, status: string) {
    const normalizedStatus = String(status || '').toLowerCase()
    const updateData: any = { status: normalizedStatus }

    if (normalizedStatus === 'approved') {
      updateData.approved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticket.id)
      .select()
      .maybeSingle()

    if (error) {
      alert(`Could not update ticket status: ${error.message}`)
      return
    }

    const updatedTicket: any = data || { ...ticket, ...updateData }

    setTickets((prev: any[]) =>
      prev.map((row: any) => String(row.id) === String(ticket.id) ? { ...row, ...updatedTicket } : row)
    )
    setSelectedTicket(updatedTicket)
    setIsDraftTicketEditOpen(false)

    if (normalizedStatus === 'approved') {
      setTicketWorkflowTab('approved')
      try {
        await saveTicketPdfToSupabase(updatedTicket)
      } catch (pdfError: any) {
        console.warn('Approved ticket PDF auto-save failed:', pdfError)
        alert('Ticket approved, but the one-page PDF could not be saved: ' + (pdfError?.message || 'Unknown PDF error'))
      }
    } else if (normalizedStatus === 'submitted') {
      setTicketWorkflowTab('pending')
    } else if (normalizedStatus === 'draft') {
      setTicketWorkflowTab('drafts')
    }

    await loadAll()
  }

  function ticketEditString(value: any) {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  function ticketEditNumber(values: Record<string, string>, key: string) {
    const raw = values[key]
    if (raw === undefined || raw === null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }


  function getDraftTicketReadingValues(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}
    const pickNum = (...values: any[]) => {
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        const num = Number(value)
        if (Number.isFinite(num)) return num
      }
      return null
    }

    const ticketMeterId = String(ticket?.meter_id || observed.meter_id || '')
    const ticketLeaseId = String(ticket?.lease_id || observed.lease_id || '')
    const ticketCreatedMs = new Date(ticket?.created_at || ticket?.updated_at || Date.now()).getTime()

    const matchingReading = (Array.isArray(readings) ? readings : [])
      .filter((row: any) => {
        const sameMeter = ticketMeterId && String(row.meter_id || '') === ticketMeterId
        const sameLease = ticketLeaseId && String(row.lease_id || '') === ticketLeaseId
        return sameMeter || sameLease
      })
      .sort((a: any, b: any) => {
        const aMs = new Date(a.reading_date || a.created_at || 0).getTime()
        const bMs = new Date(b.reading_date || b.created_at || 0).getTime()
        const aBefore = aMs <= ticketCreatedMs ? 1 : 0
        const bBefore = bMs <= ticketCreatedMs ? 1 : 0
        if (aBefore !== bBefore) return bBefore - aBefore
        return Math.abs(ticketCreatedMs - aMs) - Math.abs(ticketCreatedMs - bMs)
      })[0] || {}

    const directIv = pickNum(
      calc.iv,
      calc.gov,
      calc.total_batch_barrels,
      observed.total_batch_barrels,
      observed.indicated_volume,
      observed.gross_volume_bbl,
      observed.iv,
      observed.gov,
      ticket.total_batch_barrels,
      ticket.indicated_volume,
      ticket.iv,
      ticket.gov,
      matchingReading.indicated_volume
    )

    const opening = pickNum(
      observed.opening_reading,
      observed.opening_meter_reading,
      observed.open_meter_reading,
      observed.open_reading,
      observed.open_meter,
      ticket.opening_reading,
      ticket.opening_meter_reading,
      ticket.open_reading,
      calc.opening_reading,
      calc.opening_meter_reading,
      calc.open_reading,
      matchingReading.opening_reading,
      matchingReading.opening_meter_reading,
      matchingReading.open_reading
    )

    const closingDirect = pickNum(
      observed.closing_reading,
      observed.closing_meter_reading,
      observed.close_meter_reading,
      observed.close_reading,
      observed.close_meter,
      (ticket as any).closing_reading,
      (ticket as any).closing_meter_reading,
      (ticket as any).close_reading,
      calc.closing_reading,
      calc.closing_meter_reading,
      calc.close_reading,
      matchingReading.closing_reading,
      matchingReading.closing_meter_reading,
      matchingReading.close_reading
    )

    // Closing reading should be the actual closing meter total.
    // Some older draft tickets accidentally stored IV/total batch in a close_* field,
    // so if closing is lower than opening, rebuild closing as opening + IV.
    const closing = opening !== null && directIv !== null && (
        closingDirect === null ||
        closingDirect < opening ||
        Math.abs((closingDirect - opening) - directIv) > 0.01
      )
      ? opening + directIv
      : closingDirect

    const iv = opening !== null && closing !== null
      ? closing - opening
      : directIv

    return { opening, closing, iv }
  }

  function getTicketLeaseDisplay(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const meter = asArray(meters).find((m: any) => String(m.id || '') === String(ticket?.meter_id || observed.meter_id || ''))
    const lease = asArray(leases).find((l: any) => String(l.id || '') === String(ticket?.lease_id || observed.lease_id || meter?.lease_id || ''))
    return getTicketPdfLeaseName(ticket, meter, lease, observed) || observed.lease_name || observed.lease || ticket?.ticket_number || ticket?.id || 'Ticket'
  }

  function startDraftTicketEdit(ticket: any) {
    const observed = ticket.observed_inputs || {}
    const calc = ticket.calculation_results || {}
    const draftReadings = getDraftTicketReadingValues(ticket)
    const pdfNum = (...values: any[]) => {
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        const num = Number(value)
        if (Number.isFinite(num)) return num
      }
      return null
    }
    const pdfCtl = pdfNum(calc.ctl, observed.ctl) ?? 0
    const pdfCpl = pdfNum(calc.cpl, observed.cpl) ?? 0
    const pdfMf = pdfNum(calc.mf, observed.mf) ?? 1
    const pdfCtpl = pdfNum(calc.ctpl, observed.ctpl) ?? (pdfCtl && pdfCpl ? pdfCtl * pdfCpl : 0)
    const pdfCcf = pdfNum(calc.ccf, observed.ccf) ?? (pdfCtpl ? pdfCtpl * pdfMf : 0)
    const pdfOpeningReading = pdfNum(
      calc.opening_reading,
      observed.opening_reading,
      observed.open_meter_reading,
      observed.opening_meter_reading,
      ticket.opening_reading,
      ticket.opening_meter_reading
    )
    const pdfClosingReading = pdfNum(
      calc.closing_reading,
      observed.closing_reading,
      observed.close_meter_reading,
      observed.closing_meter_reading,
      (ticket as any).closing_reading,
      (ticket as any).closing_meter_reading
    )
    const pdfReadingIv = pdfOpeningReading !== null && pdfClosingReading !== null ? pdfClosingReading - pdfOpeningReading : null
    const pdfIvFromGsv = pdfCcf ? pdfNum(calc.gsv, observed.gsv, observed.gross_standard_volume, observed.gross_standard_volume_bbl) !== null ? (pdfNum(calc.gsv, observed.gsv, observed.gross_standard_volume, observed.gross_standard_volume_bbl) as number) / pdfCcf : null : null
    const pdfIv = pdfNum(
      calc.iv,
      calc.gov,
      calc.total_batch_barrels,
      observed.total_batch_barrels,
      observed.indicated_volume,
      observed.iv,
      observed.gov,
      ticket.total_batch_barrels,
      ticket.indicated_volume,
      ticket.iv,
      ticket.gov,
      pdfReadingIv,
      pdfIvFromGsv
    ) ?? 0
    setSelectedTicket(ticket)
    setDraftTicketEditValues({
      opening_reading: ticketEditString(draftReadings.opening),
      closing_reading: ticketEditString(draftReadings.closing),
      total_batch_barrels: ticketEditString(draftReadings.iv),
      average_temperature: ticketEditString(calc.average_temperature ?? observed.average_temperature),
      average_pressure: ticketEditString(calc.average_pressure ?? observed.average_pressure),
      observed_api_gravity: ticketEditString(observed.observed_api_gravity ?? observed.api_observed ?? observed.api_gravity_observed),
      observed_temperature: ticketEditString(observed.observed_temperature ?? observed.temperature),
      sw_percent: ticketEditString(calc.bsw_percent ?? observed.bsw_percent ?? observed.sw_percent ?? observed.bsw),
      ctl: ticketEditString(calc.ctl ?? observed.ctl),
      cpl: ticketEditString(calc.cpl ?? observed.cpl),
      mf: ticketEditString(calc.mf ?? observed.mf),
      gsv: ticketEditString(calc.gsv ?? observed.gsv),
      nsv: ticketEditString(calc.nsv ?? observed.nsv ?? observed.net_volume_bbl),
      refined_unit_type: ticketEditString(observed.refined_unit_type ?? calc.refined_unit_type ?? observed.unit_of_measure_type),
      refined_product_type: ticketEditString(observed.refined_product_type ?? calc.refined_product_type ?? observed.product_code ?? calc.product_code ?? observed.product_type),
      refined_destination: ticketEditString(observed.refined_destination ?? calc.refined_destination ?? observed.movement_destination ?? observed.destination),
      batch_number: ticketEditString(observed.batch_number ?? calc.batch_number ?? (ticket as any).batch_number),
      ticket_prepared_by: ticketEditString(observed.ticket_prepared_by ?? observed.loaded_by_name ?? calc.ticket_prepared_by),
      company_representative_name: ticketEditString(observed.company_representative_name ?? observed.company_rep_name ?? calc.company_representative_name),
      calculation_method_used: ticketEditString(observed.calculation_method_used ?? calc.calculation_method_used ?? calc.formula_profile ?? ticket.calculation_method ?? ticket.api_chapter),
      net_volume_adjustment_bbl: ticketEditString(calc.net_volume_adjustment_bbl ?? observed.net_volume_adjustment_bbl ?? observed.manual_net_volume_adjustment_bbl ?? 0),
      net_volume_adjustment_reason: ticketEditString(observed.net_volume_adjustment_reason ?? calc.net_volume_adjustment_reason ?? ''),
      open_date: ticketEditString(observed.open_date),
      open_time: ticketEditString(observed.open_time),
      close_date: ticketEditString(observed.close_date),
      close_time: ticketEditString(observed.close_time),
      notes: ticketEditString(observed.notes ?? (ticket as any).notes),
    })
    setIsDraftTicketEditOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateDraftTicketEditField(key: string, value: string) {
    setDraftTicketEditValues((prev) => ({ ...prev, [key]: value }))
  }

  function getDraftTicketEditIv(values: Record<string, string>) {
    const opening = ticketEditNumber(values, 'opening_reading')
    const closing = ticketEditNumber(values, 'closing_reading')
    if (opening !== null && closing !== null) return closing - opening
    const existing = ticketEditNumber(values, 'total_batch_barrels')
    return existing
  }

  function getDraftTicketEditCalculatedVolumes(values: Record<string, string>) {
    const iv = getDraftTicketEditIv(values)
    const ctl = ticketEditNumber(values, 'ctl') ?? Number(selectedTicket?.calculation_results?.ctl ?? selectedTicket?.observed_inputs?.ctl ?? 1)
    const cpl = ticketEditNumber(values, 'cpl') ?? Number(selectedTicket?.calculation_results?.cpl ?? selectedTicket?.observed_inputs?.cpl ?? 1)
    const mf = ticketEditNumber(values, 'mf') ?? Number(selectedTicket?.calculation_results?.mf ?? selectedTicket?.observed_inputs?.mf ?? 1)
    const swPercent = ticketEditNumber(values, 'sw_percent')
    const csw = swPercent !== null
      ? roundTo(1 - swPercent / 100, 5)
      : Number(selectedTicket?.calculation_results?.csw ?? selectedTicket?.observed_inputs?.csw ?? 1)
    const gv = iv !== null && Number.isFinite(ctl) && Number.isFinite(cpl)
      ? roundTo(iv * ctl * cpl, 2)
      : null
    const baseGsv = gv !== null && Number.isFinite(mf)
      ? roundTo(gv * mf, 2)
      : null
    const baseNsv = baseGsv !== null && Number.isFinite(csw)
      ? roundTo(baseGsv * csw, 2)
      : null
    const adjustment = ticketEditNumber(values, 'net_volume_adjustment_bbl') ?? 0
    const adjustedNsv = baseNsv !== null ? roundTo(baseNsv + adjustment, 2) : null

    return { iv, gv, baseGsv, baseNsv, adjustment, adjustedNsv }
  }

  async function saveDraftTicketEdits() {
    if (!selectedTicket) return
    const observed = { ...((selectedTicket as any).observed_inputs || {}) }
    const calc = { ...((selectedTicket as any).calculation_results || {}) }
    const values = draftTicketEditValues
    const isApprovedRevision = String(selectedTicket.status || '').toLowerCase() === 'approved'
    const revisionNote = isApprovedRevision
      ? window.prompt('Reason for revising this approved ticket? This will be stored in the audit log.')
      : ''

    if (isApprovedRevision && !String(revisionNote || '').trim()) {
      alert('Revision cancelled. A reason is required to revise an approved ticket.')
      return
    }

    const oldRevisionSnapshot = {
      observed_inputs: observed,
      calculation_results: calc,
      status: selectedTicket.status,
      approved_at: selectedTicket.approved_at || null,
    }

    const openingReading = ticketEditNumber(values, 'opening_reading')
    const closingReading = ticketEditNumber(values, 'closing_reading')
    const totalBatchBarrels = openingReading !== null && closingReading !== null
      ? closingReading - openingReading
      : ticketEditNumber(values, 'total_batch_barrels')
    const averageTemperature = ticketEditNumber(values, 'average_temperature')
    const averagePressure = ticketEditNumber(values, 'average_pressure')
    const observedApi = ticketEditNumber(values, 'observed_api_gravity')
    const observedTemp = ticketEditNumber(values, 'observed_temperature')
    const swPercent = ticketEditNumber(values, 'sw_percent')
    const productGroup = calc.product_group || observed.product_group || 'crude'
    const apiRounding = Number(calc.api_rounding ?? observed.api_rounding ?? 1)
    const ctlRounding = Number(calc.ctl_rounding ?? observed.ctl_rounding ?? 5)
    const cplRounding = Number(calc.cpl_rounding ?? observed.cpl_rounding ?? 5)
    const ctlpRounding = Number(calc.ctlp_rounding ?? observed.ctlp_rounding ?? 5)
    const corrections = calculateApi11Corrections({
      productGroup,
      observedApiGravity: Number(observedApi ?? calc.observed_api_gravity ?? observed.observed_api_gravity ?? 0),
      observedTemperature: Number(observedTemp ?? calc.observed_temperature ?? observed.observed_temperature ?? 60),
      observedPressure: 0,
      averageTemperature: Number(averageTemperature ?? calc.average_temperature ?? observed.average_temperature ?? 60),
      averagePressure: Number(averagePressure ?? calc.average_pressure ?? observed.average_pressure ?? 0),
      apiRounding,
    })
    const apiGravity60Value = corrections.api_gravity_60
    const density60Value = corrections.density_60
    const ctlValue = roundTo(corrections.ctl, ctlRounding)
    const cplValue = roundTo(corrections.cpl, cplRounding)
    const ctlpValue = roundTo(corrections.ctlp, ctlpRounding)
    const mfValue = ticketEditNumber(values, 'mf') ?? Number(calc.mf ?? observed.mf ?? 1)
    const cswValue = swPercent !== null ? roundTo(1 - swPercent / 100, 5) : Number(calc.csw ?? observed.csw ?? 1)
    const calculatedGv = totalBatchBarrels !== null ? roundTo(totalBatchBarrels * ctlValue * cplValue, 2) : null
    const calculatedGsv = calculatedGv !== null ? roundTo(calculatedGv * mfValue, 2) : null
    const gvValue = calculatedGv
    const gsvValue = calculatedGsv
    const baseNsvValue = gsvValue !== null ? roundTo(gsvValue * cswValue, 2) : null
    const netVolumeAdjustmentBbl = ticketEditNumber(values, 'net_volume_adjustment_bbl') ?? 0
    const nsvValue = baseNsvValue !== null ? roundTo(baseNsvValue + netVolumeAdjustmentBbl, 2) : null
    const netVolumeAdjustmentReason = String(values.net_volume_adjustment_reason || '').trim()

    const nextObservedInputs: any = {
      ...observed,
      opening_reading: openingReading,
      closing_reading: closingReading,
      total_batch_barrels: totalBatchBarrels,
      indicated_volume: totalBatchBarrels,
      indicated_volume_bbl: totalBatchBarrels,
      gross_observed_volume_bbl: totalBatchBarrels,
      average_temperature: averageTemperature,
      average_pressure: averagePressure,
      observed_api_gravity: observedApi,
      api_observed: observedApi,
      api_gravity_60: apiGravity60Value,
      corrected_api_gravity: apiGravity60Value,
      density_60: density60Value,
      observed_temperature: observedTemp,
      bsw_percent: swPercent,
      sw_percent: swPercent,
      ctl: ctlValue,
      cpl: cplValue,
      ctlp: ctlpValue,
      gv: gvValue,
      gross_volume: gvValue,
      gross_volume_bbl: gvValue,
      mf: mfValue,
      csw: cswValue,
      gsv: gsvValue,
      calculated_nsv_before_adjustment: baseNsvValue,
      base_nsv: baseNsvValue,
      nsv: nsvValue,
      net_volume_bbl: nsvValue,
      net_volume_adjustment_bbl: netVolumeAdjustmentBbl,
      manual_net_volume_adjustment_bbl: netVolumeAdjustmentBbl,
      net_volume_adjustment_reason: netVolumeAdjustmentReason || null,
      refined_unit_type: values.refined_unit_type || null,
      unit_of_measure_type: values.refined_unit_type || null,
      refined_product_type: values.refined_product_type || null,
      product_code: values.refined_product_type || null,
      product_type: values.refined_product_type || observed.product_type || null,
      refined_destination: values.refined_destination || null,
      movement_destination: values.refined_destination || null,
      destination: values.refined_destination || null,
      batch_number: values.batch_number || null,
      batch_no: values.batch_number || null,
      ticket_prepared_by: values.ticket_prepared_by || null,
      loaded_by_name: values.ticket_prepared_by || null,
      company_representative_name: values.company_representative_name || null,
      company_rep_name: values.company_representative_name || null,
      calculation_method_used: values.calculation_method_used || getTicketCalculationMethodLabel(selectedTicket),
      open_date: values.open_date || null,
      open_time: values.open_time || null,
      close_date: values.close_date || null,
      close_time: values.close_time || null,
      lease_name: getTicketPdfLeaseName(selectedTicket, meters.find((m: any) => m.id === selectedTicket.meter_id), leases.find((l: any) => l.id === selectedTicket.lease_id), observed) || observed.lease_name || null,
      notes: values.notes || null,
      draft_edited_at: new Date().toISOString(),
    }

    if (isApprovedRevision) {
      const previousRevisionNumber = Number(observed.revision_number || 0)
      const nextRevisionNumber = previousRevisionNumber + 1
      const revisionEntry = {
        revision_number: nextRevisionNumber,
        revised_at: new Date().toISOString(),
        reason: String(revisionNote || '').trim(),
        old_inputs: oldRevisionSnapshot.observed_inputs,
        old_calculation_results: oldRevisionSnapshot.calculation_results,
      }

      nextObservedInputs.revision_number = nextRevisionNumber
      nextObservedInputs.revised_at = revisionEntry.revised_at
      nextObservedInputs.revision_reason = revisionEntry.reason
      nextObservedInputs.revision_history = [
        ...(Array.isArray(observed.revision_history) ? observed.revision_history : []),
        revisionEntry,
      ]
    }

    const nextCalculationResults: any = {
      ...calc,
      iv: totalBatchBarrels,
      gov: totalBatchBarrels,
      total_batch_barrels: totalBatchBarrels,
      opening_reading: openingReading,
      closing_reading: closingReading,
      average_temperature: averageTemperature,
      average_pressure: averagePressure,
      observed_api_gravity: observedApi,
      api_gravity_60: apiGravity60Value,
      corrected_api_gravity: apiGravity60Value,
      density_60: density60Value,
      observed_temperature: observedTemp,
      bsw_percent: swPercent,
      ctl: ctlValue,
      cpl: cplValue,
      ctlp: ctlpValue,
      ctpl: roundTo(ctlValue * cplValue, 6),
      mf: mfValue,
      csw: cswValue,
      ccf: roundTo(ctlValue * cplValue * mfValue, 6),
      gv: gvValue,
      gross_volume: gvValue,
      gross_volume_bbl: gvValue,
      gsv: gsvValue,
      calculated_nsv_before_adjustment: baseNsvValue,
      base_nsv: baseNsvValue,
      nsv: nsvValue,
      net_volume_bbl: nsvValue,
      net_volume_adjustment_bbl: netVolumeAdjustmentBbl,
      manual_net_volume_adjustment_bbl: netVolumeAdjustmentBbl,
      net_volume_adjustment_reason: netVolumeAdjustmentReason || null,
      refined_unit_type: values.refined_unit_type || null,
      unit_of_measure_type: values.refined_unit_type || null,
      refined_product_type: values.refined_product_type || null,
      product_code: values.refined_product_type || null,
      product_type: values.refined_product_type || calc.product_type || null,
      refined_destination: values.refined_destination || null,
      movement_destination: values.refined_destination || null,
      batch_number: values.batch_number || null,
      ticket_prepared_by: values.ticket_prepared_by || null,
      company_representative_name: values.company_representative_name || null,
      calculation_method_used: values.calculation_method_used || getTicketCalculationMethodLabel(selectedTicket),
      revision_number: isApprovedRevision ? nextObservedInputs.revision_number : calc.revision_number,
      revised_at: isApprovedRevision ? nextObservedInputs.revised_at : calc.revised_at,
    }

    const updatePayload: any = {
      observed_inputs: nextObservedInputs,
      calculation_results: nextCalculationResults,
      observed_api_gravity: observedApi,
      api_gravity_60: apiGravity60Value,
      observed_temperature: observedTemp,
      observed_pressure: averagePressure,
      ctl: ctlValue,
      cpl: cplValue,
      ctpl: nextCalculationResults.ctpl,
      ccf: nextCalculationResults.ccf,
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', selectedTicket.id)
      .select()
      .maybeSingle()

    if (error) {
      alert('Could not save draft ticket edits: ' + error.message)
      return
    }

    const updatedTicket: any = data || { ...selectedTicket, ...updatePayload }

    if (isApprovedRevision) {
      const auditNotes = JSON.stringify({
        revision_number: nextObservedInputs.revision_number,
        reason: String(revisionNote || '').trim(),
        ticket_number: selectedTicket.ticket_number || selectedTicket.id,
        old_snapshot: oldRevisionSnapshot,
        new_snapshot: {
          observed_inputs: nextObservedInputs,
          calculation_results: nextCalculationResults,
        },
      })

      const { error: auditError } = await supabase
        .from('ticket_audit_log')
        .insert({
          company_id: companyId || (selectedTicket as any).company_id || null,
          ticket_id: selectedTicket.id,
          action: 'approved_ticket_revision',
          old_status: selectedTicket.status || 'approved',
          new_status: 'approved',
          notes: auditNotes,
        })

      if (auditError) {
        console.warn('Ticket revision saved, but audit log failed:', auditError)
        alert('Ticket revised, but the audit log entry failed: ' + auditError.message)
      }
    }

    setSelectedTicket(updatedTicket)
    setIsDraftTicketEditOpen(false)

    if (String(updatedTicket.status || selectedTicket.status || '').toLowerCase() === 'approved') {
      try {
        await saveTicketPdfToSupabase(updatedTicket)
      } catch (pdfError: any) {
        console.warn('Approved ticket PDF refresh failed:', pdfError)
        alert('Ticket saved, but the approved PDF could not be refreshed: ' + (pdfError?.message || 'Unknown PDF error'))
      }
    }

    loadAll()
    alert(String(selectedTicket.status || '').toLowerCase() === 'approved' ? 'Approved ticket revised.' : 'Draft ticket updated.')
  }


  async function deleteDraftTicket(ticket: any) {
    const status = String(ticket?.status || 'draft').toLowerCase()
    if (status !== 'draft') {
      alert('Only draft tickets can be deleted.')
      return
    }

    const ticketLabel = ticket?.ticket_number || ticket?.id || 'this draft ticket'
    const ok = window.confirm(`Delete draft ticket ${ticketLabel}?

This only removes the draft. Approved tickets cannot be deleted here.`)
    if (!ok) return

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticket.id)
      .eq('status', 'draft')

    if (error) {
      console.error('Delete draft ticket failed:', error)
      alert(`Could not delete draft ticket: ${error.message}`)
      return
    }

    if (selectedTicket?.id === ticket.id) setSelectedTicket(null)
    await loadAll()
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

  function getTicketPdfLeaseName(ticket: any, meter: any, lease: any, observed: any) {
    const meterLease = meter?.lease_id ? leases.find((item: any) => item.id === meter.lease_id) : null
    return (
      (lease as any)?.lease_name ||
      (lease as any)?.name ||
      (meterLease as any)?.lease_name ||
      (meterLease as any)?.name ||
      observed?.lease_name ||
      observed?.lease ||
      (lease as any)?.lease_number ||
      (meterLease as any)?.lease_number ||
      ''
    )
  }

  function buildTicketPdfHtml(ticket: any) {
    const producer = producers.find((item: any) => item.id === ticket.producer_id)
    const meter = meters.find((item: any) => item.id === ticket.meter_id)
    const segment = segments.find((item: any) => item.id === ticket.segment_id)
    const lease = leases.find((item: any) => item.id === ticket.lease_id)

    const observed = ticket.observed_inputs || {}
    const calc = ticket.calculation_results || {}
    const pdfNum = (...values: any[]) => {
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        const num = Number(value)
        if (Number.isFinite(num)) return num
      }
      return null
    }
    const pdfCtl = pdfNum(calc.ctl, observed.ctl) ?? 0
    const pdfCpl = pdfNum(calc.cpl, observed.cpl) ?? 0
    const pdfMf = pdfNum(calc.mf, observed.mf) ?? 1
    const pdfCtpl = pdfNum(calc.ctpl, observed.ctpl) ?? (pdfCtl && pdfCpl ? pdfCtl * pdfCpl : 0)
    const pdfCcf = pdfNum(calc.ccf, observed.ccf) ?? (pdfCtpl ? pdfCtpl * pdfMf : 0)

    // Pull meter opening / closing from Operator Readings monthly history first.
    // This keeps the customer PDF matched to the reading card used in the field.
    const ticketMeterId = String(ticket.meter_id || observed.meter_id || '')
    const ticketLeaseId = String(ticket.lease_id || observed.lease_id || '')
    const ticketCreatedMs = new Date(ticket.created_at || ticket.updated_at || Date.now()).getTime()
    const matchingOperatorReadings = (Array.isArray(readings) ? readings : [])
      .filter((row: any) => {
        const sameMeter = ticketMeterId && String(row.meter_id || '') === ticketMeterId
        const sameLease = ticketLeaseId && String(row.lease_id || '') === ticketLeaseId
        return sameMeter || sameLease
      })
      .sort((a: any, b: any) => {
        const aMs = new Date(a.reading_date || a.created_at || 0).getTime()
        const bMs = new Date(b.reading_date || b.created_at || 0).getTime()
        const aBefore = aMs <= ticketCreatedMs ? 1 : 0
        const bBefore = bMs <= ticketCreatedMs ? 1 : 0
        if (aBefore !== bBefore) return bBefore - aBefore
        return Math.abs(ticketCreatedMs - aMs) - Math.abs(ticketCreatedMs - bMs)
      })
    const pdfOperatorReading = matchingOperatorReadings[0] || {}

    const pdfOpeningReading = pdfNum(
      pdfOperatorReading.opening_reading,
      pdfOperatorReading.opening_meter_reading,
      pdfOperatorReading.open_reading,
      pdfOperatorReading.open_meter_reading,
      calc.opening_reading,
      calc.opening_meter_reading,
      observed.opening_reading,
      observed.open_meter_reading,
      observed.opening_meter_reading,
      observed.meter_open,
      observed.opening_meter,
      ticket.opening_reading,
      ticket.opening_meter_reading
    )
    const pdfClosingReading = pdfNum(
      pdfOperatorReading.closing_reading,
      pdfOperatorReading.closing_meter_reading,
      pdfOperatorReading.close_reading,
      pdfOperatorReading.close_meter_reading,
      calc.closing_reading,
      calc.closing_meter_reading,
      observed.closing_reading,
      observed.close_meter_reading,
      observed.closing_meter_reading,
      observed.meter_close,
      observed.closing_meter,
      (ticket as any).closing_reading,
      (ticket as any).closing_meter_reading
    )
    const pdfReadingIv = pdfOpeningReading !== null && pdfClosingReading !== null ? pdfClosingReading - pdfOpeningReading : null
    const pdfGsvForIv = pdfNum(calc.gsv, observed.gsv, observed.gross_standard_volume, observed.gross_standard_volume_bbl)
    const pdfIvFromGsv = pdfCcf && pdfGsvForIv !== null ? pdfGsvForIv / pdfCcf : null
    const pdfIv = pdfNum(
      calc.iv,
      calc.gov,
      calc.total_batch_barrels,
      observed.total_batch_barrels,
      observed.indicated_volume,
      observed.gross_volume_bbl,
      observed.iv,
      observed.gov,
      ticket.total_batch_barrels,
      ticket.indicated_volume,
      ticket.iv,
      ticket.gov,
      pdfReadingIv,
      pdfIvFromGsv
    ) ?? 0
    const pdfLeaseName = getTicketPdfLeaseName(ticket, meter, lease, observed)
    const isFlowX = observed.source === 'flowx_transporter_summary'

    const companyName = getCompanyDisplayName ? getCompanyDisplayName() : (companySettings?.company_name || 'Measurement Platform')
    const logoUrl = (typeof getCompanyLogoUrl === 'function' ? getCompanyLogoUrl() : '') || companySettings?.logo_url || ''
    const ticketNumber = ticket.ticket_number || ticket.id || 'Ticket'
    const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : new Date().toLocaleString()
    const approvedAt = ticket.approved_at ? new Date(ticket.approved_at).toLocaleString() : 'Pending Approval'
    const pdfRevisionNumber = observed.revision_number || calc.revision_number || 0
    const pdfRevisionReason = observed.revision_reason || ''
    const pdfRevisionAt = observed.revised_at || calc.revised_at || ''

    const transporter = ticket.transporter_name || observed.transporter_name || ticket.customer_name || (ticket.ticket_type === 'meter' ? 'Pipeline Meter' : '—')
    const refinedProductPdf = observed.refined_product_type || calc.refined_product_type || observed.product_code || calc.product_code || observed.product_type || calc.product_type || '—'
    const refinedUnitPdf = observed.refined_unit_type || calc.refined_unit_type || observed.unit_of_measure_type || calc.unit_of_measure_type || '—'
    const refinedDestinationPdf = observed.refined_destination || calc.refined_destination || observed.movement_destination || observed.destination || '—'
    const batchNumberPdf = observed.batch_number || calc.batch_number || ticket.batch_number || observed.batch_no || '—'
    const assignedPot = observed.assigned_pot_label || ticket.assigned_pot_id || (observed.pot_source === 'latest_pot_quality' ? 'Sample POT' : '—')
    const potQualitySource = observed.pot_source === 'latest_pot_quality' ? 'Latest POT Quality' : assignedPot
    const pdfRvp = observed.rvp || parsePotExtra(observed.notes, 'rvp') || '—'
    const pdfSulfur = observed.sulfur || parsePotExtra(observed.notes, 'sulfur') || parsePotExtra(observed.notes, 'sulphur') || '—'
    const sourceTicketCount = uniqueCsvCount(observed.ticket_numbers)
    const sourceBatchCount = uniqueCsvCount(observed.batch_numbers)
    const sourceTruckCount = uniqueCsvCount(observed.truck_numbers)
    const sourceLeaseCount = uniqueCsvCount(observed.leases)

    const isTankTicketPdf = String(ticket.ticket_type || observed.ticket_type || '').toLowerCase() === 'tank' || observed.tank_id || calc.tank_gov || calc.tank_nsv
    if (isTankTicketPdf) {
      const tank = tanks.find((item: any) => String(item.id) === String(observed.tank_id || ticket.tank_id || ''))
      const tankCalibration = tankCalibrationVersions.find((item: any) =>
        String(item.id) === String(observed.tank_calibration_version_id || calc.tank_calibration_version_id || '')
      )
      const tankName = tank
        ? `${tank.tank_number || ''}${tank.tank_name ? ` - ${tank.tank_name}` : ''}`.trim()
        : (observed.tank_name || observed.tank_number || 'Tank Ticket')
      const strapName = observed.tank_calibration_name || (tankCalibration ? getTankCalibrationLabel(tankCalibration) : '—')
      const tankNum = (...values: any[]) => pdfNum(...values)
      const tankText = (...values: any[]) => {
        for (const value of values) {
          if (value === null || value === undefined || value === '') continue
          return String(value)
        }
        return '—'
      }
      const fmtNum = (value: any, digits = 2) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? formatMeasurementNumber(Number(value), digits) : '—'
      const fmtBbl = (value: any) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? formatBbl(Number(value)) : '—'

      const openingGauge = tankNum(observed.opening_gauge_decimal, observed.tank_opening_gauge_decimal, calc.tank_opening_gauge_decimal)
      const closingGauge = tankNum(observed.closing_gauge_decimal, observed.tank_closing_gauge_decimal, calc.tank_closing_gauge_decimal)
      const openingWaterGauge = tankNum(observed.tank_opening_water_gauge_decimal, calc.tank_opening_water_gauge_decimal)
      const closingWaterGauge = tankNum(observed.tank_closing_water_gauge_decimal, calc.tank_closing_water_gauge_decimal)
      const openingTov = tankNum(observed.tank_opening_tov, calc.tank_opening_tov)
      const closingTov = tankNum(observed.tank_closing_tov, calc.tank_closing_tov)
      const openingFw = tankNum(observed.tank_opening_free_water_bbl, calc.tank_opening_free_water_bbl)
      const closingFw = tankNum(observed.tank_closing_free_water_bbl, calc.tank_closing_free_water_bbl)
      const openingGov = tankNum(observed.tank_opening_gov, calc.tank_opening_gov)
      const closingGov = tankNum(observed.tank_closing_gov, calc.tank_closing_gov)
      const openingGsv = tankNum(observed.tank_opening_gsv, calc.tank_opening_gsv)
      const closingGsv = tankNum(observed.tank_closing_gsv, calc.tank_closing_gsv)
      const openingNsv = tankNum(observed.tank_opening_nsv, calc.tank_opening_nsv)
      const closingNsv = tankNum(observed.tank_closing_nsv, calc.tank_closing_nsv)
      const tankGov = tankNum(calc.tank_gov, observed.tank_gov, calc.gov, observed.gov)
      const tankGsv = tankNum(calc.gsv, observed.gsv, calc.tank_gsv, observed.tank_gsv)
      const tankNsv = tankNum(calc.nsv, observed.nsv, calc.tank_nsv, observed.tank_nsv)
      const tankTovMovement = tankNum(observed.tank_tov_movement_bbl, calc.tank_tov_movement_bbl)
      const tankFwMovement = tankNum(observed.tank_free_water_movement_bbl, calc.tank_free_water_movement_bbl)
      const tankCtsh = tankNum(calc.tank_ctsh, observed.tank_ctsh)
      const tankShellTemp = tankNum(calc.tank_shell_temp, observed.tank_shell_temp, observed.tank_shell_temperature)
      const tankFRAOpen = tankNum(observed.tank_opening_roof_adjustment_bbl, calc.tank_opening_roof_adjustment_bbl)
      const tankFRAClose = tankNum(observed.tank_closing_roof_adjustment_bbl, calc.tank_closing_roof_adjustment_bbl)
      const roofWeight = tankNum(observed.tank_roof_weight_lbs, calc.tank_roof_weight_lbs, tankCalibration?.roof_weight_lbs)
      const referenceApi = tankNum(observed.tank_roof_reference_api, calc.tank_roof_reference_api, tankCalibration?.roof_reference_api)
      const referenceSg = tankNum(observed.tank_roof_reference_sg, calc.tank_roof_reference_sg, tankCalibration?.roof_reference_sg)
      const api60 = tankNum(calc.api_gravity_60, observed.api_gravity_60, observed.tank_api_gravity_60, calc.api_gravity, observed.api_gravity)
      const observedApi = tankNum(observed.observed_api_gravity, observed.tank_observed_gravity, observed.observed_gravity, observed.api_observed, observed.api_gravity_observed)
      const observedTemp = tankNum(observed.observed_temperature, observed.tank_observed_temp, observed.observed_temp, observed.temperature)
      const averageTemp = tankNum(observed.tank_average_temp, observed.average_temperature, calc.average_temperature)
      const ambientTemp = tankNum(observed.tank_ambient_temp, observed.ambient_temperature)
      const api60ForPdf = api60 || (
        observedApi
          ? Number(calculateApi11Corrections({
              productGroup: 'crude',
              observedApiGravity: Number(observedApi),
              observedTemperature: Number(observedTemp || averageTemp || 60),
              observedPressure: 0,
              averageTemperature: Number(averageTemp || observedTemp || 60),
              averagePressure: 0,
              apiRounding: 1,
            }).api_gravity_60 || observedApi)
          : null
      )
      const actualSg = api60ForPdf ? apiToSpecificGravity(api60ForPdf) : null
      const swPercent = tankNum(calc.bsw_percent, observed.bsw_percent, observed.bsw, observed.tank_sw_percent)
      const cswValue = tankNum(calc.csw, observed.csw)
      const ctlValue = tankNum(calc.ctl, observed.ctl, calc.ccf, observed.ccf)
      const criticalGaugeStart = tankNum(tankCalibration?.roof_critical_gauge, observed.tank_roof_critical_gauge)
      const criticalGaugeEnd = tankNum(tankCalibration?.roof_critical_gauge_end, observed.tank_roof_critical_gauge_end)
      const openingSource = tankText(observed.tank_opening_source_ticket_number, observed.opening_source_ticket_number)
      const movementDirection = tankText(observed.tank_movement_direction, observed.movement_direction, ticket.movement_direction)
      const revisionLabel = pdfRevisionNumber ? `Revision ${pdfRevisionNumber}` : 'Original'

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${ticketNumber} Tank Ticket</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f5; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; }
    .pdf-back-button { position: fixed; top: 10px; left: 10px; z-index: 9999; background: #c00000; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
    .page { width: 8.5in; min-height: 11in; margin: 0 auto; background: #fff; padding: 0.22in; }
    .topbar { height: 6px; background: #c46a2b; margin: -0.22in -0.22in 0.12in; }
    .header { display: grid; grid-template-columns: 1fr 220px; gap: 18px; border-bottom: 2px solid #111827; padding-bottom: 7px; margin-bottom: 6px; align-items: center; }
    .brand-row { display: flex; align-items: center; gap: 14px; }
    .logo { width: 88px; max-height: 42px; object-fit: contain; }
    .brand-title { font-size: 19px; font-weight: 900; margin-bottom: 3px; }
    .brand-subtitle { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.4px; }
    .ticket-box { border: 2px solid #111827; padding: 10px 12px; text-align: right; }
    .ticket-box .label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
    .ticket-box .number { font-size: 15px; font-weight: 900; margin-top: 3px; }
    .status { display: inline-block; margin-top: 6px; padding: 4px 8px; border-radius: 999px; background: ${ticket.status === 'approved' ? '#dcfce7' : '#fef3c7'}; color: ${ticket.status === 'approved' ? '#166534' : '#92400e'}; font-weight: 800; text-transform: uppercase; font-size: 9px; }
    .hero { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin: 6px 0; }
    .hero-card { border: 2px solid #111827; padding: 9px; min-height: 50px; }
    .hero-card.primary { background: #111827; color: #fff; }
    .hero-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; font-weight: 800; }
    .hero-card.primary .hero-label { color: #d1d5db; }
    .hero-value { font-size: 17px; font-weight: 900; margin-top: 6px; }
    .hero-sub { font-size: 10px; margin-top: 4px; color: #6b7280; }
    .hero-card.primary .hero-sub { color: #d1d5db; }
    .section { border: 1px solid #d1d5db; margin-top: 5px; break-inside: avoid; }
    .section-title { background: #111827; color: #fff; font-weight: 900; padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.7px; font-size: 9.5px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; }
    .cell { padding: 4px 6px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; min-height: 24px; }
    .grid-3 .cell:nth-child(3n), .grid-4 .cell:nth-child(4n) { border-right: 0; }
    .small-label { color: #6b7280; font-size: 8px; text-transform: uppercase; letter-spacing: 0.55px; margin-bottom: 3px; }
    .value { font-size: 11.5px; font-weight: 800; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; padding: 4px 5px; border-bottom: 1px solid #d1d5db; }
    td { padding: 4px 5px; border-bottom: 1px solid #e5e7eb; font-weight: 700; }
    .right { text-align: right; }
    .notes { white-space: pre-wrap; min-height: 24px; padding: 8px; }
    .formula { font-family: 'Courier New', monospace; font-size: 10px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 4px; margin-bottom: 3px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px; margin-top: 14px; }
    .sig-line { border-top: 1px solid #111827; padding-top: 4px; color: #374151; font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; }
    .footer { margin-top: 8px; border-top: 1px solid #d1d5db; padding-top: 4px; display: flex; justify-content: space-between; color: #6b7280; font-size: 9px; }
    @media print { body { background: #fff; } .pdf-back-button { display: none; } .page { margin: 0; width: auto; min-height: auto; } @page { size: letter; margin: 0.18in; } }
  </style>
</head>
<body>
<button class="pdf-back-button" onclick="window.close();setTimeout(()=>history.back(),100)">← Back to App</button>
  <div class="page">
    <div class="topbar"></div>
    <div class="header">
      <div class="brand-row">
        ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ''}
        <div>
          <div class="brand-title">${companyName}</div>
          <div class="brand-subtitle">API MPMS Chapter 12.1 Tank Gauge Ticket</div>
        </div>
      </div>
      <div class="ticket-box">
        <div class="label">Tank Ticket Number</div>
        <div class="number">${ticketNumber}</div>
        <div class="label" style="margin-top:4px;">Batch</div>
        <div class="number" style="font-size:12px;">${batchNumberPdf}</div>
        <div class="status">${ticket.status || 'draft'}</div>
        <div class="hero-sub">${revisionLabel}</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-card"><div class="hero-label">Opening NSV</div><div class="hero-value">${fmtBbl(openingNsv)}</div><div class="hero-sub">Previous approved inventory</div></div>
      <div class="hero-card"><div class="hero-label">Closing NSV</div><div class="hero-value">${fmtBbl(closingNsv)}</div><div class="hero-sub">Current calculated inventory</div></div>
      <div class="hero-card primary"><div class="hero-label">Net Movement NSV</div><div class="hero-value">${fmtBbl(tankNsv)}</div><div class="hero-sub">Custody transfer net barrels</div></div>
    </div>

    <div class="section"><div class="section-title">Tank / Movement Information</div><div class="grid-4">
      <div class="cell"><div class="small-label">Tank</div><div class="value">${tankName}</div></div>
      <div class="cell"><div class="small-label">Strap / Leg</div><div class="value">${strapName}</div></div>
      <div class="cell"><div class="small-label">Movement</div><div class="value">${movementDirection}</div></div>
      <div class="cell"><div class="small-label">Batch Number</div><div class="value">${batchNumberPdf}</div></div>
      <div class="cell"><div class="small-label">Product</div><div class="value">${refinedProductPdf}</div></div>
      <div class="cell"><div class="small-label">Unit / Measure</div><div class="value">${refinedUnitPdf}</div></div>
      <div class="cell"><div class="small-label">Destination / To</div><div class="value">${refinedDestinationPdf}</div></div>
      <div class="cell"><div class="small-label">Segment</div><div class="value">${segment?.name || observed.segment_name || '—'}</div></div>
      <div class="cell"><div class="small-label">Opening Source</div><div class="value">${openingSource}</div></div>
      <div class="cell"><div class="small-label">Close Date / Time</div><div class="value">${observed.close_date || '—'} ${observed.close_time || ''}</div></div>
      <div class="cell"><div class="small-label">Created</div><div class="value">${createdAt}</div></div>
      <div class="cell"><div class="small-label">Approved</div><div class="value">${approvedAt}</div></div>
    </div></div>

    <div class="section"><div class="section-title">API 12.1 Inventory Calculation</div>
      <table><thead><tr><th>Description</th><th class="right">Opening</th><th class="right">Closing</th><th class="right">Movement</th></tr></thead><tbody>
        <tr><td>Oil Gauge, decimal ft</td><td class="right">${fmtNum(openingGauge, 4)}</td><td class="right">${fmtNum(closingGauge, 4)}</td><td class="right">—</td></tr>
        <tr><td>Water Gauge, decimal ft</td><td class="right">${fmtNum(openingWaterGauge, 4)}</td><td class="right">${fmtNum(closingWaterGauge, 4)}</td><td class="right">—</td></tr>
        <tr><td>Total Observed Volume / TOV</td><td class="right">${fmtBbl(openingTov)}</td><td class="right">${fmtBbl(closingTov)}</td><td class="right">${fmtBbl(tankTovMovement)}</td></tr>
        <tr><td>Free Water / FW</td><td class="right">${fmtBbl(openingFw)}</td><td class="right">${fmtBbl(closingFw)}</td><td class="right">${fmtBbl(tankFwMovement)}</td></tr>
        <tr><td>Floating Roof Adjustment / FRA</td><td class="right">${fmtBbl(tankFRAOpen)}</td><td class="right">${fmtBbl(tankFRAClose)}</td><td class="right">${tankFRAOpen !== null && tankFRAClose !== null ? fmtBbl(Math.abs(tankFRAClose - tankFRAOpen)) : '—'}</td></tr>
        <tr><td>Gross Observed Volume / GOV</td><td class="right">${fmtBbl(openingGov)}</td><td class="right">${fmtBbl(closingGov)}</td><td class="right">${fmtBbl(tankGov)}</td></tr>
        <tr><td>Gross Standard Volume / GSV</td><td class="right">${fmtBbl(openingGsv)}</td><td class="right">${fmtBbl(closingGsv)}</td><td class="right">${fmtBbl(tankGsv)}</td></tr>
        <tr><td>Net Standard Volume / NSV</td><td class="right">${fmtBbl(openingNsv)}</td><td class="right">${fmtBbl(closingNsv)}</td><td class="right">${fmtBbl(tankNsv)}</td></tr>
      </tbody></table>
    </div>

    <div class="section"><div class="section-title">Correction Factors / Product Quality</div><div class="grid-4">
      <div class="cell"><div class="small-label">Observed API</div><div class="value">${fmtNum(observedApi, 2)}</div></div>
      <div class="cell"><div class="small-label">Observed Temp °F</div><div class="value">${fmtNum(observedTemp, 2)}</div></div>
      <div class="cell"><div class="small-label">API @60</div><div class="value">${fmtNum(api60ForPdf, 1)}</div></div>
      <div class="cell"><div class="small-label">Actual SG @60</div><div class="value">${fmtNum(actualSg, 6)}</div></div>
      <div class="cell"><div class="small-label">Average Liquid Temp</div><div class="value">${fmtNum(averageTemp, 2)}</div></div>
      <div class="cell"><div class="small-label">Ambient Temp</div><div class="value">${fmtNum(ambientTemp, 2)}</div></div>
      <div class="cell"><div class="small-label">Shell Temp</div><div class="value">${fmtNum(tankShellTemp, 2)}</div></div>
      <div class="cell"><div class="small-label">CTSh</div><div class="value">${fmtNum(tankCtsh, 6)}</div></div>
      <div class="cell"><div class="small-label">CTL / VCF</div><div class="value">${fmtNum(ctlValue, 6)}</div></div>
      <div class="cell"><div class="small-label">S&W %</div><div class="value">${fmtNum(swPercent, 4)}</div></div>
      <div class="cell"><div class="small-label">CSW</div><div class="value">${fmtNum(cswValue, 6)}</div></div>
      <div class="cell"><div class="small-label">CPL</div><div class="value">1.000000</div></div>
    </div></div>

    <div class="section"><div class="section-title">Floating Roof / Strapping Details</div><div class="grid-4">
      <div class="cell"><div class="small-label">Roof Mode</div><div class="value">${observed.tank_roof_correction_mode || tankCalibration?.roof_correction_mode || 'FRA'}</div></div>
      <div class="cell"><div class="small-label">Roof Weight</div><div class="value">${roofWeight !== null ? `${fmtNum(roofWeight, 0)} lb` : '—'}</div></div>
      <div class="cell"><div class="small-label">Reference API</div><div class="value">${fmtNum(referenceApi, 1)}</div></div>
      <div class="cell"><div class="small-label">Reference SG</div><div class="value">${fmtNum(referenceSg, 6)}</div></div>
      <div class="cell"><div class="small-label">Opening FRA</div><div class="value">${fmtBbl(tankFRAOpen)}</div></div>
      <div class="cell"><div class="small-label">Closing FRA</div><div class="value">${fmtBbl(tankFRAClose)}</div></div>
      <div class="cell"><div class="small-label">Critical Start</div><div class="value">${fmtNum(criticalGaugeStart, 4)} ft</div></div>
      <div class="cell"><div class="small-label">Critical End</div><div class="value">${fmtNum(criticalGaugeEnd, 4)} ft</div></div>
    </div></div>

    <div class="section"><div class="section-title">Calculation Method</div><div class="notes formula">
      GOV = [(TOV − FW) × CTSh] ± FRA &nbsp; | &nbsp; GSV = GOV × CTL &nbsp; | &nbsp; NSV = GSV × CSW &nbsp; | &nbsp; FRA = RW ÷ (350.16 × Ref SG) − RW ÷ (350.16 × Actual SG)
    </div></div>

    <div class="section"><div class="section-title">Audit / Notes</div>
      <div class="grid-3"><div class="cell"><div class="small-label">Prepared By</div><div class="value">${tankText(observed.gauged_by, observed.prepared_by, ticket.created_by_name, ticket.created_by)}</div></div><div class="cell"><div class="small-label">Approved By</div><div class="value">${tankText(observed.approved_by_name, ticket.approved_by_name, ticket.approved_by)}</div></div><div class="cell"><div class="small-label">Revision</div><div class="value">${revisionLabel}</div></div></div>
      <div class="notes">${ticket.notes || observed.notes || ''}</div>
    </div>

    <div class="signatures"><div class="sig-line">Gauged By / Date</div><div class="sig-line">Verified By / Date</div><div class="sig-line">Approved By / Date</div></div>
    <div class="footer"><div>Generated by TEFCO Measurement Platform</div><div>Page 1 of 1 • ${new Date().toLocaleString()}</div></div>
  </div>
  <script>window.onload = () => { window.focus(); };</script>
</body>
</html>`

      return html
    }

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
    }
    .pdf-back-button {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 9999;
      background: #c00000;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      cursor: pointer;
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
      font-size: 19px;
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
      font-size: 9.5px;
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
      font-size: 15px;
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
      padding-top: 4px;
      color: #374151;
      font-size: 9.5px;
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
<button class="pdf-back-button" onclick="window.close();setTimeout(()=>history.back(),100)">← Back to App</button>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ''}
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
        <div class="cell"><div class="small-label">Revision</div><div class="value">${pdfRevisionNumber ? `Revision ${pdfRevisionNumber}` : 'Original'}</div></div>
        <div class="cell"><div class="small-label">Batch Number</div><div class="value">${batchNumberPdf}</div></div>
        <div class="cell"><div class="small-label">Revision Reason</div><div class="value">${pdfRevisionReason || '—'}</div></div>
        <div class="cell"><div class="small-label">Revised At</div><div class="value">${pdfRevisionAt ? new Date(pdfRevisionAt).toLocaleString() : '—'}</div></div>
        <div class="cell"><div class="small-label">Segment</div><div class="value">${segment?.name || observed.segment_name || '—'}</div></div>
        <div class="cell"><div class="small-label">Producer</div><div class="value">${producer?.name || observed.producer_name || '—'}</div></div>
        <div class="cell"><div class="small-label">Lease</div><div class="value">${pdfLeaseName || (isFlowX ? `${sourceLeaseCount || '—'} lease(s)` : '—')}</div></div>
        <div class="cell"><div class="small-label">Meter / Rack</div><div class="value">${meter?.meter_number || observed.meter_number || '—'}</div></div>
        <div class="cell"><div class="small-label">Transporter</div><div class="value">${transporter}</div></div>
        <div class="cell"><div class="small-label">Product</div><div class="value">${refinedProductPdf}</div></div>
        <div class="cell"><div class="small-label">Unit / Measure</div><div class="value">${refinedUnitPdf}</div></div>
        <div class="cell"><div class="small-label">Destination / To</div><div class="value">${refinedDestinationPdf}</div></div>
        <div class="cell"><div class="small-label">Assigned POT</div><div class="value">${assignedPot}</div></div>
      </div>
    </div>

    ${isFlowX ? `
    <div class="section">
      <div class="section-title">Flow-X Transporter Summary</div>
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
      <div class="section-title">Meter Readings</div>
      <div class="grid-2">
        <div class="cell"><div class="small-label">Opening Meter Reading</div><div class="value">${pdfOpeningReading !== null ? formatMeasurementNumber(pdfOpeningReading, 0) : '—'}</div></div>
        <div class="cell"><div class="small-label">Closing Meter Reading</div><div class="value">${pdfClosingReading !== null ? formatMeasurementNumber(pdfClosingReading, 0) : '—'}</div></div>
        <div class="cell"><div class="small-label">Open Date / Time</div><div class="value">${observed.open_date || '—'} ${observed.open_time || ''}</div></div>
        <div class="cell"><div class="small-label">Close Date / Time</div><div class="value">${observed.close_date || '—'} ${observed.close_time || ''}</div></div>
      </div>
    </div>

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
          <tr><td>Gross Observed / IV</td><td class="right volume">${formatBbl(pdfIv)}</td></tr>
          <tr><td>Gross Standard / GSV</td><td class="right volume">${formatBbl(calc.gsv || observed.gross_volume_bbl)}</td></tr>
          <tr><td>Net Standard / NSV</td><td class="right volume">${formatBbl(calc.nsv || observed.net_volume_bbl)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Quality / Corrections</div>
      <div class="grid-3">
        <div class="cell"><div class="small-label">Observed API</div><div class="value">${formatMeasurementNumber(observed.observed_api_gravity || observed.api_observed || observed.api_gravity_observed, 2)}</div></div>
        <div class="cell"><div class="small-label">API Gravity @ 60°F</div><div class="value">${formatMeasurementNumber(calc.api_gravity_60 || observed.api_gravity_60 || calc.api_gravity || observed.api_gravity, 2)}</div></div>
        <div class="cell"><div class="small-label">BS&W</div><div class="value">${formatMeasurementNumber(calc.bsw_percent || observed.bsw_percent || observed.bsw, 4)}</div></div>
        <div class="cell"><div class="small-label">BSW</div><div class="value">${formatMeasurementNumber(calc.csw || observed.csw, 5)}</div></div>
        <div class="cell"><div class="small-label">RVP</div><div class="value">${pdfRvp}</div></div>
        <div class="cell"><div class="small-label">Sulphur %</div><div class="value">${pdfSulfur}</div></div>
        <div class="cell"><div class="small-label">Observed Temp °F</div><div class="value">${formatMeasurementNumber(observed.observed_temperature || observed.temperature || observed.average_temperature || calc.average_temperature, 2)}</div></div>
        <div class="cell"><div class="small-label">Average Temp °F</div><div class="value">${formatMeasurementNumber(calc.average_temperature || observed.average_temperature, 2)}</div></div>
        <div class="cell"><div class="small-label">Observed Pressure</div><div class="value">${formatMeasurementNumber(observed.observed_pressure || observed.pressure || observed.average_pressure || calc.average_pressure, 2)}</div></div>
        <div class="cell"><div class="small-label">Average Pressure</div><div class="value">${formatMeasurementNumber(calc.average_pressure || observed.average_pressure, 2)}</div></div>
        <div class="cell"><div class="small-label">API Correction Δ</div><div class="value">${formatMeasurementNumber((calc.api_gravity_60 || observed.api_gravity_60 || calc.api_gravity || observed.api_gravity || 0) - (observed.observed_api_gravity || observed.api_observed || observed.api_gravity_observed || 0), 2)}</div></div>
        <div class="cell"><div class="small-label">CTL</div><div class="value">${formatMeasurementNumber(pdfCtl, 6)}</div></div>
        <div class="cell"><div class="small-label">CPL</div><div class="value">${formatMeasurementNumber(pdfCpl, 6)}</div></div>
        <div class="cell"><div class="small-label">CTPL</div><div class="value">${formatMeasurementNumber(pdfCtpl, 6)}</div></div>
        <div class="cell"><div class="small-label">MF / CMF</div><div class="value">${formatMeasurementNumber(pdfMf, 4)}</div></div>
        <div class="cell"><div class="small-label">POT Quality Source</div><div class="value">${potQualitySource}</div></div>
        <div class="cell"><div class="small-label">Calculation Method</div><div class="value">${observed.calculation_method || ticket.calculation_profile_snapshot?.selected_calculation_method || 'Standard'}</div></div>
      </div>
    </div>

    ${isFlowX ? `
    <div class="section">
      <div class="section-title">Source Data</div>
      <div class="notes">
        Source Flow-X CSV retained separately. This ticket is a transporter summary generated from ${observed.source_rows || '—'} source rows.
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

    return html
  }

  function generatePdfPreview(ticket: any) {
    const html = buildTicketPdfHtml(ticket)
    const fileName = `${getTicketPdfFileName(ticket)}.html`
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to preview PDF.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html.replace('</body>', `<script>document.title = ${JSON.stringify(fileName.replace(/\.html$/i, ''))};</script></body>`))
    printWindow.document.close()
  }

  async function loadJsPdf() {
    if ((window as any).jspdf?.jsPDF) return (window as any).jspdf.jsPDF

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-jspdf="true"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('jsPDF failed to load')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.async = true
      script.dataset.jspdf = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load PDF generator.'))
      document.head.appendChild(script)
    })

    if (!(window as any).jspdf?.jsPDF) throw new Error('PDF generator loaded but was not available.')
    return (window as any).jspdf.jsPDF
  }

  function getTicketSavedPdfUrl(ticket: any) {
    return ticket?.ticket_pdf_url || ticket?.pdf_url || ticket?.observed_inputs?.ticket_pdf_url || ticket?.calculation_results?.ticket_pdf_url || ''
  }

  function getTicketSavedPdfPath(ticket: any) {
    return ticket?.ticket_pdf_path || ticket?.pdf_path || ticket?.observed_inputs?.ticket_pdf_path || ticket?.calculation_results?.ticket_pdf_path || ''
  }

  function getTicketCalculationMethodLabel(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}
    const snapshot = ticket?.calculation_profile_snapshot || {}
    const raw =
      observed.calculation_method_used ||
      observed.formula_profile ||
      calc.calculation_method_used ||
      calc.formula_profile ||
      ticket?.calculation_method ||
      ticket?.api_chapter ||
      snapshot.selected_standard ||
      snapshot.standard ||
      snapshot.calculation_method ||
      ''

    const textValue = String(raw || '').trim()
    const lower = textValue.toLowerCase()

    if (lower.includes('12.1')) return textValue.includes('2021') ? 'API 12.1 - 2021' : `API 12.1${textValue ? ` - ${textValue}` : ''}`
    if (lower.includes('api 12') || lower.includes('chapter 12')) return textValue.includes('2021') ? 'API 12 - 2021' : 'API 12 - 2021'
    if (lower.includes('11.1')) {
      if (lower.includes('2019')) return 'API 11.1 - 2019'
      if (lower.includes('2007')) return 'API 11.1 - 2007'
      if (lower.includes('2004')) return 'API 11.1 - 2004'
      if (lower.includes('1980')) return 'API 11.1 - 1980'
      return 'API 11.1'
    }
    if (lower.includes('api')) return textValue

    return textValue || '—'
  }

  function getTicketPdfDisplayRows(ticket: any) {
    const observed = ticket.observed_inputs || {}
    const calc = ticket.calculation_results || {}
    const meter = meters.find((item: any) => String(item.id || '') === String(ticket.meter_id || observed.meter_id || ''))
    const lease = leases.find((item: any) => String(item.id || '') === String(ticket.lease_id || observed.lease_id || meter?.lease_id || ''))
    const segment = segments.find((item: any) => String(item.id || '') === String(ticket.segment_id || observed.segment_id || ''))
    const producer = producers.find((item: any) => String(item.id || '') === String(ticket.producer_id || observed.producer_id || lease?.producer_id || meter?.producer_id || ''))
    const value = (v: any) => v === null || v === undefined || v === '' ? '—' : String(v)
    const num = (v: any, digits = 2) => {
      const n = Number(v)
      return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'
    }

    return [
      ['Ticket Number', value(ticket.ticket_number || ticket.id)],
      ['Batch Number', value(observed.batch_number || calc.batch_number || ticket.batch_number)],
      ['Status', value(ticket.status)],
      ['Calculation Method', value(getTicketCalculationMethodLabel(ticket))],
      ['Producer', value(producer?.name || observed.producer_name)],
      ['Segment', value(segment?.segment_name || segment?.name || observed.segment_name)],
      ['Lease', value(lease?.lease_name || lease?.name || observed.lease_name)],
      ['Meter', value(meter?.meter_number || meter?.meter_name || observed.meter_number)],
      ['Product', value(
        observed.product_code ||
        calc.product_code ||
        observed.refined_product_type ||
        calc.refined_product_type ||
        observed.product_name ||
        calc.product_name ||
        observed.product_type
      )],
      ['Destination / To', value(observed.refined_destination || calc.refined_destination || observed.movement_destination)],
      ['Your Name', value(observed.ticket_prepared_by || observed.loaded_by_name || calc.ticket_prepared_by)],
      ['Company Representative', value(observed.company_representative_name || observed.company_rep_name || calc.company_representative_name)],
      ['Open Date / Time', `${value(observed.open_date)} ${observed.open_time || ''}`.trim()],
      ['Close Date / Time', `${value(observed.close_date)} ${observed.close_time || ''}`.trim()],
      ['Opening Reading', value(calc.opening_reading ?? observed.opening_reading ?? observed.opening_meter_reading)],
      ['Closing Reading', value(calc.closing_reading ?? observed.closing_reading ?? observed.closing_meter_reading)],
      ['IV', num(calc.iv ?? calc.gov ?? observed.iv ?? observed.gov ?? observed.total_batch_barrels, 2)],
      ['Observed API', num(observed.observed_api_gravity ?? observed.api_observed ?? calc.observed_api_gravity, 2)],
      ['API @60', num(calc.api_gravity_60 ?? observed.api_gravity_60 ?? calc.api_gravity, 1)],
      ['Observed Temp', num(observed.observed_temperature ?? observed.temperature, 2)],
      ['Avg Temp', num(observed.average_temperature ?? observed.avg_temp ?? calc.average_temperature, 2)],
      ['Avg Pressure', num(observed.average_pressure ?? observed.avg_pressure ?? calc.average_pressure, 2)],
      ['CTL', num(calc.ctl ?? observed.ctl, 6)],
      ['CPL', num(calc.cpl ?? observed.cpl, 6)],
      ['CTPL', num(calc.ctpl ?? observed.ctpl, 6)],
      ['MF / CMF', num(calc.mf ?? observed.mf, 4)],
      ['GSV', num(calc.gsv ?? observed.gsv, 2)],
      ['NSV', num(calc.nsv ?? observed.nsv ?? observed.net_volume_bbl, 2)],
      ['BS&W %', num(calc.bsw_percent ?? observed.bsw_percent ?? observed.bsw, 4)],
      ['CSW', num(calc.csw ?? observed.csw, 6)],
      ['Notes', value(ticket.notes || observed.notes)],
    ]
  }

  async function generateTicketPdfBlob(ticket: any) {
    const JsPDF = await loadJsPdf()
    const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 30
    const accentHex = getCompanyAccentColor()
    const accentRgb = hexToRgb(accentHex)
    const ticketNumber = String(ticket.ticket_number || ticket.id || 'Ticket')
    const fileBaseName = getTicketPdfFileName(ticket)
    const rows = getTicketPdfDisplayRows(ticket)
    const rowMap: Record<string, string> = {}
    rows.forEach(([label, value]) => { rowMap[String(label)] = String(value ?? '—') })

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      doc.setDrawColor(17, 24, 39)
      doc.setLineWidth(0.6)
      doc.line(x1, y1, x2, y2)
    }

    const cell = (x: number, y: number, w: number, h: number, label: string, value: string, fill = false) => {
      doc.setDrawColor(209, 213, 219)
      doc.setLineWidth(0.4)
      if (fill) {
        doc.setFillColor(249, 250, 251)
        doc.rect(x, y, w, h, 'FD')
      } else {
        doc.rect(x, y, w, h)
      }
      doc.setTextColor(17, 24, 39)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.text(label, x + 5, y + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(String(value || '—'), w - 10)
      doc.text(lines.slice(0, 1), x + 5, y + 21)
    }

    const tableRow = (x: number, y: number, labelW: number, valueW: number, label: string, value: string, h = 15) => {
      doc.setDrawColor(209, 213, 219)
      doc.setLineWidth(0.35)
      doc.setFillColor(249, 250, 251)
      doc.rect(x, y, labelW, h, 'FD')
      doc.rect(x + labelW, y, valueW, h)
      doc.setTextColor(17, 24, 39)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.2)
      doc.text(label, x + 4, y + 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.2)
      const lines = doc.splitTextToSize(String(value || '—'), valueW - 8)
      doc.text(lines.slice(0, 1), x + labelW + 4, y + 10)
    }

    const sectionTitle = (title: string, x: number, y: number, w: number) => {
      doc.setFillColor(17, 24, 39)
      doc.rect(x, y, w, 15, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.text(title.toUpperCase(), x + 5, y + 10)
    }

    // Top brand stripe
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b)
    doc.rect(0, 0, pageWidth, 8, 'F')

    // Logo / company header
    const logoUrl = getCompanyLogoUrl()
    if (logoUrl) {
      try {
        const logoData = await getImageDataUrl(logoUrl)
        if (logoData) {
          doc.addImage(logoData, 'PNG', margin, 24, 82, 38, undefined, 'FAST')
        }
      } catch (error) {
        console.warn('Ticket PDF logo failed:', error)
      }
    }

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(getCompanyDisplayName(), logoUrl ? margin + 95 : margin, 38)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('CUSTODY TRANSFER TICKET', pageWidth / 2, 42, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(ticketNumber, pageWidth - margin, 34, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(String(rowMap['Close Date / Time'] || ''), pageWidth - margin, 48, { align: 'right' })
    doc.text('Page 1 of 1', pageWidth - margin, 60, { align: 'right' })

    line(margin, 72, pageWidth - margin, 72)

    // Summary boxes
    let y = 82
    const summaryW = (pageWidth - margin * 2) / 3
    cell(margin, y, summaryW, 40, 'IV (bbls)', rowMap['IV'] || '—')
    cell(margin + summaryW, y, summaryW, 40, 'GSV (bbls)', rowMap['GSV'] || '—')
    cell(margin + summaryW * 2, y, summaryW, 40, 'NSV (bbls)', rowMap['NSV'] || '—')
    y += 52

    // Main information in two compact columns
    const colGap = 16
    const colW = (pageWidth - margin * 2 - colGap) / 2
    const labelW = 88
    const valueW = colW - labelW

    sectionTitle('Ticket Information', margin, y, colW)
    sectionTitle('Measurement / Quality', margin + colW + colGap, y, colW)
    y += 15

    const leftRows = [
      ['Ticket Number', rowMap['Ticket Number']],
      ['Batch Number', rowMap['Batch Number']],
      ['Status', rowMap['Status']],
      ['Method', rowMap['Calculation Method']],
      ['Producer', rowMap['Producer']],
      ['Segment', rowMap['Segment']],
      ['Lease', rowMap['Lease']],
      ['Meter', rowMap['Meter']],
      ['Product', rowMap['Product']],
      ['Destination / To', rowMap['Destination / To']],
      ['Open Date / Time', rowMap['Open Date / Time']],
      ['Close Date / Time', rowMap['Close Date / Time']],
      ['Opening Reading', rowMap['Opening Reading']],
      ['Closing Reading', rowMap['Closing Reading']],
    ]

    const rightRows = [
      ['Observed API', rowMap['Observed API']],
      ['API @60', rowMap['API @60']],
      ['Observed Temp', rowMap['Observed Temp']],
      ['Avg Temp', rowMap['Avg Temp']],
      ['Avg Pressure', rowMap['Avg Pressure']],
      ['CTL', rowMap['CTL']],
      ['CPL', rowMap['CPL']],
      ['CTPL', rowMap['CTPL']],
      ['MF / CMF', rowMap['MF / CMF']],
      ['GSV', rowMap['GSV']],
      ['NSV', rowMap['NSV']],
      ['BS&W %', rowMap['BS&W %']],
      ['CSW', rowMap['CSW']],
    ]

    const mainStartY = y
    leftRows.forEach((row, idx) => tableRow(margin, mainStartY + idx * 15, labelW, valueW, row[0], row[1] || '—'))
    rightRows.forEach((row, idx) => tableRow(margin + colW + colGap, mainStartY + idx * 15, labelW, valueW, row[0], row[1] || '—'))
    y = mainStartY + Math.max(leftRows.length, rightRows.length) * 15 + 18

    // Volume calculation table - full page width. No separate blank Quality box.
    const methodLabel = rowMap['Calculation Method'] && rowMap['Calculation Method'] !== '—' ? rowMap['Calculation Method'] : 'API Method'
    sectionTitle(`Volume Calculation (${methodLabel})`, margin, y, pageWidth - margin * 2)
    y += 15
    const tableW = pageWidth - margin * 2
    const vCols = [tableW * 0.48, tableW * 0.14, tableW * 0.24, tableW * 0.14]
    const vx = margin
    const headers = ['Item', 'Factor', 'Value', 'Units']
    let x = vx
    headers.forEach((header, idx) => {
      doc.setFillColor(249, 250, 251)
      doc.rect(x, y, vCols[idx], 16, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.2)
      doc.setTextColor(17, 24, 39)
      doc.text(header, x + 5, y + 10)
      x += vCols[idx]
    })
    y += 16

    const volRows = [
      ['Observed Volume (IV)', '—', rowMap['IV'], 'bbls'],
      ['Correction to 60°F (CTL)', '×', rowMap['CTL'], '—'],
      ['Pressure Correction (CPL)', '×', rowMap['CPL'], '—'],
      ['Temperature & Pressure Corr. (CTPL)', '×', rowMap['CTPL'], '—'],
      ['Meter Factor (MF / CMF)', '×', rowMap['MF / CMF'], '—'],
      ['Gross Standard Volume (GSV)', '=', rowMap['GSV'], 'bbls'],
      ['Net Standard Volume (NSV)', '=', rowMap['NSV'], 'bbls'],
    ]

    volRows.forEach((row, rowIndex) => {
      x = vx
      row.forEach((value, idx) => {
        doc.setDrawColor(209, 213, 219)
        doc.rect(x, y, vCols[idx], 16)
        doc.setFont('helvetica', rowIndex >= 5 ? 'bold' : 'normal')
        doc.setFontSize(7.2)
        doc.text(String(value || '—'), x + 5, y + 10)
        x += vCols[idx]
      })
      y += 16
    })

    y += 18

    // Notes
    sectionTitle('Notes', margin, y, pageWidth - margin * 2)
    y += 15
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin, y, pageWidth - margin * 2, 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(17, 24, 39)
    const noteLines = doc.splitTextToSize(rowMap['Notes'] || '—', pageWidth - margin * 2 - 10)
    doc.text(noteLines.slice(0, 2), margin + 5, y + 12)
    y += 52

    // Signature line
    const preparedByName = rowMap['Your Name'] && rowMap['Your Name'] !== '—' ? rowMap['Your Name'] : ''
    const companyRepName = rowMap['Company Representative'] && rowMap['Company Representative'] !== '—' ? rowMap['Company Representative'] : ''
    const signatureDateTime = rowMap['Close Date / Time'] && rowMap['Close Date / Time'] !== '—' ? rowMap['Close Date / Time'] : ''

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(17, 24, 39)
    doc.text('PREPARED BY / REPRESENTATIVE', margin, y + 7)
    doc.text('COMPANY REPRESENTATIVE', margin + 205, y + 7)
    doc.text('DATE / TIME', pageWidth - margin - 145, y + 7)

    doc.setFont('times', 'italic')
    doc.setFontSize(13)
    doc.text(preparedByName || ' ', margin + 6, y + 23)
    doc.text(companyRepName || ' ', margin + 211, y + 23)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(signatureDateTime || ' ', pageWidth - margin - 139, y + 23)

    doc.setDrawColor(17, 24, 39)
    doc.line(margin, y + 28, margin + 175, y + 28)
    doc.line(margin + 205, y + 28, margin + 380, y + 28)
    doc.line(pageWidth - margin - 145, y + 28, pageWidth - margin, y + 28)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text('This is to certify that the above is a true and correct custody transfer measurement.', pageWidth / 2, pageHeight - 24, { align: 'center' })

    return doc.output('blob') as Blob
  }


  async function saveTicketPdfToSupabase(ticket: any) {
    if (!ticket?.id) {
      alert('Select a ticket first.')
      return null
    }

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('No company selected.')
      return null
    }

    const fileBaseName = getTicketPdfFileName(ticket)
    const pdfBlob = await generateTicketPdfBlob(ticket)
    const filePath = `${activeCompanyID}/${ticket.id}/${fileBaseName}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('ticket-pdfs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', cacheControl: '3600', upsert: true })

    if (uploadError) {
      alert('Could not upload ticket PDF. Run the ticket PDF storage SQL first. ' + uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage.from('ticket-pdfs').getPublicUrl(filePath)
    const publicUrl = urlData?.publicUrl || ''

    const patch = {
      ticket_pdf_url: publicUrl,
      ticket_pdf_path: filePath,
      ticket_pdf_file_name: `${fileBaseName}.pdf`,
      ticket_pdf_saved_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(patch)
      .eq('id', ticket.id)

    if (updateError) {
      alert('PDF uploaded, but ticket row could not be updated. Run the ticket PDF columns SQL. ' + updateError.message)
      return { ...ticket, ...patch }
    }

    setTickets((prev: any[]) => asArray(prev).map((row: any) => String(row.id) === String(ticket.id) ? { ...row, ...patch } : row))
    if (selectedTicket && String(selectedTicket.id) === String(ticket.id)) {
      setSelectedTicket({ ...selectedTicket, ...patch } as any)
    }

    return { ...ticket, ...patch }
  }

  async function ensureSavedTicketPdf(ticket: any) {
    const existingUrl = getTicketSavedPdfUrl(ticket)
    if (existingUrl) return { ticket, url: existingUrl }

    const saved = await saveTicketPdfToSupabase(ticket)
    const url = getTicketSavedPdfUrl(saved)
    if (!url) throw new Error(`Could not save PDF for ticket ${ticket.ticket_number || ticket.id}`)
    return { ticket: saved, url }
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
    const activeAreaCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    const selectedCompany = companies.find((company: any) => company.id === (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId))

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
    const activeAreaCompanyId =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    if (!(userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId)) {
      alert('No company selected.')
      return
    }

    let logoUrl = companySettings?.logo_url || ''

    if (companyLogoFile) {
      const fileExt = companyLogoFile.name.split('.').pop() || 'png'
      const filePath = `${(userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId)}/logo-${Date.now()}.${fileExt}`

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
      company_id: (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId),
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
        .eq('id', (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId))
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
    const rows: string[][] = []
    let current = ''
    let row: string[] = []
    let inQuotes = false

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      const next = text[i + 1]

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

    const headers = rows[0].map((header) =>
      String(header || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    )

    return rows.slice(1).map((values) => {
      const output: Record<string, string> = {}
      headers.forEach((header, index) => {
        output[header] = values[index] || ''
      })
      return output
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

    const activeAreaCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    const { error } = await supabase.from('tanks').insert({
      company_id: (userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId),
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

  function startEditTankAsset(tank: any) {
    setEditingTankId(String(tank.id || ''))
    setEditingTankNumber(String(tank.tank_number || ''))
    setEditingTankName(String(tank.tank_name || ''))
    setEditingTankSegmentId(String(tank.segment_id || ''))
  }

  function cancelEditTankAsset() {
    setEditingTankId('')
    setEditingTankNumber('')
    setEditingTankName('')
    setEditingTankSegmentId('')
  }

  async function updateTankAsset() {
    if (!editingTankId) {
      alert('Select a tank to edit.')
      return
    }

    if (!editingTankNumber) {
      alert('Tank number is required.')
      return
    }

    const { error } = await supabase
      .from('tanks')
      .update({
        tank_number: editingTankNumber,
        tank_name: editingTankName || null,
        segment_id: editingTankSegmentId || null,
      })
      .eq('id', editingTankId)

    if (error) {
      alert('Could not update tank: ' + error.message)
      return
    }

    cancelEditTankAsset()
    await loadAll()
  }


  async function createLineFillAsset() {
    if (!newLineFillName) {
      alert('Enter line fill name.')
      return
    }

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    const { error } = await supabase.from('line_fills').insert({
      company_id: activeCompanyID,
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

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    const calibration = getActiveTankCalibration(deadwoodTankId)

    if (!calibration) {
      alert('This tank needs a strapping calibration version before adding deadwood rules.')
      return
    }

    const { error } = await supabase.from('tank_deadwood_rules').insert({
      company_id: activeCompanyID,
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

  function extractHeaderStrappingRowsFromSheet(rows: any[][]) {
    const output: any[] = []

    const headerRowIndex = rows.findIndex((row) => {
      const safeRow = Array.isArray(row) ? row : []
      const headers = safeRow.map((value) => String(value ?? '').trim().toLowerCase())

      return (
        headers.includes('gauge_decimal') &&
        headers.some((header) => ['barrels', 'bbl', 'volume_bbl', 'volume'].includes(header))
      )
    })

    if (headerRowIndex < 0) return output

    const headers = (rows[headerRowIndex] || []).map((value) => String(value ?? '').trim().toLowerCase())
    const gaugeDecimalIndex = headers.indexOf('gauge_decimal')
    const gaugeFeetIndex = headers.indexOf('gauge_feet')
    const gaugeInchesIndex = headers.indexOf('gauge_inches')
    const gaugeFractionIndex = headers.indexOf('gauge_fraction')
    const barrelsIndex = headers.findIndex((header) => ['barrels', 'bbl', 'volume_bbl', 'volume'].includes(header))
    const incrementIndex = headers.findIndex((header) => ['increment_bbl', 'increment', 'inc_bbl'].includes(header))
    const notesIndex = headers.indexOf('notes')

    for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r] || []
      const gaugeDecimal = Number(row[gaugeDecimalIndex])
      const gaugeFeet = gaugeFeetIndex >= 0 ? row[gaugeFeetIndex] : null
      const gaugeInches = gaugeInchesIndex >= 0 ? row[gaugeInchesIndex] : null
      const gaugeFraction = gaugeFractionIndex >= 0 ? row[gaugeFractionIndex] : null
      const barrels = Number(row[barrelsIndex])

      if (!Number.isFinite(gaugeDecimal) || !Number.isFinite(barrels)) continue

      output.push({
        gauge_decimal: gaugeDecimal,
        gauge_feet: gaugeFeet,
        gauge_inches: gaugeInches,
        gauge_fraction: gaugeFraction,
        barrels,
        increment_bbl: incrementIndex >= 0 ? row[incrementIndex] : null,
        notes: notesIndex >= 0 ? row[notesIndex] : 'Imported from header-based strapping sheet',
      })
    }

    return output
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

  async function loadPdfJsForStrapping() {
    const win = window as any
    if (win.pdfjsLib) return win.pdfjsLib

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-pdfjs-strapping="true"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Could not load PDF parser.')))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.async = true
      script.dataset.pdfjsStrapping = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load PDF parser. Check internet connection and try again.'))
      document.head.appendChild(script)
    })

    if (!win.pdfjsLib) throw new Error('PDF parser did not initialize.')
    win.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return win.pdfjsLib
  }

  function parseStrappingNumber(value: any) {
    const num = Number(String(value ?? '').replace(/,/g, '').trim())
    return Number.isFinite(num) ? num : null
  }

  function extractAmSpecStrappingRowsFromPdfLines(lines: string[]) {
    const rows: any[] = []
    const numberPattern = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$/

    for (const rawLine of lines) {
      const line = String(rawLine || '').replace(/\s+/g, ' ').trim()
      if (!line) continue
      if (/GALLONS/i.test(line)) continue
      if (/FRACTIONS|FLOATING|TABLE NOTES|AMSPEC|DATE|NOTE:/i.test(line)) continue

      const tokens = line
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => numberPattern.test(token))

      if (tokens.length < 2) continue

      let i = 0
      while (i < tokens.length - 1) {
        const heightToken = tokens[i]
        const barrelToken = tokens[i + 1]
        const height = parseStrappingNumber(heightToken)
        const barrels = parseStrappingNumber(barrelToken)

        if (height === null || barrels === null) {
          i += 1
          continue
        }

        // AmSpec PDF lines have pairs like:
        // first table row: FT + BARRELS, then following rows: IN + BARRELS under each FT column.
        // A valid barrel value on this chart is decimal and reasonably large.
        if (!String(barrelToken).includes('.') || barrels < 1) {
          i += 1
          continue
        }

        const isFootRow = i === 0 || height > 11
        let feet = 0
        let inches = 0

        if (isFootRow) {
          feet = height
          inches = 0
        } else {
          // Use the nearest previous foot heading from this same line if available.
          // For PDF text extraction, lines are ordered left-to-right by columns.
          const previousFootCandidates = tokens.slice(0, i).map(parseStrappingNumber).filter((n: any) => n !== null && n > 11) as number[]
          feet = previousFootCandidates.length ? previousFootCandidates[previousFootCandidates.length - 1] : 0
          inches = height
        }

        // Better reconstruction for standard AmSpec rows:
        // each line contains repeated pairs across seven-foot column groups.
        // The row number token is the inch for every column except the row-start foot headers.
        if (!isFootRow) {
          const pairIndex = Math.floor(i / 2)
          const footHeaders = tokens
            .filter((_, tokenIndex) => tokenIndex % 2 === 0)
            .map(parseStrappingNumber)
            .filter((n: any) => n !== null && n > 11) as number[]

          if (footHeaders[pairIndex] !== undefined) feet = footHeaders[pairIndex]
        }

        const gaugeDecimal = feet + (inches / 12)
        if (Number.isFinite(gaugeDecimal) && Number.isFinite(barrels)) {
          rows.push({
            gauge_decimal: Number(gaugeDecimal.toFixed(6)),
            gauge_feet: feet,
            gauge_inches: inches,
            gauge_fraction: null,
            barrels,
            increment_bbl: null,
            notes: 'Imported from PDF strapping chart',
          })
        }

        i += 2
      }
    }

    // If line reconstruction above misses the repeated columns, use a second pass that knows the
    // AmSpec page is arranged in 7-foot column groups with rows 0-11 inches.
    const unique = new Map<string, any>()
    rows.forEach((row) => {
      const key = Number(row.gauge_decimal).toFixed(6)

      // IMPORTANT:
      // PDF extraction can create duplicate gauges from nearby table columns.
      // Keeping the largest duplicate can make a low gauge pull a high-column volume
      // (example: 13 ft showing 23,000+ bbl). Keep the first valid row instead.
      if (!unique.has(key)) unique.set(key, row)
    })

    return Array.from(unique.values())
      .filter((row) => row.barrels > 0 && row.gauge_decimal >= 0)
      .sort((a, b) => Number(a.gauge_decimal) - Number(b.gauge_decimal))
  }

  async function extractPdfTextLinesForStrapping(file: File) {
    const pdfjsLib = await loadPdfJsForStrapping()
    const data = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data }).promise
    const allLines: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const buckets = new Map<number, any[]>()

      ;(content.items || []).forEach((item: any) => {
        const transform = item.transform || []
        const x = Number(transform[4] || 0)
        const y = Number(transform[5] || 0)
        const yKey = Math.round(y)
        if (!buckets.has(yKey)) buckets.set(yKey, [])
        buckets.get(yKey)!.push({ x, text: item.str || '' })
      })

      Array.from(buckets.entries())
        .sort((a, b) => b[0] - a[0])
        .forEach(([, items]) => {
          const line = items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

          if (line) allLines.push(line)
        })
    }

    return allLines
  }

  function convertIncrementStrapRowsToCumulativeIfNeeded(rows: any[]) {
    const cleanRows = rows
      .map((row: any) => ({
        ...row,
        gauge_decimal: Number(row.gauge_decimal ?? row.gauge ?? 0),
        barrels: Number(row.barrels ?? row.bbl ?? row.volume_bbl ?? row.volume ?? 0),
      }))
      .filter((row: any) => Number.isFinite(row.gauge_decimal) && Number.isFinite(row.barrels))
      .sort((a: any, b: any) => Number(a.gauge_decimal) - Number(b.gauge_decimal))

    if (cleanRows.length < 24) return rows

    const maxBbl = Math.max(...cleanRows.map((row: any) => Number(row.barrels || 0)))
    const maxGauge = Math.max(...cleanRows.map((row: any) => Number(row.gauge_decimal || 0)))

    // If a full tank strapping chart imports with every row under a few hundred barrels,
    // it is almost certainly the INCREMENT/BBL-per-inch table, not cumulative TOV.
    // Convert it to cumulative TOV so 13'3" becomes the sum of all lower increments,
    // not just the single inch increment.
    if (maxGauge > 5 && maxBbl > 0 && maxBbl < 500) {
      let cumulative = 0

      return cleanRows.map((row: any, index: number) => {
        const gauge = Number(row.gauge_decimal || 0)
        const increment = Number(row.barrels || 0)

        if (index === 0 || gauge === 0) {
          cumulative = increment
        } else {
          cumulative += increment
        }

        const feet = Math.floor(gauge)
        const totalInches = (gauge - feet) * 12
        const inches = Math.round(totalInches)

        return {
          ...row,
          gauge_decimal: gauge,
          gauge_feet: row.gauge_feet ?? feet,
          gauge_inches: row.gauge_inches ?? inches,
          barrels: Number(cumulative.toFixed(2)),
          increment_bbl: increment,
          notes: `${row.notes || 'Imported strapping row'} - converted from increment table to cumulative TOV`,
        }
      })
    }

    return rows
  }

  function extractQi2PdfMetadata(lines: string[]) {
    const fullText = lines.join(' ')
    const reportTitle = fullText.match(/Tank\s+\d+[^]*?(High Leg|Low Leg)\s+Innage Table/i)
    const roofWeightMatch = fullText.match(/Weight\s+([\d,]+(?:\.\d+)?)\s*lb/i)
    const referenceApiMatch = fullText.match(/Specific Gravity\s+([\d.]+)\s*°?\s*API/i) || fullText.match(/Fill density\s+([\d.]+)\s*°?\s*API/i)
    const highLegZoneMatch = fullText.match(/HL\s*[-–]\s*HIGH LEG\s+(\d+)\s*ft\s+([\d.]+)\s*in\s+to\s+(\d+)\s*ft\s+([\d.]+)\s*in/i)
    const lowLegZoneMatch = fullText.match(/LL\s*[-–]\s*LOW LEG\s+(\d+)\s*ft\s+([\d.]+)\s*in\s+to\s+(\d+)\s*ft\s+([\d.]+)\s*in/i)

    const legType = reportTitle?.[1] || (fullText.toLowerCase().includes('high leg') ? 'High Leg' : fullText.toLowerCase().includes('low leg') ? 'Low Leg' : '')
    const zoneMatch = String(legType).toLowerCase().includes('high') ? highLegZoneMatch : lowLegZoneMatch
    const criticalGaugeStart = zoneMatch ? Number(zoneMatch[1]) + (Number(zoneMatch[2]) / 12) : null
    const criticalGaugeEnd = zoneMatch ? Number(zoneMatch[3]) + (Number(zoneMatch[4]) / 12) : null

    return {
      isQi2: /Qi2|Tank Capacity Report|Tank strapping table|Table 6/i.test(fullText),
      legType,
      roofWeightLbs: roofWeightMatch ? Number(String(roofWeightMatch[1]).replace(/,/g, '')) : null,
      referenceApi: referenceApiMatch ? Number(referenceApiMatch[1]) : null,
      referenceSg: referenceApiMatch ? apiToSpecificGravity(Number(referenceApiMatch[1])) : null,
      criticalGaugeStart,
      criticalGaugeEnd,
      roofMode: /Floating Roof\s+Yes|floating roof/i.test(fullText) ? 'fra' : 'none',
    }
  }

  function extractQi2StrappingRowsFromPdfLines(lines: string[]) {
    const metadata = extractQi2PdfMetadata(lines)
    const fullText = lines
      .join('\n')
      .replace(/[‐‑‒–—]/g, '-')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '\n')

    const tableStart = fullText.search(/Table\s+6:\s*Tank strapping table/i)
    const fallbackStart = fullText.search(/---\s*0\s*ft\s*---/i)
    const startIndex = tableStart >= 0 ? tableStart : fallbackStart

    if (startIndex < 0) return []

    const afterStart = fullText.slice(startIndex)
    const tableEnd = afterStart.search(/Table\s+7:|Table\s+8:|3\s+APPENDIX|APPENDIX A/i)
    const tableText = tableEnd >= 0 ? afterStart.slice(0, tableEnd) : afterStart

    const rows: any[] = []
    const footBlockRegex = /---\s*(\d+)\s*ft\s*---([\s\S]*?)(?=---\s*\d+\s*ft\s*---|$)/gi
    let footBlockMatch: RegExpExecArray | null

    while ((footBlockMatch = footBlockRegex.exec(tableText)) !== null) {
      const feet = Number(footBlockMatch[1])
      const block = footBlockMatch[2] || ''
      const rowRegex = /^\s*(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?:\s+[A-Z])?\s*$/gm
      let rowMatch: RegExpExecArray | null

      while ((rowMatch = rowRegex.exec(block)) !== null) {
        const inches = Number(rowMatch[1])
        const barrels = Number(String(rowMatch[2]).replace(/,/g, ''))

        if (!Number.isFinite(feet) || !Number.isFinite(inches) || !Number.isFinite(barrels)) continue
        if (inches < 0 || inches > 11.999) continue

        rows.push({
          gauge_decimal: Number((feet + (inches / 12)).toFixed(6)),
          gauge_feet: feet,
          gauge_inches: inches,
          gauge_fraction: null,
          barrels,
          increment_bbl: null,
          notes: 'Imported from Qi2 PDF Table 6 cumulative TOV strapping table',
        })
      }
    }

    const unique = new Map<string, any>()
    rows.forEach((row) => {
      const key = Number(row.gauge_decimal).toFixed(6)
      if (!unique.has(key)) unique.set(key, row)
    })

    const cleanRows = Array.from(unique.values()).sort((a, b) => Number(a.gauge_decimal) - Number(b.gauge_decimal))

    if (metadata.isQi2 && cleanRows.length >= 100) {
      ;(cleanRows as any).metadata = metadata
    }

    return cleanRows
  }

  async function parseStrappingFileRows(file: File) {
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.pdf')) {
      const lines = await extractPdfTextLinesForStrapping(file)
      const rows: any = extractQi2StrappingRowsFromPdfLines(lines)

      if (!rows.length) {
        throw new Error('No Qi2 Table 6 cumulative strapping rows found. Upload the full Qi2 Tank Capacity Report PDF, not the one-page summary image.')
      }

      return rows
    }

    if (lowerName.endsWith('.xlsx')) {
      const sheets = await readXlsxSheets(file)
      let rows: any[] = []

      for (const sheet of sheets) {
        const headerRows = extractHeaderStrappingRowsFromSheet(sheet.rows)
        const refineryRows = extractRefineryStrappingRowsFromSheet(sheet.rows)
        const ifsRows = extractIncrementFactorSheetRows(sheet.rows)

        rows = [...rows, ...headerRows, ...refineryRows, ...ifsRows]
      }

      const unique = new Map<string, any>()
      rows.forEach((row) => {
        const key = Number(row.gauge_decimal).toFixed(6)
        if (!unique.has(key)) unique.set(key, row)
      })

      return convertIncrementStrapRowsToCumulativeIfNeeded(Array.from(unique.values()).sort((a, b) => Number(a.gauge_decimal) - Number(b.gauge_decimal)))
    }

    const csvText = await file.text()
    return convertIncrementStrapRowsToCumulativeIfNeeded(parseMeterCsv(csvText))
  }

  function cleanNumericInput(value: any) {
    if (value === null || value === undefined || value === '') return null
    const cleaned = String(value).replace(/,/g, '').trim()
    if (cleaned === '') return null
    const numberValue = Number(cleaned)
    return Number.isFinite(numberValue) ? numberValue : null
  }

  function normalizeTrueStrappingRow(row: any) {
    const feet = cleanNumericInput(row.ft ?? row.feet ?? row.gauge_feet ?? row.foot)
    const inches = cleanNumericInput(row.in ?? row.inch ?? row.inches ?? row.gauge_inches)
    const gaugeDecimalRaw = cleanNumericInput(row.gauge_decimal ?? row.gauge ?? row.gauge_ft)
    const barrels = cleanNumericInput(row.bbl ?? row.bbls ?? row.barrels ?? row.volume ?? row.volume_bbl ?? row.tov)

    const gaugeDecimal = gaugeDecimalRaw ?? (
      feet !== null
        ? feet + ((inches ?? 0) / 12)
        : null
    )

    if (gaugeDecimal === null || barrels === null) return null

    return {
      gauge_decimal: Number(gaugeDecimal.toFixed(6)),
      gauge_feet: feet,
      gauge_inches: inches,
      barrels,
    }
  }

  async function importTankStrappingCsv() {
    if (!selectedStrappingTankId || !strappingCsvFile) {
      alert('Select a tank and true strapping CSV/XLSX file.')
      return
    }

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    let rows: any[] = []
    let parsedMetadata: any = {}
    try {
      rows = await parseStrappingFileRows(strappingCsvFile)
      parsedMetadata = (rows as any).metadata || {}
    } catch (parseError: any) {
      alert(parseError?.message || 'Could not read strapping chart.')
      return
    }

    if (!rows.length) {
      alert('No valid strapping rows found. Upload true strapping with columns ft, in, bbl.')
      return
    }

    const { data: latestVersions } = await supabase
      .from('tank_calibration_versions')
      .select('version_number')
      .eq('tank_id', selectedStrappingTankId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = Number(latestVersions?.[0]?.version_number || 0) + 1
    const legName = strappingLegType || parsedMetadata.legType || ''
    const roofMode = strappingRoofMode || parsedMetadata.roofMode || 'fra'
    const roofWeightLbs = strappingRoofWeightLbs ? Number(strappingRoofWeightLbs) : parsedMetadata.roofWeightLbs
    const roofReferenceApi = strappingRoofReferenceApi ? Number(strappingRoofReferenceApi) : parsedMetadata.referenceApi
    const roofReferenceSg = strappingRoofReferenceSg
      ? Number(strappingRoofReferenceSg)
      : (parsedMetadata.referenceSg || (roofReferenceApi ? apiToSpecificGravity(Number(roofReferenceApi)) : null))
    const roofCriticalGauge = strappingRoofCriticalGauge ? Number(strappingRoofCriticalGauge) : parsedMetadata.criticalGaugeStart

    const calibrationPayload: any = {
      company_id: activeCompanyID,
      tank_id: selectedStrappingTankId,
      version_number: nextVersion,
      name: legName ? `${legName} - Version ${nextVersion}` : `Version ${nextVersion}`,
      leg_type: legName || null,
      strap_type: legName || null,
      roof_correction_mode: roofMode,
      roof_weight_lbs: roofWeightLbs ?? null,
      roof_reference_api: roofReferenceApi ?? null,
      roof_reference_sg: roofReferenceSg ?? null,
      roof_critical_gauge: roofCriticalGauge ?? null,
      roof_critical_gauge_end: parsedMetadata.criticalGaugeEnd ?? null,
      active: true,
    }

    let versionResult = await supabase
      .from('tank_calibration_versions')
      .insert(calibrationPayload)
      .select()
      .single()

    if (versionResult.error) {
      const fallbackPayload: any = {
        company_id: activeCompanyID,
        tank_id: selectedStrappingTankId,
        version_number: nextVersion,
        name: calibrationPayload.name,
        active: true,
      }

      versionResult = await supabase
        .from('tank_calibration_versions')
        .insert(fallbackPayload)
        .select()
        .single()
    }

    const version = versionResult.data
    const versionError = versionResult.error

    if (versionError || !version) {
      alert('Could not create calibration version: ' + (versionError?.message || 'unknown error'))
      return
    }

    await supabase
      .from('tank_calibration_versions')
      .update({ active: false })
      .eq('tank_id', selectedStrappingTankId)
      .neq('id', version.id)

    const rawInsertRows = rows
      .map((row: any) => {
        const normalized = normalizeTrueStrappingRow(row)
        if (!normalized) return null

        return {
          company_id: activeCompanyID,
          tank_id: selectedStrappingTankId,
          calibration_version_id: version.id,
          gauge_decimal: normalized.gauge_decimal,
          gauge_feet: normalized.gauge_feet,
          gauge_inches: normalized.gauge_inches,
          barrels: normalized.barrels,
          notes: 'True strapping chart import',
        }
      })
      .filter(Boolean) as any[]

    const insertRowMap = new Map<string, any>()
    rawInsertRows.forEach((row: any) => {
      const key = Number(row.gauge_decimal).toFixed(6)
      if (!insertRowMap.has(key)) insertRowMap.set(key, row)
    })
    const insertRows = Array.from(insertRowMap.values()).sort((a: any, b: any) => Number(a.gauge_decimal) - Number(b.gauge_decimal))

    if (insertRows.length === 0) {
      await supabase.from('tank_calibration_versions').delete().eq('id', version.id)
      alert('No valid strapping rows found. Upload a cumulative TOV CSV/XLSX or the full Qi2 Tank Capacity Report PDF.')
      return
    }

    const sortedImportRows = [...insertRows].sort((a: any, b: any) => Number(a.gauge_decimal) - Number(b.gauge_decimal))
    const maxGauge = Math.max(...sortedImportRows.map((row: any) => Number(row.gauge_decimal || 0)))
    const maxBbl = Math.max(...sortedImportRows.map((row: any) => Number(row.barrels || 0)))
    const decreasingCount = sortedImportRows.reduce((count: number, row: any, index: number) => {
      if (index === 0) return count
      return Number(row.barrels || 0) < Number(sortedImportRows[index - 1].barrels || 0) ? count + 1 : count
    }, 0)

    if (maxGauge >= 10 && maxBbl < 1000) {
      await supabase.from('tank_calibration_versions').delete().eq('id', version.id)
      alert('This does not look like a cumulative TOV strapping chart. The app found high gauges but maximum barrels under 1,000.')
      return
    }

    if (decreasingCount > 3) {
      await supabase.from('tank_calibration_versions').delete().eq('id', version.id)
      alert('This strapping chart is not increasing with gauge. Upload the cumulative TOV strapping chart only.')
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
    setStrappingLegType('')
    setStrappingRoofMode('fra')
    setStrappingRoofWeightLbs('')
    setStrappingRoofReferenceApi('')
    setStrappingRoofReferenceSg('')
    setStrappingRoofCriticalGauge('')
    alert(`Imported ${insertRows.length} Qi2 Table 6 rows as calibration ${calibrationPayload.name}. Test 13 ft 3 in should lookup about 10,257.32 bbl for Tank 300 High Leg.`)
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
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!activeCompanyID) {
      alert('No company selected.')
      return
    }

    const { data: batch, error: batchError } = await supabase
      .from('flowx_import_batches')
      .insert({
        company_id: activeCompanyID,
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
          company_id: activeCompanyID,
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
          observed_temperature: observedTemp || null,
          raw_row: row,
        })
        .select()
        .single()

      for (const split of splits) {
        const { data: generatedNumber } = await supabase.rpc('generate_ticket_number', {
          p_company_id: activeCompanyID,
        })

        const splitTransporter = split.transporter || split.customer || transporterName
        const assignedPot = getLatestPotForTransporter(splitTransporter)
        const splitGross = grossVolume * split.normalizedPercent
        const splitNet = netVolume * split.normalizedPercent

        const ticketPayload: any = {
          company_id: activeCompanyID,
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
            observed_temperature: observedTemp || null,
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
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) return

    const { data, error } = await supabase
      .from('transporter_pot_rules')
      .select('*')
      .eq('company_id', activeCompanyID)
      .order('transporter_name')

    if (!error) setTransporterPotRules(data || [])
  }

  async function saveTransporterPotRule() {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!activeCompanyID) {
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
        company_id: activeCompanyID,
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


  function getPotObservedApiGravity(pot: any, fallback = 0) {
    return Number(
      (pot as any)?.observed_api_gravity ||
      (pot as any)?.api_observed ||
      (pot as any)?.api_gravity_observed ||
      fallback ||
      0
    )
  }

  function getPotApiGravityAt60(pot: any, fallback = 0) {
    return Number(
      (pot as any)?.api_gravity_60 ||
      (pot as any)?.corrected_api_gravity ||
      (pot as any)?.api_gravity ||
      (pot as any)?.observed_api_gravity ||
      fallback ||
      0
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


  async function checkFlowXDuplicateImport(activeCompanyID: string, fileName: string, lactName: string) {
    const { data, error } = await supabase
      .from('flowx_import_batches')
      .select('id, source_file_name, lact_name, imported_count, created_at')
      .eq('company_id', activeCompanyID)
      .eq('source_file_name', fileName)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.warn('Duplicate Flow-X import check failed:', error)
      return 'none'
    }

    const existing = (data || [])[0]
    if (!existing) return 'none'

    const existingLact = String(existing.lact_name || '').trim().toLowerCase()
    const currentLact = String(lactName || '').trim().toLowerCase()

    if (existingLact && currentLact && existingLact !== currentLact) {
      return 'none'
    }

    const importedAt = existing.created_at ? new Date(existing.created_at).toLocaleString() : 'previous import'

    return window.confirm(
      `This Flow-X file was already imported on ${importedAt}.\n\n` +
      `File: ${fileName}\n` +
      `LACT: ${existing.lact_name || lactName || 'N/A'}\n` +
      `Rows: ${existing.imported_count || 'N/A'}\n\n` +
      `Importing again can create duplicate draft tickets.\n\n` +
      `Click OK to import anyway, or Cancel to stop.`
    ) ? 'continue' : 'stop'
  }

  async function deleteExistingFlowXDraftsForBatch(importBatchId: string) {
    if (!importBatchId) return

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('import_batch_id', importBatchId)
      .eq('status', 'draft')

    if (error) {
      console.warn('Could not remove existing draft tickets for duplicate batch:', error)
    }
  }




  function getApiTesterResult() {
    const factors = calculateApi111CorrectionFactors({
      api_version: apiTesterVersion,
      observed_temperature: Number(apiTesterTemp || 60),
      observed_pressure: Number(apiTesterPressure || 0),
      base_temperature: 60,
    })

    const volume = calculateChapter122021({
      iv: Number(apiTesterIv || 0),
      ctl: factors.ctl,
      cpl: factors.cpl,
      mf: Number(apiTesterMf || 1),
      api_version: apiTesterVersion,
      ccf: factors.ctpl,
    })

    return {
      ...factors,
      ...volume,
      ctpl: factors.ctpl,
    }
  }


  function roundToDecimals(value: any, decimals: number) {
    const num = Number(value || 0)
    if (!Number.isFinite(num)) return 0
    const factor = 10 ** decimals
    return Math.round((num + Number.EPSILON) * factor) / factor
  }

  function getApiVersionRoundingProfile(version: string) {
    // Custody transfer profile defaults. Chapter 12.2 R2021 uses API @60 to 0.1,
    // CTL/CPL to 6, MF/CMF to 4, and final volumes to 2 decimals.
    if (version === 'api_11_1_2004') {
      return {
        apiDecimals: 1,
        ctlDecimals: 5,
        cplDecimals: 5,
        ctplDecimals: 5,
        mfDecimals: 4,
        gsvDecimals: 2,
        nsvDecimals: 2,
        label: 'API 11.1 2004 rounding profile',
      }
    }

    if (version === 'api_11_1_2007') {
      return {
        apiDecimals: 1,
        ctlDecimals: 5,
        cplDecimals: 5,
        ctplDecimals: 5,
        mfDecimals: 4,
        gsvDecimals: 2,
        nsvDecimals: 2,
        label: 'API 11.1 2007 rounding profile',
      }
    }

    if (version === 'api_11_1_2019') {
      return {
        apiDecimals: 1,
        ctlDecimals: 6,
        cplDecimals: 6,
        ctplDecimals: 6,
        mfDecimals: 4,
        gsvDecimals: 2,
        nsvDecimals: 2,
        label: 'API 11.1 2019 rounding profile',
      }
    }

    if (version === 'api_chapter_12_2_r2021' || version === 'chapter12_2_2021' || version === 'chapter12_2021') {
      return {
        apiDecimals: 1,
        ctlDecimals: 6,
        cplDecimals: 6,
        ctplDecimals: 6,
        mfDecimals: 4,
        gsvDecimals: 2,
        nsvDecimals: 2,
        label: 'API MPMS Chapter 12.2 R2021 rounding profile',
      }
    }

    return {
      apiDecimals: 1,
      ctlDecimals: 6,
      cplDecimals: 6,
      ctplDecimals: 6,
      mfDecimals: 4,
      gsvDecimals: 2,
      nsvDecimals: 2,
      label: '2021 rounding profile',
    }
  }

  function applyApiVersionRounding(result: any, version: string) {
    const profile = getApiVersionRoundingProfile(version)

    return {
      ...result,
      iv: result.iv !== undefined ? roundToDecimals(result.iv, 1) : result.iv,
      ctl: roundToDecimals(result.ctl, profile.ctlDecimals),
      api_gravity_60: result.api_gravity_60 !== undefined ? roundToDecimals(result.api_gravity_60, profile.apiDecimals) : result.api_gravity_60,
      cpl: roundToDecimals(result.cpl, profile.cplDecimals),
      ctpl: roundToDecimals(result.ctpl, profile.ctplDecimals),
      mf: result.mf !== undefined ? roundToDecimals(result.mf, profile.mfDecimals) : result.mf,
      gsv: result.gsv !== undefined ? roundToDecimals(result.gsv, profile.gsvDecimals) : result.gsv,
      nsv: result.nsv !== undefined ? roundToDecimals(result.nsv, profile.nsvDecimals) : result.nsv,
      rounding_profile: profile,
    }
  }

  function getApiVersionLabel(version: string) {
    if (version === 'api_11_1_2004') return 'API MPMS 11.1 (2004)'
    if (version === 'api_11_1_2007') return 'API MPMS 11.1 (2007)'
    if (version === 'api_11_1_2019') return 'API MPMS 11.1 (2019)'
    if (version === 'api_11_1_2021') return 'API MPMS 11.1 (2021)'
    return version || 'API MPMS 11.1'
  }

  function calculateApi111CorrectionFactors(input: any) {
    const apiVersion = input.api_version || 'api_11_1_2021'
    const observedTemp = Number(input.observed_temperature || input.temperature || 60)
    const observedPressure = Number(input.observed_pressure || input.pressure || 0)
    const apiGravity = Number(input.api_gravity || input.observed_api_gravity || 40)
    const productGroup = input.product_group || input.productGroup || 'crude'
    const roundingProfile = getApiVersionRoundingProfile(apiVersion)

    const corrections = calculateApi11Corrections({
      productGroup,
      observedApiGravity: apiGravity,
      observedTemperature: Number(input.sample_temperature || input.observed_sample_temperature || 60),
      observedPressure: 0,
      averageTemperature: observedTemp,
      averagePressure: observedPressure,
      apiRounding: roundingProfile.apiDecimals,
    })

    return {
      api_version: apiVersion,
      api_version_label: getApiVersionLabel(apiVersion),
      observed_api_gravity: corrections.observed_api_gravity,
      api_gravity_60: corrections.api_gravity_60,
      density_60: corrections.density_60,
      ctl: roundToDecimals(corrections.ctl, roundingProfile.ctlDecimals),
      cpl: roundToDecimals(corrections.cpl, roundingProfile.cplDecimals),
      ctpl: roundToDecimals(corrections.ctlp, roundingProfile.ctplDecimals),
      correction_source: 'api_11_1_6_1',
      rounding_profile: roundingProfile,
      audit: {
        api_version: apiVersion,
        api_version_label: getApiVersionLabel(apiVersion),
        product_group: productGroup,
        observed_api_gravity: apiGravity,
        api_gravity_60_exact: corrections.raw_api_gravity_60,
        api_gravity_60_display: corrections.api_gravity_60,
        observed_temperature_for_api60: Number(input.sample_temperature || input.observed_sample_temperature || 60),
        meter_temperature: observedTemp,
        meter_pressure: observedPressure,
        raw_ctl: corrections.raw_ctl,
        raw_cpl: corrections.raw_cpl,
        raw_ctpl: corrections.raw_ctlp,
        rounded_ctl: roundToDecimals(corrections.ctl, roundingProfile.ctlDecimals),
        rounded_cpl: roundToDecimals(corrections.cpl, roundingProfile.cplDecimals),
        rounded_ctpl: roundToDecimals(corrections.ctlp, roundingProfile.ctplDecimals),
        fp: corrections.raw_fp,
        alpha60: corrections.raw_alpha60,
        method: 'API MPMS 11.1 Section 11.1.6.1',
      },
    }
  }


  function calculateChapter122021(input: any) {
    const ivRaw = Number(input.iv ?? input.gross_volume_bbl ?? 0)
    const apiVersion = input.api_version || 'api_chapter_12_2_r2021'
    const profile = getApiVersionRoundingProfile(apiVersion)

    // Chapter 12.2 R2021 calculation sequence for dynamic measurement:
    // IV × MF × CTL × CPL = GSV; then GSV × CSW = NSV.
    // Per field practice / VMACS-style tickets, use the rounded custody factors shown on the ticket:
    // API @60 to 0.1, CTL/CPL to 6, MF/CMF to 4.
    const ctlRounded = roundToDecimals(Number(input.ctl || 1), profile.ctlDecimals)
    const cplRounded = roundToDecimals(Number(input.cpl || 1), profile.cplDecimals)
    const mfRounded = roundToDecimals(Number(input.mf || 1), profile.mfDecimals)
    const bswPercent = Number(input.bsw_percent || 0)
    const csw = roundToDecimals(1 - (bswPercent / 100), 6)
    const ctplRounded = roundToDecimals(ctlRounded * cplRounded, profile.ctplDecimals)

    const usesCombinedCorrectionFactor = ['api_11_1_2004', 'api_11_1_2007', 'api_11_1_2019'].includes(apiVersion)

    const gsvRaw = usesCombinedCorrectionFactor
      ? ivRaw * Number(input.ccf || input.ctpl || ctplRounded) * mfRounded
      : ivRaw * mfRounded * ctlRounded * cplRounded

    const nsvRaw = gsvRaw * csw

    const rounded = applyApiVersionRounding({
      iv: ivRaw,
      ctl: ctlRounded,
      cpl: cplRounded,
      ctpl: ctplRounded,
      mf: mfRounded,
      ccf: ctplRounded,
      csw,
      gsv: gsvRaw,
      nsv: nsvRaw,
      raw_iv: ivRaw,
      raw_ctl_input: Number(input.ctl || 1),
      raw_cpl_input: Number(input.cpl || 1),
      raw_mf_input: Number(input.mf || 1),
      raw_gsv: gsvRaw,
      raw_nsv: nsvRaw,
      method: usesCombinedCorrectionFactor ? `${apiVersion}_ccf` : 'api_chapter_12_2_r2021',
      formula: usesCombinedCorrectionFactor
        ? 'GSV = IV × CTPL × MF; NSV = GSV × CSW'
        : 'GSV = IV × MF × CTL × CPL; NSV = GSV × CSW',
      api_chapter: getApiVersionLabel(apiVersion),
      uses_combined_correction_factor: usesCombinedCorrectionFactor,
    }, apiVersion)

    return {
      ...rounded,
      iv: roundToDecimals(ivRaw, 2),
      gsv: roundToDecimals(rounded.gsv, profile.gsvDecimals),
      nsv: roundToDecimals(rounded.nsv, profile.nsvDecimals),
    }
  }


  function getContractProfileForTransporter(transporterName: string) {
    const name = String(transporterName || '').trim().toLowerCase()
    return contractProfiles.find((profile: any) =>
      String((profile as any).transporter_name || '').trim().toLowerCase() === name ||
      String((profile as any).contract_name || '').trim().toLowerCase() === name
    ) || null
  }

  function applyContractProfileCalculation(summary: any, assignedPot: any, profile: any) {
    const method = profile?.calculation_method || 'chapter12_2021'
    const apiVersion = profile?.api_version || 'api_11_1_2021'
    const correctionSource = profile?.correction_source || 'app_calculated'
    const mf = Number(profile?.meter_factor || profile?.default_mf || 1)
    const bswPercent = Number((assignedPot as any)?.bsw_percent || (assignedPot as any)?.bsw || summary.avgBsw || 0)

    const factors = correctionSource === 'app_calculated'
      ? calculateApi111CorrectionFactors({
          api_version: apiVersion,
          observed_temperature: summary.avgTemp,
          observed_pressure: summary.avgPressure,
        })
      : {
          api_version: apiVersion,
          api_version_label: getApiVersionLabel(apiVersion),
          ctl: Number((assignedPot as any)?.ctl || summary.avgCtl || 1),
          cpl: Number((assignedPot as any)?.cpl || summary.avgCpl || 1),
          ctpl: Number((assignedPot as any)?.ctpl || 1),
          correction_source: 'imported_or_pot',
          audit: {},
        }

    if (method === 'chapter12_2021') {
      return {
        ...calculateChapter122021({ iv: summary.gross, ctl: factors.ctl, cpl: factors.cpl, mf, ccf: factors.ctpl, bsw_percent: bswPercent, api_version: apiVersion }),
        api_version: apiVersion,
        api_version_label: factors.api_version_label,
        ctpl: factors.ctpl,
        correction_source: factors.correction_source,
        calculation_audit: factors.audit,
      }
    }

    return {
      iv: summary.gross,
      ctl: factors.ctl,
      cpl: factors.cpl,
      ctpl: factors.ctpl,
      mf,
      gsv: summary.gross,
      nsv: summary.net,
      method,
      formula: 'Flow-X summary volumes',
      api_version: apiVersion,
      api_version_label: factors.api_version_label,
      correction_source: factors.correction_source,
      calculation_audit: factors.audit,
    }
  }

  async function loadContractProfiles() {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) return
    const { data, error } = await supabase.from('contract_profiles').select('*').eq('company_id', activeCompanyID).order('name')
    if (!error) setContractProfiles(data || [])
  }

  async function saveContractProfile() {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) return alert('No company selected.')
    if (!contractAreaId) return alert('Select an area.')
    if (!contractSegmentId) return alert('Select a segment.')
    if (!contractLeaseId) return alert('Select a lease.')

    const leaseRow: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(contractLeaseId))
    const producerRow: any = asArray(producers).find((producer: any) => String(producer.id || '') === String(leaseRow?.producer_id || ''))
    const leaseLabel = String(leaseRow?.lease_name || leaseRow?.name || leaseRow?.lease_number || 'Lease Contract').trim()
    const apiLabel = getApiVersionLabel(newContractApiVersion) || newContractApiVersion
    const contractDisplayName = `${leaseLabel} — ${apiLabel}`

    const payload: any = {
      company_id: activeCompanyID,
      area_id: contractAreaId,
      segment_id: contractSegmentId,
      lease_id: contractLeaseId,
      producer_id: leaseRow?.producer_id || null,
      name: contractDisplayName,
      product_group: contractProductGroup,
      calculation_method: newContractMethod,
      factor_type: newContractMethod,
      api_version: newContractApiVersion,
      standard: apiLabel,
      correction_source: newContractCorrectionSource,
      api_rounding: 1,
      ctl_rounding: 6,
      cpl_rounding: 6,
      ctlp_rounding: 6,
      volume_rounding: 2,
      use_pressure: true,
      use_shrink: contractProductGroup === 'Butane',
      active: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const existingProfile: any = asArray(contractProfiles).find((profile: any) =>
      String(profile.lease_id || '') === String(contractLeaseId) && profile.active !== false && profile.is_active !== false
    )

    const result = existingProfile?.id
      ? await supabase.from('contract_profiles').update(payload).eq('id', existingProfile.id)
      : await supabase.from('contract_profiles').insert(payload)

    if (result.error) return alert('Could not save lease contract profile: ' + result.error.message)

    setContractLeaseId('')
    setNewContractMf('1')
    setNewContractMethod('chapter12_2021')
    setNewContractApiVersion('api_11_1_2021')
    setNewContractCorrectionSource('app_calculated')
    setContractProductGroup('crude')
    await loadContractProfiles()
    alert('Lease contract profile saved.')
  }

  async function deleteContractProfile(profileId: string) {
    const { error } = await supabase.from('contract_profiles').delete().eq('id', profileId)
    if (error) return alert('Could not delete contract profile: ' + error.message)
    await loadContractProfiles()
  }

  async function importFlowXTransporterSummaryTickets() {
    if (!flowxCsvFile) {
      alert('Choose a Flow-X CSV file first.')
      return
    }

    const csvText = await flowxCsvFile.text()
    const parsed = parseFlowXCsvForMapping(csvText)
    const summaries = buildFlowXTransporterSummaries(parsed.data || [])
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!activeCompanyID) {
      alert('No company selected.')
      return
    }

    const duplicateDecision = await checkFlowXDuplicateImport(activeCompanyID, flowxCsvFile.name, flowxLactName || '')
    if (duplicateDecision === 'stop') {
      alert('Import cancelled. No duplicate tickets were created.')
      return
    }

    if (summaries.length === 0) {
      alert('No transporter totals found. Check Transporter and NSV/GSV columns.')
      return
    }

    const { data: batch, error: batchError } = await supabase
      .from('flowx_import_batches')
      .insert({
        company_id: activeCompanyID,
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
      const contractProfile = getContractProfileForTransporter(s.transporter)
      const contractCalc = applyContractProfileCalculation(s, assignedPot, contractProfile)
      const potObservedApiGravity = getPotObservedApiGravity(assignedPot, s.avgApi)
      const potApiGravity60 = getPotApiGravityAt60(assignedPot, potObservedApiGravity)
      const potBswPercent = getPotBswPercent(assignedPot, s.avgBsw)
      const potLabel = getPotNumberLabel(assignedPot)

      return ({
      company_id: activeCompanyID,
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
        contract_profile_id: contractProfile?.id || null,
        contract_name: contractProfile?.contract_name || null,
        calculation_method: contractCalc.method,
        calculation_formula: contractCalc.formula,
        api_version: contractCalc.api_version,
        api_version_label: contractCalc.api_version_label,
        correction_source: contractCalc.correction_source,
        calculation_audit: contractCalc.calculation_audit,
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
        gross_volume_bbl: contractCalc.iv,
        net_volume_bbl: contractCalc.nsv,
        average_temperature: s.avgTemp,
        average_pressure: s.avgPressure,
        observed_api_gravity: potObservedApiGravity,
        api_gravity_60: potApiGravity60,
        ctl: Number((assignedPot as any)?.ctl || s.avgCtl || 0),
        cpl: Number((assignedPot as any)?.cpl || s.avgCpl || 0),
        ctpl: Number((assignedPot as any)?.ctpl || s.avgCtpl || 0),
      },
      calculation_results: {
        gov: contractCalc.iv,
        gsv: contractCalc.gsv,
        nsv: contractCalc.nsv,
        average_temperature: s.avgTemp,
        average_pressure: s.avgPressure,
        api_gravity_60: potApiGravity60,
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
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!activeCompanyID) {
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
        company_id: activeCompanyID,
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
        p_company_id: activeCompanyID,
      })

      const ticketPayload: any = {
        company_id: activeCompanyID,
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
          observed_temperature: observedTemp || null,
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
    const parts = getRowAccountingDateParts(ticket, ['ticket_date', 'approved_at', 'created_at', 'updated_at'])
    const date = makeLocalDateTime(parts.date, parts.time)
    return date ? date.toISOString() : (ticket.approved_at || ticket.ticket_date || ticket.created_at || ticket.updated_at || '')
  }

  function formatDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function getCurrentOverShortRange() {
    if (overShortStartDate || overShortEndDate) {
      const start = overShortStartDate ? new Date(`${overShortStartDate}T07:01:00`) : null
      const end = overShortEndDate ? new Date(`${overShortEndDate}T07:00:00`) : null
      return {
        start,
        end,
        label: overShortStartDate || overShortEndDate ? `${overShortStartDate || 'Beginning'} 07:01 to ${overShortEndDate || 'Now'} 07:00` : 'All Dates',
      }
    }

    // Default dashboard O/S to the current accounting month:
    // current month starts on the 1st at 07:01 and ends next month on the 1st at 07:00.
    const now = new Date()
    const accountingNow = getAccountingDateFromValue(now.toISOString()) || now
    const start = new Date(accountingNow.getFullYear(), accountingNow.getMonth(), 1, 7, 1, 0, 0)
    const end = new Date(accountingNow.getFullYear(), accountingNow.getMonth() + 1, 1, 7, 0, 0, 0)
    const label = accountingNow.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return { start, end, label }
  }

  function setOverShortAccountingMonth(monthOffset = 0) {
    const now = new Date()
    const accountingNow = getAccountingDateFromValue(now.toISOString()) || now
    const start = new Date(accountingNow.getFullYear(), accountingNow.getMonth() + monthOffset, 1)
    const end = new Date(accountingNow.getFullYear(), accountingNow.getMonth() + monthOffset + 1, 1)
    setOverShortStartDate(formatDateInputValue(start))
    setOverShortEndDate(formatDateInputValue(end))
  }

  function isTicketInOverShortRange(ticket: any) {
    const parts = getRowAccountingDateParts(ticket, ['ticket_date', 'approved_at', 'created_at', 'updated_at'])
    const ticketDate = makeLocalDateTime(parts.date, parts.time)
    if (!ticketDate) return true

    const { start, end } = getCurrentOverShortRange()
    if (start && ticketDate < start) return false
    if (end && ticketDate > end) return false

    return true
  }

  function toBalanceNumber(value: any) {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  function getTicketIvForBalance(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}

    const opening = toBalanceNumber(
      ticket?.opening_reading ??
      ticket?.opening_meter_reading ??
      observed.opening_reading ??
      observed.opening_meter_reading ??
      observed.open_meter_reading ??
      calc.opening_reading
    )

    const closing = toBalanceNumber(
      ticket?.closing_reading ??
      ticket?.closing_meter_reading ??
      observed.closing_reading ??
      observed.closing_meter_reading ??
      observed.close_meter_reading ??
      calc.closing_reading
    )

    if (opening !== null && closing !== null) {
      const diff = closing - opening
      if (Number.isFinite(diff) && Math.abs(diff) > 0.000001) return diff
    }

    return Number(
      calc.iv ??
      observed.iv ??
      observed.total_batch_barrels ??
      observed.batch_barrels ??
      observed.gross_observed_volume ??
      observed.gross_bbls ??
      calc.gross_bbls ??
      ticket?.gross_volume ??
      0
    )
  }

  function getTicketGsvForBalance(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}

    const iv = getTicketIvForBalance(ticket)
    const ctl = toBalanceNumber(calc.ctl ?? observed.ctl ?? ticket?.ctl)
    const cpl = toBalanceNumber(calc.cpl ?? observed.cpl ?? ticket?.cpl)
    const mf = toBalanceNumber(calc.mf ?? observed.mf ?? ticket?.mf) ?? 1
    const ctpl = toBalanceNumber(calc.ctpl ?? observed.ctpl)

    if (Number.isFinite(iv)) {
      if (ctl !== null && cpl !== null) return iv * ctl * cpl * mf
      if (ctpl !== null) return iv * ctpl * mf
    }

    return Number(
      calc.gsv ??
      calc.tank_gsv ??
      observed.tank_gsv ??
      ticket?.gsv ??
      0
    )
  }

  function getTicketNsvForBalance(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}
    const gsv = getTicketGsvForBalance(ticket)

    const csw = toBalanceNumber(
      calc.csw ??
      observed.csw ??
      ticket?.csw
    )

    if (Number.isFinite(gsv) && csw !== null) return gsv * csw

    const bswPercent = toBalanceNumber(
      calc.bsw_percent ??
      observed.bsw_percent ??
      observed.bsw ??
      ticket?.bsw
    )

    if (Number.isFinite(gsv) && bswPercent !== null) return gsv * (1 - (bswPercent / 100))

    return Number(
      calc.nsv ??
      calc.tank_nsv ??
      observed.tank_nsv ??
      ticket?.nsv ??
      gsv ??
      0
    )
  }

  function getTicketVolumeForBalance(ticket: any) {
    if (String(ticket?.ticket_type || '').toLowerCase() === 'tank') {
      return Number(
        ticket.calculation_results?.tank_nsv ??
        ticket.calculation_results?.tank_gsv ??
        ticket.calculation_results?.gov ??
        ticket.calculation_results?.tank_gov ??
        0
      )
    }

    return getTicketNsvForBalance(ticket)
  }

  function normalizeMeterRole(value: any) {
    const role = String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
    if (['receipt', 'inbound', 'receive', 'receipts'].includes(role)) return 'receipt'
    if (['delivery', 'outbound', 'deliveries', 'sale', 'sales'].includes(role)) return 'delivery'
    if (['check', 'check_meter', 'master', 'master_meter'].includes(role)) return 'check_meter'
    if (['butane', 'butane_injection', 'blend', 'blend_meter'].includes(role)) return 'butane'
    if (['refined', 'refined_product', 'diesel', 'gasoline', 'gas', 'jet'].includes(role)) return 'refined'
    if (['excluded', 'exclude', 'ignore'].includes(role)) return 'excluded'
    return role || ''
  }

  function getMeterById(meterId: string) {
    return meters.find((m: any) => String(m.id) === String(meterId))
  }

  function getLeaseById(leaseId: any) {
    return leases.find((lease: any) => String(lease.id || '') === String(leaseId || ''))
  }

  function getMeterDisplayName(meter: any) {
    const lease = getLeaseById(meter?.lease_id)
    const leaseName = String(lease?.lease_name || lease?.name || '').trim()
    const meterName = String(meter?.meter_name || '').trim()
    const meterNumber = String(meter?.meter_number || '').trim()
    const main = leaseName || meterName || meterNumber || 'Unnamed meter'
    const secondary = meterNumber && meterNumber !== main ? meterNumber : ''
    return { main, secondary }
  }

  function getMeterSegmentForBalance(meter: any) {
    if (meter?.segment_id) return meter.segment_id
    const lease = getLeaseById(meter?.lease_id)
    return lease?.segment_id || ''
  }

  function getBalanceMetersForSegment(segmentId: string) {
    return meters.filter((meter: any) => String(getMeterSegmentForBalance(meter) || '') === String(segmentId || ''))
  }


  function getProvingDisplayName(proving: any) {
    const meter = getMeterById(proving?.meter_id || proving?.meterId || '')
    const lease = getLeaseById(proving?.lease_id || proving?.leaseId || meter?.lease_id || '')
    const leaseName = String(lease?.lease_name || lease?.name || '').trim()
    const meterName = String(meter?.meter_name || '').trim()
    const meterNumber = String(meter?.meter_number || '').trim()
    const main = leaseName || meterName || meterNumber || 'Proving'
    const secondary = [meterNumber && meterNumber !== main ? `Meter: ${meterNumber}` : '', meterName && meterName !== main ? meterName : '']
      .filter(Boolean)
      .join(' • ')
    return { main, secondary }
  }

  function makeLocalDateTime(dateValue: any, timeValue?: any) {
    if (!dateValue) return null
    const dateText = String(dateValue || '').trim()
    const timeText = String(timeValue || '').trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      const [year, month, day] = dateText.split('-').map(Number)
      let hours = 0
      let minutes = 0
      if (timeText) {
        const normalized = timeText.toUpperCase()
        const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/)
        if (match) {
          hours = Number(match[1])
          minutes = Number(match[2])
          const ampm = match[4]
          if (ampm === 'PM' && hours < 12) hours += 12
          if (ampm === 'AM' && hours === 12) hours = 0
        }
      }
      return new Date(year, month - 1, day, hours, minutes, 0, 0)
    }

    const parsed = new Date(timeText ? `${dateText} ${timeText}` : dateText)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  function getAccountingDateFromValue(dateValue: any, timeValue?: any) {
    const date = makeLocalDateTime(dateValue, timeValue)
    if (!date) return null

    // Accounting month starts at 07:01 on the 1st and ends at 07:00 on the 1st.
    // Subtracting 7 hours and 1 minute makes 06/01 07:00 count as May,
    // and 06/01 07:01 count as June.
    return new Date(date.getTime() - ((7 * 60 + 1) * 60 * 1000))
  }

  function getAccountingMonthKey(dateValue: any, timeValue?: any) {
    const accountingDate = getAccountingDateFromValue(dateValue, timeValue)
    if (!accountingDate) return 'Unknown'
    return `${accountingDate.getFullYear()}-${String(accountingDate.getMonth() + 1).padStart(2, '0')}`
  }

  function getAccountingMonthLabel(dateValue: any, timeValue?: any) {
    const key = getAccountingMonthKey(dateValue, timeValue)
    if (key === 'Unknown') return 'Undated'
    const [year, month] = key.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  function getRowAccountingDateParts(row: any, fields: string[] = []) {
    const observed = row?.observed_inputs || {}
    const calc = row?.calculation_results || {}

    // For tickets, the manually-entered close_date / close_time must win.
    // Some imported or edited tickets can still have an older close_datetime value,
    // and that was causing the archive month to follow the wrong timestamp.
    const closeDate =
      row?.close_date ||
      observed?.close_date ||
      calc?.close_date ||
      row?.closing_date ||
      observed?.closing_date ||
      calc?.closing_date
    const closeTime =
      row?.close_time ||
      observed?.close_time ||
      calc?.close_time ||
      row?.closing_time ||
      observed?.closing_time ||
      calc?.closing_time

    if (closeDate) return { date: closeDate, time: closeTime }

    const closeDateTime =
      row?.close_datetime ||
      observed?.close_datetime ||
      calc?.close_datetime ||
      row?.closing_datetime ||
      observed?.closing_datetime ||
      calc?.closing_datetime

    if (closeDateTime) return { date: closeDateTime, time: undefined }

    const value =
      fields.map((field) => row?.[field]).find(Boolean) ||
      row?.sample_date ||
      row?.reading_date ||
      row?.proving_date ||
      row?.approved_at ||
      row?.created_at ||
      row?.updated_at ||
      row?.date

    return { date: value, time: undefined }
  }

  function getProvingMonthLabel(proving: any) {
    const parts = getRowAccountingDateParts(proving, ['approved_at', 'proving_date', 'created_at'])
    return getAccountingMonthLabel(parts.date, parts.time)
  }

  function groupProvingsByMonth(rows: any[]) {
    return rows.reduce((groups: Record<string, any[]>, proving: any) => {
      const key = getProvingMonthLabel(proving)
      if (!groups[key]) groups[key] = []
      groups[key].push(proving)
      return groups
    }, {})
  }


  function getMonthLabelFromRow(row: any, fields: string[] = []) {
    const parts = getRowAccountingDateParts(row, fields)
    return getAccountingMonthLabel(parts.date, parts.time)
  }

  function groupRowsByMonth(rows: any[], fields: string[] = []) {
    return rows.reduce((groups: Record<string, any[]>, row: any) => {
      const key = getMonthLabelFromRow(row, fields)
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
      return groups
    }, {})
  }

  function getReadingDisplayName(row: any) {
    const meter = getMeterById(row?.meter_id || row?.meterId || '')
    const lease = getLeaseById(row?.lease_id || row?.leaseId || meter?.lease_id || '')
    const leaseName = String(lease?.lease_name || lease?.name || '').trim()
    const meterNumber = String(meter?.meter_number || row?.meter_number || '').trim()
    return {
      main: leaseName || meterNumber || 'Reading',
      secondary: meterNumber && meterNumber !== leaseName ? `Meter: ${meterNumber}` : ''
    }
  }

  function getPotDisplayName(row: any) {
    const meter = getMeterById(row?.meter_id || row?.meterId || '')
    const lease = getLeaseById(row?.lease_id || row?.leaseId || meter?.lease_id || '')
    const leaseName = String(lease?.lease_name || lease?.name || '').trim()
    const segment = segments.find((s: any) => s.id === row?.segment_id)
    return {
      main: leaseName || row?.pot_number || row?.sample_id || 'POT Quality',
      secondary: segment ? `Segment: ${(segment as any).segment_name || (segment as any).name}` : ''
    }
  }

  function meterMatchesSearch(meter: any, searchText: string) {
    const search = String(searchText || '').trim().toLowerCase()
    if (!search) return true
    const label = getMeterDisplayName(meter)
    return [label.main, label.secondary, meter?.meter_name, meter?.meter_number]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search))
  }

  function MeterChoiceLabel({ meter }: { meter: any }) {
    const label = getMeterDisplayName(meter)
    return (
      <span style={{ display: 'grid', lineHeight: 1.2 }}>
        <span style={{ fontWeight: 700 }}>{label.main}</span>
        {label.secondary ? <span style={{ color: '#a8b3bd', fontSize: 11 }}>Meter: {label.secondary}</span> : null}
      </span>
    )
  }

  function getMeterConfiguredRole(meter: any) {
    return normalizeMeterRole(meter?.meter_role || meter?.balance_role || meter?.meter_direction || meter?.direction)
  }

  function getMeterProductType(meter: any) {
    return String(meter?.product_type || meter?.product || meter?.commodity || '').trim().toLowerCase()
  }

  function meterIncludedInOS(meter: any) {
    if (!meter) return true
    if (meter.include_in_os === false || meter.include_in_over_short === false) return false
    return getMeterConfiguredRole(meter) !== 'excluded'
  }

  function getMeterBalanceRole(ticket: any) {
    const meter = meters.find((m: any) => String(m.id) === String(ticket.meter_id || ticket.observed_inputs?.meter_id || ''))
    const role = normalizeMeterRole(
      (meter as any)?.meter_role ||
      (meter as any)?.balance_role ||
      (meter as any)?.meter_direction ||
      (meter as any)?.direction ||
      ticket.meter_direction ||
      ticket.direction ||
      ticket.movement_direction ||
      ticket.observed_inputs?.meter_direction ||
      ticket.observed_inputs?.direction ||
      ticket.observed_inputs?.movement_direction ||
      ticket.observed_inputs?.receipt_delivery ||
      ticket.receipt_delivery ||
      ''
    )

    if (role) return role

    // If the master data has not been assigned a receipt/delivery role yet,
    // keep meter tickets from disappearing out of O/S. Most field LACT tickets are receipts unless marked otherwise.
    if (String(ticket.ticket_type || '').toLowerCase() === 'truck') return 'receipt'
    if (String(ticket.ticket_type || '').toLowerCase() === 'meter') return 'receipt'

    return ''
  }

  function getSelectedReadingMeterRole() {
    return getMeterConfiguredRole(getMeterById(selectedReadingMeter))
  }

  function getSelectedReadingMovementType() {
    const role = getSelectedReadingMeterRole()
    if (role === 'delivery') return 'delivery'
    return 'receipt'
  }

  function getTankSignedMovement(ticket: any) {
    const direction = String(ticket.movement_direction || ticket.observed_inputs?.tank_movement_direction || '').toLowerCase()
    const volume = Number(
      ticket.calculation_results?.tank_nsv ??
      ticket.calculation_results?.tank_movement_bbl ??
      ticket.calculation_results?.nsv ??
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

  function isBalanceEntryInRange(entry: any) {
    const raw = entry.period_start || entry.effective_date || entry.created_at || ''
    if (!raw) return true
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return true
    if (overShortStartDate && date < new Date(`${overShortStartDate}T00:00:00`)) return false
    if (overShortEndDate && date > new Date(`${overShortEndDate}T23:59:59`)) return false
    return true
  }

  function getBalanceInventoryEntryForSegment(segmentId: string) {
    return balanceInventoryEntries
      .filter((entry: any) => entry.segment_id === segmentId && isBalanceEntryInRange(entry))
      .sort((a: any, b: any) => new Date(b.period_start || b.created_at || 0).getTime() - new Date(a.period_start || a.created_at || 0).getTime())[0]
  }

  function getSegmentBalanceSetting(segmentId: string) {
    return segmentBalanceSettings.find((setting: any) => setting.segment_id === segmentId) || null
  }

  function getSegmentBalanceMode(segmentId: string) {
    const setting = getSegmentBalanceSetting(segmentId)
    const rawMode = String(setting?.segment_type || setting?.balance_mode || setting?.report_mode || setting?.segment_mode || 'custody_transfer').toLowerCase()

    if (['totals_only', 'totals', 'report_totals', 'reporting_only', 'reporting'].includes(rawMode)) return 'reporting_only'
    return 'custody_transfer'
  }

  function segmentIsTotalsOnly(segmentId: string) {
    return getSegmentBalanceMode(segmentId) === 'reporting_only'
  }

  function getSegmentTypeLabel(segmentId: string) {
    return segmentIsTotalsOnly(segmentId) ? 'Reporting Only' : 'Custody Transfer'
  }

  async function saveSegmentBalanceMode(segmentId: string, segmentType: string) {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('Select a company first.')
      return
    }

    const existing = getSegmentBalanceSetting(segmentId)
    const normalizedType = segmentType === 'reporting_only' ? 'reporting_only' : 'custody_transfer'
    const legacyMode = normalizedType === 'reporting_only' ? 'totals_only' : 'balance'

    const payload: any = {
      company_id: activeCompanyID,
      segment_id: segmentId,
      segment_type: normalizedType,
      balance_mode: legacyMode,
      report_mode: legacyMode,
      active: true,
      updated_at: new Date().toISOString(),
    }

    const result = existing?.id
      ? await supabase.from('segment_balance_settings').update(payload).eq('id', existing.id)
      : await supabase.from('segment_balance_settings').insert(payload)

    if (result.error) {
      alert('Could not save segment type. Run the segment type SQL first if this is the first time using reporting-only segments. ' + result.error.message)
      return
    }

    await loadAll()
  }

  function segmentHasButaneBlendEnabled(segmentId: string) {
    const setting = getSegmentBalanceSetting(segmentId)
    if (setting) return setting.enable_butane_blend === true
    // Backward compatibility: if a butane adjustment already exists for this segment, show the butane KPI instead of hiding existing work.
    return balanceButaneAdjustments.some((adjustment: any) => adjustment.segment_id === segmentId && adjustment.active !== false)
  }

  async function toggleSegmentButaneBlend(segmentId: string, enabled: boolean) {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('Select a company first.')
      return
    }

    const existing = getSegmentBalanceSetting(segmentId)
    const payload: any = {
      company_id: activeCompanyID,
      segment_id: segmentId,
      enable_butane_blend: enabled,
      shrinkage_method: 'API MPMS 12.3',
      include_shrinkage_in_os: enabled,
      active: true,
      updated_at: new Date().toISOString(),
    }

    const result = existing?.id
      ? await supabase.from('segment_balance_settings').update(payload).eq('id', existing.id)
      : await supabase.from('segment_balance_settings').insert(payload)

    if (result.error) {
      alert(`Could not save segment balance setting: ${result.error.message}`)
      return
    }

    await loadAll()
  }

  function getButaneAdjustmentForSegment(segmentId: string) {
    const entry = balanceButaneAdjustments
      .filter((adjustment: any) => adjustment.segment_id === segmentId && isBalanceEntryInRange(adjustment) && adjustment.active !== false)
      .sort((a: any, b: any) => new Date(b.period_start || b.created_at || 0).getTime() - new Date(a.period_start || a.created_at || 0).getTime())[0]

    const butaneGsv = Number(entry?.butane_gsv_bbl ?? entry?.butane_gsv ?? 0)
    const totalBlendVolume = Number(entry?.total_blend_volume_bbl ?? entry?.total_initial_volume_bbl ?? 0)
    const shrinkageAdjustmentBbl = Number(entry?.shrinkage_adjustment_bbl ?? entry?.shrinkage_bbl ?? 0)
    const blendPercent = totalBlendVolume ? (butaneGsv / totalBlendVolume) * 100 : 0

    return {
      entry,
      butaneGsv,
      totalBlendVolume,
      blendPercent,
      shrinkageAdjustmentBbl,
    }
  }

  function getApprovedMeterVolume(meterId: string) {
    return getScopedTickets()
      .filter((ticket: any) =>
        ticket.status === 'approved' &&
        ticket.meter_id === meterId &&
        isTicketInOverShortRange(ticket)
      )
      .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)
  }

  function getCheckMeterRowsForSegment(segmentId: string) {
    return balanceCheckGroups
      .filter((group: any) => group.segment_id === segmentId && group.active !== false)
      .map((group: any) => {
        const members = balanceCheckGroupMeters.filter((member: any) => member.check_group_id === group.id || member.group_id === group.id)
        const checkMeterIds = Array.from(new Set([
          group.check_meter_id,
          ...members
            .filter((member: any) => String(member.role || member.meter_role || '').toLowerCase() === 'check')
            .map((member: any) => member.meter_id),
        ].filter(Boolean).map((id: any) => String(id))))

        const inputMeterIds = members
          .filter((member: any) => String(member.role || member.meter_role || 'input').toLowerCase() !== 'check')
          .map((member: any) => member.meter_id)
          .filter(Boolean)
          .filter((meterId: any) => !checkMeterIds.includes(String(meterId)))

        const inputTotal = inputMeterIds.reduce((sum: number, meterId: string) => sum + getApprovedMeterVolume(meterId), 0)
        const checkTotal = checkMeterIds.reduce((sum: number, meterId: string) => sum + getApprovedMeterVolume(meterId), 0)
        const checkMeterId = checkMeterIds[0] || ''
        // Check meter group O/S is check meter total minus the grouped meter total.
        // Example: two outbound check meters - tank movement/truck LACTs/inbound meters.
        const difference = checkTotal - inputTotal
        const differencePercent = checkTotal ? (difference / Math.abs(checkTotal)) * 100 : 0
        return { group, inputMeterIds, checkMeterId, checkMeterIds, inputTotal, checkTotal, difference, differencePercent }
      })
  }

  function toggleStringSelection(setter: any, value: string, checked: boolean) {
    setter((current: string[]) => checked ? Array.from(new Set([...current, value])) : current.filter((item) => item !== value))
  }

  function getCheckMeterGroupRollup(groupId: string) {
    const row = balanceCheckGroups.find((group: any) => String(group.id) === String(groupId))
    if (!row) return { inputTotal: 0, checkTotal: 0, difference: 0, differencePercent: 0 }
    const segmentRows = getCheckMeterRowsForSegment(row.segment_id || '')
    return segmentRows.find((item: any) => String(item.group.id) === String(groupId)) || { inputTotal: 0, checkTotal: 0, difference: 0, differencePercent: 0 }
  }

  function getBalanceEquationRowsForSegment(segmentId: string, contextRow?: any) {
    return balanceEquations
      .filter((equation: any) => equation.active !== false && String(equation.segment_id || '') === String(segmentId || ''))
      .map((equation: any) => {
        const items = balanceEquationItems.filter((item: any) => String(item.equation_id || '') === String(equation.id))
        const itemTotal = (side: string) => items
          .filter((item: any) => String(item.side || '').toUpperCase() === side)
          .reduce((sum: number, item: any) => {
            if (item.item_type === 'check_group') {
              const rollup = getCheckMeterGroupRollup(item.item_id)
              const valueMode = item.value_mode || 'check_total'
              if (valueMode === 'input_total') return sum + Number(rollup.inputTotal || 0)
              if (valueMode === 'variance') return sum + Number(rollup.difference || 0)
              return sum + Number(rollup.checkTotal || 0)
            }
            return sum + getApprovedMeterVolume(item.item_id)
          }, 0)
        const tankChange = equation.include_tank_change && contextRow ? Number(contextRow.tankChange || 0) : 0
        const lineFillChange = equation.include_line_fill_change && contextRow ? Number(contextRow.lineFillChange || 0) : 0
        const sideA = itemTotal('A') + tankChange + lineFillChange
        const sideB = itemTotal('B')
        const difference = sideA - sideB
        const differencePercent = sideB ? (difference / Math.abs(sideB)) * 100 : 0
        return { equation, items, sideA, sideB, tankChange, lineFillChange, difference, differencePercent }
      })
  }

  function getSegmentDisplayName(segment: any) {
    // Your actual Supabase segments table uses `name`. Keep legacy aliases only as fallback.
    return cleanExcelText(segment?.name || segment?.segment_name || segment?.segment || 'Segment')
  }

  function segmentIsInCurrentCompanyScope(segment: any) {
    if (!segment || !segment.id) return false
    if (segment.active === false) return false

    // Super admin with a selected company should not export stale segments from other companies.
    const activeCompanyId = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (activeCompanyId && segment.company_id && String(segment.company_id) !== String(activeCompanyId)) return false

    // Operators/measurement users stay limited to their allowed area hierarchy.
    if (!userIsSuperAdmin && !userIsCompanyAdmin) {
      const { segmentIds } = buildScopedHierarchyIds()
      if (!segmentIds.has(String(segment.id))) return false
    }

    return true
  }

  function getOverShortExportSegments() {
    // Export must use the same real segment rows the O/S screen uses.
    // Do not use hardcoded/fallback segment names here. Excel safety is handled only in safeWorksheetName().
    const segmentRows = asArray(getScopedSegments && typeof getScopedSegments === 'function' ? getScopedSegments() : segments)
      .filter((segment: any) => segment && segment.active !== false)
      .filter((segment: any) => !overShortSegmentId || String(segment.id || '') === String(overShortSegmentId))

    return segmentRows.sort((a: any, b: any) => getSegmentDisplayName(a).localeCompare(getSegmentDisplayName(b)))
  }

  function getOverShortRows() {
    return getOverShortExportSegments()
      .map((segment: any) => {
        const segmentTickets = getScopedTickets().filter((ticket: any) => {
          const meter = getMeterById(ticket.meter_id || ticket.observed_inputs?.meter_id || '')
          const lease = getLeaseById(ticket.lease_id || ticket.observed_inputs?.lease_id || meter?.lease_id || '')
          const ticketSegmentId =
            ticket.segment_id ||
            ticket.observed_inputs?.segment_id ||
            meter?.segment_id ||
            lease?.segment_id ||
            ''
          return (
            String(ticket.status || '').toLowerCase() === 'approved' &&
            String(ticketSegmentId || '') === String(segment.id || '') &&
            isTicketInOverShortRange(ticket)
          )
        })

        const receipts = segmentTickets
          .filter((ticket: any) => {
            const meter = getMeterById(ticket.meter_id || ticket.observed_inputs?.meter_id || '')
            return ticket.ticket_type !== 'tank' && meterIncludedInOS(meter) && getMeterBalanceRole(ticket) === 'receipt'
          })
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const deliveries = segmentTickets
          .filter((ticket: any) => {
            const meter = getMeterById(ticket.meter_id || ticket.observed_inputs?.meter_id || '')
            return ticket.ticket_type !== 'tank' && meterIncludedInOS(meter) && getMeterBalanceRole(ticket) === 'delivery'
          })
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const truckTickets = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'truck')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const inventoryEntry = getBalanceInventoryEntryForSegment(segment.id)
        const ticketTankChange = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'tank')
          .reduce((sum: number, ticket: any) => sum + getTankSignedMovement(ticket), 0)

        const ticketLineFillChange = segmentTickets
          .filter((ticket: any) => ticket.ticket_type === 'line_fill')
          .reduce((sum: number, ticket: any) => sum + getTicketVolumeForBalance(ticket), 0)

        const tankBegin = Number(inventoryEntry?.tank_inventory_begin_bbl ?? inventoryEntry?.tank_begin_bbl ?? 0)
        const tankEnd = Number(inventoryEntry?.tank_inventory_end_bbl ?? inventoryEntry?.tank_end_bbl ?? 0)
        const lineFillBegin = Number(inventoryEntry?.line_fill_begin_bbl ?? 0)
        const lineFillEnd = Number(inventoryEntry?.line_fill_end_bbl ?? 0)
        const tankChange = inventoryEntry ? (tankBegin - tankEnd) : ticketTankChange
        const lineFillChange = inventoryEntry ? (lineFillBegin - lineFillEnd) : ticketLineFillChange
        const butaneEnabled = segmentHasButaneBlendEnabled(segment.id)
        const butaneAdjustment = getButaneAdjustmentForSegment(segment.id)
        const checkMeterRows = getCheckMeterRowsForSegment(segment.id)
        const checkMeterOverShort = checkMeterRows.reduce((sum: number, row: any) => sum + row.difference, 0)
        const totalsOnly = segmentIsTotalsOnly(segment.id)

        const bookInventory = receipts - deliveries - truckTickets + tankChange + lineFillChange + (butaneEnabled ? butaneAdjustment.shrinkageAdjustmentBbl : 0)
        const actualInventory = inventoryEntry
          ? Number(inventoryEntry?.actual_inventory_bbl ?? inventoryEntry?.actual_inventory ?? getActualTankInventoryForSegment(segment.id))
          : getActualTankInventoryForSegment(segment.id)
        const overShort = totalsOnly ? 0 : actualInventory - bookInventory
        const overShortPercent = !totalsOnly && bookInventory !== 0 ? (overShort / Math.abs(bookInventory)) * 100 : 0
        const stationEquationRows = totalsOnly ? [] : getBalanceEquationRowsForSegment(segment.id, { tankChange, lineFillChange })
        const reportedTotal = receipts + deliveries + truckTickets + Math.abs(tankChange) + Math.abs(lineFillChange)

        return {
          segment,
          totalsOnly,
          balanceMode: totalsOnly ? 'totals_only' : 'balance',
          reportedTotal,
          receipts,
          deliveries,
          truckTickets,
          tankChange,
          lineFillChange,
          tankBegin,
          tankEnd,
          lineFillBegin,
          lineFillEnd,
          butaneEnabled,
          butaneAdjustment,
          checkMeterRows,
          checkMeterOverShort,
          stationEquationRows,
          bookInventory,
          actualInventory,
          overShort,
          overShortPercent,
        }
      })
  }


  function cleanExcelText(value: any) {
    // SpreadsheetML/Excel will reject XML control characters. Keep tabs/newlines, strip the rest.
    return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  }

  function xmlEscape(value: any) {
    return cleanExcelText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function safeWorksheetName(rawName: any, usedNames: Set<string>) {
    const cleaned = cleanExcelText(rawName || 'Sheet')
      .replace(/[\\\/\?\*\[\]\:]/g, '-')
      .replace(/'/g, '')
      .trim() || 'Sheet'

    const base = cleaned.slice(0, 31) || 'Sheet'
    let name = base
    let index = 2

    while (usedNames.has(name.toLowerCase())) {
      const suffix = ` ${index}`
      name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
      index += 1
    }

    usedNames.add(name.toLowerCase())
    return name
  }

  function excelCell(value: any, type: 'String' | 'Number' = 'String') {
    const numeric = type === 'Number' && value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))

    return `<Cell><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(numeric ? Number(value) : value)}</Data></Cell>`
  }

  function excelRow(values: any[], numericIndexes: number[] = []) {
    return `<Row>${values.map((value, index) => excelCell(value, numericIndexes.includes(index) ? 'Number' : 'String')).join('')}</Row>`
  }

  function downloadExcelXml(filename: string, sheets: { name: string; rows: any[][]; numericIndexes?: number[] }[]) {
    const usedSheetNames = new Set<string>()
    const safeSheets = sheets.map((sheet) => ({
      ...sheet,
      safeName: safeWorksheetName(sheet.name, usedSheetNames),
      rows: Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [['No data']],
    }))

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
 ${safeSheets.map((sheet) => `
 <Worksheet ss:Name="${xmlEscape(sheet.safeName)}">
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
    link.download = filename.replace(/\.xlsx$/i, '.xls')
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
    const parts = getRowAccountingDateParts(ticket, ['ticket_date', 'approved_at', 'created_at', 'updated_at'])
    const closeDate = makeLocalDateTime(parts.date, parts.time)
    if (closeDate) return closeDate.toISOString()
    return ticket.ticket_date || ticket.approved_at || ticket.created_at || ticket.updated_at || ''
  }

  function getReportFilteredTickets(type?: string) {
    return getScopedTickets().filter((ticket: any) => {
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
        ticket.calculation_results?.gsv ?? ticket.calculation_results?.tank_gsv ?? '',
        ticket.calculation_results?.nsv ?? ticket.calculation_results?.tank_nsv ?? '',
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
          Number(ticket.calculation_results?.gsv ?? ticket.calculation_results?.tank_gsv ?? 0).toFixed(2),
          Number(ticket.calculation_results?.nsv ?? ticket.calculation_results?.tank_nsv ?? 0).toFixed(2),
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
        Number(ticket.calculation_results?.gsv ?? 0).toFixed(2),
        Number(ticket.calculation_results?.nsv ?? 0).toFixed(2),
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

    const getTicketLease = (ticket: any) => {
      const leaseId = ticket.lease_id || ticket.observed_inputs?.lease_id
      return leases.find((lease: any) => String(lease.id) === String(leaseId))
    }

    const getTicketMeter = (ticket: any) => {
      const meterId = ticket.meter_id || ticket.observed_inputs?.meter_id
      return meters.find((meter: any) => String(meter.id) === String(meterId))
    }

    const getTicketIv = (ticket: any) => {
      const observed = ticket.observed_inputs || {}
      const calc = ticket.calculation_results || {}

      const toNum = (value: any) => {
        if (value === null || value === undefined || value === '') return null
        const num = Number(value)
        return Number.isFinite(num) ? num : null
      }

      const opening = toNum(
        ticket.opening_reading ??
        ticket.opening_meter_reading ??
        observed.opening_reading ??
        observed.opening_meter_reading ??
        observed.open_meter_reading ??
        calc.opening_reading
      )

      const closing = toNum(
        (ticket as any).closing_reading ??
        (ticket as any).closing_meter_reading ??
        observed.closing_reading ??
        observed.closing_meter_reading ??
        observed.close_meter_reading ??
        calc.closing_reading
      )

      // Total Batch Barrels / IV must be the actual batch movement:
      // Closing Meter Reading - Opening Meter Reading.
      if (opening !== null && closing !== null) {
        const diff = closing - opening
        if (Number.isFinite(diff) && Math.abs(diff) > 0.000001) return diff
      }

      return Number(
        calc.iv ??
        observed.iv ??
        observed.total_batch_barrels ??
        observed.batch_barrels ??
        observed.gross_observed_volume ??
        observed.gross_bbls ??
        calc.gross_bbls ??
        ticket.gross_volume ??
        getTicketVolumeForBalance(ticket) ??
        0
      )
    }

    const getTicketGsv = (ticket: any) => getTicketGsvForBalance(ticket)

    const getTicketNsv = (ticket: any) => getTicketNsvForBalance(ticket)

    const getTicketSw = (ticket: any) => {
      const direct = ticket.observed_inputs?.sw_percent ?? ticket.observed_inputs?.bsw ?? ticket.bsw
      if (direct !== undefined && direct !== null && direct !== '') return Number(direct)
      const csw = Number(ticket.observed_inputs?.csw ?? ticket.csw ?? 1)
      return Number.isFinite(csw) ? (1 - csw) * 100 : 0
    }

    const getTicketCtl = (ticket: any) => Number(ticket.calculation_results?.ctl ?? ticket.observed_inputs?.ctl ?? ticket.ctl ?? 0)
    const getTicketCpl = (ticket: any) => Number(ticket.calculation_results?.cpl ?? ticket.observed_inputs?.cpl ?? ticket.cpl ?? 0)

    const isTicketInput = (ticket: any) => {
      const role = String(getMeterBalanceRole(ticket) || '').trim().toLowerCase()
      return ['receipt', 'inbound', 'butane', 'butane injection', 'refined', 'truck', 'tank receipt'].includes(role)
    }

    const isTicketOutput = (ticket: any) => {
      const role = String(getMeterBalanceRole(ticket) || '').trim().toLowerCase()
      return ['delivery', 'outbound', 'tank delivery'].includes(role)
    }

    const getSegmentApprovedTickets = (segmentId: string) => tickets.filter((ticket: any) =>
      ticket.status === 'approved' &&
      String(ticket.segment_id || '') === String(segmentId) &&
      isTicketInOverShortRange(ticket)
    )

    const summaryRows = [
      ['Executive Measurement Closeout Summary'],
      ['Period Start', overShortStartDate || 'All', 'Period End', overShortEndDate || 'All'],
      [],
      [
        'Segment',
        'IV In', 'IV Out', 'IV O/S',
        'GSV In', 'GSV Out', 'GSV O/S',
        'NSV In', 'NSV Out', 'NSV O/S', 'NSV O/S %',
        'Tank Begin', 'Tank End', 'Tank Change',
        'Line Fill Begin', 'Line Fill End', 'Line Fill Change',
        'Station Input NSV', 'Station Output NSV', 'Station O/S NSV',
        'Butane GSV', 'Blend %', 'Shrinkage BBLs',
      ],
      ...rows.map((row: any) => {
        const segmentTickets = getSegmentApprovedTickets(row.segment.id)
        const inputTickets = segmentTickets.filter(isTicketInput)
        const outputTickets = segmentTickets.filter(isTicketOutput)
        const sum = (ticketRows: any[], getter: (ticket: any) => number) => ticketRows.reduce((total, ticket) => total + Number(getter(ticket) || 0), 0)
        const ivIn = sum(inputTickets, getTicketIv)
        const ivOut = sum(outputTickets, getTicketIv)
        const gsvIn = sum(inputTickets, getTicketGsv)
        const gsvOut = sum(outputTickets, getTicketGsv)
        const nsvIn = sum(inputTickets, getTicketNsv)
        const nsvOut = sum(outputTickets, getTicketNsv)
        const stationInput = (row.stationEquationRows || []).length
          ? (row.stationEquationRows || []).reduce((total: number, equation: any) => total + Number(equation.sideA || 0), 0)
          : nsvIn
        const stationOutput = (row.stationEquationRows || []).length
          ? (row.stationEquationRows || []).reduce((total: number, equation: any) => total + Number(equation.sideB || 0), 0)
          : nsvOut
        const stationOs = stationInput - stationOutput
        const nsvOs = nsvIn - nsvOut + Number(row.tankChange || 0) + Number(row.lineFillChange || 0) + (row.butaneEnabled ? Number(row.butaneAdjustment?.shrinkageAdjustmentBbl || 0) : 0)
        const nsvOsPercent = nsvIn !== 0 ? (nsvOs / Math.abs(nsvIn)) * 100 : 0

        return [
          getSegmentDisplayName(row.segment),
          ivIn.toFixed(2), ivOut.toFixed(2), (ivIn - ivOut).toFixed(2),
          gsvIn.toFixed(2), gsvOut.toFixed(2), (gsvIn - gsvOut).toFixed(2),
          nsvIn.toFixed(2), nsvOut.toFixed(2), nsvOs.toFixed(2), nsvOsPercent.toFixed(4),
          Number(row.tankBegin || 0).toFixed(2), Number(row.tankEnd || 0).toFixed(2), Number(row.tankChange || 0).toFixed(2),
          Number(row.lineFillBegin || 0).toFixed(2), Number(row.lineFillEnd || 0).toFixed(2), Number(row.lineFillChange || 0).toFixed(2),
          stationInput.toFixed(2), stationOutput.toFixed(2), stationOs.toFixed(2),
          row.butaneEnabled ? Number(row.butaneAdjustment?.butaneGsv || 0).toFixed(2) : '',
          row.butaneEnabled ? Number(row.butaneAdjustment?.blendPercent || 0).toFixed(4) : '',
          row.butaneEnabled ? Number(row.butaneAdjustment?.shrinkageAdjustmentBbl || 0).toFixed(2) : '',
        ]
      }),
    ]

    const stationRows = [
      ['Segment', 'Equation', 'Side A Input NSV', 'Side B Output NSV', 'Station O/S NSV', 'Station O/S %'],
      ...rows.flatMap((row: any) => (row.stationEquationRows || []).map((equation: any) => [
        getSegmentDisplayName(row.segment),
        equation.equation.name,
        Number(equation.sideA || 0).toFixed(2),
        Number(equation.sideB || 0).toFixed(2),
        Number(equation.difference || 0).toFixed(2),
        Number(equation.differencePercent || 0).toFixed(4),
      ])),
    ]

    const checkRows = [
      ['Segment', 'Check Group', 'Assigned Meter Total NSV', 'Check Meter Total NSV', 'Difference NSV', 'Difference %'],
      ...rows.flatMap((row: any) => (row.checkMeterRows || []).map((check: any) => [
        getSegmentDisplayName(row.segment),
        check.group.name,
        Number(check.inputTotal || 0).toFixed(2),
        Number(check.checkTotal || 0).toFixed(2),
        Number(check.difference || 0).toFixed(2),
        Number(check.differencePercent || 0).toFixed(4),
      ])),
    ]

    const butaneRows = [
      ['Segment', 'Butane GSV', 'Crude/Blend GSV', 'Blend %', 'Shrinkage Factor', 'Shrinkage BBLs', 'O/S After Shrinkage'],
      ...rows.filter((row: any) => row.butaneEnabled).map((row: any) => [
        getSegmentDisplayName(row.segment),
        Number(row.butaneAdjustment?.butaneGsv || 0).toFixed(2),
        Number(row.butaneAdjustment?.totalBlendGsv || row.butaneAdjustment?.crudeGsv || 0).toFixed(2),
        Number(row.butaneAdjustment?.blendPercent || 0).toFixed(4),
        Number(row.butaneAdjustment?.shrinkageFactor || 0).toFixed(6),
        Number(row.butaneAdjustment?.shrinkageAdjustmentBbl || 0).toFixed(2),
        Number(row.overShort || 0).toFixed(2),
      ]),
    ]

    const segmentSheets = rows.map((row: any) => {
      const segmentTickets = getSegmentApprovedTickets(row.segment.id)
        .sort((a: any, b: any) => String(getTicketDateForBalance(a)).localeCompare(String(getTicketDateForBalance(b))))

      return {
        name: getSegmentDisplayName(row.segment) || 'Segment',
        numericIndexes: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        rows: [
          [
            'Lease',
            'Ticket #',
            'Opening Meter Reading',
            'Closing Meter Reading',
            'Total Batch Barrels',
            'Avg Temp',
            'Avg Pressure',
            'S&W',
            'CTL',
            'CPL',
            'GSV',
            'NSV',
            'Meter #',
            'Date',
            'Role',
          ],
          ...segmentTickets.map((ticket: any) => {
            const lease = getTicketLease(ticket)
            const meter = getTicketMeter(ticket)
            return [
              lease?.lease_name || lease?.name || meter?.meter_name || meter?.meter_number || '',
              ticket.ticket_number || ticket.id,
              ticket.opening_reading ?? ticket.observed_inputs?.opening_reading ?? '',
              (ticket as any).closing_reading ?? ticket.observed_inputs?.closing_reading ?? '',
              getTicketIv(ticket).toFixed(2),
              Number(ticket.observed_inputs?.average_temperature ?? ticket.observed_temperature ?? ticket.avg_temp ?? 0).toFixed(2),
              Number(ticket.observed_inputs?.average_pressure ?? ticket.observed_pressure ?? ticket.avg_pressure ?? 0).toFixed(2),
              getTicketSw(ticket).toFixed(4),
              getTicketCtl(ticket).toFixed(6),
              getTicketCpl(ticket).toFixed(6),
              getTicketGsv(ticket).toFixed(2),
              getTicketNsv(ticket).toFixed(2),
              meter?.meter_number || '',
              getTicketDateForBalance(ticket),
              getMeterBalanceRole(ticket) || '',
            ]
          }),
        ],
      }
    })

    const photoRows = [
      ['Date', 'Lease', 'Meter', 'File', 'URL'],
      ...readingPhotos.slice(0, 250).map((photo: any) => {
        const lease = leases.find((l: any) => l.id === photo.lease_id)
        const meter = meters.find((m: any) => m.id === photo.meter_id)
        return [
          photo.created_at || '',
          lease?.lease_name || lease?.name || '',
          meter?.meter_number || '',
          photo.file_name || '',
          photo.public_url || '',
        ]
      }),
    ]

    downloadExcelXml(`measurement-closeout-${overShortStartDate || 'all'}-to-${overShortEndDate || 'all'}.xls`, [
      { name: 'Executive Summary', rows: summaryRows, numericIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
      { name: 'Station Balance', rows: stationRows, numericIndexes: [2, 3, 4, 5] },
      { name: 'Check Meter Groups', rows: checkRows, numericIndexes: [2, 3, 4, 5] },
      { name: 'Butane Shrinkage', rows: butaneRows, numericIndexes: [1, 2, 3, 4, 5, 6] },
      { name: 'Reading Photos', rows: photoRows },
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
      'Butane GSV',
      'Blend %',
      'Shrinkage Adjustment',
      'Check Meter O/S',
      'Book Inventory',
      'Actual Inventory',
      'Over Short',
      'Over Short Percent',
    ]

    const csvRows = rows.map((row: any) => [
      getSegmentDisplayName(row.segment),
      row.receipts.toFixed(2),
      row.deliveries.toFixed(2),
      row.truckTickets.toFixed(2),
      row.tankChange.toFixed(2),
      row.lineFillChange.toFixed(2),
      row.butaneEnabled ? row.butaneAdjustment.butaneGsv.toFixed(2) : '',
      row.butaneEnabled ? row.butaneAdjustment.blendPercent.toFixed(4) : '',
      row.butaneEnabled ? row.butaneAdjustment.shrinkageAdjustmentBbl.toFixed(2) : '',
      row.checkMeterOverShort.toFixed(2),
      row.bookInventory.toFixed(2),
      row.actualInventory.toFixed(2),
      row.overShort.toFixed(2),
      row.overShortPercent.toFixed(4),
    ])

    downloadCsv(`over-short-${overShortStartDate || 'all'}-to-${overShortEndDate || 'all'}.csv`, [header, ...csvRows])
  }

  function getSegmentInventoryRows() {
    return segments.map((segment: any) => {
      const segmentTickets = getScopedTickets().filter((ticket: any) => ticket.segment_id === segment.id && ticket.status === 'approved')
      const receiptVolume = segmentTickets
        .filter((ticket: any) => {
          const meter = meters.find((m: any) => m.id === ticket.meter_id)
          return ((meter as any)?.meter_role || (meter as any)?.meter_direction || (meter as any)?.direction) === 'receipt'
        })
        .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.nsv || ticket.calculation_results?.gsv || 0), 0)

      const deliveryVolume = segmentTickets
        .filter((ticket: any) => {
          const meter = meters.find((m: any) => m.id === ticket.meter_id)
          return ((meter as any)?.meter_role || (meter as any)?.meter_direction || (meter as any)?.direction) === 'delivery'
        })
        .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.nsv || ticket.calculation_results?.gsv || 0), 0)

      const tankMovement = segmentTickets
        .filter((ticket: any) => ticket.ticket_type === 'tank')
        .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.tank_nsv || ticket.calculation_results?.tank_movement_bbl || 0), 0)

      const truckVolume = segmentTickets
        .filter((ticket: any) => ticket.ticket_type === 'truck')
        .reduce((sum: number, ticket: any) => sum + Number(ticket.calculation_results?.nsv || 0), 0)

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


  function cancelEditCheckMeterGroup() {
    setEditingCheckGroupId('')
    setNewCheckGroupName('')
    setNewCheckGroupSegmentId('')
    setNewCheckGroupCheckMeterId('')
    setNewCheckGroupCheckMeterIds([])
    setNewCheckGroupInputMeterIds([])
    setCheckGroupMeterSearch('')
  }

  function startEditCheckMeterGroup(group: any) {
    const members = balanceCheckGroupMeters.filter((member: any) => String(member.check_group_id || member.group_id || '') === String(group.id))
    const checkIds = Array.from(new Set([
      group.check_meter_id,
      ...members.filter((member: any) => String(member.role || member.meter_role || '').toLowerCase() === 'check').map((member: any) => member.meter_id),
    ].filter(Boolean).map((id: any) => String(id))))
    const inputIds = Array.from(new Set(
      members
        .filter((member: any) => String(member.role || member.meter_role || 'input').toLowerCase() !== 'check')
        .map((member: any) => String(member.meter_id || ''))
        .filter(Boolean)
        .filter((meterId: string) => !checkIds.includes(meterId))
    ))

    setEditingCheckGroupId(group.id)
    setNewCheckGroupName(group.name || '')
    setNewCheckGroupSegmentId(group.segment_id || '')
    setNewCheckGroupCheckMeterId('')
    setNewCheckGroupCheckMeterIds(checkIds)
    setNewCheckGroupInputMeterIds(inputIds)
    setCheckGroupMeterSearch('')
    setAdminSection('checks')
  }

  function cancelEditBalanceEquation() {
    setEditingBalanceEquationId('')
    setNewBalanceEquationName('')
    setNewBalanceEquationSegmentId('')
    setNewEquationSideAMeterIds([])
    setNewEquationSideBMeterIds([])
    setNewEquationSideACheckGroupIds([])
    setNewEquationSideBCheckGroupIds([])
    setNewEquationIncludeTankChange(false)
    setNewEquationIncludeLineFillChange(false)
    setEquationMeterSearch('')
  }

  function startEditBalanceEquation(equation: any) {
    const items = balanceEquationItems.filter((item: any) => String(item.equation_id || '') === String(equation.id))
    setEditingBalanceEquationId(equation.id)
    setNewBalanceEquationName(equation.name || '')
    setNewBalanceEquationSegmentId(equation.segment_id || '')
    setNewEquationSideAMeterIds(items.filter((item: any) => String(item.side || '').toUpperCase() === 'A' && String(item.item_type || '').toLowerCase() === 'meter').map((item: any) => String(item.item_id)))
    setNewEquationSideBMeterIds(items.filter((item: any) => String(item.side || '').toUpperCase() === 'B' && String(item.item_type || '').toLowerCase() === 'meter').map((item: any) => String(item.item_id)))
    setNewEquationSideACheckGroupIds(items.filter((item: any) => String(item.side || '').toUpperCase() === 'A' && String(item.item_type || '').toLowerCase() === 'check_group').map((item: any) => String(item.item_id)))
    setNewEquationSideBCheckGroupIds(items.filter((item: any) => String(item.side || '').toUpperCase() === 'B' && String(item.item_type || '').toLowerCase() === 'check_group').map((item: any) => String(item.item_id)))
    setNewEquationIncludeTankChange(!!equation.include_tank_change)
    setNewEquationIncludeLineFillChange(!!equation.include_line_fill_change)
    setEquationMeterSearch('')
    setAdminSection('equations')
  }

  async function saveCheckMeterGroup() {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('Select a company first.')
      return
    }
    const checkMeterIds = Array.from(new Set([
      ...(newCheckGroupCheckMeterIds.length ? newCheckGroupCheckMeterIds : []),
      newCheckGroupCheckMeterId,
    ].filter(Boolean).map((id) => String(id))))

    if (!newCheckGroupName || !newCheckGroupSegmentId || checkMeterIds.length === 0) {
      alert('Enter group name, segment, and at least one output/check meter.')
      return
    }

    const inputMeterIds = newCheckGroupInputMeterIds.filter((meterId) => !checkMeterIds.includes(String(meterId)))

    const groupPayload = {
      company_id: activeCompanyID,
      name: newCheckGroupName,
      segment_id: newCheckGroupSegmentId,
      check_meter_id: checkMeterIds[0],
      active: true,
    }

    const groupResult = editingCheckGroupId
      ? await supabase.from('balance_check_groups').update(groupPayload).eq('id', editingCheckGroupId).select('*').single()
      : await supabase.from('balance_check_groups').insert(groupPayload).select('*').single()

    const groupRow = groupResult.data
    const groupError = groupResult.error

    if (groupError || !groupRow) {
      alert(`Could not ${editingCheckGroupId ? 'update' : 'create'} check meter group: ${groupError?.message || 'unknown error'}`)
      return
    }

    if (editingCheckGroupId) {
      const { error: deleteMembersError } = await supabase
        .from('balance_check_group_meters')
        .delete()
        .eq('check_group_id', editingCheckGroupId)

      if (deleteMembersError) {
        alert(`Check group updated, but old meter assignments could not be cleared: ${deleteMembersError.message}`)
        return
      }
    }

    const memberRows = [
      ...checkMeterIds.map((meterId) => ({ company_id: activeCompanyID, check_group_id: groupRow.id, meter_id: meterId, role: 'check', active: true })),
      ...inputMeterIds.map((meterId) => ({ company_id: activeCompanyID, check_group_id: groupRow.id, meter_id: meterId, role: 'input', active: true })),
    ]

    const { error: memberError } = await supabase.from('balance_check_group_meters').insert(memberRows)
    if (memberError) {
      alert(`Check group created, but meter assignment failed: ${memberError.message}`)
      return
    }

    cancelEditCheckMeterGroup()
    await loadAll()
  }

  async function saveBalanceEquation() {
    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId
    if (!activeCompanyID) {
      alert('Select a company first.')
      return
    }
    if (!newBalanceEquationName || !newBalanceEquationSegmentId) {
      alert('Enter equation name and segment.')
      return
    }

    const equationPayload = {
      company_id: activeCompanyID,
      segment_id: newBalanceEquationSegmentId,
      name: newBalanceEquationName,
      equation_type: 'side_a_minus_side_b',
      include_tank_change: newEquationIncludeTankChange,
      include_line_fill_change: newEquationIncludeLineFillChange,
      active: true,
    }

    const equationResult = editingBalanceEquationId
      ? await supabase.from('balance_equations').update(equationPayload).eq('id', editingBalanceEquationId).select('*').single()
      : await supabase.from('balance_equations').insert(equationPayload).select('*').single()

    const equationRow = equationResult.data
    const equationError = equationResult.error

    if (equationError || !equationRow) {
      alert(`Could not ${editingBalanceEquationId ? 'update' : 'create'} balance equation: ${equationError?.message || 'unknown error'}`)
      return
    }

    if (editingBalanceEquationId) {
      const { error: deleteItemsError } = await supabase
        .from('balance_equation_items')
        .delete()
        .eq('equation_id', editingBalanceEquationId)

      if (deleteItemsError) {
        alert(`Balance equation updated, but old equation items could not be cleared: ${deleteItemsError.message}`)
        return
      }
    }

    const memberRows = [
      ...newEquationSideAMeterIds.map((id) => ({ company_id: activeCompanyID, equation_id: equationRow.id, side: 'A', item_type: 'meter', item_id: id, value_mode: 'meter_volume', active: true })),
      ...newEquationSideBMeterIds.map((id) => ({ company_id: activeCompanyID, equation_id: equationRow.id, side: 'B', item_type: 'meter', item_id: id, value_mode: 'meter_volume', active: true })),
      ...newEquationSideACheckGroupIds.map((id) => ({ company_id: activeCompanyID, equation_id: equationRow.id, side: 'A', item_type: 'check_group', item_id: id, value_mode: 'check_total', active: true })),
      ...newEquationSideBCheckGroupIds.map((id) => ({ company_id: activeCompanyID, equation_id: equationRow.id, side: 'B', item_type: 'check_group', item_id: id, value_mode: 'check_total', active: true })),
    ]

    if (!memberRows.length && !newEquationIncludeTankChange && !newEquationIncludeLineFillChange) {
      alert('Choose at least one meter/check group, or include tank change/line fill change.')
      return
    }

    if (memberRows.length) {
      const { error: itemError } = await supabase.from('balance_equation_items').insert(memberRows)

      if (itemError) {
        // Some older Supabase builds of this app did not have every optional column
        // on balance_equation_items. If the full insert fails, retry with the core
        // columns only so the station balance actually saves.
        const fallbackRows = memberRows.map((row: any) => ({
          equation_id: row.equation_id,
          side: row.side,
          item_type: row.item_type,
          item_id: row.item_id,
          active: true,
        }))

        const { error: fallbackItemError } = await supabase
          .from('balance_equation_items')
          .insert(fallbackRows)

        if (fallbackItemError) {
          alert(`Station balance saved, but item assignment failed: ${fallbackItemError.message}`)
          return
        }
      }
    }

    alert(`Station balance ${editingBalanceEquationId ? 'updated' : 'saved'}.`)
    cancelEditBalanceEquation()
    await loadAll()
  }

  async function deleteBalanceEquation(equation: any) {
    if (!equation?.id) return
    const confirmed = window.confirm(`Delete station balance equation "${equation.name || 'Station Balance'}"?`)
    if (!confirmed) return

    const { error: itemError } = await supabase
      .from('balance_equation_items')
      .delete()
      .eq('equation_id', equation.id)

    if (itemError) {
      alert(`Could not delete equation items: ${itemError.message}`)
      return
    }

    const { error: equationError } = await supabase
      .from('balance_equations')
      .delete()
      .eq('id', equation.id)

    if (equationError) {
      alert(`Could not delete station equation: ${equationError.message}`)
      return
    }

    if (editingBalanceEquationId === equation.id) cancelEditBalanceEquation()
    await loadAll()
  }

  async function updateMeterMasterField(meterId: string, patch: any) {
    const { error } = await supabase.from('meters').update(patch).eq('id', meterId)
    if (error) {
      alert(`Could not update meter: ${error.message}`)
      return
    }
    setMeters((current: any[]) => current.map((meter: any) => String(meter.id) === String(meterId) ? { ...meter, ...patch } : meter))
  }

  async function importMetersCsv() {
    if (!meterCsvFile) {
      alert('Choose a CSV file first.')
      return
    }

    const activeCompanyID = userIsSuperAdmin && selectedAdminCompanyId ? selectedAdminCompanyId : companyId

    if (!activeCompanyID) {
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
        const meterDirection = row.meter_direction || row.direction || row.meter_role || row.meter_type || ''
        const meterRole = normalizeMeterRole(row.meter_role || row.meter_type || row.balance_role || meterDirection)
        const productType = row.product_type || row.product || row.commodity || ''
        const includeInOsRaw = String(row.include_in_os || row.include_in_over_short || 'true').trim().toLowerCase()
        const includeInOs = !['false', 'no', 'n', '0', 'exclude', 'excluded'].includes(includeInOsRaw)
        const checkGroupName = row.check_meter_group || row.check_group || ''
        const reportsToCheckMeter = row.reports_to_check_meter || row.check_meter || ''
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
              company_id: activeCompanyID,
              area_id: area?.id || existingMeter.area_id || null,
              segment_id: segment?.id || existingMeter.segment_id || null,
              producer_id: producer?.id || existingMeter.producer_id || null,
              lease_id: lease?.id || existingMeter.lease_id || null,
              active: true,
              direction: meterRole || meterDirection || existingMeter.direction || null,
              meter_role: meterRole || existingMeter.meter_role || null,
              product_type: productType || existingMeter.product_type || null,
              include_in_os: includeInOs,
              check_meter_group_name: checkGroupName || existingMeter.check_meter_group_name || null,
              reports_to_check_meter: reportsToCheckMeter || existingMeter.reports_to_check_meter || null,
              default_ticket_type: defaultTicketType || existingMeter.default_ticket_type || null,
              source_tank_id: sourceTank?.id || existingMeter.source_tank_id || null,
              destination_tank_id: destinationTank?.id || existingMeter.destination_tank_id || null,
              line_fill_id: lineFill?.id || existingMeter.line_fill_id || null,
            })
            .eq('id', existingMeter.id)
        } else {
          const { error } = await supabase.from('meters').insert({
            company_id: activeCompanyID,
            meter_number: meterNumber,
            area_id: area?.id || null,
            segment_id: segment?.id || null,
            producer_id: producer?.id || null,
            lease_id: lease?.id || null,
            active: true,
            direction: meterRole || meterDirection || null,
            meter_role: meterRole || null,
            product_type: productType || null,
            include_in_os: includeInOs,
            check_meter_group_name: checkGroupName || null,
            reports_to_check_meter: reportsToCheckMeter || null,
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
      const bswValue = getPotBswPercentValue(pot)
      const bsw = bswValue === null || bswValue === undefined ? '' : roundTo(bswValue, 4)
      const grav = (pot as any).observed_api_gravity ?? (pot as any).api_gravity ?? pot.gravity ?? ''
      const temp = pot.observed_temperature ?? pot.sample_temperature ?? pot.temp ?? ''
      const potMeter = meters.find((m: any) =>
        String(m.id || '') === String(pot.meter_id || pot.meterId || '') ||
        String(m.lease_id || '') === String(pot.lease_id || pot.leaseId || '')
      )
      const potMeterNumber =
        pot.meter_number ||
        pot.meterNumber ||
        pot.meter_name ||
        pot.meterName ||
        potMeter?.meter_number ||
        potMeter?.meter_name ||
        getPotExportNumber(pot, index)

      // Match uploaded GQ liquid import header structure exactly by column position.
      row[0] = potMeterNumber                           // Number / Meter Number
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

  async function loadHtml2PdfBundle() {
    if ((window as any).html2pdf) return (window as any).html2pdf

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-html2pdf="true"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('html2pdf failed to load')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
      script.async = true
      script.dataset.html2pdf = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load PDF generator. Check internet/CSP settings.'))
      document.head.appendChild(script)
    })

    if (!(window as any).html2pdf) throw new Error('PDF generator loaded but was not available.')
    return (window as any).html2pdf
  }

  function cleanTicketHtmlForPdfExport(html: string) {
    return String(html || '')
      .replace(/<button[^>]*class=["']pdf-back-button["'][\s\S]*?<\/button>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/@media print\s*{[\s\S]*?}/gi, '')
  }

  async function waitForPdfImages(root: HTMLElement) {
    const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
    await Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    }))
  }

  async function convertTicketHtmlToPdfBlob(html: string, fileBaseName: string) {
    const html2pdf = await loadHtml2PdfBundle()

    // html2canvas can render a blank page when the source element is far off-screen,
    // hidden, or fixed outside the viewport. Keep the clone in normal document flow,
    // visible, and only move the page down while the PDF is generated.
    const host = document.createElement('div')
    host.setAttribute('data-pdf-export-host', 'true')
    host.style.position = 'absolute'
    host.style.left = '0'
    host.style.top = `${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 200}px`
    host.style.width = '8.5in'
    host.style.minHeight = '11in'
    host.style.background = '#ffffff'
    host.style.color = '#111827'
    host.style.zIndex = '-1'
    host.style.pointerEvents = 'none'
    host.innerHTML = cleanTicketHtmlForPdfExport(html)

    const style = document.createElement('style')
    style.textContent = `
      [data-pdf-export-host="true"] .pdf-back-button { display: none !important; }
      [data-pdf-export-host="true"] body { background: #fff !important; }
      [data-pdf-export-host="true"] .page {
        width: 8.5in !important;
        min-height: 11in !important;
        margin: 0 !important;
        background: #fff !important;
        box-shadow: none !important;
      }
    `
    host.prepend(style)
    document.body.appendChild(host)

    try {
      await waitForPdfImages(host)
      await new Promise((resolve) => setTimeout(resolve, 150))

      const pageElement = (host.querySelector('.page') || host) as HTMLElement
      const options = {
        margin: 0,
        filename: `${fileBaseName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: pageElement.scrollWidth || 816,
          windowHeight: pageElement.scrollHeight || 1056,
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'portrait',
          compress: true,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
        },
      }

      const blob = await html2pdf().set(options).from(pageElement).outputPdf('blob')

      if (!blob || blob.size < 1000) {
        throw new Error('Generated PDF was empty. Try again after the page fully loads.')
      }

      return blob
    } finally {
      host.remove()
    }
  }

  async function exportProducerPdfBundle() {
    if (!reportStartDate || !reportEndDate) {
      alert('Select a report start date and end date.')
      return
    }

    const getTicketProducerId = (ticket: any) => {
      const observed = ticket?.observed_inputs || {}
      if (ticket.producer_id || ticket.producerId || observed.producer_id) {
        return ticket.producer_id || ticket.producerId || observed.producer_id
      }

      const lease = leases.find((l: any) => String(l.id || '') === String(ticket.lease_id || observed.lease_id || ''))
      if (lease?.producer_id) return lease.producer_id

      const meter = meters.find((m: any) => String(m.id || '') === String(ticket.meter_id || observed.meter_id || ''))
      if (meter?.producer_id) return meter.producer_id

      const meterLease = leases.find((l: any) => String(l.id || '') === String(meter?.lease_id || ''))
      return meterLease?.producer_id || ''
    }

    const ticketsToExport = getReportFilteredTickets('meter')
      .filter((ticket: any) => String(ticket.status || '').toLowerCase() === 'approved')
      .filter((ticket: any) => reportProducerId ? String(getTicketProducerId(ticket)) === String(reportProducerId) : true)

    if (ticketsToExport.length === 0) {
      alert('No approved meter tickets found for the selected report filters.')
      return
    }

    const zip = new JSZip()
    let addedTicketCount = 0

    const groupedByProducer: Record<string, any[]> = {}
    for (const ticket of ticketsToExport as any[]) {
      const producerId = String(getTicketProducerId(ticket) || 'unknown')
      if (!groupedByProducer[producerId]) groupedByProducer[producerId] = []
      groupedByProducer[producerId].push(ticket)
    }

    for (const [producerId, rows] of Object.entries(groupedByProducer)) {
      const producer = producers.find((p: any) => String(p.id || '') === String(producerId))
      const producerFolder = sanitizeFileName(producer?.name || 'Unknown Producer', 'producer')

      for (const ticket of rows as any[]) {
        const ticketLabel = ticket.ticket_number || ticket.ticket_no || ticket.id || `ticket-${addedTicketCount + 1}`
        const observed = ticket.observed_inputs || {}
        const meter = meters.find((m: any) => String(m.id || '') === String(ticket.meter_id || observed.meter_id || ''))
        const lease = leases.find((l: any) => String(l.id || '') === String(ticket.lease_id || observed.lease_id || meter?.lease_id || ''))
        const leaseName = lease?.lease_name || lease?.name || observed.lease_name || 'Lease'
        const closeDate = observed.close_date || (getTicketReportDate(ticket) ? new Date(getTicketReportDate(ticket)).toISOString().slice(0,10) : 'no-date')
        const safeLabel = sanitizeFileName(`${leaseName}_${closeDate}_${ticketLabel}`, 'ticket')

        // Producer bundle uses the real saved PDF from Supabase Storage.
        // If it is missing, create/save it once, then pull that saved PDF into the ZIP.
        const savedPdf = await ensureSavedTicketPdf(ticket)
        const pdfResponse = await fetch(savedPdf.url)
        if (!pdfResponse.ok) throw new Error(`Could not download saved PDF for ${ticket.ticket_number || ticket.id}`)
        const pdfBlob = await pdfResponse.blob()
        zip.file(`${producerFolder}/${safeLabel}.pdf`, pdfBlob)
        addedTicketCount += 1
      }
    }

    zip.file(
      'README.txt',
      `Producer Measurement Ticket PDF Bundle
PDF tickets exported: ${addedTicketCount}
Report filters:
Start: ${reportStartDate}
End: ${reportEndDate}
Producer: ${producers.find((p: any) => p.id === reportProducerId)?.name || 'All Producers'}
Segment: ${segments.find((s: any) => s.id === reportSegmentId)?.name || 'All Segments'}
`
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    const producer = producers.find((p: any) => p.id === reportProducerId)
    const producerName = producer?.name || 'all-producers'
    const fileName = `producer-ticket-bundle-${sanitizeFileName(producerName)}-${reportStartDate}-to-${reportEndDate}.zip`

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



  const dashboardOverShortRows = getOverShortRows()
  const dashboardBalanceRows = dashboardOverShortRows.filter((row: any) => !row.totalsOnly)
  const dashboardSystemOs = dashboardBalanceRows.reduce((sum: number, row: any) => sum + Number(row.overShort || 0), 0)
  const dashboardSystemBook = dashboardBalanceRows.reduce((sum: number, row: any) => sum + Number(row.bookInventory || 0), 0)
  const dashboardSystemOsPct = dashboardSystemBook ? (dashboardSystemOs / dashboardSystemBook) * 100 : 0
  const dashboardOpenTickets = getScopedTickets().filter((t: any) => !['approved', 'voided'].includes(String(t.status || 'draft').toLowerCase())).length
  const dashboardPendingProvings = getScopedProvings().filter((p: any) => String(p.status || '').toLowerCase() !== 'approved').length
  const dashboardPotsCompleted = getScopedPotQuality().filter((p: any) => {
    const status = String(p.status || 'completed').toLowerCase()
    return !['draft', 'pending', 'voided', 'rejected'].includes(status)
  }).length

  const mobileHomeModules = [
    { key: 'dashboard', label: 'Dashboard', description: 'Totals and quick status' },
    { key: 'tickets', label: 'Tickets', description: 'Create, open, approve tickets' },
    { key: 'readings', label: 'Readings', description: 'Operator readings' },
    { key: 'pot', label: 'POT', description: 'Quality and S&W' },
    { key: 'provings', label: 'Provings', description: 'Meter proving records' },
    { key: 'reports', label: 'Reports', description: 'Reports Center' },
    { key: 'system_health', label: 'System Health', description: 'Setup checks' },
    ...(canViewAdmin ? [{ key: 'admin', label: 'Admin', description: 'Company setup and imports' }] : []),
  ]

  function openMobileModule(moduleKey: string) {
    setPage(moduleKey)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  useEffect(() => {
    const defaultAreaId = getDefaultWorkflowAreaId()
    if (!defaultAreaId) return

    if (!selectedReadingArea) setSelectedReadingArea(defaultAreaId)
    if (!selectedPotArea) setSelectedPotArea(defaultAreaId)
    if (!selectedProvingArea) setSelectedProvingArea(defaultAreaId)
    if (!selectedTicketArea) setSelectedTicketArea(defaultAreaId)
  }, [areas.length, userAreaAccess.length, currentAuthUserId, Role])

  async function runSystemHealthCheck() {
    setSystemHealthRunning(true)

    const checks: any[] = []
    const addCheck = (name: string, ok: boolean, detail: string, severity: 'ok' | 'warning' | 'error' = ok ? 'ok' : 'error') => {
      checks.push({ name, ok, detail, severity })
    }

    const activeCompanyID =
      userIsSuperAdmin && selectedAdminCompanyId
        ? selectedAdminCompanyId
        : companyId

    try {
      addCheck('Company selected', !!activeCompanyID, activeCompanyID ? `Company ID: ${activeCompanyID}` : 'No company is selected.')

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

      const pendingTickets = getScopedTickets().filter((ticket: any) => !['approved', 'voided'].includes(String(ticket.status || 'draft').toLowerCase()))
      addCheck(
        'Pending ticket workflow',
        true,
        `${pendingTickets.length} draft/submitted ticket(s) pending.`,
        pendingTickets.length > 0 ? 'warning' : 'ok'
      )

      const approvedUnposted = getScopedTickets().filter((ticket: any) =>
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


  function getTicketDateValue(ticket: any) {
    const parts = getRowAccountingDateParts(ticket, ['approved_at', 'updated_at', 'created_at'])
    const date = makeLocalDateTime(parts.date, parts.time)
    return date ? date.toISOString() : (ticket.approved_at || ticket.updated_at || ticket.created_at || new Date().toISOString())
  }

  function getTicketMonthKey(ticket: any) {
    const parts = getRowAccountingDateParts(ticket, ['approved_at', 'updated_at', 'created_at'])
    return getAccountingMonthKey(parts.date, parts.time)
  }

  function getTicketMonthLabel(monthKey: string) {
    if (monthKey === 'Unknown') return 'Unknown Date'
    const [year, month] = monthKey.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }


  function getDraftWorkflowTickets() {
    return tickets
      .filter((ticket: any) => !['approved', 'voided'].includes(String(ticket.status || 'draft').toLowerCase()))
      .sort((a: any, b: any) => new Date(getTicketDateValue(b)).getTime() - new Date(getTicketDateValue(a)).getTime())
  }

  function getApprovedTickets() {
    return tickets
      .filter((ticket: any) => String(ticket.status || '').toLowerCase() === 'approved')
      .sort((a: any, b: any) => new Date(getTicketDateValue(b)).getTime() - new Date(getTicketDateValue(a)).getTime())
  }

  function toggleApprovedTicketMonth(monthKey: string) {
    setOpenApprovedTicketMonths((prev) => ({
      ...prev,
      [monthKey]: !(prev[monthKey] ?? true),
    }))
  }


  function getWorkflowGroupKey(ticket: any) {
    const status = String(ticket.status || 'draft').toLowerCase()
    if (status === 'submitted') return 'submitted'
    if (status === 'draft') return 'draft'
    return 'needs_review'
  }

  function getWorkflowGroupLabel(groupKey: string) {
    if (groupKey === 'submitted') return 'Submitted Tickets'
    if (groupKey === 'draft') return 'Draft Tickets'
    return 'Needs Review'
  }

  function groupWorkflowTickets(ticketList: any[]) {
    const order = ['submitted', 'draft', 'needs_review']
    const grouped = ticketList.reduce((acc: Record<string, any[]>, ticket: any) => {
      const key = getWorkflowGroupKey(ticket)
      if (!acc[key]) acc[key] = []
      acc[key].push(ticket)
      return acc
    }, {} as Record<string, any[]>)

    return (Object.entries(grouped) as [string, any[]][])
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([groupKey, groupTickets]) => ({
        groupKey,
        label: getWorkflowGroupLabel(groupKey),
        tickets: groupTickets.sort((a: any, b: any) =>
          new Date(getTicketDateValue(b)).getTime() - new Date(getTicketDateValue(a)).getTime()
        ),
      }))
  }

  function toggleWorkflowTicketGroup(groupKey: string) {
    setOpenWorkflowTicketGroups((prev) => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? true),
    }))
  }

  function groupTicketsByMonth(ticketList: any[]) {
    const grouped = ticketList.reduce((acc: Record<string, any[]>, ticket: any) => {
      const key = getTicketMonthKey(ticket)
      if (!acc[key]) acc[key] = []
      acc[key].push(ticket)
      return acc
    }, {} as Record<string, any[]>)

    return (Object.entries(grouped) as [string, any[]][])
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, monthTickets]) => ({
        monthKey,
        label: getTicketMonthLabel(monthKey),
        tickets: monthTickets.sort((a: any, b: any) =>
          new Date(getTicketDateValue(b)).getTime() - new Date(getTicketDateValue(a)).getTime()
        ),
      }))
  }


  function getTicketSegmentId(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    return String(ticket.segment_id || observed.segment_id || '')
  }

  function getTicketProducerId(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const meter = getMeterById(ticket?.meter_id || observed.meter_id || '')
    const lease = getLeaseById(ticket?.lease_id || observed.lease_id || meter?.lease_id || '')
    return String(ticket?.producer_id || observed.producer_id || (lease as any)?.producer_id || meter?.producer_id || '')
  }

  function getProducerLabelById(producerId: string) {
    const producer = producers.find((item: any) => String(item.id) === String(producerId || ''))
    return producer?.name || (producer as any)?.producer_name || 'Unassigned Producer'
  }

  function getProducersForSegment(segmentId: string) {
    if (!segmentId) return producers
    const producerIds = new Set(
      leases
        .filter((lease: any) => String(lease.segment_id || '') === String(segmentId))
        .map((lease: any) => String(lease.producer_id || ''))
        .filter(Boolean)
    )

    return producers.filter((producer: any) => producerIds.has(String(producer.id || '')))
  }

  function getTicketSegmentLabel(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const segmentId = getTicketSegmentId(ticket)
    const segment = segments.find((item: any) => String(item.id) === segmentId)
    return segment?.name || segment?.segment_name || observed.segment_name || 'Unassigned Segment'
  }

  function getTicketArchiveKind(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const type = String(ticket.ticket_type || observed.ticket_type || '').toLowerCase()
    if (type.includes('tank') || observed.tank_id || ticket.tank_id) return 'tank'
    if (type.includes('line') || observed.line_fill_id || ticket.line_fill_id) return 'line_fill'
    return 'meter'
  }

  function getTicketArchiveKindLabel(kind: string) {
    if (kind === 'tank') return 'Tank Tickets'
    if (kind === 'line_fill') return 'Line Fill Tickets'
    return 'Meter Tickets'
  }

  function getTicketArchiveKindOrder(kind: string) {
    if (kind === 'meter') return 1
    if (kind === 'tank') return 2
    if (kind === 'line_fill') return 3
    return 9
  }

  function getTicketArchiveSectionKey(...parts: string[]) {
    return parts.map((part) => String(part || 'unknown').replace(/\s+/g, '_')).join('__')
  }

  function toggleTicketArchiveSection(sectionKey: string) {
    setOpenTicketArchiveSections((prev) => ({
      ...prev,
      [sectionKey]: !(prev[sectionKey] ?? true),
    }))
  }

  function getTicketMonthOptions(ticketList: any[]) {
    const keys = Array.from(new Set(ticketList.map((ticket: any) => getTicketMonthKey(ticket))))
    return keys.sort((a, b) => b.localeCompare(a)).map((monthKey) => ({
      monthKey,
      label: getTicketMonthLabel(monthKey),
    }))
  }

  function groupTicketsByMonthSegmentKind(ticketList: any[]) {
    const monthGroups = groupTicketsByMonth(ticketList)
    return monthGroups.map((monthGroup: any) => {
      const segmentMap = monthGroup.tickets.reduce((acc: Record<string, any>, ticket: any) => {
        const segmentId = getTicketSegmentId(ticket) || 'unassigned'
        if (!acc[segmentId]) {
          acc[segmentId] = {
            segmentId,
            label: getTicketSegmentLabel(ticket),
            tickets: [],
          }
        }
        acc[segmentId].tickets.push(ticket)
        return acc
      }, {} as Record<string, any>)

      const segmentGroups = (Object.values(segmentMap) as any[])
        .sort((a: any, b: any) => a.label.localeCompare(b.label))
        .map((segmentGroup: any) => {
          const kindMap = segmentGroup.tickets.reduce((acc: Record<string, any>, ticket: any) => {
            const kind = getTicketArchiveKind(ticket)
            if (!acc[kind]) {
              acc[kind] = {
                kind,
                label: getTicketArchiveKindLabel(kind),
                tickets: [],
              }
            }
            acc[kind].tickets.push(ticket)
            return acc
          }, {} as Record<string, any>)

          const kindGroups = (Object.values(kindMap) as any[])
            .sort((a: any, b: any) => getTicketArchiveKindOrder(a.kind) - getTicketArchiveKindOrder(b.kind))
            .map((kindGroup: any) => ({
              ...kindGroup,
              tickets: kindGroup.tickets.sort((a: any, b: any) =>
                new Date(getTicketDateValue(b)).getTime() - new Date(getTicketDateValue(a)).getTime()
              ),
            }))

          return {
            ...segmentGroup,
            kindGroups,
          }
        })

      return {
        ...monthGroup,
        segmentGroups,
      }
    })
  }

  function renderTicketQueueCard(ticket: any, approved = false) {
    return (
      <div key={ticket.id} className="ticket-queue-card">
        <div>
          <strong className="ticket-title-tight">{getTicketLeaseDisplay(ticket)}</strong>
          {!approved && <span style={{ ...getTicketStatusStyle(ticket.status), marginLeft: 8 }}>{ticket.status || 'draft'}</span>}
          <div style={{ color: '#a8b3bd', marginTop: 4 }}>Ticket: {compactTicketTitle(ticket)} • {compactTicketSubtitle(ticket)}</div>
          <div style={{ color: '#a8b3bd', marginTop: 4 }}>{compactTicketVolume(ticket)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!approved && (ticket.status || 'draft') === 'draft' && (
            <button style={{ ...button, width: 130, background: '#f59e0b' }} onClick={() => startDraftTicketEdit(ticket)}>
              Edit Draft
            </button>
          )}
          {!approved && String(ticket.status || 'draft').toLowerCase() === 'draft' && (
            <button style={{ ...button, width: 130, background: '#7f1d1d', borderColor: '#991b1b' }} onClick={() => runSafeAction('Deleting draft ticket', () => deleteDraftTicket(ticket))}>
              Delete Draft
            </button>
          )}
          <button style={{ ...button, width: approved ? 170 : 130 }} onClick={() => { setSelectedTicket(ticket); setIsDraftTicketEditOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            {approved ? 'Open Approved Ticket' : 'Open Ticket'}
          </button>
        </div>
      </div>
    )
  }


  function getGenericMonthKey(row: any, dateFields: string[]) {
    const dateValue = dateFields.map((field) => row?.[field]).find(Boolean)
    if (!dateValue) return 'Unknown'
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return 'Unknown'
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function getGenericMonthLabel(monthKey: string) {
    if (monthKey === 'Unknown') return 'Unknown Date'
    const [year, month] = monthKey.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  function getReadingSegmentId(row: any) {
    const meter = getMeterById(row?.meter_id || row?.meterId || '')
    const lease = getLeaseById(row?.lease_id || row?.leaseId || meter?.lease_id || '')
    return String(row?.segment_id || (lease as any)?.segment_id || meter?.segment_id || '')
  }

  function getPotProducerId(row: any) {
    const meter = getMeterById(row?.meter_id || row?.meterId || '')
    const lease = getLeaseById(row?.lease_id || row?.leaseId || meter?.lease_id || '')
    return String(row?.producer_id || (lease as any)?.producer_id || meter?.producer_id || '')
  }

  function getProvingProducerId(row: any) {
    const meter = getMeterById(row?.meter_id || '')
    const lease = getLeaseById(row?.lease_id || meter?.lease_id || '')
    return String(row?.producer_id || (lease as any)?.producer_id || meter?.producer_id || '')
  }

  function getPotSegmentId(row: any) {
    const meter = getMeterById(row?.meter_id || row?.meterId || '')
    const lease = getLeaseById(row?.lease_id || row?.leaseId || meter?.lease_id || '')
    return String(row?.segment_id || (lease as any)?.segment_id || meter?.segment_id || '')
  }

  function getProvingSegmentId(row: any) {
    const meter = getMeterById(row?.meter_id || '')
    const lease = getLeaseById(row?.lease_id || meter?.lease_id || '')
    return String(row?.segment_id || (lease as any)?.segment_id || meter?.segment_id || '')
  }

  function getSegmentLabelById(segmentId: string) {
    const segment = segments.find((item: any) => String(item.id) === String(segmentId || ''))
    return segment?.name || segment?.segment_name || 'Unassigned Segment'
  }

  function getGenericMonthOptions(rows: any[], dateFields: string[]) {
    const keys = Array.from(new Set(rows.map((row: any) => getGenericMonthKey(row, dateFields))))
    return keys.sort((a, b) => b.localeCompare(a)).map((monthKey) => ({
      monthKey,
      label: getGenericMonthLabel(monthKey),
    }))
  }

  function groupRowsByMonthSegment(rows: any[], dateFields: string[], getSegmentId: (row: any) => string) {
    const monthMap = rows.reduce((acc: Record<string, any[]>, row: any) => {
      const monthKey = getGenericMonthKey(row, dateFields)
      if (!acc[monthKey]) acc[monthKey] = []
      acc[monthKey].push(row)
      return acc
    }, {} as Record<string, any[]>)

    return (Object.entries(monthMap) as [string, any[]][])
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, monthRows]) => {
        const segmentMap = monthRows.reduce((acc: Record<string, any[]>, row: any) => {
          const segmentId = getSegmentId(row) || 'unassigned'
          if (!acc[segmentId]) acc[segmentId] = []
          acc[segmentId].push(row)
          return acc
        }, {} as Record<string, any[]>)

        return {
          monthKey,
          label: getGenericMonthLabel(monthKey),
          rows: monthRows,
          segmentGroups: (Object.entries(segmentMap) as [string, any[]][])
            .sort(([a], [b]) => getSegmentLabelById(a).localeCompare(getSegmentLabelById(b)))
            .map(([segmentId, segmentRows]) => ({
              segmentId,
              label: getSegmentLabelById(segmentId),
              rows: segmentRows,
            })),
        }
      })
  }


  function renderProvingQueueCard(p: any, mode: 'draft' | 'pending' | 'approved') {
    const label = getProvingDisplayName(p)
    return (
      <div key={p.id} style={{ ...card, margin: 0 }}>
        <strong>{label.main}</strong>
        {label.secondary && <div style={{ color: '#a8b3bd' }}>{label.secondary}</div>}
        <div>Date: {p.proving_date}</div>
        <div>Status: {p.status}</div>
        <div>Type: {p.factor_type || 'MF'}</div>
        <div>Accepted {p.factor_type || 'MF'}: {Number(p.accepted_meter_factor || 0).toFixed(4)}</div>
        {p.factor_type === 'CMF' && <div>MF: {Number(p.mf || 0).toFixed(4)} × CPL: {Number(p.cpl || 1).toFixed(5)}</div>}
        <div>Witness: {p.witness || ''}</div>
        <div>PDF: {p.pdf_file_name || 'None'}</div>
        {p.approved_at && <div>Approved: {new Date(p.approved_at).toLocaleString()}</div>}
        {p.pdf_url && <button style={button} onClick={() => viewProvingPdf(p.pdf_url)}>View Proving PDF</button>}
        {!isReadOnly && mode === 'draft' && (
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <button type="button" style={{ ...button, marginTop: 0, background: '#d97706', border: '1px solid #f59e0b' }} onClick={() => editProving(p)}>Edit Proving</button>
            <button type="button" style={{ ...button, marginTop: 0, background: '#7f1d1d', border: '1px solid #ef4444' }} onClick={() => deleteDraftProving(p)}>Delete Proving</button>
          </div>
        )}
        {mode === 'draft' && <button style={button} onClick={() => approveProving(p)}>Submit / Approve Proving</button>}
        {mode === 'pending' && <button style={button} onClick={() => approveProving(p)}>Approve Proving</button>}
        {!isReadOnly && mode === 'approved' && (
          <button type="button" style={{ ...button, marginTop: 8, background: '#d97706', border: '1px solid #f59e0b' }} onClick={() => editProving(p)}>
            Edit Approved Proving
          </button>
        )}
      </div>
    )
  }

  function renderGroupedProvings(rows: any[], mode: 'draft' | 'pending' | 'approved') {
    const monthOptions = getGenericMonthOptions(rows, ['proving_date', 'approved_at', 'created_at'])
    const filteredRows = rows.filter((p: any) =>
      (!provingQueueMonthFilter || getGenericMonthKey(p, ['proving_date', 'approved_at', 'created_at']) === provingQueueMonthFilter) &&
      (!provingQueueSegmentFilter || getProvingSegmentId(p) === provingQueueSegmentFilter) &&
      (!provingQueueProducerFilter || getProvingProducerId(p) === provingQueueProducerFilter)
    )
    const grouped = groupRowsByMonthSegment(filteredRows, ['proving_date', 'approved_at', 'created_at'], getProvingSegmentId)

    return (
      <>
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <select style={input} value={provingQueueMonthFilter} onChange={(e) => setProvingQueueMonthFilter(e.target.value)}>
            <option value="">All Months</option>
            {monthOptions.map((month: any) => <option key={month.monthKey} value={month.monthKey}>{month.label}</option>)}
          </select>
          <select style={input} value={provingQueueSegmentFilter} onChange={(e) => { setProvingQueueSegmentFilter(e.target.value); setProvingQueueProducerFilter('') }}>
            <option value="">All Segments</option>
            {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
          </select>
          <select style={input} value={provingQueueProducerFilter} onChange={(e) => setProvingQueueProducerFilter(e.target.value)}>
            <option value="">{provingQueueSegmentFilter ? 'All Producers in Segment' : 'All Producers'}</option>
            {getProducersForSegment(provingQueueSegmentFilter).map((producer: any) => <option key={producer.id} value={producer.id}>{producer.name || (producer as any).producer_name}</option>)}
          </select>
        </div>

        {filteredRows.length === 0 && <div style={card}>No provings found for this filter.</div>}

        {grouped.map((monthGroup: any) => (
          <details key={monthGroup.monthKey} open style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 800, background: 'rgba(239,68,68,0.12)' }}>
              {monthGroup.label} • {monthGroup.rows.length} proving(s)
            </summary>
            <div style={{ display: 'grid', gap: 10, padding: 12 }}>
              {monthGroup.segmentGroups.map((segmentGroup: any) => (
                <details key={segmentGroup.segmentId} open style={{ ...card, margin: 0, background: 'rgba(15,23,42,0.45)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{segmentGroup.label} • {segmentGroup.rows.length} proving(s)</summary>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {segmentGroup.rows.map((p: any) => renderProvingQueueCard(p, mode))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </>
    )
  }

  function formatTicketDetailNumber(value: any, digits = 1) {
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  function formatFactorDetail(value: any, digits = 6) {
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return num.toFixed(digits)
  }


  function getTicketIvDetail(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    const calc = ticket?.calculation_results || {}

    const direct =
      calc.iv ??
      calc.indicated_volume ??
      calc.gov ??
      observed.iv ??
      observed.indicated_volume ??
      observed.total_batch_barrels ??
      observed.total_batch_bbls ??
      observed.gross_volume_bbl ??
      observed.gross_bbls ??
      ticket?.iv ??
      ticket?.indicated_volume ??
      ticket?.total_batch_barrels ??
      ticket?.gross_volume

    const directNum = Number(direct)
    if (Number.isFinite(directNum) && directNum !== 0) return directNum

    const opening = Number(observed.opening_reading ?? ticket?.opening_reading)
    const closing = Number(observed.closing_reading ?? ticket?.closing_reading)
    if (Number.isFinite(opening) && Number.isFinite(closing) && closing > opening) {
      return closing - opening
    }

    const gsv = Number(calc.gsv ?? observed.gsv ?? ticket?.gsv)
    const ctl = Number(calc.ctl ?? observed.ctl ?? ticket?.ctl)
    const cpl = Number(calc.cpl ?? observed.cpl ?? ticket?.cpl)
    const mf = Number(calc.mf ?? observed.mf ?? ticket?.mf ?? 1)
    const ccf = Number(calc.ccf ?? observed.ccf)
    const ctpl = Number(calc.ctpl ?? calc.ctlp ?? observed.ctpl ?? observed.ctlp)

    const factor =
      Number.isFinite(ctpl) && ctpl > 0 ? ctpl * mf :
      Number.isFinite(ccf) && ccf > 0 ? ccf * mf :
      Number.isFinite(ctl) && ctl > 0 && Number.isFinite(cpl) && cpl > 0 ? ctl * cpl * mf :
      0

    if (Number.isFinite(gsv) && gsv > 0 && Number.isFinite(factor) && factor > 0) {
      return gsv / factor
    }

    const nsv = Number(calc.nsv ?? observed.nsv ?? ticket?.nsv)
    const csw = Number(calc.csw ?? observed.csw ?? ticket?.csw)
    if (Number.isFinite(nsv) && nsv > 0 && Number.isFinite(csw) && csw > 0 && Number.isFinite(factor) && factor > 0) {
      return nsv / csw / factor
    }

    return undefined
  }

  function getTicketAssignedPotLabel(ticket: any) {
    return ticket?.observed_inputs?.assigned_pot_label || ticket?.assigned_pot_id || '—'
  }

  function getTicketContractName(ticket: any) {
    return ticket?.observed_inputs?.contract_name || ticket?.calculation_profile_snapshot?.contract_name || '—'
  }

  function getTicketApiVersionLabel(ticket: any) {
    const observed = ticket?.observed_inputs || {}
    return observed.api_version_label || getApiVersionLabel(observed.api_version || ticket?.api_version || '') || '—'
  }

  function compactTicketTitle(ticket: any) {
    return ticket.ticket_number || ticket.id || 'Ticket'
  }

  function compactTicketSubtitle(ticket: any) {
    const observed = ticket.observed_inputs || {}
    const transporter = ticket.transporter_name || observed.transporter_name || ticket.customer_name
    const type = ticket.ticket_type || 'ticket'
    const status = ticket.status || 'draft'
    return `${type} • ${status}${transporter ? ` • ${transporter}` : ''}`
  }

  function compactTicketVolume(ticket: any) {
    const calc = ticket.calculation_results || {}
    const observed = ticket.observed_inputs || {}
    const nsv = calc.nsv ?? observed.net_volume_bbl
    const gsv = calc.gsv ?? observed.gross_volume_bbl
    if (nsv !== undefined && nsv !== null) return `NSV: ${Number(nsv || 0).toFixed(2)}`
    if (gsv !== undefined && gsv !== null) return `GSV: ${Number(gsv || 0).toFixed(2)}`
    return ''
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
          .app-sidebar,
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

        .ticket-command-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          margin-bottom: 18px;
        }
        .ticket-kpi-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .ticket-kpi-card {
          background: linear-gradient(145deg, rgba(20,25,28,1), rgba(9,13,16,1));
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.22);
        }
        .ticket-workspace {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: start;
        }
        .ticket-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 18px 0;
        }
        .ticket-tab {
          border: 1px solid rgba(255,255,255,0.10);
          background: linear-gradient(145deg, rgba(20,25,28,0.95), rgba(9,13,16,0.95));
          color: #f8fafc;
          border-radius: 16px;
          padding: 14px 16px;
          cursor: pointer;
          font-weight: 800;
          text-align: center;
        }
        .ticket-tab.active {
          background: linear-gradient(145deg, #f05f63, #8f2e34);
          border-color: rgba(255,125,130,0.85);
          box-shadow: 0 12px 32px rgba(240,95,99,0.22);
        }
        .ticket-create-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .ticket-panel-sticky {
          position: sticky;
          top: 14px;
        }
        .ticket-action-bar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(5,11,18,0.62);
          border-radius: 14px;
          margin-top: 14px;
        }
        .ticket-queue-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.10);
          background: linear-gradient(145deg, rgba(15,20,23,1), rgba(8,12,15,1));
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 10px;
        }
        .ticket-title-tight {
          overflow-wrap: anywhere;
          line-height: 1.25;
        }
        .ticket-muted { color: #a8b3bd; }
        .ticket-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        @media (max-width: 900px) {
          .ticket-command-header { align-items: stretch; flex-direction: column; }
          .ticket-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ticket-workspace { grid-template-columns: 1fr; }
          .ticket-tabs { grid-template-columns: 1fr 1fr; }
          .ticket-create-grid { grid-template-columns: 1fr; }
          .ticket-panel-sticky { position: static; }
          .ticket-queue-card { grid-template-columns: 1fr; }
          .ticket-action-bar { position: sticky; top: 72px; z-index: 70; }
          .ticket-action-bar button { width: 100% !important; }
        }
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

        {['dashboard', 'admin', 'reports', 'readings', 'pot', 'pot_map', 'contracts', 'api_engine', 'provings', 'tickets'].filter((p) => p !== 'admin' || canViewAdmin).map((p) => (
          <button key={p} onClick={() => { setPage(p); setMobileNavOpen(false) }} style={button}>
            {p === 'pot_map' ? 'POT MAP' : p === 'contracts' ? 'CONTRACTS' : p === 'api_engine' ? 'API ENGINE' : p.toUpperCase()}
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
              ← Home
            </button>
            <div style={{ fontWeight: 900, textTransform: 'uppercase' }}>{page}</div>
          </div>
        )}

        {!mobileMenuOpen && (
          <>
        {page === 'dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
                <div style={{ color: '#a8b3bd', fontSize: 13 }}>Measurement closeout command center • {companySettings?.company_name || getCompanyDisplayName() || 'Measurement Database'}</div>
              </div>
              <button style={{ ...button, width: 'auto', padding: '10px 14px' }} onClick={() => setPage('reports')}>Open Reports Center</button>
            </div>

            <div style={{ ...box, background: `linear-gradient(135deg, ${accentRgba(0.24)}, rgba(15,23,42,0.96))`, border: `1px solid ${accentRgba(0.45)}` }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr repeat(4, 1fr)', gap: 12 }}>
                <div style={{ ...card, minHeight: 120 }}>
                  <div style={{ color: '#a8b3bd', fontSize: 13 }}>System Over / Short</div>
                  <div style={{ fontSize: 42, fontWeight: 950, color: Math.abs(dashboardSystemOs) > 0.01 ? '#fca5a5' : '#86efac' }}>{dashboardSystemOs.toFixed(2)}</div>
                  <div style={{ color: '#a8b3bd' }}>{dashboardSystemOsPct.toFixed(4)}% of book inventory</div>
                </div>
                <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Draft / Working</div><div style={{ fontSize: 34, fontWeight: 900 }}>{dashboardOpenTickets}</div></div>
                <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>POTs Completed</div><div style={{ fontSize: 34, fontWeight: 900 }}>{dashboardPotsCompleted}</div></div>
                <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Pending Provings</div><div style={{ fontSize: 34, fontWeight: 900 }}>{dashboardPendingProvings}</div></div>
                <div style={kpiCard}><div style={{ color: '#a8b3bd', fontSize: 13 }}>Proving Compliance</div><div style={{ fontSize: 34, fontWeight: 900 }}>{provingCompliance}%</div></div>
              </div>
            </div>

            <div style={box}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Segment Over / Short</h2>
                  <div style={{ color: '#a8b3bd', fontSize: 12 }}>Receipts, deliveries, inventory, check meters, and butane shrinkage by segment.</div>
                  <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4 }}>Period: {getCurrentOverShortRange().label}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" style={{ ...button, width: 'auto' }} onClick={() => setOverShortAccountingMonth(-1)}>Last Month</button>
                  <button type="button" style={{ ...button, width: 'auto' }} onClick={() => setOverShortAccountingMonth(0)}>This Month</button>
                  <button type="button" style={{ ...button, width: 'auto', background: '#374151' }} onClick={() => { setOverShortStartDate(''); setOverShortEndDate('') }}>Auto</button>
                  <input style={{ ...input, width: 155 }} type="date" value={overShortStartDate} onChange={(e) => setOverShortStartDate(e.target.value)} />
                  <input style={{ ...input, width: 155 }} type="date" value={overShortEndDate} onChange={(e) => setOverShortEndDate(e.target.value)} />
                </div>
              </div>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                {dashboardOverShortRows.map((row: any) => (
                  <div key={row.segment.id} style={{ ...card, borderLeft: `5px solid ${row.totalsOnly ? '#38bdf8' : Math.abs(row.overShort) > 0.01 ? '#f87171' : '#22c55e'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ fontSize: 18 }}>{row.segment.name}</strong>
                      {row.totalsOnly ? (
                        <span style={{ color: '#93c5fd', fontWeight: 900 }}>REPORTING ONLY</span>
                      ) : (
                        <span style={{ color: Math.abs(row.overShort) > 0.01 ? '#fca5a5' : '#86efac', fontWeight: 900 }}>{row.overShort.toFixed(2)}</span>
                      )}
                    </div>
                    {row.totalsOnly ? (
                      <>
                        <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 8 }}>Reported Total {row.reportedTotal.toFixed(2)}</div>
                        <div style={{ color: '#a8b3bd', fontSize: 12 }}>Receipts {row.receipts.toFixed(2)} • Deliveries {row.deliveries.toFixed(2)} • Trucks {row.truckTickets.toFixed(2)}</div>
                        <div style={{ color: '#93c5fd', fontSize: 12 }}>Reporting Only segment — excluded from System O/S</div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 8 }}>Book {row.bookInventory.toFixed(2)} • Actual {row.actualInventory.toFixed(2)}</div>
                        <div style={{ color: '#a8b3bd', fontSize: 12 }}>Receipts {row.receipts.toFixed(2)} • Deliveries {row.deliveries.toFixed(2)}</div>
                        {(row.stationEquationRows || []).slice(0, 2).map((equation: any) => (
                          <div key={equation.equation.id} style={{ color: Math.abs(equation.difference) > 0.01 ? '#fca5a5' : '#86efac', fontSize: 12, marginTop: 4 }}>
                            {equation.equation.name}: {Number(equation.difference || 0).toFixed(2)}
                          </div>
                        ))}
                      </>
                    )}
                    {row.butaneEnabled && <div style={{ color: '#fef3c7', fontSize: 12 }}>Butane Blend {row.butaneAdjustment.blendPercent.toFixed(4)}% • Shrink {row.butaneAdjustment.shrinkageAdjustmentBbl.toFixed(2)}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12 }}>
              <div style={box}>Areas<h2>{getScopedAreas().length}</h2></div>
              <div style={box}>Segments<h2>{getScopedSegments().length}</h2></div>
              <div style={box}>Leases<h2>{getScopedLeases().length}</h2></div>
              <div style={box}>Producers<h2>{producers.length}</h2></div>
              <div style={box}>Meters<h2>{getScopedMeters().length}</h2></div>
              <div style={box}>Readings<h2>{getScopedReadings().length}</h2></div>
              <div style={box}>Provings<h2>{getScopedProvings().length}</h2></div>
              <div style={box}>Tickets<h2>{getScopedTickets().length}</h2></div>
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
                  {getScopedPotQuality().map((pot: any) => (
                    <option key={pot.id} value={pot.id}>
                      {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {formatPotBswPercent(pot)}
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
                <div style={rolePill}>{Role}</div>
                <div style={{ fontSize: 12, color: '#a8b3bd', marginTop: 6 }}>
                  Company: {companyId || 'none'}
                </div>
              </div>
            </div>

            <div style={{
              ...box,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 16,
              border: `1px solid ${getCompanyAccentColor()}55`,
              background: 'linear-gradient(135deg, rgba(15,23,42,.98), rgba(2,6,23,.98))'
            }}>
              {[
                ['company', 'Company', 'Branding / company setup'],
                ['users', 'Users', 'Roles / active users'],
                ['contracts', 'Contracts', 'Lease API profiles'],
                ['hierarchy', 'Hierarchy', 'Areas / segments / leases'],
                ['meters', 'Meters', 'Meter roles / product types'],
                ['checks', 'Check Groups', 'Meter balancing groups'],
                ['equations', 'Station Equations', 'Side A / Side B balances'],
                ['imports', 'Imports', 'CSV / truck imports'],
                ['tanks', 'Tanks / Line Fill', 'Inventory assets / strapping'],
              ].map(([targetId, title, desc]) => (
                <button
                  key={targetId}
                  style={{
                    ...button,
                    textAlign: 'left',
                    minHeight: 72,
                    background: 'rgba(15, 23, 42, .92)',
                    border: '1px solid rgba(148,163,184,.22)'
                  }}
                  onClick={() => setAdminSection(targetId as any)}
                >
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
                  <div style={{ fontSize: 12, opacity: .72, marginTop: 4 }}>{desc}</div>
                </button>
              ))}
            </div>

            {userIsSuperAdmin && (
              <div id="admin-company" style={adminSection === 'company' ? box : { display: 'none' }}>
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

            <div id="admin-branding" style={adminSection === 'company' ? box : { display: 'none' }}>
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

            <div id="admin-users" style={adminSection === 'users' ? box : { display: 'none' }}>
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
                    <span>{showActiveUsers ? '▼' : '▶'} Active Users ({(allUserRoles.length ? allUserRoles : userRoles).length})</span>
                    <span>Manage</span>
                  </button>

                  {showActiveUsers && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {(allUserRoles.length ? allUserRoles : userRoles).filter((role: any) => userIsSuperAdmin || !role.company_id || role.company_id === companyId).map((role) => (
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

            <div id="admin-contracts" style={adminSection === 'contracts' ? box : { display: 'none' }}>
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
                          {profile.standard} / {(profile as any).calculation_method}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            
            {(userIsSuperAdmin || userIsCompanyAdmin) && (
              <div style={box}>
                <h2>Area Access Control</h2>
                <p style={{ color: '#a8b3bd' }}>
                  Choose which areas each field user can see. This filters Readings, POT, Provings, Tickets, Meters, and Reports by area.
                </p>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'start' }}>
                  <select style={input} value={selectedAccessUserId} onChange={(e) => beginEditAreaAccess(e.target.value)}>
                    <option value="">Select User</option>
                    {getAreaAccessUsers().map((u: any) => {
                      const accessUserId = u.user_id || u.id || u.profile_id
                      const accessLabel = u.email || u.full_name || u.name || `${u.role || 'user'} — ${accessUserId}`
                      return (
                        <option key={accessUserId} value={accessUserId}>
                          {accessLabel}
                        </option>
                      )
                    })}
                  </select>

                  <div style={{ ...card, display: 'grid', gap: 8 }}>
                    {areas.length === 0 && <div>No areas created yet.</div>}

                    {areas.map((area: any) => (
                      <label key={area.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedAccessAreaIds.includes(String(area.id))}
                          onChange={() => toggleAccessArea(String(area.id))}
                        />
                        <span>{area.area_name || area.name}</span>
                      </label>
                    ))}
                  </div>

                  <button style={button} onClick={() => runSafeAction('Saving area access', saveUserAreaAccess)}>
                    Save Access
                  </button>
                </div>
              </div>
            )}


            {(userIsSuperAdmin || userIsCompanyAdmin) && (
              <div style={box}>
                <h2>Hierarchy Cleanup</h2>
                <p style={{ color: '#a8b3bd' }}>
                  This controls strict dropdown filtering. Fix these links so Area only shows its own Segments, Segment only shows its own Leases, and Lease only shows its own Meters.
                </p>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'center' }}>
                  <select style={input} value={hierarchySegmentId} onChange={(e) => setHierarchySegmentId(e.target.value)}>
                    <option value="">Select Segment to assign area</option>
                    {segments.map((segment: any) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.segment_name || segment.name} {(segment as any).area_id ? '' : '(missing area)'}
                      </option>
                    ))}
                  </select>

                  <select style={input} value={hierarchyAreaId} onChange={(e) => setHierarchyAreaId(e.target.value)}>
                    <option value="">Assign to Area</option>
                    {areas.map((area: any) => (
                      <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                    ))}
                  </select>

                  <button style={button} onClick={() => runSafeAction('Saving segment area', saveSegmentAreaLink)}>
                    Save Segment → Area
                  </button>

                  <select style={input} value={hierarchyLeaseId} onChange={(e) => setHierarchyLeaseId(e.target.value)}>
                    <option value="">Select Lease to assign segment</option>
                    {leases.map((lease: any) => (
                      <option key={lease.id} value={lease.id}>
                        {lease.lease_name || lease.name || lease.lease_number} {(lease as any).segment_id ? '' : '(missing segment)'}
                      </option>
                    ))}
                  </select>

                  <select style={input} value={hierarchyLeaseSegmentId} onChange={(e) => setHierarchyLeaseSegmentId(e.target.value)}>
                    <option value="">Assign to Segment</option>
                    {segments.map((segment: any) => (
                      <option key={segment.id} value={segment.id}>{segment.segment_name || segment.name}</option>
                    ))}
                  </select>

                  <button style={button} onClick={() => runSafeAction('Saving lease segment', saveLeaseSegmentLink)}>
                    Save Lease → Segment
                  </button>

                  <select style={input} value={hierarchyMeterId} onChange={(e) => setHierarchyMeterId(e.target.value)}>
                    <option value="">Select Meter to assign lease</option>
                    {meters.map((meter: any) => (
                      <option key={meter.id} value={meter.id}>
                        {meter.meter_number || meter.meter_name} {(meter as any).lease_id ? '' : '(missing lease)'}
                      </option>
                    ))}
                  </select>

                  <select style={input} value={hierarchyMeterLeaseId} onChange={(e) => setHierarchyMeterLeaseId(e.target.value)}>
                    <option value="">Assign to Lease</option>
                    {leases.map((lease: any) => (
                      <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                    ))}
                  </select>

                  <button style={button} onClick={() => runSafeAction('Saving meter lease', saveMeterLeaseLink)}>
                    Save Meter → Lease
                  </button>
                </div>

                <div style={{ color: '#a8b3bd', marginTop: 12, fontSize: 13 }}>
                  Missing links: {segments.filter((s: any) => !s.area_id).length} segments without area • {leases.filter((l: any) => !l.segment_id).length} leases without segment • {meters.filter((m: any) => !m.lease_id).length} meters without lease
                </div>
              </div>
            )}

<div id="admin-setup-hub" style={(['hierarchy', 'meters', 'checks', 'equations', 'imports', 'tanks'] as any[]).includes(adminSection) ? box : { display: 'none' }}>
              <button
                style={sectionToggle}
                onClick={() => setShowCompanySetupHub(!showCompanySetupHub)}
              >
                <span>{showCompanySetupHub ? '▼' : '▶'} {adminSection === 'hierarchy' ? 'Hierarchy Setup' : adminSection === 'meters' ? 'Meter Master Roles' : adminSection === 'checks' ? 'Check Meter Groups' : adminSection === 'equations' ? 'Station / Balance Equations' : adminSection === 'imports' ? 'Imports' : 'Tanks / Line Fill'}</span>
                <span>Focused setup</span>
              </button>

              {showCompanySetupHub && (
                <div>
                  <p style={{ color: '#a8b3bd' }}>
                    Manage operational setup for this company.
                  </p>

                  <div style={adminGrid}>
                    <button style={adminSection === 'hierarchy' ? button : { display: 'none' }} onClick={() => setPage('areas')}>Manage Areas</button>
                    <button style={adminSection === 'hierarchy' ? button : { display: 'none' }} onClick={() => setPage('segments')}>Manage Segments</button>
                    <button style={adminSection === 'hierarchy' ? button : { display: 'none' }} onClick={() => setPage('leases')}>Manage Leases</button>
                    <button style={adminSection === 'hierarchy' ? button : { display: 'none' }} onClick={() => setPage('producers')}>Manage Producers</button>
                    <button style={adminSection === 'hierarchy' ? button : { display: 'none' }} onClick={() => setPage('meters')}>Manage Meters</button>
                    <div style={{ ...(adminSection === 'imports' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
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
                      <p style={{ color: '#a8b3bd', fontSize: 12 }}>
                        V3 headers also supported: meter_role, product_type, include_in_os, check_meter_group, reports_to_check_meter.
                      </p>
                    </div>

                    <div style={{ ...(adminSection === 'meters' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
                      <h3>Balance Center V3 - Meter Master Roles</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        Pick one meter, set its role/product, and save. This keeps the admin screen clean while readings and O/S still use Meter Master automatically.
                      </p>

                      {(() => {
                        const scopedMeters = getScopedMeters()
                        const filteredMeters = scopedMeters.filter((meter: any) => !meterMasterSegmentFilterId || String(meter.segment_id || '') === String(meterMasterSegmentFilterId))
                        const selectedMeter = scopedMeters.find((meter: any) => String(meter.id) === String(selectedMeterMasterId)) || filteredMeters[0]
                        const selectedSegment = selectedMeter ? segments.find((segment: any) => String(segment.id) === String(selectedMeter.segment_id)) : null
                        const selectedLease = selectedMeter ? leases.find((lease: any) => String(lease.id) === String(selectedMeter.lease_id)) : null

                        return (
                          <div style={{ display: 'grid', gap: 12 }}>
                            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                              <select
                                style={input}
                                value={meterMasterSegmentFilterId}
                                onChange={(e) => {
                                  setMeterMasterSegmentFilterId(e.target.value)
                                  setSelectedMeterMasterId('')
                                }}
                              >
                                <option value="">All Segments</option>
                                {segments.map((segment: any) => (
                                  <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name || 'Segment'}</option>
                                ))}
                              </select>

                              <select
                                style={input}
                                value={selectedMeter?.id || ''}
                                onChange={(e) => setSelectedMeterMasterId(e.target.value)}
                              >
                                <option value="">Select Meter</option>
                                {filteredMeters.map((meter: any) => (
                                  <option key={meter.id} value={meter.id}>{meter.meter_number || meter.meter_name || 'Meter'}</option>
                                ))}
                              </select>
                            </div>

                            {selectedMeter ? (
                              <div style={{ ...box, display: 'grid', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={{ fontWeight: 800 }}>{selectedMeter.meter_number || selectedMeter.meter_name}</div>
                                    <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                                      {selectedSegment?.name || selectedSegment?.segment_name || 'No segment'}{selectedLease ? ` • ${selectedLease.lease_name || selectedLease.name || 'Lease'}` : ''}
                                    </div>
                                  </div>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dce3ea' }}>
                                    <input
                                      type="checkbox"
                                      checked={meterIncludedInOS(selectedMeter)}
                                      onChange={(e) => updateMeterMasterField(selectedMeter.id, { include_in_os: e.target.checked })}
                                    />
                                    Include in O/S
                                  </label>
                                </div>

                                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                  <label style={{ display: 'grid', gap: 6 }}>
                                    <span style={{ color: '#a8b3bd', fontSize: 12 }}>Meter Role</span>
                                    <select
                                      style={input}
                                      value={getMeterConfiguredRole(selectedMeter)}
                                      onChange={(e) => updateMeterMasterField(selectedMeter.id, { meter_role: e.target.value, direction: e.target.value })}
                                    >
                                      <option value="">Select role</option>
                                      <option value="receipt">Receipt</option>
                                      <option value="delivery">Delivery</option>
                                      <option value="check_meter">Check Meter</option>
                                      <option value="butane">Butane Injection</option>
                                      <option value="refined">Refined Product</option>
                                      <option value="excluded">Excluded</option>
                                    </select>
                                  </label>

                                  <label style={{ display: 'grid', gap: 6 }}>
                                    <span style={{ color: '#a8b3bd', fontSize: 12 }}>Product Type</span>
                                    <select
                                      style={input}
                                      value={getMeterProductType(selectedMeter)}
                                      onChange={(e) => updateMeterMasterField(selectedMeter.id, { product_type: e.target.value })}
                                    >
                                      <option value="">Select product</option>
                                      <option value="crude">Crude Oil</option>
                                      <option value="butane">Butane</option>
                                      <option value="diesel">Diesel</option>
                                      <option value="gasoline">Gasoline</option>
                                      <option value="jet">Jet Fuel</option>
                                      <option value="manual">Manual Total</option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: '#a8b3bd' }}>No meters found for this scope.</div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div style={{ ...(adminSection === 'checks' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
                      <h3>{editingCheckGroupId ? 'Edit Check Meter Group' : 'Check Meter Groups'}</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        Group receipt/delivery meters and compare them to one or more output/check meters inside the same segment.
                      </p>
                      {editingCheckGroupId && <div style={{ color: '#fca5a5', marginBottom: 10 }}>Editing existing group. Save to replace the group setup, or cancel to leave it unchanged.</div>}
                      <input style={input} placeholder="Group Name" value={newCheckGroupName} onChange={(e) => setNewCheckGroupName(e.target.value)} />
                      <select style={input} value={newCheckGroupSegmentId} onChange={(e) => { setNewCheckGroupSegmentId(e.target.value); setNewCheckGroupCheckMeterId(''); setNewCheckGroupCheckMeterIds([]); setNewCheckGroupInputMeterIds([]); setCheckGroupMeterSearch('') }}>
                        <option value="">Select Segment</option>
                        {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
                      </select>
                      <div style={{ margin: '10px 0', color: '#a8b3bd' }}>Output / check meters</div>
                      <select style={input} value={newCheckGroupCheckMeterId} onChange={(e) => setNewCheckGroupCheckMeterId(e.target.value)} disabled={!newCheckGroupSegmentId}>
                        <option value="">Select output/check meter to add</option>
                        {meters.filter((meter: any) => String(meter.segment_id || '') === String(newCheckGroupSegmentId || '') && !newCheckGroupCheckMeterIds.includes(String(meter.id))).map((meter: any) => { const label = getMeterDisplayName(meter); return <option key={meter.id} value={meter.id}>{label.main}{label.secondary ? ` (${label.secondary})` : ''}</option> })}
                      </select>
                      <button
                        type="button"
                        style={{ ...button, width: 'auto', marginBottom: 10 }}
                        disabled={!newCheckGroupCheckMeterId}
                        onClick={() => {
                          if (!newCheckGroupCheckMeterId) return
                          setNewCheckGroupCheckMeterIds((current) => Array.from(new Set([...current, newCheckGroupCheckMeterId])))
                          setNewCheckGroupInputMeterIds((current) => current.filter((id) => String(id) !== String(newCheckGroupCheckMeterId)))
                          setNewCheckGroupCheckMeterId('')
                        }}
                      >
                        Add Output / Check Meter
                      </button>
                      {newCheckGroupCheckMeterIds.length > 0 && (
                        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                          {newCheckGroupCheckMeterIds.map((meterId) => {
                            const meter = meters.find((m: any) => String(m.id) === String(meterId))
                            const label = meter ? getMeterDisplayName(meter) : { main: meterId, secondary: '' }
                            return (
                              <div key={meterId} style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <span><strong>{label.main}</strong>{label.secondary ? <span style={{ color: '#a8b3bd' }}> • {label.secondary}</span> : null}</span>
                                <button type="button" style={{ ...button, width: 'auto', background: '#7f1d1d' }} onClick={() => setNewCheckGroupCheckMeterIds((current) => current.filter((id) => id !== meterId))}>Remove</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div style={{ margin: '10px 0', color: '#a8b3bd' }}>Input / receipt leases / meters</div>
                      <input style={input} placeholder="Search lease or meter..." value={checkGroupMeterSearch} onChange={(e) => setCheckGroupMeterSearch(e.target.value)} disabled={!newCheckGroupSegmentId} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                        {meters.filter((meter: any) => String(meter.segment_id || '') === String(newCheckGroupSegmentId || '') && !newCheckGroupCheckMeterIds.includes(String(meter.id)) && String(meter.id) !== String(newCheckGroupCheckMeterId || '') && meterMatchesSearch(meter, checkGroupMeterSearch)).map((meter: any) => (
                          <label key={meter.id} style={{ ...box, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={newCheckGroupInputMeterIds.includes(meter.id)}
                              onChange={(e) => setNewCheckGroupInputMeterIds((current) => e.target.checked ? [...current, meter.id] : current.filter((id) => id !== meter.id))}
                            />
                            <MeterChoiceLabel meter={meter} />
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button style={button} onClick={() => runSafeAction(editingCheckGroupId ? 'Updating check meter group' : 'Saving check meter group', saveCheckMeterGroup)}>
                          {editingCheckGroupId ? 'Update Check Meter Group' : 'Save Check Meter Group'}
                        </button>
                        {editingCheckGroupId && <button type="button" style={{ ...button, background: '#374151' }} onClick={cancelEditCheckMeterGroup}>Cancel Edit</button>}
                      </div>
                      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                        {balanceCheckGroups.map((group: any) => {
                          const segment = segments.find((s: any) => String(s.id) === String(group.segment_id))
                          const members = balanceCheckGroupMeters.filter((member: any) => String(member.check_group_id || member.group_id || '') === String(group.id))
                          const checkMeterIds = Array.from(new Set([
                            group.check_meter_id,
                            ...members.filter((member: any) => String(member.role || member.meter_role || '').toLowerCase() === 'check').map((member: any) => member.meter_id),
                          ].filter(Boolean).map((id: any) => String(id))))
                          const checkNames = checkMeterIds.map((meterId) => {
                            const meter = meters.find((m: any) => String(m.id) === String(meterId))
                            return meter ? getMeterDisplayName(meter).main : meterId
                          }).join(', ')
                          return (
                            <div key={group.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                              <span style={{ color: '#a8b3bd' }}>{group.name} • {segment?.name || 'Segment'} • Outputs/Checks: {checkNames || '—'}</span>
                              <button type="button" style={{ ...button, width: 'auto' }} onClick={() => startEditCheckMeterGroup(group)}>Edit</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ ...(adminSection === 'equations' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
                      <h3>{editingBalanceEquationId ? 'Edit Station / Balance Equation' : 'Station / Balance Equations'}</h3>
                      <p style={{ color: '#a8b3bd' }}>
                        Build equations like Side A = whole field / receipts and Side B = delivery meters. The app calculates Side A - Side B, with optional tank change and line fill change included.
                      </p>
                      {editingBalanceEquationId && <div style={{ color: '#fca5a5', marginBottom: 10 }}>Editing existing station balance. Save to replace the equation setup, or cancel to leave it unchanged.</div>}

                      <div style={{ ...box, marginBottom: 12 }}>
                        <h4 style={{ marginTop: 0 }}>Segment Type</h4>
                        <p style={{ color: '#a8b3bd', marginTop: 0 }}>
                          Use Custody Transfer for balanced segments. Use Reporting Only for systems where you only report totals and do not want the app showing an over/short.
                        </p>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {segments.map((segment: any) => (
                            <div key={segment.id} className="ticket-queue-card">
                              <div>
                                <strong>{segment.name || segment.segment_name}</strong>
                                <div style={{ color: '#a8b3bd', marginTop: 4 }}>
                                  Segment type: {getSegmentTypeLabel(segment.id)}
                                </div>
                              </div>
                              <select style={{ ...input, width: 240, marginTop: 0 }} value={getSegmentBalanceMode(segment.id)} onChange={(e) => runSafeAction('Saving segment type', () => saveSegmentBalanceMode(segment.id, e.target.value))}>
                                <option value="custody_transfer">Custody Transfer</option>
                                <option value="reporting_only">Reporting Only</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <input style={input} placeholder="Equation Name (example: BSRNG Station Outbound)" value={newBalanceEquationName} onChange={(e) => setNewBalanceEquationName(e.target.value)} />
                      <select style={input} value={newBalanceEquationSegmentId} onChange={(e) => { setNewBalanceEquationSegmentId(e.target.value); setNewEquationSideAMeterIds([]); setNewEquationSideBMeterIds([]); setNewEquationSideACheckGroupIds([]); setNewEquationSideBCheckGroupIds([]); setEquationMeterSearch('') }}>
                        <option value="">Select Segment</option>
                        {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
                      </select>
                      {newBalanceEquationSegmentId && (
                        <>
                        <input style={input} placeholder="Search lease or meter for equation..." value={equationMeterSearch} onChange={(e) => setEquationMeterSearch(e.target.value)} />
                        <div style={{ ...box, color: '#a8b3bd', fontSize: 12 }}>
                          Available meters in this segment: {getBalanceMetersForSegment(newBalanceEquationSegmentId).length} •
                          Side A selected: {newEquationSideAMeterIds.length + newEquationSideACheckGroupIds.length} •
                          Side B selected: {newEquationSideBMeterIds.length + newEquationSideBCheckGroupIds.length}
                          {(newEquationIncludeTankChange || newEquationIncludeLineFillChange) ? ` • Adjustments: ${newEquationIncludeTankChange ? 'Tank Change ' : ''}${newEquationIncludeLineFillChange ? 'Line Fill Change' : ''}` : ''}
                        </div>
                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div style={box}>
                            <strong>Side A Adders</strong>
                            <div style={{ color: '#a8b3bd', margin: '6px 0' }}>Meters</div>
                            {getBalanceMetersForSegment(newBalanceEquationSegmentId).filter((meter: any) => meterMatchesSearch(meter, equationMeterSearch)).map((meter: any) => (
                              <label key={`a-meter-${meter.id}`} style={{ ...box, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <input type="checkbox" checked={newEquationSideAMeterIds.includes(meter.id)} onChange={(e) => toggleStringSelection(setNewEquationSideAMeterIds, meter.id, e.target.checked)} /> <MeterChoiceLabel meter={meter} />
                              </label>
                            ))}
                            <div style={{ color: '#a8b3bd', margin: '8px 0 6px' }}>Check Groups (uses check meter total)</div>
                            {balanceCheckGroups.filter((group: any) => String(group.segment_id || '') === String(newBalanceEquationSegmentId)).map((group: any) => (
                              <label key={`a-group-${group.id}`} style={{ display: 'block', marginBottom: 6 }}>
                                <input type="checkbox" checked={newEquationSideACheckGroupIds.includes(group.id)} onChange={(e) => toggleStringSelection(setNewEquationSideACheckGroupIds, group.id, e.target.checked)} /> {group.name}
                              </label>
                            ))}
                            <label style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={newEquationIncludeTankChange} onChange={(e) => setNewEquationIncludeTankChange(e.target.checked)} /> Add tank change to Side A</label>
                            <label style={{ display: 'block', marginTop: 6 }}><input type="checkbox" checked={newEquationIncludeLineFillChange} onChange={(e) => setNewEquationIncludeLineFillChange(e.target.checked)} /> Add line fill change to Side A</label>
                          </div>
                          <div style={box}>
                            <strong>Side B Subtractors</strong>
                            <div style={{ color: '#a8b3bd', margin: '6px 0' }}>Meters</div>
                            {getBalanceMetersForSegment(newBalanceEquationSegmentId).filter((meter: any) => meterMatchesSearch(meter, equationMeterSearch)).map((meter: any) => (
                              <label key={`b-meter-${meter.id}`} style={{ ...box, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <input type="checkbox" checked={newEquationSideBMeterIds.includes(meter.id)} onChange={(e) => toggleStringSelection(setNewEquationSideBMeterIds, meter.id, e.target.checked)} /> <MeterChoiceLabel meter={meter} />
                              </label>
                            ))}
                            <div style={{ color: '#a8b3bd', margin: '8px 0 6px' }}>Check Groups (uses check meter total)</div>
                            {balanceCheckGroups.filter((group: any) => String(group.segment_id || '') === String(newBalanceEquationSegmentId)).map((group: any) => (
                              <label key={`b-group-${group.id}`} style={{ display: 'block', marginBottom: 6 }}>
                                <input type="checkbox" checked={newEquationSideBCheckGroupIds.includes(group.id)} onChange={(e) => toggleStringSelection(setNewEquationSideBCheckGroupIds, group.id, e.target.checked)} /> {group.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button style={button} onClick={() => runSafeAction(editingBalanceEquationId ? 'Updating balance equation' : 'Saving balance equation', saveBalanceEquation)}>
                          {editingBalanceEquationId ? 'Update Balance Equation' : 'Save Balance Equation'}
                        </button>
                        {editingBalanceEquationId && <button type="button" style={{ ...button, background: '#374151' }} onClick={cancelEditBalanceEquation}>Cancel Edit</button>}
                      </div>
                      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                        {balanceEquations.map((equation: any) => {
                          const segment = segments.find((s: any) => String(s.id) === String(equation.segment_id))
                          const items = balanceEquationItems.filter((item: any) => String(item.equation_id || '') === String(equation.id))
                          const sideACount = items.filter((item: any) => String(item.side || '').toUpperCase() === 'A').length
                          const sideBCount = items.filter((item: any) => String(item.side || '').toUpperCase() === 'B').length
                          const row = getOverShortRows().find((osRow: any) => String(osRow.segment.id || '') === String(equation.segment_id || ''))
                          const calcRow = row?.stationEquationRows?.find((eqRow: any) => String(eqRow.equation.id || '') === String(equation.id || ''))
                          return (
                            <div key={equation.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                              <span style={{ color: '#a8b3bd' }}>
                                {equation.name} • {segment?.name || 'Segment'} • A items: {sideACount} • B items: {sideBCount}
                                {segmentIsTotalsOnly(equation.segment_id) ? ' • Segment is Reporting Only' : calcRow ? ` • Current O/S: ${Number(calcRow.difference || 0).toFixed(2)}` : ' • No current calculation yet'}
                              </span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" style={{ ...button, width: 'auto' }} onClick={() => startEditBalanceEquation(equation)}>Edit</button>
                                <button type="button" style={{ ...button, width: 'auto', background: '#7f1d1d' }} onClick={() => runSafeAction('Deleting station equation', () => deleteBalanceEquation(equation))}>Delete</button>
                              </div>
                            </div>
                          )
                        })}
                        {balanceEquations.length === 0 && <div style={{ color: '#a8b3bd' }}>No station balance equations saved yet.</div>}
                      </div>
                    </div>

                    <div style={{ ...(adminSection === 'imports' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
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
                      {getScopedPotQuality().map((pot: any) => (
                        <option key={pot.id} value={pot.id}>
                          {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {formatPotBswPercent(pot)}
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
                        {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
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

                      <input style={input} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFlowxCsvFile(e.target.files?.[0] || null)} />

                      <button disabled={isActionRunning} style={button} onClick={() => runSafeAction('Importing transporter summary tickets', importFlowXTransporterSummaryTickets)}>
                        Import Transporter Summary Tickets
                      </button>
                    </div>

                    <div style={{ ...(adminSection === 'tanks' ? card : { display: 'none' }), gridColumn: '1 / -1' }}>
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
                        <h4>Edit Uploaded Tanks / Assign Segment</h4>
                        <p style={{ color: '#a8b3bd' }}>
                          Use this when a tank was created or imported but is not tied to the right segment. The tank ticket segment filter uses this assignment.
                        </p>

                        <select
                          style={input}
                          value={editingTankId}
                          onChange={(e) => {
                            const tank = tanks.find((item: any) => String(item.id) === e.target.value)
                            if (tank) startEditTankAsset(tank)
                            else cancelEditTankAsset()
                          }}
                        >
                          <option value="">Select Tank to Edit</option>
                          {tanks.map((tank: any) => {
                            const segment = segments.find((item: any) => String(item.id) === String(tank.segment_id || ''))
                            return (
                              <option key={tank.id} value={tank.id}>
                                {tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''} {segment ? `• ${segment.name || segment.segment_name}` : '• No Segment'}
                              </option>
                            )
                          })}
                        </select>

                        {editingTankId && (
                          <>
                            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <input style={input} placeholder="Tank Number" value={editingTankNumber} onChange={(e) => setEditingTankNumber(e.target.value)} />
                              <input style={input} placeholder="Tank Name" value={editingTankName} onChange={(e) => setEditingTankName(e.target.value)} />
                            </div>

                            <select style={input} value={editingTankSegmentId} onChange={(e) => setEditingTankSegmentId(e.target.value)}>
                              <option value="">No Segment / Unassigned</option>
                              {segments.map((segment: any) => (
                                <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                              ))}
                            </select>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button disabled={isActionRunning} style={{ ...button, width: 'auto' }} onClick={() => runSafeAction('Updating tank', updateTankAsset)}>
                                Save Tank Changes
                              </button>
                              <button type="button" style={{ ...button, width: 'auto', background: '#374151' }} onClick={cancelEditTankAsset}>
                                Cancel
                              </button>
                            </div>
                          </>
                        )}

                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                          {tanks.map((tank: any) => {
                            const segment = segments.find((item: any) => String(item.id) === String(tank.segment_id || ''))
                            return (
                              <div key={tank.id} className="ticket-queue-card">
                                <div>
                                  <strong>{tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}</strong>
                                  <div style={{ color: '#a8b3bd', marginTop: 4 }}>
                                    Segment: {segment?.name || segment?.segment_name || 'Unassigned'}
                                  </div>
                                </div>
                                <button type="button" style={{ ...button, width: 120 }} onClick={() => startEditTankAsset(tank)}>
                                  Edit
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div style={card}>
                        <h4>Upload True Tank Strapping Chart</h4>
                        <p style={{ color: '#a8b3bd' }}>
                          Upload the true cumulative strapping table only: ft, in, bbl. No PDF guessing and no increment sheets.
                        </p>
                        <select style={input} value={selectedStrappingTankId} onChange={(e) => setSelectedStrappingTankId(e.target.value)}>
                          <option value="">Select Tank</option>
                          {tanks.map((tank: any) => <option key={tank.id} value={tank.id}>{tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}</option>)}
                        </select>

                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <input style={input} placeholder="Strap / Leg Name (Low Leg, High Leg)" value={strappingLegType} onChange={(e) => setStrappingLegType(e.target.value)} />
                          <select style={input} value={strappingRoofMode} onChange={(e) => setStrappingRoofMode(e.target.value)}>
                            <option value="fra">FRA - roof built into table</option>
                            <option value="frc">FRC - roof not built into table</option>
                            <option value="none">No floating roof</option>
                          </select>
                          <input style={input} placeholder="Roof Weight LBS" value={strappingRoofWeightLbs} onChange={(e) => setStrappingRoofWeightLbs(e.target.value)} />
                          <input style={input} placeholder="Reference API from strap" value={strappingRoofReferenceApi} onChange={(e) => setStrappingRoofReferenceApi(e.target.value)} />
                          <input style={input} placeholder="Reference SG optional" value={strappingRoofReferenceSg} onChange={(e) => setStrappingRoofReferenceSg(e.target.value)} />
                          <input style={input} placeholder="Critical Gauge Decimal Feet optional" value={strappingRoofCriticalGauge} onChange={(e) => setStrappingRoofCriticalGauge(e.target.value)} />
                        </div>

                        <input style={input} type="file" accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setStrappingCsvFile(e.target.files?.[0] || null)} />
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
                {getScopedSegments().map((s: any) => <option key={s.id} value={s.id}>{s.segment_name || s.name}</option>)}
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
            <div style={{ ...box, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {[
                  ['new', 'New Reading', 'Enter meter reading'],
                  ['history', `Monthly History (${readings.length})`, 'Grouped by month'],
                  ['photos', 'Photos / Review', 'Lease photo history'],
                ].map(([key, label, sub]) => (
                  <button
                    key={key}
                    style={{
                      ...button,
                      borderRadius: 0,
                      background: readingTab === key ? 'linear-gradient(135deg,#ef4444,#7f1d1d)' : 'rgba(15,23,42,0.92)',
                      border: readingTab === key ? '1px solid #ef4444' : '1px solid #22303c',
                      boxShadow: readingTab === key ? '0 0 18px rgba(239,68,68,0.28)' : 'none',
                    }}
                    onClick={() => setReadingTab(key as any)}
                  >
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {readingTab === 'new' && (
              <div style={box}>
                <h3>New Operator Reading</h3>
                {!shouldHideAreaSelector() ? (
                  <select style={input} value={selectedReadingArea} onChange={(e) => handleReadingAreaSelect(e.target.value)}>
                    <option value="">Select Area</option>
                    {getVisibleAreas().map((area: any) => (
                      <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={card}>Area: <strong>{getVisibleAreas()[0]?.area_name || getVisibleAreas()[0]?.name || 'Assigned Area'}</strong></div>
                )}

                <select style={input} value={selectedReadingSegment} onChange={(e) => handleReadingSegmentSelect(e.target.value)} disabled={!selectedReadingArea}>
                  <option value="">{selectedReadingArea ? 'Select Segment' : 'Select area first'}</option>
                  {getVisibleSegments(selectedReadingArea).map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.segment_name || segment.name}</option>
                  ))}
                </select>

                <select style={input} value={selectedReadingLease} onChange={(e) => handleReadingLeaseSelect(e.target.value)} disabled={!selectedReadingSegment}>
                  <option value="">{selectedReadingSegment ? 'Select Lease' : 'Select segment first'}</option>
                  {getVisibleLeases(selectedReadingSegment).map((lease: any) => (
                    <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                  ))}
                </select>

                <select style={input} value={selectedReadingMeter} onChange={(e) => { setSelectedReadingMeter(e.target.value); autofillOpeningReadingForLease(selectedReadingLease, e.target.value) }} disabled={!selectedReadingLease}>
                  <option value="">{selectedReadingLease ? 'Select Meter' : 'Select lease first'}</option>
                  {getVisibleMeters(selectedReadingLease).map((meter: any) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.meter_number || meter.meter_name} {meter.meter_name && meter.meter_number ? `- ${meter.meter_name}` : ''}
                    </option>
                  ))}
                </select>

                {selectedReadingMeter && (
                  <div style={{ color: '#a8b3bd', fontSize: 13 }}>
                    Auto-selected meter: <strong>{getSelectedReadingMeterNumber()}</strong> • Movement from Meter Master: <strong>{getSelectedReadingMovementType() === 'receipt' ? 'Receipt / Inbound' : 'Delivery / Outbound'}</strong>
                  </div>
                )}
                <input style={input} placeholder="Opening Reading" value={readingOpen} onChange={(e) => setReadingOpen(e.target.value)} />
                <input style={input} placeholder="Closing Reading" value={readingClose} onChange={(e) => setReadingClose(e.target.value)} />
                <input style={input} placeholder="Average Temperature" value={readingAvgTemp} onChange={(e) => setReadingAvgTemp(e.target.value)} />
                <input style={input} placeholder="Average Pressure" value={readingAvgPressure} onChange={(e) => setReadingAvgPressure(e.target.value)} />
                <input style={input} placeholder="Fallback Meter Factor" value={readingMF} onChange={(e) => setReadingMF(e.target.value)} />

                <div style={{ ...card, border: '1px dashed rgba(148,163,184,0.35)' }}>
                  <strong>Meter / Flow Computer Photos</strong>
                  <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 4 }}>
                    Upload multiple photos for this lease. Use this for meter displays, flow computer totals, seals, or screen checks.
                  </div>
                  <input
                    style={{ ...input, marginTop: 10 }}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setReadingPhotoFiles(Array.from(e.target.files || []))}
                  />
                  {readingPhotoFiles.length > 0 && (
                    <div style={{ color: '#bbf7d0', fontSize: 12 }}>{readingPhotoFiles.length} photo(s) ready to upload with this reading.</div>
                  )}
                </div>

                {selectedReadingLease && getReadingPhotosForLease(selectedReadingLease).length > 0 && (
                  <div style={card}>
                    <strong>Recent Photos for Selected Lease</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 10 }}>
                      {getReadingPhotosForLease(selectedReadingLease).map((photo: any) => (
                        <a key={photo.id || photo.file_path} href={photo.public_url || '#'} target="_blank" rel="noreferrer" style={{ color: '#e5e7eb', textDecoration: 'none' }}>
                          <img src={photo.public_url} alt={photo.file_name || 'reading photo'} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)' }} />
                          <div style={{ fontSize: 11, color: '#a8b3bd', marginTop: 4 }}>{new Date(photo.created_at || Date.now()).toLocaleString()}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 15 }}>IV: {(Number(readingClose || 0) - Number(readingOpen || 0)).toFixed(2)}</div>
                <button style={button} onClick={saveReading} disabled={readingPhotoUploading}>
                  {readingPhotoUploading ? 'Saving Photos...' : editingReadingId ? 'Update Reading' : 'Save Reading'}
                </button>
                {editingReadingId && (
                  <button style={{ ...button, background: 'linear-gradient(135deg,#374151,#111827)' }} onClick={clearReadingForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            )}

            {readingTab === 'history' && (
              <div style={box}>
                {(() => {
                  const scopedReadings = getScopedReadings()
                  const monthOptions = getGenericMonthOptions(scopedReadings, ['reading_date', 'created_at'])
                  const filteredReadings = scopedReadings.filter((row: any) =>
                    (!readingQueueMonthFilter || getGenericMonthKey(row, ['reading_date', 'created_at']) === readingQueueMonthFilter) &&
                    (!readingQueueSegmentFilter || getReadingSegmentId(row) === readingQueueSegmentFilter)
                  )
                  const grouped = groupRowsByMonthSegment(filteredReadings, ['reading_date', 'created_at'], getReadingSegmentId)

                  return (
                    <>
                      <div className="ticket-section-title">
                        <div>
                          <h3 style={{ margin: 0 }}>Operator Readings History</h3>
                          <span className="ticket-muted">Month → Segment → reading records</span>
                        </div>
                      </div>

                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <select style={input} value={readingQueueMonthFilter} onChange={(e) => setReadingQueueMonthFilter(e.target.value)}>
                          <option value="">All Months</option>
                          {monthOptions.map((month: any) => <option key={month.monthKey} value={month.monthKey}>{month.label}</option>)}
                        </select>
                        <select style={input} value={readingQueueSegmentFilter} onChange={(e) => setReadingQueueSegmentFilter(e.target.value)}>
                          <option value="">All Segments</option>
                          {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
                        </select>
                      </div>

                      {filteredReadings.length === 0 && <div style={card}>No readings found for this filter.</div>}

                      {grouped.map((monthGroup: any) => (
                        <details key={monthGroup.monthKey} open style={{ ...card, padding: 0, overflow: 'hidden' }}>
                          <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 800, background: 'rgba(239,68,68,0.12)' }}>
                            {monthGroup.label} • {monthGroup.rows.length} reading(s)
                          </summary>
                          <div style={{ display: 'grid', gap: 10, padding: 12 }}>
                            {monthGroup.segmentGroups.map((segmentGroup: any) => (
                              <details key={segmentGroup.segmentId} open style={{ ...card, margin: 0, background: 'rgba(15,23,42,0.45)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
                                  {segmentGroup.label} • {segmentGroup.rows.length} reading(s)
                                </summary>
                                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                  {segmentGroup.rows.map((row: any) => {
                                    const display = getReadingDisplayName(row)
                                    const iv = Number(row.closing_reading ?? row.closing_meter_reading ?? row.close_reading ?? 0) - Number(row.opening_reading ?? row.opening_meter_reading ?? row.open_reading ?? 0)
                                    return (
                                      <div key={row.id} style={{ ...card, margin: 0 }}>
                                        <strong>{display.main}</strong>
                                        {display.secondary && <div style={{ color: '#a8b3bd' }}>{display.secondary}</div>}
                                        <div style={{ color: '#a8b3bd' }}>Date: {new Date(row.reading_date || row.created_at || Date.now()).toLocaleString()}</div>
                                        <div>Open: {row.opening_reading ?? row.opening_meter_reading ?? row.open_reading ?? '—'} • Close: {row.closing_reading ?? row.closing_meter_reading ?? row.close_reading ?? '—'} • IV: {Number.isFinite(iv) ? iv.toFixed(2) : '—'}</div>
                                        <div>Avg Temp: {row.avg_temp ?? row.average_temperature ?? '—'} • Avg Pressure: {row.avg_pressure ?? row.average_pressure ?? '—'}</div>
                                        {!isReadOnly && (
                                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                                            <button style={{ ...button, padding: '8px 12px', width: 'auto', background: 'linear-gradient(135deg,#f97316,#9a3412)' }} onClick={() => editOperatorReading(row)}>
                                              Edit Reading
                                            </button>
                                            <button style={{ ...button, padding: '8px 12px', width: 'auto', background: 'linear-gradient(135deg,#991b1b,#450a0a)' }} onClick={() => deleteOperatorReading(row)}>
                                              Delete Reading
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            ))}
                          </div>
                        </details>
                      ))}
                    </>
                  )
                })()}
              </div>
            )}

            {readingTab === 'photos' && (
              <div style={box}>
                {(() => {
                  const scopedReadings = getScopedReadings()
                  const monthOptions = getGenericMonthOptions(scopedReadings, ['reading_date', 'created_at'])
                  const filteredReadings = scopedReadings.filter((row: any) =>
                    (!readingQueueMonthFilter || getGenericMonthKey(row, ['reading_date', 'created_at']) === readingQueueMonthFilter) &&
                    (!readingQueueSegmentFilter || getReadingSegmentId(row) === readingQueueSegmentFilter)
                  )
                  const grouped = groupRowsByMonthSegment(filteredReadings, ['reading_date', 'created_at'], getReadingSegmentId)

                  return (
                    <>
                      <div className="ticket-section-title">
                        <div>
                          <h3 style={{ margin: 0 }}>Reading Photo Review</h3>
                          <span className="ticket-muted">Filter by month and segment, or select a lease for focused photo review.</span>
                        </div>
                      </div>

                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <select style={input} value={readingQueueMonthFilter} onChange={(e) => setReadingQueueMonthFilter(e.target.value)}>
                          <option value="">All Months</option>
                          {monthOptions.map((month: any) => <option key={month.monthKey} value={month.monthKey}>{month.label}</option>)}
                        </select>
                        <select style={input} value={readingQueueSegmentFilter} onChange={(e) => setReadingQueueSegmentFilter(e.target.value)}>
                          <option value="">All Segments</option>
                          {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
                        </select>
                      </div>

                      <div style={card}>
                        <strong>Focused Lease Photos</strong>
                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <select style={input} value={selectedReadingSegment} onChange={(e) => handleReadingSegmentSelect(e.target.value)}>
                            <option value="">Select Segment</option>
                            {getVisibleSegments(selectedReadingArea || getDefaultVisibleAreaId()).map((segment: any) => (
                              <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                            ))}
                          </select>
                          <select style={input} value={selectedReadingLease} onChange={(e) => handleReadingLeaseSelect(e.target.value)} disabled={!selectedReadingSegment}>
                            <option value="">{selectedReadingSegment ? 'Select Lease' : 'Select segment first'}</option>
                            {getVisibleLeases(selectedReadingSegment).map((lease: any) => (
                              <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                            ))}
                          </select>
                        </div>

                        {selectedReadingLease && getReadingPhotosForLease(selectedReadingLease).length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
                            {getReadingPhotosForLease(selectedReadingLease).map((photo: any) => (
                              <a key={photo.id || photo.file_path} href={photo.public_url || '#'} target="_blank" rel="noreferrer" style={{ color: '#e5e7eb', textDecoration: 'none' }}>
                                <img src={photo.public_url} alt={photo.file_name || 'reading photo'} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(148,163,184,0.25)' }} />
                                <div style={{ fontSize: 11, color: '#a8b3bd', marginTop: 4 }}>{new Date(photo.created_at || Date.now()).toLocaleString()}</div>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: '#a8b3bd', marginTop: 10 }}>No lease photo selection active or no photos saved for that lease.</div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {grouped.map((monthGroup: any) => (
                          <details key={monthGroup.monthKey} open style={{ ...card, padding: 0, overflow: 'hidden' }}>
                            <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 800, background: 'rgba(239,68,68,0.12)' }}>
                              {monthGroup.label} • {monthGroup.rows.length} reading(s)
                            </summary>
                            <div style={{ display: 'grid', gap: 10, padding: 12 }}>
                              {monthGroup.segmentGroups.map((segmentGroup: any) => (
                                <details key={segmentGroup.segmentId} open style={{ ...card, margin: 0, background: 'rgba(15,23,42,0.45)' }}>
                                  <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{segmentGroup.label} • {segmentGroup.rows.length} reading(s)</summary>
                                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                    {segmentGroup.rows.map((row: any) => {
                                      const display = getReadingDisplayName(row)
                                      const photos = getReadingPhotosForLease(row.lease_id || '')
                                      return (
                                        <div key={row.id} style={{ ...card, margin: 0 }}>
                                          <strong>{display.main}</strong>
                                          {display.secondary && <div style={{ color: '#a8b3bd' }}>{display.secondary}</div>}
                                          <div style={{ color: '#a8b3bd' }}>Date: {new Date(row.reading_date || row.created_at || Date.now()).toLocaleString()}</div>
                                          <div style={{ color: '#a8b3bd' }}>Lease photos saved: {photos.length}</div>
                                          {photos.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
                                              {photos.slice(0, 6).map((photo: any) => (
                                                <a key={photo.id || photo.file_path} href={photo.public_url || '#'} target="_blank" rel="noreferrer">
                                                  <img src={photo.public_url} alt={photo.file_name || 'reading photo'} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)' }} />
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {page === 'api_engine' && (
          <>
            <h1>API 11.1 Engine Tester</h1>

            <div style={box}>
              <h2>Correction Factor Test</h2>
              <p style={{ color: '#a8b3bd' }}>
                Test API version routing, CTL, CPL, CTPL, GSV, and NSV before applying contract profiles to tickets.
              </p>

              <div style={{ ...card, border: '1px solid rgba(245,158,11,0.45)', marginBottom: 12 }}>
                <strong>Important:</strong> This screen currently uses the app-owned API 11.1 framework placeholder.
                Plug in licensed/verified API MPMS Chapter 11.1 formulas or tables before custody-transfer reliance.
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <select style={input} value={apiTesterVersion} onChange={(e) => setApiTesterVersion(e.target.value)}>
                  <option value="api_11_1_2004">API 11.1 2004</option>
                  <option value="api_11_1_2007">API 11.1 2007</option>
                  <option value="api_11_1_2019">API 11.1 2019</option>
                  <option value="api_11_1_2021">API 11.1 2021</option>
                </select>

                <input style={input} placeholder="API Gravity" value={apiTesterGravity} onChange={(e) => setApiTesterGravity(e.target.value)} />
                <input style={input} placeholder="Observed Temp °F" value={apiTesterTemp} onChange={(e) => setApiTesterTemp(e.target.value)} />
                <input style={input} placeholder="Pressure" value={apiTesterPressure} onChange={(e) => setApiTesterPressure(e.target.value)} />
                <input style={input} placeholder="IV / Gross BBL" value={apiTesterIv} onChange={(e) => setApiTesterIv(e.target.value)} />
                <input style={input} placeholder="Meter Factor" value={apiTesterMf} onChange={(e) => setApiTesterMf(e.target.value)} />
                <input style={input} placeholder="BS&W %" value={apiTesterBsw} onChange={(e) => setApiTesterBsw(e.target.value)} />
              </div>
            </div>

            <div style={box}>
              <h2>Calculated Output</h2>
              {(() => {
                const result = getApiTesterResult()

                return (
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={card}><strong>API Version</strong><br />{result.api_version_label}</div>
                    <div style={card}><strong>CTL</strong><br />{Number(result.ctl || 0).toFixed(result.rounding_profile?.ctlDecimals ?? 6)}</div>
                    <div style={card}><strong>CPL</strong><br />{Number(result.cpl || 0).toFixed(result.rounding_profile?.cplDecimals ?? 6)}</div>
                    <div style={card}><strong>CTPL</strong><br />{Number(result.ctpl || 0).toFixed(result.rounding_profile?.ctplDecimals ?? 6)}</div>
                    <div style={card}><strong>CCF</strong><br />{Number(result.ccf || 0).toFixed(6)}</div>
                    <div style={card}><strong>CSW</strong><br />{Number(result.csw || 0).toFixed(6)}</div>
                    <div style={card}><strong>IV</strong><br />{Number(result.iv || 0).toFixed(1)}</div>
                    <div style={card}><strong>GSV</strong><br />{Number(result.gsv || 0).toFixed(result.rounding_profile?.gsvDecimals ?? 2)}</div>
                    <div style={card}><strong>NSV</strong><br />{Number(result.nsv || 0).toFixed(result.rounding_profile?.nsvDecimals ?? 2)}</div>
                    <div style={card}><strong>Formula</strong><br />{result.formula}</div>
                    <div style={card}><strong>Correction Path</strong><br />{result.uses_combined_correction_factor ? 'Combined CCF' : 'Separate CTL × CPL × MF'}</div>
                    <div style={card}><strong>Source</strong><br />{result.correction_source}</div>
                    <div style={card}><strong>Rounding Profile</strong><br />{result.rounding_profile?.label || '—'}</div>
                  </div>
                )
              })()}
            </div>

            <div style={box}>
              <h2>Audit Output</h2>
              <pre style={{ ...card, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                {JSON.stringify(getApiTesterResult().audit, null, 2)}
              </pre>
            </div>
          </>
        )}

        {page === 'contracts' && (
          <>
            <h1>Lease Contract Profiles</h1>
            <div style={box}>
              <h2>Create / Update Lease API Profile</h2>
              <p style={{ color: '#a8b3bd' }}>
                Select the lease from the same Area → Segment → Lease workflow used throughout the app. Producer auto-fills from the lease, then the selected API profile controls ticket calculation routing.
              </p>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <select
                  style={input}
                  value={contractAreaId}
                  onChange={(e) => {
                    setContractAreaId(e.target.value)
                    setContractSegmentId('')
                    setContractLeaseId('')
                  }}
                >
                  <option value="">Select Area</option>
                  {getVisibleAreas().map((area: any) => (
                    <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                  ))}
                </select>

                <select
                  style={input}
                  value={contractSegmentId}
                  disabled={!contractAreaId}
                  onChange={(e) => {
                    setContractSegmentId(e.target.value)
                    setContractLeaseId('')
                  }}
                >
                  <option value="">{contractAreaId ? 'Select Segment' : 'Select area first'}</option>
                  {contractSegments.map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                  ))}
                </select>

                <select
                  style={input}
                  value={contractLeaseId}
                  disabled={!contractSegmentId}
                  onChange={(e) => setContractLeaseId(e.target.value)}
                >
                  <option value="">{contractSegmentId ? 'Select Lease' : 'Select segment first'}</option>
                  {contractLeases.map((lease: any) => (
                    <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                  ))}
                </select>

                <div style={card}>
                  <strong>Producer:</strong> {selectedContractProducerRow?.name || 'Auto-fills after lease'}
                </div>
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 14 }}>
                <select style={input} value={contractProductGroup} onChange={(e) => setContractProductGroup(e.target.value)}>
                  <option value="crude">Crude Oil</option>
                  <option value="refined">Refined Product</option>
                  <option value="butane">Butane</option>
                </select>

                <select style={input} value={newContractMethod} onChange={(e) => setNewContractMethod(e.target.value)}>
                  <option value="chapter12_2021">Chapter 12 / 2021</option>
                  <option value="api_11_1">API 11.1</option>
                  <option value="flowx_summary">Flow-X Summary Volumes</option>
                  <option value="manual_total">Manual Total / Imported Volume</option>
                </select>

                <select style={input} value={newContractApiVersion} onChange={(e) => setNewContractApiVersion(e.target.value)}>
                  <option value="api_11_1_1980">Refined API 11.1 / 1980</option>
                  <option value="api_11_1_2004">API 11.1 / 2004</option>
                  <option value="api_11_1_2007">API 11.1 / 2007</option>
                  <option value="api_11_1_2019">API 11.1 / 2019</option>
                  <option value="api_11_1_2021">API 11.1 / 2021</option>
                  <option value="chapter12_2021">API Chapter 12 / 2021</option>
                  <option value="butane_api_2019">Butane API 2019 LPG Ticketing</option>
                  <option value="butane_mpms_12_3">Butane MPMS 12.3 Shrinkage O/S</option>
                </select>

                <select style={input} value={newContractCorrectionSource} onChange={(e) => setNewContractCorrectionSource(e.target.value)}>
                  <option value="app_calculated">CTL/CPL: App Calculated</option>
                  <option value="imported_or_pot">CTL/CPL: Imported/POT</option>
                </select>

                <input style={input} placeholder="Default MF / factor" value={newContractMf} onChange={(e) => setNewContractMf(e.target.value)} />
              </div>

              <button style={{ ...button, marginTop: 14 }} onClick={() => runSafeAction('Saving lease contract profile', saveContractProfile)}>
                Save Lease API Profile
              </button>
            </div>

            <div style={box}>
              <h2>Saved Lease Contract Profiles</h2>
              {contractProfiles.length === 0 && <div style={card}>No lease contract profiles saved yet.</div>}
              <div style={{ display: 'grid', gap: 10 }}>
                {contractProfiles.map((profile: any) => {
                  const profileLease: any = asArray(leases).find((lease: any) => String(lease.id || '') === String(profile.lease_id || ''))
                  const profileSegment: any = asArray(segments).find((segment: any) => String(segment.id || '') === String(profile.segment_id || profileLease?.segment_id || ''))
                  const profileArea: any = asArray(areas).find((area: any) => String(area.id || '') === String(profile.area_id || profileLease?.area_id || ''))
                  const profileProducer: any = asArray(producers).find((producer: any) => String(producer.id || '') === String(profile.producer_id || profileLease?.producer_id || ''))

                  return (
                    <div key={profile.id} style={{ ...card, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                      <div>
                        <strong>{profileLease?.lease_name || profileLease?.name || profile.contract_name || profile.name}</strong>
                        <div style={{ color: '#a8b3bd', marginTop: 4 }}>
                          {profileArea?.name || 'Area —'} • {profileSegment?.name || profileSegment?.segment_name || 'Segment —'} • Producer: {profileProducer?.name || profile.transporter_name || '—'}
                        </div>
                        <div style={{ color: '#a8b3bd', marginTop: 4 }}>
                          Product: {profile.product_group || 'crude'} • Method: {profile.calculation_method || 'chapter12_2021'} • API: {profile.standard || getApiVersionLabel(profile.api_version || '') || profile.api_version || '—'} • CTL/CPL: {profile.correction_source || 'app_calculated'} • Factor: {profile.meter_factor || 1}
                        </div>
                      </div>
                      <button style={{ ...button, background: '#dc2626', width: 120 }} onClick={() => deleteContractProfile(profile.id)}>Delete</button>
                    </div>
                  )
                })}
              </div>
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
                  {getScopedPotQuality().map((pot: any) => (
                    <option key={pot.id} value={pot.id}>
                      {((pot as any).pot_number || (pot as any).sample_id || pot.id)} | API {(pot as any).api_gravity || (pot as any).observed_api_gravity || ''} | BSW {formatPotBswPercent(pot)}
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
            <div style={{ ...box, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {[
                  ['create', 'Create POT', 'New quality record'],
                  ['history', `Monthly History (${potQuality.length})`, 'Grouped by month'],
                  ['export', 'Monthly Export', 'POT workings CSV'],
                ].map(([key, label, sub]) => (
                  <button
                    key={key}
                    style={{
                      ...button,
                      borderRadius: 0,
                      background: potTab === key ? 'linear-gradient(135deg,#ef4444,#7f1d1d)' : 'rgba(15,23,42,0.92)',
                      border: potTab === key ? '1px solid #ef4444' : '1px solid #22303c',
                      boxShadow: potTab === key ? '0 0 18px rgba(239,68,68,0.28)' : 'none',
                    }}
                    onClick={() => setPotTab(key as any)}
                  >
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {potTab === 'export' && (
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
            )}

            {potTab === 'create' && (
              <div style={box}>
                <h3>{editingPotId ? 'Edit POT Quality' : 'New POT Quality'}</h3>
                {!shouldHideAreaSelector() ? (
                  <select style={input} value={selectedPotArea} onChange={(e) => handlePotAreaSelect(e.target.value)}>
                    <option value="">Select Area</option>
                    {getVisibleAreas().map((area: any) => (
                      <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={card}>Area: <strong>{getVisibleAreas()[0]?.area_name || getVisibleAreas()[0]?.name || 'Assigned Area'}</strong></div>
                )}

                <select style={input} value={selectedPotSegment} onChange={(e) => handlePotSegmentSelect(e.target.value)} disabled={!effectivePotAreaId}>
                  <option value="">{effectivePotAreaId ? 'Select Segment' : 'Select area first'}</option>
                  {getVisibleSegments(effectivePotAreaId).map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.segment_name || segment.name}</option>
                  ))}
                </select>

                <select style={input} value={selectedPotLease} onChange={(e) => handlePotLeaseSelect(e.target.value)} disabled={!selectedPotSegment}>
                  <option value="">{selectedPotSegment ? 'Select Lease' : 'Select segment first'}</option>
                  {filteredPotLeases.map((lease: any) => (
                    <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                  ))}
                </select>

                <div style={card}>
                  Meter Number: <strong>{selectedPotMeterRow?.meter_number || selectedPotMeterRow?.meter_name || (selectedPotLease ? 'No meter linked' : 'Select lease first')}</strong>
                </div>
                <label style={{ display: 'block', marginTop: 10 }}>
                  <div style={{ color: '#cbd5e1', fontWeight: 700, marginBottom: 6 }}>Sample Date</div>
                  <input
                    style={{ ...input, marginTop: 0, display: 'block', textAlign: 'left' }}
                    type="date"
                    aria-label="Sample Date"
                    value={potDate}
                    onChange={(e) => setPotDate(e.target.value)}
                  />
                </label>
                <input style={input} placeholder="Observed API Gravity" value={potGravity} onChange={(e) => setPotGravity(e.target.value)} />
                <input style={input} placeholder="Observed Temperature" value={potTemp} onChange={(e) => setPotTemp(e.target.value)} />
                <input style={input} placeholder="RVP" value={potRvp} onChange={(e) => setPotRvp(e.target.value)} />
                <input style={input} placeholder="Sulphur %" value={potSulfur} onChange={(e) => setPotSulfur(e.target.value)} />
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

                <div style={card}>
                  <strong>Shakeout Photo</strong>
                  <p style={{ color: '#a8b3bd', marginTop: 6 }}>
                    Add a picture of the BS&W shakeout. You can take a photo from the tablet/phone camera or upload an image.
                  </p>
                  <input
                    style={input}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => setPotShakeoutPhotoFiles(Array.from(e.target.files || []))}
                  />
                  {potShakeoutPhotoFiles.length > 0 && (
                    <div style={{ color: '#86efac', marginTop: 8 }}>
                      {potShakeoutPhotoFiles.length} shakeout photo(s) ready to save.
                    </div>
                  )}
                  {editingPotId && getPotPhotosForPot(editingPotId).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
                      {getPotPhotosForPot(editingPotId).map((photo: any) => (
                        <a key={photo.id || photo.file_path} href={photo.public_url || '#'} target="_blank" rel="noreferrer">
                          <img src={photo.public_url} alt={photo.file_name || 'shakeout photo'} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div style={card}>CSW: {(1 - Number(potBSW || 0) / 100).toFixed(6)}</div>
                <button style={button} onClick={savePotQuality} disabled={potPhotoUploading}>{potPhotoUploading ? 'Saving Shakeout Photo...' : editingPotId ? 'Update POT Quality' : 'Save POT Quality'}</button>
                {editingPotId && (
                  <button type="button" style={{ ...button, background: '#334155', border: '1px solid #475569' }} onClick={clearPotForm}>Cancel Edit / Clear Form</button>
                )}
              </div>
            )}

            {potTab === 'history' && (
              <div style={box}>
                {(() => {
                  const monthOptions = getGenericMonthOptions(potQuality, ['sample_date', 'created_at'])
                  const filteredPots = potQuality.filter((p: any) =>
                    (!potQueueMonthFilter || getGenericMonthKey(p, ['sample_date', 'created_at']) === potQueueMonthFilter) &&
                    (!potQueueSegmentFilter || getPotSegmentId(p) === potQueueSegmentFilter) &&
                    (!potQueueProducerFilter || getPotProducerId(p) === potQueueProducerFilter)
                  )
                  const grouped = groupRowsByMonthSegment(filteredPots, ['sample_date', 'created_at'], getPotSegmentId)

                  return (
                    <>
                      <div className="ticket-section-title">
                        <div>
                          <h3 style={{ margin: 0 }}>POT Quality History</h3>
                          <span className="ticket-muted">Month → Segment → POT records</span>
                        </div>
                      </div>

                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <select style={input} value={potQueueMonthFilter} onChange={(e) => setPotQueueMonthFilter(e.target.value)}>
                          <option value="">All Months</option>
                          {monthOptions.map((month: any) => <option key={month.monthKey} value={month.monthKey}>{month.label}</option>)}
                        </select>
                        <select style={input} value={potQueueSegmentFilter} onChange={(e) => { setPotQueueSegmentFilter(e.target.value); setPotQueueProducerFilter('') }}>
                          <option value="">All Segments</option>
                          {segments.map((segment: any) => <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>)}
                        </select>
                        <select style={input} value={potQueueProducerFilter} onChange={(e) => setPotQueueProducerFilter(e.target.value)}>
                          <option value="">{potQueueSegmentFilter ? 'All Producers in Segment' : 'All Producers'}</option>
                          {getProducersForSegment(potQueueSegmentFilter).map((producer: any) => <option key={producer.id} value={producer.id}>{producer.name || (producer as any).producer_name}</option>)}
                        </select>
                      </div>

                      {filteredPots.length === 0 && <div style={card}>No POT quality records found for this filter.</div>}

                      {grouped.map((monthGroup: any) => (
                        <details key={monthGroup.monthKey} open style={{ ...card, padding: 0, overflow: 'hidden' }}>
                          <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 800, background: 'rgba(239,68,68,0.12)' }}>
                            {monthGroup.label} • {monthGroup.rows.length} POT record(s)
                          </summary>
                          <div style={{ display: 'grid', gap: 10, padding: 12 }}>
                            {monthGroup.segmentGroups.map((segmentGroup: any) => (
                              <details key={segmentGroup.segmentId} open style={{ ...card, margin: 0, background: 'rgba(15,23,42,0.45)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{segmentGroup.label} • {segmentGroup.rows.length} POT record(s)</summary>
                                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                  {segmentGroup.rows.map((p: any) => {
                                    const potMeter = getMeterById(p?.meter_id || p?.meterId || '')
                                    const potLease = getLeaseById(p?.lease_id || p?.leaseId || potMeter?.lease_id || '')
                                    const prod = producers.find((x: any) => String(x.id) === String(p.producer_id || (potLease as any)?.producer_id || ''))
                                    const display = getPotDisplayName(p)
                                    return (
                                      <div key={p.id} style={{ ...card, margin: 0 }}>
                                        <strong>{display.main}</strong>
                                        {display.secondary && <div style={{ color: '#a8b3bd' }}>{display.secondary}</div>}
                                        <div>Producer: {prod?.name || p.producer_name || '—'}</div>
                                        <div>Date: {p.sample_date || '—'}</div>
                                        <div>Observed API Gravity: {p.observed_api_gravity ?? p.api_gravity}</div>
                                        <div>Observed Temp: {p.observed_temperature ?? p.sample_temperature}</div>
                                        <div>API Gravity @60: {p.api_gravity_60 ?? p.api_gravity}</div>
                                        <div>BS&W: {formatPotBswPercent(p)}</div>
                                        <div>CSW: {p.csw}</div>
                                        <div>RVP: {((p as any).rvp ?? parsePotExtra(p.notes, 'rvp')) || '—'}</div>
                                        <div>Sulphur: {((p as any).sulfur ?? parsePotExtra(p.notes, 'sulfur')) || '—'}</div>
                                        <div>Notes: {cleanPotNotes(p.notes) || ''}</div>
                                        {getPotPhotosForPot(p.id).length > 0 && (
                                          <div style={{ marginTop: 10 }}>
                                            <div style={{ color: '#a8b3bd', fontSize: 12, marginBottom: 6 }}>Shakeout Photo(s)</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                                              {getPotPhotosForPot(p.id).slice(0, 6).map((photo: any) => (
                                                <a key={photo.id || photo.file_path} href={photo.public_url || '#'} target="_blank" rel="noreferrer">
                                                  <img src={photo.public_url} alt={photo.file_name || 'shakeout photo'} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)' }} />
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {!isReadOnly && (
                                          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                                            <button type="button" style={{ ...button, marginTop: 0, background: '#d97706', border: '1px solid #f59e0b' }} onClick={() => editPotQuality(p)}>Edit POT</button>
                                            <button type="button" style={{ ...button, marginTop: 0, background: '#7f1d1d', border: '1px solid #ef4444' }} onClick={() => deletePotQuality(p)}>Delete POT</button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            ))}
                          </div>
                        </details>
                      ))}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {page === 'provings' && (
          <>
            <h1>Meter Provings</h1>
            <div style={{ ...box, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0 }}>
                {[
                  ['create', 'Create Proving', 'New proving entry'],
                  ['drafts', `Drafts (${draftProvings.length})`, 'Saved drafts'],
                  ['pending', `Pending (${approvalProvings.length})`, 'Awaiting approval'],
                  ['approved', `Approved (${approvedProvings.length})`, 'History by month'],
                  ['kpi', 'KPI', 'Monthly compliance'],
                  ['schedule', 'Schedule', 'Plan monthly provings'],
                ].map(([key, label, sub]) => (
                  <button
                    key={key}
                    type="button"
                    style={{
                      ...button,
                      borderRadius: 0,
                      margin: 0,
                      background: provingTab === key ? 'linear-gradient(135deg,#ef4444,#7f1d1d)' : 'rgba(15,23,42,0.92)',
                      border: provingTab === key ? '1px solid #ef4444' : '1px solid #22303c',
                      boxShadow: provingTab === key ? '0 0 18px rgba(239,68,68,0.28)' : 'none',
                      minHeight: 68,
                      textAlign: 'left',
                    }}
                    onClick={() => setProvingTab(key as any)}
                  >
                    <div style={{ fontWeight: 900 }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
            {provingTab === 'kpi' && (
              <>
            <div style={box}>
              <h2>Monthly Proving KPI</h2>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 20 }}>
                <div style={card}>Scheduled This Month<h2>{provingScheduleSummary.scheduled}</h2></div>
                <div style={card}>Proved This Month<h2>{provedThisMonthCount}</h2></div>
                <div style={card}>Remaining<h2>{remainingProvingCount}</h2></div>
                <div style={card}>Compliance<h2>{provingCompliance}%</h2><div style={{ color: '#a8b3bd' }}>Overdue: {provingScheduleSummary.overdue}</div></div>
              </div>
            </div>

            <div style={box}>
              <h2>Scheduled Proving KPI</h2>
              <p style={{ color: '#a8b3bd' }}>KPI is based only on meters scheduled in the Schedule tab. Completed means the scheduled meter has an approved proving in the selected month.</p>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                <label>
                  <div style={{ color: '#a8b3bd', marginBottom: 6 }}>KPI Month</div>
                  <input style={input} type="month" value={provingKpiMonth} onChange={(e) => setProvingKpiMonth(e.target.value)} />
                </label>
                <div style={card}>
                  <strong>Included Segments:</strong> {getSegmentProvingKpiRows().length || 0}
                  <span style={{ marginLeft: 12, color: '#a8b3bd' }}>Scope: scheduled meters only</span>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {getVisibleAreas().map((area: any) => {
                  const areaSegments = getVisibleSegments(area.id)
                  if (!areaSegments.length) return null
                  return (
                    <details key={area.id} open style={card}>
                      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{area.area_name || area.name}</summary>
                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
                        {areaSegments.map((segment: any) => (
                          <label key={segment.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={isSegmentIncludedInProvingKpi(segment.id)}
                              onChange={(e) => saveSegmentProvingSetting(segment.id, e.target.checked)}
                            />
                            <span>
                              <strong>{segment.segment_name || segment.name}</strong>
                              <div style={{ color: '#a8b3bd', fontSize: 12 }}>Include in monthly proving KPI</div>
                            </span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>

              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Segment', 'Scheduled', 'Completed', 'Remaining', 'Compliance'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getSegmentProvingKpiRows().map((row: any) => (
                      <tr key={row.segment.id}>
                        <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.segment.segment_name || row.segment.name}</td>
                        <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.scheduled}</td>
                        <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.completed}</td>
                        <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.remaining}</td>
                        <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}><strong>{row.compliance.toFixed(1)}%</strong></td>
                      </tr>
                    ))}
                    {!getSegmentProvingKpiRows().length && (
                      <tr><td colSpan={5} style={{ padding: 12, color: '#a8b3bd' }}>No scheduled provings for this KPI month yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}

            
            {provingTab === 'schedule' && (
              <>
                <div style={box}>
                  <h2>Monthly Proving Schedule</h2>
                  <p style={{ color: '#a8b3bd' }}>
                    Select the month and segment, then choose which lease / meter records are scheduled for proving. KPI counts only these scheduled meters.
                  </p>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '220px 260px 220px 1fr', gap: 12, alignItems: 'end' }}>
                    <label>
                      <div style={{ color: '#a8b3bd', marginBottom: 6 }}>Schedule Month</div>
                      <input style={input} type="month" value={provingKpiMonth} onChange={(e) => setProvingKpiMonth(e.target.value)} />
                    </label>
                    <label>
                      <div style={{ color: '#a8b3bd', marginBottom: 6 }}>Segment</div>
                      <select style={input} value={scheduleSegmentId} onChange={(e) => setScheduleSegmentId(e.target.value)}>
                        <option value="">Select Segment</option>
                        {getVisibleAreas().map((area: any) => (
                          <optgroup key={area.id} label={area.area_name || area.name || 'Area'}>
                            {getVisibleSegments(area.id).map((segment: any) => (
                              <option key={segment.id} value={segment.id}>{segment.segment_name || segment.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div style={{ color: '#a8b3bd', marginBottom: 6 }}>Assigned To</div>
                      <input style={input} placeholder="Optional" value={scheduleAssignedTo} onChange={(e) => setScheduleAssignedTo(e.target.value)} />
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...button, width: 'auto' }} onClick={exportProvingScheduleCsv}>
                        Export Schedule CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div style={box}>
                  <h2>Lease / Meter Schedule</h2>
                  {!scheduleSegmentId && <div style={card}>Select a segment to build this month's proving schedule.</div>}
                  {scheduleSegmentId && getScheduleSegmentMeters().length === 0 && <div style={card}>No active meters found for this segment.</div>}

                  {scheduleSegmentId && getScheduleSegmentMeters().map((meter: any) => {
                    const lease: any = getLeaseById(meter.lease_id || '')
                    const row = getScheduleRow(provingKpiMonth, meter.id)
                    const status = row ? getScheduleStatus(row) : null
                    return (
                      <div key={meter.id} style={{ ...card, display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 160px 160px 160px 160px', gap: 10, alignItems: 'center' }}>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!row}
                            onChange={(e) => e.target.checked ? upsertProvingScheduleRow(meter, { active: true, assigned_to: scheduleAssignedTo }) : removeProvingScheduleRow(provingKpiMonth, meter.id)}
                          />
                          <span>
                            <strong>{lease?.lease_name || lease?.name || lease?.lease_number || 'Unlinked Lease'}</strong>
                            <div style={{ color: '#a8b3bd', fontSize: 12 }}>Meter: {meter.meter_number || meter.meter_name}</div>
                          </span>
                        </label>

                        <div>
                          {status ? <strong style={{ color: status.color }}>{status.label}</strong> : <span style={{ color: '#a8b3bd' }}>Not Scheduled</span>}
                          {status?.completed?.proving_date && <div style={{ color: '#a8b3bd', fontSize: 12 }}>Proved: {status.completed.proving_date}</div>}
                        </div>

                        <input
                          style={input}
                          type="date"
                          value={row?.due_date || `${provingKpiMonth}-15`}
                          disabled={!row}
                          onChange={(e) => upsertProvingScheduleRow(meter, { due_date: e.target.value })}
                        />

                        <select
                          style={input}
                          value={row?.frequency || 'monthly'}
                          disabled={!row}
                          onChange={(e) => upsertProvingScheduleRow(meter, { frequency: e.target.value })}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="semi_annual">Semi Annual</option>
                          <option value="annual">Annual</option>
                        </select>

                        <input
                          style={input}
                          placeholder="Assigned To"
                          value={row?.assigned_to || ''}
                          disabled={!row}
                          onChange={(e) => upsertProvingScheduleRow(meter, { assigned_to: e.target.value })}
                        />

                        {row ? (
                          <button type="button" style={{ ...button, marginTop: 0, background: '#7f1d1d', border: '1px solid #ef4444' }} onClick={() => removeProvingScheduleRow(provingKpiMonth, meter.id)}>
                            Remove
                          </button>
                        ) : (
                          <button type="button" style={{ ...button, marginTop: 0 }} onClick={() => upsertProvingScheduleRow(meter, { active: true, assigned_to: scheduleAssignedTo })}>
                            Schedule
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={box}>
                  <h2>{provingKpiMonth} Schedule Summary</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Lease</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Meter</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Due Date</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Frequency</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Assigned To</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #374151', padding: 8 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getScheduledRowsForMonth(provingKpiMonth).map((row: any) => {
                        const meter = getMeterById(row.meter_id)
                        const lease = getLeaseById(row.lease_id || meter?.lease_id || '')
                        const status = getScheduleStatus(row)
                        return (
                          <tr key={row.id || `${row.month_key}_${row.meter_id}`}>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{lease?.lease_name || lease?.name || lease?.lease_number || '—'}</td>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{meter?.meter_number || meter?.meter_name || '—'}</td>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.due_date || '—'}</td>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.frequency || 'monthly'}</td>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}>{row.assigned_to || '—'}</td>
                            <td style={{ borderBottom: '1px solid #1f2937', padding: 8 }}><strong style={{ color: status.color }}>{status.label}</strong></td>
                          </tr>
                        )
                      })}
                      {!getScheduledRowsForMonth(provingKpiMonth).length && (
                        <tr><td colSpan={6} style={{ borderBottom: '1px solid #1f2937', padding: 8, color: '#a8b3bd' }}>No provings scheduled for this month yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

{provingTab === 'create' && (
              <>
            <div style={box}>
              <h2>New Proving</h2>
              {!shouldHideAreaSelector() ? (
                <select style={input} value={selectedProvingArea} onChange={(e) => handleProvingAreaSelect(e.target.value)}>
                  <option value="">Select Area</option>
                  {getVisibleAreas().map((area: any) => (
                    <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                  ))}
                </select>
              ) : (
                <div style={card}>Area: <strong>{getVisibleAreas()[0]?.area_name || getVisibleAreas()[0]?.name || 'Assigned Area'}</strong></div>
              )}

              <select style={input} value={selectedProvingSegment} onChange={(e) => handleProvingSegmentSelect(e.target.value)} disabled={!selectedProvingArea}>
                <option value="">{selectedProvingArea ? 'Select Segment' : 'Select area first'}</option>
                {getVisibleSegments(selectedProvingArea).map((segment: any) => (
                  <option key={segment.id} value={segment.id}>{segment.segment_name || segment.name}</option>
                ))}
              </select>

              <select style={input} value={selectedProvingLease} onChange={(e) => handleProvingLeaseSelect(e.target.value)} disabled={!selectedProvingSegment}>
                <option value="">{selectedProvingSegment ? 'Select Lease' : 'Select segment first'}</option>
                {getVisibleLeases(selectedProvingSegment).map((lease: any) => (
                  <option key={lease.id} value={lease.id}>{lease.lease_name || lease.name || lease.lease_number}</option>
                ))}
              </select>

              <select style={input} value={provingMeter} onChange={(e) => setProvingMeter(e.target.value)} disabled={!selectedProvingLease}>
                <option value="">{selectedProvingLease ? 'Select Meter' : 'Select lease first'}</option>
                {getVisibleMeters(selectedProvingLease).map((meter: any) => (
                  <option key={meter.id} value={meter.id}>
                    {meter.meter_number || meter.meter_name} {meter.meter_name && meter.meter_number ? `- ${meter.meter_name}` : ''}
                  </option>
                ))}
              </select>
              <select style={input} value={provingFactorType} onChange={(e) => setProvingFactorType(e.target.value)}>
                <option value="MF">MF</option>
                <option value="CMF">CMF</option>
              </select>
              <input style={input} type="date" value={provingDate} onChange={(e) => setProvingDate(e.target.value)} />
              <input style={input} placeholder="Prover Volume" value={proverVolume} onChange={(e) => setProverVolume(e.target.value)} />
              <input style={input} placeholder="Indicated Volume" value={provingIndicatedVolume} onChange={(e) => setProvingIndicatedVolume(e.target.value)} />
              <input style={input} placeholder={provingFactorType === 'CMF' ? 'Accepted MF' : 'Accepted MF'} value={acceptedMF} onChange={(e) => setAcceptedMF(e.target.value)} />
              {provingFactorType === 'CMF' && (
                <input style={input} placeholder="CPL for CMF" value={provingCpl} onChange={(e) => setProvingCpl(e.target.value)} />
              )}
              <input style={input} placeholder="Witness" value={provingWitness} onChange={(e) => setProvingWitness(e.target.value)} />
              <div style={{ ...card, display: 'grid', gap: 10 }}>
                <strong>Proving Report Capture</strong>
                <div style={{ color: '#a8b3bd' }}>Take one or more photos in the field. The app will convert them into one PDF. Office users can still upload an existing PDF.</div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>📸 Take / Choose Proving Report Photos</span>
                  <input
                    style={input}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => {
                      setProvingPhotoFiles(Array.from(e.target.files || []))
                      if ((e.target.files || []).length > 0) setProvingPdfFile(null)
                    }}
                  />
                </label>
                {provingPhotoFiles.length > 0 && <div>{provingPhotoFiles.length} photo(s) selected. They will be merged into one proving PDF.</div>}
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>📄 Or Upload Existing Proving PDF</span>
                  <input
                    style={input}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      setProvingPdfFile(e.target.files?.[0] || null)
                      if (e.target.files?.[0]) setProvingPhotoFiles([])
                    }}
                  />
                </label>
                {provingPdfFile && <div>PDF selected: {provingPdfFile.name}</div>}
              </div>
              <div style={card}>
                <strong>Calculated {provingFactorType}</strong>:{' '}
                {(() => {
                  const mfValue = roundFactor(Number(acceptedMF || (Number(proverVolume || 0) > 0 && Number(provingIndicatedVolume || 0) > 0 ? Number(proverVolume) / Number(provingIndicatedVolume) : 0)) || 0)
                  const cplValue = Number(provingCpl || 1)
                  const result = provingFactorType === 'CMF' ? roundFactor(mfValue * cplValue) : mfValue
                  return result.toFixed(4)
                })()}
                {provingFactorType === 'CMF' && (
                  <div style={{ marginTop: 8, color: '#9ca3af' }}>
                    CMF = MF × CPL. MF {Number(acceptedMF || (Number(proverVolume || 0) > 0 && Number(provingIndicatedVolume || 0) > 0 ? Number(proverVolume) / Number(provingIndicatedVolume) : 0) || 0).toFixed(4)} × CPL {Number(provingCpl || 1).toFixed(5)}
                  </div>
                )}
              </div>
              <button style={button} onClick={saveProving}>{editingProvingId ? (editingProvingOriginalStatus === 'approved' ? 'Update Approved Proving' : 'Update Draft Proving') : 'Save Draft Proving'}</button>
              {editingProvingId && (
                <button type="button" style={{ ...button, background: '#334155', border: '1px solid #475569' }} onClick={clearProvingForm}>
                  Cancel Edit / Clear Form
                </button>
              )}
            </div>
              </>
            )}

            {provingTab === 'drafts' && (
              <>
            <div style={box}>
              <div className="ticket-section-title"><div><h2 style={{ margin: 0 }}>Draft Provings</h2><span className="ticket-muted">Month → Segment → proving records</span></div></div>
              {renderGroupedProvings(draftProvings, 'draft')}
            </div>
              </>
            )}

            {provingTab === 'pending' && (
              <>
            <div style={box}>
              <div className="ticket-section-title"><div><h2 style={{ margin: 0 }}>Needs Approval</h2><span className="ticket-muted">Month → Segment → proving approval queue</span></div></div>
              {renderGroupedProvings(approvalProvings, 'pending')}
            </div>
              </>
            )}

            {provingTab === 'approved' && (
              <>
            <div style={box}>
              <div className="ticket-section-title"><div><h2 style={{ margin: 0 }}>Approved History</h2><span className="ticket-muted">Month → Segment → approved provings</span></div></div>
              {renderGroupedProvings(approvedProvings, 'approved')}
            </div>
              </>
            )}
          </>
        )}

        {page === 'operations' && (
          <div style={box}>
            <h1>Operations Removed</h1>
            <p style={{ color: '#a8b3bd' }}>
              This tab was removed to keep the app clean. Balance, proving, reading, POT, and report data now lives in their dedicated modules.
            </p>
            <button style={{ ...button, width: 'auto' }} onClick={() => setPage('dashboard')}>Go to Dashboard</button>
          </div>
        )}

        {page === 'reports' && (
          <>
            <h1>Reports Center</h1>

            <div style={box}>
              <h2>Report Filters</h2>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <label>
                  <div style={{ color: '#a8b3bd', marginBottom: 6 }}>Start Date</div>
                  <input style={input} type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                </label>
                <label>
                  <div style={{ color: '#a8b3bd', marginBottom: 6 }}>End Date</div>
                  <input style={input} type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                </label>

                <select style={input} value={reportSegmentId} onChange={(e) => { setReportSegmentId(e.target.value); setReportProducerId('') }}>
                  <option value="">All Segments</option>
                  {segments.map((segment: any) => (
                    <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                  ))}
                </select>

                <select style={input} value={reportProducerId} onChange={(e) => setReportProducerId(e.target.value)}>
                  <option value="">{reportSegmentId ? 'All Producers in Segment' : 'All Producers'}</option>
                  {getProducersForSegment(reportSegmentId).map((producer: any) => (
                    <option key={producer.id} value={producer.id}>{producer.name || (producer as any).producer_name}</option>
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
                      {row.totalsOnly ? (
                        <>
                          <div>Mode: Reporting Only</div>
                          <div>Reported Total: {row.reportedTotal.toFixed(2)}</div>
                          <div>Receipts: {row.receipts.toFixed(2)}</div>
                          <div>Deliveries: {row.deliveries.toFixed(2)}</div>
                          <div style={{ color: '#93c5fd' }}>Reporting Only — excluded from Over / Short</div>
                        </>
                      ) : (
                        <>
                          <div>Book Inventory: {row.bookInventory.toFixed(2)}</div>
                          <div>Actual Inventory: {row.actualInventory.toFixed(2)}</div>
                          <div>Over / Short: {row.overShort.toFixed(2)}</div>
                        </>
                      )}
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
            <div className="ticket-command-header">
              <div>
                <h1 style={{ margin: 0 }}>Tickets</h1>
                <div className="ticket-muted" style={{ marginTop: 6 }}>Professional ticket workflow. Build, review, approve, and export without touching the measurement calculations.</div>
              </div>
              <button style={{ ...button, width: 'auto', minWidth: 180 }} onClick={loadAll}>Refresh Tickets</button>
            </div>

            <div className="ticket-kpi-row">
              <div className="ticket-kpi-card"><div className="ticket-muted">Loaded</div><strong>{getScopedTickets().length}</strong></div>
              <div className="ticket-kpi-card"><div className="ticket-muted">Workflow</div><strong>{getDraftWorkflowTickets().length}</strong></div>
              <div className="ticket-kpi-card"><div className="ticket-muted">Approved</div><strong>{getApprovedTickets().length}</strong></div>
              <div className="ticket-kpi-card"><div className="ticket-muted">Draft NSV</div><strong>{getDraftWorkflowTickets().reduce((sum: number, ticket: any) => sum + Number((ticket.calculation_results || {}).nsv ?? (ticket.observed_inputs || {}).net_volume_bbl ?? 0), 0).toFixed(2)}</strong></div>
            </div>

            <div className="ticket-tabs">
              <button type="button" className={`ticket-tab ${ticketWorkflowTab === 'create' ? 'active' : ''}`} onClick={() => setTicketWorkflowTab('create')}>➕ Create Ticket</button>
              <button type="button" className={`ticket-tab ${ticketWorkflowTab === 'drafts' ? 'active' : ''}`} onClick={() => setTicketWorkflowTab('drafts')}>📋 Drafts ({getDraftWorkflowTickets().filter((t: any) => (t.status || 'draft') === 'draft').length})</button>
              <button type="button" className={`ticket-tab ${ticketWorkflowTab === 'pending' ? 'active' : ''}`} onClick={() => setTicketWorkflowTab('pending')}>⏳ Pending ({getDraftWorkflowTickets().filter((t: any) => (t.status || '') !== 'draft').length})</button>
              <button type="button" className={`ticket-tab ${ticketWorkflowTab === 'approved' ? 'active' : ''}`} onClick={() => setTicketWorkflowTab('approved')}>✅ Approved ({getApprovedTickets().length})</button>
            </div>

{selectedTicket && (
              <div style={box}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Ticket Review: {selectedTicket!.ticket_number || selectedTicket!.id} — {getTicketPdfLeaseName(
                      selectedTicket,
                      meters.find((m: any) => String(m.id) === String(selectedTicket!.meter_id || '')),
                      leases.find((l: any) => String(l.id) === String(selectedTicket!.lease_id || '')),
                      selectedTicket!.observed_inputs || {}
                    ) || 'No lease linked'}</h2>
                    <div style={{ color: '#a8b3bd', marginTop: 4 }}>
                      {selectedTicket!.ticket_type || 'ticket'} • {selectedTicket!.observed_inputs?.transporter_name || (selectedTicket as any).transporter_name || (selectedTicket as any).customer_name || 'No transporter'}
                    </div>
                  </div>
                  <span style={getTicketStatusStyle(selectedTicket!.status)}>{selectedTicket!.status || 'draft'}</span>
                </div>

                <div className="ticket-action-bar">
                  {selectedTicket!.status !== 'approved' && (
                    <button style={{ ...button, width: 'auto', background: '#16a34a' }} onClick={() => runSafeAction('Approving ticket', () => updateTicketStatus(selectedTicket!, 'approved'))}>
                      Approve Ticket
                    </button>
                  )}

                  {['draft', 'approved'].includes(String(selectedTicket!.status || 'draft').toLowerCase()) && (
                    <button style={{ ...button, width: 'auto', background: '#f59e0b' }} onClick={() => startDraftTicketEdit(selectedTicket)}>
                      {String(selectedTicket!.status || 'draft').toLowerCase() === 'approved' ? 'Revise Approved Ticket' : 'Edit Draft'}
                    </button>
                  )}

                  {selectedTicket!.status === 'draft' && (
                    <button style={{ ...button, width: 'auto', background: '#2563eb' }} onClick={() => runSafeAction('Submitting ticket', () => updateTicketStatus(selectedTicket!, 'submitted'))}>
                      Submit Ticket
                    </button>
                  )}
                  {selectedTicket!.status === 'draft' && (
                    <button style={{ ...button, width: 'auto', background: '#7f1d1d', borderColor: '#991b1b' }} onClick={() => runSafeAction('Deleting draft ticket', () => deleteDraftTicket(selectedTicket!))}>
                      Delete Draft
                    </button>
                  )}
                  <button style={{ ...button, width: 'auto' }} onClick={() => generatePdfPreview(selectedTicket)}>
                    Generate Customer PDF
                  </button>
                  {getTicketSavedPdfUrl(selectedTicket) && (
                    <button style={{ ...button, width: 'auto', background: '#0f766e' }} onClick={() => window.open(getTicketSavedPdfUrl(selectedTicket), '_blank')}>
                      Open Saved PDF
                    </button>
                  )}
                  <button style={{ ...button, width: 'auto' }} onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedTicket, null, 2))}>
                    Copy Ticket JSON
                  </button>
                  <button style={{ ...button, width: 'auto', background: '#374151' }} onClick={() => setSelectedTicket(null)}>
                    Close Ticket
                  </button>
                </div>

                {(selectedTicket!.observed_inputs as any)?.revision_number && (
                  <div style={{ ...card, marginTop: 14, borderColor: '#7c3aed' }}>
                    <h3 style={{ marginTop: 0 }}>Revision History</h3>
                    <div><strong>Current:</strong> Revision {(selectedTicket!.observed_inputs as any).revision_number}</div>
                    <div><strong>Last Reason:</strong> {(selectedTicket!.observed_inputs as any).revision_reason || '—'}</div>
                    <div><strong>Last Revised:</strong> {(selectedTicket!.observed_inputs as any).revised_at ? new Date((selectedTicket!.observed_inputs as any).revised_at).toLocaleString() : '—'}</div>
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                      {(((selectedTicket!.observed_inputs as any).revision_history || []) as any[]).slice().reverse().map((rev: any, index: number) => (
                        <div key={index} style={{ ...card, margin: 0, background: 'rgba(124,58,237,0.10)' }}>
                          <strong>Revision {rev.revision_number || ((selectedTicket!.observed_inputs as any).revision_number - index)}</strong>
                          <div>Reason: {rev.reason || '—'}</div>
                          <div>Revised: {rev.revised_at ? new Date(rev.revised_at).toLocaleString() : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['draft', 'approved'].includes(String(selectedTicket!.status || 'draft').toLowerCase()) && isDraftTicketEditOpen && (
                  <div style={{ ...card, marginTop: 14, borderColor: '#f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ marginTop: 0 }}>{String(selectedTicket!.status || '').toLowerCase() === 'approved' ? 'Revise Approved Ticket' : 'Edit Draft Ticket'}</h3>
                        <div style={{ color: '#a8b3bd', fontSize: 12 }}>Change bad inputs. GSV/NSV calculate from the edited inputs, with an optional audited net barrel adjustment.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button style={{ ...button, width: 'auto', background: '#16a34a' }} onClick={() => runSafeAction('Saving draft ticket edits', saveDraftTicketEdits)}>Save Changes</button>
                        <button style={{ ...button, width: 'auto', background: '#374151' }} onClick={() => setIsDraftTicketEditOpen(false)}>Cancel</button>
                      </div>
                    </div>

                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 12 }}>
                      <label><div className="ticket-muted">Opening Meter Reading</div><input style={input} value={draftTicketEditValues.opening_reading || ''} onChange={(e) => updateDraftTicketEditField('opening_reading', e.target.value)} /></label>
                      <label><div className="ticket-muted">Closing Meter Reading</div><input style={input} value={draftTicketEditValues.closing_reading || ''} onChange={(e) => updateDraftTicketEditField('closing_reading', e.target.value)} /></label>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">Total Batch Barrels / IV</div><strong>{formatTicketDetailNumber(getDraftTicketEditIv(draftTicketEditValues), 2)}</strong><div className="ticket-muted">Auto: Closing − Opening</div></div>
                      <label><div className="ticket-muted">Average Temp</div><input style={input} value={draftTicketEditValues.average_temperature || ''} onChange={(e) => updateDraftTicketEditField('average_temperature', e.target.value)} /></label>
                      <label><div className="ticket-muted">Average Pressure</div><input style={input} value={draftTicketEditValues.average_pressure || ''} onChange={(e) => updateDraftTicketEditField('average_pressure', e.target.value)} /></label>
                      <label><div className="ticket-muted">Observed Gravity/API</div><input style={input} value={draftTicketEditValues.observed_api_gravity || ''} onChange={(e) => updateDraftTicketEditField('observed_api_gravity', e.target.value)} /></label>
                      <label><div className="ticket-muted">Observed Temp</div><input style={input} value={draftTicketEditValues.observed_temperature || ''} onChange={(e) => updateDraftTicketEditField('observed_temperature', e.target.value)} /></label>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">API @ 60°F</div><strong>{(() => { const api = ticketEditNumber(draftTicketEditValues, 'observed_api_gravity'); const temp = ticketEditNumber(draftTicketEditValues, 'observed_temperature'); if (api === null || temp === null) return '—'; return formatMeasurementNumber(calculateApi11Corrections({ productGroup: 'crude', observedApiGravity: api, observedTemperature: temp, averageTemperature: ticketEditNumber(draftTicketEditValues, 'average_temperature') ?? temp, averagePressure: ticketEditNumber(draftTicketEditValues, 'average_pressure') ?? 0, apiRounding: 1 }).api_gravity_60, 1) })()}</strong><div className="ticket-muted">Calculated by app</div></div>
                      <label><div className="ticket-muted">S&W %</div><input style={input} value={draftTicketEditValues.sw_percent || ''} onChange={(e) => updateDraftTicketEditField('sw_percent', e.target.value)} /></label>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">CTL</div><strong>{formatFactorDetail(selectedTicket!.calculation_results?.ctl ?? selectedTicket!.observed_inputs?.ctl, 6)}</strong><div className="ticket-muted">Calculated by app</div></div>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">CPL</div><strong>{formatFactorDetail(selectedTicket!.calculation_results?.cpl ?? selectedTicket!.observed_inputs?.cpl, 6)}</strong><div className="ticket-muted">Calculated by app</div></div>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">GV</div><strong>{formatTicketDetailNumber(getDraftTicketEditCalculatedVolumes(draftTicketEditValues).gv, 2)}</strong><div className="ticket-muted">IV × CTL × CPL</div></div>
                      <label><div className="ticket-muted">MF / CMF</div><input style={input} value={draftTicketEditValues.mf || ''} onChange={(e) => updateDraftTicketEditField('mf', e.target.value)} /></label>
                      <label>
                        <div className="ticket-muted">Product</div>
                        <select style={input} value={draftTicketEditValues.refined_product_type || ''} onChange={(e) => updateDraftTicketEditField('refined_product_type', e.target.value)}>
                          <option value="">Not refined / blank</option>
                          {getRefinedProductCodeOptions().map((product) => (
                            <option key={product} value={product}>{product}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <div className="ticket-muted">Unit / Measure Type</div>
                        <select style={input} value={draftTicketEditValues.refined_unit_type || ''} onChange={(e) => updateDraftTicketEditField('refined_unit_type', e.target.value)}>
                          <option value="">Blank</option>
                          {getRefinedProductOptions().map((product) => (
                            <option key={product} value={product}>{product}</option>
                          ))}
                        </select>
                      </label>
                      <label><div className="ticket-muted">Destination / Movement To</div><input style={input} value={draftTicketEditValues.refined_destination || ''} onChange={(e) => updateDraftTicketEditField('refined_destination', e.target.value)} /></label>
                      <label><div className="ticket-muted">Batch Number</div><input style={input} value={draftTicketEditValues.batch_number || ''} onChange={(e) => updateDraftTicketEditField('batch_number', e.target.value)} /></label>
                      <label><div className="ticket-muted">Your Name</div><input style={input} value={draftTicketEditValues.ticket_prepared_by || ''} onChange={(e) => updateDraftTicketEditField('ticket_prepared_by', e.target.value)} placeholder="Person preparing ticket" /></label>
                      <label><div className="ticket-muted">Company Representative Name</div><input style={input} value={draftTicketEditValues.company_representative_name || ''} onChange={(e) => updateDraftTicketEditField('company_representative_name', e.target.value)} placeholder="Company representative" /></label>
                      <label><div className="ticket-muted">Calculation Method</div><input style={input} value={draftTicketEditValues.calculation_method_used || getTicketCalculationMethodLabel(selectedTicket)} onChange={(e) => updateDraftTicketEditField('calculation_method_used', e.target.value)} placeholder="API 11.1 - 2007, API 12.1 - 2021, etc." /></label>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">GSV</div><strong>{formatTicketDetailNumber(getDraftTicketEditCalculatedVolumes(draftTicketEditValues).baseGsv, 2)}</strong><div className="ticket-muted">GV × MF</div></div>
                      <div style={{ ...card, padding: 10 }}><div className="ticket-muted">Base NSV</div><strong>{formatTicketDetailNumber(getDraftTicketEditCalculatedVolumes(draftTicketEditValues).baseNsv, 2)}</strong><div className="ticket-muted">Before manual net adjustment</div></div>
                      <label><div className="ticket-muted">Net Volume Adjustment (+/- BBLS)</div><input style={input} value={draftTicketEditValues.net_volume_adjustment_bbl || ''} onChange={(e) => updateDraftTicketEditField('net_volume_adjustment_bbl', e.target.value)} /></label>
                      <div style={{ ...card, padding: 10, borderColor: Number(draftTicketEditValues.net_volume_adjustment_bbl || 0) !== 0 ? '#f59e0b' : undefined }}><div className="ticket-muted">Adjusted NSV</div><strong>{formatTicketDetailNumber(getDraftTicketEditCalculatedVolumes(draftTicketEditValues).adjustedNsv, 2)}</strong><div className="ticket-muted">Final net volume saved</div></div>
                      <label><div className="ticket-muted">Open Date</div><input style={input} type="date" value={draftTicketEditValues.open_date || ''} onChange={(e) => updateDraftTicketEditField('open_date', e.target.value)} /></label>
                      <label><div className="ticket-muted">Open Time</div><input style={input} type="time" value={draftTicketEditValues.open_time || ''} onChange={(e) => updateDraftTicketEditField('open_time', e.target.value)} /></label>
                      <label><div className="ticket-muted">Close Date</div><input style={input} type="date" value={draftTicketEditValues.close_date || ''} onChange={(e) => updateDraftTicketEditField('close_date', e.target.value)} /></label>
                      <label><div className="ticket-muted">Close Time</div><input style={input} type="time" value={draftTicketEditValues.close_time || ''} onChange={(e) => updateDraftTicketEditField('close_time', e.target.value)} /></label>
                    </div>
                    <label style={{ display: 'block', marginTop: 12 }}>
                      <div className="ticket-muted">Net Volume Adjustment Reason</div>
                      <input style={input} value={draftTicketEditValues.net_volume_adjustment_reason || ''} onChange={(e) => updateDraftTicketEditField('net_volume_adjustment_reason', e.target.value)} placeholder="Required by policy when manually adjusting net barrels" />
                    </label>
                    <label style={{ display: 'block', marginTop: 12 }}>
                      <div className="ticket-muted">Notes</div>
                      <textarea style={{ ...input, minHeight: 80 }} value={draftTicketEditValues.notes || ''} onChange={(e) => updateDraftTicketEditField('notes', e.target.value)} />
                    </label>
                  </div>
                )}

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
                  <div style={card}>
                    <h3>Ticket Information</h3>
                    <div><strong>Ticket # / Lease:</strong> {selectedTicket!.ticket_number || selectedTicket!.id} — {getTicketPdfLeaseName(
                      selectedTicket,
                      meters.find((m: any) => String(m.id) === String(selectedTicket!.meter_id || '')),
                      leases.find((l: any) => String(l.id) === String(selectedTicket!.lease_id || '')),
                      selectedTicket!.observed_inputs || {}
                    ) || 'No lease linked'}</div>
                    <div><strong>Type:</strong> {selectedTicket!.ticket_type || '—'}</div>
                    <div><strong>Status:</strong> {selectedTicket!.status || 'draft'}</div>
                    <div><strong>Calculation Method:</strong> {getTicketCalculationMethodLabel(selectedTicket)}</div>
                    <div><strong>Your Name:</strong> {selectedTicket!.observed_inputs?.ticket_prepared_by || selectedTicket!.calculation_results?.ticket_prepared_by || '—'}</div>
                    <div><strong>Company Representative:</strong> {selectedTicket!.observed_inputs?.company_representative_name || selectedTicket!.calculation_results?.company_representative_name || '—'}</div>
                    <div><strong>Transporter:</strong> {selectedTicket!.observed_inputs?.transporter_name || (selectedTicket as any).transporter_name || (selectedTicket as any).customer_name || '—'}</div>
                    <div><strong>Product:</strong> {selectedTicket!.observed_inputs?.refined_product_type || selectedTicket!.calculation_results?.refined_product_type || selectedTicket!.observed_inputs?.product_code || selectedTicket!.observed_inputs?.product_type || '—'}</div>
                    <div><strong>Unit / Measure:</strong> {selectedTicket!.observed_inputs?.refined_unit_type || selectedTicket!.calculation_results?.refined_unit_type || selectedTicket!.observed_inputs?.unit_of_measure_type || '—'}</div>
                    <div><strong>Destination / To:</strong> {selectedTicket!.observed_inputs?.refined_destination || selectedTicket!.calculation_results?.refined_destination || selectedTicket!.observed_inputs?.movement_destination || '—'}</div>
                    <div><strong>Batch #:</strong> {selectedTicket!.observed_inputs?.batch_number || selectedTicket!.calculation_results?.batch_number || (selectedTicket as any).batch_number || '—'}</div>
                    <div><strong>LACT:</strong> {selectedTicket!.observed_inputs?.lact_name || (selectedTicket as any).lact_name || '—'}</div>
                    <div><strong>Source Rows:</strong> {selectedTicket!.observed_inputs?.source_rows || '—'}</div>
                  </div>

                  <div style={card}>
                    <h3>Volume Calculation</h3>
                    <div><strong>IV:</strong> {formatTicketDetailNumber(getTicketIvDetail(selectedTicket), 1)}</div>
                    <div><strong>CTL:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.ctl ?? selectedTicket!.observed_inputs?.ctl, 6)}</div>
                    <div><strong>CPL:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.cpl ?? selectedTicket!.observed_inputs?.cpl, 6)}</div>
                    <div><strong>CTPL:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.ctpl ?? selectedTicket!.observed_inputs?.ctpl ?? ((Number(selectedTicket!.calculation_results?.ctl ?? selectedTicket!.observed_inputs?.ctl ?? 0) || 0) * (Number(selectedTicket!.calculation_results?.cpl ?? selectedTicket!.observed_inputs?.cpl ?? 0) || 0)), 6)}</div>
                    <div><strong>CCF:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.ccf ?? selectedTicket!.observed_inputs?.ccf, 6)}</div>
                    <div><strong>MF:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.mf ?? selectedTicket!.observed_inputs?.mf, 6)}</div>
                    <div><strong>CSW:</strong> {formatFactorDetail(selectedTicket!.calculation_results?.csw ?? selectedTicket!.observed_inputs?.csw, 6)}</div>
                    <hr style={{ borderColor: '#1f2937' }} />
                    <div><strong>GSV:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.gsv, 1)}</div>
                    <div><strong>NSV:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.nsv, 1)}</div>
                  </div>

                  <div style={card}>
                    <h3>Quality Information</h3>
                    <div><strong>Observed API:</strong> {formatTicketDetailNumber(selectedTicket!.observed_inputs?.observed_api_gravity ?? selectedTicket!.observed_inputs?.api_observed ?? selectedTicket!.observed_inputs?.api_gravity_observed, 2)}</div>
                    <div><strong>API Gravity @ 60°F:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.api_gravity_60 ?? selectedTicket!.observed_inputs?.api_gravity_60 ?? selectedTicket!.calculation_results?.api_gravity ?? selectedTicket!.observed_inputs?.api_gravity, 2)}</div>
                    <div><strong>Observed Temp:</strong> {formatTicketDetailNumber(selectedTicket!.observed_inputs?.observed_temperature ?? selectedTicket!.observed_inputs?.temperature ?? selectedTicket!.observed_inputs?.average_temperature ?? selectedTicket!.calculation_results?.average_temperature, 2)}</div>
                    <div><strong>Average Temp:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.average_temperature ?? selectedTicket!.observed_inputs?.average_temperature, 2)}</div>
                    <div><strong>Observed Pressure:</strong> {formatTicketDetailNumber(selectedTicket!.observed_inputs?.observed_pressure ?? selectedTicket!.observed_inputs?.pressure ?? selectedTicket!.observed_inputs?.average_pressure ?? selectedTicket!.calculation_results?.average_pressure, 2)}</div>
                    <div><strong>Average Pressure:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.average_pressure ?? selectedTicket!.observed_inputs?.average_pressure, 2)}</div>
                    <div><strong>BS&W %:</strong> {formatTicketDetailNumber(selectedTicket!.calculation_results?.bsw_percent ?? selectedTicket!.observed_inputs?.bsw_percent ?? selectedTicket!.observed_inputs?.bsw, 4)}</div>
                    <div><strong>API Correction Delta:</strong> {formatTicketDetailNumber(
                      (selectedTicket!.calculation_results?.api_gravity_60 ?? selectedTicket!.observed_inputs?.api_gravity_60 ?? selectedTicket!.calculation_results?.api_gravity ?? selectedTicket!.observed_inputs?.api_gravity) -
                      (selectedTicket!.observed_inputs?.observed_api_gravity ?? selectedTicket!.observed_inputs?.api_observed ?? selectedTicket!.observed_inputs?.api_gravity_observed ?? 0),
                      2
                    )}</div>
                    <div><strong>Corrected Gravity Source:</strong> {selectedTicket!.observed_inputs?.assigned_pot_label ? 'Assigned POT' : selectedTicket!.observed_inputs?.api_gravity_60 ? 'Imported' : 'Calculated/Default'}</div>
                  </div>

                  <div style={card}>
                    <h3>POT Assignment</h3>
                    <div><strong>Assigned POT:</strong> {getTicketAssignedPotLabel(selectedTicket)}</div>
                    <div><strong>POT ID:</strong> {(selectedTicket as any).assigned_pot_id || selectedTicket!.observed_inputs?.assigned_pot_id || '—'}</div>
                    <div><strong>POT Source:</strong> {selectedTicket!.observed_inputs?.pot_source || 'Transporter POT Map'}</div>
                  </div>

                  <div style={card}>
                    <h3>Contract Information</h3>
                    <div><strong>Contract:</strong> {getTicketContractName(selectedTicket)}</div>
                    <div><strong>API Version:</strong> {getTicketApiVersionLabel(selectedTicket)}</div>
                    <div><strong>Method:</strong> {selectedTicket!.observed_inputs?.calculation_method || (selectedTicket as any).calculation_method || '—'}</div>
                    <div><strong>Formula:</strong> {selectedTicket!.observed_inputs?.calculation_formula || selectedTicket!.calculation_results?.formula || '—'}</div>
                    <div><strong>Correction Source:</strong> {selectedTicket!.observed_inputs?.correction_source || (selectedTicket as any).correction_source || '—'}</div>
                  </div>

                  <div style={card}>
                    <h3>Source Summary</h3>
                    <div><strong>Ticket Count:</strong> {uniqueCsvCount(selectedTicket!.observed_inputs?.ticket_numbers) || '—'}</div>
                    <div><strong>Batch Count:</strong> {uniqueCsvCount(selectedTicket!.observed_inputs?.batch_numbers) || '—'}</div>
                    <div><strong>Truck Count:</strong> {uniqueCsvCount(selectedTicket!.observed_inputs?.truck_numbers) || '—'}</div>
                    <div><strong>Lease Count:</strong> {uniqueCsvCount(selectedTicket!.observed_inputs?.leases) || '—'}</div>
                  </div>
                </div>

                {selectedTicket!.observed_inputs?.calculation_audit && (
                  <div style={{ ...card, marginTop: 12 }}>
                    <h3>Calculation Audit</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                      {JSON.stringify(selectedTicket!.observed_inputs?.calculation_audit, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}


            <div className="ticket-workspace">
              {ticketWorkflowTab === 'create' && (
              <div>
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
              <div className="ticket-section-title"><div><h2 style={{ margin: 0 }}>Create Draft Ticket</h2><div className="ticket-muted">Segment → Lease → Meter. Producer and measurement data auto-fill. Dates stay with the ticket.</div></div><button style={{ ...button, width: 'auto', background: '#374151' }} onClick={() => { setSelectedLease(''); setSelectedMeter(''); setManualClosingReading('') }}>Clear Form</button></div>
              {!shouldHideAreaSelector() ? (
                <select style={input} value={selectedTicketArea} onChange={(e) => handleTicketAreaSelect(e.target.value)}>
                  <option value="">Select Area</option>
                  {getVisibleAreas().map((area: any) => (
                    <option key={area.id} value={area.id}>{area.area_name || area.name}</option>
                  ))}
                </select>
              ) : (
                <div style={card}>Area: <strong>{getVisibleAreas()[0]?.area_name || getVisibleAreas()[0]?.name || 'Assigned Area'}</strong></div>
              )}

              <select style={input} value={selectedSegment} onChange={(e) => handleTicketSegmentSelect(e.target.value)} disabled={!selectedTicketArea}>
                <option value="">{selectedTicketArea ? 'Select Segment' : 'Select area first'}</option>
                {getVisibleSegments(selectedTicketArea).map((s: any) => <option key={s.id} value={s.id}>{s.segment_name || s.name}</option>)}
              </select>

              <select style={input} value={selectedLease} onChange={(e) => handleTicketLeaseSelect(e.target.value)} disabled={!selectedSegment}>
                <option value="">{selectedSegment ? 'Select Lease' : 'Select segment first'}</option>
                {filteredLeases.map((l: any) => <option key={l.id} value={l.id}>{l.lease_name || l.name || l.lease_number}</option>)}
              </select>

              <select style={input} value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)} disabled={!selectedLease}>
                <option value="">{selectedLease ? 'Select Meter' : 'Select lease first'}</option>
                {filteredMeters.map((m: any) => <option key={m.id} value={m.id}>{m.meter_number || m.meter_name}</option>)}
              </select>

              <div style={card}>Producer: <strong>{selectedTicketProducerDisplay || (selectedLease ? 'No producer linked' : 'Auto-fills after lease')}</strong></div>

              <div style={card}>
                <strong>Open / Close Date & Time</strong>
                <div className="ticket-create-grid" style={{ marginTop: 10 }}>
                  <label>
                    <div className="ticket-muted" style={{ marginBottom: 6 }}>Open Date</div>
                    <input style={input} type="date" value={ticketOpenDate} onChange={(e) => setTicketOpenDate(e.target.value)} />
                  </label>
                  <label>
                    <div className="ticket-muted" style={{ marginBottom: 6 }}>Open Time</div>
                    <input style={input} type="time" value={ticketOpenTime} onChange={(e) => setTicketOpenTime(e.target.value)} />
                  </label>
                  <label>
                    <div className="ticket-muted" style={{ marginBottom: 6 }}>Close Date</div>
                    <input style={input} type="date" value={ticketCloseDate} onChange={(e) => setTicketCloseDate(e.target.value)} />
                  </label>
                  <label>
                    <div className="ticket-muted" style={{ marginBottom: 6 }}>Close Time</div>
                    <input style={input} type="time" value={ticketCloseTime} onChange={(e) => setTicketCloseTime(e.target.value)} />
                  </label>
                </div>
              </div>

              <label style={{ display: 'block' }}>
                <div className="ticket-muted" style={{ marginBottom: 6 }}>Batch Number</div>
                <input
                  style={input}
                  placeholder="Batch number / movement number"
                  value={ticketBatchNumber}
                  onChange={(e) => setTicketBatchNumber(e.target.value)}
                />
              </label>

              <select style={input} value={ticketType} onChange={(e) => setTicketType(e.target.value)}>
                <option value="meter">Meter Ticket</option>
                <option value="tank">Tank Ticket</option>
                <option value="line_fill">Line Fill Ticket</option>
                <option value="transfer">Transfer Ticket</option>
                <option value="truck">Truck Ticket</option>
              </select>

              {isRefinedTicketContext() && (
                <div style={card}>
                  <h3>Refined Product Details</h3>
                  <p style={{ color: '#a8b3bd', marginTop: 0 }}>
                    Used only for refined product contracts/meters. This will print/store on the ticket but does not affect crude tickets.
                  </p>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <label>
                      <div className="ticket-muted" style={{ marginBottom: 6 }}>Product</div>
                      <select style={input} value={refinedProductCode} onChange={(e) => setRefinedProductCode(e.target.value)}>
                        <option value="">Select Product</option>
                        {getRefinedProductCodeOptions().map((product) => (
                          <option key={product} value={product}>{product}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div className="ticket-muted" style={{ marginBottom: 6 }}>Unit / Measure Type</div>
                      <select style={input} value={refinedProductType} onChange={(e) => setRefinedProductType(e.target.value)}>
                        <option value="">Select Unit / Type</option>
                        {getRefinedProductOptions().map((product) => (
                          <option key={product} value={product}>{product}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div className="ticket-muted" style={{ marginBottom: 6 }}>Destination / Movement To</div>
                      <input
                        style={input}
                        placeholder="Example: Fintex, Rack, Tank 400, NBSJ, Customer"
                        value={refinedMovementDestination}
                        onChange={(e) => setRefinedMovementDestination(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {(ticketType === 'tank' || ticketType === 'transfer') && (
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ marginTop: 0 }}>Tank Ticket</h3>
                      <div style={{ color: '#a8b3bd', fontSize: 12 }}>
                        API 12.1 tank ticket: enter only closing readings and product data. Opening GOV/GSV/NSV pulls from the last approved tank ticket when available.
                      </div>
                    </div>
                    <div style={{ color: '#86efac', fontWeight: 800 }}>Tank-only calculation</div>
                  </div>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <select style={input} value={selectedTank} onChange={(e) => { setSelectedTank(e.target.value); setSelectedTankCalibrationVersionId('') }}>
                      <option value="">Select Tank</option>
                      {tanks
                        .filter((tank: any) => !selectedSegment || tank.segment_id === selectedSegment)
                        .map((tank: any) => (
                          <option key={tank.id} value={tank.id}>
                            {tank.tank_number} {tank.tank_name ? `- ${tank.tank_name}` : ''}
                          </option>
                        ))}
                    </select>

                    <select style={input} value={selectedTankCalibrationVersionId} onChange={(e) => setSelectedTankCalibrationVersionId(e.target.value)} disabled={!selectedTank}>
                      <option value="">Use Active Strap / Leg</option>
                      {tankCalibrationVersions
                        .filter((version: any) => String(version.tank_id) === String(selectedTank))
                        .map((version: any) => (
                          <option key={version.id} value={version.id}>
                            {getTankCalibrationLabel(version)}{version.active !== false ? ' (Active)' : ''}
                          </option>
                        ))}
                    </select>

                    <select style={input} value={tankMovementDirection} onChange={(e) => setTankMovementDirection(e.target.value)}>
                      <option value="delivery">Delivery / Drawdown</option>
                      <option value="receipt">Receipt / Fill</option>
                    </select>
                  </div>

                  <div style={{ ...card, background: 'linear-gradient(135deg, rgba(30,64,175,0.22), rgba(2,6,23,0.35))' }}>
                    <strong>Opening From Previous Approved Ticket</strong>
                    <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 4 }}>
                      Opening GOV, GSV, and NSV are pulled from the previous approved tank ticket. If no previous ticket exists, opening values stay at 0 until one is approved.
                    </div>
                    {selectedTank ? (() => {
                      const prev = getPreviousTankOpeningStandardPoint(selectedTank)
                      return prev ? (
                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
                          <div><div style={{ color: '#a8b3bd', fontSize: 11 }}>Previous Ticket</div><strong>{prev.sourceTicketNumber || 'Approved Ticket'}</strong></div>
                          <div><div style={{ color: '#a8b3bd', fontSize: 11 }}>Opening GOV</div><strong>{Number(prev.gov || 0).toFixed(2)}</strong></div>
                          <div><div style={{ color: '#a8b3bd', fontSize: 11 }}>Opening GSV</div><strong>{Number(prev.gsv || 0).toFixed(2)}</strong></div>
                          <div><div style={{ color: '#a8b3bd', fontSize: 11 }}>Opening NSV</div><strong>{Number(prev.nsv || 0).toFixed(2)}</strong></div>
                        </div>
                      ) : (
                        <div style={{ color: '#fca5a5', marginTop: 10 }}>No previous approved tank ticket found for this tank.</div>
                      )
                    })() : <div style={{ color: '#a8b3bd', marginTop: 10 }}>Select a tank to see opening values.</div>}
                  </div>

                  <div style={{ marginTop: 12, color: '#a8b3bd', fontSize: 12 }}>Closing Oil Gauge</div>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <input style={input} placeholder="Closing Feet" value={tankClosingFeet} onChange={(e) => setTankClosingFeet(e.target.value)} />
                    <input style={input} placeholder="Closing Inches" value={tankClosingInches} onChange={(e) => setTankClosingInches(e.target.value)} />
                    <input style={input} placeholder="Closing 8ths" value={tankClosingEighths} onChange={(e) => setTankClosingEighths(e.target.value)} />
                  </div>

                  <div style={{ marginTop: 12, color: '#a8b3bd', fontSize: 12 }}>Closing Water Gauge</div>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <input style={input} placeholder="Water Feet" value={tankClosingWaterFeet} onChange={(e) => setTankClosingWaterFeet(e.target.value)} />
                    <input style={input} placeholder="Water Inches" value={tankClosingWaterInches} onChange={(e) => setTankClosingWaterInches(e.target.value)} />
                    <input style={input} placeholder="Water 8ths" value={tankClosingWaterEighths} onChange={(e) => setTankClosingWaterEighths(e.target.value)} />
                  </div>

                  <div style={{ marginTop: 12, color: '#a8b3bd', fontSize: 12 }}>Temperature / Product Quality</div>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                    <input style={input} placeholder="Ambient Temp" value={tankAmbientTemp} onChange={(e) => setTankAmbientTemp(e.target.value)} />
                    <input style={input} placeholder="Average Temp" value={tankAverageTemp} onChange={(e) => setTankAverageTemp(e.target.value)} />
                    <input style={input} placeholder="Observed Gravity" value={tankObservedGravity} onChange={(e) => setTankObservedGravity(e.target.value)} />
                    <input style={input} placeholder="Observed Temp" value={tankObservedTemp} onChange={(e) => setTankObservedTemp(e.target.value)} />
                    <input style={input} placeholder="S&W %" value={tankSwPercent} onChange={(e) => setTankSwPercent(e.target.value)} />
                  </div>

                  {selectedTank && tankClosingFeet !== '' && (
                    <div style={card}>
                      <h4 style={{ marginTop: 0 }}>API 12.1 Tank Calculation Preview</h4>
                      <div style={{ color: '#a8b3bd', fontSize: 12, marginBottom: 10 }}>
                        FRA/roof data is taken from the selected strapping chart/leg. FRA = roof weight ÷ (350.16 × reference SG) minus roof weight ÷ (350.16 × actual SG).
                      </div>
                      {(!calculateTankTicketSnapshot(selectedTank).roofConfig.roofWeightLbs || !calculateTankTicketSnapshot(selectedTank).roofConfig.referenceSg) && (
                        <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>
                          FRA is not active yet: this selected strap is missing roof weight or reference API/SG. Run the Supabase calibration metadata migration, then re-import or update this strap.
                        </div>
                      )}

                      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                        <div style={box}><div style={{ color: '#a8b3bd', fontSize: 11 }}>Transferred GOV</div><strong>{calculateTankTicketSnapshot(selectedTank).gov.toFixed(2)}</strong></div>
                        <div style={box}><div style={{ color: '#a8b3bd', fontSize: 11 }}>Transferred GSV</div><strong>{calculateTankTicketSnapshot(selectedTank).gsv.toFixed(2)}</strong></div>
                        <div style={box}><div style={{ color: '#a8b3bd', fontSize: 11 }}>Transferred NSV</div><strong style={{ color: '#86efac' }}>{calculateTankTicketSnapshot(selectedTank).nsv.toFixed(2)}</strong></div>
                        <div style={box}><div style={{ color: '#a8b3bd', fontSize: 11 }}>Closing Water</div><strong>{calculateTankTicketSnapshot(selectedTank).closingPoint.fw.toFixed(2)}</strong></div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid rgba(148,163,184,0.25)' }}>Description</th>
                              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid rgba(148,163,184,0.25)' }}>Opening Previous</th>
                              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid rgba(148,163,184,0.25)' }}>Closing Calculated</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr><td style={{ padding: 8 }}>Gauge</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingGaugeDecimal.toFixed(4)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingGaugeDecimal.toFixed(4)}</td></tr>
                            <tr><td style={{ padding: 8 }}>TOV</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingPoint.tov.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingPoint.tov.toFixed(2)}</td></tr>
                            <tr><td style={{ padding: 8 }}>Free Water</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingPoint.fw.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingPoint.fw.toFixed(2)}</td></tr>
                            <tr><td style={{ padding: 8 }}>CTSh / Shell Temp</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).ctsh.toFixed(5)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).tankShellTemp.toFixed(1)} °F</td></tr>
                            <tr><td style={{ padding: 8 }}>FRA / Roof Adj</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingPoint.roofAdjustmentBbl.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingPoint.roofAdjustmentBbl.toFixed(2)}</td></tr>
                            <tr><td style={{ padding: 8 }}>GOV</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingPoint.gov.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingPoint.gov.toFixed(2)}</td></tr>
                            <tr><td style={{ padding: 8 }}>GSV</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingGsv.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingGsv.toFixed(2)}</td></tr>
                            <tr><td style={{ padding: 8 }}>NSV</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).openingNsv.toFixed(2)}</td><td style={{ textAlign: 'right', padding: 8 }}>{calculateTankTicketSnapshot(selectedTank).closingNsv.toFixed(2)}</td></tr>
                          </tbody>
                        </table>
                      </div>

                      <div style={{ color: '#a8b3bd', fontSize: 12, marginTop: 10 }}>
                        Strap / Leg: {calculateTankTicketSnapshot(selectedTank).selectedCalibration ? getTankCalibrationLabel(calculateTankTicketSnapshot(selectedTank).selectedCalibration) : 'None'} •
                        Roof Wt: {Number(calculateTankTicketSnapshot(selectedTank).roofConfig.roofWeightLbs || 0).toFixed(0)} lbs •
                        Ref SG: {Number(calculateTankTicketSnapshot(selectedTank).roofConfig.referenceSg || 0).toFixed(5)} •
                        Actual SG: {apiToSpecificGravity(getTankCorrectedApi60()).toFixed(5)} •
                        API @60: {calculateTankTicketSnapshot(selectedTank).corrections.api_gravity_60.toFixed(1)} •
                        CTL/CTPL: {calculateTankTicketSnapshot(selectedTank).ctl.toFixed(5)} •
                        CSW: {(1 - calculateTankTicketSnapshot(selectedTank).swDecimal).toFixed(5)}
                      </div>
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
                <div>POT BS&W: {formatPotBswPercent(autofillPreview?.pot)}</div>
                <div>
                  POT CSW: {
                    autofillPreview?.pot
                      ? (autofillPreview.pot as any).csw ??
                        (1 - Number(
                          (autofillPreview.pot as any).bsw_percent ??
                          (autofillPreview.pot as any).sw_percent ??
                          (autofillPreview.pot as any).bsw ??
                          0
                        ) / 100).toFixed(5)
                      : 'None'
                  }
                </div>
              </div>

              <button style={button} disabled={isActionRunning} onClick={() => runSafeAction('Creating ticket', async () => { await createTicket(); clearLocalTicketDraft(); setTicketWorkflowTab('drafts') })}>Build Draft Ticket</button>
            </div>
              </div>
              )}

              {(ticketWorkflowTab === 'drafts' || ticketWorkflowTab === 'pending') && (
              <div>
            <div style={box}>
              {(() => {
                const baseTickets = getDraftWorkflowTickets().filter((ticket: any) => ticketWorkflowTab === 'drafts' ? (ticket.status || 'draft') === 'draft' : (ticket.status || '') !== 'draft')
                const monthOptions = getTicketMonthOptions(baseTickets)
                const filteredTickets = baseTickets.filter((ticket: any) =>
                  (!ticketArchiveMonthFilter || getTicketMonthKey(ticket) === ticketArchiveMonthFilter) &&
                  (!ticketArchiveSegmentFilter || getTicketSegmentId(ticket) === ticketArchiveSegmentFilter) &&
                  (!ticketArchiveProducerFilter || getTicketProducerId(ticket) === ticketArchiveProducerFilter)
                )
                const groupedArchive = groupTicketsByMonthSegmentKind(filteredTickets)

                return (
                  <>
                    <div className="ticket-section-title">
                      <div>
                        <h2 style={{ margin: 0 }}>{ticketWorkflowTab === 'drafts' ? 'Draft Tickets' : 'Pending Approval'}</h2>
                        <span className="ticket-muted">Month → Segment → Meter/Tank/Line Fill work queues</span>
                      </div>
                    </div>

                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <select style={input} value={ticketArchiveMonthFilter} onChange={(e) => setTicketArchiveMonthFilter(e.target.value)}>
                        <option value="">All Months</option>
                        {monthOptions.map((month: any) => (
                          <option key={month.monthKey} value={month.monthKey}>{month.label}</option>
                        ))}
                      </select>
                      <select style={input} value={ticketArchiveSegmentFilter} onChange={(e) => { setTicketArchiveSegmentFilter(e.target.value); setTicketArchiveProducerFilter('') }}>
                        <option value="">All Segments</option>
                        {segments.map((segment: any) => (
                          <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                        ))}
                      </select>
                      <select style={input} value={ticketArchiveProducerFilter} onChange={(e) => setTicketArchiveProducerFilter(e.target.value)}>
                        <option value="">{ticketArchiveSegmentFilter ? 'All Producers in Segment' : 'All Producers'}</option>
                        {getProducersForSegment(ticketArchiveSegmentFilter).map((producer: any) => (
                          <option key={producer.id} value={producer.id}>{producer.name || (producer as any).producer_name}</option>
                        ))}
                      </select>
                    </div>

                    {filteredTickets.length === 0 && (
                      <div style={card}>{ticketWorkflowTab === 'drafts' ? 'No draft tickets waiting.' : 'No tickets pending approval.'}</div>
                    )}

                    {groupedArchive.map((monthGroup: any) => {
                      const monthKey = getTicketArchiveSectionKey(ticketWorkflowTab, monthGroup.monthKey)
                      const monthOpen = openTicketArchiveSections[monthKey] ?? true
                      const monthNsv = monthGroup.tickets.reduce((sum: number, ticket: any) => {
                        const calc = ticket.calculation_results || {}
                        const observed = ticket.observed_inputs || {}
                        return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                      }, 0)

                      return (
                        <div key={monthKey} style={{ ...card, marginBottom: 12 }}>
                          <button style={{ ...button, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(monthKey)}>
                            <span>{monthOpen ? '▼' : '▶'} {monthGroup.label}</span>
                            <span>{monthGroup.tickets.length} tickets • NSV {monthNsv.toFixed(2)}</span>
                          </button>

                          {monthOpen && monthGroup.segmentGroups.map((segmentGroup: any) => {
                            const segmentKey = getTicketArchiveSectionKey(ticketWorkflowTab, monthGroup.monthKey, segmentGroup.segmentId)
                            const segmentOpen = openTicketArchiveSections[segmentKey] ?? true
                            const segmentNsv = segmentGroup.tickets.reduce((sum: number, ticket: any) => {
                              const calc = ticket.calculation_results || {}
                              const observed = ticket.observed_inputs || {}
                              return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                            }, 0)

                            return (
                              <div key={segmentKey} style={{ ...card, marginTop: 10, background: 'rgba(15,23,42,0.45)' }}>
                                <button style={{ ...button, background: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(segmentKey)}>
                                  <span>{segmentOpen ? '▼' : '▶'} {segmentGroup.label}</span>
                                  <span>{segmentGroup.tickets.length} tickets • NSV {segmentNsv.toFixed(2)}</span>
                                </button>

                                {segmentOpen && segmentGroup.kindGroups.map((kindGroup: any) => {
                                  const kindKey = getTicketArchiveSectionKey(ticketWorkflowTab, monthGroup.monthKey, segmentGroup.segmentId, kindGroup.kind)
                                  const kindOpen = openTicketArchiveSections[kindKey] ?? true
                                  const kindNsv = kindGroup.tickets.reduce((sum: number, ticket: any) => {
                                    const calc = ticket.calculation_results || {}
                                    const observed = ticket.observed_inputs || {}
                                    return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                                  }, 0)

                                  return (
                                    <div key={kindKey} style={{ marginTop: 10 }}>
                                      <button style={{ ...button, background: kindGroup.kind === 'tank' ? '#92400e' : kindGroup.kind === 'line_fill' ? '#1d4ed8' : '#14532d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(kindKey)}>
                                        <span>{kindOpen ? '▼' : '▶'} {kindGroup.label}</span>
                                        <span>{kindGroup.tickets.length} tickets • NSV {kindNsv.toFixed(2)}</span>
                                      </button>

                                      {kindOpen && (
                                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                                          {kindGroup.tickets.map((ticket: any) => renderTicketQueueCard(ticket, false))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>

            </div>
              )}

              {ticketWorkflowTab === 'approved' && (
              <div>
            <div style={box}>
              {(() => {
                const baseTickets = getApprovedTickets()
                const monthOptions = getTicketMonthOptions(baseTickets)
                const filteredTickets = baseTickets.filter((ticket: any) =>
                  (!ticketArchiveMonthFilter || getTicketMonthKey(ticket) === ticketArchiveMonthFilter) &&
                  (!ticketArchiveSegmentFilter || getTicketSegmentId(ticket) === ticketArchiveSegmentFilter) &&
                  (!ticketArchiveProducerFilter || getTicketProducerId(ticket) === ticketArchiveProducerFilter)
                )
                const groupedArchive = groupTicketsByMonthSegmentKind(filteredTickets)

                return (
                  <>
                    <div className="ticket-section-title">
                      <div>
                        <h2 style={{ margin: 0 }}>Approved Tickets</h2>
                        <span className="ticket-muted">Monthly archive organized by segment and ticket type</span>
                      </div>
                    </div>

                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <select style={input} value={ticketArchiveMonthFilter} onChange={(e) => setTicketArchiveMonthFilter(e.target.value)}>
                        <option value="">All Months</option>
                        {monthOptions.map((month: any) => (
                          <option key={month.monthKey} value={month.monthKey}>{month.label}</option>
                        ))}
                      </select>
                      <select style={input} value={ticketArchiveSegmentFilter} onChange={(e) => { setTicketArchiveSegmentFilter(e.target.value); setTicketArchiveProducerFilter('') }}>
                        <option value="">All Segments</option>
                        {segments.map((segment: any) => (
                          <option key={segment.id} value={segment.id}>{segment.name || segment.segment_name}</option>
                        ))}
                      </select>
                      <select style={input} value={ticketArchiveProducerFilter} onChange={(e) => setTicketArchiveProducerFilter(e.target.value)}>
                        <option value="">{ticketArchiveSegmentFilter ? 'All Producers in Segment' : 'All Producers'}</option>
                        {getProducersForSegment(ticketArchiveSegmentFilter).map((producer: any) => (
                          <option key={producer.id} value={producer.id}>{producer.name || (producer as any).producer_name}</option>
                        ))}
                      </select>
                    </div>

                    {filteredTickets.length === 0 && (
                      <div style={card}>No approved tickets found for this filter.</div>
                    )}

                    {groupedArchive.map((monthGroup: any) => {
                      const monthKey = getTicketArchiveSectionKey('approved', monthGroup.monthKey)
                      const monthOpen = openTicketArchiveSections[monthKey] ?? true
                      const monthNsv = monthGroup.tickets.reduce((sum: number, ticket: any) => {
                        const calc = ticket.calculation_results || {}
                        const observed = ticket.observed_inputs || {}
                        return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                      }, 0)

                      return (
                        <div key={monthKey} style={{ ...card, marginBottom: 12 }}>
                          <button style={{ ...button, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(monthKey)}>
                            <span>{monthOpen ? '▼' : '▶'} {monthGroup.label}</span>
                            <span>{monthGroup.tickets.length} tickets • NSV {monthNsv.toFixed(2)}</span>
                          </button>

                          {monthOpen && monthGroup.segmentGroups.map((segmentGroup: any) => {
                            const segmentKey = getTicketArchiveSectionKey('approved', monthGroup.monthKey, segmentGroup.segmentId)
                            const segmentOpen = openTicketArchiveSections[segmentKey] ?? true
                            const segmentNsv = segmentGroup.tickets.reduce((sum: number, ticket: any) => {
                              const calc = ticket.calculation_results || {}
                              const observed = ticket.observed_inputs || {}
                              return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                            }, 0)

                            return (
                              <div key={segmentKey} style={{ ...card, marginTop: 10, background: 'rgba(15,23,42,0.45)' }}>
                                <button style={{ ...button, background: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(segmentKey)}>
                                  <span>{segmentOpen ? '▼' : '▶'} {segmentGroup.label}</span>
                                  <span>{segmentGroup.tickets.length} tickets • NSV {segmentNsv.toFixed(2)}</span>
                                </button>

                                {segmentOpen && segmentGroup.kindGroups.map((kindGroup: any) => {
                                  const kindKey = getTicketArchiveSectionKey('approved', monthGroup.monthKey, segmentGroup.segmentId, kindGroup.kind)
                                  const kindOpen = openTicketArchiveSections[kindKey] ?? true
                                  const kindNsv = kindGroup.tickets.reduce((sum: number, ticket: any) => {
                                    const calc = ticket.calculation_results || {}
                                    const observed = ticket.observed_inputs || {}
                                    return sum + Number(calc.nsv ?? observed.net_volume_bbl ?? 0)
                                  }, 0)

                                  return (
                                    <div key={kindKey} style={{ marginTop: 10 }}>
                                      <button style={{ ...button, background: kindGroup.kind === 'tank' ? '#92400e' : kindGroup.kind === 'line_fill' ? '#1d4ed8' : '#14532d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={() => toggleTicketArchiveSection(kindKey)}>
                                        <span>{kindOpen ? '▼' : '▶'} {kindGroup.label}</span>
                                        <span>{kindGroup.tickets.length} tickets • NSV {kindNsv.toFixed(2)}</span>
                                      </button>

                                      {kindOpen && (
                                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                                          {kindGroup.tickets.map((ticket: any) => renderTicketQueueCard(ticket, true))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
              </div>
              )}
            </div>
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
