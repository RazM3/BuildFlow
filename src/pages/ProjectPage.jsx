import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportQuotePDF } from '../lib/generatePDF'

// ─── constants ────────────────────────────────────────────────────────────────
const GRID = 20
const MPX  = 40

const ROOM_DEFS = [
  { type: 'Living Room',    color: '#dbeafe', stroke: '#93c5fd', w: 200, h: 160, rate: 1800 },
  { type: 'Kitchen',        color: '#fef3c7', stroke: '#fcd34d', w: 160, h: 120, rate: 3200, flat: 20000 },
  { type: 'Bedroom',        color: '#ede9fe', stroke: '#c4b5fd', w: 160, h: 120, rate: 1600 },
  { type: 'Master Bedroom', color: '#ede9fe', stroke: '#a78bfa', w: 200, h: 160, rate: 1800 },
  { type: 'Bathroom',       color: '#cffafe', stroke: '#67e8f9', w:  80, h:  80, rate: 4500, flat: 8000 },
  { type: 'Ensuite',        color: '#cffafe', stroke: '#22d3ee', w: 100, h:  80, rate: 4200, flat: 6000 },
  { type: 'Walk-in Robe',   color: '#fdf4ff', stroke: '#e879f9', w: 100, h:  60, rate:  600, flat: 3000 },
  { type: 'Foyer',          color: '#f8fafc', stroke: '#94a3b8', w: 120, h:  80, rate:  800 },
  { type: 'Garage',         color: '#f1f5f9', stroke: '#cbd5e1', w: 240, h: 200, rate:  800 },
  { type: 'Alfresco',       color: '#dcfce7', stroke: '#86efac', w: 160, h: 120, rate:  600 },
  { type: 'Dining Room',    color: '#fce7f3', stroke: '#f9a8d4', w: 160, h: 120, rate: 1800 },
  { type: 'Theatre Room',   color: '#fef9c3', stroke: '#fde047', w: 200, h: 160, rate: 2200 },
  { type: 'Study',          color: '#f0fdf4', stroke: '#6ee7b7', w: 120, h: 120, rate: 1600 },
  { type: 'Pool Deck',      color: '#e0f2fe', stroke: '#38bdf8', w: 240, h: 120, rate:  400 },
  { type: 'Laundry',        color: '#f0f9ff', stroke: '#7dd3fc', w: 100, h:  80, rate: 2800, flat: 3000 },
  { type: 'Home Gym',       color: '#fdf4ff', stroke: '#d946ef', w: 200, h: 160, rate: 1200 },
  { type: 'Walk-in Pantry', color: '#fff7ed', stroke: '#fb923c', w: 100, h:  80, rate: 1400 },
  { type: 'Mudroom',        color: '#f7fee7', stroke: '#84cc16', w: 120, h:  80, rate: 1100 },
  { type: 'Home Office',    color: '#ecfdf5', stroke: '#4ade80', w: 140, h: 120, rate: 1600 },
  { type: 'Workshop',       color: '#fafaf9', stroke: '#a8a29e', w: 200, h: 160, rate:  900 },
  { type: 'Corridor',       color: '#f1f5f9', stroke: '#94a3b8', w: 200, h:  48, rate:    0 },
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
const ROOF_OPTS  = ['Colorbond', 'Concrete Tiles', 'Terracotta', 'Flat Roof']
const STYLES     = ['Modern', 'Coastal', 'Hamptons', 'Industrial']
const FINISHES   = {
  Kitchen:  ['Entry Level', 'Mid Range', 'Premium', 'Luxury'],
  Flooring: ["Builder's Grade", 'Standard', 'Premium'],
  Windows:  ['Aluminium', 'Timber', 'uPVC'],
}
const STYLE_THEMES = {
  Modern:     { fill: '#ffffff', wall: '#1a1a1a' },
  Coastal:    { fill: '#e8f4fd', wall: '#1a3a5c' },
  Hamptons:   { fill: '#fdf6e3', wall: '#1a3a5c' },
  Industrial: { fill: '#e8e8e8', wall: '#111111' },
}
const WALL_MULT  = { 'Brick Veneer': 1.0, 'Double Brick': 1.22, 'Timber Frame': 0.84, 'Steel Frame': 0.95 }
const FLOOR_MULT = { 'Tile': 1.0, 'Timber': 1.15, 'Carpet': 0.9, 'Polished Concrete': 1.1, 'Vinyl Plank': 0.94 }
const ROOF_MULT  = { 'Colorbond': 1.0, 'Concrete Tiles': 1.05, 'Terracotta': 1.12, 'Flat Roof': 0.93 }
const CLIENT_FLOOR_OPTS   = ['Timber', 'Tiles', 'Carpet', 'Concrete']
const CLIENT_WALL_OPTS    = ['Painted', 'Rendered', 'Brick']
const CLIENT_KITCHEN_OPTS = ['Standard', 'Premium', 'Luxury']
const BUDGET_TIERS = [
  { id: 'affordable', label: 'Keep it affordable' },
  { id: 'midrange',   label: 'Mid range'           },
  { id: 'premium',    label: 'Premium finish'      },
]
const STATUS_OPTS = ['Draft', 'Quote Sent', 'In Progress', 'Completed']
const AI_MODEL    = 'claude-sonnet-4-6'

// ─── client material catalog ─────────────────────────────────────────────────
const MAT_PATTERNS = {
  carpet:   'repeating-linear-gradient(45deg,rgba(0,0,0,.05) 0,rgba(0,0,0,.05) 1px,transparent 0,transparent 7px),repeating-linear-gradient(-45deg,rgba(0,0,0,.05) 0,rgba(0,0,0,.05) 1px,transparent 0,transparent 7px)',
  timber:   'repeating-linear-gradient(180deg,rgba(0,0,0,.07) 0,rgba(0,0,0,.07) 1px,transparent 0,transparent 11px)',
  tiles:    'repeating-linear-gradient(90deg,rgba(0,0,0,.09) 0,rgba(0,0,0,.09) 1px,transparent 0,transparent 20px),repeating-linear-gradient(0deg,rgba(0,0,0,.09) 0,rgba(0,0,0,.09) 1px,transparent 0,transparent 20px)',
  concrete: '',
  pavers:   'repeating-linear-gradient(90deg,rgba(0,0,0,.08) 0,rgba(0,0,0,.08) 1px,transparent 0,transparent 16px),repeating-linear-gradient(0deg,rgba(0,0,0,.08) 0,rgba(0,0,0,.08) 1px,transparent 0,transparent 10px)',
}
const ROOM_MAT_CATALOG = {
  bedroom: {
    match: t => ['Master Bedroom','Bedroom','Walk-in Robe'].includes(t),
    categories: {
      Flooring: [
        { id:'carpet',  label:'Carpet',  color:'#d4b896', pattern:'carpet'   },
        { id:'timber',  label:'Timber',  color:'#c8a46e', pattern:'timber'   },
        { id:'tiles',   label:'Tiles',   color:'#d8d8d4', pattern:'tiles'    },
        { id:'vinyl',   label:'Vinyl',   color:'#c8c8c0', pattern:'timber'   },
      ],
      Walls: [
        { id:'painted',   label:'Painted',      color:'#f2f0ec' },
        { id:'feature',   label:'Feature Wall', color:'#c8b8a8' },
        { id:'wallpaper', label:'Wallpaper',    color:'#e0d4c4' },
      ],
    },
  },
  living: {
    match: t => ['Living Room','Dining Room','Theatre Room','Study','Home Office','Home Gym','Lounge'].includes(t),
    categories: {
      Flooring: [
        { id:'timber',   label:'Timber',           color:'#c8a46e', pattern:'timber'   },
        { id:'concrete', label:'Polished Concrete', color:'#b8b8b4', pattern:'concrete' },
        { id:'tiles',    label:'Tiles',             color:'#d8d8d4', pattern:'tiles'    },
        { id:'vinyl',    label:'Vinyl Plank',       color:'#c8b898', pattern:'timber'   },
      ],
      Walls: [
        { id:'painted', label:'Painted',       color:'#f2f0ec' },
        { id:'brick',   label:'Exposed Brick', color:'#c4956a' },
        { id:'feature', label:'Feature Wall',  color:'#c8b8a8' },
      ],
    },
  },
  kitchen: {
    match: t => ['Kitchen','Walk-in Pantry'].includes(t),
    categories: {
      Benchtop: [
        { id:'stone',    label:'Stone',    color:'#c8c4c0' },
        { id:'timber',   label:'Timber',   color:'#c8a46e', pattern:'timber' },
        { id:'laminate', label:'Laminate', color:'#e8e8e4' },
      ],
      Cabinets: [
        { id:'white',    label:'White',       color:'#f0f0ec' },
        { id:'charcoal', label:'Charcoal',    color:'#4a4a4a' },
        { id:'navy',     label:'Navy',        color:'#1a3a5c' },
        { id:'timber',   label:'Timber Look', color:'#c8a46e' },
      ],
      Splashback: [
        { id:'tiles', label:'Tiles', color:'#e0e0dc', pattern:'tiles'  },
        { id:'glass', label:'Glass', color:'#d4e8f0' },
        { id:'stone', label:'Stone', color:'#c8c4c0' },
      ],
    },
  },
  bathroom: {
    match: t => ['Bathroom','Ensuite','Laundry'].includes(t),
    categories: {
      'Floor Tiles': [
        { id:'white',  label:'White',       color:'#f5f5f0', pattern:'tiles' },
        { id:'grey',   label:'Grey',        color:'#a8a8a4', pattern:'tiles' },
        { id:'black',  label:'Black',       color:'#2a2a2a', pattern:'tiles' },
        { id:'marble', label:'Marble Look', color:'#e8e4e0', pattern:'tiles' },
      ],
      'Wall Tiles': [
        { id:'white',  label:'White',        color:'#f5f5f0' },
        { id:'grey',   label:'Grey',         color:'#c8c8c4' },
        { id:'subway', label:'Subway Tiles', color:'#e8e8e4', pattern:'tiles' },
        { id:'marble', label:'Marble',       color:'#e8e4e0' },
      ],
    },
  },
  alfresco: {
    match: t => ['Alfresco','Pool Deck'].includes(t),
    categories: {
      Flooring: [
        { id:'concrete', label:'Concrete', color:'#c0c0bc', pattern:'concrete' },
        { id:'decking',  label:'Decking',  color:'#c8a46e', pattern:'timber'   },
        { id:'pavers',   label:'Pavers',   color:'#b8b0a4', pattern:'pavers'   },
      ],
      Style: [
        { id:'open',     label:'Open',     color:'#86efac' },
        { id:'roofed',   label:'Roofed',   color:'#6ee7b7' },
        { id:'enclosed', label:'Enclosed', color:'#34d399' },
      ],
    },
  },
  other: {
    match: () => true,
    categories: {
      Flooring: [
        { id:'carpet',   label:'Carpet',   color:'#d4b896', pattern:'carpet'   },
        { id:'timber',   label:'Timber',   color:'#c8a46e', pattern:'timber'   },
        { id:'tiles',    label:'Tiles',    color:'#d8d8d4', pattern:'tiles'    },
        { id:'concrete', label:'Concrete', color:'#b8b8b4', pattern:'concrete' },
      ],
    },
  },
}
const getRoomCatalog = type => Object.values(ROOM_MAT_CATALOG).find(c => c.match(type)) ?? ROOM_MAT_CATALOG.other
const getMatOption = (type, cat, id) => getRoomCatalog(type).categories[cat]?.find(o => o.id === id)
const getMatBgStyle = (type, mats) => {
  if (!mats) return {}
  const cat  = getRoomCatalog(type)
  // primary visual = first category that has a selection with a color
  const primaryCat = Object.keys(cat.categories)[0]
  const sel = mats[primaryCat]
  if (!sel) return {}
  const opt = cat.categories[primaryCat]?.find(o => o.id === sel)
  if (!opt) return {}
  const bg = opt.pattern ? `${MAT_PATTERNS[opt.pattern]},` : ''
  return { background: `${bg}${opt.color}` }
}
const getRoomSelectionSummary = (rooms) =>
  rooms.filter(r => r.clientMaterials && Object.keys(r.clientMaterials).length > 0)
    .map(r => {
      const entries = Object.entries(r.clientMaterials)
        .map(([cat, id]) => getMatOption(r.type, cat, id)?.label)
        .filter(Boolean)
      return entries.length ? { name: r.type, choices: entries.join(', ') } : null
    }).filter(Boolean)

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

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
const FLOOR_TEMPLATES = [
  {
    id: 'aussie_family',
    name: 'The Aussie Family',
    desc: '4 bed · 2 bath · Double garage · Alfresco',
    size: '320m²',
    params: { houseSize: 320, bedrooms: 4, bathrooms: 2, extras: [], singleGarage: false },
  },
  {
    id: 'first_home',
    name: 'First Home Starter',
    desc: '3 bed · 1 bath · Single garage · Alfresco',
    size: '220m²',
    params: { houseSize: 220, bedrooms: 3, bathrooms: 1, extras: [], singleGarage: true },
  },
  {
    id: 'executive',
    name: 'The Executive',
    desc: '4 bed · 2 bath · Theatre · Study · Large alfresco',
    size: '450m²',
    params: { houseSize: 450, bedrooms: 4, bathrooms: 2, extras: ['Theatre Room', 'Study'], singleGarage: false },
  },
]

function generateFloorPlan({ houseSize = 320, bedrooms = 4, bathrooms = 2, extras = [], singleGarage = false }) {
  const rooms = []
  const sf = Math.sqrt(houseSize / 320)
  const sc = v => Math.max(GRID * 2, Math.round(v * sf / GRID) * GRID)
  const OX = 80, OY = 100

  const mk = (type, x, y, w, h) => {
    const def = ROOM_DEFS.find(d => d.type === type) ?? ROOM_DEFS[0]
    const r = { id: uid++, type, x: snap(x), y: snap(y), w: snap(w), h: snap(h), color: def.color, stroke: def.stroke }
    rooms.push(r)
    return r
  }

  // ── Base dimensions (sf=1 = 320m² standard family home) ──
  const garW  = singleGarage ? sc(160) : sc(320)  // single 4m or double 8m garage
  const garH  = sc(240)                             // 6m garage depth
  const foyW  = sc(120)                             // 3m foyer width
  const mBW   = sc(200)                             // 5m master suite column width
  const mBH   = sc(160)                             // 4m master bed depth
  const wirW  = snap(mBW / 2)                       // half master width = 2.5m WIR
  const wirH  = garH - mBH                          // fills remaining front zone height
  const ensW  = mBW - wirW                          // ensuite fills other half
  const ensH  = wirH

  // Total house width driven by front zone (garage + foyer + master suite)
  const totalW = garW + foyW + mBW

  const hallH     = sc(60)                          // 1.5m corridor
  const minBH     = sc(120)                         // 3m minor bedroom depth
  const openPlanH = sc(200)                         // 5m open plan depth (living room drives height)
  const alfH      = extras.includes('Study') ? sc(180) : sc(140)  // executive gets larger alfresco

  // Open plan widths must sum to totalW
  const lauW = sc(120)                              // 3m laundry
  const kitW = sc(160)                              // 4m kitchen
  const dinW = sc(160)                              // 4m dining
  const livW = totalW - lauW - kitW - dinW          // living fills remainder

  // ─── Band 1: Front zone — Garage | Foyer | Master suite ───────────────────
  let y = OY

  mk('Garage', OX, y, garW, garH)
  mk('Foyer', OX + garW, y, foyW, garH)             // foyer spans full front zone height

  // Master bed (top of master column)
  mk('Master Bedroom', OX + garW + foyW, y, mBW, mBH)
  // WIR + Ensuite side by side below master
  mk('Walk-in Robe', OX + garW + foyW,        y + mBH, wirW, wirH)
  mk('Ensuite',      OX + garW + foyW + wirW, y + mBH, ensW, ensH)

  y += garH

  // ─── Band 2: Main hall ────────────────────────────────────────────────────
  mk('Corridor', OX, y, totalW, hallH)
  y += hallH

  // ─── Band 3: Minor bedrooms + family bathroom ─────────────────────────────
  const numMinorBeds  = Math.max(0, bedrooms - 1)
  const numFamilyBath = Math.max(1, bathrooms - 1)  // always at least 1 family bath
  const numBedItems   = numMinorBeds + numFamilyBath
  if (numBedItems > 0) {
    const rw = snap(totalW / numBedItems)
    let bx = OX
    ;[...Array(numMinorBeds).fill('Bedroom'), ...Array(numFamilyBath).fill('Bathroom')].forEach((type, i) => {
      const w = i === numBedItems - 1 ? (OX + totalW - bx) : rw
      mk(type, bx, y, w, minBH)
      bx += rw
    })
    y += minBH
  }

  // ─── Band 3b: Optional extras (Theatre Room, etc.) ────────────────────────
  const extraRoomList = ['Theatre Room', 'Home Gym', 'Home Office', 'Workshop']
  const activeExtras = extras.filter(t => extraRoomList.includes(t))
  if (activeExtras.length > 0) {
    const exW = snap(totalW / activeExtras.length)
    let ex = OX
    activeExtras.forEach((t, i) => {
      const w = i === activeExtras.length - 1 ? (OX + totalW - ex) : exW
      mk(t, ex, y, w, sc(120))
      ex += exW
    })
    y += sc(120)
  }

  // ─── Band 4: Second hall leading to open plan ─────────────────────────────
  mk('Corridor', OX, y, totalW, hallH)
  y += hallH

  // ─── Band 5: Open plan zone — Laundry | Kitchen | Dining | Living ─────────
  mk('Laundry',     OX,                        y, lauW, openPlanH)
  mk('Kitchen',     OX + lauW,                 y, kitW, openPlanH)
  mk('Dining Room', OX + lauW + kitW,          y, dinW, openPlanH)
  mk('Living Room', OX + lauW + kitW + dinW,   y, livW, openPlanH)
  y += openPlanH

  // ─── Band 6: Alfresco (outdoor entertaining) ──────────────────────────────
  mk('Alfresco', OX, y, totalW, alfH)

  // ─── Study in foyer column (Executive template) ───────────────────────────
  // (Foyer already occupies that column full-height; Study is added as separate room on extras row)

  // ─── Default open walls ───────────────────────────────────────────────────
  // Kitchen/Dining/Living open plan; Alfresco sliding doors to Living+Dining
  const DEFAULT_OPEN = {
    'Living Room': new Set(['Kitchen', 'Dining Room', 'Alfresco']),
    'Kitchen':     new Set(['Living Room', 'Dining Room']),
    'Dining Room': new Set(['Kitchen', 'Living Room', 'Alfresco']),
    'Alfresco':    new Set(['Living Room', 'Dining Room']),
  }
  const roomsAdj = (a, b) => {
    const DT = 8
    return (
      (Math.abs((a.x + a.w) - b.x) <= DT && Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h) - DT) ||
      (Math.abs((b.x + b.w) - a.x) <= DT && Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h) - DT) ||
      (Math.abs((a.y + a.h) - b.y) <= DT && Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w) - DT) ||
      (Math.abs((b.y + b.h) - a.y) <= DT && Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w) - DT)
    )
  }
  const openWallKeys = []
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j]
      const aSet = DEFAULT_OPEN[a.type]
      if (aSet?.has(b.type) && roomsAdj(a, b)) openWallKeys.push(wallKey(a.id, b.id))
    }
  }

  return { rooms, openWallKeys }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const snap    = v => Math.round(v / GRID) * GRID
const wallKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`
const pxToM   = px => (px / MPX).toFixed(1)
const fmtAUD = n => '$' + Math.round(n).toLocaleString('en-AU')
const cost   = r => {
  const d = ROOM_DEFS.find(x => x.type === r.type)
  return d ? (r.w / MPX) * (r.h / MPX) * d.rate + (d.flat || 0) : 0
}

const parseAIResponse = text => {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { const p = JSON.parse(clean); if (p.message) return p } catch {}
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s !== -1 && e > s) { try { const p = JSON.parse(clean.slice(s, e + 1)); if (p.message) return p } catch {} }
  return { message: text, action: null }
}

const getAISuggestions = rooms => {
  const types = new Set(rooms.map(r => r.type))
  const s = []
  if (types.has('Master Bedroom')) s.push('Make the master bedroom bigger')
  if (types.has('Kitchen') && types.has('Living Room')) s.push('Open up kitchen to living')
  if (!types.has('Study')) s.push('Add a home study')
  if (!types.has('Theatre Room')) s.push('Add a home theatre')
  if (types.has('Alfresco')) s.push('Extend the alfresco')
  if (!types.has('Walk-in Pantry')) s.push('Add a walk-in pantry')
  return s.slice(0, 3)
}

const getBuilderAISuggestions = () => [
  'How can I cut 10% off the budget?',
  "What's the cost impact of double brick?",
  'Which room costs the most per sqm?',
]

let uid = 1

// ─── AI chat panels ───────────────────────────────────────────────────────────
function ClientAIPanel({ messages, loading, input, setInput, onSend, onClose, suggestions, onSuggestion, width, onResizeStart }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const SparkleIcon = ({ size = 10 }) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1v2.5M6 8.5V11M1 6h2.5M8.5 6H11M2.9 2.9l1.8 1.8M7.3 7.3l1.8 1.8M9.1 2.9L7.3 4.7M4.7 7.3L2.9 9.1"
        stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-100 relative overflow-hidden" style={{ width }}>
      {/* Resize drag handle */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-[#1a3a5c]/10 transition"
        onMouseDown={onResizeStart} />

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[#1a3a5c] to-[#2d6a9f] rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <SparkleIcon size={11} />
          </div>
          <div>
            <p className="text-[#1a3a5c] font-bold text-sm leading-none">Design Assistant</p>
            <p className="text-gray-300 text-[10px] mt-0.5">Powered by Claude AI</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition cursor-pointer p-1 rounded-lg hover:bg-gray-50">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1a3a5c]/8 to-[#2d6a9f]/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#1a3a5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[#1a3a5c] font-bold text-sm">Hi! I'm your design assistant.</p>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">I can resize rooms, open walls, add or remove spaces — just ask me anything about your home design.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-1.5`}>
            {m.role === 'ai' && (
              <div className="w-5 h-5 bg-gradient-to-br from-[#1a3a5c] to-[#2d6a9f] rounded-full flex items-center justify-center shrink-0 mb-0.5">
                <SparkleIcon size={8} />
              </div>
            )}
            <div className={`max-w-[84%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-[#1a3a5c] text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-700 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-1.5">
            <div className="w-5 h-5 bg-gradient-to-br from-[#1a3a5c] to-[#2d6a9f] rounded-full flex items-center justify-center shrink-0 mb-0.5">
              <SparkleIcon size={8} />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                    style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestion chips */}
      {suggestions.length > 0 && !loading && messages.length < 6 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onSuggestion(s)}
              className="text-[10px] text-[#1a3a5c] bg-[#1a3a5c]/5 hover:bg-[#1a3a5c]/10 border border-[#1a3a5c]/15 hover:border-[#1a3a5c]/30 rounded-full px-2.5 py-1 transition cursor-pointer leading-none">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100 focus-within:border-[#1a3a5c]/30 focus-within:bg-white transition">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input) } }}
            placeholder="Ask me to change anything…"
            rows={1}
            className="flex-1 text-[11px] bg-transparent outline-none resize-none text-gray-700 placeholder:text-gray-300 max-h-20 leading-relaxed"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || loading}
            className="w-7 h-7 bg-[#1a3a5c] hover:bg-[#243f63] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition cursor-pointer shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 8.5L8.5 5L1.5 1.5V4.5L6 5L1.5 5.5V8.5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function BuilderAIFloat({ messages, loading, input, setInput, onSend, onClose, suggestions, onSuggestion }) {
  const bottomRef = useRef(null)
  const [pos, setPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 440 : 400, y: 80 })
  const dragState = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const onDragStart = e => {
    e.preventDefault()
    dragState.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y }
    const onMove = me => {
      if (!dragState.current) return
      setPos({ x: me.clientX - dragState.current.startX, y: me.clientY - dragState.current.startY })
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const SparkIcon = () => (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v2.5M6 8.5V11M1 6h2.5M8.5 6H11M2.9 2.9l1.8 1.8M7.3 7.3l1.8 1.8M9.1 2.9L7.3 4.7M4.7 7.3L2.9 9.1"
        stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 400, zIndex: 200 }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
      {/* Draggable header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e4d7b] flex items-center justify-between cursor-move select-none"
        onMouseDown={onDragStart}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
            <SparkIcon />
          </div>
          <div>
            <p className="text-white font-semibold text-xs">AI Cost Advisor</p>
            <p className="text-white/50 text-[9px]">Powered by Claude</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white transition cursor-pointer"
          onMouseDown={e => e.stopPropagation()}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto px-3 py-3 space-y-2.5" style={{ minHeight: 200, maxHeight: 380 }}>
        {messages.length === 0 && !loading && (
          <div className="text-center py-6 px-3">
            <p className="text-[#1a3a5c] font-semibold text-xs">Your AI cost advisor.</p>
            <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">Ask about costs, materials, value engineering, or design trade-offs.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5 items-end`}>
            {m.role === 'ai' && (
              <div className="w-5 h-5 bg-[#1a3a5c] rounded-full flex items-center justify-center shrink-0 mb-0.5">
                <SparkIcon />
              </div>
            )}
            <div className={`max-w-[84%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
              m.role === 'user' ? 'bg-[#1a3a5c] text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-1.5 items-end">
            <div className="w-5 h-5 bg-[#1a3a5c] rounded-full flex items-center justify-center shrink-0 mb-0.5">
              <SparkIcon />
            </div>
            <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                    style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && !loading && messages.length < 4 && (
        <div className="px-3 py-2 flex flex-wrap gap-1 border-t border-gray-50">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onSuggestion(s)}
              className="text-[10px] text-[#1a3a5c] bg-[#1a3a5c]/5 hover:bg-[#1a3a5c]/10 border border-[#1a3a5c]/15 rounded-full px-2 py-0.5 transition cursor-pointer">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-50 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 focus-within:border-[#1a3a5c]/30 transition">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input) } }}
            placeholder="Ask about costs or design…"
            rows={1}
            className="flex-1 text-[11px] bg-transparent outline-none resize-none text-gray-700 placeholder:text-gray-300 max-h-16"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || loading}
            className="w-6 h-6 bg-[#1a3a5c] hover:bg-[#243f63] disabled:opacity-30 text-white rounded-lg flex items-center justify-center transition cursor-pointer shrink-0">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 8.5L8.5 5L1.5 1.5V4.5L6 5L1.5 5.5V8.5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function ProjectPage({ clientOnly = false }) {
  const { id }             = useParams()
  const navigate           = useNavigate()
  const location           = useLocation()
  const [searchParams]     = useSearchParams()
  const isNew              = id === 'new'

  const [project,    setProject]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState(() => clientOnly ? 'client' : (searchParams.get('view') === 'client' ? 'client' : 'builder'))
  const [rooms,      setRooms]      = useState([])
  const [openWalls,  setOpenWalls]  = useState(() => new Set())
  const [selId,      setSelId]      = useState(null)
  const [tool,     setTool]     = useState('select')
  const [zoom,     setZoom]     = useState(1)
  const [history,  setHistory]  = useState([])
  const [wallType,      setWallType]      = useState('Brick Veneer')
  const [floorType,     setFloorType]     = useState('Tile')
  const [roofType,      setRoofType]      = useState('Colorbond')
  const [margin,        setMargin]        = useState(15)
  const [gstOn,         setGstOn]         = useState(true)
  const [builderNotes,  setBuilderNotes]  = useState('')
  const [budgetTier,    setBudgetTier]    = useState('midrange')
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
  const [catalogRoom,   setCatalogRoom]   = useState(null) // room id for per-room material dropdown
  const [showHelp,      setShowHelp]      = useState(() => clientOnly && !localStorage.getItem('bf_client_help'))
  // AI state
  const [aiClientOpen,  setAiClientOpen]  = useState(false)
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false)
  const [aiClientMsgs,  setAiClientMsgs]  = useState([])
  const [aiBuilderMsgs, setAiBuilderMsgs] = useState([])
  const [aiClientInput, setAiClientInput] = useState('')
  const [aiBuilderInput,setAiBuilderInput]= useState('')
  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiPanelWidth,  setAiPanelWidth]  = useState(380)
  const [highlightId,   setHighlightId]   = useState(null)

  const canvasRef     = useRef(null)
  const dragRef       = useRef(null)
  const zoomRef       = useRef(zoom)
  const hasLoadedRef  = useRef(false)
  const saveTimerRef  = useRef(null)
  const createdRef    = useRef(null)   // tracks ID after first-save of a new project
  const detailFormRef = useRef(detailForm)
  // stable refs for auto-save
  const roomsRef        = useRef(rooms)
  const openWallsRef    = useRef(openWalls)
  const wallTypeRef     = useRef(wallType)
  const floorTypeRef    = useRef(floorType)
  const roofTypeRef     = useRef(roofType)
  const marginRef       = useRef(margin)
  const gstOnRef        = useRef(gstOn)
  const builderNotesRef = useRef(builderNotes)
  const styleRef        = useRef(style)
  const budgetRef       = useRef(budget)
  const finishesRef     = useRef(finishes)
  const budgetTierRef   = useRef(budgetTier)
  const aiClientMsgsRef  = useRef([])
  const aiBuilderMsgsRef = useRef([])
  const messagesRef      = useRef(messages)

  useEffect(() => { detailFormRef.current     = detailForm },    [detailForm])
  useEffect(() => { zoomRef.current           = zoom },          [zoom])
  useEffect(() => { roomsRef.current          = rooms },         [rooms])
  useEffect(() => { openWallsRef.current      = openWalls },     [openWalls])
  useEffect(() => { wallTypeRef.current       = wallType },      [wallType])
  useEffect(() => { floorTypeRef.current      = floorType },     [floorType])
  useEffect(() => { roofTypeRef.current       = roofType },      [roofType])
  useEffect(() => { marginRef.current         = margin },        [margin])
  useEffect(() => { gstOnRef.current          = gstOn },         [gstOn])
  useEffect(() => { builderNotesRef.current   = builderNotes },  [builderNotes])
  useEffect(() => { styleRef.current          = style },         [style])
  useEffect(() => { budgetRef.current         = budget },        [budget])
  useEffect(() => { finishesRef.current       = finishes },      [finishes])
  useEffect(() => { budgetTierRef.current     = budgetTier },    [budgetTier])
  useEffect(() => { aiClientMsgsRef.current   = aiClientMsgs },  [aiClientMsgs])
  useEffect(() => { aiBuilderMsgsRef.current  = aiBuilderMsgs }, [aiBuilderMsgs])
  useEffect(() => { messagesRef.current       = messages },       [messages])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 2500)
    return () => clearTimeout(t)
  }, [highlightId])

  const roomCostFull = r => cost(r) * (WALL_MULT[wallType]||1) * (FLOOR_MULT[r.floorMat||floorType]||1) * (ROOF_MULT[roofType]||1)
  const baseCost   = rooms.reduce((s, r) => s + roomCostFull(r), 0)
  const withMargin = baseCost * (1 + margin / 100)
  const total      = gstOn ? withMargin * 1.1 : withMargin
  const totalSqm   = rooms.reduce((s, r) => s + (r.w / MPX) * (r.h / MPX), 0)
  const selRoom    = rooms.find(r => r.id === selId) ?? null

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
          const meta    = data.floor_plan.find(r => r.type === '_ow_')
          const aiMeta  = data.floor_plan.find(r => r.type === '_ai_')
          const msgMeta = data.floor_plan.find(r => r.type === '_msg_')
          const rms     = data.floor_plan.filter(r => !['_ow_','_ai_','_msg_'].includes(r.type))
          setRooms(rms)
          setOpenWalls(new Set(meta?.keys ?? []))
          if (aiMeta?.client)      setAiClientMsgs(aiMeta.client)
          if (aiMeta?.builder)     setAiBuilderMsgs(aiMeta.builder)
          if (msgMeta?.messages)   setMessages(msgMeta.messages)
          uid = Math.max(...rms.map(r => r.id || 0), 0) + 1
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
          floor_plan:      [...roomsRef.current, { type: '_ow_', keys: [...openWallsRef.current] }, { type: '_ai_', client: aiClientMsgsRef.current, builder: aiBuilderMsgsRef.current }, { type: '_msg_', messages: messagesRef.current }],
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
        floor_plan:      [...roomsRef.current, { type: '_ow_', keys: [...openWallsRef.current] }],
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
  }, [rooms, openWalls, wallType, floorType, roofType, margin, gstOn, builderNotes, style, budget, finishes, budgetTier, aiClientMsgs, aiBuilderMsgs, messages, saveProject])

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

  const loadGeneratedRooms = ({ rooms: generatedRooms, openWallKeys }) => {
    setHistory(h => [...h.slice(-19), rooms])
    setRooms(generatedRooms)
    setOpenWalls(new Set(openWallKeys ?? []))
    setSelId(null)
  }

  const toggleWall = useCallback((key) => {
    setOpenWalls(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // ── AI actions ─────────────────────────────────────────────────────────────
  const applyAIAction = useCallback((action) => {
    if (!action?.type) return
    switch (action.type) {
      case 'resize_room': {
        const target = roomsRef.current.find(r =>
          r.type.toLowerCase().includes((action.roomType || '').toLowerCase()))
        if (!target) break
        setRooms(prev => {
          const idx = prev.findIndex(r => r.id === target.id)
          if (idx === -1) return prev
          const r = {
            ...prev[idx],
            w: Math.max(GRID * 4, snap(prev[idx].w + (action.widthDelta || 0))),
            h: Math.max(GRID * 4, snap(prev[idx].h + (action.heightDelta || 0))),
          }
          return [...prev.slice(0, idx), r, ...prev.slice(idx + 1)]
        })
        setHighlightId(target.id)
        break
      }
      case 'add_room': {
        const def = ROOM_DEFS.find(d =>
          d.type.toLowerCase().includes((action.roomType || '').toLowerCase()))
        if (!def) break
        const maxY = roomsRef.current.reduce((m, r) => Math.max(m, r.y + r.h), 0)
        const newRoom = {
          id: uid++, type: def.type,
          x: 80, y: maxY + GRID * 2,
          w: snap(def.w), h: snap(def.h),
          color: def.color, stroke: def.stroke,
        }
        setRooms(prev => [...prev, newRoom])
        setHighlightId(newRoom.id)
        break
      }
      case 'remove_room': {
        setRooms(prev => {
          const idx = prev.findIndex(r =>
            r.type.toLowerCase().includes((action.roomType || '').toLowerCase()))
          return idx === -1 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)]
        })
        break
      }
      case 'toggle_wall': {
        const r1 = roomsRef.current.find(r => r.type.toLowerCase().includes((action.room1Type || '').toLowerCase()))
        const r2 = roomsRef.current.find(r => r.type.toLowerCase().includes((action.room2Type || '').toLowerCase()))
        if (r1 && r2) toggleWall(wallKey(r1.id, r2.id))
        break
      }
    }
  }, [toggleWall])

  const callAI = useCallback(async (history, systemPrompt) => {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1024, system: systemPrompt, messages: history }),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }, [])

  const sendClientAI = useCallback(async (userMsg) => {
    if (!userMsg.trim() || aiLoading) return
    setAiLoading(true)
    setAiClientMsgs(prev => [...prev, { role: 'user', text: userMsg, id: Date.now() }])
    setAiClientInput('')
    try {
      const roomSummary = roomsRef.current
        .map(r => `${r.type}: ${pxToM(r.w)}m × ${pxToM(r.h)}m`).join('; ')
      const system = `You are a friendly home design assistant helping a client customise their new home. Be warm and encouraging. Never mention costs or prices.

Current rooms: ${roomSummary}

When asked to change something respond with ONLY a valid JSON object:
{"message":"your friendly response","action":{"type":"resize_room","roomType":"Kitchen","widthDelta":40,"heightDelta":0}}

Action types: "resize_room" (widthDelta/heightDelta in px, 40px=1m), "add_room" (roomType), "remove_room" (roomType), "toggle_wall" (room1Type+room2Type).
If no change needed set "action":null. Always respond with valid JSON only.`
      const history = [
        ...aiClientMsgsRef.current.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: userMsg },
      ]
      const raw    = await callAI(history, system)
      const parsed = parseAIResponse(raw)
      setAiClientMsgs(prev => [...prev, { role: 'ai', text: parsed.message, id: Date.now() + 1 }])
      if (parsed.action) applyAIAction(parsed.action)
    } catch (e) {
      console.error(e)
      setAiClientMsgs(prev => [...prev, {
        role: 'ai', text: "Sorry, I couldn't connect. Make sure ANTHROPIC_API_KEY is set in .env.local and restart the dev server.", id: Date.now() + 1,
      }])
    } finally {
      setAiLoading(false)
    }
  }, [aiLoading, callAI, applyAIAction])

  const sendBuilderAI = useCallback(async (userMsg) => {
    if (!userMsg.trim() || aiLoading) return
    setAiLoading(true)
    setAiBuilderMsgs(prev => [...prev, { role: 'user', text: userMsg, id: Date.now() }])
    setAiBuilderInput('')
    try {
      const roomList = roomsRef.current
        .map(r => `${r.type}: ${pxToM(r.w)}m×${pxToM(r.h)}m = ${fmtAUD(cost(r))}`).join('; ')
      const system = `You are a professional building cost and design consultant for an Australian builder. Be precise and concise. Use Australian dollars.

Rooms: ${roomList}
Wall: ${wallTypeRef.current} (×${WALL_MULT[wallTypeRef.current]??1}), Floor: ${floorTypeRef.current} (×${FLOOR_MULT[floorTypeRef.current]??1}), Roof: ${roofTypeRef.current} (×${ROOF_MULT[roofTypeRef.current]??1})
Margin: ${marginRef.current}%, GST: ${gstOnRef.current ? 'included' : 'excluded'}

Respond with valid JSON: {"message":"your detailed response under 120 words"}`
      const history = [
        ...aiBuilderMsgsRef.current.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: userMsg },
      ]
      const raw    = await callAI(history, system)
      const parsed = parseAIResponse(raw)
      setAiBuilderMsgs(prev => [...prev, { role: 'ai', text: parsed.message, id: Date.now() + 1 }])
    } catch (e) {
      console.error(e)
      setAiBuilderMsgs(prev => [...prev, {
        role: 'ai', text: 'API connection failed. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.', id: Date.now() + 1,
      }])
    } finally {
      setAiLoading(false)
    }
  }, [aiLoading, callAI])

  const handleAIPanelResize = useCallback(e => {
    e.preventDefault()
    const startX = e.clientX
    const startW = aiPanelWidth
    const onMove = me => setAiPanelWidth(Math.max(300, Math.min(640, startW + (startX - me.clientX))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [aiPanelWidth])

  const sendToClient = () => {
    const url = `${window.location.origin}/project/${id}/client`
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
    const from = clientOnly ? 'client' : 'builder'
    setMessages(m => [...m, { from, text: msgText.trim(), time: 'Just now' }])
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
    <div className={`h-screen flex flex-col overflow-hidden ${clientOnly ? 'bg-[#fafaf8]' : 'bg-[#f5f6f8]'}`} style={{ userSelect: 'none' }}>

      {/* ── PREVIEW BANNER (builder previewing client view) */}
      {!clientOnly && view === 'client' && (
        <div className="bg-amber-500 text-white text-[11px] font-semibold px-4 py-2 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="2.5" fill="white"/></svg>
            You are previewing the client view — this is exactly what your client sees
          </div>
          <button onClick={() => setView('builder')}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition cursor-pointer">
            ← Return to builder view
          </button>
        </div>
      )}

      {/* ── TOP BAR */}
      <div className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0 z-20">
        {clientOnly ? (
          /* ── CLIENT HEADER */
          <>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#1a3a5c] rounded-xl flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <rect x="1.5" y="5" width="9" height="6" rx="0.8" fill="white" fillOpacity="0.9"/>
                  <rect x="3" y="2.5" width="6" height="3.5" rx="0.6" fill="white" fillOpacity="0.6"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[#1a3a5c] text-sm leading-none">{projectName}</p>
                {projectAddr && <p className="text-gray-400 text-[10px] mt-0.5">{projectAddr}</p>}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className={`text-[10px] font-medium ${saveStatus==='saved'?'text-emerald-500':saveStatus==='saving'?'text-gray-400':'text-transparent'}`}>
                {saveStatus==='saved'?'✓ Saved':saveStatus==='saving'?'Saving…':'·'}
              </span>
              <button onClick={() => setAiClientOpen(o => !o)}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm ${
                  aiClientOpen ? 'bg-[#1a3a5c] text-white' : 'bg-gradient-to-r from-[#1a3a5c] to-[#2d6a9f] text-white hover:shadow-md'
                }`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.6 2.6l1.4 1.4M8 8l1.4 1.4M9.4 2.6L8 4M4 8l-1.4 1.4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Design with AI
              </button>
            </div>
          </>
        ) : (
          /* ── BUILDER HEADER */
          <>
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
              <span className={`text-[10px] font-medium transition-all ${
                saveStatus === 'unsaved' ? 'text-amber-500' :
                saveStatus === 'saving'  ? 'text-gray-400'  :
                saveStatus === 'saved'   ? 'text-emerald-500' : 'text-transparent'
              }`}>
                {saveStatus === 'unsaved' ? '● Unsaved' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : '·'}
              </span>
              <button onClick={handleExportPDF} disabled={rooms.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#1a3a5c] border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-30">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export PDF
              </button>
              <button onClick={() => setShowTemplates(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#1a3a5c] border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition cursor-pointer">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6L2.7 3.8l2.6-.4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Generate floor plan
              </button>
              <div className="relative">
                <button onClick={sendToClient}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Send to client
                </button>
                {copiedMsg && (
                  <div className="absolute right-0 top-9 bg-[#1a3a5c] text-white text-[11px] font-medium px-3 py-2 rounded-xl shadow-lg whitespace-nowrap z-50 flex items-center gap-2 modal-enter">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#4ade80" strokeWidth="1.5"/><path d="M3.5 6l2 2 3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Client link copied!
                  </div>
                )}
              </div>
              {view === 'builder' && (
                <button onClick={() => setAiBuilderOpen(o => !o)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                    aiBuilderOpen ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'text-[#1a3a5c] border-[#1a3a5c]/25 hover:border-[#1a3a5c]/50 hover:bg-[#1a3a5c]/5'
                  }`}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.6 2.6l1.4 1.4M8 8l1.4 1.4M9.4 2.6L8 4M4 8l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  AI Advisor
                </button>
              )}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setView('builder')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${view === 'builder' ? 'bg-white text-[#1a3a5c] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  Builder
                </button>
                <button onClick={() => setView('client')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${view === 'client' ? 'bg-white text-[#1a3a5c] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  Preview Client
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 3-COLUMN BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL — builder only */}
        <div className={`w-[200px] shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden ${(clientOnly || view === 'client') ? 'hidden' : ''}`}>
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
          {/* Toolbar — builder only */}
          {!clientOnly && (
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
          )}

          <div className="flex-1 overflow-auto">
            <div style={{ position: 'relative', width: CW * zoom, height: CH * zoom }}>
              <SiteLayer rooms={rooms} zoom={zoom} CW={CW} CH={CH} />
              <FurnitureLayer rooms={rooms} zoom={zoom} CW={CW} CH={CH} />
              <WallOverlay rooms={rooms} openWalls={openWalls}
                wallColor={view === 'client' ? (STYLE_THEMES[style]?.wall ?? '#1c1c1c') : '#1c1c1c'}
                zoom={zoom} CW={CW} CH={CH} />
              <WallControlLayer rooms={rooms} openWalls={openWalls} onToggleWall={toggleWall} zoom={zoom} CW={CW} CH={CH} />
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
                  <RoomBlock key={r.id} room={r} selected={r.id === selId} view={view} clientStyle={style} cost={cost(r)}
                    highlighted={r.id === highlightId}
                    builderMode={!clientOnly && view === 'builder'}
                    roomCost={roomCostFull(r)}
                    floorMat={r.floorMat || floorType}
                    onFloorChange={mat => updRoom(r.id, { floorMat: mat })}
                    clientMaterials={r.clientMaterials}
                    onMouseDown={e => onRoomDown(e, r.id)}
                    onHandleDown={(e, dir) => onHandleDown(e, r.id, dir)}
                  />
                ))}
                {/* Client first-load help tooltip */}
                {clientOnly && showHelp && rooms.length > 0 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                    <div className="bg-[#1a3a5c] text-white rounded-2xl px-5 py-3.5 shadow-2xl flex items-start gap-3 max-w-xs fade-up">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
                        <circle cx="9" cy="9" r="8" stroke="white" strokeWidth="1.4" strokeOpacity="0.6"/>
                        <path d="M9 8v5M9 5.5v1" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      <div>
                        <p className="font-bold text-sm">Your floor plan is ready</p>
                        <p className="text-white/70 text-[11px] mt-1 leading-relaxed">Click any room to select and resize it, or use <strong className="text-white">Design with AI</strong> to make changes by chatting.</p>
                      </div>
                      <button onClick={() => { setShowHelp(false); localStorage.setItem('bf_client_help', '1') }}
                        className="text-white/50 hover:text-white transition cursor-pointer ml-1 shrink-0">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL / AI PANEL */}
        {(view === 'client' || clientOnly) && aiClientOpen ? (
          <ClientAIPanel
            messages={aiClientMsgs}
            loading={aiLoading}
            input={aiClientInput}
            setInput={setAiClientInput}
            onSend={sendClientAI}
            onClose={() => setAiClientOpen(false)}
            suggestions={getAISuggestions(rooms)}
            onSuggestion={msg => sendClientAI(msg)}
            width={aiPanelWidth}
            onResizeStart={handleAIPanelResize}
          />
        ) : (
          <div className={`shrink-0 flex flex-col overflow-y-auto border-l ${
            clientOnly ? 'w-[280px] bg-white border-gray-100' : 'w-[240px] bg-white border-gray-100'
          }`}>
            {!clientOnly && view === 'builder' ? (
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
                  <BuilderPanel
                    baseCost={baseCost} withMargin={withMargin} total={total} totalSqm={totalSqm}
                    rooms={rooms} selRoom={selRoom} messages={messages}
                    wallType={wallType} setWallType={setWallType}
                    floorType={floorType} setFloorType={setFloorType}
                    roofType={roofType} setRoofType={setRoofType}
                    margin={margin} setMargin={setMargin}
                    gstOn={gstOn} setGstOn={setGstOn}
                    builderNotes={builderNotes} setBuilderNotes={setBuilderNotes}
                    onExportPDF={handleExportPDF}
                  />
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
              <ClientRightPanel
                rooms={rooms}
                selId={selId}
                setSelId={setSelId}
                updRoom={updRoom}
                msgText={msgText}
                setMsgText={setMsgText}
                onSend={sendMessage}
              />
            )}
          </div>
        )}
      </div>

      {/* Builder AI floating window */}
      {aiBuilderOpen && (
        <BuilderAIFloat
          messages={aiBuilderMsgs}
          loading={aiLoading}
          input={aiBuilderInput}
          setInput={setAiBuilderInput}
          onSend={sendBuilderAI}
          onClose={() => setAiBuilderOpen(false)}
          suggestions={getBuilderAISuggestions()}
          onSuggestion={msg => sendBuilderAI(msg)}
        />
      )}

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
function BuilderPanel({
  baseCost, withMargin, total, totalSqm, rooms, selRoom, messages,
  wallType, setWallType, floorType, setFloorType, roofType, setRoofType,
  margin, setMargin, gstOn, setGstOn, builderNotes, setBuilderNotes, onExportPDF,
}) {
  const selDef = selRoom ? ROOM_DEFS.find(d => d.type === selRoom.type) : null
  const selBase = selRoom ? cost(selRoom) * (WALL_MULT[wallType]||1) * (FLOOR_MULT[floorType]||1) * (ROOF_MULT[roofType]||1) : 0
  const selAdj  = selBase * (1 + margin/100) * (gstOn ? 1.1 : 1)
  const selSqm  = selRoom ? ((selRoom.w/MPX)*(selRoom.h/MPX)).toFixed(1) : 0
  return (
    <>
      {/* Total cost card */}
      <div className="m-3 bg-[#1a3a5c] rounded-xl px-4 py-3 shrink-0">
        <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1">Total Project Cost</p>
        <p className="text-white text-xl font-bold tracking-tight leading-none">{fmtAUD(total)}</p>
        <div className="text-white/30 text-[9px] mt-2 space-y-0.5">
          <div className="flex justify-between"><span>Base cost</span><span>{fmtAUD(baseCost)}</span></div>
          <div className="flex justify-between"><span>Margin ({margin}%)</span><span>+{fmtAUD(withMargin - baseCost)}</span></div>
          {gstOn && <div className="flex justify-between"><span>GST (10%)</span><span>+{fmtAUD(total - withMargin)}</span></div>}
        </div>
        <p className="text-white/20 text-[9px] mt-1">{rooms.length} rooms · {totalSqm.toFixed(0)} m²</p>
      </div>

      {/* Margin + GST controls */}
      <div className="px-4 py-3 border-b border-gray-50 space-y-2.5">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-400 w-14 shrink-0">Margin</label>
          <input type="range" min={0} max={40} step={1} value={margin} onChange={e => setMargin(+e.target.value)}
            className="flex-1 accent-[#1a3a5c] cursor-pointer" />
          <span className="text-[11px] font-bold text-[#1a3a5c] w-8 text-right">{margin}%</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setGstOn(g => !g)}
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${gstOn ? 'bg-[#1a3a5c]' : 'bg-gray-200'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${gstOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[11px] text-gray-500">GST (10%)</span>
        </label>
      </div>

      {/* Materials */}
      <div className="px-4 py-3 border-b border-gray-50 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold">Materials</p>
        {[
          { label: 'Walls',    value: wallType,  set: setWallType,  opts: WALL_OPTS,  mult: WALL_MULT  },
          { label: 'Flooring', value: floorType, set: setFloorType, opts: FLOOR_OPTS, mult: FLOOR_MULT },
          { label: 'Roof',     value: roofType,  set: setRoofType,  opts: ROOF_OPTS,  mult: ROOF_MULT  },
        ].map(({ label, value, set, opts, mult }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gray-400">{label}</span>
              <span className={`text-[9px] font-semibold ${mult[value] > 1 ? 'text-amber-500' : mult[value] < 1 ? 'text-emerald-500' : 'text-gray-300'}`}>
                {mult[value] > 1 ? `+${Math.round((mult[value]-1)*100)}%` : mult[value] < 1 ? `${Math.round((mult[value]-1)*100)}%` : 'base'}
              </span>
            </div>
            <select value={value} onChange={e => set(e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 text-[#1a3a5c] bg-white outline-none cursor-pointer focus:ring-1 focus:ring-[#1a3a5c]/20">
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Trade breakdown */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">By Trade</p>
        <div className="space-y-1.5">
          {TRADES.map(t => (
            <div key={t.name} className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">{t.name}</span>
              <span className="text-[11px] font-semibold text-[#1a3a5c]">{fmtAUD(total * t.pct)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected room */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Selected Room</p>
        {selRoom ? (
          <div className="space-y-1.5">
            <p className="font-bold text-[#1a3a5c] text-sm">{selRoom.type}</p>
            <p className="text-gray-400 text-[11px]">{pxToM(selRoom.w)}m × {pxToM(selRoom.h)}m · {selSqm} m²</p>
            {selDef && <p className="text-gray-300 text-[10px]">{fmtAUD(selDef.rate)}/m²{selDef.flat ? ` + ${fmtAUD(selDef.flat)} fixed` : ''}</p>}
            <div className="bg-[#1a3a5c]/5 border border-[#1a3a5c]/10 rounded-lg px-3 py-1.5 flex justify-between">
              <span className="text-gray-400 text-[10px]">Room cost (inc. margin{gstOn ? ' + GST' : ''})</span>
              <span className="text-[#1a3a5c] font-bold text-sm">{fmtAUD(selAdj)}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-300 text-[11px] py-1">Click a room to see details</p>
        )}
      </div>

      {/* Internal notes */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-1.5">Internal Notes <span className="normal-case font-normal">(client cannot see)</span></p>
        <textarea value={builderNotes} onChange={e => setBuilderNotes(e.target.value)} rows={3}
          placeholder="Site notes, allowances, exclusions…"
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 text-[#1a3a5c] outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 bg-gray-50 focus:bg-white transition resize-none placeholder:text-gray-300" />
      </div>

      {/* Generate Quote PDF */}
      <div className="px-4 py-3 border-b border-gray-50">
        <button onClick={onExportPDF} disabled={rooms.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-[#1a3a5c] hover:bg-[#243f63] disabled:opacity-30 text-white text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Generate Quote PDF
        </button>
      </div>

      {/* Client material preferences */}
      {(() => {
        const summary = getRoomSelectionSummary(rooms ?? [])
        if (!summary.length) return null
        return (
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Client Preferences</p>
            <div className="space-y-1.5">
              {summary.map((s, i) => (
                <div key={i} className="bg-blue-50 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold text-[#1a3a5c]">{s.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{s.choices}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Client comments */}
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

// ─── client right panel ───────────────────────────────────────────────────────
function RoomIcon({ type = '', size = 16 }) {
  const p = { width: size, height: size, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type.includes('Bedroom') || type === 'Walk-in Robe') return <svg {...p}><rect x="1.5" y="9" width="15" height="7" rx="1.5"/><path d="M1.5 13h15M5 9V7.5a2 2 0 014 0V9M9 9V7.5a2 2 0 014 0V9M1.5 15.5v1M16.5 15.5v1"/></svg>
  if (type === 'Kitchen' || type === 'Walk-in Pantry') return <svg {...p}><path d="M5 2v7M5 12v4M9 2v3a3 3 0 003 3h.5v8M14.5 2v4"/></svg>
  if (type === 'Bathroom' || type === 'Ensuite' || type === 'Laundry') return <svg {...p}><rect x="1.5" y="6.5" width="15" height="9" rx="1"/><path d="M1.5 11h15M5.5 6.5V5a2 2 0 014 0v1.5"/></svg>
  if (type === 'Living Room' || type === 'Lounge') return <svg {...p}><rect x="2.5" y="8" width="13" height="5.5" rx="1.5"/><path d="M2.5 11h-1V9a1 1 0 011-1h14a1 1 0 011 1v2h-1M5.5 13.5v2M12.5 13.5v2"/></svg>
  if (type === 'Dining Room') return <svg {...p}><rect x="4" y="7" width="10" height="7" rx="1"/><path d="M1 7h16M7 7V4.5M11 7V4.5M4 14v2M14 14v2"/></svg>
  if (type === 'Garage') return <svg {...p}><rect x="1.5" y="5" width="15" height="11" rx="1"/><path d="M1.5 9.5h15M5.5 5V9.5M9 5V9.5M12.5 5V9.5"/></svg>
  if (type === 'Alfresco' || type === 'Pool Deck') return <svg {...p}><path d="M3 14h12M9 3v11M6 5.5C6 3.5 7.5 2 9 2M12 5.5C12 3.5 10.5 2 9 2"/></svg>
  if (type === 'Study' || type === 'Home Office' || type === 'Theatre Room') return <svg {...p}><rect x="2" y="4" width="14" height="10" rx="1"/><path d="M2 11h14M8 14v2M10 14v2M6 16h6"/></svg>
  return <svg {...p}><path d="M2.5 9.5L9 3.5l6.5 6M4.5 8.5v7h9v-7"/></svg>
}

function ClientRightPanel({ rooms, selId, setSelId, updRoom, msgText, setMsgText, onSend }) {
  const [submitted, setSubmitted] = useState(false)
  const selRoom = rooms.find(r => r.id === selId) ?? null
  const catalog  = selRoom ? getRoomCatalog(selRoom.type) : null

  const handleMat = (roomId, cat, optId) => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return
    updRoom(roomId, { clientMaterials: { ...(room.clientMaterials ?? {}), [cat]: optId } })
  }

  const handleSubmit = () => {
    if (msgText.trim()) onSend()
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* SECTION 1 — selected room header */}
        <div className="px-5 pt-6 pb-4">
          {selRoom ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1a3a5c]/8 flex items-center justify-center text-[#1a3a5c] shrink-0">
                <RoomIcon type={selRoom.type} size={17} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', lineHeight: 1.1 }}>{selRoom.type}</h2>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{pxToM(selRoom.w)}m × {pxToM(selRoom.h)}m</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3 text-gray-300">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12L11 4.5l8 7.5M5 11v8h12v-8"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>Tap any room to personalise it</p>
            </div>
          )}
        </div>

        {/* SECTION 2 — material swatches */}
        {selRoom && catalog && (
          <div className="px-5 pb-2">
            {Object.entries(catalog.categories).map(([cat, opts]) => (
              <div key={cat} className="mb-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-3">{cat}</p>
                <div className="grid grid-cols-3 gap-2">
                  {opts.map(opt => {
                    const active = selRoom.clientMaterials?.[cat] === opt.id
                    return (
                      <button key={opt.id} onClick={() => handleMat(selRoom.id, cat, opt.id)}
                        className={`flex flex-col items-center gap-1.5 p-1.5 rounded-2xl transition-all cursor-pointer relative border-2 ${
                          active ? 'border-[#1a3a5c] shadow-sm' : 'border-transparent hover:border-gray-200'
                        }`}>
                        <div className="w-full rounded-xl overflow-hidden" style={{ height: 48 }}>
                          <div className="w-full h-full" style={{
                            background: opt.pattern ? `${MAT_PATTERNS[opt.pattern]},${opt.color}` : opt.color,
                            transition: 'opacity 0.15s',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#1a3a5c' : '#9ca3af', lineHeight: 1.1, textAlign: 'center' }}>{opt.label}</span>
                        {active && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-[#1a3a5c] rounded-full flex items-center justify-center shadow-sm">
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── divider ── */}
        <div className="mx-5 h-px bg-gray-100 my-1" />

        {/* SECTION 3 — your selections */}
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Your Selections</p>
          <div style={{ maxHeight: 200, overflowY: 'auto' }} className="space-y-0.5">
            {rooms.filter(r => r.type !== 'Corridor').map(r => {
              const rMats     = r.clientMaterials ?? {}
              const rCat      = getRoomCatalog(r.type)
              const firstCat  = Object.keys(rCat.categories)[0]
              const chosenId  = rMats[firstCat]
              const chosenOpt = rCat.categories[firstCat]?.find(o => o.id === chosenId)
              const hasAny    = Object.keys(rMats).length > 0
              const isActive  = r.id === selId
              return (
                <button key={r.id} onClick={() => setSelId(isActive ? null : r.id)}
                  className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition cursor-pointer text-left ${
                    isActive ? 'bg-[#1a3a5c]/5' : 'hover:bg-gray-50'
                  }`}>
                  <div className={`shrink-0 ${hasAny ? 'text-[#1a3a5c]' : 'text-gray-300'}`}>
                    <RoomIcon type={r.type} size={13} />
                  </div>
                  <span style={{ fontSize: 13, color: isActive ? '#1a3a5c' : '#374151', flex: 1, fontWeight: isActive ? 600 : 400 }}>{r.type}</span>
                  {hasAny ? (
                    <>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{chosenOpt?.label ?? '—'}</span>
                      <div className="w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: '#d1d5db' }}>Not set</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* SECTION 4 — note to builder */}
        <div className="px-5 pb-5">
          <textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder="Any requests or questions for your builder..."
            rows={3}
            className="w-full text-[13px] border border-gray-200 rounded-2xl px-4 py-3 text-gray-700 outline-none focus:ring-2 focus:ring-[#1a3a5c]/15 focus:border-[#1a3a5c]/30 bg-white resize-none placeholder:text-gray-300 transition leading-relaxed"
          />
        </div>
      </div>

      {/* SECTION 5 — submit (always visible) */}
      <div className="px-5 py-4 bg-white border-t border-gray-100 shrink-0">
        <button onClick={handleSubmit}
          style={{ transition: 'background 0.3s, transform 0.1s' }}
          className={`w-full py-3.5 rounded-2xl font-bold cursor-pointer ${
            submitted
              ? 'bg-emerald-500 text-white text-[13px]'
              : 'bg-[#1a3a5c] hover:bg-[#243f63] text-white text-[14px]'
          }`}>
          {submitted ? (
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.5"/>
                <path d="M5 8l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sent! Your builder will be in touch
            </span>
          ) : 'Send to builder'}
        </button>
      </div>
    </div>
  )
}

// ─── STUB so old RoomMaterialsPanel reference compiles ────────────────────────
function RoomMaterialsPanel({ room, onBack, onMaterialChange }) {
  const catalog = getRoomCatalog(room.type)
  const mats = room.clientMaterials ?? {}

  const Swatch = ({ cat, opt }) => {
    const active = mats[cat] === opt.id
    return (
      <button onClick={() => onMaterialChange(room.id, cat, opt.id)}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition cursor-pointer relative ${
          active ? 'border-[#1a3a5c] shadow-sm' : 'border-gray-100 hover:border-gray-300 bg-white'
        }`}>
        <div className="w-full rounded-lg overflow-hidden" style={{ height: 36 }}>
          <div className="w-full h-full" style={{
            background: opt.pattern
              ? `${MAT_PATTERNS[opt.pattern]},${opt.color}`
              : opt.color,
          }} />
        </div>
        <span className={`text-[9px] font-semibold leading-tight text-center ${active ? 'text-[#1a3a5c]' : 'text-gray-500'}`}>{opt.label}</span>
        {active && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-[#1a3a5c] rounded-full flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2.5">
        <button onClick={onBack}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <p className="font-bold text-[#1a3a5c] text-sm leading-none">{room.type}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Pick your finishes</p>
        </div>
      </div>

      {/* Category sections */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(catalog.categories).map(([cat, opts]) => (
          <div key={cat} className="px-4 py-3.5 border-b border-gray-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2.5">{cat}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {opts.map(opt => <Swatch key={opt.id} cat={cat} opt={opt} />)}
            </div>
          </div>
        ))}
      </div>

      {/* Done button */}
      <div className="px-4 py-4">
        <button onClick={onBack}
          className="w-full py-3 rounded-2xl text-[12px] font-bold text-white bg-gradient-to-r from-[#1a3a5c] to-[#2d6a9f] hover:from-[#243f63] hover:to-[#3a7ab5] transition cursor-pointer shadow-sm">
          Done
        </button>
      </div>
    </div>
  )
}

// ─── client panel ─────────────────────────────────────────────────────────────
const CLIENT_BUDGET_TIERS = [
  { id: 'lean',    label: 'Keep it lean',  icon: '🌿', desc: 'Smart choices, great result' },
  { id: 'mid',     label: 'Mid range',     icon: '✨', desc: 'The sweet spot' },
  { id: 'premium', label: 'Go premium',    icon: '🏆', desc: 'Best of everything' },
]

function ClientPanel({ clientOnly, onOpenAI, rooms, style, setStyle, budgetTier, setBudgetTier, finishes, setFinishes, msgText, setMsgText, messages, onSend }) {
  const theme = STYLE_THEMES[style] ?? STYLE_THEMES.Modern
  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Design with AI — prominent CTA at top */}
      {clientOnly && (
        <div className="px-4 pt-5 pb-3">
          <button onClick={onOpenAI}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#2d6a9f] hover:from-[#243f63] hover:to-[#3a7ab5] text-white rounded-2xl py-3.5 font-bold text-sm shadow-md hover:shadow-lg transition cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13M3 3l1.8 1.8M9.2 9.2L11 11M11 3l-1.8 1.8M4.8 9.2L3 11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Design with AI
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-2">Chat to reshape rooms, open walls, and more</p>
        </div>
      )}

      <div className={clientOnly ? 'border-t border-gray-100' : ''}>

        {/* Style picker */}
        <div className="px-4 py-4 border-b border-gray-50/80">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2.5">Design Style</p>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLES.map(s => {
              const t = STYLE_THEMES[s]
              return (
                <button key={s} onClick={() => setStyle(s)}
                  className={`py-3 rounded-2xl text-[11px] font-semibold transition cursor-pointer border-2 flex flex-col items-center gap-1.5 ${
                    style === s ? 'border-[#1a3a5c] shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                  style={style === s ? { background: t.fill, color: t.wall } : {}}>
                  <div className="flex gap-0.5">
                    <div className="w-3.5 h-3.5 rounded-sm border" style={{ background: t.fill, borderColor: t.wall }} />
                    <div className="w-2 h-3.5 rounded-sm" style={{ background: t.wall }} />
                  </div>
                  <span className={style === s ? 'font-bold' : 'text-gray-500'}>{s}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Budget comfort */}
        <div className="px-4 py-4 border-b border-gray-50/80">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2.5">Budget Comfort</p>
          <div className="space-y-1.5">
            {CLIENT_BUDGET_TIERS.map(t => (
              <button key={t.id} onClick={() => setBudgetTier(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-semibold transition cursor-pointer border-2 flex items-center gap-2.5 ${
                  budgetTier === t.id
                    ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                    : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200 hover:text-gray-700'
                }`}>
                <span className="text-base leading-none">{t.icon}</span>
                <div>
                  <div>{t.label}</div>
                  <div className={`text-[9px] font-normal mt-0.5 ${budgetTier === t.id ? 'text-white/70' : 'text-gray-400'}`}>{t.desc}</div>
                </div>
                {budgetTier === t.id && <svg className="ml-auto shrink-0" width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" fill="white" fillOpacity="0.25"/><path d="M4 6.5l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            ))}
          </div>
        </div>

        {/* Finish preferences */}
        <div className="px-4 py-4 border-b border-gray-50/80">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-3">Finish Preferences</p>
          <p className="text-[10px] text-gray-400 mb-2.5 leading-relaxed">These are saved as notes to your builder — no prices involved.</p>
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

        {/* Message builder */}
        <div className="px-4 py-4 flex flex-col">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2.5">
            {clientOnly ? 'Message Your Builder' : 'Client Messages'}
          </p>
          {messages.length > 0 && (
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 text-[11px] ${
                  m.from === 'client' ? 'bg-[#1a3a5c]/8 text-[#1a3a5c]' : 'bg-gray-50 text-gray-600'
                }`}>
                  <p className="font-bold text-[9px] uppercase tracking-wide mb-0.5 opacity-60">{m.from}</p>
                  {m.text}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5 mb-3">
            <input type="text" value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSend()} placeholder="Type a message…"
              className="flex-1 text-[11px] border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#1a3a5c]/20 focus:border-[#1a3a5c]/30 bg-white" />
            <button onClick={onSend} className="bg-[#1a3a5c] text-white rounded-xl px-3 py-2 hover:bg-[#243f63] transition cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {/* Your Selections So Far */}
          {clientOnly && (() => {
            const summary = getRoomSelectionSummary(rooms ?? [])
            return summary.length > 0 ? (
              <div className="mb-3 bg-[#1a3a5c]/4 rounded-2xl px-3 py-3">
                <p className="text-[9px] uppercase tracking-widest text-[#1a3a5c]/50 font-semibold mb-2">Your selections so far</p>
                <div className="space-y-1.5">
                  {summary.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <div className="w-1.5 h-1.5 bg-[#1a3a5c]/30 rounded-full mt-1 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-[#1a3a5c]">{s.name}</span>
                        <span className="text-[10px] text-gray-400"> — {s.choices}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* Submit Design — client only */}
          {clientOnly && (
            <button onClick={onSend}
              className="w-full py-3.5 rounded-2xl text-[13px] font-bold text-white transition cursor-pointer shadow-md hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.wall}, ${theme.wall}cc)` }}>
              Submit My Design
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── smart generator modal ────────────────────────────────────────────────────
function SmartGeneratorModal({ onGenerate, onClose }) {
  const [selectedId,  setSelectedId]  = useState(null)
  const [generated,   setGenerated]   = useState(false)
  const [customMode,  setCustomMode]  = useState(false)
  const [bedrooms,    setBedrooms]    = useState(4)
  const [bathrooms,   setBathrooms]   = useState(2)
  const [houseSize,   setHouseSize]   = useState(350)
  const [extras,      setExtras]      = useState([])
  const [singleGar,   setSingleGar]   = useState(false)

  const toggleExtra = e => setExtras(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])

  const handleTemplate = tpl => {
    setSelectedId(tpl.id)
    onGenerate(generateFloorPlan(tpl.params))
    setGenerated(true)
  }

  const handleCustom = () => {
    onGenerate(generateFloorPlan({ houseSize, bedrooms, bathrooms, extras, singleGarage: singleGar }))
    setGenerated(true)
    setSelectedId('custom')
  }

  const TEMPLATE_ICONS = {
    aussie_family: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M4 16L14 7l10 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 14v8h14v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="11" y="18" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="4" y="18" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    first_home: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M5 16L14 8l9 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 14v8h12v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="11" y="18" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    executive: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M2 17L14 6l12 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 15v9h18v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="12" y="19" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="5" y="19" width="4" height="5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M19 19v-4h4v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden modal-enter">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[#1a3a5c] font-bold text-base">
              {generated ? 'Floor Plan Ready' : customMode ? 'Custom Floor Plan' : 'Choose a Template'}
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {generated ? 'Drag rooms to reposition · handles to resize · ⌘Z to undo'
                : customMode ? 'Configure your custom design below'
                : 'Real Australian builder layouts — edit after loading'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {customMode && !generated && (
              <button onClick={() => setCustomMode(false)}
                className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer transition">
                ← Templates
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[260px]">
          {generated ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="13" r="11" stroke="#10b981" strokeWidth="1.6"/>
                  <path d="M8 13l3.5 3.5 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-[#1a3a5c] font-bold text-lg mb-2">
                {selectedId !== 'custom'
                  ? (FLOOR_TEMPLATES.find(t => t.id === selectedId)?.name ?? 'Custom Plan')
                  : 'Custom Floor Plan'}
              </h3>
              <p className="text-gray-300 text-xs">Drag rooms to reposition · handles to resize</p>
            </div>

          ) : customMode ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Bedrooms',  val: bedrooms,  set: setBedrooms,  min: 1, max: 6 },
                  { label: 'Bathrooms', val: bathrooms, set: setBathrooms, min: 1, max: 4 },
                ].map(({ label, val, set, min, max }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-3">{label}</p>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => set(v => Math.max(min, v - 1))}
                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition cursor-pointer border-gray-200 text-gray-500 hover:border-[#1a3a5c] hover:text-[#1a3a5c]">−</button>
                      <span className="text-3xl font-bold text-[#1a3a5c] w-8 text-center tabular-nums">{val}</span>
                      <button onClick={() => set(v => Math.min(max, v + 1))}
                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition cursor-pointer border-gray-200 text-gray-500 hover:border-[#1a3a5c] hover:text-[#1a3a5c]">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold">House size</span>
                  <span className="text-[11px] font-bold text-[#1a3a5c]">{houseSize}m²</span>
                </div>
                <input type="range" min={120} max={600} step={10} value={houseSize}
                  onChange={e => setHouseSize(+e.target.value)} className="w-full accent-[#1a3a5c] cursor-pointer" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setSingleGar(g => !g)}
                  className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${singleGar ? 'bg-[#1a3a5c]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${singleGar ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-[11px] text-gray-500">Single garage</span>
              </label>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-300 font-semibold mb-2">Optional extras</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXTRA_ROOMS.map(e => (
                    <button key={e} onClick={() => toggleExtra(e)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        extras.includes(e) ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          ) : (
            <div className="space-y-3">
              {FLOOR_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => handleTemplate(tpl)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#1a3a5c] hover:bg-[#1a3a5c]/3 text-left transition cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-[#1a3a5c]/6 flex items-center justify-center text-[#1a3a5c] shrink-0 group-hover:bg-[#1a3a5c]/10 transition">
                    {TEMPLATE_ICONS[tpl.id]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-[#1a3a5c] text-sm">{tpl.name}</span>
                      <span className="text-gray-300 text-[10px] font-medium">{tpl.size}</span>
                    </div>
                    <p className="text-gray-400 text-[11px] mt-0.5">{tpl.desc}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-300 group-hover:text-[#1a3a5c] transition shrink-0">
                    <path d="M4 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
              <button onClick={() => setCustomMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs font-semibold hover:border-gray-300 hover:text-gray-600 transition cursor-pointer mt-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Custom layout
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(generated || customMode) && (
          <div className="px-6 pb-6">
            {generated ? (
              <button onClick={onClose}
                className="w-full bg-[#1a3a5c] hover:bg-[#243f63] text-white font-semibold text-sm py-3 rounded-xl transition cursor-pointer">
                Start editing
              </button>
            ) : (
              <button onClick={handleCustom}
                className="w-full flex items-center justify-center gap-2 bg-[#1a3a5c] hover:bg-[#243f63] text-white font-semibold text-sm py-3 rounded-xl transition cursor-pointer">
                Generate floor plan
              </button>
            )}
          </div>
        )}
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

function RoomBlock({ room, selected, view, clientStyle, cost, highlighted, builderMode, roomCost, floorMat, onFloorChange, clientMaterials, onMouseDown, onHandleDown }) {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const isCorridor = room.type === 'Corridor'
  const theme = STYLE_THEMES[clientStyle] ?? null
  const isClientView = view === 'client' || !builderMode
  const themeColor = (isClientView && theme) ? theme.fill : '#fff'
  const matStyle = isClientView ? getMatBgStyle(room.type, clientMaterials) : {}
  const fillColor = matStyle.background ? undefined : themeColor
  const textColor = (isClientView && theme) ? theme.wall : '#1c1c1c'
  const isClientSelected = isClientView && selected
  return (
    <div onMouseDown={onMouseDown}
      className={highlighted ? 'ai-highlight' : undefined}
      style={{
        position: 'absolute', left: room.x, top: room.y, width: room.w, height: room.h,
        background: matStyle.background ?? fillColor,
        border: selected ? `2px solid ${isClientSelected ? '#1a3a5c' : textColor}` : 'none',
        cursor: 'move', zIndex: selected ? 10 : 1,
        boxShadow: isClientSelected ? '0 0 0 4px rgba(26,58,92,0.15), 0 0 0 2px rgba(26,58,92,0.4)' : selected ? `0 0 0 3px ${textColor}1a` : 'none',
        transition: 'background 0.3s ease',
      }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 pointer-events-none">
        <span className="font-bold tracking-wider leading-tight text-center"
          style={{ fontSize: isCorridor ? 8 : 9, color: textColor }}>
          {isCorridor ? 'HALL' : room.type.toUpperCase()}
        </span>
        {/* Builder: show dimensions + cost + material */}
        {builderMode && !isCorridor && (
          <>
            <span style={{ fontSize: 7.5, color: '#888', marginTop: 2 }}>
              {pxToM(room.w)}m × {pxToM(room.h)}m
            </span>
            <span style={{ fontSize: 7.5, color: '#1a3a5c', fontWeight: 700, marginTop: 1 }}>
              {fmtAUD(roomCost)}
            </span>
            {floorMat && (
              <span style={{ fontSize: 6.5, color: '#aaa', marginTop: 1 }}>
                {floorMat}
              </span>
            )}
          </>
        )}
      </div>

      {/* Catalog icon — builder mode only */}
      {builderMode && !isCorridor && (
        <div className="absolute top-1 right-1 z-20" onMouseDown={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); setCatalogOpen(o => !o) }}
            className="w-4 h-4 bg-white/70 hover:bg-white border border-gray-100 rounded text-gray-400 hover:text-[#1a3a5c] flex items-center justify-center transition shadow-sm">
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="1.2" stroke="currentColor" strokeWidth="1"/>
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="0.7"/>
            </svg>
          </button>
          {catalogOpen && (
            <div className="absolute right-0 top-5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 w-[110px]"
              onClick={e => e.stopPropagation()}>
              <p className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-gray-400 font-semibold border-b border-gray-50 mb-0.5">Flooring</p>
              {FLOOR_OPTS.map(o => (
                <button key={o} onClick={() => { onFloorChange(o); setCatalogOpen(false) }}
                  className={`w-full text-left px-2.5 py-1.5 text-[10px] transition cursor-pointer ${
                    o === floorMat ? 'text-[#1a3a5c] font-bold bg-[#1a3a5c]/5' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
  const P = 10
  const R = (lx, ly, lw, lh) => lw > 2 && lh > 2 ? `M ${lx} ${ly} h ${lw} v ${lh} h ${-lw} Z` : null
  const L = (x1, y1, x2, y2) => `M ${x1} ${y1} L ${x2} ${y2}`
  const C = (cx, cy, r) => r > 1 ? `M ${cx+r} ${cy} a ${r} ${r} 0 1 0 ${-2*r} 0 a ${r} ${r} 0 1 0 ${2*r} 0` : null

  switch (room.type) {
    case 'Foyer': {
      // Door mat near north wall + entry table to one side
      const matW = Math.min(w * 0.5, 48), matH = 10
      paths.push(R(x + (w - matW) / 2, y + P, matW, matH))
      // Entry console table on E wall
      if (w > 80) {
        const tW = 8, tH = Math.min(h * 0.3, 28)
        paths.push(R(x + w - P - tW, y + (h - tH) / 2, tW, tH))
      }
      break
    }
    case 'Master Bedroom': {
      // King bed centred, bedside tables, bedhead
      const bedW2 = Math.min(w - 2*P, w * 0.7)
      const bedH2 = Math.min(h * 0.58, h - 2*P)
      const bedX = x + (w - bedW2) / 2
      const bedY = y + (h - bedH2) / 2 - 4
      paths.push(R(bedX, bedY, bedW2, bedH2))
      paths.push(R(bedX, bedY, bedW2, 10))  // headboard
      const pilW = Math.min(bedW2 * 0.32, 34), pilH = 10
      paths.push(R(bedX + 4, bedY + 13, pilW, pilH))
      paths.push(R(bedX + bedW2 - 4 - pilW, bedY + 13, pilW, pilH))
      const bsW = 14, bsH = 14
      paths.push(R(bedX - bsW - 3, bedY + bedH2 - bsH - 4, bsW, bsH))
      paths.push(R(bedX + bedW2 + 3, bedY + bedH2 - bsH - 4, bsW, bsH))
      break
    }
    case 'Walk-in Robe': {
      // Hanging rail lines on both side walls
      const railH = 7
      if (w > 50) {
        paths.push(R(x + P, y + P, 7, Math.min(h - 2*P, 40)))    // left side clothes
        paths.push(R(x + w - P - 7, y + P, 7, Math.min(h - 2*P, 40)))  // right side
        paths.push(L(x + P, y + P + railH, x + P + 7, y + P + railH))
        paths.push(L(x + w - P - 7, y + P + railH, x + w - P, y + P + railH))
      }
      break
    }
    case 'Ensuite': {
      const P2 = 6
      // Toilet (top-right): cistern + circle bowl
      const tW = Math.min(w * 0.4, 24)
      const tX = x + w - P2 - tW, tY = y + P2
      paths.push(R(tX, tY, tW, 7))
      const bR = Math.min(tW * 0.35, 8)
      paths.push(C(tX + tW / 2, tY + 7 + bR + 3, bR))
      // Vanity (top-left)
      const vW = Math.min(w - tW - 3*P2, 30), vH = 12
      paths.push(R(x + P2, y + P2, vW, vH))
      paths.push(C(x + P2 + vW / 2, y + P2 + vH / 2, 4))
      // Shower recess (bottom)
      const sW = Math.min(w - 2*P2, 40), sH = Math.min(h - (P2 + vH + 8 + P2), 32)
      if (sW > 16 && sH > 16) {
        const sX = x + (w - sW) / 2, sY = y + P2 + vH + 8
        paths.push(R(sX, sY, sW, sH))
        paths.push(C(sX + sW / 2, sY + sH / 2, 4))  // drain circle
      }
      break
    }
    case 'Living Room': {
      // Sofa along bottom wall: back + cushion seats
      const sofaW = Math.min(w * 0.68, w - 2*P)
      const backH = 8, seatH = 16
      const sofaX = x + (w - sofaW) / 2
      const sofaY = y + h - P - backH - seatH
      paths.push(R(sofaX, sofaY, sofaW, backH))
      const nCush = Math.max(2, Math.min(4, Math.floor(sofaW / 32)))
      const cushW = (sofaW - (nCush - 1) * 2) / nCush
      for (let i = 0; i < nCush; i++) {
        paths.push(R(sofaX + i * (cushW + 2), sofaY + backH, cushW, seatH))
      }
      paths.push(R(sofaX - 7, sofaY, 7, backH + seatH))  // left arm
      // Coffee table
      const ctW = sofaW * 0.42, ctH = 14
      paths.push(R(sofaX + (sofaW - ctW) / 2, sofaY - ctH - 12, ctW, ctH))
      // Armchair
      if (h > 120 && w > 150) {
        const acW = Math.min(26, w * 0.17), acH = 22
        const acX = x + P, acY = sofaY - 8
        paths.push(R(acX + 5, acY, acW, acH - 7))
        paths.push(R(acX + 5, acY - 6, acW, 6))
        paths.push(R(acX, acY, 5, acH - 7))
        paths.push(R(acX + 5 + acW, acY, 5, acH - 7))
      }
      break
    }
    case 'Kitchen': {
      const bD = 12
      // Bench along south wall (bottom)
      paths.push(R(x + P, y + h - P - bD, w - 2*P, bD))
      // Bench along east wall (right)
      paths.push(R(x + w - P - bD, y + P, bD, h - 2*P - bD))
      // Stovetop burners on south bench
      const nB = w > 120 ? 4 : 2
      const bSpacing = (w - 2*P - 2*bD) / nB
      for (let i = 0; i < nB; i++) {
        paths.push(C(x + P + bD / 2 + (i + 0.5) * bSpacing, y + h - P - bD / 2, 4))
      }
      // Double sink on east bench
      const skY = y + P + 6, skH = 10
      paths.push(R(x + w - P - bD + 1, skY, bD - 2, skH))
      paths.push(R(x + w - P - bD + 1, skY + skH + 2, bD - 2, skH))
      // Fridge top-left
      paths.push(R(x + P, y + P, Math.min(bD + 4, 18), Math.min(h * 0.18, 26)))
      // Island bench centred (if room is large enough)
      if (w > 130 && h > 130) {
        const isW = Math.min(w * 0.44, 72), isH = Math.min(h * 0.3, 36)
        const isX = x + (w - isW) / 2 - 8, isY = y + (h - isH) / 2 - 4
        paths.push(R(isX, isY, isW, isH))
      }
      break
    }
    case 'Bedroom': {
      const bedW2 = Math.min(w - 2*P, w * 0.68)
      const bedH2 = Math.min(h * 0.58, h - 2*P)
      const bedX = x + (w - bedW2) / 2
      const bedY = y + (h - bedH2) / 2 - 2
      paths.push(R(bedX, bedY, bedW2, bedH2))
      paths.push(R(bedX, bedY, bedW2, 10))  // headboard
      const pilW = Math.min(bedW2 * 0.38, 30), pilH = 10
      paths.push(R(bedX + (bedW2 - pilW) / 2, bedY + 13, pilW, pilH))
      // Built-in robe (BIR) — thin rect on east wall
      const birW = 8, birH = Math.min(h * 0.5, 44)
      paths.push(R(x + w - P - birW, y + (h - birH) / 2, birW, birH))
      paths.push(L(x + w - P - birW, y + (h - birH) / 2, x + w - P - birW, y + (h + birH) / 2))
      break
    }
    case 'Bathroom': {
      const P2 = 8
      // Toilet (top-right): small rect cistern + circle bowl
      const tW = Math.min(w * 0.38, 24)
      const tX = x + w - P2 - tW, tY = y + P2
      paths.push(R(tX, tY, tW, 7))                      // cistern
      const bR = Math.min(tW * 0.35, 9)
      paths.push(C(tX + tW / 2, tY + 7 + bR + 3, bR))  // bowl (circle)
      // Vanity (top-left): rect with single basin circle
      const vW = Math.min(w - tW - 3*P2, 32), vH = 14
      paths.push(R(x + P2, y + P2, vW, vH))
      paths.push(C(x + P2 + vW / 2, y + P2 + vH / 2, 4))
      // Bathtub: simple oval (outer ellipse + inner ellipse)
      const tubW = Math.min(w - 2*P2 - 2, 52)
      const tubH = Math.min(h - (P2 + vH + 12 + P2), h * 0.48)
      const tubX = x + (w - tubW) / 2
      const tubY = y + P2 + vH + 10
      if (tubW > 20 && tubH > 28) {
        const rx = tubW / 2, ry = tubH / 2
        const cx = tubX + rx, cy = tubY + ry
        paths.push(`M ${cx + rx} ${cy} a ${rx} ${ry} 0 1 0 ${-2*rx} 0 a ${rx} ${ry} 0 1 0 ${2*rx} 0`)
        const irx = rx * 0.72, iry = ry * 0.72
        paths.push(`M ${cx + irx} ${cy} a ${irx} ${iry} 0 1 0 ${-2*irx} 0 a ${irx} ${iry} 0 1 0 ${2*irx} 0`)
      }
      break
    }
    case 'Dining Room': {
      const tW = Math.min(w * 0.52, w - 2*P), tH = Math.min(h * 0.46, h - 2*P)
      const tX = x + (w - tW) / 2, tY = y + (h - tH) / 2
      paths.push(R(tX, tY, tW, tH))
      const cW = 12, cH = 9, cGap = 5
      const nH = Math.max(2, Math.min(5, Math.floor((tW + cGap) / (cW + cGap))))
      const sH = tX + (tW - (nH * (cW + cGap) - cGap)) / 2
      for (let i = 0; i < nH; i++) {
        const cx = sH + i * (cW + cGap)
        paths.push(R(cx, tY - cH - 3, cW, cH))
        paths.push(R(cx, tY + tH + 3, cW, cH))
      }
      const nV = Math.max(1, Math.min(3, Math.floor((tH + cGap) / (cH + cGap + 4))))
      const sV = tY + (tH - (nV * (cH + cGap) - cGap)) / 2
      for (let i = 0; i < nV; i++) {
        const cy = sV + i * (cH + cGap)
        paths.push(R(tX - cH - 3, cy, cH, cW))
        paths.push(R(tX + tW + 3, cy, cH, cW))
      }
      break
    }
    case 'Laundry': {
      // Washer + Dryer side by side
      const mS = Math.min((w - 2*P - 4) / 2, h - 2*P, 34)
      if (mS < 16) break
      const mY = y + (h - mS) / 2
      const wX = x + (w - 2*mS - 4) / 2
      // Washer
      paths.push(R(wX, mY, mS, mS))
      paths.push(C(wX + mS / 2, mY + mS / 2, mS * 0.3))
      // Dryer
      const dX = wX + mS + 4
      paths.push(R(dX, mY, mS, mS))
      paths.push(C(dX + mS / 2, mY + mS / 2, mS * 0.28))
      paths.push(C(dX + mS / 2, mY + mS / 2, mS * 0.1))
      break
    }
    case 'Garage': {
      const carW = Math.min((w - 3*P) / 2, 70)
      const carH = Math.min(h - 2*P, 34)
      const carY = y + (h - carH) / 2
      if (w > 130) {
        const c1x = x + P, c2x = x + w - P - carW
        paths.push(R(c1x, carY, carW, carH))
        paths.push(L(c1x + 4, carY + 8, c1x + carW - 4, carY + 8))
        paths.push(R(c2x, carY, carW, carH))
        paths.push(L(c2x + 4, carY + 8, c2x + carW - 4, carY + 8))
      } else {
        const cX = x + (w - carW) / 2
        paths.push(R(cX, carY, carW, carH))
        paths.push(L(cX + 4, carY + 8, cX + carW - 4, carY + 8))
      }
      break
    }
    case 'Study':
    case 'Home Office': {
      const dW = Math.min(w - 2*P, 64), dH = 14
      paths.push(R(x + P, y + P, dW, dH))
      paths.push(R(x + P + dW / 2 - 10, y + P + dH + 4, 20, 16))
      break
    }
    case 'Theatre Room': {
      const sW = 13, sH = 10, sGx = 5, sGy = 7
      const cols = Math.max(2, Math.min(5, Math.floor((w - 2*P) / (sW + sGx))))
      const rows = Math.max(1, Math.min(3, Math.floor((h - 2*P - 14) / (sH + sGy))))
      const seatsW = cols * (sW + sGx) - sGx
      paths.push(R(x + P, y + P, w - 2*P, 6))  // screen
      const sStartX = x + (w - seatsW) / 2
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const sx = sStartX + col * (sW + sGx), sy = y + P + 14 + row * (sH + sGy)
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
      const tS = Math.min(w, h) * 0.32
      const tX = x + (w - tS) / 2, tY = y + (h - tS) / 2
      paths.push(C(tX + tS / 2, tY + tS / 2, tS / 2))
      const cR = tS * 0.15
      ;[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => {
        paths.push(C(tX + tS / 2 + dx * (tS / 2 + cR + 4), tY + tS / 2 + dy * (tS / 2 + cR + 4), cR))
      })
      break
    }
  }
  return paths.filter(Boolean)
}

// ─── site layer (north arrow, trees, block boundary, entrance path) ───────────
function SiteLayer({ rooms, zoom, CW, CH }) {
  if (!rooms.length) return null
  const xs = rooms.map(r => r.x), ys = rooms.map(r => r.y)
  const x2s = rooms.map(r => r.x + r.w), y2s = rooms.map(r => r.y + r.h)
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const maxX = Math.max(...x2s), maxY = Math.max(...y2s)
  const M = 56  // block margin
  const bx = minX - M, by = minY - M, bw = (maxX - minX) + M * 2, bh = (maxY - minY) + M * 2

  const foyer = rooms.find(r => r.type === 'Foyer')
  const epX = foyer ? foyer.x + foyer.w / 2 : null

  // fixed tree positions relative to block boundary
  const trees = [
    { cx: bx + 22, cy: by + bh * 0.38, r: 15 },
    { cx: bx + 36, cy: by + bh * 0.62, r: 9 },
    { cx: maxX + M * 0.4, cy: by + bh * 0.30, r: 13 },
    { cx: maxX + M * 0.55, cy: by + bh * 0.58, r: 8 },
    { cx: minX + (maxX - minX) * 0.55, cy: maxY + M * 0.55, r: 11 },
  ]
  const naX = maxX + M - 22, naY = by + 28

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: CW, height: CH,
      transform: `scale(${zoom})`, transformOrigin: 'top left',
      pointerEvents: 'none', zIndex: 2,
    }}>
      {/* Block boundary */}
      <rect x={bx} y={by} width={bw} height={bh}
        fill="none" stroke="#b8c4cc" strokeWidth={1.5} strokeDasharray="12 7" rx={4} />
      {/* Entrance path */}
      {foyer && (
        <line x1={epX} y1={foyer.y} x2={epX} y2={by + 4}
          stroke="#b0bbc4" strokeWidth={10} strokeLinecap="round" opacity={0.35} />
      )}
      {/* Tree circles */}
      {trees.map((t, i) => (
        <g key={i}>
          <circle cx={t.cx} cy={t.cy} r={t.r} fill="none" stroke="#93b893" strokeWidth={1.3} />
          <circle cx={t.cx} cy={t.cy} r={t.r * 0.45} fill="none" stroke="#93b893" strokeWidth={0.9} />
        </g>
      ))}
      {/* North arrow */}
      <g transform={`translate(${naX},${naY})`}>
        <line x1={0} y1={14} x2={0} y2={-14} stroke="#1a3a5c" strokeWidth={1.4} />
        <polygon points="0,-16 -5,-5 5,-5" fill="#1a3a5c" />
        <polygon points="0,16 -5,5 5,5" fill="none" stroke="#1a3a5c" strokeWidth={1.2} />
        <text x={0} y={26} textAnchor="middle" fontSize={9} fill="#1a3a5c"
          fontWeight="700" fontFamily="system-ui,sans-serif">N</text>
      </g>
      {/* Alfresco label */}
      {rooms.filter(r => r.type === 'Alfresco').map(r => (
        <text key={r.id}
          x={r.x + r.w / 2} y={r.y + r.h - 10}
          textAnchor="middle" fontSize={8} fill="#5a8a5a"
          fontFamily="system-ui,sans-serif" fontStyle="italic">
          outdoor entertaining
        </text>
      ))}
    </svg>
  )
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
            stroke="rgba(0,0,0,0.55)" strokeWidth={1.1} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))
      })}
    </svg>
  )
}

// ─── wall overlay ─────────────────────────────────────────────────────────────
const TOL = 4
const DOOR_W = 34
const WALL_EXT = 15
const WALL_INT = 8

function findAdjRoom(room, side, others) {
  const { x, y, w, h } = room
  return others.find(o => {
    if (o.id === room.id) return false
    if (side === 'N') return Math.abs(y - (o.y + o.h)) <= TOL && Math.max(x, o.x) < Math.min(x + w, o.x + o.w) - TOL
    if (side === 'S') return Math.abs((y + h) - o.y) <= TOL && Math.max(x, o.x) < Math.min(x + w, o.x + o.w) - TOL
    if (side === 'W') return Math.abs(x - (o.x + o.w)) <= TOL && Math.max(y, o.y) < Math.min(y + h, o.y + o.h) - TOL
    if (side === 'E') return Math.abs((x + w) - o.x) <= TOL && Math.max(y, o.y) < Math.min(y + h, o.y + o.h) - TOL
    return false
  }) ?? null
}

function isAdj(room, side, others) {
  return !!findAdjRoom(room, side, others)
}

function doorSideFor(room, others) {
  // Foyer always has front door on N wall (faces street)
  if (room.type === 'Foyer') return 'N'
  // Alfresco sliding door opens to living area (N wall)
  if (room.type === 'Alfresco') return 'N'
  // Ensuite/WIR door faces master bedroom (N wall)
  if (room.type === 'Ensuite' || room.type === 'Walk-in Robe') return 'N'
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

function WallOverlay({ rooms, openWalls, wallColor, zoom, CW, CH }) {
  if (!rooms.length) return null
  const wc = wallColor ?? '#1c1c1c'
  const elements = []
  rooms.forEach(room => {
    const isAlfresco = room.type === 'Alfresco'
    const door = room.type === 'Corridor' ? null : doorSideFor(room, rooms)
    ;['N', 'S', 'E', 'W'].forEach(side => {
      const adjRoom = findAdjRoom(room, side, rooms)
      const isOpen  = adjRoom && openWalls.has(wallKey(room.id, adjRoom.id))
      // Sliding door indicator between Alfresco and Living/Dining
      const isSlidingDoor = isOpen &&
        ((room.type === 'Alfresco' && (adjRoom?.type === 'Living Room' || adjRoom?.type === 'Dining Room')) ||
         (adjRoom?.type === 'Alfresco' && (room.type === 'Living Room' || room.type === 'Dining Room')))
      if (isSlidingDoor && (side === 'N' || side === 'S')) {
        const { x, y, w, h } = room
        const wy = side === 'N' ? y : y + h
        const x1 = Math.max(room.x, adjRoom.x), x2 = Math.min(room.x + room.w, adjRoom.x + adjRoom.w)
        // Two sliding panel lines side by side
        const mid = (x1 + x2) / 2
        elements.push(
          <line key={`${room.id}-${side}-s1`} x1={x1} y1={wy} x2={mid} y2={wy}
            stroke="#7ab87a" strokeWidth={4} strokeLinecap="square" />,
          <line key={`${room.id}-${side}-s2`} x1={mid} y1={wy} x2={x2} y2={wy}
            stroke="#7ab87a" strokeWidth={4} strokeLinecap="square" strokeDasharray="8 0" opacity={0.5} />
        )
        return
      }
      if (isOpen) return  // wall removed — open plan
      const sw = isAlfresco ? 2 : adjRoom ? WALL_INT : WALL_EXT
      const dashArr = isAlfresco ? '10 6' : undefined
      elements.push(
        <path key={`${room.id}-${side}`}
          d={wallPath(room, side, door)}
          stroke={isAlfresco ? '#7ab87a' : wc}
          strokeWidth={sw} strokeLinecap="square" fill="none"
          strokeDasharray={dashArr} />
      )
    })
    if (door) {
      elements.push(
        <path key={`${room.id}-arc`}
          d={doorArcPath(room, door)}
          stroke={wc} strokeWidth={1.2} strokeLinecap="round" fill="none" />
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

function WallControlLayer({ rooms, openWalls, onToggleWall, zoom, CW, CH }) {
  const [hovKey, setHovKey] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)  // { key, x, y } for right-click menu

  // Re-detect all adjacent pairs using 8px tolerance so snap rounding never misses a wall
  const pairs = useMemo(() => {
    const DT = 8
    const result = []
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j]
        const key = wallKey(a.id, b.id)
        if (Math.abs((a.x + a.w) - b.x) <= DT) {
          const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h)
          if (y2 - y1 > DT) result.push({ key, axis: 'V', p: a.x + a.w, lo: y1, hi: y2 })
        } else if (Math.abs((b.x + b.w) - a.x) <= DT) {
          const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h)
          if (y2 - y1 > DT) result.push({ key, axis: 'V', p: b.x + b.w, lo: y1, hi: y2 })
        } else if (Math.abs((a.y + a.h) - b.y) <= DT) {
          const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w)
          if (x2 - x1 > DT) result.push({ key, axis: 'H', p: a.y + a.h, lo: x1, hi: x2 })
        } else if (Math.abs((b.y + b.h) - a.y) <= DT) {
          const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w)
          if (x2 - x1 > DT) result.push({ key, axis: 'H', p: b.y + b.h, lo: x1, hi: x2 })
        }
      }
    }
    return result
  }, [rooms])

  // Close ctx menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close, { once: true })
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  if (!pairs.length) return null
  const HIT = 14  // wider hit area: 28px total band, easy to hover

  return (
    <>
      <svg style={{
        position: 'absolute', top: 0, left: 0, width: CW, height: CH,
        transform: `scale(${zoom})`, transformOrigin: 'top left',
        pointerEvents: 'none', zIndex: 18,
      }}>
        {pairs.map(p => {
          const isOpen = openWalls.has(p.key)
          const isHov  = hovKey === p.key
          const mid    = (p.lo + p.hi) / 2

          const handleCtx = e => {
            if (!isOpen) return
            e.preventDefault()
            setCtxMenu({ key: p.key, x: e.clientX, y: e.clientY })
          }

          if (p.axis === 'V') {
            return (
              <g key={p.key} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onMouseEnter={() => setHovKey(p.key)}
                onMouseLeave={() => setHovKey(null)}
                onClick={() => { setCtxMenu(null); onToggleWall(p.key) }}
                onContextMenu={handleCtx}>
                {/* Wide invisible hit area */}
                <rect x={p.p - HIT} y={p.lo} width={HIT * 2} height={p.hi - p.lo} fill="transparent" />
                {/* Red highlight line on hover (closed wall) */}
                {isHov && !isOpen && (
                  <line x1={p.p} y1={p.lo} x2={p.p} y2={p.hi}
                    stroke="#ef4444" strokeWidth={5} strokeLinecap="square" opacity={0.5} />
                )}
                {/* Blue dashed indicator for open walls (always visible) */}
                {isOpen && (
                  <line x1={p.p} y1={p.lo} x2={p.p} y2={p.hi}
                    stroke={isHov ? '#f97316' : 'rgba(99,102,241,0.3)'}
                    strokeWidth={isHov ? 3 : 2} strokeDasharray="7 5" />
                )}
                {/* Icon badge on hover */}
                {isHov && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={p.p} cy={mid} r={11}
                      fill={isOpen ? '#f97316' : '#ef4444'}
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))" />
                    {isOpen
                      ? /* plus = restore */ <path d={`M${p.p-4.5} ${mid} h9 M${p.p} ${mid-4.5} v9`} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
                      : /* minus = remove */ <path d={`M${p.p-4.5} ${mid} h9`} stroke="white" strokeWidth={2} strokeLinecap="round" />
                    }
                  </g>
                )}
              </g>
            )
          } else {
            return (
              <g key={p.key} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onMouseEnter={() => setHovKey(p.key)}
                onMouseLeave={() => setHovKey(null)}
                onClick={() => { setCtxMenu(null); onToggleWall(p.key) }}
                onContextMenu={handleCtx}>
                <rect x={p.lo} y={p.p - HIT} width={p.hi - p.lo} height={HIT * 2} fill="transparent" />
                {isHov && !isOpen && (
                  <line x1={p.lo} y1={p.p} x2={p.hi} y2={p.p}
                    stroke="#ef4444" strokeWidth={5} strokeLinecap="square" opacity={0.5} />
                )}
                {isOpen && (
                  <line x1={p.lo} y1={p.p} x2={p.hi} y2={p.p}
                    stroke={isHov ? '#f97316' : 'rgba(99,102,241,0.3)'}
                    strokeWidth={isHov ? 3 : 2} strokeDasharray="7 5" />
                )}
                {isHov && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={mid} cy={p.p} r={11}
                      fill={isOpen ? '#f97316' : '#ef4444'}
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))" />
                    {isOpen
                      ? <path d={`M${mid-4.5} ${p.p} h9 M${mid} ${p.p-4.5} v9`} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
                      : <path d={`M${mid-4.5} ${p.p} h9`} stroke="white" strokeWidth={2} strokeLinecap="round" />
                    }
                  </g>
                )}
              </g>
            )
          }
        })}
      </svg>

      {/* Right-click context menu to restore wall */}
      {ctxMenu && (
        <div style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 2000 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[150px] overflow-hidden">
          <button
            className="w-full text-left px-4 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
            onClick={() => { onToggleWall(ctxMenu.key); setCtxMenu(null) }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 108 0" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round"/><path d="M10 2v4H6" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Restore wall
          </button>
          <button
            className="w-full text-left px-4 py-2 text-[11px] text-gray-300 hover:bg-gray-50 cursor-pointer"
            onClick={() => setCtxMenu(null)}>
            Cancel
          </button>
        </div>
      )}
    </>
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
  const off = 28
  const lc = '#999', tc = '#555'
  const tickL = 6
  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: CW, height: CH,
      transform: `scale(${zoom})`, transformOrigin: 'top left',
      pointerEvents: 'none', zIndex: 25,
    }}>
      {/* Width — TOP */}
      <line x1={minX} y1={minY - off} x2={maxX} y2={minY - off} stroke={lc} strokeWidth={1} />
      <line x1={minX} y1={minY - off - tickL} x2={minX} y2={minY - off + tickL} stroke={lc} strokeWidth={1} />
      <line x1={maxX} y1={minY - off - tickL} x2={maxX} y2={minY - off + tickL} stroke={lc} strokeWidth={1} />
      {/* extension lines */}
      <line x1={minX} y1={minY} x2={minX} y2={minY - off + 2} stroke={lc} strokeWidth={0.5} strokeDasharray="3 3" />
      <line x1={maxX} y1={minY} x2={maxX} y2={minY - off + 2} stroke={lc} strokeWidth={0.5} strokeDasharray="3 3" />
      <text x={(minX + maxX) / 2} y={minY - off - 9}
        textAnchor="middle" fontSize="11" fill={tc}
        fontFamily="system-ui,sans-serif" fontWeight="600">{W}m</text>

      {/* Height — LEFT */}
      <line x1={minX - off} y1={minY} x2={minX - off} y2={maxY} stroke={lc} strokeWidth={1} />
      <line x1={minX - off - tickL} y1={minY} x2={minX - off + tickL} y2={minY} stroke={lc} strokeWidth={1} />
      <line x1={minX - off - tickL} y1={maxY} x2={minX - off + tickL} y2={maxY} stroke={lc} strokeWidth={1} />
      {/* extension lines */}
      <line x1={minX} y1={minY} x2={minX - off + 2} y2={minY} stroke={lc} strokeWidth={0.5} strokeDasharray="3 3" />
      <line x1={minX} y1={maxY} x2={minX - off + 2} y2={maxY} stroke={lc} strokeWidth={0.5} strokeDasharray="3 3" />
      <text
        x={minX - off - 16} y={(minY + maxY) / 2}
        textAnchor="middle" fontSize="11" fill={tc}
        fontFamily="system-ui,sans-serif" fontWeight="600"
        transform={`rotate(-90,${minX - off - 16},${(minY + maxY) / 2})`}
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
