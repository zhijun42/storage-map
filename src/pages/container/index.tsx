import { View, Text, Input, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, updateContainer } from '../../services/space'
import './index.scss'

export default function ContainerPage() {
  const router = useRouter()
  const { spaceId = '', roomId = '', containerId = '' } = router.params
  const [container, setContainer] = useState<any>(null)

  useEffect(() => { loadContainer() }, [])

  async function loadContainer() {
    const space = await getSpace(spaceId)
    if (!space) return
    const room = space.rooms?.find((r: any) => r._id === roomId)
    if (!room) return
    const c = room.containers?.find((c: any) => c._id === containerId)
    setContainer(c || null)
  }

  async function handleUpdateSlotItems(slotIndex: number, items: string) {
    if (!container) return
    const updatedSlots = [...container.slots]
    updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items }
    setContainer({ ...container, slots: updatedSlots })
    await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })
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
      setContainer({ ...container, slots: updatedSlots })
      await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })
    }
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
        // TODO: 上传到云存储，目前先用本地路径
        const updatedSlots = [...container.slots]
        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], photo: photoPath }
        setContainer({ ...container, slots: updatedSlots })
        await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })
      }
    } catch (e) {
      console.log('取消拍照')
    }
  }

  if (!container) return <View className='loading'><Text>加载中...</Text></View>

  return (
    <View className='container-page'>
      <Text className='page-title'>{container.name}</Text>
      <Text className='page-subtitle'>
        {container.type === 'wardrobe' ? '衣柜' :
         container.type === 'cabinet' ? '柜子' :
         container.type === 'shelf' ? '书架' : '容器'}
        {container.movable ? ' · 可移动' : ''}
      </Text>

      <View className='slots'>
        {container.slots?.map((slot: any, index: number) => (
          <View key={index} className='slot-card'>
            <View className='slot-header'>
              <Text className='slot-label'>{slot.label}</Text>
              <Text className='photo-btn' onClick={() => handleTakePhoto(index)}>
                {slot.photo ? '更换照片' : '拍照'}
              </Text>
            </View>

            {slot.photo && (
              <Image className='slot-photo' src={slot.photo} mode='aspectFill' />
            )}

            <Input
              className='slot-input'
              placeholder='输入物品描述（如：T恤×15、短裤×8）'
              value={slot.items}
              onBlur={(e) => handleUpdateSlotItems(index, e.detail.value)}
            />
          </View>
        ))}
      </View>

      <Button className='add-slot-btn' onClick={handleAddSlot}>
        + 添加分层
      </Button>
    </View>
  )
}
