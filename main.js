import { sfx } from "./sfx.js";

const DISCORD_ID = "262467539685212160";
const SECTIONS = ["about", "repos", "socials", "settings"];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- storage (never trusted to exist) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// Music always starts when you enter the site. Turning it off only lasts for
// this tab (sessionStorage), so an old "off" can't silence every future visit.
// Everything else is remembered in localStorage as before.
const settings = Object.assign({ sfx: true, video: true, calm: false }, store.get("settings", {}));
delete settings.sound;
settings.music = (() => { try { return sessionStorage.getItem("musicOff") !== "1"; } catch { return true; } })();
const saveSettings = () => {
  const { music, ...rest } = settings;
  store.set("settings", rest);
  try { music ? sessionStorage.removeItem("musicOff") : sessionStorage.setItem("musicOff", "1"); } catch {}
};
sfx.enabled = settings.sfx;

/* ---------- ui sounds: hover + click, everywhere ---------- */
const INTERACTIVE = "button, a, .opt, input[type=search]";
let hovered = null;
addEventListener("pointerdown", () => sfx.unlock(), { capture: true });
addEventListener("keydown", () => sfx.unlock(), { capture: true });
document.addEventListener("pointerover", (e) => {
  const el = e.target.closest(INTERACTIVE);
  if (el === hovered) return;
  hovered = el;
  // menu buttons sound through select() so wheel/keys and mouse match
  if (el && !el.closest("#menu")) sfx.play("hover");
});
document.addEventListener("click", (e) => {
  const el = e.target.closest(INTERACTIVE);
  // [data-nav] elements make their own open/back sound in go()
  if (!el || el.closest("[data-nav]") || el.matches("input[type=search]")) return;
  sfx.play(el.matches(".opt, [role=tab]") ? "toggle" : "select");
});

/* ---------- enter screen ----------
   Clicking (or Enter / Space) parts the cover like curtains: a gold seam
   flashes across the middle, then the halves slide away top and bottom,
   while the scene settles in and the menu slides in.
   The click also counts as the visitor's first gesture, so music and menu
   sounds are allowed to start right away. */
let entered = false;
function enterSite(e) {
  if (entered) return;
  entered = true;
  const splash = $("#splash");
  splash.classList.add("opening");
  sfx.unlock();
  sfx.play("open");
  if (settings.music) startMusic();
  $("#home").classList.add("entering");
  document.body.classList.remove("is-locked");
  // the curtains finish in ~1.3s; remove the cover afterwards no matter what
  setTimeout(() => splash.classList.add("gone"), settings.calm ? 0 : 1400);
  setTimeout(() => $("#home").classList.remove("entering"), 2200);
  if (!current) setTimeout(() => menuBtns[sel]?.focus({ preventScroll: true }), 900);
}
$("#splash").addEventListener("click", enterSite);
$("#splash").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterSite(); }
});
$("#splash").focus({ preventScroll: true });

