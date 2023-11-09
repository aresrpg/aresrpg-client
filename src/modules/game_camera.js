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
export default {
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
            const { movementX, movementY } = payload
            const { camera_rotation } = data

            camera_rotation.y -= movementX * mouse_sensitivity
            camera_rotation.x += movementY * mouse_sensitivity
            camera_rotation.x = Math.max(
              CAMERA_MIN_POLAR_ANGLE,
              Math.min(CAMERA_MAX_POLAR_ANGLE, camera_rotation.x),
            )
            return data
          }

          if (event === 'wheel') {
            const { deltaY } = payload

            let spherical_radius = data.spherical_radius + deltaY * 0.05
            spherical_radius = Math.max(
              CAMERA_MIN_ZOOM,
              Math.min(CAMERA_MAX_ZOOM, spherical_radius),
            )
            return {
              ...data,
              spherical_radius,
            }
          }

          if (event === 'FRAME' && payload.state.player.model) {
            const { spherical_radius, camera_rotation } = data
            const {
              state: {
                player: { model },
              },
            } = payload

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

            renderer.render(scene, camera)
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
