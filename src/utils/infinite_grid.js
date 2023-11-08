import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  MeshBasicMaterial,
  Color,
  DoubleSide,
  RepeatWrapping,
  TextureLoader,
  MeshLambertMaterial,
} from 'three'
import { World, ColliderDesc } from '@dimforge/rapier3d'

export default function create_grid({
  world,
  size1 = 10,
  size2 = 100,
  color = new Color('black'),
  distance = 500,
  axes = 'xzy',
}) {
  const plane_axes = axes.slice(0, 2)
  const geometry = new PlaneGeometry(2, 2, 1, 1)

  const material = new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      u_size1: { value: size1 },
      u_size2: { value: size2 },
      u_color: { value: color },
      u_distance: { value: distance },
    },
    transparent: true,
    vertexShader: `
      varying vec3 world_position;
      uniform float u_distance;
      void main() {
        vec3 pos = position.${axes} * u_distance;
        pos.${plane_axes} += cameraPosition.${plane_axes};
        world_position = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 5);
      }
    `,
    fragmentShader: `
      varying vec3 world_position;
      uniform float u_size1;
      uniform float u_size2;
      uniform vec3 u_color;
      uniform float u_distance;
      float get_grid(float size) {
        vec2 r = world_position.${plane_axes} / size;
        vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
        return 1.0 - min(min(grid.x, grid.y), 1.0);
      }
      void main() {
        float d = 1.0 - min(distance(cameraPosition.${plane_axes}, world_position.${plane_axes}) / u_distance, 1.0);
        float g1 = get_grid(u_size1);
        float g2 = get_grid(u_size2);
        gl_FragColor = vec4(u_color.rgb, mix(g2, g1, g1) * pow(d, 3.0));
        gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2);
        if (gl_FragColor.a <= 0.0) discard;
      }
    `,
    extensions: { derivatives: true },
  })

  const mesh = new Mesh(geometry, material)

  mesh.receiveShadow = true
  mesh.frustumCulled = false

  // Create a static ground collider for the grid
  const collider = ColliderDesc.cuboid(distance / 2, 0.1, distance / 2)
  world.createCollider(collider)

  return mesh
}
