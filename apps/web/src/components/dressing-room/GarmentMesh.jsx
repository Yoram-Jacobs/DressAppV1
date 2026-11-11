import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import {
  BufferAttribute,
  CanvasTexture,
  LinearSRGBColorSpace,
  SRGBColorSpace,
} from 'three';
import { DRACO_DECODER_PATH } from './useDressingRoomStore';
import { applyAvatarAppearance, retractCoveredAvatarSkin } from '@/components/AvatarMesh3D';
import { resolveHairProperties } from '@/components/DynamicAvatar';
import { applyAvatarMorphsToGeometry } from '@/lib/avatarMorphField';
import {
  partitionGarmentGeometryFrontBack,
  buildBackTexture,
  fillTransparentCanvasMargins,
} from './backFabricSynthesis';

export function preloadGarmentGlb(glbUrl) {
  if (!glbUrl || typeof glbUrl !== 'string') return;
  try {
    useGLTF.preload(glbUrl, DRACO_DECODER_PATH);
  } catch {
    // Safe no-op in non-WebGL / unit-test environments
  }
}

/**
 * Converts normalized [0.0 - 1.0] ANSUR II bodyMetrics (neutral = 0.5) into
 * directional MBLab morph influences so canonical DressApp avatars and any
 * MBLab-keyed garments deform smoothly alongside direct ANSUR II shape keys.
 */
export function deriveDirectionalMorphWeights(bodyMetrics = {}) {
  const safeMetric = (val, fallback = 0.5) => {
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };

  const chest = safeMetric(bodyMetrics.chest_circ ?? bodyMetrics.chest_girth, 0.5);
  const waist = safeMetric(bodyMetrics.waist_circ ?? bodyMetrics.waist_girth, 0.5);
  const hip = safeMetric(bodyMetrics.hip_circ ?? bodyMetrics.hip_girth, 0.5);
  const inseam = safeMetric(bodyMetrics.inseam, 0.5);
  const stature = safeMetric(bodyMetrics.height_scale ?? bodyMetrics.stature, 0.5);
  const shoulders = safeMetric(bodyMetrics.shoulder_breadth ?? bodyMetrics.shoulders_circ, 0.5);

  const dChest = (chest - 0.5) * 2;
  const dWaist = (waist - 0.5) * 2;
  const dHip = (hip - 0.5) * 2;
  const dInseam = (inseam - 0.5) * 2;
  const dStature = (stature - 0.5) * 2;
  const dShoulders = (shoulders - 0.5) * 2;
  const massDelta = (dChest + dWaist + dHip) / 3;

  return {
    busty: Math.max(0, dChest),
    waist_thick: Math.max(0, dWaist),
    waist_thin: Math.max(0, -dWaist),
    hips_wide: Math.max(0, dHip),
    hips_narrow: Math.max(0, -dHip),
    legs_long: Math.max(0, dInseam),
    legs_short: Math.max(0, -dInseam),
    tall: Math.max(0, dStature),
    short: Math.max(0, -dStature),
    shoulders_wide: Math.max(0, dShoulders),
    shoulders_narrow: Math.max(0, -dShoulders),
    heavy: Math.max(0, massDelta * 0.75),
    thin: Math.max(0, -massDelta * 0.75),
  };
}

/**
 * Synchronizes incoming `bodyMetrics` onto a mesh's `morphTargetInfluences`
 * via `morphTargetDictionary[key]` lookups with defensive zero-fallbacks.
 */
