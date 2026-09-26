const DEFAULT_CATEGORIES = [
  { id: "police", name: "경찰", emoji: "👮‍♂️", badge: "POLICE", icon: "shield", color: "blue", hasSubgroups: false, members: [] },
  { id: "ems", name: "EMS", emoji: "🚑", badge: "중증외상센터", icon: "cross", color: "teal", hasSubgroups: false, members: [] },
  {
    id: "gang", name: "갱단", emoji: "💀", badge: "GANG", icon: "skull", color: "red", hasSubgroups: true,
    groups: [
      { id: "gang-bigdick", name: "빅딕", emoji: "🍌", bgImage: "assets/빅딕.webp", members: [] },
      { id: "gang-oompa", name: "움파룸파", emoji: "😜", bgImage: "assets/움파룸파.webp", members: [] },
      { id: "gang-sangryeon", name: "상련", emoji: "👠", bgImage: "assets/상련.webp", members: [] },
      { id: "gang-goldmoon", name: "골드문", emoji: "🌙", bgImage: "assets/골드문.webp", members: [] },
      { id: "gang-nonghyup", name: "농협", emoji: "🌾", bgImage: "assets/농협.webp", members: [] },
      { id: "gang-girlbang", name: "GIRL BANG", emoji: "🐷", bgImage: "assets/걸뱅.webp", members: [] },
      { id: "gang-doremifa", name: "도레미파", emoji: "🎹", bgImage: "assets/도레미파.webp", members: [] },
      { id: "gang-metalunion", name: "금속노조", emoji: "⛏️", bgImage: "assets/금속노조.webp", members: [] },
      { id: "gang-adventure", name: "어드벤처", emoji: "🐯", bgImage: "assets/어드벤처.webp", members: [] },
      { id: "gang-kgaeng", name: "깨갱", emoji: "🐶", bgImage: "assets/깨갱.webp", members: [] },
      { id: "gang-streetcat", name: "길고양이 연합", emoji: "😺", bgImage: "assets/길고양이.webp", members: [] },
      { id: "gang-blackrose", name: "흑장미", emoji: "🌹", members: [] }
    ]
  },
  {
    id: "business", name: "사업체", emoji: "🏢", badge: "BUSINESS", icon: "building", color: "amber", hasSubgroups: true,
    groups: [
      { id: "biz-yastation", name: "야스테이션", emoji: "🔧", members: [] },
      { id: "biz-lux", name: "LUX 클럽", emoji: "🎭", members: [] },
      { id: "biz-young31", name: "영써티원", emoji: "🍔", members: [] },
      { id: "biz-koi", name: "KOI 레스토랑", emoji: "💌", members: [] }
    ]
  },
  { id: "press", name: "기자", emoji: "📰", badge: "KBTBS", icon: "camera", color: "sky", hasSubgroups: false, members: [] },
  { id: "citizen", name: "시민", emoji: "👥", badge: "CITIZEN", icon: "users", color: "purple", hasSubgroups: false, members: [] },
  { id: "guide", name: "가이드", emoji: "🧭", badge: "GUIDE", icon: "compass", color: "emerald", hasSubgroups: false, members: [] },
  { id: "loveline", name: "러브라인", emoji: "💕", badge: "LOVE", icon: "heart", color: "pink", hasSubgroups: false, members: [] }
];

const KONGBAP_DATA = {
  serverName: "콩밥특별시 아카이브",
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
};

const state = {
  currentCategory: "police",
  currentGroup: null,
  currentMember: null,
  currentVideoTab: "clip",
  searchQuery: "",
  navigationSource: null,
  currentUser: { role: "guest", username: "게스트" },
  userWatchRecords: {} // key: `${streamerId}_${videoType}` -> record
};

if (typeof window !== "undefined") {
  window.KONGBAP_DATA = KONGBAP_DATA;
  window.state = state;
}

function isLocalEnvironment() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || 
         host === "127.0.0.1" || 
         window.location.protocol === "file:" || 
         host === "";
}
window.isLocalEnvironment = isLocalEnvironment;

function isAdmin() {
  return !!(state.currentUser && state.currentUser.role === "admin");
}

function isUserLoggedIn() {
  return !!(state.currentUser && (state.currentUser.role === "user" || state.currentUser.role === "admin"));
}

function isWatchedSection(streamerId, videoType) {
  if (!streamerId || !videoType) return false;
  const key = `${streamerId}_${videoType}`;
  const record = state.userWatchRecords && state.userWatchRecords[key];
  return !!(record && (record.watched === true || record.watched === "true"));
}

