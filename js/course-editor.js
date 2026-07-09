import { S } from './state.js';
import { apiCall, toast, showLoading, hideLoading, escapeHtml } from './utils.js';
import { setDP } from './dashboard.js';
import { openModal, closeModal } from './ui.js';

// ─── COURSE EDITOR ──────────────────────────────────────────────────────

export function initEditor() {
    if (!S.editorLessons.length) S.editorLessons = [];
    S.currentEditLesson = 0;
    if (!S.quizBuilderList.length) S.quizBuilderList = [];
    if (!S.outcomes.length) S.outcomes = [];
    if (!S.uploadedFiles.length) S.uploadedFiles = [];
    S.esStep = 1;
    goES(1);
    initQuillEditors();
    renderLessonBuilderList();
    startAutoSave();
    setTimeout(() => {
        if (S.currentCourseData?._id) { loadDraftFromLocalStorage(S.currentCourseData._id); } else {
            loadDraftFromLocalStorage('new'); }
    }, 500);
}

export function goES(n) {
    document.querySelectorAll('.esc-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.editor-step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('es-' + n)?.classList.add('active');
    document.getElementById('esp-' + n)?.classList.add('active');
    S.esStep = n;
    if (n === 2) renderLessonBuilderList();
    if (n === 3) renderLessonContentEditor();
    if (n === 5) renderQuizBuilder();
    if (n === 8) updateReviewSummary();
    initQuillEditors();
}

function initQuillEditors() {
    setTimeout(() => {
        const descEl = document.getElementById('descEditorQuill');
        if (descEl && !S.quillEditors['descEditorQuill'] && typeof Quill !== 'undefined') {
            const existingContent = S.currentCourseData?.description || '';
            S.quillEditors['descEditorQuill'] = new Quill('#descEditorQuill', { theme: 'snow',
                placeholder: 'Write a compelling description...', modules: { toolbar: [
                        ['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link', 'code-block'], ['clean']
                    ] } });
            if (existingContent && existingContent !== 'No description provided') { S.quillEditors[
                    'descEditorQuill'].root.innerHTML = existingContent; }
        }
    }, 300);
}

function startAutoSave() {
    if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
    window.autoSaveTimer = setInterval(() => {
        saveDraftToLocalStorage();
        if (S.currentCourseData?._id) { saveDraftToServer(true); }
    }, 30000);
}

// ─── DRAFT ──────────────────────────────────────────────────────────────

export function saveDraftToLocalStorage() {
    const draft = {
        title: document.getElementById('edTitle')?.value,
        subtitle: document.getElementById('edSubtitle')?.value,
        description: S.quillEditors['descEditorQuill']?.root.innerHTML,
        category: document.getElementById('edCategory')?.value,
        level: document.getElementById('edLevel')?.value,
        price: document.getElementById('edPrice')?.value,
        thumbnail: document.getElementById('edEmoji')?.value,
        lessons: S.editorLessons,
        quizzes: S.quizBuilderList,
        updatedAt: new Date().toISOString()
    };
    const key = `course_draft_${S.currentCourseData?._id || 'new'}`;
    localStorage.setItem(key, JSON.stringify(draft));
    const autoSaveEl = document.getElementById('edAutoSave');
    if (autoSaveEl) autoSaveEl.textContent = 'Draft · Saved locally';
}

export function loadDraftFromLocalStorage(courseId = 'new') {
    const key = `course_draft_${courseId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            if (confirm('You have an unsaved draft. Restore it?')) {
                document.getElementById('edTitle').value = draft.title || '';
                document.getElementById('edSubtitle').value = draft.subtitle || '';
                if (S.quillEditors['descEditorQuill']) S.quillEditors['descEditorQuill'].root.innerHTML = draft
                    .description || '';
                document.getElementById('edCategory').value = draft.category || 'Web Development';
                document.getElementById('edLevel').value = draft.level || 'Beginner';
                document.getElementById('edPrice').value = draft.price || '';
                document.getElementById('edEmoji').value = draft.thumbnail || '📚';
                S.editorLessons = draft.lessons || [];
                S.quizBuilderList = draft.quizzes || [];
                renderLessonBuilderList();
                renderQuizBuilder();
                toast('Draft restored from local storage', 'success');
            }
        } catch (e) { console.warn('Could not parse draft:', e);
            localStorage.removeItem(key); }
    }
}

export async function saveDraftToServer(silent = false) {
    const title = document.getElementById('edTitle')?.value.trim() || 'Untitled Course';
    const subtitle = document.getElementById('edSubtitle')?.value.trim() || '';
    let desc = S.quillEditors['descEditorQuill'] ? S.quillEditors['descEditorQuill'].root.innerHTML : '';
    if (!desc || desc === '<p><br></p>' || desc.trim() === '') desc = 'No description provided';
    const body = {
        title,
        subtitle,
        description: desc,
        category: document.getElementById('edCategory')?.value || 'Web Development',
        level: document.getElementById('edLevel')?.value || 'Beginner',
        language: document.getElementById('edLanguage')?.value || 'English',
        thumbnail: document.getElementById('edEmoji')?.value || '📚',
        promoVideo: document.getElementById('edPromoVideo')?.value || '',
        lessons: S.editorLessons,
        quizzes: S.quizBuilderList.map(q => ({ title: q.question, questions: [{ question: q.question,
                options: q.options, correctAnswer: q.correctIdx, points: 10 }],
            passingScore: 60 })),
        price: S.selectedPriceType === 'paid' ? Number(document.getElementById('edPrice')?.value) || 0 : 0,
        salePrice: S.selectedPriceType === 'paid' ? Number(document.getElementById('edSalePrice')?.value) ||
            0 : 0,
        hasAffiliate: document.getElementById('edAffEnabled')?.checked || false,
        affiliatePercent: Number(document.getElementById('edAffPercent')?.value) || 15,
        isPublished: false,
        isPremiumOnly: S.selectedPriceType === 'sub'
    };
    try {
        if (S.currentCourseData?._id) {
            await apiCall(`/instructor/courses/${S.currentCourseData._id}/draft`, { method: 'POST', body });
        } else {
            const res = await apiCall('/instructor/courses', { method: 'POST', body });
            S.currentCourseData = res.data;
        }
        if (!silent) toast('💾 Draft saved to server!', 'success');
        document.getElementById('edAutoSave').textContent = 'Draft · Saved';
        localStorage.removeItem(`course_draft_${S.currentCourseData?._id || 'new'}`);
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
}

// ─── LESSON BUILDER ────────────────────────────────────────────────────

export function confirmAddLesson() {
    const title = document.getElementById('newLessonTitle')?.value.trim();
    if (!title) { toast('Enter a lesson title', 'error'); return; }
    S.editorLessons.push({
        title,
        type: S.currentLessonType || 'video',
        duration: Number(document.getElementById('newLessonDur')?.value) || 10,
        contentSaved: false,
        content: '',
        notes: '',
        resources: [],
        videoUrl: '',
        order: S.editorLessons.length + 1,
        xpReward: 50
    });
    closeModal('addLessonModal');
    document.getElementById('newLessonTitle').value = '';
    document.getElementById('newLessonDur').value = '';
    toast('✅ Lesson added', 'success');
    renderLessonBuilderList();
}

export function renderLessonBuilderList() {
    const el = document.getElementById('lessonBuilderList');
    if (!el) return;
    const badge = document.getElementById('lessonCountBadge');
    const cnt = S.editorLessons.length;
    if (badge) badge.innerHTML = cnt >= 20 ?
        `<span class="badge badge-success"><i class="fas fa-check"></i>${cnt}/20 lessons ✅ Ready</span>` :
        `<span class="badge badge-gold"><i class="fas fa-exclamation-triangle"></i>${cnt}/20 lessons — need ${20 - cnt} more</span>`;
    if (!cnt) {
        el.innerHTML =
            '<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:.83rem;border:2px dashed var(--border);border-radius:var(--radius-sm)">No lessons yet. Add at least 20 to publish.</div>';
        return;
    }
    el.innerHTML = S.editorLessons.map((l, i) => {
        const typeIcon = l.type === 'video' ? 'play' : l.type === 'quiz' ? 'question-circle' : l.type ===
            'assignment' ? 'tasks' : 'file-alt';
        const typeClass = l.type === 'assignment' ? 'assign' : l.type;
        return `<div style="display:flex;align-items:center;gap:.6rem;padding:.55rem .7rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:.3rem"><span style="color:var(--text3);font-size:.8rem"><i class="fas fa-grip-vertical"></i></span><div class="lesson-type-badge lt-${typeClass}" style="width:24px;height:24px;font-size:.65rem"><i class="fas fa-${typeIcon}"></i></div><div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600">${i + 1}. ${l.title}</div><div style="font-size:.68rem;color:var(--text3)">${l.type} · ${l.duration || '—'} mins ${l.contentSaved ? '· <span style="color:var(--success)">✅ Content Saved</span>' : ''}</div></div><button class="btn-icon-sm" onclick="editLesson(${i})" title="Edit content"><i class="fas fa-edit"></i></button><button class="btn-icon-sm" onclick="removeEditorLesson(${i})" style="color:var(--danger)"><i class="fas fa-trash"></i></button></div>`;
    }).join('');
}

