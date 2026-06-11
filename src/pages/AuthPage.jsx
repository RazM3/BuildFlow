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
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(26,58,229,0.07) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />
        {/* Soft blue tint accent */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(26,58,229,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="relative">
          <LogoMark />
        </div>

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{ background: 'rgba(26,58,229,0.06)', border: '1px solid rgba(26,58,229,0.12)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Built for Australian Builders</span>
          </div>
          <h2 className="text-4xl font-semibold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Manage every project.<br />
            <span style={{ color: 'var(--accent-blue)' }}>Close every job.</span>
          </h2>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            Quotes, timelines, and client updates — all in one place. Designed for the way you work.
          </p>
        </div>

        <div className="relative flex items-center gap-6">
          <Stat value="2,400+" label="Projects managed" />
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <Stat value="98%" label="Builder satisfaction" />
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <Stat value="$0 setup" label="Get started free" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative"
        style={{ background: 'var(--bg-canvas)' }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="w-full max-w-sm relative">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <LogoMark />
          </div>

          {/* Card */}
          <div className="rounded-2xl px-8 py-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
            }}>

            {/* Building icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 mx-auto"
              style={{ background: 'rgba(26,58,229,0.08)', border: '1px solid rgba(26,58,229,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="9" width="14" height="8" rx="1" fill="none" stroke="#1A3AE5" strokeWidth="1.4"/>
                <rect x="5" y="5.5" width="8" height="4.5" rx="0.7" fill="none" stroke="#1A3AE5" strokeWidth="1.2"/>
                <rect x="3.5" y="12" width="3" height="3" rx="0.4" fill="#1A3AE5" fillOpacity="0.5"/>
                <rect x="12.5" y="12" width="3" height="3" rx="0.4" fill="#1A3AE5" fillOpacity="0.5"/>
                <rect x="7.5" y="12" width="3" height="5" rx="0.4" fill="#1A3AE5" fillOpacity="0.5"/>
              </svg>
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {mode === 'signin'
                  ? 'The smarter way to design and quote'
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
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm"
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
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                />
              </Field>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="mt-0.5 shrink-0" style={{ color: '#dc2626' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="10" r="0.75" fill="currentColor"/></svg>
                  </span>
                  <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)' }}>
                  <span className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <p className="text-sm" style={{ color: 'var(--success)' }}>{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-glow w-full font-semibold py-3 rounded-xl cursor-pointer text-sm mt-2 disabled:opacity-50"
                style={{
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(26,58,229,0.25)',
                }}
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {mode === 'signin' ? (
                <>
                  No account?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
                    className="font-semibold hover:underline cursor-pointer"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
                    className="font-semibold hover:underline cursor-pointer"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="font-bold text-lg leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  )
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--accent-blue)', boxShadow: '0 2px 8px rgba(26,58,229,0.3)' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="7" width="12" height="7" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="4.5" y="4" width="7" height="4" rx="0.75" fill="white"/>
          <rect x="3" y="10" width="2.5" height="2.5" rx="0.4" fill="#1A3AE5"/>
          <rect x="10.5" y="10" width="2.5" height="2.5" rx="0.4" fill="#1A3AE5"/>
          <rect x="6.75" y="10" width="2.5" height="4" rx="0.4" fill="#1A3AE5"/>
        </svg>
      </div>
      <span className="font-bold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>BuildFlow Pro</span>
    </div>
  )
}
