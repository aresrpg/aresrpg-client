import { on } from 'events'

import { aiter } from 'iterator-helper'
import {
  ActiveCollisionTypes,
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
} from '@dimforge/rapier3d'
import { StaticGeometryGenerator } from 'three-mesh-bvh'
import {
  CameraHelper,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { frameCorners } from 'three/examples/jsm/utils/CameraUtils.js'

import { abortable } from '../utils/iterator.js'
import portal_model from '../models/empty_portal.gltf?url'
import tictacworld_model from '../models/tiktakworld.gltf?url'
import { load_gltf } from '../utils/load_model'
import { create_fractionnal_brownian } from '../world_gen/noise'
import dispose from '../utils/dispose.js'

const loaded_portal = await load_gltf(portal_model)
const tictacworld = await load_gltf(tictacworld_model)

loaded_portal.scale.setScalar(1.3)
tictacworld.scale.setScalar(0.7)

function find_flat_surface({
  noise,
  start_x,
  start_z,
  width,
  depth,
  max_search_radius,
}) {
  for (let radius = 1; radius <= max_search_radius; radius++)
    for (let x = start_x - radius; x <= start_x + radius; x++)
      for (let z = start_z - radius; z <= start_z + radius; z++)
        if (is_flat_surface({ noise, x, z, width, depth })) return { x, z }
  return {}
}

function is_flat_surface({ x, z, noise, width, depth }) {
  let min_height = noise(x, z)
  let max_height = min_height
  for (let offset_x = 0; offset_x < width; offset_x++)
    for (let offset_z = 0; offset_z < depth; offset_z++) {
      const height = noise(x + offset_x, z + offset_z)
      min_height = Math.min(min_height, height)
      max_height = Math.max(max_height, height)

      if (max_height !== min_height) return false
    }

  return true
}

function create_collider(
  object,
  world,
  position,
  metalness = 0,
  roughness = 1,
) {
  const model = clone(object)

  model.position.set(position.x, position.y + 1.8, position.z)
  model.rotation.y = Math.PI * 0.4
  model.updateMatrixWorld(true)

  model.traverse(child => {
    if (child.isMesh) {
      child.material.metalness = metalness
      child.material.roughness = roughness

      child.castShadow = true
      child.receiveShadow = true
    }
  })

  model.castShadow = true
  model.receiveShadow = true

  const static_geometry = new StaticGeometryGenerator(model).generate()

  const vertices = static_geometry.attributes.position.array
  const indices = static_geometry.index.array

  const collider_desc = ColliderDesc.trimesh(vertices, indices)
  const collider = world.createCollider(collider_desc)

  const body = RigidBodyDesc.fixed()
  const rigid_body = world.createRigidBody(body, collider)

  return {
    model,
    remove() {
      world.removeCollider(collider)
      world.removeRigidBody(rigid_body)
      dispose(group)
    },
  }
}

/** @type {Type.Module} */
export default function () {
  const portal = {}

  const PORTAL_DEFINITION = 1024
  const PORTAL_SIZE = 30

  const planeGeo = new PlaneGeometry(PORTAL_SIZE, PORTAL_SIZE)
  const bottomLeftCorner = new Vector3()
  const bottomRightCorner = new Vector3()
  const topLeftCorner = new Vector3()
  const reflectedPosition = new Vector3()

  const portalCamera = new PerspectiveCamera(60, 1.0, 0.1, 500.0)

  const leftPortalTexture = new WebGLRenderTarget(
    PORTAL_DEFINITION,
    PORTAL_DEFINITION,
  )
  const leftPortal = new Mesh(
    planeGeo,
    new MeshBasicMaterial({ map: leftPortalTexture.texture }),
  )

  const rightPortalTexture = new WebGLRenderTarget(
    PORTAL_DEFINITION,
    PORTAL_DEFINITION,
  )
  const rightPortal = new Mesh(
    planeGeo,
    new MeshBasicMaterial({ map: rightPortalTexture.texture }),
  )

  function renderPortal(
    thisPortalMesh,
    otherPortalMesh,
    thisPortalTexture,
    camera,
    renderer,
    scene,
  ) {
    // set the portal camera position to be reflected about the portal plane
    thisPortalMesh.worldToLocal(reflectedPosition.copy(camera.position))
    reflectedPosition.x *= -1.0
    reflectedPosition.z *= -1.0
    otherPortalMesh.localToWorld(reflectedPosition)
    portalCamera.position.copy(reflectedPosition)

    // grab the corners of the other portal
    // - note: the portal is viewed backwards; flip the left/right coordinates
    otherPortalMesh.localToWorld(
      bottomLeftCorner.set(
        PORTAL_SIZE / 2 + 0.05,
        -(PORTAL_SIZE / 2 + 0.05),
        0.0,
      ),
    )
    otherPortalMesh.localToWorld(
      bottomRightCorner.set(
        -(PORTAL_SIZE / 2 + 0.05),
        -(PORTAL_SIZE / 2 + 0.05),
        0.0,
      ),
    )
    otherPortalMesh.localToWorld(
      topLeftCorner.set(PORTAL_SIZE / 2 + 0.05, PORTAL_SIZE / 2 + 0.05, 0.0),
    )
    // set the projection matrix to encompass the portal's frame
    frameCorners(
      portalCamera,
      bottomLeftCorner,
      bottomRightCorner,
      topLeftCorner,
      false,
    )

    // render the portal
    thisPortalTexture.texture.colorSpace = renderer.outputColorSpace
    renderer.setRenderTarget(thisPortalTexture)
    renderer.state.buffers.depth.setMask(true) // make sure the depth buffer is writable so it can be properly cleared, see #18897
    if (renderer.autoClear === false) renderer.clear()
    thisPortalMesh.visible = false // hide this portal from its own rendering
    renderer.render(scene, portalCamera)
    thisPortalMesh.visible = true // re-enable this portal's visibility for general rendering
  }

  return {
    name: 'world_portal',
    tick(_, { renderer, camera, scene, collision_queue }) {
      // save the original camera properties
      const currentRenderTarget = renderer.getRenderTarget()
      const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate
      renderer.shadowMap.autoUpdate = false // Avoid re-computing shadows

      // render the portal effect
      renderPortal(
        leftPortal,
        rightPortal,
        leftPortalTexture,
        camera,
        renderer,
        scene,
      )
      renderPortal(
        rightPortal,
        leftPortal,
        rightPortalTexture,
        camera,
        renderer,
        scene,
      )

      collision_queue.drainCollisionEvents((handle1, handle2, started) => {
        console.log('collision', handle1, handle2, started)
      })

      // restore the original rendering properties
      renderer.shadowMap.autoUpdate = currentShadowAutoUpdate
      renderer.setRenderTarget(currentRenderTarget)
    },
    observe({ events, signal, scene, world, renderer, collision_queue }) {
      aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
        (last_seed, { world: { seed, biome } }) => {
          if (last_seed !== seed) {
            if (portal.model) {
              scene.remove(portal.model)
              portal.remove()
            }

            const noise = create_fractionnal_brownian(biome, seed)

            const { x, z } = find_flat_surface({
              noise,
              start_x: -400,
              start_z: 100,
              width: 6,
              depth: 6,
              max_search_radius: 1000,
            })

            const coords = new Vector3(x, noise(x, z), z)

            const { model, remove } = create_collider(
              loaded_portal,
              world,
              coords,
              1,
              0.5,
            )

            Object.assign(portal, { model, remove })
            scene.add(model)

            leftPortal.position.x = coords.x + 0.02
            leftPortal.position.y = coords.y + 3.5
            leftPortal.position.z = coords.z

            leftPortal.scale.set(0.1, 0.16, 0.1)

            leftPortal.rotation.y = Math.PI * 0.13

            const leftPortalColliderDesc = ColliderDesc.cuboid(2, 2, 1)
              .setTranslation(
                leftPortal.position.x,
                leftPortal.position.y,
                leftPortal.position.z,
              )
              .setSensor(true)

            const left_sensor = world.createCollider(leftPortalColliderDesc)
            left_sensor.setSensor(true)

            world.intersectionsWith(left_sensor, otherCollider => {
              console.log('intersection', otherCollider)
              // This closure is called on each collider potentially
              // intersecting the collider `collider`.
            })

            scene.add(leftPortal)

            rightPortal.position.x = -560
            rightPortal.position.y = 2007
            rightPortal.position.z = 80
            rightPortal.scale.set(0.35, 0.35, 0.35)

            rightPortal.rotation.y = Math.PI * 0.4

            scene.add(rightPortal)

            const tictac = create_collider(
              tictacworld,
              world,
              new Vector3(-500, 2000, 100),
            )

            scene.add(tictac.model)
          }
          return seed
        },
      )
    },
  }
}
