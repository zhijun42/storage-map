/**
 * 数据服务层 — 本地优先 + 异步云同步
 *
 * 所有读写操作先在 localStorage 完成（即时响应），
 * 写操作同时异步推送到云数据库（后台同步，不阻塞 UI）。
 * 应用启动时如果本地无数据，从云端拉取。
 */

import Taro from '@tarojs/taro'
import * as cloudService from './cloud'
import { normalizeItems, serializeItems } from './items'

function useCloud(): boolean {
  return process.env.TARO_ENV === 'weapp' && !!Taro.cloud
}

// 异步云同步（fire and forget）
function syncToCloud(tag: string, fn: () => Promise<any>) {
  if (!useCloud()) return
  fn().catch(err => console.warn(`[Sync] ${tag} failed:`, err.message || err))
}

// ===============================
// localStorage 存储
// ===============================

const STORAGE_KEY = 'storage_map_data'

function getData(): any {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { spaces: [] }
  } catch {
    return { spaces: [] }
  }
}

function saveData(data: any) {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(data))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ===============================
// 启动时云端 → 本地同步
// ===============================

export async function pullFromCloudIfEmpty() {
  if (!useCloud()) return
  const local = getData()
  if (local.spaces.length > 0) return

  console.log('[Sync] Local empty, pulling from cloud...')
  try {
    // Pull space data
    const spaces = await cloudService.cloudGetSpaces()
    if (spaces.length > 0) {
      const fullSpaces: any[] = []
      for (const s of spaces) {
        const full = await cloudService.cloudGetSpace(s._id)
        if (full) fullSpaces.push(full)
      }
      if (fullSpaces.length > 0) {
        saveData({ spaces: fullSpaces })
        console.log(`[Sync] Pulled ${fullSpaces.length} spaces from cloud`)
      }
    }

    // Pull floorplan visual data
    const fp = await cloudService.cloudLoadFloorplan()
    if (fp) {
      if (fp.floorplan) Taro.setStorageSync('drawn_floorplan', fp.floorplan)
      if (fp.rects) Taro.setStorageSync('draw_all_rects', fp.rects)
      if (fp.rectMap) Taro.setStorageSync('rect_container_map', fp.rectMap)
      console.log('[Sync] Pulled floorplan data from cloud')
    }
  } catch (err: any) {
    console.warn('[Sync] Pull failed:', err.message || err)
  }
}

// ===============================
// 统一接口 — 本地优先
// ===============================

export async function getSpaces() {
  const data = getData()
  return data.spaces.map((s: any) => ({
    ...s,
    roomCount: s.rooms?.length || 0,
    containerCount: s.rooms?.reduce((sum: number, r: any) => sum + (r.containers?.length || 0), 0) || 0,
  }))
}

export async function getSpace(id: string) {
  const data = getData()
  return data.spaces.find((s: any) => s._id === id) || null
}

export async function createSpace(name: string) {
  const data = getData()
  const space = { _id: generateId(), name, rooms: [], createdAt: new Date().toISOString() }
  data.spaces.push(space)
  saveData(data)

  syncToCloud('createSpace', () => cloudService.cloudCreateSpace(name))

  return space
}

export async function deleteSpace(id: string) {
  const data = getData()
  data.spaces = data.spaces.filter((s: any) => s._id !== id)
  saveData(data)

  syncToCloud('deleteSpace', () => cloudService.cloudDeleteSpace(id))
}

export async function addRoom(spaceId: string, name: string) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = { _id: generateId(), name, containers: [] }
  space.rooms.push(room)
  saveData(data)

  syncToCloud('addRoom', () => cloudService.cloudAddRoom(spaceId, name))

  return room
}

export async function deleteRoom(spaceId: string, roomId: string) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  space.rooms = space.rooms.filter((r: any) => r._id !== roomId)
  saveData(data)

  syncToCloud('deleteRoom', () => cloudService.cloudDeleteRoom(spaceId, roomId))
}

export async function addContainer(spaceId: string, roomId: string, container: any) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return null

  // Auto-deduplicate name within the same room
  let name = container.name || '容器'
  const existingNames = new Set((room.containers || []).map((c: any) => c.name))
  if (existingNames.has(name)) {
    let i = 2
    while (existingNames.has(`${name}${i}`)) i++
    name = `${name}${i}`
  }

  const newContainer = {
    _id: generateId(),
    ...container,
    name,
    slots: container.slots || [{ label: '第1层', type: 'shelf', items: '', photo: '' }],
    children: [],
    createdAt: new Date().toISOString(),
  }
  room.containers.push(newContainer)
  saveData(data)

  syncToCloud('addContainer', () => cloudService.cloudAddContainer(spaceId, roomId, container))

  return newContainer
}

export async function updateContainer(spaceId: string, roomId: string, containerId: string, updates: any) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return
  const idx = room.containers.findIndex((c: any) => c._id === containerId)
  if (idx >= 0) {
    room.containers[idx] = { ...room.containers[idx], ...updates }
    saveData(data)

    syncToCloud('updateContainer', () => cloudService.cloudUpdateContainer(spaceId, roomId, containerId, updates))
  }
}

export async function deleteContainer(spaceId: string, roomId: string, containerId: string) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return
  room.containers = room.containers.filter((c: any) => c._id !== containerId)
  saveData(data)

  syncToCloud('deleteContainer', () => cloudService.cloudDeleteContainer(spaceId, roomId, containerId))
}

