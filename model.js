// =====================================================================
//  MODELO DA OBRA – CAG Shopping Jardim Sul (SJS-ME-CAG-DE-001-R01)
//  Coordenadas tiradas da planta: [x_px, y_px, altura_m]
//  x/y em pixels da planta (folha A1 com 2000 px de largura, escala 1:50
//  => 1 px = 0,021 m). Altura (elevação) em metros a partir do piso.
//  As elevações são estimadas (a planta não traz cotas de altura) –
//  ajuste as constantes abaixo se precisar.
//  Para corrigir um comprimento real, acrescente `length: <metros>` no item.
// =====================================================================

export const PLAN = { x0: 230, y0: 75, x1: 1440, y1: 1210, S: 0.021, image: 'planta.jpg' };

export const H = { AG: 0.9, CD: 2.4, DT: 3.0, FC: 2.6, CEIL: 4.2 };

export const SYSTEMS = {
  chw:     { name: 'Água gelada',              color: 0x1f78d1 },
  cd:      { name: 'Água de condensação',      color: 0x23a33a },
  duct:    { name: 'Dutos de insuflamento',    color: 0x8fd9ee },
  chiller: { name: 'Chiller',                  color: 0xe7c23b },
  ahu:     { name: 'Fancoil',                  color: 0xb7b46c },
  pump:    { name: 'Bomba',                    color: 0x2e7d6b },
  valve:   { name: 'Válvula',                  color: 0x37474f },
  flange:  { name: 'Flange',                   color: 0xa7b1bc },
  support: { name: 'Suporte',                  color: 0xf2cf1d },
  grille:  { name: 'Grelha',                   color: 0xeef2f5 },
  damper:  { name: 'Damper',                   color: 0x8d99ae },
};

export const GROUP_ORDER = [
  'Equipamentos', 'Tubulação água gelada', 'Tubulação condensação', 'Dutos',
  'Válvulas', 'Flanges', 'Suportes', 'Grelhas e damper',
];

export const ITEMS = [];
const add = o => (ITEMS.push(o), o);
const P = (pts, h) => pts.map(p => [p[0], p[1], p[2] ?? h]);

const pipe = (id, name, group, system, pts, dia, h, spec) =>
  add({ id, name, group, system, kind: 'pipe', dia, pts: P(pts, h), spec });
const duct = (id, name, pts, w, hh, spec) =>
  add({ id, name, group: 'Dutos', system: 'duct', kind: 'duct', w, h: hh, pts: P(pts, H.DT),
        spec: spec ?? `Duto ${Math.round(w * 1000)}x${Math.round(hh * 1000)} – painel MPU 20 mm (poliuretano + alumínio) – item 1A` });

// Equipamento em linha (bomba/válvula) + as 2 flanges de ligação
function inline(kind, id, name, group, system, pos, axis, dia, spec) {
  add({ id, name, group, system, kind, pos, axis, dia, spec });
  const off = kind === 'pump' ? 15 : 8; // px
  [-1, 1].forEach((sg, i) => add({
    id: `${id}-FL${i + 1}`, name: `Flange ${i + 1} – ${id}`, group: 'Flanges', system: 'flange', kind: 'flange',
    pos: [pos[0] + (axis === 'x' ? sg * off : 0), pos[1] + (axis === 'z' ? sg * off : 0), pos[2]], axis, dia,
    spec: `Flange de ligação ${kind === 'pump' ? 'da bomba' : 'da válvula'} ${id}`,
  }));
}

// ---------------- Coletores / prumadas existentes ----------------
pipe('AG-H1', 'Coletor de água gelada 1', 'Tubulação água gelada', 'chw',
  [[290, 710], [590, 710], [605, 728], [605, 925], [1163, 925]], 0.32, H.AG);
pipe('AG-H2', 'Coletor de água gelada 2', 'Tubulação água gelada', 'chw',
  [[290, 733], [555, 733], [570, 750], [570, 968], [1163, 968]], 0.32, H.AG);
pipe('AG-PR', 'Prumada de água gelada', 'Tubulação água gelada', 'chw',
  [[540, 705], [540, 255], [562, 255], [562, 255, H.CEIL + 0.5]], 0.25, H.AG);
