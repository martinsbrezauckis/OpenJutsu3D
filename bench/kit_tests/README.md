# Scene-kit node tests (figures: dress, wear on bones, carry, pacing, turns)

Run outside the app with three.js installed (the app loads three from a CDN, so `web/` has no copy):

```bash
R=$(git rev-parse --show-toplevel)   # from inside the repo
d=$(mktemp -d) && cd "$d" && npm i three@0.186.1 >/dev/null
cp "$R"/spike/scenekit/{kit.js,floaters.js,materials.json} "$R"/bench/kit_tests/*.mjs .
for t in dress_test carry_test turn_test; do node $t.mjs "$R"/spike/scenekit/assets/characters/mannequin.glb; done
```

Each prints PASS/FAIL lines and exits non-zero on any failure.
