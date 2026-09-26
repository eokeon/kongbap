// ==========================================
// 관리자 - 인원 관리 모듈 (Admin Member Management)
// ==========================================

let editingMemberId = null;
let _modalAffData = {};
let _activeModalAffKey = null;

function getAffKey(category, subgroup = null) {
  return `${category}_${subgroup || 'null'}`;
}

function getDefaultBadgeForAffiliation(category, subgroup = null) {
  if (category === 'police') return "bg-blue-600";
  if (category === 'ems') return "bg-teal-600";
  if (category === 'gang') return "bg-zinc-700";
  if (category === 'press') return "bg-sky-600";
  if (category === 'citizen') return "bg-purple-600";
  if (category === 'guide') return "bg-emerald-600";
  if (category === 'business') {
    if (subgroup === 'biz-yastation') return "bg-cyan-700";
    if (subgroup === 'biz-young31') return "bg-green-600";
    if (subgroup === 'biz-koi') return "bg-slate-700";
    if (subgroup === 'biz-lux') return "bg-amber-600";
    return "bg-amber-600";
  }
  return "bg-blue-600";
}

function saveFormIntoAffData(key) {
  if (!key) return;
  const roleVal = document.getElementById("member-form-role")?.value?.trim() || "";
  const swatSelect = document.getElementById("member-form-swat-select");
  const swatInput = document.getElementById("member-form-swat");
  let swatVal = "";
  if (swatSelect) {
    if (swatSelect.value === "custom" && swatInput) {
      swatVal = swatInput.value.trim();
    } else {
      swatVal = swatSelect.value;
    }
  } else if (swatInput) {
    swatVal = swatInput.value.trim();
  }

  const statusVal = document.getElementById("member-form-status")?.value || "active";
  const badgeVal = document.getElementById("member-form-badge")?.value || "bg-blue-600";

  const parts = key.split("_");
  const cat = parts[0];
  const actualSub = (parts.length > 1 && parts[1] !== "null") ? parts[1] : null;

  _modalAffData[key] = {
    category: cat,
    subgroup: actualSub,
    role: roleVal,
    swatRole: swatVal,
    status: statusVal,
    badgeColor: badgeVal
  };
}

function handleSwatSelectChange(val) {
  const swatInput = document.getElementById("member-form-swat");
  if (!swatInput) return;
  if (val === "custom") {
    swatInput.classList.remove("hidden");
    swatInput.value = "";
    swatInput.focus();
    if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
      _modalAffData[_activeModalAffKey].swatRole = "";
    }
  } else {
    swatInput.classList.add("hidden");
    swatInput.value = val;
    if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
      _modalAffData[_activeModalAffKey].swatRole = val;
    }
  }
}
window.handleSwatSelectChange = handleSwatSelectChange;

function handleSwatInputChange(val) {
  if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
    _modalAffData[_activeModalAffKey].swatRole = (val || "").trim();
  }
}
window.handleSwatInputChange = handleSwatInputChange;

function loadAffDataIntoForm(key) {
  if (!key || !_modalAffData[key]) return;
  _activeModalAffKey = key;
  const data = _modalAffData[key];

  const roleEl = document.getElementById("member-form-role");
  const swatSelect = document.getElementById("member-form-swat-select");
  const swatInput = document.getElementById("member-form-swat");
  const statusEl = document.getElementById("member-form-status");
  const badgeEl = document.getElementById("member-form-badge");

  if (roleEl) roleEl.value = data.role || "";

  const currentSwat = data.swatRole || "";
  if (swatSelect && swatInput) {
    if (["", "특공대장", "특공대원", "서버장", "가이드", "정보부"].includes(currentSwat)) {
      swatSelect.value = currentSwat;
      swatInput.value = currentSwat;
      swatInput.classList.add("hidden");
    } else {
      swatSelect.value = "custom";
      swatInput.value = currentSwat;
      swatInput.classList.remove("hidden");
    }
  } else if (swatInput) {
    swatInput.value = currentSwat;
  }

  if (statusEl) {
    const rawStatus = data.status || "active";
    if (rawStatus === "martyred" || rawStatus === "순직") {
      statusEl.value = "martyred";
    } else if (rawStatus === "retired" || rawStatus === "면직" || rawStatus === "퇴직" || rawStatus === "은퇴") {
      statusEl.value = "retired";
    } else if (rawStatus === "resigned" || rawStatus === "사직") {
      statusEl.value = "resigned";
    } else {
      statusEl.value = "active";
    }
  }

  if (badgeEl) badgeEl.value = data.badgeColor || getDefaultBadgeForAffiliation(data.category, data.subgroup);

  const swatContainer = document.getElementById("member-form-swat-container");
  const roleRow = document.getElementById("member-form-role-row");
  if (swatContainer && roleRow) {
    swatContainer.classList.remove("hidden");
    roleRow.className = "grid grid-cols-1 sm:grid-cols-2 gap-3";
  }

  // 소속별 설정 힌트 라벨 갱신
  const affs = getSelectedAffiliations();
  const cat = KONGBAP_DATA.categories.find(c => c.id === data.category);
  let name = cat?.name || data.category;
  let emoji = cat?.emoji || '';
  if (data.subgroup && cat?.groups) {
    const g = cat.groups.find(grp => grp.id === data.subgroup);
    if (g) {
      name = g.name;
      emoji = g.emoji || emoji;
    }
  }

  const roleHint = document.getElementById("member-form-role-aff-hint");
  if (roleHint) {
    if (affs.length > 1) {
      roleHint.textContent = `[${emoji} ${name}] 설정 중`;
      roleHint.classList.remove("hidden");
    } else {
      roleHint.classList.add("hidden");
    }
  }

  renderModalAffTabs();
}

function renderModalAffTabs() {
  const container = document.getElementById("member-form-aff-tabs-container");
  const buttonContainer = document.getElementById("member-form-aff-tab-buttons");
  if (!container || !buttonContainer) return;

  const affs = getSelectedAffiliations();
  if (affs.length <= 1) {
    container.classList.add("hidden");
    const roleHint = document.getElementById("member-form-role-aff-hint");
    if (roleHint) roleHint.classList.add("hidden");
    return;
  }

  // 겸직(2개 이상 소속) 시 즉시 탭 컨테이너 노출
  container.classList.remove("hidden");

  const defaultBadges = {
    police: "bg-blue-600",
    ems: "bg-teal-600",
    gang: "bg-red-600",
    business: "bg-amber-600",
    press: "bg-sky-600",
    citizen: "bg-purple-600",
    guide: "bg-emerald-600"
  };

  affs.forEach(a => {
    const k = getAffKey(a.category, a.subgroup);
    if (!_modalAffData[k]) {
      _modalAffData[k] = {
        category: a.category,
        subgroup: a.subgroup,
        role: "",
        swatRole: "",
        status: "active",
        badgeColor: getDefaultBadgeForAffiliation(a.category, a.subgroup)
      };
    }
  });

  const validKeys = affs.map(a => getAffKey(a.category, a.subgroup));
  if (!_activeModalAffKey || !validKeys.includes(_activeModalAffKey)) {
    _activeModalAffKey = validKeys[0];
  }

  buttonContainer.innerHTML = affs.map(a => {
    const k = getAffKey(a.category, a.subgroup);
    const cat = KONGBAP_DATA.categories.find(c => c.id === a.category);
    let name = cat?.name || a.category;
    let emoji = cat?.emoji || '';
    if (a.subgroup && cat?.groups) {
      const g = cat.groups.find(grp => grp.id === a.subgroup);
      if (g) {
        name = g.name;
        emoji = g.emoji || emoji;
      }
    }

    const isActive = (k === _activeModalAffKey);
    const itemData = _modalAffData[k] || {};
    const hasRole = !!itemData.role;
    const isMartyred = itemData.status === 'martyred' || (itemData.status && itemData.status.includes('순직'));
    const isRetired = !isMartyred && (itemData.status === 'retired' || (itemData.status && (itemData.status.includes('면직') || itemData.status.includes('퇴직') || itemData.status.includes('은퇴'))));
    const isResigned = !isMartyred && !isRetired && (itemData.status === 'resigned' || (itemData.status && itemData.status.includes('사직')));

    const activeClasses = isActive 
      ? "bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]" 
      : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border-zinc-700/80";

    return `
      <button 
        type="button" 
        onclick="switchModalAffTab('${k}')" 
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all cursor-pointer select-none ${activeClasses}"
      >
        <span>${emoji}</span>
        <span>${typeof escapeHtml === 'function' ? escapeHtml(name) : name}</span>
        ${hasRole ? `<span class="text-[10px] opacity-80 font-semibold">(${typeof escapeHtml === 'function' ? escapeHtml(itemData.role) : itemData.role})</span>` : '<span class="text-[10px] opacity-60 font-normal italic">(직위 미입력)</span>'}
        ${isMartyred ? `<span class="text-[9px] px-1 py-0.2 rounded bg-black/60 text-red-400 border border-red-800/60 font-black">순직</span>` : (isRetired ? `<span class="text-[9px] px-1 py-0.2 rounded bg-black/60 text-zinc-300 border border-zinc-600/60 font-black">면직</span>` : (isResigned ? `<span class="text-[9px] px-1 py-0.2 rounded bg-black/60 text-amber-400 border border-amber-800/60 font-black">사직</span>` : ''))}
      </button>
    `;
  }).join("");
}

