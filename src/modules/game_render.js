import { N8AOPass } from 'n8ao'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_render',
    observe({ scene, signal, composer, camera }) {
      const smaapass = new SMAAPass(window.innerWidth, window.innerHeight)
      const n8aopass = new N8AOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
      )

      // n8aopass.setDisplayMode('Split AO')
      // n8aopass.configuration.aoSamples = 64
      // n8aopass.configuration.denoiseSamples = 8
      // n8aopass.configuration.denoiseRadius = 6

      composer.addPass(n8aopass)
      composer.addPass(smaapass)

      signal.addEventListener(
        'abort',
        () => {
          composer.removePass(n8aopass)
          composer.removePass(smaapass)
        },
        { once: true },
      )
    },
  }
}
