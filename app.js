// ===================================
// GLOBAL VARIABLES
// ===================================
let audioContext = null;
let masterGain = null;
let oscillatorLeft = null;
let oscillatorRight = null;
let mergerNode = null;
let isPlaying = false;
let timerInterval = null;

// ===================================
// DOM ELEMENTS
// ===================================
// ===================================
// DOM ELEMENTS
// ===================================
const frequencyInput = document.getElementById('frequencyInput');
const frequencyValue = document.getElementById('frequencyValue');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const statusNode = document.getElementById('status');
const statusText = statusNode ? statusNode.querySelector('.status-text') : null;
const waveContainer = document.getElementById('waveContainer');
const presetButtons = document.querySelectorAll('.preset-btn');
const waveformButtons = document.querySelectorAll('.wave-btn');
const volumeSlider = document.getElementById('volumeSlider');
const binauralToggle = document.getElementById('binauralToggle');
const binauralInputGroup = document.getElementById('binauralInputGroup');
const binauralInput = document.getElementById('binauralInput');
const timerSelect = document.getElementById('timerSelect');

// ===================================
// STATE
// ===================================
let currentWaveform = 'sine';
let isBinaural = false;
let binauralBeatFreq = 4.0;
let currentVolume = 0.3;

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        setupEventListeners();
        if (frequencyInput) updateFrequencyDisplay();
        checkCookieConsent();

        // Initialize state from UI
        if (volumeSlider) currentVolume = parseFloat(volumeSlider.value);
        if (binauralToggle) {
            isBinaural = binauralToggle.checked;
            if (isBinaural && binauralInputGroup) binauralInputGroup.classList.remove('hidden');
        }
    } catch (e) {
        console.warn('Initialization notice:', e.message);
    }
});

// ===================================
// COOKIE CONSENT LOGIC
// ===================================
function checkCookieConsent() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('acceptCookiesBtn');

    if (banner && acceptBtn) {
        if (!localStorage.getItem('cookieConsent')) {
            banner.classList.remove('hidden');
        }

        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'true');
            banner.classList.add('hidden');
        });
    }
}

// ===================================
// AUDIO CONTEXT
// ===================================
function createAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext created');
    }
    return audioContext;
}

// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
    // Frequency input
    if (frequencyInput) {
        frequencyInput.addEventListener('input', () => {
            updateFrequencyDisplay();
            presetButtons.forEach(btn => btn.classList.remove('active'));
            if (isPlaying) updateOscillators();
        });
    }

    // Play button
    if (playBtn) playBtn.addEventListener('click', startFrequency);

    // Stop button
    if (stopBtn) stopBtn.addEventListener('click', stopFrequency);

    // Preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const freq = btn.getAttribute('data-freq');
            if (frequencyInput) {
                frequencyInput.value = freq;
                updateFrequencyDisplay();
            }
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (isPlaying) updateOscillators();
        });
    });

    // Waveform buttons
    waveformButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentWaveform = btn.getAttribute('data-wave');
            waveformButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (isPlaying) updateOscillators();
        });
    });

    // Volume Slider
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            currentVolume = parseFloat(e.target.value);
            if (masterGain && audioContext) {
                masterGain.gain.cancelScheduledValues(audioContext.currentTime);
                masterGain.gain.linearRampToValueAtTime(currentVolume, audioContext.currentTime + 0.1);
            }
        });
    }

    // Binaural Toggle
    if (binauralToggle) {
        binauralToggle.addEventListener('change', (e) => {
            isBinaural = e.target.checked;
            if (binauralInputGroup) {
                isBinaural ? binauralInputGroup.classList.remove('hidden') : binauralInputGroup.classList.add('hidden');
            }
            if (isPlaying) startFrequency();
        });
    }

    // Binaural Input
    if (binauralInput) {
        binauralInput.addEventListener('input', (e) => {
            binauralBeatFreq = parseFloat(e.target.value) || 4.0;
            if (isPlaying && isBinaural) updateOscillators();
        });
    }

    // Advanced Toggle- Robust for all browsers
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedControls = document.getElementById('advancedControls');
    if (advancedToggle && advancedControls) {
        advancedToggle.addEventListener('click', () => {
            advancedControls.classList.toggle('hidden');
            advancedToggle.classList.toggle('active');
            console.log('Toggle clicked');
        });
    }
}

// ===================================
// OSCILLATOR CONTROL
// ===================================
function updateOscillators() {
    if (!audioContext || !frequencyInput) return;

    const baseFreq = parseFloat(frequencyInput.value);
    const now = audioContext.currentTime;

    if (oscillatorLeft) {
        oscillatorLeft.frequency.linearRampToValueAtTime(baseFreq, now + 0.1);
        oscillatorLeft.type = currentWaveform;
    }

    if (oscillatorRight) {
        const targetFreq = isBinaural ? baseFreq + binauralBeatFreq : baseFreq;
        oscillatorRight.frequency.linearRampToValueAtTime(targetFreq, now + 0.1);
        oscillatorRight.type = currentWaveform;
    }
}

