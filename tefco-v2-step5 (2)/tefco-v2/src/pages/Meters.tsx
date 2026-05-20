import type { Meter, Segment } from '../types'

export default function Meters({ meters, segments }: { meters: Meter[]; segments: Segment[] }) {
  const segmentName = (id: string | null) => segments.find((s) => s.id === id)?.name ?? 'Unassigned'

  return (
    <div>
      <div className="mb-6"><h1 className="text-3xl font-bold">Meters</h1><p className="text-slate-400 mt-2">Meters are dynamic company data and can be tied to segments.</p></div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800 text-slate-300"><tr><th className="p-4">Meter #</th><th className="p-4">Name</th><th className="p-4">Type</th><th className="p-4">Segment</th><th className="p-4">Active</th></tr></thead>
          <tbody>
            {meters.length === 0 ? <tr><td className="p-4 text-slate-400" colSpan={5}>No meters added yet.</td></tr> : meters.map((meter) => <tr key={meter.id} className="border-t border-slate-800"><td className="p-4 font-semibold">{meter.meter_number}</td><td className="p-4">{meter.meter_name ?? '-'}</td><td className="p-4">{meter.meter_type ?? '-'}</td><td className="p-4">{segmentName(meter.segment_id)}</td><td className="p-4">{meter.active ? 'Yes' : 'No'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
