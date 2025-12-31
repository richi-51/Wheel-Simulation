// Simulation State
const state = {
    radius: 56, // cm
    targetRevolutions: 10,
    currentRevolutions: 0,
    speedMultiplier: 1, // 0.5, 1, 2
    isPlaying: false,
    mode: 'free', // 'free', 'demo', 'step', 'quiz'
    stepIndex: 0,
    lastTime: 0,
    pixelScale: 2, // pixels per cm
    piMode: '3.14', // '3.14' or '22_7'
    markerInterval: 100 // cm
};

// DOM Elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.visualization-section');

const els = {
    radiusInput: document.getElementById('radiusInput'),
    revInput: document.getElementById('revInput'),
    piInputs: document.querySelectorAll('input[name="piMode"]'),
    btnPlayPause: document.getElementById('btnPlayPause'),
    btnReset: document.getElementById('btnReset'),
    btnOneRev: document.getElementById('btnOneRev'),
    btnDemo: document.getElementById('btnDemo'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    speedBtns: document.querySelectorAll('.speed-btn'),
    circDisplay: document.getElementById('circumferenceDisplay'),
    distDisplay: document.getElementById('distanceDisplay'),
    curRevDisplay: document.getElementById('currentRevDisplay'),
    explanation: document.getElementById('explanation'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    btnNextStep: document.getElementById('btnNextStep'),
    stepInfo: document.getElementById('stepInfo'),
    btnStartQuiz: document.getElementById('btnStartQuiz'),
    quizControls: document.getElementById('quizControls'),
    quizQuestion: document.getElementById('quizQuestion'),
    quizAnswer: document.getElementById('quizAnswer'),
    btnSubmitQuiz: document.getElementById('btnSubmitQuiz'),
    quizResult: document.getElementById('quizResult')
};

// --- Math Functions ---

function getPiValue() {
    return state.piMode === '22_7' ? (22 / 7) : 3.14;
}

function calculateCircumference(radius) {
    return 2 * getPiValue() * radius;
}

function calculateDistance(radius, revolutions) {
    return calculateCircumference(radius) * revolutions;
}

function formatNumber(num, decimals = 2) {
    return num.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// --- Drawing Functions ---

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function updatePixelScale() {
    // Dynamically adjust scale to fit the wheel in the canvas
    const availableHeight = canvas.height - 70; // 50 for ground offset + 20 top margin
    const availableWidth = canvas.width - 40; // Margin sides

    // We need to fit the full diameter (2*r) plus some margin
    // CONSTRAINT: Fit in height AND fit in width (important for mobile)
    const scaleByHeight = availableHeight / (state.radius * 2.2);
    const scaleByWidth = availableWidth / (state.radius * 2.2);

    // Use the smaller of the two scales to ensure it fits completely
    const idealScale = Math.min(scaleByHeight, scaleByWidth);

    // We want a good visual size. 
    // If radius is huge, scale is small. If radius is tiny, scale is big.
    // Clamp scale reasonable limits for very tiny or very huge numbers to avoid rendering issues
    state.pixelScale = Math.max(0.001, Math.min(100, idealScale));

    // Calculate Marker Interval based on scale
    // Reverted to cleaner previous logic (less cluttered)
    const targetPxInterval = 180;
    const approximateCmInterval = targetPxInterval / state.pixelScale;

    // Find closest nice round number (1, 2, 10...)
    const magnitude = Math.pow(10, Math.floor(Math.log10(approximateCmInterval)));
    const leadingDigit = approximateCmInterval / magnitude;

    let roundInterval;
    // Thresholds favoring 1s and 2s, avoiding 5s
    if (leadingDigit < 1.6) roundInterval = 1 * magnitude;
    else if (leadingDigit < 4.5) roundInterval = 2 * magnitude;
    else roundInterval = 10 * magnitude;

    state.markerInterval = Math.max(1, roundInterval); // Minimum 1cm
}

// Hover Tooltip
const tooltip = document.createElement('div');
tooltip.className = 'canvas-tooltip';
document.body.appendChild(tooltip);

function updateTooltip(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    // mouseY not used for calculation but useful if we want to limit vertical area

    const startX = 50;

    const totalDistCm = calculateDistance(state.radius, state.targetRevolutions);
    const currentDistCm = calculateDistance(state.radius, state.currentRevolutions);
    const pixelDist = currentDistCm * state.pixelScale;
    let offsetX = 0;
    if (startX + pixelDist > canvas.width * 0.6) {
        offsetX = (startX + pixelDist) - (canvas.width * 0.6);
    }

    const worldX = mouseX + offsetX - startX;
    const cm = worldX / state.pixelScale;

    // Only show if positive and roughly within reasonable bounds
    if (cm >= -5) { // Allow slightly before 0 for ease
        tooltip.style.display = 'block';
        tooltip.style.left = `${clientX + 15}px`;
        tooltip.style.top = `${clientY + 15}px`;
        tooltip.textContent = `${formatNumber(Math.max(0, cm), 1)} cm`;
    } else {
        tooltip.style.display = 'none';
    }
}

// Mouse Events
canvas.addEventListener('mousemove', (e) => {
    updateTooltip(e.clientX, e.clientY);
});

canvas.addEventListener('mouseout', () => {
    tooltip.style.display = 'none';
});

// Touch Events (for mobile transparency)
canvas.addEventListener('touchstart', (e) => {
    // Prevent default to avoid scrolling while dragging on canvas
    // e.preventDefault(); // Optional: decide if we want to block scrolling. 
    // Usually better to let user scroll if they swipe vertically, but track pointer.

    const touch = e.touches[0];
    updateTooltip(touch.clientX, touch.clientY);
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    updateTooltip(touch.clientX, touch.clientY);
}, { passive: true });

canvas.addEventListener('touchend', () => {
    // Optional: Hide after delay or immediately
    setTimeout(() => {
        tooltip.style.display = 'none';
    }, 1000);
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height - 50; // Ground level
    const startX = 50; // Starting X position

    // Draw Ground/Scale
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Scale Markers
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    const totalDistCm = calculateDistance(state.radius, state.targetRevolutions);

    // Calculate current distance in pixels
    const currentDistCm = calculateDistance(state.radius, state.currentRevolutions);
    const pixelDist = currentDistCm * state.pixelScale;

    let offsetX = 0;
    // Camera logic: if wheel passes 60% of screen, start panning
    if (startX + pixelDist > canvas.width * 0.6) {
        offsetX = (startX + pixelDist) - (canvas.width * 0.6);
    }

    // Draw Ground Markers with offset
    ctx.save();
    ctx.translate(-offsetX, 0);

    // Optimization: determine visible range
    const visibleStartCm = (offsetX - 100) / state.pixelScale;
    const visibleEndCm = (offsetX + canvas.width + 100) / state.pixelScale;

    // Align start to interval
    const startI = Math.floor(Math.max(0, visibleStartCm) / state.markerInterval) * state.markerInterval;
    const endI = Math.min(totalDistCm + state.markerInterval * 5, visibleEndCm);

    for (let i = startI; i <= endI; i += state.markerInterval) {
        const x = startX + (i * state.pixelScale);

        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, centerY + 10);
        ctx.stroke();

        // Dynamic Labeling
        let label;
        // Prioritize Meter labels if interval is large enough or exactly at meter marks
        if (i >= 100 && i % 100 === 0) {
            label = `${i / 100}m`;
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = '#333';
        } else {
            label = `${i}cm`;
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#666';
        }

        ctx.fillText(label, x - 5, centerY + 25);
    }

    // Draw Trail
    // The trail is the line on the ground covered so far
    ctx.beginPath();
    ctx.moveTo(startX, centerY);
    ctx.lineTo(startX + pixelDist, centerY);
    ctx.strokeStyle = '#4cc9f0'; // Secondary color
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw previous revolution markers
    for (let r = 1; r <= Math.floor(state.currentRevolutions); r++) {
        const revDist = calculateDistance(state.radius, r);
        const rx = startX + (revDist * state.pixelScale);
        ctx.beginPath();
        ctx.moveTo(rx, centerY - 10);
        ctx.lineTo(rx, centerY + 10);
        ctx.strokeStyle = '#f8961e'; // Accent
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw Wheel
    const wheelX = startX + pixelDist;
    const wheelY = centerY - (state.radius * state.pixelScale);
    const wheelPixelRadius = state.radius * state.pixelScale;

    ctx.translate(wheelX, wheelY);

    // Rotate context for wheel rotation
    // Angle = Distance / Radius (in radians)
    const rotationAngle = (currentDistCm / state.radius); // Radians
    ctx.rotate(rotationAngle);

    // Rim
    ctx.beginPath();
    ctx.arc(0, 0, wheelPixelRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#3a86ff'; // Primary
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(58, 134, 255, 0.1)';
    ctx.fill();
    ctx.stroke();

    // Spokes (simple cross)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, wheelPixelRadius);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -wheelPixelRadius);
    ctx.moveTo(0, 0);
    ctx.lineTo(wheelPixelRadius, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(-wheelPixelRadius, 0);
    ctx.strokeStyle = '#3a86ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Valve (Visual Reference) - Start at bottom (angle 0 in normal math, but canvas Y is down)
    // We want the valve to touch the ground at start.
    // At rotation 0, valve should be at (0, radius).
    // Canvas rotation is clockwise.
    ctx.beginPath();
    ctx.arc(0, wheelPixelRadius, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8961e'; // Orange valve
    ctx.fill();

    ctx.restore();
}

// --- Animation Loop ---

function animate(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = timestamp - state.lastTime;
    state.lastTime = timestamp;

    if (state.isPlaying) {
        // Calculate angular velocity? Or linear velocity?
        // Let's say default speed is 20 cm/s
        // Adjusted by speed multiplier
        const baseSpeed = 30; // cm per second
        const speed = baseSpeed * state.speedMultiplier;

        // dDistance = speed * dt (in seconds)
        const dDistance = speed * (dt / 1000);

        // dRev = dDistance / Circumference
        const circumference = calculateCircumference(state.radius);
        const dRev = dDistance / circumference;

        state.currentRevolutions += dRev;

        // Check if target reached
        if (state.currentRevolutions >= state.targetRevolutions) {
            state.currentRevolutions = state.targetRevolutions;
            state.isPlaying = false;
            updateUI(); // Final update
            els.btnPlayPause.textContent = "Start";

            if (state.mode === 'quiz' && state.quizCallback) {
                state.quizCallback();
            }
        }
    }

    draw();
    updateUI();

    if (state.isPlaying || state.currentRevolutions > 0) {
        state.animationId = requestAnimationFrame(animate);
    }
}

// --- Interactions & Logic ---

function updateUI() {
    // Info Panel
    const circ = calculateCircumference(state.radius);
    const dist = calculateDistance(state.radius, state.currentRevolutions);

    els.circDisplay.textContent = `${formatNumber(circ)} cm (${formatNumber(circ / 100)} m)`;
    els.distDisplay.textContent = `${formatNumber(dist)} cm (${formatNumber(dist / 100)} m)`;
    els.curRevDisplay.textContent = formatNumber(state.currentRevolutions);

    // Real-time explanation logic
    if (state.currentRevolutions > 0) {
        const fullRevs = Math.floor(state.currentRevolutions);
        if (fullRevs === 0) {
            els.explanation.innerHTML = `The wheel starts moving. <br>The wheel's circumference is <strong>${formatNumber(circ)} cm</strong>.`;
        } else {
            els.explanation.innerHTML = `The wheel has rotated <strong>${fullRevs}</strong> full times.<br>
             Distance = ${fullRevs} × ${formatNumber(circ)} = <strong>${formatNumber(fullRevs * circ)} cm</strong>.`;
        }
    } else {
        els.explanation.textContent = "Change parameters or start the animation to see the explanation.";
    }
}

function startAnimation() {
    if (state.currentRevolutions >= state.targetRevolutions) {
        state.currentRevolutions = 0;
    }
    state.isPlaying = true;
    state.lastTime = 0;
    state.isPlaying = true;
    state.lastTime = 0;
    els.btnPlayPause.textContent = "Pause";
    requestAnimationFrame(animate);
}

function pauseAnimation() {
    state.isPlaying = false;
    els.btnPlayPause.textContent = "Start";
}

function resetSimulation() {
    state.isPlaying = false;
    state.currentRevolutions = 0;
    state.lastTime = 0;
    els.btnPlayPause.textContent = "Start";
    updateUI();
    draw();
}

// Event Listeners
els.radiusInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
        state.radius = val;
        updatePixelScale();
        resetSimulation();
    }
});

els.revInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
        state.targetRevolutions = val;
        updateUI();
        draw();
    }
});

els.piInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
        state.piMode = e.target.value;
        updateUI();
    });
});

