import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d'
import {
  Mesh,
  MeshBasicMaterial,
  Color,
  BackSide,
  MeshLambertMaterial,
  BoxGeometry,
  TextureLoader,
  EquirectangularReflectionMapping,
  WebGLCubeRenderTarget,
  Texture,
  ImageLoader,
  SRGBColorSpace,
  CubeTextureLoader,
  PlaneGeometry,
  GridHelper,
  RepeatWrapping,
} from 'three'

// @ts-ignore
import nx from '../assets/nx.jpg'
// @ts-ignore
import ny from '../assets/ny.jpg'
// @ts-ignore
import nz from '../assets/nz.jpg'
// @ts-ignore
import px from '../assets/px.jpg'
// @ts-ignore
import py from '../assets/py.jpg'
// @ts-ignore
import pz from '../assets/pz.jpg'
// @ts-ignore
import bricks from '../assets/ground.png'

/**
 * @param {Object} o
 * @param {import("@dimforge/rapier3d").World} o.world
 * @param {import("three").Scene} o.scene
 * @param {number=} o.skybox_size
 * @param {number=} o.size
 * */
export default function create_grid({
  world,
  scene,
  skybox_size = 1024,
  size = 100,
}) {
  const skybox = new CubeTextureLoader().load([px, nx, py, ny, pz, nz])
  scene.background = skybox

  const ground_texture = new TextureLoader().load(bricks)
  ground_texture.wrapS = RepeatWrapping
  ground_texture.wrapT = RepeatWrapping
  ground_texture.repeat.set(10, 10)

  const ground_geometry = new PlaneGeometry(size, size)
  const ground_material = new MeshLambertMaterial({
    map: ground_texture,
  })
  const ground = new Mesh(ground_geometry, ground_material)

  const ground_body_descriptor = RigidBodyDesc.fixed()
  const ground_body = world.createRigidBody(ground_body_descriptor)
  const ground_collider = ColliderDesc.cuboid(
    size / 2,
    0.1,
    size / 2,
  ).setTranslation(0, -0.1, 0) // Set the collider position to align with the Three.js mesh

  ground.receiveShadow = true
  ground.position.y = 0.0
  ground.rotation.x = -Math.PI / 2

  scene.add(ground)
  world.createCollider(ground_collider, ground_body)
}
