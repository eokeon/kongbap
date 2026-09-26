/**
 * leaderboard.js
 * 콩밥 아카이브 명예의 전당 & 전체 통계
 */

let currentLeaderboardTab = 'total'; // 'total' | 'views' | 'subscriber' | 'clip' | 'full' | 'binge'
let leaderboardSearchQuery = '';

// 무한 스크롤(Lazy loading) 페이징 상태 관리 (초기 10위까지 표시 후 스크롤 시 10개씩 로딩)
let leaderboardVisibleCount = 10;
const LEADERBOARD_PAGE_SIZE = 10;
let currentLeaderboardSortedMembers = [];
let currentLeaderboardTableMembers = [];
let currentLeaderboardTableOffset = 0;
let currentLeaderboardMaxVal = 1;
let leaderboardObserver = null;
let isLoadingLeaderboardMore = false;
let leaderboardScrollListenerAttached = false;
let leaderboardScrollRafId = null;
let onLeaderboardScrollHandler = null;

// 전체 멤버 목록 및 통계 데이터 추출
let cachedLeaderboardMembers = null;
let cachedGlobalStats = null;

function invalidateLeaderboardCache() {
  cachedLeaderboardMembers = null;
  cachedGlobalStats = null;
}
window.invalidateLeaderboardCache = invalidateLeaderboardCache;

// 전체 멤버 목록 및 통계 데이터 추출 (고유 스트리머 기준 중복 제거 및 겸직 소속 병합)
function getAllMembersWithLeaderboardStats() {
  if (cachedLeaderboardMembers) return cachedLeaderboardMembers;
  if (!KONGBAP_DATA || !KONGBAP_DATA.categories) return [];

  const memberMap = new Map();

  KONGBAP_DATA.categories.forEach(cat => {
    const processMember = (m, group) => {
      if (!m) return;
      const key = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
      if (!key) return;

      if (!memberMap.has(key)) {
        memberMap.set(key, computeMemberLeaderboardStats(m, cat, group));
      } else {
        // 이미 등록된 멤버인 경우 (겸직 등으로 여러 카테고리에 속한 경우)
        // 통계 수치는 중복 합산하지 않고, 소속 명칭만 보강 병합
        const existing = memberMap.get(key);
        const currentAffName = group ? `${group.emoji || ''} ${group.name}`.trim() : `${cat.emoji || ''} ${cat.name}`.trim();
        if (currentAffName && existing.displayAffiliation && !existing.displayAffiliation.includes(currentAffName)) {
          existing.displayAffiliation = `${existing.displayAffiliation} · ${currentAffName}`;
        }
        // 직책(role)이 기존에 비어있고 현재 m의 해당 소속에 있다면 보강 병합
        if (!existing.role) {
          const currentAff = Array.isArray(m.affiliations)
            ? m.affiliations.find(a => a.category === cat.id && (!group || a.subgroup === group.id))
            : null;
          let r = currentAff?.role ? String(currentAff.role).trim() : (!Array.isArray(m.affiliations) ? (m.role || '') : '');
          if (r) {
            existing.role = r;
          }
        }
        // 추가 직책(swatRole)이 기존에 비어있고 현재 m의 해당 소속에 있다면 보강 병합
        if (!existing.swatRole) {
          const currentAff = Array.isArray(m.affiliations)
            ? m.affiliations.find(a => a.category === cat.id && (!group || a.subgroup === group.id))
            : null;
          let sRole = currentAff?.swatRole ? String(currentAff.swatRole).trim() : (!Array.isArray(m.affiliations) ? (m.swatRole || '') : '');
          if (sRole) {
            existing.swatRole = sRole.replace(/순직|사직|면직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
          }
        }
        // 구독자 수가 기존에 없거나 0이고 현재 m에 있다면 보강 병합
        if ((!existing.subCount || existing.subCount === 0) && (m.subscriberCount || (typeof getCachedSubscriber === "function" && getCachedSubscriber(m.id)))) {
          const effectiveSub = (typeof getCachedSubscriber === "function" ? getCachedSubscriber(m.id) : null) || m.subscriberCount || '';
          const sc = typeof parseSubscriberCount === "function" ? parseSubscriberCount(effectiveSub) : 0;
          if (sc > 0) {
            existing.subCount = sc;
            existing.subscriberCount = effectiveSub;
          }
        }
      }
    };

    if (!cat.hasSubgroups) {
      (cat.members || []).forEach(m => processMember(m, null));
    } else {
      (cat.groups || []).forEach(g => {
        (g.members || []).forEach(m => processMember(m, g));
      });
    }
  });

  cachedLeaderboardMembers = Array.from(memberMap.values());
  return cachedLeaderboardMembers;
}

function computeMemberLeaderboardStats(m, cat, group) {
  // 유효한 비디오 필터링 및 단일 패스 통계 집계 (동일 URL 중복 등록 방지)
  const seenUrls = new Set();
  const rawVideos = m.videos || [];
  let clipCount = 0;
  let fullCount = 0;
  let bingeCount = 0;
  let totalCount = 0;
  let clipSec = 0;
  let fullSec = 0;
  let bingeSec = 0;
  let clipViews = 0;
  let fullViews = 0;
  let bingeViews = 0;
  let totalViews = 0;

  for (let i = 0; i < rawVideos.length; i++) {
    const v = rawVideos[i];
    if (!v || !v.url || v.url === "undefined" || !v.url.trim()) continue;
    const vKey = (v.url || v.id || '').trim().toLowerCase();
    if (vKey && seenUrls.has(vKey)) continue;
    if (vKey) seenUrls.add(vKey);

    totalCount++;
    const type = typeof getVideoType === "function" ? getVideoType(v) : 'clip';
    const sec = typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0;
    const rawViews = Number(v.viewCount);
    const vViews = (!isNaN(rawViews) && rawViews > 0) ? rawViews : 0;
    totalViews += vViews;

    if (type === 'binge') {
      bingeCount++;
      bingeSec += sec;
      bingeViews += vViews;
    } else if (type === 'full') {
      fullCount++;
      fullSec += sec;
      fullViews += vViews;
    } else {
      clipCount++;
      clipSec += sec;
      clipViews += vViews;
    }
  }

  const totalSec = clipSec + fullSec + bingeSec;

  // 소속 텍스트 생성 (겸직 다중 소속 반영)
  let displayAffiliation = group ? `${group.emoji || ''} ${group.name}`.trim() : `${cat.emoji || ''} ${cat.name}`.trim();
  if (Array.isArray(m.affiliations) && m.affiliations.length > 1 && KONGBAP_DATA && Array.isArray(KONGBAP_DATA.categories)) {
    const allNames = m.affiliations.map(a => {
      const c = KONGBAP_DATA.categories.find(cItem => cItem.id === a.category);
      if (!c) return a.category;
      if (c.hasSubgroups) {
        const g = (c.groups || []).find(grp => grp.id === a.subgroup);
        return g ? `${g.emoji || ''} ${g.name}`.trim() : `${c.emoji || ''} ${c.name}`.trim();
      }
      return `${c.emoji || ''} ${c.name}`.trim();
    });
    const uniqueAffs = Array.from(new Set(allNames.filter(Boolean)));
    if (uniqueAffs.length > 0) {
      displayAffiliation = uniqueAffs.join(' · ');
    }
  }

  // role 보강 (해당 소속 aff.role 또는 레거시 m.role 확인, 타 소속 직위 절대 상속 금지)
  let memberRole = "";
  let memberSwatRole = "";
  if (Array.isArray(m.affiliations) && m.affiliations.length > 0) {
    const currentAff = m.affiliations.find(a => a.category === cat.id && (!group || a.subgroup === group.id));
    if (currentAff) {
      memberRole = (currentAff.role != null) ? String(currentAff.role).trim() : "";
      memberSwatRole = (currentAff.swatRole != null) ? String(currentAff.swatRole).trim() : "";
    }
  } else {
    memberRole = (m.role != null) ? String(m.role).trim() : "";
    memberSwatRole = (m.swatRole != null) ? String(m.swatRole).trim() : "";
  }
  if (memberSwatRole) {
    memberSwatRole = memberSwatRole.replace(/순직|사직|면직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
  }

  // 구독자 수 파싱 (캐시 또는 m.subscriberCount 기준)
  const effectiveSubStr = (typeof getCachedSubscriber === "function" ? getCachedSubscriber(m.id) : null) || m.subscriberCount || '';
  const subCount = typeof parseSubscriberCount === "function" ? parseSubscriberCount(effectiveSubStr) : 0;

  return {
    ...m,
    role: memberRole,
    swatRole: memberSwatRole,
    subscriberCount: effectiveSubStr,
    subCount,
    catId: cat.id,
    catName: cat.name,
    catColor: cat.color || 'blue',
    catEmoji: cat.emoji || '',
    catBadge: cat.badge || cat.name,
    groupId: group ? group.id : null,
    groupName: group ? group.name : null,
    groupEmoji: group ? (group.emoji || '') : '',
    displayAffiliation,
    streamerName: m.streamer || m.streamerName || '',
    totalCount,
    clipCount,
    fullCount,
    bingeCount,
    totalSec,
    clipSec,
    fullSec,
    bingeSec,
    totalDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분",
    clipDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipSec) : "0분",
    fullDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullSec) : "0분",
    bingeDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeSec) : "0분",
    clipViews,
    fullViews,
    bingeViews,
    totalViews,
    clipViewsStr: typeof formatViewCount === "function" ? (formatViewCount(clipViews) || "0회") : `${clipViews.toLocaleString()}회`,
    fullViewsStr: typeof formatViewCount === "function" ? (formatViewCount(fullViews) || "0회") : `${fullViews.toLocaleString()}회`,
    bingeViewsStr: typeof formatViewCount === "function" ? (formatViewCount(bingeViews) || "0회") : `${bingeViews.toLocaleString()}회`,
    totalViewsStr: typeof formatViewCount === "function" ? (formatViewCount(totalViews) || "0회") : `${totalViews.toLocaleString()}회`,
  };
}

