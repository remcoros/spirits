import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import '../styles.css';
import {
  artwork,
  createSpirit,
  deriveSpirit,
  renderSpirit,
  renderAsset,
  parseAddress,
  varietyBudget,
  escapeXml,
  CHARACTER_GROUPS,
  type AssetGroup,
  type SpiritRecipe,
} from '@spirits/core';
import { createSpiritQr } from '@spirits/qr';
import { fixtureAddress } from '../shared/fixtures.js';
import {
  $,
  addressRecovery,
  describedSpirit,
  download,
  loadDownloads,
  spiritDescription,
  verifyQr,
} from '../shared/ui.js';
void loadDownloads('../downloads/');
const seed = $<HTMLInputElement>('seed'),
  label = $<HTMLInputElement>('label'),
  network = $<HTMLSelectElement>('network'),
  input = $<HTMLTextAreaElement>('inspect-address');
let current: { spirit: string; qr: string; address: string } | undefined,
  serial = 0,
  decodeSerial = 0,
  page = 0;
function invalidate(message: string, clearFamily = false) {
  serial++;
  decodeSerial++;
  current = undefined;
  for (const id of ['save-spirit', 'save-qr', 'check-qr']) {
    $<HTMLButtonElement>(id).disabled = true;
    $(id).removeAttribute('aria-busy');
  }
  for (const id of ['lab-spirit', 'lab-qr']) {
    $(id).replaceChildren();
    $(id).setAttribute('aria-label', 'No preview for the current input');
  }
  $('lab-meta').textContent = '';
  $('recipe').textContent = '';
  $('lab-error').textContent = '';
  input.removeAttribute('aria-invalid');
  label.removeAttribute('aria-invalid');
  $('lab-status').textContent = message;
  if (clearFamily) {
    $('family').replaceChildren();
    $('family-note').textContent = 'Generate the changed fixture to update its label family.';
  }
}
function showAddress(address: string, fixture: boolean) {
  const spirit = describedSpirit(address, 512),
    qr = createSpiritQr(address),
    parsed = parseAddress(address);
  input.value = parsed.address;
  current = { spirit: spirit.svg, qr: qr.svg, address: qr.address };
  $('lab-spirit').innerHTML = spirit.svg;
  $('lab-spirit').setAttribute(
    'aria-label',
    fixture ? 'Current public fixture SPirit' : 'SPirit for the current inspected address',
  );
  $('lab-qr').innerHTML = qr.svg;
  $('lab-qr').setAttribute(
    'aria-label',
    fixture
      ? 'Payment QR for the current public fixture; never receive funds'
      : 'Payment QR for the current inspected address',
  );
  $('recipe').textContent = JSON.stringify(
    {
      ...spirit.recipe,
      scanPublicKey: Array.from(parsed.scanKey, (x) => x.toString(16).padStart(2, '0')).join(''),
      spendPublicKey: Array.from(parsed.spendKey, (x) => x.toString(16).padStart(2, '0')).join(''),
    },
    null,
    2,
  );
  $('lab-meta').innerHTML = [
    parsed.network === 'mainnet' ? 'Bitcoin mainnet' : 'Test network',
    `QR v${qr.version}`,
    `${qr.modules} modules`,
    `${qr.logoModules}-module centre`,
    'ECC H',
    '4-module border',
  ]
    .map((s) => `<span>${s}</span>`)
    .join('');
  $('lab-status').textContent = fixture
    ? 'Public fixture SVGs ready. Never receive funds to these keys. Decode the finished QR to check it.'
    : 'Inspected address SVGs ready. Decode the finished QR to check the artwork overlay.';
  for (const id of ['save-spirit', 'save-qr', 'check-qr'])
    $<HTMLButtonElement>(id).disabled = false;
}
function family() {
  $('family').innerHTML = Array.from(
    { length: 8 },
    (_, i) =>
      `<div class="contact-cell">${describedSpirit(fixtureAddress(seed.value, i + 1, network.value as 'mainnet' | 'testnet')).svg}<span>Label ${i + 1}</span></div>`,
  ).join('');
  $('family-note').textContent =
    `Fixture family “${seed.value}” · all nine character traits stay fixed. Badge and trim vary.`;
}
function generate() {
  invalidate('Generating a public fixture…', true);
  try {
    showAddress(
      fixtureAddress(seed.value, Number(label.value), network.value as 'mainnet' | 'testnet'),
      true,
    );
    family();
  } catch (error) {
    invalidate('No fixture exports are ready.', true);
    $('lab-error').textContent =
      error instanceof RangeError
        ? 'Use a whole label number from 1 through 4294967295.'
        : 'Could not create this fixture. Check the seed, label and network, then try again.';
    label.setAttribute('aria-invalid', 'true');
  }
}
// Pinned entries are public reproducible fixtures only, kept in this tab's memory.
let characters: { n: number; recipe: SpiritRecipe }[] = [];
const pinned = new Map<number, SpiritRecipe>();
const fixedVariation = deriveSpirit(fixtureAddress('comparison-label')).variation;
function reviewSvg(recipe: SpiritRecipe, size = 256) {
  const shown = $<HTMLInputElement>('fixed-label').checked
    ? { ...recipe, variation: fixedVariation }
    : recipe;
  return renderSpirit(shown, { size, title: spiritDescription(recipe) });
}
function paintGrid() {
  $('characters').innerHTML = characters
    .map(
      ({ n, recipe }) =>
        `<div class="contact-cell">${reviewSvg(recipe)}<span>Character ${n + 1}</span><button class="pin-button" type="button" data-pin="${n}" aria-pressed="${pinned.has(n)}" ${!pinned.has(n) && pinned.size === 2 ? 'disabled' : ''}>${pinned.has(n) ? 'Unpin' : 'Pin'} Character ${n + 1}</button></div>`,
    )
    .join('');
}
function paintComparison() {
  $('comparison').innerHTML = Array.from(
    pinned,
    ([n, recipe]) =>
      `<article class="comparison-character"><h4>Character ${n + 1}</h4><div class="comparison-sizes">${[110, 64, 32].map((size) => `<figure>${reviewSvg(recipe, size)}<figcaption>${size}px</figcaption></figure>`).join('')}</div><p class="hint">${escapeXml(spiritDescription(recipe))}</p><button class="secondary" type="button" data-unpin="${n}">Remove Character ${n + 1}</button></article>`,
  ).join('');
  $('comparison-status').textContent =
    pinned.size === 2
      ? 'Two characters pinned. Remove one to choose another. Pinned characters stay when you load another batch.'
      : pinned.size === 1
        ? 'One character pinned. Choose another to compare.'
        : 'Pin a character from the grid to keep it here.';
}
function grid() {
  characters = Array.from({ length: 48 }, (_, i) => {
    const n = page * 48 + i;
    return { n, recipe: deriveSpirit(fixtureAddress(`grid-${n}`)) };
  });
  page++;
  paintGrid();
}
$('characters').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-pin]');
  if (!target) return;
  const n = Number(target.dataset.pin),
    item = characters.find((item) => item.n === n);
  if (pinned.has(n)) pinned.delete(n);
  else if (item && pinned.size < 2) pinned.set(n, item.recipe);
  paintGrid();
  paintComparison();
  $('characters')
    .querySelector<HTMLButtonElement>(`[data-pin="${n}"]`)
    ?.focus({ preventScroll: true });
});
$('comparison').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-unpin]');
  if (!target) return;
  pinned.delete(Number(target.dataset.unpin));
  paintGrid();
  paintComparison();
  $('comparison').querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  if (!pinned.size) $('refresh-grid').focus({ preventScroll: true });
});
$('fixed-label').addEventListener('change', () => {
  paintGrid();
  paintComparison();
});
$('grayscale').addEventListener('change', () => {
  for (const group of document.querySelectorAll('.review-art'))
    group.classList.toggle('grayscale', $<HTMLInputElement>('grayscale').checked);
});
const groups = Object.keys(artwork.groups) as AssetGroup[];
$('asset-group').innerHTML = groups
  .map((g) => `<option value="${g}">${g} · ${artwork.groups[g].length}</option>`)
  .join('');
