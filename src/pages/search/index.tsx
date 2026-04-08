import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { searchItems } from '../../services/space'
import './index.scss'

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <Text>{text}</Text>
  const lowerText = text.toLowerCase()
  const lowerKey = keyword.toLowerCase()
  const parts: { text: string; highlight: boolean }[] = []
  let lastIndex = 0

  let pos = lowerText.indexOf(lowerKey)
  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push({ text: text.slice(lastIndex, pos), highlight: false })
    }
    parts.push({ text: text.slice(pos, pos + keyword.length), highlight: true })
    lastIndex = pos + keyword.length
    pos = lowerText.indexOf(lowerKey, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false })
  }

  return (
    <Text>
      {parts.map((part, i) =>
        part.highlight ? (
          <Text key={i} className='highlight'>{part.text}</Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)
    if (!value.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    const res = await searchItems(value)
    setResults(res)
    setSearched(true)
  }

  function handleNavigateToContainer(result: any) {
    if (result.spaceId && result.roomId && result.containerId) {
      Taro.navigateTo({
        url: `/pages/container/index?spaceId=${result.spaceId}&roomId=${result.roomId}&containerId=${result.containerId}`,
      })
    }
  }

  return (
    <View className='search-page'>
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索物品（如：护照、充电器、T恤）'
          value={query}
          focus
          confirmType='search'
          onInput={(e) => handleSearch(e.detail.value)}
        />
      </View>

      {searched && results.length === 0 && (
        <View className='empty'>
          <Text>没有找到 "{query}"</Text>
        </View>
      )}

      <View className='results-count'>
        {searched && results.length > 0 && (
          <Text className='count-text'>找到 {results.length} 个结果</Text>
        )}
      </View>

      {results.map((result, index) => (
        <View key={index} className='result-card' onClick={() => handleNavigateToContainer(result)}>
          <View className='result-location'>
            <Text className='location-space'>{result.spaceName}</Text>
            <Text className='location-sep'> &gt; </Text>
            <Text className='location-room'>{result.roomName}</Text>
            <Text className='location-sep'> &gt; </Text>
            <Text className='location-container'>{result.containerName}</Text>
          </View>
          <View className='result-slot'>
            <Text className='slot-label'>{result.slotLabel}</Text>
          </View>
          <View className='result-items'>
            <HighlightText text={result.items} keyword={query} />
          </View>
        </View>
      ))}
    </View>
  )
}
