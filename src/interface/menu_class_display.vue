<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  WebGLRenderer,
  Clock,
  Vector3,
  AmbientLight,
} from 'three';

import create_pool from '../pool.js';
import dispose from '../utils/dispose.js';

const scene_div = ref(null);
const canvas = ref(null);

const running = ref(false);

const props = defineProps(['type']);

let iop = null;
let sram = null;
let iop_female = null;
const sram_female = null;

let scene = null;
let pool = null;
let renderer = null;
const light = new DirectionalLight(0xffffff, 2);
const ambient = new AmbientLight(0xffffff, 1);

function reset_classes() {
  iop?.remove();
  sram?.remove();
  iop_female?.remove();
  // sram_female?.remove();

  iop = null;
  sram = null;
  iop_female = null;
  // sram_female = null;
}

function setup_classe(classe) {
  classe.move(new Vector3(0, 1, 0));
  classe.animate('WALK');
}

function display_classe(type) {
  if (!pool) return;
  reset_classes();
  switch (type) {
    case 'IOP_MALE':
      if (!iop) {
        iop = pool.iop_male.get();
        setup_classe(iop);
      }
      break;
    case 'SRAM_MALE':
      if (!sram) {
        sram = pool.sram_male.get();
        setup_classe(sram);
      }
      break;
    case 'IOP_FEMALE':
      if (!iop_female) {
        iop_female = pool.iop_female.get();
        setup_classe(iop_female);
      }
      break;
    default:
      break;
  }
}

watch(props, ({ type }) => display_classe(type), { immediate: true });

onMounted(() => {
  const width = canvas.value?.clientWidth;
  const height = canvas.value?.clientHeight;
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

  scene = new Scene();
  pool = create_pool({ scene });

  scene.userData.element = scene_div.value;
  scene.userData.camera = camera;
  // scene.background = new Color(0x999999);
  scene.background = null;

  renderer = new WebGLRenderer({
    canvas: canvas.value,
    // antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });

  renderer.setClearColor(0xffffff, 0);
  // renderer.setClearColor(0xffffff, 1);
  renderer.setPixelRatio(window.devicePixelRatio);

  renderer.setSize(width, height, false);

  scene.add(ambient);

  light.position.set(1, 1, 1);

  camera.position.set(1, 2, 2);
  camera.lookAt(new Vector3(0, 1.1, 0));

  scene.add(light);

  display_classe(props.type);

  const clock = new Clock();

  function animate() {
    if (!running.value) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    Object.values(pool).forEach(value => {
      if (typeof value === 'function') return;
      value.instanced_entity.entity.tick(delta);
    });
    renderer.render(scene, camera);
  }

  running.value = true;
  animate();
});

onUnmounted(() => {
  running.value = false;
  if (scene) {
    scene.remove(ambient);
    scene.remove(light);

    pool?.dispose();
    renderer?.dispose();

    dispose(scene);
  }
});
</script>

<template lang="pug">
.container
  canvas.canvas(ref="canvas")
  .scene(ref="scene_div")
</template>

<style lang="stylus" scoped>
.container
  position relative
  display flex
  width 100%
  height 100%
  canvas
    width 100%
    height 100%
    position absolute
    top 0
    left 0
    z-index 0
</style>
