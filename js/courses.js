import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal } from './ui.js';

const COURSES_API = '/courses';

// ─── EXPLORE ─────────────────────────────────────────────────────────────

export async function renderExplore() {
    showLoading('Loading courses...');
    try {
        const data = await apiCall('/courses?published=true&limit=50');
        const raw = data.data || data || [];
        S.appCourses = Array.isArray(raw) ? raw : (raw.courses || []);
        if (!S.isPremium) {
            await import('./admin.js').then(({ loadAds }) => loadAds('explore'));
        }
        document.getElementById('exploreGrid').innerHTML = buildExploreCourseCards(S.appCourses);
        loadSidebarAd();
        loadBottomAd();
    } catch (e) { S.appCourses = [];
        document.getElementById('exploreGrid').innerHTML =
            `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Could not load courses</h4><p>${e.message}</p></div>`; } finally { hideLoading(); }
}

function buildExploreCourseCards(list) {
    if (!Array.isArray(list)) return '<div class="empty-state"><p>Loading courses...</p></div>';
    const showAds = !S.isPremium && shouldShowAd('explore');
    const adFrequency = 4;
    let html = '';
    const filtered = list.filter(c => c && c._id);

    filtered.forEach((c, idx) => {
        const price = c.displayPrice || c.price || 0;
        const instructorName = c.instructor?.firstName || 'Instructor';
        const lessonCount = c.totalLessons || (Array.isArray(c.lessons) ? c.lessons.length : 0);
        const views = c.views || 0;
        html += `<div class="course-card" onclick="openBuyCourse('${c._id}')"><div class="cc-img" style="background:linear-gradient(135deg,var(--card2),var(--card3))">${c.thumbnail || c.emoji || '📚'}</div><div class="cc-bar"><div class="cc-fill pf-primary" style="width:${c.progress || 0}%"></div></div><div class="cc-body"><div style="font-size:.82rem;font-weight:700;margin-bottom:.25rem">${c.title || 'Course'}</div><div style="font-size:.73rem;color:var(--text3);margin-bottom:.4rem">${instructorName} · ${lessonCount} lessons · ${c.level || 'All'}</div><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-weight:800;color:var(--lime)">${fmtMoneyAPI(price)}</div>${c.hasAffiliate ? `<span class="badge badge-violet" style="font-size:.58rem">${c.affiliatePercent || 0}% aff</span>` : ''}</div><div style="font-size:.7rem;color:var(--text3);margin-top:.3rem"><i class="fas fa-eye"></i> ${views}</div></div></div>`;

        if (showAds && (idx + 1) % adFrequency === 0 && idx < filtered.length - 1) {
            const ad = getNextAd('explore');
            if (ad) {
                if (ad.type === 'custom') {
                    html += `<div style="grid-column:1/-1;">${renderSponsoredCourse(ad)}</div>`;
                    const adId = ad.data?._id;
                    if (adId) trackAdImpression(adId, null, 'custom');
                } else if (ad.type === 'adsterra') {
                    html += `<div style="grid-column:1/-1;"><div class="ad-card adsterra-wrapper"><div class="ad-label">📢 Sponsored</div><div style="text-align:center;padding:.5rem;color:var(--text3);font-size:.7rem;">Advertisement</div></div></div>`;
                }
            }
        }
    });

    if (!html) {
        return '<div class="empty-state"><i class="fas fa-search"></i><h4>No courses found</h4></div>';
    }
    return html;
}

