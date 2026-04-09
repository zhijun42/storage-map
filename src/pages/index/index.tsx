import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getSpaces, getSpace } from '../../services/space'
import FloorplanView from '../../components/FloorplanView'
import IsometricFloorplanView from '../../components/IsometricFloorplanView'
import './index.scss'

export default function Index() {
  const [spaces, setSpaces] = useState<any[]>([])
  const [activeSpace, setActiveSpace] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [has3D, setHas3D] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useDidShow(() => { setHighlightId(null); setHas3D(false); setViewMode('2d'); loadSpaces() })

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
    setHighlightId(containerId)
    setTimeout(() => {
      Taro.navigateTo({
        url: `/pages/container/index?spaceId=${activeSpace._id}&roomId=${roomId}&containerId=${containerId}`,
      })
    }, 300)
  }

  return (
    <View className='index-page'>
      {/* Editor entry */}
      <View className='editor-section'>
        <View
          className='editor-card-full'
          onClick={() => Taro.navigateTo({
            url: '/pages/draw-editor/index',
            fail: (err) => {
              console.error('navigateTo draw-editor failed:', err)
              Taro.showToast({ title: '打开失败，请重试', icon: 'none' })
            },
          })}
        >
          <Text className='card-title'>空间绘制</Text>
          <Text className='card-desc'>房间 → 家具 → 储物柜 → 立面隔间</Text>
        </View>
      </View>

      {activeSpace && activeSpace.rooms?.length > 0 && (
        <View className='floorplan-section'>
          <View className='view-toggle'>
            <View
              className={`toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => setViewMode('2d')}
            >
              <Text className='toggle-text'>2D</Text>
            </View>
            <View
              className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => { setViewMode('3d'); setHas3D(true) }}
            >
              <Text className='toggle-text'>3D</Text>
            </View>
          </View>
          {viewMode === '2d' && (
            <FloorplanView
              rooms={activeSpace.rooms}
              highlightContainerId={highlightId}
              onContainerClick={handleContainerClick}
            />
          )}
          {has3D && (
            <View style={{ display: viewMode === '3d' ? 'block' : 'none' }}>
              <IsometricFloorplanView
                rooms={activeSpace.rooms}
                highlightContainerId={highlightId}
                onContainerClick={handleContainerClick}
              />
            </View>
          )}
        </View>
      )}

      <View className='actions'>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/search/index' })}>
          <Text className='action-text'>物品查询</Text>
        </View>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/capture/index' })}>
          <Text className='action-text'>拍照录入</Text>
        </View>
        <View className='action-btn ai' onClick={() => Taro.navigateTo({ url: '/pages/ai-strategy/index' })}>
          <Text className='action-text-ai'>AI 收纳策略</Text>
        </View>
      </View>
    </View>
  )
}
