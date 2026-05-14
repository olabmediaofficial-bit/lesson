const STORAGE_KEY = "guitarLessonRoom.blocks.v2";
const LEGACY_STORAGE_KEYS = ["guitarLessonRoom.blocks.v1", "guitarLessonRoom.v1"];
const DB_NAME = "guitarLessonRoomDB";
const DB_VERSION = 1;
const DB_STORE = "appState";
const DB_STATE_ID = "current";
const SERVER_STATE_ENDPOINT = "/api/state";
const SERVER_INFO_ENDPOINT = "/api/info";
const SERVER_LOGIN_ENDPOINT = "/api/login";
const SERVER_ROOM_ENDPOINT = "/api/room";
const ADMIN_TOKEN_KEY = "lessonRoomAdminToken";

const starterData = {
  resourceLibraryUrl: "",
  blocks: [
    {
      id: "blk-1",
      kind: "theory",
      title: "코드 만들기 이론",
      summary: "메이저 스케일의 1, 3, 5음을 쌓아 기본 3화음을 만드는 블럭.",
      tags: ["코드", "화성", "초급"],
      resources: ["chord-building.pdf"],
    },
    {
      id: "blk-2",
      kind: "theory",
      title: "CAGED로 지판 보기",
      summary: "오픈 코드 모양을 기준으로 같은 코드가 지판 위에서 반복되는 위치를 찾는다.",
      tags: ["지판", "코드", "중급"],
      resources: ["caged-system.pdf"],
    },
    {
      id: "blk-3",
      kind: "practice",
      title: "소문의 낙원",
      summary: "인트로 코드 전환과 8비트 스트로크를 끊기지 않게 연결한다.",
      tags: ["곡", "스트로크", "초급"],
      resources: ["somun-paradise.png"],
    },
    {
      id: "blk-4",
      kind: "practice",
      title: "Autumn Leaves 코드톤",
      summary: "2마디 단위로 3도와 7도를 연결하며 코드톤 라인을 만든다.",
      tags: ["재즈", "코드톤", "중급"],
      resources: ["autumn-leaves-leadsheet.pdf"],
    },
    {
      id: "blk-5",
      kind: "practice",
      title: "16비트 스트로크 패턴",
      summary: "다운업을 유지하면서 악센트 위치를 바꿔 리듬감을 만든다.",
      tags: ["리듬", "스트로크", "초급"],
      resources: ["https://lesson.example/16beat"],
    },
  ],
  students: [
    {
      id: "stu-1",
      name: "민준",
      level: "초급 / 스트로크",
      lessons: [
        {
          id: "les-1",
          date: "2026-05-12",
          memo: "코드 구성 원리를 짚고 소문의 낙원 인트로를 천천히 연결했다.",
          blockIds: ["blk-1", "blk-3"],
        },
      ],
    },
    {
      id: "stu-2",
      name: "서연",
      level: "중급 / 재즈",
      lessons: [
        {
          id: "les-2",
          date: "2026-05-10",
          memo: "Autumn Leaves 진행 위에서 코드톤 연결을 연습했다.",
          blockIds: ["blk-2", "blk-4"],
        },
      ],
    },
  ],
};

let state = structuredClone(starterData);
let currentView = "library";
let activeStudentId = state.students[0]?.id || "";
let activeShareStudentId = activeStudentId;
let activeKindFilter = "all";
let selectedBlockIds = new Set();
let pendingBlockIds = new Set();
let collapsedLessonIds = new Set();
let expandedLibraryBlockIds = new Set();
let editingLessonId = "";
let publicShareInitialized = false;
let publicShareMode = false;
let shareOrigin = "";
let metronome = {
  audioContext: null,
  timer: null,
  isPlaying: false,
  tempo: 90,
  meter: "4/4",
  beat: 0,
  visibleBeat: 0,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  viewTitle: $("#viewTitle"),
  navItems: document.querySelectorAll(".nav-item"),
  views: {
    library: $("#libraryView"),
    rooms: $("#roomsView"),
    share: $("#shareView"),
  },
  librarySearch: $("#librarySearch"),
  tagFilter: $("#tagFilter"),
  blockKindTabs: $("#blockKindTabs"),
  materialGrid: $("#materialGrid"),
  materialCount: $("#materialCount"),
  resourceLibraryUrl: $("#resourceLibraryUrl"),
  saveResourceLibrary: $("#saveResourceLibrary"),
  quickRoomList: $("#quickRoomList"),
  quickLessonDate: $("#quickLessonDate"),
  roomTabs: $("#roomTabs"),
  activeStudentName: $("#activeStudentName"),
  activeStudentLevel: $("#activeStudentLevel"),
  deleteStudent: $("#deleteStudent"),
  tempoSlider: $("#tempoSlider"),
  tempoInput: $("#tempoInput"),
  meterTabs: $("#meterTabs"),
  beatDots: $("#beatDots"),
  beatLabel: $("#beatLabel"),
  metronomeToggle: $("#metronomeToggle"),
  sharedMetronome: $("#sharedMetronome"),
  lessonDate: $("#lessonDate"),
  lessonMemo: $("#lessonMemo"),
  lessonTheoryPicker: $("#lessonTheoryPicker"),
  lessonPracticePicker: $("#lessonPracticePicker"),
  pendingMaterialList: $("#pendingMaterialList"),
  lessonList: $("#lessonList"),
  roomMaterialList: $("#roomMaterialList"),
  shareStudentPicker: $("#shareStudentPicker"),
  copyPreviewShareLink: $("#copyPreviewShareLink"),
  shareStudentName: $("#shareStudentName"),
  shareResourceLibrary: $("#shareResourceLibrary"),
  shareContent: $("#shareContent"),
  toast: $("#toast"),
  materialDialog: $("#materialDialog"),
  studentDialog: $("#studentDialog"),
  blockDialogTitle: $("#blockDialogTitle"),
  editingBlockId: $("#editingBlockId"),
  newFiles: $("#newFiles"),
  newAudioLink: $("#newAudioLink"),
  practiceFields: $("#practiceFields"),
  practiceTempo: $("#practiceTempo"),
  practiceKey: $("#practiceKey"),
  practiceBeat: $("#practiceBeat"),
  practiceCategories: document.querySelectorAll('input[name="practiceCategory"]'),
  practiceNoteTabs: $("#practiceNoteTabs"),
  practiceRightHand: $("#practiceRightHand"),
  practiceLeftHand: $("#practiceLeftHand"),
  practiceTechnique: $("#practiceTechnique"),
  appShell: $(".app-shell"),
  adminLogin: $("#adminLogin"),
  adminLoginForm: $("#adminLoginForm"),
  adminPassword: $("#adminPassword"),
  loginMessage: $("#loginMessage"),
};