/* ---------- clock + birthday ---------- */
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
function tick() {
  $("#clock").textContent = fmt.format(new Date()).toLowerCase();
  const now = new Date();
  let next = new Date(now.getFullYear(), 5, 12);
  if (next <= now) next = new Date(now.getFullYear() + 1, 5, 12);
  let s = Math.floor((next - now) / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  $("#bdayCount").textContent = `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}
tick();
setInterval(tick, 1000);

/* ============================================================
   menu + scene camera
   ============================================================ */
const body = document.body;
const menuBtns = $$("#menu button");
const column = $("#column");
const brand = $("#brand");
let sel = 0;
let current = null; // open section name, or null on home
let busy = false;

menuBtns.forEach((b, i) => b.style.setProperty("--n", i));
$(".home-hint").style.setProperty("--n", menuBtns.length);

function camera(x, y, z) {
  const r = document.documentElement.style;
  r.setProperty("--cx", `${x}%`);
  r.setProperty("--cy", `${y}%`);
  r.setProperty("--cz", z);
}
// home: the eye sits center; each menu item nudges the frame a little.
// sections: slide the eye left so it stays visible beside the column.
// home: push the scene right and in a little so the character on the cliff
// sits just beside the menu instead of behind it; each item nudges the frame.
// sections: ease back so the left side of the landscape stays in view.
const CHAR_X = 0.42; // where the sleeping character sits across the video frame (0..1)
const BLEED = 1.14; // .scene is inset -7% on each side

// Work out the pan (% of the scene) and zoom that put the character at
// screen x = targetX, zooming in only as much as needed to avoid showing edges.
function frameCharacter(targetX, zMin, zMax = 1.2) {
  const W = innerWidth, H = innerHeight;
  const sw = W * BLEED, sh = H * BLEED;
  const s = Math.max(sw / 1920, sh / 1080); // object-fit: cover
  const dispW = 1920 * s;
  const fromCenter = (sw - dispW) / 2 + CHAR_X * dispW - sw / 2;
  let z = zMin, tx = 0;
  for (; z <= zMax; z += 0.02) {
    tx = targetX - W / 2 - fromCenter * z;
    if (Math.abs(tx) <= (sw * z) / 2 - W / 2) break;
  }
  z = Math.min(z, zMax);
  const limit = (sw * z) / 2 - W / 2;
  tx = Math.max(-limit, Math.min(limit, tx));
  return [(tx / sw) * 100, z];
}
const homeCamera = () => {
  if (innerWidth <= 820) return camera(0, sel * 0.5, 1.02);
  // clear both the menu and the name above it
  const right = Math.max($("#menu").getBoundingClientRect().right, $("#brand").getBoundingClientRect().right);
  const [x, z] = frameCharacter(right + innerWidth * 0.06 + sel * 6, 1.08);
  camera(x, -1 + sel * 0.5, z);
};
const sectionCamera = (i) => {
  if (innerWidth <= 820) return camera(0, -2, 1.08);
  const [x, z] = frameCharacter(innerWidth * 0.24 + i * 6, 1.06);
  camera(x, -1, z);
};
addEventListener("resize", () => (current ? sectionCamera(SECTIONS.indexOf(current)) : homeCamera()));

function select(i, quiet = false) {
  const next = (i + menuBtns.length) % menuBtns.length;
  if (next !== sel && !quiet && !current) sfx.play("hover");
  sel = next;
  menuBtns.forEach((b, j) => b.classList.toggle("sel", j === sel));
  if (!current) homeCamera();
}
select(0);

menuBtns.forEach((b, i) => {
  b.addEventListener("mouseenter", () => !current && select(i));
  b.addEventListener("focus", () => !current && select(i));
  b.addEventListener("click", () => go(b.dataset.go));
});

/* wheel moves the selection like a game menu */
let wheelAcc = 0, wheelLock = 0;
addEventListener("wheel", (e) => {
  if (current || !entered) return;
  wheelAcc += e.deltaY;
  const now = performance.now();
  if (Math.abs(wheelAcc) < 30 || now < wheelLock) return;
  select(sel + Math.sign(wheelAcc));
  wheelAcc = 0;
  wheelLock = now + 160;
}, { passive: true });

addEventListener("keydown", (e) => {
  if (!entered) return; // the enter screen handles its own keys
  const typing = e.target.matches("input[type=search]");
  if (!current) {
    if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); select(sel + 1); }
    else if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); select(sel - 1); }
    else if (["Enter", " ", "ArrowRight", "d", "D"].includes(e.key) && !e.target.matches("button")) { e.preventDefault(); go(menuBtns[sel].dataset.go); }
  } else if (e.key === "Escape" || (e.key === "ArrowLeft" && !typing) || (e.key === "Backspace" && !typing)) {
    e.preventDefault();
    go(null);
  }
});

/* ---------- section rendering ---------- */
function renderSection(name) {
  const sec = $(`[data-section="${name}"]`);
  $$("[data-section]").forEach((s) => (s.hidden = s !== sec));
  $("#columnTitle").textContent = sec.dataset.title;
  const subs = $$("[data-sub]", sec);
  const tabs = $("#subtabs");
  tabs.innerHTML = "";
  subs.forEach((sub, i) => {
    const t = document.createElement("button");
    t.role = "tab";
    t.textContent = sub.dataset.sub;
    t.setAttribute("aria-selected", i === 0);
    t.addEventListener("click", () => showSub(sec, i));
    tabs.append(t);
  });
  showSub(sec, 0);
  if (name === "repos") loadRepos();
  if (name === "about") { renderMusic(); loadRepos(); loadHistory(); }
}
function showSub(sec, i) {
  $$("[data-sub]", sec).forEach((s, j) => (s.hidden = j !== i));
  $$("#subtabs button").forEach((t, j) => t.setAttribute("aria-selected", j === i));
  $("#pane").scrollTop = 0;
}

const reveals = [$("#columnSlot"), $(".column-head"), $("#subtabs"), $("#pane")];
reveals.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--n", i); });

/* ---------- navigation ---------- */
async function go(name, { push = true } = {}) {
  if (busy || name === current) return;
  busy = true;
  if (push) history.pushState(null, "", name ? `#${name}` : location.pathname);
  sfx.play(!name ? "back" : current ? "select" : "open");

  if (name && current) {
    // section -> section
    column.classList.add("out");
    await wait(220);
    renderSection(name);
    column.classList.remove("out");
    sectionCamera(SECTIONS.indexOf(name));
  } else if (name) {
    // home -> section
    select(SECTIONS.indexOf(name), true);
    renderSection(name);
    column.classList.remove("out", "in");
    const a = brand.getBoundingClientRect();
    body.classList.replace("is-home", "is-section");
    flipBrandFrom(a, $("#columnSlot"));
    sectionCamera(SECTIONS.indexOf(name));
    void column.offsetWidth;
    column.classList.add("in");
    $("#back").focus({ preventScroll: true });
  } else {
    // section -> home
    column.classList.add("out");
    column.classList.remove("in");
    await wait(settings.calm ? 0 : 200);
    const a = brand.getBoundingClientRect();
    body.classList.replace("is-section", "is-home");
    flipBrandFrom(a, $("#homeSlot"));
    homeCamera();
    menuBtns[sel].focus({ preventScroll: true });
  }
  current = name;
  await wait(settings.calm ? 0 : 450);
  busy = false;
}
function flipBrandFrom(a, target) {
  target.append(brand);
  const b = brand.getBoundingClientRect();
  if (!a.width || !b.width || settings.calm) return;
  // anchor the scale on the side the brand is aligned to in its new home
  const toRight = getComputedStyle(target).justifyContent === "flex-end";
  brand.style.transformOrigin = toRight ? "top right" : "top left";
  const dx = toRight ? a.right - b.right : a.left - b.left;
  brand.animate(
    [{ transform: `translate(${dx}px, ${a.top - b.top}px) scale(${a.width / b.width})` }, { transform: "none" }],
    { duration: 900, easing: "cubic-bezier(.7,0,.2,1)" }
  );
}

$("#back").addEventListener("click", () => go(null));
brand.addEventListener("click", (e) => { e.preventDefault(); go(null); });
$$('a[href^="#"]').forEach((a) => {
  const h = a.getAttribute("href").slice(1);
  if (SECTIONS.includes(h)) { a.dataset.nav = ""; a.addEventListener("click", (e) => { e.preventDefault(); go(h); }); }
});
addEventListener("popstate", () => {
  const h = location.hash.slice(1);
  go(SECTIONS.includes(h) ? h : null, { push: false });
});

/* ============================================================
   github contributions (drawn as our own grid)
   ============================================================ */
(async () => {
  const grid = $("#ghGrid");
  try {
    const j = await fetch("https://github-contributions-api.jogruber.de/v4/xtpm?y=last").then((r) => r.json());
    const days = j.contributions;
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    // pad the first column so each row is a weekday (sun at the top)
    const lead = new Date(days[0].date + "T00:00").getDay();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<i class="pad"></i>');
    for (const d of days) {
      const label = `${d.count} contribution${d.count === 1 ? "" : "s"} on ${d.date}`;
      cells.push(`<i data-l="${d.level}" title="${label}"></i>`);
    }
    grid.innerHTML = cells.join("");
    const weeks = Math.ceil(cells.length / 7);
    $("#ghMonths").style.setProperty("--weeks", weeks);
    grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;

    // a month label above the first week that starts in that month
    const labels = Array(weeks).fill("");
    let lastMonth = -1;
    days.forEach((d, i) => {
      const m = new Date(d.date + "T00:00").getMonth();
      const w = Math.floor((i + lead) / 7);
      if (m !== lastMonth && w < weeks - 1) { labels[w] = MONTHS[m]; lastMonth = m; }
    });
    // skip a label if the previous one is too close to fit
    let prev = -9;
    $("#ghMonths").innerHTML = labels.map((t, w) => {
      if (!t || w - prev < 3) return "<span></span>";
      prev = w;
      return `<span>${t}</span>`;
    }).join("");
    $("#ghTotal").textContent = `${j.total.lastYear} this year`;
  } catch {
    // if the data service is down, fall back to the plain image
    grid.style.display = "block";
    grid.innerHTML = '<img src="https://ghchart.rshah.org/4fc3f7/xtpm" alt="" style="width:100%;filter:invert(1) hue-rotate(180deg);mix-blend-mode:screen" />';
  }
})();

/* ============================================================
   lanyard presence
   ============================================================ */
const STATUS = { online: ["#3ba55d", "online"], idle: ["#faa81a", "idle"], dnd: ["#ed4245", "do not disturb"], offline: ["#747f8d", "offline"] };
let spotify = null;

// a "play" is a track plus when it started, same as the worker logs it
const playFrom = (sp) => ({
  id: sp.track_id, song: sp.song, artist: sp.artist, album: sp.album, art: sp.album_art_url,
  start: sp.timestamps?.start ?? Date.now(), end: sp.timestamps?.end ?? null,
});

function applyPresence(d) {
  const u = d.discord_user;
  if (u?.avatar) $("#dAvatar").src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=128`;
  const [color, label] = STATUS[d.discord_status] || STATUS.offline;
  $("#dDot").style.background = color;
  $("#dDot").style.color = color;
  $("#dStatus").textContent = `${label} on discord`;

  const acts = d.activities || [];
  const custom = acts.find((a) => a.type === 4);
  const act = acts.find((a) => a.type !== 4 && a.name !== "Spotify");
  $("#msg").textContent = custom?.state || "";
  $("#actTitle").textContent = act ? act.name : "not doing anything";
  $("#actSub").textContent = act ? [act.details, act.state].filter(Boolean).join(" · ") || "in progress" : "discord is quiet.";

  const next = d.listening_to_spotify ? d.spotify : null;
  // the song changed (or stopped): the one that was playing goes into
  // "recently played" right away, without waiting for the worker
  if (spotify && (!next || next.track_id !== spotify.track_id || next.timestamps?.start !== spotify.timestamps?.start)) {
    notePlay(playFrom(spotify));
  }
  spotify = next;
  renderMusic();
  renderHistory();
}

// fallback: plain polling, only used while the live connection is down
async function presence() {
  try {
    const j = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`).then((r) => r.json());
    if (j.success) applyPresence(j.data);
  } catch {
    $("#msg").textContent = "";
  }
}

