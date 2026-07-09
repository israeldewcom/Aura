// js/dashboard.js
import { S, updateUser, saveState, loadState } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, renderCurrencySelectorUI } from './utils.js';
import { goPage, setDP as routerSetDP } from './router.js';
import { openModal, closeModal, renderNotifs, updateThemeIcons } from './ui.js';

let socket = null;

export function connectSocket() {
    const userId = S.user?._id;
    if (!userId || socket?.connected) return;
    try {
        const token = localStorage.getItem('cx_accessToken');
        socket = io(API_BASE.replace('/api/v1', ''), { auth: { token }, withCredentials: true, transports: [
                'websocket', 'polling'
            ] });
        socket.on('connect', () => { console.log('Socket connected');
            setupAdminSocketAlerts(); });
        socket.on('notification', (notif) => { S.notifications.unshift({ ...notif, unread: true, time: new Date(
                        notif.createdAt).toLocaleTimeString(), bg: 'si-primary', ic: notif.icon || 'fa-bell' });
            renderNotifs();
            toast(notif.title || 'New notification', 'info');
            document.getElementById('notifDot').style.display = 'block'; });
        socket.on('affiliate-offer', (data) => { toast(
                `📢 New Affiliate Offer: ${data.title} - ${data.affiliatePercent}% commission!`, 'info');
            S.notifications.unshift({ _id: Date.now(), title: 'New Affiliate Offer Available!',
                message: `${data.title} now offers ${data.affiliatePercent}% commission.`, type: 'system',
                unread: true, time: new Date().toLocaleTimeString(), bg: 'si-gold', ic: 'fa-handshake',
                data: { courseId: data.courseId, type: 'affiliate_offer' } });
            renderNotifs();
            document.getElementById('notifDot').style.display = 'block'; if (S.dp === 'affiliates')
                import('./affiliates.js').then(({ renderAffiliates }) => renderAffiliates()); });
        socket.on('announcement', (data) => { const bar = document.getElementById('announcementBar'); if (bar) { bar
                    .style.display = 'flex';
                document.getElementById('announcementText').textContent =
                    `📣 ${data.title}: ${data.content?.substring(0, 100) || ''}`; }
            toast(data.title || 'New announcement', 'info'); });
        socket.on('book_approved', (data) => {
            toast(`✅ Your book "${data.title}" has been approved!`, 'success');
            if (S.dp === 'books') import('./books.js').then(({ loadBooks }) => loadBooks());
        });
        socket.on('book_rejected', (data) => {
            toast(`❌ Your book "${data.title}" was rejected`, 'error');
            if (S.dp === 'books') import('./books.js').then(({ loadBooks }) => loadBooks());
        });
        socket.on('disconnect', () => { console.log('Socket disconnected'); });
        socket.on('new_post', (post) => {
            if (['feed', 'following', 'home'].includes(S.dp)) {
                const container = document.getElementById('feedContainer');
                if (container) {
                    if (!container.querySelector(`[data-post-id="${post._id}"]`)) {
                        import('./feed.js').then(({ renderPostCard, attachPostEventListeners }) => {
                            const html = renderPostCard(post);
                            container.insertAdjacentHTML('afterbegin', html);
                            attachPostEventListeners();
                            toast('📢 New post from ' + (post.authorId?.firstName || 'someone'), 'info');
                        });
                    }
                }
            }
        });
        socket.on('challenge_created', (data) => {
            toast(`📢 New challenge: ${data.title}`, 'info');
            if (S.dp === 'challenges') import('./challenges.js').then(({ loadChallenges }) => loadChallenges());
        });
        socket.on('challenge_updated', (data) => {
            toast(`📢 Challenge updated: ${data.title}`, 'info');
            if (S.dp === 'challenges') import('./challenges.js').then(({ loadChallenges }) => loadChallenges());
        });
        socket.on('challenge_deleted', (data) => {
            toast(`📢 Challenge removed: ${data.title}`, 'info');
            if (S.dp === 'challenges') import('./challenges.js').then(({ loadChallenges }) => loadChallenges());
        });
        socket.on('challenge_completed', (data) => {
            toast(`🎉 ${data.userName} completed a challenge!`, 'success');
            if (S.dp === 'challenges') import('./challenges.js').then(({ loadChallenges }) => loadChallenges());
        });
        socket.on('book_created', (data) => {
            toast(`📚 New book: ${data.title}`, 'info');
            if (S.dp === 'books') import('./books.js').then(({ loadBooks }) => loadBooks());
        });
        socket.on('social_earnings_distributed', (data) => {
            toast(`🌱 Social earnings distributed: ₦${data.totalDistributed.toLocaleString()} across ${data.postsAffected} posts!`, 'info');
            if (S.dp === 'wallet') import('./payments.js').then(({ renderWallet }) => renderWallet());
            if (S.dp === 'social-earnings') import('./social-earnings.js').then(({ renderSocialEarnings }) =>
                renderSocialEarnings());
            updateSocialBadge();
        });
        socket.on('post_liked', (data) => {
            const likeSpan = document.querySelector(`.post-likes[data-id="${data.postId}"]`);
            if (likeSpan) {
                likeSpan.innerHTML = `<i class="fas fa-heart"></i> ${data.likes}`;
            }
            const btn = document.querySelector(`.btn-like[data-id="${data.postId}"]`);
            if (btn && data.userId === S.user?._id) {
                btn.classList.toggle('liked', data.liked);
            } else if (btn) {
                const isLiked = btn.classList.contains('liked');
                if (data.liked && !isLiked) {
                    btn.classList.add('liked');
                } else if (!data.liked && isLiked) {
                    btn.classList.remove('liked');
                }
            }
        });
        socket.on('manual_payment_approved', (data) => {
            if (data.type === 'subscription') {
                S.isPremium = true;
                S.user.isPremium = true;
                updatePremiumUI();
                toast('👑 Premium activated via manual payment!', 'success');
            }
        });
        window.socket = socket;
    } catch (e) { console.warn('Socket init failed:', e.message); }
}