function migrateState(data) {
  if (!data.blocks) return structuredClone(starterData);
  data.resourceLibraryUrl = data.resourceLibraryUrl || "";
  data.blocks = data.blocks.map((block) => ({
    ...block,
    resources: normalizeResources(block),
    audioLink: block.audioLink || "",
    practice: normalizePractice(block.practice),
  }));
  data.students = data.students.map((student) => ({
    ...student,
    lessons: student.lessons.map((lesson) => ({
      ...lesson,
      blockIds: lesson.blockIds || lesson.materialIds || [],
    })),
  }));
  return data;
}

function normalizePractice(practice = {}) {
  return {
    tempo: practice.tempo || "",
    key: practice.key || "",
    beat: practice.beat || "",
    categories: Array.isArray(practice.categories) ? practice.categories : [],
    rightHand: practice.rightHand || "",
    leftHand: practice.leftHand || "",
    technique: practice.technique || "",
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadIndexedState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(DB_STATE_ID);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveIndexedState(value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put({ id: DB_STATE_ID, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function loadLocalState() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  const saved = keys.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

async function loadPersistentState() {
  try {
    const response = await fetch(SERVER_STATE_ENDPOINT, {
      cache: "no-store",
      headers: authHeaders(),
    });
    if (response.status === 401) throw new Error("Unauthorized");
    if (response.ok) {
      const serverState = await response.json();
      if (serverState) return migrateState(serverState);
    }
  } catch (error) {
    console.warn("Server state unavailable, using browser storage.", error);
  }

  try {
    const indexed = await loadIndexedState();
    if (indexed) return migrateState(indexed);
  } catch (error) {
    console.warn("IndexedDB load failed, falling back to local data.", error);
  }

  const local = loadLocalState();
  return migrateState(local || structuredClone(starterData));
}

async function loadServerInfo() {
  try {
    const response = await fetch(SERVER_INFO_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return;
    const info = await response.json();
    shareOrigin = info.shareOrigin || "";
  } catch (error) {
    console.warn("Server info unavailable.", error);
  }
}

async function saveState() {
  try {
    const response = await fetch(SERVER_STATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(state),
    });
    if (response.status === 401) {
      showAdminLogin("다시 로그인해주세요.");
      return;
    }
    if (response.ok) {
      localStorage.setItem(`${STORAGE_KEY}.savedAt`, new Date().toISOString());
      return;
    }
  } catch (error) {
    console.warn("Server save unavailable, using browser storage.", error);
  }

  try {
    await saveIndexedState(state);
    localStorage.setItem(`${STORAGE_KEY}.savedAt`, new Date().toISOString());
  } catch (error) {
    console.warn("IndexedDB save failed, trying local fallback.", error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function authHeaders() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hasAdminToken() {
  return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY));
}

function showAdminLogin(message = "") {
  els.appShell.hidden = true;
  els.adminLogin.hidden = false;
  els.loginMessage.textContent = message;
}

function showAppShell() {
  els.adminLogin.hidden = true;
  els.appShell.hidden = false;
}

async function loadPublicRoomState(roomId) {
  const response = await fetch(`${SERVER_ROOM_ENDPOINT}?room=${encodeURIComponent(roomId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("공유 레슨룸을 찾을 수 없습니다.");
  return migrateState(await response.json());
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function getActiveStudent() {
  return state.students.find((student) => student.id === activeStudentId) || state.students[0];
}

function getBlock(id) {
  return state.blocks.find((block) => block.id === id);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeResources(block) {
  if (Array.isArray(block.resources)) return block.resources.filter(Boolean);
  return block.resource ? [block.resource] : [];
}

function resourceLabel(resource) {
  if (typeof resource === "object") return resource.name || "첨부 파일";
  return resource.split("/").pop() || resource;
}

function resourceHref(resource) {
  if (typeof resource === "object") return resource.data || "";
  return resource;
}

function resourceType(resource) {
  const name = resourceLabel(resource).toLowerCase();
  const href = resourceHref(resource).toLowerCase();
  if (href.startsWith("data:image/") || /\.(png|jpe?g|webp|gif)(\?.*)?$/.test(name) || /\.(png|jpe?g|webp|gif)(\?.*)?$/.test(href)) {
    return "image";
  }
  if (href.startsWith("data:application/pdf") || /\.pdf(\?.*)?$/.test(name) || /\.pdf(\?.*)?$/.test(href)) {
    return "pdf";
  }
  return "link";
}

function renderResources(block, mode = "compact") {
  const resources = normalizeResources(block);
  if (!resources.length) return "";

  return `
    <div class="resource-list ${mode}">
      ${resources
        .map((resource) => {
          const type = resourceType(resource);
          const href = escapeHTML(resourceHref(resource));
          const label = escapeHTML(resourceLabel(resource));
          if (type === "image") {
            return `
              <figure class="score-preview">
                <img src="${href}" alt="${label}" loading="lazy" />
                <figcaption>
                  <span>${label}</span>
                  <a class="resource-button image-download" href="${href}" download="${label}">다운로드</a>
                </figcaption>
              </figure>
            `;
          }
          if (type === "pdf") {
            return `<a class="resource-button" href="${href}" target="_blank" rel="noreferrer" download>${label} 열기</a>`;
          }
          return `<a class="resource-button ghost" href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
        })
        .join("")}
    </div>
  `;
}

function blockKindLabel(kind) {
  return kind === "theory" ? "이론" : "실습";
}

function blockKindClass(kind) {
  return kind === "theory" ? "theory" : "practice";
}

function uniqueLessonBlocks(student) {
  return [...new Set(student.lessons.flatMap((lesson) => lesson.blockIds))].map(getBlock).filter(Boolean);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function switchView(view) {
  if (publicShareMode && view !== "share") return;
  currentView = view;
  if (view === "share") activeShareStudentId = activeStudentId;

  const titles = {
    library: "블럭 보관소",
    rooms: "레슨룸",
    share: "공유 화면",
  };

  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  Object.entries(els.views).forEach(([key, node]) => node.classList.toggle("active", key === view));
  els.viewTitle.textContent = titles[view];
  render();
}

function render() {
  if (!els.quickLessonDate.value) els.quickLessonDate.value = today();
  if (!els.lessonDate.value) els.lessonDate.value = today();
  els.resourceLibraryUrl.value = state.resourceLibraryUrl || "";
  renderMetronome();
  renderTagFilter();
  renderLibrary();
  renderRoomChoices();
  renderRooms();
  renderShare();
}

function meterBeatCount() {
  return metronome.meter === "6/8" ? 6 : 4;
}

function renderMetronome() {
  els.tempoSlider.value = metronome.tempo;
  els.tempoInput.value = metronome.tempo;
  els.meterTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.meter === metronome.meter);
  });
  els.metronomeToggle.textContent = metronome.isPlaying ? "정지" : "재생";
  els.metronomeToggle.classList.toggle("playing", metronome.isPlaying);
  els.beatDots.innerHTML = Array.from({ length: meterBeatCount() }, (_, index) => {
    const active = metronome.isPlaying && index === metronome.visibleBeat;
    const downbeat = index === 0;
    return `<span class="${active ? "active" : ""} ${downbeat ? "downbeat" : ""}"></span>`;
  }).join("");
  els.beatLabel.textContent = metronome.isPlaying ? `${metronome.visibleBeat + 1} / ${meterBeatCount()}` : "준비";
}

function setTempo(value) {
  const nextTempo = Math.min(220, Math.max(40, Number(value) || 90));
  metronome.tempo = nextTempo;
  if (metronome.isPlaying) restartMetronome();
  renderMetronome();
}

function setMeter(value) {
  metronome.meter = value;
  metronome.beat = 0;
  metronome.visibleBeat = 0;
  if (metronome.isPlaying) restartMetronome();
  renderMetronome();
}

function playClick(isDownbeat) {
  if (!metronome.audioContext) return;
  const now = metronome.audioContext.currentTime;
  const oscillator = metronome.audioContext.createOscillator();
  const gain = metronome.audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = isDownbeat ? 1320 : 880;
  gain.gain.setValueAtTime(isDownbeat ? 0.22 : 0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  oscillator.connect(gain);
  gain.connect(metronome.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.06);
}

function tickMetronome() {
  const beat = metronome.beat;
  metronome.visibleBeat = beat;
  playClick(beat === 0);
  renderMetronome();
  metronome.beat = (beat + 1) % meterBeatCount();
}

async function startMetronome() {
  if (!metronome.audioContext) {
    metronome.audioContext = new AudioContext();
  }
  if (metronome.audioContext.state === "suspended") {
    await metronome.audioContext.resume();
  }
  metronome.isPlaying = true;
  metronome.beat = 0;
  metronome.visibleBeat = 0;
  tickMetronome();
  metronome.timer = window.setInterval(tickMetronome, 60000 / metronome.tempo);
  renderMetronome();
}

function stopMetronome() {
  window.clearInterval(metronome.timer);
  metronome.timer = null;
  metronome.isPlaying = false;
  metronome.beat = 0;
  metronome.visibleBeat = 0;
  renderMetronome();
}

function restartMetronome() {
  if (!metronome.isPlaying) return;
  window.clearInterval(metronome.timer);
  metronome.timer = window.setInterval(tickMetronome, 60000 / metronome.tempo);
}

function renderTagFilter() {
  const selected = els.tagFilter.value || "all";
  const tags = [...new Set(state.blocks.flatMap((block) => block.tags))].sort();
  els.tagFilter.innerHTML = [
    `<option value="all">전체 태그</option>`,
    ...tags.map((tag) => `<option value="${tag}">${tag}</option>`),
  ].join("");
  els.tagFilter.value = tags.includes(selected) ? selected : "all";
}

function filteredBlocks() {
  const query = els.librarySearch.value.trim().toLowerCase();
  const tag = els.tagFilter.value;
  return state.blocks.filter((block) => {
    const practice = normalizePractice(block.practice);
    const haystack = [
      block.title,
      block.summary,
      practice.rightHand,
      practice.leftHand,
      practice.technique,
      practice.categories.join(" "),
      normalizeResources(block).map(resourceLabel).join(" "),
      blockKindLabel(block.kind),
      ...block.tags,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesTag = tag === "all" || block.tags.includes(tag);
    const matchesKind = activeKindFilter === "all" || block.kind === activeKindFilter;
    return matchesQuery && matchesTag && matchesKind;
  });
}

function renderLibrary() {
  els.blockKindTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.kindFilter === activeKindFilter);
  });

  const blocks = filteredBlocks();
  els.materialCount.textContent = blocks.length;

  if (!blocks.length) {
    els.materialGrid.innerHTML = `<div class="empty">조건에 맞는 블럭이 없습니다.</div>`;
    return;
  }

  const grouped = activeKindFilter === "practice" ? renderPracticeCategoryGroups(blocks) : renderKindGroups(blocks);

  els.materialGrid.innerHTML = grouped;
}

function renderKindGroups(blocks) {
  return ["theory", "practice"]
    .map((kind) => {
      const group = blocks.filter((block) => block.kind === kind);
      if (!group.length) return "";
      return renderBlockGroup(`${blockKindLabel(kind)} 블럭 모음`, group);
    })
    .join("");
}

function renderPracticeCategoryGroups(blocks) {
  const practiceBlocks = blocks.filter((block) => block.kind === "practice");
  const categories = ["가요", "찬양", "재즈", "그외"];
  return categories
    .map((category) => {
      const group = practiceBlocks.filter((block) => {
        const blockCategories = normalizePractice(block.practice).categories;
        if (category === "그외") return !blockCategories.length || blockCategories.includes(category);
        return blockCategories.includes(category);
      });
      if (!group.length) return "";
      return renderBlockGroup(`${category} 블럭 모음`, group);
    })
    .join("");
}

function renderBlockGroup(title, blocks) {
  return `
    <section class="block-section">
      <div class="block-section-head">
        <h3>${escapeHTML(title)}</h3>
        <div class="block-section-actions">
          <button class="secondary-button mini-button" type="button" data-collapse-block-group="${blocks.map((block) => block.id).join(",")}">전체 접기</button>
          <button class="secondary-button mini-button" type="button" data-expand-block-group="${blocks.map((block) => block.id).join(",")}">전체 펼치기</button>
        </div>
      </div>
      <div class="material-grid inner-grid">
        ${blocks.map(renderBlockCard).join("")}
      </div>
    </section>
  `;
}

function renderBlockCard(block) {
  const expanded = expandedLibraryBlockIds.has(block.id);
  return `
    <article class="material-card block-card ${expanded ? "expanded" : "collapsed"}">
      <div class="block-card-head">
        <input type="checkbox" data-block-check="${block.id}" ${selectedBlockIds.has(block.id) ? "checked" : ""} aria-label="${escapeHTML(block.title)} 선택" />
        <button class="block-title-button" type="button" data-toggle-library-block="${block.id}" aria-expanded="${expanded}">
          <span class="block-title-text">${escapeHTML(block.title)}</span>
          <span class="collapse-indicator">${expanded ? "접기" : "펼치기"}</span>
          <span class="block-card-data">
            <span class="material-type ${blockKindClass(block.kind)}">${blockKindLabel(block.kind)}</span>
            ${renderPracticeCategoryText(block)}
            <span class="material-meta">${normalizeResources(block).length}개 첨부</span>
          </span>
        </button>
        <div class="block-card-actions">
          <button class="secondary-button mini-button" type="button" data-edit-block="${block.id}">편집</button>
          <button class="secondary-button mini-button danger" type="button" data-delete-block="${block.id}">삭제</button>
        </div>
      </div>
      <div class="block-card-body">
        ${renderPracticeMeta(block)}
        <p>${escapeHTML(block.summary)}</p>
        ${renderPracticeDetails(block)}
        <div class="tag-row">${block.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
        ${renderResources(block, "compact")}
      </div>
    </article>
  `;
}

function renderPracticeCategoryText(block) {
  if (block.kind !== "practice") return "";
  const categories = normalizePractice(block.practice).categories;
  if (!categories.length) return "";
  return `<span class="material-meta">${categories.map(escapeHTML).join(" · ")}</span>`;
}

function renderRoomChoices() {
  if (!state.students.length) {
    els.quickRoomList.innerHTML = `<div class="empty">학생을 먼저 추가하세요.</div>`;
    return;
  }

  els.quickRoomList.innerHTML = state.students
    .map((student) => {
      const blockCount = uniqueLessonBlocks(student).length;
      return `
        <button class="chip-button" type="button" data-assign-room="${student.id}">
          <span>${student.name}</span>
          <small>${blockCount}개</small>
        </button>
      `;
    })
    .join("");
}

function renderRooms() {
  if (!state.students.length) {
    els.roomTabs.innerHTML = "";
    els.activeStudentName.textContent = "학생 없음";
    els.activeStudentLevel.textContent = "Student";
    els.deleteStudent.disabled = true;
    els.lessonList.innerHTML = `<div class="empty">학생을 추가하면 레슨룸이 만들어집니다.</div>`;
    els.roomMaterialList.innerHTML = "";
    return;
  }

  if (!getActiveStudent()) activeStudentId = state.students[0].id;
  const student = getActiveStudent();

  els.roomTabs.innerHTML = state.students
    .map(
      (item) => `
        <button type="button" class="${item.id === student.id ? "active" : ""}" data-student-tab="${item.id}">
          ${item.name}
        </button>
      `,
    )
    .join("");

  els.activeStudentName.textContent = `${student.name}'s 레슨룸`;
  els.activeStudentLevel.textContent = student.level || "Student";
  els.deleteStudent.disabled = false;
  renderLessonPicker();
  renderRoomBlocks(student);
  renderLessonList(student);
}

function renderLessonPicker() {
  renderKindPicker(els.lessonTheoryPicker, "theory");
  renderKindPicker(els.lessonPracticePicker, "practice");

  const pending = [...pendingBlockIds].map(getBlock).filter(Boolean);
  els.pendingMaterialList.innerHTML = pending.length
    ? pending.map((block) => `<span class="tag ${blockKindClass(block.kind)}">${blockKindLabel(block.kind)} · ${block.title}</span>`).join("")
    : `<span class="material-meta">아직 붙인 블럭이 없습니다.</span>`;
}

function renderKindPicker(picker, kind) {
  const available = state.blocks.filter((block) => block.kind === kind && !pendingBlockIds.has(block.id));
  picker.innerHTML = available
    .map((block) => `<option value="${block.id}">${escapeHTML(block.title)}</option>`)
    .join("");
  picker.disabled = !available.length;
}

function renderRoomBlocks(student) {
  const blocks = uniqueLessonBlocks(student);
  if (!blocks.length) {
    els.roomMaterialList.innerHTML = `<div class="empty">아직 배정된 블럭이 없습니다.</div>`;
    return;
  }

  els.roomMaterialList.innerHTML = blocks
    .map(
      (block) => `
        <div class="mini-item">
          <span class="material-type ${blockKindClass(block.kind)}">${blockKindLabel(block.kind)}</span>
          <strong>${escapeHTML(block.title)}</strong>
          <span class="material-meta">${block.tags.map(escapeHTML).join(", ")}</span>
        </div>
      `,
    )
    .join("");
}

function renderLessonList(student) {
  const lessons = [...student.lessons].sort((a, b) => b.date.localeCompare(a.date));
  if (!lessons.length) {
    els.lessonList.innerHTML = `<div class="empty">첫 수업 날짜에 블럭을 넣어보세요.</div>`;
    return;
  }

  els.lessonList.innerHTML = lessons
    .map((lesson) => {
      const blocks = lesson.blockIds.map(getBlock).filter(Boolean);
      const collapsed = collapsedLessonIds.has(lesson.id);
      const editing = editingLessonId === lesson.id;
      return `
        <article class="lesson-card" data-lesson-id="${lesson.id}">
          <button class="lesson-toggle" type="button" data-toggle-lesson="${lesson.id}" aria-expanded="${!collapsed}">
            <span>${collapsed ? "펼치기" : "접기"}</span>
            <time>${formatDate(lesson.date)}</time>
            ${lesson.memo ? `<em>${escapeHTML(lesson.memo)}</em>` : ""}
            <small>${blocks.length}개 블럭</small>
          </button>
          <div class="lesson-body ${collapsed ? "collapsed" : ""}">
            ${editing ? renderLessonEditForm(lesson) : renderLessonViewTools(lesson)}
            ${lesson.memo ? `<p>${escapeHTML(lesson.memo)}</p>` : ""}
            <div class="lesson-blocks" data-lesson-drop-zone="${lesson.id}">
              ${blocks.map((block, index) => renderLessonBlock(block, { lessonId: lesson.id, index, total: blocks.length, controls: true })).join("")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLessonViewTools(lesson) {
  return `
    <div class="lesson-edit-actions">
      <button class="secondary-button mini-button" type="button" data-edit-lesson="${lesson.id}">일지 수정</button>
    </div>
  `;
}

function renderLessonEditForm(lesson) {
  const availableBlocks = state.blocks.filter((block) => !lesson.blockIds.includes(block.id));
  return `
    <div class="lesson-edit-form">
      <input type="date" value="${escapeHTML(lesson.date)}" data-edit-lesson-date="${lesson.id}" aria-label="수업 날짜 수정" />
      <textarea rows="3" data-edit-lesson-memo="${lesson.id}" placeholder="오늘 수업 메모 또는 다음 과제">${escapeHTML(lesson.memo || "")}</textarea>
      <div class="composer-actions">
        <select data-edit-lesson-block-picker="${lesson.id}" aria-label="추가할 블럭 선택" ${availableBlocks.length ? "" : "disabled"}>
          ${availableBlocks.map((block) => `<option value="${block.id}">[${blockKindLabel(block.kind)}] ${escapeHTML(block.title)}</option>`).join("")}
        </select>
        <button class="secondary-button" type="button" data-add-edit-lesson-block="${lesson.id}" ${availableBlocks.length ? "" : "disabled"}>블럭 추가</button>
        <button class="primary-button" type="button" data-save-edit-lesson="${lesson.id}">수정 저장</button>
        <button class="secondary-button" type="button" data-cancel-edit-lesson="${lesson.id}">취소</button>
      </div>
    </div>
  `;
}

function renderLessonBlock(block, options = {}) {
  const { lessonId = "", index = 0, total = 1, controls = false } = options;
  return `
    <div class="lesson-block ${blockKindClass(block.kind)}" ${controls ? `draggable="true" data-draggable-block="${block.id}" data-lesson-id="${lessonId}"` : ""}>
      <div class="lesson-block-head">
        <span class="material-type ${blockKindClass(block.kind)}">${blockKindLabel(block.kind)}</span>
        ${
          controls
            ? `<div class="block-controls">
                <span class="drag-handle" title="드래그해서 순서 바꾸기">↕</span>
                <button class="icon-button tiny-button" type="button" data-move-block="${block.id}" data-lesson-id="${lessonId}" data-direction="up" ${index === 0 ? "disabled" : ""} title="위로">↑</button>
                <button class="icon-button tiny-button" type="button" data-move-block="${block.id}" data-lesson-id="${lessonId}" data-direction="down" ${index === total - 1 ? "disabled" : ""} title="아래로">↓</button>
                <button class="icon-button tiny-button danger" type="button" data-remove-lesson-block="${block.id}" data-lesson-id="${lessonId}" title="수업에서 빼기">×</button>
              </div>`
            : ""
        }
      </div>
      <strong>${escapeHTML(block.title)}</strong>
      ${renderPracticeMeta(block)}
      <p>${escapeHTML(block.summary)}</p>
      ${renderPracticeDetails(block)}
      ${block.audioLink ? `<p class="audio-link">노래 듣기 : <a href="${escapeHTML(block.audioLink)}" target="_blank" rel="noreferrer">${escapeHTML(block.audioLink)}</a></p>` : ""}
      ${renderResources(block, "expanded")}
    </div>
  `;
}

function renderPracticeMeta(block) {
  if (block.kind !== "practice") return "";
  const practice = block.practice || {};
  const items = [
    ...(practice.categories || []),
    practice.tempo ? `${escapeHTML(practice.tempo)} BPM` : "",
    practice.key ? `${escapeHTML(practice.key)} key` : "",
    practice.beat ? `${practice.beat === "other" ? "그 외" : escapeHTML(practice.beat)} 비트` : "",
  ].filter(Boolean);
  if (!items.length) return "";
  return `<div class="practice-meta">${items.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

function renderPracticeDetails(block) {
  if (block.kind !== "practice") return "";
  const practice = normalizePractice(block.practice);
  const items = [
    ["왼손(사운드)", practice.leftHand],
    ["오른손(리듬)", practice.rightHand],
    ["테크닉", practice.technique],
  ].filter(([, value]) => value);
  if (!items.length) return "";
  return `
    <div class="practice-detail-list">
      ${items
        .map(
          ([label, value]) => `
            <span class="practice-detail-pill"><strong>${label}</strong> ${escapeHTML(value)}</span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderShare() {
  if (!state.students.length) {
    els.shareStudentPicker.innerHTML = "";
    els.shareStudentName.textContent = "공유할 레슨룸 없음";
    els.shareContent.innerHTML = `<div class="empty">학생을 추가하면 공유 화면을 볼 수 있습니다.</div>`;
    return;
  }

  const selectedShareId = activeShareStudentId || activeStudentId || state.students[0].id;
  const student = state.students.find((item) => item.id === selectedShareId) || state.students[0];
  activeShareStudentId = student.id;

  if (publicShareMode) {
    els.shareStudentPicker.hidden = true;
    els.copyPreviewShareLink.hidden = true;
    els.sharedMetronome.hidden = false;
    if (!publicShareInitialized) {
      collapsedLessonIds = new Set(student.lessons.map((lesson) => lesson.id));
      publicShareInitialized = true;
    }
  } else {
    els.shareStudentPicker.hidden = false;
    els.copyPreviewShareLink.hidden = false;
    els.sharedMetronome.hidden = true;
    els.shareStudentPicker.innerHTML = state.students
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join("");
    els.shareStudentPicker.value = student.id;
  }
  els.shareStudentName.textContent = `${student.name}'s 레슨룸`;
  renderShareResourceLibrary();

  const lessons = [...student.lessons]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((lesson) => {
      const blocks = lesson.blockIds.map(getBlock).filter(Boolean);
      const collapsed = collapsedLessonIds.has(lesson.id);
      return `
        <article class="lesson-card">
          <button class="lesson-toggle" type="button" data-toggle-lesson="${lesson.id}" aria-expanded="${!collapsed}">
            <span>${collapsed ? "펼치기" : "접기"}</span>
            <time>${formatDate(lesson.date)}</time>
            ${lesson.memo ? `<em>${escapeHTML(lesson.memo)}</em>` : ""}
            <small>${blocks.length}개 블럭</small>
          </button>
          <div class="lesson-body ${collapsed ? "collapsed" : ""}">
            ${lesson.memo ? `<p>${escapeHTML(lesson.memo)}</p>` : ""}
            <div class="lesson-blocks">${blocks.map((block) => renderLessonBlock(block, { controls: false })).join("")}</div>
          </div>
        </article>
      `;
    })
    .join("");

  els.shareContent.innerHTML = `
    <section class="share-section">
      <h3>날짜별 수업 내용</h3>
      ${lessons || `<div class="empty">아직 수업 기록이 없습니다.</div>`}
    </section>
  `;
}

function renderShareResourceLibrary() {
  const url = state.resourceLibraryUrl || "";
  els.shareResourceLibrary.hidden = !url;
  if (!url) return;
  els.shareResourceLibrary.href = url;
}

function upsertLesson(student, date, blockIds, memo = "") {
  const lesson = student.lessons.find((item) => item.date === date);
  if (lesson) {
    lesson.blockIds = [...new Set([...lesson.blockIds, ...blockIds])];
    if (memo) lesson.memo = memo;
    return lesson;
  }

  const newLesson = {
    id: uid("les"),
    date,
    memo,
    blockIds: [...new Set(blockIds)],
  };
  student.lessons.unshift(newLesson);
  return newLesson;
}

async function assignSelectedToStudent(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  const ids = [...selectedBlockIds];
  const date = els.quickLessonDate.value || today();
  if (!student || !ids.length) {
    showToast("먼저 블럭을 선택하세요.");
    return;
  }

  upsertLesson(student, date, ids);
  activeStudentId = student.id;
  selectedBlockIds.clear();
  await saveState();
  render();
  showToast(`${student.name}의 ${formatDate(date)} 수업에 블럭을 넣었습니다.`);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) switchView(nav.dataset.view);

  const kind = event.target.closest("[data-kind-filter]");
  if (kind) {
    activeKindFilter = kind.dataset.kindFilter;
    renderLibrary();
  }

  const assignRoom = event.target.closest("[data-assign-room]");
  if (assignRoom) assignSelectedToStudent(assignRoom.dataset.assignRoom);

  const studentTab = event.target.closest("[data-student-tab]");
  if (studentTab) {
    activeStudentId = studentTab.dataset.studentTab;
    pendingBlockIds.clear();
    render();
  }

  const editBlock = event.target.closest("[data-edit-block]");
  if (editBlock) openBlockDialog(editBlock.dataset.editBlock);

  const deleteBlock = event.target.closest("[data-delete-block]");
  if (deleteBlock) deleteBlockById(deleteBlock.dataset.deleteBlock);

  const collapseBlockGroup = event.target.closest("[data-collapse-block-group]");
  if (collapseBlockGroup) {
    collapseBlockGroup.dataset.collapseBlockGroup.split(",").filter(Boolean).forEach((id) => expandedLibraryBlockIds.delete(id));
    renderLibrary();
  }

  const expandBlockGroup = event.target.closest("[data-expand-block-group]");
  if (expandBlockGroup) {
    expandBlockGroup.dataset.expandBlockGroup.split(",").filter(Boolean).forEach((id) => expandedLibraryBlockIds.add(id));
    renderLibrary();
  }

  const libraryBlockToggle = event.target.closest("[data-toggle-library-block]");
  if (libraryBlockToggle) {
    const id = libraryBlockToggle.dataset.toggleLibraryBlock;
    if (expandedLibraryBlockIds.has(id)) expandedLibraryBlockIds.delete(id);
    else expandedLibraryBlockIds.add(id);
    renderLibrary();
  }

  const moveBlock = event.target.closest("[data-move-block]");
  if (moveBlock) moveLessonBlock(moveBlock.dataset.lessonId, moveBlock.dataset.moveBlock, moveBlock.dataset.direction);

  const removeLessonBlock = event.target.closest("[data-remove-lesson-block]");
  if (removeLessonBlock) removeBlockFromLesson(removeLessonBlock.dataset.lessonId, removeLessonBlock.dataset.removeLessonBlock);

  const editLesson = event.target.closest("[data-edit-lesson]");
  if (editLesson) {
    editingLessonId = editLesson.dataset.editLesson;
    collapsedLessonIds.delete(editingLessonId);
    renderLessonList(getActiveStudent());
  }

  const cancelEditLesson = event.target.closest("[data-cancel-edit-lesson]");
  if (cancelEditLesson) {
    editingLessonId = "";
    renderLessonList(getActiveStudent());
  }

  const addEditLessonBlock = event.target.closest("[data-add-edit-lesson-block]");
  if (addEditLessonBlock) addBlockToEditingLesson(addEditLessonBlock.dataset.addEditLessonBlock);

  const saveEditLesson = event.target.closest("[data-save-edit-lesson]");
  if (saveEditLesson) saveEditingLesson(saveEditLesson.dataset.saveEditLesson);

  const lessonToggle = event.target.closest("[data-toggle-lesson]");
  if (lessonToggle) {
    const id = lessonToggle.dataset.toggleLesson;
    if (collapsedLessonIds.has(id)) collapsedLessonIds.delete(id);
    else collapsedLessonIds.add(id);
    render();
  }
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-block-check]");
  if (checkbox) {
    if (checkbox.checked) selectedBlockIds.add(checkbox.dataset.blockCheck);
    else selectedBlockIds.delete(checkbox.dataset.blockCheck);
  }
});

document.addEventListener("dragstart", (event) => {
  const block = event.target.closest("[data-draggable-block]");
  if (!block) return;
  block.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      lessonId: block.dataset.lessonId,
      blockId: block.dataset.draggableBlock,
    }),
  );
});

document.addEventListener("dragover", (event) => {
  const zone = event.target.closest("[data-lesson-drop-zone]");
  if (!zone) return;
  event.preventDefault();
  const dragging = document.querySelector(".lesson-block.dragging");
  if (!dragging) return;
  const afterElement = getDragAfterElement(zone, event.clientY);
  if (afterElement) zone.insertBefore(dragging, afterElement);
  else zone.appendChild(dragging);
});

document.addEventListener("drop", async (event) => {
  const zone = event.target.closest("[data-lesson-drop-zone]");
  if (!zone) return;
  event.preventDefault();
  const payload = safeJsonParse(event.dataTransfer.getData("text/plain"));
  if (!payload || payload.lessonId !== zone.dataset.lessonDropZone) return;
  await reorderLessonBlocksFromDom(payload.lessonId, zone);
});

document.addEventListener("dragend", () => {
  document.querySelectorAll(".lesson-block.dragging").forEach((node) => node.classList.remove("dragging"));
});

els.views.library.addEventListener("dragenter", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  els.views.library.classList.add("file-drop-active");
});

els.views.library.addEventListener("dragover", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
});

els.views.library.addEventListener("dragleave", (event) => {
  if (els.views.library.contains(event.relatedTarget)) return;
  els.views.library.classList.remove("file-drop-active");
});

els.views.library.addEventListener("drop", async (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  els.views.library.classList.remove("file-drop-active");
  await createBlocksFromDroppedFiles([...event.dataTransfer.files]);
});

els.librarySearch.addEventListener("input", renderLibrary);
els.tagFilter.addEventListener("change", renderLibrary);
els.saveResourceLibrary.addEventListener("click", async () => {
  state.resourceLibraryUrl = els.resourceLibraryUrl.value.trim();
  await saveState();
  renderShare();
  showToast("레슨 자료실 링크를 저장했습니다.");
});
els.shareStudentPicker.addEventListener("change", () => {
  activeShareStudentId = els.shareStudentPicker.value;
  renderShare();
});
els.tempoSlider.addEventListener("input", (event) => setTempo(event.target.value));
els.tempoInput.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  if (value >= 40 && value <= 220) setTempo(value);
});
els.tempoInput.addEventListener("change", (event) => setTempo(event.target.value));
els.meterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-meter]");
  if (button) setMeter(button.dataset.meter);
});
els.metronomeToggle.addEventListener("click", async () => {
  if (metronome.isPlaying) {
    stopMetronome();
    return;
  }
  await startMetronome();
});
els.adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginMessage.textContent = "";

  try {
    const response = await fetch(SERVER_LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: els.adminPassword.value }),
    });
    if (!response.ok) {
      els.loginMessage.textContent = "비밀번호가 맞지 않습니다.";
      return;
    }
    const result = await response.json();
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    els.adminPassword.value = "";
    showAppShell();
    await init();
  } catch (error) {
    console.error(error);
    els.loginMessage.textContent = "로그인 요청에 실패했습니다.";
  }
});
$("#newType").addEventListener("change", updatePracticeFieldsVisibility);
els.practiceNoteTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-practice-note-tab]");
  if (tab) activatePracticeNoteTab(tab.dataset.practiceNoteTab);
});

