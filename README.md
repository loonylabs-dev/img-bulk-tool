# Bild-Bearbeitungs-Tool

Ein TypeScript-basiertes Tool zum Zerlegen, Komprimieren und Bearbeiten von Bildern mit einer benutzerfreundlichen Web-Oberfläche.

## Features

### 📦 Bulk-Verarbeitung Tab
- **Bildzerlegung**: Quadratische Bilder in 4 gleich große Teile zerlegen
- **Komprimierung**: PNG-Komprimierung (einstellbare Qualität 50-100%, Standard: 100%)
- **Größenänderung**: Bilder auf beliebige Größe skalieren
- **Auto-Trim** (NEU!): Automatisches Entfernen transparenter Bereiche
  - Minimaler Abstand konfigurierbar (0-50px, Standard: 2px)
  - Erkennungstoleranz einstellbar (5-100, Standard: 100)
  - **Feste Zielgröße nach Auto-Trim** (NEU!): Getrimte Bilder auf exakte Größe skalieren mit Beibehaltung der Proportionen
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
   - **Auto-Trim** aktivieren für automatisches Entfernen transparenter Bereiche
     - Optional: "Feste Zielgröße nach Auto-Trim" für exakte Abmessungen (z.B. 512x512)
     - Funktioniert in allen Modi (Komprimieren, Zerlegen, etc.)
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

## 🎯 Auto-Trim mit fester Zielgröße Feature

Das neue Auto-Trim Feature löst ein häufiges Problem bei der Bildbearbeitung:

### Problem
Beim Entfernen transparenter Bereiche (Auto-Trim) entstehen variable Bildgrößen (z.B. 477x500, 823x901), 
was problematisch ist, wenn einheitliche Abmessungen benötigt werden.

### Lösung
Die Option "Feste Zielgröße nach Auto-Trim" kombiniert drei Schritte:
1. **Auto-Trim**: Entfernt transparente Bereiche automatisch
2. **Proportionale Skalierung**: Passt das getrimte Bild in die Zielgröße ein
3. **Zentrierung**: Platziert den Inhalt mittig im transparenten Canvas

### Anwendungsbeispiele
- **Icons**: 512x512 App-Icons mit konsistenten Abmessungen
- **Sprites**: Einheitliche Sprite-Größen für Game-Development
- **Thumbnails**: Konsistente Vorschaubilder für Galerien
- **Asset-Bibliotheken**: Standardisierte Bildgrößen für Design-Systeme

### Workflow
1. Modus wählen (funktioniert mit allen Modi)
2. "Auto-Trim" aktivieren
3. "Feste Zielgröße nach Auto-Trim" aktivieren
4. Zielgröße eingeben (z.B. 512×512)
5. Verarbeiten → Ergebnis: Exakte Abmessungen mit zentriertem Inhalt

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
- **Frontend**: Modulares TypeScript + Vite + ES2022 Module
- **Architektur**: Event-driven, komponentenbasiert, Service Layer Pattern
- **Bildverarbeitung**: Sharp (schnell und präzise)
- **Komprimierung**: imagemin + pngquant + optipng
- **Upload**: Multer für Dateiverarbeitung
- **TypeScript**: Strict Mode, vollständige Type-Safety

## 🏗️ Frontend Architektur (Refactored)

Das Frontend wurde von einer monolithischen in eine professionelle, modulare Architektur umgebaut:

### Ordnerstruktur

```
img-bulk-tool/
├── src/                           # Backend TypeScript
│   ├── server.ts                  # Express Server
│   └── lib/                       # Backend Services
│       ├── imageProcessor.ts      # Bildverarbeitung Logic
│       ├── compressor.ts          # PNG Komprimierung
│       └── fileManager.ts        # File-Handling
├── public/                        # Frontend (Modulares TypeScript)
│   ├── index.html                 # Single Page App
│   ├── css/main.css              # Styling
│   └── js/                        # Modulare Frontend-Architektur
│       ├── main.ts               # Application Entry Point
│       ├── components/           # Wiederverwendbare UI-Komponenten
│       │   ├── BaseComponent.ts  # Abstract Base für alle Komponenten
│       │   └── TabComponent.ts   # Tab-System Manager
│       ├── features/             # Feature-Module
│       │   ├── BulkProcessor.ts  # Bulk-Verarbeitung Feature
│       │   └── LayerEditor.ts    # Layer-Editor Feature
│       ├── services/             # Business Logic Layer
│       │   ├── ApiService.ts     # REST API Communication
│       │   └── FileService.ts    # File-Handling Logic
│       ├── models/               # TypeScript Interfaces & Types
│       │   └── index.ts          # Alle Datenstrukturen
│       └── utils/                # Hilfsfunktionen
│           └── EventBus.ts       # Event-System für lose Kopplung
├── dist/                         # Kompilierte Dateien
├── uploads/                      # Temporäre Uploads  
└── output/                       # Verarbeitete Bilder
```

### 🎯 Architektur-Prinzipien

1. **Komponentenbasiert**: Jede UI-Einheit ist eine wiederverwendbare Komponente
2. **Service Layer**: Business Logic getrennt von UI-Code
3. **Event-driven**: Lose Kopplung durch Event Bus System
4. **Single Responsibility**: Jede Klasse hat genau eine Verantwortung
5. **Dependency Injection**: Services werden injiziert, nicht direkt instantiiert
6. **Type Safety**: Vollständige TypeScript-Abdeckung mit strict mode

### 🔧 Design Patterns

- **Observer Pattern**: Event Bus für komponentenübergreifende Kommunikation
- **Factory Pattern**: Service Singletons
- **Template Method**: BaseComponent mit abstrakte Methoden
- **Strategy Pattern**: Verschiedene Processing-Modi
- **Facade Pattern**: Services abstrahieren komplexe API-Calls

## Scripts

- `npm run dev`: Entwicklungsmodus (Backend + Frontend Watch)
- `npm run build`: Vollständiger Build (Backend + Frontend)
- `npm run build:backend`: Nur Backend kompilieren
- `npm run build:frontend`: Nur Frontend kompilieren  
- `npm run start`: Server starten (benötigt Build)
- `npm run serve`: Frontend Preview
- `npm run type-check`: TypeScript Type-Checking ohne Build