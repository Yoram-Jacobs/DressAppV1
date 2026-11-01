const fs = require('fs');
const path = require('path');

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function processAvatar(inputPath, outputPath, isMale) {
  console.log(`Processing ${inputPath} (isMale: ${isMale})...`);
  const buf = fs.readFileSync(inputPath);
  const totalLen = buf.readUInt32LE(8);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const binOffset = 20 + jsonLen + 8;
  const bin = Buffer.from(buf.slice(binOffset, binOffset + binLen));

  const pivotX = isMale ? 0.205 : 0.177;
  const pivotY = isMale ? 1.435 : 1.368;
  const pivotZ = isMale ? -0.005 : 0.024;
  const deltaTheta = (isMale ? 22.0 : 21.5) * Math.PI / 180;
  const rMin = isMale ? 0.035 : 0.030;
  const rMax = isMale ? 0.095 : 0.090;
  const yArmpit = isMale ? 1.32 : 1.25;
  const xFlank0 = isMale ? 0.198 : 0.170;
  const xFlank1 = isMale ? 0.218 : 0.190;
  const yBottomLimit = isMale ? 0.70 : 0.65;
  const xCenterLimit = isMale ? 0.16 : 0.14;

  function getWeight(x, y, z) {
    const absX = Math.abs(x);
    if (absX < xCenterLimit) return 0;
    if (y > pivotY + 0.05) return 0;
    if (y < yBottomLimit) return 0;

    if (y < yArmpit && absX < xFlank0) return 0;
    const r = Math.hypot(absX - pivotX, y - pivotY, z - pivotZ);
    let w = smoothstep(rMin, rMax, r);
    if (y < yArmpit) {
      w *= smoothstep(xFlank0, xFlank1, absX);
    }
    return w;
  }

  // Iterate over all primitives in mesh 0
  const mesh = gltf.meshes[0];
  mesh.primitives.forEach((prim, primIdx) => {
    const posAccIdx = prim.attributes.POSITION;
    const normAccIdx = prim.attributes.NORMAL;
    if (posAccIdx === undefined) return;

    const posAcc = gltf.accessors[posAccIdx];
    const posBv = gltf.bufferViews[posAcc.bufferView];
    const posStart = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);
    const posStride = posBv.byteStride || 12;

    const normAcc = normAccIdx !== undefined ? gltf.accessors[normAccIdx] : null;
    const normBv = normAcc ? gltf.bufferViews[normAcc.bufferView] : null;
    const normStart = normBv ? (normBv.byteOffset || 0) + (normAcc.byteOffset || 0) : 0;
    const normStride = normBv ? (normBv.byteStride || 12) : 12;

    let pMinX = Infinity, pMaxX = -Infinity;
    let pMinY = Infinity, pMaxY = -Infinity;
    let pMinZ = Infinity, pMaxZ = -Infinity;
    let modifiedCount = 0;

    // Collect per-vertex rotation angles so morph targets use the exact same angle
    const vertexThetas = new Float32Array(posAcc.count);

    for (let i = 0; i < posAcc.count; i++) {
      const pOff = posStart + i * posStride;
      const x = bin.readFloatLE(pOff);
      const y = bin.readFloatLE(pOff + 4);
      const z = bin.readFloatLE(pOff + 8);
      const absX = Math.abs(x);
      const side = x < 0 ? -1 : 1;

      const w = getWeight(x, y, z);
      const theta = deltaTheta * w;
      vertexThetas[i] = theta * side; // signed rotation for lateral components

      if (theta !== 0) {
        modifiedCount++;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const dx = absX - pivotX;
        const dy = y - pivotY;
        const newAbsX = pivotX + dx * cos - dy * sin;
        const newY = pivotY + dx * sin + dy * cos;
        const newX = side * newAbsX;

        bin.writeFloatLE(newX, pOff);
        bin.writeFloatLE(newY, pOff + 4);

        if (normAcc) {
          const nOff = normStart + i * normStride;
          const nx = bin.readFloatLE(nOff);
          const ny = bin.readFloatLE(nOff + 4);
          const absNx = side * nx;
          const newAbsNx = absNx * cos - ny * sin;
          const newNy = absNx * sin + ny * cos;
          const newNx = side * newAbsNx;
          bin.writeFloatLE(newNx, nOff);
          bin.writeFloatLE(newNy, nOff + 4);
        }

        pMinX = Math.min(pMinX, newX);
        pMaxX = Math.max(pMaxX, newX);
        pMinY = Math.min(pMinY, newY);
        pMaxY = Math.max(pMaxY, newY);
        pMinZ = Math.min(pMinZ, z);
        pMaxZ = Math.max(pMaxZ, z);
      } else {
        pMinX = Math.min(pMinX, x);
        pMaxX = Math.max(pMaxX, x);
        pMinY = Math.min(pMinY, y);
        pMaxY = Math.max(pMaxY, y);
        pMinZ = Math.min(pMinZ, z);
        pMaxZ = Math.max(pMaxZ, z);
      }
    }

    posAcc.min = [pMinX, pMinY, pMinZ];
    posAcc.max = [pMaxX, pMaxY, pMaxZ];

    if (modifiedCount > 0) {
      console.log(`  Primitive ${primIdx} (${gltf.materials[prim.material]?.name || 'unknown'}): modified ${modifiedCount} vertices`);
    }

    // Now rotate morph targets deltas for this primitive if any
    if (prim.targets && modifiedCount > 0) {
      prim.targets.forEach((target, targetIdx) => {
        const tPosAccIdx = target.POSITION;
        if (tPosAccIdx === undefined) return;
        const tAcc = gltf.accessors[tPosAccIdx];
        if (!tAcc || tAcc.bufferView === undefined) return;
        const tBv = gltf.bufferViews[tAcc.bufferView];
        if (!tBv) return;
        const tStart = (tBv.byteOffset || 0) + (tAcc.byteOffset || 0);
        const tStride = tBv.byteStride || 12;

        let tMinX = Infinity, tMaxX = -Infinity;
        let tMinY = Infinity, tMaxY = -Infinity;
        let tMinZ = Infinity, tMaxZ = -Infinity;

        for (let i = 0; i < tAcc.count; i++) {
          const tOff = tStart + i * tStride;
          const dx = bin.readFloatLE(tOff);
          const dy = bin.readFloatLE(tOff + 4);
          const dz = bin.readFloatLE(tOff + 8);
          const signedTheta = vertexThetas[i];

          let ndx = dx, ndy = dy;
          if (signedTheta !== 0) {
            const cos = Math.cos(signedTheta);
            const sin = Math.sin(signedTheta);
            ndx = dx * cos - dy * sin;
            ndy = dx * sin + dy * cos;
            bin.writeFloatLE(ndx, tOff);
            bin.writeFloatLE(ndy, tOff + 4);
          }

          tMinX = Math.min(tMinX, ndx);
          tMaxX = Math.max(tMaxX, ndx);
          tMinY = Math.min(tMinY, ndy);
          tMaxY = Math.max(tMaxY, ndy);
          tMinZ = Math.min(tMinZ, dz);
          tMaxZ = Math.max(tMaxZ, dz);
        }

        tAcc.min = [tMinX, tMinY, tMinZ];
        tAcc.max = [tMaxX, tMaxY, tMaxZ];
      });
      console.log(`    Rotated ${prim.targets.length} morph targets for Primitive ${primIdx}`);
    }
  });

  // Re-encode GLTF JSON with 4-byte padding
  let jsonString = JSON.stringify(gltf);
  while (Buffer.byteLength(jsonString) % 4 !== 0) {
    jsonString += ' ';
  }
  const newJsonBuf = Buffer.from(jsonString, 'utf8');

  // Binary chunk must also be padded to 4 bytes
  let newBinBuf = bin;
  while (newBinBuf.length % 4 !== 0) {
    newBinBuf = Buffer.concat([newBinBuf, Buffer.alloc(1)]);
  }

  const newTotalLen = 12 + 8 + newJsonBuf.length + 8 + newBinBuf.length;
  const outBuf = Buffer.alloc(newTotalLen);

  // GLB Header
  outBuf.writeUInt32LE(0x46546C67, 0); // magic
  outBuf.writeUInt32LE(2, 4); // version
  outBuf.writeUInt32LE(newTotalLen, 8); // total length

  // Chunk 0: JSON
  outBuf.writeUInt32LE(newJsonBuf.length, 12);
  outBuf.writeUInt32LE(0x4E4F534A, 16); // "JSON"
  newJsonBuf.copy(outBuf, 20);

  // Chunk 1: BIN
  const binHeaderOffset = 20 + newJsonBuf.length;
  outBuf.writeUInt32LE(newBinBuf.length, binHeaderOffset);
  outBuf.writeUInt32LE(0x004E4942, binHeaderOffset + 4); // "BIN\0"
  newBinBuf.copy(outBuf, binHeaderOffset + 8);

  fs.writeFileSync(outputPath, outBuf);
  console.log(`Successfully written ${outputPath} (size: ${newTotalLen} bytes)`);
}

// 1. Ensure backup directory
const backupDir = path.join(__dirname, '../apps/web/public/models/backup_i_pose');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 2. Backup existing
fs.copyFileSync('apps/web/public/models/avatar_male_1.glb', path.join(backupDir, 'avatar_male_1.glb'));
fs.copyFileSync('apps/web/public/models/avatar_female_1.glb', path.join(backupDir, 'avatar_female_1.glb'));

// 3. Process male & female avatars
processAvatar('apps/web/public/models/avatar_male_1.glb', 'apps/web/public/models/avatar_male_1.glb', true);
processAvatar('apps/web/public/models/avatar_female_1.glb', 'apps/web/public/models/avatar_female_1.glb', false);
