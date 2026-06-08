import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportQuotePDF } from '../lib/generatePDF'

// ─── constants ────────────────────────────────────────────────────────────────
const GRID = 20
const MPX  = 40

const ROOM_DEFS = [
  { type: 'Living Room',  color: '#dbeafe', stroke: '#93c5fd', w: 200, h: 160, rate: 1800 },
  { type: 'Kitchen',      color: '#fef3c7', stroke: '#fcd34d', w: 160, h: 120, rate: 3200, flat: 20000 },
  { type: 'Bedroom',      color: '#ede9fe', stroke: '#c4b5fd', w: 160, h: 120, rate: 1600 },
  { type: 'Bathroom',     color: '#cffafe', stroke: '#67e8f9', w:  80, h:  80, rate: 4500, flat: 8000 },
  { type: 'Garage',       color: '#f1f5f9', stroke: '#cbd5e1', w: 240, h: 200, rate:  800 },
  { type: 'Alfresco',     color: '#dcfce7', stroke: '#86efac', w: 160, h: 120, rate:  600 },
  { type: 'Dining Room',  color: '#fce7f3', stroke: '#f9a8d4', w: 160, h: 120, rate: 1800 },
  { type: 'Theatre Room', color: '#fef9c3', stroke: '#fde047', w: 200, h: 160, rate: 2200 },
  { type: 'Study',        color: '#f0fdf4', stroke: '#6ee7b7', w: 120, h: 120, rate: 1600 },
  { type: 'Pool Deck',      color: '#e0f2fe', stroke: '#38bdf8', w: 240, h: 120, rate:  400 },
  { type: 'Laundry',        color: '#f0f9ff', stroke: '#7dd3fc', w: 100, h:  80, rate: 2800, flat: 3000 },
  { type: 'Home Gym',        color: '#fdf4ff', stroke: '#d946ef', w: 200, h: 160, rate: 1200 },
  { type: 'Walk-in Pantry',  color: '#fff7ed', stroke: '#fb923c', w: 100, h:  80, rate: 1400 },
  { type: 'Mudroom',         color: '#f7fee7', stroke: '#84cc16', w: 120, h:  80, rate: 1100 },
  { type: 'Home Office',     color: '#ecfdf5', stroke: '#4ade80', w: 140, h: 120, rate: 1600 },
  { type: 'Workshop',        color: '#fafaf9', stroke: '#a8a29e', w: 200, h: 160, rate:  900 },
  { type: 'Corridor',        color: '#f1f5f9', stroke: '#94a3b8', w: 200, h:  48, rate:    0 },
]

const TRADES = [
  { name: 'Foundation', pct: 0.15 },
  { name: 'Walls',      pct: 0.18 },
  { name: 'Roofing',    pct: 0.14 },
  { name: 'Kitchen',    pct: 0.12 },
  { name: 'Bathrooms',  pct: 0.10 },
  { name: 'Electrical', pct: 0.10 },
  { name: 'Plumbing',   pct: 0.09 },
  { name: 'Flooring',   pct: 0.12 },
]

const WALL_OPTS  = ['Brick Veneer', 'Double Brick', 'Timber Frame', 'Steel Frame']
const FLOOR_OPTS = ['Tile', 'Timber', 'Carpet', 'Polished Concrete', 'Vinyl Plank']
const STYLES     = ['Modern', 'Coastal', 'Hamptons', 'Industrial']
const FINISHES   = {
  Kitchen:  ['Entry Level', 'Mid Range', 'Premium', 'Luxury'],
  Flooring: ["Builder's Grade", 'Standard', 'Premium'],
  Windows:  ['Aluminium', 'Timber', 'uPVC'],
}
const STATUS_OPTS = ['Draft', 'Quote Sent', 'In Progress', 'Completed']

// ─── smart generator constants ────────────────────────────────────────────────
const EXTRA_ROOMS = ['Study', 'Theatre Room', 'Home Gym', 'Walk-in Pantry', 'Mudroom', 'Pool Deck', 'Alfresco', 'Workshop', 'Home Office']

const SIZE_LABEL_MAP = [
  [120, 'Compact studio or granny flat'],
  [200, 'Small starter home'],
  [280, 'Comfortable 3-bedroom home'],
  [350, 'Spacious family home'],
  [450, 'Large family home'],
  [550, 'Executive home'],
  [650, 'Large luxury home'],
  [Infinity, 'Grand luxury estate'],
]
const sizeLabel = sz => SIZE_LABEL_MAP.find(([max]) => sz <= max)[1]

