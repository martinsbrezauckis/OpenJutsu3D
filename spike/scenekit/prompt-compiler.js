/**
 * prompt-compiler.js — the render prompt for a shot, built from the scene itself (no LLM call). JS port of
 * bench/compile_prompt.py (same rules, same wording; parity checked on 10-28) for the app's studio page.
 *
 * LTX Layout-To-Render wants "a short prompt that describes the first frame". viewer.visible() reports what the camera
 * sees in frame 0 (objects + screen coverage + material labels); kit.describe() gives setting/style/era/lighting/
 * atmosphere. → ~60–90 words: setting → biggest visible things with materials → surfaces → lighting → atmosphere →
 * camera move in film language → photoreal suffix. Deterministic.
 */
// Film-language phrases for camera-moves.js presets (common film terms).
export const MOVE_PHRASE = {
  'static-shot': 'a locked-off static shot', 'path': 'the camera glides smoothly along a planned path', 'dolly-in': 'the camera dollies in',
  'dolly-out': 'the camera dollies back', 'slow-zoom-in': 'a slow zoom in', 'slow-zoom-out': 'a slow zoom out',
  'crush-zoom': 'a sudden crash zoom in', 'dolly-zoom': 'a vertigo dolly-zoom', 'truck-left': 'the camera trucks left',
  'truck-right': 'the camera trucks right', 'slider-left': 'a slider move left', 'slider-right': 'a slider move right',
  'side-tracking': 'a side-tracking shot', 'tracking': 'the camera tracks forward', 'pedestal-up': 'the camera rises on a pedestal',
  'pedestal-down': 'the camera lowers on a pedestal', 'crane-up': 'a crane shot rising up', 'crane-down': 'a crane shot descending',
  'tilt-up': 'the camera tilts up', 'tilt-down': 'the camera tilts down', 'pan-left': 'the camera pans left',
  'pan-right': 'the camera pans right', 'whip-pan': 'a fast whip pan', 'arc-left': 'the camera arcs to the left',
  'arc-right': 'the camera arcs to the right', 'drone-orbit': 'a drone orbit', 'bullet-time': 'a bullet-time orbit',
  'robot-arm': 'a precise robotic-arm camera move', 'aerial-pullback': 'an aerial pull-back', 'helicopter-shot': 'a helicopter shot',
  'handheld': 'handheld camera', 'pov': 'a first-person POV walk', 'snorricam': 'a snorricam shot', 'rack-focus': 'a rack focus',
};
const STOP = new Set(['env', 'prp', 'mach', 'char', 'main', 'left', 'right', 'front', 'back', 'rear', 'a', 'b', 'c', 'top', 'base', 'set']);

/** 'MACH_rack_gears_02' → 'rack gears' (prefix, numbers and position words dropped). */
export const words = (name) => name.toLowerCase().split('_').filter(p => p && !/^\d+$/.test(p) && !STOP.has(p)).join(' ');

// Previs vocabulary describes our viewport, not the final film — it would steer the render toward grey CG.
const PREVIS = /\b(grey[- ]?box|gray[- ]?box|blockout|block[- ]?out|blocking|clay|previz|previs|mannequins?|placeholder|primitive|low[- ]?poly|untextured|viewport|playblast)\b[\w -]*/i;
// Scene-space coordinates the builder sometimes writes into describe() ("at x -2.48 z 1.8") mean nothing to models.
const COORDS = /\s*(?:\b(?:at|near|around)\s+)?(?:\b[xyz]\s*[=:]?\s*-?\d+(?:\.\d+)?\s*,?\s*){1,3}/gi;

/** Drop previs-only phrases and coordinates from a describe() field; keep the rest of the phrase list. */
export function clean(text) {
  if (!text) return '';
  // Keep a comma the coordinate run swallowed ("…grate at x 1 z 2, drifting…" → "…grate, drifting…").
  let t = String(text).replace(COORDS, (m) => (m.trimEnd().endsWith(',') ? ', ' : ' '));
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  return t.split(',').map(p => p.trim()).filter(p => p && !PREVIS.test(p)).join(', ');
}

