// Show selected screen
function switchMode(mode) {

    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('video-screen').classList.add('hidden');
    document.getElementById('photo-screen').classList.add('hidden');


    if (mode === 'home') document.getElementById('home-screen').classList.remove('hidden');
    if (mode === 'video') document.getElementById('video-screen').classList.remove('hidden');
    if (mode === 'photo') document.getElementById('photo-screen').classList.remove('hidden');
}


// --- VIDEO EDITOR LOGIC ---
const vidInput = document.getElementById('vid-upload');
const mainVideo = document.getElementById('main-video');
const vidPlaceholder = document.getElementById('video-placeholder');
const timelineClip = document.getElementById('timeline-clip');
const vidFileName = document.getElementById('video-file-name');

vidInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        mainVideo.src = url;
        

        mainVideo.style.display = 'block';
        vidPlaceholder.style.display = 'none';
        vidFileName.textContent = file.name;
        

        timelineClip.style.display = 'block';
        timelineClip.style.width = '200px'; // Static width for now
        timelineClip.textContent = file.name;
        timelineClip.style.padding = '5px';
        timelineClip.style.color = 'white';
        timelineClip.style.fontSize = '12px';
        timelineClip.style.overflow = 'hidden';
    }
});


// --- PHOTO EDITOR LOGIC ---
const photoInput = document.getElementById('photo-upload');
const mainPhoto = document.getElementById('main-photo');
const photoPlaceholder = document.getElementById('photo-placeholder');


const brightSlider = document.getElementById('bright-slider');
const contrastSlider = document.getElementById('contrast-slider');
const graySlider = document.getElementById('gray-slider');

// Upload Photo
photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        mainPhoto.src = url;
        mainPhoto.style.display = 'block';
        photoPlaceholder.style.display = 'none';
    }
});

// (Function to run on any photo slider change)
function updateFilters() {
    const b = brightSlider.value;
    const c = contrastSlider.value;
    const g = graySlider.value;
    
    mainPhoto.style.filter = `brightness(${b}%) contrast(${c}%) grayscale(${g}%)`;
}

brightSlider.addEventListener('input', updateFilters);
contrastSlider.addEventListener('input', updateFilters);
graySlider.addEventListener('input', updateFilters);

// --- AI BACKGROUND REMOVAL LOGIC ---
const btnRemoveBg = document.getElementById('btn-remove-bg');
const aiStatus = document.getElementById('ai-status');
btnRemoveBg.addEventListener('click', async () => {
    if (!mainPhoto.src) {
        alert("Please upload a photo first!");
        return;
    }

    try {
        btnRemoveBg.disabled = true;
        aiStatus.textContent = "Loading AI... (First run takes time)";


        const segmenter = await window.pipeline('image-segmentation', 'Xenova/modnet');

        aiStatus.textContent = "Removing background...";
        

        const output = await segmenter(mainPhoto.src);
        
        // The output is a "mask" (a black and white image where white = keep, black = delete)
        // We need to access the mask data. Depending on the version, it's usually in output[0].mask
        const maskData = output[0].mask; 


        const canvas = document.createElement('canvas');
        canvas.width = maskData.width;
        canvas.height = maskData.height;
        const ctx = canvas.getContext('2d');


        const tempImg = new Image();
        tempImg.crossOrigin = "anonymous";
        tempImg.src = mainPhoto.src;
        await new Promise(resolve => tempImg.onload = resolve);
        

        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);


        const originalPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        

        // Keep the RGB colors from the original,
        // but we update the Alpha (Transparency) based on the AI mask.
        for (let i = 0; i < maskData.data.length; i++) {

            const confidence = maskData.data[i]; 
            originalPixels.data[i * 4 + 3] = confidence; 
        }


        ctx.putImageData(originalPixels, 0, 0);


        mainPhoto.src = canvas.toDataURL();
        
        aiStatus.textContent = "Background Removed!";
        btnRemoveBg.disabled = false;

    } catch (error) {
        console.error(error);
        aiStatus.textContent = "Error: " + error.message;
        btnRemoveBg.disabled = false;
    }
});



const btnExport = document.getElementById('btn-export');
const exportFormat = document.getElementById('export-format');

btnExport.addEventListener('click', () => {
    const img = document.getElementById('main-photo');
    
    if (!img.src || img.style.display === 'none') {
        alert("No image to export!");
        return;
    }


    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous"; 
    tempImg.src = img.src;

    tempImg.onload = () => {
        canvas.width = tempImg.naturalWidth;
        canvas.height = tempImg.naturalHeight;

        // We grab the filter string directly from the CSS (e.g., "brightness(120%)")
        // and tell the canvas to use it.
        ctx.filter = getComputedStyle(img).filter;

        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);

        const format = exportFormat.value; // 'image/png' or 'image/jpeg'

        const quality = format === 'image/jpeg' ? 0.9 : 1.0;
        const dataURL = canvas.toDataURL(format, quality);


        const link = document.createElement('a');
        link.href = dataURL;
        
        const extension = format.split('/')[1].replace('jpeg', 'jpg'); 
        link.download = `edited-image.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
});