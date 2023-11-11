import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { CoefficientCombineRule, ColliderDesc } from '@dimforge/rapier3d'

import Pool from '../pool.js'
import { PLAYER_ID } from '../game.js'
import { create_capsule, create_rigid_entity } from '../utils/entities.js'

function rigid_body_vector(rigid_body) {
  const translation = rigid_body.translation()
  return new Vector3(translation.x, translation.y, translation.z)
}

function get_model_size(model, scale = 0.01) {
  const bbox = new Box3().setFromObject(model)
  const size = bbox.getSize(new Vector3())
  const center = bbox.getCenter(new Vector3())

  const height = size.y / scale / 2
  const radius = size.z + size.x / scale / 2 / 2

  console.log('height', height, 'radius', radius)

  return {
    height,
    radius,
  }
}

/** @type {Type.Module} */
export default function () {
  return {
    reduce(state, { type, payload }) {
      if (type === 'ENTITY_ADD') {
        const { id, ...entity } = payload

        if (id === PLAYER_ID)
          return {
            ...state,
            player: {
              id,
              ...state.player,
              ...entity,
            },
          }

        state.entities.set(id, entity)
      }
      return state
    },
    observe({ events, get_state, scene, world, dispatch }) {
      events.on('packet:ENTITY_ADD', ({ id, type, position }) => {
        const [x, y, z] = position
        const base_entity = {
          id,
          type,
          position: new Vector3(x, y, z),
        }

        if (type === 'character') {
          const model = Pool.guard.get(world, scene)
          if (!model) return

          const { height, radius } = get_model_size(model)
          const { rigid_body, collider, move } = create_rigid_entity({
            world,
            collider_descriptor: ColliderDesc.capsule(height / 2, radius),
          })

          const bounding_box = create_capsule({
            height,
            radius,
            color: '#FBC02D',
            wireframe: true,
          })

          // capsule.scale.divideScalar(scale)
          // capsule.position.add(new Vector3(0, height / scale, 0))

          const entity = {
            ...base_entity,
            model,
            rigid_body,
            collider,
            move,
            body_position() {
              return rigid_body_vector(rigid_body)
            },
            show_bounding_box(show) {
              bounding_box.visible = show
            },
            update_mesh_position() {
              const position = rigid_body_vector(rigid_body)
              model.position.copy(position).sub(new Vector3(0, height, 0))
              bounding_box.position.copy(position)
            },
            remove() {
              world.removeRigidBody(rigid_body)
              world.removeCollider(collider, true)
              model.visible = false
            },
          }

          entity.move(entity.position)
          entity.update_mesh_position()

          scene.add(bounding_box)
          scene.add(entity.model)
          dispatch('ENTITY_ADD', entity)
        }

        if (type === 'test') {
          const height = 1
          const radius = 0.5
          const body_type = 'dynamic'
          const bounding_box = create_capsule({
            height,
            radius,
            color: '#1565C0',
          })

          bounding_box.castShadow = true

          const { rigid_body, collider, move } = create_rigid_entity({
            world,
            type: body_type,
            collider_descriptor: ColliderDesc.capsule(height / 2, radius)
              .setFriction(0.1)
              .setFrictionCombineRule(CoefficientCombineRule.Max)
              .setRestitution(0.6)
              .setRestitutionCombineRule(CoefficientCombineRule.Max),
          })

          const entity = {
            ...base_entity,
            model: bounding_box,
            rigid_body,
            body_type,
            collider,
            move,
            show_bounding_box(show) {
              bounding_box.visible = show
            },
            update_mesh_position() {
              const position = entity.body_position()
              const rotation = rigid_body.rotation()

              bounding_box.position.copy(position)
              bounding_box.setRotationFromQuaternion(
                new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
              )
            },
            body_position() {
              return rigid_body_vector(rigid_body)
            },
          }

          entity.move(base_entity.position)
          entity.update_mesh_position()
          scene.add(entity.model)
          dispatch('ENTITY_ADD', entity)
        }
      })
    },
  }
}
