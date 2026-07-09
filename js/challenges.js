// js/challenges.js
import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { setDP } from './dashboard.js';

export async function loadChallenges() {
    showLoading('Loading challenges...');
    try {
        const filter = S.challengesFilter || 'active';
        const isAdmin = S.user?.roles?.includes('admin') || S.user?.role === 'admin' || S.user?.role === 'superadmin';
        let url;
        if (filter === 'active') { url = `${CHALLENGES_API}/active`; } else if (filter === 'upcoming') { url =
                `${CHALLENGES_API}/upcoming`; } else if (filter === 'completed') {
            if (!isAdmin) { toast('Completed challenges are only visible to admins.', 'info');
                S.challengesFilter = 'active';
                document.querySelector('#dash-challenges .fpill[onclick*="active"]')?.click();
                hideLoading(); return; }
            url = `${CHALLENGES_API}/all?status=completed`;
        } else { url = `${CHALLENGES_API}/active`; }
        const res = await apiCall(url);
        const challenges = res.data || [];
        if (!challenges || challenges.length === 0) {
            document.getElementById('challengesContainer').innerHTML =
                '<div class="empty-state"><i class="fas fa-trophy"></i><h4>No challenges</h4><p>Check back soon for new challenges!</p></div>';
        } else { renderChallenges(challenges); }
        const badge = document.getElementById('navChallengeBadge');
        if (badge) {
            const activeChallenges = challenges.filter(c => c.status === 'active').length;
            badge.textContent = activeChallenges || 0;
        }
        await loadMyChallengeProgress();
    } catch (err) {
        toast('Failed to load challenges: ' + err.message, 'error');
        document.getElementById('challengesContainer').innerHTML =
            '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load challenges. Please try again.</p></div>';
    } finally { hideLoading(); }
}

function renderChallenges(challenges) {
    const container = document.getElementById('challengesContainer');
    if (!container) return;
    if (!challenges || !challenges.length) {
        container.innerHTML =
            '<div class="empty-state"><i class="fas fa-trophy"></i><h4>No challenges</h4><p>Check back soon!</p></div>';
        return;
    }
    const showAds = !S.isPremium && shouldShowAd('challenge-sponsor');
    let html = '';
    challenges.forEach((c, idx) => {
        const isJoined = c.participants?.some(p => p === S.user?._id) || false;
        const statusClass = c.status === 'active' ? 'badge-success' : c.status === 'upcoming' ?
            'badge-cyan' : 'badge-dark';
        let userProgress = 0,
            userStatus = 'enrolled';
        if (S.challengeProgress) {
            const progress = S.challengeProgress.find(p => p.challengeId?._id === c._id || p.challengeId ===
                c._id);
            if (progress) { userProgress = progress.progress || 0;
                userStatus = progress.status || 'enrolled'; }
        }
        html += `
                <div class="challenge-card card card-p">
                    <div class="challenge-icon">🏆</div>
                    <h3>${escapeHtml(c.title)}</h3>
                    <p>${escapeHtml(c.description)}</p>
                    ${c.instructions ? `<p style="font-size:.8rem;color:var(--text2);margin-top:.3rem;">📌 ${escapeHtml(c.instructions)}</p>` : ''}
                    <div class="challenge-meta">
                        <span><i class="fas fa-calendar"></i> ${new Date(c.startDate).toLocaleDateString()} → ${new Date(c.endDate).toLocaleDateString()}</span>
                        <span><i class="fas fa-star"></i> ${c.rewardXP || 500} XP</span>
                        ${c.rewardAmount ? `<span><i class="fas fa-wallet"></i> ${fmtMoneyAPI(c.rewardAmount)}</span>` : ''}
                        ${c.rewardPremiumDays ? `<span><i class="fas fa-crown"></i> +${c.rewardPremiumDays}d Premium</span>` : ''}
                        <span><i class="fas fa-users"></i> ${c.participants?.length || 0} joined</span>
                        <span class="badge ${statusClass}" style="font-size:.55rem">${c.status || 'active'}</span>
                    </div>
                    ${isJoined ? `<div style="margin-top:.5rem;"><div class="prog" style="height:5px;"><div class="prog-fill ${userStatus === 'completed' ? 'pf-success' : 'pf-primary'}" style="width:${userProgress}%"></div></div><div style="font-size:.7rem;color:var(--text3);margin-top:.2rem;">${userStatus === 'completed' ? '✅ Completed!' : `${userProgress}% complete`}</div></div>` : `<button class="btn-primary btn-sm" onclick="joinChallenge('${c._id}')" ${c.status !== 'active' ? 'disabled' : ''}>${c.status === 'active' ? 'Join Challenge' : 'Coming Soon'}</button>`}
                </div>`;
        if (showAds && (idx + 1) % 2 === 0 && idx < challenges.length - 1) {
            const ad = getNextAd('challenge-sponsor');
            if (ad && ad.type === 'custom') {
                html += `
                            <div class="challenge-card card card-p sponsored" style="border:2px solid var(--primary);">
                                <div class="challenge-icon">⭐</div>
                                <h3>${escapeHtml(ad.data.title)}</h3>
                                <p>${escapeHtml(ad.data.description || 'Sponsored challenge')}</p>
                                <a href="${ad.data.linkUrl}" target="_blank" class="btn btn-primary btn-sm" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom')">Learn More</a>
                            </div>
                        `;
            }
        }
    });
    container.innerHTML = html;
    observeAdImpressions();
}

export function filterChallenges(type, el) {
    if (el) { document.querySelectorAll('#dash-challenges .fpill').forEach(p => p.classList.remove('active'));
        el.classList.add('active'); }
    S.challengesFilter = type;
    loadChallenges();
}

