// js/state.js
import { setExchangeRates } from './config.js';

export const S = {
    page: 'landing',
    dp: 'feed',
    user: null,
    loggedIn: false,
    qCurr: 0,
    qAns: {},
    lbTab: 'xp',
    admSec: 'dashboard',
    lessTab: 'overview',
    currentLessonIdx: 0,
    selectedPriceType: 'paid',
    quizQuestions: [],
    outcomes: [],
    uploadedFiles: [],
    wizStep: 0,
    wizRoles: [],
    selectedRating: 0,
    notifications: [],
    myAffiliateLinks: [],
    announcements: [],
    walletBal: 0,
    isPremium: false,
    currentBuyCourse: null,
    currentBuyBook: null,
    currentLessonType: 'video',
    auditLog: [],
    currentLessons: [],
    currentCourseId: null,
    currentEnrollmentId: null,
    editorLessons: [],
    quizBuilderList: [],
    currentEditLesson: 0,
    esStep: 1,
    landingCourses: [],
    landingInstructors: [],
    leaderboard: [],
    transactions: [],
    referrals: [],
    affiliateOffers: [],
    instructorCourses: [],
    enrollments: [],
    courseFilter: 'all',
    quillEditors: {},
    currentCourseData: null,
    certFile: null,
    certTemplateFile: null,
    adminUsers: [],
    adminCourses: [],
    adminWithdrawals: [],
    pendingApprovals: [],
    appCourses: [],
    instTab: 'courses',
    affiliateStats: null,
    lessonStartTime: null,
    feedPage: 1,
    feedFilter: 'personalized',
    posts: [],
    users: [],
    peopleSearchTerm: '',
    interactiveMaterials: [],
    postQuill: null,
    followStatus: {},
    following: [],
    followingUsers: [],
    followers: [],
    followersCount: 0,
    profileUser: null,
    challengeProgress: [],
    sharePostId: null,
    sharePostSlug: null,
    planExpiryWarningShown: false,
    socialEarnings: 0,
    poolConfig: { dailyPoolAmount: 10000, engagementWeights: { like: 1, comment: 2, share: 3, view: 0.5 } },
    topEarningPosts: [],
    reviewStars: 0,
    feedHasMore: true,
    feedIsLoading: false,
    feedSentinelObserver: null,
    feedAds: [],
    feedAdIndex: 0,
    feedTotalPages: 1,
    feedCurrentPage: 1,
    feedLoadingMore: false,
    myPostTitles: [],
    books: [],
    adminChallengeFilter: 'all',
    editingChallengeId: null,
    currentBook: null,
    currentBookId: null,
    adminBookFilter: 'all',
    editingBookId: null,
    customAds: [],
    customAdIndex: 0,
    exploreAdIndex: 0,
    exploreAds: [],
    bookAds: [],
    bookAdIndex: 0,
    adsterraLoaded: false,
    adConfig: { cpm: 1.00, cpc: 0.02, sharePercent: 50 },
    landingStats: {
        totalEarnings: '₦85M+',
        referrals: '₦12.4M',
        courses: '₦45.8M',
        streak: '🔥 1,284'
    },
    currentToolTab: 'code',
    convertFileData: null,
    convertedFileData: null,
    convertedFileType: '',
    currentVideoElement: null,
    currentVideoAdPlayed: false,
    videoAdCount: 0,
    pendingManualPaymentId: null,
    socialPosts: [],
    socialTotalEarnings: 0,
    socialAvgPerPost: 0,
    socialPostCount: 0,
    adPlacementCache: {},
    badges: [],
    splits: [],
    cohorts: [],
    purchasedArticles: [],
    premCourseLessons: [],
    analyticsData: null,
    myCampaigns: [],
    mySponsorships: [],
    sponsorTab: 'overview',
    campaignStats: null,
    campaignAnalytics: [],
    currentRoute: '/',
};

export function loadState() {
    try {
        const savedUser = JSON.parse(localStorage.getItem('cx_user') || 'null');
        if (savedUser) {
            S.user = savedUser;
            S.loggedIn = true;
            S.isPremium = savedUser.isPremium || savedUser.subscriptionTier === 'premium' || false;
            S.walletBal = savedUser.walletBalance || 0;
        }
        const savedTheme = localStorage.getItem('cx_theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
        const savedCurrency = localStorage.getItem('cx_currency');
        if (savedCurrency) {
            // Currency will be set later via exchange rates
        }
    } catch (e) {
        console.warn('State load failed:', e);
    }
}

export function saveState() {
    try {
        if (S.user) {
            localStorage.setItem('cx_user', JSON.stringify(S.user));
        }
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        localStorage.setItem('cx_theme', theme);
    } catch (e) {
        console.warn('State save failed:', e);
    }
}

export function updateUser(userData) {
    S.user = { ...S.user, ...userData };
    S.isPremium = S.user.isPremium || S.user.subscriptionTier === 'premium' || false;
    S.walletBal = S.user.walletBalance || 0;
    saveState();
    return S.user;
}

export function getCurrentCurrency() {
    return localStorage.getItem('cx_currency') || 'NGN';
}

export function setCurrentCurrency(currency) {
    localStorage.setItem('cx_currency', currency);
    return currency;
}
