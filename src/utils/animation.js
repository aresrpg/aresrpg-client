export function compute_animation_state({
  is_on_ground,
  is_moving_horizontally,
  action,
}) {
  if (action === 'JUMP') return is_moving_horizontally ? 'JUMP_RUN' : 'JUMP'
  if (!is_on_ground) return 'FALL'
  if (is_moving_horizontally) return action === 'WALK' ? 'WALK' : 'RUN'
  if (action) return action
  return 'IDLE'
}
