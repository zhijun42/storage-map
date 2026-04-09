/**
 * 微信云数据库操作封装
 *
 * 云数据库集合结构：
 *   spaces:     { _id, name, ownerId, createdAt }
 *   rooms:      { _id, spaceId, name, order, createdAt }
 *   containers: { _id, spaceId, roomId, parentId?, name, type, movable, photo, order, createdAt }
 *   slots:      { _id, containerId, label, type, items, photo, order }
 *   shares:     { _id, spaceId, token, createdBy, permission, createdAt }
 */

import Taro from '@tarojs/taro'
import { normalizeItems } from './items'

function getDb() {
  return Taro.cloud!.database()
}

function log(msg: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23)
  console.log(`[${ts}] [Cloud] ${msg}`, ...args)
}

// ===== Space API (via cloud function) =====

async function callSpaceApi(action: string, data: any = {}) {
  log(`callSpaceApi: ${action}`, data.spaceId || '')
  const res = await Taro.cloud!.callFunction({
    name: 'space-api',
    data: { action, ...data },
  }) as any
  if (!res.result?.success) {
    const err = res.result?.error || `space-api ${action} failed`
    log(`callSpaceApi ${action} FAILED:`, err)
    throw new Error(err)
  }
  log(`callSpaceApi ${action} OK`)
  return res.result
}

// ===== Space CRUD =====

export async function cloudGetSpaces() {
  log('getSpaces start')
  const result = await callSpaceApi('getSpaces')
  log('getSpaces got', result.spaces.length, 'spaces')
  return result.spaces
}

export async function cloudGetSpace(id: string) {
  log('getSpace start', id)
  const result = await callSpaceApi('getSpace', { spaceId: id })
  log('getSpace done')
  return result.space
}

export async function cloudCreateSpace(name: string) {
  log('createSpace', name)
  const db = getDb()
  const res = await db.collection('spaces').add({
    data: {
      name,
      createdAt: new Date(),
    },
  })
  log('createSpace done, id:', res._id)
  return { _id: res._id, name }
}

export async function cloudClearAll() {
  const db = getDb()
  log('clearAll start')
  const collections = ['slots', 'containers', 'rooms', 'spaces', 'floorplans']
  for (const col of collections) {
    try {
      const res = await db.collection(col).limit(100).get()
      for (const doc of res.data) {
        try { await db.collection(col).doc(doc._id).remove({} as any) } catch {}
      }
    } catch {}
  }
  log('clearAll done')
}

export async function cloudDeleteSpace(id: string) {
  const db = getDb()
  // 级联删除：slots → containers → rooms → space
  const containers = await db.collection('containers').where({ spaceId: id }).get()
  for (const c of containers.data) {
    await db.collection('slots').where({ containerId: c._id }).remove()
  }
  await db.collection('containers').where({ spaceId: id }).remove()
  await db.collection('rooms').where({ spaceId: id }).remove()
  await db.collection('spaces').doc(id).remove()
}

// ===== Room CRUD =====

export async function cloudAddRoom(spaceId: string, name: string) {
  const result = await callSpaceApi('addRoom', { spaceId, name })
  return result.room
}

export async function cloudDeleteRoom(spaceId: string, roomId: string) {
  await callSpaceApi('deleteRoom', { spaceId, roomId })
}

// ===== Container CRUD =====

export async function cloudAddContainer(spaceId: string, roomId: string, container: any) {
  const result = await callSpaceApi('addContainer', { spaceId, roomId, container })
  return result.container
}

export async function cloudUpdateContainer(spaceId: string, roomId: string, containerId: string, updates: any) {
  await callSpaceApi('updateContainer', { spaceId, roomId, containerId, updates })
}

export async function cloudDeleteContainer(spaceId: string, roomId: string, containerId: string) {
  await callSpaceApi('deleteContainer', { spaceId, roomId, containerId })
}

// ===== Search =====

