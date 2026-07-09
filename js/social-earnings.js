import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';

export async function renderSocialEarnings() {
    showLoading('Loading social earnings...');
    try {
        const res = await apiCall('/posts/my/social-earnings');
        const data = res.data || {};
        S.socialPosts = data.posts || [];
        S.socialTotalEarnings = data.totalEarnings || 0;
        S.socialPostCount = S.socialPosts.length;
        S.socialAvgPerPost = S.socialPostCount ? S.socialTotalEarnings / S.socialPostCount : 0;

        document.getElementById('socialTotalEarnings').textContent = fmtMoneyAPI(S.socialTotalEarnings);
        document.getElementById('socialPostCount').textContent = S.socialPostCount;
        document.getElementById('socialAvgPerPost').textContent = S.socialPostCount ? fmtMoneyAPI(S
            .socialAvgPerPost) : '₦0';

        const container = document.getElementById('socialPostsList');
        if (!S.socialPosts.length) {
            container.innerHTML =
                `<div class="empty-state"><i class="fas fa-seedling"></i><h4>No posts yet</h4><p>Create posts to start earning from social engagement!</p><button class="btn btn-primary btn-sm" onclick="openCreatePostModal()">Create Post</button></div>`;
            return;
        }

        container.innerHTML = S.socialPosts.map(p => {
            const slug = p.id || p._id || 'post';
            return `
                        <div class="social-post-item card card-p" onclick="window.location.href='/post/${slug}'">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap;">
                                <div style="flex:1;min-width:0;">
                                    <h4 style="font-size:.95rem;margin-bottom:.25rem;">${escapeHtml(p.title)}</h4>
                                    <div style="font-size:.75rem;color:var(--text3);">
                                        <span><i class="fas fa-eye"></i> ${p.impressions || 0}</span>
                                        <span style="margin-left:.75rem;"><i class="fas fa-heart"></i> ${p.likes || 0}</span>
                                        <span style="margin-left:.75rem;"><i class="fas fa-comment"></i> ${p.comments || 0}</span>
                                        <span style="margin-left:.75rem;"><i class="fas fa-share-alt"></i> ${p.shares || 0}</span>
                                    </div>
                                </div>
                                <div style="font-family:var(--font-heading);font-size:1.2rem;font-weight:800;color:var(--lime);flex-shrink:0;">
                                    ${fmtMoneyAPI(p.earnings || 0)}
                                </div>
                            </div>
                            <div class="prog mt-2" style="height:4px;background:var(--border);">
                                <div class="prog-fill pf-primary" style="width:${S.socialTotalEarnings ? Math.min(100, ((p.earnings || 0) / (S.socialTotalEarnings || 1)) * 100) : 0}%;"></div>
                            </div>
                        </div>
                    `;
        }).join('');
        updateSocialBadge();
    } catch (err) {
        toast('Failed to load social earnings: ' + err.message, 'error');
        document.getElementById('socialPostsList').innerHTML =
            '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load social earnings. Please try again.</p></div>';
    } finally { hideLoading(); }
}

export async function updateSocialBadge() {
    try {
        const res = await apiCall('/posts/my/social-earnings');
        const total = res.data?.totalEarnings || 0;
        const badge = document.getElementById('navSocialBadge');
        if (badge) badge.textContent = fmtMoneyAPI(total);
        S.socialTotalEarnings = total;
    } catch (e) { console.warn('Could not update social badge:', e); }
}

// Expose
window.renderSocialEarnings = renderSocialEarnings;
window.updateSocialBadge = updateSocialBadge;
