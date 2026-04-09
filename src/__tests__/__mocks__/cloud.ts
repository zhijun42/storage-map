// Mock cloud service — all cloud operations are no-ops in tests
export const cloudGetSpaces = async () => []
export const cloudGetSpace = async () => null
export const cloudCreateSpace = async () => ({})
export const cloudDeleteSpace = async () => {}
export const cloudAddRoom = async () => ({})
export const cloudDeleteRoom = async () => {}
export const cloudAddContainer = async () => ({})
export const cloudUpdateContainer = async () => {}
export const cloudDeleteContainer = async () => {}
export const cloudSearchItems = async () => []
export const cloudClearAll = async () => {}
export const cloudSaveFloorplan = async () => {}
export const cloudLoadFloorplan = async () => null
export const cloudUploadPhoto = async () => ''
export const cloudCreateShare = async () => ''
export const cloudResolveShare = async () => ({})