function loadStoredAuth() {
  try {
    const saved = localStorage.getItem("kongbap_auth_user");
    const expireAt = localStorage.getItem("kongbap_auth_expire_at");
    const now = Date.now();

    if (saved && expireAt && now < Number(expireAt)) {
      const parsed = JSON.parse(saved);
      // 보안 강화: 정적 웹(GitHub Pages) 배포 환경에서는 로컬 스토리지 조작을 통한 관리자 권한 복원을 원천 차단
      if (parsed && parsed.role === "admin" && !isLocalEnvironment()) {
        state.currentUser = { role: "guest", username: "게스트" };
        localStorage.removeItem("kongbap_auth_user");
        localStorage.removeItem("kongbap_auth_expire_at");
        localStorage.removeItem("kongbap_admin_token");
        return;
      }
      if (parsed && (parsed.role === "admin" || (parsed.role === "user" && parsed.username === "user1"))) {
        state.currentUser = parsed;
        return;
      } else {
        localStorage.removeItem("kongbap_auth_user");
        localStorage.removeItem("kongbap_auth_expire_at");
        localStorage.removeItem("kongbap_admin_token");
      }
    }
  } catch (e) {}
  state.currentUser = { role: "guest", username: "게스트" };
}

const DEFAULT_AVATAR = "assets/default-avatar.svg";

// ==========================================
// 정적 배포(docs) XSS 및 악성 URL 인젝션 방어 유틸리티
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  // 1. 비가시 제어문자(ASCII 0-31, 127) 제거 및 앞뒤 공백 제거
  const cleaned = url.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  const lower = cleaned.toLowerCase();
  
  // 2. 위험 프로토콜 및 악성 스크립트 실행 벡터 차단
  if (
    lower.startsWith("javascript:") || 
    lower.startsWith("vbscript:") || 
    lower.startsWith("file:") ||
    lower.startsWith("blob:") ||
    lower.includes("javascript:") ||
    lower.includes("vbscript:") ||
    (lower.startsWith("data:") && !lower.startsWith("data:image/")) ||
    (lower.startsWith("data:image/") && (lower.includes("svg") || lower.includes("xml") || lower.includes("<script")))
  ) {
    return "#";
  }
  
  // 3. 안전한 프로토콜, 상대경로, 인페이지 앵커(#)만 허용
  if (
    lower.startsWith("http://") || 
    lower.startsWith("https://") || 
    lower.startsWith("./") || 
    lower.startsWith("/") || 
    lower.startsWith("#") || 
    lower.startsWith("assets/") || 
    lower.startsWith("data:image/")
  ) {
    // 4. HTML 속성 이탈(Attribute Injection/Breakout) 방지용 이스케이프
    return escapeHtml(cleaned);
  }
  return "#";
}
window.sanitizeUrl = sanitizeUrl;

function sanitizeAttr(str) {
  if (str === null || str === undefined) return "";
  return escapeHtml(String(str));
}
window.sanitizeAttr = sanitizeAttr;

function getMemberAvatar(member) {
  if (!member) return DEFAULT_AVATAR;
  const av = typeof member === "string" ? member : (member.avatar || "");
  if (!av || av.includes("images.unsplash.com")) return DEFAULT_AVATAR;
  const safe = sanitizeUrl(av);
  return (safe === "#") ? DEFAULT_AVATAR : safe;
}

function applyCategoryStructure(structureCategories) {
  if (!Array.isArray(structureCategories) || structureCategories.length === 0) return;

  const catMap = new Map();
  KONGBAP_DATA.categories.forEach(c => catMap.set(c.id, c));

  const reorderedCats = [];
  structureCategories.forEach(savedCat => {
    if (catMap.has(savedCat.id)) {
      const liveCat = catMap.get(savedCat.id);

      if (liveCat.hasSubgroups && Array.isArray(savedCat.groups)) {
        const groupMap = new Map();
        (liveCat.groups || []).forEach(g => groupMap.set(g.id, g));

        const reorderedGroups = [];
        savedCat.groups.forEach(savedG => {
          if (groupMap.has(savedG.id)) {
            const liveG = groupMap.get(savedG.id);
            if (savedG.name) liveG.name = savedG.name;
            if (savedG.emoji) liveG.emoji = savedG.emoji;
            reorderedGroups.push(liveG);
            groupMap.delete(savedG.id);
          } else {
            reorderedGroups.push({
              id: savedG.id,
              name: savedG.name || savedG.id,
              emoji: savedG.emoji || "📁",
              members: []
            });
          }
        });

        groupMap.forEach(remainingG => {
          reorderedGroups.push(remainingG);
        });

        liveCat.groups = reorderedGroups;
      }

      reorderedCats.push(liveCat);
      catMap.delete(savedCat.id);
    }
  });

  catMap.forEach(remainingCat => {
    reorderedCats.push(remainingCat);
  });

  // 러브라인 카테고리가 가이드 옆에 오도록 위치 보정
  const lovelineIdx = reorderedCats.findIndex(c => c.id === "loveline");
  const guideIdx = reorderedCats.findIndex(c => c.id === "guide");
  if (lovelineIdx !== -1 && guideIdx !== -1 && lovelineIdx !== guideIdx + 1) {
    const [lovelineCat] = reorderedCats.splice(lovelineIdx, 1);
    const newGuideIdx = reorderedCats.findIndex(c => c.id === "guide");
    reorderedCats.splice(newGuideIdx + 1, 0, lovelineCat);
  } else if (lovelineIdx === -1) {
    const defLove = DEFAULT_CATEGORIES.find(c => c.id === "loveline");
    if (defLove) {
      if (guideIdx !== -1) {
        reorderedCats.splice(guideIdx + 1, 0, JSON.parse(JSON.stringify(defLove)));
      } else {
        reorderedCats.push(JSON.parse(JSON.stringify(defLove)));
      }
    }
  }

  KONGBAP_DATA.categories = reorderedCats;
}

