export type LiveAudioGateResult = {
  chunks: Int16Array[];
  activityStart: boolean;
  activityEnd: boolean;
  speaking: boolean;
};

/**
 * Client-side voice activity gate for Gemini Live sessions.
 *
 * The app disables server-side automatic activity detection and sends
 * explicit activityStart/activityEnd boundaries. This keeps each spoken
 * turn deterministic instead of relying on server VAD to close the turn.
 */
export class LiveAudioGate {
  private speaking = false;
  private silenceMs = 0;
  private readonly preRoll: Int16Array[] = [];

  constructor(
    private readonly threshold = 0.009,
    private readonly endSilenceMs = 700,
    private readonly maxPreRollFrames = 6
  ) {}

  process(pcm: Int16Array, samples: Float32Array, sampleRate: number): LiveAudioGateResult {
    if (!pcm.length || !samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
      return { chunks: [], activityStart: false, activityEnd: false, speaking: this.speaking };
    }

    let energy = 0;
    let peak = 0;
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      const absolute = Math.abs(sample);
      energy += sample * sample;
      if (absolute > peak) peak = absolute;
    }
    const rms = Math.sqrt(energy / samples.length);
    const speechDetected = rms >= this.threshold || (peak >= 0.04 && rms >= this.threshold * 0.62);
    const frameMs = (samples.length / sampleRate) * 1000;

    if (!this.speaking) {
      this.preRoll.push(pcm);
      while (this.preRoll.length > this.maxPreRollFrames) this.preRoll.shift();
      if (!speechDetected) {
        return { chunks: [], activityStart: false, activityEnd: false, speaking: false };
      }

      this.speaking = true;
      this.silenceMs = 0;
      return {
        chunks: this.preRoll.splice(0),
        activityStart: true,
        activityEnd: false,
        speaking: true
      };
    }

    if (speechDetected) {
      this.silenceMs = 0;
      return { chunks: [pcm], activityStart: false, activityEnd: false, speaking: true };
    }

    this.silenceMs += frameMs;
    if (this.silenceMs < this.endSilenceMs) {
      return { chunks: [pcm], activityStart: false, activityEnd: false, speaking: true };
    }

    this.speaking = false;
    this.silenceMs = 0;
    this.preRoll.length = 0;
    return { chunks: [pcm], activityStart: false, activityEnd: true, speaking: false };
  }

  /** Flushes an active utterance when the user mutes or ends the call. */
  finish(): boolean {
    const wasSpeaking = this.speaking;
    this.reset();
    return wasSpeaking;
  }

  reset(): void {
    this.speaking = false;
    this.silenceMs = 0;
    this.preRoll.length = 0;
  }
}
