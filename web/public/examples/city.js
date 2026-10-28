kit.describe({
  title: 'Medieval Walled City at Golden Hour',
  setting: 'Dense 14th-century medieval walled river city with a towering Gothic cathedral at the centre, bustling market square, winding cobbled streets of timber-framed houses, fortified stone bridge, and hilltop castle',
  style: 'Cinematic historical realism, sweeping aerial previz',
  era: 'High Middle Ages, 14th century',
  lighting: 'Warm golden hour sunlight low on the horizon casting long dramatic shadows, glowing cathedral stained glass and street lanterns, soft atmospheric haze and rising chimney smoke',
  palette: 'Terracotta red roof tiles, cream and ochre plaster, dark weathered oak timber, warm carved limestone, deep slate river water, golden amber sunlight',
  mood: 'Epic, bustling, vertiginous, timeless'
});

kit.define('terracotta_roof_tiles', { base: 'roof_tiles', color: '#b84628', roughness: 0.74 });
kit.define('aged_red_roof_tiles', { base: 'roof_tiles', color: '#8f331c', roughness: 0.82 });
kit.define('slate_roof_tiles', { base: 'roof_tiles', color: '#3b4450', roughness: 0.64 });
kit.define('cream_plaster', { base: 'plaster', color: '#e8dec9', roughness: 0.86 });
kit.define('ochre_plaster', { base: 'plaster', color: '#dcc192', roughness: 0.88 });
kit.define('warm_limestone_block', { base: 'stone_block', color: '#cab89c', roughness: 0.78 });
kit.define('carved_stone_wall', { base: 'stone_wall', color: '#b7a68c', roughness: 0.82 });
kit.define('crimson_fabric', { base: 'fabric', color: '#a82424', roughness: 0.84 });
kit.define('cobalt_fabric', { base: 'fabric', color: '#264a78', roughness: 0.85 });
kit.define('saffron_fabric', { base: 'fabric', color: '#d88f24', roughness: 0.84 });
kit.define('emerald_fabric', { base: 'fabric', color: '#2b643e', roughness: 0.85 });
kit.define('canvas_fabric', { base: 'fabric', color: '#e4d9c3', roughness: 0.88 });
kit.define('river_water', { base: 'water', color: '#1f4252', roughness: 0.14, metalness: 0.15, transmission: 0.45 });
kit.define('chimney_smoke_wax', { base: 'wax', color: '#d6cfc7', roughness: 0.94, transmission: 0.52 });
kit.define('stained_glass', { base: 'glass', color: '#ff9d3b', roughness: 0.2, transmission: 0.45, emissive: '#ff7711', emissiveIntensity: 0.75 });
kit.glow('warm_lamp_light', '#ffaa44', 3.2);

