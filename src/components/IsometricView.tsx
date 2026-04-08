import { View, Text } from '@tarojs/components'
import './IsometricView.scss'

interface Slot {
  label: string
  type: string
  items: string
}

interface IsometricViewProps {
  containerName: string
  slots: Slot[]
  highlightSlotIndex?: number | null
  onSlotClick?: (slotIndex: number) => void
}

function detectLayout(slots: Slot[]): 'horizontal' | 'vertical' {
  const labels = slots.map(s => s.label)
  const hasLeftRight = labels.some(l => l.includes('左') || l.includes('右'))
  return hasLeftRight ? 'horizontal' : 'vertical'
}

export default function IsometricView({
  containerName,
  slots,
  highlightSlotIndex,
  onSlotClick,
}: IsometricViewProps) {
  if (!slots || slots.length === 0) return null

  const layout = detectLayout(slots)

  return (
    <View className='isometric-container'>
      <View className='cabinet'>
        <View className='cabinet-top' />
        <View className='cabinet-side' />
        <View className={`cabinet-front ${layout}`}>
          {slots.map((slot, index) => {
            const isHighlighted = highlightSlotIndex === index
            const isDrawer = slot.type === 'drawer'

            return (
              <View
                key={index}
                className={`slot ${isHighlighted ? 'highlighted' : ''} ${isDrawer ? 'drawer' : ''}`}
                onClick={() => onSlotClick?.(index)}
              >
                <Text className='slot-label'>{slot.label}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
