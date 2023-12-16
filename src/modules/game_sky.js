import { CubeTextureLoader, sRGBEncoding } from 'three'

import day_nx from '../assets/skybox/day_nx.jpg'
import day_ny from '../assets/skybox/day_ny.jpg'
import day_nz from '../assets/skybox/day_nz.jpg'
import day_px from '../assets/skybox/day_px.jpg'
import day_py from '../assets/skybox/day_py.jpg'
import day_pz from '../assets/skybox/day_pz.jpg'
import night_nx from '../assets/skybox/night_nx.png'
import night_ny from '../assets/skybox/night_ny.png'
import night_nz from '../assets/skybox/night_nz.png'
import night_px from '../assets/skybox/night_px.png'
import night_py from '../assets/skybox/night_py.png'
import night_pz from '../assets/skybox/night_pz.png'

import { DAY_DURATION } from './game_nature.js'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_sky',
    observe({ scene, events, world, signal }) {
      // Load day skybox texture
      const day_skybox = new CubeTextureLoader().load([
        day_px,
        day_nx,
        day_py,
        day_ny,
        day_pz,
        day_nz,
      ])
      day_skybox.encoding = sRGBEncoding

      // Load night skybox texture
      const night_skybox = new CubeTextureLoader().load([
        night_px,
        night_nx,
        night_py,
        night_ny,
        night_pz,
        night_nz,
      ])
      night_skybox.encoding = sRGBEncoding

      // Set initial skybox
      scene.background = day_skybox

      // Event listener for time change
      events.on('TIME_CHANGE', time => {
        // Calculate blend factor based on time, 0 being day and 1 being night
        const is_day = time > DAY_DURATION / 2
        const texture = is_day ? day_skybox : night_skybox

        if (scene.background !== texture) {
          // Lerp between day and night textures based on blendFactor
          // This is a simplification; actual implementation may require shader modification
          scene.background = texture
          scene.background.needsUpdate = true
        }
      })
    },
  }
}
