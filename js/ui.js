// js/ui.js
import { S, saveState } from './state.js';
import { toast } from './utils.js';
import { INSTALL_BANNER_KEY, BANNER_HIDE_DAYS } from './config.js';

export function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
    // Populate bank details if needed
    if (id === 'buyCourseModal' || id === 'premiumModal' || id === 'wiz-4' || id === 'campaignManualModal') {
        import('./payments.js').then(({ populateAllBankDetailsBoxes }) => populateAllBankDetailsBoxes());
    }
    if (id === 'createPostModal') {
        setTimeout(() => {
            import('./posts.js').then(({ initPostQuill, loadMyPostTitles }) => {
                initPostQuill();
                loadMyPostTitles();
            });
        }, 300);
    }
    if (id === 'shareModal') {
        document.getElementById('shareLink').textContent = `${window.FRONTEND_URL || ''}/post/${S.sharePostSlug || ''}`;
    }
}

export function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// Close modal on overlay click
document.addEventListener('click', e => { if (e.target.classList.contains('modal-ov')) e.target.classList.add('hidden'); });

export function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('cx_theme', next);
    updateThemeIcons();
    toast(`Switched to ${next} mode`, 'info');
}

export function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const iconClass = isDark ? 'fa-sun' : 'fa-moon';
    document.querySelectorAll('#themeIcon,#themeIcon2').forEach(icon => { if (icon) icon.className = 'fas ' + iconClass; });
}

export function openSidebar() { document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sbOverlay')?.classList.add('vis');
    document.body.style.overflow = 'hidden'; }

export function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sbOverlay')?.classList.remove('vis');
    document.body.style.overflow = ''; }

export function toggleNotif() { document.getElementById('notifPanel')?.classList.toggle('open');
    renderNotifs(); }

export function closeNotifPanel() { document.getElementById('notifPanel')?.classList.remove('open'); }

export function renderNotifs() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;
    if (S.notifications.length === 0) { listEl.innerHTML = '<div class="empty-state"><p>No notifications</p></div>'; } else {
        listEl.innerHTML = S.notifications.map((n, i) => { const isAffiliateOffer = n.data?.type ===
                'affiliate_offer' || n.message?.includes('Affiliate Offer'); return `<div class="notif-item ${n.unread ? 'unread' : ''}" onclick="${isAffiliateOffer ? `window.handleAffiliateOfferClick('${n.data?.courseId}')` : `markRead(${i})`}"><div class="si ${n.bg || 'si-primary'}" style="width:32px;height:32px"><i class="fas ${isAffiliateOffer ? 'fa-handshake' : (n.ic || 'fa-bell')}"></i></div><div style="flex:1"><div style="font-size:.81rem;font-weight:600">${n.title}${n.unread ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--primary);display:inline-block;margin-left:.35rem"></span>' : ''}</div><div style="font-size:.75rem;color:var(--text2)">${n.msg || n.message || ''}</div><div style="font-size:.65rem;color:var(--text3)">${n.time || ''}</div></div></div>`;
            }).join('');
    }
    const unread = S.notifications.filter(n => n.unread).length;
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
}

export async function markRead(i) {
    if (S.notifications[i]) { S.notifications[i].unread = false; try { await apiCall(
                `/users/notifications/${S.notifications[i]._id}/read`, { method: 'PUT' }); } catch (e) {} }
    renderNotifs();
}

export async function markAllRead() {
    S.notifications.forEach(n => n.unread = false);
    try { await apiCall('/users/notifications/read-all', { method: 'PUT' }); } catch (e) {}
    renderNotifs();
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
    toast('All marked as read', 'success');
}

export function shouldShowInstallBanner() {
    if (window.matchMedia('(display-mode: standalone)').matches) return false;
    const dismissedAt = localStorage.getItem(INSTALL_BANNER_KEY);
    if (!dismissedAt) return true;
    const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
    return daysSince >= BANNER_HIDE_DAYS;
}

export function dismissInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.add('hidden');
    localStorage.setItem(INSTALL_BANNER_KEY, Date.now().toString());
}

export function installPWA() {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') {
                toast('App installed! 🎉', 'success');
                const banner = document.getElementById('installBanner');
                if (banner) banner.classList.add('hidden');
                localStorage.setItem(INSTALL_BANNER_KEY, Date.now().toString());
            }
            window.deferredPrompt = null;
        });
    } else {
        toast('Tap the share icon and select "Add to Home Screen"', 'info');
    }
}

// PWA Install Banner Event
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner && shouldShowInstallBanner()) {
        banner.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    window.deferredPrompt = null;
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.add('hidden');
    localStorage.setItem(INSTALL_BANNER_KEY, Date.now().toString());
    toast('App installed! 🎉', 'success');
});
