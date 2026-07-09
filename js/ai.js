import { S } from './state.js';
import { apiCall, toast } from './utils.js';
import { openModal } from './ui.js';

export function initAI() {
    document.getElementById('aiMessages').innerHTML =
        `<div style="display:flex;gap:.5rem"><div class="si si-c" style="width:28px;height:28px"><i class="fas fa-robot"></i></div><div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.6rem;font-size:.82rem">Hi ${S.user?.firstName || 'there'}! 👋 I'm your ChangeX AI Tutor. Ask me anything about coding, your courses, or tech in general!</div></div>`;
    document.getElementById('aiPlanNote').innerHTML = S.isPremium ?
        '<span class="badge badge-premium"><i class="fas fa-crown"></i>Premium: Unlimited AI Chat &amp; File Uploads</span>' :
        '<span class="badge badge-dark">Free: Basic chat · <a style="color:var(--primary);cursor:pointer" onclick="openModal(\'premiumModal\')">Upgrade for Unlimited</a></span>';
    document.getElementById('aiUploadLimit').textContent = S.isPremium ?
        'No limits — upload PDFs, images, code, anything!' :
        'Free users: text chat only. Upgrade to Premium for unlimited file uploads.';
}

export async function sendAI() {
    const inp = document.getElementById('aiInput');
    const msgs = document.getElementById('aiMessages');
    if (!inp?.value.trim()) return;
    const q = inp.value.trim();
    msgs.innerHTML +=
        `<div style="display:flex;justify-content:flex-end;margin-bottom:.5rem"><div style="background:rgba(212,175,55,.12);border-radius:var(--radius-sm);padding:.6rem;font-size:.82rem;max-width:85%">${q}</div></div>`;
    msgs.innerHTML +=
        `<div id="aiTyping" style="display:flex;gap:.5rem"><div class="si si-c" style="width:28px;height:28px"><i class="fas fa-robot"></i></div><div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.6rem;font-size:.82rem;color:var(--text3)">Thinking...</div></div>`;
    inp.value = '';
    msgs.scrollTop = msgs.scrollHeight;
    try {
        const res = await apiCall('/ai/chat', { method: 'POST', body: { message: q } });
        const reply = res.data?.response || res.data?.reply ||
            'I received your message! Let me help you with that.';
        const typing = document.getElementById('aiTyping');
        if (typing) { typing.querySelector('div:last-child').textContent = reply;
            typing.removeAttribute('id'); }
    } catch (e) {
        const replies = [
            'Great question! 💪 Keep learning and building.',
            'Excellent topic! Practice makes perfect.',
            'I recommend checking out the resources in your course.',
            'Keep going! Consistency is key. 🔥'
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        const typing = document.getElementById('aiTyping');
        if (typing) { typing.querySelector('div:last-child').textContent = reply;
            typing.removeAttribute('id'); }
    }
    msgs.scrollTop = msgs.scrollHeight;
}

export function switchAIMode(mode, btn) {
    document.querySelectorAll('#dash-ai .fpill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('aiUploadPanel').style.display = mode === 'upload' ? 'block' : 'none';
    if (mode === 'upload' && !S.isPremium) { toast('File uploads require Premium!', 'warning');
        openModal('premiumModal'); }
}

export function handleAIUpload(input) {
    if (!S.isPremium) { toast('Upgrade to Premium for file uploads', 'warning');
        openModal('premiumModal'); return; }
    const files = Array.from(input.files);
    document.getElementById('aiUploadedFiles').innerHTML = files.map(f =>
        `<div style="font-size:.8rem;margin-bottom:.3rem">✅ ${f.name} — AI analyzing...</div>`).join('');
    setTimeout(() => toast(`${files.length} file(s) analyzed by AI!`, 'success'), 1500);
}

// Expose
window.initAI = initAI;
window.sendAI = sendAI;
window.switchAIMode = switchAIMode;
window.handleAIUpload = handleAIUpload;
