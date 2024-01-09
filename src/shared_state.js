import { to_chunk_position } from '@aresrpg/aresrpg-protocol'
import { iter } from 'iterator-helper'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass'
import { Vector2 } from 'three'

import { make_chunk_key } from './utils/chunks.js'

export default function create_shared_state({ scene, camera }) {
  const sensors = new Map()
  const static_objects = []
  /** @type {Map<string, Type.Entity & { jump_time: number, target_position: import("three").Vector3, action: string, audio: import("three").PositionalAudio }>} */
  const entities = new Map()

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
    static_objects,
    entities,
  }
}
