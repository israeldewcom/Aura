import { S } from './state.js';
import { apiCall, fmtMoneyAPI, getAvatarUrl } from './utils.js';

export async function loadLeaderboard() {
    try {
        const data = await apiCall('/users/leaderboard?limit=20');
        S.leaderboard = Array.isArray(data.data) ? data.data : [];
        if (!S.leaderboard.length) {
            try {
                const fallback = await apiCall('/users/top?limit=20');
                if (fallback.data && fallback.data.length) {
                    S.leaderboard = fallback.data;
                }
            } catch (_) {}
        }
    } catch (e) {
        console.warn('Leaderboard fetch error:', e);
        S.leaderboard = [];
    }
}

export function renderLB() {
    const el = document.getElementById('lbFull');
    if (!el) return;
    if (!S.leaderboard || S.leaderboard.length === 0) {
        const placeholders = [
            { firstName: 'Amaka', lastName: 'Obi', xp: 28450, totalEarned: 245000, streakDays: 45,
                referralCount: 12 },
            { firstName: 'Kelechi', lastName: 'Agu', xp: 22100, totalEarned: 189000, streakDays: 38,
                referralCount: 8 },
            { firstName: 'Fatima', lastName: 'Bello', xp: 19800, totalEarned: 167000, streakDays: 31,
                referralCount: 6 },
            { firstName: 'Emeka', lastName: 'Nnamdi', xp: 17500, totalEarned: 152000, streakDays: 27,
                referralCount: 5 },
            { firstName: 'Blessing', lastName: 'Okonkwo', xp: 16200, totalEarned: 138000, streakDays: 23,
                referralCount: 4 }
        ];
        el.innerHTML = placeholders.map((u, i) => {
            let value;
            switch (S.lbTab) {
                case 'earnings':
                    value = fmtMoneyAPI(u.totalEarned || 0);
                    break;
                case 'streak':
                    value = (u.streakDays || 0) + ' days';
                    break;
                case 'refs':
                    value = (u.referralCount || 0) + ' refs';
                    break;
                default:
                    value = (u.xp || 0).toLocaleString() + ' XP';
            }
            const isYou = u._id === S.user?._id;
            return `<div class="lb-row ${isYou ? 'you' : ''}"><div class="lb-rank">${['🥇','🥈','🥉'][i] || i + 1}</div><div class="lb-av" style="background:linear-gradient(135deg,var(--violet),var(--cyan))">${(u.firstName || 'U')[0]}</div><div style="flex:1"><div style="font-size:.85rem;font-weight:600">${u.firstName || 'User'} ${isYou ? '<span class="badge badge-primary" style="font-size:.55rem">You</span>' : ''}</div><div style="font-size:.71rem;color:var(--text3)">🔥 ${u.streakDays || 0}-day streak</div></div><div style="font-weight:800;color:var(--primary)">${value}</div></div>`;
        }).join('');
        return;
    }
    el.innerHTML = S.leaderboard.map((u, i) => {
        let value;
        const xp = u.xp || u.experience || u.points || 0;
        const earned = u.totalEarned || u.earnings || u.walletBalance || 0;
        const streak = u.streakDays || u.streak || 0;
        const refs = u.referralCount || u.referrals || 0;
        switch (S.lbTab) {
            case 'earnings':
                value = fmtMoneyAPI(earned);
                break;
            case 'streak':
                value = streak + ' days';
                break;
            case 'refs':
                value = refs + ' refs';
                break;
            default:
                value = xp.toLocaleString() + ' XP';
        }
        const isYou = u._id === S.user?._id;
        const avatarHtml = getAvatarUrl(u) ?
            `<img src="${getAvatarUrl(u)}" alt="${u.firstName || 'U'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
            (u.firstName?.[0] || 'U');
        return `<div class="lb-row ${isYou ? 'you' : ''}"><div class="lb-rank">${['🥇','🥈','🥉'][i] || i + 1}</div><div class="lb-av" style="background:linear-gradient(135deg,var(--violet),var(--cyan));overflow:hidden">${avatarHtml}</div><div style="flex:1"><div style="font-size:.85rem;font-weight:600">${u.firstName || 'User'} ${isYou ? '<span class="badge badge-primary" style="font-size:.55rem">You</span>' : ''}</div><div style="font-size:.71rem;color:var(--text3)">🔥 ${streak}-day streak</div></div><div style="font-weight:800;color:var(--primary)">${value}</div></div>`;
    }).join('') || '<div class="empty-state"><p>No data</p></div>';
}

export function switchLbTab(tab, btn) {
    document.querySelectorAll('#dash-leaderboard .tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    S.lbTab = tab;
    renderLB();
}

// Expose
window.loadLeaderboard = loadLeaderboard;
window.renderLB = renderLB;
window.switchLbTab = switchLbTab;
