import * as FileSystem from 'expo-file-system';

export async function cacheModel(url: string): Promise<string> {
  const name = url.split('/').pop()?.split('?')[0] || 'model.glb';
  const dest = `${FileSystem.cacheDirectory}ar-${name}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const result = await FileSystem.downloadAsync(url, dest);
  return result.uri;
}
