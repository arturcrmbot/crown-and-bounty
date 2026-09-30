/**
 * Full screen, for a phone: the page takes the whole screen, its browser bars gone, and holds itself
 * sideways where the browser allows. Safari on an iPhone lets only videos do that: there, the way to
 * play without the bars is from the Home Screen, as the page's meta tags and manifest let it.
 */
type Prefixed = { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type PrefixedElement = { webkitRequestFullscreen?: () => void };

const page = () => document as Document & Prefixed;
const root = () => document.documentElement as HTMLElement & PrefixedElement;

/** Opened from the Home Screen, as an app: there are no bars to hide. */
export const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const isFullscreen = () => Boolean(page().fullscreenElement ?? page().webkitFullscreenElement);

/** Whether this browser lets a page go full screen at all. */
export const canFullscreen = () => Boolean((page().fullscreenEnabled ?? page().webkitFullscreenEnabled) && (root().requestFullscreen || root().webkitRequestFullscreen));

/** Into full screen (sideways, where it can), or back out. False if this browser can't. */
export async function toggleFullscreen(): Promise<boolean> {
  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else page().webkitExitFullscreen?.();
      return true;
    }
    if (!canFullscreen()) return false;
    const el = root();
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else el.webkitRequestFullscreen?.();
    // Chrome on Android holds the screen sideways once it's full; others say no, and that's fine.
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** What to do instead, where the browser won't go full screen (an iPhone, or a browser inside another app). */
export const homeScreenCard = () => ({
  title: 'Full screen',
  lines: [
    'This browser won\u2019t hide its bars for a game: Safari on an iPhone only does it for videos.',
    'To play on the whole screen, add the game to your **Home Screen**: in Safari, tap **Share** (the square with an arrow), then **Add to Home Screen**, and open it from there. Reading this inside another app? Its menu has **Open in Safari** first.',
    'The game on your Home Screen keeps a save of its own.',
  ],
  choices: [{ label: 'Close', action: { type: 'close' as const } }],
});
