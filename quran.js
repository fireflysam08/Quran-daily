
/* =========================================
   QURAN DAILY TRACKER
   COMPLETE QURAN READER
   AUTOMATIC READING + FAVOURITES
========================================= */

const API = "https://api.alquran.cloud/v1";

const ARABIC_EDITION = "quran-uthmani";
const MALAY_EDITION = "ms.basmeih";
const ENGLISH_EDITION = "en.sahih";

const POSITION_KEY = "quranReaderPosition";
const MODE_KEY = "quranReadingMode";
const FONT_KEY = "quranArabicFontSize";

const READING_KEY = "quranReadingRecords";
const SESSION_KEY = "quranActiveReadingSession";

const FAV_AYAT_KEY = "quranFavouriteAyat";
const FAV_SURAHS_KEY = "quranFavouriteSurahs";

const AYAH_VIEW_TIME = 3000;
const INACTIVITY_LIMIT = 30 * 60 * 1000;

// =========================================
// READER ELEMENTS
// =========================================

const surahSelect = document.getElementById("surahSelect");
const readingMode = document.getElementById("readingMode");
const ayahContainer = document.getElementById("ayahContainer");
const readerStatus = document.getElementById("readerStatus");

const surahNumber = document.getElementById("surahNumber");
const surahArabic = document.getElementById("surahArabic");
const surahName = document.getElementById("surahName");
const surahInformation = document.getElementById("surahInformation");

const fontSizeLabel = document.getElementById("fontSizeLabel");
const decreaseFont = document.getElementById("decreaseFont");
const increaseFont = document.getElementById("increaseFont");

const previousSurah = document.getElementById("previousSurah");
const nextSurah = document.getElementById("nextSurah");

const favoriteSurahButton =
  document.getElementById("favoriteSurahButton");

const favAyatTab = document.getElementById("favAyatTab");
const favSurahsTab = document.getElementById("favSurahsTab");

const favAyatPanel = document.getElementById("favAyatPanel");
const favSurahsPanel = document.getElementById("favSurahsPanel");

const favAyatList = document.getElementById("favAyatList");
const favSurahsList = document.getElementById("favSurahsList");

// =========================================
// READER DATA
// =========================================

let surahs = [];

let currentSurah = 1;
let currentAyah = 1;

let currentFontSize = Number(
  localStorage.getItem(FONT_KEY) || 30
);

let currentData = {
  arabic: [],
  malay: [],
  english: []
};

let loadingSurah = false;

let ayahObserver = null;
let visibilityTimers = new Map();

let hasReadingInteraction = false;

// =========================================
// HELPER FUNCTIONS
// =========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to load Quran data.");
  }

  const result = await response.json();

  if (result.code !== 200 || !result.data) {
    throw new Error("Invalid Quran data response.");
  }

  return result.data;
}

function getLocalDate() {
  return new Date().toLocaleDateString("en-CA");
}

