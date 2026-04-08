import { View, Text, Input, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, updateContainer, uploadPhoto, deleteContainer } from '../../services/space'
import './index.scss'

export default function ContainerPage() {
  const router = useRouter()
  const { spaceId = '', roomId = '', containerId = '' } = router.params
  const [container, setContainer] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadContainer() }, [])

  async function loadContainer() {
    const space = await getSpace(spaceId)
    if (!space) return
    const room = space.rooms?.find((r: any) => r._id === roomId)
    if (!room) return
    const c = room.containers?.find((c: any) => c._id === containerId)
    setContainer(c || null)
  }

  async function saveSlots(updatedSlots: any[]) {
    setSaving(true)
    setContainer((prev: any) => ({ ...prev, slots: updatedSlots }))
    await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })
    setSaving(false)
  }

  async function handleUpdateSlotItems(slotIndex: number, items: string) {
    if (!container) return
    const updatedSlots = [...container.slots]
    updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items }
    await saveSlots(updatedSlots)
  }

  async function handleAddSlot() {
    if (!container) return
    const res = await Taro.showModal({
      title: '添加分层',
      editable: true,
      placeholderText: '分层名称（如：第2层、上层抽屉）',
    })
    if (res.confirm && res.content) {
      const updatedSlots = [...container.slots, { label: res.content, type: 'shelf', items: '', photo: '' }]
      await saveSlots(updatedSlots)
    }
  }

  async function handleDeleteSlot(slotIndex: number) {
    if (!container || container.slots.length <= 1) {
      Taro.showToast({ title: '至少保留一层', icon: 'none' })
      return
    }
    const res = await Taro.showModal({
      title: '删除分层',
      content: `确认删除「${container.slots[slotIndex].label}」？`,
    })
    if (res.confirm) {
      const updatedSlots = container.slots.filter((_: any, i: number) => i !== slotIndex)
      await saveSlots(updatedSlots)
    }
  }

  async function handleMoveSlot(slotIndex: number, direction: 'up' | 'down') {
    if (!container) return
    const targetIndex = direction === 'up' ? slotIndex - 1 : slotIndex + 1
    if (targetIndex < 0 || targetIndex >= container.slots.length) return
    const updatedSlots = [...container.slots]
    const temp = updatedSlots[slotIndex]
    updatedSlots[slotIndex] = updatedSlots[targetIndex]
    updatedSlots[targetIndex] = temp
    await saveSlots(updatedSlots)
  }

  async function handleTakePhoto(slotIndex: number) {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        sizeType: ['compressed'],
      })
      if (res.tempFiles?.length > 0) {
        const photoPath = res.tempFiles[0].tempFilePath
        Taro.showLoading({ title: '上传中...' })
        const cloudUrl = await uploadPhoto(photoPath, containerId, slotIndex)
        Taro.hideLoading()
        const updatedSlots = [...container.slots]
        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], photo: cloudUrl }
        await saveSlots(updatedSlots)
      }
    } catch (e) {
      Taro.hideLoading()
      console.log('取消拍照')
    }
  }

  async function handleDeleteContainer() {
    const res = await Taro.showModal({
      title: '删除容器',
      content: `确认删除「${container.name}」及其所有分层数据？`,
    })
    if (res.confirm) {
      await deleteContainer(spaceId, roomId, containerId)
      Taro.navigateBack()
    }
  }

  async function handleRenameSlot(slotIndex: number) {
    const res = await Taro.showModal({
      title: '重命名分层',
      editable: true,
      placeholderText: container.slots[slotIndex].label,
    })
    if (res.confirm && res.content) {
      const updatedSlots = [...container.slots]
      updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], label: res.content }
      await saveSlots(updatedSlots)
    }
  }

  if (!container) return <View className='loading'><Text>加载中...</Text></View>

  return (
    <View className='container-page'>
      <View className='page-header'>
        <View>
          <Text className='page-title'>{container.name}</Text>
          <Text className='page-subtitle'>
            {container.type === 'wardrobe' ? '衣柜' :
             container.type === 'cabinet' ? '柜子' :
             container.type === 'shelf' ? '书架' : '容器'}
            {container.movable ? ' · 可移动' : ''}
            {saving ? ' · 保存中...' : ''}
          </Text>
        </View>
        <Text className='delete-container-btn' onClick={handleDeleteContainer}>删除</Text>
      </View>

      <View className='slots'>
        {container.slots?.map((slot: any, index: number) => (
          <View key={index} className='slot-card'>
            <View className='slot-header'>
              <Text className='slot-label' onClick={() => handleRenameSlot(index)}>{slot.label}</Text>
              <View className='slot-actions'>
                {index > 0 && (
                  <Text className='action-btn' onClick={() => handleMoveSlot(index, 'up')}>↑</Text>
                )}
                {index < container.slots.length - 1 && (
                  <Text className='action-btn' onClick={() => handleMoveSlot(index, 'down')}>↓</Text>
                )}
                <Text className='action-btn photo' onClick={() => handleTakePhoto(index)}>
                  {slot.photo ? '换图' : '拍照'}
                </Text>
                <Text className='action-btn delete' onClick={() => handleDeleteSlot(index)}>删除</Text>
              </View>
            </View>

            {slot.photo && (
              <Image className='slot-photo' src={slot.photo} mode='aspectFill' />
            )}

            <View className='slot-input-wrap'>
              <Input
                className='slot-input'
                placeholder='输入物品'
                value={slot.items}
                onBlur={(e) => handleUpdateSlotItems(index, e.detail.value)}
                adjustPosition
              />
            </View>
          </View>
        ))}
      </View>

      <Button className='add-slot-btn' onClick={handleAddSlot}>
        + 添加分层
      </Button>
    </View>
  )
}
