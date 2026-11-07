import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { poseAvatarGeometry } from '@/lib/footwearFit';
import * as THREE from 'three';
import { resolveHairProperties, applyAvatarAppearance } from './DynamicAvatar';

export { applyAvatarAppearance };

export const MALE_GLB_URL = '/models/avatar_male_1.glb?v=mblab4';
export const FEMALE_GLB_URL = '/models/avatar_female_1.glb?v=mblab4';

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

    // 2. Upper torso, deltoid shoulders & underarm under top / outerwear / dress (exclude neck column and head)
    const maxShoulderY = isMale ? 1.52 : 1.435;
    const minNeckAbsX = isMale ? 0.060 : 0.052;
    const minTorsoY = hasBottom || hasDress ? 0.76 : 0.65;
    if (
      (hasTop || hasOuterwear || hasDress) &&
      y >= minTorsoY &&
      y <= maxShoulderY &&
      (y <= 1.38 || absX >= minNeckAbsX)
    ) {
      const armCutInner = isMale ? 0.22 : 0.20;
      const armCutOuter = isMale ? 0.32 : 0.29;
      const armBlend = absX <= armCutInner
        ? 1.0
        : (absX >= armCutOuter ? 0.0 : 0.5 * (1 + Math.cos(Math.PI * (absX - armCutInner) / (armCutOuter - armCutInner))));

      if (armBlend > 1e-4) {
        const cz = 0.020;
        const wVertical = hasBottom || hasDress ? 1.0 : Math.max(0, Math.min(1, (y - minTorsoY) / 0.08));
        const wTorso = wVertical * armBlend;
        arr[idx] = x * (1 - 0.030 * wTorso);
        if (y > 1.34 && absX >= minNeckAbsX) {
          arr[idx + 1] = y - 0.005 * wTorso;
        }
        arr[idx + 2] = cz + (z - cz) * (1 - 0.035 * wTorso);
      }
    }

    // 2b. Upper arm, bicep & underarm under top / outerwear / dress with sleeves:
    // Retract covered arm skin radially toward the anatomical arm bone axis so inner arm
    // and underarm skin never poke through sleeve seams or armpit cloth!
    const isSleeveless = Boolean(coveredZones?.isSleeveless);
    if ((hasTop || hasOuterwear || hasDress) && !isSleeveless) {
      const yArmMin = isMale ? 1.015 : 0.956;
      const yArmMax = isMale ? 1.48 : 1.42;
      const armCutInner = isMale ? 0.22 : 0.19;
      const armCutOuter = isMale ? 0.32 : 0.29;
      if (y >= yArmMin && y <= yArmMax && absX >= armCutInner) {
        const sign = x < 0 ? -1 : 1;
        const xSh = isMale ? 0.220 : 0.192;
        const ySh = isMale ? 1.480 : 1.420;
        const zSh = isMale ? -0.004 : 0.012;
        const xWr = isMale ? 0.435 : 0.374;
        const yWr = isMale ? 1.015 : 0.956;
        const zWr = isMale ? 0.029 : 0.029;

        const tArm = Math.max(0, Math.min(1, (ySh - y) / Math.max(0.01, ySh - yWr)));
        const armBoneX = sign * (xSh + tArm * (xWr - xSh));
        const armBoneZ = zSh + tArm * (zWr - zSh);

        // Smooth cosine falloff near the wrist hem so bare hands/wrists transition seamlessly
        const tWristFalloff = Math.max(0, Math.min(1, (y - yArmMin) / 0.04));
        const sWrist = tWristFalloff * tWristFalloff * (3 - 2 * tWristFalloff);

        const dxBone = x - armBoneX;
        const dzBone = z - armBoneZ;
        const rBone = Math.hypot(dxBone, dzBone);
        if (rBone > 0.002) {
          const tArmBlend = Math.min(1.0, Math.max(0.0, (absX - armCutInner) / (armCutOuter - armCutInner)));
          const shrink = 0.045 * sWrist * tArmBlend;
          arr[idx] = armBoneX + dxBone * (1 - shrink);
          arr[idx + 2] = armBoneZ + dzBone * (1 - shrink);
        }
      }
    }

    // 3. Pelvis, hips, crotch, thighs, knees, and calves under bottom / dress / top:
    // Smooth lateral cosine falloff eliminates thigh/hip skin poking through tunics, dresses or bottoms.
    const minBottomY = hasBottom ? 0.12 : (hasDress || hasTop ? 0.60 : 0.74);
    const maxBottomY = isMale ? 1.10 : 1.07;
    if ((hasBottom || hasDress || hasTop) && y >= minBottomY && y <= maxBottomY) {
      const hipCutInner = isMale ? 0.19 : 0.18;
      const hipCutOuter = isMale ? 0.29 : 0.27;
      const hipBlend = absX <= hipCutInner
        ? 1.0
        : (absX >= hipCutOuter ? 0.0 : 0.5 * (1 + Math.cos(Math.PI * (absX - hipCutInner) / (hipCutOuter - hipCutInner))));

      if (hipBlend > 1e-4) {
        const sign = x < 0 ? -1 : 1;
        const wTop = (hasTop || hasOuterwear || hasDress)
          ? 1.0
          : Math.max(0, Math.min(1, (maxBottomY - y) / 0.04));
        const wBot = Math.max(0, Math.min(1, (y - minBottomY) / 0.05));
        const w = wTop * wBot * hipBlend;

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
        const scale = 1 - 0.030 * w;
        arr[idx] = cx + (x - cx) * scale;
        arr[idx + 2] = cz + (z - cz) * scale;
      }
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
