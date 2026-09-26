// ==========================================
// 네비게이션 & 검색 모듈 (Navigation & Search)
// ==========================================

function renderSearchResults(container) {
  const q = (state.searchQuery || '').trim().toLowerCase();
  if (!q) {
    clearSearch();
    return;
  }

  const terms = q.split(/\s+/).filter(Boolean);
  const matchedMembers = [];
  const seenMemberKeys = new Set();

  // 빠른 O(1) 카테고리/조직 참조용 맵 색인
  const catMap = new Map();
  const grpMap = new Map();
  (KONGBAP_DATA.categories || []).forEach(c => {
    catMap.set(c.id, c);
    if (c.hasSubgroups && Array.isArray(c.groups)) {
      c.groups.forEach(g => grpMap.set(g.id, g));
    }
  });

  (KONGBAP_DATA.categories || []).forEach(cat => {
    const processMember = (member, group) => {
      if (!member) return;
      const memberKey = member.id || `${member.streamer}_${member.name}`;
      if (seenMemberKeys.has(memberKey)) return;

      let searchHaystack = member._searchHaystack;
      if (!searchHaystack) {
        const nameStr = (member.name || '').toLowerCase();
        const streamerStr = (member.streamer || member.streamerName || '').toLowerCase();
        const catNameStr = (cat.name || '').toLowerCase();
        const groupNameStr = (group ? group.name : '').toLowerCase();
        const roleStr = (member.role || '').toLowerCase();
        const swatStr = (member.swatRole || '').toLowerCase();

        // 소속 및 겸직 텍스트 수집 (맵 활용 O(1) 조회)
        const affParts = [];
        if (Array.isArray(member.affiliations)) {
          for (let i = 0; i < member.affiliations.length; i++) {
            const a = member.affiliations[i];
            if (!a) continue;
            if (a.role) affParts.push(String(a.role).toLowerCase());
            if (a.swatRole) affParts.push(String(a.swatRole).toLowerCase());
            if (a.category) {
              const c = catMap.get(a.category);
              if (c) {
                affParts.push((c.name || '').toLowerCase());
                if (c.hasSubgroups && a.subgroup) {
                  const g = grpMap.get(a.subgroup);
                  if (g) affParts.push((g.name || '').toLowerCase());
                }
              }
            }
          }
        }

        searchHaystack = [
          nameStr,
          streamerStr,
          catNameStr,
          groupNameStr,
          roleStr,
          swatStr,
          ...affParts
        ].join(' ');
        member._searchHaystack = searchHaystack;
      }

      const isMatch = terms.every(term => searchHaystack.includes(term));
      if (isMatch) {
        seenMemberKeys.add(memberKey);
        matchedMembers.push({
          member,
          group,
          category: cat,
        });
      }
    };

    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(group => {
        (group.members || []).forEach(m => processMember(m, group));
      });
    } else {
      (cat.members || []).forEach(m => processMember(m, null));
    }
  });

  const safeSearchQuery = typeof escapeHtml === 'function' ? escapeHtml(state.searchQuery) : state.searchQuery;

  if (matchedMembers.length === 0) {
    container.innerHTML = `
      <div class="py-20 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800">
        <div class="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">"${safeSearchQuery}"에 대한 인원 검색 결과가 없습니다</h3>
        <p class="text-zinc-400 text-sm mb-6">스트리머명, 캐릭터명, 소속(경찰, 갱단, 사업체 등), 직책으로 다시 검색해보세요.</p>
        <button onclick="clearSearch()" class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-colors cursor-pointer">
          검색 초기화
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <span>인원 검색 결과</span>
          <span class="text-sm px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">${matchedMembers.length}명</span>
        </h3>
        <p class="text-xs text-zinc-400 mt-1">"${safeSearchQuery}" 검색 조건과 일치하는 인원(스트리머) 목록입니다.</p>
      </div>
      <button onclick="clearSearch()" class="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm">
        <span>✕</span>
        <span>검색 닫기</span>
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
  `;

  matchedMembers.forEach(({ member: m, group, category: cat }, mIdx) => {
    const { ytCount, chzzkCount } = (typeof getMemberPlatformVideoCounts === "function")
      ? getMemberPlatformVideoCounts(m)
      : { ytCount: 0, chzzkCount: 0 };

    let videoStatHtml = '';
    if (chzzkCount > 0 && ytCount > 0) {
      videoStatHtml = `
        <span>유튜브 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
        <span class="text-zinc-600">|</span>
        <span>치지직 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      `;
    } else if (chzzkCount > 0) {
      videoStatHtml = `
        <span>치지직 영상 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      `;
    } else if (ytCount > 0) {
      videoStatHtml = `
        <span>유튜브 영상 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
      `;
    } else {
      videoStatHtml = `
        <span class="text-zinc-500">등록된 영상 없음</span>
      `;
    }

    const info = typeof getMemberAffiliationInfo === 'function' ? getMemberAffiliationInfo(m, cat.id, group ? group.id : null) : {};
    const effectiveRole = info.role || (Array.isArray(m.affiliations) ? '' : (m.role || ''));
    const effectiveSwatRole = info.swatRole || (Array.isArray(m.affiliations) ? '' : (m.swatRole || ''));
    const cleanSwat = (effectiveSwatRole && !effectiveSwatRole.includes('사직') && !effectiveSwatRole.includes('면직') && !effectiveSwatRole.includes('퇴직') && !effectiveSwatRole.includes('순직')) ? effectiveSwatRole : '';
    const martyred = info.isMartyred;
    const retired = info.isRetired;
    const resigned = info.isResigned;
    const inactive = info.isInactive;
    const avatarFilterClass = inactive 
      ? "grayscale contrast-125 opacity-70 group-hover:grayscale-0 group-hover:contrast-100 group-hover:opacity-100" 
      : "";

    let statusOverlayHtml = '';
    if (martyred) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-red-400 border border-red-800/90 shadow ring-1 ring-red-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="순직">
          <span>순직</span>
        </span>
      `;
    } else if (retired) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow ring-1 ring-zinc-700/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="면직">
          <span>면직</span>
        </span>
      `;
    } else if (resigned) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow ring-1 ring-amber-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="사직">
          <span>사직</span>
        </span>
      `;
    }

    const roleBadgeClass = typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(m, cat.id, group ? group.id : null) : 'bg-blue-600 text-white';

    // 구독자/팔로워 뱃지
    let subBadgeHtml = '';
    const safeSubCount = typeof escapeHtml === 'function' ? escapeHtml(m.subscriberCount) : m.subscriberCount;
    if (m.subscriberCount) {
      const isChzzk = typeof isMemberChzzk === 'function' ? isMemberChzzk(m) : false;
      if (isChzzk) {
        subBadgeHtml = `
          <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/40 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="치지직 채널 팔로워 수: ${safeSubCount}">
            <svg class="w-2.5 h-2.5 text-[#00ffa3] fill-current flex-shrink-0" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
            <span>${safeSubCount}</span>
          </span>
        `;
      } else {
        subBadgeHtml = `
          <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-300 bg-red-950/80 border border-red-700/50 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="유튜브 채널 구독자 수: ${safeSubCount}">
            <svg class="w-2.5 h-2.5 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span>${safeSubCount}</span>
          </span>
        `;
      }
    }

    const safeMemberId = typeof sanitizeAttr === 'function' ? sanitizeAttr(m.id) : m.id;
    const safeMemberName = typeof escapeHtml === 'function' ? escapeHtml(m.name) : m.name;
    const safeStreamer = typeof escapeHtml === 'function' ? escapeHtml(m.streamer) : m.streamer;
    const safeRole = typeof escapeHtml === 'function' ? escapeHtml(effectiveRole) : effectiveRole;
    const safeSwat = typeof escapeHtml === 'function' ? escapeHtml(cleanSwat) : cleanSwat;

    const affTitle = typeof escapeHtml === 'function' ? escapeHtml(`${cat.name}${group ? ` > ${group.name}` : ''}`) : `${cat.name}${group ? ` > ${group.name}` : ''}`;
    const affLabel = `${cat.emoji ? `<span class="mr-1">${cat.emoji}</span>` : ''}${escapeHtml(cat.name)}${group ? ` <span class="text-zinc-500">›</span> ${group.emoji ? `<span class="mr-0.5">${group.emoji}</span>` : ''}${escapeHtml(group.name)}` : ''}`;

    html += `
      <div 
        id="member-card-${safeMemberId}"
        onclick="selectMemberFromSearch('${cat.id}', ${group ? `'${group.id}'` : 'null'}, '${safeMemberId}')"
        class="group member-card-interactive bg-zinc-900/80 border border-zinc-800/80 hover:border-amber-400/50 rounded-2xl p-4 sm:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-2xl flex flex-col justify-between select-none"
      >
        <div>
          <!-- 소속 태그 & 구독자/팔로워 뱃지 -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-800/90 text-zinc-300 border border-zinc-700/50 truncate max-w-[70%]" title="${affTitle}">
              ${affLabel}
            </span>
            ${subBadgeHtml}
          </div>

          <!-- 아바타 + 인원 기본 정보 -->
          <div class="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div class="relative flex-shrink-0">
              <img 
                src="${getMemberAvatar(m)}" 
                alt="${safeMemberName}" 
                loading="${mIdx < 6 ? 'eager' : 'lazy'}"
                ${mIdx < 2 ? 'fetchpriority="high"' : ''}
                decoding="async"
                referrerpolicy="no-referrer"
                onerror="this.onerror=null; this.src='assets/default-avatar.svg'"
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-zinc-700 group-hover:border-amber-400 transition-all duration-300 shadow-md ${avatarFilterClass}"
              />
              ${cleanSwat ? (typeof getSwatBadgeHtml === 'function' ? getSwatBadgeHtml(cleanSwat, 'md') : '') : ''}
              ${statusOverlayHtml}
              ${(typeof isRoleBadgeHidden === 'function' ? !isRoleBadgeHidden(safeRole) : (safeRole !== '조직원' && safeRole !== '조합원')) && safeRole ? `<span class="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${roleBadgeClass} shadow">${safeRole}</span>` : ''}
            </div>

            <div class="flex-1 min-w-0">
              <h4 class="text-lg sm:text-xl font-bold text-white group-hover:text-amber-400 transition-colors truncate" title="${safeStreamer}">
                ${safeStreamer}
              </h4>
              <div class="flex items-center gap-1.5 mt-1 text-sm font-medium text-amber-400/90 truncate" title="RP 캐릭터: ${safeMemberName}">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span class="truncate">${safeMemberName}</span>
              </div>
              ${cleanSwat && effectiveRole ? `
                <p class="text-xs text-zinc-400 mt-1 truncate" title="${safeRole} · ${safeSwat}">
                  ${safeRole} · <span class="text-sky-300 font-medium">${safeSwat}</span>
                </p>
              ` : (effectiveRole ? `
                <p class="text-xs text-zinc-400 mt-1 truncate" title="${safeRole}">${safeRole}</p>
              ` : '')}
            </div>
          </div>
        </div>

        <!-- 하단 영상 통계 및 이동 버튼 -->
        <div class="pt-3 sm:pt-3.5 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2 flex-wrap">
          <div class="font-medium text-zinc-300 flex items-center gap-1.5 flex-wrap">
            ${videoStatHtml}
          </div>
          <span class="inline-flex items-center gap-1 text-amber-400 group-hover:translate-x-0.5 transition-transform font-semibold flex-shrink-0 text-[11px] sm:text-xs">
            영상 보기 →
          </span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

let isHistoryNavigating = false;
let appHistoryDepth = 0;
let isSearchHistoryPushed = false;
let isReturningToList = false;
let isReturningToCategory = false;

let lastTrackedGaUrl = (typeof window !== "undefined") ? (window.location.pathname + window.location.search) : null;

function sendGaPageView(url) {
  if (typeof gtag === "function") {
    try {
      const fullUrl = url && url.startsWith("http") ? url : (window.location.origin + (url || (window.location.pathname + window.location.search)));
      const u = new URL(fullUrl, window.location.origin);
      const gaPath = u.pathname + u.search;
      if (lastTrackedGaUrl === gaPath) return;
      lastTrackedGaUrl = gaPath;

      gtag("event", "page_view", {
        page_title: document.title,
        page_location: u.href,
        page_path: gaPath
      });
    } catch (e) {}
  }
}

function buildNavUrl(catId, groupId, memberId, videoTab, searchQuery) {
  const params = new URLSearchParams();
  if (catId) {
    params.set("category", catId);
  }
  if (groupId) {
    params.set("group", groupId);
  }
  if (memberId) {
    params.set("member", memberId);
  }
  if (videoTab && videoTab !== "clip") {
    params.set("tab", videoTab);
  }
  if (searchQuery) {
    params.set("search", searchQuery);
  }

  const qs = params.toString();
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
}

function parseUrlNavState() {
  const params = new URLSearchParams(window.location.search);
  return {
    category: params.get("category") || null,
    group: params.get("group") || null,
    member: params.get("member") || null,
    videoTab: params.get("tab") || "clip",
    searchQuery: params.get("search") || ""
  };
}

function getCurrentNavSnapshot() {
  return {
    category: state.currentCategory || "police",
    group: state.currentGroup ? state.currentGroup.id : null,
    member: state.currentMember ? state.currentMember.id : null,
    videoTab: state.currentVideoTab || "clip",
    searchQuery: state.searchQuery || "",
    source: state.navigationSource || null
  };
}

function updatePageTitle() {
  const baseTitle = "콩밥특별시 아카이브";
  if (state.currentCategory === "mypage") {
    document.title = `마이페이지 | ${baseTitle}`;
    return;
  }
  if (state.currentCategory === "adminpage") {
    document.title = `관리자 센터 | ${baseTitle}`;
    return;
  }
  if (state.currentCategory === "stats" || state.currentCategory === "leaderboard") {
    document.title = `종합 통계 | ${baseTitle}`;
    return;
  }
  if (state.searchQuery) {
    document.title = `"${state.searchQuery}" 검색 결과 | ${baseTitle}`;
    return;
  }
  if (state.currentMember) {
    const streamer = state.currentMember.streamer || state.currentMember.name;
    document.title = `${streamer} (${state.currentMember.name}) | ${baseTitle}`;
    return;
  }
  if (state.currentGroup) {
    document.title = `${state.currentGroup.name} | ${baseTitle}`;
    return;
  }
  const cat = typeof getCurrentCategory === "function" ? getCurrentCategory() : null;
  if (cat && cat.name) {
    document.title = `${cat.name} | ${baseTitle}`;
    return;
  }
  document.title = baseTitle;
}

function pushNavHistory() {
  if (isHistoryNavigating) return;
  const snapshot = getCurrentNavSnapshot();
  const url = buildNavUrl(snapshot.category, snapshot.group, snapshot.member, snapshot.videoTab, snapshot.searchQuery);

  const currentHState = window.history.state;
  if (currentHState &&
      currentHState.isKongbapApp &&
      currentHState.category === snapshot.category &&
      currentHState.group === snapshot.group &&
      currentHState.member === snapshot.member &&
      currentHState.videoTab === snapshot.videoTab &&
      currentHState.searchQuery === snapshot.searchQuery) {
    return;
  }

  const prevDepth = (currentHState && typeof currentHState.depth === "number") ? currentHState.depth : appHistoryDepth;
  appHistoryDepth = prevDepth + 1;

  const hState = {
    ...snapshot,
    depth: appHistoryDepth,
    isKongbapApp: true
  };
  try {
    window.history.pushState(hState, "", url);
  } catch (e) {}
  updatePageTitle();
  sendGaPageView(url);
}

function replaceNavHistory() {
  if (isHistoryNavigating) return;
  const snapshot = getCurrentNavSnapshot();
  const url = buildNavUrl(snapshot.category, snapshot.group, snapshot.member, snapshot.videoTab, snapshot.searchQuery);

  const currentHState = window.history.state;
  const currentDepth = (currentHState && typeof currentHState.depth === "number") ? currentHState.depth : appHistoryDepth;

  const hState = {
    ...snapshot,
    depth: currentDepth,
    isKongbapApp: true
  };
  try {
    window.history.replaceState(hState, "", url);
  } catch (e) {}
  updatePageTitle();
  sendGaPageView(url);
}

function applyNavState(navState, options = {}) {
  if (!navState) return;

  state.navigationSource = navState.source || null;

  let cat = null;
  const targetCatId = navState.category || "police";
  if (targetCatId === "mypage") {
    state.currentCategory = "mypage";
    state.currentGroup = null;
    state.currentMember = null;
  } else if (targetCatId === "adminpage") {
    state.currentCategory = "adminpage";
    state.currentGroup = null;
    state.currentMember = null;
  } else if (targetCatId === "stats" || targetCatId === "leaderboard") {
    state.currentCategory = "stats";
    state.currentGroup = null;
    state.currentMember = null;
  } else {
    cat = (KONGBAP_DATA.categories || []).find(c => c.id === targetCatId) || (KONGBAP_DATA.categories || [])[0];
    if (cat) {
      state.currentCategory = cat.id;
    }
  }

  // 그룹 복원
  state.currentGroup = null;
  if (cat && cat.hasSubgroups && navState.group) {
    const grp = (cat.groups || []).find(g => String(g.id) === String(navState.group));
    if (grp) {
      state.currentGroup = grp;
    }
  }

  // 멤버 복원
  state.currentMember = null;
  if (navState.member) {
    if (state.currentGroup) {
      state.currentMember = (state.currentGroup.members || []).find(m => String(m.id) === String(navState.member)) || null;
    }
    if (!state.currentMember && cat) {
      if (cat.hasSubgroups && Array.isArray(cat.groups)) {
        for (const grp of cat.groups) {
          const m = (grp.members || []).find(mem => String(mem.id) === String(navState.member));
          if (m) {
            state.currentGroup = grp;
            state.currentMember = m;
            break;
          }
        }
      } else {
        state.currentMember = (cat.members || []).find(m => String(m.id) === String(navState.member)) || null;
      }
    }
    // 전역 카테고리 폴백 탐색
    if (!state.currentMember) {
      for (const c of (KONGBAP_DATA.categories || [])) {
        if (c.hasSubgroups) {
          for (const g of (c.groups || [])) {
            const m = (g.members || []).find(item => String(item.id) === String(navState.member));
            if (m) {
              state.currentCategory = c.id;
              state.currentGroup = g;
              state.currentMember = m;
              break;
            }
          }
        } else {
          const m = (c.members || []).find(item => String(item.id) === String(navState.member));
          if (m) {
            state.currentCategory = c.id;
            state.currentGroup = null;
            state.currentMember = m;
            break;
          }
        }
        if (state.currentMember) break;
      }
    }
  }

  // 비디오 탭 복원
  if (state.currentMember) {
    const allV = state.currentMember.videos || [];
    const validTabs = ["clip", "full", "binge"];
    if (navState.videoTab && validTabs.includes(navState.videoTab)) {
      state.currentVideoTab = navState.videoTab;
    } else {
      state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    }
  }

  // 검색어 복원
  state.searchQuery = navState.searchQuery || "";
  const sInput = document.getElementById("search-input");
  if (sInput && sInput.value !== state.searchQuery) sInput.value = state.searchQuery;
  const mInput = document.getElementById("search-input-mobile");
  if (mInput && mInput.value !== state.searchQuery) mInput.value = state.searchQuery;
  isSearchHistoryPushed = !!state.searchQuery;

  saveNavigationState();

  if (typeof renderHeaderAuth === "function") renderHeaderAuth();
  if (typeof renderCategoryTabs === "function") renderCategoryTabs();
  if (typeof renderContent === "function") renderContent();

  if (options.shouldRestoreScroll) {
    restoreMemberScrollPosition();
  } else if (!state.currentMember && !options.preserveScroll) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  updatePageTitle();
}

function saveNavigationState() {
  try {
    sessionStorage.setItem("kongbap_nav_category", state.currentCategory || "police");
    if (state.currentGroup && state.currentGroup.id) {
      sessionStorage.setItem("kongbap_nav_group", state.currentGroup.id);
    } else {
      sessionStorage.removeItem("kongbap_nav_group");
    }
    if (state.currentMember && state.currentMember.id) {
      sessionStorage.setItem("kongbap_nav_member", state.currentMember.id);
    } else {
      sessionStorage.removeItem("kongbap_nav_member");
    }
    if (state.navigationSource) {
      sessionStorage.setItem("kongbap_nav_source", state.navigationSource);
    } else {
      sessionStorage.removeItem("kongbap_nav_source");
    }
  } catch (e) {}
}

function restoreNavigationState() {
  try {
    const urlState = parseUrlNavState();
    const hasUrlParams = !!(urlState.category || urlState.group || urlState.member || urlState.searchQuery);
    const hState = window.history.state;

    let targetCat = null;
    let targetGroup = null;
    let targetMember = null;
    let targetTab = "clip";
    let targetSearch = "";
    let targetSource = null;

    // 1. 브라우저 새로고침(F5) 시 기존 history.state가 보존되어 있다면 최우선 복원
    if (hState && hState.isKongbapApp) {
      targetCat = hState.category;
      targetGroup = hState.group;
      targetMember = hState.member;
      targetTab = hState.videoTab || "clip";
      targetSearch = hState.searchQuery || "";
      targetSource = hState.source || null;
      appHistoryDepth = typeof hState.depth === "number" ? hState.depth : 0;
    } else if (hasUrlParams) {
      targetCat = urlState.category;
      targetGroup = urlState.group;
      targetMember = urlState.member;
      targetTab = urlState.videoTab || "clip";
      targetSearch = urlState.searchQuery || "";
      targetSource = sessionStorage.getItem("kongbap_nav_source") || null;
      appHistoryDepth = 0;
    } else {
      targetCat = sessionStorage.getItem("kongbap_nav_category");
      targetGroup = sessionStorage.getItem("kongbap_nav_group");
      targetMember = null;
      targetSource = null;
      try { sessionStorage.removeItem("kongbap_nav_member"); } catch(e) {}
      try { sessionStorage.removeItem("kongbap_nav_source"); } catch(e) {}
      appHistoryDepth = 0;
    }

    state.navigationSource = targetSource;

    if (targetCat === "mypage") {
      state.currentCategory = "mypage";
      state.currentGroup = null;
      state.currentMember = null;
    } else if (targetCat === "adminpage") {
      if (typeof isAdmin === "function" && isAdmin()) {
        state.currentCategory = "adminpage";
        state.currentGroup = null;
        state.currentMember = null;
      } else {
        state.currentCategory = (KONGBAP_DATA.categories[0] && KONGBAP_DATA.categories[0].id) || "police";
      }
    } else if (targetCat === "stats" || targetCat === "leaderboard") {
      state.currentCategory = "stats";
      state.currentGroup = null;
      state.currentMember = null;
    } else if (targetCat && KONGBAP_DATA.categories.some(c => c.id === targetCat)) {
      state.currentCategory = targetCat;
    } else {
      state.currentCategory = (KONGBAP_DATA.categories[0] && KONGBAP_DATA.categories[0].id) || "police";
    }

    const cat = getCurrentCategory();
    if (targetGroup && cat && cat.hasSubgroups) {
      const g = (cat.groups || []).find(grp => String(grp.id) === String(targetGroup));
      if (g) state.currentGroup = g;
    }

    if (targetMember) {
      if (state.currentGroup) {
        const m = (state.currentGroup.members || []).find(mem => String(mem.id) === String(targetMember));
        if (m) state.currentMember = m;
      }
      if (!state.currentMember && cat && cat.hasSubgroups && Array.isArray(cat.groups)) {
        for (const grp of cat.groups) {
          const m = (grp.members || []).find(mem => String(mem.id) === String(targetMember));
          if (m) {
            state.currentGroup = grp;
            state.currentMember = m;
            break;
          }
        }
      } else if (!state.currentMember && cat && !cat.hasSubgroups) {
        const m = (cat.members || []).find(mem => String(mem.id) === String(targetMember));
        if (m) state.currentMember = m;
      }
      if (!state.currentMember) {
        for (const c of (KONGBAP_DATA.categories || [])) {
          if (c.hasSubgroups) {
            for (const g of (c.groups || [])) {
              const m = (g.members || []).find(item => String(item.id) === String(targetMember));
              if (m) {
                state.currentCategory = c.id;
                state.currentGroup = g;
                state.currentMember = m;
                break;
              }
            }
          } else {
            const m = (c.members || []).find(item => String(item.id) === String(targetMember));
            if (m) {
              state.currentCategory = c.id;
              state.currentGroup = null;
              state.currentMember = m;
              break;
            }
          }
          if (state.currentMember) break;
        }
      }
    }

    if (state.currentMember) {
      const allV = state.currentMember.videos || [];
      const validTabs = ["clip", "full", "binge"];
      state.currentVideoTab = validTabs.includes(targetTab) ? targetTab : (typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip");
    }

    if (targetSearch) {
      state.searchQuery = targetSearch;
      isSearchHistoryPushed = true;
      const sInput = document.getElementById("search-input");
      if (sInput) sInput.value = targetSearch;
      const mInput = document.getElementById("search-input-mobile");
      if (mInput) mInput.value = targetSearch;
    }

    replaceNavHistory();
  } catch (e) {
    console.warn("네비게이션 상태 복원 중 오류:", e);
  }
}

let lastMemberScrollY = null;
let lastSelectedMemberId = null;

try {
  const savedY = sessionStorage.getItem("kongbap_member_scroll_y");
  if (savedY !== null) lastMemberScrollY = parseFloat(savedY);
  const savedMemId = sessionStorage.getItem("kongbap_last_member_id");
  if (savedMemId) lastSelectedMemberId = savedMemId;
} catch (e) {}

function recordMemberClickPosition(memberId) {
  lastMemberScrollY = window.scrollY;
  lastSelectedMemberId = memberId;
  try {
    sessionStorage.setItem("kongbap_member_scroll_y", String(window.scrollY));
    if (memberId) {
      sessionStorage.setItem("kongbap_last_member_id", memberId);
    } else {
      sessionStorage.removeItem("kongbap_last_member_id");
    }
  } catch (e) {}
}

function restoreMemberScrollPosition() {
  const targetY = lastMemberScrollY;
  const targetMemberId = lastSelectedMemberId;

  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  try {
    sessionStorage.removeItem("kongbap_member_scroll_y");
    sessionStorage.removeItem("kongbap_last_member_id");
  } catch (e) {}

  const doScroll = () => {
    let scrolled = false;
    if (targetMemberId) {
      const cardEl = document.getElementById(`member-card-${targetMemberId}`);
      if (cardEl) {
        if (typeof targetY === 'number' && targetY >= 0) {
          window.scrollTo({ top: targetY, behavior: 'auto' });
          const rect = cardEl.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            cardEl.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        } else {
          cardEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        cardEl.classList.add('ring-2', 'ring-amber-400', 'shadow-amber-500/30');
        setTimeout(() => {
          cardEl.classList.remove('ring-2', 'ring-amber-400', 'shadow-amber-500/30');
        }, 1500);
        scrolled = true;
      }
    }
    if (!scrolled && typeof targetY === 'number' && targetY >= 0) {
      window.scrollTo({ top: targetY, behavior: 'auto' });
    }
  };

  doScroll();
  requestAnimationFrame(doScroll);
  setTimeout(doScroll, 50);
  setTimeout(doScroll, 150);
}

function goBackFromMember(type, targetId) {
  closeAllOpenModals();
  state.currentMember = null;
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  clearSearchInput();
  try {
    sessionStorage.removeItem("kongbap_nav_member");
  } catch (e) {}

  const wasFromStats = type === 'stats' || state.navigationSource === 'stats' || state.navigationSource === 'leaderboard';
  const wasFromLoveline = type === 'loveline' || state.navigationSource === 'loveline';
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
  } catch (e) {}

  if (wasFromStats) {
    state.currentCategory = 'stats';
    state.currentGroup = null;
  } else if (wasFromLoveline) {
    if (typeof resetLovelineFilter === "function") resetLovelineFilter();
    else if (typeof window.resetLovelineFilter === "function") window.resetLovelineFilter();
    state.currentCategory = 'loveline';
    state.currentGroup = null;
  } else if (type === 'category') {
    state.currentCategory = targetId || state.currentCategory || 'police';
    state.currentGroup = null;
  } else if (type === 'group') {
    const cat = getCurrentCategory();
    if (cat?.hasSubgroups) {
      state.currentGroup = (cat.groups || []).find(g => String(g.id) === String(targetId)) || null;
    }
  }

  saveNavigationState();

  if (window.history.state && window.history.state.isKongbapApp && (window.history.state.depth > 0)) {
    isReturningToList = true;
    window.history.back();
    setTimeout(() => {
      if (isReturningToList) {
        isReturningToList = false;
        if (wasFromStats) {
          state.currentCategory = 'stats';
          state.currentGroup = null;
          state.currentMember = null;
        } else if (wasFromLoveline) {
          state.currentCategory = 'loveline';
          state.currentGroup = null;
          state.currentMember = null;
        }
        replaceNavHistory();
        renderContent();
        restoreMemberScrollPosition();
      }
    }, 120);
    return;
  }

  replaceNavHistory();
  renderContent();
  restoreMemberScrollPosition();
}

function selectCategory(catId) {
  if (state.currentCategory === catId && !state.currentGroup && !state.currentMember && !state.searchQuery) {
    if (catId === "loveline") {
      if (typeof resetLovelineFilter === "function") resetLovelineFilter();
      else if (typeof window.resetLovelineFilter === "function") window.resetLovelineFilter();
      renderContent();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (catId === "loveline" || state.currentCategory === "loveline") {
    if (typeof resetLovelineFilter === "function") resetLovelineFilter();
    else if (typeof window.resetLovelineFilter === "function") window.resetLovelineFilter();
  }
  if (catId === "stats" || state.currentCategory === "stats") {
    if (typeof leaderboardSearchQuery !== "undefined") leaderboardSearchQuery = "";
  }
  // 다른 직업 탭에서 종합 통계로 진입할 경우 전체시간순('total')으로 초기화 (인원 클릭 후 뒤로가기로 올 때는 유지)
  if (catId === "stats") {
    if (state.currentCategory !== "stats" && state.navigationSource !== "stats") {
      if (typeof currentLeaderboardTab !== "undefined") currentLeaderboardTab = "total";
    }
  } else if (state.currentCategory === "stats" || state.currentCategory === "leaderboard") {
    if (typeof cleanupLeaderboardListeners === "function") cleanupLeaderboardListeners();
  }
  closeAllOpenModals();
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
  } catch (e) {}
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  try {
    sessionStorage.removeItem("kongbap_member_scroll_y");
    sessionStorage.removeItem("kongbap_last_member_id");
  } catch (e) {}
  clearSearchInput();
  saveNavigationState();
  pushNavHistory();
  renderContent();
  window.scrollTo(0, 0);
}

function selectMyPage() {
  closeAllOpenModals();
  if (typeof resetLovelineFilter === "function") resetLovelineFilter();
  else if (typeof window.resetLovelineFilter === "function") window.resetLovelineFilter();
  state.currentCategory = "mypage";
  state.currentGroup = null;
  state.currentMember = null;
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
    sessionStorage.removeItem("kongbap_nav_group");
    sessionStorage.removeItem("kongbap_nav_member");
    sessionStorage.setItem("kongbap_nav_category", "mypage");
  } catch (e) {}
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  clearSearchInput();
  saveNavigationState();
  pushNavHistory();
  renderHeaderAuth();
  renderCategoryTabs();
  renderContent();
  window.scrollTo(0, 0);
}

function selectAdminPage(tab = null) {
  if (typeof isAdmin === "function" && !isAdmin()) {
    if (typeof openLoginModal === "function") openLoginModal();
    return;
  }
  closeAllOpenModals();
  if (typeof resetLovelineFilter === "function") resetLovelineFilter();
  else if (typeof window.resetLovelineFilter === "function") window.resetLovelineFilter();
  state.currentCategory = "adminpage";
  state.currentGroup = null;
  state.currentMember = null;
  state.navigationSource = null;
  if (tab && typeof switchAdminPageTab === "function") {
    state.currentAdminTab = tab;
    if (typeof currentAdminPageTab !== "undefined") {
      currentAdminPageTab = tab;
    }
  }
  try {
    sessionStorage.removeItem("kongbap_nav_source");
    sessionStorage.removeItem("kongbap_nav_group");
    sessionStorage.removeItem("kongbap_nav_member");
    sessionStorage.setItem("kongbap_nav_category", "adminpage");
  } catch (e) {}
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  clearSearchInput();
  saveNavigationState();
  pushNavHistory();
  renderHeaderAuth();
  renderCategoryTabs();
  renderContent();
  window.scrollTo(0, 0);
}

function resetToCategory(catId) {
  closeAllOpenModals();
  const wasOnMember = !!state.currentMember;
  state.currentCategory = catId || state.currentCategory || 'police';
  state.currentGroup = null;
  state.currentMember = null;
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
  } catch (e) {}
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  clearSearchInput();
  try {
    sessionStorage.removeItem("kongbap_nav_member");
    sessionStorage.removeItem("kongbap_nav_group");
  } catch (e) {}

  saveNavigationState();

  if (window.history.state && window.history.state.isKongbapApp && (window.history.state.depth > 0)) {
    isReturningToCategory = true;
    window.history.back();
    setTimeout(() => {
      if (isReturningToCategory) {
        isReturningToCategory = false;
        replaceNavHistory();
        renderContent();
        if (wasOnMember && (lastSelectedMemberId || typeof lastMemberScrollY === 'number')) {
          restoreMemberScrollPosition();
        } else {
          window.scrollTo(0, 0);
        }
      }
    }, 120);
    return;
  }

  replaceNavHistory();
  renderContent();

  if (wasOnMember && (lastSelectedMemberId || typeof lastMemberScrollY === 'number')) {
    restoreMemberScrollPosition();
  } else {
    lastMemberScrollY = null;
    lastSelectedMemberId = null;
    window.scrollTo(0, 0);
  }
}

function selectGroup(groupId) {
  const isDragged = typeof window.hasActuallyDragged === "function" ? window.hasActuallyDragged() : !!window.hasActuallyDragged;
  if (typeof isAdmin === "function" && isAdmin() && isDragged) return;
  const cat = getCurrentCategory();
  if (!cat.hasSubgroups) return;
  const group = (cat.groups || []).find(g => String(g.id) === String(groupId));
  if (group) {
    const wasOnMember = !!state.currentMember;
    state.currentGroup = group;
    state.currentMember = null;
    state.searchQuery = "";
    isSearchHistoryPushed = false;
    clearSearchInput();
    saveNavigationState();
    pushNavHistory();
    renderContent();

    if (wasOnMember && (lastSelectedMemberId || typeof lastMemberScrollY === 'number')) {
      restoreMemberScrollPosition();
    } else {
      lastMemberScrollY = null;
      lastSelectedMemberId = null;
      window.scrollTo(0, 0);
    }
  }
}

function selectDirectMember(memberId) {
  const isDragged = typeof window.hasActuallyDragged === "function" ? window.hasActuallyDragged() : !!window.hasActuallyDragged;
  if (typeof isAdmin === "function" && isAdmin() && isDragged) return;
  recordMemberClickPosition(memberId);
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
  } catch (e) {}
  const cat = getCurrentCategory();
  let member = (cat?.members || []).find(m => String(m.id) === String(memberId));
  if (!member) {
    for (const c of (KONGBAP_DATA.categories || [])) {
      if (c.hasSubgroups) {
        for (const g of (c.groups || [])) {
          const found = (g.members || []).find(m => String(m.id) === String(memberId));
          if (found) {
            member = found;
            state.currentCategory = c.id;
            state.currentGroup = g;
            break;
          }
        }
      } else {
        const found = (c.members || []).find(m => String(m.id) === String(memberId));
        if (found) {
          member = found;
          state.currentCategory = c.id;
          state.currentGroup = null;
          break;
        }
      }
      if (member) break;
    }
  }

  if (member) {
    if (!cat?.hasSubgroups) {
      state.currentGroup = null;
    }
    state.currentMember = member;
    state.searchQuery = "";
    isSearchHistoryPushed = false;
    clearSearchInput();
    const allV = member.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    saveNavigationState();
    pushNavHistory();
    renderContent();
    window.scrollTo(0, 0);
  }
}

function selectGroupMember(memberId) {
  const isDragged = typeof window.hasActuallyDragged === "function" ? window.hasActuallyDragged() : !!window.hasActuallyDragged;
  if (typeof isAdmin === "function" && isAdmin() && isDragged) return;
  recordMemberClickPosition(memberId);
  state.navigationSource = null;
  try {
    sessionStorage.removeItem("kongbap_nav_source");
  } catch (e) {}
  let member = null;
  if (state.currentGroup) {
    member = (state.currentGroup.members || []).find(m => String(m.id) === String(memberId));
  }
  if (!member) {
    for (const c of (KONGBAP_DATA.categories || [])) {
      if (c.hasSubgroups) {
        for (const g of (c.groups || [])) {
          const found = (g.members || []).find(m => String(m.id) === String(memberId));
          if (found) {
            member = found;
            state.currentCategory = c.id;
            state.currentGroup = g;
            break;
          }
        }
      } else {
        const found = (c.members || []).find(m => String(m.id) === String(memberId));
        if (found) {
          member = found;
          state.currentCategory = c.id;
          state.currentGroup = null;
          break;
        }
      }
      if (member) break;
    }
  }

  if (member) {
    state.currentMember = member;
    state.searchQuery = "";
    isSearchHistoryPushed = false;
    clearSearchInput();
    const allV = member.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    saveNavigationState();
    pushNavHistory();
    renderContent();
    window.scrollTo(0, 0);
  }
}

function selectGroupFromSearch(catId, groupId) {
  state.currentCategory = catId;
  const cat = KONGBAP_DATA.categories.find(c => c.id === catId);
  if (cat?.hasSubgroups) {
    state.currentGroup = (cat.groups || []).find(g => String(g.id) === String(groupId));
    state.currentMember = null;
    state.searchQuery = "";
    isSearchHistoryPushed = false;
    clearSearchInput();
    saveNavigationState();
    pushNavHistory();
    renderContent();
    window.scrollTo(0, 0);
  }
}

function selectMemberFromSearch(catId, groupId, memberId, source = null) {
  recordMemberClickPosition(memberId);
  state.currentCategory = catId;
  state.navigationSource = source || null;
  if (source) {
    try {
      sessionStorage.setItem("kongbap_nav_source", source);
    } catch (e) {}
  } else {
    try {
      sessionStorage.removeItem("kongbap_nav_source");
    } catch (e) {}
  }
  const cat = KONGBAP_DATA.categories.find(c => c.id === catId);

  let member = null;
  if (cat && cat.hasSubgroups && groupId) {
    state.currentGroup = (cat.groups || []).find(g => String(g.id) === String(groupId)) || null;
    if (state.currentGroup) {
      member = (state.currentGroup.members || []).find(m => String(m.id) === String(memberId));
    }
  } else if (cat) {
    state.currentGroup = null;
    member = (cat.members || []).find(m => String(m.id) === String(memberId));
  }

  if (!member) {
    for (const c of (KONGBAP_DATA.categories || [])) {
      if (c.hasSubgroups) {
        for (const g of (c.groups || [])) {
          const found = (g.members || []).find(m => String(m.id) === String(memberId));
          if (found) {
            member = found;
            state.currentCategory = c.id;
            state.currentGroup = g;
            break;
          }
        }
      } else {
        const found = (c.members || []).find(m => String(m.id) === String(memberId));
        if (found) {
          member = found;
          state.currentCategory = c.id;
          state.currentGroup = null;
          break;
        }
      }
      if (member) break;
    }
  }

  state.currentMember = member || null;
  if (state.currentMember) {
    const allV = state.currentMember.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
  }

  state.searchQuery = "";
  isSearchHistoryPushed = false;
  clearSearchInput();
  saveNavigationState();
  pushNavHistory();
  renderContent();
  window.scrollTo(0, 0);
}

function clearSearch() {
  state.searchQuery = "";
  isSearchHistoryPushed = false;
  clearSearchInput();
  if (window.history.state && window.history.state.isKongbapApp && window.history.state.depth > 0) {
    window.history.back();
    return;
  }
  replaceNavHistory();
  renderContent();
}

function clearSearchInput() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  const mobileInput = document.getElementById("search-input-mobile");
  if (mobileInput) mobileInput.value = "";
}