function switchModalAffTab(newKey) {
  if (newKey === _activeModalAffKey) return;
  saveFormIntoAffData(_activeModalAffKey);
  loadAffDataIntoForm(newKey);
}
window.switchModalAffTab = switchModalAffTab;

function findMemberLocation(memberId) {
  for (const cat of KONGBAP_DATA.categories) {
    if (!cat.hasSubgroups) {
      const found = (cat.members || []).find(m => String(m.id) === String(memberId));
      if (found) return { category: cat, group: null, member: found };
    } else {
      for (const g of (cat.groups || [])) {
        const found = (g.members || []).find(m => String(m.id) === String(memberId));
        if (found) return { category: cat, group: g, member: found };
      }
    }
  }
  return null;
}

function findAllMemberLocations(memberId) {
  const locs = [];
  for (const cat of KONGBAP_DATA.categories) {
    if (!cat.hasSubgroups) {
      const found = (cat.members || []).find(m => String(m.id) === String(memberId));
      if (found) locs.push({ category: cat, group: null, member: found });
    } else {
      for (const g of (cat.groups || [])) {
        const found = (g.members || []).find(m => String(m.id) === String(memberId));
        if (found) locs.push({ category: cat, group: g, member: found });
      }
    }
  }
  return locs;
}

function setupAffiliationPanels() {
  const gangCat = KONGBAP_DATA.categories.find(c => c.id === "gang");
  const bizCat = KONGBAP_DATA.categories.find(c => c.id === "business");

  const gangContainer = document.getElementById("aff-gang-chips");
  if (gangContainer && gangCat?.groups) {
    gangContainer.innerHTML = gangCat.groups.map(g => `
      <label class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-900/60 bg-red-950/40 hover:border-red-500/60 cursor-pointer text-xs select-none truncate" title="${g.name}">
        <input type="checkbox" name="aff-gang-group" value="${g.id}" onchange="handleAffiliationCheckboxChange()" class="rounded border-red-800 text-red-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer flex-shrink-0">
        <span class="truncate text-red-200 text-[11px] font-medium">${g.emoji || ''} ${g.name}</span>
      </label>
    `).join("");
  }

  const bizContainer = document.getElementById("aff-business-chips");
  if (bizContainer && bizCat?.groups) {
    bizContainer.innerHTML = bizCat.groups.map(g => `
      <label class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-900/60 bg-amber-950/40 hover:border-amber-500/60 cursor-pointer text-xs select-none truncate" title="${g.name}">
        <input type="checkbox" name="aff-business-group" value="${g.id}" onchange="handleAffiliationCheckboxChange()" class="rounded border-amber-800 text-amber-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer flex-shrink-0">
        <span class="truncate text-amber-200 text-[11px] font-medium">${g.emoji || ''} ${g.name}</span>
      </label>
    `).join("");
  }
}

function handleAffiliationCheckboxChange(options = {}) {
  const skipSave = options && options.skipSave === true;

  const gangChecked = document.getElementById("aff-check-gang")?.checked;
  const bizChecked = document.getElementById("aff-check-business")?.checked;

  const gangPanel = document.getElementById("aff-gang-panel");
  if (gangPanel) {
    if (gangChecked) {
      gangPanel.classList.remove("hidden");
      const gangInputs = document.querySelectorAll('input[name="aff-gang-group"]');
      const anyChecked = Array.from(gangInputs).some(i => i.checked);
      if (!anyChecked && gangInputs.length > 0) {
        gangInputs[0].checked = true;
      }
    } else {
      gangPanel.classList.add("hidden");
    }
  }

  const bizPanel = document.getElementById("aff-business-panel");
  if (bizPanel) {
    if (bizChecked) {
      bizPanel.classList.remove("hidden");
      const bizInputs = document.querySelectorAll('input[name="aff-business-group"]');
      const anyChecked = Array.from(bizInputs).some(i => i.checked);
      if (!anyChecked && bizInputs.length > 0) {
        bizInputs[0].checked = true;
      }
    } else {
      bizPanel.classList.add("hidden");
    }
  }

  // 1. 현재 폼 값 먼저 활성 소속에 저장 (모달 초기화 중에는 이전 인원 값 덮어쓰기 방지)
  if (!skipSave && _activeModalAffKey) {
    saveFormIntoAffData(_activeModalAffKey);
  }

  // 2. 현재 선택된 소속 목록 파악
  const affs = getSelectedAffiliations();
  const validKeys = affs.map(a => getAffKey(a.category, a.subgroup));

  const defaultBadges = {
    police: "bg-blue-600",
    ems: "bg-teal-600",
    gang: "bg-red-600",
    business: "bg-amber-600",
    press: "bg-sky-600",
    citizen: "bg-purple-600",
    guide: "bg-emerald-600"
  };

  // 새로 추가된 소속 감지 및 _modalAffData 초기화
  let newlyAddedKey = null;
  affs.forEach(a => {
    const k = getAffKey(a.category, a.subgroup);
    if (!_modalAffData[k]) {
      _modalAffData[k] = {
        category: a.category,
        subgroup: a.subgroup,
        role: "",
        swatRole: "",
        status: "active",
        badgeColor: getDefaultBadgeForAffiliation(a.category, a.subgroup)
      };
      newlyAddedKey = k;
    }
  });

  // 새 소속이 방금 추가된 경우 해당 소속 탭으로 즉시 전환하여 바로 입력 가능하게 처리
  // 또는 현재 활성 탭이 체크 해제된 경우 유효한 첫 번째 탭으로 전환
  if (!skipSave && newlyAddedKey && affs.length > 1) {
    _activeModalAffKey = newlyAddedKey;
    loadAffDataIntoForm(_activeModalAffKey);
  } else if (!_activeModalAffKey || !validKeys.includes(_activeModalAffKey)) {
    _activeModalAffKey = validKeys[0] || null;
    if (_activeModalAffKey) {
      loadAffDataIntoForm(_activeModalAffKey);
    }
  } else {
    // 탭 바 즉시 렌더링 (겸직 탭 즉시 노출/숨김)
    renderModalAffTabs();

    // 모든 소속에 맞춰 추가 직책 및 직위 행 UI 갱신 (사업체 및 전 소속 지원)
    const swatContainer = document.getElementById("member-form-swat-container");
    const roleRow = document.getElementById("member-form-role-row");
    if (swatContainer && roleRow) {
      swatContainer.classList.remove("hidden");
      roleRow.className = "grid grid-cols-1 sm:grid-cols-2 gap-3";
    }
  }

  updateSelectedAffiliationCount();
}

