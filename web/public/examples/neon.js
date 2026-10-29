kit.describe({
  title: 'Midnight Ramen Alley',
  setting: 'Narrow rain-soaked service alley beneath crowded cyberpunk tenements',
  style: 'Cinematic realism, layered industrial silhouettes, grey surfaces',
  era: 'Near future',
  lighting: 'Warm noodle stall beneath a flickering sign, cyan backlight, magenta practicals',
  palette: 'Wet charcoal grey, amber, electric cyan, restrained magenta',
  mood: 'Intimate shelter inside a restless nocturnal city',
  atmosphere: 'Fine falling rain; steam rising from the right-hand street grate, low wall outlet and noodle boiler; drifting vapor catches neon light; distant towers fade into rainy haze'
});

const TAU = Math.PI * 2;

function rod(a, b, radius = 0.025) {
  return kit.tube([a, b], radius, 12);
}

function bowl(radius, height) {
  return kit.lathe([
    [0, 0],
    [radius * 0.42, 0],
    [radius * 0.52, height * 0.14],
    [radius * 0.86, height * 0.62],
    [radius, height],
    [radius * 0.90, height],
    [radius * 0.76, height * 0.58],
    [radius * 0.35, height * 0.18],
    [0, height * 0.18]
  ], 24);
}

function stoolFrame() {
  return [
    ...kit.repeat(4, i => {
      const x = i < 2 ? -1 : 1;
      const z = i % 2 ? -1 : 1;
      return rod([x * 0.14, 0.46, z * 0.14], [x * 0.20, 0.025, z * 0.20], 0.022);
    }),
    kit.torus(0.19, 0.018).rot(90, 0, 0).at(0, 0.19, 0)
  ];
}

const glyphs = {
  R: [[[0, 0], [0, 1], [0.48, 1], [0.64, 0.86], [0.64, 0.64], [0.48, 0.51], [0, 0.51]], [[0.32, 0.51], [0.67, 0]]],
  A: [[[0, 0], [0.31, 1], [0.62, 0]], [[0.13, 0.40], [0.49, 0.40]]],
  M: [[[0, 0], [0, 1], [0.32, 0.49], [0.64, 1], [0.64, 0]]],
  E: [[[0.63, 1], [0, 1], [0, 0], [0.63, 0]], [[0, 0.51], [0.49, 0.51]]],
  N: [[[0, 0], [0, 1], [0.64, 0], [0.64, 1]]],
  '2': [[[0, 0.83], [0.14, 1], [0.49, 1], [0.64, 0.84], [0.64, 0.65], [0, 0], [0.66, 0]]],
  '4': [[[0.48, 0], [0.48, 1]], [[0.37, 1], [0, 0.38], [0.66, 0.38]]],
  H: [[[0, 0], [0, 1]], [[0.64, 0], [0.64, 1]], [[0, 0.50], [0.64, 0.50]]]
};

function neonGlyph(character, size, x, y, z, radius = 0.017) {
  return glyphs[character].map(stroke =>
    kit.tube(stroke.map(p => [x + p[0] * size, y + p[1] * size, z]), radius, 24)
  );
}

kit.define('amber_lamp_light', {
  base: 'lamp_light', color: '#d0d0d0',
  emissive: '#ffb56b', emissiveIntensity: 3.5
});
kit.define('cyan_lamp_light', {
  base: 'lamp_light', color: '#d0d0d0',
  emissive: '#55ddff', emissiveIntensity: 4
});
kit.define('magenta_lamp_light', {
  base: 'lamp_light', color: '#cccccc',
  emissive: '#ff4c99', emissiveIntensity: 3
});
kit.define('failing_lamp_light', {
  base: 'lamp_light', color: '#777777',
  emissive: '#ff9966', emissiveIntensity: 0.22
});
kit.define('window_lamp_light', {
  base: 'lamp_light', color: '#bbbbbb',
  emissive: '#c5d4d2', emissiveIntensity: 0.65
});
//@@
kit.object('ENV_alley_ground')
  .add(kit.box(50, 0.32, 72).at(0, -0.16, -10), 'wet_asphalt')
  .commit();
//@@
kit.object('ENV_curb_and_gutters')
  .add([
    kit.box(0.32, 0.12, 29).at(-3.24, 0.06, 0),
    kit.box(0.32, 0.12, 29).at(3.24, 0.06, 0),
    ...kit.repeat(18, i => [
      kit.box(0.34, 0.015, 0.025).at(-3.24, 0.126, -13.6 + i * 1.6),
      kit.box(0.34, 0.015, 0.025).at(3.24, 0.126, -13.6 + i * 1.6)
    ])
  ], 'wet_concrete')
  .add([
    kit.box(0.14, 0.012, 28.7).at(-3.0, 0.006, 0),
    kit.box(0.14, 0.012, 28.7).at(3.0, 0.006, 0)
  ], 'black_iron')
  .commit();
//@@
kit.object('ENV_left_tenement')
  .add(kit.box(5.6, 15, 30).at(-6.2, 7.5, 0), 'wet_brick')
  .add([
    ...kit.repeat(4, i => kit.box(0.24, 0.20, 30).at(-3.32, 0.45 + i * 4.1, 0)),
    ...kit.repeat(5, i => kit.box(0.22, 14.8, 0.28).at(-3.31, 7.4, -12 + i * 6)),
    kit.box(0.45, 0.28, 30).at(-3.28, 14.9, 0)
  ], 'streaked_concrete')
  .commit();
//@@
kit.object('ENV_right_tenement')
  .add(kit.box(5.6, 17.5, 30).at(6.2, 8.75, 0), 'grimy_concrete')
  .add([
    ...kit.repeat(4, i => kit.box(0.20, 0.24, 30).at(3.32, 3.6 + i * 4.1, 0)),
    ...kit.repeat(5, i => kit.box(0.18, 17.3, 0.34).at(3.32, 8.65, -13 + i * 6.3)),
    kit.box(0.42, 0.25, 30).at(3.28, 17.35, 0)
  ], 'aged_stone_block')
  .commit();
