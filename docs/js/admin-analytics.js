// ==========================================
// 콩밥특별시 관리자 센터 - 방문자 통계 분석 모듈 (Google Analytics 4)
// ==========================================

let cachedAdminAnalyticsData = null;
let isAdminAnalyticsFetching = false;
let adminAnalyticsCooldownUntil = 0;
let currentAnalyticsTopTab = "job"; // "job" | "member" | "all"

const formatNumber = n => (n != null ? Number(n).toLocaleString() : "0");

function formatAnalyticsDuration(sec) {
  sec = Math.round(Number(sec) || 0);
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
}

function renderAnalyticsTabHtml() {
  return `
    <div class="space-y-6">
      <!-- 경고 / 에러 배너 -->
      <div id="admin-analytics-error-banner" class="hidden bg-amber-950/80 border border-amber-800/80 rounded-2xl p-4 text-xs sm:text-sm text-amber-200 flex items-start gap-3 shadow-lg">
        <span class="text-xl flex-shrink-0">⚠️</span>
        <div class="flex-1 space-y-1">
          <div class="font-bold" id="admin-analytics-error-title">통계 데이터 로드 대기</div>
          <div class="text-xs text-amber-300 leading-relaxed" id="admin-analytics-error-desc"></div>
          <div class="text-xs text-zinc-400 pt-0.5" id="admin-analytics-error-hint"></div>
        </div>
      </div>

      <!-- 1. 핵심 KPI 카드 그리드 (6개) -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span>
            <span>주요 방문자 지표 (트래픽 개요)</span>
          </h4>
          <span class="text-[11px] text-zinc-500 font-medium">실시간 및 전체 집계</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <!-- 1. 실시간 접속 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">실시간 접속</span>
              <span class="relative flex h-2.5 w-2.5">
                <span id="kpi-realtime-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 hidden"></span>
                <span id="kpi-realtime-dot" class="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-600"></span>
              </span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-realtime" class="text-2xl sm:text-3xl font-black text-zinc-300 tracking-tight">-</div>
              <p id="kpi-realtime-sub" class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">최근 30분 활동 기준</p>
            </div>
          </div>

          <!-- 2. 오늘 순방문자 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">오늘 순방문자</span>
              <span class="text-sm">📅</span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-today-users" class="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">-</div>
              <p id="kpi-today-sub" class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">신규 - / 재방문 -</p>
            </div>
          </div>

          <!-- 3. 어제 순방문자 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">어제 순방문자</span>
              <span class="text-sm">⏳</span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-yesterday-users" class="text-2xl sm:text-3xl font-black text-zinc-300 tracking-tight">-</div>
              <p id="kpi-yesterday-sub" class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">신규 - / 재방문 -</p>
            </div>
          </div>

          <!-- 4. 전체 누적 방문자 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">전체 누적 방문자</span>
              <span class="text-sm">🏆</span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-total-users" class="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight">-</div>
              <p id="kpi-total-views" class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">총 조회수 -</p>
            </div>
          </div>

          <!-- 5. 평균 체류 시간 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">평균 체류 시간</span>
              <span class="text-sm">⏱️</span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-duration" class="text-2xl sm:text-3xl font-black text-sky-400 tracking-tight">-</div>
              <p id="kpi-sessions" class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">총 세션 -</p>
            </div>
          </div>

          <!-- 6. 이탈률 -->
          <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-md">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-400">이탈률</span>
              <span class="text-sm">🚪</span>
            </div>
            <div class="mt-2 sm:mt-3">
              <div id="kpi-bounce" class="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">-</div>
              <p class="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 truncate">첫 화면 즉시 이탈 비율</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 방문 빈도 & 충성도 분석 -->
      <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-zinc-800/80 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">🍚</span>
            <h4 class="text-sm font-bold text-white">콩밥 시민 방문 빈도 & 재방문 분석</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40">기기 식별 집계</span>
          </div>
          <div class="text-xs text-zinc-400 flex items-center gap-1.5">
            <span>시민 1인당 평균 접속:</span>
            <strong id="kpi-sessions-per-user" class="text-amber-400 font-mono font-bold text-sm">-회</strong>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="bg-zinc-900/60 border border-zinc-800/70 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>새싹 콩밥이 (1회차 첫 방문)</span>
              </div>
              <div id="freq-new-users" class="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">-명</div>
              <div id="freq-new-rate" class="text-[11px] text-zinc-500 mt-0.5">전체의 -% (첫 접속 기기)</div>
            </div>
            <div class="text-3xl opacity-80">🌱</div>
          </div>

          <div class="bg-zinc-900/60 border border-zinc-800/70 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>단골 콩밥이 (2회 이상 재방문)</span>
              </div>
              <div id="freq-return-users" class="text-xl sm:text-2xl font-black text-indigo-400 mt-1 font-mono">-명</div>
              <div id="freq-return-rate" class="text-[11px] text-zinc-500 mt-0.5">재방문율 -% (다시 찾아온 기기)</div>
            </div>
            <div class="text-3xl opacity-80">✨</div>
          </div>

          <div class="bg-zinc-900/60 border border-zinc-800/70 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>1인당 평균 접속 횟수</span>
              </div>
              <div id="freq-avg-sessions" class="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">-회</div>
              <div id="freq-total-sessions" class="text-[11px] text-zinc-500 mt-0.5">총 접속 세션 -회 발생</div>
            </div>
            <div class="text-3xl opacity-80">📈</div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-zinc-800/60 space-y-1.5">
          <div class="flex justify-between text-xs text-zinc-400 font-medium">
            <span>새싹 vs 단골 비율</span>
            <span class="font-mono"><span id="bar-new-percent" class="text-emerald-400 font-bold">-%</span> vs <span id="bar-return-percent" class="text-indigo-400 font-bold">-%</span></span>
          </div>
          <div class="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800/80 p-0.5">
            <div id="progress-new" class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-l-full transition-all duration-500" style="width: 50%;"></div>
            <div id="progress-return" class="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-r-full transition-all duration-500" style="width: 50%;"></div>
          </div>
        </div>
      </div>

      <!-- 3. 직업 / 인원별 조회 통계 (토글 탭) -->
      <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">🔥</span>
            <h4 class="text-sm font-bold text-white">가장 많이 본 페이지 & 직업 / 인원별 조회</h4>
          </div>

          <!-- 토글 버튼 그룹 -->
          <div class="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1 self-start sm:self-auto">
            <button 
              id="admin-top-tab-job" 
              type="button"
              onclick="setAnalyticsTopPageTab('job')" 
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm cursor-pointer"
            >
              🏢 직업별 통계
            </button>
            <button 
              id="admin-top-tab-member" 
              type="button"
              onclick="setAnalyticsTopPageTab('member')" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              👤 인원별 통계
            </button>
            <button 
              id="admin-top-tab-all" 
              type="button"
              onclick="setAnalyticsTopPageTab('all')" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              🌐 전체 URL 목록
            </button>
          </div>
        </div>

        <!-- 렌더링 컨테이너 -->
        <div id="admin-top-pages-container" class="space-y-2">
          <div class="text-xs text-zinc-500 py-8 text-center">통계 데이터를 불러오는 중...</div>
        </div>
      </div>

      <!-- 4. 유입 경로 & 기기 환경 분석 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 유입 경로 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔗</span>
              <span>유입 경로 (Referrer / Source)</span>
            </h4>
            <span class="text-[11px] text-zinc-500">방문자 수 (세션)</span>
          </div>
          <div id="admin-sources-container" class="space-y-2.5">
            <div class="text-xs text-zinc-500 py-6 text-center">불러오는 중...</div>
          </div>
        </div>

        <!-- 기기 & 브라우저 환경 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📱</span>
              <span>접속 기기 & 브라우저 환경</span>
            </h4>
            <span class="text-[11px] text-zinc-500">디바이스 점유율</span>
          </div>
          <div id="admin-devices-container" class="space-y-2.5">
            <div class="text-xs text-zinc-500 py-6 text-center">불러오는 중...</div>
          </div>
        </div>
      </div>

      <!-- 5. 2열 레이아웃: 일자별 추이 & 시간대별 트래픽 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 최근 14일 일자별 방문자 추이 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📅</span>
              <span>최근 14일 일자별 방문자 추이</span>
            </h4>
            <span class="text-[11px] text-zinc-500">방문자 수 / PV</span>
          </div>
          <div id="admin-daily-chart-container" class="space-y-1.5">
            <div class="text-xs text-zinc-500 py-8 text-center">불러오는 중...</div>
          </div>
        </div>

        <!-- 24시간 시간대별 트래픽 분포 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🕐</span>
              <span>24시간 시간대별 트래픽 분포</span>
            </h4>
            <span class="text-[11px] text-zinc-500">시간대별 활성도</span>
          </div>
          <div id="admin-hourly-chart-container" class="space-y-1">
            <div class="text-xs text-zinc-500 py-8 text-center">불러오는 중...</div>
          </div>
        </div>
      </div>

      <!-- 6. 2열 레이아웃: 접속 국가 및 접속 지역/도시 분석 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 접속 국가 분석 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🌍</span>
              <span>접속 국가 (Country)</span>
            </h4>
            <span class="text-[11px] text-zinc-500">방문자 수 (세션)</span>
          </div>
          <div id="admin-countries-container" class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            <div class="text-xs text-zinc-500 py-6 text-center">불러오는 중...</div>
          </div>
        </div>

        <!-- 접속 지역/도시 분석 -->
        <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-md">
          <div class="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
            <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📍</span>
              <span>접속 지역 및 도시 (Region / City)</span>
            </h4>
            <span class="text-[11px] text-zinc-500">방문자 수 (세션)</span>
          </div>
          <div id="admin-cities-container" class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            <div class="text-xs text-zinc-500 py-6 text-center">불러오는 중...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ⚡ 통계 데이터 비동기 요청
async function fetchAdminAnalyticsData(forceRefresh = false) {
  const now = Date.now();
  if (forceRefresh && now < adminAnalyticsCooldownUntil) {
    const remainSec = Math.ceil((adminAnalyticsCooldownUntil - now) / 1000);
    if (typeof showToast === "function") {
      showToast(`⚠️ 쿨다운 중입니다. ${remainSec}초 후에 다시 시도해 주세요.`);
    }
    return;
  }

  if (isAdminAnalyticsFetching) return;
  isAdminAnalyticsFetching = true;

  const refreshBtn = document.getElementById("admin-analytics-refresh-btn");
  const refreshIcon = document.getElementById("admin-analytics-refresh-icon");
  if (refreshIcon) refreshIcon.classList.add("animate-spin");
  if (refreshBtn) refreshBtn.classList.add("opacity-70", "pointer-events-none");

  const errBanner = document.getElementById("admin-analytics-error-banner");
  if (errBanner) errBanner.classList.add("hidden");

  try {
    const authHeaders = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    const query = forceRefresh ? "?refresh=true" : "";
    const apiBase = typeof API_BASE !== "undefined" ? API_BASE : "";
    const res = await fetch(`${apiBase}/api/admin/analytics/summary${query}`, {
      headers: authHeaders,
      credentials: "include"
    });

    if (res.status === 401) {
      showAnalyticsErrorBanner("관리자 인증 실패", "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !data.success) {
      showAnalyticsErrorBanner(
        data?.message || `조회 실패 (HTTP ${res.status})`, 
        data?.hint || "백엔드(Spring Boot 8080) 서버 상태를 확인해 주세요."
      );
      return;
    }

    if (forceRefresh) {
      adminAnalyticsCooldownUntil = Date.now() + 10000; // 10초 쿨다운
    }

    renderAdminAnalyticsData(data);
  } catch (err) {
    console.warn("방문자 통계 로드 실패 (정적 배포 또는 백엔드 미실행):", err);
    showAnalyticsErrorBanner(
      "백엔드 서버(Spring Boot) 미연결 상태",
      "방문자 종합 통계는 로컬 Spring Boot 서버(8080)가 실행된 환경에서 구글 애널리틱스 4 API와 실시간 통신하여 제공됩니다. 외부 배포 환경에서는 백엔드 실행 시 최신 통계를 확인하실 수 있습니다."
    );
  } finally {
    isAdminAnalyticsFetching = false;
    if (refreshIcon) refreshIcon.classList.remove("animate-spin");
    if (refreshBtn) refreshBtn.classList.remove("opacity-70", "pointer-events-none");
  }
}

function showAnalyticsErrorBanner(title, desc, hint = "") {
  const banner = document.getElementById("admin-analytics-error-banner");
  const titleEl = document.getElementById("admin-analytics-error-title");
  const descEl = document.getElementById("admin-analytics-error-desc");
  const hintEl = document.getElementById("admin-analytics-error-hint");

  if (banner && titleEl && descEl) {
    titleEl.textContent = title;
    descEl.textContent = desc;
    if (hintEl) hintEl.textContent = hint ? `💡 조치: ${hint}` : "";
    banner.classList.remove("hidden");
  }
}

function renderAdminAnalyticsData(data) {
  cachedAdminAnalyticsData = data;
  const headerTime = document.getElementById("admin-analytics-updated-at");
  if (headerTime) headerTime.textContent = `최근 갱신: ${data.updatedAt ? escapeHtml(data.updatedAt) : '방금'}`;

  const ov = data.overview || {};
  const today = data.today || {};
  const yest = data.yesterday || {};

  // 실시간 접속자
  const rtCount = Number(data.realtimeUsers) || 0;
  const elRt = document.getElementById("kpi-realtime");
  const subRt = document.getElementById("kpi-realtime-sub");
  const pingRt = document.getElementById("kpi-realtime-ping");
  const dotRt = document.getElementById("kpi-realtime-dot");

  if (elRt) elRt.textContent = `${formatNumber(rtCount)}명`;
  if (rtCount > 0) {
    if (elRt) elRt.className = "text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight";
    if (subRt) subRt.textContent = "현재 활성 접속 중 🟢";
    if (pingRt) pingRt.classList.remove("hidden");
    if (dotRt) dotRt.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500";
  } else {
    if (elRt) elRt.className = "text-2xl sm:text-3xl font-black text-zinc-300 tracking-tight";
    if (subRt) subRt.textContent = "최근 30분 기준 (대기 중)";
    if (pingRt) pingRt.classList.add("hidden");
    if (dotRt) dotRt.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-600";
  }

  // 오늘 / 어제 / 전체 누적
  const elTodayUsers = document.getElementById("kpi-today-users");
  const elTodaySub = document.getElementById("kpi-today-sub");
  if (elTodayUsers) elTodayUsers.textContent = `${formatNumber(today.users)}명`;
  if (elTodaySub) elTodaySub.textContent = `신규 ${formatNumber(today.newUsers)}명 / 재방문 ${formatNumber(today.returningUsers)}명`;

  const elYestUsers = document.getElementById("kpi-yesterday-users");
  const elYestSub = document.getElementById("kpi-yesterday-sub");
  if (elYestUsers) elYestUsers.textContent = `${formatNumber(yest.users)}명`;
  if (elYestSub) elYestSub.textContent = `신규 ${formatNumber(yest.newUsers)}명 / 재방문 ${formatNumber(yest.returningUsers)}명`;

  const elTotalUsers = document.getElementById("kpi-total-users");
  const elTotalViews = document.getElementById("kpi-total-views");
  if (elTotalUsers) elTotalUsers.textContent = `${formatNumber(ov.totalUsers)}명`;
  if (elTotalViews) elTotalViews.textContent = `총 조회수 ${formatNumber(ov.pageViews)}회`;

  const elDuration = document.getElementById("kpi-duration");
  const elSessions = document.getElementById("kpi-sessions");
  if (elDuration) elDuration.textContent = formatAnalyticsDuration(ov.avgDurationSeconds);
  if (elSessions) elSessions.textContent = `총 세션 ${formatNumber(ov.sessions)}회`;

  const elBounce = document.getElementById("kpi-bounce");
  if (elBounce) elBounce.textContent = `${ov.bounceRate || 0}%`;

  // 방문 빈도 & 충성도
  renderAdminLoyalty(ov);
  renderAdminTopPages(data.topPages || []);
  renderAdminDailyChart(data.dailyStats || []);
  renderAdminHourlyChart(data.hourlyStats || []);
  renderAdminSources(data.sources || []);
  renderAdminDevices(data.devices || []);
  renderAdminCountries(data.countries || []);
  renderAdminCities(data.cities || []);
}

function renderAdminLoyalty(ov) {
  const totalU = Number(ov.totalUsers) || 0;
  const newU = Number(ov.newUsers) || 0;
  const returnU = Number(ov.returningUsers) || 0;
  const totalSess = Number(ov.sessions) || 0;
  const avgSess = ov.sessionsPerUser != null ? ov.sessionsPerUser : (totalU > 0 ? (Math.round((totalSess / totalU) * 10) / 10) : 0);
  const returnRate = ov.returnRate != null ? ov.returnRate : (totalU > 0 ? (Math.round((returnU / totalU * 100) * 10) / 10) : 0);
  const newRate = totalU > 0 ? (Math.round((newU / totalU * 100) * 10) / 10) : 0;

  const elAvg = document.getElementById("kpi-sessions-per-user");
  if (elAvg) elAvg.textContent = `${avgSess}회`;

  const elNewU = document.getElementById("freq-new-users");
  if (elNewU) elNewU.textContent = `${formatNumber(newU)}명`;

  const elNewRate = document.getElementById("freq-new-rate");
  if (elNewRate) elNewRate.textContent = `전체의 ${newRate}% (첫 접속 기기)`;

  const elReturnU = document.getElementById("freq-return-users");
  if (elReturnU) elReturnU.textContent = `${formatNumber(returnU)}명`;

  const elReturnRate = document.getElementById("freq-return-rate");
  if (elReturnRate) elReturnRate.textContent = `재방문율 ${returnRate}% (다시 찾아온 기기)`;

  const elAvgSess = document.getElementById("freq-avg-sessions");
  if (elAvgSess) elAvgSess.textContent = `평균 ${avgSess}회`;

  const elTotalSess = document.getElementById("freq-total-sessions");
  if (elTotalSess) elTotalSess.textContent = `총 접속 세션 ${formatNumber(totalSess)}회 발생`;

  const elBarNew = document.getElementById("bar-new-percent");
  if (elBarNew) elBarNew.textContent = `${newRate}%`;

  const elBarReturn = document.getElementById("bar-return-percent");
  if (elBarReturn) elBarReturn.textContent = `${returnRate}%`;

  const progNew = document.getElementById("progress-new");
  const progReturn = document.getElementById("progress-return");
  if (progNew && progReturn) {
    if (totalU > 0) {
      progNew.style.width = `${newRate}%`;
      progReturn.style.width = `${returnRate}%`;
    } else {
      progNew.style.width = `50%`;
      progReturn.style.width = `50%`;
    }
  }
}

let adminTopPagesShowAll = false;

function toggleAnalyticsTopPagesShowAll() {
  adminTopPagesShowAll = !adminTopPagesShowAll;
  if (cachedAdminAnalyticsData && cachedAdminAnalyticsData.topPages) {
    renderAdminTopPages(cachedAdminAnalyticsData.topPages);
  }
}
window.toggleAnalyticsTopPagesShowAll = toggleAnalyticsTopPagesShowAll;

function setAnalyticsTopPageTab(tab) {
  currentAnalyticsTopTab = tab;
  adminTopPagesShowAll = false;
  const jobBtn = document.getElementById("admin-top-tab-job");
  const memberBtn = document.getElementById("admin-top-tab-member");
  const allBtn = document.getElementById("admin-top-tab-all");

  const activeClass = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm cursor-pointer";
  const inactiveClass = "px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer";

  if (jobBtn) jobBtn.className = tab === 'job' ? activeClass : inactiveClass;
  if (memberBtn) memberBtn.className = tab === 'member' ? activeClass : inactiveClass;
  if (allBtn) allBtn.className = tab === 'all' ? activeClass : inactiveClass;

  if (cachedAdminAnalyticsData && cachedAdminAnalyticsData.topPages) {
    renderAdminTopPages(cachedAdminAnalyticsData.topPages);
  }
}

function renderAdminTopPages(list) {
  const container = document.getElementById("admin-top-pages-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-8 text-center">페이지 조회 기록이 없습니다.</div>`;
    return;
  }

  if (currentAnalyticsTopTab === 'job') {
    renderAdminTopPagesJob(list, container);
  } else if (currentAnalyticsTopTab === 'member') {
    renderAdminTopPagesMember(list, container);
  } else {
    renderAdminTopPagesAll(list, container);
  }
}

