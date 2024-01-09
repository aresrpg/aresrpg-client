import { on } from 'events'
import { setInterval } from 'timers/promises'

import { to_chunk_position, spiral_array } from '@aresrpg/aresrpg-protocol'
import { aiter } from 'iterator-helper'
import { BoxGeometry, FrontSide, Mesh, MeshPhongMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import {
  CHUNK_CACHE,
  PLANE_CHUNK_CACHE,
  instanced_volume,
  make_chunk_key,
  request_plane_chunks_load,
} from '../utils/chunks.js'
import { abortable } from '../utils/iterator.js'
import { TASK_MANAGER } from '../game.js'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_chunks',
    observe({ events, signal, scene, get_state, camera_controls }) {
      let low_detail_plane = null

      scene.add(instanced_volume)

      instanced_volume.set_env_map(scene.background)

      async function reset_chunks(rebuild) {
        instanced_volume.clear_volumes()
        camera_controls.colliderMeshes = []

        PLANE_CHUNK_CACHE.clear()

        if (low_detail_plane) {
          scene.remove(low_detail_plane)
          low_detail_plane.geometry.dispose()
          low_detail_plane.material.dispose()
          low_detail_plane = null
        }

        if (rebuild) await rebuild_chunks()
      }

      async function rebuild_chunks(force_current_chunk = null) {
        try {
          const { settings, player } = get_state()
          const current_chunk =
            force_current_chunk || to_chunk_position(player.position)

          const new_chunks = spiral_array(
            current_chunk,
            0,
            settings.view_distance - 1,
          ).map(({ x, z }) => make_chunk_key({ x, z }))

          const camera_collision_chunks = spiral_array(current_chunk, 0, 2).map(
            ({ x, z }) => make_chunk_key({ x, z }),
          )

          const new_plane_chunks = spiral_array(
            current_chunk,
            Math.max(2, settings.view_distance - 2),
            settings.far_view_distance,
          ).map(({ x, z }) => make_chunk_key({ x, z }))

          const low_detail_plane_geometry = await request_plane_chunks_load({
            chunks: new_plane_chunks,
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

          low_detail_plane.castShadow = true
          low_detail_plane.receiveShadow = true

          low_detail_plane.geometry.computeVertexNormals()

          scene.add(low_detail_plane)
          // camera_controls.colliderMeshes = [low_detail_plane]

          events.emit('CHUNKS_LOADED')
          window.dispatchEvent(new Event('assets_loaded'))

          TASK_MANAGER.clear()

          await Promise.all(
            new_chunks.map(async key => {
              const instanced_datas = CHUNK_CACHE.get(key)

              if (!instanced_datas)
                throw new Error(`Chunk ${key} not found in cache`)

              // schedule the addition of the volume to the instanced volume
              instanced_datas.forEach(
                volume => instanced_volume.add_volume(volume),
                // TASK_MANAGER.add(() => instanced_volume.add_volume(volume)),
              )

              events.emit('CHUNKS_LOADED')
              return key
            }),
          )

          instanced_volume.force_update()
          camera_controls.colliderMeshes = []

          await Promise.all(
            camera_collision_chunks.map(async key => {
              const instanced_datas = CHUNK_CACHE.get(key)
              const geometries = instanced_datas.map(({ matrix }) =>
                new BoxGeometry(1, 1, 1).applyMatrix4(matrix),
              )
              camera_controls.colliderMeshes.push(
                new Mesh(mergeGeometries(geometries)),
              )
              geometries.forEach(geometry => geometry.dispose())
            }),
          )
        } catch (error) {
          console.error(error)
        }
      }

      window.dispatchEvent(new Event('assets_loading'))

      events.on('CLEAR_CHUNKS', () => {
        reset_chunks(true)
      })

      // allow first loading of chunks
      events.once('packet/playerPosition', ({ position }) => {
        rebuild_chunks(to_chunk_position(position))
      })

      aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
        async (
          { last_view_distance, last_far_view_distance },
          [
            {
              settings: { view_distance, far_view_distance },
            },
          ],
        ) => {
          if (last_view_distance)
            if (
              last_view_distance !== view_distance ||
              last_far_view_distance !== far_view_distance
            )
              await reset_chunks(true)

          return {
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
          ) {
            await rebuild_chunks()
          }

          return current_chunk
        },
        null,
      )

      signal.addEventListener('abort', () => {
        reset_chunks()

        scene.remove(instanced_volume)
      })
    },
  }
}
