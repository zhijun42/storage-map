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

function getDb() {
  return Taro.cloud!.database()
}

function log(msg: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23)
  console.log(`[${ts}] [Cloud] ${msg}`, ...args)
}

// ===== Space CRUD =====

export async function cloudGetSpaces() {
  log('getSpaces start')
  const db = getDb()
  const res = await db.collection('spaces').orderBy('createdAt', 'desc').get()
  log('getSpaces got', res.data.length, 'spaces')
  // 简化：MVP阶段不附加count（减少查询次数避免timeout）
  return res.data.map((s: any) => ({ ...s, roomCount: 0, containerCount: 0 }))
}

export async function cloudGetSpace(id: string) {
  log('getSpace start', id)
  const db = getDb()

  // 并行查询spaces+rooms+containers（减少串行等待）
  const [spaceRes, roomsRes, containersRes] = await Promise.all([
    db.collection('spaces').doc(id).get(),
    db.collection('rooms').where({ spaceId: id }).orderBy('order', 'asc').get(),
    db.collection('containers').where({ spaceId: id }).orderBy('order', 'asc').get(),
  ])
  log('getSpace parallel queries done. rooms:', roomsRes.data.length, 'containers:', containersRes.data.length)

  const space = spaceRes.data

  // 查询slots（只在有containers时）
  let allSlots: any[] = []
  const containerIds = containersRes.data.map((c: any) => c._id)
  if (containerIds.length > 0) {
    const slotsRes = await db.collection('slots')
      .where({ containerId: db.command.in(containerIds.slice(0, 20)) })
      .orderBy('order', 'asc')
      .get()
    allSlots = slotsRes.data
    log('getSpace got', allSlots.length, 'slots')
  }

  // 组装嵌套结构
  const rooms = roomsRes.data.map((room: any) => {
    const roomContainers = containersRes.data
      .filter((c: any) => c.roomId === room._id && !c.parentId)
      .map((container: any) => ({
        ...container,
        slots: allSlots.filter((s: any) => s.containerId === container._id),
        children: containersRes.data
          .filter((c: any) => c.parentId === container._id)
          .map((child: any) => ({
            ...child,
            slots: allSlots.filter((s: any) => s.containerId === child._id),
          })),
      }))
    return { ...room, containers: roomContainers }
  })

  log('getSpace done')
  return { ...space, rooms }
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
  const db = getDb()
  const count = await db.collection('rooms').where({ spaceId }).count()
  const res = await db.collection('rooms').add({
    data: {
      spaceId,
      name,
      order: count.total,
      createdAt: new Date(),
    },
  })
  return { _id: res._id, name, containers: [] }
}

export async function cloudDeleteRoom(spaceId: string, roomId: string) {
  const db = getDb()
  // 级联删除containers和slots
  const containers = await db.collection('containers').where({ roomId }).get()
  for (const c of containers.data) {
    await db.collection('slots').where({ containerId: c._id }).remove()
  }
  await db.collection('containers').where({ roomId }).remove()
  await db.collection('rooms').doc(roomId).remove()
}

// ===== Container CRUD =====

export async function cloudAddContainer(spaceId: string, roomId: string, container: any) {
  const db = getDb()
  const count = await db.collection('containers').where({ roomId }).count()

  const res = await db.collection('containers').add({
    data: {
      spaceId,
      roomId,
      parentId: container.parentId || null,
      name: container.name,
      type: container.type || 'custom',
      movable: container.movable || false,
      photo: container.photo || '',
      order: count.total,
      createdAt: new Date(),
    },
  })

  const containerId = res._id

  // 创建默认slots
  const slots = container.slots || [{ label: '第1层', type: 'shelf', items: '', photo: '' }]
  for (let i = 0; i < slots.length; i++) {
    await db.collection('slots').add({
      data: {
        containerId,
        label: slots[i].label,
        type: slots[i].type || 'shelf',
        items: slots[i].items || '',
        photo: slots[i].photo || '',
        order: i,
      },
    })
  }

  return { _id: containerId, ...container }
}

export async function cloudUpdateContainer(spaceId: string, roomId: string, containerId: string, updates: any) {
  const db = getDb()

  // 如果更新了slots，需要删除旧的并创建新的
  if (updates.slots) {
    await db.collection('slots').where({ containerId }).remove()
    for (let i = 0; i < updates.slots.length; i++) {
      await db.collection('slots').add({
        data: {
          containerId,
          label: updates.slots[i].label,
          type: updates.slots[i].type || 'shelf',
          items: updates.slots[i].items || '',
          photo: updates.slots[i].photo || '',
          order: i,
        },
      })
    }
    // 从updates中移除slots，剩余字段更新container本身
    const { slots, ...containerUpdates } = updates
    if (Object.keys(containerUpdates).length > 0) {
      await db.collection('containers').doc(containerId).update({ data: containerUpdates })
    }
  } else {
    await db.collection('containers').doc(containerId).update({ data: updates })
  }
}

export async function cloudDeleteContainer(spaceId: string, roomId: string, containerId: string) {
  const db = getDb()
  // 删除子容器和它们的slots
  const children = await db.collection('containers').where({ parentId: containerId }).get()
  for (const child of children.data) {
    await db.collection('slots').where({ containerId: child._id }).remove()
  }
  await db.collection('containers').where({ parentId: containerId }).remove()
  // 删除自身的slots和container
  await db.collection('slots').where({ containerId }).remove()
  await db.collection('containers').doc(containerId).remove()
}

// ===== Search =====

export async function cloudSearchItems(query: string) {
  if (!query.trim()) return []
  const db = getDb()
  const q = query.toLowerCase()

  // 云数据库不支持LIKE搜索，所以获取所有slots然后前端过滤
  // 对于MVP阶段（数据量小）这是可行的
  const slotsRes = await db.collection('slots').limit(1000).get()
  const matchedSlots = slotsRes.data.filter((s: any) =>
    s.items && s.items.toLowerCase().includes(q)
  )

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
    return {
      spaceName: space?.name || '',
      roomName: room?.name || '',
      containerName: container?.name || '',
      slotLabel: slot.label,
      items: slot.items,
      photo: slot.photo,
    }
  })
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