function renderSponsoredCourse(ad) {
    if (!ad || !ad.data) return '';
    const d = ad.data;
    return `
                <div class="course-card sponsored" style="border: 2px solid var(--primary);">
                    <div class="cc-img" style="background: linear-gradient(135deg, var(--card2), var(--card3));">
                        ${d.imageUrl ? `<img src="${d.imageUrl}" style="width:100%;height:100%;object-fit:cover;">` : '📢'}
                    </div>
                    <div class="cc-body">
                        <div style="font-size:0.7rem; color:var(--gold);" class="sponsored-badge">⭐ Sponsored</div>
                        <div style="font-weight:700;font-size:.85rem;">${escapeHtml(d.title)}</div>
                        <a href="${d.linkUrl}" target="_blank" class="btn btn-ghost btn-sm mt-2" onclick="handleAdClick('${d._id}','${d.linkUrl}','','custom')">Learn More</a>
                    </div>
                </div>
            `;
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

function trackAdImpression(adId, postId, network = 'custom') {
    if (!postId) return;
    const key = `ad_imp_${adId}_${postId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackAdRevenue(adId, 'impression', postId, network);
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

function handleAdClick(adId, linkUrl, postId, network = 'custom') {
    if (postId) { trackAdRevenue(adId, 'click', postId, network); }
    window.open(linkUrl, '_blank');
}

function loadSidebarAd() {
    // handled elsewhere
}

function loadBottomAd() {
    // handled elsewhere
}

export function filterExplore() {
    const q = (document.getElementById('exploreSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('exploreCat')?.value || '';
    const lev = document.getElementById('exploreLevel')?.value || '';
    let list = Array.isArray(S.appCourses) ? S.appCourses : [];
    if (q) list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    if (cat) list = list.filter(c => c.category === cat);
    if (lev) list = list.filter(c => c.level === lev);
    document.getElementById('exploreGrid').innerHTML = list.length ? buildExploreCourseCards(list) :
        '<div class="empty-state"><i class="fas fa-search"></i><h4>No courses found</h4></div>';
}

// ─── BUY COURSE ──────────────────────────────────────────────────────────

export function openBuyCourse(courseId) {
    const c = (S.appCourses || []).find(x => x._id === courseId);
    if (!c) { toast('Course not found', 'error'); return; }
    const token = localStorage.getItem('cx_accessToken');
    if (token) { trackCourseView(courseId); }
    if ((c.price === 0 || c.price == null) && (c.salePrice === 0 || c.salePrice == null)) {
        if (!S.loggedIn) { toast('Please log in to enroll', 'warning');
            goPage('login'); return; }
        apiCall(`/courses/${c._id}/enroll`, { method: 'POST' }).then(() => { toast('✅ Free course enrolled!',
                'success');
            loadEnrollments();
            setDP('courses'); }).catch(err => toast(err.message, 'error'));
        return;
    }
    if (c.price > 0 && !S.isPremium && !S.user?.roles?.includes('admin')) { toast(
            'This course requires a Premium subscription', 'warning');
        openModal('premiumModal'); return; }
    S.currentBuyCourse = c;
    window.currentPaymentType = 'course';
    window.currentManualCourseId = courseId;
    const price = c.salePrice || c.price || 0;
    document.getElementById('buyCourseInfo').innerHTML =
        `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm)"><div style="font-size:2rem">${c.thumbnail || c.emoji || '📚'}</div><div><div style="font-weight:700;font-size:.92rem">${c.title}</div><div style="font-size:.75rem;color:var(--text3)">${c.instructor?.firstName || 'Instructor'} · ${c.totalLessons || 0} lessons · 👁️ ${c.views || 0}</div></div></div>`;
    document.getElementById('buyCourseSummary').innerHTML =
        `<div class="pay-summary-row"><span>Course Price</span><span>${fmtMoneyAPI(c.price || 0)}</span></div><div class="pay-summary-row"><span style="font-weight:700">Total</span><span style="color:var(--primary);font-weight:800">${fmtMoneyAPI(price)}</span></div>`;
    document.getElementById('paystackBtnText').textContent = `Pay ${fmtMoneyAPI(price)} with Paystack`;
    document.getElementById('manualAmount').value = price;
    document.getElementById('buyRefCode').value = '';
    document.getElementById('buyCodeStatus').textContent = '';
    document.getElementById('buyManualRefCode').value = '';
    document.getElementById('buyManualCodeStatus').textContent = '';
    document.getElementById('manualRef').value = '';
    document.getElementById('manualDate').value = '';
    document.getElementById('manualReceipt').value = '';
    document.getElementById('receiptPreview').style.display = 'none';
    import('./payments.js').then(({ populateAllBankDetailsBoxes, toggleBuyPaymentMethod }) => {
        populateAllBankDetailsBoxes();
        toggleBuyPaymentMethod('card', document.querySelector('#buyCourseModal .payment-method-tab'));
    });
    openModal('buyCourseModal');
}

export async function trackCourseView(courseId) {
    if (!courseId) return;
    try {
        await apiCall(`/courses/${courseId}/view`, { method: 'POST' });
    } catch (e) { console.warn('Could not track course view:', e); }
}

// ─── LESSON VIEWER ──────────────────────────────────────────────────────

export function openEnrollmentLesson(courseId, enrollmentId) {
    if (courseId && typeof courseId === 'object') { courseId = courseId._id || courseId.id || null; }
    if (!courseId || courseId === 'undefined' || courseId === 'null') { toast('Invalid course.', 'error'); return; }
    S.currentCourseId = courseId;
    S.currentEnrollmentId = enrollmentId;
    trackCourseView(courseId);
    loadCourseForLesson(courseId);
    setDP('lesson');
}

export async function loadCourseForLesson(courseId) {
    try {
        const data = await apiCall(`/courses/${courseId}`);
        S.currentCourseData = data.data || data;
        S.currentLessons = Array.isArray(S.currentCourseData.lessons) ? S.currentCourseData.lessons : (S
            .currentCourseData.sections?.flatMap(s => s.lessons) || []);
        if (S.currentCourseData.quizzes && S.currentCourseData.quizzes.length) {
            const quizContainer = document.getElementById('quizWrap');
            if (quizContainer) {
                const quizHtml = S.currentCourseData.quizzes.map(q => `
                                <div class="quiz-display">
                                    <div class="quiz-title">📝 ${escapeHtml(q.title || 'Quiz')}</div>
                                    ${q.questions?.map((qu, qi) => `<div class="quiz-question"><div class="quiz-q-text">${qi + 1}. ${escapeHtml(qu.question)}</div><ul class="quiz-options">${qu.options?.map((opt, oi) => `<li class="${qu.correctAnswer === oi ? 'correct' : ''}">${escapeHtml(opt)} ${qu.correctAnswer === oi ? '✅' : ''}</li>`).join('')}</ul></div>`).join('')}
                                </div>`).join('');
                quizContainer.innerHTML = quizHtml;
            }
        }
        displayCourseRatings();
        S.currentLessonIdx = 0;
        renderCurric();
        const firstLesson = S.currentLessons[0];
        if (firstLesson && firstLesson._id) loadInteractiveMaterials(firstLesson._id);
        updateSEO({ title: S.currentCourseData.title, description: S.currentCourseData.subtitle || S
                .currentCourseData.description?.substring(0, 160), thumbnail: S.currentCourseData
                .thumbnail || S.currentCourseData.emoji });
    } catch (e) { toast('Could not load course: ' + e.message, 'error'); }
}

