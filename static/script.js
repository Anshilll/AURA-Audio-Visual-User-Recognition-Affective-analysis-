document.addEventListener('DOMContentLoaded', () => {
    // ── Global State ───────────────────────────────────────────
    const state = {
        totalAnalyses: 0,
        sessionStartTime: Date.now(),
        mode: 'Speech',
        topEmotion: '—',
        lockedIntervention: false
    };

    // ── Elements ───────────────────────────────────────────────
    // Top Bar Stats
    const countEl = document.getElementById('stat-count');
    const emotionEl = document.getElementById('stat-emotion');
    const modeEl = document.getElementById('stat-mode');
    const timeEl = document.getElementById('stat-session-time');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const tabSlider = document.getElementById('tab-slider');

    // Live Audio Elements
    const recordBtn = document.getElementById('record-btn');
    const recordBtnLabel = document.getElementById('record-btn-label');
    const canvas = document.getElementById('waveform-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const visualizerOverlay = document.getElementById('visualizer-overlay');
    const recBadge = document.getElementById('recording-indicator');
    const recTimer = document.getElementById('rec-timer');
    const livePlaybackSection = document.getElementById('live-playback-section');
    const liveAudioPlayer = document.getElementById('live-audio-player');

    // File Upload Elements
    const uploadArea = document.getElementById('upload-area');
    const uploadInput = document.getElementById('audio-upload-input');
    const fileReadySection = document.getElementById('file-ready-section');
    const selectedFilename = document.getElementById('selected-filename');
    const selectedFilesize = document.getElementById('selected-filesize');
    const audioPreview = document.getElementById('audio-preview');
    const analyzeFileBtn = document.getElementById('analyze-file-btn');
    const cancelFileBtn = document.getElementById('cancel-file-btn');

    // Results Panel Elements
    const resultPlaceholder = document.getElementById('result-placeholder');
    const loadingState = document.getElementById('loading');
    const resultContent = document.getElementById('result-content');
    
    const detectedEmoji = document.getElementById('detected-emoji');
    const detectedLabel = document.getElementById('detected-label');
    const primaryConfidence = document.getElementById('primary-confidence');
    const sourceTag = document.getElementById('source-tag');
    const scoresList = document.getElementById('scores-list');
    const emotionAura = document.getElementById('emotion-aura');

    // History
    const historyTimeline = document.getElementById('history-timeline');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // ── Background Particles ───────────────────────────────────
    initParticles();

    // ── Setup & Listeners ──────────────────────────────────────
    setInterval(updateSessionTime, 1000);

    // Tab Slider Setup
    function updateTabSlider(activeBtn) {
        if(!activeBtn) return;
        const parentRect = activeBtn.parentElement.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        tabSlider.style.width = `${btnRect.width}px`;
        tabSlider.style.transform = `translateX(${btnRect.left - parentRect.left}px)`;
        activeBtn.parentElement.style.opacity = '1';
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabPanels.forEach(p => {
                p.classList.add('hidden');
                p.classList.remove('active');
            });

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const targetId = btn.getAttribute('data-target');
            const targetPanel = document.getElementById(targetId);
            targetPanel.classList.remove('hidden');
            targetPanel.classList.add('active');

            updateTabSlider(btn);

            // Update stats mode
            if(targetId === 'tab-live-audio') state.mode = 'Live Audio';
            else if(targetId === 'tab-file-upload') state.mode = 'File Upload';
            else state.mode = 'Webcam';
            modeEl.textContent = state.mode;
        });
    });

    // Init slider position
    setTimeout(() => {
        const activeTab = document.querySelector('.tab-btn.active');
        updateTabSlider(activeTab);
    }, 100);

    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.tab-btn.active');
        updateTabSlider(activeTab);
        if(canvas) resizeCanvas();
    });

    // ── Live Audio Recording Logic ─────────────────────────────
    let audioContext, microphoneStream, processor, analyser;
    let recordedPCM = [];
    let isRecording = false;
    let animationFrameId;
    let recordingSampleRate = 44100;
    let recStartTime = 0;
    let recInterval;

    function resizeCanvas() {
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    if(canvas) {
        resizeCanvas();
        drawIdleWaveform();
    }

    function drawIdleWaveform() {
        const rect = canvas.parentNode.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.beginPath();
        ctx.moveTo(0, rect.height / 2);
        ctx.lineTo(rect.width, rect.height / 2);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function updateRecTimer() {
        const elapsed = Math.floor((Date.now() - recStartTime)/1000);
        const mins = String(Math.floor(elapsed/60)).padStart(2, '0');
        const secs = String(elapsed%60).padStart(2, '0');
        recTimer.textContent = `${mins}:${secs}`;
    }

    if(recordBtn) recordBtn.addEventListener('click', async () => {
        if (!isRecording) await startRecording();
        else stopRecording();
    });

    async function startRecording() {
        try {
            microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            recordingSampleRate = audioContext.sampleRate;
            
            const source = audioContext.createMediaStreamSource(microphoneStream);
            
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);

            recordedPCM = [];
            processor.onaudioprocess = e => {
                if (!isRecording) return;
                recordedPCM.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            };
            
            isRecording = true;
            recStartTime = Date.now();
            updateRecTimer();
            recInterval = setInterval(updateRecTimer, 1000);

            // UI
            recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Recording';
            recordBtn.classList.add('recording-active');
            recordBtn.setAttribute('aria-pressed', 'true');
            
            visualizerOverlay.classList.add('hidden');
            recBadge.classList.remove('hidden');
            livePlaybackSection.classList.add('hidden');
            
            resetResultsPanel();
            visualize();

        } catch (err) {
            console.error(err);
            alert("Could not access microphone.");
        }
    }

    function stopRecording() {
        isRecording = false;
        clearInterval(recInterval);
        
        let totalLen = recordedPCM.reduce((acc, val) => acc + val.length, 0);
        const flatPCM = new Float32Array(totalLen);
        let offset = 0;
        recordedPCM.forEach(buf => { flatPCM.set(buf, offset); offset += buf.length; });

        const wavBlob = encodeWAV(flatPCM, recordingSampleRate);
        
        if (processor) processor.disconnect();
        if (analyser) analyser.disconnect();
        if (microphoneStream) microphoneStream.getTracks().forEach(t => t.stop());
        if (audioContext) audioContext.close();
        
        cancelAnimationFrame(animationFrameId);
        drawIdleWaveform();
        
        // UI
        recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Recording';
        recordBtn.classList.remove('recording-active');
        recordBtn.setAttribute('aria-pressed', 'false');
        
        visualizerOverlay.classList.remove('hidden');
        recBadge.classList.add('hidden');
        
        // Setup playback
        liveAudioPlayer.src = URL.createObjectURL(wavBlob);
        livePlaybackSection.classList.remove('hidden');

        processAudio(wavBlob, 'Live Mic');
    }

    function visualize() {
        const rect = canvas.parentNode.getBoundingClientRect();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!isRecording) return;
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#d946ef'; // brand-secondary
            ctx.shadowColor = 'rgba(217, 70, 239, 0.5)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            
            const sliceWidth = rect.width * 1.0 / bufferLength;
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * rect.height / 2;
                if(i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(rect.width, rect.height / 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        };
        draw();
    }

    // ── WAV Encoder ──────────────────────────────────────────────
    function encodeWAV(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const writeString = (v, offset, str) => { for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i)); };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Blob([view], { type: 'audio/wav' });
    }

    // ── File Upload Logic ────────────────────────────────────────
    let currentBlob = null;
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    if(uploadArea) {
        uploadArea.addEventListener('click', () => uploadInput.click());
        uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
    }

    if(uploadInput) uploadInput.addEventListener('change', e => {
        if(e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.type.includes('audio') && !/\.(wav|mp3|flac|m4a)$/i.test(file.name)) {
            alert("Please select a valid audio file.");
            return;
        }
        currentBlob = file;
        selectedFilename.textContent = file.name;
        selectedFilesize.textContent = formatBytes(file.size);
        audioPreview.src = URL.createObjectURL(file);
        
        uploadArea.classList.add('hidden');
        fileReadySection.classList.remove('hidden');
        resetResultsPanel();
    }

    if(cancelFileBtn) cancelFileBtn.addEventListener('click', () => {
        currentBlob = null;
        uploadInput.value = "";
        uploadArea.classList.remove('hidden');
        fileReadySection.classList.add('hidden');
    });

    if(analyzeFileBtn) analyzeFileBtn.addEventListener('click', () => {
        if(currentBlob) processAudio(currentBlob, 'Uploaded File');
    });

    // ── API & UI Rendering ───────────────────────────────────────
    function resetResultsPanel() {
        resultPlaceholder.classList.remove('hidden');
        loadingState.classList.add('hidden');
        resultContent.classList.add('hidden');
        
        // Default to speech mode icon for source
        sourceTag.innerHTML = `<i class="fa-solid fa-microphone"></i> Audio`;
    }

    window.processAudio = async function(blob, sourceName="Audio") {
        resultPlaceholder.classList.add('hidden');
        resultContent.classList.add('hidden');
        loadingState.classList.remove('hidden');
        
        const fd = new FormData();
        fd.append('audio', blob, 'audio.wav');
        
        try {
            const res = await fetch('/predict', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            // Set source metadata visually
            sourceTag.innerHTML = sourceName === 'Live Mic' ? `<i class="fa-solid fa-microphone"></i> ${sourceName}` : `<i class="fa-solid fa-file-audio"></i> ${sourceName}`;
            
            displayResult(data);
            
        } catch (err) {
            console.error(err);
            loadingState.classList.add('hidden');
            resultPlaceholder.classList.remove('hidden');
            alert(`Analysis Error: ${err.message}`);
        }
    };

    window.displayResult = function(data) {
        loadingState.classList.add('hidden');
        resultContent.classList.remove('hidden');
        
        const [label, ...rest] = (data.emotion || "Neutral 😐").split(" ");
        const emoji = rest.join(" ") || "😐";
        const cleanLabel = label.replace(/[^\w\s]/g, "");
        const confidence = parseFloat(data.confidence || 0).toFixed(1);
        
        // Update Primary Result
        detectedLabel.textContent = cleanLabel;
        detectedEmoji.textContent = emoji;
        primaryConfidence.textContent = `${confidence}%`;

        // Update Aura Color based on emotion
        setAuraColor(cleanLabel);

        // Update Stats Bar
        state.totalAnalyses++;
        state.topEmotion = `${cleanLabel} ${emoji}`;
        
        countEl.textContent = state.totalAnalyses;
        emotionEl.textContent = state.topEmotion;

        // Render Scores Bar Chart
        scoresList.innerHTML = '';
        const scoresArr = Object.entries(data.all_scores || {})
            .map(([k, v]) => ({ key: k.replace(/[^\w\s]/g,"").trim(), val: parseFloat(v) }))
            .sort((a, b) => b.val - a.val);

        scoresArr.forEach((s, idx) => {
            const vp = s.val.toFixed(1);
            let fillClass = '';
            if(idx === 0) fillClass = 'fill-rank-0';
            else if(idx === 1) fillClass = 'fill-rank-1';
            else if(idx === 2) fillClass = 'fill-rank-2';

            const item = `
                <div class="score-item" aria-label="${s.key} probability ${vp}%">
                    <div class="score-info">
                        <span class="score-name">${s.key}</span>
                        <span class="score-val">${vp}%</span>
                    </div>
                    <div class="score-bar-bg">
                        <div class="score-bar-fill ${fillClass}" style="width:0%" data-target="${vp}"></div>
                    </div>
                </div>
            `;
            scoresList.insertAdjacentHTML('beforeend', item);
        });

        // Trigger animations
        requestAnimationFrame(() => {
            document.querySelectorAll('.score-bar-fill').forEach(fill => {
                fill.style.width = fill.getAttribute('data-target') + '%';
            });
        });

        // Trigger Well-being Intervention if negative emotion
        handleIntervention(cleanLabel);

        // Add to history
        addToHistory(cleanLabel, emoji, sourceTag.textContent.trim());
    };

    function setAuraColor(emotion) {
        const e = emotion.toLowerCase();
        if(e.includes('ang') || e.includes('disg')) emotionAura.style.background = 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, transparent 70%)';
        else if(e.includes('sad')) emotionAura.style.background = 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)';
        else if(e.includes('fear') || e.includes('surp')) emotionAura.style.background = 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)';
        else if(e.includes('hap')) emotionAura.style.background = 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)';
        else emotionAura.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)';
    }

    function handleIntervention(emotion) {
        if(state.lockedIntervention) return;
        
        const key = emotion.toLowerCase();
        const container = document.getElementById('intervention-container');
        if(!container) return;
        
        container.classList.add('hidden');
        container.innerHTML = '';
        
        document.body.classList.remove('mood-anger', 'mood-sadness', 'mood-fear', 'mood-happy');

        // Anger / Stress
        if(key.includes('ang') || key.includes('sad') || key.includes('disg')) {
            state.lockedIntervention = true;
            document.body.classList.add(key.includes('ang') ? 'mood-anger' : 'mood-sadness');
            container.classList.remove('hidden');
            container.className = 'intervention-container int-breathe';
            container.innerHTML = `
                <div class="int-header">
                    <i class="fa-solid fa-lungs int-icon"></i>
                    <h3 class="int-title">High Stress Detected. Let's Breathe.</h3>
                </div>
                <div class="int-body">
                    <p>Follow the circle sequence to help lower your heart rate and center yourself.</p>
                    <div class="breathe-widget">
                        <div class="breathe-circle"></div>
                        <div class="breathe-text"></div>
                    </div>
                </div>
                <div class="int-actions">
                    <button class="btn-dismiss" onclick="window.dismissIntervention()">
                        <i class="fa-solid fa-check"></i> I feel better now
                    </button>
                </div>
            `;
        } 
        // Fear / Panic
        else if(key.includes('fear') || key.includes('surp')) {
            state.lockedIntervention = true;
            document.body.classList.add('mood-fear');
            container.classList.remove('hidden');
            container.className = 'intervention-container int-ground';
            container.innerHTML = `
                <div class="int-header">
                    <i class="fa-solid fa-anchor int-icon"></i>
                    <h3 class="int-title">Panic Detected (5-4-3-2-1 Grounding)</h3>
                </div>
                <div class="int-body">
                    <p>Look around and bring your focus back to the present moment:</p>
                    <ul class="ground-list">
                        <li><span class="g-num">5</span> Things you can visually see.</li>
                        <li><span class="g-num">4</span> Things you can physically feel.</li>
                        <li><span class="g-num">3</span> Things you can hear right now.</li>
                        <li><span class="g-num">2</span> Things you can smell.</li>
                        <li><span class="g-num">1</span> Good thing about yourself.</li>
                    </ul>
                </div>
                <div class="int-actions">
                    <button class="btn-dismiss" onclick="window.dismissIntervention()">
                        <i class="fa-solid fa-check"></i> Exercise Complete
                    </button>
                </div>
            `;
        } else if(key.includes('hap')){
             document.body.classList.add('mood-happy');
        }
    }

    window.dismissIntervention = function() {
        const container = document.getElementById('intervention-container');
        if(container) {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
        state.lockedIntervention = false;
        document.body.classList.remove('mood-anger', 'mood-sadness', 'mood-fear', 'mood-happy');
    };

    // ── History & Stats ──────────────────────────────────────────
    function addToHistory(label, emoji, source) {
        const empty = historyTimeline.querySelector('.history-empty');
        if(empty) empty.remove();

        const timeStr = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        
        // Build icon conditionally
        let srcIcon = '<i class="fa-solid fa-robot"></i>';
        if(source.toLowerCase().includes('cam')) srcIcon = '<i class="fa-solid fa-video"></i>';
        else if(source.toLowerCase().includes('mic')) srcIcon = '<i class="fa-solid fa-microphone"></i>';
        else if(source.toLowerCase().includes('file')) srcIcon = '<i class="fa-solid fa-file-audio"></i>';

        const item = `
            <div class="h-item" role="listitem">
                <span class="h-emoji">${emoji}</span>
                <span class="h-label">${label}</span>
                <span class="h-source">${srcIcon} ${source}</span>
                <span class="h-time">${timeStr}</span>
            </div>
        `;
        historyTimeline.insertAdjacentHTML('afterbegin', item);
    }

    if(clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => {
        historyTimeline.innerHTML = `
            <div class="history-empty" role="listitem">
                <i class="fa-regular fa-clock" style="font-size:1.5rem;opacity:0.3;margin-bottom:8px"></i>
                <p>No history yet. Start interacting!</p>
            </div>
        `;
        state.totalAnalyses = 0;
        state.topEmotion = '—';
        countEl.textContent = '0';
        emotionEl.textContent = '—';
    });

    function updateSessionTime() {
        const diff = Math.floor((Date.now() - state.sessionStartTime) / 1000);
        const mins = String(Math.floor(diff/60)).padStart(2,'0');
        const secs = String(diff%60).padStart(2,'0');
        if(timeEl) timeEl.textContent = `${mins}:${secs}`;
    }

    // ── Particle System for Background ───────────────────────────
    function initParticles() {
        const c = document.getElementById('particle-canvas');
        if(!c) return;
        const cx = c.getContext('2d');
        let cw, ch;
        let particles = [];
        const numParticles = 40;

        function resizeP() {
            cw = c.width = window.innerWidth;
            ch = c.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeP);
        resizeP();

        class Particle {
            constructor() {
                this.x = Math.random() * cw;
                this.y = Math.random() * ch;
                this.r = Math.random() * 1.5 + 0.5;
                this.speedX = Math.random() * 0.4 - 0.2;
                this.speedY = Math.random() * -0.5 - 0.1;
                this.alpha = Math.random() * 0.5 + 0.1;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if(this.y < 0) {
                    this.y = ch;
                    this.x = Math.random() * cw;
                }
                if(this.x < 0 || this.x > cw) this.speedX *= -1;
            }
            draw() {
                cx.beginPath();
                cx.arc(this.x, this.y, this.r, 0, Math.PI*2);
                cx.fillStyle = `rgba(255,255,255,${this.alpha})`;
                cx.fill();
            }
        }
        
        for(let i=0; i<numParticles; i++) particles.push(new Particle());

        function loop() {
            cx.clearRect(0,0,cw,ch);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(loop);
        }
        loop();
    }
});
