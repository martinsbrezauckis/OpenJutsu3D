kit.describe({
  title: 'The Brass Undercroft',
  setting: 'Underground torture chamber beneath a medieval fortress, converted into a steam-powered dungeon',
  style: 'Cinematic grey-box architecture with heavy mechanical silhouettes',
  era: 'Alternate Victorian age',
  lighting: 'Amber gaslight over the central rack, furnace glow, cold light through a high barred ventilation shaft',
  palette: 'Grey masonry, worn timber, blackened iron, tarnished brass, oxidized copper',
  mood: 'Oppressive, silent, mechanically ominous',
  atmosphere: 'Thin furnace haze, suspended dust, faint steam around pressure valves'
});

const DEG = 180 / Math.PI;

function circleOutline(radius, cx = 0, cy = 0, segments = 24) {
  return Array.from({ length: segments }, (_, i) => {
    const a = -i * Math.PI * 2 / segments;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  });
}

function strut(a, b, radius = 0.04) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  return kit.cylinder(radius, radius, length, 12)
    .at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    .rot(Math.atan2(dz, dy) * DEG, 0, -Math.atan2(dx, Math.hypot(dy, dz)) * DEG);
}

function vaultStrip(rx, ry, spring, thickness, depth, z, segments = 28) {
  return kit.repeat(segments, i => {
    const a = i * Math.PI / segments;
    const b = (i + 1) * Math.PI / segments;
    const x1 = rx * Math.cos(a);
    const y1 = spring + ry * Math.sin(a);
    const x2 = rx * Math.cos(b);
    const y2 = spring + ry * Math.sin(b);
    return kit.box(Math.hypot(x2 - x1, y2 - y1) + 0.045, thickness, depth)
      .at((x1 + x2) / 2, (y1 + y2) / 2, z)
      .rot(0, 0, Math.atan2(y2 - y1, x2 - x1) * DEG);
  });
}

function gearParts(radius, teeth, depth, x, y, z) {
  return [
    kit.torus(radius * 0.83, radius * 0.12, 360, 40).at(x, y, z),
    kit.cylinder(radius * 0.19, radius * 0.19, depth * 1.4, 20).rot(90, 0, 0).at(x, y, z),
    ...kit.repeat(8, i => {
      const a = i * Math.PI / 4;
      return kit.box(radius * 0.11, radius * 0.72, depth * 0.8)
        .at(x + radius * 0.43 * Math.sin(a), y + radius * 0.43 * Math.cos(a), z)
        .rot(0, 0, -a * DEG);
    }),
    ...kit.repeat(teeth, i => {
      const a = i * Math.PI * 2 / teeth;
      return kit.box(radius * Math.PI * 1.25 / teeth, radius * 0.24, depth)
        .at(x + radius * Math.sin(a), y + radius * Math.cos(a), z)
        .rot(0, 0, -a * DEG);
    })
  ];
}

function hangingChain(x, bottom, z, length) {
  const count = Math.max(2, Math.ceil(length / 0.17) + 1);
  return kit.repeat(count, i =>
    kit.torus(0.102, 0.022, 360, 12)
      .scale([0.72, 1, 1])
      .rot(0, i % 2 ? 90 : 0, 0)
      .at(x, bottom + length * i / (count - 1), z)
  );
}

const coffinOutline = [
  [-0.40, -1.15], [0.40, -1.15], [0.64, -0.50],
  [0.64, 0.58], [0.40, 0.91], [0.25, 1.13],
  [-0.25, 1.13], [-0.40, 0.91], [-0.64, 0.58], [-0.64, -0.50]
];

kit.glow('lamp_light', '#ffd29a', 2.2);
kit.glow('cold_lamp_light', '#bddbe8', 0.8);
kit.glow('ember', '#ff7438', 3.0);
//@@
kit.object('ENV_flagstone_floor')
  .add(kit.box(18.7, 0.30, 22).at(0, -0.15, 0), 'stone_block')
  .add(kit.repeat(16, row =>
    kit.repeat(13, col =>
      kit.box(1.405, 0.055, 1.335)
        .at(-8.55 + col * 1.425, -0.012, -10.20 + row * 1.36)
    )
  ), 'worn_stone_floor')
  .commit();
//@@
kit.object('ENV_left_masonry_wall')
  .add([
    kit.box(0.55, 3.4, 21.95).at(-9.02, 1.70, 0),
    kit.box(0.72, 0.30, 21.95).at(-8.97, 0.15, 0),
    kit.box(0.67, 0.20, 21.95).at(-8.99, 3.20, 0)
  ], 'mossy_stone_wall')
  .commit();
//@@
kit.object('ENV_right_masonry_wall')
  .add([
    kit.box(0.55, 3.4, 21.95).at(9.02, 1.70, 0),
    kit.box(0.72, 0.30, 21.95).at(8.97, 0.15, 0),
    kit.box(0.67, 0.20, 21.95).at(8.99, 3.20, 0)
  ], 'sooty_stone_wall')
  .commit();
//@@
kit.object('ENV_rear_wall_with_vent_opening')
  .add([
    kit.box(18.6, 4.20, 0.65).at(0, 2.10, -10.65),
    kit.box(18.6, 1.60, 0.65).at(0, 6.40, -10.65),
    kit.box(2.50, 1.40, 0.65).at(-8.05, 4.90, -10.65),
    kit.box(13.90, 1.40, 0.65).at(2.35, 4.90, -10.65)
  ], 'aged_stone_wall')
  .commit();
//@@
kit.object('ENV_front_enclosure')
  .add([
    kit.box(18.6, 7.2, 0.65).at(0, 3.60, 10.65),
    kit.box(18.0, 0.28, 0.24).at(0, 0.14, 10.23)
  ], 'mossy_stone_wall')
  .commit();
//@@
kit.object('ENV_continuous_barrel_vault')
  .add(vaultStrip(8.95, 3.65, 3.20, 0.50, 21.30, 0, 36), 'sooty_brick')
  .commit();
//@@
kit.object('ENV_five_transverse_vault_ribs')
  .add(kit.repeat(5, i => {
    const z = -8 + i * 4;
    return [
      ...vaultStrip(8.68, 3.40, 3.20, 0.34, 0.54, z),
      kit.box(0.58, 3.20, 0.65).at(-8.49, 1.60, z),
      kit.box(0.58, 3.20, 0.65).at(8.49, 1.60, z),
      kit.box(0.78, 0.28, 0.82).at(-8.47, 0.14, z),
      kit.box(0.78, 0.28, 0.82).at(8.47, 0.14, z),
      kit.box(0.76, 0.23, 0.80).at(-8.47, 3.12, z),
      kit.box(0.76, 0.23, 0.80).at(8.47, 3.12, z)
    ];
  }), 'aged_stone_block')
  .commit();
