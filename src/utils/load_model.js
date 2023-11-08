import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'

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

/** @type {(string) => Promise<import('three').Object3D>} */
export async function load_fbx(path, scale = 0.01) {
  const model = await new Promise((resolve, reject) => {
    new FBXLoader().load(path, resolve, null, reject)
  })

  model.scale.set(scale, scale, scale)
  model.rotation.set(0, Math.PI, 0)

  model.traverse(object => {
    if (object.isMesh) object.castShadow = true
  })

  model.position.set(0, 0, 0)

  return model
}

export async function load_fbx_animation(path) {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(path, resolve, null, reject)
  })
}
