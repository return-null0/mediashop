# Media Studio Browser

## A privacy-first, client-side video and photo editing suite running entirely in the browser.
---
Media Studio Browser leverages WebAssembly (WASM) to enable on-device AI and provide powerful editing capabilities without ever uploading user data to a server. It features an adaptive architecture that detects the user's device (Mobile vs. Desktop) and dynamically loads the appropriate AI model to balance performance and accuracy.
## Adaptive AI

| Device Type| Model Used| Characteristics|
|------------|-----------|----------------|
|Mobile| Xenova/whisper-tiny|Size: ~40MB.  Optimization: Uses q4 (4-bit quantization) and wasm backend.  Reasoning: Prevents iOS Safari tab crashes by keeping memory usage low.|
|Desktop | Xenova/whisper-small | Size: ~240MB.  Optimization: Standard precision.  Reasoning: Significantly higher accuracy than Tiny or Base models; capable of handling complex speech patterns, though requires more RAM.|
---
# Capabilities

### Video Editor

- The video editing suite is built on top of FFmpeg.wasm, allowing for frame-accurate processing directly in JavaScript.

- Users can drag handles to trim video start and end points with real-time preview looping.

- Real-time adjustment of Brightness, Contrast, and Saturation using CSS filters that are burned into the final MP4 upon export.

- Variable playback speed (0.5x to 2.0x)

- Generates subtitles (SRT format) automatically using local Whisper AI models. Users can edit the text before burning it into the video.

### Photo Editor

- The photo editor uses Canvas API and neural networks for image manipulation.

- Control over Brightness, Contrast, and Grayscale.

- One-click subject isolation using image segmentation AI  models.

- Supports exporting edited images as PNG, JPG, or WEBP.

---

## Technical Stack

- Core: Vanilla JavaScript (ES6+), HTML5, CSS3 

- `@ffmpeg/ffmpeg` (WebAssembly version of FFmpeg).

- `@huggingface/transformers` (Running ONNX models in browser).