//@@
kit.object('ENV_alley_end_building')
  .add(kit.box(18, 15.2, 1.0).at(0, 7.6, -14.7), 'sooty_brick')
  .add([
    kit.box(18.2, 0.24, 0.38).at(0, 3.35, -14.08),
    kit.box(18.2, 0.25, 0.40).at(0, 9.6, -14.08),
    ...kit.repeat(5, i => kit.box(0.22, 15, 0.25).at(-7.6 + i * 3.8, 7.5, -14.08))
  ], 'streaked_concrete')
  .add([
    ...kit.repeat(8, i => kit.box(0.95, 1.6, 0.06).at(-6.6 + (i % 4) * 4.4, 5.5 + Math.floor(i / 4) * 5.7, -14.13))
  ], 'black_glass')
  .commit();
//@@
{
  const buildings = [];
  const windows = [];
  const aerials = [];
  for (let i = 0; i < 8; i++) {
    const x = -17 + i * 4.8;
    const z = -25 - (i % 3) * 3.8;
    const height = 21 + ((i * 7) % 17);
    const width = 3.5 + (i % 3) * 0.45;
    buildings.push(kit.box(width, height, 4).at(x, height / 2, z));
    buildings.push(kit.box(width * 0.66, 2.4, 3).at(x, height + 1.2, z));
    aerials.push(kit.cylinder(0.035, 0.055, 3).at(x + width * 0.22, height + 3.9, z));
    for (let j = 0; j < 7; j++) {
      windows.push(kit.box(width * (j % 2 ? 0.52 : 0.72), 0.09, 0.035).at(x, height * 0.42 + j * 1.55, z + 2.025));
    }
  }
  kit.object('ENV_distant_tower_cluster')
    .add(buildings, 'dark_concrete')
    .add(aerials, 'black_steel')
    .add(windows, 'window_lamp_light')
    .commit();
}
//@@
{
  const frames = [];
  const darkPanes = [];
  const litPanes = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const y = 5.55 + row * 3.35;
      const z = -11.5 + col * 4.8;
      frames.push(
        kit.box(0.025, 1.55, 1.22).at(-3.375, y, z),
        kit.box(0.10, 0.08, 1.30).at(-3.35, y - 0.80, z),
        kit.box(0.10, 0.08, 1.30).at(-3.35, y + 0.80, z),
        kit.box(0.10, 1.60, 0.07).at(-3.35, y, z - 0.615),
        kit.box(0.10, 1.60, 0.07).at(-3.35, y, z + 0.615),
        kit.box(0.11, 1.55, 0.045).at(-3.34, y, z),
        kit.box(0.29, 0.09, 1.40).at(-3.29, y - 0.85, z)
      );
      const pane = kit.box(0.018, 1.47, 1.12).at(-3.345, y, z);
      ((row * 6 + col) % 4 === 1 ? litPanes : darkPanes).push(pane);
    }
  }
  kit.object('ENV_left_window_grid')
    .add(frames, 'black_iron')
    .add(darkPanes, 'dirty_glass')
    .add(litPanes, 'window_lamp_light')
    .commit();
}
//@@
{
  const frames = [];
  const darkPanes = [];
  const litPanes = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const y = 7.0 + row * 3.55;
      const z = -11.6 + col * 4.8;
      frames.push(
        kit.box(0.025, 1.55, 1.22).at(3.375, y, z),
        kit.box(0.10, 0.08, 1.30).at(3.35, y - 0.80, z),
        kit.box(0.10, 0.08, 1.30).at(3.35, y + 0.80, z),
        kit.box(0.10, 1.60, 0.07).at(3.35, y, z - 0.615),
        kit.box(0.10, 1.60, 0.07).at(3.35, y, z + 0.615),
        kit.box(0.11, 0.05, 1.18).at(3.34, y + 0.10, z),
        kit.box(0.28, 0.09, 1.40).at(3.29, y - 0.85, z)
      );
      const pane = kit.box(0.018, 1.47, 1.12).at(3.345, y, z);
      ((row * 5 + col) % 5 === 2 ? litPanes : darkPanes).push(pane);
    }
  }
  kit.object('ENV_right_window_grid')
    .add(frames, 'black_iron')
    .add(darkPanes, 'dirty_glass')
    .add(litPanes, 'window_lamp_light')
    .commit();
}
//@@
kit.object('ENV_terminal_loading_gate')
  .add([
    ...kit.repeat(24, i => kit.box(3.6, 0.115, 0.09).at(0.35, 0.12 + i * 0.12, -14.06)),
    kit.box(0.13, 3.02, 0.20).at(-1.52, 1.51, -14.0),
    kit.box(0.13, 3.02, 0.20).at(2.22, 1.51, -14.0),
    kit.box(3.88, 0.30, 0.30).at(0.35, 3.02, -13.96),
    kit.box(0.6, 0.07, 0.12).at(0.35, 0.75, -13.97)
  ], 'dented_steel')
  .commit();
//@@
kit.object('ENV_right_roller_shutter')
  .add([
    ...kit.repeat(23, i => kit.box(0.075, 0.112, 3.05).at(3.33, 0.20 + i * 0.118, 3.5)),
    kit.box(0.18, 2.94, 0.13).at(3.29, 1.47, 1.90),
    kit.box(0.18, 2.94, 0.13).at(3.29, 1.47, 5.10),
    kit.box(0.31, 0.35, 3.45).at(3.24, 2.99, 3.50),
    rod([3.23, 0.88, 3.2], [3.23, 0.88, 3.8], 0.028)
  ], 'wet_corrugated')
  .commit();
//@@
kit.object('ENV_left_service_door')
  .add([
    kit.box(0.10, 2.12, 1.03).at(-3.32, 1.18, 7.2),
    kit.box(0.17, 2.30, 0.09).at(-3.28, 1.20, 6.64),
    kit.box(0.17, 2.30, 0.09).at(-3.28, 1.20, 7.76),
    kit.box(0.18, 0.10, 1.22).at(-3.28, 2.32, 7.2),
    kit.box(0.025, 0.32, 0.56).at(-3.255, 1.86, 7.2),
    ...kit.repeat(5, i => kit.box(0.025, 0.025, 0.58).at(-3.23, 1.73 + i * 0.063, 7.2))
  ], 'grimy_metal_plate')
  .add([
    rod([-3.23, 0.95, 7.53], [-3.23, 1.17, 7.53], 0.025),
    rod([-3.23, 0.95, 7.53], [-3.30, 0.95, 7.53], 0.025),
    rod([-3.23, 1.17, 7.53], [-3.30, 1.17, 7.53], 0.025)
  ], 'worn_brass')
  .commit();
