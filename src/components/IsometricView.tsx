import { View, Text } from '@tarojs/components'
import { normalizeItems } from '../services/items'
import './IsometricView.scss'

interface Slot {
  label: string
  type: string
  items: any
}

interface IsometricViewProps {
  containerName: string
  slots: Slot[]
  dimensions?: { width: number; height: number; depth: number }
  highlightSlotIndex?: number | null
  onSlotClick?: (slotIndex: number) => void
}

function detectLayout(slots: Slot[]): 'horizontal' | 'vertical' {
  const labels = slots.map(s => s.label)
  return labels.some(l => l.includes('左') || l.includes('右')) ? 'horizontal' : 'vertical'
}

export default function IsometricView({
  containerName,
  slots,
  dimensions,
  highlightSlotIndex,
  onSlotClick,
}: IsometricViewProps) {
  if (!slots || slots.length === 0) return null

  const layout = detectLayout(slots)

  return (
    <View className='isometric-container'>
      {dimensions && (
        <View className='cabinet-dims'>
          <Text className='dim-text'>宽 {dimensions.width}mm</Text>
          <Text className='dim-text'>{containerName}</Text>
        </View>
      )}

      <View className='cabinet'>
        <View className='cabinet-top' />
        <View className='cabinet-side' />
        <View className='cabinet-edge' />
        <View className={`cabinet-front ${layout}`}>
          {slots.map((slot, index) => {
            const isHighlighted = highlightSlotIndex === index
            const isDrawer = slot.type === 'drawer'
            const isOpen = slot.type === 'open' || slot.type === 'shelf' || slot.type === 'rod'
            const items = normalizeItems(slot.items)
            const cats = [...new Set(items.map(i => i.category).filter(Boolean))]
            const category = cats.length <= 2 ? cats.join('，') : `${cats[0]}等`

            return (
              <View
                key={index}
                className={`slot ${isHighlighted ? 'highlighted' : ''} ${isDrawer ? 'drawer' : ''} ${isOpen ? 'open' : ''}`}
                onClick={() => onSlotClick?.(index)}
              >
                {isOpen && (
                  <View className='perspective-lines'>
                    <View className='line-top' />
                    <View className='line-left' />
                    <View className='line-right' />
                    <View className='line-bottom' />
                  </View>
                )}
                {isDrawer && <View className='drawer-handle' />}
                {category && <Text className='slot-category'>{category}</Text>}
              </View>
            )
          })}
        </View>
      </View>

      {dimensions && (
        <View className='cabinet-dims'>
          <Text className='dim-text'>深 {dimensions.depth}mm</Text>
          <Text className='dim-text'>高 {dimensions.height}mm</Text>
        </View>
      )}
    </View>
  )
}
