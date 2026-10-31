import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { poseAvatarGeometry } from '@/lib/footwearFit';
import * as THREE from 'three';
import { resolveHairProperties, applyAvatarAppearance } from './DynamicAvatar';

export { applyAvatarAppearance };

export const MALE_GLB_URL = '/models/avatar_male_1.glb?v=hair5_smooth';
export const FEMALE_GLB_URL = '/models/avatar_female_1.glb?v=hair5_smooth';

// Metric scaling and floor positioning helper for the 3D human avatar model
export function getAvatarMetricTransform({ isMale = false, height = 170, morphInfluences = {} } = {}) {
  const defaultH = isMale ? 178 : 168;
  const numH = Math.max(130, Math.min(215, Number(height) || defaultH));
  const baseModelHeightM = isMale ? 1.7877 : 1.6873;
  const baseModelYMinM = -0.0061;

  const targetHeightM = numH / 100.0;
  const defaultHeightM = defaultH / 100.0;

  // Compensate for vertical expansion from morph targets so total height matches targetHeightM
  const morphUniformRatio =
    1 +
    (morphInfluences?.tall || 0) * (isMale ? 0.334 : 0.247) -
    (morphInfluences?.short || 0) * (isMale ? 0.230 : 0.241);
  const morphHeightRatio =
    morphUniformRatio +
    (morphInfluences?.legs_long || 0) * 0.13 -
    (morphInfluences?.legs_short || 0) * 0.06;

  const scaleY = targetHeightM / (baseModelHeightM * Math.max(0.75, morphHeightRatio));
  const scaleXZ = defaultHeightM / (baseModelHeightM * Math.max(0.75, morphUniformRatio));

  // Place soles of feet precisely at y = 0
  const posY = -baseModelYMinM * scaleY;

  return {
    scale: [scaleXZ, scaleY, scaleXZ],
    position: [0, posY, 0],
  };
}



/**
 * Gently retracts interior avatar skin vertices toward the anatomical bone axis
 * inside regions covered by active garments (torso under tops/outerwear/dresses,
 * pelvis/hips under bottoms/dresses, feet inside shoes) so avatar skin can never
 * poke or bleed through garments at any camera angle or morph setting.
 */
