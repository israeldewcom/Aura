import { S } from './state.js';
import { apiCall, toast, escapeHtml } from './utils.js';

export async function loadUserBadges() {
    try {
        const res = await apiCall('/users/badges');
        const badges = res.data || [];
        S.badges = badges;
        const container = document.getElementById('badgesGrid');
        if (!container) return;
        if (!badges.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-medal"></i><p>No badges yet. Complete challenges and courses to earn badges!</p></div>';
            return;
        }
        container.innerHTML = badges.map(b => `
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="card card-p text-center" style="padding:1rem;">
                            <div style="font-size:2.5rem;">${b.icon || '🏆'}</div>
                            <div style="font-weight:700;font-size:.9rem;">${escapeHtml(b.name)}</div>
                            <div style="font-size:.7rem;color:var(--text3);">${escapeHtml(b.description || '')}</div>
                            <div style="font-size:.6rem;color:var(--text3);margin-top:.3rem;">Earned: ${new Date(b.awardedAt).toLocaleDateString()}</div>
                            <span class="badge badge-earned" style="font-size:.55rem;margin-top:.3rem;">✅ Earned</span>
                        </div>
                    </div>
                `).join('');
    } catch (err) { toast('Failed to load badges: ' + err.message, 'error'); }
}

// Expose
window.loadUserBadges = loadUserBadges;
