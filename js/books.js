import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal } from './ui.js';

const BOOKS_API = '/books';
const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';

// ─── LOAD BOOKS ─────────────────────────────────────────────────────────

export async function loadBooks() {
    showLoading('Loading books...');
    try {
        const res = await apiCall(BOOKS_API);
        S.books = res.data || [];
        renderBooks(S.books);
        loadSidebarAd();
        loadBottomAd();
        if (!S.isPremium && !S.bookAds.length) loadBookPageAds();
    } catch (err) {
        toast('Failed to load books: ' + err.message, 'error');
        document.getElementById('booksGrid').innerHTML =
            '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load books. Please try again.</p></div>';
    } finally { hideLoading(); }
}

function renderBooks(books) {
    const container = document.getElementById('booksGrid');
    if (!container) return;
    if (!books || !books.length) {
        container.innerHTML =
            '<div class="empty-state"><i class="fas fa-book"></i><h4>No books available</h4><p>Check back soon for new additions!</p></div>';
        return;
    }
    if (!S.isPremium && !S.bookAds.length) loadBookPageAds();

    let html = '';
    const showAds = !S.isPremium && shouldShowAd('book-sponsor');
    const adFrequency = 3;
    books.filter(b => b.isPublished !== false).forEach((book, index) => {
        const isOwner = book.authorId?._id === S.user?._id || book.authorId === S.user?._id;
        let statusBadge = '';
        if (isOwner && book.status === 'pending') {
            statusBadge = `<span class="badge badge-orange" style="font-size:.55rem">⏳ Pending</span>`;
        } else if (isOwner && book.status === 'approved') {
            statusBadge = `<span class="badge badge-success" style="font-size:.55rem">✅ Approved</span>`;
        } else if (isOwner && book.status === 'rejected') {
            statusBadge = `<span class="badge badge-danger" style="font-size:.55rem">❌ Rejected</span>`;
        }
        html += `
                    <div class="book-card" onclick="openBookDetail('${book._id}')">
                        <div class="book-cover">${book.coverImage ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}" loading="lazy">` : '📖'}</div>
                        <div class="book-body">
                            <div class="book-title">${escapeHtml(book.title)} ${statusBadge}</div>
                            <div class="book-author">By ${escapeHtml(book.author || 'Unknown')}</div>
                            <div class="book-price">${book.price === 0 ? 'Free' : fmtMoneyAPI(book.price)}</div>
                            <div class="book-meta">📥 ${book.downloads || 0} downloads · 👁️ ${book.views || 0} views</div>
                        </div>
                    </div>
                `;
        if (showAds && (index + 1) % adFrequency === 0 && index < books.length - 1) {
            const ad = getNextAd('book-sponsor');
            if (ad && ad.type === 'custom') {
                html += `<div class="book-ad-banner" style="grid-column:1/-1;">${renderSponsoredBook(ad)}</div>`;
                const adId = ad.data?._id;
                if (adId) trackAdImpression(adId, null, 'custom');
            } else if (ad && ad.type === 'adsterra') {
                html += `<div class="book-ad-banner" style="grid-column:1/-1;"><div class="ad-card adsterra-wrapper"><div class="ad-label">📢 Sponsored</div><div style="text-align:center;padding:.5rem;color:var(--text3);font-size:.7rem;">Advertisement</div></div></div>`;
            }
        }
    });
    container.innerHTML = html;
    observeAdImpressions();
}

function renderSponsoredBook(ad) {
    if (!ad || !ad.data) return '';
    const d = ad.data;
    return `
                <div class="book-card sponsored" style="border: 2px solid var(--primary);">
                    <div class="book-cover">${d.imageUrl ? `<img src="${d.imageUrl}" alt="Sponsored">` : '📢'}</div>
                    <div class="book-body">
                        <div class="book-title">${escapeHtml(d.title)} <span class="badge badge-gold" style="font-size:.55rem">Ad</span></div>
                        <a href="${d.linkUrl}" target="_blank" class="btn btn-ghost btn-sm" onclick="handleAdClick('${d._id}','${d.linkUrl}','','custom')">Visit</a>
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

function loadSidebarAd() { /* handled elsewhere */ }
function loadBottomAd() { /* handled elsewhere */ }

export async function loadBookPageAds() {
    try {
        const res = await apiCall('/ads/placement/book-page');
        S.bookAds = res.data || [];
        S.bookAdIndex = 0;
        if (S.bookAds.length === 0) loadAdsterra();
    } catch (e) { loadAdsterra();
        S.bookAds = []; }
}

function loadAdsterra() {
    if (S.adsterraLoaded) return;
    if (document.getElementById('adsterra-script')) return;
    const script = document.createElement('script');
    script.id = 'adsterra-script';
    script.src = 'https://pl30155373.effectivecpmnetwork.com/cc89042fff30e53e48049a8c585d9105/invoke.js';
    script.async = true;
    script.dataset.cfasync = 'false';
    document.head.appendChild(script);
    S.adsterraLoaded = true;
}

// ─── BOOK DETAIL ────────────────────────────────────────────────────────

export async function openBookDetail(bookId) {
    showLoading('Loading book...');
    try {
        const res = await apiCall(`${BOOKS_API}/${bookId}`);
        const book = res.data;
        trackBookView(bookId);
        S.currentBook = book;
        renderBookDetail(book);
        setDP('book-detail');
        updateSEO({ title: book.title, description: book.description, thumbnail: book.coverImage });
        loadSidebarAd();
        loadBottomAd();
        if (!S.isPremium) loadBookPageAds();
    } catch (err) { toast('Failed to load book: ' + err.message, 'error');
        setDP('books'); } finally { hideLoading(); }
}

function renderBookDetail(book) {
    const container = document.getElementById('bookDetailContent');
    if (!container) return;
    const isPurchased = book.isPurchased || false;
    const isFree = book.price === 0;
    const canDownload = isFree || isPurchased;
    if (!S.isPremium && !S.bookAds.length) loadBookPageAds();

    let adHtml = '';
    if (!S.isPremium) {
        const ad = getNextAd('book-page');
        if (ad && ad.type === 'custom') {
            adHtml = `<div class="book-ad-banner mt-3">${renderSponsoredBook(ad)}</div>`;
            const adId = ad.data?._id;
            if (adId) trackAdImpression(adId, null, 'custom');
        } else if (ad && ad.type === 'adsterra') {
            adHtml = `<div class="book-ad-banner mt-3"><div class="ad-card adsterra-wrapper"><div class="ad-label">📢 Sponsored</div><div style="text-align:center;padding:.5rem;color:var(--text3);font-size:.7rem;">Advertisement</div></div></div>`;
        }
    }

    let affiliateHtml = '';
    if (book.affiliatePercent > 0 && S.isPremium) {
        const hasAffiliateLink = S.myAffiliateLinks.some(l => l.bookId === book._id);
        affiliateHtml = `
                    <div style="margin-top:1rem;padding:0.75rem;background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.2);border-radius:var(--radius-sm);">
                        <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                            <div><strong>🤝 Affiliate Opportunity</strong><div style="font-size:.78rem;color:var(--text3);">Earn ${book.affiliatePercent}% commission per sale</div></div>
                            ${hasAffiliateLink ? `<span class="badge badge-success">✅ Affiliate Link Active</span>` : `<button class="btn btn-violet btn-sm" onclick="acceptBookAffiliate('${book._id}')">Get Affiliate Link</button>`}
                        </div>
                    </div>
                `;
    }

    container.innerHTML = `
                <div class="card card-p">
                    <div style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:flex-start;">
                        <div style="flex:0 0 200px;">
                            <div style="background:linear-gradient(135deg,var(--card2),var(--card3));border-radius:var(--radius);padding:1rem;text-align:center;">
                                ${book.coverImage ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}" style="width:100%;border-radius:var(--radius-sm);">` : '<div style="font-size:5rem;padding:1rem 0;">📖</div>'}
                            </div>
                        </div>
                        <div style="flex:1;min-width:200px;">
                            <h2 style="margin-bottom:.25rem;">${escapeHtml(book.title)}</h2>
                            <p style="color:var(--text3);font-size:.9rem;">By ${escapeHtml(book.author || 'Unknown')}</p>
                            <div style="font-size:1.2rem;font-weight:800;color:var(--lime);margin:.5rem 0;">${book.price === 0 ? 'Free' : fmtMoneyAPI(book.price)}</div>
                            <p style="color:var(--text2);line-height:1.7;margin:.75rem 0;">${escapeHtml(book.description || 'No description available.')}</p>
                            <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin:.75rem 0;">
                                <span class="badge badge-dark">📥 ${book.downloads || 0} downloads</span>
                                <span class="badge badge-dark">👁️ ${book.views || 0} views</span>
                            </div>
                            ${canDownload ? `<div><button class="book-download-btn" onclick="downloadBook('${book._id}')"><i class="fas fa-download"></i> Download Now</button><div id="bookDownloadProgress-${book._id}" class="book-download-progress"><div class="prog"><div class="prog-fill pf-primary" id="bookProgBar-${book._id}" style="width:0%"></div></div><div class="prog-label" id="bookProgLabel-${book._id}">Starting download...</div></div></div>` : `<div><button class="book-purchase-btn" onclick="openBuyBook('${book._id}')"><i class="fas fa-shopping-cart"></i> Purchase — ${fmtMoneyAPI(book.price)}</button><p style="font-size:.75rem;color:var(--text3);margin-top:.5rem;">Purchase this book to download the PDF.</p></div>`}
                            ${affiliateHtml}
                            ${adHtml}
                        </div>
                    </div>
                </div>
            `;
    observeAdImpressions();
}

export async function trackBookView(bookId) {
    if (!bookId) return;
    try {
        await apiCall(`/books/${bookId}/view`, { method: 'POST' });
    } catch (e) { console.warn('Could not track book view:', e); }
}

export function openBuyBook(bookId) {
    const book = S.currentBook || S.books.find(b => b._id === bookId);
    if (!book) { toast('Book not found', 'error'); return; }
    trackBookView(bookId);
    window.currentPaymentType = 'book';
    window.currentManualBookId = bookId;
    S.currentBuyBook = book;
    const price = book.price || 0;
    document.getElementById('buyCourseInfo').innerHTML =
        `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm)"><div style="font-size:2rem">${book.coverImage ? `<img src="${book.coverImage}" style="width:50px;height:50px;object-fit:cover;border-radius:var(--radius-sm)">` : '📖'}</div><div><div style="font-weight:700;font-size:.92rem">${book.title}</div><div style="font-size:.75rem;color:var(--text3)">By ${book.author || 'Unknown'} · 👁️ ${book.views || 0}</div></div></div>`;
    document.getElementById('buyCourseSummary').innerHTML =
        `<div class="pay-summary-row"><span>Book Price</span><span>${fmtMoneyAPI(price)}</span></div><div class="pay-summary-row"><span style="font-weight:700">Total</span><span style="color:var(--primary);font-weight:800">${fmtMoneyAPI(price)}</span></div>`;
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

// ─── DOWNLOAD BOOK ─────────────────────────────────────────────────────

export async function downloadBook(bookId) {
    const token = localStorage.getItem('cx_accessToken');
    if (!token) { toast('Please log in to download', 'error');
        goPage('login'); return; }
    const book = S.currentBook || S.books.find(b => b._id === bookId);
    if (!book) { toast('Book not found', 'error'); return; }
    if (book.price > 0 && !book.isPurchased) { toast('Please purchase this book first.', 'warning');
        openBuyBook(bookId); return; }
    if (!book.fileUrl) { toast('No file available for this book.', 'error'); return; }

    const progressContainer = document.getElementById(`bookDownloadProgress-${bookId}`);
    const progressBar = document.getElementById(`bookProgBar-${bookId}`);
    const progressLabel = document.getElementById(`bookProgLabel-${bookId}`);
    if (progressContainer) progressContainer.classList.add('visible');

    showLoading('Preparing download...');
    const cleanTitle = (book.title || 'book').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
    const fileName = `${cleanTitle}.pdf`;

    try {
        const response = await fetch(book.fileUrl);
        if (!response.ok) {
            const link = document.createElement('a');
            link.href = book.fileUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast('Download started.', 'info');
            book.downloads = (book.downloads || 0) + 1;
            if (S.dp === 'book-detail' && S.currentBook) { S.currentBook.downloads = book.downloads;
                renderBookDetail(S.currentBook); }
            if (progressContainer) progressContainer.classList.remove('visible');
            hideLoading();
            return;
        }
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total) {
                const percent = Math.round((loaded / total) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (progressLabel) progressLabel.textContent = `Downloading... ${percent}%`;
                document.getElementById('loadingText').textContent = `Downloading... ${percent}%`;
            }
        }
        const blob = new Blob(chunks, { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        if (progressBar) progressBar.style.width = '100%';
        if (progressLabel) progressLabel.textContent = '✅ Download complete!';
        toast('📥 Download complete!', 'success');
        book.downloads = (book.downloads || 0) + 1;
        if (S.dp === 'book-detail' && S.currentBook) { S.currentBook.downloads = book.downloads;
            renderBookDetail(S.currentBook); }
        setTimeout(() => { if (progressContainer) progressContainer.classList.remove('visible'); if (
                progressBar) progressBar.style.width = '0%'; if (progressLabel) progressLabel
                .textContent = 'Starting download...'; }, 3000);
    } catch (err) {
        console.error('Download error:', err);
        const link = document.createElement('a');
        link.href = book.fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('Download started.', 'info');
        if (progressContainer) progressContainer.classList.remove('visible');
    } finally { hideLoading(); }
}

// ─── BOOK AFFILIATE ────────────────────────────────────────────────────

export async function acceptBookAffiliate(bookId) {
    try {
        const res = await apiCall('/affiliate/accept-book', {
            method: 'POST',
            body: { bookId }
        });
        if (res.success) {
            toast('✅ Affiliate link created!', 'success');
            if (res.data.link) copyToClipboard(res.data.link);
            import('./affiliates.js').then(({ renderAffiliates }) => renderAffiliates());
            if (S.dp === 'book-detail') {
                const book = await apiCall(`${BOOKS_API}/${bookId}`);
                renderBookDetail(book.data);
            }
        }
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ─── UPLOAD BOOK (Premium) ─────────────────────────────────────────────

export function previewBookCover(url) {
    const preview = document.getElementById('bookUploadCoverPreview');
    const img = document.getElementById('bookUploadCoverPreviewImg');
    if (url && url.trim()) {
        preview.style.display = 'block';
        img.src = url.trim();
    } else {
        preview.style.display = 'none';
    }
}

export function previewBookFile(url) {
    const preview = document.getElementById('bookUploadFilePreview');
    if (url && url.trim()) {
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

export async function submitBookForApproval() {
    if (!S.isPremium) {
        toast('Premium required to upload books', 'warning');
        openModal('premiumModal');
        return;
    }

    const title = document.getElementById('bookUploadTitle').value.trim();
    const author = document.getElementById('bookUploadAuthor').value.trim();
    const description = document.getElementById('bookUploadDesc').value.trim();
    const price = parseFloat(document.getElementById('bookUploadPrice').value) || 0;
    const coverImage = document.getElementById('bookUploadCover').value.trim();
    const fileUrl = document.getElementById('bookUploadFile').value.trim();
    const affiliatePercent = parseFloat(document.getElementById('bookUploadAffiliate').value) || 0;

    if (!title) { toast('Please enter a title', 'error'); return; }
    if (!author) { toast('Please enter an author', 'error'); return; }
    if (!fileUrl) { toast('Please provide a PDF URL', 'error'); return; }

    const payload = {
        title,
        author,
        description,
        price,
        coverImage,
        fileUrl,
        affiliatePercent,
        isPublished: false,
        status: 'pending'
    };

    showLoading('Submitting book for approval...');
    try {
        const res = await apiCall('/books', { method: 'POST', body: payload });
        if (res.success) {
            toast('✅ Book submitted for admin approval!', 'success');
            document.getElementById('bookUploadStatus').style.display = 'block';
            document.getElementById('bookUploadStatus').innerHTML = `
                            <div class="d-flex items-center gap-3">
                                <div class="si si-gold"><i class="fas fa-clock"></i></div>
                                <div>
                                    <strong>Book submitted!</strong>
                                    <p style="margin:0;font-size:.82rem;color:var(--text2);">
                                        Your book "${escapeHtml(title)}" is pending admin approval. You'll be notified once reviewed.
                                    </p>
                                </div>
                            </div>
                        `;
            document.getElementById('bookUploadTitle').value = '';
            document.getElementById('bookUploadAuthor').value = '';
            document.getElementById('bookUploadDesc').value = '';
            document.getElementById('bookUploadPrice').value = '0';
            document.getElementById('bookUploadCover').value = '';
            document.getElementById('bookUploadFile').value = '';
            document.getElementById('bookUploadAffiliate').value = '0';
            document.getElementById('bookUploadCoverPreview').style.display = 'none';
            document.getElementById('bookUploadFilePreview').style.display = 'none';
            loadBooks();
        } else {
            toast(res.message || 'Failed to submit', 'error');
        }
    } catch (err) {
        toast('Error: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

// Expose to window
window.openBookDetail = openBookDetail;
window.downloadBook = downloadBook;
window.acceptBookAffiliate = acceptBookAffiliate;
window.previewBookCover = previewBookCover;
window.previewBookFile = previewBookFile;
window.submitBookForApproval = submitBookForApproval;
window.openBuyBook = openBuyBook;
window.loadBooks = loadBooks;