const CURRENT_DATA_VERSION = "20260922_admin_opt_v1";
window.CURRENT_DATA_VERSION = CURRENT_DATA_VERSION;

function loadStoredData() {
  try {
    const storedVersion = localStorage.getItem("kongbap_data_version");
    if (storedVersion !== CURRENT_DATA_VERSION) {
      console.log(`[버전 갱신] 새 데이터 버전(${CURRENT_DATA_VERSION}) 감지. 기존 로컬 캐시를 무효화하고 최신 겸직 연동 데이터를 새로고침합니다.`);
      localStorage.removeItem("kongbap_custom_data");
      localStorage.setItem("kongbap_data_version", CURRENT_DATA_VERSION);
      return;
    }

    const saved = localStorage.getItem("kongbap_custom_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.categories)) {
        // 캐시 무결성 검사: 만약 저장된 고유 멤버 수가 220명 미만이거나 정비소/갱단 인원이 부족하면 구버전 캐시로 판별하여 무효화
        const cachedMemberSet = new Set();
        let yastationMemberCount = 0;
        let gangMemberCount = 0;
        parsed.categories.forEach(cat => {
          if (cat.hasSubgroups && Array.isArray(cat.groups)) {
            cat.groups.forEach(g => {
              if (Array.isArray(g.members)) {
                g.members.forEach(m => { if (m && m.id) cachedMemberSet.add(m.id); });
                if (g.id === "biz-yastation") yastationMemberCount = g.members.length;
                if (cat.id === "gang") gangMemberCount += g.members.length;
              }
            });
          } else if (Array.isArray(cat.members)) {
            cat.members.forEach(m => { if (m && m.id) cachedMemberSet.add(m.id); });
          }
        });

        // 갱단 멤버 중 겸직 연동된 인원(씨랙, 금휘 등)이 갱단 목록에 제대로 포함되어 있는지 검사
        const hasLinkedGangMembers = parsed.categories.some(cat => {
          if (cat.id !== "gang" || !Array.isArray(cat.groups)) return false;
          const nonghyup = cat.groups.find(g => g.id === "gang-nonghyup");
          const blackrose = cat.groups.find(g => g.id === "gang-blackrose");
          const hasRack = nonghyup && Array.isArray(nonghyup.members) && nonghyup.members.some(m => m.id === "pol-14");
          const hasHwi = blackrose && Array.isArray(blackrose.members) && blackrose.members.some(m => m.id === "ems-8");
          return hasRack && hasHwi;
        });

        if (cachedMemberSet.size < 220 || yastationMemberCount === 0 || gangMemberCount < 100 || !hasLinkedGangMembers) {
          console.log(`[캐시 갱신] 최신 겸직 연동 인원 반영을 위해 구버전 로컬 캐시(고유 인원: ${cachedMemberSet.size}명, 갱단: ${gangMemberCount}명)를 무효화합니다.`);
          localStorage.removeItem("kongbap_custom_data");
          localStorage.setItem("kongbap_data_version", CURRENT_DATA_VERSION);
          return;
        }

        applyCategoryStructure(parsed.categories);

        parsed.categories.forEach(savedCat => {
          const liveCat = KONGBAP_DATA.categories.find(c => c.id === savedCat.id);
          if (!liveCat) return;
          if (liveCat.hasSubgroups && Array.isArray(savedCat.groups)) {
            savedCat.groups.forEach(savedG => {
              const liveG = (liveCat.groups || []).find(g => g.id === savedG.id);
              if (liveG && Array.isArray(savedG.members) && savedG.members.length > 0) {
                liveG.members = savedG.members;
              }
            });
          } else if (Array.isArray(savedCat.members) && savedCat.members.length > 0) {
            liveCat.members = savedCat.members;
          }
        });
      }
    }
  } catch (e) {
    console.warn("로컬 캐시 로드 실패", e);
  }
}

