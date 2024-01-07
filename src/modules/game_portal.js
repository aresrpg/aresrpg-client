// import { on } from 'events'

// import { aiter } from 'iterator-helper'
// import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'
// import {
//   Mesh,
//   MeshBasicMaterial,
//   PerspectiveCamera,
//   PlaneGeometry,
//   Vector3,
//   WebGLRenderTarget,
// } from 'three'
// import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
// import { frameCorners } from 'three/examples/jsm/utils/CameraUtils.js'

// import { abortable } from '../utils/iterator.js'
// import dispose from '../utils/dispose.js'

// // const loaded_portal = await load(portal_model, {
// //   scale: 1.3,
// //   envMapIntensity: 0.1,
// // })
// // const tictacworld = await load(tictacworld_model, { scale: 0.5 })

// function find_flat_surface({
//   heightfield,
//   start_x,
//   start_z,
//   width,
//   depth,
//   max_search_radius,
// }) {
//   for (let radius = 1; radius <= max_search_radius; radius++)
//     for (let x = start_x - radius; x <= start_x + radius; x++)
//       for (let z = start_z - radius; z <= start_z + radius; z++)
//         if (is_flat_surface({ heightfield, x, z, width, depth }))
//           return { x, z }
//   return {}
// }

// function is_flat_surface({ x, z, heightfield, width, depth }) {
//   let min_height = heightfield(x, z)
//   let max_height = min_height
//   for (let offset_x = 0; offset_x < width; offset_x++)
//     for (let offset_z = 0; offset_z < depth; offset_z++) {
//       const height = heightfield(x + offset_x, z + offset_z)
//       min_height = Math.min(min_height, height)
//       max_height = Math.max(max_height, height)

//       if (max_height !== min_height) return false
//     }

//   return true
// }

// function create_collider(
//   object,
//   position,
//   rotation = Math.PI * 0.4,
//   child_material = {},
// ) {
//   const model = clone(object)

//   model.position.set(position.x, position.y + 1.8, position.z)

//   if (rotation) model.rotation.y = rotation

//   model.updateMatrixWorld(true)

//   model.traverse(child => {
//     // @ts-ignore
//     if (child.isMesh) {
//       // @ts-ignore
//       Object.assign(child.material, child_material)
//       child.castShadow = true
//       child.receiveShadow = true
//     }
//   })

//   model.castShadow = true
//   model.receiveShadow = true

//   const static_geometry = new StaticGeometryGenerator(model).generate()
//   static_geometry.boundsTree = new MeshBVH(static_geometry)

//   const collider = new Mesh(static_geometry)

//   return {
//     model,
//     collider,
//     remove() {
//       dispose(model)
//       collider.geometry.dispose()
//       // @ts-ignore
//       collider.material.dispose()
//     },
//   }
// }

// /** @type {Type.Module} */
// export default function (shared) {
//   const PORTAL_DEFINITION = 1024
//   const PORTAL_SIZE = 30

//   const planeGeo = new PlaneGeometry(PORTAL_SIZE, PORTAL_SIZE)
//   const bottomLeftCorner = new Vector3()
//   const bottomRightCorner = new Vector3()
//   const topLeftCorner = new Vector3()
//   const reflectedPosition = new Vector3()

//   const portalCamera = new PerspectiveCamera(30, 1.0, 0.1, 500.0)

//   const leftPortalTexture = new WebGLRenderTarget(
//     PORTAL_DEFINITION,
//     PORTAL_DEFINITION,
//   )
//   const leftPortal = new Mesh(
//     planeGeo,
//     new MeshBasicMaterial({ map: leftPortalTexture.texture }),
//   )

//   const rightPortalTexture = new WebGLRenderTarget(
//     PORTAL_DEFINITION,
//     PORTAL_DEFINITION,
//   )
//   const rightPortal = new Mesh(
//     planeGeo,
//     new MeshBasicMaterial({ map: rightPortalTexture.texture }),
//   )

//   function renderPortal(
//     thisPortalMesh,
//     otherPortalMesh,
//     thisPortalTexture,
//     camera,
//     renderer,
//     scene,
//   ) {
//     // set the portal camera position to be reflected about the portal plane
//     thisPortalMesh.worldToLocal(reflectedPosition.copy(camera.position))
//     reflectedPosition.x *= -1.0
//     reflectedPosition.z *= -1.0
//     otherPortalMesh.localToWorld(reflectedPosition)
//     portalCamera.position.copy(reflectedPosition)

//     // grab the corners of the other portal
//     // - note: the portal is viewed backwards; flip the left/right coordinates
//     otherPortalMesh.localToWorld(
//       bottomLeftCorner.set(
//         PORTAL_SIZE / 2 + 0.05,
//         -(PORTAL_SIZE / 2 + 0.05),
//         0.0,
//       ),
//     )
//     otherPortalMesh.localToWorld(
//       bottomRightCorner.set(
//         -(PORTAL_SIZE / 2 + 0.05),
//         -(PORTAL_SIZE / 2 + 0.05),
//         0.0,
//       ),
//     )
//     otherPortalMesh.localToWorld(
//       topLeftCorner.set(PORTAL_SIZE / 2 + 0.05, PORTAL_SIZE / 2 + 0.05, 0.0),
//     )
//     // set the projection matrix to encompass the portal's frame
//     frameCorners(
//       portalCamera,
//       bottomLeftCorner,
//       bottomRightCorner,
//       topLeftCorner,
//       false,
//     )