function setupAdminSocketAlerts() {
    if (!socket) return;
    socket.on('admin_manual_payment_alert', (data) => { toast(
            `📋 New manual payment from ${data.userName} - ₦${data.amount.toLocaleString()}`, 'info'); if (S.dp ===
            'admin' && S.admSec === 'manualPayments') import('./admin.js').then(({ loadManualPayments }) =>
            loadManualPayments()); });
}

export function setDP(pg) {
    document.querySelectorAll('.dash-sub').forEach(d => d.classList.remove('active'));
    const el = document.getElementById('dash-' + pg);
    if (el) { el.classList.add('active');
        S.dp = pg; }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const ni = document.getElementById('nav-' + pg);
    if (ni) ni.classList.add('active');
    ['feed', 'challenges', 'explore', 'wallet', 'home', 'books', 'following', 'social-earnings'].forEach(k => { const m =
            document.getElementById('mbn-' + k); if (m) m.classList.toggle('active', k === pg); });
    closeSidebar();

    // Load corresponding data
    const map = {
        feed: () => { import('./feed.js').then(({ loadFeed }) => loadFeed(1));
            loadSidebarAd();
            loadBottomAd(); },
        challenges: () => import('./challenges.js').then(({ loadChallenges }) => loadChallenges()),
        people: () => import('./people.js').then(({ loadPeople }) => loadPeople()),
        home: () => renderHomeDashboard(),
        explore: () => import('./courses.js').then(({ renderExplore }) => renderExplore()),
        courses: () => import('./courses.js').then(({ renderCourseGrid }) => renderCourseGrid(S.courseFilter)),
        lesson: () => { import('./courses.js').then(({ renderCurric, switchLTab }) => { renderCurric();
                switchLTab('overview', null); }); },
        quiz: () => import('./quiz.js').then(({ initQuiz }) => initQuiz()),
        certs: () => import('./certificates.js').then(({ renderCerts }) => renderCerts()),
        wallet: () => import('./payments.js').then(({ renderWallet }) => renderWallet()),
        referrals: () => import('./referrals.js').then(({ renderRefs }) => renderRefs()),
        leaderboard: async () => { await import('./leaderboard.js').then(({ loadLeaderboard, renderLB }) => { loadLeaderboard();
                renderLB(); }); },
        affiliates: (force = false) => import('./affiliates.js').then(({ renderAffiliates }) => renderAffiliates(force)),
        instructor: () => import('./instructor.js').then(({ renderInstHub }) => renderInstHub()),
        'course-editor': () => import('./course-editor.js').then(({ initEditor }) => initEditor()),
        ai: () => import('./ai.js').then(({ initAI }) => initAI()),
        admin: () => import('./admin.js').then(({ renderAdm }) => renderAdm('dashboard')),
        settings: () => import('./settings.js').then(({ initSettings }) => initSettings()),
        books: () => { import('./books.js').then(({ loadBooks }) => loadBooks());
            loadSidebarAd();
            loadBottomAd(); },
        'book-detail': () => { if (!S.isPremium) import('./books.js').then(({ loadBookPageAds }) =>
            loadBookPageAds()); },
        'create-book': () => {
            if (!S.isPremium) {
                toast('Premium required to upload books', 'warning');
                openModal('premiumModal');
                setDP('home');
                return;
            }
            const container = document.getElementById('dash-create-book');
            if (container) {
                container.style.display = 'block';
                container.classList.add('active');
            }
        },
        tools: () => import('./tools.js').then(({ loadTools }) => loadTools()),
        'premium-upload-course': () => { if (!S.isPremium) { toast('Premium required to upload courses',
                    'warning');
                openModal('premiumModal');
                setDP('home'); } },
        badges: () => import('./badges.js').then(({ loadUserBadges }) => loadUserBadges()),
        'manual-payments': () => import('./manual-payments.js').then(({ loadUserManualPayments }) =>
            loadUserManualPayments()),
        'purchased-articles': () => import('./purchased-articles.js').then(({ loadPurchasedArticles }) =>
            loadPurchasedArticles()),
        following: () => import('./people.js').then(({ loadFollowing }) => loadFollowing()),
        'social-earnings': () => import('./social-earnings.js').then(({ renderSocialEarnings }) =>
            renderSocialEarnings()),
        sponsorship: () => import('./sponsorship.js').then(({ switchSponsorTab }) =>
            switchSponsorTab('overview', document.querySelector('#dash-sponsorship .tab-btn'))),
        profile: () => {},
        'post-detail': () => {},
    };
    if (map[pg]) map[pg]();
    const fab = document.getElementById('fab');
    if (fab) { const hasCreatorAccess = S.isPremium || S.user?.roles?.includes('admin') || (S.user?.roles?.includes(
                'creator') && S.user?.isApprovedInstructor);
        fab.style.display = hasCreatorAccess ? 'block' : 'none'; }
    checkPlanExpiry();
    updatePremiumUI();
    updateSocialBadge();
    // Update URL
    if (S.page === 'app') {
        const path = '/' + pg;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
    }
}

