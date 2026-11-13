import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { poseAvatarGeometry } from '@/lib/footwearFitting';
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
 * Hides avatar parts that sit fully inside garments WITHOUT reshaping the visible body:
 * underwear under tops/bottoms, hair under hats, feet inside shoes, and leg/pelvis skin
 * under bottoms/dresses. Upper-body garments (tops, outerwear, dress bodices) never deform
 * the avatar: the garment maps to the body, not the other way around.
 */
export function retractCoveredAvatarSkin(geometry, coveredZones = null, isMale = false, meshName = '', materialName = '') {
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
  const isUnderwearMesh = Boolean(
    (materialName && materialName.includes('generic')) ||
    (meshName && (meshName.endsWith('_1') || meshName.includes('generic')))
  );

  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const x = arr[idx];
    const y = arr[idx + 1];
    const z = arr[idx + 2];
    const absX = Math.abs(x);

    // 00. Modest underwear mesh handling:
    // When wearing pants, shorts, skirt, or dress, retract panties deep into the pelvis core
    // so underwear NEVER bleeds through the bottom garment or waistband!
    // When wearing a top or dress, retract bra deep into chest core so it never bleeds through.
    if (isUnderwearMesh) {
      if ((hasBottom || hasDress) && y < 1.12) {
        arr[idx] = x * 0.40;
        arr[idx + 2] = 0.020 + (z - 0.020) * 0.40;
        continue;
      }
      if ((hasTop || hasDress || hasOuterwear) && y >= 1.12) {
        arr[idx] = x * 0.40;
        arr[idx + 2] = 0.020 + (z - 0.020) * 0.40;
        continue;
      }
    }

    // 0. Headwear hair/crown collision mask: subtly depress hair/crown geometry above hat brim
    // so hair never punches through the crown of a hat or cap.
    if (hasHeadwear && y > hatBrimY) {
      const tCrown = Math.min(1.0, (y - hatBrimY) / 0.12);
      arr[idx] = x * (1 - 0.08 * tCrown);
      arr[idx + 1] = y - 0.012 * tCrown;
      arr[idx + 2] = 0.03 + (z - 0.03) * (1 - 0.08 * tCrown);
      continue;
    }

    // 1. Foot, toe, and boot-shaft enclosure under shoes: strongly retract covered foot & toes inward into shoe core,
    // and for boots, retract calf skin within the shaft so skin never pokes through footwear!
    const shoeCollarY = Math.max(0.128, Number(coveredZones?.shoeCollar) || 0.128);
    if (hasShoes && y < shoeCollarY) {
      const sign = x < 0 ? -1 : 1;
      const cx = sign * footCx;
      if (y < 0.088) {
        // Safely compress foot, heel, and toe vertices inside the footwear upper/sole volume
        // Shrink radially toward foot core with vertical compression so vertices never poke through sole, heel, or vamp
        arr[idx] = cx + (x - cx) * 0.15;
        arr[idx + 1] = 0.055 + (y - 0.010) * 0.25;
        arr[idx + 2] = footCz + (z - footCz) * 0.15;
        continue;
      }
      // For ankle boots & tall boots: retract calf / lower leg skin within the boot shaft
      const tShaft = Math.max(0, Math.min(1, (y - 0.088) / Math.max(0.04, shoeCollarY - 0.088)));
      const shaftShrink = 0.35 * (1 - 0.4 * tShaft); // 35% at ankle, 21% at collar
      const legCx = sign * (isMale ? 0.145 : 0.160);
      const legCz = isMale ? 0.025 : 0.035;
      arr[idx] = legCx + (x - legCx) * (1 - shaftShrink);
      arr[idx + 2] = legCz + (z - legCz) * (1 - shaftShrink);
      continue;
    }

    // 2. Upper-body garments (tops, outerwear, dress bodices) NEVER reshape the avatar.
    // The garment maps to the body, not the other way around: torso, neck, shoulders, arms and
    // armpits keep their exact morphed anatomy, and the garment templates carry their own
    // positive skin clearance (Blender BVH clearance + avatar morph field minClearance).

    // 3. Pelvis, hips, crotch, thighs, knees, and calves under bottom / dress:
    // Length-aware vertical cutoff (bottomMinY) keeps bare knees/shins untouched under mini skirts & shorts,
    // while retracting full legs under trousers/jeans so outer thigh & calf skin never pokes through!
    const resolvedBottomMinY = Number.isFinite(coveredZones?.bottomMinY)
      ? coveredZones.bottomMinY
      : (hasBottom ? 0.08 : 0.46);
    const maxBottomY = isMale ? 1.08 : 1.05;
    if ((hasBottom || hasDress) && y >= resolvedBottomMinY && y <= maxBottomY) {
      // Below y = 0.80, hands are out at absX >= 0.36, so ALL vertices with absX <= 0.26 are 100% leg skin!
      const hipCutInner = y < 0.80 ? 0.25 : (isMale ? 0.22 : 0.205);
      const hipCutOuter = y < 0.80 ? 0.31 : (isMale ? 0.29 : 0.27);
      const hipBlend = absX <= hipCutInner
        ? 1.0
        : (absX >= hipCutOuter ? 0.0 : 0.5 * (1 + Math.cos(Math.PI * (absX - hipCutInner) / (hipCutOuter - hipCutInner))));

      if (hipBlend > 1e-4) {
        const sign = x < 0 ? -1 : 1;
        const wBot = (hasBottom && hasShoes) ? 1.0 : Math.max(0, Math.min(1, (y - resolvedBottomMinY) / 0.045));
        const w = wBot * hipBlend;

        // Above crotch (y >= 0.82), retract toward pelvis center (0, 0.020).
        // Below crotch (y < 0.82), retract each leg radially toward its anatomical bone axis (sign * legCx, legCz).
        const legBlend = Math.max(0, Math.min(1, (0.82 - y) / 0.07));
        const tLeg = Math.max(0, Math.min(1, (0.80 - y) / 0.66));
        const legCx = isMale
          ? 0.098 + tLeg * (0.148 - 0.098)
          : 0.096 + tLeg * (0.166 - 0.096);
        // Continuous smooth spline for legCz from hip (0.020) through knee (0.026) down to ankle (0.005) - NO discontinuous step jumps!
        const legCz = isMale
          ? 0.020 + 0.008 * Math.sin(Math.PI * tLeg) - 0.015 * tLeg
          : 0.020 + 0.012 * Math.sin(Math.PI * tLeg) - 0.008 * tLeg;
        const cx = sign * legCx * legBlend;
        const cz = 0.020 * (1 - legBlend) + legCz * legBlend;
        const isKneeZone = y >= 0.40 && y <= 0.60;
        const isInnerThighZone = y >= 0.68 && y <= 0.84;
        const isFrontKnee = isKneeZone && z > cz;
        const isMedialThigh = isInnerThighZone && absX < (legCx * 1.05);

        let shrinkX = 0.15;
        let shrinkZ = 0.16;

        if (isFrontKnee) {
          // Front patella sticks out most in front of pants/trousers: retract deeply in Z and snugly in X!
          shrinkZ = 0.42;
          shrinkX = 0.28;
        } else if (isKneeZone) {
          shrinkZ = 0.28;
          shrinkX = 0.22;
        } else if (isMedialThigh) {
          // Inner thigh skin between the legs: retract toward leg bone axis
          shrinkX = 0.32;
          shrinkZ = 0.24;
        }
        arr[idx] = cx + (x - cx) * (1 - shrinkX * w);
        arr[idx + 2] = cz + (z - cz) * (1 - shrinkZ * w);
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
  const { scene } = useGLTF(modelUrl, '/draco/');
  const internalRef = useRef(null);
  const groupRef = externalGroupRef || internalRef;
  const originalGeomMap = useRef(new WeakMap());

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
        delete node.userData.originalGeometry;
        originalGeomMap.current.set(node, node.geometry);
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
      const original = originalGeomMap.current.get(node);
      if (!node.isMesh || !original) return;
      if (node.geometry !== original) {
        node.geometry.dispose?.();
        node.geometry = original;
      }
      const matName = Array.isArray(node.material)
        ? node.material.map((m) => m?.name).join(' ')
        : (node.material?.name || '');
      const isUnderwearNode = Boolean(
        (matName && matName.includes('generic')) ||
        (node.name && (node.name.endsWith('_1') || node.name.includes('generic')))
      );
      if (isUnderwearNode) {
        const hideUnderwearCompletely = isMale
          ? Boolean(coveredZones?.hasBottom || coveredZones?.hasDress)
          : Boolean(
              coveredZones?.hasDress ||
              (coveredZones?.hasBottom && (coveredZones?.hasTop || coveredZones?.hasOuterwear))
            );
        node.visible = !hideUnderwearCompletely;
        if (hideUnderwearCompletely) return;
      }
      const isNailsNode = Boolean(
        (matName && matName.includes('nails')) ||
        (node.name && node.name.includes('nails'))
      );
      if (isNailsNode && coveredZones?.hasShoes) {
        if (!original.boundingBox) original.computeBoundingBox?.();
        if (original.boundingBox && original.boundingBox.max.y < 0.25) {
          node.visible = false;
          return;
        }
      }
      if (!footPose?.active && !hasCoverage) return;
      if (!original.boundingBox) original.computeBoundingBox?.();
      // Skip hair/head-only meshes located high above the shoulders unless a hat is worn (crown collision mask)
      if (original.boundingBox && original.boundingBox.min.y > 1.42 && !coveredZones?.hasHeadwear) return;
      let nextGeo = original.clone();
      if (hasCoverage) {
        nextGeo = retractCoveredAvatarSkin(nextGeo, coveredZones, isMale, node.name, matName);
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
        const original = originalGeomMap.current.get(node);
        if (node.isMesh && node.geometry && original && node.geometry !== original) {
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
          const original = originalGeomMap.current.get(node);
          if (node.geometry && original && node.geometry !== original) {
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

useGLTF.preload(MALE_GLB_URL, '/draco/');
useGLTF.preload(FEMALE_GLB_URL, '/draco/');
