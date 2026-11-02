#!/usr/bin/env node
/**
 * Generates Ultra-Sharp, High-Resolution (160x160 & 220x220) Isometric 2.5D / Pixel-Art 3D Assets:
 * - Applies 3x3 Unsharp Mask Convolution + Contrast Boost + Crisp 2px Silhouette Outline to the 8 AI-generated sprites
 * - Renders high-detail 220x220 Isometric Buildings (House, Factory, Shop, Paddlefield, Tree)
 * - Renders high-detail 128x128 Work Tools (Golden Scythe, Power Wrench, Pro Paddle Racket, Master Builder Hammer)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
  ihdr[8] = 8;
  ihdr[9] = 6;
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

// Auto-crop, resize to crisp high-res targetSize, apply 3x3 Sharpen Filter + 2px dark outline
function makeUltraSharpSprite(src, targetSize = 160) {
  const { width, height, rgba } = src;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a > 50) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);
  const pad = 6;
  const innerSize = targetSize - pad * 2;
  const scale = Math.min(innerSize / cropW, innerSize / cropH);
  const drawW = Math.max(1, Math.round(cropW * scale));
  const drawH = Math.max(1, Math.round(cropH * scale));
  const offX = Math.floor((targetSize - drawW) / 2);
  const offY = Math.floor((targetSize - drawH) / 2);

  // Bilinear sample into targetSize buffer
  const resized = Buffer.alloc(targetSize * targetSize * 4);
  for (let dy = 0; dy < drawH; dy++) {
    for (let dx = 0; dx < drawW; dx++) {
      const sx = Math.min(width - 1, minX + Math.floor((dx + 0.5) / scale));
      const sy = Math.min(height - 1, minY + Math.floor((dy + 0.5) / scale));
      const si = (sy * width + sx) * 4;
      if (rgba[si + 3] > 95) {
        const oi = ((offY + dy) * targetSize + (offX + dx)) * 4;
        resized[oi] = rgba[si];
        resized[oi + 1] = rgba[si + 1];
        resized[oi + 2] = rgba[si + 2];
        resized[oi + 3] = 255;
      }
    }
  }

  // Apply 3x3 Unsharp Mask / Sharpening Kernel: center * 2.1 - neighbors * 1.1 + contrast boost
  const sharpened = Buffer.from(resized);
  const nDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 1; y < targetSize - 1; y++) {
    for (let x = 1; x < targetSize - 1; x++) {
      const i = (y * targetSize + x) * 4;
      if (resized[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let cnt = 0;
        for (const [nx, ny] of nDirs) {
          const ni = ((y + ny) * targetSize + (x + nx)) * 4;
          if (resized[ni + 3] > 0) {
            sum += resized[ni + c];
            cnt++;
          }
        }
        const avg = cnt > 0 ? sum / cnt : resized[i + c];
        // Sharpen + slight contrast S-curve
        let val = resized[i + c] + (resized[i + c] - avg) * 1.35;
        val = (val - 128) * 1.12 + 132;
        sharpened[i + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }

  // Add crisp 2px dark game silhouette outline
  const outlined = Buffer.from(sharpened);
  const oDirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-2, 0], [2, 0], [0, -2], [0, 2],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ];
  for (let y = 2; y < targetSize - 2; y++) {
    for (let x = 2; x < targetSize - 2; x++) {
      const idx = (y * targetSize + x) * 4;
      if (sharpened[idx + 3] === 0) {
        let nearSolid = false;
        for (const [dx, dy] of oDirs) {
          if (sharpened[((y + dy) * targetSize + (x + dx)) * 4 + 3] === 255) {
            nearSolid = true;
            break;
          }
        }
        if (nearSolid) {
          outlined[idx] = 12;
          outlined[idx + 1] = 16;
          outlined[idx + 2] = 32;
          outlined[idx + 3] = 255;
        }
      }
    }
  }

  return { width: targetSize, height: targetSize, rgba: outlined };
}

const spritesDir = path.join(__dirname, '..', 'public', 'assets', 'sprites');

// 1. Upgrade the 8 AI-generated sprites to Ultra-Sharp 160x160 / 220x220 resolution
const aiTargets = [
  { in: 'farmer.png', out: 'pixel-farmer.png', size: 160 },
  { in: 'engineer.png', out: 'pixel-engineer.png', size: 160 },
  { in: 'manager.png', out: 'pixel-manager.png', size: 160 },
  { in: 'archon.png', out: 'pixel-archon.png', size: 160 },
  { in: 'castle.png', out: 'pixel-castle.png', size: 220 },
  { in: 'workstation.png', out: 'pixel-workstation.png', size: 192 },
  { in: 'bridge.png', out: 'pixel-bridge.png', size: 220 },
  { in: 'monolith.png', out: 'pixel-monolith.png', size: 220 }
];

for (const t of aiTargets) {
  const srcBuf = fs.readFileSync(path.join(spritesDir, t.in));
  const decoded = decodePNG(srcBuf);
  const sharp = makeUltraSharpSprite(decoded, t.size);
  fs.writeFileSync(path.join(spritesDir, t.out), encodePNG(sharp.width, sharp.height, sharp.rgba));
  console.log(`Sharpened ${t.out} (${sharp.width}x${sharp.height} ultra-crisp)`);
}

// High-Detail Isometric 2.5D / Pixel-Art 3D Renderer for custom buildings & tools
function createHDCanvas(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  function setPx(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    rgba[i] = Math.max(0, Math.min(255, Math.round(r)));
    rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    rgba[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    rgba[i + 3] = a;
  }
  function fillRect(x0, y0, rw, rh, [r, g, b]) {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) setPx(x, y, r, g, b, 255);
    }
  }
  function drawLine(x0, y0, x1, y1, [r, g, b], thick = 2) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const half = Math.floor(thick / 2);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let ty = -half; ty <= half; ty++) {
        for (let tx = -half; tx <= half; tx++) {
          setPx(x + tx, y + ty, r, g, b, 255);
        }
      }
    }
  }
  function drawIsoBox(cx, cy, hw, hd, vh, topC, leftC, rightC, opts = {}) {
    // Left vertical face
    for (let dx = -hw; dx <= 0; dx++) {
      const topY = cy + Math.round((dx + hw) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        let [r, g, b] = leftC;
        if (opts.brick && ((y - topY) % 8 === 0 || (dx + ((y >> 3) & 1) * 6) % 12 === 0)) {
          r -= 18; g -= 18; b -= 18;
        }
        // Crisp highlight on top-left edge
        if (y === topY || dx === -hw) {
          r += 22; g += 22; b += 22;
        }
        setPx(cx + dx, y, r, g, b);
      }
    }
    // Right vertical face
    for (let dx = 0; dx <= hw; dx++) {
      const topY = cy + Math.round((hw - dx) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        let [r, g, b] = rightC;
        if (opts.brick && ((y - topY) % 8 === 0 || (dx + ((y >> 3) & 1) * 6) % 12 === 0)) {
          r -= 16; g -= 16; b -= 16;
        }
        if (y === topY || dx === 0) {
          r += 18; g += 18; b += 18;
        }
        setPx(cx + dx, y, r, g, b);
      }
    }
    // Top diamond face
    for (let dy = -hd; dy <= hd; dy++) {
      const span = Math.round(hw * (1 - Math.abs(dy) / hd));
      for (let dx = -span; dx <= span; dx++) {
        let c = topC;
        if (opts.stripedTop && Math.floor((dx + dy + 200) / 8) % 2 === 0) {
          c = opts.stripedTop;
        }
        let [r, g, b] = c;
        if (opts.shingle && (dy % 5 === 0 || (dx + dy) % 9 === 0)) {
          r -= 16; g -= 14; b -= 14;
        }
        // Crisp bevel highlight along diamond rim
        if (Math.abs(dx) >= span - 1) {
          r += 24; g += 24; b += 24;
        }
        setPx(cx + dx, cy + dy, r, g, b);
      }
    }
  }
  function addOutline(thick = 2) {
    const copy = Buffer.from(rgba);
    const dirs = [];
    for (let dy = -thick; dy <= thick; dy++) {
      for (let dx = -thick; dx <= thick; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy <= thick * thick + 1) dirs.push([dx, dy]);
      }
    }
    for (let y = thick; y < h - thick; y++) {
      for (let x = thick; x < w - thick; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx + 3] === 0) {
          for (const [dx, dy] of dirs) {
            if (copy[((y + dy) * w + (x + dx)) * 4 + 3] > 200) {
              rgba[idx] = 12;
              rgba[idx + 1] = 16;
              rgba[idx + 2] = 32;
              rgba[idx + 3] = 255;
              break;
            }
          }
        }
      }
    }
  }
  return { w, h, rgba, setPx, fillRect, drawLine, drawIsoBox, addOutline };
}

// 2. pixel-house.png (200x200 Ultra-Crisp Isometric Homestead House)
{
  const c = createHDCanvas(200, 200);
  // Stone & emerald lawn terrace
  c.drawIsoBox(100, 128, 82, 41, 12, [52, 211, 153], [16, 185, 129], [5, 150, 105]);
  // Stone garden path
  c.drawIsoBox(78, 140, 16, 8, 3, [203, 213, 225], [148, 163, 184], [100, 116, 139]);
  // Warm cream plaster & oak timber cottage walls
  c.drawIsoBox(100, 90, 56, 28, 42, [254, 243, 199], [253, 224, 141], [217, 160, 91], { brick: true });
  // Oak corner & center beams
  c.fillRect(44, 90, 6, 42, [120, 53, 15]);
  c.fillRect(97, 116, 6, 42, [120, 53, 15]);
  c.fillRect(150, 90, 6, 42, [120, 53, 15]);
  // Stepped Terracotta Shingled Roof
  c.drawIsoBox(100, 82, 66, 33, 8, [239, 68, 68], [220, 38, 38], [185, 28, 28], { shingle: true });
  c.drawIsoBox(100, 71, 54, 27, 8, [248, 113, 113], [239, 68, 68], [185, 28, 28], { shingle: true });
  c.drawIsoBox(100, 60, 40, 20, 8, [252, 165, 165], [248, 113, 113], [220, 38, 38], { shingle: true });
  c.drawIsoBox(100, 50, 26, 13, 8, [254, 202, 202], [252, 165, 165], [239, 68, 68], { shingle: true });
  c.drawIsoBox(100, 41, 14, 7, 6, [254, 226, 226], [254, 202, 202], [248, 113, 113]);
  // Brick Chimney
  c.drawIsoBox(126, 44, 11, 6, 26, [185, 28, 28], [153, 27, 27], [127, 29, 29], { brick: true });
  // Arched Oak Door + Glowing Mullioned Windows
  c.fillRect(68, 110, 14, 24, [120, 53, 15]);
  c.fillRect(71, 113, 8, 19, [180, 83, 9]);
  // Right wall glowing window with frame
  c.fillRect(116, 102, 18, 16, [120, 53, 15]);
  c.fillRect(118, 104, 14, 12, [254, 240, 138]);
  c.fillRect(124, 104, 2, 12, [120, 53, 15]);
  c.fillRect(118, 109, 14, 2, [120, 53, 15]);
  // Left wall window
  c.fillRect(52, 98, 12, 13, [120, 53, 15]);
  c.fillRect(54, 100, 8, 9, [254, 240, 138]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-house.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated ultra-crisp pixel-house.png (200x200)');
}

// 3. pixel-factory.png (200x200 Ultra-Crisp Isometric Engineer Factory)
{
  const c = createHDCanvas(200, 200);
  // Heavy steel & concrete foundation
  c.drawIsoBox(100, 132, 84, 42, 12, [148, 163, 184], [100, 116, 139], [51, 65, 85]);
  // Industrial brick & dark slate factory body
  c.drawIsoBox(96, 88, 64, 32, 46, [71, 85, 105], [194, 65, 12], [154, 52, 18], { brick: true });
  // Striped cyan skylight roof deck
  c.drawIsoBox(96, 76, 68, 34, 10, [30, 41, 59], [15, 23, 42], [2, 6, 23], { stripedTop: [56, 189, 248] });
  // Twin Smokestacks with red hazard bands
  c.drawIsoBox(72, 36, 13, 7, 42, [226, 232, 240], [148, 163, 184], [71, 85, 105]);
  c.drawIsoBox(102, 28, 13, 7, 48, [226, 232, 240], [148, 163, 184], [71, 85, 105]);
  c.fillRect(62, 42, 20, 6, [239, 68, 68]);
  c.fillRect(92, 34, 20, 6, [239, 68, 68]);
  // Glowing Cyan Energy Bay & Golden Gear Sign
  c.fillRect(110, 98, 28, 26, [15, 23, 42]);
  c.fillRect(113, 101, 22, 20, [34, 211, 238]);
  c.fillRect(56, 94, 20, 20, [251, 191, 36]);
  c.fillRect(61, 99, 10, 10, [15, 23, 42]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-factory.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated ultra-crisp pixel-factory.png (200x200)');
}

// 4. pixel-shop.png (200x200 Ultra-Crisp Isometric GCOIN Market Shop)
{
  const c = createHDCanvas(200, 200);
  // Warm timber boardwalk base
  c.drawIsoBox(100, 132, 80, 40, 12, [217, 119, 6], [180, 83, 9], [120, 53, 15]);
  // Golden-cream shop walls
  c.drawIsoBox(100, 90, 56, 28, 42, [254, 249, 195], [253, 224, 71], [234, 179, 8], { brick: true });
  // Crisp Red & White Striped Market Awning
  c.drawIsoBox(100, 82, 68, 34, 10, [239, 68, 68], [220, 38, 38], [185, 28, 28], { stripedTop: [255, 255, 255] });
  // Upper timber roof & Giant Golden GCOIN Signboard
  c.drawIsoBox(100, 64, 46, 23, 10, [120, 53, 15], [92, 40, 12], [69, 26, 3]);
  c.drawIsoBox(100, 44, 22, 11, 20, [253, 224, 71], [245, 158, 11], [217, 119, 6]);
  // Display Crates (Emerald Rations & Golden Goods)
  c.drawIsoBox(64, 122, 16, 8, 14, [74, 222, 128], [34, 197, 94], [21, 128, 61]);
  c.drawIsoBox(132, 122, 16, 8, 14, [251, 191, 36], [217, 119, 6], [180, 83, 9]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-shop.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated ultra-crisp pixel-shop.png (200x200)');
}

// 5. pixel-paddlefield.png (240x240 Ultra-Crisp Isometric 3D Paddlefield Stadium Court)
{
  const c = createHDCanvas(240, 240);
  // Terracotta championship stadium apron
  c.drawIsoBox(120, 134, 106, 53, 16, [239, 68, 68], [185, 28, 28], [127, 29, 29]);
  // Two-tone Emerald Championship Turf Court
  c.drawIsoBox(120, 124, 90, 45, 8, [16, 185, 129], [5, 150, 105], [4, 120, 87], { stripedTop: [20, 198, 140] });
  // Crisp White Isometric Court Boundary Lines & Service Boxes
  c.drawLine(120, 83, 202, 124, [255, 255, 255], 3);
  c.drawLine(202, 124, 120, 165, [255, 255, 255], 3);
  c.drawLine(120, 165, 38, 124, [255, 255, 255], 3);
  c.drawLine(38, 124, 120, 83, [255, 255, 255], 3);
  // Center service line
  c.drawLine(79, 103, 161, 145, [255, 255, 255], 2);
  // 3D Net Posts & Crisp Center Net with White Top Tape
  c.fillRect(76, 122, 6, 22, [15, 23, 42]);
  c.fillRect(158, 81, 6, 22, [15, 23, 42]);
  c.drawLine(79, 134, 161, 93, [148, 163, 184], 4);
  c.drawLine(79, 126, 161, 85, [255, 255, 255], 3);
  // Cyan Tempered-Glass Padel Backboards at court ends
  c.drawLine(120, 66, 202, 107, [56, 189, 248], 4);
  c.drawLine(38, 107, 120, 66, [56, 189, 248], 4);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-paddlefield.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated ultra-crisp pixel-paddlefield.png (240x240)');
}

// 6. pixel-tree.png (128x128 Ultra-Crisp 3D Isometric Voxel Tree)
{
  const c = createHDCanvas(128, 128);
  c.drawIsoBox(64, 92, 14, 7, 26, [146, 64, 14], [120, 53, 15], [69, 26, 3]);
  c.drawIsoBox(64, 70, 40, 20, 18, [74, 222, 128], [34, 197, 94], [21, 128, 61]);
  c.drawIsoBox(64, 48, 32, 16, 18, [134, 239, 172], [74, 222, 128], [22, 163, 74]);
  c.drawIsoBox(64, 28, 20, 10, 16, [187, 247, 208], [134, 239, 172], [34, 197, 94]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-tree.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated ultra-crisp pixel-tree.png (128x128)');
}

// 7. Ultra-Crisp 128x128 Work Tools (Scythe, Wrench, Paddle Racket, Builder Hammer)
{
  // Golden Harvester Scythe
  const c = createHDCanvas(128, 128);
  c.drawLine(28, 104, 92, 30, [180, 83, 9], 8);
  c.drawLine(30, 102, 90, 28, [217, 119, 6], 4);
  c.drawLine(92, 30, 34, 18, [253, 224, 71], 9);
  c.drawLine(34, 18, 16, 40, [56, 189, 248], 7);
  c.drawLine(90, 26, 36, 15, [255, 255, 255], 3);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-scythe.png'), encodePNG(c.w, c.h, c.rgba));
}
{
  // Power Spanner Wrench
  const c = createHDCanvas(128, 128);
  c.drawLine(30, 98, 86, 42, [14, 165, 233], 10);
  c.drawLine(32, 96, 84, 40, [103, 232, 249], 4);
  c.fillRect(74, 18, 28, 12, [226, 232, 240]);
  c.fillRect(94, 28, 12, 28, [226, 232, 240]);
  c.fillRect(18, 86, 22, 22, [251, 191, 36]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-wrench.png'), encodePNG(c.w, c.h, c.rgba));
}
{
  // Pro Paddle Racket
  const c = createHDCanvas(128, 128);
  c.drawLine(24, 104, 58, 70, [245, 158, 11], 9);
  c.fillRect(52, 18, 52, 52, [239, 68, 68]);
  c.fillRect(60, 26, 36, 36, [190, 242, 100]);
  // Crisp racket string grid
  for (let i = 66; i <= 90; i += 8) {
    c.drawLine(i, 26, i, 62, [255, 255, 255], 1);
    c.drawLine(60, i - 34, 96, i - 34, [255, 255, 255], 1);
  }
  c.fillRect(24, 30, 16, 16, [253, 224, 71]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-racket.png'), encodePNG(c.w, c.h, c.rgba));
}
{
  // Master Builder Hammer
  const c = createHDCanvas(128, 128);
  c.drawLine(28, 104, 80, 46, [180, 83, 9], 9);
  c.fillRect(56, 20, 50, 28, [251, 191, 36]);
  c.fillRect(64, 25, 34, 18, [241, 245, 249]);
  c.addOutline(2);
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-hammer.png'), encodePNG(c.w, c.h, c.rgba));
}
console.log('Generated all 4 ultra-crisp 128x128 work tools');
