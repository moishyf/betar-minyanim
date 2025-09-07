// dayjs פורמטים
dayjs.extend(dayjs_plugin_customParseFormat);

// ===== מצב אפליקציה =====
const state = {
  shuls: [],
  userPos: null,
  tab: "now",
  prayer: "", // shacharit | mincha | maariv | ""
  geoCache: loadGeoCache()
};
const state = {
  shuls: [],
  userPos: null,
  tab: "now",
  prayer: "",
  daytype: "weekday", // NEW: weekday | erev_shabbat | shabbat | motzei_shabbat
  geoCache: loadGeoCache()
};

const els = {
  // ...קיים...
  prayer: document.getElementById("prayer"),
  daytype: document.getElementById("daytype"), // NEW
  // ...המשך...
  dlgErevMincha: document.getElementById("dlgErevMincha"),       // NEW
  dlgKabbalat: document.getElementById("dlgKabbalat"),           // NEW
  dlgMotzaeiMaariv: document.getElementById("dlgMotzaeiMaariv")  // NEW
};

// ===== אלמנטים =====
const els = {
  // טאבונים
  tabs: document.querySelectorAll(".tabs button"),
  // פילטרים
  q: document.getElementById("q"),
  nusach: document.getElementById("nusach"),
  prayer: document.getElementById("prayer"),
  when: document.getElementById("when"),
  clearTime: document.getElementById("clearTime"),
  manualAddress: document.getElementById("manualAddress"),
  setAddress: document.getElementById("setAddress"),
  nearMe: document.getElementById("nearMe"),
  // רשימות
  nowList: document.getElementById("nowList"),
  nextList: document.getElementById("nextList"),
  shulList: document.getElementById("shulList"),
  // דיאלוג
  dlg: document.getElementById("shulDialog"),
  dlgClose: document.getElementById("dlgClose"),
  dlgName: document.getElementById("dlgName"),
  dlgMeta: document.getElementById("dlgMeta"),
  dlgShacharit: document.getElementById("dlgShacharit"),
  dlgMincha: document.getElementById("dlgMincha"),
  dlgMaariv: document.getElementById("dlgMaariv"),
  dlgLinks: document.getElementById("dlgLinks")
};

init();

// ===== Init =====
async function init() {
  await loadData();
  setupTabs();
  setupFilters();
  // רינדור ראשוני של כל המסכים, כולל רשימת בתי הכנסת
  renderAll();
  renderShulList(filterShuls(state.shuls));
  initMap();
}


// ===== טעינת נתונים =====
async function loadData() {
  const res = await fetch("data/shuls.json", { cache: "no-store" });
  state.shuls = await res.json();
  // ננרמל טקסטים
  state.shuls.forEach(s => {
    s._hay = `${s.name} ${s.address} ${s.nusach || ""}`.toLowerCase();
  });
}

// ===== טאבים =====
function setupTabs() {
  els.tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      els.tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach(s => s.classList.remove("active"));
      document.getElementById(btn.dataset.tab).classList.add("active");
      state.tab = btn.dataset.tab;
      if (state.tab === "map" && map) map.invalidateSize();
      if (state.tab === "shuls") renderShulList(filterShuls(state.shuls));
    });
  });
}

// ===== פילטרים =====
function setupFilters() {
  [els.q, els.nusach, els.when].forEach(el => el.addEventListener("input", renderAll));
  els.prayer.addEventListener("change", () => { state.prayer = els.prayer.value; renderAll(); });
  els.daytype.addEventListener("change", () => {
  state.daytype = els.daytype.value || "weekday";
  renderAll();
});

  els.clearTime.addEventListener("click", () => { els.when.value = ""; renderAll(); });

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
    const addr = (els.manualAddress.value || "").trim();
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

  // דיאלוג סגירה
  els.dlgClose.addEventListener("click", () => els.dlg.close());
  els.dlg.addEventListener("click", (e) => {
    // סגירה בלחיצה מחוץ לחלון
    const rect = els.dlg.querySelector(".dialog-inner").getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      els.dlg.close();
    }
  });
}

