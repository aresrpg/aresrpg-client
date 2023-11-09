import { Box3, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { create_rigid_entity } from './utils/entities'
import { load_fbx } from './utils/load_model'

function get_model_size(model) {
  const size = new Vector3()
  const bounding_box = new Box3().setFromObject(model)

  bounding_box.getSize(size)
  return {
    height: size.y,
    radius: Math.max(size.x, size.z) * 0.5,
  }
}

function create_pool(model, type, count, shape) {
  const { height, radius } = get_model_size(model)
  const data = Array.from({ length: count }).map(() => {
    const cloned = clone(model)
    cloned.visible = false
    return cloned
  })

  return {
    get(world) {
      /** @type {Type.Entity} */
      const model = data.find(model => !model.visible)

      if (!model) {
        console.warn('No more models available')
        return
      }

      const { rigid_body, collider, move } = create_rigid_entity({
        world,
        height,
        radius,
        type,
        shape,
      })

      model.position.set(0, 0, 0)
      model.visible = true

      return {
        model,
        height,
        radius,
        rigid_body,
        collider,
        move(position) {
          const body_position = move(position)
          model.position.copy(body_position)
          console.dir({
            model_position: model.position,
            rigid_body_position: rigid_body.translation(),
          })
        },
        remove() {
          world.removeRigidBody(rigid_body)
          world.removeCollider(collider)
          model.visible = false
        },
      }
    },
  }
}

const Models = {
  guard: await load_fbx('src/models/guard.fbx'),
}

export default {
  guard: create_pool(Models.guard, 'kinematic', 10),
}
