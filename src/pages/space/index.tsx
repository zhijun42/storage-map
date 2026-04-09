import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, addRoom, addContainer, deleteRoom, createShareLink, getShareStatus, revokeShare } from '../../services/space'
import { normalizeItems } from '../../services/items'
import './index.scss'

export default function SpacePage() {
  const router = useRouter()
  const spaceId = router.params.id || ''
  const [space, setSpace] = useState<any>(null)
  const [activeRoom, setActiveRoom] = useState<string>('')
  const [shareStatus, setShareStatus] = useState<any>(null)

  useEffect(() => { loadSpace() }, [])
  useDidShow(() => { loadSpace() })

  useShareAppMessage(() => ({
    title: space ? `${space.name} - 收纳地图` : '收纳地图',
    path: shareStatus?.token
      ? `/pages/index/index?shareToken=${shareStatus.token}`
      : `/pages/space/index?id=${spaceId}`,
  }))

  async function loadSpace() {
    const data = await getSpace(spaceId)
    setSpace(data)
    if (data?.rooms?.length > 0 && !activeRoom) {
      setActiveRoom(data.rooms[0]._id)
    }
    loadShareStatus()
  }

  async function loadShareStatus() {
    try {
      const status = await getShareStatus(spaceId)
      setShareStatus(status)
    } catch {}
  }

  async function handleAddRoom() {
    const res = await Taro.showModal({
      title: '添加房间',
      editable: true,
      placeholderText: '房间名称（如：卧室、客厅）',
    } as any)
    if (res.confirm && (res as any).content) {
      const room = await addRoom(spaceId, (res as any).content)
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
    } as any)
    if (res.confirm && (res as any).content) {
      await addContainer(spaceId, activeRoom, {
        name: (res as any).content,
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
    if (shareStatus?.shared) {
      const res = await Taro.showModal({
        title: '分享管理',
        content: shareStatus.claimedBy
          ? `已有住户绑定此空间。\n\n分享码：${shareStatus.token}\n\n是否撤销分享？`
          : `分享码：${shareStatus.token}\n\n等待住户扫码绑定中...\n\n是否撤销分享？`,
        confirmText: '撤销',
        confirmColor: '#e53e3e',
        cancelText: '关闭',
      })
      if (res.confirm) {
        await revokeShare(spaceId)
        Taro.showToast({ title: '已撤销', icon: 'success' })
        setShareStatus({ success: true, shared: false })
      }
      return
    }

    Taro.showLoading({ title: '生成分享...' })
    try {
      const token = await createShareLink(spaceId)
      Taro.hideLoading()
      Taro.showModal({
        title: '分享成功',
        content: `分享码：${token}\n\n将此码发送给住户，住户首次打开后自动绑定，其他人无法使用。\n\n也可以点击右上角菜单发送给好友。`,
        showCancel: false,
      })
      loadShareStatus()
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
        <Text className='share-btn' onClick={handleShare}>
          {shareStatus?.shared ? (shareStatus.claimedBy ? '已分享' : '待绑定') : '分享给住户'}
        </Text>
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
              {container.slots?.map((slot: any, i: number) => {
                const items = normalizeItems(slot.items)
                const summary = items.length > 0 ? items.map(it => it.name).join('、') : '(空)'
                return (
                  <View key={i} className='slot-preview'>
                    <Text className='slot-label'>{slot.label}:</Text>
                    <Text className='slot-items'>{summary}</Text>
                  </View>
                )
              })}
            </View>
          ))}

          <View className='action-row'>
            <Button className='add-btn' onClick={handleAddContainer}>
              + 添加容器
            </Button>
            <Button className='capture-btn' onClick={() => Taro.navigateTo({ url: '/pages/capture/index' })}>
              拍照录入
            </Button>
          </View>
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
