// ZIP sin compresión: mantiene cada PDF como un archivo independiente.
export default async function downloadPdfArchive(files, name) {
  const encoder = new TextEncoder();
  const parts = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    const filename = encoder.encode(file.name);
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + filename.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true);
    l.setUint32(22, bytes.length, true); l.setUint16(26, filename.length, true);
    local.set(filename, 30);
    const central = new Uint8Array(46 + filename.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true); c.setUint16(28, filename.length, true);
    c.setUint32(42, offset, true); central.set(filename, 46);
    parts.push(local, bytes); directory.push(central);
    offset += local.length + bytes.length; directorySize += central.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  const url = URL.createObjectURL(new Blob([...parts, ...directory, end], { type: 'application/zip' }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}