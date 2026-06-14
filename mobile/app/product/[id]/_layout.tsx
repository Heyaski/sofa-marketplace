import { Stack } from 'expo-router';

export default function ProductLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Товар' }} />
      <Stack.Screen name="ar" options={{ title: 'AR', headerShown: false }} />
    </Stack>
  );
}
