export function compute_animation_state({
  is_jumping,
  is_on_ground,
  is_moving_horizontally,
  is_dancing,
}) {
  if (is_jumping) return 'JUMP'
  if (!is_on_ground) return 'FALLING'
  if (is_moving_horizontally) return 'RUN'
  if (is_dancing) return 'DANCE'
  return 'IDLE'
}
