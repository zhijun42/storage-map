/**
 * Mock data seeder — 自动注入测试数据
 *
 * 通过 flag 控制，只注入一次。
 * 通过 services/space.ts 的统一接口写入，
 * 因此 localStorage 和云数据库模式都能工作。
 */

import Taro from '@tarojs/taro'
import { createSpace, addRoom, addContainer } from './space'

const MOCK_SEEDED_KEY = 'mock_data_seeded_v2'

export async function seedMockDataIfNeeded() {
  try {
    const seeded = Taro.getStorageSync(MOCK_SEEDED_KEY)
    if (seeded) {
      console.log('[Mock] Already seeded, skipping')
      return
    }

    console.log('[Mock] Seeding mock data...')
    await seedMockData()
    Taro.setStorageSync(MOCK_SEEDED_KEY, '1')
    console.log('[Mock] Done seeding')
  } catch (e) {
    console.warn('[Mock] Seed failed:', e)
  }
}

async function seedMockData() {
  // === Space 1: 张先生的家 ===
  const space1 = await createSpace('张先生的家')
  if (!space1) return

  // 卧室
  const bedroom = await addRoom(space1._id, '主卧')
  if (bedroom) {
    await addContainer(space1._id, bedroom._id, {
      name: '主衣柜',
      type: 'wardrobe',
      movable: false,
      slots: [
        { label: '顶层', type: 'shelf', items: '换季棉被×2、枕头×4', photo: '' },
        { label: '挂衣区', type: 'hanging', items: '西装×3、衬衫×8、连衣裙×5', photo: '' },
        { label: '抽屉-上', type: 'drawer', items: 'T恤×15、短裤×8', photo: '' },
        { label: '抽屉-下', type: 'drawer', items: '运动裤×6、牛仔裤×4', photo: '' },
      ],
    })

    await addContainer(space1._id, bedroom._id, {
      name: '床头柜',
      type: 'cabinet',
      movable: true,
      slots: [
        { label: '台面', type: 'shelf', items: '台灯、手机充电器、眼镜盒', photo: '' },
        { label: '抽屉', type: 'drawer', items: '护照、身份证复印件、常备药品、耳塞', photo: '' },
      ],
    })

    await addContainer(space1._id, bedroom._id, {
      name: '五斗柜',
      type: 'cabinet',
      movable: true,
      slots: [
        { label: '第1层', type: 'drawer', items: '袜子×20双、内衣', photo: '' },
        { label: '第2层', type: 'drawer', items: '围巾×4、帽子×3、手套×2双', photo: '' },
        { label: '第3层', type: 'drawer', items: '运动服套装×3', photo: '' },
        { label: '第4层', type: 'drawer', items: '睡衣×4套', photo: '' },
        { label: '第5层', type: 'drawer', items: '游泳装备、瑜伽服', photo: '' },
      ],
    })
  }

  // 客厅
  const livingRoom = await addRoom(space1._id, '客厅')
  if (livingRoom) {
    await addContainer(space1._id, livingRoom._id, {
      name: '电视柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '台面', type: 'shelf', items: '电视、路由器、音箱', photo: '' },
        { label: '左柜', type: 'shelf', items: '游戏手柄×2、Switch游戏卡×12', photo: '' },
        { label: '右柜', type: 'shelf', items: '相册×3、充电线缆收纳盒', photo: '' },
      ],
    })

    await addContainer(space1._id, livingRoom._id, {
      name: '书架',
      type: 'shelf',
      movable: false,
      slots: [
        { label: '第1层', type: 'shelf', items: '《人类简史》《三体》《设计心理学》', photo: '' },
        { label: '第2层', type: 'shelf', items: '《JavaScript高级编程》《深入理解计算机系统》', photo: '' },
        { label: '第3层', type: 'shelf', items: '笔记本×5、文件夹×3、文具收纳盒', photo: '' },
      ],
    })
  }

  // 厨房
  const kitchen = await addRoom(space1._id, '厨房')
  if (kitchen) {
    await addContainer(space1._id, kitchen._id, {
      name: '吊柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '左区', type: 'shelf', items: '碗×12、盘子×8、杯子×6', photo: '' },
        { label: '中区', type: 'shelf', items: '调料（盐、糖、酱油、醋、料酒、胡椒）', photo: '' },
        { label: '右区', type: 'shelf', items: '保鲜膜、锡纸、保鲜袋、垃圾袋', photo: '' },
      ],
    })

    await addContainer(space1._id, kitchen._id, {
      name: '橱柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '台面下-左', type: 'shelf', items: '炒锅、汤锅、蒸锅', photo: '' },
        { label: '台面下-右', type: 'shelf', items: '电饭煲、豆浆机、烤面包机', photo: '' },
      ],
    })
  }

  // 卫生间
  const bathroom = await addRoom(space1._id, '卫生间')
  if (bathroom) {
    await addContainer(space1._id, bathroom._id, {
      name: '浴室柜',
      type: 'cabinet',
      movable: false,
      slots: [
        { label: '镜柜', type: 'shelf', items: '牙膏×2、牙刷×2、漱口水、剃须刀', photo: '' },
        { label: '台面下', type: 'shelf', items: '洗衣液、柔顺剂、备用洗发水×2、沐浴露×1', photo: '' },
      ],
    })
  }

  // === Space 2: 李女士的公寓（较简单的space，用于测试多space场景）===
  const space2 = await createSpace('李女士的公寓')
  if (!space2) return

  const room2 = await addRoom(space2._id, '卧室')
  if (room2) {
    await addContainer(space2._id, room2._id, {
      name: '衣柜',
      type: 'wardrobe',
      movable: false,
      slots: [
        { label: '上层', type: 'shelf', items: '冬季外套×4、羽绒服×2', photo: '' },
        { label: '挂衣区', type: 'hanging', items: '职业装×6、休闲外套×3', photo: '' },
        { label: '下层抽屉', type: 'drawer', items: '包包×5、围巾×8', photo: '' },
      ],
    })
  }
}
