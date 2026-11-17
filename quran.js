
/* =====================================
   QURAN DAILY TRACKER
   QURAN READER
===================================== */

const API = "https://api.alquran.cloud/v1";

const ARABIC_EDITION = "quran-uthmani";
const MALAY_EDITION = "ms.basmeih";
const ENGLISH_EDITION = "en.sahih";

const POSITION_KEY = "quranReaderPosition";
const MODE_KEY = "quranReadingMode";
const FONT_KEY = "quranArabicFontSize";

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
   LOAD SURAH LIST
===================================== */

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
      "Unable to load Quran. Please check your internet connection and try again.";
  }
}

/* =====================================
   LOAD ONE COMPLETE SURAH
===================================== */

async function loadSurah(number, restoreAyah = false) {
  if (loadingSurah) return;

  loadingSurah = true;

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
        class="quran-ayah ${ayah.numberInSurah === currentAyah ? "selected-ayah" : ""}"
        id="ayah-${ayah.numberInSurah}"
        data-ayah="${ayah.numberInSurah}"
      >

        <div class="ayah-number">
          <span>Ayah ${ayah.numberInSurah}</span>
          <button
            type="button"
            class="bookmark-button"
            onclick="selectAyah(${ayah.numberInSurah})"
            aria-label="Save reading position at ayah ${ayah.numberInSurah}"
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
   SELECT AYAH / SAVE POSITION
===================================== */

function selectAyah(number) {
  currentAyah = number;

  savePosition();

  document.querySelectorAll(".quran-ayah").forEach(element => {
    element.classList.remove("selected-ayah");
  });

  const selected = document.getElementById(`ayah-${number}`);

  if (selected) {
    selected.classList.add("selected-ayah");
  }
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
  const previousPosition = currentAyah;

  localStorage.setItem(MODE_KEY, this.value);

  renderAyahs();

  currentAyah = previousPosition;
  scrollToCurrentAyah();
  savePosition();
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