/* live presence: Lanyard pushes changes over a websocket the moment Discord
   sees them, instead of us asking every few seconds */
let liveSocket = null;
function connectLive(retry = 1000) {
  let beat;
  let ws;
  try { ws = new WebSocket("wss://api.lanyard.rest/socket"); } catch { return; }
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.op === 1) {
      // hello: start heartbeats, then subscribe
      beat = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })), m.d.heartbeat_interval);
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
    } else if (m.op === 0 && (m.t === "INIT_STATE" || m.t === "PRESENCE_UPDATE")) {
      liveSocket = ws;
      retry = 1000;
      applyPresence(m.d);
    }
  };
  ws.onclose = () => {
    clearInterval(beat);
    if (liveSocket === ws) liveSocket = null;
    setTimeout(() => connectLive(Math.min(retry * 2, 30000)), retry);
  };
}
presence();
connectLive();
setInterval(() => { if (!liveSocket) presence(); }, 15000);

/* ============================================================
   repos (live from the github api)
   ============================================================ */
const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", CSS: "#a978e6", HTML: "#e34c26", "C++": "#f34b7d",
  C: "#8d9bb0", Python: "#3572a5", Rust: "#dea584", Go: "#00add8", Lua: "#5b6cf0", Java: "#b07219", Shell: "#89e051",
};
let repos = null;
let reposPromise = null;

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function loadRepos() {
  if (!reposPromise) {
    reposPromise = (async () => {
      // github allows 60 unauthenticated requests an hour, so keep a 10 minute copy
      let data = null;
      try {
        const cached = JSON.parse(sessionStorage.getItem("repos2") || "null");
        if (cached && Date.now() - cached.t < 600000) data = cached.data;
      } catch {}
      if (!data) {
        const r = await fetch("https://api.github.com/users/xtpm/repos?sort=pushed&per_page=100");
        if (!r.ok) throw new Error(r.status);
        data = (await r.json())
          .filter((x) => !x.fork)
          .map((x) => ({
            name: x.name, desc: x.description, lang: x.language, stars: x.stargazers_count,
            pushed: x.pushed_at, created: x.created_at, url: x.html_url, site: x.homepage,
            branch: x.default_branch, topics: x.topics || [],
          }));
        try { sessionStorage.setItem("repos2", JSON.stringify({ t: Date.now(), data })); } catch {}
      }
      repos = data;
      $("#repoCount").textContent = repos.length;
      drawRepos();
      renderLastWorked();
    })().catch(() => {
      reposPromise = null; // allow a retry next time the tab opens
      $("#repoList").innerHTML = '<p class="empty">couldn\'t reach github right now. <a class="u" href="https://github.com/xtpm" target="_blank" rel="noopener">see them there</a></p>';
    });
  }
  return reposPromise;
}

