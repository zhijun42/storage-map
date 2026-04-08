import { View, Text, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpaces, getSpace, addRoom, addContainer, updateContainer, uploadPhoto } from '../../services/space'
import './index.scss'

type Step = 'room' | 'container' | 'slot' | 'capture'

export default function CapturePage() {
  const [spaces, setSpaces] = useState<any[]>([])
  const [space, setSpace] = useState<any>(null)
  const [step, setStep] = useState<Step>('room')

  // Selected position
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [selectedContainer, setSelectedContainer] = useState<any>(null)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0)

  // Capture state
  const [photoPath, setPhotoPath] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const list = await getSpaces()
    setSpaces(list)
    if (list.length > 0) {
      const full = await getSpace(list[0]._id)
      setSpace(full)
    }
  }

  async function handleSelectRoom(room: any) {
    setSelectedRoom(room)
    setSelectedContainer(null)
    setSelectedSlotIndex(0)
    setStep('container')
  }

  async function handleNewRoom() {
    if (!space) return
    const res = await Taro.showModal({
      title: '新建房间',
      editable: true,
      placeholderText: '房间名称',
    } as any)
    if (res.confirm && (res as any).content) {
      await addRoom(space._id, (res as any).content)
      const full = await getSpace(space._id)
      setSpace(full)
    }
  }

  async function handleSelectContainer(container: any) {
    setSelectedContainer(container)
    setSelectedSlotIndex(0)
    setStep('slot')
  }

  async function handleNewContainer() {
    if (!space || !selectedRoom) return
    const res = await Taro.showModal({
      title: '新建容器',
      editable: true,
      placeholderText: '容器名称（如：衣柜、书架）',
    } as any)
    if (res.confirm && (res as any).content) {
      await addContainer(space._id, selectedRoom._id, {
        name: (res as any).content,
        type: 'custom',
        movable: false,
        slots: [{ label: '第1层', type: 'shelf', items: '', photo: '' }],
      })
      const full = await getSpace(space._id)
      setSpace(full)
      const updatedRoom = full?.rooms?.find((r: any) => r._id === selectedRoom._id)
      if (updatedRoom) setSelectedRoom(updatedRoom)
    }
  }

  function handleSelectSlot(index: number) {
    setSelectedSlotIndex(index)
    setStep('capture')
    setPhotoPath('')
    setItemsText('')
  }

  async function handleNewSlot() {
    if (!space || !selectedRoom || !selectedContainer) return
    const res = await Taro.showModal({
      title: '新建分层',
      editable: true,
      placeholderText: '分层名称（如：第2层、上层）',
    } as any)
    if (res.confirm && (res as any).content) {
      const updatedSlots = [
        ...selectedContainer.slots,
        { label: (res as any).content, type: 'shelf', items: '', photo: '' },
      ]
      await updateContainer(space._id, selectedRoom._id, selectedContainer._id, { slots: updatedSlots })
      const full = await getSpace(space._id)
      setSpace(full)
      const updatedRoom = full?.rooms?.find((r: any) => r._id === selectedRoom._id)
      if (updatedRoom) {
        setSelectedRoom(updatedRoom)
        const updatedC = updatedRoom.containers?.find((c: any) => c._id === selectedContainer._id)
        if (updatedC) setSelectedContainer(updatedC)
      }
    }
  }

  async function handleTakePhoto() {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        sizeType: ['compressed'],
      })
      if (res.tempFiles?.length > 0) {
        setPhotoPath(res.tempFiles[0].tempFilePath)
      }
    } catch {
      // cancelled
    }
  }

  async function handleSave() {
    if (!space || !selectedRoom || !selectedContainer) return
    setSaving(true)

    const updatedSlots = [...selectedContainer.slots]
    const slot = updatedSlots[selectedSlotIndex]

    // Append items
    if (itemsText.trim()) {
      slot.items = slot.items
        ? `${slot.items}、${itemsText.trim()}`
        : itemsText.trim()
    }

    // Upload photo
    if (photoPath) {
      Taro.showLoading({ title: '上传照片...' })
      const cloudUrl = await uploadPhoto(photoPath, selectedContainer._id, selectedSlotIndex)
      Taro.hideLoading()
      slot.photo = cloudUrl
    }

    updatedSlots[selectedSlotIndex] = slot
    await updateContainer(space._id, selectedRoom._id, selectedContainer._id, { slots: updatedSlots })

    // Refresh data
    const full = await getSpace(space._id)
    setSpace(full)
    const updatedRoom = full?.rooms?.find((r: any) => r._id === selectedRoom._id)
    if (updatedRoom) {
      setSelectedRoom(updatedRoom)
      const updatedC = updatedRoom.containers?.find((c: any) => c._id === selectedContainer._id)
      if (updatedC) setSelectedContainer(updatedC)
    }

    setSaving(false)
    setSavedCount(savedCount + 1)
    setPhotoPath('')
    setItemsText('')

    Taro.showToast({
      title: '已保存',
      icon: 'success',
      duration: 1500,
    })
  }

  // Breadcrumb
  const breadcrumb = [
    selectedRoom?.name,
    selectedContainer?.name,
    selectedContainer?.slots?.[selectedSlotIndex]?.label,
  ].filter(Boolean).join(' > ')

  return (
    <View className='capture-page'>
      {/* Breadcrumb */}
      {breadcrumb && (
        <View className='breadcrumb' onClick={() => setStep('room')}>
          <Text className='breadcrumb-text'>{breadcrumb}</Text>
          <Text className='breadcrumb-change'>切换</Text>
        </View>
      )}

      {/* Step: Select Room */}
      {step === 'room' && (
        <View className='step-section'>
          <Text className='step-title'>选择房间</Text>
          <View className='option-list'>
            {space?.rooms?.map((room: any) => (
              <View
                key={room._id}
                className={`option-item ${selectedRoom?._id === room._id ? 'active' : ''}`}
                onClick={() => handleSelectRoom(room)}
              >
                <Text className='option-name'>{room.name}</Text>
                <Text className='option-info'>{room.containers?.length || 0} 个容器</Text>
              </View>
            ))}
            <View className='option-item add' onClick={handleNewRoom}>
              <Text className='option-name'>+ 新建房间</Text>
            </View>
          </View>
        </View>
      )}

      {/* Step: Select Container */}
      {step === 'container' && (
        <View className='step-section'>
          <Text className='step-title'>选择容器</Text>
          <View className='option-list'>
            {selectedRoom?.containers?.map((container: any) => (
              <View
                key={container._id}
                className={`option-item ${selectedContainer?._id === container._id ? 'active' : ''}`}
                onClick={() => handleSelectContainer(container)}
              >
                <Text className='option-name'>{container.name}</Text>
                <Text className='option-info'>{container.slots?.length || 0} 层</Text>
              </View>
            ))}
            <View className='option-item add' onClick={handleNewContainer}>
              <Text className='option-name'>+ 新建容器</Text>
            </View>
          </View>
          <View className='nav-back' onClick={() => setStep('room')}>
            <Text className='nav-back-text'>← 返回选择房间</Text>
          </View>
        </View>
      )}

      {/* Step: Select Slot */}
      {step === 'slot' && (
        <View className='step-section'>
          <Text className='step-title'>选择分层</Text>
          <View className='option-list'>
            {selectedContainer?.slots?.map((slot: any, i: number) => (
              <View
                key={i}
                className={`option-item ${selectedSlotIndex === i && step === 'slot' ? 'active' : ''}`}
                onClick={() => handleSelectSlot(i)}
              >
                <Text className='option-name'>{slot.label}</Text>
                <Text className='option-info'>{slot.items ? '有物品' : '空'}</Text>
              </View>
            ))}
            <View className='option-item add' onClick={handleNewSlot}>
              <Text className='option-name'>+ 新建分层</Text>
            </View>
          </View>
          <View className='nav-back' onClick={() => setStep('container')}>
            <Text className='nav-back-text'>← 返回选择容器</Text>
          </View>
        </View>
      )}

      {/* Step: Capture */}
      {step === 'capture' && (
        <View className='capture-section'>
          {/* Photo area */}
          <View className='photo-area' onClick={handleTakePhoto}>
            {photoPath ? (
              <Image className='photo-preview' src={photoPath} mode='aspectFill' />
            ) : (
              <View className='photo-placeholder'>
                <Text className='camera-icon'>📷</Text>
                <Text className='photo-hint'>点击拍照</Text>
              </View>
            )}
          </View>

          {/* Items input */}
          <View className='input-section'>
            <Text className='input-label'>物品描述</Text>
            <View className='input-wrap'>
              <Input
                className='items-input'
                placeholder='输入物品（如：T恤×15、短裤×8）'
                value={itemsText}
                onInput={(e) => setItemsText(e.detail.value)}
                adjustPosition
              />
            </View>
          </View>

          {/* Save button */}
          <View
            className={`save-btn ${(!photoPath && !itemsText.trim()) ? 'disabled' : ''}`}
            onClick={handleSave}
          >
            <Text className='save-btn-text'>{saving ? '保存中...' : '保存'}</Text>
          </View>

          {/* Quick nav */}
          <View className='quick-nav'>
            <View className='nav-back' onClick={() => setStep('slot')}>
              <Text className='nav-back-text'>← 切换分层</Text>
            </View>
            {savedCount > 0 && (
              <Text className='saved-count'>本次已保存 {savedCount} 条</Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
