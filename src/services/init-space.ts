/**
 * Initialize example space: creates floorplan + rooms + containers + slots + items.
 * For developer onboarding — one click to get a fully populated demo environment.
 */
import Taro from '@tarojs/taro'
import { createSpace, deleteSpace, getSpace, getSpaces, addRoom, deleteRoom, addContainer, updateContainer } from './space'
import { serializeItems, Item } from './items'

const FLOOR_PX_TO_MM = 30

// Example floorplan rectangles (in world pixels, same as draw-editor)
const EXAMPLE_ROOMS = [
  { name: '主卧', x: 40, y: 10, w: 130, h: 110 },
  { name: '卫生间', x: 10, y: 30, w: 50, h: 70 },
  { name: '客厅', x: 60, y: 120, w: 110, h: 80 },
  { name: '厨房', x: 10, y: 120, w: 50, h: 80 },
  { name: '次卧', x: 170, y: 120, w: 80, h: 80 },
]

const EXAMPLE_FURNITURE = [
  { name: '双人床', room: '主卧', x: 60, y: 30, w: 50, h: 40 },
  { name: '沙发', room: '客厅', x: 70, y: 145, w: 40, h: 25 },
  { name: '餐桌', room: '厨房', x: 20, y: 150, w: 25, h: 20 },
  { name: '单人床', room: '次卧', x: 185, y: 140, w: 35, h: 45 },
]

const EXAMPLE_CABINETS = [
  {
    name: '衣柜', room: '主卧', x: 42, y: 12, w: 55, h: 15,
    slots: [
      { label: '衣物', type: 'shelf', categories: ['衣物'], rx: 0, ry: 0, rw: 0.6, rh: 0.5 },
      { label: '鞋包', type: 'drawer', categories: ['鞋包'], rx: 0.6, ry: 0, rw: 0.4, rh: 0.5 },
      { label: '杂物', type: 'drawer', categories: ['杂物'], rx: 0, ry: 0.5, rw: 1, rh: 0.5 },
    ],
    elevationAspect: 0.8,
    items: {
      '衣物': [
        { name: '羽绒服', category: '衣物', price: '899' },
        { name: '风衣', category: '衣物', price: '650' },
        { name: '连衣裙', category: '衣物', price: '320' },
      ],
      '鞋包': [
        { name: '运动鞋', category: '鞋包', price: '699' },
        { name: '手提包', category: '鞋包', price: '1200' },
      ],
      '杂物': [
        { name: '充电宝', category: '数码', price: '129' },
        { name: '蓝牙耳机', category: '数码', price: '299' },
      ],
    },
  },
  {
    name: '书架', room: '次卧', x: 218, y: 122, w: 12, h: 50,
    slots: [
      { label: '书籍', type: 'shelf', categories: ['书籍'], rx: 0, ry: 0, rw: 1, rh: 0.5 },
      { label: '收藏', type: 'shelf', categories: ['收藏'], rx: 0, ry: 0.5, rw: 1, rh: 0.5 },
    ],
    elevationAspect: 1.5,
    items: {
      '书籍': [
        { name: '三体', category: '书籍', price: '68' },
        { name: '人类简史', category: '书籍', price: '55' },
        { name: 'JavaScript高级编程', category: '书籍', price: '98' },
      ],
      '收藏': [
        { name: '手办', category: '收藏', price: '350' },
      ],
    },
  },
  {
    name: '鞋柜', room: '客厅', x: 162, y: 122, w: 15, h: 15,
    slots: [
      { label: '鞋包', type: 'shelf', categories: ['鞋包'], rx: 0, ry: 0, rw: 1, rh: 0.5 },
      { label: '日用品', type: 'drawer', categories: ['日用品'], rx: 0, ry: 0.5, rw: 1, rh: 0.5 },
    ],
    elevationAspect: 1,
    items: {
      '鞋包': [
        { name: '皮鞋', category: '鞋包', price: '580' },
        { name: '拖鞋', category: '鞋包', price: '49' },
      ],
      '日用品': [
        { name: '雨伞', category: '日用品', price: '35' },
      ],
    },
  },
]

const today = new Date().toISOString().slice(0, 10)

function toMm(px: number) { return Math.round(px * FLOOR_PX_TO_MM) }

function makeItem(i: { name: string; category: string; price: string }): Item {
  return { name: i.name, category: i.category, price: i.price, createdAt: today, photo: '', notes: '' }
}

