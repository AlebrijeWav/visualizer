# visualizer

A single-file WebGL audio visualizer. Drop an audio track or connect the mic, and the feed reacts — cameras fly through morphing geometry, shapes pulse on the beat, and overlay layers drift in and out of frame.

Everything lives in `index.html` — HTML, CSS, JS, and GLSL shaders all in one file. No build step, no backend.

## Run it

Open `index.html` in any modern browser. For local development:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

(Serving via a local server is recommended — some mobile browsers block module scripts loaded via `file://`.)

## Loading audio

Three ways to feed the visualizer:

- **Audio file** — click the `audio file` button, pick any track (mp3/wav/m4a/etc.) On iOS, tap → **Choose Files** → **Browse** → Downloads.
- **Paste / drop** — drag an audio file anywhere on the page, or copy a sound file to the clipboard and hit the paste button (or ⌘V / Ctrl+V).
- **Microphone** — click `mic` to react to live audio from your device's input.

Once a track is playing, the scene auto-advances on strong beats and energy spikes.

## Scenes

Seven primary scenes rotate automatically. The auto-pilot picks a new one on beat spikes or after a maximum dwell time, and transitions are noise-dissolve crossfades (~1.4s).

| Scene | Description |
|-------|-------------|
| **lattice mandala** | Octahedron/cube cells arranged in radial wedges. Fold count steps 4→5→6→7 slowly; cells morph between oct and box, struts connect selectively. |
| **cross temple** | Two counter-rotating cross lattices smooth-unioned into an emerald hall with hot gold Fresnel edges. |
| **voxel cluster** | Sparse cel-shaded towers. Per-axis stretch pulses with bass; warm sunrise back-light opposes a cool key light. Hard white silhouette outlines. |
| **crystal field** | Scattered octahedral crystals tumbling through space. Each spins at its own rate and elongates axially with bass. |
| **glitch field** | 2D cyberpunk glitch — macro slice jumps on beat, scanline distortion with treble. Primary but short: auto-advances within a few seconds. |
| **bubble nebula** | Iridescent thin-film bubbles. Metaballs drift via low-freq sines; thickness-proportional rainbow dispersion at grazing angles. |
| **hyper tunnel** | Inside-the-tube flight through paneled walls, architectural rings, and a snaking path. |

### Overlay layers

Two additional elements float on top of whichever primary scene is active:

- **glyph layer** — sparse geometric symbols (crosses, squares, triangles, dots, X's) flicker over a 2-layer parallax grid. Visible during brief windows (~6s every ~24s) with intensity keyed to treble and beats.
- **iris layer** — chromatic concentric-ring lenses drifting over the frame. Whole field rotates, swirl-warps with radius, rings pulse in frequency, each lens spins on its own axis. Visible on a different phase-offset cycle (~8s every ~32s).

Both layers are gated off during glitch so that scene reads clean.

## Controls

- **Drag** — rotate the camera
- **Pinch / scroll** — zoom
- **Double-tap** — reset view
- **Play/Pause** button — pause both audio and animation
- **Fullscreen** button — toggle fullscreen
- **Hide HUD** button — clean feed with no overlay UI
- **Home** button — back to the start screen (useful for swapping tracks)
- **`#debug` URL hash** — enables a diag panel for troubleshooting

Seek by tapping/dragging on the waveform strip between the play and fullscreen buttons.

## How it works

- **Rendering**: Three.js + raw GLSL. Full-screen fragment shader raymarches SDF scenes (tetrahedral-gradient normals, 5-tap AO, soft shadows). Post-processing: feedback trails, multi-pass bloom, beat-reactive punch.
- **Audio analysis**: Web Audio `AnalyserNode`. FFT bins are split into bass / mid / treble averages, with an adaptive-threshold beat detector (variance-gated, refractory-periodicized).
- **Scene switching**: Noise-dissolve crossfade renders both scenes simultaneously for the transition duration and blends via an `fbm` mask.
- **Camera safety**: Before marching, the camera iteratively pushes itself outward along `normalize(ro)` until it has clearance from the SDF — beat-pumped geometry can't clip the lens.
- **Grid-feel breaker**: A low-frequency `warpDomain` helper bends cell space via three-axis sines so flythroughs curve through space instead of reading as an axis-aligned grid.

## Requirements

- WebGL 1 or 2 (Three.js picks automatically)
- Web Audio API + `AnalyserNode`
- A modern browser — tested on recent Chrome, Safari (macOS + iOS), Firefox

That's it. No npm, no bundler, no deps beyond the Three.js module import from CDN.
