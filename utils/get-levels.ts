import { MAZE_DATA } from '@/constants/levels';

export function getLevels() {
  return MAZE_DATA.map((mazeData) => {
    let start = {},
      goal = {};
    const height = mazeData.length;
    const width = mazeData[0].length;
    const grid = Array.from({ length: height }, (_, z) =>
      Array.from({ length: width }, (_, x) => {
        const cell = mazeData[z][x];
        if (cell === 'S') {
          start = { x, z, dir: 'S' };
          return 1;
        }
        if (cell === 'E') {
          goal = { x, z };
          return 1;
        }
        return cell === 1 ? 0 : 1;
      }),
    );
    if (start.x === 0) start.dir = 'E';
    else if (start.x === width - 1) start.dir = 'W';
    else if (start.z === 0) start.dir = 'S';
    else if (start.z === height - 1) start.dir = 'N';
    return {
      grid,
      start,
      goal,
      isWaypointMode: false,
      waypoints: [],
      highlightFloors: [],
    };
  });
}