export function editLesson(i) { S.currentEditLesson = i;
    goES(3); }

export function removeEditorLesson(i) { S.editorLessons.splice(i, 1);
    S.editorLessons.forEach((l, idx) => l.order = idx + 1);
    renderLessonBuilderList(); }

export function selectLType(el) {
    document.querySelectorAll('.lesson-type-opt').forEach(o => { o.style.borderColor = 'var(--border)'; });
    el.style.borderColor = 'rgba(212,175,55,.4)';
    S.currentLessonType = el.dataset.type;
}

// ─── LESSON CONTENT EDITOR ─────────────────────────────────────────────

export function renderLessonContentEditor() {
    const el = document.getElementById('lessonContentEditor');
    if (!el) return;
    if (!S.editorLessons.length) {
        el.innerHTML =
            '<div style="text-align:center;padding:1.5rem;color:var(--text3)">Add lessons first in the Curriculum step.</div>';
        return;
    }
    const idx = S.currentEditLesson < S.editorLessons.length ? S.currentEditLesson : 0;
    const l = S.editorLessons[idx];
    if (!l) return;
    const editorId = 'lessonQuill_' + idx;
    const resources = Array.isArray(l.resources) ? l.resources : [];
    el.innerHTML =
        `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.4rem"><div><strong>Lesson ${idx + 1}: ${l.title}</strong><span class="badge badge-cyan" style="font-size:.6rem;margin-left:.4rem">${l.type}</span></div><div style="display:flex;gap:.4rem;align-items:center">${idx > 0 ? `<button class="btn btn-ghost btn-sm" onclick="S.currentEditLesson=${idx - 1};renderLessonContentEditor()" style="font-size:.74rem"><i class="fas fa-arrow-left"></i>Prev</button>` : ''}<span style="font-size:.74rem;color:var(--text3)">${idx + 1}/${S.editorLessons.length}</span>${idx < S.editorLessons.length - 1 ? `<button class="btn btn-ghost btn-sm" onclick="S.currentEditLesson=${idx + 1};renderLessonContentEditor()" style="font-size:.74rem">Next<i class="fas fa-arrow-right"></i></button>` : ''}</div></div></div><div class="form-group"><label class="flabel">Lesson Content (Rich Text) — Always Editable</label><div class="quill-wrapper"><div id="${editorId}" style="min-height:250px">${l.content || ''}</div></div></div><div class="form-group"><label class="flabel">Key Notes for Students</label><textarea class="finput" id="lessonNotesInput_${idx}" style="min-height:80px;resize:vertical" placeholder="Key takeaways...">${l.notes || ''}</textarea></div><div class="form-group"><label class="flabel">Video URL (YouTube, Vimeo, or direct MP4)</label><input type="url" class="finput" id="lessonVideoUrlInput" placeholder="https://www.youtube.com/embed/..." value="${l.videoUrl || ''}" /></div><div class="form-group"><label class="flabel">Upload Resources for this Lesson</label><div class="upload-zone" style="padding:1rem"><input type="file" multiple onchange="handleLessonResources(this,${idx})"/><div style="font-size:.8rem;color:var(--text2)"><i class="fas fa-upload" style="margin-right:.3rem"></i>Drop resource files here</div></div><div id="lessonResources_${idx}">${resources.map((r, ridx) => `<div style="display:flex;align-items:center;gap:.4rem;margin-top:.3rem;font-size:.75rem;color:var(--text3)">📎 ${r.title || r}<button class="btn-icon-sm" onclick="removeResource(${idx},${ridx})" style="color:var(--danger);font-size:.6rem;width:22px;height:22px"><i class="fas fa-times"></i></button></div>`).join('')}</div></div><div style="display:flex;gap:.5rem;margin-top:.75rem">${idx > 0 ? `<button class="btn btn-ghost flex-1" onclick="S.currentEditLesson=${idx - 1};renderLessonContentEditor()"><i class="fas fa-arrow-left"></i>Previous</button>` : '<div class="flex-1"></div>'}<button class="btn btn-primary flex-1" onclick="saveLessonContent(${idx})"><i class="fas fa-save"></i>Save &amp; Next</button></div>`;
    setTimeout(() => {
        if (!S.quillEditors[editorId] && typeof Quill !== 'undefined') {
            S.quillEditors[editorId] = new Quill('#' + editorId, { theme: 'snow',
                placeholder: 'Write your lesson content here...', modules: { toolbar: [
                        ['bold', 'italic', 'underline'], [{ 'header': [1, 2, 3, false] }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link', 'code-block',
                            'image'
                        ],
                        ['clean']
                    ] } });
            if (l.content) S.quillEditors[editorId].root.innerHTML = l.content;
        }
    }, 200);
}