$("#assignSelected").addEventListener("click", () => {
  const student = getActiveStudent();
  if (student) assignSelectedToStudent(student.id);
});

$("#openQuickAdd").addEventListener("click", () => openBlockDialog());

function openBlockDialog(blockId = "") {
  const block = blockId ? getBlock(blockId) : null;
  const practice = normalizePractice(block?.practice);
  els.blockDialogTitle.textContent = block ? "블럭 편집" : "블럭 추가";
  els.editingBlockId.value = block?.id || "";
  $("#newTitle").value = block?.title || "";
  $("#newType").value = block?.kind || "theory";
  $("#newSummary").value = block?.summary || "";
  $("#newTags").value = block?.tags?.join(", ") || "";
  $("#newResources").value = block ? normalizeResources(block).filter((resource) => typeof resource === "string").join("\n") : "";
  els.newAudioLink.value = block?.audioLink || "";
  els.practiceTempo.value = practice.tempo || "";
  els.practiceKey.value = practice.key || "";
  els.practiceBeat.value = practice.beat || "";
  els.practiceCategories.forEach((checkbox) => {
    checkbox.checked = practice.categories.includes(checkbox.value);
  });
  els.practiceRightHand.value = practice.rightHand || "";
  els.practiceLeftHand.value = practice.leftHand || "";
  els.practiceTechnique.value = practice.technique || "";
  els.newFiles.value = "";
  activatePracticeNoteTab("leftHand");
  updatePracticeFieldsVisibility();
  els.materialDialog.showModal();
}

