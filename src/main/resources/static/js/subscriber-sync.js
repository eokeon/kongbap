// ==========================================
// 유튜브 구독자 수 관리 및 수동 일괄 갱신 모듈
// (오직 인원 정보의 유튜브 링크(youtubeUrl)만 기준)
// ==========================================

function formatSubscriberCount(countStr) {
  if (!countStr) return null;
  const num = parseInt(countStr, 10);
  if (isNaN(num)) return null;
  if (num >= 100000000) {
    const eok = (num / 100000000).toFixed(1);
    return `${eok.endsWith(".0") ? eok.slice(0, -2) : eok}억 명`;
  }
  if (num >= 10000) {
    const man = (num / 10000).toFixed(1);
    return `${man.endsWith(".0") ? man.slice(0, -2) : man}만 명`;
  }
  return `${num.toLocaleString()}명`;
}

// 구독자 수 문자열(예: "121만 명", "57.8만 명", "1,200명")을 정수(숫자)로 변환
function parseSubscriberCount(countStr) {
  if (!countStr) return 0;
  if (typeof countStr === "number") return countStr;
  const str = String(countStr).trim();
  if (!str) return 0;

  if (str.includes("억")) {
    const numPart = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numPart);
    return isNaN(val) ? 0 : Math.round(val * 100000000);
  }

  if (str.includes("만")) {
    const numPart = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numPart);
    return isNaN(val) ? 0 : Math.round(val * 10000);
  }

  const clean = str.replace(/[^0-9]/g, "");
  const val = parseInt(clean, 10);
  return isNaN(val) ? 0 : val;
}

// 그룹(갱단/사업체) 및 카테고리 내 모든 멤버의 구독자 수 총합 계산 (동일 스트리머 중복 합산 방지)
function calculateGroupTotalSubscribers(members) {
  if (!Array.isArray(members) || members.length === 0) return null;
  const seen = new Set();
  let total = 0;

  for (const m of members) {
    if (!m) continue;
    const idKey = m.id ? `id:${m.id}` : null;
    const urlKey = (m.youtubeUrl && typeof m.youtubeUrl === 'string' && m.youtubeUrl.trim())
      ? `url:${m.youtubeUrl.trim().toLowerCase().replace(/\/+$/, '')}`
      : null;
    const streamerKey = (m.streamer && typeof m.streamer === 'string' && m.streamer.trim())
      ? `s:${m.streamer.trim().toLowerCase()}`
      : null;
    const fallbackKey = m.name ? `name:${m.name.trim().toLowerCase()}` : null;

    if ((idKey && seen.has(idKey)) || 
        (urlKey && seen.has(urlKey)) || 
        (streamerKey && seen.has(streamerKey))) {
      continue;
    }

    if (idKey) seen.add(idKey);
    if (urlKey) seen.add(urlKey);
    if (streamerKey) seen.add(streamerKey);
    if (fallbackKey) seen.add(fallbackKey);

    const count = parseSubscriberCount(m.subscriberCount);
    if (count > 0) {
      total += count;
    }
  }

  if (total === 0) return null;
  return formatSubscriberCount(total);
}