function det(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function xform(lx, ly, lz, cx, cy, cz, rotYDeg) {
  const r = (rotYDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
}

const chimneyLocations = [];

function buildHouseSpec(spec, buckets) {
  const { x, y = 0, z, w, d, h1, h2, roofH, rotY = 0, seed = 1, hasDormer = true, hasChimney = true } = spec;
  const plinthH = 0.75;
  const p0 = xform(0, plinthH / 2, 0, x, y, z, rotY);
  buckets.stone.push(kit.box(w + 0.16, plinthH, d + 0.16).at(p0[0], p0[1], p0[2]).rot(0, rotY, 0));

  const gY = plinthH + h1 / 2;
  const p1 = xform(0, gY, 0, x, y, z, rotY);
  const plasterArr = seed % 2 === 0 ? buckets.creamPlaster : buckets.ochrePlaster;
  plasterArr.push(kit.box(w, h1, d).at(p1[0], p1[1], p1[2]).rot(0, rotY, 0));

  const jw = w + 0.48;
  const jd = d + 0.48;
  const uY = plinthH + h1 + h2 / 2;
  const p2 = xform(0, uY, 0, x, y, z, rotY);
  plasterArr.push(kit.box(jw, h2, jd).at(p2[0], p2[1], p2[2]).rot(0, rotY, 0));

  for (let i = -2; i <= 2; i++) {
    const joistPos = xform((i * w) / 4.2, plinthH + h1, 0, x, y, z, rotY);
    buckets.timber.push(kit.box(0.18, 0.22, jd + 0.18).at(joistPos[0], joistPos[1], joistPos[2]).rot(0, rotY, 0));
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cp1 = xform(sx * (w / 2), gY, sz * (d / 2), x, y, z, rotY);
      buckets.timber.push(kit.box(0.2, h1, 0.2).at(cp1[0], cp1[1], cp1[2]).rot(0, rotY, 0));
      const cp2 = xform(sx * (jw / 2), uY, sz * (jd / 2), x, y, z, rotY);
      buckets.timber.push(kit.box(0.2, h2, 0.2).at(cp2[0], cp2[1], cp2[2]).rot(0, rotY, 0));
    }
  }

  const topY = plinthH + h1 + h2;
  for (const bandY of [plinthH + h1, plinthH + h1 + h2 * 0.5, topY]) {
    const bp = xform(0, bandY, 0, x, y, z, rotY);
    buckets.timber.push(kit.box(jw + 0.1, 0.18, jd + 0.1).at(bp[0], bp[1], bp[2]).rot(0, rotY, 0));
  }

  for (const sz of [-1, 1]) {
    for (const sx of [-1, 0, 1]) {
      const sp = xform(sx * (jw * 0.28), uY, sz * (jd / 2), x, y, z, rotY);
      buckets.timber.push(kit.box(0.15, h2, 0.16).at(sp[0], sp[1], sp[2]).rot(0, rotY, 0));
    }
    for (const sx of [-1, 1]) {
      const bp = xform(sx * (jw * 0.34), uY, sz * (jd / 2), x, y, z, rotY);
      buckets.timber.push(kit.box(0.14, h2 * 0.85, 0.16).at(bp[0], bp[1], bp[2]).rot(0, rotY, sx * 26));
    }
    const wp = xform(0, uY + 0.15, sz * (jd / 2 + 0.04), x, y, z, rotY);
    buckets.glass.push(kit.box(0.75, 0.95, 0.08).at(wp[0], wp[1], wp[2]).rot(0, rotY, 0));
    buckets.timber.push(kit.box(0.9, 1.1, 0.06).at(wp[0], wp[1], wp[2]).rot(0, rotY, 0));
  }

  const doorP = xform(0, plinthH + 1.0, d / 2 + 0.04, x, y, z, rotY);
  buckets.timber.push(kit.box(0.95, 2.0, 0.12).at(doorP[0], doorP[1], doorP[2]).rot(0, rotY, 0));

  const rl = jd + 0.65;
  const span = jw / 2 + 0.38;
  const slopeLen = Math.hypot(span, roofH);
  const pitch = (Math.atan2(roofH, span) * 180) / Math.PI;
  const roofArr = seed % 3 === 0 ? buckets.darkRoof : buckets.redRoof;

  const lsP = xform(-span / 2, topY + roofH / 2, 0, x, y, z, rotY);
  const rsP = xform(span / 2, topY + roofH / 2, 0, x, y, z, rotY);
  roofArr.push(kit.box(slopeLen, 0.22, rl).at(lsP[0], lsP[1], lsP[2]).rot(0, rotY, pitch));
  roofArr.push(kit.box(slopeLen, 0.22, rl).at(rsP[0], rsP[1], rsP[2]).rot(0, rotY, -pitch));

  const ridgeP = xform(0, topY + roofH + 0.06, 0, x, y, z, rotY);
  buckets.timber.push(kit.box(0.28, 0.26, rl + 0.2).at(ridgeP[0], ridgeP[1], ridgeP[2]).rot(0, rotY, 0));

  for (const sz of [-1, 1]) {
    const gz = sz * (jd / 2 - 0.06);
    for (let t = 0; t < 4; t++) {
      const th = roofH / 4;
      const tw = jw * (1 - (t + 0.45) / 4.1);
      const ty = topY + (t + 0.5) * th;
      const gp = xform(0, ty, gz, x, y, z, rotY);
      plasterArr.push(kit.box(tw, th + 0.04, 0.22).at(gp[0], gp[1], gp[2]).rot(0, rotY, 0));
      const cbp = xform(0, topY + (t + 1) * th, gz, x, y, z, rotY);
      buckets.timber.push(kit.box(tw + 0.14, 0.14, 0.28).at(cbp[0], cbp[1], cbp[2]).rot(0, rotY, 0));
    }
    const kp = xform(0, topY + roofH / 2, gz, x, y, z, rotY);
    buckets.timber.push(kit.box(0.18, roofH, 0.28).at(kp[0], kp[1], kp[2]).rot(0, rotY, 0));

    const bz = sz * (rl / 2 - 0.08);
    const lbP = xform(-span / 2, topY + roofH / 2, bz, x, y, z, rotY);
    const rbP = xform(span / 2, topY + roofH / 2, bz, x, y, z, rotY);
    buckets.timber.push(kit.box(slopeLen + 0.12, 0.26, 0.2).at(lbP[0], lbP[1], lbP[2]).rot(0, rotY, pitch));
    buckets.timber.push(kit.box(slopeLen + 0.12, 0.26, 0.2).at(rbP[0], rbP[1], rbP[2]).rot(0, rotY, -pitch));
  }

  if (hasDormer) {
    const side = seed % 2 === 0 ? -1 : 1;
    const dp = xform(side * (span * 0.48), topY + roofH * 0.45, 0, x, y, z, rotY);
    plasterArr.push(kit.box(1.3, 1.2, 1.3).at(dp[0], dp[1], dp[2]).rot(0, rotY, 0));
    const drp = xform(side * (span * 0.48), topY + roofH * 0.45 + 0.78, 0, x, y, z, rotY);
    roofArr.push(kit.cone(1.05, 0.9, 4).at(drp[0], drp[1], drp[2]).rot(0, rotY + 45, 0));
  }

  if (hasChimney) {
    const cxLocal = (seed % 2 === 0 ? 1 : -1) * (jw * 0.22);
    const czLocal = ((seed % 3) - 1) * (jd * 0.22);
    const cBaseY = topY + roofH * 0.35;
    const cTopY = topY + roofH + 1.45;
    const cH = cTopY - cBaseY;
    const cp = xform(cxLocal, cBaseY + cH / 2, czLocal, x, y, z, rotY);
    buckets.brick.push(kit.box(0.72, cH, 0.72).at(cp[0], cp[1], cp[2]).rot(0, rotY, 0));
    const capP = xform(cxLocal, cTopY + 0.12, czLocal, x, y, z, rotY);
    buckets.brick.push(kit.box(0.88, 0.24, 0.88).at(capP[0], capP[1], capP[2]).rot(0, rotY, 0));
    const potP = xform(cxLocal, cTopY + 0.42, czLocal, x, y, z, rotY);
    buckets.brick.push(kit.cylinder(0.18, 0.22, 0.45, 12).at(potP[0], potP[1], potP[2]));
    chimneyLocations.push([potP[0], cTopY + 0.65, potP[2]]);
  }
}

function makeHouseDistrict(name, specs) {
  const buckets = {
    stone: [],
    creamPlaster: [],
    ochrePlaster: [],
    timber: [],
    redRoof: [],
    darkRoof: [],
    brick: [],
    glass: []
  };
  for (let i = 0; i < specs.length; i++) {
    buildHouseSpec(specs[i], buckets);
  }
  const obj = kit.object(name);
  if (buckets.stone.length) obj.add(buckets.stone, 'stone_wall');
  if (buckets.creamPlaster.length) obj.add(buckets.creamPlaster, 'cream_plaster');
  if (buckets.ochrePlaster.length) obj.add(buckets.ochrePlaster, 'ochre_plaster');
  if (buckets.timber.length) obj.add(buckets.timber, 'dark_wood');
  if (buckets.redRoof.length) obj.add(buckets.redRoof, 'terracotta_roof_tiles');
  if (buckets.darkRoof.length) obj.add(buckets.darkRoof, 'aged_red_roof_tiles');
  if (buckets.brick.length) obj.add(buckets.brick, 'brick');
  if (buckets.glass.length) obj.add(buckets.glass, 'stained_glass');
  obj.commit();
}
//@@
kit.object('ENV_valley_terrain')
  .add([
    kit.terrain(340, 340, 28, { seed: 19, flat: 108, roughness: 0.45 }).at(0, -0.4, 0)
  ], 'grass')
  .add([
    kit.terrain(280, 280, 12, { seed: 31, flat: 96, roughness: 0.4 }).at(0, -0.35, 0)
  ], 'forest_floor')
  .commit();
//@@
kit.object('ENV_castle_hill')
  .add([
    kit.terrain(74, 74, 19.5, { seed: 42, flat: 18, roughness: 0.52 }).at(-56, -0.2, 42)
  ], 'mossy_rock')
  .add([
    kit.cylinder(20, 27, 16, 16).at(-56, 8.0, 42),
    kit.cylinder(14, 19, 14, 14).at(-44, 7.0, 38),
    kit.cylinder(15, 21, 14, 14).at(-62, 7.0, 50)
  ], 'dark_rock')
  .add([
    kit.cylinder(22, 24, 1.2, 24).at(-56, 15.6, 42)
  ], 'dirt')
  .commit();
//@@
kit.object('ENV_city_ground_and_banks')
  .add([
    kit.cylinder(92, 94, 0.5, 48).at(0, -0.2, 2),
    kit.box(170, 0.5, 36).at(0, -0.2, 34),
    kit.box(170, 0.5, 28).at(0, -0.2, 82)
  ], 'cobblestone')
  .add([
    kit.box(220, 2.2, 4.5).at(0, 0.2, 49.5),
    kit.box(220, 2.2, 4.5).at(0, 0.2, 66.5),
    ...kit.repeat(18, i => kit.box(1.4, 2.6, 5.2).at(-85 + i * 10, 0.3, 49.5)),
    ...kit.repeat(18, i => kit.box(1.4, 2.6, 5.2).at(-85 + i * 10, 0.3, 66.5))
  ], 'mossy_stone_wall')
  .add([
    kit.box(16, 0.5, 60).at(8, -0.1, 95)
  ], 'dirt')
  .commit();
//@@
kit.object('ENV_river_water')
  .add([
    kit.box(260, 0.3, 14.5).at(0, 0.05, 58.0)
  ], 'river_water')
  .add([
    kit.puddle(45, 11.5, 11).at(-55, 0.22, 58.0),
    kit.puddle(48, 12.0, 22).at(0, 0.22, 58.0),
    kit.puddle(45, 11.5, 33).at(55, 0.22, 58.0)
  ], 'water')
  .commit();
//@@
kit.object('ENV_winding_cobbled_streets')
  .add([
    kit.box(7.5, 0.24, 24).at(8, 0.08, 38),
    kit.box(7.5, 0.24, 22).at(8, 0.08, 76),
    ...kit.repeat(10, i => {
      const t = i / 9;
      const sx = -8 - t * 34;
      const sz = 18 + t * 20 + Math.sin(t * Math.PI) * 5;
      const sy = t > 0.55 ? (t - 0.55) * 32 : 0.08;
      return kit.box(6.2, 0.4, 5.5).at(sx, sy, sz).rot(t > 0.55 ? -18 : 0, -32, 0);
    }),
    ...kit.repeat(10, i => {
      const t = i / 9;
      const sx = 16 + t * 34;
      const sz = 16 + Math.sin(t * Math.PI * 1.4) * 14;
      return kit.box(5.5, 0.22, 5.8).at(sx, 0.08, sz).rot(0, 25, 0);
    }),
    ...kit.repeat(12, i => {
      const ang = (i / 12) * Math.PI * 2;
      return kit.box(5.5, 0.2, 18).at(Math.cos(ang) * 44, 0.07, -10 + Math.sin(ang) * 40).rot(0, (-ang * 180) / Math.PI, 0);
    })
  ], 'wet_cobblestone')
  .commit();
//@@
kit.object('ENV_market_square_plaza')
  .add([
    kit.cylinder(21, 21.5, 0.28, 16).at(4, 0.1, 20),
    kit.box(34, 0.24, 26).at(4, 0.08, 20)
  ], 'stone_floor')
  .add([
    kit.torus(16, 0.35, 360, 32).at(4, 0.22, 20).rot(90, 0, 0),
    kit.torus(10, 0.3, 360, 32).at(4, 0.24, 20).rot(90, 0, 0),
    kit.torus(4.8, 0.28, 360, 24).at(4, 0.25, 20).rot(90, 0, 0)
  ], 'warm_limestone_block')
  .commit();
//@@
kit.object('ENV_market_fountain')
  .add([
    kit.cylinder(3.6, 4.0, 0.45, 8).at(4, 0.35, 20),
    kit.cylinder(2.8, 3.1, 1.1, 8).at(4, 0.9, 20),
    kit.cylinder(0.85, 1.05, 3.8, 8).at(4, 2.8, 20),
    kit.cylinder(1.6, 1.2, 0.5, 8).at(4, 3.2, 20),
    kit.cone(0.95, 3.2, 8).at(4, 6.2, 20),
    ...kit.repeat(4, i => {
      const a = (i * Math.PI) / 2;
      return kit.box(0.45, 2.4, 0.45).at(4 + Math.cos(a) * 0.95, 2.2, 20 + Math.sin(a) * 0.95);
    })
  ], 'carved_stone_wall')
  .add([
    kit.cylinder(2.5, 2.5, 0.2, 8).at(4, 1.38, 20),
    kit.cylinder(1.35, 1.35, 0.15, 8).at(4, 3.4, 20)
  ], 'river_water')
  .add([
    kit.sphere(0.28, 12).at(4, 7.9, 20),
    ...kit.repeat(4, i => {
      const a = (i * Math.PI) / 2;
      return kit.cylinder(0.08, 0.08, 0.6, 8).at(4 + Math.cos(a) * 1.1, 3.1, 20 + Math.sin(a) * 1.1).rot(0, i * 90, 75);
    })
  ], 'aged_bronze')
  .commit();
//@@
kit.object('ENV_cathedral_body')
  .add([
    kit.box(22, 1.4, 46).at(0, 0.7, -22),
    kit.box(34, 1.4, 14).at(0, 0.7, -26),
    kit.box(15, 22, 36).at(0, 12.0, -22),
    kit.box(23, 12.5, 34).at(0, 7.2, -22),
    kit.box(31, 21, 11).at(0, 11.5, -26),
    kit.cylinder(7.5, 7.5, 21, 8).at(0, 11.5, -41),
    kit.cylinder(11.5, 11.5, 11, 8).at(0, 6.5, -41),
    kit.box(7.2, 31, 7.2).at(5.8, 16.5, -6.5),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return kit.box(1.2, 6.0, 1.2).at(5.8 + sx * 3.1, 34.0, -6.5 + sz * 3.1);
    })
  ], 'warm_limestone_block')
  .add([
    kit.box(9.2, 0.35, 37).at(-3.9, 26.2, -22).rot(0, 0, 46),
    kit.box(9.2, 0.35, 37).at(3.9, 26.2, -22).rot(0, 0, -46),
    kit.box(16, 0.35, 8.2).at(-8.0, 25.0, -26).rot(46, 0, 0),
    kit.box(16, 0.35, 8.2).at(8.0, 25.0, -26).rot(-46, 0, 0),
    kit.cone(8.0, 9.5, 8).at(0, 26.7, -41),
    kit.cone(2.8, 18.0, 8).at(0, 38.0, -26),
    kit.cone(4.6, 13.5, 8).at(5.8, 38.5, -6.5),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return kit.cone(0.85, 3.8, 6).at(5.8 + sx * 3.1, 38.8, -6.5 + sz * 3.1);
    })
  ], 'slate_roof_tiles')
  .add([
    kit.cylinder(4.2, 4.2, 0.4, 24).at(0, 16.5, -3.9).rot(90, 0, 0),
    kit.cylinder(3.4, 3.4, 0.4, 24).at(-15.6, 15.5, -26).rot(0, 0, 90),
    kit.cylinder(3.4, 3.4, 0.4, 24).at(15.6, 15.5, -26).rot(0, 0, 90),
    ...kit.repeat(6, i => kit.box(0.3, 6.2, 1.4).at(-7.6, 17.5, -10 - i * 4.6)),
    ...kit.repeat(6, i => kit.box(0.3, 6.2, 1.4).at(7.6, 17.5, -10 - i * 4.6))
  ], 'stained_glass')
  .add([
    kit.torus(4.3, 0.32, 360, 24).at(0, 16.5, -3.7).rot(0, 0, 0),
    kit.torus(2.6, 0.22, 360, 20).at(0, 16.5, -3.7).rot(0, 0, 0),
    ...kit.repeat(8, i => kit.box(0.18, 8.4, 0.25).at(0, 16.5, -3.68).rot(0, 0, i * 22.5)),
    ...kit.repeat(3, i => kit.torus(2.2 - i * 0.45, 0.28, 180, 16).at(0, 4.2, -3.6 - i * 0.35))
  ], 'carved_stone_wall')
  .add([
    kit.box(0.25, 3.2, 0.25).at(0, 48.2, -26),
    kit.box(1.8, 0.25, 0.25).at(0, 49.0, -26),
    kit.box(0.22, 2.4, 0.22).at(5.8, 46.2, -6.5),
    kit.box(1.4, 0.22, 0.22).at(5.8, 46.8, -6.5)
  ], 'aged_gold')
  .commit();
