import React, { Suspense, useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MALE_GLB_URL = '/models/avatar_male_1.glb';
const FEMALE_GLB_URL = '/models/avatar_female_1.glb';

// Cache rendered 3D WebGL snapshots (`data:image/png;base64,...`) keyed by avatar signature
// so grids with 40+ Saved Outfit cards can render the 3D avatar instantaneously without
// exceeding the browser's 8-16 active WebGL context limit.
const rendered3DAvatarSnapshotCache = new Map();
const snapshotSubscribers = new Set();
const slotReleaseSubscribers = new Set();
let activeWebGLCanvasCount = 0;
const MAX_CONCURRENT_WEBGL_CANVASES = 2;

function notifySnapshotSubscribers(sig, dataUrl) {
  rendered3DAvatarSnapshotCache.set(sig, dataUrl);
  snapshotSubscribers.forEach((cb) => {
    try {
      cb(sig, dataUrl);
    } catch {
      /* ignore */
    }
  });
}

function notifySlotReleased() {
  for (const cb of slotReleaseSubscribers) {
    try {
      if (activeWebGLCanvasCount < MAX_CONCURRENT_WEBGL_CANVASES) {
        cb();
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Builds Cubic-Bezier 2D SVG silhouette paths matched to the 3D MB-Lab avatar's
 * exact A-stance legs, outstretched arms, torso, and head landmarks.
 * Used as an instant zero-WebGL fallback while the 3D GLB mesh loads or when
 * dozens of Saved Outfit cards are rendered simultaneously.
 */
function buildAvatarSvgSilhouettePaths(anatomy) {
  const {
    X0 = 100,
    isMale,
    yHeadTop,
    yChin,
    yShoulders,
    yChest,
    yWaist,
    yHip,
    yCrotch,
    yKnees,
    yAnkles,
    yFeet,
    yElbow,
    yWrist,
    yHandTip,
    wNeck,
    wShoulders,
    wChest,
    wWaist,
    wHip,
    wOuterKnee,
    wInnerKnee,
    wOuterAnkle,
    wInnerAnkle,
    wFootTip,
    wFootHeel,
    wElbowOut,
    wElbowIn,
    wWristOut,
    wWristIn,
  } = anatomy;

  const headHeight = yChin - yHeadTop;
  const neckHeight = yShoulders - yChin;
  const headWidth = headHeight * 0.68;

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

  const bodyPath = [
    `M ${pNeckR}`,
    `C ${X0 + wNeck + (wShoulders - wNeck) * 0.45},${yChin + neckHeight * 0.55} ${X0 + wShoulders * 0.82},${yShoulders - 0.5} ${pShoulderR}`,
    `C ${X0 + wShoulders + 1.5},${yShoulders + 10} ${X0 + wChest + 2},${yChest - 5} ${pChestR}`,
    `C ${X0 + wChest - (isMale ? 1 : 2.5)},${yChest + (yWaist - yChest) * 0.5} ${X0 + wWaist + (isMale ? 1.5 : -1.5)},${yWaist - 8} ${pWaistR}`,
    `C ${X0 + wWaist + (isMale ? 1 : 3.5)},${yWaist + (yHip - yWaist) * 0.5} ${X0 + wHip + 1.5},${yHip - 8} ${pHipR}`,
    `C ${X0 + wHip + 1},${yHip + (yKnees - yHip) * 0.4} ${X0 + wOuterKnee - 1.5},${yKnees - 12} ${pOuterKneeR}`,
    `C ${X0 + wOuterKnee + 1.5},${yKnees + 15} ${X0 + wOuterAnkle - 1.5},${yAnkles - 15} ${pOuterAnkleR}`,
    `L ${pFootTipR} L ${pFootHeelR}`,
    `L ${pInnerAnkleR}`,
    `C ${X0 + wInnerAnkle - 1.5},${yAnkles - 15} ${X0 + wInnerKnee + 1.5},${yKnees + 15} ${pInnerKneeR}`,
    `C ${X0 + wInnerKnee - 2},${yKnees - 15} ${X0 + 4},${yCrotch + 8} ${pCrotch}`,
    `C ${X0 - 4},${yCrotch + 8} ${X0 - wInnerKnee + 2},${yKnees - 15} ${pInnerKneeL}`,
    `C ${X0 - wInnerKnee - 1.5},${yKnees + 15} ${X0 - wInnerAnkle + 1.5},${yAnkles - 15} ${pInnerAnkleL}`,
    `L ${pFootHeelL} L ${pFootTipL} L ${pOuterAnkleL}`,
    `C ${X0 - wOuterAnkle + 1.5},${yAnkles - 15} ${X0 - wOuterKnee - 1.5},${yKnees + 15} ${pOuterKneeL}`,
    `C ${X0 - wOuterKnee + 1.5},${yKnees - 12} ${X0 - wHip - 1},${yHip + (yKnees - yHip) * 0.4} ${pHipL}`,
    `C ${X0 - wHip - 1.5},${yHip - 8} ${X0 - wWaist - (isMale ? 1 : 3.5)},${yWaist + (yHip - yWaist) * 0.5} ${pWaistL}`,
    `C ${X0 - wWaist - (isMale ? 1.5 : -1.5)},${yWaist - 8} ${X0 - wChest + (isMale ? 1 : 2.5)},${yChest + (yWaist - yChest) * 0.5} ${pChestL}`,
    `C ${X0 - wChest - 2},${yChest - 5} ${X0 - wShoulders - 1.5},${yShoulders + 10} ${pShoulderL}`,
    `C ${X0 - wShoulders * 0.82},${yShoulders - 0.5} ${X0 - wNeck - (wShoulders - wNeck) * 0.45},${yChin + neckHeight * 0.55} ${pNeckL}`,
    `Z`,
  ].join(' ');

  const armThickUpper = isMale ? 9.5 : 8.0;
  const wHandOut = wWristOut + 2.0;
  const wHandIn = wWristIn - 1.0;

  const armPathR = [
    `M ${X0 + wShoulders - 1},${yShoulders + 1}`,
    `C ${X0 + wShoulders + 4},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 + wElbowOut - 2},${yElbow - 6} ${X0 + wElbowOut},${yElbow}`,
    `C ${X0 + wElbowOut + 2},${yElbow + (yWrist - yElbow) * 0.45} ${X0 + wWristOut - 1.5},${yWrist - 5} ${X0 + wWristOut},${yWrist}`,
    `C ${X0 + wWristOut + 1},${yWrist + 5} ${X0 + wHandOut},${yHandTip - 3} ${X0 + wHandOut - 1},${yHandTip}`,
    `C ${X0 + wHandOut - 3},${yHandTip + 1} ${X0 + wHandIn + 1},${yHandTip} ${X0 + wHandIn},${yHandTip - 3}`,
    `C ${X0 + wHandIn},${yHandTip - 6} ${X0 + wWristIn + 1},${yWrist + 4} ${X0 + wWristIn},${yWrist}`,
    `C ${X0 + wWristIn - 1.5},${yElbow + (yWrist - yElbow) * 0.45} ${X0 + wElbowIn + 1.5},${yElbow + 6} ${X0 + wElbowIn},${yElbow}`,
    `C ${X0 + wElbowIn - 1.5},${yShoulders + (yElbow - yShoulders) * 0.5} ${X0 + wShoulders - armThickUpper},${yShoulders + 12} ${X0 + wShoulders - armThickUpper},${yShoulders + 5}`,
    `Z`,
  ].join(' ');

  const armPathL = [
    `M ${X0 - wShoulders + 1},${yShoulders + 1}`,
    `C ${X0 - wShoulders - 4},${yShoulders + (yElbow - yShoulders) * 0.4} ${X0 - wElbowOut + 2},${yElbow - 6} ${X0 - wElbowOut},${yElbow}`,
    `C ${X0 - wElbowOut - 2},${yElbow + (yWrist - yElbow) * 0.45} ${X0 - wWristOut + 1.5},${yWrist - 5} ${X0 - wWristOut},${yWrist}`,
    `C ${X0 - wWristOut - 1},${yWrist + 5} ${X0 - wHandOut},${yHandTip - 3} ${X0 - wHandOut + 1},${yHandTip}`,
    `C ${X0 - wHandOut + 3},${yHandTip + 1} ${X0 - wHandIn - 1},${yHandTip} ${X0 - wHandIn},${yHandTip - 3}`,
    `C ${X0 - wHandIn},${yHandTip - 6} ${X0 - wWristIn - 1},${yWrist + 4} ${X0 - wWristIn},${yWrist}`,
    `C ${X0 - wWristIn + 1.5},${yElbow + (yWrist - yElbow) * 0.45} ${X0 - wElbowIn - 1.5},${yElbow + 6} ${X0 - wElbowIn},${yElbow}`,
    `C ${X0 - wElbowIn + 1.5},${yShoulders + (yElbow - yShoulders) * 0.5} ${X0 - wShoulders + armThickUpper},${yShoulders + 12} ${X0 - wShoulders + armThickUpper},${yShoulders + 5}`,
    `Z`,
  ].join(' ');

  const headPath = isMale
    ? [
        `M ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
        `C ${X0 - headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop - 2} ${X0 + headWidth},${yHeadTop + headHeight * 0.45}`,
        `C ${X0 + headWidth},${yHeadTop + headHeight * 0.68} ${X0 + wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 + wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
        `C ${X0 + wNeck * 0.38},${yChin} ${X0 - wNeck * 0.38},${yChin} ${X0 - wNeck * 0.65},${yHeadTop + headHeight * 0.94}`,
        `C ${X0 - wNeck * 0.95},${yHeadTop + headHeight * 0.85} ${X0 - headWidth},${yHeadTop + headHeight * 0.68} ${X0 - headWidth},${yHeadTop + headHeight * 0.45}`,
        `Z`,
      ].join(' ')
    : [
        `M ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
        `C ${X0 - headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop - 4} ${X0 + headWidth},${yHeadTop + headHeight * 0.42}`,
        `C ${X0 + headWidth},${yHeadTop + headHeight * 0.62} ${X0 + wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 + wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
        `C ${X0 + wNeck * 0.3},${yChin} ${X0 - wNeck * 0.3},${yChin} ${X0 - wNeck * 0.55},${yHeadTop + headHeight * 0.92}`,
        `C ${X0 - wNeck * 0.9},${yHeadTop + headHeight * 0.8} ${X0 - headWidth},${yHeadTop + headHeight * 0.62} ${X0 - headWidth},${yHeadTop + headHeight * 0.42}`,
        `Z`,
      ].join(' ');

  return { bodyPath, armPathR, armPathL, headPath };
}

/**
 * Dynamic 2D Human Avatar Generator for DressApp.
 * Accepts numeric measurements (cm), gender, and skin tone color.
 * Generates an SVG mannequin silhouette using dynamic cubic Bezier curves (C & S commands).
 * Fixed viewBox (0 0 200 450) ensures dramatic 1-to-1 dynamic morphing when parameters change.
 */
export function getFullAvatarAnatomy({
  height = 170,
  shoulders = 40,
  chest = 90,
  waist = 72,
  hip = 96,
  armLength = 60,
  inseam = 78,
  footLength = 24.5,
  gender = 'female'
} = {}) {
  const numH = Math.max(130, Math.min(215, Number(height) || 170));
  const numSh = Math.max(28, Math.min(58, Number(shoulders) || 40));
  const numCh = Math.max(65, Math.min(138, Number(chest) || 90));
  const numW = Math.max(54, Math.min(128, Number(waist) || 72));
  const numHip = Math.max(68, Math.min(148, Number(hip) || 96));
  const numArm = Math.max(42, Math.min(85, Number(armLength) || 60));
  const numIns = Math.max(52, Math.min(100, Number(inseam) || 78));
  const numFoot = Math.max(19, Math.min(33, Number(footLength) || (String(gender).toLowerCase() === 'male' ? 27.0 : 24.5)));
  const isMale = String(gender).toLowerCase() === 'male';

  const X0 = 100;
  const viewBoxHeight = 450;
  const totalBodySvgHeight = 360 * (numH / 170.0);
  const yHeadTop = (viewBoxHeight - totalBodySvgHeight) / 2 + 10;
  const yFeet = yHeadTop + totalBodySvgHeight;

  const headHeight = totalBodySvgHeight * 0.130;
  const yChin = yHeadTop + headHeight;
  const neckHeight = totalBodySvgHeight * (isMale ? 0.044 : 0.046);
  const yShoulders = yChin + neckHeight;

  const inseamCalib = isMale ? (0.480 / (82.0 / 178.0)) : (0.4845 / (76.0 / 168.0));
  const inseamSvg = totalBodySvgHeight * (numIns / numH) * inseamCalib;
  const yAnkles = yFeet - totalBodySvgHeight * 0.052;
  const yCrotch = yFeet - inseamSvg;

  const torsoHeight = yCrotch - yShoulders;
  const yChest = yShoulders + torsoHeight * (isMale ? 0.34 : 0.30);
  const yWaist = yShoulders + torsoHeight * (isMale ? 0.55 : 0.51);
  const yHip = yShoulders + torsoHeight * 0.88;
  const yKnees = yCrotch + inseamSvg * 0.44;

  const armCalib = isMale ? (0.381 / (64.0 / 178.0)) : (0.399 / (58.0 / 168.0));
  const armSvg = totalBodySvgHeight * (numArm / numH) * armCalib;
  const yElbow = yShoulders + armSvg * 0.475;
  const yWrist = yShoulders + armSvg * 0.81;
  const yHandTip = yShoulders + armSvg;

  const DIVISOR = 2.65;
  const wShoulders = isMale ? (numSh * 1.00) : (numSh * 0.99);
  const wChest = isMale ? ((numCh / DIVISOR) * 0.91) : ((numCh / DIVISOR) * 0.83);
  const wWaist = isMale ? ((numW / DIVISOR) * 0.985) : ((numW / DIVISOR) * 0.99);
  const wHip = isMale ? ((numHip / DIVISOR) * 1.063) : ((numHip / DIVISOR) * 1.088);
  const shScale = numSh / (isMale ? 44.0 : 38.0);
  const wNeck = (isMale ? 12.5 : 10.2) * Math.max(0.85, Math.min(1.22, shScale));

  const hipScale = wHip / (isMale ? 38.51 : 38.60);
  const wOuterKnee = isMale ? (wHip * 1.078) : (wHip * 1.057);
  const wInnerKnee = isMale ? 16.8 : 16.5;
  const wOuterAnkle = (isMale ? 38.2 : 41.5) * Math.max(0.90, Math.min(1.12, 0.7 + 0.3 * hipScale));
  const wInnerAnkle = isMale ? 23.0 : 28.5;

  const refFoot = isMale ? 27.0 : 24.5;
  const footScale = Math.max(0.88, Math.min(1.18, numFoot / refFoot));
  const wFootTip = (isMale ? 42.5 : 45.8) * footScale;
  const wFootHeel = isMale ? 20.0 : 26.2;

  const wElbowOut = wShoulders + (isMale ? 13.0 : 11.4);
  const wElbowIn = wShoulders - (isMale ? 7.8 : 7.4);
  const wWristOut = wShoulders + (isMale ? 17.0 : 18.4);
  const wWristIn = wShoulders + (isMale ? 6.2 : 9.6);

  const shoulderYPercent = (yShoulders / viewBoxHeight) * 100;
  const shoulderWidthPercent = ((wShoulders * 4) / viewBoxHeight) * 100;

  return {
    X0,
    viewBoxHeight,
    isMale,
    yHeadTop,
    yChin,
    yShoulders,
    yChest,
    yWaist,
    yHip,
    yCrotch,
    yKnees,
    yAnkles,
    yFeet,
    yElbow,
    yWrist,
    yHandTip,
    wNeck,
    wShoulders,
    wChest,
    wWaist,
    wHip,
    wOuterKnee,
    wInnerKnee,
    wOuterAnkle,
    wInnerAnkle,
    wFootTip,
    wFootHeel,
    wElbowOut,
    wElbowIn,
    wWristOut,
    wWristIn,
    shoulderYPercent,
    shoulderWidthPercent
  };
}

export function getDefaultAvatarAnatomy(sex = 'female') {
  const isMale = String(sex).toLowerCase() === 'male';
  if (isMale) {
    return getFullAvatarAnatomy({
      height: 178,
      shoulders: 44,
      chest: 98,
      waist: 82,
      hip: 96,
      armLength: 64,
      inseam: 82,
      footLength: 27.0,
      gender: 'male'
    });
  }
  return getFullAvatarAnatomy({
    height: 168,
    shoulders: 38,
    chest: 88,
    waist: 68,
    hip: 94,
    armLength: 58,
    inseam: 76,
    footLength: 24.5,
    gender: 'female'
  });
}

/**
 * Maps any coordinate `(x0, y0)` from the Default Avatar's `200 x 450` SVG viewBox
 * into the Live Resized Avatar's `200 x 450` SVG viewBox using piecewise-linear
 * anatomical interpolation across 9 body zones (Neck, Shoulders, Chest, Waist,
 * Hips, Crotch, Knees, Ankles, Feet).
 */
export function warpDefaultAvatarPoint(x0, y0, defaultAnatomy, liveAnatomy) {
  if (!defaultAnatomy || !liveAnatomy) {
    return { x: x0, y: y0, scaleX: 1, scaleY: 1 };
  }

  const Y0 = [
    0,
    defaultAnatomy.yChin,
    defaultAnatomy.yShoulders,
    defaultAnatomy.yChest,
    defaultAnatomy.yWaist,
    defaultAnatomy.yHip,
    defaultAnatomy.yCrotch,
    defaultAnatomy.yKnees,
    defaultAnatomy.yAnkles,
    defaultAnatomy.yFeet,
    450
  ];
  const YL = [
    0,
    liveAnatomy.yChin,
    liveAnatomy.yShoulders,
    liveAnatomy.yChest,
    liveAnatomy.yWaist,
    liveAnatomy.yHip,
    liveAnatomy.yCrotch,
    liveAnatomy.yKnees,
    liveAnatomy.yAnkles,
    liveAnatomy.yFeet,
    450
  ];

  const W0 = [
    defaultAnatomy.wNeck,
    defaultAnatomy.wNeck,
    defaultAnatomy.wShoulders,
    defaultAnatomy.wChest,
    defaultAnatomy.wWaist,
    defaultAnatomy.wHip,
    defaultAnatomy.wHip,
    defaultAnatomy.wOuterKnee,
    defaultAnatomy.wOuterAnkle,
    defaultAnatomy.wFootTip,
    defaultAnatomy.wFootTip
  ];
  const WL = [
    liveAnatomy.wNeck,
    liveAnatomy.wNeck,
    liveAnatomy.wShoulders,
    liveAnatomy.wChest,
    liveAnatomy.wWaist,
    liveAnatomy.wHip,
    liveAnatomy.wHip,
    liveAnatomy.wOuterKnee,
    liveAnatomy.wOuterAnkle,
    liveAnatomy.wFootTip,
    liveAnatomy.wFootTip
  ];

  const clampedY = Math.max(0, Math.min(450, Number(y0) || 0));
  let seg = 0;
  for (let i = 0; i < Y0.length - 1; i++) {
    if (clampedY >= Y0[i] && clampedY <= Y0[i + 1]) {
      seg = i;
      break;
    }
  }

  const span0 = Math.max(0.001, Y0[seg + 1] - Y0[seg]);
  const spanL = YL[seg + 1] - YL[seg];
  const t = Math.max(0, Math.min(1, (clampedY - Y0[seg]) / span0));

  const yLive = YL[seg] + t * spanL;
  const scaleY = spanL / span0;

  const r0 = WL[seg] / Math.max(1, W0[seg]);
  const r1 = WL[seg + 1] / Math.max(1, W0[seg + 1]);
  const scaleX = Math.max(0.68, Math.min(1.48, r0 + t * (r1 - r0)));

  const center0 = Number.isFinite(defaultAnatomy.X0) ? defaultAnatomy.X0 : 100;
  const centerLive =
    typeof liveAnatomy.centerXAtY === 'function'
      ? liveAnatomy.centerXAtY(yLive)
      : Number.isFinite(liveAnatomy.X0)
      ? liveAnatomy.X0
      : 100;
  const xLive = centerLive + (Number(x0) - center0) * scaleX;
  return { x: xLive, y: yLive, scaleX, scaleY, centerX: centerLive };
}

export function getAvatarGeometry({
  height = 170,
  shoulders = 40,
  gender = 'female'
} = {}) {
  const full = getFullAvatarAnatomy({ height, shoulders, gender });
  return {
    yShoulders: full.yShoulders,
    wShoulders: full.wShoulders,
    shoulderYPercent: full.shoulderYPercent,
    shoulderWidthPercent: full.shoulderWidthPercent,
    isMale: full.isMale
  };
}

function computeMorphInfluences({
  height,
  shoulders,
  chest,
  waist,
  hip,
  armLength,
  inseam,
  isMale,
  shapeParams = {},
}) {
  const baseH = isMale ? 178 : 168;
  const baseSh = isMale ? 44 : 38;
  const baseCh = isMale ? 98 : 88;
  const baseW = isMale ? 82 : 68;
  const baseHip = isMale ? 96 : 94;
  const baseArm = isMale ? 64 : 58;
  const baseIns = isMale ? 82 : 76;

  const clamp01 = (v, max = 1.35) => Math.max(0, Math.min(max, Number(v) || 0));

  const dH = (Number(height) || baseH) - baseH;
  const dSh = (Number(shoulders) || baseSh) - baseSh;
  const dCh = (Number(chest) || baseCh) - baseCh;
  const dW = (Number(waist) || baseW) - baseW;
  const dHip = (Number(hip) || baseHip) - baseHip;
  const dArm = (Number(armLength) || baseArm) - baseArm;
  const dIns = (Number(inseam) || baseIns) - baseIns;

  // Aggregate overall mass deviation from chest + waist + hip
  const massDelta = (dCh / 24 + dW / 22 + dHip / 24) / 3;

  return {
    tall: clamp01(Math.max(shapeParams.tall || 0, dH > 0 ? dH / 32 : 0)),
    short: clamp01(Math.max(shapeParams.short || 0, dH < 0 ? -dH / 32 : 0)),
    heavy: clamp01(Math.max(shapeParams.heavy || 0, massDelta > 0 ? massDelta * 0.85 : 0)),
    thin: clamp01(Math.max(shapeParams.thin || 0, massDelta < 0 ? -massDelta * 0.85 : 0)),
    busty: clamp01(Math.max(shapeParams.busty || 0, dCh > 0 ? dCh / 22 : 0)),
    waist_thick: clamp01(Math.max(shapeParams.waist_thick || 0, dW > 0 ? dW / 24 : 0)),
    waist_thin: clamp01(Math.max(shapeParams.waist_thin || 0, dW < 0 ? -dW / 18 : 0)),
    hips_wide: clamp01(Math.max(shapeParams.hips_wide || 0, dHip > 0 ? dHip / 24 : 0)),
    hips_narrow: clamp01(Math.max(shapeParams.hips_narrow || 0, dHip < 0 ? -dHip / 20 : 0)),
    shoulders_wide: clamp01(dSh > 0 ? dSh / 10 : 0),
    shoulders_narrow: clamp01(dSh < 0 ? -dSh / 10 : 0),
    arms_long: clamp01(dArm > 0 ? dArm / 14 : 0),
    arms_short: clamp01(dArm < 0 ? -dArm / 14 : 0),
    legs_long: clamp01(dIns > 0 ? dIns / 16 : 0),
    legs_short: clamp01(dIns < 0 ? -dIns / 16 : 0),
  };
}

function Realistic3DAvatarMesh({
  isMale,
  skinColor,
  morphInfluences,
  height,
  signature,
}) {
  const modelUrl = isMale ? MALE_GLB_URL : FEMALE_GLB_URL;
  const { scene } = useGLTF(modelUrl);
  const { gl, scene: threeScene, camera } = useThree();
  const groupRef = useRef(null);

  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Position & scale model in the [-100..100, -225..225] orthographic frustum (matching 200x450 SVG viewBox)
  const transform = useMemo(() => {
    const defaultH = isMale ? 178 : 168;
    const numH = Math.max(130, Math.min(215, Number(height) || defaultH));
    const baseModelHeightM = isMale ? 1.7877 : 1.6873;
    const baseModelYMinM = -0.0061;
    const defaultSvgHeight = 360 * (defaultH / 170.0);
    const targetSvgHeight = 360 * (numH / 170.0);
    const yHeadTopSvg = (450 - targetSvgHeight) / 2 + 10;
    const yFeetSvg = yHeadTopSvg + targetSvgHeight;

    // Convert SVG yFeet (0 at top, 450 at bottom) to Three.js Ortho Y (+225 at top, -225 at bottom)
    const yBottomThree = 225 - yFeetSvg;

    // Account for height morph target vertical expansion so total rendered height matches targetSvgHeight
    const morphUniformRatio =
      1 +
      (morphInfluences?.tall || 0) * (isMale ? 0.334 : 0.247) -
      (morphInfluences?.short || 0) * (isMale ? 0.230 : 0.241);
    const morphHeightRatio =
      morphUniformRatio +
      (morphInfluences?.legs_long || 0) * 0.13 -
      (morphInfluences?.legs_short || 0) * 0.06;

    const scaleY = targetSvgHeight / (baseModelHeightM * Math.max(0.75, morphHeightRatio));
    const scaleXZ = defaultSvgHeight / (baseModelHeightM * Math.max(0.75, morphUniformRatio));

    return {
      scale: [scaleXZ, scaleY, scaleXZ],
      position: [0, yBottomThree - baseModelYMinM * scaleY, 0],
    };
  }, [height, isMale, morphInfluences]);

  // Update skin tone, anatomical materials, morph Target influences, and capture snapshot
  useEffect(() => {
    if (!clonedScene) return;

    const skinThreeColor = new THREE.Color(skinColor || '#D9A17C');
    const nailColor = skinThreeColor.clone().lerp(new THREE.Color('#F5CAC3'), 0.35);

    clonedScene.traverse((node) => {
      if (!node.isMesh) return;

      const mat = node.material;
      if (mat) {
        const matName = String(mat.name || '').toLowerCase();
        if (matName.includes('skin')) {
          mat.color.copy(skinThreeColor);
          mat.roughness = 0.52;
          mat.metalness = 0.04;
          mat.needsUpdate = true;
        } else if (matName.includes('nails')) {
          mat.color.copy(nailColor);
          mat.roughness = 0.35;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        } else if (matName.includes('generic')) {
          // Built-in modest underwear / briefs
          mat.color.set('#1E293B');
          mat.roughness = 0.65;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        } else if (matName.includes('cornea')) {
          mat.transparent = true;
          mat.opacity = 0.18;
          mat.roughness = 0.05;
          mat.depthWrite = false;
          mat.needsUpdate = true;
        } else if (matName.includes('iris')) {
          mat.color.set('#4A6B82');
          mat.roughness = 0.15;
          mat.needsUpdate = true;
        } else if (matName.includes('pupil')) {
          mat.color.set('#090A0F');
          mat.roughness = 0.1;
          mat.needsUpdate = true;
        } else if (matName.includes('human_eyes')) {
          mat.color.set('#F8FAFC');
          mat.roughness = 0.15;
          mat.needsUpdate = true;
        } else if (matName.includes('eyelash')) {
          mat.color.set('#1E1B18');
          mat.transparent = true;
          mat.opacity = 0.85;
          mat.needsUpdate = true;
        } else if (matName.includes('teeth')) {
          mat.color.set('#F8F5F0');
          mat.roughness = 0.2;
          mat.needsUpdate = true;
        } else if (matName.includes('tongue')) {
          mat.color.set('#B85D65');
          mat.roughness = 0.5;
          mat.needsUpdate = true;
        }
      }

      // Apply morph target influences
      const dict = node.morphTargetDictionary;
      const influences = node.morphTargetInfluences;
      if (dict && influences && morphInfluences) {
        Object.entries(morphInfluences).forEach(([targetName, val]) => {
          const idx = dict[targetName] ?? dict[`${targetName} `];
          if (idx !== undefined && idx < influences.length) {
            influences[idx] = val;
          }
        });
      }
    });

    if (signature && !rendered3DAvatarSnapshotCache.has(signature) && gl && threeScene && camera) {
      let cancelled = false;
      let attempts = 0;
      let rafId = null;

      const tryCaptureSnapshot = () => {
        if (cancelled || rendered3DAvatarSnapshotCache.has(signature)) return;
        attempts += 1;
        try {
          if (camera.isOrthographicCamera) {
            camera.manual = true;
            camera.left = -100;
            camera.right = 100;
            camera.top = 225;
            camera.bottom = -225;
            camera.near = 0.1;
            camera.far = 1000;
            camera.position.set(0, 0, 300);
            camera.zoom = 1;
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
          }
          gl.setSize(400, 900, false);
          gl.setClearColor(0x000000, 0);
          gl.clear();
          gl.render(threeScene, camera);
          const dataUrl = gl.domElement?.toDataURL?.('image/png');
          if (dataUrl && dataUrl.length > 8000) {
            notifySnapshotSubscribers(signature, dataUrl);
            return;
          }
        } catch {
          /* ignore snapshot error in restricted contexts */
        }
        if (attempts < 6 && !cancelled) {
          rafId = requestAnimationFrame(tryCaptureSnapshot);
        }
      };

      rafId = requestAnimationFrame(tryCaptureSnapshot);
      return () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, [clonedScene, skinColor, morphInfluences, signature, gl, threeScene, camera, transform]);

  if (!clonedScene) return null;

  return (
    <group ref={groupRef} position={transform.position} scale={transform.scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

export default function DynamicAvatar({
  height = 170,
  shoulders = 40,
  chest = 90,
  waist = 72,
  hip = 96,
  armLength = 60,
  inseam = 78,
  footLength = 24.5,
  gender = 'female',
  skinColor = '#D9A17C',
  shapeParams = {},
  className = '',
  showGuideLines = true,
  children
}) {
  const isMale = String(gender).toLowerCase() === 'male';

  const anatomy = useMemo(
    () =>
      getFullAvatarAnatomy({
        height,
        shoulders,
        chest,
        waist,
        hip,
        armLength,
        inseam,
        footLength,
        gender,
      }),
    [height, shoulders, chest, waist, hip, armLength, inseam, footLength, gender]
  );

  const svgPaths = useMemo(() => buildAvatarSvgSilhouettePaths(anatomy), [anatomy]);

  const morphInfluences = useMemo(
    () =>
      computeMorphInfluences({
        height,
        shoulders,
        chest,
        waist,
        hip,
        armLength,
        inseam,
        isMale,
        shapeParams,
      }),
    [height, shoulders, chest, waist, hip, armLength, inseam, isMale, shapeParams]
  );

  const rawSkinColor = skinColor || '#E0AC69';
  const activeSkinColor = String(rawSkinColor).trim().toLowerCase() === '#9ca3af' ? '#E0AC69' : rawSkinColor;
  const canUseWebGL = typeof window !== 'undefined' && typeof WebGLRenderingContext !== 'undefined';

  const avatarSignature = useMemo(() => {
    const morphKey = Object.entries(morphInfluences)
      .map(([k, v]) => `${k}:${Number(v || 0).toFixed(2)}`)
      .join('|');
    return `${isMale ? 'M' : 'F'}_${activeSkinColor}_${Number(height) || 170}_${morphKey}`;
  }, [isMale, activeSkinColor, height, morphInfluences]);

  const [snapshotUrl, setSnapshotUrl] = useState(
    () => rendered3DAvatarSnapshotCache.get(avatarSignature) || null
  );
  const [canMountWebGL, setCanMountWebGL] = useState(false);

  useEffect(() => {
    const cached = rendered3DAvatarSnapshotCache.get(avatarSignature);
    if (cached) {
      setSnapshotUrl(cached);
      setCanMountWebGL(false);
      return;
    }
    setSnapshotUrl(null);

    let acquiredSlot = false;
    const tryAcquireSlot = () => {
      if (
        !acquiredSlot &&
        !rendered3DAvatarSnapshotCache.get(avatarSignature) &&
        canUseWebGL &&
        activeWebGLCanvasCount < MAX_CONCURRENT_WEBGL_CANVASES
      ) {
        activeWebGLCanvasCount += 1;
        acquiredSlot = true;
        setCanMountWebGL(true);
      }
    };

    tryAcquireSlot();
    if (!acquiredSlot) {
      setCanMountWebGL(false);
      slotReleaseSubscribers.add(tryAcquireSlot);
    }

    const handleSnapshot = (sig, dataUrl) => {
      if (sig === avatarSignature) {
        setSnapshotUrl(dataUrl);
        setCanMountWebGL(false);
        slotReleaseSubscribers.delete(tryAcquireSlot);
        if (acquiredSlot) {
          acquiredSlot = false;
          activeWebGLCanvasCount = Math.max(0, activeWebGLCanvasCount - 1);
          notifySlotReleased();
        }
      }
    };
    snapshotSubscribers.add(handleSnapshot);

    return () => {
      snapshotSubscribers.delete(handleSnapshot);
      slotReleaseSubscribers.delete(tryAcquireSlot);
      if (acquiredSlot) {
        acquiredSlot = false;
        activeWebGLCanvasCount = Math.max(0, activeWebGLCanvasCount - 1);
        notifySlotReleased();
      }
    };
  }, [avatarSignature, canUseWebGL]);

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
      data-testid="dynamic-3d-avatar"
      data-gender={isMale ? 'male' : 'female'}
      data-skin-color={activeSkinColor}
    >
      {/* Cached 3D MB-Lab Avatar Render (instantaneous, zero WebGL context overhead across 40+ cards) */}
      {snapshotUrl && (
        <img
          src={snapshotUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]"
        />
      )}

      {/* 3D MB-Lab Realistic Human Avatar Canvas (mounts when generating or updating snapshot) */}
      {canUseWebGL && !snapshotUrl && canMountWebGL && (
        <div className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
          <Canvas
            orthographic
            camera={{
              manual: true,
              left: -100,
              right: 100,
              top: 225,
              bottom: -225,
              near: 0.1,
              far: 1000,
              position: [0, 0, 300],
              zoom: 1,
            }}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          >
            <ambientLight intensity={1.15} />
            <hemisphereLight args={['#ffffff', '#cbd5e1', 0.85]} />
            <directionalLight position={[120, 180, 260]} intensity={1.35} />
            <directionalLight position={[-120, 80, 180]} intensity={0.55} />
            <directionalLight position={[0, 140, -200]} intensity={0.35} />
            <Suspense fallback={null}>
              <Realistic3DAvatarMesh
                isMale={isMale}
                skinColor={activeSkinColor}
                morphInfluences={morphInfluences}
                height={height}
                signature={avatarSignature}
              />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Anatomical Calibration Guide Lines & 200x450 Coordinate Frame (with instant 2D SVG silhouette fallback while 3D snapshot loads) */}
      <svg
        viewBox="0 0 200 450"
        className="w-full h-full pointer-events-none z-[1]"
        style={{ maxHeight: '100%' }}
      >
        {!snapshotUrl && (
          <g
            fill={activeSkinColor}
            stroke="rgba(15, 23, 42, 0.18)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          >
            <path d={svgPaths.armPathR} />
            <path d={svgPaths.armPathL} />
            <path d={svgPaths.bodyPath} />
            <path d={svgPaths.headPath} />
          </g>
        )}
        {showGuideLines && (
          <g className="text-slate-400/35 dark:text-slate-500/35 stroke-current stroke-[0.75] stroke-dasharray-[2,3]">
            <line x1="15" y1={anatomy.yShoulders} x2="185" y2={anatomy.yShoulders} />
            <line x1="20" y1={anatomy.yChest} x2="180" y2={anatomy.yChest} />
            <line x1="25" y1={anatomy.yWaist} x2="175" y2={anatomy.yWaist} />
            <line x1="20" y1={anatomy.yHip} x2="180" y2={anatomy.yHip} />
            <line x1="30" y1={anatomy.yCrotch} x2="170" y2={anatomy.yCrotch} />
          </g>
        )}
      </svg>

      {/* Garment / Overlay Children Slot */}
      {children}
    </div>
  );
}

useGLTF.preload(MALE_GLB_URL);
useGLTF.preload(FEMALE_GLB_URL);
