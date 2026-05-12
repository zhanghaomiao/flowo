/**
 * Clipboard helpers that work in dev over http://LAN_IP (non-secure context),
 * where navigator.clipboard.writeText is unavailable or rejected.
 */

/**
 * Copy using a temporary textarea. Works on http://LAN_IP where the
 * Clipboard API is blocked.
 */
export function legacyCopyToClipboard(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '2em';
  ta.style.height = '2em';
  ta.style.padding = '0';
  ta.style.margin = '0';
  ta.style.border = 'none';
  ta.style.outline = 'none';
  ta.style.boxShadow = 'none';
  ta.style.background = 'transparent';
  ta.style.opacity = '0';
  ta.style.zIndex = '2147483647';
  document.body.appendChild(ta);
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/** Returns true if the string was copied successfully. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const canUseClipboardApi =
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    Boolean(navigator.clipboard?.writeText);

  if (canUseClipboardApi) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy */
    }
  }
  return legacyCopyToClipboard(text);
}
