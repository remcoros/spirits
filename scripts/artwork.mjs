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
const bodies = Array.from({ length: 32 }, (_, i) => {
  // Sixteen substantial contours, with two visibly different proportions each.
  // Keep the central face area inside every contour; hems share (0,100)/(100,100).
  const shape = Math.floor(i / 2),
    k = i % 2,
    spread = k ? 8 : 0;
  const tops = [
    `C ${-4 - spread} 51 9 ${-8 + spread} 50 0 C 91 ${-8 + spread} ${104 + spread} 51 100 100`,
    `L ${k ? 0 : 8} 23 Q ${k ? 0 : 8} 3 28 3 L 72 3 Q ${k ? 100 : 92} 3 ${k ? 100 : 92} 23 L 100 100`,
    `Q ${-6 - spread} 62 18 31 Q 21 ${k ? -5 : 4} 50 3 Q 79 ${k ? -5 : 4} 82 31 Q ${106 + spread} 62 100 100`,
    `Q 20 83 ${k ? -5 : 3} 57 Q -8 40 14 34 Q 18 0 50 2 Q 84 0 88 37 Q 112 47 96 66 Q 87 81 100 100`,
    `L ${k ? 2 : 12} 29 Q 25 -2 50 ${k ? 6 : 0} Q 75 -2 ${k ? 98 : 88} 29 L 100 100`,
    `Q ${k ? -12 : -3} 79 8 64 Q ${k ? -12 : -3} 39 19 31 Q 18 ${k ? -1 : 9} 43 10 Q 60 ${k ? -8 : 1} 77 13 Q ${k ? 108 : 99} 13 94 41 Q ${k ? 119 : 107} 60 99 74 L 100 100`,
    `Q ${k ? 16 : 7} 69 20 29 Q 25 ${k ? -9 : 1} 50 1 Q 75 ${k ? -9 : 1} 80 29 Q ${k ? 84 : 93} 69 100 100`,
    `Q ${-8 - spread} 87 6 58 Q 10 15 50 ${k ? 17 : 9} Q 90 15 94 58 Q ${108 + spread} 87 100 100`,
    `L ${k ? -3 : 5} 40 Q 5 0 37 0 Q 63 -3 79 26 Q 100 48 100 100`,
    `Q 0 48 21 26 Q 37 -3 63 0 Q 95 0 ${k ? 103 : 95} 40 L 100 100`,
    `Q 19 81 10 57 L ${k ? 1 : 8} 35 L 28 12 L 48 4 L 74 12 L ${k ? 99 : 92} 35 L 90 57 Q 81 81 100 100`,
    `Q -6 87 7 74 Q -7 58 10 45 Q 1 24 25 17 Q 43 ${k ? -7 : 3} 62 9 Q 94 4 94 33 Q 111 45 94 62 Q 107 82 100 100`,
    `L ${k ? 1 : 9} 17 L 69 ${k ? 1 : 8} Q 92 8 94 34 L 100 100`,
    `L ${k ? 1 : 9} 43 L 28 14 Q 50 ${k ? -4 : 4} 72 14 L ${k ? 99 : 91} 43 L 100 100`,
    `Q 25 82 14 57 Q ${k ? -1 : 8} 41 14 25 Q 25 0 50 2 Q 75 0 86 25 Q ${k ? 101 : 92} 41 86 57 Q 75 82 100 100`,
    `Q -8 73 8 51 Q 8 16 39 7 Q 60 -3 78 16 Q ${k ? 112 : 101} 30 95 54 Q 81 73 100 100`,
  ];
  return {
    id: `body-${i.toString().padStart(2, '0')}`,
    name: `${['Drifter', 'Lantern', 'Pear', 'Wanderer', 'Hood', 'Cloud', 'Raindrop', 'Bell', 'Westward', 'Eastward', 'Folded', 'Scallop', 'Satchel', 'Diamond', 'Hourglass', 'Bean'][shape]} ${k ? 'broad' : 'slender'}`,
    svg: `M 0 100 ${tops[shape]}`,
  };
});
const hems = Array.from({ length: 16 }, (_, i) => {
  const type = i % 4,
    depth = 8 + Math.floor(i / 4) * 4;
  const d = [
    `Q 88 ${100 + depth} 76 102 Q 64 ${93 - depth / 2} 52 104 Q 38 ${100 + depth} 26 103 Q 12 ${93 - depth / 2} 0 100`,
    `Q 83 ${123 + depth} 65 105 L 47 ${91 + depth} L 30 112 Q 14 ${106 + depth} 0 100`,
    `Q 98 ${112 + depth} 78 112 Q 62 114 64 ${101 - depth / 2} Q 39 ${127 + depth / 2} 22 108 Q 7 ${119 + depth / 2} 0 100`,
    `L 86 ${105 + depth} L 68 98 L 51 ${112 + depth} L 35 101 L 16 ${104 + depth} L 0 100`,
  ][type];
  return {
    id: `hem-${i.toString().padStart(2, '0')}`,
    name: `${['Ripple', 'Ribbon', 'Curl', 'Zigzag'][type]} ${Math.floor(i / 4) + 1}`,
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
    line(`M ${x - 12} 143 Q ${x} ${155 + k * 2} ${x + 12} 143`),
    line(`M ${x - 13} ${147 + k} Q ${x} 136 ${x + 13} 145`),
    `<ellipse cx="${x}" cy="145" rx="${5 + k * 2}" ry="${8 + k}" fill="${ink}"/>`,
    line(`M ${x - 12} 147 L ${x + 12} ${144 + k}`),
    group(path(`M ${x - 14} 140 Q ${x} ${161 + k} ${x + 14} 140 Z`, ink)) +
      path(`M ${x - 6} 141 L ${x - 6} 147 L ${x + 1} 147 L ${x + 1} 141`, paper),
    line(`M ${x - 14} 145 Q ${x - 7} ${137 - k} ${x} 145 Q ${x + 7} ${153 + k} ${x + 14} 144`),
    line(`M ${x - 10} 145 L ${x + 10} 145`) +
      path(`M ${x - 2} 146 Q ${x + 8} ${161 + k} ${x + 12} 146`, accent),
    circle(x, 145, 3 + k, ink) +
      line(`M ${x - 15} 143 L ${x - 10} 140 M ${x + 10} 140 L ${x + 15} 143`),
  ][type];
  return {
    id: `mouth-${i.toString().padStart(2, '0')}`,
    name: `${['Grin', 'Frown', 'Gasp', 'Smirk', 'Toothy', 'Wobble', 'Tongue', 'Whistle'][type]} ${k + 1}`,
    svg: `<g transform="translate(${x} 145) scale(${[0.75, 1, 1.25, 1.45][k]} ${[1, 0.8, 1, 1.2][k]}) translate(${-x} -145)">${svg}</g>`,
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
    shade: hsl(h, 35, deep ? 58 : 72),
    ink: '#242b29',
    paper: '#fffdf7',
    accent: hsl((h + 145) % 360, 65, 52),
  };
});
const markings = Array.from({ length: 64 }, (_, i) => {
  const type = Math.floor(i / 8),
    k = i % 8,
    x = 111 + (k % 4) * 6,
    y = 169 + Math.floor(k / 4) * 6;
  const shapes = [
    circle(x, y, 7, '{{shade}}') + circle(x + 16, y + 10, 4, '{{shade}}'),
    path(
      `M ${x - 9} ${y - 5} l 25 0 l 0 6 l -25 0 Z M ${x - 9} ${y + 7} l 25 0 l 0 5 l -25 0 Z`,
      '{{shade}}',
    ),
    path(`M ${x - 8} ${y} q 12 -18 25 -3 l -3 19 l -23 -2 Z`, '{{shade}}') +
      line(`M ${x - 5} ${y + 2} l 5 -2 m 5 -1 l 5 -1`),
    path(
      `M ${x} ${y - 10} l 4 7 l 8 0 l -6 5 l 2 8 l -8 -5 l -7 5 l 2 -8 l -6 -5 l 8 0 Z`,
      '{{shade}}',
    ),
    path(`M ${x - 8} ${y - 10} l 20 26 l 5 -4 l -20 -26 Z`, '{{shade}}'),
    line(`M ${x - 9} ${y + 5} q 5 -10 10 0 t 10 0 t 10 0`),
    path(
      `M ${x - 7} ${y - 5} l 9 -6 l 8 6 l -8 11 Z M ${x + 8} ${y + 7} l 6 -4 l 5 4 l -5 7 Z`,
      '{{shade}}',
    ),
    path(`M ${x - 4} ${y - 9} l 9 0 l -3 10 l 10 0 l -17 18 l 4 -13 l -9 0 Z`, '{{shade}}'),
  ][type];
  return {
    id: `marking-${i.toString().padStart(2, '0')}`,
    name: `${['Freckles', 'Stripes', 'Patch', 'Star', 'Sash', 'Waves', 'Diamonds', 'Lightning'][type]} ${k + 1}`,
    svg: `<g transform="translate(${x} ${y}) scale(.82) translate(${-x} ${-y})">${shapes}</g>`,
  };
});
const heads = Array.from({ length: 32 }, (_, i) => {
  const type = Math.floor(i / 2),
    k = i % 2,
    shift = k === 0 ? -4 : 4;
  const shapes = [
    `<ellipse cx="128" cy="42" rx="${28 + k * 4}" ry="8" fill="none" stroke="${ink}" stroke-width="5"/>`,
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
    group(path('M 114 67 Q 95 45 107 34 L 128 52 L 145 34 Q 164 47 145 65 Z', accent)),
    line('M 116 64 Q 126 51 114 39 Q 104 29 116 24 M 132 62 Q 147 52 137 39'),
    group(path('M 107 63 Q 100 32 126 39 Q 134 17 148 31 Q 162 44 148 62 Z', accent)),
    group(path('M 95 66 L 95 45 L 109 53 L 122 34 L 138 53 L 155 43 L 159 66 Z', accent)),
  ][type];
  return {
    id: `head-${i.toString().padStart(2, '0')}`,
    name: `${['Halo', 'Crown', 'Wizard', 'Bowler', 'Fireflies', 'Bow', 'Horns', 'Tuft', 'Antenna', 'Top hat', 'Beanie', 'Beret', 'Wings', 'Wisp', 'Cloud', 'Paper crown'][type]} ${k + 1}`,
    svg: `<g transform="translate(${128 + shift} 64) scale(${k ? 1.14 : 0.88} ${k ? 1.02 : 0.9}) translate(-128 -64)">${shapes}</g>`,
  };
});
const items = Array.from({ length: 64 }, (_, i) => {
  const type = Math.floor(i / 4),
    k = i % 4;
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
  ][type];
  return {
    id: `item-${i.toString().padStart(2, '0')}`,
    name: `${['Star', 'Moon', 'Bolt', 'Leaf', 'Key', 'Mushroom', 'Flower', 'Lantern', 'Feather', 'Teacup', 'Saturn', 'Ribbon', 'Shell', 'Heart', 'Compass', 'Acorn'][type]} ${k + 1}`,
    svg: `<g transform="translate(${[184, 190, 183, 180][k]} ${[170, 181, 190, 171][k]}) rotate(${[-28, 8, 30, -8][k]}) scale(${[0.9, 1, 1.05, 1.15][k]})">${group(shapes)}</g>`,
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
