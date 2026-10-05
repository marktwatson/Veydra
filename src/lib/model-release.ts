export function modelReleaseParagraph(companyName: string, optedOut: boolean) {
  if (optedOut) {
    return `${companyName} will not use images or video from this event for portfolio, social media, website, or other promotional use. This does not limit delivery of the Client's own gallery and film.`;
  }
  return `The Client grants ${companyName} permission to use images and/or video clips from the event for portfolio, social media, website, and promotional use.`;
}

/** Swap the standard model-release sentence when the couple opts out. */
export function applyModelRelease(
  html: string,
  companyName: string,
  optedOut: boolean,
) {
  if (!optedOut || !html) return html;
  const replacement = modelReleaseParagraph(companyName, true);
  const grant = /The Client grants[\s\S]*?promotional use\./i;
  if (grant.test(html)) return html.replace(grant, replacement);
  return `${html}<p><strong>Model release opt-out:</strong> ${replacement}</p>`;
}
