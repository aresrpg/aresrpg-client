import { setInterval } from 'timers/promises'

import { Vector3 } from 'three'
import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'
import { aiter } from 'iterator-helper'

import { compute_animation_state } from '../utils/animation.js'
import { abortable } from '../utils/iterator.js'

const MOVE_UPDATE_INTERVAL = 0.1
const MAX_TITLE_VIEW_DISTANCE = CHUNK_SIZE * 1.3
const MAX_ANIMATION_DISTANCE = 64

const CANCELED_BY_MOVING = ['DANCE']
const CANCELED_BY_NOT_MOVING = ['JUMP', 'WALK', 'RUN']

/** @type {Type.Module} */
export default function (shared) {
  const { entities } = shared

  return {
    name: 'game_world',
    tick({ settings: { show_entities_collider, debug_mode } }, _, delta) {
      // handle entities movement
      for (const entity of entities.values()) {
        if (entity.jump_time == null) entity.jump_time = 0
        entity.jump_time = Math.max(0, entity.jump_time - delta)

        if (entity.action === 'JUMP' && !entity.jump_time) entity.action = null

        if (entity.target_position) {
          const old_position = entity.position.clone()
          const lerp_factor = Math.min(delta / MOVE_UPDATE_INTERVAL, 1)
          const new_position = new Vector3().lerpVectors(
            entity.position,
            entity.target_position,
            lerp_factor,
          )

          const movement = new Vector3().subVectors(
            entity.target_position,
            new_position,
          )

          entity.move(new_position)
          entity.rotate(movement)

          // if is moving
          if (old_position.distanceTo(entity.target_position) > 0.5)
            if (CANCELED_BY_MOVING.includes(entity.action)) entity.action = null

          const is_moving_horizontally = movement.setY(0).lengthSq() > 0.001

          if (new_position.distanceTo(entity.target_position) < 0.01) {
            entity.target_position = null
            if (CANCELED_BY_NOT_MOVING.includes(entity.action))
              entity.action = null
          }

          entity.animate(
            compute_animation_state({
              is_on_ground: entity.action !== 'JUMP',
              is_moving_horizontally,
              action: entity.action,
            }),
          )
        } else {
          entity.animate(
            compute_animation_state({
              is_on_ground: entity.action !== 'JUMP',
              is_moving_horizontally: false,
              action: entity.action,
            }),
          )
        }
      }

      if (!debug_mode) return

      entities.forEach(({ collider }) => {
        if (collider && collider.visible !== show_entities_collider)
          collider.visible = show_entities_collider
      })
    },
    observe({ events, Pool, send_packet, get_state, signal }) {
      events.on(
        'packet/entitySpawn',
        ({ id, position, type, name, classe, female }) => {
          if (entities.has(id)) return

          if (type === 'PLAYER') {
            const entity = Pool.character({ classe, female }).get({ id })
            entity.title.text = name

            entity.move(position)
            entities.set(id, {
              ...entity,
              jump_time: 0,
              target_position: null,
              action: null,
              audio: null,
            })
          }
        },
      )

      events.on('packet/entityDespawn', ({ id }) => {
        const entity = entities.get(id)
        if (entity) {
          entity.remove()
          entities.delete(id)
        }
      })

      // manage LOD when other entities moves
      events.on('packet/entityMove', ({ id, position }) => {
        const entity = entities.get(id)
        const { x, y, z } = position
        const state = get_state()
        if (entity) {
          entity.target_position = new Vector3(x, y, z)
          if (state.player) {
            const distance = state.player.position.distanceTo(
              new Vector3(x, y, z),
            )

            entity.set_low_priority(distance > MAX_ANIMATION_DISTANCE)

            if (distance > MAX_TITLE_VIEW_DISTANCE && entity.title.visible)
              entity.title.visible = false
            else if (
              distance <= MAX_TITLE_VIEW_DISTANCE &&
              !entity.title.visible
            )
              entity.title.visible = true
          }
        }
      })

      // manage LOD when player moves
      aiter(abortable(setInterval(1000, null, { signal }))).forEach(() => {
        entities.forEach(entity => {
          const { position } = entity
          const state = get_state()

          if (state.player) {
            const distance = state.player.position.distanceTo(position)

            entity.set_low_priority(distance > MAX_ANIMATION_DISTANCE)

            if (distance > MAX_TITLE_VIEW_DISTANCE && entity.title.visible)
              entity.title.visible = false
            else if (
              distance <= MAX_TITLE_VIEW_DISTANCE &&
              !entity.title.visible
            )
              entity.title.visible = true
          }
        })
      })

      events.on('packet/entityAction', ({ id, action }) => {
        const entity = entities.get(id)

        if (entity) {
          if (action === 'JUMP') entity.jump_time = 0.8
          entity.action = action
        }
      })

      // notify the server that we are ready to receive chunks and more
      send_packet('packet/joinGameReady', {})
    },
  }
}
