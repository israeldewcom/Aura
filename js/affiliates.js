import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading } from './utils.js';
import { openModal, closeModal } from './ui.js';

export async function renderAffiliates(forceRefresh = false) {
    showLoading('Loading affiliate offers...');
    try {
        if (forceRefresh || !S.affiliateOffers.length) {
            const offersData = await apiCall('/courses?hasAffiliate=true&published=true&limit=20');
            S.affiliateOffers = (Array.isArray(offersData.data) ? offersData.data : (Array.isArray(offersData.data
                ?.courses) ? offersData.data.courses : []));
        }
    } catch (e) { S.affiliateOffers = []; }
    try {
        const statsRes = await apiCall('/affiliate/stats');
        if (statsRes.data) S.affiliateStats = statsRes.data;
        const linksRes = await apiCall('/affiliate/my-links');
        S.myAffiliateLinks = linksRes.data?.links || [];
        const navAffBadge = document.getElementById('navAffBadge');
        if (navAffBadge) navAffBadge.textContent = S.myAffiliateLinks.length;
    } catch (e) { console.warn('Could not load affiliate stats:', e); }
    const offersHtml = S.affiliateOffers.length ? S.affiliateOffers.map(c => {
        const price = c.salePrice || c.price || 0;
        const percent = c.affiliatePercent || 0;
        const commissionPerSale = Math.round(price * percent / 100);
        const commissionText = commissionPerSale === 0 ? '₦0 / sale' :
            `${fmtMoneyAPI(commissionPerSale)} / sale`;
        return `<div class="affiliate-offer-card" data-course-id="${c._id}"><div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap"><div style="font-size:1.75rem">${c.thumbnail || c.emoji || '📚'}</div><div style="flex:1"><div style="font-weight:700">${c.title}</div><div style="font-size:.74rem;color:var(--text3)">${percent}% commission · ${commissionText}</div></div><button class="btn btn-violet btn-sm" onclick="acceptAff('${c._id}')"><i class="fas fa-handshake"></i>Accept &amp; Get Link</button></div></div>`;
    }).join('') : '<div class="empty-state"><p>No affiliate offers available</p></div>';
    const myLinksHtml = S.myAffiliateLinks && S.myAffiliateLinks.length ? S.myAffiliateLinks.map(a => {
        const link = a.link || '';
        return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.85rem;margin-bottom:.6rem"><div style="font-weight:600">${a.courseTitle || 'Course'}</div><div class="ref-box mb-2" style="margin-top:.5rem"><span class="ref-link">${link}</span><button class="btn btn-primary btn-sm" onclick="copyToClipboard('${link.replace(/'/g, "\\'")}')"><i class="fas fa-copy"></i>Copy</button></div><div style="display:flex;gap:1rem;margin-top:.5rem;font-size:.75rem;color:var(--text3)"><span><i class="fas fa-mouse-pointer"></i> ${a.clicks || 0}</span><span><i class="fas fa-shopping-cart"></i> ${a.conversions || 0}</span><span><i class="fas fa-wallet"></i> Earned: ${fmtMoneyAPI(a.totalEarned || 0)}</span></div></div>`;
    }).join('') : '<div class="empty-state"><p>Accept affiliate offers to get links</p></div>';
    document.getElementById('affiliateOffers').innerHTML = offersHtml;
    document.getElementById('myAffiliateLinks').innerHTML = myLinksHtml;
    const stats = S.affiliateStats || { totalClicks: 0, totalConversions: 0, totalEarned: 0, linksCount: 0 };
    const statsRow =
        `<div class="col-6 col-md-3"><div class="stat-card"><div class="si si-v"><i class="fas fa-mouse-pointer"></i></div><div class="sv">${stats.totalClicks || 0}</div><div class="sl">Clicks</div></div></div><div class="col-6 col-md-3"><div class="stat-card"><div class="si si-c"><i class="fas fa-user-plus"></i></div><div class="sv">${stats.totalSignups || 0}</div><div class="sl">Signups</div></div></div><div class="col-6 col-md-3"><div class="stat-card"><div class="si si-g"><i class="fas fa-shopping-cart"></i></div><div class="sv">${stats.totalConversions || 0}</div><div class="sl">Conversions</div></div></div><div class="col-6 col-md-3"><div class="stat-card"><div class="si si-primary"><i class="fas fa-wallet"></i></div><div class="sv">${fmtMoneyAPI(stats.totalEarned || 0)}</div><div class="sl">Earned</div></div></div>`;
    document.getElementById('affStatsRow').innerHTML = statsRow;
    document.getElementById('navAffBadge').textContent = S.myAffiliateLinks?.length || 0;
    hideLoading();
}

function acceptAff(courseId) {
    const c = S.affiliateOffers.find(x => x._id === courseId);
    if (!c) return;
    const price = c.salePrice || c.price || 0;
    const percent = c.affiliatePercent || 0;
    const est = Math.round(price * percent / 100);
    document.getElementById('affiliateModalBody').innerHTML =
        `<div style="text-align:center"><h5>${c.title}</h5><p>Commission: ${percent}% per sale</p><p style="font-size:.82rem;color:var(--text3)">Est: ${fmtMoneyAPI(est)} per sale</p></div>`;
    document.getElementById('affiliateModal')._courseId = courseId;
    openModal('affiliateModal');
}

export async function acceptAffiliateOffer() {
    const courseId = document.getElementById('affiliateModal')?._courseId;
    const c = S.affiliateOffers.find(x => x._id === courseId);
    if (!c) return;
    const btn = document.querySelector('#affiliateModal .btn-violet');
    if (btn) { btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spin"></i> Accepting...'; }
    try {
        const res = await apiCall('/affiliate/accept', { method: 'POST', body: { courseId } });
        if (!res.success) throw new Error(res.message);
        const { link } = res.data;
        await refreshAffiliateData();
        closeModal('affiliateModal');
        toast(`✅ Affiliate link created!`, 'success');
        if (link) copyToClipboard(link);
    } catch (err) { toast(err.message || 'Error', 'error'); } finally { if (btn) { btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-handshake"></i>Accept &amp; Get Link'; } }
}

async function refreshAffiliateData() {
    try { const statsRes = await apiCall('/affiliate/stats'); if (statsRes.success) S.affiliateStats = statsRes
            .data; const linksRes = await apiCall('/affiliate/my-links'); if (linksRes.success) S
            .myAffiliateLinks = linksRes.data.links || []; if (S.dp === 'affiliates') renderAffiliates(); } catch (
        e) { console.warn('Could not refresh affiliate data:', e); }
}

// Expose to window
window.renderAffiliates = renderAffiliates;
window.acceptAffiliateOffer = acceptAffiliateOffer;
