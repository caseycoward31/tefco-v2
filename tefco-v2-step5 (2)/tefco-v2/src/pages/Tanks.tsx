import type { Segment, Tank } from '../types'

export default function Tanks({ tanks, segments }: { tanks: Tank[]; segments: Segment[] }) {
  const segmentName = (id: string | null) => segments.find((s) => s.id === id)?.name ?? 'Unassigned'

  return (
    <div>
      <div className="mb-6"><h1 className="text-3xl font-bold">Tanks</h1><p className="text-slate-400 mt-2">Tanks will be assigned to selected segments from the app.</p></div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800 text-slate-300"><tr><th className="p-4">Tank #</th><th className="p-4">Name</th><th className="p-4">Segment</th><th className="p-4">Capacity</th><th className="p-4">Active</th></tr></thead>
          <tbody>
            {tanks.length === 0 ? <tr><td className="p-4 text-slate-400" colSpan={5}>No tanks added yet.</td></tr> : tanks.map((tank) => <tr key={tank.id} className="border-t border-slate-800"><td className="p-4 font-semibold">{tank.tank_number}</td><td className="p-4">{tank.tank_name ?? '-'}</td><td className="p-4">{segmentName(tank.segment_id)}</td><td className="p-4">{tank.capacity_bbl ?? '-'}</td><td className="p-4">{tank.active ? 'Yes' : 'No'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
