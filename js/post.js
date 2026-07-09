// js/posts.js
import { S } from './state.js';
import { apiCall, toast, showLoading, hideLoading, escapeHtml } from './utils.js';
import { goPage } from './router.js';
import { openModal, closeModal } from './ui.js';

export function openCreatePostModal() {
    const modal = document.getElementById('createPostModal');
    if (modal) {
        openModal('createPostModal');
        const warning = document.getElementById('postDuplicateWarning');
        if (warning) warning.classList.remove('show');
        document.getElementById('postTitle').value = '';
        if (S.postQuill) S.postQuill.root.innerHTML = '';
        loadMyPostTitles();
    }
}

export function initPostQuill() {
    if (S.postQuill) { try { S.postQuill.focus(); } catch (e) {} return; }
    const el = document.getElementById('postEditor');
    if (!el || typeof Quill === 'undefined') { setTimeout(initPostQuill, 300); return; }
    try {
        S.postQuill = new Quill('#postEditor', { theme: 'snow', placeholder: 'Write your post content here...',
            modules: { toolbar: [
                    ['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'image', 'code-block'], ['clean']
                ] } });
        if (!S.postQuill.root.innerHTML || S.postQuill.root.innerHTML === '<p><br></p>') { S.postQuill.root
                .innerHTML = ''; }
    } catch (e) { console.warn('Quill init error:', e);
        setTimeout(initPostQuill, 500); }
}

export async function loadMyPostTitles() {
    try {
        const res = await apiCall('/posts/my/titles?includeDrafts=true');
        S.myPostTitles = res.data || [];
    } catch (e) {
        try {
            const postsRes = await apiCall('/posts/my?limit=50&includeDrafts=true');
            const posts = postsRes.data?.posts || postsRes.data || [];
            S.myPostTitles = posts.map(p => p.title).filter(Boolean);
        } catch (e2) { S.myPostTitles = []; }
    }
}

export function checkDuplicatePost(title) {
    const warning = document.getElementById('postDuplicateWarning');
    if (!title || !title.trim()) { if (warning) warning.classList.remove('show'); return; }
    const isDuplicate = S.myPostTitles.some(t => t.toLowerCase() === title.trim().toLowerCase());
    if (warning) { warning.classList.toggle('show', isDuplicate); }
}

export async function submitNewPost() {
    const title = document.getElementById('postTitle')?.value.trim();
    const type = document.getElementById('postType')?.value || 'article';
    let content = '';
    if (S.postQuill) { content = S.postQuill.root.innerHTML; } else {
        const editorEl = document.getElementById('postEditor');
        if (editorEl) content = editorEl.innerHTML || '';
    }
    const tags = document.getElementById('postTags')?.value || '';
    const featuredImage = document.getElementById('postImage')?.value || '';
    const seoTitle = document.getElementById('postSeoTitle')?.value || '';
    const seoDesc = document.getElementById('postSeoDesc')?.value || '';
    const videoFile = document.getElementById('postVideoInput')?.files[0];
    const isPaid = document.querySelector('#postType option:checked')?.value === 'paid_article';

    if (!title) { toast('Please enter a title', 'error'); return; }
    const isDuplicate = S.myPostTitles.some(t => t.toLowerCase() === title.toLowerCase());
    if (isDuplicate) {
        toast('⚠️ You already have a post with this title. Please use a different title.', 'error');
        document.getElementById('postDuplicateWarning').classList.add('show');
        return;
    }
    if (!content || content === '<p><br></p>' || content.trim() === '') { toast('Please write some content for your post',
            'error'); return; }
    showLoading('Publishing post...');
    try {
        const body = { title, content, type, tags, featuredImage, seoTitle, seoDescription: seoDesc, isPublished: true };
        if (isPaid) body.isPaid = true;
        body.price = 500;
        const res = await apiCall(POSTS_API, { method: 'POST', body });
        const newPost = res.data || res;
        const postId = newPost._id;
        if (postId && videoFile) {
            const formData = new FormData();
            formData.append('video', videoFile);
            const token = localStorage.getItem('cx_accessToken');
            await fetch(`${API_BASE}/posts/${postId}/video`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
                body: formData });
        }
        updateSEO(newPost);
        toast('✅ Post published!', 'success');
        closeModal('createPostModal');
        document.getElementById('postTitle').value = '';
        document.getElementById('postTags').value = '';
        document.getElementById('postImage').value = '';
        document.getElementById('postSeoTitle').value = '';
        document.getElementById('postSeoDesc').value = '';
        document.getElementById('postVideoInput').value = '';
        if (S.postQuill) S.postQuill.root.innerHTML = '';
        cacheFeedPosts([newPost]);
        if (S.dp === 'feed' || S.dp === 'home') {
            import('./feed.js').then(({ renderPostCard, attachPostEventListeners }) => {
                const container = document.getElementById('feedContainer');
                if (container) {
                    if (!container.querySelector(`[data-post-id="${postId}"]`)) {
                        container.insertAdjacentHTML('afterbegin', renderPostCard(newPost));
                        attachPostEventListeners();
                        container.scrollTop = 0;
                    }
                } else { import('./feed.js').then(({ loadFeed }) => loadFeed(1)); }
            });
        } else if (S.dp === 'profile' && S.profileUser) {
            import('./people.js').then(({ openUserProfile }) => openUserProfile(S.profileUser._id));
        }
        if (!S.myPostTitles.includes(title)) S.myPostTitles.push(title);
        import('./social-earnings.js').then(({ updateSocialBadge }) => updateSocialBadge());
    } catch (err) { toast('Failed to create post: ' + err.message, 'error'); } finally { hideLoading(); }
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

function cacheFeedPosts(posts) {
    if (!posts || !posts.length) return;
    try {
        const cached = JSON.parse(localStorage.getItem('cx_feed_posts') || '[]');
        const merged = [...posts, ...cached].filter((p, i, self) => self.findIndex(t => t._id === p._id) === i);
        localStorage.setItem('cx_feed_posts', JSON.stringify(merged.slice(0, 50)));
    } catch (e) { /* silent */ }
}

export async function loadPostBySlug(slug) {
    showLoading('Loading post...');
    try {
        const res = await apiCall(`/posts/slug/${slug}`);
        const post = res.data;
        if (post._id) {
            import('./feed.js').then(({ trackPostView }) => trackPostView(post._id));
        }
        updateSEO(post);
        renderPostDetail(post);
        import('./dashboard.js').then(({ setDP }) => setDP('post-detail'));
    } catch (err) { toast('Post not found: ' + err.message, 'error');
        import('./dashboard.js').then(({ setDP }) => setDP('feed')); } finally { hideLoading(); }
}

export function renderPostDetail(post) {
    const container = document.getElementById('postDetailContent');
    if (!container) return;
    const author = post.authorId || {};
    const avatarHtml = getAvatarUrl(author) ?
        `<img src="${getAvatarUrl(author)}" alt="${author.firstName || 'U'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
        (author.firstName?.[0] || 'U');
    const contentHtml = post.content ? (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(post.content) : post
        .content) : '';
    const earnings = post.earnings || 0;
    const views = post.views || 0;
    const isPaid = post.isPaid || false;
    const hasPurchased = post.hasPurchased || false;
    const isOwner = S.user?._id === author._id || S.user?._id === post.authorId || S.user?.roles?.includes('admin');
    const showFull = isOwner || hasPurchased || !isPaid;

    container.innerHTML = `
                <div class="post-card card card-p">
                    <div class="post-header">
                        <div class="post-author-avatar" style="background:linear-gradient(135deg,var(--primary),var(--secondary));" onclick="openUserProfile('${author._id}')">${avatarHtml}</div>
                        <div class="post-author-info"><strong onclick="openUserProfile('${author._id}')" style="cursor:pointer">${escapeHtml(author.firstName || 'User')} ${escapeHtml(author.lastName || '')}</strong><span class="post-date">${new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</span><span class="badge badge-cyan" style="font-size:.55rem">${post.type || 'article'}</span>${post.isPremiumOnly ? '<span class="badge badge-gold" style="font-size:.55rem">Premium</span>' : ''}${isPaid ? '<span class="badge badge-gold" style="font-size:.55rem">💰 Paid</span>' : ''}${isPaid && hasPurchased ? '<span class="badge badge-success" style="font-size:.55rem">✅ Purchased</span>' : ''}</div>
                    </div>
                    <h1 class="post-title" style="font-size:1.5rem;">${escapeHtml(post.title)}</h1>
                    ${post.featuredImage ? `<img src="${post.featuredImage}" class="post-image" alt="featured" loading="lazy">` : ''}
                    ${post.videoUrl ? `<video controls style="max-width:100%;border-radius:var(--radius-sm);margin:.75rem 0;"><source src="${post.videoUrl}" type="video/mp4"></video>` : ''}
                    <div class="post-content" style="font-size:1rem;line-height:1.8;color:var(--text2);margin:1rem 0;">
                        ${showFull ? contentHtml : `<div class="paywall-overlay"><i class="fas fa-lock" style="font-size:2.5rem;color:var(--gold);margin-bottom:.75rem;display:block;"></i><h3>🔒 Premium Article</h3><p>This article is paid content. Purchase to read the full version.</p><button class="btn btn-primary" onclick="purchaseArticle('${post._id}')">Purchase — ${fmtMoneyAPI(post.price || 500)}</button></div>`}
                    </div>
                    <div class="post-stats"><span><i class="fas fa-eye"></i> ${views} views</span><span><i class="far fa-heart"></i> ${post.likes || 0}</span><span><i class="far fa-comment"></i> ${post.commentsCount || 0}</span><span><i class="fas fa-share-alt"></i> ${post.shares || 0}</span>${earnings > 0 ? `<span class="badge badge-gold">🌱 +${fmtMoneyAPI(earnings)}</span>` : ''}</div>
                    <div class="post-actions"><button class="btn-like ${post.userLiked ? 'liked' : ''}" data-id="${post._id}"><i class="far fa-heart"></i> Like</button><button class="btn-comment" data-id="${post._id}"><i class="far fa-comment"></i> Comment</button><button class="btn-share" onclick="openShareModal('${post._id}','${post.slug}')"><i class="fas fa-share-alt"></i> Share</button></div>
                    <div class="comments-section" data-post-id="${post._id}" style="display:block;margin-top:1rem;">
                        <div class="comment-input"><textarea placeholder="Write a comment..." id="commentText-${post._id}"></textarea><button class="btn-primary btn-sm" onclick="addComment('${post._id}')">Post</button></div>
                        <div class="comments-list" id="commentsList-${post._id}"></div>
                    </div>
                </div>
            `;
    import('./feed.js').then(({ loadComments, attachPostEventListeners }) => {
        loadComments(post._id);
        attachPostEventListeners();
    });
}
