import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import GUI from "lil-gui";
import { SelectionBox } from "three/addons/interactive/SelectionBox.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Base
 */

// Debug
const gui = new GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */

// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.x = 0;
camera.position.y = -3;
camera.position.z = 10;
camera.lookAt(0, 0, 0);
scene.add(camera);

// Controls
// const controls = new OrbitControls(camera, canvas);
// controls.enableDamping = true;

/**
 * Axes Helper
 */
const axesHelper = new THREE.AxesHelper(2);
axesHelper.position.set(1, 1, 1);
scene.add(axesHelper);

// Plane
const planeGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
const planeMaterial = new THREE.MeshBasicMaterial({
  color: 0x92999e,
  side: THREE.DoubleSide,
  wireframe: true,
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
scene.add(plane);

// Object
let selectedUnits = [];
let allUnits = [];
const unitSpeed = 4; // 2 units per second
const geometry = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 20; i++) {
  const material = new THREE.MeshLambertMaterial({ color: 0xff00ff });
  const mesh = new THREE.Mesh(geometry, material);
  let position;
  let tries = 0;

  // 겹치지 않는 위치 찾기 (최대 100번 시도)
  do {
    position = new THREE.Vector3(
      Math.random() * 20 - 10,
      Math.random() * 20 - 10,
      1
    );
    tries++;
  } while (isOverlapping(position, allUnits) && tries < 100);

  mesh.position.copy(position);
  mesh.name = "unit";
  mesh.userData.targetPosition = null;
  scene.add(mesh);
  allUnits.push(mesh);
}

function isOverlapping(newPos, existingUnits, minDistance = 1.5) {
  for (let unit of existingUnits) {
    if (unit.position.distanceTo(newPos) < minDistance) {
      return true;
    }
  }
  return false;
}

/**
 * Light
 */
const light = new THREE.AmbientLight(0xbbbbbb); // soft white light
scene.add(light);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Drag Select
 */
const selectionBox = new SelectionBox(camera, scene);
const helper = new SelectionHelper(renderer, "selectBox");

/**
 * Select Marker
 */
function createSelectionMarker(unit) {
  const innerRadius = 0.7;
  const outerRadius = 0.75;
  const segments = 32;

  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide, // 앞뒤 모두 보이게
    depthWrite: false,
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.set(0, 0, -0.51); // 유닛 밑으로 살짝

  unit.add(ring);
  unit.userData.selectionMarker = ring;
}

function removeSelectionMarker(unit) {
  if (unit.userData.selectionMarker) {
    unit.remove(unit.userData.selectionMarker);
    unit.userData.selectionMarker.geometry.dispose();
    unit.userData.selectionMarker.material.dispose();
    unit.userData.selectionMarker = null;
  }
}

/**
 * Target Marker
 */
function showMoveMarker(position) {
  const geometry = new THREE.RingGeometry(0.1, 0.15, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.copy(position);
  scene.add(ring);

  const startTime = performance.now();
  const duration = 200; // 0.5초로 약간 느리게

  function easeOutQuad(t) {
    return t * (2 - t); // 부드럽게 감속하는 이징
  }

  function animate() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1); // 0~1
    const eased = easeOutQuad(t);

    const scale = 1 + 1.8 * eased;
    ring.scale.set(scale, scale, scale);

    material.opacity = 1.0 - eased;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(ring);
      geometry.dispose();
      material.dispose();
    }
  }

  animate();
}

/**
 * Stats
 */
let stats;
stats = new Stats();
document.body.appendChild(stats.dom);

/**
 * Events
 */
document.addEventListener("pointerdown", function (event) {
  if (event.button === 2) {
    helper.isDown = false;
    return;
  }

  if (event.buttons === 1) {
    helper.enabled = true;
    helper.isDown = true;

    selectionBox.startPoint.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
      0.5
    );

    selectionBox.collection = [];
  } else {
    helper.enabled = false;
    helper.isDown = false;
    return;
  }

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const selectableUnits = scene.children.filter((obj) => obj.name === "unit");
  const intersects = raycaster.intersectObjects(selectableUnits);

  for (const item of selectableUnits) {
    item.material.emissive?.set(0x000000);
    removeSelectionMarker(item); // 마커 제거
  }

  selectedUnits = [];
  // 첫 번째 교차된 유닛만 선택
  if (intersects.length > 0) {
    const selected = intersects[0].object;
    selected.material.emissive?.set(0xaaaaaa);
    createSelectionMarker(selected); // 마커 추가
    selectedUnits.push(selected);
  }
});

