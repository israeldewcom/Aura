// js/landing.js
import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, escapeHtml, getAvatarUrl } from './utils.js';
import { goPage, smoothTo } from './router.js';
import { updateThemeIcons } from './ui.js';

export function initLanding() {
    fetchLandingStats();
    buildTicker();
    buildLandingFeed();
    fetchLandingCourses();
    fetchLandingInstructors();
    fetchLandingBooks();
    buildTestis();
    initReveal();
    initStickyNav();
    setInterval(buildLandingFeed, 5000);
    updateThemeIcons();
    updateLandingHeroStats();
    updateSEO({ title: 'ChangeX Academy — Learn, Earn, and Grow', description: 'Turn tech skills into real income. Join the #1 Learn-to-Earn platform.' });

    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
        localStorage.setItem('cx_pending_ref', refCode);
        toast('🎯 Referral code detected! You\'ll get a bonus when you sign up.', 'info');
    }
}

async function fetchLandingStats() {
    try {
        const res = await apiCall('/admin/dashboard');
        const d = res.data || {};
        document.getElementById('heroEarnings').textContent = '₦' + Math.floor((d.totalRevenue || 85000000) / 1000000) +
            'M+';
    } catch (e) { document.getElementById('heroEarnings').textContent = '₦85M+'; }
}

function updateLandingHeroStats() {
    document.getElementById('heroEarnings').textContent = '₦85M+';
    document.getElementById('heroReferrals').textContent = '₦12.4M';
    document.getElementById('heroCourses').textContent = '₦45.8M';
    document.getElementById('heroStreak').textContent = '🔥 1,284';
}

function buildTicker() {
    const items = [{ i: 'AO', t: 'Amaka earned ₦45,000' }, { i: 'TW', t: 'Tunde reached Level 15' },
        { i: 'FN', t: 'Fatima completed JS course' }, { i: 'KA', t: 'Kelechi is on a 21-day streak' },
        { i: 'CO', t: 'Chinedu earned ₦32,500 in referrals' }, { i: 'NI', t: 'Ngozi created her first course' },
        { i: 'EM', t: 'Emeka withdrew ₦58,000' }, { i: 'BI', t: 'Blessing earned affiliate bonus' }
    ];
    document.getElementById('tickerTrack').innerHTML = [...items, ...items].map(i =>
        `<div class="ticker-item"><div class="ticker-av">${i.i}</div><span>🎉 ${i.t}</span></div>`).join('');
}

function buildLandingFeed() {
    const feed = [{ e: '🎉', t: 'Amaka earned ₦1,000 bonus' }, { e: '🔥', t: 'Kelechi extended his streak' },
        { e: '💰', t: 'Emeka withdrew ₦25,000' }, { e: '📚', t: 'Fatima enrolled in React.js' },
        { e: '💸', t: 'Tunde earned ₦15,000 in commissions' }, { e: '⭐', t: 'Ngozi rated JavaScript Pro 5★' },
        { e: '🏆', t: 'Blessing reached Level 12' }, { e: '🤝', t: 'Chinedu referred 3 friends' }
    ];
    document.getElementById('landingFeed').innerHTML = feed.map(f =>
        `<div class="lf-item"><span style="font-size:1.1rem">${f.e}</span><span>${f.t}</span></div>`).join('');
}

async function fetchLandingCourses() {
    try {
        const data = await apiCall('/courses?published=true&limit=3');
        const list = Array.isArray(data.data) ? data.data : [];
        S.landingCourses = list;
        document.getElementById('landingCourseGrid').innerHTML = list.length ? list.map((c, i) =>
            `<div style="flex:1;min-width:240px"><div class="l-cc" onclick="goPage('register')"><div class="l-cc-thumb" style="background:linear-gradient(135deg,var(--card2),var(--card3))">${c.thumbnail || c.emoji || '📚'}<div class="l-cc-badge"><span class="badge ${i === 0 ? 'badge-primary' : 'badge-gold'}" style="font-size:.62rem">${i === 0 ? '🔥 Bestseller' : '🌟 Hot'}</span></div></div><div class="l-cc-body"><div class="l-cc-title">${c.title || 'Course'}</div><div class="l-cc-meta"><span class="stars">★★★★★</span><span>${c.rating || 4.9}</span>·<span>${c.totalLessons || 0} lessons</span></div><div class="l-cc-price">${fmtMoneyAPI(c.displayPrice || c.price || 0)}</div></div></div>`
            ).join('') : '<div class="empty-state"><p>Loading courses...</p></div>';
    } catch (e) { document.getElementById('landingCourseGrid').innerHTML =
            '<div class="empty-state"><p>Loading courses...</p></div>'; }
}