export async function cloudSearchItems(query: string) {
  if (!query.trim()) return []
  const db = getDb()
  const q = query.toLowerCase()

  // 云数据库不支持LIKE搜索，所以获取所有slots然后前端过滤
  // 对于MVP阶段（数据量小）这是可行的
  const slotsRes = await db.collection('slots').limit(1000).get()
  const matchedSlots = slotsRes.data.filter((s: any) => {
    const items = normalizeItems(s.items)
    return items.some(i => i.name.toLowerCase().includes(q))
  })

  if (matchedSlots.length === 0) return []

  // 获取对应的container和room信息
  const containerIds = [...new Set(matchedSlots.map((s: any) => s.containerId))]
  let containers: any[] = []
  for (let i = 0; i < containerIds.length; i += 20) {
    const batch = containerIds.slice(i, i + 20)
    const res = await db.collection('containers').where({ _id: db.command.in(batch) }).get()
    containers = containers.concat(res.data)
  }

  const roomIds = [...new Set(containers.map((c: any) => c.roomId))]
  let rooms: any[] = []
  for (let i = 0; i < roomIds.length; i += 20) {
    const batch = roomIds.slice(i, i + 20)
    const res = await db.collection('rooms').where({ _id: db.command.in(batch) }).get()
    rooms = rooms.concat(res.data)
  }

  const spaceIds = [...new Set(containers.map((c: any) => c.spaceId))]
  let spaces: any[] = []
  for (let i = 0; i < spaceIds.length; i += 20) {
    const batch = spaceIds.slice(i, i + 20)
    const res = await db.collection('spaces').where({ _id: db.command.in(batch) }).get()
    spaces = spaces.concat(res.data)
  }

  return matchedSlots.map((slot: any) => {
    const container = containers.find((c: any) => c._id === slot.containerId)
    const room = rooms.find((r: any) => r._id === container?.roomId)
    const space = spaces.find((s: any) => s._id === container?.spaceId)
    const items = normalizeItems(slot.items)
    const matchedNames = items.filter(i => i.name.toLowerCase().includes(q)).map(i => i.name)
    return {
      spaceId: space?._id || '',
      roomId: room?._id || '',
      containerId: container?._id || '',
      spaceName: space?.name || '',
      roomName: room?.name || '',
      containerName: container?.name || '',
      slotLabel: slot.label,
      items: matchedNames.join('、'),
    }
  })
}

// ===== Floorplan Sync =====

export async function cloudSaveFloorplan(spaceId: string, floorplanJson: string, rectsJson: string, rectMapJson: string) {
  log('saveFloorplan start', spaceId)
  await callSpaceApi('saveFloorplan', { spaceId, floorplan: floorplanJson, rects: rectsJson, rectMap: rectMapJson })
  log('saveFloorplan done')
}

export async function cloudLoadFloorplan(spaceId: string): Promise<{ floorplan: string; rects: string; rectMap: string } | null> {
  log('loadFloorplan start', spaceId)
  const result = await callSpaceApi('loadFloorplan', { spaceId })
  if (result.floorplan) {
    log('loadFloorplan found')
    return { floorplan: result.floorplan, rects: result.rects, rectMap: result.rectMap }
  }
  log('loadFloorplan empty')
  return null
}

// ===== Photo Upload =====

export async function cloudUploadPhoto(filePath: string, cloudPath: string): Promise<string> {
  const res = await Taro.cloud!.uploadFile({
    cloudPath,
    filePath,
  })
  return res.fileID
}

// ===== Share =====

export async function cloudCreateShare(spaceId: string): Promise<string> {
  const res = await Taro.cloud!.callFunction({
    name: 'share',
    data: { action: 'create', spaceId },
  }) as any
  return res.result.token
}

export async function cloudResolveShare(token: string) {
  const res = await Taro.cloud!.callFunction({
    name: 'share',
    data: { action: 'resolve', shareToken: token },
  }) as any
  return res.result
}

export async function cloudRevokeShare(spaceId: string) {
  const res = await Taro.cloud!.callFunction({
    name: 'share',
    data: { action: 'revoke', spaceId },
  }) as any
  return res.result
}

export async function cloudGetShareStatus(spaceId: string) {
  const res = await Taro.cloud!.callFunction({
    name: 'share',
    data: { action: 'status', spaceId },
  }) as any
  return res.result
}