//@@
kit.object('ENV_fire_escape_balcony')
  .add([
    ...kit.repeat(24, i => kit.box(1.35, 0.045, 0.065).at(2.725, 4.22, -8.0 + i * 0.19)),
    kit.box(0.08, 0.14, 4.55).at(2.08, 4.17, -5.81),
    kit.box(0.08, 0.14, 4.55).at(3.34, 4.17, -5.81),
    kit.box(0.05, 0.05, 4.65).at(2.055, 5.27, -5.81),
    kit.box(0.04, 0.04, 4.65).at(2.055, 4.75, -5.81),
    ...kit.repeat(7, i => kit.box(0.045, 1.08, 0.045).at(2.055, 4.74, -8.06 + i * 0.75)),
    kit.box(1.35, 0.05, 0.05).at(2.725, 5.27, -3.53),
    kit.box(1.35, 0.04, 0.04).at(2.725, 4.75, -3.53),
    ...kit.repeat(3, i => rod([3.38, 3.28, -7.7 + i * 1.8], [2.08, 4.15, -7.7 + i * 1.8], 0.044))
  ], 'rusty_iron')
  .commit();
//@@
kit.object('ENV_fire_escape_ladder')
  .add([
    kit.box(0.055, 4.25, 0.07).at(2.28, 2.125, -8.18),
    kit.box(0.055, 4.25, 0.07).at(2.86, 2.125, -8.18),
    ...kit.repeat(14, i => rod([2.28, 0.25 + i * 0.29, -8.18], [2.86, 0.25 + i * 0.29, -8.18], 0.024)),
    rod([2.28, 4.23, -8.18], [2.28, 4.23, -7.95], 0.028),
    rod([2.86, 4.23, -8.18], [2.86, 4.23, -7.95], 0.028)
  ], 'worn_steel')
  .commit();
//@@
kit.object('ENV_drainpipe_network')
  .add([
    kit.tube([[-3.13, 14.7, -8.9], [-3.13, 4.1, -8.9], [-3.13, 3.8, -8.6], [-3.13, 0.45, -8.6], [-2.98, 0.19, -8.6]], 0.067, 48),
    kit.tube([[-3.13, 14.7, 11.2], [-3.13, 3.4, 11.2], [-3.13, 3.1, 10.9], [-3.13, 0.35, 10.9], [-2.97, 0.17, 10.9]], 0.06, 48),
    kit.tube([[3.12, 17.1, -10.5], [3.12, 6.1, -10.5], [3.12, 5.8, -10.1], [3.12, 0.25, -10.1]], 0.074, 48),
    ...kit.repeat(6, i => [
      kit.torus(0.079, 0.014).rot(90, 0, 0).at(-3.13, 1.2 + i * 2.2, -8.9),
      kit.box(0.24, 0.055, 0.055).at(-3.25, 1.2 + i * 2.2, -8.9)
    ])
  ], 'oxidized_copper')
  .commit();
//@@
kit.object('ENV_sagging_power_lines')
  .add([
    kit.tube([[-3.35, 8.3, 3.0], [-1.6, 7.65, 2.8], [0.4, 7.45, 2.6], [3.35, 8.0, 2.4]], 0.026, 48),
    kit.tube([[-3.35, 8.15, 3.15], [-1.4, 7.40, 2.94], [0.7, 7.35, 2.74], [3.35, 7.92, 2.57]], 0.017, 48),
    kit.tube([[-3.35, 10.8, -6.8], [-1.4, 9.8, -6.4], [1.1, 9.7, -6.1], [3.35, 10.3, -5.8]], 0.024, 48),
    kit.tube([[-3.16, 3.1, 12], [-3.16, 3.0, 7], [-3.16, 3.4, 2], [-3.16, 3.3, -1], [-3.16, 3.8, -7]], 0.035, 64)
  ], 'black_rubber')
  .add([
    kit.box(0.18, 0.35, 0.24).at(-3.30, 8.20, 3.05),
    kit.box(0.18, 0.35, 0.24).at(3.30, 7.96, 2.48)
  ], 'pale_ceramic')
  .commit();
//@@
{
  const housings = [];
  const grilles = [];
  const fans = [];
  const positions = [[3.06, 3.95, -0.3], [3.06, 5.6, 7.9], [3.06, 3.9, -11.7]];
  for (const [x, y, z] of positions) {
    housings.push(
      kit.box(0.58, 0.78, 1.15).at(x, y, z),
      kit.box(0.74, 0.07, 1.30).at(x - 0.02, y - 0.43, z),
      kit.box(0.10, 0.40, 0.10).at(3.29, y - 0.59, z - 0.42),
      kit.box(0.10, 0.40, 0.10).at(3.29, y - 0.59, z + 0.42)
    );
    fans.push(
      kit.cylinder(0.27, 0.27, 0.028).rot(0, 0, 90).at(2.755, y, z - 0.18),
      kit.cylinder(0.065, 0.065, 0.08).rot(0, 0, 90).at(2.70, y, z - 0.18)
    );
    grilles.push(
      kit.torus(0.28, 0.018).rot(0, 90, 0).at(2.70, y, z - 0.18),
      ...kit.repeat(6, i => kit.box(0.025, 0.50, 0.018).at(2.68, y, z - 0.40 + i * 0.088)),
      ...kit.repeat(6, i => kit.box(0.03, 0.025, 0.23).at(2.75, y - 0.25 + i * 0.10, z + 0.34))
    );
  }
  kit.object('MACH_wall_air_conditioner_bank')
    .add(housings, 'dented_metal_plate')
    .add(fans, 'black_iron')
    .add(grilles, 'worn_steel')
    .commit();
}
//@@
kit.object('MACH_service_power_box')
  .add([
    kit.box(0.36, 1.10, 0.73).at(-3.14, 1.49, 9.15),
    kit.box(0.055, 0.96, 0.64).at(-2.93, 1.49, 9.15),
    kit.box(0.42, 0.06, 0.82).at(-3.12, 2.07, 9.15),
    kit.box(0.04, 0.19, 0.06).at(-2.89, 1.48, 9.37)
  ], 'grimy_metal_plate')
  .add([
    kit.tube([[-3.16, 0.13, 8.99], [-3.16, 0.65, 8.99], [-3.16, 0.94, 9.02]], 0.035, 16),
    kit.tube([[-3.16, 2.06, 9.30], [-3.16, 2.70, 9.30], [-3.16, 2.90, 8.90], [-3.16, 3.08, 8.50]], 0.03, 24)
  ], 'black_rubber')
  .add(kit.box(0.008, 0.18, 0.24).at(-2.897, 1.72, 9.14), 'dirty_paper')
  .commit();