const ANALYTICS_CATEGORY_META = {
  police: { name: "경찰", emoji: "👮‍♂️", badgeClass: "bg-blue-950/80 text-blue-300 border-blue-600/40" },
  ems: { name: "EMS", emoji: "🚑", badgeClass: "bg-teal-950/80 text-teal-300 border-teal-600/40" },
  gang: { name: "갱단", emoji: "💀", badgeClass: "bg-rose-950/80 text-rose-300 border-rose-600/40" },
  business: { name: "사업체", emoji: "🏢", badgeClass: "bg-amber-950/80 text-amber-300 border-amber-600/40" },
  press: { name: "기자", emoji: "📰", badgeClass: "bg-sky-950/80 text-sky-300 border-sky-600/40" },
  citizen: { name: "시민", emoji: "👥", badgeClass: "bg-purple-950/80 text-purple-300 border-purple-600/40" },
  guide: { name: "가이드", emoji: "🧭", badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-600/40" },
  loveline: { name: "러브라인", emoji: "💕", badgeClass: "bg-pink-950/80 text-pink-300 border-pink-600/40" }
};

let _analyticsMemberMap = null;
function getAnalyticsMember(memberId) {
  if (!memberId) return null;
  if (!_analyticsMemberMap) {
    _analyticsMemberMap = new Map();
    if (typeof KONGBAP_DATA !== "undefined" && Array.isArray(KONGBAP_DATA?.categories)) {
      for (const c of KONGBAP_DATA.categories) {
        const mems = typeof getCategoryMembers === "function" ? getCategoryMembers(c) : (c.members || []);
        for (const m of mems) {
          if (m && m.id) {
            _analyticsMemberMap.set(String(m.id).toLowerCase(), m);
          }
        }
      }
    }
  }
  return _analyticsMemberMap.get(String(memberId).toLowerCase()) || null;
}

function formatAdminPageHierarchy(item) {
  let path = item.path || "";
  if (path === "/kongbap/" || path === "/" || path === "/kongbap" || path === "/index.html") {
    return { badge: "🏠 메인", badgeClass: "bg-indigo-950/80 text-indigo-300 border-indigo-600/40", title: "콩밥특별시 메인 홈", isMember: false, catKey: "main" };
  }

  let cat = item.category;
  let group = item.group;
  let member = item.member;
  let search = item.search;

  if (!cat && !member && path.includes("?")) {
    try {
      const qs = path.split("?")[1];
      const sp = new URLSearchParams(qs);
      cat = sp.get("category");
      group = sp.get("group");
      member = sp.get("member");
      search = sp.get("search");
    } catch (e) {}
  }

  if (cat && cat.includes("?")) cat = cat.split("?")[0];
  if (member && member.includes("?")) member = member.split("?")[0];
  if (group && group.includes("?")) group = group.split("?")[0];
  if (search && search.includes("?")) search = search.split("?")[0];

  if (search) {
    return { badge: "🔍 검색", badgeClass: "bg-amber-950/80 text-amber-300 border-amber-600/40", title: `"${escapeHtml(search)}" 검색`, isMember: false, catKey: "search" };
  }

  const cInfo = ANALYTICS_CATEGORY_META[cat] || { name: cat || "기타", emoji: "📁", badgeClass: "bg-zinc-800 text-zinc-300 border-zinc-700" };

  if (member) {
    let memberName = item.title || member;
    const found = getAnalyticsMember(member);
    if (found) {
      memberName = found.name ? `${found.name} (${found.streamer || ''})` : (found.streamer || member);
    }
    return {
      badge: `${cInfo.emoji} ${cInfo.name}`,
      badgeClass: cInfo.badgeClass,
      title: memberName,
      isMember: true,
      memberId: member,
      catKey: cat || "other"
    };
  }

  return {
    badge: `${cInfo.emoji} ${cInfo.name}`,
    badgeClass: cInfo.badgeClass,
    title: `${cInfo.name} 전체 목록`,
    isMember: false,
    catKey: cat || "other"
  };
}

function getAnalyticsMaxMetric(list, key = "users") {
  if (!list || list.length === 0) return 1;
  let max = 1;
  for (let i = 0; i < list.length; i++) {
    const val = Number(list[i][key]) || 0;
    if (val > max) max = val;
  }
  return max;
}

function renderAdminTopPagesJob(list, container) {
  const catStats = {};
  list.forEach(item => {
    const info = formatAdminPageHierarchy(item);
    const key = info.catKey;
    if (!catStats[key]) {
      catStats[key] = {
        name: ANALYTICS_CATEGORY_META[key]?.name || (key === 'main' ? '메인 홈' : (key === 'search' ? '검색' : '기타')),
        emoji: ANALYTICS_CATEGORY_META[key]?.emoji || (key === 'main' ? '🏠' : (key === 'search' ? '🔍' : '📁')),
        badgeClass: ANALYTICS_CATEGORY_META[key]?.badgeClass || 'bg-zinc-800 text-zinc-300 border-zinc-700',
        views: 0,
        users: 0
      };
    }
    catStats[key].views += Number(item.views) || 0;
    catStats[key].users += Number(item.users) || 0;
  });

  const sorted = Object.values(catStats).sort((a, b) => b.views - a.views);
  const maxViews = getAnalyticsMaxMetric(sorted, "views");

  container.innerHTML = sorted.map((cat, idx) => {
    const percent = Math.min(100, Math.max(4, Math.round((cat.views / maxViews) * 100)));
    return `
      <div class="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-5 h-5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
          <span class="text-sm">${cat.emoji}</span>
          <span class="font-bold text-white text-sm truncate">${escapeHtml(cat.name)}</span>
        </div>
        <div class="flex items-center gap-3 flex-1">
          <div class="flex-1 h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full" style="width: ${percent}%;"></div>
          </div>
          <span class="font-bold text-amber-400 font-mono w-24 text-right flex-shrink-0">${formatNumber(cat.views)} PV</span>
          <span class="text-zinc-400 font-mono w-16 text-right flex-shrink-0">${formatNumber(cat.users)}명</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminTopPagesMember(list, container) {
  const memberStats = {};
  list.forEach(item => {
    const info = formatAdminPageHierarchy(item);
    if (!info.isMember) return;
    const key = String(info.memberId || info.title).toLowerCase();
    if (!memberStats[key]) {
      memberStats[key] = {
        title: info.title,
        badge: info.badge,
        badgeClass: info.badgeClass,
        views: 0,
        users: 0
      };
    }
    memberStats[key].views += Number(item.views) || 0;
    memberStats[key].users += Number(item.users) || 0;
  });

  const sorted = Object.values(memberStats).sort((a, b) => b.views - a.views);
  if (sorted.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-8 text-center">인원 상세 조회 기록이 아직 없습니다.</div>`;
    return;
  }

  const maxViews = getAnalyticsMaxMetric(sorted, "views");
  const displayList = adminTopPagesShowAll ? sorted : sorted.slice(0, 10);
  const hasMore = sorted.length > 10;

  const itemsHtml = displayList.map((mem, idx) => {
    const percent = Math.min(100, Math.max(4, Math.round((mem.views / maxViews) * 100)));
    return `
      <div class="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-5 h-5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded border ${mem.badgeClass} flex-shrink-0">${mem.badge}</span>
          <span class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(mem.title)}</span>
        </div>
        <div class="flex items-center gap-3 flex-1">
          <div class="flex-1 h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style="width: ${percent}%;"></div>
          </div>
          <span class="font-bold text-amber-400 font-mono w-24 text-right flex-shrink-0">${formatNumber(mem.views)} PV</span>
          <span class="text-zinc-400 font-mono w-16 text-right flex-shrink-0">${formatNumber(mem.users)}명</span>
        </div>
      </div>
    `;
  }).join('');

  let moreBtnHtml = "";
  if (hasMore) {
    moreBtnHtml = `
      <div class="pt-2 text-center">
        <button 
          type="button" 
          onclick="toggleAnalyticsTopPagesShowAll()" 
          class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
        >
          <span>${adminTopPagesShowAll ? '▲ 상위 10개만 접기' : `▼ 전체 ${sorted.length}명 모두 펼치기 (11위 ~ ${sorted.length}위)`}</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = itemsHtml + moreBtnHtml;
}

function renderAdminTopPagesAll(list, container) {
  const maxViews = getAnalyticsMaxMetric(list, "views");
  const displayList = adminTopPagesShowAll ? list : list.slice(0, 10);
  const hasMore = list.length > 10;

  const itemsHtml = displayList.map((item, idx) => {
    const percent = Math.min(100, Math.max(3, Math.round(((item.views || 0) / maxViews) * 100)));
    const info = formatAdminPageHierarchy(item);
    return `
      <div class="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-5 h-5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded border ${info.badgeClass} flex-shrink-0">${info.badge}</span>
          <span class="font-medium text-zinc-200 truncate" title="${escapeHtml(item.path)}">${escapeHtml(info.title)}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          <span class="font-bold text-amber-400 font-mono">${formatNumber(item.views)} PV</span>
          <span class="text-zinc-500 font-mono text-[11px]">(${formatNumber(item.users)}명)</span>
        </div>
      </div>
    `;
  }).join('');

  let moreBtnHtml = "";
  if (hasMore) {
    moreBtnHtml = `
      <div class="pt-2 text-center">
        <button 
          type="button" 
          onclick="toggleAnalyticsTopPagesShowAll()" 
          class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
        >
          <span>${adminTopPagesShowAll ? '▲ 상위 10개만 접기' : `▼ 전체 ${list.length}개 URL 모두 펼치기 (11위 ~ ${list.length}위)`}</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = itemsHtml + moreBtnHtml;
}

function renderAdminDailyChart(list) {
  const container = document.getElementById("admin-daily-chart-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">수집된 일별 통계가 없습니다.</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");
  const reversed = list.slice().reverse();

  container.innerHTML = reversed.map(item => {
    const percent = Math.min(100, Math.max(3, Math.round(((item.users || 0) / maxUsers) * 100)));
    return `
      <div class="flex items-center gap-2.5 text-xs py-1.5 px-2 rounded-lg hover:bg-zinc-900 transition-colors">
        <span class="w-20 font-mono text-zinc-400 text-[11px] flex-shrink-0">${escapeHtml(item.date)}</span>
        <div class="flex-1 h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
          <div class="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-emerald-400 rounded-full" style="width: ${percent}%;"></div>
        </div>
        <span class="font-bold text-white text-[11px] font-mono w-16 text-right">${formatNumber(item.users)}명</span>
        <span class="text-[10px] text-zinc-500 font-mono w-16 text-right">(${formatNumber(item.views)} PV)</span>
      </div>
    `;
  }).join('');
}

function renderAdminHourlyChart(list) {
  const container = document.getElementById("admin-hourly-chart-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">시간대별 통계가 없습니다.</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");

  container.innerHTML = list.map(item => {
    const percent = Math.min(100, Math.max(2, Math.round(((item.users || 0) / maxUsers) * 100)));
    const isPeak = item.users === maxUsers && maxUsers > 0;
    return `
      <div class="flex items-center gap-2 text-xs py-0.5 px-2 rounded hover:bg-zinc-900 transition-colors ${isPeak ? 'bg-amber-950/20' : ''}">
        <span class="w-10 font-mono ${isPeak ? 'text-amber-400 font-bold' : 'text-zinc-400'} text-[11px] flex-shrink-0">${escapeHtml(item.hour)}</span>
        <div class="flex-1 h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
          <div class="h-full ${isPeak ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-indigo-500'} rounded-full" style="width: ${percent}%;"></div>
        </div>
        <span class="font-mono text-right text-[11px] w-14 ${isPeak ? 'text-amber-300 font-bold' : 'text-zinc-300'}">${formatNumber(item.users)}명</span>
      </div>
    `;
  }).join('');
}

function renderAdminSources(list) {
  const container = document.getElementById("admin-sources-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">수집된 유입 경로가 없습니다. (직접 접속, 검색, 외부 링크 등)</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");

  container.innerHTML = list.map((item, idx) => {
    const percent = Math.min(100, Math.max(4, Math.round(((item.users || 0) / maxUsers) * 100)));
    const safeName = escapeHtml(item.name);
    return `
      <div class="space-y-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-medium text-zinc-200 flex items-center gap-1.5 truncate">
            <span class="w-4 h-4 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
            <span class="truncate" title="${safeName}">${safeName}</span>
          </span>
          <span class="font-bold text-white flex-shrink-0 ml-2">${formatNumber(item.users)}명 <span class="text-[10px] text-zinc-500">(${formatNumber(item.sessions)}세션)</span></span>
        </div>
        <div class="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminDevices(list) {
  const container = document.getElementById("admin-devices-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">기기 데이터가 없습니다.</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");

  container.innerHTML = list.map(item => {
    const percent = Math.min(100, Math.max(4, Math.round(((item.users || 0) / maxUsers) * 100)));
    const safeName = escapeHtml(item.name);
    const icon = safeName.toLowerCase().includes("mobile") ? "📱 모바일" : (safeName.toLowerCase().includes("desktop") ? "💻 데스크톱" : "📱 태블릿/기타");
    return `
      <div class="space-y-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-medium text-zinc-200 flex items-center gap-1.5">
            <span>${icon}</span>
            <span class="text-zinc-400 font-mono text-[11px]">(${safeName})</span>
          </span>
          <span class="font-bold text-white">${formatNumber(item.users)}명 <span class="text-[10px] text-zinc-500">(${formatNumber(item.sessions)}세션)</span></span>
        </div>
        <div class="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
          <div class="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminCountries(list) {
  const container = document.getElementById("admin-countries-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">수집된 국가 데이터가 없습니다.</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");

  container.innerHTML = list.map((item, idx) => {
    const percent = Math.min(100, Math.max(4, Math.round(((item.users || 0) / maxUsers) * 100)));
    const safeName = escapeHtml(item.name || item.rawName || '기타');
    return `
      <div class="space-y-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-medium text-zinc-200 flex items-center gap-1.5 truncate">
            <span class="w-4 h-4 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
            <span class="truncate font-semibold text-zinc-100" title="${safeName}">${safeName}</span>
          </span>
          <span class="font-bold text-white flex-shrink-0 ml-2">${formatNumber(item.users)}명 <span class="text-[10px] text-zinc-500">(${formatNumber(item.sessions)}세션)</span></span>
        </div>
        <div class="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
          <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminCities(list) {
  const container = document.getElementById("admin-cities-container");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 py-6 text-center">수집된 지역 및 도시 데이터가 없습니다.</div>`;
    return;
  }
  const maxUsers = getAnalyticsMaxMetric(list, "users");

  container.innerHTML = list.map((item, idx) => {
    const percent = Math.min(100, Math.max(4, Math.round(((item.users || 0) / maxUsers) * 100)));
    const safeName = escapeHtml(item.name || item.rawName || '기타');
    return `
      <div class="space-y-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-medium text-zinc-200 flex items-center gap-1.5 truncate">
            <span class="w-4 h-4 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] flex items-center justify-center font-bold flex-shrink-0">${idx + 1}</span>
            <span class="truncate font-semibold text-zinc-100" title="${safeName}">${safeName}</span>
          </span>
          <span class="font-bold text-white flex-shrink-0 ml-2">${formatNumber(item.users)}명 <span class="text-[10px] text-zinc-500">(${formatNumber(item.sessions)}세션)</span></span>
        </div>
        <div class="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
          <div class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// 하위 호환 및 글로벌 노출
function openAnalyticsDashboard() {
  if (typeof selectAdminPage === "function") {
    selectAdminPage('analytics');
    return;
  }
  window.open('./analytics.html', '_blank', 'noopener,noreferrer');
}

window.openAnalyticsDashboard = openAnalyticsDashboard;
window.openAnalyticsModal = openAnalyticsDashboard;
window.renderAnalyticsTabHtml = renderAnalyticsTabHtml;
window.fetchAdminAnalyticsData = fetchAdminAnalyticsData;
window.setAnalyticsTopPageTab = setAnalyticsTopPageTab;
