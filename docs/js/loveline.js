/**
 * 콩밥특별시 러브라인 & 연애 관계 아카이브 모듈
 */

const DEFAULT_LOVELINES = [];

// 관계 분류 설정: 결혼, 연애, 썸 순서
const LOVELINE_STATUS_CONFIG = {
  all: { label: "전체 보기", emoji: "💕", color: "pink" },
  married: { label: "결혼", emoji: "💍", badge: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  dating: { label: "연애", emoji: "💖", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  some: { label: "썸", emoji: "💌", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  // 이전 데이터 호환 매핑
  couple: { label: "연애", emoji: "💖", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  crush: { label: "썸", emoji: "💌", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  business: { label: "썸", emoji: "💌", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  rival: { label: "썸", emoji: "💌", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" }
};

let lovelineCurrentFilter = "all";
let lovelineSearchQuery = "";

// 러브라인 내부 탭(필터 및 검색어) 초기화 (다른 곳으로 이동 시 "전체"로 리셋)
function resetLovelineFilter() {
  lovelineCurrentFilter = "all";
  lovelineSearchQuery = "";
  const input = document.getElementById("loveline-search-input");
  if (input) input.value = "";
}

// 이전 임의 추가된 목 데이터 ID 집합
const MOCK_LOVELINE_IDS = new Set(["love-1", "love-2", "love-3", "love-4", "love-5"]);

// 로컬 스토리지 데이터 로드 / 저장 (관계 분류 정규화 및 목 데이터 제거)
function getLovelineList() {
  try {
    const saved = localStorage.getItem("kongbap_lovelines_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 임의 추가된 목 데이터(love-1~5) 제거 및 데이터 정제
        const filtered = parsed.filter(item => item && item.id && !MOCK_LOVELINE_IDS.has(item.id));
        filtered.forEach(item => {
          delete item.summary;
          delete item.description;
          delete item.tags;
          delete item.dday;

          // 관계 분류를 '결혼', '연애', '썸' 3종류로 정규화
          if (item.statusType === "married" || item.status === "결혼" || item.status === "결혼O") {
            item.statusType = "married";
            item.status = "결혼";
            item.heartEmoji = "💍";
          } else if (item.statusType === "some" || item.status === "썸" || item.status === "썸 / 호감") {
            item.statusType = "some";
            item.status = "썸";
            item.heartEmoji = "💌";
          } else {
            item.statusType = "dating";
            item.status = "연애";
            item.heartEmoji = "💖";
          }
        });
        if (filtered.length !== parsed.length || !localStorage.getItem("kongbap_lovelines_data")) {
          localStorage.setItem("kongbap_lovelines_data", JSON.stringify(filtered));
        }
        return filtered;
      }
    }
  } catch (e) {
    console.warn("러브라인 로컬 데이터 로드 실패:", e);
  }

  // 로컬 스토리지에 데이터가 없을 때 KONGBAP_DATA 및 카테고리에서 fallback 로드
  if (typeof KONGBAP_DATA !== "undefined" && KONGBAP_DATA) {
    if (Array.isArray(KONGBAP_DATA.lovelines) && KONGBAP_DATA.lovelines.length > 0) {
      return KONGBAP_DATA.lovelines;
    }
    if (Array.isArray(KONGBAP_DATA.categories)) {
      const loveCat = KONGBAP_DATA.categories.find(c => c.id === "loveline");
      if (loveCat && Array.isArray(loveCat.lovelines) && loveCat.lovelines.length > 0) {
        return loveCat.lovelines;
      }
    }
  }

  return [];
}

function saveLovelineList(list, actionReason = null) {
  try {
    const cleaned = (list || []).map(item => {
      const copy = { ...item };
      delete copy.summary;
      delete copy.description;
      delete copy.tags;
      delete copy.dday;

      if (copy.statusType === "married" || copy.status === "결혼" || copy.status === "결혼O") {
        copy.statusType = "married";
        copy.status = "결혼";
        copy.heartEmoji = "💍";
      } else if (copy.statusType === "some" || copy.status === "썸" || copy.status === "썸 / 호감") {
        copy.statusType = "some";
        copy.status = "썸";
        copy.heartEmoji = "💌";
      } else {
        copy.statusType = "dating";
        copy.status = "연애";
        copy.heartEmoji = "💖";
      }

      return copy;
    });

    localStorage.setItem("kongbap_lovelines_data", JSON.stringify(cleaned));

    if (typeof KONGBAP_DATA !== "undefined" && KONGBAP_DATA) {
      KONGBAP_DATA.lovelines = cleaned;
      if (Array.isArray(KONGBAP_DATA.categories)) {
        const loveCat = KONGBAP_DATA.categories.find(c => c.id === "loveline");
        if (loveCat) {
          loveCat.lovelines = cleaned;
        }
      }
    }

    if (typeof persistData === "function") {
      persistData();
    }
    if (typeof renderCategoryTabs === "function") {
      renderCategoryTabs();
    }

    // 러브라인 변경 시 백업 스냅샷 자동 생성
    if (actionReason && typeof createBackupSnapshot === "function") {
      createBackupSnapshot(actionReason, false);
    }
  } catch (e) {
    console.error("러브라인 저장 실패:", e);
  }
}

// 빠른 O(1) ID 매칭 맵 및 리스트 색인 캐시
let _systemMemberIndexCache = null;
function getSystemMemberIndex() {
  if (_systemMemberIndexCache) return _systemMemberIndexCache;
  const idMap = new Map();
  const allList = [];
  if (KONGBAP_DATA && Array.isArray(KONGBAP_DATA.categories)) {
    for (const cat of KONGBAP_DATA.categories) {
      if (cat.id === "loveline" || cat.id === "guide") continue;
      if (cat.hasSubgroups && Array.isArray(cat.groups)) {
        for (const g of cat.groups) {
          for (const m of (g.members || [])) {
            const entry = { member: m, category: cat, group: g };
            if (m.id) idMap.set(String(m.id).toLowerCase(), entry);
            allList.push(entry);
          }
        }
      } else if (Array.isArray(cat.members)) {
        for (const m of cat.members) {
          const entry = { member: m, category: cat, group: null };
          if (m.id) idMap.set(String(m.id).toLowerCase(), entry);
          allList.push(entry);
        }
      }
    }
  }
  _systemMemberIndexCache = { idMap, allList };
  return _systemMemberIndexCache;
}

// 멤버 객체 조회 도우미 (memberId 또는 이름/스트리머명/별칭으로 시스템 멤버 탐색)
function findSystemMember(memberId, name, streamer) {
  const index = getSystemMemberIndex();
  const idTarget = memberId ? String(memberId).trim().toLowerCase() : "";
  const nameTarget = name ? String(name).trim().toLowerCase() : "";
  const streamerTarget = streamer ? String(streamer).trim().toLowerCase() : "";

  // 1순위: memberId로 직접 O(1) 매칭
  if (idTarget && index.idMap.has(idTarget)) {
    return index.idMap.get(idTarget);
  }

  // 2순위: 이름 또는 스트리머명으로 매칭 (슬래시 구분 별칭 지원: 예 "수선화 / 선화", "박정의 / 밥좀우 / 피닉스박")
  const targets = [nameTarget, streamerTarget].filter(Boolean);
  if (targets.length === 0) return null;

  for (const entry of index.allList) {
    const m = entry.member;
    const mId = (m.id || "").toLowerCase().trim();
    const mStreamer = (m.streamer || "").toLowerCase().trim();
    const mName = (m.name || "").toLowerCase().trim();
    const nameParts = mName.split("/").map(s => s.trim().toLowerCase()).filter(Boolean);

    for (const t of targets) {
      if (mId && mId === t) return entry;
      if (mStreamer && mStreamer === t) return entry;
      if (mName && mName === t) return entry;
      if (nameParts.includes(t)) return entry;
    }
  }

  return null;
}

// 멤버 상세 영상으로 바로가기 (연애/결혼/썸 카드 인원 클릭 시 영상 페이지 전환)
function navigateToLovelineMember(memberIdOrObj, name = "", streamer = "") {
  let targetId = "";
  let targetName = "";
  let targetStreamer = "";

  if (typeof memberIdOrObj === "object" && memberIdOrObj !== null) {
    targetId = memberIdOrObj.memberId || memberIdOrObj.id || "";
    targetName = memberIdOrObj.name || "";
    targetStreamer = memberIdOrObj.streamer || "";
  } else if (typeof memberIdOrObj === "string") {
    targetId = memberIdOrObj;
    targetName = name || memberIdOrObj;
    targetStreamer = streamer || memberIdOrObj;
  }

  const result = findSystemMember(targetId, targetName, targetStreamer);
  if (result && result.member) {
    resetLovelineFilter();
    if (typeof recordMemberClickPosition === "function") {
      recordMemberClickPosition(result.member.id);
    }
    // 러브라인 진입 출처 명시
    if (typeof state !== "undefined") {
      state.navigationSource = "loveline";
    }
    // 표준 검색/직접 이동 함수 호출
    if (typeof selectMemberFromSearch === "function") {
      selectMemberFromSearch(result.category.id, result.group ? result.group.id : null, result.member.id, "loveline");
      return;
    }
    if (typeof selectDirectMember === "function") {
      selectDirectMember(result.member.id);
      if (typeof state !== "undefined") state.navigationSource = "loveline";
      return;
    }
    // 상태 직접 갱신 fallback
    if (typeof state !== "undefined") {
      state.currentCategory = result.category.id;
      state.currentGroup = result.group || null;
      state.currentMember = result.member;
      state.navigationSource = "loveline";
      const allV = result.member.videos || [];
      state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
      state.searchQuery = "";
      if (typeof isSearchHistoryPushed !== "undefined") isSearchHistoryPushed = false;
      if (typeof clearSearchInput === "function") clearSearchInput();
      if (typeof saveNavigationState === "function") saveNavigationState();
      if (typeof pushNavHistory === "function") pushNavHistory();
      if (typeof renderContent === "function") renderContent();
      window.scrollTo(0, 0);
      return;
    }
  }
  if (typeof showToast === "function") {
    showToast(`등록된 영상 정보가 아직 없습니다.`);
  }
}

// 인원 카드 프로필 클릭 이벤트 핸들러
function handleLovelineMemberCardClick(el) {
  const isDragged = typeof window.hasActuallyDragged === "function" ? window.hasActuallyDragged() : !!window.hasActuallyDragged;
  if (isDragged) return;
  if (!el) return;
  const memberId = el.getAttribute("data-member-id") || "";
  const name = el.getAttribute("data-name") || "";
  const streamer = el.getAttribute("data-streamer") || "";
  navigateToLovelineMember(memberId, name, streamer);
}

// 메인 뷰 렌더링
function renderLovelineContent(container) {
  if (!container) return;

  const lovelines = getLovelineList();
  const totalCount = lovelines.length;

  // 필터링
  const filtered = lovelines.filter(item => {
    if (lovelineCurrentFilter !== "all" && item.statusType !== lovelineCurrentFilter) {
      return false;
    }
    return true;
  });

  const marriedCount = lovelines.filter(l => l.statusType === "married").length;
  const datingCount = lovelines.filter(l => l.statusType === "dating").length;
  const someCount = lovelines.filter(l => l.statusType === "some").length;

  const adminMode = typeof isAdmin === "function" ? isAdmin() : false;

  container.innerHTML = `
    <!-- 1. 러브라인 배너 헤더 -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-950/70 via-zinc-900 to-rose-950/70 border border-pink-500/30 p-5 sm:p-7 mb-6 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -left-10 -top-10 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <span>러브라인 & 연애</span>
            <span class="text-pink-400 text-sm sm:text-base font-medium">Couples & Romance</span>
          </h2>
        </div>

        <!-- 우측 요약 카운터 (결혼, 연애, 썸 순서) & 어드민 등록 버튼 -->
        <div class="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-start md:justify-end">
          <div class="flex items-center gap-2 bg-zinc-950/70 border border-pink-500/30 px-3.5 py-2 rounded-2xl text-xs flex-wrap sm:flex-nowrap">
            <span class="font-extrabold text-pink-400 text-sm whitespace-nowrap">${totalCount}커플</span>
            <span class="text-zinc-700">|</span>
            <span class="text-purple-400 font-bold whitespace-nowrap">💍 결혼 ${marriedCount}</span>
            <span class="text-zinc-700">|</span>
            <span class="text-rose-400 font-bold whitespace-nowrap">💖 연애 ${datingCount}</span>
            <span class="text-zinc-700">|</span>
            <span class="text-amber-400 font-bold whitespace-nowrap">💌 썸 ${someCount}</span>
          </div>

          ${adminMode ? `
            <button 
              onclick="openLovelineModal()" 
              class="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-pink-600/30 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <span>+</span>
              <span>새 러브라인 등록</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- 2. 필터 버튼 -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 flex-nowrap mb-6 pb-4 border-b border-zinc-800/80">
      ${renderLovelineFilterButtons(totalCount, marriedCount, datingCount, someCount)}
    </div>

    <!-- 3. 커플 카드 그리드 리스트 (1행당 2개씩 배치) -->
    ${filtered.length > 0 ? `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        ${filtered.map((c, idx) => renderCoupleCard(c, adminMode, idx, filtered.length)).join("")}
      </div>
    ` : `
      <div class="flex flex-col items-center justify-center py-20 text-center px-4 rounded-3xl bg-zinc-950/40 border border-zinc-850">
        <div class="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center text-3xl mb-4">
          ${totalCount === 0 ? '💕' : '💔'}
        </div>
        <h3 class="text-base font-bold text-zinc-300 mb-1">
          ${totalCount === 0 ? '등록된 러브라인이 없습니다' : '해당 필터에 등록된 러브라인이 없습니다'}
        </h3>
        <p class="text-xs text-zinc-500 mb-4">
          ${totalCount === 0 ? (adminMode ? '새 러브라인 등록 버튼을 눌러 러브라인을 추가해 보세요.' : '현재 등록된 러브라인 정보가 없습니다.') : '다른 필터를 선택하거나 새로운 러브라인을 등록해 보세요.'}
        </p>
        ${totalCount === 0 && adminMode ? `
          <button 
            onclick="openLovelineModal()" 
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            + 새 러브라인 등록하기
          </button>
        ` : (lovelineCurrentFilter !== "all" ? `
          <button 
            onclick="setLovelineFilter('all')" 
            class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            전체 목록 보기
          </button>
        ` : '')}
      </div>
    `}
  `;
}

// 필터 버튼 렌더러 (순서: 전체, 결혼, 연애, 썸)
function renderLovelineFilterButtons(totalCount, marriedCount, datingCount, someCount) {
  const filters = [
    { id: "all", label: "전체", count: totalCount },
    { id: "married", label: "💍 결혼", count: marriedCount },
    { id: "dating", label: "💖 연애", count: datingCount },
    { id: "some", label: "💌 썸", count: someCount }
  ];

  return filters.map(f => {
    const isActive = lovelineCurrentFilter === f.id;
    const activeClass = isActive
      ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30 font-extrabold"
      : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-zinc-800 font-medium";

    return `
      <button 
        onclick="setLovelineFilter('${f.id}')" 
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${activeClass}"
      >
        <span>${f.label}</span>
        ${f.count !== undefined ? `<span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">${f.count}</span>` : ''}
      </button>
    `;
  }).join("");
}

// 개별 커플 카드 렌더링 (인원 1명 [하트] 인원 1명 UI)
function renderCoupleCard(couple, adminMode, cIndex = 0, totalCount = 1) {
  const p1 = couple.person1 || {};
  const p2 = couple.person2 || {};

  const p1Avatar = p1.avatar || "assets/default-avatar.svg";
  const p2Avatar = p2.avatar || "assets/default-avatar.svg";

  const statusCfg = LOVELINE_STATUS_CONFIG[couple.statusType] || LOVELINE_STATUS_CONFIG.dating;
  const badgeClass = statusCfg.badge || "bg-pink-500/20 text-pink-300 border-pink-500/40";

  const dragAttrs = adminMode ? `
    draggable="true"
    data-drag-type="loveline"
    data-drag-id="${couple.id}"
    ondragstart="handleCardDragStart(event, 'loveline', '${couple.id}')"
    ondragover="handleCardDragOver(event)"
    ondragleave="handleCardDragLeave(event)"
    ondrop="handleCardDrop(event, 'loveline', '${couple.id}')"
    ondragend="handleCardDragEnd(event)"
  ` : `draggable="false"`;
  const cursorClass = adminMode ? "cursor-grab active:cursor-grabbing" : "";
  const memberCursorClass = adminMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";

  return `
    <div 
      id="loveline-card-${couple.id}"
      data-loveline-id="${couple.id}"
      ${dragAttrs}
      class="group relative rounded-3xl bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-pink-950/20 border border-zinc-800/90 hover:border-pink-500/50 p-4 sm:p-5 shadow-xl hover:shadow-[0_0_25px_rgba(244,114,182,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden select-none ${cursorClass}"
    >
      <!-- 상단 장식 빛 -->
      <div class="absolute -top-12 -right-12 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all pointer-events-none"></div>

      <!-- 1. 카드 헤더: 상태 뱃지 & 어드민 컨트롤 (직업 인원창처럼 ✏️, 🗑️ 아이콘만 배치) -->
      <div class="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-800/60">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}">
            <span>${couple.heartEmoji || statusCfg.emoji || '💖'}</span>
            <span>${escapeHtml(couple.status || statusCfg.label)}</span>
          </span>
        </div>

        ${adminMode ? `
          <div class="flex items-center gap-1.5 ml-2 flex-shrink-0 card-header-actions" onclick="event.stopPropagation()">
            <button 
              type="button"
              onclick="openLovelineModal('${couple.id}')" 
              title="수정" 
              class="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer flex-shrink-0"
            >
              ✏️
            </button>
            <button 
              type="button"
              onclick="confirmDeleteLoveline('${couple.id}')" 
              title="삭제" 
              class="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white text-xs border border-red-800/40 cursor-pointer flex-shrink-0"
            >
              🗑️
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 2. 메인 커플 스테이지 (인원 1명 [하트] 인원 1명) -->
      <div class="flex items-center justify-between gap-2 sm:gap-4 my-1 sm:my-2">
        <!-- 인원 1 프로필 박스 -->
        <div 
          data-member-id="${escapeHtml(p1.memberId || '')}"
          data-name="${escapeHtml(p1.name || '')}"
          data-streamer="${escapeHtml(p1.streamer || '')}"
          onclick="handleLovelineMemberCardClick(this)" 
          title="${escapeHtml(p1.name)} (${escapeHtml(p1.streamer)}) 영상 보러가기"
          class="flex-1 flex flex-col items-center text-center p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-pink-500/40 hover:bg-pink-950/10 transition-all ${memberCursorClass} group/p1 select-none"
        >
          <div class="relative mb-2">
            <img 
              src="${escapeHtml(p1Avatar)}" 
              alt="${escapeHtml(p1.name)}"
              draggable="false"
              class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-zinc-700 group-hover/p1:ring-pink-400 transition-all shadow-md bg-zinc-900"
              onerror="this.src='assets/default-avatar.svg'"
              loading="lazy"
            />
            <span class="absolute -bottom-1 -right-1 text-xs">✨</span>
          </div>
          <h4 class="font-black text-white text-sm sm:text-base group-hover/p1:text-pink-300 transition-colors truncate max-w-full">
            ${escapeHtml(p1.name || '미등록')}
          </h4>
          <span class="text-[11px] text-zinc-400 truncate max-w-full mt-0.5">
            @${escapeHtml(p1.streamer || p1.name || '')}
          </span>
          ${p1.badge ? `
            <span class="mt-1.5 text-[10px] px-2 py-0.5 rounded-md font-bold truncate max-w-full ${p1.badgeColor || 'bg-zinc-800 text-zinc-300'}">
              ${escapeHtml(p1.badge)}
            </span>
          ` : (p1.role ? `
            <span class="mt-1.5 text-[10px] px-2 py-0.5 rounded-md font-medium text-zinc-400 bg-zinc-800/80 truncate max-w-full">
              ${escapeHtml(p1.role)}
            </span>
          ` : '')}
        </div>

        <!-- 중앙 하트 커넥터 (문구 없이 깔끔한 하트 아이콘만 표시) -->
        <div class="flex-shrink-0 flex flex-col items-center justify-center px-1 sm:px-2 select-none">
          <div class="relative flex items-center justify-center">
            <!-- 펄스 링 애니메이션 -->
            <div class="absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-pink-500/20 animate-ping opacity-75 pointer-events-none"></div>
            
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-pink-600/30 via-rose-500/30 to-pink-500/40 border-2 border-pink-500/60 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-pink-500/30 group-hover:scale-110 transition-transform duration-300">
              <span class="drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]">${couple.heartEmoji || statusCfg.emoji || '💖'}</span>
            </div>
          </div>
        </div>

        <!-- 인원 2 프로필 박스 -->
        <div 
          data-member-id="${escapeHtml(p2.memberId || '')}"
          data-name="${escapeHtml(p2.name || '')}"
          data-streamer="${escapeHtml(p2.streamer || '')}"
          onclick="handleLovelineMemberCardClick(this)" 
          title="${escapeHtml(p2.name)} (${escapeHtml(p2.streamer)}) 영상 보러가기"
          class="flex-1 flex flex-col items-center text-center p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-pink-500/40 hover:bg-pink-950/10 transition-all ${memberCursorClass} group/p2 select-none"
        >
          <div class="relative mb-2">
            <img 
              src="${escapeHtml(p2Avatar)}" 
              alt="${escapeHtml(p2.name)}"
              draggable="false"
              class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-zinc-700 group-hover/p2:ring-pink-400 transition-all shadow-md bg-zinc-900"
              onerror="this.src='assets/default-avatar.svg'"
              loading="lazy"
            />
            <span class="absolute -bottom-1 -right-1 text-xs">✨</span>
          </div>
          <h4 class="font-black text-white text-sm sm:text-base group-hover/p2:text-pink-300 transition-colors truncate max-w-full">
            ${escapeHtml(p2.name || '미등록')}
          </h4>
          <span class="text-[11px] text-zinc-400 truncate max-w-full mt-0.5">
            @${escapeHtml(p2.streamer || p2.name || '')}
          </span>
          ${p2.badge ? `
            <span class="mt-1.5 text-[10px] px-2 py-0.5 rounded-md font-bold truncate max-w-full ${p2.badgeColor || 'bg-zinc-800 text-zinc-300'}">
              ${escapeHtml(p2.badge)}
            </span>
          ` : (p2.role ? `
            <span class="mt-1.5 text-[10px] px-2 py-0.5 rounded-md font-medium text-zinc-400 bg-zinc-800/80 truncate max-w-full">
              ${escapeHtml(p2.role)}
            </span>
          ` : '')}
        </div>
      </div>
    </div>
  `;
}

function setLovelineFilter(filterId) {
  lovelineCurrentFilter = filterId;
  const mainContent = document.getElementById("main-content");
  if (mainContent) renderLovelineContent(mainContent);
}

function handleLovelineSearch(val) {
  lovelineSearchQuery = (val || "").trim();
  const mainContent = document.getElementById("main-content");
  if (mainContent) renderLovelineContent(mainContent);
}

function clearLovelineSearch() {
  lovelineSearchQuery = "";
  const input = document.getElementById("loveline-search-input");
  if (input) input.value = "";
  const mainContent = document.getElementById("main-content");
  if (mainContent) renderLovelineContent(mainContent);
}

// ====================================================
// 어드민 모달 (검색 기반 인원 1 - 관계 - 인원 2 선택 모달)
// ====================================================
let lovelineModalEditingId = null;
let lovelineModalP1 = null; // { name, streamer, badge, badgeColor, avatar, memberId, role }
let lovelineModalP2 = null; // { name, streamer, badge, badgeColor, avatar, memberId, role }
let lovelineModalStatusType = "married"; // "married", "dating", "some"
let lovelineModalStatusText = "결혼";
let lovelineModalHeartEmoji = "💍";

// 검색 가능한 전체 멤버 목록 수집 (캐싱 적용)
let _searchableMembersCache = null;
function getAllSearchableMembers() {
  if (_searchableMembersCache) return _searchableMembersCache;
  const list = [];
  if (!KONGBAP_DATA || !Array.isArray(KONGBAP_DATA.categories)) return list;

  KONGBAP_DATA.categories.forEach(cat => {
    if (cat.id === "loveline" || cat.id === "guide") return;
    const catName = cat.name || "";
    const catEmoji = cat.emoji || "";
    const theme = (typeof COLOR_THEMES !== "undefined" && COLOR_THEMES[cat.color]) 
      ? COLOR_THEMES[cat.color] 
      : { badge: "bg-zinc-800 text-zinc-300 border-zinc-700" };
    const badgeClass = theme.badge || "bg-zinc-800 text-zinc-300 border-zinc-700";

    if (cat.hasSubgroups && Array.isArray(cat.groups)) {
      cat.groups.forEach(g => {
        (g.members || []).forEach(m => {
          list.push({
            id: m.id || `mem-${m.name}-${m.streamer}`,
            name: m.name || "",
            streamer: m.streamer || "",
            avatar: m.avatar || "assets/default-avatar.svg",
            role: m.role || "",
            badge: `${catEmoji} ${g.name || catName}`.trim(),
            badgeColor: badgeClass,
            categoryName: catName,
            groupName: g.name
          });
        });
      });
    } else if (Array.isArray(cat.members)) {
      cat.members.forEach(m => {
        list.push({
          id: m.id || `mem-${m.name}-${m.streamer}`,
          name: m.name || "",
          streamer: m.streamer || "",
          avatar: m.avatar || "assets/default-avatar.svg",
          role: m.role || "",
          badge: `${catEmoji} ${catName}`.trim(),
          badgeColor: badgeClass,
          categoryName: catName,
          groupName: null
        });
      });
    }
  });

  _searchableMembersCache = list;
  return _searchableMembersCache;
}

function openLovelineModal(coupleId = null) {
  lovelineModalEditingId = coupleId;
  const list = getLovelineList();
  const couple = coupleId ? list.find(l => l.id === coupleId) : null;

  if (couple) {
    lovelineModalP1 = couple.person1 ? { ...couple.person1 } : null;
    lovelineModalP2 = couple.person2 ? { ...couple.person2 } : null;

    if (couple.statusType === "married" || couple.status === "결혼" || couple.status === "결혼O") {
      lovelineModalStatusType = "married";
    } else if (couple.statusType === "some" || couple.status === "썸" || couple.status === "썸 / 호감") {
      lovelineModalStatusType = "some";
    } else {
      lovelineModalStatusType = "dating";
    }

    const statusCfg = LOVELINE_STATUS_CONFIG[lovelineModalStatusType] || LOVELINE_STATUS_CONFIG.married;
    lovelineModalStatusText = couple.status || statusCfg.label;
    lovelineModalHeartEmoji = couple.heartEmoji || statusCfg.emoji || "💍";
  } else {
    lovelineModalP1 = null;
    lovelineModalP2 = null;
    lovelineModalStatusType = "married";
    lovelineModalStatusText = "결혼";
    lovelineModalHeartEmoji = "💍";
  }

  let modal = document.getElementById("loveline-admin-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "loveline-admin-modal";
    modal.className = "fixed inset-0 z-50 bg-black/85 backdrop-blur-sm hidden items-center justify-center p-3 sm:p-5 select-none";
    document.body.appendChild(modal);
  }

  renderLovelineModal();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeLovelineModal() {
  const modal = document.getElementById("loveline-admin-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function renderLovelineModal() {
  const modal = document.getElementById("loveline-admin-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div class="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 md:p-7 flex flex-col" style="scrollbar-gutter: stable;" onclick="event.stopPropagation()">
      <!-- 모달 헤더 -->
      <div class="flex items-center justify-between pb-3.5 border-b border-zinc-800 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 text-lg shadow-sm">
            💕
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-black text-white">
              ${lovelineModalEditingId ? '러브라인 관계 수정' : '새 러브라인 등록'}
            </h3>
            <p class="text-[11px] sm:text-xs text-zinc-400">
              좌측 인원, 관계 분류(결혼 / 연애 / 썸), 우측 인원을 검색하여 선택하세요.
            </p>
          </div>
        </div>
        <button 
          onclick="closeLovelineModal()" 
          class="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="닫기"
        >
          ✕
        </button>
      </div>

      <!-- 메인 3단 스테이지 (왼쪽 사람선택 | 관계 선택 | 오른쪽 사람선택 - 완전 대칭 1:1 보장) -->
      <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch my-2">
        <!-- 1. 왼쪽 사람 선택 -->
        <div id="modal-person-container-1" class="flex flex-col h-full min-w-0">
          ${renderModalPersonBox(1, lovelineModalP1)}
        </div>

        <!-- 2. 중앙 관계 & 하트 선택 -->
        <div id="modal-relation-container" class="flex flex-col h-full min-w-0">
          ${renderModalRelationBox()}
        </div>

        <!-- 3. 오른쪽 사람 선택 -->
        <div id="modal-person-container-2" class="flex flex-col h-full min-w-0">
          ${renderModalPersonBox(2, lovelineModalP2)}
        </div>
      </div>

      <!-- 모달 하단 액션 버튼 -->
      <div class="flex items-center justify-between pt-4 border-t border-zinc-800/80 mt-3">
        <div class="text-[11px] text-zinc-500 hidden sm:flex items-center gap-1.5">
          <span>💡</span>
          <span>검색을 통해 두 인원을 모두 선택한 후 저장을 눌러주세요.</span>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            type="button" 
            onclick="closeLovelineModal()" 
            class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            취소
          </button>
          <button 
            type="button" 
            onclick="handleSaveLovelineFromModal()" 
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 hover:shadow-pink-600/50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>💕</span>
            <span>저장 완료</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// 인원 선택 박스 렌더러 (선택 완료 시 카드 프리뷰, 미선택 시 실시간 검색 인터페이스)
function renderModalPersonBox(targetNum, person) {
  const isLeft = targetNum === 1;
  const title = isLeft ? "인원 1 (좌측)" : "인원 2 (우측)";
  const arrow = isLeft ? "👈" : "👉";

  if (person) {
    const avatar = person.avatar || "assets/default-avatar.svg";
    return `
      <div class="flex-1 flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-pink-500/40 relative shadow-inner group min-w-0">
        <div class="flex items-center justify-between pb-2.5 border-b border-zinc-800/60 mb-2">
          <span class="text-xs font-bold text-pink-400 flex items-center gap-1">
            <span>${arrow}</span>
            <span>${title}</span>
          </span>
          <button 
            type="button" 
            onclick="clearModalMember(${targetNum})" 
            class="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 border border-zinc-700/60"
            title="다른 사람으로 변경"
          >
            <span>🔄</span>
            <span>변경</span>
          </button>
        </div>

        <div class="flex-1 flex flex-col items-center justify-center text-center py-4 my-auto">
          <div class="relative mb-3">
            <img 
              src="${escapeHtml(avatar)}" 
              alt="${escapeHtml(person.name)}"
              class="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl object-cover ring-2 ring-pink-500/70 shadow-xl bg-zinc-900"
              onerror="this.src='assets/default-avatar.svg'"
            />
            <span class="absolute -bottom-1 -right-1 text-sm sm:text-base">✨</span>
          </div>
          <h4 class="text-base sm:text-lg font-black text-white truncate max-w-full">
            ${escapeHtml(person.name)}
          </h4>
          <span class="text-xs text-zinc-400 truncate max-w-full mt-0.5">
            @${escapeHtml(person.streamer || person.name)}
          </span>
          ${person.badge ? `
            <span class="mt-2.5 text-[11px] px-2.5 py-0.5 rounded-md font-bold truncate max-w-full border ${person.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'}">
              ${escapeHtml(person.badge)}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 미선택 상태: 검색창 및 실시간 결과 목록
  return `
    <div class="flex-1 flex flex-col p-3.5 sm:p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 shadow-inner min-w-0">
      <div class="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800/60">
        <span class="text-xs font-bold text-pink-400 flex items-center gap-1">
          <span>${arrow}</span>
          <span>${title}</span>
        </span>
        <span class="text-[11px] text-zinc-500">멤버 검색</span>
      </div>

      <!-- 검색 입력창 -->
      <div class="relative mb-2.5">
        <input 
          type="text" 
          id="modal-search-input-${targetNum}" 
          oninput="handleModalMemberSearchInput(${targetNum}, this.value)" 
          placeholder="이름 / 스트리머 / 소속 검색..." 
          class="w-full bg-zinc-900/90 border border-zinc-700/80 focus:border-pink-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all shadow-inner"
        />
        <span class="absolute left-2.5 top-2 text-xs text-zinc-500 pointer-events-none">🔍</span>
      </div>

      <!-- 검색 결과 스크롤 목록 -->
      <div 
        id="modal-search-results-${targetNum}" 
        class="flex-1 max-h-56 sm:max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 select-text"
        style="scrollbar-gutter: stable;"
      >
        ${renderModalSearchResultsHtml(targetNum, "")}
      </div>
    </div>
  `;
}

// 검색 결과 리스트 렌더링
function renderModalSearchResultsHtml(targetNum, query = "") {
  const members = getAllSearchableMembers();
  const q = query.trim().toLowerCase();

  const filtered = q
    ? members.filter(m => {
        const text = `${m.name} ${m.streamer} ${m.role} ${m.categoryName} ${m.groupName || ''} ${m.badge}`.toLowerCase();
        return text.includes(q);
      })
    : members;

  if (filtered.length === 0) {
    return `
      <div class="p-4 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-1">
        <span>일치하는 멤버가 없습니다.</span>
      </div>
    `;
  }

  return filtered.map(m => `
    <button 
      type="button" 
      onclick="selectModalMember(${targetNum}, '${escapeHtml(m.id)}')"
      class="w-full flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/70 hover:bg-pink-950/30 border border-zinc-800/80 hover:border-pink-500/50 transition-all text-left cursor-pointer group min-w-0"
    >
      <img 
        src="${escapeHtml(m.avatar || 'assets/default-avatar.svg')}" 
        alt="${escapeHtml(m.name)}"
        class="w-8 h-8 rounded-lg object-cover ring-1 ring-zinc-700 group-hover:ring-pink-400 bg-zinc-800 flex-shrink-0"
        onerror="this.src='assets/default-avatar.svg'"
      />
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-white group-hover:text-pink-300 truncate">
          ${escapeHtml(m.name)} <span class="text-[10px] text-zinc-400 font-normal">(@${escapeHtml(m.streamer)})</span>
        </div>
        <div class="text-[10px] text-zinc-400 truncate mt-0.5">
          ${escapeHtml(m.badge || m.role || '')}
        </div>
      </div>
      <span class="text-[11px] text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1 font-semibold flex-shrink-0">
        선택 →
      </span>
    </button>
  `).join("");
}

// 실시간 검색 인풋 핸들러 (포커스 유지)
function handleModalMemberSearchInput(targetNum, value) {
  const container = document.getElementById(`modal-search-results-${targetNum}`);
  if (container) {
    container.innerHTML = renderModalSearchResultsHtml(targetNum, value);
  }
}

// 인원 선택 시 처리
function selectModalMember(targetNum, memberId) {
  const members = getAllSearchableMembers();
  const found = members.find(m => String(m.id) === String(memberId));
  if (!found) return;

  const personObj = {
    name: found.name,
    streamer: found.streamer,
    avatar: found.avatar,
    badge: found.badge,
    badgeColor: found.badgeColor,
    role: found.role,
    memberId: found.id
  };

  if (targetNum === 1) {
    lovelineModalP1 = personObj;
  } else {
    lovelineModalP2 = personObj;
  }

  const personContainer = document.getElementById(`modal-person-container-${targetNum}`);
  if (personContainer) {
    personContainer.innerHTML = renderModalPersonBox(targetNum, personObj);
  }
}

// 인원 선택 취소 / 다시 검색
function clearModalMember(targetNum) {
  if (targetNum === 1) lovelineModalP1 = null;
  else lovelineModalP2 = null;

  const personContainer = document.getElementById(`modal-person-container-${targetNum}`);
  if (personContainer) {
    personContainer.innerHTML = renderModalPersonBox(targetNum, null);
  }
}

// 중앙 관계 & 하트 설정 박스 렌더러 (순서: 결혼, 연애, 썸)
function renderModalRelationBox() {
  const emojis = ['💍', '💖', '💌'];

  return `
    <div class="flex-1 flex flex-col justify-between p-4 rounded-2xl bg-zinc-950/80 border border-pink-500/30 space-y-3.5 shadow-inner min-w-0">
      <div class="text-center pb-2 border-b border-zinc-800/60 relative flex items-center justify-center">
        <span class="text-xs font-bold text-pink-400 flex items-center justify-center gap-1">
          <span>💖</span>
          <span>관계 및 아이콘</span>
        </span>
        <button 
          type="button" 
          onclick="swapModalMembers()" 
          title="좌우 인원 위치 교체" 
          class="absolute right-0 text-[11px] px-1.5 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
        >
          ⇄
        </button>
      </div>

      <!-- 하트 프리뷰 -->
      <div class="flex flex-col items-center justify-center my-1">
        <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-600/30 via-rose-500/30 to-pink-500/40 border-2 border-pink-500/60 flex items-center justify-center text-3xl shadow-lg shadow-pink-500/30 transition-transform">
          <span id="modal-heart-preview">${escapeHtml(lovelineModalHeartEmoji)}</span>
        </div>
        <span id="modal-status-preview" class="mt-2 text-[11px] font-extrabold text-pink-300 px-2.5 py-0.5 rounded-full bg-pink-950/80 border border-pink-800/60 shadow-sm">
          ${escapeHtml(lovelineModalStatusText)}
        </span>
      </div>

      <!-- 관계 분류 선택 (순서: 결혼, 연애, 썸) -->
      <div class="space-y-1">
        <label class="block text-[11px] text-zinc-400 font-semibold text-center">관계 분류</label>
        <select 
          id="love-status-type" 
          onchange="handleModalStatusTypeChange(this.value)" 
          class="w-full bg-zinc-900 border border-zinc-700/80 focus:border-pink-500 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer text-center font-bold"
        >
          <option value="married" ${lovelineModalStatusType === 'married' ? 'selected' : ''}>💍 결혼</option>
          <option value="dating" ${lovelineModalStatusType === 'dating' ? 'selected' : ''}>💖 연애</option>
          <option value="some" ${lovelineModalStatusType === 'some' ? 'selected' : ''}>💌 썸</option>
        </select>
      </div>

      <!-- 상태 표시 문구 -->
      <div class="space-y-1">
        <label class="block text-[11px] text-zinc-400 font-semibold text-center">표시 문구</label>
        <input 
          type="text" 
          id="love-status-text" 
          value="${escapeHtml(lovelineModalStatusText)}" 
          oninput="handleModalStatusTextInput(this.value)"
          class="w-full bg-zinc-900 border border-zinc-700/80 focus:border-pink-500 rounded-xl px-2.5 py-1.5 text-xs text-white text-center outline-none font-bold" 
          placeholder="예: 결혼, 연애, 썸"
        />
      </div>

      <!-- 아이콘 선택 (💍, 💖, 💌) -->
      <div class="space-y-1">
        <label class="block text-[11px] text-zinc-400 font-semibold text-center">아이콘</label>
        <div id="modal-emoji-picker" class="flex justify-center gap-2.5">
          ${emojis.map(e => `
            <button 
              type="button" 
              onclick="selectModalHeartEmoji('${e}')"
              class="w-10 h-10 rounded-xl ${lovelineModalHeartEmoji === e ? 'bg-pink-600/40 border-pink-500 text-white shadow-md' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'} border flex items-center justify-center text-lg transition-all cursor-pointer"
            >
              ${e}
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function handleModalStatusTypeChange(type) {
  if (type === "married") {
    lovelineModalStatusType = "married";
  } else if (type === "some") {
    lovelineModalStatusType = "some";
  } else {
    lovelineModalStatusType = "dating";
  }

  const cfg = LOVELINE_STATUS_CONFIG[lovelineModalStatusType] || LOVELINE_STATUS_CONFIG.married;
  lovelineModalStatusText = cfg.label;
  lovelineModalHeartEmoji = cfg.emoji;

  const previewHeart = document.getElementById("modal-heart-preview");
  if (previewHeart) previewHeart.textContent = lovelineModalHeartEmoji;

  const previewStatus = document.getElementById("modal-status-preview");
  if (previewStatus) previewStatus.textContent = lovelineModalStatusText;

  const statusTextInput = document.getElementById("love-status-text");
  if (statusTextInput) statusTextInput.value = lovelineModalStatusText;

  const emojiContainer = document.getElementById("modal-emoji-picker");
  if (emojiContainer) {
    const emojis = ['💍', '💖', '💌'];
    emojiContainer.innerHTML = emojis.map(e => `
      <button 
        type="button" 
        onclick="selectModalHeartEmoji('${e}')"
        class="w-10 h-10 rounded-xl ${lovelineModalHeartEmoji === e ? 'bg-pink-600/40 border-pink-500 text-white shadow-md' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'} border flex items-center justify-center text-lg transition-all cursor-pointer"
      >
        ${e}
      </button>
    `).join("");
  }
}

function handleModalStatusTextInput(val) {
  lovelineModalStatusText = val;
  const previewStatus = document.getElementById("modal-status-preview");
  if (previewStatus) previewStatus.textContent = val || "결혼";
}

function selectModalHeartEmoji(emoji) {
  lovelineModalHeartEmoji = emoji;
  const previewHeart = document.getElementById("modal-heart-preview");
  if (previewHeart) previewHeart.textContent = emoji;

  const emojiContainer = document.getElementById("modal-emoji-picker");
  if (emojiContainer) {
    const emojis = ['💍', '💖', '💌'];
    emojiContainer.innerHTML = emojis.map(e => `
      <button 
        type="button" 
        onclick="selectModalHeartEmoji('${e}')"
        class="w-10 h-10 rounded-xl ${lovelineModalHeartEmoji === e ? 'bg-pink-600/40 border-pink-500 text-white shadow-md' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'} border flex items-center justify-center text-lg transition-all cursor-pointer"
      >
        ${e}
      </button>
    `).join("");
  }
}

// 최종 저장 처리
function handleSaveLovelineFromModal() {
  if (!lovelineModalP1 || !lovelineModalP1.name) {
    if (typeof showToast === "function") showToast("인원 1 (좌측)을 검색하여 선택해 주세요.");
    else alert("인원 1 (좌측)을 선택해 주세요.");
    return;
  }
  if (!lovelineModalP2 || !lovelineModalP2.name) {
    if (typeof showToast === "function") showToast("인원 2 (우측)을 검색하여 선택해 주세요.");
    else alert("인원 2 (우측)을 선택해 주세요.");
    return;
  }

  if (lovelineModalP1.memberId && lovelineModalP2.memberId && lovelineModalP1.memberId === lovelineModalP2.memberId) {
    if (typeof showToast === "function") showToast("서로 다른 두 사람을 선택해 주세요.");
    else alert("서로 다른 두 사람을 선택해 주세요.");
    return;
  }

  let statusType = "married";
  if (lovelineModalStatusType === "dating") statusType = "dating";
  else if (lovelineModalStatusType === "some") statusType = "some";

  const cfg = LOVELINE_STATUS_CONFIG[statusType] || LOVELINE_STATUS_CONFIG.married;
  const defaultStatus = cfg.label;
  const defaultHeart = cfg.emoji;

  const list = getLovelineList();
  const coupleData = {
    id: lovelineModalEditingId || `love-${Date.now()}`,
    status: (lovelineModalStatusText || "").trim() || defaultStatus,
    statusType: statusType,
    heartEmoji: lovelineModalHeartEmoji || defaultHeart,
    person1: {
      name: lovelineModalP1.name,
      streamer: lovelineModalP1.streamer,
      badge: lovelineModalP1.badge || "",
      badgeColor: lovelineModalP1.badgeColor || "bg-zinc-800 text-zinc-300 border-zinc-700",
      avatar: lovelineModalP1.avatar || "assets/default-avatar.svg",
      memberId: lovelineModalP1.memberId || null
    },
    person2: {
      name: lovelineModalP2.name,
      streamer: lovelineModalP2.streamer,
      badge: lovelineModalP2.badge || "",
      badgeColor: lovelineModalP2.badgeColor || "bg-zinc-800 text-zinc-300 border-zinc-700",
      avatar: lovelineModalP2.avatar || "assets/default-avatar.svg",
      memberId: lovelineModalP2.memberId || null
    }
  };

  if (lovelineModalEditingId) {
    const idx = list.findIndex(l => l.id === lovelineModalEditingId);
    if (idx !== -1) list[idx] = coupleData;
    else list.unshift(coupleData);
  } else {
    list.unshift(coupleData);
  }

  const p1Name = coupleData.person1?.name || "인원1";
  const p2Name = coupleData.person2?.name || "인원2";
  const coupleTitle = coupleData.title || `${p1Name} 💕 ${p2Name}`;
  const actionReason = lovelineModalEditingId
    ? `러브라인 수정: ${coupleTitle}`
    : `러브라인 추가: ${coupleTitle}`;

  saveLovelineList(list, actionReason);
  closeLovelineModal();

  const mainContent = document.getElementById("main-content");
  if (mainContent && state.currentCategory === "loveline") {
    renderLovelineContent(mainContent);
  }

  if (typeof showToast === "function") {
    showToast(`러브라인이 성공적으로 저장되었습니다 💕`);
  }
}

// 커플 카드 내 좌우 인원 맞바꾸기
function swapLovelineCouplePersons(coupleId) {
  let list = getLovelineList();
  const couple = list.find(l => l.id === coupleId);
  if (!couple) return;

  const temp = couple.person1;
  couple.person1 = couple.person2;
  couple.person2 = temp;

  const p1Name = couple.person1?.name || "";
  const p2Name = couple.person2?.name || "";
  const actionReason = `러브라인 좌우 위치 변경: ${p1Name} ⇆ ${p2Name}`;

  saveLovelineList(list, actionReason);
  const mainContent = document.getElementById("main-content");
  if (mainContent && state.currentCategory === "loveline") {
    renderLovelineContent(mainContent);
  }
  if (typeof showToast === "function") {
    showToast(`${couple.person1?.name || ''} ⇆ ${couple.person2?.name || ''} 좌우 위치가 변경되었습니다.`);
  }
}

// 커플 카드 순서 이동 (위로/아래로)
function moveLovelineOrder(coupleId, direction) {
  let list = getLovelineList();
  const filtered = list.filter(item => {
    if (lovelineCurrentFilter !== "all" && item.statusType !== lovelineCurrentFilter) return false;
    return true;
  });

  const currentIdx = filtered.findIndex(l => l.id === coupleId);
  if (currentIdx === -1) return;

  const targetIdx = currentIdx + direction;
  if (targetIdx < 0 || targetIdx >= filtered.length) return;

  const currentItem = filtered[currentIdx];
  const targetItem = filtered[targetIdx];

  const fromIdx = list.findIndex(l => l.id === currentItem.id);
  const toIdx = list.findIndex(l => l.id === targetItem.id);

  if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);

    const itemTitle = currentItem.title || `${currentItem.person1?.name || ''} 💕 ${currentItem.person2?.name || ''}`;
    const actionReason = `러브라인 순서 이동: ${itemTitle} (${fromIdx + 1}번 → ${toIdx + 1}번)`;

    saveLovelineList(list, actionReason);
    const mainContent = document.getElementById("main-content");
    if (mainContent && state.currentCategory === "loveline") {
      renderLovelineContent(mainContent);
    }
    if (typeof showToast === "function") {
      showToast("러브라인 위치가 변경되었습니다.");
    }
  }
}

// 모달 내 좌우 인원 맞바꾸기
function swapModalMembers() {
  const temp = lovelineModalP1;
  lovelineModalP1 = lovelineModalP2;
  lovelineModalP2 = temp;

  const c1 = document.getElementById("modal-person-container-1");
  const c2 = document.getElementById("modal-person-container-2");
  if (c1) c1.innerHTML = renderModalPersonBox(1, lovelineModalP1);
  if (c2) c2.innerHTML = renderModalPersonBox(2, lovelineModalP2);

  if (typeof showToast === "function") {
    showToast("좌우 인원 위치가 맞바뀌었습니다.");
  }
}

function confirmDeleteLoveline(coupleId) {
  if (!confirm("정말 이 러브라인을 삭제하시겠습니까?")) return;

  let list = getLovelineList();
  const couple = list.find(l => l.id === coupleId);
  const deletedTitle = couple ? (couple.title || `${couple.person1?.name || ''} 💕 ${couple.person2?.name || ''}`) : "커플";
  const actionReason = `러브라인 삭제: ${deletedTitle}`;

  list = list.filter(l => l.id !== coupleId);
  saveLovelineList(list, actionReason);

  const mainContent = document.getElementById("main-content");
  if (mainContent && state.currentCategory === "loveline") {
    renderLovelineContent(mainContent);
  }

  if (typeof showToast === "function") {
    showToast(`러브라인이 삭제되었습니다.`);
  }
}

// 전역 노출
window.getLovelineList = getLovelineList;
window.renderLovelineContent = renderLovelineContent;
window.setLovelineFilter = setLovelineFilter;
window.resetLovelineFilter = resetLovelineFilter;
window.handleLovelineSearch = handleLovelineSearch;
window.clearLovelineSearch = clearLovelineSearch;
window.navigateToLovelineMember = navigateToLovelineMember;
window.handleLovelineMemberCardClick = handleLovelineMemberCardClick;
window.openLovelineModal = openLovelineModal;
window.closeLovelineModal = closeLovelineModal;
window.handleModalMemberSearchInput = handleModalMemberSearchInput;
window.selectModalMember = selectModalMember;
window.clearModalMember = clearModalMember;
window.handleModalStatusTypeChange = handleModalStatusTypeChange;
window.handleModalStatusTextInput = handleModalStatusTextInput;
window.selectModalHeartEmoji = selectModalHeartEmoji;
window.handleSaveLovelineFromModal = handleSaveLovelineFromModal;
window.confirmDeleteLoveline = confirmDeleteLoveline;
window.swapLovelineCouplePersons = swapLovelineCouplePersons;
window.moveLovelineOrder = moveLovelineOrder;
window.swapModalMembers = swapModalMembers;