function updatePracticeFieldsVisibility() {
  els.practiceFields.hidden = $("#newType").value !== "practice";
}

function activatePracticeNoteTab(activeTab) {
  els.practiceNoteTabs.querySelectorAll("[data-practice-note-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.practiceNoteTab === activeTab);
  });
  document.querySelectorAll("[data-practice-note-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.practiceNotePanel === activeTab);
  });
}

function readFileAsResource(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function hasDraggedFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

function fileNameWithoutExtension(name) {
  return name.replace(/\.[^/.]+$/, "") || name;
}

function droppedFileBlockKind() {
  if (activeKindFilter === "theory" || activeKindFilter === "practice") return activeKindFilter;
  return "";
}

async function createBlocksFromDroppedFiles(files) {
  const kind = droppedFileBlockKind();
  const acceptedFiles = files.filter((file) => /^(image\/png|image\/jpeg|application\/pdf)$/.test(file.type));

  if (!kind) {
    showToast("이론 또는 실습 버튼을 누른 상태에서 파일을 넣어주세요.");
    return;
  }
  if (!acceptedFiles.length) {
    showToast("PNG, JPG, PDF 파일만 블럭으로 만들 수 있습니다.");
    return;
  }

  try {
    const resources = await Promise.all(acceptedFiles.map(readFileAsResource));
    const blocks = resources.map((resource) => ({
      id: uid("blk"),
      title: fileNameWithoutExtension(resource.name),
      kind,
      summary: "",
      tags: [],
      audioLink: "",
      practice: normalizePractice(),
      resources: [resource],
    }));
    state.blocks = [...blocks, ...state.blocks];
    await saveState();
    blocks.forEach((block) => expandedLibraryBlockIds.add(block.id));
    render();
    showToast(`${blocks.length}개 ${blockKindLabel(kind)} 블럭을 만들었습니다.`);
  } catch (error) {
    console.error(error);
    showToast("파일을 블럭으로 만드는 중 문제가 생겼습니다.");
  }
}

$("#materialForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.submitter?.value === "cancel") {
    els.materialDialog.close();
    event.target.reset();
    return;
  }

  const saveButton = $("#saveMaterial");
  saveButton.disabled = true;

  try {
    const editingId = els.editingBlockId.value;
    const existing = editingId ? getBlock(editingId) : null;
    const linkResources = $("#newResources").value.split("\n").map((item) => item.trim()).filter(Boolean);
    const keptFileResources = existing ? normalizeResources(existing).filter((resource) => typeof resource === "object") : [];
    const fileResources = await Promise.all([...els.newFiles.files].map(readFileAsResource));
    const block = {
      id: editingId || uid("blk"),
      title: $("#newTitle").value.trim() || "제목 없는 블럭",
      kind: $("#newType").value,
      summary: $("#newSummary").value.trim(),
      tags: $("#newTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      audioLink: els.newAudioLink.value.trim(),
      practice: {
        tempo: els.practiceTempo.value.trim(),
        key: els.practiceKey.value,
        beat: els.practiceBeat.value,
        categories: [...els.practiceCategories].filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
        rightHand: els.practiceRightHand.value.trim(),
        leftHand: els.practiceLeftHand.value.trim(),
        technique: els.practiceTechnique.value.trim(),
      },
      resources: [...linkResources, ...keptFileResources, ...fileResources],
    };

    const previousBlocks = state.blocks;
    if (existing) {
      state.blocks = state.blocks.map((item) => (item.id === editingId ? block : item));
    } else {
      state.blocks.unshift(block);
    }

    try {
      await saveState();
      els.materialDialog.close();
      event.target.reset();
      render();
      showToast(existing ? "블럭을 수정했습니다." : "블럭을 추가했습니다.");
    } catch (error) {
      state.blocks = previousBlocks;
      console.error(error);
      els.materialDialog.close();
      showToast("저장 공간이 부족합니다. 이미지 용량을 줄이거나 링크로 넣어주세요.");
    }
  } finally {
    saveButton.disabled = false;
  }
});