pipe('AG-FC', 'Distribuição de água gelada p/ fancoils', 'Tubulação água gelada', 'chw',
  [[612, 712, H.AG], [612, 700, H.FC], [1170, 700, H.FC]], 0.08, H.FC);

pipe('CD-H1', 'Coletor de condensação 1', 'Tubulação condensação', 'cd',
  [[290, 613], [1163, 613]], 0.38, H.CD);
pipe('CD-H2', 'Coletor de condensação 2', 'Tubulação condensação', 'cd',
  [[290, 667], [1163, 667]], 0.38, H.CD);
pipe('CD-PR', 'Prumada de condensação (torres)', 'Tubulação condensação', 'cd',
  [[583, 613], [583, 80], [583, 80, H.CEIL + 0.5]], 0.2, H.CD);

// ---------------- Conjuntos por chiller ----------------
const SETS = [
  { k: 1, cx: 655, fc: 781, drop: 735 },
  { k: 2, cx: 875, fc: 985, drop: 940 },
  { k: 3, cx: 1095, fc: 1232, drop: 1170 },
];

for (const { k, cx, fc, drop } of SETS) {
  const n = `0${k}`;
  add({ id: `CH-${n}`, name: `Chiller ${n}`, group: 'Equipamentos', system: 'chiller', kind: 'chiller',
        pos: [cx + 22, 807, 0], len: 3.4, spec: 'Chiller com evaporador e condensador casco-tubo' });

  // Condensação
  pipe(`CD-R${n}`, `Ramal de condensação CH-${n}`, 'Tubulação condensação', 'cd',
    [[cx, 588], [cx, 721], [cx, 721, 1.5]], 0.2, H.CD);
  inline('pump', `BAC-${n}`, `Bomba de condensação BAC-${n}`, 'Equipamentos', 'pump', [cx, 640, H.CD], 'z', 0.2);
  inline('valve', `VCD-${n}A`, `Válvula ramal condensação CH-${n} (A)`, 'Válvulas', 'valve', [cx, 597, H.CD], 'z', 0.2);
  inline('valve', `VCD-${n}B`, `Válvula ramal condensação CH-${n} (B)`, 'Válvulas', 'valve', [cx, 692, H.CD], 'z', 0.2);

  // Água gelada
  pipe(`AG-R${n}A`, `Ramal de água gelada CH-${n} (A)`, 'Tubulação água gelada', 'chw',
    [[cx, 888], [cx, 925]], 0.2, H.AG);
  pipe(`AG-R${n}B`, `Ramal de água gelada CH-${n} (B)`, 'Tubulação água gelada', 'chw',
    [[cx + 40, 888], [cx + 40, 968]], 0.2, H.AG);
  inline('valve', `VAG-${n}A`, `Válvula ramal água gelada CH-${n} (A)`, 'Válvulas', 'valve', [cx, 905, H.AG], 'z', 0.2);
  inline('valve', `VAG-${n}B`, `Válvula ramal água gelada CH-${n} (B)`, 'Válvulas', 'valve', [cx + 40, 903, H.AG], 'z', 0.2);
  inline('pump', `BAG-${n}`, `Bomba de água gelada BAG-${n}`, 'Equipamentos', 'pump', [cx + 40, 946, H.AG], 'z', 0.2);

  // Fancoil + alimentação
  add({ id: `FC-${n}`, name: `Fancoil FC-${n}`, group: 'Equipamentos', system: 'ahu', kind: 'ahu',
        pos: [fc, 730, H.DT], size: [1.3, 0.8, 0.63], spec: 'Fancoil suspenso – insuflamento' });
  pipe(`AG-FC${n}`, `Ramal de água gelada FC-${n}`, 'Tubulação água gelada', 'chw',
    [[drop, 700], [drop, 735], [fc - 31, 735]], 0.06, H.FC);
}

