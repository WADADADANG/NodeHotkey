/**
 * create-preset-sounds.js - Generates pristine 16-bit 44.1kHz PCM WAV files for built-in audio alerts
 */
const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

function writeWavFile(filename, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.round(intSample), offset);
    offset += 2;
  }

  const filePath = path.join(soundsDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${buffer.length} bytes)`);
}

const sampleRate = 44100;

// 1. DING / CHIME (Bell tone C6 with smooth exponential decay, ~0.65s)
(() => {
  const duration = 0.65;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  const freq = 1046.50; // C6

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-5.0 * t);
    const val = 0.7 * Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
    samples[i] = val * env;
  }
  writeWavFile('ding.wav', samples, sampleRate);
})();

// 2. ALARM / SIREN (Urgent Two-Tone Siren alternating 850Hz & 1300Hz, ~0.6s)
(() => {
  const duration = 0.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const cycle = Math.floor(t * 10); // 100ms per step
    const freq = (cycle % 2 === 0) ? 850 : 1300;
    const val = 0.7 * Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 3 * t);
    samples[i] = val * 0.85;
  }
  writeWavFile('alarm.wav', samples, sampleRate);
})();

// 3. LASER / HIGH BEEP (Sci-Fi downward pitch sweep from 2500Hz -> 500Hz, ~0.28s)
(() => {
  const duration = 0.28;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const progress = t / duration; // 0.0 -> 1.0
    const freq = 2500 - (2000 * Math.pow(progress, 0.7)); // Sweep from 2500 down to 500
    phase += (2 * Math.PI * freq) / sampleRate;
    const env = 1.0 - (progress * 0.7); // Gentle fade out
    samples[i] = Math.sin(phase) * 0.85 * env;
  }
  writeWavFile('laser.wav', samples, sampleRate);
})();

// 4. WARNING (Dual-tone buzzer pulse, ~0.45s)
(() => {
  const duration = 0.45;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const pulse = (Math.floor(t * 8) % 2 === 0) ? 1.0 : 0.0;
    const val = 0.6 * Math.sin(2 * Math.PI * 400 * t) + 0.4 * Math.sin(2 * Math.PI * 600 * t);
    samples[i] = val * pulse * 0.9;
  }
  writeWavFile('warning.wav', samples, sampleRate);
})();

// 5. SUCCESS (Ascending Major Arpeggio: C5 -> E5 -> G5 -> C6, ~0.55s)
(() => {
  const duration = 0.55;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const noteDur = duration / notes.length;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDur));
    const noteT = t - (noteIdx * noteDur);
    const freq = notes[noteIdx];
    const env = Math.exp(-5.0 * noteT);
    const val = 0.75 * Math.sin(2 * Math.PI * freq * noteT) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * noteT);
    samples[i] = val * 0.9 * env;
  }
  writeWavFile('success.wav', samples, sampleRate);
})();

console.log('Regenerated all preset sounds successfully!');
