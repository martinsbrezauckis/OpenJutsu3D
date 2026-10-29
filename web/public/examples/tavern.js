
//@@
kit.describe({ title: 'The Inn Cellar', setting: 'enclosed stone-vaulted tavern cellar beneath an old inn', style: 'realistic grey-box film set', era: 'old world', lighting: 'warm fire, lanterns and candles; no daylight', palette: 'rough stone, old brick, dark oak and packed earth', mood: 'low, intimate and moody' });
function cellarVaultBand(outerX, outerY, innerX, innerY, spring, depth) {
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI * i / 32;
    points.push([outerX * Math.cos(a), spring + outerY * Math.sin(a)]);
  }
  for (let i = 32; i >= 0; i--) {
    const a = Math.PI * i / 32;
    points.push([innerX * Math.cos(a), spring + innerY * Math.sin(a)]);
  }
  return kit.extrude(points, depth);
}
function cellarEndOutline() {
  const points = [[-4, 0], [4, 0], [4, 2.2]];
  for (let i = 1; i <= 32; i++) {
    const a = Math.PI * i / 32;
    points.push([4 * Math.cos(a), 2.2 + 2 * Math.sin(a)]);
  }
  return points;
}
//@@
kit.object('ENV_packed_earth_floor')
  .add(kit.box(8, 0.16, 18).at(0, -0.08, 0), 'packed_dirt')
  .commit();
//@@
kit.object('ENV_central_flagstones')
  .add(kit.repeat(76, i => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = -1.22 + col * 0.8 + 0.08 * Math.sin(i * 2.7);
    const z = -8.55 + row * 0.91 + 0.08 * Math.cos(i * 1.9);
    const w = 0.64 + 0.09 * Math.sin(i * 1.3);
    const d = 0.72 + 0.09 * Math.cos(i * 2.1);
    return kit.extrude([
      [-w * 0.48, -d * 0.5],
      [w * 0.38, -d * 0.5],
      [w * 0.5, -d * 0.32],
      [w * 0.47, d * 0.39],
      [w * 0.25, d * 0.5],
      [-w * 0.42, d * 0.46],
      [-w * 0.5, d * 0.2]
    ], 0.035).rot(90, 0, 0).at(x, 0.025, z);
  }), 'worn_stone_floor')
  .commit();
//@@
kit.object('ENV_side_walls')
  .add([
    kit.box(0.24, 2.2, 18.4).at(-4.12, 1.1, 0),
    kit.box(0.24, 2.2, 18.4).at(4.12, 1.1, 0)
  ], 'aged_stone_wall')
  .commit();
//@@
kit.object('ENV_end_walls')
  .add([
    kit.extrude(cellarEndOutline(), 0.24).at(0, 0, -9.24),
    kit.extrude(cellarEndOutline(), 0.24).at(0, 0, 9)
  ], 'aged_stone_wall')
  .commit();
//@@
kit.object('ENV_stone_barrel_vault')
  .add(cellarVaultBand(4.24, 2.24, 4, 2, 2.2, 18.48).at(0, 0, -9.24), 'aged_stone_block')
  .commit();
//@@
kit.object('ENV_six_brick_arches')
  .add(kit.repeat(6, i =>
    cellarVaultBand(4.02, 2.02, 3.82, 1.82, 2.2, 0.28).at(0, 0, -7.64 + i * 3)
  ), 'old_brick')
  .add(kit.repeat(12, i =>
    kit.box(0.19, 2.2, 0.28).at(i % 2 === 0 ? -3.91 : 3.91, 1.1, -7.5 + Math.floor(i / 2) * 3)
  ), 'old_brick')
  .commit();
//@@
kit.object('ENV_stone_hearth')
  .add([
    kit.box(3.2, 0.16, 1.15).at(0, 0.08, 8.35),
    kit.box(0.42, 1.55, 0.85).at(-1.34, 0.775, 8.52),
    kit.box(0.42, 1.55, 0.85).at(1.34, 0.775, 8.52),
    kit.box(3.1, 0.32, 0.95).at(0, 1.66, 8.5),
    kit.box(3.35, 0.14, 1.05).at(0, 1.89, 8.48)
  ], 'aged_stone_block')
  .add([
    kit.box(2.25, 1.45, 0.12).at(0, 0.8, 8.91),
    kit.box(2.8, 1.05, 0.47).at(0, 2.48, 8.76)
  ], 'sooty_stone_wall')
  .commit();
