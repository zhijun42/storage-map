# Storage Map (收纳物品地图)

帮助收纳师快速制作交互式物品地图，帮助住户随时查找家中物品位置。

## Quick Start

```bash
# 安装 Taro CLI
npm install -g @tarojs/cli

# 安装依赖
npm install

# 启动微信小程序开发
npm run dev:weapp

# 启动 H5 开发
npm run dev:h5
```

## 项目结构

```
storage-map/
├── SPECS.md              ← 产品规格文档（必读）
├── src/
│   ├── pages/            ← 页面
│   ├── components/       ← 共享组件
│   ├── services/         ← 云数据库操作
│   └── utils/            ← 工具函数
└── cloud/                ← 微信云函数
```

## 团队协作

- 每个功能模块一个 Git 分支
- 合并到 main 前先 PR review
- 详见 SPECS.md 的模块拆分和分工
