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
      if (y < 0.088) {
        // Complete collapse of all foot, heel, and toe vertices into ankle core inside footwear sole/upper
        const cx = sign * footCx;
        arr[idx] = cx;
        arr[idx + 1] = 0.085;
        arr[idx + 2] = footCz;
        continue;
      }
      // For ankle boots & tall boots: retract calf / lower leg skin within the boot shaft
      const tShaft = Math.max(0, Math.min(1, (y - 0.088) / Math.max(0.04, shoeCollarY - 0.088)));
      const shaftShrink = 0.28 * (1 - 0.5 * tShaft); // 28% at ankle, 14% at collar
      const legCx = sign * (isMale ? 0.145 : 0.160);
      const legCz = isMale ? 0.025 : 0.035;
      arr[idx] = legCx + (x - legCx) * (1 - shaftShrink);
      arr[idx + 2] = legCz + (z - legCz) * (1 - shaftShrink);
      continue;
    }

    // 2. Upper torso, deltoid shoulders & underarm under top / outerwear / dress (exclude neck column and head)
    const isStrapless = Boolean(coveredZones?.isStrapless);
    const maxShoulderY = isStrapless ? (isMale ? 1.34 : 1.28) : (isMale ? 1.52 : 1.435);
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
        arr[idx] = x * (1 - 0.075 * wTorso);
        if (y > 1.34 && absX >= minNeckAbsX) {
          arr[idx + 1] = y - 0.008 * wTorso;
        }
        arr[idx + 2] = cz + (z - cz) * (1 - 0.080 * wTorso);
      }
    }

    // 2b. Upper arm, bicep & underarm under top / outerwear / dress with sleeves:
    // Retract covered arm skin radially toward the anatomical arm bone axis so inner arm
    // and underarm skin never poke through sleeve seams or armpit cloth!
    const isSleeveless = Boolean(coveredZones?.isSleeveless);
    if ((hasTop || hasOuterwear || hasDress) && !isSleeveless) {
      const yArmMin = isMale ? 0.995 : 0.925;
      const yArmMax = isMale ? 1.48 : 1.42;
      const armCutInner = isMale ? 0.20 : 0.175;
      const armCutOuter = isMale ? 0.30 : 0.27;
      if (y >= yArmMin && y <= yArmMax && absX >= armCutInner) {
        const sign = x < 0 ? -1 : 1;
        const xSh = isMale ? 0.215 : 0.188;
        const ySh = isMale ? 1.460 : 1.400;
        const zSh = isMale ? -0.004 : 0.010;
        const xWr = isMale ? 0.425 : 0.372;
        const yWr = isMale ? 1.035 : 0.960;
        const zWr = isMale ? 0.018 : 0.010;

        const tArm = Math.max(0, Math.min(1, (ySh - y) / Math.max(0.01, ySh - yWr)));
        const armBoneX = sign * (xSh + tArm * (xWr - xSh));
        const armBoneZ = zSh + tArm * (zWr - zSh);

        // Smooth cosine falloff near the sleeve cuff / wrist hem so bare hands/wrists transition seamlessly
        const sleeveMaxAbsX = Number.isFinite(coveredZones?.sleeveMaxX)
          ? coveredZones.sleeveMaxX
          : (isMale ? 0.43 : 0.38);
        const tXFalloff = Math.max(0, Math.min(1, (sleeveMaxAbsX - absX) / 0.045));
        const tWristFalloff = Math.max(0, Math.min(1, (y - yArmMin) / 0.04)) * tXFalloff;
        const sWrist = tWristFalloff * tWristFalloff * (3 - 2 * tWristFalloff);

        const dxBone = x - armBoneX;
        const dzBone = z - armBoneZ;
        const rBone = Math.hypot(dxBone, dzBone);
        if (rBone > 0.002 && sWrist > 0) {
          const tArmBlend = Math.min(1.0, Math.max(0.0, (absX - armCutInner) / (armCutOuter - armCutInner)));
          const shrink = 0.095 * sWrist * tArmBlend;
          arr[idx] = armBoneX + dxBone * (1 - shrink);
          arr[idx + 2] = armBoneZ + dzBone * (1 - shrink);
        }
      }
    }

    // 2c. Dedicated axilla / armpit crease retraction under sleeved garments:
    // Retracts underarm skin fold deep into the torso core so armpit skin NEVER pokes
    // through sleeve seams or the underarm fabric fold!
    if ((hasTop || hasOuterwear || hasDress) && !isSleeveless) {
      const yAxillaMin = isMale ? 1.13 : 1.09;
      const yAxillaMax = isMale ? 1.40 : 1.35;
      const xAxillaMin = isMale ? 0.09 : 0.07;
      const xAxillaMax = isMale ? 0.30 : 0.26;
      if (y >= yAxillaMin && y <= yAxillaMax && absX >= xAxillaMin && absX <= xAxillaMax) {
        const tY = Math.sin(Math.PI * (y - yAxillaMin) / (yAxillaMax - yAxillaMin));
        const tX = Math.sin(Math.PI * (absX - xAxillaMin) / (xAxillaMax - xAxillaMin));
        const wAxilla = Math.sqrt(Math.max(0, tY * tX));
        const cz = 0.015;
        // Pull inward in X toward centerline, slightly up into shoulder socket, and toward torso core in Z
        arr[idx] = arr[idx] * (1 - 0.22 * wAxilla);
        arr[idx + 1] = arr[idx + 1] + 0.018 * wAxilla;
        arr[idx + 2] = cz + (arr[idx + 2] - cz) * (1 - 0.20 * wAxilla);
      }
    }

    // 2d. Upper back / cervical spine skin under crew neck / collar:
    if ((hasTop || hasOuterwear || hasDress) && !isStrapless) {
      const yNeckMin = isMale ? 1.38 : 1.34;
      const yNeckMax = isMale ? 1.52 : 1.46;
      if (y >= yNeckMin && y <= yNeckMax && absX <= 0.085 && z < 0.030) {
        const wNeck = Math.sin(Math.PI * (y - yNeckMin) / (yNeckMax - yNeckMin));
        arr[idx + 2] = arr[idx + 2] + 0.010 * wNeck;
        arr[idx] = arr[idx] * (1 - 0.08 * wNeck);
      }
    }

    // 3. Pelvis, hips, crotch, thighs, knees, and calves under bottom / dress / top:
    // Length-aware vertical cutoff (bottomMinY) keeps bare knees/shins untouched under mini skirts & shorts,
    // while retracting full legs under trousers/jeans so outer thigh & calf skin never pokes through!
    const resolvedBottomMinY = Number.isFinite(coveredZones?.bottomMinY)
      ? coveredZones.bottomMinY
      : (hasBottom ? 0.11 : (hasDress ? 0.46 : 0.86));
    const minBottomY = (hasBottom || hasDress) ? resolvedBottomMinY : 0.86;
    const maxBottomY = isMale ? 1.08 : 1.05;
    if ((hasBottom || hasDress || hasTop) && y >= minBottomY && y <= maxBottomY) {
      // Below y = 0.80, hands are out at absX >= 0.36, so ALL vertices with absX <= 0.26 are 100% leg skin!
      const hipCutInner = y < 0.80 ? 0.25 : (isMale ? 0.22 : 0.205);
      const hipCutOuter = y < 0.80 ? 0.31 : (isMale ? 0.29 : 0.27);
      const hipBlend = absX <= hipCutInner
        ? 1.0
        : (absX >= hipCutOuter ? 0.0 : 0.5 * (1 + Math.cos(Math.PI * (absX - hipCutInner) / (hipCutOuter - hipCutInner))));

      if (hipBlend > 1e-4) {
        const sign = x < 0 ? -1 : 1;
        const wTop = (hasBottom || hasDress || hasTop || hasOuterwear)
          ? 1.0
          : Math.max(0, Math.min(1, (maxBottomY - y) / 0.04));
        const wBot = Math.max(0, Math.min(1, (y - minBottomY) / 0.045));
        const w = wTop * wBot * hipBlend;

        // Above crotch (y >= 0.82), retract toward pelvis center (0, 0.020).
        // Below crotch (y < 0.82), retract each leg radially toward its anatomical bone axis (sign * legCx, legCz).
        const legBlend = Math.max(0, Math.min(1, (0.82 - y) / 0.07));
        const tLeg = Math.max(0, Math.min(1, (0.80 - y) / 0.66));
        const legCx = isMale
          ? 0.098 + tLeg * (0.148 - 0.098)
          : 0.096 + tLeg * (0.166 - 0.096);
        const legCz = isMale
          ? (y >= 0.52 ? 0.032 : -0.022)
          : (y >= 0.50 ? 0.034 : 0.010);
        const cx = sign * legCx * legBlend;
        const cz = 0.020 * (1 - legBlend) + legCz * legBlend;
        const isLegOrBottom = hasBottom || hasDress;
        const isKneeZone = y >= 0.40 && y <= 0.60;
        const isInnerThighZone = y >= 0.68 && y <= 0.84;
        const isFrontKnee = isKneeZone && z > cz;
        const isMedialThigh = isInnerThighZone && absX < (legCx * 1.05);

        let shrinkX = isLegOrBottom ? 0.15 : 0.055;
        let shrinkZ = isLegOrBottom ? 0.16 : 0.055;

        if (isLegOrBottom) {
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

useGLTF.preload(MALE_GLB_URL, '/draco/');
useGLTF.preload(FEMALE_GLB_URL, '/draco/');