export async function initApp() {
    loadState();
    if (!S.user) { import('./auth.js').then(({ doLogout }) => doLogout()); return; }
    connectSocket();
    await import('./utils.js').then(({ loadExchangeRates }) => loadExchangeRates());
    await import('./admin.js').then(({ fetchAdConfig }) => fetchAdConfig());
    try {
        const data = await apiCall('/users/profile');
        S.user = data.data || data;
        S.isPremium = S.user.isPremium || S.user.subscriptionTier === 'premium' || false;
        S.walletBal = S.user.walletBalance || 0;
        S.loggedIn = true;
        localStorage.setItem('cx_user', JSON.stringify(S.user));
    } catch (e) {}
    updateUserUI();
    updatePremiumUI();
    if (S.user.roles?.includes('admin') || S.user.role === 'admin' || S.user.role === 'superadmin') {
        document.getElementById('adminNavLi').style.display = 'block';
    }
    const hasCreatorAccess = S.isPremium || S.user?.roles?.includes('admin') || (S.user?.roles?.includes('creator') &&
        S.user?.isApprovedInstructor);
    document.getElementById('nav-instructor').style.display = hasCreatorAccess ? '' : 'none';
    document.getElementById('nav-course-editor').style.display = hasCreatorAccess ? '' : 'none';
    const fab = document.getElementById('fab');
    if (fab) fab.style.display = hasCreatorAccess ? 'block' : 'none';
    await import('./courses.js').then(({ loadEnrollments }) => loadEnrollments());
    await fetchAnnouncements();
    await import('./dashboard.js').then(({ fetchNotifications }) => fetchNotifications());
    await import('./people.js').then(({ loadUserFollowing, loadFollowers }) => {
        loadUserFollowing();
        loadFollowers();
    });
    updateThemeIcons();
    renderNotifs();
    renderCurrencySelectorUI();
    import('./payments.js').then(({ populateAllBankDetailsBoxes }) => populateAllBankDetailsBoxes());
    await import('./people.js').then(({ loadPeople }) => loadPeople());
    checkPlanExpiry();
    await updateSocialBadge();
    await import('./admin.js').then(({ loadAds }) => loadAds('in-feed'));
    loadSidebarAd();
    loadBottomAd();
    setTimeout(() => {
        const hash = window.location.hash.slice(1);
        if (hash.startsWith('courses/')) { const courseId = hash.split('/')[1]; if (courseId) setTimeout(() =>
                import('./courses.js').then(({ openBuyCourse }) => openBuyCourse(courseId)), 1000); }
        if (hash.startsWith('post/')) { const slug = hash.split('/')[1]; if (slug) setTimeout(() =>
                import('./posts.js').then(({ loadPostBySlug }) => loadPostBySlug(slug)), 1000); }
    }, 800);
    handleDeepLink();
    // Handle initial route
    const path = window.location.pathname;
    if (path !== '/' && path !== '/login' && path !== '/register' && path !== '/setup' && path !== '/contact') {
        import('./router.js').then(({ handleRoute }) => handleRoute(path));
    } else if (path === '/' && S.loggedIn) {
        setDP('feed');
    }
}