//@@
kit.object('ENV_cathedral_flying_buttresses')
  .add([
    ...kit.repeat(6, i => {
      const bz = -9.5 - i * 4.8;
      return [
        kit.box(1.8, 18.5, 1.6).at(-13.2, 10.0, bz),
        kit.box(1.8, 18.5, 1.6).at(13.2, 10.0, bz),
        kit.box(6.2, 0.9, 1.1).at(-10.2, 15.2, bz).rot(0, 0, 24),
        kit.box(6.2, 0.9, 1.1).at(10.2, 15.2, bz).rot(0, 0, -24),
        kit.box(6.2, 0.85, 1.0).at(-10.2, 19.6, bz).rot(0, 0, 26),
        kit.box(6.2, 0.85, 1.0).at(10.2, 19.6, bz).rot(0, 0, -26),
        kit.cone(1.05, 4.2, 6).at(-13.2, 21.3, bz),
        kit.cone(1.05, 4.2, 6).at(13.2, 21.3, bz),
        kit.box(0.35, 0.35, 1.4).at(-14.2, 18.2, bz).rot(0, 90, 0),
        kit.box(0.35, 0.35, 1.4).at(14.2, 18.2, bz).rot(0, 90, 0)
      ];
    })
  ], 'carved_stone_wall')
  .commit();
//@@
kit.object('ENV_cathedral_bell_tower')
  .add([
    kit.box(9.6, 18.0, 9.6).at(-5.0, 9.5, -14.0),
    kit.box(8.8, 15.0, 8.8).at(-5.0, 26.0, -14.0),
    kit.box(8.0, 11.0, 8.0).at(-5.0, 39.0, -14.0),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return [
        kit.box(1.5, 53.0, 1.5).at(-5.0 + sx * 3.7, 26.5, -14.0 + sz * 3.7),
        kit.box(1.3, 5.2, 1.3).at(-5.0 + sx * 3.5, 55.6, -14.0 + sz * 3.5)
      ];
    }),
    kit.box(8.8, 0.8, 8.8).at(-5.0, 44.6, -14.0),
    kit.box(8.4, 0.9, 8.4).at(-5.0, 52.8, -14.0),
    kit.box(8.2, 1.1, 0.55).at(-5.0, 53.6, -17.8),
    kit.box(0.55, 1.1, 8.2).at(-8.8, 53.6, -14.0),
    kit.box(0.55, 1.1, 8.2).at(-1.2, 53.6, -14.0),
    kit.box(2.6, 1.1, 0.55).at(-7.5, 53.6, -10.2),
    kit.box(2.6, 1.1, 0.55).at(-2.5, 53.6, -10.2)
  ], 'warm_limestone_block')
  .add([
    kit.box(9.8, 0.7, 9.8).at(-5.0, 18.5, -14.0),
    kit.box(9.2, 0.7, 9.2).at(-5.0, 33.5, -14.0),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return kit.cone(0.95, 4.5, 6).at(-5.0 + sx * 3.5, 60.4, -14.0 + sz * 3.5);
    }),
    kit.cone(3.1, 11.5, 8).at(-5.0, 58.8, -15.4)
  ], 'slate_roof_tiles')
  .add([
    kit.lathe([[0.1, 1.6], [0.55, 1.4], [0.85, 0.8], [1.1, 0.2], [1.35, 0.0]], 20).at(-5.0, 48.2, -14.0),
    kit.sphere(0.24, 12).at(-5.0, 48.1, -14.0)
  ], 'aged_bronze')
  .add([
    kit.torus(1.45, 0.14, 360, 24).at(-5.0, 39.5, -9.9),
    kit.box(0.12, 1.2, 0.1).at(-5.0, 39.9, -9.85),
    kit.box(0.9, 0.12, 0.1).at(-4.6, 39.5, -9.85)
  ], 'aged_gold')
  .commit();
//@@
kit.object('PRP_bell_tower_viewpoint_beam')
  .add([
    kit.box(0.52, 0.44, 6.8).at(-5.0, 53.15, -10.4),
    kit.box(0.36, 0.32, 3.4).at(-5.0, 51.7, -9.9).rot(34, 0, 0),
    kit.box(1.8, 0.34, 0.38).at(-5.0, 52.95, -11.2),
    kit.box(0.28, 0.24, 2.2).at(-5.6, 53.0, -10.8).rot(0, -16, 0),
    kit.box(0.28, 0.24, 2.2).at(-4.4, 53.0, -10.8).rot(0, 16, 0)
  ], 'weathered_wood')
  .add([
    ...kit.repeat(5, i => kit.box(0.58, 0.5, 0.12).at(-5.0, 53.15, -11.5 + i * 1.05)),
    kit.torus(0.22, 0.05, 360, 16).at(-5.0, 52.75, -7.25).rot(0, 90, 0),
    kit.cylinder(0.04, 0.04, 0.55, 8).at(-5.0, 52.45, -7.25),
    kit.cylinder(0.18, 0.14, 0.42, 8).at(-5.0, 52.1, -7.25)
  ], 'sooty_iron')
  .add([
    kit.torus(0.32, 0.07, 360, 16).at(-5.0, 53.42, -8.4).rot(90, 0, 0),
    kit.torus(0.28, 0.06, 360, 16).at(-5.0, 53.48, -8.4).rot(90, 0, 0)
  ], 'leather')
  .add([
    kit.sphere(0.13, 12).at(-5.0, 52.1, -7.25)
  ], 'warm_lamp_light')
  .commit();
