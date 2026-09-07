// navigator.clipboard.writeText silently does nothing (via the `?.` in the
// call sites that used it) when the Clipboard API isn't available or throws
// — which happens more often than it should inside iOS "Add to Home
// Screen" standalone web apps and various in-app browsers (Telegram,
// Trust Wallet's own in-app browser, etc). The user sees no error and no
// copy, and has no way to tell which one happened. This tries the modern
// API first, falls back to the old execCommand('copy') trick via a hidden
// textarea, and reports back honestly which one (if either) worked so the
// caller can show the right toast.
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy method below
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '-1000px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
