# 3D AI Studio API Evaluation for DressApp 3D Dressing Room

**Author:** Antigravity Research Agent  
**Date:** October 26, 2026  
**Primary Source:** [3D AI Studio Official API Documentation](https://www.3daistudio.com/Platform/API/Documentation)  
**Status:** Completed Investigation  

---

## 1. Executive Summary & Verdict

### **Can we use 3D AI Studio for the DressApp 3D Dressing Room?**
> **Verdict: NOT for real-time interactive try-on. Highly VIABLE as an optional background asset-baking pipeline for footwear, accessories, and standalone 3D showcase items.**

* **Real-Time Dressing Room (Interactive Fitting):** **NO.**  
  DressApp's 3D Dressing Room (`DressingRoom3D.jsx`) renders live inside the client browser at 60 FPS using React Three Fiber, parametric anthropometric slice meshes (`getTorsoSlice`, `getLegSlice`), dynamic morph fields (`avatarMorphField.js`), real-time vertex skin retraction, and instant photo-silhouette inflation (`garmentSilhouette.js`). 3D AI Studio's generation is asynchronous, takes **30 seconds to 20 minutes per model**, costs 35–100 credits (~$0.35–$1.00+) per item, and produces static, non-rigged, non-parametric solid meshes that cannot dynamically morph to match a user's height, bust, waist, or hips.
* **Asynchronous Catalog & Closet Asset Ingestion:** **YES (with caveats).**  
  For generating high-fidelity watertight 3D models (GLB with PBR maps) of static items (especially **shoes/sneakers, handbags, sunglasses, jewelry, and hats**), 3D AI Studio provides unified wrapper access to state-of-the-art models (Microsoft TRELLIS.2-4B, Tencent Hunyuan 3D 3.1 Pro/Rapid, Tripo 3.2, and Hitem3D 3.0), as well as quad remeshing, mesh simplification, and Draco optimization tools.

---

## 2. Platform Architecture & API Overview

* **Base Endpoint:** `https://api.3daistudio.com`
* **Authentication:** Bearer token via HTTP Header: `Authorization: Bearer YOUR_API_KEY` (requires 2FA passkey/authenticator app on the dashboard account).
* **Execution Model:** Fully asynchronous. Every generation/processing call returns a `task_id` (`{ "task_id": "...", "created_at": "..." }`). The client or backend must poll the provider's task status endpoint until `status === "FINISHED"` or `"FAILED"`.
* **Output Formats:** GLB (standard), with support for OBJ, FBX, STL, USDZ via the conversion tool.
* **Billing / Credits:** Pay-as-you-go credit balance (`GET /account/user/wallet/`). Purchased credits expire after 365 days; promo credits expire in 31 days.

---

## 3. Crawled Capabilities & Endpoint Reference

### 3.1 3D Generation Providers (`/v1/3d-models/...`)

| Provider / Model | Endpoint | Inputs Supported | Latency | Typical Cost | DressApp Fit Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Microsoft TRELLIS.2-4B** | `POST /v1/3d-models/trellis2/generate/` | Single Image (URL or Base64) | ~30–60s | ~50–70 credits | **Best for Footwear & Accessories.** Produces clean PBR (albedo, roughness, metallic, opacity). |
| **Tencent Hunyuan 3D (Pro & Rapid)** | `POST /v1/3d-models/tencent/generate/pro/`<br>`/generate/rapid/` | Text, Single Image, Multi-view Images | ~40–90s | 35–100 credits | High geometric control (`face_count` up to 500k, PBR toggle). Multi-view support matches DressApp item groups. |
| **Tripo 3.0 / 3.1 / 3.2** | `POST /v1/3d-models/tripo/image-to-3d/` | Text, Image, Multi-view | ~20–45s | 40–80 credits | Fast turnaround, integrated quad remeshing, smart low-poly output. |
| **Hitem3D 3.0** | `POST /v1/3d-models/hitem3d/image-to-3d/` | Single Image or 2–4 Multi-view images | 2m (Quality) – 20m (Master) | 80–120 credits | Watertight 2048³ resolution, up to 5M faces. Impressive for studio showcase, but far too slow/heavy for interactive web. |

### 3.2 Post-Processing & Mesh Tools (`/v1/tools/...` & `/v1/3d-models/...`)

* **Optimize & Compress (`POST /v1/tools/optimize/`):** Applies Draco geometry compression, reduces polygon count, and compresses textures to WebP/JPEG (costs 5–10 credits). Directly useful for optimizing GLB assets served to mobile browsers.
* **3D Format Conversion (`POST /v1/tools/convert/`):** Converts between GLB, OBJ, FBX, STL, and USDZ (for iOS Quick Look AR).
* **Mesh Repair (`POST /v1/tools/repair/`):** Repairs non-manifold edges, duplicate vertices, and inconsistent normals.
* **Semantic Segmentation (`POST /v1/3d-models/tripo/mesh-segmentation/`):** Breaks a 3D model into semantic parts (costs 80 credits).
* **AI Texturing (`POST /v1/3d-models/texturing/...`):** Applies PBR textures from reference photos onto existing UV unwrapped meshes.

---

## 4. Gap Analysis: 3D AI Studio vs. DressApp 3D Dressing Room Requirements

| Requirement in `/3d-dressing-room-creator` | DressApp Native Client Pipeline (`apps/web/src/`) | 3D AI Studio API | Feasibility / Conflict |
| :--- | :--- | :--- | :--- |
| **Instant Interactive Rendering (< 1 second)** | **Instant (0–300ms)**. Procedural shell inflation and morph calculation run client-side in Three.js. | **30s – 20min per garment**. User cannot wait 2 minutes every time they click an outfit piece. | **Incompatible for live UI**. Could only be pre-baked. |
| **Dynamic Fit to Avatar Body (Morph Targets)** | **100% dynamic**. Garment vertices deform with avatar sliders (height, chest, waist, hips, shoulders) via `avatarMorphField.js`. | **Static watertight mesh**. Generates a rigid solid mesh. It cannot morph with avatar sliders without custom rigging. | **Incompatible**. Static 3D clothing meshes clip and penetrate when avatar body parameters change. |
| **Strict Anatomical Anchors (Shoulder ridge, crotch line)** | **Guaranteed**. Programmatic constraints lock garment seams to exact GLB skeleton coordinates. | **Arbitrary model bounding box**. AI-generated models have arbitrary origins, scales, and poses. | **Requires manual scaling and alignment**. |
| **Zero Skin Penetration (Skin Bleed-Through)** | **Guaranteed**. `retractCoveredAvatarSkin` and morph collision envelopes push skin inward under clothing. | **High collision risk**. Deforming an avatar underneath an arbitrary AI-generated mesh causes severe polygon clipping. | **High failure rate for tops/bottoms**. |
| **Footwear & Accessories** | Fitted procedural profiles + heeled foot elevation (`computeFootPose`). | High-fidelity static shoes, bags, watches, sunglasses, and hats. | **Strong Potential Synergy** for pre-generating static GLB accessory assets. |
| **Cost & Infrastructure** | **Free ($0)**. Runs 100% on client GPU/CPU in WebGL. | **$0.35 – $1.20 per item generation**. 10 items in closet = $3.50–$12.00 cost to user or platform. | **High recurring cost**. |

---

## 5. Architectural Recommendation

1. **Keep DressApp's Core 3D Fitting Pipeline Intact:**
   The current parametric silhouette inflation (`garmentSilhouette.js` + `GarmentMesh3D.jsx` + `avatarMorphField.js`) remains the proper architectural solution for interactive virtual try-on. It preserves the exact photograph texture, respects body proportions, responds in real-time to avatar changes, and costs nothing to run.

2. **Where 3D AI Studio CAN Be Used (Optional Feature):**
   * **"Generate 3D Asset" Feature for Closet Items:** Allow users or stylists to optionally bake a high-fidelity 3D model of an item (e.g. sneakers, designer bags, or luxury watches) for an interactive 3D inspection turntable using TRELLIS.2 or Hunyuan Rapid.
   * **USDZ / AR Export:** Convert catalog items into Apple Quick Look USDZ files via `/v1/tools/convert/` for AR viewing on iOS devices.
   * **Draco Mesh Optimization:** Utilize `/v1/tools/optimize/` to compress large 3D glTF/GLB models uploaded by boutique partners.
