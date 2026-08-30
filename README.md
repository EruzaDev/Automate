# Automate

Automate is a batch production environment for generating:
1. **Certificate** (Interactive Drag-and-Drop Batch Layout Studio with live dataset search, CSV data editor, selection-aware rich-text formatting, custom message templates, Title Case rules, custom font upload, and high-resolution 1:1 batch ZIP exporter with real-time progress modal).
2. **Automate Framing** (Company frame overlay compositor with Smart Center-Crop algorithm for scaling photo batches without aspect ratio stretching).

---

## 🚀 How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## 🛠️ Build for Production

```bash
npm run build
```

The output will be bundled into the `dist/` directory ready for static production deployment.

---

## 💡 Feature Highlights

### 📜 Certificate Studio
- **Interactive Drag & Resize Stage**: Position, align, and resize text fields on certificate template images with live magnetic snapping guides.
- **Custom Message Templates**: Write dynamic templates like `Awarded to ***{first_name} {middle_name} {last_name}*** for completing {Course}` with case-insensitive placeholder resolution.
- **Selection-Aware Formatting**: Highlight text in the editor to wrap only the highlighted selection with Bold, Italic, Underline, or Strikethrough markdown tags.
- **Text Casing & Styling**: Apply Title Case (`Title Case / Titled`), UPPERCASE, lowercase, or preserve original CSV casing. Customize font family, font weight, hex text colors (`#HEX`), letter spacing, and word spacing.
- **Custom Font Upload Engine**: Upload custom font files (`.ttf`, `.otf`, `.woff`, `.woff2`) for instant canvas rendering.
- **In-Place CSV Data Editor**: Live search, cell edit, add rows, and delete rows directly in the built-in modal editor.
- **Live Search & Stage Preview**: Search any record by name or keyword to immediately preview that exact record on the interactive stage.
- **High-Resolution 1:1 Batch Exporter**: Automatically scales font size and spacing to match full image resolution on download, accompanied by a real-time batch progress loading modal.

### 🖼️ Automate Framing
- **Smart Center-Crop Algorithm**: Scales and centers batch photos to fill transparent PNG frame boundaries without aspect ratio distortion.
- **Batch Download**: Export framed documentation photo batches into a single organized ZIP archive.