// 인원별 캐시 무효화 (영상 추가/수정/삭제 시 즉시 반영)
function invalidateMemberVideoCaches(member) {
  if (!member) return;
  delete member._ytCount;
  delete member._chzzkCount;
  delete member._ytChzzkVideoLen;
  delete member._ytChzzkVideoRef;
  delete member._videoSummary;
  delete member._videoSummaryRef;
  delete member._videoSummaryLen;
}
window.invalidateMemberVideoCaches = invalidateMemberVideoCaches;

// 인원별 플랫폼별 영상 개수 (단일 패스 계산 및 길이/참조 기반 자동 감지)
function getMemberPlatformVideoCounts(member) {
  if (!member) return { ytCount: 0, chzzkCount: 0, totalCount: 0 };
  const rawVideos = member.videos;
  const rawVideosLen = Array.isArray(rawVideos) ? rawVideos.length : 0;

  if (
    member._ytCount === undefined ||
    member._chzzkCount === undefined ||
    member._ytChzzkVideoLen !== rawVideosLen ||
    member._ytChzzkVideoRef !== rawVideos
  ) {
    let ytCount = 0;
    let chzzkCount = 0;
    if (Array.isArray(rawVideos)) {
      for (let i = 0; i < rawVideos.length; i++) {
        const v = rawVideos[i];
        if (!v) continue;
        const u = (v.url && v.url !== "undefined") ? v.url : "";
        if (!u && !v.videoId) continue;
        const isChzzk = (typeof isChzzkUrl === "function" ? isChzzkUrl(u) : /chzzk\.naver\.com/i.test(String(u)));
        if (isChzzk) {
          chzzkCount++;
        } else {
          ytCount++;
        }
      }
    }
    member._ytCount = ytCount;
    member._chzzkCount = chzzkCount;
    member._ytChzzkVideoLen = rawVideosLen;
    member._ytChzzkVideoRef = rawVideos;
  }
  return {
    ytCount: member._ytCount,
    chzzkCount: member._chzzkCount,
    totalCount: member._ytCount + member._chzzkCount
  };
}
window.getMemberPlatformVideoCounts = getMemberPlatformVideoCounts;

let persistTimer = null;
function invalidateRuntimeCaches() {
  if (KONGBAP_DATA && Array.isArray(KONGBAP_DATA.categories)) {
    KONGBAP_DATA.categories.forEach(c => {
      c._cachedMembers = null;
      c._cachedVideoStats = null;
      c._cachedSubBadges = null;
      if (Array.isArray(c.members)) {
        c.members.forEach(m => {
          if (m) invalidateMemberVideoCaches(m);
        });
      }
      if (c.hasSubgroups && Array.isArray(c.groups)) {
        c.groups.forEach(g => {
          g._cachedVideoStats = null;
          g._cachedSubBadges = null;
          if (Array.isArray(g.members)) {
            g.members.forEach(m => {
              if (m) invalidateMemberVideoCaches(m);
            });
          }
        });
      }
    });
  }
  if (state && state.currentMember) {
    invalidateMemberVideoCaches(state.currentMember);
  }
  if (typeof clearAffiliationCache === "function") clearAffiliationCache();
  if (typeof clearRenderStatsCache === "function") clearRenderStatsCache();
  if (typeof invalidateLeaderboardCache === "function") invalidateLeaderboardCache();
}
window.invalidateRuntimeCaches = invalidateRuntimeCaches;

function persistData(immediate = false) {
  invalidateRuntimeCaches();

  const saveToStorage = () => {
    try {
      localStorage.setItem("kongbap_data_version", CURRENT_DATA_VERSION);
      localStorage.setItem("kongbap_custom_data", JSON.stringify(KONGBAP_DATA));
    } catch (e) {
      console.error("로컬 캐시 저장 실패", e);
    }
  };

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    saveToStorage();
    return;
  }

  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    saveToStorage();
  }, 150);
}

window.addEventListener("beforeunload", () => {
  if (persistTimer) {
    persistData(true);
  }
});