function displayCourseRatings() {
    const container = document.getElementById('courseRatingsContainer');
    if (!container) return;
    const ratings = S.currentCourseData?.ratings || [];
    if (!ratings.length) {
        container.innerHTML =
            '<p style="color:var(--text3);font-size:.85rem;">No reviews yet. Be the first to rate this course!</p>';
        return;
    }
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    const totalReviews = ratings.length;
    const fullStars = Math.floor(avg);
    const halfStar = avg - fullStars >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    const starsHtml = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
    let html =
        `<div style="margin-bottom:.75rem"><span class="rating-average">${avg.toFixed(1)}</span> <span class="rating-stars">${starsHtml}</span> <span class="rating-count">(${totalReviews} review${totalReviews > 1 ? 's' : ''})</span></div>`;
    ratings.forEach(r => {
        const userStars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        html += `<div style="padding:.5rem 0;border-bottom:1px solid var(--border);"><div class="rating-stars">${userStars}</div><div style="font-weight:600;font-size:.85rem;">${escapeHtml(r.userId?.firstName || 'User')} ${escapeHtml(r.userId?.lastName || '')}</div>${r.review ? `<div style="font-size:.85rem;color:var(--text2);margin-top:.2rem;">${escapeHtml(r.review)}</div>` : ''}<div style="font-size:.7rem;color:var(--text3);margin-top:.1rem;">${new Date(r.createdAt).toLocaleDateString()}</div></div>`;
    });
    container.innerHTML = html;
}

// ─── CURRICULUM ─────────────────────────────────────────────────────────

export function renderCurric() {
    const list = document.getElementById('curricList');
    if (!list) return;
    const lessons = Array.isArray(S.currentLessons) ? S.currentLessons : [];
    if (!lessons.length) { if (list) list.innerHTML =
            '<div class="empty-state"><p>Select a course to view lessons</p></div>'; return; }
    list.innerHTML = lessons.map((l, i) =>
        `<div class="curric-item ${l.completed ? 'done' : ''} ${i === S.currentLessonIdx ? 'active' : ''}" onclick="jumpToLesson(${i})"><div class="ci-num">${l.completed ? '<i class="fas fa-check" style="font-size:.55rem"></i>' : (l.order || i + 1)}</div><div class="lesson-type-badge lt-${l.type === 'video' ? 'video' : l.type === 'quiz' ? 'quiz' : 'text'}" style="width:20px;height:20px;font-size:.6rem"><i class="fas fa-${l.type === 'video' ? 'play' : l.type === 'quiz' ? 'question-circle' : 'file-alt'}"></i></div><div style="flex:1;min-width:0"><div style="font-size:.79rem;font-weight:${i === S.currentLessonIdx ? '600' : '400'}">${l.title || 'Lesson ' + (i + 1)}</div><div style="font-size:.65rem;color:var(--text3)">${l.duration || 0} mins</div></div></div>`
    ).join('');
    const done = lessons.filter(l => l.completed).length;
    const total = lessons.length;
    const curricBar = document.getElementById('curricBar');
    if (curricBar) curricBar.style.width = total ? Math.round((done / total) * 100) + '%' : '0%';
    const progressEl = document.getElementById('curricProgress');
    if (progressEl) progressEl.textContent = `${done}/${total}`;
    const lpDone = document.getElementById('lpLessonsDone');
    if (lpDone) lpDone.textContent = `${done}/${total}`;
    const navInd = document.getElementById('lessonNavIndicator');
    if (navInd) navInd.textContent = `${S.currentLessonIdx + 1} of ${total}`;
    S.lessonStartTime = Date.now();
    updateLessonInfo();
    const currentLesson = lessons[S.currentLessonIdx];
    if (currentLesson && currentLesson._id) loadInteractiveMaterials(currentLesson._id);
    if (S.currentCourseData?.ratings) {
        document.getElementById('courseRatingsContainer').innerHTML = renderCourseRatings(S.currentCourseData.ratings);
    }
    if (S.currentCourseData?.ratings) {
        document.getElementById('reviewsListContainer').innerHTML = renderCourseRatings(S.currentCourseData.ratings);
    }
}