//@@
kit.object('ENV_staircase_and_landing')
  .add([
    ...kit.repeat(8, i => kit.box(1.05, 0.15, 0.32).at(-3.18, 0.075 + i * 0.15, -6.48 - i * 0.3)),
    kit.box(1.12, 0.16, 0.85).at(-3.18, 1.2, -8.82),
    kit.box(0.12, 1.2, 0.12).at(-2.67, 0.6, -8.55),
    kit.box(0.12, 0.6, 0.12).at(-2.67, 0.3, -7.25),
    kit.box(0.1, 0.1, 1.65).rot(-27, 0, 0).at(-2.67, 1.15, -7.92)
  ], 'worn_dark_wood')
  .commit();
//@@
kit.object('ENV_closed_cellar_door')
  .add([
    kit.box(1.03, 1.85, 0.12).at(-3.18, 2.2, -8.91),
    ...kit.repeat(5, i => kit.box(0.015, 1.75, 0.025).at(-3.59 + i * 0.205, 2.2, -8.83))
  ], 'aged_wood_planks')
  .add([
    kit.box(1.12, 0.1, 0.16).at(-3.18, 3.17, -8.9),
    kit.box(0.09, 1.95, 0.16).at(-3.74, 2.19, -8.9),
    kit.box(0.09, 1.95, 0.16).at(-2.62, 2.19, -8.9)
  ], 'dark_wood')
  .add([
    kit.box(0.8, 0.06, 0.04).at(-3.18, 1.65, -8.82),
    kit.box(0.8, 0.06, 0.04).at(-3.18, 2.75, -8.82),
    kit.sphere(0.055, 12).at(-2.88, 2.2, -8.78)
  ], 'blackened_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_01')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]], 24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4, i => kit.cylinder([0.51,0.59,0.59,0.51][i], [0.51,0.59,0.59,0.51][i], 0.055, 24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,-5.25).commit();
//@@
kit.object('PRP_wine_barrel_02')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,-3.65).commit();
//@@
kit.object('PRP_wine_barrel_03')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,-2.05).commit();
//@@
kit.object('PRP_wine_barrel_04')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,-0.45).commit();
//@@
kit.object('PRP_wine_barrel_05')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,1.15).commit();
//@@
kit.object('PRP_wine_barrel_06')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,2.75).commit();
//@@
kit.object('PRP_wine_barrel_07')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,4.35).commit();
//@@
kit.object('PRP_wine_barrel_08')
  .add(kit.lathe([[0.46,-0.55],[0.52,-0.45],[0.58,-0.2],[0.6,0],[0.58,0.2],[0.52,0.45],[0.46,0.55]],24).rot(90,0,0).at(0,0.85,0), 'aged_wood')
  .add(kit.repeat(4,i => kit.cylinder([0.51,0.59,0.59,0.51][i],[0.51,0.59,0.59,0.51][i],0.055,24).rot(90,0,0).at(0,0.85,-0.43+i*0.287)), 'tarnished_iron')
  .add([kit.box(1.05,0.16,0.2).at(0,0.08,-0.37),kit.box(1.05,0.16,0.2).at(0,0.08,0.37),kit.box(0.18,0.35,0.82).at(-0.36,0.175,0),kit.box(0.18,0.35,0.82).at(0.36,0.175,0)], 'dark_wood')
  .at(-3.18,0,5.95).commit();
//@@
kit.object('PRP_table_01')
  .add([
    kit.box(1.5, 0.1, 1.05).at(0, 0.75, 0),
    ...kit.repeat(4, i => kit.box(0.12, 0.7, 0.12).at(i < 2 ? -0.63 : 0.63, 0.35, i % 2 ? 0.42 : -0.42)),
    kit.box(1.24, 0.12, 0.08).at(0, 0.29, 0)
  ], 'worn_dark_wood')
  .at(1.55, 0, -5.1).commit();
//@@
kit.object('PRP_table_02')
  .add([
    kit.box(1.5, 0.1, 1.05).at(0, 0.75, 0),
    ...kit.repeat(4, i => kit.box(0.12, 0.7, 0.12).at(i < 2 ? -0.63 : 0.63, 0.35, i % 2 ? 0.42 : -0.42)),
    kit.box(1.24, 0.12, 0.08).at(0, 0.29, 0)
  ], 'worn_dark_wood')
  .at(1.55, 0, -1.8).commit();
