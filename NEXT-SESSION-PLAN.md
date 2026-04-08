# Next Session Plan — 给下一个Claude Code Session

> 上一个session已完成项目搭建、4个页面、云数据库集成。本文件描述下一步应该做什么。

## 项目背景

这是一个48小时Hackathon项目——"收纳物品地图"微信小程序。帮助收纳师快速制作交互式物品地图，帮助住户查找家中物品。

- **仓库**：`/Users/zhijunliao/AI-assistant/storage-map/`
- **技术栈**：Taro (React + TypeScript) + 微信云开发
- **云环境ID**：`cloud1-1g7j9oatd5d871f3`
- **详细规格**：见 `SPECS.md`
- **当前进度**：见 `PROGRESS.md`

## 当前状态

- 4个页面已搭建（首页/空间详情/容器编辑/搜索）
- 云数据库已通（spaces/rooms集合有数据）
- services层有localStorage和云数据库双模式自动切换
- 微信开发者工具可预览

## 优先任务（按重要性排序）

### 1. 验证并修复timeout问题
- 上一个session中云数据库查询有timeout
- 已优化为Promise.all并行查询，已去掉init-db调用
- 需要验证：刷新模拟器看Console是否还有timeout
- 如果仍有timeout：检查网络/调整查询逻辑

### 2. 容器编辑页打磨（最核心的页面）
- `src/pages/container/index.tsx`
- 需要完善：
  - 添加/删除Slot的流畅交互
  - 拍照功能（wx.chooseMedia）测试
  - 物品描述输入体验（键盘遮挡处理）
  - 编辑后数据自动保存到云端

### 3. 搜索功能完善
- `src/pages/search/index.tsx`
- 当前是基本的文本匹配
- 需要：搜索结果中高亮匹配的关键词
- 可选：集成Fuse.js做模糊搜索

### 4. 分享功能
- 云函数 `cloud/share` 已写好但未部署测试
- 需要：
  - 在空间详情页添加"分享"按钮
  - 调用云函数生成分享token
  - 生成小程序分享卡片（wx.share）
  - 住户通过分享链接打开后的只读/编辑视图

### 5. UI美化
- 当前UI非常基础
- 需要统一的设计风格
- 容器卡片的展开/收起动画
- 搜索结果的位置路径展示优化

### 6. 3D可视化（Wow Moment，可选）
- 通过WebView嵌入Three.js H5页面
- 注意：个人类型小程序不能用WebView，需要企业类型或用three-platformize库
- 参考代码：`/Users/zhijunliao/AI-assistant/3d-room-demo/src/main.js`（buildRoomFromJSON函数可复用）

## 关键文件

| 文件 | 用途 |
|------|------|
| `SPECS.md` | 完整产品规格 |
| `PROGRESS.md` | 开发进度 |
| `src/services/space.ts` | 统一数据接口（前后端分界面） |
| `src/services/cloud.ts` | 云数据库操作（带timestamp日志） |
| `src/pages/container/index.tsx` | 容器编辑器（最需要打磨的页面） |
| `cloud/share/index.js` | 分享链接云函数 |
| `project.config.json` | 微信小程序配置（含AppID和云环境） |

## 开发命令

```bash
cd /Users/zhijunliao/AI-assistant/storage-map

# Watch模式（推荐）：代码保存后自动编译，微信开发者工具自动刷新
npm run dev:weapp

# 单次编译
npx taro build --type weapp

# H5模式（浏览器预览，不需要微信开发者工具）
npm run dev:h5
```

## 团队协作

- 2人团队
- 队友负责：UI打磨 + 容器编辑交互 + 收纳师录入流程
- 你（当前用户）负责：数据存储 + 分享功能 + 搜索
- 接口约定：`services/space.ts`中的函数签名不变

## 注意事项

- 聊天历史文件：`claude_history-3D-part2.md`（在storage-map repo内）
- 每次回复都要追加到历史文件
- 微信云数据库无法从外部API访问，只能通过小程序SDK或云函数
- 个人类型小程序不支持WebView组件
