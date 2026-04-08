import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getSpaces, getSpace } from '../../services/space'
import { normalizeItems, CATEGORIES } from '../../services/items'
import './index.scss'

type ViewMode = 'items' | 'rooms'

interface ListItem {
  name: string
  category: string
  roomName: string
  containerName: string
  slotLabel: string
  spaceId: string
  roomId: string
  containerId: string
}

export default function ItemListPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('items')
  const [allItems, setAllItems] = useState<ListItem[]>([])
  const [spaces, setSpaces] = useState<any[]>([])
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [roomFilter, setRoomFilter] = useState('全部')
  const [loading, setLoading] = useState(true)

  useDidShow(() => { loadAllData() })

  async function loadAllData() {
    setLoading(true)
    const spacesList = await getSpaces()
    if (spacesList.length === 0) { setLoading(false); return }

    const fullSpaces = await Promise.all(spacesList.map((s: any) => getSpace(s._id)))
    setSpaces(fullSpaces.filter(Boolean))

    const items: ListItem[] = []
    fullSpaces.forEach((space: any) => {
      if (!space) return
      space.rooms?.forEach((room: any) => {
        room.containers?.forEach((container: any) => {
          container.slots?.forEach((slot: any) => {
            normalizeItems(slot.items).forEach((item) => {
              items.push({
                name: item.name,
                category: item.category || '',
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
    return spaces.flatMap((s: any) => s?.rooms || [])
  }, [spaces])

  const categories = useMemo(() => {
    const set = new Set(allItems.map(i => i.category).filter(Boolean))
    return ['全部', ...set]
  }, [allItems])

  const filtered = categoryFilter === '全部' ? allItems : allItems.filter(i => i.category === categoryFilter)

  function handleItemClick(item: ListItem) {
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${item.spaceId}&roomId=${item.roomId}&containerId=${item.containerId}`,
    })
  }

  function handleOpenContainer(spaceId: string, roomId: string, containerId: string) {
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${spaceId}&roomId=${roomId}&containerId=${containerId}`,
    })
  }

  return (
    <View className='itemlist-page'>
      {/* View mode toggle */}
      <View className='mode-toggle'>
        <View className={`mode-btn ${viewMode === 'rooms' ? 'active' : ''}`} onClick={() => setViewMode('rooms')}>
          <Text>按房间</Text>
        </View>
        <View className={`mode-btn ${viewMode === 'items' ? 'active' : ''}`} onClick={() => setViewMode('items')}>
          <Text>按物品</Text>
        </View>
      </View>

      {loading && <View className='empty'><Text>加载中...</Text></View>}

      {/* Items view */}
      {!loading && viewMode === 'items' && (
        <View>
          <View className='filter-bar'>
            <Picker mode='selector' range={categories} onChange={(e) => setCategoryFilter(categories[Number(e.detail.value)])}>
              <View className='filter-chip'>
                <Text>{categoryFilter === '全部' ? '全部类型' : categoryFilter}</Text>
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
                  {item.category && <Text className='item-category'>{item.category}</Text>}
                  <Text className='item-location'>{item.roomName} · {item.containerName} · {item.slotLabel}</Text>
                </View>
              </View>
            ))}
            {filtered.length === 0 && <View className='empty'><Text>暂无匹配物品</Text></View>}
          </View>
        </View>
      )}

      {/* Rooms view (manage space) */}
      {!loading && viewMode === 'rooms' && (
        <View className='filter-bar'>
          <Picker mode='selector' range={['全部', ...rooms.map((r: any) => r.name)]}
            onChange={(e) => {
              const opts = ['全部', ...rooms.map((r: any) => r.name)]
              setRoomFilter(opts[Number(e.detail.value)])
            }}>
            <View className='filter-chip'>
              <Text>{roomFilter === '全部' ? '全部房间' : roomFilter}</Text>
              <Text className='arrow'>▾</Text>
            </View>
          </Picker>
        </View>
      )}
      {!loading && viewMode === 'rooms' && spaces.map((space: any) => (
        <View key={space._id} className='rooms-view'>
          {space.rooms?.filter((room: any) => roomFilter === '全部' || room.name === roomFilter).map((room: any) => (
            <View key={room._id} className='room-section'>
              <Text className='room-title'>{room.name}</Text>
              {room.containers?.map((container: any) => (
                <View key={container._id} className='container-card'
                  onClick={() => handleOpenContainer(space._id, room._id, container._id)}>
                  <Text className='container-name'>{container.name}</Text>
                  <Text className='container-slots'>{container.slots?.length || 0} 层</Text>
                  {container.slots?.map((slot: any, i: number) => {
                    const items = normalizeItems(slot.items)
                    return (
                      <View key={i} className='slot-preview'>
                        <Text className='slot-label'>{slot.label}:</Text>
                        <Text className='slot-items'>{items.length > 0 ? items.map(it => it.name).join('、') : '(空)'}</Text>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