//@@
kit.object('PRP_steaming_street_grate')
  .add([
    kit.box(0.82, 0.04, 1.16).at(2.05, 0.02, 0.85),
    ...kit.repeat(12, i => kit.box(0.72, 0.035, 0.035).at(2.05, 0.052, 0.34 + i * 0.093)),
    kit.box(0.045, 0.035, 1.12).at(1.67, 0.052, 0.85),
    kit.box(0.045, 0.035, 1.12).at(2.43, 0.052, 0.85)
  ], 'blackened_iron')
  .commit();
//@@
kit.object('MACH_low_steam_outlet')
  .add([
    kit.tube([[3.40, 0.73, -6.0], [3.08, 0.73, -6.0], [2.86, 0.59, -6.0], [2.79, 0.45, -6.0]], 0.105, 32),
    kit.torus(0.12, 0.028).rot(0, 90, 0).at(3.31, 0.73, -6.0),
    kit.box(0.06, 0.40, 0.40).at(3.34, 0.73, -6.0),
    kit.torus(0.105, 0.019).rot(25, 0, -25).at(2.79, 0.45, -6.0)
  ], 'sooty_steel')
  .commit();
//@@
kit.object('ENV_rainwater_puddles')
  .add([
    kit.puddle(1.7, 3.3, 11).at(0.25, 0.009, 3.15),
    kit.puddle(1.1, 2.4, 23).at(2.15, 0.009, -2.2),
    kit.puddle(2.2, 1.35, 37).at(-0.50, 0.009, 0.35),
    kit.puddle(1.25, 2.7, 41).at(-1.60, 0.009, 8.0),
    kit.puddle(1.35, 2.8, 53).at(0.70, 0.009, -9.8),
    kit.puddle(0.72, 2.4, 67).at(-2.60, 0.009, -9.5),
    kit.puddle(1.6, 2.1, 79).at(1.05, 0.009, 10.5)
  ], 'water')
  .commit();
//@@
kit.object('PRP_food_stall_canopy')
  .add([
    ...kit.repeat(4, i => {
      const height = i % 2 ? 3.0 : 3.30;
      return kit.cylinder(0.042, 0.042, height).at(i < 2 ? -2.80 : -0.10, height / 2, i % 2 ? -2.40 : -5.20);
    }),
    kit.box(2.78, 0.08, 0.08).at(-1.45, 2.98, -2.40),
    kit.box(2.78, 0.08, 0.08).at(-1.45, 3.28, -5.20),
    rod([-2.80, 2.99, -2.40], [-2.80, 3.29, -5.20], 0.04),
    rod([-0.10, 2.99, -2.40], [-0.10, 3.29, -5.20], 0.04),
    rod([-2.80, 2.4, -5.20], [-2.25, 3.28, -5.20], 0.025),
    rod([-0.10, 2.4, -5.20], [-0.65, 3.28, -5.20], 0.025)
  ], 'black_iron')
  .add([
    kit.box(3.03, 0.065, 3.15).rot(6, 0, 0).at(-1.45, 3.18, -3.80),
    ...kit.repeat(13, i => kit.box(0.028, 0.028, 3.15).rot(6, 0, 0).at(-2.89 + i * 0.24, 3.225, -3.80)),
    kit.box(3.06, 0.11, 0.12).at(-1.45, 2.99, -2.23)
  ], 'wet_corrugated')
  .commit();
//@@
kit.object('PRP_noodle_cart')
  .add([
    kit.box(2.36, 0.77, 1.00).at(0, 0.635, 0),
    kit.box(2.52, 0.08, 1.12).at(0, 1.04, 0),
    kit.box(2.28, 0.035, 0.035).at(0, 0.34, 0.515),
    kit.box(0.025, 0.58, 0.025).at(0, 0.64, 0.515),
    rod([-0.66, 0.83, 0.55], [-0.34, 0.83, 0.55], 0.022),
    rod([0.34, 0.83, 0.55], [0.66, 0.83, 0.55], 0.022),
    ...kit.repeat(4, i => kit.box(0.065, 0.20, 0.065).at(i < 2 ? -1.03 : 1.03, 0.22, i % 2 ? -0.35 : 0.35))
  ], 'worn_steel')
  .add([
    ...kit.repeat(4, i => kit.cylinder(0.12, 0.12, 0.075).rot(0, 0, 90).at(i < 2 ? -1.03 : 1.03, 0.12, i % 2 ? -0.35 : 0.35))
  ], 'black_rubber')
  .at(-1.45, 0, -3.05, 0)
  .commit();
//@@
kit.object('PRP_stocked_rear_shelves')
  .add([
    ...kit.repeat(4, i => kit.box(0.035, 2.32, 0.035).at(i < 2 ? -1.18 : 1.18, 1.16, i % 2 ? -0.16 : 0.16)),
    ...kit.repeat(3, i => kit.box(2.4, 0.045, 0.40).at(0, 0.55 + i * 0.77, 0)),
    kit.box(2.40, 0.10, 0.025).at(0, 2.17, -0.19)
  ], 'worn_steel')
  .add([
    ...kit.repeat(5, i => bowl(0.13, 0.085).at(-0.87 + i * 0.40, 2.115, 0.01)),
    ...kit.repeat(3, i => bowl(0.16, 0.10).at(-0.83, 1.345 + i * 0.045, 0.01))
  ], 'pale_ceramic')
  .add([
    kit.box(0.42, 0.42, 0.32).at(-0.70, 0.7825, 0),
    kit.box(0.42, 0.42, 0.32).at(-0.15, 0.7825, 0),
    kit.box(0.31, 0.31, 0.28).at(0.72, 1.4975, 0),
    kit.box(0.31, 0.31, 0.28).at(0.30, 1.4975, 0)
  ], 'worn_plastic')
  .at(-1.45, 0, -5.00, 0)
  .commit();
