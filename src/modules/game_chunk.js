import { CubeTextureLoader } from 'three'

// @ts-ignore
import nx from '../assets/nx.jpg'
// @ts-ignore
import ny from '../assets/ny.jpg'
// @ts-ignore
import nz from '../assets/nz.jpg'
// @ts-ignore
import px from '../assets/px.jpg'
// @ts-ignore
import py from '../assets/py.jpg'
// @ts-ignore
import pz from '../assets/pz.jpg'

/** @type {Type.Module} */
export default function () {
  return {
    tick() {},
    reduce(state, { type, payload }) {
      return state
    },
    observe({ scene, events, dispatch, world }) {
      const skybox = new CubeTextureLoader().load([px, nx, py, ny, pz, nz])
      scene.background = skybox

      events.on('chunk_load', ([x, z]) => {
        world.load_chunk(x, z)
      })
    },
  }
}
