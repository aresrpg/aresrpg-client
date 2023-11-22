import { on } from 'events'
// @ts-ignore
import { setInterval } from 'timers/promises'

import { aiter } from 'iterator-helper'
import {
  Box3,
  Line3,
  MathUtils,
  Matrix4,
  Quaternion,
  Spherical,
  Vector3,
} from 'three'
import { lerp } from 'three/src/math/MathUtils.js'

import step1 from '../assets/step1.ogg'
import step2 from '../assets/step2.ogg'
import step3 from '../assets/step3.ogg'
import step4 from '../assets/step4.ogg'
import step5 from '../assets/step5.ogg'
import step6 from '../assets/step6.ogg'
import { GRAVITY, PLAYER_ID } from '../game.js'
import { abortable } from '../utils/iterator'

const SPEED = 5
const JUMP_FORCE = 13
const CONTROLLER_OFFSET = 0.01
const ASCENT_GRAVITY_FACTOR = 3
const APEX_GRAVITY_FACTOR = 0.3
const DESCENT_GRAVITY_FACTOR = 5
const JUMP_FORWARD_IMPULSE = 3
const JUMP_COOLDWON = 0.1 // one jump every 100ms

const jump_states = {
  ASCENT: 'ASCENT',
  APEX: 'APEX',
  DESCENT: 'DESCENT',
  NONE: 'NONE',
}

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

function fade_to_animation(from, to, duration) {
  if (from !== to) {
    from.fadeOut(duration)
    to.reset().fadeIn(duration).play()
  }
}

function compute_and_play_animation({
  current_animation,
  on_ground,
  is_moving_horizontally,
  inputs,
  animations,
  jump_state,
}) {
  if (current_animation === animations.RUN) play_step_sound()

  if (on_ground) {
    if (is_moving_horizontally && current_animation !== animations.RUN) {
      fade_to_animation(current_animation, animations.RUN, 0.3)
      return animations.RUN
    } else if (
      !is_moving_horizontally &&
      current_animation !== animations.IDLE &&
      current_animation !== animations.DANCE
    ) {
      fade_to_animation(current_animation, animations.IDLE, 0.3)
      return animations.IDLE
    }
  } else if (
    jump_state === jump_states.ASCENT &&
    current_animation !== animations.JUMP
  ) {
    fade_to_animation(current_animation, animations.JUMP, 0)
    return animations.JUMP
  } else if (
    (jump_state === jump_states.APEX || jump_state === jump_states.DESCENT) &&
    current_animation !== animations.FALLING
  ) {
    fade_to_animation(current_animation, animations.FALLING, 0.3)
    return animations.FALLING
  } else if (
    current_animation !== animations.FALLING &&
    current_animation !== animations.JUMP
  ) {
    fade_to_animation(current_animation, animations.FALLING, 0.5)
    return animations.FALLING
  }

  if (on_ground && inputs.dance && current_animation !== animations.DANCE) {
    fade_to_animation(current_animation, animations.DANCE, 0.3)
    return animations.DANCE
  }
}

