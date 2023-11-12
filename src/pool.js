import { AnimationMixer, Box3, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ColliderDesc } from '@dimforge/rapier3d'

import { load_fbx_animation, load_fbx_model } from './utils/load_model'
import guard_fbx from './models/guard.fbx?url'
import guard_idle_fbx from './animations/guard_idle.fbx?url'
import guard_run_fbx from './animations/guard_run.fbx?url'
import guard_dance_fbx from './animations/guard_dance.fbx?url'
import guard_jump_fbx from './animations/guard_jump.fbx?url'
import guard_falling_fbx from './animations/guard_falling.fbx?url'

const Models = {
  guard: {
    model: await load_fbx_model(guard_fbx),
    IDLE: await load_fbx_animation(guard_idle_fbx),
    RUN: await load_fbx_animation(guard_run_fbx),
    DANCE: await load_fbx_animation(guard_dance_fbx),
    JUMP: await load_fbx_animation(guard_jump_fbx),
    FALLING: await load_fbx_animation(guard_falling_fbx),
  },
}

function create_pool({ model, ...animations }, count) {
  const data = Array.from({ length: count }).map(() => {
    const cloned = clone(model)
    cloned.visible = false
    return cloned
  })

  return {
    /** @type {() => ({ model: Type.Entity, mixer: AnimationMixer, [clip: string]: import("three").AnimationAction })} */
    get() {
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