function handleDeepLink() {
    const path = window.location.pathname;
    const postMatch = path.match(/^\/post\/(.+)/);
    if (postMatch) {
        const slug = postMatch[1];
        const token = localStorage.getItem('cx_accessToken');
        if (!token) { toast('Please log in to view this post.', 'warning');
            goPage('login'); return; }
        import('./posts.js').then(({ loadPostBySlug }) => loadPostBySlug(slug));
    }
    const affMatch = path.match(/^\/aff\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    if (affMatch) {
        const [, userId, courseId, code] = affMatch;
        showLoading('Redirecting to course...');
        fetch(`${API_BASE}/affiliate/track/${code}`, { method: 'GET', credentials: 'include' }).catch(() => {})
            .finally(() => { window.location.href = `/courses/${courseId}`; });
    }
}

async function fetchAnnouncements() {
    try {
        const res = await apiCall('/announcements/latest');
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length > 0) {
            const latest = list[0];
            const bar = document.getElementById('announcementBar');
            if (bar) { bar.style.display = 'flex';
                bar.onclick = () => toast(latest.title + ': ' + latest.content, 'info'); }
            document.getElementById('announcementText').textContent =
                `📣 ${latest.title}: ${latest.content?.substring(0, 100) || ''}`;
        }
    } catch (e) {}
}

async function fetchNotifications() {
    try {
        const res = await apiCall('/users/notifications');
        const list = Array.isArray(res.data) ? res.data : [];
        S.notifications = list.map(n => ({ ...n, unread: !n.read, time: new Date(n.createdAt).toLocaleTimeString(),
            bg: 'si-primary', ic: n.icon || 'fa-bell' }));
    } catch (e) { console.warn('Could not fetch notifications:', e.message); }
}

