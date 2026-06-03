import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) alert(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Measurement Database</h1>
          <p className="text-slate-400 mt-2">Custody transfer platform</p>
        </div>
        <input className="w-full p-3 mb-4 rounded-lg bg-slate-800 border border-slate-700 outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full p-3 mb-6 rounded-lg bg-slate-800 border border-slate-700 outline-none" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={signIn} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 p-3 rounded-lg font-semibold">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  )
}
