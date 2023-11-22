import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { Box3, DefaultLoadingManager, Vector3 } from 'three'

const FBX_LOADER = new FBXLoader()
const GLTF_LOADER = new GLTFLoader()

/** @type {(string) => Promise<import('three/examples/jsm/loaders/GLTFLoader').GLTF['scene']>} */
export async function load_gltf(path) {
  const { scene } = await GLTF_LOADER.loadAsync(path)
  scene.scale.setScalar(0.01)

  return scene
}

function load_fbx(path) {
  return FBX_LOADER.loadAsync(path)
}

export async function load_fbx_animation(path) {
  const { animations } = await load_fbx(path)
  return animations[0]
}

/** @type {(path: string, scale?: number) => Promise<import("three").Object3D>} */
export async function load_fbx_model(path, scale = 0.01) {
  /** @type {import("three").Object3D} */
  const model = await load_fbx(path)

  model.scale.multiplyScalar(scale)

  model.traverse(object => {
    // @ts-ignore
    if (object.isMesh) {
      object.castShadow = true
    }
  })

  model.position.set(0, 0, 0)
  return model
}
