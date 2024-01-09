import { Group, LoopOnce, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { Text } from 'troika-three-text'
import { createDerivedMaterial } from 'troika-three-utils'

import { load } from './utils/load_model.js'
import iop_male from './models/iop_male.glb?url'
import iop_female from './models/iop_female.glb?url'
import sram_male from './models/sram_male.glb?url'
import sram_female from './models/sram_female.glb?url'
import InstancedEntity from './utils/InstancedEntity.js'
import dispose from './utils/dispose'

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
    scale: 0.9,
  }),
  iop_female: await load(iop_female, {
    envMapIntensity: 0.5,
    // scale: 1.2,
  }),
  sram_male: await load(sram_male, {
    envMapIntensity: 0.5,
    // scale: 1.2,
  }),
  sram_female: await load(sram_female, {
    envMapIntensity: 0.5,
    scale: 0.043,
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
 * @param {object} param0.shared
 */
export default function create_pools({ scene, shared }) {
  function instanciate(clone_model, { height, radius, name }) {
    /**
     *
     * @param {InstancedEntity} existing_instance
     */
    function create_instance(existing_instance) {
      const { model, skinned_mesh, compute_animations } = clone_model()
      const { mixer, actions } = compute_animations()

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

      shared?.outline.selectedObjects.push(body)

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
          if (shared)
            shared.outline.selectedObjects.splice(
              shared.outline.selectedObjects.indexOf(body),
              1,
            )
        },
      }
    }

    const instance = create_instance(null)

    if (instance.actions.JUMP) instance.actions.JUMP.setLoop(LoopOnce, 1)

    instance.actions.IDLE.play()

    return {
      instanced_entity: instance,
      /** @type {(id: string) => Type.Entity} */
      get(id) {
        if (!id) throw new Error('id is required')

        const success = instance.entity.add_entity(id)

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
          false,
        )

        scene.add(title)

        instance.entity.set_animation(id, 'IDLE')

        const current_position = new Vector3(0, 200, 0)
        let current_animation = 'IDLE'

        return {
          id,
          title,
          height,
          radius,
          move(position) {
            // @ts-ignore
            if (current_position.distanceTo(position) < 0.01) return
            instance.entity.set_position(id, {
              ...position,
              y: position.y - height * 0.5,
            })
            // @ts-ignore
            title.position.copy({
              ...position,
              y: position.y + height,
            })
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
            title.geometry.dispose()
            instance.entity.remove_entity(id)
          },
          set_low_priority(priority) {
            instance.entity.set_low_priority(id, priority)
          },
          animate(name) {
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
      get_non_instanced(outline) {
        const { model, compute_animations } = clone_model()
        const { mixer, actions } = compute_animations()

        const origin = new Group()
        const title = new Text()

        title.fontSize = 0.2
        title.color = 'white'
        title.anchorX = 'center'
        title.outlineWidth = 0.02
        title.material = create_billboard_material(
          new MeshBasicMaterial(),
          false,
        )

        origin.add(title)
        origin.add(model)

        title.position.y += height
        model.position.y -= height * 0.5

        scene.add(origin)

        let current_animation = actions.IDLE

        current_animation.play()

        outline.selectedObjects.push(model)

        return {
          id: 'PLAYER',
          title,
          height,
          radius,
          mixer,
          move(position) {
            origin.position.copy(position)
          },
          rotate(movement) {
            // Normalize the movement vector in the horizontal plane (x-z)
            const flat_movement = movement.clone().setY(0).normalize()
            // Calculate the target quaternion: this rotates modelForward to align with flatMovement
            const quaternion = new Quaternion().setFromUnitVectors(
              MODEL_FORWARD,
              flat_movement,
            )
            origin.quaternion.copy(quaternion)
          },
          remove() {
            scene.remove(origin)
            dispose(origin)
            outline.selectedObjects.splice(
              outline.selectedObjects.indexOf(origin),
              1,
            )
          },
          animate(name) {
            if (name === 'IDLE' && current_animation === actions.DANCE) return

            const animation = actions[name]
            if (animation && animation !== current_animation) {
              fade_to_animation(current_animation, animation)
              current_animation = animation
            }
          },
          position: origin.position,
          target_position: null,
        }
      },
    }
  }

  const instances = {
    iop_male: instanciate(Models.iop_male, {
      height: 1.7,
      radius: 0.9,
      name: 'iop_male',
    }),
    iop_female: instanciate(Models.iop_female, {
      height: 1.7,
      radius: 0.9,
      name: 'iop_female',
    }),
    sram_male: instanciate(Models.sram_male, {
      height: 1.7,
      radius: 0.9,
      name: 'sram_male',
    }),
    sram_female: instanciate(Models.sram_female, {
      height: 1.7,
      radius: 0.9,
      name: 'sram_female',
    }),
  }

  return {
    dispose() {
      instances.iop_male.instanced_entity.dispose()
      instances.iop_female.instanced_entity.dispose()
      instances.sram_male.instanced_entity.dispose()
    },
    character({ classe, female }) {
      if (classe === 'IOP')
        return female ? instances.iop_female : instances.iop_male
      if (classe === 'SRAM')
        return female ? instances.sram_female : instances.sram_male
    },
    ...instances,
  }
}