export function applyBodyMetricsToMorphTargets(mesh, bodyMetrics = {}) {
  const dict = mesh?.morphTargetDictionary;
  const influences = mesh?.morphTargetInfluences;
  if (!dict || !Array.isArray(influences)) return false;

  const metrics = bodyMetrics && typeof bodyMetrics === 'object' ? bodyMetrics : {};

  // Defensive zero-fallback reset on all non-hair morph targets
  Object.entries(dict).forEach(([targetName, idx]) => {
    if (
      typeof idx === 'number' &&
      idx >= 0 &&
      idx < influences.length &&
      !targetName.startsWith('hair_')
    ) {
      influences[idx] = 0;
    }
  });

  let matchedCount = 0;

  // 1. Exact morphTargetDictionary[key] lookup (ANSUR II / Blender MCP shape keys)
  Object.entries(metrics).forEach(([key, rawValue]) => {
    const idx = dict[key];
    if (typeof idx === 'number' && idx >= 0 && idx < influences.length) {
      const num = Number(rawValue);
      influences[idx] = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0;
      matchedCount += 1;
    }
  });

  // 2. Bidirectional bridge for canonical MBLab shape keys around neutral 0.5
  const directional = deriveDirectionalMorphWeights(metrics);
  Object.entries(directional).forEach(([dirKey, weight]) => {
    if (Object.prototype.hasOwnProperty.call(metrics, dirKey)) return;
    const idx = dict[dirKey];
    if (typeof idx === 'number' && idx >= 0 && idx < influences.length) {
      influences[idx] = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
      matchedCount += 1;
    }
  });

  return matchedCount > 0;
}

/**
 * Enforces the Layer Collision & Anti-Z-Fighting Protocol on a mesh and its materials.
 */
export function applyLayerAntiZFighting(mesh, layer = 0) {
  if (!mesh) return;
  const safeLayer = Math.max(0, Number(layer) || 0);
  mesh.renderOrder = safeLayer;

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((material) => {
    if (!material) return;
    if (safeLayer > 0) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -safeLayer;
      material.polygonOffsetUnits = -safeLayer;
      material.depthWrite = true;
    } else {
      material.polygonOffset = false;
      material.polygonOffsetFactor = 0;
      material.polygonOffsetUnits = 0;
      material.depthWrite = true;
    }
    material.needsUpdate = true;
  });
}

/**
 * Normalizes cloned garment UVs to glTF top-left convention (v = 0 at collar/top, v = 1 at hem)
 * when a template GLB was authored with OpenGL bottom-left UVs, ensuring `texture.flipY = false`
 * always maps garment textures right-side up.
 */
function normalizeGarmentUvOrientation(geometry) {
  const pos = geometry?.attributes?.position;
  const uv = geometry?.attributes?.uv;
  if (!pos || !uv || pos.count < 4 || uv.count !== pos.count) return;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = maxY - minY;
  if (spanY < 0.04) return;

  const topCut = maxY - spanY * 0.2;
  const botCut = minY + spanY * 0.2;
  let topSum = 0;
  let topN = 0;
  let botSum = 0;
  let botN = 0;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = uv.getY(i);
    if (y >= topCut) {
      topSum += v;
      topN += 1;
    } else if (y <= botCut) {
      botSum += v;
      botN += 1;
    }
  }

  if (topN > 0 && botN > 0 && topSum / topN > botSum / botN + 0.15) {
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, 1 - uv.getY(i));
    }
    uv.needsUpdate = true;
  }
}

/**
 * Applies incremental outward vertex-normal offset on layered static garment templates
 * while keeping shoe soles anchored cleanly to the floor plane (y <= 0.026m).
 */
function applyRadialLayerClearance(geometry, extraOffset = 0, isFootwear = false) {
  if (!geometry || extraOffset <= 1e-5) return geometry;
  const pos = geometry.attributes?.position;
  if (!pos) return geometry;
  if (!geometry.attributes?.normal) {
    geometry.computeVertexNormals?.();
  }
  const norm = geometry.attributes?.normal;
  if (!norm) return geometry;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (isFootwear && y <= 0.026) continue;
    pos.setXYZ(
      i,
      x + norm.getX(i) * extraOffset,
      y + norm.getY(i) * extraOffset * 0.25,
      z + norm.getZ(i) * extraOffset
    );
  }
  pos.needsUpdate = true;
  return geometry;
}

/**
 * Builds GPU-ready diffuse front and back textures from a Drei `useTexture` result
 * with `flipY = false` and `SRGBColorSpace`.
 *
 * For garments, front view details (collar scoops, lapels, zippers, buttons, breast pockets,
 * graphics, lettering, slogans, logos) are eliminated from the back view via
 * `synthesizeBackFabricData` and filled with seamless back fabric so the garment displays
 * authentic front artwork from the front and clean woven cloth from the back.
 */
