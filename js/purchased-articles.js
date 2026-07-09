import { S } from './state.js';
import { apiCall, toast, escapeHtml } from './utils.js';

export async function loadPurchasedArticles() {
    try {
        const res = await apiCall('/posts/purchased');
        const articles = res.data || [];
        S.purchasedArticles = articles;
        const container = document.getElementById('purchasedArticlesList');
        if (!container) return;
        if (!articles.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>You haven\'t purchased any articles yet.</p></div>';
            return;
        }
        container.innerHTML = articles.map(a => {
            const post = a.postId || {};
            const slug = post.slug || a.postId || 'article';
            return `
                        <div class="card card-p mb-2" onclick="window.location.href='/post/${slug}'">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
                                <div>
                                    <strong>${escapeHtml(post.title || 'Article')}</strong>
                                    <div style="font-size:.75rem;color:var(--text3);">Purchased: ${new Date(a.createdAt).toLocaleDateString()}</div>
                                </div>
                                <span class="badge badge-success">✅ Purchased</span>
                            </div>
                        </div>
                    `;
        }).join('');
    } catch (err) {
        console.warn('Could not load purchased articles:', err);
        const container = document.getElementById('purchasedArticlesList');
        if (container) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>No purchased articles found.</p></div>';
        }
    }
}

// Expose
window.loadPurchasedArticles = loadPurchasedArticles;