// ---------------- Dutos (item 1A) ----------------
duct('DT-01A', 'Duto FC-01 – trecho 600x300', [[781, 745], [781, 855]], 0.6, 0.3);
duct('DT-01B', 'Duto FC-01 – trecho 400x250', [[781, 855], [781, 1082], [597, 1082]], 0.4, 0.25);
duct('DT-02A', 'Duto FC-02 – trecho 600x300', [[985, 745], [985, 855]], 0.6, 0.3);
duct('DT-02B', 'Duto FC-02 – trecho 400x250', [[985, 855], [985, 1060]], 0.4, 0.25);
duct('DT-03A', 'Duto FC-03 – trecho 600x300', [[1232, 745], [1232, 855]], 0.6, 0.3);
duct('DT-03B', 'Duto FC-03 – trecho 400x250', [[1232, 855], [1232, 1060]], 0.4, 0.25);

// ---------------- Grelhas e damper ----------------
const g2a = 'Grelha de insuflamento dupla deflexão 625x225 – VAT-DG Trox (item 2A)';
const grille = (id, name, pos, size, spec = g2a) =>
  add({ id, name, group: 'Grelhas e damper', system: 'grille', kind: 'grille', pos, size, spec });
grille('GR-01', 'Grelha lateral DT-01A', [766, 808, H.DT], [0.03, 0.225, 0.625]);
grille('GR-02', 'Grelha lateral DT-02A', [970, 808, H.DT], [0.03, 0.225, 0.625]);
grille('GR-03', 'Grelha lateral DT-03A', [1217, 808, H.DT], [0.03, 0.225, 0.625]);
grille('GR-04', 'Grelha final DT-02B', [985, 1061, H.DT], [0.625, 0.225, 0.03]);
grille('GR-05', 'Grelha final DT-03B', [1232, 1061, H.DT], [0.625, 0.225, 0.03]);
grille('GR-06', 'Grelha final DT-01B', [596, 1082, H.DT], [0.03, 0.225, 0.625]);
grille('GP-01', 'Grelha de porta', [515, 1020, 1.0], [0.03, 0.325, 0.525],
  'Grelha de porta dupla moldura 525x325 – AGS Trox (item 3A)');
add({ id: 'DP-01', name: 'Damper de controle manual', group: 'Grelhas e damper', system: 'damper', kind: 'damper',
      pos: [630, 1082, H.DT], axis: 'x', spec: 'Damper manual lâminas convergentes 400x250 – Trox (item 4A)' });

// ---------------- Suportes ----------------
[598, 785, 950, 1118].forEach((x, i) => add({
  id: `SP-CD-0${i + 1}`, name: `Suporte coletores condensação ${i + 1}`, group: 'Suportes', system: 'support',
  kind: 'support', pos: [x, 640, H.CD - 0.22], span: [600, 680], hang: true, spec: 'Suporte tipo trapézio pendurado na laje',
}));
[637, 800, 940, 1155].forEach((x, i) => add({
  id: `SP-AG-0${i + 1}`, name: `Suporte coletores água gelada ${i + 1}`, group: 'Suportes', system: 'support',
  kind: 'support', pos: [x, 946, H.AG - 0.2], span: [915, 980], hang: false, spec: 'Suporte de piso (cavalete)',
}));
[297, 457].forEach((y, i) => add({
  id: `SP-PR-0${i + 1}`, name: `Suporte prumada água gelada ${i + 1}`, group: 'Suportes', system: 'support',
  kind: 'support', pos: [540, y, H.AG - 0.18], span: [y - 6, y + 6], hang: false, axisX: true, spec: 'Suporte de piso',
}));

// Tipo de acionamento das válvulas (ajuste conforme a especificação real)
for (const v of ITEMS.filter(i => i.kind === 'valve')) {
  v.actuator = v.id.startsWith('VCD') ? 'alavanca' : 'volante';
  v.spec = v.actuator === 'alavanca' ? 'Válvula borboleta flangeada com alavanca' : 'Válvula gaveta flangeada com volante';
}

// ---------------- Paredes (contorno simplificado da sala) ----------------
export const WALLS = [
  [490, 75, 490, 1160], [490, 1160, 1440, 1160], [1440, 1160, 1440, 860], [1440, 860, 1290, 525],
  [490, 525, 700, 525], [785, 525, 1290, 525],
];