// ===== עזרי זמן =====
function getBaseTime() {
  const t = els.when.value;
  const d = dayjs();
  if (!t) return d;
  const [HH, MM] = t.split(":");
  return d.hour(Number(HH)).minute(Number(MM)).second(0);
}
function humanTime(d) { return dayjs(d).format("HH:mm"); }
function parseTimes(arr, baseDate) {
  return (arr || []).map(t =>
    dayjs(`${baseDate.format("YYYY-MM-DD")} ${t}`, "YYYY-MM-DD HH:mm").toDate()
  );
}
function getPrayerTimesForShul(s, baseDate, onlyPrayer = "") {
  const sch = s.schedule || {};
  const type = state.daytype || "weekday";

  if (type === "weekday") {
    const w = sch.weekday || {};
    const packs = {
      shacharit: parseTimes(w.shacharit, baseDate),
      mincha: parseTimes(w.mincha, baseDate),
      maariv: parseTimes(w.maariv, baseDate)
    };
    if (onlyPrayer) return packs[onlyPrayer] || [];
    return [...packs.shacharit, ...packs.mincha, ...packs.maariv];
  }

  if (type === "erev_shabbat") {
    const e = sch.erev_shabbat || {};
    const packs = {
      // פה ההגיון: בבחירת "תפילה" נוכל להחליט מה להציג
      // "mincha" → מנחה, "maariv" → קבלת שבת
      shacharit: [], // אין שחרית בערב שבת
      mincha: parseTimes(e.mincha, baseDate),
      maariv: parseTimes(e.kabbalat, baseDate)
    };
    if (onlyPrayer) return packs[onlyPrayer] || [];
    return [...packs.mincha, ...packs.maariv];
  }

  if (type === "shabbat") {
    const sh = sch.shabbat || {};
    const packs = {
      shacharit: parseTimes(sh.shacharit, baseDate),
      mincha: parseTimes(sh.mincha, baseDate),
      maariv: [] // מעריב של שבת לילה לא רלוונטי ביום שבת
    };
    if (onlyPrayer) return packs[onlyPrayer] || [];
    return [...packs.shacharit, ...packs.mincha];
  }

  if (type === "motzei_shabbat") {
    const m = sch.motzei_shabbat || {};
    const packs = {
      shacharit: [], mincha: [], maariv: parseTimes(m.maariv, baseDate)
    };
    if (onlyPrayer) return packs[onlyPrayer] || [];
    return [...packs.maariv];
  }

  return [];
}

function upcomingForShul(s, baseDate, onlyPrayer = "") {
  const times = getPrayerTimesForShul(s, baseDate, onlyPrayer).filter(Boolean).sort((a, b) => a - b);
  const now = baseDate.toDate();
  const next = times.find(d => d > now);
  const around = times.filter(d => Math.abs(d - now) <= 30 * 60 * 1000);
  return { next, around, all: times };
}

// ===== מרחק =====
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ===== סינון =====
function filterShuls(shuls) {
  const q = (els.q.value || "").trim().toLowerCase();
  const nus = els.nusach.value;
  return shuls.filter(s => {
    if (nus && s.nusach !== nus) return false;
    if (q && !s._hay.includes(q)) return false;
    return true;
  });
}

// ===== רינדור =====
function renderAll() {
  const filtered = filterShuls(state.shuls);
  renderNow(filtered);
  renderNext(filtered);
  if (state.tab === "shuls") renderShulList(filtered);
  renderMarkers(filtered);
}

