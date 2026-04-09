// Mock Taro for unit tests — simulates localStorage via in-memory store
const storage: Record<string, string> = {}

const Taro = {
  getStorageSync: (key: string) => storage[key] || '',
  setStorageSync: (key: string, value: string) => { storage[key] = value },
  removeStorageSync: (key: string) => { delete storage[key] },
  getSystemInfoSync: () => ({ windowHeight: 800, pixelRatio: 2 }),
  setNavigationBarTitle: () => {},
  showToast: () => {},
  showModal: () => Promise.resolve({ confirm: true }),
  showLoading: () => {},
  hideLoading: () => {},
  navigateTo: () => {},
  navigateBack: () => {},
  vibrateShort: () => {},
  createSelectorQuery: () => ({
    select: () => ({
      fields: () => ({ exec: () => {} }),
      boundingClientRect: () => ({ exec: () => {} }),
    }),
  }),
  cloud: null,
}

// Helper to reset storage between tests
export function __resetStorage() {
  Object.keys(storage).forEach(k => delete storage[k])
}

export default Taro
