import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, showLoading, hideLoading, escapeHtml } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal } from './ui.js';

export function renderInstHub() {
    const hasCreatorAccess = S.isPremium || S.user?.roles?.includes('admin') || (S.user?.roles?.includes('creator') &&
        S.user?.isApprovedInstructor);
    if (!hasCreatorAccess) {
        document.getElementById('instPremiumGate').style.display = 'block';
        document.getElementById('instPremiumGate').innerHTML =
            `<div class="premium-gate-overlay"><h4>🔒 Premium Required</h4><p style="color:var(--text3)">Upgrade to Premium or get approved as an instructor to create & sell courses.</p><button class="btn btn-primary" onclick="openModal('premiumModal')">Upgrade — ₦5,000/mo</button></div>`;
        document.getElementById('instContent').style.display = 'none';
    } else {
        document.getElementById('instPremiumGate').style.display = 'none';
        document.getElementById('instContent').style.display = 'block';
        loadInstructorData();
    }
}

export async function loadInstructorData() {
    try {
        const data = await apiCall('/instructor/dashboard');
        const stats = data.data || {};
        S.instructorCourses = Array.isArray(stats.courses) ? stats.courses : [];

        const avgRating = stats.averageRating || 0;
        const ratingStars = '★'.repeat(Math.floor(avgRating)) + '☆'.repeat(5 - Math.floor(avgRating));
        document.getElementById('instStatsRow').innerHTML = `
                    <div class="col-6 col-md-3"><div class="stat-card"><div class="si si-primary"><i class="fas fa-book"></i></div><div class="sv">${stats.totalCourses || S.instructorCourses.length || 0}</div><div class="sl">Courses</div></div></div>
                    <div class="col-6 col-md-3"><div class="stat-card"><div class="si si-c"><i class="fas fa-users"></i></div><div class="sv">${stats.totalStudents || 0}</div><div class="sl">Students</div></div></div>
                    <div class="col-6 col-md-3"><div class="stat-card"><div class="si si-g"><i class="fas fa-wallet"></i></div><div class="sv">${fmtMoneyAPI(stats.totalRevenue || 0)}</div><div class="sl">Revenue</div></div></div>
                    <div class="col-6 col-md-3"><div class="stat-card"><div class="si si-v"><i class="fas fa-star"></i></div><div class="sv">${avgRating.toFixed(1)} ${ratingStars}</div><div class="sl">Avg Rating</div></div></div>
                `;

        if (stats.pendingQuestions > 0) {
            document.getElementById('instQANotifs').style.display = 'block';
            document.getElementById('instQAList').innerHTML = `
                            <div class="d-flex items-center gap-2">
                                <span class="badge badge-danger">${stats.pendingQuestions}</span>
                                <span>Pending questions from students</span>
                                <button class="btn btn-ghost btn-sm" onclick="setDP('lesson');setTimeout(()=>import('./courses.js').then(({switchLTab})=>switchLTab('qa',null)),100)">View Questions</button>
                            </div>
                        `;
        } else {
            document.getElementById('instQANotifs').style.display = 'none';
        }

        const coursesWithRating = S.instructorCourses.map(c => {
            const avgRating = c.avgRating || 0;
            const stars = '★'.repeat(Math.floor(avgRating)) + '☆'.repeat(5 - Math.floor(avgRating));
            return { ...c, avgRating, stars };
        });

        document.getElementById('instCoursesTable').innerHTML = `
                    <thead><tr><th>Course</th><th>Status</th><th>Students</th><th>Rating</th><th>Revenue</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${coursesWithRating.map(c => {
                            const statusLabel = c.isApproved ? 'Live' : c.pendingApproval ? 'Pending' : 'Draft';
                            const statusClass = c.isApproved ? 'ps-paid' : c.pendingApproval ? 'ps-pend' : 'ps-fail';
                            return `
                                <tr>
                                    <td><div style="display:flex;align-items:center;gap:.5rem"><span>📚</span><span>${c.title || 'Course'}</span></div></td>
                                    <td><span class="pstatus ${statusClass}">${statusLabel}</span></td>
                                    <td>${c.totalStudents || 0}</td>
                                    <td style="color:var(--gold)">${c.stars} ${c.avgRating.toFixed(1)}</td>
                                    <td style="font-weight:700;color:var(--primary)">${fmtMoneyAPI(c.instructorEarnings || c.totalRevenue || 0)}</td>
                                    <td>
                                        <button class="btn btn-ghost btn-sm" onclick="editExistingCourse('${c._id}')"><i class="fas fa-edit"></i></button>
                                        ${!c.isApproved && !c.pendingApproval ? `<button class="btn btn-primary btn-sm" onclick="submitExistingCourse('${c._id}')"><i class="fas fa-paper-plane"></i></button>` : ''}
                                        <button class="btn btn-danger btn-sm" onclick="deleteCourse('${c._id}')"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="6" style="text-align:center">No courses yet</td></tr>'}
                    </tbody>
                `;

        await loadInstructorSales();
        loadAnalyticsDropdown();
        loadCohorts();
        loadSplits();
    } catch (e) { toast('Could not load instructor data: ' + e.message, 'error'); }
}

function loadAnalyticsDropdown() {
    const select = document.getElementById('analyticsCourseSelect');
    if (!select) return;
    const courses = S.instructorCourses || [];
    select.innerHTML = `<option value="">Select a course</option>${courses.map(c => `<option value="${c._id}">${c.title || 'Course'}</option>`).join('')}`;
}

export async function loadInstructorSales() {
    const el = document.getElementById('instSalesContent');
    if (!el) return;
    try {
        const data = await apiCall('/instructor/dashboard');
        const stats = data.data || {};
        const courses = Array.isArray(stats.courses) ? stats.courses : [];
        let totalSales = 0;
        courses.forEach(c => { totalSales += c.totalRevenue || 0; });
        el.innerHTML = `
                    <div class="row mb-3">
                        <div class="col-6 col-md-4"><div class="stat-card"><div class="sv">${fmtMoneyAPI(totalSales)}</div><div class="sl">Total Revenue</div></div></div>
                        <div class="col-6 col-md-4"><div class="stat-card"><div class="sv">${fmtMoneyAPI(totalSales * 0.8)}</div><div class="sl">Your Share (80%)</div></div></div>
                        <div class="col-6 col-md-4"><div class="stat-card"><div class="sv">${fmtMoneyAPI(totalSales * 0.7)}</div><div class="sl">Net (70%)</div></div></div>
                    </div>
                    <div class="overflow-x-auto"><table class="dtable"><thead><tr><th>Course</th><th>Price</th><th>Students</th><th>Your Cut (70%)</th></tr></thead><tbody>${courses.map(c => `<tr><td>${c.title || 'Course'}</td><td>${fmtMoneyAPI(c.price || 0)}</td><td>${c.totalStudents || 0}</td><td style="color:var(--primary);font-weight:700">${fmtMoneyAPI(Math.round((c.price || 0) * 0.7 * (c.totalStudents || 0)))}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No sales data</td></tr>'}</tbody></table></div>
                `;
        document.getElementById('instEarningsContent').innerHTML = `
                    <div class="web-row"><span>Platform Fee (20%)</span><span>${fmtMoneyAPI(totalSales * 0.2)}</span></div>
                    <div class="web-row"><span>Your Share (80%)</span><span style="color:var(--primary);font-weight:700">${fmtMoneyAPI(totalSales * 0.8)}</span></div>
                    <div class="web-row"><span style="font-weight:700">Net to You (70%)</span><span style="color:var(--primary);font-weight:800">${fmtMoneyAPI(totalSales * 0.7)}</span></div>
                `;
    } catch (e) { el.innerHTML = '<div class="empty-state"><p>Loading sales data...</p></div>'; }
}

export function switchInstTab(tab, btn) {
    document.querySelectorAll('#dash-instructor .tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('inst-tab-courses').style.display = tab === 'courses' ? 'block' : 'none';
    document.getElementById('inst-tab-sales').style.display = tab === 'sales' ? 'block' : 'none';
    document.getElementById('inst-tab-earnings').style.display = tab === 'earnings' ? 'block' : 'none';
    document.getElementById('inst-tab-analytics').style.display = tab === 'analytics' ? 'block' : 'none';
    document.getElementById('inst-tab-cohorts').style.display = tab === 'cohorts' ? 'block' : 'none';
    document.getElementById('inst-tab-revenue-splits').style.display = tab === 'revenue-splits' ? 'block' : 'none';
    S.instTab = tab;
    if (tab === 'sales') loadInstructorSales();
    if (tab === 'analytics') loadAnalyticsDropdown();
    if (tab === 'cohorts') loadCohorts();
    if (tab === 'revenue-splits') loadSplits();
}

// ─── ANALYTICS ──────────────────────────────────────────────────────────

export async function loadAnalytics(courseId) {
    if (!courseId) { document.getElementById('analyticsContent').innerHTML =
            '<div class="empty-state"><i class="fas fa-chart-line"></i><p>Select a course.</p></div>'; return; }
    showLoading('Loading analytics...');
    try {
        const res = await apiCall(`/analytics/courses/${courseId}`);
        const data = res.data;
        document.getElementById('analyticsContent').innerHTML = `
                    <div class="row">
                        <div class="col-6 col-md-3"><div class="stat-card"><div class="sv">${data.totalEnrollments}</div><div class="sl">Enrollments</div></div></div>
                        <div class="col-6 col-md-3"><div class="stat-card"><div class="sv">${data.completed}</div><div class="sl">Completed</div></div></div>
                        <div class="col-6 col-md-3"><div class="stat-card"><div class="sv">${data.completionRate.toFixed(1)}%</div><div class="sl">Completion Rate</div></div></div>
                        <div class="col-6 col-md-3"><div class="stat-card"><div class="sv">${fmtMoneyAPI(data.totalRevenue)}</div><div class="sl">Revenue</div></div></div>
                        <div class="col-12"><div class="stat-card"><div class="sv">${data.averageProgress.toFixed(1)}%</div><div class="sl">Average Progress</div></div></div>
                    </div>
                    <div style="margin-top:1rem;">
                        <h6>Funnel (Lesson Completion)</h6>
                        <div id="funnelChart"></div>
                    </div>
                `;
        const funnelRes = await apiCall(`/analytics/funnel/${courseId}`);
        const funnel = funnelRes.data || [];
        if (funnel.length) {
            let chartHtml = '<div class="analytics-funnel">';
            funnel.forEach(f => {
                const pct = Math.max(4, f.percentage || 0);
                chartHtml += `
                                <div class="funnel-bar" style="height:${pct}%;">
                                    <span class="funnel-value">${f.percentage.toFixed(0)}%</span>
                                    <span class="funnel-label">${f.lessonTitle || 'Lesson'}</span>
                                </div>`;
            });
            chartHtml += '</div>';
            document.getElementById('funnelChart').innerHTML = chartHtml;
        } else {
            document.getElementById('funnelChart').innerHTML = '<p style="color:var(--text3);font-size:.8rem;">No lesson data.</p>';
        }
    } catch (err) { toast('Failed to load analytics: ' + err.message, 'error'); } finally { hideLoading(); }
}

// ─── COHORTS ────────────────────────────────────────────────────────────

const COHORTS_API = '/cohorts';

export async function loadCohorts() {
    try {
        const res = await apiCall(COHORTS_API);
        S.cohorts = res.data || [];
        renderCohorts();
    } catch (err) { toast('Failed to load cohorts: ' + err.message, 'error'); }
}

function renderCohorts() {
    const container = document.getElementById('cohortList');
    if (!container) return;
    if (!S.cohorts || !S.cohorts.length) {
        container.innerHTML = '<div class="empty-state"><p>No cohorts created.</p></div>';
        return;
    }
    container.innerHTML = S.cohorts.map(c => `
                <div class="cohort-card">
                    <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                        <div>
                            <strong>${escapeHtml(c.name)}</strong>
                            <span class="badge badge-cyan">${c.courseId?.title || 'Course'}</span>
                            <div class="cohort-meta">
                                <span>📅 ${new Date(c.startDate).toLocaleDateString()} → ${new Date(c.endDate).toLocaleDateString()}</span>
                                <span>👥 ${c.capacity || '∞'} capacity</span>
                                <span>👤 ${c.students?.length || 0} enrolled</span>
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-ghost btn-sm" onclick="viewCohort('${c._id}')"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-ghost btn-sm" onclick="editCohort('${c._id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCohort('${c._id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
}

export function openCohortForm() {
    toast('Cohort form coming soon!', 'info');
}

async function viewCohort(id) {
    try {
        const res = await apiCall(`${COHORTS_API}/${id}`);
        const cohort = res.data;
        const students = cohort.students || [];
        const content = document.getElementById('userDetailsContent');
        if (content) {
            content.innerHTML = `
                        <h5>${escapeHtml(cohort.name)}</h5>
                        <p><strong>Course:</strong> ${cohort.courseId?.title || 'N/A'}</p>
                        <p><strong>Dates:</strong> ${new Date(cohort.startDate).toLocaleDateString()} → ${new Date(cohort.endDate).toLocaleDateString()}</p>
                        <p><strong>Students (${students.length}):</strong></p>
                        ${students.length ? students.map(s => `<div style="padding:.3rem 0;border-bottom:1px solid var(--border);">${escapeHtml(s.userId?.firstName || 'User')} ${escapeHtml(s.userId?.lastName || '')}</div>`).join('') : '<p style="color:var(--text3);">No students enrolled.</p>'}
                    `;
            document.querySelector('#userDetailsModal .modal-hd h5').textContent = '👥 Cohort Details';
            openModal('userDetailsModal');
        }
    } catch (err) { toast(err.message, 'error'); }
}

async function deleteCohort(id) {
    if (!confirm('Delete this cohort?')) return;
    try { await apiCall(`${COHORTS_API}/${id}`, { method: 'DELETE' });
        toast('Cohort deleted', 'success');
        loadCohorts(); } catch (err) { toast(err.message, 'error'); }
}

function editCohort(id) { toast('Edit cohort coming soon!', 'info'); }

// ─── REVENUE SPLITS ─────────────────────────────────────────────────────

const SPLITS_API = '/splits';

export async function loadSplits() {
    try {
        const res = await apiCall(SPLITS_API);
        S.splits = res.data || [];
        renderSplits();
        populateSplitDropdowns();
    } catch (err) { toast('Failed to load splits: ' + err.message, 'error'); }
}

function renderSplits() {
    const container = document.getElementById('splitsList');
    if (!container) return;
    if (!S.splits || !S.splits.length) {
        container.innerHTML = '<div class="empty-state"><p>No revenue splits defined.</p></div>';
        return;
    }
    container.innerHTML = S.splits.map(s => `
                <div class="split-card">
                    <div class="split-info">
                        <strong>${s.courseId?.title || 'Course'}</strong>
                        <span class="badge badge-cyan">${s.instructorId?.firstName || 'Instructor'} ${s.instructorId?.lastName || ''}</span>
                        <span style="font-weight:800;color:var(--primary);">${s.percentage}%</span>
                    </div>
                    <div>
                        <button class="btn btn-ghost btn-sm" onclick="editSplit('${s._id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSplit('${s._id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
}

function populateSplitDropdowns() {
    const courseSelect = document.getElementById('splitCourse');
    const instructorSelect = document.getElementById('splitInstructor');
    if (courseSelect) {
        const courses = S.instructorCourses || [];
        courseSelect.innerHTML = `<option value="">Select Course</option>${courses.map(c => `<option value="${c._id}">${c.title || 'Course'}</option>`).join('')}`;
    }
    if (instructorSelect) {
        const users = S.users || [];
        instructorSelect.innerHTML =
            `<option value="">Select Instructor</option>${users.filter(u => u._id !== S.user?._id).map(u => `<option value="${u._id}">${u.firstName || 'User'} ${u.lastName || ''}</option>`).join('')}`;
    }
}

export async function createSplit() {
    const courseId = document.getElementById('splitCourse')?.value;
    const instructorId = document.getElementById('splitInstructor')?.value;
    const percent = parseFloat(document.getElementById('splitPercent')?.value);
    if (!courseId || !instructorId || !percent) { toast('Fill all fields', 'error'); return; }
    try {
        await apiCall(SPLITS_API, { method: 'POST', body: { courseId, instructorId, percentage: percent } });
        toast('Split created!', 'success');
        loadSplits();
    } catch (err) { toast(err.message, 'error'); }
}

async function deleteSplit(id) {
    if (!confirm('Delete this split?')) return;
    try { await apiCall(`${SPLITS_API}/${id}`, { method: 'DELETE' });
        toast('Split deleted', 'success');
        loadSplits(); } catch (err) { toast(err.message, 'error'); }
}

function editSplit(id) { toast('Edit split coming soon!', 'info'); }

// ─── EXPOSE ─────────────────────────────────────────────────────────────

window.renderInstHub = renderInstHub;
window.loadInstructorData = loadInstructorData;
window.switchInstTab = switchInstTab;
window.loadAnalytics = loadAnalytics;
window.openCohortForm = openCohortForm;
window.createSplit = createSplit;
window.initNewCourse = () => import('./course-editor.js').then(({ initNewCourse }) => initNewCourse());
window.editExistingCourse = (id) => import('./course-editor.js').then(({ editExistingCourse }) => editExistingCourse(id));
window.submitExistingCourse = (id) => import('./course-editor.js').then(({ submitExistingCourse }) =>
    submitExistingCourse(id));
window.deleteCourse = (id) => import('./course-editor.js').then(({ deleteCourse }) => deleteCourse(id));
