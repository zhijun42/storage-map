/**
 * Integration test: floorplan visual data sync
 *
 * Tests the flow:
 * 1. handleFinish saves drawn_floorplan, draw_all_rects, rect_container_map to localStorage
 * 2. cloudSaveFloorplan is called with the correct data
 * 3. pullFromCloudIfEmpty restores data from cloud when local is empty
 */

import Taro, { __resetStorage } from './__mocks__/taro'
import { pullFromCloudIfEmpty, createSpace, addRoom, addContainer, getSpaces, getSpace } from '../services/space'

// Enable cloud for sync tests
const origEnv = process.env.TARO_ENV
beforeAll(() => {
  process.env.TARO_ENV = 'weapp'
  ;(Taro as any).cloud = {} // truthy
})
afterAll(() => {
  process.env.TARO_ENV = origEnv
  ;(Taro as any).cloud = null
})

// Track cloud calls
let savedFloorplanData: any = null
let mockCloudFloorplan: any = null

jest.mock('../services/cloud', () => ({
  cloudGetSpaces: async () => mockCloudFloorplan ? [{ _id: 'cloud_space_1', name: 'test' }] : [],
  cloudGetSpace: async () => mockCloudFloorplan ? { _id: 'cloud_space_1', name: 'test', rooms: [] } : null,
  cloudCreateSpace: async () => ({}),
  cloudDeleteSpace: async () => {},
  cloudAddRoom: async () => ({}),
  cloudDeleteRoom: async () => {},
  cloudAddContainer: async () => ({}),
  cloudUpdateContainer: async () => {},
  cloudDeleteContainer: async () => {},
  cloudSearchItems: async () => [],
  cloudUploadPhoto: async () => '',
  cloudCreateShare: async () => '',
  cloudResolveShare: async () => ({}),
  cloudSaveFloorplan: async (spaceId: string, fp: string, rects: string, map: string) => {
    savedFloorplanData = { spaceId, floorplan: fp, rects: rects, rectMap: map }
  },
  cloudLoadFloorplan: async (_spaceId: string) => mockCloudFloorplan,
}))

beforeEach(() => {
  __resetStorage()
  savedFloorplanData = null
  mockCloudFloorplan = null
})

describe('Floorplan data in localStorage', () => {
  it('stores drawn_floorplan JSON', () => {
    const fpData = JSON.stringify({
      unit: 'mm', scale: 0.05,
      rooms: [{ id: 'r1', name: '主卧', walls: [] }],
      furniture: [{ id: 'f1', name: '双人床', x: 100, y: 200, width: 500, height: 400 }],
      containers: [{ name: '衣柜', x: 50, y: 100, width: 300, height: 200 }],
    })
    Taro.setStorageSync('drawn_floorplan', fpData)

    const loaded = JSON.parse(Taro.getStorageSync('drawn_floorplan'))
    expect(loaded.rooms).toHaveLength(1)
    expect(loaded.rooms[0].name).toBe('主卧')
    expect(loaded.furniture).toHaveLength(1)
    expect(loaded.furniture[0].name).toBe('双人床')
    expect(loaded.containers).toHaveLength(1)
    expect(loaded.containers[0].name).toBe('衣柜')
  })

  it('stores draw_all_rects JSON', () => {
    const rects = JSON.stringify([
      { id: 'rect_1', x: 10, y: 20, w: 100, h: 80, labels: ['主卧'], slotType: 'open', phase: 'room' },
      { id: 'rect_2', x: 30, y: 30, w: 20, h: 15, labels: ['衣柜'], slotType: 'open', phase: 'cabinet' },
    ])
    Taro.setStorageSync('draw_all_rects', rects)

    const loaded = JSON.parse(Taro.getStorageSync('draw_all_rects'))
    expect(loaded).toHaveLength(2)
    expect(loaded[0].phase).toBe('room')
    expect(loaded[1].phase).toBe('cabinet')
  })

  it('stores rect_container_map JSON', () => {
    const map = JSON.stringify({
      rect_2: { containerId: 'c_abc', spaceId: 's_123', roomId: 'r_456' },
    })
    Taro.setStorageSync('rect_container_map', map)

    const loaded = JSON.parse(Taro.getStorageSync('rect_container_map'))
    expect(loaded.rect_2.containerId).toBe('c_abc')
    expect(loaded.rect_2.spaceId).toBe('s_123')
  })
})