function renderCourseRatings(ratings) {
    if (!ratings || !ratings.length) {
        return '<p style="color:var(--text3);font-size:.85rem;">No reviews yet. Be the first to rate this course!</p>';
    }
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    const totalReviews = ratings.length;
    const fullStars = Math.floor(avg);
    const halfStar = avg - fullStars >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    const starsHtml = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
    let html =
        `<div style="margin-bottom:.75rem"><span class="rating-average">${avg.toFixed(1)}</span> <span class="rating-stars">${starsHtml}</span> <span class="rating-count">(${totalReviews} review${totalReviews > 1 ? 's' : ''})</span></div>`;
    ratings.forEach(r => {
        const userStars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        html += `<div style="padding:.5rem 0;border-bottom:1px solid var(--border);"><div class="rating-stars">${userStars}</div><div style="font-weight:600;font-size:.85rem;">${escapeHtml(r.userId?.firstName || 'User')} ${escapeHtml(r.userId?.lastName || '')}</div>${r.review ? `<div style="font-size:.85rem;color:var(--text2);margin-top:.2rem;">${escapeHtml(r.review)}</div>` : ''}<div style="font-size:.7rem;color:var(--text3);margin-top:.1rem;">${new Date(r.createdAt).toLocaleDateString()}</div></div>`;
    });
    return html;
}

function updateLessonInfo() {
    const l = S.currentLessons[S.currentLessonIdx];
    if (!l) return;
    const titleEl = document.getElementById('currentLessonTitle');
    if (titleEl) titleEl.textContent = `${l.title || 'Lesson'} — ${l.order || S.currentLessonIdx + 1}`;
    const overviewTitle = document.getElementById('lessonOverviewTitle');
    if (overviewTitle) overviewTitle.textContent = l.title || 'Lesson';
    const descEl = document.getElementById('lessonOverviewDesc');
    if (descEl) {
        let desc = l.description || (l.content || '').replace(/<[^>]*>/g, '').substring(0, 300) ||
            `Learn about "${l.title}" in this ${l.type || 'video'} lesson.`;
        descEl.innerHTML = desc;
    }
    const courseTitleEl = document.getElementById('currentCourseTitle');
    if (courseTitleEl) courseTitleEl.textContent = S.currentCourseData?.title || '';
    const wrap = document.getElementById('lessonVideoWrap');
    if (wrap) {
        if (l.type === 'video' && l.videoUrl) {
            wrap.innerHTML = `
                            <div style="text-align:center;position:relative;">
                                <div class="play-btn" onclick="playLessonVideo()"><i class="fas fa-play"></i></div>
                                <div style="font-size:.78rem;color:var(--text2);margin-top:.75rem">${l.title || 'Lesson'}</div>
                                <div style="font-size:.7rem;color:var(--text3);margin-top:.2rem">Click to play video</div>
                            </div>
                        `;
        } else if (l.type === 'text' && l.content) {
            wrap.innerHTML = `
                            <div style="padding:1rem;background:var(--bg2);border-radius:var(--radius-sm);min-height:120px;line-height:1.7;max-height:400px;overflow-y:auto;">
                                ${l.content}
                            </div>
                        `;
        } else {
            wrap.innerHTML = `
                            <div class="empty-state" style="padding:1rem;">
                                <i class="fas fa-file-alt"></i>
                                <p>No video content for this lesson.</p>
                            </div>
                        `;
        }
    }
    const resList = document.getElementById('lessonResourcesList');
    if (resList) {
        if (Array.isArray(l.resources) && l.resources.length) {
            resList.innerHTML = l.resources.map(r =>
                `<div style="padding:.5rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:.3rem;font-size:.79rem"><i class="fas fa-paperclip" style="color:var(--accent);margin-right:.4rem"></i><a href="${r.url}" target="_blank" rel="noopener" style="color:var(--primary)">${r.title || r.url}</a></div>`
                ).join('');
        } else { resList.innerHTML = '<div class="empty-state"><p>No resources</p></div>'; }
    }
    if (!S.isPremium && shouldShowAd('lesson-inline')) {
        const ad = getNextAd('lesson-inline');
        if (ad && ad.type === 'custom') {
            const adHtml = `
                            <div class="ad-card" style="margin: 15px 0; padding: 10px; background: var(--bg2); border-radius: 8px; border-left: 3px solid var(--primary);">
                                <div style="font-size:0.7rem; color:var(--gold);">📢 Sponsored</div>
                                <a href="${ad.data.linkUrl}" target="_blank" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom')">
                                    <strong>${escapeHtml(ad.data.title)}</strong>
                                </a>
                            </div>
                        `;
            const desc = document.getElementById('lessonOverviewDesc');
            if (desc) {
                desc.insertAdjacentHTML('afterend', adHtml);
            }
        }
    }
}

export function jumpToLesson(i) { S.currentLessonIdx = i;
    renderCurric(); }

export function navigateLesson(dir) {
    const newIdx = S.currentLessonIdx + dir;
    if (newIdx < 0 || newIdx >= S.currentLessons.length) return;
    S.currentLessonIdx = newIdx;
    renderCurric();
}

export async function completeLessonAndNext() {
    const l = S.currentLessons[S.currentLessonIdx];
    if (!l) return;
    const timeSpent = S.lessonStartTime ? Math.floor((Date.now() - S.lessonStartTime) / 1000) : 0;
    const requiredSeconds = (l.duration || 10) * 60;
    if (timeSpent < requiredSeconds * 0.7) {
        toast(`Please spend at least ${Math.ceil(requiredSeconds * 0.7 / 60)} minutes on this lesson.`,
            'warning');
        return;
    }
    l.completed = true;
    if (S.currentCourseId && l._id) {
        try {
            await apiCall(`/courses/${S.currentCourseId}/lessons/${l._id}/progress`, { method: 'POST',
                body: { completed: true, timeSpent } });
            toast('✅ Lesson completed! +XP', 'success');
            await loadEnrollments();
            import('./payments.js').then(({ renderWallet }) => renderWallet());
        } catch (e) { toast('Progress saved locally', 'info'); }
    }
    const nextIdx = S.currentLessonIdx + 1;
    if (nextIdx < S.currentLessons.length) { S.currentLessonIdx = nextIdx; } else {
        toast('🎉 Course complete! Certificate ready! +₦100', 'success');
        setDP('certs');
        import('./payments.js').then(({ renderWallet }) => renderWallet());
    }
    renderCurric();
}

