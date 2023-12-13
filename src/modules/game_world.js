import { on } from 'events'

import {
  Audio,
  AudioListener,
  AudioLoader,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import workerpool from 'workerpool'
import { to_chunk_position, spiral_array } from 'aresrpg-protocol/src/chunk.js'
import { aiter } from 'iterator-helper'

import pandala from '../assets/pandala.wav'
import { PLAYER_ID } from '../game.js'
import { compute_animation_state } from '../utils/animation.js'
import log from '../utils/logger.js'
import request_chunk_load from '../utils/chunks'
import { abortable } from '../utils/iterator'

const make_chunk_key = ({ x, z }) => `${x}:${z}`
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
  /** @typedef {{ terrain: import("three").Mesh, collider: import("three").Mesh, enable_collisions: (x: boolean) => void}} chunk */
  /** @type {Map<string, chunk>} chunk position to chunk */
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
          show_chunk_border,
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

      loaded_chunks.forEach(({ terrain, collider, chunk_border }) => {
        if (collider.visible !== show_terrain_collider)
          collider.visible = show_terrain_collider

        if (terrain.visible !== show_terrain) terrain.visible = show_terrain
        if (chunk_border.visible !== show_chunk_border)
          chunk_border.visible = show_chunk_border
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
      if (type === 'packet/worldSeed') {
        return {
          ...state,
          world: {
            ...state.world,
            seed: payload.seed,
          },
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
      function reset_chunks() {
        loaded_chunks.forEach(
          ({ terrain, enable_collisions, collider, dispose, chunk_border }) => {
            scene.remove(terrain)
            scene.remove(collider)
            scene.remove(chunk_border)

            dispose()
            enable_collisions(false)
          },
        )
        loaded_chunks.clear()
      }

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

      aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
        (last_world, { world, player }) => {
          if (last_world && last_world !== world) {
            reset_chunks()

            if (player) {
              const chunk_position = to_chunk_position(player.position())
              events.emit('CHANGE_CHUNK', chunk_position)
            }
          }
          return world
        },
      )

      aiter(abortable(on(events, 'CHANGE_CHUNK', { signal }))).forEach(
        async current_chunk => {
          try {
            const {
              settings,
              world: { seed, biome },
            } = get_state()
            const chunks_with_collisions = spiral_array(current_chunk, 1).map(
              make_chunk_key,
            )
            const new_chunks = spiral_array(
              current_chunk,
              settings.view_distance,
            ).map(make_chunk_key)

            const chunks_to_load = new_chunks.filter(
              key => !loaded_chunks.has(key),
            )

            await Promise.all(
              chunks_to_load.map(async key => {
                const { x, z } = from_chunk_key(key)
                const {
                  terrain,
                  enable_collisions,
                  collider,
                  dispose,
                  chunk_border,
                } = await request_chunk_load({
                  chunk_x: x,
                  chunk_z: z,
                  world,
                  biome,
                  seed,
                })

                loaded_chunks.set(key, {
                  terrain,
                  enable_collisions,
                  collider,
                  dispose,
                  chunk_border,
                })
              }),
            )

            if (!settings.free_camera)
              // Update camera_controls.colliderMeshes to match chunks_with_collisions
              camera_controls.colliderMeshes = chunks_with_collisions.map(
                key => loaded_chunks.get(key).collider,
              )

            // Add new terrain and remove old terrain from the scene
            loaded_chunks.forEach(
              (
                { terrain, collider, dispose, enable_collisions, chunk_border },
                key,
              ) => {
                if (chunks_with_collisions.includes(key)) {
                  enable_collisions(true)
                  scene.add(collider)
                } else {
                  enable_collisions(false)
                  scene.remove(collider)
                }

                if (new_chunks.includes(key)) {
                  // Add terrain to the scene if not already present
                  scene.add(terrain)
                  scene.add(chunk_border)
                } else {
                  // Remove and dispose of terrain and collider if no longer needed
                  scene.remove(terrain)
                  scene.remove(chunk_border)

                  dispose()

                  loaded_chunks.delete(key)
                }
              },
            )
          } catch (error) {
            console.error(error)
          }
        },
      )

      signal.addEventListener('abort', () => {
        sound.stop()
        loaded_chunks.forEach(({ terrain, collider, dispose }) => {
          scene.remove(terrain)
          scene.remove(collider)

          dispose()

          camera_controls.colliderMeshes = []
        })

        loaded_chunks.clear()
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