//@@
kit.object('ENV_long_floor_drain')
  .add([
    kit.box(0.40, 0.022, 12.0).at(3.15, 0.027, -1.20),
    kit.box(0.045, 0.045, 12.0).at(2.94, 0.041, -1.20),
    kit.box(0.045, 0.045, 12.0).at(3.36, 0.041, -1.20),
    ...kit.repeat(66, i =>
      kit.box(0.39, 0.038, 0.037).at(3.15, 0.046, -7.05 + i * 0.18)
    )
  ], 'blackened_iron')
  .commit();
//@@
kit.object('ENV_seeping_floor_puddles')
  .add([
    kit.cylinder(0.75, 0.75, 0.007, 32).scale([1.55, 1, 0.68]).at(-4.05, 0.020, -5.85),
    kit.cylinder(0.57, 0.57, 0.007, 32).scale([1.8, 1, 0.55]).at(2.15, 0.020, 2.50),
    kit.cylinder(0.48, 0.48, 0.007, 28).scale([0.8, 1, 1.6]).at(-7.90, 0.020, -2.50)
  ], 'dark_water')
  .commit();
//@@
kit.object('ENV_rear_prison_cage')
  .add([
    ...kit.repeat(20, i =>
      kit.cylinder(0.027, 0.027, 2.85, 10).at(-8.25 + i * 0.24, 1.44, -7.20)
    ),
    ...kit.repeat(13, i =>
      kit.cylinder(0.027, 0.027, 2.85, 10).at(-3.69, 1.44, -7.20 - i * 0.24)
    ),
    ...kit.repeat(3, i => [
      kit.box(4.68, 0.075, 0.10).at(-5.97, 0.18 + i * 1.30, -7.20),
      kit.box(0.10, 0.075, 3.08).at(-3.69, 0.18 + i * 1.30, -8.69)
    ]),
    kit.box(0.09, 2.75, 0.12).at(-6.33, 1.43, -7.16),
    kit.box(0.09, 2.75, 0.12).at(-5.13, 1.43, -7.16),
    kit.box(1.28, 0.09, 0.12).at(-5.73, 2.78, -7.16),
    kit.box(0.16, 0.22, 0.16).at(-5.23, 1.25, -7.08)
  ], 'rusty_iron')
  .add([
    kit.torus(0.075, 0.019).at(-5.23, 1.38, -6.97),
    kit.box(0.14, 0.16, 0.08).at(-5.23, 1.25, -6.97)
  ], 'tarnished_brass')
  .commit();
//@@
kit.object('ENV_rear_door_stone_arch')
  .add([
    kit.box(0.36, 1.55, 0.32).at(-1.08, 0.79, -10.17),
    kit.box(0.36, 1.55, 0.32).at(1.08, 0.79, -10.17),
    ...vaultStrip(1.08, 1.08, 1.55, 0.35, 0.32, -10.17, 15),
    kit.box(2.45, 0.12, 0.62).at(0, 0.06, -10.04)
  ], 'worn_stone_block')
  .commit();
//@@
{
  const doorOutline = [[-0.89, -1.20], [0.89, -1.20]];
  for (let i = 0; i <= 20; i++) {
    const a = i * Math.PI / 20;
    doorOutline.push([0.89 * Math.cos(a), 0.30 + 0.89 * Math.sin(a)]);
  }
  kit.object('PRP_riveted_rear_pressure_door')
    .add([
      kit.extrude(doorOutline, 0.10).at(0, 1.24, -10.20),
      kit.box(1.75, 0.12, 0.09).at(0, 0.53, -10.07),
      kit.box(1.75, 0.12, 0.09).at(0, 1.35, -10.07),
      kit.box(1.32, 0.12, 0.09).at(0, 2.04, -10.07),
      ...kit.repeat(12, i =>
        kit.sphere(0.035, 10).at(i % 2 ? 0.76 : -0.76, 0.35 + Math.floor(i / 2) * 0.30, -10.00)
      ),
      kit.cylinder(0.06, 0.06, 0.28, 12).rot(90, 0, 0).at(0.24, 1.25, -9.99)
    ], 'blackened_iron')
    .add([
      kit.torus(0.27, 0.032).at(0.24, 1.25, -9.82),
      ...kit.repeat(5, i => {
        const a = i * Math.PI * 2 / 5;
        return strut([0.24, 1.25, -9.82], [0.24 + 0.25 * Math.cos(a), 1.25 + 0.25 * Math.sin(a), -9.82], 0.018);
      })
    ], 'tarnished_brass')
    .commit();
}
//@@
kit.object('PRP_deep_barred_ventilation_shaft')
  .add([
    kit.box(2.48, 0.18, 0.55).at(-5.70, 4.17, -10.30),
    kit.box(2.48, 0.18, 0.55).at(-5.70, 5.63, -10.30),
    kit.box(0.18, 1.40, 0.55).at(-6.88, 4.90, -10.30),
    kit.box(0.18, 1.40, 0.55).at(-4.52, 4.90, -10.30)
  ], 'cold_stone_block')
  .add([
    ...kit.repeat(9, i => kit.box(0.045, 1.38, 0.07).at(-6.66 + i * 0.24, 4.90, -10.02)),
    kit.box(2.18, 0.06, 0.08).at(-5.70, 4.90, -10.01)
  ], 'blackened_iron')
  .add(kit.box(2.24, 1.44, 0.03).at(-5.70, 4.90, -10.72), 'cold_lamp_light')
  .commit();
