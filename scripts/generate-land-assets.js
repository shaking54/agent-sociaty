#!/usr/bin/env node
/**
 * Generates crisp, palette-quantized, 1px dark-outlined Isometric Pixel-Art 3D sprites for:
 * 1. pixel-house.png (Cozy Isometric Role House / Cottage)
 * 2. pixel-factory.png (Isometric Engineer Factory with smokestacks & gear)
 * 3. pixel-shop.png (Isometric GCOIN Market Shop with striped awning & crates)
 * 4. pixel-paddlefield.png (Isometric Pixel-Art 3D Paddlefield Court with net, lines & glass walls)
 * 5. pixel-tool-scythe.png (Golden Harvester Scythe for Farmers)
 * 6. pixel-tool-wrench.png (Power Wrench / Spanner for Engineers)
 * 7. pixel-tool-racket.png (Pro Paddle / Tennis Racket for Managers & Paddlefield)
 * 8. pixel-tool-hammer.png (Master Builder Hammer for constructing & upgrading buildings)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

function createPixelCanvas(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  function setPx(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  }
  function fillRect(x0, y0, rw, rh, [r, g, b], a = 255) {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) setPx(x, y, r, g, b, a);
    }
  }
  function drawLine(x0, y0, x1, y1, [r, g, b], thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let ty = 0; ty < thick; ty++) {
        for (let tx = 0; tx < thick; tx++) {
          setPx(x + tx, y + ty, r, g, b, 255);
        }
      }
    }
  }
  function drawIsoBox(cx, cy, hw, hd, vh, topC, leftC, rightC, stripedTop = null) {
    // Left vertical face
    for (let dx = -hw; dx <= 0; dx++) {
      const topY = cy + Math.round((dx + hw) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        setPx(cx + dx, y, leftC[0], leftC[1], leftC[2]);
      }
    }
    // Right vertical face
    for (let dx = 0; dx <= hw; dx++) {
      const topY = cy + Math.round((hw - dx) * (hd / hw));
      for (let y = topY; y <= topY + vh; y++) {
        setPx(cx + dx, y, rightC[0], rightC[1], rightC[2]);
      }
    }
    // Top diamond face
    for (let dy = -hd; dy <= hd; dy++) {
      const span = Math.round(hw * (1 - Math.abs(dy) / hd));
      for (let dx = -span; dx <= span; dx++) {
        let c = topC;
        if (stripedTop && Math.floor((dx + dy + 100) / 5) % 2 === 0) {
          c = stripedTop;
        }
        const dither = ((dx + dy) & 1) === 0 ? 0 : -5;
        setPx(
          cx + dx,
          cy + dy,
          Math.max(0, c[0] + dither),
          Math.max(0, c[1] + dither),
          Math.max(0, c[2] + dither)
        );
      }
    }
  }
  function addOutline(outlineCol = [18, 22, 41]) {
    const copy = Buffer.from(rgba);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx + 3] === 0) {
          for (const [dx, dy] of dirs) {
            if (copy[((y + dy) * w + (x + dx)) * 4 + 3] > 180) {
              rgba[idx] = outlineCol[0];
              rgba[idx + 1] = outlineCol[1];
              rgba[idx + 2] = outlineCol[2];
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

const spritesDir = path.join(__dirname, '..', 'public', 'assets', 'sprites');

// 1. pixel-house.png (96x96 Cozy Isometric Role Homestead House with warm timber, chimney & garden base)
{
  const c = createPixelCanvas(96, 96);
  // Stone & grass foundation
  c.drawIsoBox(48, 60, 38, 19, 6, [74, 222, 128], [34, 197, 94], [21, 128, 61]);
  // Warm cream/timber cottage walls
  c.drawIsoBox(48, 42, 26, 13, 20, [254, 243, 199], [253, 224, 141], [217, 160, 91]);
  // Timber beams
  c.fillRect(22, 42, 3, 20, [120, 53, 15]);
  c.fillRect(47, 54, 3, 20, [120, 53, 15]);
  c.fillRect(71, 42, 3, 20, [120, 53, 15]);
  // Stepped Terracotta Red Roof
  c.drawIsoBox(48, 38, 30, 15, 4, [239, 68, 68], [220, 38, 38], [185, 28, 28]);
  c.drawIsoBox(48, 33, 24, 12, 4, [248, 113, 113], [239, 68, 68], [185, 28, 28]);
  c.drawIsoBox(48, 28, 18, 9, 4, [252, 165, 165], [248, 113, 113], [220, 38, 38]);
  c.drawIsoBox(48, 24, 11, 6, 4, [254, 202, 202], [252, 165, 165], [239, 68, 68]);
  // Brick Chimney
  c.drawIsoBox(60, 22, 5, 3, 12, [185, 28, 28], [153, 27, 27], [127, 29, 29]);
  // Door & glowing windows
  c.fillRect(34, 52, 6, 10, [146, 64, 14]);
  c.fillRect(56, 49, 7, 7, [254, 240, 138]);
  c.fillRect(26, 47, 5, 6, [254, 240, 138]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-house.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-house.png');
}

// 2. pixel-factory.png (96x96 Isometric Engineer Factory with twin smokestacks, sawtooth roof & cyan core)
{
  const c = createPixelCanvas(96, 96);
  // Concrete industrial slab
  c.drawIsoBox(48, 62, 40, 20, 6, [148, 163, 184], [100, 116, 139], [71, 85, 105]);
  // Main dark steel & red-brick factory hull
  c.drawIsoBox(46, 42, 30, 15, 22, [71, 85, 105], [180, 83, 9], [146, 64, 14]);
  // Steel roof deck with cyan energy skylights
  c.drawIsoBox(46, 36, 32, 16, 5, [51, 65, 85], [30, 41, 59], [15, 23, 42], [56, 189, 248]);
  // Twin industrial smokestacks
  c.drawIsoBox(34, 18, 6, 3, 20, [203, 213, 225], [100, 116, 139], [51, 65, 85]);
  c.drawIsoBox(48, 14, 6, 3, 22, [203, 213, 225], [100, 116, 139], [51, 65, 85]);
  // Red warning stripes on smokestacks
  c.fillRect(30, 20, 9, 3, [239, 68, 68]);
  c.fillRect(44, 16, 9, 3, [239, 68, 68]);
  // Smoke puffs
  c.fillRect(32, 9, 8, 5, [226, 232, 240]);
  c.fillRect(46, 5, 9, 6, [226, 232, 240]);
  // Glowing cyan conveyor bay & golden gear emblem
  c.fillRect(54, 48, 12, 11, [34, 211, 238]);
  c.fillRect(28, 46, 8, 8, [251, 191, 36]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-factory.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-factory.png');
}

// 3. pixel-shop.png (96x96 Isometric GCOIN Market Shop with red/white striped awning & golden crates)
{
  const c = createPixelCanvas(96, 96);
  // Wooden deck base
  c.drawIsoBox(48, 62, 38, 19, 6, [217, 119, 6], [180, 83, 9], [120, 53, 15]);
  // Shop building walls
  c.drawIsoBox(48, 42, 26, 13, 20, [254, 249, 195], [253, 224, 71], [234, 179, 8]);
  // Striped Red & White Market Awning
  c.drawIsoBox(48, 39, 31, 16, 5, [239, 68, 68], [220, 38, 38], [185, 28, 28], [255, 255, 255]);
  // Flat roof + Golden GCOIN Signboard on top
  c.drawIsoBox(48, 31, 22, 11, 5, [120, 53, 15], [92, 40, 12], [69, 26, 3]);
  c.drawIsoBox(48, 22, 10, 5, 9, [251, 191, 36], [245, 158, 11], [217, 119, 6]);
  // Display counter & crates in front
  c.drawIsoBox(32, 58, 8, 4, 7, [74, 222, 128], [34, 197, 94], [21, 128, 61]);
  c.drawIsoBox(62, 58, 8, 4, 7, [251, 191, 36], [217, 119, 6], [180, 83, 9]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-shop.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-shop.png');
}

// 4. pixel-paddlefield.png (112x112 Tripo3D-style Isometric Pixel-Art 3D Paddlefield / Tennis Court)
{
  const c = createPixelCanvas(112, 112);
  // Outer court stadium apron (terracotta / slate)
  c.drawIsoBox(56, 62, 50, 25, 8, [239, 68, 68], [185, 28, 28], [127, 29, 29]);
  // Inner emerald-teal turf Paddlefield court
  c.drawIsoBox(56, 58, 42, 21, 4, [16, 185, 129], [5, 150, 105], [4, 120, 87]);
  // Crisp white isometric court boundary lines & service boxes
  c.drawLine(56, 39, 94, 58, [255, 255, 255], 1);
  c.drawLine(94, 58, 56, 77, [255, 255, 255], 1);
  c.drawLine(56, 77, 18, 58, [255, 255, 255], 1);
  c.drawLine(18, 58, 56, 39, [255, 255, 255], 1);
  // Center service line
  c.drawLine(37, 48, 75, 68, [255, 255, 255], 1);
  // Isometric Center Net & Posts across the middle of the Paddlefield
  c.fillRect(36, 58, 3, 10, [30, 41, 59]);
  c.fillRect(74, 39, 3, 10, [30, 41, 59]);
  c.drawLine(37, 60, 75, 41, [255, 255, 255], 2);
  c.drawLine(37, 64, 75, 45, [203, 213, 225], 1);
  // Glass/mesh backboards at the two ends of the Paddlefield
  c.drawLine(56, 31, 94, 50, [103, 232, 249], 2);
  c.drawLine(18, 50, 56, 31, [103, 232, 249], 2);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-paddlefield.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-paddlefield.png');
}

// 5. pixel-tool-scythe.png (48x48 Golden Harvester Scythe)
{
  const c = createPixelCanvas(48, 48);
  // Wooden handle diagonal
  c.drawLine(12, 38, 34, 12, [180, 83, 9], 3);
  // Curved golden-cyan scythe blade
  c.drawLine(34, 12, 14, 8, [253, 224, 71], 3);
  c.drawLine(14, 8, 8, 16, [56, 189, 248], 2);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-scythe.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-tool-scythe.png');
}

// 6. pixel-tool-wrench.png (48x48 Engineer Power Spanner)
{
  const c = createPixelCanvas(48, 48);
  c.drawLine(12, 36, 32, 16, [56, 189, 248], 4);
  // Wrench jaws
  c.fillRect(28, 8, 10, 4, [226, 232, 240]);
  c.fillRect(36, 12, 4, 10, [226, 232, 240]);
  c.fillRect(8, 32, 8, 8, [251, 191, 36]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-wrench.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-tool-wrench.png');
}

// 7. pixel-tool-racket.png (48x48 Paddlefield / Tennis Racket)
{
  const c = createPixelCanvas(48, 48);
  // Grip handle
  c.drawLine(10, 38, 22, 26, [245, 158, 11], 3);
  // Racket oval head & strings
  c.fillRect(20, 8, 18, 18, [239, 68, 68]);
  c.fillRect(23, 11, 12, 12, [190, 242, 100]);
  // Yellow tennis ball beside it
  c.fillRect(10, 12, 6, 6, [253, 224, 71]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-racket.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-tool-racket.png');
}

// 8. pixel-tool-hammer.png (48x48 Master Builder Hammer)
{
  const c = createPixelCanvas(48, 48);
  c.drawLine(12, 38, 30, 18, [180, 83, 9], 3);
  // Heavy golden-steel hammer head
  c.fillRect(22, 8, 18, 10, [251, 191, 36]);
  c.fillRect(25, 10, 12, 6, [226, 232, 240]);
  c.addOutline();
  fs.writeFileSync(path.join(spritesDir, 'pixel-tool-hammer.png'), encodePNG(c.w, c.h, c.rgba));
  console.log('Generated pixel-tool-hammer.png');
}
