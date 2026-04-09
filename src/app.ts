import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
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
    pullFromCloudIfEmpty()
  }, [])

  return children
}

export default App
