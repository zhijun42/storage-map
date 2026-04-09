import { __resetStorage } from './__mocks__/taro'

// Must import after mock is set up
import {
  getSpaces, getSpace, createSpace, deleteSpace,
  addRoom, deleteRoom,
  addContainer, updateContainer, deleteContainer,
  searchItems,
} from '../services/space'

beforeEach(() => {
  __resetStorage()
})

describe('Space CRUD', () => {
  it('starts with no spaces', async () => {
    const spaces = await getSpaces()
    expect(spaces).toEqual([])
  })

  it('creates a space', async () => {
    const space = await createSpace('我的家')
    expect(space.name).toBe('我的家')
    expect(space._id).toBeTruthy()
    expect(space.rooms).toEqual([])

    const spaces = await getSpaces()
    expect(spaces).toHaveLength(1)
    expect(spaces[0].name).toBe('我的家')
  })

  it('deletes a space', async () => {
    const space = await createSpace('测试')
    await deleteSpace(space._id)
    const spaces = await getSpaces()
    expect(spaces).toHaveLength(0)
  })

  it('gets a space by id', async () => {
    const space = await createSpace('我的家')
    const found = await getSpace(space._id)
    expect(found).toBeTruthy()
    expect(found.name).toBe('我的家')
  })

  it('returns null for non-existent space', async () => {
    const found = await getSpace('non-existent')
    expect(found).toBeNull()
  })
})

describe('Room CRUD', () => {
  let spaceId: string

  beforeEach(async () => {
    const space = await createSpace('我的家')
    spaceId = space._id
  })

  it('adds a room', async () => {
    const room = await addRoom(spaceId, '主卧')
    expect(room).toBeTruthy()
    expect(room!.name).toBe('主卧')

    const space = await getSpace(spaceId)
    expect(space.rooms).toHaveLength(1)
    expect(space.rooms[0].name).toBe('主卧')
  })

  it('adds multiple rooms', async () => {
    await addRoom(spaceId, '主卧')
    await addRoom(spaceId, '客厅')
    await addRoom(spaceId, '厨房')

    const space = await getSpace(spaceId)
    expect(space.rooms).toHaveLength(3)
  })

  it('deletes a room', async () => {
    const room = await addRoom(spaceId, '主卧')
    await deleteRoom(spaceId, room!._id)

    const space = await getSpace(spaceId)
    expect(space.rooms).toHaveLength(0)
  })

  it('returns null when adding to non-existent space', async () => {
    const room = await addRoom('fake-id', '主卧')
    expect(room).toBeNull()
  })
})

describe('Container CRUD', () => {
  let spaceId: string
  let roomId: string

  beforeEach(async () => {
    const space = await createSpace('我的家')
    spaceId = space._id
    const room = await addRoom(spaceId, '主卧')
    roomId = room!._id
  })

  it('adds a container with default slot', async () => {
    const container = await addContainer(spaceId, roomId, { name: '衣柜', type: 'wardrobe' })
    expect(container).toBeTruthy()
    expect(container!.name).toBe('衣柜')
    expect(container!.slots).toHaveLength(1)
    expect(container!.slots[0].label).toBe('第1层')
  })

  it('adds a container with custom slots', async () => {
    const container = await addContainer(spaceId, roomId, {
      name: '床头柜',
      type: 'custom',
      slots: [
        { label: '鞋包', type: 'shelf', items: [], photo: '', rx: 0, ry: 0, rw: 0.6, rh: 0.5, categories: ['鞋包'] },
        { label: '书籍', type: 'drawer', items: [], photo: '', rx: 0.6, ry: 0, rw: 0.4, rh: 0.5, categories: ['书籍'] },
      ],
      x: 100, y: 200, width: 500, height: 400,
      elevationAspect: 0.8,
    })
    expect(container!.slots).toHaveLength(2)
    expect(container!.slots[0].rx).toBe(0)
    expect(container!.slots[1].categories).toEqual(['书籍'])
    expect(container!.x).toBe(100)
    expect(container!.elevationAspect).toBe(0.8)
  })

  it('updates a container', async () => {
    const container = await addContainer(spaceId, roomId, { name: '衣柜' })
    await updateContainer(spaceId, roomId, container!._id, { name: '大衣柜' })

    const space = await getSpace(spaceId)
    expect(space.rooms[0].containers[0].name).toBe('大衣柜')
  })

  it('updates container slots with items', async () => {
    const container = await addContainer(spaceId, roomId, { name: '衣柜' })
    const newSlots = [
      { label: '第1层', type: 'shelf', items: [{ name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-09', photo: '', notes: '' }], photo: '' },
    ]
    await updateContainer(spaceId, roomId, container!._id, { slots: newSlots })

    const space = await getSpace(spaceId)
    const items = space.rooms[0].containers[0].slots[0].items
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('羽绒服')
  })

  it('deletes a container', async () => {
    const container = await addContainer(spaceId, roomId, { name: '衣柜' })
    await deleteContainer(spaceId, roomId, container!._id)

    const space = await getSpace(spaceId)
    expect(space.rooms[0].containers).toHaveLength(0)
  })
})

describe('searchItems', () => {
  beforeEach(async () => {
    const space = await createSpace('我的家')
    const room = await addRoom(space._id, '主卧')
    const container = await addContainer(space._id, room!._id, {
      name: '衣柜',
      slots: [{ label: '第1层', type: 'shelf', items: [
        { name: '羽绒服', category: '衣物', price: '899', createdAt: '', photo: '', notes: '' },
        { name: '风衣', category: '衣物', price: '650', createdAt: '', photo: '', notes: '' },
      ], photo: '' }],
    })
  })

  it('finds items by name', async () => {
    const results = await searchItems('羽绒')
    expect(results).toHaveLength(1)
    expect(results[0].items).toContain('羽绒服')
    expect(results[0].containerName).toBe('衣柜')
  })

  it('finds items case-insensitively', async () => {
    const results = await searchItems('风')
    expect(results).toHaveLength(1)
    expect(results[0].items).toContain('风衣')
  })

  it('returns empty for no match', async () => {
    const results = await searchItems('iPad')
    expect(results).toHaveLength(0)
  })

  it('returns empty for empty query', async () => {
    const results = await searchItems('')
    expect(results).toHaveLength(0)
  })
})

describe('getSpaces metadata', () => {
  it('includes roomCount and containerCount', async () => {
    const space = await createSpace('我的家')
    const room = await addRoom(space._id, '主卧')
    await addContainer(space._id, room!._id, { name: '衣柜' })
    await addContainer(space._id, room!._id, { name: '书架' })

    const spaces = await getSpaces()
    expect(spaces[0].roomCount).toBe(1)
    expect(spaces[0].containerCount).toBe(2)
  })
})
