import { N8AOPass } from 'n8ao'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { CustomBlending, Vector2 } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'

import { instanced_volume } from '../utils/chunks'

/** @type {Type.Module} */
export default function (shared) {
  return {
    name: 'game_render',
    observe({ scene, signal, composer, renderer, camera }) {
      const smaapass = new SMAAPass(window.innerWidth, window.innerHeight)
      const n8aopass = new N8AOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
      )

      const gtaopass = new GTAOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
      )
      const renderpass = new RenderPass(scene, camera)
      const outputpass = new OutputPass()
      const gammaCorrection = new ShaderPass(GammaCorrectionShader)

      const bloompass = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        1.5,
        0.4,
        0.85,
      )
      bloompass.threshold = 0.9
      bloompass.strength = 0.2
      bloompass.radius = 0.2

      smaapass.renderToScreen = true

      gtaopass.output = GTAOPass.OUTPUT.Default

      // n8aopass.configuration.aoRadius = 1
      // n8aopass.configuration.distanceFalloff = 5.0
      // n8aopass.configuration.intensity = 5.0

      // n8aopass.setDisplayMode('Split AO')
      // n8aopass.configuration.aoSamples = 64
      // n8aopass.configuration.denoiseSamples = 8
      // n8aopass.configuration.denoiseRadius = 6

      shared.outline.edgeThickness = 0.1

      // outlinepass.overlayMaterial.blendSrc = 1
      // outlinepass.overlayMaterial.blendDst = 1

      shared.outline.visibleEdgeColor.set('#000000')
      shared.outline.edgeStrength = 5
      shared.outline.edgeGlow = 0

      shared.outline.overlayMaterial.blending = CustomBlending
      // shared.outline.selectedObjects.push(instanced_volume)

      // Add this after the outline pass is created

      composer.addPass(renderpass)
      composer.addPass(bloompass)
      composer.addPass(gtaopass)
      // composer.addPass(n8aopass)
      composer.addPass(gammaCorrection)
      composer.addPass(shared.outline)
      composer.addPass(smaapass)
      // composer.addPass(outputpass)

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
