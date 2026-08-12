/**
 * chime.ts — the sound played when a phase ends.
 *
 * ## Why there's no .mp3 file
 *
 * The sound is generated with the Web Audio API rather than loaded from a file.
 * That means no asset to download, no format-support questions, nothing to fail
 * on a slow connection at exactly the moment we need it, and a couple of
 * kilobytes of code instead of a couple hundred kilobytes of audio.
 *
 * The cost is that the palette is limited to what you can build from
 * oscillators. For a two-note chime that's plenty.
 *
 * ## The autoplay policy, which is the real constraint here
 *
 * Browsers refuse to play audio until the user has interacted with the page.
 * This exists because of a decade of pages that blared adverts at you on load,
 * and it is not negotiable — an AudioContext created without a user gesture
 * starts in a "suspended" state and stays there.
 *
 * The consequence for a timer is specific and easy to get wrong: the moment we
 * want to make sound (25 minutes in, when the phase ends) is NOT a user
 * gesture. So we cannot create the audio context then. We have to create and
 * unlock it during a click the user already made — pressing Start — and keep it
 * alive until it's needed.
 *
 * That's what `unlockAudio()` is for, and why TimerProvider calls it from the
 * start handler rather than on mount.
 */

/**
 * The one audio context, created lazily on first user gesture.
 *
 * Module-level rather than per-call because browsers limit how many audio
 * contexts a page may create, and because the whole point is that this one
 * survives from the unlocking gesture until the chime plays much later.
 */
let audioContext: AudioContext | null = null;

/**
 * Prepare audio for later playback. Must be called from a user gesture.
 *
 * Safe to call repeatedly — after the first time it's nearly free.
 */
export function unlockAudio(): void {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    // A context can fall back to "suspended" later (some browsers suspend it
    // when a tab is backgrounded for a long time), so we resume rather than
    // assuming the first unlock holds forever.
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
  } catch {
    // Web Audio unavailable. Sound simply won't work; nothing else should break.
    audioContext = null;
  }
}

/**
 * Play a short chime.
 *
 * Two rising notes to mark the end of focus (a small "well done" shape), two
 * falling notes to mark the end of a break (a "back to it" shape). Different
 * enough that you can tell which happened without looking at the screen — which
 * is the entire purpose, since if you were looking you wouldn't need a sound.
 */
export function playChime(kind: "workEnded" | "breakEnded"): void {
  if (!audioContext || audioContext.state !== "running") {
    // Never unlocked, or blocked. Silence is the correct failure here — better
    // than throwing and taking the phase transition down with it.
    return;
  }

  const ctx = audioContext;
  const now = ctx.currentTime;

  // Frequencies in hertz. C5, E5, G5 is a major chord — deliberately pleasant,
  // because you're going to hear this many times a day.
  const notes = kind === "workEnded" ? [523.25, 783.99] : [659.25, 440.0];

  notes.forEach((frequency, index) => {
    const startAt = now + index * 0.18;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    // A sine wave is the softest option. Square and sawtooth are harsh and
    // would get irritating fast.
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    /**
     * The volume envelope, which matters more than it sounds like it should.
     *
     * Starting or stopping a tone abruptly produces an audible click — the
     * waveform jumps discontinuously, and your ear hears that jump as a pop. So
     * the volume ramps up over 20ms and decays smoothly rather than switching
     * on and off.
     *
     * The decay uses exponentialRampToValueAtTime because loudness is perceived
     * logarithmically — an exponential fade sounds linear to a human ear, while
     * a linear fade sounds like it drops off a cliff at the end. It can't target
     * exactly 0 (an exponential curve never reaches zero), hence 0.0001.
     */
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.18, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.5);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    // Stopping releases the node. Without this they'd accumulate for the life
    // of the page — a slow leak that only shows up after a long study session.
    oscillator.stop(startAt + 0.55);
  });
}

/** Whether audio has been unlocked and is ready. Used by the settings UI. */
export function isAudioReady(): boolean {
  return audioContext?.state === "running";
}
