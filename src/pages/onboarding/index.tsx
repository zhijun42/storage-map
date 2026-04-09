import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { resolveShareLink, pullSharedSpace } from '../../services/space'
import './index.scss'

export default function OnboardingPage() {
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  function handleOrganizer() {
    Taro.setStorageSync('user_role', 'organizer')
    Taro.setStorageSync('onboarding_done', '1')
    Taro.switchTab({ url: '/pages/index/index' })
  }

  async function handleResidentSubmit() {
    if (!code.trim()) {
      Taro.showToast({ title: '请输入分享码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const result = await resolveShareLink(code.trim())
      if (!result.success) {
        setLoading(false)
        Taro.showModal({ title: '加入失败', content: result.error || '分享码无效', showCancel: false })
        return
      }
      await pullSharedSpace(result.spaceId)
      Taro.setStorageSync('user_role', 'resident')
      Taro.setStorageSync('onboarding_done', '1')
      setLoading(false)
      Taro.showToast({ title: '已加入空间', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 800)
    } catch {
      setLoading(false)
      Taro.showToast({ title: '加入失败', icon: 'none' })
    }
  }

  return (
    <View className='onboarding-page'>
      <View className='header'>
        <Text className='title'>收纳地图</Text>
        <Text className='subtitle'>请选择您的身份</Text>
      </View>

      {!showCodeInput ? (
        <View className='role-cards'>
          <View className='role-card organizer' onClick={handleOrganizer}>
            <Text className='role-title'>我是收纳师</Text>
            <Text className='role-desc'>创建和管理客户的收纳空间</Text>
          </View>

          <View className='role-card resident' onClick={() => setShowCodeInput(true)}>
            <Text className='role-title'>我是住户</Text>
            <Text className='role-desc'>收纳师已为我整理，我要查看我的空间</Text>
          </View>
        </View>
      ) : (
        <View className='code-section'>
          <Text className='code-label'>请输入收纳师提供的分享码</Text>
          <Input
            className='code-input'
            placeholder='输入分享码'
            value={code}
            onInput={(e) => setCode(e.detail.value)}
            maxlength={20}
          />
          <View className={`submit-btn ${loading ? 'disabled' : ''}`} onClick={handleResidentSubmit}>
            <Text className='submit-text'>{loading ? '加入中...' : '加入空间'}</Text>
          </View>
          <Text className='back-link' onClick={() => setShowCodeInput(false)}>返回选择身份</Text>
        </View>
      )}
    </View>
  )
}
