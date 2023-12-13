import { on } from 'events'

import {
  PerspectiveCamera,
  Vector2,
  Vector3,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  Raycaster,
  Ray,
} from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import { abortable, combine, named_on } from '../utils/iterator.js'
import { PLAYER_ID } from '../game'

const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.5 * 0.7 //  70% of the half PI
const CAMERA_MIN_ZOOM = 4
const CAMERA_MAX_ZOOM = 14

/** @type {import("../game").Module} */
export default function () {
  const camera_rotation = new Vector3(0.8, 0, 0)
  const spherical_radius = 4

  return {
    name: 'game_camera',
    tick({ player }, { camera, camera_controls }, delta) {
      if (!player) return

      const { height } = player
      const position = player.position()

      camera_controls.moveTo(position.x, position.y, position.z)
      camera_controls.setTarget(position.x, position.y, position.z)
      camera_controls.update(delta)
    },
    observe({ camera, camera_controls, get_state, renderer, signal, scene }) {
      function set_camera_padding(top, right, bottom, left) {
        const full_width = window.innerWidth - left + right
        const full_height = window.innerHeight - top + bottom
        const width_offset = -left + right
        const height_offset = -top + bottom
        const view_width = window.innerWidth
        const view_height = window.innerHeight
        camera.setViewOffset(
          full_width,
          full_height,
          width_offset,
          height_offset,
          view_width,
          view_height,
        )
        camera.updateProjectionMatrix()
      }

      camera_controls.dollyDragInverted = true
      camera_controls.dollyToCursor = true
      camera_controls.maxDistance = CAMERA_MAX_ZOOM
      camera_controls.minDistance = CAMERA_MIN_ZOOM

      camera_controls.dolly(8)
      camera_controls.rotate(0, 1)

      set_camera_padding(200, 0, 0, 0)

      let is_dragging = false

      const on_mouse_down = () => {
        is_dragging = true
        renderer.domElement.requestPointerLock()
      }

      renderer.domElement.addEventListener('mousedown', on_mouse_down, {
        signal,
      })

      window.addEventListener(
        'mouseup',
        () => {
          is_dragging = false
          if (document.pointerLockElement === renderer.domElement)
            document.exitPointerLock()
        },
        { signal },
      )
    },
  }
}
