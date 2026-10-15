const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const S = 256;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const radius = 56;
function insideRounded(x, y) {
  const cx = Math.min(Math.max(x, radius), S - radius);
  const cy = Math.min(Math.max(y, radius), S - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

const raw = Buffer.alloc((S * 4 + 1) * S);
const bg = [79, 110, 247];
const fg = [255, 255, 255];
const thickness = 15;

for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    const o = y * (S * 4 + 1) + 1 + x * 4;
    let r = 0, g = 0, b = 0, a = 0;
    if (insideRounded(x, y)) {
      r = bg[0]; g = bg[1]; b = bg[2]; a = 255;
      const d1 = distToSegment(x, y, 74, 132, 112, 170);
      const d2 = distToSegment(x, y, 112, 170, 186, 88);
      if (d1 <= thickness || d2 <= thickness) {
        r = fg[0]; g = fg[1]; b = fg[2];
      }
    }
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log('wrote', path.join(outDir, 'icon.png'), png.length, 'bytes');
