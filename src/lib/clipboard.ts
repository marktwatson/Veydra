/** Copy text to clipboard with a legacy fallback. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  const fallbackCopy = (): boolean => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
    return ok;
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy();
  } catch {
    return fallbackCopy();
  }
}
