// ===================================
// GLOBAL VARIABLES
// ===================================
let audioContext = null;
let oscillator = null;
let gainNode = null;
let isPlaying = false;

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

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initializeAudioContext();
    setupEventListeners();
    updateFrequencyDisplay();
    checkCookieConsent();
});

// ===================================
// COOKIE CONSENT LOGIC
// ===================================
function checkCookieConsent() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('acceptCookiesBtn');

    // Check if user has already accepted
    if (!localStorage.getItem('cookieConsent')) {
        // Show banner
        banner.classList.remove('hidden');
    }

    // Handle click
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
    // This is required by modern browsers for autoplay policies
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
        // Remove active state from all presets when manually typing
        presetButtons.forEach(btn => btn.classList.remove('active'));
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

            // Update active state
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ===================================
// FREQUENCY DISPLAY UPDATE
// ===================================
function updateFrequencyDisplay() {
    const freq = parseFloat(frequencyInput.value) || 7.83;
    frequencyValue.textContent = freq.toFixed(2);
}

// ===================================
// START FREQUENCY
// ===================================
function startFrequency() {
    const frequency = parseFloat(frequencyInput.value);

    // Validate frequency
    if (isNaN(frequency) || frequency < 0.01 || frequency > 20000) {
        alert('Please enter a value between 0.01 Hz and 20000 Hz.');
        return;
    }

    // Stop any existing oscillator
    if (isPlaying) {
        stopFrequency();
    }

    try {
        // Create audio context if it doesn't exist
        createAudioContext();

        // Resume audio context if suspended (required by some browsers)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Create oscillator
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        // Configure oscillator
        oscillator.type = 'sine'; // Pure sine wave for cleaner tone
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        // Configure gain (volume)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // 30% volume

        // Connect nodes: oscillator -> gain -> destination (speakers)
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Start oscillator
        oscillator.start();

        // Update UI
        isPlaying = true;
        updateUIState(true);

        console.log(`Playing frequency: ${frequency} Hz`);

    } catch (error) {
        console.error('Error starting frequency:', error);
        alert('An error occurred while starting the audio system. Please check your browser.');
    }
}

// ===================================
// STOP FREQUENCY
// ===================================
function stopFrequency() {
    if (oscillator) {
        try {
            oscillator.stop();
            oscillator.disconnect();
            oscillator = null;
        } catch (error) {
            console.error('Error stopping oscillator:', error);
        }
    }

    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }

    // Update UI
    isPlaying = false;
    updateUIState(false);

    console.log('Frequency stopped');
}

// ===================================
// UPDATE UI STATE
// ===================================
function updateUIState(playing) {
    if (playing) {
        // Update status
        status.classList.add('playing');
        statusText.textContent = `Playing: ${parseFloat(frequencyInput.value).toFixed(2)} Hz`;

        // Update buttons
        playBtn.disabled = true;
        stopBtn.disabled = false;

        // Activate wave animation
        waveContainer.classList.add('active');

    } else {
        // Update status
        status.classList.remove('playing');
        statusText.textContent = 'Ready';

        // Update buttons
        playBtn.disabled = false;
        stopBtn.disabled = true;

        // Deactivate wave animation
        waveContainer.classList.remove('active');
    }
}

// ===================================
// CLEANUP ON PAGE UNLOAD
// ===================================
window.addEventListener('beforeunload', () => {
    if (oscillator) {
        stopFrequency();
    }
    if (audioContext) {
        audioContext.close();
    }
});

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Space bar to toggle play/pause
    if (e.code === 'Space' && e.target !== frequencyInput) {
        e.preventDefault();
        if (isPlaying) {
            stopFrequency();
        } else {
            startFrequency();
        }
    }

    // Escape to stop
    if (e.code === 'Escape' && isPlaying) {
        stopFrequency();
    }
});
