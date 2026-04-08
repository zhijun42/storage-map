import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import './index.scss'

const PROFILE_KEY = 'user_profile'

const GENDER_OPTIONS = ['男', '女', '其他']
const AGE_OPTIONS = ['18岁以下', '18-25', '26-35', '36-45', '46-55', '55岁以上']
const OCCUPATION_OPTIONS = [
  '学生', '白领/上班族', '自由职业', '全职家长',
  '设计师/创意', '教师', '医护', '工程师/技术', '其他',
]
const PERSONALITY_OPTIONS = ['井井有条型', '随性自然型', '极简主义', '收藏爱好者', '混合型']
const FREQUENCY_OPTIONS = ['每天整理', '每周整理', '每月整理', '换季整理', '很少整理']
const RESIDENTS_OPTIONS = ['1人', '2人', '3人', '4人', '5人及以上']
const LIFESTYLE_OPTIONS = ['注重收纳', '喜欢囤货', '经常网购', '换季习惯强', '有小孩', '养宠物']

interface UserProfile {
  gender: string
  age: string
  occupation: string
  personality: string
  frequency: string
  residents: string
  lifestyle: string[]
  completed: boolean
}

function getDefaultProfile(): UserProfile {
  return { gender: '', age: '', occupation: '', personality: '', frequency: '', residents: '', lifestyle: [], completed: false }
}

function loadProfile(): UserProfile {
  try {
    const saved = Taro.getStorageSync(PROFILE_KEY)
    if (saved) return { ...getDefaultProfile(), ...JSON.parse(saved) }
  } catch {}
  return getDefaultProfile()
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(getDefaultProfile)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '个人信息' })
    setProfile(loadProfile())
  }, [])

  function update(field: string, value: any) {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  function toggleLifestyle(item: string) {
    setProfile(prev => {
      const has = prev.lifestyle.includes(item)
      return { ...prev, lifestyle: has ? prev.lifestyle.filter(l => l !== item) : [...prev.lifestyle, item] }
    })
  }

  function handleSave() {
    const data = { ...profile, completed: true }
    Taro.setStorageSync(PROFILE_KEY, JSON.stringify(data))
    Taro.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 800)
  }

  function handleSkip() {
    Taro.setStorageSync(PROFILE_KEY, JSON.stringify({ ...getDefaultProfile(), completed: true }))
    Taro.navigateBack()
  }

  return (
    <View className='profile-page'>
      {/* Gender */}
      <View className='field'>
        <Text className='label'>性别</Text>
        <Picker mode='selector' range={GENDER_OPTIONS} onChange={e => update('gender', GENDER_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.gender ? 'picker-val' : 'picker-ph'}>{profile.gender || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Age */}
      <View className='field'>
        <Text className='label'>年龄段</Text>
        <Picker mode='selector' range={AGE_OPTIONS} onChange={e => update('age', AGE_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.age ? 'picker-val' : 'picker-ph'}>{profile.age || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Occupation */}
      <View className='field'>
        <Text className='label'>职业</Text>
        <Picker mode='selector' range={OCCUPATION_OPTIONS} onChange={e => update('occupation', OCCUPATION_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.occupation ? 'picker-val' : 'picker-ph'}>{profile.occupation || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Personality */}
      <View className='field'>
        <Text className='label'>性格类型</Text>
        <Picker mode='selector' range={PERSONALITY_OPTIONS} onChange={e => update('personality', PERSONALITY_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.personality ? 'picker-val' : 'picker-ph'}>{profile.personality || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Frequency */}
      <View className='field'>
        <Text className='label'>收纳频率</Text>
        <Picker mode='selector' range={FREQUENCY_OPTIONS} onChange={e => update('frequency', FREQUENCY_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.frequency ? 'picker-val' : 'picker-ph'}>{profile.frequency || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Residents */}
      <View className='field'>
        <Text className='label'>居住人数</Text>
        <Picker mode='selector' range={RESIDENTS_OPTIONS} onChange={e => update('residents', RESIDENTS_OPTIONS[Number(e.detail.value)])}>
          <View className='picker-box'>
            <Text className={profile.residents ? 'picker-val' : 'picker-ph'}>{profile.residents || '请选择'}</Text>
            <Text className='arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      {/* Lifestyle (multi-select tags) */}
      <View className='field'>
        <Text className='label'>生活习惯（可多选）</Text>
        <View className='tags'>
          {LIFESTYLE_OPTIONS.map(item => (
            <View
              key={item}
              className={`tag ${profile.lifestyle.includes(item) ? 'active' : ''}`}
              onClick={() => toggleLifestyle(item)}
            >
              <Text className='tag-text'>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View className='actions'>
        <View className='save-btn' onClick={handleSave}>
          <Text className='save-text'>保存</Text>
        </View>
        <View className='skip-btn' onClick={handleSkip}>
          <Text className='skip-text'>跳过，以后再填</Text>
        </View>
      </View>
    </View>
  )
}