//@@
kit.object('PRP_table_03')
  .add([
    kit.box(1.5, 0.1, 1.05).at(0, 0.75, 0),
    ...kit.repeat(4, i => kit.box(0.12, 0.7, 0.12).at(i < 2 ? -0.63 : 0.63, 0.35, i % 2 ? 0.42 : -0.42)),
    kit.box(1.24, 0.12, 0.08).at(0, 0.29, 0)
  ], 'worn_dark_wood')
  .at(1.55, 0, 1.5).commit();
//@@
kit.object('PRP_table_04')
  .add([
    kit.box(1.5, 0.1, 1.05).at(0, 0.75, 0),
    ...kit.repeat(4, i => kit.box(0.12, 0.7, 0.12).at(i < 2 ? -0.63 : 0.63, 0.35, i % 2 ? 0.42 : -0.42)),
    kit.box(1.24, 0.12, 0.08).at(0, 0.29, 0)
  ], 'worn_dark_wood')
  .at(1.55, 0, 4.8).commit();
//@@
kit.object('PRP_bench_01')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, -6.0).commit();
//@@
kit.object('PRP_bench_02')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, -4.2).commit();
//@@
kit.object('PRP_bench_03')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, -2.7).commit();
//@@
kit.object('PRP_bench_04')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, -0.9).commit();
//@@
kit.object('PRP_bench_05')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, 0.6).commit();
//@@
kit.object('PRP_bench_06')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, 2.4).commit();
//@@
kit.object('PRP_bench_07')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, 3.9).commit();
//@@
kit.object('PRP_bench_08')
  .add([
    kit.box(1.3, 0.08, 0.34).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.09, 0.41, 0.09).at(i < 2 ? -0.53 : 0.53, 0.205, i % 2 ? 0.11 : -0.11)),
    kit.box(1.05, 0.08, 0.08).at(0, 0.18, 0)
  ], 'worn_wood').at(1.55, 0, 5.7).commit();
//@@
kit.object('PRP_chair_01')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, -6.1, 90).commit();
//@@
kit.object('PRP_chair_02')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, -4.0, 90).commit();
//@@
kit.object('PRP_chair_03')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, -2.0, 90).commit();
//@@
kit.object('PRP_chair_04')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, 0.0, 90).commit();
//@@
kit.object('PRP_chair_05')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, 2.0, 90).commit();
//@@
kit.object('PRP_chair_06')
  .add([
    kit.box(0.46, 0.08, 0.46).at(0, 0.45, 0),
    ...kit.repeat(4, i => kit.box(0.07, 0.41, 0.07).at(i < 2 ? -0.19 : 0.19, 0.205, i % 2 ? 0.19 : -0.19)),
    ...kit.repeat(2, i => kit.box(0.07, 0.52, 0.07).at(i ? 0.19 : -0.19, 0.75, 0.19)),
    kit.box(0.46, 0.15, 0.07).at(0, 0.93, 0.19),
    kit.box(0.42, 0.12, 0.06).at(0, 0.7, 0.19)
  ], 'aged_wood').at(3.25, 0, 4.7, 90).commit();
//@@
kit.object('PRP_stacked_crates')
  .add(kit.repeat(6, i => {
    const col = i % 3;
    const level = Math.floor(i / 3);
    return [
      kit.box(0.55, 0.48, 0.52).at(-2.25 + col * 0.57, 0.24 + level * 0.48, -8.55),
      kit.box(0.55, 0.045, 0.035).at(-2.25 + col * 0.57, 0.12 + level * 0.48, -8.27),
      kit.box(0.55, 0.045, 0.035).at(-2.25 + col * 0.57, 0.36 + level * 0.48, -8.27)
    ];
  }), 'aged_wood_planks')
  .commit();
//@@
kit.object('PRP_cellar_sacks')
  .add(kit.repeat(8, i => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    return [
      kit.lathe([[0.16,0],[0.22,0.04],[0.24,0.2],[0.2,0.38],[0.11,0.46],[0.1,0.5]], 16)
        .at(-2.4 + col * 0.51, 0, -7.65 + row * 0.53),
      kit.sphere(0.11, 12).scale([1,0.45,1]).at(-2.4 + col * 0.51, 0.5, -7.65 + row * 0.53)
    ];
  }), 'worn_fabric')
  .commit();
