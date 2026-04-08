import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getSpaces, getSpace } from '../../services/space'
import FloorplanView from '../../components/FloorplanView'
import './index.scss'

export default function Index() {
  const [spaces, setSpaces] = useState<any[]>([])
  const [activeSpace, setActiveSpace] = useState<any>(null)

  useDidShow(() => { loadSpaces() })

  async function loadSpaces() {
    const data = await getSpaces()
    setSpaces(data)
    if (data.length > 0) {
      const full = await getSpace(data[0]._id)
      setActiveSpace(full)
    }
  }

  function handleContainerClick(roomId: string, containerId: string) {
    if (!activeSpace) return
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${activeSpace._id}&roomId=${roomId}&containerId=${containerId}`,
    })
  }

  return (
    <View className='index-page'>
      {activeSpace && activeSpace.rooms?.length > 0 && (
        <View className='floorplan-section'>
          <FloorplanView
            rooms={activeSpace.rooms}
            onContainerClick={handleContainerClick}
          />
        </View>
      )}

      <View className='actions'>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/search/index' })}>
          <Text className='action-text'>物品查询</Text>
        </View>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/capture/index' })}>
          <Text className='action-text'>拍照录入</Text>
        </View>
      </View>
    </View>
  )
}