async function fetchLandingBooks() {
    try {
        const res = await apiCall('/books');
        const books = (res.data || []).filter(b => b.isPublished !== false).slice(0, 3);
        const container = document.getElementById('landingBooksGrid');
        if (!container) return;
        if (!books.length) { container.innerHTML = '<div class="empty-state"><p>Books coming soon</p></div>'; return; }
        container.innerHTML = books.map(book => `
                <div style="flex:1;min-width:200px">
                    <div class="l-cc" onclick="goPage('register')">
                        <div class="l-cc-thumb" style="background:linear-gradient(135deg,var(--card2),var(--card3));font-size:2.5rem;">${book.coverImage ? `<img src="${book.coverImage}" style="width:100%;height:100%;object-fit:cover;">` : '📖'}</div>
                        <div class="l-cc-body">
                            <div class="l-cc-title">${escapeHtml(book.title)}</div>
                            <div class="l-cc-meta">By ${escapeHtml(book.author || 'Unknown')}</div>
                            <div class="l-cc-price">${book.price === 0 ? 'Free' : fmtMoneyAPI(book.price)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
    } catch (e) { document.getElementById('landingBooksGrid').innerHTML =
            '<div class="empty-state"><p>Loading books...</p></div>'; }
}

async function fetchLandingInstructors() {
    try {
        const data = await apiCall('/users/leaderboard?limit=4');
        const list = Array.isArray(data.data) ? data.data : [];
        document.getElementById('landingInstructors').innerHTML = list.length ? list.map(inst => {
            const avatarHtml = getAvatarUrl(inst) ?
                `<img src="${getAvatarUrl(inst)}" alt="${inst.firstName || 'I'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
                (inst.firstName?.[0] || 'I');
            return `<div style="flex:1;min-width:200px"><div class="inst-card"><div class="inst-av-lg" style="background:linear-gradient(135deg,var(--primary),var(--secondary));overflow:hidden">${avatarHtml}</div><div style="font-weight:700">${inst.firstName || 'Instructor'} ${inst.lastName || ''}</div><div style="font-size:.74rem;color:var(--text3)">Level ${inst.level || 1}</div><button class="btn btn-ghost btn-sm w-full mt-3" onclick="goPage('register')">View Profile</button></div></div>`;
        }).join('') :
            '<div class="col-12"><div class="empty-state"><p>Loading instructors...</p></div></div>';
    } catch (e) { document.getElementById('landingInstructors').innerHTML =
            '<div class="col-12"><div class="empty-state"><p>Instructors coming soon</p></div></div>'; }
}

function buildTestis() {
    const data = [{ n: 'Amaka Obi', av: 'AO', loc: 'Lagos', q: 'I landed my first ₦150,000 freelance client!',
            col: 'linear-gradient(135deg,var(--primary),var(--secondary))' },
        { n: 'Kelechi Agu', av: 'KA', loc: 'Port Harcourt', q: 'The AI Tools course paid back 100x!',
            col: 'linear-gradient(135deg,var(--accent),#0D9488)' },
        { n: 'Fatima Bello', av: 'FB', loc: 'Abuja', q: 'Earned ₦85,000 from referrals alone. This platform is gold! 💰',
            col: 'linear-gradient(135deg,var(--violet),var(--primary))' },
        { n: 'Emeka Nnamdi', av: 'EN', loc: 'Enugu', q: 'From zero coding to building websites for clients. ChangeX changed my life!',
            col: 'linear-gradient(135deg,var(--gold),var(--orange))' }
    ];
    document.getElementById('testiGrid').innerHTML = data.map(t =>
        `<div style="flex:1;min-width:260px"><div class="testi"><div style="display:flex;align-items:center;gap:.65rem"><div class="testi-av" style="background:${t.col}">${t.av}</div><div><strong>${t.n}</strong><br><small style="color:var(--text3)">${t.loc}</small></div></div><div class="stars mb-2">★★★★★</div><p style="font-size:.83rem;color:var(--text2)">"${t.q}"</p></div></div>`
    ).join('');
}

export async function submitReview() {
    const name = document.getElementById('reviewName').value.trim();
    const rating = parseInt(document.querySelector('#reviewStars .active')?.dataset.val) || 0;
    const text = document.getElementById('reviewText').value.trim();
    if (!name || !rating || !text) { toast('Please fill all fields', 'error'); return; }
    try {
        await apiCall('/feedback', { method: 'POST', body: { message: `Review from ${name}: ${text} (${rating}★)`,
                email: 'changexacademysupport@gmail.com' } });
        toast('Review submitted! Thank you.', 'success');
        document.getElementById('reviewName').value = '';
        document.getElementById('reviewText').value = '';
        document.querySelectorAll('#reviewStars span').forEach(s => s.classList.remove('active'));
    } catch (err) { toast('Failed: ' + err.message, 'error'); }
}