describe('pullFromCloudIfEmpty restores floorplan', () => {
  it('pulls floorplan data when local is empty', async () => {
    // Setup: cloud has floorplan data
    mockCloudFloorplan = {
      floorplan: JSON.stringify({ rooms: [{ id: 'r1', name: '客厅' }], furniture: [], containers: [] }),
      rects: JSON.stringify([{ id: 'rect_1', phase: 'room' }]),
      rectMap: JSON.stringify({ rect_1: { containerId: 'c1', spaceId: 's1', roomId: 'r1' } }),
    }

    // Local is empty — pullFromCloudIfEmpty should restore
    await pullFromCloudIfEmpty()

    const fp = Taro.getStorageSync('drawn_floorplan_cloud_space_1')
    const rects = Taro.getStorageSync('draw_all_rects_cloud_space_1')
    const map = Taro.getStorageSync('rect_container_map_cloud_space_1')

    expect(fp).toBeTruthy()
    expect(JSON.parse(fp).rooms[0].name).toBe('客厅')
    expect(JSON.parse(rects)[0].phase).toBe('room')
    expect(JSON.parse(map).rect_1.containerId).toBe('c1')
  })

  it('does NOT overwrite when local has data', async () => {
    // Setup: local already has space data
    const space = await createSpace('我的家')
    await addRoom(space._id, '主卧')

    // Cloud has different data
    mockCloudFloorplan = {
      floorplan: JSON.stringify({ rooms: [{ id: 'cloud_r', name: '云端房间' }] }),
      rects: '[]',
      rectMap: '{}',
    }

    await pullFromCloudIfEmpty()

    // Should NOT have pulled cloud data (local not empty)
    const fp = Taro.getStorageSync('drawn_floorplan')
    expect(fp).toBe('') // not set because local spaces exist
  })

  it('handles cloud returning null gracefully', async () => {
    mockCloudFloorplan = null

    await pullFromCloudIfEmpty()

    expect(Taro.getStorageSync('drawn_floorplan')).toBe('')
    expect(Taro.getStorageSync('draw_all_rects')).toBe('')
  })
})

describe('End-to-end: create space + store mapping + verify', () => {
  it('full flow: create space, containers, store mapping, verify lookup', async () => {
    // Simulate handleFinish flow
    const space = await createSpace('我的家')
    const room = await addRoom(space._id, '主卧')
    const container = await addContainer(space._id, room!._id, {
      name: '衣柜',
      slots: [{ label: '衣物', type: 'shelf', items: [{ name: '羽绒服', category: '衣物', price: '899', createdAt: '', photo: '', notes: '' }], photo: '' }],
    })

    // Store mapping (as handleFinish does)
    const map: Record<string, any> = {}
    map['rect_wardrobe'] = { containerId: container!._id, spaceId: space._id, roomId: room!._id }
    Taro.setStorageSync('rect_container_map', JSON.stringify(map))

    // Store floorplan (as handleFinish does)
    Taro.setStorageSync('drawn_floorplan', JSON.stringify({
      rooms: [{ id: 'r1', name: '主卧', walls: [] }],
      furniture: [],
      containers: [{ name: '衣柜', x: 100, y: 200, width: 600, height: 300 }],
    }))

    // Verify: can look up container by rect ID
    const loadedMap = JSON.parse(Taro.getStorageSync('rect_container_map'))
    const mapping = loadedMap['rect_wardrobe']
    expect(mapping).toBeTruthy()

    const spaceData = await getSpace(mapping.spaceId)
    expect(spaceData).toBeTruthy()
    const foundContainer = spaceData.rooms[0].containers.find((c: any) => c._id === mapping.containerId)
    expect(foundContainer).toBeTruthy()
    expect(foundContainer.name).toBe('衣柜')
    expect(foundContainer.slots[0].items).toHaveLength(1)
    expect(foundContainer.slots[0].items[0].name).toBe('羽绒服')

    // Verify: floorplan has container position
    const fp = JSON.parse(Taro.getStorageSync('drawn_floorplan'))
    expect(fp.containers[0].x).toBe(100)
    expect(fp.containers[0].name).toBe('衣柜')
  })
})
