import * as THREE from 'three';

/**
 * Avatar Morph Field
 *
 * Garment shells are authored against the avatar's *base* (un-morphed) body
 * coordinates. The avatar itself is reshaped at runtime by morph targets
 * (tall, legs_long, busty, shoulders_wide, ...), which can move the shoulder
 * line by 20 cm or more in local space. Without compensation, garments stay
 * at base coordinates and appear to sag down the body.
 *
 * This module extracts the base vertex positions and the per-vertex morph
 * displacement vectors from the avatar GLB, then transfers the same
 * displacement onto every garment vertex via k-nearest-neighbour inverse
 * distance weighting. The garment therefore follows the exact same body
 * deformation as the avatar mesh.
 */

const CELL = 0.05; // spatial hash cell size (metres)
const K = 6; // neighbours per garment vertex
const fieldCache = new WeakMap();

function cellKey(ix, iy, iz) {
  return `${ix},${iy},${iz}`;
}

/**
 * Builds (and caches per GLTF scene) a morph field: base positions, body
 * morph displacement arrays, and a spatial hash for nearest-neighbour lookup.
 * Hair targets are ignored so hair styling never drags garments around.
 */
export function buildAvatarMorphField(scene) {
  if (!scene || typeof scene.traverse !== 'function') return null;
  if (fieldCache.has(scene)) return fieldCache.get(scene);
  try {
    return buildField(scene);
  } catch (err) {
    console.warn('Avatar morph field unavailable:', err);
    return null;
  }
}

function buildField(scene) {
  scene.updateMatrixWorld?.(true);
  const positions = [];
  const targets = {}; // name -> number[] (flattened xyz displacement, aligned with positions)
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();

  scene.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const geo = node.geometry;
    const pos = geo.attributes.position;
    const dict = node.morphTargetDictionary || {};
    const morphPos = geo.morphAttributes?.position || [];
    const relative = geo.morphTargetsRelative !== false;
    const linear = new THREE.Matrix4().extractRotation(node.matrixWorld);
    const scale = new THREE.Vector3().setFromMatrixScale(node.matrixWorld);

    const start = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      positions.push(v.x, v.y, v.z);
    }

    Object.entries(dict).forEach(([name, idx]) => {
      if (name.startsWith('hair_')) return;
      const attr = morphPos[idx];
      if (!attr) return;
      if (!targets[name]) targets[name] = [];
      const arr = targets[name];
      // Pad any vertices from previous meshes that lacked this target
      while (arr.length < start * 3) arr.push(0);
      for (let i = 0; i < pos.count; i++) {
        d.fromBufferAttribute(attr, i);
        if (!relative) {
          v.fromBufferAttribute(pos, i);
          d.sub(v);
        }
        d.multiply(scale).applyMatrix4(linear);
        arr.push(d.x, d.y, d.z);
      }
    });
  });

  const count = positions.length / 3;
  Object.values(targets).forEach((arr) => {
    while (arr.length < count * 3) arr.push(0);
  });
  if (count === 0) return null;

  const basePositions = new Float32Array(positions);
  const targetArrays = {};
  Object.entries(targets).forEach(([name, arr]) => {
    targetArrays[name] = new Float32Array(arr);
  });

  const grid = new Map();
  for (let i = 0; i < count; i++) {
    const bx = basePositions[i * 3];
    const by = basePositions[i * 3 + 1];
    const bz = basePositions[i * 3 + 2];
    // Exclude hanging forearms, wrists, hands, and fingers (|x| > 0.188m at y in 0.70..1.28m)
    // so waist, pelvis, hip, and thigh garment vertices never inherit stationary hand morph weights.
    if (Math.abs(bx) > 0.188 && by >= 0.70 && by <= 1.28) {
      continue;
    }
    const key = cellKey(
      Math.floor(bx / CELL),
      Math.floor(by / CELL),
      Math.floor(bz / CELL)
    );
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const field = { basePositions, targets: targetArrays, grid, count };
  fieldCache.set(scene, field);
  return field;
}

