import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, copyToClipboard } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal, closeModal } from './ui.js';
import { PLATFORM_BANK_DETAILS, PAYSTACK_PUBLIC_KEY, API_BASE } from './config.js';

// ─── WALLET ─────────────────────────────────────────────────────────────

export async function renderWallet() {
    try {
        const walletData = await apiCall('/users/wallet');
        const wallet = walletData.data || walletData;
        S.walletBal = wallet.balance || wallet.walletBalance || 0;
        S.user.walletBalance = S.walletBal;
        S.user.pendingWithdrawal = wallet.pending || 0;
        const breakdown = wallet.earningsBreakdown || {};
        localStorage.setItem('cx_user', JSON.stringify(S.user));

        document.getElementById('walletBal').textContent = fmtMoneyAPI(S.walletBal);
        document.getElementById('withdrawBal').textContent = fmtMoneyAPI(S.walletBal);
        document.getElementById('tbWallet').textContent = fmtMoneyAPI(S.walletBal);

        const pending = S.user?.pendingWithdrawal || 0;
        document.getElementById('walletWeekChange').innerHTML = pending > 0 ?
            `<span style="color:var(--gold)">Pending: ${fmtMoneyAPI(pending)}</span>` : '+₦0 this week';

        let breakdownHtml = `
                    <div class="web-row"><span>Referral Earnings</span><span style="color:var(--primary);font-weight:700">${fmtMoneyAPI(breakdown.referralEarnings || 0)}</span></div>
                    <div class="web-row"><span>Course Bonuses</span><span style="color:var(--accent);font-weight:700">${fmtMoneyAPI(breakdown.courseBonuses || 0)}</span></div>
                    <div class="web-row"><span>Affiliate Commissions</span><span style="color:var(--violet);font-weight:700">${fmtMoneyAPI(breakdown.affiliateCommissions || 0)}</span></div>
                    <div class="web-row"><span>Instructor Earnings</span><span style="color:var(--gold);font-weight:700">${fmtMoneyAPI(breakdown.instructorEarnings || 0)}</span></div>
                    <div class="web-row"><span>Welcome Bonus</span><span style="color:var(--lime);font-weight:700">${fmtMoneyAPI(breakdown.welcomeBonus || 0)}</span></div>
                    <div class="web-row"><span>Book Earnings</span><span style="color:var(--cyan);font-weight:700">${fmtMoneyAPI(breakdown.bookEarnings || 0)}</span></div>
                    <div class="web-row"><span>Ad Revenue</span><span style="color:var(--gold);font-weight:700">${fmtMoneyAPI(breakdown.adRevenue || 0)}</span></div>
                    <div class="web-row"><span>Campaign Revenue</span><span style="color:var(--orange);font-weight:700">${fmtMoneyAPI(breakdown.campaignRevenue || 0)}</span></div>
                    <div class="web-row" style="border-top:2px solid var(--border);font-weight:800;font-size:.9rem"><span>Total Earnings</span><span style="color:var(--lime)">${fmtMoneyAPI(breakdown.totalEarnings || 0)}</span></div>
                `;

        try {
            const socialEarnings = await apiCall('/posts/my/social-earnings');
            const socialEarned = socialEarnings.data?.totalEarnings || 0;
            breakdownHtml += `
                            <div class="web-row"><span>🌱 Social Earnings</span><span style="color:var(--cyan);font-weight:700">${fmtMoneyAPI(socialEarned)}</span></div>
                        `;
            S.socialTotalEarnings = socialEarned;
        } catch (e) {}

        document.getElementById('walletBreakdown').innerHTML = breakdownHtml;

        document.getElementById('walletStatsRow').innerHTML =
            `<div class="col-6"><div class="stat-card"><div class="si si-primary"><i class="fas fa-users"></i></div><div class="sv">${fmtMoneyAPI(breakdown.referralEarnings || 0)}</div><div class="sl">Referral Earnings</div></div></div><div class="col-6"><div class="stat-card"><div class="si si-v"><i class="fas fa-handshake"></i></div><div class="sv">${fmtMoneyAPI(breakdown.affiliateCommissions || 0)}</div><div class="sl">Affiliate Earned</div></div></div>`;

        await loadTransactions();
        renderTxTable();

        await checkManualPaymentStatus();

        try {
            const payoutData = await apiCall('/payments/methods');
            const banks = Array.isArray(payoutData.data?.bankAccounts) ? payoutData.data.bankAccounts : [];
            const bankSelect = document.getElementById('withdrawBank');
            if (bankSelect && banks.length) bankSelect.innerHTML = banks.map(b =>
                `<option value="${b._id || b.accountNumber}">${b.bankName} - ${b.accountNumber}</option>`
                ).join('');
        } catch (e) {}
        import('./social-earnings.js').then(({ updateSocialBadge }) => updateSocialBadge());
    } catch (e) { console.warn('Wallet render error:', e); }
}

