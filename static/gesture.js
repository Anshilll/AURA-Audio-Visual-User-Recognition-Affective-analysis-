document.addEventListener('DOMContentLoaded', async () => {
    // ── Elements ────────────────────────────────────────────────
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const statusLoader = document.getElementById('webcam-status-loader');
    const noFaceOverlay = document.getElementById('no-face-overlay');
    const scanFrame = document.getElementById('scan-frame');
    const camBtnLabel = document.getElementById('cam-btn-label');
    
    // Live Face Badge Elements
    const faceBadge = document.getElementById('live-face-badge');
    const lfEmoji = document.getElementById('lf-emoji');
    const lfLabel = document.getElementById('lf-label');
    const lfConfFill = document.getElementById('lf-conf-fill');
    const lfConfPct = document.getElementById('lf-conf-pct');

    // ── Global Scope State (shared with script.js) ──────────────
    // Assuming state.lockedIntervention is available on window or we use local tracking.
    // We will use local tracking for sustained emotion logic.
    
    let isCameraRunning = false;
    let stream = null;
    let detectionInterval = null;
    let fallbackTimer = null;

    if(typeof faceapi === 'undefined') {
        if(statusLoader) statusLoader.innerHTML = '<p style="color:var(--status-danger)">face-api.js not loaded.</p>';
        return;
    }

    // ── Emotion Mapping ─────────────────────────────────────────
    const EMOTION_MAPPING = {
        'happy': { label: 'Happiness', emoji: '😊', color: 'var(--status-success)' },
        'sad': { label: 'Sadness', emoji: '😢', color: '#3b82f6' },
        'angry': { label: 'Anger', emoji: '😠', color: 'var(--status-danger)' },
        'fearful': { label: 'Fear', emoji: '😨', color: 'var(--brand-primary)' },
        'disgusted': { label: 'Disgust', emoji: '🤢', color: 'var(--status-warning)' },
        'surprised': { label: 'Surprise', emoji: '😲', color: 'var(--accent-cyan)' },
        'neutral': { label: 'Neutral', emoji: '😐', color: 'var(--text-secondary)' }
    };

    const NEGATIVE_EMOTIONS = new Set(['angry', 'sad', 'fearful', 'disgusted', 'surprised']);
    
    let sustainedEmotion = null;
    let sustainedStartTime = 0;
    const SUSTAIN_THRESHOLD_MS = 3000;
    let interventionTriggered = false;

    // ── Load Models ─────────────────────────────────────────────
    async function loadModels() {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            statusLoader.classList.add('hidden');
        } catch (err) {
            console.error(err);
            statusLoader.innerHTML = '<p style="color:var(--status-danger)">Failed to load AI models.</p>';
        }
    }
    loadModels();

    // ── Handlers ────────────────────────────────────────────────
    if(toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', async () => {
            if(!isCameraRunning) await startCamera();
            else stopCamera();
        });
    }

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            
            toggleCameraBtn.innerHTML = '<i class="fa-solid fa-stop"></i> <span id="cam-btn-label">Stop Camera</span>';
            toggleCameraBtn.classList.add('recording-active');
            isCameraRunning = true;

            video.addEventListener('play', onVideoPlay);
            
            // UI setup
            if(scanFrame) scanFrame.parentElement.classList.add('is-scanning');

        } catch (err) {
            console.error("Webcam error:", err);
            alert("Could not start webcam. Please grant permissions.");
        }
    }

    function stopCamera() {
        isCameraRunning = false;
        if(stream) stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;
        clearInterval(detectionInterval);
        
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        video.removeEventListener('play', onVideoPlay);
        
        toggleCameraBtn.innerHTML = '<i class="fa-solid fa-video"></i> <span id="cam-btn-label">Start Camera</span>';
        toggleCameraBtn.classList.remove('recording-active');
        if(scanFrame) scanFrame.parentElement.classList.remove('is-scanning');
        
        faceBadge.classList.add('hidden');
        noFaceOverlay.classList.add('hidden');

        sustainedEmotion = null;
        sustainedStartTime = 0;
        interventionTriggered = false;
    }

    function onVideoPlay() {
        if(!canvas || !video) return;

        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize);

        let lastReportTime = 0;

        detectionInterval = setInterval(async () => {
            if(!isCameraRunning || video.paused || video.ended) return;

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                                            .withFaceExpressions();
            const ctx = canvas.getContext('2d');
            const cw = canvas.width, ch = canvas.height;
            ctx.clearRect(0, 0, cw, ch);

            if(detections.length === 0) {
                noFaceOverlay.classList.remove('hidden');
                faceBadge.classList.add('hidden');
                sustainedEmotion = null;
                return;
            }
            
            noFaceOverlay.classList.add('hidden');
            faceBadge.classList.remove('hidden');

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Setup glow style for bounding box
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
            ctx.shadowBlur = 10;

            let highestFace = resizedDetections[0]; // just take first face for global UI

            resizedDetections.forEach(detection => {
                const expressions = detection.expressions;
                const topEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
                const { emoji, color } = EMOTION_MAPPING[topEmotion] || EMOTION_MAPPING.neutral;

                const box = detection.detection.box;

                // Draw bounding box (with face offset due to mirroring if needed, canvas naturally deals with it based on overlay)
                ctx.beginPath();
                ctx.roundRect(box.x, box.y, box.width, box.height, 12);
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.stroke();

                // Emoji flag
                ctx.shadowBlur = 0;
                ctx.font = '36px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(emoji, box.x + box.width/2, box.y - 12);
            });

            // Update local badge UI using highestFace
            const exps = highestFace.expressions;
            const tEmo = Object.keys(exps).reduce((a, b) => exps[a] > exps[b] ? a : b);
            const confPct = (exps[tEmo] * 100).toFixed(1);
            const mapped = EMOTION_MAPPING[tEmo];

            lfEmoji.textContent = mapped.emoji;
            lfLabel.textContent = mapped.label;
            lfConfFill.style.width = `${confPct}%`;
            lfConfFill.style.backgroundColor = mapped.color;
            lfConfPct.textContent = `${confPct}%`;
            lfConfPct.style.color = mapped.color;

            // Prepare object for app-wide UI update
            const allScores = {};
            for(let k in exps) {
                const m = EMOTION_MAPPING[k] || {};
                allScores[(m.label || k) + " " + (m.emoji || '')] = parseFloat((exps[k]*100).toFixed(2));
            }

            // ── Sustained Emotion Trigger ─────────────────────────────
            const isNegative = NEGATIVE_EMOTIONS.has(tEmo);
            const now = Date.now();

            if (isNegative) {
                if (sustainedEmotion === tEmo) {
                    // Check duration threshold
                    if (now - sustainedStartTime >= SUSTAIN_THRESHOLD_MS && !interventionTriggered) {
                        interventionTriggered = true;
                        if(window.displayResult) {
                            window.displayResult({
                                emotion: `${mapped.label} ${mapped.emoji}`,
                                confidence: confPct,
                                all_scores: allScores
                            });
                        }
                    }
                } else {
                    sustainedEmotion = tEmo;
                    sustainedStartTime = now;
                    interventionTriggered = false;
                }
            } else {
                sustainedEmotion = null;
                sustainedStartTime = 0;
                interventionTriggered = false;
            }

            // Regular Interval Update (every 2.5s)
            if(now - lastReportTime > 2500) {
                if(window.displayResult && !interventionTriggered) {
                    window.displayResult({
                        emotion: `${mapped.label} ${mapped.emoji}`,
                        confidence: confPct,
                        all_scores: allScores
                    });
                }
                lastReportTime = now;
            }

        }, 200); // 5fps for performance
    }
});
