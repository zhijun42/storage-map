import { View, Text, Input, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpaces, getSpace, updateContainer, uploadPhoto } from '../../services/space'
import FloorplanView from '../../components/FloorplanView'
import IsometricView from '../../components/IsometricView'
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

  // Smart recommendation
  const [recommendation, setRecommendation] = useState<{
    roomIndex: number; containerIndex: number; slotIndex: number
    roomName: string; containerName: string; slotLabel: string; reason: string
  } | null>(null)

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

  // Smart recommend: find best slot for a given category
  function recommendForCategory(catIdx: number) {
    if (catIdx < 0 || rooms.length === 0) { setRecommendation(null); return }
    const cat = CATEGORIES[catIdx]
    let bestScore = -1
    let best: typeof recommendation = null

    rooms.forEach((room: any, ri: number) => {
      room.containers?.forEach((container: any, ci: number) => {
        container.slots?.forEach((slot: any, si: number) => {
          let score = 0
          // Slot categories match (from draw-editor labels)
          const slotCats: string[] = slot.categories || []
          if (slotCats.includes(cat)) score += 10
          // Slot label contains category name
          if ((slot.label || '').includes(cat)) score += 5
          // Existing items of same category
          const items = normalizeItems(slot.items)
          const sameCatCount = items.filter((i: any) => i.category === cat).length
          score += sameCatCount * 2
          // Fewer total items = more space available
          if (items.length < 5) score += 2
          if (items.length === 0) score += 1

          if (score > bestScore) {
            bestScore = score
            best = {
              roomIndex: ri, containerIndex: ci, slotIndex: si,
              roomName: room.name, containerName: container.name,
              slotLabel: slot.label || `格${si + 1}`,
              reason: slotCats.includes(cat) ? `该隔间标记为「${cat}」类`
                : sameCatCount > 0 ? `已有 ${sameCatCount} 件同类物品`
                : '该位置空间较充裕',
            }
          }
        })
      })
    })

    setRecommendation(bestScore > 0 ? best : null)
  }

  function acceptRecommendation() {
    if (!recommendation) return
    handleRoomChange(recommendation.roomIndex)
    setTimeout(() => {
      handleContainerChange(recommendation.containerIndex)
      setTimeout(() => {
        setSelectedSlotIndex(recommendation.slotIndex)
      }, 50)
    }, 50)
  }

  function handleCategoryChange(idx: number) {
    setCategoryIndex(idx)
    recommendForCategory(idx)
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
          <Picker mode='selector' range={CATEGORIES} onChange={e => handleCategoryChange(Number(e.detail.value))}>
            <View className='picker-wrap'>
              <Text className={categoryIndex >= 0 ? 'picker-text' : 'picker-text placeholder'}>
                {categoryIndex >= 0 ? CATEGORIES[categoryIndex] : '请选择类型'}
              </Text>
              <Text className='picker-arrow'>▾</Text>
            </View>
          </Picker>

          {/* Smart recommendation */}
          {recommendation && selectedSlotIndex < 0 && (
            <View className='recommend-banner' onClick={acceptRecommendation}>
              <View className='recommend-info'>
                <Text className='recommend-title'>推荐位置</Text>
                <Text className='recommend-loc'>
                  {recommendation.roomName} › {recommendation.containerName} › {recommendation.slotLabel}
                </Text>
                <Text className='recommend-reason'>{recommendation.reason}</Text>
              </View>
              <Text className='recommend-action'>采纳</Text>
            </View>
          )}
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

        {/* Location selection — visual */}
        <View className='field'>
          <Text className='label'>存放位置 * — 点击平面图选择容器</Text>
          {rooms.length > 0 && (
            <View className='map-picker'>
              <FloorplanView
                rooms={rooms}
                spaceId={space?._id}
                compact
                highlightContainerId={selectedContainerIndex >= 0 ? containers[selectedContainerIndex]?._id : null}
                onContainerClick={(roomId, containerId) => {
                  const ri = rooms.findIndex((r: any) => r._id === roomId)
                  if (ri >= 0) {
                    handleRoomChange(ri)
                    const ci = rooms[ri].containers?.findIndex((c: any) => c._id === containerId) ?? -1
                    if (ci >= 0) handleContainerChange(ci)
                  }
                }}
              />
            </View>
          )}
          {/* Selected location display */}
          {selectedContainerIndex >= 0 && (
            <View className='selected-location'>
              <Text className='loc-text'>
                {rooms[selectedRoomIndex]?.name} › {containers[selectedContainerIndex]?.name}
              </Text>
            </View>
          )}
          {/* Slot picker via IsometricView */}
          {selectedContainerIndex >= 0 && containers[selectedContainerIndex]?.slots && (
            <View className='slot-picker'>
              <Text className='label'>点击选择分层</Text>
              <IsometricView
                containerName={containers[selectedContainerIndex].name}
                slots={containers[selectedContainerIndex].slots}
                highlightSlotIndex={selectedSlotIndex >= 0 ? selectedSlotIndex : null}
                onSlotClick={(i) => setSelectedSlotIndex(i)}
              />
            </View>
          )}
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