export async function loadTransactions() {
    try { const data = await apiCall('/payments/transactions?limit=50');
        S.transactions = Array.isArray(data.data) ? data.data : []; } catch (e) { S.transactions = []; }
}

export function renderTxTable(filterType) {
    const filtered = filterType && filterType !== 'All' ? S.transactions.filter(t => t.type?.toLowerCase() ===
        filterType.toLowerCase()) : S.transactions;
    document.getElementById('txTable').innerHTML =
        `<thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${filtered.map(tx => { const amount = tx.amount || 0; const isPositive = amount >= 0; return `<tr><td style="font-size:.74rem;color:var(--text3)">${new Date(tx.createdAt).toLocaleDateString()}</td><td><span class="badge badge-dark" style="font-size:.6rem">${tx.type || '—'}</span></td><td style="font-size:.78rem">${tx.description || ''}</td><td style="font-weight:800;color:${isPositive ? 'var(--success)' : 'var(--danger)'}">${fmtMoneyAPI(amount)}</td><td><span class="pstatus ${tx.status === 'completed' ? 'ps-paid' : 'ps-pend'}">${tx.status || 'pending'}</span></td></tr>`; }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">No transactions</td></tr>'}</tbody>`;
}

export function filterTx(type) { renderTxTable(type); }

export function openWithdrawModal() {
    const hasBankDetails = S.user?.bankAccount?.accountNumber && S.user.bankAccount.accountNumber.length === 10;
    const warningEl = document.getElementById('withdrawBankWarning');
    const submitBtn = document.getElementById('withdrawSubmitBtn');
    if (!hasBankDetails) { if (warningEl) warningEl.style.display = 'block'; if (submitBtn) submitBtn.disabled =
            true; } else { if (warningEl) warningEl.style.display = 'none'; if (submitBtn) submitBtn.disabled =
            false; }
    document.getElementById('withdrawBal').textContent = fmtMoneyAPI(S.walletBal);
    openModal('withdrawModal');
}

export async function processWithdraw() {
    const hasBankDetails = S.user?.bankAccount?.accountNumber && S.user.bankAccount.accountNumber.length === 10;
    if (!hasBankDetails) {
        toast('⚠️ Add bank details in Settings → Payouts first.', 'error');
        closeModal('withdrawModal');
        setDP('settings');
        setTimeout(() => import('./settings.js').then(({ switchSet }) => switchSet('ss-payout', null)), 100);
        return;
    }
    const amt = Number(document.getElementById('withdrawAmt')?.value);
    if (!amt || amt < 5000) { toast('Minimum withdrawal is ₦5,000', 'error'); return; }
    if (amt > S.walletBal) { toast('Insufficient balance', 'error'); return; }
    closeModal('withdrawModal');
    showLoading('Processing...');
    try {
        await apiCall('/payments/withdraw', { method: 'POST', body: { amount: amt } });
        toast('💸 Withdrawal submitted! (10% fee applied)', 'success');
        await renderWallet();
    } catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
}

// ─── PAYSTACK PAYMENTS ─────────────────────────────────────────────────