export function removeResource(lessonIdx, resourceIdx) {
    if (S.editorLessons[lessonIdx] && Array.isArray(S.editorLessons[lessonIdx].resources)) {
        S.editorLessons[lessonIdx].resources.splice(resourceIdx, 1);
        renderLessonContentEditor();
        toast('Resource removed', 'info');
    }
}

export function saveLessonContent(idx) {
    const editorId = 'lessonQuill_' + idx;
    const quill = S.quillEditors[editorId];
    const notesEl = document.getElementById('lessonNotesInput_' + idx);
    const videoEl = document.getElementById('lessonVideoUrlInput');
    if (S.editorLessons[idx]) {
        S.editorLessons[idx].content = quill ? quill.root.innerHTML : '';
        S.editorLessons[idx].notes = notesEl?.value || '';
        S.editorLessons[idx].videoUrl = videoEl?.value || '';
        S.editorLessons[idx].contentSaved = true;
    }
    toast(`✅ Lesson ${idx + 1} content saved!`, 'success');
    const next = idx + 1;
    if (next < S.editorLessons.length) { S.currentEditLesson = next;
        renderLessonContentEditor(); } else { toast('🎉 All lessons saved!', 'success'); }
    renderLessonBuilderList();
}

export function handleLessonResources(input, idx) {
    const files = Array.from(input.files);
    if (!S.editorLessons[idx]) return;
    if (!Array.isArray(S.editorLessons[idx].resources)) S.editorLessons[idx].resources = [];
    files.forEach(f => S.editorLessons[idx].resources.push({ title: f.name, url: '#' }));
    const d = document.getElementById('lessonResources_' + idx);
    if (d) d.innerHTML = S.editorLessons[idx].resources.map((r, ridx) =>
        `<div style="display:flex;align-items:center;gap:.4rem;margin-top:.3rem;font-size:.75rem;color:var(--text3)">📎 ${r.title || r}<button class="btn-icon-sm" onclick="removeResource(${idx},${ridx})" style="color:var(--danger);font-size:.6rem;width:22px;height:22px"><i class="fas fa-times"></i></button></div>`
        ).join('');
    toast(`${files.length} resource(s) added`, 'success');
}

