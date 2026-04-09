import { View, Text, Canvas, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getSpaces, getSpace, createSpace, deleteSpace, addRoom, addContainer } from '../../services/space'
import { cloudSaveFloorplan } from '../../services/cloud'
import { CATEGORIES } from '../../services/items'
import './index.scss'

// ===== Constants =====
const SNAP_DISTANCE = 10
const MIN_SIZE = 15
const FLOOR_PX_TO_MM = 30
const ELEV_PX_TO_MM = 5
const CANVAS_ID = 'draw-canvas'

type FloorPhase = 'room' | 'furniture' | 'cabinet'
type Phase = FloorPhase | 'elevation'

const FLOOR_PHASES: FloorPhase[] = ['room', 'furniture', 'cabinet']

const PHASE_META: Record<Phase, { label: string; hint: string; empty: string }> = {
  room:      { label: '房间',   hint: '拖拽绘制房间区域，点击选中后命名', empty: '未命名' },
  furniture: { label: '家具',   hint: '在房间内拖拽绘制家具', empty: '未命名' },
  cabinet:   { label: '储物柜', hint: '拖拽放置储物柜，点击可进入立面编辑', empty: '未命名' },
  elevation: { label: '立面',   hint: '拖拽绘制柜体内部隔间，点击设定属性', empty: '未分类' },
}

const PHASE_LABELS: Record<Phase, string[]> = {
  room:      ['主卧', '次卧', '客厅', '厨房', '卫生间', '阳台', '书房', '玄关'],
  furniture: ['双人床', '单人床', '沙发', '餐桌', '书桌', '茶几', '电视'],
  cabinet:   ['衣柜', '书架', '鞋柜', '电视柜', '五斗柜', '储物柜', '床头柜'],
  elevation: CATEGORIES,
}

// No BG_COLORS needed — each phase has fixed visual style matching the floorplan reference

// ===== Types =====
interface Rect {
  id: string
  x: number; y: number; w: number; h: number
  labels: string[]
  slotType: 'open' | 'closed'
  phase: Phase
  cabinetId?: string
}

interface DrawState {
  isDrawing: boolean
  rawStartX: number; rawStartY: number
  startX: number; startY: number
  currX: number; currY: number
  snappedX: number | null; snappedY: number | null
  isError: boolean; hasMoved: boolean
}