//@@
kit.object('MACH_central_torture_rack')
  .add([
    ...kit.repeat(8, i => kit.box(0.177, 0.15, 3.10).at(-0.644 + i * 0.184, 0.98, 0)),
    kit.box(0.17, 0.26, 3.78).at(-0.86, 0.98, 0),
    kit.box(0.17, 0.26, 3.78).at(0.86, 0.98, 0),
    ...kit.repeat(4, i =>
      kit.box(0.22, 0.91, 0.22).at(i < 2 ? -0.69 : 0.69, 0.47, i % 2 ? 1.26 : -1.26)
    ),
    kit.box(1.60, 0.16, 0.18).at(0, 0.29, -1.26),
    kit.box(1.60, 0.16, 0.18).at(0, 0.29, 1.26),
    kit.box(0.16, 0.16, 2.65).at(0, 0.29, 0),
    kit.cylinder(0.18, 0.18, 1.92, 24).rot(0, 0, 90).at(0, 1.20, -1.65),
    kit.cylinder(0.18, 0.18, 1.92, 24).rot(0, 0, 90).at(0, 1.20, 1.65)
  ], 'worn_wood_planks')
  .add([
    ...kit.repeat(4, i => [
      kit.box(0.25, 0.31, 0.12).at(i < 2 ? -0.86 : 0.86, 1.10, i % 2 ? 1.65 : -1.65),
      kit.torus(0.095, 0.022).rot(90, 0, 0).at(i < 2 ? -0.47 : 0.47, 1.12, i % 2 ? 1.22 : -1.22)
    ]),
    ...kit.repeat(12, i =>
      kit.sphere(0.028, 10).at(i % 2 ? 0.965 : -0.965, 1.03, -1.50 + Math.floor(i / 2) * 0.60)
    )
  ], 'blackened_iron')
  .add([
    kit.box(0.13, 0.025, 0.46).at(-0.47, 1.075, -1.27),
    kit.box(0.13, 0.025, 0.46).at(0.47, 1.075, -1.27),
    kit.box(0.13, 0.025, 0.46).at(-0.47, 1.075, 1.27),
    kit.box(0.13, 0.025, 0.46).at(0.47, 1.075, 1.27),
    kit.box(1.47, 0.035, 0.13).at(0, 1.075, 0.15)
  ], 'worn_leather')
  .at(-1.40, 0, -1.00, 0)
  .commit();
//@@
kit.object('MACH_rack_ratchet_and_crank')
  .add(gearParts(0.40, 16, 0.13, 0, 1.20, 0), 'tarnished_brass')
  .add([
    kit.box(0.70, 0.10, 0.50).at(0, 0.07, 0.15),
    kit.box(0.12, 1.10, 0.12).at(0, 0.62, 0.15),
    kit.cylinder(0.07, 0.07, 0.52, 16).rot(90, 0, 0).at(0, 1.20, 0.10),
    strut([0, 1.20, 0.31], [0.47, 1.43, 0.31], 0.035),
    kit.box(0.11, 0.22, 0.09).at(-0.26, 1.47, 0.02).rot(0, 0, -35)
  ], 'oiled_steel')
  .add(kit.cylinder(0.055, 0.055, 0.24, 16).rot(90, 0, 0).at(0.47, 1.43, 0.44), 'dark_wood')
  .at(-0.34, 0, 0.65, 90)
  .commit();
//@@
kit.object('MACH_open_iron_maiden_body')
  .add([
    kit.box(1.50, 0.20, 1.04).at(0, 0.12, -0.10),
    kit.extrude(coffinOutline, 0.16).at(0, 1.36, -0.44),
    kit.box(0.15, 1.72, 0.72).at(-0.57, 1.16, -0.08),
    kit.box(0.15, 1.72, 0.72).at(0.57, 1.16, -0.08),
    kit.box(1.02, 0.16, 0.72).at(0, 0.33, -0.08),
    kit.sphere(0.40, 20).scale([1, 1.12, 0.38]).at(0, 2.20, -0.37),
    ...kit.repeat(8, i =>
      kit.sphere(0.035, 10).at(i % 2 ? 0.59 : -0.59, 0.55 + Math.floor(i / 2) * 0.43, 0.30)
    ),
    ...kit.repeat(9, i =>
      kit.cone(0.04, 0.20, 10).rot(90, 0, 0).at(-0.30 + i % 3 * 0.30, 0.72 + Math.floor(i / 3) * 0.42, -0.18)
    )
  ], 'blackened_iron')
  .add([
    kit.box(0.10, 1.90, 0.09).at(-0.65, 1.30, 0.31),
    kit.cylinder(0.075, 0.075, 0.20, 16).at(-0.65, 0.65, 0.31),
    kit.cylinder(0.075, 0.075, 0.20, 16).at(-0.65, 1.75, 0.31)
  ], 'tarnished_brass')
  .at(-6.80, 0, -4.60, 0)
  .commit();
//@@
kit.object('PRP_iron_maiden_open_hinged_door')
  .add([
    kit.extrude(coffinOutline, 0.12).at(0.64, 1.36, 0),
    ...kit.repeat(12, i =>
      kit.cone(0.04, 0.22, 10).rot(-90, 0, 0)
        .at(0.34 + i % 3 * 0.30, 0.64 + Math.floor(i / 3) * 0.36, -0.12)
    ),
    kit.box(1.04, 0.10, 0.09).at(0.64, 0.72, 0.17),
    kit.box(1.12, 0.10, 0.09).at(0.64, 1.72, 0.17)
  ], 'rusty_iron')
  .add([
    kit.sphere(0.27, 20).scale([1, 1.22, 0.28]).at(0.64, 2.20, 0.15),
    kit.torus(0.095, 0.022).at(1.13, 1.30, 0.19)
  ], 'aged_bronze')
  .at(-7.45, 0, -4.29, -110)
  .commit();
//@@
kit.object('MACH_heavy_oak_pillory')
  .add([
    kit.box(0.21, 2.14, 0.22).at(-0.96, 1.09, 0),
    kit.box(0.21, 2.14, 0.22).at(0.96, 1.09, 0),
    kit.box(0.36, 0.18, 1.12).at(-0.96, 0.11, 0),
    kit.box(0.36, 0.18, 1.12).at(0.96, 0.11, 0),
    kit.box(1.90, 0.17, 0.18).at(0, 0.41, 0),
    kit.extrude(
      [[-1.12, -0.27], [1.12, -0.27], [1.12, 0.27], [-1.12, 0.27]],
      0.19,
      [circleOutline(0.205), circleOutline(0.105, -0.70), circleOutline(0.105, 0.70)]
    ).at(0, 1.57, 0)
  ], 'weathered_wood')
  .add([
    kit.box(0.12, 0.62, 0.24).at(-1.00, 1.57, 0.05),
    kit.box(0.12, 0.62, 0.24).at(1.00, 1.57, 0.05),
    kit.torus(0.07, 0.02).at(1.05, 1.52, 0.22),
    kit.box(0.13, 0.16, 0.09).at(1.05, 1.40, 0.22),
    ...kit.repeat(4, i =>
      kit.sphere(0.033, 10).at(i < 2 ? -1 : 1, i % 2 ? 1.78 : 1.37, 0.19)
    )
  ], 'blackened_iron')
  .at(-5.50, 0, 4.40, 18)
  .commit();
