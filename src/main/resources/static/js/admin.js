function openLoginModal() {
  const modal = document.getElementById("login-modal");
  const err = document.getElementById("login-error");
  if (err) err.classList.add("hidden");
  const userInput = document.getElementById("login-username");
  const passInput = document.getElementById("login-password");
  if (userInput) userInput.value = "";
  if (passInput) passInput.value = "";

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (userInput) setTimeout(() => userInput.focus(), 50);
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const username = document.getElementById("login-username")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";
  const err = document.getElementById("login-error");

  if (!username || !password) {
    if (err) {
      err.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      err.classList.remove("hidden");
    }
    return;
  }

  // user1 및 admin 계정 외의 로그인 시도 차단
  if (username !== "user1" && username !== "admin") {
    if (err) {
      err.textContent = "아이디 또는 비밀번호가 일치하지 않습니다.";
      err.classList.remove("hidden");
    }
    return;
  }

  const res = await apiLogin(username, password);
  if (res && res.success) {
    const expireDuration = (res.expiresInSeconds || 3600) * 1000;
    const expireAt = Date.now() + expireDuration;

    state.currentUser = { role: res.role || "user", username: res.username || username };
    localStorage.setItem("kongbap_auth_user", JSON.stringify(state.currentUser));
    localStorage.setItem("kongbap_auth_expire_at", String(expireAt));

    if (typeof loadUserWatchRecords === "function") {
      await loadUserWatchRecords();
    }

    closeLoginModal();
    renderHeaderAuth();
    renderContent();

    if (state.currentUser.role === "admin") {
      showToast("🛡️ 어드민 로그인 완료 (30일 동안 로그인 유지)");
      if (typeof initYouTubeApiKeyFromBackend === "function") {
        initYouTubeApiKeyFromBackend();
      }
    } else {
      showToast("👤 로그인되었습니다.");
    }
  } else if (err) {
    err.textContent = res?.message || "아이디 또는 비밀번호가 일치하지 않습니다.";
    err.classList.remove("hidden");
  }
}

async function handleGuestLogin() {
  state.currentUser = { role: "guest", username: "게스트" };
  state.userWatchRecords = {};
  localStorage.setItem("kongbap_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbap_auth_expire_at");
  await apiLogout();
  closeLoginModal();
  renderHeaderAuth();
  renderContent();
  showToast("👤 게스트 모드로 계속합니다.");
}

async function logoutUser() {
  await apiLogout();
  state.currentUser = { role: "guest", username: "게스트" };
  state.userWatchRecords = {};
  localStorage.setItem("kongbap_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbap_auth_expire_at");
  if (state.currentCategory === "mypage") {
    state.currentCategory = "police";
  }
  renderHeaderAuth();
  renderContent();
  showToast("로그아웃되었습니다.");
}

// ==========================================
// 사용자 시청 완료 동기화 및 토글 핸들러
// ==========================================
async function loadUserWatchRecords() {
  if (!isUserLoggedIn()) return;
  try {
    const records = await apiGetWatchRecords();
    state.userWatchRecords = {};
    if (Array.isArray(records)) {
      records.forEach(r => {
        if (r && (r.watched === true || r.watched === "true")) {
          state.userWatchRecords[`${r.streamerId}_${r.videoType}`] = r;
        }
      });
    }
  } catch (e) {
    console.error("시청 기록 로드 실패:", e);
  }
}

async function toggleWatchSection(streamerId, videoType, streamerName, category, durationSeconds, videoCount) {
  if (!isUserLoggedIn()) {
    openLoginModal();
    return;
  }
  const key = `${streamerId}_${videoType}`;
  const isCurrentlyWatched = isWatchedSection(streamerId, videoType);
  const nextState = !isCurrentlyWatched;

  if (nextState && (!durationSeconds || durationSeconds <= 0)) {
    let mem = state.currentMember;
    if (!mem || (String(mem.id) !== String(streamerId) && String(mem.customId) !== String(streamerId))) {
      mem = null;
      for (const c of (KONGBAP_DATA.categories || [])) {
        if (c.hasSubgroups) {
          for (const g of (c.groups || [])) {
            const f = (g.members || []).find(m => String(m.id) === String(streamerId) || String(m.customId) === String(streamerId));
            if (f) { mem = f; break; }
          }
        } else {
          const f = (c.members || []).find(m => String(m.id) === String(streamerId) || String(m.customId) === String(streamerId));
          if (f) { mem = f; break; }
        }
        if (mem) break;
      }
    }
    if (mem) {
      if (typeof getMemberVideoSummary === "function") {
        const sum = getMemberVideoSummary(mem);
        if (videoType === "full") {
          durationSeconds = sum.fullTotalSeconds || 0;
          videoCount = videoCount || sum.fullCount || 0;
        } else if (videoType === "binge") {
          durationSeconds = sum.bingeTotalSeconds || 0;
          videoCount = videoCount || sum.bingeCount || 0;
        } else {
          durationSeconds = sum.clipTotalSeconds || 0;
          videoCount = videoCount || sum.clipCount || 0;
        }
      }
      if ((!durationSeconds || durationSeconds <= 0) && Array.isArray(mem.videos)) {
        let calcSec = 0;
        let calcCnt = 0;
        mem.videos.forEach(v => {
          const vType = typeof getVideoType === "function" ? getVideoType(v) : (v.videoType || "clip");
          if (vType === videoType) {
            calcCnt++;
            calcSec += (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0);
          }
        });
        if (calcSec > 0) durationSeconds = calcSec;
        if (calcCnt > 0) videoCount = calcCnt;
      }
    }
  }

  // 1. 낙관적 UI 업데이트 (지연 없는 0ms 즉각 반응)
  if (nextState) {
    state.userWatchRecords[key] = {
      streamerId,
      streamerName: streamerName || streamerId,
      category: category || null,
      videoType,
      watched: true,
      watchedSeconds: durationSeconds || 0,
      videoCount: videoCount || 0
    };
  } else {
    delete state.userWatchRecords[key];
  }

  // 2. 현재 화면 UI 즉각 재렌더링
  if (state.currentMember && (String(state.currentMember.id) === String(streamerId) || String(state.currentMember.customId) === String(streamerId))) {
    if (typeof updateMemberVideoTabContent === "function") {
      updateMemberVideoTabContent(state.currentMember);
    }
  } else if (state.currentCategory === "mypage") {
    const mainContent = document.getElementById("main-content");
    if (mainContent && typeof renderMyPage === "function") {
      renderMyPage(mainContent);
    }
  }

  // 3. 서버 DB 동기화
  try {
    const payload = {
      streamerId: String(streamerId),
      streamerName: streamerName || (state.currentMember ? state.currentMember.name : String(streamerId)),
      category: category || (state.currentMember ? state.currentMember.category : null),
      videoType: String(videoType),
      watched: nextState,
      watchedSeconds: Number(durationSeconds) || 0,
      videoCount: Number(videoCount) || 0
    };

    const res = await apiToggleWatch(payload);
    if (!res) {
      // 오프라인 / 깃허브 배포 사이트인 경우 로컬 읽기 전용 안내 및 상태 롤백
      if (isCurrentlyWatched) {
        state.userWatchRecords[key] = {
          streamerId,
          streamerName: streamerName || streamerId,
          category: category || null,
          videoType,
          watched: true,
          watchedSeconds: durationSeconds || 0,
          videoCount: videoCount || 0
        };
      } else {
        delete state.userWatchRecords[key];
      }
      if (state.currentMember && (String(state.currentMember.id) === String(streamerId) || String(state.currentMember.customId) === String(streamerId))) {
        if (typeof updateMemberVideoTabContent === "function") {
          updateMemberVideoTabContent(state.currentMember);
        }
      }
      showToast("ℹ️ 깃허브 배포 사이트는 시청 기록 읽기 전용 모드입니다.<br><span class='text-[11px] text-zinc-300'>시청 완료 체크는 로컬(PC)에서 등록 후 배포해주세요!</span>");
      return;
    }

    if (res && res.watched !== undefined) {
      if (res.watched) {
        state.userWatchRecords[key] = res;
      } else {
        delete state.userWatchRecords[key];
      }
    }

    const typeName = videoType === "clip" ? "편집 영상" : (videoType === "full" ? "풀 영상" : "몰아보기");
    if (nextState) {
      showToast(`✅ [${payload.streamerName} - ${typeName}] 시청 완료 체크`);
    } else {
      showToast(`↩️ [${payload.streamerName} - ${typeName}] 시청 완료 취소`);
    }
  } catch (e) {
    console.error("시청 기록 저장 실패:", e);
    showToast("⚠️ 시청 기록 저장 중 오류가 발생했습니다.");
  }
}

