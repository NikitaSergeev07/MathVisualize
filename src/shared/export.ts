// Frame export (PNG) and short clip recording (WebM via MediaRecorder).
// No external dependencies — everything is built into the browser.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportPng(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${name}-${stamp()}.png`);
  }, 'image/png');
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Pick the best WebM codec the browser supports. */
function pickMime(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!pickMime();
}

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  recording = false;

  constructor(private name: string) {}

  start(canvas: HTMLCanvasElement, fps = 60): boolean {
    const mime = pickMime();
    if (!mime || this.recording) return false;
    const stream = canvas.captureStream(fps);
    this.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      downloadBlob(blob, `${this.name}-${stamp()}.webm`);
      this.chunks = [];
    };
    this.rec.start();
    this.recording = true;
    return true;
  }

  stop(): void {
    if (this.rec && this.recording) {
      this.rec.stop();
      this.recording = false;
      this.rec = null;
    }
  }
}
