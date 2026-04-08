import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace } from '../../services/space'
import { normalizeItems } from '../../services/items'
import './index.scss'

export default function ItemDetailPage() {
  const router = useRouter()
  const { spaceId = '', roomId = '', containerId = '', slotIndex: si = '0', itemIndex: ii = '0' } = router.params
  const slotIndex = Number(si)
  const itemIndex = Number(ii)
  const [item, setItem] = useState<any>(null)
  const [location, setLocation] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const space = await getSpace(spaceId)
    if (!space) return
    const room = space.rooms?.find((r: any) => r._id === roomId)
    if (!room) return
    const container = room.containers?.find((c: any) => c._id === containerId)
    if (!container) return
    const slot = container.slots?.[slotIndex]
    if (!slot) return
    const items = normalizeItems(slot.items)
    if (items[itemIndex]) {
      setItem(items[itemIndex])
      setLocation(`${room.name} · ${container.name} · ${slot.label}`)
    }
  }

  if (!item) return <View className='loading'><Text>加载中...</Text></View>

  return (
    <View className='item-detail-page'>
      {item.photo ? (
        <Image className='detail-photo' src={item.photo} mode='aspectFill' />
      ) : (
        <View className='detail-photo-empty'>
          <Text className='photo-empty-text'>暂无照片</Text>
        </View>
      )}

      <View className='detail-card'>
        <Text className='detail-name'>{item.name}</Text>
        <Text className='detail-location'>{location}</Text>

        <View className='detail-fields'>
          <View className='field-row'>
            <Text className='field-label'>类型</Text>
            <Text className='field-value'>{item.category || '未分类'}</Text>
          </View>
          <View className='field-row'>
            <Text className='field-label'>价格</Text>
            <Text className='field-value'>{item.price ? `¥${item.price}` : '未记录'}</Text>
          </View>
          <View className='field-row'>
            <Text className='field-label'>录入日期</Text>
            <Text className='field-value'>{item.createdAt || '未记录'}</Text>
          </View>
          <View className='field-row'>
            <Text className='field-label'>备注</Text>
            <Text className='field-value'>{item.notes || '暂无'}</Text>
          </View>
        </View>
      </View>

      <View className='back-btn' onClick={() => Taro.navigateBack()}>
        <Text className='back-btn-text'>返回</Text>
      </View>
    </View>
  )
}
