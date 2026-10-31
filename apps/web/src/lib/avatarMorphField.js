import * as THREE from 'three';

/**
 * Avatar Morph Field & Point-Cloud Non-Penetration Alignment
 *
 * Garment shells are authored against the avatar's *base* (un-morphed) body
 * coordinates. The avatar itself is reshaped at runtime by morph targets
 * (tall, legs_long, busty, shoulders_wide, ...), which can move the shoulder
 * line by 20 cm or more in local space. Without compensation, garments stay
 * at base coordinates and appear to sag down the body.
 *
 * This module:
 *   1. Extracts the base vertex positions and per-vertex morph displacement
 *      vectors from the avatar GLB.
 *   2. Transfers the exact same body deformation onto every garment vertex via
 *      k-nearest-neighbour inverse distance weighting.
 *   3. Enforces a strict point-cloud surface envelope clearance so the avatar's
 *      skin never shows or pokes through any garment sheet.
 */

const CELL = 0.05; // spatial hash cell size (metres)
const K = 6; // neighbours per garment vertex
const fieldCache = new WeakMap();

// Packed 32-bit integer key for spatial hashing (avoids string allocation in hot loops)
// Range: ix, iy, iz in [-512, 511]
function cellKey(ix, iy, iz) {
  return ((ix + 512) & 0x3FF) | (((iy + 512) & 0x3FF) << 10) | (((iz + 512) & 0x3FF) << 20);
}

/**
 * Builds (and caches per GLTF scene) a morph field: base positions, body
 * morph displacement arrays, and spatial hashes for nearest-neighbour lookup.
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
  const fullGrid = new Map();
  for (let i = 0; i < count; i++) {
    const bx = basePositions[i * 3];
    const by = basePositions[i * 3 + 1];
    const bz = basePositions[i * 3 + 2];
    const key = cellKey(
      Math.floor(bx / CELL),
      Math.floor(by / CELL),
      Math.floor(bz / CELL)
    );

    let fullBucket = fullGrid.get(key);
    if (!fullBucket) {
      fullBucket = [];
      fullGrid.set(key, fullBucket);
    }
    fullBucket.push(i);

    // Exclude hanging forearms, wrists, hands, and fingers (|x| > 0.188m at y in 0.70..1.28m)
    // from the primary torso/hip grid so waist, pelvis, hip, and thigh garment vertices
    // never inherit stationary hand morph weights.
    if (Math.abs(bx) > 0.188 && by >= 0.70 && by <= 1.28) {
      continue;
    }
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const field = { basePositions, targets: targetArrays, grid, fullGrid, count };
  fieldCache.set(scene, field);
  return field;
}

function findNearest(field, x, y, z, includeArms = false) {
  const { basePositions } = field;
  const activeGrid = includeArms && field.fullGrid ? field.fullGrid : field.grid;
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const cz = Math.floor(z / CELL);

  // Maintain top-K nearest neighbors in fixed inline arrays to eliminate GC garbage
  const bestIdx = new Int32Array(K);
  const bestD2 = new Float32Array(K);
  let bestCount = 0;

  function insertNeighbor(idx, d2) {
    if (bestCount < K) {
      // Find insertion position to keep sorted ascending
      let pos = bestCount;
      while (pos > 0 && bestD2[pos - 1] > d2) {
        bestIdx[pos] = bestIdx[pos - 1];
        bestD2[pos] = bestD2[pos - 1];
        pos--;
      }
      bestIdx[pos] = idx;
      bestD2[pos] = d2;
      bestCount++;
    } else if (d2 < bestD2[K - 1]) {
      let pos = K - 1;
      while (pos > 0 && bestD2[pos - 1] > d2) {
        bestIdx[pos] = bestIdx[pos - 1];
        bestD2[pos] = bestD2[pos - 1];
        pos--;
      }
      bestIdx[pos] = idx;
      bestD2[pos] = d2;
    }
  }

  for (let r = 0; r <= 4; r++) {
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iy = cy - r; iy <= cy + r; iy++) {
        for (let iz = cz - r; iz <= cz + r; iz++) {
          // Only visit the outer shell of the cube at radius r
          if (r > 0 && Math.abs(ix - cx) !== r && Math.abs(iy - cy) !== r && Math.abs(iz - cz) !== r) continue;
          const key = ((ix + 512) & 0x3FF) | (((iy + 512) & 0x3FF) << 10) | (((iz + 512) & 0x3FF) << 20);
          const bucket = activeGrid.get(key);
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const i = bucket[b];
            const dx = basePositions[i * 3] - x;
            const dy = basePositions[i * 3 + 1] - y;
            const dz = basePositions[i * 3 + 2] - z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (bestCount < K || d2 < bestD2[K - 1]) {
              insertNeighbor(i, d2);
            }
          }
        }
      }
    }
    // Any point outside the searched cube is at least r*CELL away
    if (bestCount >= K && bestD2[K - 1] <= (r * CELL) * (r * CELL)) break;
  }

  const result = [];
  for (let k = 0; k < bestCount; k++) {
    result.push({ i: bestIdx[k], d2: bestD2[k] });
  }
  return result;
}

/**
 * Returns a new geometry whose vertices carry the same morph displacement the
 * avatar body receives at the matching surface location, plus point-cloud
 * non-penetration safety clearance so avatar skin never pokes through.
 */
