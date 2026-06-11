// ─── floor plan SVG templates ────────────────────────────────────────────────
// Each template is a pure SVG component.
// Props: hoveredRoom (string|null), onHover(id), onLeave()
// Rooms are <g id="room-id"> so phase 2 can attach data by stable id.

const WALL     = '#111'
const WALL_W   = 1.5   // inner walls
const OUTER_W  = 5     // outer perimeter
const TEXT_CLR = '#111'
const DIM_CLR  = '#888'
const HOVER_FILL = 'rgba(26,58,229,0.08)'

// Helper: door arc. hinge=(hx,hy), tip of closed door=(tx,ty), sweep 0|1
function DoorArc({ hx, hy, tx, ty, sweep = 1 }) {
  const dx = tx - hx, dy = ty - hy
  const r  = Math.round(Math.sqrt(dx * dx + dy * dy))
  // arc end = rotate (tx,ty) 90° around (hx,hy)
  const ex = hx + (sweep === 1 ? -dy : dy)
  const ey = hy + (sweep === 1 ?  dx : -dx)
  return (
    <g stroke={WALL} strokeWidth="1" fill="none">
      <line x1={hx} y1={hy} x2={tx} y2={ty} />
      <path d={`M ${tx} ${ty} A ${r} ${r} 0 0 ${sweep} ${ex} ${ey}`} />
    </g>
  )
}

// Helper: room group
function Room({ id, x, y, w, h, label, dim, hover, onHover, onLeave, children }) {
  const isHovered = hover === id
  return (
    <g
      id={id}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={onLeave}
      style={{ cursor: 'default' }}
    >
      <rect
        x={x} y={y} width={w} height={h}
        fill={isHovered ? HOVER_FILL : 'white'}
        stroke={WALL} strokeWidth={WALL_W}
        style={{ transition: 'fill 120ms ease' }}
      />
      {/* room name */}
      <text
        x={x + w / 2} y={y + h / 2 - (dim ? 8 : 0)}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="12" fontWeight="600" fill={TEXT_CLR}
        fontFamily="Inter, system-ui, sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
      {/* dimensions */}
      {dim && (
        <text
          x={x + w / 2} y={y + h / 2 + 10}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fill={DIM_CLR}
          fontFamily="Inter, system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {dim}
        </text>
      )}
      {children}
    </g>
  )
}

// ─── TEMPLATE 1: 2 BED / 1 BATH ──────────────────────────────────────────────
export function Template2b1b({ hoveredRoom, onHover, onLeave }) {
  const h = { hover: hoveredRoom, onHover, onLeave }
  return (
    <svg viewBox="0 0 580 460" width="100%" style={{ display: 'block', maxHeight: 480 }}>
      {/* outer wall */}
      <rect x="20" y="20" width="540" height="420" fill="white" stroke={WALL} strokeWidth={OUTER_W} />

      <Room id="bedroom-1"  x={20}  y={20}  w={200} h={200} label="Master Bedroom"  dim="5.0 × 5.0m" {...h}>
        <DoorArc hx={220} hy={120} tx={220} ty={80}  sweep={0} />
      </Room>
      <Room id="bedroom-2"  x={20}  y={220} w={200} h={220} label="Bedroom 2"       dim="5.0 × 5.5m" {...h}>
        <DoorArc hx={20}  hy={280} tx={60}  ty={280} sweep={1} />
      </Room>
      <Room id="living"     x={220} y={20}  w={180} h={200} label="Living Room"     dim="4.5 × 5.0m" {...h} />
      <Room id="kitchen"    x={220} y={220} w={180} h={140} label="Kitchen / Dining" dim="4.5 × 3.5m" {...h} />
      <Room id="dining"     x={220} y={360} w={180} h={80}  label="Dining"          dim="4.5 × 2.0m" {...h} />
      <Room id="bathroom"   x={400} y={20}  w={160} h={140} label="Bathroom"        dim="4.0 × 3.5m" {...h}>
        <DoorArc hx={400} hy={160} tx={440} ty={160} sweep={0} />
      </Room>
      <Room id="laundry"    x={400} y={160} w={160} h={100} label="Laundry"         dim="4.0 × 2.5m" {...h} />
      <Room id="entry"      x={400} y={260} w={160} h={180} label="Entry / Hall"    dim="4.0 × 4.5m" {...h}>
        <DoorArc hx={560} hy={380} tx={520} ty={380} sweep={1} />
      </Room>

      {/* outer wall on top for crisp perimeter */}
      <rect x="20" y="20" width="540" height="420" fill="none" stroke={WALL} strokeWidth={OUTER_W} />
    </svg>
  )
}

