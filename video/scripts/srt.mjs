// Writes out/demo.srt with the same sentence timing as the on-screen captions.
import { readFileSync, writeFileSync } from "node:fs";
const FPS = 30;
const timing = JSON.parse(readFileSync("src/timing.json", "utf8"));
const script = JSON.parse(readFileSync("vo/script.json", "utf8"));
const ts = (fr) => {
  const ms = Math.round((fr / FPS) * 1000), p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
let offset = 0, n = 0, out = "";
for (const s of script) {
  const dur = timing[s.id].frames;
  const parts = s.text.match(/[^.?!]+[.?!]*/g).map((x) => x.trim());
  const total = parts.reduce((a, p) => a + p.length, 0);
  let t = 14;
  for (const p of parts) {
    const len = ((dur - 30) * p.length) / total;
    out += `${++n}\n${ts(offset + t)} --> ${ts(offset + t + len - 2)}\n${p.replace("secstock dot vercel dot app", "secstock.vercel.app")}\n\n`;
    t += len;
  }
  offset += dur;
}
writeFileSync("out/demo.srt", out);
console.log(`${n} cues written to out/demo.srt`);