const COLOR_THEMES = {
  blue: {
    badge: "bg-blue-950/80 text-blue-300 border-blue-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    activeTab: "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
  },
  teal: {
    badge: "bg-teal-950/80 text-teal-300 border-teal-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(20,184,166,0.25)]",
    activeTab: "bg-teal-600 text-white shadow-lg shadow-teal-600/30"
  },
  red: {
    badge: "bg-red-950/80 text-red-300 border-red-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]",
    activeTab: "bg-red-600 text-white shadow-lg shadow-red-600/30"
  },
  amber: {
    badge: "bg-amber-950/80 text-amber-300 border-amber-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    activeTab: "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
  },
  sky: {
    badge: "bg-sky-950/80 text-sky-300 border-sky-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(14,165,233,0.25)]",
    activeTab: "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
  },
  purple: {
    badge: "bg-purple-950/80 text-purple-300 border-purple-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]",
    activeTab: "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
  },
  emerald: {
    badge: "bg-emerald-950/80 text-emerald-300 border-emerald-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    activeTab: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
  },
  pink: {
    badge: "bg-pink-950/80 text-pink-300 border-pink-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(244,114,182,0.3)]",
    activeTab: "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-600/30"
  }
};

const SVG_ICONS = {
  shield: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l8 4.5v5c0 5-3.5 9-8 10.5C7.5 21.5 4 17.5 4 12.5v-5L12 3z"></path></svg>`,
  cross: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
  skull: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 5.5V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.5c1.5-1 3-3 3-5.5a7 7 0 0 0-7-7zM9 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-5 11v-1m4 1v-1"></path></svg>`,
  building: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"></path></svg>`,
  camera: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  users: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>`,
  compass: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.5 6.5-2.12 5.66a.5.5 0 0 1-.29.29L7.5 16.5l2.12-5.66a.5.5 0 0 1 .29-.29z"/></svg>`,
  heart: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`,
  youtube: `<svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  external: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`,
  chevronRight: `<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`,
  back: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>`
};

const GROUP_BACKGROUND_IMAGES = {
  "gang-bigdick": "assets/빅딕.webp",
  "gang-oompa": "assets/움파룸파.webp",
  "gang-sangryeon": "assets/상련.webp",
  "gang-goldmoon": "assets/골드문.webp",
  "gang-nonghyup": "assets/농협.webp",
  "gang-girlbang": "assets/걸뱅.webp",
  "gang-doremifa": "assets/도레미파.webp",
  "gang-metalunion": "assets/금속노조.webp",
  "gang-adventure": "assets/어드벤처.webp",
  "gang-kgaeng": "assets/깨갱.webp",
  "gang-streetcat": "assets/길고양이.webp"
};

function getGroupBgImage(group) {
  if (!group) return null;
  if (group.bgImage) return group.bgImage;
  if (group.id && GROUP_BACKGROUND_IMAGES[group.id]) return GROUP_BACKGROUND_IMAGES[group.id];
  if (group.name) {
    if (group.name === "빅딕") return "assets/빅딕.webp";
    if (group.name === "움파룸파") return "assets/움파룸파.webp";
    if (group.name === "상련") return "assets/상련.webp";
    if (group.name === "골드문") return "assets/골드문.webp";
    if (group.name === "농협") return "assets/농협.webp";
    if (group.name === "GIRL BANG" || group.name === "걸뱅") return "assets/걸뱅.webp";
    if (group.name === "도레미파") return "assets/도레미파.webp";
    if (group.name === "금속노조") return "assets/금속노조.webp";
    if (group.name === "어드벤처") return "assets/어드벤처.webp";
    if (group.name === "깨갱") return "assets/깨갱.webp";
    if (group.name === "길고양이 연합" || group.name === "길고양이") return "assets/길고양이.webp";
  }
  return null;
}

function getVideoType(video) {
  if (!video) return 'clip';
  const t = video.videoType || video.type;
  if (t === 'binge' || t === 'playlist' || t === 'series') return 'binge';
  if (t === 'full') return 'full';
  return 'clip';
}

function isFullVideo(video) {
  return getVideoType(video) === 'full';
}

function isBingeVideo(video) {
  return getVideoType(video) === 'binge';
}

function getDefaultVideoTab(videos) {
  const allV = videos || [];
  const hasClip = allV.some(v => getVideoType(v) === 'clip');
  const hasFull = allV.some(v => getVideoType(v) === 'full');
  const hasBinge = allV.some(v => getVideoType(v) === 'binge');
  if (hasClip) return 'clip';
  if (hasFull) return 'full';
  if (hasBinge) return 'binge';
  return 'clip';
}