export function updateUserUI() {
    if (!S.user) return;
    const nm = `${S.user.firstName || ''} ${S.user.lastName || ''}`;
    const avatarUrl = getAvatarUrl(S.user);
    const initial = ((S.user.firstName?.[0] || 'U') + (S.user.lastName?.[0] || '')).toUpperCase();

    ['sbAvatar', 'tbAvatar', 'settingsAv'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (avatarUrl) {
                el.innerHTML = `<img src="${avatarUrl}" alt="${initial}" class="avatar-img">`;
                el.style.background = 'transparent';
            } else {
                el.textContent = initial;
                el.style.background = 'linear-gradient(135deg,var(--primary),var(--secondary))';
            }
        }
    });

    ['sbName', 'settingsName'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = nm
            .trim(); });
    const sl = document.getElementById('sbLevel');
    if (sl) { const tier = S.user.roles?.includes('admin') ? 'Admin' : S.isPremium ? 'Premium' : 'Free';
        sl.textContent = `⚡ Lvl ${S.user.level || 1} · ${tier}`; }
    if (document.getElementById('setEmail')) document.getElementById('setEmail').value = S.user.email || '';
    if (document.getElementById('setFirstName')) document.getElementById('setFirstName').value = S.user.firstName ||
        '';
    if (document.getElementById('setLastName')) document.getElementById('setLastName').value = S.user.lastName ||
        '';
    if (document.getElementById('setPhone')) document.getElementById('setPhone').value = S.user.phone || '';
    if (document.getElementById('setBio')) document.getElementById('setBio').value = S.user.bio || '';
    if (document.getElementById('setLocation')) document.getElementById('setLocation').value = S.user.location ||
        '';
    if (document.getElementById('tbWallet')) document.getElementById('tbWallet').textContent = fmtMoneyAPI(S
        .walletBal);
    const refCode = S.user?.referralCode || 'REF';
    if (document.getElementById('refLink')) document.getElementById('refLink').textContent =
        `${FRONTEND_URL}/?ref=${refCode}`;
    if (document.getElementById('refCode')) document.getElementById('refCode').textContent = refCode;
    if (document.getElementById('wizRefCode')) document.getElementById('wizRefCode').textContent = refCode;
    const hasCreatorAccess = S.isPremium || S.user?.roles?.includes('admin') || (S.user?.roles?.includes('creator') &&
        S.user?.isApprovedInstructor);
    document.getElementById('instVerifiedBadge').textContent = hasCreatorAccess ? 'Verified' : 'Free';
    const navInstructor = document.getElementById('nav-instructor');
    if (navInstructor) navInstructor.style.display = hasCreatorAccess ? '' : 'none';
    const navCourseEditor = document.getElementById('nav-course-editor');
    if (navCourseEditor) navCourseEditor.style.display = hasCreatorAccess ? '' : 'none';
    const fab = document.getElementById('fab');
    if (fab) fab.style.display = hasCreatorAccess ? 'block' : 'none';
    renderCurrencySelectorUI();
    const navRefBadge = document.getElementById('navRefBadge');
    if (navRefBadge) navRefBadge.textContent = S.referrals?.length || 0;
    const navAffBadge = document.getElementById('navAffBadge');
    if (navAffBadge) navAffBadge.textContent = S.myAffiliateLinks?.length || 0;
    const navCoursesCnt = document.getElementById('navCoursesCnt');
    if (navCoursesCnt) navCoursesCnt.textContent = S.enrollments?.length || 0;
    const navFollowingBadge = document.getElementById('navFollowingBadge');
    if (navFollowingBadge) navFollowingBadge.textContent = S.following?.length || 0;
    const followersCountEl = document.getElementById('followersCount');
    if (followersCountEl) followersCountEl.textContent = S.followersCount || 0;
    updatePremiumUI();
    updateSocialBadge();
    if (S.dp === 'feed' || S.dp === 'home' || S.dp === 'explore' || S.dp === 'books') {
        loadSidebarAd();
        loadBottomAd();
    }
    const navUploadCourse = document.getElementById('nav-premium-upload');
    const navUploadBook = document.getElementById('nav-create-book');
    const isPremium = S.isPremium;
    if (navUploadCourse) navUploadCourse.style.display = isPremium ? '' : 'none';
    if (navUploadBook) navUploadBook.style.display = isPremium ? '' : 'none';
    const adminLi = document.getElementById('adminNavLi');
    if (adminLi) adminLi.style.display = (S.user?.roles?.includes('admin') || S.user?.role === 'admin' || S.user
        ?.role === 'superadmin') ? '' : 'none';
}

