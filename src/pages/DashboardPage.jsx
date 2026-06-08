import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_META = {
  'In Progress': { dot: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 border-amber-100' },
  'Quote Sent':  { dot: 'bg-blue-400',    pill: 'bg-blue-50 text-blue-700 border-blue-100' },
  'Completed':   { dot: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  'Draft':       { dot: 'bg-gray-300',    pill: 'bg-gray-50 text-gray-500 border-gray-100' },
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
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-8 h-14 flex items-center justify-between sticky top-0 z-10">
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
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div className="w-7 h-7 rounded-full bg-[#0a1628] flex items-center justify-center text-white text-xs font-bold cursor-pointer">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4 fade-up">
          <div>
            <h1 className="text-[#0a1628] text-2xl font-bold tracking-tight mb-0.5">
              Good morning, {firstName}
            </h1>
            <p className="text-gray-400 text-sm">Here's your project overview for today.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#0a1628] hover:bg-[#152238] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-[0_4px_20px_rgba(10,22,40,0.2)] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            New Project
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Projects',  value: counts.total,      icon: <GridIcon />,  accent: 'bg-slate-100 text-slate-500',   delay: '0ms'   },
            { label: 'In Progress',     value: counts.inProgress, icon: <ClockIcon />, accent: 'bg-amber-50 text-amber-500',    delay: '50ms'  },
            { label: 'Quotes Out',      value: counts.quoteSent,  icon: <DocIcon />,   accent: 'bg-blue-50 text-blue-500',      delay: '100ms' },
            { label: 'Completed',       value: counts.completed,  icon: <CheckIcon />, accent: 'bg-emerald-50 text-emerald-500',delay: '150ms' },
          ].map(s => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-5 py-4 fade-up"
              style={{ animationDelay: s.delay }}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${s.accent}`}>{s.icon}</div>
              <div className="text-[#0a1628] text-2xl font-bold tracking-tight">{s.value}</div>
              <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_24px_rgba(0,0,0,0.05)] overflow-hidden fade-up" style={{ animationDelay: '200ms' }}>
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[#0a1628] font-semibold text-sm">All Projects</h2>
              <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">{projects.length}</span>
            </div>
            <button className="text-xs text-gray-400 hover:text-gray-600 border border-gray-100 rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Filter
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-50">
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
                    <tr key={i} className="border-b border-gray-50">
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
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="8" width="16" height="11" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><rect x="7" y="5" width="8" height="5" rx="1" stroke="#9ca3af" strokeWidth="1.5"/></svg>
                      </div>
                      <p className="text-gray-400 text-sm font-medium">No projects yet</p>
                      <p className="text-gray-300 text-xs mt-1">Create your first project to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`group transition-colors hover:bg-[#f8f9ff] cursor-pointer ${i !== projects.length - 1 ? 'border-b border-gray-50' : ''}`}
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[#0a1628] text-sm">{p.client_name}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm hidden md:table-cell">{p.address}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs hidden sm:table-cell">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="opacity-0 group-hover:opacity-100 text-[#0a1628] text-xs font-semibold transition-opacity">
                        Open →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && projects.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-gray-300 text-xs">Showing {projects.length} project{projects.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (fields) => {
            // Try Supabase — navigate to workspace regardless (works before schema is set up too)
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

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f5f6f8] to-transparent pointer-events-none" />
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
      style={{ background: 'rgba(10,22,40,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md modal-enter">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[#0a1628] font-bold text-base">New Project</h2>
            <p className="text-gray-400 text-xs mt-0.5">Enter the client details to get started</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Name *</label>
            <input
              type="text" value={clientName} onChange={e => setClientName(e.target.value)}
              required placeholder="e.g. Sarah & Mike Thornton"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50 outline-none placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-[#0a1628]/10 focus:border-[#0a1628]/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
            <input
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 14 Riverview Rd, Claremont WA 6010"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50 outline-none placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-[#0a1628]/10 focus:border-[#0a1628]/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
            <select
              value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50 outline-none cursor-pointer focus:ring-2 focus:ring-[#0a1628]/10 focus:border-[#0a1628]/30 transition-all"
            >
              <option>Draft</option>
              <option>Quote Sent</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
          <button
            type="submit" disabled={saving || !clientName.trim()}
            className="w-full bg-[#0a1628] hover:bg-[#152238] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 cursor-pointer text-sm shadow-[0_4px_20px_rgba(10,22,40,0.2)] mt-2"
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
    <span className={`inline-flex items-center gap-1.5 border text-xs font-medium px-2.5 py-1 rounded-full ${meta.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  )
}

function NavLink({ children, active }) {
  return (
    <button className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
      active ? 'text-[#0a1628] bg-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
    }`}>
      {children}
    </button>
  )
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-[#0a1628] rounded-lg flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="6" width="10" height="6" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="3.5" y="3.5" width="7" height="3.5" rx="0.75" fill="white" fillOpacity="0.7"/>
          <rect x="2.5" y="8.5" width="2.5" height="2.5" rx="0.4" fill="#0a1628"/>
          <rect x="9" y="8.5" width="2.5" height="2.5" rx="0.4" fill="#0a1628"/>
          <rect x="5.75" y="8.5" width="2.5" height="3.5" rx="0.4" fill="#0a1628"/>
        </svg>
      </div>
      <span className="text-[#0a1628] font-bold text-sm tracking-tight">BuildFlow Pro</span>
    </div>
  )
}

const GridIcon  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const DocIcon   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="1.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
