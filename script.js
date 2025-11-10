// ===== Seletores =====
const container      = document.getElementById("pokemonContainer");
const input          = document.getElementById("pokemonInput");
const btnSearch      = document.getElementById("searchBtn");
const btnMore        = document.getElementById("loadMoreBtn");
const btnTheme       = document.getElementById("themeToggle");

const navToggle      = document.getElementById("navToggle");
const navControls    = document.getElementById("navControls");

const btnHome        = document.getElementById("btnHome");
const homeMenu       = document.getElementById("homeMenu");
const homeShowAll    = document.getElementById("homeShowAll");
const homeShowFavs   = document.getElementById("homeShowFavs");

const btnHistory     = document.getElementById("btnHistory");
const btnAbout       = document.getElementById("btnAbout");
const aboutSection   = document.getElementById("aboutSection");
const historySection = document.getElementById("historySection");
const historyStatus  = document.getElementById("historyStatus");
const seasonsWrap    = document.getElementById("seasonsContainer");

const modalOverlay   = document.getElementById("modalOverlay");
const modalTitle     = document.getElementById("modalTitle");
const modalBody      = document.getElementById("modalBody");
const modalCloseBtn  = document.getElementById("modalCloseBtn");

// ===== Estado =====
const API_BASE   = "https://pokeapi.co/api/v2";
const PAGE_LIMIT = 12;

let offset = 0;
let isSearching = false;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]"); // array de IDs (número)
let comparePick = [];