// 플랫폼별(유튜브 구독자 / 치지직 팔로워) 총합 계산
function calculateGroupPlatformSubscribers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return {
      ytTotal: 0,
      ytStr: null,
      chzzkTotal: 0,
      chzzkStr: null,
      grandTotal: 0,
      grandStr: null,
    };
  }

  const seen = new Set();
  let ytTotal = 0;
  let chzzkTotal = 0;

  for (const m of members) {
    if (!m) continue;
    const idKey = m.id ? `id:${m.id}` : null;
    const urlKey = (m.youtubeUrl && typeof m.youtubeUrl === 'string' && m.youtubeUrl.trim())
      ? `url:${m.youtubeUrl.trim().toLowerCase().replace(/\/+$/, '')}`
      : null;
    const streamerKey = (m.streamer && typeof m.streamer === 'string' && m.streamer.trim())
      ? `s:${m.streamer.trim().toLowerCase()}`
      : null;
    const fallbackKey = m.name ? `name:${m.name.trim().toLowerCase()}` : null;

    if ((idKey && seen.has(idKey)) || 
        (urlKey && seen.has(urlKey)) || 
        (streamerKey && seen.has(streamerKey))) {
      continue;
    }

    if (idKey) seen.add(idKey);
    if (urlKey) seen.add(urlKey);
    if (streamerKey) seen.add(streamerKey);
    if (fallbackKey) seen.add(fallbackKey);

    const count = parseSubscriberCount(m.subscriberCount);
    if (count > 0) {
      const isChzzk = typeof isMemberChzzk === "function"
        ? isMemberChzzk(m)
        : (m.youtubeUrl && (/chzzk\.naver\.com/i.test(String(m.youtubeUrl)) || /^[a-f0-9]{32}$/i.test(String(m.youtubeUrl).trim())));
      if (isChzzk) {
        chzzkTotal += count;
      } else {
        ytTotal += count;
      }
    }
  }

  const grandTotal = ytTotal + chzzkTotal;

  return {
    ytTotal,
    ytStr: ytTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(ytTotal) : `${ytTotal.toLocaleString()}명`) : null,
    chzzkTotal,
    chzzkStr: chzzkTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(chzzkTotal) : `${chzzkTotal.toLocaleString()}명`) : null,
    grandTotal,
    grandStr: grandTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(grandTotal) : `${grandTotal.toLocaleString()}명`) : null,
  };
}

