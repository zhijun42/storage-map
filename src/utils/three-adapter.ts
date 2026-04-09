import { PLATFORM } from 'three-platformize/src/Platform'
import { WechatPlatform } from 'three-platformize/src/WechatPlatform/index'

let platform: WechatPlatform | null = null

export function initThreeAdapter(canvas: any, width: number, height: number) {
  platform = new WechatPlatform(canvas, width, height)
  PLATFORM.set(platform)
}

export function disposeThreeAdapter() {
  if (platform) {
    PLATFORM.dispose()
    platform = null
  }
}