// ==========================================
// 관리자 기능 모듈화 안내 (Modularized Admin Modules)
// 각 세부 관리 기능은 독립된 모듈 파일로 분리 관리됩니다:
// - 영상 등록/수정/삭제/정렬: js/admin-video.js
// - 인원 등록/수정/삭제/소속: js/admin-member.js
// - 유튜브 재생목록 일괄 등록: js/admin-playlist.js
// ==========================================

// ==========================================
// 어드민 설정 모달 및 유튜브 구독자 / 영상 조회수 일괄 갱신
// ==========================================

let isSyncingSubscribers = false;
let isSyncingViewCounts = false;
let currentAdminSettingsTab = 'subscribers';

function updateAdminSettingsModalCounts() {
  // 1. 등록된 유튜브 링크(youtubeUrl)가 있는 대상 인원수 계산
  const allMembers = typeof extractAllStreamersFromKongbapData === "function" 
    ? extractAllStreamersFromKongbapData() 
    : [];
  const targetCount = allMembers.filter(m => m.youtubeUrl && m.youtubeUrl.trim()).length;

  const targetCountEl = document.getElementById("admin-sub-target-count");
  if (targetCountEl) {
    targetCountEl.textContent = `${targetCount}명`;
  }

  if (!isSyncingSubscribers) {
    const progressBar = document.getElementById("admin-sub-progress-bar");
    const progressText = document.getElementById("admin-sub-progress-text");
    const logBox = document.getElementById("admin-sub-log-box");
    const btn = document.getElementById("admin-sub-sync-btn");

    if (progressBar && (!progressBar.style.width || progressBar.style.width === "0%")) progressBar.style.width = "0%";
    if (progressText && (!progressText.textContent || progressText.textContent.includes("대기 중"))) {
      progressText.innerHTML = `<span class="text-amber-400 font-bold">대기 중</span> <span class="text-zinc-500 font-normal">(대상: <strong class="text-zinc-200 font-bold">${targetCount}</strong>명)</span>`;
    }
    if (logBox && (!logBox.children.length || logBox.innerHTML.includes("갱신 준비 완료"))) {
      logBox.innerHTML = `<div class="text-zinc-500 text-xs italic">갱신 준비 완료. 아래 [구독자·팔로워 수 일괄 갱신 시작] 버튼을 눌러주세요.</div>`;
    }
    if (btn && !btn.disabled) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>구독자·팔로워 수 일괄 갱신 시작</span>
      `;
    }
  }

  // 2. 등록된 전체 영상 개수 (유튜브 / 치지직) 계산
  const allVideos = typeof extractAllVideosFromKongbapData === "function"
    ? extractAllVideosFromKongbapData()
    : [];
  let ytVideoCount = 0;
  let chzzkVideoCount = 0;
  allVideos.forEach(it => {
    const url = it.video?.url || "";
    if (typeof isChzzkUrl === "function" && isChzzkUrl(url)) {
      chzzkVideoCount++;
    } else {
      ytVideoCount++;
    }
  });

  const viewTargetCountEl = document.getElementById("admin-view-target-count");
  const viewYtCountEl = document.getElementById("admin-view-yt-count");
  const viewChzzkCountEl = document.getElementById("admin-view-chzzk-count");
  if (viewTargetCountEl) viewTargetCountEl.textContent = `${allVideos.length}개`;
  if (viewYtCountEl) viewYtCountEl.textContent = `${ytVideoCount}`;
  if (viewChzzkCountEl) viewChzzkCountEl.textContent = `${chzzkVideoCount}`;

  if (!isSyncingViewCounts) {
    const progressBar = document.getElementById("admin-view-progress-bar");
    const progressText = document.getElementById("admin-view-progress-text");
    const logBox = document.getElementById("admin-view-log-box");
    const btn = document.getElementById("admin-view-sync-btn");

    if (progressBar && (!progressBar.style.width || progressBar.style.width === "0%")) progressBar.style.width = "0%";
    if (progressText && (!progressText.textContent || progressText.textContent.includes("대기 중"))) {
      progressText.innerHTML = `<span class="text-emerald-400 font-bold">대기 중</span> <span class="text-zinc-500 font-normal">(대상: <strong class="text-zinc-200 font-bold">${allVideos.length}</strong>개)</span>`;
    }
    if (logBox && (!logBox.children.length || logBox.innerHTML.includes("갱신 준비 완료"))) {
      logBox.innerHTML = `<div class="text-zinc-500 text-xs italic">갱신 준비 완료. 아래 [전체 영상 조회수 일괄 갱신 시작] 버튼을 눌러주세요.</div>`;
    }
    if (btn && !btn.disabled) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        <span>전체 영상 조회수 일괄 갱신 시작</span>
      `;
    }
  }
}

function switchAdminSettingsTab(tab) {
  currentAdminSettingsTab = tab;
  const subTabBtn = document.getElementById("admin-tab-btn-subscribers");
  const viewTabBtn = document.getElementById("admin-tab-btn-views");
  const subPanel = document.getElementById("admin-panel-subscribers");
  const viewPanel = document.getElementById("admin-panel-views");

  if (tab === 'subscribers') {
    if (subTabBtn) {
      subTabBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-amber-500 text-black shadow-md shadow-amber-500/20";
    }
    if (viewTabBtn) {
      viewTabBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80";
    }
    if (subPanel) subPanel.classList.remove("hidden");
    if (viewPanel) viewPanel.classList.add("hidden");
  } else {
    if (subTabBtn) {
      subTabBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80";
    }
    if (viewTabBtn) {
      viewTabBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-emerald-500 text-black shadow-md shadow-emerald-500/20";
    }
    if (subPanel) subPanel.classList.add("hidden");
    if (viewPanel) viewPanel.classList.remove("hidden");
  }

  updateAdminSettingsModalCounts();
}

let currentAdminPageTab = 'analytics';

