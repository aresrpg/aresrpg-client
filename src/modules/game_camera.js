import { PerspectiveCamera, Vector3 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

import { Actions, pop_actions } from '../actions.js'

const CAMERA_MIN_POLAR_ANGLE = 0
const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.5 * 0.7 //  70% of the half PI
const CAMERA_MIN_ZOOM = 5
const CAMERA_MAX_ZOOM = 50

/** @type {import("../game").Module} */
export default function () {
  const camera = new PerspectiveCamera(
    75, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000, // Far clipping plane
  )
  const lock_controls = new PointerLockControls(camera, document.body)

  const camera_offset = new Vector3(0, 5, 10)
  const camera_rotation = camera.rotation.clone()

  let spherical_radius = 10
  camera.position.set(0, 5, 10)

  return (state, delta) => {
    const { pending_client_actions } = state
    const [
      resize_actions,
      click_actions,
      mouse_move_actions,
      mouse_wheel_actions,
      remaining_actions,
    ] = pop_actions(
      [
        Actions.WINDOW_RESIZE,
        Actions.WINDOW_CLICK,
        Actions.MOUSE_MOVE,
        Actions.MOUSE_WHEEL,
      ],
      pending_client_actions,
    )

    resize_actions.forEach(({ innerWidth, innerHeight }) => {
      state.renderer.setSize(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
    })

    click_actions.forEach(() => {
      camera_rotation.set(0.5, 0, 0)
      lock_controls.lock()
    })

    mouse_move_actions.forEach(({ movementX, movementY }) => {
      if (lock_controls.isLocked) {
        camera_rotation.y -= movementX * state.settings.mouse_sensitivity
        camera_rotation.x += movementY * state.settings.mouse_sensitivity
        camera_rotation.x = Math.max(
          CAMERA_MIN_POLAR_ANGLE,
          Math.min(CAMERA_MAX_POLAR_ANGLE, camera_rotation.x),
        )
      }
    })

    mouse_wheel_actions.forEach(({ deltaY }) => {
      // Update zoom based on wheel scroll
      spherical_radius += deltaY * 0.1
      spherical_radius = Math.max(
        CAMERA_MIN_ZOOM,
        Math.min(CAMERA_MAX_ZOOM, spherical_radius),
      )
    })

    // if the player is loaded and the camera is locked
    if (lock_controls.isLocked && state.player.model) {
      const { model } = state.player
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
        new Vector3(model.position.x, model.position.y + 1.5, model.position.z),
      )
    }

    state.renderer.render(state.scene, camera)

    return {
      ...state,
      pending_client_actions: remaining_actions,
      camera_control_locked: lock_controls.isLocked,
    }
  }
}