// 전체 종합 메트릭 계산 (고유 스트리머 및 고유 비디오 기준 중복 집계 방지)
function computeGlobalMetrics(members) {
  if (cachedGlobalStats) return cachedGlobalStats;
  // 1. 혹시 모를 멤버 중복 방지 (동일 ID 또는 고유 스트리머 식별자 기준)
  const uniqueMembers = [];
  const seenMemberKeys = new Set();
  (members || []).forEach(m => {
    if (!m) return;
    const key = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
    if (key && !seenMemberKeys.has(key)) {
      seenMemberKeys.add(key);
      uniqueMembers.push(m);
    } else if (!key) {
      uniqueMembers.push(m);
    }
  });

  const totalMembers = uniqueMembers.length;
  let totalVideos = 0;
  let totalSec = 0;
  let totalClipCount = 0;
  let totalClipSec = 0;
  let totalFullCount = 0;
  let totalFullSec = 0;
  let totalBingeCount = 0;
  let totalBingeSec = 0;
  let totalViews = 0;
  let totalClipViews = 0;
  let totalFullViews = 0;
  let totalBingeViews = 0;

  for (let i = 0; i < uniqueMembers.length; i++) {
    const m = uniqueMembers[i];
    totalVideos += (m.totalCount || 0);
    totalSec += (m.totalSec || 0);
    totalClipCount += (m.clipCount || 0);
    totalClipSec += (m.clipSec || 0);
    totalFullCount += (m.fullCount || 0);
    totalFullSec += (m.fullSec || 0);
    totalBingeCount += (m.bingeCount || 0);
    totalBingeSec += (m.bingeSec || 0);
    totalViews += (m.totalViews || 0);
    totalClipViews += (m.clipViews || 0);
    totalFullViews += (m.fullViews || 0);
    totalBingeViews += (m.bingeViews || 0);
  }

  // 전체 소속 인원 총합 구독자수 및 치지직 팔로워수 계산 (플랫폼별 구분 & 중복 스트리머 중복 집계 방지)
  const seenSubKeys = new Set();
  let totalSubCount = 0;
  let ytSubCount = 0;
  let chzzkFollowerCount = 0;

  uniqueMembers.forEach(m => {
    const ytKey = (m.youtubeUrl && typeof m.youtubeUrl === 'string' && m.youtubeUrl.trim())
      ? m.youtubeUrl.trim().toLowerCase().replace(/\/+$/, '')
      : null;
    const streamerKey = (m.streamer && typeof m.streamer === 'string' && m.streamer.trim())
      ? m.streamer.trim().toLowerCase()
      : null;
    const key = ytKey || streamerKey || m.id || m.name;
    if (key && !seenSubKeys.has(key)) {
      seenSubKeys.add(key);
      const count = typeof parseSubscriberCount === "function" ? parseSubscriberCount(m.subscriberCount) : 0;
      if (count > 0) {
        totalSubCount += count;
        const isChzzk = typeof isMemberChzzk === "function"
          ? isMemberChzzk(m)
          : (m.youtubeUrl && (/chzzk\.naver\.com/i.test(String(m.youtubeUrl)) || /^[a-f0-9]{32}$/i.test(String(m.youtubeUrl).trim())));
        if (isChzzk) {
          chzzkFollowerCount += count;
        } else {
          ytSubCount += count;
        }
      }
    }
  });

  const totalSubStr = typeof formatSubscriberCount === "function" && totalSubCount > 0
    ? formatSubscriberCount(totalSubCount)
    : (totalSubCount > 0 ? `${totalSubCount.toLocaleString()}명` : "0명");

  const ytSubStr = typeof formatSubscriberCount === "function" && ytSubCount > 0
    ? formatSubscriberCount(ytSubCount)
    : (ytSubCount > 0 ? `${ytSubCount.toLocaleString()}명` : "0명");

  const chzzkFollowerStr = typeof formatSubscriberCount === "function" && chzzkFollowerCount > 0
    ? formatSubscriberCount(chzzkFollowerCount)
    : (chzzkFollowerCount > 0 ? `${chzzkFollowerCount.toLocaleString()}명` : "0명");

  cachedGlobalStats = {
    totalMembers,
    totalVideos,
    totalSec,
    totalDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분",
    totalClipCount,
    totalClipSec,
    totalClipDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalClipSec) : "0분",
    totalFullCount,
    totalFullSec,
    totalFullDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalFullSec) : "0분",
    totalBingeCount,
    totalBingeSec,
    totalBingeDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalBingeSec) : "0분",
    totalSubCount,
    totalSubStr,
    ytSubCount,
    ytSubStr,
    chzzkFollowerCount,
    chzzkFollowerStr,
    totalViews,
    totalClipViews,
    totalFullViews,
    totalBingeViews,
    totalViewsStr: typeof formatViewCount === "function" ? (formatViewCount(totalViews) || "0회") : `${totalViews.toLocaleString()}회`,
    totalClipViewsStr: typeof formatViewCount === "function" ? (formatViewCount(totalClipViews) || "0회") : `${totalClipViews.toLocaleString()}회`,
    totalFullViewsStr: typeof formatViewCount === "function" ? (formatViewCount(totalFullViews) || "0회") : `${totalFullViews.toLocaleString()}회`,
    totalBingeViewsStr: typeof formatViewCount === "function" ? (formatViewCount(totalBingeViews) || "0회") : `${totalBingeViews.toLocaleString()}회`,
  };
  return cachedGlobalStats;
}

// 모달 열기 -> 직업탭 전환으로 변경 (화면에 직접 표시)
function openLeaderboardModal() {
  if (typeof selectCategory === "function") {
    selectCategory('stats');
  } else {
    state.currentCategory = 'stats';
    if (typeof renderContent === "function") renderContent();
  }
}

// 모달 닫기
function closeLeaderboardModal() {
  const modal = document.getElementById("leaderboard-modal");
  if (!modal) return;

  if (typeof cleanupLeaderboardListeners === "function") {
    cleanupLeaderboardListeners();
  }

  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "";

  // 닫을 때도 스크롤 위치 초기화
  const modalContent = document.getElementById("leaderboard-modal-content");
  if (modalContent) {
    modalContent.scrollTop = 0;
    const innerScrolls = modalContent.querySelectorAll(".overflow-y-auto");
    innerScrolls.forEach(el => { el.scrollTop = 0; });
  }
}