export function updatePremiumUI() {
    const isPremium = S.isPremium;
    document.querySelectorAll('.premium-only').forEach(el => {
        el.style.display = isPremium ? '' : 'none';
    });
    const navCreateBook = document.getElementById('nav-create-book');
    if (navCreateBook) navCreateBook.style.display = isPremium ? '' : 'none';
    const navPremUpload = document.getElementById('nav-premium-upload');
    if (navPremUpload) navPremUpload.style.display = isPremium ? '' : 'none';
    if (isPremium && S.dp === 'create-book') {
        const container = document.getElementById('dash-create-book');
        if (container) {
            container.style.display = 'block';
            container.classList.add('active');
        }
    }
    const upgradeBanner = document.getElementById('homeUpgradeBanner');
    if (upgradeBanner) upgradeBanner.style.display = isPremium ? 'none' : 'block';
    document.querySelectorAll('.premium-badge').forEach(el => {
        el.textContent = isPremium ? '✅ Premium' : '🔓 Free';
        el.className = `badge ${isPremium ? 'badge-premium' : 'badge-dark'}`;
    });
    document.querySelectorAll('.ad-container').forEach(container => {
        container.style.display = isPremium ? 'none' : '';
    });
    if ((S.dp === 'create-book' || S.dp === 'premium-upload-course') && !isPremium) {
        toast('Premium required', 'warning');
        setDP('home');
    }
    const navUploadCourse = document.getElementById('nav-premium-upload');
    const navUploadBook = document.getElementById('nav-create-book');
    if (navUploadCourse) navUploadCourse.style.display = isPremium ? '' : 'none';
    if (navUploadBook) navUploadBook.style.display = isPremium ? '' : 'none';
}