//@@
kit.object('MACH_restrained_interrogation_chair')
  .add([
    kit.box(0.88, 0.14, 0.88).at(0, 0.61, 0),
    ...kit.repeat(4, i =>
      kit.box(0.11, 0.55, 0.11).at(i < 2 ? -0.35 : 0.35, 0.295, i % 2 ? 0.34 : -0.34)
    ),
    kit.box(0.12, 1.28, 0.12).at(-0.40, 1.17, -0.36),
    kit.box(0.12, 1.28, 0.12).at(0.40, 1.17, -0.36),
    ...kit.repeat(5, i => kit.box(0.78, 0.12, 0.10).at(0, 0.85 + i * 0.18, -0.36)),
    kit.box(0.14, 0.10, 0.98).at(-0.53, 0.94, 0.04),
    kit.box(0.14, 0.10, 0.98).at(0.53, 0.94, 0.04),
    kit.box(0.10, 0.33, 0.10).at(-0.53, 0.76, 0.35),
    kit.box(0.10, 0.33, 0.10).at(0.53, 0.76, 0.35),
    kit.box(0.76, 0.10, 0.62).at(0, 0.31, 0.69),
    kit.box(0.10, 0.26, 0.10).at(-0.30, 0.15, 0.87),
    kit.box(0.10, 0.26, 0.10).at(0.30, 0.15, 0.87)
  ], 'dark_wood')
  .add([
    kit.torus(0.095, 0.023).rot(90, 0, 0).at(-0.53, 1.01, 0.25),
    kit.torus(0.095, 0.023).rot(90, 0, 0).at(0.53, 1.01, 0.25),
    kit.torus(0.105, 0.024).at(-0.23, 0.43, 0.83),
    kit.torus(0.105, 0.024).at(0.23, 0.43, 0.83),
    kit.torus(0.26, 0.027).rot(90, 0, 0).at(0, 1.78, -0.26),
    strut([-0.40, 1.70, -0.36], [-0.25, 1.78, -0.26], 0.025),
    strut([0.40, 1.70, -0.36], [0.25, 1.78, -0.26], 0.025)
  ], 'oiled_steel')
  .add([
    kit.box(0.80, 0.14, 0.035).at(0, 1.09, -0.28),
    kit.box(0.79, 0.035, 0.14).at(0, 0.70, 0.09)
  ], 'worn_leather')
  .at(4.55, 0, 3.00, -26)
  .commit();
//@@
kit.object('MACH_standing_breaking_wheel')
  .add([
    kit.torus(1.12, 0.13, 360, 40).at(0, 1.44, 0),
    ...kit.repeat(10, i => {
      const a = i * Math.PI * 2 / 10;
      return kit.box(0.10, 1.05, 0.15)
        .at(0.59 * Math.sin(a), 1.44 + 0.59 * Math.cos(a), 0)
        .rot(0, 0, -a * DEG);
    }),
    kit.cylinder(0.17, 0.17, 0.40, 20).rot(90, 0, 0).at(0, 1.44, 0),
    kit.box(0.22, 1.44, 0.22).at(0, 0.74, -0.34),
    kit.box(1.55, 0.18, 0.30).at(0, 0.11, -0.34),
    kit.box(0.30, 0.18, 1.42).at(-0.62, 0.11, -0.18),
    kit.box(0.30, 0.18, 1.42).at(0.62, 0.11, -0.18)
  ], 'weathered_wood')
  .add([
    kit.torus(1.245, 0.025, 360, 40).at(0, 1.44, 0),
    kit.cylinder(0.07, 0.07, 0.67, 16).rot(90, 0, 0).at(0, 1.44, -0.10),
    ...kit.repeat(4, i => {
      const a = i * Math.PI / 2 + Math.PI / 4;
      return kit.torus(0.095, 0.022).at(0.87 * Math.sin(a), 1.44 + 0.87 * Math.cos(a), 0.12);
    })
  ], 'blackened_iron')
  .at(-6.90, 0, 0.20, 25)
  .commit();
//@@
kit.object('MACH_suspended_gibbet_cage')
  .add([
    kit.cylinder(0.68, 0.68, 0.12, 28).at(0, 0.85, 0),
    kit.torus(0.71, 0.04).rot(90, 0, 0).at(0, 1.04, 0),
    kit.torus(0.70, 0.04).rot(90, 0, 0).at(0, 1.83, 0),
    kit.torus(0.64, 0.04).rot(90, 0, 0).at(0, 2.58, 0),
    kit.torus(0.38, 0.035).rot(90, 0, 0).at(0, 3.08, 0),
    ...kit.repeat(12, i => {
      const a = i * Math.PI * 2 / 12;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return kit.tube([
        [0.65 * c, 0.87, 0.65 * s],
        [0.72 * c, 1.30, 0.72 * s],
        [0.68 * c, 2.25, 0.68 * s],
        [0.56 * c, 2.80, 0.56 * s],
        [0.28 * c, 3.20, 0.28 * s],
        [0, 3.33, 0]
      ], 0.026, 32);
    }),
    kit.torus(0.11, 0.03).at(0, 3.37, 0),
    ...hangingChain(0, 3.52, 0, 1.62)
  ], 'rusty_iron')
  .at(6.90, 0, 0, 0)
  .commit();
//@@
kit.object('MACH_copper_furnace_boiler')
  .add([
    kit.lathe([
      [0.70, -1.36], [0.92, -1.20], [0.94, -0.80],
      [0.94, 1.04], [0.80, 1.23], [0.45, 1.40], [0, 1.45]
    ], 40).at(0, 1.72, 0),
    kit.cylinder(0.12, 0.12, 0.27, 20).at(0.35, 3.17, 0)
  ], 'oxidized_copper')
  .add([
    kit.cylinder(1.02, 1.02, 0.22, 32).at(0, 0.35, 0),
    ...kit.repeat(4, i =>
      kit.box(0.22, 0.30, 0.22).at(i < 2 ? -0.58 : 0.58, 0.17, i % 2 ? 0.58 : -0.58)
    ),
    ...kit.repeat(3, i => kit.torus(0.945, 0.055).rot(90, 0, 0).at(0, 0.65 + i * 1.04, 0)),
    kit.box(0.74, 0.10, 0.18).at(0, 0.57, 0.91),
    kit.box(0.74, 0.10, 0.18).at(0, 1.09, 0.91),
    kit.box(0.10, 0.48, 0.18).at(-0.32, 0.83, 0.91),
    kit.box(0.10, 0.48, 0.18).at(0.32, 0.83, 0.91),
    ...kit.repeat(6, i => kit.box(0.032, 0.43, 0.045).at(-0.23 + i * 0.092, 0.83, 1.025)),
    kit.tube([[0, 3.10, 0], [0, 3.65, 0], [0, 4.05, -0.55], [0, 4.05, -2.95]], 0.23, 36),
    ...kit.repeat(14, i => kit.sphere(0.035, 10).at(0.38, 0.55 + i * 0.17, 0.86))
  ], 'blackened_iron')
  .add(kit.box(0.54, 0.40, 0.025).at(0, 0.83, 0.99), 'ember')
  .add([
    kit.torus(0.16, 0.027).rot(90, 0, 0).at(0.35, 3.36, 0),
    strut([0.19, 3.36, 0], [0.51, 3.36, 0], 0.018)
  ], 'tarnished_brass')
  .at(6.30, 0, -7.50, 0)
  .commit();