// ===== Util/Modal =====
function getTypeColor(type) {
  const colors = {
    fire:"#EE8130", water:"#6390F0", grass:"#7AC74C", electric:"#F7D02C",
    ice:"#96D9D6", poison:"#A33EA1", normal:"#A8A77A", bug:"#A6B91A",
    rock:"#B6A136", ghost:"#735797", dragon:"#6F35FC", dark:"#705746",
    steel:"#B7B7CE", fairy:"#D685AD", psychic:"#F95587", ground:"#E2BF65",
    flying:"#A98FF3"
  };
  return colors[type] || "#777";
}
function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}
modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ===== API =====
async function apiList(offset, limit) {
  const res = await fetch(`${API_BASE}/pokemon?offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error("Erro ao listar Pokémon");
  return res.json();
}
async function apiPokemon(nameOrId) {
  const res = await fetch(`${API_BASE}/pokemon/${nameOrId}`);
  if (!res.ok) throw new Error("Pokémon não encontrado");
  return res.json();
}
async function apiSpecies(id) {
  const res = await fetch(`${API_BASE}/pokemon-species/${id}`);
  if (!res.ok) throw new Error("Espécie não encontrada");
  return res.json();
}
async function apiEvolutionByUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Cadeia de evolução não encontrada");
  return res.json();
}

// ===== Evolução =====
async function getEvolutionChain(pokemonId) {
  try {
    const species = await apiSpecies(pokemonId);
    const evoUrl = species.evolution_chain.url;
    const evoData = await apiEvolutionByUrl(evoUrl);

    const names = [];
    let node = evoData.chain;
    while (node) { names.push(node.species.name); node = node.evolves_to[0]; }

    const result = [];
    for (let i = 0; i < names.length; i++) {
      const p = await apiPokemon(names[i]);
      const img =
        (p.sprites.other && p.sprites.other["official-artwork"] && p.sprites.other["official-artwork"].front_default) ||
        p.sprites.front_default || "";
      result.push({ id: p.id, name: p.name, img });
    }
    return result;
  } catch { return []; }
}

// ===== Favoritos / Comparação =====
function isFavorite(id) { id = Number(id); return favorites.includes(id); }
function saveFavorites() { localStorage.setItem("favorites", JSON.stringify(favorites)); }
function toggleFavorite(id, button) {
  id = Number(id);
  if (isFavorite(id)) favorites = favorites.filter((fid) => fid !== id);
  else favorites.push(id);
  saveFavorites();

  if (button) {
    const active = isFavorite(id);
    button.classList.toggle("favorited", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = active ? "Remove from favorites" : "Add to favorites";
  }
}

function toggleCompare(id, button) {
  id = Number(id);
  const idx = comparePick.indexOf(id);
  if (idx >= 0) comparePick.splice(idx, 1);
  else {
    if (comparePick.length >= 2) comparePick.shift();
    comparePick.push(id);
  }

  if (button) button.classList.toggle("active", comparePick.includes(id));

  if (comparePick.length === 2) {
    // abre modal e limpa seleção para próxima comparação
    showCompareModal(comparePick[0], comparePick[1]).finally(() => {
      comparePick = [];
      document.querySelectorAll(".icon-compare.active").forEach(b => b.classList.remove("active"));
    });
  }
}

function buildStatRow(label, a, b) {
  const max = Math.max(a, b, 1);
  const aw = Math.round((a/max)*100);
  const bw = Math.round((b/max)*100);
  return `
    <div class="stat-row" style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;align-items:center">
      <div style="text-transform:uppercase;opacity:.8">${label}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="height:8px;background:#e9e9e9;border-radius:6px;overflow:hidden;flex:1">
          <div style="height:100%;width:${aw}%;background:#2ecc71"></div>
        </div><span>${a}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="height:8px;background:#e9e9e9;border-radius:6px;overflow:hidden;flex:1">
          <div style="height:100%;width:${bw}%;background:#3498db"></div>
        </div><span>${b}</span>
      </div>
    </div>`;
}

async function showCompareModal(idA, idB) {
  try {
    const A = await apiPokemon(idA);
    const B = await apiPokemon(idB);
    const imgA = A.sprites.other["official-artwork"].front_default || A.sprites.front_default || "";
    const imgB = B.sprites.other["official-artwork"].front_default || B.sprites.front_default || "";
    const typeA = A.types.map(t=>t.type.name).join(", ");
    const typeB = B.types.map(t=>t.type.name).join(", ");
    const keys = ["hp","attack","defense","special-attack","special-defense","speed"];
    const objA = {}; A.stats.forEach(s=> objA[s.stat.name]=s.base_stat);
    const objB = {}; B.stats.forEach(s=> objB[s.stat.name]=s.base_stat);
    let rows = ""; for (let i=0;i<keys.length;i++){ const k=keys[i]; rows += buildStatRow(k, objA[k]||0, objB[k]||0); }
    const html = `
      <div class="compare-wrap">
        <div class="compare-head" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;text-align:center">
          <div>
            <img src="${imgA}" alt="${A.name}" style="width:100%;max-height:220px;object-fit:contain">
            <h4>#${String(A.id).padStart(3,"0")} ${A.name.toUpperCase()}</h4>
            <p><strong>Type:</strong> ${typeA}</p>
            <p><strong>Weight:</strong> ${(A.weight/10).toFixed(1)} kg • <strong>Height:</strong> ${(A.height/10).toFixed(1)} m</p>
          </div>
          <div>
            <img src="${imgB}" alt="${B.name}" style="width:100%;max-height:220px;object-fit:contain">
            <h4>#${String(B.id).padStart(3,"0")} ${B.name.toUpperCase()}</h4>
            <p><strong>Type:</strong> ${typeB}</p>
            <p><strong>Weight:</strong> ${(B.weight/10).toFixed(1)} kg • <strong>Height:</strong> ${(B.height/10).toFixed(1)} m</p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
      </div>`;
    openModal("Pokémon Comparison", html);
  } catch {
    openModal("Pokémon Comparison", "<p>❌ Failed to compare.</p>");
  }
}

// ===== Card (Pokébola SVG com currentColor) =====
function renderPokemonCard(p) {
  const id   = p.id;
  const name = p.name.toUpperCase();
  const type = p.types[0]?.type?.name || "normal";
  const img  = p.sprites?.other?.["official-artwork"]?.front_default || p.sprites?.front_default || "";

  const card = document.createElement("div");
  card.className = "team-card";
  card.style.borderTop = "6px solid " + getTypeColor(type);
  card.innerHTML = `
    <button class="favorite-btn icon-favorite ${isFavorite(id) ? "favorited" : ""}"
            data-fav-id="${id}"
            aria-pressed="${isFavorite(id) ? "true" : "false"}"
            title="${isFavorite(id) ? "Remove from favorites" : "Add to favorites"}" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2a10 10 0 0 0-9.5 7h4a6.5 6.5 0 0 1 11 0h4A10 10 0 0 0 12 2zm0 20a10 10 0 0 0 9.5-7h-4a6.5 6.5 0 0 1-11 0h-4A10 10 0 0 0 12 22zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
      </svg>
    </button>
    <button class="icon-compare" data-compare-id="${id}" title="Compare" type="button">⚖</button>
    <img class="main-img" src="${img}" alt="${name}">
    <h3 class="pokemon-name">${name}</h3>
  `;

  // abrir modal ao clicar no card (exceto nos botões)
  card.addEventListener("click", async (e) => {
    if (e.target.closest(".favorite-btn, .icon-favorite, .icon-compare")) return;

    const types     = p.types.map(t => t.type.name).join(", ");
    const abilities = p.abilities.map(a => a.ability.name).join(", ");
    const evolutions = await getEvolutionChain(id);

    let evoHTML = "";
    if (!evolutions.length) {
      evoHTML = "<p>No evolution data.</p>";
    } else {
      evoHTML = evolutions.map(ev =>
        `<div class="evo-card"><img src="${ev.img}" alt="${ev.name}"><span>${ev.name}</span></div>`
      ).join("");
    }

    const html = `
      <div class="pokemon-details">
        <div class="char-block">
          <h4>Characteristics</h4>
          <p><strong>Type:</strong> ${types}</p>
          <p><strong>Height:</strong> ${(p.height/10).toFixed(1)} m</p>
          <p><strong>Weight:</strong> ${(p.weight/10).toFixed(1)} kg</p>
          <p><strong>Abilities:</strong> ${abilities}</p>
        </div>
        <div class="evo-block">
          <h4>Evolution Chain</h4>
          <div class="evo-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;">${evoHTML}</div>
        </div>
      </div>
    `;
    openModal(`${name}`, html);

  });

  container.appendChild(card);
}

// ===== Lista / Busca =====
async function loadPage() {
  if (isSearching) return;
  try {
    const list = await apiList(offset, PAGE_LIMIT);
    for (let i = 0; i < list.results.length; i++) {
      try { const poke = await apiPokemon(list.results[i].name); renderPokemonCard(poke); }
      catch {}
    }
    offset += PAGE_LIMIT;
  } catch {
    container.innerHTML = "<p>❌ Error loading list.</p>";
  }
}
async function searchByName() {
  const name = input.value.toLowerCase().trim();
  if (!name) { container.innerHTML = "<p>❌ Please enter a Pokémon name.</p>"; return; }
  container.innerHTML = ""; isSearching = true;
  try {
    const p = await apiPokemon(name);
    renderPokemonCard(p);
    const back = document.createElement("button");
    back.textContent = "← Back to list";
    back.id = "backToList";
    back.style.display = "block";
    back.style.margin = "12px auto";
    back.className = "darkmode-toggle";
    back.addEventListener("click", () => {
      container.innerHTML = "";
      offset = 0; isSearching = false; loadPage();
    });
    container.appendChild(back);
  } catch {
    container.innerHTML = "<p>❌ Pokémon not found!</p>";
  }
}

// ===== History (TVMaze) =====
async function fetchPokemonEpisodes() {
  const res = await fetch("https://api.tvmaze.com/singlesearch/shows?q=pokemon&embed=episodes");
  if (!res.ok) throw new Error("TVMaze failed");
  const data = await res.json();
  return data._embedded?.episodes || [];
}
function groupBySeason(episodes) {
  const map = {};
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const s = ep.season || 0;
    if (!map[s]) map[s] = [];
    map[s].push(ep);
  }
  return map;
}
function renderSeasons(seasonsMap) {
  seasonsWrap.innerHTML = "";
  const keys = Object.keys(seasonsMap).sort((a, b) => Number(a) - Number(b));
  for (let k = 0; k < keys.length; k++) {
    const sn = keys[k];
    const eps = seasonsMap[sn];

    const details = document.createElement("details");
    details.className = "season-block";

    const summary = document.createElement("summary");
    summary.innerHTML = `<span>Season ${sn} — ${eps.length} episodes</span><span class="chev">›</span>`;

    const grid = document.createElement("div");
    grid.className = "episodes-grid";

    for (let i = 0; i < eps.length; i++) {
      const ep = eps[i];
      const thumb = (ep.image && (ep.image.medium || ep.image.original)) || "";
      const code = `S${String(ep.season).padStart(2,"0")}E${String(ep.number || 0).padStart(2,"0")}`;
      const date = ep.airdate || "—";
      const title = ep.name || "Untitled";

      const card = document.createElement("article");
      card.className = "ep-card";
      card.title = "Click to see summary";
      card.innerHTML = `
        <img class="ep-thumb" src="${thumb || "https://via.placeholder.com/640x360?text=No+Image"}" alt="${title}">
        <div class="ep-meta">
          <h4 class="ep-title">${title}</h4>
          <p class="ep-sub">${code} • ${date}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        const clean = (ep.summary || "No summary.").replace(/<\/?p>/g, "").trim();
        const link  = ep.url ? `<p><a href="${ep.url}" target="_blank" rel="noopener">View on TVMaze →</a></p>` : "";
        openModal(`${title} — ${code}`, `<p>${clean}</p>${link}`);
      });
      grid.appendChild(card);
    }

    details.appendChild(summary);
    details.appendChild(grid);
    seasonsWrap.appendChild(details);
  }
  const first = seasonsWrap.querySelector(".season-block");
  if (first) first.setAttribute("open", "open");
}
async function showHistory() {
  aboutSection.classList.add("hidden");
  historySection.classList.remove("hidden");
  document.querySelector(".load-more-container").classList.add("hidden");
  container.innerHTML = "";
  historyStatus.textContent = "Loading episodes...";
  seasonsWrap.innerHTML = "";
  try {
    const episodes = await fetchPokemonEpisodes();
    const grouped = groupBySeason(episodes);
    renderSeasons(grouped);
    historyStatus.textContent = "Click a season to expand.";
  } catch {
    historyStatus.textContent = "❌ Failed to load episodes from TVMaze.";
  }
}

