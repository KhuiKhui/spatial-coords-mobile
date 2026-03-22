import React, { useMemo } from 'react';
import * as THREE from 'three';

// Helper component to handle line geometries declaratively
const Whisker = ({ points }) => {
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={0x111111} linewidth={2} />
    </line>
  );
};

export default function LuckyCat({ armRef, wristRef, ...props }) {
  // Memoize the arm curve and its points to prevent recalculation on renders
  const armCurvePoints = useMemo(
    () => [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.75, 0.25),
      new THREE.Vector3(0, 1.35, 0.4),
    ],
    [],
  );

  const armCurve = useMemo(
    () => new THREE.CatmullRomCurve3(armCurvePoints),
    [armCurvePoints],
  );
  const wristPosition = armCurvePoints[armCurvePoints.length - 1];

  // Shared Materials (can be extracted further if reused across the app)
  const materials = {
    white: (
      <meshStandardMaterial color={0xffffff} roughness={0.25} metalness={0.1} />
    ),
    red: (
      <meshStandardMaterial color={0xaa2222} roughness={0.35} metalness={0.1} />
    ),
    gold: (
      <meshStandardMaterial color={0xffd700} roughness={0.1} metalness={0.5} />
    ),
    black: <meshStandardMaterial color={0x111111} roughness={0.5} />,
    pink: <meshStandardMaterial color={0xffc0cb} roughness={0.4} />,
  };

  return (
    <group {...props}>
      {/* Body */}
      <mesh scale={[1, 0.8, 1]}>
        <sphereGeometry args={[1.5, 32, 16]} />
        {materials.white}
      </mesh>

      {/* Head Group */}
      <group position={[0, 1.8, 0]}>
        <mesh>
          <sphereGeometry args={[1.2, 32, 16]} />
          {materials.white}
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.4, 0.2, 1.11]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          {materials.black}
        </mesh>
        <mesh position={[0.4, 0.2, 1.11]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          {materials.black}
        </mesh>

        {/* Nose */}
        <mesh position={[0, 0, 1.18]} scale={[1.5, 1, 1]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          {materials.black}
        </mesh>

        {/* Whiskers */}
        {[0, 1, 2].map((i) => (
          <group key={`whiskers-${i}`}>
            <Whisker
              points={[
                new THREE.Vector3(-0.2, -0.1, 1.15),
                new THREE.Vector3(-1.2, -i * 0.15, 0.8),
              ]}
            />
            <Whisker
              points={[
                new THREE.Vector3(0.2, -0.1, 1.15),
                new THREE.Vector3(1.2, -i * 0.15, 0.8),
              ]}
            />
          </group>
        ))}
      </group>

      {/* Left Ear */}
      <group position={[-0.8, 2.8, 0.06]} rotation={[0, 0, Math.PI / 10]}>
        <mesh>
          <coneGeometry args={[0.4, 0.8, 12]} />
          {materials.white}
        </mesh>
        <mesh position={[0, -0.05, 0.15]} rotation={[-Math.PI / 12, 0, 0]}>
          <coneGeometry args={[0.28, 0.5, 12]} />
          {materials.pink}
        </mesh>
      </group>

      {/* Right Ear */}
      <group position={[0.8, 2.8, 0.06]} rotation={[0, 0, -Math.PI / 10]}>
        <mesh>
          <coneGeometry args={[0.4, 0.8, 12]} />
          {materials.white}
        </mesh>
        <mesh position={[0, -0.05, 0.15]} rotation={[-Math.PI / 12, 0, 0]}>
          <coneGeometry args={[0.28, 0.5, 12]} />
          {materials.pink}
        </mesh>
      </group>

      {/* Collar */}
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.1, 8, 32]} />
        {materials.red}
      </mesh>

      {/* Bell */}
      <mesh position={[0, 1.2, 1.3]}>
        <sphereGeometry args={[0.2, 16, 8]} />
        {materials.gold}
      </mesh>

      {/* Arm Hierarchy (Exposed via refs for animation) */}
      <group ref={armRef} position={[-1.05, 1.1, 0.35]}>
        <mesh>
          <tubeGeometry args={[armCurve, 20, 0.3, 8, false]} />
          {materials.white}
        </mesh>

        <group ref={wristRef} position={wristPosition}>
          {/* Paw */}
          <mesh scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.4, 16, 12]} />
            {materials.white}

            {/* Main Pad */}
            <mesh position={[0, -0.1, 0.3]} scale={[1.2, 1, 0.5]}>
              <sphereGeometry args={[0.2, 12, 8]} />
              {materials.pink}
            </mesh>

            {/* Small Pads */}
            {[0, 1, 2].map((i) => (
              <mesh
                key={`pad-${i}`}
                position={[-0.2 + i * 0.2, 0.1, 0.35]}
                scale={[1, 1, 0.5]}
              >
                <sphereGeometry args={[0.1, 8, 8]} />
                {materials.pink}
              </mesh>
            ))}
          </mesh>
        </group>
      </group>
    </group>
  );
}
