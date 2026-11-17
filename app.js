
/* =====================================
   QURAN DAILY TRACKER
   Reading + Memorisation
===================================== */

const READING_KEY = "quranReadingRecords";
const MEMORISATION_KEY = "quranMemorisationRecords";

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
    : Date.now().toString() + Math.random().toString(36).slice(2);
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
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (error) {
    console.error("Unable to read saved records:", error);
    return [];
  }
}

function saveRecords(key, records) {
  localStorage.setItem(key, JSON.stringify(records));
}

function countAyahs(start, end) {
  return Math.max(0, Number(end) - Number(start) + 1);
}

/* =====================================
   READING DASHBOARD
===================================== */

const readingForm = document.getElementById("readingForm");
const readingHistory = document.getElementById("readingHistory");
const readingDate = document.getElementById("readingDate");

if (readingDate) {
  readingDate.value = todayDate();
}

function renderReadingHistory() {
  if (!readingHistory) return;

  const records = getRecords(READING_KEY);

  if (records.length === 0) {
    readingHistory.innerHTML =
      "<p>No reading records yet. Start today!</p>";
    return;
  }

  readingHistory.innerHTML = records
    .slice()
    .sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    )
    .map(record => `
      <div class="history-item">
        <h3>${escapeHTML(record.surah)}</h3>
        <p>${escapeHTML(record.date)}</p>
        <p>Ayah ${escapeHTML(record.startAyah)} -
           ${escapeHTML(record.endAyah)}</p>
        <p>${escapeHTML(record.pages)} pages ·
           Juz ${escapeHTML(record.juz)}</p>
        ${
          record.duration
            ? `<p>${escapeHTML(record.duration)} minutes</p>`
            : ""
        }
        ${
          record.notes
            ? `<p>${escapeHTML(record.notes)}</p>`
            : ""
        }
        <button type="button"
          onclick="deleteReadingRecord('${record.id}')">
          Delete
        </button>
      </div>
    `).join("");
}

if (readingForm) {
  readingForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const startAyah = Number(
      document.getElementById("startAyah").value
    );

    const endAyah = Number(
      document.getElementById("endAyah").value
    );

    const pages = Number(
      document.getElementById("pages").value
    );

    const juz = Number(
      document.getElementById("juz").value
    );

    if (
      startAyah < 1 ||
      endAyah < startAyah ||
      pages < 1 ||
      juz < 1 ||
      juz > 30
    ) {
      alert("Please check your reading details.");
      return;
    }

    const record = {
      id: createId(),
      date: readingDate.value,
      surah: document.getElementById("surah").value.trim(),
      startAyah,
      endAyah,
      pages,
      juz,
      notes: document.getElementById("notes").value.trim(),
      savedAt: new Date().toISOString()
    };

    if (!record.surah || !record.date) {
      alert("Please complete all required fields.");
      return;
    }

    const records = getRecords(READING_KEY);
    records.push(record);

    saveRecords(READING_KEY, records);

    readingForm.reset();
    readingDate.value = todayDate();

    renderReadingHistory();

    alert("Your Quran reading has been saved!");
  });
}

function deleteReadingRecord(id) {
  if (!confirm("Delete this reading record?")) return;

  const records = getRecords(READING_KEY)
    .filter(record => record.id !== id);

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
        <p>Ayah ${escapeHTML(record.startAyah)} -
           ${escapeHTML(record.endAyah)}</p>
        <p>Status: ${escapeHTML(record.status)}</p>
        ${
          record.notes
            ? `<p>${escapeHTML(record.notes)}</p>`
            : ""
        }
        <button type="button"
          onclick="deleteMemorisationRecord('${record.id}')">
          Delete
        </button>
      </div>
    `).join("");

  updateMemorisationStatistics(records);
}

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
      activity: document.getElementById("memoryActivity").value,
      surah: document.getElementById("memorySurah").value.trim(),
      startAyah,
      endAyah,
      status: document.getElementById("memoryStatus").value,
      notes: document.getElementById("memoryNotes").value.trim(),
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
    .filter(record => record.activity === "New Memorisation")
    .reduce((total, record) =>
      total + countAyahs(record.startAyah, record.endAyah), 0);

  const revisionCount = records
    .filter(record => record.activity === "Revision (Murajaah)")
    .reduce((total, record) =>
      total + countAyahs(record.startAyah, record.endAyah), 0);

  const testCount = records
    .filter(record => record.activity === "Memorisation Test")
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

  // Count unique ayahs marked Memorised or Well Retained.
  // This avoids counting the same ayah twice.
  const retainedAyahs = new Set();

  retainedRecords.forEach(record => {
    for (
      let ayah = Number(record.startAyah);
      ayah <= Number(record.endAyah);
      ayah++
    ) {
      retainedAyahs.add(
        record.surah.trim().toLowerCase() + ":" + ayah
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

    progress.style.width = percentage + "%";
  }
}

/* =====================================
   INITIALISE CURRENT PAGE
===================================== */

renderReadingHistory();
renderMemorisationHistory();