async function deleteBlockById(blockId) {
  const block = getBlock(blockId);
  if (!block) return;
  if (!confirm(`"${block.title}" 블럭을 삭제할까요? 학생 레슨룸에서도 함께 빠집니다.`)) return;
  state.blocks = state.blocks.filter((item) => item.id !== blockId);
  state.students.forEach((student) => {
    student.lessons.forEach((lesson) => {
      lesson.blockIds = lesson.blockIds.filter((id) => id !== blockId);
    });
    student.lessons = student.lessons.filter((lesson) => lesson.blockIds.length || lesson.memo);
  });
  selectedBlockIds.delete(blockId);
  pendingBlockIds.delete(blockId);
  await saveState();
  render();
  showToast("블럭을 삭제했습니다.");
}

function findLessonById(lessonId) {
  const student = getActiveStudent();
  return student?.lessons.find((lesson) => lesson.id === lessonId);
}

async function moveLessonBlock(lessonId, blockId, direction) {
  const lesson = findLessonById(lessonId);
  if (!lesson) return;
  const index = lesson.blockIds.indexOf(blockId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= lesson.blockIds.length) return;
  const copy = [...lesson.blockIds];
  [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  lesson.blockIds = copy;
  await saveState();
  render();
  showToast("블럭 순서를 바꿨습니다.");
}

function getDragAfterElement(container, y) {
  const blocks = [...container.querySelectorAll("[data-draggable-block]:not(.dragging)")];
  return blocks.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null },
  ).element;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function reorderLessonBlocksFromDom(lessonId, zone) {
  const lesson = findLessonById(lessonId);
  if (!lesson) return;
  const nextIds = [...zone.querySelectorAll("[data-draggable-block]")].map((node) => node.dataset.draggableBlock);
  if (nextIds.length !== lesson.blockIds.length) return;
  lesson.blockIds = nextIds;
  await saveState();
  render();
  showToast("블럭 순서를 바꿨습니다.");
}

