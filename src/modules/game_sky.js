import { CubeTextureLoader } from 'three'

import nx from '../assets/nx.jpg'
import ny from '../assets/ny.jpg'
import nz from '../assets/nz.jpg'
import px from '../assets/px.jpg'
import py from '../assets/py.jpg'
import pz from '../assets/pz.jpg'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_sky',
    observe({ scene, events, world, signal }) {
      const skybox = new CubeTextureLoader().load([px, nx, py, ny, pz, nz])
      scene.background = skybox
    },
  }
}