export async function joinChallenge(challengeId) {
    try {
        const res = await apiCall(`${CHALLENGES_API}/${challengeId}/join`, { method: 'POST' });
        toast(res.message || 'Joined challenge!', 'success');
        loadChallenges();
    } catch (err) { toast(err.message || 'Error joining challenge', 'error'); }
}

export async function loadMyChallengeProgress() {
    try {
        const res = await apiCall('/challenges/my-progress');
        S.challengeProgress = res.data || [];
        renderMyChallengeProgress();
        S.challengeProgress.forEach(async (p) => {
            if (p.status === 'enrolled' && p.progress >= 100) {
                try { await apiCall(`/challenges/${p.challengeId}/complete`, { method: 'POST' });
                    toast('🎉 Challenge completed! Rewards unlocked!', 'success');
                    loadChallenges();
                    import('./payments.js').then(({ renderWallet }) => renderWallet()); } catch (e) { console
                        .warn('Auto-complete failed:', e); }
            }
        });
    } catch (err) { console.warn('Could not load challenge progress:', err); }
}

function renderMyChallengeProgress() {
    const container = document.getElementById('myChallengeProgress');
    if (!container) return;
    if (!S.challengeProgress || !S.challengeProgress.length) {
        container.innerHTML =
            '<div class="empty-state"><p>You haven\'t joined any challenges yet.</p></div>';
        return;
    }
    container.innerHTML = S.challengeProgress.map(p => {
        const c = p.challengeId || {};
        const statusClass = p.status === 'completed' ? 'ps-paid' : p.status === 'enrolled' ?
            'ps-pend' : 'ps-fail';
        return `
                    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem;margin-bottom:.4rem;">
                        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.4rem;">
                            <div><strong>${escapeHtml(c.title || 'Challenge')}</strong></div>
                            <span class="pstatus ${statusClass}">${p.status}</span>
                        </div>
                        <div class="prog mt-2" style="height:5px;"><div class="prog-fill pf-primary" style="width:${p.progress || 0}%"></div></div>
                        <div style="font-size:.7rem;color:var(--text3);margin-top:.3rem;">Progress: ${p.progress || 0}%</div>
                        ${p.completedAt ? `<div style="font-size:.7rem;color:var(--success);">✅ Completed ${new Date(p.completedAt).toLocaleDateString()}</div>` : ''}
                        ${p.adminNote ? `<div style="font-size:.7rem;color:var(--text3);">Note: ${escapeHtml(p.adminNote)}</div>` : ''}
                        ${p.status === 'completed' && c.rewardAmount ? `<div style="font-size:.7rem;color:var(--gold);">💰 +${fmtMoneyAPI(c.rewardAmount)} earned</div>` : ''}
                        ${p.status === 'completed' && c.rewardPremiumDays ? `<div style="font-size:.7rem;color:var(--gold);">👑 +${c.rewardPremiumDays}d Premium</div>` : ''}
                    </div>`;
    }).join('');
}

function shouldShowAd(placement) {
    if (!S.loggedIn) return true;
    if (S.isPremium) {
        return placement === 'in-feed';
    }
    return true;
}

function getNextAd(placement) {
    if (!S.adPlacementCache[placement]) S.adPlacementCache[placement] = [];
    let ads = S.adPlacementCache[placement];
    let idx = 0;
    if (placement === 'explore') {
        ads = S.exploreAds.length ? S.exploreAds : S.customAds;
        idx = S.exploreAdIndex;
    } else if (placement === 'book-page' || placement === 'book-sponsor') {
        ads = S.bookAds.length ? S.bookAds : S.customAds;
        idx = S.bookAdIndex;
    } else {
        ads = S.customAds;
        idx = S.customAdIndex;
    }
    if (ads && ads.length) {
        const filtered = ads.filter(a => a.placement === placement || a.placement === 'in-feed' || a.placement ===
            'sidebar' || a.placement === 'banner' || a.placement === 'popup' || a.placement === 'video-pre' ||
            a.placement === 'video-mid' || a.placement === 'lesson-inline' || a.placement === 'challenge-sponsor' ||
            a.placement === 'book-sponsor' || a.placement === 'explore-sponsor');
        if (filtered.length) {
            const ad = filtered[idx % filtered.length];
            if (placement === 'explore') S.exploreAdIndex++;
            else if (placement === 'book-page' || placement === 'book-sponsor') S.bookAdIndex++;
            else S.customAdIndex++;
            return { type: 'custom', data: ad };
        }
    }
    if (S.adsterraLoaded) {
        return { type: 'adsterra', data: { placement } };
    }
    return null;
}

function observeAdImpressions() {
    const adCards = document.querySelectorAll('.ad-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const adId = card.dataset.adId;
                const postId = card.dataset.postId;
                const isAdsterra = card.classList.contains('adsterra-wrapper');
                if (adId && postId) {
                    trackAdImpression(adId, postId, isAdsterra ? 'adsterra' : 'custom');
                }
                observer.unobserve(card);
            }
        });
    }, { threshold: 0.5 });
    adCards.forEach(card => observer.observe(card));
}

async function trackAdImpression(adId, postId, network = 'custom') {
    if (!postId) return;
    const key = `ad_imp_${adId}_${postId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    await trackAdRevenue(adId, 'impression', postId, network);
}

async function trackAdRevenue(adId, type, postId, network = 'custom') {
    if (!postId) return;
    try {
        const res = await apiCall('/ads/track', {
            method: 'POST',
            body: { adId, type, postId, network }
        });
        if (res.success && res.credited > 0) {
            if (S.dp === 'wallet') import('./payments.js').then(({ renderWallet }) => renderWallet());
        }
    } catch (e) { console.warn('Ad tracking failed:', e); }
}

const CHALLENGES_API = '/challenges';