function renderAdminPage(container) {
  if (!container) return;

  if (!isAdmin()) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto py-20 px-4 text-center">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mb-4">🔒</div>
        <h2 class="text-xl sm:text-2xl font-black text-white mb-2">관리자 권한이 필요합니다</h2>
        <p class="text-zinc-400 text-sm mb-6">관리자 센터에 접근하려면 관리자(admin) 계정으로 로그인해 주세요.</p>
        <button onclick="openLoginModal()" class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
          관리자 로그인
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="max-w-7xl mx-auto py-3 sm:py-4 space-y-4 sm:space-y-5">
      <!-- 페이지 상단 컴팩트 헤더 -->
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg sm:text-xl shadow-sm flex-shrink-0">
            🛡️
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base sm:text-lg font-black text-white tracking-tight">콩밥특별시 관리자 센터</h2>
            <span class="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40 font-bold">ADMIN CONSOLE</span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="hidden sm:inline">관리자 세션 활성</span>
            <span class="sm:hidden">관리자</span>
          </span>
          <button onclick="resetToCategory('police')" class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1" title="메인 사이트로 돌아가기">
            <span>←</span>
            <span class="hidden sm:inline">사이트 홈으로</span>
            <span class="sm:hidden">홈</span>
          </button>
        </div>
      </div>

      <!-- 4대 메인 관리 탭 버튼 바 -->
      <div class="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-x-auto shadow-inner">
        <button 
          id="admin-page-tab-btn-analytics" 
          type="button" 
          onclick="switchAdminPageTab('analytics')" 
          class="flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap bg-amber-500 text-black shadow-md shadow-amber-500/20"
        >
          <span>📊</span>
          <span>방문자 통계</span>
        </button>
        <button 
          id="admin-page-tab-btn-subscribers" 
          type="button" 
          onclick="switchAdminPageTab('subscribers')" 
          class="flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
        >
          <span>📺</span>
          <span>구독자 갱신</span>
        </button>
        <button 
          id="admin-page-tab-btn-views" 
          type="button" 
          onclick="switchAdminPageTab('views')" 
          class="flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
        >
          <span>👁️</span>
          <span>조회수 갱신</span>
        </button>
        <button 
          id="admin-page-tab-btn-backup" 
          type="button" 
          onclick="switchAdminPageTab('backup')" 
          class="flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
        >
          <span>💾</span>
          <span>백업 & 복원 관리</span>
        </button>
      </div>

      <!-- 탭별 동적 헤더/상태 카드 (탭 전환 시 실시간 동기화) -->
      <div id="admin-page-dynamic-header-area">
        <!-- 탭 1 안내: 방문자 통계 -->
        <div id="admin-header-card-analytics" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-xl shadow-md flex-shrink-0">
              📊
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-black text-white">방문자 트래픽 종합 분석</h3>
                <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-bold">GA4 연동</span>
              </div>
              <p class="text-xs text-zinc-400 mt-0.5">구글 애널리틱스 4 기반 실시간 및 누적 방문자 통계</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
            <span id="admin-analytics-updated-at" class="text-xs font-mono text-zinc-400 hidden md:inline">조회 대기 중...</span>
            <button 
              id="admin-analytics-refresh-btn"
              type="button" 
              onclick="fetchAdminAnalyticsData(true)" 
              class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              title="최신 통계 새로고침"
            >
              <span id="admin-analytics-refresh-icon">🔄</span>
              <span>새로고침</span>
            </button>
            <a 
              href="./analytics.html" 
              target="_blank" 
              rel="noopener noreferrer"
              class="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl text-xs font-medium transition-all flex items-center gap-1"
              title="새 창에서 독립 대시보드로 열기"
            >
              <span>대시보드 새창 ↗</span>
            </a>
          </div>
        </div>

        <!-- 탭 2 안내: 구독자 갱신 -->
        <div id="admin-header-card-subscribers" class="hidden bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div class="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
            <span class="text-zinc-200 flex items-center gap-2 font-bold text-sm sm:text-base">
              <span>📺</span>
              <span>유튜브 구독자 & 치지직 팔로워 수 일괄 갱신</span>
            </span>
            <span class="text-xs sm:text-sm px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold">
              갱신 대상: <strong id="admin-sub-target-count" class="text-amber-400 font-bold">0명</strong>
            </span>
          </div>
          <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            • 인원 정보에 등록된 <span class="text-amber-400 font-bold">유튜브 또는 치지직 공식 채널 링크</span>를 기준으로 최신 구독자/팔로워 수를 실시간 조회하여 반영합니다.<br>
            • 일괄 조회가 완료되면 MariaDB 및 정적 백업 파일에 자동 저장됩니다.
          </p>
        </div>

        <!-- 탭 3 안내: 조회수 갱신 -->
        <div id="admin-header-card-views" class="hidden bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div class="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
            <span class="text-zinc-200 flex items-center gap-2 font-bold text-sm sm:text-base">
              <span>👁️</span>
              <span>전체 영상 조회수 실시간 일괄 갱신</span>
            </span>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 font-semibold">
                유튜브: <strong id="admin-view-yt-count" class="text-red-400 font-bold">0</strong>
              </span>
              <span class="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-semibold">
                치지직: <strong id="admin-view-chzzk-count" class="text-emerald-400 font-bold">0</strong>
              </span>
              <span class="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold">
                총 대상: <strong id="admin-view-target-count" class="text-amber-400 font-bold">0개</strong>
              </span>
            </div>
          </div>
          <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            • 등록된 모든 편집 영상, 풀영상, 다시보기의 <span class="text-emerald-400 font-bold">유튜브 및 치지직 조회수</span>를 공식 API를 통해 일괄 조회하여 갱신합니다.<br>
            • 조회수가 최신화되면 메인 사이트 및 플레이타임/조회수 랭킹에 즉시 반영됩니다.
          </p>
        </div>

        <!-- 탭 4 안내: 백업 & 복원 관리 -->
        <div id="admin-header-card-backup" class="hidden bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-sm">
          <div class="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
            <span class="text-zinc-300 flex items-center gap-2 font-bold">
              <span>💾</span>
              <span>데이터베이스 자동 백업 및 복원 센터</span>
            </span>
            <span id="backup-modal-count-badge" class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">0개 보관 중</span>
          </div>
          <div class="flex items-center justify-between text-xs flex-wrap gap-2 pt-2 border-t border-zinc-800/60">
            <span class="text-zinc-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>지정 백업 경로:</span>
              <span id="backup-modal-dir-path" class="font-mono text-amber-300 font-semibold truncate max-w-md">data/backups/</span>
            </span>
            <span id="backup-modal-server-status" class="text-emerald-400 font-semibold">🟢 백엔드 정상 연동 중</span>
          </div>
          <p class="text-[11px] text-zinc-500 pt-1">
            • 인원/영상 추가·수정 시 자동으로 백업 스냅샷이 생성되며, 최대 300개까지 안전하게 순환 보관됩니다.
          </p>
        </div>
      </div>

      <!-- 패널 1: 방문자 통계 -->
      <div id="admin-page-panel-analytics" class="space-y-6">
        ${typeof renderAnalyticsTabHtml === "function" ? renderAnalyticsTabHtml() : '<div class="text-zinc-500 py-10 text-center">통계 모듈 로딩 중...</div>'}
      </div>

      <!-- 패널 2: 구독자 갱신 -->
      <div id="admin-page-panel-subscribers" class="hidden space-y-6">
        <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-inner space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span class="text-base">⚡</span>
              <span>진행 상황</span>
            </span>
            <span id="admin-sub-progress-text" class="text-xs sm:text-sm font-mono text-zinc-300 font-medium"><span class="text-amber-400 font-bold">대기 중</span></span>
          </div>

          <div class="w-full h-3.5 sm:h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
            <div id="admin-sub-progress-bar" class="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 rounded-full transition-all duration-300" style="width: 0%;"></div>
          </div>

          <div>
            <div class="text-[11px] sm:text-xs text-zinc-400 font-semibold mb-2 flex items-center gap-1.5">
              <span>📋</span>
              <span>실시간 갱신 로그</span>
            </div>
            <div id="admin-sub-log-box" class="h-72 sm:h-80 overflow-y-auto bg-zinc-950 rounded-xl p-3 sm:p-4 border border-zinc-800/80 font-mono text-xs space-y-1 select-text" style="scrollbar-gutter: stable;">
              <div class="text-zinc-500 text-xs italic">갱신 대기 중입니다. 아래 버튼을 눌러 일괄 갱신을 시작하세요.</div>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button 
              id="admin-sub-sync-btn"
              type="button" 
              onclick="startSubscriberSync()" 
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-sm font-black transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4 text-red-700 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>구독자·팔로워 수 일괄 갱신 시작</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 패널 3: 영상 조회수 갱신 -->
      <div id="admin-page-panel-views" class="hidden space-y-6">
        <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-inner space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span class="text-base">⚡</span>
              <span>진행 상황</span>
            </span>
            <span id="admin-view-progress-text" class="text-xs sm:text-sm font-mono text-zinc-300 font-medium"><span class="text-emerald-400 font-bold">대기 중</span></span>
          </div>

          <div class="w-full h-3.5 sm:h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
            <div id="admin-view-progress-bar" class="h-full bg-gradient-to-r from-emerald-600 via-teal-400 to-sky-400 rounded-full transition-all duration-300" style="width: 0%;"></div>
          </div>

          <div>
            <div class="text-[11px] sm:text-xs text-zinc-400 font-semibold mb-2 flex items-center gap-1.5">
              <span>📋</span>
              <span>실시간 조회수 갱신 로그</span>
            </div>
            <div id="admin-view-log-box" class="h-72 sm:h-80 overflow-y-auto bg-zinc-950 rounded-xl p-3 sm:p-4 border border-zinc-800/80 font-mono text-xs space-y-1 select-text" style="scrollbar-gutter: stable;">
              <div class="text-zinc-500 text-xs italic">조회수 갱신 대기 중입니다. 아래 버튼을 눌러 일괄 갱신을 시작하세요.</div>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button 
              id="admin-view-sync-btn"
              type="button" 
              onclick="startViewCountSync()" 
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span>전체 영상 조회수 일괄 갱신 시작</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 패널 4: 백업 & 복원 관리 -->
      <div id="admin-page-panel-backup" class="hidden space-y-6">
        <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5">
          <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>⚡</span>
            <span>현재 상태 즉시 수동 백업</span>
          </h4>
          <div class="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              id="backup-manual-reason" 
              placeholder="백업 사유 또는 메모 입력 (예: 조직도 순서 변경 완료 후)" 
              class="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <button 
              type="button" 
              onclick="handleManualBackupFromModal()" 
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5 flex-shrink-0"
            >
              <span>💾 즉시 저장</span>
            </button>
          </div>
        </div>

        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📋</span>
              <span>보관된 백업 목록</span>
              <span id="backup-modal-list-count" class="text-amber-400 text-xs font-bold ml-1"></span>
            </h4>
            <div class="flex items-center gap-2">
              <label class="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors" title="외부 백업 JSON 파일 직접 복원">
                <span>📤 JSON 파일 복원</span>
                <input type="file" id="backup-file-upload-input" accept=".json" class="hidden" onchange="handleBackupFileUpload(event)" />
              </label>
              <button onclick="loadAndRenderBackupList()" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer" title="목록 새로고침">
                <span>🔄 목록 새로고침</span>
              </button>
            </div>
          </div>

          <div id="backup-modal-list-container" class="space-y-2.5 max-h-[500px] overflow-y-auto pr-1" style="scrollbar-gutter: stable;">
            <div class="text-center py-10 text-zinc-500 text-xs">
              백업 기록을 불러오는 중...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  switchAdminPageTab(currentAdminPageTab || 'analytics');
}