const _youtubeIdCache = new Map();
function extractYoutubeId(url) {
  if (!url) return null;
  const str = String(url).trim();
  if (str.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  const cached = _youtubeIdCache.get(str);
  if (cached !== undefined) return cached;

  const match = str.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/);
  const result = (match && match[2] && match[2].length === 11) ? match[2] : null;
  if (_youtubeIdCache.size < 4000) {
    _youtubeIdCache.set(str, result);
  }
  return result;
}

function isChzzkUrl(url) {
  if (!url) return false;
  return /chzzk\.naver\.com/i.test(String(url));
}

function extractChzzkVideoNo(url) {
  if (!url) return null;
  const str = String(url).trim();
  if (/^\d+$/.test(str)) {
    return str;
  }
  const match = str.match(/chzzk\.naver\.com\/video\/(\d+)/i);
  return match ? match[1] : null;
}

function extractChzzkChannelId(urlOrStr) {
  if (!urlOrStr) return null;
  const str = String(urlOrStr).trim();
  if (/^[a-f0-9]{32}$/i.test(str)) {
    return str.toLowerCase();
  }
  const match = str.match(/chzzk\.naver\.com\/(?:live\/)?([a-f0-9]{32})(?:[/?#]|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function isMemberChzzk(member) {
  if (!member || !member.youtubeUrl) return false;
  const url = String(member.youtubeUrl).trim();
  if (typeof isChzzkUrl === "function" && isChzzkUrl(url)) return true;
  if (/^[a-f0-9]{32}$/i.test(url)) return true;
  return false;
}

function getYoutubeThumbnail(urlOrVideo) {
  if (!urlOrVideo) return "assets/default-thumbnail.svg";
  let url = "";
  if (typeof urlOrVideo === "object" && urlOrVideo !== null) {
    const rawThumb = urlOrVideo.thumbnailUrl;
    if (rawThumb && 
        typeof rawThumb === "string" && 
        rawThumb !== "null" && 
        rawThumb !== "undefined" && 
        rawThumb !== "#" && 
        rawThumb.trim() !== "" &&
        !rawThumb.includes("assets/default-thumbnail.svg")) {
      const safe = typeof sanitizeUrl === "function" ? sanitizeUrl(rawThumb) : rawThumb;
      if (safe && safe !== "#") return safe;
    }
    url = (urlOrVideo.url && urlOrVideo.url !== "null" && urlOrVideo.url !== "undefined")
      ? urlOrVideo.url
      : (urlOrVideo.videoId ? `https://www.youtube.com/watch?v=${urlOrVideo.videoId}` : "");
  } else {
    url = String(urlOrVideo).trim();
  }

  if (!url || url === "null" || url === "undefined" || url === "#") return "assets/default-thumbnail.svg";
  if (typeof isChzzkUrl === "function" && isChzzkUrl(url)) return "assets/default-thumbnail.svg";

  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "assets/default-thumbnail.svg";
}
window.getYoutubeThumbnail = getYoutubeThumbnail;

function getTodayDateString() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function formatIsoDateToKst(isoDateStr) {
  if (!isoDateStr) return "";
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (y && m && day) {
      return `${y}.${m}.${day}`;
    }
    return d.toISOString().substring(0, 10).replace(/-/g, ".");
  } catch (e) {
    if (typeof isoDateStr === "string" && isoDateStr.length >= 10) {
      return isoDateStr.substring(0, 10).replace(/-/g, ".");
    }
    return "";
  }
}

function showToast(msg) {
  let toast = document.getElementById("toast-msg");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-msg";
    toast.className = "fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 translate-y-4 pointer-events-none flex items-center gap-2";
    document.body.appendChild(toast);
  }
  // XSS 방어: 스크립트 태그 및 위험 이벤트 핸들러 제거
  const safeMsg = typeof msg === "string"
    ? msg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
         .replace(/\bon\w+\s*=/gi, "data-disabled=")
         .replace(/javascript:/gi, "")
    : escapeHtml(String(msg));

  toast.innerHTML = safeMsg;
  toast.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
  toast.classList.add("opacity-100", "translate-y-0");

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
  }, 2500);
}

function getCategoryMembers(cat) {
  if (!cat) return [];
  if (cat._cachedMembers) return cat._cachedMembers;
  if (!cat.hasSubgroups) {
    cat._cachedMembers = cat.members || [];
    return cat._cachedMembers;
  }

  const rawMembers = (cat.groups || []).flatMap(g => g.members || []);
  const uniqueMembers = [];
  const seenKeys = new Set();

  for (let i = 0; i < rawMembers.length; i++) {
    const m = rawMembers[i];
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

    uniqueMembers.push(m);
  }

  cat._cachedMembers = uniqueMembers;
  return uniqueMembers;
}

