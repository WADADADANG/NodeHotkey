/**
 * nodes/sound.node.js
 * Action Node: Sound Alert
 * 
 * Plays audio alerts from presets, local files, or remote URLs.
 */

module.exports = {
  type: 'sound',
  aliases: ['sound_alert'],
  title: 'Sound Alert',
  category: 'Utility / Alert',
  icon: '🔊',
  color: '#f59e0b',
  inputs: ['in'],
  outputs: ['onFired'],
  defaultData: {
    soundSource: 'preset',
    soundPreset: 'ding',
    soundUrl: '',
    soundFile: '',
    repeatCount: 1,
    volume: 100
  },
  schema: [
    {
      key: 'soundPreset', component: 'select', labelKey: 'inspector_sound_preset', label: 'Preset Sound Effect',
      options: [
        { value: 'ding', label: '🔔 Ding (Crystal High)' },
        { value: 'chime', label: '✨ Chime (Ascending)' },
        { value: 'alert', label: '⚠️ Alert (Attention Pulse)' },
        { value: 'notification', label: '💬 Notification (Pop)' },
        { value: 'success', label: '🎉 Success (Victory)' },
        { value: 'error', label: '❌ Error (Low Tone)' }
      ]
    },
    { key: 'volume', component: 'slider', labelKey: 'inspector_sound_volume', label: 'Volume (%)', min: 10, max: 100, step: 5, unit: '%' },
    { key: 'repeatCount', component: 'number_input', labelKey: 'inspector_sound_repeat', label: 'Repeat Count (รอบเล่นซ้ำ)', min: 1, max: 10, step: 1 }
  ],
  summaryFields: [
    { key: 'soundPreset', label: 'Sound', format: '{value}' },
    { key: 'volume', label: 'Vol', format: '{value}%' },
    { key: 'repeatCount', label: 'Repeat', format: '{value}x' }
  ],

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    const source = action.soundSource || 'preset';
    const preset = action.soundPreset || 'ding';
    const url = action.soundUrl || '';
    const file = action.soundFile || '';
    const repeat = action.repeatCount || 1;
    const volume = action.volume !== undefined ? parseInt(action.volume, 10) : 100;

    if (volume <= 0) {
      console.log(`[Sound Node] "${action.name}" skipped (Volume: 0%)`);
      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onFired', callStack);
      }
      return true;
    }

    console.log(`[Sound Node] Playing: "${action.name}" (Type: ${source}, Preset: ${preset}, Vol: ${volume}%)`);
    if (typeof global.playNativeSound === 'function') {
      global.playNativeSound(preset, url, file, repeat, volume, 'sfx', action.interrupt !== false);
    } else {
      console.warn('[Sound Node] global.playNativeSound is not initialized.');
    }

    if (typeof global.fireChain === 'function') {
      await global.fireChain(action, 'onFired', callStack);
    }
    return true;
  }
};
