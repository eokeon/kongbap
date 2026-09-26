// 인원의 현재 카테고리/소속별 정보(직위, 특공대직책, 활동상태, 뱃지색상 등) 조회 (캐싱 및 겸직 정보 격리)
const _affiliationCache = new Map();
function clearAffiliationCache() {
  _affiliationCache.clear();
}
window.clearAffiliationCache = clearAffiliationCache;

function getMemberAffiliationInfo(member, categoryId = null, subgroupId = null) {
  if (!member) {
    return { role: "", swatRole: "", status: "active", badgeColor: "bg-zinc-800", isResigned: false };
  }

  const catId = categoryId || (state && state.currentCategory) || member.category;
  const grpId = subgroupId !== undefined ? subgroupId : (state && state.currentGroup ? state.currentGroup.id : member.subgroup);

  const cacheKey = `${member.id || member.name}_${catId || ''}_${grpId || ''}`;
  const cached = _affiliationCache.get(cacheKey);
  if (cached) return cached;

  let aff = null;
  if (Array.isArray(member.affiliations)) {
    // 1순위: category와 subgroup 모두 일치 (grpId가 있으면 subgroup 일치, 없으면 subgroup이 없거나 null인 것 우선)
    if (grpId) {
      aff = member.affiliations.find(a => a.category === catId && a.subgroup === grpId);
    } else {
      aff = member.affiliations.find(a => a.category === catId && !a.subgroup);
    }
    // 2순위: category만 일치
    if (!aff) {
      aff = member.affiliations.find(a => a.category === catId);
    }
  }

  let role = "";
  let rawSwat = "";
  let status = "active";
  let badgeColor = "bg-blue-600";

  if (aff) {
    // 해당 소속(affiliation)의 고유 직위 및 추가직책 사용 (미입력 시 공백 유지, 원래 직업의 직위/추가직책 절대 상속 금지)
    role = (aff.role !== undefined && aff.role !== null) ? String(aff.role).trim() : "";
    rawSwat = (aff.swatRole !== undefined && aff.swatRole !== null) ? String(aff.swatRole).trim() : "";
    status = (aff.status !== undefined && aff.status !== null && aff.status !== "") ? aff.status : (member.status || "active");
    badgeColor = (aff.badgeColor !== undefined && aff.badgeColor !== null && aff.badgeColor !== "") ? aff.badgeColor : (member.badgeColor || "bg-blue-600");
  } else if (!Array.isArray(member.affiliations) || member.affiliations.length === 0 || (member.category === catId && (!grpId || member.subgroup === grpId))) {
    // affiliations 배열이 없는 레거시 또는 현재 소속 객체 자체인 경우
    role = (member.role !== undefined && member.role !== null) ? String(member.role).trim() : "";
    rawSwat = (member.swatRole !== undefined && member.swatRole !== null) ? String(member.swatRole).trim() : "";
    status = (member.status !== undefined && member.status !== null && member.status !== "") ? member.status : "active";
    badgeColor = (member.badgeColor !== undefined && member.badgeColor !== null && member.badgeColor !== "") ? member.badgeColor : "bg-blue-600";
  } else {
    // affiliations 배열이 있으나 현재 탭에 매칭되는 소속이 없는 경우: 타 소속/원래 직업 직위 상속 금지 (빈 값 유지)
    role = "";
    rawSwat = "";
    status = (member.status !== undefined && member.status !== null && member.status !== "") ? member.status : "active";
    badgeColor = (member.badgeColor !== undefined && member.badgeColor !== null && member.badgeColor !== "") ? member.badgeColor : "bg-blue-600";
  }

  const roleStr = typeof role === "string" ? role : String(role || "");
  const swatStr = typeof rawSwat === "string" ? rawSwat : String(rawSwat || "");
  const statusStr = typeof status === "string" ? status : String(status || "active");

  const isMartyred = statusStr === "martyred" || statusStr === "순직" ||
                     swatStr.includes("순직") || roleStr.includes("순직");

  const isRetired = !isMartyred && (statusStr === "retired" || statusStr === "면직" || statusStr === "퇴직" || statusStr === "은퇴" ||
                    swatStr.includes("면직") || swatStr.includes("퇴직") || swatStr.includes("은퇴") ||
                    roleStr.includes("면직") || roleStr.includes("퇴직") || roleStr.includes("은퇴"));

  const isResigned = !isMartyred && !isRetired && (statusStr === "resigned" || statusStr === "사직" ||
                     swatStr.includes("사직") || roleStr.includes("사직"));

  const isInactive = isMartyred || isRetired || isResigned;

  // swatRole에서 순직/사직/면직/퇴직/은퇴 텍스트는 순수 추가직책(특공대장, 특공대원, 정보부, 가이드)과 분리
  let swatRole = swatStr;
  if (swatRole.includes("순직") || swatRole.includes("사직") || swatRole.includes("면직") || swatRole.includes("퇴직") || swatRole.includes("은퇴")) {
    swatRole = swatRole.replace(/순직|사직|면직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
  }

  const result = {
    role,
    swatRole,
    status,
    badgeColor,
    isResigned,
    isRetired,
    isMartyred,
    isInactive,
    aff
  };

  if (_affiliationCache.size < 4000) {
    _affiliationCache.set(cacheKey, result);
  }
  return result;
}

// 사직 여부 판별
function isMemberResigned(member, categoryId = null, subgroupId = null) {
  if (!member) return false;
  return getMemberAffiliationInfo(member, categoryId, subgroupId).isResigned;
}

// 면직 / 은퇴 여부 판별
function isMemberRetired(member, categoryId = null, subgroupId = null) {
  if (!member) return false;
  return getMemberAffiliationInfo(member, categoryId, subgroupId).isRetired;
}

// 순직 여부 판별
function isMemberMartyred(member, categoryId = null, subgroupId = null) {
  if (!member) return false;
  return getMemberAffiliationInfo(member, categoryId, subgroupId).isMartyred;
}

// 비활동(사직/순직/면직) 여부 판별
function isMemberInactive(member, categoryId = null, subgroupId = null) {
  if (!member) return false;
  return getMemberAffiliationInfo(member, categoryId, subgroupId).isInactive;
}

// 조직원 및 조합원 직책 뱃지는 프로필 아바타에 표시하지 않고 인원 정보 텍스트에서만 표시
function isRoleBadgeHidden(role) {
  if (!role) return true;
  const r = String(role).trim();
  return r === "조직원" || r === "조합원";
}
window.isRoleBadgeHidden = isRoleBadgeHidden;

// 경찰 계급별 전용 색상 및 공통 직책 뱃지 색상 판별 (탭별 소속 격리 반영)
function getMemberRoleBadgeClass(member, categoryHint = null, subgroupId = null) {
  if (!member) return "";
  const info = getMemberAffiliationInfo(member, categoryHint, subgroupId);
  const role = (info.role || '').trim();
  if (!role) return "";

  if (info.isInactive && (role.includes("사직") || role.includes("면직") || role.includes("퇴직") || role.includes("은퇴") || role.includes("순직"))) {
    return "bg-zinc-800/90 text-zinc-400 border border-zinc-700/80";
  }

  const badgeColorMap = {
    'bg-white': 'bg-white text-zinc-950 font-bold border border-zinc-300 shadow-sm',
    'bg-amber-500': 'bg-amber-500 text-zinc-950 font-black border border-amber-300 shadow-sm',
    'bg-indigo-600': 'bg-indigo-600 text-white border border-indigo-400/40 shadow-sm font-semibold',
    'bg-cyan-700': 'bg-cyan-700 text-white border border-cyan-400/40 shadow-sm font-semibold',
    'bg-rose-500': 'bg-rose-500 text-white border border-rose-300/40 shadow-sm font-semibold',
    'bg-rose-600': 'bg-rose-600 text-white border border-rose-400/50 shadow-sm font-bold',
    'bg-orange-500': 'bg-orange-500 text-white border border-orange-300/40 shadow-sm font-semibold',
    'bg-green-600': 'bg-green-600 text-white border border-green-400/40 shadow-sm font-semibold',
    'bg-lime-500': 'bg-lime-500 text-zinc-950 font-bold border border-lime-300/50 shadow-sm',
    'bg-violet-600': 'bg-violet-600 text-white border border-violet-400/50 shadow-sm font-bold',
    'bg-fuchsia-500': 'bg-fuchsia-500 text-white border border-fuchsia-300/40 shadow-sm font-semibold',
    'bg-slate-700': 'bg-slate-700 text-white border border-slate-500/50 shadow-sm font-semibold',
    'bg-yellow-400': 'bg-yellow-400 text-zinc-950 font-bold shadow-sm',
    'bg-pink-600': 'bg-pink-600 text-white shadow-sm font-semibold',
    'bg-pink-500': 'bg-pink-500 text-white shadow-sm font-semibold',
    'bg-emerald-500': 'bg-emerald-500 text-white border border-emerald-300/60 shadow-sm font-bold',
    'bg-emerald-600': 'bg-emerald-600 text-white shadow-sm font-semibold',
    'bg-teal-500': 'bg-teal-500 text-zinc-950 font-bold border border-teal-200/80 shadow-sm',
    'bg-teal-600': 'bg-teal-600 text-white shadow-sm font-semibold',
    'bg-teal-700': 'bg-teal-600 text-white shadow-sm font-semibold',
    'bg-teal-900': 'bg-teal-500 text-zinc-950 font-bold border border-teal-200/80 shadow-sm',
    'bg-sky-500': 'bg-sky-500 text-white shadow-sm font-semibold',
    'bg-sky-600': 'bg-sky-600 text-white shadow-sm font-semibold',
    'bg-sky-700': 'bg-sky-700 text-white border border-sky-400/60 shadow-sm font-semibold',
    'bg-red-600': 'bg-red-600 text-white shadow-sm font-semibold',
    'bg-red-900': 'bg-red-900 text-white border border-red-700/60 shadow-sm font-bold',
    'bg-orange-400': 'bg-orange-400 text-zinc-950 font-bold shadow-sm',
    'bg-orange-700': 'bg-orange-700 text-white shadow-sm font-semibold',
    'bg-amber-600': 'bg-amber-600 text-white shadow-sm font-bold',
    'bg-purple-600': 'bg-purple-600 text-white shadow-sm font-semibold',
    'bg-zinc-700': 'bg-zinc-700 text-white shadow-sm font-semibold',
    'bg-zinc-800': 'bg-zinc-800 text-white shadow-sm font-semibold',
    'bg-blue-600': 'bg-blue-600 text-white shadow-sm font-semibold'
  };

  // 1순위: info.badgeColor에 명시적으로 지정된 색상이 매핑 테이블에 있으면 우선 적용
  if (info.badgeColor && badgeColorMap[info.badgeColor]) {
    return badgeColorMap[info.badgeColor];
  }

  const curCat = categoryHint || (info.aff && info.aff.category) || (state && state.currentCategory) || member.category;
  const curSub = (subgroupId !== undefined && subgroupId !== null) ? subgroupId : ((info.aff && info.aff.subgroup) || (state && state.currentGroup ? state.currentGroup.id : member.subgroup));

  const isPolice = curCat === 'police';
  if (isPolice) {
    if (role.includes("부청장")) return "bg-red-600 text-white shadow-sm font-semibold";
    if (role.includes("청장")) return "bg-red-900 text-white border border-red-700/60 shadow-sm font-bold";
    if (role.includes("서장") || role.includes("경정") || role.includes("경감")) return "bg-red-600 text-white shadow-sm font-semibold";
    if (role.includes("경위")) return "bg-white text-zinc-950 font-bold border border-zinc-300 shadow-sm";
    if (role.includes("경사")) return "bg-orange-400 text-zinc-950 font-bold shadow-sm";
    if (role.includes("경장")) return "bg-pink-500 text-white shadow-sm";
    if (role.includes("팀장")) return "bg-emerald-600 text-white shadow-sm font-semibold";
    if (role.includes("순경")) return "bg-blue-600 text-white shadow-sm font-semibold";
    if (role.includes("교육생")) return "bg-yellow-400 text-zinc-950 font-bold shadow-sm";
    if (role.includes("서버장")) return "bg-emerald-500 text-white border border-emerald-300/60 shadow-sm font-bold";
    if (role.includes("가이드")) return "bg-emerald-600 text-white shadow-sm font-semibold";
  }

  const isEMS = curCat === 'ems';
  if (isEMS) {
    if (role.includes("병원장")) return "bg-teal-500 text-zinc-950 font-bold border border-teal-200/80 shadow-sm";
    if (role.includes("간호부장")) return "bg-teal-600 text-white shadow-sm font-semibold";
    if (role.includes("간호실장")) return "bg-cyan-600 text-white shadow-sm font-semibold";
    if (role.includes("간호사")) return "bg-emerald-500 text-zinc-950 font-bold shadow-sm";
  }

  const isPress = curCat === 'press';
  if (isPress) {
    if (role.includes("국장")) return "bg-sky-700 text-white border border-sky-400/60 shadow-sm font-semibold";
    if (role.includes("기자")) return "bg-sky-500 text-white shadow-sm font-semibold";
  }

  const isGang = curCat === 'gang';
  if (isGang) {
    if (role.includes("보스") || role.includes("두목")) return "bg-red-600 text-white shadow-sm font-semibold";
    if (role.includes("부두목")) return "bg-purple-600 text-white shadow-sm font-semibold";
    if (role.includes("조합장") || role.includes("위원장")) return "bg-amber-600 text-white shadow-sm font-bold";
    if (role.includes("청년회장")) return "bg-indigo-600 text-white shadow-sm font-semibold";
    if (role.includes("용병")) return "bg-emerald-600 text-white shadow-sm font-semibold";
    if (role.includes("인턴")) return "bg-teal-600 text-white shadow-sm font-semibold";
    if (role.includes("간부")) return "bg-orange-700 text-white shadow-sm font-semibold";
    if (role.includes("탈퇴")) return "bg-zinc-800 text-white shadow-sm font-semibold";
    if (role.includes("조직원") || role.includes("조합원")) return "bg-zinc-700 text-white shadow-sm font-semibold";
  }

  const isLux = curCat === 'business' && curSub === 'biz-lux';
  if (isLux) {
    if (role.includes("대표")) return "bg-amber-600 text-white shadow-sm font-bold";
    if (role.includes("이사")) return "bg-purple-600 text-white shadow-sm font-semibold";
  }

  const isYastation = curCat === 'business' && curSub === 'biz-yastation';
  if (isYastation) {
    if (role.includes("사장")) return "bg-amber-500 text-zinc-950 font-black border border-amber-300 shadow-sm";
    if (role.includes("메카닉 1기")) return "bg-indigo-600 text-white border border-indigo-400/40 shadow-sm font-semibold";
    if (role.includes("메카닉 2기")) return "bg-cyan-700 text-white border border-cyan-400/40 shadow-sm font-semibold";
    if (role.includes("홍보")) return "bg-rose-500 text-white border border-rose-300/40 shadow-sm font-semibold";
  }

  const isYoung31 = curCat === 'business' && curSub === 'biz-young31';
  if (isYoung31) {
    if (role.includes("대표")) return "bg-rose-600 text-white border border-rose-400/50 shadow-sm font-bold";
    if (role.includes("매니저")) return "bg-orange-500 text-white border border-orange-300/40 shadow-sm font-semibold";
    if (role.includes("직원")) return "bg-green-600 text-white border border-green-400/40 shadow-sm font-semibold";
    if (role.includes("알바생")) return "bg-lime-500 text-zinc-950 font-bold border border-lime-300/50 shadow-sm";
  }

  const isKoi = curCat === 'business' && curSub === 'biz-koi';
  if (isKoi) {
    if (role.includes("메이드장")) return "bg-violet-600 text-white border border-violet-400/50 shadow-sm font-bold";
    if (role.includes("메이드")) return "bg-fuchsia-500 text-white border border-fuchsia-300/40 shadow-sm font-semibold";
    if (role.includes("집사")) return "bg-slate-700 text-white border border-slate-500/50 shadow-sm font-semibold";
  }

  if (role.includes("서버장")) return "bg-emerald-500 text-white border border-emerald-300/60 shadow-sm font-bold";
  if (role.includes("가이드")) return "bg-emerald-600 text-white shadow-sm font-semibold";

  return `${info.badgeColor || member.badgeColor || 'bg-zinc-800'} text-white shadow-sm font-semibold`;
}

// 특공대 및 추가 직책 대각선 뱃지 렌더링 (프로필 왼쪽 위 대각선)
function getSwatBadgeHtml(swatRole, size = 'md') {
  if (!swatRole) return '';
  const roleStr = typeof swatRole === "string" ? swatRole : String(swatRole || '');
  if (!roleStr.trim()) return '';
  const isServerBoss = roleStr.includes('서버장');
  const isLeader = !isServerBoss && roleStr.includes('특공대장');
  const isGuide = !isServerBoss && roleStr.includes('가이드');
  const isInfo = roleStr.includes('정보부');
  const isMartyred = roleStr.includes('순직');
  const isRetired = roleStr.includes('면직') || roleStr.includes('퇴직') || roleStr.includes('은퇴');
  const isResigned = roleStr.includes('사직');

  let colorClasses = '';
  if (isMartyred) {
    // 순직 전용 스탬프 뱃지 (다크 블랙 + 선명한 레드 텍스트/테두리)
    if (size === 'lg') {
      colorClasses = 'bg-zinc-950/95 text-red-400 border border-red-800/90 shadow-xl shadow-red-950/40 ring-1 ring-red-900/40';
    } else if (size === 'sm') {
      colorClasses = 'bg-zinc-950/95 text-red-400 border border-red-800/90 shadow ring-1 ring-red-900/40';
    } else {
      colorClasses = 'bg-zinc-950/95 text-red-400 border border-red-800/90 shadow-md ring-1 ring-red-900/40';
    }
  } else if (isRetired) {
    // 면직 전용 스탬프 뱃지 (다크 블랙 + 실버/그레이 텍스트/테두리)
    if (size === 'lg') {
      colorClasses = 'bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow-xl shadow-zinc-950/40 ring-1 ring-zinc-700/40';
    } else if (size === 'sm') {
      colorClasses = 'bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow ring-1 ring-zinc-700/40';
    } else {
      colorClasses = 'bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow-md ring-1 ring-zinc-700/40';
    }
  } else if (isResigned) {
    // 사직 전용 스탬프 뱃지 (다크 블랙 + 엄숙한 앰버 텍스트/테두리)
    if (size === 'lg') {
      colorClasses = 'bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow-xl shadow-amber-950/40 ring-1 ring-amber-900/40';
    } else if (size === 'sm') {
      colorClasses = 'bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow ring-1 ring-amber-900/40';
    } else {
      colorClasses = 'bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow-md ring-1 ring-amber-900/40';
    }
  } else if (isInfo) {
    // 정보부 전용 색상 (시크한 보라/퍼플 + 화이트 텍스트)
    if (size === 'lg') {
      colorClasses = 'bg-purple-600 text-white border border-purple-300 shadow-xl shadow-purple-600/30';
    } else if (size === 'sm') {
      colorClasses = 'bg-purple-600 text-white border border-purple-300 shadow';
    } else {
      colorClasses = 'bg-purple-600 text-white border border-purple-300 shadow-md';
    }
  } else if (isServerBoss) {
    // 서버장 (가이드의 상위 직책 - 특공대장처럼 화사하게 빛나는 파스텔 에메랄드 + 화이트 테두리 및 광채 섀도우)
    if (size === 'lg') {
      colorClasses = 'bg-emerald-300 text-zinc-950 border border-white shadow-xl shadow-emerald-400/40 ring-1 ring-white/60 font-black';
    } else if (size === 'sm') {
      colorClasses = 'bg-emerald-300 text-zinc-950 border border-white shadow ring-1 ring-white/50 font-black';
    } else {
      colorClasses = 'bg-emerald-300 text-zinc-950 border border-white shadow-lg shadow-emerald-400/40 ring-1 ring-white/50 font-black';
    }
  } else if (isGuide) {
    // 가이드 전용 색상 (에메랄드/초록 + 선명한 검정 텍스트)
    if (size === 'lg') {
      colorClasses = 'bg-emerald-400 text-zinc-950 border border-emerald-200 shadow-xl shadow-emerald-500/25';
    } else if (size === 'sm') {
      colorClasses = 'bg-emerald-400 text-zinc-950 border border-emerald-200 shadow';
    } else {
      colorClasses = 'bg-emerald-400 text-zinc-950 border border-emerald-200 shadow-md';
    }
  } else if (isLeader) {
    // 특공대장 (화사한 파스텔 하늘색)
    if (size === 'lg') {
      colorClasses = 'bg-sky-300 text-zinc-950 border border-white shadow-xl shadow-sky-400/30 font-black';
    } else if (size === 'sm') {
      colorClasses = 'bg-sky-300 text-zinc-950 border border-white shadow font-black';
    } else {
      colorClasses = 'bg-sky-300 text-zinc-950 border border-white shadow-lg shadow-sky-400/30 font-black';
    }
  } else {
    // 특공대원 및 기타 추가 직책 (선명한 하늘색)
    if (size === 'lg') {
      colorClasses = 'bg-sky-400 text-zinc-950 border border-sky-200 shadow-lg shadow-sky-500/25';
    } else if (size === 'sm') {
      colorClasses = 'bg-sky-400 text-zinc-950 border border-sky-200 shadow';
    } else {
      colorClasses = 'bg-sky-400 text-zinc-950 border border-sky-200 shadow-md';
    }
  }

  const roleText = roleStr.replace(/\(.*?\)/g, '').trim();
  const safeRoleText = typeof escapeHtml === 'function' ? escapeHtml(roleText) : roleText;

  if (size === 'lg') {
    return `
      <span class="absolute -top-2.5 -left-2.5 z-20 text-xs font-black px-2.5 py-1 rounded-xl ${colorClasses} -rotate-12 flex items-center justify-center whitespace-nowrap select-none tracking-tight" title="추가 직책: ${safeRoleText}">
        <span>${safeRoleText}</span>
      </span>
    `;
  }

  if (size === 'sm') {
    return `
      <span class="absolute -top-1.5 -left-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md ${colorClasses} -rotate-12 flex items-center justify-center whitespace-nowrap select-none tracking-tight" title="추가 직책: ${safeRoleText}">
        <span>${safeRoleText}</span>
      </span>
    `;
  }

  // md size (카드 아바타)
  return `
    <span class="absolute -top-2 -left-2 z-20 text-[9.5px] font-black px-2 py-0.5 rounded-md ${colorClasses} -rotate-12 flex items-center justify-center whitespace-nowrap select-none tracking-tight" title="추가 직책: ${safeRoleText}">
      <span>${safeRoleText}</span>
    </span>
  `;
}

window.getSwatBadgeHtml = getSwatBadgeHtml;
window.getMemberRoleBadgeClass = getMemberRoleBadgeClass;

function renderHeaderAuth() {
  const container = document.getElementById("header-auth");
  if (!container) return;

  const isMyPageActive = state.currentCategory === 'mypage' && !state.searchQuery && !state.currentMember;
  const isAdminPageActive = state.currentCategory === 'adminpage' && !state.searchQuery && !state.currentMember;

  if (isAdmin()) {
    container.innerHTML = `
      <div class="flex items-center gap-1.5 sm:gap-2">
        <button onclick="selectMyPage()" class="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl ${isMyPageActive ? 'bg-red-600 text-white font-bold ring-2 ring-red-500/30 shadow-lg shadow-red-600/30' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white font-semibold'} text-[11px] sm:text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap" title="마이페이지 (시청 기록 및 통계)">
          <span>👤 <span class="hidden sm:inline">마이</span>페이지</span>
        </button>
        <button onclick="selectAdminPage()" class="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl ${isAdminPageActive ? 'bg-amber-500 text-black font-black ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/30' : 'bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 font-bold'} text-[11px] sm:text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap" title="관리자 센터 (방문자 통계, 구독자·조회수 갱신, 백업 관리)">
          <span class="w-2 h-2 rounded-full ${isAdminPageActive ? 'bg-black' : 'bg-amber-400 animate-pulse'}"></span>
          <span>🛡️ 어드민</span>
        </button>
        <button onclick="logoutUser()" class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11px] sm:text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer whitespace-nowrap">
          로그아웃
        </button>
      </div>
    `;
    if (typeof updateServerStatusBadge === "function") {
      updateServerStatusBadge();
    }
  } else if (isUserLoggedIn()) {
    container.innerHTML = `
      <div class="flex items-center gap-1.5 sm:gap-2">
        <button onclick="selectMyPage()" class="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl ${isMyPageActive ? 'bg-red-600 text-white font-bold ring-2 ring-red-500/30 shadow-lg shadow-red-600/30' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white font-semibold'} text-[11px] sm:text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap" title="마이페이지 (시청 기록 및 통계)">
          <span>👤 <span class="hidden sm:inline">마이</span>페이지</span>
        </button>
        <button onclick="logoutUser()" class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11px] sm:text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer whitespace-nowrap">
          로그아웃
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center gap-1.5 sm:gap-2">
        <span class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
          <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
          게스트 (시청 전용)
        </span>
        <button onclick="openLoginModal()" class="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold transition-all shadow-md shadow-red-600/25 cursor-pointer whitespace-nowrap">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
          <span>로그인</span>
        </button>
      </div>
    `;
  }
}

function setVideoTab(tab) {
  state.currentVideoTab = tab;
  if (typeof replaceNavHistory === "function") {
    replaceNavHistory();
  }
  const container = document.getElementById("main-content");
  if (!container || !state.currentMember) return;

  const currentMemberHeader = document.getElementById(`member-profile-header-${state.currentMember.id}`);
  const videoGrid = document.getElementById("member-videos-grid");

  if (currentMemberHeader && videoGrid && typeof updateMemberVideoTabContent === "function") {
    updateMemberVideoTabContent(state.currentMember);
  } else {
    renderMemberVideos(container);
  }

  if (typeof updateFloatingCategoryNavVisibility === "function") {
    updateFloatingCategoryNavVisibility();
  }
}

function renderCategoryTabs() {
  const navContainer = document.getElementById("category-nav-container");
  if (navContainer) {
    if (state.currentCategory === "adminpage") {
      navContainer.style.display = "none";
      const floatingNav = document.getElementById("floating-category-nav");
      if (floatingNav) {
        floatingNav.classList.add("opacity-0", "pointer-events-none", "-translate-x-6");
        floatingNav.classList.remove("opacity-100", "translate-x-0");
        floatingNav.style.display = "none";
      }
      return;
    } else {
      navContainer.style.display = "";
    }
  }

  const tabContainer = document.getElementById("category-tabs");
  if (!tabContainer) return;

  const secondaryContainer = document.getElementById("secondary-tabs");

  // 직업 카테고리 (경찰, EMS, 갱단, 사업체, 기자, 시민 등)
  const jobCategories = KONGBAP_DATA.categories.filter(cat => cat.id !== "guide" && cat.id !== "loveline");
  // 하단 2행 탭 (가이드, 러브라인)
  const subCategories = KONGBAP_DATA.categories.filter(cat => cat.id === "guide" || cat.id === "loveline");

  function renderCategoryBtn(cat) {
    const isActive = state.currentCategory === cat.id && !state.searchQuery;
    const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
    const activeClass = isActive 
      ? `${theme.activeTab} border-transparent` 
      : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border-zinc-800";

    const memberCount = getCategoryMembers(cat).length;
    let countLabel = `${memberCount}명`;
    if (cat.id === "loveline") {
      const couples = typeof getLovelineList === "function" ? getLovelineList() : [];
      countLabel = `${couples.length}커플`;
    } else if (cat.id === "guide") {
      countLabel = `${memberCount}개`;
    }

    return `
      <button 
        type="button"
        data-cat-id="${cat.id}"
        onclick="selectCategory('${cat.id}')" 
        class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-3.5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 select-none ${activeClass}"
      >
        <span class="leading-none">${cat.emoji || ''}</span>
        <span class="leading-none">${cat.name}</span>
        <span class="category-count-badge text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold transition-colors duration-150 leading-none ${isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">
          ${countLabel}
        </span>
      </button>
    `;
  }

  function updateCategoryTabContainer(container, categories) {
    if (!container) return;
    const existingButtons = container.querySelectorAll("button[data-cat-id]");
    if (existingButtons.length === categories.length) {
      existingButtons.forEach(btn => {
        const catId = btn.getAttribute("data-cat-id");
        const cat = categories.find(c => c.id === catId);
        if (!cat) return;
        const isActive = state.currentCategory === cat.id && !state.searchQuery;
        const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
        const activeClass = isActive 
          ? `${theme.activeTab} border-transparent` 
          : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border-zinc-800";
        btn.className = `flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-3.5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 select-none ${activeClass}`;
        const badge = btn.querySelector(".category-count-badge");
        if (badge) {
          const memberCount = getCategoryMembers(cat).length;
          let countLabel = `${memberCount}명`;
          if (cat.id === "loveline") {
            const couples = typeof getLovelineList === "function" ? getLovelineList() : [];
            countLabel = `${couples.length}커플`;
          } else if (cat.id === "guide") {
            countLabel = `${memberCount}개`;
          }
          badge.textContent = countLabel;
          badge.className = `category-count-badge text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold transition-colors duration-150 leading-none ${isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}`;
        }
      });
      return;
    }
    container.innerHTML = categories.map(renderCategoryBtn).join("");
  }

  const isStatsActive = (state.currentCategory === "stats" || state.currentCategory === "leaderboard") && !state.searchQuery;
  const allMembers = typeof getAllMembersWithLeaderboardStats === "function" ? getAllMembersWithLeaderboardStats() : [];
  const totalMembersCount = allMembers.length || 0;

  if (secondaryContainer) {
    updateCategoryTabContainer(tabContainer, jobCategories);
    updateCategoryTabContainer(secondaryContainer, subCategories);
  } else {
    updateCategoryTabContainer(tabContainer, KONGBAP_DATA.categories);
  }

  // 우측 상단 종합 통계 카드 버튼 (원래의 큰 버튼 UI 유지)
  const headerStatsEl = document.getElementById("header-stats");
  if (headerStatsEl) {
    headerStatsEl.onclick = () => selectCategory('stats');
    if (typeof updateHeaderStats === "function") {
      updateHeaderStats();
    }
  }

  const floatingContainer = document.getElementById("floating-category-tabs");
  if (floatingContainer) {
    const existingFloatingBtns = floatingContainer.querySelectorAll("button[data-floating-cat-id]");
    if (existingFloatingBtns.length > 0) {
      // In-place DOM 갱신: 요소 재생성 없이 클래스 및 뱃지만 신속 업데이트 (레이아웃 밀림 및 재렌더링 방지)
      const statsBtn = document.getElementById("floating-stats-btn");
      if (statsBtn) {
        statsBtn.className = `group flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm border transition-all duration-200 cursor-pointer select-none ${isStatsActive ? 'bg-amber-950/85 text-amber-300 border-amber-500/70 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/30 font-bold' : 'bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 text-amber-300 hover:text-amber-200 border-amber-500/40 hover:border-amber-400/80 shadow-md shadow-amber-950/30'}`;
        const badge = statsBtn.querySelector(".floating-nav-badge");
        if (badge) {
          badge.className = `floating-nav-badge text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-extrabold ${isStatsActive ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40' : 'bg-amber-500/25 text-amber-300 border border-amber-500/40 group-hover:bg-amber-500/35'}`;
        }
      }

      existingFloatingBtns.forEach(btn => {
        const catId = btn.getAttribute("data-floating-cat-id");
        const cat = KONGBAP_DATA.categories.find(c => c.id === catId);
        if (!cat) return;
        const isActive = state.currentCategory === cat.id && !state.searchQuery;
        const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
        const activeClass = isActive 
          ? `${theme.activeTab} ring-1 ring-white/25 shadow-lg font-bold border-transparent` 
          : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800/90 border-zinc-800/80 hover:border-zinc-700";
        btn.className = `group flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm border transition-all duration-200 cursor-pointer select-none ${activeClass}`;

        const badge = btn.querySelector(".floating-nav-badge");
        if (badge) {
          const memberCount = getCategoryMembers(cat).length;
          let countLabel = `${memberCount}명`;
          if (cat.id === "loveline") {
            const couples = typeof getLovelineList === "function" ? getLovelineList() : [];
            countLabel = `${couples.length}커플`;
          } else if (cat.id === "guide") {
            countLabel = `${memberCount}개`;
          }
          const labelSpan = badge.querySelector(".floating-nav-label");
          const shortSpan = badge.querySelector(".floating-nav-short");
          if (labelSpan) labelSpan.textContent = countLabel;
          if (shortSpan) shortSpan.textContent = String(memberCount);
          badge.className = `floating-nav-badge text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-extrabold ${isActive ? 'bg-black/40 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`;
        }
      });
    } else {
      function renderFloatingCatBtn(cat) {
        const isActive = state.currentCategory === cat.id && !state.searchQuery;
        const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
        const activeClass = isActive 
          ? `${theme.activeTab} ring-1 ring-white/25 shadow-lg font-bold border-transparent` 
          : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800/90 border-zinc-800/80 hover:border-zinc-700";

        const memberCount = getCategoryMembers(cat).length;
        let countLabel = `${memberCount}명`;
        if (cat.id === "loveline") {
          const couples = typeof getLovelineList === "function" ? getLovelineList() : [];
          countLabel = `${couples.length}커플`;
        } else if (cat.id === "guide") {
          countLabel = `${memberCount}개`;
        }

        return `
          <button 
            data-floating-cat-id="${cat.id}"
            onclick="selectCategory('${cat.id}')" 
            title="${cat.name} (${countLabel})"
            class="group flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm border transition-all duration-200 cursor-pointer select-none ${activeClass}"
          >
            <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span class="text-base sm:text-lg flex-shrink-0 leading-none">${cat.emoji || ''}</span>
              <span class="floating-nav-label hidden sm:inline whitespace-nowrap font-bold text-xs sm:text-sm">${cat.name}</span>
            </div>
            <span class="floating-nav-badge text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-extrabold ${isActive ? 'bg-black/40 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}">
              <span class="floating-nav-label hidden sm:inline">${countLabel}</span>
              <span class="floating-nav-short sm:hidden">${memberCount}</span>
            </span>
          </button>
        `;
      }

      // 1) 맨 위로 이동 (제일 위에 배치)
      const scrollTopBtnHtml = `
        <button 
          onclick="window.scrollTo({ top: 0, behavior: 'smooth' })" 
          title="페이지 최상단으로 이동" 
          class="group flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/90 transition-all cursor-pointer select-none border border-transparent hover:border-zinc-700"
        >
          <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span class="text-base sm:text-lg flex-shrink-0 leading-none font-black text-center w-5 sm:w-auto">↑</span>
            <span class="floating-nav-label hidden sm:inline whitespace-nowrap font-bold text-xs sm:text-sm">맨 위로 이동</span>
          </div>
          <span class="floating-nav-badge text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-extrabold bg-zinc-800 text-zinc-400 group-hover:text-zinc-200">
            <span class="floating-nav-label hidden sm:inline">TOP</span>
            <span class="floating-nav-short sm:hidden">↑</span>
          </span>
        </button>
        <div class="pt-1 my-0.5 border-t border-zinc-800/80"></div>
      `;

      // 2) 종합 통계 (맨 위로 이동 다음 배치)
      const statsFloatingBtnHtml = `
        <button 
          id="floating-stats-btn"
          onclick="selectCategory('stats')" 
          title="명예의 전당 & 종합 통계 보기"
          class="group flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm border transition-all duration-200 cursor-pointer select-none ${isStatsActive ? 'bg-amber-950/85 text-amber-300 border-amber-500/70 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/30 font-bold' : 'bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 text-amber-300 hover:text-amber-200 border-amber-500/40 hover:border-amber-400/80 shadow-md shadow-amber-950/30'}"
        >
          <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span class="text-base sm:text-lg flex-shrink-0 leading-none">📊</span>
            <span class="floating-nav-label hidden sm:inline whitespace-nowrap font-bold text-xs sm:text-sm">종합 통계</span>
          </div>
          <span class="floating-nav-badge text-[10px] sm:text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-extrabold ${isStatsActive ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40' : 'bg-amber-500/25 text-amber-300 border border-amber-500/40 group-hover:bg-amber-500/35'}">
            <span class="floating-nav-label hidden sm:inline">랭킹</span>
            <span class="floating-nav-short sm:hidden">★</span>
          </span>
        </button>
        <div class="pt-1 my-0.5 border-t border-zinc-800/80"></div>
      `;

      // 3) 직업탭 순서대로 (줄 없이 연달아 배치)
      const jobHtml = jobCategories.map(renderFloatingCatBtn).join("");
      const subHtml = subCategories.map(renderFloatingCatBtn).join("");

      floatingContainer.innerHTML = scrollTopBtnHtml + statsFloatingBtnHtml + jobHtml + subHtml;
    }
  }

  updateFloatingCategoryNavVisibility();
}

function updateFloatingCategoryNavVisibility() {
  const floatingNav = document.getElementById("floating-category-nav");
  if (!floatingNav) return;

  // 화면 너비가 1280px(xl) 미만인 모바일 및 태블릿(패드)에서는 좌측 플로팅 네비게이션을 완전 숨김(display: none)
  if (window.innerWidth < 1280) {
    floatingNav.classList.add("opacity-0", "pointer-events-none", "-translate-x-6");
    floatingNav.classList.remove("opacity-100", "translate-x-0");
    floatingNav.style.display = "none";
    return;
  }

  const target = document.getElementById("secondary-tabs") || document.getElementById("category-tabs");
  let shouldShow = false;

  if (target) {
    const rect = target.getBoundingClientRect();
    const header = document.querySelector("header");
    const headerBottom = header ? header.getBoundingClientRect().bottom : 65;
    // target(상단 가로 탭 바)의 하단이 헤더 아래로 완전히 스크롤되어 화면에서 벗어났을 때
    shouldShow = rect.bottom <= (headerBottom + 5);
  } else {
    shouldShow = window.scrollY > 150;
  }

  if (state.searchQuery || state.currentCategory === "mypage" || state.currentCategory === "adminpage") {
    shouldShow = false;
  }

  // 좌측 여백 공간 계산: 메인 콘텐츠 영역과 뷰포트 좌측 사이의 거리
  const mainEl = document.querySelector("main");
  const mainRect = mainEl ? mainEl.getBoundingClientRect() : null;
  const leftMargin = mainRect ? mainRect.left : 0;

  // 여백이 100px 미만인 경우 본문 카드를 가리지 않도록 숨김 처리
  if (leftMargin < 100) {
    shouldShow = false;
  }

  if (shouldShow) {
    floatingNav.style.display = "flex";
    // 여백이 225px 미만이면(예: 1440px 등 일반 노트북 화면) 컴팩트 아이콘 모드로 전환하여 카드와 절대 겹치지 않게 배치
    if (leftMargin < 225) {
      floatingNav.classList.add("compact-mode");
      const dockLeft = Math.max(8, Math.floor(leftMargin - 56));
      floatingNav.style.left = `${dockLeft}px`;
    } else {
      floatingNav.classList.remove("compact-mode");
      const dockLeft = Math.max(16, Math.floor(leftMargin - 210));
      floatingNav.style.left = `${dockLeft}px`;
    }

    floatingNav.classList.remove("opacity-0", "pointer-events-none", "-translate-x-6");
    floatingNav.classList.add("opacity-100", "translate-x-0");
  } else {
    floatingNav.classList.add("opacity-0", "pointer-events-none", "-translate-x-6");
    floatingNav.classList.remove("opacity-100", "translate-x-0");
    floatingNav.style.display = "none";
  }
}
window.updateFloatingCategoryNavVisibility = updateFloatingCategoryNavVisibility;

function getCurrentCategory() {
  return KONGBAP_DATA.categories.find(c => c.id === state.currentCategory) || KONGBAP_DATA.categories[0];
}

let currentMyPageCategoryFilter = "all";

async function renderMyPage(container) {
  if (!container) return;

  if (!isUserLoggedIn()) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto py-20 px-4 text-center">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mb-4">🔒</div>
        <h2 class="text-xl sm:text-2xl font-black text-white mb-2">로그인이 필요합니다</h2>
        <p class="text-zinc-400 text-sm mb-6">마이페이지에서 내가 시청한 인원과 총 시청 시간 통계를 확인하려면 로그인해주세요.</p>
        <button onclick="openLoginModal()" class="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer">
          로그인하기
        </button>
      </div>
    `;
    return;
  }

  // 로딩 상태 스켈레톤 UI
  container.innerHTML = `
    <div class="max-w-7xl mx-auto py-6 animate-pulse space-y-6">
      <div class="h-24 bg-zinc-900/60 rounded-3xl border border-zinc-800"></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="h-28 bg-zinc-900 rounded-2xl border border-zinc-800"></div>
        <div class="h-28 bg-zinc-900 rounded-2xl border border-zinc-800"></div>
        <div class="h-28 bg-zinc-900 rounded-2xl border border-zinc-800"></div>
        <div class="h-28 bg-zinc-900 rounded-2xl border border-zinc-800"></div>
      </div>
      <div class="h-64 bg-zinc-900/40 rounded-3xl border border-zinc-800"></div>
    </div>
  `;

  // 서버로부터 실시간 집계된 마이페이지 데이터 요청 (실패 시 로컬 시청 기록으로 자동 fallback)
  let summary = await apiGetMyPageSummary();
  if (!summary && typeof buildLocalMyPageSummary === "function") {
    summary = buildLocalMyPageSummary();
  }
  if (!summary) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto py-20 px-4 text-center">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mb-4">⚠️</div>
        <h2 class="text-xl font-bold text-white mb-2">시청 기록을 불러오지 못했습니다</h2>
        <p class="text-zinc-400 text-sm mb-6">서버와 통신 중 문제가 발생했습니다. 백엔드 서버 상태를 확인해주세요.</p>
        <button onclick="renderMyPage(document.getElementById('main-content'))" class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold cursor-pointer">
          다시 시도
        </button>
      </div>
    `;
    return;
  }

  // 각 멤버별 재생 시간 및 총합 자가 복구 (DB에 0초로 저장되어 있었거나 미계산된 경우 KONGBAP_DATA 기반 실시간 복구)
  let grandTotalSeconds = 0;
  let grandTotalVideos = 0;

  (summary.members || []).forEach(item => {
    let originalMember = null;
    for (const c of (KONGBAP_DATA.categories || [])) {
      if (c.hasSubgroups) {
        for (const g of (c.groups || [])) {
          const found = (g.members || []).find(m => String(m.id) === String(item.streamerId) || String(m.customId) === String(item.streamerId));
          if (found) { originalMember = found; break; }
        }
      } else {
        const found = (c.members || []).find(m => String(m.id) === String(item.streamerId) || String(m.customId) === String(item.streamerId));
        if (found) { originalMember = found; break; }
      }
      if (originalMember) break;
    }

    if (originalMember && typeof getMemberVideoSummary === "function") {
      const sum = getMemberVideoSummary(originalMember);
      let calcSeconds = 0;
      let calcVideos = 0;
      (item.watchedSections || []).forEach(sec => {
        if (sec === "clip") {
          calcSeconds += (sum.clipTotalSeconds || 0);
          calcVideos += (sum.clipCount || 0);
        } else if (sec === "full") {
          calcSeconds += (sum.fullTotalSeconds || 0);
          calcVideos += (sum.fullCount || 0);
        } else if (sec === "binge") {
          calcSeconds += (sum.bingeTotalSeconds || 0);
          calcVideos += (sum.bingeCount || 0);
        }
      });

      if (calcSeconds > 0 && (!item.totalSeconds || item.totalSeconds <= 0)) {
        item.totalSeconds = calcSeconds;
      }
      if (calcVideos > 0 && (!item.totalVideos || item.totalVideos <= 0)) {
        item.totalVideos = calcVideos;
      }
      if (item.totalSeconds > 0) {
        item.durationFormatted = typeof formatSecondsToHangul === "function"
          ? formatSecondsToHangul(item.totalSeconds)
          : `${Math.round(item.totalSeconds / 60)}분`;
      }
    }

    grandTotalSeconds += (item.totalSeconds || 0);
    grandTotalVideos += (item.totalVideos || 0);
  });

  // KPI 총 시청 시간 합계 복구
  if (grandTotalSeconds > 0 && (!summary.totalWatchedSeconds || summary.totalWatchedSeconds <= 0)) {
    summary.totalWatchedSeconds = grandTotalSeconds;
    summary.totalWatchedHours = Math.round((grandTotalSeconds / 3600.0) * 10.0) / 10.0;
    summary.totalWatchedDurationFormatted = typeof formatSecondsToHangul === "function"
      ? formatSecondsToHangul(grandTotalSeconds)
      : `${Math.round(grandTotalSeconds / 3600)}시간`;
    summary.totalWatchedVideos = grandTotalVideos;
  } else if (summary.totalWatchedSeconds > 0 && (!summary.totalWatchedDurationFormatted || summary.totalWatchedDurationFormatted === "0시간 0분" || summary.totalWatchedDurationFormatted === "0분")) {
    summary.totalWatchedDurationFormatted = typeof formatSecondsToHangul === "function"
      ? formatSecondsToHangul(summary.totalWatchedSeconds)
      : `${Math.round(summary.totalWatchedSeconds / 3600)}시간`;
  }

  const username = summary.username || (state.currentUser && state.currentUser.username) || "사용자";
  const members = summary.members || [];

  // 카테고리 필터링
  const filteredMembers = currentMyPageCategoryFilter === "all"
    ? members
    : members.filter(m => m.category === currentMyPageCategoryFilter);

  // 카테고리 맵 인덱싱
  const catMap = new Map();
  (KONGBAP_DATA.categories || []).forEach(c => catMap.set(c.id, c));

  // 필터용 유효 카테고리 추출
  const availableCats = Array.from(new Set(members.map(m => m.category).filter(Boolean)));

  container.innerHTML = `
    <div class="max-w-7xl mx-auto py-4 sm:py-6 space-y-6 sm:space-y-8 animate-fade-in">
      <!-- 상단 마이페이지 배너 -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-5 sm:p-7 rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-1.5">
            <span class="hover:text-zinc-200 cursor-pointer" onclick="selectCategory('police')">홈</span>
            <span>&gt;</span>
            <span class="text-red-400">마이페이지</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xl font-black shadow-inner">
              👤
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>${escapeHtml(username)}님의 시청 기록실</span>
                <span class="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${typeof isServerConnected !== 'undefined' && isServerConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">
                  ${typeof isServerConnected !== 'undefined' && isServerConnected ? '실시간 DB 집계' : '배포 동기화 데이터'}
                </span>
              </h1>
              <p class="text-xs sm:text-sm text-zinc-400 mt-0.5">내가 시청 완료로 체크한 인원들과 총 시청 시간 통계입니다.</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0 relative z-10">
          <button onclick="selectCategory('police')" class="px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs sm:text-sm font-semibold border border-zinc-700 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            <span>전체 아카이브로 돌아가기</span>
          </button>
        </div>
      </div>

      <!-- KPI 통계 카드 4종 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <!-- 1. 총 시청 시간 -->
        <div class="bg-zinc-950/80 border border-amber-500/30 ring-1 ring-amber-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <span>⏱️</span>
              <span>총 시청 시간</span>
            </span>
            <span class="text-[10px] sm:text-xs font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-800">
              약 ${(summary.totalWatchedHours || 0).toLocaleString()}시간
            </span>
          </div>
          <div class="text-xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight mt-1">
            ${summary.totalWatchedDurationFormatted || "0시간 0분"}
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-400 mt-1.5">
            체크된 모든 영상 탭의 총 재생 시간
          </div>
        </div>

        <!-- 2. 시청한 인원 수 -->
        <div class="bg-zinc-950/80 border border-emerald-500/30 ring-1 ring-emerald-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5">
              <span>👥</span>
              <span>시청 인원</span>
            </span>
            <span class="text-[10px] sm:text-xs text-zinc-400 bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-800">
              스트리머
            </span>
          </div>
          <div class="text-xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            ${(summary.totalWatchedMembers || 0).toLocaleString()}<span class="text-xs sm:text-sm text-zinc-300 ml-1 font-bold">명</span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-400 mt-1.5">
            시청 완료한 콩밥특별시 주민
          </div>
        </div>

        <!-- 3. 완료한 영상 탭 수 -->
        <div class="bg-zinc-950/80 border border-indigo-500/30 ring-1 ring-indigo-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-bold text-indigo-300 flex items-center gap-1.5">
              <span>🎬</span>
              <span>완료한 영상 탭</span>
            </span>
            <span class="text-[10px] sm:text-xs text-zinc-400 bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-800">
              섹션별 완료
            </span>
          </div>
          <div class="text-xl sm:text-3xl font-black text-indigo-400 font-mono tracking-tight mt-1">
            ${(summary.totalWatchedSections || 0).toLocaleString()}<span class="text-xs sm:text-sm text-zinc-300 ml-1 font-bold">개 탭</span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-400 mt-1.5">
            완료 체크한 섹션 총 개수
          </div>
        </div>

        <!-- 4. 총 시청 영상 수 -->
        <div class="bg-zinc-950/80 border border-purple-500/30 ring-1 ring-purple-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-bold text-purple-300 flex items-center gap-1.5">
              <span>📼</span>
              <span>총 시청 영상</span>
            </span>
            <span class="text-[10px] sm:text-xs text-zinc-400 bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-800">
              영상 수
            </span>
          </div>
          <div class="text-xl sm:text-3xl font-black text-purple-400 font-mono tracking-tight mt-1">
            ${(summary.totalWatchedVideos || 0).toLocaleString()}<span class="text-xs sm:text-sm text-zinc-300 ml-1 font-bold">개</span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-400 mt-1.5">
            시청 완료 섹션에 포함된 영상
          </div>
        </div>
      </div>

      <!-- 본 인원 목록 헤더 & 필터 바 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div class="flex items-center gap-2">
          <h2 class="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <span>📺 시청 완료 인원 목록</span>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              ${filteredMembers.length}명
            </span>
          </h2>
        </div>

        <!-- 카테고리 필터 버튼들 -->
        ${members.length > 0 ? `
          <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button 
              onclick="currentMyPageCategoryFilter = 'all'; renderMyPage(document.getElementById('main-content'));" 
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${currentMyPageCategoryFilter === 'all' ? 'bg-red-600 text-white shadow-md shadow-red-600/30' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}"
            >
              전체 (${members.length})
            </button>
            ${availableCats.map(catId => {
              const c = catMap.get(catId);
              const catName = c ? `${c.emoji || ''} ${c.name}` : catId;
              const count = members.filter(m => m.category === catId).length;
              const isSelected = currentMyPageCategoryFilter === catId;
              return `
                <button 
                  onclick="currentMyPageCategoryFilter = '${catId}'; renderMyPage(document.getElementById('main-content'));" 
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-600/30' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}"
                >
                  ${catName} (${count})
                </button>
              `;
            }).join("")}
          </div>
        ` : ''}
      </div>

      <!-- 시청 인원 그리드 또는 빈 상태 -->
      ${members.length === 0 ? `
        <div class="py-20 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800/80 p-6">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-zinc-800 flex items-center justify-center text-3xl mb-4 shadow">
            📺
          </div>
          <h3 class="text-lg sm:text-xl font-bold text-white mb-2">아직 시청 완료한 영상이 없습니다.</h3>
          <p class="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            각 인원의 영상 화면에서 <span class="text-emerald-400 font-bold">[편집영상 시청완료 체크]</span>, <span class="text-indigo-400 font-bold">[풀영상 시청완료 체크]</span> 버튼을 눌러 시청 완료 기록을 남겨보세요!
          </p>
          <button onclick="selectCategory('police')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-600/25 transition-all cursor-pointer">
            스트리머 영상 보러가기
          </button>
        </div>
      ` : (filteredMembers.length === 0 ? `
        <div class="py-16 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800/80 p-6">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-zinc-800 flex items-center justify-center text-2xl mb-3">🔍</div>
          <h3 class="text-base font-bold text-zinc-300">선택한 카테고리에 시청 완료한 인원이 없습니다.</h3>
          <button onclick="currentMyPageCategoryFilter = 'all'; renderMyPage(document.getElementById('main-content'));" class="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer">
            전체 목록 보기
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          ${filteredMembers.map(item => {
            let originalMember = null;
            for (const c of (KONGBAP_DATA.categories || [])) {
              if (c.hasSubgroups) {
                for (const g of (c.groups || [])) {
                  const found = (g.members || []).find(m => String(m.id) === String(item.streamerId) || String(m.customId) === String(item.streamerId));
                  if (found) { originalMember = found; break; }
                }
              } else {
                const found = (c.members || []).find(m => String(m.id) === String(item.streamerId) || String(m.customId) === String(item.streamerId));
                if (found) { originalMember = found; break; }
              }
              if (originalMember) break;
            }

            const avatarUrl = originalMember ? getMemberAvatar(originalMember) : DEFAULT_AVATAR;
            const streamerName = (originalMember && originalMember.streamer) ? originalMember.streamer : item.streamerName;
            const charName = (originalMember && originalMember.name) ? originalMember.name : item.streamerName;
            const cat = catMap.get(item.category);
            const catLabel = cat ? `${cat.emoji || ''} ${cat.name}` : (item.category || "기타");

            const hasClip = (item.watchedSections || []).includes("clip");
            const hasFull = (item.watchedSections || []).includes("full");
            const hasBinge = (item.watchedSections || []).includes("binge");

            return `
              <div class="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col justify-between transition-all group">
                <div>
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-zinc-950 border border-zinc-700/60 overflow-hidden flex-shrink-0 shadow">
                        <img 
                          src="${avatarUrl}" 
                          alt="${escapeHtml(charName)}" 
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          decoding="async"
                          referrerpolicy="no-referrer"
                          onerror="this.src='${DEFAULT_AVATAR}'"
                        />
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-base sm:text-lg font-black text-white truncate flex items-center gap-1.5">
                          <span>${escapeHtml(charName)}</span>
                        </h3>
                        <p class="text-xs text-zinc-400 truncate mt-0.5">${escapeHtml(streamerName)}</p>
                      </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-300 text-[11px] sm:text-xs font-bold flex-shrink-0">
                      ${catLabel}
                    </span>
                  </div>

                  <div class="mb-4">
                    <div class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">시청 완료 항목</div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${hasClip ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold shadow-sm">
                          <span>🎬</span>
                          <span>편집 영상 완료</span>
                        </span>
                      ` : ''}
                      ${hasFull ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold shadow-sm">
                          <span>📹</span>
                          <span>풀 영상 완료</span>
                        </span>
                      ` : ''}
                      ${hasBinge ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold shadow-sm">
                          <span>🍿</span>
                          <span>몰아보기 완료</span>
                        </span>
                      ` : ''}
                    </div>
                  </div>

                  <div class="bg-black/40 rounded-xl p-2.5 sm:p-3 border border-zinc-800/80 mb-4 flex items-center justify-between text-xs font-mono">
                    <div class="flex items-center gap-1.5 text-amber-400 font-bold">
                      <span>⏱️</span>
                      <span>${item.durationFormatted || "0분"}</span>
                    </div>
                    <div class="text-zinc-400">
                      총 <span class="text-zinc-200 font-bold">${item.totalVideos || 0}</span>개 영상 시청
                    </div>
                  </div>
                </div>

                <button 
                  onclick="selectMemberById('${sanitizeAttr(item.streamerId)}')"
                  class="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-red-600 text-zinc-200 hover:text-white text-xs sm:text-sm font-bold transition-all border border-zinc-700 hover:border-red-500 shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>영상 목록 바로가기</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>
            `;
          }).join("")}
        </div>
      `)}
    </div>
  `;
}
window.renderMyPage = renderMyPage;

let _lastWasViewingLoveline = false;

function renderContent() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

  renderHeaderAuth();
  renderCategoryTabs();

  const cat = typeof getCurrentCategory === "function" ? getCurrentCategory() : null;
  const currentCatId = cat ? cat.id : state.currentCategory;
  const isViewingLoveline = currentCatId === "loveline" && !state.currentMember && !state.searchQuery && state.currentCategory !== "mypage" && state.currentCategory !== "adminpage";

  if (isViewingLoveline) {
    if (!_lastWasViewingLoveline) {
      if (typeof resetLovelineFilter === "function") {
        resetLovelineFilter();
      } else if (typeof window !== "undefined" && typeof window.resetLovelineFilter === "function") {
        window.resetLovelineFilter();
      }
      _lastWasViewingLoveline = true;
    }
  } else {
    if (_lastWasViewingLoveline) {
      _lastWasViewingLoveline = false;
      if (typeof resetLovelineFilter === "function") {
        resetLovelineFilter();
      } else if (typeof window !== "undefined" && typeof window.resetLovelineFilter === "function") {
        window.resetLovelineFilter();
      }
    }
  }

  if (state.currentCategory === "mypage") {
    renderMyPage(mainContent);
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (state.currentCategory === "adminpage") {
    if (typeof renderAdminPage === "function") {
      renderAdminPage(mainContent);
    }
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (state.searchQuery || state.currentMember || (state.currentCategory !== "stats" && state.currentCategory !== "leaderboard")) {
    if (typeof cleanupLeaderboardListeners === "function") cleanupLeaderboardListeners();
  }

  if (state.searchQuery) {
    renderSearchResults(mainContent);
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (state.currentMember) {
    renderMemberVideos(mainContent);
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (state.currentCategory === "stats" || state.currentCategory === "leaderboard") {
    if (typeof renderLeaderboardPage === "function") {
      renderLeaderboardPage(mainContent);
    }
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (cat && cat.id === "loveline") {
    if (typeof renderLovelineContent === "function") {
      renderLovelineContent(mainContent);
    }
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (!cat.hasSubgroups) {
    renderDirectCategoryMembers(mainContent, cat);
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  if (state.currentGroup) {
    renderGroupMembers(mainContent);
    if (typeof updatePageTitle === "function") updatePageTitle();
    return;
  }

  renderSubgroupList(mainContent, cat);
  if (typeof updatePageTitle === "function") updatePageTitle();
}

function renderEmptyState(emoji, title) {
  return `
    <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
      <div class="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3 text-2xl">
        ${emoji}
      </div>
      <h4 class="text-lg font-bold text-zinc-300">${title}</h4>
    </div>
  `;
}

function renderMemberCard(member, dragType, clickFn, categoryId = null, subgroupId = null, cardIndex = 0) {
  const { ytCount, chzzkCount, totalCount } = (typeof getMemberPlatformVideoCounts === "function")
    ? getMemberPlatformVideoCounts(member)
    : { ytCount: 0, chzzkCount: 0, totalCount: 0 };
  const videoCount = totalCount;
  const isDualRole = Array.isArray(member.affiliations) && member.affiliations.length > 1;
  const admin = isAdmin();
  const cachedSub = typeof getCachedSubscriber === "function" ? getCachedSubscriber(member.id) : null;

  let totalViews = 0;
  if (Array.isArray(member.videos)) {
    for (let i = 0; i < member.videos.length; i++) {
      const v = member.videos[i];
      if (v && v.viewCount != null) {
        const vc = Number(v.viewCount);
        if (!isNaN(vc) && vc > 0) totalViews += vc;
      }
    }
  }

  const viewsFormatted = typeof formatViewCount === "function"
    ? (formatViewCount(totalViews) || `${totalViews.toLocaleString()}회`)
    : `${totalViews.toLocaleString()}회`;

  const viewTextHtml = `<span class="text-zinc-500">·</span><span class="text-zinc-300 font-bold" title="총 조회수: ${totalViews.toLocaleString()}회">${viewsFormatted}</span>`;

  let videoStatHtml = '';
  if (chzzkCount > 0 && ytCount > 0) {
    videoStatHtml = `
      <span>유튜브 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
      <span class="text-zinc-600">·</span>
      <span>치지직 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      ${viewTextHtml}
    `;
  } else if (chzzkCount > 0) {
    videoStatHtml = `
      <span>치지직 영상 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      ${viewTextHtml}
    `;
  } else {
    videoStatHtml = `
      <span>유튜브 영상 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
      ${viewTextHtml}
    `;
  }

  const dragAttrs = admin ? `
      draggable="true"
      data-drag-type="${dragType}"
      data-drag-id="${member.id}"
      ondragstart="handleCardDragStart(event, '${dragType}', '${member.id}')"
      ondragover="handleCardDragOver(event)"
      ondragleave="handleCardDragLeave(event)"
      ondrop="handleCardDrop(event, '${dragType}', '${member.id}')"
      ondragend="handleCardDragEnd(event)"
  ` : `draggable="false"`;
  const curCat = categoryId || (state && state.currentCategory) || member.category;
  const curGrp = (subgroupId !== undefined && subgroupId !== null) ? subgroupId : (state && state.currentGroup ? state.currentGroup.id : member.subgroup);
  const info = getMemberAffiliationInfo(member, curCat, curGrp);
  const effectiveRole = info.role;
  const effectiveSwatRole = info.swatRole;
  const resigned = info.isResigned;
  const retired = info.isRetired;
  const martyred = info.isMartyred;
  const inactive = info.isInactive;
  const avatarFilterClass = inactive 
    ? "grayscale contrast-125 opacity-70 group-hover:grayscale-0 group-hover:contrast-100 group-hover:opacity-100" 
    : "";
  const cardBorderClass = inactive ? "border-zinc-800/40 opacity-85 hover:opacity-100 hover:border-zinc-700" : "border-zinc-800/80 hover:border-zinc-700";
  const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";

  const mId = typeof sanitizeAttr === 'function' ? sanitizeAttr(member.id) : member.id;
  const mName = typeof escapeHtml === 'function' ? escapeHtml(member.name) : member.name;
  const mStreamer = typeof escapeHtml === 'function' ? escapeHtml(member.streamer) : member.streamer;
  const safeRole = typeof escapeHtml === 'function' ? escapeHtml(effectiveRole) : effectiveRole;
  const safeSubCount = typeof escapeHtml === 'function' ? escapeHtml(member.subscriberCount) : member.subscriberCount;

  const isAboveTheFold = cardIndex < 6;
  const avatarLoading = isAboveTheFold ? 'loading="eager"' : 'loading="lazy"';
  const avatarPriority = cardIndex < 2 ? 'fetchpriority="high"' : '';

  return `
    <div 
      id="member-card-${mId}"
      data-member-id="${mId}"
      ${dragAttrs}
      onclick="${clickFn}('${mId}')"
      class="group member-card-interactive bg-zinc-900/80 border ${cardBorderClass} rounded-2xl p-4 sm:p-5 ${cursorClass} shadow-lg hover:shadow-2xl flex flex-col justify-between select-none"
    >
      <div>
        <div class="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div class="relative flex-shrink-0">
            <img 
              src="${getMemberAvatar(member)}" 
              alt="${mName}" 
              draggable="false" 
              ${avatarLoading}
              ${avatarPriority}
              decoding="async"
              referrerpolicy="no-referrer"
              onerror="this.onerror=null; this.src='assets/default-avatar.svg'"
              class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 ${inactive ? 'border-zinc-700/60 group-hover:border-amber-400' : 'border-zinc-700 group-hover:border-amber-400'} ${avatarFilterClass} transition-all duration-300 shadow-md"
            />
            ${effectiveSwatRole ? getSwatBadgeHtml(effectiveSwatRole, 'md') : ''}
            ${martyred ? `
              <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-red-400 border border-red-800/90 shadow ring-1 ring-red-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="순직">
                <span>순직</span>
              </span>
            ` : (retired ? `
              <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow ring-1 ring-zinc-700/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="면직">
                <span>면직</span>
              </span>
            ` : (resigned ? `
              <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow ring-1 ring-amber-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="사직">
                <span>사직</span>
              </span>
            ` : ''))}
            ${(!isRoleBadgeHidden(safeRole) && safeRole) ? `<span class="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${getMemberRoleBadgeClass(member, curCat, curGrp)} shadow">${safeRole}</span>` : ''}
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 flex-wrap">
                <h4 class="text-lg sm:text-xl font-bold text-white group-hover:text-amber-400 transition-colors truncate" title="${mStreamer}">
                  ${mStreamer}
                </h4>
                ${member.subscriberCount ? (
                  isMemberChzzk(member) ? `
                    <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/40 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="치지직 채널 팔로워 수">
                      <svg class="w-3 h-3 text-[#00ffa3] fill-current" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
                      <span>${safeSubCount}</span>
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-300 bg-red-950/80 border border-red-700/50 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="유튜브 채널 구독자 수">
                      <svg class="w-3 h-3 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      <span>${safeSubCount}</span>
                    </span>
                  `
                ) : ''}
              </div>
              ${isAdmin() ? `
                <div class="flex items-center gap-1.5 ml-2 flex-shrink-0 card-header-actions" onclick="event.stopPropagation()">
                  <button onclick="openMemberModal('edit', '${mId}')" title="수정" class="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer flex-shrink-0">✏️</button>
                  <button onclick="deleteMember('${mId}')" title="삭제" class="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white text-xs border border-red-800/40 cursor-pointer flex-shrink-0">🗑️</button>
                </div>
              ` : ''}
            </div>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <p class="text-sm font-medium text-amber-400/90 flex items-center gap-1.5" title="RP 캐릭터: ${mName}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>${mName}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-3 sm:pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2 flex-wrap">
        <div class="font-medium text-zinc-300 flex items-center gap-1.5 flex-wrap">
          ${videoStatHtml}
        </div>
        <span class="inline-flex items-center gap-1 text-amber-400 group-hover:translate-x-0.5 transition-transform font-semibold flex-shrink-0 text-[11px] sm:text-xs">
          영상 목록 보기 →
        </span>
      </div>
    </div>
  `;
}

const _groupVideoStatsCache = new Map();
const _groupSubBadgesCache = new Map();

function clearRenderStatsCache() {
  _groupVideoStatsCache.clear();
  _groupSubBadgesCache.clear();
}
window.clearRenderStatsCache = clearRenderStatsCache;

function renderGroupVideoStats(members) {
  const rawMemberList = members || [];
  if (rawMemberList.length === 0) return "";

  const cacheKey = rawMemberList.length > 3
    ? `${rawMemberList.length}_${rawMemberList[0]?.id || ''}_${rawMemberList[rawMemberList.length - 1]?.id || ''}`
    : rawMemberList.map(m => m.id).join(',');

  const cached = _groupVideoStatsCache.get(cacheKey);
  if (cached) return cached;

  const memberList = [];
  const seenKeys = new Set();

  for (let i = 0; i < rawMemberList.length; i++) {
    const m = rawMemberList[i];
    if (!m) continue;
    const idKey = m.id ? `id:${m.id}` : null;
    const urlKey = (m.youtubeUrl && typeof m.youtubeUrl === 'string' && m.youtubeUrl.trim())
      ? `url:${m.youtubeUrl.trim().toLowerCase().replace(/\/+$/, '')}`
      : null;
    const streamerKey = (m.streamer && typeof m.streamer === 'string' && m.streamer.trim())
      ? `s:${m.streamer.trim().toLowerCase()}`
      : null;
    const fallbackKey = m.name ? `name:${m.name.trim().toLowerCase()}` : null;

    if ((idKey && seenKeys.has(idKey)) || 
        (urlKey && seenKeys.has(urlKey)) || 
        (streamerKey && seenKeys.has(streamerKey))) {
      continue;
    }

    if (idKey) seenKeys.add(idKey);
    if (urlKey) seenKeys.add(urlKey);
    if (streamerKey) seenKeys.add(streamerKey);
    if (fallbackKey) seenKeys.add(fallbackKey);

    memberList.push(m);
  }

  let clipCount = 0;
  let fullCount = 0;
  let bingeCount = 0;
  let totalVideoCount = 0;
  let clipSec = 0;
  let fullSec = 0;
  let bingeSec = 0;
  let clipViews = 0;
  let fullViews = 0;
  let bingeViews = 0;
  let totalViews = 0;
  const seenVideoUrls = new Set();

  for (let i = 0; i < memberList.length; i++) {
    const vList = memberList[i]?.videos;
    if (!Array.isArray(vList)) continue;
    for (let j = 0; j < vList.length; j++) {
      const v = vList[j];
      if (!v || !v.url || v.url === "undefined" || !v.url.trim()) continue;
      const vKey = (v.url || v.id || '').trim().toLowerCase();
      if (vKey && seenVideoUrls.has(vKey)) continue;
      if (vKey) seenVideoUrls.add(vKey);

      totalVideoCount++;
      const type = getVideoType(v);
      const sec = typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0;
      const views = (v.viewCount != null && !isNaN(v.viewCount)) ? Number(v.viewCount) : 0;
      totalViews += views;

      if (type === 'binge') {
        bingeCount++;
        bingeSec += sec;
        bingeViews += views;
      } else if (type === 'full') {
        fullCount++;
        fullSec += sec;
        fullViews += views;
      } else {
        clipCount++;
        clipSec += sec;
        clipViews += views;
      }
    }
  }

  const totalSec = clipSec + fullSec + bingeSec;
  const clipDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipSec) : "0분";
  const fullDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullSec) : "0분";
  const bingeDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeSec) : "0분";
  const totalDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분";
  const formattedTotalViews = typeof formatViewCount === "function" ? (formatViewCount(totalViews) || "0회") : `${totalViews.toLocaleString()}회`;
  const formattedClipViews = typeof formatViewCount === "function" ? (formatViewCount(clipViews) || "0회") : `${clipViews.toLocaleString()}회`;
  const formattedFullViews = typeof formatViewCount === "function" ? (formatViewCount(fullViews) || "0회") : `${fullViews.toLocaleString()}회`;
  const formattedBingeViews = typeof formatViewCount === "function" ? (formatViewCount(bingeViews) || "0회") : `${bingeViews.toLocaleString()}회`;

  const resultHtml = `
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-1.5 sm:p-2.5 flex items-center gap-1 sm:gap-2 flex-nowrap max-w-full overflow-x-auto no-scrollbar flex-shrink-0 shadow-xl select-none">
      <!-- 편집 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
          <span>편집 영상</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-red-400 tracking-tight leading-snug my-0.5">${clipDur}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${clipCount}개</p>
      </div>

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 풀 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50"></span>
          <span>풀 영상</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-indigo-400 tracking-tight leading-snug my-0.5">${fullDur}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${fullCount}개</p>
      </div>

      ${bingeCount > 0 ? `
        <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>
        <!-- 몰아보기 -->
        <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
          <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
            <span>몰아보기</span>
          </p>
          <p class="text-xs sm:text-[15px] font-bold text-amber-400 tracking-tight leading-snug my-0.5">${bingeDur}</p>
          <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${bingeCount}개</p>
        </div>
      ` : ''}

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 총 조회수 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1" title="해당 탭 내 누적 총 조회수: ${totalViews.toLocaleString()}회">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
          <span>총 조회수</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-emerald-400 tracking-tight leading-snug my-0.5">${formattedTotalViews}</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">누적 시청</p>
      </div>

      <div class="w-px h-7 sm:h-8 bg-zinc-800 self-center"></div>

      <!-- 소속 인원 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[66px] sm:min-w-[84px] px-1.5 sm:px-2.5 py-1">
        <p class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-center gap-1 sm:gap-1.5 font-medium mb-0.5 sm:mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shadow-sm shadow-zinc-400/50"></span>
          <span>소속 인원</span>
        </p>
        <p class="text-xs sm:text-[15px] font-bold text-white tracking-tight leading-snug my-0.5">${memberList.length}명</p>
        <p class="text-[11px] sm:text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">전체 멤버</p>
      </div>
    </div>
  `;

  if (_groupVideoStatsCache.size < 500) {
    _groupVideoStatsCache.set(cacheKey, resultHtml);
  }
  return resultHtml;
}

function renderGroupSubscriberBadgesHtml(members, titleContext = "") {
  if (typeof calculateGroupPlatformSubscribers !== "function") return "";
  const rawMemberList = members || [];
  if (rawMemberList.length === 0) return "";

  const cacheKey = `${titleContext}_${rawMemberList.length > 3 ? `${rawMemberList.length}_${rawMemberList[0]?.id || ''}_${rawMemberList[rawMemberList.length - 1]?.id || ''}` : rawMemberList.map(m => m.id).join(',')}`;
  const cached = _groupSubBadgesCache.get(cacheKey);
  if (cached) return cached;

  const stats = calculateGroupPlatformSubscribers(members);
  const badges = [];

  if (stats.ytStr) {
    badges.push(`
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-700/50 text-red-300 text-xs sm:text-sm font-bold shadow-md shadow-red-950/30 flex-shrink-0" title="${titleContext} 소속 인원 유튜브 총 구독자: ${stats.ytStr}">
        <svg class="w-3.5 h-3.5 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>구독자 ${stats.ytStr}</span>
      </span>
    `);
  }

  if (stats.chzzkStr) {
    badges.push(`
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#00ffa3]/10 border border-[#00ffa3]/40 text-[#00ffa3] text-xs sm:text-sm font-bold shadow-md shadow-[#00ffa3]/10 flex-shrink-0" title="${titleContext} 소속 인원 치지직 총 팔로워: ${stats.chzzkStr}">
        <svg class="w-3.5 h-3.5 text-[#00ffa3] fill-current flex-shrink-0" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
        <span>팔로워 ${stats.chzzkStr}</span>
      </span>
    `);
  }

  const resultHtml = badges.join("");
  if (_groupSubBadgesCache.size < 500) {
    _groupSubBadgesCache.set(cacheKey, resultHtml);
  }
  return resultHtml;
}

function renderDirectCategoryMembers(container, cat) {
  const members = cat.members || [];
  const membersHtml = members.length > 0
    ? members.map((m, idx) => renderMemberCard(m, 'direct-member', 'selectDirectMember', cat.id, null, idx)).join("")
    : renderEmptyState(cat.emoji || '👥', "등록된 인원이 없습니다.");

  const subscriberBadgesHtml = renderGroupSubscriberBadgesHtml(members, cat.name);

  container.innerHTML = `
    <div class="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 flex-shrink-0">${cat.badge}</span>
          <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-shrink-0">
            <span>${cat.emoji || ''}</span>
            <span>${cat.name} 인원 목록</span>
          </h2>
          ${subscriberBadgesHtml}
          ${isAdmin() ? `
            <button onclick="openMemberModal('add', null, '${cat.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>인원 추가</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${renderGroupVideoStats(members)}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${membersHtml}
    </div>
  `;
}

function renderSubgroupList(container, cat) {
  const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
  const admin = isAdmin();
  const allMembers = getCategoryMembers(cat);
  const subscriberBadgesHtml = renderGroupSubscriberBadgesHtml(allMembers, cat.name);

  const cardsHtml = cat.groups.map(group => {
    let totalVideos = 0;
    let groupViews = 0;
    (group.members || []).forEach(m => {
      (m.videos || []).forEach(v => {
        if (v && v.url && v.url !== "undefined" && v.url.trim()) {
          totalVideos++;
          if (v.viewCount != null && !isNaN(v.viewCount)) {
            groupViews += Number(v.viewCount);
          }
        }
      });
    });
    const formattedGroupViews = typeof formatViewCount === "function" ? formatViewCount(groupViews) : null;
    const safeGroupId = typeof sanitizeAttr === 'function' ? sanitizeAttr(group.id) : group.id;
    const safeGroupName = typeof escapeHtml === 'function' ? escapeHtml(group.name) : group.name;
    const dragAttrs = admin ? `
        draggable="true"
        data-drag-type="group"
        data-drag-id="${safeGroupId}"
        ondragstart="handleCardDragStart(event, 'group', '${safeGroupId}')"
        ondragover="handleCardDragOver(event)"
        ondragleave="handleCardDragLeave(event)"
        ondrop="handleCardDrop(event, 'group', '${safeGroupId}')"
        ondragend="handleCardDragEnd(event)"
    ` : `draggable="false"`;
    const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";
    const rawBgImage = typeof getGroupBgImage === "function" ? getGroupBgImage(group) : (group.bgImage || (group.id === "gang-bigdick" || group.name === "빅딕" ? "assets/빅딕.webp" : null));
    const bgImage = rawBgImage ? (typeof sanitizeUrl === 'function' ? sanitizeUrl(rawBgImage) : rawBgImage) : null;

    if (bgImage && bgImage !== '#') {
      return `
        <div 
          ${dragAttrs}
          onclick="selectGroup('${safeGroupId}')"
          class="group member-card-interactive relative overflow-hidden bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 sm:p-5 ${cursorClass} shadow-xl ${theme.glow} select-none min-h-[140px] flex flex-col justify-between"
        >
          <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div 
              class="w-full h-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110 opacity-40"
              style="background-image: url('${bgImage}');"
            ></div>
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/40"></div>
          </div>

          <div class="relative z-10 flex items-center justify-between gap-2 mb-4">
            <h3 class="text-xl sm:text-2xl font-black text-white group-hover:text-amber-400 transition-colors flex items-center gap-2 truncate min-w-0 flex-1 drop-shadow-md" title="${safeGroupName}">
              <span class="flex-shrink-0">${group.emoji || ''}</span>
              <span class="truncate">${safeGroupName}</span>
            </h3>
            <div class="w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-all flex-shrink-0 shadow">
              ${SVG_ICONS.chevronRight}
            </div>
          </div>

          <div class="relative z-10 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2 flex-wrap">
            <span class="font-medium text-zinc-300">
              소속 인원 <strong class="text-white font-bold">${group.members.length}</strong>명
            </span>
            <span class="flex items-center gap-1.5 text-red-400 font-semibold bg-black/60 px-2 py-0.5 rounded-lg border border-white/5 shadow-inner flex-wrap">
              ${SVG_ICONS.youtube}
              <span>영상 ${totalVideos}개</span>
              ${formattedGroupViews ? `<span class="text-zinc-500">·</span><span class="text-zinc-300 font-bold">${formattedGroupViews}</span>` : ''}
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div 
        ${dragAttrs}
        onclick="selectGroup('${safeGroupId}')"
        class="group member-card-interactive relative bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 sm:p-5 ${cursorClass} shadow-xl ${theme.glow} select-none"
      >
        <div class="flex items-center justify-between gap-2 mb-4">
          <h3 class="text-xl sm:text-2xl font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2 truncate min-w-0 flex-1" title="${safeGroupName}">
            <span class="flex-shrink-0">${group.emoji || ''}</span>
            <span class="truncate">${safeGroupName}</span>
          </h3>
          <div class="w-8 h-8 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:bg-amber-500 group-hover:text-black transition-all flex-shrink-0">
            ${SVG_ICONS.chevronRight}
          </div>
        </div>

        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2 flex-wrap">
          <span class="font-medium text-zinc-300">
            소속 인원 <strong class="text-white font-bold">${group.members.length}</strong>명
          </span>
          <span class="flex items-center gap-1.5 text-red-400 font-semibold flex-wrap">
            ${SVG_ICONS.youtube}
            <span>영상 ${totalVideos}개</span>
            ${formattedGroupViews ? `<span class="text-zinc-500">·</span><span class="text-zinc-300 font-bold">${formattedGroupViews}</span>` : ''}
          </span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 flex-shrink-0">${cat.badge}</span>
          <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-shrink-0">
            <span>${cat.emoji || ''}</span>
            <span>${cat.name} 목록 (${cat.groups.length}개)</span>
          </h2>
          ${subscriberBadgesHtml}
        </div>
      </div>

      ${renderGroupVideoStats(allMembers)}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${cardsHtml}
    </div>
  `;
}

function renderGroupMembers(container) {
  const cat = getCurrentCategory();
  const group = state.currentGroup;
  const members = group.members || [];
  const bgImage = typeof getGroupBgImage === "function" ? getGroupBgImage(group) : (group.bgImage || (group.id === "gang-bigdick" || group.name === "빅딕" ? "assets/빅딕.webp" : null));
  const membersHtml = members.length > 0
    ? members.map((m, idx) => renderMemberCard(m, 'group-member', 'selectGroupMember', cat.id, group.id, idx)).join("")
    : renderEmptyState(group.emoji || '👥', "등록된 인원이 없습니다.");

  const subscriberBadgesHtml = renderGroupSubscriberBadgesHtml(members, group.name);

  container.innerHTML = `
    <div class="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div class="min-w-0">
        <button onclick="resetToCategory('${cat.id}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-3 cursor-pointer">
          ${SVG_ICONS.back}
          <span>${cat.name} 목록으로 돌아가기</span>
        </button>
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          ${(bgImage && sanitizeUrl(bgImage) !== '#') ? `<img src="${sanitizeUrl(bgImage)}" alt="${escapeHtml(group.name)}" loading="lazy" decoding="async" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-500/20 flex-shrink-0" />` : ''}
          <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-shrink-0">
            <span>${group.emoji || ''}</span>
            <span>${escapeHtml(group.name)}</span>
          </h2>
          ${subscriberBadgesHtml}
          ${isAdmin() ? `
            <button onclick="openMemberModal('add', null, '${cat.id}', '${group.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>인원 추가</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${renderGroupVideoStats(members)}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${membersHtml}
    </div>
  `;
}

// 멤버별 영상 요약 통계(단일 패스 계산 및 레퍼런스 기반 캐싱)
function getMemberVideoSummary(member) {
  if (!member) {
    return {
      clipVideos: [], fullVideos: [], bingeVideos: [],
      clipCount: 0, fullCount: 0, bingeCount: 0,
      clipTotalDuration: "0분", fullTotalDuration: "0분", bingeTotalDuration: "0분",
      clipTotalViews: 0, fullTotalViews: 0, bingeTotalViews: 0, totalViews: 0
    };
  }

  const rawVideos = member.videos || [];
  if (member._videoSummary && member._videoSummaryRef === rawVideos && member._videoSummaryLen === rawVideos.length) {
    return member._videoSummary;
  }

  const clipVideos = [];
  const fullVideos = [];
  const bingeVideos = [];
  let clipTotalSeconds = 0;
  let fullTotalSeconds = 0;
  let bingeTotalSeconds = 0;
  let clipTotalViews = 0;
  let fullTotalViews = 0;
  let bingeTotalViews = 0;

  for (let i = 0; i < rawVideos.length; i++) {
    const v = rawVideos[i];
    if (!v || !v.url || v.url === "undefined" || !v.url.trim()) continue;
    const type = getVideoType(v);
    const sec = typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0;
    const views = (v.viewCount != null && !isNaN(v.viewCount)) ? Number(v.viewCount) : 0;

    if (type === 'binge') {
      bingeVideos.push(v);
      bingeTotalSeconds += sec;
      bingeTotalViews += views;
    } else if (type === 'full') {
      fullVideos.push(v);
      fullTotalSeconds += sec;
      fullTotalViews += views;
    } else {
      clipVideos.push(v);
      clipTotalSeconds += sec;
      clipTotalViews += views;
    }
  }

  const summary = {
    clipVideos,
    fullVideos,
    bingeVideos,
    clipCount: clipVideos.length,
    fullCount: fullVideos.length,
    bingeCount: bingeVideos.length,
    clipTotalSeconds,
    fullTotalSeconds,
    bingeTotalSeconds,
    totalSeconds: clipTotalSeconds + fullTotalSeconds + bingeTotalSeconds,
    clipTotalDuration: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipTotalSeconds) : "0분",
    fullTotalDuration: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullTotalSeconds) : "0분",
    bingeTotalDuration: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeTotalSeconds) : "0분",
    clipTotalViews,
    fullTotalViews,
    bingeTotalViews,
    totalViews: clipTotalViews + fullTotalViews + bingeTotalViews,
  };

  member._videoSummary = summary;
  member._videoSummaryRef = rawVideos;
  member._videoSummaryLen = rawVideos.length;
  return summary;
}

// 상단 요약 통계 탭 버튼 HTML 생성
function renderMemberVideoTabsTopHtml(summary, currentTab, member) {
  const { 
    clipCount, fullCount, bingeCount, 
    clipTotalDuration, fullTotalDuration, bingeTotalDuration,
    clipTotalViews, fullTotalViews, bingeTotalViews 
  } = summary;

  const m = member || state.currentMember;
  const showWatch = isUserLoggedIn() && m;
  const isClipWatched = showWatch && isWatchedSection(m.id, "clip");
  const isFullWatched = showWatch && isWatchedSection(m.id, "full");
  const isBingeWatched = showWatch && isWatchedSection(m.id, "binge");

  const clipViewsFormatted = typeof formatViewCount === "function" ? (formatViewCount(clipTotalViews) || "0회") : `${clipTotalViews.toLocaleString()}회`;
  const fullViewsFormatted = typeof formatViewCount === "function" ? (formatViewCount(fullTotalViews) || "0회") : `${fullTotalViews.toLocaleString()}회`;
  const bingeViewsFormatted = typeof formatViewCount === "function" ? (formatViewCount(bingeTotalViews) || "0회") : `${bingeTotalViews.toLocaleString()}회`;

  return `
    <button onclick="setVideoTab('clip')" title="편집 영상만 보기" class="bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'clip' ? 'border-red-500 ring-2 ring-red-500/30 bg-red-950/20' : 'border-zinc-800'} rounded-xl sm:rounded-2xl p-2.5 sm:px-5 sm:py-3 text-center sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
      <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">🎬 편집 영상</span>
      <span class="text-xl sm:text-3xl font-black text-red-400 my-0.5 block tracking-tight">${clipCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
      <span class="text-[11px] sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${clipTotalDuration}</span>
      <span class="text-[10px] sm:text-xs text-zinc-300 font-semibold font-mono block bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-700/50 mt-1" title="편집 영상 총 조회수: ${clipTotalViews.toLocaleString()}회">
        조회수 ${clipViewsFormatted}
      </span>
      ${showWatch ? `
        <span class="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full ${isClipWatched ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 font-medium'} text-[10px] sm:text-xs mt-1.5 w-full">
          ${isClipWatched ? '✓ 시청 완료' : '미시청'}
        </span>
      ` : ''}
    </button>
    <button onclick="setVideoTab('full')" title="풀 영상만 보기" class="bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'full' ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/20' : 'border-zinc-800'} rounded-xl sm:rounded-2xl p-2.5 sm:px-5 sm:py-3 text-center sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
      <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">📹 풀 영상</span>
      <span class="text-xl sm:text-3xl font-black text-indigo-400 my-0.5 block tracking-tight">${fullCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
      <span class="text-[11px] sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${fullTotalDuration}</span>
      <span class="text-[10px] sm:text-xs text-zinc-300 font-semibold font-mono block bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-700/50 mt-1" title="풀 영상 총 조회수: ${fullTotalViews.toLocaleString()}회">
        조회수 ${fullViewsFormatted}
      </span>
      ${showWatch ? `
        <span class="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full ${isFullWatched ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 font-medium'} text-[10px] sm:text-xs mt-1.5 w-full">
          ${isFullWatched ? '✓ 시청 완료' : '미시청'}
        </span>
      ` : ''}
    </button>
    ${bingeCount > 0 ? `
      <button onclick="setVideoTab('binge')" title="몰아보기 영상만 보기" class="col-span-2 sm:col-span-1 bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'binge' ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-950/20' : 'border-zinc-800'} rounded-xl sm:rounded-2xl p-2.5 sm:px-5 sm:py-3 text-center sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
        <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">🍿 몰아보기</span>
        <span class="text-xl sm:text-3xl font-black text-amber-400 my-0.5 block tracking-tight">${bingeCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
        <span class="text-[11px] sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${bingeTotalDuration}</span>
        <span class="text-[10px] sm:text-xs text-zinc-300 font-semibold font-mono block bg-black/40 px-2 py-0.5 rounded-lg border border-zinc-700/50 mt-1" title="몰아보기 영상 총 조회수: ${bingeTotalViews.toLocaleString()}회">
          조회수 ${bingeViewsFormatted}
        </span>
        ${showWatch ? `
          <span class="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full ${isBingeWatched ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 font-medium'} text-[10px] sm:text-xs mt-1.5 w-full">
            ${isBingeWatched ? '✓ 시청 완료' : '미시청'}
          </span>
        ` : ''}
      </button>
    ` : ''}
  `;
}

// 하단 탭 필터 알약 버튼 HTML 생성
function renderMemberVideoTabsPillsHtml(summary, currentTab, member) {
  const { clipCount, fullCount, bingeCount } = summary;
  const m = member || state.currentMember;
  const showWatch = isUserLoggedIn() && m;
  const isClipWatched = showWatch && isWatchedSection(m.id, "clip");
  const isFullWatched = showWatch && isWatchedSection(m.id, "full");
  const isBingeWatched = showWatch && isWatchedSection(m.id, "binge");

  return `
    <button onclick="setVideoTab('clip')" class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${currentTab === 'clip' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
      <span>🎬 편집 영상</span>
      ${isClipWatched ? '<span class="text-emerald-300 font-black text-xs" title="시청 완료">✓</span>' : ''}
      <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'clip' ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">${clipCount}</span>
    </button>
    <button onclick="setVideoTab('full')" class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${currentTab === 'full' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
      <span>📹 풀 영상</span>
      ${isFullWatched ? '<span class="text-emerald-300 font-black text-xs" title="시청 완료">✓</span>' : ''}
      <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'full' ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">${fullCount}</span>
    </button>
    <button onclick="setVideoTab('binge')" class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${currentTab === 'binge' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
      <span>🍿 몰아보기</span>
      ${isBingeWatched ? '<span class="text-emerald-950 font-black text-xs" title="시청 완료">✓</span>' : ''}
      <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'binge' ? 'bg-black/20 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'}">${bingeCount}</span>
    </button>
  `;
}

// 시청 완료 토글 버튼 HTML 생성
function renderMemberWatchToggleBtnHtml(member, currentTab, summary) {
  if (!isUserLoggedIn() || !member) return "";

  const tab = currentTab || "clip";
  const isWatched = isWatchedSection(member.id, tab);

  const sum = summary || (typeof getMemberVideoSummary === "function" ? getMemberVideoSummary(member) : null);

  let tabLabel = "편집 영상";
  let durationSeconds = (sum && sum.clipTotalSeconds) || 0;
  let videoCount = (sum && sum.clipCount) || 0;

  if (tab === "full") {
    tabLabel = "풀 영상";
    durationSeconds = (sum && sum.fullTotalSeconds) || 0;
    videoCount = (sum && sum.fullCount) || 0;
  } else if (tab === "binge") {
    tabLabel = "몰아보기";
    durationSeconds = (sum && sum.bingeTotalSeconds) || 0;
    videoCount = (sum && sum.bingeCount) || 0;
  }

  // 혹시라도 summary에 초 정보가 없거나 0인 경우 직접 member.videos에서 즉시 계산
  if (durationSeconds <= 0 && Array.isArray(member.videos)) {
    let calcSec = 0;
    let calcCnt = 0;
    member.videos.forEach(v => {
      const vType = typeof getVideoType === "function" ? getVideoType(v) : (v.videoType || "clip");
      if (vType === tab) {
        calcCnt++;
        calcSec += (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0);
      }
    });
    if (calcSec > 0) durationSeconds = calcSec;
    if (calcCnt > 0) videoCount = calcCnt;
  }

  const safeMemberId = sanitizeAttr(member.id);
  const safeMemberName = sanitizeAttr(member.name || member.streamer || "");
  const safeCategory = sanitizeAttr(member.category || "");

  if (isWatched) {
    return `
      <button 
        type="button"
        onclick="toggleWatchSection('${safeMemberId}', '${tab}', '${safeMemberName}', '${safeCategory}', ${durationSeconds}, ${videoCount})"
        class="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-600/25 cursor-pointer flex-shrink-0"
        title="클릭 시 시청 완료가 취소됩니다"
      >
        <svg class="w-4 h-4 text-emerald-100 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
        <span>✓ ${tabLabel} 시청완료</span>
        <span class="text-[10px] text-emerald-200 bg-black/20 px-1.5 py-0.5 rounded-full font-normal">취소</span>
      </button>
    `;
  } else {
    return `
      <button 
        type="button"
        onclick="toggleWatchSection('${safeMemberId}', '${tab}', '${safeMemberName}', '${safeCategory}', ${durationSeconds}, ${videoCount})"
        class="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs sm:text-sm font-semibold border border-zinc-700 hover:border-emerald-500/60 transition-all shadow cursor-pointer group flex-shrink-0"
        title="이 탭의 영상을 모두 시청한 경우 완료로 체크합니다"
      >
        <span class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-zinc-500 group-hover:border-emerald-400 flex items-center justify-center text-[10px] font-bold text-transparent group-hover:text-emerald-400 transition-colors">✓</span>
        <span>${tabLabel} 시청완료 체크</span>
      </button>
    `;
  }
}

// 영상 카드 목록 그리드 HTML 생성 (지연/즉시 로딩 및 썸네일 폴백 최적화)
function renderMemberVideoCardsHtml(displayedVideos, summary, currentTab) {
  const { clipCount, fullCount, bingeCount } = summary;
  const totalValidVideos = clipCount + fullCount + bingeCount;

  if (!displayedVideos || displayedVideos.length === 0) {
    if (totalValidVideos === 0) {
      return renderEmptyState(SVG_ICONS.youtube, "등록된 영상이 없습니다.");
    } else if (currentTab === "clip") {
      return `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">🎬</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 편집 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${fullCount > 0 ? `<button onclick="setVideoTab('full')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"><span>📹 풀 영상 (${fullCount}개) 보러가기</span></button>` : ''}
            ${bingeCount > 0 ? `<button onclick="setVideoTab('binge')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-amber-600/30"><span>🍿 몰아보기 (${bingeCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    } else if (currentTab === "full") {
      return `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">📹</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 풀 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${clipCount > 0 ? `<button onclick="setVideoTab('clip')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-red-600/30"><span>🎬 편집 영상 (${clipCount}개) 보러가기</span></button>` : ''}
            ${bingeCount > 0 ? `<button onclick="setVideoTab('binge')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-amber-600/30"><span>🍿 몰아보기 (${bingeCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">🍿</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 몰아보기 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${clipCount > 0 ? `<button onclick="setVideoTab('clip')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-red-600/30"><span>🎬 편집 영상 (${clipCount}개) 보러가기</span></button>` : ''}
            ${fullCount > 0 ? `<button onclick="setVideoTab('full')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"><span>📹 풀 영상 (${fullCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    }
  }

  const admin = isAdmin();
  return displayedVideos.map((video, vIndex) => {
    const videoNum = vIndex + 1;
    const rawVUrl = (video.url && video.url !== "undefined" && video.url !== "null") ? video.url : (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : "");
    const vUrl = typeof sanitizeUrl === 'function' ? sanitizeUrl(rawVUrl) : rawVUrl;
    const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(vUrl);
    const platformLabel = isChzzk ? '치지직' : '유튜브';

    let rawThumbUrl = "";
    if (video.thumbnailUrl && 
        typeof video.thumbnailUrl === "string" && 
        video.thumbnailUrl !== "null" && 
        video.thumbnailUrl !== "undefined" && 
        video.thumbnailUrl !== "#" && 
        video.thumbnailUrl.trim() !== "" &&
        !video.thumbnailUrl.includes("assets/default-thumbnail.svg")) {
      rawThumbUrl = video.thumbnailUrl;
    } else {
      rawThumbUrl = typeof getYoutubeThumbnail === "function" ? getYoutubeThumbnail(vUrl || rawVUrl || video) : "assets/default-thumbnail.svg";
    }
    let thumbUrl = typeof sanitizeUrl === 'function' ? sanitizeUrl(rawThumbUrl) : rawThumbUrl;
    if (!thumbUrl || thumbUrl === "#") {
      thumbUrl = typeof getYoutubeThumbnail === "function" ? getYoutubeThumbnail(vUrl || rawVUrl || video) : "assets/default-thumbnail.svg";
    }
    if (!thumbUrl || thumbUrl === "#") {
      thumbUrl = "assets/default-thumbnail.svg";
    }
    const safeVidId = typeof sanitizeAttr === 'function' ? sanitizeAttr(video.id) : video.id;
    const safeTitle = typeof escapeHtml === 'function' ? escapeHtml(video.title) : video.title;
    const safeDesc = typeof escapeHtml === 'function' ? escapeHtml(video.description) : video.description;
    const safeDate = typeof escapeHtml === 'function' ? escapeHtml(video.date) : video.date;
    const safeDuration = typeof escapeHtml === 'function' ? escapeHtml(video.duration) : video.duration;
    const formattedViews = typeof formatViewCount === 'function' ? formatViewCount(video.viewCount) : null;
    const viewCountNum = (video.viewCount != null && !isNaN(video.viewCount)) ? Number(video.viewCount) : null;

    const vType = getVideoType(video);
    let typeBadgeClass = 'bg-red-950/90 text-red-300 border-red-700/60';
    let typeBadgeText = '🎬 편집 영상';
    if (vType === 'binge') {
      typeBadgeClass = 'bg-amber-950/90 text-amber-300 border-amber-600/60';
      typeBadgeText = '🍿 몰아보기';
    } else if (vType === 'full') {
      typeBadgeClass = 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60';
      typeBadgeText = '📹 풀 영상';
    }
    const dragAttrs = admin ? `
        draggable="true"
        data-drag-type="video"
        data-drag-id="${safeVidId}"
        ondragstart="handleCardDragStart(event, 'video', '${safeVidId}')"
        ondragover="handleCardDragOver(event)"
        ondragleave="handleCardDragLeave(event)"
        ondrop="handleCardDrop(event, 'video', '${safeVidId}')"
        ondragend="handleCardDragEnd(event)"
    ` : `draggable="false"`;
    const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "";
    const imgLoadingAttr = vIndex < 6 ? 'loading="eager"' : 'loading="lazy"';
    const imgFetchPriorityAttr = vIndex < 2 ? 'fetchpriority="high"' : '';

    return `
      <div 
        ${dragAttrs}
        class="group member-card-interactive bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between ${cursorClass} select-none"
      >
        <div>
          <a 
            href="${vUrl || '#'}" 
            target="_blank" 
            rel="noopener noreferrer" 
            draggable="false" 
            onclick="if (isDraggingCard || !this.getAttribute('href') || this.getAttribute('href') === '#') { event.preventDefault(); return false; }"
            class="relative block aspect-video bg-black overflow-hidden group cursor-pointer"
            title="${platformLabel}에서 영상 보기 (새 탭)"
          >
            <img src="${thumbUrl}" alt="${safeTitle}" draggable="false" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" ${imgLoadingAttr} ${imgFetchPriorityAttr} decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/default-thumbnail.svg'" />
            
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 select-none">
              <div class="${typeBadgeClass} border backdrop-blur-md text-[11px] font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                <span>${typeBadgeText}</span>
              </div>
              ${isChzzk ? `
                <div class="bg-[#00ffa3]/20 border border-[#00ffa3]/60 backdrop-blur-md text-[10px] font-extrabold text-[#00ffa3] px-2 py-0.5 rounded-lg shadow flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                  <svg class="w-2.5 h-2.5 text-[#00ffa3] fill-current" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
                  <span>CHZZK</span>
                </div>
              ` : ''}
            </div>

            <div class="absolute top-2.5 right-2.5 min-w-[28px] h-7 px-2 ${isChzzk ? 'bg-emerald-600 border-emerald-500/80 shadow-[0_2px_12px_rgba(5,150,105,0.5)]' : 'bg-red-600 border-red-500/80 shadow-[0_2px_12px_rgba(220,38,38,0.5)]'} text-white font-black text-sm rounded-xl border flex items-center justify-center select-none font-mono tracking-tighter z-10 group-hover:scale-110 transition-transform duration-200" title="${videoNum}번째 영상">
              <span>${videoNum}</span>
            </div>

            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10">
              <div class="w-14 h-14 rounded-2xl ${isChzzk ? 'bg-[#00ffa3] text-zinc-950' : 'bg-red-600 text-white'} flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform flex-shrink-0">
                <svg class="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
              </div>
              <span class="text-xs font-bold text-white bg-black/80 px-2.5 py-1 rounded-md flex items-center gap-1 whitespace-nowrap select-none">
                <span>${platformLabel}으로 이동</span>
                ${SVG_ICONS.external}
              </span>
            </div>

            <!-- 좌측 하단 메타 정보 (상단: 업로드 날짜, 하단: 조회수) -->
            <div class="absolute bottom-2 left-2 flex flex-col items-start gap-1 z-10 select-none">
              ${video.date ? `
                <div class="bg-black/85 backdrop-blur-sm text-[11px] font-medium text-zinc-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                  <svg class="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <span>${safeDate}</span>
                </div>
              ` : (formattedViews ? '' : `
                <div class="bg-black/85 backdrop-blur-sm text-[11px] font-medium text-zinc-400 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                  <span>날짜 미지정</span>
                </div>
              `)}
              ${formattedViews ? `
                <div class="bg-black/85 backdrop-blur-sm text-[11px] font-medium text-zinc-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm" title="${viewCountNum != null ? viewCountNum.toLocaleString() + '회 시청' : ''}">
                  <svg class="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  <span>${formattedViews}</span>
                </div>
              ` : ''}
            </div>

            <div class="absolute bottom-2 right-2 bg-black/90 backdrop-blur-sm text-[11px] font-bold font-mono text-zinc-100 px-2 py-0.5 rounded-md z-10 shadow-sm flex items-center gap-1 select-none">
              ${video.duration ? `<span>${safeDuration}</span>` : `<span>영상</span>`}
            </div>
          </a>


          <div class="px-4 sm:px-5 pt-4 sm:pt-5 pb-2.5 flex-1 flex flex-col justify-between">
            <div>
              <a 
                href="${vUrl || '#'}" 
                target="_blank" 
                rel="noopener noreferrer" 
                draggable="false" 
                onclick="if (isDraggingCard || !this.getAttribute('href') || this.getAttribute('href') === '#') { event.preventDefault(); return false; }"
                class="block text-sm sm:text-base font-bold text-white ${isChzzk ? 'hover:text-emerald-400' : 'hover:text-red-400'} transition-colors line-clamp-2 leading-snug cursor-pointer ${video.description ? 'mb-2' : ''}"
                title="${safeTitle}"
              >
                ${safeTitle}
              </a>
              ${video.description ? `
                <p class="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  ${safeDesc}
                </p>
              ` : ''}
            </div>
          </div>
        </div>

        ${isAdmin() ? `
          <div class="px-4 sm:px-5 py-2.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between">
            <span class="text-[11px] text-amber-400 font-bold flex items-center gap-1">🛡️ 어드민 관리</span>
            <div class="flex items-center gap-1.5">
              <button onclick="openVideoModal('edit', '${safeVidId}')" class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer">✏️ 수정</button>
              <button onclick="deleteVideo('${safeVidId}')" class="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 text-xs font-semibold border border-red-800/50 transition-colors cursor-pointer">🗑️ 삭제</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

// 탭 전환 시 프로필 헤더 재생성 없이 탭 버튼 및 영상 그리드만 즉시 업데이트(2ms 초고속 전환)
function updateMemberVideoTabContent(member) {
  const summary = getMemberVideoSummary(member);
  const currentTab = state.currentVideoTab === "binge" ? "binge" : (state.currentVideoTab === "full" ? "full" : "clip");
  let displayedVideos = summary.clipVideos;
  if (currentTab === "binge") {
    displayedVideos = summary.bingeVideos;
  } else if (currentTab === "full") {
    displayedVideos = summary.fullVideos;
  }

  const topTabsEl = document.getElementById("member-profile-tabs-top");
  if (topTabsEl) {
    topTabsEl.innerHTML = renderMemberVideoTabsTopHtml(summary, currentTab, member);
  }

  const pillsEl = document.getElementById("member-profile-tabs-pills");
  if (pillsEl) {
    pillsEl.innerHTML = renderMemberVideoTabsPillsHtml(summary, currentTab, member);
  }

  const watchToggleEl = document.getElementById("member-watch-toggle-container");
  if (watchToggleEl) {
    watchToggleEl.innerHTML = renderMemberWatchToggleBtnHtml(member, currentTab, summary);
  }

  const videoGridEl = document.getElementById("member-videos-grid");
  if (videoGridEl) {
    videoGridEl.innerHTML = renderMemberVideoCardsHtml(displayedVideos, summary, currentTab);
  }
}

function renderMemberVideos(container) {
  const member = state.currentMember;
  const group = state.currentGroup;
  const cat = getCurrentCategory();

  const summary = getMemberVideoSummary(member);
  const currentTab = state.currentVideoTab === "binge" ? "binge" : (state.currentVideoTab === "full" ? "full" : "clip");

  let displayedVideos = summary.clipVideos;
  if (currentTab === "binge") {
    displayedVideos = summary.bingeVideos;
  } else if (currentTab === "full") {
    displayedVideos = summary.fullVideos;
  }

  const groupName = group ? group.name : (cat ? cat.name : '');
  const groupEmoji = group ? (group.emoji || '') : (cat ? (cat.emoji || '') : '');
  const catName = cat ? cat.name : '인원';
  const catId = cat ? cat.id : 'police';
  const isFromStats = state.navigationSource === "stats" || state.navigationSource === "leaderboard";
  const isFromLoveline = state.navigationSource === "loveline";
  const backButtonHtml = isFromStats ? `
    <button onclick="goBackFromMember('stats')" class="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-amber-500/40 hover:border-amber-500/70 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer shadow-sm">
      ${SVG_ICONS.back}
      <span>종합통계로 돌아가기</span>
    </button>
  ` : isFromLoveline ? `
    <button onclick="goBackFromMember('loveline')" class="inline-flex items-center gap-1.5 text-xs text-pink-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-pink-500/40 hover:border-pink-500/70 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer shadow-sm">
      ${SVG_ICONS.back}
      <span>러브라인으로 돌아가기</span>
    </button>
  ` : (!cat || !cat.hasSubgroups || !group) ? `
    <button onclick="goBackFromMember('category', '${catId}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer">
      ${SVG_ICONS.back}
      <span>${catName} 인원 목록으로 돌아가기</span>
    </button>
  ` : `
    <button onclick="goBackFromMember('group', '${group.id}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer">
      ${SVG_ICONS.back}
      <span>${groupEmoji} ${groupName} 인원 목록으로 돌아가기</span>
    </button>
  `;

  const baseAffiliation = (cat.hasSubgroups && group) ? `${group.emoji || ''} ${group.name}` : `${cat.emoji || ''} ${cat.name}`;
  let affiliationsText = baseAffiliation;
  if (Array.isArray(member.affiliations) && member.affiliations.length > 1) {
    const allNames = member.affiliations.map(a => {
      const c = KONGBAP_DATA.categories.find(catItem => catItem.id === a.category);
      if (a.subgroup && c?.groups) {
        const g = c.groups.find(grp => grp.id === a.subgroup);
        return `${c?.emoji || ''} ${g ? g.name : c?.name}`;
      }
      return `${c?.emoji || ''} ${c?.name || a.category}`;
    });
    affiliationsText = allNames.join(" · ");
  }

  const info = getMemberAffiliationInfo(member, cat.id, group?.id);
  const effectiveRole = info.role;
  const effectiveSwatRole = info.swatRole;
  const resigned = info.isResigned;
  const retired = info.isRetired;
  const martyred = info.isMartyred;
  const inactive = info.isInactive;

  const mDetailId = typeof sanitizeAttr === 'function' ? sanitizeAttr(member.id) : member.id;
  const mDetailName = typeof escapeHtml === 'function' ? escapeHtml(member.name) : member.name;
  const mDetailStreamer = typeof escapeHtml === 'function' ? escapeHtml(member.streamer) : member.streamer;
  const safeDetailRole = typeof escapeHtml === 'function' ? escapeHtml(effectiveRole) : effectiveRole;
  const safeDetailSubCount = typeof escapeHtml === 'function' ? escapeHtml(member.subscriberCount) : member.subscriberCount;
  const safeAffiliationsText = typeof escapeHtml === 'function' ? escapeHtml(affiliationsText) : affiliationsText;

  let channelUrl = '#';
  if (member.youtubeUrl) {
    if (isMemberChzzk(member)) {
      channelUrl = member.youtubeUrl.startsWith('http') ? sanitizeUrl(member.youtubeUrl) : sanitizeUrl(`https://chzzk.naver.com/${member.youtubeUrl}`);
    } else {
      channelUrl = member.youtubeUrl.startsWith('http') ? sanitizeUrl(member.youtubeUrl) : sanitizeUrl(`https://www.youtube.com/${member.youtubeUrl}`);
    }
  }

  const videosHtml = renderMemberVideoCardsHtml(displayedVideos, summary, currentTab);

  container.innerHTML = `
    <div class="mb-6 sm:mb-8">
      ${backButtonHtml}
      <div id="member-profile-header-${mDetailId}" class="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 shadow-2xl relative overflow-hidden">
        <div class="flex items-start sm:items-center gap-4 sm:gap-6 relative z-10">
          <div class="relative flex-shrink-0">
            <img src="${getMemberAvatar(member)}" alt="${mDetailName}" loading="eager" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/default-avatar.svg'" class="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl sm:rounded-3xl object-cover border-4 border-zinc-800 shadow-2xl transition-all duration-300 ${inactive ? 'grayscale contrast-125 opacity-80 hover:grayscale-0 hover:contrast-100 hover:opacity-100 cursor-pointer' : ''}" />
            ${effectiveSwatRole ? getSwatBadgeHtml(effectiveSwatRole, 'lg') : ''}
            ${(!isRoleBadgeHidden(safeDetailRole) && safeDetailRole) ? `
              <span class="absolute -bottom-2 -right-2 z-20 text-xs font-bold px-2.5 py-1 rounded-xl ${getMemberRoleBadgeClass(member, cat.id, group?.id)} shadow-xl border border-white/20">
                ${safeDetailRole}
              </span>
            ` : ''}
            ${martyred ? `
              <span class="absolute -top-2.5 -right-2.5 z-20 text-xs font-black px-2.5 py-1 rounded-xl bg-zinc-950/95 text-red-400 border border-red-800/90 shadow-xl shadow-red-950/40 ring-1 ring-red-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="순직">
                <span>순직</span>
              </span>
            ` : (retired ? `
              <span class="absolute -top-2.5 -right-2.5 z-20 text-xs font-black px-2.5 py-1 rounded-xl bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow-xl shadow-zinc-950/40 ring-1 ring-zinc-700/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="면직">
                <span>면직</span>
              </span>
            ` : (resigned ? `
              <span class="absolute -top-2.5 -right-2.5 z-20 text-xs font-black px-2.5 py-1 rounded-xl bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow-xl shadow-amber-950/40 ring-1 ring-amber-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="사직">
                <span>사직</span>
              </span>
            ` : ''))}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              ${safeDetailRole ? `<span class="text-xs font-bold px-2.5 py-1 rounded-md ${getMemberRoleBadgeClass(member, cat.id, group?.id)}">${safeDetailRole}</span>` : ''}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300">소속: ${safeAffiliationsText}</span>
            </div>
            <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h2 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight truncate">${mDetailStreamer}</h2>
              ${member.subscriberCount ? (
                isMemberChzzk(member) ? `
                  <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold text-[#00ffa3] bg-[#00ffa3]/10 hover:bg-[#00ffa3]/20 border border-[#00ffa3]/40 px-2.5 py-1 rounded-lg shadow-sm transition-colors cursor-pointer" title="치지직 채널 바로가기 (팔로워 ${safeDetailSubCount})">
                    <svg class="w-3.5 h-3.5 text-[#00ffa3] fill-current" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
                    <span>${safeDetailSubCount}</span>
                    <svg class="w-3 h-3 text-[#00ffa3]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
                ` : `
                  <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold text-red-300 bg-red-950/80 hover:bg-red-900/90 border border-red-700/50 px-2.5 py-1 rounded-lg shadow-sm transition-colors cursor-pointer" title="유튜브 채널 바로가기 (구독자 ${safeDetailSubCount})">
                    <svg class="w-3.5 h-3.5 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <span>${safeDetailSubCount}</span>
                    <svg class="w-3 h-3 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
                `
              ) : ''}
            </div>
            <p class="text-amber-400 text-sm sm:text-base font-semibold mt-1">RP 캐릭터: ${mDetailName}</p>
            ${isAdmin() ? `
              <div class="flex items-center gap-2 mt-3">
                <button onclick="openMemberModal('edit', '${mDetailId}')" class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1">✏️ 정보 수정</button>
                <button onclick="deleteMember('${mDetailId}')" class="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white text-xs font-semibold border border-red-800/50 transition-colors cursor-pointer inline-flex items-center gap-1">🗑️ 인원 삭제</button>
              </div>
            ` : ''}
          </div>
        </div>

        <div id="member-profile-tabs-top" class="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto border-t md:border-t-0 border-zinc-800/80 pt-4 md:pt-0">
          ${renderMemberVideoTabsTopHtml(summary, currentTab, member)}
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
        <div id="member-profile-tabs-pills" class="flex items-center gap-1 sm:gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
          ${renderMemberVideoTabsPillsHtml(summary, currentTab, member)}
        </div>

        <div id="member-watch-toggle-container">
          ${renderMemberWatchToggleBtnHtml(member, currentTab, summary)}
        </div>

        ${isAdmin() ? `
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="openVideoModal('add')" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer" title="새 영상 등록">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>영상 추가</span>
            </button>
            <button onclick="openPlaylistModal()" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all border border-amber-500/40 hover:border-amber-400 shadow-lg cursor-pointer" title="유튜브 재생목록에서 영상 일괄 등록">
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <span>📑 재생목록 일괄 등록</span>
            </button>
          </div>
        ` : ''}
      </div>
    </div>

    <div id="member-videos-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${videosHtml}
    </div>
  `;
}

// ==========================================
// 검색 및 네비게이션(이동/선택/히스토리) 로직은
// ./js/navigation.js 모듈로 분리되었습니다.
// ==========================================
