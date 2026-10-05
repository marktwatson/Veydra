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
  const found = html.match(/The Client grants\s+(.+?)\s+permission/i);
  const name =
    found?.[1] && found[1] !== "Veydra" ? found[1] : companyName;
  const replacement = modelReleaseParagraph(name, true);
  const grant = /The Client grants[\s\S]*?promotional use\./i;
  let next = grant.test(html) ? html.replace(grant, replacement) : html;
  next = next.replace(
    /\(?\s*Optional:\s*Clients may request in writing to opt out prior to the wedding date\.?\s*\)?/gi,
    "",
  );
  if (!grant.test(html)) {
    next = `${next}<p><strong>Model release opt-out:</strong> ${replacement}</p>`;
  }
  return next;
}