//@@
kit.object('PRP_stall_split_valance')
  .add([
    ...kit.repeat(4, i => kit.box(0.64, 0.36 + (i % 2) * 0.035, 0.025).at(-2.49 + i * 0.695, 2.80 - (i % 2) * 0.0175, -2.235))
  ], 'soaked_fabric')
  .add(rod([-2.86, 2.99, -2.235], [-0.04, 2.99, -2.235], 0.018), 'black_iron')
  .commit();
//@@
{
  const bright = [];
  const failing = [];
  const word = 'RAMEN';
  for (let i = 0; i < word.length; i++) {
    const parts = neonGlyph(word[i], 0.51, -1.09 + i * 0.465, -0.255, 0.088, 0.018);
    (i === 3 ? failing : bright).push(...parts);
  }
  kit.object('PRP_flickering_ramen_sign')
    .add(kit.box(2.86, 0.75, 0.12), 'grimy_metal_plate')
    .add([
      kit.box(0.045, 0.48, 0.06).at(-1.10, -0.44, -0.15),
      kit.box(0.045, 0.48, 0.06).at(1.10, -0.44, -0.15),
      rod([-1.10, -0.36, -0.15], [-1.10, -0.36, 0], 0.022),
      rod([1.10, -0.36, -0.15], [1.10, -0.36, 0], 0.022)
    ], 'black_iron')
    .add(bright, 'amber_lamp_light')
    .add(failing, 'failing_lamp_light')
    .add([
      kit.tube([[-1.35, -0.32, 0.085], [-1.35, 0.32, 0.085], [0.65, 0.32, 0.085]], 0.012, 24),
      kit.tube([[1.07, 0.32, 0.085], [1.35, 0.32, 0.085], [1.35, -0.32, 0.085], [-1.35, -0.32, 0.085]], 0.012, 24)
    ], 'magenta_lamp_light')
    .at(-1.45, 3.55, -2.20, 0)
    .commit();
}
//@@
kit.object('PRP_projecting_twenty_four_hour_sign')
  .add([
    kit.box(0.78, 2.20, 0.15),
    kit.box(0.90, 0.075, 0.10).at(0.40, 1.15, -0.13),
    kit.box(0.065, 0.45, 0.30).at(0.83, 1.15, -0.13),
    kit.box(0.055, 0.30, 0.055).at(0, 1.08, -0.13)
  ], 'blackened_steel')
  .add([
    ...neonGlyph('2', 0.44, -0.145, 0.55, 0.10),
    ...neonGlyph('4', 0.44, -0.145, -0.16, 0.10),
    ...neonGlyph('H', 0.44, -0.145, -0.87, 0.10),
    kit.tube([[-0.33, -1.02, 0.10], [-0.33, 1.02, 0.10], [0.33, 1.02, 0.10], [0.33, -1.02, 0.10]], 0.012, 32)
  ], 'cyan_lamp_light')
  .at(2.55, 5.30, -3.25, 0)
  .commit();
//@@
kit.object('PRP_round_noodle_neon')
  .add([
    kit.cylinder(0.52, 0.52, 0.10, 32).rot(90, 0, 0),
    kit.box(0.80, 0.065, 0.08).at(-0.20, 0.59, -0.10),
    kit.box(0.055, 0.25, 0.055).at(0, 0.55, -0.10),
    kit.box(0.07, 0.36, 0.24).at(-0.58, 0.59, -0.10)
  ], 'black_iron')
  .add([
    kit.torus(0.46, 0.017).at(0, 0, 0.07),
    kit.tube([[-0.27, 0.015, 0.075], [-0.20, -0.16, 0.075], [0, -0.24, 0.075], [0.20, -0.16, 0.075], [0.27, 0.015, 0.075]], 0.018, 32),
    rod([-0.28, 0.02, 0.075], [0.28, 0.02, 0.075], 0.015),
    ...kit.repeat(3, i => kit.tube([[-0.15 + i * 0.15, 0.10, 0.075], [-0.19 + i * 0.15, 0.19, 0.075], [-0.12 + i * 0.15, 0.29, 0.075]], 0.013, 24))
  ], 'magenta_lamp_light')
  .at(-2.80, 4.65, 0.50, 0)
  .commit();
//@@
kit.object('PRP_under_canopy_worklight')
  .add([
    kit.box(1.50, 0.075, 0.19).at(0, 0.06, 0),
    kit.box(0.04, 0.25, 0.04).at(-0.60, 0.18, 0),
    kit.box(0.04, 0.25, 0.04).at(0.60, 0.18, 0),
    kit.box(0.07, 0.11, 0.13).at(-0.71, 0, 0),
    kit.box(0.07, 0.11, 0.13).at(0.71, 0, 0)
  ], 'worn_steel')
  .add(kit.cylinder(0.035, 0.035, 1.34).rot(0, 0, 90), 'amber_lamp_light')
  .at(-1.45, 2.86, -3.80, 0)
  .commit();
//@@
kit.object('PRP_noodle_boiler_and_burner')
  .add([
    kit.box(0.63, 0.12, 0.53).at(0, 0.06, 0),
    ...kit.repeat(4, i => kit.box(0.57, 0.025, 0.025).at(0, 0.1375, -0.18 + i * 0.12)),
    kit.cylinder(0.045, 0.045, 0.035).rot(90, 0, 0).at(0.20, 0.065, 0.278)
  ], 'black_iron')
  .add([
    kit.lathe([[0, 0], [0.25, 0], [0.27, 0.04], [0.27, 0.37], [0.245, 0.37], [0.245, 0.05], [0, 0.05]], 32).at(0, 0.15, 0),
    kit.torus(0.265, 0.017).rot(90, 0, 0).at(0, 0.52, 0),
    kit.torus(0.075, 0.013, 240).rot(0, 90, 0).at(-0.29, 0.40, 0),
    kit.torus(0.075, 0.013, 240).rot(0, 90, 0).at(0.29, 0.40, 0),
    kit.tube([[0.09, 0.23, 0.03], [0.14, 0.47, 0.02], [0.24, 0.70, 0.02]], 0.012, 20)
  ], 'worn_steel')
  .at(-2.08, 1.08, -3.10, 0)
  .commit();
