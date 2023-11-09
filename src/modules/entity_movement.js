import { on } from 'events'

import { aiter } from 'iterator-helper'
import { Vector3 } from 'three'
import { Ray } from '@dimforge/rapier3d'

import { GRAVITY, PLAYER_ID } from '../game.js'

const SPEED = 0.05
const RAYCAST_DISTANCE = 2.0
const JUMP_FORCE = 5
const JUMP_BOOST = 2 // Extra forward force to apply when holding the jump button
const CONTROLLER_OFFSET = 0.01
const MAX_FALL_SPEED = -40 // The maximum speed the character can fall, negative for downward
const DESCENT_GRAVITY_MULTIPLIER = 3 // Stronger gravity multiplier for descent

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'packet:ENTITY_MOVE' || type === 'PLAYER_MOVE') {
      const { id, position } = payload
      const [x, y, z] = position
      const entity = id === PLAYER_ID ? state.player : state.entities.get(id)

      entity.position.set(x, y, z)
    }

    if (type === 'PLAYER_ON_GROUND')
      return {
        ...state,
        player: {
          ...state.player,
          on_ground: payload,
        },
      }

    return state
  },
  observe({ events, lock_controls, world, dispatch }) {
    // handle raycast to check if the character is on the ground
    aiter(on(events, 'FRAME'))
      .filter(() => lock_controls.isLocked)
      .forEach(({ state: { player }, delta }) => {
        const position = player.rigid_body.translation()
        const from = new Vector3(position)
        const to = new Vector3(
          position.x,
          // this is the only way I found to correctly cast according to the model specific size
          position.y + 5,
          position.z,
        )
        const ray = new Ray(from, to)

        // check if the character is on the ground
        const hit = world.castRay(ray, RAYCAST_DISTANCE, true)

        if (hit && !player.on_ground) dispatch('PLAYER_ON_GROUND', true)
        else if (!hit && player.on_ground) dispatch('PLAYER_ON_GROUND', false)
      })

    // handle movements of entities when their position changes
    aiter(on(events, 'FRAME'))
      .filter(({ state }) => !!state)
      .reduce((last_positions, { state, delta }) => {
        const { entities, player } = state

        if (!last_positions.get(player)?.equals(player.position))
          player.move(player.position)

        last_positions.set(player, player.position.clone())

        for (const entity of entities.values()) {
          if (!last_positions.get(entity)?.equals(entity.position))
            entity.move(entity.position)
          last_positions.set(entity, entity.position.clone())
        }

        return last_positions
      }, new WeakMap())

    const move_controller = world.createCharacterController(0.01)

    move_controller.enableAutostep(0.7, 0.3, true)
    move_controller.enableSnapToGround(0.3)
    move_controller.setCharacterMass(1)
    move_controller.setApplyImpulsesToDynamicBodies(true)
    move_controller.setSlideEnabled(true)

    aiter(on(events, 'FRAME'))
      .filter(() => lock_controls.isLocked)
      .reduce(
        (
          {
            apex_reached: last_apex_reached,
            velocity,
            corrected_movement: last_corrected_movement,
          },
          {
            state: {
              player: { rigid_body, collider, on_ground },
              inputs,
            },
            delta,
          },
        ) => {
          const position = rigid_body.translation()
          const movement = new Vector3()
          const delta_seconds = delta / 1000

          let apex_reached = last_apex_reached

          if (inputs.forward) movement.z -= SPEED
          if (inputs.backward) movement.z += SPEED
          if (inputs.left) movement.x -= SPEED
          if (inputs.right) movement.x += SPEED

          if (movement.length()) {
            movement.normalize()
            // After normalization, apply the speed
            movement.multiplyScalar(SPEED)
          }

          if (!on_ground) {
            if (!apex_reached) {
              // Apply initial stronger gravity after jump
              velocity.y -= GRAVITY * delta_seconds
              if (velocity.y <= 0) {
                console.log('apex reached')
                apex_reached = true // Flag to apply stronger gravity after apex
              }
            } else {
              // Apply much stronger gravity after the apex
              velocity.y -= GRAVITY * DESCENT_GRAVITY_MULTIPLIER * delta_seconds
            }

            // Clamp to max fall speed
            velocity.y = Math.max(velocity.y, MAX_FALL_SPEED)
          } else {
            apex_reached = false // Reset the flag when on ground
            // Reset the velocity when on ground
            velocity.y = 0
            velocity.x = 0
            velocity.z = 0
          }

          // Apply jump force as an impulse
          if (on_ground && inputs.jump) {
            velocity.y = JUMP_FORCE
            on_ground = false // Set the flag that the character is in the air
            apex_reached = false
          }

          movement.x += velocity.x * delta_seconds
          movement.y += velocity.y * delta_seconds
          movement.z += velocity.z * delta_seconds

          move_controller.computeColliderMovement(collider, movement)

          const { x, y, z } = move_controller.computedMovement()

          // vector rounded 2 digits
          const corrected_movement = new Vector3(
            Math.round(x * 100) / 100,
            Math.round(y * 100) / 100,
            Math.round(z * 100) / 100,
          )

          if (!corrected_movement.equals(last_corrected_movement)) {
            dispatch('PLAYER_MOVE', {
              id: PLAYER_ID,
              position: [
                position.x + corrected_movement.x,
                position.y + corrected_movement.y,
                position.z + corrected_movement.z,
              ],
            })
          }

          return {
            corrected_movement,
            apex_reached,
            velocity,
          }
        },
        {
          corrected_movement: new Vector3(),
          apex_reached: false,
          velocity: new Vector3(),
        },
      )
  },
}