export async function processPayment() {
    const type = window.currentPaymentType || 'course';
    let item, id, amount;
    if (type === 'course') {
        item = S.currentBuyCourse;
        if (!item) return;
        id = item._id;
        amount = item.salePrice || item.price || 0;
    } else if (type === 'book') {
        item = S.currentBuyBook;
        if (!item) return;
        id = item._id;
        amount = item.price || 0;
    } else { toast('Invalid payment type', 'error'); return; }
    const email = S.user?.email;
    if (!email) { toast('Please log in to purchase', 'error'); return; }
    showLoading('Preparing payment...');
    try {
        let code = getAffiliateCodeFromCookie();
        const manualCode = document.getElementById('buyRefCode')?.value.trim();
        if (manualCode) code = manualCode;
        const metadata = { type, [`${type}Id`]: id, userId: S.user._id, affiliateCode: code || undefined,
            referralCode: code || undefined };
        const paymentIntent = await apiCall('/payments/initialize-paystack', { method: 'POST',
            body: { email, amount, currency: 'NGN', metadata } });
        const { reference, amount: paystackAmount } = paymentIntent.data;
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email,
            amount: paystackAmount,
            currency: 'NGN',
            ref: reference,
            metadata: { custom_fields: [{ display_name: type.charAt(0).toUpperCase() + type.slice(1),
                    variable_name: type, value: item.title }, { display_name: 'User ID',
                    variable_name: 'user_id', value: S.user._id }] },
            callback: async (response) => {
                const verify = await apiCall('/payments/verify-transaction', { method: 'POST',
                    body: { reference: response.reference, type, courseId: type === 'course' ?
                            id : undefined, bookId: type === 'book' ? id : undefined } });
                if (verify.success) {
                    toast('✅ Payment successful!', 'success');
                    closeModal('buyCourseModal');
                    await renderWallet();
                    if (type === 'course') {
                        await import('./courses.js').then(({ loadEnrollments, renderCourseGrid }) => {
                            loadEnrollments();
                            if (S.dp === 'courses') renderCourseGrid(S.courseFilter);
                            else if (S.dp === 'explore') import('./courses.js').then(({ renderExplore }) =>
                                renderExplore());
                            else setDP('courses');
                        });
                    } else if (type === 'book') {
                        if (S.currentBook) { S.currentBook.isPurchased = true; if (S.dp ===
                                'book-detail') { import('./books.js').then(({ renderBookDetail }) =>
                                renderBookDetail(S.currentBook)); } }
                        await import('./books.js').then(({ loadBooks }) => loadBooks());
                        setDP('books');
                    }
                    renderWallet();
                } else { toast('Verification failed.', 'error'); }
            },
            onClose: () => { toast('Payment cancelled', 'warning'); }
        });
        handler.openIframe();
    } catch (err) { toast('Payment failed: ' + err.message, 'error'); } finally { hideLoading(); }
}