async function addBlockToEditingLesson(lessonId) {
  const lesson = findLessonById(lessonId);
  const picker = document.querySelector(`[data-edit-lesson-block-picker="${lessonId}"]`);
  const blockId = picker?.value;
  if (!lesson || !blockId) return;
  lesson.blockIds = [...new Set([...lesson.blockIds, blockId])];
  await saveState();
  renderLessonList(getActiveStudent());
  showToast("일지에 블럭을 추가했습니다.");
}

async function saveEditingLesson(lessonId) {
  const student = getActiveStudent();
  const lesson = student?.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;

  const dateInput = document.querySelector(`[data-edit-lesson-date="${lessonId}"]`);
  const memoInput = document.querySelector(`[data-edit-lesson-memo="${lessonId}"]`);
  const nextDate = dateInput?.value || lesson.date;
  const nextMemo = memoInput?.value.trim() || "";
  const sameDateLesson = student.lessons.find((item) => item.id !== lesson.id && item.date === nextDate);

  if (sameDateLesson) {
    sameDateLesson.memo = nextMemo || sameDateLesson.memo;
    sameDateLesson.blockIds = [...new Set([...sameDateLesson.blockIds, ...lesson.blockIds])];
    student.lessons = student.lessons.filter((item) => item.id !== lesson.id);
  } else {
    lesson.date = nextDate;
    lesson.memo = nextMemo;
  }

  editingLessonId = "";
  await saveState();
  render();
  showToast("수업 일지를 수정했습니다.");
}