function switchAdminPageTab(tab) {
  currentAdminPageTab = tab;

  const tabs = ['analytics', 'subscribers', 'views', 'backup'];
  tabs.forEach(t => {
    const btn = document.getElementById(`admin-page-tab-btn-${t}`);
    const panel = document.getElementById(`admin-page-panel-${t}`);
    const card = document.getElementById(`admin-header-card-${t}`);

    if (t === tab) {
      if (btn) {
        btn.className = "flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap bg-amber-500 text-black shadow-md shadow-amber-500/20";
      }
      if (panel) panel.classList.remove("hidden");
      if (card) card.classList.remove("hidden");
    } else {
      if (btn) {
        btn.className = "flex-1 min-w-[120px] py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900";
      }
      if (panel) panel.classList.add("hidden");
      if (card) card.classList.add("hidden");
    }
  });

  if (tab === 'analytics') {
    if (typeof fetchAdminAnalyticsData === "function") {
      fetchAdminAnalyticsData(false);
    }
  } else if (tab === 'subscribers' || tab === 'views') {
    updateAdminSettingsModalCounts();
  } else if (tab === 'backup') {
    if (typeof refreshBackupTabUI === "function") {
      refreshBackupTabUI();
    } else if (typeof loadAndRenderBackupList === "function") {
      loadAndRenderBackupList();
    }
  }
}

function openAdminSettingsModal(tab = 'subscribers') {
  if (typeof selectAdminPage === "function") {
    selectAdminPage(tab);
    return;
  }
  currentAdminSettingsTab = tab;
  updateAdminSettingsModalCounts();
}

