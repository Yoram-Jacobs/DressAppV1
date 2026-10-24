import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { poseAvatarGeometry } from '@/lib/footwearFit';
import * as THREE from 'three';
import { resolveHairProperties, applyAvatarAppearance } from './DynamicAvatar';

export { applyAvatarAppearance };

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
  footPose = null,
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

  // Heeled footwear: re-pose the feet (heel raised, pivot about the ball of the foot).
  // Works on per-instance geometry copies so the shared GLTF stays untouched.
  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.traverse((node) => {
      const original = node.userData?.originalGeometry;
      if (!node.isMesh || !original) return;
      if (node.geometry !== original) {
        node.geometry.dispose?.();
        node.geometry = original;
      }
      if (!footPose?.active) return;
      if (!original.boundingBox) original.computeBoundingBox?.();
      if (original.boundingBox && original.boundingBox.min.y > 0.2) return;
      node.geometry = poseAvatarGeometry(original.clone(), footPose);
    });
  }, [clonedScene, footPose]);

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
