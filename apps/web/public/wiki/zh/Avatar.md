# DressApp — 2D虚拟人像与试穿定位系统架构 (`Avatar.md`)

> **文档版本:** 2.0  
> **目标子系统:** 前端2D模特、真实身体照片扣图与服装叠加引擎  
> **核心文件:** `AvatarViewer2D.jsx`, `DynamicAvatar.jsx`, `OutfitCanvas.jsx`, `Profile.jsx`  
> **状态:** 已上线生产环境并校准  

---

## 1. 执行摘要与价值主张

### 1.1 高层概述
**DressApp 2D虚拟人像与试穿定位系统**提供了一个自适应的实时视觉试穿环境。它允许用户在**抠图后的真实身体照片**或**动态变形的2D贝塞尔矢量SVG模特**上，无缝预览并叠加数字化衣橱服装。

为了在各种服装款式（紧身衣、保罗领、圆领、低腰牛仔裤、工装短裤和正式礼服）中实现高视觉精度，该引擎采用了人体解剖学基准点校准、比例等比缩放以及防变形图像叠加容器。

```mermaid
flowchart TD
    subgraph UserProfile["用户配置文件与身体数据"]
        U_Photo["真实身体照片上传"]
        U_Tone["肤色调色板选择"]
        U_Params["体型参数 (高/矮、胖/瘦、胸围、腰围、臀围)"]
        U_Sizing["ANSUR II 尺寸预测器 (身高、体重、腰围、脚长 -> 10项身体指标)"]
    end

    subgraph BackendIngest["后端处理与抠图"]
        Rembg["本地 U2-Net 扣图 / 分割"]
        Mongo["MongoDB Atlas 配置文件同步"]
    end

    subgraph AvatarEngine["前端人像渲染引擎 (AvatarViewer2D.jsx)"]
        ModeCheck{"是否有激活的身体照片？"}
        PhotoView["真实身体抠图图层"]
        MannequinView["动态 SVG 矢量模特 (DynamicAvatar.jsx)"]
        
        GarmentResolver["服装类别与分组槽位解析器"]
        LandmarkCalc["解剖学基准点定位引擎"]
    end

    subgraph OverlayGeometry["服装图层几何结构"]
        TopLayer["上衣 / 外套图层 (top-[14.5%], w-[82%], h-[38%])"]
        BottomLayer["下装 / 腰带图层 (top-[36.5%], w-[62%], h-[50%])"]
        ShoesLayer["鞋类图层 (bottom-[2%], w-[46%], h-[12%])"]
        AccessoryLayers["帽子 / 眼镜 / 配饰 / 包袋"]
    end

    U_Photo --> Rembg --> Mongo
    U_Params & U_Sizing --> MannequinView
    U_Tone --> MannequinView
    
    ModeCheck -- 是 --> PhotoView
    ModeCheck -- 否 --> MannequinView

    GarmentResolver --> LandmarkCalc
    LandmarkCalc --> TopLayer & BottomLayer & ShoesLayer & AccessoryLayers
    TopLayer & BottomLayer & ShoesLayer & AccessoryLayers --> PhotoView & MannequinView
```

### 1.2 用户价值主张
* **解剖学对齐精度**: 将衬衫领口精湛地贴合至虚拟人像的颈线位置 (`top-[14.5%]`)，并将短裤/长裤腰带平齐贴合至自然腰线位置 (`top-[36.5%]`)，杜绝遮挡面部或出现不合常理的间隙。
* **双人像模式灵活性**: 可在个人抠图全身照片与根据精确人体测量数据构建的动态2D矢量SVG模特之间瞬间切换。
* **比例宽高比保持**: 应用胸围和臀围宽度缩放 ($scaleX$) 的同时，保持服装图像的原有宽高比 (`object-fit: contain`)，防止出现拉伸或压扁现象。
* **交互式图层层级**: 可将外套叠穿在内搭和连衣裙之上，同时支持直接点击单个服装图层以打开商品详情。

---

## 2. 详细用户手册与界面拓扑

### 2.1 视觉界面拓扑