els.btnPlayPause.addEventListener('click', () => {
    if (state.isPlaying) pauseAnimation();
    else startAnimation();
});

els.btnReset.addEventListener('click', resetSimulation);

els.btnOneRev.addEventListener('click', () => {
    state.targetRevolutions = 1;
    els.revInput.value = 1;
    resetSimulation();
    startAnimation();
});

els.speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        els.speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.speedMultiplier = parseFloat(btn.dataset.speed);
    });
});

els.btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            alert(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

// Handle fullscreen exit/change to ensure layout resets correctly
document.addEventListener('fullscreenchange', () => {
    // Small delay to allow layout to settle
    setTimeout(() => {
        resizeCanvas();
        updatePixelScale();
        draw();
    }, 100);
});

// Demo Mode
els.btnDemo.addEventListener('click', () => {
    state.radius = 56;
    state.targetRevolutions = 10;
    state.speedMultiplier = 1;
    state.mode = 'demo';
    state.piMode = '3.14'; // Demo uses 3.14 explicitly

    // Update inputs
    els.radiusInput.value = 56;
    els.revInput.value = 10;
    document.querySelector('input[name="piMode"][value="3.14"]').checked = true;

    // Update speed UI
    els.speedBtns.forEach(b => b.classList.remove('active'));
    els.speedBtns[1].classList.add('active'); // Normal speed

    updatePixelScale();
    resetSimulation();

    const piVal = getPiValue();
    const circ = 2 * piVal * 56;

    // Show specific text
    els.explanation.innerHTML = `
    <strong>Problem Demonstration:</strong><br>
    Given: r = 56 cm, Target = 10 Revolutions.<br>
    Circumference = 2 × ${state.piMode === '22_7' ? '22/7' : '3.14'} × 56 = ${formatNumber(circ)} cm.<br>
    Animation starting...
    `;

    setTimeout(() => startAnimation(), 1000);
});

// --- Tabs & Advanced Modes ---
els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        els.tabs.forEach(t => t.classList.remove('active'));
        els.tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        state.mode = tab.dataset.tab === 'stepMode' ? 'step' : 'quiz';
    });
});

