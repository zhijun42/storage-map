/**
 * Mock data seeder — seed rooms/containers into existing "冬宝的家" space.
 * Items are stored as arrays of {name, photo, notes} objects.
 */

import Taro from '@tarojs/taro'
import { getSpaces, deleteSpace, addRoom, addContainer } from './space'

const MOCK_SEEDED_KEY = 'mock_data_seeded_v4'

export async function seedMockDataIfNeeded() {
  try {
    const seeded = Taro.getStorageSync(MOCK_SEEDED_KEY)
    if (seeded) return

    console.log('[Mock] Starting mock data setup...')
    const spaces = await getSpaces()

    for (const space of spaces) {
      if (space.name !== '冬宝的家') {
        console.log('[Mock] Removing old test space:', space.name)
        await deleteSpace(space._id)
      }
    }

    const dongbao = spaces.find((s: any) => s.name === '冬宝的家')
    if (!dongbao) {
      console.log('[Mock] 冬宝的家 not found, skipping')
      Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
      return
    }

    if (dongbao.containerCount > 0) {
      console.log('[Mock] 冬宝的家 already has containers, skipping')
      Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
      return
    }

    console.log('[Mock] Seeding data into 冬宝的家...')
    await seedDongbaoData(dongbao._id)
    Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
    console.log('[Mock] Done')
  } catch (e) {
    console.warn('[Mock] Seed failed:', e)
  }
}

function items(...names: string[]) {
  return names.map(name => ({ name, photo: '', notes: '' }))
}

async function seedDongbaoData(spaceId: string) {
  const bedroom = await addRoom(spaceId, '主卧')
  if (bedroom) {
    await addContainer(spaceId, String(bedroom._id), {
      name: '衣柜', type: 'wardrobe', movable: false,
      slots: [
        { label: '顶层', type: 'shelf', items: items('换季棉被', '枕头', '毛毯'), photo: '' },
        { label: '挂衣区', type: 'rod', items: items('冬季外套', '羽绒服', '职业装', '休闲外套', '连衣裙', '风衣'), photo: '' },
        { label: '抽屉-上', type: 'drawer', items: items('围巾', '帽子', '手套', '包包'), photo: '' },
        { label: '抽屉-下', type: 'drawer', items: items('换季棉袄', '滑雪服'), photo: '' },
      ],
    })
    await addContainer(spaceId, String(bedroom._id), {
      name: '五斗柜', type: 'cabinet', movable: false,
      slots: [
        { label: '第1层', type: 'drawer', items: items('袜子', '内衣'), photo: '' },
        { label: '第2层', type: 'drawer', items: items('运动T恤', '运动短裤', '运动袜'), photo: '' },
        { label: '第3层', type: 'drawer', items: items('运动服套装', '瑜伽裤'), photo: '' },
        { label: '第4层', type: 'drawer', items: items('睡衣-夏', '睡衣-冬', '睡袍'), photo: '' },
        { label: '第5层', type: 'drawer', items: items('游泳裤', '泳镜', '瑜伽垫'), photo: '' },
      ],
    })
    await addContainer(spaceId, String(bedroom._id), {
      name: '床头柜', type: 'cabinet', movable: true,
      slots: [
        { label: '台面', type: 'shelf', items: items('台灯', 'Kindle阅读器'), photo: '' },
        { label: '抽屉', type: 'drawer', items: items('护照', '身份证复印件', '常备药品', '耳塞', '眼罩'), photo: '' },
      ],
    })
  }

  const livingRoom = await addRoom(spaceId, '客厅')
  if (livingRoom) {
    await addContainer(spaceId, String(livingRoom._id), {
      name: '电视柜', type: 'cabinet', movable: false,
      slots: [
        { label: '台面', type: 'shelf', items: items('PS5游戏机', '路由器', '蓝牙音箱'), photo: '' },
        { label: '左柜', type: 'shelf', items: items('PS5手柄', 'Switch', 'Switch游戏卡'), photo: '' },
        { label: '右柜', type: 'drawer', items: items('遥控器', '充电线套装', 'HDMI线'), photo: '' },
      ],
    })
    await addContainer(spaceId, String(livingRoom._id), {
      name: '书架', type: 'shelf', movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: items('《人类简史》', '《三体》', '《设计心理学》', '《百年孤独》'), photo: '' },
        { label: '第2层', type: 'shelf', items: items('《JavaScript高级编程》', '《深入理解计算机系统》'), photo: '' },
        { label: '第3层', type: 'shelf', items: items('笔记本', '文件夹', '文具收纳盒'), photo: '' },
      ],
    })
    await addContainer(spaceId, String(livingRoom._id), {
      name: '储物柜', type: 'cabinet', movable: false,
      slots: [
        { label: '上层', type: 'drawer', items: items('扑克牌', 'UNO卡牌', '飞行棋'), photo: '' },
        { label: '下层', type: 'drawer', items: items('针线盒', '香薰蜡烛', '打火机'), photo: '' },
      ],
    })
  }

  const entrance = await addRoom(spaceId, '玄关')
  if (entrance) {
    await addContainer(spaceId, String(entrance._id), {
      name: '鞋柜', type: 'cabinet', movable: false,
      slots: [
        { label: '上层', type: 'shelf', items: items('Nike运动鞋', 'Clarks皮鞋', 'New Balance跑鞋'), photo: '' },
        { label: '下层', type: 'shelf', items: items('拖鞋', '雨伞', '鞋油套装'), photo: '' },
      ],
    })
  }

  const secondBedroom = await addRoom(spaceId, '次卧')
  if (secondBedroom) {
    await addContainer(spaceId, String(secondBedroom._id), {
      name: '书柜', type: 'shelf', movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: items('富士X-T5相机', 'XF35mm镜头', 'Peak Design背带'), photo: '' },
        { label: '第2层', type: 'shelf', items: items('哈利波特乐高', '星球大战手办'), photo: '' },
        { label: '第3层', type: 'shelf', items: items('家庭药箱', '温度计', '创可贴'), photo: '' },
        { label: '第4层', type: 'open', items: items('行李箱28寸', '双肩背包'), photo: '' },
      ],
    })
  }
}