export function buildPreparedFrontAndBackTextures(sourceTexture) {
  if (!sourceTexture) return { frontTexture: null, backTexture: null };
  const img = sourceTexture.image;

  if (
    typeof document !== 'undefined' &&
    img &&
    typeof img.width === 'number' &&
    typeof img.height === 'number' &&
    img.width > 0 &&
    img.height > 0
  ) {
    try {
      const maxDim = 512;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const probeCanvas = document.createElement('canvas');
      probeCanvas.width = w;
      probeCanvas.height = h;
      const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        let hasTransparency = false;
        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let opaqueCount = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const a = data[i + 3];
            if (a < 245) {
              hasTransparency = true;
            }
            if (a > 32) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              rSum += data[i];
              gSum += data[i + 1];
              bSum += data[i + 2];
              opaqueCount += 1;
            }
          }
        }

        if (hasTransparency && opaqueCount > 16 && maxX > minX && maxY > minY) {
          const avgR = Math.round(rSum / opaqueCount);
          const avgG = Math.round(gSum / opaqueCount);
          const avgB = Math.round(bSum / opaqueCount);
          const dominantColor = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;

          const cropW = Math.max(1, maxX - minX + 1);
          const cropH = Math.max(1, maxY - minY + 1);

          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
          if (cropCtx) {
            cropCtx.drawImage(probeCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

            // 1. Synthesize back fabric texture FIRST from pristine cropCanvas
            // (eliminates collar scoop, lapels, zippers, buttons, pockets, graphics, logos)
            let backTex = null;
            try {
              backTex = buildBackTexture({ frontCanvas: cropCanvas, dominantColor });
            } catch {
              backTex = null;
            }

            // 2. Build front texture with dilated/filled edge margins
            const frontCanvas = document.createElement('canvas');
            frontCanvas.width = cropW;
            frontCanvas.height = cropH;
            const frontCtx = frontCanvas.getContext('2d', { willReadFrequently: true });
            if (frontCtx) {
              frontCtx.drawImage(cropCanvas, 0, 0);
              fillTransparentCanvasMargins(frontCanvas, dominantColor);

              const frontTex = new CanvasTexture(frontCanvas);
              frontTex.flipY = false;
              frontTex.colorSpace = SRGBColorSpace;
              frontTex.needsUpdate = true;

              if (backTex) {
                backTex.flipY = false;
                backTex.colorSpace = SRGBColorSpace;
                backTex.needsUpdate = true;
              } else {
                backTex = frontTex.clone ? frontTex.clone() : frontTex;
                backTex.flipY = false;
                backTex.colorSpace = SRGBColorSpace;
                backTex.needsUpdate = true;
              }

              return { frontTexture: frontTex, backTexture: backTex };
            }
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  const frontCloned = sourceTexture.clone ? sourceTexture.clone() : sourceTexture;
  frontCloned.flipY = false;
  frontCloned.colorSpace = SRGBColorSpace;
  frontCloned.needsUpdate = true;

  const backCloned = sourceTexture.clone ? sourceTexture.clone() : sourceTexture;
  backCloned.flipY = false;
  backCloned.colorSpace = SRGBColorSpace;
  backCloned.needsUpdate = true;

  return { frontTexture: frontCloned, backTexture: backCloned };
}

function DynamicGarmentTexture({ textureUrl, materials }) {
  const loadedTexture = useTexture(textureUrl);

  useEffect(() => {
    if (!loadedTexture || !Array.isArray(materials) || materials.length === 0) {
      return undefined;
    }

    const { frontTexture, backTexture } = buildPreparedFrontAndBackTextures(loadedTexture);
    if (!frontTexture) return undefined;

    materials.forEach((mat) => {
      if (!mat) return;
      const isBack = mat.userData?.__fabricFace === 'back';
      const targetTexture = (isBack && backTexture) ? backTexture : frontTexture;

      const prevOwned = mat.userData?.__dynamicDiffuseMap;
      if (prevOwned && prevOwned !== targetTexture) {
        prevOwned.dispose?.();
      }
      mat.userData.__dynamicDiffuseMap = targetTexture;
      mat.map = targetTexture;
      if (mat.color?.set) {
        mat.color.set('#ffffff');
      }
      mat.transparent = false;
      mat.needsUpdate = true;
    });

    return () => {
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.map === mat.userData?.__dynamicDiffuseMap) {
          mat.map = mat.userData?.__baseMap || null;
          mat.needsUpdate = true;
        }
        delete mat.userData.__dynamicDiffuseMap;
      });
      if (frontTexture && frontTexture !== loadedTexture) {
        frontTexture.dispose?.();
      }
      if (backTexture && backTexture !== loadedTexture && backTexture !== frontTexture) {
        backTexture.dispose?.();
      }
    };
  }, [loadedTexture, materials, textureUrl]);

  return null;
}

