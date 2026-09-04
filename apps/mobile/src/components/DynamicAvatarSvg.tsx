/**
 * apps/mobile/src/components/DynamicAvatarSvg.tsx
 *
 * React Native SVG port of apps/web/src/components/DynamicAvatar.jsx.
 *
 * Geometry calculation (Bezier math, DIVISOR, wShoulders, etc.) is copied
 * faithfully from the web version — only the rendering primitives differ.
 * Uses react-native-svg instead of HTML <svg>.
 *
 * Props
 * ─────
 *   height      cm, 140-210      default 170
 *   shoulders   cm, 28-58        default 40
 *   chest       cm, 65-138       default 90
 *   waist       cm, 54-128       default 72
 *   hip         cm, 68-148       default 96
 *   armLength   cm, 42-85        default 60
 *   inseam      cm, 52-100       default 78
 *   gender      'male'|'female'  default 'female'
 *   skinColor   hex string       default '#9CA3AF'
 *   width       SVG width px     default 200
 *   showGuideLines               default true
 *   bodyPhotoUrl                 if set, renders the photo instead of the
 *                                parametric mannequin
 */

import React, { useMemo } from 'react';
import Svg, {
  Path,
  G,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Image as SvgImage,
} from 'react-native-svg';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DynamicAvatarSvgProps {
  height?: number;
  shoulders?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  armLength?: number;
  inseam?: number;
  gender?: string;
  skinColor?: string;
  width?: number;
  showGuideLines?: boolean;
  bodyPhotoUrl?: string | null;
}

// ─── Geometry helper ──────────────────────────────────────────────────────────