function startFrequency() {
    if (!frequencyInput) return;
    const frequency = parseFloat(frequencyInput.value);

    // Timer Logic
    if (timerSelect) {
        const timerMinutes = parseInt(timerSelect.value);
        if (timerInterval) clearTimeout(timerInterval);
        if (timerMinutes > 0) {
            timerInterval = setTimeout(() => {
                stopFrequency();
            }, timerMinutes * 60 * 1000);
        }
    }

    if (isPlaying) stopFrequency();

    try {
        createAudioContext();
        if (audioContext.state === 'suspended') audioContext.resume();

        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(currentVolume, audioContext.currentTime);
        masterGain.connect(audioContext.destination);

        const merger = audioContext.createChannelMerger(2);

        oscillatorLeft = audioContext.createOscillator();
        oscillatorLeft.type = currentWaveform;
        oscillatorLeft.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillatorLeft.connect(merger, 0, 0);

        oscillatorRight = audioContext.createOscillator();
        oscillatorRight.type = currentWaveform;
        const rightFreq = isBinaural ? frequency + binauralBeatFreq : frequency;
        oscillatorRight.frequency.setValueAtTime(rightFreq, audioContext.currentTime);
        oscillatorRight.connect(merger, 0, 1);

        merger.connect(masterGain);

        oscillatorLeft.start();
        oscillatorRight.start();

        isPlaying = true;
        updateUIState(true);

    } catch (error) {
        console.error('Audio Error:', error);
    }
}

function stopFrequency() {
    if (oscillatorLeft) {
        try { oscillatorLeft.stop(); oscillatorLeft.disconnect(); } catch (e) { }
        oscillatorLeft = null;
    }
    if (oscillatorRight) {
        try { oscillatorRight.stop(); oscillatorRight.disconnect(); } catch (e) { }
        oscillatorRight = null;
    }
    if (masterGain) {
        try { masterGain.disconnect(); } catch (e) { }
        masterGain = null;
    }

    if (timerInterval) {
        clearTimeout(timerInterval);
        timerInterval = null;
    }

    isPlaying = false;
    updateUIState(false);
}

// ===================================
// UI UPDATES
// ===================================
function updateFrequencyDisplay() {
    if (!frequencyInput || !frequencyValue) return;
    const freq = parseFloat(frequencyInput.value) || 7.83;
    frequencyValue.textContent = freq.toFixed(2);
}

function updateUIState(playing) {
    if (playing) {
        if (statusNode) statusNode.classList.add('playing');
        if (statusText && frequencyInput) {
            let text = `Playing: ${parseFloat(frequencyInput.value).toFixed(2)} Hz`;
            if (isBinaural) text += ` + ${binauralBeatFreq} Hz Beat`;
            statusText.textContent = text;
        }

        if (playBtn) playBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (waveContainer) waveContainer.classList.add('active');
    } else {
        if (statusNode) statusNode.classList.remove('playing');
        if (statusText) statusText.textContent = 'Ready';

        if (playBtn) playBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (waveContainer) waveContainer.classList.remove('active');
    }
}

// ===================================
// CLEANUP & SHORTCUTS
// ===================================
window.addEventListener('beforeunload', () => {
    stopFrequency();
    if (audioContext) audioContext.close();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        isPlaying ? stopFrequency() : startFrequency();
    }
});

// ===================================
// DOWNLOAD FUNCTIONALITY
// ===================================
const downloadBtn = document.getElementById('downloadBtn');
const downloadModal = document.getElementById('downloadModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const generateBtn = document.getElementById('generateBtn');
const downloadDuration = document.getElementById('downloadDuration');
const durationValue = document.getElementById('durationValue');
const formatBtns = document.querySelectorAll('.format-btn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const previewFreq = document.getElementById('previewFreq');
const previewWave = document.getElementById('previewWave');
const previewMode = document.getElementById('previewMode');

let selectedFormat = 'wav';

// Modal Open/Close
if (downloadBtn) {
    downloadBtn.addEventListener('click', openDownloadModal);
}

if (modalClose) {
    modalClose.addEventListener('click', closeDownloadModal);
}

if (modalOverlay) {
    modalOverlay.addEventListener('click', closeDownloadModal);
}

function openDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.remove('hidden');
        updateModalPreview();
    }
}

function closeDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.add('hidden');
        resetProgress();
    }
}

function updateModalPreview() {
    if (previewFreq && frequencyInput) {
        previewFreq.textContent = parseFloat(frequencyInput.value).toFixed(2) + ' Hz';
    }
    if (previewWave) {
        previewWave.textContent = currentWaveform.charAt(0).toUpperCase() + currentWaveform.slice(1);
    }
    if (previewMode) {
        previewMode.textContent = isBinaural ? `Binaural +${binauralBeatFreq}Hz` : 'Mono';
    }
}

