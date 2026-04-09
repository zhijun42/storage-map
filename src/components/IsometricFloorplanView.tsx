import { View, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef } from 'react'
import { initThreeAdapter, disposeThreeAdapter } from '../utils/three-adapter'
import './IsometricFloorplanView.scss'

interface Container {
  _id: string
  name: string
  slots?: any[]
  x?: number; y?: number; width?: number; height?: number
  elevationAspect?: number
  facing?: string
}

interface Room {
  _id: string
  name: string
  containers?: Container[]
}

interface Props {
  rooms: Room[]
  spaceId?: string
  highlightContainerId?: string | null
  onContainerClick?: (roomId: string, containerId: string) => void
}

const FURNITURE_HEIGHTS: Record<string, number> = {
  '双人床': 500, '单人床': 500,
  '沙发': 400, '餐桌': 750,
  '书桌': 750, '茶几': 350,
  '电视': 100,
}
const DEFAULT_FURNITURE_H = 600
const ROOM_WALL_H = 2800
const CABINET_H = 2200
const MM_TO_M = 0.001
const POLAR_ANGLE = Math.PI / 4 // 45 degrees from top

function getFloorplanData(spaceId?: string): any {
  if (!spaceId) return null
  try {
    const saved = Taro.getStorageSync(`drawn_floorplan_${spaceId}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed?.rooms?.length > 0) return parsed
    }
  } catch {}
  return null
}

export default function IsometricFloorplanView({ rooms, spaceId, highlightContainerId, onContainerClick }: Props) {
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const controlsRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const canvasNodeRef = useRef<any>(null)
  const containerMeshesRef = useRef<any[]>([])
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const mountedRef = useRef(true)

  const sysInfo = Taro.getSystemInfoSync()
  const canvasH = Math.round(sysInfo.windowWidth * 0.85)

  useEffect(() => {
    mountedRef.current = true
    const timer = setTimeout(() => initScene(), 300)
    return () => {
      mountedRef.current = false
      clearTimeout(timer)
      cleanup()
    }
  }, [])

  useEffect(() => {
    updateHighlight()
  }, [highlightContainerId])

  function cleanup() {
    mountedRef.current = false
    if (rafRef.current && canvasNodeRef.current) {
      try { canvasNodeRef.current.cancelAnimationFrame(rafRef.current) } catch {}
    }
    controlsRef.current = null
    // Don't dispose renderer/adapter — the canvas stays in DOM (hidden)
    // Just stop the animation loop via mountedRef
  }

  function initScene() {
    const query = Taro.createSelectorQuery()
    query.select('#webgl-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res?.[0]?.node) return

      const canvas = res[0].node
      const cw = res[0].width
      const ch = res[0].height
      canvasNodeRef.current = canvas

      const dpr = Math.min(sysInfo.pixelRatio || 2, 2)
      canvas.width = cw * dpr
      canvas.height = ch * dpr

      initThreeAdapter(canvas, cw, ch)

      const THREE = require('three-platformize')
      const { OrbitControls } = require('three-platformize/examples/jsm/controls/OrbitControls')

      // Renderer
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
      renderer.setSize(cw, ch)
      renderer.setPixelRatio(dpr)
      renderer.setClearColor(0xf2f3f5, 1)
      rendererRef.current = renderer

      // Scene
      const scene = new THREE.Scene()
      sceneRef.current = scene

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      scene.add(ambient)
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
      dirLight.position.set(5, 10, 7)
      scene.add(dirLight)

      // Build scene from floorplan data
      const bbox = buildScene(THREE, scene)

      // Camera — fit entire scene in view
      const cx = (bbox.minX + bbox.maxX) / 2
      const cz = (bbox.minZ + bbox.maxZ) / 2
      const spanX = bbox.maxX - bbox.minX
      const spanZ = bbox.maxZ - bbox.minZ
      const span = Math.max(spanX, spanZ, 2)
      const targetY = ROOM_WALL_H * MM_TO_M * 0.3

      // Calculate distance to fit the scene at 45° polar angle
      const fov = 35
      const camera = new THREE.PerspectiveCamera(fov, cw / ch, 0.1, 500)
      const halfFovRad = (fov / 2) * Math.PI / 180
      const fitDist = (span * 0.75) / Math.tan(halfFovRad)

      // Position camera at 45° elevation, looking at center
      const camY = targetY + fitDist * Math.sin(POLAR_ANGLE)
      const camHDist = fitDist * Math.cos(POLAR_ANGLE)
      camera.position.set(cx + camHDist * 0.707, camY, cz + camHDist * 0.707)
      camera.lookAt(cx, targetY, cz)
      cameraRef.current = camera

      // OrbitControls — only horizontal rotation, no zoom, fixed polar angle
      const controls = new OrbitControls(camera, canvas)
      controls.target.set(cx, targetY, cz)
      controls.enableDamping = true
      controls.dampingFactor = 0.1
      controls.autoRotate = false
      controls.enableZoom = false
      controls.enablePan = false
      controls.minPolarAngle = POLAR_ANGLE
      controls.maxPolarAngle = POLAR_ANGLE
      controls.update()
      controlsRef.current = controls

      // Render loop
      function animate() {
        if (!mountedRef.current) return
        rafRef.current = canvas.requestAnimationFrame(animate)
        if (controlsRef.current) controlsRef.current.update()
        if (rendererRef.current && cameraRef.current) {
          rendererRef.current.render(scene, camera)
        }
      }
      animate()
    })
  }

  function buildScene(THREE: any, scene: any) {
    const floorplan = getFloorplanData(spaceId)
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity

    if (!floorplan) return { minX: 0, minZ: 0, maxX: 5, maxZ: 5 }

    // Build container data map from rooms prop
    const containerDataMap: Record<string, { container: Container; roomId: string }> = {}
    rooms.forEach(room => {
      room.containers?.forEach(c => {
        containerDataMap[c._id] = { container: c, roomId: room._id }
      })
    })

    // Rooms — collect wall segments and merge overlapping ones
    const wallT = 0.05
    const rawWalls: { isH: boolean; fixedCoord: number; rangeStart: number; rangeEnd: number }[] = []

    floorplan.rooms.forEach((room: any) => {
      const xs = room.walls.map((w: any) => Math.min(w.x1, w.x2))
      const ys = room.walls.map((w: any) => Math.min(w.y1, w.y2))
      const rx = Math.min(...xs) * MM_TO_M
      const rz = Math.min(...ys) * MM_TO_M
      const rw = (Math.max(...room.walls.map((w: any) => Math.max(w.x1, w.x2))) - Math.min(...xs)) * MM_TO_M
      const rd = (Math.max(...room.walls.map((w: any) => Math.max(w.y1, w.y2))) - Math.min(...ys)) * MM_TO_M

      minX = Math.min(minX, rx); minZ = Math.min(minZ, rz)
      maxX = Math.max(maxX, rx + rw); maxZ = Math.max(maxZ, rz + rd)

      rawWalls.push(
        { isH: true, fixedCoord: rz, rangeStart: rx - wallT / 2, rangeEnd: rx + rw + wallT / 2 },
        { isH: true, fixedCoord: rz + rd, rangeStart: rx - wallT / 2, rangeEnd: rx + rw + wallT / 2 },
        { isH: false, fixedCoord: rx, rangeStart: rz, rangeEnd: rz + rd },
        { isH: false, fixedCoord: rx + rw, rangeStart: rz, rangeEnd: rz + rd },
      )
    })

    // Group walls by (orientation, fixedCoord) and merge overlapping intervals
    const wallGroups = new Map<string, { isH: boolean; fixedCoord: number; intervals: [number, number][] }>()
    rawWalls.forEach(w => {
      const key = `${w.isH ? 'H' : 'V'}_${w.fixedCoord.toFixed(3)}`
      if (!wallGroups.has(key)) wallGroups.set(key, { isH: w.isH, fixedCoord: w.fixedCoord, intervals: [] })
      wallGroups.get(key)!.intervals.push([w.rangeStart, w.rangeEnd])
    })

    const wallSegments: { px: number; pz: number; sx: number; sz: number }[] = []
    wallGroups.forEach(group => {
      const sorted = group.intervals.sort((a, b) => a[0] - b[0])
      const merged: [number, number][] = [[sorted[0][0], sorted[0][1]]]
      for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1]
        if (sorted[i][0] <= last[1] + 0.01) {
          last[1] = Math.max(last[1], sorted[i][1])
        } else {
          merged.push([sorted[i][0], sorted[i][1]])
        }
      }
      merged.forEach(([start, end]) => {
        const len = end - start
        const center = (start + end) / 2
        if (group.isH) {
          wallSegments.push({ px: center, pz: group.fixedCoord, sx: len, sz: wallT })
        } else {
          wallSegments.push({ px: group.fixedCoord, pz: center, sx: wallT, sz: len })
        }
      })
    })

    // Collect all doors/windows from floorplan data
    const allDoorWindows: { x: number; y: number; width: number; direction?: string; type: string }[] = []
    floorplan.rooms.forEach((room: any) => {
      ;(room.doors || []).forEach((d: any) => allDoorWindows.push({ ...d, type: 'door' }))
      ;(room.windows || []).forEach((w: any) => allDoorWindows.push({ ...w, type: 'window' }))
    })

    // Render deduplicated walls with door/window gaps
    const wallH = ROOM_WALL_H * MM_TO_M
    const DOOR_H = 2.1 // meters
    const WIN_BOTTOM = 1.0; const WIN_H = 1.0
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd0, transparent: true, opacity: 0.25 })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8a9099 })
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.25 })

    function addWallBox(px: number, py: number, pz: number, sx: number, sy: number, sz: number, showEdges = false) {
      const geo = new THREE.BoxGeometry(sx, sy, sz)
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(px, py, pz)
      scene.add(mesh)
      if (showEdges) {
        const edges = new THREE.EdgesGeometry(geo)
        const line = new THREE.LineSegments(edges, edgeMat)
        line.position.copy(mesh.position)
        scene.add(line)
      }
    }

    wallSegments.forEach(w => {
      const isH = w.sz < w.sx
      const wallFixedCoord = isH ? w.pz : w.px
      const wallRangeStart = isH ? w.px - w.sx / 2 : w.pz - w.sz / 2
      const wallRangeEnd = isH ? w.px + w.sx / 2 : w.pz + w.sz / 2
      const gaps = allDoorWindows.filter(dw => {
        const dwFixedCoord = dw.y * MM_TO_M
        const dwAlongStart = dw.x * MM_TO_M
        // Check fixed coordinate matches AND along-wall position falls within wall range
        return Math.abs(dwFixedCoord - wallFixedCoord) < 0.15 &&
               dwAlongStart >= wallRangeStart - 0.1 && dwAlongStart <= wallRangeEnd + 0.1
      }).map(dw => ({
        start: dw.x * MM_TO_M,
        end: (dw.x + dw.width) * MM_TO_M,
        type: dw.type,
      })).sort((a, b) => a.start - b.start)

      if (gaps.length === 0) {
        addWallBox(w.px, wallH / 2, w.pz, w.sx, wallH, w.sz, true)
      } else {
        // Split wall at all door/window positions
        const rangeStart = isH ? w.px - w.sx / 2 : w.pz - w.sz / 2
        const rangeEnd = isH ? w.px + w.sx / 2 : w.pz + w.sz / 2
        let cursor = rangeStart

        for (const gap of gaps) {
          // Full-height wall before gap
          if (gap.start > cursor + 0.01) {
            const segLen = gap.start - cursor
            if (isH) addWallBox(cursor + segLen / 2, wallH / 2, w.pz, segLen, wallH, wallT)
            else addWallBox(w.px, wallH / 2, cursor + segLen / 2, wallT, wallH, segLen)
          }

          const gapLen = gap.end - gap.start

          if (gap.type === 'door') {
            // Door: opening from floor to DOOR_H, lintel above
            const lintelH = wallH - DOOR_H
            if (lintelH > 0.01) {
              if (isH) addWallBox(gap.start + gapLen / 2, DOOR_H + lintelH / 2, w.pz, gapLen, lintelH, wallT)
              else addWallBox(w.px, DOOR_H + lintelH / 2, gap.start + gapLen / 2, wallT, lintelH, gapLen)
            }
          } else {
            // Window: wall below, glass panel, wall above
            if (WIN_BOTTOM > 0.01) {
              if (isH) addWallBox(gap.start + gapLen / 2, WIN_BOTTOM / 2, w.pz, gapLen, WIN_BOTTOM, wallT)
              else addWallBox(w.px, WIN_BOTTOM / 2, gap.start + gapLen / 2, wallT, WIN_BOTTOM, gapLen)
            }
            const aboveH = wallH - (WIN_BOTTOM + WIN_H)
            if (aboveH > 0.01) {
              const aboveY = WIN_BOTTOM + WIN_H + aboveH / 2
              if (isH) addWallBox(gap.start + gapLen / 2, aboveY, w.pz, gapLen, aboveH, wallT)
              else addWallBox(w.px, aboveY, gap.start + gapLen / 2, wallT, aboveH, gapLen)
            }
            const glassGeo = new THREE.BoxGeometry(
              isH ? gapLen : 0.01, WIN_H, isH ? 0.01 : gapLen
            )
            const glass = new THREE.Mesh(glassGeo, glassMat)
            if (isH) glass.position.set(gap.start + gapLen / 2, WIN_BOTTOM + WIN_H / 2, w.pz)
            else glass.position.set(w.px, WIN_BOTTOM + WIN_H / 2, gap.start + gapLen / 2)
            scene.add(glass)
          }

          cursor = gap.end
        }

        // Wall segment after last gap
        if (cursor < rangeEnd - 0.01) {
          const segLen = rangeEnd - cursor
          if (isH) addWallBox(cursor + segLen / 2, wallH / 2, w.pz, segLen, wallH, wallT)
          else addWallBox(w.px, wallH / 2, cursor + segLen / 2, wallT, wallH, segLen)
        }
      }
    })

    // Furniture (skip doors/windows — they are handled via wall gaps)
    if (floorplan.furniture) {
      floorplan.furniture.forEach((f: any) => {
        if (f.name === '门' || f.name === '窗') return
        const fx = f.x * MM_TO_M
        const fz = f.y * MM_TO_M
        const fw = f.width * MM_TO_M
        const fd = f.height * MM_TO_M
        const fh = (FURNITURE_HEIGHTS[f.name] || DEFAULT_FURNITURE_H) * MM_TO_M

        const geo = new THREE.BoxGeometry(fw, fh, fd)
        const mat = new THREE.MeshLambertMaterial({ color: 0xb8bcc0 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(fx + fw / 2, fh / 2, fz + fd / 2)
        scene.add(mesh)
      })
    }

    // Containers (cabinets) — with internal slot subdivisions
    rooms.forEach(room => {
      room.containers?.forEach(container => {
        if (container.x == null || container.y == null || container.width == null || container.height == null) return

        const cx = container.x * MM_TO_M
        const cz = container.y * MM_TO_M
        const cw = container.width * MM_TO_M
        const cd = container.height * MM_TO_M
        // Height from elevation design: width * aspect ratio, fallback to default
        const aspect = container.elevationAspect || 1.2
        const ch = container.elevationAspect ? container.width * aspect * MM_TO_M : CABINET_H * MM_TO_M

        const isHL = highlightContainerId === container._id
        const cabinetColor = isHL ? 0xeab308 : 0xef4444
        const cabinetOpacity = isHL ? 0.5 : 0.3
        const edgeColor = isHL ? 0xb45309 : 0xcc3333

        // Outer cabinet wireframe
        const outerGeo = new THREE.BoxGeometry(cw, ch, cd)
        const outerMat = new THREE.MeshLambertMaterial({ color: cabinetColor, transparent: true, opacity: cabinetOpacity })
        const outerMesh = new THREE.Mesh(outerGeo, outerMat)
        outerMesh.position.set(cx + cw / 2, ch / 2, cz + cd / 2)
        outerMesh.userData = { roomId: room._id, containerId: container._id }
        scene.add(outerMesh)
        containerMeshesRef.current.push(outerMesh)

        const outerEdges = new THREE.EdgesGeometry(outerGeo)
        const outerLine = new THREE.LineSegments(outerEdges, new THREE.LineBasicMaterial({ color: edgeColor }))
        outerLine.position.copy(outerMesh.position)
        outerLine.userData = { roomId: room._id, containerId: container._id }
        scene.add(outerLine)
        containerMeshesRef.current.push(outerLine)

        // Internal slot shelves (from elevation data), oriented by facing direction
        const slots = container.slots || []
        const hasFlexible = slots.some((s: any) => s.rx != null && s.ry != null)
        const facing = container.facing || 'bottom'

        if (hasFlexible && slots.length > 0) {
          const shelfMat = new THREE.MeshLambertMaterial({ color: edgeColor, transparent: true, opacity: 0.15 })
          const shelfEdgeMat = new THREE.LineBasicMaterial({ color: edgeColor })
          const dividerT = 0.01

          // facing determines which 3D face shows slot outlines
          // 'bottom' = +Z face, 'top' = -Z face, 'right' = +X face, 'left' = -X face
          // rx maps to the cabinet's "width" axis (along the facing wall)
          // For top/bottom facing: width axis = X, depth axis = Z
          // For left/right facing: width axis = Z, depth axis = X

          slots.forEach((slot: any) => {
            if (slot.rx == null) return
            const sy = (1 - slot.ry - slot.rh) * ch

            if (facing === 'bottom' || facing === 'top') {
              const sx = slot.rx * cw
              const sw = slot.rw * cw
              const sh = slot.rh * ch
              // Shelf
              const shelfGeo = new THREE.BoxGeometry(sw, dividerT, cd * 0.95)
              const shelf = new THREE.Mesh(shelfGeo, shelfMat)
              shelf.position.set(cx + sx + sw / 2, sy, cz + cd / 2)
              scene.add(shelf)
              // Front face outline
              const faceZ = facing === 'bottom' ? cz + cd + 0.005 : cz - 0.005
              const slotGeo = new THREE.BoxGeometry(sw - 0.005, sh - 0.005, dividerT)
              const slotMesh = new THREE.Mesh(slotGeo, shelfMat)
              slotMesh.position.set(cx + sx + sw / 2, sy + sh / 2, faceZ)
              scene.add(slotMesh)
              const slotEdges = new THREE.EdgesGeometry(slotGeo)
              scene.add(new THREE.LineSegments(slotEdges, shelfEdgeMat).translateX(slotMesh.position.x).translateY(slotMesh.position.y).translateZ(slotMesh.position.z))
            } else {
              // left/right: width maps to Z axis
              const sz = slot.rx * cd
              const sDepth = slot.rw * cd
              const sh = slot.rh * ch
              // Shelf
              const shelfGeo = new THREE.BoxGeometry(cw * 0.95, dividerT, sDepth)
              const shelf = new THREE.Mesh(shelfGeo, shelfMat)
              shelf.position.set(cx + cw / 2, sy, cz + sz + sDepth / 2)
              scene.add(shelf)
              // Side face outline
              const faceX = facing === 'right' ? cx + cw + 0.005 : cx - 0.005
              const slotGeo = new THREE.BoxGeometry(dividerT, sh - 0.005, sDepth - 0.005)
              const slotMesh = new THREE.Mesh(slotGeo, shelfMat)
              slotMesh.position.set(faceX, sy + sh / 2, cz + sz + sDepth / 2)
              scene.add(slotMesh)
              const slotEdges = new THREE.EdgesGeometry(slotGeo)
              scene.add(new THREE.LineSegments(slotEdges, shelfEdgeMat).translateX(slotMesh.position.x).translateY(slotMesh.position.y).translateZ(slotMesh.position.z))
            }
          })
        }
      })
    })

    // Ground plane
    const padGround = 0.5
    const gw = (maxX - minX) + padGround * 2
    const gd = (maxZ - minZ) + padGround * 2
    const groundGeo = new THREE.PlaneGeometry(gw, gd)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xeaecef })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set((minX + maxX) / 2, -0.01, (minZ + maxZ) / 2)
    scene.add(ground)

    return { minX, minZ, maxX, maxZ }
  }

  function updateHighlight() {
    const THREE = require('three-platformize')
    containerMeshesRef.current.forEach(mesh => {
      const cid = mesh.userData?.containerId
      if (!cid) return
      const isHL = highlightContainerId === cid

      if (mesh.isMesh && mesh.material) {
        mesh.material.color = new THREE.Color(isHL ? 0xeab308 : 0xef4444)
        mesh.material.opacity = isHL ? 0.5 : 0.3
      } else if (mesh.isLineSegments && mesh.material) {
        mesh.material.color = new THREE.Color(isHL ? 0xb45309 : 0xcc3333)
      }
    })
  }

  function toPointerEvent(type: string, touch: any, canvasRect: any) {
    return {
      type,
      pointerId: touch.identifier || 0,
      pointerType: 'touch',
      clientX: touch.clientX - (canvasRect?.left || 0),
      clientY: touch.clientY - (canvasRect?.top || 0),
      pageX: touch.clientX - (canvasRect?.left || 0),
      pageY: touch.clientY - (canvasRect?.top || 0),
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      preventDefault() {},
      stopPropagation() {},
    }
  }

  const canvasRectRef = useRef<any>(null)

  function handleTouchStart(e: any) {
    const t = e.touches?.[0]
    if (!t) return
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }

    // Get canvas rect for coordinate mapping
    Taro.createSelectorQuery().select('#webgl-canvas').boundingClientRect().exec((res) => {
      if (res?.[0]) canvasRectRef.current = res[0]
    })

    const canvas = canvasNodeRef.current
    if (canvas?.dispatchEvent) {
      canvas.dispatchEvent(toPointerEvent('pointerdown', t, canvasRectRef.current))
    }
  }

  function handleTouchMove(e: any) {
    const t = e.touches?.[0]
    if (!t) return
    const canvas = canvasNodeRef.current
    if (canvas?.dispatchEvent) {
      canvas.dispatchEvent(toPointerEvent('pointermove', t, canvasRectRef.current))
    }
  }

  function handleTouchEnd(e: any) {
    const te = e.changedTouches?.[0]
    if (!te) return
    const canvas = canvasNodeRef.current
    if (canvas?.dispatchEvent) {
      canvas.dispatchEvent(toPointerEvent('pointerup', te, canvasRectRef.current))
    }

    // Detect tap
    const ts = touchStartRef.current
    if (!ts) return
    const dist = Math.hypot(te.clientX - ts.x, te.clientY - ts.y)
    const dur = Date.now() - ts.time
    touchStartRef.current = null

    if (dist > 10 || dur > 300) return
    handleTap(te.clientX, te.clientY)
  }

  function handleTap(clientX: number, clientY: number) {
    const camera = cameraRef.current
    const scene = sceneRef.current
    if (!camera || !scene) return

    const query = Taro.createSelectorQuery()
    query.select('#webgl-canvas').boundingClientRect().exec((res) => {
      if (!res?.[0]) return
      const rect = res[0]
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -((clientY - rect.top) / rect.height) * 2 + 1

      const THREE = require('three-platformize')
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

      const meshes = containerMeshesRef.current.filter(m => m.isMesh)
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const { roomId, containerId } = hits[0].object.userData
        if (roomId && containerId && onContainerClick) {
          onContainerClick(roomId, containerId)
        }
      }
    })
  }

  return (
    <View className='iso-floorplan-wrap'>
      <Canvas
        type='webgl'
        id='webgl-canvas'
        className='iso-canvas'
        style={`width:100%;height:${canvasH}px`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </View>
  )
}
