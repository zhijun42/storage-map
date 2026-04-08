export const CATEGORIES = [
  '数码产品', '衣物', '书籍', '鞋类', '出行', '家居',
  '日用品', '医用品', '证件', '收藏', '玩具', '食品', '其他',
]

export interface Item {
  name: string
  category: string
  price: number | string
  createdAt: string
  photo: string
  notes: string
}

/**
 * Normalize slot items — handles legacy string, plain array, and structured array.
 */
export function normalizeItems(items: any): Item[] {
  if (!items) return []
  if (Array.isArray(items)) {
    return items.map((item: any) => ({
      name: typeof item === 'string' ? item : (item.name || ''),
      category: item.category || '',
      price: item.price || '',
      createdAt: item.createdAt || '',
      photo: item.photo || '',
      notes: item.notes || '',
    }))
  }
  if (typeof items === 'string' && items.trim()) {
    return items.split('、').filter((s: string) => s.trim()).map((name: string) => ({
      name: name.trim(),
      category: '',
      price: '',
      createdAt: '',
      photo: '',
      notes: '',
    }))
  }
  return []
}

export function serializeItems(items: Item[]): Item[] {
  return items.map(i => ({
    name: i.name,
    category: i.category || '',
    price: i.price || '',
    createdAt: i.createdAt || '',
    photo: i.photo,
    notes: i.notes,
  }))
}
