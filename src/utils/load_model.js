import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import {
  AnimationMixer,
  Box3,
  DefaultLoadingManager,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { StaticGeometryGenerator } from 'three-mesh-bvh'

const GLTF_LOADER = new GLTFLoader()
const DRACO_LOADER = new DRACOLoader()

DRACO_LOADER.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',
)
DRACO_LOADER.setDecoderConfig({ type: 'js' })

GLTF_LOADER.setDRACOLoader(DRACO_LOADER)

/** @type {(string, object) => Promise<import('three/examples/jsm/loaders/GLTFLoader').GLTF['scene']>} */
export async function load(
  path,
  { scale = 1, animations_names, ...material_options } = {},
) {
  const { scene, animations } = await GLTF_LOADER.loadAsync(path)
  scene.scale.multiplyScalar(scale)

  scene.traverse(object => {
    // @ts-ignore
    if (object.isMesh) {
      object.castShadow = true
      object.receiveShadow = true
      Object.assign(object.material, material_options)
    }
  })

  // scene.rotation.x = Math.PI / 2

  return {
    model: scene,
    compute_animations(cloned_model) {
      const clips = {
        mixer: new AnimationMixer(cloned_model),
      }

      animations.forEach((animation, index) => {
        const name = animations_names[index]

        if (name) clips[name] = clips.mixer.clipAction(animation)
      })

      return clips
    },
  }
}
