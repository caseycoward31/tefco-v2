export type Company = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export type Segment = {
  id: string
  name: string
  active: boolean
  created_at: string
}

export type Tank = {
  id: string
  tank_number: string
  tank_name: string | null
  capacity_bbl: number | null
  active: boolean
  segment_id: string | null
}

export type Meter = {
  id: string
  meter_number: string
  meter_name: string | null
  meter_type: string | null
  active: boolean
  segment_id: string | null
}
