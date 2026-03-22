import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function MazeMesh({
  grid,
  goal,
  tileSize = 10,
  wallHeight = 5,
  ...props
}) {
  const gridWidth = grid[0].length;
  const gridHeight = grid.length;

  // Reconstructed gridToWorld helper function
  const gridToWorld = (x, z) => {
    return {
      x: (x - gridWidth / 2 + 0.5) * tileSize,
      z: (z - gridHeight / 2 + 0.5) * tileSize,
    };
  };

  // Memoize wall geometry data generation to optimize React render cycles
  const walls = useMemo(() => {
    const wallData = [];

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        // 1 represents a wall block in the grid
        if (grid[z][x] === 1) {
          const worldPos = gridToWorld(x, z);

          // Determine proximity to the goal for dynamic material assignment
          const isNearGoal =
            Math.abs(x - goal.x) <= 1 &&
            Math.abs(z - goal.z) <= 1 &&
            !(x === goal.x && z === goal.z);

          // South-facing wall (boundary with cell z-1)
          if (z > 0 && grid[z - 1][x] === 0) {
            wallData.push({
              id: `S-${x}-${z}`,
              position: [worldPos.x, wallHeight / 2, worldPos.z - tileSize / 2],
              rotation: [0, 0, 0],
              isGoalWall: isNearGoal && z - 1 === goal.z,
              dir: 'S',
            });
          }
          // North-facing wall (boundary with cell z+1)
          if (z < gridHeight - 1 && grid[z + 1][x] === 0) {
            wallData.push({
              id: `N-${x}-${z}`,
              position: [worldPos.x, wallHeight / 2, worldPos.z + tileSize / 2],
              rotation: [0, Math.PI, 0],
              isGoalWall: isNearGoal && z + 1 === goal.z,
              dir: 'N',
            });
          }
          // West-facing wall (boundary with cell x-1)
          if (x > 0 && grid[z][x - 1] === 0) {
            wallData.push({
              id: `W-${x}-${z}`,
              position: [worldPos.x - tileSize / 2, wallHeight / 2, worldPos.z],
              rotation: [0, Math.PI / 2, 0],
              isGoalWall: isNearGoal && x - 1 === goal.x,
              dir: 'W',
            });
          }
          // East-facing wall (boundary with cell x+1)
          if (x < gridWidth - 1 && grid[z][x + 1] === 0) {
            wallData.push({
              id: `E-${x}-${z}`,
              position: [worldPos.x + tileSize / 2, wallHeight / 2, worldPos.z],
              rotation: [0, -Math.PI / 2, 0],
              isGoalWall: isNearGoal && x + 1 === goal.x,
              dir: 'E',
            });
          }
        }
      }
    }
    return wallData;
  }, [grid, goal, tileSize, wallHeight]);

  // Material definitions (can be replaced with external textures passed via props)
  const materials = {
    floor: (
      <meshStandardMaterial color={0xcccccc} metalness={0.6} roughness={0.35} />
    ),
    goalWall: (
      <meshStandardMaterial
        color={0xff6666}
        roughness={0.6}
        metalness={0.2}
        emissive={0x330000}
        emissiveIntensity={0.25}
        side={THREE.DoubleSide}
      />
    ),
    N: (
      <meshStandardMaterial
        color="#888888"
        roughness={0.8}
        side={THREE.DoubleSide}
      />
    ),
    S: (
      <meshStandardMaterial
        color="#888888"
        roughness={0.8}
        side={THREE.DoubleSide}
      />
    ),
    E: (
      <meshStandardMaterial
        color="#aaaaaa"
        roughness={0.8}
        side={THREE.DoubleSide}
      />
    ),
    W: (
      <meshStandardMaterial
        color="#aaaaaa"
        roughness={0.8}
        side={THREE.DoubleSide}
      />
    ),
  };

  return (
    <group {...props}>
      {/* Floor Mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[gridWidth * tileSize, gridHeight * tileSize]} />
        {materials.floor}
      </mesh>

      {/* Generated Wall Meshes */}
      {walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} rotation={wall.rotation}>
          <planeGeometry args={[tileSize, wallHeight]} />
          {wall.isGoalWall ? materials.goalWall : materials[wall.dir]}
        </mesh>
      ))}
    </group>
  );
}
