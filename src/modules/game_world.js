import { on } from 'events'

import {
  Audio,
  AudioListener,
  AudioLoader,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Quaternion,
  Vector3,
} from 'three'
import {
  to_chunk_position,
  spiral_array,
  square_array,
  CHUNK_SIZE,
} from 'aresrpg-protocol/src/chunk.js'
import { aiter, iter } from 'iterator-helper'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import main_theme from '../assets/sound/main_theme.mp3'
import { PLAYER_ID } from '../game.js'
import { compute_animation_state } from '../utils/animation.js'
import log from '../utils/logger.js'
import {
  request_chunk_load,
  request_low_detail_chunks_load,
} from '../utils/chunks'
import { abortable } from '../utils/iterator'
import { create_navmesh } from '../utils/navmesh'
import { create_fractionnal_brownian } from '../world_gen/noise'

const make_chunk_key = ({ x, z }) => `${x}:${z}`
export const from_chunk_key = key => {
  const [x, z] = key.split(':')
  return { x: +x, z: +z }
}

const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const MOVE_UPDATE_INTERVAL = 0.1
const MAX_TITLE_VIEW_DISTANCE = CHUNK_SIZE * 1.3

const audio_buffer = audio_loader.loadAsync(main_theme)

/** @typedef {{ terrain: import("three").Mesh, collider: import("three").Mesh }} chunk */