/* Turn a README into a short plain-text summary: the descriptive paragraphs
   and feature bullets, skipping setup/install/run sections and code. */
const SKIP_SECTION = /^(setup|install|installation|run|run locally|running|local development|development|dev|usage|build|building|requirements|prerequisites|getting started|quick ?start|license|contributing|scripts|deploy|deployment|configuration|config|env|environment|commands|controls|troubleshooting|music|credits|assets|notes|todo|changelog|files|project structure|structure|faq)\b/i;
// keep summaries short: cut at a word boundary
const trim = (s, n = 300) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,.;:]$/, "") + "…");
function summarize(md) {
  const clean = (s) => s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  md = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const paras = [], bullets = [];
  let section = "", buf = [];
  const flush = () => { if (buf.length) { paras.push(buf.join(" ")); buf = []; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) { flush(); section = clean(h[1]); continue; }
    if (SKIP_SECTION.test(section)) continue;
    if (!line) { flush(); continue; }
    if (/^\|/.test(line) || /^---+$/.test(line)) continue;
    const li = line.match(/^(?:[-*+]|\d+\.)\s+(.*)/);
    if (li) { flush(); bullets.push(li[1]); continue; }
    buf.push(line);
  }
  flush();
  return {
    paras: paras.map(clean).filter((p) => p.length > 3).slice(0, 2).map((p) => trim(p)),
    bullets: bullets.map(clean).filter(Boolean).slice(0, 5),
  };
}

