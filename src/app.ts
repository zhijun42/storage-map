import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { seedMockDataIfNeeded } from './services/mock-data'
import { pullFromCloudIfEmpty } from './services/space'
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
    pullFromCloudIfEmpty()

    // Hackathon: always show onboarding on launch for demo purposes
    Taro.removeStorageSync('onboarding_done')
    setTimeout(() => {
      Taro.navigateTo({ url: '/pages/onboarding/index' })
    }, 500)
  }, [])

  return children
}

export default App
