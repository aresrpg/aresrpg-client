import { on } from 'events'

import Stats from 'stats.js'
import { aiter } from 'iterator-helper'

import { abortable } from '../utils/iterator'

/** @type {Type.Module} */
export default function () {
  const stats_fps = new Stats()
  stats_fps.showPanel(0) // 0: FPS
  stats_fps.dom.style.cssText =
    'position:fixed;top:200px;left:0;cursor:pointer;opacity:0.9;z-index:10000'

  const stats_memory = new Stats()
  stats_memory.showPanel(2) // 2: Memory
  stats_memory.dom.style.cssText =
    'position:fixed;top:248px;left:0;cursor:pointer;opacity:0.9;z-index:10000'

  // Custom panel for mesh count
  const stats_mesh = new Stats()
  const mesh_panel = new Stats.Panel('Mesh', '#ff8', '#221')
  stats_mesh.addPanel(mesh_panel)
  stats_mesh.showPanel(3) // Show the custom panel
  stats_mesh.dom.style.cssText =
    'position:fixed;top:296px;left:0;cursor:pointer;opacity:0.9;z-index:10000'

  function show_stats(show) {
    if (show) {
      document.body.appendChild(stats_fps.dom)
      document.body.appendChild(stats_memory.dom)
      document.body.appendChild(stats_mesh.dom)
    } else {
      ;[stats_fps.dom, stats_memory.dom, stats_mesh.dom].forEach(dom => {
        if (document.body.contains(dom)) {
          document.body.removeChild(dom)
        }
      })
    }
  }

  function count_meshes(scene) {
    let count = 0
    scene.traverse(child => {
      if (child.isMesh) count++
    })
    return count
  }

  return {
    name: 'ui_fps_memory_mesh',
    tick(_, { scene }) {
      stats_fps.update()
      stats_memory.update()
      mesh_panel.update(count_meshes(scene), 1000) // 1000 is an arbitrary max value
    },
    reduce(state, { type, payload }) {
      if (type === 'action/show_fps')
        return {
          ...state,
          settings: {
            ...state.settings,
            show_fps: payload,
          },
        }

      return state
    },
    observe({ events, dispatch, signal, get_state }) {
      const { show_fps } = get_state().settings
      show_stats(show_fps)

      aiter(abortable(on(events, 'STATE_UPDATED', { signal })))
        .map(
          ([
            {
              settings: { show_fps },
            },
          ]) => show_fps,
        )
        .reduce((last_show_fps, show_fps) => {
          if (show_fps !== last_show_fps) show_stats(show_fps)

          return show_fps
        })
    },
  }
}
