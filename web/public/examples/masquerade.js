
//@@
kit.describe({
  title: 'The Grand Hotel Masquerade',
  setting: 'Closed 24 by 30 metre grand hotel lobby, twelve metre ceilings, entrance to the south and grand staircase to the north',
  style: 'Whimsical photoreal 1930s luxury, monumental silhouettes and delicate Art Deco architecture',
  era: '1930s',
  lighting: 'Warm golden-hour sunlight through six tall south-facing arched windows',
  palette: 'Pastel pink plaster, mint-green trim, cream marble and aged brass',
  mood: 'Joyful, elegant and festive'
});
kit.define('pastel_pink_plaster', { base: 'plaster', color: '#e9b5be', roughness: 0.78 });
kit.define('pale_cream_marble', { base: 'marble', color: '#eee3cf', roughness: 0.24 });
kit.define('mint_green_paint', { base: 'paint', color: '#afcfc0', roughness: 0.42 });
kit.define('clear_window_glass', { base: 'glass', color: '#f4eee0', roughness: 0.04, transmission: 0.96 });
function hotelArchOutline(cx, bottom, spring, radius, samples = 32) {
  const points = [[cx - radius, bottom], [cx + radius, bottom]];
  for (let i = 0; i <= samples; i++) {
    const a = Math.PI * i / samples;
    points.push([cx + radius * Math.cos(a), spring + radius * Math.sin(a)]);
  }
  return points;
}
function hotelArchCurve(cx, spring, radius, z, samples = 32) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const a = Math.PI * i / samples;
    points.push([cx + radius * Math.cos(a), spring + radius * Math.sin(a), z]);
  }
  return points;
}
function hotelWindowFrame(cx) {
  return [
    kit.box(0.10, 6.3, 0.15).at(cx - 1.05, 4.25, 14.97),
    kit.box(0.10, 6.3, 0.15).at(cx + 1.05, 4.25, 14.97),
    kit.box(2.20, 0.12, 0.18).at(cx, 1.12, 14.97),
    kit.box(2.10, 0.08, 0.13).at(cx, 7.4, 14.97),
    kit.box(2.10, 0.07, 0.13).at(cx, 4.55, 14.97),
    kit.box(0.07, 7.31, 0.13).at(cx, 4.805, 14.97),
    kit.tube(hotelArchCurve(cx, 7.4, 1.05, 14.97), 0.055, 48)
  ];
}
function hotelBalconyBalusters(startX, endX) {
  return kit.repeat(20, i => {
    const x = startX + (endX - startX) * i / 19;
    return kit.lathe([
      [0.075, 0],
      [0.075, 0.09],
      [0.047, 0.15],
      [0.042, 0.63],
      [0.07, 0.72],
      [0.07, 0.82]
    ], 12).at(x, 5.14, -13.03);
  });
}
function hotelLiftPosts() {
  return [
    ...kit.repeat(4, i => {
      const x = i < 2 ? -1.46 : 1.46;
      const z = i % 2 === 0 ? -1.52 : 1.52;
      return kit.cylinder(0.085, 0.11, 3.55, 16).at(x, 1.925, z);
    }),
    kit.box(3.10, 0.14, 0.14).at(0, 3.68, 1.52),
    kit.box(3.10, 0.14, 0.14).at(0, 3.68, -1.52),
    kit.box(0.14, 0.14, 3.18).at(-1.46, 3.68, 0),
    kit.box(0.14, 0.14, 3.18).at(1.46, 3.68, 0),
    kit.cylinder(0.14, 0.20, 0.22, 20).at(0, 4.49, 0),
    kit.sphere(0.12, 16).at(0, 4.66, 0),
    ...kit.repeat(8, i => {
      const a = Math.PI * 2 * i / 8;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r = Math.min(1.46 / Math.max(Math.abs(c), 0.0001), 1.52 / Math.max(Math.abs(s), 0.0001));
      return kit.tube([
        [r * c, 3.70, r * s],
        [r * 0.86 * c, 4.00, r * 0.86 * s],
        [r * 0.43 * c, 4.31, r * 0.43 * s],
        [0, 4.40, 0]
      ], 0.045, 32);
    })
  ];
}
//@@
kit.object('ENV_lobby_foundation')
  .add(kit.box(24.8, 0.40, 30.8).at(0, -0.20, 0), 'concrete')
  .commit();
//@@
kit.object('ENV_west_lobby_wall')
  .add(kit.box(0.40, 12, 30.8).at(-12.20, 6, 0), 'pastel_pink_plaster')
  .commit();
//@@
kit.object('ENV_east_lobby_wall')
  .add(kit.box(0.40, 12, 30.8).at(12.20, 6, 0), 'pastel_pink_plaster')
  .commit();
//@@
kit.object('ENV_north_lobby_wall')
  .add(kit.box(24, 12, 0.40).at(0, 6, -15.20), 'pastel_pink_plaster')
  .commit();
