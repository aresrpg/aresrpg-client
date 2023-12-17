import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  Line3,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d'

import step1 from './assets/sound/step1.ogg'
import step2 from './assets/sound/step2.ogg'
import step3 from './assets/sound/step3.ogg'
import step4 from './assets/sound/step4.ogg'
import step5 from './assets/sound/step5.ogg'
import step6 from './assets/sound/step6.ogg'
import {
  MODEL_SCALE,
  load_fbx_animation,
  load_fbx_model,
} from './utils/load_model.js'
import guard_fbx from './models/guard.fbx?url'
import guard_idle_fbx from './animations/guard_idle.fbx?url'
import guard_run_fbx from './animations/guard_run.fbx?url'
import guard_dance_fbx from './animations/guard_dance.fbx?url'
import guard_jump_fbx from './animations/guard_jump.fbx?url'
import guard_falling_fbx from './animations/guard_falling.fbx?url'

const throttle = (action, interval) => {
  let last_time = 0
  return (...args) => {
    const now = Date.now()
    if (now - last_time >= interval) {
      last_time = now
      action(...args)
    }
  }
}

const MODEL_FORWARD = new Vector3(0, 0, 1)

const step_audios = [
  new Audio(step1),
  new Audio(step2),
  new Audio(step3),
  new Audio(step4),
  new Audio(step5),
  new Audio(step6),
]

const random_element = arr => arr[Math.floor(Math.random() * arr.length)]

const play_step_sound = throttle(() => {
  const step_audio = random_element(step_audios)
  step_audio.currentTime = 0
  step_audio.play()
}, 310)

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

function get_model_size(model, scale = MODEL_SCALE) {
  const bbox = new Box3().setFromObject(model)
  const size = bbox.getSize(new Vector3())

  const height = size.y / scale / 2
  const radius = size.z + size.x / scale / 2 / 2

  return {
    height,
    radius,
  }
}

function fade_to_animation(from, to, duration = 0.3) {
  if (from !== to) {
    from?.fadeOut(duration)
    to.reset().fadeIn(duration).play()
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

      const collider_geometry = new BoxGeometry(radius, height * 1.3, radius)
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
      /** @type {(options: { add_rigid_body: boolean }) => Type.Entity} */
      get({ add_rigid_body } = {}) {
        const body = data.find(object => !object.visible)

        if (!body) throw new Error('No more models available')

        const mixer = new AnimationMixer(body.getObjectByName('model'))

        body.visible = true

        const clips = {
          ...Object.fromEntries(
            Object.entries(animations).map(([key, clip]) => [
              key,
              mixer.clipAction(clip),
            ]),
          ),
        }

        let current_animation = clips.IDLE

        current_animation.reset().play()

        const base_entity = {
          three_body: body,
          height,
          radius,
          move(position) {
            body.position.copy(position)
          },
          remove() {
            body.visible = false
          },
          rotate(movement) {
            // Normalize the movement vector in the horizontal plane (x-z)
            const flat_movement = movement.clone().setY(0).normalize()
            // Calculate the target quaternion: this rotates modelForward to align with flatMovement
            const quaternion = new Quaternion().setFromUnitVectors(
              MODEL_FORWARD,
              flat_movement,
            )
            body.quaternion.slerp(quaternion, 0.2)
          },
          animate(clip, delta) {
            mixer.update(delta)

            if (clip === 'RUN') play_step_sound()
            if (clip === 'IDLE' && current_animation === clips.DANCE) return

            const animation = clips[clip]
            if (animation && animation !== current_animation) {
              fade_to_animation(current_animation, animation)
              current_animation = animation
            }
          },
          position() {
            return body.position.clone()
          },
          target_position: null,
        }

        if (!add_rigid_body) return base_entity

        const rigid_body_descriptor = RigidBodyDesc.kinematicPositionBased()
        const collider_descriptor = ColliderDesc.cuboid(
          radius,
          height * 0.9,
          radius,
        )
        const rigid_body = world.createRigidBody(rigid_body_descriptor)
        const collider = world.createCollider(collider_descriptor, rigid_body)

        return {
          ...base_entity,
          rapier_body: { rigid_body, collider },
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
          position() {
            const { x, y, z } = rigid_body.translation()
            return new Vector3(x, y, z)
          },
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
