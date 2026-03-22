import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function CarModel({ tileSize = 10, ...props }) {
  const wheelRadius = tileSize * 0.105;
  const wheelWidth = tileSize * 0.07;

  const cabinShape = useMemo(() => {
    const shape = new THREE.Shape();
    const cw = tileSize * 0.175;
    shape.moveTo(-cw, 0);
    shape.lineTo(cw, 0);
    shape.lineTo(cw * 0.8, tileSize * 0.21);
    shape.lineTo(-cw * 0.8, tileSize * 0.21);
    shape.closePath();
    return shape;
  }, [tileSize]);

  const extrudeSettings = useMemo(
    () => ({
      depth: tileSize * 0.35,
      bevelEnabled: false,
    }),
    [tileSize],
  );

  const wheelPositions = [
    { x: tileSize * 0.21, z: tileSize * 0.21 }, // Front right
    { x: -tileSize * 0.21, z: tileSize * 0.21 }, // Front left
    { x: tileSize * 0.21, z: -tileSize * 0.21 }, // Rear right
    { x: -tileSize * 0.21, z: -tileSize * 0.21 }, // Rear left
  ];

  return (
    <group {...props}>
      {/* Main Chassis */}
      <mesh position={[0, tileSize * 0.21, 0]}>
        <boxGeometry
          args={[tileSize * 0.42, tileSize * 0.21, tileSize * 0.63]}
        />
        <meshStandardMaterial
          color={0xe53935}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, tileSize * 0.315, -tileSize * 0.245]}>
        <extrudeGeometry args={[cabinShape, extrudeSettings]} />
        <meshStandardMaterial
          color={0x424242}
          roughness={0.4}
          metalness={0.4}
        />
      </mesh>

      {/* Spoiler */}
      <mesh position={[0, tileSize * 0.35, -tileSize * 0.28]}>
        <boxGeometry
          args={[tileSize * 0.42, tileSize * 0.035, tileSize * 0.07]}
        />
        {/* Reusing the Sporty Red material config inline */}
        <meshStandardMaterial
          color={0xe53935}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Wheels */}
      {wheelPositions.map((pos, index) => {
        // Calculate offset position for the cylinder rotation
        const posX = pos.x + (Math.sign(pos.x) * wheelWidth) / 2;

        return (
          <group
            key={`wheel-${index}`}
            name="wheelGroup"
            position={[posX, wheelRadius, pos.z]}
            rotation={[0, 0, Math.PI / 2]} // Align cylinder with X-axis
          >
            {/* Tire */}
            <mesh>
              <cylinderGeometry
                args={[wheelRadius, wheelRadius, wheelWidth, 24]}
              />
              <meshStandardMaterial color={0x111111} roughness={0.7} />
            </mesh>
            {/* Rim */}
            <mesh>
              <cylinderGeometry
                args={[
                  wheelRadius * 0.7,
                  wheelRadius * 0.7,
                  wheelWidth + 0.01,
                  12,
                ]}
              />
              <meshStandardMaterial
                color={0xaaaaaa}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Headlights */}
      <mesh position={[tileSize * 0.14, tileSize * 0.21, tileSize * 0.3157]}>
        <planeGeometry args={[tileSize * 0.105, tileSize * 0.07]} />
        <meshBasicMaterial color={0xfff9c4} />
      </mesh>

      <mesh position={[-tileSize * 0.14, tileSize * 0.21, tileSize * 0.3157]}>
        <planeGeometry args={[tileSize * 0.105, tileSize * 0.07]} />
        <meshBasicMaterial color={0xfff9c4} />
      </mesh>
    </group>
  );
}
