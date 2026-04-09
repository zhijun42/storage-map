import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpace, moveItem, moveItems } from '../../services/space'
import { normalizeItems } from '../../services/items'
import FloorplanView from '../../components/FloorplanView'
import IsometricView from '../../components/IsometricView'
import './index.scss'

export default function MoveItemPage() {
  const router = useRouter()
  const {
    spaceId = '', roomId = '', containerId = '',
    slotIndex: si = '0', itemIndex: ii = '0', itemIndexes: iiMulti = '',
  } = router.params
  const slotIndex = Number(si)
  const itemIndex = Number(ii)
  const isBatch = !!iiMulti
  const batchIndexes = isBatch ? iiMulti.split(',').map(Number) : [itemIndex]

  const [space, setSpace] = useState<any>(null)
  const [itemName, setItemName] = useState('')
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const s = await getSpace(spaceId)
    if (!s) return
    setSpace(s)

    const fromRoom = s.rooms?.find((r: any) => r._id === roomId)
    const fromContainer = fromRoom?.containers?.find((c: any) => c._id === containerId)
    const fromSlot = fromContainer?.slots?.[slotIndex]
    if (fromSlot) {
      const items = normalizeItems(fromSlot.items)
      if (isBatch) {
        setItemName(`${batchIndexes.length} 件物品`)
      } else if (items[itemIndex]) {
        setItemName(items[itemIndex].name)
      }
    }
  }

  function handleContainerClick(rId: string, cId: string) {
    setSelectedRoomId(rId)
    setSelectedContainerId(cId)
  }

  // Get the selected container's data
  let selectedContainer: any = null
  let selectedRoomName = ''
  if (space && selectedRoomId && selectedContainerId) {
    const room = space.rooms?.find((r: any) => r._id === selectedRoomId)
    if (room) {
      selectedRoomName = room.name
      selectedContainer = room.containers?.find((c: any) => c._id === selectedContainerId)
    }
  }

  async function handleMoveToSlot(targetSlotIndex: number) {
    if (!selectedRoomId || !selectedContainerId || moving) return
    const isSameSlot = selectedRoomId === roomId && selectedContainerId === containerId && targetSlotIndex === slotIndex
    if (isSameSlot) {
      Taro.showToast({ title: '物品已在此位置', icon: 'none' })
      return
    }

    setMoving(true)
    const success = isBatch
      ? await moveItems(spaceId, roomId, containerId, slotIndex, batchIndexes, selectedRoomId, selectedContainerId, targetSlotIndex)
      : await moveItem(spaceId, roomId, containerId, slotIndex, itemIndex, selectedRoomId, selectedContainerId, targetSlotIndex)
    setMoving(false)

    if (success) {
      Taro.showToast({ title: `已移动到 ${selectedContainer.name}`, icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } else {
      Taro.showToast({ title: '移动失败', icon: 'none' })
    }
  }

  return (
    <View className='move-item-page'>
      <View className='move-header'>
        <Text className='move-title'>移动「{itemName}」</Text>
        <Text className='move-subtitle'>点击平面图上的容器选择目标</Text>
      </View>

      {space?.rooms?.length > 0 && (
        <View className='floorplan-section'>
          <FloorplanView
            rooms={space.rooms}
            highlightContainerId={selectedContainerId}
            onContainerClick={handleContainerClick}
          />
        </View>
      )}

      {selectedContainer ? (
        <View className='slot-picker'>
          <Text className='slot-picker-title'>{selectedRoomName} · {selectedContainer.name}</Text>
          <Text className='slot-picker-hint'>点击隔间移动物品</Text>
          <View className='isometric-section'>
            <IsometricView
              containerName={selectedContainer.name}
              slots={selectedContainer.slots || []}
              elevationAspect={selectedContainer.elevationAspect}
              onSlotClick={handleMoveToSlot}
            />
          </View>
        </View>
      ) : (
        <View className='hint-section'>
          <Text className='hint-text'>请在上方平面图中选择目标容器</Text>
        </View>
      )}
    </View>
  )
}
