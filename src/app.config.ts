export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/itemlist/index',
    'pages/my/index',
    'pages/draw-editor/index',
    'pages/space/index',
    'pages/container/index',
    'pages/search/index',
    'pages/capture/index',
    'pages/add-item/index',
    'pages/item-detail/index',
  ],
  tabBar: {
    color: '#69727d',
    selectedColor: '#3884f4',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '物品地图',
        iconPath: 'assets/tabs/home.png',
        selectedIconPath: 'assets/tabs/home-active.png',
      },
      {
        pagePath: 'pages/itemlist/index',
        text: '物品清单',
        iconPath: 'assets/tabs/list.png',
        selectedIconPath: 'assets/tabs/list-active.png',
      },
      {
        pagePath: 'pages/my/index',
        text: '我的',
        iconPath: 'assets/tabs/user.png',
        selectedIconPath: 'assets/tabs/user-active.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f2f3f5',
    navigationBarTitleText: '收纳地图',
    navigationBarTextStyle: 'black',
  },
})
