// js/feed.js
import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, escapeHtml, getAvatarUrl } from './utils.js';

let feedPage = 1,
    feedHasMore = true,
    feedIsLoading = false,
    feedSentinelObserver = null;

export async function loadFeed(page = 1) {
    const filter = S.feedFilter || 'personalized';
    if (page === 1) {
        feedPage = 1;
        feedHasMore = true;
        feedIsLoading = false;
        const container = document.getElementById('feedContainer');
        if (container) {
            if (!loadCachedFeed()) {
                container.innerHTML = '';
            }
        }
        if (feedSentinelObserver) { feedSentinelObserver.disconnect();
            feedSentinelObserver = null; }
        if (shouldShowAd('in-feed')) await import('./admin.js').then(({ loadAds }) => loadAds('in-feed'));
    }
    const container = document.getElementById('feedContainer');
    if (!container) return;
    const loadingEl = document.getElementById('feedLoadingMore');
    if (page > 1 && loadingEl) loadingEl.style.display = 'block';
    try {
        let url;
        if (filter === 'personalized') {
            url = `${POSTS_API}/personalized?page=${page}&limit=10`;
        } else if (filter === 'following') {
            url = `${POSTS_API}/following?page=${page}&limit=10`;
        } else if (filter === 'all') {
            url = `${POSTS_API}?page=${page}&limit=10`;
        } else {
            url = `${POSTS_API}?page=${page}&limit=10&type=${filter}`;
        }
        const res = await apiCall(url);
        const posts = res.data?.posts || res.data || [];
        const pagination = res.data?.pagination || { total: 0, pages: 1 };
        if (page === 1 && posts.length) cacheFeedPosts(posts);
        if (page === 1) {
            S.posts = posts;
            renderFeedPosts(posts, pagination, filter === 'personalized');
        } else {
            appendFeedPosts(posts);
        }
        if (page >= pagination.pages || posts.length < 10) feedHasMore = false;
        else feedHasMore = true;
        posts.forEach(p => { if (p._id) trackPostView(p._id); });
        setupFeedSentinel();
        attachPostEventListeners();
        observeAdImpressions();
    } catch (err) {
        toast('Failed to load feed: ' + err.message, 'error');
    } finally {
        hideLoading();
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderFeedPosts(posts, pagination, isPersonalized = false) {
    const container = document.getElementById('feedContainer');
    if (!container) return;
    if (!posts || !posts.length) {
        container.innerHTML = `
                    <div class="empty-state"><i class="fas fa-newspaper"></i><h4>${isPersonalized ? 'No personalized posts yet' : 'No posts yet'}</h4><p>${isPersonalized ? 'Follow more people and interact with posts to improve your feed.' : 'Be the first to create a post!'}</p></div>
                `;
        return;
    }
    const showAds = shouldShowAd('in-feed');
    const adFrequency = S.isPremium ? 6 : 3;
    let html = '';
    posts.forEach((post, idx) => {
        const scoreBadge = isPersonalized && post.score !== undefined ? getScoreBadge(post.score) : '';
        html += renderPostCard(post, scoreBadge);
        if (showAds && (idx + 1) % adFrequency === 0 && idx < posts.length - 1) {
            const ad = getNextAd('in-feed');
            if (ad) html += renderAdCard(ad, post._id);
        }
    });
    container.innerHTML = html;
}

function renderPostCard(post, scoreBadge = '') {
    let author = post.authorId || post.author || {};
    if (typeof author === 'string') {
        if (author === S.user?._id) { author = S.user || { firstName: 'You', lastName: '', _id: author }; } else {
            author = { firstName: 'User', lastName: '', _id: author }; }
    }
    const avatarHtml = getAvatarUrl(author) ?
        `<img src="${getAvatarUrl(author)}" alt="${author.firstName || 'U'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
        (author.firstName?.[0] || 'U');
    const fullContent = post.content || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = fullContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const previewText = textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent;
    const needsReadMore = textContent.length > 200;
    const contentHtml = fullContent ? (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(fullContent) : fullContent) :
        '';
    const earnings = post.earnings || 0;
    const isAuthor = S.user?._id === author._id || S.user?._id === post.authorId?._id || S.user?._id === post
        .authorId;
    const isAdmin = S.user?.roles?.includes('admin');
    const slug = post.slug || post._id;
    const views = post.views || 0;
    const postUrl = `${FRONTEND_URL}/post/${slug}`;
    const isPaid = post.isPaid || false;
    const hasPurchased = post.hasPurchased || false;
    const isOwner = isAuthor || isAdmin;
    const showFull = isOwner || hasPurchased || !isPaid;

    return `
                <div class="post-card card card-p" data-post-id="${post._id}">
                    <div class="post-header">
                        <div class="post-author-avatar" style="background:linear-gradient(135deg,var(--primary),var(--secondary));" onclick="openUserProfile('${author._id || post.authorId}')">
                            ${avatarHtml}
                        </div>
                        <div class="post-author-info">
                            <strong onclick="openUserProfile('${author._id || post.authorId}')" style="cursor:pointer">${escapeHtml(author.firstName || 'User')} ${escapeHtml(author.lastName || '')}</strong>
                            <span class="post-date">${new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</span>
                            <span class="badge badge-cyan" style="font-size:.55rem">${post.type || 'article'}</span>
                            ${isAuthor ? `<span class="badge badge-dark" style="font-size:.55rem">You</span>` : ''}
                            ${post.isPremiumOnly ? `<span class="badge badge-gold" style="font-size:.55rem">Premium</span>` : ''}
                            ${isPaid ? `<span class="badge badge-gold" style="font-size:.55rem">💰 Paid</span>` : ''}
                            ${isPaid && hasPurchased ? `<span class="badge badge-success" style="font-size:.55rem">✅ Purchased</span>` : ''}
                            ${scoreBadge}
                        </div>
                        <div style="margin-left:auto;display:flex;gap:.2rem">
                            ${isAuthor || isAdmin ? `<button class="post-delete-btn" onclick="deletePost('${post._id}')" title="Delete post"><i class="fas fa-trash"></i></button>` : ''}
                            ${isAuthor ? `<button class="post-edit-btn" onclick="editPost('${post._id}')" title="Edit post"><i class="fas fa-edit"></i></button>` : ''}
                        </div>
                    </div>
                    <h3 class="post-title" onclick="window.location.href='${postUrl}'">${escapeHtml(post.title)}</h3>
                    ${post.featuredImage ? `<img src="${post.featuredImage}" class="post-image" alt="featured" loading="lazy">` : ''}
                    ${post.videoUrl ? `<video controls style="max-width:100%;border-radius:var(--radius-sm);margin:.75rem 0;"><source src="${post.videoUrl}" type="video/mp4"></video>` : ''}
                    <div class="post-content" id="postContent-${post._id}">
                        ${showFull ? `
                            <span class="post-preview">${escapeHtml(previewText)}</span>
                            ${needsReadMore ? `<span class="post-full" style="display:none;">${contentHtml}</span><button class="btn-readmore" onclick="togglePostContent('${post._id}')">Read more</button>` : ''}
                        ` : `
                            <div class="paywall-overlay"><i class="fas fa-lock" style="font-size:2rem;color:var(--gold);margin-bottom:.5rem;display:block;"></i><h3>🔒 Premium Article</h3><p>This article is paid. Purchase to read the full content.</p><button class="btn btn-primary" onclick="purchaseArticle('${post._id}')">Purchase — ${fmtMoneyAPI(post.price || 500)}</button></div>
                        `}
                    </div>
                    <div class="post-stats">
                        <span><i class="fas fa-eye"></i> ${views}</span>
                        <span class="post-likes" data-id="${post._id}"><i class="far fa-heart"></i> ${post.likes || 0}</span>
                        <span class="post-comments"><i class="far fa-comment"></i> ${post.commentsCount || 0}</span>
                        <span class="post-shares"><i class="fas fa-share-alt"></i> ${post.shares || 0}</span>
                        ${earnings > 0 ? `<span class="badge badge-gold" style="font-size:.6rem">🌱 +${fmtMoneyAPI(earnings)}</span>` : ''}
                    </div>
                    <div class="post-actions">
                        <button class="btn-like ${post.userLiked ? 'liked' : ''}" data-id="${post._id}"><i class="far fa-heart"></i> Like</button>
                        <button class="btn-comment" data-id="${post._id}"><i class="far fa-comment"></i> Comment</button>
                        <button class="btn-share" onclick="openShareModal('${post._id}','${slug}')"><i class="fas fa-share-alt"></i> Share</button>
                    </div>
                    <div class="comments-section" style="display:none;" data-post-id="${post._id}"></div>
                </div>
            `;
}

function getScoreBadge(score) {
    let cls = 'low',
        label = 'Low match';
    if (score >= 0.7) { cls = 'high';
        label = 'High match 🔥'; } else if (score >= 0.4) { cls = 'medium';
        label = 'Medium match'; }
    return `<span class="score-badge ${cls}">${label}</span>`;
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

function renderAdCard(ad, postId) {
    if (!ad) return '';
    if (ad.type === 'custom' && ad.data) {
        const adData = ad.data;
        return `
                    <div class="ad-card" data-ad-id="${adData._id}" data-post-id="${postId || ''}" data-placement="${adData.placement || 'in-feed'}">
                        <div class="ad-label">📢 Sponsored</div>
                        <a href="#" onclick="handleAdClick('${adData._id}','${adData.linkUrl}','${postId || ''}','custom'); return false;">
                            ${adData.imageUrl ? `<img src="${adData.imageUrl}" alt="${escapeHtml(adData.title)}" loading="lazy">` : ''}
                            <div class="ad-title">${escapeHtml(adData.title)}</div>
                        </a>
                    </div>
                `;
    }
    if (ad.type === 'adsterra') {
        const uid = 'adsterra-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        return `
                    <div class="ad-card adsterra-wrapper" data-post-id="${postId || ''}" id="${uid}">
                        <div class="ad-label">📢 Sponsored</div>
                        <div id="container-cc89042fff30e53e48049a8c585d9105"></div>
                    </div>
                `;
    }
    return '';
}

function observeAdImpressions() {
    const adCards = document.querySelectorAll('.ad-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const adId = card.dataset.adId;
                const postId = card.dataset.postId;
                const isAdsterra = card.classList.contains('adsterra-wrapper');
                if (adId && postId) {
                    trackAdImpression(adId, postId, isAdsterra ? 'adsterra' : 'custom');
                }
                observer.unobserve(card);
            }
        });
    }, { threshold: 0.5 });
    adCards.forEach(card => observer.observe(card));
}

async function trackAdImpression(adId, postId, network = 'custom') {
    if (!postId) return;
    const key = `ad_imp_${adId}_${postId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    await trackAdRevenue(adId, 'impression', postId, network);
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

function cacheFeedPosts(posts) {
    if (!posts || !posts.length) return;
    try {
        const cached = JSON.parse(localStorage.getItem('cx_feed_posts') || '[]');
        const merged = [...posts, ...cached].filter((p, i, self) => self.findIndex(t => t._id === p._id) === i);
        localStorage.setItem('cx_feed_posts', JSON.stringify(merged.slice(0, 50)));
    } catch (e) { /* silent */ }
}

function loadCachedFeed() {
    try {
        const cached = JSON.parse(localStorage.getItem('cx_feed_posts') || '[]');
        if (cached.length && !document.querySelector('#feedContainer .post-card')) {
            renderFeedPosts(cached, { total: cached.length, pages: 1 });
            return true;
        }
    } catch (e) { /* silent */ }
    return false;
}

function setupFeedSentinel() {
    const sentinel = document.getElementById('feedSentinel');
    if (!sentinel) return;
    if (feedSentinelObserver) feedSentinelObserver.disconnect();
    feedSentinelObserver = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && feedHasMore && !feedIsLoading) {
            feedIsLoading = true;
            feedPage++;
            const loadingEl = document.getElementById('feedLoadingMore');
            if (loadingEl) loadingEl.style.display = 'block';
            try {
                const filter = S.feedFilter || 'personalized';
                let url;
                if (filter === 'personalized') {
                    url = `${POSTS_API}/personalized?page=${feedPage}&limit=10`;
                } else if (filter === 'following') {
                    url = `${POSTS_API}/following?page=${feedPage}&limit=10`;
                } else if (filter === 'all') {
                    url = `${POSTS_API}?page=${feedPage}&limit=10`;
                } else {
                    url = `${POSTS_API}?page=${feedPage}&limit=10&type=${filter}`;
                }
                const res = await apiCall(url);
                const posts = res.data?.posts || res.data || [];
                if (posts.length) {
                    cacheFeedPosts(posts);
                    appendFeedPosts(posts);
                    posts.forEach(p => { if (p._id) trackPostView(p._id); });
                } else { feedHasMore = false; }
                if (posts.length < 10) feedHasMore = false;
            } catch (err) { toast('Failed to load more posts', 'error'); } finally {
                feedIsLoading = false;
                if (loadingEl) loadingEl.style.display = 'none';
            }
        }
    }, { rootMargin: '0px 0px 200px 0px' });
    feedSentinelObserver.observe(sentinel);
}

function appendFeedPosts(posts) {
    const container = document.getElementById('feedContainer');
    if (!container) return;
    const loadingEl = document.getElementById('feedLoadingMore');
    if (loadingEl) loadingEl.style.display = 'none';
    const showAds = shouldShowAd('in-feed');
    const adFrequency = S.isPremium ? 6 : 3;
    posts.forEach((post, idx) => {
        if (!container.querySelector(`[data-post-id="${post._id}"]`)) {
            container.insertAdjacentHTML('beforeend', renderPostCard(post));
            if (showAds && (idx + 1) % adFrequency === 0 && idx < posts.length - 1) {
                const ad = getNextAd('in-feed');
                if (ad) {
                    container.insertAdjacentHTML('beforeend', renderAdCard(ad, post._id));
                }
            }
        }
    });
    attachPostEventListeners();
    observeAdImpressions();
}

export function filterFeed(type, el) {
    if (el) { document.querySelectorAll('.feed-tabs .fpill').forEach(p => p.classList.remove('active'));
        el.classList.add('active'); }
    S.feedFilter = type;
    feedPage = 1;
    feedHasMore = true;
    const container = document.getElementById('feedContainer');
    if (container) container.innerHTML = '';
    loadFeed(1);
}

export function attachPostEventListeners() {
    document.querySelectorAll('.btn-comment').forEach(btn => { btn.onclick = () => toggleComments(btn.dataset.id); });
    document.querySelectorAll('.btn-readmore').forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        btn._listener = function(e) {
            e.stopPropagation();
            const postId = this.closest('.post-content').id.replace('postContent-', '');
            togglePostContent(postId);
        };
        btn.addEventListener('click', btn._listener);
    });
}

