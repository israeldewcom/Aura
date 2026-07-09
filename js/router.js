// js/router.js
import { S } from './state.js';
import { goPage as originalGoPage, setDP as originalSetDP } from './dashboard.js';

export function navigateTo(url) {
    const cleanUrl = url.startsWith('/') ? url : '/' + url;
    window.history.pushState({}, '', cleanUrl);
    handleRoute(cleanUrl);
}

export function handleRoute(path) {
    const url = path || window.location.pathname;
    S.currentRoute = url;

    // Check if user is logged in
    const token = localStorage.getItem('cx_accessToken');
    const isLoggedIn = !!token;

    // Route map
    const routes = {
        '/': () => goPage('landing'),
        '/login': () => goPage('login'),
        '/register': () => goPage('register'),
        '/setup': () => goPage('setup'),
        '/contact': () => goPage('contact'),
        '/feed': () => { if (isLoggedIn) setDP('feed'); else goPage('login'); },
        '/explore': () => { if (isLoggedIn) setDP('explore'); else goPage('login'); },
        '/wallet': () => { if (isLoggedIn) setDP('wallet'); else goPage('login'); },
        '/profile': () => { if (isLoggedIn) setDP('profile'); else goPage('login'); },
        '/settings': () => { if (isLoggedIn) setDP('settings'); else goPage('login'); },
        '/admin': () => { if (isLoggedIn && S.user?.roles?.includes('admin')) setDP('admin'); else goPage('login'); },
        '/home': () => { if (isLoggedIn) setDP('home'); else goPage('login'); },
        '/courses': () => { if (isLoggedIn) setDP('courses'); else goPage('login'); },
        '/books': () => { if (isLoggedIn) setDP('books'); else goPage('login'); },
        '/challenges': () => { if (isLoggedIn) setDP('challenges'); else goPage('login'); },
        '/people': () => { if (isLoggedIn) setDP('people'); else goPage('login'); },
        '/following': () => { if (isLoggedIn) setDP('following'); else goPage('login'); },
        '/affiliates': () => { if (isLoggedIn) setDP('affiliates'); else goPage('login'); },
        '/leaderboard': () => { if (isLoggedIn) setDP('leaderboard'); else goPage('login'); },
        '/referrals': () => { if (isLoggedIn) setDP('referrals'); else goPage('login'); },
        '/instructor': () => { if (isLoggedIn) setDP('instructor'); else goPage('login'); },
        '/course-editor': () => { if (isLoggedIn) setDP('course-editor'); else goPage('login'); },
        '/ai': () => { if (isLoggedIn) setDP('ai'); else goPage('login'); },
        '/social-earnings': () => { if (isLoggedIn) setDP('social-earnings'); else goPage('login'); },
        '/sponsorship': () => { if (isLoggedIn) setDP('sponsorship'); else goPage('login'); },
        '/tools': () => { if (isLoggedIn) setDP('tools'); else goPage('login'); },
        '/badges': () => { if (isLoggedIn) setDP('badges'); else goPage('login'); },
        '/manual-payments': () => { if (isLoggedIn) setDP('manual-payments'); else goPage('login'); },
        '/purchased-articles': () => { if (isLoggedIn) setDP('purchased-articles'); else goPage('login'); },
    };

    if (routes[url]) {
        routes[url]();
        return;
    }

    // Dynamic routes
    const postMatch = url.match(/^\/post\/(.+)/);
    if (postMatch) {
        if (isLoggedIn) {
            import('./posts.js').then(({ loadPostBySlug }) => loadPostBySlug(postMatch[1]));
        } else goPage('login');
        return;
    }

    const courseMatch = url.match(/^\/course\/(.+)/);
    if (courseMatch) {
        if (isLoggedIn) {
            import('./courses.js').then(({ openBuyCourse }) => {
                const slug = courseMatch[1];
                const course = (S.appCourses || []).find(c => c.slug === slug || c._id === slug);
                if (course) openBuyCourse(course._id);
                else {
                    apiCall(`/courses/slug/${slug}`).then(res => {
                        if (res.data) openBuyCourse(res.data._id);
                        else toast('Course not found', 'error');
                    }).catch(() => toast('Course not found', 'error'));
                }
            });
        } else goPage('login');
        return;
    }

    const bookMatch = url.match(/^\/book\/(.+)/);
    if (bookMatch) {
        if (isLoggedIn) {
            import('./books.js').then(({ openBookDetail }) => {
                const slug = bookMatch[1];
                const book = S.books.find(b => b.slug === slug || b._id === slug);
                if (book) openBookDetail(book._id);
                else {
                    apiCall(`/books/slug/${slug}`).then(res => {
                        if (res.data) openBookDetail(res.data._id);
                        else toast('Book not found', 'error');
                    }).catch(() => toast('Book not found', 'error'));
                }
            });
        } else goPage('login');
        return;
    }

    const userMatch = url.match(/^\/user\/(.+)/);
    if (userMatch) {
        if (isLoggedIn) {
            import('./people.js').then(({ openUserProfile }) => openUserProfile(userMatch[1]));
        } else goPage('login');
        return;
    }

    // Fallback
    if (isLoggedIn) {
        import('./dashboard.js').then(({ setDP }) => setDP('feed'));
    } else goPage('landing');
}

// Override goPage to also update URL
export function goPage(pg) {
    originalGoPage(pg);
    if (pg === 'app' && S.dp) {
        const path = '/' + S.dp;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
    } else if (pg === 'landing') {
        if (window.location.pathname !== '/') {
            window.history.pushState({}, '', '/');
        }
    }
}

// Override setDP to update URL
export function setDP(pg) {
    originalSetDP(pg);
    if (S.page === 'app') {
        const path = '/' + pg;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
    }
}

export function initRouter() {
    // Handle initial route
    const path = window.location.pathname;
    const token = localStorage.getItem('cx_accessToken');
    const isLoggedIn = !!token;

    if (path !== '/' && path !== '/login' && path !== '/register' && path !== '/setup' && path !== '/contact') {
        handleRoute(path);
    } else if (path === '/' && isLoggedIn) {
        import('./dashboard.js').then(({ setDP }) => setDP('feed'));
    }

    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode && !isLoggedIn) {
        localStorage.setItem('cx_pending_ref', refCode);
        toast('🎯 Referral code detected! You\'ll get a bonus when you sign up.', 'info');
    }
}

export function smoothTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
