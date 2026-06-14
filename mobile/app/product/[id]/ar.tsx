import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import ARViewer from '../../../src/components/ARViewer';

export default function ProductARScreen() {
  const router = useRouter();
  const { modelUrl, title } = useLocalSearchParams<{
    id: string;
    modelUrl: string;
    title?: string;
  }>();

  if (!modelUrl) {
    router.back();
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ARViewer
        modelUrl={modelUrl}
        title={title}
        onClose={() => router.back()}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
