// A lightweight first line of defense — not a substitute for real content
// moderation (that needs an API like AWS Rekognition/Google Vision for
// photos, which needs your own API key to wire up). This just catches
// obvious, blatant misuse of the free-text fields so it gets a human's eyes
// on it before/alongside going live, rather than assuming free text is safe
// because the category dropdown is fixed.
const FLAGGED_TERMS = [
  // drugs / controlled substances
  'cocaine', 'heroin', 'fentanyl', 'meth', 'mdma', 'lsd', 'xanax bars', 'oxy pills', 'percocet',
  // weapons
  'firearm', 'handgun', 'ammunition', 'glock', 'ghost gun',
  // other clearly out-of-scope illegal goods/services
  'counterfeit', 'stolen goods', 'fake id', 'escort service',
];

export function containsFlaggedContent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FLAGGED_TERMS.some(term => lower.includes(term));
}
