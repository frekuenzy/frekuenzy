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
const frequencyInput = document.getElementById('frequencyInput');
const frequencyValue = document.getElementById('frequencyValue');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const statusText = status.querySelector('.status-text');
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
    initializeAudioContext();
    setupEventListeners();
    updateFrequencyDisplay();
    checkCookieConsent();

    // Initialize state from UI
    currentVolume = parseFloat(volumeSlider.value);
    isBinaural = binauralToggle.checked;
    if (isBinaural) binauralInputGroup.classList.remove('hidden');
});

// ===================================
// COOKIE CONSENT LOGIC
// ===================================
function checkCookieConsent() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('acceptCookiesBtn');

    if (!localStorage.getItem('cookieConsent')) {
        banner.classList.remove('hidden');
    }

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'true');
        banner.classList.add('hidden');
    });
}

// ===================================
// AUDIO CONTEXT INITIALIZATION
// ===================================
function initializeAudioContext() {
    // Create AudioContext only when needed (after user interaction)
}

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
    // Frequency input change
    frequencyInput.addEventListener('input', (e) => {
        updateFrequencyDisplay();
        presetButtons.forEach(btn => btn.classList.remove('active'));
        if (isPlaying) updateOscillators();
    });

    // Play button
    playBtn.addEventListener('click', startFrequency);

    // Stop button
    stopBtn.addEventListener('click', stopFrequency);

    // Preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const freq = btn.getAttribute('data-freq');
            frequencyInput.value = freq;
            updateFrequencyDisplay();
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
    volumeSlider.addEventListener('input', (e) => {
        currentVolume = parseFloat(e.target.value);
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(audioContext.currentTime);
            masterGain.gain.linearRampToValueAtTime(currentVolume, audioContext.currentTime + 0.1);
        }
    });

    // Binaural Toggle
    binauralToggle.addEventListener('change', (e) => {
        isBinaural = e.target.checked;
        if (isBinaural) {
            binauralInputGroup.classList.remove('hidden');
        } else {
            binauralInputGroup.classList.add('hidden');
        }
        if (isPlaying) {
            // Restart required to reconfigure nodes roughly or we can update live
            // Updating live is better but complex. Let's restart for simplicity and stablity
            startFrequency();
        }
    });

    // Binaural Input
    if (binauralInput) {
        binauralInput.addEventListener('input', (e) => {
            binauralBeatFreq = parseFloat(e.target.value) || 4.0;
            if (isPlaying && isBinaural) updateOscillators();
        });
    }

    // Advanced Toggle
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedControls = document.getElementById('advancedControls');
    if (advancedToggle && advancedControls) {
        advancedToggle.addEventListener('click', () => {
            advancedControls.classList.toggle('hidden');
            advancedToggle.classList.toggle('active');
        });
    }
}

// ===================================
// OSCILLATOR CONTROL
// ===================================
function updateOscillators() {
    if (!audioContext) return;

    const baseFreq = parseFloat(frequencyInput.value);
    const now = audioContext.currentTime;

    if (oscillatorLeft) {
        oscillatorLeft.frequency.linearRampToValueAtTime(baseFreq, now + 0.1);
        oscillatorLeft.type = currentWaveform;
    }

    if (oscillatorRight && isBinaural) {
        oscillatorRight.frequency.linearRampToValueAtTime(baseFreq + binauralBeatFreq, now + 0.1);
        oscillatorRight.type = currentWaveform;
    } else if (oscillatorRight && !isBinaural) {
        // If we switched off binaural while playing, match frequencies or mute right
        // For simplicity, we just match freq to mono experience
        oscillatorRight.frequency.linearRampToValueAtTime(baseFreq, now + 0.1);
    }
}

function startFrequency() {
    const frequency = parseFloat(frequencyInput.value);

    // Timer Logic
    const timerMinutes = parseInt(timerSelect.value);
    if (timerMinutes > 0) {
        if (timerInterval) clearTimeout(timerInterval);
        timerInterval = setTimeout(() => {
            stopFrequency();
        }, timerMinutes * 60 * 1000);
    }


    if (isPlaying) stopFrequency();

    try {
        createAudioContext();
        if (audioContext.state === 'suspended') audioContext.resume();

        // Master Gain
        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(currentVolume, audioContext.currentTime);
        masterGain.connect(audioContext.destination);

        // Implementation:
        // We use a ChannelMerger to create a stereo signal.
        // Left Oscillator -> Channel 1
        // Right Oscillator -> Channel 2
        // Both -> Merger -> MasterGain -> Destination

        const merger = audioContext.createChannelMerger(2);

        // Left Ear
        oscillatorLeft = audioContext.createOscillator();
        oscillatorLeft.type = currentWaveform;
        oscillatorLeft.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillatorLeft.connect(merger, 0, 0); // Connect to left input of merger

        // Right Ear
        oscillatorRight = audioContext.createOscillator();
        oscillatorRight.type = currentWaveform;
        if (isBinaural) {
            // Right ear gets Base + Beat Frequency
            oscillatorRight.frequency.setValueAtTime(frequency + binauralBeatFreq, audioContext.currentTime);
        } else {
            // Mono experience: Equal frequency
            oscillatorRight.frequency.setValueAtTime(frequency, audioContext.currentTime);
        }
        oscillatorRight.connect(merger, 0, 1); // Connect to right input of merger

        // Connect Merger to Master
        merger.connect(masterGain);

        // Start
        oscillatorLeft.start();
        oscillatorRight.start();

        isPlaying = true;
        updateUIState(true);

    } catch (error) {
        console.error('Error:', error);
        alert('Audio error. Please try again.');
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
        masterGain.disconnect();
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
    const freq = parseFloat(frequencyInput.value) || 7.83;
    frequencyValue.textContent = freq.toFixed(2);
}

function updateUIState(playing) {
    if (playing) {
        status.classList.add('playing');
        let text = `Playing: ${parseFloat(frequencyInput.value).toFixed(2)} Hz`;
        if (isBinaural) text += ` + ${binauralBeatFreq} Hz Beat`;
        statusText.textContent = text;

        playBtn.disabled = true;
        stopBtn.disabled = false;
        waveContainer.classList.add('active');
    } else {
        status.classList.remove('playing');
        statusText.textContent = 'Ready';

        playBtn.disabled = false;
        stopBtn.disabled = true;
        waveContainer.classList.remove('active');
    }
}

// ===================================
// CLEANUP
// ===================================
window.addEventListener('beforeunload', () => {
    stopFrequency();
    if (audioContext) audioContext.close();
});

// Key shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        isPlaying ? stopFrequency() : startFrequency();
    }
});