// ─── MEDIA ──────────────────────────────────────────────────────────────

export async function handleMediaUpload(input) {
    const files = Array.from(input.files);
    if (!S.currentCourseData?._id) { await saveDraftToServer(true); if (!S.currentCourseData?._id) { toast(
                'Save course draft first', 'warning'); return; } }
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const token = localStorage.getItem('cx_accessToken');
            const res = await fetch(`${API_BASE}/instructor/courses/${S.currentCourseData._id}/media/resource`, { method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, body: formData, credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                S.uploadedFiles.push({ name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    url: data.data.url, id: data.data._id || Date.now() });
                toast(`✅ ${file.name} uploaded`, 'success');
            }
        } catch (e) { toast(`Failed: ${file.name}`, 'error'); }
    }
    const elList = document.getElementById('uploadedFilesList');
    if (elList) elList.innerHTML = S.uploadedFiles.map((f, fi) =>
        `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:.3rem;font-size:.79rem"><i class="fas fa-file" style="color:var(--accent)"></i><span style="flex:1">${f.name}</span><span style="color:var(--text3)">${f.size}</span><button class="btn-icon-sm" onclick="S.uploadedFiles.splice(${fi},1);handleMediaUpload({files:[]})" style="color:var(--danger)"><i class="fas fa-trash"></i></button></div>`
        ).join('');
}