const readmes = new Map();
async function readme(r) {
  if (readmes.has(r.name)) return readmes.get(r.name);
  let text = null;
  for (const f of ["README.md", "readme.md", "Readme.md"]) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/xtpm/${r.name}/${r.branch || "main"}/${f}`);
      if (res.ok) { text = await res.text(); break; }
    } catch {}
  }
  readmes.set(r.name, text);
  return text;
}

const monthYear = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toLowerCase();

function repoRow(r) {
  const row = document.createElement("div");
  row.className = "repo";
  row.innerHTML = `
    <button class="repo-main" aria-expanded="false">
      <b><span class="repo-name"></span><i class="repo-toggle" aria-hidden="true">+</i></b>
      <span class="repo-desc"></span>
      <span class="repo-meta"></span>
    </button>
    <div class="repo-more"><div class="repo-more-inner"></div></div>`;
  $(".repo-name", row).textContent = r.name;
  $(".repo-desc", row).textContent = r.desc || "no description";
  const meta = [];
  if (r.lang) meta.push(`<span><i class="dot" style="background:${LANG_COLORS[r.lang] || "#9aa"}"></i>${r.lang}</span>`);
  if (r.stars) meta.push(`<span>★ ${r.stars}</span>`);
  meta.push(`<span>${ago(r.pushed)}</span>`);
  $(".repo-meta", row).innerHTML = meta.join("");
  $(".repo-main", row).addEventListener("click", () => toggleRepo(row, r));
  return row;
}