//@@
kit.object('PRP_table_01_mugs_and_candles')
  .add(kit.repeat(3, i => [
    kit.lathe([[0,0],[0.065,0],[0.07,0.015],[0.075,0.14],[0.06,0.14],[0.055,0.025],[0,0.025]], 16).at(-0.45 + i * 0.42, 0.8, i === 1 ? 0.25 : -0.22),
    kit.torus(0.045, 0.012, 360, 16).at(-0.37 + i * 0.42, 0.875, i === 1 ? 0.25 : -0.22)
  ]), 'tarnished_silver')
  .add(kit.repeat(2, i => kit.cylinder(0.085, 0.09, 0.025, 16).at(i ? 0.4 : -0.15, 0.8125, 0.03)), 'blackened_iron')
  .add(kit.repeat(2, i => kit.cylinder(0.025, 0.03, i ? 0.13 : 0.17, 12).at(i ? 0.4 : -0.15, i ? 0.89 : 0.91, 0.03)), 'wax')
  .commit();
//@@
kit.object('PRP_table_02_mugs_and_candles')
  .add(kit.repeat(3, i => [
    kit.lathe([[0,0],[0.065,0],[0.07,0.015],[0.075,0.14],[0.06,0.14],[0.055,0.025],[0,0.025]], 16).at(-0.45 + i * 0.42, 0.8, -1.8 + (i === 1 ? 0.25 : -0.22)),
    kit.torus(0.045, 0.012, 360, 16).at(-0.37 + i * 0.42, 0.875, -1.8 + (i === 1 ? 0.25 : -0.22))
  ]), 'tarnished_silver')
  .add(kit.repeat(2, i => kit.cylinder(0.085, 0.09, 0.025, 16).at(i ? 0.4 : -0.15, 0.8125, -1.77)), 'blackened_iron')
  .add(kit.repeat(2, i => kit.cylinder(0.025, 0.03, i ? 0.13 : 0.17, 12).at(i ? 0.4 : -0.15, i ? 0.89 : 0.91, -1.77)), 'wax')
  .at(1.55, 0, 0).commit();
//@@
kit.object('PRP_table_03_mugs_and_candles')
  .add(kit.repeat(3, i => [
    kit.lathe([[0,0],[0.065,0],[0.07,0.015],[0.075,0.14],[0.06,0.14],[0.055,0.025],[0,0.025]], 16).at(-0.45 + i * 0.42, 0.8, i === 1 ? 0.25 : -0.22),
    kit.torus(0.045, 0.012, 360, 16).at(-0.37 + i * 0.42, 0.875, i === 1 ? 0.25 : -0.22)
  ]), 'tarnished_silver')
  .add(kit.repeat(2, i => kit.cylinder(0.085, 0.09, 0.025, 16).at(i ? 0.4 : -0.15, 0.8125, 0.03)), 'blackened_iron')
  .add(kit.repeat(2, i => kit.cylinder(0.025, 0.03, i ? 0.13 : 0.17, 12).at(i ? 0.4 : -0.15, i ? 0.89 : 0.91, 0.03)), 'wax')
  .at(1.55, 0, 1.5).commit();
//@@
kit.object('PRP_table_04_mugs_and_candles')
  .add(kit.repeat(3, i => [
    kit.lathe([[0,0],[0.065,0],[0.07,0.015],[0.075,0.14],[0.06,0.14],[0.055,0.025],[0,0.025]], 16).at(-0.45 + i * 0.42, 0.8, i === 1 ? 0.25 : -0.22),
    kit.torus(0.045, 0.012, 360, 16).at(-0.37 + i * 0.42, 0.875, i === 1 ? 0.25 : -0.22)
  ]), 'tarnished_silver')
  .add(kit.repeat(2, i => kit.cylinder(0.085, 0.09, 0.025, 16).at(i ? 0.4 : -0.15, 0.8125, 0.03)), 'blackened_iron')
  .add(kit.repeat(2, i => kit.cylinder(0.025, 0.03, i ? 0.13 : 0.17, 12).at(i ? 0.4 : -0.15, i ? 0.89 : 0.91, 0.03)), 'wax')
  .at(1.55, 0, 4.8).commit();