export function togglePostContent(postId) {
    const container = document.getElementById(`postContent-${postId}`);
    if (!container) return;

    const preview = container.querySelector('.post-preview');
    const full = container.querySelector('.post-full');
    const btn = container.querySelector('.btn-readmore');

    if (!preview || !full || !btn) return;

    if (full.style.display === 'none') {
        full.style.display = 'inline';
        preview.style.display = 'none';
        btn.textContent = 'Read less';
    } else {
        full.style.display = 'none';
        preview.style.display = 'inline';
        btn.textContent = 'Read more';
    }
}

async function toggleComments(postId) {
    const section = document.querySelector(`.comments-section[data-post-id="${postId}"]`);
    if (!section) return;
    if (section.style.display === 'none') { section.style.display = 'block';
        await loadComments(postId); } else { section.style.display = 'none'; }
}

async function loadComments(postId) {
    const section = document.querySelector(`.comments-section[data-post-id="${postId}"]`);
    if (!section) return;
    try {
        const res = await apiCall(`${POSTS_API}/${postId}/comments`);
        const comments = res.data || [];
        section.innerHTML = `
                    <div class="comment-input"><textarea placeholder="Write a comment..." id="commentText-${postId}"></textarea><button class="btn-primary btn-sm" onclick="addComment('${postId}')">Post</button></div>
                    <div class="comments-list" id="commentsList-${postId}">
                        ${comments.map(c => renderCommentItem(c, postId)).join('')}
                    </div>
                `;
    } catch (err) { section.innerHTML = '<p>Failed to load comments</p>'; }
}

