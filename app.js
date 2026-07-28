const state = {
  challengeSession: null,
};

function showToast(message, duration = 3200) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'same-origin',
    ...options,
  });

  if (response.status === 401) {
    throw new Error('برای دسترسی باید مینی‌اپ را از تلگرام باز کنید.');
  }

  return response.json();
}

function formatDateTime(isoString) {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return isoString;
  }
}

function renderLeaderboard(items) {
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';
  if (!items || !items.length) {
    list.innerHTML = '<li>مقام برتری ثبت نشده است.</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.rank}. ${item.full_name || item.name || 'کاربر ناشناس'} — ${item.score}`;
    list.appendChild(li);
  });
}

function renderChallenge(question) {
  const panel = document.getElementById('challengePanel');
  if (!question) {
    panel.innerHTML = `
      <p id="challengeIntro">برای شروع چالش، روی دکمه زیر بزنید.</p>
      <button id="startChallengeBtn" class="btn btn-secondary">شروع چالش</button>
    `;
    document.getElementById('startChallengeBtn').addEventListener('click', startChallenge);
    return;
  }

  panel.innerHTML = `
    <div class="question-block">
      <p class="question-title"><strong>سوال:</strong> ${question.title}</p>
      <p>${question.prompt}</p>
    </div>
    <div class="options-grid">
      ${question.options
        .map((option, index) => `<button class="btn btn-secondary option-btn" data-index="${index}">${option}</button>`)
        .join('')}
    </div>
  `;

  panel.querySelectorAll('.option-btn').forEach((button) => {
    button.addEventListener('click', () => submitChallengeAnswer(Number(button.dataset.index)));
  });
}

async function loadStatus() {
  try {
    const status = await apiFetch('/api/mini/status');
    document.getElementById('userName').textContent = status.full_name || status.name || 'دوست عزیز';
    document.getElementById('challengeStatus').textContent = status.challenge_remaining_text || 'وضعیت چالش در دسترس است.';
    document.getElementById('aiStatus').textContent = status.ai_remaining_text || 'سوال هوش مصنوعی آماده است.';

    document.getElementById('examIntro').textContent = status.exam_status && status.exam_status.is_live
      ? `آزمون شبانه در حال برگزاری است. از دکمه زیر برای پیوستن استفاده کنید.`
      : `آزمون بعدی: ${formatDateTime(status.exam_status.next_exam_time)}. ثبت نام تا ${status.exam_status.registration_deadline_text}`;
    document.getElementById('registerExamBtn').textContent = status.exam_status.is_live
      ? 'ورود به آزمون فعال'
      : status.exam_status.is_registered
        ? 'شما ثبت نام شده‌اید'
        : 'ثبت نام آزمون';
    document.getElementById('registerExamBtn').disabled = status.exam_status.is_registered;

    renderLeaderboard(status.exam_status.leaderboard);
  } catch (error) {
    document.getElementById('userName').textContent = 'ورود ناموفق';
    document.getElementById('challengeStatus').textContent = 'برای استفاده از ویژگی‌ها باید از تلگرام وارد شوید.';
    document.getElementById('aiStatus').textContent = 'ورود ناموفق';
    document.getElementById('examIntro').textContent = error.message;
    document.getElementById('registerExamBtn').disabled = true;
    showToast(error.message);
  }
}

async function startChallenge() {
  try {
    const data = await apiFetch('/api/mini/challenge/start', { method: 'POST' });
    state.challengeSession = data.session_id;
    renderChallenge(data.question);
  } catch (error) {
    showToast(error.message);
  }
}

async function submitChallengeAnswer(answerIndex) {
  if (!state.challengeSession) {
    showToast('ابتدا چالش را شروع کنید.');
    return;
  }

  try {
    const data = await apiFetch('/api/mini/challenge/answer', {
      method: 'POST',
      body: JSON.stringify({ session_id: state.challengeSession, answer_index: answerIndex }),
    });

    const panel = document.getElementById('challengePanel');
    panel.innerHTML = `
      <div class="question-block">
        <p><strong>پاسخ شما ثبت شد.</strong></p>
        <p>نتیجه: <strong>${data.correct ? 'درست' : 'غلط'}</strong></p>
        <p>${data.explanation}</p>
      </div>
      <button id="startChallengeBtn" class="btn btn-secondary">چالش جدید</button>
    `;
    document.getElementById('startChallengeBtn').addEventListener('click', startChallenge);
    state.challengeSession = null;
    if (data.correct) {
      showToast('آفرین! پاسخ شما صحیح بود.');
    } else {
      showToast('پاسخ شما ثبت شد. توضیح را ببینید.');
    }
    loadStatus();
  } catch (error) {
    showToast(error.message);
  }
}

async function submitAiQuestion() {
  const question = document.getElementById('aiQuestion').value.trim();
  if (!question) {
    showToast('لطفاً یک سوال وارد کنید.');
    return;
  }

  const answerBox = document.getElementById('aiAnswer');
  answerBox.textContent = 'در حال دریافت پاسخ...';

  try {
    const data = await apiFetch('/api/mini/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
    answerBox.textContent = data.answer || 'پاسخی دریافت نشد.';
    loadStatus();
  } catch (error) {
    answerBox.textContent = '';
    showToast(error.message);
  }
}

async function registerExam() {
  try {
    const data = await apiFetch('/api/mini/exam/register', { method: 'POST' });
    document.getElementById('registerExamBtn').textContent = 'شما ثبت نام شدید';
    document.getElementById('registerExamBtn').disabled = true;
    showToast('ثبت نام شما در آزمون شبانه با موفقیت انجام شد.');
    loadStatus();
  } catch (error) {
    showToast(error.message);
  }
}

function initializePage() {
  document.getElementById('refreshStatusBtn').addEventListener('click', loadStatus);
  document.getElementById('startChallengeBtn').addEventListener('click', startChallenge);
  document.getElementById('askAiBtn').addEventListener('click', submitAiQuestion);
  document.getElementById('registerExamBtn').addEventListener('click', registerExam);
  loadStatus();
}

window.addEventListener('DOMContentLoaded', initializePage);
