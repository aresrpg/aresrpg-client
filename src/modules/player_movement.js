import { on } from 'events'
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

// last_positions are the latest state of positions the server or client wanted to enforce
// if the last wanted position becomes outdated, the entity will be moved to the latest position
function handle_entity_positions(entities, last_positions) {
  for (const entity of entities.values()) {
    if (
      entity.target_position &&
      !last_positions.get(entity)?.equals(entity.target_position)
    ) {
      entity.position.copy(entity.target_position)
      last_positions.set(entity, entity.position.clone())
    }
  }
}

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
  distance_from_ground,
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
    const animation =
      distance_from_ground > 5 ? animations.FALLING : animations.RUN
    fade_to_animation(current_animation, animation, 0.5)
    return animation
  }

  if (on_ground && inputs.dance && current_animation !== animations.DANCE) {
    fade_to_animation(current_animation, animations.DANCE, 0.3)
    return animations.DANCE
  }
}

/** @type {Type.Module} */
export default function () {
  const velocity = new Vector3()
  const controller = null
  const model_forward = new Vector3(0, 0, 1)

  const last_corrected_movement = new Vector3()
  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  let current_animation = null
  let on_ground = false

  return {
    name: 'player_movements',
    tick({ inputs }, { camera, world }, delta) {
      const player = world.entities.get(PLAYER_ID)

      if (!player) return

      const { animations, position } = player
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

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y <= -30) {
        velocity.setScalar(0)
        player.position.set(0, 20, 0)
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
          if (on_ground) velocity.y = -GRAVITY * delta
          else velocity.y -= GRAVITY * delta
      }

      movement.addScaledVector(velocity, delta)

      const { corrected_movement, is_on_ground, distance_from_ground } =
        world.correct_movement(player, movement)

      const manual_input =
        inputs.forward || inputs.backward || inputs.left || inputs.right
      const is_moving_horizontally =
        !!corrected_movement.clone().setY(0).lengthSq() && manual_input

      on_ground = is_on_ground

      if (is_moving_horizontally) {
        // Use lengthSq for efficiency, as we're only checking for non-zero length
        const flat_movement = movement.clone().setY(0).normalize()

        // Calculate the target quaternion: this rotates modelForward to align with flatMovement
        const quaternion = new Quaternion().setFromUnitVectors(
          model_forward,
          flat_movement,
        )
        player.body.quaternion.slerp(quaternion, 0.2)
      }

      const next_animation = compute_and_play_animation({
        current_animation,
        on_ground,
        is_moving_horizontally,
        inputs,
        animations,
        jump_state,
        distance_from_ground,
      })

      if (next_animation) current_animation = next_animation

      player.position.add(corrected_movement)
      animations.mixer.update(delta)
    },
    reduce(state, { type, payload }) {
      if (type === 'action/set_state_player_position') {
        return {
          ...state,
          position: payload,
        }
      }
      return state
    },
    observe({ events, world, signal, dispatch }) {
      events.on('entity_position', ({ id, position }) => {
        const entity = world.entities.get(id)
        const [x, y, z] = position
        if (entity) entity.target_position.set(x, y, z)
      })

      events.on('player_position', position => {
        const [x, y, z] = position
        const player = world.entities.get(PLAYER_ID)
        if (player) player.target_position.set(x, y, z)
      })

      aiter(abortable(setInterval(100, null, { signal }))).forEach(() => {
        // every 100ms, update the position in the state (for UI)
        const player = world.entities.get(PLAYER_ID)
        if (!player) return

        dispatch('action/set_state_player_position', player.position)
      })
    },
  }
}
