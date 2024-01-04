import {
  BoxGeometry,
  Group,
  Line3,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { Text } from 'troika-three-text'
import { createDerivedMaterial } from 'troika-three-utils'
import { nanoid } from 'nanoid'

import step1 from './assets/sound/step1.ogg'
import step2 from './assets/sound/step2.ogg'
import step3 from './assets/sound/step3.ogg'
import step4 from './assets/sound/step4.ogg'
import step5 from './assets/sound/step5.ogg'
import step6 from './assets/sound/step6.ogg'
import { load } from './utils/load_model.js'
import iop_male from './models/iop_male.glb?url'
import iop_female from './models/iop_female.glb?url'
import sram_male from './models/sram_male.glb?url'
import InstancedEntity from './utils/InstancedEntity.js'
import dispose from './utils/dispose'

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

// const CHARACTER_ANIMATIONS = [
//   'IDLE',
//   'RUN',
//   'JUMP',
//   'JUMP_RUN',
//   'FALL',
//   'DEATH',
//   'ATTACK_CAC',
//   'SPELL_BUFF',
//   'SPELL_TARGET',
//   'DANCE',
//   'SIT',
//   'WALK',
// ]

export const Models = {
  iop_male: await load(iop_male, {
    envMapIntensity: 0.5,
  }),
  iop_female: await load(iop_female, {
    envMapIntensity: 0.5,
    scale: 1.2,
  }),
  sram_male: await load(sram_male, {
    envMapIntensity: 0.5,
    scale: 1.2,
  }),
}

/**
 *
 * @param {object} param0
 * @param {import("three").Scene} param0.scene
 */
export default function create_pools({ scene }) {
  function instanciate(clone_model, { height, radius, name }) {
    function create_collider(id) {
      const collider_geometry = new BoxGeometry(radius, height, radius, 2)
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
      collider_mesh.name = `entity:collider:${id}`
      collider_mesh.position.y -= height / 2 - 0.1

      scene.add(collider_mesh)

      return collider_mesh
    }

    /**
     *
     * @param {InstancedEntity} existing_instance
     */
    function create_instance(existing_instance) {
      const { model, skinned_mesh, compute_animations } = clone_model()
      const { mixer, actions } = compute_animations(model)

      const entity =
        existing_instance?.expand({
          skinned_mesh,
          actions,
          mixer,
        }) ||
        new InstancedEntity({
          skinned_mesh,
          actions,
          mixer,
          capacity: 30,
        })

      const body = new Group()

      body.name = `entity:body:${name}`

      scene.add(body)

      body.add(model)
      body.add(entity)

      entity.name = `instanced:${name}`

      return {
        body,
        entity,
        actions,
        mixer,
        dispose() {
          scene.remove(body)
          entity.dispose()
          dispose(body)
          dispose(model)
        },
      }
    }

    const instance = create_instance(null)

    if (instance.actions.JUMP) instance.actions.JUMP.setLoop(LoopOnce, 1)

    instance.actions.IDLE.play()

    return {
      instanced_entity: instance,
      /** @type {(options: {  fixed_title_aspect?: boolean; id?: string; collider?: boolean  } = {}) => Type.Entity} */
      get({ id = nanoid(), fixed_title_aspect, collider = false } = {}) {
        if (!id) throw new Error('id is required')

        const collider_mesh = collider ? create_collider() : null

        const success = instance.entity.add_entity(id)

        // !FIXME: This doesn't work for whatever reason..
        if (!success) {
          instance.dispose()

          Object.assign(instance, create_instance(instance.entity))

          instance.entity.add_entity(id)
        }

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

        instance.entity.set_animation(id, 'IDLE')

        const current_position = new Vector3()
        let current_animation = 'IDLE'

        // shared.outline.selectedObjects.push(body)

        return {
          id,
          title,
          collider: collider_mesh,
          height,
          radius,
          segment: new Line3(new Vector3(), new Vector3(0, height / 2, 0)),
          move(position) {
            // @ts-ignore
            if (current_position.distanceTo(position) < 0.01) return
            instance.entity.set_position(id, {
              ...position,
              y: position.y - height / 2,
            })
            // @ts-ignore
            title.position.copy({
              ...position,
              y: position.y + height,
            })
            // @ts-ignore
            collider_mesh?.position.copy(position)
            // @ts-ignore
            current_position.copy(position)
          },
          rotate(movement) {
            // Normalize the movement vector in the horizontal plane (x-z)
            const flat_movement = movement.clone().setY(0).normalize()
            // Calculate the target quaternion: this rotates modelForward to align with flatMovement
            const quaternion = new Quaternion().setFromUnitVectors(
              MODEL_FORWARD,
              flat_movement,
            )
            instance.entity.set_quaternion(id, quaternion)
          },
          remove() {
            scene.remove(title)

            // shared.outline.selectedObjects.splice(
            //   shared.outline.selectedObjects.indexOf(body),
            //   1,
            // )

            title.geometry.dispose()

            collider_mesh?.geometry.dispose()
            collider_mesh?.material.dispose()

            instance.entity.remove_entity(id)
          },
          set_low_priority(priority) {
            instance.entity.set_low_priority(id, priority)
          },
          animate(name) {
            // if (clip === 'RUN') play_step_sound()
            if (name === 'IDLE' && current_animation === 'DANCE') return
            if (name !== current_animation) {
              instance.entity.set_animation(id, name)
              current_animation = name
            }
          },
          position: current_position,
          target_position: null,
        }
      },
    }
  }

  const instances = {
    iop_male: instanciate(Models.iop_male, {
      height: 1.8,
      radius: 0.9,
      name: 'iop_male',
    }),
    iop_female: instanciate(Models.iop_female, {
      height: 1.8,
      radius: 0.9,
      name: 'iop_female',
    }),
    sram_male: instanciate(Models.sram_male, {
      height: 1.8,
      radius: 0.9,
      name: 'sram_male',
    }),
  }

  return {
    dispose() {
      instances.iop_male.instanced_entity.dispose()
      instances.iop_female.instanced_entity.dispose()
      instances.sram_male.instanced_entity.dispose()
    },
    ...instances,
  }
}
