import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { translations } from '@/constants/translations';
import { getLevels } from '@/utils/get-levels';
import MazeMesh from '@/components/maze-mesh';
import GoalMarker from '@/components/goal-marker';
import gridToWorld from '@/utils/grid-to-world';
import {
  TILE_SIZE,
  WALL_HEIGHT,
  MOVE_SPEED,
  TURN_SPEED,
  LUCKY_CAT,
} from '@/constants/constants';
import WaypointMesh from '@/components/waypoint-mesh';
import PlayerController from '@/components/player-controller';
import React, { useState } from 'react';
import { View } from 'react-native';

export default function Main() {
  let { scene, camera, clock } = useThree();
  let renderer;
  let starField;
  let player,
    playerCarModel,
    mazeGroup,
    landmarksGroup,
    goalMarker,
    sceneryGroup,
    steeringWheel;
  let waypointsGroup, highlightFloorsGroup;
  let minimap, minimapCtx;
  let minimapBgCanvas, minimapBgCtx;
  const [gameState, setGameState] = useState('STARTUP_MODAL'); // 'STARTUP_MODAL', 'MAIN_MENU', 'DRIVING', etc.
  const [language, setLanguage] = useState('zh');
  const [playerInfo, setPlayerInfo] = useState({
    nickname: '',
    gender: 'other',
  });

  // Camera & Controls State
  const [viewMode, setViewMode] = useState('1P');
  const [thirdPersonControls, setThirdPersonControls] = useState({
    zoom: 2.5,
    angle: 45,
    carScale: 1.0,
  });
  const [minimapOrientation, setMinimapOrientation] = useState('NORTH_UP');
  const [arrowHints, setArrowHints] = useState({ '1P': 'on', '3P': 'off' });

  // Settings & Texture State
  const [uiSettings, setUiSettings] = useState({
    fontSize: 1,
    minimapSize: 1,
    helperText: 'on',
  });
  const [textures, setTextures] = useState({
    floor: null,
    wallN: null,
    wallS: null,
    wallE: null,
    wallW: null,
  });
  const [textureScales, setTextureScales] = useState({ floor: 1, wall: 1 });

  // Modal Visibility State (Replaces element.style.display = 'none'/'flex')
  const [modals, setModals] = useState({
    settings: false,
    pause: false,
    levelSelect: false,
    confirmReset: false,
  });

  let minimapOrientationMode = 'NORTH_UP'; // 'NORTH_UP' | 'HEADING_UP'
  try {
    const savedMinimapMode = localStorage.getItem(
      'minimap_orientation_mode_v1',
    );
    if (savedMinimapMode === 'HEADING_UP' || savedMinimapMode === 'NORTH_UP') {
      minimapOrientationMode = savedMinimapMode;
    }
  } catch (e) {
    // localStorage may be unavailable in some environments
  }

  let arrowHintsEnabled = { '1P': true, '3P': false };
  let currentLevelIndex = 0;

  let currentLevelState = {
    playerChoices: 0,
    isWaypointMode: false,
    totalWaypoints: 0,
    nextWaypoint: 1,
    touchedHighlightFloors: new Set(),
  };
  let activeFireworks = [];

  let targetPosition = new THREE.Vector3();
  let targetRotation = new THREE.Euler();
  let previousGameState = '';
  let previousGridPos = null;

  const keyState = { a: false, d: false, e: false, w: false, escape: false };
  let keyDebounce = false;

  let wallMaterialN,
    wallMaterialS,
    wallMaterialE,
    wallMaterialW,
    floorMaterial,
    landmarkMaterial,
    goalWallMaterial;
  let hemisphereLight, dirLight;

  let customLevels = [];
  let luckyCatArm, luckyCatWrist, floatingHeart;
  let helveticaFont = null;

  let currentLanguage = 'zh';
  let promptTimeout;
  let hintTimeout;
  let currentEditorMode = 'custom';

  // Texture customization variables
  let textureURLs = {
    floor: null,
    wallN: null,
    wallS: null,
    wallE: null,
    wallW: null,
  };

  const levels = getLevels();
  // ====================================================================
  // 初始化函数 (Initialization)
  // ====================================================================

  // const skyMap = useTexture({ map: '@/assets/images/sky.jpg' });

  // New function to handle view mode switching (v10.0)

  useEffect(() => {
    changeViewMode();
  }, [viewMode]);

  const btn1P = useRef(null);
  const btn3P = useRef(null);
  const controls = useRef(null);
  function changeViewMode() {
    // setViewMode(mode);
    const btn1P = document.getElementById('view-1p-btn');
    const btn3P = document.getElementById('view-3p-btn');
    const controls = document.getElementById('third-person-controls');

    if (viewMode === '1P') {
      // First Person View
      if (controls) controls.style.display = 'none';
      camera.position.set(0, WALL_HEIGHT * 0.4, 0);
      camera.rotation.x = THREE.MathUtils.degToRad(-8);
      camera.rotation.y = 0;
      camera.rotation.z = 0; // Reset local rotation
      if (playerCarModel) playerCarModel.visible = false;
      if (steeringWheel) steeringWheel.visible = true;
      if (btn1P) btn1P.current.classList.add('active');
      if (btn3P) btn3P.current.classList.remove('active');
    } else if (viewMode === '3P') {
      // Third Person View
      if (controls) controls.style.display = 'flex';
      updateThirdPersonCamera(); // NEW: Set camera based on sliders
      if (playerCarModel) playerCarModel.visible = true;
      if (steeringWheel) steeringWheel.visible = false;
      if (btn1P) btn1P.current.classList.remove('active');
      if (btn3P) btn3P.current.classList.add('active');
    }
    // If we switch views during an intersection, update the helper arrows visibility
    if (gameState === 'AT_INTERSECTION') {
      checkForTurns();
    }
  }

  // NEW: Function to update 3P camera based on controls
  function updateThirdPersonCamera() {
    if (viewMode !== '3P') return;

    const zoom = thirdPersonControls.zoom; // This is a multiplier for TILE_SIZE
    const angleDeg = thirdPersonControls.angle; // This is the downward angle in degrees

    const distance = TILE_SIZE * zoom;
    const angleRad = THREE.MathUtils.degToRad(angleDeg);

    // Calculate local position for the camera relative to the player
    // Camera should be behind and above the player
    const camX = 0;
    const camY = distance * Math.sin(angleRad); // Height
    const camZ = distance * Math.cos(angleRad); // How far back

    camera.position.set(camX, camY, camZ);

    // The rotation should be pointing down towards the player's origin.
    camera.rotation.x = -angleRad;
    camera.rotation.y = 0; // Local rotations are 0
    camera.rotation.z = 0;
  }

  function updateTextureScales() {
    if (floorMaterial.map) {
      floorMaterial.map.repeat.set(textureScales.floor, textureScales.floor);
    }
    [wallMaterialN, wallMaterialS, wallMaterialE, wallMaterialW].forEach(
      (mat) => {
        if (mat.map) {
          mat.map.repeat.set(textureScales.wall, textureScales.wall);
        }
      },
    );
  }

  function setupDevPanel() {
    const select = document.getElementById('level-select');
    select.innerHTML = '';
    levels.forEach((_, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${translations[currentLanguage].level} ${index + 1}`;
      select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
      loadLevel(parseInt(e.target.value));
    });
    select.value = String(currentLevelIndex);
  }

  function showMainMenu() {
    setGameState('MAIN_MENU');
    document.getElementById('main-menu-modal').style.display = 'flex';
    document.getElementById('custom-mode-btn').disabled = !customLevels.some(
      (level) => level !== null,
    );
    document.getElementById('main-menu-info-box').innerHTML = '';

    [
      mazeGroup,
      landmarksGroup,
      sceneryGroup,
      waypointsGroup,
      highlightFloorsGroup,
    ].forEach((group) => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    });
    if (goalMarker) {
      scene.remove(goalMarker);
      goalMarker = null;
    }

    // Hide gameplay UI elements (v10.0)
    document.getElementById('view-toggle-container').style.display = 'none';
    document.getElementById('third-person-controls').style.display = 'none'; // NEW: Hide 3P controls
    document.getElementById('minimap-container').style.display = 'none';
    document.getElementById('show-minimap-btn').style.display = 'none';
    document.getElementById('big-map-prompt').style.display = 'none';
    document.getElementById('waypoint-hud').style.display = 'none';
    document.getElementById('ingame-hint').style.display = 'none';
    clearTimeout(hintTimeout);
  }

  // ====================================================================
  // 游戏核心逻辑 (Core Game Logic)
  // ====================================================================

  function loadLevel(levelData) {
    let level;
    if (typeof levelData === 'number') {
      if (levelData >= levels.length) {
        console.error(`Level index ${levelData} out of bounds!`);
        showMainMenu();
        return;
      }
      currentLevelIndex = levelData;
      level = levels[levelData];
    } else {
      level = levelData;
      currentLevelIndex = -1;
    }

    clearTimeout(hintTimeout);
    document.getElementById('ingame-hint').style.display = 'none';
    document.getElementById('choice-prompt').style.display = 'none';
    previousGridPos = null;

    // Reset groups
    [
      mazeGroup,
      landmarksGroup,
      sceneryGroup,
      waypointsGroup,
      highlightFloorsGroup,
    ].forEach((group) => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    });
    if (goalMarker) {
      scene.remove(goalMarker);
      goalMarker = null;
    }

    // Reset level state
    currentLevelState = {
      playerChoices: 0,
      isWaypointMode: level.isWaypointMode || false,
      totalWaypoints: level.waypoints ? level.waypoints.length : 0,
      nextWaypoint: 1,
      touchedHighlightFloors: new Set(),
    };

    // createMazeMesh(level.grid, level.goal);
    placeRoadsideObjects(level.grid);
    if (level.waypoints && level.waypoints.length > 0) {
      level.waypoints.forEach((wp, index) => {
        const waypointMesh = createWaypointMesh(index + 1, wp.color);
        const wpPos = gridToWorld(wp.x, wp.z, level.grid);
        waypointMesh.position.set(wpPos.x, 0, wpPos.z);
        waypointsGroup.add(waypointMesh);
      });
    }
    if (level.highlightFloors && level.highlightFloors.length > 0) {
      level.highlightFloors.forEach((hf) => {
        const hfPos = gridToWorld(hf.x, hf.z, level.grid);
        const hfMesh = createHighlightFloorMesh(hfPos);
        highlightFloorsGroup.add(hfMesh);
      });
    }

    const startPos = gridToWorld(level.start.x, level.start.z, level.grid);
    player.position.set(startPos.x, 0, startPos.z);
    player.rotation.y = dirToAngle(level.start.dir);
    targetRotation.y = player.rotation.y;

    if (
      currentLevelIndex >= 0 &&
      document.getElementById('dev-panel').style.display === 'block'
    ) {
      document.getElementById('level-select').value = String(currentLevelIndex);
    }

    updateMinimapOrientationButton();
    updateHUD();

    updateMinimapPlayer();

    // Show view toggle (v10.0)
    document.getElementById('view-toggle-container').style.display = 'flex';

    setGameState('BIG_MAP');

    const bigMapViewModal = document.getElementById('big-map-view-modal');
    const bigMapWrapper = document.getElementById('big-map-container-wrapper');
    const minimapContainer = document.getElementById('minimap-container');
    bigMapWrapper.appendChild(minimapContainer);
    minimapContainer.style.display = 'block';
    minimapContainer.classList.remove('small-map');
    minimapContainer.classList.add('big-map');

    updateUIText();

    bigMapViewModal.style.display = 'flex';
    document.getElementById('big-map-prompt').style.display = 'none';
  }

  function worldToGrid(position) {
    const level =
      currentLevelIndex === -1
        ? customLevels[selectedCustomMapIndex]
        : levels[currentLevelIndex];
    if (!level || !level.grid) return { x: 0, z: 0 };
    const gridWidth = level.grid[0].length;
    const gridHeight = level.grid.length;
    return {
      x: Math.round(position.x / TILE_SIZE + gridWidth / 2 - 0.5),
      z: Math.round(position.z / TILE_SIZE + gridHeight / 2 - 0.5),
    };
  }

  function dirToAngle(dir) {
    switch (dir) {
      case 'N':
        return Math.PI;
      case 'E':
        return -Math.PI / 2;
      case 'S':
        return 0;
      case 'W':
        return Math.PI / 2;
    }
    return 0;
  }

  function afterMoveChecks() {
    const level =
      currentLevelIndex === -1
        ? customLevels[selectedCustomMapIndex]
        : levels[currentLevelIndex];
    const gridPos = worldToGrid(player.position);

    // Waypoint check (v10.0 Fixes applied)
    if (
      currentLevelState.isWaypointMode &&
      currentLevelState.nextWaypoint <= currentLevelState.totalWaypoints
    ) {
      const nextWpData = level.waypoints[currentLevelState.nextWaypoint - 1];
      if (gridPos.x === nextWpData.x && gridPos.z === nextWpData.z) {
        const collectedWaypointMesh =
          waypointsGroup.children[currentLevelState.nextWaypoint - 1];
        if (
          collectedWaypointMesh &&
          !collectedWaypointMesh.userData.collected
        ) {
          collectedWaypointMesh.userData.collected = true;

          // Trigger enhanced firework effect
          createFireworkEffect(
            collectedWaypointMesh.position,
            nextWpData.color,
          );

          // Change appearance instead of hiding
          const gem = collectedWaypointMesh.getObjectByName('waypoint_gem');
          const textWrapper = collectedWaypointMesh.children.find(
            (c) => c.onBehtmlForeRender,
          );
          const light = collectedWaypointMesh.getObjectByProperty(
            'isPointLight',
            true,
          );

          if (gem) {
            gem.material.emissiveIntensity = 0;
            gem.material.opacity = 0.25;
          }
          if (textWrapper) {
            textWrapper.visible = false;
          }
          if (light) {
            light.intensity = 0;
          }

          currentLevelState.nextWaypoint++;
          updateMinimapOrientationButton();
          updateHUD();
          // Explicitly update the minimap to guarantee the star appears.
          updateMinimapPlayer();
        }
      }
    }

    // Highlight Floor check
    const floorKey = `${gridPos.x},${gridPos.z}`;
    if (!currentLevelState.touchedHighlightFloors.has(floorKey)) {
      if (
        level.highlightFloors &&
        level.highlightFloors.some(
          (f) => f.x === gridPos.x && f.z === gridPos.z,
        )
      ) {
        const floorIndex = level.highlightFloors.findIndex(
          (f) => f.x === gridPos.x && f.z === gridPos.z,
        );
        const floorMesh = highlightFloorsGroup.children[floorIndex];
        if (floorMesh) {
          floorMesh.material.color.set(0x007bff); // Blue
        }
        currentLevelState.touchedHighlightFloors.add(floorKey);
      }
    }

    // Goal check
    if (gridPos.x === level.goal.x && gridPos.z === level.goal.z) {
      if (
        currentLevelState.isWaypointMode &&
        currentLevelState.nextWaypoint <= currentLevelState.totalWaypoints
      ) {
        showTemporaryMessage(translations[currentLanguage].prompt_goal_locked);
        checkForTurns();
      } else {
        setGameState('LEVEL_COMPLETE');
        showLevelComplete();
      }
      return;
    }

    checkForTurns();
  }

  function checkForTurns() {
    const availableTurns = createDirectionalHelpers();
    updateChoicePrompt(availableTurns);
    setGameState('AT_INTERSECTION');
  }

  function cameraShake() {
    // Only apply shake in 1P view for better immersion (v10.0)
    if (viewMode !== '1P') return;

    const shakeIntensity = 0.05;
    let shakeDuration = 200;
    const startTime = Date.now();
    // Store original position relative to the player for 1P view
    // Since setViewMode sets the base position, we use that as the reference.
    const originalPos = new THREE.Vector3(0, WALL_HEIGHT * 0.4, 0);

    function shake() {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > shakeDuration) {
        // Ensure camera returns exactly to the 1P position
        camera.position.copy(originalPos);
        return;
      }
      const progress = elapsedTime / shakeDuration;
      const shakeAmount = shakeIntensity * (1 - progress);
      camera.position.set(
        originalPos.x + (Math.random() - 0.5) * shakeAmount,
        originalPos.y + (Math.random() - 0.5) * shakeAmount,
        originalPos.z,
      );
      requestAnimationFrame(shake);
    }
    shake();
  }

  function showTemporaryMessage(message, duration = 2000) {
    const prompt = document.getElementById('choice-prompt');
    prompt.textContent = message;
    prompt.style.display = 'inline-block';
    clearTimeout(promptTimeout);
    promptTimeout = setTimeout(() => {
      if (gameState === 'AT_INTERSECTION') {
        checkForTurns();
      }
    }, duration);
  }

  function updateChoicePrompt(availableTurns) {
    const prompt = document.getElementById('choice-prompt');
    const helperToggle = document.getElementById('helper-text-toggle').value;
    const lang = translations[currentLanguage];

    if (gameState !== 'AT_INTERSECTION' || helperToggle === 'off') {
      prompt.style.display = 'none';
      return;
    }

    prompt.style.display = 'inline-block';
    const options = [];
    if (availableTurns.htmlForward) options.push(`${lang.forward} [W/↑]`);
    if (availableTurns.left) options.push(`${lang.turnLeft} [A/←]`);
    if (availableTurns.right) options.push(`${lang.turnRight} [D/→]`);

    if (
      !availableTurns.htmlForward &&
      !availableTurns.left &&
      !availableTurns.right
    ) {
      prompt.textContent = lang.prompt_dead_end;
    } else if (options.length > 0) {
      prompt.textContent = lang.prompt_options(options);
    } else {
      prompt.textContent = lang.turnAround;
    }
  }

  function setupMove(dir = 1) {
    const level =
      currentLevelIndex === -1
        ? customLevels[selectedCustomMapIndex]
        : levels[currentLevelIndex];
    const gridPos = worldToGrid(player.position);
    const moveVector = new THREE.Vector3(0, 0, -1)
      .applyEuler(player.rotation)
      .multiplyScalar(dir);
    const nextGridX = gridPos.x + Math.round(moveVector.x);
    const nextGridZ = gridPos.z + Math.round(moveVector.z);

    const isGoalNext = nextGridX === level.goal.x && nextGridZ === level.goal.z;
    const isGoalLocked =
      currentLevelState.isWaypointMode &&
      currentLevelState.nextWaypoint <= currentLevelState.totalWaypoints;

    if (isGoalNext && !isGoalLocked) {
      showTemporaryMessage(
        translations[currentLanguage].prompt_near_goal,
        2500,
      );
    }

    if (
      nextGridZ < 0 ||
      nextGridZ >= level.grid.length ||
      nextGridX < 0 ||
      nextGridX >= level.grid[0].length ||
      level.grid[nextGridZ][nextGridX] === 0
    ) {
      cameraShake();
      showTemporaryMessage(translations[currentLanguage].prompt_wall);
    } else {
      previousGridPos = gridPos;
      currentLevelState.playerChoices++;
      document.getElementById('choice-prompt').style.display = 'none';
      while (landmarksGroup.children.length > 0) {
        landmarksGroup.remove(landmarksGroup.children[0]);
      }
      targetPosition.copy(gridToWorld(nextGridX, nextGridZ, level.grid));
      setGameState('DRIVING');
    }
  }

  function showLevelComplete() {
    const modal = document.getElementById('level-complete-modal');
    const lang = translations[currentLanguage];

    document.getElementById('results-title').textContent = lang.levelComplete;
    modal.style.display = 'flex';
  }

  // ====================================================================
  // 渲染和动画 (Rendering & Animation)
  // ====================================================================

  function animate() {
    requestAnimationFrame(animate);
    if (gameState === 'PAUSED') return;
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Day/Night Cycle (Visuals update)
    const dayNightCycle = (Math.sin(elapsedTime * (0.1 / 3)) + 1) / 2;
    const skyDay = new THREE.Color(0x87ceeb);
    const skyNight = new THREE.Color(0x210033);
    const visualColor = skyNight.clone().lerp(skyDay, dayNightCycle);

    if (scene.fog) scene.fog.color.copy(visualColor);
    // Only update background color if a texture isn't used
    if (!scene.background || !scene.background.isTexture) {
      scene.background = visualColor;
      renderer.setClearColor(visualColor, 1);
    }

    hemisphereLight.intensity = dayNightCycle * 2.0 + 0.4;
    dirLight.intensity = dayNightCycle * 2.5 + 0.3;

    const nightIntensity = Math.max(0, 1 - dayNightCycle * 3);
    sceneryGroup.children.forEach((sceneryObject) => {
      const light = sceneryObject.getObjectByName('lampLight');
      if (light) light.intensity = nightIntensity * 8;
    });

    // Object animations (Lucky Cat, Heart, Waypoints)
    if (goalMarker && luckyCatArm) {
      goalMarker.position.y =
        WALL_HEIGHT / 2 - 1.5 + Math.sin(elapsedTime) * 0.2;
      goalMarker.rotation.y += delta * 0.4;
      const toRad = THREE.MathUtils.degToRad;
      luckyCatArm.rotation.x =
        toRad(LUCKY_CAT.WAVE_CENTER_DEG) +
        Math.sin(elapsedTime * LUCKY_CAT.WAVE_SPEED) *
          toRad(LUCKY_CAT.WAVE_AMPL_DEG);
      if (luckyCatWrist)
        luckyCatWrist.rotation.x =
          Math.sin(elapsedTime * LUCKY_CAT.WRIST_SPEED) *
          toRad(LUCKY_CAT.WRIST_AMPL_DEG);
    }
    if (floatingHeart) {
      const t = elapsedTime * 1.5;
      floatingHeart.position.y =
        floatingHeart.userData.baseY + Math.sin(t) * 0.18;
      const s = 1.0 + Math.sin(t * 2.0) * 0.06;
      floatingHeart.scale.set(s, s, s);
      floatingHeart.rotation.y += delta * 0.6;
    }

    waypointsGroup.children.forEach((wp) => {
      wp.rotation.y += delta * 0.5;
      const gem = wp.getObjectByName('waypoint_gem');
      if (gem) gem.rotation.y += delta * 1.5;
    });

    // Animate fireworks (Enhanced v10.0)
    const gravity = 9.8 * 0.5; // Reduced gravity for better visual effect
    for (let i = activeFireworks.length - 1; i >= 0; i--) {
      const firework = activeFireworks[i];
      let allParticlesDead = true;

      firework.particles.forEach((p) => {
        if (p.userData.lifespan > 0) {
          allParticlesDead = false;
          p.userData.velocity.y -= gravity * delta;
          p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
          p.userData.lifespan -= delta;

          // Fade out effect (using per-particle materials)
          if (p.material.transparent) {
            const lifeRatio = p.userData.lifespan / p.userData.maxLifespan;
            // Fade out rapidly near the end of life (e.g., quadratic fade)
            p.material.opacity = Math.pow(lifeRatio, 2);
          }
        } else {
          p.visible = false;
        }
      });

      if (allParticlesDead) {
        // Cleanup: Dispose shared geometry and individual materials
        if (firework.geometry) firework.geometry.dispose();
        firework.particles.forEach((p) => {
          if (p.material && p.material.dispose) p.material.dispose();
        });
        scene.remove(firework.group);
        activeFireworks.splice(i, 1);
      }
    }

    // Player movement handling
    if (gameState === 'TURNING') {
      let angleDiff = targetRotation.y - player.rotation.y;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (Math.abs(angleDiff) > 0.01) {
        const turnStep = Math.sign(angleDiff) * TURN_SPEED * delta;
        player.rotation.y +=
          Math.abs(turnStep) >= Math.abs(angleDiff) ? angleDiff : turnStep;
      } else {
        player.rotation.y = targetRotation.y;
        setGameState('AT_INTERSECTION');
        checkForTurns();
      }
    }
    if (gameState === 'DRIVING') {
      const distanceToTarget = player.position.distanceTo(targetPosition);
      if (distanceToTarget > 0.01) {
        const moveVector = targetPosition
          .clone()
          .sub(player.position)
          .normalize();
        const moveAmount = Math.min(distanceToTarget, MOVE_SPEED * delta);
        player.position.add(moveVector.multiplyScalar(moveAmount));

        // Animate wheels in 3P view (v10.0)
        if (viewMode === '3P' && playerCarModel) {
          // Iterate through the car model parts to find the wheels (which are Groups containing the tire and rim)
          playerCarModel.children.forEach((child) => {
            if (child.name === 'wheelGroup') {
              // Rotate the wheel group around its local X axis (since it was rotated on Z during creation)
              // Rotation speed is proportional to movement speed. (MOVE_SPEED / wheelRadius)
              // Wheel radius is TILE_SIZE * 0.15
              child.rotation.x += (MOVE_SPEED / (TILE_SIZE * 0.15)) * delta;
            }
          });
        }
      } else {
        player.position.copy(targetPosition);
        afterMoveChecks();
      }
    }

    if (steeringWheel)
      steeringWheel.rotation.z = (player.rotation.y - targetRotation.y) * 2;

    if (
      ['DRIVING', 'TURNING', 'AT_INTERSECTION', 'BIG_MAP'].includes(gameState)
    )
      updateMinimapPlayer();

    landmarksGroup.traverse((child) => {
      if (child.name === 'arrowGlow')
        child.material.opacity =
          ((Math.sin(elapsedTime * 6 + child.userData.phase) + 1) / 2) * 0.6 +
          0.1;
    });

    if (starField && starField.material) {
      const nightFactor = Math.max(0, 1 - dayNightCycle * 1.15);
      starField.material.opacity = Math.min(
        1.0,
        Math.pow(nightFactor, 0.6) * 1.2,
      );
    }

    renderer.render(scene, camera);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ====================================================================
  // 输入处理 (Input Handling)
  // ====================================================================

  function onKeyDown(event) {
    if (!event || !event.key) return;
    const key = event.key.toLowerCase();
    if (keyState[key]) return;
    keyState[key] = true;

    if (key === 'escape') {
      togglePauseMenu();
      return;
    }

    // Prevent page scroll on arrow keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      if (event.preventDefault) event.preventDefault();
    }

    if (gameState !== 'AT_INTERSECTION' || keyDebounce) return;

    keyDebounce = true;
    setTimeout(() => {
      keyDebounce = false;
    }, 100);

    if (key === 'd' || key === 'arrowright') {
      targetRotation.y -= Math.PI / 2;
      setGameState('TURNING');
    } else if (key === 'a' || key === 'arrowleft') {
      targetRotation.y += Math.PI / 2;
      setGameState('TURNING');
    } else if (key === 'w' || key === 'arrowup') {
      setupMove(1);
    } else if (key === 's' || key === 'arrowdown') {
      setupMove(-1);
    }
  }

  function onKeyUp(event) {
    if (!event || !event.key) return;
    keyState[event.key.toLowerCase()] = false;
  }

  // ====================================================================
  // 3D迷宫与视觉生成 (3D Maze & Visuals Generation)
  // ====================================================================

  function createFireworkEffect(position, color) {
    const firework = new THREE.Group();
    // Start higher for better visibility, especially in first person
    firework.position.copy(position);
    firework.position.y += WALL_HEIGHT * 0.6;
    scene.add(firework);

    const particleCount = 150;
    const particles = [];

    // Base material definition for glowing effect
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending, // Key for the glow effect
      depthWrite: false, // Prevents particles rendering over each other incorrectly
    });

    // Shared geometry
    const particleGeo = new THREE.SphereGeometry(0.15, 8, 8);

    for (let i = 0; i < particleCount; i++) {
      // Clone material for individual opacity control (ESSENTIAL for fade-out)
      const particleMaterial = baseMaterial.clone();
      const particle = new THREE.Mesh(particleGeo, particleMaterial);

      // Calculate velocity for explosion
      const theta = Math.random() * 2 * Math.PI;
      // Slightly restrict vertical angle so it doesn't just shoot straight up/down
      const phi = Math.acos(Math.random() * 1.8 - 0.8);
      const speed = Math.random() * 8 + 8; // Increased speed (8 to 16)

      particle.userData.velocity = new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.cos(phi),
        speed * Math.sin(phi) * Math.sin(theta),
      );

      // Lifespan
      const lifespan = Math.random() * 2.0 + 1.0; // 1.0s to 3.0s
      particle.userData.lifespan = lifespan;
      particle.userData.maxLifespan = lifespan; // Store max lifespan for fade calculation

      firework.add(particle);
      particles.push(particle);
    }
    baseMaterial.dispose(); // Dispose the template material

    // Store group, particles, and the shared geometry for later cleanup
    activeFireworks.push({
      group: firework,
      particles: particles,
      geometry: particleGeo,
    });
  }

  function createHighlightFloorMesh(worldPos) {
    const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc107, // Golden yellow
      emissive: 0xcc9a00,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(worldPos.x, 0.05, worldPos.z);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function createDirectionalHelpers() {
    // Clear old arrows
    while (landmarksGroup.children.length > 0)
      landmarksGroup.remove(landmarksGroup.children[0]);

    const level =
      currentLevelIndex === -1
        ? customLevels[selectedCustomMapIndex]
        : levels[currentLevelIndex];
    if (!level) return { htmlForward: false, left: false, right: false };

    const gridPos = worldToGrid(player.position);
    const available = { htmlForward: false, left: false, right: false };

    // Arrow geometry & materials
    const arrowShape = new THREE.Shape();
    const w = 0.5,
      h = 0.72;
    arrowShape
      .moveTo(0, h / 2)
      .lineTo(w / 2, 0)
      .lineTo(w / 4, 0)
      .lineTo(w / 4, -h / 2)
      .lineTo(-w / 4, -h / 2)
      .lineTo(-w / 4, 0)
      .lineTo(-w / 2, 0)
      .closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const yellowArrowMat = new THREE.MeshBasicMaterial({
      color: 0xffc107,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const redArrowMat = new THREE.MeshBasicMaterial({
      color: 0xdc3545,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const baseYaw =
      Math.round(player.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
    const isPath = (x, z) =>
      z >= 0 &&
      z < level.grid.length &&
      x >= 0 &&
      x < level.grid[0].length &&
      level.grid[z][x] === 1;

    const dirs = [
      {
        name: 'htmlForward',
        yaw: baseYaw,
        pos: new THREE.Vector3(0.0, -0.0, -4.0),
        rotZ: 0.0,
      },
      {
        name: 'left',
        yaw: baseYaw + Math.PI / 2,
        pos: new THREE.Vector3(-1.6, -0.0, -4.0),
        rotZ: Math.PI / 2,
      },
      {
        name: 'right',
        yaw: baseYaw - Math.PI / 2,
        pos: new THREE.Vector3(1.6, -0.0, -4.0),
        rotZ: -Math.PI / 2,
      },
    ];

    // Per-view toggle
    const shouldShowArrows = !!arrowHintsEnabled[viewMode];

    for (const d of dirs) {
      const moveVec = new THREE.Vector3(0, 0, -1).applyEuler(
        new THREE.Euler(0, d.yaw, 0),
      );
      const nx = gridPos.x + Math.round(moveVec.x);
      const nz = gridPos.z + Math.round(moveVec.z);

      if (isPath(nx, nz)) {
        available[d.name] = true;

        if (shouldShowArrows) {
          const isBackwards =
            previousGridPos &&
            nx === previousGridPos.x &&
            nz === previousGridPos.z;
          const arrowMat = isBackwards ? redArrowMat : yellowArrowMat;
          const arrow = new THREE.Mesh(arrowGeo, arrowMat);
          arrow.position.copy(d.pos);
          arrow.rotation.z = d.rotZ;
          landmarksGroup.add(arrow);
        }
      }
    }
    return available;
  }

  function createSteeringWheel() {
    const wheelGroup = new THREE.Group();
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.7,
      metalness: 0.1,
    });
    const gloveMatLeft = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.8,
    });
    const gloveMatRight = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      roughness: 0.6,
    });
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.08, 16, 60),
      wheelMat,
    );
    wheelGroup.add(wheel);
    const createGlove = (hand = 'left', gloveMat = gloveMatRight) => {
      const gloveGroup = new THREE.Group();
      const palm = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 12),
        gloveMat,
      );
      palm.scale.set(1, 1.2, 1);
      gloveGroup.add(palm);
      const thumb = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 8),
        gloveMat,
      );
      thumb.position.set(hand === 'left' ? 0.15 : -0.15, 0.1, 0);
      gloveGroup.add(thumb);
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16),
        cuffMat,
      );
      cuff.position.y = -0.15;
      gloveGroup.add(cuff);
      return gloveGroup;
    };
    const leftHand = createGlove('left', gloveMatLeft);
    leftHand.position.set(-0.45, 0.1, 0);
    leftHand.rotation.z = 0.5;
    wheelGroup.add(leftHand);
    const rightHand = createGlove('right', gloveMatRight);
    rightHand.position.set(0.45, 0.1, 0);
    rightHand.rotation.z = -0.5;
    wheelGroup.add(rightHand);
    wheelGroup.position.set(0, -1.2, -2);
    wheelGroup.rotation.x = -0.5;
    return wheelGroup;
  }

  function createStarField() {
    const starCount = 4500;
    const radius = 500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; ) {
      const u = Math.random(),
        v = Math.random(),
        theta = 2 * Math.PI * u,
        phi = Math.acos(2 * v - 1);
      const y = Math.cos(phi);
      if (y < 0.02) continue;
      positions[i++] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i++] = radius * y;
      positions[i++] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.0,
      sizeAttenuation: true,
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    starField = new THREE.Points(geo, mat);
    starField.frustumCulled = false;
    starField.renderOrder = 0;
    scene.add(starField);
  }

  function createClassicalLamp() {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.6,
      metalness: 0.4,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8),
      postMat,
    );
    base.position.y = 0.1;
    group.add(base);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.1, 3.5, 8),
      postMat,
    );
    post.position.y = 1.85;
    group.add(post);
    const holder = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.8),
      postMat,
    );
    holder.position.set(0, 3.6, 0.3);
    group.add(holder);
    const lightColors = [0xfffee0, 0xffffff, 0xe0e0ff, 0xffe0e0, 0xffd54f];
    const randomColor =
      lightColors[Math.floor(Math.random() * lightColors.length)];
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: randomColor }),
    );
    bulb.position.set(0, 3.6, 0.3);
    group.add(bulb);
    const light = new THREE.PointLight(randomColor, 0, TILE_SIZE * 2, 1.5);
    light.name = 'lampLight';
    light.position.copy(bulb.position);
    group.add(light);
    return group;
  }

  function placeRoadsideObjects(grid) {
    const gridHeight = grid.length;
    const gridWidth = grid[0].length;
    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[z][x] === 0) continue;
        const worldPos = gridToWorld(x, z, grid);
        if (z > 0 && grid[z - 1][x] === 0 && x % 3 === 0) {
          const lamp = createClassicalLamp();
          lamp.position.set(worldPos.x, 0, worldPos.z - TILE_SIZE * 0.45);
          sceneryGroup.add(lamp);
        }
        if (z < gridHeight - 1 && grid[z + 1][x] === 0 && x % 3 === 1) {
          const lamp = createClassicalLamp();
          lamp.position.set(worldPos.x, 0, worldPos.z + TILE_SIZE * 0.45);
          lamp.rotation.y = Math.PI;
          sceneryGroup.add(lamp);
        }
        if (x > 0 && grid[z][x - 1] === 0 && z % 3 === 0) {
          const lamp = createClassicalLamp();
          lamp.position.set(worldPos.x - TILE_SIZE * 0.45, 0, worldPos.z);
          lamp.rotation.y = Math.PI / 2;
          sceneryGroup.add(lamp);
        }
        if (x < gridWidth - 1 && grid[z][x + 1] === 0 && z % 3 === 1) {
          const lamp = createClassicalLamp();
          lamp.position.set(worldPos.x + TILE_SIZE * 0.45, 0, worldPos.z);
          lamp.rotation.y = -Math.PI / 2;
          sceneryGroup.add(lamp);
        }
      }
    }
  }

  function createMaterials() {
    const defaultWallColorN = new THREE.Color(
      getComputedStyle(document.body)
        .getPropertyValue('--wall-color-ns')
        .trim(),
    );
    const defaultWallColorS = new THREE.Color(
      getComputedStyle(document.body)
        .getPropertyValue('--wall-color-ns')
        .trim(),
    );
    const defaultWallColorE = new THREE.Color(
      getComputedStyle(document.body)
        .getPropertyValue('--wall-color-ew')
        .trim(),
    );
    const defaultWallColorW = new THREE.Color(
      getComputedStyle(document.body)
        .getPropertyValue('--wall-color-ew')
        .trim(),
    );

    wallMaterialN = new THREE.MeshStandardMaterial({
      color: defaultWallColorN,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    wallMaterialS = new THREE.MeshStandardMaterial({
      color: defaultWallColorS,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    wallMaterialE = new THREE.MeshStandardMaterial({
      color: defaultWallColorE,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    wallMaterialW = new THREE.MeshStandardMaterial({
      color: defaultWallColorW,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const textureLoader = new THREE.TextureLoader();
    floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.6,
      roughness: 0.35,
    });

    landmarkMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(
        getComputedStyle(document.body)
          .getPropertyValue('--landmark-color')
          .trim(),
      ),
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    goalWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6666,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x330000,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
  }

  // ====================================================================
  // 小地图 (Minimap)
  // ====================================================================

  // NEW: Minimap orientation mode helpers (v10.1)
  function saveMinimapOrientationMode() {
    try {
      localStorage.setItem(
        'minimap_orientation_mode_v1',
        minimapOrientationMode,
      );
    } catch (e) {}
  }

  function updateMinimapOrientationButton() {
    const btn = document.getElementById('minimap-orientation-btn');
    if (!btn) return;

    const isHeadingUp = minimapOrientationMode === 'HEADING_UP';
    btn.classList.toggle('active', isHeadingUp);

    // Button label: N (north-up) / 🚗 (heading-up)
    btn.textContent = isHeadingUp ? '🚗' : 'N';

    if (currentLanguage === 'zh') {
      btn.title = isHeadingUp
        ? '小地图：跟随车头（点击切换为北向固定）'
        : '小地图：北向固定（点击切换为跟随车头）';
    } else {
      btn.title = isHeadingUp
        ? 'Minimap: Heading-Up (click to switch to North-Up)'
        : 'Minimap: North-Up (click to switch to Heading-Up)';
    }
  }

  function toggleMinimapOrientationMode() {
    minimapOrientationMode =
      minimapOrientationMode === 'HEADING_UP' ? 'NORTH_UP' : 'HEADING_UP';
    saveMinimapOrientationMode();
    updateMinimapOrientationButton();
    // Redraw immediately
    updateMinimapPlayer();
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x, y;
    let step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawMinimapBackground(
    ctx,
    canvas,
    grid,
    start,
    goal,
    waypoints,
    highlightFloors,
    nextWaypoint,
    touchedHighlightFloors,
  ) {
    canvas.width = 500;
    canvas.height = 500;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellWidth = canvas.width / grid[0].length;
    const cellHeight = canvas.height / grid.length;
    for (let z = 0; z < grid.length; z++) {
      for (let x = 0; x < grid[0].length; x++) {
        ctx.fillStyle = grid[z][x] === 0 ? '#444' : '#ddd';
        ctx.fillRect(x * cellWidth, z * cellHeight, cellWidth, cellHeight);
      }
    }
    if (highlightFloors) {
      highlightFloors.forEach((hf) => {
        const floorKey = `${hf.x},${hf.z}`;
        ctx.fillStyle = touchedHighlightFloors.has(floorKey)
          ? getComputedStyle(document.body).getPropertyValue('--start-color') // Blue
          : '#ffc107'; // Golden yellow
        ctx.fillRect(
          hf.x * cellWidth,
          hf.z * cellHeight,
          cellWidth,
          cellHeight,
        );
      });
    }
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      '--start-color',
    );
    ctx.fillRect(
      start.x * cellWidth,
      start.z * cellHeight,
      cellWidth,
      cellHeight,
    );
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      '--goal-color',
    );
    ctx.fillRect(
      goal.x * cellWidth,
      goal.z * cellHeight,
      cellWidth,
      cellHeight,
    );
    if (waypoints) {
      waypoints.forEach((wp, index) => {
        // Determine if visited based on the next required waypoint index
        const isVisited = index < nextWaypoint - 1;
        const cx = (wp.x + 0.5) * cellWidth;
        const cy = (wp.z + 0.5) * cellHeight;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        if (isVisited) {
          // Draw Star for visited waypoints (v10.0 Fix)
          ctx.fillStyle = '#FFD700'; // Gold color
          drawStar(ctx, cx, cy, 5, cellWidth / 2.5, cellWidth / 5);
        } else {
          // Draw Diamond for upcoming waypoints
          ctx.fillStyle = wp.color;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(
            -cellWidth / 3,
            -cellHeight / 3,
            (cellWidth * 2) / 3,
            (cellHeight * 2) / 3,
          );
          ctx.strokeRect(
            -cellWidth / 3,
            -cellHeight / 3,
            (cellWidth * 2) / 3,
            (cellHeight * 2) / 3,
          );
          ctx.restore();
          // Draw waypoint number only for unvisited waypoints
          ctx.fillStyle = 'white';
          ctx.font = `bold ${cellHeight * 0.5}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          ctx.fillText(index + 1, cx, cy);
          ctx.shadowBlur = 0;
        }
      });
    }
  }

  function drawMinimapPlayerArrow(
    ctx,
    playerX,
    playerZ,
    rotationRad,
    cellWidth,
    cellHeight,
  ) {
    ctx.save();
    ctx.translate(playerX, playerZ);
    ctx.rotate(rotationRad);

    const size = Math.min(cellWidth, cellHeight) * 1.2;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    grad.addColorStop(0, '#ff8080');
    grad.addColorStop(1, '#c00000');

    // Triangle points to +X by default
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(-size * 0.4, -size * 0.3);
    ctx.lineTo(-size * 0.4, size * 0.3);
    ctx.closePath();

    // Fill
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255,0,0,0.9)';
    ctx.shadowBlur = size * 0.7;
    ctx.fill();

    // Outline edges (keep original style)
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const ax = size * 0.5,
      ay = 0;
    const bx = -size * 0.4,
      by = -size * 0.3;
    const cx = -size * 0.4,
      cy = size * 0.3;

    // Bottom edge (B->C): dark green
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = '#006400';
    ctx.stroke();

    // Side edge (A->B): yellow
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    // Side edge (A->C): white
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();
  }

  function updateMinimapPlayer() {
    const level =
      currentLevelIndex === -1
        ? customLevels[selectedCustomMapIndex]
        : levels[currentLevelIndex];
    if (!level || !level.grid) return;

    const { grid, start, goal, waypoints, highlightFloors } = level;

    // Player data
    const gridPos = worldToGrid(player.position);

    // Heading angle in minimap (x right, z down)
    const dirVec = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const headingAngle = Math.atan2(dirVec.z, dirVec.x);

    // Canvas sizing
    minimap.width = 500;
    minimap.height = 500;

    const ctx = minimapCtx;
    const cellWidth = ctx.canvas.width / grid[0].length;
    const cellHeight = ctx.canvas.height / grid.length;
    const playerX = (gridPos.x + 0.5) * cellWidth;
    const playerZ = (gridPos.z + 0.5) * cellHeight;

    if (minimapOrientationMode === 'NORTH_UP') {
      // 1) North-Up (original behavior): map fixed, arrow rotates
      drawMinimapBackground(
        ctx,
        minimap,
        grid,
        start,
        goal,
        waypoints,
        highlightFloors,
        currentLevelState.nextWaypoint,
        currentLevelState.touchedHighlightFloors,
      );
      drawMinimapPlayerArrow(
        ctx,
        playerX,
        playerZ,
        headingAngle,
        cellWidth,
        cellHeight,
      );
      return;
    }

    // 2) Heading-Up: rotate the whole minimap so the car heading is "up"
    if (!minimapBgCanvas || !minimapBgCtx) {
      // Fallback
      drawMinimapBackground(
        ctx,
        minimap,
        grid,
        start,
        goal,
        waypoints,
        highlightFloors,
        currentLevelState.nextWaypoint,
        currentLevelState.touchedHighlightFloors,
      );
      drawMinimapPlayerArrow(
        ctx,
        playerX,
        playerZ,
        headingAngle,
        cellWidth,
        cellHeight,
      );
      return;
    }

    // Draw background to offscreen first
    drawMinimapBackground(
      minimapBgCtx,
      minimapBgCanvas,
      grid,
      start,
      goal,
      waypoints,
      highlightFloors,
      currentLevelState.nextWaypoint,
      currentLevelState.touchedHighlightFloors,
    );

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const desiredArrowAngle = -Math.PI / 2; // Up on canvas
    const rotateMapBy = desiredArrowAngle - headingAngle;

    // Rotate the minimap around the player position to keep the player anchored
    ctx.save();
    ctx.translate(playerX, playerZ);
    ctx.rotate(rotateMapBy);
    ctx.translate(-playerX, -playerZ);
    ctx.drawImage(minimapBgCanvas, 0, 0);
    ctx.restore();

    // Draw player arrow fixed to "up"
    drawMinimapPlayerArrow(
      ctx,
      playerX,
      playerZ,
      desiredArrowAngle,
      cellWidth,
      cellHeight,
    );
  }

  // ====================================================================
  // 菜单与UI逻辑 (Menu & UI Logic)
  // ====================================================================

  function showFreeModeLevelSelect() {
    const modal = document.getElementById('free-mode-level-select-modal');
    const grid = document.getElementById('free-mode-level-select-grid');
    grid.innerHTML = '';

    for (let i = 0; i < levels.length; i++) {
      const button = document.createElement('button');
      button.textContent = i + 1;
      button.onclick = () => {
        modal.style.display = 'none';
        loadLevel(i);
      };
      grid.appendChild(button);
    }
    document.getElementById('main-menu-modal').style.display = 'none';
    modal.style.display = 'flex';
  }

  function showIngameHint(messageKey = 'hint_ingame_controls') {
    const hintEl = document.getElementById('ingame-hint');
    hintEl.textContent = translations[currentLanguage][messageKey];
    hintEl.style.display = 'block';
    hintEl.style.opacity = 1;
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      hintEl.style.opacity = 0;
      setTimeout(() => {
        hintEl.style.display = 'none';
      }, 500);
    }, 8000);
  }

  function updateHUD() {
    const waypointHudEl = document.getElementById('waypoint-hud');
    if (
      currentLevelState.isWaypointMode &&
      currentLevelState.nextWaypoint <= currentLevelState.totalWaypoints
    ) {
      waypointHudEl.style.display = 'block';
      waypointHudEl.textContent = translations[currentLanguage].waypoint_hud(
        currentLevelState.nextWaypoint,
        currentLevelState.totalWaypoints,
      );
    } else {
      waypointHudEl.style.display = 'none';
    }
  }

  function updateUIText() {
    document.querySelectorAll('[data-lang-zh]').forEach((el) => {
      const key = currentLanguage === 'zh' ? 'langZh' : 'langEn';
      // Handle alt text for save button
      if (el.id === 'editor-save-btn' && el.dataset.langZhAlt) {
        const altKey = currentLanguage === 'zh' ? 'langZhAlt' : 'langEnAlt';
        el.textContent =
          currentEditorMode === 'custom' ? el.dataset[key] : el.dataset[altKey];
      } else {
        el.textContent = el.dataset[key];
      }
    });
    document.querySelectorAll('select').forEach((select) => {
      select.querySelectorAll('option').forEach((option) => {
        const key = currentLanguage === 'zh' ? 'langZh' : 'langEn';
        if (option.dataset[key]) option.textContent = option.dataset[key];
      });
    });
    document.querySelectorAll('[data-lang-placeholder-zh]').forEach((el) => {
      el.placeholder =
        el.dataset[
          currentLanguage === 'zh' ? 'langPlaceholderZh' : 'langPlaceholderEn'
        ];
    });
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg)
      welcomeMsg.textContent = translations[currentLanguage].welcome(
        playerInfo.nickname,
      );
    if (gameState === 'AT_INTERSECTION') checkForTurns();
    if (document.getElementById('ingame-hint').style.display !== 'none')
      showIngameHint();
    updateMinimapOrientationButton();
    updateHUD();
  }

  function togglePauseMenu() {
    const menu = document.getElementById('pause-menu-modal');
    const isPaused = menu.style.display === 'flex';
    if (isPaused) {
      menu.style.display = 'none';
      setGameState(previousGameState);
    } else if (
      ['AT_INTERSECTION', 'DRIVING', 'TURNING', 'BIG_MAP'].includes(gameState)
    ) {
      previousGameState = gameState;
      setGameState('PAUSED');
      menu.style.display = 'flex';
    }
  }

  function showLevelSelectModal() {
    const grid = document.getElementById('level-select-grid');
    grid.innerHTML = '';
    for (let i = 0; i < levels.length; i++) {
      const button = document.createElement('button');
      button.textContent = i + 1;
      button.onclick = () => {
        document.getElementById('level-select-modal').style.display = 'none';
        togglePauseMenu();
        loadLevel(i);
      };
      grid.appendChild(button);
    }
    document.getElementById('pause-menu-modal').style.display = 'none';
    document.getElementById('level-select-modal').style.display = 'flex';
  }

  function resetGame() {
    setPlayerInfo({ nickname: 'Driver', gender: 'other' });
    document.getElementById('nickname-input').value = '';
    document
      .querySelectorAll('.modal-overlay')
      .forEach((m) => (m.style.display = 'none'));
    document.getElementById('startup-modal').style.display = 'flex';
    setGameState('STARTUP_MODAL');
    updateUIText();
  }

  return (
    <>
      <MazeMesh grid={levels[0].grid} goal={levels[0].goal} />
      <GoalMarker
        position={levels[0].goal}
        grid={levels[0].grid}
        armRef={luckyCatArm}
        wristRef={luckyCatWrist}
      />

      <WaypointMesh number={1} />
      <PlayerController camera={camera} tileSize={TILE_SIZE} />
    </>
  );
}
