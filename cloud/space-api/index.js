/**
 * space-api: Central cloud function for all space data operations.
 *
 * All reads and writes go through this function so that:
 * 1. Shared spaces are accessible to authorized users (not just the creator)
 * 2. Permission is checked via the shares collection
 *
 * Permission model:
 *   owner  = space._openid matches caller
 *   editor = shares record exists with claimedBy matching caller
 *   none   = rejected
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function checkPermission(openId, spaceId) {
  const space = await db.collection('spaces').doc(spaceId).get().catch(() => null)
  if (!space?.data) return null

  if (space.data._openid === openId) return 'owner'

  const share = await db.collection('shares')
    .where({ spaceId, claimedBy: openId })
    .limit(1).get()
  if (share.data.length > 0) return share.data[0].permission || 'editor'

  return null
}

// ===== Handlers =====

async function handleGetSpace(openId, { spaceId }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限访问该空间' }

  const [spaceRes, roomsRes, containersRes] = await Promise.all([
    db.collection('spaces').doc(spaceId).get(),
    db.collection('rooms').where({ spaceId }).orderBy('order', 'asc').get(),
    db.collection('containers').where({ spaceId }).orderBy('order', 'asc').get(),
  ])

  let allSlots = []
  const containerIds = containersRes.data.map(c => c._id)
  if (containerIds.length > 0) {
    const batches = []
    for (let i = 0; i < containerIds.length; i += 20) {
      batches.push(
        db.collection('slots')
          .where({ containerId: _.in(containerIds.slice(i, i + 20)) })
          .orderBy('order', 'asc').get()
      )
    }
    const results = await Promise.all(batches)
    allSlots = results.flatMap(r => r.data)
  }

  const rooms = roomsRes.data.map(room => ({
    ...room,
    containers: containersRes.data
      .filter(c => c.roomId === room._id && !c.parentId)
      .map(container => ({
        ...container,
        slots: allSlots.filter(s => s.containerId === container._id),
        children: containersRes.data
          .filter(c => c.parentId === container._id)
          .map(child => ({
            ...child,
            slots: allSlots.filter(s => s.containerId === child._id),
          })),
      })),
  }))

  return { success: true, space: { ...spaceRes.data, rooms } }
}

async function handleGetSpaces(openId) {
  // Get spaces owned by user
  const ownedRes = await db.collection('spaces')
    .where({ _openid: openId })
    .orderBy('createdAt', 'desc').get()

  // Get spaces shared with user
  const sharesRes = await db.collection('shares')
    .where({ claimedBy: openId }).get()
  const sharedSpaceIds = sharesRes.data.map(s => s.spaceId)

  let sharedSpaces = []
  if (sharedSpaceIds.length > 0) {
    const res = await db.collection('spaces')
      .where({ _id: _.in(sharedSpaceIds) }).get()
    sharedSpaces = res.data
  }

  // Merge and deduplicate
  const allSpaces = [...ownedRes.data]
  for (const s of sharedSpaces) {
    if (!allSpaces.some(o => o._id === s._id)) allSpaces.push(s)
  }

  // Get room/container counts
  const spaceIds = allSpaces.map(s => s._id)
  let allRooms = [], allContainers = []
  if (spaceIds.length > 0) {
    const [roomsRes, containersRes] = await Promise.all([
      db.collection('rooms').where({ spaceId: _.in(spaceIds.slice(0, 20)) }).get(),
      db.collection('containers').where({ spaceId: _.in(spaceIds.slice(0, 20)) }).get(),
    ])
    allRooms = roomsRes.data
    allContainers = containersRes.data
  }

  return {
    success: true,
    spaces: allSpaces.map(s => ({
      ...s,
      roomCount: allRooms.filter(r => r.spaceId === s._id).length,
      containerCount: allContainers.filter(c => c.spaceId === s._id).length,
    })),
  }
}

async function handleAddRoom(openId, { spaceId, name }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限' }

  const count = await db.collection('rooms').where({ spaceId }).count()
  const res = await db.collection('rooms').add({
    data: { spaceId, name, order: count.total, createdAt: new Date() },
  })
  return { success: true, room: { _id: res._id, name, containers: [] } }
}

async function handleDeleteRoom(openId, { spaceId, roomId }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限' }

  const containers = await db.collection('containers').where({ roomId }).get()
  for (const c of containers.data) {
    await db.collection('slots').where({ containerId: c._id }).remove()
  }
  await db.collection('containers').where({ roomId }).remove()
  await db.collection('rooms').doc(roomId).remove()
  return { success: true }
}

async function handleAddContainer(openId, { spaceId, roomId, container }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限' }

  const count = await db.collection('containers').where({ roomId }).count()
  const containerData = {
    spaceId, roomId,
    parentId: container.parentId || null,
    name: container.name,
    type: container.type || 'custom',
    movable: container.movable || false,
    photo: container.photo || '',
    order: count.total,
    createdAt: new Date(),
  }
  if (container.x != null) containerData.x = container.x
  if (container.y != null) containerData.y = container.y
  if (container.width != null) containerData.width = container.width
  if (container.height != null) containerData.height = container.height
  if (container.elevationAspect != null) containerData.elevationAspect = container.elevationAspect

  const res = await db.collection('containers').add({ data: containerData })
  const containerId = res._id

  const slots = container.slots || [{ label: '第1层', type: 'shelf', items: '', photo: '' }]
  for (let i = 0; i < slots.length; i++) {
    const slotData = {
      containerId,
      label: slots[i].label,
      type: slots[i].type || 'shelf',
      items: slots[i].items || '',
      photo: slots[i].photo || '',
      order: i,
    }
    if (slots[i].categories) slotData.categories = slots[i].categories
    if (slots[i].rx != null) {
      slotData.rx = slots[i].rx; slotData.ry = slots[i].ry
      slotData.rw = slots[i].rw; slotData.rh = slots[i].rh
    }
    await db.collection('slots').add({ data: slotData })
  }

  return { success: true, container: { _id: containerId, ...container } }
}

async function handleUpdateContainer(openId, { spaceId, roomId, containerId, updates }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限' }

  if (updates.slots) {
    await db.collection('slots').where({ containerId }).remove()
    for (let i = 0; i < updates.slots.length; i++) {
      const slotData = {
        containerId,
        label: updates.slots[i].label,
        type: updates.slots[i].type || 'shelf',
        items: updates.slots[i].items || '',
        photo: updates.slots[i].photo || '',
        order: i,
      }
      if (updates.slots[i].categories) slotData.categories = updates.slots[i].categories
      if (updates.slots[i].rx != null) {
        slotData.rx = updates.slots[i].rx; slotData.ry = updates.slots[i].ry
        slotData.rw = updates.slots[i].rw; slotData.rh = updates.slots[i].rh
      }
      await db.collection('slots').add({ data: slotData })
    }
    const { slots, ...rest } = updates
    if (Object.keys(rest).length > 0) {
      await db.collection('containers').doc(containerId).update({ data: rest })
    }
  } else {
    await db.collection('containers').doc(containerId).update({ data: updates })
  }

  return { success: true }
}

async function handleDeleteContainer(openId, { spaceId, roomId, containerId }) {
  const perm = await checkPermission(openId, spaceId)
  if (!perm) return { success: false, error: '无权限' }

  const children = await db.collection('containers').where({ parentId: containerId }).get()
  for (const child of children.data) {
    await db.collection('slots').where({ containerId: child._id }).remove()
  }
  await db.collection('containers').where({ parentId: containerId }).remove()
  await db.collection('slots').where({ containerId }).remove()
  await db.collection('containers').doc(containerId).remove()
  return { success: true }
}

// ===== Entry point =====

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || ''
  if (!openId) return { success: false, error: '未登录' }

  const { action } = event

  try {
    switch (action) {
      case 'getSpaces':       return await handleGetSpaces(openId)
      case 'getSpace':        return await handleGetSpace(openId, event)
      case 'addRoom':         return await handleAddRoom(openId, event)
      case 'deleteRoom':      return await handleDeleteRoom(openId, event)
      case 'addContainer':    return await handleAddContainer(openId, event)
      case 'updateContainer': return await handleUpdateContainer(openId, event)
      case 'deleteContainer': return await handleDeleteContainer(openId, event)
      default: return { success: false, error: `Unknown action: ${action}` }
    }
  } catch (err) {
    console.error(`[space-api] ${action} error:`, err)
    return { success: false, error: err.message || '操作失败' }
  }
}
