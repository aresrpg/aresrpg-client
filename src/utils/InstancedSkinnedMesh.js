import {
  DataTexture,
  DynamicDrawUsage,
  FloatType,
  InstancedBufferAttribute,
  Matrix4,
  RGBAFormat,
  ShaderChunk,
  SkinnedMesh,
} from 'three'

const _instanceLocalMatrix = new Matrix4()
const _instanceWorldMatrix = new Matrix4()

const _offsetMatrix = new Matrix4()
const _identityMatrix = new Matrix4()

const _instanceIntersects = []

ShaderChunk.skinning_pars_vertex = /* glsl */ `
        #ifdef USE_SKINNING

          uniform mat4 bindMatrix;
          uniform mat4 bindMatrixInverse;

          uniform highp sampler2D boneTexture;
          uniform int boneTextureSize;

          mat4 getBoneMatrix( const in float i ) {

          #ifdef USE_INSTANCING

              int j = 4 * int(i);
              vec4 v1 = texelFetch(boneTexture, ivec2( j, gl_InstanceID ), 0);
              vec4 v2 = texelFetch(boneTexture, ivec2( j + 1, gl_InstanceID ), 0);
              vec4 v3 = texelFetch(boneTexture, ivec2( j + 2, gl_InstanceID ), 0);
              vec4 v4 = texelFetch(boneTexture, ivec2( j + 3, gl_InstanceID ), 0);

          #else

            int size = textureSize( boneTexture, 0 ).x;
            int j = int( i ) * 4;
            int x = j % size;
            int y = j / size;
            vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
            vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
            vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
            vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );

          #endif

            mat4 bone = mat4( v1, v2, v3, v4 );

            return bone;

          }

        #endif
      `

// user land of https://github.com/mrdoob/three.js/pull/22667, made more robust
export class InstancedSkinnedMesh extends SkinnedMesh {
  constructor(skinned_mesh, count = 1) {
    super(skinned_mesh.geometry, skinned_mesh.material)

    this.instanceMatrix = new InstancedBufferAttribute(
      new Float32Array(count * 16),
      16,
    )
    this.instanceColor = null

    this.count = count
    this.instanceMatrix.setUsage(DynamicDrawUsage)
    this.frustumCulled = false
    this._mesh = null
    this.isInstancedMesh = true

    super.bind(skinned_mesh.skeleton, skinned_mesh.bindMatrix)

    this.instanceBones = new Float32Array(
      this.skeleton.bones.length * count * 16,
    )
    this.instanceBones.fill(0)

    const update_bones_texture = () => {
      this.skeleton.boneTexture = new DataTexture(
        this.instanceBones,
        this.skeleton.bones.length * 4,
        this.count,
        RGBAFormat,
        FloatType,
      )
      this.skeleton.boneTexture.needsUpdate = true
    }

    update_bones_texture()

    this.skeleton.update = (instanceBones, id) => {
      const { bones } = this.skeleton
      const { boneInverses } = this.skeleton
      const boneMatrices = instanceBones || this.skeleton.boneMatrices
      const { boneTexture } = this.skeleton

      const instanceId = id || 0

      // flatten bone matrices to array
      for (let i = 0, il = bones.length; i < il; i++) {
        // compute the offset between the current and the original transform
        const matrix = bones[i] ? bones[i].matrixWorld : _identityMatrix

        _offsetMatrix.multiplyMatrices(matrix, boneInverses[i])
        _offsetMatrix.toArray(
          boneMatrices,
          16 * (i + instanceId * bones.length),
        )
      }

      const expectedSize = bones.length * 4 * this.count * 16
      if (instanceBones && instanceBones.length === expectedSize) {
        // Update the boneTexture only if instanceBones has the correct size
        if (boneTexture) boneTexture.needsUpdate = true
      }
    }

    // @ts-ignore
    this.skeleton.computeBoneTexture = update_bones_texture
    // @ts-ignore
    this.skeleton.computeInstancedBoneTexture = update_bones_texture

    // Patch js skinning shader chunks for points and instanced bones
  }

  copy(source) {
    super.copy(source)

    if (source.isInstancedMesh) {
      this.instanceMatrix.copy(source.instanceMatrix)

      if (source.instanceColor !== null)
        this.instanceColor = source.instanceColor.clone()

      this.count = source.count
    }

    return this
  }

  getColorAt(index, color) {
    color.fromArray(this.instanceColor.array, index * 3)
  }

  getMatrixAt(index, matrix) {
    matrix.fromArray(this.instanceMatrix.array, index * 16)
  }

  raycast(raycaster, intersects) {
    const { matrixWorld } = this
    const raycastTimes = this.count

    if (this._mesh === null) {
      this._mesh = new SkinnedMesh(this.geometry, this.material)
      this._mesh.copy(this)
    }

    const { _mesh } = this

    if (_mesh.material === undefined) return

    for (let instanceId = 0; instanceId < raycastTimes; instanceId++) {
      // calculate the world matrix for each instance

      this.getMatrixAt(instanceId, _instanceLocalMatrix)

      _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix)

      // the mesh represents this single instance

      _mesh.matrixWorld = _instanceWorldMatrix

      _mesh.raycast(raycaster, _instanceIntersects)

      // process the result of raycast

      for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
        const intersect = _instanceIntersects[i]
        intersect.instanceId = instanceId
        intersect.object = this
        intersects.push(intersect)
      }

      _instanceIntersects.length = 0
    }
  }

  setColorAt(index, color) {
    if (this.instanceColor === null) {
      this.instanceColor = new InstancedBufferAttribute(
        new Float32Array(this.instanceMatrix.count * 3),
        3,
      )
    }

    color.toArray(this.instanceColor.array, index * 3)
  }

  setMatrixAt(index, matrix) {
    matrix.toArray(this.instanceMatrix.array, index * 16)
  }

  setBonesAt(index, skeleton) {
    skeleton = skeleton || this.skeleton

    const size = skeleton.bones.length * 16

    if (this.instanceBones === null) {
      this.instanceBones = new Float32Array(size * this.count)
    }

    skeleton.update(this.instanceBones, index)
  }

  updateMorphTargets() {}

  dispose() {
    // @ts-ignore
    this.dispatchEvent({ type: 'dispose' })
  }
}
