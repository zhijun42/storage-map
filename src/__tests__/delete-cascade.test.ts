/**
 * Integration test: cascade delete with item check
 *
 * Simulates the draw-editor delete flow:
 * 1. Create space with rooms, containers, items
 * 2. Store rect→container ID mapping (as handleFinish does)
 * 3. countCabinetItems should find items by rect ID
 * 4. After items are removed, delete should be allowed
 */

import Taro, { __resetStorage } from './__mocks__/taro'
import { createSpace, addRoom, addContainer, updateContainer, getSpace, getSpaces } from '../services/space'
import { serializeItems, Item } from '../services/items'

beforeEach(() => { __resetStorage() })

// Simulate the countCabinetItems function from draw-editor
async function countCabinetItems(rectId: string): Promise<number> {
  const map = JSON.parse(Taro.getStorageSync('rect_container_map') || '{}')
  const mapping = map[rectId]
  if (!mapping) return 0

  const space = await getSpace(mapping.spaceId)
  if (!space?.rooms) return 0
  for (const room of space.rooms) {
    for (const c of (room.containers || [])) {
      if (c._id !== mapping.containerId) continue
      let count = 0
      for (const slot of (c.slots || [])) {
        if (Array.isArray(slot.items)) count += slot.items.length
        else if (typeof slot.items === 'string' && slot.items.trim()) count += slot.items.split('、').length
      }
      return count
    }
  }
  return 0
}

// Simulate handleFinish storing the rect→container mapping
function storeMapping(rectId: string, spaceId: string, roomId: string, containerId: string) {
  const map = JSON.parse(Taro.getStorageSync('rect_container_map') || '{}')
  map[rectId] = { containerId, spaceId, roomId }
  Taro.setStorageSync('rect_container_map', JSON.stringify(map))
}

describe('Delete cascade with item check', () => {
  let spaceId: string
  let roomId: string

  beforeEach(async () => {
    const space = await createSpace('我的家')
    spaceId = space._id
    const room = await addRoom(spaceId, '主卧')
    roomId = room!._id
  })

  it('returns 0 items for unknown rect ID', async () => {
    expect(await countCabinetItems('unknown_rect')).toBe(0)
  })

  it('returns 0 items for empty container', async () => {
    const container = await addContainer(spaceId, roomId, { name: '衣柜' })
    storeMapping('rect_1', spaceId, roomId, container!._id)

    expect(await countCabinetItems('rect_1')).toBe(0)
  })

  it('returns correct item count for container with items', async () => {
    const items: Item[] = [
      { name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-09', photo: '', notes: '' },
      { name: '风衣', category: '衣物', price: '650', createdAt: '2026-04-09', photo: '', notes: '' },
      { name: '牛仔裤', category: '衣物', price: '280', createdAt: '2026-04-09', photo: '', notes: '' },
    ]
    const container = await addContainer(spaceId, roomId, {
      name: '衣柜',
      slots: [{ label: '第1层', type: 'shelf', items: serializeItems(items), photo: '' }],
    })
    storeMapping('rect_wardrobe', spaceId, roomId, container!._id)

    expect(await countCabinetItems('rect_wardrobe')).toBe(3)
  })

  it('counts items across multiple slots', async () => {
    const container = await addContainer(spaceId, roomId, {
      name: '床头柜',
      slots: [
        { label: '鞋包', type: 'shelf', items: serializeItems([
          { name: '运动鞋', category: '鞋包', price: '699', createdAt: '', photo: '', notes: '' },
        ]), photo: '' },
        { label: '书籍', type: 'drawer', items: serializeItems([
          { name: '三体', category: '书籍', price: '68', createdAt: '', photo: '', notes: '' },
          { name: '人类简史', category: '书籍', price: '55', createdAt: '', photo: '', notes: '' },
        ]), photo: '' },
        { label: '化妆品', type: 'drawer', items: [], photo: '' },
      ],
    })
    storeMapping('rect_bedside', spaceId, roomId, container!._id)

    expect(await countCabinetItems('rect_bedside')).toBe(3)
  })

  it('blocks delete when items exist, allows after clearing', async () => {
    const items: Item[] = [
      { name: 'iPad', category: '数码', price: '6799', createdAt: '', photo: '', notes: '' },
    ]
    const container = await addContainer(spaceId, roomId, {
      name: '储物柜',
      slots: [{ label: '数码', type: 'shelf', items: serializeItems(items), photo: '' }],
    })
    storeMapping('rect_storage', spaceId, roomId, container!._id)

    // Should block: has 1 item
    const countBefore = await countCabinetItems('rect_storage')
    expect(countBefore).toBe(1)
    expect(countBefore > 0).toBe(true) // would block delete

    // Clear items
    await updateContainer(spaceId, roomId, container!._id, {
      slots: [{ label: '数码', type: 'shelf', items: [], photo: '' }],
    })

    // Should allow: 0 items
    const countAfter = await countCabinetItems('rect_storage')
    expect(countAfter).toBe(0)
    expect(countAfter > 0).toBe(false) // would allow delete
  })

  it('handles multiple cabinets in same room independently', async () => {
    const cab1 = await addContainer(spaceId, roomId, {
      name: '衣柜',
      slots: [{ label: '衣物', type: 'shelf', items: serializeItems([
        { name: '羽绒服', category: '衣物', price: '899', createdAt: '', photo: '', notes: '' },
      ]), photo: '' }],
    })
    const cab2 = await addContainer(spaceId, roomId, {
      name: '书架',
      slots: [{ label: '书籍', type: 'shelf', items: [], photo: '' }],
    })
    storeMapping('rect_cab1', spaceId, roomId, cab1!._id)
    storeMapping('rect_cab2', spaceId, roomId, cab2!._id)

    expect(await countCabinetItems('rect_cab1')).toBe(1) // has items
    expect(await countCabinetItems('rect_cab2')).toBe(0) // empty

    // Room delete should be blocked by cab1
    // (In real code, the loop checks each cab and blocks on first with items)
  })

  it('mapping survives across function calls (localStorage persistence)', async () => {
    const container = await addContainer(spaceId, roomId, {
      name: '鞋柜',
      slots: [{ label: '鞋包', type: 'shelf', items: serializeItems([
        { name: '运动鞋', category: '鞋包', price: '699', createdAt: '', photo: '', notes: '' },
        { name: '皮鞋', category: '鞋包', price: '580', createdAt: '', photo: '', notes: '' },
      ]), photo: '' }],
    })
    storeMapping('rect_shoe', spaceId, roomId, container!._id)

    // Simulate "re-entering" the page (re-reading from storage)
    const count = await countCabinetItems('rect_shoe')
    expect(count).toBe(2)
  })
})