/** @type {Type.Module} */
export default function ({ world }) {
  const velocity = new Vector3()
  const controller = world.createCharacterController(CONTROLLER_OFFSET)
  const model_forward = new Vector3(0, 0, 1)

  controller.enableAutostep(0.7, 0.3, true)
  // Don’t allow climbing slopes larger than 45 degrees.
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
  // Automatically slide down on slopes smaller than 30 degrees.
  controller.setMinSlopeSlideAngle((30 * Math.PI) / 180)
  controller.enableSnapToGround(0.7)

  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  let current_animation = null
  let on_ground = false

  return {
    name: 'player_movements',
    tick({ inputs, player }, { camera }, delta) {
      if (!player) return

      const {
        animations,
        rapier_body: { collider, rigid_body },
      } = player
      const position = player.position()
      const camera_forward = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()
      const camera_right = new Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()

      if (!current_animation) {
        // @ts-ignore
        current_animation = animations.IDLE
        current_animation.play()
      }

      if (player.target_position) {
        player.move(player.target_position)
        player.target_position = null
        return
      }

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y <= -30) {
        velocity.setScalar(0)
        player.move(new Vector3(0, 20, 0))
        return
      }

      const movement = new Vector3()

      if (inputs.forward) movement.add(camera_forward)
      if (inputs.backward) movement.sub(camera_forward)
      if (inputs.right) movement.add(camera_right)
      if (inputs.left) movement.sub(camera_right)

      // normalize sideways movement
      if (movement.length()) movement.normalize().multiplyScalar(SPEED * delta)

      // Apply jump force
      if (on_ground) {
        if (jump_cooldown > 0) jump_cooldown -= delta
        if (inputs.jump && jump_cooldown <= 0) {
          velocity.y = JUMP_FORCE

          const forward_impulse = movement
            .clone()
            .normalize()
            .multiplyScalar(JUMP_FORWARD_IMPULSE)

          velocity.x += forward_impulse.x
          velocity.z += forward_impulse.z

          jump_state = jump_states.ASCENT
          jump_cooldown = JUMP_COOLDWON
          on_ground = false
        } else {
          jump_state = jump_states.NONE

          // reset jump impulse
          velocity.x = 0
          velocity.z = 0
          velocity.y = 0
        }
      }

      switch (jump_state) {
        case jump_states.ASCENT:
          // if started jumping, apply normal gravity
          velocity.y -= GRAVITY * ASCENT_GRAVITY_FACTOR * delta
          // prepare apex phase
          if (velocity.y <= 0.2) jump_state = jump_states.APEX
          break
        case jump_states.APEX:
          // if apex phase, apply reduced gravity
          velocity.y -= GRAVITY * APEX_GRAVITY_FACTOR * delta
          // prepare descent phase
          if (velocity.y <= 0) jump_state = jump_states.DESCENT
          break
        case jump_states.DESCENT:
          // if descent phase, apply increased gravity
          velocity.y -= GRAVITY * DESCENT_GRAVITY_FACTOR * delta
          // and also cancel forward impulse
          velocity.x = lerp(velocity.x, 0, 0.1)
          velocity.z = lerp(velocity.z, 0, 0.1)
          break
        case jump_states.NONE:
        default:
          // if not jumping, apply normal gravity
          velocity.y -= GRAVITY * delta
      }

      movement.addScaledVector(velocity, delta)

      controller.computeColliderMovement(collider, movement)
      on_ground = controller.computedGrounded()

      const { x, y, z } = controller.computedMovement()
      const corrected_movement = new Vector3(x, y, z)

      const is_moving_horizontally = !!corrected_movement
        .clone()
        .setY(0)
        .lengthSq()

      if (is_moving_horizontally) {
        // Use lengthSq for efficiency, as we're only checking for non-zero length
        const flat_movement = movement.clone().setY(0).normalize()

        // Calculate the target quaternion: this rotates modelForward to align with flatMovement
        const quaternion = new Quaternion().setFromUnitVectors(
          model_forward,
          flat_movement,
        )
        player.three_body.quaternion.slerp(quaternion, 0.2)
      }

      const next_animation = compute_and_play_animation({
        current_animation,
        on_ground,
        is_moving_horizontally,
        inputs,
        animations,
        jump_state,
      })

      if (next_animation) current_animation = next_animation
      const new_position = new Vector3(
        position.x + corrected_movement.x,
        position.y + corrected_movement.y,
        position.z + corrected_movement.z,
      )
      player.move(new_position)
      animations.mixer.update(delta)
    },
    observe({ events, world, signal, dispatch, get_state }) {
      events.on('player_position', position => {
        const state = get_state()
        if (!state.player) return

        const { player } = state
        const [x, y, z] = position
        player.target_position.set(x, y, z)
      })
    },
  }
}