// 직위/계급 입력 시 직책 뱃지 색상 자동 선택 (경찰 계급 및 공통 보스 등)
function handleRoleInputForPoliceColor(roleVal) {
  if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
    _modalAffData[_activeModalAffKey].role = (roleVal || "").trim();
    const affs = getSelectedAffiliations();
    if (affs.length > 1) {
      renderModalAffTabs();
    }
  }

  if (!roleVal) return;
  const badgeSelect = document.getElementById("member-form-badge");
  if (!badgeSelect) return;
  const r = roleVal.trim();
  const curAff = _activeModalAffKey ? _modalAffData[_activeModalAffKey] : null;
  const isPolice = curAff ? (curAff.category === 'police') : !!document.getElementById("aff-check-police")?.checked;
  const isEMS = curAff ? (curAff.category === 'ems') : !!document.getElementById("aff-check-ems")?.checked;
  const isPress = (curAff ? curAff.category === 'press' : !!document.getElementById("aff-check-press")?.checked) || ["국장", "기자"].some(k => r.includes(k));
  const isGang = (curAff ? curAff.category === 'gang' : !!document.getElementById("aff-check-gang")?.checked) || ["보스", "부두목", "간부", "조직원"].some(k => r.includes(k));
  const isLux = curAff ? (curAff.subgroup === 'biz-lux') : false;
  const isYastation = curAff ? (curAff.subgroup === 'biz-yastation') : false;
  const isYoung31 = curAff ? (curAff.subgroup === 'biz-young31') : false;
  const isKoi = curAff ? (curAff.subgroup === 'biz-koi') : false;

  if (isPolice) {
    if (r.includes("부청장") || r.includes("서장") || r.includes("경정") || r.includes("경감")) {
      badgeSelect.value = "bg-red-600";
    } else if (r.includes("청장")) {
      badgeSelect.value = "bg-red-900";
    } else if (r.includes("경위")) {
      badgeSelect.value = "bg-white";
    } else if (r.includes("경사")) {
      badgeSelect.value = "bg-orange-400";
    } else if (r.includes("경장")) {
      badgeSelect.value = "bg-pink-500";
    } else if (r.includes("팀장")) {
      badgeSelect.value = "bg-emerald-600";
    } else if (r.includes("순경")) {
      badgeSelect.value = "bg-blue-600";
    } else if (r.includes("교육생")) {
      badgeSelect.value = "bg-yellow-400";
    }
  } else if (isEMS || ["병원장", "간호실장", "간호부장", "간호사"].some(k => r.includes(k))) {
    if (r.includes("병원장")) {
      badgeSelect.value = "bg-teal-500";
    } else if (r.includes("간호부장")) {
      badgeSelect.value = "bg-teal-600";
    } else if (r.includes("간호실장")) {
      badgeSelect.value = "bg-cyan-600";
    } else if (r.includes("간호사")) {
      badgeSelect.value = "bg-emerald-500";
    }
  } else if (isPress) {
    if (r.includes("국장")) {
      badgeSelect.value = "bg-sky-700";
    } else if (r.includes("기자")) {
      badgeSelect.value = "bg-sky-500";
    }
  } else if (isGang) {
    if (r.includes("보스")) {
      badgeSelect.value = "bg-red-600";
    } else if (r.includes("부두목")) {
      badgeSelect.value = "bg-purple-600";
    } else if (r.includes("간부")) {
      badgeSelect.value = "bg-orange-700";
    } else if (r.includes("조직원")) {
      badgeSelect.value = "bg-zinc-700";
    }
  } else if (isYastation) {
    if (r.includes("사장")) {
      badgeSelect.value = "bg-amber-500";
    } else if (r.includes("메카닉 1기")) {
      badgeSelect.value = "bg-indigo-600";
    } else if (r.includes("메카닉 2기")) {
      badgeSelect.value = "bg-cyan-700";
    } else if (r.includes("홍보")) {
      badgeSelect.value = "bg-rose-500";
    }
  } else if (isYoung31) {
    if (r.includes("대표")) {
      badgeSelect.value = "bg-rose-600";
    } else if (r.includes("매니저")) {
      badgeSelect.value = "bg-orange-500";
    } else if (r.includes("직원")) {
      badgeSelect.value = "bg-green-600";
    } else if (r.includes("알바생")) {
      badgeSelect.value = "bg-lime-500";
    }
  } else if (isKoi) {
    if (r.includes("메이드장")) {
      badgeSelect.value = "bg-violet-600";
    } else if (r.includes("메이드")) {
      badgeSelect.value = "bg-fuchsia-500";
    } else if (r.includes("집사")) {
      badgeSelect.value = "bg-slate-700";
    }
  } else if (isLux) {
    if (r.includes("대표")) {
      badgeSelect.value = "bg-amber-600";
    } else if (r.includes("이사")) {
      badgeSelect.value = "bg-purple-600";
    }
  } else {
    if (r.includes("보스")) {
      badgeSelect.value = "bg-red-600";
    } else if (r.includes("부두목")) {
      badgeSelect.value = "bg-purple-600";
    } else if (r.includes("간부")) {
      badgeSelect.value = "bg-orange-700";
    } else if (r.includes("조직원")) {
      badgeSelect.value = "bg-zinc-700";
    } else if (r.includes("메카닉 1기")) {
      badgeSelect.value = "bg-indigo-600";
    } else if (r.includes("메카닉 2기")) {
      badgeSelect.value = "bg-cyan-700";
    } else if (r.includes("홍보")) {
      badgeSelect.value = "bg-rose-500";
    } else if (r.includes("사장")) {
      badgeSelect.value = "bg-amber-500";
    } else if (r.includes("알바생")) {
      badgeSelect.value = "bg-lime-500";
    } else if (r.includes("매니저")) {
      badgeSelect.value = "bg-orange-500";
    } else if (r.includes("직원")) {
      badgeSelect.value = "bg-green-600";
    } else if (r.includes("메이드장")) {
      badgeSelect.value = "bg-violet-600";
    } else if (r.includes("메이드")) {
      badgeSelect.value = "bg-fuchsia-500";
    } else if (r.includes("집사")) {
      badgeSelect.value = "bg-slate-700";
    } else if (r.includes("대표")) {
      badgeSelect.value = "bg-amber-600";
    } else if (r.includes("이사")) {
      badgeSelect.value = "bg-purple-600";
    } else if (r.includes("서버장")) {
      badgeSelect.value = "bg-emerald-500";
    } else if (r.includes("가이드")) {
      badgeSelect.value = "bg-emerald-600";
    }
  }

  if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
    _modalAffData[_activeModalAffKey].badgeColor = badgeSelect.value;
  }
}

function handleStatusChange(statusVal) {
  if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
    _modalAffData[_activeModalAffKey].status = statusVal;
    const affs = getSelectedAffiliations();
    if (affs.length > 1) {
      renderModalAffTabs();
    }
  }
}
window.handleStatusChange = handleStatusChange;

function handleBadgeChange(badgeVal) {
  if (_activeModalAffKey && _modalAffData[_activeModalAffKey]) {
    _modalAffData[_activeModalAffKey].badgeColor = badgeVal;
  }
}
window.handleBadgeChange = handleBadgeChange;

