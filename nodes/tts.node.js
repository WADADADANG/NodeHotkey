/**
 * nodes/tts.node.js
 * Action Node: Text-to-Speech (TTS Voice Alert)
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  type: 'tts',
  aliases: ['tts_alert', 'text_to_speech'],
  title: 'Text to Speech',
  category: 'Utility / Alert',
  icon: '🗣️',
  color: '#ec4899',
  inputs: ['in'],
  outputs: ['next', 'onError'],
  defaultData: {
    text: '',
    voice: 'th-TH-PremwadeeNeural',
    volume: 100
  },

  async execute(context, action, callStack = []) {
    try {
      const tts = require('../tts-service');
      const text = String(action.text || action.message || '').trim();
      if (!text) {
        if (typeof global.fireChain === 'function') {
          await global.fireChain(action, 'next', callStack);
        }
        return true;
      }

      const voice = action.voice || 'th-TH-PremwadeeNeural';
      const volume = action.volume !== undefined ? parseInt(action.volume, 10) : 100;

      console.log(`🗣️ [TTS Node] Synthesizing: "${text}" (${voice}, Vol: ${volume}%)`);
      const mp3Path = await tts.synthesize(text, voice);
      if (mp3Path && fs.existsSync(mp3Path)) {
        if (typeof global.playNativeSound === 'function') {
          global.playNativeSound(null, mp3Path, null, 1, volume);
        }
        if (typeof global.broadcastToClients === 'function') {
          global.broadcastToClients({
            type: 'tts_spoken',
            actionId: action.id,
            actionName: action.name,
            text,
            voice,
            audioUrl: `/sounds/tts_cache/${path.basename(mp3Path)}`
          });
        }
      }

      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'next', callStack);
      }
      return true;
    } catch (e) {
      console.error(`⚠️ [TTS Node] Error:`, e.message);
      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onError', callStack);
      }
      return false;
    }
  }
};