//@@
{
  const openings = [-9.4, -6.4, -3.4, 3.4, 6.4, 9.4].map(x =>
    hotelArchOutline(x, 1.1, 7.4, 1.1).reverse()
  );
  openings.push(hotelArchOutline(0, 0, 3.6, 1.8).reverse());
  kit.object('ENV_south_arched_window_wall')
    .add(
      kit.extrude([[-12, 0], [12, 0], [12, 12], [-12, 12]], 0.40, openings).at(0, 0, 15),
      'pastel_pink_plaster'
    )
    .commit();
}
//@@
kit.object('ENV_lobby_ceiling')
  .add(kit.box(24.8, 0.40, 30.8).at(0, 12.20, 0), 'pastel_pink_plaster')
  .add([
    kit.box(21.6, 0.08, 0.18).at(0, 11.96, -12.7),
    kit.box(21.6, 0.08, 0.18).at(0, 11.96, 12.7),
    kit.box(0.18, 0.08, 25.4).at(-10.8, 11.96, 0),
    kit.box(0.18, 0.08, 25.4).at(10.8, 11.96, 0),
    kit.cylinder(0.85, 0.85, 0.10, 48).at(0, 11.95, 2)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_far_west')
  .add(kit.extrude(hotelArchOutline(-9.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(-9.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(-9.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_middle_west')
  .add(kit.extrude(hotelArchOutline(-6.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(-6.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(-6.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_inner_west')
  .add(kit.extrude(hotelArchOutline(-3.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(-3.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(-3.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_inner_east')
  .add(kit.extrude(hotelArchOutline(3.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(3.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(3.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_middle_east')
  .add(kit.extrude(hotelArchOutline(6.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(6.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(6.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_window_far_east')
  .add(kit.extrude(hotelArchOutline(9.4, 1.1, 7.4, 1.1), 0.035).at(0, 0, 15.16), 'clear_window_glass')
  .add(hotelWindowFrame(9.4), 'mint_green_paint')
  .add(kit.box(2.42, 0.16, 0.46).at(9.4, 1.02, 14.91), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_south_double_entrance')
  .add(kit.extrude(hotelArchOutline(0, 0, 3.6, 1.8), 0.045).at(0, 0, 15.18), 'clear_window_glass')
  .add([
    kit.box(0.15, 3.6, 0.22).at(-1.73, 1.8, 15.05),
    kit.box(0.15, 3.6, 0.22).at(1.73, 1.8, 15.05),
    kit.box(0.12, 3.6, 0.18).at(0, 1.8, 15.05),
    kit.box(3.6, 0.16, 0.22).at(0, 3.6, 15.05),
    kit.box(3.6, 0.14, 0.20).at(0, 0.07, 15.05),
    kit.box(1.60, 0.65, 0.17).at(-0.87, 0.47, 15.08),
    kit.box(1.60, 0.65, 0.17).at(0.87, 0.47, 15.08),
    kit.tube(hotelArchCurve(0, 3.6, 1.73, 15.05), 0.075, 48)
  ], 'mint_green_paint')
  .add([
    kit.tube([[-0.22, 1.06, 14.92], [-0.22, 1.06, 14.82], [-0.22, 1.62, 14.82], [-0.22, 1.62, 14.92]], 0.025, 24),
    kit.tube([[0.22, 1.06, 14.92], [0.22, 1.06, 14.82], [0.22, 1.62, 14.82], [0.22, 1.62, 14.92]], 0.025, 24)
  ], 'polished_brass')
  .commit();
//@@
kit.object('ENV_grand_central_staircase')
  .add(kit.repeat(25, i => {
    const height = (i + 1) * 0.20;
    return kit.box(8, height, 0.40).at(0, height / 2, -3.20 - i * 0.40);
  }), 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_north_balcony_deck')
  .add([
    kit.box(24, 0.40, 2).at(0, 4.80, -14),
    kit.box(24, 0.20, 0.22).at(0, 4.52, -13.05),
    kit.box(7.9, 0.12, 0.28).at(-8.05, 4.98, -13.05),
    kit.box(7.9, 0.12, 0.28).at(8.05, 4.98, -13.05)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_support_west_inner')
  .add([
    kit.box(0.70, 0.20, 0.70).at(-5.1, 0.10, -13.70),
    kit.box(0.46, 4.12, 0.46).at(-5.1, 2.26, -13.70),
    kit.box(0.70, 0.28, 0.70).at(-5.1, 4.46, -13.70)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_support_east_inner')
  .add([
    kit.box(0.70, 0.20, 0.70).at(5.1, 0.10, -13.70),
    kit.box(0.46, 4.12, 0.46).at(5.1, 2.26, -13.70),
    kit.box(0.70, 0.28, 0.70).at(5.1, 4.46, -13.70)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_support_west_outer')
  .add([
    kit.box(0.70, 0.20, 0.70).at(-10.7, 0.10, -13.70),
    kit.box(0.46, 4.12, 0.46).at(-10.7, 2.26, -13.70),
    kit.box(0.70, 0.28, 0.70).at(-10.7, 4.46, -13.70)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_support_east_outer')
  .add([
    kit.box(0.70, 0.20, 0.70).at(10.7, 0.10, -13.70),
    kit.box(0.46, 4.12, 0.46).at(10.7, 2.26, -13.70),
    kit.box(0.70, 0.28, 0.70).at(10.7, 4.46, -13.70)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_west_balustrade')
  .add([
    kit.box(7.90, 0.14, 0.22).at(-8.05, 5.07, -13.03),
    ...hotelBalconyBalusters(-11.78, -4.32),
    kit.box(7.90, 0.14, 0.28).at(-8.05, 6.03, -13.03),
    kit.box(0.26, 1.10, 0.28).at(-4.22, 5.55, -13.03)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_balcony_east_balustrade')
  .add([
    kit.box(7.90, 0.14, 0.22).at(8.05, 5.07, -13.03),
    ...hotelBalconyBalusters(4.32, 11.78),
    kit.box(7.90, 0.14, 0.28).at(8.05, 6.03, -13.03),
    kit.box(0.26, 1.10, 0.28).at(4.22, 5.55, -13.03)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_staircase_west_balustrade')
  .add([
    ...kit.repeat(25, i => kit.cylinder(0.045, 0.065, 0.90, 12)
      .at(-3.87, (i + 1) * 0.20 + 0.45, -3.20 - i * 0.40)),
    kit.tube([[-3.87, 1.10, -3.20], [-3.87, 5.90, -12.80], [-4.22, 6.03, -13.03]], 0.085, 64),
    kit.box(0.30, 1.02, 0.30).at(-3.87, 0.71, -3.20),
    kit.sphere(0.19, 20).at(-3.87, 1.37, -3.20)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('ENV_staircase_east_balustrade')
  .add([
    ...kit.repeat(25, i => kit.cylinder(0.045, 0.065, 0.90, 12)
      .at(3.87, (i + 1) * 0.20 + 0.45, -3.20 - i * 0.40)),
    kit.tube([[3.87, 1.10, -3.20], [3.87, 5.90, -12.80], [4.22, 6.03, -13.03]], 0.085, 64),
    kit.box(0.30, 1.02, 0.30).at(3.87, 0.71, -3.20),
    kit.sphere(0.19, 20).at(3.87, 1.37, -3.20)
  ], 'pale_cream_marble')
  .commit();
//@@
kit.object('MACH_west_birdcage_lift_structure')
  .add([
    kit.box(3.28, 0.15, 3.40).at(0, 0.075, 0),
    kit.box(2.98, 0.055, 3.10).at(0, 0.1775, 0)
  ], 'pale_cream_marble')
  .add(hotelLiftPosts(), 'aged_brass')
  .add([
    kit.box(2.84, 3.35, 0.06).at(0, 1.88, -1.53),
    kit.box(0.06, 3.35, 2.98).at(-1.47, 1.88, 0),
    kit.box(0.06, 3.35, 2.98).at(1.47, 1.88, 0)
  ], 'clear_window_glass')
  .at(-8.3, 0, -13.1, 0)
  .commit();
//@@
kit.object('MACH_east_birdcage_lift_structure')
  .add([
    kit.box(3.28, 0.15, 3.40).at(0, 0.075, 0),
    kit.box(2.98, 0.055, 3.10).at(0, 0.1775, 0)
  ], 'pale_cream_marble')
  .add(hotelLiftPosts(), 'aged_brass')
  .add([
    kit.box(2.84, 3.35, 0.06).at(0, 1.88, -1.53),
    kit.box(0.06, 3.35, 2.98).at(-1.47, 1.88, 0),
    kit.box(0.06, 3.35, 2.98).at(1.47, 1.88, 0)
  ], 'clear_window_glass')
  .at(8.3, 0, -13.1, 0)
  .commit();
//@@
kit.define('polished_rose_marble', { base: 'marble', color: '#dfa7b2', roughness: 0.19 });
kit.define('crimson_velvet_fabric', { base: 'fabric', color: '#9f203e', roughness: 0.88 });
kit.define('gold_woven_fabric', { base: 'fabric', color: '#d5b36c', roughness: 0.65 });
function hotelLiftBrassDetails() {
  return [
    ...kit.repeat(13, i => {
      const p = -1.32 + i * 0.22;
      return [
        kit.cylinder(0.019, 0.019, 3.20, 10).at(p, 1.91, -1.48),
        kit.cylinder(0.019, 0.019, 3.20, 10).at(-1.42, 1.91, p),
        kit.cylinder(0.019, 0.019, 3.20, 10).at(1.42, 1.91, p)
      ];
    }),
    ...kit.repeat(3, i => {
      const y = 0.36 + i * 1.55;
      return [
        kit.box(2.86, 0.045, 0.055).at(0, y, -1.48),
        kit.box(0.055, 0.045, 2.96).at(-1.42, y, 0),
        kit.box(0.055, 0.045, 2.96).at(1.42, y, 0)
      ];
    }),
    kit.box(2.84, 0.08, 0.09).at(0, 0.29, 1.49),
    kit.box(2.84, 0.08, 0.09).at(0, 3.49, 1.49),
    kit.box(0.055, 3.12, 0.07).at(0, 1.89, 1.49),
    ...kit.repeat(9, i =>
      kit.cylinder(0.016, 0.016, 3.12, 10).at(-1.36 + i * 0.34, 1.89, 1.49)
    ),
    ...kit.repeat(48, i => {
      const x = -1.19 + (i % 8) * 0.34;
      const y = 0.62 + Math.floor(i / 8) * 0.49;
      return kit.tube([
        [x, y - 0.245, 1.51],
        [x + 0.17, y, 1.51],
        [x, y + 0.245, 1.51],
        [x - 0.17, y, 1.51]
      ], 0.012, 16, true);
    }),
    kit.tube([[-0.13, 1.45, 1.52], [-0.13, 1.45, 1.62], [-0.13, 1.79, 1.62], [-0.13, 1.79, 1.52]], 0.022, 20),
    kit.tube([[0.13, 1.45, 1.52], [0.13, 1.45, 1.62], [0.13, 1.79, 1.62], [0.13, 1.79, 1.52]], 0.022, 20),
    ...kit.repeat(4, i => {
      const x = i < 2 ? -1.46 : 1.46;
      const z = i % 2 ? 1.52 : -1.52;
      return [
        kit.cylinder(0.14, 0.14, 0.10, 20).at(x, 0.36, z),
        kit.cylinder(0.125, 0.125, 0.10, 20).at(x, 3.47, z),
        kit.sphere(0.10, 16).at(x, 3.82, z)
      ];
    }),
    kit.tube([[-1.46, 3.96, 1.11], [0, 4.16, 1.11], [1.46, 3.96, 1.11]], 0.025, 32),
    kit.box(0.92, 0.31, 0.07).at(0, 3.70, 1.61)
  ];
}
{
  const roseTiles = [];
  const creamTiles = [];
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 16; col++) {
      const tile = kit.box(1.5, 0.024, 1.5)
        .at(-11.25 + col * 1.5, 0.012, -14.25 + row * 1.5);
      ((row + col) % 2 === 0 ? creamTiles : roseTiles).push(tile);
    }
  }
  kit.object('ENV_checkerboard_marble_floor')
    .add(creamTiles, 'pale_cream_marble')
    .add(roseTiles, 'polished_rose_marble')
    .commit();
}
//@@
{
  const carpet = [
    kit.box(5.50, 0.016, 1.80).at(0, 0.032, -2.10),
    kit.box(5.50, 0.016, 1.98).at(0, 5.008, -14.00)
  ];
  const borders = [
    kit.box(0.075, 0.004, 1.80).at(-2.59, 0.042, -2.10),
    kit.box(0.075, 0.004, 1.80).at(2.59, 0.042, -2.10),
    kit.box(0.075, 0.004, 1.98).at(-2.59, 5.018, -14.00),
    kit.box(0.075, 0.004, 1.98).at(2.59, 5.018, -14.00),
    kit.box(5.25, 0.004, 0.075).at(0, 0.042, -1.30)
  ];
  const rods = [];
  for (let i = 0; i < 25; i++) {
    const top = (i + 1) * 0.20;
    const z = -3.20 - i * 0.40;
    const bottom = i === 0 ? 0.04 : i * 0.20 + 0.016;
    carpet.push(
      kit.box(5.50, 0.016, 0.40).at(0, top + 0.008, z),
      kit.box(5.50, top - bottom, 0.016).at(0, (top + bottom) / 2, z + 0.208)
    );
    for (const x of [-2.59, 2.59]) {
      borders.push(
        kit.box(0.075, 0.004, 0.40).at(x, top + 0.018, z),
        kit.box(0.075, top - bottom, 0.004).at(x, (top + bottom) / 2, z + 0.218)
      );
    }
    rods.push(
      kit.cylinder(0.018, 0.018, 5.78, 12).rot(0, 0, 90).at(0, bottom + 0.023, z + 0.242),
      kit.sphere(0.035, 12).at(-2.91, bottom + 0.023, z + 0.242),
      kit.sphere(0.035, 12).at(2.91, bottom + 0.023, z + 0.242)
    );
  }
  kit.object('PRP_grand_stair_crimson_carpet')
    .add(carpet, 'crimson_velvet_fabric')
    .add(borders, 'gold_woven_fabric')
    .add(rods, 'polished_brass')
    .commit();
}
//@@
kit.object('ENV_west_mint_wall_mouldings')
  .add([
    kit.box(0.16, 0.28, 30).at(-11.92, 0.164, 0),
    kit.box(0.12, 0.10, 30).at(-11.94, 1.12, 0),
    kit.box(0.16, 0.13, 30).at(-11.92, 3.20, 0),
    kit.box(0.16, 0.16, 30).at(-11.92, 10.65, 0),
    kit.box(0.24, 0.22, 30).at(-11.88, 11.62, 0),
    kit.box(0.36, 0.16, 30).at(-11.82, 11.83, 0),
    ...kit.repeat(7, i => {
      const z = -13.5 + i * 4.5;
      return [
        kit.box(0.14, 10.98, 0.32).at(-11.93, 5.80, z),
        kit.box(0.24, 0.25, 0.56).at(-11.88, 10.48, z),
        kit.box(0.22, 0.28, 0.52).at(-11.89, 0.45, z)
      ];
    }),
    ...kit.repeat(6, i => {
      const z = -11.25 + i * 4.5;
      return [
        kit.box(0.055, 0.065, 3.50).at(-11.96, 4.02, z),
        kit.box(0.055, 0.065, 3.50).at(-11.96, 9.70, z),
        kit.box(0.055, 5.68, 0.065).at(-11.96, 6.86, z - 1.75),
        kit.box(0.055, 5.68, 0.065).at(-11.96, 6.86, z + 1.75)
      ];
    })
  ], 'mint_green_paint')
  .add(kit.box(0.045, 0.035, 30).at(-11.785, 11.72, 0), 'polished_brass')
  .commit();
//@@
kit.object('ENV_east_mint_wall_mouldings')
  .add([
    kit.box(0.16, 0.28, 30).at(11.92, 0.164, 0),
    kit.box(0.12, 0.10, 30).at(11.94, 1.12, 0),
    kit.box(0.16, 0.13, 30).at(11.92, 3.20, 0),
    kit.box(0.16, 0.16, 30).at(11.92, 10.65, 0),
    kit.box(0.24, 0.22, 30).at(11.88, 11.62, 0),
    kit.box(0.36, 0.16, 30).at(11.82, 11.83, 0),
    ...kit.repeat(7, i => {
      const z = -13.5 + i * 4.5;
      return [
        kit.box(0.14, 10.98, 0.32).at(11.93, 5.80, z),
        kit.box(0.24, 0.25, 0.56).at(11.88, 10.48, z),
        kit.box(0.22, 0.28, 0.52).at(11.89, 0.45, z)
      ];
    }),
    ...kit.repeat(6, i => {
      const z = -11.25 + i * 4.5;
      return [
        kit.box(0.055, 0.065, 3.50).at(11.96, 4.02, z),
        kit.box(0.055, 0.065, 3.50).at(11.96, 9.70, z),
        kit.box(0.055, 5.68, 0.065).at(11.96, 6.86, z - 1.75),
        kit.box(0.055, 5.68, 0.065).at(11.96, 6.86, z + 1.75)
      ];
    })
  ], 'mint_green_paint')
  .add(kit.box(0.045, 0.035, 30).at(11.785, 11.72, 0), 'polished_brass')
  .commit();
//@@
kit.object('ENV_north_mint_wall_mouldings')
  .add([
    kit.box(24, 0.28, 0.16).at(0, 0.164, -14.92),
    kit.box(24, 0.18, 0.14).at(0, 5.10, -14.93),
    kit.box(24, 0.16, 0.16).at(0, 10.65, -14.92),
    kit.box(24, 0.22, 0.24).at(0, 11.62, -14.88),
    kit.box(24, 0.16, 0.36).at(0, 11.83, -14.82),
    ...kit.repeat(5, i => {
      const x = -9.60 + i * 4.80;
      return [
        kit.box(3.90, 0.08, 0.08).at(x, 5.66, -14.94),
        kit.box(3.90, 0.08, 0.08).at(x, 9.88, -14.94),
        kit.box(0.08, 4.22, 0.08).at(x - 1.95, 7.77, -14.94),
        kit.box(0.08, 4.22, 0.08).at(x + 1.95, 7.77, -14.94)
      ];
    })
  ], 'mint_green_paint')
  .add(kit.box(23.60, 0.035, 0.045).at(0, 11.72, -14.785), 'polished_brass')
  .commit();
//@@
kit.object('ENV_south_mint_arch_surrounds')
  .add([
    kit.box(10.10, 0.28, 0.16).at(-6.95, 0.164, 14.92),
    kit.box(10.10, 0.28, 0.16).at(6.95, 0.164, 14.92),
    kit.box(24, 0.16, 0.16).at(0, 10.65, 14.92),
    kit.box(24, 0.22, 0.24).at(0, 11.62, 14.88),
    kit.box(24, 0.16, 0.36).at(0, 11.83, 14.82),
    ...[-9.4, -6.4, -3.4, 3.4, 6.4, 9.4].flatMap(x => [
      kit.box(0.14, 6.35, 0.16).at(x - 1.23, 4.225, 14.92),
      kit.box(0.14, 6.35, 0.16).at(x + 1.23, 4.225, 14.92),
      kit.tube(hotelArchCurve(x, 7.4, 1.23, 14.92), 0.075, 48),
      kit.box(0.28, 0.32, 0.24).at(x, 8.65, 14.88),
      kit.box(0.31, 0.15, 0.22).at(x - 1.23, 7.37, 14.89),
      kit.box(0.31, 0.15, 0.22).at(x + 1.23, 7.37, 14.89)
    ]),
    kit.box(0.16, 3.60, 0.20).at(-1.96, 1.80, 14.90),
    kit.box(0.16, 3.60, 0.20).at(1.96, 1.80, 14.90),
    kit.tube(hotelArchCurve(0, 3.6, 1.96, 14.90), 0.085, 48),
    kit.box(0.34, 0.42, 0.25).at(0, 5.58, 14.87)
  ], 'mint_green_paint')
  .add([
    kit.box(23.60, 0.035, 0.045).at(0, 11.72, 14.785),
    ...[-9.4, -6.4, -3.4, 3.4, 6.4, 9.4].map(x =>
      kit.tube(hotelArchCurve(x, 7.4, 1.34, 14.91), 0.018, 48)
    )
  ], 'polished_brass')
  .commit();
//@@
kit.object('ENV_balcony_mint_fascia_details')
  .add([
    kit.box(24, 0.14, 0.08).at(0, 4.73, -12.96),
    kit.box(24, 0.075, 0.10).at(0, 4.44, -12.91),
    ...kit.repeat(24, i =>
      kit.box(0.16, 0.15, 0.13).at(-11.50 + i, 4.57, -12.91)
    ),
    kit.box(7.84, 0.055, 0.18).at(-8.08, 6.125, -13.03),
    kit.box(7.84, 0.055, 0.18).at(8.08, 6.125, -13.03)
  ], 'mint_green_paint')
  .add([
    kit.box(7.84, 0.025, 0.22).at(-8.08, 6.165, -13.03),
    kit.box(7.84, 0.025, 0.22).at(8.08, 6.165, -13.03),
    kit.tube([[-3.87, 1.18, -3.20], [-3.87, 5.98, -12.80], [-4.22, 6.15, -13.03]], 0.022, 64),
    kit.tube([[3.87, 1.18, -3.20], [3.87, 5.98, -12.80], [4.22, 6.15, -13.03]], 0.022, 64)
  ], 'polished_brass')
  .commit();
//@@
kit.object('MACH_west_birdcage_lift_brass_gate')
  .add(hotelLiftBrassDetails(), 'polished_brass')
  .add([
    kit.text('LIFT I', { size: 0.16, depth: 0.008, align: 'center' }).at(0, 3.65, 1.653),
    kit.box(0.20, 0.38, 0.055).at(1.48, 1.26, 1.62)
  ], 'blackened_iron')
  .add([
    kit.sphere(0.035, 16).scale([1, 1, 0.40]).at(1.48, 1.33, 1.66),
    kit.sphere(0.035, 16).scale([1, 1, 0.40]).at(1.48, 1.19, 1.66)
  ], 'aged_brass')
  .at(-8.3, 0, -13.1, 0)
  .commit();
//@@
kit.object('MACH_east_birdcage_lift_brass_gate')
  .add(hotelLiftBrassDetails(), 'polished_brass')
  .add([
    kit.text('LIFT II', { size: 0.16, depth: 0.008, align: 'center' }).at(0, 3.65, 1.653),
    kit.box(0.20, 0.38, 0.055).at(-1.48, 1.26, 1.62)
  ], 'blackened_iron')
  .add([
    kit.sphere(0.035, 16).scale([1, 1, 0.40]).at(-1.48, 1.33, 1.66),
    kit.sphere(0.035, 16).scale([1, 1, 0.40]).at(-1.48, 1.19, 1.66)
  ], 'aged_brass')
  .at(8.3, 0, -13.1, 0)
  .commit();
//@@
kit.define('teal_silk_fabric', { base: 'fabric', color: '#258e91', roughness: 0.38 });
kit.define('gold_silk_fabric', { base: 'fabric', color: '#e7bc62', roughness: 0.38 });
kit.define('magenta_silk_fabric', { base: 'fabric', color: '#bc397c', roughness: 0.38 });
kit.define('rose_pink_velvet_fabric', { base: 'fabric', color: '#d994ac', roughness: 0.9 });
kit.define('blush_rose_foliage', { base: 'foliage', color: '#edacbf', roughness: 0.65 });
kit.define('coral_rose_foliage', { base: 'foliage', color: '#ed8f83', roughness: 0.65 });
kit.define('deep_green_foliage', { base: 'foliage', color: '#356b51', roughness: 0.7 });

function hotelFestiveBanner(name, x, material) {
  const silk = [];
  const edging = [];
  const width = 0.92;
  const strips = 16;
  const top = 6.17;
  for (let i = 0; i < strips; i++) {
    const a = -width / 2 + i * width / strips;
    const b = a + width / strips;
    const bottomA = 2.72 + 0.27 * (1 - Math.abs(a) / (width / 2));
    const bottomB = 2.72 + 0.27 * (1 - Math.abs(b) / (width / 2));
    const fold = 0.045 * Math.sin(i * Math.PI / 2);
    silk.push(
      kit.extrude([[a, bottomA], [b, bottomB], [b, top], [a, top]], 0.018)
        .at(0, 0, fold)
    );
    edging.push(
      kit.tube([[a, bottomA + 0.035, fold + 0.025], [b, bottomB + 0.035, fold + 0.025]], 0.014, 8)
    );
  }
  kit.object(name)
    .add(silk, material)
    .add([
      ...edging,
      kit.box(0.025, 3.43, 0.028).at(-0.445, 4.455, 0.045),
      kit.box(0.025, 3.43, 0.028).at(0.445, 4.455, 0.045),
      ...kit.repeat(13, i => {
        const x = -0.43 + i * 0.86 / 12;
        const y = 2.72 + 0.27 * (1 - Math.abs(x) / 0.46);
        return kit.tube([[x, y, 0.035], [x, y - 0.15, 0.045]], 0.009, 8);
      })
    ], 'gold_woven_fabric')
    .add([
      kit.cylinder(0.025, 0.025, 1.12, 16).rot(0, 0, 90).at(0, 6.18, 0),
      kit.sphere(0.045, 12).at(-0.59, 6.18, 0),
      kit.sphere(0.045, 12).at(0.59, 6.18, 0),
      kit.tube([[-0.36, 6.18, 0], [-0.36, 6.22, -0.16], [-0.36, 6.17, -0.35]], 0.018, 12),
      kit.tube([[0.36, 6.18, 0], [0.36, 6.22, -0.16], [0.36, 6.17, -0.35]], 0.018, 12)
    ], 'polished_brass')
    .at(x, 0, -12.68, 0)
    .commit();
}

function hotelRoseUrn(name, x, z, rotation) {
  const greenery = [];
  const pink = [];
  const coral = [];
  for (let i = 0; i < 27; i++) {
    const angle = i * 2.399963229728653;
    const ring = Math.sqrt((i + 0.5) / 27);
    const bx = 0.62 * ring * Math.cos(angle);
    const bz = 0.56 * ring * Math.sin(angle);
    const by = 1.78 + 0.73 * Math.sqrt(1 - ring * ring) + 0.07 * Math.sin(i * 1.7);
    greenery.push(
      kit.tube([[0, 1.22, 0], [bx * 0.45, 1.65, bz * 0.45], [bx, by, bz]], 0.014, 16),
      kit.sphere(0.12, 10).scale([0.47, 1.6, 0.28])
        .rot(25, i * 47, 38).at(bx * 0.65, by - 0.24, bz * 0.65)
    );
    const petals = i % 3 === 0 ? coral : pink;
    petals.push(
      kit.sphere(0.10, 12).scale([1, 0.85, 1]).at(bx, by, bz),
      ...kit.repeat(6, j => {
        const a = j * Math.PI / 3 + angle;
        return kit.sphere(0.085, 10).scale([1, 0.48, 0.80])
          .rot(18, -a * 180 / Math.PI, 20)
          .at(bx + Math.cos(a) * 0.072, by + 0.025, bz + Math.sin(a) * 0.072);
      }),
      ...kit.repeat(4, j => {
        const a = j * Math.PI / 2 + angle;
        return kit.sphere(0.058, 10).scale([0.8, 0.8, 0.5])
          .rot(10, -a * 180 / Math.PI, 24)
          .at(bx + Math.cos(a) * 0.034, by + 0.08, bz + Math.sin(a) * 0.034);
      })
    );
  }
  greenery.push(...kit.repeat(12, i => {
    const a = i * Math.PI / 6;
    return kit.sphere(0.18, 12).scale([0.6, 1.7, 0.25])
      .rot(48, -i * 30, 25)
      .at(0.43 * Math.cos(a), 1.65, 0.43 * Math.sin(a));
  }));
  kit.object(name)
    .add([
      kit.box(0.62, 0.10, 0.62).at(0, 0.05, 0),
      kit.lathe([
        [0.29, 0.10], [0.29, 0.17], [0.20, 0.22],
        [0.12, 0.32], [0.11, 0.54], [0.20, 0.61],
        [0.34, 0.72], [0.39, 0.90], [0.35, 1.12],
        [0.31, 1.21], [0.40, 1.25], [0.40, 1.31]
      ], 32),
      kit.torus(0.385, 0.025).rot(90, 0, 0).at(0, 1.30, 0),
      ...kit.repeat(2, i => {
        const s = i === 0 ? -1 : 1;
        return kit.tube([
          [s * 0.33, 1.14, 0],
          [s * 0.52, 1.18, 0],
          [s * 0.54, 0.94, 0],
          [s * 0.36, 0.85, 0]
        ], 0.035, 24);
      })
    ], 'polished_brass')
    .add(greenery, 'deep_green_foliage')
    .add(pink, 'blush_rose_foliage')
    .add(coral, 'coral_rose_foliage')
    .at(x, 0.024, z, rotation)
    .commit();
}

function hotelPinkSofa(name, x, z, rotation) {
  kit.object(name)
    .add([
      kit.box(2.88, 0.19, 1.02).at(0, 0.265, 0),
      ...kit.repeat(4, i =>
        kit.cylinder(0.045, 0.032, 0.20, 12)
          .at(i < 2 ? -1.29 : 1.29, 0.10, i % 2 ? 0.38 : -0.38)
      ),
      kit.box(2.91, 0.045, 1.04).at(0, 0.34, 0),
      kit.tube([[-1.47, 0.46, 0.43], [-1.47, 0.83, 0.34], [-1.47, 0.94, -0.37]], 0.027, 24),
      kit.tube([[1.47, 0.46, 0.43], [1.47, 0.83, 0.34], [1.47, 0.94, -0.37]], 0.027, 24)
    ], 'polished_brass')
    .add([
      kit.box(2.89, 0.18, 0.98).at(0, 0.37, 0),
      ...kit.repeat(3, i =>
        kit.box(0.82, 0.16, 0.79).at(-0.84 + i * 0.84, 0.46, 0.08)
      ),
      kit.box(2.70, 0.55, 0.20).at(0, 0.77, -0.43),
      kit.sphere(0.5, 24).scale([2.72, 0.40, 0.22]).at(0, 1.015, -0.43),
      kit.box(0.22, 0.39, 0.94).at(-1.39, 0.65, 0),
      kit.box(0.22, 0.39, 0.94).at(1.39, 0.65, 0),
      kit.cylinder(0.145, 0.145, 0.96, 20).rot(90, 0, 0).at(-1.39, 0.84, 0),
      kit.cylinder(0.145, 0.145, 0.96, 20).rot(90, 0, 0).at(1.39, 0.84, 0),
      ...kit.repeat(10, i =>
        kit.sphere(0.023, 10).scale([1, 1, 0.4])
          .at(-1.08 + (i % 5) * 0.54, 0.72 + Math.floor(i / 5) * 0.20, -0.321)
      )
    ], 'rose_pink_velvet_fabric')
    .add([
      kit.box(0.39, 0.36, 0.12).rot(-10, 0, -13).at(-0.93, 0.71, -0.18),
      kit.box(0.39, 0.36, 0.12).rot(-10, 0, 13).at(0.93, 0.71, -0.18)
    ], 'teal_silk_fabric')
    .at(x, 0.024, z, rotation)
    .commit();
}

function hotelPottedPalm(name, x, z, rotation, height) {
  const fronds = [];
  const stems = [];
  const crown = height - 0.40;
  for (let i = 0; i < 11; i++) {
    const a = i * Math.PI * 2 / 11;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const reach = 0.95 + 0.13 * Math.sin(i * 1.7);
    stems.push(
      kit.tube([
        [0, crown - 0.13, 0],
        [c * 0.28, crown + 0.29, s * 0.28],
        [c * reach * 0.64, crown + 0.20, s * reach * 0.64],
        [c * reach, crown - 0.24, s * reach]
      ], 0.018, 24)
    );
    for (let j = 0; j < 8; j++) {
      const t = 0.19 + j * 0.105;
      const r = reach * t;
      const y = crown + 0.31 * Math.sin(t * Math.PI) - 0.24 * t;
      const length = 0.28 * Math.sin(t * Math.PI) + 0.075;
      for (const side of [-1, 1]) {
        const dx = c * 0.55 - s * side * 0.835;
        const dz = s * 0.55 + c * side * 0.835;
        const heading = -Math.atan2(dz, dx) * 180 / Math.PI;
        fronds.push(
          kit.extrude([
            [0, 0],
            [length * 0.34, 0.035],
            [length * 0.76, 0.025],
            [length, 0],
            [length * 0.60, -0.025],
            [length * 0.18, -0.022]
          ], 0.009)
            .rot(90, heading, 0)
            .at(c * r, y, s * r)
        );
      }
    }
  }
  kit.object(name)
    .add([
      kit.lathe([
        [0.29, 0], [0.33, 0.07], [0.34, 0.16],
        [0.40, 0.57], [0.43, 0.65], [0.43, 0.71]
      ], 32),
      kit.torus(0.421, 0.024).rot(90, 0, 0).at(0, 0.70, 0),
      kit.torus(0.34, 0.018).rot(90, 0, 0).at(0, 0.15, 0)
    ], 'aged_brass')
    .add(kit.cylinder(0.39, 0.39, 0.035, 24).at(0, 0.655, 0), 'dark_dirt')
    .add([
      kit.tube([[0, 0.65, 0], [-0.045, 1.30, 0.025], [0.03, crown - 0.10, 0]], 0.062, 32),
      ...kit.repeat(13, i =>
        kit.torus(0.064, 0.012).rot(90, 0, 0)
          .at(-0.018, 0.80 + i * (crown - 0.94) / 13, 0.012)
      )
    ], 'bark')
    .add([...stems, ...fronds], 'deep_green_foliage')
    .at(x, 0.024, z, rotation)
    .commit();
}

hotelFestiveBanner('PRP_balcony_banner_west_outer_teal', -11.05, 'teal_silk_fabric');
//@@
hotelFestiveBanner('PRP_balcony_banner_west_middle_gold', -5.85, 'gold_silk_fabric');
//@@
hotelFestiveBanner('PRP_balcony_banner_west_inner_magenta', -4.65, 'magenta_silk_fabric');
//@@
hotelFestiveBanner('PRP_balcony_banner_east_inner_teal', 4.65, 'teal_silk_fabric');
//@@
hotelFestiveBanner('PRP_balcony_banner_east_middle_magenta', 5.85, 'magenta_silk_fabric');
//@@
hotelFestiveBanner('PRP_balcony_banner_east_outer_gold', 11.05, 'gold_silk_fabric');
//@@
hotelRoseUrn('PRP_rose_urn_west_stair_foot', -5.25, -2.05, 12);
//@@
hotelRoseUrn('PRP_rose_urn_east_stair_foot', 5.25, -2.05, -12);
//@@
hotelRoseUrn('PRP_rose_urn_west_north_wall', -10.55, -7.15, 28);
//@@
hotelRoseUrn('PRP_rose_urn_east_north_wall', 10.55, -7.15, -28);
//@@
hotelRoseUrn('PRP_rose_urn_west_between_sofas', -10.65, 5.70, 5);
//@@
hotelRoseUrn('PRP_rose_urn_east_between_sofas', 10.65, 5.70, -5);
//@@
hotelRoseUrn('PRP_rose_urn_south_west_windows', -7.45, 12.35, 18);
//@@
hotelRoseUrn('PRP_rose_urn_south_east_windows', 7.45, 12.35, -18);
//@@
hotelPinkSofa('PRP_pink_velvet_sofa_west_north', -10.85, 2.80, 90);
//@@
hotelPinkSofa('PRP_pink_velvet_sofa_west_south', -10.85, 8.60, 90);
//@@
hotelPinkSofa('PRP_pink_velvet_sofa_east_north', 10.85, 2.80, -90);
//@@
hotelPinkSofa('PRP_pink_velvet_sofa_east_south', 10.85, 8.60, -90);
//@@
hotelPottedPalm('PRP_palm_west_lift_outer', -10.65, -10.15, 14, 3.45);
//@@
hotelPottedPalm('PRP_palm_east_lift_outer', 10.65, -10.15, -14, 3.45);
//@@
hotelPottedPalm('PRP_palm_west_lift_approach', -5.80, -9.25, 32, 3.25);
//@@
hotelPottedPalm('PRP_palm_east_lift_approach', 5.80, -9.25, -32, 3.25);
//@@
hotelPottedPalm('PRP_palm_west_seating_north', -10.65, -0.30, 8, 3.10);
//@@
hotelPottedPalm('PRP_palm_east_seating_north', 10.65, -0.30, -8, 3.10);
//@@
hotelPottedPalm('PRP_palm_west_seating_south', -10.65, 11.95, 22, 3.35);
//@@
hotelPottedPalm('PRP_palm_east_seating_south', 10.65, 11.95, -22, 3.35);
//@@
kit.define('ivory_buffet_fabric', { base: 'fabric', color: '#f2e6d3', roughness: 0.7 });
kit.define('blush_fondant_ceramic', { base: 'ceramic', color: '#efb7c9', roughness: 0.65 });
kit.define('mint_fondant_ceramic', { base: 'ceramic', color: '#b7dcca', roughness: 0.65 });
kit.define('cream_fondant_ceramic', { base: 'ceramic', color: '#fff0d8', roughness: 0.65 });
kit.define('emerald_ball_gown_fabric', { base: 'fabric', color: '#13744f', roughness: 0.4 });
kit.define('ruby_ball_gown_fabric', { base: 'fabric', color: '#a82449', roughness: 0.42 });
kit.define('sapphire_tailcoat_fabric', { base: 'fabric', color: '#284d99', roughness: 0.46 });
kit.define('golden_harlequin_fabric', { base: 'fabric', color: '#dfae43', roughness: 0.43 });
kit.define('violet_cape_fabric', { base: 'fabric', color: '#693e92', roughness: 0.5 });
kit.define('turquoise_gown_fabric', { base: 'fabric', color: '#269b9e', roughness: 0.4 });
kit.define('amethyst_tailcoat_fabric', { base: 'fabric', color: '#794b89', roughness: 0.46 });
kit.define('ivory_venetian_mask_ceramic', { base: 'ceramic', color: '#f2e6d3', roughness: 0.25 });
kit.define('opaque_mask_eye_glass', { base: 'glass', color: '#181421', roughness: 0.22, transmission: 0 });
kit.define('garnet_jewel_glass', { base: 'glass', color: '#a92c55', roughness: 0.12, transmission: 0 });
kit.define('pastel_macaron_ceramic', { base: 'ceramic', color: '#dc9ab9', roughness: 0.8 });

function hotelMasqueradeWardrobe(name, x, y, z, rotation, fabric, silhouette, ornament) {
  const cloth = [];
  const gold = [];
  const ivory = [];
  const dark = [];
  const jewels = [];

  if (silhouette === 'gown') {
    cloth.push(
      kit.lathe([
        [0.66, 0.045], [0.69, 0.12], [0.61, 0.36],
        [0.48, 0.63], [0.31, 0.91], [0.22, 1.04],
        [0.29, 1.23], [0.26, 1.37]
      ], 40).scale([1, 1, 0.82]),
      kit.sphere(0.19, 20).scale([1.1, 0.85, 1]).at(-0.29, 1.29, 0),
      kit.sphere(0.19, 20).scale([1.1, 0.85, 1]).at(0.29, 1.29, 0)
    );
    gold.push(
      kit.torus(0.65, 0.018).rot(90, 0, 0).scale([1, 1, 0.82]).at(0, 0.105, 0),
      kit.torus(0.225, 0.025).rot(90, 0, 0).at(0, 1.045, 0),
      ...kit.repeat(9, i => {
        const a = Math.PI * 2 * i / 9;
        return kit.tube([
          [0.23 * Math.cos(a), 1.02, 0.19 * Math.sin(a)],
          [0.43 * Math.cos(a), 0.69, 0.36 * Math.sin(a)],
          [0.62 * Math.cos(a), 0.22, 0.52 * Math.sin(a)]
        ], 0.009, 20);
      })
    );
  } else if (silhouette === 'cape') {
    cloth.push(
      kit.lathe([
        [0.44, 0.08], [0.48, 0.18], [0.37, 0.65],
        [0.26, 1.02], [0.30, 1.34]
      ], 32).scale([1, 1, 0.82]),
      kit.extrude([
        [-0.33, 1.41], [0.33, 1.41], [0.58, 0.17],
        [0.25, 0.08], [0, 0.14], [-0.28, 0.08], [-0.58, 0.17]
      ], 0.075).rot(-9, 0, 0).at(0, 0, -0.22),
      kit.sphere(0.20, 20).scale([1.5, 0.65, 1]).at(-0.23, 1.35, -0.015),
      kit.sphere(0.20, 20).scale([1.5, 0.65, 1]).at(0.23, 1.35, -0.015)
    );
    gold.push(
      kit.tube([[-0.29, 1.40, 0.10], [0, 1.25, 0.22], [0.29, 1.40, 0.10]], 0.025, 24),
      kit.tube([[-0.33, 1.40, -0.17], [-0.45, 0.76, -0.27], [-0.57, 0.18, -0.35]], 0.016, 24),
      kit.tube([[0.33, 1.40, -0.17], [0.45, 0.76, -0.27], [0.57, 0.18, -0.35]], 0.016, 24)
    );
  } else {
    cloth.push(
      kit.lathe([
        [0.26, 0.78], [0.24, 1.00], [0.29, 1.25], [0.26, 1.38]
      ], 28).scale([1, 1, 0.69]),
      kit.sphere(0.17, 16).scale([1.1, 0.9, 1]).at(-0.29, 1.29, 0),
      kit.sphere(0.17, 16).scale([1.1, 0.9, 1]).at(0.29, 1.29, 0),
      kit.cylinder(0.115, 0.09, 0.73, 20).at(-0.135, 0.47, 0),
      kit.cylinder(0.115, 0.09, 0.73, 20).at(0.135, 0.47, 0)
    );
    if (silhouette === 'tailcoat') {
      cloth.push(
        kit.extrude([[-0.27, 0.97], [-0.025, 0.93], [-0.055, 0.43], [-0.28, 0.49]], 0.045).at(0, 0, -0.19),
        kit.extrude([[0.025, 0.93], [0.27, 0.97], [0.28, 0.49], [0.055, 0.43]], 0.045).at(0, 0, -0.19)
      );
      ivory.push(
        kit.extrude([[-0.15, 1.36], [0.15, 1.36], [0.075, 0.91], [-0.075, 0.91]], 0.025).at(0, 0, 0.19),
        kit.sphere(0.055, 12).scale([1.5, 0.65, 0.5]).at(-0.045, 1.35, 0.225),
        kit.sphere(0.055, 12).scale([1.5, 0.65, 0.5]).at(0.045, 1.35, 0.225)
      );
    } else {
      dark.push(...kit.repeat(10, i => {
        const cx = i % 2 === 0 ? -0.13 : 0.13;
        const cy = 0.85 + Math.floor(i / 2) * 0.105;
        return kit.extrude([[0, 0.065], [0.055, 0], [0, -0.065], [-0.055, 0]], 0.012)
          .at(cx, cy, 0.20);
      }));
      ivory.push(
        kit.torus(0.18, 0.055).rot(90, 0, 0).at(0, 1.40, 0),
        ...kit.repeat(12, i => {
          const a = i * Math.PI / 6;
          return kit.sphere(0.064, 12).scale([1, 0.42, 1])
            .at(Math.cos(a) * 0.205, 1.40, Math.sin(a) * 0.205);
        })
      );
    }
    gold.push(
      kit.tube([[-0.19, 1.34, 0.17], [-0.10, 1.17, 0.22], [-0.17, 1.06, 0.19]], 0.014, 20),
      kit.tube([[0.19, 1.34, 0.17], [0.10, 1.17, 0.22], [0.17, 1.06, 0.19]], 0.014, 20),
      ...kit.repeat(4, i => kit.sphere(0.019, 10).at(0, 0.99 + i * 0.078, 0.23))
    );
    dark.push(
      kit.sphere(0.12, 16).scale([0.95, 0.48, 1.65]).at(-0.135, 0.06, 0.075),
      kit.sphere(0.12, 16).scale([0.95, 0.48, 1.65]).at(0.135, 0.06, 0.075)
    );
  }

  // Opaque enclosing masks and dark inset lenses leave no exposed face.
  cloth.push(
    kit.sphere(0.255, 24).scale([1.02, 1.22, 0.96]).at(0, 1.59, -0.025),
    kit.cylinder(0.14, 0.17, 0.18, 24).at(0, 1.40, 0)
  );
  ivory.push(
    kit.sphere(0.25, 32).scale([0.91, 1.16, 0.60]).at(0, 1.59, 0.135),
    kit.extrude([[-0.034, 1.66], [0.034, 1.66], [0.047, 1.53], [-0.047, 1.53]], 0.075).at(0, 0, 0.254),
    kit.sphere(0.065, 16).scale([1.4, 0.35, 0.35]).at(0, 1.44, 0.269)
  );
  dark.push(
    kit.sphere(0.055, 20).scale([1.18, 0.47, 0.20]).rot(0, 0, -9).at(-0.09, 1.635, 0.278),
    kit.sphere(0.055, 20).scale([1.18, 0.47, 0.20]).rot(0, 0, 9).at(0.09, 1.635, 0.278)
  );
  gold.push(
    kit.tube([[-0.18, 1.64, 0.23], [-0.12, 1.70, 0.27], [-0.06, 1.70, 0.28], [0, 1.67, 0.29], [0.06, 1.70, 0.28], [0.12, 1.70, 0.27], [0.18, 1.64, 0.23]], 0.012, 40),
    kit.tube([[-0.19, 1.59, 0.235], [-0.16, 1.48, 0.25], [-0.08, 1.39, 0.235], [0, 1.365, 0.225], [0.08, 1.39, 0.235], [0.16, 1.48, 0.25], [0.19, 1.59, 0.235]], 0.011, 40),
    ...kit.repeat(7, i => {
      const a = Math.PI * (0.15 + i * 0.70 / 6);
      return kit.sphere(0.018, 12).at(0.19 * Math.cos(a), 1.69 + 0.10 * Math.sin(a), 0.235);
    }),
    kit.torus(0.235, 0.018).rot(90, 0, 0).at(0, 1.78, -0.015)
  );
  jewels.push(
    kit.sphere(0.037, 12).scale([0.8, 1.25, 0.45]).at(0, 1.755, 0.26),
    kit.sphere(0.042, 12).scale([1, 1.2, 0.45]).at(0, 1.24, 0.24)
  );

  if (ornament === 'feathers') {
    cloth.push(...kit.repeat(9, i => {
      const a = (i - 4) * 11;
      return kit.sphere(0.12, 16).scale([0.62, 3.1 + 0.3 * Math.cos(i), 0.25])
        .rot(-8, 0, -a)
        .at((i - 4) * 0.075, 1.98 + 0.12 * Math.cos((i - 4) * 0.3), -0.06);
    }));
    gold.push(...kit.repeat(9, i =>
      kit.tube([
        [(i - 4) * 0.018, 1.77, 0],
        [(i - 4) * 0.075, 2.01, -0.025],
        [(i - 4) * 0.12, 2.28, -0.04]
      ], 0.006, 16)
    ));
  } else if (ornament === 'harlequin') {
    cloth.push(
      kit.tube([[-0.12, 1.79, 0], [-0.25, 1.98, 0], [-0.39, 1.88, 0]], 0.075, 24),
      kit.tube([[0.12, 1.79, 0], [0.25, 1.98, 0], [0.39, 1.88, 0]], 0.075, 24)
    );
    gold.push(
      kit.sphere(0.043, 16).at(-0.39, 1.87, 0),
      kit.sphere(0.043, 16).at(0.39, 1.87, 0)
    );
  } else {
    gold.push(...kit.repeat(5, i =>
      kit.cone(0.025, 0.08 + (2 - Math.abs(i - 2)) * 0.025, 12)
        .at((i - 2) * 0.068, 1.82, 0.08)
    ));
  }

  const wardrobe = kit.object(name)
    .add(cloth, fabric)
    .add(gold, 'polished_gold')
    .add(ivory, 'ivory_venetian_mask_ceramic')
    .add(dark, 'opaque_mask_eye_glass')
    .add(jewels, 'garnet_jewel_glass');
  wardrobe.at(x, y, z, rotation).commit();
}

kit.object('PRP_long_masquerade_buffet_table')
  .add([
    kit.box(1.45, 0.12, 5.60).at(0, 0.84, 0),
    ...kit.repeat(6, i =>
      kit.box(0.10, 0.78, 0.10).at(i % 2 ? 0.56 : -0.56, 0.39, -2.35 + Math.floor(i / 2) * 2.35)
    ),
    kit.box(0.10, 0.12, 4.90).at(0, 0.24, 0)
  ], 'dark_wood')
  .add([
    kit.box(1.53, 0.025, 5.68).at(0, 0.9125, 0),
    kit.box(0.025, 0.70, 5.68).at(-0.765, 0.55, 0),
    kit.box(0.025, 0.70, 5.68).at(0.765, 0.55, 0),
    kit.box(1.53, 0.70, 0.025).at(0, 0.55, -2.84),
    kit.box(1.53, 0.70, 0.025).at(0, 0.55, 2.84),
    ...kit.repeat(24, i =>
      kit.cylinder(0.025, 0.035, 0.68, 10).at(-0.783, 0.55, -2.70 + i * 5.40 / 23)
    )
  ], 'ivory_buffet_fabric')
  .add([
    kit.box(0.46, 0.012, 5.69).at(0, 0.931, 0),
    kit.box(0.46, 0.62, 0.018).at(0, 0.62, -2.859),
    kit.box(0.46, 0.62, 0.018).at(0, 0.62, 2.859)
  ], 'teal_silk_fabric')
  .add([
    kit.box(0.035, 0.016, 5.69).at(-0.245, 0.933, 0),
    kit.box(0.035, 0.016, 5.69).at(0.245, 0.933, 0),
    kit.box(0.03, 0.035, 5.64).at(-0.785, 0.23, 0)
  ], 'gold_woven_fabric')
  .at(8, 0.024, -3, 0)
  .commit();
//@@
kit.object('PRP_tall_four_tier_masquerade_cake')
  .add([
    kit.lathe([[0.38, 0], [0.39, 0.035], [0.20, 0.09], [0.13, 0.16], [0.15, 0.22], [0.61, 0.26], [0.61, 0.30]], 40),
    kit.torus(0.60, 0.018).rot(90, 0, 0).at(0, 0.30, 0),
    ...kit.repeat(4, i => {
      const heights = [0.31, 0.66, 0.97, 1.24];
      const radii = [0.52, 0.41, 0.30, 0.20];
      return kit.torus(radii[i], 0.012).rot(90, 0, 0).at(0, heights[i], 0);
    }),
    kit.tube([[-0.12, 1.48, 0], [-0.17, 1.62, 0], [0, 1.72, 0], [0.17, 1.62, 0], [0.12, 1.48, 0]], 0.014, 32)
  ], 'polished_brass')
  .add([
    kit.cylinder(0.52, 0.52, 0.35, 48).at(0, 0.475, 0),
    kit.cylinder(0.30, 0.30, 0.27, 40).at(0, 1.105, 0)
  ], 'blush_fondant_ceramic')
  .add(kit.cylinder(0.41, 0.41, 0.32, 48).at(0, 0.81, 0), 'mint_fondant_ceramic')
  .add([
    kit.cylinder(0.20, 0.20, 0.24, 40).at(0, 1.36, 0),
    ...kit.repeat(4, tier => {
      const r = [0.52, 0.41, 0.30, 0.20][tier];
      const y = [0.64, 0.96, 1.23, 1.47][tier];
      return kit.repeat(28, i => {
        const a = i * Math.PI * 2 / 28;
        return kit.sphere(0.022, 10).at(r * Math.cos(a), y, r * Math.sin(a));
      });
    }).flat(),
    ...kit.repeat(12, i => {
      const a = i * Math.PI / 6;
      return kit.tube([
        [0.526 * Math.cos(a), 0.59, 0.526 * Math.sin(a)],
        [0.531 * Math.cos(a + 0.13), 0.48, 0.531 * Math.sin(a + 0.13)],
        [0.531 * Math.cos(a + 0.26), 0.45, 0.531 * Math.sin(a + 0.26)],
        [0.526 * Math.cos(a + 0.52), 0.59, 0.526 * Math.sin(a + 0.52)]
      ], 0.012, 18);
    })
  ], 'cream_fondant_ceramic')
  .add([
    ...kit.repeat(11, i => {
      const a = i * 0.72;
      const y = 0.38 + i * 0.10;
      const r = y < 0.65 ? 0.51 : y < 0.97 ? 0.40 : y < 1.24 ? 0.29 : 0.19;
      return kit.sphere(0.055, 12).scale([1, 0.8, 1])
        .at(r * Math.cos(a), y, r * Math.sin(a));
    }),
    kit.sphere(0.075, 16).scale([1.2, 0.7, 0.6]).at(0, 1.57, 0)
  ], 'coral_rose_foliage')
  .at(8, 0.961, -3, 0)
  .commit();
//@@
kit.object('PRP_buffet_north_silver_chafing_dishes')
  .add([
    ...kit.repeat(2, i => {
      const z = -4.65 - i * 0.68;
      return [
        kit.box(0.88, 0.035, 0.53).at(8, 1.015, z),
        kit.sphere(0.40, 24).scale([1.1, 0.42, 0.64]).at(8, 1.16, z),
        kit.tube([[7.90, 1.29, z], [7.90, 1.35, z], [8.10, 1.35, z], [8.10, 1.29, z]], 0.018, 16),
        ...kit.repeat(4, j =>
          kit.cylinder(0.022, 0.028, 0.07, 12)
            .at(8 + (j < 2 ? -0.34 : 0.34), 0.977, z + (j % 2 ? -0.19 : 0.19))
        )
      ];
    })
  ], 'polished_silver')
  .add([
    kit.box(0.13, 0.025, 0.27).at(7.46, 0.955, -4.65),
    kit.box(0.13, 0.025, 0.27).at(7.46, 0.955, -5.33)
  ], 'ivory_buffet_fabric')
  .commit();
//@@
kit.object('PRP_buffet_south_macaron_pedestal')
  .add([
    kit.cylinder(0.32, 0.32, 0.035, 32).at(8, 0.9625, -1.30),
    kit.cylinder(0.035, 0.065, 0.38, 16).at(8, 1.17, -1.30),
    kit.cylinder(0.25, 0.25, 0.025, 32).at(8, 1.35, -1.30),
    kit.cylinder(0.028, 0.045, 0.27, 16).at(8, 1.49, -1.30),
    kit.cylinder(0.18, 0.18, 0.025, 32).at(8, 1.62, -1.30),
    kit.sphere(0.035, 12).at(8, 1.67, -1.30)
  ], 'polished_silver')
  .add([
    ...kit.repeat(9, i => {
      const a = i * Math.PI * 2 / 9;
      return kit.cylinder(0.052, 0.052, 0.065, 16)
        .at(8 + 0.23 * Math.cos(a), 1.013, -1.30 + 0.23 * Math.sin(a));
    }),
    ...kit.repeat(6, i => {
      const a = i * Math.PI / 3;
      return kit.cylinder(0.05, 0.05, 0.065, 16)
        .at(8 + 0.165 * Math.cos(a), 1.395, -1.30 + 0.165 * Math.sin(a));
    })
  ], 'pastel_macaron_ceramic')
  .add(
    kit.repeat(4, i => kit.cylinder(0.045, 0.045, 0.06, 16)
      .at(8 + (i % 2 ? -0.07 : 0.07), 1.663, -1.30 + (i < 2 ? -0.07 : 0.07))),
    'mint_fondant_ceramic'
  )
  .commit();
//@@
kit.object('PRP_buffet_plates_napkins_and_cake_server')
  .add([
    ...kit.repeat(7, i =>
      kit.cylinder(0.17, 0.15, 0.016, 32).at(7.72, 0.953 + i * 0.019, -0.49)
    ),
    kit.cylinder(0.20, 0.18, 0.018, 32).at(7.56, 0.954, -2.14),
    kit.cylinder(0.16, 0.14, 0.018, 32).at(8.37, 0.954, -4.03)
  ], 'cream_fondant_ceramic')
  .add([
    kit.box(0.25, 0.036, 0.27).rot(0, 12, 0).at(8.30, 0.962, -0.53),
    kit.box(0.23, 0.024, 0.25).rot(0, -8, 0).at(7.54, 0.957, -3.98)
  ], 'ivory_buffet_fabric')
  .add([
    kit.extrude([[-0.055, -0.10], [0.055, -0.10], [0, 0.13]], 0.008)
      .rot(90, 0, 0).at(7.56, 0.975, -2.13),
    kit.cylinder(0.016, 0.016, 0.21, 12).rot(90, 0, 0).at(7.56, 0.979, -1.91),
    ...kit.repeat(5, i =>
      kit.box(0.018, 0.012, 0.23).at(8.20 + i * 0.04, 0.988, -0.53)
    )
  ], 'polished_silver')
  .commit();
//@@
kit.object('PRP_buffet_crystal_goblets')
  .add(kit.repeat(8, i => {
    const x = 8.33 + (i % 2) * 0.23;
    const z = -1.94 + Math.floor(i / 2) * 0.34;
    return [
      kit.cylinder(0.052, 0.052, 0.012, 20).at(x, 0.950, z),
      kit.cylinder(0.009, 0.012, 0.12, 12).at(x, 1.015, z),
      kit.lathe([[0.012, 0], [0.043, 0.025], [0.058, 0.080], [0.056, 0.13]], 24, { open: true })
        .at(x, 1.075, z)
    ];
  }), 'clear_window_glass')
  .add(kit.repeat(8, i =>
    kit.torus(0.056, 0.0035).rot(90, 0, 0)
      .at(8.33 + (i % 2) * 0.23, 1.205, -1.94 + Math.floor(i / 2) * 0.34)
  ), 'polished_gold')
  .commit();
//@@
kit.actor('CHAR_emerald_ball_gown_guest_dancing', {
  pos: [-1.95, 0.024, 2.20],
  rotY: 90,
  height: 1.70,
  action: 'dance',
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_emerald_dancer_gown_and_full_venetian_mask',
  -1.95, 0.024, 2.20, 90,
  'emerald_ball_gown_fabric', 'gown', 'crown'
);
//@@
kit.actor('CHAR_sapphire_tailcoat_guest_dancing', {
  pos: [-0.75, 0.024, 2.20],
  rotY: -90,
  height: 1.70,
  action: 'dance',
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_sapphire_dancer_tailcoat_and_full_venetian_mask',
  -0.75, 0.024, 2.20, -90,
  'sapphire_tailcoat_fabric', 'tailcoat', 'crown'
);
//@@
kit.actor('CHAR_ruby_ball_gown_guest_dancing', {
  pos: [1.25, 0.024, 0.85],
  rotY: 70,
  height: 1.70,
  action: 'dance',
  offset: 1.2
});
//@@
hotelMasqueradeWardrobe(
  'PRP_ruby_dancer_gown_and_full_venetian_mask',
  1.25, 0.024, 0.85, 70,
  'ruby_ball_gown_fabric', 'gown', 'crown'
);
//@@
kit.actor('CHAR_golden_harlequin_guest_dancing', {
  pos: [2.39, 0.024, 1.26],
  rotY: -110,
  height: 1.70,
  action: 'dance',
  offset: 1.2
});
//@@
hotelMasqueradeWardrobe(
  'PRP_golden_harlequin_suit_and_full_venetian_mask',
  2.39, 0.024, 1.26, -110,
  'golden_harlequin_fabric', 'harlequin', 'harlequin'
);
//@@
kit.actor('CHAR_violet_caped_guest_descending_staircase', {
  pos: [1.20, 2.616, -8.00],
  rotY: 0,
  height: 1.70,
  action: 'walk_formal'
});
//@@
hotelMasqueradeWardrobe(
  'PRP_violet_stair_guest_cape_feather_headdress_and_full_mask',
  1.20, 2.616, -8.00, 0,
  'violet_cape_fabric', 'cape', 'feathers'
);
//@@
kit.actor('CHAR_turquoise_gown_guest_beside_cake', {
  pos: [6.45, 0.024, -3.48],
  rotY: 65,
  height: 1.70,
  action: 'idle'
});
//@@
hotelMasqueradeWardrobe(
  'PRP_turquoise_cake_guest_gown_and_full_venetian_mask',
  6.45, 0.024, -3.48, 65,
  'turquoise_gown_fabric', 'gown', 'crown'
);
//@@
kit.actor('CHAR_amethyst_tailcoat_guest_posing_at_balcony', {
  pos: [-6.85, 5, -13.57],
  rotY: 15,
  height: 1.70,
  action: 'idle'
});
//@@
hotelMasqueradeWardrobe(
  'PRP_amethyst_balcony_guest_tailcoat_and_full_venetian_mask',
  -6.85, 5, -13.57, 15,
  'amethyst_tailcoat_fabric', 'tailcoat', 'crown'
);
//@@
kit.describe({
  title: 'The Grand Hotel Masquerade',
  setting: 'Enclosed 1930s grand hotel lobby with arched south windows, a central crimson staircase and brass birdcage lifts',
  style: 'Whimsical photoreal luxury, ornate silhouettes and festive theatrical grandeur',
  era: '1930s',
  lighting: 'Low golden sunlight through six southern arches, long shadows toward the staircase, warm crystal chandelier and opaline wall sconces',
  palette: 'Blush pink, mint, cream marble, jewel-coloured silk and glowing brass',
  mood: 'Joyful, warm, elegant and colourful',
  atmosphere: 'Faint sunlit haze revealing individual window beams; delicate suspended dust, clear visibility across the lobby'
});
kit.define('cut_crystal_glass', {
  base: 'glass', color: '#fff4e5', roughness: 0.07, transmission: 0.92
});
kit.define('warm_opaline_glass', {
  base: 'glass', color: '#ffebce', roughness: 0.3,
  emissive: '#ffd6a0', emissiveIntensity: 0.65
});
kit.glow('chandelier_lamp_light', '#ffe1ad', 3);
function hotelBallSconce(name, x, z, rotation) {
  kit.object(name)
    .add([
      kit.box(0.30, 0.90, 0.075).at(0, 0, 0),
      kit.box(0.42, 0.08, 0.10).at(0, 0.39, 0.015),
      kit.box(0.22, 0.12, 0.10).at(0, -0.48, 0.015),
      ...kit.repeat(3, i => {
        const dx = (i - 1) * 0.24;
        const rise = i === 1 ? 0.14 : 0;
        return [
          kit.tube([
            [0, -0.28, 0.04],
            [dx * 0.65, -0.21, 0.22],
            [dx, -0.08, 0.39],
            [dx, 0.08 + rise, 0.39]
          ], 0.025, 24),
          kit.cylinder(0.10, 0.065, 0.09, 20).at(dx, 0.10 + rise, 0.39),
          kit.torus(0.09, 0.012).rot(90, 0, 0).at(dx, 0.51 + rise, 0.39)
        ];
      })
    ], 'polished_brass')
    .add(kit.repeat(3, i =>
      kit.lathe([
        [0.065, 0], [0.095, 0.06], [0.095, 0.30],
        [0.085, 0.37], [0.035, 0.40]
      ], 16).at((i - 1) * 0.24, 0.13 + (i === 1 ? 0.14 : 0), 0.39)
    ), 'warm_opaline_glass')
    .at(x, 4.10, z, rotation)
    .commit();
}
//@@
{
  const brass = [
    kit.cylinder(0.43, 0.57, 0.14, 40).at(0, 11.83, 2),
    kit.cylinder(0.035, 0.035, 1.22, 16).at(0, 11.15, 2),
    kit.lathe([
      [0.12, 0], [0.24, 0.12], [0.16, 0.30],
      [0.12, 0.68], [0.27, 0.83], [0.27, 0.93],
      [0.12, 1.10], [0.09, 1.65], [0.19, 1.78]
    ], 32).at(0, 8.76, 2),
    kit.torus(1.82, 0.045).rot(90, 0, 0).at(0, 8.94, 2),
    kit.torus(1.08, 0.035).rot(90, 0, 0).at(0, 9.82, 2),
    kit.torus(0.48, 0.028).rot(90, 0, 0).at(0, 8.13, 2)
  ];
  const crystal = [
    kit.sphere(0.20, 12).scale([1, 1.65, 1]).at(0, 7.94, 2)
  ];
  const candles = [];
  const flames = [];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const c = Math.cos(a);
    const s = Math.sin(a);
    brass.push(
      kit.tube([
        [0.18 * c, 9.15, 2 + 0.18 * s],
        [0.70 * c, 8.88, 2 + 0.70 * s],
        [1.44 * c, 8.89, 2 + 1.44 * s],
        [1.90 * c, 9.15, 2 + 1.90 * s],
        [1.90 * c, 9.36, 2 + 1.90 * s]
      ], 0.037, 40),
      kit.cylinder(0.13, 0.065, 0.09, 20).at(1.90 * c, 9.38, 2 + 1.90 * s)
    );
    candles.push(
      kit.cylinder(0.042, 0.048, 0.24, 16).at(1.90 * c, 9.53, 2 + 1.90 * s)
    );
    flames.push(
      kit.sphere(0.057, 16).scale([0.72, 1.75, 0.72]).at(1.90 * c, 9.72, 2 + 1.90 * s)
    );
    for (let j = 0; j <= 12; j++) {
      const t = j / 12;
      const r = 0.24 + 1.57 * t;
      crystal.push(
        kit.sphere(0.043, 8).at(
          r * c,
          10.44 - 1.50 * t - 0.30 * Math.sin(Math.PI * t),
          2 + r * s
        )
      );
    }
    for (let j = 0; j <= 10; j++) {
      const t = j / 10;
      const r = 1.80 * (1 - t) + 0.13 * t;
      crystal.push(
        kit.sphere(0.047, 8).at(
          r * c,
          8.90 - 0.88 * Math.sin(t * Math.PI / 2),
          2 + r * s
        )
      );
    }
  }
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI * 2 / 36;
    const x = 1.82 * Math.cos(a);
    const z = 2 + 1.82 * Math.sin(a);
    const drop = 0.28 + (i % 3) * 0.09;
    brass.push(
      kit.cylinder(0.007, 0.007, drop, 8).at(x, 8.92 - drop / 2, z)
    );
    crystal.push(
      kit.sphere(0.075, 8).scale([0.75, 2.0, 0.75]).at(x, 8.82 - drop, z)
    );
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const c = Math.cos(a);
    const s = Math.sin(a);
    brass.push(
      kit.tube([
        [0.17 * c, 10.04, 2 + 0.17 * s],
        [0.63 * c, 9.77, 2 + 0.63 * s],
        [1.10 * c, 9.94, 2 + 1.10 * s],
        [1.10 * c, 10.09, 2 + 1.10 * s]
      ], 0.028, 28),
      kit.cylinder(0.10, 0.05, 0.07, 16).at(1.10 * c, 10.10, 2 + 1.10 * s)
    );
    candles.push(
      kit.cylinder(0.035, 0.04, 0.19, 16).at(1.10 * c, 10.22, 2 + 1.10 * s)
    );
    flames.push(
      kit.sphere(0.05, 12).scale([0.72, 1.7, 0.72]).at(1.10 * c, 10.39, 2 + 1.10 * s)
    );
  }
  kit.object('PRP_grand_two_tier_crystal_chandelier')
    .add(brass, 'polished_brass')
    .add(crystal, 'cut_crystal_glass')
    .add(candles, 'ivory_wax')
    .add(flames, 'chandelier_lamp_light')
    .commit();
}
//@@
hotelBallSconce('PRP_west_south_opaline_wall_sconce', -11.83, 10.5, 90);
//@@
hotelBallSconce('PRP_west_middle_opaline_wall_sconce', -11.83, 4.7, 90);
//@@
hotelBallSconce('PRP_west_north_opaline_wall_sconce', -11.83, -5.0, 90);
//@@
hotelBallSconce('PRP_east_south_opaline_wall_sconce', 11.83, 10.5, -90);
//@@
hotelBallSconce('PRP_east_middle_opaline_wall_sconce', 11.83, 4.7, -90);
//@@
hotelBallSconce('PRP_east_north_opaline_wall_sconce', 11.83, -5.0, -90);
//@@
kit.object('PRP_west_lift_ceiling_lantern')
  .add([
    kit.cylinder(0.20, 0.26, 0.09, 24).at(-8.3, 4.37, -13.1),
    kit.cylinder(0.018, 0.018, 0.35, 12).at(-8.3, 4.15, -13.1),
    kit.cylinder(0.23, 0.15, 0.07, 24).at(-8.3, 3.91, -13.1),
    kit.cylinder(0.14, 0.20, 0.07, 24).at(-8.3, 3.52, -13.1),
    ...kit.repeat(6, i => {
      const a = i * Math.PI / 3;
      return kit.cylinder(0.012, 0.012, 0.36, 8)
        .at(-8.3 + 0.18 * Math.cos(a), 3.72, -13.1 + 0.18 * Math.sin(a));
    })
  ], 'polished_brass')
  .add(kit.cylinder(0.175, 0.175, 0.34, 24).at(-8.3, 3.72, -13.1), 'warm_opaline_glass')
  .commit();
//@@
kit.object('PRP_east_lift_ceiling_lantern')
  .add([
    kit.cylinder(0.20, 0.26, 0.09, 24).at(8.3, 4.37, -13.1),
    kit.cylinder(0.018, 0.018, 0.35, 12).at(8.3, 4.15, -13.1),
    kit.cylinder(0.23, 0.15, 0.07, 24).at(8.3, 3.91, -13.1),
    kit.cylinder(0.14, 0.20, 0.07, 24).at(8.3, 3.52, -13.1),
    ...kit.repeat(6, i => {
      const a = i * Math.PI / 3;
      return kit.cylinder(0.012, 0.012, 0.36, 8)
        .at(8.3 + 0.18 * Math.cos(a), 3.72, -13.1 + 0.18 * Math.sin(a));
    })
  ], 'polished_brass')
  .add(kit.cylinder(0.175, 0.175, 0.34, 24).at(8.3, 3.72, -13.1), 'warm_opaline_glass')
  .commit();
//@@
kit.light('LGT_chandelier_warm_central_practical', {
  type: 'point', pos: [0, 9.18, 2],
  color: '#ffda9e', intensity: 52, distance: 22
});
//@@
kit.light('LGT_west_birdcage_lantern', {
  type: 'point', pos: [-8.3, 3.70, -13.1],
  color: '#ffce8c', intensity: 9, distance: 6
});
//@@
kit.light('LGT_east_birdcage_lantern', {
  type: 'point', pos: [8.3, 3.70, -13.1],
  color: '#ffce8c', intensity: 9, distance: 6
});
//@@
kit.light('LGT_east_north_sconce_buffet_practical', {
  type: 'point', pos: [11.30, 4.45, -5],
  color: '#ffdab0', intensity: 14, distance: 10
});
//@@
kit.light('LGT_west_north_sconce_practical', {
  type: 'point', pos: [-11.30, 4.45, -5],
  color: '#ffdab0', intensity: 12, distance: 9
});
//@@
kit.light('LGT_west_middle_sconce_practical', {
  type: 'point', pos: [-11.30, 4.45, 4.7],
  color: '#ffdab0', intensity: 12, distance: 9
});
//@@
kit.light('LGT_east_middle_sconce_practical', {
  type: 'point', pos: [11.30, 4.45, 4.7],
  color: '#ffdab0', intensity: 12, distance: 9
});
//@@
kit.light('LGT_west_south_sconce_practical', {
  type: 'point', pos: [-11.30, 4.45, 10.5],
  color: '#ffdab0', intensity: 10, distance: 8
});
//@@
kit.light('LGT_east_south_sconce_practical', {
  type: 'point', pos: [11.30, 4.45, 10.5],
  color: '#ffdab0', intensity: 10, distance: 8
});
//@@
kit.light('LGT_south_far_west_golden_window', {
  type: 'spot', pos: [-9.4, 6.8, 14.70],
  target: [-10.6, 0.25, -8.5],
  color: '#ffce8a', intensity: 46, distance: 39, angleDeg: 17
});
//@@
kit.light('LGT_south_middle_west_golden_window', {
  type: 'spot', pos: [-6.4, 6.8, 14.70],
  target: [-7.6, 0.25, -8.5],
  color: '#ffce8a', intensity: 50, distance: 39, angleDeg: 17
});
//@@
kit.light('LGT_south_inner_west_golden_window', {
  type: 'spot', pos: [-3.4, 6.8, 14.70],
  target: [-4.6, 0.25, -8.5],
  color: '#ffd398', intensity: 60, distance: 39, angleDeg: 18
});
//@@
kit.light('LGT_south_inner_east_golden_window', {
  type: 'spot', pos: [3.4, 6.8, 14.70],
  target: [2.2, 0.25, -8.5],
  color: '#ffd398', intensity: 60, distance: 39, angleDeg: 18
});
//@@
kit.light('LGT_south_middle_east_golden_window', {
  type: 'spot', pos: [6.4, 6.8, 14.70],
  target: [5.2, 0.25, -8.5],
  color: '#ffce8a', intensity: 50, distance: 39, angleDeg: 17
});
//@@
kit.light('LGT_south_far_east_golden_window', {
  type: 'spot', pos: [9.4, 6.8, 14.70],
  target: [8.2, 0.25, -8.5],
  color: '#ffce8a', intensity: 46, distance: 39, angleDeg: 17
});
//@@
kit.light('LGT_south_windows_soft_sky_fill', {
  type: 'area', pos: [0, 7.4, 14.55],
  target: [0, 3.2, -5],
  color: '#e9efff', intensity: 7, width: 19, height: 4.5
});
//@@
kit.light('LGT_chandelier_soft_downlight', {
  type: 'area', pos: [0, 8.35, 2],
  target: [0, 0.1, 2],
  color: '#ffe3bc', intensity: 8, width: 3.4, height: 3.4
});
//@@
kit.light('LGT_marble_floor_reflected_fill', {
  type: 'area', pos: [0, 0.12, 7],
  target: [0, 5.5, -4],
  color: '#ffe7db', intensity: 3, width: 8, height: 5
});
//@@
kit.light('LGT_north_plaster_soft_return', {
  type: 'area', pos: [0, 9.2, -14.65],
  target: [0, 2.8, 1],
  color: '#f9dfd7', intensity: 4, width: 10, height: 3
});
//@@
kit.camera('CAM_main', {
  pos: [0, 2.65, 13.65],
  lookAt: [0, 4.25, -4.5],
  fov: 65
});
//@@
kit.camera('CAM_high_balcony_over_dancers', {
  pos: [-5.25, 7.25, -13.65],
  lookAt: [0.1, 0.85, 2.3],
  fov: 55
});
//@@
kit.camera('CAM_low_emerald_sapphire_dance', {
  pos: [-4.7, 1.05, 5.8],
  lookAt: [-1.30, 1.05, 2.20],
  fov: 42
});
//@@
kit.camera('CAM_stair_foot_violet_procession', {
  pos: [-2.1, 1.45, -1.0],
  lookAt: [1.2, 3.95, -8.0],
  fov: 38
});
//@@
kit.camera('CAM_cake_and_turquoise_guest', {
  pos: [5.6, 1.9, 0.2],
  lookAt: [7.35, 1.48, -3.25],
  fov: 46
});
//@@
kit.camera('CAM_reverse_staircase_sunlit_ballroom', {
  pos: [-1.6, 3.8, -8.4],
  lookAt: [0, 2.9, 10],
  fov: 62
});
//@@
kit.describe({
  title: 'The Grand Hotel Masquerade',
  setting: 'Enclosed 1930s grand hotel lobby with arched south windows, a central crimson staircase and brass birdcage lifts',
  style: 'Whimsical photoreal luxury, ornate silhouettes and festive theatrical grandeur',
  era: '1930s',
  lighting: 'Restrained warm golden sunlight through southern arches, long shadows toward the staircase, gentle chandelier and wall-sconce illumination; clear saturated costumes and checkerboard marble with controlled highlights',
  palette: 'Blush pink, mint, cream marble, jewel-coloured silk and glowing brass',
  mood: 'Joyful, warm, elegant and colourful',
  atmosphere: 'Clear air; no haze, fog, suspended dust or volumetric light beams'
});
//@@
hotelBallSconce('PRP_west_south_opaline_wall_sconce', -11.9625, 10.5, 90);
//@@
hotelBallSconce('PRP_west_middle_opaline_wall_sconce', -11.9625, 4.7, 90);
//@@
hotelBallSconce('PRP_west_north_opaline_wall_sconce', -11.9625, -5.0, 90);
//@@
hotelBallSconce('PRP_east_south_opaline_wall_sconce', 11.9625, 10.5, -90);
//@@
hotelBallSconce('PRP_east_middle_opaline_wall_sconce', 11.9625, 4.7, -90);
//@@
hotelBallSconce('PRP_east_north_opaline_wall_sconce', 11.9625, -5.0, -90);
//@@
kit.remove('LGT_marble_floor_reflected_fill');
//@@
kit.remove('LGT_chandelier_soft_downlight');
//@@
kit.remove('LGT_south_windows_soft_sky_fill');
//@@
kit.remove('LGT_north_plaster_soft_return');
//@@
kit.remove('LGT_west_birdcage_lantern');
//@@
kit.remove('LGT_east_birdcage_lantern');
//@@
kit.remove('LGT_west_south_sconce_practical');
//@@
kit.remove('LGT_east_south_sconce_practical');
//@@
kit.remove('LGT_south_far_west_golden_window');
//@@
kit.remove('LGT_south_middle_west_golden_window');
//@@
kit.remove('LGT_south_inner_west_golden_window');
//@@
kit.remove('LGT_south_inner_east_golden_window');
//@@
kit.remove('LGT_south_middle_east_golden_window');
//@@
kit.remove('LGT_south_far_east_golden_window');
//@@
kit.light('LGT_south_golden_hour_sun', {
  type: 'directional',
  pos: [0, 6.8, 14.7],
  target: [-1.2, 0.25, -8.5],
  color: '#ffdfb0',
  intensity: 1.2
});
//@@
kit.light('LGT_chandelier_warm_central_practical', {
  type: 'point',
  pos: [0, 9.18, 2],
  color: '#ffe0b3',
  intensity: 22,
  distance: 22
});
//@@
kit.light('LGT_east_north_sconce_buffet_practical', {
  type: 'point',
  pos: [11.52, 4.45, -5],
  color: '#ffdab0',
  intensity: 7,
  distance: 10
});
//@@
kit.light('LGT_west_north_sconce_practical', {
  type: 'point',
  pos: [-11.52, 4.45, -5],
  color: '#ffdab0',
  intensity: 6,
  distance: 9
});
//@@
kit.light('LGT_west_middle_sconce_practical', {
  type: 'point',
  pos: [-11.52, 4.45, 4.7],
  color: '#ffdab0',
  intensity: 6,
  distance: 9
});
//@@
kit.light('LGT_east_middle_sconce_practical', {
  type: 'point',
  pos: [11.52, 4.45, 4.7],
  color: '#ffdab0',
  intensity: 6,
  distance: 9
});
//@@
kit.define('satin_cream_floor_marble', {
  base: 'marble',
  color: '#eee3cf',
  roughness: 0.82,
  metalness: 0
});
kit.define('satin_rose_floor_marble', {
  base: 'marble',
  color: '#dfa7b2',
  roughness: 0.82,
  metalness: 0
});
{
  const satinRoseFloorTiles = [];
  const satinCreamFloorTiles = [];
  for (let satinRow = 0; satinRow < 20; satinRow++) {
    for (let satinCol = 0; satinCol < 16; satinCol++) {
      const satinFloorTile = kit.box(1.5, 0.024, 1.5)
        .at(-11.25 + satinCol * 1.5, 0.012, -14.25 + satinRow * 1.5);
      ((satinRow + satinCol) % 2 === 0
        ? satinCreamFloorTiles
        : satinRoseFloorTiles).push(satinFloorTile);
    }
  }
  kit.object('ENV_checkerboard_marble_floor')
    .add(satinCreamFloorTiles, 'satin_cream_floor_marble')
    .add(satinRoseFloorTiles, 'satin_rose_floor_marble')
    .commit();
}
//@@
function hotelSharedWaltzPath(phase) {
  return Array.from({ length: 513 }, (_, index) => {
    const angle = phase + index * Math.PI * 2 / 128;
    return [2 * Math.cos(angle), 0.024, 2 + 2 * Math.sin(angle)];
  });
}
kit.actor('CHAR_emerald_ball_gown_guest_dancing', {
  pos: [-2, 0.024, 2],
  rotY: -180,
  height: 1.70,
  action: 'dance',
  path: hotelSharedWaltzPath(Math.PI),
  speed: 0.45,
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_emerald_dancer_gown_and_full_venetian_mask',
  -2, 0.024, 2, -180,
  'emerald_ball_gown_fabric', 'gown', 'crown'
);
kit.wear(
  'CHAR_emerald_ball_gown_guest_dancing',
  'PRP_emerald_dancer_gown_and_full_venetian_mask'
);
//@@
kit.actor('CHAR_sapphire_tailcoat_guest_dancing', {
  pos: [0, 0.024, 4],
  rotY: -90,
  height: 1.70,
  action: 'dance',
  path: hotelSharedWaltzPath(Math.PI / 2),
  speed: 0.45,
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_sapphire_dancer_tailcoat_and_full_venetian_mask',
  0, 0.024, 4, -90,
  'sapphire_tailcoat_fabric', 'tailcoat', 'crown'
);
kit.wear(
  'CHAR_sapphire_tailcoat_guest_dancing',
  'PRP_sapphire_dancer_tailcoat_and_full_venetian_mask'
);
//@@
kit.actor('CHAR_ruby_ball_gown_guest_dancing', {
  pos: [2, 0.024, 2],
  rotY: 0,
  height: 1.70,
  action: 'dance',
  path: hotelSharedWaltzPath(0),
  speed: 0.45,
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_ruby_dancer_gown_and_full_venetian_mask',
  2, 0.024, 2, 0,
  'ruby_ball_gown_fabric', 'gown', 'crown'
);
kit.wear(
  'CHAR_ruby_ball_gown_guest_dancing',
  'PRP_ruby_dancer_gown_and_full_venetian_mask'
);
//@@
kit.actor('CHAR_golden_harlequin_guest_dancing', {
  pos: [0, 0.024, 0],
  rotY: 90,
  height: 1.70,
  action: 'dance',
  path: hotelSharedWaltzPath(-Math.PI / 2),
  speed: 0.45,
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_golden_harlequin_suit_and_full_venetian_mask',
  0, 0.024, 0, 90,
  'golden_harlequin_fabric', 'harlequin', 'harlequin'
);
kit.wear(
  'CHAR_golden_harlequin_guest_dancing',
  'PRP_golden_harlequin_suit_and_full_venetian_mask'
);
//@@
kit.actor('CHAR_violet_caped_guest_descending_staircase', {
  pos: [1.20, 5.016, -13.40],
  rotY: 0,
  height: 1.70,
  action: 'walk_formal',
  path: [
    [1.20, 5.016, -13.40],
    [1.20, 5.016, -13.00],
    ...Array.from({ length: 25 }, (_, index) => {
      const stairIndex = 24 - index;
      return [
        1.20,
        (stairIndex + 1) * 0.20 + 0.016,
        -3.20 - stairIndex * 0.40
      ];
    }),
    [1.20, 0.040, -2.98],
    [1.20, 0.040, -2.20],
    [1.20, 0.040, -1.40]
  ],
  speed: 0.5,
  offset: 0
});
//@@
hotelMasqueradeWardrobe(
  'PRP_violet_stair_guest_cape_feather_headdress_and_full_mask',
  1.20, 5.016, -13.40, 0,
  'violet_cape_fabric', 'cape', 'feathers'
);
kit.wear(
  'CHAR_violet_caped_guest_descending_staircase',
  'PRP_violet_stair_guest_cape_feather_headdress_and_full_mask'
);
//@@