// 탭 변경
function setLeaderboardTab(tab) {
  if (currentLeaderboardTab === tab) return;
  currentLeaderboardTab = tab;
  renderLeaderboardTabButtons();
  renderLeaderboardDynamicContent();
}

// 검색어 입력
let leaderboardSearchTimer = null;
function handleLeaderboardSearch(query) {
  const q = (query || '').trim().toLowerCase();
  const clearBtn = document.getElementById("leaderboard-search-clear");
  if (clearBtn) {
    if (q) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  if (leaderboardSearchTimer) clearTimeout(leaderboardSearchTimer);
  if (!q) {
    leaderboardSearchQuery = '';
    renderLeaderboardDynamicContent();
    return;
  }

  leaderboardSearchTimer = setTimeout(() => {
    leaderboardSearchQuery = q;
    renderLeaderboardDynamicContent();
  }, 120);
}

// 검색어 비우기
function clearLeaderboardSearch() {
  if (leaderboardSearchTimer) clearTimeout(leaderboardSearchTimer);
  leaderboardSearchQuery = '';
  const searchInput = document.getElementById("leaderboard-search-input");
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  const clearBtn = document.getElementById("leaderboard-search-clear");
  if (clearBtn) {
    clearBtn.classList.add("hidden");
  }
  renderLeaderboardDynamicContent();
}

// 탭 버튼 목록 렌더링
function renderLeaderboardTabButtons() {
  const container = document.getElementById("leaderboard-tab-buttons");
  if (!container) return;

  const tabDefs = [
    { key: 'total', label: '전체 시간순', emoji: '👑' },
    { key: 'subscriber', label: '구독자순', emoji: '👥' },
    { key: 'views', label: '조회수순', emoji: '👁️' },
    { key: 'clip', label: '편집 영상', emoji: '✂️' },
    { key: 'full', label: '풀 영상', emoji: '🎥' },
    { key: 'binge', label: '몰아보기', emoji: '🍿' },
  ];

  const existingButtons = container.querySelectorAll("button[data-tab]");
  if (existingButtons.length === tabDefs.length) {
    existingButtons.forEach(btn => {
      const tabKey = btn.getAttribute("data-tab");
      const isActive = currentLeaderboardTab === tabKey;
      btn.className = `flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 h-8 sm:h-8.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer select-none ${
        isActive 
          ? "bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20" 
          : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800"
      }`;
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    return;
  }

  container.innerHTML = tabDefs.map(t => {
    const isActive = currentLeaderboardTab === t.key;
    const activeClass = isActive 
      ? "bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20" 
      : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800";
    return `
      <button 
        type="button"
        data-tab="${t.key}"
        onclick="setLeaderboardTab('${t.key}')" 
        aria-selected="${isActive ? 'true' : 'false'}"
        class="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 h-8 sm:h-8.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer select-none ${activeClass}"
      >
        <span class="leading-none text-sm">${t.emoji}</span>
        <span class="leading-none whitespace-nowrap">${t.label}</span>
      </button>
    `;
  }).join("");
}

// 개별 멤버 구독자/팔로워 뱃지 렌더링 헬퍼 (통계 모달 스트리머명 옆 미표시)
function renderMemberSubscriberBadgeHtml(m) {
  return '';
}

// 상단 글로벌 통계 요약 카드 렌더링
function renderGlobalStatsCards(globalStats) {
  return `
    <!-- 총 소속 인원 -->
    <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-1 sm:mb-1.5">
        <span class="font-medium text-[11px] sm:text-xs">총 소속 인원</span>
        <span class="text-zinc-500">👥</span>
      </div>
      <div>
        <div class="min-h-[24px] sm:min-h-[26px] flex items-center text-base sm:text-xl font-bold text-white tracking-tight leading-tight">${globalStats.totalMembers}명</div>
        <div class="mt-1 flex flex-col gap-0.5 text-[10px] sm:text-[11px] leading-tight">
          <div class="h-4 flex items-center gap-1.5 text-zinc-300 truncate" title="전체 유튜브 총 구독자: ${globalStats.ytSubStr}">
            <svg class="w-3 h-3 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span class="text-white font-bold truncate">${globalStats.ytSubStr}</span>
          </div>
          ${globalStats.chzzkFollowerCount > 0 ? `
            <div class="h-4 flex items-center gap-1.5 text-[#00ffa3] truncate" title="전체 치지직 총 팔로워: ${globalStats.chzzkFollowerStr}">
              <svg class="w-3 h-3 text-[#00ffa3] fill-current flex-shrink-0" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
              <span class="text-[#00ffa3] font-bold truncate">${globalStats.chzzkFollowerStr}</span>
            </div>
          ` : `
            <div class="h-4 flex items-center text-zinc-500 truncate">전체 채널 합산</div>
          `}
        </div>
      </div>
    </div>

    <!-- 전체 영상 -->
    <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-1 sm:mb-1.5">
        <span class="font-medium text-[11px] sm:text-xs">전체 영상</span>
        <span class="text-amber-400">⏱️</span>
      </div>
      <div>
        <div class="text-[11px] sm:text-xs font-semibold text-zinc-300 font-mono leading-tight">${globalStats.totalVideos}개</div>
        <div class="min-h-[24px] sm:min-h-[26px] flex items-center text-sm sm:text-lg font-bold text-amber-400 tracking-tight leading-tight my-0.5">${globalStats.totalDurStr}</div>
        <div class="flex flex-col gap-0.5 text-[10px] sm:text-[11px] leading-tight">
          <div class="h-4 flex items-center text-zinc-400 font-medium truncate" title="전체 등록 영상 총 누적 조회수: ${globalStats.totalViews.toLocaleString()}회">
            ${globalStats.totalViewsStr}
          </div>
        </div>
      </div>
    </div>

    <!-- 편집 영상 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-1 sm:mb-1.5">
        <span class="font-medium flex items-center gap-1.5 text-[11px] sm:text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span>편집 영상</span>
        </span>
        <span class="text-zinc-500">🎬</span>
      </div>
      <div>
        <div class="text-[11px] sm:text-xs font-semibold text-zinc-300 font-mono leading-tight">${globalStats.totalClipCount}개</div>
        <div class="min-h-[24px] sm:min-h-[26px] flex items-center text-sm sm:text-lg font-bold text-red-400 tracking-tight leading-tight my-0.5">${globalStats.totalClipDurStr}</div>
        <div class="flex flex-col gap-0.5 text-[10px] sm:text-[11px] leading-tight">
          <div class="h-4 flex items-center text-zinc-400 font-medium truncate" title="편집 영상 총 조회수: ${globalStats.totalClipViews.toLocaleString()}회">
            ${globalStats.totalClipViewsStr}
          </div>
        </div>
      </div>
    </div>

    <!-- 풀 영상 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-1 sm:mb-1.5">
        <span class="font-medium flex items-center gap-1.5 text-[11px] sm:text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>풀 영상</span>
        </span>
        <span class="text-zinc-500">🎥</span>
      </div>
      <div>
        <div class="text-[11px] sm:text-xs font-semibold text-zinc-300 font-mono leading-tight">${globalStats.totalFullCount}개</div>
        <div class="min-h-[24px] sm:min-h-[26px] flex items-center text-sm sm:text-lg font-bold text-indigo-400 tracking-tight leading-tight my-0.5">${globalStats.totalFullDurStr}</div>
        <div class="flex flex-col gap-0.5 text-[10px] sm:text-[11px] leading-tight">
          <div class="h-4 flex items-center text-zinc-400 font-medium truncate" title="풀 영상 총 조회수: ${globalStats.totalFullViews.toLocaleString()}회">
            ${globalStats.totalFullViewsStr}
          </div>
        </div>
      </div>
    </div>

    <!-- 몰아보기 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-1 sm:mb-1.5">
        <span class="font-medium flex items-center gap-1.5 text-[11px] sm:text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>몰아보기</span>
        </span>
        <span class="text-zinc-500">🍿</span>
      </div>
      <div>
        <div class="text-[11px] sm:text-xs font-semibold text-zinc-300 font-mono leading-tight">${globalStats.totalBingeCount}개</div>
        <div class="min-h-[24px] sm:min-h-[26px] flex items-center text-sm sm:text-lg font-bold text-amber-300 tracking-tight leading-tight my-0.5">${globalStats.totalBingeDurStr}</div>
        <div class="flex flex-col gap-0.5 text-[10px] sm:text-[11px] leading-tight">
          <div class="h-4 flex items-center text-zinc-400 font-medium truncate" title="몰아보기 총 조회수: ${globalStats.totalBingeViews.toLocaleString()}회">
            ${globalStats.totalBingeViewsStr}
          </div>
        </div>
      </div>
    </div>
  `;
}

// 직업 탭 헤더 우측 통계와 100% 동일한 규격의 종합 통계 헤더 비디오 통계 박스
function renderLeaderboardHeaderVideoStats(globalStats) {
  if (!globalStats) return "";
  return `
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-1.5 sm:p-2.5 flex items-center gap-1 sm:gap-2 flex-nowrap max-w-full overflow-x-auto no-scrollbar flex-shrink-0 shadow-xl select-none">
      <!-- 편집 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
          <span>편집 영상</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-red-400 tracking-tight leading-snug my-0.5">${globalStats.totalClipDurStr}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${globalStats.totalClipCount}개</p>
      </div>

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 풀 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50"></span>
          <span>풀 영상</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-indigo-400 tracking-tight leading-snug my-0.5">${globalStats.totalFullDurStr}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${globalStats.totalFullCount}개</p>
      </div>

      ${globalStats.totalBingeCount > 0 ? `
        <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>
        <!-- 몰아보기 -->
        <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
          <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
            <span>몰아보기</span>
          </p>
          <p class="text-xs sm:text-[15px] font-bold text-amber-400 tracking-tight leading-snug my-0.5">${globalStats.totalBingeDurStr}</p>
          <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${globalStats.totalBingeCount}개</p>
        </div>
      ` : ''}

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 총 조회수 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1" title="전체 등록 영상 총 조회수: ${globalStats.totalViews.toLocaleString()}회">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
          <span>총 조회수</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-emerald-400 tracking-tight leading-snug my-0.5">${globalStats.totalViewsStr}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">누적 시청</p>
      </div>

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 소속 인원 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shadow-sm shadow-zinc-400/50"></span>
          <span>소속 인원</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-white tracking-tight leading-snug my-0.5">${globalStats.totalMembers}명</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">전체 멤버</p>
      </div>
    </div>
  `;
}

// 종합 통계 메인 화면 페이지 렌더링 (직업 탭 아래 메인 영역)
function renderLeaderboardPage(container) {
  if (!container) container = document.getElementById("main-content");
  if (!container) return;

  const allMembers = getAllMembersWithLeaderboardStats();
  const globalStats = computeGlobalMetrics(allMembers);

  container.innerHTML = `
    <!-- 0. 카테고리 헤더 (다른 직업 탭과 동일한 규격의 헤더 UI) -->
    <div class="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 flex-shrink-0">STATS</span>
          <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-shrink-0">
            <span>📊</span>
            <span>종합 통계</span>
          </h2>
          ${globalStats.ytSubStr ? `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-700/50 text-red-300 text-xs sm:text-sm font-bold shadow-md shadow-red-950/30 flex-shrink-0" title="전체 등록 인원 유튜브 총 구독자: ${globalStats.ytSubStr}">
              <svg class="w-3.5 h-3.5 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>구독자 ${globalStats.ytSubStr}</span>
            </span>
          ` : ''}
          ${globalStats.chzzkFollowerCount > 0 ? `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#00ffa3]/10 border border-[#00ffa3]/40 text-[#00ffa3] text-xs sm:text-sm font-bold shadow-md shadow-[#00ffa3]/10 flex-shrink-0" title="전체 등록 인원 치지직 총 팔로워: ${globalStats.chzzkFollowerStr}">
              <svg class="w-3.5 h-3.5 text-[#00ffa3] fill-current flex-shrink-0" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
              <span>팔로워 ${globalStats.chzzkFollowerStr}</span>
            </span>
          ` : ''}
        </div>
      </div>

      ${renderLeaderboardHeaderVideoStats(globalStats)}
    </div>

    <!-- 1. 상단 글로벌 통계 요약 카드들 -->
    <div id="leaderboard-global-stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6 flex-shrink-0">
      ${renderGlobalStatsCards(globalStats)}
    </div>

    <!-- 2. 통계 탭 컨트롤 & 검색 바 -->
    <div id="leaderboard-controls" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4 mb-6 flex-shrink-0">
      <!-- 탭 목록 -->
      <div id="leaderboard-tab-buttons" class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
      </div>

      <!-- 검색 인풋 -->
      <div class="relative min-w-[200px] sm:w-64">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input 
          type="text" 
          id="leaderboard-search-input"
          value="${typeof escapeHtml === 'function' ? escapeHtml(leaderboardSearchQuery || '') : (leaderboardSearchQuery || '')}"
          oninput="handleLeaderboardSearch(this.value)"
          placeholder="인원, 스트리머, 소속 검색..." 
          autocomplete="off"
          class="w-full pl-9 pr-8 py-2 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
        />
        <button 
          id="leaderboard-search-clear"
          type="button" 
          onclick="clearLeaderboardSearch()" 
          class="${leaderboardSearchQuery ? '' : 'hidden'} absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer text-xs"
          title="검색어 지우기"
        >✕</button>
      </div>
    </div>

    <!-- 3. 동적 컨텐츠 (포디움 + 순위 목록) -->
    <div id="leaderboard-dynamic-content"></div>
  `;

  renderLeaderboardTabButtons();
  renderLeaderboardDynamicContent();
}

// 모달 뼈대 초기화/업데이트
function initOrUpdateLeaderboardModal() {
  const container = document.getElementById("leaderboard-modal-content");
  if (!container) return;

  const allMembers = getAllMembersWithLeaderboardStats();
  const globalStats = computeGlobalMetrics(allMembers);

  let statsEl = document.getElementById("leaderboard-global-stats");
  if (!statsEl || !document.getElementById("leaderboard-dynamic-content")) {
    container.innerHTML = `
      <!-- 1. 상단 글로벌 통계 요약 카드들 -->
      <div id="leaderboard-global-stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6 flex-shrink-0">
        ${renderGlobalStatsCards(globalStats)}
      </div>

      <!-- 2. 통계 탭 컨트롤 & 검색 바 -->
      <div id="leaderboard-controls" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-zinc-800/80 pb-4 flex-shrink-0">
        <!-- 탭 목록 -->
        <div id="leaderboard-tab-buttons" class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        </div>

        <!-- 검색 인풋 -->
        <div class="relative min-w-[200px] sm:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            id="leaderboard-search-input"
            value=""
            oninput="handleLeaderboardSearch(this.value)"
            placeholder="인원, 스트리머, 그룹 검색..." 
            autocomplete="off"
            class="w-full pl-9 pr-8 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
          />
          <button 
            id="leaderboard-search-clear"
            type="button" 
            onclick="clearLeaderboardSearch()" 
            class="hidden absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer text-xs"
            title="검색어 지우기"
          >✕</button>
        </div>
      </div>

      <!-- 3. 동적 컨텐츠 (포디움 + 순위 목록) -->
      <div id="leaderboard-dynamic-content"></div>
    `;
    renderLeaderboardTabButtons();
  } else {
    statsEl.innerHTML = renderGlobalStatsCards(globalStats);
    renderLeaderboardTabButtons();
  }
}

// 리더보드 탭별 메트릭 포맷 헬퍼
function getLeaderboardTabMetric(m) {
  if (!m) return { valStr: '0분', subStr: '', sec: 0 };
  if (currentLeaderboardTab === 'total') {
    return { valStr: m.totalDurStr || '0분', subStr: '', sec: m.totalSec || 0 };
  } else if (currentLeaderboardTab === 'views') {
    return { valStr: m.totalViewsStr || '0회', subStr: '', sec: m.totalViews || 0 };
  } else if (currentLeaderboardTab === 'subscriber') {
    const isChzzk = typeof isMemberChzzk === "function" ? isMemberChzzk(m) : false;
    const subFormatted = m.subscriberCount ? String(m.subscriberCount).trim() : (typeof formatSubscriberCount === "function" && m.subCount > 0 ? formatSubscriberCount(m.subCount) : "0명");
    const cleanSub = subFormatted.replace(/^(구독자|팔로워)\s*/, '');
    const prefix = isChzzk ? "팔로워 " : "구독자 ";
    return { valStr: `${prefix}${cleanSub}`, subStr: '', sec: m.subCount || 0 };
  } else if (currentLeaderboardTab === 'clip') {
    return { valStr: m.clipDurStr || '0분', subStr: '', sec: m.clipSec || 0 };
  } else if (currentLeaderboardTab === 'full') {
    return { valStr: m.fullDurStr || '0분', subStr: '', sec: m.fullSec || 0 };
  } else if (currentLeaderboardTab === 'binge') {
    return { valStr: m.bingeDurStr || '0분', subStr: '', sec: m.bingeSec || 0 };
  } else {
    return { valStr: `${m.totalCount || 0}개`, subStr: '', sec: m.totalCount || 0 };
  }
}

// 개별 순위 행 HTML 생성 헬퍼
function renderLeaderboardRowHtml(m, idx, maxVal) {
  const rank = idx + 1;
  const metric = getLeaderboardTabMetric(m);
  const percent = maxVal > 0 ? Math.min(100, Math.round((metric.sec / maxVal) * 100)) : 0;

  // 메달 뱃지
  let medalBadge = `<span class="text-zinc-400 font-bold text-xs">#${rank}</span>`;
  if (rank === 1) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">🥇</span>`;
  else if (rank === 2) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-400/20 text-zinc-300 font-bold text-xs border border-zinc-400/40">🥈</span>`;
  else if (rank === 3) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-800/20 text-amber-500 font-bold text-xs border border-amber-700/40">🥉</span>`;

  const rawGroupLabel = m.displayAffiliation || (m.groupName 
    ? `${m.groupEmoji || ''} ${m.groupName}` 
    : `${m.catEmoji || ''} ${m.catBadge}`);
  const groupLabel = typeof escapeHtml === 'function' ? escapeHtml(rawGroupLabel) : rawGroupLabel;

  const rawMRole = [m.role, m.swatRole].filter(Boolean).join(' · ');
  const mRole = typeof escapeHtml === 'function' ? escapeHtml(rawMRole) : rawMRole;
  const safeStreamer = typeof escapeHtml === 'function' ? escapeHtml(m.streamerName || m.name) : (m.streamerName || m.name);
  const safeName = typeof escapeHtml === 'function' ? escapeHtml(m.name) : m.name;
  const safeSingleRole = typeof escapeHtml === 'function' ? escapeHtml(m.role) : m.role;

  const safeCatId = typeof sanitizeAttr === 'function' ? sanitizeAttr(m.catId) : m.catId;
  const safeGroupId = typeof sanitizeAttr === 'function' ? sanitizeAttr(m.groupId || '') : (m.groupId || '');
  const safeMemberId = typeof sanitizeAttr === 'function' ? sanitizeAttr(m.id || '') : (m.id || '');

  return `
    <div 
      onclick="selectMemberFromLeaderboard('${safeCatId}', '${safeGroupId}', '${safeName}', '${safeMemberId}')"
      class="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer group"
    >
      <!-- 순위 -->
      <div class="w-8 sm:w-12 text-center flex-shrink-0 flex items-center justify-center">
        ${medalBadge}
      </div>

      <!-- 프로필 및 인원 정보 -->
      <div class="flex-1 px-2 sm:px-3 flex items-center gap-2 sm:gap-3 min-w-0">
        <div class="relative flex-shrink-0">
          <img 
            src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(m) : (m.avatar || 'assets/default-avatar.svg')}" 
            onerror="this.onerror=null; this.src='assets/default-avatar.svg'" 
            loading="${idx < 10 ? 'eager' : 'lazy'}" 
            decoding="async"
            referrerpolicy="no-referrer"
            class="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-zinc-700 bg-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
          />
          ${(typeof getSwatBadgeHtml === 'function' && m.swatRole) ? getSwatBadgeHtml(m.swatRole, 'sm') : ''}
          ${(typeof isRoleBadgeHidden === 'function' ? !isRoleBadgeHidden(safeSingleRole) : (safeSingleRole !== '조직원' && safeSingleRole !== '조합원')) && safeSingleRole ? `
            <span class="absolute -bottom-1 -right-1 z-20 text-[8px] sm:text-[8.5px] font-bold px-1.5 py-0.5 rounded leading-none whitespace-nowrap ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(m, m.catId) : 'bg-zinc-800 text-white'} shadow select-none">
              ${safeSingleRole}
            </span>
          ` : ''}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
            <span class="font-bold text-xs sm:text-sm text-white group-hover:text-amber-400 transition-colors truncate whitespace-nowrap">${safeStreamer}</span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-400 truncate whitespace-nowrap">
            <span class="text-amber-400/90 font-medium">${safeName}</span>${mRole ? ` <span class="text-zinc-500 text-[10px] sm:text-[11px]">(${mRole})</span>` : ''}
          </div>
        </div>
      </div>

      <!-- 소속 그룹 / 카테고리 -->
      <div class="hidden sm:block w-36 px-2 text-left truncate flex-shrink-0" title="${groupLabel}">
        <span class="inline-block text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-700/40 truncate max-w-full">
          ${groupLabel}
        </span>
      </div>

      <!-- 메트릭 바 & 수치 -->
      <div class="w-28 sm:w-56 px-1.5 sm:px-2 text-right flex-shrink-0">
        <div class="font-bold text-xs sm:text-sm text-white tracking-tight leading-tight">
          ${metric.valStr}
        </div>
        <div class="flex items-center justify-end mt-0.5 sm:mt-1">
          <div class="w-16 sm:w-20 bg-zinc-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
            <div class="bg-amber-400 h-full rounded-full transition-all duration-300" style="width: ${percent}%;"></div>
          </div>
        </div>
      </div>

      <!-- 이동 화살표 -->
      <div class="hidden sm:flex w-8 flex-shrink-0 text-right text-zinc-600 group-hover:text-amber-400 transition-colors justify-end">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </div>
    </div>
  `;
}

// 스크롤 센티넬 상태 UI 갱신
function updateLeaderboardSentinel(isLoading = false) {
  const sentinel = document.getElementById("leaderboard-scroll-sentinel");
  if (!sentinel) return;

  const total = currentLeaderboardTableMembers ? currentLeaderboardTableMembers.length : 0;
  if (total <= LEADERBOARD_PAGE_SIZE) {
    sentinel.innerHTML = '';
    sentinel.className = 'hidden';
    return;
  }

  sentinel.className = 'border-t border-zinc-800/40 bg-zinc-950/40';

  const totalAllCount = (currentLeaderboardSortedMembers ? currentLeaderboardSortedMembers.length : total);
  const currentRankEnd = currentLeaderboardTableOffset + leaderboardVisibleCount;

  if (isLoading) {
    sentinel.innerHTML = `
      <div class="py-3.5 px-4 flex items-center justify-center gap-2 text-xs text-amber-400 font-medium">
        <svg class="animate-spin h-4 w-4 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span>스크롤 순위 로딩 중... (${currentRankEnd}/${totalAllCount}위)</span>
      </div>
    `;
  } else if (leaderboardVisibleCount < total) {
    sentinel.innerHTML = `
      <div class="py-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400">
        <div class="flex items-center gap-1.5 text-zinc-400">
          <span>📜</span>
          <span>스크롤을 내리면 추가 순위가 로딩됩니다 <span class="text-amber-400 font-semibold font-mono">(${currentRankEnd}위까지 표시 / 전체 ${totalAllCount}명)</span></span>
        </div>
        <button 
          type="button" 
          onclick="loadMoreLeaderboardItems()" 
          class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer border border-zinc-700/60"
        >
          + 10명 더보기
        </button>
      </div>
    `;
  } else {
    sentinel.innerHTML = `
      <div class="py-3 px-4 text-center text-xs text-zinc-500 font-medium">
        ✓ 전체 ${totalAllCount}명의 순위를 모두 불러왔습니다
      </div>
    `;
  }
}

// 스크롤 시 다음 10개 순위 추가 로딩 (Lazy loading)
function loadMoreLeaderboardItems() {
  if (isLoadingLeaderboardMore) return;
  const total = currentLeaderboardTableMembers ? currentLeaderboardTableMembers.length : 0;
  if (!total || leaderboardVisibleCount >= total) {
    if (leaderboardObserver) {
      leaderboardObserver.disconnect();
      leaderboardObserver = null;
    }
    updateLeaderboardSentinel(false);
    return;
  }

  isLoadingLeaderboardMore = true;
  updateLeaderboardSentinel(true);

  requestAnimationFrame(() => {
    const rowsContainer = document.getElementById("leaderboard-ranking-rows");
    if (!rowsContainer) {
      isLoadingLeaderboardMore = false;
      return;
    }

    const startIdx = leaderboardVisibleCount;
    const endIdx = Math.min(startIdx + LEADERBOARD_PAGE_SIZE, total);
    const nextBatch = currentLeaderboardTableMembers.slice(startIdx, endIdx);

    const newRowsHtml = nextBatch.map((m, i) => {
      const globalIdx = currentLeaderboardTableOffset + startIdx + i;
      return renderLeaderboardRowHtml(m, globalIdx, currentLeaderboardMaxVal);
    }).join("");

    rowsContainer.insertAdjacentHTML("beforeend", newRowsHtml);
    leaderboardVisibleCount = endIdx;
    isLoadingLeaderboardMore = false;

    updateLeaderboardSentinel(false);

    if (leaderboardVisibleCount >= total) {
      if (leaderboardObserver) {
        leaderboardObserver.disconnect();
        leaderboardObserver = null;
      }
    } else if (leaderboardObserver) {
      const sentinel = document.getElementById("leaderboard-scroll-sentinel");
      if (sentinel) {
        const rect = sentinel.getBoundingClientRect();
        if (rect.top <= window.innerHeight + 100) {
          loadMoreLeaderboardItems();
        }
      }
    }
  });
}

// 리스너 및 옵저버 클린업 (메모리 누수 및 백그라운드 스크롤 연산 방지)
function cleanupLeaderboardListeners() {
  if (leaderboardObserver) {
    leaderboardObserver.disconnect();
    leaderboardObserver = null;
  }
  if (leaderboardScrollListenerAttached && onLeaderboardScrollHandler) {
    window.removeEventListener("scroll", onLeaderboardScrollHandler);
    const modalContent = document.getElementById("leaderboard-modal-content");
    if (modalContent) {
      modalContent.removeEventListener("scroll", onLeaderboardScrollHandler);
    }
    leaderboardScrollListenerAttached = false;
    onLeaderboardScrollHandler = null;
  }
  if (leaderboardScrollRafId) {
    cancelAnimationFrame(leaderboardScrollRafId);
    leaderboardScrollRafId = null;
  }
}
window.cleanupLeaderboardListeners = cleanupLeaderboardListeners;

// IntersectionObserver 설정
function setupLeaderboardScrollObserver() {
  if (leaderboardObserver) {
    leaderboardObserver.disconnect();
    leaderboardObserver = null;
  }

  const sentinel = document.getElementById("leaderboard-scroll-sentinel");
  if (!sentinel) return;

  const total = currentLeaderboardTableMembers ? currentLeaderboardTableMembers.length : 0;
  if (leaderboardVisibleCount >= total) return;

  if ("IntersectionObserver" in window) {
    leaderboardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoadingLeaderboardMore) {
          loadMoreLeaderboardItems();
        }
      });
    }, {
      root: null,
      rootMargin: "250px",
      threshold: 0.05
    });

    leaderboardObserver.observe(sentinel);
  }
}

