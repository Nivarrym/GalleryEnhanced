# Changelog

All notable changes in **ComfyUI-Gallery-Fork** relative to the upstream
[PanicTitan/ComfyUI-Gallery](https://github.com/PanicTitan/ComfyUI-Gallery),
starting from upstream **2.7.1**. Maintained by **Nivarrym**.

## 2.20.3

- **Source workflow:** the card action now opens the embedded graph in a new
  workflow tab inside the current ComfyUI session (no browser popup or new
  ComfyUI session).
- **Info view:** replaced the Ant info-preview path with a fixed metadata
  overlay; clicking its backdrop closes it and it can be reopened repeatedly.
- **Open gallery:** renamed the loader's node button from the misleading
  "Upload File" to "Open gallery".
- **Card actions:** removed the visual selected check and corner tag badges;
  reordered primary actions and moved favorite/trash to a second action row.
  A favorited asset keeps a pinned clickable star in the card corner even when
  the hover toolbar is hidden.
- **Node layout:** split video/audio nodes into separate modules, added shared
  filesystem/combo helpers (`gallery_node_utils.py`,
  `gallery_media_common.py`), renamed `gallery_node.py` to
  `gallery_button_node.py`, and simplified `__init__.py` registration.

## 2.20.2

### Folder sidebar context menu

- Added the gallery theme class to the portalled folder context menu so its
  background and text colors resolve in light and dark mode.
- Right-clicking empty sidebar space below the folder tree now opens the same
  folder context menu for the current folder.
- `Unload Models` moved out of the gallery package to the separate
  `Nivarrym_nodes` package.
- `LoadImageFromGallery` now exposes annotated `[output]` paths plus
  `node.imgs`, `node.images` and `previewMediaType`, so ComfyUI's native mask
  editor, node context menu and selection toolbar work immediately after Add to
  Graph. Mask editor saves are accepted from `[input]` paths as well.
- Removed the duplicate custom DOM preview from `LoadImageFromGallery`; the node
  now uses only LiteGraph's native image preview.
- Added a native-looking **Upload File** widget button to `LoadImageFromGallery`
  that opens the gallery instead of a file dialog.
- Added an **Open source workflow** card action that reads the embedded workflow
  metadata and opens it in a new workflow tab inside the current ComfyUI session.
- Clicking the empty area around the Info/Metadata view now closes the preview.

## 2.20.1

### Quick delete trashed assets

- Added a trash-can button to the gallery top bar with a tooltip and the count of
  marked assets.
- Confirmation opens a modal with **From** and **To** date-time pickers
  (calendar plus time). Both fields default to empty, meaning no limit.
- Only assets marked as trash and inside the selected date range are deleted;
  assets outside the range are excluded even when marked.
- The confirmation shows total marked and in-range counts, validates the range
  and disables deletion when nothing is eligible.
- Deleted assets have their local trash/favorite marks removed automatically.

## 2.20.0

### Preview

- Clicking the dark backdrop around a preview closes the preview while keeping
  the gallery open.
- Selection previews keep the active image selected; the magnifier opens a
  read-only preview that does not alter selection.
- Filename chip above previewed images.

### Trash, favorites and filtering

- **Space** toggles a persistent trash mark in preview or in the grid. In the
  grid it applies to the selection, or to the hovered card when nothing is
  selected.
- Trashed cards are muted and display a bin icon.
- **F** toggles a persistent favorite star; cards also have a favorite action
  button.
- Marking trash in the preview advances to the next image. The
  **Skip trash when advancing** setting controls whether already marked images
  are skipped.
- Top-bar filter: **No filter**, **Favorites**, **Trash**.
- Marks are stored in `localStorage` under `comfy-ui-gallery-asset-tags`.

### Folder hierarchy

- Sidebar **New folder** button.
- Custom right-click menu: **New subfolder**, **Rename**, **Delete**.
- Empty folders remain visible in the tree and can be deleted.
- Backend routes validate paths with the same gallery-root containment rules as
  asset operations.

### Replace selected node

- New card **Replace** action updates the asset of the single selected
  `Load Image / Video / Audio From Gallery` node in place, without creating a
  node or changing its title/position.

## 2.19.0–2.19.5

### Comparison

- Compare exactly two images/videos with a draggable wipe divider, default
  50/50 overlay.
- Horizontal/vertical divider, Overlay switch with tooltip, side-by-side mode,
  Swap A/B, percentage readout.
- Fade by dragging anywhere over the image; a fixed 360 px movement spans
  0–100% with no jump from the click position.
- Asset A is the reference; B can fit, fill, stretch, use original size, match
  width or match height, and uses a configurable 3×3 anchor (center by default).
- Works across different sizes/aspect ratios and for videos.

### Mask editor

- Card and selection-toolbar Mask actions upload the image to
  `input/gallery_masks` and open ComfyUI's built-in mask editor on a standard
  `LoadImage` node.
- The gallery and any open Ant image preview are closed before the editor opens.

### Selection outline

- Selected card outline is drawn inside the card, fixing clipping at grid-row
  boundaries caused by `content-visibility`.

## Earlier fork features

### Selection and batch operations

- Ctrl/Cmd+click toggle, Shift+click range, marquee box selection with
  auto-scroll and Ctrl/Cmd add, Ctrl/Cmd+A, Esc, Delete/Backspace.
- Floating selection toolbar with count, Select all, Add to graph, Download,
  Delete, Clear; ZIP batch download.
- Batch delete via one `/Gallery/delete` request with per-file error reporting.
- Per-card delete with confirmation and folder-wide selection via
  Ctrl/Cmd+click in the sidebar.

### Gallery layout and navigation

- React/Vite rewrite with native CSS-grid cards.
- Card size slider (160–600 px), persisted.
- Pagination modes: endless, 20, 40, 60, 100, 200.
- Resizable sidebar with persisted width.
- Endless scroll and viewport-near thumbnail loading.
- Sticky date dividers without a gap above the first row.
- Single Name sort segment toggling ascending/descending.
- Compact settings dialog with live dark-theme preview.

### Previews and metadata

- Metadata inspection with structured and raw JSON views, click-to-copy values.
- Lazy metadata loading per asset.
- Video/audio/3D preview support, video hover playback and Shift for sound.
- Preview filename chip and selection-aware Delete behavior.

### Server-side performance

- Lazy directory scan (`stat` only) with single-flight TTL cache and off-loop
  execution.
- On-demand metadata and cached WebP thumbnails.
- Revision token (`mtime_ns-size`) on asset, thumbnail, video, audio and model
  URLs to prevent stale browser caches.
- Performance report (client/server timings, scan cache and thumbnail stats).
- Polling observer fix and Pillow handle cleanup.

### Graph integration

- `Load Image From Gallery` (IMAGE + MASK) recursively scans the output folder,
  with EXIF orientation, alpha and animated frames.
- `Load Video From Gallery` (VIDEO) and `Load Audio From Gallery` (AUDIO).
- `Unload Models` moved to the separate `Nivarrym_nodes` package.
- Add to active graph (including subgraphs) with visible-slot placement.
- In-node image preview for `Load Image From Gallery`, refreshed from the file
  widget.
- Replace selected node's asset.

### Dark theme and API

- Complete dark theme: modal, header, sidebar/tree, grid, cards, selection
  toolbar, settings, performance panel, metadata/raw JSON and scrollbars.
- Batch delete, reveal-in-file-manager and open-with-default-app endpoints.
- Folder create/rename/delete endpoints (2.20.0).
- Settings for theme, video hover, floating button visibility, Ctrl+G, scan
  extensions, thumbnail fit, polling, symlink deduplication and logs.

### Fork identity

- Package/repository name `ComfyUI-Gallery-Fork`, author metadata **Nivarrym**,
  upstream attribution retained.

## Known limitations

- Batch and quick delete are permanent; there is no undo.
- Only empty folders can be deleted.
- Tags are stored per browser profile in `localStorage`; moving a file changes
  its URL and therefore its mark.
- Thumbnails are generated for raster images; video/audio/3D use native preview
  paths.
