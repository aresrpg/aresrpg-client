import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { Box3, DefaultLoadingManager, Vector3 } from 'three'

export const MODEL_SCALE = 0.01

const FBX_LOADER = new FBXLoader()
const GLTF_LOADER = new GLTFLoader()
const OBJ_LOADER = new OBJLoader()
const DRACO_LOADER = new DRACOLoader()

DRACO_LOADER.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',
)
DRACO_LOADER.setDecoderConfig({ type: 'js' })

GLTF_LOADER.setDRACOLoader(DRACO_LOADER)

/** @type {(string) => Promise<import('three/examples/jsm/loaders/GLTFLoader').GLTF['scene']>} */
export async function load_gltf(path) {
  const { scene } = await GLTF_LOADER.loadAsync(path)
  // scene.scale.setScalar(0.1)

  return scene
}

/** @type {(path: string) => Promise<import("three").Object3D>} */
export async function load_obj(path) {
  const object = await OBJ_LOADER.loadAsync(path)
  object.scale.setScalar(MODEL_SCALE)
  return object
}

function load_fbx(path) {
  return FBX_LOADER.loadAsync(path)
}

export async function load_fbx_animation(path) {
  const { animations } = await load_fbx(path)
  return animations[0]
}

/** @type {(path: string, scale?: number) => Promise<import("three").Object3D>} */
export async function load_fbx_model(path, scale = MODEL_SCALE) {
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
