import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroNode,
  ViroText,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import { cacheModel } from '../utils/cacheModel';

type Props = {
  modelUrl: string;
  title?: string;
  onClose: () => void;
};

type ViroAppProps = {
  localModelUri: string;
  title?: string;
};

type SceneProps = {
  sceneNavigator?: {
    viroAppProps?: ViroAppProps;
  };
};

const INITIAL_SCALE: [number, number, number] = [0.35, 0.35, 0.35];

function ARScene(props: SceneProps) {
  const appProps = props.sceneNavigator?.viroAppProps;
  const localModelUri = appProps?.localModelUri ?? '';

  const [tracking, setTracking] = useState(ViroTrackingStateConstants.TRACKING_UNAVAILABLE);
  const [planeSelected, setPlaneSelected] = useState(false);
  const [modelScale, setModelScale] = useState<[number, number, number]>(INITIAL_SCALE);
  const [modelRotation, setModelRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [loadError, setLoadError] = useState(false);

  const trackingOk = tracking === ViroTrackingStateConstants.TRACKING_NORMAL;

  return (
    <ViroARScene onTrackingUpdated={state => setTracking(state)}>
      <ViroAmbientLight color="#ffffff" intensity={200} />

      <ViroARPlaneSelector
        minHeight={0.12}
        minWidth={0.12}
        alignment="Horizontal"
        onPlaneSelected={() => setPlaneSelected(true)}
      >
        <ViroNode
          dragType="FixedToWorld"
          scale={modelScale}
          rotation={modelRotation}
          onPinch={(pinchState, scaleFactor) => {
            if (pinchState !== 3) return;
            setModelScale(([x, y, z]) => {
              const next = Math.max(0.08, Math.min(2.5, x * scaleFactor));
              return [next, next, next];
            });
          }}
          onRotate={(rotateState, rotationFactor) => {
            if (rotateState !== 3) return;
            setModelRotation(([x, y, z]) => [x, y, z - rotationFactor]);
          }}
        >
          <Viro3DObject
            source={{ uri: localModelUri }}
            type="GLB"
            onError={() => setLoadError(true)}
          />
        </ViroNode>
      </ViroARPlaneSelector>

      {!planeSelected ? (
        <ViroText
          text={
            trackingOk
              ? 'Наведите на пол и коснитесь подсвеченной плоскости'
              : 'Двигайте телефон, чтобы найти пол…'
          }
          scale={[0.45, 0.45, 0.45]}
          position={[0, 0.1, -1.2]}
          style={styles.viroHint}
        />
      ) : null}

      {loadError ? (
        <ViroText
          text="Ошибка загрузки GLB"
          scale={[0.4, 0.4, 0.4]}
          position={[0, 0, -1]}
          style={styles.viroError}
        />
      ) : null}
    </ViroARScene>
  );
}

export default function ViroARViewer({ modelUrl, title, onClose }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cacheModel(modelUrl)
      .then(uri => {
        if (!cancelled) setLocalUri(uri);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось скачать 3D модель');
      });
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{error}</Text>
        <Pressable style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  if (!localUri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.msg}>Подготовка модели…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: ARScene as unknown as () => React.JSX.Element }}
        viroAppProps={{ localModelUri: localUri, title }}
        style={styles.navigator}
      />

      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        {title ? (
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.bottomHint} pointerEvents="none">
        <Text style={styles.bottomHintText}>
          ARCore: жесты — перетаскивание, щипок (масштаб), поворот двумя пальцами
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  navigator: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  msg: { textAlign: 'center', fontSize: 15, color: '#374151' },
  btn: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  topTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  bottomHint: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
  },
  bottomHintText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viroHint: {
    fontFamily: 'Arial',
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
  },
  viroError: {
    fontFamily: 'Arial',
    fontSize: 18,
    color: '#ff6b6b',
    textAlign: 'center',
  },
});
