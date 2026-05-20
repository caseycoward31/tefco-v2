import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) alert(error.message)
    else window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">TEFCO Measurement V2</h1>
          <p className="text-slate-400 mt-2">Custody Transfer Measurement Platform</p>
        </div>

        <label className="text-sm text-slate-300">Email</label>
        <input className="w-full p-3 mb-4 mt-1 rounded bg-slate-800 border border-slate-700" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="text-sm text-slate-300">Password</label>
        <input type="password" className="w-full p-3 mb-6 mt-1 rounded bg-slate-800 border border-slate-700" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') signIn() }} />

        <button onClick={signIn} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 p-3 rounded font-semibold">
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </div>
    </div>
  )
}
