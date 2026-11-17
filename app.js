
/* =====================================
   QURAN DAILY TRACKER
   AUTOMATIC READING + MEMORISATION
===================================== */

const READING_KEY = "quranReadingRecords";
const MEMORISATION_KEY = "quranMemorisationRecords";
const POSITION_KEY = "quranReaderPosition";

/* =====================================
   SHARED FUNCTIONS
===================================== */

function todayDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() +
      Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getRecords(key) {
  try {
    return JSON.parse(
      localStorage.getItem(key) || "[]"
    );
  } catch (error) {
    console.error("Unable to read saved records:", error);
    return [];
  }
}

function saveRecords(key, records) {
  localStorage.setItem(
    key,
    JSON.stringify(records)
  );
}

function countAyahs(start, end) {
  return Math.max(
    0,
    Number(end) - Number(start) + 1
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value + "T00:00:00");

  if (isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTime(value) {
  if (!value) return "Time unavailable";

  const date = new Date(value);

  if (isNaN(date.getTime())) return "Time unavailable";

  return date.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/* =====================================
   READING DASHBOARD
===================================== */

const readingHistory =
  document.getElementById("readingHistory");

function getReadingRecords() {
  return getRecords(READING_KEY);
}

/*
  Create unique ayah identifiers.
  This prevents repeated reading from
  inflating the overall reading statistics.
*/

function getUniqueReadingData(records) {

  const ayahs = new Set();
  const pages = new Set();
  const juz = new Set();
  const surahs = new Set();

  records.forEach(record => {

    const surahId =
      record.surahNumber ||
      String(record.surah || "Unknown")
        .trim()
        .toLowerCase();

    surahs.add(String(surahId));

    // New automatic tracking records.
    if (
      Array.isArray(record.ayahsRead) &&
      record.ayahsRead.length
    ) {

      record.ayahsRead.forEach(number => {
        ayahs.add(`${surahId}:${number}`);
      });

    } else if (
      record.startAyah &&
      record.endAyah
    ) {

      // Support older manually saved records.
      for (
        let number = Number(record.startAyah);
        number <= Number(record.endAyah);
        number++
      ) {
        ayahs.add(`${surahId}:${number}`);
      }
    }

    // Collect pages.
    if (Array.isArray(record.pages)) {

      record.pages.forEach(page => {
        pages.add(Number(page));
      });

    } else if (Number(record.pages) > 0) {

      pages.add(Number(record.pages));
    }

    // Collect Juz.
    if (Array.isArray(record.juz)) {

      record.juz.forEach(number => {
        juz.add(Number(number));
      });

    } else if (Number(record.juz) > 0) {

      juz.add(Number(record.juz));
    }
  });

  return {
    ayahs,
    pages,
    juz,
    surahs
  };
}

/* =====================================
   TODAY'S READING STATISTICS
===================================== */

function getTodayReadingData(records) {

  const today = todayDate();

  const todayRecords = records.filter(record => {

    const date = record.startedAt
      ? todayDateFromTimestamp(record.startedAt)
      : record.date;

    return date === today;
  });

  return {
    records: todayRecords,
    ...getUniqueReadingData(todayRecords)
  };
}

function todayDateFromTimestamp(timestamp) {

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =====================================
   UPDATE READING STATISTICS
===================================== */

function updateReadingStatistics(records) {

  const overall = getUniqueReadingData(records);
  const today = getTodayReadingData(records);

  // Today's statistics.
  setText("todayAyahs", today.ayahs.size);
  setText("todayPages", today.pages.size);
  setText("todayJuz", today.juz.size);
  setText("todaySurahs", today.surahs.size);

  // Overall statistics.
  setText("totalAyahs", overall.ayahs.size);
  setText("totalPages", overall.pages.size);
  setText("totalJuz", overall.juz.size);
  setText("totalSurahs", overall.surahs.size);

  // Khatam progress based on unique ayahs.
  const totalQuranAyahs = 6236;

  const percentage = Math.min(
    100,
    (overall.ayahs.size / totalQuranAyahs) * 100
  );

  const equivalentJuz =
    (overall.ayahs.size / totalQuranAyahs) * 30;

  setText(
    "khatamJuz",
    `${equivalentJuz.toFixed(1)} / 30 Juz`
  );

  setText(
    "khatamPercentage",
    `${percentage.toFixed(1)}% completed`
  );

  const progressBar = document.getElementById(
    "khatamProgressBar"
  );

  if (progressBar) {
    progressBar.style.width = percentage + "%";
  }
}

function setText(id, value) {

  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

/* =====================================
   LAST READING POSITION
===================================== */

function updateLastReadingPosition() {

  const element = document.getElementById(
    "lastReadingPosition"
  );

  if (!element) return;

  try {

    const position = JSON.parse(
      localStorage.getItem(POSITION_KEY) || "null"
    );

    if (
      !position ||
      !position.surah ||
      !position.ayah
    ) {
      element.textContent =
        "No reading recorded yet";
      return;
    }

    const records = getReadingRecords();

    const matchingRecord = records.find(record =>
      Number(record.surahNumber) ===
      Number(position.surah)
    );

    const surahName = matchingRecord
      ? matchingRecord.surah
      : `Surah ${position.surah}`;

    element.textContent =
      `${surahName} · Ayah ${position.ayah}`;

  } catch (error) {

    console.error(error);

    element.textContent =
      "No reading position available";
  }
}

/* =====================================
   READING HISTORY
===================================== */

function renderReadingHistory() {

  if (!readingHistory) return;

  const records = getReadingRecords();

  if (!records.length) {

    readingHistory.innerHTML = `
      <p>No reading records yet.</p>
      <p class="section-description">
        Open Quran Reader and start reading.
        Your progress will appear here automatically.
      </p>
    `;

    updateReadingStatistics(records);
    updateLastReadingPosition();

    return;
  }

  const sortedRecords = records.slice().sort((a, b) => {

    const timeA = new Date(
      a.startedAt || a.savedAt || a.date || 0
    ).getTime();

    const timeB = new Date(
      b.startedAt || b.savedAt || b.date || 0
    ).getTime();

    return timeB - timeA;
  });

  readingHistory.innerHTML = sortedRecords.map(record => {

    const startTime = record.startedAt
      ? formatTime(record.startedAt)
      : "Time unavailable";

    const date = record.startedAt
      ? formatDate(todayDateFromTimestamp(record.startedAt))
      : formatDate(record.date);

    const pages = Array.isArray(record.pages)
      ? record.pages.join(", ")
      : (record.pages || "Not available");

    const juz = Array.isArray(record.juz)
      ? record.juz.join(", ")
      : (record.juz || "Not available");

    const ayahCount = Array.isArray(record.ayahsRead)
      ? new Set(record.ayahsRead).size
      : countAyahs(record.startAyah, record.endAyah);

    return `

      <div class="history-item">

        <h3>${escapeHTML(record.surah)}</h3>

        <p>📅 ${escapeHTML(date)}</p>

        <p>🕒 Started at: ${escapeHTML(startTime)}</p>

        <p>
          Ayah ${escapeHTML(record.startAyah)}
          – ${escapeHTML(record.endAyah)}
        </p>

        <p>
          ${ayahCount} unique ayahs read
        </p>

        <p>
          Pages: ${escapeHTML(pages)}
        </p>

        <p>
          Juz: ${escapeHTML(juz)}
        </p>

        <button
          type="button"
          onclick="deleteReadingRecord('${escapeHTML(record.id)}')"
        >
          Delete Record
        </button>

      </div>

    `;

  }).join("");

  updateReadingStatistics(records);
  updateLastReadingPosition();
}

/* =====================================
   DELETE READING RECORD
===================================== */

function deleteReadingRecord(id) {

  if (!confirm("Delete this reading record?")) return;

  const records = getReadingRecords().filter(record =>
    record.id !== id
  );

  saveRecords(READING_KEY, records);

  renderReadingHistory();
}

/* =====================================
   MEMORISATION DASHBOARD
===================================== */

const memorisationForm =
  document.getElementById("memorisationForm");

const memorisationHistory =
  document.getElementById("memorisationHistory");

const memorisationDate =
  document.getElementById("memorisationDate");

if (memorisationDate) {
  memorisationDate.value = todayDate();
}

/* =====================================
   RENDER MEMORISATION HISTORY
===================================== */

function renderMemorisationHistory() {

  if (!memorisationHistory) return;

  const records = getRecords(MEMORISATION_KEY);

  if (records.length === 0) {

    memorisationHistory.innerHTML =
      "<p>No memorisation records yet. Start your Hifz journey!</p>";

    updateMemorisationStatistics(records);

    return;
  }

  memorisationHistory.innerHTML = records
    .slice()
    .sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    )
    .map(record => `

      <div class="history-item">

        <h3>${escapeHTML(record.surah)}</h3>

        <p>${escapeHTML(record.date)}</p>

        <p>${escapeHTML(record.activity)}</p>

        <p>
          Ayah ${escapeHTML(record.startAyah)}
          - ${escapeHTML(record.endAyah)}
        </p>

        <p>Status: ${escapeHTML(record.status)}</p>

        ${
          record.notes
            ? `<p>${escapeHTML(record.notes)}</p>`
            : ""
        }

        <button
          type="button"
          onclick="deleteMemorisationRecord('${escapeHTML(record.id)}')"
        >
          Delete
        </button>

      </div>

    `).join("");

  updateMemorisationStatistics(records);
}

/* =====================================
   SAVE MEMORISATION RECORD
===================================== */

if (memorisationForm) {

  memorisationForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const startAyah = Number(
      document.getElementById("memoryStartAyah").value
    );

    const endAyah = Number(
      document.getElementById("memoryEndAyah").value
    );

    if (
      startAyah < 1 ||
      endAyah < startAyah
    ) {
      alert("Please check your ayah range.");
      return;
    }

    const record = {

      id: createId(),

      date: memorisationDate.value,

      activity:
        document.getElementById("memoryActivity").value,

      surah:
        document.getElementById("memorySurah").value.trim(),

      startAyah,
      endAyah,

      status:
        document.getElementById("memoryStatus").value,

      notes:
        document.getElementById("memoryNotes").value.trim(),

      savedAt: new Date().toISOString()
    };

    if (
      !record.date ||
      !record.activity ||
      !record.surah ||
      !record.status
    ) {
      alert("Please complete all required fields.");
      return;
    }

    const records = getRecords(MEMORISATION_KEY);

    records.push(record);

    saveRecords(MEMORISATION_KEY, records);

    memorisationForm.reset();

    memorisationDate.value = todayDate();

    renderMemorisationHistory();

    alert("Your memorisation record has been saved!");

  });
}

/* =====================================
   DELETE MEMORISATION RECORD
===================================== */

function deleteMemorisationRecord(id) {

  if (!confirm("Delete this memorisation record?")) return;

  const records = getRecords(MEMORISATION_KEY)
    .filter(record => record.id !== id);

  saveRecords(MEMORISATION_KEY, records);

  renderMemorisationHistory();
}

/* =====================================
   MEMORISATION STATISTICS
===================================== */

function updateMemorisationStatistics(records) {

  const newAyahCount = records
    .filter(record =>
      record.activity === "New Memorisation"
    )
    .reduce((total, record) =>
      total + countAyahs(
        record.startAyah,
        record.endAyah
      ), 0);

  const revisionCount = records
    .filter(record =>
      record.activity === "Revision (Murajaah)"
    )
    .reduce((total, record) =>
      total + countAyahs(
        record.startAyah,
        record.endAyah
      ), 0);

  const testCount = records
    .filter(record =>
      record.activity === "Memorisation Test"
    )
    .length;

  const retainedRecords = records.filter(record =>
    record.status === "Memorised" ||
    record.status === "Well Retained"
  );

  const retainedSurahs = new Set(
    retainedRecords.map(record =>
      record.surah.trim().toLowerCase()
    )
  );

  const retainedAyahs = new Set();

  retainedRecords.forEach(record => {

    for (
      let ayah = Number(record.startAyah);
      ayah <= Number(record.endAyah);
      ayah++
    ) {

      retainedAyahs.add(
        record.surah.trim().toLowerCase() +
        ":" + ayah
      );
    }
  });

  const memorisedCount = retainedAyahs.size;

  const elements = {

    newAyahCount,
    revisionCount,
    testCount,

    surahCount: retainedSurahs.size,

    memorisedCount
  };

  Object.entries(elements).forEach(([id, value]) => {

    const element = document.getElementById(id);

    if (element) {

      element.textContent =
        id === "memorisedCount"
          ? value + " Ayahs"
          : value;
    }
  });

  const progress = document.getElementById(
    "memorisationProgress"
  );

  if (progress) {

    const percentage = Math.min(
      100,
      (memorisedCount / 6236) * 100
    );

    progress.style.width =
      percentage + "%";
  }
}

/* =====================================
   INITIALISE CURRENT PAGE
===================================== */

renderReadingHistory();
renderMemorisationHistory();
