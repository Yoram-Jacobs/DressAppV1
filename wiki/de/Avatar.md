# DressApp — 2D-Avatar & Anprobe-Positionierungssystem Architektur (`Avatar.md`)

> **Dokumentversion:** 2.0  
> **Ziel-Subsystem:** Frontend 2D-Mannequin, Echtkörper-Foto-Ausschnitte & Kleidungs-Overlay-Engine  
> **Kern-Dateien:** `AvatarViewer2D.jsx`, `DynamicAvatar.jsx`, `OutfitCanvas.jsx`, `Profile.jsx`  
> **Status:** Production Shipped & Kalibriert  

---

## 1. Zusammenfassung & Wertversprechen

### 1.1 High-Level Übersicht
Das **DressApp 2D-Avatar & Anprobe-Positionierungssystem** bietet eine adaptive visueller Anprobe-Umgebung in Echtzeit. Es ermöglicht Benutzern, digitalisierte Kleidung aus dem Schrank nahtlos über ein **segmentiertes Echtkörper-Foto** oder ein **dynamisch gemorphtes 2D-Bezier-Vektor-SVG-Mannequin** zu legen.

Um eine hohe visuelle Genauigkeit über verschiedene Kleidungsstile hinweg zu gewährleisten (Kompressionsshirts, Polokragen, Rundhalsausschnitte, Hüfthosen, Cargo-Shorts und formelle Kleider), nutzt die Engine anatomische Orientierungspunkt-Kalibrierung, proportionale Verhältnisskalierung und nicht verzerrende Bild-Overlay-Container.

```mermaid
flowchart TD
    subgraph UserProfile["Benutzerprofil & Maße"]
        U_Photo["Echtkörper-Foto-Upload"]
        U_Tone["Hautton-Palettenauswahl"]
        U_Params["Form-Parameter (Groß/Klein, Schwer/Dünn, Oberweite, Taille, Hüfte)"]
        U_Sizing["ANSUR II Größenvorhersage (Größe, Gewicht, Taille, Fuß -> 10 Körpermaße)"]
    end

    subgraph BackendIngest["Backend-Verarbeitung & Freistellung"]
        Rembg["Lokales U2-Net Matting / Segmentierung"]
        Mongo["MongoDB Atlas Profil-Sync"]
    end

    subgraph AvatarEngine["Frontend Avatar Rendering Engine (AvatarViewer2D.jsx)"]
        ModeCheck{"Aktives Körperfoto vorhanden?"}
        PhotoView["Echtkörper-Ausschnitt-Ebene"]
        MannequinView["Dynamisches SVG-Vektormannequin (DynamicAvatar.jsx)"]
        
        GarmentResolver["Bekleidungskategorie & Slot-Resolver"]
        LandmarkCalc["Anatomische Orientierungspunkt-Positionierungs-Engine"]
    end

    subgraph OverlayGeometry["Bekleidungsebenen-Geometrie"]
        TopLayer["Oberteil / Oberbekleidungs-Ebene (top-[14.5%], w-[82%], h-[38%])"]
        BottomLayer["Unterteil / Gürtel-Ebene (top-[36.5%], w-[62%], h-[50%])"]
        ShoesLayer["Schuh-Ebene (bottom-[2%], w-[46%], h-[12%])"]
        AccessoryLayers["Kopfbedeckung / Brillen / Accessoires / Taschen"]
    end

    U_Photo --> Rembg --> Mongo
    U_Params & U_Sizing --> MannequinView
    U_Tone --> MannequinView
    
    ModeCheck -- Ja --> PhotoView
    ModeCheck -- Nein --> MannequinView

    GarmentResolver --> LandmarkCalc
    LandmarkCalc --> TopLayer & BottomLayer & ShoesLayer & AccessoryLayers
    TopLayer & BottomLayer & ShoesLayer & AccessoryLayers --> PhotoView & MannequinView
```

