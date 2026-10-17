import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import './styles.css';
import { SpiritAddressError } from '@spirits/core';
import { createSpiritQr } from '@spirits/qr';
import { fixtureAddress } from './shared/fixtures.js';
import {
  $,
  addressRecovery,
  describedSpirit,
  download,
  loadDownloads,
  svgToPng,
  verifyQr,
} from './shared/ui.js';
const sample = fixtureAddress('hello-spirit');
$('brand-ghost').innerHTML = describedSpirit(fixtureAddress('brand'), 64).svg;
$('preview').innerHTML = describedSpirit(sample, 512).svg;
$('mobile-ghost').innerHTML = describedSpirit(sample, 128).svg;
$('parade').innerHTML = Array.from(
  { length: 8 },
  (_, i) => describedSpirit(fixtureAddress(`parade-${i}`), 160).svg,
).join('');
void loadDownloads('./downloads/');
const input = $<HTMLTextAreaElement>('address'),
  form = $<HTMLFormElement>('generator-form');
const exportKinds = ['svg', 'png'] as const;
let result: { spirit: string; qr: string; address: string; filename: string } | undefined;
let mode: 'spirit' | 'qr' = 'spirit',
  generation = 0;

const exportSerial = { svg: 0, png: 0 };
function paint() {
  if (!result) return;
  $('preview').innerHTML = result[mode];
  $('preview').classList.toggle('qr', mode === 'qr');
  $('preview').setAttribute(
    'aria-label',
    mode === 'qr'
      ? 'Payment QR for the current validated address'
      : 'SPirit for the current validated address',
  );
  $('mode-spirit').setAttribute('aria-pressed', String(mode === 'spirit'));
  $('mode-qr').setAttribute('aria-pressed', String(mode === 'qr'));
}
function reset() {
  generation++;
  result = undefined;
  for (const kind of exportKinds) {
    exportSerial[kind]++;
    const button = $<HTMLButtonElement>(`download-${kind}`);
    button.disabled = true;
    button.removeAttribute('aria-busy');
  }
  $<HTMLButtonElement>('mode-qr').disabled = true;
  $('output-status').textContent = 'Generate a SPirit for this address to enable downloads.';
  $('address-error').textContent = '';
  input.removeAttribute('aria-invalid');
  $('create').removeAttribute('aria-busy');
  $<HTMLButtonElement>('create').disabled = false;
  $('output-panel').setAttribute('aria-busy', 'false');
  $('preview').replaceChildren();
  const waiting = document.createElement('p');
  waiting.className = 'empty-preview';
  waiting.textContent = 'Your SPirit will appear here.';
  $('preview').append(waiting);
  $('preview').classList.remove('qr');
  $('preview').setAttribute('aria-label', 'No SPirit generated for the current input');
  mode = 'spirit';
  $('mode-spirit').setAttribute('aria-pressed', 'true');
  $('mode-qr').setAttribute('aria-pressed', 'false');
  $('preview-title').textContent = 'Yours is waiting.';
  $('preview-detail').textContent = 'Generate again after changing the address.';
  $('network-tag').textContent = 'Awaiting address';
  $('result-link').hidden = true;
  $('form-status').textContent = '';
}
input.addEventListener('input', () => {
  reset();
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  reset();
  const token = generation,
    isExample = input.value.trim().toLowerCase() === sample;
  $('output-panel').setAttribute('aria-busy', 'true');
  $<HTMLButtonElement>('create').disabled = true;
  $('create').setAttribute('aria-busy', 'true');
  $('form-status').textContent = 'Checking your SPirit and payment QR…';
  try {
    const spirit = describedSpirit(input.value, 1024),
      qr = createSpiritQr(input.value);
    $('output-status').textContent = 'Checking the finished QR…';
    const verified = await verifyQr(qr.svg, qr.address);
    if (token !== generation) return;
    if (!verified) throw new Error('QR decode failed');
    input.value = qr.address;
    result = {
      spirit: spirit.svg,
      qr: qr.svg,
      address: qr.address,
      filename: `spirit-${spirit.recipe.identity.slice(0, 8)}-${spirit.recipe.variationId.slice(0, 8)}`,
    };
    for (const kind of exportKinds) $<HTMLButtonElement>(`download-${kind}`).disabled = false;
    $<HTMLButtonElement>('mode-qr').disabled = false;
    $('network-tag').textContent =
      spirit.recipe.network === 'mainnet' ? 'Bitcoin mainnet' : 'Test network';
    $('preview-title').textContent = 'Meet your SPirit.';
    $('preview-detail').textContent = isExample
      ? 'Public example keys. Explore the artwork; never receive funds to this address.'
      : spirit.recipe.network === 'mainnet'
        ? 'A character made from your Silent Payment address.'
        : 'Your test-network address. The tsp prefix does not identify a particular test chain.';
    $('output-status').textContent = 'Finished QR decoded successfully in this browser.';
    $('form-status').textContent = 'Your SPirit and payment QR are ready below.';
    $('result-link').hidden = false;
    paint();
  } catch (error) {
    if (token !== generation) return;
    $('address-error').textContent = addressRecovery(error, input.value);
    if (error instanceof SpiritAddressError) input.setAttribute('aria-invalid', 'true');
    $('output-status').textContent = 'No exports are ready. Check the message beside the address.';
    $('form-status').textContent = '';
  } finally {
    if (token === generation) {
      $('output-panel').setAttribute('aria-busy', 'false');
      $<HTMLButtonElement>('create').disabled = false;
      $('create').removeAttribute('aria-busy');
    }
  }
});
$('example').addEventListener('click', () => {
  input.value = sample;
  form.requestSubmit();
});
$('result-link').addEventListener('click', (event) => {
  event.preventDefault();
  $('output-panel').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
});
for (const next of ['spirit', 'qr'] as const)
  $(`mode-${next}`).addEventListener('click', () => {
    mode = next;
    paint();
  });
for (const kind of exportKinds)
  $(`download-${kind}`).addEventListener('click', async () => {
    if (!result) return;
    const current = result,
      currentMode = mode,
      token = generation,
      operation = ++exportSerial[kind];
    const button = $<HTMLButtonElement>(`download-${kind}`);
    const owns = () =>
      generation === token && result === current && exportSerial[kind] === operation;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const svg = current[currentMode],
        blob = kind === 'svg' ? new Blob([svg], { type: 'image/svg+xml' }) : await svgToPng(svg);
      if (!owns()) return;
      download(blob, `${current.filename}${currentMode === 'qr' ? '-qr' : ''}.${kind}`);
      $('output-status').textContent =
        `${currentMode === 'qr' ? 'QR' : 'SPirit'} ${kind.toUpperCase()} downloaded.`;
    } catch {
      if (owns()) $('output-status').textContent = 'The download failed. Please try again.';
    } finally {
      if (owns()) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  });
