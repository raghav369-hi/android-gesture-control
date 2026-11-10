import { analyzeLandmarks, type HandData } from './handData';

const VERSION = '1.2.2';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Landmarker = any;

/**
 * MediaPipe Hand Landmarker wrapper. Frames are analysed locally in the browser;
 * the only network traffic is the one-off download of the (public) model file.
 */
export class HandTracker {
  private constructor(private lm: Landmarker, public delegate: 'GPU' | 'CPU') {}

  static async create(numHands: number): Promise<HandTracker> {
    const mp = await import('@mediapipe/tasks-vision');
    const fileset = await mp.FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: 'GPU' | 'CPU') =>
      mp.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        numHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try { return new HandTracker(await make('GPU'), 'GPU'); }
    catch { return new HandTracker(await make('CPU'), 'CPU'); }
  }

  detect(video: HTMLVideoElement, t: number): HandData[] {
    const res = this.lm.detectForVideo(video, t);
    const aspect = video.videoWidth / Math.max(1, video.videoHeight);
    const hands: HandData[] = [];
    res.landmarks.forEach((lm: { x: number; y: number; z: number }[], i: number) => {
      const cat = res.handedness?.[i]?.[0];
      // Model assumes a mirrored selfie image; the raw front-camera frame is not mirrored => swap.
      const side = cat?.categoryName === 'Left' ? 'Right' : 'Left';
      hands.push(analyzeLandmarks(lm, side, cat?.score ?? 0.8, aspect));
    });
    return hands;
  }

  close() { try { this.lm.close(); } catch { /* already closed */ } }
}
