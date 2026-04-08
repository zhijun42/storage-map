# Storage Map - 开发进度记录

> 最后更新：2026-04-08

## 项目概述

收纳物品地图微信小程序 — 帮助收纳师快速制作交互式物品地图，帮助住户查找家中物品。

- **仓库**：https://github.com/zhijun42/storage-map (Private)
- **技术栈**：Taro (React) + 微信云开发 (MongoDB + 云存储 + 云函数)
- **云环境ID**：`cloud1-1g7j9oatd5d871f3`
- **AppID**：`wx856dc260293a0377`

## 已完成

### 产品设计
- [x] SPECS.md 产品规格文档（产品定位、数据模型、技术架构、商业模式、Hackathon计划）
- [x] 数据模型设计：Space > Room > Container (movable) > Slot
- [x] 商业模式：收纳师订阅制¥29/月，住户永久免费
- [x] 团队分工方案（按功能模块垂直拆分）

### 技术搭建
- [x] GitHub Private仓库创建
- [x] Taro项目初始化（React + TypeScript + SCSS）
- [x] 微信云开发环境开通和配置
- [x] project.config.json配置（miniprogramRoot + cloudfunctionRoot）
- [x] 微信小程序编译验证通过
- [x] 微信开发者工具中模拟器预览成功

### 页面开发（4个页面）
- [x] **首页** (pages/index)：Space列表、创建新Space、搜索入口
- [x] **空间详情** (pages/space)：Room标签切换、Container卡片列表（含Slot预览）、添加Room/Container
- [x] **容器编辑** (pages/container)：Slot列表编辑、物品描述输入、拍照关联
- [x] **搜索** (pages/search)：全局搜索物品，显示完整路径

### 数据服务层
- [x] **services/space.ts**：统一接口层，自动切换localStorage/云数据库
- [x] **services/cloud.ts**：微信云数据库完整CRUD（spaces/rooms/containers/slots/shares）
- [x] 照片上传到云存储
- [x] 搜索功能
- [x] 分享链接生成/解析
- [x] 错误处理：云调用失败自动fallback到localStorage
- [x] Timestamp日志（`[HH:MM:SS.mmm] [Cloud]` 前缀）

### 云函数
- [x] **cloud/init-db**：自动创建数据库集合
- [x] **cloud/share**：分享token生成和解析

### 云数据库
- [x] 云环境开通
- [x] spaces集合已创建并有数据
- [x] rooms集合已创建并有数据
- [x] containers集合已创建
- [x] slots集合已创建
- [x] shares集合已创建

## 已知问题

1. **Timeout**：app.ts中init-db云函数调用超时——已去掉该调用，待验证
2. **索引建议**：云数据库建议为spaces/rooms/containers添加组合索引（_openid+排序字段）——MVP可忽略
3. **getSpace并行查询**：已优化为Promise.all，但仍可能在弱网环境下timeout

## 未完成（下一个session继续）

### Must Have
- [ ] 验证timeout是否已解决
- [ ] 容器编辑页的交互打磨（添加/删除Slot、拖拽排序）
- [ ] 照片拍摄功能在真机上的测试
- [ ] 分享链接功能完整流程（生成→住户打开→查看/编辑）
- [ ] 搜索结果高亮匹配文字

### Nice to Have
- [ ] 容器模板库（衣柜/斗柜/书架等预设）
- [ ] 可移动容器的拖拽迁移
- [ ] 模糊搜索（Fuse.js）
- [ ] 3D可视化视图（WebView嵌入Three.js H5页面）
- [ ] UI美化

## 项目结构

```
storage-map/
├── SPECS.md                    ← 产品规格文档
├── PROGRESS.md                 ← 本文件
├── project.config.json         ← 微信小程序项目配置
├── config/index.ts             ← Taro构建配置
├── cloud/
│   ├── init-db/                ← 云函数：初始化数据库集合
│   └── share/                  ← 云函数：分享链接
├── src/
│   ├── app.ts                  ← 应用入口（云开发初始化）
│   ├── app.config.ts           ← 路由配置
│   ├── pages/
│   │   ├── index/              ← 首页
│   │   ├── space/              ← 空间详情
│   │   ├── container/          ← 容器编辑
│   │   └── search/             ← 搜索
│   └── services/
│       ├── space.ts            ← 统一数据接口（localStorage/云数据库自动切换）
│       ├── cloud.ts            ← 云数据库操作
│       └── init-db.ts          ← 数据库初始化检查
└── dist/weapp/                 ← 编译产出
```