function updateStats() {
  const uniqueMembers = new Map();
  const seenVideoUrls = new Set();
  let totalVideos = 0;
  let totalViews = 0;

  if (KONGBAP_DATA && KONGBAP_DATA.categories) {
    KONGBAP_DATA.categories.forEach(cat => {
      const members = getCategoryMembers(cat);
      members.forEach(m => {
        if (!m) return;
        const mKey = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
        if (!mKey) return;

        if (!uniqueMembers.has(mKey)) {
          uniqueMembers.set(mKey, m);
        }

        const validVideos = (m.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
        validVideos.forEach(v => {
          const vKey = (v.url || v.id || '').trim().toLowerCase();
          const vc = (v.viewCount != null && !isNaN(v.viewCount)) ? Number(v.viewCount) : 0;
          if (vKey && !seenVideoUrls.has(vKey)) {
            seenVideoUrls.add(vKey);
            totalVideos++;
            totalViews += vc;
          } else if (!vKey) {
            totalVideos++;
            totalViews += vc;
          }
        });
      });
    });
  }

  const totalMembers = uniqueMembers.size;
  const formattedHeaderViews = typeof formatViewCount === "function" ? (formatViewCount(totalViews) || "0회") : `${totalViews.toLocaleString()}회`;

  updateHeaderStats();
}

function updateHeaderStats() {
  const statEl = document.getElementById("header-stats");
  if (!statEl) return;

  const allMembers = typeof getAllMembersWithLeaderboardStats === "function" ? getAllMembersWithLeaderboardStats() : [];
  const globalStats = typeof computeGlobalMetrics === "function" ? computeGlobalMetrics(allMembers) : null;
  const totalMembers = globalStats ? globalStats.totalMembers : (allMembers.length || (typeof KONGBAP_DATA !== "undefined" ? KONGBAP_DATA.categories.reduce((acc, c) => acc + (getCategoryMembers(c) || []).length, 0) : 0));
  const totalVideos = globalStats ? globalStats.totalVideos : 0;

  const isStatsActive = (state.currentCategory === "stats" || state.currentCategory === "leaderboard") && !state.searchQuery;

  statEl.onclick = () => {
    if (typeof selectCategory === "function") selectCategory('stats');
  };

  if (isStatsActive) {
    statEl.className = "flex items-center justify-center bg-amber-950/80 hover:bg-amber-900/70 px-5 sm:px-6 lg:px-7 lg:min-w-[220px] py-2 sm:py-2.5 rounded-2xl border border-amber-500/70 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/20 text-white flex-shrink-0 cursor-pointer transition-all group select-none w-full lg:w-auto";
    statEl.innerHTML = `
      <div class="flex items-center justify-between gap-4 sm:gap-6 w-full">
        <div class="flex flex-col justify-center items-center sm:items-start gap-1">
          <div class="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-amber-300 group-hover:text-amber-200 transition-colors">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
            <span>종합 통계</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] sm:text-xs text-amber-100/90">
            <span><strong class="text-white font-semibold">${totalMembers}</strong>명 인원</span>
            <span class="text-amber-500/60">·</span>
            <span><strong class="text-white font-semibold">${totalVideos}</strong>개 영상</span>
          </div>
        </div>
        <svg class="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </div>
    `;
  } else {
    statEl.className = "flex items-center justify-center bg-zinc-900/80 hover:bg-zinc-800/90 px-5 sm:px-6 lg:px-7 lg:min-w-[220px] py-2 sm:py-2.5 rounded-2xl border border-zinc-800 hover:border-amber-500/50 flex-shrink-0 cursor-pointer transition-all shadow-md group select-none w-full lg:w-auto";
    statEl.innerHTML = `
      <div class="flex items-center justify-between gap-4 sm:gap-6 w-full">
        <div class="flex flex-col justify-center items-center sm:items-start gap-1">
          <div class="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-amber-400 group-hover:text-amber-300 transition-colors">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
            <span>종합 통계</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-400">
            <span><strong class="text-white font-semibold">${totalMembers}</strong>명 인원</span>
            <span class="text-zinc-600">·</span>
            <span><strong class="text-red-400 font-semibold">${totalVideos}</strong>개 영상</span>
          </div>
        </div>
        <svg class="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </div>
    `;
  }
}
window.updateHeaderStats = updateHeaderStats;

// 날짜 문자열을 밀리초 타임스탬프로 변환 (빠른 날짜일수록 작은 값)
function parseDateToTimestamp(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return Infinity;
  const cleaned = dateStr.trim();
  if (!cleaned) return Infinity;

  // YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD (공백 허용)
  const match = cleaned.match(/^(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.getTime();
    }
  }

  const parsed = Date.parse(cleaned.replace(/[.-]/g, "/"));
  return isNaN(parsed) ? Infinity : parsed;
}

// 영상 목록을 게시일자가 빠른 순(과거순/오름차순)으로 정렬하고 displayOrder를 0부터 순차 부여
function sortVideosByDateAsc(videos) {
  if (!Array.isArray(videos) || videos.length <= 1) return videos;

  // 정렬 전 날짜 타임스탬프 1회 일괄 계산 (O(N log N) 중복 파싱 방지)
  const timeMap = new Map();
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    timeMap.set(v, parseDateToTimestamp(v?.date));
  }

  videos.sort((a, b) => {
    const timeA = timeMap.get(a) ?? Infinity;
    const timeB = timeMap.get(b) ?? Infinity;
    if (timeA !== timeB) {
      return timeA - timeB; // 빠른 날짜가 먼저 (오름차순)
    }
    // 날짜가 동일할 경우 기존 displayOrder 순서 유지
    const orderA = a.displayOrder != null ? a.displayOrder : 999999;
    const orderB = b.displayOrder != null ? b.displayOrder : 999999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.id || "").localeCompare(b.id || "");
  });

  // 0부터 순차적으로 displayOrder 재부여
  for (let idx = 0; idx < videos.length; idx++) {
    videos[idx].displayOrder = idx;
  }

  return videos;
}