export function renderHomeDashboard() {
    const el = document.getElementById('homeContent');
    if (!el) return;
    const completedCnt = S.enrollments.filter(e => e.status === 'completed' || e.progress === 100).length;
    const inProgress = S.enrollments.filter(e => e.status === 'active' || (e.progress > 0 && e.progress < 100));
    const refCnt = S.referrals?.length || S.user?.referralCount || 0;
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning 👋' : h < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
    const streak = S.user?.streak || S.user?.streakDays || 0;
    const level = S.user?.level || 1;
    const xp = S.user?.xp || 0;
    const xpNext = level * 1000;
    const xpProgress = Math.min(100, Math.round((xp / xpNext) * 100));
    const showUpgrade = !S.isPremium && !S.user?.roles?.includes('admin');
    const postCount = S.posts?.length || 0;
    const followersCount = S.following?.length || 0;
    const totalEarnings = S.user?.walletBalance || 0;
    const socialEarnings = S.socialTotalEarnings || 0;

    el.innerHTML = `
            <div class="dash-grid">
                <div class="dash-left">
                    <div id="homeUpgradeBanner" style="display:${showUpgrade ? 'block' : 'none'};background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(251,146,60,.05));border:1px solid rgba(212,175,55,.2);border-radius:var(--radius);padding:1rem;margin-bottom:1rem">
                        <div class="d-flex items-center gap-3 flex-wrap">
                            <div class="si si-gold"><i class="fas fa-crown"></i></div>
                            <div style="flex:1"><strong style="font-size:.88rem">Unlock Course Creation!</strong><br><span style="font-size:.76rem;color:var(--text3)">Go Premium to create courses, earn affiliates & remove ads</span></div>
                            <button class="btn btn-gold btn-sm" onclick="openModal('premiumModal')"><i class="fas fa-crown"></i>Upgrade — ₦5k/mo</button>
                        </div>
                    </div>
                    <div class="welcome-banner">
                        <div>
                            <div style="font-size:.7rem;color:var(--text3);margin-bottom:.28rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.07em">${greet}</div>
                            <h2 style="font-size:1.35rem;margin-bottom:.15rem">${S.user?.firstName || 'User'} ${S.user?.lastName || ''}</h2>
                            <p style="color:var(--text3);font-size:.8rem;margin:0">You're on a <strong style="color:var(--primary)">${streak}-day streak</strong>! 🔥</p>
                        </div>
                        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                            <span class="badge badge-gold"><i class="fas fa-star"></i>Level ${level}</span>
                            <span class="badge badge-danger"><i class="fas fa-fire"></i>${streak} Streak</span>
                            <span class="badge badge-premium">${S.user?.roles?.includes('admin') ? '<i class="fas fa-shield-alt"></i>Admin' : S.isPremium ? '<i class="fas fa-crown"></i>Premium' : '<i class="fas fa-user"></i>Free'}</span>
                        </div>
                    </div>
                    <div class="card card-sm mb-3">
                        <div style="display:flex;justify-content:space-between;margin-bottom:.42rem">
                            <span style="font-size:.79rem;color:var(--text2)">XP → <strong style="color:var(--primary)">Level ${level}</strong></span>
                            <span style="font-size:.79rem;color:var(--gold);font-weight:800;font-family:var(--font-heading)">${xp.toLocaleString()} / ${xpNext.toLocaleString()}</span>
                        </div>
                        <div class="prog" style="height:7px"><div class="prog-fill pf-primary" style="width:${xpProgress}%"></div></div>
                    </div>
                    <div class="earnings-grid mb-4">
                        <div class="earning-stat"><div class="es-icon">💰</div><div class="es-value">${fmtMoneyAPI(totalEarnings)}</div><div class="es-label">Total Earned</div></div>
                        <div class="earning-stat"><div class="es-icon">📝</div><div class="es-value">${postCount}</div><div class="es-label">Posts</div></div>
                        <div class="earning-stat"><div class="es-icon">👥</div><div class="es-value">${followersCount}</div><div class="es-label">Following</div></div>
                        <div class="earning-stat"><div class="es-icon">🌱</div><div class="es-value">${fmtMoneyAPI(socialEarnings)}</div><div class="es-label">Social Earnings</div></div>
                    </div>
                    <div class="card card-p">
                        <div class="d-flex items-center justify-between mb-3 flex-wrap" style="gap:.4rem">
                            <h6 style="margin:0">Continue Learning</h6>
                            <button class="btn btn-ghost btn-sm" onclick="setDP('courses')">View all</button>
                        </div>
                        ${inProgress.length ? inProgress.slice(0, 3).map(e => { const cId = extractCourseId(e); if (!cId) return ''; return `<div style="display:flex;align-items:center;gap:.75rem;padding:.65rem 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="import('./courses.js').then(({openEnrollmentLesson})=>openEnrollmentLesson('${cId}','${e._id}'))"><div style="width:36px;height:36px;background:var(--card2);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.1rem">📚</div><div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600">${e.course?.title || 'Course'}</div><div class="prog mt-1" style="height:4px"><div class="prog-fill pf-primary" style="width:${e.progress || 0}%"></div></div><div style="font-size:.68rem;color:var(--text3);margin-top:.2rem">${e.progress || 0}% complete</div></div><button class="btn btn-primary btn-sm" style="font-size:.68rem;padding:.2rem .55rem">Continue</button></div>`; }).join('') : '<div class="empty-state"><i class="fas fa-book-open"></i><h4>No courses yet</h4><p>Explore and enroll in courses to start learning!</p></div>'}
                    </div>
                </div>
                <div class="dash-right">
                    <div class="card card-p mb-3" style="padding:.5rem .75rem;">
                        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem;margin-bottom:.3rem">
                            <h6 style="margin:0">📰 Feed</h6>
                            <button class="btn btn-primary btn-sm" onclick="setDP('feed')">View Full Feed</button>
                        </div>
                        <div id="feedContainer" style="max-height:600px;overflow-y:auto;padding-right:4px;"></div>
                        <div id="feedSentinel"></div>
                    </div>
                </div>
            </div>
        `;
    if (document.getElementById('feedContainer') && !document.querySelector('#feedContainer .post-card')) {
        import('./feed.js').then(({ loadFeed }) => loadFeed(1));
    }
    loadSidebarAd();
    loadBottomAd();
}

function extractCourseId(enrollment) {
    if (enrollment.course && typeof enrollment.course === 'object' && enrollment.course._id) return enrollment.course
        ._id;
    if (typeof enrollment.course === 'string') return enrollment.course;
    if (enrollment.courseId && typeof enrollment.courseId === 'string') return enrollment.courseId;
    if (enrollment.course && enrollment.course.id) return enrollment.course.id;
    return null;
}