// kit.actor motions → how the person moves in the shot.
const ACTION_PHRASE = { idle: 'standing', walk: 'walking', walk_formal: 'walking', jog: 'jogging', sprint: 'running', talk: 'talking',
  sit: 'sitting', sit_talk: 'sitting and talking', dance: 'dancing', crouch: 'crouching', crouch_walk: 'creeping', push: 'pushing',
  torch: 'holding a torch', kneel_fix: 'kneeling at work', swim: 'swimming', wave: 'waving', run: 'running', fight: 'fighting',
  jump: 'jumping', point: 'pointing', clap: 'clapping', read: 'reading', drink: 'drinking', type: 'typing', phone: 'on the phone' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const PERSON = /\b(\w*(er|or|ist|man|men|woman|women|ian|ant|ent|naut|ess)|person|people|child|children|kid|guy|girl|boy|lady|maid|patron|guest|friend|couple|monk|priest|knight|guard|crowd|figure|chef|cook|staff|elder|youth|teen|baby|family|nun|pilot|clerk|host|hero|thief|bride|groom|soldier|cowboy|ninja|samurai|robot|android|alien|zombie|ghost|witch|wizard|king|queen|prince|princess|nurse|chief|captain|tourist|pedestrian|passerby|vendor|cyclist|athlete|student|scientist|artist|musician|dancer|police|officer|detective|spy)s?\b/;

/** The main subject a camera sees — for "cut to … of X": the biggest non-architecture thing, or a person when they fill
 *  at least a quarter as much of the frame (a far-away patron is not what a shot of the barrels is about). */
function subject(visible) {
  const big = visible.find(x => x.category !== 'ENV' && x.cover >= 0.004 && words(x.name));
  const person = visible.find(x => x.category === 'CHAR' && x.cover >= 0.002 && words(x.name));
  const v = person && (!big || person.cover >= 0.25 * big.cover) ? person : big;
  return v ? words(v.name) : '';
}
/** Shot size from the camera's name (CAM_closeup → "a close-up"); other names → "a new angle". */
function shotSize(cam) {
  const w = String(cam || '').toLowerCase();
  return /close/.test(w) ? 'a close-up' : /wide|establish|long/.test(w) ? 'a wide shot' : /medium|mid/.test(w) ? 'a medium shot'
    : /overhead|top|bird|aerial/.test(w) ? 'an overhead shot' : /low/.test(w) ? 'a low-angle shot' : 'a new angle';
}
/**
 * The camera sentence. Recipe "dolly-in:4+arc-left:6:2.5" → "The camera dollies in, then the camera arcs …".
 * Camera cuts ("…+arc-left:2@CAM_closeup", opts.cuts = {segment index: {cam, visible}} from the viewer) read as shots in
 * order: "The camera dollies in; cut to a close-up of the bar counter as the camera arcs to the left".
 * opts.span = [first, last] recipe segment a long-shot part covers (default: all).
 */
export function moveSentence(move, opts = {}) {
  const segs = move.split('+'), [a, b] = opts.span || [0, segs.length - 1], cuts = opts.cuts || {};
  let out = '';
  for (let k = a; k <= b && k < segs.length; k++) {
    const name = segs[k].split('@')[0].split(':')[0], phrase = MOVE_PHRASE[name] || name;
    if (k > a && cuts[k]) {
      const sub = subject(cuts[k].visible || []), size = shotSize(cuts[k].cam);
      const shotWords = sub ? `${size}${size === 'a new angle' ? ' on' : ' of'} the ${sub}` : size;
      out += `; cut to ${shotWords}${/^the camera /.test(phrase) ? ' as ' : ', '}${phrase}`;
    } else out += (k > a ? ', then ' : '') + phrase;
  }
  return out[0].toUpperCase() + out.slice(1).toLowerCase() + '.';   // Python str.capitalize()
}

export function compilePrompt(meta0, visible, move, maxItems = 5, opts = {}) {
  const meta = Object.fromEntries(Object.entries(meta0 || {}).map(([k, v]) => [k, typeof v === 'string' ? clean(v) : v]));
  const setting = meta.setting || meta.title || 'a cinematic set';
  const head = [setting, meta.style, meta.era].filter(Boolean).map((x, i) => (i ? x[0].toLowerCase() + x.slice(1) : x)).join(', ');
  const things = [], seen = new Set();
  // People first and always (any visible size): a person missing from the prompt stays a grey mannequin in the
  // render (reading room 10-29: the seated reader was not among the 5 biggest things). Same kind of person = counted
  // ("two cloaked travellers walking").
  const people = new Map();
  for (const v of visible) {
    if (v.category !== 'CHAR' || v.cover < 0.0005) continue;
    let w = words(v.name); const act = v.action && ACTION_PHRASE[v.action];
    if (!w) continue;
    // an imported character is named after its file ("Remy" from Mixamo): "a remy waving" means nothing to the video
    // model, "a person called Remy waving" does (10-29). Role words (maid, innkeeper, astronaut…) stay as they are.
    if (!PERSON.test(w)) w = w.includes(' ') ? `${w} person` : `person called ${cap(w)}`;
    const key = `${w}|${act || ''}`, e = people.get(key) || { w, act, action: v.action, n: 0 }; e.n++; people.set(key, e);
  }
  const NUM = ['', 'a', 'two', 'three', 'four', 'five', 'six'];
  for (const e of people.values()) {
    const actWord = e.act && !e.w.includes(String(e.action).split('_')[0]) ? ' ' + e.act : '';
    const head = e.w.split(' '), last = head.length - 1;
    // plural on the noun: the first word that is a person noun, else the last word ("traveller" → "travellers")
    if (e.n > 1) { const i = head.findIndex((x) => /(er|or|ist|man|woman|ian|ant|ent|child|guest|patron|maid|girl|boy|friend|couple|monk|priest|knight|guard)$/.test(x)); const k = i >= 0 ? i : last;
      head[k] = /man$/.test(head[k]) ? head[k].replace(/man$/, 'men') : /child$/.test(head[k]) ? head[k] + 'ren' : head[k] + 's'; }
    things.push(`${e.n > 1 ? NUM[Math.min(e.n, 6)] || 'several' : /^[aeiou]/.test(head[0]) ? 'an' : 'a'} ${head.join(' ')}${actWord}`);
    seen.add(e.w);
  }
  for (const v of visible) {
    if (v.category === 'ENV' || v.category === 'CHAR' || v.cover < 0.004) continue;   // walls/floor are implied by the setting
    const w = words(v.name);
    if (!w || seen.has(w)) continue;
    seen.add(w);
    if (things.length >= maxItems + people.size) break;
    const mats = v.labels.filter(m => m && m !== 'person').slice(0, 1).map(m => m.replace(/_/g, ' '));
    things.push(mats.length ? `${w} of ${mats.join(' and ')}` : w);
    if (things.length >= maxItems + people.size) break;
  }
  const surfaces = [];
  for (const v of visible.filter(v => v.category === 'ENV').slice(0, 3)) surfaces.push(...v.labels.map(m => m.replace(/_/g, ' ')));
  const parts = [cap(head) + '.'];
  if (things.length) parts.push('In view: ' + things.join('; ') + '.');
  if (surfaces.length) parts.push('Surfaces: ' + [...new Set(surfaces)].slice(0, 3).join(', ') + '.');
  if (meta.lighting) parts.push(`Lighting: ${meta.lighting}.`);
  if (meta.atmosphere) parts.push(`${cap(meta.atmosphere)}.`);
  parts.push(moveSentence(move, opts));
  parts.push('Photoreal live-action cinematography, natural materials, film grain.');
  return parts.join(' ');
}
