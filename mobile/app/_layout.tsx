import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'VizHub AR' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Товар' }} />
      </Stack>
    </>
  );
}