function getRecords() {
  try {
    return JSON.parse(
      localStorage.getItem(READING_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(
    READING_KEY,
    JSON.stringify(records)
  );
}

function savePosition() {
  localStorage.setItem(
    POSITION_KEY,
    JSON.stringify({
      surah: currentSurah,
      ayah: currentAyah
    })
  );
}

function restorePosition() {
  try {
    return JSON.parse(
      localStorage.getItem(POSITION_KEY) ||
      '{"surah":1,"ayah":1}'
    );
  } catch {
    return { surah: 1, ayah: 1 };
  }
}

// =========================================
// AUTOMATIC READING SESSION
// =========================================

function getActiveSession() {
  try {
    const session = JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    );

    if (!session) return null;

    const lastActivity = new Date(
      session.lastActivity
    ).getTime();

    if (
      !lastActivity ||
      Date.now() - lastActivity > INACTIVITY_LIMIT
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;

  } catch {
    return null;
  }
}

function createSession() {
  const now = new Date().toISOString();

  const session = {
    id: "reading-" + Date.now(),
    startedAt: now,
    lastActivity: now
  };

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

  return session;
}

function trackReadAyah(ayah) {
  let session = getActiveSession();

  if (!session) {
    session = createSession();
  }

  session.lastActivity = new Date().toISOString();

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

  const now = new Date().toISOString();
  const records = getRecords();

  let record = records.find(item =>
    item.sessionId === session.id &&
    Number(item.surahNumber) === currentSurah
  );

  if (!record) {
    record = {
      id: session.id + "-surah-" + currentSurah,
      sessionId: session.id,

      surah: surahs[currentSurah - 1]?.englishName ||
        "Surah " + currentSurah,

      surahNumber: currentSurah,

      startAyah: ayah.numberInSurah,
      endAyah: ayah.numberInSurah,

      ayahsRead: [],
      pages: [],
      juz: [],

      date: getLocalDate(),
      startedAt: session.startedAt,
      savedAt: now,

      notes: "Automatically tracked"
    };

    records.push(record);
  }

  // Save ayah only once.
  if (!record.ayahsRead.includes(ayah.numberInSurah)) {
    record.ayahsRead.push(ayah.numberInSurah);
  }

  record.ayahsRead.sort((a, b) => a - b);

  record.startAyah = Math.min(
    ...record.ayahsRead
  );

  record.endAyah = Math.max(
    ...record.ayahsRead
  );

  // Save Quran page automatically.
  if (
    ayah.page &&
    !record.pages.includes(ayah.page)
  ) {
    record.pages.push(ayah.page);
  }

  // Save Juz automatically.
  if (
    ayah.juz &&
    !record.juz.includes(ayah.juz)
  ) {
    record.juz.push(ayah.juz);
  }

  record.pages.sort((a, b) => a - b);
  record.juz.sort((a, b) => a - b);

  record.savedAt = now;

  saveRecords(records);

  currentAyah = ayah.numberInSurah;
  savePosition();

  readerStatus.textContent =
    `Reading tracked: ${record.surah}, Ayah ${currentAyah}`;
}

// =========================================
// READING INTERACTION
// =========================================

// Opening the reader alone does not start tracking.
// Scrolling activates the automatic ayah detector.

function activateReadingTracking() {
  if (hasReadingInteraction) return;

  hasReadingInteraction = true;

  startAutomaticTracking();
}

window.addEventListener(
  "scroll",
  activateReadingTracking,
  { passive: true }
);

window.addEventListener(
  "touchstart",
  activateReadingTracking,
  { passive: true }
);

window.addEventListener(
  "wheel",
  activateReadingTracking,
  { passive: true }
);

// =========================================
// AUTOMATIC AYAH DETECTION
// =========================================

function stopVisibilityTimers() {
  visibilityTimers.forEach(timer => {
    clearTimeout(timer);
  });

  visibilityTimers.clear();
}

function startAutomaticTracking() {
  if (ayahObserver) {
    ayahObserver.disconnect();
  }

  stopVisibilityTimers();

  if (!("IntersectionObserver" in window)) {
    readerStatus.textContent =
      "Automatic tracking is not supported by this browser.";
    return;
  }

  if (!hasReadingInteraction) return;

  ayahObserver = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      const element = entry.target;
      const number = Number(element.dataset.ayah);

      if (
        entry.isIntersecting &&
        entry.intersectionRatio >= 0.25
      ) {

        if (visibilityTimers.has(number)) return;

        const timer = setTimeout(() => {

          visibilityTimers.delete(number);

          const rect = element.getBoundingClientRect();

          const stillVisible =
            element.isConnected &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight;

          if (stillVisible) {

            const ayah = currentData.arabic.find(item =>
              item.numberInSurah === number
            );

            if (ayah) {
              trackReadAyah(ayah);
              highlightAyah(number);
            }
          }

        }, AYAH_VIEW_TIME);

        visibilityTimers.set(number, timer);

      } else {

        const timer = visibilityTimers.get(number);

        if (timer) {
          clearTimeout(timer);
          visibilityTimers.delete(number);
        }
      }
    });

  }, {
    threshold: [0.25, 0.5, 0.75]
  });

  document.querySelectorAll(".quran-ayah").forEach(element => {
    ayahObserver.observe(element);
  });
}

// =========================================
// LOAD ALL 114 SURAHS
// =========================================

