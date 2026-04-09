import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { createShareLink, getSpaces, deleteSpace } from '../../services/space'
import { cloudClearAll } from '../../services/cloud'
import { initExampleSpace } from '../../services/init-space'
import './index.scss'

export default function MyPage() {
  const [profileSummary, setProfileSummary] = useState('')

  useDidShow(() => {
    try {
      const saved = Taro.getStorageSync('user_profile')
      if (saved) {
        const p = JSON.parse(saved)
        const parts = [p.occupation, p.personality, p.frequency].filter(Boolean)
        setProfileSummary(parts.length > 0 ? parts.join(' · ') : '')
      }
    } catch {}
  })
  async function handleShare() {
    Taro.showLoading({ title: '生成分享...' })
    try {
      // Share the first space for now
      const spaces = await (await import('../../services/space')).getSpaces()
      if (spaces.length === 0) {
        Taro.hideLoading()
        Taro.showToast({ title: '暂无可分享的空间', icon: 'none' })
        return
      }
      const token = await createShareLink(spaces[0]._id)
      Taro.hideLoading()
      Taro.showModal({
        title: '分享成功',
        content: `分享码：${token}\n\n也可以点击右上角菜单发送给好友`,
        showCancel: false,
      })
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '分享失败', icon: 'none' })
    }
  }

  async function handleClearAll() {
    const confirm = await Taro.showModal({
      title: '清空所有数据',
      content: '将删除本地和云端的所有数据（房间、物品、平面图等），不可恢复。确定？',
    })
    if (!confirm.confirm) return
    Taro.showLoading({ title: '清空中...' })
    try {
      // Clear all localStorage keys
      Taro.removeStorageSync('storage_map_data')
      Taro.removeStorageSync('drawn_floorplan')
      Taro.removeStorageSync('draw_all_rects')
      Taro.removeStorageSync('rect_container_map')
      Taro.removeStorageSync('user_profile')
      Taro.removeStorageSync('mock_data_seeded_v6')
      // Clear cloud DB (all collections)
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
      title: '初始化空间',
      content: '将清除现有数据，创建示例房间、储物柜和物品。确定？',
    })
    if (!confirm.confirm) return
    Taro.showLoading({ title: '初始化中...' })
    try {
      const result = await initExampleSpace()
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
    { label: '初始化空间（开发用）', action: handleInitSpace },
    { label: '清空所有数据（开发用）', action: handleClearAll },
    { label: '联系收纳师', action: handleContact },
    { label: '分享物品地图', action: handleShare },
    { label: '关于我们', action: handleAbout },
  ]

  return (
    <View className='my-page'>
      {/* Profile card */}
      <View className='profile-card'>
        <View className='avatar'>
          <Text className='avatar-text'>张</Text>
        </View>
        <View className='profile-info'>
          <Text className='profile-name'>冬宝</Text>
          <Text className='profile-detail'>{profileSummary || '收纳地图用户'}</Text>
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
