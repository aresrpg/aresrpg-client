import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { AnimationMixer, DefaultLoadingManager } from 'three'
import { MeshoptDecoder } from 'meshoptimizer'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils'

const GLTF_LOADER = new GLTFLoader(DefaultLoadingManager)
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
  { envMapIntensity = 1, mesh_name = 'Model', scale = 1 } = {},
) {
  const { scene, animations } = await GLTF_LOADER.loadAsync(path)

  scene.scale.set(scale, scale, scale)

  scene.traverse(child => {
    // @ts-ignore
    if (child.isBone) child.visible = false

    // @ts-ignore
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true

      // @ts-ignore
      Object.assign(child.material, { envMapIntensity })
    }
  })

  return () => {
    const cloned = clone(scene)

    return {
      model: cloned,
      skinned_mesh: cloned.getObjectByName(mesh_name),
      compute_animations() {
        const mixer = new AnimationMixer(cloned)
        return {
          mixer,
          actions: Object.fromEntries(
            animations.map(animation => [
              animation.name,
              mixer.clipAction(animation),
            ]),
          ),
        }
      },
    }
  }
}