async function loadSurahs() {
  try {
    readerStatus.textContent =
      "Loading all 114 Surahs...";

    surahs = await fetchJSON(`${API}/surah`);

    surahSelect.innerHTML = surahs.map(surah => `
      <option value="${surah.number}">
        ${surah.number}. ${escapeHTML(surah.englishName)}
      </option>
    `).join("");

    const saved = restorePosition();

    currentSurah = Math.min(
      114,
      Math.max(1, Number(saved.surah) || 1)
    );

    currentAyah = Math.max(
      1,
      Number(saved.ayah) || 1
    );

    const savedMode = localStorage.getItem(MODE_KEY);

    if (
      ["arabic", "malay", "english"].includes(savedMode)
    ) {
      readingMode.value = savedMode;
    }

    currentFontSize = Math.min(
      48,
      Math.max(22, currentFontSize)
    );

    updateFontSize();

    renderFavoriteAyat();
    renderFavoriteSurahs();

    await loadSurah(currentSurah, true);

  } catch (error) {
    console.error(error);

    readerStatus.textContent =
      "Unable to load Quran. Please check your internet connection.";
  }
}

// =========================================
// LOAD ONE COMPLETE SURAH
// =========================================

async function loadSurah(number, restoreAyah = false) {
  if (loadingSurah) return;

  loadingSurah = true;

  if (ayahObserver) {
    ayahObserver.disconnect();
  }

  stopVisibilityTimers();

  try {
    readerStatus.textContent = "Loading Surah...";
    ayahContainer.innerHTML = "";

    const [arabicData, malayData, englishData] =
      await Promise.all([
        fetchJSON(`${API}/surah/${number}/${ARABIC_EDITION}`),
        fetchJSON(`${API}/surah/${number}/${MALAY_EDITION}`),
        fetchJSON(`${API}/surah/${number}/${ENGLISH_EDITION}`)
      ]);

    currentData.arabic = arabicData.ayahs;
    currentData.malay = malayData.ayahs;
    currentData.english = englishData.ayahs;

    if (
      currentData.arabic.length !== currentData.malay.length ||
      currentData.arabic.length !== currentData.english.length
    ) {
      throw new Error("Quran edition verse counts do not match.");
    }

    currentSurah = number;

    const info = surahs[number - 1];

    surahSelect.value = number;

    surahNumber.textContent = `Surah ${number}`;
    surahArabic.textContent = info.name;
    surahName.textContent = info.englishName;

    surahInformation.textContent =
      `${info.englishNameTranslation} · ` +
      `${info.numberOfAyahs} Ayahs · ${info.revelationType}`;

    if (!restoreAyah) {
      currentAyah = 1;
    } else {
      currentAyah = Math.min(
        currentAyah,
        info.numberOfAyahs
      );
    }

    renderAyahs();

    updateFavoriteSurahButton();

    readerStatus.textContent =
      `${info.numberOfAyahs} Ayahs loaded successfully.`;

    savePosition();

    if (hasReadingInteraction) {
      startAutomaticTracking();
    }

    if (restoreAyah) {
      scrollToCurrentAyah();
    }

  } catch (error) {
    console.error(error);

    readerStatus.textContent =
      "Unable to load this Surah. Please try again.";

  } finally {
    loadingSurah = false;
  }
}

// =========================================
// DISPLAY AYAH TEXT
// =========================================

function renderAyahs() {
  const mode = readingMode.value;

  const arabic = currentData.arabic;
  const malay = currentData.malay;
  const english = currentData.english;

  ayahContainer.innerHTML = arabic.map((ayah, index) => {

    const malayText = malay[index]?.text || "";
    const englishText = english[index]?.text || "";

    const favourite = isFavoriteAyah(
      currentSurah,
      ayah.numberInSurah
    );

    return `
      <article
        class="quran-ayah ${
          ayah.numberInSurah === currentAyah
            ? "selected-ayah" : ""
        }"
        id="ayah-${ayah.numberInSurah}"
        data-ayah="${ayah.numberInSurah}"
      >

        <div class="ayah-number">
          <span>Ayah ${ayah.numberInSurah}</span>

          <button
            type="button"
            class="bookmark-button"
            onclick="toggleFavoriteAyah(
              ${currentSurah},
              ${ayah.numberInSurah}
            )"
            id="fav-ayah-${ayah.numberInSurah}"
            aria-label="Add or remove favourite ayah"
          >
            ${favourite ? "♥" : "♡"}
          </button>
        </div>

        <p class="arabic-text" dir="rtl">
          ${escapeHTML(ayah.text)}
          <span class="arabic-ayah-number">
            ﴿${ayah.numberInSurah}﴾
          </span>
        </p>

        ${mode === "malay" ? `
          <p class="translation-text" lang="ms">
            ${escapeHTML(malayText)}
          </p>
        ` : ""}

        ${mode === "english" ? `
          <p class="translation-text" lang="en">
            ${escapeHTML(englishText)}
          </p>
        ` : ""}

      </article>
    `;
  }).join("");

  applyFontSize();
}

