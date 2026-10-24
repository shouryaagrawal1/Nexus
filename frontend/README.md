# Nexus Frontend 🖥️

Modern, high-performance dark-mode desktop web interface for **Project Nexus**, built with **React 19**, **Vite**, and **React Flow (@xyflow/react)**.

---

## 🎨 Visual Architecture

The UI is engineered as a split-pane desktop IDE inspired by modern tools like VS Code and Obsidian:

- **Left Sidebar (15% width / 260px)**:
  - Repository switcher & "+ Connect Local Repo" action button.
  - Active workspace metadata (file counts, paths).
  - Live server health badges polling `/api/health` every 10 seconds (ChromaDB, Neo4j, Gemini LLM).
- **Center Chat Pane (45% width)**:
  - Codebase intelligence chat with markdown rendering.
  - Interactive `[[Entity]]` pills dynamically parsed from AI prose.
  - Syntax-highlighted code blocks with line numbers, copy button, and code drawer expansion.
  - Sticky command bar with `Enter` / `Shift+Enter` shortcut handling.
- **Right Architecture Canvas (40% width)**:
  - Interactive `@xyflow/react` graph rendering files, classes, and functions with custom styled nodes.
  - **Single-Click**: Activates **Blast Radius**, dimming unrelated components and illuminating glowing red impact edges.
  - **Contextual '+' Expander**: Dynamically queries Neo4j for 1st & 2nd degree dependencies and appends them to the canvas.
  - **Double-Click**: Slides open the in-canvas **CodeDrawer** to inspect raw local source code.
- **Ingestion Modal**:
  - Modal overlay with real-time SSE progress terminal.
  - 3 dynamic progress bars tracking AST parsing, Neo4j graph mapping, and ChromaDB vector generation.

---

## 📂 Component Hierarchy

```text
src/
├── index.css            # Dark-mode design system & CSS custom properties
├── App.jsx              # Main 3-pane layout coordinating state & overlays
├── components/
│   ├── Sidebar.jsx      # Workspace manager & server health status
│   ├── ConnectModal.jsx # Ingestion modal with 3 SSE progress bars & event logs
│   ├── ChatPane.jsx     # Intelligence chat with [[Entity]] pill parser & snippets
│   ├── CanvasPane.jsx   # React Flow interactive graph with Blast Radius highlight
│   ├── CodeDrawer.jsx   # Sliding code inspection drawer
│   └── FilePill.jsx     # Clickable entity pill component
├── hooks/
│   └── useHealth.js     # Health polling hook
└── services/
    └── api.js           # Fetch client & SSE event source listener
```

---

## 🛠️ Development & Build

### Running Locally
```bash
npm install
npm run dev
```
The dev server starts on `http://localhost:5173` with a proxy configured in `vite.config.js` forwarding `/api` requests to `http://127.0.0.1:8000`.

### Production Build
```bash
npm run build
```
Builds the optimized production client into `dist/`.
