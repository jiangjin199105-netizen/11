
export const playNotificationSound = () => {
  try {
    // Check for AudioContext support
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    
    // Create oscillator and gain node
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Sound profile: Sci-fi "chirp"
    // Frequency sweep from 1200Hz to 600Hz very quickly
    osc.type = 'sine';
    const now = ctx.currentTime;
    
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    // Envelope (Attack -> Decay)
    gain.gain.setValueAtTime(0.05, now); // Start quiet
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // Decay

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {
    console.error("Failed to play notification sound", e);
  }
};
