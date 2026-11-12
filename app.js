import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLAN, SYSTEMS, ITEMS, WALLS, GROUP_ORDER, H } from './model.js';

// ------------------------------------------------------------ utilidades
const $ = s => document.querySelector(s);
const S = PLAN.S, CX = (PLAN.x0 + PLAN.x1) / 2, CZ = (PLAN.y0 + PLAN.y1) / 2;
const W = p => new THREE.Vector3((p[0] - CX) * S, p[2] ?? 0, (p[1] - CZ) * S);
const LINEAR = new Set(['pipe', 'duct']);
const STATUS = {
  pendente:  { label: 'Pendente', f: 0, cls: 'st-pend' },
  montagem:  { label: 'Em montagem', f: 0.5, cls: 'st-mont' },
  instalado: { label: 'Instalado', f: 1, cls: 'st-inst' },
  pendencia: { label: 'Instalado c/ pendência', f: 1, cls: 'st-issue' },
};
const KIND = { pipe: 'Tubulação', duct: 'Duto', chiller: 'Chiller', ahu: 'Fancoil', pump: 'Bomba', valve: 'Válvula',
  flange: 'Flange', support: 'Suporte', grille: 'Grelha', damper: 'Damper' };
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const TODAY = iso(new Date());
const br = s => (s ? s.split('-').reverse().join('/') : '');
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = c => '#' + c.toString(16).padStart(6, '0');
const bar = (f, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.round(Math.min(1, f) * 100)}%"></i></div>`;

// ------------------------------------------------------------ cena
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161b22);
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.4;
controls.maxDistance = 90;
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(12, 30, 10); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-15, 10, -12); scene.add(fill);

const FW = (PLAN.x1 - PLAN.x0) * S, FD = (PLAN.y1 - PLAN.y0) * S;
const tex = new THREE.TextureLoader().load(PLAN.image);
tex.colorSpace = THREE.SRGBColorSpace;
tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const floorMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01;
scene.add(floor);
const base = new THREE.Mesh(new THREE.PlaneGeometry(FW + 4, FD + 4), new THREE.MeshBasicMaterial({ color: 0x232a33 }));
base.rotation.x = -Math.PI / 2; base.position.y = -0.03; scene.add(base);

const walls = new THREE.Group();
const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9d1da, transparent: true, opacity: 0.13, depthWrite: false });
for (const [x1, y1, x2, y2] of WALLS) {
  const a = W([x1, y1, 0]), b = W([x2, y2, 0]);
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, H.CEIL, len), wallMat);
  m.position.copy(a).lerp(b, 0.5); m.position.y = H.CEIL / 2;
  m.lookAt(b.x, H.CEIL / 2, b.z);
  walls.add(m);
}
scene.add(walls);

// ------------------------------------------------------------ materiais
const matCache = new Map();
function getMat(color, mode) {
  const k = color + '|' + mode;
  if (matCache.has(k)) return matCache.get(k);
  let m;
  if (mode === 'ghost') m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, roughness: 1 });
  else if (mode === 'montagem') m = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x6a3300, roughness: 0.5 });
  else if (mode === 'pendencia') m = new THREE.MeshStandardMaterial({ color: 0xe63946, emissive: 0x550000, roughness: 0.5 });
  else m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
  matCache.set(k, m);
  return m;
}
const mesh = (geo, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, getMat(color, 'done'));
  m.userData.color = color; m.position.set(x, y, z); return m;
};
const BOX = (a, b, c) => new THREE.BoxGeometry(a, b, c);
const CYL = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);
const DARK = 0x4a5059, STEEL = 0xa7b1bc;
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------ geometria de trechos lineares
function cyl(a, b, r, m) {
  const d = b.clone().sub(a), len = d.length();
  const o = new THREE.Mesh(CYL(r, len, 18), m);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
  return o;
}
function boxSeg(a, b, w, h, m) {
  const d = b.clone().sub(a), len = d.length();
  const o = new THREE.Mesh(BOX(w, h, len), m);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.lookAt(b);
  return o;
}
function buildPath(it, pts, upto, mode) {
  const g = new THREE.Group();
  const m = getMat(SYSTEMS[it.system].color, mode);
  let left = upto;
  for (let i = 0; i < pts.length - 1 && left > 1e-4; i++) {
    const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
    const e = a.clone().lerp(b, Math.min(1, left / L));
    if (a.distanceTo(e) > 1e-3) g.add(it.kind === 'pipe' ? cyl(a, e, it.dia / 2, m) : boxSeg(a, e, it.w, it.h, m));
    if (i > 0) {
      const j = it.kind === 'pipe' ? new THREE.Mesh(new THREE.SphereGeometry(it.dia / 2, 16, 12), m)
                                   : new THREE.Mesh(BOX(it.w, it.h, it.w), m);
      j.position.copy(a); g.add(j);
    }
    left -= L;
  }
  return g;
}

// ------------------------------------------------------------ peças reutilizáveis
function actuatorMesh(it, y) {
  const g = new THREE.Group();
  if (it.actuator === 'alavanca') {
    g.add(mesh(BOX(0.07, 0.05, 0.07), DARK, 0, y - 0.03, 0));
    g.add(mesh(BOX(0.04, 0.025, 0.42), 0xc0392b, 0, y, 0.19));
  } else {
    const hw = mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 24), 0xc0392b, 0, y, 0); hw.rotation.x = Math.PI / 2; g.add(hw);
    for (let i = 0; i < 3; i++) { const s = mesh(BOX(0.24, 0.012, 0.012), 0xc0392b, 0, y, 0); s.rotation.y = (i * Math.PI) / 3; g.add(s); }
  }
  return g;
}
const flangeDisc = R => { const f = mesh(CYL(R, 0.05, 28), STEEL); f.rotation.x = Math.PI / 2; return f; };
function boltRing(R, len = 0.14) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * R * 0.8, y = Math.sin(a) * R * 0.8;
    const b = mesh(CYL(0.012, len, 8), 0x5d6670, x, y, 0); b.rotation.x = Math.PI / 2; g.add(b);
    for (const s of [-1, 1]) { const n = mesh(CYL(0.022, 0.02, 6), 0x3b4148, x, y, s * (len / 2 - 0.01)); n.rotation.x = Math.PI / 2; g.add(n); }
  }
  return g;
}
const gasket = R => { const j = mesh(new THREE.TorusGeometry(R, 0.012, 6, 28), 0x1c1c1c); return j; };