```
┌──────────────────────────────────────────────────────────────────┐
│                      2D 虚拟人像试穿画布                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        [ 帽子/头饰   (top: 1%) ]                 │
│                        [ 眼镜       (top: 11%) ]                 │
│                        [ 领口线     (top: 14.5%) ] ◄─ 衬衫领口   │
│                     ┌──────────────────────────┐                 │
│                     │       上衣 / 外套        │                 │
│                     │       (height: 38%)      │                 │
│                     └──────────────────────────┘                 │
│                        [ 腰线位置   (top: 36.5%) ] ◄─ 裤腰带     │
│                     ┌──────────────────────────┐                 │
│                     │       下装 / 短裤        │                 │
│                     │       (height: 50%)      │                 │
│                     │                          │                 │
│                     └──────────────────────────┘                 │
│                        [ 双脚       (bottom: 2%) ] ◄─── 鞋类     │
│                        [ 鞋子       (height: 12%) ]              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [ 切换人像模式 ]    [ 肤色选择器 ]      [ 编辑身体测量数据 ]     │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 模式与工作流程指南

#### 模式 1: 真实身体照片抠图图层
1. 打开 **个人资料设置** (`/me`)。
2. 上传一张全身照片。后端通过 `rembg` (U2-Net) 执行背景分割，消除背景杂讯。
3. 处理后的抠图 URL (`body_photo_url`) 将更新 MongoDB 中的用户资料，并在 `AvatarViewer2D` 容器内渲染。
4. 如需切回矢量模特，请点击个人资料页面上的 **删除照片**。界面将立即更新，无需刷新页面。

#### 模式 2: 动态矢量 SVG 模特
1. 当未上传身体照片时，`AvatarViewer2D` 会渲染 `DynamicAvatar.jsx`。
2. 模特在固定的 `0 0 200 450` SVG viewBox 内生成连续的三次贝塞尔曲线（$C$ 和 $S$ 指令）。
3. 调整身体参数（身高、体重、腰围、胸围、肩宽、臀围）或选择肤色将实时动态改变模特的轮廓。

---

## 3. 技术栈与深度能力剖析

### 3.1 解剖学椭圆除数与贝塞尔模特生成器

`DynamicAvatar.jsx` 使用 **解剖学椭圆除数** ($\text{DIVISOR} = 2.65$) 从 3D 解剖周长计算 2D 平面投影宽度：

$$\begin{aligned}
w_{\text{shoulders}} &= (\text{shoulders} \times 1.1) \times (1.05 \text{ if male else } 0.95) \\
w_{\text{chest}} &= \left(\frac{\text{chest}}{2.65} \times 1.05\right) \times (1.02 \text{ if male else } 1.0) \\
w_{\text{waist}} &= \left(\frac{\text{waist}}{2.65} \times 1.0\right) \times (0.98 \text{ if male else } 0.90) \\
w_{\text{hip}} &= \left(\frac{\text{hip}}{2.65} \times 1.05\right) \times (0.93 \text{ if male else } 1.05)
\end{aligned}$$

身体轮廓是通过映射三次贝塞尔控制点的 SVG 路径指令构建的：

```javascript
// Bezier contour snippet from DynamicAvatar.jsx
const bodyPath = [
  `M ${pNeckR}`,
  `C ${X0 + wNeck + (wShoulders - wNeck) * 0.6},${yChin + neckHeight * 0.7} ${X0 + wShoulders * 0.9},${yShoulders - 2} ${pShoulderR}`,
  `C ${X0 + wShoulders * 0.95},${yShoulders + (yChest - yShoulders) * 0.6} ${X0 + wChest + 2},${yChest - 5} ${pChestR}`,
  `C ${X0 + wChest - 1},${yChest + (yWaist - yChest) * 0.5} ${X0 + wWaist + (isMale ? 1 : -2)},${yWaist - 8} ${pWaistR}`,
  `C ${X0 + wWaist + (isMale ? 2 : 5)},${yWaist + (yHip - yWaist) * 0.4} ${X0 + wHip + 1},${yHip - 8} ${pHipR}`,
  ...
].join(' ');
```

### 3.2 校准基准点定位与容器 CSS 比例

为确保服装贴合且不会遮挡面部特征或留下身体空隙，`AvatarViewer2D.jsx` 中的叠加容器绑定到了精确的 CSS 位置比例：

| 服装类别 | CSS 位置类 | z-Index | 对齐解剖基准点 |
| --- | --- | --- | --- |
| **帽子/头饰** | `top-[1%] left-1/2 w-[34%] aspect-square` | `z-30` | 头顶顶点 |
| **眼镜** | `top-[11%] left-1/2 w-[18%] h-[4.5%]` | `z-28` | 眼部水平线 |
| **配饰 / 项链** | `top-[14.5%] left-1/2 w-[30%] aspect-square` | `z-25` | 颈根部 |
| **上衣 (Top)** | `top-[14.5%] left-1/2 w-[82%] h-[38%]` | `z-20` | 衣领至颈线 |
| **外套** | `top-[14.5%] left-1/2 w-[86%] h-[42%]` | `z-22` | 肩部外套叠穿 |
| **连衣裙** | `top-[14.5%] left-1/2 w-[82%] h-[68%]` | `z-20` | 从颈线至膝盖的全长 |
| **腰带** | `top-[36.5%] left-1/2 w-[62%] h-[5%]` | `z-21` | 腰部裤带扣环 |
| **下装 (长裤/短裤)** | `top-[36.5%] left-1/2 w-[62%] h-[50%]` | `z-10` | 裤腰至自然腰线 |
| **鞋类 / 鞋子** | `bottom-[2%] left-1/2 w-[46%] h-[12%]` | `z-15` | 脚踝至脚底平面 |
| **手提包** | `top-[40%] right-[-5%] w-[40%] h-[30%]` | `z-25` | 手臂自然下垂平面 |

### 3.3 服装等比宽度缩放

除了空间位置外，服装还会根据用户选择的身体参数（丰满、偏胖、偏瘦、腰粗、臀宽）在水平方向上（$scaleX$）动态缩放：

```javascript
// Derivation of garment container scale factors in AvatarViewer2D.jsx
const scales = useMemo(() => {
  const heightFactor = 1 + (params.tall * 0.08) - (params.short * 0.08);
  const widthFactor = 1 + (params.heavy * 0.12) - (params.thin * 0.12);
  const chestFactor = 1 + (params.busty * 0.1);
  const waistFactor = 1 + (params.waist_thick * 0.12) - (params.waist_thin * 0.08);
  const hipsFactor = 1 + (params.hips_wide * 0.12) - (params.hips_narrow * 0.08);

  return { height: heightFactor, width: widthFactor, chest: chestFactor, waist: waistFactor, hips: hipsFactor };
}, [params]);