async function toggleRepo(row, r) {
  const btn = $(".repo-main", row);
  const open = btn.getAttribute("aria-expanded") !== "true";
  // only one open at a time
  $$(".repo.open").forEach((o) => { if (o !== row) { o.classList.remove("open"); $(".repo-main", o).setAttribute("aria-expanded", "false"); } });
  row.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", open);
  if (!open || row.dataset.filled) return;
  row.dataset.filled = "1";

  const inner = $(".repo-more-inner", row);
  inner.innerHTML = '<p class="repo-loading">reading the readme…</p>';
  const md = await readme(r);
  const { paras, bullets } = md ? summarize(md) : { paras: [], bullets: [] };

  inner.innerHTML = "";
  const about = document.createElement("div");
  about.className = "repo-about";
  if (!paras.length && !bullets.length) {
    const p = document.createElement("p");
    p.textContent = r.desc ? r.desc : "no readme yet, so the code will have to speak for itself.";
    about.append(p);
  }
  paras.forEach((t) => { const p = document.createElement("p"); p.textContent = t; about.append(p); });
  if (bullets.length) {
    const ul = document.createElement("ul");
    bullets.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.append(li); });
    about.append(ul);
  }
  inner.append(about);

  const facts = document.createElement("dl");
  facts.className = "repo-facts";
  const add = (k, v) => { if (!v) return; const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd></dd>"; d.firstChild.textContent = k; d.lastChild.textContent = v; facts.append(d); };
  add("started", monthYear(r.created));
  add("updated", ago(r.pushed));
  add("language", r.lang);
  if (r.topics.length) add("topics", r.topics.join(", "));
  inner.append(facts);

  const actions = document.createElement("div");
  actions.className = "repo-actions";
  const link = (href, text) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text; actions.append(a); };
  link(r.url, "view on github ↗");
  if (r.site) link(r.site, "visit site ↗");
  inner.append(actions);
}

function drawRepos() {
  if (!repos) return;
  const q = $("#repoSearch").value.trim().toLowerCase();
  const items = repos.filter((r) => !q || [r.name, r.desc, r.lang].join(" ").toLowerCase().includes(q));
  $("#repoList").replaceChildren(...items.map(repoRow));
  if (!items.length) $("#repoList").innerHTML = '<p class="empty">nothing matches that search.</p>';
}
$("#repoSearch").addEventListener("input", drawRepos);

/* ---------- last worked on: the most recently pushed repo + a live timer ---------- */
let lastRepo = null;
function sinceText(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}
function tickSince() {
  if (!lastRepo) return;
  const t = sinceText(Date.now() - new Date(lastRepo.pushed));
  $$("[data-since]").forEach((el) => (el.textContent = t));
}
setInterval(tickSince, 1000);

function renderLastWorked() {
  if (!repos || !repos.length) return;
  lastRepo = [...repos].sort((a, b) => new Date(b.pushed) - new Date(a.pushed))[0];
  $("#lastRepoName").textContent = lastRepo.name;
  $("#lastRepoAbout").textContent = lastRepo.name;
  $("#lastWorked").hidden = false;
  tickSince();
}

