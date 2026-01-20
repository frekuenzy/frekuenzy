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

    // Advanced Toggle- Robust for Safari
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedControls = document.getElementById('advancedControls');
    if (advancedToggle && advancedControls) {
        const toggleHandler = (e) => {
            // e.preventDefault(); // Remove to allow standard behavior if needed
            advancedControls.classList.toggle('hidden');
            advancedToggle.classList.toggle('active');
            console.log('Toggle clicked');
        };
        advancedToggle.addEventListener('click', toggleHandler);
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
