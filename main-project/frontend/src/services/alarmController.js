// --------------------------------------------------
// alarmController.js
// Handles Web Audio API synthesized siren sound for
// browser security compliance (autoplay restriction bypass)
// and network isolation reliability (no static file request).
// --------------------------------------------------

let audioCtx = null;
let osc1 = null;
let lfo = null;
let gainNode = null;
let active = false;

export const alarmController = {
  /**
   * Safe initialization of AudioContext on user gesture
   */
  init() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (e) {
      console.warn("[AlarmController] Failed to initialize AudioContext:", e);
    }
  },

  /**
   * Start the wailing siren oscillation
   */
  play() {
    this.init();
    if (active) return;

    try {
      if (!audioCtx) return;

      gainNode = audioCtx.createGain();
      // Keep volume moderate and non-obtrusive (12% gain)
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);

      osc1 = audioCtx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(750, audioCtx.currentTime); // Base siren frequency: 750Hz

      lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(2.2, audioCtx.currentTime); // Wail frequency modulation speed: 2.2Hz

      const lfoGain = audioCtx.createGain();
      lfoGain.gain.setValueAtTime(150, audioCtx.currentTime); // Frequency swing: +/- 150Hz (600Hz - 900Hz wail)

      // Connect LFO modulation to base oscillator frequency
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);

      // Connect wailing oscillator to destination master output
      osc1.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start();
      lfo.start();
      active = true;
      console.log("[AlarmController] Wailing emergency alarm triggered.");
    } catch (e) {
      console.error("[AlarmController] Failed to start wailing audio oscillator:", e);
    }
  },

  /**
   * Stop wailing and clean up nodes
   */
  stop() {
    try {
      if (osc1) {
        osc1.stop();
        osc1 = null;
      }
      if (lfo) {
        lfo.stop();
        lfo = null;
      }
      if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
      }
      active = false;
      console.log("[AlarmController] Siren stopped.");
    } catch (e) {
      console.error("[AlarmController] Failed to stop wailing audio oscillator:", e);
    }
  },

  /**
   * Return playing state of the alarm
   */
  isSounding() {
    return active;
  }
};
