import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { normalizeItems } from '../services/items'
import './IsometricView.scss'

interface Slot {
  label: string
  type: string
  items: any
  categories?: string[]
  rx?: number; ry?: number; rw?: number; rh?: number
}

interface IsometricViewProps {
  containerName: string
  slots: Slot[]
  dimensions?: { width: number; height: number; depth: number }
  elevationAspect?: number
  highlightSlotIndex?: number | null
  onSlotClick?: (slotIndex: number) => void
}

function detectLayout(slots: Slot[]): 'horizontal' | 'vertical' {
  const labels = slots.map(s => s.label)
  return labels.some(l => l.includes('左') || l.includes('右')) ? 'horizontal' : 'vertical'
}

function hasFlexibleLayout(slots: Slot[]): boolean {
  return slots.some(s => s.rx != null && s.ry != null && s.rw != null && s.rh != null)
}

function getSlotCategories(slot: Slot): string {
  const items = normalizeItems(slot.items)
  if (items.length === 0) return '暂无物品'
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))]
  if (cats.length === 0) return ''
  return cats.length <= 2 ? cats.join('，') : `${cats[0]}等`
}

export default function IsometricView({
  containerName,
  slots,
  dimensions,
  elevationAspect,
  highlightSlotIndex,
  onSlotClick,
}: IsometricViewProps) {
  if (!slots || slots.length === 0) return null

  const flexible = hasFlexibleLayout(slots)
  const layout = flexible ? 'flexible' : detectLayout(slots)
  const aspect = elevationAspect || 1.2

  // When cabinet is too tall, shrink the whole cabinet width to fit one screen
  const windowInfo = Taro.getWindowInfo()
  const maxH = windowInfo.windowHeight * 0.55
  const fullWidth = windowInfo.windowWidth - 48 - 32 - 32
  const naturalH = fullWidth * aspect
  const needsScale = naturalH > maxH
  const scaledWidth = needsScale ? Math.round(maxH / aspect) : undefined

  return (
    <View className='isometric-container'>
      {dimensions && (
        <View className='cabinet-dims'>
          <Text className='dim-text'>宽 {dimensions.width}mm</Text>
          <Text className='dim-text'>{containerName}</Text>
        </View>
      )}

      <View className='cabinet' style={scaledWidth ? { width: `${scaledWidth}px`, margin: '0 auto' } : undefined}>
        <View className='cabinet-top' />
        <View className='cabinet-side' />
        <View className='cabinet-edge' />

        {flexible ? (
          // Flexible absolute-positioned layout (from draw-editor elevation)
          <View className='cabinet-front flexible'>
            <View
              className='front-aspect'
              style={{ paddingBottom: `${aspect * 100}%` }}
            >
              <View className='front-inner'>
                {slots.map((slot, index) => {
                  const isHighlighted = highlightSlotIndex === index
                  const isDrawer = slot.type === 'drawer'
                  const category = getSlotCategories(slot)

                  return (
                    <View
                      key={index}
                      className={`slot-abs ${isHighlighted ? 'highlighted' : ''} ${isDrawer ? 'drawer' : 'open'}`}
                      style={{
                        left: `${(slot.rx || 0) * 100}%`,
                        top: `${(slot.ry || 0) * 100}%`,
                        width: `${(slot.rw || 1) * 100}%`,
                        height: `${(slot.rh || 1) * 100}%`,
                      }}
                      onClick={() => onSlotClick?.(index)}
                    >
                      {!isDrawer && <View className='perspective-lines' />}
                      {isDrawer && <View className='drawer-handle' />}
                      {category ? <Text className='slot-category'>{category}</Text> : null}
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        ) : (
          // Legacy flex layout
          <View className={`cabinet-front ${layout}`}>
            {slots.map((slot, index) => {
              const isHighlighted = highlightSlotIndex === index
              const isDrawer = slot.type === 'drawer'
              const isOpen = slot.type === 'open' || slot.type === 'shelf' || slot.type === 'rod'
              const category = getSlotCategories(slot)

              return (
                <View
                  key={index}
                  className={`slot ${isHighlighted ? 'highlighted' : ''} ${isDrawer ? 'drawer' : ''} ${isOpen ? 'open' : ''}`}
                  onClick={() => onSlotClick?.(index)}
                >
                  {isOpen && <View className='perspective-lines' />}
                  {isDrawer && <View className='drawer-handle' />}
                  {category ? <Text className='slot-category'>{category}</Text> : null}
                </View>
              )
            })}
          </View>
        )}
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