function getAffiliateCodeFromCookie() {
    const match = document.cookie.match(/(?:^|; )affiliate_code=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export async function doPremiumPaystack() {
    const referralCode = document.getElementById('premReferralCode')?.value.trim() || '';
    const btn = document.querySelector('#premiumModal .paystack-btn');
    if (btn) { btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spin"></i> Processing...'; }
    showLoading('Redirecting to payment...');
    try {
        const res = await apiCall('/payments/subscribe', { method: 'POST', body: { plan: 'premium',
                paymentMethod: 'paystack', referralCode } });
        if (res.data?.paymentUrl) { window.location.href = res.data.paymentUrl; } else { toast(
                'Could not initiate payment.', 'error');
            hideLoading(); }
    } catch (e) { toast('Payment error: ' + e.message, 'error');
        hideLoading(); } finally { if (btn) { btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-lock"></i> Pay ₦5,000 with Paystack'; } }
}

export function applyPremReferralCode(val) {
    const st = document.getElementById('premRefCodeStatus');
    if (!st) return;
    if (val.length > 3) {
        st.textContent = '✅ Referral code will be applied — referrer gets ₦500 bonus';
        st.className = 'prem-referral-status success';
    } else if (val.length > 0) {
        st.textContent = '🔍 Checking referral code...';
        st.className = 'prem-referral-status info';
    } else {
        st.textContent = 'Enter a referral code to get ₦500 bonus for the referrer';
        st.className = 'prem-referral-status';
    }
}

// ─── MANUAL PAYMENTS ────────────────────────────────────────────────────

export function toggleBuyPaymentMethod(method, btn) {
    const container = btn.closest('.modal-bd');
    const cardSection = container?.querySelector('#buyCardSection');
    const manualSection = container?.querySelector('#buyManualSection');
    const btns = container?.querySelectorAll('.payment-method-tab');
    if (btns) btns.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (cardSection) cardSection.style.display = method === 'card' ? 'block' : 'none';
    if (manualSection) manualSection.style.display = method === 'manual' ? 'block' : 'none';
    if (method === 'manual') populateAllBankDetailsBoxes();
}

export function togglePremPaymentMethod(method, btn) {
    const container = btn.closest('.modal-bd');
    const cardSection = container?.querySelector('#premCardSection');
    const manualSection = container?.querySelector('#premManualSection');
    const btns = container?.querySelectorAll('.payment-method-tab');
    if (btns) btns.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (cardSection) cardSection.style.display = method === 'card' ? 'block' : 'none';
    if (manualSection) manualSection.style.display = method === 'manual' ? 'block' : 'none';
    if (method === 'manual') populateAllBankDetailsBoxes();
}

export function toggleWizPaymentMethod(method, btn) {
    const container = btn.closest('div');
    const cardSection = document.getElementById('wizCardPayment');
    const manualSection = document.getElementById('wizManualPayment');
    const btns = container?.querySelectorAll('.payment-method-tab');
    if (btns) btns.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (cardSection) cardSection.style.display = method === 'card' ? 'block' : 'none';
    if (manualSection) manualSection.style.display = method === 'manual' ? 'block' : 'none';
    if (method === 'manual') populateAllBankDetailsBoxes();
}

export function previewReceipt(input) {
    const preview = document.getElementById('receiptPreview');
    const previewImg = document.getElementById('receiptPreviewImg');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { if (previewImg) previewImg.src = e.target.result; if (preview) preview.style
                .display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    }
}

export function populateAllBankDetailsBoxes() {
    ['buyBankDetailsBox', 'premBankDetailsBox', 'wizBankDetailsBox', 'campaignBankDetailsBox'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = renderBankDetailsHTML(id !== 'wizBankDetailsBox' && id !== 'campaignBankDetailsBox');
    });
}

function renderBankDetailsHTML(includeCopyBtn = true) {
    let html =
        `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.65rem"><i class="fas fa-university" style="color:var(--cyan);font-size:1.1rem"></i><strong style="font-size:.85rem;color:var(--cyan)">Bank Transfer Details</strong></div>`;
    PLATFORM_BANK_DETAILS.forEach((bank, index) => {
        const copyBtn = includeCopyBtn ?
            `<button class="btn btn-ghost btn-sm mt-1" onclick="copyToClipboard('${bank.accountNumber}')" style="width:100%"><i class="fas fa-copy"></i> Copy Account Number</button>` :
            '';
        html += `
                <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.85rem;margin-bottom:.85rem;">
                    <div style="font-weight:700;font-size:.85rem;color:var(--primary)">Option ${index + 1}: ${bank.bankName}</div>
                    ${bank.note ? `<div style="font-size:.72rem;color:var(--text3);margin-bottom:.4rem">${bank.note}</div>` : ''}
                    <div class="bank-detail-row"><span style="color:var(--text3)">Bank:</span><strong>${bank.bankName}</strong></div>
                    <div class="bank-detail-row"><span style="color:var(--text3)">Account Name:</span><strong>${bank.accountName}</strong></div>
                    <div class="bank-detail-row"><span style="color:var(--text3)">Account Number:</span><strong style="color:var(--lime);font-family:var(--font-mono);font-size:1rem">${bank.accountNumber}</strong></div>
                    ${bank.routing ? `<div class="bank-detail-row"><span style="color:var(--text3)">Routing (Wire/ACH):</span><strong style="font-family:var(--font-mono)">${bank.routing}</strong></div>` : ''}
                    ${bank.accountType ? `<div class="bank-detail-row"><span style="color:var(--text3)">Account Type:</span><strong>${bank.accountType}</strong></div>` : ''}
                    <div style="font-size:.72rem;color:var(--text3);margin-top:.4rem;padding-top:.4rem;border-top:1px solid rgba(128,128,128,.1)"><i class="fas fa-info-circle" style="margin-right:.25rem"></i>Transfer the exact amount, then submit your reference & receipt below.</div>
                    ${copyBtn}
                </div>`;
    });
    return html;
}

export async function submitManualPayment() {
    const reference = document.getElementById('manualRef')?.value.trim();
    const amount = document.getElementById('manualAmount')?.value;
    const paymentDate = document.getElementById('manualDate')?.value;
    const receipt = document.getElementById('manualReceipt')?.files[0];
    const referralCode = document.getElementById('buyManualRefCode')?.value.trim();
    const affiliateCode = getAffiliateCodeFromCookie();

    if (!reference) { toast('Enter transaction reference', 'error'); return; }
    if (reference.length < 8 || reference.length > 30) { toast('Reference must be 8-30 characters', 'error'); return; }
    if (!amount || amount < 1000) { toast('Enter a valid amount (min ₦1,000)', 'error'); return; }
    if (!paymentDate) { toast('Select payment date', 'error'); return; }
    if (!receipt) { toast('Upload receipt', 'error'); return; }

    const formData = new FormData();
    formData.append('type', window.currentPaymentType);
    if (window.currentPaymentType === 'course' && window.currentManualCourseId) formData.append('courseId',
        window.currentManualCourseId);
    if (window.currentPaymentType === 'book' && window.currentManualBookId) formData.append('bookId',
        window.currentManualBookId);
    formData.append('amount', amount);
    formData.append('reference', reference);
    formData.append('paymentDate', paymentDate);
    formData.append('receipt', receipt);
    if (referralCode) formData.append('referralCode', referralCode);
    if (affiliateCode) formData.append('affiliateCode', affiliateCode);

    const progressEl = document.getElementById('manualReceiptProgress');
    if (progressEl) { progressEl.style.display = 'block';
        progressEl.textContent = 'Uploading receipt... 0%'; }

    showLoading('Submitting payment...');
    try {
        const token = localStorage.getItem('cx_accessToken');
        const xhr = new XMLHttpRequest();
        xhr.timeout = 120000;
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 100);
                if (progressEl) progressEl.textContent = `Uploading receipt... ${pct}%`;
                const loadingText = document.getElementById('loadingText');
                if (loadingText) loadingText.textContent = `Uploading receipt... ${pct}%`;
            }
        };
        xhr.onload = function() {
            if (progressEl) { progressEl.style.display = 'none';
                progressEl.textContent = ''; }
            hideLoading();
            try {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    if (data.data?._id) {
                        S.pendingManualPaymentId = data.data._id;
                        sessionStorage.setItem('pendingManualPayment', data.data._id);
                    }
                    if (data.autoApproved) {
                        toast('✅ Payment verified! Access granted.', 'success');
                        closeModal('buyCourseModal');
                        if (window.currentPaymentType === 'book') {
                            S.currentBook.isPurchased = true;
                            if (S.dp === 'book-detail') import('./books.js').then(({ renderBookDetail }) =>
                                renderBookDetail(S.currentBook));
                        }
                        setTimeout(async () => {
                            if (window.currentPaymentType === 'course') { await import('./courses.js').then(({ loadEnrollments }) =>
                                    loadEnrollments());
                                setDP('courses'); } else if (window.currentPaymentType === 'book') { await import('./books.js').then(({ loadBooks }) =>
                                    loadBooks()); }
                            await renderWallet();
                        }, 1500);
                    } else {
                        toast('📋 Payment submitted for admin review. You will be notified once approved.',
                            'info');
                        closeModal('buyCourseModal');
                        setTimeout(renderWallet, 2000);
                    }
                } else { toast(data.message || 'Submission failed', 'error'); }
            } catch (e) { toast('Invalid server response', 'error'); }
            document.getElementById('manualReceipt').value = '';
            document.getElementById('receiptPreview').style.display = 'none';
            document.cookie = 'affiliate_code=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        };
        xhr.onerror = function() {
            if (progressEl) { progressEl.style.display = 'none';
                progressEl.textContent = ''; }
            hideLoading();
            toast('Network error – please check your connection', 'error');
        };
        xhr.ontimeout = function() {
            if (progressEl) { progressEl.style.display = 'none';
                progressEl.textContent = ''; }
            hideLoading();
            toast('Upload timed out. Please try again.', 'error');
        };
        xhr.open('POST', `${API_BASE}/payments/manual`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    } catch (err) {
        toast('Network error: ' + err.message, 'error');
        if (progressEl) { progressEl.style.display = 'none';
            progressEl.textContent = ''; }
        hideLoading();
    }
}

export async function submitPremManualPayment() {
    const reference = document.getElementById('premManualRef')?.value.trim();
    const paymentDate = document.getElementById('premManualDate')?.value;
    const receipt = document.getElementById('premManualReceipt')?.files[0];
    if (!reference) { toast('Enter transaction reference', 'error'); return; }
    if (!paymentDate) { toast('Select payment date', 'error'); return; }
    if (!receipt) { toast('Upload receipt', 'error'); return; }
    const formData = new FormData();
    formData.append('type', 'subscription');
    formData.append('amount', '5000');
    formData.append('reference', reference);
    formData.append('paymentDate', paymentDate);
    formData.append('receipt', receipt);
    const referralCode = document.getElementById('premReferralCode')?.value.trim();
    if (referralCode) formData.append('referralCode', referralCode);
    showLoading('Submitting payment...');
    try {
        const token = localStorage.getItem('cx_accessToken');
        const response = await fetch(`${API_BASE}/payments/manual`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
            body: formData });
        const data = await response.json();
        if (data.success) {
            if (data.data?._id) {
                S.pendingManualPaymentId = data.data._id;
                sessionStorage.setItem('pendingManualPayment', data.data._id);
            }
            if (data.autoApproved) {
                toast('✅ Premium activated!', 'success');
                closeModal('premiumModal');
                setTimeout(async () => { S.isPremium = true;
                    S.user.isPremium = true;
                    import('./dashboard.js').then(({ updateUserUI }) => updateUserUI());
                    await renderWallet(); }, 1500);
            } else {
                toast('📋 Payment submitted for admin review.', 'info');
                closeModal('premiumModal');
                setTimeout(renderWallet, 2000);
            }
        } else { toast(data.message || 'Submission failed', 'error'); }
    } catch (err) { toast('Network error: ' + err.message, 'error'); } finally { hideLoading(); }
}

export async function submitWizManualPayment() {
    const reference = document.getElementById('wizManualRef')?.value.trim();
    const paymentDate = document.getElementById('wizManualDate')?.value;
    const receipt = document.getElementById('wizManualReceipt')?.files[0];
    if (!reference) { toast('Enter transaction reference', 'error'); return; }
    if (!paymentDate) { toast('Select payment date', 'error'); return; }
    if (!receipt) { toast('Upload receipt', 'error'); return; }
    const formData = new FormData();
    formData.append('type', 'subscription');
    formData.append('amount', '5000');
    formData.append('reference', reference);
    formData.append('paymentDate', paymentDate);
    formData.append('receipt', receipt);
    const referralCode = document.getElementById('premRefCode')?.value.trim();
    if (referralCode) formData.append('referralCode', referralCode);
    showLoading('Submitting payment...');
    try {
        const token = localStorage.getItem('cx_accessToken');
        const response = await fetch(`${API_BASE}/payments/manual`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
            body: formData });
        const data = await response.json();
        if (data.success) {
            if (data.data?._id) {
                S.pendingManualPaymentId = data.data._id;
                sessionStorage.setItem('pendingManualPayment', data.data._id);
            }
            if (data.autoApproved) { toast('✅ Premium activated!', 'success');
                import('./landing.js').then(({ finishWizard }) => finishWizard(true)); } else { toast(
                    '📋 Payment submitted for review.', 'info');
                import('./landing.js').then(({ finishWizard }) => finishWizard(false)); }
        } else { toast(data.message || 'Submission failed', 'error'); }
    } catch (err) { toast('Network error: ' + err.message, 'error'); } finally { hideLoading(); }
}