function DynamicGarmentNormalMap({ normalMapUrl, materials }) {
  const loadedNormal = useTexture(normalMapUrl);

  useEffect(() => {
    if (!loadedNormal || !Array.isArray(materials) || materials.length === 0) {
      return undefined;
    }
    const normalTex = loadedNormal.clone ? loadedNormal.clone() : loadedNormal;
    normalTex.flipY = false;
    normalTex.colorSpace = LinearSRGBColorSpace;
    normalTex.needsUpdate = true;

    materials.forEach((mat) => {
      if (!mat) return;
      const prevOwned = mat.userData?.__dynamicNormalMap;
      if (prevOwned && prevOwned !== normalTex) {
        prevOwned.dispose?.();
      }
      mat.userData.__dynamicNormalMap = normalTex;
      mat.normalMap = normalTex;
      mat.needsUpdate = true;
    });

    return () => {
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.normalMap === normalTex) {
          mat.normalMap = mat.userData?.__baseNormalMap || null;
          mat.needsUpdate = true;
        }
        if (mat.userData?.__dynamicNormalMap === normalTex) {
          delete mat.userData.__dynamicNormalMap;
        }
      });
      if (normalTex !== loadedNormal) {
        normalTex.dispose?.();
      }
    };
  }, [loadedNormal, materials, normalMapUrl]);

  return null;
}

/**
 * Synchronized Morph Mesh Component (`GarmentMesh`)
 *
 * Reusable R3F mesh loader for both the base avatar (`layer = 0`) and
 * layered garments (`layer >= 1`):
 *  - Loads Draco-compressed or standard GLB assets via `useGLTF(glbUrl, '/draco/')`.
 *  - Synchronizes `bodyMetrics` onto `morphTargetInfluences` with defensive zero-fallbacks
 *    (plus avatar morph-field transfer for static template GLBs).
 *  - Enforces strict `renderOrder` + `polygonOffset` anti-Z-fighting protocol.
 *  - Dynamically swaps diffuse/normal textures via `useTexture` with `flipY = false`,
 *    `SRGBColorSpace`, and deterministic `.dispose()` cleanup on unmount/unslot.
 */
