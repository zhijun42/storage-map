// 云函数：分享链接 + 用户绑定
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action, spaceId, shareToken } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || ''
  console.log(`[share] action=${action} openId=${openId} spaceId=${spaceId || '-'} token=${shareToken || '-'}`)

  if (action === 'create') {
    const token = generateToken()
    console.log(`[share] creating token=${token} for spaceId=${spaceId} by ${openId}`)
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
    console.log(`[share] created successfully`)
    return { success: true, token }
  }

  if (action === 'resolve') {
    console.log(`[share] resolving token=${shareToken}`)
    const res = await db.collection('shares').where({ token: shareToken }).get()
    console.log(`[share] found ${res.data.length} share records`)
    if (res.data.length === 0) {
      return { success: false, error: '链接无效或已过期' }
    }
    const share = res.data[0]
    console.log(`[share] record: createdBy=${share.createdBy} claimedBy=${share.claimedBy} spaceId=${share.spaceId}`)

    // Already claimed by this user (owner or editor)
    if (share.claimedBy === openId || (share.createdBy === openId && share.claimedBy)) {
      console.log(`[share] already claimed by this user`)
      return { success: true, spaceId: share.spaceId, permission: share.createdBy === openId ? 'owner' : share.permission }
    }

    // Already claimed by someone else
    if (share.claimedBy && share.claimedBy !== openId) {
      console.log(`[share] REJECTED: claimed by ${share.claimedBy}, caller is ${openId}`)
      return { success: false, error: '该链接已被其他用户使用' }
    }

    // Unclaimed — bind to this user (locks the token)
    console.log(`[share] claiming for ${openId}`)
    await db.collection('shares').doc(share._id).update({
      data: { claimedBy: openId, claimedAt: new Date() },
    })
    const permission = share.createdBy === openId ? 'owner' : share.permission
    console.log(`[share] claimed successfully, permission=${permission}`)
    return { success: true, spaceId: share.spaceId, permission }
  }

  if (action === 'revoke') {
    const res = await db.collection('shares').where({ spaceId, createdBy: openId }).get()
    for (const share of res.data) {
      await db.collection('shares').doc(share._id).remove()
    }
    console.log(`[share] revoked ${res.data.length} shares`)
    return { success: true, removed: res.data.length }
  }

  if (action === 'status') {
    const res = await db.collection('shares').where({ spaceId, createdBy: openId }).get()
    if (res.data.length === 0) return { success: true, shared: false }
    const share = res.data[0]
    console.log(`[share] status: token=${share.token} claimedBy=${share.claimedBy}`)
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