// ------------------------------------------------------------ equipamentos
const BUILD = {
  chiller(it) {
    const g = new THREE.Group(), Y = SYSTEMS.chiller.color, L = it.len;
    g.add(mesh(BOX(1.7, 0.15, L + 0.3), DARK, 0, 0.075, 0));
    for (const z of [-L / 2 + 0.35, L / 2 - 0.35]) g.add(mesh(BOX(1.6, 0.55, 0.18), DARK, 0, 0.4, z));
    for (const x of [-0.45, 0.45]) {
      const c = mesh(CYL(0.4, L, 28), Y, x, 1.05, 0); c.rotation.x = Math.PI / 2; g.add(c);
      for (const s of [-1, 1]) { const cap = mesh(CYL(0.43, 0.08, 28), DARK, x, 1.05, s * L / 2); cap.rotation.x = Math.PI / 2; g.add(cap); }
    }
    const comp = mesh(CYL(0.3, 1.0, 24), Y, 0.45, 1.75, -0.5); comp.rotation.x = Math.PI / 2; g.add(comp);
    g.add(mesh(BOX(0.55, 0.55, 0.8), 0xc9a52c, 0.45, 1.75, 0.45));
    g.add(mesh(BOX(0.12, 0.7, 0.9), 0xd9dde2, -0.92, 1.0, 0.4));
    return g;
  },
  ahu(it) {
    const g = new THREE.Group(), [w, h, d] = it.size;
    g.add(mesh(BOX(w, h, d), SYSTEMS.ahu.color));
    g.add(mesh(BOX(w + 0.04, 0.08, d + 0.04), 0x7f7d48, 0, h / 2, 0));
    g.add(mesh(BOX(w * 0.8, h * 0.6, 0.04), 0x6c6a3d, 0, 0, -d / 2 - 0.02));
    for (const sx of [-1, 1]) g.add(mesh(CYL(0.012, H.CEIL - it.pos[2] - h / 2, 6), DARK, sx * (w / 2 - 0.05), (H.CEIL - it.pos[2] + h / 2) / 2, 0));
    return g;
  },
  pump(it) {
    const g = new THREE.Group(), c = SYSTEMS.pump.color, r = it.dia / 2;
    const body = mesh(CYL(r * 1.5, 0.38, 24), c); body.rotation.x = Math.PI / 2; g.add(body);
    g.add(mesh(CYL(0.08, 0.18, 16), c, 0, r * 1.5 + 0.05, 0));
    g.add(mesh(CYL(0.17, 0.5, 24), 0x24564a, 0, r * 1.5 + 0.38, 0));
    g.add(mesh(CYL(0.18, 0.06, 24), DARK, 0, r * 1.5 + 0.66, 0));
    return g;
  },
  valve(it) {
    const g = new THREE.Group(), r = it.dia / 2;
    const b = mesh(CYL(r * 1.2, 0.2, 20), SYSTEMS.valve.color); b.rotation.x = Math.PI / 2; g.add(b);
    g.add(mesh(CYL(0.025, 0.3, 8), DARK, 0, r + 0.15, 0));
    g.add(actuatorMesh(it, r + 0.3));
    return g;
  },
  flange(it) {
    const g = new THREE.Group(), r = it.dia / 2, R = r * 1.75;
    const f = mesh(CYL(R, 0.05, 28), STEEL); f.rotation.x = Math.PI / 2; g.add(f);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = mesh(CYL(0.012, 0.1, 6), 0x5d6670, Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, 0);
      b.rotation.x = Math.PI / 2; g.add(b);
    }
    return g;
  },
  support(it) {
    const g = new THREE.Group(), c = SYSTEMS.support.color;
    const span = (it.span[1] - it.span[0]) * S + 0.3, h0 = it.pos[2];
    g.add(mesh(BOX(0.08, 0.08, span), c));
    for (const s of [-1, 1]) {
      const z = s * (span / 2 - 0.05);
      if (it.hang) { const L = H.CEIL - h0; g.add(mesh(CYL(0.015, L, 8), c, 0, L / 2, z)); }
      else { g.add(mesh(BOX(0.07, h0, 0.07), c, 0, -h0 / 2, z)); g.add(mesh(BOX(0.2, 0.02, 0.2), DARK, 0, -h0 + 0.01, z)); }
    }
    return g;
  },
  grille(it) {
    const g = new THREE.Group(), [a, b, c] = it.size;
    g.add(mesh(BOX(a, b, c), SYSTEMS.grille.color));
    for (let i = -2; i <= 2; i++) {
      g.add(a < c ? mesh(BOX(a + 0.012, 0.012, c * 0.92), 0x7d8794, 0, i * b / 6, 0)
                  : mesh(BOX(a * 0.92, 0.012, c + 0.012), 0x7d8794, 0, i * b / 6, 0));
    }
    return g;
  },
  damper() {
    const g = new THREE.Group(), c = SYSTEMS.damper.color;
    g.add(mesh(BOX(0.46, 0.31, 0.14), c));
    for (let i = -1; i <= 1; i++) { const l = mesh(BOX(0.4, 0.015, 0.09), 0x5b6573, 0, i * 0.075, 0); l.rotation.x = 0.5; g.add(l); }
    g.add(mesh(BOX(0.04, 0.04, 0.22), 0xc0392b, 0.26, 0.1, 0));
    return g;
  },
};

// ------------------------------------------------------------ itens
const itemRoot = new THREE.Group(); scene.add(itemRoot);
let showGhost = true;