//@@
kit.actor('CHAR_innkeeper_by_hearth', {
  pos: [-2.15, 0, 8.05],
  rotY: 145,
  height: 1.78,
  action: 'idle'
});
//@@
kit.actor('CHAR_patron_talking_near', {
  pos: [1.55, 0, 3.9],
  rotY: 0,
  height: 1.75,
  action: 'sit_talk'
});
//@@
kit.actor('CHAR_patron_talking_far', {
  pos: [1.55, 0, 5.7],
  rotY: 180,
  height: 1.7,
  action: 'sit_talk'
});
//@@
kit.actor('CHAR_serving_maid_walking', {
  pos: [-1.7, 0, 6.9],
  height: 1.68,
  action: 'walk',
  path: [[-1.7, 6.9], [1.5, 6.9]],
  speed: 0.65
});
//@@
kit.object('PRP_serving_tray')
  .add([
    kit.cylinder(0.24, 0.22, 0.025, 32).at(1.55, 0.8125, -5.1),
    kit.torus(0.225, 0.012, 360, 32).rot(90, 0, 0).at(1.55, 0.835, -5.1)
  ], 'worn_wood')
  .commit();
//@@
kit.describe({ title: 'The Inn Cellar', setting: 'enclosed stone-vaulted tavern cellar beneath an old inn', style: 'realistic grey-box film set', era: 'old world', lighting: 'warm fire, lanterns and candles; no daylight', palette: 'rough stone, old brick, dark oak and packed earth', mood: 'low, intimate and moody', atmosphere: 'faint smoke haze beneath the vault' });
//@@
kit.object('PRP_low_hearth_fire')
  .add([
    kit.cylinder(0.085, 0.1, 0.85, 16).rot(0, 0, 65).at(-0.18, 0.25, 8.45),
    kit.cylinder(0.09, 0.1, 0.78, 16).rot(0, 0, -65).at(0.18, 0.26, 8.45),
    kit.cylinder(0.075, 0.09, 0.7, 16).rot(90, 0, 0).at(0, 0.24, 8.42)
  ], 'blackened_wood')
  .add([
    kit.sphere(0.12, 12).scale([2.6, 0.45, 1.3]).at(0, 0.22, 8.42),
    kit.cone(0.12, 0.36, 12).at(-0.22, 0.42, 8.42),
    kit.cone(0.15, 0.48, 12).at(0.04, 0.47, 8.43),
    kit.cone(0.1, 0.32, 12).at(0.28, 0.4, 8.42)
  ], 'ember')
  .commit();
//@@
kit.object('PRP_hanging_lantern_01')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, -7.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, -7.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, -7.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, -7.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, -7.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, -7.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, -7.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_hanging_lantern_02')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, -4.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, -4.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, -4.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, -4.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, -4.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, -4.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, -4.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_hanging_lantern_03')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, -1.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, -1.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, -1.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, -1.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, -1.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, -1.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, -1.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_hanging_lantern_04')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, 1.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, 1.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, 1.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, 1.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, 1.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, 1.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, 1.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_hanging_lantern_05')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, 4.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, 4.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, 4.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, 4.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, 4.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, 4.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, 4.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_hanging_lantern_06')
  .add([
    kit.cylinder(0.018, 0.018, 0.45, 12).at(0, 3.79, 7.5),
    kit.box(0.32, 0.045, 0.32).at(0, 3.53, 7.5),
    kit.box(0.28, 0.045, 0.28).at(0, 3.12, 7.5),
    ...kit.repeat(4, i => kit.box(0.025, 0.4, 0.025).at(i < 2 ? -0.13 : 0.13, 3.325, 7.5 + (i % 2 ? 0.13 : -0.13))),
    kit.cone(0.23, 0.14, 4).rot(0, 45, 0).at(0, 3.62, 7.5)
  ], 'blackened_iron')
  .add(kit.box(0.22, 0.3, 0.22).at(0, 3.33, 7.5), 'aged_glass')
  .add(kit.sphere(0.065, 12).at(0, 3.28, 7.5), 'lamp_light')
  .commit();
//@@
kit.object('PRP_candle_flames')
  .add([
    kit.cone(0.018, 0.055, 10).at(-0.15, 1.022, 0.03),
    kit.cone(0.018, 0.055, 10).at(0.4, 0.982, 0.03),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, -1.77),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, -1.77),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, 1.53),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, 1.53),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, 4.83),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, 4.83)
  ], 'lamp_light')
  .commit();
