import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reference = JSON.parse(read('design/reference-icons/SOURCE.json'));
const build = JSON.parse(read('web/icons/build.json'));

// Decode the actual RGB/RGBA pixels, independently of the Pillow icon builder.
function rgbaPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let width, height, colorType, channels, srgb = false;
  const compressed = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    assert.equal(data.length, length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, '8-bit image');
      colorType = data[9];
      assert.ok(colorType === 2 || colorType === 6, 'RGB or RGBA source image');
      channels = colorType === 6 ? 4 : 3;
      assert.equal(data[12], 0, 'non-interlaced image');
    }
    if (type === 'sRGB') srgb = true;
    if (type === 'IDAT') compressed.push(data);
    at += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(width && height);
  const packed = inflateSync(Buffer.concat(compressed)), stride = width * channels;
  assert.equal(packed.length, (stride + 1) * height);
  const decoded = Buffer.alloc(stride * height);
  function paeth(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x >= channels ? decoded[at - channels] : 0;
      const up = y ? decoded[at - stride] : 0;
      const diagonal = y && x >= channels ? decoded[at - stride - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, diagonal);
      decoded[at] = (packed[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  const alpha = Buffer.alloc(width * height);
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    decoded.copy(pixels, i * 4, i * channels, i * channels + 3);
    alpha[i] = colorType === 6 ? decoded[i * channels + 3] : 255;
    pixels[i * 4 + 3] = alpha[i];
  }
  return {width, height, pixels, alpha, colorType, srgb};
}

test('native SVG and geometry stay bound to the generated icon assets', () => {
  const svg = read('web/icons/icon.svg');
  assert.equal(hash(svg), build.svg_sha256);
  assert.equal(hash(read(build.geometry_source)), build.geometry_sha256);
  assert.match(svg.toString(), /viewBox="0 0 512 512"/);
  assert.match(svg.toString(), /#3469e6/);
  assert.match(svg.toString(), /#f4f6fa/);
  assert.doesNotMatch(svg.toString(), /<text|<filter|<image/);
  assert.equal(reference.commit, '5573946b10023df3c9b83f0d02a139860afef2bc');
  assert.equal(build.reference_commit, reference.commit);
});

for (const [name, size, alphaHash] of [
  ['apple-touch-icon.png', 180, 'e66d29d635915136427604f35317b9a6457c9caed7a92908e5ded47d0862f1bd'],
  ['icon-192.png', 192, 'e660f49767a5288acadcf9d7aa0e98c9768875c52ec57499a8719170c194cb54'],
  ['icon-512.png', 512, '3b874d3ba46c638fc3094f8e92fb744ca974893873f8885f54e23760f9b6311b']
]) {
  test(`${size}px icon preserves the exact known-good per-size edge and opaque interior`, () => {
    const originalBytes = read(`design/reference-icons/${name}`);
    assert.equal(hash(originalBytes), reference.files[name].sha256);
    const original = rgbaPng(originalBytes);
    const bytes = read(`web/icons/${name}`), image = rgbaPng(bytes);
    assert.equal(image.width, size); assert.equal(image.height, size);
    assert.equal(image.colorType, 6, 'generated installation image preserves an explicit alpha channel');
    assert.equal(image.srgb, true);
    assert.equal(hash(image.alpha), alphaHash);
    assert.deepEqual(image.alpha, original.alpha);
    assert.equal(hash(bytes), build.files.find(x => x.name === name).sha256);
    for (let y = 1; y < size - 1; y++)
      for (let x = 1; x < size - 1; x++) assert.equal(image.alpha[y * size + x], 255);
    const pixel = (x, y) => [...image.pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 3)];
    assert.deepEqual(pixel(Math.round(256 * size / 512), Math.round(120 * size / 512)), [52, 105, 230]);
    assert.notDeepEqual(bytes, originalBytes, 'reference glyph must not replace the algorithm glyph');
  });
}

test('new Apple installation URL carries the same verified 180px image', () => {
  assert.deepEqual(read('web/icons/apple-touch-icon-series1.png'), read('web/icons/apple-touch-icon.png'));
});