export async function checkPlanExpiry() {
    const expiryDate = S.user?.subscriptionExpires;
    if (!expiryDate) {
        document.getElementById('planWarning').style.display = 'none';
        return;
    }
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7 && daysLeft > 0) {
        const warning = document.getElementById('planWarning');
        warning.style.display = 'flex';
        let urgency = daysLeft <= 3 ? '⚠️ URGENT: ' : '';
        document.getElementById('planWarningText').innerHTML =
            `${urgency}Your Premium plan expires in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. ${daysLeft <= 3 ? 'Renew now to avoid losing premium features!' : 'Renew to keep earning.'}`;
        if (!S.planExpiryWarningShown) {
            toast(`⚠️ Premium expires in ${daysLeft} days!`, 'warning');
            S.planExpiryWarningShown = true;
        }
    } else if (daysLeft <= 0 && S.isPremium) {
        const warning = document.getElementById('planWarning');
        warning.style.display = 'flex';
        document.getElementById('planWarningText').textContent =
            '🔓 Your Premium plan has expired. You have been reverted to free plan. Subscribe again to regain premium features.';
        toast('🔓 Premium has expired', 'error');
        await refreshUserData();
    } else {
        document.getElementById('planWarning').style.display = 'none';
    }
}

async function refreshUserData() {
    try {
        const res = await apiCall('/users/profile');
        S.user = res.data || res;
        S.isPremium = S.user.isPremium || false;
        localStorage.setItem('cx_user', JSON.stringify(S.user));
        updateUserUI();
        import('./payments.js').then(({ renderWallet }) => renderWallet());
        updatePremiumUI();
    } catch (err) {
        console.warn('Could not refresh user data:', err);
    }
}

function loadSidebarAd() {
    if (!S.isPremium) {
        import('./admin.js').then(({ getNextAd, renderAdCard, trackAdImpression }) => {
            const ad = getNextAd('sidebar');
            if (ad) {
                const container = document.getElementById('sidebarAdContent');
                if (!container) return;
                container.innerHTML = `
                        <div class="ad-card" style="margin: 10px 0;">
                            <div class="ad-label">📢 Sponsor</div>
                            <a href="${ad.data.linkUrl}" target="_blank" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom')">
                                ${ad.data.imageUrl ? `<img src="${ad.data.imageUrl}" style="width:100%; border-radius:8px;">` : ''}
                                <div class="ad-title">${escapeHtml(ad.data.title)}</div>
                            </a>
                        </div>
                    `;
                document.getElementById('sidebarAd').style.display = 'block';
                trackAdImpression(ad.data._id, null, 'custom');
            } else {
                document.getElementById('sidebarAd').style.display = 'none';
            }
        });
    } else {
        document.getElementById('sidebarAd').style.display = 'none';
    }
}

function loadBottomAd() {
    if (!S.isPremium) {
        import('./admin.js').then(({ getNextAd, trackAdImpression, escapeHtml }) => {
            const ad = getNextAd('sidebar');
            if (ad) {
                const container = document.getElementById('bottomAdContent');
                if (!container) return;
                container.innerHTML = `
                        <div class="ad-card" style="margin:0;padding:4px;border:none;background:transparent;">
                            <a href="${ad.data.linkUrl}" target="_blank" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom')">
                                ${ad.data.imageUrl ? `<img src="${ad.data.imageUrl}" style="max-height:60px;border-radius:4px;">` : `<span style="font-size:.7rem;color:var(--text2)">${escapeHtml(ad.data.title)}</span>`}
                            </a>
                        </div>
                    `;
                document.getElementById('bottomAdBanner').style.display = 'block';
                trackAdImpression(ad.data._id, null, 'custom');
            } else {
                document.getElementById('bottomAdBanner').style.display = 'none';
            }
        });
    } else {
        document.getElementById('bottomAdBanner').style.display = 'none';
    }
}

async function updateSocialBadge() {
    try {
        const res = await apiCall('/posts/my/social-earnings');
        const total = res.data?.totalEarnings || 0;
        const badge = document.getElementById('navSocialBadge');
        if (badge) badge.textContent = fmtMoneyAPI(total);
        S.socialTotalEarnings = total;
    } catch (e) { console.warn('Could not update social badge:', e); }
}

// Export for router
export function goPage(pg) {
    import('./router.js').then(({ goPage }) => goPage(pg));
}
