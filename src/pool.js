import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  Line3,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Text } from 'troika-three-text'
import { createDerivedMaterial } from 'troika-three-utils'

import step1 from './assets/sound/step1.ogg'
import step2 from './assets/sound/step2.ogg'
import step3 from './assets/sound/step3.ogg'
import step4 from './assets/sound/step4.ogg'
import step5 from './assets/sound/step5.ogg'
import step6 from './assets/sound/step6.ogg'
import { load } from './utils/load_model.js'
import iop_male from './models/iop.glb?url'

const throttle = (action, interval) => {
  let last_time = 0
  return (...args) => {
    const now = Date.now()
    if (now - last_time >= interval) {
      last_time = now
      action(...args)
    }
  }
}

function create_billboard_material(baseMaterial, keep_aspect) {
  return createDerivedMaterial(baseMaterial, {
    // Declaring custom uniforms
    uniforms: {
      uSize: { value: keep_aspect ? 0.1 : 0.15 },
      uScale: { value: 1 },
    },
    // Adding GLSL code to the vertex shader's top-level definitions
    vertexDefs: `
uniform float uSize;
uniform float uScale;
`,
    // Adding GLSL code at the end of the vertex shader's main function
    vertexMainOutro: keep_aspect
      ? `
vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float distance = length(-mvPosition.xyz);
float computedScale = uSize * uScale * distance;
mvPosition.xyz += position * computedScale;
gl_Position = projectionMatrix * mvPosition;
`
      : `
vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
vec3 scale = vec3(
  length(modelViewMatrix[0].xyz),
  length(modelViewMatrix[1].xyz),
  length(modelViewMatrix[2].xyz)
  );
// size attenuation: scale *= -mvPosition.z * 0.2;
mvPosition.xyz += position * scale;
gl_Position = projectionMatrix * mvPosition;
`,
    // No need to modify fragment shader for billboarding effect
  })
}

const MODEL_FORWARD = new Vector3(0, 0, 1)

const step_audios = [
  new Audio(step1),
  new Audio(step2),
  new Audio(step3),
  new Audio(step4),
  new Audio(step5),
  new Audio(step6),
]

const random_element = arr => arr[Math.floor(Math.random() * arr.length)]

const play_step_sound = throttle(() => {
  const step_audio = random_element(step_audios)
  step_audio.currentTime = 0
  step_audio.play()
}, 310)

const Models = {
  iop_male: await load(iop_male, {
    scale: 0.45,
    animations_names: Array.from({
      length: 16,
      0: 'AFK',
      1: 'ATTACK_1',
      2: 'ATTACK_2',
      3: 'ATTACK_3',
      4: 'DANCE',
      5: 'DEATH',
      6: 'ROLL',
      7: 'FALL',
      8: 'HIT',
      9: 'ATTACK_HEAVY',
      10: 'ATTACK_HEAVY_HOLD',
      11: 'IDLE',
      12: 'JUMP',
      13: 'LAND',
      14: 'RUN',
    }),
    envMapIntensity: 0.5,
  }),
}

function fade_to_animation(from, to, duration = 0.3) {
  if (from !== to) {
    from?.fadeOut(duration)
    to.reset().fadeIn(duration).play()
  }
}

/**
 *
 * @param {object} param0
 * @param {import("three").Scene} param0.scene
 */
export default function create_pools({ scene, shared }) {
  function create_pool(
    { model, compute_animations },
    { count, scale = 1, height, radius },
  ) {
    const data = Array.from({ length: count }).map(() => {
      const cloned_body = clone(model)
      const body = new Object3D()

      const collider_geometry = new CapsuleGeometry(radius, height / 2, 2)
      const collider_mesh = new Mesh(
        collider_geometry,
        new MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          opacity: 0.5,
        }),
      )
      collider_mesh.castShadow = true
      collider_mesh.receiveShadow = true

      cloned_body.name = 'model'
      collider_mesh.name = 'collider'

      cloned_body.position.y -= height * 0.86
      cloned_body.rotation.y = Math.PI
      collider_mesh.position.y -= height * 0.3

      body.add(cloned_body)
      body.add(collider_mesh)

      // pooled entity is not visible by default
      // @ts-ignore
      body.collider = collider_mesh
      // @ts-ignore
      body.model = cloned_body

      body.visible = false

      scene.add(body)

      return body
    })

    return {
      data,
      /** @type {(options: { add_rigid_body: boolean }) => Type.Entity} */
      get({ add_rigid_body, fixed_title_aspect } = {}) {
        const body = data.find(object => !object.visible)

        if (!body) throw new Error('No more models available')

        body.visible = true

        const animations = compute_animations(body.model)

        if (animations.JUMP) animations.JUMP.setLoop(LoopOnce, 1)

        let current_animation = animations.IDLE

        current_animation.reset().play()

        const title = new Text()

        title.fontSize = 0.2
        title.color = 'white'
        title.anchorX = 'center'
        title.outlineWidth = 0.02
        title.material = create_billboard_material(
          new MeshBasicMaterial(),
          fixed_title_aspect,
        )

        scene.add(title)

        shared.outline.selectedObjects.push(body)

        return {
          title,
          three_body: body,
          height,
          radius,
          segment: new Line3(new Vector3(), new Vector3(0, -height / 2, 0)),
          move(position) {
            body.position.copy(position)
            title.position.copy(position).add(new Vector3(0, height / 2, 0))
          },
          remove() {
            scene.remove(title)

            shared.outline.selectedObjects.splice(
              shared.outline.selectedObjects.indexOf(body),
              1,
            )

            title.geometry.dispose()

            body.visible = false
          },
          rotate(movement) {
            // Normalize the movement vector in the horizontal plane (x-z)
            const flat_movement = movement.clone().setY(0).normalize()
            // Calculate the target quaternion: this rotates modelForward to align with flatMovement
            const quaternion = new Quaternion().setFromUnitVectors(
              MODEL_FORWARD,
              flat_movement,
            )
            body.quaternion.slerp(quaternion, 0.2)
          },
          animate(clip, delta) {
            animations.mixer.update(delta)

            if (clip === 'RUN') play_step_sound()
            if (clip === 'IDLE' && current_animation === animations.DANCE)
              return

            const animation = animations[clip]
            if (animation && animation !== current_animation) {
              fade_to_animation(current_animation, animation)
              current_animation = animation
            }
          },
          position: body.position,
          target_position: null,
        }
      },
    }
  }

  return {
    iop_male: create_pool(Models.iop_male, {
      count: 10,
      height: 1.9,
      radius: 0.7,
    }),
  }
}
