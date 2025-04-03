import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import GUI from "lil-gui";
import * as CANNON from "cannon";
import { Munkres } from "munkres-js";
import { SelectionBox } from "three/addons/interactive/SelectionBox.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(0, -3, 10);
camera.lookAt(0, 0, 0);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableRotate = false;

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

// Cannon.js World
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Object
let allUnits = [];
const unitBodies = [];
let selectedUnits = [];
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

  // Create Cannon body
  const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
  const body = new CANNON.Body({
    mass: 1,
    shape,
    position: new CANNON.Vec3(position.x, position.y, 0),
  });

  body.linearDamping = 0.995; // 선속도 감쇠 (0~1 사이, 0이면 감쇠 없음)
  body.angularDamping = 1.0; // 회전 감쇠 (회전 안 하면 1로 설정)
  world.addBody(body);
  unitBodies.push(body);
}

function isOverlapping(newPos, existingUnits, minDistance = 1.5) {
  return existingUnits.some(
    (unit) => unit.position.distanceTo(newPos) < minDistance
  );
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
  const marker = unit.userData.selectionMarker;
  if (marker) {
    if (marker.parent) {
      marker.parent.remove(marker);
    }
    marker.geometry.dispose();
    marker.material.dispose();
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
  if (allSelected.length > 0) {
    selectedUnits = [];
    for (let i = 0; i < allSelected.length; i++) {
      if (allSelected[i].name === "unit") {
        allSelected[i].material.emissive?.set(0xaaaaaa);
        createSelectionMarker(allSelected[i]); // 마커 추가
        selectedUnits.push(allSelected[i]);
      }
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
      const spacing = 1.5; // 유닛 간 거리
      const unitsPerRow = Math.ceil(Math.sqrt(selectedUnits.length));

      // 1. 타겟 포인트 배열 생성
      const targetPositions = [];
      for (let i = 0; i < selectedUnits.length; i++) {
        const row = Math.floor(i / unitsPerRow);
        const col = i % unitsPerRow;
        const offsetX = (col - (unitsPerRow - 1) / 2) * spacing;
        const offsetY = ((unitsPerRow - 1) / 2 - row) * spacing;
        const pos = targetPoint
          .clone()
          .add(new THREE.Vector3(offsetX, offsetY, 1));
        targetPositions.push(pos);
      }

      // 2. 거리 기반 비용 행렬 생성
      const costMatrix = selectedUnits.map((unit) =>
        targetPositions.map((target) => unit.position.distanceTo(target))
      );

      // 3. 최적 매칭 구하기
      const munkres = new Munkres(); // 헝가리안 알고리즘 인스턴스
      const matches = munkres.compute(costMatrix); // 결과: [[unitIdx, targetIdx], ...]

      // 4. 매칭에 따라 타겟 지정
      for (const [unitIdx, targetIdx] of matches) {
        const unit = selectedUnits[unitIdx];
        unit.userData.targetPosition = targetPositions[targetIdx];
      }

      showMoveMarker(targetPoint);
    }
    return;
  }
  if (event.button !== 1) return;

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
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime);

  unitBodies.forEach((body, i) => {
    const unit = allUnits[i];
    const target = unit.userData.targetPosition;

    if (target) {
      const dir = new CANNON.Vec3(
        target.x - body.position.x,
        target.y - body.position.y,
        0
      );
      const dist = dir.length();

      if (dist > 0.1) {
        dir.normalize();
        const speed = 5;
        body.velocity.set(dir.x * speed, dir.y * speed, 0);
      } else {
        body.velocity.set(0, 0, 0);
        unit.userData.targetPosition = null;
      }
      // ✅ 회전 (z축 기준)
      const angle = Math.atan2(dir.y, dir.x);
      const currentAngle = unit.rotation.z;

      // 보간 회전: 부드럽게 돌기
      const rotationSpeed = 5; // 라디안/초
      let deltaAngle = angle - currentAngle;

      // 최소 회전 방향 보정
      deltaAngle = ((deltaAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

      unit.rotation.z += deltaAngle * Math.min(rotationSpeed * deltaTime, 1);
      body.quaternion.setFromEuler(0, 0, unit.rotation.z);
    }

    // Three.js mesh에 Cannon 바디 위치 반영
    unit.position.set(body.position.x, body.position.y, unit.position.z);
  });

  // 선택 마커 동기화
  allUnits.forEach((unit) => {
    if (!selectedUnits.includes(unit) && unit.userData.selectionMarker) {
      removeSelectionMarker(unit);
    }
  });

  renderer.render(scene, camera);
  stats.update();
  controls.update();
  requestAnimationFrame(tick);
};

tick();
