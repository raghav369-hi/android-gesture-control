import { setPerm } from './store';

async function probe(kind: 'camera' | 'mic'): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser/context does not expose media devices (HTTPS is required).';
  try {
    const s = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: { facingMode: 'user' } } : { audio: true });
    s.getTracks().forEach((t) => t.stop()); // permission only - release immediately
    setPerm(kind, 'granted');
    return null;
  } catch (e) {
    const n = (e as { name?: string }).name;
    setPerm(kind, n === 'NotAllowedError' ? 'denied' : 'unknown');
    if (n === 'NotAllowedError') return 'Permission denied. You can change this in the browser/site settings.';
    if (n === 'NotFoundError') return `No ${kind === 'camera' ? 'camera' : 'microphone'} found.`;
    if (n === 'NotReadableError') return `The ${kind === 'camera' ? 'camera' : 'microphone'} is in use by another app.`;
    return e instanceof Error ? e.message : 'Unknown error';
  }
}
export const requestCamera = () => probe('camera');
export const requestMic = () => probe('mic');

export async function refreshPermissionState() {
  try {
    for (const [name, key] of [['camera', 'camera'], ['microphone', 'mic']] as const) {
      const st = await navigator.permissions.query({ name: name as PermissionName });
      setPerm(key, st.state === 'granted' ? 'granted' : st.state === 'denied' ? 'denied' : 'unknown');
    }
  } catch { /* Permissions API for camera/mic not supported */ }
}
