# Storage Map - 开发进度记录

> 最后更新：2026-04-09

## 项目概述

收纳物品地图微信小程序 — 帮助收纳师快速制作交互式物品地图，帮助住户查找家中物品。

- **仓库**：https://github.com/zhijun42/storage-map (Private)
- **技术栈**：Taro (React + TypeScript + SCSS) + 微信云开发
- **云环境ID**：`cloud1-1g7j9oatd5d871f3`
- **AppID**：`wx856dc260293a0377`
- **AI**：Kimi K2.5（月之暗面）
- **测试**：Jest 43 tests

## 提交记录

| Commit | Tag | 内容 |
|--------|-----|------|
| eb54116 | syt_1 | Visual polish and UX improvements |
| 9b4bf18 | syt_2 | Draw editor 三阶段 + 立面编辑 |
| eb10f84 | syt_3 | 阶段二数据对齐 — 绘制数据替换静态源 |
| c597111 | syt_4 | 灵活 slot 布局 + 2.5D 类别 + cloud schema |
| fea6ed6 | syt_5 | 用户档案 + AI 策略 + seed items |
| 176b170 | syt_6 | 智能推荐收纳位置 + 统一类别 |
| 98c1b0b | syt_7 | 切换 Kimi K2.5 + model logging |
| c6c1911 | syt_8 | 本地优先 + 异步云同步架构 |
| aef4ded | syt_9 | 级联删除 + Jest 测试套件 (36 tests) |
| f508be7 | syt_10 | 平面图云同步 + integration tests (43 tests) |
| f429b57 | syt_11 | 清空修复 + 初始化空间 + 开发工具 |

## 已完成功能

### 空间绘制编辑器 (draw-editor)
- [x] Canvas 2D 绘制引擎（触摸拖拽、边缘吸附、碰撞检测、触觉反馈）
- [x] 三阶段流程：房间 → 家具 → 储物柜（步骤指示器引导）
- [x] 立面编辑：柜体内部隔间自由绘制，无边框限制
- [x] 双指缩放平移（0.25x ~ 5x）
- [x] 渲染样式：房间白底黑边、家具灰边半透明、储物柜红色+X标记
- [x] 级联删除：删除房间自动删除内部家具/储物柜，有物品时阻止删除
- [x] JSON 导出：rooms (walls) + furniture + containers (columns/slots)

### 数据对齐
- [x] handleFinish 数据管道：绘制 → space service CRUD
- [x] 空间包含检测：自动分配储物柜到对应房间
- [x] FloorplanView 双数据源：drawn_floorplan (localStorage) + container 坐标
- [x] 平面图居中渲染（min/max 边界框计算）
- [x] cloud.ts 字段修复：container x/y/width/height、slot rx/ry/rw/rh/categories
- [x] rect → container ID 映射表

### 2.5D 可视化 (IsometricView)
- [x] 灵活布局：slot 有 rx/ry/rw/rh → CSS 绝对定位还原绘制布局
- [x] 旧数据兼容：无坐标 → flex 等高布局
- [x] 类别显示：合并 slot.categories + items[].category

### 物品管理
- [x] 物品录入（拍照/表单）
- [x] 物品搜索 + 高亮联动
- [x] 物品详情页
- [x] 15 类统一类别（衣物/鞋包/数码/书籍/化妆品等）
- [x] 智能推荐收纳位置（评分算法：类别匹配 > 同类物品 > 空间充裕度）

### AI 收纳策略
- [x] Kimi K2.5 云函数（cloud/ai-strategy）
- [x] Prompt：用户档案 + 房屋布局 + 物品数据 → 收纳建议 + 风水 + 购置推荐
- [x] 统计可视化：数据概览卡片 + 物品分类条形图
- [x] Markdown 渲染（统一字体 26px）
- [x] "Powered by" 模型标签

### 用户档案
- [x] 7 字段选填表单（性别/年龄/职业/性格/收纳频率/居住人数/生活习惯）
- [x] 首次启动自动引导
- [x] 「我的」页面入口 + profile card 摘要

### 数据架构
- [x] 本地优先：所有读写操作 localStorage 即时完成
- [x] 异步云同步：写操作 fire-and-forget 推送云端
- [x] 启动同步：本地空时从云端拉取（spaces + floorplans）
- [x] 平面图云同步：floorplans 集合存储视觉数据 + 矩形数据 + ID 映射

### 开发工具
- [x] 初始化空间：一键创建示例房间 + 储物柜 + 物品
- [x] 清空所有数据：localStorage + 云端全部清除
- [x] 联系收纳师入口（「我的」+ AI 结果页）

### 测试
- [x] Jest + ts-jest 测试框架
- [x] items.test.ts (10 tests)：CATEGORIES + normalizeItems + serializeItems
- [x] space.test.ts (19 tests)：Space/Room/Container CRUD + searchItems
- [x] delete-cascade.test.ts (7 tests)：ID 映射 + 物品检查 + 级联删除
- [x] floorplan-sync.test.ts (7 tests)：云端同步 + 恢复 + 端到端流程

## 页面清单

| 页面 | 路径 | 功能 |
|------|------|------|
| 物品地图（首页） | pages/index | FloorplanView + 操作入口 |
| 物品清单 | pages/itemlist | 按物品/按房间两种视图 |
| 我的 | pages/my | 设置 + 开发工具 |
| 空间绘制 | pages/draw-editor | Canvas 三阶段绘制 + 立面 |
| 用户档案 | pages/profile | 个人信息选填表单 |
| AI 收纳策略 | pages/ai-strategy | AI 生成 + 统计 + Markdown |
| 空间详情 | pages/space | Room tabs + Container 列表 |
| 容器编辑 | pages/container | 2.5D 轴测图 + 物品管理 |
| 物品搜索 | pages/search | 全局搜索 + 平面图高亮 |
| 拍照录入 | pages/capture | 表单 + 智能推荐位置 |
| 添加物品 | pages/add-item | 物品录入表单 |
| 物品详情 | pages/item-detail | 照片 + 字段详情 |
