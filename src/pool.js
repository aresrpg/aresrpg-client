import { AnimationMixer, Box3, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ColliderDesc } from '@dimforge/rapier3d'

import { load_fbx_animation, load_fbx_model } from './utils/load_model'

const Models = {
  guard: {
    model: await load_fbx_model('src/models/guard.fbx'),
    IDLE: await load_fbx_animation('src/animations/guard_idle.fbx'),
    RUN: await load_fbx_animation('src/animations/guard_run.fbx'),
    RUN_BACKWARD: await load_fbx_animation(
      'src/animations/guard_run_backward.fbx',
    ),
    DANCE: await load_fbx_animation('src/animations/guard_dance.fbx'),
    JUMP: await load_fbx_animation('src/animations/guard_jump.fbx'),
    FALLING: await load_fbx_animation('src/animations/guard_falling.fbx'),
    STRAFE_LEFT: await load_fbx_animation(
      'src/animations/guard_strafe_left.fbx',
    ),
    STRAFE_RIGHT: await load_fbx_animation(
      'src/animations/guard_strafe_right.fbx',
    ),
  },
}

function create_pool({ model, ...animations }, count) {
  const data = Array.from({ length: count }).map(() => {
    const cloned = clone(model)
    cloned.visible = false
    return cloned
  })

  return {
    get(world, scene) {
      const model_instance = data.find(object => !object.visible)

      if (!model_instance) {
        console.warn('No more models available')
        return
      }

      const mixer = new AnimationMixer(model_instance)

      model_instance.position.set(0, 0, 0)
      model_instance.visible = true

      return {
        model: model_instance,
        mixer,
        ...Object.fromEntries(
          Object.entries(animations).map(([key, clip]) => [
            key,
            mixer.clipAction(clip),
          ]),
        ),
      }
    },
  }
}

export default {
  guard: create_pool(Models.guard, 10),
}
