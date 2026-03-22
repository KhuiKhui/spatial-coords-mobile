import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CarModel from './car-model';
import { PI } from 'three/src/nodes/math/MathNode.js';

export default function PlayerController({
  tileSize = 10,
  moveSpeed = 15,
  turnSpeed = Math.PI * 2,
  ...props
}) {
  let { camera } = useThree();
  const playerRef = useRef(null);

  // 2. Replace global state variables with `useRef`
  // We use refs instead of `useState` so that updating them 60 times
  // a second doesn't trigger a massive React re-render.
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const targetRotationY = useRef(0);
  const gameState = useRef('AT_INTERSECTION'); // 'AT_INTERSECTION', 'TURNING', 'DRIVING'
  const keyDebounce = useRef(false);

  // 3. Handle Keyboard Inputs (Replaces your onKeyDown function)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event || !event.key) return;
      const key = event.key.toLowerCase();

      // Only accept input if we are idle at an intersection
      if (gameState.current !== 'AT_INTERSECTION' || keyDebounce.current)
        return;

      keyDebounce.current = true;
      setTimeout(() => {
        keyDebounce.current = false;
      }, 100);

      if (key === 'd' || key === 'arrowright') {
        targetRotationY.current -= Math.PI / 2;
        gameState.current = 'TURNING';
      } else if (key === 'a' || key === 'arrowleft') {
        targetRotationY.current += Math.PI / 2;
        gameState.current = 'TURNING';
      } else if (key === 'w' || key === 'arrowup') {
        setupMove(-1);
      } else if (key === 's' || key === 'arrowdown') {
        setupMove(1);
      }
    };

    // Attach listener (Note: This only works natively on Expo Web)
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tileSize]);

  const setupMove = (dir) => {
    // Calculate the movement vector based on the direction the car is currently facing
    const moveVector = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(0, targetRotationY.current, 0))
      .multiplyScalar(dir * tileSize);

    // TODO: Add your wall collision check here! (e.g., if grid[nextZ][nextX] === 0)
    // if (isColliding) return;

    targetPosition.current.add(moveVector);
    gameState.current = 'DRIVING';
  };

  // 4. The Game Loop (Replaces requestAnimationFrame and your animate() function)
  useFrame((state, delta) => {
    if (!playerRef.current) return;

    // playerRef.current IS your old `player` object!
    const player = playerRef.current;

    // --- Handle Turning Animation ---
    if (gameState.current === 'TURNING') {
      let angleDiff = targetRotationY.current - player.rotation.y;

      // Normalize angles so the car takes the shortest rotational path
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

      if (Math.abs(angleDiff) > 0.01) {
        const turnStep = Math.sign(angleDiff) * turnSpeed * delta;
        player.rotation.y +=
          Math.abs(turnStep) >= Math.abs(angleDiff) ? angleDiff : turnStep;
      } else {
        player.rotation.y = targetRotationY.current;
        gameState.current = 'AT_INTERSECTION';
        // You can trigger your checkForTurns() equivalent here
      }
    }

    // --- Handle Driving Animation ---
    if (gameState.current === 'DRIVING') {
      const distanceToTarget = player.position.distanceTo(
        targetPosition.current,
      );

      if (distanceToTarget > 0.01) {
        const moveVector = targetPosition.current
          .clone()
          .sub(player.position)
          .normalize();
        const moveAmount = Math.min(distanceToTarget, moveSpeed * delta);
        player.position.add(moveVector.multiplyScalar(moveAmount));

        // Bonus: Animate the wheels dynamically using the names you assigned in CarModel!
        player.traverse((child) => {
          if (child.name === 'wheelGroup') {
            child.rotation.x += (moveSpeed / (tileSize * 0.105)) * delta;
          }
        });
      } else {
        // Snap to exact tile position and stop
        player.position.copy(targetPosition.current);
        gameState.current = 'AT_INTERSECTION';
        // You can trigger your afterMoveChecks() equivalent here
      }
    }
    camera.position.set(
      player.position.x,
      player.position.y + 2,
      player.position.z,
    );
    camera.rotation.set(
      player.rotation.x,
      player.rotation.y + Math.PI,
      player.rotation.z,
    );
  });

  return (
    // This <group> is physically the "player". Moving this group moves the car inside it.
    <group ref={playerRef}>
      <CarModel camera={props.camera} tileSize={tileSize} />

      {/* 
        Bonus: If you want a 3rd Person camera, drop a <PerspectiveCamera makeDefault /> 
        right here, give it a position offset, and it will automatically follow the car! 
      */}
    </group>
  );
}