// Passed to Framer Motion animate prop for Top and Bottom:
// Top: scaleX = scales.chest / scales.width
// Bottom: scaleX = scales.hips / scales.width
```

---

## 4. 位置与比例修复汇总矩阵

| 已确认问题 | 原因 | 应用的修复方案 | 结果 |
| --- | --- | --- | --- |
| **衬衫领口遮挡面部** | 容器偏移量设置过高 (`top-[8.3%]` 或 `top-[12.8%]`) | 将顶部容器偏移量设置为 `top-[14.5%]` | 衬衫领口平齐贴合在虚拟人像的颈线位置。 |
| **裤子/短裤位置偏低或重叠裤脚** | 容器偏移量设置过低 (`top-[38.5%]`) | 将底部容器偏移量设置为 `top-[36.5%]` | 裤腰带平齐贴合在虚拟人像的自然腰线位置。 |
| **服装图像宽高比变形** | 容器无约束拉伸 | 应用 `object-fit: contain` 并结合比例 $scaleX$ 调整 | 保持服装图像原始宽高比，水平方向无变形。 |
| **照片删除延迟** | 需要重新获取页面状态 | 在 `Profile.jsx` 中实现即时本地用户状态同步 | 照片删除即时呈现，无 UI 延迟或状态异常。 |

---

*Document compiled automatically by Narrator for DressApp.*
