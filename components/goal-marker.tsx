import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import LuckyCat from './lucky-cat';
import gridToWorld from '@/utils/grid-to-world';

export default function GoalMarker({ position, ...props }) {
  const heartRef = useRef(null);

  // Memoize complex shape calculations to optimize rendering performance
  const heartShape = useMemo(() => {
    const shape = new THREE.Shape();
    const [x, y, s] = [0, 0, 0.6];

    shape
      .moveTo(x + 0.5 * s, y + 0.5 * s)
      .bezierCurveTo(x + 0.5 * s, y + 0.5 * s, x + 0.4 * s, y, x, y)
      .bezierCurveTo(
        x - 0.6 * s,
        y,
        x - 0.6 * s,
        y + 0.7 * s,
        x - 0.6 * s,
        y + 0.7 * s,
      )
      .bezierCurveTo(
        x - 0.6 * s,
        y + 1.1 * s,
        x - 0.3 * s,
        y + 1.54 * s,
        x + 0.5 * s,
        y + 1.9 * s,
      )
      .bezierCurveTo(
        x + 1.2 * s,
        y + 1.54 * s,
        x + 1.6 * s,
        y + 1.1 * s,
        x + 1.6 * s,
        y + 0.7 * s,
      )
      .bezierCurveTo(x + 1.6 * s, y + 0.7 * s, x + 1.6 * s, y, x + 1.0 * s, y)
      .bezierCurveTo(
        x + 0.7 * s,
        y,
        x + 0.5 * s,
        y + 0.5 * s,
        x + 0.5 * s,
        y + 0.5 * s,
      );

    return shape;
  }, []);

  const extrudeSettings = useMemo(
    () => ({
      depth: 0.25,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    }),
    [],
  );

  // Internalize the floating animation previously handled by the external loop
  useFrame((state) => {
    if (heartRef.current) {
      const elapsedTime = state.clock.getElapsedTime();
      // Calculate floating offset using a sine wave function (1.5 frequency, 0.18 amplitude)
      const t = elapsedTime * 1.5;
      heartRef.current.position.y = 6.2 + Math.sin(t) * 0.18;

      // Calculate pulsating scale
      const s = 1.0 + Math.sin(t * 2.0) * 0.06;
      heartRef.current.scale.set(s * 0.9, s * 0.9, s * 0.9);

      // Calculate rotation
      heartRef.current.rotation.z += 0.6 * state.clock.getDelta();
    }
  });

  const goalPos = gridToWorld(position.x, position.z, props.grid);

  return (
    <group position={goalPos} {...props}>
      {/* Cat Component Instantiation */}
      <LuckyCat
        scale={[1.5, 1.5, 1.5]}
        armRef={props.armRef}
        wristRef={props.wristRef}
      />

      {/* Floating Heart Mesh */}
      <mesh
        ref={heartRef}
        position={[0, 6.2, 0.2]}
        rotation={[Math.PI, 0, 0]}
        scale={[0.9, 0.9, 0.9]}
      >
        <extrudeGeometry args={[heartShape, extrudeSettings]} />
        <meshBasicMaterial
          color={0xff4d6d}
          depthTest={true}
          depthWrite={true}
        />
      </mesh>
    </group>
  );
}
