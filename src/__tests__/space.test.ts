import { __resetStorage } from './__mocks__/taro'

// Must import after mock is set up
import {
  getSpaces, getSpace, createSpace, deleteSpace,
  addRoom, deleteRoom,
  addContainer, updateContainer, deleteContainer,
  searchItems, moveItem,
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

describe('inline item editing via updateContainer', () => {
  let spaceId: string
  let roomId: string
  let containerId: string

  const initialSlots = [
    {
      label: '衣物', type: 'shelf', photo: '',
      items: [
        { name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-09', photo: '', notes: '' },
        { name: '风衣', category: '衣物', price: '650', createdAt: '2026-04-09', photo: '', notes: '轻薄款' },
      ],
    },
    {
      label: '鞋包', type: 'shelf', photo: '',
      items: [
        { name: '运动鞋', category: '鞋包', price: '799', createdAt: '2026-04-09', photo: '', notes: '' },
      ],
    },
  ]

  beforeEach(async () => {
    const space = await createSpace('我的家')
    spaceId = space._id
    const room = await addRoom(spaceId, '主卧')
    roomId = room!._id
    const container = await addContainer(spaceId, roomId, { name: '衣柜', type: 'wardrobe', slots: initialSlots })
    containerId = container!._id
  })

  it('updates a single item name and persists', async () => {
    const space = await getSpace(spaceId)
    const slots = [...space.rooms[0].containers[0].slots]
    const items = [...slots[0].items]
    items[0] = { ...items[0], name: '加厚羽绒服' }
    slots[0] = { ...slots[0], items }
    await updateContainer(spaceId, roomId, containerId, { slots })

    const updated = await getSpace(spaceId)
    expect(updated.rooms[0].containers[0].slots[0].items[0].name).toBe('加厚羽绒服')
    expect(updated.rooms[0].containers[0].slots[0].items[1].name).toBe('风衣')
  })

  it('updates item category via picker', async () => {
    const space = await getSpace(spaceId)
    const slots = [...space.rooms[0].containers[0].slots]
    const items = [...slots[0].items]
    items[0] = { ...items[0], category: '出行' }
    slots[0] = { ...slots[0], items }
    await updateContainer(spaceId, roomId, containerId, { slots })

    const updated = await getSpace(spaceId)
    expect(updated.rooms[0].containers[0].slots[0].items[0].category).toBe('出行')
    expect(updated.rooms[0].containers[0].slots[0].items[0].price).toBe('899')
  })

  it('updates item price and notes together', async () => {
    const space = await getSpace(spaceId)
    const slots = [...space.rooms[0].containers[0].slots]
    const items = [...slots[0].items]
    items[1] = { ...items[1], price: '800', notes: '秋冬两用' }
    slots[0] = { ...slots[0], items }
    await updateContainer(spaceId, roomId, containerId, { slots })

    const updated = await getSpace(spaceId)
    const item = updated.rooms[0].containers[0].slots[0].items[1]
    expect(item.price).toBe('800')
    expect(item.notes).toBe('秋冬两用')
    expect(item.name).toBe('风衣')
  })

  it('edits item in one slot without affecting another slot', async () => {
    const space = await getSpace(spaceId)
    const slots = [...space.rooms[0].containers[0].slots]
    const items0 = [...slots[0].items]
    items0[0] = { ...items0[0], notes: '已修改' }
    slots[0] = { ...slots[0], items: items0 }
    await updateContainer(spaceId, roomId, containerId, { slots })

    const updated = await getSpace(spaceId)
    expect(updated.rooms[0].containers[0].slots[0].items[0].notes).toBe('已修改')
    expect(updated.rooms[0].containers[0].slots[1].items[0].name).toBe('运动鞋')
    expect(updated.rooms[0].containers[0].slots[1].items[0].notes).toBe('')
  })

  it('persists edits across multiple sequential updates', async () => {
    const space1 = await getSpace(spaceId)
    const slots1 = [...space1.rooms[0].containers[0].slots]
    const items1 = [...slots1[0].items]
    items1[0] = { ...items1[0], name: '白鹅绒羽绒服' }
    slots1[0] = { ...slots1[0], items: items1 }
    await updateContainer(spaceId, roomId, containerId, { slots: slots1 })

    const space2 = await getSpace(spaceId)
    const slots2 = [...space2.rooms[0].containers[0].slots]
    const items2 = [...slots2[0].items]
    items2[0] = { ...items2[0], price: '1299' }
    slots2[0] = { ...slots2[0], items: items2 }
    await updateContainer(spaceId, roomId, containerId, { slots: slots2 })

    const final = await getSpace(spaceId)
    const item = final.rooms[0].containers[0].slots[0].items[0]
    expect(item.name).toBe('白鹅绒羽绒服')
    expect(item.price).toBe('1299')
  })
})

describe('moveItem', () => {
  let spaceId: string
  let roomId1: string
  let roomId2: string
  let containerId1: string
  let containerId2: string

  beforeEach(async () => {
    const space = await createSpace('我的家')
    spaceId = space._id
    const room1 = await addRoom(spaceId, '主卧')
    roomId1 = room1!._id
    const room2 = await addRoom(spaceId, '客厅')
    roomId2 = room2!._id

    const c1 = await addContainer(spaceId, roomId1, {
      name: '衣柜', type: 'wardrobe',
      slots: [
        { label: '第1层', type: 'shelf', photo: '', items: [
          { name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-09', photo: '', notes: '' },
          { name: '风衣', category: '衣物', price: '650', createdAt: '2026-04-09', photo: '', notes: '' },
        ]},
        { label: '第2层', type: 'shelf', photo: '', items: [
          { name: '运动鞋', category: '鞋包', price: '799', createdAt: '2026-04-09', photo: '', notes: '' },
        ]},
      ],
    })
    containerId1 = c1!._id

    const c2 = await addContainer(spaceId, roomId2, {
      name: '书架', type: 'shelf',
      slots: [
        { label: '上层', type: 'shelf', photo: '', items: [
          { name: 'iPad', category: '数码', price: '6799', createdAt: '2026-04-09', photo: '', notes: '' },
        ]},
      ],
    })
    containerId2 = c2!._id
  })

  it('moves item between slots in same container', async () => {
    const result = await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId1, containerId1, 1)
    expect(result).toBe(true)

    const space = await getSpace(spaceId)
    const c = space.rooms[0].containers[0]
    expect(c.slots[0].items).toHaveLength(1)
    expect(c.slots[0].items[0].name).toBe('风衣')
    expect(c.slots[1].items).toHaveLength(2)
    expect(c.slots[1].items[1].name).toBe('羽绒服')
  })

  it('moves item across containers in different rooms', async () => {
    const result = await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)
    expect(result).toBe(true)

    const space = await getSpace(spaceId)
    const fromSlot = space.rooms[0].containers[0].slots[0]
    expect(fromSlot.items).toHaveLength(1)
    expect(fromSlot.items[0].name).toBe('风衣')

    const toSlot = space.rooms[1].containers[0].slots[0]
    expect(toSlot.items).toHaveLength(2)
    expect(toSlot.items[0].name).toBe('iPad')
    expect(toSlot.items[1].name).toBe('羽绒服')
  })

  it('preserves all item fields after move', async () => {
    await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)

    const space = await getSpace(spaceId)
    const moved = space.rooms[1].containers[0].slots[0].items[1]
    expect(moved.name).toBe('羽绒服')
    expect(moved.category).toBe('衣物')
    expect(moved.price).toBe('899')
    expect(moved.createdAt).toBe('2026-04-09')
  })

  it('returns false for invalid source', async () => {
    const result = await moveItem(spaceId, roomId1, containerId1, 0, 99, roomId2, containerId2, 0)
    expect(result).toBe(false)
  })

  it('returns false for invalid target slot', async () => {
    const result = await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 99)
    expect(result).toBe(false)
  })

  it('returns false for non-existent space', async () => {
    const result = await moveItem('fake', roomId1, containerId1, 0, 0, roomId2, containerId2, 0)
    expect(result).toBe(false)
  })

  it('source slot has no items after moving the last item out', async () => {
    // Move the only item from slot 1 (运动鞋)
    await moveItem(spaceId, roomId1, containerId1, 1, 0, roomId2, containerId2, 0)

    const space = await getSpace(spaceId)
    const sourceSlot = space.rooms[0].containers[0].slots[1]
    expect(sourceSlot.items).toHaveLength(0)

    const destSlot = space.rooms[1].containers[0].slots[0]
    expect(destSlot.items).toHaveLength(2)
    expect(destSlot.items[1].name).toBe('运动鞋')
    expect(destSlot.items[1].category).toBe('鞋包')
  })

  it('destination slot categories reflect moved item', async () => {
    // Move 衣物 item into 书架 which only has 数码
    await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)

    const space = await getSpace(spaceId)
    const destSlot = space.rooms[1].containers[0].slots[0]
    const categories = [...new Set(destSlot.items.map((i: any) => i.category))]
    expect(categories).toContain('数码')
    expect(categories).toContain('衣物')
  })

  it('source slot categories update after last item of that category moved', async () => {
    // Move both 衣物 items out of slot 0
    await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)
    await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)

    const space = await getSpace(spaceId)
    const sourceSlot = space.rooms[0].containers[0].slots[0]
    expect(sourceSlot.items).toHaveLength(0)
    const sourceCats = sourceSlot.items.map((i: any) => i.category).filter(Boolean)
    expect(sourceCats).not.toContain('衣物')
  })

  it('multiple sequential moves track items correctly across containers', async () => {
    // Move 羽绒服 from 衣柜 slot0 → 书架 slot0
    await moveItem(spaceId, roomId1, containerId1, 0, 0, roomId2, containerId2, 0)
    // Move 运动鞋 from 衣柜 slot1 → 书架 slot0
    await moveItem(spaceId, roomId1, containerId1, 1, 0, roomId2, containerId2, 0)

    const space = await getSpace(spaceId)
    const destSlot = space.rooms[1].containers[0].slots[0]
    expect(destSlot.items).toHaveLength(3)
    const names = destSlot.items.map((i: any) => i.name)
    expect(names).toContain('iPad')
    expect(names).toContain('羽绒服')
    expect(names).toContain('运动鞋')

    const categories = [...new Set(destSlot.items.map((i: any) => i.category))]
    expect(categories).toEqual(expect.arrayContaining(['数码', '衣物', '鞋包']))

    // Source slots should be reduced
    expect(space.rooms[0].containers[0].slots[0].items).toHaveLength(1)
    expect(space.rooms[0].containers[0].slots[1].items).toHaveLength(0)
  })
})