// כרטיס כללי
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
    <div class="times">${(times || []).map(t => `<span class="chip">${t}</span>`).join("") || "—"}</div>
    <div class="meta">
      <a href="https://www.google.com/maps?q=${encodeURIComponent(s.address)}" target="_blank">נווט ➜</a>
      &nbsp;|&nbsp;
      <a href="#" data-shul-id="${s.id}" class="open-details">פרטים</a>
    </div>
  `;
  li.querySelector(".open-details").addEventListener("click", (e) => {
    e.preventDefault();
    showShulDialog(s);
  });
  return li;
}

function renderNow(shuls) {
  els.nowList.innerHTML = "";
  const base = getBaseTime();
  const p = state.prayer || ""; // אם נבחרה תפילה – נתחשב בה בלבד
  const enriched = shuls.map(s => {
    const u = upcomingForShul(s, base, p);
    const dist = state.userPos ? distanceKm(state.userPos, s.pos || null) : null;
    return { s, u, dist };
  }).filter(x => x.u.around.length);

  enriched.sort((a, b) => {
    // מיון לפי מרחק אם יש, אחרת לפי שעה
    if (a.dist != null && b.dist != null) return a.dist - b.dist;
    if (a.dist != null) return -1;
    if (b.dist != null) return 1;
    return a.u.around[0] - b.u.around[0];
  });

  enriched.forEach(({ s, u, dist }) => {
    els.nowList.appendChild(cardEl(s, u.around.map(humanTime), dist));
  });
}

function renderNext(shuls) {
  els.nextList.innerHTML = "";
  const base = getBaseTime();
  const p = state.prayer || "";
  const enriched = shuls.map(s => {
    const u = upcomingForShul(s, base, p);
    const dist = state.userPos ? distanceKm(state.userPos, s.pos || null) : null;
    return { s, u, dist };
  }).filter(x => x.u.next);

  enriched.sort((a, b) => a.u.next - b.u.next);

  enriched.forEach(({ s, u, dist }) => {
    els.nextList.appendChild(cardEl(s, [humanTime(u.next)], dist));
  });
}

// רשימת בתי כנסת (טאב "בתי כנסת")
function renderShulList(shuls) {
  els.shulList.innerHTML = "";
  shuls.forEach(s => {
    const li = document.createElement("li");
    li.className = "card clickable";
    li.innerHTML = `
      <h3>${s.name}</h3>
      <div class="meta">
        <span>📍 ${s.address}</span>
        <span>🕍 ${s.nusach || "—"}</span>
      </div>
      <div class="meta">
        <a href="#" data-shul-id="${s.id}" class="open-details">פתח כרטיסיה</a>
        &nbsp;|&nbsp;
        <a target="_blank" class="nav-link" href="https://www.google.com/maps?q=${encodeURIComponent(s.address)}">נווט</a>
      </div>
    `;

    // כל הכרטיס לחיץ
    li.addEventListener("click", () => showShulDialog(s));

    // לאפשר ללינק "נווט" לעבוד בלי לפתוח דיאלוג
    li.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", (e) => {
        e.stopPropagation();           // לא להפעיל את קליק הכרטיס
        if (!a.classList.contains("nav-link")) e.preventDefault(); // "פתח כרטיסיה" מיותר עכשיו
        if (!a.classList.contains("nav-link")) showShulDialog(s);  // תאימות לאחור
      });
    });

    els.shulList.appendChild(li);
  });
}


// ===== דיאלוג בית כנסת =====
function showShulDialog(s) {
  els.dlgName.textContent = s.name;
  els.dlgMeta.innerHTML = `📍 ${s.address} &nbsp;&nbsp; 🕍 ${s.nusach || "—"}`;

  // חול
  const w = s.schedule?.weekday || {};
  setTimesBlock(els.dlgShacharit, w.shacharit);
  setTimesBlock(els.dlgMincha, w.mincha);
  setTimesBlock(els.dlgMaariv, w.maariv);

  // ערב שבת
  const e = s.schedule?.erev_shabbat || {};
  setTimesBlock(els.dlgErevMincha, e.mincha);
  setTimesBlock(els.dlgKabbalat, e.kabbalat);

  // מוצ"ש
  const mo = s.schedule?.motzei_shabbat || {};
  setTimesBlock(els.dlgMotzaeiMaariv, mo.maariv);

  els.dlgLinks.innerHTML = `
    <a target="_blank" href="https://www.google.com/maps?q=${encodeURIComponent(s.address)}">פתח ניווט</a>
  `;
  if (typeof els.dlg.showModal === "function") els.dlg.showModal();
  else els.dlg.setAttribute("open", "");
}


// ===== גיאוקוד + קאש =====
function loadGeoCache() {
  try {
    return JSON.parse(localStorage.getItem("geoCache_v1") || "{}");
  } catch {
    return {};
  }
}
function saveGeoCache() {
  try {
    localStorage.setItem("geoCache_v1", JSON.stringify(state.geoCache));
  } catch {}
}

async function geocodeAddress(addr) {
  const key = addr.trim().toLowerCase();
  if (state.geoCache[key]) return state.geoCache[key];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "he" } });
    const data = await res.json();
    if (data && data.length) {
      const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      state.geoCache[key] = pos;
      saveGeoCache();
      return pos;
    }
  } catch (e) { console.error("geocode error", e); }
  return null;
}

// ===== מפה =====
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
      // נוסיף "ביתר עילית" לכתובת לדיוק
      s.pos = await geocodeAddress(`${s.address}, ביתר עילית`);
    }
    if (s.pos) {
      const m = L.marker([s.pos.lat, s.pos.lng]).addTo(markers);
      m.bindPopup(`
        <b>${s.name}</b><br/>
        ${s.address}<br/>
        נוסח: ${s.nusach || "—"}<br/>
        <a target="_blank" href="https://www.google.com/maps?q=${encodeURIComponent(s.address)}">נווט</a>
      `);
      m.on("click", () => showShulDialog(s));
    }
  }
}