// ─── Q&A ─────────────────────────────────────────────────────────────────

export async function loadQA() {
    if (!S.currentCourseId) return;
    try {
        const data = await apiCall(`/courses/${S.currentCourseId}/questions`);
        const questions = Array.isArray(data.data) ? data.data : [];
        const qaList = document.getElementById('qaList');
        if (qaList) {
            qaList.innerHTML = questions.length ? questions.map(q =>
                `<div class="qa-item"><div style="font-size:.82rem;font-weight:600">${q.user?.firstName || 'Student'}: ${q.question}</div>${q.answer ? `<div class="qa-reply"><strong>Instructor:</strong> ${q.answer}</div>` : '<div style="font-size:.72rem;color:var(--text3)">Waiting for answer...</div>'}</div>`
                ).join('') : '<div class="empty-state"><p>No questions yet</p></div>';
        }
    } catch (e) { console.warn('Could not load Q&A:', e.message); }
}

export async function submitQuestion() {
    const inp = document.getElementById('qaInput');
    if (!inp?.value.trim()) return;
    if (!S.currentCourseId) { toast('Select a course first', 'warning'); return; }
    try {
        await apiCall(`/courses/${S.currentCourseId}/questions`, { method: 'POST', body: { question: inp.value
                    .trim(), lessonId: S.currentLessons[S.currentLessonIdx]?._id } });
        toast('Question submitted!', 'success');
        inp.value = '';
        await loadQA();
    } catch (e) { toast(e.message, 'error'); }
}

