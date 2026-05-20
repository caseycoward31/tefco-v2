import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Company, Meter, Segment, Tank } from './types'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Segments from './pages/Segments'
import Tanks from './pages/Tanks'
import Meters from './pages/Meters'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePage, setActivePage] = useState('Dashboard')
  const [company, setCompany] = useState<Company | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadCompanyData()
  }, [session?.user?.id])

  const loadCompanyData = async () => {
    setLoading(true)
    setError('')

    const { data: membership, error: membershipError } = await supabase
      .from('company_users')
      .select('company_id, role, companies(id, name, slug, logo_url)')
      .eq('user_id', session?.user.id)
      .eq('active', true)
      .limit(1)
      .single()

    if (membershipError || !membership) {
      setError('Login worked, but this user is not linked to a company yet. Add this user to company_users in Supabase.')
      setLoading(false)
      return
    }

    const companyRecord = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies
    setCompany(companyRecord as Company)

    const companyId = membership.company_id

    const [segmentsResult, tanksResult, metersResult] = await Promise.all([
      supabase.from('segments').select('id, name, active, created_at').eq('company_id', companyId).order('name'),
      supabase.from('tanks').select('id, tank_number, tank_name, capacity_bbl, active, segment_id').eq('company_id', companyId).order('tank_number'),
      supabase.from('meters').select('id, meter_number, meter_name, meter_type, active, segment_id').eq('company_id', companyId).order('meter_number'),
    ])

    if (segmentsResult.error) setError(segmentsResult.error.message)
    if (tanksResult.error) setError(tanksResult.error.message)
    if (metersResult.error) setError(metersResult.error.message)

    setSegments((segmentsResult.data ?? []) as Segment[])
    setTanks((tanksResult.data ?? []) as Tank[])
    setMeters((metersResult.data ?? []) as Meter[])
    setLoading(false)
  }

  if (loading && !session) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading TEFCO V2...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout company={company} activePage={activePage} setActivePage={setActivePage}>
      {error && <div className="mb-4 bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-200">{error}</div>}
      {loading && <div className="mb-4 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-300">Loading company data...</div>}

      {activePage === 'Dashboard' && <Dashboard company={company} segments={segments} tanks={tanks} meters={meters} />}
      {activePage === 'Segments' && <Segments segments={segments} />}
      {activePage === 'Tanks' && <Tanks tanks={tanks} segments={segments} />}
      {activePage === 'Meters' && <Meters meters={meters} segments={segments} />}
      {activePage === 'Tickets' && <Placeholder title="Tickets" text="Next step: draft/submitted/approved ticket workflow with calculation snapshots." />}
      {activePage === 'Admin Config' && <Placeholder title="Admin Configuration" text="Next step: add/edit screens for company segments, tanks, meters, products, contracts, profiles, logos, and themes." />}
    </Layout>
  )
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-slate-400 mb-6">{text}</p>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">Coming in the next V2 build step.</div>
    </div>
  )
}