async function removeBlockFromLesson(lessonId, blockId) {
  const student = getActiveStudent();
  const lesson = student?.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  lesson.blockIds = lesson.blockIds.filter((id) => id !== blockId);
  if (!lesson.blockIds.length && !lesson.memo) {
    student.lessons = student.lessons.filter((item) => item.id !== lessonId);
  }
  await saveState();
  render();
  showToast("해당 수업에서 블럭을 뺐습니다.");
}

async function deleteActiveStudent() {
  const student = getActiveStudent();
  if (!student) return;
  if (!confirm(`"${student.name}" 학생과 레슨룸 기록을 삭제할까요?`)) return;

  state.students = state.students.filter((item) => item.id !== student.id);
  activeStudentId = state.students[0]?.id || "";
  activeShareStudentId = activeStudentId;
  pendingBlockIds.clear();
  selectedBlockIds.clear();
  await saveState();
  render();
  showToast(`${student.name} 학생을 삭제했습니다.`);
}

$("#addStudent").addEventListener("click", () => els.studentDialog.showModal());
els.deleteStudent.addEventListener("click", deleteActiveStudent);

$("#studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.submitter?.value === "cancel") {
    els.studentDialog.close();
    event.target.reset();
    return;
  }

  const student = {
    id: uid("stu"),
    name: $("#newStudentName").value.trim(),
    level: $("#newStudentLevel").value.trim(),
    lessons: [],
  };

  state.students.push(student);
  activeStudentId = student.id;
  activeShareStudentId = student.id;
  await saveState();
  event.target.reset();
  els.studentDialog.close();
  render();
  showToast(`${student.name} 레슨룸을 만들었습니다.`);
});

