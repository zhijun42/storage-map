import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getSpaces } from '../../services/space'
import './index.scss'

export default function Index() {
  const [spaces, setSpaces] = useState<any[]>([])

  useDidShow(() => { loadSpaces() })

  async function loadSpaces() {
    const data = await getSpaces()
    setSpaces(data)
  }

  async function handleCreateSpace() {
    const res = await Taro.showModal({
      title: '创建新空间',
      editable: true,
      placeholderText: '请输入空间名称',
    })
    if (res.confirm && res.content) {
      const { createSpace } = await import('../../services/space')
      await createSpace(res.content)
      loadSpaces()
    }
  }

  function handleOpenSpace(spaceId: string) {
    Taro.navigateTo({ url: `/pages/space/index?id=${spaceId}` })
  }

  function handleOpenSearch() {
    Taro.navigateTo({ url: '/pages/search/index' })
  }

  return (
    <View className='index-page'>
      {/* Space cards */}
      <View className='space-list'>
        {spaces.map((space) => (
          <View
            key={space._id}
            className='space-card'
            onClick={() => handleOpenSpace(space._id)}
          >
            <View className='space-icon'>
              <Text className='icon-text'>{space.name.slice(0, 1)}</Text>
            </View>
            <View className='space-info'>
              <Text className='space-name'>{space.name}</Text>
              <Text className='space-meta'>
                {space.roomCount || 0} 个房间 · {space.containerCount || 0} 个容器
              </Text>
            </View>
            <Text className='space-arrow'>›</Text>
          </View>
        ))}
      </View>

      {/* Action buttons — matches MapHomePage style */}
      <View className='actions'>
        <View className='action-btn' onClick={handleOpenSearch}>
          <Text className='action-text'>物品查询</Text>
        </View>
        <View className='action-btn' onClick={handleCreateSpace}>
          <Text className='action-text'>创建新空间</Text>
        </View>
      </View>
    </View>
  )
}
