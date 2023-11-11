import { Box3, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ColliderDesc } from '@dimforge/rapier3d'

import { load_fbx } from './utils/load_model'

function create_pool(model, type, count, shape) {
  const data = Array.from({ length: count }).map(() => {
    const cloned = clone(model)
    cloned.visible = false
    return cloned
  })

  return {
    get(world, scene) {
      const model = data.find(model => !model.visible)

      if (!model) {
        console.warn('No more models available')
        return
      }

      model.position.set(0, 0, 0)
      model.visible = true

      return model
    },
  }
}

const Models = {
  guard: await load_fbx('src/models/guard.fbx'),
}

export default {
  guard: create_pool(Models.guard, 'kinematic', 10),
}
