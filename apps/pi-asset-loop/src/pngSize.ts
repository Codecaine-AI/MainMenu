// Parse width/height from a PNG IHDR chunk without pulling in an image lib.
// Layout: 8-byte signature + 4-byte length + "IHDR" + 4-byte width BE + 4-byte height BE.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG (bad signature).");
  }
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Not a PNG (no IHDR at expected offset).");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}