//@@
kit.light('LGT_hearth_fire', { type: 'point', pos: [0, 0.62, 8.05], color: '#ff8b3d', intensity: 24, distance: 7 });
//@@
kit.light('LGT_lantern_near', { type: 'point', pos: [0, 3.28, -7.5], color: '#ffbd70', intensity: 11, distance: 5 });
//@@
kit.light('LGT_lantern_mid_near', { type: 'point', pos: [0, 3.28, -4.5], color: '#ffbd70', intensity: 11, distance: 5 });
//@@
kit.light('LGT_lantern_mid', { type: 'point', pos: [0, 3.28, -1.5], color: '#ffbd70', intensity: 11, distance: 5 });
//@@
kit.light('LGT_lantern_mid_far', { type: 'point', pos: [0, 3.28, 1.5], color: '#ffbd70', intensity: 11, distance: 5 });
//@@
kit.light('LGT_lantern_far', { type: 'point', pos: [0, 3.28, 4.5], color: '#ffbd70', intensity: 11, distance: 5 });
//@@
kit.light('LGT_lantern_hearth', { type: 'point', pos: [0, 3.28, 7.5], color: '#ffbd70', intensity: 9, distance: 5 });
//@@
kit.light('LGT_candles_table_two', { type: 'point', pos: [1.67, 1.04, -1.77], color: '#ffb35d', intensity: 5, distance: 2.3 });
//@@
kit.light('LGT_candles_table_three', { type: 'point', pos: [1.67, 1.04, 1.53], color: '#ffb35d', intensity: 5, distance: 2.3 });
//@@
kit.light('LGT_candles_table_four', { type: 'point', pos: [1.67, 1.04, 4.83], color: '#ffb35d', intensity: 5, distance: 2.3 });
//@@
kit.camera('CAM_main', { pos: [0, 1.65, -8.1], lookAt: [0, 1.45, 8.3], fov: 54 });
//@@
kit.camera('CAM_table', { pos: [3.55, 1.25, 2.9], lookAt: [1.55, 0.95, 4.8], fov: 48 });
//@@
kit.camera('CAM_barrels', { pos: [-2.15, 0.7, -6.8], lookAt: [-3.05, 0.9, 5.4], fov: 45 });
//@@
kit.object('PRP_wine_barrel_01_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, -5.25 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, -5.25 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_02_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, -3.65 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, -3.65 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_03_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, -2.05 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, -2.05 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_04_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, -0.45 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, -0.45 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_05_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, 1.15 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, 1.15 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_06_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, 2.75 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, 2.75 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_07_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, 4.35 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, 4.35 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.object('PRP_wine_barrel_08_heads')
  .add(kit.repeat(2, i => kit.cylinder(0.46, 0.46, 0.025, 24).rot(90, 0, 0).at(-3.18, 0.85, 5.95 + (i ? 0.53 : -0.53))), 'aged_wood')
  .add(kit.repeat(2, i => kit.torus(0.46, 0.018, 360, 32).at(-3.18, 0.85, 5.95 + (i ? 0.55 : -0.55))), 'tarnished_iron')
  .commit();
//@@
kit.actor('CHAR_patron_talking_near', {
  pos: [1.5, 0.04, 3.9],
  rotY: 0,
  height: 1.75,
  action: 'sit_talk'
});
//@@
//@@
// Fix: table one's mugs and candles stood in the aisle (no .at()), now on table one, with their flames and light
kit.object('PRP_table_01_mugs_and_candles')
  .add(kit.repeat(3, i => [
    kit.lathe([[0,0],[0.065,0],[0.07,0.015],[0.075,0.14],[0.06,0.14],[0.055,0.025],[0,0.025]], 16).at(-0.45 + i * 0.42, 0.8, i === 1 ? 0.25 : -0.22),
    kit.torus(0.045, 0.012, 360, 16).at(-0.37 + i * 0.42, 0.875, i === 1 ? 0.25 : -0.22)
  ]), 'tarnished_silver')
  .add(kit.repeat(2, i => kit.cylinder(0.085, 0.09, 0.025, 16).at(i ? 0.4 : -0.15, 0.8125, 0.03)), 'blackened_iron')
  .add(kit.repeat(2, i => kit.cylinder(0.025, 0.03, i ? 0.13 : 0.17, 12).at(i ? 0.4 : -0.15, i ? 0.89 : 0.91, 0.03)), 'wax')
  .at(1.55, 0, -5.1).commit();
//@@
kit.object('PRP_candle_flames')
  .add([
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, -5.07),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, -5.07),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, -1.77),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, -1.77),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, 1.53),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, 1.53),
    kit.cone(0.018, 0.055, 10).at(1.4, 1.022, 4.83),
    kit.cone(0.018, 0.055, 10).at(1.95, 0.982, 4.83)
  ], 'lamp_light')
  .commit();
//@@
kit.light('LGT_candles_table_one', { type: 'point', pos: [1.67, 1.04, -5.07], color: '#ffb35d', intensity: 5, distance: 2.3 });
