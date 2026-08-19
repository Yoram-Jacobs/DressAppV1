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
    
    // Male and Female shape parameters
    const wShoulders = isMale ? (numSh * 1.25) : (numSh * 1.0);
    const wChest = isMale ? ((numCh / DIVISOR) * 1.1) : ((numCh / DIVISOR) * 0.95);
    const wWaist = isMale ? ((numW / DIVISOR) * 1.02) : ((numW / DIVISOR) * 0.82);
    const wHip = isMale ? ((numHip / DIVISOR) * 0.92) : ((numHip / DIVISOR) * 1.08);
    const wNeck = isMale ? 14 : 9.5;

    // Leg widths (thicker legs, realistic proportions)
    const wOuterKnee = isMale ? (wHip * 0.65) : (wHip * 0.58);
    const wInnerKnee = isMale ? 10.5 : 9.5;
    
    const wOuterAnkle = isMale ? 21 : 18.5;
    const wInnerAnkle = isMale ? 9.5 : 8.0;
    
    const wFootTip = isMale ? 24 : 20;
    const wFootHeel = isMale ? 10 : 8.5;

    // Arm widths
    const wUpperArm = isMale ? 12 : 8.5;
    const wForearm = isMale ? 9.5 : 6.8;

    // --- Build Body Contours Path with Cubic Bezier Curves (C & S) ---
    const pNeckR = `${X0 + wNeck},${yChin}`;
    const pShoulderR = `${X0 + wShoulders},${yShoulders}`;
    const pChestR = `${X0 + wChest},${yChest}`;
    const pWaistR = `${X0 + wWaist},${yWaist}`;
    const pHipR = `${X0 + wHip},${yHip}`;
    const pOuterKneeR = `${X0 + wOuterKnee},${yKnees}`;
    const pOuterAnkleR = `${X0 + wOuterAnkle},${yAnkles}`;
    const pFootTipR = `${X0 + wFootTip},${yFeet}`;
    const pFootHeelR = `${X0 + wFootHeel},${yFeet}`;
    const pInnerAnkleR = `${X0 + wInnerAnkle},${yAnkles}`;
    const pInnerKneeR = `${X0 + wInnerKnee},${yKnees}`;
    const pCrotch = `${X0},${yCrotch}`;

    // Left side (Viewer's left = -X)
    const pInnerKneeL = `${X0 - wInnerKnee},${yKnees}`;
    const pInnerAnkleL = `${X0 - wInnerAnkle},${yAnkles}`;
    const pFootHeelL = `${X0 - wFootHeel},${yFeet}`;
    const pFootTipL = `${X0 - wFootTip},${yFeet}`;
    const pOuterAnkleL = `${X0 - wOuterAnkle},${yAnkles}`;
    const pOuterKneeL = `${X0 - wOuterKnee},${yKnees}`;
    const pHipL = `${X0 - wHip},${yHip}`;
    const pWaistL = `${X0 - wWaist},${yWaist}`;
    const pChestL = `${X0 - wChest},${yChest}`;
    const pShoulderL = `${X0 - wShoulders},${yShoulders}`;
    const pNeckL = `${X0 - wNeck},${yChin}`;

    // Path string assembling Bezier curves
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
    const headWidth = (headHeight * 0.68);
    const headPath = isMale ? [
      `M ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
      `C ${X0 - headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop + headHeight * 0.45}`,
      `C ${X0 + headWidth},${yHeadTop + headHeight * 0.68} ${X0 + wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 + wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
      `C ${X0 + wNeck * 0.38},${yChin} ${X0 - wNeck * 0.38},${yChin} ${X0 - wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
      `C ${X0 - wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 - headWidth},${yHeadTop + headHeight * 0.68} ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
      `Z`
    ].join(' ') : [
      `M ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
      `C ${X0 - headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop + headHeight * 0.42}`,
      `C ${X0 + headWidth},${yHeadTop + headHeight * 0.62} ${X0 + wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 + wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
      `C ${X0 + wNeck * 0.3},${yChin} ${X0 - wNeck * 0.3},${yChin} ${X0 - wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
      `C ${X0 - wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 - headWidth},${yHeadTop + headHeight * 0.62} ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
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
      yFeet,
      headHeight,
      headWidth,
      yHeadTop,
      yChin,
      isMale
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

        {/* Stylized Hair Overlay to make heads look premium and realistically structured */}
        {geometry.isMale ? (
          <path
            d={`M 100,${geometry.yHeadTop - 1}
                C ${100 - geometry.headWidth - 1},${geometry.yHeadTop - 1} ${100 - geometry.headWidth - 2},${geometry.yHeadTop + geometry.headHeight * 0.3} ${100 - geometry.headWidth - 2},${geometry.yHeadTop + geometry.headHeight * 0.42}
                C ${100 - geometry.headWidth + 1},${geometry.yHeadTop + geometry.headHeight * 0.35} ${100 - geometry.headWidth * 0.6},${geometry.yHeadTop + geometry.headHeight * 0.18} ${100 - geometry.headWidth * 0.35},${geometry.yHeadTop + geometry.headHeight * 0.28}
                C 100,${geometry.yHeadTop + 4} 100,${geometry.yHeadTop + 4} ${100 + geometry.headWidth * 0.35},${geometry.yHeadTop + geometry.headHeight * 0.28}
                C ${100 + geometry.headWidth * 0.6},${geometry.yHeadTop + geometry.headHeight * 0.18} ${100 + geometry.headWidth - 1},${geometry.yHeadTop + geometry.headHeight * 0.35} ${100 + geometry.headWidth + 2},${geometry.yHeadTop + geometry.headHeight * 0.42}
                C ${100 + geometry.headWidth + 2},${geometry.yHeadTop + geometry.headHeight * 0.3} ${100 + geometry.headWidth + 1},${geometry.yHeadTop - 1} 100,${geometry.yHeadTop - 1}
                Z`}
            fill="currentColor"
            className="text-black/15 dark:text-white/20 pointer-events-none"
          />
        ) : (
          <path
            d={`M 100,${geometry.yHeadTop - 1}
                C ${100 - geometry.headWidth - 2},${geometry.yHeadTop - 1} ${100 - geometry.headWidth - 4},${geometry.yHeadTop + geometry.headHeight * 0.4} ${100 - geometry.headWidth - 4},${geometry.yHeadTop + geometry.headHeight * 0.72}
                C ${100 - geometry.headWidth - 4},${geometry.yHeadTop + geometry.headHeight * 0.85} ${100 - geometry.headWidth + 2},${geometry.yHeadTop + geometry.headHeight * 0.8} ${100 - geometry.headWidth + 2},${geometry.yHeadTop + geometry.headHeight * 0.65}
                C ${100 - geometry.headWidth + 2},${geometry.yHeadTop + geometry.headHeight * 0.42} ${100 - geometry.headWidth * 0.6},${geometry.yHeadTop + geometry.headHeight * 0.2} ${100 - geometry.headWidth * 0.3},${geometry.yHeadTop + geometry.headHeight * 0.35}
                C 100,${geometry.yHeadTop + 6} 100,${geometry.yHeadTop + 6} ${100 + geometry.headWidth * 0.3},${geometry.yHeadTop + geometry.headHeight * 0.35}
                C ${100 + geometry.headWidth * 0.6},${geometry.yHeadTop + geometry.headHeight * 0.2} ${100 + geometry.headWidth - 2},${geometry.yHeadTop + geometry.headHeight * 0.42} ${100 + geometry.headWidth - 2},${geometry.yHeadTop + geometry.headHeight * 0.65}
                C ${100 + geometry.headWidth - 2},${geometry.yHeadTop + geometry.headHeight * 0.8} ${100 + geometry.headWidth + 4},${geometry.yHeadTop + geometry.headHeight * 0.85} ${100 + geometry.headWidth + 4},${geometry.yHeadTop + geometry.headHeight * 0.72}
                C ${100 + geometry.headWidth + 4},${geometry.yHeadTop + geometry.headHeight * 0.4} ${100 + geometry.headWidth + 2},${geometry.yHeadTop - 1} 100,${geometry.yHeadTop - 1}
                Z`}
            fill="currentColor"
            className="text-black/15 dark:text-white/20 pointer-events-none"
          />
        )}

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