//@@
kit.object('PRP_serving_bowls_and_chopsticks')
  .add([
    bowl(0.16, 0.125).at(-1.13, 1.08, -2.80),
    bowl(0.14, 0.105).at(-0.64, 1.08, -2.79),
    kit.cylinder(0.10, 0.10, 0.018).at(-1.12, 1.089, -3.30)
  ], 'pale_ceramic')
  .add([
    rod([-1.31, 1.214, -2.84], [-0.97, 1.214, -2.77], 0.0045),
    rod([-1.31, 1.216, -2.81], [-0.97, 1.216, -2.74], 0.0045),
    rod([-0.80, 1.194, -2.82], [-0.48, 1.194, -2.76], 0.0045),
    rod([-0.80, 1.196, -2.79], [-0.48, 1.196, -2.73], 0.0045)
  ], 'pale_wood')
  .commit();
//@@
kit.object('PRP_condiment_tray')
  .add([
    kit.box(0.43, 0.025, 0.30).at(0, 0.0125, 0),
    kit.box(0.43, 0.035, 0.018).at(0, 0.0375, -0.145),
    kit.box(0.43, 0.035, 0.018).at(0, 0.0375, 0.145)
  ], 'worn_plastic')
  .add([
    kit.lathe([[0, 0], [0.045, 0], [0.045, 0.15], [0.025, 0.19], [0.025, 0.23], [0, 0.23]], 16).at(-0.12, 0.025, 0),
    kit.lathe([[0, 0], [0.043, 0], [0.043, 0.12], [0.025, 0.16], [0.025, 0.20], [0, 0.20]], 16).at(0.005, 0.025, 0)
  ], 'dark_glass')
  .add([
    kit.cylinder(0.028, 0.028, 0.025).at(-0.12, 0.2675, 0),
    kit.cylinder(0.028, 0.028, 0.025).at(0.005, 0.2375, 0)
  ], 'black_plastic')
  .add(bowl(0.061, 0.13).at(0.13, 0.025, 0), 'pale_ceramic')
  .add([
    ...kit.repeat(7, i => rod([0.105 + (i % 3) * 0.017, 0.055, -0.017 + Math.floor(i / 3) * 0.016], [0.095 + (i % 3) * 0.027, 0.30 + (i % 2) * 0.025, -0.025 + Math.floor(i / 3) * 0.024], 0.004))
  ], 'pale_wood')
  .at(-0.57, 1.08, -3.26, 0)
  .commit();
//@@
kit.object('PRP_hanging_menu_board')
  .add([
    kit.box(0.49, 0.72, 0.045),
    rod([-0.16, 0.36, 0], [-0.16, 0.80, 0], 0.008),
    rod([0.16, 0.36, 0], [0.16, 0.80, 0], 0.008)
  ], 'dark_wood')
  .add(kit.box(0.43, 0.65, 0.008).at(0, 0, 0.028), 'yellowed_paper')
  .add([
    kit.box(0.31, 0.035, 0.005).at(0, 0.24, 0.035),
    ...kit.repeat(5, i => [
      kit.box(0.19 + (i % 2) * 0.04, 0.018, 0.005).at(-0.055, 0.12 - i * 0.085, 0.035),
      kit.box(0.055, 0.018, 0.005).at(0.14, 0.12 - i * 0.085, 0.035)
    ])
  ], 'black_paint')
  .at(-2.50, 1.88, -2.36, 0)
  .commit();
//@@
kit.object('PRP_empty_counter_stool')
  .add(stoolFrame(), 'worn_steel')
  .add(kit.cylinder(0.245, 0.235, 0.06).at(0, 0.48, 0), 'worn_plastic')
  .at(-1.98, 0, -1.66, 0)
  .commit();
//@@
kit.object('PRP_customer_counter_stool')
  .add(stoolFrame(), 'worn_steel')
  .add(kit.cylinder(0.245, 0.235, 0.06).at(0, 0.48, 0), 'worn_plastic')
  .at(-0.65, 0, -1.66, 0)
  .commit();
//@@
kit.object('PRP_passerby_umbrella')
  .add(
    kit.lathe([[0, 0.38], [0.20, 0.36], [0.52, 0.27], [0.79, 0.13], [0.95, 0], [0.95, -0.018], [0.78, 0.105], [0.51, 0.245], [0.20, 0.335], [0, 0.355]], 12).at(0, 2.04, 0),
    'soaked_fabric'
  )
  .add([
    kit.cylinder(0.013, 0.013, 1.45).at(0, 1.725, 0),
    kit.sphere(0.027).at(0, 2.455, 0),
    ...kit.repeat(12, i => {
      const a = TAU * i / 12;
      return kit.tube([[0, 2.385, 0], [Math.cos(a) * 0.50, 2.285, Math.sin(a) * 0.50], [Math.cos(a) * 0.95, 2.025, Math.sin(a) * 0.95]], 0.007, 20);
    })
  ], 'black_steel')
  .add(kit.tube([[0, 1.08, 0], [0, 0.95, 0], [0.07, 0.91, 0], [0.12, 0.97, 0]], 0.022, 24), 'black_rubber')
  .at(1.25, 0, -7.20, 0)
  .commit();
