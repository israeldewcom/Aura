import { S } from './state.js';
import { renderWallet } from './payments.js';

export function initQuiz() {
    const el = document.getElementById('quizWrap');
    if (!el) return;
    if (S.currentCourseData?.quizzes?.length) {
        const allQ = S.currentCourseData.quizzes.flatMap(qz => qz.questions || []);
        S.quizQuestions = allQ.length ? allQ : [{ question: 'No questions available.', options: ['Okay'],
            correctAnswer: 0 }];
    } else {
        S.quizQuestions = [{ question: 'Sample: What does HTML stand for?', options: [
                'Hyper Text Markup Language', 'High Tech Modern Language',
                'Hyper Transfer Markup Language', 'Home Tool Markup Language'
            ], correctAnswer: 0 }];
    }
    S.qCurr = 0;
    S.qAns = {};
    renderQuizQ();
}

function renderQuizQ() {
    const el = document.getElementById('quizWrap');
    if (!el) return;
    if (S.qCurr >= S.quizQuestions.length) {
        const correct = Object.values(S.qAns).filter(Boolean).length;
        const total = S.quizQuestions.length;
        const pct = Math.round((correct / total) * 100);
        el.innerHTML =
            `<div style="text-align:center;padding:2rem 0"><div style="font-size:3rem">${pct >= 80 ? '🎉' : '😅'}</div><h3>${pct}%</h3><p style="color:var(--text3);margin:.5rem 0">${correct}/${total} correct</p><button class="btn btn-primary" onclick="initQuiz()">Retake</button></div>`;
        renderWallet();
        return;
    }
    const q = S.quizQuestions[S.qCurr];
    const questionText = q.question || q.q || 'Question';
    const options = q.options || q.opts || [];
    el.innerHTML =
        `<div class="quiz-q">${questionText}</div>${options.map((o, i) => `<div class="quiz-opt" id="qopt-${i}" onclick="selectOpt(${i})">${o}</div>`).join('')}`;
}

function selectOpt(i) {
    document.querySelectorAll('.quiz-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('qopt-' + i)?.classList.add('selected');
    const q = S.quizQuestions[S.qCurr];
    const correctAns = q.correctAnswer !== undefined ? q.correctAnswer : q.ans;
    const correct = correctAns === i || correctAns === q.options?.[i];
    document.getElementById('qopt-' + i)?.classList.add(correct ? 'correct' : 'wrong');
    if (!correct && typeof correctAns === 'number') document.getElementById('qopt-' + correctAns)?.classList.add(
        'correct');
    S.qAns[S.qCurr] = correct;
    setTimeout(() => { S.qCurr++;
        renderQuizQ(); }, 900);
}

// Expose
window.initQuiz = initQuiz;
