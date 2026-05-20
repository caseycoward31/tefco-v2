import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Segment = { id: string; name: string; active: boolean }
type Tank = { id: string; tank_number: string; tank_name: string | null; capacity_bbl: number | null; active: boolean; segment_id: string | null }
type Meter = { id: string; meter_number: string; meter_name: string | null; meter_type: string | null; active: boolean; segment_id: string | null }
type Company = { id: string; name: string; slug: string }
type Tab = 'dashboard' | 'segments' | 'tanks' | 'meters'

const emptyTank = { tank_number: '', tank_name: '', capacity_bbl: '', segment_id: '' }
const emptyMeter = { meter_number: '', meter_name: '', meter_type: '', segment_id: '' }

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [company, setCompany] = useState<Company | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [newSegment, setNewSegment] = useState('')
  const [tankForm, setTankForm] = useState(emptyTank)
  const [meterForm, setMeterForm] = useState(emptyMeter)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) loadEverything()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadEverything()
      else clearData()
    })

    return () => subscription.unsubscribe()
  }, [])

  const segmentNameById = useMemo(() => {
    const map: Record<string, string> = {}
    segments.forEach((s) => { map[s.id] = s.name })
    return map
  }, [segments])

  function clearData() {
    setCompany(null)
    setSegments([])
    setTanks([])
    setMeters([])
  }

  async function loadEverything() {
    setBusy(true)
    const { data: companies } = await supabase.from('companies').select('*').limit(1)
    if (companies?.[0]) setCompany(companies[0])
    const [{ data: seg }, { data: tank }, { data: meter }] = await Promise.all([
      supabase.from('segments').select('*').order('name'),
      supabase.from('tanks').select('*').order('tank_number'),
      supabase.from('meters').select('*').order('meter_number'),
    ])
    setSegments(seg || [])
    setTanks(tank || [])
    setMeters(meter || [])
    setBusy(false)
  }

  async function getCompanyId() {
    if (company?.id) return company.id
    const { data, error } = await supabase.from('companies').select('id').limit(1).single()
    if (error || !data) throw new Error('No company found for this user.')
    setCompany(data as Company)
    return data.id
  }

  async function addSegment() {
    if (!newSegment.trim()) return
    try {
      const company_id = await getCompanyId()
      const { error } = await supabase.from('segments').insert({ company_id, name: newSegment.trim(), active: true })
      if (error) throw error
      setNewSegment('')
      await loadEverything()
    } catch (err: any) { alert(err.message) }
  }

  async function addTank() {
    if (!tankForm.tank_number.trim()) return alert('Tank number is required')
    try {
      const company_id = await getCompanyId()
      const payload = {
        company_id,
        tank_number: tankForm.tank_number.trim(),
        tank_name: tankForm.tank_name.trim() || null,
        capacity_bbl: tankForm.capacity_bbl ? Number(tankForm.capacity_bbl) : null,
        segment_id: tankForm.segment_id || null,
        active: true,
      }
      const { error } = await supabase.from('tanks').insert(payload)
      if (error) throw error
      setTankForm(emptyTank)
      await loadEverything()
    } catch (err: any) { alert(err.message) }
  }

  async function addMeter() {
    if (!meterForm.meter_number.trim()) return alert('Meter number is required')
    try {
      const company_id = await getCompanyId()
      const payload = {
        company_id,
        meter_number: meterForm.meter_number.trim(),
        meter_name: meterForm.meter_name.trim() || null,
        meter_type: meterForm.meter_type.trim() || null,
        segment_id: meterForm.segment_id || null,
        active: true,
      }
      const { error } = await supabase.from('meters').insert(payload)
      if (error) throw error
      setMeterForm(emptyMeter)
      await loadEverything()
    } catch (err: any) { alert(err.message) }
  }

  async function toggleActive(table: 'segments' | 'tanks' | 'meters', id: string, active: boolean) {
    const { error } = await supabase.from(table).update({ active: !active }).eq('id', id)
    if (error) alert(error.message)
    await loadEverything()
  }

  async function removeRow(table: 'segments' | 'tanks' | 'meters', id: string) {
    if (!confirm('Delete this record?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert(error.message)
    await loadEverything()
  }

  async function logout() { await supabase.auth.signOut() }

  if (loading) return <Screen>Loading...</Screen>
  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-5 hidden md:block">
        <h1 className="text-xl font-bold">TEFCO V2</h1>
        <p className="text-sm text-slate-400 mt-1">{company?.name || 'Measurement'}</p>
        <nav className="mt-8 space-y-2">
          <NavButton label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
          <NavButton label="Segments" active={tab === 'segments'} onClick={() => setTab('segments')} />
          <NavButton label="Tanks" active={tab === 'tanks'} onClick={() => setTab('tanks')} />
          <NavButton label="Meters" active={tab === 'meters'} onClick={() => setTab('meters')} />
        </nav>
        <button onClick={logout} className="mt-8 w-full bg-slate-800 hover:bg-slate-700 rounded-lg p-3">Logout</button>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="md:hidden mb-4 grid grid-cols-2 gap-2">
          <NavButton label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
          <NavButton label="Segments" active={tab === 'segments'} onClick={() => setTab('segments')} />
          <NavButton label="Tanks" active={tab === 'tanks'} onClick={() => setTab('tanks')} />
          <NavButton label="Meters" active={tab === 'meters'} onClick={() => setTab('meters')} />
        </div>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-3xl font-bold">{title(tab)}</h2>
            <p className="text-slate-400 mt-1">Live Supabase data. {busy ? 'Refreshing...' : 'Ready.'}</p>
          </div>
          <button onClick={loadEverything} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2">Refresh</button>
        </div>

        {tab === 'dashboard' && <Dashboard segments={segments} tanks={tanks} meters={meters} />}
        {tab === 'segments' && (
          <Section>
            <FormRow>
              <Input placeholder="New segment name" value={newSegment} onChange={setNewSegment} />
              <button onClick={addSegment} className="btn-primary">Add Segment</button>
            </FormRow>
            {segments.map((s) => <Card key={s.id}><b>{s.name}</b><Actions active={s.active} onToggle={() => toggleActive('segments', s.id, s.active)} onDelete={() => removeRow('segments', s.id)} /></Card>)}
          </Section>
        )}
        {tab === 'tanks' && (
          <Section>
            <div className="grid md:grid-cols-5 gap-3">
              <Input placeholder="Tank #" value={tankForm.tank_number} onChange={(v) => setTankForm({ ...tankForm, tank_number: v })} />
              <Input placeholder="Tank name" value={tankForm.tank_name} onChange={(v) => setTankForm({ ...tankForm, tank_name: v })} />
              <Input placeholder="Capacity bbl" value={tankForm.capacity_bbl} onChange={(v) => setTankForm({ ...tankForm, capacity_bbl: v })} />
              <Select value={tankForm.segment_id} onChange={(v) => setTankForm({ ...tankForm, segment_id: v })} segments={segments} />
              <button onClick={addTank} className="btn-primary">Add Tank</button>
            </div>
            {tanks.map((t) => <Card key={t.id}><div><b>Tank {t.tank_number}</b><p className="text-slate-400">{t.tank_name || 'No name'} • {segmentNameById[t.segment_id || ''] || 'No segment'} • {t.capacity_bbl || '-'} bbl</p></div><Actions active={t.active} onToggle={() => toggleActive('tanks', t.id, t.active)} onDelete={() => removeRow('tanks', t.id)} /></Card>)}
          </Section>
        )}
        {tab === 'meters' && (
          <Section>
            <div className="grid md:grid-cols-5 gap-3">
              <Input placeholder="Meter #" value={meterForm.meter_number} onChange={(v) => setMeterForm({ ...meterForm, meter_number: v })} />
              <Input placeholder="Meter name" value={meterForm.meter_name} onChange={(v) => setMeterForm({ ...meterForm, meter_name: v })} />
              <Input placeholder="Meter type" value={meterForm.meter_type} onChange={(v) => setMeterForm({ ...meterForm, meter_type: v })} />
              <Select value={meterForm.segment_id} onChange={(v) => setMeterForm({ ...meterForm, segment_id: v })} segments={segments} />
              <button onClick={addMeter} className="btn-primary">Add Meter</button>
            </div>
            {meters.map((m) => <Card key={m.id}><div><b>Meter {m.meter_number}</b><p className="text-slate-400">{m.meter_name || 'No name'} • {m.meter_type || 'No type'} • {segmentNameById[m.segment_id || ''] || 'No segment'}</p></div><Actions active={m.active} onToggle={() => toggleActive('meters', m.id, m.active)} onDelete={() => removeRow('meters', m.id)} /></Card>)}
          </Section>
        )}
      </main>
    </div>
  )
}

