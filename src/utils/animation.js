export function compute_animation_state({
  is_on_ground,
  is_moving_horizontally,
  action,
}) {
  if (action === 'JUMP') return action
  if (!is_on_ground) return 'FALL'
  if (is_moving_horizontally) return 'RUN'
  if (action) return action
  return 'IDLE'
}