// ─── TEMPLATE 2: 3 BED / 2 BATH ──────────────────────────────────────────────
export function Template3b2b({ hoveredRoom, onHover, onLeave }) {
  const h = { hover: hoveredRoom, onHover, onLeave }
  return (
    <svg viewBox="0 0 680 520" width="100%" style={{ display: 'block', maxHeight: 500 }}>
      <rect x="20" y="20" width="640" height="480" fill="white" stroke={WALL} strokeWidth={OUTER_W} />

      <Room id="bedroom-1"  x={20}  y={20}  w={220} h={220} label="Master Bedroom"  dim="5.5 × 5.5m" {...h}>
        <DoorArc hx={240} hy={140} tx={240} ty={100} sweep={0} />
      </Room>
      <Room id="ensuite"    x={20}  y={240} w={110} h={100} label="Ensuite"         dim="2.75 × 2.5m" {...h}>
        <DoorArc hx={130} hy={240} tx={130} ty={280} sweep={1} />
      </Room>
      <Room id="wir"        x={130} y={240} w={110} h={100} label="Walk-in Robe"    dim="2.75 × 2.5m" {...h} />
      <Room id="bedroom-2"  x={20}  y={340} w={220} h={160} label="Bedroom 2"       dim="5.5 × 4.0m" {...h}>
        <DoorArc hx={20}  hy={400} tx={60}  ty={400} sweep={1} />
      </Room>

      <Room id="living"     x={240} y={20}  w={220} h={220} label="Living / Family" dim="5.5 × 5.5m" {...h} />
      <Room id="dining"     x={240} y={240} w={220} h={120} label="Dining"          dim="5.5 × 3.0m" {...h} />
      <Room id="bedroom-3"  x={240} y={360} w={220} h={140} label="Bedroom 3"       dim="5.5 × 3.5m" {...h}>
        <DoorArc hx={240} hy={420} tx={280} ty={420} sweep={1} />
      </Room>

      <Room id="kitchen"    x={460} y={20}  w={200} h={180} label="Kitchen"         dim="5.0 × 4.5m" {...h} />
      <Room id="bathroom"   x={460} y={200} w={200} h={140} label="Bathroom"        dim="5.0 × 3.5m" {...h}>
        <DoorArc hx={460} hy={340} tx={500} ty={340} sweep={0} />
      </Room>
      <Room id="laundry"    x={460} y={340} w={200} h={80}  label="Laundry"         dim="5.0 × 2.0m" {...h} />
      <Room id="entry"      x={460} y={420} w={200} h={80}  label="Entry / Hall"    dim="5.0 × 2.0m" {...h}>
        <DoorArc hx={660} hy={460} tx={620} ty={460} sweep={1} />
      </Room>

      <rect x="20" y="20" width="640" height="480" fill="none" stroke={WALL} strokeWidth={OUTER_W} />
    </svg>
  )
}

// ─── TEMPLATE 3: 4 BED / 2 BATH ──────────────────────────────────────────────
export function Template4b2b({ hoveredRoom, onHover, onLeave }) {
  const h = { hover: hoveredRoom, onHover, onLeave }
  return (
    <svg viewBox="0 0 820 580" width="100%" style={{ display: 'block', maxHeight: 560 }}>
      <rect x="20" y="20" width="780" height="540" fill="white" stroke={WALL} strokeWidth={OUTER_W} />

      {/* Sleep zone — left */}
      <Room id="bedroom-1"  x={20}  y={20}  w={340} h={200} label="Master Bedroom"  dim="8.5 × 5.0m" {...h}>
        <DoorArc hx={360} hy={120} tx={360} ty={80}  sweep={0} />
      </Room>
      <Room id="ensuite"    x={20}  y={220} w={170} h={120} label="Ensuite"         dim="4.25 × 3.0m" {...h}>
        <DoorArc hx={190} hy={220} tx={190} ty={260} sweep={1} />
      </Room>
      <Room id="wir"        x={190} y={220} w={170} h={120} label="Walk-in Robe"    dim="4.25 × 3.0m" {...h} />
      <Room id="bedroom-2"  x={20}  y={340} w={170} h={220} label="Bedroom 2"       dim="4.25 × 5.5m" {...h}>
        <DoorArc hx={20}  hy={400} tx={60}  ty={400} sweep={1} />
      </Room>
      <Room id="bedroom-3"  x={190} y={340} w={170} h={220} label="Bedroom 3"       dim="4.25 × 5.5m" {...h}>
        <DoorArc hx={190} hy={400} tx={230} ty={400} sweep={1} />
      </Room>

      {/* Transition zone — middle */}
      <Room id="bathroom"   x={360} y={20}  w={180} h={140} label="Bathroom"        dim="4.5 × 3.5m" {...h}>
        <DoorArc hx={360} hy={160} tx={400} ty={160} sweep={0} />
      </Room>
      <Room id="laundry"    x={360} y={160} w={180} h={100} label="Laundry"         dim="4.5 × 2.5m" {...h} />
      <Room id="hall"       x={360} y={260} w={180} h={80}  label="Hall"            dim="4.5 × 2.0m" {...h} />
      <Room id="bedroom-4"  x={360} y={340} w={180} h={220} label="Bedroom 4"       dim="4.5 × 5.5m" {...h}>
        <DoorArc hx={360} hy={400} tx={400} ty={400} sweep={1} />
      </Room>

      {/* Living zone — right */}
      <Room id="living"     x={540} y={20}  w={260} h={220} label="Living / Family" dim="6.5 × 5.5m" {...h} />
      <Room id="kitchen"    x={540} y={240} w={260} h={160} label="Kitchen"         dim="6.5 × 4.0m" {...h} />
      <Room id="dining"     x={540} y={400} w={260} h={160} label="Dining"          dim="6.5 × 4.0m" {...h}>
        <DoorArc hx={800} hy={520} tx={760} ty={520} sweep={1} />
      </Room>

      <rect x="20" y="20" width="780" height="540" fill="none" stroke={WALL} strokeWidth={OUTER_W} />
    </svg>
  )
}

// ─── template registry ────────────────────────────────────────────────────────
export const FLOOR_PLAN_TEMPLATES = [
  {
    id:        '2b1b',
    label:     '2 Bed · 1 Bath',
    beds:      2,
    baths:     1,
    size:      '~85 m²',
    Component: Template2b1b,
  },
  {
    id:        '3b2b',
    label:     '3 Bed · 2 Bath',
    beds:      3,
    baths:     2,
    size:      '~150 m²',
    Component: Template3b2b,
  },
  {
    id:        '4b2b',
    label:     '4 Bed · 2 Bath',
    beds:      4,
    baths:     2,
    size:      '~210 m²',
    Component: Template4b2b,
  },
]
