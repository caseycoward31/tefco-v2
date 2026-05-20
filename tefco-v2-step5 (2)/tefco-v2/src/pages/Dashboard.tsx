import type { Company, Meter, Segment, Tank } from '../types'

type Props = {
  company: Company | null
  segments: Segment[]
  tanks: Tank[]
  meters: Meter[]
}

export default function Dashboard({ company, segments, tanks, meters }: Props) {
  return (
    <div>
      <div className="mb-8">
        <div className="text-sm text-blue-400 font-semibold">Live Backend Connected</div>
        <h1 className="text-4xl font-bold mt-1">{company?.name ?? 'TEFCO Measurement'}</h1>
        <p className="text-slate-400 mt-2">Multi-tenant custody transfer dashboard.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat title="Segments" value={segments.length} />
        <Stat title="Tanks" value={tanks.length} />
        <Stat title="Meters" value={meters.length} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-3">V2 Foundation Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
          <Check text="Supabase auth login working" />
          <Check text="Company-based data loading" />
          <Check text="Segments are dynamic app data" />
          <Check text="Tanks and meters ready for admin config" />
          <Check text="Calculation profiles ready for API versions" />
          <Check text="RLS tenant wall enabled" />
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className="text-4xl font-bold mt-2">{value}</div>
    </div>
  )
}

function Check({ text }: { text: string }) {
  return <div className="bg-slate-800 rounded-lg p-3">✔ {text}</div>
}
