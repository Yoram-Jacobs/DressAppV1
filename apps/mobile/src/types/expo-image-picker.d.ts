/**
 * apps/mobile/src/types/expo-image-picker.d.ts
 * Minimal ambient stub for expo-image-picker.
 * Superseded by the real package declarations after npm install.
 */
declare module 'expo-image-picker' {
  export interface ImagePickerAsset {
    uri: string;
    base64?: string | null;
    width: number;
    height: number;
    type?: 'image' | 'video';
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    exif?: Record<string, unknown>;
  }

  export interface ImagePickerResult {
    canceled: boolean;
    assets: ImagePickerAsset[] | null;
  }

  export interface ImagePickerOptions {
    mediaTypes?: MediaTypeOptions | string | string[];
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    base64?: boolean;
    exif?: boolean;
    allowsMultipleSelection?: boolean;
    selectionLimit?: number;
  }

  export enum MediaTypeOptions {
    All = 'All',
    Videos = 'Videos',
    Images = 'Images',
  }

  export enum UIImagePickerControllerQualityType {
    High = 0,
    Medium = 1,
    Low = 2,
  }

  export interface PermissionResponse {
    status: 'granted' | 'denied' | 'undetermined';
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
  }

  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function requestMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<PermissionResponse>;
  export function requestCameraPermissionsAsync(): Promise<PermissionResponse>;
  export function getMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<PermissionResponse>;
  export function getCameraPermissionsAsync(): Promise<PermissionResponse>;
}
