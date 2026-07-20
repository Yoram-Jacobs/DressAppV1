import React, { useMemo } from 'react';

/**
 * Dynamic 2D Human Avatar Generator for DressApp.
 * Accepts numeric measurements (cm), gender, and skin tone color.
 * Generates an SVG mannequin silhouette using dynamic cubic Bezier curves (C & S commands).
 * Fixed viewBox (0 0 200 450) ensures dramatic 1-to-1 dynamic morphing when parameters change.
 */
export default function DynamicAvatar({
  height = 170,
  shoulders = 40,
  chest = 90,
  waist = 72,
  hip = 96,
  armLength = 60,
  inseam = 78,
  gender = 'female',
  skinColor = '#9CA3AF',
  className = '',
  showGuideLines = true,
  children
}) {
  // 1. Calculate dynamic geometry & Bezier curve coordinates in fixed 0 0 200 450 viewBox
  const geometry = useMemo(() => {
    // Parse numeric inputs safely
    const numH = Math.max(130, Math.min(215, Number(height) || 170));
    const numSh = Math.max(28, Math.min(58, Number(shoulders) || 40));
    const numCh = Math.max(65, Math.min(138, Number(chest) || 90));
    const numW = Math.max(54, Math.min(128, Number(waist) || 72));
    const numHip = Math.max(68, Math.min(148, Number(hip) || 96));
    const numArm = Math.max(42, Math.min(85, Number(armLength) || 60));
    const numIns = Math.max(52, Math.min(100, Number(inseam) || 78));
    const isMale = String(gender).toLowerCase() === 'male';

    // SVG Fixed Coordinate Space
    const X0 = 100; // Center X axis
    const viewBoxHeight = 450;
    
    // Scale body height proportionally to height input in cm
    // 170cm reference => 360 SVG height units
    const totalBodySvgHeight = 360 * (numH / 170.0);
    const yHeadTop = (viewBoxHeight - totalBodySvgHeight) / 2 + 10;
    const yFeet = yHeadTop + totalBodySvgHeight;

    // Head & Neck
    const headHeight = totalBodySvgHeight / 7.3;
    const yChin = yHeadTop + headHeight;
    const neckHeight = totalBodySvgHeight * 0.045;
    const yShoulders = yChin + neckHeight;

    // Inseam & Legs
    const inseamSvg = totalBodySvgHeight * (numIns / numH);
    const yAnkles = yFeet - 18;
    const yCrotch = yFeet - inseamSvg;

    const torsoHeight = yCrotch - yShoulders;
    const yChest = yShoulders + torsoHeight * (isMale ? 0.30 : 0.26);
    const yWaist = yShoulders + torsoHeight * (isMale ? 0.62 : 0.58);
    const yHip = yShoulders + torsoHeight * 0.88;
    const yKnees = yCrotch + inseamSvg * 0.48;

    // Arms
    const armSvg = totalBodySvgHeight * (numArm / numH);
    const yElbow = yShoulders + armSvg * 0.48;
    const yWrist = yShoulders + armSvg * 0.88;
    const yHandTip = yShoulders + armSvg;

    // Anatomical Ellipse Divisor (~2.65) to convert circumferences to flat front widths
    const DIVISOR = 2.65;
    const wShoulders = (numSh * 1.1) * (isMale ? 1.05 : 0.95);
    const wChest = ((numCh / DIVISOR) * 1.05) * (isMale ? 1.02 : 1.0);
    const wWaist = ((numW / DIVISOR) * 1.0) * (isMale ? 0.98 : 0.90);
    const wHip = ((numHip / DIVISOR) * 1.05) * (isMale ? 0.93 : 1.05);
    const wNeck = isMale ? 13 : 10;

    // Arm widths
    const wUpperArm = isMale ? 11 : 8.5;
    const wForearm = isMale ? 8.5 : 6.5;

    // --- Build Body Contours Path with Cubic Bezier Curves (C & S) ---
    const pNeckR = `${X0 + wNeck},${yChin}`;
    const pShoulderR = `${X0 + wShoulders},${yShoulders}`;
    const pChestR = `${X0 + wChest},${yChest}`;
    const pWaistR = `${X0 + wWaist},${yWaist}`;
    const pHipR = `${X0 + wHip},${yHip}`;
    const pOuterKneeR = `${X0 + wHip * 0.52},${yKnees}`;
    const pOuterAnkleR = `${X0 + 15},${yAnkles}`;
    const pFootTipR = `${X0 + 17},${yFeet}`;
    const pFootHeelR = `${X0 + 7},${yFeet}`;
    const pInnerAnkleR = `${X0 + 6},${yAnkles}`;
    const pInnerKneeR = `${X0 + 7.5},${yKnees}`;
    const pCrotch = `${X0},${yCrotch}`;

    // Left side (Viewer's left = -X)
    const pInnerKneeL = `${X0 - 7.5},${yKnees}`;
    const pInnerAnkleL = `${X0 - 6},${yAnkles}`;
    const pFootHeelL = `${X0 - 7},${yFeet}`;
    const pFootTipL = `${X0 - 17},${yFeet}`;
    const pOuterAnkleL = `${X0 - 15},${yAnkles}`;
    const pOuterKneeL = `${X0 - wHip * 0.52},${yKnees}`;
    const pHipL = `${X0 - wHip},${yHip}`;
    const pWaistL = `${X0 - wWaist},${yWaist}`;
    const pChestL = `${X0 - wChest},${yChest}`;
    const pShoulderL = `${X0 - wShoulders},${yShoulders}`;
    const pNeckL = `${X0 - wNeck},${yChin}`;

    // Path string assembling Bezier curves
    const bodyPath = [
      `M ${pNeckR}`,
      `C ${X0 + wNeck + (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.7} ${X0 + wShoulders * 0.9},${yShoulders - 2} ${pShoulderR}`,
      `C ${X0 + wShoulders * 0.95},${yShoulders + (yChest - yShoulders) * 0.6} ${X0 + wChest + 2},${yChest - 5} ${pChestR}`,
      `C ${X0 + wChest - 1},${yChest + (yWaist - yChest) * 0.5} ${X0 + wWaist + (isMale ? 1 : -2)},${yWaist - 8} ${pWaistR}`,
      `C ${X0 + wWaist + (isMale ? 2 : 5)},${yWaist + (yHip - yWaist) * 0.4} ${X0 + wHip + 1},${yHip - 8} ${pHipR}`,
      `C ${X0 + wHip},${yHip + (yKnees - yHip) * 0.3} ${X0 + wHip * 0.65},${yKnees - 15} ${pOuterKneeR}`,
      `C ${X0 + wHip * 0.42},${yKnees + 20} ${X0 + 18},${yAnkles - 15} ${pOuterAnkleR}`,
      `L ${pFootTipR} L ${pFootHeelR}`,
      `L ${pInnerAnkleR}`,
      `C ${X0 + 6},${yAnkles - 20} ${X0 + 7},${yKnees + 20} ${pInnerKneeR}`,
      `C ${X0 + 8},${yKnees - 20} ${X0 + 3},${yCrotch + 15} ${pCrotch}`,
      `C ${X0 - 3},${yCrotch + 15} ${X0 - 8},${yKnees - 20} ${pInnerKneeL}`,
      `C ${X0 - 7},${yKnees + 20} ${X0 - 6},${yAnkles - 20} ${pInnerAnkleL}`,
      `L ${pFootHeelL} L ${pFootTipL} L ${pOuterAnkleL}`,
      `C ${X0 - 18},${yAnkles - 15} ${X0 - wHip * 0.42},${yKnees + 20} ${pOuterKneeL}`,
      `C ${X0 - wHip * 0.65},${yKnees - 15} ${X0 - wHip},${yHip + (yKnees - yHip) * 0.3} ${pHipL}`,
      `C ${X0 - wHip - 1},${yHip - 8} ${X0 - wWaist - (isMale ? 2 : 5)},${yWaist + (yHip - yWaist) * 0.4} ${pWaistL}`,
      `C ${X0 - wWaist - (isMale ? 1 : -2)},${yWaist - 8} ${X0 - wChest + 1},${yChest + (yWaist - yChest) * 0.5} ${pChestL}`,
      `C ${X0 - wChest - 2},${yChest - 5} ${X0 - wShoulders * 0.95},${yShoulders + (yChest - yShoulders) * 0.6} ${pShoulderL}`,
      `C ${X0 - wShoulders * 0.9},${yShoulders - 2} ${X0 - wNeck - (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.7} ${pNeckL}`,
      `Z`
    ].join(' ');

    // --- Arms Paths ---
    const armPathR = [
      `M ${X0 + wShoulders - 1},${yShoulders + 2}`,
      `C ${X0 + wShoulders + wUpperArm},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 + wShoulders + wForearm + 2},${yElbow} ${X0 + wShoulders + wForearm + 1},${yElbow + 10}`,
      `C ${X0 + wShoulders + wForearm},${yElbow + (yWrist - yElbow) * 0.5} ${X0 + wShoulders + 5},${yWrist - 5} ${X0 + wShoulders + 4},${yWrist}`,
      `C ${X0 + wShoulders + 3},${yWrist + 5} ${X0 + wShoulders + 4},${yHandTip - 5} ${X0 + wShoulders + 2},${yHandTip}`,
      `C ${X0 + wShoulders - 2},${yHandTip} ${X0 + wShoulders - 2},${yWrist + 5} ${X0 + wShoulders - 2},${yWrist}`,
      `C ${X0 + wShoulders - 2},${yWrist - 5} ${X0 + wChest + 2},${yElbow + 5} ${X0 + wChest + 1},${yChest + 5}`,
      `Z`
    ].join(' ');

    const armPathL = [
      `M ${X0 - wShoulders + 1},${yShoulders + 2}`,
      `C ${X0 - wShoulders - wUpperArm},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 - wShoulders - wForearm - 2},${yElbow} ${X0 - wShoulders - wForearm - 1},${yElbow + 10}`,
      `C ${X0 - wShoulders - wForearm},${yElbow + (yWrist - yElbow) * 0.5} ${X0 - wShoulders - 5},${yWrist - 5} ${X0 - wShoulders - 4},${yWrist}`,
      `C ${X0 - wShoulders - 3},${yWrist + 5} ${X0 - wShoulders - 4},${yHandTip - 5} ${X0 - wShoulders - 2},${yHandTip}`,
      `C ${X0 - wShoulders + 2},${yHandTip} ${X0 - wShoulders + 2},${yWrist + 5} ${X0 - wShoulders + 2},${yWrist}`,
      `C ${X0 - wShoulders + 2},${yWrist - 5} ${X0 - wChest - 2},${yElbow + 5} ${X0 - wChest - 1},${yChest + 5}`,
      `Z`
    ].join(' ');

    // Head Contour Path
    const headWidth = (headHeight * 0.72);
    const headPath = [
      `M ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
      `C ${X0 - headWidth},${yHeadTop - 5} ${X0 + headWidth},${yHeadTop - 5} ${X0 + headWidth},${yHeadTop + headHeight * 0.45}`,
      `C ${X0 + headWidth},${yHeadTop + headHeight * 0.8} ${X0 + wNeck + 1},${yChin} ${X0},${yChin}`,
      `C ${X0 - wNeck - 1},${yChin} ${X0 - headWidth},${yHeadTop + headHeight * 0.8} ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
      `Z`
    ].join(' ');

    return {
      viewBoxHeight,
      bodyPath,
      armPathR,
      armPathL,
      headPath,
      yShoulders,
      yChest,
      yWaist,
      yHip,
      yCrotch,
      yFeet
    };
  }, [height, shoulders, chest, waist, hip, armLength, inseam, gender]);

  const activeSkinColor = skinColor || '#9CA3AF';

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 200 450"
        className="w-full h-full drop-shadow-md transition-all duration-300 ease-out"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          <linearGradient id="mannequinShading" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
            <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Mannequin Guide Lines */}
        {showGuideLines && (
          <g className="text-slate-400/30 dark:text-slate-500/30 stroke-current stroke-[0.75] stroke-dasharray-[2,3]">
            <line x1="15" y1={geometry.yShoulders} x2="185" y2={geometry.yShoulders} />
            <line x1="20" y1={geometry.yChest} x2="180" y2={geometry.yChest} />
            <line x1="25" y1={geometry.yWaist} x2="175" y2={geometry.yWaist} />
            <line x1="20" y1={geometry.yHip} x2="180" y2={geometry.yHip} />
            <line x1="30" y1={geometry.yCrotch} x2="170" y2={geometry.yCrotch} />
          </g>
        )}

        {/* --- Silhouette Paths --- */}
        <g fill={activeSkinColor} stroke={activeSkinColor} strokeWidth="1" strokeLinejoin="round">
          <path d={geometry.bodyPath} className="transition-all duration-300" />
          <path d={geometry.armPathR} className="transition-all duration-300" />
          <path d={geometry.armPathL} className="transition-all duration-300" />
          <path d={geometry.headPath} className="transition-all duration-300" />

          {/* Depth Shading Overlay */}
          <path d={geometry.bodyPath} fill="url(#mannequinShading)" stroke="none" />
          <path d={geometry.headPath} fill="url(#mannequinShading)" stroke="none" />
        </g>

        {/* Collarbone Feature Line */}
        <g stroke="currentColor" strokeWidth="0.5" className="text-black/15 dark:text-white/20 fill-none">
          <path d={`M 85,${geometry.yShoulders + 4} Q 100,${geometry.yShoulders + 9} 115,${geometry.yShoulders + 4}`} />
        </g>
      </svg>

      {/* Garment / Overlay Children Slot */}
      {children}
    </div>
  );
}
