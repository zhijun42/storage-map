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

  async function handleCreateSpace() {
    const res = await Taro.showModal({
      title: '创建新空间',
      editable: true,
      placeholderText: '请输入空间名称',
    } as any)
    if (res.confirm && (res as any).content) {
      const { createSpace } = await import('../../services/space')
      await createSpace((res as any).content)
      loadSpaces()
    }
  }

  function handleContainerClick(roomId: string, containerId: string) {
    if (!activeSpace) return
    Taro.navigateTo({
      url: `/pages/container/index?spaceId=${activeSpace._id}&roomId=${roomId}&containerId=${containerId}`,
    })
  }

  function handleOpenSearch() {
    Taro.navigateTo({ url: '/pages/search/index' })
  }

  function handleOpenSpace(spaceId: string) {
    Taro.navigateTo({ url: `/pages/space/index?id=${spaceId}` })
  }

  return (
    <View className='index-page'>
      {/* Floor plan */}
      {activeSpace && activeSpace.rooms?.length > 0 && (
        <View className='floorplan-section'>
          <FloorplanView
            rooms={activeSpace.rooms}
            onContainerClick={handleContainerClick}
          />
        </View>
      )}

      {/* Action buttons */}
      <View className='actions'>
        <View className='action-btn' onClick={handleOpenSearch}>
          <Text className='action-text'>物品查询</Text>
        </View>
        {spaces.length > 0 && (
          <View className='action-btn' onClick={() => handleOpenSpace(spaces[0]._id)}>
            <Text className='action-text'>管理空间</Text>
          </View>
        )}
        {spaces.length === 0 && (
          <View className='action-btn primary' onClick={handleCreateSpace}>
            <Text className='action-text-primary'>创建新空间</Text>
          </View>
        )}
      </View>
    </View>
  )
}
