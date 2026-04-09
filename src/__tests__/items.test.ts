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