function catalogue() {
  const g = $<HTMLSelectElement>('asset-group').value as AssetGroup;
  $('assets').innerHTML = artwork.groups[g]
    .map(
      (a) =>
        `<div class="contact-cell">${renderAsset(g, a.id)}<span>${escapeXml(a.name)}</span></div>`,
    )
    .join('');
}
$('generate').addEventListener('click', generate);
$('random').addEventListener('click', () => {
  seed.value = `ghost-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  generate();
});
$('inspect').addEventListener('click', () => {
  invalidate('Inspecting the public address…');
  try {
    showAddress(input.value, false);
  } catch (error) {
    $('lab-error').textContent = addressRecovery(error, input.value);
    input.setAttribute('aria-invalid', 'true');
    $('lab-status').textContent = 'No inspected exports are ready.';
  }
});
input.addEventListener('input', () =>
  invalidate('Inspect the changed address to update previews and exports.'),
);
for (const control of [seed, label, network])
  control.addEventListener(control === network ? 'change' : 'input', () =>
    invalidate('Generate the changed fixture to update previews and exports.', true),
  );
$('refresh-grid').addEventListener('click', grid);
$('asset-group').addEventListener('change', catalogue);
$('preview-size').addEventListener('change', () =>
  document.documentElement.style.setProperty(
    '--preview-size',
    `${$<HTMLSelectElement>('preview-size').value}px`,
  ),
);
for (const mode of ['spirit', 'qr'] as const)
  $(`save-${mode}`).addEventListener('click', () => {
    if (current)
      download(new Blob([current[mode]], { type: 'image/svg+xml' }), `spirits-lab-${mode}.svg`);
  });
$('check-qr').addEventListener('click', async () => {
  if (!current) return;
  const value = current,
    token = serial,
    operation = ++decodeSerial,
    b = $<HTMLButtonElement>('check-qr');
  const owns = () => token === serial && operation === decodeSerial && current === value;
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  $('lab-status').textContent = 'Decoding the final rendered image…';
  try {
    const okay = await verifyQr(value.qr, value.address);
    if (owns())
      $('lab-status').textContent = okay
        ? 'PASS · The final rendered QR decodes to the exact complete address.'
        : 'FAIL · The final QR could not be decoded. Try a larger export and test it in your wallet.';
  } catch {
    if (owns())
      $('lab-status').textContent =
        'The browser could not decode the QR. Try again or use another browser.';
  } finally {
    if (owns()) {
      b.disabled = false;
      b.removeAttribute('aria-busy');
    }
  }
});
$('audit').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('audit');
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  $('audit-result').textContent = 'Sampling 512 character recipes…';
  await new Promise((r) => setTimeout(r, 30));
  try {
    const seen = new Set<string>(),
      used = Object.fromEntries(CHARACTER_GROUPS.map((g) => [g, new Set<string>()]));
    for (let i = 0; i < 512; i++) {
      const { recipe } = createSpirit(fixtureAddress(`audit-${i}`));
      seen.add(JSON.stringify(recipe.character));
      for (const g of CHARACTER_GROUPS) used[g].add(recipe.character[g]);
      if (i % 32 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    $('audit-result').textContent =
      `512 inputs · ${seen.size} distinct character recipes\n` +
      CHARACTER_GROUPS.map(
        (g) => `${g}: ${used[g].size}/${artwork.groups[g].length} variants used`,
      ).join('\n') +
      '\nRecipe coverage does not measure human visual distinctness.';
  } finally {
    b.disabled = false;
    b.removeAttribute('aria-busy');
  }
});
$('budget').textContent = JSON.stringify(varietyBudget(), null, 2);
generate();
grid();
catalogue();