export async function checkManualPaymentStatus() {
    const paymentId = sessionStorage.getItem('pendingManualPayment');
    if (!paymentId) { return; }
    try {
        const res = await apiCall(`/payments/manual/${paymentId}`);
        const payment = res.data;
        if (!payment) return;
        if (payment.status === 'approved') {
            toast('✅ Your manual payment was approved!', 'success');
            sessionStorage.removeItem('pendingManualPayment');
            await renderWallet();
            if (payment.type === 'course') { await import('./courses.js').then(({ loadEnrollments }) =>
                    loadEnrollments());
                setDP('courses'); } else if (payment.type === 'book') { await import('./books.js').then(({ loadBooks }) =>
                    loadBooks()); }
            if (S.currentBook) import('./books.js').then(({ renderBookDetail }) => renderBookDetail(S.currentBook));
        } else if (payment.status === 'rejected') {
            toast('❌ Your manual payment was rejected. Reason: ' + (payment.adminNote || 'Not specified'),
                'error');
            sessionStorage.removeItem('pendingManualPayment');
        }
    } catch (e) { console.warn('Could not check manual payment status:', e); }
}

// ─── COUPON HELPERS ────────────────────────────────────────────────────

export function applyBuyCode(val) {
    const st = document.getElementById('buyCodeStatus');
    if (!st) return;
    if (val.length > 3) { st.style.color = 'var(--success)';
        st.textContent = '✅ Checking code...'; } else { st.textContent = ''; }
}