export async function submitQAReply() {
    const questionId = document.getElementById('qaReplyModal')._questionId;
    const text = document.getElementById('qaReplyText')?.value.trim();
    if (!questionId || !text) return;
    try {
        await apiCall(`/instructor/questions/${questionId}/answer`, { method: 'POST', body: { answer: text } });
        closeModal('qaReplyModal');
        toast('✅ Reply posted!', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

export function openQAReply(questionId, question) {
    document.getElementById('qaReplyContext').innerHTML =
        `<div style="font-size:.84rem"><strong>Student:</strong> ${question}</div>`;
    document.getElementById('qaReplyModal')._questionId = questionId;
    openModal('qaReplyModal');
}

// ─── MY COURSES ─────────────────────────────────────────────────────────

export function renderCourseGrid(filter) {
    S.courseFilter = filter || 'all';
    let list = Array.isArray(S.enrollments) ? S.enrollments : [];
    if (filter === 'completed') list = list.filter(e => e.status === 'completed' || e.progress === 100);
    else if (filter === 'progress') list = list.filter(e => (e.status === 'active' || e.progress > 0) && e.progress <
        100);
    else if (filter === 'new') list = list.filter(e => e.status === 'active' && (!e.progress || e.progress === 0));
    document.getElementById('coursesGrid').innerHTML = list.length ? list.map(e => {
        const progress = e.progress || 0;
        const status = progress >= 100 ? 'completed' : 'active';
        const courseId = extractCourseId(e);
        if (!courseId) return '';
        return `<div class="course-card" onclick="openEnrollmentLesson('${courseId}','${e._id}')"><div class="cc-img" style="background:linear-gradient(135deg,var(--card2),var(--card3))">📚</div><div class="cc-bar"><div class="cc-fill ${progress === 100 ? 'pf-success' : 'pf-primary'}" style="width:${progress}%"></div></div><div class="cc-body"><div style="font-weight:700;font-size:.88rem;margin-bottom:.25rem">${e.course?.title || 'Course'}</div><div style="font-size:.74rem;color:var(--text3)">${e.course?.totalLessons || 0} lessons · ★${e.course?.rating || 0}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem"><span class="badge ${status === 'completed' ? 'badge-success' : 'badge-cyan'}" style="font-size:.6rem">${status === 'completed' ? '✓ Done' : progress + '%'}</span><button class="btn btn-primary btn-sm" style="font-size:.68rem;padding:.22rem .6rem">Continue</button></div></div></div>`;
    }).join('') :
        '<div class="empty-state"><i class="fas fa-book-open"></i><h4>No courses</h4><p>Explore courses to start learning!</p></div>';
}

function extractCourseId(enrollment) {
    if (enrollment.course && typeof enrollment.course === 'object' && enrollment.course._id) return enrollment.course
        ._id;
    if (typeof enrollment.course === 'string') return enrollment.course;
    if (enrollment.courseId && typeof enrollment.courseId === 'string') return enrollment.courseId;
    if (enrollment.course && enrollment.course.id) return enrollment.course.id;
    return null;
}

export function filterCourses(f, btn) {
    document.querySelectorAll('#dash-courses .fpill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCourseGrid(f);
}

export async function loadEnrollments() {
    try {
        const data = await apiCall('/courses/my/enrollments');
        S.enrollments = Array.isArray(data.data) ? data.data : [];
        const cntEl = document.getElementById('navCoursesCnt');
        if (cntEl) cntEl.textContent = S.enrollments.length;
    } catch (e) { S.enrollments = []; }
}

// ─── RATING ─────────────────────────────────────────────────────────────

export function setRating(n) {
    window.selectedRating = n;
    document.querySelectorAll('.star-pick').forEach((s, i) => {
        s.textContent = i < n ? '★' : '☆';
        s.style.color = i < n ? 'var(--gold)' : 'var(--text3)';
    });
    const labels = ['', 'Terrible 😞', 'Bad 😕', 'Okay 😐', 'Good 😊', 'Excellent! 🌟'];
    document.getElementById('ratingLabel').textContent = labels[n] || '';
}

export async function submitRating() {
    const token = localStorage.getItem('cx_accessToken');
    if (!token) { toast('Please log in to rate', 'error');
        goPage('login'); return; }
    if (!window.selectedRating) { toast('Select a rating', 'error'); return; }
    const review = document.getElementById('rateReview')?.value || '';
    const courseId = S.currentCourseId;
    if (!courseId) { toast('No course selected to rate', 'error'); return; }
    showLoading('Submitting rating...');
    try {
        const res = await apiCall(`/courses/${courseId}/rate`, { method: 'POST', body: { rating: window
                    .selectedRating, review } });
        if (res.success) {
            toast(`⭐ Thanks! You rated ${window.selectedRating}/5`, 'success');
            closeModal('rateModal');
            if (S.currentCourseId) { await loadCourseForLesson(S.currentCourseId); }
            if (S.dp === 'explore') { await renderExplore(); }
        } else { toast(res.message || 'Failed to submit rating', 'error'); }
    } catch (err) { toast(err.message || 'Error submitting rating', 'error'); } finally {
        hideLoading();
        window.selectedRating = 0;
        document.getElementById('rateReview').value = '';
    }
}

// ─── INTERACTIVE MATERIALS ────────────────────────────────────────────

export async function loadInteractiveMaterials(lessonId) {
    if (!lessonId) return;
    try {
        const res = await apiCall(`/interactive/lesson/${lessonId}`);
        const materials = res.data || [];
        S.interactiveMaterials = materials;
        const container = document.getElementById('interactiveMaterialsContainer');
        if (!container) return;
        if (!materials.length) { container.innerHTML =
            '<div class="empty-state"><p>No interactive materials for this lesson</p></div>'; return; }
        container.innerHTML = materials.map(m => renderInteractiveMaterial(m)).join('');
        materials.forEach(m => {
            if (m.type === 'code_editor') initCodeEditor(m._id, m.html, m.css, m.js);
            if (m.type === 'calculator') initCalculator(m._id, m.config);
        });
    } catch (err) { console.warn('Interactive load failed', err); }
}

function renderInteractiveMaterial(material) {
    switch (material.type) {
        case 'code_editor':
            return `
                            <div class="interactive-card" data-id="${material._id}">
                                <h4>💻 Try It Yourself</h4>
                                <div class="code-editor">
                                    <div class="code-tabs">
                                        <button class="tab-btn active" onclick="switchCodeTab('html','${material._id}')">HTML</button>
                                        <button class="tab-btn" onclick="switchCodeTab('css','${material._id}')">CSS</button>
                                        <button class="tab-btn" onclick="switchCodeTab('js','${material._id}')">JS</button>
                                        <button class="tab-btn" onclick="runCode('${material._id}')" style="background:var(--primary);color:#000;border-radius:var(--radius-sm)">▶ Run</button>
                                    </div>
                                    <textarea id="code-html-${material._id}" class="code-area" style="display:block">${escapeHtml(material.html || '')}</textarea>
                                    <textarea id="code-css-${material._id}" class="code-area" style="display:none">${escapeHtml(material.css || '')}</textarea>
                                    <textarea id="code-js-${material._id}" class="code-area" style="display:none">${escapeHtml(material.js || '')}</textarea>
                                    <iframe id="code-output-${material._id}" class="code-output" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
                                </div>
                            </div>
                        `;
        case 'calculator':
            return `
                            <div class="interactive-card">
                                <h4>🧮 Calculator</h4>
                                <div style="background:var(--bg);border-radius:var(--radius-sm);padding:1rem;max-width:300px;margin:0 auto">
                                    <input type="text" id="calc-display-${material._id}" class="finput" readonly style="text-align:right;font-size:1.4rem;font-weight:700;font-family:var(--font-mono)">
                                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-top:.5rem">
                                        ${['7','8','9','+','4','5','6','-','1','2','3','*','0','.','=','/'].map(b => `<button class="btn btn-ghost btn-sm" onclick="calcPress('${b}','${material._id}')" style="font-size:1.1rem;font-family:var(--font-mono)">${b}</button>`).join('')}
                                        <button class="btn btn-danger btn-sm" onclick="calcClear('${material._id}')" style="grid-column:span 2">C</button>
                                        <button class="btn btn-primary btn-sm" onclick="calcEquals('${material._id}')" style="grid-column:span 2">=</button>
                                    </div>
                                </div>
                            </div>
                        `;
        default:
            return `<div class="interactive-card"><p>Interactive: ${material.type}</p></div>`;
    }
}

function switchCodeTab(tab, id) {
    document.querySelectorAll(`.code-tabs`).forEach(container => {
        if (container.closest(`[data-id="${id}"]`) || container.closest(`.interactive-card[data-id="${id}"]`)) {
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const btns = container.querySelectorAll('.tab-btn');
            const tabMap = { html: 0, css: 1, js: 2 };
            if (btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('active');
            document.getElementById(`code-html-${id}`).style.display = tab === 'html' ? 'block' : 'none';
            document.getElementById(`code-css-${id}`).style.display = tab === 'css' ? 'block' : 'none';
            document.getElementById(`code-js-${id}`).style.display = tab === 'js' ? 'block' : 'none';
        }
    });
}

function runCode(id) {
    const html = document.getElementById(`code-html-${id}`)?.value || '';
    const css = document.getElementById(`code-css-${id}`)?.value || '';
    const js = document.getElementById(`code-js-${id}`)?.value || '';
    const iframe = document.getElementById(`code-output-${id}`);
    if (!iframe) return;
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`);
    doc.close();
}

function calcPress(val, id) {
    const display = document.getElementById(`calc-display-${id}`);
    if (!display) return;
    if (val === '=') return calcEquals(id);
    calcDisplay += val;
    display.value = calcDisplay;
}
let calcDisplay = '';

function calcClear(id) { calcDisplay = '';
    const display = document.getElementById(`calc-display-${id}`); if (display) display.value = ''; }

function calcEquals(id) {
    const display = document.getElementById(`calc-display-${id}`);
    if (!display || !calcDisplay) return;
    try { const result = Function('"use strict"; return (' + calcDisplay + ')')();
        display.value = result;
        calcDisplay = String(result); } catch (e) { display.value = 'Error';
        calcDisplay = ''; }
}

function initCodeEditor(id, html, css, js) { setTimeout(() => runCode(id), 300); }

function initCalculator(id, config) { calcDisplay = ''; }

// ─── SWITCH LESSON TAB ──────────────────────────────────────────────────

export function switchLTab(tab, el) {
    document.querySelectorAll('.ltab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.lesson-sub').forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
    const target = document.getElementById('ls-' + tab);
    if (target) target.classList.add('active');
    S.lessTab = tab;
    if (tab === 'qa') loadQA();
    if (tab === 'reviews' && S.currentCourseData?.ratings) {
        document.getElementById('reviewsListContainer').innerHTML = renderCourseRatings(S.currentCourseData.ratings);
    }
    if (tab === 'interactive') {
        const lesson = S.currentLessons[S.currentLessonIdx];
        if (lesson && lesson._id) loadInteractiveMaterials(lesson._id);
    }
}

// ─── VIDEO PLAY ─────────────────────────────────────────────────────────

export function playLessonVideo() {
    const wrap = document.getElementById('lessonVideoWrap');
    if (!wrap) return;
    const l = S.currentLessons[S.currentLessonIdx];
    if (!l) { toast('No video available for this lesson', 'warning'); return; }

    if (!shouldShowAd('video-pre')) {
        playVideoContent(l);
        return;
    }

    const ad = getNextAd('video-pre');
    if (ad && ad.type === 'custom') {
        showVideoAdOverlay(ad, l, 'pre');
    } else {
        playVideoContent(l);
    }
}

function showVideoAdOverlay(ad, lesson, type) {
    const wrap = document.getElementById('lessonVideoWrap');
    if (!wrap) return;
    const existing = document.getElementById('videoAdOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'videoAdOverlay';
    overlay.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
                flex-direction: column; z-index: 10; color: white; cursor: pointer;
            `;
    overlay.innerHTML = `
                <div class="ad-content" style="background: rgba(0,0,0,0.6); padding: 20px; border-radius: 12px; text-align: center; max-width: 90%;">
                    <div style="font-size:.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem;">📢 Ad</div>
                    ${ad.data.imageUrl ? `<img src="${ad.data.imageUrl}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:.5rem;">` : ''}
                    <div style="font-size:.9rem;font-weight:600;">${escapeHtml(ad.data.title)}</div>
                    <p style="font-size:.7rem;color:var(--text3);margin:.3rem 0 .5rem;">${escapeHtml(ad.data.description || '')}</p>
                    <button class="btn btn-primary btn-sm" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom');skipVideoAd()" style="margin-top:.3rem;">Learn More</button>
                    <div style="margin-top:.5rem;font-size:.7rem;color:var(--text3);">Ad plays for 10s — click to skip</div>
                </div>
            `;

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.closest('.ad-content')) {
            skipVideoAd();
        }
    });

    wrap.style.position = 'relative';
    wrap.appendChild(overlay);
    videoAdActive = true;

    if (ad.data._id) trackAdImpression(ad.data._id, null, 'custom');

    clearTimeout(videoAdTimeout);
    videoAdTimeout = setTimeout(() => {
        skipVideoAd();
    }, 10000);

    S.currentVideoAd = ad;
    S.currentVideoLesson = lesson;
}
let videoAdActive = false,
    videoAdTimeout = null;

function skipVideoAd() {
    const overlay = document.getElementById('videoAdOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.remove();
    }
    videoAdActive = false;
    clearTimeout(videoAdTimeout);

    if (S.currentVideoLesson) {
        playVideoContent(S.currentVideoLesson);
    }
    S.currentVideoAd = null;
    S.currentVideoLesson = null;
}

function playVideoContent(lesson) {
    const wrap = document.getElementById('lessonVideoWrap');
    if (!wrap) return;

    if (lesson.type === 'video' && lesson.videoUrl) {
        let videoHtml = '';
        if (lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be')) {
            const embedUrl = lesson.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
            videoHtml = `
                            <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:var(--radius-sm);">
                                <iframe src="${embedUrl}" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
                            </div>
                        `;
        } else {
            videoHtml = `
                            <video controls style="width:100%;border-radius:var(--radius-sm);" id="lessonVideoPlayer">
                                <source src="${lesson.videoUrl}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        `;
        }
        wrap.innerHTML = videoHtml;

        const videoEl = document.getElementById('lessonVideoPlayer');
        if (videoEl) {
            S.currentVideoElement = videoEl;
            setupMidrollAds(videoEl);
        }
    } else if (lesson.type === 'text' && lesson.content) {
        wrap.innerHTML = `
                            <div style="padding:1rem;background:var(--bg2);border-radius:var(--radius-sm);min-height:120px;line-height:1.7;max-height:400px;overflow-y:auto;">
                                ${lesson.content}
                            </div>
                        `;
    } else {
        wrap.innerHTML = `
                            <div class="empty-state" style="padding:1rem;">
                                <i class="fas fa-file-alt"></i>
                                <p>No video content for this lesson.</p>
                            </div>
                        `;
    }
}

function setupMidrollAds(videoElement) {
    if (!videoElement || !shouldShowAd('video-mid')) return;

    let lastAdTime = 0;
    videoElement.addEventListener('timeupdate', function() {
        if (videoAdActive) return;
        const current = Math.floor(this.currentTime);
        if (current > 0 && current % 300 === 0 && current !== lastAdTime && current > 60) {
            lastAdTime = current;
            const ad = getNextAd('video-mid');
            if (ad && ad.type === 'custom') {
                this.pause();
                const lesson = S.currentLessons[S.currentLessonIdx];
                if (lesson) {
                    showMidrollAd(ad, lesson, this);
                }
            }
        }
    });
}

function showMidrollAd(ad, lesson, videoElement) {
    const wrap = document.getElementById('lessonVideoWrap');
    if (!wrap) return;
    const existing = document.getElementById('videoAdOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'videoAdOverlay';
    overlay.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
                flex-direction: column; z-index: 10; color: white; cursor: pointer;
            `;
    overlay.innerHTML = `
                <div class="ad-content" style="background: rgba(0,0,0,0.6); padding: 20px; border-radius: 12px; text-align: center; max-width: 90%;">
                    <div style="font-size:.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem;">📢 Ad Break</div>
                    ${ad.data.imageUrl ? `<img src="${ad.data.imageUrl}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:.5rem;">` : ''}
                    <div style="font-size:.9rem;font-weight:600;">${escapeHtml(ad.data.title)}</div>
                    <p style="font-size:.7rem;color:var(--text3);margin:.3rem 0 .5rem;">${escapeHtml(ad.data.description || '')}</p>
                    <button class="btn btn-primary btn-sm" onclick="handleAdClick('${ad.data._id}','${ad.data.linkUrl}','','custom');skipVideoAd()" style="margin-top:.3rem;">Learn More</button>
                    <div style="margin-top:.5rem;font-size:.7rem;color:var(--text3);">Ad plays for 10s — click to skip</div>
                </div>
            `;

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.closest('.ad-content')) {
            skipVideoAd();
        }
    });

    wrap.style.position = 'relative';
    wrap.appendChild(overlay);
    videoAdActive = true;

    if (ad.data._id) trackAdImpression(ad.data._id, null, 'custom');

    clearTimeout(videoAdTimeout);
    videoAdTimeout = setTimeout(() => {
        skipVideoAd();
    }, 10000);

    S.currentVideoAd = ad;
    S.currentVideoLesson = lesson;
    S.currentVideoElement = videoElement;
}

function updateSEO(data) {
    // minimal seo update
    if (data.title) document.title = data.title + ' | ChangeX Academy';
}

// Attach to window for inline onclick
window.openBuyCourse = openBuyCourse;
window.filterExplore = filterExplore;
window.openEnrollmentLesson = openEnrollmentLesson;
window.jumpToLesson = jumpToLesson;
window.navigateLesson = navigateLesson;
window.completeLessonAndNext = completeLessonAndNext;
window.filterCourses = filterCourses;
window.playLessonVideo = playLessonVideo;
window.switchLTab = switchLTab;
window.setRating = setRating;
window.submitRating = submitRating;
window.submitQuestion = submitQuestion;
window.submitQAReply = submitQAReply;
window.openQAReply = openQAReply;
window.loadQA = loadQA;
window.renderCurric = renderCurric;
window.switchCodeTab = switchCodeTab;
window.runCode = runCode;
window.calcPress = calcPress;
window.calcClear = calcClear;
window.calcEquals = calcEquals;