function renderCommentItem(comment, postId, level = 0) {
    const replies = comment.replies || [];
    const avatarHtml = getAvatarUrl(comment.userId) ?
        `<img src="${getAvatarUrl(comment.userId)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">` :
        (comment.userId?.firstName?.[0] || 'U');
    return `
                <div class="comment-item" style="margin-left: ${level * 20}px;" data-comment-id="${comment._id}">
                    <div class="comment-header">
                        <strong>${escapeHtml(comment.userId?.firstName || 'User')} ${escapeHtml(comment.userId?.lastName || '')}</strong>
                        <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="comment-body">${escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        <span class="comment-like" onclick="likeComment('${comment._id}')">
                            <i class="fas fa-heart"></i> ${comment.likes || 0}
                        </span>
                        <span class="comment-reply" onclick="showReplyInput('${comment._id}')">Reply</span>
                        ${replies.length ? `<span class="comment-replies-count">💬 ${replies.length} replies</span>` : ''}
                    </div>
                    <div class="reply-input-container" id="replyInput-${comment._id}" style="display:none;margin-top:.5rem;">
                        <div class="d-flex gap-2"><input type="text" class="finput" id="replyText-${comment._id}" placeholder="Write a reply..." /><button class="btn btn-primary btn-sm" onclick="submitReply('${comment._id}','${postId}')"><i class="fas fa-paper-plane"></i></button></div>
                    </div>
                    ${replies.length ? `
                        <div class="replies-container">
                            ${replies.map(r => renderCommentItem(r, postId, level + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
}

function showReplyInput(commentId) {
    const container = document.getElementById(`replyInput-${commentId}`);
    if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        const input = document.getElementById(`replyText-${commentId}`);
        if (input) input.focus();
    }
}

async function submitReply(commentId, postId) {
    const input = document.getElementById(`replyText-${commentId}`);
    const content = input?.value.trim();
    if (!content) { toast('Please enter a reply', 'error'); return; }
    try {
        await apiCall(`/posts/${postId}/comment`, {
            method: 'POST',
            body: { content, parentId: commentId }
        });
        toast('✅ Reply posted!', 'success');
        input.value = '';
        loadComments(postId);
    } catch (err) {
        toast('Failed to post reply: ' + err.message, 'error');
    }
}

async function addComment(postId) {
    const textarea = document.getElementById(`commentText-${postId}`);
    const content = textarea?.value.trim();
    if (!content) return;
    try { await apiCall(`${POSTS_API}/${postId}/comment`, { method: 'POST', body: { content } });
        toast('Comment added', 'success');
        textarea.value = '';
        loadComments(postId); } catch (err) { toast('Failed to add comment', 'error'); }
}

export async function likePost(postId) {
    const likeBtn = document.querySelector(`.btn-like[data-id="${postId}"]`);
    const likeSpan = document.querySelector(`.post-likes[data-id="${postId}"]`);
    if (!likeBtn || !likeSpan) return;

    const isCurrentlyLiked = likeBtn.classList.contains('liked');
    const currentLikes = parseInt(likeSpan.textContent.split(' ')[1]) || 0;
    const newLikes = isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1;

    likeBtn.classList.toggle('liked', !isCurrentlyLiked);
    likeSpan.innerHTML = `<i class="fas fa-heart"></i> ${newLikes}`;

    try {
        const res = await apiCall(`/posts/${postId}/like`, { method: 'POST' });
        if (res.likes !== undefined && res.liked !== undefined) {
            likeSpan.innerHTML = `<i class="fas fa-heart"></i> ${res.likes}`;
            likeBtn.classList.toggle('liked', res.liked);
        }
    } catch (err) {
        likeBtn.classList.toggle('liked', isCurrentlyLiked);
        likeSpan.innerHTML = `<i class="fas fa-heart"></i> ${currentLikes}`;
        toast('Error liking post', 'error');
    }
}

export async function deletePost(postId) {
    if (!confirm('Delete this post permanently?')) return;
    try {
        const isAdmin = S.user?.roles?.includes('admin');
        const endpoint = isAdmin ? `/admin/posts/${postId}` : `${POSTS_API}/${postId}`;
        await apiCall(endpoint, { method: 'DELETE' });
        toast('Post deleted', 'success');
        try {
            const cached = JSON.parse(localStorage.getItem('cx_feed_posts') || '[]');
            const updated = cached.filter(p => p._id !== postId);
            localStorage.setItem('cx_feed_posts', JSON.stringify(updated));
        } catch (e) {}
        if (S.dp === 'feed') loadFeed(feedPage);
        if (S.dp === 'profile' && S.profileUser) {
            import('./people.js').then(({ openUserProfile }) => openUserProfile(S.profileUser._id));
        }
        if (S.dp === 'admin' && S.admSec === 'users') {
            import('./admin.js').then(({ switchAdm }) => switchAdm('users', document.querySelector('#dash-admin .fpill.active')));
        }
        if (S.dp === 'social-earnings') import('./social-earnings.js').then(({ renderSocialEarnings }) =>
            renderSocialEarnings());
        if (S.dp === 'purchased-articles') import('./purchased-articles.js').then(({ loadPurchasedArticles }) =>
            loadPurchasedArticles());
    } catch (err) { toast('Failed to delete: ' + err.message, 'error'); }
}

export function editPost(postId) { toast('Edit functionality coming soon!', 'info'); }

export function openShareModal(postId, slug) {
    S.sharePostId = postId;
    S.sharePostSlug = slug;
    document.getElementById('shareLink').textContent = `${FRONTEND_URL}/post/${slug}`;
    import('./ui.js').then(({ openModal }) => openModal('shareModal'));
}

export function shareVia(platform) {
    const link = document.getElementById('shareLink')?.textContent || `${FRONTEND_URL}/post/${S.sharePostSlug || ''}`;
    const text = `Check out this post on ChangeX Academy! 🚀 Learn and earn with tech skills.`;
    let url = '';
    switch (platform) {
        case 'facebook':
            url =
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`;
            break;
        case 'twitter':
            url =
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
            break;
        case 'linkedin':
            url = `https://www.linkedin.com/sharing/share-offscreen/?url=${encodeURIComponent(link)}`;
            break;
        case 'whatsapp':
            url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
            break;
        case 'telegram':
            url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
            break;
        case 'copy':
        default:
            copyToClipboard(link);
            toast('Link copied!', 'success');
            import('./ui.js').then(({ closeModal }) => closeModal('shareModal'));
            return;
    }
    if (url) { window.open(url, '_blank');
        import('./ui.js').then(({ closeModal }) => closeModal('shareModal')); }
}

export function copyShareLink() {
    const link = document.getElementById('shareLink')?.textContent;
    if (link) copyToClipboard(link);
}

function trackPostView(postId) {
    if (!hasViewedPost(postId)) {
        try { apiCall(`/posts/${postId}/view`, { method: 'POST' });
            markPostViewed(postId); } catch (err) { /* silent fail */ }
    }
}

function hasViewedPost(postId) {
    const viewed = JSON.parse(sessionStorage.getItem('viewedPosts') || '[]');
    return viewed.includes(postId);
}

function markPostViewed(postId) {
    const viewed = JSON.parse(sessionStorage.getItem('viewedPosts') || '[]');
    if (!viewed.includes(postId)) {
        viewed.push(postId);
        sessionStorage.setItem('viewedPosts', JSON.stringify(viewed));
    }
}

export function purchaseArticle(postId) {
    if (!S.loggedIn) { toast('Please log in to purchase', 'warning');
        goPage('login'); return; }
    showLoading('Preparing purchase...');
    import('./payments.js').then(({ purchaseArticle: purchase }) => purchase(postId));
}

const POSTS_API = '/posts';
const FRONTEND_URL = window.location.origin || 'https://changex.academy';