function generateFloorPlan({ propertyType, houseSize, bedrooms, bathrooms, extras, variant = 0 }) {
  const sf   = Math.sqrt(houseSize / 400)
  const sc   = v => Math.max(GRID * 3, Math.round(v * sf / GRID) * GRID)
  const isGF = propertyType === 'Granny Flat'
  const M    = 40
  const rooms = []

  const mk = (type, x, y, w, h) => {
    const def = ROOM_DEFS.find(d => d.type === type) ?? ROOM_DEFS[0]
    const r = { id: uid++, type, x: snap(x), y: snap(y), w: snap(w), h: snap(h), color: def.color, stroke: def.stroke }
    rooms.push(r)
    return r
  }

  const garW = isGF ? 0 : sc(240), garH = isGF ? 0 : sc(200)
  const livW = sc(isGF ? 240 : 280),  livH = sc(isGF ? 180 : 220)
  const kitW = sc(160), kitH = sc(140)
  const dinW = sc(140), dinH = sc(120)
  const lauW = sc(100), lauH = sc(80)
  const bedMW = sc(200), bedMH = sc(180)
  const bedW  = sc(160), bedH  = sc(160)
  const bathW = sc(100), bathH = sc(100)

  const SMALL_EX = ['Study', 'Home Office', 'Walk-in Pantry', 'Mudroom', 'Workshop']
  const exWidth  = t => t === 'Walk-in Pantry' ? sc(100) : t === 'Mudroom' ? sc(120) : t === 'Workshop' ? sc(180) : sc(140)

  function buildUnit(ox, oy) {
    let y = oy

    if (variant === 1) {
      // Bedrooms-first layout
      let bx = ox
      for (let i = 0; i < bedrooms; i++) {
        const [bW, bH] = i === 0 ? [bedMW, bedMH] : [bedW, bedH]
        mk('Bedroom', bx, y, bW, bH)
        if (i < bathrooms) mk('Bathroom', bx, y + bH, bathW, bathH)
        bx += Math.max(bW, bathW)
      }
      y += bedMH + (bathrooms > 0 ? bathH : 0)

      // Corridor between bedroom zone and utility/living below
      const corrH1 = Math.max(GRID * 3, snap(48 * sf))
      mk('Corridor', ox, y, bedrooms * Math.max(bedMW, bathW), corrH1)
      y += corrH1

      let rx = ox
      mk('Laundry', rx, y, lauW, lauH); rx += lauW
      SMALL_EX.filter(e => extras.includes(e)).forEach(t => { mk(t, rx, y, exWidth(t), lauH); rx += exWidth(t) })
      y += lauH

      mk('Kitchen', ox, y, kitW, kitH)
      mk('Dining Room', ox + kitW, y, dinW, dinH)
      if (extras.includes('Theatre Room')) mk('Theatre Room', ox + kitW + dinW, y, sc(200), sc(160))
      y += Math.max(kitH, dinH)

      if (!isGF) mk('Garage', ox, y, garW, garH)
      const lx = isGF ? ox : ox + garW
      mk('Living Room', lx, y, livW, livH)
      if (extras.includes('Alfresco')) mk('Alfresco', lx + livW, y, sc(180), sc(140))
      y += Math.max(isGF ? livH : garH, livH)
    } else {
      // Standard layout: street front → living → kitchen → beds
      if (!isGF) mk('Garage', ox, y, garW, garH)
      const lx = isGF ? ox : ox + garW
      mk('Living Room', lx, y, livW, livH)
      if (extras.includes('Alfresco')) mk('Alfresco', lx + livW, y, sc(180), sc(140))
      y += Math.max(isGF ? livH : garH, livH)

      mk('Kitchen', ox, y, kitW, kitH)
      mk('Dining Room', ox + kitW, y, dinW, dinH)
      if (extras.includes('Theatre Room')) mk('Theatre Room', ox + kitW + dinW, y, sc(200), sc(160))
      y += Math.max(kitH, dinH)

      let rx = ox
      mk('Laundry', rx, y, lauW, lauH); rx += lauW
      SMALL_EX.filter(e => extras.includes(e)).forEach(t => { mk(t, rx, y, exWidth(t), lauH); rx += exWidth(t) })
      y += lauH

      // Corridor between utility and bedroom zones
      const corrH = Math.max(GRID * 3, snap(48 * sf))
      const corrW = bedrooms * Math.max(bedMW, bathW)
      mk('Corridor', ox, y, corrW, corrH)
      y += corrH

      let bx = ox
      for (let i = 0; i < bedrooms; i++) {
        const [bW, bH] = i === 0 ? [bedMW, bedMH] : [bedW, bedH]
        mk('Bedroom', bx, y, bW, bH)
        if (i < bathrooms) mk('Bathroom', bx, y + bH, bathW, bathH)
        bx += Math.max(bW, bathW)
      }
      y += bedMH + (bathrooms > 0 ? bathH : 0)
    }

    // Bottom extras
    let ex = ox
    if (extras.includes('Pool Deck')) { mk('Pool Deck', ex, y, sc(300), sc(120)); ex += sc(300) }
    if (extras.includes('Home Gym'))  { mk('Home Gym',  ex, y, sc(200), sc(160)) }

    return y
  }

  if (propertyType === 'Duplex') {
    const u1bottom = buildUnit(M, M)
    buildUnit(M, u1bottom + GRID * 2)
  } else {
    buildUnit(M, M)
  }

  return rooms
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const snap   = v => Math.round(v / GRID) * GRID
const pxToM  = px => (px / MPX).toFixed(1)
const fmtAUD = n => '$' + Math.round(n).toLocaleString('en-AU')
const cost   = r => {
  const d = ROOM_DEFS.find(x => x.type === r.type)
  return d ? (r.w / MPX) * (r.h / MPX) * d.rate + (d.flat || 0) : 0
}

let uid = 1

// ─── page ─────────────────────────────────────────────────────────────────────
export default function ProjectPage() {
  const { id }             = useParams()
  const navigate           = useNavigate()
  const location           = useLocation()
  const [searchParams]     = useSearchParams()
  const isNew              = id === 'new'

  const [project,  setProject]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState(() => searchParams.get('view') === 'client' ? 'client' : 'builder')
  const [rooms,    setRooms]    = useState([])
  const [selId,    setSelId]    = useState(null)
  const [tool,     setTool]     = useState('select')
  const [zoom,     setZoom]     = useState(1)
  const [history,  setHistory]  = useState([])
  const [wallType,  setWallType]  = useState('Brick Veneer')
  const [floorType, setFloorType] = useState('Tile')
  const [rpTab,    setRpTab]    = useState('costs') // 'costs' | 'details'
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle'|'unsaved'|'saving'|'saved'
  const [showTemplates, setShowTemplates] = useState(false)
  const [copiedMsg,     setCopiedMsg]     = useState(false)
  // details form
  const [detailForm, setDetailForm] = useState({ client_name: '', address: '', status: 'In Progress', notes: '' })
  const [detailSaving, setDetailSaving] = useState(false)
  // client state
  const [style,    setStyle]    = useState('Modern')
  const [budget,   setBudget]   = useState(450000)
  const [finishes, setFinishes] = useState({ Kitchen: 'Mid Range', Flooring: 'Standard', Windows: 'Aluminium' })
  const [msgText,  setMsgText]  = useState('')
  const [messages, setMessages] = useState([
    { from: 'client',  text: 'Can we make the master bedroom a bit larger?',   time: '2h ago' },
    { from: 'builder', text: "No problem — updated it to 4.5m × 4m for you.", time: '1h ago' },
  ])

  const canvasRef     = useRef(null)
  const dragRef       = useRef(null)
  const zoomRef       = useRef(zoom)
  const hasLoadedRef  = useRef(false)
  const saveTimerRef  = useRef(null)
  const createdRef    = useRef(null)   // tracks ID after first-save of a new project
  const detailFormRef = useRef(detailForm)
  // stable refs for auto-save
  const roomsRef      = useRef(rooms)
  const wallTypeRef  = useRef(wallType)
  const floorTypeRef = useRef(floorType)
  const styleRef     = useRef(style)
  const budgetRef    = useRef(budget)
  const finishesRef  = useRef(finishes)

  useEffect(() => { detailFormRef.current = detailForm }, [detailForm])
  useEffect(() => { zoomRef.current      = zoom },      [zoom])
  useEffect(() => { roomsRef.current     = rooms },     [rooms])
  useEffect(() => { wallTypeRef.current  = wallType },  [wallType])
  useEffect(() => { floorTypeRef.current = floorType }, [floorType])
  useEffect(() => { styleRef.current     = style },     [style])
  useEffect(() => { budgetRef.current    = budget },    [budget])
  useEffect(() => { finishesRef.current  = finishes },  [finishes])

  const total    = rooms.reduce((s, r) => s + cost(r), 0)
  const totalSqm = rooms.reduce((s, r) => s + (r.w / MPX) * (r.h / MPX), 0)
  const selRoom  = rooms.find(r => r.id === selId) ?? null

  // ── load project from Supabase (or bootstrap from navigation state for new projects)
  useEffect(() => {
    if (isNew) {
      const state = location.state || {}
      setDetailForm({
        client_name: state.client_name || '',
        address:     state.address     || '',
        status:      state.status      || 'Draft',
        notes:       '',
      })
      setLoading(false)
      setTimeout(() => { hasLoadedRef.current = true }, 100)
      return
    }
    // After a just-created project navigates here, skip reload (data already in state)
    if (createdRef.current === id) {
      createdRef.current = null
      return
    }
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('projects').select('*').eq('id', id).single()
      if (data) {
        setProject(data)
        setDetailForm({
          client_name: data.client_name || '',
          address:     data.address     || '',
          status:      data.status      || 'In Progress',
          notes:       data.notes       || '',
        })
        if (data.floor_plan?.length) {
          setRooms(data.floor_plan)
          uid = Math.max(...data.floor_plan.map(r => r.id || 0), 0) + 1
        }
        if (data.wall_type)       setWallType(data.wall_type)
        if (data.floor_type)      setFloorType(data.floor_type)
        if (data.client_style)    setStyle(data.client_style)
        if (data.client_budget)   setBudget(data.client_budget)
        if (data.client_finishes) setFinishes(data.client_finishes)
      }
      setLoading(false)
      setTimeout(() => { hasLoadedRef.current = true }, 100)
    }
    load()
  }, [id])

  // ── auto-save (debounced 2.5s after any change)
  const saveProject = useCallback(async () => {
    setSaveStatus('saving')

    if (isNew) {
      // First save for a brand-new project — create the DB record
      const form = detailFormRef.current
      const { data, error } = await supabase
        .from('projects')
        .insert({
          client_name:     form.client_name || 'New Project',
          address:         form.address     || '',
          status:          form.status      || 'Draft',
          notes:           form.notes       || '',
          floor_plan:      roomsRef.current,
          wall_type:       wallTypeRef.current,
          floor_type:      floorTypeRef.current,
          client_style:    styleRef.current,
          client_budget:   budgetRef.current,
          client_finishes: finishesRef.current,
        })
        .select().single()
      if (!error && data) {
        clearTimeout(saveTimerRef.current)
        createdRef.current = data.id
        setProject(data)
        navigate(`/project/${data.id}`, { replace: true })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('unsaved')
      }
      return
    }

    const { error } = await supabase
      .from('projects')
      .update({
        floor_plan:      roomsRef.current,
        wall_type:       wallTypeRef.current,
        floor_type:      floorTypeRef.current,
        client_style:    styleRef.current,
        client_budget:   budgetRef.current,
        client_finishes: finishesRef.current,
      })
      .eq('id', id)
    setSaveStatus(error ? 'unsaved' : 'saved')
    if (!error) setTimeout(() => setSaveStatus('idle'), 2000)
  }, [id, isNew, navigate])

  useEffect(() => {
    if (!hasLoadedRef.current) return
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveProject, 2500)
    return () => clearTimeout(saveTimerRef.current)
  }, [rooms, wallType, floorType, style, budget, finishes, saveProject])

  // ── save project details (name, address, status, notes)
  async function saveDetails() {
    setDetailSaving(true)
    const { data, error } = await supabase
      .from('projects')
      .update(detailForm)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) setProject(data)
    setDetailSaving(false)
  }

  // ── PDF export
  function handleExportPDF() {
    const p = project || {}
    exportQuotePDF({
      project: {
        client_name: p.client_name || detailForm.client_name,
        address:     p.address     || detailForm.address,
        status:      p.status      || detailForm.status,
        notes:       p.notes       || detailForm.notes,
      },
      rooms: rooms.map(r => ({
        type: r.type,
        wM:   pxToM(r.w),
        hM:   pxToM(r.h),
        sqm:  ((r.w / MPX) * (r.h / MPX)).toFixed(1),
        cost: cost(r),
      })),
      trades: TRADES.map(t => ({ name: t.name, amount: total * t.pct })),
      total,
    })
  }

  // ── room mutations
  const updRoom = useCallback((id, patch) =>
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  , [])

  const addRoom = (type, cx, cy) => {
    const d = ROOM_DEFS.find(x => x.type === type)
    if (!d) return
    setHistory(h => [...h.slice(-19), rooms])
    const r = { id: uid++, type, x: snap(cx - d.w/2), y: snap(cy - d.h/2), w: d.w, h: d.h, color: d.color, stroke: d.stroke, wallType, floorType }
    setRooms(prev => [...prev, r])
    setSelId(r.id)
  }

  const delSel = useCallback(() => {
    if (!selId) return
    setHistory(h => [...h.slice(-19), rooms])
    setRooms(p => p.filter(r => r.id !== selId))
    setSelId(null)
  }, [selId, rooms])

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h
      setRooms(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  const loadGeneratedRooms = (generatedRooms) => {
    setHistory(h => [...h.slice(-19), rooms])
    setRooms(generatedRooms)
    setSelId(null)
  }

  const sendToClient = () => {
    const url = `${window.location.origin}${window.location.pathname}?view=client`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 3000)
    })
  }

  // ── canvas events
  const onDrop = e => {
    e.preventDefault()
    const type = e.dataTransfer.getData('room-type')
    if (!type || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    addRoom(type, (e.clientX - rect.left) / zoomRef.current, (e.clientY - rect.top) / zoomRef.current)
  }

  const onRoomDown = (e, rid) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelId(rid)
    const r = rooms.find(x => x.id === rid)
    setHistory(h => [...h.slice(-19), rooms])
    dragRef.current = { kind: 'move', id: rid, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y }
  }

  const onHandleDown = (e, rid, dir) => {
    e.stopPropagation()
    e.preventDefault()
    const r = rooms.find(x => x.id === rid)
    setHistory(h => [...h.slice(-19), rooms])
    dragRef.current = { kind: 'resize', id: rid, dir, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, ow: r.w, oh: r.h }
  }

  useEffect(() => {
    const onMove = e => {
      const d = dragRef.current
      if (!d) return
      const dx = (e.clientX - d.sx) / zoomRef.current
      const dy = (e.clientY - d.sy) / zoomRef.current
      const MIN = GRID * 3
      if (d.kind === 'move') {
        updRoom(d.id, { x: snap(d.ox + dx), y: snap(d.oy + dy) })
      } else {
        let nx = d.ox, ny = d.oy, nw = d.ow, nh = d.oh
        if (d.dir.includes('e')) nw = Math.max(MIN, snap(d.ow + dx))
        if (d.dir.includes('s')) nh = Math.max(MIN, snap(d.oh + dy))
        if (d.dir.includes('w')) { nw = Math.max(MIN, snap(d.ow - dx)); nx = d.ox + d.ow - nw }
        if (d.dir.includes('n')) { nh = Math.max(MIN, snap(d.oh - dy)); ny = d.oy + d.oh - nh }
        updRoom(d.id, { x: nx, y: ny, w: nw, h: nh })
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [updRoom])

  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Delete' || e.key === 'Backspace') delSel()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      if (e.key === 'Escape') setShowTemplates(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [delSel, undo])

  const sendMessage = () => {
    if (!msgText.trim()) return
    setMessages(m => [...m, { from: 'client', text: msgText.trim(), time: 'Just now' }])
    setMsgText('')
  }

  const projectName = project?.client_name || detailForm.client_name || 'Loading…'
  const projectAddr = project?.address     || detailForm.address     || ''
  const CW = 1400, CH = 1000

  if (loading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-[#f5f6f8]">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
          <div className="h-4 w-4 rounded skeleton" />
          <div className="h-4 w-48 rounded skeleton" />
          <div className="ml-auto flex gap-2">
            <div className="h-7 w-28 rounded-lg skeleton" />
            <div className="h-7 w-24 rounded-lg skeleton" />
          </div>
        </div>
        <div className="flex flex-1">
          <div className="w-[200px] bg-white border-r border-gray-100" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#1a3a5c] rounded-full animate-spin" />
          </div>
          <div className="w-[240px] bg-white border-l border-gray-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f5f6f8]" style={{ userSelect: 'none' }}>

      {/* ── TOP BAR */}
      <div className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0 z-20">
        <button onClick={() => navigate('/')} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-[#1a3a5c] rounded-lg flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="5" width="9" height="6" rx="0.8" fill="white" fillOpacity="0.9"/>
              <rect x="3" y="2.5" width="6" height="3.5" rx="0.6" fill="white" fillOpacity="0.6"/>
            </svg>
          </div>
          <span className="font-semibold text-[#1a3a5c] text-sm truncate">{projectName}</span>
          <span className="text-gray-200 hidden md:block">·</span>
          <span className="text-gray-400 text-xs hidden md:block truncate">{projectAddr}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Save status */}
          <span className={`text-[10px] font-medium transition-all ${
            saveStatus === 'unsaved' ? 'text-amber-500' :
            saveStatus === 'saving'  ? 'text-gray-400'  :
            saveStatus === 'saved'   ? 'text-emerald-500' : 'text-transparent'
          }`}>
            {saveStatus === 'unsaved' ? '● Unsaved' :
             saveStatus === 'saving'  ? 'Saving…'   :
             saveStatus === 'saved'   ? '✓ Saved'   : '·'}
          </span>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={rooms.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#1a3a5c] border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-30"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export PDF
          </button>

          {/* Generate floor plan */}
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#1a3a5c] border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6L2.7 3.8l2.6-.4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Generate floor plan
          </button>

          {/* Send to client */}
          <div className="relative">
            <button onClick={sendToClient}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Send to client
            </button>
            {copiedMsg && (
              <div className="absolute right-0 top-9 bg-[#1a3a5c] text-white text-[11px] font-medium px-3 py-2 rounded-xl shadow-lg whitespace-nowrap z-50 flex items-center gap-2 modal-enter">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#4ade80" strokeWidth="1.5"/><path d="M3.5 6l2 2 3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Link copied — send this to your client
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {['builder', 'client'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  view === v ? 'bg-white text-[#1a3a5c] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {v === 'builder' ? 'Builder' : 'Client'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3-COLUMN BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL */}
        <div className="w-[200px] shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-1.5">Project</p>
            <p className="font-semibold text-[#1a3a5c] text-sm leading-tight">{projectName}</p>
            <p className="text-gray-400 text-[11px] mt-0.5 leading-tight">{projectAddr}</p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                {project?.status || 'In Progress'}
              </span>
            </div>
          </div>

          <div className="px-3 py-3 border-b border-gray-50 shrink-0 overflow-y-auto" style={{ maxHeight: '280px' }}>
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Rooms</p>
            <div className="space-y-1">
              {ROOM_DEFS.map(d => (
                <div key={d.type} draggable onDragStart={e => e.dataTransfer.setData('room-type', d.type)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing transition">
                  <span className="w-3 h-3 rounded-[3px] shrink-0 border" style={{ background: d.color, borderColor: d.stroke }} />
                  <span className="text-[11px] font-medium text-[#1a3a5c]">{d.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 py-3 overflow-y-auto flex-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Materials</p>
            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Wall Type</p>
                <select value={wallType} onChange={e => setWallType(e.target.value)}
                  className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 text-[#1a3a5c] bg-white outline-none cursor-pointer focus:ring-1 focus:ring-[#1a3a5c]/20">
                  {WALL_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Flooring</p>
                <select value={floorType} onChange={e => setFloorType(e.target.value)}
                  className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 text-[#1a3a5c] bg-white outline-none cursor-pointer focus:ring-1 focus:ring-[#1a3a5c]/20">
                  {FLOOR_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── CANVAS AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-10 bg-white border-b border-gray-100 flex items-center px-4 gap-1 shrink-0">
            {[
              { id: 'select',  label: 'Select',  icon: <IconSelect /> },
              { id: 'draw',    label: 'Draw',    icon: <IconDraw /> },
              { id: 'measure', label: 'Measure', icon: <IconRuler /> },
            ].map(t => (
              <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition cursor-pointer ${
                  tool === t.id ? 'bg-[#1a3a5c] text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}>
                {t.icon}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-100 mx-1" />
            <button onClick={() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2)))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
              <IconZoomIn />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
              <IconZoomOut />
            </button>
            <div className="w-px h-4 bg-gray-100 mx-1" />
            <button onClick={undo} disabled={!history.length}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-25 transition cursor-pointer">
              <IconUndo />
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] text-gray-300">{Math.round(zoom * 100)}%</span>
              {selRoom && (
                <button onClick={delSel}
                  className="text-[10px] text-red-400 hover:text-red-600 border border-red-100 hover:border-red-200 rounded-md px-2 py-1 transition cursor-pointer">
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div style={{ position: 'relative', width: CW * zoom, height: CH * zoom }}>
              <FurnitureLayer rooms={rooms} zoom={zoom} CW={CW} CH={CH} />
              <WallOverlay rooms={rooms} zoom={zoom} CW={CW} CH={CH} />
              <DimensionLines rooms={rooms} zoom={zoom} CW={CW} CH={CH} />
              <div
                ref={canvasRef}
                style={{
                  position: 'absolute', top: 0, left: 0, width: CW, height: CH,
                  transform: `scale(${zoom})`, transformOrigin: 'top left',
                  backgroundImage: [
                    `linear-gradient(rgba(26,58,92,0.06) 1px, transparent 1px)`,
                    `linear-gradient(90deg, rgba(26,58,92,0.06) 1px, transparent 1px)`,
                    `linear-gradient(rgba(26,58,92,0.025) 1px, transparent 1px)`,
                    `linear-gradient(90deg, rgba(26,58,92,0.025) 1px, transparent 1px)`,
                  ].join(','),
                  backgroundSize: `${GRID*5}px ${GRID*5}px, ${GRID*5}px ${GRID*5}px, ${GRID}px ${GRID}px, ${GRID}px ${GRID}px`,
                  backgroundColor: '#fafbfd',
                }}
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={e => { if (e.target === canvasRef.current) setSelId(null) }}
              >
                {rooms.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
                    <div className="w-14 h-14 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11h14" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-300 text-sm font-medium">Drag rooms onto the canvas</p>
                      <p className="text-gray-200 text-xs mt-1">or load a template to get started</p>
                    </div>
                  </div>
                )}
                {rooms.map(r => (
                  <RoomBlock key={r.id} room={r} selected={r.id === selId} view={view} cost={cost(r)}
                    onMouseDown={e => onRoomDown(e, r.id)}
                    onHandleDown={(e, dir) => onHandleDown(e, r.id, dir)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL */}
        <div className="w-[240px] shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
          {view === 'builder' ? (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-gray-100 shrink-0">
                {[['costs','Costs'],['details','Details']].map(([val, label]) => (
                  <button key={val} onClick={() => setRpTab(val)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition cursor-pointer ${
                      rpTab === val ? 'text-[#1a3a5c] border-b-2 border-[#1a3a5c]' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {rpTab === 'costs' ? (
                <BuilderPanel total={total} totalSqm={totalSqm} rooms={rooms} selRoom={selRoom} messages={messages} />
              ) : (
                <DetailsPanel
                  form={detailForm}
                  setForm={setDetailForm}
                  saving={detailSaving}
                  onSave={saveDetails}
                />
              )}
            </>
          ) : (
            <ClientPanel
              style={style} setStyle={setStyle}
              budget={budget} setBudget={setBudget}
              finishes={finishes} setFinishes={setFinishes}
              msgText={msgText} setMsgText={setMsgText}
              messages={messages} onSend={sendMessage}
            />
          )}
        </div>
      </div>

      {showTemplates && (
        <SmartGeneratorModal onGenerate={loadGeneratedRooms} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  )
}

// ─── details panel ────────────────────────────────────────────────────────────
function DetailsPanel({ form, setForm, saving, onSave }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="px-4 py-4 space-y-3 flex-1">
      <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-1">Project Details</p>
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Client Name</label>
        <input value={form.client_name} onChange={e => upd('client_name', e.target.value)}
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 text-[#1a3a5c] outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 bg-gray-50 focus:bg-white transition"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Address</label>
        <input value={form.address} onChange={e => upd('address', e.target.value)}
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 text-[#1a3a5c] outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 bg-gray-50 focus:bg-white transition"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Status</label>
        <select value={form.status} onChange={e => upd('status', e.target.value)}
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 text-[#1a3a5c] bg-gray-50 outline-none cursor-pointer focus:ring-1 focus:ring-[#1a3a5c]/20">
          {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <label className="text-[10px] text-gray-400 block mb-1">Notes</label>
        <textarea
          value={form.notes} onChange={e => upd('notes', e.target.value)}
          rows={4}
          placeholder="Internal notes, special requirements…"
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 text-[#1a3a5c] outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 bg-gray-50 focus:bg-white transition resize-none placeholder:text-gray-300"
        />
      </div>
      <button onClick={onSave} disabled={saving}
        className="w-full bg-[#1a3a5c] hover:bg-[#243f63] text-white text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Details'}
      </button>
    </div>
  )
}

// ─── builder panel ────────────────────────────────────────────────────────────
function BuilderPanel({ total, totalSqm, rooms, selRoom, messages }) {
  return (
    <>
      <div className="m-3 bg-[#1a3a5c] rounded-xl px-4 py-4 shrink-0">
        <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1">Total Project Cost</p>
        <p className="text-white text-2xl font-bold tracking-tight leading-none">{fmtAUD(total)}</p>
        <p className="text-white/30 text-[10px] mt-2">{rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalSqm.toFixed(0)} m² est.</p>
      </div>

      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-3">Cost by Trade</p>
        <div className="space-y-2.5">
          {TRADES.map(t => (
            <div key={t.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">{t.name}</span>
                <span className="text-[11px] font-semibold text-[#1a3a5c]">{fmtAUD(total * t.pct)}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(t.pct / 0.18) * 100}%`, background: 'linear-gradient(90deg, #1a3a5c, #2d5a8c)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Selected Room</p>
        {selRoom ? (
          <div className="space-y-2">
            <div>
              <p className="font-bold text-[#1a3a5c] text-sm">{selRoom.type}</p>
              <p className="text-gray-400 text-[11px]">{pxToM(selRoom.w)}m × {pxToM(selRoom.h)}m</p>
              <p className="text-gray-400 text-[11px]">Floor area: {((selRoom.w / MPX) * (selRoom.h / MPX)).toFixed(1)} m²</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400 text-[9px] uppercase tracking-wide mb-0.5">Walls</p>
                <p className="text-[#1a3a5c] text-[11px] font-semibold leading-tight">{selRoom.wallType}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400 text-[9px] uppercase tracking-wide mb-0.5">Floor</p>
                <p className="text-[#1a3a5c] text-[11px] font-semibold leading-tight">{selRoom.floorType}</p>
              </div>
            </div>
            <div className="bg-[#1a3a5c]/5 border border-[#1a3a5c]/10 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-gray-400 text-[10px] uppercase tracking-wide">Room cost</span>
              <span className="text-[#1a3a5c] font-bold text-sm">{fmtAUD(cost(selRoom))}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-300 text-[11px] py-2">Click a room to see details</p>
        )}
      </div>

      <div className="px-4 py-3 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Client Comments</p>
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-[11px] ${m.from === 'client' ? 'bg-gray-50 text-gray-600' : 'bg-[#1a3a5c]/5 text-[#1a3a5c]'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-bold text-[10px] capitalize">{m.from}</span>
                <span className="text-gray-300 text-[9px]">{m.time}</span>
              </div>
              {m.text}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── client panel ─────────────────────────────────────────────────────────────
function ClientPanel({ style, setStyle, budget, setBudget, finishes, setFinishes, msgText, setMsgText, messages, onSend }) {
  return (
    <>
      <div className="px-4 py-4 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Style</p>
        <div className="grid grid-cols-2 gap-1.5">
          {STYLES.map(s => (
            <button key={s} onClick={() => setStyle(s)}
              className={`py-2 rounded-xl text-[11px] font-semibold transition cursor-pointer border ${
                style === s ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-3">Finishes</p>
        <div className="space-y-2.5">
          {Object.entries(FINISHES).map(([key, opts]) => (
            <div key={key}>
              <p className="text-[10px] text-gray-400 mb-1">{key}</p>
              <select value={finishes[key]} onChange={e => setFinishes(f => ({ ...f, [key]: e.target.value }))}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 text-[#1a3a5c] bg-white outline-none cursor-pointer focus:ring-1 focus:ring-[#1a3a5c]/20">
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-1">Budget</p>
        <p className="text-[#1a3a5c] text-xl font-bold tracking-tight mb-3">{fmtAUD(budget)}</p>
        <input type="range" min={200000} max={2000000} step={25000} value={budget}
          onChange={e => setBudget(+e.target.value)} className="w-full accent-[#1a3a5c] cursor-pointer" />
        <div className="flex justify-between text-[9px] text-gray-300 mt-1"><span>$200k</span><span>$2M</span></div>
      </div>

      <div className="px-4 py-4 flex flex-col flex-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Message Builder</p>
        <div className="flex-1 space-y-2 overflow-y-auto max-h-40 mb-3">
          {messages.map((m, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-[11px] ${m.from === 'client' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'}`}>
              <p className="font-bold text-[9px] uppercase tracking-wide mb-0.5">{m.from}</p>
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input type="text" value={msgText} onChange={e => setMsgText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()} placeholder="Type a message…"
            className="flex-1 text-[11px] border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 focus:border-[#1a3a5c]/30" />
          <button onClick={onSend} className="bg-[#1a3a5c] text-white rounded-xl px-3 py-2 hover:bg-[#243f63] transition cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── smart generator modal ────────────────────────────────────────────────────
function SmartGeneratorModal({ onGenerate, onClose }) {
  const [step,      setStep]      = useState(1)
  const [propType,  setPropType]  = useState('House')
  const [houseSize, setHouseSize] = useState(350)
  const [bedrooms,  setBedrooms]  = useState(4)
  const [bathrooms, setBathrooms] = useState(2)
  const [extras,    setExtras]    = useState([])
  const [variant,   setVariant]   = useState(0)
  const [generated, setGenerated] = useState(false)

  const toggleExtra = e => setExtras(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])

  const doGenerate = v => {
    onGenerate(generateFloorPlan({ propertyType: propType, houseSize, bedrooms, bathrooms, extras, variant: v }))
    setGenerated(true)
  }

  const handleRegenerate = () => {
    const next = (variant + 1) % 2
    setVariant(next)
    doGenerate(next)
  }

  const PROP_TYPES = [
    { id: 'House',       desc: 'Standard single dwelling' },
    { id: 'Duplex',      desc: 'Two units, side by side'  },
    { id: 'Townhouse',   desc: 'Multi-level narrow lot'   },
    { id: 'Granny Flat', desc: 'Compact self-contained'   },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden modal-enter">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {step > 1 && !generated && (
                <button onClick={() => setStep(s => s - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <div>
                <h2 className="text-[#1a3a5c] font-bold text-base">
                  {generated ? 'Floor Plan Generated' : 'Generate Floor Plan'}
                </h2>
                {!generated && <p className="text-gray-400 text-xs mt-0.5">Step {step} of 4</p>}
              </div>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>
          {!generated && (
            <div className="flex gap-1.5">
              {[1,2,3,4].map(n => (
                <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${n <= step ? 'bg-[#1a3a5c]' : 'bg-gray-100'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6 min-h-[280px]">
          {generated ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="13" r="11" stroke="#10b981" strokeWidth="1.6"/>
                  <path d="M8 13l3.5 3.5 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-[#1a3a5c] font-bold text-lg mb-1">Floor plan loaded!</h3>
              <p className="text-gray-400 text-sm mb-0.5">{bedrooms} bed · {bathrooms} bath · {houseSize}m² {propType.toLowerCase()}</p>
              {extras.length > 0 && <p className="text-gray-400 text-sm mb-4">+ {extras.join(', ')}</p>}
              <p className="text-gray-300 text-xs mt-3 mb-6">Drag rooms to reposition · resize using handles · ⌘Z to undo</p>
              <button onClick={handleRegenerate}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#1a3a5c] border border-[#1a3a5c]/20 hover:border-[#1a3a5c]/40 hover:bg-[#1a3a5c]/5 px-4 py-2.5 rounded-xl transition cursor-pointer">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M11 6.5a4.5 4.5 0 11-9 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M11 2.5v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Try different layout
              </button>
            </div>

          ) : step === 1 ? (
            <div>
              <p className="text-[#1a3a5c] font-semibold text-sm mb-5">What type of property are you building?</p>
              <div className="grid grid-cols-2 gap-3">
                {PROP_TYPES.map(pt => (
                  <button key={pt.id} onClick={() => setPropType(pt.id)}
                    className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${
                      propType === pt.id ? 'border-[#1a3a5c] bg-[#1a3a5c]/5' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <PropIcon type={pt.id} active={propType === pt.id} />
                    <div className="font-bold text-[#1a3a5c] text-sm mt-3">{pt.id}</div>
                    <div className="text-gray-400 text-[11px] mt-0.5">{pt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

          ) : step === 2 ? (
            <div>
              <p className="text-[#1a3a5c] font-semibold text-sm mb-6">How large is the house?</p>
              <div className="text-center mb-8">
                <div className="text-5xl font-bold text-[#1a3a5c] tracking-tight leading-none tabular-nums">
                  {houseSize}<span className="text-2xl font-normal text-gray-300 ml-1">m²</span>
                </div>
                <div className="text-gray-400 text-sm mt-3 font-medium">{sizeLabel(houseSize)}</div>
              </div>
              <input type="range" min={80} max={800} step={10} value={houseSize}
                onChange={e => setHouseSize(+e.target.value)}
                className="w-full accent-[#1a3a5c] cursor-pointer" />
              <div className="flex justify-between text-[10px] text-gray-300 mt-2">
                <span>80m²</span><span>800m²</span>
              </div>
            </div>

          ) : step === 3 ? (
            <div>
              <p className="text-[#1a3a5c] font-semibold text-sm mb-8">Bedrooms and bathrooms?</p>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { label: 'Bedrooms',  val: bedrooms,  set: setBedrooms,  min: 1, max: 6 },
                  { label: 'Bathrooms', val: bathrooms, set: setBathrooms, min: 1, max: 4 },
                ].map(({ label, val, set, min, max }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-5">{label}</p>
                    <div className="flex items-center justify-center gap-5">
                      <button onClick={() => set(v => Math.max(min, v - 1))}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold transition cursor-pointer ${
                          val <= min ? 'border-gray-100 text-gray-200' : 'border-gray-200 text-gray-500 hover:border-[#1a3a5c] hover:text-[#1a3a5c]'
                        }`}>−</button>
                      <span className="text-5xl font-bold text-[#1a3a5c] w-12 text-center tabular-nums">{val}</span>
                      <button onClick={() => set(v => Math.min(max, v + 1))}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold transition cursor-pointer ${
                          val >= max ? 'border-gray-100 text-gray-200' : 'border-gray-200 text-gray-500 hover:border-[#1a3a5c] hover:text-[#1a3a5c]'
                        }`}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          ) : (
            <div>
              <p className="text-[#1a3a5c] font-semibold text-sm mb-1">Any extra rooms?</p>
              <p className="text-gray-400 text-xs mb-5">Optional — tap to toggle on or off</p>
              <div className="flex flex-wrap gap-2">
                {EXTRA_ROOMS.map(e => (
                  <button key={e} onClick={() => toggleExtra(e)}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      extras.includes(e)
                        ? 'bg-[#1a3a5c] text-white border-[#1a3a5c] shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                    }`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          {generated ? (
            <button onClick={onClose}
              className="w-full bg-[#1a3a5c] hover:bg-[#243f63] text-white font-semibold text-sm py-3 rounded-xl transition cursor-pointer">
              Done — start editing
            </button>
          ) : step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="w-full flex items-center justify-center gap-2 bg-[#1a3a5c] hover:bg-[#243f63] text-white font-semibold text-sm py-3 rounded-xl transition cursor-pointer">
              Next
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ) : (
            <button onClick={() => doGenerate(variant)}
              className="w-full flex items-center justify-center gap-2 bg-[#1a3a5c] hover:bg-[#243f63] text-white font-semibold text-sm py-3 rounded-xl transition cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="5" width="12" height="8" rx="1" stroke="white" strokeWidth="1.4"/>
                <path d="M4 5V3.5a3 3 0 016 0V5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Generate floor plan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PropIcon({ type, active }) {
  const c = active ? '#1a3a5c' : '#94a3b8'
  if (type === 'House') return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M6 17L16 8l10 9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 15v9h14v-9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="13" y="19" width="6" height="5" rx="0.8" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
  if (type === 'Duplex') return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M2 19L9 12l7 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 17v6h8v-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 19l7-7 7 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 17v6h8v-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'Townhouse') return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M10 15L16 9l6 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="10" y="15" width="12" height="10" rx="0.8" stroke={c} strokeWidth="2"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke={c} strokeWidth="1.4"/>
      <rect x="13" y="21" width="6" height="4" rx="0.6" stroke={c} strokeWidth="1.4"/>
    </svg>
  )
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M8 19L16 12l8 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 17v7h10v-7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="14" y="19" width="4" height="5" rx="0.6" stroke={c} strokeWidth="1.4"/>
      <path d="M4 26h24" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// ─── room block ───────────────────────────────────────────────────────────────
const HANDLES = ['nw','n','ne','e','se','s','sw','w']
const HPOS = {
  nw: { top: -5, left: -5 }, n:  { top: -5, left: '50%', marginLeft: -4 },
  ne: { top: -5, right: -5 }, e:  { top: '50%', right: -5, marginTop: -4 },
  se: { bottom: -5, right: -5 }, s:  { bottom: -5, left: '50%', marginLeft: -4 },
  sw: { bottom: -5, left: -5 }, w:  { top: '50%', left: -5, marginTop: -4 },
}
const HCURSOR = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' }

function RoomBlock({ room, selected, view, cost, onMouseDown, onHandleDown }) {
  const isCorridor = room.type === 'Corridor'
  return (
    <div onMouseDown={onMouseDown} style={{
      position: 'absolute', left: room.x, top: room.y, width: room.w, height: room.h,
      background: '#fff',
      border: selected ? '2px solid rgba(28,28,28,0.35)' : 'none',
      cursor: 'move', zIndex: selected ? 10 : 1,
      boxShadow: selected ? '0 0 0 3px rgba(28,28,28,0.1)' : 'none',
    }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 pointer-events-none">
        <span className="text-[#1c1c1c] font-bold tracking-wider leading-tight text-center"
          style={{ fontSize: isCorridor ? 8 : 9 }}>
          {isCorridor ? 'HALL' : room.type.toUpperCase()}
        </span>
        {!isCorridor && (
          <span className="text-[#1c1c1c]/40 mt-0.5" style={{ fontSize: 8 }}>
            {pxToM(room.w)}m × {pxToM(room.h)}m
          </span>
        )}
      </div>
      {selected && HANDLES.map(h => (
        <div key={h} onMouseDown={e => onHandleDown(e, h)} style={{
          position: 'absolute', width: 9, height: 9, background: 'white',
          border: '2px solid #1c1c1c', borderRadius: 2, cursor: HCURSOR[h], zIndex: 20, ...HPOS[h],
        }} />
      ))}
    </div>
  )
}

// ─── furniture symbols ────────────────────────────────────────────────────────
function getFurniturePaths(room) {
  const { x, y, w, h } = room
  if (w < 55 || h < 48) return []
  const paths = []
  const P = 8
  const R = (lx, ly, lw, lh) => lw > 0 && lh > 0 ? `M ${lx} ${ly} h ${lw} v ${lh} h ${-lw} Z` : null
  const L = (x1, y1, x2, y2) => `M ${x1} ${y1} L ${x2} ${y2}`
  const C = (cx, cy, r) => r > 1 ? `M ${cx+r} ${cy} a ${r} ${r} 0 1 0 ${-2*r} 0 a ${r} ${r} 0 1 0 ${2*r} 0` : null

  switch (room.type) {
    case 'Living Room': {
      // L-shaped sofa outline
      const sW = Math.min(w * 0.65, w - 2*P), sD = Math.min(Math.max(14, h * 0.16), 20)
      const armD = sD, armH = Math.min(h * 0.38, 42)
      const sX = x + P, sY = y + h - P - sD
      paths.push(R(sX, sY, sW, sD))           // seat base
      paths.push(R(sX, sY - armH + sD, armD, armH - sD))  // left arm
      break
    }
    case 'Kitchen': {
      // bench lines along bottom and one side, small sink rectangle + two circles
      const bD = 10
      paths.push(L(x+P, y+h-P-bD, x+w-P, y+h-P-bD))   // bottom bench line (top edge)
      paths.push(L(x+P, y+h-P, x+w-P, y+h-P))           // bottom bench line (bottom edge)
      paths.push(L(x+w-P-bD, y+P, x+w-P-bD, y+h-P-bD)) // right bench line (left edge)
      paths.push(L(x+w-P, y+P, x+w-P, y+h-P-bD))        // right bench line (right edge)
      // sink: small rectangle with two circles
      const skW = 16, skH = 11, skX = x + P + (w-2*P-skW)/2, skY = y + h - P - bD + 1
      paths.push(R(skX, skY, skW, skH - 2))
      const r = 3.5
      paths.push(C(skX + skW/2 - r - 1, skY + (skH-2)/2, r))
      paths.push(C(skX + skW/2 + r + 1, skY + (skH-2)/2, r))
      break
    }
    case 'Bedroom': {
      // simple bed rectangle + headboard line at top
      const bW = Math.min(w - 2*P, Math.max(w * 0.65, 50))
      const bH = Math.min(h * 0.55, h - 2*P, Math.max(bW * 0.6, 34))
      const bX = x + (w - bW) / 2, bY = y + (h - bH) / 2
      paths.push(R(bX, bY, bW, bH))
      paths.push(L(bX, bY + 9, bX + bW, bY + 9))  // headboard line
      break
    }
    case 'Bathroom': {
      // toilet (rounded rect), shower square in corner, vanity line
      const tW = Math.min(w * 0.35, 22), tH = Math.min(h * 0.42, 30)
      const tX = x + w - P - tW, tY = y + P
      paths.push(R(tX, tY, tW, tH * 0.28))         // cistern
      paths.push(C(tX + tW/2, tY + tH * 0.64, Math.min(tW*0.4, tH*0.3)))  // bowl
      const shS = Math.min(Math.min(w - tW - 3*P, h * 0.44), 36)
      if (shS > 14) {
        paths.push(R(x + P, y + h - P - shS, shS, shS))  // shower square
      }
      paths.push(L(x + P, y + P, x + P + Math.min(w * 0.4, 28), y + P))  // vanity line
      break
    }
    case 'Dining Room': {
      const tW = Math.min(w * 0.5, 64), tH = Math.min(h * 0.4, 48)
      const tX = x + (w - tW) / 2, tY = y + (h - tH) / 2
      paths.push(R(tX, tY, tW, tH))  // table
      const cW = 10, cH = 8, gap = 4
      const cols = Math.max(2, Math.min(4, Math.floor(tW / (cW + gap))))
      const startCX = tX + (tW - cols * (cW + gap) + gap) / 2
      for (let i = 0; i < cols; i++) {
        const cx = startCX + i * (cW + gap)
        paths.push(R(cx, tY - cH - 3, cW, cH))
        paths.push(R(cx, tY + tH + 3, cW, cH))
      }
      paths.push(R(tX - cH - 3, tY + (tH - cW) / 2, cH, cW))  // left chair
      paths.push(R(tX + tW + 3, tY + (tH - cW) / 2, cH, cW))  // right chair
      break
    }
    case 'Garage': {
      // 2 car outlines: rectangles with windshield line
      const carW = Math.min((w - 3*P) / 2, 56), carH = Math.min(h - 2*P, 28)
      const carY = y + (h - carH) / 2
      if (w > 110) {
        const c1x = x + P, c2x = x + 2*P + carW
        paths.push(R(c1x, carY, carW, carH))
        paths.push(L(c1x + 5, carY + 7, c1x + carW - 5, carY + 7))
        paths.push(R(c2x, carY, carW, carH))
        paths.push(L(c2x + 5, carY + 7, c2x + carW - 5, carY + 7))
      } else {
        const cW2 = Math.min(w - 2*P, 56), cX = x + (w - cW2) / 2
        paths.push(R(cX, carY, cW2, carH))
        paths.push(L(cX + 5, carY + 7, cX + cW2 - 5, carY + 7))
      }
      break
    }
    case 'Laundry': {
      const mS = Math.min(w - 2*P, h - 2*P, 32)
      const mX = x + (w - mS) / 2, mY = y + (h - mS) / 2
      paths.push(R(mX, mY, mS, mS))
      paths.push(C(mX + mS/2, mY + mS/2, mS * 0.28))
      break
    }
    case 'Study':
    case 'Home Office': {
      const dW = Math.min(w - 2*P, 60), dD = 10
      paths.push(L(x+P, y+P, x+P+dW, y+P))         // desk top edge
      paths.push(L(x+P, y+P+dD, x+P+dW, y+P+dD))   // desk bottom edge
      break
    }
    case 'Theatre Room': {
      const sW = 11, sH = 9, sGx = 4, sGy = 6
      const cols = Math.max(2, Math.min(5, Math.floor((w - 2*P) / (sW + sGx))))
      const rows = Math.max(1, Math.min(3, Math.floor((h - 2*P - 10) / (sH + sGy))))
      const seatsW = cols * (sW + sGx) - sGx
      const sStartX = x + (w - seatsW) / 2
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const sx = sStartX + col * (sW + sGx), sy = y + P + 10 + row * (sH + sGy)
          if (sx + sW <= x + w - P && sy + sH <= y + h - P) paths.push(R(sx, sy, sW, sH))
        }
      }
      break
    }
    case 'Pool Deck': {
      const pW = Math.min(w - 4*P, w * 0.6), pH = Math.min(h - 2*P, h * 0.6)
      const pX = x + (w - pW) / 2, pY = y + (h - pH) / 2
      paths.push(`M ${pX+pW} ${pY+pH/2} a ${pW/2} ${pH/2} 0 1 0 ${-pW} 0 a ${pW/2} ${pH/2} 0 1 0 ${pW} 0`)
      break
    }
    case 'Alfresco': {
      const r = Math.min(w, h) * 0.18
      paths.push(C(x + w/2, y + h/2, r))
      break
    }
  }
  return paths.filter(Boolean)
}

function FurnitureLayer({ rooms, zoom, CW, CH }) {
  if (!rooms.length) return null
  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: CW, height: CH,
      transform: `scale(${zoom})`, transformOrigin: 'top left',
      pointerEvents: 'none', zIndex: 8,
    }}>
      {rooms.map(room => {
        if (room.type === 'Corridor') return null
        return getFurniturePaths(room).map((d, i) => (
          <path key={`${room.id}-f${i}`} d={d}
            stroke="rgba(0,0,0,0.4)" strokeWidth={1} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))
      })}
    </svg>
  )
}

// ─── wall overlay ─────────────────────────────────────────────────────────────
const TOL = 4
const DOOR_W = 34
const WALL_EXT = 11
const WALL_INT = 7

function isAdj(room, side, others) {
  const { x, y, w, h } = room
  return others.some(o => {
    if (o.id === room.id) return false
    if (side === 'N') return Math.abs(y - (o.y + o.h)) <= TOL && Math.max(x, o.x) < Math.min(x + w, o.x + o.w) - TOL
    if (side === 'S') return Math.abs((y + h) - o.y) <= TOL && Math.max(x, o.x) < Math.min(x + w, o.x + o.w) - TOL
    if (side === 'W') return Math.abs(x - (o.x + o.w)) <= TOL && Math.max(y, o.y) < Math.min(y + h, o.y + o.h) - TOL
    if (side === 'E') return Math.abs((x + w) - o.x) <= TOL && Math.max(y, o.y) < Math.min(y + h, o.y + o.h) - TOL
    return false
  })
}

function doorSideFor(room, others) {
  const pref = ['S', 'N', 'E', 'W']
  return pref.find(s => isAdj(room, s, others)) ?? 'S'
}

function wallPath(room, side, door) {
  const { x, y, w, h } = room
  const isDoor = side === door
  if (side === 'N') {
    if (!isDoor) return `M ${x} ${y} L ${x + w} ${y}`
    const m = x + w / 2
    return `M ${x} ${y} L ${m - DOOR_W / 2} ${y} M ${m + DOOR_W / 2} ${y} L ${x + w} ${y}`
  }
  if (side === 'S') {
    if (!isDoor) return `M ${x} ${y + h} L ${x + w} ${y + h}`
    const m = x + w / 2
    return `M ${x} ${y + h} L ${m - DOOR_W / 2} ${y + h} M ${m + DOOR_W / 2} ${y + h} L ${x + w} ${y + h}`
  }
  if (side === 'W') {
    if (!isDoor) return `M ${x} ${y} L ${x} ${y + h}`
    const m = y + h / 2
    return `M ${x} ${y} L ${x} ${m - DOOR_W / 2} M ${x} ${m + DOOR_W / 2} L ${x} ${y + h}`
  }
  // E
  if (!isDoor) return `M ${x + w} ${y} L ${x + w} ${y + h}`
  const m = y + h / 2
  return `M ${x + w} ${y} L ${x + w} ${m - DOOR_W / 2} M ${x + w} ${m + DOOR_W / 2} L ${x + w} ${y + h}`
}

function doorArcPath(room, side) {
  const { x, y, w, h } = room
  const R = DOOR_W
  if (side === 'S') {
    const hx = x + w / 2 - R / 2, hy = y + h
    return `M ${hx} ${hy} L ${hx} ${hy - R} A ${R} ${R} 0 0 1 ${hx + R} ${hy}`
  }
  if (side === 'N') {
    const hx = x + w / 2 - R / 2, hy = y
    return `M ${hx} ${hy} L ${hx} ${hy + R} A ${R} ${R} 0 0 0 ${hx + R} ${hy}`
  }
  if (side === 'W') {
    const hx = x, hy = y + h / 2 - R / 2
    return `M ${hx} ${hy} L ${hx + R} ${hy} A ${R} ${R} 0 0 1 ${hx} ${hy + R}`
  }
  // E
  const hx = x + w, hy = y + h / 2 - R / 2
  return `M ${hx} ${hy} L ${hx - R} ${hy} A ${R} ${R} 0 0 0 ${hx} ${hy + R}`
}

function WallOverlay({ rooms, zoom, CW, CH }) {
  if (!rooms.length) return null
  const elements = []
  rooms.forEach(room => {
    const door = room.type === 'Corridor' ? null : doorSideFor(room, rooms)
    const walls = ['N', 'S', 'E', 'W'].map(side => {
      const internal = isAdj(room, side, rooms)
      const sw = internal ? WALL_INT : WALL_EXT
      return (
        <path key={`${room.id}-${side}`}
          d={wallPath(room, side, door)}
          stroke="#1c1c1c" strokeWidth={sw} strokeLinecap="square" fill="none" />
      )
    })
    elements.push(...walls)
    if (door) {
      elements.push(
        <path key={`${room.id}-arc`}
          d={doorArcPath(room, door)}
          stroke="#1c1c1c" strokeWidth={1.2} strokeLinecap="round" fill="none" />
      )
    }
  })
  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: CW, height: CH,
      transform: `scale(${zoom})`, transformOrigin: 'top left',
      pointerEvents: 'none', zIndex: 15,
    }}>
      {elements}
    </svg>
  )
}

function DimensionLines({ rooms, zoom, CW, CH }) {
  const valid = rooms.filter(r => r.type !== 'Corridor')
  if (!valid.length) return null
  const minX = Math.min(...valid.map(r => r.x))
  const maxX = Math.max(...valid.map(r => r.x + r.w))
  const minY = Math.min(...valid.map(r => r.y))
  const maxY = Math.max(...valid.map(r => r.y + r.h))
  const W = ((maxX - minX) / MPX).toFixed(1)
  const H = ((maxY - minY) / MPX).toFixed(1)
  const P = 32
  const tc = '#888'
  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: CW, height: CH,
      transform: `scale(${zoom})`, transformOrigin: 'top left',
      pointerEvents: 'none', zIndex: 25,
    }}>
      {/* Width — bottom */}
      <line x1={minX} y1={maxY + P} x2={maxX} y2={maxY + P} stroke={tc} strokeWidth={1} />
      <line x1={minX} y1={maxY + P - 5} x2={minX} y2={maxY + P + 5} stroke={tc} strokeWidth={1} />
      <line x1={maxX} y1={maxY + P - 5} x2={maxX} y2={maxY + P + 5} stroke={tc} strokeWidth={1} />
      <text x={(minX + maxX) / 2} y={maxY + P + 15} textAnchor="middle"
        fontSize="11" fill={tc} fontFamily="system-ui,sans-serif" fontWeight="600">{W}m</text>
      {/* Height — left */}
      <line x1={minX - P} y1={minY} x2={minX - P} y2={maxY} stroke={tc} strokeWidth={1} />
      <line x1={minX - P - 5} y1={minY} x2={minX - P + 5} y2={minY} stroke={tc} strokeWidth={1} />
      <line x1={minX - P - 5} y1={maxY} x2={minX - P + 5} y2={maxY} stroke={tc} strokeWidth={1} />
      <text
        x={minX - P - 18} y={(minY + maxY) / 2}
        textAnchor="middle" fontSize="11" fill={tc}
        fontFamily="system-ui,sans-serif" fontWeight="600"
        transform={`rotate(-90,${minX - P - 18},${(minY + maxY) / 2})`}
      >{H}m</text>
    </svg>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────
const IconSelect  = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 1.5l3.5 9.5 2-4.5 4.5-2L2 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
const IconDraw    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.4"/><rect x="7.5" y="7.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 4h3M9 5.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IconRuler   = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="4" width="11" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M4 4v2M6.5 4v3M9 4v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
const IconZoomIn  = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/><path d="M9 9l2.5 2.5M4 5.5h3M5.5 4v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IconZoomOut = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/><path d="M9 9l2.5 2.5M4 5.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IconUndo    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 5h5a3.5 3.5 0 010 7H4M2 5l2.5-2.5M2 5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
