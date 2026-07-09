import { S } from './state.js';
import { toast } from './utils.js';

export function loadTools() {
    loadCodeTool();
    loadTextEditor();
}

export function switchToolTab(tab, btn) {
    document.querySelectorAll('.tool-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('#dash-tools .tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('tool-' + tab).style.display = 'block';
    S.currentToolTab = tab;
    if (tab === 'editor') loadTextEditor();
    if (tab === 'code') loadCodeTool();
}

// ─── CODE RUNNER ────────────────────────────────────────────────────────

function loadCodeTool() {
    const html = localStorage.getItem('codeToolHtml') || '';
    const css = localStorage.getItem('codeToolCss') || '';
    const js = localStorage.getItem('codeToolJs') || '';
    document.getElementById('codeToolHtml').value = html;
    document.getElementById('codeToolCss').value = css;
    document.getElementById('codeToolJs').value = js;
    if (html || css || js) runCodeTool();
}

export function runCodeTool() {
    const html = document.getElementById('codeToolHtml').value || '';
    const css = document.getElementById('codeToolCss').value || '';
    const js = document.getElementById('codeToolJs').value || '';
    const output = document.getElementById('codeToolOutput');
    const doc = output.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`);
    doc.close();
}

export function saveCodeTool() {
    const html = document.getElementById('codeToolHtml').value || '';
    const css = document.getElementById('codeToolCss').value || '';
    const js = document.getElementById('codeToolJs').value || '';
    localStorage.setItem('codeToolHtml', html);
    localStorage.setItem('codeToolCss', css);
    localStorage.setItem('codeToolJs', js);
    toast('💾 Code saved locally!', 'success');
}

export function clearCodeTool() {
    if (!confirm('Clear all code?')) return;
    document.getElementById('codeToolHtml').value = '';
    document.getElementById('codeToolCss').value = '';
    document.getElementById('codeToolJs').value = '';
    localStorage.removeItem('codeToolHtml');
    localStorage.removeItem('codeToolCss');
    localStorage.removeItem('codeToolJs');
    document.getElementById('codeToolOutput').src = 'about:blank';
    toast('Cleared', 'info');
}

// ─── FILE CONVERTER ────────────────────────────────────────────────────

export function handleConvertFile(input) {
    const file = input.files[0];
    if (!file) return;
    S.convertFileData = file;
    document.getElementById('convertBtn').disabled = false;
    const preview = document.getElementById('convertPreview');
    preview.style.display = 'block';
    document.getElementById('convertFileName').textContent = file.name;
    document.getElementById('convertFileSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('convertPreviewImage').src = e.target.result;
            document.getElementById('convertPreviewImage').style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        document.getElementById('convertPreviewImage').style.display = 'none';
    }
    document.getElementById('convertResult').style.display = 'none';
}

export function convertFile() {
    if (!S.convertFileData) { toast('Please upload a file first', 'error'); return; }
    const from = document.getElementById('convertFrom').value;
    const to = document.getElementById('convertTo').value;
    toast('Converting... Please wait.', 'info');
    setTimeout(() => {
        if (from === 'image') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    let mimeType = 'image/png';
                    let ext = 'png';
                    if (to === 'jpg' || to === 'jpeg') { mimeType = 'image/jpeg';
                        ext = 'jpg'; } else if (to === 'webp') { mimeType = 'image/webp';
                        ext = 'webp'; } else if (to === 'pdf') {
                        toast('PDF conversion requires additional library. Please install jspdf.',
                            'warning');
                        return;
                    }
                    const dataUrl = canvas.toDataURL(mimeType, 0.92);
                    S.convertedFileData = dataUrl;
                    S.convertedFileType = ext;
                    document.getElementById('convertResult').style.display = 'block';
                    toast('✅ Conversion complete!', 'success');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(S.convertFileData);
        } else if (from === 'pdf') {
            toast('PDF conversion requires additional library. Please install pdfjs-dist.', 'warning');
        }
    }, 1000);
}

export function downloadConvertedFile() {
    if (!S.convertedFileData) { toast('Nothing to download', 'error'); return; }
    const a = document.createElement('a');
    a.href = S.convertedFileData;
    a.download = `converted.${S.convertedFileType || 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── TEXT EDITOR ────────────────────────────────────────────────────────

function loadTextEditor() {
    const title = localStorage.getItem('textEditorTitle') || '';
    const content = localStorage.getItem('textEditorContent') || '';
    document.getElementById('textEditorTitle').value = title;
    document.getElementById('textEditorContent').value = content;
    updateTextEditorStatus();
}

export function saveTextEditor() {
    const title = document.getElementById('textEditorTitle').value || 'Untitled';
    const content = document.getElementById('textEditorContent').value || '';
    localStorage.setItem('textEditorTitle', title);
    localStorage.setItem('textEditorContent', content);
    updateTextEditorStatus();
    toast('✅ Note saved!', 'success');
}

export function clearTextEditor() {
    if (!confirm('Clear all content?')) return;
    document.getElementById('textEditorTitle').value = '';
    document.getElementById('textEditorContent').value = '';
    localStorage.removeItem('textEditorTitle');
    localStorage.removeItem('textEditorContent');
    updateTextEditorStatus();
    toast('Cleared', 'info');
}

function updateTextEditorStatus() {
    const status = document.getElementById('textEditorStatus');
    if (status) {
        const saved = localStorage.getItem('textEditorTitle') || localStorage.getItem('textEditorContent');
        status.textContent = saved ? 'Last saved: ' + new Date().toLocaleString() : 'No saved notes';
    }
}

// Auto-save text editor every 30 seconds
setInterval(() => {
    if (S.currentToolTab === 'editor') {
        const title = document.getElementById('textEditorTitle')?.value;
        const content = document.getElementById('textEditorContent')?.value;
        if (title || content) {
            localStorage.setItem('textEditorTitle', title || '');
            localStorage.setItem('textEditorContent', content || '');
        }
    }
}, 30000);

// ─── EXPOSE ─────────────────────────────────────────────────────────────

window.switchToolTab = switchToolTab;
window.runCodeTool = runCodeTool;
window.saveCodeTool = saveCodeTool;
window.clearCodeTool = clearCodeTool;
window.handleConvertFile = handleConvertFile;
window.convertFile = convertFile;
window.downloadConvertedFile = downloadConvertedFile;
window.saveTextEditor = saveTextEditor;
window.clearTextEditor = clearTextEditor;
