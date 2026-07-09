import { S } from './state.js';
import { apiCall, toast, showLoading, hideLoading, escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui.js';

export async function renderCerts() {
    try {
        const enrollmentsData = await apiCall('/courses/my/enrollments');
        const enrollments = enrollmentsData.data || [];
        const completed = enrollments.filter(e => e.status === 'completed' || e.progress === 100);
        if (!completed.length) {
            document.getElementById('certsGrid').innerHTML =
                `<div class="empty-state"><i class="fas fa-certificate"></i><h4>No certificates yet</h4><p>Complete courses to earn certificates!</p><button class="btn btn-primary" onclick="setDP('explore')">Browse Courses</button></div>`;
            return;
        }
        const certsHtml = await Promise.all(completed.map(async (e) => {
            const courseId = e.courseId?._id || e.courseId;
            const courseTitle = e.courseId?.title || 'Course';
            const completedDate = e.completedAt ? new Date(e.completedAt).toLocaleDateString() :
                'Recently';
            let certAvailable = true;
            try {
                const check = await checkCertificateAvailability(courseId);
                certAvailable = check.available;
            } catch (err) { console.warn('Cert check failed:', err); }
            return `
                            <div class="col-12 col-md-6 col-lg-4">
                                <div class="cert-card">
                                    <div class="cert-icon">🎓</div>
                                    <h4>${escapeHtml(courseTitle)}</h4>
                                    <p class="cert-date">Completed: ${completedDate}</p>
                                    <p class="cert-student">${escapeHtml(S.user?.firstName || '')} ${escapeHtml(S.user?.lastName || '')}</p>
                                    <button class="btn btn-gold btn-sm" onclick="downloadCert('${courseId}')" ${!certAvailable ? 'disabled' : ''}>
                                        <i class="fas fa-download"></i> Download Certificate
                                    </button>
                                    ${!certAvailable ? '<small class="cert-warning">Complete all lessons first</small>' : ''}
                                </div>
                            </div>`;
        }));
        document.getElementById('certsGrid').innerHTML = certsHtml.join('');
    } catch (err) {
        console.error('Render certs error:', err);
        document.getElementById('certsGrid').innerHTML =
            `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Unable to load certificates</h4><p>${err.message}</p></div>`;
    }
}

async function checkCertificateAvailability(courseId) {
    try {
        const token = localStorage.getItem('cx_accessToken');
        const response = await fetch(`${API_BASE}/certificates/check/${courseId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.data || { available: false, message: 'Unable to check' };
    } catch (err) { return { available: false, message: 'Unable to check' }; }
}

export async function downloadCert(courseId) {
    if (!courseId) { toast('Invalid course', 'error'); return; }
    const token = localStorage.getItem('cx_accessToken');
    if (!token) { toast('Please log in', 'error');
        goPage('login'); return; }
    showLoading('Generating certificate...');
    try {
        const response = await fetch(`${API_BASE}/courses/${courseId}/certificate/download`, { method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!response.ok) { let errorMsg = `HTTP ${response.status}`; try { const errorData = await response
                    .json();
                errorMsg = errorData.message || errorMsg; } catch (e) {} throw new Error(errorMsg); }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificate_Course_${courseId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast('Certificate downloaded! 🎓', 'success');
    } catch (err) { toast(err.message || 'Failed to generate certificate.', 'error'); } finally { hideLoading(); }
}

export function openCertUploadModal(courseId) { document.getElementById('certCourseName').value = courseId;
    openModal('certUploadModal'); }

export function handleCertTemplateFile(input) { S.certTemplateFile = input.files[0]; if (S.certTemplateFile) toast(
        'Template selected', 'success'); }

export async function uploadCertificateTemplate() {
    if (!S.certTemplateFile) { toast('Select a file first', 'error'); return; }
    const courseId = S.currentCourseData?._id;
    if (!courseId) { toast('Save draft first', 'warning'); return; }
    showLoading('Uploading template...');
    const formData = new FormData();
    formData.append('template', S.certTemplateFile);
    const token = localStorage.getItem('cx_accessToken');
    try {
        const res = await fetch(`${API_BASE}/instructor/courses/${courseId}/certificate-template`, { method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }, body: formData, credentials: 'include' });
        const data = await res.json();
        if (data.success) { toast('Certificate template uploaded! ✅', 'success');
            S.currentCourseData.certificateTemplate = data.data.url;
            closeModal('certUploadModal'); } else throw new Error(data.message);
    } catch (e) { toast('Upload failed: ' + e.message, 'error'); } finally { hideLoading();
        S.certTemplateFile = null; }
}

const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';

// Expose
window.renderCerts = renderCerts;
window.downloadCert = downloadCert;
window.openCertUploadModal = openCertUploadModal;
window.handleCertTemplateFile = handleCertTemplateFile;
window.uploadCertificateTemplate = uploadCertificateTemplate;
