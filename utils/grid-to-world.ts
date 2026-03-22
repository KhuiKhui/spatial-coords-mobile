import * as THREE from 'three';
import { TILE_SIZE } from '@/constants/constants';

export default function gridToWorld(x, z, grid) {
  const gridWidth = grid[0].length;
  const gridHeight = grid.length;
  return new THREE.Vector3(
    (x - gridWidth / 2 + 0.5) * TILE_SIZE,
    0,
    (z - gridHeight / 2 + 0.5) * TILE_SIZE,
  );
}
