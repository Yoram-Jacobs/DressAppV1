import React, { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import GarmentMesh3D, { normalizeGarmentRole } from './GarmentMesh3D';
import { computeMorphInfluences, resolveHairProperties } from './DynamicAvatar';
import { resolveEffectiveGarmentUrl } from '@/lib/itemImage';

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
function CameraController({ cameraPreset, setCameraPreset, controlsRef }) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(0, 1.05, 2.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0.95, 0));

  useEffect(() => {
    if (!cameraPreset) return;

    if (cameraPreset === 'full') {
      targetCamPos.current.set(0, 1.05, 2.5);
      targetLookAt.current.set(0, 0.95, 0);
    } else if (cameraPreset === 'upper') {
      targetCamPos.current.set(0, 1.35, 1.35);
      targetLookAt.current.set(0, 1.30, 0);
    } else if (cameraPreset === 'lower') {
      targetCamPos.current.set(0, 0.45, 1.35);
      targetLookAt.current.set(0, 0.35, 0);
    } else if (cameraPreset === 'reset') {
      targetCamPos.current.set(0, 1.05, 2.5);
      targetLookAt.current.set(0, 0.95, 0);
    }
  }, [cameraPreset]);

  useFrame((_, delta) => {
    if (!cameraPreset) return;
    const lerpSpeed = Math.min(1, delta * 5);
    camera.position.lerp(targetCamPos.current, lerpSpeed);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, lerpSpeed);
      controlsRef.current.update();
    }

    if (camera.position.distanceTo(targetCamPos.current) < 0.02) {
      setCameraPreset(null);
    }
  });

  return null;
}

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

  const activeItems = garments || outfitItems || {};
  const activeMeasurements = propMeasurements || profile?.measurements || {};
  const activeSex = propSex || profile?.gender || profile?.sex || activeMeasurements?.gender || 'female';
  const activeSkinColor = propSkinColor || profile?.skin_tone || profile?.skinColor || '#E0AC69';
  const activeHair = propHair || profile?.hair || {};
  const activeShapeParams = propShapeParams || profile?.shape_params || profile?.shapeParams || {};

  const isMale = String(activeSex || activeMeasurements?.gender || '').toLowerCase() === 'male';

  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraPreset, setCameraPreset] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({});
  const [showRack, setShowRack] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize active garment items from outfit / outfitItems / garments
  const activeGarments = useMemo(() => {
    const list = [];
    const entries = Object.entries(activeItems || {});

    entries.forEach(([slotKey, item]) => {
      if (!item) return;
      const g = typeof item === 'object' ? item : { id: item, slot: slotKey };
      if (!g.url && !g.image_url) return;
      const normSlot = normalizeGarmentRole(
        slotKey,
        g.category,
        g.name || g.title || g.sub_category || g.item_type
      );
      list.push({
        slot: normSlot,
        id: g.id || slotKey,
        name: g.name || g.title || slotKey,
        url: resolveEffectiveGarmentUrl(g) || g.url || g.image_url,
        category: g.category || slotKey,
        sub_category: g.sub_category || '',
        item_type: g.item_type || '',
        rawItem: g,
      });
    });

    return list;
  }, [activeItems]);

  const hasOuterwear = useMemo(() => {
    return activeGarments.some((g) => g.slot === 'outerwear' && (layerVisibility[g.slot] ?? true));
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

  const handleResetCamera = useCallback(() => {
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

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={containerRef}
        className="!max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden bg-[#FAF7F2] border border-[#E5DFD5] shadow-2xl rounded-2xl flex flex-col text-[#1C2024]"
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
                  360° 3D Studio
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
          <Canvas
            shadows
            camera={{
              position: [0, 1.05, 2.5],
              fov: 42,
              near: 0.1,
              far: 20,
            }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            className="w-full h-full cursor-grab active:cursor-grabbing"
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
              target={[0, 0.95, 0]}
              minPolarAngle={Math.PI / 3.4}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={1.1}
              maxDistance={3.8}
              enablePan={false}
              enableDamping={true}
              dampingFactor={0.06}
              autoRotate={autoRotate}
              autoRotateSpeed={1.8}
            />

            <CameraController
              cameraPreset={cameraPreset}
              setCameraPreset={setCameraPreset}
              controlsRef={controlsRef}
            />

            <Suspense fallback={null}>
              <StudioPedestal />

              {/* Shared Metric Space: avatar and garments are wrapped in the exact same metric transform */}
              <group position={avatarMetricTransform.position} scale={avatarMetricTransform.scale}>
                {/* 3D Realistic Human Avatar (meterScale=false to inherit parent group scale) */}
                <AvatarMesh3D
                  isMale={isMale}
                  skinColor={activeSkinColor}
                  hairProps={hairProps}
                  morphInfluences={morphInfluences}
                  height={activeMeasurements?.height || (isMale ? 178 : 168)}
                  meterScale={false}
                  castShadow={true}
                  receiveShadow={true}
                />

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
                    />
                  );
                })}
              </group>
            </Suspense>
          </Canvas>

          {/* ─── Floating Interaction & Drag Hint ─── */}
          <div className="absolute top-4 start-4 z-10 pointer-events-none">
            <span className="text-[11px] font-medium text-[#4B5563] bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E5DFD5] shadow-sm flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-primary-brand" />
              {t('dressing_room_3d.drag_hint', { defaultValue: 'Drag to rotate 360° • Scroll / pinch to zoom' })}
            </span>
          </div>

          {/* ─── Bottom Floating Camera Toolbar (Creamy Design) ─── */}
          <div className="absolute bottom-5 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 p-1.5 bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('full')}
                className="text-xs font-semibold text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}
              >
                <User className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('upper')}
                className="text-xs font-semibold text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}
              >
                <Shirt className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('lower')}
                className="text-xs font-semibold text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}
              >
                <Footprints className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}</span>
              </Button>

              <div className="h-4 w-px bg-[#E5DFD5] mx-1" />

              <Button
                variant={autoRotate ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 transition-all ${
                  autoRotate
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
                }`}
                title={t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}
              >
                <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetCamera}
                className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 py-1.5 h-8 flex items-center gap-1"
                title={t('dressing_room_3d.reset_view', { defaultValue: 'Reset View' })}
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#6B7280]" />
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
