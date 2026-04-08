import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { seedMockDataIfNeeded } from './services/mock-data'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud?.init({
        env: 'cloud1-1g7j9oatd5d871f3',
      })
      console.log(`[${new Date().toISOString().slice(11,23)}] Cloud initialized`)
    }
    seedMockDataIfNeeded()

    // First-launch: prompt user profile
    try {
      const profile = Taro.getStorageSync('user_profile')
      if (!profile) {
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/profile/index' })
        }, 1000)
      }
    } catch {}
  }, [])

  return children
}

export default App
