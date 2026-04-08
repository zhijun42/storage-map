import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { createShareLink } from '../../services/space'
import { seedItemsIntoSlots } from '../../services/seed-items'
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

  async function handleSeedItems() {
    Taro.showLoading({ title: '生成物品中...' })
    try {
      const count = await seedItemsIntoSlots()
      Taro.hideLoading()
      Taro.showToast({ title: `已生成 ${count} 件物品`, icon: 'success' })
    } catch (e) {
      Taro.hideLoading()
      console.error('seed error:', e)
      Taro.showToast({ title: '生成失败', icon: 'none' })
    }
  }

  const menuItems = [
    { label: '个人信息', action: handleProfile },
    { label: '生成示例物品', action: handleSeedItems },
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
