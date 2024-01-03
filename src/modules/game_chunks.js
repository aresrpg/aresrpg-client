import { on } from 'events'
import { setInterval } from 'timers/promises'

import {
  to_chunk_position,
  spiral_array,
  square_array,
  CHUNK_SIZE,
} from '@aresrpg/aresrpg-protocol'
import { aiter } from 'iterator-helper'
import {
  Box3,
  BoxGeometry,
  Color,
  FrontSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Quaternion,
  Ray,
  Vector3,
} from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import {
  CHUNK_CACHE,
  PLANE_CHUNK_CACHE,
  from_chunk_key,
  instanced_volume,
  make_chunk_key,
  request_chunk_load,
  request_plane_chunks_load,
} from '../utils/chunks.js'
import { abortable, combine, named_on } from '../utils/iterator.js'
import { create_fractionnal_brownian } from '../world_gen/noise.js'
import { TASK_MANAGER } from '../game.js'
import Biomes from '../world_gen/biomes.js'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_world',
    tick(
      { settings: { show_terrain_collider, show_chunk_border, debug_mode } },
      _,
    ) {
      if (!debug_mode) return
      CHUNK_CACHE.forEach(({ collider, chunk_border }) => {
        if (collider.visible !== show_terrain_collider)
          collider.visible = show_terrain_collider

        if (chunk_border.visible !== show_chunk_border)
          chunk_border.visible = show_chunk_border
      })
    },
    reduce(state, { type, payload }) {
      if (type === 'packet/worldSeed') {
        return {
          ...state,
          world: {
            ...state.world,
            seed: payload,
            heightfield: create_fractionnal_brownian(payload, Biomes.DEFAULT),
          },
        }
      }
      return state
    },
    observe({ events, signal, scene, get_state, camera_controls }) {
      const first_chunks_loaded = false

      let low_detail_plane = null

      scene.add(instanced_volume)

      instanced_volume.set_env_map(scene.background)

      async function reset_chunks(rebuild) {
        instanced_volume.count = 0
        instanced_volume.volumes.clear()
        camera_controls.colliderMeshes = []

        CHUNK_CACHE.forEach(({ dispose }) => dispose())
        CHUNK_CACHE.clear()

        PLANE_CHUNK_CACHE.clear()

        if (low_detail_plane) {
          scene.remove(low_detail_plane)
          low_detail_plane.geometry.dispose()
          low_detail_plane.material.dispose()
          low_detail_plane = null
        }

        if (rebuild) await rebuild_chunks()
      }

      async function rebuild_chunks() {
        try {
          const {
            settings,
            world: { seed },
            player,
          } = get_state()
          const current_chunk = to_chunk_position(player.position)
          const new_chunks = spiral_array(
            current_chunk,
            0,
            settings.view_distance - 1,
          ).map(({ x, z }) => make_chunk_key({ x, z, seed }))

          const new_plane_chunks = spiral_array(
            current_chunk,
            settings.view_distance - 1,
            settings.far_view_distance,
          ).map(({ x, z }) => make_chunk_key({ x, z, seed }))

          const collision_chunks = square_array(current_chunk, 1).map(
            ({ x, z }) => make_chunk_key({ x, z, seed }),
          )

          const chunks_to_load = new_chunks.filter(key => !CHUNK_CACHE.has(key))

          const chunks_to_unload = Array.from(CHUNK_CACHE.keys()).filter(
            key => !new_chunks.includes(key),
          )

          const collision_chunks_to_unload = Array.from(
            CHUNK_CACHE.keys(),
          ).filter(key => !collision_chunks.includes(key))

          collision_chunks.forEach(key => {
            const { collider } = CHUNK_CACHE.get(key) ?? {}
            if (collider && !collider.parent) {
              scene.add(collider)
              if (!settings.free_camera)
                camera_controls.colliderMeshes.push(collider)
            }
          })

          collision_chunks_to_unload.forEach(key => {
            const { collider } = CHUNK_CACHE.get(key)
            scene.remove(collider)
            if (!settings.free_camera)
              camera_controls.colliderMeshes =
                camera_controls.colliderMeshes.filter(mesh => mesh !== collider)
          })

          const low_detail_plane_geometry = await request_plane_chunks_load({
            chunks: new_plane_chunks,
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
              specular: 0x999999,
              // emissive: 0x000000,
              // emissiveIntensity: 0.5,
              // @ts-ignore
              envMap: scene.background,
              reflectivity: 0.15,
              side: FrontSide,
              // roughness: 1,
              // metalness: 0,
              // flatShading: true,
              // shininess: 30,
            }),
          )

          low_detail_plane.geometry.computeVertexNormals()

          low_detail_plane_geometry.boundsTree = new MeshBVH(
            low_detail_plane_geometry,
          )

          low_detail_plane.receiveShadow = true
          low_detail_plane.castShadow = true

          scene.add(low_detail_plane)

          events.emit('CHUNKS_LOADED')
          window.dispatchEvent(new Event('assets_loaded'))

          await Promise.all(
            chunks_to_load.map(async key => {
              const { x, z } = from_chunk_key(key)
              const chunk = await request_chunk_load(
                {
                  x,
                  z,
                  seed,
                },
                scene,
              )
              const { instanced_datas, collider } = chunk

              CHUNK_CACHE.set(key, chunk)

              if (collision_chunks.includes(key)) {
                if (!collider.parent) {
                  scene.add(collider)
                  if (!settings.free_camera)
                    camera_controls.colliderMeshes.push(collider)
                }
              }

              // schedule the addition of the volume to the instanced volume
              instanced_datas.forEach(volume =>
                TASK_MANAGER.add(() => {
                  if (!instanced_volume.add_volume(volume))
                    console.error('Ran out of space for instanced volume')
                }),
              )

              events.emit('CHUNKS_LOADED')
              return key
            }),
          )

          chunks_to_unload.forEach(key => {
            const { x, z } = from_chunk_key(key)
            const chunk = CHUNK_CACHE.get(key)
            CHUNK_CACHE.delete(key)
            chunk.instanced_datas.forEach(volume => {
              TASK_MANAGER.add(() => {
                instanced_volume.remove_volume(volume)
              })
            })
            chunk.dispose()
          })
        } catch (error) {
          console.error(error)
        }
      }

      window.dispatchEvent(new Event('assets_loading'))

      events.on('CLEAR_CHUNKS', () => {
        reset_chunks(true)
      })

      aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
        async (
          { last_seed, last_view_distance, last_far_view_distance },
          [
            {
              world: { seed },
              player,
              settings: { view_distance, far_view_distance },
            },
          ],
        ) => {
          if (
            last_seed !== seed ||
            last_view_distance !== view_distance ||
            last_far_view_distance !== far_view_distance
          ) {
            await reset_chunks(true)

            if (player && first_chunks_loaded) {
              const chunk_position = to_chunk_position(player.position)
              events.emit('CHANGE_CHUNK', chunk_position)
            }
          }
          return {
            last_seed: seed,
            last_view_distance: view_distance,
            last_far_view_distance: far_view_distance,
          }
        },
      )

      // handle voxels chunks
      aiter(abortable(setInterval(1000, null, { signal }))).reduce(
        async last_chunk => {
          const { player } = get_state()

          if (!player) return
          const current_chunk = to_chunk_position(player.position)

          if (
            last_chunk &&
            (last_chunk?.x !== current_chunk.x ||
              last_chunk?.z !== current_chunk.z)
          )
            await rebuild_chunks()

          return current_chunk
        },
      )

      signal.addEventListener('abort', () => {
        reset_chunks()

        scene.remove(instanced_volume)
        instanced_volume.dispose()
      })
    },
  }
}
