import { SpiritAddressError } from '@remcoros/spirits';
import { createSpiritQr } from '@remcoros/spirits-qr';
import { fixtureAddress } from './shared/fixtures.js';
import { $, addressRecovery, describedSpirit, download, svgToPng, verifyQr } from './shared/ui.js';

const examples = Array.from({ length: 10 }, (_, i) =>
  fixtureAddress(i === 0 ? 'hello-spirit' : `example-${i}`, 1, 'testnet'),
);
let exampleIndex = 1;
$('brand-ghost').innerHTML = describedSpirit(fixtureAddress('brand'), 64).svg;
$('preview').innerHTML = describedSpirit(examples[0], 512).svg;
$('mobile-ghost').innerHTML = describedSpirit(examples[0], 128).svg;
$('parade').innerHTML = Array.from(
  { length: 8 },
  (_, i) => describedSpirit(fixtureAddress(`parade-${i}`), 160).svg,
).join('');

const input = $<HTMLTextAreaElement>('address');
const exportKinds = ['svg', 'png'] as const;
type Result = {
  spirit: string;
  qr?: string;
  qrState: 'checking' | 'ready' | 'error';
  address: string;
  filename: string;
};
let result: Result | undefined;
let mode: 'spirit' | 'qr' = 'spirit',
  generation = 0,
  qrSerial = 0;
let validationError: unknown;
let errorTimer: ReturnType<typeof setTimeout> | undefined;
const exportSerial = { svg: 0, png: 0 };

function updateResultLink() {
  const link = $('result-link');
  link.hidden =
    !result ||
    ($('preview').getBoundingClientRect().top < innerHeight && document.activeElement !== link);
}
new IntersectionObserver(updateResultLink).observe($('preview'));
window.addEventListener('resize', updateResultLink);
$('result-link').addEventListener('blur', updateResultLink);

function updateDownloads() {
  const ready = result && (mode === 'spirit' || result.qrState === 'ready');
  for (const kind of exportKinds) {
    const button = $<HTMLButtonElement>(`download-${kind}`);
    button.disabled = !ready || button.getAttribute('aria-busy') === 'true';
  }
}

function paint() {
  const svg = result?.[mode];
  $('preview').classList.toggle('qr', mode === 'qr');
  $('preview').setAttribute('aria-busy', String(mode === 'qr' && result?.qrState === 'checking'));
  if (svg) {
    $('preview').innerHTML = svg;
    $('preview').setAttribute(
      'aria-label',
      mode === 'qr'
        ? 'Payment QR for the current validated address'
        : 'SPirit for the current validated address',
    );
  } else {
    const waiting = document.createElement('p');
    waiting.className = 'empty-preview';
    waiting.textContent = !result
      ? 'Paste an address to meet your SPirit.'
      : result.qrState === 'error'
        ? 'Payment QR unavailable.'
        : '';
    $('preview').replaceChildren(waiting);
    $('preview').setAttribute('aria-label', 'No current image for this input');
  }
  $('mode-spirit').setAttribute('aria-pressed', String(mode === 'spirit'));
  $('mode-qr').setAttribute('aria-pressed', String(mode === 'qr'));
  $<HTMLButtonElement>('mode-qr').disabled = !result;
  $('mode-qr').setAttribute('aria-busy', String(result?.qrState === 'checking'));
  $('retry-qr').hidden = result?.qrState !== 'error';
  $('output-status').textContent =
    result?.qrState === 'error' ? 'The QR could not be checked.' : '';
  updateDownloads();
  updateResultLink();
}

function invalidate() {
  generation++;
  qrSerial++;
  clearTimeout(errorTimer);
  validationError = undefined;
  result = undefined;
  for (const kind of exportKinds) {
    exportSerial[kind]++;
    $(`download-${kind}`).removeAttribute('aria-busy');
  }
  $('address-error').textContent = '';
  input.removeAttribute('aria-invalid');
  $('preview-title').textContent = 'Your SPirit';
  $('preview-detail').textContent = '';
  paint();
}

function showAddressError() {
  if (!validationError) return;
  $('address-error').textContent = addressRecovery(validationError, input.value);
  if (validationError instanceof SpiritAddressError) input.setAttribute('aria-invalid', 'true');
}

async function checkQr(current: Result) {
  const operation = ++qrSerial;
  const owns = () => result === current && qrSerial === operation;
  current.qrState = 'checking';
  current.qr = undefined;
  paint();
  try {
    const qr = createSpiritQr(current.address);
    const verified = await verifyQr(qr.svg, current.address);
    if (!owns()) return;
    if (!verified) throw new Error('QR decode failed');
    current.qr = qr.svg;
    current.qrState = 'ready';
  } catch {
    if (!owns()) return;
    current.qrState = 'error';
  } finally {
    if (owns()) paint();
  }
}

function generate(showErrors = false) {
  invalidate();
  if (!input.value.trim()) return;
  let spirit: ReturnType<typeof describedSpirit>;
  try {
    spirit = describedSpirit(input.value, 1024);
  } catch (error) {
    validationError = error;
    if (showErrors) showAddressError();
    else if (input.value.trim().length >= 116) errorTimer = setTimeout(showAddressError, 400);
    return;
  }
  result = {
    spirit: spirit.svg,
    qrState: 'checking',
    address: spirit.recipe.address,
    filename: `spirit-${spirit.recipe.identity.slice(0, 8)}-${spirit.recipe.variationId.slice(0, 8)}`,
  };
  $('preview-title').textContent = 'Meet your SPirit.';
  $('preview-detail').textContent = examples.includes(spirit.recipe.address)
    ? 'Example address. Paste your wallet address to receive payments.'
    : '';
  void checkQr(result);
}

function fillFromFragment() {
  const address = location.hash.slice(1);
  if (!/^(?:sp|tsp)1/i.test(address)) return;
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(history.state, '', url);
  input.value = address;
  generate(true);
}

input.addEventListener('input', (event) => {
  generate(event instanceof InputEvent && event.inputType === 'insertFromPaste');
});
input.addEventListener('blur', showAddressError);
$('generator-form').addEventListener('submit', (event) => {
  event.preventDefault();
  showAddressError();
});
$('example').addEventListener('click', () => {
  input.value = examples[exampleIndex];
  exampleIndex = (exampleIndex + 1) % examples.length;
  generate();
});
$('retry-qr').addEventListener('click', () => {
  if (result) void checkQr(result);
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
      operation = ++exportSerial[kind],
      svg = current[currentMode];
    if (!svg) return;
    const button = $<HTMLButtonElement>(`download-${kind}`);
    const owns = () =>
      generation === token && result === current && exportSerial[kind] === operation;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const blob =
        kind === 'svg' ? new Blob([svg], { type: 'image/svg+xml' }) : await svgToPng(svg);
      if (!owns()) return;
      download(blob, `${current.filename}${currentMode === 'qr' ? '-qr' : ''}.${kind}`);
      $('output-status').textContent =
        `${currentMode === 'qr' ? 'QR' : 'SPirit'} ${kind.toUpperCase()} downloaded.`;
    } catch {
      if (owns()) $('output-status').textContent = 'The download failed. Try again.';
    } finally {
      if (owns()) {
        button.removeAttribute('aria-busy');
        updateDownloads();
      }
    }
  });

window.addEventListener('hashchange', fillFromFragment);
fillFromFragment();
