import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import staticFloorplan from '../data/floorplan.json'
import './FloorplanView.scss'

interface Container {
  _id: string
  name: string
  slots?: any[]
  x?: number; y?: number; width?: number; height?: number
}

interface Room {
  _id: string
  name: string
  containers?: Container[]
}

interface FloorplanViewProps {
  rooms: Room[]
  compact?: boolean
  spaceId?: string
  highlightContainerId?: string | null
  onContainerClick?: (roomId: string, containerId: string) => void
}

// Fallback hardcoded positions (used when container has no x/y/width/height)
const CONTAINER_POS: Record<string, { x: number; y: number; w: number; h: number }> = {
  '衣柜': { x: 200, y: 2800, w: 2100, h: 600 },
  '五斗柜': { x: 2700, y: 2800, w: 800, h: 500 },
  '床头柜': { x: 2700, y: 800, w: 500, h: 500 },
  '电视柜': { x: 3500, y: 3700, w: 1800, h: 500 },
  '书架': { x: 200, y: 5800, w: 1000, h: 500 },
  '储物柜': { x: 200, y: 6400, w: 800, h: 400 },
  '鞋柜': { x: 200, y: 7000, w: 1200, h: 400 },
  '书柜': { x: 6200, y: 1200, w: 600, h: 1800 },
}

interface HitArea {
  roomId: string
  containerId: string
  x: number; y: number; w: number; h: number
}