function closeAdminSettingsModal() {
  const modal = document.getElementById("admin-settings-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

async function startSubscriberSync() {
  if (isSyncingSubscribers) return;

  const btn = document.getElementById("admin-sub-sync-btn");
  const progressBar = document.getElementById("admin-sub-progress-bar");
  const progressText = document.getElementById("admin-sub-progress-text");
  const logBox = document.getElementById("admin-sub-log-box");

  isSyncingSubscribers = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>구독자·팔로워 수 조회 및 갱신 중...</span>
    `;
  }
  if (logBox) logBox.innerHTML = "";

  try {
    let liveSuccess = 0;
    let liveFail = 0;

    let syncFn = typeof executeSubscriberSync === "function" 
      ? executeSubscriberSync 
      : (typeof window !== "undefined" && typeof window.executeSubscriberSync === "function" ? window.executeSubscriberSync : null);

    if (!syncFn) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `./js/subscriber-sync.js?v=${Date.now()}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("subscriber-sync.js 스크립트 파일을 불러오지 못했습니다."));
        document.head.appendChild(s);
      });
      syncFn = typeof executeSubscriberSync === "function" 
        ? executeSubscriberSync 
        : (typeof window !== "undefined" && typeof window.executeSubscriberSync === "function" ? window.executeSubscriberSync : null);
    }

    if (typeof syncFn !== "function") {
      throw new Error("구독자 갱신 모듈(executeSubscriberSync)을 찾을 수 없습니다. 브라우저 캐시(Ctrl + F5)를 갱신해주세요.");
    }

    const syncRes = await syncFn((current, total, streamerName, status) => {
      if (status === "SAVING_BACKUP") {
        if (progressBar) progressBar.style.width = "100%";
        if (progressText) {
          progressText.innerHTML = `<span class="text-amber-400 font-bold">100%</span> <span class="text-zinc-500 font-normal">(<strong class="text-zinc-200 font-bold">${total}</strong>/<span class="text-zinc-400">${total}</span>명)</span> <span class="text-zinc-600">·</span> <span class="text-amber-300 font-semibold animate-pulse">데이터 저장 및 백업 생성 중...</span>`;
        }
        if (logBox) {
          let spinner = document.getElementById("admin-sub-saving-spinner");
          if (!spinner) {
            spinner = document.createElement("div");
            spinner.id = "admin-sub-saving-spinner";
            spinner.className = "p-3.5 my-2.5 bg-zinc-900/95 rounded-xl border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg shadow-black/40";
            spinner.innerHTML = `
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <svg class="animate-spin h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span class="text-amber-300 font-bold text-xs sm:text-[13px]">데이터 저장 및 백업 파일 생성 중...</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-medium">진행 중</span>
                  </div>
                  <p class="text-[11px] text-zinc-400 mt-0.5 truncate">조회된 최신 구독자/팔로워 정보를 MariaDB 및 백업 파일에 안전하게 반영하고 있습니다.</p>
                </div>
              </div>
              <span class="text-[11px] text-amber-400/80 font-mono flex-shrink-0 hidden sm:inline-block">잠시만 기다려주세요...</span>
            `;
            logBox.appendChild(spinner);
            logBox.scrollTop = logBox.scrollHeight;
          }
        }
        return;
      }

      const isSuccess = status.startsWith("성공");
      if (isSuccess) {
        liveSuccess++;
      } else if (current > 0 && !streamerName.includes("채널")) {
        liveFail++;
      }

      const pct = Math.round((current / total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressText) {
        progressText.innerHTML = `<span class="text-amber-400 font-bold">${pct}%</span> <span class="text-zinc-500 font-normal">(<strong class="text-zinc-200 font-bold">${current}</strong>/<span class="text-zinc-400">${total}</span>명)</span> <span class="text-zinc-600">·</span> <span class="text-zinc-400 font-normal">성공:</span> <strong class="text-emerald-400 font-bold">${liveSuccess}</strong>명 <span class="text-zinc-600">/</span> <span class="text-zinc-400 font-normal">실패:</span> <strong class="${liveFail > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400 font-normal'}">${liveFail}</strong>명`;
      }

      if (logBox) {
        const line = document.createElement("div");
        line.className = "text-xs sm:text-[13px] py-1 font-mono flex items-center justify-between gap-3";
        line.innerHTML = `
          <div class="truncate">
            <span class="text-zinc-500">[${current}/${total}]</span>
            <span class="text-zinc-200 font-medium ml-1.5">${streamerName}</span>
          </div>
          <span class="flex-shrink-0 ${isSuccess ? 'text-emerald-400 font-bold' : 'text-rose-400 font-medium'}">${status}</span>
        `;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
      }
    });

    const savingSpinner = document.getElementById("admin-sub-saving-spinner");
    if (savingSpinner) savingSpinner.remove();

    const updatedCount = (typeof syncRes === "object" && syncRes !== null) ? syncRes.updatedCount : (Number(syncRes) || 0);
    const successCount = (typeof syncRes === "object" && syncRes !== null && syncRes.successCount !== undefined) 
      ? syncRes.successCount 
      : updatedCount;
    const totalCount = (typeof syncRes === "object" && syncRes !== null && syncRes.totalCount !== undefined) 
      ? syncRes.totalCount 
      : ((syncRes && syncRes.targetsCount) || updatedCount);
    const failedCount = (typeof syncRes === "object" && syncRes !== null && syncRes.failedCount !== undefined)
      ? syncRes.failedCount
      : Math.max(0, totalCount - successCount);

    // 1) 기존 등록자 기준 증가량
    const existingIncrease = (typeof syncRes === "object" && syncRes !== null)
      ? (syncRes.existingIncrease !== undefined ? syncRes.existingIncrease : (syncRes.totalIncrease || 0))
      : 0;
    const existingIncreasedCount = (typeof syncRes === "object" && syncRes !== null)
      ? (syncRes.existingIncreasedCount || syncRes.increasedCount || 0)
      : 0;
    const existingIncText = existingIncrease > 0 
      ? `+${existingIncrease.toLocaleString()}명` 
      : (existingIncrease === 0 ? "0명" : `-${Math.abs(existingIncrease).toLocaleString()}명`);
    const formattedExistingInc = (existingIncrease >= 10000 && typeof formatSubscriberCount === "function")
      ? ` (${formatSubscriberCount(existingIncrease)})`
      : "";

    // 2) 새로 추가된 인원 (신규 등록자)
    const newlyAddedCount = (typeof syncRes === "object" && syncRes !== null) ? (syncRes.newlyAddedCount || 0) : 0;
    const newlyAddedSubTotal = (typeof syncRes === "object" && syncRes !== null) ? (syncRes.newlyAddedSubTotal || 0) : 0;
    const newlyAddedSubText = newlyAddedSubTotal > 0
      ? `+${newlyAddedSubTotal.toLocaleString()}명`
      : (newlyAddedCount > 0 ? `${newlyAddedCount}명` : "0명");
    const formattedNewlyAdded = (newlyAddedSubTotal >= 10000 && typeof formatSubscriberCount === "function")
      ? ` (${formatSubscriberCount(newlyAddedSubTotal)})`
      : "";

    // 3) 마지막 조회일 기준 경과 시간 및 최다 증가 TOP 3
    const lastSyncDateStr = (typeof syncRes === "object" && syncRes !== null) ? (syncRes.lastSyncDateStr || null) : null;
    const elapsedSinceLastSync = (typeof syncRes === "object" && syncRes !== null) ? (syncRes.elapsedSinceLastSync || null) : null;
    const topIncreased = (typeof syncRes === "object" && syncRes !== null && Array.isArray(syncRes.topIncreased))
      ? syncRes.topIncreased.slice(0, 3)
      : [];
    const rankBadges = ["🥇 1위", "🥈 2위", "🥉 3위"];
    const topIncreasedHtml = topIncreased.length > 0 ? `
      <div class="pt-2 mt-1 border-t border-zinc-800/80 space-y-1.5">
        <div class="text-[11px] text-zinc-400 font-semibold flex items-center justify-between gap-2 flex-wrap">
          <span class="text-amber-300 font-bold">🏆 구독자 최다 증가 TOP ${topIncreased.length}</span>
          ${lastSyncDateStr ? `<span class="text-[10px] text-zinc-500 font-normal">마지막 조회: ${lastSyncDateStr}</span>` : ''}
        </div>
        <div class="space-y-1">
          ${topIncreased.map((item, idx) => {
            const diffStr = `+${item.diff.toLocaleString()}명`;
            const diffUnitStr = (item.diff >= 10000 && item.diffFormatted) ? ` (${item.diffFormatted})` : "";
            const displayName = item.name && item.name !== item.streamer
              ? `${item.streamer} <span class="text-zinc-400 font-normal">(${item.name})</span>`
              : item.streamer;
            return `
              <div class="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800/70 text-[11px]">
                <div class="flex items-center gap-1.5 min-w-0 truncate">
                  <span class="font-bold ${idx === 0 ? 'text-amber-300' : (idx === 1 ? 'text-zinc-200' : 'text-amber-500/90')} flex-shrink-0">${rankBadges[idx] || `${idx + 1}위`}</span>
                  <span class="text-zinc-100 font-semibold truncate">${displayName}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0 text-right">
                  <span class="text-zinc-500 text-[10px] hidden sm:inline">${item.prevRaw} → ${item.newRaw}</span>
                  <strong class="text-emerald-400 font-bold">${diffStr}${diffUnitStr}</strong>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    ` : "";

    if (progressBar) progressBar.style.width = "100%";
    if (progressText) {
      const incColor = existingIncrease > 0 ? 'text-amber-300' : (existingIncrease < 0 ? 'text-blue-400' : 'text-zinc-400');
      progressText.innerHTML = `<span class="text-emerald-400 font-bold">100% 완료</span> <span class="text-zinc-500 font-normal">(총 <strong class="text-zinc-200 font-bold">${totalCount}</strong>명 중 성공 <strong class="text-emerald-400 font-bold">${successCount}</strong>명 <span class="text-zinc-600">|</span> 기존 구독자 <strong class="${incColor} font-bold">${existingIncText}</strong> (${existingIncreasedCount}명 상승) <span class="text-zinc-600">|</span> 신규 인원 <strong class="text-sky-300 font-bold">${newlyAddedCount}명</strong>${elapsedSinceLastSync ? ` <span class="text-zinc-600">|</span> <span class="text-amber-300 font-semibold">${elapsedSinceLastSync}</span>` : ''})</span>`;
    }

    if (logBox) {
      const finishLine = document.createElement("div");
      finishLine.className = "text-xs py-3 font-mono border-t border-zinc-800 mt-2 space-y-2.5";
      finishLine.innerHTML = `
        <div class="text-emerald-400 font-bold flex items-center justify-between flex-wrap gap-2 text-sm">
          <span class="flex items-center gap-1.5">
            <span>${failedCount === 0 ? '🎉' : '📊'}</span>
            <span>구독자·팔로워 수 조회 완료!</span>
          </span>
          <span class="text-xs font-mono flex items-center gap-2">
            <span class="text-emerald-400 font-bold">성공: ${successCount}명</span>
            <span class="${failedCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-500'}">실패: ${failedCount}명</span>
            <span class="text-zinc-500">/ 총 ${totalCount}명</span>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div class="p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40 flex items-center justify-between">
            <span class="text-xs text-emerald-300 font-medium">✅ 조회 성공</span>
            <strong class="text-emerald-400 font-bold text-sm">${successCount}명</strong>
          </div>
          <div class="p-2.5 ${failedCount > 0 ? 'bg-rose-950/30 border-rose-800/40 text-rose-300' : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-400'} rounded-xl border flex items-center justify-between">
            <span class="text-xs font-medium">${failedCount > 0 ? '❌ 조회 실패' : '✨ 실패 없음'}</span>
            <strong class="${failedCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'} text-sm">${failedCount}명</strong>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 items-start">
          <!-- 1) 기존 멤버 구독자 변동 -->
          <div class="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex flex-col justify-between gap-2 text-xs">
            <div class="flex items-center justify-between gap-2.5">
              <div class="flex flex-col">
                <span class="text-amber-400 font-bold flex items-center gap-1">
                  <span>📈</span>
                  <span>기존 멤버 구독자 증가</span>
                </span>
                <span class="text-zinc-500 text-[11px] font-normal">이전 등록 스트리머</span>
                ${elapsedSinceLastSync ? `
                  <span class="text-[11px] text-amber-300 font-semibold mt-1 flex items-center gap-1">
                    <span>⏱️</span>
                    <span>${elapsedSinceLastSync}${lastSyncDateStr ? ` <span class="text-zinc-400 font-normal">(${lastSyncDateStr} 기준)</span>` : ''}</span>
                  </span>
                ` : ''}
              </div>
              <div class="text-right">
                <div class="font-bold text-sm sm:text-base">
                  <span class="text-zinc-400 text-xs font-normal">구독자 </span><strong class="text-emerald-400 font-extrabold">${existingIncText}</strong>${formattedExistingInc ? `<span class="text-zinc-400 text-xs ml-1">${formattedExistingInc}</span>` : ""}
                </div>
                <div class="text-[11px] text-zinc-400 mt-0.5">
                  ${existingIncreasedCount > 0 ? `구독자 오른 인원: <strong class="text-amber-300 font-bold">${existingIncreasedCount}명</strong>` : `<span class="text-zinc-500">구독자 변동 없음</span>`}
                </div>
              </div>
            </div>
            ${topIncreasedHtml}
          </div>
          <!-- 2) 새로 추가된 인원 -->
          <div class="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-between gap-2.5 text-xs">
            <div class="flex flex-col">
              <span class="text-sky-400 font-bold flex items-center gap-1">
                <span>✨</span>
                <span>새로 추가된 인원</span>
              </span>
              <span class="text-zinc-500 text-[11px] font-normal">최근 신규 등록 멤버</span>
            </div>
            <div class="text-right">
              <div class="font-bold text-sm sm:text-base">
                ${newlyAddedCount > 0 ? `<span class="text-zinc-400 text-xs font-normal">신규 </span><strong class="text-sky-300 font-extrabold">${newlyAddedCount}명</strong>` : `<strong class="text-zinc-400">0명</strong>`}
              </div>
              <div class="text-[11px] text-zinc-400 mt-0.5">
                ${newlyAddedCount > 0 ? `보유 구독자: <strong class="text-sky-200 font-bold">${newlyAddedSubText}</strong>${formattedNewlyAdded ? ` (${formattedNewlyAdded.trim()})` : ""}` : `<span class="text-zinc-500">신규 인원 없음</span>`}
              </div>
            </div>
          </div>
        </div>
        <div class="text-zinc-300 text-xs leading-relaxed space-y-1.5 mt-2.5 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60 font-sans">
          ${elapsedSinceLastSync ? `
            <div class="flex items-center gap-2">
              <span class="text-zinc-500">•</span>
              <span><strong>갱신 주기:</strong> 마지막 조회일(${lastSyncDateStr || '이전 기록'}) 기준 <strong class="text-amber-300">${elapsedSinceLastSync}</strong>했습니다.</span>
            </div>
          ` : ''}
          <div class="flex items-center gap-2">
            <span class="text-zinc-500">•</span>
            <span>전체 <strong>${totalCount}명</strong> 중 <strong class="text-emerald-400">${successCount}명</strong> 조회 성공${failedCount > 0 ? `, <strong class="text-rose-400">${failedCount}명</strong> 실패` : ''}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-zinc-500">•</span>
            <span><strong>기존 멤버 구독자:</strong> ${existingIncreasedCount > 0 ? `총 <strong class="text-amber-300">${existingIncreasedCount}명</strong>의 스트리머 구독자가 상승하여, 기존 인원 총 구독자 수가 <strong class="text-emerald-400">${existingIncText}</strong>${formattedExistingInc ? ` (${formattedExistingInc.trim()})` : ''} 증가했습니다.` : `구독자 수 변동이 없습니다.`}</span>
          </div>
          ${topIncreased.length > 0 ? `
            <div class="flex items-start gap-2">
              <span class="text-zinc-500">•</span>
              <span><strong>최다 증가 TOP ${topIncreased.length}:</strong> ${topIncreased.map((it, i) => `<strong class="text-amber-300">${i + 1}위</strong> ${it.streamer}${it.name && it.name !== it.streamer ? `(${it.name})` : ''} <strong class="text-emerald-400">+${it.diff.toLocaleString()}명</strong>`).join(' · ')}</span>
            </div>
          ` : ''}
          <div class="flex items-center gap-2">
            <span class="text-zinc-500">•</span>
            <span><strong>새로 추가된 인원:</strong> 신규 스트리머 <strong class="text-sky-300">${newlyAddedCount}명</strong> (보유 구독자 합계: <strong class="text-sky-300">${newlyAddedSubText}</strong>${formattedNewlyAdded ? ` (${formattedNewlyAdded.trim()})` : ''})이 새롭게 반영되었습니다.</span>
          </div>
        </div>
      `;
      logBox.appendChild(finishLine);
      logBox.scrollTop = logBox.scrollHeight;
    }

    showToast(`${failedCount === 0 ? '🎉' : '📊'} 구독자·팔로워 수 갱신 완료 <span class="text-zinc-300 text-xs">(성공: <strong class="text-emerald-400">${successCount}명</strong> · 기존 구독자: <strong class="text-amber-300">${existingIncText}</strong> (${existingIncreasedCount}명 상승) · 신규: <strong class="text-sky-300">${newlyAddedCount}명</strong>)</span><br><span class="text-[11px] text-amber-300">💾 최신 데이터 자동 백업 완료</span>`);
  } catch (err) {
    document.getElementById("admin-sub-saving-spinner")?.remove();
    console.error("구독자 갱신 오류:", err);
    if (logBox) {
      const errLine = document.createElement("div");
      errLine.className = "text-xs py-2 font-bold text-red-400 border-t border-zinc-800 mt-2";
      errLine.textContent = `❌ 오류 발생: ${err.message || err}`;
      logBox.appendChild(errLine);
    }
    showToast("⚠️ 구독자/팔로워 갱신 중 오류가 발생했습니다.");
  } finally {
    document.getElementById("admin-sub-saving-spinner")?.remove();
    isSyncingSubscribers = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span>구독자·팔로워 수 일괄 재갱신</span>
      `;
    }
  }
}

