import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { pipeline, env } from '@xenova/transformers';



env.allowLocalModels = false;
env.useBrowserCache = true;

window.switchMode = (mode) => {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('video-screen').classList.add('hidden');
    document.getElementById('photo-screen').classList.add('hidden');

    if(mode === 'home') document.getElementById('home-screen').classList.remove('hidden');
    if(mode === 'video') document.getElementById('video-screen').classList.remove('hidden');
    if(mode === 'photo') document.getElementById('photo-screen').classList.remove('hidden');
};

const ffmpeg = new FFmpeg();
let ffmpegLoaded = false;

const vidInput = document.getElementById('vid-upload');
const mainVideo = document.getElementById('main-video');
const vidPlaceholder = document.getElementById('video-placeholder');
const vidFileName = document.getElementById('video-file-name');
const playBtn = document.getElementById('play-btn');
const timeDisplay = document.getElementById('time-display');
const timelineTrack = document.getElementById('timeline-track');

const vidSpeed = document.getElementById('vid-speed');
const vidBright = document.getElementById('vid-brightness');
const vidContrast = document.getElementById('vid-contrast');
const vidSat = document.getElementById('vid-saturation');

const btnCaptions = document.getElementById('btn-auto-captions');
const captionStatus = document.getElementById('caption-status');
const captionText = document.getElementById('caption-text');

if (timelineTrack && !document.getElementById('playhead')) {
    timelineTrack.innerHTML = `
        <div id="playhead"></div>
        <div id="trim-box">
            <div class="handle left" id="handle-left"></div>
            <div class="handle right" id="handle-right"></div>
        </div>
    `;
}

const playhead = document.getElementById('playhead');
const trimBox = document.getElementById('trim-box');
const handleLeft = document.getElementById('handle-left');
const handleRight = document.getElementById('handle-right');

let videoDuration = 0;
let trimStartPct = 0;
let trimEndPct = 1;
let isDraggingHandle = null;

async function loadFFmpeg() {
    if (ffmpegLoaded) return;


    const baseURL = window.location.origin;
    
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    });
    
    ffmpegLoaded = true;
    console.log('FFmpeg Ready (Local Plugin Mode)');
}
// 5. VIDEO LOGIC
if (vidInput) {
    vidInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            mainVideo.src = url;
            mainVideo.style.display = 'block';
            vidPlaceholder.style.display = 'none';
            vidFileName.textContent = file.name;
            
            mainVideo.onloadedmetadata = () => {
                videoDuration = mainVideo.duration;
                trimStartPct = 0;
                trimEndPct = 1;
                updateTrimUI();
            };
        }
    });
}

function updateVideoPreview() {
    if (!mainVideo) return;
    const speed = parseFloat(vidSpeed.value);
    mainVideo.playbackRate = speed;
    const b = vidBright.value;
    const c = vidContrast.value;
    const s = vidSat.value;
    mainVideo.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

if(vidSpeed) vidSpeed.addEventListener('change', updateVideoPreview);
if(vidBright) vidBright.addEventListener('input', updateVideoPreview);
if(vidContrast) vidContrast.addEventListener('input', updateVideoPreview);
if(vidSat) vidSat.addEventListener('input', updateVideoPreview);

if (playBtn) {
    playBtn.addEventListener('click', () => {
        if (mainVideo.paused) {
            if (mainVideo.currentTime >= trimEndPct * videoDuration) {
                mainVideo.currentTime = trimStartPct * videoDuration;
            }
            mainVideo.play();
            playBtn.textContent = "⏸";
            requestAnimationFrame(updateTimelineLoop);
        } else {
            mainVideo.pause();
            playBtn.textContent = "▶";
        }
    });
}

function updateTimelineLoop() {
    if (mainVideo.paused) return;
    const current = mainVideo.currentTime;
    const end = trimEndPct * videoDuration;
    
    if (current >= end) {
        mainVideo.currentTime = trimStartPct * videoDuration;
    }
    
    const pct = (current / videoDuration) * 100;
    if (playhead) playhead.style.left = `${pct}%`;
    if (timeDisplay) timeDisplay.textContent = new Date(current * 1000).toISOString().substr(14, 5);
    
    requestAnimationFrame(updateTimelineLoop);
}

if (handleLeft && handleRight) {
    handleLeft.addEventListener('mousedown', (e) => startDrag(e, 'left'));
    handleRight.addEventListener('mousedown', (e) => startDrag(e, 'right'));
}

function startDrag(e, side) {
    isDraggingHandle = side;
    e.stopPropagation();
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!isDraggingHandle) return;
    const rect = timelineTrack.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    
    if (isDraggingHandle === 'left') {
        trimStartPct = Math.min(pos, trimEndPct - 0.05);
        mainVideo.currentTime = trimStartPct * videoDuration;
    } else {
        trimEndPct = Math.max(pos, trimStartPct + 0.05);
    }
    updateTrimUI();
}

