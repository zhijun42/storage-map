import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getSpaces, createSpace } from '../../services/space'
import './index.scss'

export default function Index() {
  const [spaces, setSpaces] = useState<any[]>([])

  useEffect(() => {
    loadSpaces()
  }, [])

  async function loadSpaces() {
    const data = await getSpaces()
    setSpaces(data)
  }

  async function handleCreateSpace() {
    const res = await Taro.showModal({
      title: '创建新空间',
      editable: true,
      placeholderText: '请输入名称（如：张先生的家）',
    })
    if (res.confirm && res.content) {
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
    <View className='index'>
      <View className='header'>
        <Text className='title'>收纳地图</Text>
        <Text className='subtitle'>快速制作物品地图，轻松查找家中物品</Text>
      </View>

      <View className='search-bar' onClick={handleOpenSearch}>
        <Text className='search-placeholder'>搜索物品（如：护照、充电器）</Text>
      </View>

      <View className='section'>
        <Text className='section-title'>我的空间</Text>
        {spaces.map((space) => (
          <View
            key={space._id}
            className='space-card'
            onClick={() => handleOpenSpace(space._id)}
          >
            <Text className='space-name'>{space.name}</Text>
            <Text className='space-info'>
              {space.roomCount || 0} 个房间 · {space.containerCount || 0} 个容器
            </Text>
          </View>
        ))}

        <Button className='add-btn' onClick={handleCreateSpace}>
          + 创建新空间
        </Button>
      </View>
    </View>
  )
}