async function startViewCountSync() {
  if (isSyncingViewCounts) return;

  const btn = document.getElementById("admin-view-sync-btn");
  const progressBar = document.getElementById("admin-view-progress-bar");
  const progressText = document.getElementById("admin-view-progress-text");
  const logBox = document.getElementById("admin-view-log-box");

  isSyncingViewCounts = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>전체 영상 조회수 일괄 갱신 중...</span>
    `;
  }
  if (logBox) logBox.innerHTML = "";

  try {
    let syncFn = typeof executeViewCountSync === "function"
      ? executeViewCountSync
      : (typeof window !== "undefined" && typeof window.executeViewCountSync === "function" ? window.executeViewCountSync : null);

    if (!syncFn) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `./js/viewcount-sync.js?v=${Date.now()}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("viewcount-sync.js 스크립트 파일을 불러오지 못했습니다."));
        document.head.appendChild(s);
      });
      syncFn = typeof executeViewCountSync === "function"
        ? executeViewCountSync
        : (typeof window !== "undefined" && typeof window.executeViewCountSync === "function" ? window.executeViewCountSync : null);
    }

    if (typeof syncFn !== "function") {
      throw new Error("조회수 갱신 모듈(executeViewCountSync)을 찾을 수 없습니다. 브라우저 캐시(Ctrl + F5)를 갱신해주세요.");
    }

    const res = await syncFn((current, total, detailText, status) => {
      if (status === "SAVING_BACKUP") {
        if (progressBar) progressBar.style.width = "100%";
        if (progressText) {
          progressText.innerHTML = `<span class="text-emerald-400 font-bold">100%</span> <span class="text-zinc-500 font-normal">(<strong class="text-zinc-200 font-bold">${total}</strong>/<span class="text-zinc-400">${total}</span>건)</span> <span class="text-zinc-600">·</span> <span class="text-amber-300 font-semibold animate-pulse">MariaDB 및 백업 파일에 반영 중...</span>`;
        }
        if (logBox) {
          let spinner = document.getElementById("admin-view-saving-spinner");
          if (!spinner) {
            spinner = document.createElement("div");
            spinner.id = "admin-view-saving-spinner";
            spinner.className = "p-3.5 my-2.5 bg-zinc-900/95 rounded-xl border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg shadow-black/40";
            spinner.innerHTML = `
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <svg class="animate-spin h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span class="text-amber-300 font-bold text-xs sm:text-[13px]">조회수 저장 및 백업 스냅샷 생성 중...</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-medium">진행 중</span>
                  </div>
                  <p class="text-[11px] text-zinc-400 mt-0.5 truncate">갱신된 영상 조회수 데이터를 MariaDB 및 백업 파일에 안전하게 반영하고 있습니다.</p>
                </div>
              </div>
              <span class="text-[11px] text-amber-400/80 font-mono flex-shrink-0 hidden sm:inline-block">잠시만 기다려주세요...</span>
            `;
            logBox.appendChild(spinner);
            logBox.scrollTop = logBox.scrollHeight;
          }
        }
        return;
      }

      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressText) {
        progressText.innerHTML = `<span class="text-emerald-400 font-bold">${pct}%</span> <span class="text-zinc-500 font-normal">(<strong class="text-zinc-200 font-bold">${current}</strong>/<span class="text-zinc-400">${total}</span>건)</span>`;
      }

      if (logBox) {
        const line = document.createElement("div");
        line.className = "text-xs sm:text-[13px] py-1 font-mono flex items-center justify-between gap-3";
        const isSuccess = status.includes("성공");
        line.innerHTML = `
          <div class="truncate">
            <span class="text-zinc-500">[${current}/${total}]</span>
            <span class="text-zinc-200 font-medium ml-1.5">${detailText}</span>
          </div>
          <span class="flex-shrink-0 ${isSuccess ? 'text-emerald-400 font-bold' : 'text-zinc-400'}">${status}</span>
        `;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
      }
    });

    const savingSpinner = document.getElementById("admin-view-saving-spinner");
    if (savingSpinner) savingSpinner.remove();

    if (res && res.success) {
      if (progressBar) progressBar.style.width = "100%";
      const unavailCount = res.unavailableCount || 0;
      const failCount = res.failedCount || 0;
      const totalIncrease = res.totalIncrease || 0;
      const incText = totalIncrease > 0
        ? `+${totalIncrease.toLocaleString()}회`
        : (totalIncrease === 0 ? "0회 (변동 없음)" : `-${Math.abs(totalIncrease).toLocaleString()}회`);
      const formattedInc = (totalIncrease >= 10000 && typeof formatViewCount === "function")
        ? ` (약 +${formatViewCount(totalIncrease)})`
        : "";

      if (progressText) {
        const incColor = totalIncrease > 0 ? 'text-amber-300' : (totalIncrease < 0 ? 'text-blue-400' : 'text-zinc-400');
        progressText.innerHTML = `<span class="text-emerald-400 font-bold">완료</span> <span class="text-zinc-500 font-normal">(<span class="text-zinc-400 font-normal">성공:</span> <strong class="text-emerald-400 font-bold">${res.updatedCount.toLocaleString()}</strong>건 <span class="text-zinc-600 font-normal">·</span> <span class="text-zinc-400 font-normal">기존 대비 총 증가:</span> <strong class="${incColor} font-bold">${incText}</strong> <span class="text-zinc-600 font-normal">/</span> <span class="text-zinc-400 font-normal">조회불가:</span> <strong class="${unavailCount > 0 ? 'text-amber-400 font-bold' : 'text-zinc-400 font-normal'}">${unavailCount.toLocaleString()}</strong>건 <span class="text-zinc-600 font-normal">/</span> <span class="text-zinc-400 font-normal">실패:</span> <strong class="${failCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400 font-normal'}">${failCount.toLocaleString()}</strong>건<span class="text-zinc-500 font-normal">)</span>`;
      }
      if (logBox) {
        const finishLine = document.createElement("div");
        finishLine.className = "text-xs py-3 font-mono border-t border-zinc-800 mt-2 space-y-2.5";
        const serverStatusMsg = res.hasServer 
          ? (res.backupSynced ? "MariaDB 및 백업 스냅샷에 최신화 저장 완료" : "화면 반영 및 DB 동기화 완료")
          : "브라우저 화면 및 로컬 캐시에 반영 완료 (서버 미연결)";

        finishLine.innerHTML = `
          <div class="text-emerald-400 font-bold flex items-center justify-between flex-wrap gap-2 text-sm">
            <span class="flex items-center gap-1.5">
              <span>🎉</span>
              <span>전체 영상 조회수 일괄 갱신 완료!</span>
            </span>
            <span class="text-xs font-mono text-zinc-400">
              성공: <strong class="text-emerald-400">${res.updatedCount.toLocaleString()}건</strong> · 조회불가: <strong class="text-amber-400">${unavailCount.toLocaleString()}건</strong> · 실패: <strong class="${failCount > 0 ? 'text-red-400 font-bold' : 'text-zinc-400'}">${failCount.toLocaleString()}건</strong>
            </span>
          </div>
          <div class="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-amber-400 font-bold">📈 기존 대비 총 조회수 증가량</span>
              <span class="text-zinc-400 text-[11px] font-normal">(기존 조회수 등록 영상 기준)</span>
            </div>
            <div class="text-right">
              <strong class="text-emerald-400 font-bold text-sm">${incText}</strong>${formattedInc ? `<span class="text-zinc-400 text-xs ml-1.5">${formattedInc}</span>` : ""}
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 bg-zinc-900/90 rounded-xl px-3 border border-zinc-800/80 text-xs">
            <div class="flex items-center justify-between sm:justify-start gap-1.5">
              <span class="text-zinc-400">최신화 성공:</span>
              <strong class="text-emerald-400 font-bold">${res.updatedCount.toLocaleString()}건</strong>
            </div>
            <div class="flex items-center justify-between sm:justify-start gap-1.5">
              <span class="text-zinc-400">조회불가(비공개·삭제):</span>
              <strong class="text-amber-400 font-bold">${unavailCount.toLocaleString()}건</strong>
            </div>
            <div class="flex items-center justify-between sm:justify-start gap-1.5">
              <span class="text-zinc-400">실패(오류):</span>
              <strong class="${failCount > 0 ? 'text-red-400 font-bold' : 'text-zinc-400'}">${failCount.toLocaleString()}건</strong>
            </div>
          </div>
          ${unavailCount > 0 && Array.isArray(res.unavailableList) && res.unavailableList.length > 0 ? `
            <details class="mt-2 text-xs bg-zinc-900/60 rounded-xl border border-zinc-800/80 p-2.5">
              <summary class="cursor-pointer text-amber-400 font-semibold flex items-center justify-between select-none hover:text-amber-300">
                <span class="flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>조회불가(비공개·삭제) 영상 목록 (${unavailCount.toLocaleString()}건) 확인하기</span>
                </span>
                <span class="text-[11px] text-zinc-500 font-normal">클릭하여 펼치기/접기</span>
              </summary>
              <div class="mt-2 max-h-56 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                ${res.unavailableList.map((u, idx) => `
                  <div class="flex items-start justify-between gap-2 p-1.5 rounded bg-zinc-950/70 border border-zinc-800/50">
                    <div class="min-w-0 flex-1 truncate">
                      <span class="text-zinc-500">[${idx + 1}]</span>
                      ${u.streamer ? `<span class="text-emerald-400 font-medium ml-1">[${u.streamer}]</span>` : ''}
                      <span class="text-zinc-200 ml-1" title="${u.title}">${u.title}</span>
                    </div>
                    <div class="flex-shrink-0 flex items-center gap-1.5 text-[10px]">
                      <span class="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">${u.reason || '조회불가'}</span>
                      ${u.url ? `<a href="${u.url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">열기 ↗</a>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </details>
          ` : ''}
          <div class="text-zinc-400 text-[11px] leading-relaxed">
            • 총 <strong>${res.totalCount.toLocaleString()}개</strong> 대상 영상 중 <strong class="text-emerald-400">${res.updatedCount.toLocaleString()}개</strong>의 실시간 조회수가 최신화되었습니다.<br>
            • 기존 조회수가 등록되어 있던 영상 기준, 총 조회수가 <strong class="text-emerald-400">${incText}</strong> 증가했습니다.<br>
            • ${serverStatusMsg}
          </div>
        `;
        logBox.appendChild(finishLine);
        logBox.scrollTop = logBox.scrollHeight;
      }

      const backupToastMsg = res.backupSynced 
        ? `<br><span class="text-[11px] text-amber-300">💾 최신 데이터 자동 백업 완료</span>` 
        : "";
      showToast(`🎉 영상 조회수 일괄 갱신 완료 <span class="text-zinc-300 text-xs">(${res.updatedCount.toLocaleString()}개 · 총 증가: <strong class="text-amber-300">${incText}</strong>)</span><br><span class="text-[11px] text-zinc-300">성공: <strong class="text-emerald-400">${res.updatedCount.toLocaleString()}건</strong> · 조회불가: <strong class="text-amber-400">${unavailCount.toLocaleString()}건</strong> · 실패: <strong class="${failCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}">${failCount.toLocaleString()}건</strong></span>${backupToastMsg}`);
    } else {
      showToast(`⚠️ 조회수 갱신 중 문제가 발생했습니다: ${res?.message || '실패'}`);
    }
  } catch (err) {
    document.getElementById("admin-view-saving-spinner")?.remove();
    console.error("조회수 갱신 오류:", err);
    if (logBox) {
      const errLine = document.createElement("div");
      errLine.className = "text-xs py-2 font-bold text-red-400 border-t border-zinc-800 mt-2";
      errLine.textContent = `❌ 오류 발생: ${err.message || err}`;
      logBox.appendChild(errLine);
    }
    showToast("⚠️ 조회수 갱신 중 오류가 발생했습니다.");
  } finally {
    document.getElementById("admin-view-saving-spinner")?.remove();
    isSyncingViewCounts = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        <span>전체 영상 조회수 재갱신</span>
      `;
    }
  }
}

window.openAdminSettingsModal = openAdminSettingsModal;
window.closeAdminSettingsModal = closeAdminSettingsModal;
window.switchAdminSettingsTab = switchAdminSettingsTab;
window.startSubscriberSync = startSubscriberSync;
window.startViewCountSync = startViewCountSync;
window.renderAdminPage = renderAdminPage;
window.switchAdminPageTab = switchAdminPageTab;