// ─── QUIZ BUILDER ──────────────────────────────────────────────────────

export function addQuizQ() { S.quizBuilderList.push({ question: '', options: ['', '', '', ''], correctIdx: 0 });
    renderQuizBuilder(); }

export function renderQuizBuilder() {
    const el = document.getElementById('quizBuilderList');
    if (!el) return;
    if (!S.quizBuilderList.length) {
        el.innerHTML =
            '<div style="text-align:center;padding:1.25rem;color:var(--text3);border:2px dashed var(--border);border-radius:var(--radius-sm)">No quiz questions yet.</div>';
        return;
    }
    el.innerHTML = S.quizBuilderList.map((q, qi) =>
        `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.85rem;margin-bottom:.6rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem"><strong style="font-size:.82rem">Q${qi + 1}</strong><button class="btn-icon-sm" onclick="S.quizBuilderList.splice(${qi},1);renderQuizBuilder()" style="color:var(--danger)"><i class="fas fa-trash"></i></button></div><input type="text" class="finput mb-2" value="${q.question || ''}" placeholder="Question text" oninput="S.quizBuilderList[${qi}].question=this.value" style="margin-bottom:.5rem;font-size:.82rem"/>${q.options.map((o, oi) => `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem"><input type="radio" name="ans${qi}" ${q.correctIdx === oi ? 'checked' : ''} onchange="S.quizBuilderList[${qi}].correctIdx=${oi}" style="accent-color:var(--primary)"/><input type="text" class="finput" value="${o || ''}" placeholder="Option ${oi + 1}" oninput="S.quizBuilderList[${qi}].options[${oi}]=this.value" style="height:32px;font-size:.78rem"/></div></div>`).join('')}</div>`
        ).join('');
}

// ─── PRICING ────────────────────────────────────────────────────────────

export function selectPriceType(type) {
    ['paid', 'free', 'sub'].forEach(t => document.getElementById('pt-' + t)?.classList.toggle('selected', t ===
        type));
    S.selectedPriceType = type;
    document.getElementById('pricingFields').style.display = type === 'paid' ? 'block' : 'none';
}

export function toggleAffiliateFields(show) { document.getElementById('affiliateFields').style.display = show ? 'block' :
        'none'; }

// ─── OUTCOMES ───────────────────────────────────────────────────────────

export function addOutcome() { S.outcomes.push('');
    renderOutcomes(); }