function attachPickedBlock(kind) {
  const picker = kind === "theory" ? els.lessonTheoryPicker : els.lessonPracticePicker;
  const id = picker.value;
  if (!id) return;
  pendingBlockIds.add(id);
  const block = getBlock(id);
  showToast(`${block.title} 블럭을 이번 날짜에 붙였습니다.`);
  renderRooms();
}

$("#attachTheoryMaterial").addEventListener("click", () => attachPickedBlock("theory"));
$("#attachPracticeMaterial").addEventListener("click", () => attachPickedBlock("practice"));

$("#saveLesson").addEventListener("click", async () => {
  const student = getActiveStudent();
  const date = els.lessonDate.value || today();
  const memo = els.lessonMemo.value.trim();
  const blockIds = [...pendingBlockIds];

  if (!student) return;
  if (!blockIds.length && !memo) {
    showToast("메모나 블럭 중 하나는 있어야 저장됩니다.");
    return;
  }

  upsertLesson(student, date, blockIds, memo);
  pendingBlockIds.clear();
  els.lessonMemo.value = "";
  await saveState();
  render();
  showToast(`${formatDate(date)} 수업에 저장했습니다.`);
});

$("#copyShareLink").addEventListener("click", async () => {
  const student = getActiveStudent();
  await copyStudentShareLink(student);
});

els.copyPreviewShareLink.addEventListener("click", async () => {
  const student = state.students.find((item) => item.id === activeShareStudentId);
  await copyStudentShareLink(student);
});

async function copyStudentShareLink(student) {
  if (!student) return;
  const origin = shareOrigin || location.origin;
  const url = `${origin}${location.pathname}?room=${student.id}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("공유 링크를 복사했습니다.");
  } catch {
    showToast(url);
  }
}

async function init() {
  await loadServerInfo();
  const roomFromUrl = new URLSearchParams(location.search).get("room");

  if (roomFromUrl) {
    publicShareMode = true;
    document.body.classList.add("public-share");
    showAppShell();
    try {
      state = await loadPublicRoomState(roomFromUrl);
      activeStudentId = roomFromUrl;
      activeShareStudentId = roomFromUrl;
      switchView("share");
    } catch (error) {
      console.error(error);
      switchView("share");
      els.shareStudentName.textContent = "공유 레슨룸";
      els.shareContent.innerHTML = `<div class="empty">공유 링크를 찾을 수 없습니다.</div>`;
    }
    return;
  }

  publicShareMode = false;
  document.body.classList.remove("public-share");

  if (!hasAdminToken()) {
    showAdminLogin();
    return;
  }

  showAppShell();
  state = await loadPersistentState();
  activeStudentId = state.students[0]?.id || "";
  activeShareStudentId = activeStudentId;
  render();
  await saveState();
}

init().catch((error) => {
  console.error(error);
  if (new URLSearchParams(location.search).get("room")) {
    publicShareMode = true;
    document.body.classList.add("public-share");
    showAppShell();
    switchView("share");
    els.shareStudentName.textContent = "공유 레슨룸";
    els.shareContent.innerHTML = `<div class="empty">공유 링크를 여는 중 문제가 생겼습니다.</div>`;
    return;
  }
  if (String(error.message || "").includes("Unauthorized")) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    showAdminLogin("다시 로그인해주세요.");
    return;
  }
  showAdminLogin("앱을 여는 중 문제가 생겼습니다.");
});
