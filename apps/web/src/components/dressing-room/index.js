export {
  default as useDressingRoomStore,
  useDressingRoomStore as useStore,
  DRACO_DECODER_PATH,
  FEMALE_AVATAR_GLB,
  MALE_AVATAR_GLB,
  DEFAULT_BODY_METRICS,
  SLOT_DEFAULT_LAYERS,
  STARTER_GARMENT_CATALOG,
  getCanonicalAvatarGlb,
  measurementsToBodyMetrics,
  preloadDressingRoomAsset,
} from './useDressingRoomStore';
export { default as DressingRoomCanvas, DressingRoomLoader, CAMERA_PRESET_TARGETS } from './DressingRoomCanvas';
export {
  default as GarmentMesh,
  preloadGarmentGlb,
  applyBodyMetricsToMorphTargets,
  applyLayerAntiZFighting,
  deriveDirectionalMorphWeights,
} from './GarmentMesh';
export { default as DressingRoomScene } from './DressingRoomScene';
export { default as DressingRoomView } from './DressingRoomView';
export {
  synthesizeBackFabricData,
  synthesizeBackFabricCanvas,
  fillTransparentCanvasMargins,
  buildBackTexture,
  partitionGarmentGeometryFrontBack,
  getTorsoSlice,
  getLegSlice,
} from './backFabricSynthesis';