function getSelectedAffiliations() {
  const affs = [];
  const categories = (KONGBAP_DATA && Array.isArray(KONGBAP_DATA.categories))
    ? KONGBAP_DATA.categories
    : [{ id: "police" }, { id: "ems" }, { id: "gang" }, { id: "business" }, { id: "press" }, { id: "citizen" }, { id: "guide" }];

  categories.forEach(cat => {
    const chk = document.getElementById(`aff-check-${cat.id}`);
    if (!chk || !chk.checked) return;

    if (cat.id === "gang") {
      const gangInputs = document.querySelectorAll('input[name="aff-gang-group"]:checked');
      if (gangInputs.length > 0) {
        gangInputs.forEach(input => {
          affs.push({ category: "gang", subgroup: input.value });
        });
      } else {
        const firstGroup = cat?.groups?.[0]?.id || "gang-bigdick";
        affs.push({ category: "gang", subgroup: firstGroup });
      }
    } else if (cat.id === "business") {
      const bizInputs = document.querySelectorAll('input[name="aff-business-group"]:checked');
      if (bizInputs.length > 0) {
        bizInputs.forEach(input => {
          affs.push({ category: "business", subgroup: input.value });
        });
      } else {
        const firstGroup = cat?.groups?.[0]?.id || "biz-lux";
        affs.push({ category: "business", subgroup: firstGroup });
      }
    } else {
      affs.push({ category: cat.id, subgroup: null });
    }
  });

  return affs;
}

function updateSelectedAffiliationCount() {
  const affs = getSelectedAffiliations();
  const summaryEl = document.getElementById("member-form-selected-summary");
  if (!summaryEl) return;

  if (affs.length === 0) {
    summaryEl.textContent = "선택됨: 없음 (최소 1개 선택 필요)";
    summaryEl.className = "text-[11px] text-red-400 font-semibold truncate max-w-[220px] text-right";
    return;
  }

  const names = affs.map(a => {
    const cat = KONGBAP_DATA.categories.find(c => c.id === a.category);
    if (a.subgroup && cat?.groups) {
      const g = cat.groups.find(group => group.id === a.subgroup);
      return `${cat.emoji || ''} ${g ? g.name : cat.name}`;
    }
    return `${cat?.emoji || ''} ${cat?.name || a.category}`;
  });

  summaryEl.textContent = `선택됨(${affs.length}): ${names.join(", ")}`;
  summaryEl.className = "text-[11px] text-emerald-400 font-semibold truncate max-w-[220px] text-right";
}

function openMemberModal(mode = 'add', memberId = null, prefillCatId = null, prefillGroupId = null) {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }

  editingMemberId = memberId;
  _modalAffData = {};
  _activeModalAffKey = null;
  setupAffiliationPanels();

  const modal = document.getElementById("member-modal");
  const modalTitle = document.getElementById("member-modal-title");
  const modalSubtitle = document.getElementById("member-modal-subtitle");
  const formId = document.getElementById("member-form-id");
  const formName = document.getElementById("member-form-name");
  const formStreamer = document.getElementById("member-form-streamer");
  const formRole = document.getElementById("member-form-role");
  const formSwat = document.getElementById("member-form-swat");
  const swatSelect = document.getElementById("member-form-swat-select");
  const formBadge = document.getElementById("member-form-badge");
  const formAvatar = document.getElementById("member-form-avatar");
  const statusEl = document.getElementById("member-form-status");
  const formYoutube = document.getElementById("member-form-youtube");
  const roleHint = document.getElementById("member-form-role-aff-hint");
  const tabsContainer = document.getElementById("member-form-aff-tabs-container");

  // 이전 멤버의 잔여 데이터가 남지 않도록 DOM 폼 필드 완전히 초기화
  if (formId) formId.value = "";
  if (formName) formName.value = "";
  if (formStreamer) formStreamer.value = "";
  if (formRole) formRole.value = "";
  if (swatSelect) swatSelect.value = "";
  if (formSwat) { formSwat.value = ""; formSwat.classList.add("hidden"); }
  if (statusEl) statusEl.value = "active";
  if (formBadge) formBadge.value = "bg-blue-600";
  if (formAvatar) formAvatar.value = "";
  if (formYoutube) formYoutube.value = "";
  if (roleHint) roleHint.classList.add("hidden");
  if (tabsContainer) tabsContainer.classList.add("hidden");

  // 모든 소속 체크박스 초기화
  document.querySelectorAll('input[name="member-aff-category"], input[name="aff-gang-group"], input[name="aff-business-group"]').forEach(chk => {
    chk.checked = false;
  });
  ["aff-check-police", "aff-check-ems", "aff-check-gang", "aff-check-business", "aff-check-press", "aff-check-citizen", "aff-check-guide"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  if (mode === 'edit' && memberId) {
    const allLocs = findAllMemberLocations(memberId);
    if (!allLocs || allLocs.length === 0) {
      alert("인원 정보를 찾을 수 없습니다.");
      return;
    }
    const primaryMember = allLocs[0].member;

    modalTitle.textContent = "인원 정보 수정";
    modalSubtitle.textContent = `${primaryMember.streamer} (${primaryMember.name}) - 소속 겸직 관리`;
    if (formId) formId.value = primaryMember.id;
    if (formName) formName.value = primaryMember.name || "";
    if (formStreamer) formStreamer.value = primaryMember.streamer || "";
    if (formAvatar) formAvatar.value = primaryMember.avatar || "";
    previewMemberAvatar(primaryMember.avatar);

    if (formYoutube) {
      let yVal = primaryMember.youtubeUrl || "";
      try { yVal = decodeURIComponent(yVal); } catch(e) {}
      formYoutube.value = yVal;
    }

    // 기존 소속 체크박스 복원
    allLocs.forEach(loc => {
      const catCheck = document.getElementById(`aff-check-${loc.category.id}`);
      if (catCheck) catCheck.checked = true;
      if (loc.category.id === "gang" && loc.group) {
        const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${loc.group.id}"]`);
        if (gangInput) gangInput.checked = true;
      }
      if (loc.category.id === "business" && loc.group) {
        const bizInput = document.querySelector(`input[name="aff-business-group"][value="${loc.group.id}"]`);
        if (bizInput) bizInput.checked = true;
      }
    });

    let affList = Array.isArray(primaryMember.affiliations) && primaryMember.affiliations.length > 0
      ? primaryMember.affiliations
      : [];
    if (affList.length === 0 && allLocs.length > 0) {
      affList = allLocs.map((loc, idx) => ({
        category: loc.category.id,
        subgroup: loc.group ? loc.group.id : null,
        role: idx === 0 ? (loc.member.role || "") : "",
        swatRole: idx === 0 ? (loc.member.swatRole || "") : "",
        status: loc.member.status || "active",
        badgeColor: loc.member.badgeColor || "bg-blue-600"
      }));
    }
    if (affList.length === 0) {
      affList = [{
        category: primaryMember.category || 'police',
        subgroup: primaryMember.subgroup || null,
        role: primaryMember.role || "",
        swatRole: primaryMember.swatRole || "",
        status: primaryMember.status || "active",
        badgeColor: primaryMember.badgeColor || "bg-blue-600"
      }];
    }

    affList.forEach((aff, idx) => {
      const catCheck = document.getElementById(`aff-check-${aff.category}`);
      if (catCheck) catCheck.checked = true;
      if (aff.category === "gang" && aff.subgroup) {
        const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${aff.subgroup}"]`);
        if (gangInput) gangInput.checked = true;
      }
      if (aff.category === "business" && aff.subgroup) {
        const bizInput = document.querySelector(`input[name="aff-business-group"][value="${aff.subgroup}"]`);
        if (bizInput) bizInput.checked = true;
      }

      const k = getAffKey(aff.category, aff.subgroup);
      // 타 소속 추가직책 상속 금지: aff에 저장된 swatRole만 사용 (미입력 시 공백)
      let rawSwat = (aff.swatRole !== undefined && aff.swatRole !== null) ? String(aff.swatRole).trim() : "";
      let statusVal = (aff.status !== undefined && aff.status !== null && aff.status !== "") ? aff.status : (primaryMember.status || "active");
      if (rawSwat.includes("순직")) {
        statusVal = "martyred";
        rawSwat = rawSwat.replace(/순직/g, "").replace(/\s*·\s*/g, "").trim();
      } else if (rawSwat.includes("면직") || rawSwat.includes("퇴직") || rawSwat.includes("은퇴")) {
        statusVal = "retired";
        rawSwat = rawSwat.replace(/면직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").trim();
      } else if (rawSwat.includes("사직")) {
        statusVal = "resigned";
        rawSwat = rawSwat.replace(/사직/g, "").replace(/\s*·\s*/g, "").trim();
      }

      // 원래 직업의 직위 상속 금지: aff에 저장된 role만 사용 (미입력 시 공백 유지)
      // 단, affiliations 배열이 없던 레거시에서 단일 affiliation으로 생성된 경우(idx === 0)에만 primaryMember.role 보존
      let roleVal = "";
      if (aff.role !== undefined && aff.role !== null) {
        roleVal = String(aff.role).trim();
      } else if (idx === 0 && (!Array.isArray(primaryMember.affiliations) || primaryMember.affiliations.length === 0)) {
        roleVal = (primaryMember.role || "").trim();
      }

      _modalAffData[k] = {
        category: aff.category,
        subgroup: aff.subgroup || null,
        role: roleVal,
        swatRole: rawSwat,
        status: statusVal,
        badgeColor: (aff.badgeColor !== undefined && aff.badgeColor !== null && aff.badgeColor !== "") ? aff.badgeColor : (primaryMember.badgeColor || getDefaultBadgeForAffiliation(aff.category, aff.subgroup))
      };
    });

    const curTabKey = getAffKey(state.currentCategory, state.currentGroup?.id);
    if (_modalAffData[curTabKey]) {
      _activeModalAffKey = curTabKey;
    } else {
      _activeModalAffKey = Object.keys(_modalAffData)[0];
    }

    // skipSave: true 로 호출하여 이전 DOM 값이 신규 열린 멤버 데이터를 덮어쓰지 않도록 보호
    handleAffiliationCheckboxChange({ skipSave: true });
    loadAffDataIntoForm(_activeModalAffKey);
  } else {
    modalTitle.textContent = "새 인원 추가";
    modalSubtitle.textContent = "새 인원 등록 (다중 소속/겸직 가능)";
    previewMemberAvatar("");

    const targetCatId = prefillCatId || state.currentCategory || "police";
    const catCheck = document.getElementById(`aff-check-${targetCatId}`);
    if (catCheck) catCheck.checked = true;

    const targetGroupId = prefillGroupId || state.currentGroup?.id || null;
    if (targetCatId === "gang" && targetGroupId) {
      const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${targetGroupId}"]`);
      if (gangInput) gangInput.checked = true;
    }
    if (targetCatId === "business" && targetGroupId) {
      const bizInput = document.querySelector(`input[name="aff-business-group"][value="${targetGroupId}"]`);
      if (bizInput) bizInput.checked = true;
    }

    const initialKey = getAffKey(targetCatId, targetGroupId);
    _modalAffData[initialKey] = {
      category: targetCatId,
      subgroup: targetGroupId,
      role: "",
      swatRole: "",
      status: "active",
      badgeColor: getDefaultBadgeForAffiliation(targetCatId, targetGroupId)
    };
    _activeModalAffKey = initialKey;

    // skipSave: true 로 호출하여 이전 DOM 값이 신규 인원 등록 데이터를 덮어쓰지 않도록 보호
    handleAffiliationCheckboxChange({ skipSave: true });
    loadAffDataIntoForm(_activeModalAffKey);
  }

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (formName) setTimeout(() => formName.focus(), 50);
  }
}

