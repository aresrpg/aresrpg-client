import { on } from 'events'

import { aiter } from 'iterator-helper'
import { Vector3 } from 'three'
import { Ray } from '@dimforge/rapier3d'
import { lerp } from 'three/src/math/MathUtils.js'

import { GRAVITY, PLAYER_ID } from '../game.js'

const SPEED = 0.1
const JUMP_FORCE = 8
const JUMP_BOOST = 2 // Extra forward force to apply when holding the jump button
const CONTROLLER_OFFSET = 0.01
const MAX_FALL_SPEED = -40 // The maximum speed the character can fall, negative for downward
const DESCENT_GRAVITY_MULTIPLIER = 3 // Stronger gravity multiplier for descent

// last_positions are the latest state of positions the server or client wanted to enforce
// if the last wanted position becomes outdated, the entity will be moved to the latest position
function handle_entity_positions({ entities, last_positions }) {
  for (const entity of entities.values()) {
    const { rigid_body, collider, model, body_type } = entity

    if (
      body_type === 'kinematic' &&
      !last_positions.get(entity)?.equals(entity.position)
    )
      entity.move(entity.position)

    entity.update_mesh_position()
    last_positions.set(entity, entity.position.clone())
  }
}

/** @type {Type.Module} */
export default function ({ world }) {
  const last_positions = new WeakMap()
  let last_corrected_movement = new Vector3()
  const ray = new Ray(new Vector3(), new Vector3(0, -1, 0))
  const controller = world.createCharacterController(0.01)

  controller.enableAutostep(0.7, 0.3, true)
  controller.enableSnapToGround(0.7)
  controller.setApplyImpulsesToDynamicBodies(true)

  const velocity = new Vector3()

  return {
    tick({ player, entities, inputs }, { world, dispatch }, delta) {
      const delta_seconds = delta / 1000
      const { rigid_body, collider } = player

      // handle movements of entities when their position changes
      handle_entity_positions({ entities, last_positions })
      // handle player movement

      const position = rigid_body.translation()

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y < -10) {
        player.move(new Vector3(0, 10, 0))
        player.update_mesh_position()
        return
      }

      const movement = new Vector3()

      // Horizontal movement based on inputs
      if (inputs.forward) movement.z -= SPEED
      if (inputs.backward) movement.z += SPEED
      if (inputs.left) movement.x -= SPEED
      if (inputs.right) movement.x += SPEED

      // normalize sideways movement
      if (movement.length()) {
        movement.normalize()
        movement.multiplyScalar(SPEED)
      }

      const on_ground = controller.computedGrounded()

      // Apply jump force
      if (on_ground && inputs.jump) {
        velocity.y = JUMP_FORCE
      }

      velocity.y += -GRAVITY * delta_seconds

      // cancel any downwards velocity if the player is already on the ground
      if (on_ground) {
        velocity.y = 0
      }

      movement.y += velocity.y * delta_seconds

      controller.computeColliderMovement(collider, movement)
      const { x, y, z } = controller.computedMovement()
      const corrected_movement = new Vector3(x, y, z)

      // Move the player if there's a change in position
      if (!corrected_movement.equals(last_corrected_movement)) {
        player.move({
          x: position.x + corrected_movement.x,
          y: position.y + corrected_movement.y,
          z: position.z + corrected_movement.z,
        })
        player.update_mesh_position()
      }

      last_corrected_movement = corrected_movement
    },
    reduce(state, { type, payload }) {
      if (type === 'packet:ENTITY_MOVE') {
        const { id, position } = payload
        const [x, y, z] = position
        const entity = id === PLAYER_ID ? state.player : state.entities.get(id)

        entity.position.set(x, y, z)
      }

      if (type === 'PLAYER_MOVED') state.player.position.copy(payload)

      return state
    },
  }
}
