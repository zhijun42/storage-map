/**
 * Mock data seeder — seed rooms/containers into existing "冬宝的家" space
 * and clean up other test spaces.
 */

import Taro from '@tarojs/taro'
import { getSpaces, deleteSpace, addRoom, addContainer } from './space'

const MOCK_SEEDED_KEY = 'mock_data_seeded_v3'

export async function seedMockDataIfNeeded() {
  try {
    const seeded = Taro.getStorageSync(MOCK_SEEDED_KEY)
    if (seeded) return

    console.log('[Mock] Starting mock data setup...')
    const spaces = await getSpaces()

    // Clean up old test spaces
    for (const space of spaces) {
      if (space.name !== '冬宝的家') {
        console.log('[Mock] Removing old test space:', space.name)
        await deleteSpace(space._id)
      }
    }

    // Find 冬宝的家
    const dongbao = spaces.find((s: any) => s.name === '冬宝的家')
    if (!dongbao) {
      console.log('[Mock] 冬宝的家 not found, skipping')
      Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
      return
    }

    // Only seed if space has no containers yet
    if (dongbao.containerCount > 0) {
      console.log('[Mock] 冬宝的家 already has containers, skipping')
      Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
      return
    }

    console.log('[Mock] Seeding rooms and containers into 冬宝的家...')
    await seedDongbaoData(dongbao._id)
    Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
    console.log('[Mock] Done')
  } catch (e) {
    console.warn('[Mock] Seed failed:', e)
  }
}

async function seedDongbaoData(spaceId: string) {
  // 主卧
  const bedroom = await addRoom(spaceId, '主卧')
  if (bedroom) {
    await addContainer(spaceId, String(bedroom._id), {
      name: '衣柜',
      type: 'wardrobe',
      movable: false,
      slots: [
        { label: '顶层', type: 'shelf', items: '换季棉被×2、枕头×4', photo: '' },
        { label: '挂衣区', type: 'rod', items: '冬季外套×4、羽绒服×2、职业装×6、休闲外套×3', photo: '' },
        { label: '抽屉-上', type: 'drawer', items: '围巾×8、包包×5', photo: '' },
        { label: '抽屉-下', type: 'drawer', items: '换季棉袄×2', photo: '' },
      ],
    })

    await addContainer(spaceId, String(bedroom._id), {
      name: '五斗柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '第1层', type: 'drawer', items: '袜子×20双、内衣', photo: '' },
        { label: '第2层', type: 'drawer', items: '围巾×4、帽子×3、手套×2双', photo: '' },
        { label: '第3层', type: 'drawer', items: '运动服套装×3', photo: '' },
        { label: '第4层', type: 'drawer', items: '睡衣×4套', photo: '' },
        { label: '第5层', type: 'drawer', items: '游泳装备、瑜伽服', photo: '' },
      ],
    })

    await addContainer(spaceId, String(bedroom._id), {
      name: '床头柜',
      type: 'cabinet',
      movable: true,
      slots: [
        { label: '台面', type: 'shelf', items: '台灯、Kindle阅读器', photo: '' },
        { label: '抽屉', type: 'drawer', items: '护照、身份证复印件、常备药品、耳塞', photo: '' },
      ],
    })
  }

  // 客厅
  const livingRoom = await addRoom(spaceId, '客厅')
  if (livingRoom) {
    await addContainer(spaceId, String(livingRoom._id), {
      name: '电视柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '台面', type: 'shelf', items: 'PS5游戏机、路由器、蓝牙音箱', photo: '' },
        { label: '左柜', type: 'shelf', items: 'PS5手柄×2、Switch游戏卡×12', photo: '' },
        { label: '右柜', type: 'drawer', items: '遥控器×3、充电线套装、HDMI线', photo: '' },
      ],
    })

    await addContainer(spaceId, String(livingRoom._id), {
      name: '书架',
      type: 'shelf',
      movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: '《人类简史》《三体》《设计心理学》《百年孤独》', photo: '' },
        { label: '第2层', type: 'shelf', items: '《JavaScript高级编程》《深入理解计算机系统》', photo: '' },
        { label: '第3层', type: 'shelf', items: '笔记本×5、文件夹×3、文具收纳盒', photo: '' },
      ],
    })

    await addContainer(spaceId, String(livingRoom._id), {
      name: '储物柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '上层', type: 'drawer', items: '扑克牌、UNO卡牌、桌游', photo: '' },
        { label: '下层', type: 'drawer', items: '针线盒、香薰蜡烛×3', photo: '' },
      ],
    })
  }

  // 玄关
  const entrance = await addRoom(spaceId, '玄关')
  if (entrance) {
    await addContainer(spaceId, String(entrance._id), {
      name: '鞋柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '上层', type: 'shelf', items: 'Nike运动鞋、Clarks皮鞋、New Balance跑鞋', photo: '' },
        { label: '下层', type: 'shelf', items: '拖鞋×2、雨伞、鞋油套装', photo: '' },
      ],
    })
  }

  // 次卧
  const secondBedroom = await addRoom(spaceId, '次卧')
  if (secondBedroom) {
    await addContainer(spaceId, String(secondBedroom._id), {
      name: '书柜',
      type: 'shelf',
      movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: '富士X-T5相机、XF35mm镜头、Peak Design背带', photo: '' },
        { label: '第2层', type: 'shelf', items: '哈利波特乐高模型、星球大战手办', photo: '' },
        { label: '第3层', type: 'shelf', items: '家庭药箱、温度计', photo: '' },
        { label: '第4层', type: 'open', items: '行李箱28寸、双肩背包', photo: '' },
      ],
    })
  }
}