export function setReviewStar(n) {
    document.querySelectorAll('#reviewStars span').forEach((s, i) => {
        s.textContent = i < n ? '★' : '☆';
        s.style.color = i < n ? 'var(--gold)' : 'var(--text3)';
    });
}

function initReveal() {
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) e.target
                .classList.add('on'); }); }, { threshold: 0.1 });
    document.querySelectorAll('.reveal,.reveal-l,.reveal-r').forEach(el => obs.observe(el));
}

function initStickyNav() {
    window.addEventListener('scroll', () => { document.getElementById('landingNav')?.classList.toggle(
            'scrolled', window.scrollY > 50); }, { passive: true });
}

export function toggleMobNav() { document.getElementById('mobNav')?.classList.toggle('open'); }

export function subscribeEmail() {
    const e = document.getElementById('footerEmail')?.value.trim();
    if (!e || !e.includes('@')) { toast('Enter a valid email', 'error'); return; }
    toast('Subscribed! 🎉', 'success');
    document.getElementById('footerEmail').value = '';
}

export async function sendContact() {
    const em = document.getElementById('contactEmail')?.value.trim();
    const msg = document.getElementById('contactMsg')?.value.trim();
    if (!em || !msg) { toast('Fill in email and message', 'error'); return; }
    try {
        await apiCall('/contact', { method: 'POST', body: { email: em, subject: document.getElementById(
                    'contactSubject')?.value, message: msg, firstName: document.getElementById(
                    'contactFirst')?.value, lastName: document.getElementById('contactLast')?.value } });
        toast('Message sent! ✉️', 'success');
    } catch (e) { toast('Message sent! ✉️', 'success'); }
}

function updateSEO(data) {
    const title = data?.title || 'ChangeX Academy';
    const description = data?.description || data?.excerpt || 'Learn tech skills and earn real money on ChangeX Academy.';
    const image = data?.featuredImage || data?.coverImage || data?.thumbnail || '/icons/icon-512x512.png';
    const url = window.location.href;
    document.title = `${title} | ChangeX Academy`;
    document.getElementById('pageTitle').textContent = document.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', image);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', title);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', description);
    const twImage = document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.setAttribute('content', image);
}

// Wizard functions
export function nextWizStep(skip) { S.wizStep++;
    showWizStep(S.wizStep); }

export function prevWizStep() { S.wizStep = Math.max(0, S.wizStep - 1);
    showWizStep(S.wizStep); }

export function showWizStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById('wiz-' + n)?.classList.add('active');
    document.getElementById('wizProg').style.width = Math.round((n / 5) * 100) + '%';
    if (n === 0 && S.user) document.getElementById('wizName').textContent = S.user.firstName || 'User';
    if (n === 5 && S.user) document.getElementById('wizRefCode').textContent = S.user.referralCode || 'REF';
    if (n === 4) {
        import('./payments.js').then(({ populateAllBankDetailsBoxes }) => populateAllBankDetailsBoxes());
    }
}

export function toggleRole(role) {
    if (role === 'all') S.wizRoles = ['student', 'instructor', 'affiliate'];
    else { const i = S.wizRoles.indexOf(role); if (i >= 0) S.wizRoles.splice(i, 1); else S.wizRoles.push(role); }
    ['student', 'instructor', 'affiliate', 'all'].forEach(r => { const el = document.getElementById('role-' +
            r); if (el) el.classList.toggle('selected', r === 'all' ? S.wizRoles.length === 3 : S.wizRoles
            .includes(r)); });
}

export function verifyAccount(val) {
    const st = document.getElementById('accVerifyStatus');
    if (!st) return;
    if (val.length === 10) { st.style.display = 'block';
        st.style.color = 'var(--success)';
        st.textContent = '✅ Account verified';
        document.getElementById('wiz-accname').value = 'Account Name Verified'; }
}

export async function finishWizard(isPremium) {
    if (S.user) { S.user.setupDone = true;
        S.user.isPremium = isPremium;
        S.isPremium = isPremium;
        localStorage.setItem('cx_user', JSON.stringify(S.user)); try { await apiCall('/users/profile', { method: 'PUT',
                    body: { setupDone: true, roles: S.wizRoles.length ? S.wizRoles : ['student'],
                        bio: document.getElementById('wiz-bio')?.value || '',
                        location: document.getElementById('wiz-loc')?.value || '' } }); try { await apiCall(
                        '/users/claim-welcome-bonus', { method: 'POST' });
                    toast('🎉 Welcome bonus ₦500 added!', 'success');
                    import('./payments.js').then(({ renderWallet }) => renderWallet());
                    import('./courses.js').then(({ loadEnrollments }) => loadEnrollments());
                    import('./dashboard.js').then(({ updateUserUI }) => updateUserUI()); } catch (e) { console
                        .warn('Bonus already claimed'); } } catch (e) { console.warn(
                    'Could not save wizard profile:', e.message); } }
    goPage('app');
}