function closeAllOpenModals() {
  if (typeof closeLoginModal === "function") closeLoginModal();
  if (typeof closeVideoModal === "function") closeVideoModal();
  if (typeof closePlaylistModal === "function") closePlaylistModal();
  if (typeof closeMemberModal === "function") closeMemberModal();
  if (typeof closeDeleteMemberModal === "function") closeDeleteMemberModal();
  if (typeof closeBackupModal === "function") closeBackupModal();
  if (typeof closeLeaderboardModal === "function") closeLeaderboardModal();
  if (typeof closeAdminSettingsModal === "function") closeAdminSettingsModal();
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  const mobileInput = document.getElementById("search-input-mobile");

  let searchDebounceTimer = null;
  const handleSearchInputChange = (rawVal, mirrorEl) => {
    if (mirrorEl && mirrorEl.value !== rawVal) {
      mirrorEl.value = rawVal;
    }
    const q = rawVal.trim().toLowerCase();
    if (!q) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      state.searchQuery = "";
      isSearchHistoryPushed = false;
      replaceNavHistory();
      renderContent();
      return;
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const wasEmpty = !state.searchQuery;
      state.searchQuery = q;
      if (wasEmpty && !isSearchHistoryPushed) {
        isSearchHistoryPushed = true;
        pushNavHistory();
      } else {
        replaceNavHistory();
      }
      renderContent();
    }, 120);
  };

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleSearchInputChange(e.target.value, mobileInput);
    });
  }

  if (mobileInput) {
    mobileInput.addEventListener("input", (e) => {
      handleSearchInputChange(e.target.value, searchInput);
    });
  }

  // 브라우저 뒤로가기 / 앞으로가기 (마우스 뒤로가기 버튼, 스마트폰 제스처, 브라우저 뒤로가기 화살표 등)
  window.addEventListener("popstate", (e) => {
    closeAllOpenModals();

    const previousMember = state.currentMember ? state.currentMember.id : null;
    let targetNavState;
    if (e.state && e.state.isKongbapApp) {
      targetNavState = { ...e.state };
      appHistoryDepth = typeof e.state.depth === "number" ? e.state.depth : 0;
    } else {
      const savedCat = sessionStorage.getItem("kongbap_nav_category");
      const savedGroup = sessionStorage.getItem("kongbap_nav_group");
      targetNavState = {
        category: savedCat || (KONGBAP_DATA.categories[0] && KONGBAP_DATA.categories[0].id) || "police",
        group: savedGroup || null,
        member: null,
        videoTab: "clip",
        searchQuery: ""
      };
      appHistoryDepth = 0;
    }

    if (isReturningToList) {
      isReturningToList = false;
      targetNavState.member = null;
    }
    if (isReturningToCategory) {
      isReturningToCategory = false;
      targetNavState.member = null;
      targetNavState.group = null;
    }

    isHistoryNavigating = true;
    try {
      const shouldRestoreScroll = !!previousMember && !targetNavState.member;
      if (shouldRestoreScroll && !lastSelectedMemberId && previousMember) {
        lastSelectedMemberId = previousMember;
      }
      applyNavState(targetNavState, { shouldRestoreScroll });
      updatePageTitle();
      sendGaPageView(window.location.href);
    } finally {
      isHistoryNavigating = false;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllOpenModals();
    }
  });

  function updateMobileScrollTopVisibility() {
    const btn = document.getElementById("mobile-scroll-top-btn");
    if (!btn) return;
    if (window.scrollY > 300) {
      btn.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
      btn.classList.add("opacity-100", "translate-y-0");
    } else {
      btn.classList.remove("opacity-100", "translate-y-0");
      btn.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
    }
  }

  let scrollRafId = null;
  window.addEventListener("scroll", () => {
    if (!scrollRafId) {
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        if (typeof updateFloatingCategoryNavVisibility === "function") {
          updateFloatingCategoryNavVisibility();
        }
        updateMobileScrollTopVisibility();
      });
    }
  }, { passive: true });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof updateFloatingCategoryNavVisibility === "function") {
        updateFloatingCategoryNavVisibility();
      }
      updateMobileScrollTopVisibility();
    }, 100);
  }, { passive: true });

  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (typeof updateFloatingCategoryNavVisibility === "function") {
        updateFloatingCategoryNavVisibility();
      }
      updateMobileScrollTopVisibility();
    }, 150);
  }, { passive: true });
}