// Load drawn floorplan from localStorage, fall back to static JSON
function getFloorplanData(spaceId?: string): any {
  if (!spaceId) return { rooms: [], furniture: [], containers: [] }
  try {
    const saved = Taro.getStorageSync(`drawn_floorplan_${spaceId}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed?.rooms?.length > 0) return parsed
    }
  } catch {}
  return { rooms: [], furniture: [], containers: [] }
}

export default function FloorplanView({ rooms, compact, spaceId, highlightContainerId, onContainerClick }: FloorplanViewProps) {
  const hitAreasRef = useRef<HitArea[]>([])
  const canvasId = compact ? 'fp-compact' : 'fp-full'
  const [canvasHeight, setCanvasHeight] = useState(compact ? 300 : 420)

  useEffect(() => {
    if (rooms.length > 0) setTimeout(() => draw(), 200)
  }, [rooms, spaceId, highlightContainerId])

  function draw() {
    const floorplanData = getFloorplanData(spaceId)

    // Build container position map from drawn_floorplan
    const drawnContainerPos: Record<string, { x: number; y: number; w: number; h: number }> = {}
    if (floorplanData.containers) {
      floorplanData.containers.forEach((c: any) => {
        if (c.name && c.x != null) {
          drawnContainerPos[c.name] = { x: c.x, y: c.y, w: c.width, h: c.height }
        }
      })
    }

    // Calculate bounding box (min/max) of all elements for centering
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    floorplanData.rooms.forEach((room: any) => {
      room.walls.forEach((w: any) => {
        minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2)
        maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2)
      })
    })
    if (floorplanData.furniture) {
      floorplanData.furniture.forEach((f: any) => {
        minX = Math.min(minX, f.x); minY = Math.min(minY, f.y)
        maxX = Math.max(maxX, f.x + f.width); maxY = Math.max(maxY, f.y + f.height)
      })
    }
    Object.values(drawnContainerPos).forEach((p: any) => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h)
    })

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 7200; maxY = 7700 }
    const fpW = maxX - minX || 7200
    const fpH = maxY - minY || 7700

    const query = Taro.createSelectorQuery()
    query.select(`#${canvasId}`).fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = 2
      const cw = res[0].width
      const padBot = compact ? 16 : 36
      const ch = cw * (fpH / fpW) + padBot

      setCanvasHeight(ch)

      canvas.width = cw * dpr
      canvas.height = ch * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cw, ch)

      const padSide = 16
      const padBottom = compact ? 16 : 36
      const scale = (cw - padSide * 2) / fpW
      const ox = padSide - minX * scale
      const oy = padSide - minY * scale

      const hits: HitArea[] = []

      // Rooms
      floorplanData.rooms.forEach((room: any) => {
        const rx = Math.min(...room.walls.map((w: any) => w.x1), ...room.walls.map((w: any) => w.x2))
        const ry = Math.min(...room.walls.map((w: any) => w.y1), ...room.walls.map((w: any) => w.y2))
        const rw = Math.max(...room.walls.map((w: any) => w.x1), ...room.walls.map((w: any) => w.x2)) - rx
        const rh = Math.max(...room.walls.map((w: any) => w.y1), ...room.walls.map((w: any) => w.y2)) - ry

        ctx.fillStyle = '#f8f9fb'
        ctx.fillRect(ox + rx * scale, oy + ry * scale, rw * scale, rh * scale)

        room.walls.forEach((w: any) => {
          ctx.beginPath()
          ctx.moveTo(ox + w.x1 * scale, oy + w.y1 * scale)
          ctx.lineTo(ox + w.x2 * scale, oy + w.y2 * scale)
          ctx.strokeStyle = '#1a1a2e'
          ctx.lineWidth = 2.5
          ctx.stroke()
        })

        if (room.windows) {
          room.windows.forEach((win: any) => {
            ctx.beginPath()
            ctx.moveTo(ox + win.x * scale, oy + (win.y || 0) * scale)
            ctx.lineTo(ox + (win.x + win.width) * scale, oy + (win.y || 0) * scale)
            ctx.strokeStyle = 'hsl(217, 91%, 60%)'
            ctx.lineWidth = 3
            ctx.globalAlpha = 0.4
            ctx.stroke()
            ctx.globalAlpha = 1
          })
        }

        ctx.fillStyle = '#8e99a4'
        const fs = compact ? 10 : 12
        ctx.font = `500 ${fs}px -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(room.name, ox + (rx + rw / 2) * scale, oy + (ry + rh / 2) * scale + 4)
      })

      // Furniture
      if (floorplanData.furniture) {
        floorplanData.furniture.forEach((f: any) => {
          const fx = ox + f.x * scale
          const fy = oy + f.y * scale
          const fw = f.width * scale
          const fh = f.height * scale
          ctx.strokeStyle = '#a0a8b4'
          ctx.lineWidth = 1
          ctx.strokeRect(fx, fy, fw, fh)
          ctx.fillStyle = '#a0a8b4'
          ctx.font = `400 ${compact ? 7 : 9}px -apple-system, sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(f.name, fx + fw / 2, fy + fh / 2 + 3)
        })
      }

      // Containers — priority: drawnContainerPos (from localStorage) → container props → CONTAINER_POS
      rooms.forEach(room => {
        room.containers?.forEach(container => {
          let pos: { x: number; y: number; w: number; h: number } | undefined
          // 1st: from container's own fields (unique per container)
          if (container.x != null && container.y != null && container.width != null && container.height != null) {
            pos = { x: container.x, y: container.y, w: container.width, h: container.height }
          }
          // 2nd: from drawn_floorplan container positions (name-based fallback)
          if (!pos) pos = drawnContainerPos[container.name]
          // 3rd: hardcoded fallback
          if (!pos) pos = CONTAINER_POS[container.name]
          if (!pos) return

          const cx = ox + pos.x * scale
          const cy = oy + pos.y * scale
          const cww = pos.w * scale
          const chh = pos.h * scale
          const isHL = highlightContainerId === container._id

          ctx.fillStyle = isHL ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.15)'
          ctx.fillRect(cx, cy, cww, chh)
          ctx.strokeStyle = isHL ? '#eab308' : 'rgba(239, 68, 68, 0.6)'
          ctx.lineWidth = isHL ? 2.5 : 1.5
          ctx.strokeRect(cx, cy, cww, chh)

          // X mark
          ctx.strokeStyle = isHL ? '#eab308' : 'rgba(239, 68, 68, 0.35)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cx + 3, cy + 3)
          ctx.lineTo(cx + cww - 3, cy + chh - 3)
          ctx.moveTo(cx + cww - 3, cy + 3)
          ctx.lineTo(cx + 3, cy + chh - 3)
          ctx.stroke()

          // Label
          ctx.fillStyle = isHL ? '#b45309' : 'hsl(0, 84%, 45%)'
          ctx.font = `600 ${compact ? 7 : 9}px -apple-system, sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(container.name, cx + cww / 2, cy - 4)

          hits.push({ roomId: room._id, containerId: container._id, x: cx, y: cy, w: cww, h: chh })
        })
      })

      // Dimension labels (centered)
      if (!compact) {
        ctx.fillStyle = '#8e99a4'
        ctx.font = '400 10px -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(fpW)}mm`, padSide + fpW * scale / 2, ch - 4)
        ctx.save()
        ctx.translate(8, padSide + fpH * scale / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(`${Math.round(fpH)}mm`, 0, 0)
        ctx.restore()
      }

      hitAreasRef.current = hits
    })
  }

  function handleTap(e: any) {
    if (!onContainerClick) return
    const touch = e.touches?.[0] || e.changedTouches?.[0]
    if (!touch) return
    const query = Taro.createSelectorQuery()
    query.select(`#${canvasId}`).boundingClientRect().exec((res) => {
      if (!res[0]) return
      const x = touch.clientX - res[0].left
      const y = touch.clientY - res[0].top
      for (const a of hitAreasRef.current) {
        if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
          onContainerClick(a.roomId, a.containerId)
          return
        }
      }
    })
  }

  if (!rooms || rooms.length === 0) {
    return <View className='floorplan-empty'><Text>暂无房间数据</Text></View>
  }

  return (
    <View className='floorplan-canvas-wrap'>
      <Canvas
        type='2d'
        id={canvasId}
        className='floorplan-canvas'
        style={`width:100%;height:${canvasHeight}px`}
        onTouchEnd={handleTap}
      />
    </View>
  )
}