### 1.2 Benutzer-Wertversprechen
* **Präzision der anatomischen Ausrichtung**: Richtet Hemdkragen bündig am Ausschnitt des Avatars aus (`top-[14.5%]`) und Hosen-/Shorts-Bünde bündig an der natürlichen Taillenlinie des Avatars (`top-[36.5%]`), wodurch Gesichtsverdeckungen und störende Lücken vermieden werden.
* **Duale Avatar-Flexibilität**: Wechseln Sie sofort zwischen einem persönlichen, freigestellten Ganzkörperfoto und einem dynamischen 2D-Vektor-SVG-Mannequin, das auf exakten anthropometrischen Maßen basiert.
* **Proportionale Aspekt-Erhaltung**: Wendet Brust- und Hüftbreitenskalierung ($scaleX$) an, während das ursprüngliche Bildseitenverhältnis des Kleidungsstücks beibehalten wird (`object-fit: contain`).
* **Interaktive Ebenenhierarchie**: Stapeln Sie Oberbekleidung über Tops und Kleider und ermöglichen Sie gleichzeitig direkte Klicks auf einzelne Bekleidungsebenen, um Artikeldetails zu öffnen.

---

## 2. Umfassendes Benutzerhandbuch & Schnittstellen-Topologie

### 2.1 Visuelle Schnittstellen-Topologie