function findNearest(field, x, y, z) {
  const { basePositions, grid } = field;
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const cz = Math.floor(z / CELL);
  const best = []; // [{ i, d2 }] sorted ascending, length <= K

  for (let r = 0; r <= 4; r++) {
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iy = cy - r; iy <= cy + r; iy++) {
        for (let iz = cz - r; iz <= cz + r; iz++) {
          // Only visit the outer shell of the cube at radius r
          if (r > 0 && Math.abs(ix - cx) !== r && Math.abs(iy - cy) !== r && Math.abs(iz - cz) !== r) continue;
          const bucket = grid.get(cellKey(ix, iy, iz));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const i = bucket[b];
            const dx = basePositions[i * 3] - x;
            const dy = basePositions[i * 3 + 1] - y;
            const dz = basePositions[i * 3 + 2] - z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (best.length < K || d2 < best[best.length - 1].d2) {
              best.push({ i, d2 });
              best.sort((a, c) => a.d2 - c.d2);
              if (best.length > K) best.pop();
            }
          }
        }
      }
    }
    // Any point outside the searched cube is at least r*CELL away
    if (best.length >= K && best[best.length - 1].d2 <= (r * CELL) * (r * CELL)) break;
  }
  return best;
}

/**
 * Returns a new geometry whose vertices carry the same morph displacement the
 * avatar body receives at the matching surface location.
 */
export function applyAvatarMorphsToGeometry(geometry, field, influences) {
  if (!geometry || !field || !influences) return geometry;
  const active = Object.entries(influences).filter(
    ([name, w]) => field.targets[name] && Math.abs(Number(w) || 0) > 1e-4
  );
  if (active.length === 0) return geometry;

  const out = geometry.clone();
  const pos = out.attributes.position;
  for (let vi = 0; vi < pos.count; vi++) {
    const x = pos.getX(vi);
    const y = pos.getY(vi);
    const z = pos.getZ(vi);
    const nn = findNearest(field, x, y, z);
    if (nn.length === 0) continue;

    let wSum = 0;
    let ox = 0, oy = 0, oz = 0;
    for (let n = 0; n < nn.length; n++) {
      const { i, d2 } = nn[n];
      const w = 1 / (d2 + 1e-6);
      let dx = 0, dy = 0, dz = 0;
      for (let t = 0; t < active.length; t++) {
        const [name, inf] = active[t];
        const arr = field.targets[name];
        dx += inf * arr[i * 3];
        dy += inf * arr[i * 3 + 1];
        dz += inf * arr[i * 3 + 2];
      }
      ox += w * dx;
      oy += w * dy;
      oz += w * dz;
      wSum += w;
    }
    let dxFinal = ox / wSum;
    let dyFinal = oy / wSum;
    let dzFinal = oz / wSum;

    // Guarantee full envelope clearance when body-mass expansion morphs are active
    // so peak quadriceps/pelvis/belly expansions never poke through off-center garment vertices.
    const heavyInf = Math.max(0, Number(influences.heavy) || 0);
    const waistInf = Math.max(0, Number(influences.waist_thick) || 0);
    const hipsInf = Math.max(0, Number(influences.hips_wide) || 0);
    if ((heavyInf > 0 || waistInf > 0 || hipsInf > 0) && y >= 0.48 && y <= 1.42) {
      if (z > 0.025) {
        const minFrontPush = heavyInf * 0.028 + waistInf * 0.010 + hipsInf * 0.008;
        if (dzFinal < minFrontPush) dzFinal = minFrontPush;
      } else if (z < -0.025) {
        const minBackPush = -(heavyInf * 0.022 + waistInf * 0.008 + hipsInf * 0.010);
        if (dzFinal > minBackPush) dzFinal = minBackPush;
      }
    }

    pos.setXYZ(vi, x + dxFinal, y + dyFinal, z + dzFinal);
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}
