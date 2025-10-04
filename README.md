## Meteor Mitigation Manager

Minimal starter project using Vite + React + TypeScript + PixiJS.

### Stack
- Vite (bundler & dev server)
- React 18 + TypeScript
- PixiJS 8

### Features Implemented
1. Vite React + TS style scaffold (manually created to match requirements)
2. Single `npm run dev` script launches the Vite dev server with hot reload
3. PixiJS scene embedded in React component (`App.tsx`):
	 - 800×600 canvas
	 - Dark background (`#111111`)
	 - Single centered yellow sun (static)

### Getting Started

#### 1. Install Dependencies
```powershell
npm install
```

#### 2. Run Dev Server (hot reload)
```powershell
npm run dev
```
Vite will print a local URL (default: http://localhost:5173). Open it in your browser; edits under `src/` hot-reload automatically.

#### 3. Build for Production
```powershell
npx vite build
```
Outputs static assets to `dist/`. You can preview the production build locally:
```powershell
npx vite preview
```

### Project Structure
```
index.html
package.json
tsconfig.json
vite.config.ts
src/
	main.tsx
	App.tsx
	vite-env.d.ts
```

### Code Notes
- Proper TypeScript PixiJS imports (`Application`, `Graphics`).
- Single static graphic (no animation, no ticker).
- Cleanup logic on React unmount destroys the Pixi application and resources.

### Next Ideas (Optional)
- Add resizing logic to fit window.
- Introduce animation (orbiting bodies) using the Pixi ticker.
- Add GUI (dat.GUI or Leva) to tweak parameters (sizes, colors).
- Add more sprites and basic interaction/collision checks.

---
MIT License (add LICENSE file if needed)
