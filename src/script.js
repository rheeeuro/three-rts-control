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
const geometry = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 20; i++) {
  const material = new THREE.MeshLambertMaterial({
    color: 0xff00ff,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = Math.random() * 20 - 10;
  mesh.position.y = Math.random() * 20 - 10;
  mesh.position.z = 1;
  mesh.name = "unit";
  scene.add(mesh);
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
 * Stats
 */
let stats;
stats = new Stats();
document.body.appendChild(stats.dom);

/**
 * Events
 */
document.addEventListener("pointerdown", function (event) {
  helper.enabled = event.buttons === 1;
  if (event.buttons !== 1) return;
  selectionBox.startPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const selectableUnits = scene.children.filter((obj) => obj.name === "unit");
  const intersects = raycaster.intersectObjects(selectableUnits);

  for (const item of selectableUnits) {
    item.material.emissive?.set(0x000000);
  }

  // 첫 번째 교차된 유닛만 선택
  if (intersects.length > 0) {
    const selected = intersects[0].object;
    selected.material.emissive?.set(0xffffff);
  }
});

document.addEventListener("pointermove", function (event) {
  if (event.buttons !== 1) return;
  if (helper.isDown) {
    for (let i = 0; i < selectionBox.collection.length; i++) {
      if (selectionBox.collection[i].name === "unit") {
        selectionBox.collection[i].material.emissive.set(0x000000);
      }
    }

    selectionBox.endPoint.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
      0.5
    );

    const allSelected = selectionBox.select();
    for (let i = 0; i < allSelected.length; i++) {
      if (allSelected[i].name === "unit") {
        allSelected[i].material.emissive?.set(0xffffff);
      }
    }
  }
});

document.addEventListener("pointerup", function (event) {
  if (event.button !== 1) return;
  selectionBox.endPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  const allSelected = selectionBox.select();

  for (let i = 0; i < allSelected.length; i++) {
    if (allSelected[i].name === "unit") {
      allSelected[i].material.emissive.set(0xffffff);
    }
  }
});

document.addEventListener("contextmenu", (event) => event.preventDefault());

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  // Update controls
  // controls.update();

  // Render
  renderer.render(scene, camera);
  stats.update();
  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
