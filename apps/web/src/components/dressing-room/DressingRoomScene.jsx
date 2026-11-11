import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import GarmentMesh, { preloadGarmentGlb } from './GarmentMesh';
import useDressingRoomStore, {
  getCanonicalAvatarGlb,
  SLOT_DEFAULT_LAYERS,
} from './useDressingRoomStore';
import { buildAvatarMorphField } from '@/lib/avatarMorphField';

class GarmentSlotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn(`[DressingRoomScene] Failed to load garment slot "${this.props.slotKey}":`, error);
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.hasError &&
      (prevProps.glbUrl !== this.props.glbUrl || prevProps.itemId !== this.props.itemId)
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const ORDERED_PRIMARY_SLOTS = ['top', 'bottom', 'outerwear', 'shoes'];

/**
 * Scene Assembly (`DressingRoomScene`)
 *
 * Mounts the canonical base avatar at `layer={0}` and iterates through
 * `activeOutfit` slots (`top`, `bottom`, `outerwear`, `shoes`, `accessories`),
 * passing the exact same `bodyMetrics` reference to every `GarmentMesh` instance
 * so avatar and clothing deform simultaneously.
 */
export function DressingRoomScene({
  avatarGender: propGender,
  avatarSkinColor: propSkinColor,
  bodyMetrics: propBodyMetrics,
  activeOutfit: propActiveOutfit,
}) {
  const storeGender = useDressingRoomStore((s) => s.avatarGender);
  const storeSkinColor = useDressingRoomStore((s) => s.avatarSkinColor);
  const storeBodyMetrics = useDressingRoomStore((s) => s.bodyMetrics);
  const storeActiveOutfit = useDressingRoomStore((s) => s.activeOutfit);

  const avatarGender = propGender || storeGender;
  const avatarSkinColor = propSkinColor || storeSkinColor;
  const bodyMetrics = propBodyMetrics || storeBodyMetrics;
  const activeOutfit = propActiveOutfit || storeActiveOutfit;

  const avatarGlbUrl = useMemo(() => getCanonicalAvatarGlb(avatarGender), [avatarGender]);
  const [avatarMorphField, setAvatarMorphField] = useState(null);

  const handleAvatarSceneReady = useCallback((rawAvatarScene) => {
    const field = buildAvatarMorphField(rawAvatarScene);
    setAvatarMorphField(field);
  }, []);

  // Reset cached morph field when gender changes until new avatar GLTF reports ready
  useEffect(() => {
    setAvatarMorphField(null);
  }, [avatarGlbUrl]);

  // Flatten active slots in ascending physical layer order
  const slottedEntries = useMemo(() => {
    if (!activeOutfit || typeof activeOutfit !== 'object') return [];
    const list = [];

    ORDERED_PRIMARY_SLOTS.forEach((slotKey) => {
      const item = activeOutfit[slotKey];
      if (!item || !item.glbUrl) return;
      list.push({
        slotKey,
        id: item.id || slotKey,
        glbUrl: item.glbUrl,
        textureUrl: item.textureUrl || null,
        normalMapUrl: item.normalMapUrl || null,
        layer: Number.isFinite(Number(item.layer))
          ? Number(item.layer)
          : SLOT_DEFAULT_LAYERS[slotKey] ?? 1,
      });
    });

    if (Array.isArray(activeOutfit.accessories)) {
      activeOutfit.accessories.forEach((acc, index) => {
        if (!acc || !acc.glbUrl) return;
        list.push({
          slotKey: 'accessories',
          id: acc.id || `accessory-${index}`,
          glbUrl: acc.glbUrl,
          textureUrl: acc.textureUrl || null,
          normalMapUrl: acc.normalMapUrl || null,
          layer: Number.isFinite(Number(acc.layer))
            ? Number(acc.layer)
            : SLOT_DEFAULT_LAYERS.accessories,
        });
      });
    }

    list.sort((a, b) => a.layer - b.layer);
    return list;
  }, [activeOutfit]);

  // Preload active avatar & garment GLBs via Draco worker decoder
  useEffect(() => {
    preloadGarmentGlb(avatarGlbUrl);
    slottedEntries.forEach((entry) => {
      preloadGarmentGlb(entry.glbUrl);
    });
  }, [avatarGlbUrl, slottedEntries]);

  const coveredZones = useMemo(
    () => ({
      hasTop: Boolean(activeOutfit?.top?.glbUrl),
      hasBottom: Boolean(activeOutfit?.bottom?.glbUrl),
      hasOuterwear: Boolean(activeOutfit?.outerwear?.glbUrl),
      hasShoes: Boolean(activeOutfit?.shoes?.glbUrl),
    }),
    [activeOutfit]
  );

  return (
    <group name="dressing-room-scene-root">
      {/* Base Avatar at Layer 0 */}
      <GarmentMesh
        key={`base-avatar-${avatarGender}`}
        glbUrl={avatarGlbUrl}
        layer={0}
        slot="avatar"
        gender={avatarGender}
        skinColor={avatarSkinColor}
        bodyMetrics={bodyMetrics}
        coveredZones={coveredZones}
        onSceneReady={handleAvatarSceneReady}
      />

      {/* Synchronized Layered Garment Slots (Layers 1..3+) */}
      {slottedEntries.map((entry) => (
        <GarmentSlotErrorBoundary
          key={`${entry.slotKey}-${entry.id}`}
          slotKey={entry.slotKey}
          itemId={entry.id}
          glbUrl={entry.glbUrl}
        >
          <Suspense fallback={null}>
            <GarmentMesh
              glbUrl={entry.glbUrl}
              textureUrl={entry.textureUrl}
              normalMapUrl={entry.normalMapUrl}
              layer={entry.layer}
              slot={entry.slotKey}
              gender={avatarGender}
              bodyMetrics={bodyMetrics}
              avatarMorphField={avatarMorphField}
            />
          </Suspense>
        </GarmentSlotErrorBoundary>
      ))}
    </group>
  );
}

export default DressingRoomScene;
