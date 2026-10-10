// Generates one voice-over file per scene and writes scene lengths to src/timing.json.
// Voice source, in order of preference:
//   1. Your own recordings: put vo/rec/<id>.wav (or .m4a/.mp3) and they are used as-is.
//   2. ElevenLabs, if ELEVENLABS_API_KEY is set (ELEVENLABS_VOICE_ID optional).
//   3. macOS `say`, only if VOICE is set (sounds synthetic).
// Otherwise the scene has no voice; captions carry the script.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";

const FPS = 30;
const script = JSON.parse(readFileSync("vo/script.json", "utf8"));
mkdirSync("public/vo", { recursive: true });

const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const toWav = (src, dst) => execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-ar", "44100", "-ac", "1", dst]);

async function eleven(text, dst) {
  const id = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  writeFileSync("public/vo/tmp.mp3", Buffer.from(await r.arrayBuffer()));
  toWav("public/vo/tmp.mp3", dst);
}

const timing = {};
for (const s of script) {
  const dst = `public/vo/${s.id}.wav`;
  rmSync(dst, { force: true });
  let secs = 0;
  if (!process.env.SILENT) {
    const rec = ["wav", "m4a", "mp3"].map((e) => `vo/rec/${s.id}.${e}`).find(existsSync);
    if (rec) toWav(rec, dst);
    else if (process.env.ELEVENLABS_API_KEY) await eleven(s.text, dst);
    else if (process.env.VOICE) {
      execFileSync("say", ["-v", process.env.VOICE, "-r", process.env.RATE ?? "175", "-o", "public/vo/tmp.aiff", s.text]);
      toWav("public/vo/tmp.aiff", dst);
    }
    if (existsSync(dst)) secs = dur(dst);
  }
  // 0.6 s lead-in + 0.9 s tail so lines never run into the next scene
  timing[s.id] = { frames: Math.round(Math.max(s.min, secs + 1.5) * FPS), vo: secs > 0 };
  console.log(`${s.id.padEnd(10)} vo ${secs.toFixed(1)}s -> scene ${(timing[s.id].frames / FPS).toFixed(1)}s`);
}
writeFileSync("src/timing.json", JSON.stringify(timing, null, 2) + "\n");
const total = Object.values(timing).reduce((a, t) => a + t.frames, 0) / FPS;
console.log(`total ${total.toFixed(1)}s`);
