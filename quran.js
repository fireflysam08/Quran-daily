
/* =====================================
   QURAN DAILY TRACKER
   AUTOMATIC QURAN READING TRACKER
===================================== */

const API = "https://api.alquran.cloud/v1";

const ARABIC_EDITION = "quran-uthmani";
const MALAY_EDITION = "ms.basmeih";
const ENGLISH_EDITION = "en.sahih";

const POSITION_KEY = "quranReaderPosition";
const MODE_KEY = "quranReadingMode";
const FONT_KEY = "quranArabicFontSize";
const READING_KEY = "quranReadingRecords";
const SESSION_KEY = "quranActiveReadingSession";

const INACTIVITY_LIMIT = 30 * 60 * 1000;
const AYAH_VIEW_TIME = 3000;

// Reader elements
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

// Reader data
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

/* =====================================
   HELPER FUNCTIONS
===================================== */

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

/* =====================================
   AUTOMATIC READING SESSION
===================================== */

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

  // Prevent duplicate ayah entries.
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

  // Page and Juz come directly from Quran data.
  if (
    ayah.page &&
    !record.pages.includes(ayah.page)
  ) {
    record.pages.push(ayah.page);
  }

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

  // Update the reading position.
  currentAyah = ayah.numberInSurah;
  savePosition();

  readerStatus.textContent =
    `Reading tracked: ${record.surah}, Ayah ${currentAyah}`;
}

/* =====================================
   DETECT AYAH ON SCREEN
===================================== */

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

  ayahObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const element = entry.target;
      const number = Number(element.dataset.ayah);

      if (entry.isIntersecting &&
          entry.intersectionRatio >= 0.25) {

        if (visibilityTimers.has(number)) return;

        const timer = setTimeout(() => {
          visibilityTimers.delete(number);

          if (
            element.isConnected &&
            element.getBoundingClientRect().bottom > 0 &&
            element.getBoundingClientRect().top < window.innerHeight
          ) {
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

/* =====================================
   LOAD SURAH LIST
===================================== */

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

    if (["arabic", "malay", "english"].includes(savedMode)) {
      readingMode.value = savedMode;
    }

    currentFontSize = Math.min(
      48,
      Math.max(22, currentFontSize)
    );

    updateFontSize();

    await loadSurah(currentSurah, true);

  } catch (error) {
    console.error(error);

    readerStatus.textContent =
      "Unable to load Quran. Please check your internet connection.";
  }
}

/* =====================================
   LOAD ONE COMPLETE SURAH
===================================== */

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

    readerStatus.textContent =
      `${info.numberOfAyahs} Ayahs loaded successfully.`;

    savePosition();

    startAutomaticTracking();

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

/* =====================================
   DISPLAY AYAH TEXT
===================================== */

function renderAyahs() {
  const mode = readingMode.value;

  const arabic = currentData.arabic;
  const malay = currentData.malay;
  const english = currentData.english;

  ayahContainer.innerHTML = arabic.map((ayah, index) => {

    const malayText = malay[index]?.text || "";
    const englishText = english[index]?.text || "";

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
            onclick="selectAyah(${ayah.numberInSurah})"
            aria-label="Save reading position"
          >☆</button>
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

/* =====================================
   SELECT AND HIGHLIGHT AYAH
===================================== */

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

/* =====================================
   READING MODE
===================================== */

readingMode.addEventListener("change", function() {
  localStorage.setItem(MODE_KEY, this.value);

  renderAyahs();
  scrollToCurrentAyah();
  startAutomaticTracking();
});

/* =====================================
   SURAH NAVIGATION
===================================== */

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

/* =====================================
   FONT SIZE
===================================== */

function updateFontSize() {
  fontSizeLabel.textContent = `${currentFontSize} px`;

  localStorage.setItem(FONT_KEY, currentFontSize);

  applyFontSize();
}

function applyFontSize() {
  document.querySelectorAll(".arabic-text").forEach(element => {
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

/* =====================================
   START READER
===================================== */

loadSurahs();
