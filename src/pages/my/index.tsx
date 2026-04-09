import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getSpaces } from '../../services/space'
import { cloudClearAll } from '../../services/cloud'
import { initExampleSpace } from '../../services/init-space'
import './index.scss'

export default function MyPage() {
  const [profileSummary, setProfileSummary] = useState('')
  const [userRole, setUserRole] = useState<'organizer' | 'resident'>('organizer')

  useDidShow(() => {
    try {
      const saved = Taro.getStorageSync('user_profile')
      if (saved) {
        const p = JSON.parse(saved)
        const parts = [p.occupation, p.personality, p.frequency].filter(Boolean)
        setProfileSummary(parts.length > 0 ? parts.join(' · ') : '')
      }
    } catch {}
    const role = Taro.getStorageSync('user_role') || 'organizer'
    setUserRole(role as any)
  })

  async function handleSwitchRole() {
    const newRole = userRole === 'organizer' ? 'resident' : 'organizer'
    Taro.setStorageSync('user_role', newRole)
    setUserRole(newRole)
    Taro.showToast({ title: `已切换为${newRole === 'organizer' ? '收纳师' : '住户'}`, icon: 'success' })
  }
  async function handleClearAll() {
    const confirm = await Taro.showModal({
      title: '清空所有数据',
      content: '将删除本地和云端的所有数据（房间、物品、平面图等），不可恢复。确定？',
    })
    if (!confirm.confirm) return
    Taro.showLoading({ title: '清空中...' })
    try {
      Taro.clearStorageSync()
      try { await cloudClearAll() } catch {}
      Taro.hideLoading()
      Taro.showToast({ title: '已清空', icon: 'success' })
    } catch (e) {
      Taro.hideLoading()
      console.error('clear error:', e)
      Taro.showToast({ title: '清空失败', icon: 'none' })
    }
  }

  function handleAbout() {
    Taro.showModal({
      title: '关于收纳地图',
      content: '收纳地图 v1.0\n\n帮助收纳师快速制作交互式物品地图，帮助住户查找家中物品。\n\n48小时 Hackathon 作品',
      showCancel: false,
    })
  }

  function handleProfile() {
    Taro.navigateTo({ url: '/pages/profile/index' })
  }

  function handleContact() {
    Taro.showModal({
      title: '联系收纳师',
      content: '专业收纳整理服务\n\n微信：warm-space-org\n电话：400-888-0000',
      showCancel: false,
    })
  }

  async function handleInitSpace() {
    const confirm = await Taro.showModal({
      title: '填充示例数据',
      content: '将清除当前空间的房间数据，填充示例房间、储物柜和物品。确定？',
    })
    if (!confirm.confirm) return
    Taro.showLoading({ title: '初始化中...' })
    try {
      const spaces = await getSpaces()
      if (spaces.length === 0) {
        Taro.hideLoading()
        Taro.showToast({ title: '请先创建空间', icon: 'none' })
        return
      }
      const result = await initExampleSpace(spaces[0]._id)
      Taro.hideLoading()
      Taro.showToast({ title: `${result.rooms}房间 ${result.cabinets}柜 ${result.items}物品`, icon: 'success', duration: 2000 })
    } catch (e) {
      Taro.hideLoading()
      console.error('init error:', e)
      Taro.showToast({ title: '初始化失败', icon: 'none' })
    }
  }

  const menuItems = [
    { label: '个人信息', action: handleProfile },
    { label: `切换身份（当前：${userRole === 'organizer' ? '收纳师' : '住户'}）`, action: handleSwitchRole },
    { label: '填充示例数据（开发用）', action: handleInitSpace },
    { label: '清空所有数据（开发用）', action: handleClearAll },
    { label: '联系收纳师', action: handleContact },
    { label: '关于我们', action: handleAbout },
  ]

  return (
    <View className='my-page'>
      {/* Profile card */}
      <View className='profile-card'>
        <View className='avatar'>
          <Text className='avatar-text'>{userRole === 'organizer' ? '🏠' : '👤'}</Text>
        </View>
        <View className='profile-info'>
          <Text className='profile-name'>冬宝</Text>
          <Text className='profile-role'>{userRole === 'organizer' ? '收纳师' : '住户'}</Text>
          {profileSummary && <Text className='profile-detail'>{profileSummary}</Text>}
        </View>
      </View>

      {/* Menu */}
      <View className='menu-card'>
        {menuItems.map((item, i) => (
          <View
            key={i}
            className={`menu-item ${i < menuItems.length - 1 ? 'border-bottom' : ''}`}
            onClick={item.action}
          >
            <Text className='menu-label'>{item.label}</Text>
            <Text className='menu-arrow'>›</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
