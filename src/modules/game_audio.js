import {
  Audio,
  AudioListener,
  AudioLoader,
  PositionalAudio,
  Vector3,
} from 'three'
import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'

import step1 from '../assets/sound/step1.ogg'
import step2 from '../assets/sound/step2.ogg'
import step3 from '../assets/sound/step3.ogg'
import step4 from '../assets/sound/step4.ogg'
import step5 from '../assets/sound/step5.ogg'
import step6 from '../assets/sound/step6.ogg'
import main_theme from '../assets/sound/main_theme.mp3'

const listener = new AudioListener()

const main_audio = new Audio(listener)
const step_audio = new Audio(listener)

step_audio.setLoop(false)
step_audio.setVolume(0.5)
step_audio.duration = 0.3

const audio_loader = new AudioLoader()
const random_element = arr => arr[Math.floor(Math.random() * arr.length)]

// Load all step sounds
const step_sounds = [step1, step2, step3, step4, step5, step6]
const step_audio_buffers = []

// Load and store buffers for all step sounds
Promise.all(step_sounds.map(sound => audio_loader.loadAsync(sound)))
  .then(buffers => step_audio_buffers.push(...buffers))
  .catch(error => {
    console.error('Error loading step sounds:', error)
  })

export function play_step_sound() {
  if (step_audio_buffers.length && !step_audio.isPlaying) {
    step_audio.setBuffer(random_element(step_audio_buffers))
    step_audio.play()
  }
}

const audio_buffer = audio_loader.loadAsync(main_theme).then(buffer => {
  main_audio.setBuffer(buffer)
  main_audio.setLoop(true)
  main_audio.setVolume(0.5)
})

/** @type {Type.Module} */
export default function ({ entities }) {
  return {
    name: 'game_audio',
    observe({ events, signal, get_state, camera, scene }) {
      camera.add(listener)

      events.once('STATE_UPDATED', () => {
        audio_buffer.then(() => {
          if (!signal.aborted) main_audio.play()
        })
        const audio_interval = setInterval(() => {
          main_audio.context.resume()
          if (main_audio.context.state === 'running')
            clearInterval(audio_interval)
        }, 500)
      })

      events.on('packet/entityMove', ({ id, position }) => {
        const entity = entities.get(id)
        const { x, y, z } = position
        const state = get_state()
        if (entity) {
          if (state.player) {
            const distance = state.player.position.distanceTo(
              new Vector3(x, y, z),
            )

            if (distance < CHUNK_SIZE) {
              if (!entity.audio) {
                entity.audio = new PositionalAudio(listener)
                scene.add(entity.audio)
                entity.audio.setLoop(false)
                entity.audio.setRefDistance(1)
                entity.audio.setVolume(3)
                entity.audio.duration = 0.3
              }

              entity.audio.position.set(x, y, z)

              if (step_audio_buffers.length && !entity.audio.isPlaying) {
                // Choose a random step sound
                entity.audio.setBuffer(random_element(step_audio_buffers))
                entity.audio.play() // Play the sound
              }
            }
          }
        }
      })

      signal.addEventListener('abort', () => {
        camera.remove(listener)
        main_audio.stop()
      })
    },
  }
}