//@@
kit.object('MACH_pressure_gauge_manifold')
  .add([
    kit.box(1.22, 0.13, 0.68).at(0, 0.085, 0),
    kit.box(0.15, 1.26, 0.15).at(0, 0.72, 0),
    kit.box(1.06, 0.10, 0.16).at(0, 1.40, 0),
    kit.box(0.07, 0.20, 0.025).at(-0.36, 1.64, 0.285).rot(0, 0, -32),
    kit.box(0.055, 0.23, 0.025).at(0, 1.98, 0.285).rot(0, 0, 26),
    kit.box(0.045, 0.17, 0.025).at(0.36, 1.64, 0.285).rot(0, 0, 48)
  ], 'oiled_steel')
  .add([
    ...kit.repeat(3, i => {
      const x = -0.36 + i * 0.36;
      const y = i === 1 ? 1.94 : 1.61;
      return [
        kit.cylinder(0.19, 0.19, 0.16, 24).rot(90, 0, 0).at(x, y, 0.15),
        kit.torus(0.18, 0.025).at(x, y, 0.265),
        kit.tube([[x, y - 0.18, 0.13], [x, 1.20, 0.13], [x, 0.48, -0.10]], 0.035, 16)
      ];
    }),
    kit.torus(0.15, 0.024).at(0, 0.87, 0.16)
  ], 'tarnished_brass')
  .add([
    kit.cylinder(0.155, 0.155, 0.012, 24).rot(90, 0, 0).at(-0.36, 1.61, 0.25),
    kit.cylinder(0.155, 0.155, 0.012, 24).rot(90, 0, 0).at(0, 1.94, 0.25),
    kit.cylinder(0.155, 0.155, 0.012, 24).rot(90, 0, 0).at(0.36, 1.61, 0.25)
  ], 'yellowed_ceramic')
  .at(4.48, 0, -6.10, -12)
  .commit();
//@@
kit.object('MACH_wall_transmission_gears')
  .add([
    kit.box(3.15, 2.76, 0.18).at(-0.40, 1.88, -0.22),
    kit.cylinder(0.14, 0.14, 0.54, 20).rot(90, 0, 0).at(0, 1.94, 0),
    kit.cylinder(0.08, 0.08, 0.47, 16).rot(90, 0, 0).at(-1.36, 1.65, 0),
    ...kit.repeat(6, i =>
      kit.cylinder(0.065, 0.065, 0.08, 6).rot(90, 0, 0)
        .at(i < 3 ? -1.82 : 1.02, 0.72 + i % 3 * 1.08, -0.08)
    )
  ], 'blackened_iron')
  .add([
    ...gearParts(1.02, 24, 0.18, 0, 1.94, 0.12),
    ...gearParts(0.37, 12, 0.18, -1.36, 1.65, 0.12)
  ], 'tarnished_brass')
  .at(8.42, 0, -4.80, -90)
  .commit();
//@@
kit.object('MACH_steam_piston_pump')
  .add([
    kit.box(1.95, 0.20, 1.24).at(0, 0.12, 0),
    kit.box(0.28, 0.62, 0.28).at(-0.60, 0.50, 0),
    kit.box(0.28, 0.62, 0.28).at(0.59, 0.50, 0),
    kit.cylinder(0.30, 0.30, 0.92, 24).rot(0, 0, 90).at(0.24, 0.94, -0.12),
    kit.cylinder(0.065, 0.065, 1.04, 16).rot(0, 0, 90).at(-0.60, 0.94, -0.12),
    kit.box(0.18, 0.94, 0.18).at(-0.47, 0.68, 0.44),
    strut([-0.47, 1.14, 0.58], [0.20, 0.94, 0.58], 0.048)
  ], 'oiled_steel')
  .add(gearParts(0.60, 18, 0.13, -0.47, 1.14, 0.48), 'aged_brass')
  .add([
    kit.tube([[0.45, 1.23, -0.12], [0.45, 1.58, -0.12], [0.45, 1.58, -0.55], [0.45, 0.44, -0.90], [0.10, 0.44, -2.34]], 0.085, 32),
    kit.torus(0.20, 0.025).rot(90, 0, 0).at(0.45, 1.65, -0.12)
  ], 'oxidized_copper')
  .at(6.18, 0, -4.15, 0)
  .commit();
//@@
kit.object('ENV_right_wall_steam_pipe_bank')
  .add([
    kit.tube([[6.72, 3.18, -7.50], [7.65, 3.18, -7.50], [8.30, 3.18, -6.55], [8.30, 3.18, 5.90], [8.30, 2.70, 6.45], [8.30, 0.48, 6.45]], 0.13, 56),
    kit.tube([[8.30, 2.70, -9.60], [8.30, 2.70, 4.90], [8.30, 2.20, 5.40], [8.30, 0.48, 5.40]], 0.08, 48),
    kit.tube([[8.30, 3.66, -9.65], [8.30, 3.66, 2.80], [8.30, 3.90, 3.20], [8.30, 3.66, 3.60], [8.30, 3.66, 6.70]], 0.07, 48)
  ], 'oxidized_copper')
  .add([
    ...kit.repeat(6, i => [
      kit.box(0.35, 1.22, 0.10).at(8.48, 3.20, -8.20 + i * 2.70),
      kit.torus(0.155, 0.024).at(8.30, 3.18, -8.20 + i * 2.70),
      kit.torus(0.105, 0.020).at(8.30, 2.70, -8.20 + i * 2.70)
    ]),
    kit.torus(0.28, 0.035).rot(0, 90, 0).at(8.04, 1.12, 6.45),
    strut([8.04, 0.84, 6.45], [8.04, 1.40, 6.45], 0.025),
    strut([8.04, 1.12, 6.17], [8.04, 1.12, 6.73], 0.025)
  ], 'blackened_iron')
  .commit();
//@@
kit.object('PRP_wall_shackles')
  .add([
    kit.box(0.22, 0.30, 0.08).at(-0.60, 2.46, 0),
    kit.box(0.22, 0.30, 0.08).at(0.60, 2.46, 0),
    kit.torus(0.10, 0.025).at(-0.60, 2.43, 0.10),
    kit.torus(0.10, 0.025).at(0.60, 2.43, 0.10),
    ...hangingChain(-0.60, 1.57, 0.13, 0.77),
    ...hangingChain(0.60, 1.77, 0.13, 0.57),
    kit.torus(0.14, 0.032).at(-0.60, 1.39, 0.14),
    kit.torus(0.14, 0.032).at(0.60, 1.59, 0.14)
  ], 'rusty_iron')
  .at(-8.69, 0, -2.10, 90)
  .commit();