function computeGeometry(
  height: number,
  shoulders: number,
  chest: number,
  waist: number,
  hip: number,
  armLength: number,
  inseam: number,
  gender: string,
) {
  // Clamp inputs — same bounds as the web component
  const numH   = Math.max(130, Math.min(215, Number(height)    || 170));
  const numSh  = Math.max(28,  Math.min(58,  Number(shoulders) || 40));
  const numCh  = Math.max(65,  Math.min(138, Number(chest)     || 90));
  const numW   = Math.max(54,  Math.min(128, Number(waist)     || 72));
  const numHip = Math.max(68,  Math.min(148, Number(hip)       || 96));
  const numArm = Math.max(42,  Math.min(85,  Number(armLength) || 60));
  const numIns = Math.max(52,  Math.min(100, Number(inseam)    || 78));
  const isMale = String(gender).toLowerCase() === 'male';

  // Fixed coordinate space — viewBox "0 0 200 450"
  const X0            = 100;
  const viewBoxHeight = 450;

  // Scale body height proportionally (170cm reference → 360 SVG units)
  const totalBodySvgHeight = 360 * (numH / 170.0);
  const yHeadTop = (viewBoxHeight - totalBodySvgHeight) / 2 + 10;
  const yFeet    = yHeadTop + totalBodySvgHeight;

  // Head & Neck
  const headHeight = totalBodySvgHeight / 7.3;
  const yChin      = yHeadTop + headHeight;
  const neckHeight = totalBodySvgHeight * 0.045;
  const yShoulders = yChin + neckHeight;

  // Inseam & Legs
  const inseamSvg = totalBodySvgHeight * (numIns / numH);
  const yAnkles   = yFeet - 18;
  const yCrotch   = yFeet - inseamSvg;

  const torsoHeight = yCrotch - yShoulders;
  const yChest      = yShoulders + torsoHeight * (isMale ? 0.30 : 0.26);
  const yWaist      = yShoulders + torsoHeight * (isMale ? 0.62 : 0.58);
  const yHip        = yShoulders + torsoHeight * 0.88;
  const yKnees      = yCrotch + inseamSvg * 0.48;

  // Arms
  const armSvg  = totalBodySvgHeight * (numArm / numH);
  const yElbow  = yShoulders + armSvg * 0.48;
  const yWrist  = yShoulders + armSvg * 0.88;
  const yHandTip = yShoulders + armSvg;

  // Anatomical ellipse divisor (~2.65) — circumference → flat front width
  const DIVISOR = 2.65;

  // Shape parameters (gender-differentiated)
  const wShoulders = isMale ? (numSh * 1.25)                  : (numSh * 1.0);
  const wChest     = isMale ? ((numCh / DIVISOR) * 1.1)       : ((numCh / DIVISOR) * 0.95);
  const wWaist     = isMale ? ((numW  / DIVISOR) * 1.02)      : ((numW  / DIVISOR) * 0.82);
  const wHip       = isMale ? ((numHip / DIVISOR) * 0.92)     : ((numHip / DIVISOR) * 1.08);
  const wNeck      = isMale ? 14 : 9.5;

  // Leg widths
  const wOuterKnee  = isMale ? (wHip * 0.65)  : (wHip * 0.58);
  const wInnerKnee  = isMale ? 10.5 : 9.5;
  const wOuterAnkle = isMale ? 21   : 18.5;
  const wInnerAnkle = isMale ? 9.5  : 8.0;
  const wFootTip    = isMale ? 24   : 20;
  const wFootHeel   = isMale ? 10   : 8.5;

  // Arm widths
  const wUpperArm = isMale ? 12  : 8.5;
  const wForearm  = isMale ? 9.5 : 6.8;

  // ── Key points (right side, viewer perspective) ──────────────────────────
  const pNeckR       = `${X0 + wNeck},${yChin}`;
  const pShoulderR   = `${X0 + wShoulders},${yShoulders}`;
  const pChestR      = `${X0 + wChest},${yChest}`;
  const pWaistR      = `${X0 + wWaist},${yWaist}`;
  const pHipR        = `${X0 + wHip},${yHip}`;
  const pOuterKneeR  = `${X0 + wOuterKnee},${yKnees}`;
  const pOuterAnkleR = `${X0 + wOuterAnkle},${yAnkles}`;
  const pFootTipR    = `${X0 + wFootTip},${yFeet}`;
  const pFootHeelR   = `${X0 + wFootHeel},${yFeet}`;
  const pInnerAnkleR = `${X0 + wInnerAnkle},${yAnkles}`;
  const pInnerKneeR  = `${X0 + wInnerKnee},${yKnees}`;
  const pCrotch      = `${X0},${yCrotch}`;

  // Left side
  const pInnerKneeL  = `${X0 - wInnerKnee},${yKnees}`;
  const pInnerAnkleL = `${X0 - wInnerAnkle},${yAnkles}`;
  const pFootHeelL   = `${X0 - wFootHeel},${yFeet}`;
  const pFootTipL    = `${X0 - wFootTip},${yFeet}`;
  const pOuterAnkleL = `${X0 - wOuterAnkle},${yAnkles}`;
  const pOuterKneeL  = `${X0 - wOuterKnee},${yKnees}`;
  const pHipL        = `${X0 - wHip},${yHip}`;
  const pWaistL      = `${X0 - wWaist},${yWaist}`;
  const pChestL      = `${X0 - wChest},${yChest}`;
  const pShoulderL   = `${X0 - wShoulders},${yShoulders}`;
  const pNeckL       = `${X0 - wNeck},${yChin}`;

  // ── Body contour path (cubic Bezier) ─────────────────────────────────────
  const bodyPath = [
    `M ${pNeckR}`,
    `C ${X0 + wNeck + (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.5} ${X0 + wShoulders * 0.8},${yShoulders - 2} ${pShoulderR}`,
    `C ${X0 + wShoulders + 2},${yShoulders + 10} ${X0 + wChest + 2},${yChest - 5} ${pChestR}`,
    `C ${X0 + wChest - (isMale ? 1 : 3)},${yChest + (yWaist - yChest) * 0.5} ${X0 + wWaist + (isMale ? 2 : -2)},${yWaist - 8} ${pWaistR}`,
    `C ${X0 + wWaist + (isMale ? 1 : 4)},${yWaist + (yHip - yWaist) * 0.5} ${X0 + wHip + (isMale ? 1 : 2)},${yHip - 8} ${pHipR}`,
    `C ${X0 + wHip - (isMale ? 1 : 2)},${yHip + (yKnees - yHip) * 0.4} ${X0 + wOuterKnee + 3},${yKnees - 12} ${pOuterKneeR}`,
    `C ${X0 + wOuterKnee + (isMale ? 2 : 1)},${yKnees + 15} ${X0 + wOuterAnkle + 3},${yAnkles - 15} ${pOuterAnkleR}`,
    `L ${pFootTipR} L ${pFootHeelR}`,
    `L ${pInnerAnkleR}`,
    `C ${X0 + wInnerAnkle + (isMale ? 1.5 : 1)},${yAnkles - 15} ${X0 + wInnerKnee + 1},${yKnees + 15} ${pInnerKneeR}`,
    `C ${X0 + wInnerKnee - (isMale ? 1.5 : 1)},${yKnees - 15} ${X0 + 3.5},${yCrotch + 10} ${pCrotch}`,
    `C ${X0 - 3.5},${yCrotch + 10} ${X0 - wInnerKnee + (isMale ? 1.5 : 1)},${yKnees - 15} ${pInnerKneeL}`,
    `C ${X0 - wInnerKnee - 1},${yKnees + 15} ${X0 - wInnerAnkle - (isMale ? 1.5 : 1)},${yAnkles - 15} ${pInnerAnkleL}`,
    `L ${pFootHeelL} L ${pFootTipL} L ${pOuterAnkleL}`,
    `C ${X0 - wOuterAnkle - 3},${yAnkles - 15} ${X0 - wOuterKnee - (isMale ? 2 : 1)},${yKnees + 15} ${pOuterKneeL}`,
    `C ${X0 - wOuterKnee - 3},${yKnees - 12} ${X0 - wHip + (isMale ? 1 : 2)},${yHip + (yKnees - yHip) * 0.4} ${pHipL}`,
    `C ${X0 - wHip - (isMale ? 1 : 2)},${yHip - 8} ${X0 - wWaist - (isMale ? 1 : 4)},${yWaist + (yHip - yWaist) * 0.5} ${pWaistL}`,
    `C ${X0 - wWaist - (isMale ? 2 : -2)},${yWaist - 8} ${X0 - wChest + (isMale ? 1 : 3)},${yChest + (yWaist - yChest) * 0.5} ${pChestL}`,
    `C ${X0 - wChest - 2},${yChest - 5} ${X0 - wShoulders - 2},${yShoulders + 10} ${pShoulderL}`,
    `C ${X0 - wShoulders * 0.8},${yShoulders - 2} ${X0 - wNeck - (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.5} ${pNeckL}`,
    `Z`,
  ].join(' ');

  // ── Arm paths ─────────────────────────────────────────────────────────────
  const armPathR = [
    `M ${X0 + wShoulders - 1},${yShoulders + 2}`,
    `C ${X0 + wShoulders + wUpperArm},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 + wShoulders + wForearm + 2},${yElbow} ${X0 + wShoulders + wForearm + 1},${yElbow + 10}`,
    `C ${X0 + wShoulders + wForearm},${yElbow + (yWrist - yElbow) * 0.5} ${X0 + wShoulders + 5},${yWrist - 5} ${X0 + wShoulders + 4},${yWrist}`,
    `C ${X0 + wShoulders + 3},${yWrist + 5} ${X0 + wShoulders + 4},${yHandTip - 5} ${X0 + wShoulders + 2},${yHandTip}`,
    `C ${X0 + wShoulders - 2},${yHandTip} ${X0 + wShoulders - 2},${yWrist + 5} ${X0 + wShoulders - 2},${yWrist}`,
    `C ${X0 + wShoulders - 2},${yWrist - 5} ${X0 + wChest + 2},${yElbow + 5} ${X0 + wChest + 1},${yChest + 5}`,
    `Z`,
  ].join(' ');

  const armPathL = [
    `M ${X0 - wShoulders + 1},${yShoulders + 2}`,
    `C ${X0 - wShoulders - wUpperArm},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 - wShoulders - wForearm - 2},${yElbow} ${X0 - wShoulders - wForearm - 1},${yElbow + 10}`,
    `C ${X0 - wShoulders - wForearm},${yElbow + (yWrist - yElbow) * 0.5} ${X0 - wShoulders - 5},${yWrist - 5} ${X0 - wShoulders - 4},${yWrist}`,
    `C ${X0 - wShoulders - 3},${yWrist + 5} ${X0 - wShoulders - 4},${yHandTip - 5} ${X0 - wShoulders - 2},${yHandTip}`,
    `C ${X0 - wShoulders + 2},${yHandTip} ${X0 - wShoulders + 2},${yWrist + 5} ${X0 - wShoulders + 2},${yWrist}`,
    `C ${X0 - wShoulders + 2},${yWrist - 5} ${X0 - wChest - 2},${yElbow + 5} ${X0 - wChest - 1},${yChest + 5}`,
    `Z`,
  ].join(' ');

  // ── Head path ─────────────────────────────────────────────────────────────
  const headWidth = headHeight * 0.68;
  const headPath  = isMale ? [
    `M ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
    `C ${X0 - headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop + headHeight * 0.45}`,
    `C ${X0 + headWidth},${yHeadTop + headHeight * 0.68} ${X0 + wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 + wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
    `C ${X0 + wNeck * 0.38},${yChin} ${X0 - wNeck * 0.38},${yChin} ${X0 - wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
    `C ${X0 - wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 - headWidth},${yHeadTop + headHeight * 0.68} ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
    `Z`,
  ].join(' ') : [
    `M ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
    `C ${X0 - headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop + headHeight * 0.42}`,
    `C ${X0 + headWidth},${yHeadTop + headHeight * 0.62} ${X0 + wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 + wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
    `C ${X0 + wNeck * 0.3},${yChin} ${X0 - wNeck * 0.3},${yChin} ${X0 - wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
    `C ${X0 - wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 - headWidth},${yHeadTop + headHeight * 0.62} ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
    `Z`,
  ].join(' ');

  // ── Hair paths ────────────────────────────────────────────────────────────
  const hairPath = isMale
    ? `M 100,${yHeadTop - 1} C ${100 - headWidth - 1},${yHeadTop - 1} ${100 - headWidth - 2},${yHeadTop + headHeight * 0.3} ${100 - headWidth - 2},${yHeadTop + headHeight * 0.42} C ${100 - headWidth + 1},${yHeadTop + headHeight * 0.35} ${100 - headWidth * 0.6},${yHeadTop + headHeight * 0.18} ${100 - headWidth * 0.35},${yHeadTop + headHeight * 0.28} C 100,${yHeadTop + 4} 100,${yHeadTop + 4} ${100 + headWidth * 0.35},${yHeadTop + headHeight * 0.28} C ${100 + headWidth * 0.6},${yHeadTop + headHeight * 0.18} ${100 + headWidth - 1},${yHeadTop + headHeight * 0.35} ${100 + headWidth + 2},${yHeadTop + headHeight * 0.42} C ${100 + headWidth + 2},${yHeadTop + headHeight * 0.3} ${100 + headWidth + 1},${yHeadTop - 1} 100,${yHeadTop - 1} Z`
    : `M 100,${yHeadTop - 1} C ${100 - headWidth - 2},${yHeadTop - 1} ${100 - headWidth - 4},${yHeadTop + headHeight * 0.4} ${100 - headWidth - 4},${yHeadTop + headHeight * 0.72} C ${100 - headWidth - 4},${yHeadTop + headHeight * 0.85} ${100 - headWidth + 2},${yHeadTop + headHeight * 0.8} ${100 - headWidth + 2},${yHeadTop + headHeight * 0.65} C ${100 - headWidth + 2},${yHeadTop + headHeight * 0.42} ${100 - headWidth * 0.6},${yHeadTop + headHeight * 0.2} ${100 - headWidth * 0.3},${yHeadTop + headHeight * 0.35} C 100,${yHeadTop + 6} 100,${yHeadTop + 6} ${100 + headWidth * 0.3},${yHeadTop + headHeight * 0.35} C ${100 + headWidth * 0.6},${yHeadTop + headHeight * 0.2} ${100 + headWidth - 2},${yHeadTop + headHeight * 0.42} ${100 + headWidth - 2},${yHeadTop + headHeight * 0.65} C ${100 + headWidth - 2},${yHeadTop + headHeight * 0.8} ${100 + headWidth + 4},${yHeadTop + headHeight * 0.85} ${100 + headWidth + 4},${yHeadTop + headHeight * 0.72} C ${100 + headWidth + 4},${yHeadTop + headHeight * 0.4} ${100 + headWidth + 2},${yHeadTop - 1} 100,${yHeadTop - 1} Z`;

  // Collarbone feature line
  const collarbonePath = `M 85,${yShoulders + 4} Q 100,${yShoulders + 9} 115,${yShoulders + 4}`;

  return {
    bodyPath,
    armPathR,
    armPathL,
    headPath,
    hairPath,
    collarbonePath,
    yShoulders,
    yChest,
    yWaist,
    yHip,
    yCrotch,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

function DynamicAvatarSvg({
  height      = 170,
  shoulders   = 40,
  chest       = 90,
  waist       = 72,
  hip         = 96,
  armLength   = 60,
  inseam      = 78,
  gender      = 'female',
  skinColor   = '#9CA3AF',
  width       = 200,
  showGuideLines = true,
  bodyPhotoUrl   = null,
}: DynamicAvatarSvgProps) {
  // Preserve 200×450 aspect ratio
  const svgHeight = (width / 200) * 450;

  const geo = useMemo(
    () => computeGeometry(height, shoulders, chest, waist, hip, armLength, inseam, gender),
    [height, shoulders, chest, waist, hip, armLength, inseam, gender],
  );

  const activeSkin = skinColor || '#9CA3AF';

  // Hair / shading overlay colours — fixed translucent tints (no CSS class tokens in SVG)
  const hairFill       = 'rgba(0,0,0,0.14)';
  const collarboneStroke = 'rgba(0,0,0,0.14)';

  return (
    <Svg
      width={width}
      height={svgHeight}
      viewBox="0 0 200 450"
    >
      <Defs>
        <LinearGradient id="mannequinShading" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%"   stopColor="#000000" stopOpacity={0.12} />
          <Stop offset="35%"  stopColor="#FFFFFF" stopOpacity={0.08} />
          <Stop offset="70%"  stopColor="#000000" stopOpacity={0.0}  />
          <Stop offset="100%" stopColor="#000000" stopOpacity={0.15} />
        </LinearGradient>
      </Defs>

      {/* ── Photo mode ───────────────────────────────────────────────────── */}
      {bodyPhotoUrl ? (
        <SvgImage
          href={bodyPhotoUrl}
          x={0}
          y={0}
          width={200}
          height={450}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <>
          {/* Guide lines */}
          {showGuideLines && (
            <G stroke="rgba(100,116,139,0.30)" strokeWidth={0.75} strokeDasharray="2,3">
              <Line x1={15}  y1={geo.yShoulders} x2={185} y2={geo.yShoulders} />
              <Line x1={20}  y1={geo.yChest}     x2={180} y2={geo.yChest}     />
              <Line x1={25}  y1={geo.yWaist}     x2={175} y2={geo.yWaist}     />
              <Line x1={20}  y1={geo.yHip}       x2={180} y2={geo.yHip}       />
              <Line x1={30}  y1={geo.yCrotch}    x2={170} y2={geo.yCrotch}    />
            </G>
          )}

          {/* Silhouette */}
          <G fill={activeSkin} stroke={activeSkin} strokeWidth={1} strokeLinejoin="round">
            <Path d={geo.bodyPath} />
            <Path d={geo.armPathR} />
            <Path d={geo.armPathL} />
            <Path d={geo.headPath} />

            {/* Depth shading overlay */}
            <Path d={geo.bodyPath} fill="url(#mannequinShading)" stroke="none" />
            <Path d={geo.headPath} fill="url(#mannequinShading)" stroke="none" />
          </G>

          {/* Hair */}
          <Path d={geo.hairPath} fill={hairFill} stroke="none" />

          {/* Collarbone feature line */}
          <G stroke={collarboneStroke} strokeWidth={0.5} fill="none">
            <Path d={geo.collarbonePath} />
          </G>
        </>
      )}
    </Svg>
  );
}

export { DynamicAvatarSvg };