// ===== Component =====
export default function DrawEditor() {
  const [phase, setPhase] = useState<Phase>('room')
  const [allRects, setAllRects] = useState<Rect[]>([])
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [canvasH, setCanvasH] = useState(400)
  const [editingCabinetId, setEditingCabinetId] = useState<string | null>(null)

  // Refs for non-reactive access
  const drawStateRef = useRef<DrawState>({
    isDrawing: false, rawStartX: 0, rawStartY: 0,
    startX: 0, startY: 0, currX: 0, currY: 0,
    snappedX: null, snappedY: null, isError: false, hasMoved: false,
  })
  const boundsRef = useRef<{ left: number; top: number } | null>(null)
  const ctxRef = useRef<any>(null)
  const cwRef = useRef(0)
  const chRef = useRef(0)

  const allRectsRef = useRef<Rect[]>([])
  const phaseRef = useRef<Phase>(phase)
  const selectedIdRef = useRef<string | null>(null)
  const editCabRef = useRef<string | null>(null)

  // Viewport: pinch-to-zoom + pan
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const pinchRef = useRef<{ initDist: number; initScale: number; initMidX: number; initMidY: number; initOx: number; initOy: number } | null>(null)

  allRectsRef.current = allRects
  phaseRef.current = phase
  selectedIdRef.current = selectedRectId
  editCabRef.current = editingCabinetId

  const pxToMm = phase === 'elevation' ? ELEV_PX_TO_MM : FLOOR_PX_TO_MM

  function screenToWorld(sx: number, sy: number) {
    const v = viewRef.current
    return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale }
  }

  // ===== Init =====
  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '空间绘制' })
    const sys = Taro.getSystemInfoSync()
    setCanvasH(Math.max(sys.windowHeight - 210, 250))
    setTimeout(initCanvas, 500)
  }, [])

  // Load saved data with validation
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync('draw_all_rects')
      if (saved) {
        const rects = JSON.parse(saved) as Rect[]
        if (Array.isArray(rects) && rects.every(r => r && typeof r.x === 'number' && typeof r.phase === 'string')) {
          allRectsRef.current = rects; setAllRects(rects)
        } else {
          Taro.removeStorageSync('draw_all_rects')
        }
      }
    } catch (e) {
      console.error('load draw data failed:', e)
      Taro.removeStorageSync('draw_all_rects')
    }
  }, [])

  useEffect(() => { renderCanvas() }, [allRects, selectedRectId, phase, editingCabinetId])
  useEffect(() => { setCustomInput('') }, [selectedRectId])

  function initCanvas() {
    try {
      Taro.createSelectorQuery().select(`#${CANVAS_ID}`)
        .fields({ node: true, size: true }).exec((res) => {
          if (!res?.[0]?.node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = Taro.getSystemInfoSync().pixelRatio || 2
          const cw = res[0].width; const ch = res[0].height
          if (!cw || !ch) return
          canvas.width = cw * dpr; canvas.height = ch * dpr
          ctx.scale(dpr, dpr)
          ctxRef.current = ctx; cwRef.current = cw; chRef.current = ch

          Taro.createSelectorQuery().select(`#${CANVAS_ID}`)
            .boundingClientRect().exec((b) => {
              if (b?.[0]) boundsRef.current = { left: b[0].left, top: b[0].top }
            })
          renderCanvas()
        })
    } catch (e) {
      console.error('initCanvas failed:', e)
    }
  }

  // ===== Rect Accessors =====
  function getActiveRects(): Rect[] {
    const p = phaseRef.current; const all = allRectsRef.current
    if (p === 'elevation') return all.filter(r => r.phase === 'elevation' && r.cabinetId === editCabRef.current)
    return all.filter(r => r.phase === p)
  }

  function getSnapPoolRects(): Rect[] {
    const p = phaseRef.current; const all = allRectsRef.current
    if (p === 'elevation') return all.filter(r => r.phase === 'elevation' && r.cabinetId === editCabRef.current)
    const idx = FLOOR_PHASES.indexOf(p as FloorPhase)
    const included = FLOOR_PHASES.slice(0, idx + 1)
    return all.filter(r => included.includes(r.phase as FloorPhase))
  }

  // ===== Geometry =====
  function stdRect(x1: number, y1: number, x2: number, y2: number) {
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  }

  function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function ptInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
  }

  // ===== Snap =====
  function getSnapPools() {
    const xP = new Set<number>(); const yP = new Set<number>()
    getSnapPoolRects().forEach(r => {
      xP.add(r.x); xP.add(r.x + r.w); yP.add(r.y); yP.add(r.y + r.h)
    })
    return { xPool: Array.from(xP), yPool: Array.from(yP) }
  }

  function nearSnap(val: number, pool: number[], threshold?: number) {
    let best: number | null = null; let minD = threshold ?? SNAP_DISTANCE
    for (const p of pool) { const d = Math.abs(val - p); if (d < minD) { minD = d; best = p } }
    return best
  }

  // ===== Render =====
  function drawDim(ctx: any, x: number, y: number, w: number, h: number, color: string) {
    const pmm = phaseRef.current === 'elevation' ? ELEV_PX_TO_MM : FLOOR_PX_TO_MM
    const s = viewRef.current.scale
    const fs = Math.round(10 / s)
    const gap = 3 / s
    ctx.fillStyle = color
    ctx.font = `${fs}px -apple-system, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(`${Math.round(w * pmm)}mm`, x + w / 2, y - gap)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(h * pmm)}mm`, x + w + gap + 1 / s, y + h / 2)
  }

  // Draw a floorplan rect with phase-specific visual style
  function drawFloorRect(ctx: any, rect: Rect, rectPhase: FloorPhase, isSel: boolean) {
    const { x, y, w, h } = rect
    const s = viewRef.current.scale
    const sw = (px: number) => px / s // screen px → world px

    if (isSel) {
      ctx.fillStyle = 'rgba(253,224,71,0.4)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#EAB308'; ctx.lineWidth = sw(3)
      ctx.strokeRect(x, y, w, h)
      drawDim(ctx, x, y, w, h, '#B45309')
    }

    if (rectPhase === 'room') {
      if (!isSel) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = sw(2.5)
        ctx.strokeRect(x, y, w, h)
      }
      if (rect.labels.length > 0) {
        ctx.fillStyle = '#8e99a4'
        ctx.font = `500 ${Math.round(sw(12))}px -apple-system, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(rect.labels[0], x + w / 2, y + h / 2)
      }
    } else if (rectPhase === 'furniture') {
      if (!isSel) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = '#a0a8b4'; ctx.lineWidth = sw(1)
        ctx.strokeRect(x, y, w, h)
      }
      ctx.fillStyle = '#a0a8b4'
      ctx.font = `400 ${Math.round(sw(10))}px -apple-system, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(rect.labels[0] || '', x + w / 2, y + h / 2)
    } else if (rectPhase === 'cabinet') {
      if (!isSel) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; ctx.lineWidth = sw(1.5)
        ctx.strokeRect(x, y, w, h)
      }
      const pad = sw(3)
      ctx.strokeStyle = isSel ? '#EAB308' : 'rgba(239, 68, 68, 0.35)'
      ctx.lineWidth = sw(1)
      ctx.beginPath()
      ctx.moveTo(x + pad, y + pad); ctx.lineTo(x + w - pad, y + h - pad)
      ctx.moveTo(x + w - pad, y + pad); ctx.lineTo(x + pad, y + h - pad)
      ctx.stroke()
      ctx.fillStyle = isSel ? '#b45309' : 'hsl(0, 84%, 45%)'
      ctx.font = `600 ${Math.round(sw(10))}px -apple-system, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(rect.labels[0] || '', x + w / 2, y - sw(3))
    }
  }

  // Draw an elevation rect (cabinet internal slot)
  function drawElevRect(ctx: any, rect: Rect, selId: string | null) {
    const { x, y, w, h } = rect
    const s = viewRef.current.scale
    const sw = (px: number) => px / s
    const isSel = rect.id === selId
    const hasLabel = rect.labels.length > 0
    const isClosed = rect.slotType === 'closed'

    let fill: string, stroke: string, textCol: string
    if (isSel) {
      fill = 'rgba(253,224,71,0.4)'; stroke = '#EAB308'; textCol = '#854D0E'
    } else if (hasLabel || isClosed) {
      fill = 'rgba(254,226,226,0.5)'; stroke = '#EF4444'; textCol = '#991B1B'
    } else {
      fill = 'rgba(229,231,235,0.4)'; stroke = '#9CA3AF'; textCol = '#6B7280'
    }

    ctx.fillStyle = fill; ctx.strokeStyle = stroke
    ctx.lineWidth = isSel ? sw(3) : sw(2)
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h)

    if (isClosed) {
      ctx.fillStyle = stroke
      ctx.fillRect(x + w / 2 - sw(12), y + Math.min(h * 0.3, sw(8)), sw(24), sw(3))
    }

    if (isSel) drawDim(ctx, x, y, w, h, '#B45309')

    ctx.fillStyle = textCol
    const fs = Math.round(sw(12))
    ctx.font = isSel ? `bold ${fs}px -apple-system, sans-serif` : `${fs}px -apple-system, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const typeStr = isClosed ? ' [抽屉]' : ' [开放]'
    const label = hasLabel ? rect.labels.join('+') + typeStr : '未分类' + typeStr
    const maxC = Math.floor(w / sw(8))
    const text = label.length > maxC && maxC > 3 ? label.slice(0, maxC - 1) + '..' : label
    ctx.fillText(text, x + w / 2, y + h / 2)
  }

  function renderCanvas() {
    const ctx = ctxRef.current
    if (!ctx) return
    const cw = cwRef.current; const ch = chRef.current
    if (!cw || !ch) return
    const p = phaseRef.current
    const selId = selectedIdRef.current
    const all = allRectsRef.current
    const v = viewRef.current

    ctx.clearRect(0, 0, cw, ch)

    // Apply viewport transform — everything below draws in world space
    ctx.save()
    ctx.translate(v.ox, v.oy)
    ctx.scale(v.scale, v.scale)

    // Grid dots (only visible portion)
    const wL = -v.ox / v.scale; const wT = -v.oy / v.scale
    const wR = (cw - v.ox) / v.scale; const wB = (ch - v.oy) / v.scale
    const grid = 20; const dotR = 0.7 / v.scale
    ctx.fillStyle = '#dfe2e7'
    const gxS = Math.floor(wL / grid) * grid; const gyS = Math.floor(wT / grid) * grid
    for (let gx = gxS; gx <= wR; gx += grid) {
      for (let gy = gyS; gy <= wB; gy += grid) {
        ctx.beginPath(); ctx.arc(gx, gy, dotR, 0, Math.PI * 2); ctx.fill()
      }
    }

    if (p === 'elevation') {
      all.filter(r => r.phase === 'elevation' && r.cabinetId === editCabRef.current)
        .forEach(r => drawElevRect(ctx, r, selId))
    } else {
      FLOOR_PHASES.forEach(fp => {
        all.filter(r => r.phase === fp).forEach(r => {
          const isSel = fp === p && r.id === selId
          drawFloorRect(ctx, r, fp, isSel)
        })
      })
    }

    // Preview rect (world space)
    const ds = drawStateRef.current
    if (ds.isDrawing && ds.hasMoved) {
      const ax = ds.snappedX ?? ds.currX; const ay = ds.snappedY ?? ds.currY
      const pv = stdRect(ds.startX, ds.startY, ax, ay)
      const sw = (px: number) => px / v.scale
      ctx.fillStyle = ds.isError ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)'
      ctx.strokeStyle = ds.isError ? '#EF4444' : '#3B82F6'
      ctx.lineWidth = sw(2)
      ctx.fillRect(pv.x, pv.y, pv.w, pv.h)
      ctx.strokeRect(pv.x, pv.y, pv.w, pv.h)
      drawDim(ctx, pv.x, pv.y, pv.w, pv.h, ds.isError ? '#EF4444' : '#2563EB')
    }

    ctx.restore()

    // Snap guides in screen space (after restore)
    if (ds.isDrawing && ds.hasMoved) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 1
      if (ds.snappedX !== null) {
        const sx = ds.snappedX * v.scale + v.ox
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, ch); ctx.stroke()
      }
      if (ds.snappedY !== null) {
        const sy = ds.snappedY * v.scale + v.oy
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cw, sy); ctx.stroke()
      }
      ctx.setLineDash([])
    }
  }

  // ===== Touch Handlers =====
  function handleTouchStart(e: any) {
    if (!boundsRef.current) return
    const bnd = boundsRef.current

    // Two-finger → pinch/pan
    if (e.touches?.length >= 2) {
      const t1 = e.touches[0]; const t2 = e.touches[1]
      const x1 = t1.clientX - bnd.left; const y1 = t1.clientY - bnd.top
      const x2 = t2.clientX - bnd.left; const y2 = t2.clientY - bnd.top
      const v = viewRef.current
      pinchRef.current = {
        initDist: Math.hypot(x2 - x1, y2 - y1),
        initScale: v.scale,
        initMidX: (x1 + x2) / 2, initMidY: (y1 + y2) / 2,
        initOx: v.ox, initOy: v.oy,
      }
      drawStateRef.current.isDrawing = false
      return
    }

    // Single finger → draw/tap
    const t = e.touches?.[0]; if (!t) return
    const rawX = t.clientX - bnd.left; const rawY = t.clientY - bnd.top
    const wc = screenToWorld(rawX, rawY)
    const snapDist = SNAP_DISTANCE / viewRef.current.scale
    const { xPool, yPool } = getSnapPools()
    const sx = nearSnap(wc.x, xPool, snapDist); const sy = nearSnap(wc.y, yPool, snapDist)

    drawStateRef.current = {
      isDrawing: true, rawStartX: rawX, rawStartY: rawY,
      startX: sx ?? wc.x, startY: sy ?? wc.y,
      currX: wc.x, currY: wc.y,
      snappedX: null, snappedY: null, isError: false, hasMoved: false,
    }
  }

  function handleTouchMove(e: any) {
    if (!boundsRef.current) return
    const bnd = boundsRef.current

    // Pinch/pan
    if (pinchRef.current && e.touches?.length >= 2) {
      const t1 = e.touches[0]; const t2 = e.touches[1]
      const x1 = t1.clientX - bnd.left; const y1 = t1.clientY - bnd.top
      const x2 = t2.clientX - bnd.left; const y2 = t2.clientY - bnd.top
      const dist = Math.hypot(x2 - x1, y2 - y1)
      const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2
      const p = pinchRef.current

      const newScale = Math.max(0.25, Math.min(5, p.initScale * (dist / p.initDist)))
      // Keep pinch center stable in world space
      const wMidX = (p.initMidX - p.initOx) / p.initScale
      const wMidY = (p.initMidY - p.initOy) / p.initScale
      const panDx = midX - p.initMidX; const panDy = midY - p.initMidY
      viewRef.current = {
        scale: newScale,
        ox: midX - wMidX * newScale + panDx - (p.initMidX - p.initOx - wMidX * p.initScale) + (p.initOx - p.initMidX + wMidX * p.initScale) + panDx,
        oy: midY - wMidY * newScale + panDy - (p.initMidY - p.initOy - wMidY * p.initScale) + (p.initOy - p.initMidY + wMidY * p.initScale) + panDy,
      }
      // Simplified: pin world-midpoint to screen-midpoint, plus pan offset
      viewRef.current = {
        scale: newScale,
        ox: midX - wMidX * newScale,
        oy: midY - wMidY * newScale,
      }
      renderCanvas()
      return
    }

    // Single finger drawing
    const ds = drawStateRef.current
    if (!ds.isDrawing) return
    if (e.touches?.length >= 2) { ds.isDrawing = false; return }

    const t = e.touches?.[0]; if (!t) return
    const rawX = t.clientX - bnd.left; const rawY = t.clientY - bnd.top

    if (!ds.hasMoved) {
      if (Math.hypot(rawX - ds.rawStartX, rawY - ds.rawStartY) > 5) ds.hasMoved = true
      else return
    }

    const wc = screenToWorld(rawX, rawY)
    const snapDist = SNAP_DISTANCE / viewRef.current.scale
    const { xPool, yPool } = getSnapPools()
    const sx = nearSnap(wc.x, xPool, snapDist); const sy = nearSnap(wc.y, yPool, snapDist)

    if (sx !== null && ds.snappedX !== sx) { try { Taro.vibrateShort({ type: 'light' }) } catch {} }
    if (sy !== null && ds.snappedY !== sy) { try { Taro.vibrateShort({ type: 'light' }) } catch {} }

    const ax = sx ?? wc.x; const ay = sy ?? wc.y
    const pv = stdRect(ds.startX, ds.startY, ax, ay)

    let isError = false
    if (pv.w > 0 && pv.h > 0) {
      const active = getActiveRects()
      for (const r of active) { if (intersects(pv, r)) { isError = true; break } }
    }

    drawStateRef.current = { ...ds, currX: wc.x, currY: wc.y, snappedX: sx, snappedY: sy, isError, hasMoved: true }
    renderCanvas()
  }

  function handleTouchEnd(e: any) {
    // End pinch
    if (pinchRef.current) {
      if (!e?.touches || e.touches.length < 2) pinchRef.current = null
      return
    }

    const ds = drawStateRef.current
    if (!ds.isDrawing) return

    if (!ds.hasMoved) {
      // Tap → select/deselect in world space
      const wc = screenToWorld(ds.rawStartX, ds.rawStartY)
      const active = getActiveRects()
      const hit = [...active].reverse().find(r => ptInRect(wc.x, wc.y, r))
      selectedIdRef.current = hit ? hit.id : null
      setSelectedRectId(hit ? hit.id : null)
    } else {
      const ax = ds.snappedX ?? ds.currX; const ay = ds.snappedY ?? ds.currY
      const nr = stdRect(ds.startX, ds.startY, ax, ay)
      const minW = MIN_SIZE / viewRef.current.scale

      if (!ds.isError && nr.w >= minW && nr.h >= minW) {
        const id = `rect_${Date.now()}`
        const newRect: Rect = {
          id, ...nr, labels: [], slotType: 'open',
          phase: phaseRef.current,
          cabinetId: phaseRef.current === 'elevation' ? editCabRef.current || undefined : undefined,
        }
        const newAll = [...allRectsRef.current, newRect]
        allRectsRef.current = newAll; selectedIdRef.current = id
        setAllRects(newAll); setSelectedRectId(id)
      }
    }

    drawStateRef.current = { ...ds, isDrawing: false, hasMoved: false, snappedX: null, snappedY: null, isError: false }
    renderCanvas()
  }

  // ===== Actions =====
  function toggleLabel(tag: string) {
    if (!selectedRectId || !tag.trim()) return
    const newAll = allRectsRef.current.map(r => {
      if (r.id !== selectedRectId) return r
      if (phase === 'elevation') {
        const has = r.labels.includes(tag)
        return { ...r, labels: has ? r.labels.filter(t => t !== tag) : [...r.labels, tag] }
      }
      return { ...r, labels: [tag] }
    })
    allRectsRef.current = newAll; setAllRects(newAll)
    // For non-elevation phases, deselect after labeling
    if (phase !== 'elevation') { selectedIdRef.current = null; setSelectedRectId(null) }
    setCustomInput('')
  }

  function updateSlotType(type: 'open' | 'closed') {
    if (!selectedRectId) return
    const newAll = allRectsRef.current.map(r => r.id === selectedRectId ? { ...r, slotType: type } : r)
    allRectsRef.current = newAll; setAllRects(newAll)
  }

  // Count items in a cabinet by draw rect ID → space service container ID mapping
  async function countCabinetItems(rectId: string): Promise<number> {
    try {
      const map = JSON.parse(Taro.getStorageSync('rect_container_map') || '{}')
      const mapping = map[rectId]
      if (!mapping) return 0

      const space = await getSpace(mapping.spaceId)
      if (!space?.rooms) return 0
      for (const room of space.rooms) {
        for (const c of (room.containers || [])) {
          if (c._id !== mapping.containerId) continue
          let count = 0
          for (const slot of (c.slots || [])) {
            if (Array.isArray(slot.items)) count += slot.items.length
            else if (typeof slot.items === 'string' && slot.items.trim()) count += slot.items.split('、').length
          }
          return count
        }
      }
    } catch {}
    return 0
  }

  async function deleteSelected() {
    if (!selectedRectId) return
    const rect = allRectsRef.current.find(r => r.id === selectedRectId)
    if (!rect) return

    // Helper: perform cascade delete
    function doCascadeDelete(extraIds: string[]) {
      const deleteIds = new Set([rect.id, ...extraIds])
      const newAll = allRectsRef.current.filter(r => !deleteIds.has(r.id))
      allRectsRef.current = newAll; selectedIdRef.current = null
      setAllRects(newAll); setSelectedRectId(null)
    }

    if (rect.phase === 'room') {
      const contained = allRectsRef.current.filter(r => {
        if (r.phase !== 'furniture' && r.phase !== 'cabinet') return false
        const cx = r.x + r.w / 2; const cy = r.y + r.h / 2
        return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h
      })
      const containedCabs = contained.filter(r => r.phase === 'cabinet')

      // Check if any contained cabinet has real items (by ID mapping)
      for (const cab of containedCabs) {
        const itemCount = await countCabinetItems(cab.id)
        if (itemCount > 0) {
          Taro.showModal({
            title: '无法删除',
            content: `「${cab.labels[0] || '储物柜'}」内还有 ${itemCount} 件物品，请先将物品迁移到其他储物柜后再删除该房间。`,
            showCancel: false,
          })
          return
        }
      }

      if (contained.length > 0) {
        const elevIds: string[] = []
        const cabIds = containedCabs.map(r => r.id)
        allRectsRef.current.forEach(r => {
          if (r.phase === 'elevation' && cabIds.includes(r.cabinetId || '')) elevIds.push(r.id)
        })
        Taro.showModal({
          title: '删除房间',
          content: `该房间内有 ${contained.length} 个家具/储物柜，将一并删除。确定删除？`,
          success: (res) => {
            if (res.confirm) doCascadeDelete([...contained.map(r => r.id), ...elevIds])
          },
        })
        return
      }
    }

    if (rect.phase === 'cabinet') {
      // Check if cabinet has real items (by ID mapping)
      const itemCount = await countCabinetItems(rect.id)
      if (itemCount > 0) {
        Taro.showModal({
          title: '无法删除',
          content: `「${rect.labels[0] || '储物柜'}」内还有 ${itemCount} 件物品，请先将物品迁移到其他储物柜后再删除。`,
          showCancel: false,
        })
        return
      }

      const elevIds = allRectsRef.current
        .filter(r => r.phase === 'elevation' && r.cabinetId === rect.id)
        .map(r => r.id)
      if (elevIds.length > 0) {
        Taro.showModal({
          title: '删除储物柜',
          content: `该储物柜有 ${elevIds.length} 个隔间，确定删除？`,
          success: (res) => { if (res.confirm) doCascadeDelete(elevIds) },
        })
        return
      }
    }

    // Simple delete (furniture, empty cabinet, elevation rect)
    doCascadeDelete([])
  }

  function clearPhase() {
    if (allRectsRef.current.length === 0) return
    if (phaseRef.current === 'elevation') {
      // In elevation: only clear this cabinet's slots
      const elRects = allRectsRef.current.filter(r => r.phase === 'elevation' && r.cabinetId === editCabRef.current)
      if (elRects.length === 0) return
      Taro.showModal({
        title: '清空', content: '确定清空当前立面隔间？',
        success: (res) => {
          if (!res.confirm) return
          const newAll = allRectsRef.current.filter(r => !(r.phase === 'elevation' && r.cabinetId === editCabRef.current))
          allRectsRef.current = newAll; selectedIdRef.current = null
          setAllRects(newAll); setSelectedRectId(null)
        },
      })
    } else {
      // In floorplan: clear ALL phases (rooms + furniture + cabinets + all elevations)
      Taro.showModal({
        title: '清空', content: '确定清空所有绘制内容（房间、家具、储物柜）？',
        success: (res) => {
          if (!res.confirm) return
          allRectsRef.current = []; selectedIdRef.current = null
          setAllRects([]); setSelectedRectId(null); setPhase('room')
        },
      })
    }
  }

  function resetView() {
    viewRef.current = { scale: 1, ox: 0, oy: 0 }
    renderCanvas()
  }

  // ===== Phase Navigation =====
  function goToPhase(p: FloorPhase) {
    if (p === phase) return
    setPhase(p); setSelectedRectId(null); selectedIdRef.current = null
  }

  function enterElevation(cabinetId: string) {
    viewRef.current = { scale: 1, ox: 0, oy: 0 }
    setEditingCabinetId(cabinetId); editCabRef.current = cabinetId
    setPhase('elevation'); setSelectedRectId(null); selectedIdRef.current = null
    setTimeout(() => {
      Taro.createSelectorQuery().select(`#${CANVAS_ID}`)
        .boundingClientRect().exec((b) => {
          if (b?.[0]) boundsRef.current = { left: b[0].left, top: b[0].top }
        })
    }, 100)
  }

  function leaveElevation() {
    viewRef.current = { scale: 1, ox: 0, oy: 0 }
    setPhase('cabinet'); setEditingCabinetId(null); editCabRef.current = null
    setSelectedRectId(null); selectedIdRef.current = null
  }

  // ===== Finish: save to space service + floorplan localStorage =====
  async function handleFinish() {
    Taro.showLoading({ title: '保存中...' })

    try {
      const json = generateJSON()

      // 1. Save visual floorplan data for FloorplanView (includes container positions)
      Taro.setStorageSync('drawn_floorplan', JSON.stringify({
        unit: json.unit, scale: json.scale,
        rooms: json.rooms, furniture: json.furniture,
        containers: json.containers.map((c: any) => ({
          name: c.name, x: c.x, y: c.y, width: c.width, height: c.height,
        })),
      }))

      // 2. Save rect data for draw-editor reload
      Taro.setStorageSync('draw_all_rects', JSON.stringify(allRects))

      // 3. Assign containers to rooms by spatial containment
      json.containers.forEach((c: any) => {
        const cx = c.x + c.width / 2; const cy = c.y + c.height / 2
        const room = json.rooms.find((r: any) => {
          const xs = r.walls.map((w: any) => Math.min(w.x1, w.x2))
          const ys = r.walls.map((w: any) => Math.min(w.y1, w.y2))
          const rx = Math.min(...xs); const ry = Math.min(...ys)
          const rw = Math.max(...r.walls.map((w: any) => Math.max(w.x1, w.x2))) - rx
          const rh = Math.max(...r.walls.map((w: any) => Math.max(w.y1, w.y2))) - ry
          return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh
        })
        c.roomJsonId = room?.id
      })

      // 4. Delete existing space, create fresh
      const existingSpaces = await getSpaces()
      for (const s of existingSpaces) {
        await deleteSpace(s._id)
      }

      const space = await createSpace('我的家')

      // 5. Create rooms and track ID mapping (drawId → serviceId)
      const roomIdMap: Record<string, string> = {}
      for (const drawnRoom of json.rooms) {
        const room = await addRoom(space._id, drawnRoom.name)
        if (room) roomIdMap[drawnRoom.id] = room._id
      }

      // 6. Create containers with slots (spatial layout from elevation rects)
      for (const c of json.containers) {
        const serviceRoomId = roomIdMap[c.roomJsonId] || Object.values(roomIdMap)[0]
        if (!serviceRoomId) continue

        // Get raw elevation rects for this cabinet
        const elevRects = allRects.filter(r => r.phase === 'elevation' && r.cabinetId === c.id)
        let slots: any[] = []
        let elevationAspect = 1

        if (elevRects.length > 0) {
          // Compute bounding box of all elevation rects
          let eMinX = Infinity; let eMinY = Infinity; let eMaxX = -Infinity; let eMaxY = -Infinity
          elevRects.forEach(r => {
            eMinX = Math.min(eMinX, r.x); eMinY = Math.min(eMinY, r.y)
            eMaxX = Math.max(eMaxX, r.x + r.w); eMaxY = Math.max(eMaxY, r.y + r.h)
          })
          const eW = eMaxX - eMinX || 1; const eH = eMaxY - eMinY || 1
          elevationAspect = eH / eW

          slots = elevRects.map((r, i) => ({
            label: r.labels.length > 0 ? r.labels.join('+') : `格${i + 1}`,
            type: r.slotType === 'closed' ? 'drawer' : 'shelf',
            categories: [...r.labels],
            items: [],
            photo: '',
            rx: (r.x - eMinX) / eW,
            ry: (r.y - eMinY) / eH,
            rw: r.w / eW,
            rh: r.h / eH,
          }))
        }

        const created = await addContainer(space._id, serviceRoomId, {
          name: c.name,
          type: 'custom',
          movable: false,
          photo: '',
          elevationAspect,
          x: c.x, y: c.y, width: c.width, height: c.height,
          slots: slots.length > 0 ? slots : [{ label: '第1层', type: 'shelf', items: '', photo: '' }],
        })
        // Store mapping: draw rect ID → service IDs
        if (created) {
          const map = JSON.parse(Taro.getStorageSync('rect_container_map') || '{}')
          map[c.id] = { containerId: created._id, spaceId: space._id, roomId: serviceRoomId }
          Taro.setStorageSync('rect_container_map', JSON.stringify(map))
        }
      }

      // Sync visual data to cloud (async, non-blocking)
      try {
        const fpJson = Taro.getStorageSync('drawn_floorplan') || ''
        const rectsJson = Taro.getStorageSync('draw_all_rects') || ''
        const mapJson = Taro.getStorageSync('rect_container_map') || ''
        cloudSaveFloorplan(fpJson, rectsJson, mapJson).catch(e => console.warn('[Sync] floorplan:', e.message))
      } catch {}

      Taro.hideLoading()
      Taro.showModal({
        title: '设定完成',
        content: `已创建 ${json.rooms.length} 个房间、${json.containers.length} 个储物柜`,
        showCancel: false,
        success: () => Taro.navigateBack(),
      })
    } catch (e) {
      Taro.hideLoading()
      console.error('handleFinish error:', e)
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  }

  // ===== Save/Export =====
  function handleSave() {
    Taro.setStorageSync('draw_all_rects', JSON.stringify(allRects))
    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  function handleCopyJson() {
    const json = generateJSON()
    Taro.setClipboardData({ data: JSON.stringify(json, null, 2) })
  }

  function generateJSON() {
    const pmm = FLOOR_PX_TO_MM
    const emm = ELEV_PX_TO_MM
    const rooms = allRects.filter(r => r.phase === 'room')
    const furniture = allRects.filter(r => r.phase === 'furniture')
    const cabinets = allRects.filter(r => r.phase === 'cabinet')

    return {
      unit: 'mm', scale: 0.05,
      rooms: rooms.map((r, i) => {
        const x = Math.round(r.x * pmm); const y = Math.round(r.y * pmm)
        const w = Math.round(r.w * pmm); const h = Math.round(r.h * pmm)
        return {
          id: r.id, name: r.labels[0] || `未命名房间 ${i + 1}`,
          walls: [
            { x1: x, y1: y, x2: x + w, y2: y },
            { x1: x + w, y1: y, x2: x + w, y2: y + h },
            { x1: x + w, y1: y + h, x2: x, y2: y + h },
            { x1: x, y1: y + h, x2: x, y2: y },
          ],
          doors: [], windows: [], offset: { x: 0, y: 0 },
        }
      }),
      furniture: furniture.map((r, i) => ({
        id: r.id, name: r.labels[0] || `家具 ${i + 1}`,
        room: 'unknown',
        x: Math.round(r.x * pmm), y: Math.round(r.y * pmm),
        width: Math.round(r.w * pmm), height: Math.round(r.h * pmm),
      })),
      containers: cabinets.map((cab, ci) => {
        const elevRects = allRects.filter(r => r.phase === 'elevation' && r.cabinetId === cab.id)
        const colsMap: Record<number, { x: number; width: number; slots: any[] }> = {}

        elevRects.forEach(r => {
          const colX = Math.round(r.x * emm)
          const colW = Math.round(r.w * emm)
          if (!colsMap[colX]) colsMap[colX] = { x: colX, width: colW, slots: [] }
          colsMap[colX].width = Math.max(colsMap[colX].width, colW)
          colsMap[colX].slots.push({
            id: r.id,
            type: r.slotType === 'closed' ? 'drawer' : 'open',
            categories: r.labels,
            y_start: Math.round(r.y * emm),
            y_end: Math.round((r.y + r.h) * emm),
            items: [],
          })
        })

        const columns = Object.values(colsMap)
          .sort((a, b) => a.x - b.x)
          .map((col, i) => ({ id: `col${i + 1}`, width: col.width, slots: col.slots.sort((a, b) => a.y_start - b.y_start) }))

        return {
          id: cab.id, name: cab.labels[0] || `储物柜 ${ci + 1}`,
          room: 'unknown',
          x: Math.round(cab.x * pmm), y: Math.round(cab.y * pmm),
          width: Math.round(cab.w * pmm), height: Math.round(cab.h * pmm),
          columns,
        }
      }),
    }
  }

  // ===== Derived =====
  const selectedRect = allRects.find(r => r.id === selectedRectId)
  const activeLabels = selectedRect?.labels || []
  const slotType = selectedRect?.slotType || 'open'
  const activeRects = phase === 'elevation'
    ? allRects.filter(r => r.phase === 'elevation' && r.cabinetId === editingCabinetId)
    : allRects.filter(r => r.phase === phase)
  const curPhaseIdx = FLOOR_PHASES.indexOf(phase as FloorPhase)
  const editingCabinet = allRects.find(r => r.id === editingCabinetId)

  // Navigation: can go to next phase?
  const canGoNext = curPhaseIdx >= 0 && curPhaseIdx < FLOOR_PHASES.length - 1
  const nextPhase = canGoNext ? FLOOR_PHASES[curPhaseIdx + 1] : null

  // "完成设定": all cabinets have elevation data
  const cabinetRects = allRects.filter(r => r.phase === 'cabinet')
  const allCabsDone = cabinetRects.length > 0 && cabinetRects.every(cab =>
    allRects.some(r => r.phase === 'elevation' && r.cabinetId === cab.id)
  )

  // ===== JSX =====
  return (
    <View className='draw-editor'>
      {/* Top bar */}
      {phase !== 'elevation' ? (
        <View className='top-bar'>
          <View className='steps'>
            {FLOOR_PHASES.map((p, i) => {
              const isActive = phase === p
              const isDone = curPhaseIdx > i
              return (
                <View key={p} className='step-item'>
                  {i > 0 && <Text className='step-arrow'>{'>'}</Text>}
                  <View
                    className={`step ${isActive ? 'active' : isDone ? 'done' : 'pending'}`}
                    onClick={() => goToPhase(p)}
                  >
                    <Text className='step-text'>{i + 1}.{PHASE_META[p].label}</Text>
                  </View>
                </View>
              )
            })}
          </View>
          <View className='top-right-btns'>
            <View className='text-btn' onClick={resetView}>
              <Text className='text-btn-label'>重置视图</Text>
            </View>
            <View className='text-btn' onClick={clearPhase}>
              <Text className='text-btn-label danger'>清空</Text>
            </View>
          </View>
        </View>
      ) : (
        <View className='top-bar elev-bar'>
          <View className='back-btn' onClick={leaveElevation}>
            <Text className='back-text'>{'<'} 返回平面</Text>
          </View>
          <Text className='elev-title'>
            立面: {editingCabinet?.labels?.[0] || '储物柜'}
          </Text>
          <View className='top-right-btns'>
            <View className='text-btn' onClick={resetView}>
              <Text className='text-btn-label'>重置视图</Text>
            </View>
            <View className='text-btn' onClick={clearPhase}>
              <Text className='text-btn-label danger'>清空</Text>
            </View>
          </View>
        </View>
      )}

      {/* Hint */}
      <View className='hint-bar'>
        <Text className='hint-text'>{PHASE_META[phase].hint}</Text>
      </View>

      {/* Canvas */}
      <View className='canvas-wrap'>
        <Canvas
          type='2d'
          id={CANVAS_ID}
          className='draw-canvas'
          style={`width:100%;height:${canvasH}px`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </View>

      {/* Info bar */}
      <View className='info-bar'>
        <View className='scale-indicator'>
          <View className='scale-ruler' />
          <Text className='scale-text'>{20 * pxToMm}mm</Text>
        </View>
        <Text className='count-text'>
          {activeRects.length} 个{PHASE_META[phase].label}
        </Text>
      </View>

      {/* Bottom actions */}
      {!selectedRect && (
        <View className='bottom-actions'>
          {/* "下一步" guide for floorplan phases */}
          {phase !== 'elevation' && canGoNext && activeRects.length > 0 && (
            <View className='bottom-btn accent' onClick={() => goToPhase(nextPhase!)}>
              <Text className='bottom-btn-text light'>下一步: {PHASE_META[nextPhase!].label}</Text>
            </View>
          )}
          {/* "完成设定" when all cabinets have elevation */}
          {phase === 'cabinet' && allCabsDone && (
            <View className='bottom-btn success' onClick={handleFinish}>
              <Text className='bottom-btn-text light'>完成设定</Text>
            </View>
          )}
          {/* Elevation: "确定" to return */}
          {phase === 'elevation' && (
            <View className='bottom-btn accent' onClick={leaveElevation}>
              <Text className='bottom-btn-text light'>确定并返回平面</Text>
            </View>
          )}
        </View>
      )}

      {/* Property panel */}
      {selectedRect && (
        <View className='panel-mask' onClick={() => setSelectedRectId(null)}>
          <View className='property-panel' onClick={(e) => e.stopPropagation()}>
            <View className='panel-header'>
              <Text className='panel-title'>
                {phase === 'elevation' ? '配置隔间属性' : `设定${PHASE_META[phase].label}`}
              </Text>
              <View className='panel-close' onClick={() => setSelectedRectId(null)}>
                <Text className='close-icon'>x</Text>
              </View>
            </View>

            {/* Elevation: slot type toggle */}
            {phase === 'elevation' && (
              <View className='type-section'>
                <Text className='section-label'>1. 隔间形态</Text>
                <View className='type-btns'>
                  <View className={`type-btn ${slotType !== 'closed' ? 'active' : ''}`} onClick={() => updateSlotType('open')}>
                    <Text className='type-btn-text'>开放式 (层板)</Text>
                  </View>
                  <View className={`type-btn ${slotType === 'closed' ? 'active' : ''}`} onClick={() => updateSlotType('closed')}>
                    <Text className='type-btn-text'>封闭式 (抽屉)</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Label input */}
            {phase === 'elevation' && (
              <Text className='section-label input-label'>2. 储物类别 (可多选)</Text>
            )}
            <View className='input-row'>
              <Input
                className='custom-input'
                placeholder={`输入自定义${PHASE_META[phase].label}名，回车确认`}
                value={customInput}
                onInput={e => setCustomInput(e.detail.value)}
                onConfirm={() => toggleLabel(customInput)}
              />
            </View>

            {/* Preset tags */}
            <View className='preset-tags'>
              {PHASE_LABELS[phase].map(p => {
                const isActive = activeLabels.includes(p)
                return (
                  <View key={p} className={`tag ${isActive ? 'active' : ''}`} onClick={() => toggleLabel(p)}>
                    <Text className='tag-text'>{p}</Text>
                    {isActive && phase === 'elevation' && <Text className='tag-check'>&#10003;</Text>}
                  </View>
                )
              })}
            </View>

            {/* Footer */}
            <View className='panel-footer'>
              <View className='del-btn' onClick={deleteSelected}>
                <Text className='del-text'>删除</Text>
              </View>
              <View className='footer-right'>
                {/* Enter elevation button (only in cabinet phase) */}
                {phase === 'cabinet' && (
                  <View className='elev-enter-btn' onClick={() => enterElevation(selectedRectId!)}>
                    <Text className='elev-enter-text'>进入立面编辑</Text>
                  </View>
                )}
                {phase === 'elevation' && (
                  <View className='done-btn' onClick={() => setSelectedRectId(null)}>
                    <Text className='done-text'>确定</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