// open a repo's info panel in the list, scrolling it into view
function openRepo(name) {
  const search = $("#repoSearch");
  if (search.value) { search.value = ""; drawRepos(); }
  const row = $$(".repo").find((r) => $(".repo-name", r).textContent === name);
  const r = repos && repos.find((x) => x.name === name);
  if (!row || !r) return;
  if (!row.classList.contains("open")) toggleRepo(row, r);
  row.scrollIntoView({ behavior: settings.calm ? "auto" : "smooth", block: "nearest" });
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
}
$("#lastWorked").addEventListener("click", () => lastRepo && openRepo(lastRepo.name));
// from the about page: the link already switches to repos; then open that repo
$("#lastRepoAbout").addEventListener("click", () => {
  if (!lastRepo) return;
  const name = lastRepo.name;
  setTimeout(() => loadRepos().then(() => openRepo(name)), 650);
});

/* ---------- music tab: what's on spotify ---------- */
let spTimer;
function renderMusic() {
  const el = $("#musicList");
  if (!el) return;
  clearInterval(spTimer);
  const rows = [];
  const now = document.createElement(spotify ? "a" : "div");
  now.className = "row";
  if (spotify) {
    now.href = `https://open.spotify.com/track/${encodeURIComponent(spotify.track_id)}`;
    now.target = "_blank";
    now.rel = "noopener";
    now.innerHTML = `<img alt="" /><div><b></b><span></span><small class="live">● now playing</small><div class="sp-progress"><i></i></div></div><em class="tagr">spotify ↗</em>`;
    $("img", now).src = spotify.album_art_url;
    $("b", now).textContent = spotify.song;
    $("span", now).textContent = spotify.artist;
    const { start, end } = spotify.timestamps;
    const step = () => { const bar = $(".sp-progress i", now); if (bar) bar.style.width = `${Math.min(100, ((Date.now() - start) / (end - start)) * 100)}%`; };
    step();
    spTimer = setInterval(step, 1000);
  } else {
    now.innerHTML = `<span class="ph">spotify<br>quiet</span><div><b>not listening</b><span>nothing is playing right now</span><small>spotify activity shows up here</small></div><em class="tagr"></em>`;
  }
  rows.push(now);
  el.replaceChildren(...rows);
}

/* ---------- music tab: recently played ----------
   A Cloudflare Worker (see worker/) checks Lanyard every minute and logs each
   new Spotify play; this reads that log. */
const playedAgo = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};
const HISTORY_URL = "https://listening-log.desmixo.workers.dev/";
let plays = null;
let playsAt = 0;

const samePlay = (a, b) => a.id === b.id && Math.abs(a.start - b.start) < 5000;

// combine two lists of plays: no duplicates, newest first, last 50
function mergePlays(a, b) {
  const out = [...a];
  for (const p of b) if (!out.some((q) => samePlay(p, q))) out.push(p);
  return out.sort((x, y) => y.start - x.start).slice(0, 50);
}

// a song just finished on this page: show it in the list immediately
// (the worker logs it too; the merge stops it showing twice)
function notePlay(p) {
  plays = mergePlays(plays || [], [p]);
}

async function loadHistory(force = false) {
  // refetch at most every 30s unless asked
  if (!force && playsAt && Date.now() - playsAt < 30000) return renderHistory();
  try {
    const r = await fetch(HISTORY_URL);
    if (!r.ok) throw new Error(r.status);
    plays = mergePlays(await r.json(), plays || []);
    playsAt = Date.now();
  } catch {
    if (!plays) $("#historyList").innerHTML = '<p class="empty">couldn\'t load listening history right now.</p>';
    return;
  }
  renderHistory();
}

