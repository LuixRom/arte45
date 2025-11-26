const CameraScreen = (function () {
    const MODEL_URL = "models/fer2013_mb2.onnx";
    const LABELS_URL = "models/fer2013_labels.json";
    const ANIM_DIR = "animations";

    const COUNTDOWN_SECS = 5;
    const CAPTURE_SECS = 4.0;
    const MIN_CONF = 0.20;
    const MIN_FRAMES_PRIMARY = 2;
    const MIN_PERCENTAGE = 15;
    const IMG_SIZE = 96;
    const NEUTRAL_NAME = "neutral";

    const PRIMARY_EMOTIONS = ["angry", "fear", "happy", "sad", "surprise"];

    const LOCK_CONF = 0.35;
    const LOCK_CONSEC = 7;
    const NEUTRAL_WEIGHT = 0.001;

    const EMOTION_TO_ANIM = {
        happy: "happy.mp4",
        sad: "sad.mp4",
        angry: "angry.mp4",
        fear: "fear.mp4",
        surprise: "surprise.mp4",
        neutral: "neutral.mp4",
    };

    let $container = null;
    let $video = null;
    let $anim = null;
    let $overlay = null;
    let $buffer = null;
    let $btnStart = null;
    let $btnRetry = null;
    let $btnHome = null;
    let $status = null;
    let $resBox = null;
    let $resLab = null;
    let $resConf = null;
    let $cameraSelect = null;
    let $countdownOverlay = null;
    let $countdownNumber = null;

    let session = null;
    let labels = [];
    let phase = "loading";
    let countdown = COUNTDOWN_SECS;
    let history = [];
    let consec = { label: null, n: 0 };
    let currentDeviceId = null;

    function setPhase(p) {
        phase = p;
        if (!$status) return;

        if (p === "idle") {
            setPill("Listo", "idle");
            overlayMessage("Haz clic en 'Listo, comenzar'");
        } else if (p === "countdown") {
            setPill("Preparando", "countdown");
        } else if (p === "capturing") {
            setPill("Detectando", "capturing");
            overlayMessage("Capturando…");
        } else if (p === "showing") {
            setPill("Animación", "showing");
            overlayMessage("");
        }
    }

    function setPill(text, cls) {
        if (!$status) return;
        $status.className = `camera-status ${cls}`;
        $status.textContent = text;
    }

    function overlayMessage(msg) {
        if ($overlay) $overlay.textContent = msg || "";
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(v => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / sum);
    }

    function stopTracks() {
        const s = $video.srcObject;
        if (s) s.getTracks().forEach(t => t.stop());
        $video.srcObject = null;
    }

    async function showCountdown() {
        if (!$countdownOverlay || !$countdownNumber) return;

        $countdownOverlay.classList.add('active');

        for (let i = COUNTDOWN_SECS; i > 0; i--) {
            $countdownNumber.textContent = i;
            overlayMessage(`Comenzamos en ${i}…`);
            await sleep(1000);
        }

        $countdownOverlay.classList.remove('active');
    }

    async function initCamera() {
        try {
            session = await ort.InferenceSession.create(MODEL_URL, {
                executionProviders: ["webgl", "wasm"]
            });

            const data = await fetch(LABELS_URL).then(r => r.json());
            if (Array.isArray(data)) labels = data;
            else {
                const maxk = Math.max(...Object.keys(data).map(k => parseInt(k)));
                labels = new Array(maxk + 1).fill("");
                for (const [k, v] of Object.entries(data)) labels[parseInt(k)] = v;
            }

            const savedId = localStorage.getItem("emotion_cam_id");
            await startCamera(savedId);
            setPhase("idle");

            navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
        } catch (err) {
            console.error(err);
            alert("No pude cargar modelo/labels o abrir la cámara. Revisa rutas y permisos (HTTPS/localhost).");
        }
    }

    async function startCamera(deviceId = null) {
        stopTracks();

        const constraints = deviceId
            ? {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            }
            : {
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        $video.srcObject = stream;
        await $video.play();
        currentDeviceId = deviceId || await getDeviceIdFromStream(stream);

        await populateCameraList(currentDeviceId);
    }

    async function getDeviceIdFromStream(stream) {
        const track = stream.getVideoTracks()[0];
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === "videoinput");
        if (track && track.label) {
            const found = cams.find(d => d.label === track.label);
            return found ? found.deviceId : (cams[0] && cams[0].deviceId) || null;
        }
        return (cams[0] && cams[0].deviceId) || null;
    }

    async function populateCameraList(selectedId = null) {
        if (!$cameraSelect) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === "videoinput");

        const prev = Array.from($cameraSelect.options).map(o => o.value).join("|");
        const now = cams.map(c => c.deviceId).join("|");
        if (prev === now && $cameraSelect.options.length > 0) {
            if (selectedId && $cameraSelect.value !== selectedId) {
                $cameraSelect.value = selectedId;
            }
            return;
        }

        $cameraSelect.innerHTML = "";
        cams.forEach((c, idx) => {
            const opt = document.createElement("option");
            opt.value = c.deviceId;
            opt.textContent = c.label || `Cámara ${idx + 1}`;
            $cameraSelect.appendChild(opt);
        });

        const saved = localStorage.getItem("emotion_cam_id");
        const toSelect = selectedId || saved || (cams[0] && cams[0].deviceId);
        if (toSelect) $cameraSelect.value = toSelect;
    }

    async function onDeviceChange() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === "videoinput");
        const stillThere = cams.some(c => c.deviceId === currentDeviceId);
        await populateCameraList(stillThere ? currentDeviceId : null);
        if (!stillThere && cams.length) {
            const nextId = cams[0].deviceId;
            localStorage.setItem("emotion_cam_id", nextId);
            await startCamera(nextId);
            if (phase === "idle") overlayMessage("Cámara cambiada (dispositivo nuevo).");
        }
    }

    async function captureWindow() {
        history = [];
        consec = { label: null, n: 0 };
        const start = performance.now();
        while ((performance.now() - start) / 1000 < CAPTURE_SECS) {
            const locked = await stepInference();
            if (locked) return;
            await sleep(0);
        }
        decide();
    }

    async function stepInference() {
        const ctx = $buffer.getContext("2d");
        if (!ctx || !session) return false;

        const vw = $video.videoWidth || 640;
        const vh = $video.videoHeight || 480;

        const scale = Math.max(IMG_SIZE / vw, IMG_SIZE / vh);
        const sw = IMG_SIZE / scale, sh = IMG_SIZE / scale;
        const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
        ctx.drawImage($video, sx, sy, sw, sh, 0, 0, IMG_SIZE, IMG_SIZE);

        const img = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
        const out = new Float32Array(IMG_SIZE * IMG_SIZE);
        for (let i = 0, j = 0; i < img.data.length; i += 4, ++j) {
            const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
            out[j] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        }
        const tensor = new ort.Tensor("float32", out, [1, IMG_SIZE, IMG_SIZE, 1]);

        let label = NEUTRAL_NAME, conf = 0.0;
        try {
            const feeds = {}; feeds[session.inputNames[0]] = tensor;
            const results = await session.run(feeds);
            const logits = results[session.outputNames[0]].data;
            const probs = softmax(Array.from(logits));
            let k = 0, best = -Infinity;
            for (let i = 0; i < probs.length; i++) if (probs[i] > best) { best = probs[i]; k = i; }
            label = labels[k] ?? String(k);
            conf = best;
        } catch (e) {
            console.error("Error en inferencia:", e);
            overlayMessage("Error en inferencia. Reintenta.");
            return false;
        }

        history.push({ t: performance.now(), label, conf });

        if (PRIMARY_EMOTIONS.includes(label) && conf >= LOCK_CONF) {
            if (consec.label === label) consec.n++;
            else { consec.label = label; consec.n = 1; }
            if (consec.n >= LOCK_CONSEC) {
                console.log("LOCK:", label, "conf:", conf.toFixed(3));
                decideLocked(label, conf);
                return true;
            }
        } else {
            consec.label = null; consec.n = 0;
        }

        overlayMessage(`Detectando: ${label} (${conf.toFixed(2)})`);
        return false;
    }

    function decide() {
        if (!history.length) {
            overlayMessage("No se capturaron fotogramas. Intenta de nuevo.");
            $btnStart.disabled = false; setPhase("idle"); return;
        }

        const n = history.length;
        const i0 = Math.floor(n * 0.20), i1 = Math.ceil(n * 0.80);
        const core = history.slice(i0, i1);

        const votes = new Map();
        let primaryFrames = 0;
        for (const h of core) {
            const isNeutral = (h.label === NEUTRAL_NAME);
            if (PRIMARY_EMOTIONS.includes(h.label)) primaryFrames++;
            const w = isNeutral ? NEUTRAL_WEIGHT : 1.0;
            const v = votes.get(h.label) || { wcount: 0, sum: 0, count: 0 };
            v.wcount += w;
            v.sum += h.conf;
            v.count += 1;
            votes.set(h.label, v);
        }

        const ordered = [...votes.entries()].sort((a, b) => b[1].wcount - a[1].wcount);

        let bestLabel = null;
        for (const [lab] of ordered) {
            if (lab !== NEUTRAL_NAME) { bestLabel = lab; break; }
        }
        if (!bestLabel) bestLabel = ordered[0][0];

        const v = votes.get(bestLabel);
        const avg = v.sum / v.count;

        console.log("Votos(core):", Object.fromEntries(
            [...votes.entries()].map(([k, v]) => [k, { w: v.wcount.toFixed(3), avg: (v.sum / v.count).toFixed(3), n: v.count }])
        ));
        console.log("Elegida:", bestLabel, "avg:", avg.toFixed(3), "| frames:", core.length);

        showDecision(bestLabel, avg);
    }

    function decideLocked(label, conf) {
        showDecision(label, conf);
    }

    function showDecision(label, conf) {
        stopTracks();
        setPhase("showing");
        $video.classList.add("hidden");
        $anim.classList.remove("hidden");
        $resLab.textContent = label;
        $resConf.textContent = `(${conf.toFixed(2)})`;
        $resBox.classList.remove("hidden");

        const animFile = EMOTION_TO_ANIM[label];
        if (!animFile) {
            overlayMessage(`No hay animación para: ${label}`);
            $btnRetry.disabled = false; return;
        }
        $anim.src = `${ANIM_DIR}/${animFile}`;
        $anim.play().catch(() => overlayMessage("Haz clic sobre el video para reproducir la animación."));
        $btnRetry.disabled = false;
    }

    async function handleStart() {
        if (phase !== "idle") return;
        $btnStart.disabled = true;
        $btnRetry.disabled = true;
        setPhase("countdown");

        await showCountdown();

        setPhase("capturing");
        await captureWindow();
    }

    async function handleRetry() {
        $resBox.classList.add("hidden");
        $anim.classList.add("hidden");
        $video.classList.remove("hidden");
        $btnRetry.disabled = true;

        const savedId = localStorage.getItem("emotion_cam_id");
        await startCamera(savedId || currentDeviceId);
        setPhase("idle");
        $btnStart.disabled = false;
    }

    function handleHome() {
        // Stop camera and reset state
        stopTracks();
        $resBox.classList.add("hidden");
        $anim.classList.add("hidden");
        $video.classList.remove("hidden");
        $btnRetry.disabled = true;
        $btnStart.disabled = false;
        setPhase("idle");

        // Return to curtain screen
        if (window.App && window.App.goToCurtain) {
            window.App.goToCurtain();
        }
    }

    function handleCameraChange(e) {
        const id = e.target.value;
        localStorage.setItem("emotion_cam_id", id);
        startCamera(id).catch(err => {
            console.error("No se pudo iniciar la cámara seleccionada:", err);
            overlayMessage("Error al cambiar de cámara.");
        });
    }

    function init() {
        $container = document.getElementById('camera-screen');
        if (!$container) {
            console.error('Camera screen container not found');
            return;
        }

        $video = $container.querySelector("#camera-video");
        $anim = $container.querySelector("#camera-anim");
        $overlay = $container.querySelector("#camera-overlay");
        $buffer = document.getElementById("buffer"); // Canvas global
        $btnStart = $container.querySelector("#camera-start-btn");
        $btnRetry = $container.querySelector("#camera-retry-btn");
        $btnHome = $container.querySelector("#camera-home-btn");
        $status = $container.querySelector("#camera-status");
        $resBox = $container.querySelector("#camera-result");
        $resLab = $container.querySelector("#result-label");
        $resConf = $container.querySelector("#result-conf");
        $cameraSelect = $container.querySelector("#camera-select");
        $countdownOverlay = $container.querySelector("#countdown-overlay");
        $countdownNumber = $container.querySelector("#countdown-number");

        if ($btnStart) $btnStart.addEventListener("click", handleStart);
        if ($btnRetry) $btnRetry.addEventListener("click", handleRetry);
        if ($btnHome) $btnHome.addEventListener("click", handleHome);
        if ($cameraSelect) $cameraSelect.addEventListener("change", handleCameraChange);
    }

    function show() {
        if ($container) {
            $container.classList.add('active');
            initCamera();
        }
    }

    function hide() {
        if ($container) {
            $container.classList.remove('active');
        }
    }

    return {
        init,
        show,
        hide
    };
})();
