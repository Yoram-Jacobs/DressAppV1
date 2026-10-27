import React, { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { userStore } from '@/lib/api';
import {
  X,
  RotateCw,
  Sparkles,
  Eye,
  EyeOff,
  User,
  Shirt,
  Footprints,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AvatarMesh3D, { getAvatarMetricTransform } from './AvatarMesh3D';
import GarmentMesh3D, {
  normalizeGarmentRole,
  resolveGarmentRenderOrder,
  resolveGarmentMetadataText,
} from './GarmentMesh3D';
import { computeMorphInfluences, resolveHairProperties } from './DynamicAvatar';
import { resolveEffectiveGarmentUrl } from '@/lib/itemImage';
import { closetStore } from '@/lib/closetStore';
import { resolveFootwearSpec, computeFootPose } from '@/lib/footwearFit';

// ─── Creamy Boutique Studio Pedestal & Room ───
function StudioPedestal() {
  return (
    <group position={[0, 0, 0]}>
      {/* Soft warm contact shadow on floor */}
      <ContactShadows
        opacity={0.42}
        scale={2.6}
        blur={1.8}
        far={1.4}
        resolution={512}
        color="#3A3226"
        position={[0, 0.001, 0]}
      />

      {/* Main Alabaster / Warm Ivory Dais */}
      <mesh position={[0, -0.026, 0]} receiveShadow>
        <cylinderGeometry args={[0.84, 0.88, 0.05, 64]} />
        <meshStandardMaterial
          color="#F5F2EB"
          roughness={0.40}
          metalness={0.06}
        />
      </mesh>

      {/* Polished Champagne Gold Rim Ring */}
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.815, 0.842, 64]} />
        <meshStandardMaterial
          color="#C5A880"
          roughness={0.22}
          metalness={0.78}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Gentle studio cyclorama floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.027, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#FAF7F2" roughness={0.88} />
      </mesh>

      {/* Subtle warm rear cyclorama studio wall */}
      <mesh position={[0, 2.5, -2.5]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#FAF8F5" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ─── Camera Controller & Animated Transitions ───
export const GARMENT_CAMERA_TARGETS = {
  shoes: { target: [0, 0.12, 0], pos: [0, 0.32, 0.95] },
  bottom: { target: [0, 0.60, 0], pos: [0, 0.70, 1.95] },
  top: { target: [0, 1.16, 0], pos: [0, 1.20, 1.65] },
  outerwear: { target: [0, 1.00, 0], pos: [0, 1.05, 2.05] },
  dress: { target: [0, 0.98, 0], pos: [0, 1.02, 2.10] },
  necktie: { target: [0, 1.25, 0], pos: [0, 1.28, 1.15] },
  belt: { target: [0, 1.05, 0], pos: [0, 1.08, 1.15] },
  watch: { target: [0.24, 0.90, 0.05], pos: [0.35, 0.96, 0.85] },
  headwear: { target: [0, 1.66, 0], pos: [0, 1.70, 0.95] },
  glasses: { target: [0, 1.58, 0], pos: [0, 1.60, 0.85] },
  bag: { target: [-0.24, 0.82, 0.04], pos: [-0.30, 0.88, 1.20] },
  accessory: { target: [0, 1.15, 0], pos: [0, 1.20, 1.25] },
  full: { target: [0, 0.95, 0], pos: [0, 1.05, 2.5] },
};

function CameraController({
  cameraPreset,
  setCameraPreset,
  controlsRef,
  activeGarmentSlot,
  showAvatar,
  initialTarget,
  onUserInteraction,
}) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(0, 1.05, 2.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0.95, 0));
  const frameCount = useRef(0);

  // Initialize controls target once on mount
  useEffect(() => {
    if (controlsRef?.current && initialTarget) {
      controlsRef.current.target.set(...initialTarget);
      controlsRef.current.update();
    }
  }, [controlsRef, initialTarget]);

  // When user interacts with OrbitControls (starts dragging / rotating / pinching),
  // instantly release programmatic animation so drag-to-rotate is completely uninhibited.
  useEffect(() => {
    const controls = controlsRef?.current;
    if (!controls) return;
    const handleUserStart = () => {
      setCameraPreset(null);
      onUserInteraction?.();
    };
    controls.addEventListener('start', handleUserStart);
    return () => {
      controls.removeEventListener('start', handleUserStart);
    };
  }, [controlsRef, setCameraPreset, onUserInteraction]);

  useEffect(() => {
    if (!cameraPreset) return;
    frameCount.current = 0;

    const currentTarget = controlsRef?.current ? controlsRef.current.target : targetLookAt.current;

    if (cameraPreset === 'full') {
      targetCamPos.current.set(0, 1.05, 2.5);
      targetLookAt.current.set(0, 0.95, 0);
    } else if (cameraPreset === 'upper') {
      targetCamPos.current.set(0, 1.35, 1.35);
      targetLookAt.current.set(0, 1.30, 0);
    } else if (cameraPreset === 'lower') {
      targetCamPos.current.set(0, 0.45, 1.35);
      targetLookAt.current.set(0, 0.35, 0);
    } else if (cameraPreset === 'garment' || cameraPreset === 'item') {
      const slotConfig = GARMENT_CAMERA_TARGETS[activeGarmentSlot] || GARMENT_CAMERA_TARGETS.full;
      targetCamPos.current.set(...slotConfig.pos);
      targetLookAt.current.set(...slotConfig.target);
    } else if (cameraPreset === 'back' || cameraPreset === 'side') {
      // Orbit around the current target or the model center
      const cy = currentTarget.y || 0.95;
      const base = (!showAvatar && GARMENT_CAMERA_TARGETS[activeGarmentSlot])
        ? GARMENT_CAMERA_TARGETS[activeGarmentSlot]
        : { target: [0, cy, 0], pos: [0, camera.position.y || 1.05, 2.5] };
      const px = camera.position.x || base.pos[0];
      const py = camera.position.y || base.pos[1];
      const pz = camera.position.z || base.pos[2];
      const tx = currentTarget.x ?? base.target[0];
      const ty = cy;
      const tz = currentTarget.z ?? base.target[2];
      const dist = Math.max(1.2, Math.hypot(px - tx, pz - tz) || 2.5);
      if (cameraPreset === 'back') {
        targetCamPos.current.set(tx, py, tz - dist);
      } else {
        targetCamPos.current.set(tx + dist, py, tz);
      }
      targetLookAt.current.set(tx, ty, tz);
    } else if (cameraPreset === 'reset') {
      if (!showAvatar && activeGarmentSlot) {
        const slotConfig = GARMENT_CAMERA_TARGETS[activeGarmentSlot] || GARMENT_CAMERA_TARGETS.full;
        targetCamPos.current.set(...slotConfig.pos);
        targetLookAt.current.set(...slotConfig.target);
      } else {
        targetCamPos.current.set(0, 1.05, 2.5);
        targetLookAt.current.set(0, 0.95, 0);
      }
    }
  }, [cameraPreset, activeGarmentSlot, showAvatar, controlsRef, camera]);

  useFrame((_, delta) => {
    if (!cameraPreset) return;
    frameCount.current += 1;
    const lerpSpeed = Math.min(1, delta * 6);
    // Orbit around the look-at point (azimuth + radius + height) instead of cutting
    // straight through the model when moving between front / side / back views.
    const look = targetLookAt.current;
    const cx = camera.position.x - look.x;
    const cz = camera.position.z - look.z;
    const dxT = targetCamPos.current.x - look.x;
    const dzT = targetCamPos.current.z - look.z;
    const a0 = Math.atan2(cx, cz);
    const a1 = Math.atan2(dxT, dzT);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const r0 = Math.hypot(cx, cz);
    const r1 = Math.hypot(dxT, dzT);
    const a = a0 + da * lerpSpeed;
    const r = r0 + (r1 - r0) * lerpSpeed;
    camera.position.set(
      look.x + Math.sin(a) * r,
      camera.position.y + (targetCamPos.current.y - camera.position.y) * lerpSpeed,
      look.z + Math.cos(a) * r
    );

    if (controlsRef?.current) {
      controlsRef.current.target.lerp(targetLookAt.current, lerpSpeed);
      controlsRef.current.update();
    }

    const distToTarget = camera.position.distanceTo(targetCamPos.current);
    if (distToTarget < 0.05 || frameCount.current > 45) {
      if (distToTarget < 0.12) {
        camera.position.copy(targetCamPos.current);
      }
      if (controlsRef?.current) {
        controlsRef.current.target.copy(targetLookAt.current);
        controlsRef.current.update();
      }
      setCameraPreset(null);
    }
  });

  return null;
}

const EMPTY_OBJ = Object.freeze({});

/**
 * DressingRoom3D
 * 
 * Interactive 3D Try-On Studio where the user's customized avatar wears their outfit pieces
 * with 360° orbit rotation, creamy white boutique studio walls, contact shadows,
 * clickable garment rack cards, and individual layer toggling.
 */
export default function DressingRoom3D({
  open,
  isOpen,
  onOpenChange,
  onClose,
  outfit = null,
  outfitItems,
  garments,
  profile = {},
  measurements: propMeasurements,
  sex: propSex,
  skinColor: propSkinColor,
  hair: propHair,
  shapeParams: propShapeParams,
  initialShowAvatar,
  showAvatar: controlledShowAvatar,
  onToggleAvatar,
  focusedSlot,
  standaloneMode = false,
  onItemClick,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isDialogOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const handleOpenChange = useCallback(
    (val) => {
      onOpenChange?.(val);
      if (!val) {
        onClose?.();
      }
    },
    [onOpenChange, onClose]
  );

  const { user } = useAuth?.() || {};
  const storedUser = user || userStore?.get?.() || EMPTY_OBJ;
  const effectiveProfile = profile || storedUser?.profile || storedUser || EMPTY_OBJ;

  const activeItems = garments || outfitItems || EMPTY_OBJ;
  const activeMeasurements = propMeasurements || effectiveProfile?.measurements || effectiveProfile?.body_measurements || storedUser?.body_measurements || storedUser?.measurements || EMPTY_OBJ;
  const activeSex = propSex || effectiveProfile?.gender || effectiveProfile?.sex || effectiveProfile?.gender_identity || storedUser?.gender || storedUser?.sex || activeMeasurements?.gender || 'female';
  const activeSkinColor = propSkinColor || effectiveProfile?.skin_tone || effectiveProfile?.skinColor || storedUser?.skin_tone || '#E0AC69';
  const activeHair = propHair || effectiveProfile?.hair || storedUser?.hair || EMPTY_OBJ;
  const activeShapeParams = propShapeParams || effectiveProfile?.shape_params || effectiveProfile?.shapeParams || storedUser?.avatar_shape_params || EMPTY_OBJ;

  const isMale = String(activeSex || activeMeasurements?.gender || '').toLowerCase() === 'male';

  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraPreset, setCameraPreset] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({});
  const [showRack, setShowRack] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? false : true));
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [internalShowAvatar, setInternalShowAvatar] = useState(
    initialShowAvatar !== undefined ? Boolean(initialShowAvatar) : (standaloneMode ? false : true)
  );
  const showAvatar = controlledShowAvatar !== undefined ? controlledShowAvatar : internalShowAvatar;

  const handleToggleAvatar = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setAutoRotate(false);
    const nextVal = !showAvatar;
    if (controlledShowAvatar === undefined) {
      setInternalShowAvatar(nextVal);
    }
    onToggleAvatar?.(nextVal);
    if (!nextVal) {
      setCameraPreset('garment');
    } else {
      setCameraPreset('full');
    }
  }, [showAvatar, controlledShowAvatar, onToggleAvatar]);

  const controlsRef = useRef(null);
  const containerRef = useRef(null);

  // Parents (e.g. ItemDetail) rebuild the items object on every render. Key the
  // normalized garments on a content signature so the 3D scene is not re-created
  // (and suspended Canvas mounts are not restarted) by unrelated re-renders.
  const itemsSignature = Object.entries(activeItems || {})
    .map(([k, v]) => (v && typeof v === 'object'
      ? [
          k,
          v.id,
          v.group_id,
          v.url,
          v.image_url,
          v.clean_image_url,
          v.category,
          v.sub_category,
          v.subcategory,
          v.item_type,
          v.title,
          v.name,
          v.caption,
          v.description,
          v.material,
          v.fabric,
          v.fit,
          v.cut,
          v.length,
          v.pattern,
          v.heel_height,
          v.sole_type,
          (v.view_urls || []).join(','),
          (v.group_members || []).map((m) => m?.id).join(','),
        ].join('~')
      : `${k}~${v}`))
    .join('|');
  const activeItemsRef = useRef(activeItems);
  activeItemsRef.current = activeItems;

  // Normalize active garment items from outfit / outfitItems / garments
  const activeGarments = useMemo(() => {
    const list = [];
    const entries = Object.entries(activeItemsRef.current || {});
    const allClosetItems = (closetStore?.getSnapshot?.()?.items || []).filter(Boolean);

    entries.forEach(([slotKey, item]) => {
      if (!item) return;
      const g = typeof item === 'object' ? item : { id: item, slot: slotKey };
      if (!g.url && !g.image_url && !g.clean_image_url) return;
      const metaText = resolveGarmentMetadataText(g);
      const normSlot = normalizeGarmentRole(
        slotKey,
        g.category,
        metaText || g.name || g.title || g.sub_category || g.subcategory || g.item_type
      );
      const frontUrl = resolveEffectiveGarmentUrl(g) || g.url || g.image_url;

      // Item group: every other photo of the same garment (back / side views) removes the guesswork
      const extraViews = [];
      const seenViews = new Set([frontUrl]);
      const pushView = (u) => {
        if (!u) return;
        const resolved = typeof u === 'string'
          ? u
          : (resolveEffectiveGarmentUrl(u) || u.clean_image_url || u.url || u.image_url);
        if (resolved && !seenViews.has(resolved)) {
          seenViews.add(resolved);
          extraViews.push(resolved);
        }
      };
      (Array.isArray(g.view_urls) ? g.view_urls : []).forEach(pushView);
      (Array.isArray(g.additional_images) ? g.additional_images : []).forEach(pushView);
      (Array.isArray(g.images) ? g.images : []).forEach(pushView);
      (Array.isArray(g.views) ? g.views : []).forEach(pushView);
      (Array.isArray(g.pov_images) ? g.pov_images : []).forEach(pushView);
      (Array.isArray(g.angles) ? g.angles : []).forEach(pushView);
      if (g.back_image_url) pushView(g.back_image_url);
      if (g.back_view_url) pushView(g.back_view_url);
      if (g.rear_image_url) pushView(g.rear_image_url);
      if (g.side_image_url) pushView(g.side_image_url);
      if (g.side_view_url) pushView(g.side_view_url);
      if (g.profile_image_url) pushView(g.profile_image_url);
      (Array.isArray(g.group_members) ? g.group_members : []).forEach((m) => {
        if (!m || m.id === g.id) return;
        pushView(m);
      });
      (Array.isArray(g.group_items) ? g.group_items : []).forEach((m) => {
        if (!m || m.id === g.id) return;
        pushView(m);
      });

      // Also check closetStore for item group siblings with the same garment role/category
      const itemId = g.id || g._id || g.closet_item_id;
      const closetMatch = itemId
        ? allClosetItems.find((it) => (it.id || it._id) === itemId)
        : null;
      if (closetMatch) {
        (Array.isArray(closetMatch.view_urls) ? closetMatch.view_urls : []).forEach(pushView);
        (Array.isArray(closetMatch.additional_images) ? closetMatch.additional_images : []).forEach(pushView);
        if (closetMatch.back_image_url) pushView(closetMatch.back_image_url);
        if (closetMatch.side_image_url) pushView(closetMatch.side_image_url);
      }
      const effectiveGroupId = g.group_id || closetMatch?.group_id;
      if (effectiveGroupId && allClosetItems.length > 0) {
        allClosetItems.forEach((sibling) => {
          const sibId = sibling.id || sibling._id;
          if (!sibling || sibId === itemId) return;
          if (sibling.group_id !== effectiveGroupId && sibId !== effectiveGroupId) return;
          const sibSlot = normalizeGarmentRole(
            sibling.category || slotKey,
            sibling.category,
            resolveGarmentMetadataText(sibling) || sibling.name || sibling.title || sibling.sub_category || sibling.item_type
          );
          if (sibSlot === normSlot) {
            pushView(sibling);
          }
        });
      }

      list.push({
        slot: normSlot,
        id: g.id || slotKey,
        name: g.name || g.title || g.caption || slotKey,
        url: frontUrl,
        category: g.category || slotKey,
        sub_category: g.sub_category || g.subcategory || '',
        subcategory: g.subcategory || g.sub_category || '',
        item_type: g.item_type || '',
        caption: g.caption || g.description || '',
        description: g.description || g.caption || '',
        material: g.material || g.fabric || '',
        fabric: g.fabric || g.material || '',
        fit: g.fit || g.cut || '',
        cut: g.cut || g.fit || '',
        length: g.length || '',
        pattern: g.pattern || '',
        heel_height: g.heel_height,
        sole_type: g.sole_type,
        extraViews,
        rawItem: g,
      });
    });

    // Sort active garments in physical real-world overlay order:
    // bottom (6) -> top (8) -> dress (9) -> belt (10) -> necktie (11) -> outerwear (12) -> shoes (14) -> watch/accessory (15)
    list.sort((a, b) => resolveGarmentRenderOrder(a.slot) - resolveGarmentRenderOrder(b.slot));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature]);

  // Worn footwear drives the foot pose (heels) and lifts the whole figure off the floor
  const footPose = useMemo(() => {
    const shoe = activeGarments.find((g) => g.slot === 'shoes' && (layerVisibility[g.slot] ?? true));
    if (!shoe) return null;
    const spec = resolveFootwearSpec(shoe);
    return computeFootPose(isMale, spec.heelHeight, spec.soleThickness);
  }, [activeGarments, layerVisibility, isMale]);

  const hasOuterwear = useMemo(() => {
    return activeGarments.some((g) => g.slot === 'outerwear' && (layerVisibility[g.slot] ?? true));
  }, [activeGarments, layerVisibility]);

  // Compute covered body zones from visible garments so AvatarMesh3D retracts covered skin
  const coveredZones = useMemo(() => {
    const visibleSlots = new Set(
      activeGarments
        .filter((g) => layerVisibility[g.slot] ?? true)
        .map((g) => g.slot)
    );
    return {
      hasTop: visibleSlots.has('top'),
      hasOuterwear: visibleSlots.has('outerwear'),
      hasDress: visibleSlots.has('dress'),
      hasBottom: visibleSlots.has('bottom'),
      hasShoes: visibleSlots.has('shoes'),
    };
  }, [activeGarments, layerVisibility]);

  const hairProps = useMemo(() => {
    return resolveHairProperties(activeHair, isMale);
  }, [activeHair, isMale]);

  const morphInfluences = useMemo(() => {
    return computeMorphInfluences({
      height: activeMeasurements?.height,
      shoulders: activeMeasurements?.shoulders,
      chest: activeMeasurements?.chest,
      waist: activeMeasurements?.waist,
      hip: activeMeasurements?.hip || activeMeasurements?.hips,
      armLength: activeMeasurements?.armLength || activeMeasurements?.arm_length,
      inseam: activeMeasurements?.inseam,
      isMale,
      shapeParams: activeShapeParams,
      hair: activeHair,
    });
  }, [activeMeasurements, isMale, activeShapeParams, activeHair]);

  // Synchronized metric transform group: locks avatar and garments in 1:1 scale & floor alignment
  const avatarMetricTransform = useMemo(() => {
    return getAvatarMetricTransform({
      isMale,
      height: activeMeasurements?.height,
      morphInfluences,
    });
  }, [isMale, activeMeasurements?.height, morphInfluences]);

  const toggleLayer = useCallback((slotKey) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [slotKey]: !(prev[slotKey] ?? true),
    }));
  }, []);

  useEffect(() => {
    if (!showAvatar) {
      setCameraPreset('garment');
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    setAutoRotate(false);
    setCameraPreset('reset');
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Handle clicking a garment card in the Outfit Layers rack
  const handleItemCardClick = useCallback((garment) => {
    if (onItemClick) {
      onItemClick(garment.rawItem || garment);
      return;
    }
    const targetId = garment?.id;
    if (targetId && String(targetId).trim()) {
      handleOpenChange(false);
      navigate(`/closet/${targetId}`);
    }
  }, [onItemClick, handleOpenChange, navigate]);

  const outfitName = outfit?.name || t('dressing_room_3d.default_outfit', { defaultValue: 'Current Outfit' });

  const primarySlot = useMemo(() => {
    return (focusedSlot && GARMENT_CAMERA_TARGETS[focusedSlot])
      ? focusedSlot
      : (activeGarments[0]?.slot || 'top');
  }, [focusedSlot, activeGarments]);

  const initialCamConfig = useMemo(() => {
    return (!showAvatar && GARMENT_CAMERA_TARGETS[primarySlot])
      ? GARMENT_CAMERA_TARGETS[primarySlot]
      : GARMENT_CAMERA_TARGETS.full;
  }, [showAvatar, primarySlot]);

  const cameraProps = useMemo(() => ({
    position: initialCamConfig.pos,
    fov: 42,
    near: 0.1,
    far: 20,
  }), [initialCamConfig]);

  const glProps = useMemo(() => ({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  }), []);

  const handlePointerDown = useCallback(() => {
    setCameraPreset(null);
  }, []);

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={containerRef}
        className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-full !h-full !max-w-none !max-h-none !rounded-none sm:!inset-auto sm:!left-[50%] sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!w-[96vw] sm:!h-[92vh] sm:!max-h-[92vh] sm:!max-w-6xl sm:!rounded-2xl p-0 overflow-hidden bg-[#FAF7F2] border border-[#E5DFD5] shadow-2xl flex flex-col text-[#1C2024]"
        data-testid="dressing-room-3d-dialog"
      >
        <DialogTitle className="sr-only">
          {t('dressing_room_3d.title', { defaultValue: '3D Try-On Dressing Room' })}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('dressing_room_3d.subtitle', { defaultValue: 'Interactive 360° virtual fitting studio' })}
        </DialogDescription>

        {/* ─── Top Studio Header Bar (Creamy Luxury Boutique) ─── */}
        <header className="relative z-20 flex items-center justify-between px-5 py-3.5 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E1D5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-brand/10 border border-primary-brand/30 flex items-center justify-center text-primary-brand shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#1C2024] tracking-wide">
                  {t('dressing_room_3d.title', { defaultValue: '3D Try-On Dressing Room' })}
                </h2>
                <Badge variant="secondary" className="text-[10px] font-semibold bg-primary-brand/10 text-primary-brand border-primary-brand/25">
                  {!showAvatar
                    ? t('dressing_room_3d.garment_view_badge', { defaultValue: '3D Garment View' })
                    : t('dressing_room_3d.avatar_studio_badge', { defaultValue: '360° Avatar Studio' })}
                </Badge>
              </div>
              <p className="text-xs text-[#6B7280] truncate max-w-[280px] sm:max-w-md">
                {outfitName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-[#6B7280] hover:text-[#111827] hover:bg-[#EFEAE0] rounded-lg h-8 w-8"
              title={isFullscreen ? t('dressing_room_3d.exit_fullscreen', { defaultValue: 'Exit full screen' }) : t('dressing_room_3d.fullscreen', { defaultValue: 'Full screen' })}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              className="text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg h-8 w-8 transition-colors"
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* ─── Main 3D Viewport & Overlay Controls ─── */}
        <div className="relative flex-1 w-full h-full overflow-hidden select-none bg-[#FAF7F2]">
          <Suspense
            fallback={(
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[#6B7280]" data-testid="dressing-room-3d-loading">
                {t('dressing_room_3d.loading', { defaultValue: 'Preparing your 3D studio…' })}
              </div>
            )}
          >
          <Canvas
            shadows
            dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
            camera={cameraProps}
            gl={glProps}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
          >
            {/* Creamy boutique background */}
            <color attach="background" args={['#FAF7F2']} />

            {/* Atmospheric Studio Lighting: warm ivory ambient + gentle fills */}
            <ambientLight intensity={1.2} color="#FFFDF9" />
            <hemisphereLight args={['#FFFBF5', '#EFE8DC', 0.9]} />

            {/* Warm Key Spotlight with shadow map */}
            <spotLight
              position={[2.5, 3.5, 3.0]}
              angle={0.55}
              penumbra={0.8}
              intensity={2.2}
              color="#FFFDF8"
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-bias={-0.0001}
            />

            {/* Soft Fill Light from opposite flank */}
            <directionalLight position={[-2.6, 2.2, 2.2]} intensity={0.75} color="#F5F8FF" />

            {/* Silhouette Rim Backlight */}
            <directionalLight position={[0, 2.5, -2.4]} intensity={1.05} color="#FFF9E6" />

            <OrbitControls
              ref={controlsRef}
              makeDefault
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 1.88}
              minDistance={0.5}
              maxDistance={4.2}
              enablePan={true}
              panSpeed={0.8}
              enableRotate={true}
              rotateSpeed={1.0}
              enableDamping={true}
              dampingFactor={0.08}
              autoRotate={autoRotate}
              autoRotateSpeed={1.8}
            />

            <CameraController
              cameraPreset={cameraPreset}
              setCameraPreset={setCameraPreset}
              controlsRef={controlsRef}
              activeGarmentSlot={primarySlot}
              showAvatar={showAvatar}
              initialTarget={initialCamConfig.target}
              onUserInteraction={() => setAutoRotate(false)}
            />

            <Suspense fallback={null}>
              <StudioPedestal />

              {/* Shared Metric Space: avatar and garments are wrapped in the exact same metric transform */}
              <group position={avatarMetricTransform.position} scale={avatarMetricTransform.scale}>
                <group position={[0, footPose?.groupLift || 0, 0]}>
                {/* 3D Realistic Human Avatar (meterScale=false to inherit parent group scale) */}
                {showAvatar && (
                  <AvatarMesh3D
                    isMale={isMale}
                    skinColor={activeSkinColor}
                    hairProps={hairProps}
                    morphInfluences={morphInfluences}
                    footPose={footPose}
                    coveredZones={coveredZones}
                    height={activeMeasurements?.height || (isMale ? 178 : 168)}
                    meterScale={false}
                    castShadow={true}
                    receiveShadow={true}
                  />
                )}

                {/* Active Outfit Garments Worn in 3D Anatomical Fit */}
                {activeGarments.map((garment) => {
                  const isVisible = layerVisibility[garment.slot] ?? true;
                  return (
                    <GarmentMesh3D
                      key={`${garment.slot}-${garment.id}`}
                      garment={garment}
                      slot={garment.slot}
                      isMale={isMale}
                      visible={isVisible}
                      hasOuterwear={hasOuterwear}
                      morphInfluences={morphInfluences}
                      footPose={footPose}
                      showAvatar={showAvatar}
                      standaloneMode={!showAvatar}
                    />
                  );
                })}
                </group>
              </group>
            </Suspense>
          </Canvas>
          </Suspense>

          {/* ─── Floating Interaction & Drag Hint ─── */}
          <div className="absolute top-4 start-4 z-10 pointer-events-none">
            <span className="text-[11px] font-medium text-[#4B5563] bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E5DFD5] shadow-sm flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-primary-brand" />
              {t('dressing_room_3d.drag_hint', { defaultValue: 'Drag to rotate 360° • Scroll / pinch to zoom' })}
            </span>
          </div>

          {/* ─── Bottom Floating Camera Toolbar (Creamy Design) ─── */}
          <div className="absolute bottom-3 sm:bottom-5 inset-x-0 z-10 flex justify-center pointer-events-none px-2 sm:px-4">
            <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 p-1.5 bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl max-w-[calc(100vw-1rem)] sm:max-w-none overflow-x-auto scrollbar-none">
              <Button
                variant={cameraPreset === 'full' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAutoRotate(false);
                  setCameraPreset('full');
                }}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  cameraPreset === 'full'
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}</span>
              </Button>

              <Button
                variant={cameraPreset === 'upper' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAutoRotate(false);
                  setCameraPreset('upper');
                }}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  cameraPreset === 'upper'
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}
              >
                <Shirt className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}</span>
              </Button>

              <Button
                variant={cameraPreset === 'lower' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAutoRotate(false);
                  setCameraPreset('lower');
                }}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  cameraPreset === 'lower'
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}
              >
                <Footprints className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}</span>
              </Button>

              <Button
                variant={cameraPreset === 'side' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAutoRotate(false);
                  setCameraPreset('side');
                }}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  cameraPreset === 'side'
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.side_view', { defaultValue: 'Side view' })}
                data-testid="camera-side-btn"
              >
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.side_view', { defaultValue: 'Side view' })}</span>
              </Button>

              <Button
                variant={cameraPreset === 'back' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAutoRotate(false);
                  setCameraPreset('back');
                }}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  cameraPreset === 'back'
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.back_view', { defaultValue: 'Back view' })}
                data-testid="camera-back-btn"
              >
                <RotateCw className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.back_view', { defaultValue: 'Back view' })}</span>
              </Button>

              <div className="h-4 w-px bg-[#E5DFD5] mx-1 shrink-0" />

              {/* Toggle Avatar / Garment-Only view (Zara 3D style) */}
              <Button
                type="button"
                variant={!showAvatar ? 'default' : 'ghost'}
                size="sm"
                onClick={handleToggleAvatar}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  !showAvatar
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                data-testid="toggle-avatar-btn"
                title={showAvatar ? t('dressing_room_3d.view_garment_only', { defaultValue: 'View Garment Only (Without Avatar)' }) : t('dressing_room_3d.show_avatar', { defaultValue: 'Show Avatar' })}
                aria-label={showAvatar ? t('dressing_room_3d.view_garment_only', { defaultValue: 'View Garment Only (Without Avatar)' }) : t('dressing_room_3d.show_avatar', { defaultValue: 'Show Avatar' })}
              >
                <User className={`w-3.5 h-3.5 shrink-0 ${!showAvatar ? 'opacity-80' : 'text-primary-brand'}`} />
                <span className="hidden sm:inline">
                  {showAvatar
                    ? t('dressing_room_3d.garment_only', { defaultValue: 'Garment Only' })
                    : t('dressing_room_3d.show_avatar', { defaultValue: 'Show Avatar' })}
                </span>
              </Button>

              <div className="h-4 w-px bg-[#E5DFD5] mx-1 shrink-0" />

              <Button
                variant={autoRotate ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                  autoRotate
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}
              >
                <RotateCw className={`w-3.5 h-3.5 shrink-0 ${autoRotate ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetCamera}
                className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 py-1.5 h-8 flex items-center gap-1 shrink-0 whitespace-nowrap"
                title={t('dressing_room_3d.reset_view', { defaultValue: 'Reset View' })}
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                <span className="hidden sm:inline">{t('dressing_room_3d.reset_view', { defaultValue: 'Reset' })}</span>
              </Button>
            </div>
          </div>

          {/* ─── Side Garment Rack & Layer Toggle Drawer ─── */}
          {activeGarments.length > 0 && (
            <aside
              className={`absolute top-4 end-4 z-20 transition-all duration-300 flex flex-col ${
                showRack ? 'w-64 sm:w-72 max-h-[calc(100%-100px)]' : 'w-auto'
              }`}
            >
              <div className="bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl p-3 flex flex-col gap-2.5 overflow-hidden">
                <div className="flex items-center justify-between pb-1 border-b border-[#EAE3D6]">
                  <button
                    type="button"
                    onClick={() => setShowRack((prev) => !prev)}
                    className="flex items-center gap-2 text-xs font-bold text-[#1F2937] hover:text-primary-brand transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-primary-brand" />
                    {showRack && (
                      <>
                        <span>{t('dressing_room_3d.garments', { defaultValue: 'Outfit Layers' })}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#F3EFE8] text-[#4B5563] border-[#E5DFD5]">
                          {activeGarments.length}
                        </Badge>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRack((prev) => !prev)}
                    className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F2EB] transition-colors"
                    aria-label="Toggle rack"
                  >
                    {showRack ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                </div>

                {showRack && (
                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[46vh] pe-1 scrollbar-thin scrollbar-thumb-[#D8D0C5]">
                    {activeGarments.map((g) => {
                      const isVisible = layerVisibility[g.slot] ?? true;
                      return (
                        <div
                          key={`rack-${g.slot}-${g.id}`}
                          onClick={() => handleItemCardClick(g)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleItemCardClick(g);
                            }
                          }}
                          title={t('dressing_room_3d.view_item_details', { defaultValue: 'View item details' })}
                          className={`group flex items-center justify-between p-2 rounded-xl transition-all border cursor-pointer select-none ${
                            isVisible
                              ? 'bg-[#FAF8F5] border-[#E8E1D5] text-[#1F2937] hover:bg-white hover:border-primary-brand/50 hover:shadow-sm'
                              : 'bg-[#F5F2EB]/50 border-[#E8E1D5]/40 text-[#9CA3AF] opacity-60'
                          }`}
                          data-testid={`rack-item-${g.slot}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg bg-white border border-[#E5DFD5] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                              {g.url ? (
                                <img
                                  src={g.url}
                                  alt={g.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Shirt className="w-4 h-4 text-[#9CA3AF]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold truncate leading-tight group-hover:text-primary-brand transition-colors">
                                {g.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] uppercase tracking-wider text-primary-brand font-medium">
                                  {t(`taxonomy.categories.${g.slot}`, { defaultValue: g.slot })}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-[#9CA3AF] group-hover:text-primary-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLayer(g.slot);
                            }}
                            className="h-7 w-7 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#EFEAE0] shrink-0 ms-1"
                            title={isVisible ? t('dressing_room_3d.hide_item', { defaultValue: 'Hide item' }) : t('dressing_room_3d.show_item', { defaultValue: 'Show item' })}
                            aria-label={isVisible ? t('dressing_room_3d.hide_item', { defaultValue: 'Hide item' }) : t('dressing_room_3d.show_item', { defaultValue: 'Show item' })}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5 text-primary-brand" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