function closeMemberModal() {
  const modal = document.getElementById("member-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  editingMemberId = null;
  _modalAffData = {};
  _activeModalAffKey = null;

  // 모달 닫힐 때 폼 필드들을 초기화하여 다른 인원 열 때 상태 전이 방지
  const formId = document.getElementById("member-form-id");
  if (formId) formId.value = "";
  const formName = document.getElementById("member-form-name");
  if (formName) formName.value = "";
  const formStreamer = document.getElementById("member-form-streamer");
  if (formStreamer) formStreamer.value = "";
  const formRole = document.getElementById("member-form-role");
  if (formRole) formRole.value = "";
  const swatSelect = document.getElementById("member-form-swat-select");
  if (swatSelect) swatSelect.value = "";
  const swatInput = document.getElementById("member-form-swat");
  if (swatInput) { swatInput.value = ""; swatInput.classList.add("hidden"); }
  const statusEl = document.getElementById("member-form-status");
  if (statusEl) statusEl.value = "active";
  const badgeEl = document.getElementById("member-form-badge");
  if (badgeEl) badgeEl.value = "bg-blue-600";
  const avatarEl = document.getElementById("member-form-avatar");
  if (avatarEl) avatarEl.value = "";
  const youtubeEl = document.getElementById("member-form-youtube");
  if (youtubeEl) youtubeEl.value = "";
  const roleHint = document.getElementById("member-form-role-aff-hint");
  if (roleHint) roleHint.classList.add("hidden");
  const tabsContainer = document.getElementById("member-form-aff-tabs-container");
  if (tabsContainer) tabsContainer.classList.add("hidden");
}

function previewMemberAvatar(url) {
  const preview = document.getElementById("member-form-avatar-preview");
  if (preview) preview.src = getMemberAvatar(url);
}

/**
 * 유튜브 링크 입력창에 URL 붙여넣기 시 한글 퍼센트 인코딩(%EC%A3...)을 즉시 읽기 쉬운 한글로 자동 디코딩
 */
function cleanYoutubeUrlInput(inputEl) {
  if (!inputEl || !inputEl.value) return;
  const val = inputEl.value.trim();
  if (val.includes("%")) {
    try {
      const decoded = decodeURIComponent(val);
      if (decoded !== val) {
        inputEl.value = decoded;
      }
    } catch (e) {
      try {
        inputEl.value = decodeURI(val);
      } catch (err) {}
    }
  }
}

function handleYoutubeUrlPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) {
    setTimeout(() => cleanYoutubeUrlInput(e.target), 10);
    return;
  }
  const pastedText = clipboardData.getData("text");
  if (!pastedText) return;

  if (pastedText.includes("%")) {
    e.preventDefault();
    let decoded = pastedText.trim();
    try {
      decoded = decodeURIComponent(pastedText.trim());
    } catch (err) {
      try { decoded = decodeURI(pastedText.trim()); } catch (e2) {}
    }

    const input = e.target;
    let inserted = false;
    try {
      inserted = document.execCommand && document.execCommand("insertText", false, decoded);
    } catch (err2) {
      inserted = false;
    }

    if (!inserted) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value;
      input.value = val.substring(0, start) + decoded + val.substring(end);
      const newPos = start + decoded.length;
      input.selectionStart = newPos;
      input.selectionEnd = newPos;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

async function handleSaveMember(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;

  if (typeof requireServerConnection === "function") {
    const isConnected = await requireServerConnection(editingMemberId ? "인원 정보 수정" : "신규 인원 추가");
    if (!isConnected) return;
  }

  // 현재 열려 있는 탭의 입력값을 _modalAffData에 즉시 저장
  saveFormIntoAffData(_activeModalAffKey);

  const name = document.getElementById("member-form-name").value.trim();
  const streamer = document.getElementById("member-form-streamer").value.trim();
  let avatar = document.getElementById("member-form-avatar").value.trim();
  let youtubeUrl = document.getElementById("member-form-youtube")?.value.trim() || "";
  try {
    youtubeUrl = decodeURIComponent(youtubeUrl);
  } catch (err) {}

  if (!name || !streamer) {
    alert("이름과 스트리머명을 모두 입력해주세요.");
    return;
  }

  const selectedAffiliations = getSelectedAffiliations();
  if (selectedAffiliations.length === 0) {
    alert("소속을 최소 하나 이상 선택해주세요 (경찰, EMS, 갱단 등).");
    return;
  }

  const defaultBadges = {
    police: "bg-blue-600",
    ems: "bg-teal-600",
    gang: "bg-red-600",
    business: "bg-amber-600",
    press: "bg-sky-600",
    citizen: "bg-purple-600",
    guide: "bg-emerald-600"
  };

  const allLocs = editingMemberId ? findAllMemberLocations(editingMemberId) : [];
  const existingMember = allLocs[0]?.member;

  // 소속별 정보(직위, 특공대직책, 활동상태, 뱃지색상, displayOrder)를 각 affiliation 객체에 주입
  selectedAffiliations.forEach(aff => {
    const k = getAffKey(aff.category, aff.subgroup);
    const d = _modalAffData[k] || {};
    aff.role = d.role || "";
    aff.swatRole = d.swatRole || "";
    aff.status = d.status || "active";
    aff.badgeColor = d.badgeColor || getDefaultBadgeForAffiliation(aff.category, aff.subgroup);

    // 기존 소속의 displayOrder 보존, 신규 추가 소속은 해당 소속 맨 뒤로 지정하여 기존 소속 위치가 바뀌지 않도록 보호
    if (existingMember) {
      const existingAff = (existingMember.affiliations || []).find(a => a.category === aff.category && (aff.subgroup ? a.subgroup === aff.subgroup : !a.subgroup));
      if (existingAff && existingAff.displayOrder != null) {
        aff.displayOrder = existingAff.displayOrder;
      } else {
        const targetCat = KONGBAP_DATA.categories.find(c => c.id === aff.category);
        if (targetCat) {
          if (targetCat.hasSubgroups && aff.subgroup) {
            const targetGroup = (targetCat.groups || []).find(g => g.id === aff.subgroup);
            aff.displayOrder = targetGroup?.members?.length ?? 9999;
          } else {
            aff.displayOrder = targetCat.members?.length ?? 9999;
          }
        } else {
          aff.displayOrder = 9999;
        }
      }
    } else {
      const targetCat = KONGBAP_DATA.categories.find(c => c.id === aff.category);
      if (targetCat) {
        if (targetCat.hasSubgroups && aff.subgroup) {
          const targetGroup = (targetCat.groups || []).find(g => g.id === aff.subgroup);
          aff.displayOrder = targetGroup?.members?.length ?? 0;
        } else {
          aff.displayOrder = targetCat.members?.length ?? 0;
        }
      } else {
        aff.displayOrder = 0;
      }
    }
  });

  // 대표(Primary) 소속: 현재 활성 탭 소속 우선, 없을 시 첫 번째 소속
  const primaryAff = selectedAffiliations.find(a => {
    if (a.category !== state.currentCategory) return false;
    if (state.currentGroup?.id) return a.subgroup === state.currentGroup.id;
    return true;
  }) || selectedAffiliations[0];

  const primaryKey = getAffKey(primaryAff.category, primaryAff.subgroup);
  const primaryData = _modalAffData[primaryKey] || {};

  if (!avatar || avatar.includes("images.unsplash.com")) {
    avatar = DEFAULT_AVATAR;
  }

  if (editingMemberId) {
    const allLocs = findAllMemberLocations(editingMemberId);
    if (allLocs.length === 0) {
      alert("수정할 인원 정보를 찾을 수 없습니다.");
      return;
    }

    const memberObj = allLocs[0].member;
    allLocs.forEach(loc => {
      const locCatId = loc.category.id;
      const locSubId = loc.category.hasSubgroups && loc.group ? loc.group.id : null;
      const aff = selectedAffiliations.find(a => a.category === locCatId && (locSubId ? a.subgroup === locSubId : !a.subgroup))
               || selectedAffiliations.find(a => a.category === locCatId)
               || primaryAff;
      const affKey = getAffKey(aff.category, aff.subgroup);
      const affData = _modalAffData[affKey] || aff;

      loc.member.name = name;
      loc.member.streamer = streamer;
      loc.member.role = affData.role || "";
      loc.member.swatRole = affData.swatRole || "";
      loc.member.status = affData.status || "active";
      loc.member.badgeColor = affData.badgeColor || getDefaultBadgeForAffiliation(locCatId, locSubId);
      loc.member.avatar = avatar;
      loc.member.youtubeUrl = youtubeUrl;
      loc.member.affiliations = selectedAffiliations;
      loc.member.category = locCatId;
      loc.member.subgroup = locSubId;
      if (aff.displayOrder != null) {
        loc.member.displayOrder = aff.displayOrder;
      }
    });

    // 1) 이전 소속 중 선택 해제된 곳에서 제거
    allLocs.forEach(loc => {
      const stillBelongs = selectedAffiliations.some(aff => {
        if (loc.category.hasSubgroups) {
          return aff.category === loc.category.id && aff.subgroup === loc.group?.id;
        } else {
          return aff.category === loc.category.id;
        }
      });

      if (!stillBelongs) {
        if (loc.category.hasSubgroups && loc.group) {
          loc.group.members = loc.group.members.filter(m => m.id !== memberObj.id);
        } else {
          loc.category.members = loc.category.members.filter(m => m.id !== memberObj.id);
        }
      }
    });

    // 2) 새로 선택된 소속에 아직 포함되지 않았으면 추가 (각 소속별 직위/직책/뱃지색상 격리 주입)
    selectedAffiliations.forEach(aff => {
      const cat = KONGBAP_DATA.categories.find(c => c.id === aff.category);
      if (!cat) return;

      const affKey = getAffKey(aff.category, aff.subgroup);
      const affData = _modalAffData[affKey] || aff;

      if (cat.hasSubgroups) {
        const group = (cat.groups || []).find(g => g.id === aff.subgroup) || cat.groups[0];
        if (group) {
          if (!group.members) group.members = [];
          if (!group.members.some(m => m.id === memberObj.id)) {
            const groupMember = {
              ...memberObj,
              role: affData.role || "",
              swatRole: affData.swatRole || "",
              status: affData.status || "active",
              badgeColor: affData.badgeColor || getDefaultBadgeForAffiliation(cat.id, group.id),
              category: cat.id,
              subgroup: group.id,
              affiliations: selectedAffiliations,
              displayOrder: aff.displayOrder ?? 0
            };
            group.members.push(groupMember);
          }
        }
      } else {
        if (!cat.members) cat.members = [];
        if (!cat.members.some(m => m.id === memberObj.id)) {
          const catMember = {
            ...memberObj,
            role: affData.role || "",
            swatRole: affData.swatRole || "",
            status: affData.status || "active",
            badgeColor: affData.badgeColor || getDefaultBadgeForAffiliation(cat.id, null),
            category: cat.id,
            subgroup: null,
            affiliations: selectedAffiliations,
            displayOrder: aff.displayOrder ?? 0
          };
          cat.members.push(catMember);
        }
      }
    });

    await saveStreamerToDb({
      id: memberObj.id,
      name,
      streamer,
      role: primaryData.role || "",
      swatRole: primaryData.swatRole || "",
      status: primaryData.status || "active",
      category: primaryAff.category,
      subgroup: primaryAff.subgroup || null,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor: primaryData.badgeColor || getDefaultBadgeForAffiliation(primaryAff.category, primaryAff.subgroup),
      avatar,
      youtubeUrl,
      subscriberCount: memberObj.subscriberCount || "",
      displayOrder: primaryAff.displayOrder != null ? primaryAff.displayOrder : (memberObj.displayOrder ?? 0)
    });

    if (typeof sortAllMembersByAffiliationOrder === "function") {
      sortAllMembersByAffiliationOrder();
    }
    persistData();
    updateStats();
    await createBackupSnapshot(`인원 수정: ${name} (${streamer}) - 소속 ${selectedAffiliations.length}개`);
    showToast(`✓ ${name} (${streamer}) 정보 수정 완료 (${selectedAffiliations.length}개 소속)`);
  } else {
    const newMember = {
      id: "m-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name,
      streamer,
      role: primaryData.role || "",
      swatRole: primaryData.swatRole || "",
      status: primaryData.status || "active",
      badgeColor: primaryData.badgeColor || getDefaultBadgeForAffiliation(primaryAff.category, primaryAff.subgroup),
      avatar,
      youtubeUrl,
      subscriberCount: "",
      displayOrder: primaryAff.displayOrder != null ? primaryAff.displayOrder : 0,
      category: primaryAff.category,
      subgroup: primaryAff.subgroup || null,
      videos: [],
      affiliations: selectedAffiliations
    };

    // 선택된 모든 소속에 새 멤버 추가 (각 소속별 직위/직책/뱃지색상 격리 주입)
    selectedAffiliations.forEach(aff => {
      const cat = KONGBAP_DATA.categories.find(c => c.id === aff.category);
      if (!cat) return;

      const affKey = getAffKey(aff.category, aff.subgroup);
      const affData = _modalAffData[affKey] || aff;

      const itemMember = {
        ...newMember,
        role: affData.role || "",
        swatRole: affData.swatRole || "",
        status: affData.status || "active",
        badgeColor: affData.badgeColor || getDefaultBadgeForAffiliation(aff.category, aff.subgroup),
        category: aff.category,
        subgroup: aff.subgroup || null,
        displayOrder: aff.displayOrder ?? 0
      };

      if (cat.hasSubgroups) {
        const group = (cat.groups || []).find(g => g.id === aff.subgroup) || cat.groups[0];
        if (group) {
          if (!group.members) group.members = [];
          group.members.push(itemMember);
        }
      } else {
        if (!cat.members) cat.members = [];
        cat.members.push(itemMember);
      }
    });

    await saveStreamerToDb({
      id: newMember.id,
      name,
      streamer,
      role: primaryData.role || "",
      swatRole: primaryData.swatRole || "",
      status: primaryData.status || "active",
      category: primaryAff.category,
      subgroup: primaryAff.subgroup || null,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor: primaryData.badgeColor || getDefaultBadgeForAffiliation(primaryAff.category, primaryAff.subgroup),
      avatar,
      youtubeUrl,
      subscriberCount: "",
      displayOrder: newMember.displayOrder
    });

    if (typeof sortAllMembersByAffiliationOrder === "function") {
      sortAllMembersByAffiliationOrder();
    }
    persistData();
    updateStats();
    await createBackupSnapshot(`인원 추가: ${name} (${streamer}) - 소속 ${selectedAffiliations.length}개`);
    showToast(`✓ 새 인원 '${name} (${streamer})' 등록 완료 (${selectedAffiliations.length}개 소속)`);
  }

  const targetMemId = editingMemberId || (typeof newMember !== 'undefined' ? newMember?.id : null);
  const targetMemberObj = editingMemberId ? (typeof memberObj !== 'undefined' ? memberObj : null) : (typeof newMember !== 'undefined' ? newMember : null);
  const isUrlChanged = !existingMember || (existingMember.youtubeUrl || "") !== youtubeUrl;

  if (youtubeUrl && targetMemId && targetMemberObj && (isUrlChanged || !targetMemberObj.subscriberCount)) {
    (async () => {
      try {
        if (typeof fetchMemberSubscriberFromYouTube === "function") {
          const countStr = await fetchMemberSubscriberFromYouTube(targetMemberObj);
          if (countStr) {
            KONGBAP_DATA.categories.forEach(cat => {
              if (cat.hasSubgroups) {
                (cat.groups || []).forEach(g => {
                  (g.members || []).forEach(m => {
                    if (m.id === targetMemId) m.subscriberCount = countStr;
                  });
                });
              } else {
                (cat.members || []).forEach(m => {
                  if (m.id === targetMemId) m.subscriberCount = countStr;
                });
              }
            });
            persistData();
            if (typeof renderContent === "function") renderContent();
            if (typeof saveStreamerToDb === "function") {
              saveStreamerToDb({ ...targetMemberObj, subscriberCount: countStr });
            }
          }
        }
      } catch (subErr) {
        console.warn("구독자/팔로워 자동 조회 실패:", subErr);
      }
    })();
  }

  closeMemberModal();
  renderContent();
}

let pendingDeleteMemberContext = null;

async function deleteMember(memberId) {
  if (!isAdmin()) return;

  if (typeof requireServerConnection === "function") {
    const isConnected = await requireServerConnection("인원 삭제");
    if (!isConnected) return;
  }

  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return;

  const member = allLocs[0].member;
  const affs = Array.isArray(member.affiliations) ? member.affiliations : [];
  const targetName = `${member.name} (${member.streamer})`;

  pendingDeleteMemberContext = {
    memberId,
    member,
    affs
  };

  const modal = document.getElementById("delete-member-modal");
  const targetNameEl = document.getElementById("delete-member-target-name");
  const passInput = document.getElementById("delete-member-password-input");
  const errorMsg = document.getElementById("delete-member-error-msg");
  const scopeContainer = document.getElementById("delete-member-scope-container");
  const scopeTabLabel = document.getElementById("delete-scope-tab-label");
  const scopeTabRadio = document.getElementById("delete-scope-tab");
  const scopeGlobalRadio = document.getElementById("delete-scope-global");
  const warningBox = document.getElementById("delete-member-global-warning");
  const passContainer = document.getElementById("delete-member-password-container");

  const curCat = getCurrentCategory();
  const curGroup = state.currentGroup;
  const tabName = curGroup ? `${curGroup.emoji || ''} ${curGroup.name}` : `${curCat.emoji || ''} ${curCat.name}`;

  if (modal) {
    if (targetNameEl) targetNameEl.textContent = `대상: ${targetName}`;
    if (passInput) passInput.value = "";
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.classList.add("hidden");
    }

    if (affs.length > 1) {
      // 겸직 인원: 소속 제외 vs 전체 삭제 선택 패널 표시
      if (scopeContainer) scopeContainer.classList.remove("hidden");
      if (scopeTabLabel) scopeTabLabel.textContent = `현재 소속([${tabName}])에서만 제외`;
      if (scopeTabRadio) scopeTabRadio.checked = true;
      if (scopeGlobalRadio) scopeGlobalRadio.checked = false;
      if (warningBox) warningBox.classList.add("hidden");
      if (passContainer) passContainer.classList.add("hidden");
    } else {
      // 단일 소속 인원: 전체 영구 삭제만 가능
      if (scopeContainer) scopeContainer.classList.add("hidden");
      if (warningBox) warningBox.classList.remove("hidden");
      if (passContainer) passContainer.classList.remove("hidden");
      if (passInput) setTimeout(() => passInput.focus(), 50);
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  } else {
    // Fallback prompt
    if (affs.length > 1) {
      const confirmRemove = confirm(`'${targetName}' 님은 여러 소속에 겸직 중입니다.\n\n현재 [${tabName}] 소속에서만 제외하시겠습니까?\n(취소를 누르면 전체 삭제 진행 여부를 묻습니다)`);
      if (confirmRemove) {
        executeRemoveMemberAffiliation(memberId, curCat.id, curGroup?.id);
        return;
      }
    }
    const inputPw = prompt(`⚠️ [인원 영구 삭제]\n'${targetName}' 인원을 DB에서 완전히 삭제하시겠습니까?\n\n진행하려면 관리자 비밀번호를 입력해주세요:`);
    if (inputPw === null) return;
    if (!inputPw.trim()) {
      alert("비밀번호를 입력해주세요.");
      return;
    }
    executeDeleteMember(memberId, inputPw.trim());
  }
}

function toggleDeletePasswordRequirement() {
  const isGlobal = !!document.getElementById("delete-scope-global")?.checked;
  const passContainer = document.getElementById("delete-member-password-container");
  const warningBox = document.getElementById("delete-member-global-warning");
  const passInput = document.getElementById("delete-member-password-input");

  if (isGlobal) {
    if (passContainer) passContainer.classList.remove("hidden");
    if (warningBox) warningBox.classList.remove("hidden");
    if (passInput) passInput.focus();
  } else {
    if (passContainer) passContainer.classList.add("hidden");
    if (warningBox) warningBox.classList.add("hidden");
  }
}
window.toggleDeletePasswordRequirement = toggleDeletePasswordRequirement;

function closeDeleteMemberModal() {
  const modal = document.getElementById("delete-member-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  pendingDeleteMemberContext = null;
}

async function handleConfirmDeleteMember(e) {
  if (e) e.preventDefault();
  if (!pendingDeleteMemberContext) return;

  if (typeof requireServerConnection === "function") {
    const isConnected = await requireServerConnection("인원 삭제");
    if (!isConnected) return;
  }

  const { memberId, member, affs } = pendingDeleteMemberContext;
  const isGlobalScope = !affs || affs.length <= 1 || !!document.getElementById("delete-scope-global")?.checked;

  if (!isGlobalScope) {
    // 1. 현재 탭 소속에서만 제외
    const curCat = getCurrentCategory();
    const curGroup = state.currentGroup;
    closeDeleteMemberModal();
    await executeRemoveMemberAffiliation(memberId, curCat.id, curGroup?.id);
    return;
  }

  // 2. 전체 DB 영구 삭제
  const passInput = document.getElementById("delete-member-password-input");
  const errorMsg = document.getElementById("delete-member-error-msg");
  const inputPw = passInput ? passInput.value.trim() : "";

  if (!inputPw) {
    if (errorMsg) {
      errorMsg.textContent = "비밀번호를 입력해주세요.";
      errorMsg.classList.remove("hidden");
    }
    return;
  }

  const success = await executeDeleteMember(memberId, inputPw);
  if (success) {
    closeDeleteMemberModal();
  } else {
    if (errorMsg) {
      errorMsg.textContent = "❌ 관리자 비밀번호가 올바르지 않거나 삭제에 실패했습니다.";
      errorMsg.classList.remove("hidden");
    }
    if (passInput) {
      passInput.focus();
      passInput.select();
    }
  }
}

async function executeRemoveMemberAffiliation(memberId, catId, groupId = null) {
  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return;

  const member = allLocs[0].member;
  const targetName = `${member.name} (${member.streamer})`;
  const cat = KONGBAP_DATA.categories.find(c => c.id === catId);
  const group = (cat?.groups || []).find(g => g.id === groupId);
  const tabLabel = group ? `${group.emoji || ''} ${group.name}` : `${cat?.emoji || ''} ${cat?.name || catId}`;

  // 현재 탭 소속 필터링 제외
  const currentAffs = Array.isArray(member.affiliations) ? member.affiliations : [];
  const remainingAffs = currentAffs.filter(a => {
    if (a.category !== catId) return true;
    if (groupId && a.subgroup !== groupId) return true;
    return false;
  });

  if (remainingAffs.length === 0) {
    alert("마지막 남은 소속입니다. 삭제하려면 '전체 소속 및 DB 영구 삭제'를 진행해주세요.");
    return;
  }

  // 현재 활성 카테고리/그룹에서 멤버 제거
  if (cat) {
    if (cat.hasSubgroups && group) {
      group.members = (group.members || []).filter(m => m.id !== memberId);
    } else {
      cat.members = (cat.members || []).filter(m => m.id !== memberId);
    }
  }

  member.affiliations = remainingAffs;
  const primaryAff = remainingAffs[0];
  member.category = primaryAff.category;
  member.subgroup = primaryAff.subgroup || null;
  if (primaryAff.role !== undefined) member.role = primaryAff.role;
  if (primaryAff.swatRole !== undefined) member.swatRole = primaryAff.swatRole;
  if (primaryAff.status !== undefined) member.status = primaryAff.status;
  if (primaryAff.badgeColor !== undefined) member.badgeColor = primaryAff.badgeColor;

  // DB 갱신
  await saveStreamerToDb({
    id: member.id,
    name: member.name,
    streamer: member.streamer,
    role: member.role || "",
    swatRole: member.swatRole || "",
    status: member.status || "active",
    category: primaryAff.category,
    subgroup: primaryAff.subgroup || null,
    affiliations: JSON.stringify(remainingAffs),
    badgeColor: member.badgeColor || "bg-blue-600",
    avatar: member.avatar,
    youtubeUrl: member.youtubeUrl,
    subscriberCount: member.subscriberCount || "",
    displayOrder: member.displayOrder ?? 0
  });

  if (state.currentMember?.id === memberId) {
    state.currentMember = null;
    if (typeof saveNavigationState === "function") saveNavigationState();
    if (typeof replaceNavHistory === "function") replaceNavHistory();
  }

  if (typeof sortAllMembersByAffiliationOrder === "function") {
    sortAllMembersByAffiliationOrder();
  }
  persistData();
  updateStats();
  await createBackupSnapshot(`소속 제외: ${targetName} - [${tabLabel}] 소속 제외 (잔여 ${remainingAffs.length}개)`);
  renderContent();
  showToast(`✓ '${targetName}' 인원이 [${tabLabel}] 소속에서 제외되었습니다.`);
}

async function executeDeleteMember(memberId, password = "") {
  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return false;

  const targetName = `${allLocs[0].member.name} (${allLocs[0].member.streamer})`;

  // 백엔드 DB 삭제 요청 및 관리자 비밀번호 검증
  const res = await deleteStreamerFromDb(memberId, password);
  if (!res || !res.success) {
    return false;
  }

  allLocs.forEach(loc => {
    if (!loc.category.hasSubgroups) {
      loc.category.members = loc.category.members.filter(m => m.id !== memberId);
    } else if (loc.group) {
      loc.group.members = loc.group.members.filter(m => m.id !== memberId);
    }
  });

  if (state.currentMember?.id === memberId) {
    state.currentMember = null;
    if (typeof saveNavigationState === "function") saveNavigationState();
    if (typeof replaceNavHistory === "function") replaceNavHistory();
  }

  persistData();
  updateStats();
  await createBackupSnapshot(`인원 삭제: ${targetName}`);
  renderContent();
  showToast(`🗑️ '${targetName}' 인원이 삭제되었습니다.`);
  return true;
}

function quickSetSwatRole(val) {
  const select = document.getElementById("member-form-swat-select");
  const input = document.getElementById("member-form-swat");
  if (select && input) {
    if (["", "특공대장", "특공대원", "서버장", "가이드", "정보부"].includes(val)) {
      select.value = val;
      input.value = val;
      input.classList.add("hidden");
    } else {
      select.value = "custom";
      input.value = val;
      input.classList.remove("hidden");
    }
  } else if (input) {
    input.value = val;
  }
}
window.quickSetSwatRole = quickSetSwatRole;