document.addEventListener("pointermove", function (event) {
  if (!helper.enabled || !helper.isDown || event.buttons !== 1) return;

  for (let i = 0; i < selectionBox.collection.length; i++) {
    if (selectionBox.collection[i].name === "unit") {
      selectionBox.collection[i].material.emissive.set(0x000000);
      removeSelectionMarker(selectionBox.collection[i]); // 마커 제거
    }
  }

  selectionBox.endPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  const allSelected = selectionBox.select();
  selectedUnits = [];
  for (let i = 0; i < allSelected.length; i++) {
    if (allSelected[i].name === "unit") {
      allSelected[i].material.emissive?.set(0xaaaaaa);
      createSelectionMarker(allSelected[i]); // 마커 추가
      selectedUnits.push(allSelected[i]);
    }
  }
});

document.addEventListener("pointerup", function (event) {
  if (event.button === 2 && selectedUnits.length > 0) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Plane과 교차 확인
    const intersects = raycaster.intersectObject(plane);
    if (intersects.length > 0) {
      const targetPoint = intersects[0].point;
      console.log(targetPoint);

      const spacing = 1.5; // 유닛 간 거리
      const unitsPerRow = Math.ceil(Math.sqrt(selectedUnits.length));
      console.log(selectedUnits);

      selectedUnits.forEach((unit, i) => {
        const row = Math.floor(i / unitsPerRow);
        const col = i % unitsPerRow;

        // 중심 기준으로 좌우/상하로 퍼지게 오프셋 계산
        const offsetX = (col - (unitsPerRow - 1) / 2) * spacing;
        const offsetY = ((unitsPerRow - 1) / 2 - row) * spacing;

        const unitTarget = targetPoint
          .clone()
          .add(new THREE.Vector3(offsetX, offsetY, 0));
        unit.userData.targetPosition = unitTarget;
      });
      showMoveMarker(targetPoint);
    }
    return;
  }
  if (event.button !== 1) return;
  selectionBox.endPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  const allSelected = selectionBox.select();

  for (let i = 0; i < allSelected.length; i++) {
    if (allSelected[i].name === "unit") {
      allSelected[i].material.emissive.set(0xaaaaaa);
    }
  }

  // ✅ 드래그 후 selectionBox 및 helper 상태 초기화
  helper.enabled = false;
  helper.isDown = false;
  selectionBox.startPoint.set(0, 0, 0);
  selectionBox.endPoint.set(0, 0, 0);
  selectionBox.collection = [];
});

document.addEventListener("contextmenu", (event) => event.preventDefault());

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
  const deltaTime = clock.getDelta(); // 프레임 간 시간 차이
  const elapsedTime = clock.getElapsedTime();

  // Update controls
  // controls.update();
  allUnits.forEach((unit) => {
    const target = unit.userData.targetPosition;
    if (target) {
      const direction = new THREE.Vector3().subVectors(target, unit.position);
      const distance = direction.length();

      if (distance > 0.05) {
        direction.normalize(); // 방향 벡터 만들기
        const moveDistance = unitSpeed * deltaTime; // 이번 프레임에 이동할 거리

        // ✅ 이동
        if (moveDistance < distance) {
          unit.position.addScaledVector(direction, moveDistance);
          // ✅ 이동 중 충돌 회피
          for (let j = 0; j < allUnits.length; j++) {
            const other = allUnits[j];
            if (other !== unit) {
              const dist = unit.position.distanceTo(other.position);
              if (dist < 3 && dist > 0) {
                const repulsion = new THREE.Vector3()
                  .subVectors(unit.position, other.position)
                  .normalize()
                  .multiplyScalar(0.5 * deltaTime);
                unit.position.add(repulsion);
              }
            }
          }
        } else {
          unit.position.copy(target); // 목표 지점 도착
          unit.userData.targetPosition = null;
        }

        // ✅ 회전 (z축 기준)
        const angle = Math.atan2(direction.y, direction.x);
        const currentAngle = unit.rotation.z;

        // 보간 회전: 부드럽게 돌기
        const rotationSpeed = 5; // 라디안/초
        let deltaAngle = angle - currentAngle;

        // 최소 회전 방향 보정
        deltaAngle = ((deltaAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

        unit.rotation.z += deltaAngle * Math.min(rotationSpeed * deltaTime, 1);
      } else {
        unit.position.copy(target);
        unit.userData.targetPosition = null;
      }
    }
  });
  // Render
  renderer.render(scene, camera);
  stats.update();
  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
