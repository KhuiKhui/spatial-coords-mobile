import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Slot, Stack } from 'expo-router';
import 'react-native-reanimated';
import '../global.css';
import { Canvas } from '@react-three/fiber';

import { useColorScheme } from '@/hooks/use-color-scheme';
import GUI from '@/components/gui';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Canvas>
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          color="#ffffff"
        />
        <Slot />
      </Canvas>
      <GUI />
    </ThemeProvider>
  );
}