// Step Mode
// Step Mode
const stepScenario = [
    { text: "Step 1: Identify Radius. This wheel has a radius of 56 cm.", action: () => { state.radius = 56; els.radiusInput.value = 56; resetSimulation(); } },
    { text: "Step 2: Calculate Circumference. C = 2 × π × r = 2 × 3.14 × 56 = 351.68 cm.", action: () => { /* highlight info */ } },
    { text: "Step 3: Rotate 1 Time. Notice the wheel travels a distance equal to its circumference.", action: () => { state.targetRevolutions = 1; els.revInput.value = 1; startAnimation(); } },
    { text: "Step 4: Rotate Remainder (Total 10). Distance continues to accumulate.", action: () => { state.targetRevolutions = 10; els.revInput.value = 10; startAnimation(); } },
    { text: "Done. Total Distance = 3516.8 cm or 35.168 meters.", action: () => { } }
];

els.btnNextStep.addEventListener('click', () => {
    if (state.stepIndex < stepScenario.length) {
        const step = stepScenario[state.stepIndex];
        els.stepInfo.textContent = step.text;
        step.action();
        state.stepIndex++;
    } else {
        state.stepIndex = 0;
        els.stepInfo.textContent = "Start Over?";
    }
});

// Quiz Mode
let currentQuizAnswer = 0;