//@@
kit.object('PRP_market_stalls_north')
  .add([
    ...kit.repeat(5, i => {
      const ang = -0.75 + i * 0.38;
      const sx = 4 + Math.sin(ang) * 12.5;
      const sz = 20 - Math.cos(ang) * 11.2;
      const ry = (-ang * 180) / Math.PI;
      return [
        kit.box(3.2, 0.12, 1.5).at(sx, 0.88, sz).rot(0, ry, 0),
        kit.box(0.14, 2.4, 0.14).at(...xform(-1.45, 1.2, -0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.4, 0.14).at(...xform(1.45, 1.2, -0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.1, 0.14).at(...xform(-1.45, 1.05, 0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.1, 0.14).at(...xform(1.45, 1.05, 0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(3.3, 0.12, 0.12).at(...xform(0, 2.35, -0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(3.3, 0.12, 0.12).at(...xform(0, 2.05, 0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.75, 0.55, 0.65).at(...xform(-0.8, 0.3, 0.95, sx, 0, sz, ry)).rot(0, ry + 12, 0),
        kit.cylinder(0.32, 0.28, 0.72, 12).at(...xform(0.95, 0.36, 0.95, sx, 0, sz, ry))
      ];
    })
  ], 'weathered_wood_planks')
  .add([
    ...kit.repeat(3, i => {
      const idx = i * 2;
      const ang = -0.75 + idx * 0.38;
      const sx = 4 + Math.sin(ang) * 12.5;
      const sz = 20 - Math.cos(ang) * 11.2;
      const ry = (-ang * 180) / Math.PI;
      return kit.box(3.5, 0.1, 2.1).at(sx, 2.28, sz).rot(12, ry, 0);
    })
  ], 'crimson_fabric')
  .add([
    ...kit.repeat(2, i => {
      const idx = i * 2 + 1;
      const ang = -0.75 + idx * 0.38;
      const sx = 4 + Math.sin(ang) * 12.5;
      const sz = 20 - Math.cos(ang) * 11.2;
      const ry = (-ang * 180) / Math.PI;
      return kit.box(3.5, 0.1, 2.1).at(sx, 2.28, sz).rot(12, ry, 0);
    })
  ], 'saffron_fabric')
  .add([
    ...kit.repeat(5, i => {
      const ang = -0.75 + i * 0.38;
      const sx = 4 + Math.sin(ang) * 12.5;
      const sz = 20 - Math.cos(ang) * 11.2;
      return [
        kit.cylinder(0.22, 0.16, 0.38, 10).at(sx - 0.5, 1.12, sz),
        kit.cylinder(0.2, 0.15, 0.36, 10).at(sx + 0.4, 1.12, sz)
      ];
    })
  ], 'ceramic')
  .commit();
//@@
kit.object('PRP_market_stalls_south')
  .add([
    ...kit.repeat(5, i => {
      const ang = -0.75 + i * 0.38;
      const sx = 4 + Math.sin(ang) * 12.8;
      const sz = 20 + Math.cos(ang) * 11.2;
      const ry = (ang * 180) / Math.PI + 180;
      return [
        kit.box(3.2, 0.12, 1.5).at(sx, 0.88, sz).rot(0, ry, 0),
        kit.box(0.14, 2.4, 0.14).at(...xform(-1.45, 1.2, -0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.4, 0.14).at(...xform(1.45, 1.2, -0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.1, 0.14).at(...xform(-1.45, 1.05, 0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.box(0.14, 2.1, 0.14).at(...xform(1.45, 1.05, 0.65, sx, 0, sz, ry)).rot(0, ry, 0),
        kit.cylinder(0.34, 0.3, 0.78, 12).at(...xform(-0.9, 0.39, 0.95, sx, 0, sz, ry)),
        kit.cylinder(0.34, 0.3, 0.78, 12).at(...xform(0.9, 0.39, 0.95, sx, 0, sz, ry))
      ];
    })
  ], 'weathered_wood_planks')
  .add([
    ...kit.repeat(3, i => {
      const idx = i * 2;
      const ang = -0.75 + idx * 0.38;
      const sx = 4 + Math.sin(ang) * 12.8;
      const sz = 20 + Math.cos(ang) * 11.2;
      const ry = (ang * 180) / Math.PI + 180;
      return kit.box(3.5, 0.1, 2.1).at(sx, 2.28, sz).rot(12, ry, 0);
    })
  ], 'cobalt_fabric')
  .add([
    ...kit.repeat(2, i => {
      const idx = i * 2 + 1;
      const ang = -0.75 + idx * 0.38;
      const sx = 4 + Math.sin(ang) * 12.8;
      const sz = 20 + Math.cos(ang) * 11.2;
      const ry = (ang * 180) / Math.PI + 180;
      return kit.box(3.5, 0.1, 2.1).at(sx, 2.28, sz).rot(12, ry, 0);
    })
  ], 'emerald_fabric')
  .add([
    ...kit.repeat(5, i => {
      const ang = -0.75 + i * 0.38;
      const sx = 4 + Math.sin(ang) * 12.8;
      const sz = 20 + Math.cos(ang) * 11.2;
      return [
        kit.sphere(0.32, 10).at(sx - 0.5, 1.15, sz).scale([1.2, 0.8, 1.0]),
        kit.sphere(0.32, 10).at(sx + 0.5, 1.15, sz).scale([1.1, 0.85, 1.1])
      ];
    })
  ], 'straw')
  .commit();
//@@
kit.object('PRP_market_wagons_and_crates')
  .add([
    kit.box(2.2, 0.18, 3.6).at(-4.5, 0.78, 16.5).rot(0, 24, 0),
    kit.box(0.14, 0.7, 3.6).at(-5.5, 1.15, 16.1).rot(0, 24, 0),
    kit.box(0.14, 0.7, 3.6).at(-3.5, 1.15, 16.9).rot(0, 24, 0),
    kit.torus(0.68, 0.09, 360, 18).at(-5.65, 0.68, 16.0).rot(0, 114, 0),
    kit.torus(0.68, 0.09, 360, 18).at(-3.35, 0.68, 17.0).rot(0, 114, 0),
    kit.box(2.0, 0.18, 3.2).at(12.2, 0.75, 24.5).rot(0, -18, 0),
    kit.torus(0.65, 0.09, 360, 18).at(11.1, 0.65, 24.2).rot(0, 72, 0),
    kit.torus(0.65, 0.09, 360, 18).at(13.3, 0.65, 24.8).rot(0, 72, 0),
    ...kit.repeat(6, i => kit.cylinder(0.38, 0.34, 0.88, 14).at(-4.5 + (i % 2) * 0.75, 1.32, 15.8 + Math.floor(i / 2) * 0.85))
  ], 'weathered_wood')
  .add([
    kit.sphere(1.2, 12).at(12.2, 1.45, 24.5).scale([0.9, 0.65, 1.25])
  ], 'straw')
  .commit();
//@@
makeHouseDistrict('ENV_houses_market_west', [
  { x: -16.5, z: 6.5, w: 6.2, d: 8.4, h1: 3.4, h2: 6.2, roofH: 5.2, rotY: 88, seed: 1 },
  { x: -17.2, z: 13.5, w: 5.8, d: 8.0, h1: 3.2, h2: 5.4, roofH: 4.6, rotY: 92, seed: 2 },
  { x: -17.0, z: 20.4, w: 6.4, d: 8.8, h1: 3.5, h2: 6.6, roofH: 5.4, rotY: 86, seed: 3 },
  { x: -16.2, z: 27.5, w: 5.6, d: 7.8, h1: 3.2, h2: 5.0, roofH: 4.5, rotY: 78, seed: 4 },
  { x: -13.5, z: 34.2, w: 6.0, d: 8.2, h1: 3.3, h2: 5.6, roofH: 4.8, rotY: 64, seed: 5 }
]);
//@@
makeHouseDistrict('ENV_houses_market_east', [
  { x: 22.5, z: 5.5, w: 6.6, d: 9.0, h1: 3.6, h2: 6.4, roofH: 5.4, rotY: -86, seed: 6 },
  { x: 23.8, z: 13.0, w: 6.0, d: 8.4, h1: 3.3, h2: 5.6, roofH: 4.8, rotY: -92, seed: 7 },
  { x: 24.2, z: 20.5, w: 7.2, d: 9.6, h1: 3.8, h2: 6.8, roofH: 5.8, rotY: -88, seed: 8 },
  { x: 23.0, z: 28.0, w: 5.8, d: 8.0, h1: 3.2, h2: 5.2, roofH: 4.5, rotY: -78, seed: 9 },
  { x: 20.5, z: 34.8, w: 6.2, d: 8.2, h1: 3.4, h2: 5.8, roofH: 4.9, rotY: -65, seed: 10 }
]);
//@@
makeHouseDistrict('ENV_houses_high_street_west', [
  { x: 0.2, z: 35.5, w: 5.6, d: 7.8, h1: 3.2, h2: 5.4, roofH: 4.6, rotY: 84, seed: 11 },
  { x: 0.6, z: 42.0, w: 5.4, d: 7.5, h1: 3.1, h2: 4.8, roofH: 4.2, rotY: 90, seed: 12 },
  { x: -6.8, z: 39.5, w: 6.0, d: 8.2, h1: 3.3, h2: 5.6, roofH: 4.8, rotY: 16, seed: 13 },
  { x: -14.2, z: 41.2, w: 5.8, d: 7.6, h1: 3.2, h2: 4.6, roofH: 4.3, rotY: -8, seed: 14 },
  { x: -21.5, z: 38.5, w: 6.2, d: 8.0, h1: 3.3, h2: 5.2, roofH: 4.6, rotY: 22, seed: 15 }
]);
//@@
makeHouseDistrict('ENV_houses_high_street_east', [
  { x: 15.8, z: 36.0, w: 5.8, d: 8.0, h1: 3.2, h2: 5.5, roofH: 4.7, rotY: -86, seed: 16 },
  { x: 15.4, z: 42.5, w: 5.5, d: 7.6, h1: 3.1, h2: 5.0, roofH: 4.4, rotY: -92, seed: 17 },
  { x: 23.2, z: 41.8, w: 6.2, d: 8.4, h1: 3.3, h2: 5.4, roofH: 4.8, rotY: -12, seed: 18 },
  { x: 31.0, z: 39.0, w: 5.8, d: 7.8, h1: 3.2, h2: 4.8, roofH: 4.3, rotY: 18, seed: 19 },
  { x: 38.2, z: 35.5, w: 6.4, d: 8.2, h1: 3.4, h2: 5.6, roofH: 4.9, rotY: -28, seed: 20 }
]);
//@@
makeHouseDistrict('ENV_houses_riverfront_west', [
  { x: -6.5, z: 46.2, w: 5.6, d: 7.2, h1: 3.1, h2: 4.8, roofH: 4.2, rotY: 4, seed: 21 },
  { x: -13.5, z: 46.5, w: 6.0, d: 7.6, h1: 3.2, h2: 5.2, roofH: 4.6, rotY: -3, seed: 22 },
  { x: -20.8, z: 46.0, w: 5.8, d: 7.4, h1: 3.0, h2: 4.6, roofH: 4.1, rotY: 6, seed: 23 },
  { x: -28.0, z: 46.4, w: 6.4, d: 8.0, h1: 3.3, h2: 5.4, roofH: 4.7, rotY: -4, seed: 24 },
  { x: -35.5, z: 46.0, w: 5.6, d: 7.2, h1: 3.1, h2: 4.5, roofH: 4.0, rotY: 8, seed: 25 }
]);
//@@
makeHouseDistrict('ENV_houses_riverfront_east', [
  { x: 24.5, z: 46.2, w: 6.0, d: 7.6, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: -4, seed: 26 },
  { x: 31.8, z: 46.5, w: 5.8, d: 7.4, h1: 3.1, h2: 4.8, roofH: 4.2, rotY: 5, seed: 27 },
  { x: 39.0, z: 46.0, w: 6.4, d: 8.2, h1: 3.4, h2: 5.4, roofH: 4.8, rotY: -6, seed: 28 },
  { x: 46.5, z: 46.4, w: 5.6, d: 7.4, h1: 3.0, h2: 4.6, roofH: 4.1, rotY: 3, seed: 29 },
  { x: 53.5, z: 45.8, w: 6.0, d: 7.6, h1: 3.2, h2: 4.8, roofH: 4.3, rotY: -8, seed: 30 }
]);
//@@
makeHouseDistrict('ENV_houses_castle_road', [
  { x: -25.0, z: 15.0, w: 5.8, d: 7.8, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: 34, seed: 31 },
  { x: -25.8, z: 23.5, w: 6.0, d: 8.0, h1: 3.2, h2: 5.2, roofH: 4.6, rotY: 52, seed: 32 },
  { x: -29.5, z: 31.0, w: 5.6, d: 7.4, h1: 3.1, h2: 4.8, roofH: 4.2, rotY: 42, seed: 33 },
  { x: -34.0, z: 19.5, w: 6.2, d: 8.2, h1: 3.3, h2: 5.4, roofH: 4.7, rotY: -28, seed: 34 },
  { x: -36.5, z: 27.8, w: 5.8, d: 7.6, h1: 3.1, h2: 4.6, roofH: 4.2, rotY: 62, seed: 35 }
]);
//@@
makeHouseDistrict('ENV_houses_eastern_quarter', [
  { x: 33.5, z: 6.0, w: 6.2, d: 8.4, h1: 3.3, h2: 5.4, roofH: 4.7, rotY: 18, seed: 36 },
  { x: 34.8, z: 15.2, w: 5.8, d: 7.8, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: -24, seed: 37 },
  { x: 35.2, z: 24.5, w: 6.4, d: 8.6, h1: 3.4, h2: 5.6, roofH: 4.9, rotY: 68, seed: 38 },
  { x: 44.0, z: 10.5, w: 5.8, d: 7.6, h1: 3.1, h2: 4.8, roofH: 4.3, rotY: -75, seed: 39 },
  { x: 45.5, z: 20.0, w: 6.0, d: 8.0, h1: 3.2, h2: 5.2, roofH: 4.6, rotY: 12, seed: 40 },
  { x: 47.0, z: 29.5, w: 5.6, d: 7.4, h1: 3.0, h2: 4.6, roofH: 4.1, rotY: -42, seed: 41 }
]);
//@@
makeHouseDistrict('ENV_houses_cathedral_close_west', [
  { x: -24.5, z: -4.0, w: 6.2, d: 8.4, h1: 3.4, h2: 5.6, roofH: 4.8, rotY: 82, seed: 42 },
  { x: -26.0, z: -14.0, w: 6.0, d: 8.0, h1: 3.2, h2: 5.2, roofH: 4.5, rotY: 95, seed: 43 },
  { x: -25.5, z: -24.5, w: 6.4, d: 8.8, h1: 3.5, h2: 5.8, roofH: 5.0, rotY: 88, seed: 44 },
  { x: -36.0, z: -8.5, w: 5.8, d: 7.8, h1: 3.1, h2: 4.8, roofH: 4.3, rotY: -14, seed: 45 },
  { x: -38.5, z: -20.0, w: 6.0, d: 8.2, h1: 3.2, h2: 5.0, roofH: 4.5, rotY: 28, seed: 46 }
]);
//@@
makeHouseDistrict('ENV_houses_cathedral_close_east', [
  { x: 24.5, z: -5.0, w: 6.4, d: 8.6, h1: 3.4, h2: 5.8, roofH: 4.9, rotY: -84, seed: 47 },
  { x: 26.0, z: -15.0, w: 6.0, d: 8.2, h1: 3.2, h2: 5.2, roofH: 4.6, rotY: -94, seed: 48 },
  { x: 25.5, z: -25.5, w: 6.6, d: 9.0, h1: 3.5, h2: 6.0, roofH: 5.2, rotY: -86, seed: 49 },
  { x: 37.5, z: -8.0, w: 5.8, d: 7.8, h1: 3.1, h2: 4.8, roofH: 4.3, rotY: 22, seed: 50 },
  { x: 39.5, z: -19.5, w: 6.2, d: 8.2, h1: 3.3, h2: 5.2, roofH: 4.6, rotY: -32, seed: 51 }
]);
//@@
makeHouseDistrict('ENV_houses_northern_ward', [
  { x: -22.0, z: -42.0, w: 6.0, d: 8.0, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: 25, seed: 52 },
  { x: -10.5, z: -50.0, w: 6.2, d: 8.2, h1: 3.3, h2: 5.2, roofH: 4.6, rotY: 8, seed: 53 },
  { x: 2.0, z: -52.5, w: 5.8, d: 7.8, h1: 3.1, h2: 4.8, roofH: 4.2, rotY: -6, seed: 54 },
  { x: 14.5, z: -49.5, w: 6.4, d: 8.4, h1: 3.3, h2: 5.4, roofH: 4.7, rotY: -18, seed: 55 },
  { x: 25.0, z: -41.5, w: 6.0, d: 8.0, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: -36, seed: 56 }
]);
//@@
makeHouseDistrict('ENV_houses_south_bank_suburb', [
  { x: -16.0, z: 72.5, w: 5.8, d: 7.4, h1: 3.1, h2: 4.6, roofH: 4.1, rotY: -6, seed: 57 },
  { x: -6.5, z: 73.0, w: 6.2, d: 7.8, h1: 3.2, h2: 5.0, roofH: 4.4, rotY: 4, seed: 58 },
  { x: 19.5, z: 72.5, w: 6.0, d: 7.8, h1: 3.2, h2: 4.8, roofH: 4.3, rotY: -4, seed: 59 },
  { x: 29.0, z: 72.0, w: 5.6, d: 7.4, h1: 3.0, h2: 4.5, roofH: 4.0, rotY: 12, seed: 60 }
]);
//@@
kit.object('PRP_chimney_smoke_central')
  .add(
    chimneyLocations.slice(0, 20).flatMap((pos, idx) => {
      const [cx, cy, cz] = pos;
      const pts = [];
      for (let s = 0; s < 7; s++) {
        const h = s * 1.15;
        const driftX = s * 0.38 + Math.sin(s * 0.9 + idx) * 0.28;
        const driftZ = s * 0.22 + Math.cos(s * 0.8 + idx) * 0.22;
        pts.push([cx + driftX, cy + h, cz + driftZ]);
      }
      return [
        kit.tube(pts, 0.22, 18, false),
        ...kit.repeat(5, p => {
          const t = p + 1;
          const px = cx + t * 0.45 + Math.sin(t + idx) * 0.25;
          const py = cy + t * 1.25;
          const pz = cz + t * 0.26 + Math.cos(t + idx) * 0.2;
          return kit.sphere(0.28 + p * 0.14, 10).at(px, py, pz).scale([1.15, 0.85, 1.1]);
        })
      ];
    }),
    'chimney_smoke_wax'
  )
  .commit();
//@@
kit.object('PRP_chimney_smoke_outer')
  .add(
    chimneyLocations.slice(20, 44).flatMap((pos, idx) => {
      const [cx, cy, cz] = pos;
      const pts = [];
      for (let s = 0; s < 6; s++) {
        const h = s * 1.2;
        const driftX = s * 0.42 + Math.sin(s * 0.85 + idx * 1.7) * 0.26;
        const driftZ = s * 0.24 + Math.cos(s * 0.75 + idx * 1.3) * 0.2;
        pts.push([cx + driftX, cy + h, cz + driftZ]);
      }
      return [
        kit.tube(pts, 0.2, 16, false),
        ...kit.repeat(4, p => {
          const t = p + 1;
          const px = cx + t * 0.48 + Math.sin(t + idx) * 0.22;
          const py = cy + t * 1.35;
          const pz = cz + t * 0.28 + Math.cos(t + idx) * 0.18;
          return kit.sphere(0.3 + p * 0.15, 10).at(px, py, pz).scale([1.2, 0.82, 1.1]);
        })
      ];
    }),
    'chimney_smoke_wax'
  )
  .commit();
//@@
kit.object('ENV_stone_arch_bridge')
  .add([
    kit.box(7.8, 1.4, 11.5).at(8.0, 2.5, 52.8).rot(-7, 0, 0),
    kit.box(7.8, 1.4, 11.5).at(8.0, 2.5, 63.2).rot(7, 0, 0),
    kit.box(7.8, 1.4, 4.5).at(8.0, 3.1, 58.0),
    kit.box(0.55, 1.2, 22.0).at(4.35, 3.6, 58.0),
    kit.box(0.55, 1.2, 22.0).at(11.65, 3.6, 58.0),
    ...kit.repeat(9, i => [
      kit.box(0.65, 0.55, 1.1).at(4.35, 4.4, 48.4 + i * 2.4),
      kit.box(0.65, 0.55, 1.1).at(11.65, 4.4, 48.4 + i * 2.4)
    ]),
    ...kit.repeat(4, i => {
      const pz = 49.0 + i * 6.0;
      return [
        kit.box(8.4, 3.6, 1.8).at(8.0, 1.4, pz),
        kit.cylinder(1.3, 1.5, 3.4, 4).at(3.6, 1.3, pz).rot(0, 45, 0),
        kit.cylinder(1.3, 1.5, 3.4, 4).at(12.4, 1.3, pz).rot(0, 45, 0)
      ];
    }),
    ...kit.repeat(3, i => {
      const az = 52.0 + i * 6.0;
      return [
        kit.torus(2.4, 0.55, 180, 20).at(4.5, 0.6, az).rot(0, 90, 0),
        kit.torus(2.4, 0.55, 180, 20).at(8.0, 0.6, az).rot(0, 90, 0),
        kit.torus(2.4, 0.55, 180, 20).at(11.5, 0.6, az).rot(0, 90, 0)
      ];
    }),
    kit.box(2.2, 6.8, 2.8).at(3.4, 4.8, 58.0),
    kit.box(2.2, 6.8, 2.8).at(12.6, 4.8, 58.0)
  ], 'warm_limestone_block')
  .add([
    kit.cone(1.8, 2.8, 4).at(3.4, 9.6, 58.0).rot(0, 45, 0),
    kit.cone(1.8, 2.8, 4).at(12.6, 9.6, 58.0).rot(0, 45, 0)
  ], 'terracotta_roof_tiles')
  .add([
    kit.box(6.6, 0.25, 22.0).at(8.0, 3.25, 58.0)
  ], 'wet_cobblestone')
  .commit();
//@@
kit.object('PRP_river_sailboat_west')
  .add([
    kit.box(2.4, 0.9, 6.8).at(-11.5, 0.45, 58.5).rot(0, 82, 0),
    kit.cone(1.3, 2.4, 4).at(-7.4, 0.65, 59.1).rot(0, 82, -75),
    kit.cone(1.3, 2.2, 4).at(-15.5, 0.75, 57.9).rot(0, 82, 72),
    kit.box(2.2, 0.85, 2.0).at(-14.2, 1.15, 58.1).rot(0, 82, 0),
    kit.cylinder(0.14, 0.18, 7.8, 12).at(-11.2, 4.2, 58.5),
    kit.cylinder(0.09, 0.09, 4.6, 10).at(-11.0, 6.2, 58.5).rot(0, 82, 90)
  ], 'weathered_wood')
  .add([
    kit.box(4.2, 3.8, 0.12).at(-10.6, 4.3, 58.6).rot(8, 82, 0)
  ], 'canvas_fabric')
  .add([
    kit.box(0.9, 0.35, 0.06).at(-11.2, 8.2, 58.5).rot(0, 82, 0)
  ], 'crimson_fabric')
  .add([
    kit.cylinder(0.34, 0.3, 0.78, 12).at(-9.8, 1.05, 58.7),
    kit.cylinder(0.34, 0.3, 0.78, 12).at(-10.4, 1.05, 58.2)
  ], 'wood')
  .commit();
//@@
kit.object('PRP_river_barge_east')
  .add([
    kit.box(2.6, 0.85, 8.2).at(25.5, 0.42, 57.2).rot(0, 96, 0),
    kit.cone(1.35, 2.2, 4).at(30.2, 0.58, 56.7).rot(0, 96, -78),
    kit.cone(1.35, 2.2, 4).at(20.8, 0.58, 57.7).rot(0, 96, 78),
    ...kit.repeat(4, i => kit.cylinder(0.08, 0.08, 1.8, 8).at(23.5 + (i % 2) * 3.2, 1.4, 56.4 + Math.floor(i / 2) * 1.6)),
    kit.cylinder(0.06, 0.06, 4.2, 8).at(19.6, 0.9, 58.1).rot(0, 40, 68)
  ], 'weathered_wood_planks')
  .add([
    kit.box(3.6, 0.12, 2.4).at(25.1, 2.3, 57.2).rot(0, 6, 0)
  ], 'saffron_fabric')
  .add([
    ...kit.repeat(6, i => kit.cylinder(0.36, 0.32, 0.85, 12).at(27.2 + (i % 2) * 0.8, 1.1, 56.6 + Math.floor(i / 2) * 0.7))
  ], 'dark_wood')
  .commit();
//@@
kit.object('PRP_river_skiffs_and_quay_crane')
  .add([
    kit.box(1.4, 0.55, 3.8).at(-1.8, 0.3, 52.2).rot(0, 78, 0),
    kit.box(1.4, 0.55, 3.8).at(37.5, 0.3, 52.4).rot(0, 102, 0),
    kit.box(3.2, 3.6, 3.2).at(18.5, 2.2, 49.8),
    kit.torus(1.6, 0.16, 360, 20).at(18.5, 2.6, 48.0),
    kit.cylinder(0.28, 0.34, 7.5, 12).at(18.5, 5.5, 49.8),
    kit.box(0.32, 0.36, 6.2).at(18.5, 8.2, 52.2).rot(22, 0, 0),
    kit.box(0.26, 0.28, 4.2).at(18.5, 6.8, 51.8).rot(-32, 0, 0),
    kit.box(1.1, 1.1, 1.1).at(18.5, 4.2, 54.6)
  ], 'weathered_wood')
  .add([
    kit.cylinder(0.05, 0.05, 4.8, 8).at(18.5, 6.8, 54.6),
    kit.torus(0.25, 0.06, 360, 12).at(18.5, 9.2, 54.6).rot(0, 90, 0)
  ], 'sooty_iron')
  .commit();
//@@
kit.object('ENV_city_gatehouse_south')
  .add([
    kit.cylinder(4.6, 5.2, 19.5, 24).at(2.2, 9.75, 82.0),
    kit.cylinder(4.6, 5.2, 19.5, 24).at(13.8, 9.75, 82.0),
    kit.cylinder(5.1, 4.7, 1.8, 24).at(2.2, 19.8, 82.0),
    kit.cylinder(5.1, 4.7, 1.8, 24).at(13.8, 19.8, 82.0),
    kit.box(3.2, 16.5, 7.6).at(4.8, 8.25, 82.0),
    kit.box(3.2, 16.5, 7.6).at(11.2, 8.25, 82.0),
    kit.box(7.2, 8.5, 7.6).at(8.0, 12.8, 82.0),
    kit.torus(2.8, 0.65, 180, 20).at(8.0, 6.2, 78.3),
    kit.torus(2.8, 0.65, 180, 20).at(8.0, 6.2, 85.7),
    ...kit.repeat(7, i => [
      kit.box(1.0, 1.1, 0.8).at(5.0 + i * 1.0, 17.5, 78.5),
      kit.box(1.0, 1.1, 0.8).at(5.0 + i * 1.0, 17.5, 85.5)
    ])
  ], 'warm_limestone_block')
  .add([
    kit.cone(5.5, 8.2, 24).at(2.2, 24.8, 82.0),
    kit.cone(5.5, 8.2, 24).at(13.8, 24.8, 82.0),
    kit.box(7.6, 0.35, 8.2).at(8.0, 17.2, 82.0)
  ], 'aged_red_roof_tiles')
  .add([
    ...kit.repeat(6, i => kit.cylinder(0.08, 0.08, 4.2, 8).at(6.0 + i * 0.8, 6.8, 84.8)),
    kit.box(4.6, 0.16, 0.16).at(8.0, 5.5, 84.8),
    kit.box(4.6, 0.16, 0.16).at(8.0, 7.2, 84.8),
    kit.box(0.4, 2.2, 0.18).at(2.2, 13.0, 86.8),
    kit.box(0.4, 2.2, 0.18).at(13.8, 13.0, 86.8)
  ], 'sooty_iron')
  .add([
    kit.box(2.2, 6.2, 0.35).at(5.6, 3.1, 83.2).rot(0, 68, 0),
    kit.box(2.2, 6.2, 0.35).at(10.4, 3.1, 83.2).rot(0, -68, 0)
  ], 'dark_wood')
  .add([
    kit.box(0.9, 3.4, 0.08).at(2.2, 16.5, 77.2),
    kit.box(0.9, 3.4, 0.08).at(13.8, 16.5, 77.2)
  ], 'crimson_fabric')
  .commit();
//@@
kit.object('ENV_city_gatehouse_north')
  .add([
    kit.cylinder(4.0, 4.5, 17.0, 20).at(-9.2, 8.5, -74.0),
    kit.cylinder(4.0, 4.5, 17.0, 20).at(1.2, 8.5, -74.0),
    kit.box(8.8, 7.2, 6.4).at(-4.0, 11.8, -74.0),
    kit.box(2.6, 15.0, 6.4).at(-6.8, 7.5, -74.0),
    kit.box(2.6, 15.0, 6.4).at(-1.2, 7.5, -74.0),
    kit.torus(2.4, 0.55, 180, 16).at(-4.0, 5.5, -71.0)
  ], 'stone_wall')
  .add([
    kit.cone(4.7, 7.2, 20).at(-9.2, 20.6, -74.0),
    kit.cone(4.7, 7.2, 20).at(1.2, 20.6, -74.0)
  ], 'slate_roof_tiles')
  .commit();
//@@
kit.object('ENV_city_walls_circuit')
  .add([
    ...(() => {
      const pts = [
        [14, 82],
        [46, 78],
        [68, 60],
        [76, 26],
        [74, -14],
        [58, -50],
        [28, -70],
        [2, -74],
        [-10, -74],
        [-42, -66],
        [-66, -42],
        [-74, -6],
        [-66, 28],
        [-46, 56],
        [-28, 76],
        [2, 82]
      ];
      const parts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (i === 7) continue;
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[i + 1];
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        const len = Math.hypot(x2 - x1, z2 - z1);
        const ang = (Math.atan2(x2 - x1, z2 - z1) * 180) / Math.PI;
        parts.push(kit.box(3.0, 11.2, len).at(mx, 5.6, mz).rot(0, ang, 0));
        parts.push(kit.box(0.55, 1.3, len).at(mx, 11.85, mz).rot(0, ang, 0));
        const merlons = Math.floor(len / 2.6);
        for (let m = 0; m < merlons; m++) {
          const t = (m + 0.5) / merlons - 0.5;
          const bx = mx + Math.sin((ang * Math.PI) / 180) * (t * len);
          const bz = mz + Math.cos((ang * Math.PI) / 180) * (t * len);
          parts.push(kit.box(3.2, 1.1, 1.2).at(bx, 11.75, bz).rot(0, ang, 0));
        }
      }
      return parts;
    })()
  ], 'stone_wall')
  .commit();
//@@
kit.object('ENV_city_wall_round_towers')
  .add([
    ...[
      [46, 78],
      [68, 60],
      [76, 26],
      [74, -14],
      [58, -50],
      [28, -70],
      [-42, -66],
      [-66, -42],
      [-74, -6],
      [-28, 76]
    ].flatMap(([tx, tz]) => [
      kit.cylinder(4.2, 4.8, 17.5, 20).at(tx, 8.75, tz),
      kit.cylinder(4.6, 4.2, 1.6, 20).at(tx, 17.8, tz),
      ...kit.repeat(8, k => {
        const a = (k * Math.PI) / 4;
        return kit.box(0.9, 1.0, 0.9).at(tx + Math.cos(a) * 4.1, 19.0, tz + Math.sin(a) * 4.1).rot(0, (-a * 180) / Math.PI, 0);
      })
    ])
  ], 'warm_limestone_block')
  .add([
    ...[
      [46, 78],
      [68, 60],
      [76, 26],
      [74, -14],
      [58, -50],
      [28, -70],
      [-42, -66],
      [-66, -42],
      [-74, -6],
      [-28, 76]
    ].map(([tx, tz], idx) =>
      kit.cone(5.0, 7.6, 20).at(tx, 22.4, tz)
    )
  ], 'terracotta_roof_tiles')
  .commit();
//@@
kit.object('ENV_castle_curtain_and_towers')
  .add([
    kit.box(26, 11.5, 2.6).at(-56, 21.5, 29.5),
    kit.box(26, 11.5, 2.6).at(-56, 21.5, 54.5),
    kit.box(2.6, 11.5, 25).at(-68.5, 21.5, 42.0),
    kit.box(2.6, 11.5, 25).at(-43.5, 21.5, 42.0),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      const tx = -56 + sx * 12.8;
      const tz = 42 + sz * 12.8;
      return [
        kit.cylinder(3.8, 4.4, 17.5, 20).at(tx, 24.5, tz),
        kit.cylinder(4.2, 3.8, 1.5, 20).at(tx, 33.6, tz)
      ];
    }),
    kit.cylinder(3.0, 3.4, 14.0, 16).at(-41.0, 21.5, 36.5),
    kit.cylinder(3.0, 3.4, 14.0, 16).at(-41.0, 21.5, 44.5),
    kit.box(3.5, 12.0, 8.0).at(-41.0, 20.5, 40.5)
  ], 'stone_wall')
  .add([
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      const tx = -56 + sx * 12.8;
      const tz = 42 + sz * 12.8;
      return kit.cone(4.5, 7.2, 20).at(tx, 37.9, tz);
    }),
    kit.cone(3.6, 5.5, 16).at(-41.0, 31.2, 36.5),
    kit.cone(3.6, 5.5, 16).at(-41.0, 31.2, 44.5)
  ], 'slate_roof_tiles')
  .commit();
//@@
kit.object('ENV_castle_keep')
  .add([
    kit.box(14.5, 4.0, 14.5).at(-56, 17.8, 42),
    kit.box(12.8, 22.5, 12.8).at(-56, 29.0, 42),
    kit.box(10.5, 13.0, 8.5).at(-56, 22.5, 33.2),
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return [
        kit.box(2.6, 26.5, 2.6).at(-56 + sx * 5.8, 29.2, 42 + sz * 5.8),
        kit.cylinder(1.8, 1.8, 5.5, 12).at(-56 + sx * 5.8, 43.2, 42 + sz * 5.8)
      ];
    }),
    ...kit.repeat(5, i => [
      kit.box(1.2, 1.3, 0.9).at(-61.0 + i * 2.5, 40.8, 35.8),
      kit.box(1.2, 1.3, 0.9).at(-61.0 + i * 2.5, 40.8, 48.2),
      kit.box(0.9, 1.3, 1.2).at(-49.8, 40.8, 37.0 + i * 2.5),
      kit.box(0.9, 1.3, 1.2).at(-62.2, 40.8, 37.0 + i * 2.5)
    ])
  ], 'warm_limestone_block')
  .add([
    ...kit.repeat(4, i => {
      const sx = i < 2 ? -1 : 1;
      const sz = i % 2 === 0 ? -1 : 1;
      return kit.cone(2.2, 5.2, 12).at(-56 + sx * 5.8, 48.5, 42 + sz * 5.8);
    }),
    kit.cone(8.2, 7.5, 4).at(-56, 44.0, 42).rot(0, 45, 0),
    kit.box(6.5, 0.3, 8.8).at(-53.2, 31.0, 33.2).rot(0, 0, -40),
    kit.box(6.5, 0.3, 8.8).at(-58.8, 31.0, 33.2).rot(0, 0, 40)
  ], 'slate_roof_tiles')
  .add([
    kit.cylinder(0.08, 0.08, 6.0, 8).at(-56, 50.5, 42),
    kit.box(2.4, 1.2, 0.08).at(-54.8, 52.4, 42)
  ], 'crimson_fabric')
  .add([
    ...kit.repeat(3, i => [
      kit.box(0.9, 2.2, 0.2).at(-59 + i * 3.0, 34.0, 35.5),
      kit.box(0.2, 2.2, 0.9).at(-49.5, 34.0, 39 + i * 3.0)
    ])
  ], 'stained_glass')
  .commit();
//@@
kit.object('ENV_city_trees_and_foliage')
  .add(
    [
      [-32, 0, 50],
      [-24, 0, 50.5],
      [34, 0, 50],
      [42, 0, 50.5],
      [-18, 0, -8],
      [18, 0, -8],
      [-18, 0, -34],
      [18, 0, -34],
      [-38, 4, 38],
      [-34, 2, 46],
      [-45, 8, 25],
      [-32, 0, 68],
      [38, 0, 68],
      [-8, 0, 67],
      [24, 0, 67]
    ].map(([tx, ty, tz]) => kit.cylinder(0.28, 0.42, 3.6, 8).at(tx, ty + 1.8, tz)),
    'bark'
  )
  .add(
    [
      [-32, 0, 50],
      [-24, 0, 50.5],
      [34, 0, 50],
      [42, 0, 50.5],
      [-18, 0, -8],
      [18, 0, -8],
      [-18, 0, -34],
      [18, 0, -34],
      [-38, 4, 38],
      [-34, 2, 46],
      [-45, 8, 25],
      [-32, 0, 68],
      [38, 0, 68],
      [-8, 0, 67],
      [24, 0, 67]
    ].flatMap(([tx, ty, tz], idx) =>
      idx % 3 === 0
        ? [kit.cone(1.6, 6.8, 10).at(tx, ty + 5.8, tz), kit.cone(1.2, 5.2, 10).at(tx, ty + 8.0, tz)]
        : [
            kit.sphere(2.1, 10).at(tx, ty + 4.8, tz).scale([1.1, 0.9, 1.1]),
            kit.sphere(1.6, 10).at(tx + 0.6, ty + 6.0, tz - 0.4),
            kit.sphere(1.5, 10).at(tx - 0.6, ty + 5.6, tz + 0.5)
          ]
    ),
    'foliage'
  )
  .commit();
//@@
kit.object('PRP_street_lanterns_and_banners')
  .add(
    [
      [-4, 0, 8],
      [12, 0, 8],
      [-6, 0, 28],
      [14, 0, 28],
      [4, 0, 38],
      [12, 0, 38],
      [4.4, 3.2, 52],
      [11.6, 3.2, 52],
      [4.4, 3.2, 64],
      [11.6, 3.2, 64],
      [4, 0, 76],
      [12, 0, 76]
    ].flatMap(([lx, ly, lz]) => [
      kit.cylinder(0.09, 0.14, 3.6, 8).at(lx, ly + 1.8, lz),
      kit.box(0.7, 0.08, 0.08).at(lx + 0.3, ly + 3.5, lz),
      kit.cylinder(0.2, 0.14, 0.38, 6).at(lx + 0.58, ly + 3.2, lz)
    ]),
    'sooty_iron'
  )
  .add(
    [
      [-4, 0, 8],
      [12, 0, 8],
      [-6, 0, 28],
      [14, 0, 28],
      [4, 0, 38],
      [12, 0, 38],
      [4.4, 3.2, 52],
      [11.6, 3.2, 52],
      [4.4, 3.2, 64],
      [11.6, 3.2, 64],
      [4, 0, 76],
      [12, 0, 76]
    ].map(([lx, ly, lz]) => kit.sphere(0.14, 8).at(lx + 0.58, ly + 3.2, lz)),
    'warm_lamp_light'
  )
  .commit();
//@@
kit.person('CHAR_merchant_1', { x: 1.5, z: 16.5, y: 0.22, rotY: 145, height: 1.75, pose: 'stand' });
//@@
kit.person('CHAR_merchant_2', { x: 7.2, z: 18.0, y: 0.22, rotY: -110, height: 1.72, pose: 'stand' });
//@@
kit.person('CHAR_townsperson_1', { x: 2.8, z: 23.5, y: 0.22, rotY: 35, height: 1.68, pose: 'stand' });
//@@
kit.person('CHAR_townsperson_2', { x: 6.4, z: 24.2, y: 0.22, rotY: -45, height: 1.78, pose: 'stand' });
//@@
kit.person('CHAR_bridge_traveler_1', { x: 7.4, z: 56.5, y: 3.35, rotY: 180, height: 1.76, pose: 'stand' });
//@@
kit.person('CHAR_bridge_traveler_2', { x: 8.6, z: 59.2, y: 3.35, rotY: 0, height: 1.7, pose: 'stand' });
//@@
kit.person('CHAR_gate_guard_1', { x: 5.8, z: 79.5, y: 0.2, rotY: 180, height: 1.82, pose: 'stand' });
//@@
kit.person('CHAR_gate_guard_2', { x: 10.2, z: 79.5, y: 0.2, rotY: 180, height: 1.82, pose: 'stand' });
//@@
kit.light('LGT_sun_golden_hour', {
  type: 'directional',
  pos: [-95, 38, 62],
  target: [0, 8, 22],
  color: '#ffae52',
  intensity: 2.6
});
//@@
kit.light('LGT_sky_ambient_fill', {
  type: 'directional',
  pos: [75, 88, -45],
  target: [0, 6, 20],
  color: '#88a8d8',
  intensity: 0.8
});
//@@
kit.light('LGT_sunset_rim', {
  type: 'directional',
  pos: [-65, 28, -85],
  target: [4, 16, 25],
  color: '#ff8438',
  intensity: 1.15
});
//@@
kit.light('LGT_market_square_glow', {
  type: 'point',
  pos: [4, 6.5, 20],
  color: '#ff9c3b',
  intensity: 22,
  distance: 38
});
//@@
kit.light('LGT_bridge_and_river_glow', {
  type: 'point',
  pos: [8, 7.5, 58],
  color: '#ffaa44',
  intensity: 18,
  distance: 34
});
//@@
kit.light('LGT_belfry_beam_warmth', {
  type: 'point',
  pos: [-5.0, 54.8, -8.5],
  color: '#ffaa48',
  intensity: 12,
  distance: 18
});
//@@
kit.camera('CAM_main', {
  pos: [-5.0, 55.2, -10.3],
  lookAt: [2.0, 19.0, 48.0],
  fov: 54
});
//@@
kit.camera('CAM_wide', {
  pos: [76.0, 64.0, 108.0],
  lookAt: [-8.0, 14.0, 8.0],
  fov: 42
});
//@@
kit.camera('CAM_castle_flyover', {
  pos: [-82.0, 52.0, 68.0],
  lookAt: [6.0, 16.0, 10.0],
  fov: 44
});
//@@
kit.camera('CAM_bridge_approach', {
  pos: [-16.0, 18.0, 72.0],
  lookAt: [2.0, 16.0, -5.0],
  fov: 46
});
//@@