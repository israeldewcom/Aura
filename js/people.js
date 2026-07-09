import { S } from './state.js';
import { apiCall, toast, showLoading, hideLoading, escapeHtml, getAvatarUrl } from './utils.js';
import { setDP } from './dashboard.js';

// ─── PEOPLE ──────────────────────────────────────────────────────────────

export async function loadPeople() {
    showLoading('Loading users...');
    try {
        const isAdmin = S.user?.roles?.includes('admin') || S.user?.role === 'admin' || S.user?.role === 'superadmin';
        let users = [];
        if (isAdmin) {
            const res = await apiCall('/admin/users?limit=50');
            users = res.data?.users || res.data || [];
        } else {
            try {
                const res = await apiCall('/users/leaderboard?limit=50&type=xp');
                users = res.data || [];
            } catch (e) {
                document.getElementById('peopleContainer').innerHTML =
                    '<div class="empty-state"><i class="fas fa-users"></i><h4>Discover People</h4><p>Follow other learners and instructors to see their content in your feed.</p></div>';
                hideLoading();
                return;
            }
        }
        S.users = users;
        const followPromises = users.filter(u => u._id !== S.user?._id).map(async (u) => {
            try {
                const statusRes = await apiCall(`/follows/${u._id}/status`);
                const isFollowing = statusRes.data?.isFollowing || false;
                S.followStatus[u._id] = isFollowing;
                if (isFollowing) { if (!S.following.includes(u._id)) S.following.push(u._id); } else { S
                        .following = S.following.filter(id => id !== u._id); }
            } catch (e) { S.followStatus[u._id] = false; }
        });
        await Promise.all(followPromises);
        if (!S.followersCount && S.user) await loadFollowers();
        renderPeople(users);
    } catch (err) {
        toast('Failed to load users: ' + err.message, 'error');
        document.getElementById('peopleContainer').innerHTML =
            '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load users. Please try again.</p></div>';
    } finally { hideLoading(); }
}

export function renderPeople(users) {
    const container = document.getElementById('peopleContainer');
    if (!container) return;
    const term = S.peopleSearchTerm?.toLowerCase() || '';
    const filtered = term ? users.filter(u => (u.firstName + ' ' + u.lastName).toLowerCase().includes(term)) : users;
    let followersHtml = '';
    if (S.followers && S.followers.length > 0 && !term) {
        followersHtml = `
                    <div style="margin-bottom:1.5rem;width:100%;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
                            <h4 style="margin:0;">👥 Followers</h4>
                            <span class="badge badge-cyan">${S.followersCount}</span>
                        </div>
                        <div class="followers-grid">
                `;
        S.followers.forEach(f => {
            const avatarHtml = getAvatarUrl(f) ?
                `<img src="${getAvatarUrl(f)}" alt="${f.firstName || 'F'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
                (f.firstName?.[0] || 'F');
            followersHtml += `
                        <div class="follower-card" onclick="openUserProfile('${f._id}')">
                            <div class="fc-avatar">${avatarHtml}</div>
                            <div class="fc-info">
                                <div class="fc-name">${escapeHtml(f.firstName || 'User')} ${escapeHtml(f.lastName || '')}</div>
                                <div class="fc-bio">${escapeHtml(f.bio?.substring(0, 40) || '')}</div>
                            </div>
                            ${f.isPremium ? '<span class="badge badge-gold fc-badge">Premium</span>' : ''}
                        </div>
                    `;
        });
        followersHtml += `</div></div>`;
    }

    if (!filtered.length && !followersHtml) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h4>No users found</h4></div>';
        return;
    }

    let peopleHtml = '';
    if (filtered.length) {
        peopleHtml = filtered.map(u => {
            const isFollowing = S.followStatus[u._id] || false;
            const avatarHtml = getAvatarUrl(u) ?
                `<img src="${getAvatarUrl(u)}" alt="${u.firstName || 'U'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
                (u.firstName?.[0] || 'U');
            return `
                        <div class="person-card card card-p" onclick="openUserProfile('${u._id}')">
                            <div class="person-avatar" style="background:linear-gradient(135deg,var(--primary),var(--secondary));">
                                ${avatarHtml}
                            </div>
                            <div class="person-info">
                                <strong>${escapeHtml(u.firstName || 'User')} ${escapeHtml(u.lastName || '')}</strong>
                                <span>${escapeHtml(u.bio?.substring(0, 60) || 'No bio')}</span>
                                ${u.isApprovedInstructor ? '<span class="badge badge-violet" style="font-size:.55rem">Instructor</span>' : ''}
                                ${u.isPremium ? '<span class="badge badge-gold" style="font-size:.55rem">Premium</span>' : ''}
                                ${u._id !== S.user?._id && isFollowing ? '<span class="follow-badge"><i class="fas fa-check"></i> Following</span>' : ''}
                            </div>
                            ${u._id !== S.user?._id ? `<button class="btn-follow ${isFollowing ? 'following' : ''}" onclick="event.stopPropagation();followUser('${u._id}')">${isFollowing ? 'Following' : 'Follow'}</button>` : '<span class="badge badge-dark">You</span>'}
                        </div>`;
        }).join('');
    }

    container.innerHTML = followersHtml + peopleHtml;
    const navFollowingBadge = document.getElementById('navFollowingBadge');
    if (navFollowingBadge) { navFollowingBadge.textContent = S.following.filter(id => id !== S.user?._id).length; }
}