class Item {
  constructor(it) {
    this.it = it;
    this.linear = LINEAR.has(it.kind);
    this.group = new THREE.Group();
    this.group.userData.itemId = it.id;
    itemRoot.add(this.group);
    if (this.linear) {
      this.pts = it.pts.map(W);
      this.geomLen = this.pts.reduce((s, p, i) => (i ? s + p.distanceTo(this.pts[i - 1]) : 0), 0);
      this.total = it.length ?? Math.round(this.geomLen * 10) / 10;
      this.ghost = buildPath(it, this.pts, Infinity, 'ghost');
      this.group.add(this.ghost);
      this.value = -1;
    } else {
      this.body = BUILD[it.kind](it);
      this.group.add(this.body);
      this.group.position.copy(W(it.pos));
      if (it.axis === 'x' || it.axisX) this.group.rotation.y = Math.PI / 2;
      this.value = null;
    }
  }
  setValue(v) {
    if (this.linear) {
      v = Math.max(0, Math.min(this.total, +v || 0));
      if (v === this.value) return;
      this.value = v;
      if (this.done) { this.group.remove(this.done); this.done.traverse(o => o.geometry?.dispose()); }
      this.done = buildPath(this.it, this.pts, (v / this.total) * this.geomLen, 'done');
      this.group.add(this.done);
    } else {
      v = STATUS[v] ? v : 'pendente';
      if (v === this.value) return;
      this.value = v;
      const mode = v === 'instalado' ? 'done' : v === 'pendente' ? 'ghost' : v;
      this.body.traverse(o => { if (o.isMesh) o.material = getMat(o.userData.color, mode); });
    }
    this.applyVisibility();
  }
  applyVisibility() {
    if (this.linear) this.ghost.visible = showGhost;
    else this.body.visible = showGhost || this.value !== 'pendente';
  }
  fraction() { return this.linear ? this.value / this.total : STATUS[this.value].f; }
  valueText() { return this.linear ? `${fmt(this.value)} / ${fmt(this.total)} m` : STATUS[this.value].label; }
  // distância (em metros do item) ao longo do trecho até o ponto clicado
  metersAt(point) {
    let best = Infinity, at = 0, cum = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1], ab = b.clone().sub(a), L = ab.length();
      const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / (L * L)));
      const d = a.clone().addScaledVector(ab, t).distanceTo(point);
      if (d < best) { best = d; at = cum + t * L; }
      cum += L;
    }
    return Math.round((at / this.geomLen) * this.total * 10) / 10;
  }
}
const items = ITEMS.map(it => new Item(it));
const byId = Object.fromEntries(items.map(x => [x.it.id, x]));

// ------------------------------------------------------------ estado / persistência
const KEY = 'obra3d-cag-sjs';
let state = { version: 1, logs: [] };
let viewDate = TODAY;
let sel = null, clickM = null;
const openGroups = new Set(['Equipamentos']);

async function load() {
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (r.ok) { state = await r.json(); setSaved('Conectado ao servidor local'); return; }
  } catch {}
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.logs) state = s; } catch {}
  setSaved('Sem servidor – salvando só neste navegador', true);
}
async function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  try {
    const r = await fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    if (!r.ok) throw new Error();
    setSaved('Salvo ' + new Date().toLocaleTimeString('pt-BR'));
  } catch { setSaved('Salvo só neste navegador (servidor indisponível)', true); }
}
function setSaved(t, warn) { const e = $('#saved'); e.textContent = t; e.classList.toggle('warn', !!warn); }

function valueAt(id, date) {
  let best = null;
  for (const l of state.logs) {
    if (l.item !== id || l.date > date) continue;
    if (!best || l.date > best.date || (l.date === best.date && l.ts > best.ts)) best = l;
  }
  return best?.value;
}

function applyAll() {
  for (const x of items) x.setValue(valueAt(x.it.id, viewDate) ?? (x.linear ? 0 : 'pendente'));
  if (selBox) selBox.update();
  syncTimeline();
  renderSide();
  // não apaga o formulário enquanto o usuário está digitando
  const typing = $('#detail').contains(document.activeElement) && document.activeElement.matches('textarea, input[type=number], input[type=date]');
  if (!typing) renderDetail();
}

// ------------------------------------------------------------ painel lateral
function renderSide() {
  const all = items.map(x => x.fraction());
  const overall = all.reduce((a, b) => a + b, 0) / all.length;
  $('#overall').innerHTML = `<div class="big">${Math.round(overall * 100)}<small>%</small></div>
    <div class="lbl">Avanço geral ${viewDate === TODAY ? 'hoje' : 'em ' + br(viewDate)}</div>${bar(overall, 'lg')}`;
  const q = $('#search').value.trim().toLowerCase();
  let html = '';
  for (const gname of GROUP_ORDER) {
    const its = items.filter(x => x.it.group === gname);
    if (!its.length) continue;
    let pct, txt;
    if (its[0].linear) {
      const tot = its.reduce((s, x) => s + x.total, 0), done = its.reduce((s, x) => s + x.value, 0);
      pct = done / tot; txt = `${fmt(done)} / ${fmt(tot)} m`;
    } else {
      pct = its.reduce((s, x) => s + x.fraction(), 0) / its.length;
      txt = `${its.filter(x => STATUS[x.value].f === 1).length} / ${its.length}`;
    }
    const shown = its.filter(x => !q || `${x.it.id} ${x.it.name} ${KIND[x.it.kind]}`.toLowerCase().includes(q));
    if (q && !shown.length) continue;
    html += `<details ${openGroups.has(gname) || q ? 'open' : ''} data-g="${esc(gname)}">
      <summary><div class="gh"><span class="gname">${esc(gname)}</span><span class="gtxt">${txt}</span></div>${bar(pct)}</summary>
      ${shown.map(row).join('')}</details>`;
  }
  $('#list').innerHTML = html;
}
function row(x) {
  const it = x.it;
  const val = x.linear ? `<span class="rv">${Math.round(x.fraction() * 100)}%</span>`
                       : `<span class="chip ${STATUS[x.value].cls}">${STATUS[x.value].label}</span>`;
  return `<div class="row ${sel === it.id ? 'sel' : ''}" data-id="${esc(it.id)}">
    <span class="dot" style="background:${hex(SYSTEMS[it.system].color)}"></span>
    <div class="rmain"><div class="rid">${esc(it.id)}</div><div class="rname">${esc(it.name)}</div></div>${val}</div>`;
}
$('#list').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) select(r.dataset.id, true); });
$('#list').addEventListener('toggle', e => {
  const g = e.target.dataset?.g; if (!g || $('#search').value) return;
  e.target.open ? openGroups.add(g) : openGroups.delete(g);
}, true);
$('#search').addEventListener('input', renderSide);

