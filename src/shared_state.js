import { to_chunk_position } from '@aresrpg/aresrpg-protocol'
import { iter } from 'iterator-helper'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass'
import { Vector2 } from 'three'

import { CHUNK_CACHE, make_chunk_key } from './utils/chunks.js'

/** @typedef {Type.Await<ReturnType<import("./utils/chunks")["request_chunk_load"]>>} chunk */

export default function create_shared_state({ scene, camera }) {
  const sensors = new Map()
  const static_objects = []

  return {
    outline: new OutlinePass(
      new Vector2(window.innerWidth, window.innerHeight),
      scene,
      camera,
    ),
    add_sensor: ({ sensor, on_collide }) => {
      const key = make_chunk_key(to_chunk_position(sensor.position))
      if (!sensors.has(key)) sensors.set(key, new Set())
      sensors.get(key).add({ sensor, on_collide })
    },
    get_sensors: chunk_position => {
      const key = make_chunk_key(chunk_position)
      return iter(sensors.get(key)?.values() || []).toArray()
    },
    get_chunk_collider: ({ x, z, seed }) => {
      return CHUNK_CACHE.get(make_chunk_key({ x, z, seed }))?.collider
    },
    static_objects,
  }
}
