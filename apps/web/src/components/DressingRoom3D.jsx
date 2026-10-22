import React, { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
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
  ChevronLeft
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AvatarMesh3D from './AvatarMesh3D';
import GarmentMesh3D from './GarmentMesh3D';
import { computeMorphInfluences, resolveHairProperties } from './DynamicAvatar';

// ─── Studio Pedestal Component ───
function StudioPedestal() {
  return (
    <group position={[0, 0, 0]}>
      {/* Soft Contact Shadows on the floor */}
      <ContactShadows
        opacity={0.65}
        scale={2.4}
        blur={1.6}
        far={1.4}
        resolution={512}
        color="#0b0f17"
        position={[0, 0.001, 0]}
      />

      {/* Main Circular Dais / Platform */}
      <mesh position={[0, -0.026, 0]} receiveShadow>
        <cylinderGeometry args={[0.82, 0.86, 0.05, 64]} />
        <meshStandardMaterial
          color="#1E242F"
          roughness={0.42}
          metalness={0.25}
        />
      </mesh>

      {/* Accent Beveled Rim Ring */}
      <mesh position={[0, -0.001, 0]}>
        <ringGeometry args={[0.80, 0.825, 64]} />
        <meshStandardMaterial
          color="#C5A880"
          roughness={0.25}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
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
 * with 360° orbit rotation, studio pedestal, contact shadows, and individual layer toggling.
 */
export default function DressingRoom3D({
  open = false,
  onOpenChange,
  outfit = null,
  outfitItems = {},
  measurements = {},
  sex = 'female',
  skinColor = '#E0AC69',
  hair = {},
  shapeParams = {},
}) {
  const { t, i18n } = useTranslation();
  const isMale = String(sex || measurements?.gender || '').toLowerCase() === 'male';

  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraPreset, setCameraPreset] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({});
  const [showRack, setShowRack] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize active garment items from outfit / outfitItems
  const activeGarments = useMemo(() => {
    const list = [];
    const entries = Object.entries(outfitItems || {});

    entries.forEach(([slotKey, item]) => {
      if (!item) return;
      const g = typeof item === 'object' ? item : { id: item, slot: slotKey };
      if (!g.url && !g.image_url) return;
      list.push({
        slot: slotKey,
        id: g.id || slotKey,
        name: g.name || g.title || slotKey,
        url: g.url || g.image_url,
        category: g.category || slotKey,
        sub_category: g.sub_category || '',
        item_type: g.item_type || '',
      });
    });

    return list;
  }, [outfitItems]);

  const hasOuterwear = useMemo(() => {
    return activeGarments.some((g) => g.slot === 'outerwear' && (layerVisibility[g.slot] ?? true));
  }, [activeGarments, layerVisibility]);

  const hairProps = useMemo(() => {
    return resolveHairProperties(hair, isMale);
  }, [hair, isMale]);

  const morphInfluences = useMemo(() => {
    return computeMorphInfluences({
      height: measurements?.height,
      shoulders: measurements?.shoulders,
      chest: measurements?.chest,
      waist: measurements?.waist,
      hip: measurements?.hip || measurements?.hips,
      armLength: measurements?.armLength || measurements?.arm_length,
      inseam: measurements?.inseam,
      isMale,
      shapeParams,
      hair,
    });
  }, [measurements, isMale, shapeParams, hair]);

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

  const outfitName = outfit?.name || t('dressing_room_3d.default_outfit', { defaultValue: 'Current Outfit' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={containerRef}
        className="!max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden bg-[#0F141C] border border-slate-700/60 shadow-2xl rounded-2xl flex flex-col text-slate-100"
        data-testid="dressing-room-3d-dialog"
      >
        <DialogTitle className="sr-only">
          {t('dressing_room_3d.title', { defaultValue: '3D Try-On Dressing Room' })}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('dressing_room_3d.subtitle', { defaultValue: 'Interactive 360° virtual fitting studio' })}
        </DialogDescription>

        {/* ─── Top Studio Header Bar ─── */}
        <header className="relative z-20 flex items-center justify-between px-5 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-brand/20 border border-primary-brand/40 flex items-center justify-center text-primary-brand shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {t('dressing_room_3d.title', { defaultValue: '3D Try-On Dressing Room' })}
                </h2>
                <Badge variant="secondary" className="text-[10px] font-semibold bg-primary-brand/15 text-primary-brand border-primary-brand/30">
                  360° 3D Studio
                </Badge>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md">
                {outfitName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg h-8 w-8"
              title={isFullscreen ? t('dressing_room_3d.exit_fullscreen', { defaultValue: 'Exit full screen' }) : t('dressing_room_3d.fullscreen', { defaultValue: 'Full screen' })}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange?.(false)}
              className="text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 rounded-lg h-8 w-8 transition-colors"
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* ─── Main 3D Viewport & Overlay Controls ─── */}
        <div className="relative flex-1 w-full h-full overflow-hidden select-none bg-radial-gradient">
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
            {/* Atmospheric Studio Lighting */}
            <ambientLight intensity={0.75} />
            <hemisphereLight args={['#FFFFFF', '#334155', 0.85]} />

            {/* Warm Key Spotlight with shadow map */}
            <spotLight
              position={[2.5, 3.4, 3.0]}
              angle={0.55}
              penumbra={0.8}
              intensity={2.0}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-bias={-0.0001}
            />

            {/* Cool Fill Light from opposite flank */}
            <directionalLight position={[-2.6, 2.2, 2.2]} intensity={0.65} color="#E0F2FE" />

            {/* Silhouette Rim Backlight */}
            <directionalLight position={[0, 2.5, -2.6]} intensity={1.15} color="#FFFFFF" />

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

              {/* 3D Realistic Human Avatar */}
              <AvatarMesh3D
                isMale={isMale}
                skinColor={skinColor}
                hairProps={hairProps}
                morphInfluences={morphInfluences}
                height={measurements?.height || (isMale ? 178 : 168)}
                meterScale={true}
                castShadow={true}
                receiveShadow={true}
              />

              {/* Active Outfit Garments Worn in 3D */}
              {activeGarments.map((garment) => {
                const isVisible = layerVisibility[garment.slot] ?? true;
                return (
                  <GarmentMesh3D
                    key={`${garment.slot}-${garment.id}`}
                    garment={garment}
                    slot={garment.slot}
                    isMale={isMale}
                    avatarHeight={measurements?.height || (isMale ? 178 : 168)}
                    measurements={measurements}
                    morphInfluences={morphInfluences}
                    visible={isVisible}
                    hasOuterwear={hasOuterwear}
                  />
                );
              })}
            </Suspense>
          </Canvas>

          {/* ─── Floating Interaction & Drag Hint ─── */}
          <div className="absolute top-4 start-4 z-10 pointer-events-none">
            <span className="text-[11px] font-medium text-slate-300/80 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/50 shadow-sm flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-primary-brand" />
              {t('dressing_room_3d.drag_hint', { defaultValue: 'Drag to rotate 360° • Scroll / pinch to zoom' })}
            </span>
          </div>

          {/* ─── Bottom Floating Camera Toolbar ─── */}
          <div className="absolute bottom-5 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 p-1.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-2xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('full')}
                className="text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}
              >
                <User className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('upper')}
                className="text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}
              >
                <Shirt className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCameraPreset('lower')}
                className="text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5"
                title={t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}
              >
                <Footprints className="w-3.5 h-3.5 text-primary-brand" />
                <span className="hidden sm:inline">{t('dressing_room_3d.lower_body', { defaultValue: 'Lower Body' })}</span>
              </Button>

              <div className="h-4 w-px bg-slate-700/80 mx-1" />

              <Button
                variant={autoRotate ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 transition-all ${
                  autoRotate
                    ? 'bg-primary-brand text-white shadow-md'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800'
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
                className="text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-2.5 py-1.5 h-8 flex items-center gap-1"
                title={t('dressing_room_3d.reset_view', { defaultValue: 'Reset View' })}
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">{t('dressing_room_3d.reset_view', { defaultValue: 'Reset' })}</span>
              </Button>
            </div>
          </div>

          {/* ─── Side Garment Rack & Layer Toggle Drawer ─── */}
          {activeGarments.length > 0 && (
            <aside
              className={`absolute top-4 end-4 z-20 transition-all duration-300 flex flex-col ${
                showRack ? 'w-64 max-h-[calc(100%-100px)]' : 'w-auto'
              }`}
            >
              <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-2xl p-3 flex flex-col gap-2.5 overflow-hidden">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRack((prev) => !prev)}
                    className="flex items-center gap-2 text-xs font-bold text-white hover:text-primary-brand transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-primary-brand" />
                    {showRack && (
                      <>
                        <span>{t('dressing_room_3d.garments', { defaultValue: 'Outfit Layers' })}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-800 text-slate-300">
                          {activeGarments.length}
                        </Badge>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRack((prev) => !prev)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Toggle rack"
                  >
                    {showRack ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                </div>

                {showRack && (
                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[46vh] pe-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {activeGarments.map((g) => {
                      const isVisible = layerVisibility[g.slot] ?? true;
                      return (
                        <div
                          key={`rack-${g.slot}-${g.id}`}
                          className={`flex items-center justify-between p-2 rounded-xl transition-all border ${
                            isVisible
                              ? 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                              : 'bg-slate-900/40 border-slate-800/40 text-slate-500 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center overflow-hidden shrink-0">
                              {g.url ? (
                                <img
                                  src={g.url}
                                  alt={g.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Shirt className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold truncate leading-tight">
                                {g.name}
                              </p>
                              <span className="text-[9px] uppercase tracking-wider text-primary-brand font-medium">
                                {t(`taxonomy.categories.${g.slot}`, { defaultValue: g.slot })}
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleLayer(g.slot)}
                            className="h-7 w-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 shrink-0"
                            title={isVisible ? t('dressing_room_3d.hide_item', { defaultValue: 'Hide item' }) : t('dressing_room_3d.show_item', { defaultValue: 'Show item' })}
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