function title(tab: Tab) { return tab === 'dashboard' ? 'Dashboard' : tab[0].toUpperCase() + tab.slice(1) }
function Screen({ children }: { children: any }) { return <div className="min-h-screen bg-slate-950 text-white p-10">{children}</div> }
function Section({ children }: { children: any }) { return <div className="mt-8 space-y-4">{children}</div> }
function FormRow({ children }: { children: any }) { return <div className="grid md:grid-cols-[1fr_auto] gap-3">{children}</div> }
function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={`w-full text-left rounded-lg p-3 ${active ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{label}</button> }
function Input({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) { return <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /> }
function Select({ value, onChange, segments }: { value: string; onChange: (v: string) => void; segments: Segment[] }) { return <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select segment</option>{segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select> }
function Card({ children }: { children: any }) { return <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center gap-4">{children}</div> }
function Actions({ active, onToggle, onDelete }: { active: boolean; onToggle: () => void; onDelete: () => void }) { return <div className="flex gap-2"><button onClick={onToggle} className="bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2">{active ? 'Active' : 'Inactive'}</button><button onClick={onDelete} className="bg-red-900/70 hover:bg-red-800 rounded-lg px-3 py-2">Delete</button></div> }
function Dashboard({ segments, tanks, meters }: { segments: Segment[]; tanks: Tank[]; meters: Meter[] }) { return <div className="grid md:grid-cols-3 gap-4 mt-8"><Stat label="Segments" value={segments.length} /><Stat label="Tanks" value={tanks.length} /><Stat label="Meters" value={meters.length} /></div> }
function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-slate-900 border border-slate-800 rounded-xl p-6"><p className="text-slate-400">{label}</p><h3 className="text-4xl font-bold mt-2">{value}</h3></div> }