function stopDrag() {
    isDraggingHandle = null;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function updateTrimUI() {
    if (trimBox) {
        trimBox.style.left = `${trimStartPct * 100}%`;
        trimBox.style.width = `${(trimEndPct - trimStartPct) * 100}%`;
    }
}

if (btnCaptions) {
    btnCaptions.addEventListener('click', async () => {
        if (!mainVideo.src) return alert("Load a video first!");
        
        btnCaptions.disabled = true;
        captionStatus.textContent = "Loading FFmpeg...";
        
        try {
            await loadFFmpeg();
            
            captionStatus.textContent = "Extracting audio...";
            await ffmpeg.writeFile('input.mp4', await fetchFile(vidInput.files[0]));
            
            await ffmpeg.exec([
                '-i', 'input.mp4', 
                '-vn',              // No Video
                '-acodec', 'pcm_s16le', // WAV encoding
                '-ar', '16000',     // 16kHz sample rate
                '-ac', '1',         // Mono channel
                'audio.wav'
            ]);
            
            const audioData = await ffmpeg.readFile('audio.wav');
            
            captionStatus.textContent = "Loading AI Model (approx 240MB)...";
const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
            
            captionStatus.textContent = "Transcribing audio...";
            
            const blob = new Blob([audioData.buffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            const output = await transcriber(url, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true
            });
            
            let srtContent = "";
            output.chunks.forEach((chunk, index) => {
                const start = formatSRTTime(chunk.timestamp[0]);
                const end = formatSRTTime(chunk.timestamp[1]);
                srtContent += `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n\n`;
            });
            
            captionText.value = srtContent;
            captionStatus.textContent = "Done! You can edit the SRT below.";
            
            await ffmpeg.deleteFile('audio.wav');
            await ffmpeg.deleteFile('input.mp4');

        } catch (error) {
            console.error(error);
            captionStatus.textContent = "Error: " + error.message;
        }
        
        btnCaptions.disabled = false;
    });
}

function formatSRTTime(seconds) {
    if (seconds === null) return "00:00:00,000";
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}


const exportBtn = document.getElementById('btn-export-video') || document.querySelector('#video-screen .primary-btn');

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        if (!mainVideo.src) return alert("No video loaded");
        
        exportBtn.disabled = true;
        const originalText = exportBtn.textContent;
        exportBtn.textContent = "Initializing...";
        
        try {
            await loadFFmpeg();
            
            // --- 1. LOAD FONT (CRITICAL FOR SUBTITLES) ---
            // FFmpeg WASM has no system fonts. We must provide one.
            exportBtn.textContent = "Loading Fonts...";
            const fontURL = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf';
            await ffmpeg.writeFile('arial.ttf', await fetchFile(fontURL));

            // --- 2. LOAD VIDEO ---
            exportBtn.textContent = "Loading Video...";
            await ffmpeg.writeFile('input.mp4', await fetchFile(vidInput.files[0]));
            
            // --- 3. HANDLE CAPTIONS ---
            let hasCaptions = false;
            if (captionText.value.trim().length > 0) {
                console.log("Found captions, writing file...");
                await ffmpeg.writeFile('subtitles.srt', captionText.value);
                hasCaptions = true;
            }

            // --- 4. PREPARE FILTERS ---
            const start = trimStartPct * videoDuration;
            const duration = (trimEndPct * videoDuration) - start;
            
            const speed = parseFloat(vidSpeed.value);
            const setPts = (1 / speed).toFixed(2);
            const atempo = speed; 

            const bVal = ((vidBright.value - 100) / 100).toFixed(2); 
            const cVal = (vidContrast.value / 100).toFixed(2);
            const sVal = (vidSat.value / 100).toFixed(2);

            // Filter Chain: Colors -> Speed
            let videoFilter = `eq=brightness=${bVal}:contrast=${cVal}:saturation=${sVal},setpts=${setPts}*PTS`;
            
            // Add Subtitles
            // fontsdir=/ tells FFmpeg to look in the main folder for the arial.ttf we uploaded
            if (hasCaptions) {
                videoFilter += `,subtitles=subtitles.srt:fontsdir=/:force_style='Fontname=arial,FontSize=24,PrimaryColour=&H00FFFF00,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=20'`;
            }

            const audioFilter = `atempo=${atempo}`;

            exportBtn.textContent = "Rendering...";

            // --- 5. EXECUTE ---
            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-ss', String(start),
                '-t', String(duration),
                '-vf', videoFilter,
                '-af', audioFilter,
                '-c:v', 'libx264',      
                '-crf', '18',           
                '-preset', 'ultrafast', 
                '-c:a', 'aac',         
                'output.mp4'
            ]);
            
            const data = await ffmpeg.readFile('output.mp4');
            const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'captioned-video.mp4';
            a.click();
            
            // --- 6. CLEANUP ---
            await ffmpeg.deleteFile('input.mp4');
            await ffmpeg.deleteFile('output.mp4');
            await ffmpeg.deleteFile('arial.ttf'); // Clean up font
            if (hasCaptions) await ffmpeg.deleteFile('subtitles.srt');
            
            alert("Export Complete!");
            
        } catch (err) {
            console.error(err);
            alert("Export Failed: " + err.message);
        }
        
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
    });
}

