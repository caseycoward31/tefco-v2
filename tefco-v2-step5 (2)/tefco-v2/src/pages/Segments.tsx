import type { Segment } from '../types'

export default function Segments({ segments }: { segments: Segment[] }) {
  return (
    <div>
      <Header title="Segments" subtitle="Areas/segments are configurable per company. Nothing is hardcoded." />
      <Table headers={["Segment Name", "Active", "Created"]}>
        {segments.map((segment) => (
          <tr key={segment.id} className="border-t border-slate-800">
            <td className="p-4 font-semibold">{segment.name}</td>
            <td className="p-4">{segment.active ? 'Yes' : 'No'}</td>
            <td className="p-4 text-slate-400">{new Date(segment.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-6"><h1 className="text-3xl font-bold">{title}</h1><p className="text-slate-400 mt-2">{subtitle}</p></div>
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><table className="w-full text-left"><thead className="bg-slate-800 text-slate-300"><tr>{headers.map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}
