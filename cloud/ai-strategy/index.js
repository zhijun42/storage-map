const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_KEY = 'sk-u4RwSO07PsQSDb5L0qX5iUvnOFKnKujrC96soYasasTyBwl9'
const API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const MODEL = 'kimi-k2.5'

function callLLM(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 1,
    })

    const url = new URL(API_URL)
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content)
          } else {
            reject(new Error(`[${MODEL}] Unexpected API response: ` + data.slice(0, 200)))
          }
        } catch (e) {
          reject(new Error(`[${MODEL}] Parse error: ` + e.message))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(55000, () => { req.destroy(); reject(new Error(`[${MODEL}] Request timeout (55s)`)) })
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const { spaceData, profileData } = event

  const prompt = buildPrompt(spaceData, profileData)

  try {
    console.log(`[ai-strategy] Calling ${MODEL} via ${API_URL}`)
    const result = await callLLM(prompt)
    console.log(`[ai-strategy] ${MODEL} responded, length: ${result.length} chars`)
    return { success: true, content: result, model: MODEL }
  } catch (err) {
    console.error(`[ai-strategy] ${MODEL} API error:`, err)
    return { success: false, error: err.message || 'AI服务暂时不可用', model: MODEL }
  }
}

function buildPrompt(spaceData, profileData) {
  let prompt = `你是一位专业的家居收纳顾问，同时了解一些基本的居家风水知识。请根据以下用户的房屋布局、储物空间和个人信息，给出详细的收纳优化建议。

## 用户信息
`

  if (profileData) {
    if (profileData.gender) prompt += `- 性别：${profileData.gender}\n`
    if (profileData.age) prompt += `- 年龄段：${profileData.age}\n`
    if (profileData.occupation) prompt += `- 职业：${profileData.occupation}\n`
    if (profileData.personality) prompt += `- 性格类型：${profileData.personality}\n`
    if (profileData.frequency) prompt += `- 收纳频率：${profileData.frequency}\n`
    if (profileData.residents) prompt += `- 居住人数：${profileData.residents}\n`
    if (profileData.lifestyle?.length > 0) prompt += `- 生活习惯：${profileData.lifestyle.join('、')}\n`
  }

  prompt += `\n## 房屋布局\n`

  if (spaceData?.rooms) {
    spaceData.rooms.forEach(room => {
      prompt += `\n### ${room.name}\n`
      if (room.containers?.length > 0) {
        room.containers.forEach(c => {
          prompt += `- **${c.name}**\n`
          if (c.slots?.length > 0) {
            c.slots.forEach(s => {
              const cats = s.categories?.length > 0 ? s.categories.join('+') : s.label
              const type = s.type === 'drawer' ? '抽屉' : '开放层'
              const items = Array.isArray(s.items) ? s.items : []
              const itemNames = items.map(i => typeof i === 'string' ? i : i.name).filter(Boolean)
              prompt += `  - ${cats}(${type})`
              if (itemNames.length > 0) prompt += `：${itemNames.join('、')}`
              prompt += '\n'
            })
          }
        })
      }
    })
  }

  prompt += `
## 请严格按以下格式输出（Markdown）：

**一、收纳优化建议**

针对每个房间的储物柜，分析当前物品分类是否合理，给出具体的调整建议和理由（使用频率、动线优化等）。

**二、风水小贴士**

简要点评当前布局的风水情况（2-3条），如有需要调整的给出建议。

**三、购置推荐**

推荐具体的收纳产品，给出品牌型号、参考价格和电商搜索关键词（方便用户在京东/淘宝搜索购买）。

格式要求：
- 用 **加粗** 标记小标题，用 - 列表项展示建议
- 不要使用 # ## ### 等标题语法
- 建议具体可操作，语气友善专业
- 总长度600-800字
- 结尾直接结束建议，不要写"如需进一步""欢迎追问"等邀请性结语`

  return prompt
}
