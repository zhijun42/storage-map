import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import { searchItems } from '../../services/space'
import './index.scss'

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

  return (
    <View className='search-page'>
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索物品（如：护照、充电器、T恤）'
          value={query}
          focus
          onInput={(e) => handleSearch(e.detail.value)}
        />
      </View>

      {searched && results.length === 0 && (
        <View className='empty'>
          <Text>没有找到 "{query}"</Text>
        </View>
      )}

      {results.map((result, index) => (
        <View key={index} className='result-card'>
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
            <Text>{result.items}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
