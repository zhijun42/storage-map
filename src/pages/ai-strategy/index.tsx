import { View, Text, RichText } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getSpaces, getSpace } from '../../services/space'
import { normalizeItems } from '../../services/items'
import './index.scss'

// Markdown → safe HTML (no headings, just bold/italic/list/br)
function md2html(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<div class="md-li">$1</div>')
    .replace(/^\d+\. (.+)/gm, '<div class="md-li">$1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

interface Stats {
  totalItems: number
  totalContainers: number
  totalRooms: number
  categoryMap: Record<string, number>
}

function computeStats(spaceData: any): Stats {
  const stats: Stats = { totalItems: 0, totalContainers: 0, totalRooms: 0, categoryMap: {} }
  if (!spaceData?.rooms) return stats
  stats.totalRooms = spaceData.rooms.length
  for (const room of spaceData.rooms) {
    for (const container of (room.containers || [])) {
      stats.totalContainers++
      for (const slot of (container.slots || [])) {
        const items = normalizeItems(slot.items)
        stats.totalItems += items.length
        for (const item of items) {
          const cat = item.category || '未分类'
          stats.categoryMap[cat] = (stats.categoryMap[cat] || 0) + 1
        }
      }
    }
  }
  return stats
}

export default function AIStrategyPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [modelName, setModelName] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setResult('')
    setStats(null)

    try {
      const spaces = await getSpaces()
      let spaceData: any = null
      if (spaces.length > 0) spaceData = await getSpace(spaces[0]._id)

      let profileData: any = null
      try {
        const saved = Taro.getStorageSync('user_profile')
        if (saved) profileData = JSON.parse(saved)
      } catch {}

      if (!spaceData?.rooms?.length) {
        setError('请先完成空间绘制和储物柜设定')
        setLoading(false)
        return
      }

      // Compute and display statistics
      const computed = computeStats(spaceData)
      setStats(computed)

      const res = await Taro.cloud.callFunction({
        name: 'ai-strategy',
        data: { spaceData, profileData },
      })

      const payload = res.result as any
      if (payload?.model) setModelName(payload.model)
      if (payload?.success) {
        setResult(payload.content)
      } else {
        setError(payload?.error || 'AI 服务暂时不可用，请稍后重试')
      }
    } catch (e: any) {
      console.error('AI strategy error:', e)
      const errMsg = e.message || '网络错误'
      setError(errMsg)
    }

    setLoading(false)
  }

  // Sort categories by count descending
  const sortedCats = stats
    ? Object.entries(stats.categoryMap).sort((a, b) => b[1] - a[1])
    : []
  const maxCatCount = sortedCats.length > 0 ? sortedCats[0][1] : 1

  return (
    <View className='ai-page'>
      {!result && !loading && !stats && (
        <View className='intro'>
          <Text className='intro-title'>AI 收纳策略</Text>
          <Text className='intro-desc'>
            基于你的房屋布局、储物空间和个人偏好，AI 将为你生成个性化的收纳优化建议、风水小贴士和购置推荐。
          </Text>
          <View className='generate-btn' onClick={handleGenerate}>
            <Text className='generate-text'>生成收纳策略</Text>
          </View>
          {error ? <Text className='error-text'>{error}</Text> : null}
        </View>
      )}

      {/* Statistics section */}
      {stats && (
        <View className='stats-section'>
          <Text className='section-title'>空间数据概览</Text>
          <View className='stats-summary'>
            <View className='stat-item'>
              <Text className='stat-num'>{stats.totalRooms}</Text>
              <Text className='stat-label'>房间</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-num'>{stats.totalContainers}</Text>
              <Text className='stat-label'>储物柜</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-num'>{stats.totalItems}</Text>
              <Text className='stat-label'>物品</Text>
            </View>
          </View>

          {sortedCats.length > 0 && (
            <View className='chart-card'>
              <Text className='chart-title'>物品分类分布</Text>
              {sortedCats.map(([cat, count]) => (
                <View key={cat} className='bar-row'>
                  <Text className='bar-label'>{cat}</Text>
                  <View className='bar-track'>
                    <View className='bar-fill' style={{ width: `${(count / maxCatCount) * 100}%` }} />
                  </View>
                  <Text className='bar-count'>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {loading && (
        <View className='loading-state'>
          <Text className='loading-text'>AI 正在分析你的空间...</Text>
          <Text className='loading-sub'>通常需要 20-30 秒</Text>
        </View>
      )}

      {result && (
        <View className='result'>
          <View className='result-header'>
            <Text className='result-title'>收纳策略报告</Text>
            {modelName ? <Text className='model-tag'>Powered by {modelName}</Text> : null}
          </View>
          <View className='result-body'>
            <RichText nodes={md2html(result)} />
          </View>
          <View className='result-actions'>
            <View className='retry-btn' onClick={() => { setResult(''); setStats(null); handleGenerate() }}>
              <Text className='retry-text'>重新生成</Text>
            </View>
            <View className='contact-btn' onClick={() => {
              Taro.showModal({
                title: '联系收纳师',
                content: '专业收纳整理服务\n\n微信：warm-space-org\n电话：400-888-0000',
                showCancel: false,
              })
            }}>
              <Text className='contact-text'>联系收纳师</Text>
            </View>
          </View>
        </View>
      )}

      {error && (stats || loading) && (
        <View className='error-box'>
          <Text className='error-text'>{error}</Text>
          <View className='retry-btn' onClick={() => { setError(''); handleGenerate() }}>
            <Text className='retry-text'>重试</Text>
          </View>
        </View>
      )}
    </View>
  )
}
