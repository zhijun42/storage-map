export interface Item {
  name: string
  photo: string
  notes: string
}

/**
 * Normalize slot items — handles both legacy string format and new array format.
 * Legacy: "T恤×15、短裤×8" → [{name: "T恤×15"}, {name: "短裤×8"}]
 * New: [{name, photo, notes}] → as-is
 */
export function normalizeItems(items: any): Item[] {
  if (!items) return []
  if (Array.isArray(items)) {
    return items.map((item: any) => ({
      name: typeof item === 'string' ? item : (item.name || ''),
      photo: item.photo || '',
      notes: item.notes || '',
    }))
  }
  if (typeof items === 'string' && items.trim()) {
    return items.split('、').filter((s: string) => s.trim()).map((name: string) => ({
      name: name.trim(),
      photo: '',
      notes: '',
    }))
  }
  return []
}

/**
 * Serialize items array back to storage format (array of objects).
 */
export function serializeItems(items: Item[]): Item[] {
  return items.map(i => ({ name: i.name, photo: i.photo, notes: i.notes }))
}
