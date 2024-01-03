import { on } from 'events'

import { Audio, AudioListener, AudioLoader } from 'three'

import main_theme from '../assets/sound/main_theme.mp3'

const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const audio_buffer = audio_loader.loadAsync(main_theme)

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_audio',
    observe({ events, signal }) {
      events.once('STATE_UPDATED', () => {
        audio_buffer.then(buffer => {
          sound.setBuffer(buffer)
          sound.setLoop(true)
          sound.setVolume(0.5)
          if (!signal.aborted) sound.play()
        })

        const audio_interval = setInterval(() => {
          sound.context.resume()
          if (sound.context.state === 'running') clearInterval(audio_interval)
        }, 500)

        signal.addEventListener('abort', () => {
          sound.stop()
        })
      })
    },
  }
}
