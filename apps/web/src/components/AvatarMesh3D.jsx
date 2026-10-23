import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveHairProperties } from './DynamicAvatar';

export const MALE_GLB_URL = '/models/avatar_male_1.glb?v=hair3';
export const FEMALE_GLB_URL = '/models/avatar_female_1.glb?v=hair3';

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
}) {
  const modelUrl = isMale ? MALE_GLB_URL : FEMALE_GLB_URL;
  const { scene } = useGLTF(modelUrl);
  const internalRef = useRef(null);
  const groupRef = externalGroupRef || internalRef;

  const hairProps = useMemo(() => {
    if (providedHairProps) return providedHairProps;
    return resolveHairProperties(hair, isMale);
  }, [providedHairProps, hair, isMale]);

  // Clone GLTF scene and its materials so morph targets & colors don't conflict across canvases
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
      }
    });
    return clone;
  }, [scene]);

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

  // Update materials, morph targets, and shadows
  useEffect(() => {
    if (!clonedScene) return;

    const rawSkin = skinColor || '#E0AC69';
    const activeSkin = String(rawSkin).trim().toLowerCase() === '#9ca3af' ? '#E0AC69' : rawSkin;
    const skinThreeColor = new THREE.Color(activeSkin);
    const nailColor = skinThreeColor.clone().lerp(new THREE.Color('#F5CAC3'), 0.35);
    const activeHairColor = hairProps?.color || (isMale ? '#181412' : '#3B2316');
    const activeHairRoughness = hairProps?.roughness ?? (isMale ? 0.48 : 0.38);
    const activeHairMetalness = hairProps?.metalness ?? 0.04;

    clonedScene.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = castShadow;
      node.receiveShadow = receiveShadow;

      const mat = node.material;
      if (mat) {
        const matName = String(mat.name || '').toLowerCase();
        if (matName.includes('skin')) {
          mat.color.copy(skinThreeColor);
          mat.roughness = 0.52;
          mat.metalness = 0.04;
          mat.needsUpdate = true;
        } else if (matName.includes('nails')) {
          mat.color.copy(nailColor);
          mat.roughness = 0.35;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        } else if (matName.includes('generic')) {
          // Modest studio activewear bra & briefs set (chic graphite charcoal with soft matte fabric finish)
          mat.color.set('#20242C');
          mat.roughness = 0.68;
          mat.metalness = 0.04;
          mat.needsUpdate = true;
        } else if (matName.includes('cornea')) {
          mat.transparent = true;
          mat.opacity = 0.18;
          mat.roughness = 0.05;
          mat.depthWrite = false;
          mat.needsUpdate = true;
        } else if (matName.includes('iris')) {
          mat.color.set('#4A6B82');
          mat.roughness = 0.15;
          mat.needsUpdate = true;
        } else if (matName.includes('pupil')) {
          mat.color.set('#090A0F');
          mat.roughness = 0.1;
          mat.needsUpdate = true;
        } else if (matName.includes('human_eyes')) {
          mat.color.set('#F8FAFC');
          mat.roughness = 0.15;
          mat.needsUpdate = true;
        } else if (matName.includes('eyelash')) {
          mat.color.set('#1E1B18');
          mat.transparent = true;
          mat.opacity = 0.85;
          mat.needsUpdate = true;
        } else if (matName.includes('hair')) {
          mat.color.set(activeHairColor);
          mat.roughness = activeHairRoughness;
          mat.metalness = activeHairMetalness;
          mat.needsUpdate = true;
        } else if (matName.includes('teeth')) {
          mat.color.set('#F8F5F0');
          mat.roughness = 0.2;
          mat.needsUpdate = true;
        } else if (matName.includes('tongue')) {
          mat.color.set('#B85D65');
          mat.roughness = 0.5;
          mat.needsUpdate = true;
        }
      }

      // Apply body and hair morph target influences
      const dict = node.morphTargetDictionary;
      const influences = node.morphTargetInfluences;
      if (dict && influences && morphInfluences) {
        for (let i = 0; i < influences.length; i += 1) {
          influences[i] = 0;
        }
        Object.entries(morphInfluences).forEach(([targetName, val]) => {
          const idx = dict[targetName] ?? dict[`${targetName} `];
          if (idx !== undefined && idx < influences.length) {
            influences[idx] = val;
          }
        });
      }
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
