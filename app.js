dayjs.extend(dayjs_plugin_customParseFormat);

const state = {
  shuls: [],
  userPos: null,
  tab: "now"
};

const els = {
  tabs: document.querySelectorAll(".tabs button"),
  nowList: document.getElementById("nowList"),
  nextList: document.getElementById("nextList"),
  q: document.getElementById("q"),
  nusach: document.getElementById("nusach"),
  when: document.getElementById("when"),
  clearTime: document.getElementById("clearTime"),
  manualAddress: document.getElementById("manualAddress"),
  setAddress: document.getElementById("setAddress"),
  nearMe: document.getElementById("nearMe")
};

init();

async function init() {
  await loadData();
  setupTabs();
  setupFilters();
  renderAll();
  initMap();
}

// --- טעינת נתונים ---
async function loadData() {
  const res = await fetch("data/shuls.json");
  state.shuls = await res.json();
}

// --- טאבים ---
function setupTabs() {
  els.tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      els.tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach(s => s.classList.remove("active"));
      document.getElementById(btn.dataset.tab).classList.add("active");
      state.tab = btn.dataset.tab;
      if (state.tab === "map" && map) map.invalidateSize();
    });
  });
}

// --- פילטרים ומיקום ---
function setupFilters() {
  [els.q, els.nusach, els.when].forEach(el => {
    el.addEventListener("input", renderAll);
  });

  els.clearTime.addEventListener("click", () => {
    els.when.value = "";
    renderAll();
  });

  els.nearMe.addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        renderAll();
        if (map) map.setView([state.userPos.lat, state.userPos.lng], 14);
      },
      () => alert("לא הצלחתי לאתר מיקום")
    );
  });

  els.setAddress.addEventListener("click", async () => {
    const addr = els.manualAddress.value.trim();
    if (!addr) return;
    const pos = await geocodeAddress(addr);
    if (pos) {
      state.userPos = pos;
      renderAll();
      if (map) map.setView([pos.lat, pos.lng], 14);
    } else {
      alert("לא הצלחתי למצוא את הכתובת");
    }
  });
}

// --- גיאוקוד כתובת (OSM/Nominatim) ---
async function geocodeAddress(addr) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      addr
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.length) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// --- עיבוד זמני מניינים ---
function parseTimes(arr, baseDate) {
  return (arr || []).map(t =>
    dayjs(`${baseDate.format("YYYY-MM-DD")} ${t}`, "YYYY-MM-DD HH:mm").toDate()
  );
}

function upcomingForShul(s, baseDate) {
  const weekday = s.schedule?.weekday || {};
  const times = [
    ...parseTimes(weekday.shacharit, baseDate),
    ...parseTimes(weekday.mincha, baseDate),
    ...parseTimes(weekday.maariv, baseDate)
  ]
    .filter(Boolean)
    .sort((a, b) => a - b);

  const now = baseDate.toDate();
  const next = times.find(d => d > now);
  const around = times.filter(d => Math.abs(d - now) <= 30 * 60 * 1000);
  return { next, around, all: times };
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function humanTime(d) {
  return dayjs(d).format("HH:mm");
}

function getBaseTime() {
  const t = els.when.value;
  const d = dayjs();
  if (!t) return d;
  const [HH, MM] = t.split(":");
  return d.hour(Number(HH)).minute(Number(MM)).second(0);
}

// --- הצגה ---
function renderAll() {
  const filtered = filterShuls(state.shuls);
  renderNow(filtered);
  renderNext(filtered);
  renderMarkers(filtered);
}

function filterShuls(shuls) {
  const q = (els.q.value || "").trim();
  const nus = els.nusach.value;

  return shuls.filter(s => {
    if (nus && s.nusach !== nus) return false;
    if (q) {
      const hay = `${s.name} ${s.address} ${s.nusach || ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
}

function renderNow(shuls) {
  els.nowList.innerHTML = "";
  const base = getBaseTime();
  const enriched = shuls
    .map(s => {
      const u = upcomingForShul(s, base);
      const dist = state.userPos
        ? distanceKm(state.userPos, s.pos || null)
        : null;
      return { s, u, dist };
    })
    .filter(x => x.u.around.length);

  enriched.sort((a, b) => (a.dist || 0) - (b.dist || 0));

  enriched.forEach(({ s, u, dist }) => {
    els.nowList.appendChild(cardEl(s, u.around.map(humanTime), dist));
  });
}

function renderNext(shuls) {
  els.nextList.innerHTML = "";
  const base = getBaseTime();
  const enriched = shuls
    .map(s => {
      const u = upcomingForShul(s, base);
      const dist = state.userPos
        ? distanceKm(state.userPos, s.pos || null)
        : null;
      return { s, u, dist };
    })
    .filter(x => x.u.next);

  enriched.sort((a, b) => a.u.next - b.u.next);

  enriched.forEach(({ s, u, dist }) => {
    els.nextList.appendChild(cardEl(s, [humanTime(u.next)], dist));
  });
}

function cardEl(s, times, dist) {
  const li = document.createElement("li");
  li.className = "card";
  li.innerHTML = `
    <h3>${s.name}</h3>
    <div class="meta">
      <span>📍 ${s.address}</span>
      <span>🕍 ${s.nusach || "—"}</span>
      ${dist != null ? `<span>📏 ${dist.toFixed(1)} ק״מ</span>` : ""}
    </div>
    <div class="times">🕒 ${times.join(" · ")}</div>
    <div class="meta"><a href="https://www.google.com/maps?q=${encodeURIComponent(
      s.address
    )}" target="_blank">נווט ➜</a></div>
  `;
  return li;
}

// --- מפה ---
let map, markers;
function initMap() {
  map = L.map("mapEl").setView([31.7, 35.12], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
  markers = L.layerGroup().addTo(map);

  renderMarkers(state.shuls);
}

async function renderMarkers(shuls) {
  if (!map || !markers) return;
  markers.clearLayers();

  for (const s of shuls) {
    if (!s.pos) {
      s.pos = await geocodeAddress(`${s.address}, ביתר עילית`);
    }
    if (s.pos) {
      const m = L.marker([s.pos.lat, s.pos.lng]).bindPopup(`
        <b>${s.name}</b><br/>
        ${s.address}<br/>
        נוסח: ${s.nusach || "—"}<br/>
        <a target="_blank" href="https://www.google.com/maps?q=${encodeURIComponent(
          s.address
        )}">נווט</a>
      `);
      markers.addLayer(m);
    }
  }
}
