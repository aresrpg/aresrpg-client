import {
  AnimationMixer,
  Box3,
  CapsuleGeometry,
  Line3,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d'

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

function get_model_size(model, scale = 0.01) {
  const bbox = new Box3().setFromObject(model)
  const size = bbox.getSize(new Vector3())

  const height = size.y / scale / 2
  const radius = size.z + size.x / scale / 2 / 2

  return {
    height,
    radius,
  }
}

/**
 *
 * @param {object} param0
 * @param {import("three").Scene} param0.scene
 * @param {import("@dimforge/rapier3d").World} param0.world
 */
export default function create_pools({ scene, world }) {
  function create_pool({ model, ...animations }, { count, transform }) {
    const { height, radius } = get_model_size(model)
    const data = Array.from({ length: count }).map(() => {
      const cloned_body = clone(model)
      const body = new Object3D()

      const collider_geometry = new CapsuleGeometry(radius, height * 0.8, 1, 20)
      const collider_mesh = new Mesh(
        collider_geometry,
        new MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          opacity: 0.5,
        }),
      )
      collider_mesh.castShadow = true
      collider_mesh.receiveShadow = true

      cloned_body.name = 'model'
      collider_mesh.name = 'collider'

      cloned_body.position.y -= height * 0.9
      // collider.position.y -= height / 2

      body.add(cloned_body)
      body.add(collider_mesh)

      // pooled entity is not visible by default
      // @ts-ignore
      body.collider = collider_mesh
      // @ts-ignore
      body.model = cloned_body

      body.visible = false

      scene.add(body)

      return body
    })

    return {
      data,
      /** @type {() => Type.Entity} */
      get() {
        const body = data.find(object => !object.visible)

        if (!body) throw new Error('No more models available')

        const mixer = new AnimationMixer(body.getObjectByName('model'))

        body.visible = true

        const rigid_body_descriptor = RigidBodyDesc.kinematicPositionBased()
        const collider_descriptor = ColliderDesc.capsule(height * 0.3, radius)
        const rigid_body = world.createRigidBody(rigid_body_descriptor)
        const collider = world.createCollider(collider_descriptor, rigid_body)

        return {
          three_body: body,
          rapier_body: { rigid_body, collider },
          height,
          radius,
          collider,
          move(position) {
            rigid_body.setNextKinematicTranslation(position)
            body.position.copy(position)
          },
          remove() {
            body.visible = false
            world.removeCollider(collider, false)
            world.removeRigidBody(rigid_body)
          },
          // @ts-ignore
          animations: {
            mixer,
            ...Object.fromEntries(
              Object.entries(animations).map(([key, clip]) => [
                key,
                mixer.clipAction(clip),
              ]),
            ),
          },
          position() {
            return rigid_body.translation()
          },
          target_position: null,
        }
      },
    }
  }

  return {
    guard: create_pool(Models.guard, {
      count: 10,
      transform: ({ JUMP, ...model }) => {
        JUMP.setLoop(LoopOnce, 0)
        return { ...model, JUMP }
      },
    }),
  }
}
