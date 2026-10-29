/** scene-code.ts — joining builder code into a scene (client and tests). */
/**
 * Append builder code to the scene as its own block. The scene so far may end without a newline (saved example sets
 * end in "//@@"): glued onto that, the first new line became part of the marker comment and the rest a syntax error
 * that emptied the whole set (10-29).
 */
export const joinCode = (base: string, add: string) => {
  const a = add.replace(/^\s+/, "").replace(/^\/\/@@[^\n]*\n?/, ""); if (!a.trim()) return base;
  const b = base.replace(/\s+$/, "");
  return b + (/(^|\n)\/\/@@$/.test(b) ? "\n" : "\n//@@\n") + a + (a.endsWith("\n") ? "" : "\n");
};
