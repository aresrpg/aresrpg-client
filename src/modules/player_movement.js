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
import { to_chunk_position } from '@aresrpg/aresrpg-protocol'

import { GRAVITY } from '../game.js'
import { abortable } from '../utils/iterator'
import { compute_animation_state } from '../utils/animation.js'
import { compute_movements, compute_sensors } from '../utils/physics.js'

const SPEED = 6
const JUMP_FORCE = 10
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

/** @type {Type.Module} */
export default function (shared) {
  const velocity = new Vector3()

  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  let on_ground = false
  let is_dancing = false
  let chunks_loaded = false

  return {
    name: 'player_movements',
    tick(
      { inputs, player, world: { heightfield } },
      { camera, send_packet, events },
      delta,
    ) {
      if (!player) return

      const { position } = player

      const origin = position.clone()

      const camera_forward = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()
      const camera_right = new Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()

      if (player.target_position) {
        player.move(player.target_position)
        events.emit('CHANGE_CHUNK', to_chunk_position(player.target_position))

        player.target_position = null

        return
      }

      // we don't want to go futher if no chunks are loaded
      // this check must be after the target_position check
      if (!chunks_loaded) return

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y <= -30) {
        velocity.setScalar(0)
        const { x, z } = position
        player.move(new Vector3(position.x, heightfield(x, z) + 5, position.z))
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

          send_packet('packet/entityAction', { id: '', action: 'JUMP' })
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
          // if not jumping, apply normal gravity as long as chunks are there
          if (on_ground) velocity.y = -GRAVITY * delta
          else velocity.y -= GRAVITY * delta
      }

      movement.addScaledVector(velocity, delta)

      player.move(position.clone().add(movement))

      player.three_body.updateMatrixWorld()

      const terrain = shared.get_chunk_collider(
        to_chunk_position(position.clone().add(movement).floor()),
      )

      if (!terrain) return

      on_ground = compute_movements({
        player,
        terrain,
        character: {
          capsule_radius: player.radius,
          capsule_segment: player.segment,
        },
        delta,
        velocity,
        objects: shared.static_objects,
      })

      const is_moving_horizontally =
        inputs.forward || inputs.backward || inputs.right || inputs.left

      if (inputs.dance && !is_dancing) {
        is_dancing = true
        send_packet('packet/entityAction', { id: '', action: 'DANCE' })
      }

      if (is_moving_horizontally) {
        player.rotate(movement)
        is_dancing = false
      }

      const animation_name = compute_animation_state({
        is_on_ground: on_ground,
        is_moving_horizontally,
        action:
          jump_state === jump_states.ASCENT
            ? 'JUMP'
            : inputs.dance
              ? 'DANCE'
              : null,
      })

      if (is_moving_horizontally || !on_ground)
        player.animate(animation_name, delta)
      else player.animate(inputs.dance ? 'DANCE' : 'IDLE', delta)

      const last_chunk = to_chunk_position(origin)
      const current_chunk = to_chunk_position(player.position)

      if (last_chunk.x !== current_chunk.x || last_chunk.z !== current_chunk.z)
        events.emit('CHANGE_CHUNK', current_chunk)

      compute_sensors({
        player,
        character: {
          capsule_radius: player.radius,
          capsule_segment: player.segment,
        },
        sensors: shared.get_sensors(current_chunk),
      })
    },
    reduce(state, { type, payload }) {
      if (type === 'packet/playerPosition') {
        return {
          ...state,
          player: {
            ...state.player,
            target_position: payload.position,
          },
        }
      }
      return state
    },
    observe({ events, signal, dispatch, get_state, send_packet }) {
      aiter(abortable(setInterval(50, null, { signal }))).reduce(
        last_position => {
          const { player } = get_state()

          if (!player) return last_position

          const { position } = player
          const { x, y, z } = position

          if (
            last_position.x !== x ||
            last_position.y !== y ||
            last_position.z !== z
          ) {
            send_packet('packet/playerPosition', { position })
          }

          return { x, y, z }
        },
        { x: 0, y: 0, z: 0 },
      )

      events.on('CHUNKS_LOADED', () => {
        if (!chunks_loaded) chunks_loaded = true
      })
    },
  }
}