//     // render the portal
//     thisPortalTexture.texture.colorSpace = renderer.outputColorSpace
//     renderer.setRenderTarget(thisPortalTexture)
//     renderer.state.buffers.depth.setMask(true) // make sure the depth buffer is writable so it can be properly cleared, see #18897
//     if (renderer.autoClear === false) renderer.clear()
//     thisPortalMesh.visible = false // hide this portal from its own rendering
//     renderer.render(scene, portalCamera)
//     thisPortalMesh.visible = true // re-enable this portal's visibility for general rendering
//   }

//   return {
//     name: 'world_portal',
//     tick(_, { renderer, camera, scene }) {
//       // save the original camera properties
//       const currentRenderTarget = renderer.getRenderTarget()
//       const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate
//       renderer.shadowMap.autoUpdate = false // Avoid re-computing shadows

//       // render the portal effect
//       renderPortal(
//         leftPortal,
//         rightPortal,
//         leftPortalTexture,
//         camera,
//         renderer,
//         scene,
//       )
//       renderPortal(
//         rightPortal,
//         leftPortal,
//         rightPortalTexture,
//         camera,
//         renderer,
//         scene,
//       )

//       // restore the original rendering properties
//       renderer.shadowMap.autoUpdate = currentShadowAutoUpdate
//       renderer.setRenderTarget(currentRenderTarget)
//     },
//     observe({ events, signal, scene, renderer, camera_controls }) {
//       aiter(abortable(on(events, 'STATE_UPDATED', { signal }))).reduce(
//         (
//           last_seed,
//           [
//             {
//               world: { seed, heightfield },
//             },
//           ],
//         ) => {
//           if (last_seed !== seed) {
//             const { x, z } = find_flat_surface({
//               heightfield,
//               start_x: -400,
//               start_z: 100,
//               width: 6,
//               depth: 6,
//               max_search_radius: 1000,
//             })

//             const portal1_position = new Vector3(-245, 1, 115)

//             const portal1 = create_collider(
//               loaded_portal.model,
//               portal1_position,
//             )

//             scene.add(portal1.model)

//             leftPortal.position.x = portal1_position.x + 0.02
//             leftPortal.position.y = portal1_position.y + 3.5
//             leftPortal.position.z = portal1_position.z

//             leftPortal.scale.set(0.1, 0.16, 0.1)

//             leftPortal.rotation.y = Math.PI * 0.13

//             leftPortal.geometry.boundsTree = new MeshBVH(leftPortal.geometry)

//             shared.static_objects.push(portal1.collider)

//             const portal2_position = new Vector3(-288, 2003, 98)

//             shared.add_sensor({
//               sensor: leftPortal,
//               on_collide: player => {
//                 const position = new Vector3(-287, 2004, 98)
//                 camera_controls.setLookAt(
//                   -292,
//                   2004,
//                   97,
//                   position.x,
//                   position.y,
//                   position.z,
//                 )
//                 player.move(position)
//               },
//             })

//             scene.add(leftPortal)

//             const portal2 = create_collider(
//               loaded_portal.model,
//               {
//                 x: portal2_position.x,
//                 y: portal2_position.y - 2,
//                 z: portal2_position.z,
//               },
//               Math.PI * 0.65,
//             )

//             rightPortal.position.x = portal2_position.x
//             rightPortal.position.y = portal2_position.y + 1.5
//             rightPortal.position.z = portal2_position.z

//             rightPortal.scale.set(0.1, 0.16, 0.1)

//             rightPortal.rotation.y = Math.PI * 0.4

//             rightPortal.geometry.boundsTree = new MeshBVH(rightPortal.geometry)

//             scene.add(portal2.model)
//             scene.add(rightPortal)

//             shared.static_objects.push(portal2.collider)

//             shared.add_sensor({
//               sensor: rightPortal,
//               on_collide: player => {
//                 const position = new Vector3(-244, 4, 117)
//                 camera_controls.setLookAt(
//                   -246,
//                   7,
//                   113,
//                   position.x,
//                   position.y,
//                   position.z,
//                 )
//                 player.move(position)
//               },
//             })

//             const tictac = create_collider(
//               tictacworld.model,
//               portal1_position.clone().setY(2000),
//               Math.PI * 0.4,
//               { metalness: 0, roughness: 1, envMapIntensity: 0.6 },
//             )

//             scene.add(tictac.model)

//             shared.static_objects.push(tictac.collider)
//           }
//           return seed
//         },
//       )
//     },
//   }
// }
