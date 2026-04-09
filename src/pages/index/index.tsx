import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useEffect, lazy, Suspense } from 'react'
import { getSpaces, getSpace, createSpace, createShareLink, resolveShareLink, pullSharedSpace } from '../../services/space'
import FloorplanView from '../../components/FloorplanView'
import './index.scss'

const IsometricFloorplanView = lazy(() => import('../../components/IsometricFloorplanView'))

export default function Index() {
  const router = useRouter()
  const [spaces, setSpaces] = useState<any[]>([])
  const [activeSpace, setActiveSpace] = useState<any>(null)
  const [activeSpaceIndex, setActiveSpaceIndex] = useState(0)
  const [userRole, setUserRole] = useState<'organizer' | 'resident'>('organizer')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [has3D, setHas3D] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [shareCode, setShareCode] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    // Hackathon: always show onboarding on launch
    Taro.removeStorageSync('onboarding_done')
    const shareToken = router.params.shareToken
    if (shareToken) {
      setShowOnboarding(false)
      handleShareToken(shareToken)
    }
  }, [])

  useDidShow(() => {
    const role = Taro.getStorageSync('user_role') || 'organizer'
    setUserRole(role as any)
    const onboarded = Taro.getStorageSync('onboarding_done')
    if (onboarded) {
      setShowOnboarding(false)
      loadSpaces()
    }
  })

  function handlePickOrganizer() {
    Taro.setStorageSync('user_role', 'organizer')
    Taro.setStorageSync('onboarding_done', '1')
    setUserRole('organizer')
    setShowOnboarding(false)
    loadSpaces()
  }

  async function handleJoinAsResident() {
    if (!shareCode.trim()) {
      Taro.showToast({ title: '请输入分享码', icon: 'none' })
      return
    }
    setJoining(true)
    try {
      const result = await resolveShareLink(shareCode.trim())
      if (!result.success) {
        setJoining(false)
        Taro.showModal({ title: '加入失败', content: result.error || '分享码无效', showCancel: false })
        return
      }
      await pullSharedSpace(result.spaceId)
      Taro.setStorageSync('user_role', 'resident')
      Taro.setStorageSync('onboarding_done', '1')
      setUserRole('resident')
      setJoining(false)
      setShowOnboarding(false)
      Taro.showToast({ title: '已加入空间', icon: 'success' })
      loadSpaces()
    } catch {
      setJoining(false)
      Taro.showToast({ title: '加入失败', icon: 'none' })
    }
  }

  async function handleShareToken(token: string) {
    Taro.showLoading({ title: '加载共享空间...' })
    try {
      const result = await resolveShareLink(token)
      Taro.hideLoading()
      if (!result.success) {
        Taro.showModal({ title: '分享失败', content: result.error || '无法打开', showCancel: false })
        return
      }
      Taro.setStorageSync('user_role', 'resident')
      setUserRole('resident')
      await pullSharedSpace(result.spaceId)
      Taro.showToast({ title: '已加入空间', icon: 'success' })
      loadSpaces()
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  async function loadSpaces() {
    const data = await getSpaces()
    setSpaces(data)
    if (data.length > 0) {
      const idx = Math.min(activeSpaceIndex, data.length - 1)
      const full = await getSpace(data[idx]._id)
      setActiveSpace(full)
    }
  }

  async function switchSpace(index: number) {
    setActiveSpaceIndex(index)
    if (spaces[index]) {
      const full = await getSpace(spaces[index]._id)
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

  const isOrganizer = userRole === 'organizer'

  async function handleAddSpace() {
    const res = await Taro.showModal({
      title: '添加空间',
      editable: true,
      placeholderText: '空间名称（如：张先生的家）',
    } as any)
    if (res.confirm && (res as any).content) {
      const space = await createSpace((res as any).content)
      const data = await getSpaces()
      const newIdx = data.findIndex((s: any) => s._id === space._id)
      setSpaces(data)
      setActiveSpaceIndex(newIdx >= 0 ? newIdx : data.length - 1)
      const full = await getSpace(space._id)
      setActiveSpace(full)
    }
  }

  if (showOnboarding) {
    return (
      <View className='index-page onboarding'>
        <View className='ob-header'>
          <Text className='ob-title'>收纳地图</Text>
          <Text className='ob-subtitle'>请选择您的身份</Text>
        </View>
        {!showCodeInput ? (
          <View className='ob-cards'>
            <View className='ob-card' onClick={handlePickOrganizer}>
              <Text className='ob-card-title'>我是收纳师</Text>
              <Text className='ob-card-desc'>创建和管理客户的收纳空间</Text>
            </View>
            <View className='ob-card' onClick={() => setShowCodeInput(true)}>
              <Text className='ob-card-title'>我是住户</Text>
              <Text className='ob-card-desc'>收纳师已为我整理，我要查看我的空间</Text>
            </View>
          </View>
        ) : (
          <View className='ob-code'>
            <Text className='ob-code-label'>请输入收纳师提供的分享码</Text>
            <Input className='ob-code-input' placeholder='输入分享码' value={shareCode} onInput={e => setShareCode(e.detail.value)} maxlength={20} />
            <View className={`ob-join-btn ${joining ? 'disabled' : ''}`} onClick={handleJoinAsResident}>
              <Text className='ob-join-text'>{joining ? '加入中...' : '加入空间'}</Text>
            </View>
            <Text className='ob-back' onClick={() => setShowCodeInput(false)}>返回选择身份</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className='index-page'>
      {/* Space switcher — organizer */}
      {isOrganizer && (
        <View className='space-switcher'>
          {spaces.map((s, i) => (
            <View
              key={s._id}
              className={`space-tab ${i === activeSpaceIndex ? 'active' : ''}`}
              onClick={() => switchSpace(i)}
            >
              <Text className='space-tab-text'>{s.name}</Text>
            </View>
          ))}
          <View className='space-tab add-tab' onClick={handleAddSpace}>
            <Text className='space-tab-text'>+ 添加</Text>
          </View>
        </View>
      )}

      {/* Space name header */}
      {activeSpace && (
        <View className='space-header'>
          <Text className='space-name'>{activeSpace.name}</Text>
          {isOrganizer && <Text className='space-role-tag'>收纳师</Text>}
          {!isOrganizer && <Text className='space-role-tag resident'>住户</Text>}
        </View>
      )}

      {/* Editor entry — organizer only, requires active space */}
      {isOrganizer && activeSpace && (
        <View className='editor-section'>
          <View
            className='editor-card-full'
            onClick={() => Taro.navigateTo({
              url: `/pages/draw-editor/index?spaceId=${activeSpace._id}`,
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
      )}

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
              spaceId={activeSpace._id}
              highlightContainerId={highlightId}
              onContainerClick={handleContainerClick}
            />
          )}
          {has3D && (
            <View style={{ display: viewMode === '3d' ? 'block' : 'none' }}>
              <Suspense fallback={<View><Text>加载3D视图...</Text></View>}>
                <IsometricFloorplanView
                  rooms={activeSpace.rooms}
                  spaceId={activeSpace._id}
                  highlightContainerId={highlightId}
                  onContainerClick={handleContainerClick}
                />
              </Suspense>
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

      {isOrganizer && activeSpace && (
        <View className='share-btn' onClick={async () => {
          Taro.showLoading({ title: '生成分享码...' })
          try {
            const token = await createShareLink(activeSpace._id)
            Taro.hideLoading()
            Taro.setClipboardData({ data: token })
            Taro.showModal({
              title: '分享码已复制',
              content: `分享码：${token}\n\n已复制到剪贴板，请发送给住户。\n住户打开小程序后输入此码即可加入空间。`,
              showCancel: false,
            })
          } catch {
            Taro.hideLoading()
            Taro.showToast({ title: '生成失败', icon: 'none' })
          }
        }}>
          <Text className='share-btn-text'>分享给住户</Text>
        </View>
      )}
    </View>
  )
}
