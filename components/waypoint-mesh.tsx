import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function WaypointMesh({
  number,
  color = '#8A2BE2',
  tileSize = 10,
  collected = false, // Replaces group.userData.collected
  position = [0, 0, 0],
  // In Expo, you must load the JSON font file via require()
  ...props
}) {
  const groupRef = useRef(null);
  const gemRef = useRef(null);

  // Internalize the animations that were previously in the global animate() loop
  useFrame((state, delta) => {
    if (!collected) {
      if (groupRef.current) groupRef.current.rotation.y += delta * 0.5;
      if (gemRef.current) gemRef.current.rotation.y += delta * 1.5;
    }
  });

  // Calculate dynamic properties based on the 'collected' state
  const emissiveIntensity = collected ? 0 : 0.8;
  const opacity = collected ? 0.25 : 0.9;
  const lightIntensity = collected ? 0 : 3;

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1] + 0.15, position[2]]}
      {...props}
    >
      {/* Base Cylinder */}
      <mesh>
        <cylinderGeometry args={[0.6, 0.8, 0.3, 8]} />
        <meshStandardMaterial
          color={0x555555}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Floating Gem */}
      <mesh ref={gemRef} position={[0, 0.8, 0]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.2}
          roughness={0.1}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Illumination */}
      <pointLight
        color={color}
        intensity={lightIntensity}
        distance={tileSize * 0.8}
        position={[0, 1, 0]}
      />

      {/* 3D Text - Billboard ensures it strictly faces the active camera */}
    </group>
  );
}
