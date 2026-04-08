// 云函数：初始化数据库集合
// 在微信开发者工具中右键此文件夹 → "上传并部署" → 然后在小程序中调用一次即可

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = ['spaces', 'rooms', 'containers', 'slots', 'shares']

exports.main = async () => {
  const results = []

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      if (err.errCode === -502003) {
        results.push({ name, status: 'already exists' })
      } else {
        results.push({ name, status: 'error', error: err.message })
      }
    }
  }

  return { success: true, results }
}
