# Bild-Bearbeitungs-Tool

Ein TypeScript-basiertes Tool zum Zerlegen, Komprimieren und Bearbeiten von Bildern mit einer benutzerfreundlichen Web-Oberfläche.

## Features

### 📦 Bulk-Verarbeitung Tab
- **Bildzerlegung**: Quadratische Bilder in 4 gleich große Teile zerlegen
- **Komprimierung**: PNG-Komprimierung (einstellbare Qualität 50-100%, Standard: 100%)
- **Größenänderung**: Bilder auf beliebige Größe skalieren
- **Smart Crop**: Intelligente Inhaltserkennung mit konfigurierbarem Padding (uniform oder individuelle Seiten)
- **Batch-Verarbeitung**: Bis zu 20 Bilder gleichzeitig bearbeiten
- **Transparenz-Erhaltung**: PNG-Transparenz bleibt bei allen Operationen erhalten
- **Intelligente Benennung**: Präfix + fortlaufende Nummerierung mit Kollisionsvermeidung

### 🎨 Layer Editor Tab (NEU!)
- **3-Layer-System**: Bis zu 3 Bilder als Layer übereinander positionieren
- **Live-Vorschau**: Echtzeit-Canvas-Rendering mit rotem Alignment-Guide (50% Transparenz)
- **Layer-Kontrollen**: 
  - Sichtbarkeit ein/aus
  - Skalierung (0.1x - 3.0x in 0.05er Schritten)
  - X/Y-Position (-200px bis +200px)
- **Preset-System**: Layer-Konfigurationen speichern und laden (localStorage)
- **Guide-Größe**: Anpassbarer Alignment-Guide (50-300px)
- **Export-Optionen**: 
  - Ausgabegrößen: 128x128, 256x256, 512x512, 1024x1024
  - Komprimierungsqualität einstellbar (50-100%)
- **Auto-Scaling**: Bilder werden beim Laden automatisch auf Ausgabegröße angepasst

## Installation

1. Dependencies installieren:
```bash
npm install
```

2. TypeScript kompilieren:
```bash
npm run build
```

3. Server starten:
```bash
npm start
```

Für die Entwicklung:
```bash
npm run dev
```

## Verwendung

1. Browser öffnen: `http://localhost:3000`
2. Tab auswählen:
   - **📦 Bulk Verarbeitung**: Für Batch-Bildbearbeitung
   - **🎨 Layer Editor**: Für Layer-basiertes Compositing

### Bulk-Verarbeitung
1. Bilder per Drag & Drop oder Dateiauswahl hochladen (max. 20)
2. Modus auswählen:
   - **Zerlegen**: Teilt Bild in 4 Quadranten
   - **Größe ändern**: Skaliert auf gewünschte Abmessungen
   - **Nur komprimieren**: Reduziert Dateigröße ohne Größenänderung
   - **Zerlegen + Größe**: Kombiniert beide Operationen
3. Optionen konfigurieren:
   - Qualität einstellen (50-100%, Standard: 100%)
   - Smart Crop aktivieren für intelligente Inhaltserkennung
   - Präfix für Ausgabedateien definieren
4. "Bilder verarbeiten" klicken
5. Einzeln oder alle Dateien herunterladen

### Layer Editor
1. Bis zu 3 Bilder als Layer hochladen (Drag & Drop oder Klick)
2. Layer individuell anpassen:
   - Sichtbarkeit umschalten
   - Skalierung feinjustieren (0.05er Schritte)
   - Position anpassen (X/Y-Achse)
3. Guide-Einstellungen:
   - Roten Alignment-Guide ein/ausblenden
   - Guide-Größe anpassen (Slider oder Zahleneingabe)
4. Presets verwenden:
   - Konfigurationen speichern/laden
   - Beispiel-Setup ist vorinstalliert
5. Export-Einstellungen:
   - Ausgabegröße wählen (128x128 bis 1024x1024)
   - Komprimierungsqualität festlegen
   - Dateiname-Präfix eingeben
6. "Layer exportieren" klicken

## Dateinamen-Schema

Ausgabedateien werden benannt als: `[präfix]_[nummer].png`

- Fortlaufende Nummerierung beginnt bei 1
- Automatische Kollisionsvermeidung durch Hochzählen
- Keine zusätzlichen Kennzeichnungen

Beispiele:
- 1 Bild zerlegen (Präfix: "icon"): `icon_1.png`, `icon_2.png`, `icon_3.png`, `icon_4.png`
- 3 Bilder komprimieren (Präfix: "asset"): `asset_1.png`, `asset_2.png`, `asset_3.png`

## Technische Details

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vanilla TypeScript + Vite
- **Bildverarbeitung**: Sharp (schnell und präzise)
- **Komprimierung**: imagemin + pngquant + optipng
- **Upload**: Multer für Dateiverarbeitung

## Ordnerstruktur

```
img-bulk-tool/
├── src/                    # Backend TypeScript
│   ├── server.ts
│   └── lib/
│       ├── imageProcessor.ts
│       ├── compressor.ts
│       └── fileManager.ts
├── public/                 # Frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/app.ts
├── dist/                   # Kompilierte Dateien
├── uploads/                # Temporäre Uploads
└── output/                 # Verarbeitete Bilder
```

## Scripts

- `npm run dev`: Entwicklungsmodus (Watch + Hot Reload)
- `npm run build`: Produktion-Build
- `npm start`: Server starten (benötigt Build)
- `npm run serve`: Frontend Preview