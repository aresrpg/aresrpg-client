import { on } from 'events'

import { PerspectiveCamera, Vector3 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import { combine, named_on } from '../utils/iterator.js'

const CAMERA_MIN_POLAR_ANGLE = 0
const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.5 * 0.7 //  70% of the half PI
const CAMERA_MIN_ZOOM = 3.5
const CAMERA_MAX_ZOOM = 15

/** @type {import("../game").Module} */
export default function () {
  const camera_rotation = new Vector3()
  let spherical_radius = 10

  return {
    tick({ player: { model } }, { camera }) {
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
        model.position.x + offset_x,
        model.position.y + offset_y,
        model.position.z + offset_z,
      )

      // Look at the player
      camera.lookAt(
        new Vector3(model.position.x, model.position.y + 2, model.position.z),
      )
    },
    observe({
      camera,
      lock_controls,
      events,
      get_state,
      renderer,
      scene,
      world,
    }) {
      camera.position.set(0, 5, 10)

      aiter(on(window, 'mousemove'))
        .filter(() => lock_controls.isLocked)
        .forEach(({ movementX, movementY }) => {
          const {
            settings: { mouse_sensitivity },
          } = get_state()

          camera_rotation.y -= movementX * mouse_sensitivity
          camera_rotation.x += movementY * mouse_sensitivity
          camera_rotation.x = Math.max(
            CAMERA_MIN_POLAR_ANGLE,
            Math.min(CAMERA_MAX_POLAR_ANGLE, camera_rotation.x),
          )
        })

      aiter(on(window, 'wheel'))
        .filter(() => lock_controls.isLocked)
        .forEach(({ deltaY }) => {
          spherical_radius += deltaY * 0.05
          spherical_radius = Math.max(
            CAMERA_MIN_ZOOM,
            Math.min(CAMERA_MAX_ZOOM, spherical_radius),
          )
        })
    },
  }
}
