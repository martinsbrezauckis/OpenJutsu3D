/**
 * shot-intent.ts — read the shot a person asks for in plain words ("an 8 second 360-degree orbit", "slow dolly in
 * for 5 s, then crane up", "film it") without a model call: Higgsfield takes the camera move and duration from the
 * prompt and renders from the chat, so the studio pre-fills the shot bar from the same words (audit 10-29).
 * Pure function, shared by the client (home prompt + chat) and tests. Returns null when no camera words are found.
 */
export type ShotIntent = { recipe: { move: string; seconds: number }[]; render: boolean };

// Phrase → move, most specific first (the first match at a text position wins).
const PHRASES: [RegExp, string][] = [
  [/\b(360|full)[- ]?(degree|°)?\s*(orbit|turn|spin|rotation)|\borbit(s|ing)?\b(?! left| right)|\bcircl(e|es|ing) (around|the)\b/i, "drone-orbit"],
  [/\bbullet[- ]?time\b|\bfrozen moment\b/i, "bullet-time"],
  [/\bdolly[- ]?zoom\b|\bvertigo\b/i, "dolly-zoom"],
  [/\bcrash[- ]?zoom\b|\bcrush[- ]?zoom\b|\bsnap zoom\b/i, "crush-zoom"],
  [/\b(aerial|drone) pull[- ]?(back|out)\b|\breveal(s|ing)? the (whole|entire)\b/i, "aerial-pullback"],
  [/\bhelicopter\b|\bfly[- ]?over\b|\bflyover\b/i, "helicopter-shot"],
  [/\bdolly[- ]?(in|forward)\b|\bpush[- ]?in\b|\bmove[sd]? (in|closer|towards?)\b|\bapproach(es|ing)?\b/i, "dolly-in"],
  [/\bdolly[- ]?(out|back)\b|\bpull[- ]?(back|out)\b(?! aerial)|\bmove[sd]? (back|away)\b/i, "dolly-out"],
  [/\bslow zoom[- ]?in\b|\bzoom(s|ing)?[- ]?in\b/i, "slow-zoom-in"],
  [/\bslow zoom[- ]?out\b|\bzoom(s|ing)?[- ]?out\b/i, "slow-zoom-out"],
  [/\bcrane[- ]?up\b|\b(rise|rises|rising|lift(s|ing)?)\b.*\b(above|over|up)\b|\bboom up\b/i, "crane-up"],
  [/\bcrane[- ]?down\b|\b(descend(s|ing)?|lower(s|ing)?)\b|\bboom down\b/i, "crane-down"],
  [/\bpedestal[- ]?up\b/i, "pedestal-up"], [/\bpedestal[- ]?down\b/i, "pedestal-down"],
  [/\btilt[- ]?up\b/i, "tilt-up"], [/\btilt[- ]?down\b/i, "tilt-down"],
  [/\bwhip[- ]?pan\b/i, "whip-pan"], [/\bpan[- ]?left\b/i, "pan-left"], [/\bpan[- ]?right\b/i, "pan-right"],
  [/\barc(s|ing)?[- ]?left\b|\borbit(s|ing)? left\b/i, "arc-left"], [/\barc(s|ing)?[- ]?right\b|\borbit(s|ing)? right\b/i, "arc-right"],
  [/\btruck[- ]?left\b/i, "truck-left"], [/\btruck[- ]?right\b/i, "truck-right"],
  [/\bslider?[- ]?left\b/i, "slider-left"], [/\bslider?[- ]?right\b/i, "slider-right"],
  [/\bside[- ]?tracking\b|\btrack(s|ing)? (alongside|beside)\b/i, "side-tracking"],
  [/\btracking shot\b|\bfollow(s|ing)? (him|her|them|the)\b/i, "tracking"],
  [/\brobot(ic)?[- ]?arm\b/i, "robot-arm"], [/\bhand[- ]?held\b|\bshaky\b/i, "handheld"],
  [/\bpov\b|\bpoint[- ]of[- ]view\b|\bfirst[- ]person\b/i, "pov"], [/\bsnorri[- ]?cam\b/i, "snorricam"],
  [/\brack[- ]?focus\b|\bfocus pull\b/i, "rack-focus"],
  [/\bstatic (shot|camera)\b|\blocked[- ]off\b|\bstill camera\b/i, "static-shot"],
];
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, thirty: 30, sixty: 60 };
const SECONDS = /\b(\d{1,2}(?:\.\d)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|sixty)[- ]?(s|sec|secs|second|seconds)\b|\b(a|one|half a) minute\b/gi;
const RENDER = /\b(render|film|shoot|record|make (the |a )?(video|clip|shot)|turn it into (a )?video)\b/i;

export function shotIntent(text: string, maxSeconds = 60): ShotIntent | null {
  const t = String(text || "").slice(0, 2000);
  // moves in the order they are written
  // a span already claimed by a more specific phrase ("aerial pullback") is not read again ("pull back")
  const found: { at: number; end: number; move: string }[] = [];
  for (const [re, move] of PHRASES) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of t.matchAll(g)) {
      const at = m.index ?? 0, end = at + m[0].length;
      if (!found.some((f) => at < f.end && end > f.at)) found.push({ at, end, move });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const moves = found.filter((f, i) => i === 0 || f.move !== found[i - 1].move);
  // durations in the order they are written; "a minute" = 60
  const secs = [...t.matchAll(SECONDS)].map((m) => (m[3] ? (m[3].toLowerCase() === "half a" ? 30 : 60) : WORDS[m[1].toLowerCase()] ?? Number(m[1])));
  const render = RENDER.test(t);
  if (!moves.length && !secs.length) return render ? { recipe: [], render } : null;
  const list = moves.length ? moves.map((f) => f.move) : ["dolly-in"];
  // one duration for one move; several durations pair up in order; one total for several moves splits evenly
  let recipe = list.map((move, i) => ({ move, seconds: secs.length === list.length ? secs[i] : secs.length === 1 ? Math.max(1, Math.round(secs[0] / list.length)) : 4 }));
  recipe = recipe.map((r) => ({ ...r, seconds: Math.max(1, Math.min(maxSeconds, Math.round(r.seconds))) }));
  let total = recipe.reduce((s, r) => s + r.seconds, 0);
  while (total > maxSeconds && recipe.length > 1) {   // over the limit: shorten, then drop, the last moves
    const last = recipe[recipe.length - 1], over = total - maxSeconds;
    if (last.seconds - 1 >= over) { last.seconds -= over; total -= over; } else { total -= last.seconds; recipe.pop(); }
  }
  return { recipe, render };
}
