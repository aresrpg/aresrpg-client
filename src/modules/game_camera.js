import { on } from 'events'

import { PerspectiveCamera, Vector3 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import { combine, named_on } from '../utils/iterator.js'

const CAMERA_MIN_POLAR_ANGLE = 0
const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.5 * 0.7 //  70% of the half PI
const CAMERA_MIN_ZOOM = 5
const CAMERA_MAX_ZOOM = 50

/** @type {import("../game").Module} */
export default {
  observe({ camera, lock_controls, events, get_state }) {
    camera.position.set(0, 5, 10)

    aiter(
      combine(
        named_on(window, 'mousemove'),
        named_on(window, 'wheel'),
        named_on(events, 'FRAME'),
      ),
    )
      .filter(() => lock_controls.isLocked)
      .reduce(
        (data, { event, payload }) => {
          if (event === 'mousemove') {
            const {
              settings: { mouse_sensitivity },
            } = get_state()
            const { camera_rotation } = data
            const { movementX, movementY } = payload

            camera_rotation.y -= movementX * mouse_sensitivity
            camera_rotation.x += movementY * mouse_sensitivity
            camera_rotation.x = Math.max(
              CAMERA_MIN_POLAR_ANGLE,
              Math.min(CAMERA_MAX_POLAR_ANGLE, camera_rotation.x),
            )

            return data
          }

          if (event === 'wheel') {
            const { spherical_radius } = data
            const { deltaY } = payload

            return {
              ...data,
              spherical_radius: Math.max(
                CAMERA_MIN_ZOOM,
                Math.min(CAMERA_MAX_ZOOM, spherical_radius + deltaY * 0.1),
              ),
            }
          }

          if (event === 'FRAME') {
            const { spherical_radius, camera_rotation } = data
            const {
              state: {
                player: { model },
              },
              delta,
            } = payload
            if (model) {
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
                new Vector3(
                  model.position.x,
                  model.position.y + 1.5,
                  model.position.z,
                ),
              )
            }
          }

          return data
        },
        {
          camera_rotation: camera.rotation.clone(),
          spherical_radius: 10,
          camera_offset: new Vector3(0, 5, 10),
        },
      )
  },
}
