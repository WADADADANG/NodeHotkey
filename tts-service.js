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
  const mp3Path = path.join(CACHE_DIR, `${hash}.mp3`);
  const wavPath = path.join(CACHE_DIR, `${hash}.wav`);

  // 1. Check cache first (0ms latency if already generated)
  if (fs.existsSync(mp3Path)) {
    return mp3Path;
  }
  if (fs.existsSync(wavPath)) {
    return wavPath;
  }

  // 2. Synthesize using EdgeTTS with auto-retry
  let lastErr = null;
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tts = new EdgeTTS();
      await tts.synthesize(cleanText, selectedVoice);

      if (!tts.audio_stream || tts.audio_stream.length === 0) {
        throw new Error('EdgeTTS returned empty audio stream');
      }

      // toFile automatically appends .mp3 if target doesn't end with it
      const baseTarget = path.join(CACHE_DIR, hash);
      const createdPath = await tts.toFile(baseTarget);

      // If createdPath ends up with .mp3.mp3, rename it cleanly
      if (createdPath && createdPath !== mp3Path && fs.existsSync(createdPath)) {
        try {
          fs.renameSync(createdPath, mp3Path);
        } catch {
          return createdPath;
        }
      }

      return mp3Path;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 150 * attempt));
      }
    }
  }

  console.warn(`[TTS] EdgeTTS failed (${lastErr?.message || 'unknown'}). Attempting Windows Native Speech fallback...`);
  return fallbackWindowsSpeech(cleanText, hash, hasThai);
}

/**
 * Fallback synthesizer using Windows native speech synthesis:
 * - Uses Windows OneCore (Microsoft Pattara for Thai, David for English) to generate WAV audio file
 * - Falls back to legacy SAPI System.Speech if OneCore is unavailable
 * @param {string} text - Clean text to speak
 * @param {string} hash - MD5 cache hash
 * @param {boolean} hasThai - Whether text contains Thai characters
 * @returns {Promise<string|null>} Path to generated WAV or null
 */
function fallbackWindowsSpeech(text, hash, hasThai) {
  const targetWav = path.join(CACHE_DIR, `${hash}.wav`).replace(/\\/g, '/');
  const b64Text = Buffer.from(text, 'utf8').toString('base64');
  const targetLang = hasThai ? 'th-TH' : 'en-US';

  const psScript = `
[System.Reflection.Assembly]::LoadWithPartialName('System.Runtime.WindowsRuntime') | Out-Null
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime] | Out-Null

$rawText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Text}'))
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer

$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq '${targetLang}' } | Select-Object -First 1
if ($voice) { $synth.Voice = $voice }

$asyncOp = $synth.SynthesizeTextToStreamAsync($rawText)
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod 
} | Select-Object -First 1
$asTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$task = $asTask.Invoke($null, @($asyncOp))
$stream = $task.GetAwaiter().GetResult()

$inStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
$outStream = [System.IO.File]::OpenWrite('${targetWav}')
$inStream.CopyTo($outStream)
$inStream.Close()
$outStream.Close()
`;

  return new Promise((resolve) => {
    try {
      const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], { windowsHide: true });

      ps.on('close', () => {
        if (fs.existsSync(targetWav) && fs.statSync(targetWav).size > 0) {
          resolve(targetWav);
        } else {
          legacySapiFallback(text).then(() => resolve(null));
        }
      });
      ps.on('error', () => {
        legacySapiFallback(text).then(() => resolve(null));
      });
    } catch {
      legacySapiFallback(text).then(() => resolve(null));
    }
  });
}

/**
 * Secondary legacy SAPI fallback (for Windows versions without OneCore)
 */
function legacySapiFallback(text) {
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
