import { View, Text, Input, Button, Image, Textarea } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getSpace, updateContainer, uploadPhoto, deleteContainer } from '../../services/space'
import { normalizeItems, serializeItems, Item, CATEGORIES } from '../../services/items'
import IsometricView from '../../components/IsometricView'
import './index.scss'

export default function ContainerPage() {
  const router = useRouter()
  const { spaceId = '', roomId = '', containerId = '', searchQuery = '', highlightSlot = '' } = router.params
  const [container, setContainer] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Item>>({})
  const [batchSlot, setBatchSlot] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const decodedQuery = searchQuery ? decodeURIComponent(searchQuery) : ''

  useEffect(() => { loadContainer() }, [])
  useDidShow(() => { loadContainer(); setExpandedItem(null); setEditValues({}); setBatchSlot(null); setSelectedItems(new Set()) })

  async function loadContainer() {
    const space = await getSpace(spaceId)
    if (!space) return
    const room = space.rooms?.find((r: any) => r._id === roomId)
    if (!room) return
    const c = room.containers?.find((c: any) => c._id === containerId)
    setContainer(c || null)
    // Auto-select slot from search highlight
    if (highlightSlot && c?.slots) {
      const idx = c.slots.findIndex((s: any) => s.label === highlightSlot)
      if (idx >= 0) setSelectedSlot(idx)
    }
  }

  async function saveSlots(updatedSlots: any[]) {
    setSaving(true)
    setContainer((prev: any) => ({ ...prev, slots: updatedSlots }))
    await updateContainer(spaceId, roomId, containerId, { slots: updatedSlots })
    setSaving(false)
  }

  // Item operations
  function handleAddItem(slotIndex: number) {
    Taro.navigateTo({
      url: `/pages/add-item/index?spaceId=${spaceId}&roomId=${roomId}&containerId=${containerId}&slotIndex=${slotIndex}`,
    })
  }

  function toggleExpandItem(slotIndex: number, itemIndex: number) {
    const key = `${slotIndex}-${itemIndex}`
    if (expandedItem === key) {
      setExpandedItem(null)
      setEditValues({})
    } else {
      const items = normalizeItems(container.slots[slotIndex].items)
      setEditValues({ ...items[itemIndex] })
      setExpandedItem(key)
    }
  }

  function handleEditInput(field: keyof Item, value: string) {
    setEditValues(prev => ({ ...prev, [field]: value }))
  }

  async function handleSaveField(slotIndex: number, itemIndex: number, field: keyof Item, directValue?: string) {
    const value = directValue !== undefined ? directValue : String(editValues[field] ?? '')
    const updatedSlots = [...container.slots]
    const updatedItems = normalizeItems(updatedSlots[slotIndex].items)
    if (updatedItems[itemIndex][field] === value) return
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value }
    updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items: serializeItems(updatedItems) }
    await saveSlots(updatedSlots)
  }

  async function handleDeleteItem(slotIndex: number, itemIndex: number) {
    const items = normalizeItems(container.slots[slotIndex].items)
    const res = await Taro.showModal({
      title: '删除物品',
      content: `确认删除「${items[itemIndex].name}」？`,
    })
    if (res.confirm) {
      const updatedSlots = [...container.slots]
      const updatedItems = normalizeItems(updatedSlots[slotIndex].items)
      updatedItems.splice(itemIndex, 1)
      updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items: serializeItems(updatedItems) }
      await saveSlots(updatedSlots)
    }
  }

  async function handleItemPhoto(slotIndex: number, itemIndex: number) {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        sizeType: ['compressed'],
      })
      if (res.tempFiles?.length > 0) {
        Taro.showLoading({ title: '上传中...' })
        const cloudUrl = await uploadPhoto(res.tempFiles[0].tempFilePath, containerId, slotIndex)
        Taro.hideLoading()
        const updatedSlots = [...container.slots]
        const updatedItems = normalizeItems(updatedSlots[slotIndex].items)
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], photo: cloudUrl }
        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], items: serializeItems(updatedItems) }
        await saveSlots(updatedSlots)
      }
    } catch {
      Taro.hideLoading()
    }
  }

  // Slot operations
  async function handleAddSlot() {
    if (!container) return
    const res = await Taro.showModal({
      title: '添加分层',
      editable: true,
      placeholderText: '分层名称',
    } as any)
    if (res.confirm && (res as any).content) {
      const updatedSlots = [...container.slots, { label: (res as any).content, type: 'shelf', items: [], photo: '' }]
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

  async function handleDeleteContainer() {
    const res = await Taro.showModal({
      title: '删除容器',
      content: `确认删除「${container.name}」及其所有数据？`,
    })
    if (res.confirm) {
      await deleteContainer(spaceId, roomId, containerId)
      Taro.navigateBack()
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
            {saving ? ' · 保存中...' : ''}
          </Text>
        </View>
        <Text className='delete-container-btn' onClick={handleDeleteContainer}>删除</Text>
      </View>

      <View className='isometric-section'>
        <IsometricView
          containerName={container.name}
          slots={container.slots || []}
          elevationAspect={container.elevationAspect}
          highlightSlotIndex={selectedSlot}
          onSlotClick={(i) => setSelectedSlot(selectedSlot === i ? null : i)}
        />
      </View>

      <View className='slots'>
        {container.slots?.map((slot: any, slotIndex: number) => {
          if (selectedSlot !== null && selectedSlot !== slotIndex) return null
          const items = normalizeItems(slot.items)
          const slotCats = [...new Set(items.map(i => i.category).filter(Boolean))]
          const slotDisplayName = slotCats.length > 0 ? slotCats.join('、') : items.length === 0 ? '暂无物品' : slot.label
          return (
            <View key={slotIndex} className='slot-card'>
              <View className='slot-header'>
                <Text className='slot-label'>{slotDisplayName}</Text>
                <View className='slot-actions'>
                  {items.length > 0 && batchSlot !== slotIndex && (
                    <Text className='action-btn' onClick={() => { setBatchSlot(slotIndex); setSelectedItems(new Set()); setExpandedItem(null) }}>批量移动</Text>
                  )}
                  {batchSlot === slotIndex && (
                    <Text className='action-btn' onClick={() => { setBatchSlot(null); setSelectedItems(new Set()) }}>取消</Text>
                  )}
                  <Text className='action-btn delete' onClick={() => handleDeleteSlot(slotIndex)}>删除层</Text>
                </View>
              </View>

              {/* Item cards */}
              <View className='item-list'>
                {items.map((item: Item, itemIndex: number) => {
                  const isSearchMatch = decodedQuery && item.name.toLowerCase().includes(decodedQuery.toLowerCase())
                  const itemKey = `${slotIndex}-${itemIndex}`
                  const isExpanded = expandedItem === itemKey
                  const isBatchMode = batchSlot === slotIndex
                  const isSelected = isBatchMode && selectedItems.has(itemIndex)
                  return (
                  <View key={itemIndex} className={`item-card ${isSearchMatch ? 'search-highlight' : ''} ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}>
                    <View className='item-card-header' onClick={() => {
                      if (isBatchMode) {
                        setSelectedItems(prev => {
                          const next = new Set(prev)
                          next.has(itemIndex) ? next.delete(itemIndex) : next.add(itemIndex)
                          return next
                        })
                      } else {
                        toggleExpandItem(slotIndex, itemIndex)
                      }
                    }}>
                      {isBatchMode && (
                        <View className={`batch-checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <Text className='check-mark'>✓</Text>}
                        </View>
                      )}
                      {item.photo ? (
                        <Image className='item-photo' src={item.photo} mode='aspectFill' onClick={(e) => { if (!isBatchMode) { e.stopPropagation(); handleItemPhoto(slotIndex, itemIndex) } }} />
                      ) : (
                        <View className='item-photo-placeholder' onClick={(e) => { if (!isBatchMode) { e.stopPropagation(); handleItemPhoto(slotIndex, itemIndex) } }}>
                          <Text className='photo-icon'>📷</Text>
                        </View>
                      )}
                      <View className='item-info'>
                        <Text className='item-name'>{item.name}</Text>
                        <View className='item-meta'>
                          {item.category && <Text className='item-category'>{item.category}</Text>}
                          {item.price && <Text className='item-price'>¥{item.price}</Text>}
                        </View>
                      </View>
                      {!isBatchMode && <Text className={`item-expand-arrow ${isExpanded ? 'rotated' : ''}`}>›</Text>}
                    </View>

                    {isExpanded && (
                      <View className='item-edit-panel'>
                        <View className='edit-field'>
                          <Text className='edit-label'>名称</Text>
                          <Input className='edit-input' value={String(editValues.name ?? '')} onInput={(e) => handleEditInput('name', e.detail.value)} onBlur={() => handleSaveField(slotIndex, itemIndex, 'name')} />
                        </View>
                        <View className='edit-field'>
                          <Text className='edit-label'>类型</Text>
                          <View className='category-grid'>
                            {CATEGORIES.map(cat => (
                              <Text
                                key={cat}
                                className={`category-tag ${editValues.category === cat ? 'selected' : ''}`}
                                onClick={() => { setEditValues(prev => ({ ...prev, category: cat })); handleSaveField(slotIndex, itemIndex, 'category', cat) }}
                              >{cat}</Text>
                            ))}
                          </View>
                        </View>
                        <View className='edit-field'>
                          <Text className='edit-label'>价格</Text>
                          <Input className='edit-input' type='digit' value={String(editValues.price ?? '')} placeholder='¥' onInput={(e) => handleEditInput('price', e.detail.value)} onBlur={() => handleSaveField(slotIndex, itemIndex, 'price')} />
                        </View>
                        <View className='edit-field'>
                          <Text className='edit-label'>备注</Text>
                          <Textarea className='edit-textarea' value={String(editValues.notes ?? '')} placeholder='添加备注...' autoHeight maxlength={500} onInput={(e) => handleEditInput('notes', e.detail.value)} onBlur={() => handleSaveField(slotIndex, itemIndex, 'notes')} />
                        </View>
                        {item.createdAt && (
                          <View className='edit-field'>
                            <Text className='edit-label'>录入日期</Text>
                            <Text className='edit-value-static'>{item.createdAt}</Text>
                          </View>
                        )}
                        <View className='edit-actions'>
                          <Text className='edit-move-btn' onClick={() => {
                            Taro.navigateTo({
                              url: `/pages/move-item/index?spaceId=${spaceId}&roomId=${roomId}&containerId=${containerId}&slotIndex=${slotIndex}&itemIndex=${itemIndex}`,
                            })
                          }}>移动到...</Text>
                          <Text className='edit-delete-btn' onClick={() => handleDeleteItem(slotIndex, itemIndex)}>删除物品</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  )})}
              </View>

              {/* Add item button */}
              <View className='add-item-btn' onClick={() => handleAddItem(slotIndex)}>
                <Text className='add-item-text'>+ 添加物品</Text>
              </View>
            </View>
          )
        })}
      </View>

      <Button className='add-slot-btn' onClick={handleAddSlot}>
        + 添加分层
      </Button>

      {batchSlot !== null && selectedItems.size > 0 && (
        <View className='batch-bar'>
          <Text className='batch-count'>已选 {selectedItems.size} 件</Text>
          <View className='batch-move-btn' onClick={() => {
            const indexes = [...selectedItems].sort((a, b) => a - b).join(',')
            Taro.navigateTo({
              url: `/pages/move-item/index?spaceId=${spaceId}&roomId=${roomId}&containerId=${containerId}&slotIndex=${batchSlot}&itemIndexes=${indexes}`,
            })
          }}>
            <Text className='batch-move-text'>移动到...</Text>
          </View>
        </View>
      )}
    </View>
  )
}