// ------------------------------------------------------------ painel de detalhes
function renderDetail() {
  const d = $('#detail');
  if (!sel) { d.hidden = true; return; }
  d.hidden = false;
  const x = byId[sel], it = x.it;
  const logs = state.logs.filter(l => l.item === sel).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const defDate = viewDate;
  let h = `<button class="close" data-a="close" title="Fechar">×</button>
    <div class="kind"><span class="dot" style="background:${hex(SYSTEMS[it.system].color)}"></span>${KIND[it.kind]} · ${esc(SYSTEMS[it.system].name)}</div>
    <h2>${esc(it.id)}</h2><div class="name">${esc(it.name)}</div>
    ${it.spec ? `<div class="spec">${esc(it.spec)}</div>` : ''}
    ${it.dia ? `<div class="spec">Ø aprox. ${Math.round(it.dia * 1000)} mm</div>` : ''}`;
  if (x.linear) {
    h += `<div class="metric"><b>${fmt(x.value)} m</b> de ${fmt(x.total)} m concluídos <span>${Math.round(x.fraction() * 100)}%</span></div>${bar(x.fraction(), 'lg')}`;
  } else {
    h += `<div class="metric">Situação: <span class="chip ${STATUS[x.value].cls}">${STATUS[x.value].label}</span></div>`;
  }
  if (SUB[it.kind]) h += subHTML(x);
  if (viewDate !== TODAY) h += `<div class="notice">Você está vendo a obra como estava em <b>${br(viewDate)}</b>.</div>`;
  h += `<form id="f"><h3>Registrar avanço</h3>`;
  if (x.linear) {
    h += `<label>Metros concluídos (total acumulado)</label>
      <div class="mrow"><input type="range" id="fr" min="0" max="${x.total}" step="0.1" value="${x.value}">
      <input type="number" id="fm" min="0" max="${x.total}" step="0.1" value="${x.value}"><span>m</span></div>
      <div class="quick">
        <button type="button" data-q="1">+1 m</button><button type="button" data-q="5">+5 m</button>
        <button type="button" data-q="all">100%</button>
        <button type="button" data-q="click" ${clickM == null ? 'disabled title="Clique no trecho no 3D"' : ''}>Até o ponto clicado${clickM != null ? ` (${fmt(clickM)} m)` : ''}</button>
      </div>`;
  } else {
    h += `<label>Situação</label><div class="sts">${Object.entries(STATUS).map(([k, s]) =>
      `<label class="st ${s.cls}"><input type="radio" name="st" value="${k}" ${x.value === k ? 'checked' : ''}><span>${s.label}</span></label>`).join('')}</div>`;
  }
  h += `<div class="two"><div><label>Data</label><input type="date" id="fd" value="${defDate}" max="${TODAY}"></div></div>
    <label>Observação</label><textarea id="fn" rows="2" placeholder="Ex.: soldado e testado, falta isolamento…"></textarea>
    <button class="primary" type="submit">Registrar</button></form>
    <h3>Histórico</h3>
    ${logs.length ? `<ul class="hist">${logs.map(l => `<li><div><b>${br(l.date)}</b> · ${
      x.linear ? fmt(l.value) + ' m' : esc(STATUS[l.value]?.label ?? l.value)}${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}</div>
      <button data-del="${esc(l.id)}" title="Excluir registro">×</button></li>`).join('')}</ul>`
      : '<div class="empty">Nenhum registro ainda.</div>'}
    <button class="ghostbtn" data-a="focus">${walking ? 'Ir até a peça' : 'Centralizar no 3D'}</button>`;
  d.innerHTML = h;
  if (SUB[it.kind]) attachMini(x);
}
const detail = $('#detail');
detail.addEventListener('change', e => {
  const k = e.target.dataset.sub; if (!k) return;
  const x = byId[sel], s = SUB[x.it.kind](x.it).find(s => s.k === k);
  setSubs(x, [s], e.target.checked ? 'instalado' : 'pendente');
});
detail.addEventListener('input', e => {
  if (e.target.id === 'explode') { explode = +e.target.value; if (mini) buildMini(byId[sel]); }
  if (e.target.id === 'fr') $('#fm').value = e.target.value;
  if (e.target.id === 'fm') $('#fr').value = e.target.value;
});
detail.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const x = byId[sel];
  if (t.dataset.a === 'close') return select(null);
  if (t.dataset.a === 'focus') return focusOn(x);
  if (t.dataset.a === 'suball') return setSubs(x, SUB[x.it.kind](x.it), 'instalado');
  if (t.dataset.q) {
    const fm = $('#fm'); let v = +fm.value;
    if (t.dataset.q === 'all') v = x.total; else if (t.dataset.q === 'click') v = clickM; else v += +t.dataset.q;
    v = Math.max(0, Math.min(x.total, Math.round(v * 10) / 10));
    fm.value = v; $('#fr').value = v;
  }
  if (t.dataset.del && confirm('Excluir este registro do histórico?')) {
    state.logs = state.logs.filter(l => l.id !== t.dataset.del);
    save(); applyAll();
  }
});
detail.addEventListener('submit', e => {
  e.preventDefault();
  const x = byId[sel];
  const date = $('#fd').value || TODAY;
  if (date > TODAY) return alert('A data não pode ser no futuro.');
  let value;
  if (x.linear) value = Math.max(0, Math.min(x.total, Math.round(+$('#fm').value * 10) / 10));
  else value = detail.querySelector('input[name=st]:checked')?.value ?? 'pendente';
  state.logs.push({ id: uid(), item: sel, date, value, note: $('#fn').value.trim(), ts: Date.now() });
  if (date > viewDate) viewDate = date;
  save(); applyAll();
});

