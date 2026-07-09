// js/auth.js
import { apiCall, toast, showLoading, hideLoading, forceRedirect } from './utils.js';
import { S, updateUser, saveState } from './state.js';
import { goPage } from './router.js';
import { setDP, initApp } from './dashboard.js';

export async function doLogin() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPw')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    const btn = document.getElementById('loginBtn');
    if (!email || !password) { toast(!email ? 'Enter your email' : 'Enter your password', 'error'); return; }
    if (btn) { btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spin"></i> Signing in...'; }
    showLoading('Signing in...');
    try {
        const url =
            `${API_BASE}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&rememberMe=${rememberMe}`;
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        await handleLoginSuccess(data, true);
    } catch (e) { toast(e.message, 'error');
        hideLoading(); if (btn) { btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i>Sign In'; } }
}

export async function doRegister() {
    const first = document.getElementById('regFirst')?.value.trim();
    const last = document.getElementById('regLast')?.value.trim();
    const em = document.getElementById('regEmail')?.value.trim();
    const pw = document.getElementById('regPw')?.value;
    const phone = document.getElementById('regPhone')?.value.trim();
    let ref = document.getElementById('regRef')?.value.trim().toUpperCase();
    const terms = document.getElementById('termsChk')?.checked;
    const btn = document.getElementById('registerBtn');
    const pendingRef = localStorage.getItem('cx_pending_ref');
    if (pendingRef && !ref) { ref = pendingRef.toUpperCase(); if (document.getElementById('regRef')) document
            .getElementById('regRef').value = ref;
        localStorage.removeItem('cx_pending_ref'); }
    if (!first || !last) { toast('Enter your full name', 'error'); return; }
    if (!em || !em.includes('@')) { toast('Enter a valid email', 'error'); return; }
    if (!pw) { toast('Enter a password', 'error'); return; }
    if (!terms) { toast('Accept Terms and Privacy Policy', 'error'); return; }
    if (btn) { btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spin"></i> Creating account...'; }
    showLoading('Creating account...');
    const body = { firstName: first, lastName: last, email: em, password: pw };
    if (ref) body.referralCode = ref;
    try {
        const res = await apiCall('/auth/register', { method: 'POST', body });
        await handleLoginSuccess(res, false);
    } catch (err) {
        let errorMsg = err.message || 'Registration failed';
        if (ref && errorMsg.toLowerCase().includes('referral')) {
            toast('Referral code not recognised – registering without it', 'warning');
            delete body.referralCode;
            try { const res2 = await apiCall('/auth/register', { method: 'POST', body });
                await handleLoginSuccess(res2, false); return; } catch (e2) { errorMsg = e2.message ||
                    'Registration failed'; }
        }
        toast(errorMsg, 'error');
        hideLoading();
        if (btn) { btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-rocket"></i>Create My Free Account'; }
    }
}

export async function handleLoginSuccess(response, isFromLogin) {
    const payload = response.data || response;
    const token = payload.accessToken || payload.token;
    const user = payload.user;
    if (!token || !user) { toast('Invalid server response', 'error');
        hideLoading(); return; }
    localStorage.setItem('cx_accessToken', token);
    localStorage.setItem('cx_user', JSON.stringify(user));
    S.user = user;
    S.loggedIn = true;
    S.isPremium = user.isPremium || user.subscriptionTier === 'premium' || false;
    S.walletBal = user.walletBalance || 0;
    S.user.setupDone = user.setupDone === true;
    hideLoading();

    // Connect socket
    import('./dashboard.js').then(({ connectSocket }) => connectSocket());

    try {
        const profileData = await apiCall('/users/profile');
        const profile = profileData.data || profileData;
        S.user = { ...S.user, ...profile };
        S.isPremium = profile.isPremium || profile.subscriptionTier === 'premium' || false;
        S.walletBal = profile.walletBalance || 0;
        S.user.setupDone = profile.setupDone === true;
        S.user.referralCode = profile.referralCode || user.referralCode || 'REF';
        localStorage.setItem('cx_user', JSON.stringify(S.user));
    } catch (e) { console.warn('Profile fetch failed:', e.message); }

    // Update UI
    import('./dashboard.js').then(({ updateUserUI, updatePremiumUI }) => {
        updateUserUI();
        updatePremiumUI();
    });

    const targetPage = isFromLogin ? 'app' : (S.user.setupDone ? 'app' : 'setup');
    toast(isFromLogin ? `Welcome back, ${S.user?.firstName || 'User'}! 👋` :
        `Welcome to ChangeX, ${S.user?.firstName || 'User'}! 🎉`, 'success');
    forceRedirect(targetPage);

    // Load following and followers
    import('./people.js').then(({ loadUserFollowing, loadFollowers }) => {
        loadUserFollowing();
        loadFollowers();
    });

    setTimeout(() => {
        if (S.dp) {
            import('./dashboard.js').then(({ setDP }) => setDP(S.dp));
        }
    }, 300);

    // Update URL
    if (targetPage === 'app' && S.dp) {
        const path = '/' + S.dp;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
    } else if (targetPage === 'landing') {
        if (window.location.pathname !== '/') {
            window.history.pushState({}, '', '/');
        }
    }
}

export function doLogout() {
    if (S.loggedIn) { apiCall('/auth/logout', { method: 'POST' }).catch(() => {}); }
    if (window.socket) { window.socket.disconnect();
        window.socket = null; }
    localStorage.removeItem('cx_accessToken');
    localStorage.removeItem('cx_user');
    S.user = null;
    S.loggedIn = false;
    S.isPremium = false;
    S.walletBal = 0;
    S.enrollments = [];
    S.appCourses = [];
    toast('See you soon! 👋', 'info');
    if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
    }
    window.location.reload();
}

export function handleGoogleLogin() { window.location.href = `${API_BASE}/auth/google`; }

export function handleGithubLogin() { window.location.href = `${API_BASE}/auth/github`; }

export async function handleForgotPassword() {
    const email = document.getElementById('loginEmail')?.value.trim();
    if (!email) { toast('Enter your email address', 'error'); return; }
    const btn = document.querySelector('[onclick="handleForgotPassword()"]');
    const originalText = btn?.textContent;
    if (btn) { btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spin"></i> Sending...'; }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API_BASE}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }), signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');
        toast('If an account exists with that email, a password reset link has been sent.', 'success');
    } catch (err) { if (err.name === 'AbortError') toast('Request timed out.', 'error'); else toast(err.message ||
            'Failed to send reset link.', 'error'); } finally { if (btn) { btn.disabled = false;
            btn.innerHTML = originalText; } }
}

export function togglePw(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.innerHTML = inp.type === 'text' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

export function checkPwStr(v) {
    const segs = ['pb1', 'pb2', 'pb3', 'pb4'].map(id => document.getElementById(id));
    segs.forEach(s => { if (s) s.className = 'pw-bar'; });
    if (v.length < 4) return;
    let sc = 0;
    if (v.length >= 8) sc++;
    if (/[A-Z]/.test(v)) sc++;
    if (/[0-9]/.test(v)) sc++;
    if (/[^a-zA-Z0-9]/.test(v)) sc++;
    const cls = sc < 2 ? 'weak' : sc < 3 ? 'fair' : 'strong';
    for (let i = 0; i < sc; i++) { if (segs[i]) segs[i].classList.add(cls); }
}