//@@
{
  const spokes = [];
  for (const z of [-0.66, 0.66]) {
    for (let i = 0; i < 12; i++) {
      const a = TAU * i / 12;
      spokes.push(rod([0, 0.38, z], [0, 0.38 + Math.sin(a) * 0.31, z + Math.cos(a) * 0.31], 0.006));
    }
  }
  kit.object('PRP_delivery_bicycle')
    .add([
      kit.torus(0.33, 0.045).rot(0, 90, 0).at(0, 0.38, -0.66),
      kit.torus(0.33, 0.045).rot(0, 90, 0).at(0, 0.38, 0.66),
      kit.cylinder(0.026, 0.026, 0.13).rot(0, 0, 90).at(-0.205, 1.03, 0.52),
      kit.cylinder(0.026, 0.026, 0.13).rot(0, 0, 90).at(0.205, 1.03, 0.52)
    ], 'black_rubber')
    .add([
      ...spokes,
      rod([0, 0.38, -0.66], [0, 0.43, 0], 0.023),
      rod([0, 0.43, 0], [0, 0.89, -0.28], 0.026),
      rod([0, 0.89, -0.28], [0, 0.38, -0.66], 0.023),
      rod([0, 0.89, -0.28], [0, 0.88, 0.43], 0.026),
      rod([0, 0.88, 0.43], [0, 0.43, 0], 0.026),
      rod([0, 0.38, 0.66], [0, 0.88, 0.43], 0.024),
      rod([0, 0.88, 0.43], [0, 1.03, 0.52], 0.023),
      rod([-0.25, 1.03, 0.52], [0.25, 1.03, 0.52], 0.019),
      rod([0, 0.89, -0.28], [0, 0.96, -0.28], 0.022),
      kit.torus(0.10, 0.012).rot(0, 90, 0).at(0.045, 0.43, 0),
      kit.box(0.42, 0.03, 0.48).at(0, 0.755, -0.70),
      rod([-0.18, 0.75, -0.88], [-0.04, 0.39, -0.66], 0.014),
      rod([0.18, 0.75, -0.88], [0.04, 0.39, -0.66], 0.014),
      rod([0, 0.43, 0], [-0.24, 0.015, -0.10], 0.014)
    ], 'worn_steel')
    .add(kit.box(0.22, 0.065, 0.26).at(0, 0.9925, -0.28), 'worn_leather')
    .add([
      kit.box(0.48, 0.46, 0.48).at(0, 1.00, -0.70),
      kit.box(0.50, 0.035, 0.50).at(0, 1.2475, -0.70)
    ], 'dirty_plastic')
    .at(2.55, 0, 6.50, -12)
    .commit();
}
//@@
kit.object('PRP_wheeled_refuse_bin')
  .add([
    kit.box(0.98, 0.88, 0.78).at(0, 0.66, 0),
    kit.box(1.04, 0.075, 0.84).at(0, 1.14, 0),
    kit.box(0.085, 0.62, 0.84).at(-0.40, 0.67, 0),
    kit.box(0.085, 0.62, 0.84).at(0.40, 0.67, 0),
    rod([-0.20, 1.205, 0.16], [0.20, 1.205, 0.16], 0.025),
    rod([-0.20, 1.205, 0.16], [-0.20, 1.17, 0.16], 0.025),
    rod([0.20, 1.205, 0.16], [0.20, 1.17, 0.16], 0.025)
  ], 'dented_metal_plate')
  .add([
    ...kit.repeat(4, i => kit.cylinder(0.12, 0.12, 0.07).rot(0, 0, 90).at(i < 2 ? -0.40 : 0.40, 0.12, i % 2 ? -0.27 : 0.27))
  ], 'black_rubber')
  .at(-2.55, 0, 4.30, 0)
  .commit();
//@@
kit.object('PRP_tied_rubbish_bags')
  .add([
    kit.sphere(0.30, 16).scale([0.9, 1.2, 0.9]).at(-2.73, 0.36, 3.22),
    kit.cone(0.075, 0.14, 10).at(-2.73, 0.75, 3.22),
    kit.sphere(0.25, 16).scale([1.0, 0.95, 1.0]).at(-2.20, 0.2375, 3.35),
    kit.cone(0.055, 0.11, 10).at(-2.20, 0.505, 3.35)
  ], 'wet_plastic')
  .commit();
//@@
kit.object('PRP_stacked_supply_crates')
  .add([
    ...kit.repeat(3, level => [
      kit.box(0.65, 0.045, 0.52).at(0, level * 0.36 + 0.0225, 0),
      ...kit.repeat(4, i => kit.box(0.045, 0.35, 0.045).at(i < 2 ? -0.30 : 0.30, level * 0.36 + 0.175, i % 2 ? -0.235 : 0.235)),
      ...kit.repeat(3, i => [
        kit.box(0.65, 0.075, 0.035).at(0, level * 0.36 + 0.09 + i * 0.115, -0.245),
        kit.box(0.65, 0.075, 0.035).at(0, level * 0.36 + 0.09 + i * 0.115, 0.245),
        kit.box(0.035, 0.075, 0.45).at(-0.31, level * 0.36 + 0.09 + i * 0.115, 0),
        kit.box(0.035, 0.075, 0.45).at(0.31, level * 0.36 + 0.09 + i * 0.115, 0)
      ])
    ])
  ], 'aged_wood_planks')
  .at(-2.65, 0, -6.20, 0)
  .commit();
//@@
kit.object('PRP_stall_gas_cylinders')
  .add([
    ...kit.repeat(2, i => [
      kit.lathe([[0, 0], [0.17, 0], [0.19, 0.06], [0.19, 0.48], [0.15, 0.59], [0.06, 0.64], [0, 0.64]], 24).at(i * 0.48, 0, 0),
      kit.cylinder(0.035, 0.035, 0.085).at(i * 0.48, 0.6825, 0),
      kit.torus(0.12, 0.018).rot(90, 0, 0).at(i * 0.48, 0.73, 0),
      rod([i * 0.48 - 0.12, 0.59, 0], [i * 0.48 - 0.12, 0.73, 0], 0.018),
      rod([i * 0.48 + 0.12, 0.59, 0], [i * 0.48 + 0.12, 0.73, 0], 0.018)
    ])
  ], 'scarred_steel')
  .add(kit.tube([[0, 0.69, 0], [0.12, 0.50, 0.18], [0.20, 0.06, 0.20], [-0.40, 0.045, 0.62]], 0.018, 32), 'black_rubber')
  .at(-0.78, 0, -5.75, 0)
  .commit();
//@@
kit.object('PRP_weathered_poster_collage')
  .add([
    kit.plane(0.59, 0.85).rot(0, 90, 0).at(-3.395, 1.77, 0.58),
    kit.plane(0.48, 0.66).rot(0, 90, 0).at(-3.385, 1.58, 1.15),
    kit.plane(0.45, 0.59).rot(0, 90, 0).at(-3.375, 2.27, 1.10)
  ], 'soaked_paper')
  .add([
    kit.box(0.009, 0.18, 0.37).at(-3.383, 1.99, 0.58),
    ...kit.repeat(4, i => kit.box(0.009, 0.025, 0.35 - (i % 2) * 0.09).at(-3.382, 1.70 - i * 0.10, 0.58)),
    kit.box(0.009, 0.27, 0.25).at(-3.373, 1.65, 1.15),
    kit.box(0.009, 0.035, 0.33).at(-3.363, 2.39, 1.10),
    kit.box(0.009, 0.035, 0.27).at(-3.363, 2.29, 1.10)
  ], 'black_paint')
  .commit();