function renderHistory() {
  const el = $("#historyList");
  if (!el || !plays) return;
  // skip the entry for the song that's playing right now; it's already shown above
  const items = plays.filter((p, i) => !(i === 0 && spotify && p.id === spotify.track_id));
  $("#histCount").textContent = items.length ? `· ${items.length}` : "";
  if (!items.length) {
    el.innerHTML = plays.length
      ? '<p class="empty">just getting started. songs land here once the next one starts.</p>'
      : '<p class="empty">nothing logged yet. songs show up here after they play.</p>';
    return;
  }
  el.replaceChildren(...items.map((p) => {
    const a = document.createElement("a");
    a.className = "row";
    a.href = `https://open.spotify.com/track/${encodeURIComponent(p.id)}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `<img alt="" loading="lazy" /><div><b></b><span></span></div><em class="tagr"></em>`;
    $("img", a).src = p.art;
    $("b", a).textContent = p.song;
    $("span", a).textContent = p.artist;
    $(".tagr", a).textContent = playedAgo(p.start);
    return a;
  }));
}
// keep it fresh while the music tab is open
setInterval(() => { if (current === "about" && !$('[data-sub="music"]').hidden) loadHistory(true); }, 30000);

/* ============================================================
   settings + sound
   ============================================================ */
/* Background music: on by default, quiet, and it starts by itself.
   Browsers refuse sound until the visitor has clicked, tapped or pressed a
   key once, so if the first try is blocked we start on that first gesture.
   Drop your track in at public/assets/music/background.mp3; until then the
   old guitar loop plays instead. */
const audio = $("#audio");
const MUSIC_VOLUME = 0.15;
const TRACK = "/assets/music/background.mp3";
const FALLBACK = "/assets/music/voice-of-no-return-guitar.mp3";
fetch(TRACK, { method: "HEAD" })
  .then((r) => (r.ok && (r.headers.get("content-type") || "").startsWith("audio") ? TRACK : FALLBACK))
  .catch(() => FALLBACK)
  .then((src) => { audio.src = src; if (settings.music) startMusic(); });

// a timer, not requestAnimationFrame: rAF stops in background tabs, which
// left the music "playing" at volume 0
let fadeTimer;
function fadeTo(target, ms = 1800) {
  clearInterval(fadeTimer);
  const from = audio.volume, t0 = Date.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    audio.volume = from + (target - from) * k;
    if (k >= 1) {
      clearInterval(fadeTimer);
      if (target === 0) audio.pause();
    }
  }, 50);
}
function showMusic() {
  $("#soundBtn").setAttribute("aria-pressed", settings.music);
  $("#soundState").textContent = settings.music ? "music on" : "music off";
  $('[data-setting="music"]').checked = settings.music;
}
let waitingForGesture = false;
async function startMusic() {
  if (!audio.src) return;
  if (audio.paused) audio.volume = 0;
  try {
    await audio.play();
    fadeTo(MUSIC_VOLUME);
  } catch {
    // blocked until the first click / tap / key press
    if (waitingForGesture) return;
    waitingForGesture = true;
    const go = () => {
      ["pointerdown", "keydown", "touchend"].forEach((ev) => removeEventListener(ev, go, true));
      waitingForGesture = false;
      if (settings.music) startMusic();
    };
    ["pointerdown", "keydown", "touchend"].forEach((ev) => addEventListener(ev, go, true));
  }
}
function setMusic(on) {
  settings.music = on;
  saveSettings();
  showMusic();
  if (on) startMusic();
  else fadeTo(0, 500);
}
$("#soundBtn").addEventListener("click", () => setMusic(!settings.music));
showMusic();
// safety net: any click or key press makes sure the music is actually audible
["pointerdown", "keydown"].forEach((ev) =>
  addEventListener(ev, () => {
    if (!settings.music || !audio.src) return;
    if (audio.paused) startMusic();
    else if (audio.volume < MUSIC_VOLUME * 0.5) fadeTo(MUSIC_VOLUME, 600);
  }, true)
);

function applySettings() {
  body.classList.toggle("calm", settings.calm);
  sfx.enabled = settings.sfx;
  applyVideo();
  $$("[data-setting]").forEach((i) => (i.checked = !!settings[i.dataset.setting]));
}
$$("[data-setting]").forEach((i) =>
  i.addEventListener("change", () => {
    if (i.dataset.setting === "music") return setMusic(i.checked);
    settings[i.dataset.setting] = i.checked;
    saveSettings();
    applySettings();
  })
);
applySettings();

/* ---------- background video ---------- */
function applyVideo() {
  const v = $("#bg");
  if (settings.video && !settings.calm) v.play().catch(() => {});
  else v.pause();
}

/* ---------- open a deep link (#repos etc.) once everything above exists ---------- */
{
  const h = location.hash.slice(1);
  if (SECTIONS.includes(h)) go(h, { push: false });
}
