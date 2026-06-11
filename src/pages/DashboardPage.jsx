import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_META = {
  'In Progress': { dot: 'bg-amber-400',   pill: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#b45309' } },
  'Quote Sent':  { dot: 'bg-blue-500',    pill: { background: 'rgba(26,58,229,0.07)',  border: '1px solid rgba(26,58,229,0.18)',  color: '#1A3AE5' } },
  'Completed':   { dot: 'bg-emerald-500', pill: { background: 'rgba(5,150,105,0.07)',  border: '1px solid rgba(5,150,105,0.18)',  color: '#059669' } },
  'Draft':       { dot: 'bg-gray-300',    pill: { background: 'rgba(0,0,0,0.04)',      border: '1px solid rgba(0,0,0,0.1)',       color: '#9BA3AF' } },
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [user,     setUser]     = useState(null)
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('id, client_name, address, status, updated_at')
      .order('updated_at', { ascending: false })
    if (!error && data) setProjects(data)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Builder'

  const counts = {
    total:      projects.length,
    inProgress: projects.filter(p => p.status === 'In Progress').length,
    quoteSent:  projects.filter(p => p.status === 'Quote Sent').length,
    completed:  projects.filter(p => p.status === 'Completed').length,
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Nav */}
      <nav className="px-8 h-14 flex items-center justify-between sticky top-0 z-10"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-8">
          <LogoMark />
          <div className="hidden md:flex items-center gap-1">
            <NavLink active>Projects</NavLink>
            <NavLink>Quotes</NavLink>
            <NavLink>Clients</NavLink>
            <NavLink>Schedule</NavLink>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg transition cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,0,0,0.05)'; e.currentTarget.style.color='var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color='var(--text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
            style={{ background: 'var(--accent-blue)' }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleSignOut} className="text-xs transition cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-tertiary)'}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4 fade-up">
          <div>
            <h1 className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Good morning, {firstName}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Here's your project overview for today.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-glow flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
            style={{ background: 'var(--accent-blue)', boxShadow: '0 2px 8px rgba(26,58,229,0.25)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            New Project
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Projects',  value: counts.total,      icon: <GridIcon />,  accentBg: 'rgba(26,58,229,0.07)',   accentColor: '#1A3AE5',  delay: '0ms'   },
            { label: 'In Progress',     value: counts.inProgress, icon: <ClockIcon />, accentBg: 'rgba(245,158,11,0.08)',  accentColor: '#b45309',  delay: '50ms'  },
            { label: 'Quotes Out',      value: counts.quoteSent,  icon: <DocIcon />,   accentBg: 'rgba(108,99,255,0.08)',  accentColor: '#5b52d6',  delay: '100ms' },
            { label: 'Completed',       value: counts.completed,  icon: <CheckIcon />, accentBg: 'rgba(5,150,105,0.07)',   accentColor: '#059669',  delay: '150ms' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl px-5 py-4 fade-up"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                animationDelay: s.delay,
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                style={{ background: s.accentBg, color: s.accentColor }}>
                {s.icon}
              </div>
              <div className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div className="rounded-2xl overflow-hidden fade-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animationDelay: '200ms' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>All Projects</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-tertiary)' }}>{projects.length}</span>
            </div>
            <button className="text-xs border rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5"
              style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='#C0C4CC' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--text-tertiary)'; e.currentTarget.style.borderColor='var(--border)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Filter
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
                <th className="text-left px-6 py-3 font-medium">Client</th>
                <th className="text-left px-6 py-3 font-medium hidden md:table-cell">Address</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium hidden sm:table-cell">Updated</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-6 py-4"><div className="h-3 rounded skeleton w-40" /></td>
                      <td className="px-6 py-4 hidden md:table-cell"><div className="h-3 rounded skeleton w-56" /></td>
                      <td className="px-6 py-4"><div className="h-5 rounded-full skeleton w-20" /></td>
                      <td className="px-6 py-4 hidden sm:table-cell"><div className="h-3 rounded skeleton w-14" /></td>
                      <td className="px-6 py-4" />
                    </tr>
                  ))}
                </>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="px-6 py-20 text-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(0,0,0,0.04)' }}>
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="8" width="16" height="11" rx="1.5" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"/><rect x="7" y="5" width="8" height="5" rx="1" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"/></svg>
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>No projects yet</p>
                      <p className="text-xs mt-1" style={{ color: '#C5CAD1' }}>Create your first project to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <tr
                    key={p.id}
                    className="group cursor-pointer"
                    style={{ borderBottom: i !== projects.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.client_name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>{p.address}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-xs hidden sm:table-cell" style={{ color: 'var(--text-tertiary)' }}>
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="opacity-0 group-hover:opacity-100 text-xs font-semibold transition-opacity"
                        style={{ color: 'var(--accent-blue)' }}>
                        Open →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && projects.length > 0 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Showing {projects.length} project{projects.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (fields) => {
            const { data } = await supabase
              .from('projects')
              .insert({ ...fields, floor_plan: [] })
              .select()
              .single()
            setShowCreate(false)
            navigate(data?.id ? `/project/${data.id}` : '/project/new', { state: fields })
          }}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--bg-primary), transparent)' }} />
    </div>
  )
}