export async function searchItems(query: string) {
  if (!query.trim()) return []
  const data = getData()
  const results: any[] = []
  const q = query.toLowerCase()

  data.spaces.forEach((space: any) => {
    space.rooms?.forEach((room: any) => {
      room.containers?.forEach((container: any) => {
        container.slots?.forEach((slot: any) => {
          const items = normalizeItems(slot.items)
          const matchedItems = items.filter(i => i.name.toLowerCase().includes(q))
          if (matchedItems.length > 0) {
            results.push({
              spaceId: space._id,
              roomId: room._id,
              containerId: container._id,
              spaceName: space.name,
              roomName: room.name,
              containerName: container.name,
              slotLabel: slot.label,
              items: matchedItems.map(i => i.name).join('、'),
            })
          }
        })
      })
    })
  })

  return results
}

// ===== Move Item =====

export async function moveItem(
  spaceId: string,
  fromRoomId: string, fromContainerId: string, fromSlotIndex: number, itemIndex: number,
  toRoomId: string, toContainerId: string, toSlotIndex: number,
) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return false

  const fromRoom = space.rooms.find((r: any) => r._id === fromRoomId)
  const toRoom = space.rooms.find((r: any) => r._id === toRoomId)
  if (!fromRoom || !toRoom) return false

  const fromContainer = fromRoom.containers.find((c: any) => c._id === fromContainerId)
  const toContainer = toRoom.containers.find((c: any) => c._id === toContainerId)
  if (!fromContainer || !toContainer) return false

  const fromSlot = fromContainer.slots?.[fromSlotIndex]
  const toSlot = toContainer.slots?.[toSlotIndex]
  if (!fromSlot || !toSlot) return false

  const fromItems = normalizeItems(fromSlot.items)
  if (itemIndex < 0 || itemIndex >= fromItems.length) return false

  const [movedItem] = fromItems.splice(itemIndex, 1)
  fromSlot.items = serializeItems(fromItems)

  const toItems = normalizeItems(toSlot.items)
  toItems.push(movedItem)
  toSlot.items = serializeItems(toItems)

  saveData(data)

  syncToCloud('moveItem:updateFrom', () =>
    cloudService.cloudUpdateContainer(spaceId, fromRoomId, fromContainerId, { slots: fromContainer.slots }))
  if (fromContainerId !== toContainerId) {
    syncToCloud('moveItem:updateTo', () =>
      cloudService.cloudUpdateContainer(spaceId, toRoomId, toContainerId, { slots: toContainer.slots }))
  }

  return true
}

export async function moveItems(
  spaceId: string,
  fromRoomId: string, fromContainerId: string, fromSlotIndex: number, itemIndexes: number[],
  toRoomId: string, toContainerId: string, toSlotIndex: number,
) {
  if (itemIndexes.length === 0) return false

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return false

  const fromRoom = space.rooms.find((r: any) => r._id === fromRoomId)
  const toRoom = space.rooms.find((r: any) => r._id === toRoomId)
  if (!fromRoom || !toRoom) return false

  const fromContainer = fromRoom.containers.find((c: any) => c._id === fromContainerId)
  const toContainer = toRoom.containers.find((c: any) => c._id === toContainerId)
  if (!fromContainer || !toContainer) return false

  const fromSlot = fromContainer.slots?.[fromSlotIndex]
  const toSlot = toContainer.slots?.[toSlotIndex]
  if (!fromSlot || !toSlot) return false

  const fromItems = normalizeItems(fromSlot.items)
  const sorted = [...itemIndexes].sort((a, b) => b - a)
  if (sorted.some(i => i < 0 || i >= fromItems.length)) return false

  const movedItems = sorted.map(i => fromItems.splice(i, 1)[0])
  movedItems.reverse()

  fromSlot.items = serializeItems(fromItems)

  const toItems = normalizeItems(toSlot.items)
  toItems.push(...movedItems)
  toSlot.items = serializeItems(toItems)

  saveData(data)

  syncToCloud('moveItems:updateFrom', () =>
    cloudService.cloudUpdateContainer(spaceId, fromRoomId, fromContainerId, { slots: fromContainer.slots }))
  if (fromContainerId !== toContainerId) {
    syncToCloud('moveItems:updateTo', () =>
      cloudService.cloudUpdateContainer(spaceId, toRoomId, toContainerId, { slots: toContainer.slots }))
  }

  return true
}

// ===== Photo =====

export async function uploadPhoto(filePath: string, containerId: string, slotIndex: number): Promise<string> {
  if (useCloud()) {
    const ext = filePath.split('.').pop() || 'jpg'
    const cloudPath = `photos/${containerId}/${slotIndex}_${Date.now()}.${ext}`
    return cloudService.cloudUploadPhoto(filePath, cloudPath)
  }
  return filePath
}

// ===== Share =====

export async function createShareLink(spaceId: string): Promise<string> {
  if (useCloud()) {
    const token = await cloudService.cloudCreateShare(spaceId)
    return token
  }
  return 'mock_' + spaceId.slice(0, 8)
}

export async function resolveShareLink(token: string) {
  if (useCloud()) {
    return cloudService.cloudResolveShare(token)
  }
  return { success: true, spaceId: token.replace('mock_', ''), permission: 'editor' }
}
