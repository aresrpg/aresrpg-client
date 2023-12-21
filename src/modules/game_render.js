import { N8AOPass } from 'n8ao'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import {
  AddEquation,
  CustomBlending,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  Vector2,
} from 'three'

/** @type {Type.Module} */
export default function (shared) {
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
      const outlinepass = new OutlinePass(
        new Vector2(window.innerWidth, window.innerHeight),
        scene,
        camera,
      )

      shared.outline = outlinepass

      outlinepass.edgeThickness = 1
      // outlinepass.overlayMaterial.blendSrc = 1
      // outlinepass.overlayMaterial.blendDst = 1
      outlinepass.visibleEdgeColor.set('#000000')
      outlinepass.edgeStrength = 5
      outlinepass.edgeGlow = 0

      outlinepass.overlayMaterial.blending = CustomBlending

      // Add this after the outline pass is created

      composer.addPass(n8aopass)
      composer.addPass(smaapass)
      composer.addPass(outlinepass)

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
