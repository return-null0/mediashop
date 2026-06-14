import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

self.onmessage = async (event) => {
    const { type, data } = event.data;

    if (type === 'REMOVE_BACKGROUND') {
        try {
            self.postMessage({ status: 'loading', message: 'Loading RMBG-1.4 Model...' });
            const segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4');
            
            self.postMessage({ status: 'processing', message: 'Segmenting image...' });
            const output = await segmenter(data.imageSrc);
            
            self.postMessage({ 
                status: 'complete', 
                maskData: output[0].mask.data,
                width: output[0].mask.width,
                height: output[0].mask.height,
                channels: output[0].mask.channels
            });
        } catch (error) {
            self.postMessage({ status: 'error', message: error.message });
        }
    }
};