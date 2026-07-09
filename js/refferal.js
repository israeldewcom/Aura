import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, copyToClipboard } from './utils.js';

export async function renderRefs() {
    const refCode = S.user?.referralCode || 'REF';
    const refLink = `${window.location.origin}/?ref=${refCode}`;
    document.getElementById('refLink').textContent = refLink;
    document.getElementById('refCode').textContent = refCode;
    try {
        const data = await apiCall('/users/referrals');
        const refs = Array.isArray(data.data?.referrals) ? data.data.referrals : (Array.isArray(data.data) ? data
            .data : []);
        S.referrals = refs;
        const totalEarned = refs.reduce((sum, r) => sum + (r.earned || 0), 0);
        document.getElementById('refStatsRow').innerHTML =
            `<div class="col-6 col-md-3"><div class="stat-card"><div class="si si-primary"><i class="fas fa-users"></i></div><div class="sv">${refs.length}</div><div class="sl">Total Refs</div></div></div><div class="col-6 col-md-3"><div class="stat-card"><div class="si si-c"><i class="fas fa-wallet"></i></div><div class="sv">${fmtMoneyAPI(totalEarned)}</div><div class="sl">Earned</div></div></div>`;
        document.getElementById('referralTable').innerHTML =
            `<thead><tr><th>Name</th><th>Date</th><th>Status</th><th>Earned</th></tr></thead><tbody>${refs.map(r => `<tr><td style="font-weight:600">${r.referred?.firstName || r.name || 'User'}</td><td>${new Date(r.createdAt || r.date).toLocaleDateString()}</td><td><span class="pstatus ${r.status === 'converted' ? 'ps-paid' : 'ps-pend'}">${r.status || 'pending'}</span></td><td style="font-weight:800;color:var(--primary)">${fmtMoneyAPI(r.earned || 0)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No referrals yet</td></tr>'}</tbody>`;
        const navRefBadge = document.getElementById('navRefBadge');
        if (navRefBadge) navRefBadge.textContent = refs.length;
    } catch (e) { document.getElementById('referralTable').innerHTML =
            '<tr><td colspan="4" style="text-align:center">Could not load referrals</td></tr>'; }
}

export function copyRefLink() { copyToClipboard(document.getElementById('refLink')?.textContent || ''); }

export function copyRefCode() { copyToClipboard(document.getElementById('refCode')?.textContent || ''); }

export function shareWhatsApp() {
    const refCode = S.user?.referralCode || 'REF';
    const link = `${window.location.origin}/?ref=${refCode}`;
    window.open(
        `https://wa.me/?text=${encodeURIComponent('🚀 Join ChangeX Academy and earn while you learn! Use my code: ' + refCode + ' ' + link)}`,
        '_blank');
}

export function shareOnSocial(p) { toast(`Shared on ${p}!`, 'success'); }

// Expose
window.copyRefLink = copyRefLink;
window.copyRefCode = copyRefCode;
window.shareWhatsApp = shareWhatsApp;
window.shareOnSocial = shareOnSocial;