```
┌──────────────────────────────────────────────────────────────────┐
│                     2D-Avatar-Anprobe-Canvas                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        [ Kopfbedeckung (top: 1%) ]               │
│                        [ Brillen       (top: 11%) ]              │
│                        [ Halsausschnitt(top: 14.5%) ] ◄─ Kragen   │
│                     ┌──────────────────────────┐                 │
│                     │   Oberteile / Mäntel     │                 │
│                     │       (Höhe: 38%)        │                 │
│                     └──────────────────────────┘                 │
│                        [ Taillenlinie  (top: 36.5%) ] ◄─ Bund    │
│                     ┌──────────────────────────┐                 │
│                     │    Unterteile / Shorts   │                 │
│                     │       (Höhe: 50%)        │                 │
│                     │                          │                 │
│                     └──────────────────────────┘                 │
│                        [ Füße        (bottom: 2%) ] ◄─── Schuhe  │
│                        [ Schuhe        (Höhe: 12%) ]             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [ Avatar-Modus wechseln ] [ Hautton-Auswahl ] [ Maße bearbeiten ]│
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Modi- & Workflow-Anleitungen

#### Modus 1: Echtkörper-Foto-Ausschnitt-Ebene
1. Öffnen Sie die **Profileinstellungen** (`/me`).
2. Laden Sie ein Ganzkörperfoto hoch. Das Backend führt eine Hintergrundsegmentierung über `rembg` (U2-Net) aus.
3. Die verarbeitete Ausschnitt-URL (`body_photo_url`) aktualisiert das Benutzerprofil in MongoDB und wird im `AvatarViewer2D`-Container gerendert.
4. Um zum Vektormannequin zurückzukehren, klicken Sie auf der Profilseite auf **Foto entfernen**. Die Benutzeroberfläche wird sofort und ohne Neuladen der Seite aktualisiert.

#### Modus 2: Dynamisches Vektor-SVG-Mannequin
1. Wenn kein Körperfoto vorhanden ist, rendert `AvatarViewer2D` die Datei `DynamicAvatar.jsx`.
2. Das Mannequin erzeugt kontinuierliche kubische Bezier-Kurven ($C$- und $S$-Befehle) innerhalb einer festen viewBox von `0 0 200 450`.
3. Das Anpassen von Körperparametern (Größe, Gewicht, Taille, Brust, Schultern, Hüften) oder das Auswählen eines Hauttons verändere die Silhouette in Echtzeit.

---

## 3. Technologie-Stack & Tiefeneinblick in die Funktionen

### 3.1 Anatomischer Ellipsen-Divisor & Bezier-Mannequin-Generator

`DynamicAvatar.jsx` berechnet planare 2D-Projektionsbreiten aus 3D-anatomischen Umfängen unter Verwendung eines **anatomischen Ellipsen-Divisors** ($\text{DIVISOR} = 2.65$):

$$\begin{aligned}
w_{\text{shoulders}} &= (\text{shoulders} \times 1.1) \times (1.05 \text{ if male else } 0.95) \\
w_{\text{chest}} &= \left(\frac{\text{chest}}{2.65} \times 1.05\right) \times (1.02 \text{ if male else } 1.0) \\
w_{\text{waist}} &= \left(\frac{\text{waist}}{2.65} \times 1.0\right) \times (0.98 \text{ if male else } 0.90) \\
w_{\text{hip}} &= \left(\frac{\text{hip}}{2.65} \times 1.05\right) \times (0.93 \text{ if male else } 1.05)
\end{aligned}$$

Die Körpersilhouette wird über SVG-Pfadbefehle konstruiert, die kubische Bezier-Steuerpunkte zuordnen:

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

### 3.2 Kalibrierte Orientierungspunkt-Positionierung & Container-CSS-Verhältnisse

Um zu garantieren, dass Kleidungsstücke bündig sitzen, ohne Gesichtszüge zu überlappen oder Körperlücken zu hinterlassen, sind Overlay-Container in `AvatarViewer2D.jsx` an präzise CSS-Positionsverhältnisse gebunden:

| Bekleidungskategorie | CSS-Positionsklasse | z-Index | Ausrichtungs-Orientierungspunkt |
| --- | --- | --- | --- |
| **Kopfbedeckung** | `top-[1%] left-1/2 w-[34%] aspect-square` | `z-30` | Scheitelpunkt des Kopfes |
| **Brillen** | `top-[11%] left-1/2 w-[18%] h-[4.5%]` | `z-28` | Augen-Ebene |
| **Accessoire / Halskette** | `top-[14.5%] left-1/2 w-[30%] aspect-square` | `z-25` | Halsansatz |
| **Oberteil (Top)** | `top-[14.5%] left-1/2 w-[82%] h-[38%]` | `z-20` | Kragen zu Halsausschnitt |
| **Oberbekleidung** | `top-[14.5%] left-1/2 w-[86%] h-[42%]` | `z-22` | Mantel-Schulter-Schichtung |
| **Kleid** | `top-[14.5%] left-1/2 w-[82%] h-[68%]` | `z-20` | Volle Länge von Oben bis Knie |
| **Gürtel** | `top-[36.5%] left-1/2 w-[62%] h-[5%]` | `z-21` | Taillengürtelschlaufe |
| **Unterteil (Hosen/Shorts)** | `top-[36.5%] left-1/2 w-[62%] h-[50%]` | `z-10` | Hosenbund zu Taillenlinie |
| **Schuhe / Fußbekleidung** | `bottom-[2%] left-1/2 w-[46%] h-[12%]` | `z-15` | Knöchel- zu Fuß-Ebene |
| **Handtasche** | `top-[40%] right-[-5%] w-[40%] h-[30%]` | `z-25` | Arm-Hänge-Ebene |

### 3.3 Proportionale Breite der Kleidungsstücke

Zusätzlich zur Positionierung skalieren Kleidungsstücke dynamisch horizontal ($scaleX$) basierend auf den vom Benutzer gewählten Körperparametern:

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

## 4. Zusammenfassende Matrix der Positions- und Proportionskorrekturen

| Identifiziertes Problem | Ursache | Angewandte Korrektur | Ergebnis |
| --- | --- | --- | --- |
| **Hemdkragen überlappt Gesicht** | Offset zu hoch positioniert (`top-[8.3%]` oder `top-[12.8%]`) | Oberen Container-Offset auf `top-[14.5%]` gesetzt | Hemdkragen sitzt bündig am Halsausschnitt des Avatars. |
| **Hose/Shorts zu niedrig oder überlappend** | Offset zu tief positioniert (`top-[38.5%]`) | Unteren Container-Offset auf `top-[36.5%]` gesetzt | Hosenbund sitzt bündig an der Taillenlinie des Avatars. |
| **Verzerrte Bildseitenverhältnisse** | Unbegrenzte Container-Streckung | `object-fit: contain` mit proportionaler `scaleX`-Anpassung angewendet | Behält das ursprüngliche Seitenverhältnis des Bildes ohne horizontale Verzerrungen bei. |
| **Verzögerung beim Entfernen von Fotos** | Erneutes Abrufen des Seitenstatus erforderlich | Sofortige lokale Benutzerstatus-Synchronisierung in `Profile.jsx` implementiert | Die Fotoentfernung wird sofort ohne UI-Verzögerung angezeigt. |

---
*Dokument automatisch von Narrator für DressApp zusammengestellt.*
