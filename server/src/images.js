import fs from 'node:fs';

// The browser-reported type of an upload is only a claim: check the file
// really starts like a JPEG, PNG or WEBP before keeping it, so a renamed
// non-image can't be stored and served or emailed as a picture.
export function isRealImage(path) {
  const buf = Buffer.alloc(12);
  let fd;
  try {
    fd = fs.openSync(path, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
  return jpeg || png || webp;
}
