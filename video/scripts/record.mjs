// Records your own voice-over, one line per scene, into vo/rec/<id>.wav.
// Usage: npm run record            (all lines)
//        npm run record -- risk    (only one line)
// MIC=0 picks another input (list: ffmpeg -f avfoundation -list_devices true -i "")
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import readline from "node:readline/promises";

const MIC = process.env.MIC ?? "1"; // 1 = MacBook Pro Microphone
const only = process.argv[2];
const script = JSON.parse(readFileSync("vo/script.json", "utf8")).filter((s) => !only || s.id === only);
mkdirSync("vo/rec", { recursive: true });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Cleanup: cut rumble, reduce room noise, trim silence at both ends, even loudness.
const CLEAN = [
  "highpass=f=80", "afftdn=nf=-25",
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15",
  "areverse", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25", "areverse",
  "acompressor=threshold=-20dB:ratio=3:attack=5:release=80", "loudnorm=I=-16:TP=-1.5:LRA=7",
].join(",");

for (const [i, s] of script.entries()) {
  for (;;) {
    console.log(`\n[${i + 1}/${script.length}] ${s.id}  (scene ${s.min}s)\n\n  "${s.text}"\n`);
    await rl.question("Enter = start recording ");
    const raw = `vo/rec/${s.id}.raw.wav`;
    const rec = spawn("ffmpeg", ["-y", "-v", "error", "-f", "avfoundation", "-i", `:${MIC}`, "-ac", "1", "-ar", "48000", raw], { stdio: ["pipe", "inherit", "inherit"] });
    await rl.question("● recording… Enter = stop ");
    rec.stdin.write("q");
    await new Promise((r) => rec.on("close", r));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", CLEAN, "-ar", "44100", `vo/rec/${s.id}.tmp.wav`]);
    renameSync(`vo/rec/${s.id}.tmp.wav`, `vo/rec/${s.id}.wav`);
    execFileSync("afplay", [`vo/rec/${s.id}.wav`]);
    const a = (await rl.question("Keep? [Enter = yes, r = redo] ")).trim().toLowerCase();
    if (a !== "r") break;
  }
}
rl.close();
console.log("\nDone. Next: npm run vo && npm run render");