/** @type {Type.Module} */
export default function (shared) {
  /** @type {Map<string, chunk>} chunk position to chunk */
  const loaded_chunks = new Map()
  let low_detail_plane = null
  const entities = new Map()
  const static_objects = []
  const sensors = new Map()

  Object.assign(shared, {
    get_chunk_collider: chunk_position => {
      return loaded_chunks.get(make_chunk_key(chunk_position))?.collider
    },
    static_objects,
    add_sensor: ({ sensor, on_collide }) => {
      const key = make_chunk_key(to_chunk_position(sensor.position))
      if (!sensors.has(key)) sensors.set(key, new Set())
      sensors.get(key).add({ sensor, on_collide })
    },
    get_sensors: chunk_position => {
      const key = make_chunk_key(chunk_position)
      return iter(sensors.get(key)?.values() || []).toArray()
    },
  })

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
        if (entity.jump_time == null) entity.jump_time = 0
        entity.jump_time = Math.max(0, entity.jump_time - delta)

        if (entity.target_position) {
          const old_position = entity.position.clone()
          const lerp_factor = Math.min(delta / MOVE_UPDATE_INTERVAL, 1)
          const new_position = new Vector3().lerpVectors(
            entity.position,
            entity.target_position,
            lerp_factor,
          )

          entity.move(new_position)

          const movement = new Vector3().subVectors(
            entity.target_position,
            new_position,
          )

          entity.rotate(movement)

          if (old_position.distanceTo(entity.target_position) > 0.5)
            entity.action = null

          const is_moving_horizontally = movement.setY(0).lengthSq() > 0.001

          if (new_position.distanceTo(entity.target_position) < 0.01)
            entity.target_position = null

          entity.animate(
            compute_animation_state({
              is_on_ground: entity.action !== 'JUMP',
              is_moving_horizontally,
              action: entity.action,
            }),
            delta,
          )
        } else
          entity.animate(
            compute_animation_state({
              is_on_ground: entity.action !== 'JUMP',
              is_moving_horizontally: false,
              action: entity.action,
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
            heightfield: create_fractionnal_brownian(
              state.world.biome,
              payload.seed,
            ),
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
      navigation,
    }) {
      let first_chunks_loaded = false

      function reset_chunks() {
        loaded_chunks.forEach(
          ({ terrain, collider, dispose, chunk_border }, key) => {
            scene.remove(terrain)
            scene.remove(collider)
            scene.remove(chunk_border)

            dispose()
          },
        )
        loaded_chunks.clear()

        if (low_detail_plane) {
          scene.remove(low_detail_plane)
          low_detail_plane.geometry.dispose()
          low_detail_plane.material.dispose()
          low_detail_plane = null
        }

        camera_controls.colliderMeshes = []
      }

      events.once('STATE_UPDATED', ({ selected_character_id, characters }) => {
        audio_buffer.then(buffer => {
          sound.setBuffer(buffer)
          sound.setLoop(true)
          sound.setVolume(0.5)
          sound.play()
        })

        const audio_interval = setInterval(() => {
          sound.context.resume()
          if (sound.context.state === 'running') clearInterval(audio_interval)
        }, 500)

        const player = Pool.iop_male.get({
          add_rigid_body: true,
          fixed_title_aspect: true,
        })

        player.three_body.position.setScalar(0)

        const selected_character = characters.find(
          ({ id }) => id === selected_character_id,
        )

        player.title.text = selected_character.name

        dispatch('action/register_player', {
          ...player,
          id: PLAYER_ID,
        })

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })

      events.on('packet/entitySpawn', ({ id, position, type, name }) => {
        if (entities.has(id)) return

        if (type === 'PLAYER') {
          const entity = Pool.iop_male.get()
          entity.id = id
          entity.title.text = name
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
        const state = get_state()
        if (entity) {
          entity.target_position = new Vector3(x, y, z)
          if (state.player) {
            const { position } = state.player
            const distance = position.distanceTo(new Vector3(x, y, z))
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

      events.on('CLEAR_CHUNKS', () => {
        reset_chunks()
      })

      let navmesh_visualizer = null

      function update_navmesh() {
        const { navmesh: navmesh_settings } = get_state().world
        const colliders = iter(loaded_chunks.values()).map(
          ({ collider }) => collider,
        )

        return create_navmesh(colliders, navmesh_settings)
      }

      aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
        (
          {
            last_biome,
            last_seed,
            last_view_distance,
            last_far_view_distance,
            last_show_navmesh,
            last_navmesh_settings,
          },
          {
            world: { biome, seed, navmesh: navmesh_settings },
            player,
            settings: { view_distance, far_view_distance, show_navmesh },
          },
        ) => {
          if (
            show_navmesh !== last_show_navmesh ||
            navmesh_settings !== last_navmesh_settings
          ) {
            if (navigation.navmesh) {
              navigation.navmesh.destroy()
              navigation.navmesh_query.destroy()
              scene.remove(navmesh_visualizer)
            }
            const { navmesh, navmesh_helper, navmesh_query } = update_navmesh()
            navmesh_visualizer = navmesh_helper
            navigation.navmesh = navmesh
            navigation.navmesh_query = navmesh_query
            if (show_navmesh) scene.add(navmesh_visualizer)
          }

          if (
            last_biome !== biome ||
            last_seed !== seed ||
            last_view_distance !== view_distance ||
            last_far_view_distance !== far_view_distance
          ) {
            reset_chunks()

            if (player && first_chunks_loaded) {
              const chunk_position = to_chunk_position(player.position)
              events.emit('CHANGE_CHUNK', chunk_position)
            }
          }
          return {
            last_biome: biome,
            last_seed: seed,
            last_view_distance: view_distance,
            last_far_view_distance: far_view_distance,
            last_show_navmesh: show_navmesh,
            last_navmesh_settings: navmesh_settings,
          }
        },
      )

      // handle voxels chunks
      aiter(abortable(on(events, 'CHANGE_CHUNK', { signal }))).forEach(
        async current_chunk => {
          try {
            const {
              settings,
              world: { seed, biome },
            } = get_state()

            const chunks_with_camera_collisions = square_array(
              current_chunk,
              2,
            ).map(make_chunk_key)
            const new_chunks = spiral_array(
              current_chunk,
              0,
              settings.view_distance,
            ).map(make_chunk_key)

            const chunks_to_load = new_chunks.filter(
              key => !loaded_chunks.has(key),
            )

            await Promise.all(
              chunks_to_load.map(async key => {
                const { x, z } = from_chunk_key(key)
                const { terrain, collider, dispose, chunk_border } =
                  await request_chunk_load({
                    chunk_x: x,
                    chunk_z: z,
                    world,
                    biome,
                    seed,
                    objects: static_objects,
                  })

                loaded_chunks.set(key, {
                  terrain,
                  collider,
                  dispose,
                  chunk_border,
                })
              }),
            )

            if (!settings.free_camera)
              // Update camera_controls.colliderMeshes to match chunks_with_collisions
              camera_controls.colliderMeshes = chunks_with_camera_collisions
                .filter(key => loaded_chunks.has(key))
                .map(key => loaded_chunks.get(key).collider)

            // Add new terrain and remove old terrain from the scene
            loaded_chunks.forEach(
              ({ terrain, collider, dispose, chunk_border }, key) => {
                if (key === make_chunk_key(current_chunk)) scene.add(collider)
                else scene.remove(collider)

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
          } finally {
            first_chunks_loaded = true
            events.emit('CHUNKS_LOADED')
          }
        },
      )

      // handle low details chunks
      aiter(abortable(on(events, 'CHANGE_CHUNK', { signal }))).forEach(
        async current_chunk => {
          try {
            const {
              settings,
              world: { seed, biome },
            } = get_state()

            // Determine range for low-detail chunks
            const new_chunks = spiral_array(
              current_chunk,
              settings.view_distance + 1,
              settings.far_view_distance,
            ).map(make_chunk_key)

            const geometries = []

            const low_detail_plane_geometry =
              await request_low_detail_chunks_load({
                chunks: new_chunks,
                biome,
                seed,
              })

            if (low_detail_plane) {
              scene.remove(low_detail_plane)
              low_detail_plane.geometry.dispose()
              low_detail_plane.material.dispose()
            }

            low_detail_plane = new Mesh(
              low_detail_plane_geometry,
              new MeshPhongMaterial({
                vertexColors: true,
                side: FrontSide,
              }),
            )

            scene.add(low_detail_plane)
          } catch (error) {
            console.error(error)
          }
        },
      )

      signal.addEventListener('abort', () => {
        sound.stop()
        reset_chunks()
      })

      events.on('packet/entityAction', ({ id, action }) => {
        const entity = entities.get(id)

        if (entity) {
          if (action === 'JUMP') entity.jump_time = 0.5
          entity.action = action
        }
      })

      // notify the server that we are ready to receive chunks and more
      send_packet('packet/joinGameReady', {})
    },
  }
}