// ------------------------------------------------------------ seleção / câmera
let selBox = null;
function select(id, focus = false, point = null) {
  sel = id;
  clickM = null;
  if (selBox) { scene.remove(selBox); selBox.dispose?.(); selBox = null; }
  if (id) {
    const x = byId[id];
    if (point && x.linear) clickM = x.metersAt(point);
    selBox = new THREE.BoxHelper(x.group, 0xffffff); scene.add(selBox);
    if (focus) focusOn(x);
    const g = x.it.group; if (!openGroups.has(g)) openGroups.add(g);
  }
  renderSide(); renderDetail();
  $('#list .row.sel')?.scrollIntoView({ block: 'nearest' });
}
let anim = null;
function flyTo(target, pos, ms = 600) {
  anim = { t0: performance.now(), ms, ft: controls.target.clone(), fp: camera.position.clone(), tt: target, tp: pos };
}
function focusOn(x) {
  const box = new THREE.Box3().setFromObject(x.group), c = box.getCenter(new THREE.Vector3());
  if (walking) { // "teletransporta" para perto da peça, na altura dos olhos
    const d = camera.position.clone().sub(c); d.y = 0;
    if (d.length() < 0.01) d.set(1, 0, 0);
    d.setLength(Math.max(1.5, box.getSize(new THREE.Vector3()).length()));
    walkTo(new THREE.Vector3(c.x + d.x, eye, c.z + d.z), c);
    return;
  }
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.35) { dir.y = 0.5; dir.normalize(); }
  flyTo(c, c.clone().addScaledVector(dir, Math.max(1.6, size * 1.6)));
}
const HOME = { t: new THREE.Vector3(1.5, 0.5, 2.5), p: new THREE.Vector3(-11, 17, 21) };
camera.position.copy(HOME.p); controls.target.copy(HOME.t);

// ------------------------------------------------------------ picking / tooltip
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function setNDC(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
}
const visibleChain =o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function pick(ev) {
  setNDC(ev);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(itemRoot.children, true).filter(h => visibleChain(h.object));
  if (!hits.length) return null;
  const own = h => { let o = h.object; while (o && !o.userData.itemId) o = o.parent; return byId[o.userData.itemId]; };
  // peças pequenas (flanges, válvulas) dentro de tubos têm preferência
  const d0 = hits[0].distance;
  const small = hits.find(h => h.distance < d0 + 0.3 && !own(h).linear);
  const h = small ?? hits[0];
  return { item: own(h), point: h.point };
}
let down = null;
const tip = $('#tip');
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const p = pick(e);
  select(p ? p.item.it.id : null, false, p?.point);
});
let hoverEv = null;
renderer.domElement.addEventListener('pointermove', e => { hoverEv = e; });
renderer.domElement.addEventListener('pointerleave', () => { hoverEv = null; tip.hidden = true; });
function updateHover() {
  if (!hoverEv || look) return;
  const e = hoverEv; hoverEv = null;
  const p = pick(e);
  renderer.domElement.style.cursor = p ? 'pointer' : '';
  if (!p) { tip.hidden = true; return; }
  const x = p.item;
  const extra = x.linear ? ` · ponto ≈ ${fmt(x.metersAt(p.point))} m` : '';
  tip.innerHTML = `<b>${esc(x.it.id)}</b> ${esc(x.it.name)}<br><span>${x.valueText()}${extra}</span>`;
  const r = view.getBoundingClientRect();
  tip.style.left = e.clientX - r.left + 14 + 'px'; tip.style.top = e.clientY - r.top + 14 + 'px';
  tip.hidden = false;
}

// ------------------------------------------------------------ linha do tempo
const tl = $('#tl');
let tlStart = TODAY;
function syncTimeline() {
  const dates = state.logs.map(l => l.date).filter(d => d <= TODAY);
  tlStart = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : addDays(TODAY, -30);
  if (tlStart >= TODAY) tlStart = addDays(TODAY, -1);
  tl.max = daysBetween(tlStart, TODAY);
  tl.value = daysBetween(tlStart, viewDate);
  $('#tlDate').innerHTML = `<b>${br(viewDate)}</b>${viewDate === TODAY ? ' · hoje' : ''}`;
  $('#today').disabled = viewDate === TODAY;
}
tl.addEventListener('input', () => { stopPlay(); viewDate = addDays(tlStart, +tl.value); applyAll(); });
$('#today').addEventListener('click', () => { stopPlay(); viewDate = TODAY; applyAll(); });
let playTimer = null;
function stopPlay() { clearInterval(playTimer); playTimer = null; $('#play').textContent = '▶'; }
$('#play').addEventListener('click', () => {
  if (playTimer) return stopPlay();
  const total = daysBetween(tlStart, TODAY), step = Math.max(1, Math.ceil(total / 80));
  if (viewDate >= TODAY) viewDate = tlStart;
  $('#play').textContent = '❚❚';
  playTimer = setInterval(() => {
    viewDate = addDays(viewDate, step);
    if (viewDate >= TODAY) { viewDate = TODAY; stopPlay(); }
    applyAll();
  }, 140);
});

// ------------------------------------------------------------ barra de ferramentas
let planMode = 0;
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'home') flyTo(HOME.t.clone(), HOME.p.clone());
  if (a === 'top') flyTo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 34, 0.01));
  if (a === 'plan') { planMode = (planMode + 1) % 3; floorMat.opacity = [0.92, 0.35, 0][planMode]; floor.visible = planMode < 2; b.classList.toggle('on', planMode < 2); }
  if (a === 'walls') { walls.visible = !walls.visible; b.classList.toggle('on', walls.visible); }
  if (a === 'ghost') { showGhost = !showGhost; b.classList.toggle('on', showGhost); items.forEach(x => x.applyVisibility()); }
  if (a === 'side') document.body.classList.toggle('side-open');
  if (a === 'walk') setWalk(!walking);
  if (a === 'export') exportJSON();
  if (a === 'csv') exportCSV();
  if (a === 'import') $('#file').click();
  if (a === 'sample') {
    if (state.logs.length && !confirm('Isto substitui todos os registros atuais por dados de exemplo. Continuar?')) return;
    state = { version: 1, logs: sampleLogs() }; viewDate = TODAY; save(); applyAll();
  }
  if (a === 'clear') {
    if (!confirm('Apagar TODOS os registros de avanço? (exporte antes se quiser guardar)')) return;
    state = { version: 1, logs: [] }; viewDate = TODAY; save(); applyAll();
  }
});
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportJSON() { download(`avanco-obra-${TODAY}.json`, JSON.stringify(state, null, 2), 'application/json'); }
function exportCSV() {
  const rows = [['Item', 'Descrição', 'Grupo', 'Tipo', 'Situação/Concluído', 'Total (m)', '% ']];
  for (const x of items) rows.push([x.it.id, x.it.name, x.it.group, KIND[x.it.kind],
    x.linear ? String(x.value).replace('.', ',') : STATUS[x.value].label, x.linear ? String(x.total).replace('.', ',') : '',
    Math.round(x.fraction() * 100)]);
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(`relatorio-obra-${viewDate}.csv`, csv, 'text/csv');
}
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.logs)) throw new Error('Arquivo sem "logs"');
    if (!confirm(`Importar ${s.logs.length} registros? Os registros atuais serão substituídos.`)) return;
    state = { version: 1, logs: s.logs.filter(l => byId[l.item] && l.date) };
    viewDate = TODAY; save(); applyAll();
  } catch (err) { alert('Não foi possível importar: ' + err.message); }
});