function renderOutcomes() {
    const el = document.getElementById('outcomesList');
    if (!el) return;
    el.innerHTML = S.outcomes.map((o, i) =>
        `<div style="display:flex;gap:.4rem"><input type="text" class="finput flex-1" value="${o}" placeholder="e.g. Build a real-world project" oninput="S.outcomes[${i}]=this.value" style="font-size:.82rem"/><button class="btn-icon-sm" onclick="S.outcomes.splice(${i},1);renderOutcomes()" style="color:var(--danger)"><i class="fas fa-times"></i></button></div>`
        ).join('');
}

// ─── REVIEW ─────────────────────────────────────────────────────────────

export function updateReviewSummary() {
    const el = document.getElementById('courseReviewSummary');
    if (!el) return;
    const title = document.getElementById('edTitle')?.value || 'Untitled Course';
    const price = document.getElementById('edPrice')?.value || 0;
    const affEnabled = document.getElementById('edAffEnabled')?.checked;
    const affPct = document.getElementById('edAffPercent')?.value || 0;
    const lessonCount = S.editorLessons.length;
    let warningHtml = '';
    if (S.currentCourseData?.approvalStatus === 'approved') {
        warningHtml =
            '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:var(--radius-sm);padding:.75rem;font-size:.8rem;color:var(--gold);margin-bottom:1rem"><i class="fas fa-exclamation-triangle"></i> ⚠️ Editing this approved course will send it back for admin review.</div>';
    }
    el.innerHTML = warningHtml +
        `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem"><div class="web-row"><span>Course Title</span><strong>${title}</strong></div><div class="web-row"><span>Lessons</span><strong class="${lessonCount >= 20 ? 'text-success' : 'text-danger'}">${lessonCount}/20 ${lessonCount >= 20 ? '✅' : '⚠️'}</strong></div><div class="web-row"><span>Pricing</span><strong>${S.selectedPriceType}</strong></div>${S.selectedPriceType === 'paid' ? `<div class="web-row"><span>Price</span><strong style="color:var(--primary)">${fmtMoneyAPI(price)}</strong></div>` : ''}<div class="web-row"><span>Affiliate</span><strong>${affEnabled ? affPct + '% ✅' : 'Disabled'}</strong></div></div>${lessonCount < 20 ? '<div style="background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:var(--radius-sm);padding:.75rem;font-size:.8rem;color:var(--danger);margin-bottom:1rem"><i class="fas fa-exclamation-triangle"></i> Need at least 20 lessons to submit.</div>' : ''}`;
}

export async function submitCourseForApproval() {
    const title = document.getElementById('edTitle')?.value.trim();
    if (!title) { toast('Course title is required', 'error'); return; }
    if (S.editorLessons.length < 20) { toast('Need at least 20 lessons', 'warning'); return; }
    await saveDraftToServer(true);
    if (!S.currentCourseData?._id) { toast('Failed to save course.', 'error'); return; }
    showLoading('Submitting course for review...');
    try {
        await apiCall(`/instructor/courses/${S.currentCourseData._id}/submit`, { method: 'POST' });
        toast('🚀 Course submitted for admin approval!', 'success');
        localStorage.removeItem(`course_draft_${S.currentCourseData._id}`);
        hideLoading();
        setTimeout(() => setDP('instructor'), 1000);
    } catch (e) { toast(e.message, 'error');
        hideLoading(); }
}

// ─── NEW / EDIT COURSE ────────────────────────────────────────────────

export function initNewCourse() {
    const hasCreatorAccess = S.isPremium || S.user?.roles?.includes('admin') || (S.user?.roles?.includes('creator') &&
        S.user?.isApprovedInstructor);
    if (!hasCreatorAccess) { toast('Upgrade to Premium to create courses', 'warning');
        import('./ui.js').then(({ openModal }) => openModal('premiumModal')); return; }
    S.editorLessons = [];
    S.quizBuilderList = [];
    S.outcomes = [];
    S.uploadedFiles = [];
    S.esStep = 1;
    S.currentCourseData = null;
    document.getElementById('edTitle').value = '';
    document.getElementById('edSubtitle').value = '';
    document.getElementById('edPrice').value = '';
    document.getElementById('edSalePrice').value = '';
    document.getElementById('edCourseTitle').textContent = 'Untitled Course';
    loadDraftFromLocalStorage('new');
    setDP('course-editor');
    goES(1);
    startAutoSave();
}