function CreateProjectModal({ onClose, onCreate }) {
  const [clientName, setClientName] = useState('')
  const [address,    setAddress]    = useState('')
  const [status,     setStatus]     = useState('Draft')
  const [saving,     setSaving]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clientName.trim()) return
    setSaving(true)
    await onCreate({ client_name: clientName.trim(), address: address.trim(), status })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-2xl w-full max-w-md modal-enter"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>New Project</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Enter the client details to get started</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,0,0,0.06)'; e.currentTarget.style.color='var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color='var(--text-tertiary)' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}>Client Name *</label>
            <input
              type="text" value={clientName} onChange={e => setClientName(e.target.value)}
              required placeholder="e.g. Sarah & Mike Thornton"
              autoFocus
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}>Address</label>
            <input
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 14 Riverview Rd, Claremont WA 6010"
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}>Status</label>
            <select
              value={status} onChange={e => setStatus(e.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm cursor-pointer"
              style={{ appearance: 'auto' }}
            >
              <option>Draft</option>
              <option>Quote Sent</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
          <button
            type="submit" disabled={saving || !clientName.trim()}
            className="btn-glow w-full text-white font-semibold py-3 rounded-xl cursor-pointer text-sm mt-2 disabled:opacity-50"
            style={{ background: 'var(--accent-blue)', boxShadow: '0 2px 8px rgba(26,58,229,0.2)' }}
          >
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META['Draft']
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={meta.pill}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  )
}

function NavLink({ children, active }) {
  return (
    <button className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer`}
      style={active
        ? { color: 'var(--text-primary)', background: 'rgba(26,58,229,0.08)' }
        : { color: 'var(--text-tertiary)' }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='rgba(0,0,0,0.04)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color='var(--text-tertiary)'; e.currentTarget.style.background='' } }}>
      {children}
    </button>
  )
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--accent-blue)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="6" width="10" height="6" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="3.5" y="3.5" width="7" height="3.5" rx="0.75" fill="white" fillOpacity="0.7"/>
          <rect x="2.5" y="8.5" width="2.5" height="2.5" rx="0.4" fill="#1A3AE5"/>
          <rect x="9" y="8.5" width="2.5" height="2.5" rx="0.4" fill="#1A3AE5"/>
          <rect x="5.75" y="8.5" width="2.5" height="3.5" rx="0.4" fill="#1A3AE5"/>
        </svg>
      </div>
      <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>BuildFlow Pro</span>
    </div>
  )
}

const GridIcon  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const DocIcon   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="1.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
