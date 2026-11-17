
/* =========================================
   QURAN DAILY TRACKER
   MUSHAF READER
   AUTOMATIC TRACKING + FAVOURITES
========================================= */

const API = "https://api.alquran.cloud/v1";

const ARABIC_EDITION = "quran-uthmani";
const MALAY_EDITION = "ms.basmeih";

const POSITION_KEY = "quranReaderPosition";
const FONT_KEY = "quranArabicFontSize";
const TRANSLATION_KEY = "quranShowMalay";

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

// =========================================
// READER DATA
// =========================================

let surahs = [];
let currentSurah = 1;
let currentAyah = 1;

let currentFontSize = Number(
  localStorage.getItem(FONT_KEY) || 30
);

let showMalay =
  localStorage.getItem(TRANSLATION_KEY) === "true";

let currentData = {
  arabic: [],
  malay: []
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

function getRecords(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveRecords(key, records) {
  localStorage.setItem(key, JSON.stringify(records));
}

// Use the device's local date and time.
function getDeviceDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDeviceTimestamp() {
  return new Date().toISOString();
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
// MUSHAF TRANSLATION CONTROL
// =========================================

function createTranslationControl() {
  // Remove the old reading-mode selector.
  document.querySelectorAll(
    'label[for="readingMode"], #readingMode'
  ).forEach(element => {
    element.hidden = true;
  });

  const controls = document.querySelector(".app > .card");

  if (!controls || document.getElementById("translationToggle")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "translation-control";

  wrapper.innerHTML = `
    <button type="button" id="translationToggle">
      ${showMalay ? "Hide Malay Translation" : "Show Malay Translation"}
    </button>
  `;

  controls.appendChild(wrapper);

  document.getElementById("translationToggle")
    .addEventListener("click", function() {

      showMalay = !showMalay;

      localStorage.setItem(
        TRANSLATION_KEY,
        String(showMalay)
      );

      this.textContent = showMalay
        ? "Hide Malay Translation"
        : "Show Malay Translation";

      renderMushaf();
      startAutomaticTracking();
    });
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
  const now = getDeviceTimestamp();

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

// =========================================
// SAVE AUTOMATIC READING RECORD
// =========================================

function trackReadAyah(ayah) {

  let session = getActiveSession();

  if (!session) {
    session = createSession();
  }

  session.lastActivity = getDeviceTimestamp();

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

  const records = getRecords(READING_KEY);

  let record = records.find(item =>
    item.sessionId === session.id &&
    Number(item.surahNumber) === currentSurah
  );

  const now = getDeviceTimestamp();

  if (!record) {

    record = {
      id: session.id + "-surah-" + currentSurah,
      sessionId: session.id,

      surah: surahs[currentSurah - 1].englishName,
      surahNumber: currentSurah,

      startAyah: ayah.numberInSurah,
      endAyah: ayah.numberInSurah,

      ayahsRead: [],
      pages: [],
      juz: [],

      date: getDeviceDate(),
      startedAt: session.startedAt,
      savedAt: now,

      notes: "Automatically tracked"
    };

    records.push(record);
  }

  // Avoid counting the same ayah twice.
  if (!record.ayahsRead.includes(ayah.numberInSurah)) {
    record.ayahsRead.push(ayah.numberInSurah);
  }

  record.ayahsRead.sort((a, b) => a - b);

  record.startAyah = Math.min(...record.ayahsRead);
  record.endAyah = Math.max(...record.ayahsRead);

  // Actual Quran page number.
  if (ayah.page && !record.pages.includes(ayah.page)) {
    record.pages.push(ayah.page);
  }

  // Actual Quran Juz number.
  if (ayah.juz && !record.juz.includes(ayah.juz)) {
    record.juz.push(ayah.juz);
  }

  record.pages.sort((a, b) => a - b);
  record.juz.sort((a, b) => a - b);

  record.savedAt = now;

  saveRecords(READING_KEY, records);

  currentAyah = ayah.numberInSurah;
  savePosition();

  readerStatus.textContent =
    `Reading tracked: ${record.surah}, Ayah ${currentAyah}`;
}

// =========================================
// USER READING INTERACTION
// =========================================

function activateReadingTracking() {

  if (hasReadingInteraction) return;

  hasReadingInteraction = true;

  startAutomaticTracking();
}

window.addEventListener(
  "wheel",
  activateReadingTracking,
  { passive: true }
);

window.addEventListener(
  "touchmove",
  activateReadingTracking,
  { passive: true }
);

document.addEventListener("keydown", event => {

  if (
    ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "]
      .includes(event.key)
  ) {
    activateReadingTracking();
  }
});

ayahContainer.addEventListener("pointerdown", event => {

  if (event.target.closest(".mushaf-ayah")) {
    activateReadingTracking();
  }
});

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

  if (!hasReadingInteraction) return;

  if (!("IntersectionObserver" in window)) {
    readerStatus.textContent =
      "Automatic tracking is unavailable in this browser.";
    return;
  }

  ayahObserver = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      const element = entry.target;
      const number = Number(element.dataset.ayah);

      if (
        entry.isIntersecting &&
        entry.intersectionRatio >= 0.5
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
    threshold: [0.5, 0.75]
  });

  document.querySelectorAll(".mushaf-ayah").forEach(element => {
    ayahObserver.observe(element);
  });
}

// =========================================
// LOAD ALL SURAHS
// =========================================

async function loadSurahs() {

  try {

    readerStatus.textContent = "Loading all 114 Surahs...";

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

    currentFontSize = Math.min(
      48,
      Math.max(22, currentFontSize)
    );

    createTranslationControl();
    updateFontSize();

    await loadSurah(currentSurah, true);

  } catch (error) {

    console.error(error);

    readerStatus.textContent =
      "Unable to load Quran. Check your internet connection.";
  }
}

// =========================================
// LOAD ONE SURAH
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

    const [arabicData, malayData] = await Promise.all([

      fetchJSON(
        `${API}/surah/${number}/${ARABIC_EDITION}`
      ),

      fetchJSON(
        `${API}/surah/${number}/${MALAY_EDITION}`
      )

    ]);

    currentData.arabic = arabicData.ayahs;
    currentData.malay = malayData.ayahs;

    if (
      currentData.arabic.length !== currentData.malay.length
    ) {
      throw new Error("Arabic and Malay ayah counts do not match.");
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

    renderMushaf();

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
// MUSHAF PAGE RENDERING
// Arabic continuous, translation ayah by ayah
// =========================================

function renderMushaf() {

  const pages = new Map();

  currentData.arabic.forEach((ayah, index) => {

    const pageNumber = ayah.page || 1;

    if (!pages.has(pageNumber)) {
      pages.set(pageNumber, []);
    }

    pages.get(pageNumber).push({
      arabic: ayah,
      malay: currentData.malay[index]
    });
  });

  ayahContainer.innerHTML = Array.from(pages.entries())
    .map(([pageNumber, items]) => {

      const arabicContent = items.map(item => {

        const ayahNumber = item.arabic.numberInSurah;
        const favorite = isFavoriteAyah(
          currentSurah,
          ayahNumber
        );

        return `
          <span
            class="mushaf-ayah ${
              ayahNumber === currentAyah ? "selected-ayah" : ""
            }"
            id="ayah-${ayahNumber}"
            data-ayah="${ayahNumber}"
          >${escapeHTML(item.arabic.text)}
            <span class="arabic-ayah-number">
              ﴿${ayahNumber}﴾
            </span>
            <button
              type="button"
              class="mushaf-favorite-button"
              onclick="toggleFavoriteAyah(
                ${currentSurah},
                ${ayahNumber}
              )"
              id="fav-ayah-${ayahNumber}"
              aria-label="Favourite ayah ${ayahNumber}"
            >${favorite ? "♥" : "♡"}</button>
          </span>
        `;

      }).join(" ");

      const translationContent = showMalay
        ? `
          <div class="mushaf-translations">
            ${items.map(item => `
              <div class="translation-line">
                <strong>
                  Ayah ${item.arabic.numberInSurah}
                </strong>
                <p lang="ms">
                  ${escapeHTML(item.malay?.text || "")}
                </p>
              </div>
            `).join("")}
          </div>
        `
        : "";

      return `
        <section class="mushaf-page" data-page="${pageNumber}">

          <div class="mushaf-page-number">
            Page ${pageNumber}
          </div>

          <p class="mushaf-arabic" dir="rtl">
            ${arabicContent}
          </p>

          ${translationContent}

        </section>
      `;

    }).join("");

  applyFontSize();
}

// =========================================
// HIGHLIGHT AND SELECT AYAH
// =========================================

function highlightAyah(number) {

  document.querySelectorAll(".mushaf-ayah").forEach(element => {
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

  document.querySelectorAll(".mushaf-arabic").forEach(element => {
    element.style.fontSize = `${currentFontSize}px`;
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
  return getRecords(FAV_AYAT_KEY);
}

function saveFavoriteAyat(items) {
  saveRecords(FAV_AYAT_KEY, items);
}

function isFavoriteAyah(surah, ayah) {

  return getFavoriteAyat().some(item =>
    Number(item.surahNumber) === Number(surah) &&
    Number(item.ayahNumber) === Number(ayah)
  );
}

function toggleFavoriteAyah(surah, ayah) {

  const favorites = getFavoriteAyat();

  const index = favorites.findIndex(item =>
    Number(item.surahNumber) === Number(surah) &&
    Number(item.ayahNumber) === Number(ayah)
  );

  if (index >= 0) {

    favorites.splice(index, 1);

  } else {

    const arabic = currentData.arabic.find(item =>
      item.numberInSurah === ayah
    );

    const malay = currentData.malay.find(item =>
      item.numberInSurah === ayah
    );

    if (!arabic || !malay) return;

    favorites.push({

      id: `fav-${surah}-${ayah}`,

      surahNumber: surah,
      surahName: surahs[surah - 1].englishName,

      ayahNumber: ayah,

      arabic: arabic.text,
      malay: malay.text,

      page: arabic.page,
      juz: arabic.juz,

      savedAt: getDeviceTimestamp()
    });
  }

  saveFavoriteAyat(favorites);

  updateFavoriteAyahButton(surah, ayah);

  // Notify the dashboard if it is open in another tab.
  window.dispatchEvent(
    new CustomEvent("quran-favourites-updated")
  );
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

// =========================================
// FAVOURITE SURAHS
// =========================================

function getFavoriteSurahs() {
  return getRecords(FAV_SURAHS_KEY);
}

function saveFavoriteSurahs(items) {
  saveRecords(FAV_SURAHS_KEY, items);
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

  updateFavoriteSurahButton();

  window.dispatchEvent(
    new CustomEvent("quran-favourites-updated")
  );
}

function updateFavoriteSurahButton() {

  if (!favoriteSurahButton) return;

  favoriteSurahButton.textContent =
    isFavoriteSurah(currentSurah)
      ? "♥ Added to Favourite Surahs"
      : "♡ Add to Favourite Surahs";
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
