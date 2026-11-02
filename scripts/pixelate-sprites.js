#!/usr/bin/env node
/**
 * Converts the 8 transparent RGBA sprites in public/assets/sprites/
 * into crisp, palette-quantized, black-outlined 64x64 / 96x96 Pixel-Art PNG sprites
 * matching the Tripo3D "Pixel-Art 3D Game" aesthetic.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG decoder/encoder for RGBA8
function decodePNG(buf) {
  let offset = 8;
  let width = 0, height = 0;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const outStart = y * stride;
    for (let x = 0; x < stride; x++) {
      let v = raw[rowStart + x];
      const a = x >= 4 ? rgba[outStart + x - 4] : 0;
      const b = y > 0 ? rgba[outStart - stride + x] : 0;
      const c = (x >= 4 && y > 0) ? rgba[outStart - stride + x - 4] : 0;
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        v = (v + pr) & 0xff;
      }
      rgba[outStart + x] = v;
    }
  }
  return { width, height, rgba };
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Auto-crop bounding box of non-transparent pixels, then downsample to targetSize with palette quantization & 1px dark pixel-art outline
function makePixelArtSprite(src, targetSize = 72) {
  const { width, height, rgba } = src;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a > 40) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX >= maxX || minY >= maxY) {
    return { width: targetSize, height: targetSize, rgba: Buffer.alloc(targetSize * targetSize * 4) };
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const pad = 3; // leave room for 1px outline
  const innerSize = targetSize - pad * 2;
  const scale = Math.min(innerSize / cropW, innerSize / cropH);
  const drawW = Math.max(1, Math.round(cropW * scale));
  const drawH = Math.max(1, Math.round(cropH * scale));
  const offX = Math.floor((targetSize - drawW) / 2);
  const offY = Math.floor((targetSize - drawH) / 2);

  const out = Buffer.alloc(targetSize * targetSize * 4);

  // Sample & quantize colors (posterize to 24 levels per channel for crisp 16-bit pixel art palette)
  for (let dy = 0; dy < drawH; dy++) {
    for (let dx = 0; dx < drawW; dx++) {
      const sx = Math.min(width - 1, minX + Math.floor((dx + 0.5) / scale));
      const sy = Math.min(height - 1, minY + Math.floor((dy + 0.5) / scale));
      const si = (sy * width + sx) * 4;
      const a = rgba[si + 3];
      if (a > 90) {
        const ox = offX + dx;
        const oy = offY + dy;
        const oi = (oy * targetSize + ox) * 4;
        // Quantize RGB to crisp steps & boost saturation slightly
        const r = Math.min(255, Math.round(rgba[si] / 24) * 24);
        const g = Math.min(255, Math.round(rgba[si + 1] / 24) * 24);
        const b = Math.min(255, Math.round(rgba[si + 2] / 24) * 24);
        out[oi] = r;
        out[oi + 1] = g;
        out[oi + 2] = b;
        out[oi + 3] = 255;
      }
    }
  }

  // Add crisp 1px dark pixel-art outline around solid pixels
  const outlined = Buffer.from(out);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 1; y < targetSize - 1; y++) {
    for (let x = 1; x < targetSize - 1; x++) {
      const idx = (y * targetSize + x) * 4;
      if (out[idx + 3] === 0) {
        let touchesSolid = false;
        for (const [dx, dy] of dirs) {
          const nIdx = ((y + dy) * targetSize + (x + dx)) * 4;
          if (out[nIdx + 3] === 255) {
            touchesSolid = true;
            break;
          }
        }
        if (touchesSolid) {
          outlined[idx] = 20;
          outlined[idx + 1] = 24;
          outlined[idx + 2] = 46;
          outlined[idx + 3] = 255;
        }
      }
    }
  }

  return { width: targetSize, height: targetSize, rgba: outlined };
}

const spritesDir = path.join(__dirname, '..', 'public', 'assets', 'sprites');
const targets = [
  { in: 'farmer.png', out: 'pixel-farmer.png', size: 64 },
  { in: 'engineer.png', out: 'pixel-engineer.png', size: 64 },
  { in: 'manager.png', out: 'pixel-manager.png', size: 64 },
  { in: 'archon.png', out: 'pixel-archon.png', size: 64 },
  { in: 'castle.png', out: 'pixel-castle.png', size: 96 },
  { in: 'workstation.png', out: 'pixel-workstation.png', size: 88 },
  { in: 'bridge.png', out: 'pixel-bridge.png', size: 96 },
  { in: 'monolith.png', out: 'pixel-monolith.png', size: 96 }
];

for (const t of targets) {
  const srcBuf = fs.readFileSync(path.join(spritesDir, t.in));
  const decoded = decodePNG(srcBuf);
  const pix = makePixelArtSprite(decoded, t.size);
  const outPath = path.join(spritesDir, t.out);
  fs.writeFileSync(outPath, encodePNG(pix.width, pix.height, pix.rgba));
  console.log(`Generated ${t.out} (${pix.width}x${pix.height} pixel-art sprite)`);
}

// Also generate a pure Pixel-Art 3D Red-Roofed Clubhouse & Court Pavilion sprite (inspired by Tripo3D Pixel-Art Tennis Club)
function createPixelCanvas(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  function setPx(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  }
  function fillRect(x0, y0, rw, rh, [r, g, b]) {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) setPx(x, y, r, g, b, 255);
    }
  }
  // Draw isometric voxel block in pixel space
  function drawIsoBox(cx, cy, hw, hd, vh, topC, leftC, rightC) {
    // Top diamond
    for (let dy = -hd; dy <= hd; dy++) {
      const span = Math.round(hw * (1 - Math.abs(dy) / hd));
      for (let dx = -span; dx <= span; dx++) {
        // Subtle 2x2 pixel checkerboard dither on top
        const dither = ((dx + dy) & 1) === 0 ? 0 : -6;
        setPx(cx + dx, cy + dy, Math.max(0, topC[0] + dither), Math.max(0, topC[1] + dither), Math.max(0, topC[2] + dither));
      }
    }
    // Left & Right vertical walls
    for (let dx = -hw; dx <= 0; dx++) {
      const topY = cy + Math.round((dx + hw) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        setPx(cx + dx, y, leftC[0], leftC[1], leftC[2]);
      }
    }
    for (let dx = 0; dx <= hw; dx++) {
      const topY = cy + Math.round((hw - dx) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        setPx(cx + dx, y, rightC[0], rightC[1], rightC[2]);
      }
    }
  }
  function addOutline() {
    const copy = Buffer.from(rgba);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx + 3] === 0) {
          for (const [dx, dy] of dirs) {
            if (copy[((y + dy) * w + (x + dx)) * 4 + 3] === 255) {
              rgba[idx] = 20; rgba[idx + 1] = 24; rgba[idx + 2] = 46; rgba[idx + 3] = 255;
              break;
            }
          }
        }
      }
    }
  }
  return { w, h, rgba, setPx, fillRect, drawIsoBox, addOutline };
}

// Generate pixel-clubhouse.png (Cozy Red-Roofed Pixel-Art 3D Civic Clubhouse + Lawn Court)
{
  const c = createPixelCanvas(96, 96);
  // Green court lawn base with crisp white boundary lines
  c.drawIsoBox(48, 56, 40, 20, 6, [52, 211, 153], [16, 185, 129], [5, 150, 105]);
  // White pixel court lines on the lawn
  for (let i = -14; i <= 14; i++) {
    c.setPx(56 + i, 56 + Math.round(i * 0.5), 248, 250, 252);
    c.setPx(56 + i, 64 - Math.round(i * 0.5), 248, 250, 252);
  }
  // Cream/warm brick clubhouse walls
  c.drawIsoBox(38, 40, 22, 11, 18, [254, 243, 199], [245, 208, 144], [217, 160, 91]);
  // Stepped Terracotta Red Pitched Roof (Tripo3D Tennis Club style)
  c.drawIsoBox(38, 36, 25, 12, 4, [239, 68, 68], [220, 38, 38], [185, 28, 28]);
  c.drawIsoBox(38, 31, 20, 10, 4, [248, 113, 113], [239, 68, 68], [185, 28, 28]);
  c.drawIsoBox(38, 26, 14, 7, 4, [252, 165, 165], [239, 68, 68], [185, 28, 28]);
  c.drawIsoBox(38, 22, 8, 4, 3, [254, 202, 202], [248, 113, 113], [220, 38, 38]);
  // Golden clock/emblem + cyan windows
  c.fillRect(36, 42, 4, 6, [56, 189, 248]);
  c.fillRect(43, 44, 4, 6, [56, 189, 248]);
  c.fillRect(28, 45, 4, 8, [146, 64, 14]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-clubhouse.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-clubhouse.png (96x96 pixel-art 3D clubhouse)');
}

// Generate pixel-tree.png (Crisp 48x48 stepped 3D pixel-art pine/oak tree)
{
  const c = createPixelCanvas(48, 48);
  c.drawIsoBox(24, 34, 5, 3, 10, [146, 64, 14], [120, 53, 15], [69, 26, 3]);
  c.drawIsoBox(24, 26, 15, 8, 7, [74, 222, 128], [34, 197, 94], [21, 128, 61]);
  c.drawIsoBox(24, 18, 12, 6, 7, [134, 239, 172], [74, 222, 128], [22, 163, 74]);
  c.drawIsoBox(24, 11, 8, 4, 6, [187, 247, 208], [134, 239, 172], [34, 197, 94]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-tree.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-tree.png (48x48 pixel-art 3D tree)');
}

