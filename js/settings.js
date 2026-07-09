import { S } from './state.js';
import { apiCall, toast, showLoading, hideLoading, getAvatarUrl } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal } from './ui.js';

export function initSettings() { updateUserUI();
    renderSubStatus();
    renderNotifSettings(); }

export function switchSet(id, el) {
    document.querySelectorAll('.set-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.set-sec').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
}

export async function saveProfile() {
    try {
        const body = {
            firstName: document.getElementById('setFirstName')?.value,
            lastName: document.getElementById('setLastName')?.value,
            phone: document.getElementById('setPhone')?.value,
            bio: document.getElementById('setBio')?.value,
            location: document.getElementById('setLocation')?.value
        };
        const data = await apiCall('/users/profile', { method: 'PUT', body });
        S.user = { ...S.user, ...(data.data || data) };
        localStorage.setItem('cx_user', JSON.stringify(S.user));
        import('./dashboard.js').then(({ updateUserUI }) => updateUserUI());
        toast('✅ Profile saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

export async function changePassword() {
    const curr = document.getElementById('secCurrentPw')?.value;
    const np = document.getElementById('secNewPw')?.value;
    const cp = document.getElementById('secConfirmPw')?.value;
    if (np !== cp) { toast('Passwords do not match', 'error'); return; }
    if (np.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    try {
        await apiCall('/auth/change-password', { method: 'PUT', body: { currentPassword: curr,
                newPassword: np } });
        toast('Password updated!', 'success');
        document.getElementById('secCurrentPw').value = '';
        document.getElementById('secNewPw').value = '';
        document.getElementById('secConfirmPw').value = '';
    } catch (e) { toast(e.message, 'error'); }
}

export function savePayoutSettings() {
    const bankName = document.getElementById('payoutBank')?.value;
    const accountNumber = document.getElementById('payoutAccNum')?.value.trim();
    const accountName = document.getElementById('payoutAccName')?.value.trim();
    if (!bankName || !accountNumber) { toast('Fill in bank name and account number', 'error'); return; }
    if (accountNumber.length !== 10) { toast('Account number must be 10 digits', 'error'); return; }
    const bankAccount = { bankName: bankName, accountNumber: accountNumber, accountName: accountName ||
            `${S.user.firstName || ''} ${S.user.lastName || ''}`.trim() };
    S.user.bankAccount = bankAccount;
    localStorage.setItem('cx_user', JSON.stringify(S.user));
    apiCall('/users/profile', { method: 'PUT', body: { bankAccount: bankAccount } }).then(() => {
        toast('✅ Bank details saved!', 'success');
        document.getElementById('payoutSaveStatus').innerHTML =
            '<span style="color:var(--success)">✅ Bank details saved successfully</span>';
        import('./payments.js').then(({ renderWallet }) => renderWallet());
    }).catch(err => { toast('Failed to save on server: ' + err.message, 'warning'); });
}

export function renderSubStatus() {
    const card = document.getElementById('subStatusCard');
    if (!card) return;
    if (S.isPremium) {
        const expiryDate = S.user?.subscriptionExpires;
        const daysLeft = expiryDate ? Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : '—';
        const isExpiring = daysLeft <= 7 && daysLeft > 0;
        card.innerHTML = `
                    <h5>👑 Premium Subscription</h5>
                    <div style="background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(20,184,166,.04));border:1px solid rgba(212,175,55,.2);border-radius:var(--radius-sm);padding:1rem;">
                        <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                            <div>
                                <span class="badge badge-premium"><i class="fas fa-crown"></i> Premium Active</span>
                                <p style="margin-top:.5rem;font-size:.82rem;color:var(--text2);">₦5,000/month · 80% revenue share · Unlimited uploads · No ads</p>
                                ${expiryDate ? `<p style="font-size:.78rem;color:${isExpiring ? 'var(--danger)' : 'var(--text3)'};">
                                    <strong>${isExpiring ? '⚠️ ' : ''}</strong>
                                    Expires in <strong>${daysLeft} days</strong>
                                    ${isExpiring && daysLeft <= 3 ? '— Renew now!' : ''}
                                </p>` : ''}
                            </div>
                            <div>
                                <button class="btn btn-danger btn-sm" onclick="cancelSubscription()">Cancel</button>
                                <button class="btn btn-primary btn-sm" onclick="openModal('premiumModal')"><i class="fas fa-sync"></i> Renew</button>
                            </div>
                        </div>
                    </div>
                `;
    } else {
        card.innerHTML = `
                    <h5>🔓 Free Plan</h5>
                    <div style="text-align:center;padding:1.5rem;">
                        <div style="font-size:2rem;">🔒</div>
                        <h5>Upgrade to Premium</h5>
                        <p style="color:var(--text3);font-size:.85rem;max-width:300px;margin:0 auto;">Create courses, earn affiliates, remove ads, and get 80% revenue share.</p>
                        <button class="btn btn-primary mt-3" onclick="openModal('premiumModal')"><i class="fas fa-crown"></i> Upgrade — ₦5,000/mo</button>
                    </div>
                `;
    }
}

export async function cancelSubscription() {
    if (!confirm(
            'Are you sure you want to cancel your Premium subscription? You\'ll lose access at the end of your billing period.'
            )) return;
    try { await apiCall('/payments/cancel-subscription', { method: 'POST' });
        toast('Subscription cancelled. Access remains until end of period.', 'info'); } catch (e) { toast(e
            .message, 'error'); }
}

export function renderNotifSettings() {
    const items = ['Course Approvals', 'New Affiliate Offers', 'Referral Conversions', 'Q&A Replies',
        'Admin Announcements'
    ];
    document.getElementById('notifSettingsList').innerHTML = items.map(item =>
        `<div class="d-flex items-center justify-between p-3" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:.3rem"><div style="font-size:.83rem;font-weight:600">${item}</div><input type="checkbox" checked style="accent-color:var(--primary);width:15px;height:15px;cursor:pointer"/></div>`
        ).join('');
}

export async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('cx_accessToken');
    try {
        showLoading('Uploading avatar...');
        const res = await fetch(`${API_BASE}/users/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
            body: formData, credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            const avatarUrl = data.data?.avatar || data.data?.url;
            S.user.avatarUrl = avatarUrl;
            S.user.avatar = avatarUrl;
            localStorage.setItem('cx_user', JSON.stringify(S.user));
            import('./dashboard.js').then(({ updateUserUI }) => updateUserUI());
            toast('Avatar updated! 🎉', 'success');
        } else throw new Error(data.message || 'Upload failed');
    } catch (e) { toast(e.message || 'Failed to upload avatar', 'error'); } finally { hideLoading();
        input.value = ''; }
}

function updateUserUI() {
    import('./dashboard.js').then(({ updateUserUI }) => updateUserUI());
}

const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';

// Expose
window.switchSet = switchSet;
window.saveProfile = saveProfile;
window.changePassword = changePassword;
window.savePayoutSettings = savePayoutSettings;
window.cancelSubscription = cancelSubscription;
window.uploadAvatar = uploadAvatar;