//@@
kit.object('PRP_wall_implement_rack')
  .add([
    kit.box(2.08, 0.20, 0.13).at(0, 2.17, 0),
    kit.box(2.08, 0.13, 0.13).at(0, 1.43, 0),
    kit.cylinder(0.038, 0.038, 0.62, 12).at(-0.70, 1.75, 0.14),
    kit.cylinder(0.033, 0.033, 0.58, 12).at(0.72, 1.72, 0.14)
  ], 'weathered_wood')
  .add([
    kit.box(0.30, 0.15, 0.14).at(-0.70, 2.04, 0.14),
    kit.box(0.22, 0.21, 0.07).at(0.72, 1.42, 0.14),
    kit.tube([[-0.20, 2.10, 0.15], [-0.32, 1.70, 0.15], [-0.19, 1.32, 0.15]], 0.023, 16),
    kit.tube([[-0.02, 2.10, 0.15], [0.10, 1.70, 0.15], [-0.03, 1.32, 0.15]], 0.023, 16),
    ...kit.repeat(5, i =>
      kit.tube([[-0.84 + i * 0.42, 2.18, 0.05], [-0.84 + i * 0.42, 2.18, 0.20], [-0.84 + i * 0.42, 2.26, 0.23]], 0.018, 10)
    )
  ], 'blackened_iron')
  .at(-8.65, 0, 2.50, 90)
  .commit();
//@@
kit.object('PRP_engineers_workbench')
  .add([
    kit.box(2.35, 0.12, 1.02).at(0, 0.90, 0),
    ...kit.repeat(4, i =>
      kit.box(0.13, 0.84, 0.13).at(i < 2 ? -1.03 : 1.03, 0.44, i % 2 ? 0.39 : -0.39)
    ),
    kit.box(2.10, 0.09, 0.76).at(0, 0.25, 0),
    kit.box(2.08, 0.20, 0.10).at(0, 0.76, 0.43),
    kit.box(2.08, 0.20, 0.10).at(0, 0.76, -0.43)
  ], 'worn_wood_planks')
  .add([
    kit.box(0.30, 0.22, 0.28).at(0.76, 1.07, 0.29),
    kit.box(0.35, 0.09, 0.12).at(0.76, 1.19, 0.29),
    kit.cylinder(0.025, 0.025, 0.38, 12).rot(90, 0, 0).at(0.76, 1.07, 0.52),
    kit.cylinder(0.02, 0.02, 0.33, 10).at(0.76, 1.07, 0.72)
  ], 'oiled_steel')
  .at(3.40, 0, -8.85, 0)
  .commit();
//@@
kit.object('PRP_workbench_hand_tools')
  .add([
    kit.cylinder(0.025, 0.025, 0.44, 12).rot(0, 0, 90).at(0.10, 0.04, 0.10),
    kit.cylinder(0.03, 0.03, 0.27, 12).rot(90, 0, 0).at(-0.20, 0.04, -0.16)
  ], 'dark_wood')
  .add([
    kit.box(0.12, 0.11, 0.22).at(0.34, 0.055, 0.10),
    kit.tube([[-0.34, 0.035, 0.28], [-0.10, 0.035, 0.33], [0.08, 0.035, 0.25]], 0.018, 12),
    kit.tube([[-0.34, 0.035, 0.28], [-0.10, 0.035, 0.18], [0.08, 0.035, 0.25]], 0.018, 12),
    kit.box(0.05, 0.025, 0.19).at(-0.20, 0.025, -0.38)
  ], 'oiled_steel')
  .add([
    kit.cylinder(0.095, 0.115, 0.18, 20).at(0.26, 0.09, -0.22),
    kit.tube([[0.26, 0.15, -0.22], [0.39, 0.21, -0.22], [0.47, 0.25, -0.22]], 0.018, 12)
  ], 'aged_brass')
  .at(3.35, 0.96, -8.85, 0)
  .commit();
//@@
kit.object('PRP_open_maintenance_ledger')
  .add(kit.box(0.56, 0.035, 0.38).at(0, 0.018, 0), 'worn_leather')
  .add([
    kit.box(0.25, 0.035, 0.35).at(-0.13, 0.048, 0).rot(0, 0, 4),
    kit.box(0.25, 0.035, 0.35).at(0.13, 0.048, 0).rot(0, 0, -4),
    kit.box(0.03, 0.05, 0.35).at(0, 0.05, 0)
  ], 'yellowed_paper')
  .at(2.64, 0.96, -8.68, -9)
  .commit();
//@@
kit.object('PRP_coal_bunker')
  .add([
    kit.box(1.40, 0.12, 1.18).at(0, 0.08, 0),
    ...kit.repeat(3, i => [
      kit.box(1.40, 0.15, 0.09).at(0, 0.22 + i * 0.17, 0.55),
      kit.box(1.40, 0.15, 0.09).at(0, 0.22 + i * 0.17, -0.55),
      kit.box(0.09, 0.15, 1.08).at(-0.65, 0.22 + i * 0.17, 0),
      kit.box(0.09, 0.15, 1.08).at(0.65, 0.22 + i * 0.17, 0)
    ])
  ], 'weathered_wood')
  .add([
    kit.box(1.16, 0.37, 0.94).at(0, 0.32, 0),
    ...kit.repeat(18, i => {
      const a = i * 2.399963;
      const r = 0.12 + 0.40 * Math.sqrt((i + 1) / 18);
      return kit.sphere(0.145 + (i % 3) * 0.018, 8)
        .scale([1.15, 0.75, 0.90])
        .at(r * Math.cos(a), 0.52 + 0.035 * Math.sin(i * 1.7), r * Math.sin(a) * 0.76);
    })
  ], 'coal')
  .at(7.35, 0, -9.18, 0)
  .commit();
//@@
kit.object('PRP_furnace_shovel')
  .add(kit.cylinder(0.028, 0.033, 1.12, 12).at(0.13, 0.93, 0).rot(0, 0, -12), 'worn_wood')
  .add([
    kit.extrude([[-0.15, -0.18], [0.15, -0.18], [0.13, 0.18], [-0.13, 0.18]], 0.045)
      .at(0, 0.21, 0).rot(0, 0, -12),
    kit.torus(0.095, 0.02).at(0.25, 1.55, 0)
  ], 'sooty_iron')
  .at(7.90, 0, -8.43, -12)
  .commit();
