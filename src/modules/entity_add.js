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
    name: 'entity_add',
    observe({ events, world, signal }) {
      events.on('packet/spawnPlayer', ({ position: { x, y, z } }) => {
        const position = new Vector3(x, y, z)

        if (world.entities.has(PLAYER_ID)) return

        const player = Pool.guard.get()

        world.spawn_entity({ ...player, id: PLAYER_ID }, position, signal)
      })
    },
  }
}
