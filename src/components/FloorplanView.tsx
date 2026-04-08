import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import floorplanData from '../data/floorplan.json'
import './FloorplanView.scss'

interface Container {
  _id: string
  name: string
  slots?: any[]
}

interface Room {
  _id: string
  name: string
  containers?: Container[]
}

interface FloorplanViewProps {
  rooms: Room[]
  compact?: boolean
  highlightContainerId?: string | null
  onContainerClick?: (roomId: string, containerId: string) => void
}

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

const FP_W = 7200
const FP_H = 7700

export default function FloorplanView({ rooms, compact, highlightContainerId, onContainerClick }: FloorplanViewProps) {
  const hitAreasRef = useRef<HitArea[]>([])
  const canvasId = compact ? 'fp-compact' : 'fp-full'
  const [canvasHeight, setCanvasHeight] = useState(compact ? 300 : 420)

  useEffect(() => {
    if (rooms.length > 0) setTimeout(() => draw(), 200)
  }, [rooms, highlightContainerId])

  function draw() {
    const query = Taro.createSelectorQuery()
    query.select(`#${canvasId}`).fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = 2
      const cw = res[0].width
      const ch = cw * (FP_H / FP_W)

      // Update CSS height to match
      setCanvasHeight(ch)

      canvas.width = cw * dpr
      canvas.height = ch * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cw, ch)

      const pad = 16
      const scale = (cw - pad * 2) / FP_W
      const ox = pad
      const oy = pad

      const hits: HitArea[] = []

      // Rooms
      floorplanData.rooms.forEach(room => {
        const rx = Math.min(...room.walls.map(w => w.x1), ...room.walls.map(w => w.x2))
        const ry = Math.min(...room.walls.map(w => w.y1), ...room.walls.map(w => w.y2))
        const rw = Math.max(...room.walls.map(w => w.x1), ...room.walls.map(w => w.x2)) - rx
        const rh = Math.max(...room.walls.map(w => w.y1), ...room.walls.map(w => w.y2)) - ry

        ctx.fillStyle = '#f8f9fb'
        ctx.fillRect(ox + rx * scale, oy + ry * scale, rw * scale, rh * scale)

        room.walls.forEach(w => {
          ctx.beginPath()
          ctx.moveTo(ox + w.x1 * scale, oy + w.y1 * scale)
          ctx.lineTo(ox + w.x2 * scale, oy + w.y2 * scale)
          ctx.strokeStyle = '#1a1a2e'
          ctx.lineWidth = 2.5
          ctx.stroke()
        })

        room.windows.forEach(win => {
          ctx.beginPath()
          ctx.moveTo(ox + win.x * scale, oy + win.y * scale)
          ctx.lineTo(ox + (win.x + win.width) * scale, oy + win.y * scale)
          ctx.strokeStyle = 'hsl(217, 91%, 60%)'
          ctx.lineWidth = 3
          ctx.globalAlpha = 0.4
          ctx.stroke()
          ctx.globalAlpha = 1
        })

        ctx.fillStyle = '#8e99a4'
        const fs = compact ? 10 : 12
        ctx.font = `500 ${fs}px -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(room.name, ox + (rx + rw / 2) * scale, oy + (ry + rh / 2) * scale + 4)
      })

      // Furniture
      floorplanData.furniture.forEach(f => {
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

      // Containers
      rooms.forEach(room => {
        room.containers?.forEach(container => {
          const pos = CONTAINER_POS[container.name]
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

      // Dimension labels
      if (!compact) {
        ctx.fillStyle = '#8e99a4'
        ctx.font = '400 10px -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${FP_W}mm`, ox + FP_W * scale / 2, ch - 4)
        ctx.save()
        ctx.translate(8, oy + FP_H * scale / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(`${FP_H}mm`, 0, 0)
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