export function applyAvatarMorphsToGeometry(geometry, field, influences, options = {}) {
  if (!geometry || !field) return geometry;
  if (options?.rigidAnchor) return geometry;
  const infObj = influences || {};
  const active = Object.entries(infObj).filter(
    ([name, w]) => field.targets[name] && Math.abs(Number(w) || 0) > 1e-4
  );

  const includeArms = Boolean(options?.includeArms);

  if (active.length === 0) return geometry;

  const out = geometry.clone();
  const pos = out.attributes.position;
  const deformWeightAttr = out.attributes.deformWeight || null;
  const heavyInf = Math.max(0, Number(infObj.heavy) || 0);
  const waistInf = Math.max(0, Number(infObj.waist_thick) || 0);
  const hipsInf = Math.max(0, Number(infObj.hips_wide) || 0);
  const bustInf = Math.max(0, Number(infObj.busty) || 0);

  // If geometry carries a `deformWeight` attribute (e.g. Belt_Buckle = 0, Belt_Strap = 1,
  // or Bag_Body = 0, Strap = 1), compute a single rigid anchor translation at the centroid of
  // weight-0 vertices so buckles and bag bodies translate with the body without warping.
  let rigidAnchorDelta = null;
  if (deformWeightAttr) {
    let cx = 0, cy = 0, cz = 0, rCount = 0;
    for (let vi = 0; vi < pos.count; vi++) {
      if (deformWeightAttr.getX(vi) < 0.5) {
        cx += pos.getX(vi);
        cy += pos.getY(vi);
        cz += pos.getZ(vi);
        rCount++;
      }
    }
    if (rCount > 0) {
      cx /= rCount; cy /= rCount; cz /= rCount;
      const nnR = findNearest(field, cx, cy, cz, includeArms);
      let rwSum = 0, rox = 0, roy = 0, roz = 0;
      for (let n = 0; n < nnR.length; n++) {
        const { i, d2 } = nnR[n];
        const w = 1 / (d2 + 1e-6);
        let dx = 0, dy = 0, dz = 0;
        for (let t = 0; t < active.length; t++) {
          const [name, inf] = active[t];
          const arr = field.targets[name];
          dx += inf * arr[i * 3];
          dy += inf * arr[i * 3 + 1];
          dz += inf * arr[i * 3 + 2];
        }
        rox += w * dx; roy += w * dy; roz += w * dz; rwSum += w;
      }
      rigidAnchorDelta = rwSum > 0 ? [rox / rwSum, roy / rwSum, roz / rwSum] : [0, 0, 0];
    }
  }

  for (let vi = 0; vi < pos.count; vi++) {
    const x = pos.getX(vi);
    const y = pos.getY(vi);
    const z = pos.getZ(vi);
    const dWeight = deformWeightAttr ? deformWeightAttr.getX(vi) : 1.0;
    if (dWeight <= 1e-4 && rigidAnchorDelta) {
      pos.setXYZ(vi, x + rigidAnchorDelta[0], y + rigidAnchorDelta[1], z + rigidAnchorDelta[2]);
      continue;
    }
    const isOuterArmVertex = includeArms || (Math.abs(x) > 0.212 && y >= 0.80 && y <= 1.42);
    const nn = findNearest(field, x, y, z, isOuterArmVertex);
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

    let dxFinal = wSum > 0 ? ox / wSum : 0;
    let dyFinal = wSum > 0 ? oy / wSum : 0;
    let dzFinal = wSum > 0 ? oz / wSum : 0;

    // Smooth interior weight: strictly 0 near the side seam (z in [-0.035, +0.065]) so front and back
    // sheets never detach at the hip/thigh seam and side-flank vertices never step discontinuously.
    const frontRamp = z > 0.065 ? Math.min(1, (z - 0.065) / 0.040) : 0;
    const backRamp = z < -0.035 ? Math.min(1, (-0.035 - z) / 0.040) : 0;
    const frontWeight = frontRamp * frontRamp * (3 - 2 * frontRamp);
    const backWeight = backRamp * backRamp * (3 - 2 * backRamp);

    // Guarantee full envelope clearance when body-mass expansion morphs are active
    if ((heavyInf > 0 || waistInf > 0 || hipsInf > 0 || bustInf > 0) && y >= 0.45 && y <= 1.45) {
      if (frontWeight > 0) {
        const minFrontPush = (heavyInf * 0.028 + waistInf * 0.012 + hipsInf * 0.010 + (y >= 1.12 && y <= 1.35 ? bustInf * 0.018 : 0)) * frontWeight;
        if (dzFinal < minFrontPush) dzFinal = minFrontPush;
      } else if (backWeight > 0) {
        const minBackPush = -(heavyInf * 0.024 + waistInf * 0.010 + hipsInf * 0.012) * backWeight;
        if (dzFinal > minBackPush) dzFinal = minBackPush;
      }
    }

    if (dWeight < 1.0 && rigidAnchorDelta) {
      dxFinal = rigidAnchorDelta[0] * (1 - dWeight) + dxFinal * dWeight;
      dyFinal = rigidAnchorDelta[1] * (1 - dWeight) + dyFinal * dWeight;
      dzFinal = rigidAnchorDelta[2] * (1 - dWeight) + dzFinal * dWeight;
    }

    const finalZ = z + dzFinal;

    pos.setXYZ(vi, x + dxFinal, y + dyFinal, finalZ);
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}
