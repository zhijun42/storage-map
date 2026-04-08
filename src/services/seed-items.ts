/**
 * Seed random items into existing cloud DB slots based on their categories.
 */
import { getSpaces, getSpace, updateContainer } from './space'
import { serializeItems, Item } from './items'

const ITEM_POOL: Record<string, { name: string; price: string }[]> = {
  '衣物': [
    { name: '羽绒服', price: '899' }, { name: '风衣', price: '650' },
    { name: '连衣裙', price: '320' }, { name: '牛仔裤', price: '280' },
    { name: 'T恤（3件）', price: '150' }, { name: '西装外套', price: '1200' },
  ],
  '鞋包': [
    { name: '运动鞋', price: '699' }, { name: '皮鞋', price: '580' },
    { name: '双肩包', price: '350' }, { name: '手提包', price: '1200' },
    { name: '拖鞋', price: '49' }, { name: '高跟鞋', price: '420' },
  ],
  '数码': [
    { name: 'iPad Pro', price: '6799' }, { name: '充电宝', price: '129' },
    { name: '蓝牙耳机', price: '299' }, { name: '数据线（5根）', price: '45' },
    { name: '移动硬盘', price: '459' },
  ],
  '书籍': [
    { name: '三体', price: '68' }, { name: '人类简史', price: '55' },
    { name: 'JavaScript高级编程', price: '98' }, { name: '设计中的设计', price: '42' },
    { name: '小王子', price: '28' },
  ],
  '化妆品': [
    { name: '防晒霜', price: '198' }, { name: '面霜', price: '320' },
    { name: '口红套装', price: '450' }, { name: '洁面乳', price: '89' },
    { name: '精华液', price: '580' },
  ],
  '杂物': [
    { name: '工具箱', price: '89' }, { name: '电池（一盒）', price: '25' },
    { name: '文件夹（3个）', price: '35' }, { name: '胶带', price: '12' },
    { name: '剪刀', price: '18' },
  ],
  '食品': [
    { name: '坚果礼盒', price: '128' }, { name: '茶叶', price: '200' },
    { name: '咖啡豆', price: '85' }, { name: '巧克力', price: '45' },
  ],
  '药品': [
    { name: '感冒药', price: '25' }, { name: '创可贴', price: '12' },
    { name: '维生素C', price: '68' }, { name: '体温计', price: '35' },
  ],
}

const GENERIC_ITEMS = [
  { name: '收纳盒', price: '39' }, { name: '抽屉整理格', price: '25' },
  { name: '密封袋（一包）', price: '15' }, { name: '标签贴', price: '8' },
]

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

const today = new Date().toISOString().slice(0, 10)

export async function seedItemsIntoSlots() {
  const spaces = await getSpaces()
  if (spaces.length === 0) return 0

  const space = await getSpace(spaces[0]._id)
  if (!space?.rooms) return 0

  let totalItems = 0

  for (const room of space.rooms) {
    for (const container of (room.containers || [])) {
      const slots = container.slots || []
      let changed = false
      const updatedSlots = slots.map((slot: any) => {
        // Skip slots that already have items
        if (slot.items && ((Array.isArray(slot.items) && slot.items.length > 0) || (typeof slot.items === 'string' && slot.items.trim()))) {
          return slot
        }

        // Pick items based on slot categories or label
        const cats = slot.categories || []
        const label = slot.label || ''
        let pool: { name: string; price: string }[] = []

        for (const cat of cats) {
          if (ITEM_POOL[cat]) pool.push(...ITEM_POOL[cat])
        }
        // Also try matching label
        for (const [key, items] of Object.entries(ITEM_POOL)) {
          if (label.includes(key)) pool.push(...items)
        }

        if (pool.length === 0) pool = GENERIC_ITEMS

        const count = 2 + Math.floor(Math.random() * 3) // 2-4 items
        const picked = pickRandom(pool, count)
        const items: Item[] = picked.map(p => ({
          name: p.name,
          category: cats[0] || '',
          price: p.price,
          createdAt: today,
          photo: '',
          notes: '',
        }))

        changed = true
        totalItems += items.length
        return { ...slot, items: serializeItems(items) }
      })

      if (changed) {
        await updateContainer(space._id, room._id, container._id, { slots: updatedSlots })
      }
    }
  }

  return totalItems
}
