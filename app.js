const STORAGE_KEY = "quranReadingRecords";

const form = document.getElementById("readingForm");
const historyContainer = document.getElementById("readingHistory");

const readingDate = document.getElementById("readingDate");

readingDate.value = new Date().toLocaleDateString("en-CA");

function getRecords() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function renderHistory() {
  const records = getRecords();

  if (records.length === 0) {
    historyContainer.innerHTML =
      "<p>No reading records yet. Start today!</p>";
    return;
  }

  historyContainer.innerHTML = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(record => `
      <div class="history-item">
        <h3>${escapeHTML(record.surah)}</h3>
        <p>${escapeHTML(record.date)}</p>
        <p>Ayah ${record.startAyah} - ${record.endAyah}</p>
        <p>${record.pages} pages · Juz ${record.juz}</p>
        <p>${record.duration ? record.duration + " minutes" : "Duration not recorded"}</p>
        ${record.notes ? `<p>${escapeHTML(record.notes)}</p>` : ""}
        <button onclick="deleteRecord('${record.id}')">
          Delete
        </button>
      </div>
    `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

form.addEventListener("submit", function(event) {
  event.preventDefault();

  const startAyah = Number(document.getElementById("startAyah").value);
  const endAyah = Number(document.getElementById("endAyah").value);
  const pages = Number(document.getElementById("pages").value);
  const juz = Number(document.getElementById("juz").value);
  const duration = Number(document.getElementById("duration").value);

  if (startAyah > endAyah) {
    alert("End Ayah must be greater than or equal to Start Ayah.");
    return;
  }

  const record = {
    id: crypto.randomUUID(),
    date: readingDate.value,
    surah: document.getElementById("surah").value.trim(),
    startAyah,
    endAyah,
    pages,
    juz,
    duration,
    notes: document.getElementById("notes").value.trim()
  };

  const records = getRecords();
  records.push(record);

  saveRecords(records);

  form.reset();
  readingDate.value = new Date().toLocaleDateString("en-CA");

  renderHistory();

  alert("Your Quran reading has been saved!");
});

function deleteRecord(id) {
  if (!confirm("Delete this reading record?")) return;

  const records = getRecords().filter(record => record.id !== id);

  saveRecords(records);
  renderHistory();
}

renderHistory();
