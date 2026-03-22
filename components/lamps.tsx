import React, { useMemo } from 'react';
import * as THREE from 'three';

// Define colors outside the component so they are only created once
const LIGHT_COLORS = [0xfffee0, 0xffffff, 0xe0e0ff, 0xffe0e0, 0xffd54f];

// Shared material for performance (prevents creating a new material for every single lamp part)
const sharedPostMaterial = new THREE.MeshStandardMaterial({
  color: 0x2c3e50,
  roughness: 0.6,
  metalness: 0.4,
});

/**
 * 1. The Individual Lamp Component
 */
function ClassicalLamp() {
  const bulbColor = useMemo(
    () => LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)],
    [],
  );

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 0.1, 0]} material={sharedPostMaterial}>
        <cylinderGeometry args={[0.3, 0.4, 0.2, 8]} />
      </mesh>

      {/* Post */}
      <mesh position={[0, 1.85, 0]} material={sharedPostMaterial}>
        <cylinderGeometry args={[0.15, 0.1, 3.5, 8]} />
      </mesh>

      {/* Holder */}
      <mesh position={[0, 3.6, 0.3]} material={sharedPostMaterial}>
        <boxGeometry args={[0.2, 0.2, 0.8]} />
      </mesh>

      {/* Bulb */}
      <mesh position={[0, 3.6, 0.3]}>
        <sphereGeometry args={[0.4, 8, 6]} />
        <meshBasicMaterial color={bulbColor} />
      </mesh>

      {/* Light Source */}
      <pointLight
        position={[0, 3.6, 0.3]}
        color={bulbColor}
        intensity={lightIntensity}
        distance={tileSize * 2}
        decay={1.5}
      />
    </group>
  );
}
/**
 * 2. The Scenery Manager Component (Replaces placeRoadsideObjects)
 */
export default function RoadsideScenery({
  grid,
  tileSize = 10,
  nightIntensity = 8, // Pass this prop from the parent to animate day/night cycles
  ...props
}) {
  const gridWidth = grid[0].length;
  const gridHeight = grid.length;

  // Helper to convert array coordinates to 3D world coordinates
  const gridToWorld = (x, z) => ({
    x: (x - gridWidth / 2 + 0.5) * tileSize,
    z: (z - gridHeight / 2 + 0.5) * tileSize,
  });

  // Calculate all lamp placements once, recalculating only if the grid changes
  const lamps = useMemo(() => {
    const lampData = [];

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        // Only evaluate empty spaces next to paths (grid === 1)
        if (grid[z][x] === 0) continue;

        const worldPos = gridToWorld(x, z);

        // South-facing placement
        if (z > 0 && grid[z - 1][x] === 0 && x % 3 === 0) {
          lampData.push({
            id: `S-${x}-${z}`,
            position: [worldPos.x, 0, worldPos.z - tileSize * 0.45],
            rotation: [0, 0, 0],
          });
        }
        // North-facing placement
        if (z < gridHeight - 1 && grid[z + 1][x] === 0 && x % 3 === 1) {
          lampData.push({
            id: `N-${x}-${z}`,
            position: [worldPos.x, 0, worldPos.z + tileSize * 0.45],
            rotation: [0, Math.PI, 0],
          });
        }
        // West-facing placement
        if (x > 0 && grid[z][x - 1] === 0 && z % 3 === 0) {
          lampData.push({
            id: `W-${x}-${z}`,
            position: [worldPos.x - tileSize * 0.45, 0, worldPos.z],
            rotation: [0, Math.PI / 2, 0],
          });
        }
        // East-facing placement
        if (x < gridWidth - 1 && grid[z][x + 1] === 0 && z % 3 === 1) {
          lampData.push({
            id: `E-${x}-${z}`,
            position: [worldPos.x + tileSize * 0.45, 0, worldPos.z],
            rotation: [0, -Math.PI / 2, 0],
          });
        }
      }
    }
    return lampData;
  }, [grid, tileSize]);

  return (
    <group {...props}>
      {lamps.map((lamp) => (
        <ClassicalLamp
          key={lamp.id}
          position={lamp.position}
          rotation={lamp.rotation}
          tileSize={tileSize}
          lightIntensity={nightIntensity}
        />
      ))}
    </group>
  );
}
