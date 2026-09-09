/**
 * tts-service.js - High-Fidelity Neural Text-to-Speech (TTS) Service for NodeHotkey
 * Powered by Microsoft Edge Neural Voices (Free, Zero API Key, Crystal Clear).
 * Supports:
 * - Thai Neural Voices: Premwadee (หญิง), Niwat (ชาย)
 * - English Neural Voices: Jenny, Guy
 * - MD5 Audio File Caching (Instant 0ms replay for repeated phrases)
 * - Automatic Thai/English Character Detection
 * - Offline Fallback via Windows System Speech
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { EdgeTTS } = require('@andresaya/edge-tts');

const CACHE_DIR = path.join(__dirname, 'public', 'sounds', 'tts_cache');
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    console.error('[TTS] Failed to create cache directory:', e.message);
  }
}

const SUPPORTED_VOICES = [
  { id: 'th-TH-PremwadeeNeural', name: 'เปรมวดี (หญิงไทย)', lang: 'th' },
  { id: 'th-TH-NiwatNeural', name: 'นิวัต (ชายไทย)', lang: 'th' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female)', lang: 'en' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male)', lang: 'en' }
];

function getCacheKey(text, voice) {
  const clean = `${voice || 'default'}_${String(text || '').trim()}`;
  return crypto.createHash('md5').update(clean).digest('hex');
}

/**
 * Synthesize text into an MP3 file
 * @param {string} text - Message to speak
 * @param {string} voice - Voice ID
 * @returns {Promise<string>} Absolute path to the generated MP3
 */
async function synthesize(text, voice = 'th-TH-PremwadeeNeural') {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;

  // Auto-switch to Thai voice if text contains Thai characters and an English voice was selected
  const hasThai = /[\u0e00-\u0e7f]/.test(cleanText);
  let selectedVoice = voice || 'th-TH-PremwadeeNeural';
  if (hasThai && selectedVoice.startsWith('en-')) {
    // Preserve gender: male English voices fallback to Niwat (Thai Male), female to Premwadee (Thai Female)
    if (selectedVoice.includes('Guy') || selectedVoice.includes('Christopher') || selectedVoice.includes('Eric')) {
      selectedVoice = 'th-TH-NiwatNeural';
    } else {
      selectedVoice = 'th-TH-PremwadeeNeural';
    }
  }

  const hash = getCacheKey(cleanText, selectedVoice);
  const targetPath = path.join(CACHE_DIR, `${hash}.mp3`);

  // 1. Check cache first (0ms latency if already generated)
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  // 2. Synthesize using EdgeTTS
  try {
    const tts = new EdgeTTS();
    await tts.synthesize(cleanText, selectedVoice);
    
    // toFile automatically appends .mp3 if target doesn't end with it
    const baseTarget = path.join(CACHE_DIR, hash);
    const createdPath = await tts.toFile(baseTarget);

    // If createdPath ends up with .mp3.mp3, rename it cleanly
    if (createdPath && createdPath !== targetPath && fs.existsSync(createdPath)) {
      try {
        fs.renameSync(createdPath, targetPath);
      } catch {
        return createdPath;
      }
    }

    return targetPath;
  } catch (err) {
    console.warn(`[TTS] EdgeTTS failed: ${err.message}. Attempting Windows SAPI fallback...`);
    return fallbackWindowsSpeech(cleanText);
  }
}

/**
 * Fallback synthesizer using Windows native speech synthesis
 */
function fallbackWindowsSpeech(text) {
  return new Promise((resolve) => {
    try {
      const ps = spawn('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${text.replace(/'/g, "''")}');`
      ], { windowsHide: true });

      ps.on('close', () => resolve(null));
      ps.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

module.exports = {
  SUPPORTED_VOICES,
  synthesize,
  CACHE_DIR
};
