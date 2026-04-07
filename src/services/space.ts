import Taro from '@tarojs/taro'

// 数据暂时使用本地存储（Mock模式）
// TODO: 比赛时替换为微信云数据库

const STORAGE_KEY = 'storage_map_data'

function getData(): any {
  const raw = Taro.getStorageSync(STORAGE_KEY)
  return raw ? JSON.parse(raw) : { spaces: [] }
}

function saveData(data: any) {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(data))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ===== Space CRUD =====

export async function getSpaces() {
  const data = getData()
  return data.spaces
}

export async function getSpace(id: string) {
  const data = getData()
  return data.spaces.find((s: any) => s._id === id) || null
}

export async function createSpace(name: string) {
  const data = getData()
  const space = {
    _id: generateId(),
    name,
    rooms: [],
    createdAt: new Date().toISOString(),
  }
  data.spaces.push(space)
  saveData(data)
  return space
}

export async function deleteSpace(id: string) {
  const data = getData()
  data.spaces = data.spaces.filter((s: any) => s._id !== id)
  saveData(data)
}

// ===== Room CRUD =====

export async function addRoom(spaceId: string, name: string) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = { _id: generateId(), name, containers: [] }
  space.rooms.push(room)
  saveData(data)
  return room
}

export async function deleteRoom(spaceId: string, roomId: string) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return
  space.rooms = space.rooms.filter((r: any) => r._id !== roomId)
  saveData(data)
}

// ===== Container CRUD =====

export async function addContainer(spaceId: string, roomId: string, container: any) {
  const data = getData()
  const space = data.spaces.find((s: any) => s._id === spaceId)
  if (!space) return null
  const room = space.rooms.find((r: any) => r._id === roomId)
  if (!room) return null
  const newContainer = {
    _id: generateId(),
    ...container,
    slots: container.slots || [],
    children: [],
    createdAt: new Date().toISOString(),
  }
  room.containers.push(newContainer)
  saveData(data)
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
}

// ===== Search =====

export async function searchItems(query: string) {
  if (!query.trim()) return []
  const data = getData()
  const results: any[] = []
  const q = query.toLowerCase()

  data.spaces.forEach((space: any) => {
    space.rooms?.forEach((room: any) => {
      room.containers?.forEach((container: any) => {
        container.slots?.forEach((slot: any) => {
          if (slot.items && slot.items.toLowerCase().includes(q)) {
            results.push({
              spaceName: space.name,
              roomName: room.name,
              containerName: container.name,
              slotLabel: slot.label,
              items: slot.items,
              photo: slot.photo,
            })
          }
        })
        // search in children too
        container.children?.forEach((child: any) => {
          child.slots?.forEach((slot: any) => {
            if (slot.items && slot.items.toLowerCase().includes(q)) {
              results.push({
                spaceName: space.name,
                roomName: room.name,
                containerName: `${container.name} > ${child.name}`,
                slotLabel: slot.label,
                items: slot.items,
                photo: slot.photo,
              })
            }
          })
        })
      })
    })
  })

  return results
}