//@@
kit.object('PRP_terminal_bollard_pair')
  .add([
    ...kit.repeat(2, i => [
      kit.cylinder(0.13, 0.13, 0.06).at(i ? 2.45 : -1.80, 0.03, -12.70),
      kit.cylinder(0.075, 0.075, 0.86).at(i ? 2.45 : -1.80, 0.49, -12.70),
      kit.sphere(0.075).at(i ? 2.45 : -1.80, 0.92, -12.70)
    ])
  ], 'black_iron')
  .add([
    ...kit.repeat(2, i => [
      kit.cylinder(0.078, 0.078, 0.10).at(i ? 2.45 : -1.80, 0.39, -12.70),
      kit.cylinder(0.078, 0.078, 0.10).at(i ? 2.45 : -1.80, 0.65, -12.70)
    ])
  ], 'worn_white_paint')
  .commit();
//@@
kit.object('PRP_rain_flattened_litter')
  .add([
    kit.plane(0.14, 0.22).rot(-90, 17, 0).at(-1.85, 0.013, 2.65),
    kit.plane(0.11, 0.18).rot(-90, -31, 0).at(2.75, 0.014, 4.20),
    kit.plane(0.18, 0.25).rot(-90, 48, 0).at(-2.65, 0.013, 8.50),
    kit.plane(0.10, 0.17).rot(-90, -12, 0).at(0.70, 0.014, -0.30),
    kit.plane(0.09, 0.15).rot(-90, 73, 0).at(2.60, 0.013, -8.90)
  ], 'soaked_paper')
  .commit();
//@@
kit.object('PRP_rear_caged_service_lamp')
  .add([
    kit.box(0.08, 0.38, 0.26).at(3.34, 3.23, -12.0),
    rod([3.30, 3.30, -12.0], [2.80, 3.30, -12.0], 0.035),
    kit.cylinder(0.18, 0.25, 0.12).at(2.80, 3.23, -12.0),
    kit.torus(0.13, 0.013).rot(90, 0, 0).at(2.80, 2.91, -12.0),
    ...kit.repeat(6, i => {
      const a = TAU * i / 6;
      return rod([2.80 + Math.cos(a) * 0.13, 2.91, -12.0 + Math.sin(a) * 0.13], [2.80 + Math.cos(a) * 0.13, 3.20, -12.0 + Math.sin(a) * 0.13], 0.011);
    })
  ], 'black_iron')
  .add(kit.cylinder(0.085, 0.085, 0.25).at(2.80, 3.055, -12.0), 'amber_lamp_light')
  .commit();
//@@
kit.person('CHAR_noodle_cook', {
  x: -1.45, z: -4.13, y: 0,
  rotY: 0, height: 1.72, pose: 'stand'
});
//@@
kit.person('CHAR_late_night_customer', {
  x: -0.65, z: -1.66, y: 0,
  rotY: 180, height: 1.72, pose: 'sit'
});
//@@
kit.person('CHAR_umbrella_passerby', {
  x: 1.0, z: -7.20, y: 0,
  rotY: 175, height: 1.78, pose: 'stand'
});
//@@
kit.light('LGT_stall_warm_key', {
  type: 'spot',
  pos: [-1.45, 2.80, -3.80],
  target: [-1.25, 0.95, -2.45],
  color: '#ffbd82',
  intensity: 42,
  distance: 10,
  angleDeg: 60
});
//@@
kit.light('LGT_cyan_city_backlight', {
  type: 'spot',
  pos: [1.7, 12.5, -13.8],
  target: [0.6, 0.5, -4.2],
  color: '#78dfff',
  intensity: 48,
  distance: 25,
  angleDeg: 32
});
//@@
kit.light('LGT_rainy_sky_rim', {
  type: 'directional',
  pos: [-8, 22, -15],
  target: [0, 0, 1],
  color: '#8cadd6',
  intensity: 0.65
});
//@@
kit.light('LGT_ramen_sign_practical', {
  type: 'point',
  pos: [-1.45, 3.55, -1.98],
  color: '#ffa65f',
  intensity: 10,
  distance: 5.5
});
//@@
kit.light('LGT_cyan_sign_practical', {
  type: 'point',
  pos: [2.45, 5.25, -3.01],
  color: '#46d9ff',
  intensity: 18,
  distance: 10
});
//@@
kit.light('LGT_noodle_icon_practical', {
  type: 'point',
  pos: [-2.65, 4.65, 0.76],
  color: '#ff4b96',
  intensity: 11,
  distance: 7
});
//@@
kit.light('LGT_rear_service_practical', {
  type: 'point',
  pos: [2.80, 3.04, -12.0],
  color: '#ffc18a',
  intensity: 8,
  distance: 5
});
//@@
kit.light('LGT_soft_overhead_fill', {
  type: 'area',
  pos: [0, 10.5, 4.5],
  target: [0, 0.5, -1.5],
  color: '#7c91ad',
  intensity: 2.4,
  width: 4.5,
  height: 7
});
//@@
kit.light('LGT_cyan_sign_soft_bounce', {
  type: 'area',
  pos: [2.40, 4.9, -3.08],
  target: [-2.0, 1.0, -1.0],
  color: '#66d9ed',
  intensity: 4,
  width: 0.75,
  height: 1.9
});
//@@
kit.camera('CAM_main', {
  pos: [1.55, 1.62, 5.60],
  lookAt: [-0.95, 2.05, -3.40],
  fov: 43
});
//@@
kit.camera('CAM_wide', {
  pos: [0.10, 2.30, 12.50],
  lookAt: [0, 4.40, -5.50],
  fov: 52
});
//@@
kit.camera('CAM_closeup', {
  pos: [0.80, 1.75, 0.50],
  lookAt: [-1.45, 2.00, -3.45],
  fov: 48
});
//@@