// 영상 재생 시간(H:MM:SS, MM:SS, ISO)을 초 단위로 변환 (캐싱 및 중간 배열 생성 없이 고속 파싱)
const _durationCache = new Map();
function parseDurationToSeconds(durationStr) {
  if (!durationStr || typeof durationStr !== "string") return 0;
  const str = durationStr.trim();
  if (!str) return 0;

  const cached = _durationCache.get(str);
  if (cached !== undefined) return cached;

  let totalSeconds = 0;
  if (str.charCodeAt(0) === 80) { // 'P' (ISO-8601: PT#H#M#S)
    let hours = 0, minutes = 0, seconds = 0;
    const hMatch = str.match(/(\d+)H/i);
    const mMatch = str.match(/(\d+)M/i);
    const sMatch = str.match(/(\d+)S/i);
    if (hMatch) hours = parseInt(hMatch[1], 10);
    if (mMatch) minutes = parseInt(mMatch[1], 10);
    if (sMatch) seconds = parseInt(sMatch[1], 10);
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else {
    const c1 = str.indexOf(':');
    if (c1 === -1) {
      const val = parseInt(str, 10);
      totalSeconds = isNaN(val) ? 0 : val;
    } else {
      const c2 = str.indexOf(':', c1 + 1);
      if (c2 !== -1) {
        const h = parseInt(str.substring(0, c1), 10);
        const m = parseInt(str.substring(c1 + 1, c2), 10);
        const s = parseInt(str.substring(c2 + 1), 10);
        totalSeconds = (isNaN(h) ? 0 : h * 3600) + (isNaN(m) ? 0 : m * 60) + (isNaN(s) ? 0 : s);
      } else {
        const m = parseInt(str.substring(0, c1), 10);
        const s = parseInt(str.substring(c1 + 1), 10);
        totalSeconds = (isNaN(m) ? 0 : m * 60) + (isNaN(s) ? 0 : s);
      }
    }
  }

  if (_durationCache.size < 4000) {
    _durationCache.set(str, totalSeconds);
  }
  return totalSeconds;
}

// 초 단위를 한글 시간 표기(X시간 Y분 / X분 Y초)로 변환
function formatSecondsToHangul(totalSec) {
  if (!totalSec || totalSec <= 0) return "0분";
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  } else if (minutes > 0) {
    return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
  } else {
    return `${seconds}초`;
  }
}

// 영상 조회수를 한글 친화적 표기(예: 15.1만회, 1,234회, 1.5억회)로 변환
function formatViewCount(count) {
  if (count === undefined || count === null || count === "") return null;
  const num = Number(count);
  if (isNaN(num) || num < 0) return null;
  if (num >= 100000000) {
    const val = (num / 100000000).toFixed(1).replace(/\.0$/, '');
    return `${val}억회`;
  }
  if (num >= 10000) {
    const val = (num / 10000).toFixed(1).replace(/\.0$/, '');
    return `${val}만회`;
  }
  return `${num.toLocaleString()}회`;
}
window.formatViewCount = formatViewCount;
