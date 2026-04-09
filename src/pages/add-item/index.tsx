import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { getSpace, updateContainer, uploadPhoto } from '../../services/space'
import { normalizeItems, serializeItems, CATEGORIES } from '../../services/items'
import './index.scss'

export default function AddItemPage() {
  const router = useRouter()
  const { spaceId = '', roomId = '', containerId = '', slotIndex: slotIndexStr = '0' } = router.params
  const slotIndex = Number(slotIndexStr)

  const [name, setName] = useState('')
  const [categoryIndex, setCategoryIndex] = useState(-1)
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  async function handleChoosePhoto() {
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
    if (!name.trim()) {
      Taro.showToast({ title: '请输入物品名称', icon: 'none' })
      return
    }
    if (categoryIndex < 0) {
      Taro.showToast({ title: '请选择物品类型', icon: 'none' })
      return
    }

    setSaving(true)
    const space = await getSpace(spaceId)
    if (!space) { setSaving(false); return }
    const room = space.rooms?.find((r: any) => r._id === roomId)
    if (!room) { setSaving(false); return }
    const container = room.containers?.find((c: any) => c._id === containerId)
    if (!container) { setSaving(false); return }

    let photoUrl = ''
    if (photoPath) {
      try {
        Taro.showLoading({ title: '上传照片...' })
        photoUrl = await uploadPhoto(photoPath, containerId, slotIndex)
        Taro.hideLoading()
      } catch {
        Taro.hideLoading()
      }
    }

    const updatedSlots = [...container.slots]
    const items = normalizeItems(updatedSlots[slotIndex].items)
    items.push({
      name: name.trim(),
      category: CATEGORIES[categoryIndex],
      price: price.trim() || '',
      createdAt: today,
      photo: photoUrl,
      notes: notes.trim(),
    })
    updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items: serializeItems(items) }
    await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })

    setSaving(false)
    Taro.showToast({ title: '已添加', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 800)
  }

  return (
    <View className='add-item-page'>
      {/* Photo */}
      <View className='photo-section' onClick={handleChoosePhoto}>
        {photoPath ? (
          <Image className='photo-preview' src={photoPath} mode='aspectFill' />
        ) : (
          <View className='photo-placeholder'>
            <Text className='photo-icon'>📷</Text>
            <Text className='photo-hint'>拍照 / 从相册选择</Text>
          </View>
        )}
        {photoPath && <Text className='photo-change'>重新选择</Text>}
      </View>

      <View className='form'>
        {/* Name — required */}
        <View className='field'>
          <Text className='label'>物品名称 *</Text>
          <View className='input-wrap'>
            <Input className='field-input' placeholder='请输入名称' value={name} onInput={e => setName(e.detail.value)} />
          </View>
        </View>

        {/* Category — required */}
        <View className='field'>
          <Text className='label'>物品类型 *</Text>
          <View className='category-grid'>
            {CATEGORIES.map((cat, i) => (
              <Text
                key={cat}
                className={`category-tag ${categoryIndex === i ? 'selected' : ''}`}
                onClick={() => setCategoryIndex(i)}
              >{cat}</Text>
            ))}
          </View>
        </View>

        {/* Price — optional */}
        <View className='field'>
          <Text className='label'>价格（选填）</Text>
          <View className='input-wrap'>
            <Input className='field-input' type='digit' placeholder='¥' value={price} onInput={e => setPrice(e.detail.value)} />
          </View>
        </View>

        {/* Date — auto, hidden from UI */}
        <View className='field' style={{ display: 'none' }}>
          <View className='input-wrap readonly'>
            <Text className='field-value'>{today}</Text>
          </View>
        </View>

        {/* Notes — optional */}
        <View className='field'>
          <Text className='label'>备注（选填）</Text>
          <View className='input-wrap'>
            <Input className='field-input' placeholder='如：户外专用、夏天使用' value={notes} onInput={e => setNotes(e.detail.value)} />
          </View>
        </View>
      </View>

      <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={handleSave}>
        <Text className='save-btn-text'>{saving ? '保存中...' : '添加物品'}</Text>
      </View>
    </View>
  )
}