//@@
kit.object('PRP_cell_sleeping_pallet')
  .add([
    kit.box(2.05, 0.11, 0.84).at(0, 0.12, 0),
    kit.box(0.14, 0.08, 0.70).at(-0.82, 0.04, 0),
    kit.box(0.14, 0.08, 0.70).at(0.82, 0.04, 0)
  ], 'weathered_wood')
  .add([
    kit.box(1.95, 0.14, 0.77).at(0, 0.245, 0),
    kit.box(0.38, 0.12, 0.62).at(-0.73, 0.37, 0),
    kit.box(0.73, 0.035, 0.79).at(0.54, 0.335, 0)
  ], 'dirty_fabric')
  .add(kit.repeat(14, i =>
    kit.cylinder(0.008, 0.008, 0.30 + i % 3 * 0.07, 6)
      .rot(90, i * 23, 0)
      .at(-0.85 + i * 0.13, 0.19, 0.39)
  ), 'old_straw')
  .at(-6.83, 0, -9.02, 0)
  .commit();
//@@
kit.object('PRP_cell_bucket')
  .add(kit.cylinder(0.23, 0.18, 0.40, 20).at(0, 0.22, 0), 'weathered_wood')
  .add([
    kit.torus(0.197, 0.018).rot(90, 0, 0).at(0, 0.13, 0),
    kit.torus(0.223, 0.018).rot(90, 0, 0).at(0, 0.35, 0),
    kit.torus(0.225, 0.015, 180, 20).at(0, 0.43, 0)
  ], 'rusty_iron')
  .add(kit.cylinder(0.212, 0.212, 0.008, 24).at(0, 0.423, 0), 'dark_water')
  .at(-4.35, 0, -9.33, 0)
  .commit();
//@@
kit.object('PRP_foreground_large_barrel')
  .add([
    kit.lathe([[0.34, -0.54], [0.39, -0.43], [0.44, 0], [0.39, 0.43], [0.34, 0.54]], 28).at(0, 0.56, 0),
    kit.cylinder(0.34, 0.34, 0.035, 28).at(0, 1.085, 0)
  ], 'weathered_wood')
  .add([
    kit.torus(0.397, 0.026).rot(90, 0, 0).at(0, 0.20, 0),
    kit.torus(0.444, 0.026).rot(90, 0, 0).at(0, 0.56, 0),
    kit.torus(0.397, 0.026).rot(90, 0, 0).at(0, 0.92, 0)
  ], 'blackened_iron')
  .at(-7.55, 0, 6.70, 0)
  .commit();
//@@
kit.object('PRP_foreground_small_barrel')
  .add([
    kit.lathe([[0.27, -0.39], [0.32, -0.30], [0.35, 0], [0.32, 0.30], [0.27, 0.39]], 24).at(0, 0.41, 0),
    kit.cylinder(0.27, 0.27, 0.035, 24).at(0, 0.79, 0)
  ], 'worn_wood')
  .add([
    kit.torus(0.326, 0.023).rot(90, 0, 0).at(0, 0.16, 0),
    kit.torus(0.326, 0.023).rot(90, 0, 0).at(0, 0.66, 0)
  ], 'rusty_iron')
  .at(-6.62, 0, 7.18, 0)
  .commit();
//@@
kit.object('PRP_foreground_supply_crate')
  .add([
    kit.box(1.08, 0.66, 0.86).at(0, 0.35, 0),
    kit.box(0.10, 0.68, 0.92).at(-0.42, 0.35, 0),
    kit.box(0.10, 0.68, 0.92).at(0.42, 0.35, 0),
    kit.box(1.10, 0.10, 0.92).at(0, 0.64, 0),
    kit.box(1.10, 0.10, 0.92).at(0, 0.09, 0),
    kit.box(0.10, 0.74, 0.06).at(0, 0.35, 0.48).rot(0, 0, -53)
  ], 'worn_wood_planks')
  .add(kit.repeat(4, i =>
    kit.sphere(0.023, 8).at(i < 2 ? -0.43 : 0.43, i % 2 ? 0.61 : 0.11, 0.48)
  ), 'blackened_iron')
  .at(-5.48, 0, 7.66, -12)
  .commit();
//@@
kit.object('PRP_discarded_floor_restraints')
  .add([
    kit.torus(0.14, 0.028).rot(90, 0, 0).at(-0.42, 0.045, 0),
    kit.torus(0.14, 0.028).rot(90, 0, 0).at(0.42, 0.045, 0.03),
    ...kit.repeat(8, i =>
      kit.torus(0.068, 0.016, 360, 12)
        .scale([1.15, 0.75, 1])
        .rot(90, 0, i * 17)
        .at(-0.29 + i * 0.083, 0.034, 0.045 * Math.sin(i * 0.85))
    )
  ], 'rusty_iron')
  .at(2.10, 0, 5.76, 20)
  .commit();
//@@
kit.object('PRP_stone_drip_basin')
  .add(kit.lathe([
    [0.30, 0], [0.43, 0.08], [0.46, 0.24],
    [0.38, 0.24], [0.34, 0.09], [0, 0.09]
  ], 28).at(0, 0.02, 0), 'mossy_stone_block')
  .add(kit.cylinder(0.365, 0.365, 0.008, 28).at(0, 0.185, 0), 'dark_water')
  .at(-8.02, 0, -1.86, 0)
  .commit();
//@@
kit.object('PRP_spare_rack_counterweights')
  .add(kit.repeat(3, i => [
    kit.cylinder(0.20 + i * 0.025, 0.26 + i * 0.025, 0.25, 16)
      .at(-0.49 + i * 0.49, 0.145, i % 2 * 0.24),
    kit.torus(0.095, 0.025).at(-0.49 + i * 0.49, 0.34, i % 2 * 0.24)
  ]), 'blackened_iron')
  .at(-1.20, 0, -3.45, 0)
  .commit();
//@@
kit.object('PRP_foreground_inspection_grate')
  .add([
    kit.box(1.42, 0.025, 1.42).at(0, 0.029, 0),
    kit.box(1.46, 0.055, 0.07).at(0, 0.047, -0.70),
    kit.box(1.46, 0.055, 0.07).at(0, 0.047, 0.70),
    kit.box(0.07, 0.055, 1.36).at(-0.70, 0.047, 0),
    kit.box(0.07, 0.055, 1.36).at(0.70, 0.047, 0),
    ...kit.repeat(10, i => kit.box(0.035, 0.047, 1.34).at(-0.59 + i * 0.13, 0.052, 0)),
    ...kit.repeat(4, i => kit.box(1.34, 0.035, 0.035).at(0, 0.065, -0.48 + i * 0.32))
  ], 'blackened_iron')
  .at(-0.05, 0, 4.25, 0)
  .commit();