function selectMemberById(memberId) {
  closeAllOpenModals();
  for (const c of (KONGBAP_DATA.categories || [])) {
    if (c.hasSubgroups) {
      for (const g of (c.groups || [])) {
        const found = (g.members || []).find(m => String(m.id) === String(memberId) || String(m.customId) === String(memberId));
        if (found) {
          state.currentCategory = c.id;
          state.currentGroup = g;
          state.currentMember = found;
          state.currentVideoTab = "clip";
          state.navigationSource = "mypage";
          saveNavigationState();
          pushNavHistory();
          renderHeaderAuth();
          renderCategoryTabs();
          renderContent();
          window.scrollTo(0, 0);
          return;
        }
      }
    } else {
      const found = (c.members || []).find(m => String(m.id) === String(memberId) || String(m.customId) === String(memberId));
      if (found) {
        state.currentCategory = c.id;
        state.currentGroup = null;
        state.currentMember = found;
        state.currentVideoTab = "clip";
        state.navigationSource = "mypage";
        saveNavigationState();
        pushNavHistory();
        renderHeaderAuth();
        renderCategoryTabs();
        renderContent();
        window.scrollTo(0, 0);
        return;
      }
    }
  }
}

window.goBackFromMember = goBackFromMember;
window.resetToCategory = resetToCategory;
window.selectMyPage = selectMyPage;
window.selectAdminPage = selectAdminPage;
window.selectMemberById = selectMemberById;
window.recordMemberClickPosition = recordMemberClickPosition;
window.restoreMemberScrollPosition = restoreMemberScrollPosition;
window.pushNavHistory = pushNavHistory;
window.replaceNavHistory = replaceNavHistory;
window.updatePageTitle = updatePageTitle;
window.closeAllOpenModals = closeAllOpenModals;



