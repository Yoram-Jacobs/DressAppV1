import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import DressingRoomScene from './DressingRoomScene';
import useDressingRoomStore from './useDressingRoomStore';

const AVATAR_CENTER_TARGET = [0, 0.9, 0];
const DEFAULT_GL_CONFIG = {
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
};
const DEFAULT_CAMERA_CONFIG = {
  position: [0, 1.2, 2.5],
  fov: 45,
};

// All presets satisfy OrbitControls constraints:
// distance in [1.0, 4.0], polar angle in [Math.PI / 4, Math.PI / 2]
export const CAMERA_PRESET_TARGETS = Object.freeze({
  full: { position: [0, 1.2, 2.5], target: [0, 0.9, 0] },
  front: { position: [0, 1.22, 2.05], target: [0, 0.95, 0] },
  upper: { position: [0, 1.3, 1.45], target: [0, 1.25, 0] },
  lower: { position: [0, 0.55, 1.45], target: [0, 0.35, 0] },
  close_up: { position: [0, 1.62, 1.15], target: [0, 1.5, 0] },
  shoes: { position: [0, 0.48, 1.25], target: [0, 0.14, 0] },
  side: { position: [2.35, 1.1, 0], target: [0, 0.9, 0] },
  back: { position: [0, 1.2, -2.45], target: [0, 0.9, 0] },
});

class SafeContactShadowsBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err) {
    console.warn('[DressingRoomCanvas] ContactShadows fallback:', err);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function DressingRoomLoader() {
  const { t } = useTranslation();
  const label = t('dressing_room_3d.loading', {
    defaultValue: 'Preparing your 3D studio…',
  });

  if (typeof Html !== 'function' && typeof Html !== 'object') {
    return null;
  }

  return (
    <Html center>
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 border border-[#E5DFD5] shadow-lg text-xs font-semibold text-[#374151] whitespace-nowrap"
        data-testid="dressing-room-r3f-loader"
      >
        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
        <span>{label}</span>
      </div>
    </Html>
  );
}

function CameraPresetController({ controlsRef }) {
  const { camera } = useThree();
  const cameraPreset = useDressingRoomStore((s) => s.cameraPreset);
  const animatingRef = useRef(false);
  const goalRef = useRef(CAMERA_PRESET_TARGETS.full);
  const lastPresetRef = useRef(null);

  useEffect(() => {
    const controls = controlsRef?.current;
    if (!controls || typeof controls.addEventListener !== 'function') return undefined;
    const stopAnimation = () => {
      animatingRef.current = false;
    };
    controls.addEventListener('start', stopAnimation);
    return () => {
      controls.removeEventListener('start', stopAnimation);
    };
  }, [controlsRef]);

  useEffect(() => {
    if (!cameraPreset || !CAMERA_PRESET_TARGETS[cameraPreset]) return;
    if (lastPresetRef.current === null) {
      lastPresetRef.current = cameraPreset;
      if (cameraPreset === 'full') return;
    }
    lastPresetRef.current = cameraPreset;
    goalRef.current = CAMERA_PRESET_TARGETS[cameraPreset];
    animatingRef.current = true;
  }, [cameraPreset]);

  useFrame((_, delta) => {
    if (!animatingRef.current) return;
    const goal = goalRef.current;
    if (!goal) return;

    const dt = Math.min(Math.max(0, delta), 0.1);
    const alpha = Math.min(1, dt * 7);

    const [gx, gy, gz] = goal.position;
    const [tx, ty, tz] = goal.target;

    const nx = camera.position.x + (gx - camera.position.x) * alpha;
    const ny = camera.position.y + (gy - camera.position.y) * alpha;
    const nz = camera.position.z + (gz - camera.position.z) * alpha;
    camera.position.set(nx, ny, nz);

    const controls = controlsRef?.current;
    if (controls?.target) {
      controls.target.x += (tx - controls.target.x) * alpha;
      controls.target.y += (ty - controls.target.y) * alpha;
      controls.target.z += (tz - controls.target.z) * alpha;
      controls.update?.();
    }

    const distSq =
      (gx - nx) * (gx - nx) +
      (gy - ny) * (gy - ny) +
      (gz - nz) * (gz - nz);
    if (distSq < 0.0009) {
      camera.position.set(gx, gy, gz);
      if (controls?.target) {
        controls.target.set(tx, ty, tz);
        controls.update?.();
      }
      animatingRef.current = false;
    }
  });

  return null;
}

/**
 * Alabaster Dais / Pedestal with Champagne Gold Rim Ring and Soft Studio Floor Plane.
 */
export function StudioPedestal() {
  return (
    <group position={[0, 0, 0]}>
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
          side={2}
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

/**
 * Canvas Root (`DressingRoomCanvas`)
 *
 * Configures the R3F `<Canvas>`, studio lighting, Drei `<ContactShadows>`,
 * constrained `<OrbitControls>`, and `<Suspense fallback={<DressingRoomLoader />}>`.
 */
export function DressingRoomCanvas({
  children,
  className = 'w-full h-full',
  autoRotate = false,
  onUserInteraction = null,
}) {
  const controlsRef = useRef(null);
  const cleanupRef = useRef(null);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const handleCreated = useCallback(({ gl }) => {
    cleanupRef.current?.();
    const dom = gl?.domElement;
    if (!dom) return;

    const onLost = (e) => {
      e.preventDefault();
      try {
        useGLTF.clear?.();
      } catch {
        // ignore
      }
    };

    const onRestored = () => {
      try {
        useGLTF.clear?.();
      } catch {
        // ignore
      }
      setCanvasKey((k) => k + 1);
    };

    dom.addEventListener('webglcontextlost', onLost, false);
    dom.addEventListener('webglcontextrestored', onRestored, false);
    cleanupRef.current = () => {
      dom.removeEventListener('webglcontextlost', onLost, false);
      dom.removeEventListener('webglcontextrestored', onRestored, false);
    };
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || typeof controls.addEventListener !== 'function') return undefined;
    const handleStart = () => {
      onUserInteraction?.();
    };
    controls.addEventListener('start', handleStart);
    return () => {
      controls.removeEventListener('start', handleStart);
    };
  }, [onUserInteraction]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-gradient-to-b from-[#FAF8F5] to-[#F1ECE2] ${className}`}
      style={{ width: '100%', height: '100%', minHeight: 420 }}
      data-testid="dressing-room-canvas-wrapper"
    >
      <Canvas
        key={`r3f-dressing-room-${canvasKey}`}
        gl={DEFAULT_GL_CONFIG}
        camera={DEFAULT_CAMERA_CONFIG}
        dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
        onCreated={handleCreated}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Studio Lighting Setup: Warm Ambient + Soft Directional Fill & Rim Lights */}
        <ambientLight intensity={1.05} color="#FFFDF9" />
        <hemisphereLight args={['#FFFDF9', '#EAE2D6', 0.65]} />
        <directionalLight position={[2.4, 3.4, 2.8]} intensity={1.45} color="#FFFDF8" />
        <directionalLight position={[-2.5, 2.2, 2.0]} intensity={0.8} color="#F4F7FF" />
        <directionalLight position={[0, 2.5, -2.4]} intensity={0.9} color="#FFF8E8" />

        {/* Studio Pedestal */}
        <StudioPedestal />

        {/* Ground Contact Shadow */}
        <SafeContactShadowsBoundary>
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.6}
            scale={10}
            blur={1.5}
            far={1}
          />
        </SafeContactShadowsBoundary>

        {/* Constrained Studio OrbitControls */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={1.0}
          maxDistance={4.0}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          enablePan={false}
          target={AVATAR_CENTER_TARGET}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotate ? 4.5 : 0}
        />

        <CameraPresetController controlsRef={controlsRef} />

        {/* Model Nodes Wrapped in Suspense */}
        <Suspense fallback={<DressingRoomLoader />}>
          {children || <DressingRoomScene />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default DressingRoomCanvas;