els.btnStartQuiz.addEventListener('click', () => {
    const r = Math.floor(Math.random() * 50) + 20; // 20-70 cm
    const rev = Math.floor(Math.random() * 5) + 3; // 3-8 revs

    state.radius = r;
    state.targetRevolutions = rev;
    els.radiusInput.value = r;
    els.revInput.value = rev;
    resetSimulation();

    const piVal = getPiValue();
    const circ = 2 * piVal * r;
    currentQuizAnswer = circ * rev;

    els.quizQuestion.innerHTML = `If radius = <strong>${r} cm</strong> and the wheel rotates <strong>${rev} times</strong>,<br>what is the distance traveled (cm)? (Round to nearest integer)`;
    els.quizControls.style.display = 'block';
    els.btnStartQuiz.style.display = 'none';
    els.quizResult.textContent = "";
});

els.btnSubmitQuiz.addEventListener('click', () => {
    const userAnswer = parseFloat(els.quizAnswer.value);
    const correct = Math.round(currentQuizAnswer);

    if (Math.abs(userAnswer - correct) <= 5) { // Tolerance
        els.quizResult.innerHTML = "<span style='color:green'>Correct! Let's verify with the simulation.</span>";
        startAnimation();
        state.quizCallback = () => {
            els.quizControls.style.display = 'none';
            els.btnStartQuiz.style.display = 'inline-block';
            els.btnStartQuiz.textContent = "New Question";
        };
    } else {
        els.quizResult.innerHTML = `<span style='color:red'>Not quite. The answer is around ${correct}. Try again!</span>`;
    }
});

// Init
window.addEventListener('resize', () => {
    resizeCanvas();
    updatePixelScale();
    draw();
});

resizeCanvas();
updatePixelScale();
updateUI();
draw();