// 윈도우 및 모달 스크롤 이벤트 리스너 보강 (rAF 기반 쓰로틀링 적용)
function ensureLeaderboardWindowScrollListener() {
  if (leaderboardScrollListenerAttached) return;
  leaderboardScrollListenerAttached = true;

  onLeaderboardScrollHandler = () => {
    if (leaderboardScrollRafId) return;
    leaderboardScrollRafId = requestAnimationFrame(() => {
      leaderboardScrollRafId = null;
      if (isLoadingLeaderboardMore) return;
      const total = currentLeaderboardTableMembers ? currentLeaderboardTableMembers.length : 0;
      if (!total || leaderboardVisibleCount >= total) return;

      const sentinel = document.getElementById("leaderboard-scroll-sentinel");
      if (!sentinel) return;

      const rect = sentinel.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 250) {
        loadMoreLeaderboardItems();
      }
    });
  };

  window.addEventListener("scroll", onLeaderboardScrollHandler, { passive: true });

  const modalContent = document.getElementById("leaderboard-modal-content");
  if (modalContent) {
    modalContent.addEventListener("scroll", onLeaderboardScrollHandler, { passive: true });
  }
}

// 동적 컨텐츠 (포디움 + 순위 목록) 렌더링
function renderLeaderboardDynamicContent() {
  const dynamicContainer = document.getElementById("leaderboard-dynamic-content");
  if (!dynamicContainer) return;

  const allMembers = getAllMembersWithLeaderboardStats();

  // 탭 정렬 로직 (전체시간순 / 조회수순 / 구독자순 / 편집 / 풀 / 몰아보기)
  let sortedMembers = [...allMembers];
  if (currentLeaderboardTab === 'total') {
    sortedMembers.sort((a, b) => (b.totalSec || 0) - (a.totalSec || 0) || (b.totalViews || 0) - (a.totalViews || 0) || (b.subCount || 0) - (a.subCount || 0) || (b.totalCount || 0) - (a.totalCount || 0));
  } else if (currentLeaderboardTab === 'views') {
    sortedMembers.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0) || (b.totalSec || 0) - (a.totalSec || 0) || (b.subCount || 0) - (a.subCount || 0) || (b.totalCount || 0) - (a.totalCount || 0));
  } else if (currentLeaderboardTab === 'subscriber') {
    sortedMembers.sort((a, b) => (b.subCount || 0) - (a.subCount || 0) || (b.totalViews || 0) - (a.totalViews || 0) || (b.totalSec || 0) - (a.totalSec || 0) || (b.totalCount || 0) - (a.totalCount || 0));
  } else if (currentLeaderboardTab === 'clip') {
    sortedMembers.sort((a, b) => (b.clipSec || 0) - (a.clipSec || 0) || (b.clipViews || 0) - (a.clipViews || 0) || (b.clipCount || 0) - (a.clipCount || 0));
  } else if (currentLeaderboardTab === 'full') {
    sortedMembers.sort((a, b) => (b.fullSec || 0) - (a.fullSec || 0) || (b.fullViews || 0) - (a.fullViews || 0) || (b.fullCount || 0) - (a.fullCount || 0));
  } else if (currentLeaderboardTab === 'binge') {
    sortedMembers.sort((a, b) => (b.bingeSec || 0) - (a.bingeSec || 0) || (b.bingeViews || 0) - (a.bingeViews || 0) || (b.bingeCount || 0) - (a.bingeCount || 0));
  } else if (currentLeaderboardTab === 'count') {
    sortedMembers.sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0) || (b.totalViews || 0) - (a.totalViews || 0) || (b.totalSec || 0) - (a.totalSec || 0));
  }

  // 검색 필터링
  if (leaderboardSearchQuery) {
    sortedMembers = sortedMembers.filter(m => {
      const nameMatch = (m.name || '').toLowerCase().includes(leaderboardSearchQuery);
      const roleMatch = (m.role || '').toLowerCase().includes(leaderboardSearchQuery);
      const swatRoleMatch = (m.swatRole || '').toLowerCase().includes(leaderboardSearchQuery);
      const streamerMatch = (m.streamerName || '').toLowerCase().includes(leaderboardSearchQuery);
      const catMatch = (m.catName || '').toLowerCase().includes(leaderboardSearchQuery);
      const groupMatch = (m.groupName || '').toLowerCase().includes(leaderboardSearchQuery);
      const affMatch = (m.displayAffiliation || '').toLowerCase().includes(leaderboardSearchQuery);
      return nameMatch || roleMatch || swatRoleMatch || streamerMatch || catMatch || groupMatch || affMatch;
    });
  }

  // 1위 값 (프로그레스 바 백분율 기준)
  let maxVal = 1;
  if (sortedMembers.length > 0) {
    if (currentLeaderboardTab === 'total') maxVal = Math.max(1, sortedMembers[0].totalSec || 1);
    else if (currentLeaderboardTab === 'views') maxVal = Math.max(1, sortedMembers[0].totalViews || 1);
    else if (currentLeaderboardTab === 'subscriber') maxVal = Math.max(1, sortedMembers[0].subCount || 1);
    else if (currentLeaderboardTab === 'clip') maxVal = Math.max(1, sortedMembers[0].clipSec || 1);
    else if (currentLeaderboardTab === 'full') maxVal = Math.max(1, sortedMembers[0].fullSec || 1);
    else if (currentLeaderboardTab === 'binge') maxVal = Math.max(1, sortedMembers[0].bingeSec || 1);
    else if (currentLeaderboardTab === 'count') maxVal = Math.max(1, sortedMembers[0].totalCount || 1);
  }

  // 상위 TOP 3 (검색 중이 아니고 3명 이상일 때)
  const showPodium = !leaderboardSearchQuery && sortedMembers.length >= 3;
  const top1 = showPodium ? sortedMembers[0] : null;
  const top2 = showPodium ? sortedMembers[1] : null;
  const top3 = showPodium ? sortedMembers[2] : null;

  // 순위 목록에 표시할 멤버 및 시작 오프셋 (포디움이 표시될 경우 상위 3명은 상단 카드에 있으므로 4위부터 표시)
  const tableOffset = showPodium ? 3 : 0;
  const tableMembers = sortedMembers.slice(tableOffset);

  // 페이징 상태 초기화 (테이블 멤버 기준)
  currentLeaderboardSortedMembers = sortedMembers;
  currentLeaderboardTableMembers = tableMembers;
  currentLeaderboardTableOffset = tableOffset;
  currentLeaderboardMaxVal = maxVal;
  leaderboardVisibleCount = Math.min(LEADERBOARD_PAGE_SIZE, tableMembers.length);
  isLoadingLeaderboardMore = false;
  if (leaderboardObserver) {
    leaderboardObserver.disconnect();
    leaderboardObserver = null;
  }

  // 값 포맷 헬퍼 (포디움 렌더링 호환)
  const getTabMetric = (m) => getLeaderboardTabMetric(m);

  let html = '';

  // 포디움 렌더링
  if (showPodium) {
    const top2Role = [top2.role, top2.swatRole].filter(Boolean).join(' · ');
    const top1Role = [top1.role, top1.swatRole].filter(Boolean).join(' · ');
    const top3Role = [top3.role, top3.swatRole].filter(Boolean).join(' · ');

    const top2Aff = top2.displayAffiliation || (top2.groupName ? `${top2.groupEmoji || ''} ${top2.groupName}` : `${top2.catEmoji || ''} ${top2.catBadge}`);
    const top1Aff = top1.displayAffiliation || (top1.groupName ? `${top1.groupEmoji || ''} ${top1.groupName}` : `${top1.catEmoji || ''} ${top1.catBadge}`);
    const top3Aff = top3.displayAffiliation || (top3.groupName ? `${top3.groupEmoji || ''} ${top3.groupName}` : `${top3.catEmoji || ''} ${top3.catBadge}`);

    const safeTop1Streamer = typeof escapeHtml === 'function' ? escapeHtml(top1.streamerName || top1.name) : (top1.streamerName || top1.name);
    const safeTop1Name = typeof escapeHtml === 'function' ? escapeHtml(top1.name) : top1.name;
    const safeTop1Role = typeof escapeHtml === 'function' ? escapeHtml(top1Role) : top1Role;
    const safeTop1Aff = typeof escapeHtml === 'function' ? escapeHtml(top1Aff) : top1Aff;
    const safeTop1SingleRole = typeof escapeHtml === 'function' ? escapeHtml(top1.role) : top1.role;

    const safeTop2Streamer = typeof escapeHtml === 'function' ? escapeHtml(top2.streamerName || top2.name) : (top2.streamerName || top2.name);
    const safeTop2Name = typeof escapeHtml === 'function' ? escapeHtml(top2.name) : top2.name;
    const safeTop2Role = typeof escapeHtml === 'function' ? escapeHtml(top2Role) : top2Role;
    const safeTop2Aff = typeof escapeHtml === 'function' ? escapeHtml(top2Aff) : top2Aff;
    const safeTop2SingleRole = typeof escapeHtml === 'function' ? escapeHtml(top2.role) : top2.role;

    const safeTop3Streamer = typeof escapeHtml === 'function' ? escapeHtml(top3.streamerName || top3.name) : (top3.streamerName || top3.name);
    const safeTop3Name = typeof escapeHtml === 'function' ? escapeHtml(top3.name) : top3.name;
    const safeTop3Role = typeof escapeHtml === 'function' ? escapeHtml(top3Role) : top3Role;
    const safeTop3Aff = typeof escapeHtml === 'function' ? escapeHtml(top3Aff) : top3Aff;
    const safeTop3SingleRole = typeof escapeHtml === 'function' ? escapeHtml(top3.role) : top3.role;

    html += `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 pt-3">
        <!-- 2위 🥈 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top2.catId}', '${top2.groupId || ''}', '${top2.name}', '${top2.id || ''}')"
          class="podium-card order-2 md:order-1 w-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-zinc-500 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer shadow-lg hover:shadow-zinc-500/15 group relative"
        >
          <div class="podium-badge -top-3 w-7 h-7 rounded-full bg-zinc-400/20 border border-zinc-400 flex items-center justify-center text-sm shadow">🥈</div>
          <div class="relative my-2">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-400/60 group-hover:border-zinc-300 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top2) : (top2.avatar || 'assets/default-avatar.svg')}" onerror="this.onerror=null; this.src='assets/default-avatar.svg'" loading="eager" decoding="async" referrerpolicy="no-referrer" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top2.swatRole) ? getSwatBadgeHtml(top2.swatRole, 'sm') : ''}
            ${(typeof isRoleBadgeHidden === 'function' ? !isRoleBadgeHidden(safeTop2SingleRole) : (safeTop2SingleRole !== '조직원' && safeTop2SingleRole !== '조합원')) && safeTop2SingleRole ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top2, top2.catId) : 'bg-zinc-800 text-white'} shadow-md select-none">
                ${safeTop2SingleRole}
              </span>
            ` : ''}
          </div>
          <div class="h-6 flex items-center justify-center w-full mt-1">
            <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[90%] text-center">
              <span>${safeTop2Streamer}</span>
            </h4>
          </div>
          <div class="h-5 flex items-center justify-center w-full mb-2">
            <p class="text-xs text-zinc-300 truncate max-w-[90%] text-center" title="${safeTop2Name}">
              <span>${safeTop2Name}</span>${safeTop2Role ? ` <span class="text-zinc-500 text-[11px]">(${safeTop2Role})</span>` : ''}
            </p>
          </div>
          <div class="h-7 flex items-center justify-center w-full mb-3">
            <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50 truncate max-w-[90%]" title="${safeTop2Aff}">
              ${safeTop2Aff}
            </div>
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center justify-center h-11">
            <span class="text-base font-bold text-white">${getTabMetric(top2).valStr}</span>
          </div>
        </div>

        <!-- 1위 🥇 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top1.catId}', '${top1.groupId || ''}', '${top1.name}', '${top1.id || ''}')"
          class="podium-card order-1 md:order-2 w-full bg-gradient-to-b from-amber-950/30 via-zinc-900 to-zinc-950 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer shadow-xl shadow-amber-500/10 hover:shadow-amber-500/25 group relative"
        >
          <div class="podium-badge -top-4 w-9 h-9 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center text-base shadow-lg shadow-amber-500/40">👑</div>
          <div class="relative my-2">
            <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 group-hover:border-amber-300 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top1) : (top1.avatar || 'assets/default-avatar.svg')}" onerror="this.onerror=null; this.src='assets/default-avatar.svg'" loading="eager" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top1.swatRole) ? getSwatBadgeHtml(top1.swatRole, 'sm') : ''}
            ${(typeof isRoleBadgeHidden === 'function' ? !isRoleBadgeHidden(safeTop1SingleRole) : (safeTop1SingleRole !== '조직원' && safeTop1SingleRole !== '조합원')) && safeTop1SingleRole ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top1, top1.catId) : 'bg-zinc-800 text-white'} shadow-md select-none">
                ${safeTop1SingleRole}
              </span>
            ` : ''}
          </div>
          <div class="h-7 flex items-center justify-center w-full mt-1">
            <h4 class="text-lg font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[90%] text-center">
              <span>${safeTop1Streamer}</span>
            </h4>
          </div>
          <div class="h-5 flex items-center justify-center w-full mb-2">
            <p class="text-xs text-amber-200/90 font-medium truncate max-w-[90%] text-center" title="${safeTop1Name}">
              <span>${safeTop1Name}</span>${safeTop1Role ? ` <span class="text-amber-400/80 text-[11px]">(${safeTop1Role})</span>` : ''}
            </p>
          </div>
          <div class="h-7 flex items-center justify-center w-full mb-3">
            <div class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50 truncate max-w-[90%]" title="${safeTop1Aff}">
              ${safeTop1Aff}
            </div>
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center justify-center h-11">
            <span class="text-lg font-black text-amber-400">${getTabMetric(top1).valStr}</span>
          </div>
        </div>

        <!-- 3위 🥉 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top3.catId}', '${top3.groupId || ''}', '${top3.name}', '${top3.id || ''}')"
          class="podium-card order-3 w-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-amber-700/60 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer shadow-lg hover:shadow-amber-700/15 group relative"
        >
          <div class="podium-badge -top-3 w-7 h-7 rounded-full bg-amber-800/30 border border-amber-700 flex items-center justify-center text-sm shadow">🥉</div>
          <div class="relative my-2">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-700/60 group-hover:border-amber-600 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top3) : (top3.avatar || 'assets/default-avatar.svg')}" onerror="this.onerror=null; this.src='assets/default-avatar.svg'" loading="eager" decoding="async" referrerpolicy="no-referrer" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top3.swatRole) ? getSwatBadgeHtml(top3.swatRole, 'sm') : ''}
            ${(typeof isRoleBadgeHidden === 'function' ? !isRoleBadgeHidden(safeTop3SingleRole) : (safeTop3SingleRole !== '조직원' && safeTop3SingleRole !== '조합원')) && safeTop3SingleRole ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top3, top3.catId) : 'bg-zinc-800 text-white'} shadow-md select-none">
                ${safeTop3SingleRole}
              </span>
            ` : ''}
          </div>
          <div class="h-6 flex items-center justify-center w-full mt-1">
            <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[90%] text-center">
              <span>${safeTop3Streamer}</span>
            </h4>
          </div>
          <div class="h-5 flex items-center justify-center w-full mb-2">
            <p class="text-xs text-zinc-300 truncate max-w-[90%] text-center" title="${safeTop3Name}">
              <span>${safeTop3Name}</span>${safeTop3Role ? ` <span class="text-zinc-500 text-[11px]">(${safeTop3Role})</span>` : ''}
            </p>
          </div>
          <div class="h-7 flex items-center justify-center w-full mb-3">
            <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50 truncate max-w-[90%]" title="${safeTop3Aff}">
              ${safeTop3Aff}
            </div>
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center justify-center h-11">
            <span class="text-base font-bold text-white">${getTabMetric(top3).valStr}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 순위 목록 테이블 (포디움이 있으면 4위부터, 없으면 1위부터 초기 10개 렌더링 후 스크롤 시 10개씩 동적 로딩)
  const initialBatch = tableMembers.slice(0, leaderboardVisibleCount);
  html += `
    <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
      <div class="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-semibold bg-zinc-900/90">
        <div class="w-8 sm:w-12 text-center flex-shrink-0">순위</div>
        <div class="flex-1 px-2 sm:px-3">스트리머 / 인원</div>
        <div class="hidden sm:block w-36 px-2 text-left">소속</div>
        <div class="w-28 sm:w-56 px-1.5 sm:px-2 text-right">기록</div>
        <div class="hidden sm:block w-8"></div>
      </div>

      <div id="leaderboard-ranking-rows" class="divide-y divide-zinc-800/60">
        ${sortedMembers.length === 0 ? `
          <div class="py-16 text-center text-zinc-500">
            <div class="text-3xl mb-2">🔍</div>
            <p class="text-sm font-bold text-zinc-400 mb-1">검색 결과가 없습니다</p>
            <p class="text-xs text-zinc-500">'${typeof escapeHtml === 'function' ? escapeHtml(leaderboardSearchQuery) : leaderboardSearchQuery}' 검색어와 일치하는 스트리머 또는 그룹이 없습니다.</p>
          </div>
        ` : (tableMembers.length === 0 && showPodium) ? `
          <div class="py-6 text-center text-zinc-500 text-xs">
            상위 3위까지의 멤버가 상단 포디움에 표시되어 있습니다.
          </div>
        ` : initialBatch.map((m, idx) => renderLeaderboardRowHtml(m, tableOffset + idx, maxVal)).join("")}
      </div>

      <div id="leaderboard-scroll-sentinel" class="border-t border-zinc-800/40 bg-zinc-950/40"></div>
    </div>
  `;

  dynamicContainer.innerHTML = html;

  updateLeaderboardSentinel(false);
  setupLeaderboardScrollObserver();
  ensureLeaderboardWindowScrollListener();
}

