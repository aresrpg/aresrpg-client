import {
  Audio,
  AudioListener,
  AudioLoader,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import workerpool from 'workerpool'
import { to_chunk_position, is_neighbor_chunk } from 'aresrpg-protocol'

import pandala from '../assets/pandala.wav'
import { PLAYER_ID } from '../game.js'
import { compute_animation_state } from '../utils/animation.js'
import log from '../utils/logger.js'
import request_chunk_load from '../utils/chunks'
import dispose from '../utils/dispose'

const make_chunk_key = (x, z) => `${x}:${z}`
const from_chunk_key = key => {
  const [x, z] = key.split(':')
  return { x: +x, z: +z }
}

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
  const loaded_chunks = new Map()
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
          outline_angle,
          outline_weight,
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

      loaded_chunks.forEach(({ terrain, collider }) => {
        if (collider.visible !== show_terrain_collider)
          collider.visible = show_terrain_collider

        if (terrain.visible !== show_terrain) terrain.visible = show_terrain
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
    observe({
      events,
      signal,
      scene,
      dispatch,
      Pool,
      send_packet,
      get_state,
      world,
      camera_controls,
    }) {
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

      events.on('CHANGE_CHUNK', ({ last_chunk, current_chunk }) => {
        loaded_chunks.forEach((chunk, key) => {
          const is_neighbor = is_neighbor_chunk(
            current_chunk,
            from_chunk_key(key),
          )
          const collider_index = camera_controls.colliderMeshes.indexOf(
            chunk.collider,
          )
          if (is_neighbor && collider_index === -1) {
            chunk.enable_collisions(true)
            camera_controls.colliderMeshes.push(chunk.collider)
          } else if (!is_neighbor && collider_index !== -1) {
            chunk.enable_collisions(false)
            camera_controls.colliderMeshes.splice(collider_index, 1)
          }
        })
      })

      events.on('packet/chunkUnload', ({ position: { x, z } }) => {
        const key = make_chunk_key(x, z)
        const chunk = loaded_chunks.get(key)
        if (chunk) {
          chunk.enable_collisions(false)

          scene.remove(chunk.collider)
          scene.remove(chunk.terrain)

          // dispose(chunk.collider)
          // dispose(chunk.terrain)

          loaded_chunks.delete(key)
        }
      })

      events.on('packet/chunkLoad', async ({ position: { x, z } }) => {
        try {
          const key = make_chunk_key(x, z)

          const { terrain, enable_collisions, collider } =
            await request_chunk_load({
              chunk_x: x,
              chunk_z: z,
              world,
            })

          const state = get_state()

          scene.add(collider)
          scene.add(terrain)

          const player_chunk = to_chunk_position(state.player.position())

          if (is_neighbor_chunk(player_chunk, { x, z })) {
            enable_collisions(true)
            camera_controls.colliderMeshes.push(collider)
          }

          loaded_chunks.set(key, { terrain, enable_collisions, collider })

          signal.addEventListener(
            'abort',
            () => {
              scene.remove(collider)
              scene.remove(terrain)

              enable_collisions(false)

              loaded_chunks.delete(key)
            },
            { once: true },
          )
        } catch (error) {
          console.error(error)
        }
      })

      signal.addEventListener('abort', () => {
        sound.stop()
      })

      events.on('packet/entityAction', ({ id, action }) => {
        const entity = entities.get(id)
        if (entity) {
          switch (action) {
            case 'JUMP':
              entity.is_jumping = 0.5
              break
            case 'DANCE':
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