export function GarmentMesh({
  glbUrl,
  textureUrl = null,
  normalMapUrl = null,
  layer = 0,
  slot = null,
  bodyMetrics = {},
  gender = 'female',
  skinColor = '#E0AC69',
  coveredZones = null,
  avatarMorphField = null,
  onSceneReady = null,
}) {
  const gltf = useGLTF(glbUrl, DRACO_DECODER_PATH);
  const isMale = gender === 'male';
  const numericLayer = Math.max(0, Number(layer) || 0);

  // Notify parent when raw base avatar GLTF scene is available for morph-field sharing
  useEffect(() => {
    if (numericLayer === 0 && gltf?.scene && typeof onSceneReady === 'function') {
      onSceneReady(gltf.scene);
    }
  }, [gltf, numericLayer, onSceneReady]);

  // Clone scene hierarchy, geometries, and materials so per-slot mutations and `.dispose()`
  // never corrupt shared `useGLTF` cache entries.
  const instance = useMemo(() => {
    if (!gltf?.scene) return null;
    const root = SkeletonUtils.clone(gltf.scene);
    const meshes = [];
    const materials = [];
    const baseGeometries = [];

    root.traverse((node) => {
      if (!node.isMesh) return;
      meshes.push(node);

      if (node.geometry) {
        const clonedGeo = node.geometry.clone();
        if (numericLayer > 0) {
          normalizeGarmentUvOrientation(clonedGeo);
          partitionGarmentGeometryFrontBack(clonedGeo, slot, isMale);
        }
        node.geometry = clonedGeo;
        node.userData.__baseClonedGeometry = clonedGeo;
        baseGeometries.push(clonedGeo);
      }

      if (node.material) {
        if (numericLayer > 0) {
          // Garments: create dual material instances (front & back) for face-partitioned rendering
          const baseMat = Array.isArray(node.material) ? node.material[0] : node.material;
          const frontMat = baseMat ? baseMat.clone() : node.material;
          const backMat = baseMat ? baseMat.clone() : node.material;
          if (frontMat) {
            frontMat.userData = {
              ...frontMat.userData,
              __fabricFace: 'front',
              __baseMap: frontMat.map || null,
              __baseNormalMap: frontMat.normalMap || null,
            };
          }
          if (backMat) {
            backMat.userData = {
              ...backMat.userData,
              __fabricFace: 'back',
              __baseMap: backMat.map || null,
              __baseNormalMap: backMat.normalMap || null,
            };
          }
          node.material = [frontMat, backMat];
          materials.push(frontMat, backMat);
        } else if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => {
            if (!m) return m;
            const cm = m.clone();
            cm.userData = {
              ...cm.userData,
              __baseMap: cm.map || null,
              __baseNormalMap: cm.normalMap || null,
            };
            materials.push(cm);
            return cm;
          });
        } else {
          const cm = node.material.clone();
          cm.userData = {
            ...cm.userData,
            __baseMap: cm.map || null,
            __baseNormalMap: cm.normalMap || null,
          };
          node.material = cm;
          materials.push(cm);
        }
      }

      node.castShadow = true;
      node.receiveShadow = true;
    });

    return { root, meshes, materials, baseGeometries };
  }, [gltf, numericLayer, slot, isMale]);

  // Enforce Layer Collision & Anti-Z-Fighting Protocol
  useEffect(() => {
    if (!instance) return;
    instance.meshes.forEach((mesh) => {
      applyLayerAntiZFighting(mesh, numericLayer);
    });
  }, [instance, numericLayer]);

  // Base avatar appearance & covered-skin retraction (`layer === 0`)
  const hairProps = useMemo(() => resolveHairProperties({}, isMale), [isMale]);
  useEffect(() => {
    if (!instance || numericLayer !== 0) return;
    const directionalMorphs = {
      ...deriveDirectionalMorphWeights(bodyMetrics),
      ...(hairProps?.morphs || {}),
    };
    applyAvatarAppearance(instance.root, {
      skinColor,
      hairProps,
      isMale,
      morphInfluences: directionalMorphs,
      castShadow: true,
      receiveShadow: true,
    });
  }, [instance, numericLayer, skinColor, hairProps, isMale, bodyMetrics]);

  // Synchronize `bodyMetrics` -> `morphTargetInfluences` (and morph-field / skin-retraction geometry updates)
  const transientGeometriesRef = useRef([]);
  useEffect(() => {
    if (!instance) return undefined;

    // Dispose previous transient deformed geometries before computing updated ones
    transientGeometriesRef.current.forEach((g) => g?.dispose?.());
    transientGeometriesRef.current = [];

    const directionalMorphs = deriveDirectionalMorphWeights(bodyMetrics);

    instance.meshes.forEach((mesh) => {
      const hasNativeMorphs = applyBodyMetricsToMorphTargets(mesh, bodyMetrics);
      const baseGeo = mesh.userData?.__baseClonedGeometry;
      if (!baseGeo) return;

      if (numericLayer === 0) {
        const matName = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m?.name || '').join(' ')
          : mesh.material?.name || '';
        const isUnderwearNode = Boolean(
          matName.includes('generic') ||
            (mesh.name && (mesh.name.endsWith('_1') || mesh.name.includes('generic')))
        );
        if (isUnderwearNode && coveredZones) {
          const hideUnderwear = isMale
            ? Boolean(coveredZones.hasBottom)
            : Boolean(coveredZones.hasBottom && (coveredZones.hasTop || coveredZones.hasOuterwear));
          mesh.visible = !hideUnderwear;
          if (hideUnderwear) return;
        }
        const hasAnyGarment = Boolean(
          coveredZones &&
            (coveredZones.hasTop ||
              coveredZones.hasBottom ||
              coveredZones.hasOuterwear ||
              coveredZones.hasShoes)
        );
        if (hasAnyGarment) {
          const retracted = retractCoveredAvatarSkin(
            baseGeo.clone(),
            coveredZones,
            isMale,
            mesh.name,
            matName
          );
          mesh.geometry = retracted;
          transientGeometriesRef.current.push(retracted);
        } else {
          mesh.geometry = baseGeo;
        }
        return;
      }

      // Layered garment (`layer > 0`): if the template GLB has no baked morph targets,
      // transfer the base avatar's morph field onto the garment so both stretch together.
      const isFootwear = slot === 'shoes';
      const isLowerBody = slot === 'bottom' || isFootwear;
      const includeArms = slot === 'top' || slot === 'outerwear';
      const extraClearance =
        Math.max(0, (numericLayer - 1) * 0.007) + (slot === 'bottom' ? 0.0025 : 0);

      if (!hasNativeMorphs && avatarMorphField) {
        let morphedGeo = applyAvatarMorphsToGeometry(
          baseGeo,
          avatarMorphField,
          directionalMorphs,
          {
            includeArms,
            exactLowerBody: isLowerBody,
          }
        );
        if (morphedGeo === baseGeo && extraClearance > 1e-5) {
          morphedGeo = baseGeo.clone();
        }
        if (morphedGeo !== baseGeo) {
          applyRadialLayerClearance(morphedGeo, extraClearance, isFootwear);
          mesh.geometry = morphedGeo;
          transientGeometriesRef.current.push(morphedGeo);
          return;
        }
      } else if (extraClearance > 1e-5) {
        const offsetGeo = applyRadialLayerClearance(baseGeo.clone(), extraClearance, isFootwear);
        mesh.geometry = offsetGeo;
        transientGeometriesRef.current.push(offsetGeo);
        return;
      }

      mesh.geometry = baseGeo;
    });

    return () => {
      transientGeometriesRef.current.forEach((g) => g?.dispose?.());
      transientGeometriesRef.current = [];
    };
  }, [instance, bodyMetrics, numericLayer, coveredZones, isMale, avatarMorphField, slot]);

  // Strict GPU disposal when GarmentMesh is unmounted / unslotted
  useEffect(() => {
    if (!instance) return undefined;
    return () => {
      transientGeometriesRef.current.forEach((g) => g?.dispose?.());
      transientGeometriesRef.current = [];

      instance.baseGeometries.forEach((geo) => {
        geo?.dispose?.();
      });

      instance.materials.forEach((mat) => {
        if (!mat) return;
        if (mat.userData?.__dynamicDiffuseMap) {
          mat.userData.__dynamicDiffuseMap.dispose?.();
          delete mat.userData.__dynamicDiffuseMap;
        }
        if (mat.userData?.__dynamicNormalMap) {
          mat.userData.__dynamicNormalMap.dispose?.();
          delete mat.userData.__dynamicNormalMap;
        }
        mat.dispose?.();
      });
    };
  }, [instance]);

  if (!instance?.root) return null;

  return (
    <group name={`dressing-room-layer-${numericLayer}-${slot || 'avatar'}`}>
      <primitive object={instance.root} />
      {Boolean(textureUrl) && numericLayer > 0 && (
        <Suspense fallback={null}>
          <DynamicGarmentTexture
            textureUrl={textureUrl}
            materials={instance.materials}
          />
        </Suspense>
      )}
      {Boolean(normalMapUrl) && numericLayer > 0 && (
        <Suspense fallback={null}>
          <DynamicGarmentNormalMap
            normalMapUrl={normalMapUrl}
            materials={instance.materials}
          />
        </Suspense>
      )}
    </group>
  );
}

export default GarmentMesh;
