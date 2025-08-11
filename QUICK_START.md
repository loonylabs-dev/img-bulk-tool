# 🚀 Quick Start - Bild-Bearbeitungs-Tool

## Sofort loslegen

1. **Server starten:**
```bash
npm start
```

2. **Browser öffnen:**
Gehe zu: `http://localhost:3000`

3. **Entwicklungsmodus** (mit Hot Reload):
```bash
npm run dev
```

## ✨ Funktionen

### 🖼️ Bildzerlegung
- Zerlegt quadratische Bilder in **4 gleich große Teile**
- Ausgabe: `präfix_1.png`, `präfix_2.png`, `präfix_3.png`, `präfix_4.png`

### 🗜️ PNG-Komprimierung
- **60-80% Dateigröße-Reduktion** (wie TinyPNG)
- Erhält **Transparenz** 
- Einstellbare Qualität (50-100%)

### 📐 Größenänderung
- Beliebige Zielgrößen möglich
- Erhält **Seitenverhältnis** mit transparentem Hintergrund

### 📦 Batch-Verarbeitung
- Bis zu **20 Bilder gleichzeitig**
- Individuelle **Präfixe** pro Bild
- Automatische **Nummerierung** mit Kollisionsvermeidung

## 🎯 Nutzung

1. **Bilder hochladen**: Drag & Drop oder Dateiauswahl
2. **Modus wählen**:
   - ✂️ Nur zerlegen
   - 📐 Nur Größe ändern  
   - 🗜️ Nur komprimieren
   - ✂️📐 Zerlegen + Größe ändern
3. **Einstellungen**:
   - Qualität: 50-100% (empfohlen: 85%)
   - Zielgröße: Breite × Höhe (wenn aktiviert)
   - Präfix: Individual oder global
4. **"Verarbeiten"** klicken
5. **Download**: Einzeln oder alle zusammen

## 📁 Ausgabe-Dateien

- **Format**: Immer `.png` (auch bei JPG-Input)
- **Benennung**: `[präfix]_[nummer].png`
- **Kollisionsvermeidung**: Automatisches Hochzählen bei existierenden Dateien
- **Speicherort**: `output/` Ordner (automatische Bereinigung nach 24h)

## ⚡ Performance

- **Sharp** für ultraschnelle Bildverarbeitung
- **Progressive Komprimierung** mit imagemin + pngquant
- **TypeScript** für Typsicherheit und bessere DX
- **Vite** für optimierte Frontend-Builds

## 🛠️ Build & Deploy

```bash
# Alles kompilieren
npm run build

# Nur Backend
npx tsc

# Nur Frontend  
npx vite build

# Production Server starten
npm start
```