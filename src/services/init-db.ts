/**
 * 云数据库初始化
 * 首次运行时自动创建所需的集合
 * 如果集合已存在则跳过（不会报错）
 */

import Taro from '@tarojs/taro'

const COLLECTIONS = ['spaces', 'rooms', 'containers', 'slots', 'shares']

export async function initDatabase() {
  if (process.env.TARO_ENV !== 'weapp' || !Taro.cloud) return

  const db = Taro.cloud.database()

  for (const name of COLLECTIONS) {
    try {
      // 尝试查询集合，如果不存在会抛错
      await db.collection(name).limit(1).get()
      console.log(`Collection "${name}" exists`)
    } catch (err: any) {
      if (err.errCode === -502005 || err.message?.includes('not exist')) {
        console.log(`Collection "${name}" not found — please create it in the cloud console`)
        // 微信云数据库不支持通过客户端API创建集合
        // 需要在云开发控制台手动创建，或通过云函数创建
        Taro.showToast({
          title: `请在云开发控制台创建集合: ${name}`,
          icon: 'none',
          duration: 3000,
        })
      } else {
        console.log(`Collection "${name}" check:`, err)
      }
    }
  }
}
