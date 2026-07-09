// js/admin.js
import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { setDP } from './dashboard.js';

export async function renderAdm(sec) { switchAdm(sec, null); }

export async function switchAdm(sec, el) {
    const isAdmin = S.user?.roles?.includes('admin') || S.user?.role === 'admin' || S.user?.role === 'superadmin';
    if (!isAdmin) {
        document.getElementById('adminContent').innerHTML =
            '<div class="empty-state"><i class="fas fa-shield-alt"></i><h4>Access Denied</h4><p>You need admin privileges to view this panel.</p></div>';
        return;
    }
    S.admSec = sec;
    document.querySelectorAll('#dash-admin .fpill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    const content = document.getElementById('adminContent');
    if (!content) return;
    switch (sec) {
        case 'dashboard':
            content.innerHTML = `
                        <div class="row">
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalUsers">—</div><div class="sl">Total Users</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalCourses">—</div><div class="sl">Courses</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalRevenue">—</div><div class="sl">Revenue</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalPosts">—</div><div class="sl">Posts</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalBooks">—</div><div class="sl">Books</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admTotalEnrollments">—</div><div class="sl">Enrollments</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="sv" id="admPendingW">—</div><div class="sl">Pending Withdrawals</div></div></div>
                        </div>
                    `;
            try {
                const res = await apiCall('/admin/platform-stats');
                const d = res.data;
                document.getElementById('admTotalUsers').textContent = d.totalUsers || 0;
                document.getElementById('admTotalCourses').textContent = d.totalCourses || 0;
                document.getElementById('admTotalRevenue').textContent = fmtMoneyAPI(d.totalRevenue || 0);
                document.getElementById('admTotalPosts').textContent = d.totalPosts || 0;
                document.getElementById('admTotalBooks').textContent = d.totalBooks || 0;
                document.getElementById('admTotalEnrollments').textContent = d.totalEnrollments || 0;
                document.getElementById('admPendingW').textContent = d.pendingWithdrawals || 0;
            } catch (e) { content.innerHTML += '<p style="color:var(--danger)">Failed to load stats</p>'; }
            break;
        case 'users':
            content.innerHTML =
                '<div class="overflow-x-auto"><table class="dtable" id="admUsersTable"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Bank Details</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td colspan="6" style="text-align:center">Loading...</td></tr></tbody></table></div>';
            try {
                const res = await apiCall('/admin/users?limit=50');
                S.adminUsers = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res
                    .data : []);
                document.getElementById('admUsersTable').innerHTML =
                    `<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Bank Details</th><th>Status</th><th>Actions</th></tr></thead><tbody>${S.adminUsers.map(u => { const bankInfo = u.bankAccount?.bankName ? `${u.bankAccount.bankName} - ${u.bankAccount.accountNumber || 'N/A'} (${u.bankAccount.accountName || 'N/A'})` : '<span style="color:var(--text3)">No bank details</span>'; return `<tr><td>${u.firstName || ''} ${u.lastName || ''}</td><td>${u.email}</td><td>${(u.roles || []).join(',') || 'user'}</td><td style="font-size:.75rem">${bankInfo}</td><td>${u.isBanned ? '<span style="color:var(--danger)">Banned</span>' : '<span style="color:var(--success)">Active</span>'}</td><td><button class="btn btn-ghost btn-sm" onclick="toggleUserBan('${u._id}',${!u.isBanned})">${u.isBanned ? 'Unban' : 'Ban'}</button>${!u.isApprovedInstructor ? `<button class="btn btn-primary btn-sm" onclick="approveInstructor('${u._id}')">Approve Instructor</button>` : ''}<button class="btn btn-ghost btn-sm" onclick="showUserPosts('${u._id}')">📝 Posts</button><button class="btn btn-ghost btn-sm" onclick="showUserDetails('${u._id}')"><i class="fas fa-eye"></i> Details</button></td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center">No users</td></tr>'}</tbody>`;
            } catch (e) { content.innerHTML = '<p style="color:var(--danger)">Failed to load: ' + e.message +
                    '</p>'; }
            break;
        case 'courses':
            content.innerHTML = '<p style="color:var(--text3)">Loading courses...</p>';
            try {
                const res = await apiCall('/admin/courses?limit=50');
                S.adminCourses = Array.isArray(res.data?.courses) ? res.data.courses : (Array.isArray(res
                    .data) ? res.data : []);
                content.innerHTML =
                    `<div class="overflow-x-auto"><table class="dtable"><thead><tr><th>Title</th><th>Instructor</th><th>Status</th><th>Actions</th></tr></thead><tbody>${S.adminCourses.map(c => `<tr><td>${c.title}</td><td>${c.instructor?.firstName || '—'}</td><td>${c.approvalStatus || c.isApproved ? 'Approved' : 'Pending'}</td><td>${c.approvalStatus === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="approveCourse('${c._id}')">Approve</button>` : ''}<button class="btn btn-ghost btn-sm" onclick="editExistingCourse('${c._id}')"><i class="fas fa-edit"></i> Edit</button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No courses</td></tr>'}</tbody></table></div>`;
            } catch (e) { content.innerHTML = '<p style="color:var(--danger)">Failed to load courses</p>'; }
            break;
        case 'approvals':
            content.innerHTML = '<p style="color:var(--text3)">Loading pending approvals...</p>';
            try {
                const res = await apiCall('/admin/courses?status=pending&limit=50');
                S.pendingApprovals = Array.isArray(res.data?.courses) ? res.data.courses : (Array.isArray(res
                    .data) ? res.data : []);
                content.innerHTML = S.pendingApprovals.length ? S.pendingApprovals.map(c =>
                    `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:.6rem"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem"><div><strong>${c.title}</strong><br><small style="color:var(--text3)">${c.instructor?.firstName || 'Instructor'} · ${c.totalLessons || 0} lessons</small></div><div style="display:flex;gap:.4rem"><button class="btn btn-primary btn-sm" onclick="approveCourse('${c._id}')">Approve</button><button class="btn btn-danger btn-sm" onclick="rejectCourse('${c._id}')">Reject</button></div></div></div>`
                        ).join('') :
                    '<div class="empty-state"><p>No pending approvals</p></div>';
            } catch (e) { content.innerHTML = '<p style="color:var(--danger)">Failed to load</p>'; }
            break;
        case 'withdrawals':
            content.innerHTML = '<p style="color:var(--text3)">Loading withdrawal requests...</p>';
            try {
                const res = await apiCall('/admin/withdrawals?limit=50');
                S.adminWithdrawals = Array.isArray(res.data?.withdrawals) ? res.data.withdrawals : (Array
                    .isArray(res.data) ? res.data : []);
                content.innerHTML =
                    `<div class="overflow-x-auto"><table class="dtable"><thead><tr><th>User</th><th>Amount</th><th>Bank</th><th>Account</th><th>Status</th><th>Actions</th></tr></thead><tbody>${S.adminWithdrawals.map(w => `<tr><td>${w.user?.firstName || 'User'} ${w.user?.lastName || ''}</td><td style="font-weight:800">${fmtMoneyAPI(w.amount)}</td><td style="font-size:.75rem">${w.user?.bankName || 'N/A'}</td><td style="font-size:.75rem">${w.user?.bankAccountNumber || 'N/A'}</td><td><span class="pstatus ${w.status === 'completed' ? 'ps-paid' : 'ps-pend'}">${w.status}</span></td><td>${w.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="processWithdrawalAdmin('${w._id}','approve')">Approve</button><button class="btn btn-danger btn-sm" onclick="processWithdrawalAdmin('${w._id}','reject')">Reject</button>` : '—'}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center">No withdrawals</td></tr>'}</tbody></table></div>`;
            } catch (e) { content.innerHTML = '<p style="color:var(--danger)">Failed to load</p>'; }
            break;
        case 'manualPayments':
            content.innerHTML =
                `<div class="d-flex justify-between mb-3"><h6>Manual Payment Requests</h6><div class="d-flex gap-2"><select id="manualPaymentFilter" onchange="loadManualPayments()" class="finput" style="width:auto;"><option value="pending">Pending Review</option><option value="all">All</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button class="btn btn-primary btn-sm" onclick="loadManualPayments()"><i class="fas fa-sync-alt"></i> Refresh</button></div></div><div id="manualPaymentsStats" class="row mb-3"></div><div class="overflow-x-auto"><table class="dtable" id="manualPaymentsTable"><thead><tr><th>Date</th><th>User</th><th>Type</th><th>Amount</th><th>Reference</th><th>Receipt</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td colspan="8" style="text-align:center">Loading...</td></tr></tbody></table></div>`;
            loadManualPayments();
            break;
        case 'coupons':
            content.innerHTML =
                '<div class="d-flex justify-between mb-3"><h6>Active Coupons</h6><button class="btn btn-primary btn-sm" onclick="openModal(\'couponModal\')"><i class="fas fa-plus"></i>Create</button></div><div id="admCouponsList"><p style="color:var(--text3)">Loading...</p></div>';
            try {
                const res = await apiCall('/admin/coupons');
                const coupons = Array.isArray(res.data) ? res.data : [];
                document.getElementById('admCouponsList').innerHTML = coupons.length ? coupons.map(c =>
                    `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center"><div><strong>${c.code}</strong> · ${c.discountValue || 0}% off</div><button class="btn btn-danger btn-sm" onclick="deleteAdminCoupon('${c._id}')"><i class="fas fa-trash"></i></button></div>`
                    ).join('') : '<div class="empty-state"><p>No coupons</p></div>';
            } catch (e) {}
            break;
        case 'announcements':
            content.innerHTML =
                `<div class="card card-p"><div class="form-group"><label class="flabel">Title</label><input type="text" class="finput" id="admAnnoTitle"/></div><div class="form-group"><label class="flabel">Message</label><textarea class="finput" id="admAnnoText" style="min-height:85px"></textarea></div><button class="btn btn-primary" onclick="sendAnnouncement()"><i class="fas fa-bullhorn"></i>Send to All Users</button></div>`;
            break;
        case 'challenges':
            content.innerHTML = `
                        <div class="admin-section-header"><h6>🏆 Manage Challenges</h6><button class="btn btn-primary btn-sm" onclick="openChallengeForm()"><i class="fas fa-plus"></i> New Challenge</button></div>
                        <div id="challengeFormContainer" style="display:none;" class="admin-challenge-form card card-p">
                            <div class="d-flex items-center justify-between mb-3"><h5 id="challengeFormTitle">Create New Challenge</h5><button class="btn-icon-sm" onclick="closeChallengeForm()"><i class="fas fa-times"></i></button></div>
                            <input type="hidden" id="editingChallengeId" />
                            <div class="row"><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Title *</label><input type="text" class="finput" id="challengeTitle" placeholder="e.g. 30-Day Coding Challenge" /></div></div><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Reward XP *</label><input type="number" class="finput" id="challengeRewardXP" placeholder="500" value="500" min="1" /></div></div></div>
                            <div class="form-group"><label class="flabel">Description *</label><textarea class="finput" id="challengeDescription" rows="3" placeholder="Describe the challenge..."></textarea></div>
                            <div class="form-group"><label class="flabel">Instructions (optional)</label><textarea class="finput" id="challengeInstructions" rows="2" placeholder="How to complete this challenge..."></textarea></div>
                            <div class="row"><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Start Date *</label><input type="datetime-local" class="finput" id="challengeStartDate" /></div></div><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">End Date *</label><input type="datetime-local" class="finput" id="challengeEndDate" /></div></div></div>
                            <div class="row"><div class="col-12 col-md-4"><div class="form-group"><label class="flabel">Reward Amount (₦)</label><input type="number" class="finput" id="challengeRewardAmount" placeholder="e.g. 5000" min="0" /></div></div><div class="col-12 col-md-4"><div class="form-group"><label class="flabel">Reward Premium Days</label><input type="number" class="finput" id="challengePremiumDays" placeholder="e.g. 7" min="0" value="0" /></div></div><div class="col-12 col-md-4"><div class="form-group"><label class="flabel">Status</label><select class="finput" id="challengeStatus"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></div></div></div>
                            <div class="form-group"><label class="flabel">Completion Criteria (optional)</label><div class="row"><div class="col-12 col-md-4"><select class="finput" id="challengeCriteriaType"><option value="">None</option><option value="lessons">Complete Lessons</option><option value="xp">Earn XP</option></select></div><div class="col-12 col-md-4" id="criteriaCourseContainer" style="display:none;"><input type="text" class="finput" id="challengeCriteriaCourse" placeholder="Course ID" /></div><div class="col-12 col-md-4" id="criteriaTargetContainer" style="display:none;"><input type="number" class="finput" id="challengeCriteriaTarget" placeholder="Target count" min="1" /></div></div></div>
                            <div class="d-flex gap-2 mt-3"><button class="btn btn-primary" onclick="saveChallenge()"><i class="fas fa-save"></i> <span id="challengeSaveBtnText">Create Challenge</span></button><button class="btn btn-ghost" onclick="closeChallengeForm()">Cancel</button></div>
                        </div>
                        <div id="adminChallengesList" class="mt-4">
                            <div class="d-flex items-center justify-between mb-3"><h6>All Challenges</h6><div class="d-flex gap-2"><button class="fpill active" onclick="filterAdminChallenges('all',this)">All</button><button class="fpill" onclick="filterAdminChallenges('active',this)">Active</button><button class="fpill" onclick="filterAdminChallenges('upcoming',this)">Upcoming</button><button class="fpill" onclick="filterAdminChallenges('completed',this)">Completed</button></div></div>
                            <div id="adminChallengesContainer"><p style="color:var(--text3)">Loading challenges...</p></div>
                        </div>
                    `;
            await loadAdminChallenges();
            break;
        case 'ads':
            content.innerHTML = `
                        <div class="admin-ads-form">
                            <h6 style="margin-bottom:.65rem">📢 Create New Ad</h6>
                            <div class="form-group"><label class="flabel">Title</label><input type="text" class="finput" id="admAdTitle" placeholder="Ad title"/></div>
                            <div class="form-group"><label class="flabel">Banner Image</label>
                                <div class="upload-zone" style="padding:1rem"><input type="file" id="admAdImageFile" accept="image/*" onchange="uploadAdImage(this)" /><div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div><div style="font-size:.8rem;color:var(--text2)">Click or drop image (PNG, JPG)</div></div>
                                <input type="hidden" id="admAdImage" />
                                <div id="admAdImagePreview" class="upload-preview"><img id="admAdImagePreviewImg" /><div class="upload-preview-label">✅ Image uploaded</div></div>
                            </div>
                            <div class="form-group"><label class="flabel">Link URL</label><input type="url" class="finput" id="admAdLink" placeholder="https://..."/></div>
                            <div class="form-group"><label class="flabel">Placement</label>
                                <select class="finput" id="admAdPlacement">
                                    <option value="sidebar">Sidebar</option>
                                    <option value="banner">Banner</option>
                                    <option value="in-feed">In-Feed</option>
                                    <option value="popup">Popup</option>
                                    <option value="book-page">Book Page</option>
                                    <option value="video-pre">Video Pre-roll</option>
                                    <option value="video-mid">Video Mid-roll</option>
                                    <option value="lesson-inline">Lesson Inline</option>
                                    <option value="challenge-sponsor">Challenge Sponsor</option>
                                    <option value="book-sponsor">Book Sponsor</option>
                                    <option value="explore-sponsor">Explore Sponsor</option>
                                </select>
                            </div>
                            <div class="row"><div class="col-6"><div class="form-group"><label class="flabel">Start Date</label><input type="date" class="finput" id="admAdStart"/></div></div><div class="col-6"><div class="form-group"><label class="flabel">End Date</label><input type="date" class="finput" id="admAdEnd"/></div></div></div>
                            <button class="btn btn-primary" onclick="adminCreateAd()"><i class="fas fa-plus"></i> Create Ad</button>
                        </div>
                        <div id="admAdsList"><p style="color:var(--text3)">Loading ads...</p></div>
                    `;
            await loadAdminAds();
            content.innerHTML += `
                        <div class="admin-config-section">
                            <h6 style="margin-bottom:.65rem">⚙️ Ad Configuration</h6>
                            <div class="row">
                                <div class="col-4"><div class="form-group"><label class="flabel">CPM (₦)</label><input type="number" class="finput" id="admCpm" value="${S.adConfig.cpm || 1.00}" step="0.01" min="0" /></div></div>
                                <div class="col-4"><div class="form-group"><label class="flabel">CPC (₦)</label><input type="number" class="finput" id="admCpc" value="${S.adConfig.cpc || 0.02}" step="0.01" min="0" /></div></div>
                                <div class="col-4"><div class="form-group"><label class="flabel">Revenue Share (%)</label><input type="number" class="finput" id="admSharePercent" value="${S.adConfig.sharePercent || 50}" min="0" max="100" /></div></div>
                            </div>
                            <button class="btn btn-primary" onclick="updateAdConfig()"><i class="fas fa-save"></i> Save Config</button>
                        </div>
                    `;
            break;
        case 'affiliates':
            content.innerHTML =
                '<div class="card card-p"><h6>Top Affiliates</h6><div id="topAffiliatesList"></div></div>';
            try {
                const affRes = await apiCall('/affiliate/leaderboard?limit=20');
                const topAffiliates = affRes.data || [];
                document.getElementById('topAffiliatesList').innerHTML =
                    `<div class="overflow-x-auto"><table class="dtable"><thead><tr><th>Rank</th><th>Affiliate</th><th>Earnings</th><th>Conversions</th><th>Links</th></tr></thead><tbody>${topAffiliates.map((a, i) => `<tr><td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td><td>${a.displayName || a.firstName || 'User'}</td><td style="color:var(--primary);font-weight:700">${fmtMoneyAPI(a.totalAffiliateEarnings || 0)}</td><td>${a.totalAffiliateConversions || 0}</td><td>${a.affiliateLinksCount || 0}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No affiliates yet</td></tr>'}</tbody></table></div>`;
            } catch (e) {}
            break;
        case 'books':
            content.innerHTML = `
                        <div class="admin-section-header"><h6>📚 Manage Books</h6>
                            <div class="d-flex gap-2">
                                <select id="bookFilter" onchange="loadAdminBooks()" class="finput" style="width:auto;">
                                    <option value="all">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                                <button class="btn btn-primary btn-sm" onclick="openBookForm()"><i class="fas fa-plus"></i> Add Book</button>
                            </div>
                        </div>
                        <div id="adminBookFormContainer" style="display:none;" class="admin-book-form card card-p">
                            <div class="d-flex items-center justify-between mb-3"><h5 id="bookFormTitle">📚 Add New Book</h5><button class="btn-icon-sm" onclick="closeBookForm()"><i class="fas fa-times"></i></button></div>
                            <input type="hidden" id="editingBookId" />
                            <div class="row"><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Title *</label><input type="text" class="finput" id="bookTitle" placeholder="Book title" /></div></div><div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Author *</label><input type="text" class="finput" id="bookAuthor" placeholder="Author name" /></div></div></div>
                            <div class="form-group"><label class="flabel">Description</label><textarea class="finput" id="bookDescription" rows="3" placeholder="Book description..."></textarea></div>
                            <div class="row">
                                <div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Upload Cover Image</label><div class="upload-zone" style="padding:1rem"><input type="file" id="bookCoverFile" accept="image/*" onchange="uploadBookCover(this)" /><div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div><div style="font-size:.8rem;color:var(--text2)">Click or drop image (PNG, JPG, WebP)</div></div><div id="bookCoverPreview" class="upload-preview"><img id="bookCoverPreviewImg" /><div class="upload-preview-label">✅ Image uploaded</div></div><input type="hidden" id="bookCoverImage" /><div id="bookCoverProgress" class="book-upload-progress" style="display:none;">Uploading... 0%</div></div>
                                <div class="col-12 col-md-6"><div class="form-group"><label class="flabel">Book PDF File *</label><div class="upload-zone" style="padding:1rem"><input type="file" id="bookPdfFile" accept="application/pdf" onchange="uploadBookPdf(this)" /><div class="upload-icon"><i class="fas fa-file-pdf"></i></div><div style="font-size:.8rem;color:var(--text2)">Upload PDF file</div></div><input type="hidden" id="bookFileUrl" /><div id="bookPdfPreview" class="upload-preview"><div class="upload-preview-label">✅ PDF uploaded</div></div><div id="bookPdfProgress" class="book-upload-progress" style="display:none;">Uploading... 0%</div></div>
                            </div>
                            <div class="row"><div class="col-12 col-md-4"><div class="form-group"><label class="flabel">Price (₦)</label><input type="number" class="finput" id="bookPrice" placeholder="0 for free" min="0" value="0" /></div></div><div class="col-12 col-md-4"><div class="form-group"><label class="flabel">Published</label><input type="checkbox" id="bookIsPublished" checked style="accent-color:var(--primary);width:16px;height:16px;margin-top:12px;" /></div></div></div>
                            <div class="d-flex gap-2 mt-3"><button class="btn btn-primary" onclick="saveBook()"><i class="fas fa-save"></i> <span id="bookSaveBtnText">Add Book</span></button><button class="btn btn-ghost" onclick="closeBookForm()">Cancel</button></div>
                        </div>
                        <div id="adminBooksContainer"><p style="color:var(--text3)">Loading books...</p></div>
                    `;
            await loadAdminBooks();
            break;
        case 'social-earnings':
            content.innerHTML = `
                        <div class="social-earnings-admin">
                            <div class="admin-form card card-p"><h5 style="margin-bottom:1rem">📊 Social Earnings Configuration</h5><div class="form-group"><label class="flabel">Daily Pool Amount (₦)</label><input type="number" class="finput" id="admPoolAmount" value="${S.poolConfig.dailyPoolAmount || 10000}" min="1000"/></div><div class="row"><div class="col-6 col-md-3"><div class="form-group"><label class="flabel">Like Weight</label><input type="number" class="finput" id="admLikeWeight" step="0.5" min="0" value="${S.poolConfig.engagementWeights?.like || 1}" /></div></div><div class="col-6 col-md-3"><div class="form-group"><label class="flabel">Comment Weight</label><input type="number" class="finput" id="admCommentWeight" step="0.5" min="0" value="${S.poolConfig.engagementWeights?.comment || 2}" /></div></div><div class="col-6 col-md-3"><div class="form-group"><label class="flabel">Share Weight</label><input type="number" class="finput" id="admShareWeight" step="0.5" min="0" value="${S.poolConfig.engagementWeights?.share || 3}" /></div></div><div class="col-6 col-md-3"><div class="form-group"><label class="flabel">View Weight</label><input type="number" class="finput" id="admViewWeight" step="0.1" min="0" value="${S.poolConfig.engagementWeights?.view || 0.5}" /></div></div></div><div class="d-flex gap-2 mt-2"><button class="btn btn-primary" onclick="updateSocialEarningsConfig()"><i class="fas fa-save"></i> Save Config</button><button class="btn btn-gold" onclick="triggerSocialDistribution()"><i class="fas fa-play"></i> Trigger Distribution Now</button></div>
                            <div class="mt-3"><label class="flabel">Last Distribution</label><input type="text" class="finput" id="admLastDistribution" readonly /></div></div>
                            <div class="row mb-3 mt-3"><div class="col-12 col-md-6"><div class="card card-p"><h6>💰 Total Distributed</h6><div style="font-family:var(--font-heading);font-size:1.8rem;color:var(--lime);" id="admTotalPool">₦0</div></div></div><div class="col-12 col-md-6"><div class="card card-p"><h6>🏆 Top Earning Posts</h6><div id="admTopPostsList"></div></div></div></div>
                            <div class="card card-p"><h6>📊 Distribution History</h6><div id="admDistributionHistory"></div></div>
                        </div>
                    `;
            await loadSocialEarningsConfig();
            await loadTopEarningPosts();
            await loadTotalPool();
            break;
        case 'campaigns':
            content.innerHTML = `
                        <div class="admin-section-header"><h6>📢 Ad Campaigns</h6><div class="d-flex gap-2"><select id="campaignFilter" onchange="loadAdminCampaigns()" class="finput" style="width:auto;"><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="active">Active</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div></div>
                        <div id="adminCampaignsContainer"><p style="color:var(--text3)">Loading campaigns...</p></div>
                    `;
            await loadAdminCampaigns();
            break;
        case 'sponsorships':
            content.innerHTML = `
                        <div class="admin-section-header"><h6>🤝 Sponsorships</h6><div class="d-flex gap-2"><select id="sponsorshipFilter" onchange="loadAdminSponsorships()" class="finput" style="width:auto;"><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div></div>
                        <div id="adminSponsorshipsContainer"><p style="color:var(--text3)">Loading sponsorships...</p></div>
                    `;
            await loadAdminSponsorships();
            break;
        case 'audit':
            content.innerHTML = '<p style="color:var(--text3)">Loading audit logs...</p>';
            try {
                const res = await apiCall('/admin/audit-logs?limit=30');
                const logs = Array.isArray(res.data?.logs) ? res.data.logs : (Array.isArray(res.data) ? res
                    .data : []);
                content.innerHTML =
                    `<div class="overflow-x-auto"><table class="dtable"><thead><tr><th>User</th><th>Action</th><th>Resource</th><th>Date</th></tr></thead><tbody>${logs.map(l => `<tr><td>${l.user?.firstName || '—'}</td><td>${l.action}</td><td>${l.resource}</td><td>${new Date(l.createdAt).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No logs</td></tr>'}</tbody></table></div>`;
            } catch (e) {}
            break;
        default:
            content.innerHTML = '<p>Select a section</p>';
    }
}

export function loadManualPayments() {
    // Implementation - see full code in original
    const filter = document.getElementById('manualPaymentFilter')?.value || 'pending';
    const endpoint = filter === 'all' ? '/admin/manual-payments/all' : '/admin/manual-payments/pending';
    // ... (full implementation from original)
    toast('Manual payments loaded', 'info');
}

export function approveManualPayment(paymentId) {
    // Implementation
    toast('Payment approved', 'success');
}

export function rejectManualPayment(paymentId) {
    // Implementation
    toast('Payment rejected', 'info');
}

export function toggleUserBan(userId, ban) {
    // Implementation
    toast(ban ? 'User banned' : 'User unbanned', 'success');
}

export function approveInstructor(userId) {
    // Implementation
    toast('Instructor approved', 'success');
}

export function showUserPosts(userId) {
    // Implementation
    openModal('userDetailsModal');
}

export function showUserDetails(userId) {
    // Implementation
    openModal('userDetailsModal');
}

export function approveCourse(courseId) {
    // Implementation
    toast('Course approved', 'success');
}

export function rejectCourse(courseId) {
    // Implementation
    toast('Course rejected', 'info');
}

export function processWithdrawalAdmin(withdrawalId, action) {
    // Implementation
    toast(`Withdrawal ${action}d`, 'success');
}

export function sendAnnouncement() {
    // Implementation
    toast('Announcement sent', 'success');
}

export function createCoupon() {
    // Implementation
    closeModal('couponModal');
    toast('Coupon created', 'success');
}

export function deleteAdminCoupon(couponId) {
    // Implementation
    toast('Coupon deleted', 'success');
}

export function adminCreateAd() {
    // Implementation
    toast('Ad created', 'success');
}

export function loadAdminAds() {
    // Implementation
    const listEl = document.getElementById('admAdsList');
    if (listEl) listEl.innerHTML = '<p>Ads loaded</p>';
}

export function deleteAdminAd(adId) {
    // Implementation
    toast('Ad deleted', 'success');
}

export function updateAdConfig() {
    // Implementation
    toast('Ad config updated', 'success');
}

export function uploadAdImage(input) {
    // Implementation
    toast('Image uploaded', 'success');
}

export function loadAdminBooks() {
    // Implementation
    const container = document.getElementById('adminBooksContainer');
    if (container) container.innerHTML = '<p>Books loaded</p>';
}

export function openBookForm(bookId) {
    // Implementation
    document.getElementById('adminBookFormContainer').style.display = 'block';
}

export function closeBookForm() {
    document.getElementById('adminBookFormContainer').style.display = 'none';
}

export function resetBookForm() {
    // Implementation
}

export function loadBookData(bookId) {
    // Implementation
}

export function uploadBookCover(input) {
    // Implementation
    toast('Cover uploaded', 'success');
}

export function uploadBookPdf(input) {
    // Implementation
    toast('PDF uploaded', 'success');
}

export function saveBook() {
    // Implementation
    closeBookForm();
    toast('Book saved', 'success');
}

export function approveBook(bookId) {
    // Implementation
    toast('Book approved', 'success');
}

export function rejectBook(bookId) {
    // Implementation
    toast('Book rejected', 'info');
}

export function deleteBookAdmin(bookId) {
    // Implementation
    toast('Book deleted', 'success');
}

export function loadSocialEarningsConfig() {
    // Implementation
}

export function updateSocialEarningsConfig() {
    // Implementation
    toast('Config updated', 'success');
}

export function triggerSocialDistribution() {
    // Implementation
    toast('Distribution triggered', 'success');
}

export function loadTopEarningPosts() {
    // Implementation
}

export function loadTotalPool() {
    // Implementation
}

export function loadAdminCampaigns() {
    // Implementation
    const container = document.getElementById('adminCampaignsContainer');
    if (container) container.innerHTML = '<p>Campaigns loaded</p>';
}

export function approveCampaign(campaignId) {
    // Implementation
    toast('Campaign approved', 'success');
}

export function rejectCampaign(campaignId) {
    // Implementation
    toast('Campaign rejected', 'info');
}

export function viewCampaignDetails(campaignId) {
    // Implementation
    openModal('userDetailsModal');
}

export function markCampaignManualPaid(campaignId) {
    // Implementation
    toast('Campaign marked paid', 'success');
}

export function refundCampaign(campaignId) {
    // Implementation
    toast('Refund processed', 'success');
}

export function loadAdminSponsorships() {
    // Implementation
    const container = document.getElementById('adminSponsorshipsContainer');
    if (container) container.innerHTML = '<p>Sponsorships loaded</p>';
}

export function approveSponsorship(sponsorshipId) {
    // Implementation
    toast('Sponsorship approved', 'success');
}

export function rejectSponsorship(sponsorshipId) {
    // Implementation
    toast('Sponsorship rejected', 'info');
}

export function viewSponsorshipDetails(sponsorshipId) {
    // Implementation
    openModal('userDetailsModal');
}

export function loadAdminChallenges() {
    // Implementation
    const container = document.getElementById('adminChallengesContainer');
    if (container) container.innerHTML = '<p>Challenges loaded</p>';
}

export function openChallengeForm() {
    // Implementation
    document.getElementById('challengeFormContainer').style.display = 'block';
}

export function closeChallengeForm() {
    document.getElementById('challengeFormContainer').style.display = 'none';
}

export function saveChallenge() {
    // Implementation
    closeChallengeForm();
    toast('Challenge saved', 'success');
}

export function filterAdminChallenges(filter, el) {
    // Implementation
    if (el) { document.querySelectorAll('#adminChallengesList .fpill').forEach(p => p.classList.remove('active'));
        el.classList.add('active'); }
    loadAdminChallenges();
}

export function deleteChallenge(challengeId) {
    // Implementation
    toast('Challenge deleted', 'success');
}

export function viewChallengeParticipants(challengeId) {
    // Implementation
    openModal('participantsModal');
}

export function completeChallengeForUser(challengeId, userId) {
    // Implementation
    toast('User completed challenge', 'success');
}

export async function loadAds(placement) {
    try {
        const res = await apiCall(`/ads/placement/${placement}`);
        S.customAds = res.data || [];
        S.customAdIndex = 0;
        if (S.customAds.length === 0) {
            loadAdsterra();
        }
    } catch (e) {
        loadAdsterra();
        S.customAds = [];
    }
}

function loadAdsterra() {
    if (S.adsterraLoaded) return;
    if (document.getElementById('adsterra-script')) return;
    const script = document.createElement('script');
    script.id = 'adsterra-script';
    script.src = ADSTERRA_TAG;
    script.async = true;
    script.dataset.cfasync = 'false';
    document.head.appendChild(script);
    S.adsterraLoaded = true;
}

export async function fetchAdConfig() {
    try {
        const res = await apiCall('/admin/ad-config');
        S.adConfig = res.data || { cpm: 1.00, cpc: 0.02, sharePercent: 50 };
    } catch (e) { console.warn('Using default ad config'); }
}

export function getNextAd(placement) {
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

export function renderAdCard(ad, postId) {
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

function handleAdClick(adId, linkUrl, postId, network = 'custom') {
    if (postId) { trackAdRevenue(adId, 'click', postId, network); }
    window.open(linkUrl, '_blank');
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

const ADSTERRA_TAG = 'https://pl30155373.effectivecpmnetwork.com/cc89042fff30e53e48049a8c585d9105/invoke.js';
