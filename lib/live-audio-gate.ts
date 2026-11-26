export type LiveAudioGateResult = {
  chunks: Int16Array[];
  audioStreamEnd: boolean;
  speaking: boolean;
};

/**
 * Hybrid voice-activity gate for live microphone streams.
 *
 * It keeps server-side VAD enabled, sends a short pre-roll before detected
 * speech, and stops transmitting microphone silence. After a sustained pause
 * it emits audioStreamEnd so Gemini can flush the completed utterance.
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
      return { chunks: [], audioStreamEnd: false, speaking: this.speaking };
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
    // The peak clause retains quiet consonants and speech onsets without
    // treating isolated low-level microphone noise as continuous speech.
    const speechDetected = rms >= this.threshold || (peak >= 0.04 && rms >= this.threshold * 0.62);
    const frameMs = (samples.length / sampleRate) * 1000;

    if (!this.speaking) {
      this.preRoll.push(pcm);
      while (this.preRoll.length > this.maxPreRollFrames) this.preRoll.shift();
      if (!speechDetected) {
        return { chunks: [], audioStreamEnd: false, speaking: false };
      }

      this.speaking = true;
      this.silenceMs = 0;
      const chunks = this.preRoll.splice(0);
      return { chunks, audioStreamEnd: false, speaking: true };
    }

    if (speechDetected) {
      this.silenceMs = 0;
      return { chunks: [pcm], audioStreamEnd: false, speaking: true };
    }

    this.silenceMs += frameMs;
    if (this.silenceMs < this.endSilenceMs) {
      return { chunks: [pcm], audioStreamEnd: false, speaking: true };
    }

    this.speaking = false;
    this.silenceMs = 0;
    this.preRoll.length = 0;
    return { chunks: [pcm], audioStreamEnd: true, speaking: false };
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
