// 云函数：生成分享链接
// 接收spaceId，返回分享token，住户通过token访问物品地图

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action, spaceId, shareToken } = event

  if (action === 'create') {
    // 生成分享token
    const token = generateToken()
    await db.collection('shares').add({
      data: {
        spaceId,
        token,
        createdBy: event.userInfo?.openId || 'unknown',
        createdAt: new Date(),
        permission: 'editor', // 住户默认可编辑
      },
    })
    return { success: true, token }
  }

  if (action === 'resolve') {
    // 通过token获取spaceId
    const res = await db.collection('shares').where({ token: shareToken }).get()
    if (res.data.length === 0) {
      return { success: false, error: 'Invalid share token' }
    }
    return { success: true, spaceId: res.data[0].spaceId, permission: res.data[0].permission }
  }

  return { success: false, error: 'Unknown action' }
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
