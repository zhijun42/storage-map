// 云函数：分享链接 + 用户绑定
// create: 收纳师生成分享token
// resolve: 住户打开链接，第一个用户自动绑定（claimedBy）
// revoke: 收纳师撤销分享

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action, spaceId, shareToken } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || ''

  if (action === 'create') {
    const token = generateToken()
    await db.collection('shares').add({
      data: {
        spaceId,
        token,
        createdBy: openId,
        claimedBy: null,
        permission: 'editor',
        createdAt: new Date(),
      },
    })
    return { success: true, token }
  }

  if (action === 'resolve') {
    const res = await db.collection('shares').where({ token: shareToken }).get()
    if (res.data.length === 0) {
      return { success: false, error: '链接无效或已过期' }
    }
    const share = res.data[0]

    // Already claimed by this user (owner or editor)
    if (share.claimedBy === openId || (share.createdBy === openId && share.claimedBy)) {
      return { success: true, spaceId: share.spaceId, permission: share.createdBy === openId ? 'owner' : share.permission }
    }

    // Already claimed by someone else
    if (share.claimedBy && share.claimedBy !== openId) {
      return { success: false, error: '该链接已被其他用户使用' }
    }

    // Unclaimed — bind to this user (locks the token)
    await db.collection('shares').doc(share._id).update({
      data: { claimedBy: openId, claimedAt: new Date() },
    })
    const permission = share.createdBy === openId ? 'owner' : share.permission
    return { success: true, spaceId: share.spaceId, permission }
  }

  if (action === 'revoke') {
    const res = await db.collection('shares').where({ spaceId, createdBy: openId }).get()
    for (const share of res.data) {
      await db.collection('shares').doc(share._id).remove()
    }
    return { success: true, removed: res.data.length }
  }

  if (action === 'status') {
    const res = await db.collection('shares').where({ spaceId, createdBy: openId }).get()
    if (res.data.length === 0) return { success: true, shared: false }
    const share = res.data[0]
    return {
      success: true,
      shared: true,
      token: share.token,
      claimedBy: share.claimedBy || null,
      claimedAt: share.claimedAt || null,
    }
  }

  return { success: false, error: 'Unknown action' }
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 2; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