// 유튜브 URL/문자열에서 채널 식별 정보(channelId, handle, videoId, username, search) 추출
function parseYouTubeTarget(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== "string") return null;
  let str = urlOrStr.trim();
  if (!str) return null;

  // URL 디코딩 처리 (한글 주소창 복사값 %EA%B5... 대응)
  try {
    str = decodeURIComponent(str);
  } catch (e) {}

  // 1) 채널 ID 직접 매칭: UC로 시작하는 24자리 ID (예: /channel/UC... 또는 UC...)
  const channelMatch = str.match(/channel\/(UC[a-zA-Z0-9_-]{22})/i) || str.match(/^(UC[a-zA-Z0-9_-]{22})$/i);
  if (channelMatch) {
    return { type: "channelId", value: channelMatch[1] };
  }

  // 2) 핸들(@handle): /@something 또는 @something (한글, 영문, 숫자, 특수기호 대응)
  const handleMatch = str.match(/@([^\/\s?#&]+)/);
  if (handleMatch) {
    return { type: "handle", value: "@" + handleMatch[1].trim() };
  }

  // 3) 사용자명 (/user/username 또는 /c/username)
  const userMatch = str.match(/(?:user|c)\/([^\/\s?#&]+)/i);
  if (userMatch) {
    return { type: "username", value: userMatch[1].trim() };
  }

  // 4) 혹시 인원 정보의 유튜브 링크란에 영상 URL(watch?v= 또는 youtu.be/)을 직접 넣은 경우
  const videoId = typeof extractYoutubeId === "function" ? extractYoutubeId(str) : null;
  if (videoId) {
    return { type: "videoId", value: videoId };
  }

  // 5) 일반 텍스트 (단순 핸들이나 채널명 텍스트)
  if (!str.startsWith("http://") && !str.startsWith("https://") && !str.includes("/")) {
    if (str.startsWith("@")) {
      return { type: "handle", value: str };
    }
    return { type: "search", value: str };
  }

  return null;
}

// 구독자 조회를 위한 타깃 식별자 (오직 인원 정보에 등록된 youtubeUrl만 사용, 영상 fallback 일절 없음)
function getSubscriberLookupTarget(member) {
  if (!member || !member.youtubeUrl || !member.youtubeUrl.trim()) return null;
  const url = member.youtubeUrl.trim();

  // 치지직 채널 식별자 추출 (치지직 URL 또는 32자리 hex 채널 ID)
  const chzzkId = typeof extractChzzkChannelId === "function" ? extractChzzkChannelId(url) : null;
  if (chzzkId) {
    return { platform: "chzzk", type: "chzzkChannelId", value: chzzkId, rawUrl: url };
  }

  const ytTarget = parseYouTubeTarget(url);
  if (ytTarget) {
    return { platform: "youtube", ...ytTarget, rawUrl: url };
  }
  return null;
}

// 유튜브 핸들(@handle) -> 고유 채널 ID(UC...) 로컬 영구 캐시 (오직 인원 정보 공식 조회 결과만 저장)
function getHandleChannelCache() {
  try {
    const raw = localStorage.getItem("kongbap_yt_handle_cache_v2");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveHandleChannelCache(cache) {
  try {
    localStorage.setItem("kongbap_yt_handle_cache_v2", JSON.stringify(cache));
  } catch (e) {}
}

// 동시 비동기 병렬 풀 실행 함수 (브라우저 네트워크 다중화 및 동시 처리 최적화)
async function runConcurrentPool(items, limit, workerFn) {
  if (!items || items.length === 0) return [];
  let index = 0;
  const results = new Array(items.length);
  const concurrency = Math.min(limit || 8, items.length);
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await workerFn(items[currentIndex], currentIndex);
      } catch (err) {
        results[currentIndex] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchMemberSubscriberFromYouTube(member) {
  const target = getSubscriberLookupTarget(member);
  if (!target) return null;

  // 1) 치지직 채널 팔로워 조회
  if (target.platform === "chzzk" || target.type === "chzzkChannelId") {
    try {
      if (typeof apiGetChzzkChannelInfo === "function") {
        const cData = await apiGetChzzkChannelInfo(target.value);
        if (cData && cData.success && cData.followerCountFormatted) {
          return cData.followerCountFormatted;
        }
      }
    } catch (err) {
      console.warn(`[Chzzk] ${member.streamer || member.name} 팔로워 조회 오류:`, err);
    }
    return null;
  }

  // 2) 유튜브 채널 구독자 조회 (오직 인원 정보에 등록된 youtubeUrl 채널만 100% 참조)
  let apiKey = "";
  if (typeof initYouTubeApiKeyFromBackend === "function") {
    apiKey = await initYouTubeApiKeyFromBackend();
  }
  if (!apiKey && typeof getEffectiveYouTubeApiKey === "function") {
    apiKey = getEffectiveYouTubeApiKey();
  }
  if (!apiKey) return null;

  const handleCache = getHandleChannelCache();
  let isCacheUpdated = false;

  try {
    let channelId = null;

    if (target.type === "channelId") {
      channelId = target.value;
    } else if (target.type === "handle") {
      const cleanHandle = target.value.replace(/^@+/, "");
      // 1) 인원 정보에 등록된 핸들로 공식 forHandle API 직접 조회 (타 채널/영상 절대 참조 안 함)
      try {
        const hRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + cleanHandle)}&key=${apiKey.trim()}`);
        if (hRes.ok) {
          const hData = await hRes.json();
          const cItem = hData.items?.[0];
          if (cItem) {
            if (cItem.id) {
              handleCache[cleanHandle] = cItem.id;
              isCacheUpdated = true;
            }
            const stats = cItem.statistics;
            if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
              if (isCacheUpdated) saveHandleChannelCache(handleCache);
              return formatSubscriberCount(stats.subscriberCount);
            }
          }
        }
      } catch (e) {}

      // 2) 캐시에 등록된 ID 확인
      if (handleCache[cleanHandle]) {
        channelId = handleCache[cleanHandle];
      } else {
        // 3) forHandle 실패 시 search API fallback
        try {
          const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&key=${apiKey.trim()}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            channelId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
            if (channelId) {
              handleCache[cleanHandle] = channelId;
              isCacheUpdated = true;
            }
          }
        } catch (e) {}
      }
    } else if (target.type === "username" || target.type === "search") {
      const query = target.value;
      const cleanQuery = query.replace(/^@+/, "");
      if (handleCache[cleanQuery]) {
        channelId = handleCache[cleanQuery];
      } else {
        try {
          const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${apiKey.trim()}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            channelId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
            if (channelId) {
              handleCache[cleanQuery] = channelId;
              isCacheUpdated = true;
            }
          }
        } catch (e) {}
      }
    }

    if (isCacheUpdated) {
      saveHandleChannelCache(handleCache);
    }

    if (channelId) {
      const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey.trim()}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        const stats = cData.items?.[0]?.statistics;
        if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
          return formatSubscriberCount(stats.subscriberCount);
        }
      }
    }
  } catch (e) {
    console.warn(`[YouTube] ${member.streamer} 구독자 조회 오류:`, e);
  }
  return null;
}

// 관리자가 모달에서 수동으로 실행하는 유튜브/치지직 구독자·팔로워 수 초고속 병렬 일괄 갱신
async function executeSubscriberSync(onProgress) {
  if (typeof requireServerConnection === "function") {
    const isConnected = await requireServerConnection("구독자 일괄 갱신");
    if (!isConnected) return { success: false, updatedCount: 0, totalIncrease: 0, targetsCount: 0 };
  }

  if (typeof initYouTubeApiKeyFromBackend === "function") {
    await initYouTubeApiKeyFromBackend();
  }

  const allMembers = extractAllStreamersFromKongbapData();
  // 대상: 오직 인원 정보에 유튜브 또는 치지직 링크(youtubeUrl)가 등록된 인원만 대상
  const targets = allMembers.filter(m => m.youtubeUrl && m.youtubeUrl.trim());
  if (targets.length === 0) return { success: true, updatedCount: 0, totalIncrease: 0, targetsCount: 0 };

  // 원래 구독자/팔로워 정보가 등록되어 있던 인원 기록 (원래 정보가 있었던 대상만 기존 대비 증가량 계산)
  const originalSubMap = new Map();
  targets.forEach(m => {
    const raw = m.subscriberCount;
    const num = parseSubscriberCount(raw);
    if (num > 0) {
      originalSubMap.set(String(m.id), num);
    }
  });

  // 1단계: 각 멤버별 인원 정보의 링크 분석
  const targetItems = [];
  for (const m of targets) {
    const target = getSubscriberLookupTarget(m);
    targetItems.push({ member: m, target });
  }

  let updatedCount = 0;
  let processedCount = 0;

  // 캐시 맵 (중복 요청 방지)
  const subCountCache = new Map();
  const handleCache = getHandleChannelCache();
  let isHandleCacheDirty = false;

  // 유튜브 타깃과 치지직 타깃 분리
  const ytItems = targetItems.filter(item => item.target && item.target.platform !== "chzzk" && item.target.type !== "chzzkChannelId");
  const chzzkItems = targetItems.filter(item => item.target && (item.target.platform === "chzzk" || item.target.type === "chzzkChannelId"));

  let apiKey = "";
  if (typeof initYouTubeApiKeyFromBackend === "function") {
    apiKey = await initYouTubeApiKeyFromBackend(true);
  }
  if (!apiKey && typeof getEffectiveYouTubeApiKey === "function") {
    apiKey = getEffectiveYouTubeApiKey();
  }
  if (!apiKey && ytItems.length > 0) {
    if (chzzkItems.length === 0) {
      throw new Error("유튜브 API 키가 설정되지 않았습니다. application.properties의 youtube.api.key 설정을 확인해주세요.");
    } else {
      console.warn("[Subscriber Sync] 유튜브 API 키가 설정되지 않아 치지직 채널만 우선 갱신합니다.");
      if (onProgress) {
        onProgress(0, targetItems.length, "유튜브 채널", "⚠️ API 키 미설정 (치지직 우선 진행)");
      }
    }
  }

  // --- 1-1단계: 치지직 채널 병렬 동시 사전 조회 (동시 8개 요청 풀) ---
  const uniqueChzzkIds = Array.from(new Set(chzzkItems.map(item => item.target.value)));
  if (uniqueChzzkIds.length > 0 && typeof apiGetChzzkChannelInfo === "function") {
    await runConcurrentPool(uniqueChzzkIds, 8, async (chId) => {
      try {
        const res = await apiGetChzzkChannelInfo(chId);
        if (res && res.success && res.followerCountFormatted) {
          subCountCache.set(chId, res.followerCountFormatted);
        }
      } catch (err) {
        console.warn(`[Chzzk Batch] 채널(${chId}) 팔로워 조회 오류:`, err);
      }
    });
  }

  // --- 1-2단계: 유튜브 채널 일괄 묶음(50개씩) 사전 조회 가속 ---
  // (오직 인원 정보의 직접 채널 ID 및 인원 정보 핸들로 검증된 캐시만 50개씩 일괄 요청)
  if (apiKey && ytItems.length > 0) {
    const directChannelIds = ytItems
      .filter(item => item.target && item.target.type === "channelId")
      .map(item => item.target.value);

    const handleChannelIds = [];
    const channelIdToAliases = new Map();

    ytItems.forEach(item => {
      const t = item.target;
      if (t && (t.type === "handle" || t.type === "username" || t.type === "search")) {
        const cleanHandle = t.value.replace(/^@+/, "");
        const cachedChId = handleCache[cleanHandle];
        if (cachedChId) {
          handleChannelIds.push(cachedChId);
          if (!channelIdToAliases.has(cachedChId)) {
            channelIdToAliases.set(cachedChId, new Set());
          }
          const aliases = channelIdToAliases.get(cachedChId);
          aliases.add(t.value);
          aliases.add(`@${cleanHandle}`);
          aliases.add(cleanHandle);
        }
      }
    });

    const allChannelIds = Array.from(new Set([...directChannelIds, ...handleChannelIds]));
    
    // 50개 단위 청크들을 병렬로 일괄 요청 (HTTP/2 다중화)
    const channelChunks = [];
    for (let i = 0; i < allChannelIds.length; i += 50) {
      channelChunks.push(allChannelIds.slice(i, i + 50));
    }

    await Promise.all(channelChunks.map(async (chunk) => {
      try {
        const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chunk.join(",")}&key=${apiKey.trim()}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          (cData.items || []).forEach(cItem => {
            const stats = cItem.statistics;
            if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
              const formatted = formatSubscriberCount(stats.subscriberCount);
              if (formatted) {
                subCountCache.set(cItem.id, formatted);
                const aliases = channelIdToAliases.get(cItem.id);
                if (aliases) {
                  aliases.forEach(alias => subCountCache.set(alias, formatted));
                }
              }
            }
          });
        }
      } catch (err) {
        console.warn("[YouTube Batch] 채널 구독자 일괄 조회 오류:", err);
      }
    }));
  }

  // --- 2단계: 각 스트리머별 실시간 병렬(동시 8개 풀) 조회 및 진행률 갱신 ---
  const memberObjMap = new Map();
  if (typeof KONGBAP_DATA !== "undefined" && Array.isArray(KONGBAP_DATA.categories)) {
    KONGBAP_DATA.categories.forEach(cat => {
      const list = cat.hasSubgroups ? (cat.groups || []).flatMap(g => g.members || []) : (cat.members || []);
      list.forEach(mem => {
        if (!mem || mem.id == null) return;
        const idStr = String(mem.id);
        if (!memberObjMap.has(idStr)) memberObjMap.set(idStr, []);
        memberObjMap.get(idStr).push(mem);
      });
    });
  }

  await runConcurrentPool(targetItems, 8, async (item) => {
    const m = item.member;
    const t = item.target;
    let subStr = null;
    const isChzzk = t && (t.platform === "chzzk" || t.type === "chzzkChannelId");

    if (t) {
      if (isChzzk) {
        if (subCountCache.has(t.value)) {
          subStr = subCountCache.get(t.value);
        } else if (typeof apiGetChzzkChannelInfo === "function") {
          try {
            const res = await apiGetChzzkChannelInfo(t.value);
            if (res && res.success && res.followerCountFormatted) {
              subStr = res.followerCountFormatted;
              subCountCache.set(t.value, subStr);
            }
          } catch (err) {}
        }
      } else if (!apiKey) {
        // API 키가 없으면 외부 구글 API를 절대 호출하지 않음 (403 방지)
        subStr = null;
      } else if (t.type === "channelId") {
        subStr = subCountCache.get(t.value) || null;
      } else if (t.type === "videoId") {
        try {
          const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${t.value}&key=${apiKey.trim()}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            const chId = vData.items?.[0]?.snippet?.channelId;
            if (chId) {
              const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chId}&key=${apiKey.trim()}`);
              if (cRes.ok) {
                const cData = await cRes.json();
                const stats = cData.items?.[0]?.statistics;
                if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                  subStr = formatSubscriberCount(stats.subscriberCount);
                }
              }
            }
          }
        } catch (e) {}
      } else if (t.type === "handle" || t.type === "username" || t.type === "search") {
        const cleanHandle = t.value.replace(/^@+/, "");
        if (subCountCache.has(t.value)) {
          subStr = subCountCache.get(t.value);
        } else if (subCountCache.has(`@${cleanHandle}`)) {
          subStr = subCountCache.get(`@${cleanHandle}`);
        } else if (subCountCache.has(cleanHandle)) {
          subStr = subCountCache.get(cleanHandle);
        } else if (handleCache[cleanHandle] && subCountCache.has(handleCache[cleanHandle])) {
          subStr = subCountCache.get(handleCache[cleanHandle]);
        } else {
          let foundChId = null;

          // 1) 인원 정보에 등록된 핸들(@handle)로 공식 forHandle API 직접 조회 (영상 역추적 절대 금지)
          if (t.type === "handle") {
            try {
              const hRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + cleanHandle)}&key=${apiKey.trim()}`);
              if (hRes.ok) {
                const hData = await hRes.json();
                const cItem = hData.items?.[0];
                if (cItem) {
                  if (cItem.id) {
                    foundChId = cItem.id;
                    handleCache[cleanHandle] = foundChId;
                    isHandleCacheDirty = true;
                  }
                  const stats = cItem.statistics;
                  if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                    subStr = formatSubscriberCount(stats.subscriberCount);
                  }
                }
              }
            } catch (err) {}
          }

          // 2) forHandle이 아닌 경우 또는 실패 시 기존 검증된 캐시 확인
          if (!foundChId && !subStr && handleCache[cleanHandle]) {
            foundChId = handleCache[cleanHandle];
          }

          // 3) forHandle 실패 시 또는 search/username인 경우 채널명 검색 fallback
          if (!foundChId && !subStr) {
            try {
              const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&key=${apiKey.trim()}`);
              if (sRes.ok) {
                const sData = await sRes.json();
                foundChId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
              }
            } catch (err) {}
          }

          if (foundChId && !subStr) {
            handleCache[cleanHandle] = foundChId;
            isHandleCacheDirty = true;
            if (subCountCache.has(foundChId)) {
              subStr = subCountCache.get(foundChId);
            } else {
              try {
                const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${foundChId}&key=${apiKey.trim()}`);
                if (cRes.ok) {
                  const cData = await cRes.json();
                  const stats = cData.items?.[0]?.statistics;
                  if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                    subStr = formatSubscriberCount(stats.subscriberCount);
                    subCountCache.set(foundChId, subStr);
                  }
                }
              } catch (err) {}
            }
          }

          if (subStr) {
            subCountCache.set(t.value, subStr);
            subCountCache.set(`@${cleanHandle}`, subStr);
            subCountCache.set(cleanHandle, subStr);
            if (foundChId) subCountCache.set(foundChId, subStr);
          }
        }
      }
    }

    processedCount++;

    if (subStr) {
      m.subscriberCount = subStr;
      const sameMembers = memberObjMap.get(String(m.id));
      if (sameMembers) {
        for (let i = 0; i < sameMembers.length; i++) {
          sameMembers[i].subscriberCount = subStr;
        }
      }
      updatedCount++;
      const platformPrefix = isChzzk ? "치지직 팔로워" : "유튜브 구독자";
      if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, `성공 (${platformPrefix} ${subStr})`);
    } else {
      let failReason = (!isChzzk && !apiKey) ? "API 키 미설정" : "조회 실패/비공개";
      if (!t) {
        failReason = "URL 형식 확인 필요";
      }
      if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, failReason);
    }

    // 부드러운 UI 갱신을 위해 초단위 미세 틱 양보 (15ms)
    await new Promise(resolve => setTimeout(resolve, 15));
  });

  if (isHandleCacheDirty) {
    saveHandleChannelCache(handleCache);
  }

  // 조회 완료 후 백업 및 DB 저장 단계 진입 알림
  if (onProgress) {
    onProgress(targetItems.length, targetItems.length, "전체 인원 조회 완료", "SAVING_BACKUP");
  }

  // 3단계: 기존 대비 총 증가량 및 새로 추가된 인원 증가량 계산
  let totalSubIncrease = 0;
  let prevTotalSub = 0;
  let newTotalSub = 0;
  let increasedCount = 0;

  let newlyAddedCount = 0;
  let newlyAddedSubTotal = 0;

  targets.forEach(m => {
    const memId = String(m.id);
    const newCount = parseSubscriberCount(m.subscriberCount);
    if (newCount > 0) {
      if (originalSubMap.has(memId)) {
        // 기존 등록자 기준
        const prevCount = originalSubMap.get(memId);
        prevTotalSub += prevCount;
        newTotalSub += newCount;
        const diff = newCount - prevCount;
        if (diff > 0) {
          totalSubIncrease += diff;
          increasedCount++;
        }
      } else {
        // 새로 추가된 인원 (기존에 등록되어 있지 않았던 인원)
        newlyAddedCount++;
        newlyAddedSubTotal += newCount;
      }
    }
  });

  const grandTotalIncrease = totalSubIncrease + newlyAddedSubTotal;

  persistData();
  if (typeof state !== "undefined" && state.currentCategory !== "adminpage" && typeof renderContent === "function") {
    renderContent();
  }

  const syncPromises = [];
  if (typeof syncAllStreamersToDb === "function") {
    syncPromises.push(syncAllStreamersToDb(extractAllStreamersFromKongbapData()));
  }
  const totalCount = targetItems.length;
  const failedCount = Math.max(0, totalCount - updatedCount);

  if (typeof createBackupSnapshot === "function") {
    let backupDesc = `구독자/팔로워 수 일괄 갱신 (성공 ${updatedCount}명, 실패 ${failedCount}명`;
    if (totalSubIncrease > 0) {
      backupDesc += `, 기존 구독자 +${totalSubIncrease.toLocaleString()}명(${increasedCount}명 상승)`;
    }
    if (newlyAddedCount > 0) {
      backupDesc += `, 신규 인원 ${newlyAddedCount}명(+${newlyAddedSubTotal.toLocaleString()}명)`;
    }
    backupDesc += `)`;
    syncPromises.push(createBackupSnapshot(backupDesc, false));
  }

  try {
    await Promise.all(syncPromises);
  } catch (e) {}

  return {
    success: true,
    updatedCount,
    successCount: updatedCount,
    failedCount,
    totalCount,
    targetsCount: totalCount,
    totalIncrease: totalSubIncrease,
    existingIncrease: totalSubIncrease,
    existingIncreasedCount: increasedCount,
    newlyAddedCount,
    newlyAddedSubTotal,
    grandTotalIncrease,
    prevTotal: prevTotalSub,
    newTotal: newTotalSub,
    increasedCount,
    hasPrevCount: originalSubMap.size,
    valueOf() { return this.updatedCount; },
    toString() { return String(this.updatedCount); }
  };
}

// 전역 객체 바인딩 (브라우저 어디서나 안정적으로 접근 가능하도록 보장)
if (typeof window !== "undefined") {
  window.formatSubscriberCount = formatSubscriberCount;
  window.parseSubscriberCount = parseSubscriberCount;
  window.calculateGroupTotalSubscribers = calculateGroupTotalSubscribers;
  window.calculateGroupPlatformSubscribers = calculateGroupPlatformSubscribers;
  window.parseYouTubeTarget = parseYouTubeTarget;
  window.executeSubscriberSync = executeSubscriberSync;
}
