/**
 * packages/eyes-native/src/types/expo-device.d.ts
 * Minimal ambient stub for expo-device (used in EyesEngine.ts).
 */
declare module 'expo-device' {
  export const totalMemory: number | null;
  export const modelName: string | null;
  export const osVersion: string | null;
  export const brand: string | null;
  export const manufacturer: string | null;
  export const isDevice: boolean;
  export const deviceType: number | null;
}