// ------------------------------------------------------------ dados de exemplo
function sampleLogs() {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const D = 45, start = addDays(TODAY, -D), logs = [];
  const push = (item, day, value, note = '') =>
    logs.push({ id: uid(), item, date: addDays(start, Math.min(D, day)), value, note, ts: Date.now() + logs.length });
  const plan = {
    'Tubulação água gelada': [2, 1], 'Tubulação condensação': [12, 0.75], 'Dutos': [24, 0.45],
  };
  const prob = { chiller: 1, pump: 0.85, valve: 0.75, flange: 0.65, support: 0.9, ahu: 0.67, grille: 0.25, damper: 0 };
  for (const x of items) {
    const id = x.it.id;
    if (x.linear) {
      const [d0, target] = plan[x.it.group];
      let v = 0, day = d0 + Math.floor(rnd() * 6);
      const goal = x.total * (target - rnd() * 0.25);
      while (day <= D && v < goal) {
        v = Math.min(goal, v + x.total * (0.12 + rnd() * 0.3));
        push(id, day, Math.round(v * 10) / 10, rnd() < 0.2 ? 'Trecho soldado e fixado' : '');
        day += 3 + Math.floor(rnd() * 6);
      }
    } else if (rnd() < prob[x.it.kind]) {
      const d = x.it.kind === 'chiller' ? 3 + Math.floor(rnd() * 6) : x.it.kind === 'support' ? 1 + Math.floor(rnd() * 15) : 8 + Math.floor(rnd() * 30);
      push(id, d, 'montagem');
      if (rnd() < 0.9) push(id, d + 1 + Math.floor(rnd() * 4), rnd() < 0.1 ? 'pendencia' : 'instalado',
        rnd() < 0.1 ? 'Falta aperto final / teste de estanqueidade' : '');
    } else if (rnd() < 0.3) push(id, D - 2, 'montagem');
  }
  return logs;
}

// ------------------------------------------------------------ detalhes de instalação (componentes)
const SUB = {
  valve: it => [
    { k: 'corpo', label: 'Corpo da válvula posicionado' },
    { k: 'fl1', label: 'Flange 1', ref: `${it.id}-FL1` },
    { k: 'jt1', label: 'Junta de vedação – flange 1' },
    { k: 'pf1', label: 'Parafusos e porcas – flange 1 (8 un, torqueados)' },
    { k: 'fl2', label: 'Flange 2', ref: `${it.id}-FL2` },
    { k: 'jt2', label: 'Junta de vedação – flange 2' },
    { k: 'pf2', label: 'Parafusos e porcas – flange 2 (8 un, torqueados)' },
    { k: 'act', label: it.actuator === 'alavanca' ? 'Alavanca de manobra' : 'Volante de manobra' },
    { k: 'teste', label: 'Teste de estanqueidade / manobra' },
  ],
  pump: it => [
    { k: 'base', label: 'Base e chumbadores' },
    { k: 'corpo', label: 'Corpo da bomba' },
    { k: 'motor', label: 'Motor e acoplamento alinhados' },
    { k: 'fl1', label: 'Flange de sucção', ref: `${it.id}-FL1` },
    { k: 'jt1', label: 'Junta de vedação – sucção' },
    { k: 'pf1', label: 'Parafusos e porcas – sucção (8 un)' },
    { k: 'fl2', label: 'Flange de recalque', ref: `${it.id}-FL2` },
    { k: 'jt2', label: 'Junta de vedação – recalque' },
    { k: 'pf2', label: 'Parafusos e porcas – recalque (8 un)' },
    { k: 'eletr', label: 'Ligação elétrica' },
    { k: 'teste', label: 'Teste de funcionamento / sentido de giro' },
  ],
};
const subKey = (it, s) => s.ref ?? `${it.id}#${s.k}`;
const subVal = (it, s) => valueAt(subKey(it, s), viewDate) ?? 'pendente';
let explode = 0.6;

function subHTML(x) {
  const subs = SUB[x.it.kind](x.it);
  const done = subs.filter(s => STATUS[subVal(x.it, s)]?.f === 1).length;
  return `<div class="subwrap"><h3>Detalhes de instalação <span>${done}/${subs.length}</span></h3>
    <div id="miniSlot"><div id="miniCap">Clique numa peça para marcar/desmarcar</div></div>
    <label class="exp">Vista explodida <input type="range" id="explode" min="0" max="1" step="0.01" value="${explode}"></label>
    <ul class="sub">${subs.map(s => {
      const v = subVal(x.it, s);
      const last = state.logs.filter(l => l.item === subKey(x.it, s) && l.date <= viewDate).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)[0];
      return `<li data-k="${s.k}"><label><input type="checkbox" data-sub="${s.k}" ${STATUS[v]?.f === 1 ? 'checked' : ''}>
        <span>${esc(s.label)}${v === 'pendencia' ? ' <em class="chip st-issue">pendência</em>' : ''}</span></label>
        <small>${last && v !== 'pendente' ? br(last.date) : ''}</small></li>`;
    }).join('')}</ul>
    <button type="button" class="ghostbtn" data-a="suball">Marcar todos como instalados</button>
    <div class="hint">A situação da peça é atualizada sozinha: tudo marcado = Instalado; parte = Em montagem.</div></div>`;
}

