import { normalizeItems, serializeItems, CATEGORIES, Item } from '../services/items'

describe('CATEGORIES', () => {
  it('has no duplicates', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length)
  })

  it('includes key categories', () => {
    expect(CATEGORIES).toContain('衣物')
    expect(CATEGORIES).toContain('鞋包')
    expect(CATEGORIES).toContain('数码')
    expect(CATEGORIES).toContain('书籍')
    expect(CATEGORIES).toContain('其他')
  })
})

describe('normalizeItems', () => {
  it('returns empty array for null/undefined', () => {
    expect(normalizeItems(null)).toEqual([])
    expect(normalizeItems(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(normalizeItems('')).toEqual([])
    expect(normalizeItems('  ')).toEqual([])
  })

  it('parses legacy comma-separated string', () => {
    const items = normalizeItems('羽绒服、牛仔裤、T恤')
    expect(items).toHaveLength(3)
    expect(items[0].name).toBe('羽绒服')
    expect(items[1].name).toBe('牛仔裤')
    expect(items[2].name).toBe('T恤')
    expect(items[0].category).toBe('')
  })

  it('parses array of strings', () => {
    const items = normalizeItems(['item1', 'item2'])
    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('item1')
  })

  it('parses array of objects', () => {
    const input = [
      { name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-08', photo: '', notes: '' },
    ]
    const items = normalizeItems(input)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('羽绒服')
    expect(items[0].category).toBe('衣物')
    expect(items[0].price).toBe('899')
  })

  it('handles mixed array gracefully', () => {
    const items = normalizeItems([{ name: 'a', category: 'b' }, 'plain'])
    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('a')
    expect(items[1].name).toBe('plain')
  })
})

describe('serializeItems', () => {
  it('preserves all fields', () => {
    const items: Item[] = [
      { name: 'iPad', category: '数码', price: '6799', createdAt: '2026-04-08', photo: 'url', notes: 'test' },
    ]
    const result = serializeItems(items)
    expect(result[0].name).toBe('iPad')
    expect(result[0].category).toBe('数码')
    expect(result[0].price).toBe('6799')
    expect(result[0].photo).toBe('url')
    expect(result[0].notes).toBe('test')
  })

  it('fills missing optional fields with empty string', () => {
    const items: Item[] = [{ name: 'test', category: '', price: '', createdAt: '', photo: '', notes: '' }]
    const result = serializeItems(items)
    expect(result[0].price).toBe('')
    expect(result[0].photo).toBe('')
  })
})

describe('inline edit: normalize → mutate → serialize round-trip', () => {
  const baseItems = [
    { name: '羽绒服', category: '衣物', price: '899', createdAt: '2026-04-09', photo: '', notes: '' },
    { name: '风衣', category: '衣物', price: '650', createdAt: '2026-04-09', photo: '', notes: '轻薄款' },
  ]

  it('updates item name and preserves other fields', () => {
    const items = normalizeItems(baseItems)
    items[0] = { ...items[0], name: '加厚羽绒服' }
    const result = serializeItems(items)
    expect(result[0].name).toBe('加厚羽绒服')
    expect(result[0].category).toBe('衣物')
    expect(result[0].price).toBe('899')
    expect(result).toHaveLength(2)
  })

  it('updates item category', () => {
    const items = normalizeItems(baseItems)
    items[1] = { ...items[1], category: '鞋包' }
    const result = serializeItems(items)
    expect(result[1].category).toBe('鞋包')
    expect(result[1].name).toBe('风衣')
  })

  it('updates item price', () => {
    const items = normalizeItems(baseItems)
    items[0] = { ...items[0], price: '1299' }
    const result = serializeItems(items)
    expect(result[0].price).toBe('1299')
  })

  it('updates item notes', () => {
    const items = normalizeItems(baseItems)
    items[0] = { ...items[0], notes: '冬季必备' }
    const result = serializeItems(items)
    expect(result[0].notes).toBe('冬季必备')
  })

  it('updates multiple fields on same item', () => {
    const items = normalizeItems(baseItems)
    items[0] = { ...items[0], name: '新羽绒服', price: '1500', notes: '打折入手' }
    const result = serializeItems(items)
    expect(result[0].name).toBe('新羽绒服')
    expect(result[0].price).toBe('1500')
    expect(result[0].notes).toBe('打折入手')
    expect(result[0].category).toBe('衣物')
  })

  it('round-trips legacy string items after edit', () => {
    const items = normalizeItems('羽绒服、牛仔裤')
    items[0] = { ...items[0], category: '衣物', price: '899' }
    const result = serializeItems(items)
    expect(result[0].name).toBe('羽绒服')
    expect(result[0].category).toBe('衣物')
    expect(result[0].price).toBe('899')
    expect(result[1].name).toBe('牛仔裤')
    expect(result[1].category).toBe('')
  })
})
