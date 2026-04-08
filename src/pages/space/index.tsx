import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, addRoom, addContainer, deleteRoom, createShareLink } from '../../services/space'
import './index.scss'

export default function SpacePage() {
  const router = useRouter()
  const spaceId = router.params.id || ''
  const [space, setSpace] = useState<any>(null)
  const [activeRoom, setActiveRoom] = useState<string>('')

  useEffect(() => { loadSpace() }, [])
  useDidShow(() => { loadSpace() })

  useShareAppMessage(() => ({
    title: space ? `${space.name} - 收纳地图` : '收纳地图',
    path: `/pages/space/index?id=${spaceId}`,
  }))

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

  async function handleDeleteRoom() {
    if (!activeRoom) return
    const currentRoom = space?.rooms?.find((r: any) => r._id === activeRoom)
    const res = await Taro.showModal({
      title: '删除房间',
      content: `确认删除「${currentRoom?.name}」及其所有容器？`,
    })
    if (res.confirm) {
      await deleteRoom(spaceId, activeRoom)
      setActiveRoom('')
      loadSpace()
    }
  }

  async function handleShare() {
    Taro.showLoading({ title: '生成分享...' })
    try {
      const token = await createShareLink(spaceId)
      Taro.hideLoading()
      Taro.showModal({
        title: '分享成功',
        content: `分享码：${token}\n\n也可以点击右上角菜单发送给好友`,
        showCancel: false,
      })
    } catch (e) {
      Taro.hideLoading()
      Taro.showToast({ title: '分享失败', icon: 'none' })
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
      <View className='page-header'>
        <Text className='page-title'>{space.name}</Text>
        <Text className='share-btn' onClick={handleShare}>分享</Text>
      </View>

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
          <Text className='delete-room-btn' onClick={handleDeleteRoom}>删除此房间</Text>
        </View>
      ) : (
        <View className='empty'>
          <Text>请先添加房间</Text>
        </View>
      )}
    </View>
  )
}