// 순위 리스트에서 멤버 클릭 시 해당 페이지로 바로 이동
function selectMemberFromLeaderboard(catId, groupId, memberName, memberId = null) {
  closeLeaderboardModal();
  if (typeof cleanupLeaderboardListeners === "function") cleanupLeaderboardListeners();

  // 1. 네비게이션 출처 설정 (종합통계에서 이동했음을 기록하여 뒤로가기 시 복귀 지원)
  state.navigationSource = "stats";
  try {
    sessionStorage.setItem("kongbap_nav_source", "stats");
  } catch (e) {}

  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.searchQuery = "";

  let cat = (KONGBAP_DATA.categories || []).find(c => c.id === catId);
  if (!cat) {
    for (const c of (KONGBAP_DATA.categories || [])) {
      if (c.hasSubgroups && Array.isArray(c.groups)) {
        for (const g of c.groups) {
          if ((g.members || []).some(matchFn)) {
            cat = c;
            groupId = g.id;
            break;
          }
        }
      } else if ((c.members || []).some(matchFn)) {
        cat = c;
        break;
      }
      if (cat) break;
    }
  }
  if (!cat) return;
  state.currentCategory = cat.id;

  const matchFn = m => (memberId && String(m.id) === String(memberId)) || m.name === memberName || m.streamer === memberName;

  // 2. 그룹 설정
  if (groupId && cat.hasSubgroups) {
    const grp = (cat.groups || []).find(g => g.id === groupId);
    if (grp) {
      state.currentGroup = grp;
      const mem = (grp.members || []).find(matchFn);
      if (mem) {
        state.currentMember = mem;
      }
    }
  } else {
    const mem = (cat.members || []).find(matchFn);
    if (mem) {
      state.currentMember = mem;
    }
  }

  if (state.currentMember) {
    const allV = state.currentMember.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    if (typeof recordMemberClickPosition === "function") {
      recordMemberClickPosition(state.currentMember.id);
    }
  }

  // 3. 네비게이션 렌더링
  if (typeof saveNavigationState === "function") saveNavigationState();
  if (typeof pushNavHistory === "function") pushNavHistory();
  if (typeof renderCategoryTabs === "function") renderCategoryTabs();
  if (typeof renderContent === "function") renderContent();

  window.scrollTo({ top: 0, behavior: "smooth" });
}


// 전역 노출
window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;
window.setLeaderboardTab = setLeaderboardTab;
window.handleLeaderboardSearch = handleLeaderboardSearch;
window.clearLeaderboardSearch = clearLeaderboardSearch;
window.selectMemberFromLeaderboard = selectMemberFromLeaderboard;
window.renderLeaderboardPage = renderLeaderboardPage;
window.getAllMembersWithLeaderboardStats = getAllMembersWithLeaderboardStats;
window.loadMoreLeaderboardItems = loadMoreLeaderboardItems;
window.cleanupLeaderboardListeners = cleanupLeaderboardListeners;