function setSubs(x, subs, value) {
  const date = viewDate, ts = Date.now();
  subs.forEach((s, i) => state.logs.push({ id: uid(), item: subKey(x.it, s), date, value, note: '', ts: ts + i }));
  // situação geral da peça a partir do checklist
  const all = SUB[x.it.kind](x.it);
  const n = all.filter(s => STATUS[s === undefined ? 'pendente' : (subs.includes(s) ? value : subVal(x.it, s))]?.f === 1).length;
  const auto = n === all.length ? 'instalado' : n > 0 ? 'montagem' : 'pendente';
  const cur = valueAt(x.it.id, date) ?? 'pendente';
  if (cur !== auto && !(cur === 'pendencia' && auto === 'instalado'))
    state.logs.push({ id: uid(), item: x.it.id, date, value: auto, note: `Checklist ${n}/${all.length}`, ts: ts + 99 });
  save(); applyAll();
}

// ---- mini visualizador 3D (vista explodida)
let mini = null;
function ensureMini() {
  if (mini) return mini;
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x10151b);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x333a44, 1.8));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 2); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(38, 1.4, 0.01, 50);
  const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
  const root = new THREE.Group(); sc.add(root);
  mini = { r, sc, cam, ctl, root, itemId: null };
  const mray = new THREE.Raycaster(), mv = new THREE.Vector2();
  const hit = e => {
    const b = r.domElement.getBoundingClientRect();
    mv.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    mray.setFromCamera(mv, cam);
    for (const h of mray.intersectObjects(root.children, true)) {
      let o = h.object; while (o && !o.userData.sub) o = o.parent;
      if (o) return o.userData.sub;
    }
    return null;
  };
  let md = null;
  r.domElement.addEventListener('pointerdown', e => { md = { x: e.clientX, y: e.clientY }; });
  r.domElement.addEventListener('pointermove', e => {
    const k = hit(e), x = byId[sel]; if (!x || !SUB[x.it.kind]) return;
    const s = k && SUB[x.it.kind](x.it).find(s => s.k === k);
    $('#miniCap').textContent = s ? `${s.label} – ${STATUS[subVal(x.it, s)]?.label}` : 'Clique numa peça para marcar/desmarcar';
    r.domElement.style.cursor = s ? 'pointer' : '';
    detail.querySelectorAll('.sub li').forEach(li => li.classList.toggle('hl', li.dataset.k === k));
  });
  r.domElement.addEventListener('pointerup', e => {
    if (!md || Math.hypot(e.clientX - md.x, e.clientY - md.y) > 5) return;
    const k = hit(e), x = byId[sel]; if (!k) return;
    const s = SUB[x.it.kind](x.it).find(s => s.k === k);
    setSubs(x, [s], STATUS[subVal(x.it, s)]?.f === 1 ? 'pendente' : 'instalado');
  });
  return mini;
}
function attachMini(x) {
  const m = ensureMini(), slot = $('#miniSlot');
  slot.prepend(m.r.domElement);
  const w = slot.clientWidth || 318, h = 230;
  m.r.setSize(w, h); m.cam.aspect = w / h; m.cam.updateProjectionMatrix();
  if (m.itemId !== x.it.id) {
    m.itemId = x.it.id;
    m.cam.position.set(1.55, 0.9, 1.35); m.ctl.target.set(0, x.it.kind === 'pump' ? 0.2 : 0.08, 0);
  }
  buildMini(x);
  detail.querySelectorAll('.sub li').forEach(li => {
    li.onmouseenter = () => highlightSub(li.dataset.k); li.onmouseleave = () => highlightSub(null);
  });
}
let hlKey = null;
function highlightSub(k) {
  hlKey = k;
  mini?.root.traverse(o => { if (o.userData.sub) o.scale.setScalar(o.userData.sub === k ? 1.08 : 1); });
}
function buildMini(x) {
  const m = mini, it = x.it, e = explode, r = it.dia / 2, R = r * 1.75;
  m.root.children.slice().forEach(c => { m.root.remove(c); c.traverse(o => o.geometry?.dispose()); });
  const subs = SUB[it.kind](it);
  const part = (k, obj) => {
    const v = subVal(it, subs.find(s => s.k === k));
    const mode = v === 'instalado' ? 'done' : v === 'pendente' ? 'mini' : v;
    obj.traverse(o => { if (o.isMesh) o.material = mode === 'mini' ? miniGhost(o.userData.color) : getMat(o.userData.color, mode); });
    obj.userData.sub = k; m.root.add(obj);
  };
  const grp = (...objs) => { const g = new THREE.Group(); objs.forEach(o => g.add(o)); return g; };
  const at = (obj, z, y = 0, x0 = 0) => { obj.position.set(x0, y, z); return obj; };
  // trechos de tubo de referência
  const pc = SYSTEMS[x.it.id.includes('CD') ? 'cd' : 'chw'].color;
  const isPump = it.kind === 'pump', half = isPump ? 0.19 : 0.1;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(CYL(r, 0.35, 20), miniGhost(pc)); p.rotation.x = Math.PI / 2;
    p.position.z = s * (half + 0.05 + e * 0.75 + 0.2); m.root.add(p);
  }
  // flanges, juntas e parafusos dos dois lados
  [[-1, 1], [1, 2]].forEach(([s, n]) => {
    part(`fl${n}`, at(grp(flangeDisc(R)), s * (half + 0.03 + e * 0.35)));
    part(`jt${n}`, at(grp(gasket(r * 1.25)), s * (half + 0.005 + e * 0.17)));
    part(`pf${n}`, at(grp(boltRing(R, 0.16)), s * (half + 0.03 + e * 0.6)));
  });
  if (it.kind === 'valve') {
    const body = mesh(CYL(r * 1.2, 0.2, 24), SYSTEMS.valve.color); body.rotation.x = Math.PI / 2;
    part('corpo', grp(body, mesh(CYL(0.025, 0.3, 8), DARK, 0, r + 0.15, 0)));
    const act = actuatorMesh(it, r + 0.3); act.position.y = e * 0.3; part('act', act);
  } else {
    const body = mesh(CYL(r * 1.5, 0.38, 24), SYSTEMS.pump.color); body.rotation.x = Math.PI / 2;
    part('corpo', grp(body));
    const mot = grp(mesh(CYL(0.08, 0.18, 16), SYSTEMS.pump.color, 0, r * 1.5 + 0.05, 0),
      mesh(CYL(0.17, 0.5, 24), 0x24564a, 0, r * 1.5 + 0.38, 0), mesh(CYL(0.18, 0.06, 24), DARK, 0, r * 1.5 + 0.66, 0));
    mot.position.y = e * 0.3; part('motor', mot);
    const by = -(r * 1.5 + 0.06) - e * 0.25;
    const base = grp(mesh(BOX(0.5, 0.04, 0.5), DARK, 0, 0, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) base.add(mesh(CYL(0.012, 0.16, 6), 0x5d6670, a * 0.2, -0.04, b * 0.2));
    base.position.y = by; part('base', base);
    const jb = grp(mesh(BOX(0.1, 0.12, 0.08), 0xd98c1f)); jb.position.set(0.2 + e * 0.25, r * 1.5 + 0.35, 0); part('eletr', jb);
  }
  highlightSub(hlKey);
}
const ghostCache = new Map();
function miniGhost(color) {
  if (!ghostCache.has(color)) ghostCache.set(color, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, roughness: 1 }));
  return ghostCache.get(color);
}