export function filterPeople(term) { S.peopleSearchTerm = term;
    renderPeople(S.users); }

export async function followUser(userId) {
    try {
        const res = await apiCall(`/follows/${userId}/follow`, { method: 'POST' });
        const isNowFollowing = res.followed;
        S.followStatus[userId] = isNowFollowing;
        if (isNowFollowing) {
            if (!S.following.includes(userId)) {
                S.following.push(userId);
                try {
                    const userRes = await apiCall(`/users/${userId}/profile`);
                    if (userRes.data) {
                        const user = userRes.data.user || userRes.data;
                        if (!S.followingUsers.some(u => u._id === user._id)) { S.followingUsers.push(user); }
                    }
                } catch (_) {}
            }
        } else {
            S.following = S.following.filter(id => id !== userId);
            S.followingUsers = S.followingUsers.filter(u => u._id !== userId);
        }
        try {
            localStorage.setItem('cx_following', JSON.stringify(S.following));
            localStorage.setItem('cx_followingUsers', JSON.stringify(S.followingUsers));
        } catch (e) {}
        document.getElementById('navFollowingBadge').textContent = S.following.length;
        await loadFollowers();
        toast(res.message || (isNowFollowing ? 'Followed!' : 'Unfollowed'), 'success');
        if (S.dp === 'people') renderPeople(S.users);
        if (S.dp === 'profile' && S.profileUser) {
            const res2 = await apiCall(`/users/${S.profileUser._id}/profile`);
            renderUserProfile(res2.data);
        }
        if (S.dp === 'following') loadFollowing();
    } catch (err) { toast('Error: ' + err.message, 'error'); }
}

export async function openUserProfile(userId) {
    showLoading('Loading profile...');
    try {
        const res = await apiCall(`/users/${userId}/profile`);
        const data = res.data;
        S.profileUser = data.user;
        renderUserProfile(data);
        setDP('profile');
    } catch (err) { toast('Failed to load profile: ' + err.message, 'error'); } finally { hideLoading(); }
}

