/**
 * Mock data seeder — seed rooms/containers into existing "冬宝的家" space.
 * Items are stored as arrays of {name, photo, notes} objects.
 */

import Taro from '@tarojs/taro'
import { getSpaces, deleteSpace, addRoom, addContainer } from './space'

const MOCK_SEEDED_KEY = 'mock_data_seeded_v5'

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

    // Delete old containers/rooms to re-seed with categories
    if (dongbao.containerCount > 0) {
      console.log('[Mock] Clearing old data to re-seed with categories...')
      const fullSpace = await (await import('./space')).getSpace(dongbao._id)
      if (fullSpace?.rooms) {
        for (const room of fullSpace.rooms) {
          await (await import('./space')).deleteRoom(dongbao._id, room._id)
        }
      }
    }

    console.log('[Mock] Seeding data into 冬宝的家...')
    await seedDongbaoData(dongbao._id)
    Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
    console.log('[Mock] Done')
  } catch (e) {
    console.warn('[Mock] Seed failed:', e)
  }
}

function item(name: string, category: string, price: number | string = '') {
  return { name, category, price, createdAt: '2026-04-08', photo: '', notes: '' }
}

async function seedDongbaoData(spaceId: string) {
  const bedroom = await addRoom(spaceId, '主卧')
  if (bedroom) {
    await addContainer(spaceId, String(bedroom._id), {
      name: '衣柜', type: 'wardrobe', movable: false,
      slots: [
        { label: '顶层', type: 'shelf', items: [item('换季棉被', '家居'), item('枕头', '家居'), item('毛毯', '家居')], photo: '' },
        { label: '挂衣区', type: 'rod', items: [item('冬季外套', '衣物'), item('羽绒服', '衣物'), item('职业装', '衣物'), item('休闲外套', '衣物'), item('连衣裙', '衣物'), item('风衣', '衣物')], photo: '' },
        { label: '抽屉-上', type: 'drawer', items: [item('围巾', '衣物'), item('帽子', '衣物'), item('手套', '衣物'), item('包包', '出行')], photo: '' },
        { label: '抽屉-下', type: 'drawer', items: [item('换季棉袄', '衣物'), item('滑雪服', '衣物')], photo: '' },
      ],
    })
    await addContainer(spaceId, String(bedroom._id), {
      name: '五斗柜', type: 'cabinet', movable: false,
      slots: [
        { label: '第1层', type: 'drawer', items: [item('袜子', '衣物'), item('内衣', '衣物')], photo: '' },
        { label: '第2层', type: 'drawer', items: [item('运动T恤', '衣物'), item('运动短裤', '衣物'), item('运动袜', '衣物')], photo: '' },
        { label: '第3层', type: 'drawer', items: [item('运动服套装', '衣物'), item('瑜伽裤', '衣物')], photo: '' },
        { label: '第4层', type: 'drawer', items: [item('睡衣-夏', '衣物'), item('睡衣-冬', '衣物'), item('睡袍', '衣物')], photo: '' },
        { label: '第5层', type: 'drawer', items: [item('游泳裤', '衣物'), item('泳镜', '衣物'), item('瑜伽垫', '衣物')], photo: '' },
      ],
    })
    await addContainer(spaceId, String(bedroom._id), {
      name: '床头柜', type: 'cabinet', movable: true,
      slots: [
        { label: '台面', type: 'shelf', items: [item('台灯', '家居'), item('Kindle阅读器', '数码产品')], photo: '' },
        { label: '抽屉', type: 'drawer', items: [item('护照', '证件'), item('身份证复印件', '证件'), item('常备药品', '医用品'), item('耳塞', '日用品'), item('眼罩', '日用品')], photo: '' },
      ],
    })
  }

  const livingRoom = await addRoom(spaceId, '客厅')
  if (livingRoom) {
    await addContainer(spaceId, String(livingRoom._id), {
      name: '电视柜', type: 'cabinet', movable: false,
      slots: [
        { label: '台面', type: 'shelf', items: [item('PS5游戏机', '数码产品'), item('路由器', '数码产品'), item('蓝牙音箱', '数码产品')], photo: '' },
        { label: '左柜', type: 'shelf', items: [item('PS5手柄', '数码产品'), item('Switch', '数码产品'), item('Switch游戏卡', '数码产品')], photo: '' },
        { label: '右柜', type: 'drawer', items: [item('遥控器', '数码产品'), item('充电线套装', '数码产品'), item('HDMI线', '数码产品')], photo: '' },
      ],
    })
    await addContainer(spaceId, String(livingRoom._id), {
      name: '书架', type: 'shelf', movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: [item('《人类简史》', '书籍'), item('《三体》', '书籍'), item('《设计心理学》', '书籍'), item('《百年孤独》', '书籍')], photo: '' },
        { label: '第2层', type: 'shelf', items: [item('《JavaScript高级编程》', '书籍'), item('《深入理解计算机系统》', '书籍')], photo: '' },
        { label: '第3层', type: 'shelf', items: [item('笔记本', '日用品'), item('文件夹', '日用品'), item('文具收纳盒', '日用品')], photo: '' },
      ],
    })
    await addContainer(spaceId, String(livingRoom._id), {
      name: '储物柜', type: 'cabinet', movable: false,
      slots: [
        { label: '上层', type: 'drawer', items: [item('扑克牌', '玩具'), item('UNO卡牌', '玩具'), item('飞行棋', '玩具')], photo: '' },
        { label: '下层', type: 'drawer', items: [item('针线盒', '日用品'), item('香薰蜡烛', '日用品'), item('打火机', '日用品')], photo: '' },
      ],
    })
  }

  const entrance = await addRoom(spaceId, '玄关')
  if (entrance) {
    await addContainer(spaceId, String(entrance._id), {
      name: '鞋柜', type: 'cabinet', movable: false,
      slots: [
        { label: '上层', type: 'shelf', items: [item('Nike运动鞋', '鞋类'), item('Clarks皮鞋', '鞋类'), item('New Balance跑鞋', '鞋类')], photo: '' },
        { label: '下层', type: 'shelf', items: [item('拖鞋', '鞋类'), item('雨伞', '出行'), item('鞋油套装', '日用品')], photo: '' },
      ],
    })
  }

  const secondBedroom = await addRoom(spaceId, '次卧')
  if (secondBedroom) {
    await addContainer(spaceId, String(secondBedroom._id), {
      name: '书柜', type: 'shelf', movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: [item('富士X-T5相机', '数码产品'), item('XF35mm镜头', '数码产品'), item('Peak Design背带', '数码产品')], photo: '' },
        { label: '第2层', type: 'shelf', items: [item('哈利波特乐高', '收藏'), item('星球大战手办', '收藏')], photo: '' },
        { label: '第3层', type: 'shelf', items: [item('家庭药箱', '医用品'), item('温度计', '医用品'), item('创可贴', '医用品')], photo: '' },
        { label: '第4层', type: 'open', items: [item('行李箱28寸', '出行'), item('双肩背包', '出行')], photo: '' },
      ],
    })
  }
}
