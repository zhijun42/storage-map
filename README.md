# Storage Map (收纳物品地图)

帮助收纳师快速制作交互式物品地图，帮助住户随时查找家中物品位置。

## Quick Start

```bash
# 安装依赖
npm install

# 启动微信小程序开发（watch 模式）
npm run dev:weapp

# 单次编译
npx taro build --type weapp

# 运行测试
npm test
```

在微信开发者工具中打开 `dist/weapp` 目录即可预览。

## 功能概览

### 空间绘制
Canvas 绘制引擎，三阶段流程：房间 → 家具 → 储物柜，支持双指缩放平移。储物柜可进入立面编辑绘制内部隔间。

### 物品管理
物品录入、搜索、分类管理。录入时 AI 智能推荐最佳收纳位置。

### 2.5D 可视化
IsometricView 组件还原用户绘制的柜体隔间布局，展示物品类别。

### AI 收纳策略
基于房屋布局 + 储物数据 + 用户画像，AI 生成个性化收纳建议、风水小贴士和购置推荐。

### 数据架构
本地优先（localStorage 即时响应）+ 异步云同步（腾讯云 MongoDB 后台备份）。平面图视觉数据也同步至云端，支持跨设备共享。

## 项目结构

```
storage-map/
├── cloud/                    ← 微信云函数
│   ├── ai-strategy/          ← AI 收纳策略（Kimi K2.5）
│   ├── share/                ← 分享链接
│   └── init-db/              ← 数据库初始化
├── src/
│   ├── pages/
│   │   ├── index/            ← 首页（平面图 + 操作入口）
│   │   ├── draw-editor/      ← 空间绘制编辑器
│   │   ├── container/        ← 容器详情（2.5D + 物品列表）
│   │   ├── itemlist/         ← 物品清单
│   │   ├── search/           ← 物品搜索
│   │   ├── capture/          ← 拍照录入（含智能推荐）
│   │   ├── add-item/         ← 添加物品表单
│   │   ├── item-detail/      ← 物品详情
│   │   ├── ai-strategy/      ← AI 收纳策略
│   │   ├── profile/          ← 用户档案
│   │   ├── space/            ← 空间管理
│   │   └── my/               ← 我的（设置 + 开发工具）
│   ├── components/
│   │   ├── FloorplanView.tsx  ← Canvas 平面图渲染
│   │   └── IsometricView.tsx  ← CSS 2.5D 柜体视图
│   ├── services/
│   │   ├── space.ts           ← 数据服务层（本地优先 + 云同步）
│   │   ├── cloud.ts           ← 云数据库操作
│   │   ├── items.ts           ← 物品类型 + 序列化
│   │   ├── init-space.ts      ← 示例空间初始化
│   │   └── seed-items.ts      ← 示例物品填充
│   ├── data/
│   │   └── floorplan.json     ← 静态平面图（fallback）
│   └── __tests__/             ← Jest 测试套件
│       ├── items.test.ts
│       ├── space.test.ts
│       ├── delete-cascade.test.ts
│       └── floorplan-sync.test.ts
├── jest.config.js
├── SPECS.md                   ← 产品规格文档
└── PROGRESS.md                ← 开发进度记录
```

## 技术栈

- **前端**：Taro (React + TypeScript + SCSS)
- **后端**：微信云开发（MongoDB + 云存储 + 云函数）
- **AI**：Kimi K2.5（月之暗面）via 云函数
- **测试**：Jest + ts-jest（43 tests）

## 云数据库集合

| 集合 | 用途 |
|------|------|
| spaces | 空间 |
| rooms | 房间 |
| containers | 储物柜（含 x/y/width/height 坐标） |
| slots | 隔间（含 rx/ry/rw/rh 归一化坐标） |
| shares | 分享链接 |
| floorplans | 平面图视觉数据（云端同步） |

## 开发者工具

在「我的」页面有两个开发用按钮：
- **初始化空间**：一键创建示例房间 + 储物柜 + 物品
- **清空所有数据**：删除本地 + 云端所有数据

## 团队

48 小时 Hackathon 作品，2 人团队。
