/**
 * audio-manager.js - NodeHotkey Built-in Audio Engine & Sound Synthesizer
 * Uses Web Audio API for zero-latency preset sounds and supports custom URLs / uploaded files.
 */

class AudioManager {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play sound based on configuration
   * @param {Object} soundConfig - { sourceType, soundPreset, soundUrl, soundFile, volume, repeatCount }
   */
  async play(soundConfig = {}) {
    const sourceType = soundConfig.sourceType || 'preset';
    const volume = typeof soundConfig.volume === 'number' ? Math.max(0, Math.min(1, soundConfig.volume / 100)) : 1.0;
    const repeatCount = Math.max(1, parseInt(soundConfig.repeatCount || 1, 10));

    for (let i = 0; i < repeatCount; i++) {
      if (sourceType === 'preset') {
        const preset = soundConfig.soundPreset || 'ding';
        this.playPreset(preset, volume);
      } else if (sourceType === 'url') {
        const url = soundConfig.soundUrl;
        if (url) this.playAudioFile(url, volume);
      } else if (sourceType === 'upload') {
        const fileUrl = soundConfig.soundFile;
        if (fileUrl) this.playAudioFile(fileUrl, volume);
      }
      if (repeatCount > 1 && i < repeatCount - 1) {
        await new Promise(r => setTimeout(r, 450));
      }
    }
  }

  /**
   * Play preset sound file
   */
  playPreset(preset, volume = 1.0) {
    const cleanPreset = (preset || 'ding').toLowerCase();
    const soundUrl = `/sounds/${cleanPreset}.wav`;
    this.playAudioFile(soundUrl, volume);
  }

  /**
   * Play external audio URL or uploaded file
   */
  playAudioFile(url, volume = 1.0) {
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(err => {
        console.warn('Failed to play audio file:', err);
      });
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }
}

window.audioManager = new AudioManager();

window.testAlertSound = function(nodeId) {
  if (!window.nodeCanvas) return;
  const node = window.nodeCanvas.nodes.find(n => n.id === nodeId);
  const data = node ? (node.data || {}) : {};
  window.audioManager.play({
    sourceType: data.soundSource || 'preset',
    soundPreset: data.soundPreset || 'ding',
    soundUrl: data.soundUrl || '',
    soundFile: data.soundFile || '',
    volume: data.volume !== undefined ? data.volume : 100,
    repeatCount: data.repeatCount || 1
  });
};
