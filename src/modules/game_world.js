import { Audio, AudioListener, AudioLoader, Quaternion, Vector3 } from 'three'

import pandala from '../assets/pandala.wav'
import { PLAYER_ID } from '../game.js'
import { compute_animation_state } from '../utils/animation.js'

const make_chunk_key = (x, z) => `${x}:${z}`

const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const MOVE_UPDATE_INTERVAL = 0.1

const audio_buffer = await audio_loader.loadAsync(pandala)

sound.setBuffer(audio_buffer)
sound.setLoop(true)
sound.setVolume(0.5)

/** @type {Type.Module} */
export default function () {
  /** @type {Map<string, import("three").Mesh>} chunk position to chunk */
  const loaded_chunks_colliders = new Map()
  const loaded_chunks_models = new Map()
  /** @type {Map<string, Type.Entity>}  id to entity */
  const entities = new Map()
  return {
    name: 'game_world',
    tick(
      {
        player,
        settings: {
          show_terrain_collider,
          show_terrain,
          show_entities_collider,
          show_entities,
          debug_mode,
        },
      },
      _,
      delta,
    ) {
      // handle entities movement
      for (const entity of entities.values()) {
        if (entity.is_jumping == null) entity.is_jumping = 0
        entity.is_jumping = Math.max(0, entity.is_jumping - delta)

        if (entity.target_position) {
          const lerp_factor = Math.min(delta / MOVE_UPDATE_INTERVAL, 1)
          const new_position = new Vector3().lerpVectors(
            entity.position(),
            entity.target_position,
            lerp_factor,
          )

          entity.move(new_position)

          const movement = new Vector3().subVectors(
            entity.target_position,
            new_position,
          )

          entity.rotate(movement)
          entity.is_dancing = false

          const is_moving_horizontally = movement.setY(0).lengthSq() > 0.001

          if (new_position.distanceTo(entity.target_position) < 0.01)
            entity.target_position = null

          entity.animate(
            compute_animation_state({
              is_jumping: entity.is_jumping,
              is_on_ground: !entity.is_jumping,
              is_moving_horizontally,
              is_dancing: false,
            }),
            delta,
          )
        } else
          entity.animate(
            compute_animation_state({
              is_jumping: entity.is_jumping,
              is_on_ground: !entity.is_jumping,
              is_moving_horizontally: false,
              is_dancing: entity.is_dancing,
            }),
            delta,
          )
      }

      if (!debug_mode) return

      loaded_chunks_colliders.forEach(chunk_collider => {
        if (chunk_collider.visible !== show_terrain_collider)
          chunk_collider.visible = show_terrain_collider
      })

      loaded_chunks_models.forEach(chunk_model => {
        if (chunk_model.visible !== show_terrain)
          chunk_model.visible = show_terrain
      })

      entities.forEach(({ three_body }) => {
        // @ts-ignore
        const { model, collider } = three_body

        if (collider && collider.visible !== show_entities_collider)
          collider.visible = show_entities_collider

        if (model && model.visible !== show_entities)
          model.visible = show_entities
      })

      if (player?.three_body) {
        const {
          // @ts-ignore
          three_body: { model, collider },
        } = player
        if (collider && collider.visible !== show_entities_collider)
          collider.visible = show_entities_collider

        if (model && model.visible !== show_entities)
          model.visible = show_entities
      }
    },
    reduce(state, { type, payload }) {
      if (type === 'action/register_player') {
        return {
          ...state,
          player: payload,
        }
      }
      return state
    },
    observe({ events, signal, scene, dispatch, chunks, Pool, send_packet }) {
      events.once('STATE_UPDATED', () => {
        sound.play()
        const player = Pool.guard.get({ add_rigid_body: true })

        player.three_body.position.setScalar(0)

        dispatch('action/register_player', {
          ...player,
          id: PLAYER_ID,
        })

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })

      events.on('packet/entitySpawn', ({ id, position, type }) => {
        if (type === 0) {
          const entity = Pool.guard.get()
          entity.id = id
          entity.move(position)
          entities.set(id, entity)
        }
      })

      events.on('packet/entityDespawn', ({ id }) => {
        const entity = entities.get(id)
        if (entity) {
          entity.remove()
          entities.delete(id)
        }
      })

      events.on('packet/entityMove', ({ id, position }) => {
        const entity = entities.get(id)
        const { x, y, z } = position
        if (entity) entity.target_position = new Vector3(x, y, z)
      })

      events.on('packet/chunkLoad', ({ position: { x, z } }) => {
        const key = make_chunk_key(x, z)
        const { collider, terrain, enable_collisions } = chunks[key]

        scene.add(collider)
        scene.add(terrain)
        enable_collisions(true)

        loaded_chunks_colliders.set(key, collider)
        loaded_chunks_models.set(key, terrain)

        signal.addEventListener(
          'abort',
          () => {
            scene.remove(collider)
            scene.remove(terrain)

            sound.stop()

            enable_collisions(false)

            loaded_chunks_colliders.delete(key)
            loaded_chunks_models.delete(key)
          },
          { once: true },
        )
      })

      events.on('packet/entityAction', ({ id, action }) => {
        const entity = entities.get(id)
        if (entity) {
          switch (action) {
            case 0: // jump
              entity.is_jumping = 0.5
              break
            case 1: // dance
              entity.is_dancing = true
              break
            default:
              break
          }
        }
      })

      // notify the server that we are ready to receive chunks and more
      send_packet('packet/joinGameReady', {})
    },
  }
}
