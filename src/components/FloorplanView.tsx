import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import './FloorplanView.scss'

interface Container {
  _id: string
  name: string
  slots?: any[]
}

interface Room {
  _id: string
  name: string
  containers?: Container[]
}

interface FloorplanViewProps {
  rooms: Room[]
  compact?: boolean
  highlightContainerId?: string | null
  onContainerClick?: (roomId: string, containerId: string) => void
}

export default function FloorplanView({
  rooms,
  compact = false,
  highlightContainerId,
  onContainerClick,
}: FloorplanViewProps) {
  const [expandedContainer, setExpandedContainer] = useState<string | null>(null)

  function handleContainerClick(roomId: string, container: Container) {
    if (onContainerClick) {
      onContainerClick(roomId, container._id)
    } else {
      setExpandedContainer(expandedContainer === container._id ? null : container._id)
    }
  }

  if (!rooms || rooms.length === 0) {
    return (
      <View className='floorplan-empty'>
        <Text>暂无房间数据</Text>
      </View>
    )
  }

  return (
    <View className={`floorplan ${compact ? 'compact' : ''}`}>
      <View className='floorplan-grid'>
        {rooms.map((room) => (
          <View key={room._id} className='room'>
            <Text className='room-name'>{room.name}</Text>
            <View className='room-containers'>
              {room.containers?.map((container) => {
                const isHighlighted = highlightContainerId === container._id
                const isExpanded = expandedContainer === container._id
                return (
                  <View key={container._id} className='container-wrapper'>
                    <View
                      className={`container-block ${isHighlighted ? 'highlighted' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => handleContainerClick(room._id, container)}
                    >
                      <Text className='container-name'>{container.name}</Text>
                      <Text className='container-count'>{container.slots?.length || 0}层</Text>
                    </View>
                    {isExpanded && !compact && container.slots && (
                      <View className='slot-list'>
                        {container.slots.map((slot: any, i: number) => (
                          <View key={i} className='slot-row'>
                            <Text className='slot-label'>{slot.label}</Text>
                            <Text className='slot-items'>{slot.items || '(空)'}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
              {(!room.containers || room.containers.length === 0) && (
                <Text className='no-containers'>暂无容器</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
