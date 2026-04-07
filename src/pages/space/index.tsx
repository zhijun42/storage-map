import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, addRoom, addContainer } from '../../services/space'
import './index.scss'

export default function SpacePage() {
  const router = useRouter()
  const spaceId = router.params.id || ''
  const [space, setSpace] = useState<any>(null)
  const [activeRoom, setActiveRoom] = useState<string>('')

  useEffect(() => { loadSpace() }, [])

  async function loadSpace() {
    const data = await getSpace(spaceId)
    setSpace(data)
    if (data?.rooms?.length > 0 && !activeRoom) {
      setActiveRoom(data.rooms[0]._id)
    }
  }

  async function handleAddRoom() {
    const res = await Taro.showModal({
      title: '添加房间',
      editable: true,
      placeholderText: '房间名称（如：卧室、客厅）',
    })
    if (res.confirm && res.content) {
      const room = await addRoom(spaceId, res.content)
      if (room) {
        setActiveRoom(room._id)
        loadSpace()
      }
    }
  }

  async function handleAddContainer() {
    const res = await Taro.showModal({
      title: '添加容器',
      editable: true,
      placeholderText: '容器名称（如：主衣柜、书架）',
    })
    if (res.confirm && res.content) {
      await addContainer(spaceId, activeRoom, {
        name: res.content,
        type: 'custom',
        movable: false,
        slots: [
          { label: '第1层', type: 'shelf', items: '', photo: '' },
        ],
      })
      loadSpace()
    }
  }

  function handleOpenContainer(containerId: string) {
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${spaceId}&roomId=${activeRoom}&containerId=${containerId}`,
    })
  }

  if (!space) return <View className='loading'><Text>加载中...</Text></View>

  const currentRoom = space.rooms?.find((r: any) => r._id === activeRoom)

  return (
    <View className='space-page'>
      <Text className='page-title'>{space.name}</Text>

      {/* Room Tabs */}
      <View className='room-tabs'>
        {space.rooms?.map((room: any) => (
          <View
            key={room._id}
            className={`room-tab ${room._id === activeRoom ? 'active' : ''}`}
            onClick={() => setActiveRoom(room._id)}
          >
            <Text>{room.name}</Text>
          </View>
        ))}
        <View className='room-tab add-tab' onClick={handleAddRoom}>
          <Text>+ 添加</Text>
        </View>
      </View>

      {/* Container List */}
      {currentRoom ? (
        <View className='container-list'>
          {currentRoom.containers?.map((container: any) => (
            <View
              key={container._id}
              className='container-card'
              onClick={() => handleOpenContainer(container._id)}
            >
              <Text className='container-name'>{container.name}</Text>
              <Text className='container-info'>
                {container.slots?.length || 0} 层
                {container.movable ? ' · 可移动' : ''}
              </Text>
              {container.slots?.map((slot: any, i: number) => (
                <View key={i} className='slot-preview'>
                  <Text className='slot-label'>{slot.label}:</Text>
                  <Text className='slot-items'>{slot.items || '(空)'}</Text>
                </View>
              ))}
            </View>
          ))}

          <Button className='add-btn' onClick={handleAddContainer}>
            + 添加容器
          </Button>
        </View>
      ) : (
        <View className='empty'>
          <Text>请先添加房间</Text>
        </View>
      )}
    </View>
  )
}
