import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui.js';

export function switchSponsorTab(tab, btn) {
    document.querySelectorAll('#dash-sponsorship .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#dash-sponsorship .sponsor-tab').forEach(t => t.style.display = 'none');
    if (btn) btn.classList.add('active');
    document.getElementById('sponsor-' + tab).style.display = 'block';
    S.sponsorTab = tab;
    if (tab === 'campaigns') loadMyCampaigns();
    if (tab === 'sponsorships') loadMySponsorships();
    if (tab === 'dashboard') loadCampaignAnalytics();
}

// ─── CAMPAIGNS ──────────────────────────────────────────────────────────

export async function loadMyCampaigns() {
    showLoading('Loading campaigns...');
    try {
        const res = await apiCall('/campaigns/my');
        S.myCampaigns = res.data || [];
        const container = document.getElementById('campaignsList');
        if (!container) return;
        if (!S.myCampaigns.length) {
            container.innerHTML =
                '<div class="empty-state"><i class="fas fa-ad"></i><p>No campaigns yet. Create your first ad campaign!</p><button class="btn btn-primary btn-sm mt-3" onclick="openModal(\'campaignModal\')"><i class="fas fa-plus"></i> Create Campaign</button></div>';
            return;
        }
        container.innerHTML = S.myCampaigns.map(c => {
            const statusClass = c.status === 'active' ? 'badge-success' :
                c.status === 'pending' ? 'badge-gold' :
                c.status === 'approved' && c.paymentStatus === 'pending' ? 'badge-gold' :
                c.status === 'rejected' ? 'badge-danger' : 'badge-dark';
            const isPaused = c.status === 'paused';
            const needsPayment = c.status === 'approved' && c.paymentStatus === 'pending';
            const ctr = c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(2) : 0;
            return `
                            <div class="card card-p mb-2" data-campaign-id="${c._id}">
                                <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                                    <div>
                                        <strong>${escapeHtml(c.title)}</strong>
                                        <span class="badge ${statusClass}">${c.status}${c.paymentStatus === 'paid' ? ' 💰' : ''}</span>
                                        <br>
                                        <small style="color:var(--text3);">
                                            <span><i class="fas fa-eye"></i> ${c.impressions || 0} impressions</span>
                                            <span style="margin-left:.75rem;"><i class="fas fa-mouse-pointer"></i> ${c.clicks || 0} clicks</span>
                                            <span style="margin-left:.75rem;"><i class="fas fa-wallet"></i> ₦${(c.totalDeducted || 0).toLocaleString()} spent</span>
                                            <span style="margin-left:.75rem;">CTR: ${ctr}%</span>
                                            <span style="margin-left:.75rem;">📅 ${new Date(c.startDate).toLocaleDateString()} → ${new Date(c.endDate).toLocaleDateString()}</span>
                                        </small>
                                        ${c.rejectionReason ? `<div style="font-size:.75rem;color:var(--danger);">Reason: ${escapeHtml(c.rejectionReason)}</div>` : ''}
                                        ${c.escrowBalance !== undefined ? `<div style="font-size:.75rem;color:var(--gold);">💰 Remaining: ${fmtMoneyAPI(c.escrowBalance || 0)}</div>` : ''}
                                    </div>
                                    <div style="display:flex;gap:.3rem;flex-wrap:wrap;">
                                        ${needsPayment ? `
                                            <button class="campaign-pay-btn" onclick="payCampaign('${c._id}')"><i class="fas fa-credit-card"></i> Pay ₦${c.budget.toLocaleString()}</button>
                                            <button class="btn btn-ghost btn-sm" onclick="openCampaignManualPayment('${c._id}')"><i class="fas fa-university"></i> Bank Transfer</button>
                                        ` : ''}
                                        ${c.status === 'active' || c.status === 'paused' ? `
                                            <button class="btn btn-${isPaused ? 'success' : 'warning'} btn-sm" onclick="toggleCampaign('${c._id}', ${isPaused})">
                                                <i class="fas fa-${isPaused ? 'play' : 'pause'}"></i> ${isPaused ? 'Resume' : 'Pause'}
                                            </button>
                                        ` : ''}
                                        ${c.status === 'active' || c.status === 'completed' ? `
                                            <button class="btn btn-ghost btn-sm" onclick="viewCampaignStats('${c._id}')"><i class="fas fa-chart-line"></i> Stats</button>
                                            ${c.escrowBalance > 0 ? `<button class="btn btn-ghost btn-sm" onclick="topUpCampaign('${c._id}')"><i class="fas fa-plus-circle"></i> Top Up</button>` : ''}
                                        ` : ''}
                                        ${c.status !== 'active' && c.status !== 'completed' ? `
                                            <button class="btn btn-danger btn-sm" onclick="deleteCampaign('${c._id}')"><i class="fas fa-trash"></i></button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('');
    } catch (err) { toast('Failed to load campaigns: ' + err.message, 'error'); } finally { hideLoading(); }
}

export async function toggleCampaign(campaignId, pause) {
    try {
        await apiCall(`/campaigns/${campaignId}/toggle`, {
            method: 'PUT',
            body: { pause }
        });
        toast(pause ? 'Campaign paused' : 'Campaign resumed', 'success');
        loadMyCampaigns();
    } catch (err) { toast(err.message, 'error'); }
}

export async function deleteCampaign(campaignId) {
    if (!confirm('Delete this campaign? This action cannot be undone.')) return;
    try {
        await apiCall(`/campaigns/${campaignId}`, { method: 'DELETE' });
        toast('Campaign deleted', 'success');
        loadMyCampaigns();
    } catch (err) { toast(err.message, 'error'); }
}

export async function topUpCampaign(campaignId) {
    const amount = prompt('Enter amount to top up (₦):', '5000');
    if (!amount) return;
    if (isNaN(amount) || parseFloat(amount) < 1000) { toast('Minimum top-up is ₦1,000', 'error'); return; }
    try {
        const res = await apiCall(`/campaigns/${campaignId}/topup`, { method: 'POST', body: { amount: parseFloat(
                    amount) } });
        if (res.data.paymentUrl) {
            window.location.href = res.data.paymentUrl;
        } else {
            toast('Could not initiate top-up.', 'error');
        }
    } catch (err) { toast(err.message, 'error'); }
}

export async function viewCampaignStats(campaignId) {
    showLoading('Loading stats...');
    try {
        const res = await apiCall(`/campaigns/${campaignId}/stats`);
        const data = res.data;
        const summary = data.summary;
        const dailyAnalytics = data.dailyAnalytics || [];

        const content = document.getElementById('userDetailsContent');
        if (!content) return;

        const ctr = summary.ctr || 0;
        content.innerHTML = `
                    <div class="campaign-stats-grid">
                        <div class="campaign-stat-card"><div class="cs-value">${summary.totalImpressions.toLocaleString()}</div><div class="cs-label">Impressions</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${summary.totalClicks.toLocaleString()}</div><div class="cs-label">Clicks</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${summary.totalViews.toLocaleString()}</div><div class="cs-label">Views</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${ctr}%</div><div class="cs-label">CTR</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${summary.totalConversions || 0}</div><div class="cs-label">Conversions</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${fmtMoneyAPI(summary.spent)}</div><div class="cs-label">Spent</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${fmtMoneyAPI(summary.escrowBalance)}</div><div class="cs-label">Remaining</div></div>
                        <div class="campaign-stat-card"><div class="cs-value">${summary.budget ? fmtMoneyAPI(summary.budget) : '—'}</div><div class="cs-label">Budget</div></div>
                    </div>
                    <div style="margin-top:1rem;">
                        <h6>Daily Performance</h6>
                        ${dailyAnalytics.length ? `
                            <div class="mini-chart" style="height:150px;align-items:flex-end;gap:2px;">
                                ${dailyAnalytics.map(d => {
                                    const maxVal = Math.max(...dailyAnalytics.map(x => x.impressions || 0), 1);
                                    const height = ((d.impressions || 0) / maxVal) * 100;
                                    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;"><div style="width:100%;background:rgba(212,175,55,.3);height:${height}%;border-radius:2px 2px 0 0;min-height:2px;"></div><span style="font-size:.45rem;color:var(--text3);">${new Date(d.date).getDate()}</span></div>`;
                                }).join('')}
                            </div>
                            <div style="display:flex;gap:.75rem;font-size:.7rem;color:var(--text3);margin-top:.5rem;flex-wrap:wrap;">
                                <span>📊 Bar height = daily impressions</span>
                            </div>
                        ` : '<p style="color:var(--text3);font-size:.8rem;">No daily data yet</p>'}
                        ${summary.fraudScore !== undefined ? `<div style="font-size:.75rem;color:var(--text3);margin-top:.5rem;">🛡️ Fraud Score: ${summary.fraudScore}/100</div>` : ''}
                        ${summary.invalidImpressions !== undefined ? `<div style="font-size:.75rem;color:var(--text3);">🚫 Invalid Impressions: ${summary.invalidImpressions}</div>` : ''}
                    </div>
                `;
        document.querySelector('#userDetailsModal .modal-hd h5').textContent = `📊 Campaign: ${data.campaign.title}`;
        openModal('userDetailsModal');
    } catch (err) { toast('Failed to load stats: ' + err.message, 'error'); } finally { hideLoading(); }
}

export async function payCampaign(campaignId) {
    try {
        const res = await apiCall('/campaigns/pay', {
            method: 'POST',
            body: { campaignId }
        });
        if (res.data.paymentUrl) {
            window.location.href = res.data.paymentUrl;
        } else {
            toast('Could not initiate payment.', 'error');
        }
    } catch (err) { toast(err.message, 'error'); }
}

export function openCampaignManualPayment(campaignId) {
    document.getElementById('campaignManualModal')._campaignId = campaignId;
    import('./payments.js').then(({ populateAllBankDetailsBoxes }) => populateAllBankDetailsBoxes());
    document.getElementById('campaignManualRef').value = '';
    document.getElementById('campaignManualDate').value = '';
    document.getElementById('campaignManualReceipt').value = '';
    document.getElementById('campaignReceiptPreview').style.display = 'none';
    openModal('campaignManualModal');
}

export async function submitCampaignManualPayment() {
    const campaignId = document.getElementById('campaignManualModal')._campaignId;
    const reference = document.getElementById('campaignManualRef').value.trim();
    const paymentDate = document.getElementById('campaignManualDate').value;
    const receiptFile = document.getElementById('campaignManualReceipt').files[0];

    if (!campaignId) { toast('No campaign selected', 'error'); return; }
    if (!reference) { toast('Enter transaction reference', 'error'); return; }
    if (!paymentDate) { toast('Select payment date', 'error'); return; }
    if (!receiptFile) { toast('Upload receipt', 'error'); return; }

    const formData = new FormData();
    formData.append('campaignId', campaignId);
    formData.append('reference', reference);
    formData.append('paymentDate', paymentDate);
    formData.append('receipt', receiptFile);

    showLoading('Submitting manual payment...');
    try {
        const token = localStorage.getItem('cx_accessToken');
        const res = await fetch(`${API_BASE}/campaigns/manual-pay`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            toast('✅ Manual payment submitted for review!', 'success');
            closeModal('campaignManualModal');
            loadMyCampaigns();
        } else {
            toast(data.message || 'Submission failed', 'error');
        }
    } catch (err) {
        toast('Error: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

export function toggleCampaignPricing() {
    const pricing = document.getElementById('campaignPricing').value;
    document.getElementById('campaignCpmFields').style.display = pricing === 'cpm' ? 'flex' : 'none';
    document.getElementById('campaignCpcFields').style.display = pricing === 'cpc' ? 'flex' : 'none';
}

export function previewCampaignImage(input) {
    const preview = document.getElementById('campaignImagePreview');
    const img = document.getElementById('campaignImagePreviewImg');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

export async function submitCampaign() {
    const title = document.getElementById('campaignTitle').value.trim();
    const description = document.getElementById('campaignDesc').value.trim();
    const linkUrl = document.getElementById('campaignLink').value.trim();
    const placement = document.getElementById('campaignPlacement').value;
    const budget = parseFloat(document.getElementById('campaignBudget').value);
    const pricing = document.getElementById('campaignPricing').value;
    const cpm = parseFloat(document.getElementById('campaignCpm').value) || 1.00;
    const cpc = parseFloat(document.getElementById('campaignCpc').value) || 0.02;
    const targetImp = parseInt(document.getElementById('campaignTargetImp').value) || 0;
    const targetClick = parseInt(document.getElementById('campaignTargetClick').value) || 0;
    const startDate = document.getElementById('campaignStart').value;
    const endDate = document.getElementById('campaignEnd').value;
    const imageFile = document.getElementById('campaignImage').files[0];

    if (!title || !description || !linkUrl || !budget || !startDate || !endDate || !imageFile) {
        toast('Please fill all required fields', 'error');
        return;
    }
    if (budget < 1000) { toast('Minimum budget is ₦1,000', 'error'); return; }
    if (new Date(startDate) >= new Date(endDate)) { toast('End date must be after start date', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('linkUrl', linkUrl);
    formData.append('placement', placement);
    formData.append('budget', budget);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);
    formData.append('cpm', cpm);
    formData.append('cpc', cpc);
    formData.append('targetImpressions', targetImp);
    formData.append('targetClicks', targetClick);
    formData.append('image', imageFile);

    showLoading('Submitting campaign...');
    try {
        const token = localStorage.getItem('cx_accessToken');
        const res = await fetch(`${API_BASE}/campaigns/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            toast('✅ Campaign submitted for admin approval!', 'success');
            closeModal('campaignModal');
            loadMyCampaigns();
            document.getElementById('campaignImagePreview').style.display = 'none';
            document.getElementById('campaignImage').value = '';
        } else {
            toast(data.message || 'Submission failed', 'error');
        }
    } catch (err) { toast('Error: ' + err.message, 'error'); } finally { hideLoading(); }
}

// ─── SPONSORSHIPS ───────────────────────────────────────────────────────

export async function loadMySponsorships() {
    showLoading('Loading sponsorships...');
    try {
        const res = await apiCall('/sponsorships/my');
        S.mySponsorships = res.data || [];
        const container = document.getElementById('sponsorshipsList');
        if (!container) return;
        if (!S.mySponsorships.length) {
            container.innerHTML =
                '<div class="empty-state"><i class="fas fa-handshake"></i><p>No sponsorships yet. Support us today!</p><button class="btn btn-primary btn-sm mt-3" onclick="openModal(\'sponsorshipModal\')"><i class="fas fa-plus"></i> Sponsor Us</button></div>';
            return;
        }
        container.innerHTML = S.mySponsorships.map(s => {
            const statusClass = s.status === 'approved' ? 'badge-success' :
                s.status === 'pending' ? 'badge-gold' :
                s.status === 'rejected' ? 'badge-danger' : 'badge-dark';
            const typeClass = s.type === 'donation' ? 'donation' :
                s.type === 'partnership' ? 'partnership' :
                s.type === 'collaboration' ? 'collaboration' :
                s.type === 'brand' ? 'brand' : 'media';
            return `
                            <div class="card card-p mb-2">
                                <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                                    <div>
                                        <span class="sponsorship-type-badge ${typeClass}">${s.type}</span>
                                        <span class="badge ${statusClass}">${s.status}</span>
                                        <br>
                                        <small style="color:var(--text3);">
                                            Amount: ${fmtMoneyAPI(s.amount)} · 
                                            ${new Date(s.createdAt).toLocaleDateString()}
                                            ${s.adminNote ? `· Note: ${escapeHtml(s.adminNote)}` : ''}
                                        </small>
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('');
    } catch (err) { toast('Failed to load sponsorships: ' + err.message, 'error'); } finally { hideLoading(); }
}

export async function submitSponsorship() {
    const type = document.getElementById('sponsorshipType').value;
    const amount = parseFloat(document.getElementById('sponsorshipAmount').value);
    const message = document.getElementById('sponsorshipMessage').value.trim();
    const companyName = document.getElementById('sponsorshipCompany').value.trim();
    const website = document.getElementById('sponsorshipWebsite').value.trim();
    const phone = document.getElementById('sponsorshipPhone').value.trim();
    const receiptFile = document.getElementById('sponsorshipReceipt').files[0];

    if (!type || !amount || !message) {
        toast('Please fill all required fields', 'error');
        return;
    }

    let receiptUrl = '';
    if (receiptFile) {
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        try {
            const token = localStorage.getItem('cx_accessToken');
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) receiptUrl = data.data.url;
        } catch (err) { toast('Receipt upload failed', 'error'); }
    }

    try {
        const res = await apiCall('/sponsorships/submit', {
            method: 'POST',
            body: { type, amount, message, companyName, website, phone, receiptUrl }
        });
        if (res.success) {
            toast('✅ Sponsorship submitted! Thank you for your support!', 'success');
            closeModal('sponsorshipModal');
            loadMySponsorships();
        } else {
            toast(res.message || 'Submission failed', 'error');
        }
    } catch (err) { toast('Error: ' + err.message, 'error'); }
}

// ─── ANALYTICS ──────────────────────────────────────────────────────────

export async function loadCampaignAnalytics() {
    const container = document.getElementById('campaignAnalyticsContainer');
    if (!container) return;
    try {
        const res = await apiCall('/campaigns/my');
        const campaigns = res.data || [];
        if (!campaigns.length) {
            container.innerHTML =
                '<div class="empty-state"><i class="fas fa-chart-line"></i><p>No campaigns to analyze. Create your first campaign!</p></div>';
            return;
        }
        let html = `<div class="row">`;
        campaigns.forEach(c => {
            const ctr = c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(2) : 0;
            html += `
                            <div class="col-12 col-md-6 col-lg-4">
                                <div class="card card-p" onclick="viewCampaignStats('${c._id}')" style="cursor:pointer;">
                                    <div style="font-weight:700;font-size:.9rem;">${escapeHtml(c.title)}</div>
                                    <div class="campaign-stats-grid" style="grid-template-columns:1fr 1fr;gap:.3rem;margin-top:.5rem;">
                                        <div><span style="color:var(--text3);font-size:.6rem;">Impressions</span><br><strong>${c.impressions || 0}</strong></div>
                                        <div><span style="color:var(--text3);font-size:.6rem;">Clicks</span><br><strong>${c.clicks || 0}</strong></div>
                                        <div><span style="color:var(--text3);font-size:.6rem;">CTR</span><br><strong>${ctr}%</strong></div>
                                        <div><span style="color:var(--text3);font-size:.6rem;">Spent</span><br><strong>${fmtMoneyAPI(c.totalDeducted || 0)}</strong></div>
                                    </div>
                                    <span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-gold'}" style="font-size:.55rem;">${c.status}</span>
                                </div>
                            </div>
                        `;
        });
        html += `</div>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load analytics</p></div>';
    }
}

const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';

// ─── EXPOSE ─────────────────────────────────────────────────────────────

window.switchSponsorTab = switchSponsorTab;
window.toggleCampaign = toggleCampaign;
window.deleteCampaign = deleteCampaign;
window.topUpCampaign = topUpCampaign;
window.viewCampaignStats = viewCampaignStats;
window.payCampaign = payCampaign;
window.openCampaignManualPayment = openCampaignManualPayment;
window.submitCampaignManualPayment = submitCampaignManualPayment;
window.toggleCampaignPricing = toggleCampaignPricing;
window.previewCampaignImage = previewCampaignImage;
window.submitCampaign = submitCampaign;
window.submitSponsorship = submitSponsorship;
