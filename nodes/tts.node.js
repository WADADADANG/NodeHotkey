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
  inputs: ['in', 'text_in'],
  outputs: ['next', 'onError'],
  defaultData: {
    text: '',
    voice: 'th-TH-PremwadeeNeural',
    volume: 100
  },
  schema: [
    { key: 'text', component: 'textarea', labelKey: 'inspector_tts_text', label: 'Speech Text (ข้อความพูด)', placeholder: 'เช่น บอสเกิดแล้ว, ฮีลเลือดด่วน' },
    {
      key: 'voice', component: 'select', labelKey: 'inspector_tts_voice', label: 'Voice Model (เสียงพูด)',
      options: [
        { value: 'th-TH-PremwadeeNeural', label: '🇹🇭 Premwadee (Thai - Female / ผู้หญิง)' },
        { value: 'th-TH-NiwatNeural', label: '🇹🇭 Niwat (Thai - Male / ผู้ชาย)' },
        { value: 'en-US-JennyNeural', label: '🇺🇸 Jenny (English - Female)' },
        { value: 'en-US-GuyNeural', label: '🇺🇸 Guy (English - Male)' }
      ]
    },
    { key: 'volume', component: 'slider', labelKey: 'inspector_tts_volume', label: 'Volume (ระดับเสียง %)', min: 10, max: 100, step: 5, unit: '%' }
  ],
  summaryFields: [
    { key: 'text', label: 'Speech', format: val => val ? (val.length > 20 ? val.substring(0, 18) + '...' : val) : '(From Pin)' },
    { key: 'voice', label: 'Voice', format: val => (val || '').includes('Premwadee') ? 'Premwadee' : ((val || '').includes('Niwat') ? 'Niwat' : (val || 'Default')) },
    { key: 'volume', label: 'Vol', format: '{value}%' }
  ],

  async execute(context, action, callStack = []) {
    try {
      const tts = require('../tts-service');

      // 1. Resolve dynamic text from incoming data wire ('text_in' or 'msg_in') if available
      let resolvedText = null;
      if (typeof global.resolveNodeInputData === 'function') {
        resolvedText = global.resolveNodeInputData(action, 'text_in');
        if (resolvedText === null || resolvedText === undefined || resolvedText === '') {
          resolvedText = global.resolveNodeInputData(action, 'msg_in');
        }
      }

      // 2. Fallback to static text configured in Inspector
      if (resolvedText === null || resolvedText === undefined || resolvedText === '') {
        resolvedText = action.text !== undefined ? action.text : (action.message || '');
      }

      const text = String(resolvedText || '').trim();
      if (!text) {
        if (typeof global.fireChain === 'function') {
          await global.fireChain(action, 'next', callStack);
        }
        return true;
      }

      const voice = action.voice || 'th-TH-PremwadeeNeural';
      const volume = action.volume !== undefined ? parseInt(action.volume, 10) : 100;

      // Debounce rapid identical triggers (250ms window)
      const now = Date.now();
      if (now - (tts._lastTime || 0) < 250 && tts._lastText === text) {
        return true;
      }
      tts._lastTime = now;
      tts._lastText = text;

      console.log(`[TTS Node] Synthesizing: "${text}" (${voice}, Vol: ${volume}%)`);
      const mp3Path = await tts.synthesize(text, voice);
      if (mp3Path && fs.existsSync(mp3Path)) {
        if (typeof global.playNativeSound === 'function') {
          global.playNativeSound(null, mp3Path, null, 1, volume, 'tts', action.interrupt !== false);
        } else {
          console.warn('[TTS Node] global.playNativeSound is not initialized.');
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
      console.error(`[TTS Node] Error:`, e.message);
      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onError', callStack);
      }
      return false;
    }
  }
};
