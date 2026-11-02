// Slices public/assets/iso-spritesheet.jpg (1376x768, 4x2 grid) into 8 transparent RGBA PNG sprites
// Uses macOS `sips` to convert JPEG -> uncompressed BMP, then flood-fills background from cell edges & encodes PNG via Node built-in zlib.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const SPRITES_DIR = path.join(ASSETS_DIR, 'sprites');
const SRC_JPG = path.join(ASSETS_DIR, 'iso-spritesheet.jpg');
const TMP_BMP = path.join(SPRITES_DIR, '_tmp_sheet.bmp');

fs.mkdirSync(SPRITES_DIR, { recursive: true });
execSync(`sips -s format bmp "${SRC_JPG}" --out "${TMP_BMP}"`, { stdio: 'ignore' });

const bmp = fs.readFileSync(TMP_BMP);
const dataOffset = bmp.readUInt32LE(10);
const width = bmp.readInt32LE(18);
const rawHeight = bmp.readInt32LE(22);
const height = Math.abs(rawHeight);
const topDown = rawHeight < 0;
const bpp = bmp.readUInt16LE(28);
const bytesPerPixel = bpp / 8;
const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;

function getPixel(x, y) {
  const row = topDown ? y : (height - 1 - y);
  const idx = dataOffset + row * rowStride + x * bytesPerPixel;
  const b = bmp[idx];
  const g = bmp[idx + 1];
  const r = bmp[idx + 2];
  return [r, g, b];
}

// Minimal CRC32 for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawScanlines = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    rawScanlines[y * (w * 4 + 1)] = 0; // filter type 0
    rgba.copy(rawScanlines, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const cells = [
  { name: 'farmer.png', col: 0, row: 0 },
  { name: 'engineer.png', col: 1, row: 0 },
  { name: 'manager.png', col: 2, row: 0 },
  { name: 'archon.png', col: 3, row: 0 },
  { name: 'castle.png', col: 0, row: 1 },
  { name: 'workstation.png', col: 1, row: 1 },
  { name: 'bridge.png', col: 2, row: 1, extraW: 28 },
  { name: 'monolith.png', col: 3, row: 1, trimLeft: 32 }
];

const cellW = Math.floor(width / 4);
const cellH = Math.floor(height / 2);

cells.forEach((cell) => {
  const x0 = cell.col * cellW;
  const y0 = cell.row * cellH;
  const rgba = Buffer.alloc(cellW * cellH * 4);

  // Sample corner background color
  const [bgR, bgG, bgB] = getPixel(x0 + 8, y0 + 8);

  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const [r, g, b] = getPixel(x0 + x, y0 + y);
      const off = (y * cellW + x) * 4;
      rgba[off] = r;
      rgba[off + 1] = g;
      rgba[off + 2] = b;
      rgba[off + 3] = 255;
    }
  }

  // BFS Flood-fill from all 4 border edges to remove connected background
  const visited = new Uint8Array(cellW * cellH);
  const queue = new Int32Array(cellW * cellH);
  let qHead = 0;
  let qTail = 0;

  function colorDist(x, y) {
    const off = (y * cellW + x) * 4;
    const dr = rgba[off] - bgR;
    const dg = rgba[off + 1] - bgG;
    const db = rgba[off + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function pushIfBg(x, y) {
    if (x < 0 || x >= cellW || y < 0 || y >= cellH) return;
    const idx = y * cellW + x;
    if (visited[idx]) return;
    const d = colorDist(x, y);
    if (d < 34) {
      visited[idx] = 1;
      queue[qTail++] = idx;
    }
  }

  for (let x = 0; x < cellW; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, cellH - 1);
  }
  for (let y = 0; y < cellH; y++) {
    pushIfBg(0, y);
    pushIfBg(cellW - 1, y);
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % cellW;
    const cy = (curr / cellW) | 0;
    const off = curr * 4;
    rgba[off + 3] = 0; // Transparent!

    pushIfBg(cx - 1, cy);
    pushIfBg(cx + 1, cy);
    pushIfBg(cx, cy - 1);
    pushIfBg(cx, cy + 1);
  }

  // Soft feathering on 1px boundary next to transparent pixels
  if (cell.trimLeft) {
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cell.trimLeft; x++) {
        rgba[(y * cellW + x) * 4 + 3] = 0;
        visited[y * cellW + x] = 1;
      }
    }
  }
  for (let y = 1; y < cellH - 1; y++) {
    for (let x = 1; x < cellW - 1; x++) {
      const idx = y * cellW + x;
      if (visited[idx]) continue;
      const nEmpty =
        visited[idx - 1] + visited[idx + 1] + visited[idx - cellW] + visited[idx + cellW];
      if (nEmpty > 0) {
        const d = colorDist(x, y);
        if (d < 48) {
          rgba[idx * 4 + 3] = Math.min(255, Math.round((d / 48) * 220));
        }
      }
    }
  }

  const outPath = path.join(SPRITES_DIR, cell.name);
  fs.writeFileSync(outPath, encodePNG(cellW, cellH, rgba));
});

fs.unlinkSync(TMP_BMP);
console.log('Successfully sliced 8 transparent RGBA PNG sprites into', SPRITES_DIR);
