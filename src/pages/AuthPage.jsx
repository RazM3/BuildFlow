import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0a1628] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

        <div className="relative">
          <LogoMark />
        </div>

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span className="text-white/70 text-xs font-medium tracking-wide">Built for Australian Builders</span>
          </div>
          <h2 className="text-white text-4xl font-bold leading-tight tracking-tight">
            Manage every project.<br />
            <span className="text-blue-400">Close every job.</span>
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm">
            Quotes, timelines, and client updates — all in one place. Designed for the way you work.
          </p>
        </div>

        <div className="relative flex items-center gap-6">
          <Stat value="2,400+" label="Projects managed" />
          <div className="w-px h-8 bg-white/10" />
          <Stat value="98%" label="Builder satisfaction" />
          <div className="w-px h-8 bg-white/10" />
          <Stat value="$0 setup" label="Get started free" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <LogoMark />
          </div>

          <div className="mb-8">
            <h1 className="text-[#0a1628] text-2xl font-bold tracking-tight mb-1">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === 'signin'
                ? 'Sign in to your BuildFlow workspace'
                : 'Start managing your projects today'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Smith"
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className={inputCls}
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputCls}
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <span className="text-red-400 mt-0.5 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="10" r="0.75" fill="currentColor"/></svg>
                </span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            {message && (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <span className="text-emerald-500 mt-0.5 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <p className="text-emerald-700 text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0a1628] hover:bg-[#152238] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer text-sm mt-2 shadow-[0_4px_20px_rgba(10,22,40,0.25)]"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
                  className="text-[#0a1628] font-semibold hover:underline cursor-pointer"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
                  className="text-[#0a1628] font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50 outline-none placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-[#0a1628]/10 focus:border-[#0a1628]/30 transition-all'

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-white font-bold text-lg leading-none">{value}</div>
      <div className="text-white/40 text-xs mt-1">{label}</div>
    </div>
  )
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="7" width="12" height="7" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="4.5" y="4" width="7" height="4" rx="0.75" fill="white"/>
          <rect x="3" y="10" width="2.5" height="2.5" rx="0.4" fill="#3b82f6"/>
          <rect x="10.5" y="10" width="2.5" height="2.5" rx="0.4" fill="#3b82f6"/>
          <rect x="6.75" y="10" width="2.5" height="4" rx="0.4" fill="#3b82f6"/>
        </svg>
      </div>
      <span className="text-white font-bold text-base tracking-tight">BuildFlow Pro</span>
    </div>
  )
}
