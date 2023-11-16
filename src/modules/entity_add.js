import {
  Box3,
  CapsuleGeometry,
  Group,
  Line3,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import Pool from '../pool.js'
import { INITIAL_STATE, PLAYER_ID } from '../game.js'
import World from '../world.js'

/** @type {Type.Module} */
export default function () {
  return {
    observe({ events, get_state, scene, world, dispatch }) {
      events.on('player_spawn', payload => {
        const [x, y, z] = payload
        const position = new Vector3(x, y, z)

        if (world.entities.has(PLAYER_ID)) return

        const player = World.create_entity(Pool.guard)

        world.spawn_entity({
          id: PLAYER_ID,
          entity: player,
          position,
          scene,
        })
      })
    },
  }
}