// Duration Slider
if (downloadDuration) {
    downloadDuration.addEventListener('input', (e) => {
        if (durationValue) {
            durationValue.textContent = e.target.value + ' min';
        }
    });
}

// Format Selection
formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFormat = btn.getAttribute('data-format');
    });
});

// Generate Button
if (generateBtn) {
    generateBtn.addEventListener('click', generateAndDownload);
}

async function generateAndDownload() {
    const frequency = parseFloat(frequencyInput?.value || 7.83);
    const durationMinutes = parseInt(downloadDuration?.value || 5);
    const durationSeconds = durationMinutes * 60;
    const sampleRate = 44100;
    const numSamples = sampleRate * durationSeconds;

    // Show progress
    if (progressSection) progressSection.classList.remove('hidden');
    if (generateBtn) generateBtn.disabled = true;
    updateProgress(0, 'Initializing audio context...');

    try {
        // Create offline audio context
        const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);

        // Create gain node
        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(0.5, 0);
        gainNode.connect(offlineCtx.destination);

        // Create merger for stereo
        const merger = offlineCtx.createChannelMerger(2);
        merger.connect(gainNode);

        // Left oscillator
        const oscLeft = offlineCtx.createOscillator();
        oscLeft.type = currentWaveform;
        oscLeft.frequency.setValueAtTime(frequency, 0);
        oscLeft.connect(merger, 0, 0);

        // Right oscillator
        const oscRight = offlineCtx.createOscillator();
        oscRight.type = currentWaveform;
        const rightFreq = isBinaural ? frequency + binauralBeatFreq : frequency;
        oscRight.frequency.setValueAtTime(rightFreq, 0);
        oscRight.connect(merger, 0, 1);

        oscLeft.start(0);
        oscRight.start(0);
        oscLeft.stop(durationSeconds);
        oscRight.stop(durationSeconds);

        updateProgress(10, 'Rendering audio...');

        // Render the audio
        const renderedBuffer = await offlineCtx.startRendering();

        updateProgress(50, 'Encoding audio...');

        let blob;
        let filename;

        if (selectedFormat === 'wav') {
            blob = encodeWAV(renderedBuffer);
            filename = `frekuenzy_${frequency}Hz_${durationMinutes}min.wav`;
            updateProgress(90, 'Preparing download...');
        } else {
            // MP3 encoding
            updateProgress(60, 'Encoding MP3...');
            blob = await encodeMP3(renderedBuffer);
            filename = `frekuenzy_${frequency}Hz_${durationMinutes}min.mp3`;
        }

        updateProgress(100, 'Download starting...');

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
            updateProgress(100, '✓ Download complete!');
            setTimeout(() => {
                resetProgress();
                if (generateBtn) generateBtn.disabled = false;
            }, 2000);
        }, 500);

    } catch (error) {
        console.error('Download error:', error);
        updateProgress(0, 'Error: ' + error.message);
        if (generateBtn) generateBtn.disabled = false;
    }
}

function updateProgress(percent, text) {
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
}

function resetProgress() {
    if (progressSection) progressSection.classList.add('hidden');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Generating audio...';
}

// WAV Encoding
function encodeWAV(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const left = audioBuffer.getChannelData(0);
    const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
    const length = left.length;

    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, length * numChannels * 2, true);

    // Write interleaved samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
        view.setInt16(offset, clamp(left[i]) * 0x7FFF, true);
        offset += 2;
        view.setInt16(offset, clamp(right[i]) * 0x7FFF, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function clamp(value) {
    return Math.max(-1, Math.min(1, value));
}

// MP3 Encoding using lamejs
async function encodeMP3(audioBuffer) {
    return new Promise((resolve, reject) => {
        try {
            if (typeof lamejs === 'undefined') {
                throw new Error('MP3 encoder not loaded');
            }

            const sampleRate = audioBuffer.sampleRate;
            const numChannels = audioBuffer.numberOfChannels;
            const samples = audioBuffer.length;
            const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);

            const left = audioBuffer.getChannelData(0);
            const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

            // Convert to 16-bit integers
            const leftInt = new Int16Array(samples);
            const rightInt = new Int16Array(samples);

            for (let i = 0; i < samples; i++) {
                leftInt[i] = Math.max(-32768, Math.min(32767, left[i] * 32768));
                rightInt[i] = Math.max(-32768, Math.min(32767, right[i] * 32768));
            }

            const mp3Data = [];
            const blockSize = 1152;

            for (let i = 0; i < samples; i += blockSize) {
                const leftChunk = leftInt.subarray(i, i + blockSize);
                const rightChunk = rightInt.subarray(i, i + blockSize);
                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            const mp3End = mp3encoder.flush();
            if (mp3End.length > 0) {
                mp3Data.push(mp3End);
            }

            resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
        } catch (error) {
            reject(error);
        }
    });
}

