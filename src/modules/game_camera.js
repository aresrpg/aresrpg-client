import { on } from 'events'

import { PerspectiveCamera, Vector3 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import { abortable, combine, named_on } from '../utils/iterator.js'
import { PLAYER_ID } from '../game'

const CAMERA_MIN_POLAR_ANGLE = 0
const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.5 * 0.7 //  70% of the half PI
const CAMERA_MIN_ZOOM = 4
const CAMERA_MAX_ZOOM = 15

/** @type {import("../game").Module} */
export default function () {
  const camera_rotation = new Vector3(0.8, 0, 0)
  let spherical_radius = 10

  return {
    name: 'game_camera',
    tick(_, { camera, world }) {
      const player = world.entities.get(PLAYER_ID)

      if (!player) return

      const { position, height } = player

      // Calculate the offset position from the player using spherical coordinates
      const offset_x =
        Math.sin(camera_rotation.y) *
        Math.cos(camera_rotation.x) *
        spherical_radius
      const offset_y = Math.sin(camera_rotation.x) * spherical_radius
      const offset_z =
        Math.cos(camera_rotation.y) *
        Math.cos(camera_rotation.x) *
        spherical_radius

      camera.position.set(
        position.x + offset_x,
        position.y + offset_y,
        position.z + offset_z,
      )

      // Look at the player
      camera.lookAt(
        new Vector3(position.x, position.y + height / 2, position.z),
      )
    },
    observe({ camera, get_state, renderer, signal }) {
      camera.position.set(0, 5, 0)

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

      aiter(abortable(on(window, 'mousemove', { signal })))
        .filter(() => is_dragging)
        .forEach(({ movementX, movementY }) => {
          const state = get_state()
          if (state) {
            const {
              settings: { mouse_sensitivity },
            } = state

            camera_rotation.y -= movementX * mouse_sensitivity
            camera_rotation.x += movementY * mouse_sensitivity
            camera_rotation.x = Math.max(
              CAMERA_MIN_POLAR_ANGLE,
              Math.min(CAMERA_MAX_POLAR_ANGLE, camera_rotation.x),
            )
          }
        })
        // when the module is unloaded we cleanup
        .finally(() => {
          if (document.pointerLockElement === renderer.domElement)
            document.exitPointerLock()
        })

      aiter(on(window, 'wheel', { signal })).forEach(({ deltaY }) => {
        spherical_radius += deltaY * 0.05
        spherical_radius = Math.max(
          CAMERA_MIN_ZOOM,
          Math.min(CAMERA_MAX_ZOOM, spherical_radius),
        )
      })
    },
  }
}