// ===== Navbar/Tema/Eventos =====
function setupNavbarToggle() {
  if (!navToggle || !navControls) return;
  navToggle.addEventListener("click", (e) => {
    navControls.classList.toggle("dropdown");
    e.stopPropagation();
    navToggle.setAttribute("aria-expanded", navControls.classList.contains("dropdown") ? "true" : "false");
  });
  document.addEventListener("click", (e) => {
    if (!navControls.classList.contains("dropdown")) return;
    const inside = e.target.closest("nav");
    if (!inside) {
      navControls.classList.remove("dropdown");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
  navControls.addEventListener("click", () => {
    if (navControls.classList.contains("dropdown")) {
      navControls.classList.remove("dropdown");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}
function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    btnTheme.textContent = "☀️";
    btnTheme.setAttribute("aria-label", "Switch to light theme");
  } else {
    btnTheme.textContent = "🌙";
  }
}
function wireEvents() {
  // Paginação
  btnMore.addEventListener("click", loadPage);

  // Busca
  btnSearch.addEventListener("click", searchByName);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") searchByName(); });

  // Home dropdown
  btnHome.addEventListener("click", (e) => {
    e.stopPropagation();
    const show = !homeMenu.classList.contains("show");
    homeMenu.classList.toggle("show", show);
    btnHome.setAttribute("aria-expanded", show ? "true" : "false");
    homeMenu.setAttribute("aria-hidden", show ? "false" : "true");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".home-dropdown")) {
      homeMenu.classList.remove("show");
      btnHome.setAttribute("aria-expanded", "false");
      homeMenu.setAttribute("aria-hidden", "true");
    }
  });

  // Home ações
  homeShowAll.addEventListener("click", () => {
    historySection.classList.add("hidden");
    aboutSection.classList.add("hidden");
    document.querySelector(".load-more-container").classList.remove("hidden");
    container.innerHTML = "";
    offset = 0;
    isSearching = false;
    loadPage();
  });
  homeShowFavs.addEventListener("click", async () => {
    historySection.classList.add("hidden");
    aboutSection.classList.add("hidden");
    document.querySelector(".load-more-container").classList.add("hidden");
    container.innerHTML = "";
    isSearching = true;

    if (favorites.length === 0) {
      container.innerHTML = "<p>Sem favoritos ainda. Clique na Pokébola em qualquer card para adicionar.</p>";
      return;
    }
    for (let i = 0; i < favorites.length; i++) {
      try { const p = await apiPokemon(favorites[i]); renderPokemonCard(p); } catch {}
    }
  });

  // About & History
  btnAbout.addEventListener("click", () => {
    historySection.classList.add("hidden");
    document.querySelector(".load-more-container").classList.add("hidden");
    aboutSection.classList.toggle("hidden");
    container.innerHTML = "";
  });
  btnHistory.addEventListener("click", showHistory);

  // Tema
  btnTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const dark = document.body.classList.contains("dark");
    btnTheme.textContent = dark ? "☀️" : "🌙";
    localStorage.setItem("theme", dark ? "dark" : "light");
  });

  // Delegação de eventos (favoritar / comparar)
  container.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav-id]");
    if (favBtn && container.contains(favBtn)) {
      e.stopPropagation();
      const id = Number(favBtn.getAttribute("data-fav-id"));
      toggleFavorite(id, favBtn);
      return;
    }
    const cmpBtn = e.target.closest("[data-compare-id]");
    if (cmpBtn && container.contains(cmpBtn)) {
      e.stopPropagation();
      const id = Number(cmpBtn.getAttribute("data-compare-id"));
      toggleCompare(id, cmpBtn);
      return;
    }
  });
}

// ===== Init =====
async function init() {
  applySavedTheme();
  setupNavbarToggle();
  wireEvents();
  await loadPage();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else 
// ==== Footer wiring ====
// ano atual
document.getElementById("yearNow").textContent = new Date().getFullYear();

// voltar ao topo
document.getElementById("backToTop").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// atalhos do footer -> usam seus botões já existentes
document.querySelectorAll('[data-footnav]').forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const action = link.getAttribute("data-footnav");
    if (action === "all") document.getElementById("homeShowAll").click();
    if (action === "favs") document.getElementById("homeShowFavs").click();
    if (action === "history") document.getElementById("btnHistory").click();
    if (action === "about") document.getElementById("btnAbout").click();
    // rola até o topo para ver o conteúdo
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});


init();