export async function initExampleSpace(targetSpaceId?: string) {
  let spaceId: string

  if (targetSpaceId) {
    // Fill the given space — clear its existing rooms first
    const space = await getSpace(targetSpaceId)
    if (!space) return { rooms: 0, cabinets: 0, items: 0 }
    for (const room of (space.rooms || [])) {
      await deleteRoom(targetSpaceId, room._id)
    }
    spaceId = targetSpaceId
  } else {
    // Legacy: create a new demo space
    const existing = await getSpaces()
    const demoSpace = existing.find((s: any) => s.name === '示例之家')
    if (demoSpace) await deleteSpace(demoSpace._id)
    const space = await createSpace('示例之家')
    spaceId = space._id
  }

  const roomIdMap: Record<string, string> = {}
  for (const r of EXAMPLE_ROOMS) {
    const room = await addRoom(spaceId, r.name)
    if (room) roomIdMap[r.name] = room._id
  }

  // Create containers with items
  const rectContainerMap: Record<string, any> = {}
  for (let ci = 0; ci < EXAMPLE_CABINETS.length; ci++) {
    const cab = EXAMPLE_CABINETS[ci]
    const roomId = roomIdMap[cab.room]
    if (!roomId) continue

    const slots = cab.slots.map(s => {
      const slotItems = (cab.items as any)[s.label] || []
      return {
        label: s.label,
        type: s.type,
        categories: s.categories,
        rx: s.rx, ry: s.ry, rw: s.rw, rh: s.rh,
        items: serializeItems(slotItems.map(makeItem)),
        photo: '',
      }
    })

    const created = await addContainer(spaceId, roomId, {
      name: cab.name,
      type: 'custom',
      movable: false,
      photo: '',
      elevationAspect: cab.elevationAspect,
      x: toMm(cab.x), y: toMm(cab.y), width: toMm(cab.w), height: toMm(cab.h),
      slots,
    })

    if (created) {
      const rectId = `example_cab_${ci}`
      rectContainerMap[rectId] = { containerId: created._id, spaceId, roomId }
    }
  }

  // Save drawn_floorplan for FloorplanView
  const floorplan = {
    unit: 'mm', scale: 0.05,
    rooms: EXAMPLE_ROOMS.map(r => ({
      id: `room_${r.name}`,
      name: r.name,
      walls: [
        { x1: toMm(r.x), y1: toMm(r.y), x2: toMm(r.x + r.w), y2: toMm(r.y) },
        { x1: toMm(r.x + r.w), y1: toMm(r.y), x2: toMm(r.x + r.w), y2: toMm(r.y + r.h) },
        { x1: toMm(r.x + r.w), y1: toMm(r.y + r.h), x2: toMm(r.x), y2: toMm(r.y + r.h) },
        { x1: toMm(r.x), y1: toMm(r.y + r.h), x2: toMm(r.x), y2: toMm(r.y) },
      ],
      doors: [], windows: [], offset: { x: 0, y: 0 },
    })),
    furniture: EXAMPLE_FURNITURE.map(f => ({
      id: `furn_${f.name}`, name: f.name, room: f.room,
      x: toMm(f.x), y: toMm(f.y), width: toMm(f.w), height: toMm(f.h),
    })),
    containers: EXAMPLE_CABINETS.map(c => ({
      name: c.name, x: toMm(c.x), y: toMm(c.y), width: toMm(c.w), height: toMm(c.h),
    })),
  }

  Taro.setStorageSync(`drawn_floorplan_${spaceId}`, JSON.stringify(floorplan))
  Taro.setStorageSync(`rect_container_map_${spaceId}`, JSON.stringify(rectContainerMap))

  const drawRects: any[] = []
  EXAMPLE_ROOMS.forEach((r, i) => {
    drawRects.push({ id: `room_${i}`, x: r.x, y: r.y, w: r.w, h: r.h, labels: [r.name], slotType: 'open', phase: 'room' })
  })
  EXAMPLE_FURNITURE.forEach((f, i) => {
    drawRects.push({ id: `furn_${i}`, x: f.x, y: f.y, w: f.w, h: f.h, labels: [f.name], slotType: 'open', phase: 'furniture' })
  })
  EXAMPLE_CABINETS.forEach((c, i) => {
    drawRects.push({ id: `example_cab_${i}`, x: c.x, y: c.y, w: c.w, h: c.h, labels: [c.name], slotType: 'open', phase: 'cabinet' })
  })
  Taro.setStorageSync(`draw_all_rects_${spaceId}`, JSON.stringify(drawRects))

  const totalItems = EXAMPLE_CABINETS.reduce((sum, cab) =>
    sum + Object.values(cab.items).reduce((s: number, arr: any) => s + arr.length, 0), 0)

  return { rooms: EXAMPLE_ROOMS.length, cabinets: EXAMPLE_CABINETS.length, items: totalItems }
}
