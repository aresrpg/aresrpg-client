import { CHUNK_SIZE } from 'aresrpg-protocol'
import { NavMeshQuery } from 'recast-navigation'
import { NavMeshHelper, threeToTiledNavMesh } from 'recast-navigation/three'

export function create_navmesh(
  colliders,
  {
    cell_size,
    cell_height,
    walkable_slope_angle,
    walkable_radius,
    walkable_climb,
    walkable_height,
    min_region_area,
  },
) {
  const { success, navMesh } = threeToTiledNavMesh(colliders, {
    tileSize: CHUNK_SIZE,
    cs: cell_size,
    ch: cell_height,
    walkableSlopeAngle: walkable_slope_angle,
    walkableRadius: walkable_radius,
    walkableClimb: walkable_climb,
    walkableHeight: walkable_height,
    minRegionArea: min_region_area,
  })

  const navmesh_helper = new NavMeshHelper({ navMesh })

  navmesh_helper.position.y += 0.1

  return {
    navmesh: navMesh,
    navmesh_query: new NavMeshQuery({ navMesh }),
    navmesh_helper,
  }
}
