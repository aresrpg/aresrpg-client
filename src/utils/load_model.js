import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { Box3, Vector3 } from 'three'

const FBX_LOADER = new FBXLoader()

/** @type {(string) => Promise<import('three/examples/jsm/loaders/GLTFLoader').GLTF>} */
export async function load_gltf(path) {
  const model = await new Promise((resolve, reject) => {
    new GLTFLoader().load(path, resolve, null, reject)
  })

  model.scene.traverse(object => {
    if (object.isMesh) object.castShadow = true
  })

  model.scene.position.set(0, 0, 0)

  return model
}

function load_fbx(path) {
  return new Promise((resolve, reject) => {
    FBX_LOADER.load(path, resolve, null, reject)
  })
}

export async function load_fbx_animation(path) {
  const { animations } = await load_fbx(path)
  return animations[0]
}

/** @type {(path: string, scale?: number) => Promise<Type.Entity>} */
export async function load_fbx_model(path, scale = 0.01) {
  /** @type {Type.Entity} */
  const model = await load_fbx(path)

  model.rotation.set(0, Math.PI, 0)
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