export function applyBuyManualCode(val) {
    const st = document.getElementById('buyManualCodeStatus');
    if (!st) return;
    if (val.length > 3) { st.style.color = 'var(--success)';
        st.textContent = '✅ Code will be applied'; } else { st.textContent = ''; }
}

export function applyPremCode(val) {
    const st = document.getElementById('premCodeStatus');
    if (!st) return;
    if (val.length > 3) { st.style.color = 'var(--success)';
        st.textContent = '✅ Code applied'; } else { st.textContent = ''; }
}

// ─── EXPOSE TO WINDOW ──────────────────────────────────────────────────

window.renderWallet = renderWallet;
window.filterTx = filterTx;
window.openWithdrawModal = openWithdrawModal;
window.processWithdraw = processWithdraw;
window.processPayment = processPayment;
window.doPremiumPaystack = doPremiumPaystack;
window.applyPremReferralCode = applyPremReferralCode;
window.toggleBuyPaymentMethod = toggleBuyPaymentMethod;
window.togglePremPaymentMethod = togglePremPaymentMethod;
window.toggleWizPaymentMethod = toggleWizPaymentMethod;
window.previewReceipt = previewReceipt;
window.populateAllBankDetailsBoxes = populateAllBankDetailsBoxes;
window.submitManualPayment = submitManualPayment;
window.submitPremManualPayment = submitPremManualPayment;
window.submitWizManualPayment = submitWizManualPayment;
window.applyBuyCode = applyBuyCode;
window.applyBuyManualCode = applyBuyManualCode;
window.applyPremCode = applyPremCode;
