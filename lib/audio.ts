/**
 * สร้างเสียงแจ้งเตือน Pomodoro Bell/Chime โดยใช้ Web Audio API
 * ไม่ต้องพึ่งพาไฟล์เสียงภายนอก ทำงานได้ 100% บนทุกเบราว์เซอร์
 */
export function playPomodoroChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // เล่นคอร์ดระฆัง 3 โน้ต (A4 -> C#5 -> E5 -> A5) ให้ความรู้สึกผ่อนคลายและแจ้งเตือนชัดเจน
    const frequencies = [440, 554.37, 659.25, 880];

    frequencies.forEach((freq, index) => {
      const startTime = ctx.currentTime + index * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Volume envelope (Fade in แล้วค่อยๆ Fade out เหมือนเสียงระฆัง)
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.2);
    });
  } catch (e) {
    console.warn("ไม่สามารถเล่นเสียง Web Audio ได้:", e);
  }
}
