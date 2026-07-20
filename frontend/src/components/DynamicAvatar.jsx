import React, { useMemo } from 'react';

/**
 * Dynamic 2D Human Avatar Generator for DressApp.
 * Accepts numeric measurements (cm), gender, and skin tone color.
 * Generates an SVG mannequin silhouette using dynamic cubic Bezier curves (C & S commands).
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
  // 1. Calculate dynamic geometry & Bezier curve coordinates
  const geometry = useMemo(() => {
    // Parse numeric inputs safely
    const numH = Math.max(120, Math.min(220, Number(height) || 170));
    const numSh = Math.max(25, Math.min(60, Number(shoulders) || 40));
    const numCh = Math.max(60, Math.min(140, Number(chest) || 90));
    const numW = Math.max(50, Math.min(130, Number(waist) || 72));
    const numHip = Math.max(65, Math.min(150, Number(hip) || 96));
    const numArm = Math.max(40, Math.min(90, Number(armLength) || 60));
    const numIns = Math.max(50, Math.min(105, Number(inseam) || 78));
    const isMale = String(gender).toLowerCase() === 'male';

    // SVG coordinate space
    // Scale factor: 2.0 SVG units per cm
    const scale = 2.0;
    const X0 = 100; // Center X axis
    const topPad = 25;

    const totalBodySvgHeight = numH * scale;
    const viewBoxHeight = totalBodySvgHeight + topPad + 30; // bounding box height proportional to Height input

    // Anatomical Y-coordinates
    const yHeadTop = topPad;
    const headHeight = totalBodySvgHeight / 7.4;
    const yChin = yHeadTop + headHeight;
    const neckHeight = totalBodySvgHeight * 0.042;
    const yShoulders = yChin + neckHeight;

    const inseamSvg = numIns * scale;
    const yFeet = yHeadTop + totalBodySvgHeight;
    const yAnkles = yFeet - 18;
    const yCrotch = yFeet - inseamSvg;

    const torsoHeight = yCrotch - yShoulders;
    const yChest = yShoulders + torsoHeight * (isMale ? 0.30 : 0.27);
    const yWaist = yShoulders + torsoHeight * (isMale ? 0.62 : 0.58);
    const yHip = yShoulders + torsoHeight * 0.88;
    const yKnees = yCrotch + inseamSvg * 0.48;

    // Arms
    const armSvg = numArm * scale;
    const yElbow = yShoulders + armSvg * 0.48;
    const yWrist = yShoulders + armSvg * 0.88;
    const yHandTip = yShoulders + armSvg;

    // Anatomical Ellipse Divisor (~2.65) to convert circumferences to flat front widths
    const DIVISOR = 2.65;
    const wShoulders = (numSh * scale) / 2 * (isMale ? 1.04 : 0.96);
    const wChest = ((numCh / DIVISOR) * scale) / 2 * (isMale ? 1.02 : 1.0);
    const wWaist = ((numW / DIVISOR) * scale) / 2 * (isMale ? 0.98 : 0.92);
    const wHip = ((numHip / DIVISOR) * scale) / 2 * (isMale ? 0.94 : 1.04);
    const wNeck = isMale ? 13 : 10;

    // Arm widths
    const wUpperArm = isMale ? 10 : 8;
    const wForearm = isMale ? 8 : 6.5;

    // --- Build Body Contours Path with Cubic Bezier Curves (C & S) ---
    // Right side (Viewer's right = +X)
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
      // Shoulder slope
      `C ${X0 + wNeck + (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.7} ${X0 + wShoulders * 0.9},${yShoulders - 2} ${pShoulderR}`,
      // Armpit to Chest
      `C ${X0 + wShoulders * 0.95},${yShoulders + (yChest - yShoulders) * 0.6} ${X0 + wChest + 2},${yChest - 5} ${pChestR}`,
      // Chest to Waist (concave curve)
      `C ${X0 + wChest - 1},${yChest + (yWaist - yChest) * 0.5} ${X0 + wWaist + (isMale ? 1 : -2)},${yWaist - 8} ${pWaistR}`,
      // Waist to Hip (convex curve using S / C)
      `C ${X0 + wWaist + (isMale ? 2 : 5)},${yWaist + (yHip - yWaist) * 0.4} ${X0 + wHip + 1},${yHip - 8} ${pHipR}`,
      // Hip to Outer Knee
      `C ${X0 + wHip},${yHip + (yKnees - yHip) * 0.3} ${X0 + wHip * 0.65},${yKnees - 15} ${pOuterKneeR}`,
      // Outer Knee to Outer Ankle
      `C ${X0 + wHip * 0.42},${yKnees + 20} ${X0 + 18},${yAnkles - 15} ${pOuterAnkleR}`,
      // Foot R
      `L ${pFootTipR} L ${pFootHeelR}`,
      // Inner Ankle R to Inner Knee R
      `L ${pInnerAnkleR}`,
      `C ${X0 + 6},${yAnkles - 20} ${X0 + 7},${yKnees + 20} ${pInnerKneeR}`,
      // Inner Knee R to Crotch
      `C ${X0 + 8},${yKnees - 20} ${X0 + 3},${yCrotch + 15} ${pCrotch}`,
      // Crotch to Inner Knee L
      `C ${X0 - 3},${yCrotch + 15} ${X0 - 8},${yKnees - 20} ${pInnerKneeL}`,
      // Inner Knee L to Inner Ankle L
      `C ${X0 - 7},${yKnees + 20} ${X0 - 6},${yAnkles - 20} ${pInnerAnkleL}`,
      // Foot L
      `L ${pFootHeelL} L ${pFootTipL} L ${pOuterAnkleL}`,
      // Outer Ankle L to Outer Knee L
      `C ${X0 - 18},${yAnkles - 15} ${X0 - wHip * 0.42},${yKnees + 20} ${pOuterKneeL}`,
      // Outer Knee L to Hip L
      `C ${X0 - wHip * 0.65},${yKnees - 15} ${X0 - wHip},${yHip + (yKnees - yHip) * 0.3} ${pHipL}`,
      // Hip L to Waist L
      `C ${X0 - wHip - 1},${yHip - 8} ${X0 - wWaist - (isMale ? 2 : 5)},${yWaist + (yHip - yWaist) * 0.4} ${pWaistL}`,
      // Waist L to Chest L
      `C ${X0 - wWaist - (isMale ? 1 : -2)},${yWaist - 8} ${X0 - wChest + 1},${yChest + (yWaist - yChest) * 0.5} ${pChestL}`,
      // Chest L to Shoulder L
      `C ${X0 - wChest - 2},${yChest - 5} ${X0 - wShoulders * 0.95},${yShoulders + (yChest - yShoulders) * 0.6} ${pShoulderL}`,
      // Shoulder L to Neck L
      `C ${X0 - wShoulders * 0.9},${yShoulders - 2} ${X0 - wNeck - (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.7} ${pNeckL}`,
      `Z`
    ].join(' ');

    // --- Arms Paths (Left & Right) ---
    // Right Arm
    const armPathR = [
      `M ${X0 + wShoulders - 1},${yShoulders + 2}`,
      `C ${X0 + wShoulders + wUpperArm},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 + wShoulders + wForearm + 2},${yElbow} ${X0 + wShoulders + wForearm + 1},${yElbow + 10}`,
      `C ${X0 + wShoulders + wForearm},${yElbow + (yWrist - yElbow) * 0.5} ${X0 + wShoulders + 5},${yWrist - 5} ${X0 + wShoulders + 4},${yWrist}`,
      `C ${X0 + wShoulders + 3},${yWrist + 5} ${X0 + wShoulders + 4},${yHandTip - 5} ${X0 + wShoulders + 2},${yHandTip}`,
      `C ${X0 + wShoulders - 2},${yHandTip} ${X0 + wShoulders - 2},${yWrist + 5} ${X0 + wShoulders - 2},${yWrist}`,
      `C ${X0 + wShoulders - 2},${yWrist - 5} ${X0 + wChest + 2},${yElbow + 5} ${X0 + wChest + 1},${yChest + 5}`,
      `Z`
    ].join(' ');

    // Left Arm
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

  // Skin tone color fallback to default gray `#9CA3AF`
  const activeSkinColor = skinColor || '#9CA3AF';

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox={`0 0 200 ${geometry.viewBoxHeight}`}
        className="w-full h-full drop-shadow-md transition-all duration-300 ease-out"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          {/* Subtle gradient overlay for 3D digital mannequin depth */}
          <linearGradient id="mannequinShading" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
            <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Mannequin Guide Lines (Optional visual styling lines) */}
        {showGuideLines && (
          <g className="text-slate-400/30 dark:text-slate-500/30 stroke-current stroke-[0.75] stroke-dasharray-[2,3]">
            {/* Shoulder Guide Line */}
            <line x1="15" y1={geometry.yShoulders} x2="185" y2={geometry.yShoulders} />
            {/* Chest Guide Line */}
            <line x1="20" y1={geometry.yChest} x2="180" y2={geometry.yChest} />
            {/* Waist Guide Line */}
            <line x1="25" y1={geometry.yWaist} x2="175" y2={geometry.yWaist} />
            {/* Hip Guide Line */}
            <line x1="20" y1={geometry.yHip} x2="180" y2={geometry.yHip} />
            {/* Inseam/Crotch Guide Line */}
            <line x1="30" y1={geometry.yCrotch} x2="170" y2={geometry.yCrotch} />
          </g>
        )}

        {/* --- Silhouette Paths filled with chosen skinColor --- */}
        <g fill={activeSkinColor} stroke={activeSkinColor} strokeWidth="1" strokeLinejoin="round">
          {/* Main Torso & Lower Body */}
          <path d={geometry.bodyPath} className="transition-all duration-300" />

          {/* Right Arm */}
          <path d={geometry.armPathR} className="transition-all duration-300" />

          {/* Left Arm */}
          <path d={geometry.armPathL} className="transition-all duration-300" />

          {/* Head */}
          <path d={geometry.headPath} className="transition-all duration-300" />

          {/* Depth Shading Overlay */}
          <path d={geometry.bodyPath} fill="url(#mannequinShading)" stroke="none" />
          <path d={geometry.headPath} fill="url(#mannequinShading)" stroke="none" />
        </g>

        {/* Minimalist Mannequin Joints & Neck Feature Lines */}
        <g stroke="currentColor" strokeWidth="0.5" className="text-black/15 dark:text-white/20 fill-none">
          {/* Collarbones */}
          <path d={`M 85,${geometry.yShoulders + 4} Q 100,${geometry.yShoulders + 9} 115,${geometry.yShoulders + 4}`} />
        </g>
      </svg>

      {/* Garment / Overlay Children Slot */}
      {children}
    </div>
  );
}