export function renderUserProfile(data) {
    const container = document.getElementById('profileContent');
    if (!container) return;
    const user = data.user;
    const posts = data.posts || [];
    const courses = data.courses || [];
    const challengeProgress = data.challengeProgress || [];
    const isFollowing = data.isFollowing || false;
    const isOwnProfile = S.user?._id === user._id;
    const totalEarnings = isOwnProfile ? posts.reduce((sum, p) => sum + (p.earnings || 0), 0) : 0;
    const avatarHtml = getAvatarUrl(user) ?
        `<img src="${getAvatarUrl(user)}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
        (user.firstName?.[0] || 'U');
    const isAdmin = S.user?.roles?.includes('admin');
    const canSeeEarnings = isOwnProfile || isAdmin;

    container.innerHTML = `
                <div class="profile-header" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;background:var(--bg2);padding:1.5rem;border-radius:var(--radius);margin-bottom:1.5rem;">
                    <div class="profile-avatar" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:#000;flex-shrink:0;overflow:hidden;">
                        ${avatarHtml}
                    </div>
                    <div style="flex:1;">
                        <h2>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h2>
                        <p style="color:var(--text2);">${escapeHtml(user.bio || 'No bio yet')}</p>
                        <div style="display:flex;gap:1rem;font-size:.85rem;color:var(--text3);flex-wrap:wrap;">
                            <span><strong>${data.followersCount || 0}</strong> followers</span>
                            <span><strong>${data.followingCount || 0}</strong> following</span>
                            <span><strong>${posts.length}</strong> posts</span>
                            ${canSeeEarnings ? `<span><strong>${fmtMoneyAPI(totalEarnings)}</strong> earned from posts</span>` : ''}
                            ${user.isPremium ? '<span class="badge badge-gold">Premium</span>' : ''}
                            ${user.isApprovedInstructor ? '<span class="badge badge-violet">Instructor</span>' : ''}
                        </div>
                        ${user._id !== S.user?._id ? `<button class="btn-follow ${isFollowing ? 'following' : ''}" onclick="followUser('${user._id}')" style="margin-top:.5rem;">${isFollowing ? 'Unfollow' : 'Follow'}</button>` : ''}
                    </div>
                </div>
                <div class="profile-content">
                    ${canSeeEarnings ? `
                    <h4>💰 Wallet</h4>
                    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem;margin-bottom:1.5rem;">
                        <span style="font-size:.8rem;color:var(--text3);">Balance</span>
                        <div style="font-family:var(--font-heading);font-size:1.5rem;color:var(--lime);">${fmtMoneyAPI(user.walletBalance || 0)}</div>
                    </div>
                    ` : ''}
                    <h4>🏆 Challenges</h4>
                    <div style="margin-bottom:1.5rem;">
                        ${challengeProgress.length ? challengeProgress.map(cp => `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.5rem .75rem;margin-bottom:.4rem;"><div style="display:flex;justify-content:space-between;"><strong>${cp.challengeId?.title || 'Challenge'}</strong><span class="badge ${cp.status === 'completed' ? 'badge-success' : 'badge-cyan'}">${cp.status}</span></div><div class="prog" style="height:4px;margin-top:.3rem;"><div class="prog-fill pf-primary" style="width:${cp.progress || 0}%"></div></div><div style="font-size:.7rem;color:var(--text3);">${cp.progress || 0}% complete</div></div>`).join('') : '<p style="color:var(--text3);">No challenges joined.</p>'}
                    </div>
                    <h4>📝 Posts</h4>
                    <div class="profile-collection">
                        ${posts.length ? posts.map(p => {
                            const slug = p.slug || p._id;
                            const postUrl = `${FRONTEND_URL}/post/${slug}`;
                            const isAdmin = S.user?.roles?.includes('admin');
                            const showEarnings = canSeeEarnings && p.earnings > 0;
                            return `<div class="collection-item" onclick="window.location.href='${postUrl}'" style="cursor:pointer"><span class="ci-type">${p.type || 'post'}</span><div class="ci-title">${escapeHtml(p.title)}</div><div class="ci-meta">${new Date(p.publishedAt || p.createdAt).toLocaleDateString()} · ❤️ ${p.likes || 0} · 💬 ${p.commentsCount || 0} · 👁️ ${p.views || 0}${showEarnings ? ` · <span style="color:var(--primary);font-weight:700;">${fmtMoneyAPI(p.earnings || 0)}</span>` : ''}</div>${(S.user?._id === user._id || isAdmin) ? `<div class="ci-actions"><button class="post-delete-btn" onclick="event.stopPropagation();deletePost('${p._id}')"><i class="fas fa-trash"></i> Delete</button></div>` : ''}</div>`;
                        }).join('') : '<p style="color:var(--text3);">No posts yet</p>'}
                    </div>
                    <h4 class="mt-4">📚 Courses</h4>
                    <div class="profile-collection">
                        ${courses.length ? courses.map(c => `<div class="collection-item" onclick="openBuyCourse('${c._id}')" style="cursor:pointer"><span class="ci-type">course</span><div class="ci-title">${escapeHtml(c.title)}</div><div class="ci-meta">${c.totalLessons || 0} lessons · ${c.level || 'All levels'} · ${fmtMoneyAPI(c.price || 0)} · 👁️ ${c.views || 0}</div>${c.hasAffiliate ? `<span class="badge badge-violet" style="font-size:.55rem">${c.affiliatePercent || 0}% aff</span>` : ''}</div>`).join('') : '<p style="color:var(--text3);">No courses yet</p>'}
                    </div>
                </div>
            `;
    import('./feed.js').then(({ attachPostEventListeners }) => attachPostEventListeners());
}

export async function loadUserFollowing() {
    if (!S.user) return;
    try {
        const res = await apiCall(`/follows/${S.user._id}/following`);
        const users = res.data || [];
        S.following = users.map(u => u._id);
        S.followingUsers = users;
        users.forEach(u => { S.followStatus[u._id] = true; });
        try {
            localStorage.setItem('cx_following', JSON.stringify(S.following));
            localStorage.setItem('cx_followingUsers', JSON.stringify(users));
        } catch (e) {}
        const navFollowingBadge = document.getElementById('navFollowingBadge');
        if (navFollowingBadge) { navFollowingBadge.textContent = S.following.length; }
        console.log('✅ Following loaded:', S.following.length, 'users');
    } catch (err) {
        console.warn('Could not load following:', err);
        try {
            const cached = JSON.parse(localStorage.getItem('cx_following') || '[]');
            const users = JSON.parse(localStorage.getItem('cx_followingUsers') || '[]');
            if (cached.length) {
                S.following = cached;
                S.followingUsers = users;
                S.following.forEach(id => { S.followStatus[id] = true; });
                const navFollowingBadge = document.getElementById('navFollowingBadge');
                if (navFollowingBadge) { navFollowingBadge.textContent = cached.length; }
            }
        } catch (e) {}
    }
}

export async function loadFollowers() {
    if (!S.user) return;
    try {
        const res = await apiCall(`/follows/${S.user._id}/followers`);
        const data = res.data || [];
        S.followers = data;
        S.followersCount = data.length;
        const followersCountEl = document.getElementById('followersCount');
        if (followersCountEl) followersCountEl.textContent = S.followersCount;
        if (S.dp === 'people') renderPeople(S.users);
    } catch (err) {
        console.warn('Could not load followers:', err);
        S.followers = [];
        S.followersCount = 0;
    }
}

export async function loadFollowing() {
    const container = document.getElementById('followingContainer');
    if (!container) return;
    let html =
        `<h4 style="margin-bottom:1rem">People you follow (${S.followingUsers?.length || S.following?.length || 0})</h4>`;
    if (S.followingUsers && S.followingUsers.length) {
        html += `<div class="following-collection" style="margin-bottom:1.5rem">`;
        S.followingUsers.forEach(u => {
            const avatarHtml = getAvatarUrl(u) ?
                `<img src="${getAvatarUrl(u)}" alt="${u.firstName || 'U'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` :
                (u.firstName?.[0] || 'U');
            html += `
                        <div class="following-item" onclick="openUserProfile('${u._id}')">
                            <div class="fi-header"><div class="fi-avatar" style="background:linear-gradient(135deg,var(--primary),var(--secondary));">${avatarHtml}</div><div class="fi-name">${escapeHtml(u.firstName || 'User')} ${escapeHtml(u.lastName || '')}</div>${u.isPremium ? '<span class="badge badge-gold" style="font-size:.55rem">Premium</span>' : ''}</div>
                            <div class="fi-content">${escapeHtml(u.bio?.substring(0, 80) || 'No bio')}</div>
                        </div>`;
        });
        html += `</div><hr style="margin:1rem 0;">`;
    } else {
        html +=
            `<div class="empty-state" style="padding:1rem 0;"><p>You aren't following anyone yet. Discover people to follow!</p><button class="btn btn-primary btn-sm" onclick="setDP('people')">Discover People</button></div><hr style="margin:1rem 0;">`;
    }
    if (!S.following || !S.following.length) {
        container.innerHTML = html +
            `<div class="empty-state"><i class="fas fa-rss"></i><h4>No posts from people you follow</h4></div>`;
        return;
    }
    showLoading('Loading following feed...');
    try {
        const res = await apiCall(`/posts/following?page=1&limit=20`);
        const posts = res.data?.posts || res.data || [];
        if (!posts.length) {
            container.innerHTML = html +
                `<div class="empty-state"><i class="fas fa-rss"></i><h4>No posts from people you follow</h4><p>Your followers haven't posted anything yet.</p></div>`;
            return;
        }
        container.innerHTML = html + posts.map(p => import('./feed.js').then(({ renderPostCard }) => renderPostCard(p))).join('');
        import('./feed.js').then(({ attachPostEventListeners }) => attachPostEventListeners());
    } catch (err) {
        container.innerHTML = html +
            '<div class="empty-state"><p>Failed to load following feed: ' + err.message + '</p></div>';
    } finally { hideLoading(); }
}

const FRONTEND_URL = window.location.origin || 'https://changex.academy';
