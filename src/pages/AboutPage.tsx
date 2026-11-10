import { Card, Notice, SectionTitle } from '../components/ui';

const Item = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <li className="flex gap-2"><span className="text-emerald-400">✓</span><span><b className="text-white">{t}</b> {children}</span></li>
);

export default function AboutPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Privacy &amp; About</h2>

      <Card>
        <SectionTitle>Privacy first</SectionTitle>
        <ul className="space-y-2 text-sm text-slate-300">
          <Item t="Camera frames stay on this device.">They are analysed locally by MediaPipe Hand Landmarker and never uploaded.</Item>
          <Item t="Microphone audio stays on this device.">The clap detector only measures loudness spikes; nothing is recorded, saved or sent, and there is no speech recognition.</Item>
          <Item t="No camera footage or audio is stored.">Only numbers from the current frame are kept in memory, and they are discarded immediately.</Item>
          <Item t="No account, no analytics, no tracking.">Your gestures, macros and settings are stored in local storage on this device only.</Item>
          <Item t="Camera is off when idle.">Turning gesture control off stops the stream, closes the hand-tracking model and releases the camera.</Item>
        </ul>
        <div className="mt-3 text-xs text-slate-500">Network note: the first time hand tracking starts, the public MediaPipe model/WASM files are downloaded (nothing from you is sent). The camera/mic status dots on the simulated phone mimic Android's privacy indicators.</div>
      </Card>

      <Card>
        <SectionTitle>What this build is</SectionTitle>
        <Notice tone="amber">
          This is a <b>working browser prototype</b> of the Gesture Controller, not an installable APK. The environment it was built in has no JDK, Gradle or Android SDK, so an APK could not be compiled or tested. Real camera hand tracking, clap detection, gesture recognition, mapping, macros and the builder run for real; Android actions run against a simulated phone.
        </Notice>
        <div className="mt-3 text-sm text-slate-300">How the pieces map onto a native Android implementation:</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400"><tr><th className="py-1 pr-3">This prototype</th><th className="py-1">Native Android equivalent</th></tr></thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {[
                ['lib/handTracker.ts (MediaPipe Tasks Vision, web)', 'MediaPipe Tasks Vision HandLandmarker + CameraX ImageAnalysis (STRATEGY_KEEP_ONLY_LATEST)'],
                ['lib/gestureEngine.ts (GestureDetector)', 'GestureEngine : GestureDetector (pure Kotlin, unit-testable)'],
                ['lib/store.ts + localStorage', 'Room entities (GestureProfile, ActionMapping, Macro) + DataStore settings'],
                ['lib/actionExecutor.ts (ActionExecutor)', 'ActionExecutor backed by AccessibilityService.performGlobalAction / dispatchGesture, AudioManager'],
                ['lib/clapDetector.ts (WebAudio)', 'AudioRecord energy-onset detector in a microphone foreground service'],
                ['lib/controller.ts', 'GestureControlService (foreground service: camera + microphone types, notification with Disable)'],
                ['Simulated phone', 'The real device'],
              ].map(([a, b]) => <tr key={a}><td className="py-1.5 pr-3 align-top">{a}</td><td className="py-1.5 align-top">{b}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Android limits we respect</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
          <li>Home/Back/Recents/Notifications/Quick settings/Power menu/Lock screen use Accessibility global actions only (API-level gated).</li>
          <li>Taps, swipes and scrolling use <code>dispatchGesture</code> / scroll node actions (Android 7+).</li>
          <li>Android never lets an app unlock the phone or bypass the lock screen. “Wake screen” turns the display on only.</li>
          <li>Brightness needs the user to grant “Modify system settings”.</li>
          <li>Since Android 14, camera/microphone foreground services must be started while the app is visible or by an allowed trigger - a clap-started camera on newer versions may need the user to bring the app forward. Unsupported cases are reported, never faked.</li>
          <li>Accessibility must be enabled by the user in Settings; the app only guides them there.</li>
        </ul>
      </Card>
    </div>
  );
}
