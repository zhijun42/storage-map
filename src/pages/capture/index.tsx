import { View, Text, Input, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpaces, getSpace, updateContainer, uploadPhoto } from '../../services/space'
import { normalizeItems, serializeItems, CATEGORIES } from '../../services/items'
import './index.scss'

export default function CapturePage() {
  const [space, setSpace] = useState<any>(null)

  // Form fields
  const [name, setName] = useState('')
  const [categoryIndex, setCategoryIndex] = useState(-1)
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [photoPath, setPhotoPath] = useState('')

  // Location selection
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(-1)
  const [containers, setContainers] = useState<any[]>([])
  const [selectedContainerIndex, setSelectedContainerIndex] = useState(-1)
  const [slotLabels, setSlotLabels] = useState<string[]>([])
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(-1)

  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const list = await getSpaces()
    if (list.length > 0) {
      const full = await getSpace(list[0]._id)
      setSpace(full)
      if (full?.rooms) {
        setRooms(full.rooms)
      }
    }
  }

  function handleRoomChange(index: number) {
    setSelectedRoomIndex(index)
    setSelectedContainerIndex(-1)
    setSelectedSlotIndex(-1)
    const room = rooms[index]
    setContainers(room?.containers || [])
    setSlotLabels([])
  }

  function handleContainerChange(index: number) {
    setSelectedContainerIndex(index)
    setSelectedSlotIndex(-1)
    const container = containers[index]
    setSlotLabels(container?.slots?.map((s: any) => s.label) || [])
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
    } catch {}
  }

  async function handleSave() {
    if (!name.trim()) { Taro.showToast({ title: '请输入物品名称', icon: 'none' }); return }
    if (categoryIndex < 0) { Taro.showToast({ title: '请选择物品类型', icon: 'none' }); return }
    if (selectedRoomIndex < 0 || selectedContainerIndex < 0 || selectedSlotIndex < 0) {
      Taro.showToast({ title: '请选择存放位置', icon: 'none' }); return
    }

    setSaving(true)
    const room = rooms[selectedRoomIndex]
    const container = containers[selectedContainerIndex]

    let uploadedPhoto = ''
    if (photoPath) {
      Taro.showLoading({ title: '上传照片...' })
      uploadedPhoto = await uploadPhoto(photoPath, container._id, selectedSlotIndex)
      Taro.hideLoading()
    }

    const updatedSlots = [...container.slots]
    const items = normalizeItems(updatedSlots[selectedSlotIndex].items)
    items.push({
      name: name.trim(),
      category: CATEGORIES[categoryIndex],
      price: price.trim() || '',
      createdAt: today,
      photo: uploadedPhoto,
      notes: notes.trim(),
    })
    updatedSlots[selectedSlotIndex] = { ...updatedSlots[selectedSlotIndex], items: serializeItems(items) }
    await updateContainer(space._id, room._id, container._id, { slots: updatedSlots })

    setSaving(false)
    setSavedCount(savedCount + 1)

    // Reset form but keep location
    setName('')
    setPrice('')
    setNotes('')
    setPhotoPath('')
    setCategoryIndex(-1)

    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  return (
    <View className='capture-page'>
      <View className='form'>
        {/* Name */}
        <View className='field'>
          <Text className='label'>物品名称 *</Text>
          <View className='input-wrap'>
            <Input className='field-input' placeholder='请输入名称' value={name} onInput={e => setName(e.detail.value)} />
          </View>
        </View>

        {/* Category */}
        <View className='field'>
          <Text className='label'>物品类型 *</Text>
          <Picker mode='selector' range={CATEGORIES} onChange={e => setCategoryIndex(Number(e.detail.value))}>
            <View className='picker-wrap'>
              <Text className={categoryIndex >= 0 ? 'picker-text' : 'picker-text placeholder'}>
                {categoryIndex >= 0 ? CATEGORIES[categoryIndex] : '请选择类型'}
              </Text>
              <Text className='picker-arrow'>▾</Text>
            </View>
          </Picker>
        </View>

        {/* Price */}
        <View className='field'>
          <Text className='label'>价格（选填）</Text>
          <View className='input-wrap'>
            <Input className='field-input' type='digit' placeholder='¥' value={price} onInput={e => setPrice(e.detail.value)} />
          </View>
        </View>

        {/* Date */}
        <View className='field'>
          <Text className='label'>录入日期</Text>
          <View className='input-wrap readonly'>
            <Text className='field-value'>{today}</Text>
          </View>
        </View>

        {/* Notes */}
        <View className='field'>
          <Text className='label'>备注（选填）</Text>
          <View className='input-wrap'>
            <Input className='field-input' placeholder='如：户外专用' value={notes} onInput={e => setNotes(e.detail.value)} />
          </View>
        </View>

        {/* Photo */}
        <View className='field'>
          <Text className='label'>照片（选填）</Text>
          <View className='photo-area' onClick={handleTakePhoto}>
            {photoPath ? (
              <Image className='photo-preview' src={photoPath} mode='aspectFill' />
            ) : (
              <View className='photo-placeholder'>
                <Text className='camera-text'>点击拍照或选择图片</Text>
              </View>
            )}
          </View>
        </View>

        {/* Location selection */}
        <View className='field'>
          <Text className='label'>存放位置 *</Text>
          <View className='location-pickers'>
            <Picker mode='selector' range={rooms.map((r: any) => r.name)} onChange={e => handleRoomChange(Number(e.detail.value))}>
              <View className='picker-wrap small'>
                <Text className={selectedRoomIndex >= 0 ? 'picker-text' : 'picker-text placeholder'}>
                  {selectedRoomIndex >= 0 ? rooms[selectedRoomIndex].name : '房间'}
                </Text>
              </View>
            </Picker>
            <Text className='sep'>›</Text>
            <Picker mode='selector' range={containers.map((c: any) => c.name)} onChange={e => handleContainerChange(Number(e.detail.value))}>
              <View className='picker-wrap small'>
                <Text className={selectedContainerIndex >= 0 ? 'picker-text' : 'picker-text placeholder'}>
                  {selectedContainerIndex >= 0 ? containers[selectedContainerIndex].name : '容器'}
                </Text>
              </View>
            </Picker>
            <Text className='sep'>›</Text>
            <Picker mode='selector' range={slotLabels} onChange={e => setSelectedSlotIndex(Number(e.detail.value))}>
              <View className='picker-wrap small'>
                <Text className={selectedSlotIndex >= 0 ? 'picker-text' : 'picker-text placeholder'}>
                  {selectedSlotIndex >= 0 ? slotLabels[selectedSlotIndex] : '分层'}
                </Text>
              </View>
            </Picker>
          </View>
        </View>
      </View>

      <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={handleSave}>
        <Text className='save-btn-text'>{saving ? '保存中...' : '录入物品'}</Text>
      </View>

      {savedCount > 0 && (
        <Text className='saved-count'>本次已录入 {savedCount} 件物品</Text>
      )}
    </View>
  )
}
