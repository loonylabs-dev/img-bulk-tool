# Bild-Bearbeitungs-Tool

Ein TypeScript-basiertes Tool zum Zerlegen, Komprimieren und Bearbeiten von Bildern mit einer benutzerfreundlichen Web-Oberfläche.

## Features

- **Bildzerlegung**: Quadratische Bilder in 4 gleich große Teile zerlegen
- **Komprimierung**: PNG-Komprimierung auf TinyPNG-Niveau (60-80% Ersparnis)
- **Größenänderung**: Bilder auf beliebige Größe skalieren
- **Batch-Verarbeitung**: Mehrere Bilder gleichzeitig bearbeiten
- **Transparenz-Erhaltung**: PNG-Transparenz bleibt bei allen Operationen erhalten
- **Intelligente Benennung**: Präfix + fortlaufende Nummerierung mit Kollisionsvermeidung

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
2. Bilder per Drag & Drop oder Dateiauswahl hochladen
3. Modus auswählen:
   - **Zerlegen**: Teilt Bild in 4 Quadranten
   - **Größe ändern**: Skaliert auf gewünschte Abmessungen
   - **Nur komprimieren**: Reduziert Dateigröße ohne Größenänderung
   - **Zerlegen + Größe**: Kombiniert beide Operationen
4. Qualität einstellen (50-100%)
5. Präfix für Ausgabedateien definieren
6. "Bilder verarbeiten" klicken
7. Einzeln oder alle Dateien herunterladen

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