// js/main.js
import { loadState, saveState } from './state.js';
import { initRouter } from './router.js';
import { initLanding } from './landing.js';
import { initApp } from './dashboard.js';
import { doLogin, doRegister, doLogout, handleLoginSuccess, handleForgotPassword, handleGoogleLogin, handleGithubLogin, togglePw, checkPwStr } from './auth.js';
import { toast, apiCall, showLoading, hideLoading, forceRedirect } from './utils.js';
import { openModal, closeModal, toggleTheme, updateThemeIcons, openSidebar, closeSidebar, toggleNotif, closeNotifPanel, renderNotifs, markRead, markAllRead, shouldShowInstallBanner, dismissInstallBanner, installPWA } from './ui.js';
import { setDP } from './dashboard.js';
import { goPage, navigateTo, smoothTo } from './router.js';
import { toggleMobNav, subscribeEmail, sendContact, submitReview, setReviewStar, nextWizStep, prevWizStep, toggleRole, verifyAccount, finishWizard } from './landing.js';
import { updateCurrencyPreference, renderCurrencySelectorUI } from './utils.js';

// Expose functions to window for inline onclick handlers
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doLogout = doLogout;
window.handleLoginSuccess = handleLoginSuccess;
window.handleForgotPassword = handleForgotPassword;
window.handleGoogleLogin = handleGoogleLogin;
window.handleGithubLogin = handleGithubLogin;
window.togglePw = togglePw;
window.checkPwStr = checkPwStr;
window.toast = toast;
window.apiCall = apiCall;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleTheme = toggleTheme;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotif = toggleNotif;
window.closeNotifPanel = closeNotifPanel;
window.renderNotifs = renderNotifs;
window.markRead = markRead;
window.markAllRead = markAllRead;
window.shouldShowInstallBanner = shouldShowInstallBanner;
window.dismissInstallBanner = dismissInstallBanner;
window.installPWA = installPWA;
window.setDP = setDP;
window.goPage = goPage;
window.navigateTo = navigateTo;
window.smoothTo = smoothTo;
window.toggleMobNav = toggleMobNav;
window.subscribeEmail = subscribeEmail;
window.sendContact = sendContact;
window.submitReview = submitReview;
window.setReviewStar = setReviewStar;
window.nextWizStep = nextWizStep;
window.prevWizStep = prevWizStep;
window.toggleRole = toggleRole;
window.verifyAccount = verifyAccount;
window.finishWizard = finishWizard;
window.updateCurrencyPreference = updateCurrencyPreference;

// Boot the app
const token = localStorage.getItem('cx_accessToken');
const user = JSON.parse(localStorage.getItem('cx_user') || 'null');

if (token && user) {
    // User is logged in – start app
    initApp();
} else {
    // Show landing page
    initLanding();
}

// Handle popstate for SPA routing
window.addEventListener('popstate', function() {
    const path = window.location.pathname;
    if (path && path !== '/') {
        // Handle route via router
        import('./router.js').then(({ handleRoute }) => {
            handleRoute(path);
        });
    }
});

console.log('🚀 ChangeX Academy — Modular Codebase Loaded');
console.log('📚 All modules initialized successfully.');
