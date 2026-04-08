/**
 * 数据服务层 — 统一接口
 *
 * 自动根据环境选择后端：
 *   - 微信小程序 + 云开发已配置 → 使用云数据库
 *   - 其他情况（H5开发/云开发未配置）→ 使用localStorage模拟
 *
 * 所有函数签名保持不变，前端页面无需关心后端实现。
 */

import Taro from '@tarojs/taro'
import * as cloudService from './cloud'
import { normalizeItems } from './items'

// 检测是否在小程序环境且云开发可用
let cloudAvailable: boolean | null = null

function useCloud(): boolean {
  if (cloudAvailable === false) return false
  return process.env.TARO_ENV === 'weapp' && !!Taro.cloud
}

// 包装云调用，失败时自动fallback到localStorage并打日志
async function tryCloud<T>(cloudFn: () => Promise<T>, localFn: () => Promise<T>): Promise<T> {
  if (!useCloud()) return localFn()
  try {
    const result = await cloudFn()
    return result
  } catch (err: any) {
    console.warn('[Cloud Error] Falling back to localStorage:', err.message || err)
    return localFn()
  }
}

// ===============================
// localStorage 模拟实现（H5/开发用）
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
// 统一接口
// ===============================

export async function getSpaces() {
  return tryCloud(
    () => cloudService.cloudGetSpaces(),
    async () => {
      const data = getData()
      return data.spaces.map((s: any) => ({
        ...s,
        roomCount: s.rooms?.length || 0,
        containerCount: s.rooms?.reduce((sum: number, r: any) => sum + (r.containers?.length || 0), 0) || 0,
      }))
    }
  )
}

export async function getSpace(id: string) {
  return tryCloud(
    () => cloudService.cloudGetSpace(id),
    async () => {
      const data = getData()
      return data.spaces.find((s: any) => s._id === id) || null
    }
  )
}

export async function createSpace(name: string) {
  return tryCloud(
    () => cloudService.cloudCreateSpace(name),
    async () => {
      const data = getData()
      const space = { _id: generateId(), name, rooms: [], createdAt: new Date().toISOString() }
      data.spaces.push(space)
      saveData(data)
      return space
    }
  )
}

export async function deleteSpace(id: string) {
  if (useCloud()) return cloudService.cloudDeleteSpace(id)

  const data = getData()
  data.spaces = data.spaces.filter((s: any) => s._id !== id)
  saveData(data)
}

export async function addRoom(spaceId: string, name: string) {
  if (useCloud()) return cloudService.cloudAddRoom(spaceId, name)

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = { _id: generateId(), name, containers: [] }
  space.rooms.push(room)
  saveData(data)
  return room
}

export async function deleteRoom(spaceId: string, roomId: string) {
  if (useCloud()) return cloudService.cloudDeleteRoom(spaceId, roomId)

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  space.rooms = space.rooms.filter((r: any) => r._id !== roomId)
  saveData(data)
}

export async function addContainer(spaceId: string, roomId: string, container: any) {
  if (useCloud()) return cloudService.cloudAddContainer(spaceId, roomId, container)

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return null
  const newContainer = {
    _id: generateId(),
    ...container,
    slots: container.slots || [{ label: '第1层', type: 'shelf', items: '', photo: '' }],
    children: [],
    createdAt: new Date().toISOString(),
  }
  room.containers.push(newContainer)
  saveData(data)
  return newContainer
}

export async function updateContainer(spaceId: string, roomId: string, containerId: string, updates: any) {
  if (useCloud()) return cloudService.cloudUpdateContainer(spaceId, roomId, containerId, updates)

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return
  const idx = room.containers.findIndex((c: any) => c._id === containerId)
  if (idx >= 0) {
    room.containers[idx] = { ...room.containers[idx], ...updates }
    saveData(data)
  }
}

export async function deleteContainer(spaceId: string, roomId: string, containerId: string) {
  if (useCloud()) return cloudService.cloudDeleteContainer(spaceId, roomId, containerId)

  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return
  room.containers = room.containers.filter((c: any) => c._id !== containerId)
  saveData(data)
}

export async function searchItems(query: string) {
  if (useCloud()) return cloudService.cloudSearchItems(query)

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

// ===== Photo =====

export async function uploadPhoto(filePath: string, containerId: string, slotIndex: number): Promise<string> {
  if (useCloud()) {
    const ext = filePath.split('.').pop() || 'jpg'
    const cloudPath = `photos/${containerId}/${slotIndex}_${Date.now()}.${ext}`
    return cloudService.cloudUploadPhoto(filePath, cloudPath)
  }
  // H5模式直接使用本地路径
  return filePath
}

// ===== Share =====

export async function createShareLink(spaceId: string): Promise<string> {
  if (useCloud()) {
    const token = await cloudService.cloudCreateShare(spaceId)
    return token
  }
  // H5模式返回模拟token
  return 'mock_' + spaceId.slice(0, 8)
}

export async function resolveShareLink(token: string) {
  if (useCloud()) {
    return cloudService.cloudResolveShare(token)
  }
  // H5模式：从token中提取spaceId
  return { success: true, spaceId: token.replace('mock_', ''), permission: 'editor' }
}
