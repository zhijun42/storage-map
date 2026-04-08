import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getSpaces } from '../../services/space'
import './index.scss'

interface ListItem {
  name: string
  category: string
  spaceName: string
  roomName: string
  containerName: string
  slotLabel: string
  spaceId: string
  roomId: string
  containerId: string
}

export default function ItemListPage() {
  const [allItems, setAllItems] = useState<ListItem[]>([])
  const [roomFilter, setRoomFilter] = useState('全部')

  useEffect(() => { loadAllItems() }, [])

  async function loadAllItems() {
    const spaces = await getSpaces()
    const items: ListItem[] = []
    for (const spaceSummary of spaces) {
      const space = await (await import('../../services/space')).getSpace(spaceSummary._id)
      if (!space) continue
      space.rooms?.forEach((room: any) => {
        room.containers?.forEach((container: any) => {
          container.slots?.forEach((slot: any) => {
            if (slot.items) {
              slot.items.split('、').forEach((itemName: string) => {
                const name = itemName.trim()
                if (!name) return
                items.push({
                  name,
                  category: container.type === 'wardrobe' ? '衣物' : container.type === 'shelf' ? '书架' : '物品',
                  spaceName: space.name,
                  roomName: room.name,
                  containerName: container.name,
                  slotLabel: slot.label,
                  spaceId: space._id,
                  roomId: room._id,
                  containerId: container._id,
                })
              })
            }
          })
        })
      })
    }
    setAllItems(items)
  }

  const rooms = useMemo(() => {
    const set = new Set(allItems.map(i => i.roomName))
    return ['全部', ...set]
  }, [allItems])

  const filtered = roomFilter === '全部'
    ? allItems
    : allItems.filter(i => i.roomName === roomFilter)

  function handleItemClick(item: ListItem) {
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${item.spaceId}&roomId=${item.roomId}&containerId=${item.containerId}`,
    })
  }

  return (
    <View className='itemlist-page'>
      <View className='filter-bar'>
        <Picker
          mode='selector'
          range={rooms}
          onChange={(e) => setRoomFilter(rooms[Number(e.detail.value)])}
        >
          <View className='filter-chip'>
            <Text>{roomFilter === '全部' ? '全部房间' : roomFilter}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
        <Text className='count'>{filtered.length} 件物品</Text>
      </View>

      <View className='item-list'>
        {filtered.map((item, index) => (
          <View key={index} className='item-card' onClick={() => handleItemClick(item)}>
            <View className='item-icon'>
              <Text className='icon-text'>{item.name.slice(0, 1)}</Text>
            </View>
            <View className='item-info'>
              <Text className='item-name'>{item.name}</Text>
              <Text className='item-location'>{item.roomName} · {item.containerName} · {item.slotLabel}</Text>
            </View>
          </View>
        ))}

        {allItems.length === 0 && (
          <View className='empty'>
            <Text>加载中...</Text>
          </View>
        )}

        {allItems.length > 0 && filtered.length === 0 && (
          <View className='empty'>
            <Text>暂无匹配物品</Text>
          </View>
        )}
      </View>
    </View>
  )
}