export async function editExistingCourse(courseId) {
    try {
        const data = await apiCall(`/courses/${courseId}`);
        S.currentCourseData = data.data || data;
        document.getElementById('edTitle').value = S.currentCourseData.title || '';
        document.getElementById('edSubtitle').value = S.currentCourseData.subtitle || '';
        document.getElementById('edCategory').value = S.currentCourseData.category || 'Web Development';
        document.getElementById('edLevel').value = S.currentCourseData.level || 'Beginner';
        document.getElementById('edEmoji').value = S.currentCourseData.thumbnail || S.currentCourseData.emoji ||
            '📚';
        if (S.currentCourseData.price) document.getElementById('edPrice').value = S.currentCourseData.price;
        if (S.currentCourseData.salePrice) document.getElementById('edSalePrice').value = S.currentCourseData
            .salePrice;
        S.editorLessons = Array.isArray(S.currentCourseData.lessons) ? S.currentCourseData.lessons : [];
        S.quizBuilderList = (S.currentCourseData.quizzes || []).flatMap(q => (q.questions || []).map(qq => ({
            question: qq.question, options: qq.options || [], correctIdx: qq.correctAnswer
        })));
        setDP('course-editor');
        goES(1);
        loadDraftFromLocalStorage(courseId);
        setTimeout(() => { if (S.quillEditors['descEditorQuill']) { S.quillEditors['descEditorQuill'].root
                    .innerHTML = S.currentCourseData.description || ''; } }, 300);
        updateSEO({ title: S.currentCourseData.title, description: S.currentCourseData.subtitle });
        toast('Course loaded for editing', 'success');
    } catch (e) { toast('Failed to load course: ' + e.message, 'error'); }
}

export async function submitExistingCourse(courseId) {
    if (!confirm('Submit this course for admin approval?')) return;
    showLoading('Submitting...');
    try {
        await apiCall(`/instructor/courses/${courseId}/submit`, { method: 'POST' });
        toast('🚀 Course submitted for review!', 'success');
        hideLoading();
        import('./instructor.js').then(({ loadInstructorData }) => loadInstructorData());
    } catch (e) { toast('Failed: ' + e.message, 'error');
        hideLoading(); }
}

export async function deleteCourse(courseId) {
    if (!confirm('Delete this course? This action cannot be undone.')) return;
    try { await apiCall(`/instructor/courses/${courseId}`, { method: 'DELETE' });
        toast('Course deleted', 'success');
        import('./instructor.js').then(({ loadInstructorData }) => loadInstructorData()); } catch (e) { toast(e.message,
            'error'); }
}

const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';

function updateSEO(data) {
    // minimal seo update
    if (data.title) document.title = data.title + ' | ChangeX Academy';
}

// Expose to window
window.goES = goES;
window.confirmAddLesson = confirmAddLesson;
window.editLesson = editLesson;
window.removeEditorLesson = removeEditorLesson;
window.selectLType = selectLType;
window.saveLessonContent = saveLessonContent;
window.handleLessonResources = handleLessonResources;
window.handleMediaUpload = handleMediaUpload;
window.addQuizQ = addQuizQ;
window.selectPriceType = selectPriceType;
window.toggleAffiliateFields = toggleAffiliateFields;
window.addOutcome = addOutcome;
window.submitCourseForApproval = submitCourseForApproval;
window.saveDraftToServer = saveDraftToServer;
window.initNewCourse = initNewCourse;
window.editExistingCourse = editExistingCourse;
window.submitExistingCourse = submitExistingCourse;
window.deleteCourse = deleteCourse;