const photoInput = document.getElementById('photo-upload');
const mainPhoto = document.getElementById('main-photo');
const photoPlaceholder = document.getElementById('photo-placeholder');
const brightSlider = document.getElementById('bright-slider');
const contrastSlider = document.getElementById('contrast-slider');
const graySlider = document.getElementById('gray-slider');
const btnRemoveBg = document.getElementById('btn-remove-bg');
const aiStatus = document.getElementById('ai-status');

if (photoInput) {
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            mainPhoto.src = URL.createObjectURL(file);
            mainPhoto.style.display = 'block';
            photoPlaceholder.style.display = 'none';
        }
    });
}

function updatePhotoFilters() {
    if (!mainPhoto) return;
    const b = brightSlider ? brightSlider.value : 100;
    const c = contrastSlider ? contrastSlider.value : 100;
    const g = graySlider ? graySlider.value : 0;
    mainPhoto.style.filter = `brightness(${b}%) contrast(${c}%) grayscale(${g}%)`;
}

if (brightSlider) brightSlider.addEventListener('input', updatePhotoFilters);
if (contrastSlider) contrastSlider.addEventListener('input', updatePhotoFilters);
if (graySlider) graySlider.addEventListener('input', updatePhotoFilters);

if (btnRemoveBg) {
    btnRemoveBg.addEventListener('click', async () => {
        if (!mainPhoto.src) return alert("Please upload a photo first!");
        try {
            btnRemoveBg.disabled = true;
            if (aiStatus) aiStatus.textContent = "Loading AI...";
            const segmenter = await pipeline('image-segmentation', 'Xenova/modnet');
            if (aiStatus) aiStatus.textContent = "Removing background...";
            const output = await segmenter(mainPhoto.src);
            const mask = output[0].mask;
            const canvas = document.createElement('canvas');
            canvas.width = mask.width;
            canvas.height = mask.height;
            const ctx = canvas.getContext('2d');
            const tempImg = new Image();
            tempImg.crossOrigin = "anonymous";
            tempImg.src = mainPhoto.src;
            await new Promise(resolve => tempImg.onload = resolve);
            ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
            const originalPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < mask.data.length; i++) {
                originalPixels.data[i * 4 + 3] = mask.data[i];
            }
            ctx.putImageData(originalPixels, 0, 0);
            mainPhoto.src = canvas.toDataURL();
            if (aiStatus) aiStatus.textContent = "Background Removed!";
            btnRemoveBg.disabled = false;
        } catch (error) {
            console.error(error);
            if (aiStatus) aiStatus.textContent = "Error: " + error.message;
            btnRemoveBg.disabled = false;
        }
    });
}

const btnExportPhoto = document.getElementById('btn-export');
const exportFormat = document.getElementById('export-format');
if (btnExportPhoto) {
    btnExportPhoto.addEventListener('click', () => {
        if (!mainPhoto.src || mainPhoto.style.display === 'none') return alert("No image to export!");
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const tempImg = new Image();
        tempImg.crossOrigin = "anonymous";
        tempImg.src = mainPhoto.src;
        tempImg.onload = () => {
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            ctx.filter = getComputedStyle(mainPhoto).filter;
            ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
            const format = exportFormat ? exportFormat.value : 'image/png';
            const quality = format === 'image/jpeg' ? 0.9 : 1.0;
            const dataURL = canvas.toDataURL(format, quality);
            const link = document.createElement('a');
            link.href = dataURL;
            const ext = format.split('/')[1].replace('jpeg', 'jpg');
            link.download = `edited-image.${ext}`;
            link.click();
        };
    });
}
function updateTimeDisplay(startTime, endTime) {
    const startSpan = document.getElementById('start-time-text');
    const endSpan = document.getElementById('end-time-text');

    if (startSpan) {
        startSpan.textContent = startTime + 's';
    }
    
    if (endSpan) {
        endSpan.textContent = endTime + 's';
    }
}

updateTimeDisplay(1.5, 12.0);