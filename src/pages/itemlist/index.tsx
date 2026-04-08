import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getSpaces, getSpace } from '../../services/space'
import { normalizeItems } from '../../services/items'
import './index.scss'

interface ListItem {
  name: string
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
  const [loading, setLoading] = useState(true)

  useDidShow(() => { loadAllItems() })

  async function loadAllItems() {
    setLoading(true)
    const spaces = await getSpaces()
    if (spaces.length === 0) { setLoading(false); return }

    // Load all spaces in parallel
    const fullSpaces = await Promise.all(
      spaces.map((s: any) => getSpace(s._id))
    )

    const items: ListItem[] = []
    fullSpaces.forEach((space: any) => {
      if (!space) return
      space.rooms?.forEach((room: any) => {
        room.containers?.forEach((container: any) => {
          container.slots?.forEach((slot: any) => {
            normalizeItems(slot.items).forEach((item) => {
              items.push({
                name: item.name,
                roomName: room.name,
                containerName: container.name,
                slotLabel: slot.label,
                spaceId: space._id,
                roomId: room._id,
                containerId: container._id,
              })
            })
          })
        })
      })
    })
    setAllItems(items)
    setLoading(false)
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

      {loading && (
        <View className='empty'><Text>加载中...</Text></View>
      )}

      {!loading && (
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
          {filtered.length === 0 && (
            <View className='empty'><Text>暂无匹配物品</Text></View>
          )}
        </View>
      )}
    </View>
  )
}