export function retractCoveredAvatarSkin(geometry, coveredZones = null, isMale = false) {
  if (!geometry || !coveredZones) return geometry;
  const { hasTop, hasOuterwear, hasDress, hasBottom, hasShoes, hasHeadwear } = coveredZones;
  if (!hasTop && !hasOuterwear && !hasDress && !hasBottom && !hasShoes && !hasHeadwear) return geometry;

  const pos = geometry.attributes?.position;
  if (!pos) return geometry;
  const arr = pos.array;
  const n = pos.count;
  const footCx = isMale ? 0.148 : 0.170;
  const footCz = isMale ? 0.055 : 0.095;
  const hatBrimY = isMale ? 1.66 : 1.58;

  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const x = arr[idx];
    const y = arr[idx + 1];
    const z = arr[idx + 2];
    const absX = Math.abs(x);

    // 0. Headwear hair/crown collision mask: subtly depress hair/crown geometry above hat brim
    // so hair never punches through the crown of a hat or cap.
    if (hasHeadwear && y > hatBrimY) {
      const tCrown = Math.min(1.0, (y - hatBrimY) / 0.12);
      arr[idx] = x * (1 - 0.08 * tCrown);
      arr[idx + 1] = y - 0.012 * tCrown;
      arr[idx + 2] = 0.03 + (z - 0.03) * (1 - 0.08 * tCrown);
      continue;
    }

    // 1. Foot enclosure under shoes: retract foot & sole surface inward toward foot core
    if (hasShoes && y < 0.088) {
      const sign = x < 0 ? -1 : 1;
      const cx = sign * footCx;
      arr[idx] = cx + (x - cx) * 0.82;
      arr[idx + 1] = Math.max(-0.002, y * 0.94);
      arr[idx + 2] = footCz + (z - footCz) * 0.84;
      continue;
    }

    // 2. Upper torso & shoulder ridge under top / outerwear / dress (exclude neck column and head)
    const armCutUpper = hasOuterwear
      ? (isMale ? 0.32 : 0.28)
      : (y >= 1.30
        ? (isMale ? 0.220 : 0.196)
        : 0.165 + Math.max(0, Math.min(1, (1.12 - y) / 0.40)) * 0.033);
    const maxShoulderY = isMale ? 1.52 : 1.435;
    const minNeckAbsX = isMale ? 0.064 : 0.055;
    if (
      (hasTop || hasOuterwear || hasDress) &&
      y >= 0.90 &&
      y <= maxShoulderY &&
      absX <= armCutUpper &&
      (y <= 1.38 || absX >= minNeckAbsX)
    ) {
      const cz = 0.020;
      arr[idx] = x * 0.88;
      if (y > 1.34 && absX >= minNeckAbsX) {
        arr[idx + 1] = y - 0.012;
      }
      arr[idx + 2] = cz + (z - cz) * 0.85;
      continue;
    }

    // 3. Pelvis, hips, crotch, thighs, knees, and calves under bottom / dress:
    // Use exact anatomical arm-exclusion boundary (0.165 at waist -> 0.198 at hip -> 0.30 below hands)
    // so the outer hip skin is retracted as a single whole unit and never tears into a floating strip.
    const armCutLower = y >= 0.71
      ? 0.165 + Math.max(0, Math.min(1, (1.10 - y) / 0.38)) * 0.033
      : 0.30;
    const minBottomY = hasBottom ? 0.12 : 0.74;
    if ((hasBottom || hasDress) && y >= minBottomY && y <= 1.07 && absX <= armCutLower) {
      const sign = x < 0 ? -1 : 1;
      // Smooth blend at top waist (if no top is worn) and at bottom ankle
      const wTop = (hasTop || hasOuterwear || hasDress)
        ? 1.0
        : Math.max(0, Math.min(1, (1.07 - y) / 0.04));
      const wBot = Math.max(0, Math.min(1, (y - minBottomY) / 0.05));
      const w = wTop * wBot;

      // Above crotch (y >= 0.82), retract toward pelvis center (0, 0.020).
      // Below crotch (y < 0.82), retract each leg toward its own bone axis (sign * legCx, legCz).
      const legBlend = Math.max(0, Math.min(1, (0.82 - y) / 0.08));
      const tLeg = Math.max(0, Math.min(1, (0.80 - y) / 0.66));
      const legCx = isMale
        ? 0.095 + tLeg * (0.145 - 0.095)
        : 0.095 + tLeg * (0.166 - 0.095);
      const legCz = isMale
        ? (y >= 0.52 ? 0.035 : -0.020)
        : (y >= 0.50 ? 0.035 : 0.010);
      const cx = sign * legCx * legBlend;
      const cz = 0.020 * (1 - legBlend) + legCz * legBlend;
      const scale = 1 - 0.22 * w;
      arr[idx] = cx + (x - cx) * scale;
      arr[idx + 2] = cz + (z - cz) * scale;
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals?.();
  return geometry;
}

/**
 * AvatarMesh3D
 * 
 * High-fidelity 3D human avatar mesh rendered in real-world metric coordinates (meters).
 * Stands squarely on the studio pedestal at y = 0, facing +Z towards the camera.
 * Supports dynamic morph targets (height, weight, body shape, hair style/volume)
 * and customized skin tone, hair color/roughness, and modest undergarments.
 */
export default function AvatarMesh3D({
  isMale = false,
  skinColor = '#E0AC69',
  hair = {},
  hairProps: providedHairProps,
  morphInfluences = {},
  height = 170,
  meterScale = true,
  castShadow = true,
  receiveShadow = true,
  groupRef: externalGroupRef,
  footPose = null,
  coveredZones = null,
}) {
  const modelUrl = isMale ? MALE_GLB_URL : FEMALE_GLB_URL;
  const { scene } = useGLTF(modelUrl);
  const internalRef = useRef(null);
  const groupRef = externalGroupRef || internalRef;

  const hairProps = useMemo(() => {
    if (providedHairProps) return providedHairProps;
    return resolveHairProperties(hair, isMale);
  }, [providedHairProps, hair, isMale]);

  // Clone GLTF scene and its materials, immediately applying custom avatar appearance
  // synchronously so Three.js NEVER renders an unstyled default avatar (eliminating the blink).
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => (m ? m.clone() : m));
        } else {
          node.material = node.material.clone();
        }
      }
      if (node.isMesh && node.geometry) {
        node.userData.originalGeometry = node.geometry;
      }
    });

    applyAvatarAppearance(clone, {
      skinColor,
      hairProps,
      isMale,
      morphInfluences,
      castShadow,
      receiveShadow,
    });

    return clone;
  }, [scene, skinColor, hairProps, isMale, morphInfluences, castShadow, receiveShadow]);

  // Heeled footwear & covered-skin retraction: re-pose the feet (heel raised, pivot about
  // the ball of the foot) and retract covered skin zones so skin never bleeds through garments.
  // Works on per-instance geometry copies so the shared GLTF stays untouched.
  useEffect(() => {
    if (!clonedScene) return;
    const hasCoverage = Boolean(
      coveredZones &&
      (coveredZones.hasTop || coveredZones.hasOuterwear || coveredZones.hasDress || coveredZones.hasBottom || coveredZones.hasShoes || coveredZones.hasHeadwear)
    );
    clonedScene.traverse((node) => {
      const original = node.userData?.originalGeometry;
      if (!node.isMesh || !original) return;
      if (node.geometry !== original) {
        node.geometry.dispose?.();
        node.geometry = original;
      }
      if (!footPose?.active && !hasCoverage) return;
      if (!original.boundingBox) original.computeBoundingBox?.();
      // Skip hair/head-only meshes located high above the shoulders unless a hat is worn (crown collision mask)
      if (original.boundingBox && original.boundingBox.min.y > 1.42 && !coveredZones?.hasHeadwear) return;
      let nextGeo = original.clone();
      if (hasCoverage) {
        nextGeo = retractCoveredAvatarSkin(nextGeo, coveredZones, isMale);
      }
      if (footPose?.active && (!original.boundingBox || original.boundingBox.min.y <= 0.2)) {
        nextGeo = poseAvatarGeometry(nextGeo, footPose);
      }
      node.geometry = nextGeo;
    });

    return () => {
      // Clean up cloned geometries when unmounting or dependencies change
      if (!clonedScene) return;
      clonedScene.traverse((node) => {
        const original = node.userData?.originalGeometry;
        if (node.isMesh && node.geometry && node.geometry !== original) {
          node.geometry.dispose?.();
          node.geometry = original;
        }
      });
    };
  }, [clonedScene, footPose, coveredZones, isMale]);

  // Clean up cloned materials and textures upon unmount
  useEffect(() => {
    return () => {
      if (!clonedScene) return;
      clonedScene.traverse((node) => {
        if (node.isMesh) {
          const original = node.userData?.originalGeometry;
          if (node.geometry && node.geometry !== original) {
            node.geometry.dispose?.();
          }
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((m) => m?.dispose?.());
            } else {
              node.material?.dispose?.();
            }
          }
        }
      });
    };
  }, [clonedScene]);

  // Metric scaling and floor positioning
  const transform = useMemo(() => {
    if (!meterScale) {
      return {
        scale: [1, 1, 1],
        position: [0, 0, 0],
      };
    }
    return getAvatarMetricTransform({ isMale, height, morphInfluences });
  }, [height, isMale, morphInfluences, meterScale]);

  // Reactive updates for prop changes (ensures re-rendering when colors or morphs update)
  useEffect(() => {
    if (!clonedScene) return;
    applyAvatarAppearance(clonedScene, {
      skinColor,
      hairProps,
      isMale,
      morphInfluences,
      castShadow,
      receiveShadow,
    });
  }, [clonedScene, skinColor, hairProps, isMale, morphInfluences, castShadow, receiveShadow]);

  if (!clonedScene) return null;

  return (
    <group ref={groupRef} position={transform.position} scale={transform.scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload(MALE_GLB_URL);
useGLTF.preload(FEMALE_GLB_URL);
