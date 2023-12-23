import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { AnimationMixer, DefaultLoadingManager } from 'three'
import { MeshoptDecoder } from 'meshoptimizer'

const GLTF_LOADER = new GLTFLoader(DefaultLoadingManager).setCrossOrigin(
  'anonymous',
)
const DRACO_LOADER = new DRACOLoader(DefaultLoadingManager)
const KTX2_LOADER = new KTX2Loader(DefaultLoadingManager)

DRACO_LOADER.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',
)
DRACO_LOADER.setDecoderConfig({ type: 'js' })

GLTF_LOADER.setDRACOLoader(DRACO_LOADER)
GLTF_LOADER.setKTX2Loader(KTX2_LOADER)
GLTF_LOADER.setMeshoptDecoder(MeshoptDecoder)

export async function load(
  path,
  { scale = 1, animations_names = [], envMapIntensity = 1 } = {},
) {
  const { scene, animations } = await GLTF_LOADER.loadAsync(path)
  scene.scale.multiplyScalar(scale)

  scene.traverse(object => {
    // @ts-ignore
    if (object.isMesh) {
      object.castShadow = true
      object.receiveShadow = true
      // @ts-ignore
      Object.assign(object.material, { envMapIntensity })
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
