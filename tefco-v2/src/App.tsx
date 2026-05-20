import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

type Company = { id: string; name: string }
type Segment = { id: string; name: string; active?: boolean }
type Tank = { id: string; tank_number: string; tank_name: string | null; capacity_bbl: number | null; segment_id: string | null; active?: boolean }
type Meter = { id: string; meter_number: string; meter_name: string | null; meter_type: string | null; segment_id: string | null; active?: boolean }
type Page = 'dashboard' | 'segments' | 'tanks' | 'meters'

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 18 }
const input: React.CSSProperties = { background: '#020617', color: 'white', border: '1px solid #334155', borderRadius: 8, padding: 10, width: '100%', boxSizing: 'border-box' }
const button: React.CSSProperties = { background: '#2563eb', color: 'white', border: 0, borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }
const dangerButton: React.CSSProperties = { ...button, background: '#991b1b' }
const mutedButton: React.CSSProperties = { ...button, background: '#1e293b' }

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState<Page>('dashboard')
  const [company, setCompany] = useState<Company | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [tanks, setTanks] = useState<Tank[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [message, setMessage] = useState('')

  const [segmentName, setSegmentName] = useState('')
  const [tankNumber, setTankNumber] = useState('')
  const [tankName, setTankName] = useState('')
  const [tankCapacity, setTankCapacity] = useState('')
  const [tankSegmentId, setTankSegmentId] = useState('')
  const [meterNumber, setMeterNumber] = useState('')
  const [meterName, setMeterName] = useState('')
  const [meterType, setMeterType] = useState('')
  const [meterSegmentId, setMeterSegmentId] = useState('')

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

  const segmentNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of segments) map[s.id] = s.name
    return map
  }, [segments])

  async function loadAll() {
    setBusy(true)
    setMessage('')
    try {
      const [companiesRes, segmentsRes, tanksRes, metersRes] = await Promise.all([
        supabase.from('companies').select('id,name').limit(1).single(),
        supabase.from('segments').select('id,name,active').order('name'),
        supabase.from('tanks').select('id,tank_number,tank_name,capacity_bbl,segment_id,active').order('tank_number'),
        supabase.from('meters').select('id,meter_number,meter_name,meter_type,segment_id,active').order('meter_number'),
      ])

      if (companiesRes.error) throw companiesRes.error
      if (segmentsRes.error) throw segmentsRes.error
      if (tanksRes.error) throw tanksRes.error
      if (metersRes.error) throw metersRes.error

      setCompany(companiesRes.data)
      setSegments(segmentsRes.data || [])
      setTanks(tanksRes.data || [])
      setMeters(metersRes.data || [])
    } catch (err: any) {
      setMessage(err.message || 'Could not load data')
    } finally {
      setBusy(false)
    }
  }

  async function addSegment() {
    if (!company || !segmentName.trim()) return
    setBusy(true)
    const { error } = await supabase.from('segments').insert({ company_id: company.id, name: segmentName.trim(), active: true })
    setBusy(false)
    if (error) return setMessage(error.message)
    setSegmentName('')
    await loadAll()
  }

  async function editSegment(row: Segment) {
    const name = window.prompt('Segment name', row.name)
    if (!name || !name.trim()) return
    const { error } = await supabase.from('segments').update({ name: name.trim() }).eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function deleteSegment(row: Segment) {
    if (!window.confirm(`Delete segment ${row.name}? Only do this if no tanks/meters use it.`)) return
    const { error } = await supabase.from('segments').delete().eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function addTank() {
    if (!company || !tankNumber.trim()) return
    setBusy(true)
    const { error } = await supabase.from('tanks').insert({
      company_id: company.id,
      segment_id: tankSegmentId || null,
      tank_number: tankNumber.trim(),
      tank_name: tankName.trim() || null,
      capacity_bbl: tankCapacity ? Number(tankCapacity) : null,
      active: true,
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    setTankNumber(''); setTankName(''); setTankCapacity(''); setTankSegmentId('')
    await loadAll()
  }

  async function editTank(row: Tank) {
    const tank_number = window.prompt('Tank number', row.tank_number)
    if (!tank_number || !tank_number.trim()) return
    const tank_name = window.prompt('Tank name', row.tank_name || '')
    const capacity = window.prompt('Capacity BBL', row.capacity_bbl?.toString() || '')
    const { error } = await supabase.from('tanks').update({
      tank_number: tank_number.trim(),
      tank_name: tank_name?.trim() || null,
      capacity_bbl: capacity ? Number(capacity) : null,
    }).eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function deleteTank(row: Tank) {
    if (!window.confirm(`Delete tank ${row.tank_number}?`)) return
    const { error } = await supabase.from('tanks').delete().eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function addMeter() {
    if (!company || !meterNumber.trim()) return
    setBusy(true)
    const { error } = await supabase.from('meters').insert({
      company_id: company.id,
      segment_id: meterSegmentId || null,
      meter_number: meterNumber.trim(),
      meter_name: meterName.trim() || null,
      meter_type: meterType.trim() || null,
      active: true,
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    setMeterNumber(''); setMeterName(''); setMeterType(''); setMeterSegmentId('')
    await loadAll()
  }

  async function editMeter(row: Meter) {
    const meter_number = window.prompt('Meter number', row.meter_number)
    if (!meter_number || !meter_number.trim()) return
    const meter_name = window.prompt('Meter name', row.meter_name || '')
    const meter_type = window.prompt('Meter type', row.meter_type || '')
    const { error } = await supabase.from('meters').update({
      meter_number: meter_number.trim(),
      meter_name: meter_name?.trim() || null,
      meter_type: meter_type?.trim() || null,
    }).eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function deleteMeter(row: Meter) {
    if (!window.confirm(`Delete meter ${row.meter_number}?`)) return
    const { error } = await supabase.from('meters').delete().eq('id', row.id)
    if (error) return setMessage(error.message)
    await loadAll()
  }

  async function logout() { await supabase.auth.signOut() }

  if (loading) return <div style={{ padding: 40, color: 'white', background: '#020617', minHeight: '100vh' }}>Loading...</div>
  if (!session) return <Login />

  return (
    <div style={{ background: '#020617', color: 'white', minHeight: '100vh', display: 'flex', fontFamily: 'Arial, sans-serif' }}>
      <aside style={{ width: 245, background: '#0f172a', padding: 18, borderRight: '1px solid #1e293b' }}>
        <h2 style={{ margin: 0 }}>TEFCO V2</h2>
        <p style={{ color: '#94a3b8', marginTop: 6 }}>{company?.name || 'Measurement'}</p>
        {(['dashboard', 'segments', 'tanks', 'meters'] as Page[]).map((p) => (
          <button key={p} onClick={() => setPage(p)} style={{ ...mutedButton, background: page === p ? '#2563eb' : '#1e293b', width: '100%', marginTop: 10, textAlign: 'left' }}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
        <button onClick={logout} style={{ ...mutedButton, width: '100%', marginTop: 30 }}>Logout</button>
      </aside>

      <main style={{ flex: 1, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{page[0].toUpperCase() + page.slice(1)}</h1>
            <p style={{ color: '#94a3b8' }}>{busy ? 'Working...' : 'Live Supabase data. Admin controls ready.'}</p>
          </div>
          <button onClick={loadAll} style={button}>Refresh</button>
        </div>

        {message && <div style={{ ...card, borderColor: '#991b1b', marginTop: 16, color: '#fecaca' }}>{message}</div>}

        {page === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
            <div style={card}><div style={{ color: '#94a3b8' }}>Segments</div><h1>{segments.length}</h1></div>
            <div style={card}><div style={{ color: '#94a3b8' }}>Tanks</div><h1>{tanks.length}</h1></div>
            <div style={card}><div style={{ color: '#94a3b8' }}>Meters</div><h1>{meters.length}</h1></div>
          </div>
        )}

        {page === 'segments' && (
          <section style={{ marginTop: 20 }}>
            <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <input style={input} placeholder="New segment name" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
              <button style={button} onClick={addSegment}>Add Segment</button>
            </div>
            <DataTable headers={['Segment', 'Active', 'Actions']} rows={segments.map(s => [s.name, s.active ? 'Yes' : 'No', <Actions onEdit={() => editSegment(s)} onDelete={() => deleteSegment(s)} />])} />
          </section>
        )}

        {page === 'tanks' && (
          <section style={{ marginTop: 20 }}>
            <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10 }}>
              <input style={input} placeholder="Tank #" value={tankNumber} onChange={(e) => setTankNumber(e.target.value)} />
              <input style={input} placeholder="Tank name" value={tankName} onChange={(e) => setTankName(e.target.value)} />
              <input style={input} placeholder="Capacity BBL" value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} />
              <select style={input} value={tankSegmentId} onChange={(e) => setTankSegmentId(e.target.value)}>
                <option value="">Select segment</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button style={button} onClick={addTank}>Add Tank</button>
            </div>
            <DataTable headers={['Tank #', 'Name', 'Segment', 'Capacity', 'Actions']} rows={tanks.map(t => [t.tank_number, t.tank_name || '', t.segment_id ? segmentNameById[t.segment_id] : '', t.capacity_bbl || '', <Actions onEdit={() => editTank(t)} onDelete={() => deleteTank(t)} />])} />
          </section>
        )}

        {page === 'meters' && (
          <section style={{ marginTop: 20 }}>
            <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10 }}>
              <input style={input} placeholder="Meter #" value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} />
              <input style={input} placeholder="Meter name" value={meterName} onChange={(e) => setMeterName(e.target.value)} />
              <input style={input} placeholder="Meter type" value={meterType} onChange={(e) => setMeterType(e.target.value)} />
              <select style={input} value={meterSegmentId} onChange={(e) => setMeterSegmentId(e.target.value)}>
                <option value="">Select segment</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button style={button} onClick={addMeter}>Add Meter</button>
            </div>
            <DataTable headers={['Meter #', 'Name', 'Type', 'Segment', 'Actions']} rows={meters.map(m => [m.meter_number, m.meter_name || '', m.meter_type || '', m.segment_id ? segmentNameById[m.segment_id] : '', <Actions onEdit={() => editMeter(m)} onDelete={() => deleteMeter(m)} />])} />
          </section>
        )}
      </main>
    </div>
  )
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div style={{ display: 'flex', gap: 8 }}><button style={mutedButton} onClick={onEdit}>Edit</button><button style={dangerButton} onClick={onDelete}>Delete</button></div>
}

function DataTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ marginTop: 16, overflow: 'auto', border: '1px solid #1e293b', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0f172a', color: '#94a3b8' }}><tr>{headers.map(h => <th key={h} style={{ textAlign: 'left', padding: 12 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={headers.length} style={{ padding: 16, color: '#94a3b8' }}>No records yet.</td></tr> : rows.map((r, i) => <tr key={i} style={{ borderTop: '1px solid #1e293b' }}>{r.map((c, j) => <td key={j} style={{ padding: 12 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