// =========================================
// SELECT AND HIGHLIGHT AYAH
// =========================================

function highlightAyah(number) {
  document.querySelectorAll(".quran-ayah").forEach(element => {
    element.classList.remove("selected-ayah");
  });

  const selected = document.getElementById(`ayah-${number}`);

  if (selected) {
    selected.classList.add("selected-ayah");
  }
}

function selectAyah(number) {
  currentAyah = number;

  savePosition();
  highlightAyah(number);
}

function scrollToCurrentAyah() {
  const element = document.getElementById(
    `ayah-${currentAyah}`
  );

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

// =========================================
// READING MODE
// =========================================

readingMode.addEventListener("change", function() {

  localStorage.setItem(MODE_KEY, this.value);

  renderAyahs();
  scrollToCurrentAyah();

  if (hasReadingInteraction) {
    startAutomaticTracking();
  }
});

// =========================================
// SURAH NAVIGATION
// =========================================

surahSelect.addEventListener("change", function() {

  const number = Number(this.value);

  if (number >= 1 && number <= 114) {
    currentAyah = 1;
    loadSurah(number);
  }
});

previousSurah.addEventListener("click", function() {

  if (currentSurah > 1) {
    currentAyah = 1;
    loadSurah(currentSurah - 1);
  }
});

nextSurah.addEventListener("click", function() {

  if (currentSurah < 114) {
    currentAyah = 1;
    loadSurah(currentSurah + 1);
  }
});

// =========================================
// FONT SIZE
// =========================================

function updateFontSize() {

  fontSizeLabel.textContent =
    `${currentFontSize} px`;

  localStorage.setItem(
    FONT_KEY,
    currentFontSize
  );

  applyFontSize();
}

function applyFontSize() {

  document.querySelectorAll(".arabic-text").forEach(element => {
    element.style.fontSize =
      `${currentFontSize}px`;
  });
}

increaseFont.addEventListener("click", function() {

  if (currentFontSize < 48) {
    currentFontSize += 2;
    updateFontSize();
  }
});

decreaseFont.addEventListener("click", function() {

  if (currentFontSize > 22) {
    currentFontSize -= 2;
    updateFontSize();
  }
});

// =========================================
// FAVOURITE AYAT
// =========================================

function getFavoriteAyat() {
  try {
    return JSON.parse(
      localStorage.getItem(FAV_AYAT_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveFavoriteAyat(items) {
  localStorage.setItem(
    FAV_AYAT_KEY,
    JSON.stringify(items)
  );
}

function isFavoriteAyah(surah, ayah) {

  return getFavoriteAyat().some(item =>
    Number(item.surahNumber) === Number(surah) &&
    Number(item.ayahNumber) === Number(ayah)
  );
}

function toggleFavoriteAyah(surah, ayah) {

  const favorites = getFavoriteAyat();

  const existing = favorites.findIndex(item =>
    Number(item.surahNumber) === Number(surah) &&
    Number(item.ayahNumber) === Number(ayah)
  );

  if (existing >= 0) {

    favorites.splice(existing, 1);

  } else {

    const arabic = currentData.arabic.find(item =>
      item.numberInSurah === ayah
    );

    const malay = currentData.malay.find(item =>
      item.numberInSurah === ayah
    );

    const english = currentData.english.find(item =>
      item.numberInSurah === ayah
    );

    if (
      Number(surah) !== currentSurah ||
      !arabic
    ) {
      return;
    }

    favorites.push({
      surahNumber: surah,
      surahName: surahs[surah - 1].englishName,
      ayahNumber: ayah,
      arabic: arabic.text,
      malay: malay?.text || "",
      english: english?.text || "",
      savedAt: new Date().toISOString()
    });
  }

  saveFavoriteAyat(favorites);

  renderFavoriteAyat();
  updateFavoriteAyahButton(surah, ayah);
}

function updateFavoriteAyahButton(surah, ayah) {

  if (Number(surah) !== currentSurah) return;

  const button = document.getElementById(
    `fav-ayah-${ayah}`
  );

  if (button) {
    button.textContent =
      isFavoriteAyah(surah, ayah) ? "♥" : "♡";
  }
}

function renderFavoriteAyat() {

  if (!favAyatList) return;

  const favorites = getFavoriteAyat();

  if (!favorites.length) {
    favAyatList.innerHTML =
      "<p>No favourite ayat saved yet.</p>";
    return;
  }

  favAyatList.innerHTML = favorites.map(item => `

    <div class="history-item">

      <h3>
        ${escapeHTML(item.surahName)}
        · Ayah ${item.ayahNumber}
      </h3>

      <p dir="rtl" class="arabic-text">
        ${escapeHTML(item.arabic)}
      </p>

      <p>${escapeHTML(item.malay)}</p>

      <button
        type="button"
        onclick="openFavoriteAyah(
          ${item.surahNumber},
          ${item.ayahNumber}
        )"
      >
        Read Ayah
      </button>

      <button
        type="button"
        onclick="toggleFavoriteAyah(
          ${item.surahNumber},
          ${item.ayahNumber}
        )"
      >
        Remove ♥
      </button>

    </div>

  `).join("");

  applyFontSize();
}

async function openFavoriteAyah(surah, ayah) {

  currentAyah = ayah;

  await loadSurah(surah, true);

  scrollToCurrentAyah();
}

// =========================================
// FAVOURITE SURAHS
// =========================================

function getFavoriteSurahs() {

  try {
    return JSON.parse(
      localStorage.getItem(FAV_SURAHS_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveFavoriteSurahs(items) {

  localStorage.setItem(
    FAV_SURAHS_KEY,
    JSON.stringify(items)
  );
}

function isFavoriteSurah(number) {

  return getFavoriteSurahs().some(item =>
    Number(item) === Number(number)
  );
}

function toggleFavoriteSurah() {

  const favorites = getFavoriteSurahs();

  const index = favorites.findIndex(item =>
    Number(item) === Number(currentSurah)
  );

  if (index >= 0) {

    favorites.splice(index, 1);

  } else {

    favorites.push(currentSurah);
  }

  saveFavoriteSurahs(favorites);

  renderFavoriteSurahs();
  updateFavoriteSurahButton();
}

function updateFavoriteSurahButton() {

  if (!favoriteSurahButton) return;

  favoriteSurahButton.textContent =
    isFavoriteSurah(currentSurah)
      ? "♥ Added to Favourite Surahs"
      : "♡ Add to Favourite Surahs";
}

function renderFavoriteSurahs() {

  if (!favSurahsList) return;

  const favorites = getFavoriteSurahs();

  if (!favorites.length) {
    favSurahsList.innerHTML =
      "<p>No favourite surahs saved yet.</p>";
    return;
  }

  favSurahsList.innerHTML = favorites.map(number => {

    const surah = surahs[number - 1];

    if (!surah) return "";

    return `

      <div class="history-item">

        <h3>
          ${number}. ${escapeHTML(surah.englishName)}
        </h3>

        <p dir="rtl" class="arabic-text">
          ${escapeHTML(surah.name)}
        </p>

        <button
          type="button"
          onclick="openFavoriteSurah(${number})"
        >
          Read Surah
        </button>

        <button
          type="button"
          onclick="removeFavoriteSurah(${number})"
        >
          Remove ♥
        </button>

      </div>

    `;

  }).join("");

  applyFontSize();
}

function openFavoriteSurah(number) {

  currentAyah = 1;
  loadSurah(number);
}

function removeFavoriteSurah(number) {

  const favorites = getFavoriteSurahs().filter(item =>
    Number(item) !== Number(number)
  );

  saveFavoriteSurahs(favorites);

  renderFavoriteSurahs();
  updateFavoriteSurahButton();
}

// =========================================
// FAVOURITE TABS
// =========================================

if (favAyatTab && favAyatPanel && favSurahsPanel) {

  favAyatTab.addEventListener("click", function() {

    favAyatPanel.hidden = false;
    favSurahsPanel.hidden = true;

  });
}

if (favSurahsTab && favAyatPanel && favSurahsPanel) {

  favSurahsTab.addEventListener("click", function() {

    favAyatPanel.hidden = true;
    favSurahsPanel.hidden = false;

  });
}

if (favoriteSurahButton) {

  favoriteSurahButton.addEventListener(
    "click",
    toggleFavoriteSurah
  );
}

// =========================================
// START READER
// =========================================

loadSurahs();