//@@
kit.object('PRP_rack_overhead_gas_pendant')
  .add([
    ...hangingChain(0, 4.88, 0, 1.53),
    kit.cone(0.47, 0.25, 32).at(0, 4.71, 0),
    kit.torus(0.47, 0.024).rot(90, 0, 0).at(0, 4.585, 0),
    kit.torus(0.19, 0.018).rot(90, 0, 0).at(0, 4.39, 0),
    kit.torus(0.19, 0.018).rot(90, 0, 0).at(0, 4.58, 0),
    ...kit.repeat(4, i => {
      const a = i * Math.PI / 2;
      return kit.cylinder(0.012, 0.012, 0.20, 8).at(0.19 * Math.cos(a), 4.485, 0.19 * Math.sin(a));
    })
  ], 'blackened_iron')
  .add(kit.cylinder(0.075, 0.09, 0.13, 20).at(0, 4.62, 0), 'tarnished_brass')
  .add(kit.sphere(0.095, 20).at(0, 4.48, 0), 'lamp_light')
  .at(-1.40, 0, -1.00, 0)
  .commit();
//@@
kit.object('PRP_rear_wall_gas_lamp')
  .add([
    kit.box(0.20, 0.44, 0.07).at(0, 2.58, 0),
    kit.tube([[0, 2.46, 0], [0, 2.46, 0.34], [0, 2.68, 0.42]], 0.035, 16),
    kit.cone(0.24, 0.18, 24).at(0, 3.07, 0.42),
    kit.cylinder(0.17, 0.17, 0.05, 20).at(0, 2.68, 0.42),
    ...kit.repeat(4, i => {
      const a = i * Math.PI / 2;
      return kit.cylinder(0.013, 0.013, 0.32, 8).at(0.15 * Math.cos(a), 2.85, 0.42 + 0.15 * Math.sin(a));
    })
  ], 'tarnished_brass')
  .add(kit.cylinder(0.065, 0.065, 0.20, 16).at(0, 2.84, 0.42), 'lamp_light')
  .at(1.48, 0, -10.27, 0)
  .commit();
//@@
kit.object('PRP_left_wall_gas_lantern')
  .add([
    kit.box(0.20, 0.44, 0.07).at(0, 2.14, 0),
    kit.tube([[0, 2.02, 0], [0, 2.02, 0.36], [0, 2.21, 0.36]], 0.035, 16),
    kit.cylinder(0.17, 0.17, 0.05, 20).at(0, 2.22, 0.36),
    kit.cone(0.23, 0.17, 24).at(0, 2.67, 0.36),
    ...kit.repeat(4, i => {
      const a = i * Math.PI / 2;
      return kit.cylinder(0.012, 0.012, 0.36, 8).at(0.15 * Math.cos(a), 2.42, 0.36 + 0.15 * Math.sin(a));
    })
  ], 'aged_brass')
  .add(kit.cylinder(0.065, 0.065, 0.22, 16).at(0, 2.42, 0.36), 'lamp_light')
  .at(-8.67, 0, -3.30, 90)
  .commit();
//@@
kit.object('PRP_right_wall_gas_lantern')
  .add([
    kit.box(0.20, 0.44, 0.07).at(0, 2.14, 0),
    kit.tube([[0, 2.02, 0], [0, 2.02, 0.36], [0, 2.21, 0.36]], 0.035, 16),
    kit.cylinder(0.17, 0.17, 0.05, 20).at(0, 2.22, 0.36),
    kit.cone(0.23, 0.17, 24).at(0, 2.67, 0.36),
    ...kit.repeat(4, i => {
      const a = i * Math.PI / 2;
      return kit.cylinder(0.012, 0.012, 0.36, 8).at(0.15 * Math.cos(a), 2.42, 0.36 + 0.15 * Math.sin(a));
    })
  ], 'aged_brass')
  .add(kit.cylinder(0.065, 0.065, 0.22, 16).at(0, 2.42, 0.36), 'lamp_light')
  .at(8.67, 0, 3.80, -90)
  .commit();
//@@
kit.person('CHAR_dungeon_keeper', {
  x: 2.02,
  y: 0.02,
  z: -4.20,
  rotY: -110,
  height: 1.78,
  pose: 'stand'
});
//@@
kit.light('LGT_rack_pendant_key', {
  type: 'spot',
  pos: [-1.40, 4.38, -1.00],
  target: [-1.40, 0.85, -1.00],
  color: '#ffd09a',
  intensity: 45,
  distance: 12,
  angleDeg: 48
});
//@@
kit.light('LGT_cold_ventilation_rim', {
  type: 'spot',
  pos: [-5.70, 4.90, -9.94],
  target: [-0.40, 0.40, 1.60],
  color: '#a9cddd',
  intensity: 38,
  distance: 22,
  angleDeg: 29
});
//@@
kit.light('LGT_soft_chamber_bounce', {
  type: 'area',
  pos: [1.80, 4.10, 6.90],
  target: [-1.10, 1.00, -2.80],
  color: '#bdc6cd',
  intensity: 3,
  width: 5.5,
  height: 3.5
});
//@@
kit.light('LGT_boiler_fire_practical', {
  type: 'point',
  pos: [6.30, 0.87, -6.30],
  color: '#ff843f',
  intensity: 19,
  distance: 7
});
//@@
kit.light('LGT_left_lantern_practical', {
  type: 'point',
  pos: [-8.24, 2.42, -3.30],
  color: '#ffc27e',
  intensity: 12,
  distance: 8
});
//@@
kit.light('LGT_right_lantern_practical', {
  type: 'point',
  pos: [8.24, 2.42, 3.80],
  color: '#ffd099',
  intensity: 10,
  distance: 7
});
//@@
kit.light('LGT_rear_lantern_practical', {
  type: 'point',
  pos: [1.48, 2.84, -9.77],
  color: '#ffbb73',
  intensity: 10,
  distance: 7
});
//@@
kit.camera('CAM_main', {
  pos: [6.65, 2.60, 8.60],
  lookAt: [-1.00, 1.40, -2.70],
  fov: 50
});
//@@
kit.camera('CAM_wide', {
  pos: [0.15, 4.20, 9.70],
  lookAt: [0, 1.95, -3.20],
  fov: 68
});
//@@
kit.camera('CAM_closeup', {
  pos: [-3.80, 1.95, 2.20],
  lookAt: [-1.10, 1.05, -0.70],
  fov: 43
});
//@@