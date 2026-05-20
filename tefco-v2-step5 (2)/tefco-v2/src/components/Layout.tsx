import { supabase } from '../lib/supabase'
import type { Company } from '../types'

type LayoutProps = {
  company: Company | null
  activePage: string
  setActivePage: (page: string) => void
  children: React.ReactNode
}

const pages = [
  'Dashboard',
  'Segments',
  'Tanks',
  'Meters',
  'Tickets',
  'Admin Config',
]

export default function Layout({ company, activePage, setActivePage, children }: LayoutProps) {
  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="w-72 bg-slate-900 border-r border-slate-800 p-5 hidden md:flex md:flex-col">
        <div className="mb-8">
          <div className="text-2xl font-bold">TEFCO</div>
          <div className="text-sm text-slate-400">Measurement V2</div>
          <div className="mt-4 rounded-lg bg-slate-800 p-3 text-sm">
            <div className="text-slate-400">Company</div>
            <div className="font-semibold">{company?.name ?? 'Loading...'}</div>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`w-full text-left px-4 py-3 rounded-lg transition ${
                activePage === page ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          ))}
        </nav>

        <button onClick={logout} className="w-full bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg">
          Logout
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="md:hidden mb-4 flex justify-between items-center">
          <div>
            <div className="text-xl font-bold">TEFCO V2</div>
            <div className="text-xs text-slate-400">{company?.name ?? 'Loading company...'}</div>
          </div>
          <button onClick={logout} className="bg-red-600 px-3 py-2 rounded-lg text-sm">Logout</button>
        </div>
        {children}
      </main>
    </div>
  )
}
