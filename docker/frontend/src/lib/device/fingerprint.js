"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDeviceFingerprint = collectDeviceFingerprint;
exports.submitDeviceFingerprint = submitDeviceFingerprint;
function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(16);
}
function getPluginsHash() {
    try {
        // @ts-ignore
        const plugins = navigator.plugins ? Array.from(navigator.plugins).map(p => `${p.name}:${p.filename}:${p.description}`).join('|') : '';
        return hashString(plugins);
    }
    catch {
        return 'na';
    }
}
function getCanvasHash() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return undefined;
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('thaliumx-canvas-fp', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('thaliumx-canvas-fp', 4, 17);
        return hashString(canvas.toDataURL());
    }
    catch {
        return undefined;
    }
}
function getWebGLHash() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (!gl)
            return undefined;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
        return hashString(`${vendor}|${renderer}`);
    }
    catch {
        return undefined;
    }
}
function collectDeviceFingerprint() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    const fp = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        timezone,
        screen: {
            width: window.screen.width,
            height: window.screen.height,
            pixelRatio: window.devicePixelRatio || 1,
        },
        hardware: {
            // @ts-ignore
            memory: navigator.deviceMemory,
            // @ts-ignore
            cores: navigator.hardwareConcurrency,
        },
        pluginsHash: getPluginsHash(),
        canvasHash: getCanvasHash(),
        webglHash: getWebGLHash(),
        timestamp: Date.now(),
    };
    return fp;
}
async function submitDeviceFingerprint(endpoint = '/api/security/fingerprint') {
    try {
        const fp = collectDeviceFingerprint();
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : undefined;
        return await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(fp),
            keepalive: true,
        });
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=fingerprint.js.map