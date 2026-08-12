import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, inflateRawSync } from "node:zlib";

const file = process.argv[2];
const outPath = process.argv[3];
const buf = readFileSync(file);

function inflate(chunk) {
  try {
    return inflateSync(chunk);
  } catch {
    try {
      return inflateRawSync(chunk);
    } catch {
      return null;
    }
  }
}

const chunks = [];
let i = 0;
while (true) {
  const s = buf.indexOf("stream", i);
  if (s === -1) break;
  let start = s + 6;
  if (buf[start] === 0x0d) start++;
  if (buf[start] === 0x0a) start++;
  const e = buf.indexOf("endstream", start);
  if (e === -1) break;
  const out = inflate(buf.subarray(start, e));
  if (out) chunks.push(out.toString("latin1"));
  i = e + 9;
}

function unescapePdf(s) {
  return s
    .replace(/\\([nrtbf])/g, (_, c) =>
      ({ n: "\n", r: "\r", t: "\t", b: "", f: "" })[c],
    )
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, "$1");
}

const lines = [];
for (const c of chunks) {
  if (!/(Tj|TJ)/.test(c)) continue;
  let line = "";
  const re = /\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]+>|T\*|Tj|TJ|Td|TD|ET/g;
  let m;
  while ((m = re.exec(c))) {
    const tok = m[0];
    if (tok.startsWith("(")) {
      line += unescapePdf(tok.slice(1, -1));
    } else if (tok.startsWith("<")) {
      const hex = tok.slice(1, -1).replace(/\s/g, "");
      for (let k = 0; k + 3 < hex.length + 1; k += 4) {
        const code = parseInt(hex.slice(k, k + 4), 16);
        if (code > 8 && code < 0xfffd) line += String.fromCharCode(code);
      }
    } else if (tok === "T*" || tok === "TD" || tok === "Td" || tok === "ET") {
      if (line.trim()) lines.push(line.trim());
      line = "";
    }
  }
  if (line.trim()) lines.push(line.trim());
}

const text = lines.join("\n").replace(/\n{3,}/g, "\n\n");

writeFileSync(outPath, text, "utf8");
process.stdout.write(`${text.length}\n`);