// ------------------------------------------------------------ modo andar (estilo "Street View")
// Arrastar o mouse = girar a cabeça · cursor sempre livre para clicar nas peças
// W A S D / setas = andar · Shift = correr · Q / E = abaixar / subir · duplo clique no piso = ir até lá
let walking = false, eye = 1.65, yaw = 0, pitch = 0, look = null, glide = null;
const keys = {};
addEventListener('keydown', e => { if (!e.target.matches?.('input, textarea')) keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => Object.keys(keys).forEach(k => (keys[k] = false)));
const applyLook = () => camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
function lookAtPoint(p) {
  const d = p.clone().sub(camera.position);
  yaw = Math.atan2(-d.x, -d.z);
  pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  applyLook();
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (!walking) return;
  look = { x: e.clientX, y: e.clientY, moved: false };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!walking || !look) return;
  const dx = e.clientX - look.x, dy = e.clientY - look.y;
  if (!look.moved && Math.hypot(dx, dy) < 4) return;
  look.moved = true; glide = null; tip.hidden = true;
  renderer.domElement.style.cursor = 'grabbing';
  yaw += dx * 0.0035; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * 0.0035));
  look.x = e.clientX; look.y = e.clientY;
  applyLook();
});
const endLook = () => { look = null; if (walking) renderer.domElement.style.cursor = ''; };
renderer.domElement.addEventListener('pointerup', endLook);
renderer.domElement.addEventListener('pointercancel', endLook);
renderer.domElement.addEventListener('dblclick', e => {
  if (!walking) return;
  setNDC(e); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(floor)[0];
  if (h) walkTo(new THREE.Vector3(h.point.x, eye, h.point.z));
});
function walkTo(pos, lookTarget) {
  glide = { from: camera.position.clone(), to: pos, t0: performance.now(),
    ms: Math.min(1500, 250 + camera.position.distanceTo(pos) * 180), lookTarget };
}
function setWalk(on) {
  walking = on; anim = null; glide = null;
  controls.enabled = !on;
  $('[data-act=walk]').classList.toggle('on', on);
  $('#walkhelp').hidden = !on;
  if (on) {
    eye = 1.65;
    camera.position.copy(W([745, 560, eye]));
    lookAtPoint(W([745, 800, 1.3]));
  } else {
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    controls.target.copy(camera.position).addScaledVector(fwd, 4);
    flyTo(HOME.t.clone(), HOME.p.clone(), 900);
  }
  renderDetail();
}
const lim = { x: FW / 2 + 1, z: FD / 2 + 1 };
function moveWalk(dt) {
  const sp = 2.2 * (keys.ShiftLeft || keys.ShiftRight ? 2.6 : 1) * dt;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (f || s) {
    glide = null;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    camera.position.addScaledVector(fwd, f * sp).addScaledVector(right, s * sp);
  }
  if (keys.KeyE) eye = Math.min(4.0, eye + 1.5 * dt);
  if (keys.KeyQ) eye = Math.max(0.4, eye - 1.5 * dt);
  if (glide) {
    const k = Math.min(1, (performance.now() - glide.t0) / glide.ms), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(glide.from, glide.to, e);
    if (glide.lookTarget) {
      const d = glide.lookTarget.clone().sub(camera.position);
      const ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * Math.min(1, dt * 8); pitch += (tp - pitch) * Math.min(1, dt * 8);
      applyLook();
    }
    if (k >= 1) { eye = glide.to.y; glide = null; }
  } else camera.position.y = eye;
  camera.position.x = Math.max(-lim.x, Math.min(lim.x, camera.position.x));
  camera.position.z = Math.max(-lim.z, Math.min(lim.z, camera.position.z));
}

// ------------------------------------------------------------ legenda
$('#legend').innerHTML = '<summary>Legenda</summary>' +
  ['chw', 'cd', 'duct', 'chiller', 'pump', 'ahu'].map(k => `<span><i style="background:${hex(SYSTEMS[k].color)}"></i>${SYSTEMS[k].name}</span>`).join('') +
  `<span><i class="lg-ghost"></i>Pendente (transparente)</span><span><i style="background:#ff9f1c"></i>Em montagem</span><span><i style="background:#e63946"></i>Com pendência</span>`;

// ------------------------------------------------------------ loop
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
resize();
const clock = new THREE.Clock();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (walking) moveWalk(dt);
  else {
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.ms), e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(anim.ft, anim.tt, e); camera.position.lerpVectors(anim.fp, anim.tp, e);
      if (k >= 1) anim = null;
    }
    controls.update();
  }
  updateHover();
  renderer.render(scene, camera);
  if (mini && mini.r.domElement.isConnected && !detail.hidden) { mini.ctl.update(); mini.r.render(mini.sc, mini.cam); }
}
await load();
applyAll();
requestAnimationFrame(loop);
