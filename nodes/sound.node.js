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
