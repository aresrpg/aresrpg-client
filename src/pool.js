import { AnimationMixer, Box3, Line3, LoopOnce, Object3D, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MeshBVHVisualizer } from 'three-mesh-bvh'

import { load_fbx_animation, load_fbx_model } from './utils/load_model'
import guard_fbx from './models/guard.fbx?url'
import guard_idle_fbx from './animations/guard_idle.fbx?url'
import guard_run_fbx from './animations/guard_run.fbx?url'
import guard_dance_fbx from './animations/guard_dance.fbx?url'
import guard_jump_fbx from './animations/guard_jump.fbx?url'
import guard_falling_fbx from './animations/guard_falling.fbx?url'
import { create_capsule } from './utils/entities'

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

function get_model_size(model, scale = 0.01) {
  const bbox = new Box3().setFromObject(model)
  const size = bbox.getSize(new Vector3())

  const height = size.y / scale / 2
  const radius = size.z + size.x / scale / 2 / 2

  return {
    height,
    radius,
    segment: new Line3(new Vector3(), new Vector3(0, -height, 0.0)),
  }
}

/** @typedef {ReturnType<create_pool>} ModelPool */

function create_pool({ model, ...animations }, { count, transform }) {
  const { height, radius, segment } = get_model_size(model)
  const data = Array.from({ length: count }).map(() => {
    const cloned_body = clone(model)
    const body = new Object3D()

    const collider = create_capsule({
      height: height * 0.8,
      radius,
      color: '#dddddd',
    })

    collider.castShadow = true
    collider.receiveShadow = true
    collider.material.shadowSide = 2

    const visualizer = new MeshBVHVisualizer(collider)

    cloned_body.name = 'model'
    visualizer.name = 'visualizer'
    collider.name = 'collider'

    cloned_body.position.y -= height * 0.9
    // visualizer.position.y -= height / 2
    // collider.position.y -= height / 2

    body.attach(cloned_body)
    body.attach(visualizer)
    body.attach(collider)

    // pooled entity is not visible by default
    body.visible = false
    body.collider = collider
    body.visualizer = visualizer
    body.model = cloned_body

    return body
  })

  return {
    data,
    /** @type {() => Type.Entity} */
    get() {
      const body = data.find(object => !object.visible)

      if (!body) {
        console.warn('No more models available')
        return {
          model: null,
          mixer: null,
        }
      }

      const mixer = new AnimationMixer(body.getObjectByName('model'))

      body.visible = true

      console.log('height:', height, 'radius:', radius)

      return {
        body,
        height,
        radius,
        segment,
        remove() {
          body.visible = false
        },
        animations: {
          mixer,
          ...Object.fromEntries(
            Object.entries(animations).map(([key, clip]) => [
              key,
              mixer.clipAction(clip),
            ]),
          ),
        },
        position: body.position,
        target_position: null,
      }
    },
  }
}

const pools = {
  guard: create_pool(Models.guard, {
    count: 3,
    transform: ({ JUMP, ...model }) => {
      JUMP.setLoop(LoopOnce, 0)
      return { ...model, JUMP }
    },
  }),
}

export function add_pools_to_scene(scene) {
  Object.values(pools).forEach(({ data }) => {
    data.forEach(entity => scene.add(entity))
  })
}

export default pools
