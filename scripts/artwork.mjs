// Original SPirits vector artwork. SPDX-License-Identifier: CC0-1.0
// This authoring tool writes the frozen, portable v0 asset catalogue.
import { mkdir, writeFile } from 'node:fs/promises';
const ink = '{{ink}}',
  paper = '{{paper}}',
  accent = '{{accent}}';
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (x, y, r, fill = ink, extra = '') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const line = (d) =>
  path(
    d,
    'none',
    `stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`,
  );
const group = (s) =>
  `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${s}</g>`;
// One primary contour per slot. Every outline protects the shared face region;
// all tails join the same (100,100)/(0,100) endpoints.
const bodyShapes = [
  ['Drifter', 'C -8 55 8 -8 50 0 C 92 -8 108 55 100 100'],
  ['Lantern', 'L 3 23 Q 3 1 25 1 L 75 1 Q 97 1 97 23 L 100 100'],
  ['Pear', 'Q -12 66 19 34 Q 23 0 50 2 Q 77 0 81 34 Q 112 66 100 100'],
  [
    'Wanderer',
    'Q 22 80 3 58 Q -10 39 15 32 Q 22 -4 51 3 Q 88 0 88 37 Q 114 49 94 69 Q 87 83 100 100',
  ],
  ['Hood', 'L 8 31 Q 25 0 50 -8 Q 75 0 92 31 L 100 100'],
  [
    'Cloud',
    'Q -12 80 5 65 Q -12 39 18 31 Q 16 0 43 8 Q 62 -12 78 10 Q 108 8 94 39 Q 121 59 99 75 L 100 100',
  ],
  ['Raindrop', 'Q 17 68 19 28 Q 24 -7 50 -7 Q 76 -7 81 28 Q 83 68 100 100'],
  ['Bell', 'Q -14 84 8 60 Q 11 20 50 15 Q 89 20 92 60 Q 114 84 100 100'],
  ['Westward', 'L -3 40 Q 4 -7 37 -7 Q 65 -6 82 26 Q 100 49 100 100'],
  ['Eastward', 'Q 0 49 18 26 Q 35 -6 63 -7 Q 96 -7 103 40 L 100 100'],
  ['Folded', 'Q 20 81 9 59 L 1 34 L 29 9 L 49 1 L 75 12 L 99 36 L 89 59 Q 80 81 100 100'],
  [
    'Scallop',
    'Q -9 87 7 74 Q -10 56 9 43 Q 0 20 25 15 Q 43 -10 63 7 Q 97 0 96 32 Q 114 46 95 63 Q 109 83 100 100',
  ],
  ['Satchel', 'L 2 13 L 72 5 Q 95 7 95 34 L 100 100'],
  ['Diamond', 'L 1 43 L 27 15 Q 50 -7 73 15 L 99 43 L 100 100'],
  [
    'Hourglass',
    'Q 27 79 15 57 Q -1 40 15 24 Q 25 -3 50 1 Q 75 -3 85 24 Q 101 40 85 57 Q 73 79 100 100',
  ],
  ['Bean', 'Q -10 72 8 51 Q 5 17 38 5 Q 62 -6 79 14 Q 114 31 95 55 Q 79 76 100 100'],
  ['Cushion', 'Q -13 77 -6 43 Q -6 4 24 8 Q 50 -5 76 8 Q 106 4 106 43 Q 113 77 100 100'],
  ['Candle', 'Q 15 76 13 32 Q 9 -6 35 -3 L 65 -3 Q 91 -6 87 32 Q 85 76 100 100'],
  [
    'Manta',
    'Q -18 73 -4 53 Q 13 42 17 22 Q 27 0 50 4 Q 73 0 83 22 Q 87 42 104 53 Q 118 73 100 100',
  ],
  ['Droplet', 'Q 3 74 7 39 Q 10 6 44 8 Q 61 -8 71 5 Q 70 19 86 30 Q 103 45 100 100'],
  [
    'Pagoda',
    'L -5 67 L 9 52 L 5 34 L 24 16 L 33 1 L 67 1 L 76 16 L 95 34 L 91 52 L 105 67 L 100 100',
  ],
  ['Pebble', 'Q -5 70 3 35 Q 6 8 30 15 Q 43 1 63 8 Q 93 4 99 32 Q 108 65 100 100'],
  [
    'Spindle',
    'Q 24 79 12 52 Q 8 30 24 23 Q 26 -7 50 -7 Q 74 -7 76 23 Q 92 30 88 52 Q 76 79 100 100',
  ],
  ['Tassel', 'L 5 60 Q 13 28 28 25 L 28 3 L 72 3 L 72 25 Q 87 28 95 60 L 100 100'],
  [
    'Crag',
    'L -3 70 L 7 47 L 0 30 L 23 20 L 36 0 L 55 10 L 78 3 L 90 30 L 103 49 L 94 70 L 100 100',
  ],
  [
    'Puff',
    'Q -12 72 0 50 Q -7 22 22 24 Q 18 -3 48 3 Q 72 -10 79 18 Q 110 16 100 45 Q 117 74 100 100',
  ],
  ['Capsule', 'L 6 35 Q 6 -9 50 -9 Q 94 -9 94 35 L 100 100'],
  ['Sail', 'Q -6 54 11 22 Q 25 8 48 15 L 65 -7 Q 72 8 88 25 Q 103 46 100 100'],
  ['Notch', 'L 2 31 Q 2 8 23 8 L 38 8 L 50 24 L 62 8 L 77 8 Q 98 8 98 31 L 100 100'],
  ['Dome', 'L -5 52 Q -5 4 50 4 Q 105 4 105 52 L 100 100'],
  [
    'Rippleback',
    'Q -11 82 0 68 Q -9 54 4 40 Q -2 26 18 18 Q 38 -8 59 5 Q 88 -3 94 23 Q 112 38 98 55 Q 110 75 100 100',
  ],
  [
    'Shoulders',
    'Q -12 82 -3 57 Q 0 39 20 39 L 20 19 Q 20 1 50 1 Q 80 1 80 19 L 80 39 Q 100 39 103 57 Q 112 82 100 100',
  ],
];
const bodies = bodyShapes.map(([name, top], i) => {
  return {
    id: `body-${i.toString().padStart(2, '0')}`,
    name,
    svg: `M 0 100 ${top}`,
  };
});
const hems = Array.from({ length: 16 }, (_, i) => {
  const type = Math.floor(i / 2),
    depth = i % 2 ? 16 : 8;
  const d = [
    `Q 88 ${100 + depth} 76 102 Q 64 ${93 - depth / 2} 52 104 Q 38 ${100 + depth} 26 103 Q 12 ${93 - depth / 2} 0 100`,
    `Q 83 ${123 + depth} 65 105 L 47 ${91 + depth} L 30 112 Q 14 ${106 + depth} 0 100`,
    `Q 98 ${112 + depth} 78 112 Q 62 114 64 ${101 - depth / 2} Q 39 ${127 + depth / 2} 22 108 Q 7 ${119 + depth / 2} 0 100`,
    `L 86 ${105 + depth} L 68 98 L 51 ${112 + depth} L 35 101 L 16 ${104 + depth} L 0 100`,
    `Q 101 ${110 + depth} 82 ${118 + depth} Q 58 ${127 + depth / 2} 25 113 Q 9 108 0 100`,
    `L 88 ${113 + depth} L 64 107 L 50 ${126 + depth / 2} L 36 107 L 12 ${113 + depth} L 0 100`,
    `Q 92 ${128 + depth / 2} 76 105 Q 64 ${95 - depth / 2} 52 107 Q 36 ${129 + depth / 2} 21 108 Q 9 102 0 100`,
    `L 78 100 Q 76 ${119 + depth} 51 ${120 + depth} Q 26 ${119 + depth} 22 100 L 0 100`,
  ][type];
  return {
    id: `hem-${i.toString().padStart(2, '0')}`,
    name: `${['Ripple', 'Ribbon', 'Curl', 'Zigzag', 'Sweep', 'Swallowtail', 'Scalloped', 'Tassel'][type]} ${(i % 2) + 1}`,
    svg: d,
  };
});
const eyes = Array.from({ length: 64 }, (_, i) => {
  const style = Math.floor(i / 4),
    gaze = i % 4,
    dx = [-4, 4, 0, 0][gaze],
    dy = [0, 0, -4, 4][gaze],
    left = gaze < 2 ? 102 : 108,
    right = gaze < 2 ? 154 : 148;
  const pupil = (x, y, r = 4) => circle(x + dx, y + dy, r);
  const pair = (x, y, rx, ry) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${paper}" stroke="${ink}" stroke-width="3"/>${pupil(x, y)}`;
  let svg = '';
  if (style === 0)
    svg =
      pair(left, 112, gaze < 2 ? 12 : 16, gaze < 2 ? 18 : 14) +
      pair(right, 112, gaze < 2 ? 12 : 16, gaze < 2 ? 18 : 14);
  if (style === 1)
    svg =
      pair(left, 113, gaze % 2 ? 10 : 18, gaze % 2 ? 18 : 12) +
      pair(right, 110, gaze % 2 ? 18 : 10, gaze % 2 ? 12 : 18);
  if (style === 2)
    svg =
      pair(left, 112, 14, 14) +
      pair(right, 112, 14, 14) +
      line(
        `M ${left - 14} ${gaze < 2 ? 108 : 115} L ${left + 14} ${gaze < 2 ? 108 : 115} M ${right - 14} ${gaze % 2 ? 115 : 108} L ${right + 14} ${gaze % 2 ? 115 : 108}`,
      );
  if (style === 3)
    svg =
      group(
        `<rect x="${left - 14}" y="${gaze < 2 ? 97 : 103}" width="28" height="${gaze < 2 ? 30 : 21}" rx="${gaze % 2 ? 0 : 5}" fill="${paper}"/><rect x="${right - 14}" y="${gaze < 2 ? 97 : 103}" width="28" height="${gaze < 2 ? 30 : 21}" rx="${gaze % 2 ? 0 : 5}" fill="${paper}"/>`,
      ) +
      pupil(left, 113) +
      pupil(right, 113);
  if (style === 4)
    svg =
      pair(left, 111, 10, gaze < 2 ? 19 : 14) +
      pair(right, 111, 10, gaze < 2 ? 19 : 14) +
      line(`M ${left - 9} 97 L ${left - 15} 91 M ${right + 9} 97 L ${right + 15} 91`);
  if (style === 5)
    svg =
      pair(left, gaze % 2 ? 117 : 111, gaze % 2 ? 9 : 19, gaze % 2 ? 10 : 20) +
      pair(right, gaze % 2 ? 111 : 117, gaze % 2 ? 19 : 9, gaze % 2 ? 20 : 10);
  if (style === 6)
    svg =
      pair(left, 111, 14, gaze < 2 ? 9 : 13) +
      pair(right, 111, 14, gaze < 2 ? 9 : 13) +
      line(
        `M ${left - 15} ${gaze % 2 ? 103 : 111} L ${left + 15} ${gaze % 2 ? 111 : 103} M ${right - 15} ${gaze % 2 ? 111 : 103} L ${right + 15} ${gaze % 2 ? 103 : 111}`,
      );
  if (style === 7)
    svg =
      pair(left, 113, gaze < 2 ? 8 : 11, gaze < 2 ? 13 : 9) +
      pair(right, 113, gaze < 2 ? 8 : 11, gaze < 2 ? 13 : 9) +
      circle(91, 131, 3, accent) +
      circle(164, 131, 3, accent);
  if (style === 8)
    svg = `<ellipse cx="${left + dx}" cy="${111 + dy}" rx="${gaze < 2 ? 6 : 9}" ry="${gaze < 2 ? 15 : 10}" fill="${ink}"/><ellipse cx="${right + dx}" cy="${111 + dy}" rx="${gaze < 2 ? 6 : 9}" ry="${gaze < 2 ? 15 : 10}" fill="${ink}"/>`;
  if (style === 9)
    svg = line(
      `M ${left - 14} 118 Q ${left} ${gaze < 2 ? 89 : 101} ${left + 14} 118 M ${right - 14} 118 Q ${right} ${gaze % 2 ? 101 : 89} ${right + 14} 118`,
    );
  if (style === 10)
    svg =
      (gaze % 2
        ? pair(left, 111, 13, 17)
        : line(`M ${left - 14} 112 Q ${left} ${gaze < 2 ? 122 : 98} ${left + 14} 112`)) +
      (gaze % 2
        ? line(`M ${right - 14} 112 Q ${right} ${gaze < 2 ? 122 : 98} ${right + 14} 112`)
        : pair(right, 111, 13, 17));
  if (style === 11)
    svg =
      group(
        path(
          `M ${left - 15} 106 L ${left + 15} 106 Q ${left + 13} ${gaze < 2 ? 137 : 126} ${left - 12} 124 Z`,
          ink,
        ) +
          path(
            `M ${right - 15} 106 L ${right + 15} 106 Q ${right + 13} ${gaze % 2 ? 126 : 137} ${right - 12} 124 Z`,
            ink,
          ),
      ) +
      circle(left + dx, 114, 3, paper) +
      circle(right + dx, 114, 3, paper);
  if (style === 12)
    svg =
      group(
        path(
          `M ${left} ${gaze < 2 ? 93 : 100} L ${left + 15} 111 L ${left} 130 L ${left - 15} 111 Z`,
          paper,
        ) +
          path(
            `M ${right} ${gaze % 2 ? 100 : 93} L ${right + 15} 111 L ${right} 130 L ${right - 15} 111 Z`,
            paper,
          ),
      ) +
      pupil(left, 111, 5) +
      pupil(right, 111, 5);
  if (style === 13)
    svg =
      pair(left, 113, gaze < 2 ? 18 : 14, gaze < 2 ? 18 : 14) +
      pair(right, 113, gaze < 2 ? 18 : 14, gaze < 2 ? 18 : 14) +
      line(
        `M ${left + (gaze < 2 ? 18 : 14)} 110 L ${right - (gaze < 2 ? 18 : 14)} 110 M ${left - 18} 109 L ${left - 24} 104 M ${right + 18} 109 L ${right + 24} 104`,
      );
  if (style === 14)
    svg =
      group(
        path(`M ${left - 15} 121 L ${left + 15} 121 L ${left + (gaze % 2 ? 8 : -8)} 98 Z`, paper) +
          path(
            `M ${right - 15} 121 L ${right + 15} 121 L ${right + (gaze % 2 ? -8 : 8)} 98 Z`,
            paper,
          ),
      ) +
      pupil(left, 114, 3) +
      pupil(right, 114, 3);
  if (style === 15)
    svg =
      pair(left, 111, gaze < 2 ? 16 : 12, 17) +
      pair(right, 111, gaze < 2 ? 16 : 12, 17) +
      group(
        path(`M ${left} 101 l 3 6 l 7 1 l -5 5 l 1 7 l -6 -3 l -6 3 l 1 -7 l -5 -5 l 7 -1 Z`, ink) +
          path(
            `M ${right} 101 l 3 6 l 7 1 l -5 5 l 1 7 l -6 -3 l -6 3 l 1 -7 l -5 -5 l 7 -1 Z`,
            ink,
          ),
      );
  return {
    id: `eyes-${i.toString().padStart(2, '0')}`,
    name: `${['Wide awake', 'Sidekick', 'Half asleep', 'Square stare', 'Stargazer', 'Curious', 'Sceptic', 'Shy', 'Inky', 'Laughing', 'Wink', 'Drowsy', 'Diamond gaze', 'Round glasses', 'Triangular', 'Starstruck'][style]} · expression ${gaze + 1}`,
    svg,
  };
});
const mouths = Array.from({ length: 32 }, (_, i) => {
  const type = Math.floor(i / 4),
    k = i % 4,
    x = 127 + (k - 1.5) * 2;
  const svg = [
    line(`M ${x - 16} 141 Q ${x} ${160 + k * 2} ${x + 16} 141`),
    line(`M ${x - 17} ${150 + k} Q ${x} 133 ${x + 17} ${150 + k}`),
    `<ellipse cx="${x}" cy="145" rx="${7 + k * 2}" ry="${9 + k}" fill="${ink}"/>`,
    line(`M ${x - 16} 148 Q ${x + 7} 154 ${x + 16} 138 M ${x + 10} 137 L ${x + 20} 138`),
    group(path(`M ${x - 17} 138 Q ${x} ${168 + k} ${x + 17} 138 Z`, ink)) +
      path(`M ${x - 8} 139 L ${x - 8} 146 L ${x + 3} 146 L ${x + 3} 139`, paper),
    line(`M ${x - 17} 145 Q ${x - 9} ${132 - k} ${x} 145 Q ${x + 9} ${158 + k} ${x + 17} 144`),
    line(`M ${x - 16} 143 L ${x + 16} 143`) +
      group(path(`M ${x - 2} 144 Q ${x + 8} ${166 + k} ${x + 15} 144 Z`, accent)),
    circle(x, 145, 5 + k, ink) +
      line(`M ${x - 19} 143 L ${x - 12} 138 M ${x + 12} 138 L ${x + 19} 143`),
  ][type];
  return {
    id: `mouth-${i.toString().padStart(2, '0')}`,
    name: `${['Grin', 'Frown', 'Gasp', 'Smirk', 'Toothy', 'Wobble', 'Tongue', 'Whistle'][type]} ${k + 1}`,
    svg: `<g transform="translate(${x} 145) scale(${[1, 1.12, 1.25, 1.35][k]} ${[1, 0.95, 1.05, 1.1][k]}) translate(${-x} -145)">${svg}</g>`,
  };
});
const brows = Array.from({ length: 16 }, (_, i) => {
  const k = i % 8,
    asym = i >= 8 ? 5 : 0;
  const y = 88 + (k % 3);
  return {
    id: `brows-${i.toString().padStart(2, '0')}`,
    name: `${i >= 8 ? 'Quizzical' : 'Even'} brow ${k + 1}`,
    svg: `<g stroke="${ink}" stroke-width="${2 + (k % 4)}" stroke-linecap="round" fill="none"><path d="M 93 ${y} Q 104 ${y - 4 - k} 115 ${y + asym}"/><path d="M 139 ${y - asym} Q 150 ${y - 4 + k} 161 ${y}"/></g>`,
  };
});
function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  return (
    '#' +
    [0, 8, 4]
      .map((n) => {
        const k = (n + h / 30) % 12;
        return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}
const hues = [160, 195, 235, 265, 290, 320, 345, 20, 38, 55, 78, 110, 140, 180, 210, 250];
const palettes = Array.from({ length: 32 }, (_, i) => {
  const h = hues[i % 16],
    deep = i >= 16;
  return {
    id: `palette-${i.toString().padStart(2, '0')}`,
    name: `${deep ? 'Dusky' : 'Soft'} ${['mint', 'ice', 'periwinkle', 'lilac', 'orchid', 'rose', 'coral', 'peach', 'apricot', 'butter', 'pear', 'fern', 'jade', 'lagoon', 'sky', 'iris'][i % 16]}`,
    body: hsl(h, deep ? 40 : 60, deep ? 72 : 85),
    // Broad markings need a lightness difference that survives grayscale at 32px.
    shade: hsl(h, 35, deep ? 43 : 58),
    ink: '#242b29',
    paper: '#fffdf7',
    accent: hsl((h + 145) % 360, 65, 52),
  };
});
const markings = Array.from({ length: 64 }, (_, i) => {
  const type = Math.floor(i / 4),
    k = i % 4,
    shade = '{{shade}}';
  // All designs occupy the lower belly, clear of eyes, mouth and label seam.
  // Their broad light/dark structure matters more than positional microvariants.
  const shapes = [
    circle(113, 171, 8, shade) + circle(137, 176, 10, shade),
    path('M 102 164 H 151 V 171 H 102 Z M 102 177 H 151 V 184 H 102 Z', shade),
    path('M 105 162 Q 126 156 148 164 L 144 185 L 109 183 Z', shade) +
      path('M 115 166 L 114 178 M 135 167 L 136 179', 'none', `stroke="${paper}" stroke-width="3"`),
    path(
      'M 126 158 L 133 168 L 147 168 L 137 176 L 140 186 L 126 180 L 112 186 L 116 175 L 106 168 L 119 167 Z',
      shade,
    ),
    path('M 102 166 L 109 157 L 153 179 L 146 187 Z', shade),
    path(
      'M 103 166 Q 113 157 124 166 T 147 166 M 103 180 Q 113 171 124 180 T 147 180',
      'none',
      `stroke="${shade}" stroke-width="6" stroke-linecap="round"`,
    ),
    path(
      'M 111 160 L 123 171 L 111 183 L 100 171 Z M 138 162 L 151 174 L 138 186 L 126 174 Z',
      shade,
    ),
    path('M 123 157 H 142 L 131 169 H 148 L 115 187 L 123 175 H 107 Z', shade),
    path('M 104 160 Q 126 169 149 160 L 144 179 Q 126 191 109 179 Z', shade),
    path('M 104 161 H 124 V 172 H 104 Z M 124 172 H 145 V 183 H 124 Z', shade),
    path('M 139 159 A 17 14 0 1 0 139 184 Q 119 180 139 159 Z', shade),
    path(
      'M 103 161 L 125 171 L 147 161 V 169 L 125 180 L 103 169 Z M 110 177 L 125 184 L 140 177 V 183 L 125 190 L 110 183 Z',
      shade,
    ),
    circle(126, 172, 14, shade) + circle(126, 172, 5, paper),
    path('M 105 159 H 126 V 185 H 105 Z M 131 159 H 148 V 185 H 131 Z', shade),
    path('M 108 164 L 117 160 L 126 167 L 136 160 L 146 164 L 142 185 L 112 185 Z', shade),
    circle(109, 171, 7, shade) + circle(126, 171, 7, shade) + circle(143, 171, 7, shade),
  ][type];
  return {
    id: `marking-${i.toString().padStart(2, '0')}`,
    name: `${['Freckles', 'Stripes', 'Stitched patch', 'Star', 'Sash', 'Waves', 'Diamonds', 'Lightning', 'Bib', 'Checker', 'Crescent', 'Chevrons', 'Ring', 'Split patch', 'Crown patch', 'Dot band'][type]} ${k + 1}`,
    svg: `<g transform="translate(${[-2, 2, -1, 1][k]} ${[0, 0, 3, 3][k]})">${shapes}</g>`,
  };
});
const heads = Array.from({ length: 32 }, (_, i) => {
  const shapes = [
    `<ellipse cx="128" cy="39" rx="32" ry="9" fill="none" stroke="${ink}" stroke-width="5"/>`,
    group(path('M 92 68 L 98 40 L 117 58 L 131 31 L 143 58 L 165 41 L 163 68 Z', accent)),
    group(path('M 97 63 L 124 18 L 151 63 Z', accent)) + line('M 84 65 Q 125 76 170 65'),
    group(path('M 96 62 Q 96 29 128 30 Q 160 29 161 62 Z', accent)) + line('M 85 65 L 174 65'),
    line('M 104 67 Q 93 41 83 41 M 150 66 Q 166 40 174 42') +
      circle(82, 40, 6, accent) +
      circle(174, 40, 6, accent),
    group(
      path('M 109 63 Q 89 37 110 35 Q 125 37 128 53 Q 130 31 147 35 Q 165 45 146 63 Z', accent),
    ),
    line('M 110 65 Q 88 35 101 28 Q 112 35 111 47 M 146 65 Q 167 33 154 25 Q 145 34 146 46'),
    group(path('M 107 65 Q 112 27 133 42 Q 147 23 150 66 Z', '{{body}}')),
    line('M 127 64 L 127 34') + circle(127, 29, 7, accent),
    group(path('M 103 65 L 101 30 L 149 30 L 151 65 Z', accent)) +
      line('M 89 66 L 166 66 M 103 48 L 150 48'),
    group(path('M 89 62 Q 105 19 135 39 Q 159 42 161 65 Z', accent)) + circle(98, 36, 7, accent),
    group(path('M 97 66 Q 107 37 132 39 Q 154 40 162 66 Z', accent)) +
      line('M 105 55 Q 131 32 155 55 M 124 40 L 124 59'),
    group(
      path(
        'M 126 65 Q 103 69 90 39 L 108 46 L 101 28 Q 122 32 128 52 Q 134 32 155 28 L 148 46 L 166 39 Q 153 69 130 65 Z',
        paper,
      ),
    ),
    line('M 116 64 Q 126 51 114 39 Q 104 29 116 24 M 132 62 Q 147 52 137 39'),
    group(path('M 107 63 Q 100 32 126 39 Q 134 17 148 31 Q 162 44 148 62 Z', accent)),
    group(path('M 95 66 L 95 45 L 109 53 L 122 34 L 138 53 L 155 43 L 159 66 Z', accent)),
    group(path('M 91 69 L 94 28 L 118 49 L 139 49 L 162 28 L 166 69 Z', '{{body}}')) +
      path('M 101 45 L 109 55 M 151 45 L 146 55', 'none', `stroke="${accent}" stroke-width="6"`),
    group(
      path(
        'M 106 68 Q 82 17 102 20 Q 114 24 118 65 M 136 65 Q 142 17 158 20 Q 174 25 148 69',
        paper,
      ),
    ),
    line('M 128 66 L 128 39') +
      group(
        path(
          'M 128 48 Q 92 51 95 27 Q 121 22 128 48 M 128 43 Q 133 18 158 24 Q 162 43 128 43',
          accent,
        ),
      ),
    group(path('M 91 62 L 98 38 L 158 38 L 166 62 Z', paper)) +
      path('M 91 62 H 166 V 71 H 91 Z', accent) +
      line('M 120 48 L 137 48'),
    line('M 128 65 L 128 38') +
      group(path('M 128 38 Q 88 18 81 35 Q 88 48 128 38 Q 165 17 175 33 Q 173 48 128 38', accent)) +
      circle(128, 38, 6, paper),
    path(
      'M 85 72 V 54 Q 85 18 128 18 Q 171 18 171 54 V 72',
      'none',
      `stroke="${ink}" stroke-width="8"`,
    ) +
      group(
        '<rect x="81" y="53" width="15" height="25" rx="5" fill="{{accent}}"/><rect x="160" y="53" width="15" height="25" rx="5" fill="{{accent}}"/>',
      ),
    group(path('M 106 68 L 109 39 L 121 49 L 127 19 L 139 46 L 151 31 L 153 68 Z', accent)),
    group(path('M 143 22 A 30 25 0 1 0 143 67 Q 111 56 143 22 Z', paper)),
    group(
      path(
        'M 105 64 L 89 50 L 107 46 L 106 25 L 122 36 L 133 17 L 141 36 L 161 27 L 157 46 L 175 52 L 151 65 Z',
        accent,
      ),
    ) + circle(131, 48, 14, paper),
    group(path('M 107 66 L 99 43 L 122 21 L 149 32 L 157 65 Z', accent)) +
      line('M 122 21 L 120 47 L 107 66 M 120 47 L 149 32 M 120 47 L 157 65'),
    group(path('M 114 67 L 114 41 L 141 41 L 141 67 Z', paper)) +
      group(path('M 128 38 Q 108 27 130 16 Q 149 29 128 38 Z', accent)),
    [101, 128, 155]
      .map((x) =>
        group(
          path(
            `M ${x} 61 C ${x - 20} 43 ${x - 5} 32 ${x} 43 C ${x + 9} 29 ${x + 23} 47 ${x} 61 Z`,
            accent,
          ),
        ),
      )
      .join('') + line('M 94 66 Q 128 57 162 66'),
    group(path('M 92 65 Q 101 41 129 46 L 159 63 Z', accent)) +
      group(path('M 129 47 Q 125 18 156 20 Q 171 37 129 47 Z', paper)) +
      line('M 132 45 L 153 25'),
    circle(128, 45, 19, accent) +
      `<ellipse cx="128" cy="45" rx="42" ry="11" transform="rotate(-18 128 45)" fill="none" stroke="${ink}" stroke-width="4"/>`,
    group(
      path(
        'M 125 57 Q 96 76 91 47 Q 103 31 125 48 Q 149 28 165 45 Q 164 71 135 58 L 149 76 L 129 68 L 111 78 Z',
        accent,
      ),
    ),
    group(path('M 157 28 Q 140 59 107 67 L 127 44 L 105 44 L 150 22 Z', accent)) +
      circle(153, 28, 10, paper),
  ][i];
  return {
    id: `head-${i.toString().padStart(2, '0')}`,
    name: [
      'Halo',
      'Crown',
      'Wizard',
      'Bowler',
      'Fireflies',
      'Bow',
      'Horns',
      'Tuft',
      'Antenna',
      'Top hat',
      'Beanie',
      'Beret',
      'Wings',
      'Wisp',
      'Cloud',
      'Paper crown',
      'Cat ears',
      'Rabbit ears',
      'Sprout',
      'Sailor',
      'Propeller',
      'Headphones',
      'Mohawk',
      'Crescent',
      'Sunburst',
      'Crystal',
      'Candle',
      'Flower crown',
      'Feather cap',
      'Orbit',
      'Ribbon knot',
      'Comet',
    ][i],
    svg: shapes,
  };
});
const items = Array.from({ length: 64 }, (_, i) => {
  const type = Math.floor(i / 2),
    k = i % 2;
  const shapes = [
    path('M 0 -14 L 5 -5 L 15 -4 L 7 3 L 9 14 L 0 8 L -10 14 L -8 3 L -16 -4 L -5 -5 Z', accent),
    path('M 9 -14 A 16 16 0 1 0 9 14 A 13 13 0 0 1 9 -14 Z', accent),
    path('M 0 -17 L 13 -17 L 5 -3 L 15 -3 L -6 18 L -2 2 L -13 2 Z', accent),
    path('M -12 13 Q -18 -13 13 -16 Q 21 8 -12 13 Z', accent) + line('M -11 11 L 9 -10'),
    circle(-5, -7, 8, paper) + line('M 2 -1 L 15 14 M 8 6 L 3 11 M 12 10 L 8 15'),
    path('M -4 0 L 4 0 L 6 17 L -6 17 Z', paper) +
      path('M -17 0 Q -14 -22 0 -17 Q 16 -20 18 0 Z', accent) +
      circle(-6, -8, 3, paper) +
      circle(7, -10, 3, paper),
    [0, 60, 120, 180, 240, 300]
      .map(
        (a) => `<ellipse cx="0" cy="-10" rx="6" ry="9" fill="${accent}" transform="rotate(${a})"/>`,
      )
      .join('') + circle(0, 0, 6, paper),
    path('M -11 -11 L 11 -11 L 14 15 L -14 15 Z', accent) +
      line('M -6 -12 Q 0 -25 6 -12 M 0 -4 L 0 8'),
    path('M -10 17 Q -15 -9 10 -18 Q 22 -1 -10 17 Z', paper) +
      line('M -10 17 L 8 -10 M -4 5 L 9 2'),
    path('M -14 -6 L 9 -6 L 7 11 Q 0 19 -10 11 Z', paper) +
      path('M 10 -3 Q 26 -5 18 7 L 8 7', accent) +
      line('M -13 17 L 13 17 M -5 -12 Q -10 -18 -4 -22'),
    circle(0, 0, 11, accent) +
      `<ellipse rx="21" ry="6" fill="none" stroke="${ink}" transform="rotate(-25)"/>`,
    path('M -13 -10 Q 0 -22 12 -9 L -12 10 Q 0 24 14 10 Z', accent) + circle(0, 0, 4, paper),
    path('M -16 9 Q -17 -14 0 -17 Q 17 -14 17 9 L 0 17 Z', accent) +
      line('M 0 15 L 0 -10 M -2 15 L -10 -6 M 2 15 L 10 -6'),
    path('M 0 15 C -30 -3 -10 -22 0 -9 C 14 -24 31 -1 0 15 Z', accent),
    circle(0, 0, 17, paper) + path('M -6 9 L -3 -5 L 8 -12 L 3 4 Z', accent),
    path('M -11 -2 Q -14 15 0 18 Q 14 15 11 -2 Z', accent) +
      path('M -15 -1 Q -10 -17 0 -14 Q 11 -16 15 -1 Z', paper) +
      line('M 0 -13 L 4 -21'),
    path(
      'M -22 -5 Q -18 -29 0 -28 Q 19 -28 23 -5 Q 13 -13 7 -5 Q 0 -13 -7 -5 Q -15 -13 -22 -5 Z',
      accent,
    ) + line('M 0 -5 L 0 17 Q 0 27 -9 22'),
    `<ellipse cx="0" cy="-10" rx="17" ry="21" fill="${accent}"/>` +
      path('M -4 11 L 4 11 L 0 17 Z', paper) +
      line('M 0 16 Q -8 23 0 30'),
    path(
      'M 0 -15 Q -9 -22 -23 -17 L -23 15 Q -9 10 0 17 Q 10 10 23 15 L 23 -17 Q 9 -22 0 -15 Z',
      paper,
    ) + line('M 0 -15 L 0 17 M -16 -9 L -7 -7 M 7 -7 L 16 -9 M -16 0 L -7 2 M 7 2 L 16 0'),
    line(
      'M 0 -11 L 0 21 M -17 10 Q 0 35 17 10 M -17 10 L -17 19 M 17 10 L 17 19 M -10 -3 L 10 -3',
    ) + circle(0, -18, 6, paper),
    path('M -4 -18 L 17 -24 L 17 10 L 10 10 L 10 -13 L 3 -11 L 3 16 L -4 16 Z', accent) +
      `<ellipse cx="-10" cy="17" rx="10" ry="7" fill="${ink}"/><ellipse cx="10" cy="11" rx="10" ry="7" fill="${ink}"/>`,
    path('M -6 4 L 12 -23 L 20 -17 L 1 10 Z', paper) +
      path('M -6 4 Q -23 0 -19 23 Q -1 25 1 10 Z', accent),
    circle(0, -8, 18, accent) + circle(0, -8, 10, paper) + line('M 0 10 L 0 29'),
    path('M -23 -13 L -10 -13 L -5 -20 L 8 -20 L 13 -13 L 23 -13 L 23 17 L -23 17 Z', accent) +
      circle(1, 2, 11, paper) +
      circle(1, 2, 5, ink),
    path('M -23 -15 L 23 -15 L 23 16 L -23 16 Z', paper) +
      line('M -23 -15 L 0 3 L 23 -15 M -23 16 L -8 1 M 23 16 L 8 1'),
    path(
      'M -16 -22 L 16 -22 Q 14 -6 4 0 Q 14 7 16 22 L -16 22 Q -14 7 -4 0 Q -14 -6 -16 -22 Z',
      paper,
    ) +
      path('M -10 -14 L 10 -14 L 0 -3 Z M -10 18 L 0 7 L 10 18 Z', accent) +
      line('M -20 -23 L 20 -23 M -20 23 L 20 23'),
    path('M -15 -7 Q -20 21 2 20 Q 23 19 16 -7 Z', accent) +
      path('M -16 -5 L -29 -17 L -20 -19 L -7 -8 Z', paper) +
      path('M 17 -3 Q 36 -8 26 11 L 17 12', paper) +
      line('M -18 -9 L 19 -9 M -7 -16 Q 0 -24 7 -16'),
    path('M 0 -25 L 21 -16 L 17 10 Q 12 23 0 28 Q -12 23 -17 10 L -21 -16 Z', paper) +
      path('M 0 -18 L 13 -12 L 10 8 Q 6 17 0 20 Z', accent),
    path('M -19 11 Q -13 3 -14 -6 Q -14 -23 0 -23 Q 14 -23 14 -6 Q 13 3 19 11 Z', accent) +
      line('M -20 12 L 20 12') +
      circle(0, 19, 5, paper),
    line('M -12 25 L 9 -5') +
      path(
        'M 11 -25 L 16 -15 L 27 -13 L 19 -5 L 21 7 L 10 1 L 0 7 L 2 -5 L -6 -13 L 5 -15 Z',
        accent,
      ),
    line('M -13 -24 L -13 28') + path('M -13 -22 L 22 -17 L 10 -6 L 23 5 L -13 0 Z', accent),
    path('M 0 -25 L 20 -5 L 0 17 L -20 -5 Z', accent) +
      line('M 0 -25 L 0 17 M -20 -5 L 20 -5 M 0 17 Q 13 19 5 28'),
  ][type];
  return {
    id: `item-${i.toString().padStart(2, '0')}`,
    name: `${['Star', 'Moon', 'Bolt', 'Leaf', 'Key', 'Mushroom', 'Flower', 'Lantern', 'Feather', 'Teacup', 'Saturn', 'Ribbon', 'Shell', 'Heart', 'Compass', 'Acorn', 'Umbrella', 'Balloon', 'Book', 'Anchor', 'Music note', 'Paintbrush', 'Lollipop', 'Camera', 'Envelope', 'Hourglass', 'Teapot', 'Shield', 'Bell', 'Star wand', 'Flag', 'Kite'][type]} ${k + 1}`,
    svg: `<g transform="translate(${k ? 183 : 185} ${k ? 176 : 179}) rotate(${k ? 8 : -8}) scale(${k ? 1.55 : 1.4})">${group(shapes)}</g>`,
  };
});
const badges = Array.from({ length: 16 }, (_, i) => {
  const k = i % 8,
    shape = Math.floor(i / 8),
    r = 9 + k;
  return {
    id: `badge-${i.toString().padStart(2, '0')}`,
    name: `${shape ? 'Pennant' : 'Patch'} ${k + 1}`,
    svg: shape
      ? path(`M -${r} -10 L ${r} -10 L ${r - 2} 6 L 0 ${13 + k} L -${r - 2} 6 Z`, accent)
      : `<rect x="-${r}" y="-${r}" width="${2 * r}" height="${2 * r}" rx="${k}" fill="${accent}"/>`,
  };
});
const accents = Array.from({ length: 16 }, (_, i) => ({
  id: `accent-${i.toString().padStart(2, '0')}`,
  name: `Accent ${i + 1}`,
  color: hsl(hues[i], 75, 60),
}));
const catalogue = {
  scheme: 'spirits-v0',
  license: 'CC0-1.0',
  viewBox: '0 0 256 256',
  groups: {
    body: bodies,
    hem: hems,
    eyes,
    mouth: mouths,
    brows,
    palette: palettes,
    marking: markings,
    head: heads,
    item: items,
    badge: badges,
    accent: accents,
  },
};
await mkdir('packages/core/assets', { recursive: true });
await mkdir('packages/core/src', { recursive: true });
await writeFile('packages/core/assets/spirits-v0.json', JSON.stringify(catalogue, null, 2) + '\n');
await writeFile(
  'packages/core/src/artwork.ts',
  '// Generated by scripts/artwork.mjs. Artwork: CC0-1.0.\nexport const artwork = ' +
    JSON.stringify(catalogue) +
    ' as const;\n',
);
console.log(
  'Wrote original v0 artwork catalogue: ' +
    Object.values(catalogue.groups).reduce((n, a) => n + a.length, 0) +
    ' entries.',
);
