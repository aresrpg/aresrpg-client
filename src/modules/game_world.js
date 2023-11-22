import { Audio, AudioListener, AudioLoader } from 'three'

import pandala from '../assets/pandala.wav'
import { PLAYER_ID } from '../game.js'

const make_chunk_key = (x, z) => `${x}:${z}`

const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

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
    tick({
      player,
      settings: {
        show_terrain_collider,
        show_terrain,
        show_entities_collider,
        show_entities,
        debug_mode,
      },
    }) {
      for (const entity of entities.values()) {
        if (entity.target_position) {
          entity.move(entity.target_position)
          entity.target_position = null
        }
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
    observe({ events, signal, scene, dispatch, chunks, Pool }) {
      events.once('STATE_UPDATED', () => {
        sound.play()
        const player = Pool.guard.get()

        player.three_body.position.setScalar(0)

        dispatch('action/register_player', {
          id: PLAYER_ID,
          ...player,
        })

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })

      events.on('entity_position', ({ id, position }) => {
        const entity = entities.get(id)
        const [x, y, z] = position
        if (entity) entity.target_position.set(x, y, z)
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
    },
  }
}
