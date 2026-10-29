kit.describe({ title: 'Midnight Coffee Lane', setting: 'An eight-metre-wide cobbled street in an old European city', style: 'Realistic architectural grey-box with layered historic silhouettes', era: 'Present day within nineteenth-century buildings', lighting: 'Blue night with warm café windows and street lamps', palette: 'Wet charcoal stone, weathered ochre and cream plaster, dark iron', mood: 'Quiet, intimate, rain-soaked' });
function streetBuildingB1(name, side, index, plasterMaterial) {
  const wallHeight = index % 2 === 0 ? 9 : 12;
  const ridgeRise = 1.35;
  const roofHalfWidth = 2.76;
  const pitch = Math.atan2(ridgeRise, roofHalfWidth) * 180 / Math.PI;
  const roofSlope = Math.hypot(roofHalfWidth, ridgeRise);
  return kit.object(name)
    .add([
      kit.box(0.24, wallHeight, 7).at(-2.48, wallHeight / 2, 0),
      kit.box(0.24, wallHeight, 7).at(2.48, wallHeight / 2, 0),
      kit.box(4.72, wallHeight, 0.24).at(0, wallHeight / 2, -3.38),
      kit.box(4.72, wallHeight, 0.24).at(0, wallHeight / 2, 3.38),
      kit.extrude([[-2.6, 0], [2.6, 0], [0, ridgeRise]], 0.22).at(0, wallHeight, -3.5),
      kit.extrude([[-2.6, 0], [2.6, 0], [0, ridgeRise]], 0.22).at(0, wallHeight, 3.28)
    ], plasterMaterial)
    .add([
      kit.box(5.2, 0.18, 7).at(0, 0.09, 0),
      kit.box(5.2, 0.18, 7).at(0, wallHeight - 0.09, 0),
      kit.box(0.12, 0.48, 7).at(-2.62, 0.24, 0),
      kit.box(0.12, 0.48, 7).at(2.62, 0.24, 0),
      kit.box(5.46, 0.18, 7).at(0, wallHeight - 0.16, 0)
    ], 'weathered_stone_block')
    .add([
      kit.box(roofSlope, 0.14, 7).rot(0, 0, pitch).at(-roofHalfWidth / 2, wallHeight + ridgeRise / 2, 0),
      kit.box(roofSlope, 0.14, 7).rot(0, 0, -pitch).at(roofHalfWidth / 2, wallHeight + ridgeRise / 2, 0),
      kit.cylinder(0.1, 0.1, 7, 12).rot(90, 0, 0).at(0, wallHeight + ridgeRise + 0.04, 0)
    ], 'aged_roof_tiles')
    .add([
      kit.box(0.55, 1.35, 0.62).at(side * 1.35, wallHeight + 1.02, 1.9),
      kit.box(0.69, 0.12, 0.76).at(side * 1.35, wallHeight + 1.755, 1.9)
    ], 'sooty_brick')
    .add([
      kit.cylinder(0.075, 0.075, wallHeight - 0.25, 12).at(-side * 2.72, (wallHeight - 0.25) / 2 + 0.12, 3.15),
      kit.cylinder(0.09, 0.09, 7, 12).rot(90, 0, 0).at(-side * 2.76, wallHeight - 0.08, 0)
    ], 'blackened_iron')
    .at(side * 6.6, 0, -17.5 + index * 7)
    .commit();
}
//@@
kit.object('ENV_street_ground_foundation')
  .add(kit.box(36, 0.22, 100).at(0, -0.2, 0), 'wet_dark_cobblestone')
  .commit();
//@@
{
  const stones = [];
  const columns = 20;
  const rows = 140;
  for (let row = 0; row < rows; row++) {
    const stagger = row % 2 ? 0.16 : 0;
    for (let column = -1; column < columns; column++) {
      const left = Math.max(-3.2, -3.2 + column * 0.32 + stagger);
      const right = Math.min(3.2, -3.2 + (column + 1) * 0.32 + stagger);
      if (right - left < 0.025) continue;
      const x = (left + right) / 2;
      const z = -21 + (row + 0.5) * 0.3;
      const w = right - left - 0.012;
      const d = 0.286 - 0.004 * Math.sin(row * 2.3 + column * 1.7);
      const bevel = 0.025 + 0.006 * Math.sin(column * 3.1 + row);
      const top = 0.036 * (1 - Math.pow(Math.abs(x) / 3.2, 1.6)) + 0.002 * Math.sin(row * 1.9 + column * 2.7);
      stones.push(
        kit.extrude([
          [-w / 2 + bevel, -d / 2],
          [w / 2 - bevel * 0.8, -d / 2],
          [w / 2, -d / 2 + bevel],
          [w / 2, d / 2 - bevel * 1.2],
          [w / 2 - bevel, d / 2],
          [-w / 2 + bevel * 0.8, d / 2],
          [-w / 2, d / 2 - bevel],
          [-w / 2, -d / 2 + bevel]
        ], 0.075).rot(-90, 0, 0).at(x, top - 0.075, z)
      );
    }
  }
  kit.object('ENV_individual_crowned_cobblestones')
    .add(stones, 'wet_dark_cobblestone')
    .commit();
}
//@@
kit.object('ENV_narrow_stone_pavements')
  .add([
    ...kit.repeat(84, i => kit.box(0.77, 0.16, 0.488).at(-3.6, 0.02, -20.75 + i * 0.5)),
    ...kit.repeat(84, i => kit.box(0.77, 0.16, 0.488).at(3.6, 0.02, -20.75 + i * 0.5))
  ], 'wet_stone_floor')
  .add([
    ...kit.repeat(42, i => kit.box(0.14, 0.18, 0.982).at(-3.15, 0.01, -20.5 + i)),
    ...kit.repeat(42, i => kit.box(0.14, 0.18, 0.982).at(3.15, 0.01, -20.5 + i))
  ], 'worn_stone_block')
  .commit();
//@@
kit.object('ENV_shallow_roadside_puddles')
  .add([
    kit.puddle(0.55, 1.7, 11).at(-2.76, 0.016, -3.2),
    kit.puddle(0.48, 2.15, 23).at(2.83, 0.015, 3.3),
    kit.puddle(0.6, 1.45, 37).at(-2.73, 0.017, 9.4),
    kit.puddle(0.45, 1.75, 41).at(2.85, 0.014, -10.2),
    kit.puddle(0.52, 1.3, 59).at(-2.81, 0.015, -15.5),
    kit.puddle(0.45, 2.05, 67).at(2.86, 0.014, 16.2)
  ], 'water')
  .commit();
//@@
streetBuildingB1('ENV_left_building_01', -1, 0, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_left_building_02', -1, 1, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_03', -1, 2, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_left_building_04', -1, 3, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_left_building_05', -1, 4, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_06', -1, 5, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_01', 1, 0, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_02', 1, 1, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_03', 1, 2, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_right_building_04_cafe', 1, 3, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_05', 1, 4, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_06', 1, 5, 'aged_stone_grey_plaster');
//@@
function streetFacadeB2(name, side, index) {
  const height = index % 2 === 0 ? 9 : 12;
  const isCafe = side === 1 && index === 3;
  const stone = [
    kit.box(6.88, 0.2, 0.18).at(0, 3.05, 0.07),
    kit.box(6.88, 0.18, 0.22).at(0, height - 0.48, 0.09),
    ...kit.repeat(2, i => kit.box(0.22, height - 0.9, 0.12).at(i ? 3.31 : -3.31, height / 2, 0.035))
  ];
  const timber = [];
  const iron = [];
  const glass = [];
  const warm = [];
  const windows = height === 9
    ? [[-1.55, 4.55], [1.55, 4.55], [-1.55, 7.35], [1.55, 7.35]]
    : [[-1.55, 4.55], [1.55, 7.45], [-1.55, 10.35], [1.55, 10.35]];

  for (let w = 0; w < windows.length; w++) {
    const u = windows[w][0];
    const y = windows[w][1];
    const lit = index % 2 === 0 && w === (side === -1 ? 1 : 2);

    stone.push(
      kit.box(1.52, 0.14, 0.32).at(u, y - 0.87, 0.13),
      kit.box(1.48, 0.17, 0.22).at(u, y + 0.88, 0.08),
      kit.box(0.13, 1.64, 0.17).at(u - 0.655, y, 0.055),
      kit.box(0.13, 1.64, 0.17).at(u + 0.655, y, 0.055)
    );

    timber.push(
      kit.box(1.17, 0.075, 0.1).at(u, y - 0.76, 0.12),
      kit.box(1.17, 0.075, 0.1).at(u, y + 0.76, 0.12),
      kit.box(0.075, 1.52, 0.1).at(u - 0.55, y, 0.12),
      kit.box(0.075, 1.52, 0.1).at(u + 0.55, y, 0.12),
      kit.box(0.055, 1.48, 0.09).at(u, y, 0.15),
      kit.box(1.08, 0.055, 0.09).at(u, y + 0.16, 0.15)
    );

    (lit ? warm : glass).push(
      kit.box(1.05, 1.45, 0.035).at(u, y, 0.085)
    );

    for (let leaf = 0; leaf < 2; leaf++) {
      const shutterU = u + (leaf === 0 ? -1 : 1) * 0.985;
      timber.push(
        kit.box(0.51, 0.09, 0.11).at(shutterU, y - 0.735, 0.14),
        kit.box(0.51, 0.09, 0.11).at(shutterU, y + 0.735, 0.14),
        kit.box(0.065, 1.42, 0.11).at(shutterU - 0.222, y, 0.14),
        kit.box(0.065, 1.42, 0.11).at(shutterU + 0.222, y, 0.14),
        ...kit.repeat(11, slat =>
          kit.box(0.39, 0.105, 0.055)
            .rot(-22, 0, 0)
            .at(shutterU, y - 0.61 + slat * 0.122, 0.145)
        )
      );
      iron.push(
        kit.box(0.31, 0.045, 0.035).at(shutterU, y - 0.52, 0.205),
        kit.box(0.31, 0.045, 0.035).at(shutterU, y + 0.52, 0.205),
        kit.sphere(0.035, 8).at(shutterU, y - 0.89, 0.18)
      );
    }
  }

  if (!isCafe) {
    stone.push(
      kit.box(1.62, 0.08, 0.36).at(0, 0.14, 0.12),
      kit.box(0.18, 2.22, 0.23).at(-0.73, 1.25, 0.075),
      kit.box(0.18, 2.22, 0.23).at(0.73, 1.25, 0.075),
      kit.box(1.64, 0.22, 0.26).at(0, 2.4, 0.09)
    );
    timber.push(
      kit.box(1.26, 2.1, 0.09).at(0, 1.22, 0.075),
      kit.box(0.075, 2.02, 0.045).at(0, 1.22, 0.142),
      ...kit.repeat(4, panel =>
        kit.box(0.45, 0.75, 0.045).at(
          panel % 2 ? 0.315 : -0.315,
          panel < 2 ? 0.72 : 1.69,
          0.142
        )
      )
    );
    iron.push(
      kit.box(1.19, 0.16, 0.025).at(0, 0.29, 0.14),
      kit.box(0.07, 0.23, 0.035).at(0.39, 1.23, 0.17),
      kit.torus(0.055, 0.012, 360, 12).at(0.39, 1.2, 0.205)
    );
  }

  const facade = kit.object(name)
    .add(stone, 'worn_stone_block')
    .add(timber, 'weathered_dark_wood')
    .add(iron, 'blackened_iron')
    .add(glass, 'dark_glass');

  if (warm.length) facade.add(warm, 'warm_lamp_light');

  return facade
    .at(side * 3.99, 0, -17.5 + index * 7, side === -1 ? 90 : -90)
    .commit();
}
streetFacadeB2('ENV_left_facade_01', -1, 0);
//@@
streetFacadeB2('ENV_left_facade_02', -1, 1);
//@@
streetFacadeB2('ENV_left_facade_03', -1, 2);
//@@
streetFacadeB2('ENV_left_facade_04', -1, 3);
//@@
streetFacadeB2('ENV_left_facade_05', -1, 4);
//@@
streetFacadeB2('ENV_left_facade_06', -1, 5);
//@@
streetFacadeB2('ENV_right_facade_01', 1, 0);
//@@
streetFacadeB2('ENV_right_facade_02', 1, 1);
//@@
streetFacadeB2('ENV_right_facade_03', 1, 2);
//@@
streetFacadeB2('ENV_right_facade_04_cafe', 1, 3);
//@@
streetFacadeB2('ENV_right_facade_05', 1, 4);
//@@
streetFacadeB2('ENV_right_facade_06', 1, 5);
//@@
kit.object('ENV_cafe_glazed_front')
  .add([
    kit.box(3.6, 0.08, 0.38).at(0, 0.14, 0.13),
    kit.box(0.16, 2.42, 0.22).at(-1.73, 1.35, 0.08),
    kit.box(0.16, 2.42, 0.22).at(1.73, 1.35, 0.08)
  ], 'worn_stone_block')
  .add([
    kit.box(0.12, 2.2, 0.15).at(-0.58, 1.28, 0.13),
    kit.box(0.12, 2.2, 0.15).at(0.58, 1.28, 0.13),
    kit.box(1.28, 0.13, 0.16).at(0, 2.34, 0.13),
    kit.box(1.05, 0.44, 0.12).at(0, 0.4, 0.125),
    kit.box(1.05, 0.07, 0.13).at(0, 1.48, 0.15),
    ...kit.repeat(2, i => {
      const u = i ? 1.13 : -1.13;
      return [
        kit.box(0.86, 0.55, 0.15).at(u, 0.455, 0.11),
        kit.box(0.08, 1.6, 0.15).at(u - 0.43, 1.51, 0.13),
        kit.box(0.08, 1.6, 0.15).at(u + 0.43, 1.51, 0.13),
        kit.box(0.94, 0.08, 0.15).at(u, 0.75, 0.13),
        kit.box(0.94, 0.08, 0.15).at(u, 2.29, 0.13),
        kit.box(0.94, 0.065, 0.13).at(u, 1.82, 0.15)
      ];
    }),
    kit.box(3.6, 0.54, 0.19).at(0, 2.76, 0.125),
    kit.box(3.72, 0.1, 0.3).at(0, 3.065, 0.16),
    kit.box(3.68, 0.08, 0.25).at(0, 2.455, 0.15)
  ], 'dark_painted_wood')
  .add([
    kit.box(1.02, 1.61, 0.035).at(0, 1.435, 0.09),
    kit.box(0.78, 1.46, 0.035).at(-1.13, 1.51, 0.09),
    kit.box(0.78, 1.46, 0.035).at(1.13, 1.51, 0.09)
  ], 'dark_glass')
  .add([
    kit.box(0.045, 0.3, 0.055).at(0.39, 1.26, 0.245),
    kit.box(0.045, 0.045, 0.1).at(0.39, 1.39, 0.205),
    kit.box(0.045, 0.045, 0.1).at(0.39, 1.13, 0.205),
    kit.box(3.44, 0.022, 0.025).at(0, 2.535, 0.235),
    kit.box(3.44, 0.022, 0.025).at(0, 2.985, 0.235)
  ], 'aged_brass')
  .add(
    kit.text('CAFÉ DE NUIT', { size: 0.27, depth: 0.025, align: 'center' })
      .at(0, 2.66, 0.24),
    'warm_lamp_light'
  )
  .at(3.98, 0, 5, -90)
  .commit();
//@@
kit.object('PRP_cafe_left_wall_lantern')
  .add([
    kit.box(0.13, 0.36, 0.07).at(0, 2.12, 0.06),
    kit.tube([[0, 2.21, 0.09], [0, 2.39, 0.2], [0, 2.39, 0.42], [0, 2.28, 0.47]], 0.023, 16),
    kit.box(0.28, 0.055, 0.25).at(0, 1.83, 0.47),
    kit.box(0.3, 0.055, 0.27).at(0, 2.21, 0.47),
    kit.cone(0.22, 0.16, 4).rot(0, 45, 0).at(0, 2.31, 0.47),
    ...kit.repeat(4, i =>
      kit.box(0.025, 0.35, 0.025).at(
        i < 2 ? -0.115 : 0.115,
        2.02,
        0.47 + (i % 2 ? 0.1 : -0.1)
      )
    )
  ], 'blackened_iron')
  .add([
    kit.box(0.205, 0.31, 0.012).at(0, 2.02, 0.57),
    kit.box(0.012, 0.31, 0.18).at(-0.115, 2.02, 0.47),
    kit.box(0.012, 0.31, 0.18).at(0.115, 2.02, 0.47)
  ], 'glass')
  .add(kit.sphere(0.061, 12).at(0, 2.02, 0.47), 'warm_lamp_light')
  .at(3.98, 0, 3.43, -90)
  .commit();
//@@
kit.object('PRP_cafe_right_wall_lantern')
  .add([
    kit.box(0.13, 0.36, 0.07).at(0, 2.12, 0.06),
    kit.tube([[0, 2.21, 0.09], [0, 2.39, 0.2], [0, 2.39, 0.42], [0, 2.28, 0.47]], 0.023, 16),
    kit.box(0.28, 0.055, 0.25).at(0, 1.83, 0.47),
    kit.box(0.3, 0.055, 0.27).at(0, 2.21, 0.47),
    kit.cone(0.22, 0.16, 4).rot(0, 45, 0).at(0, 2.31, 0.47),
    ...kit.repeat(4, i =>
      kit.box(0.025, 0.35, 0.025).at(
        i < 2 ? -0.115 : 0.115,
        2.02,
        0.47 + (i % 2 ? 0.1 : -0.1)
      )
    )
  ], 'blackened_iron')
  .add([
    kit.box(0.205, 0.31, 0.012).at(0, 2.02, 0.57),
    kit.box(0.012, 0.31, 0.18).at(-0.115, 2.02, 0.47),
    kit.box(0.012, 0.31, 0.18).at(0.115, 2.02, 0.47)
  ], 'glass')
  .add(kit.sphere(0.061, 12).at(0, 2.02, 0.47), 'warm_lamp_light')
  .at(3.98, 0, 6.57, -90)
  .commit();
//@@
{
  const creamB3 = [];
  const burgundyB3 = [];
  const canopySlopeB3 = Math.hypot(0.64, 0.18);
  const canopyPitchB3 = Math.atan2(0.18, 0.64) * 180 / Math.PI;
  kit.define('cart_cream_fabric', { base: 'fabric', color: '#e7ddc6', roughness: 0.85 });
  kit.define('cart_burgundy_fabric', { base: 'fabric', color: '#622e39', roughness: 0.85 });

  for (let stripeB3 = 0; stripeB3 < 10; stripeB3++) {
    const stripeX = -0.945 + stripeB3 * 0.21;
    const stripeParts = [
      kit.box(0.21, 0.025, canopySlopeB3).rot(-canopyPitchB3, 0, 0).at(stripeX, 2.21, -0.32),
      kit.box(0.21, 0.025, canopySlopeB3).rot(canopyPitchB3, 0, 0).at(stripeX, 2.21, 0.32),
      kit.box(0.21, 0.15, 0.025).at(stripeX, 2.045, -0.64),
      kit.box(0.21, 0.15, 0.025).at(stripeX, 2.045, 0.64)
    ];
    (stripeB3 % 2 === 0 ? creamB3 : burgundyB3).push(...stripeParts);
  }

  kit.object('PRP_central_coffee_cart')
    .add([
      kit.box(1.68, 0.09, 0.72).at(0, 0.38, 0),
      kit.box(1.68, 0.065, 0.74).at(0, 0.96, 0),
      ...kit.repeat(4, i => {
        const x = i < 2 ? -0.79 : 0.79;
        const z = i % 2 ? 0.32 : -0.32;
        return [
          kit.box(0.045, 0.6, 0.045).at(x, 0.67, z),
          kit.cylinder(0.018, 0.018, 0.27, 12).at(x, 0.17, z),
          kit.cylinder(0.065, 0.065, 0.025, 16).at(x, 0.047, z),
          kit.box(0.075, 0.16, 0.08).at(x, 0.33, z)
        ];
      }),
      ...kit.repeat(4, i =>
        kit.cylinder(0.022, 0.022, 1.08, 12).at(
          i < 2 ? -0.83 : 0.83,
          1.59,
          i % 2 ? 0.38 : -0.38
        )
      ),
      ...kit.repeat(2, i =>
        kit.tube([
          [i ? 0.83 : -0.83, 2.12, -0.64],
          [i ? 0.83 : -0.83, 2.3, 0],
          [i ? 0.83 : -0.83, 2.12, 0.64]
        ], 0.018, 16)
      ),
      kit.cylinder(0.018, 0.018, 2.1, 12).rot(0, 0, 90).at(0, 2.3, 0),
      kit.tube([
        [-0.65, 0.91, 0.37],
        [-0.65, 0.91, 0.52],
        [0.65, 0.91, 0.52],
        [0.65, 0.91, 0.37]
      ], 0.025, 16)
    ], 'black_painted_metal_plate')
    .add([
      kit.box(1.8, 0.08, 0.9).at(0, 1.03, 0),
      ...kit.repeat(10, i =>
        kit.box(0.155, 0.49, 0.045).at(-0.72 + i * 0.16, 0.685, -0.355)
      ),
      ...kit.repeat(2, i =>
        kit.box(0.045, 0.49, 0.64).at(i ? 0.815 : -0.815, 0.685, 0)
      ),
      kit.box(1.54, 0.42, 0.045).at(0, 0.69, 0.355)
    ], 'oiled_dark_wood')
    .add([
      ...kit.repeat(4, i =>
        kit.cylinder(0.155, 0.155, 0.1, 20)
          .rot(0, 0, 90)
          .at(i < 2 ? -0.82 : 0.82, 0.19, i % 2 ? 0.26 : -0.26)
      )
    ], 'worn_rubber')
    .add([
      ...kit.repeat(4, i =>
        kit.cylinder(0.09, 0.09, 0.108, 16)
          .rot(0, 0, 90)
          .at(i < 2 ? -0.82 : 0.82, 0.19, i % 2 ? 0.26 : -0.26)
      ),
      ...kit.repeat(2, i =>
        kit.cylinder(0.025, 0.025, 1.7, 12)
          .rot(0, 0, 90)
          .at(0, 0.19, i ? 0.26 : -0.26)
      )
    ], 'aged_steel')
    .add([
      kit.box(1.05, 0.29, 0.025).at(0, 0.72, -0.392),
      kit.box(1.1, 0.025, 0.035).at(0, 0.88, -0.395),
      kit.box(1.1, 0.025, 0.035).at(0, 0.56, -0.395)
    ], 'black_paint')
    .add(
      kit.text('CAFÉ', { size: 0.18, depth: 0.009, align: 'center' })
        .rot(0, 180, 0)
        .at(0, 0.65, -0.412),
      'aged_brass'
    )
    .add(creamB3, 'cart_cream_fabric')
    .add(burgundyB3, 'cart_burgundy_fabric')
    .commit();
}
//@@
kit.object('MACH_cart_espresso_machine')
  .add([
    kit.box(0.57, 0.035, 0.34).at(0, 0.0175, 0),
    kit.box(0.53, 0.32, 0.22).at(0, 0.195, 0.045),
    kit.box(0.58, 0.04, 0.27).at(0, 0.375, 0.03),
    kit.box(0.52, 0.025, 0.12).at(0, 0.065, -0.11),
    ...kit.repeat(2, i =>
      kit.cylinder(0.038, 0.038, 0.06, 16).at(i ? 0.12 : -0.12, 0.23, -0.105)
    ),
    kit.tube([[0.235, 0.27, -0.07], [0.29, 0.22, -0.13], [0.29, 0.12, -0.15]], 0.009, 16),
    ...kit.repeat(9, i =>
      kit.box(0.008, 0.007, 0.09).at(-0.2 + i * 0.05, 0.081, -0.11)
    )
  ], 'polished_steel')
  .add([
    kit.box(0.49, 0.23, 0.025).at(0, 0.22, 0.168),
    ...kit.repeat(2, i =>
      kit.cylinder(0.015, 0.015, 0.12, 12)
        .rot(90, 0, 0)
        .at(i ? 0.12 : -0.12, 0.222, -0.18)
    )
  ], 'black_paint')
  .add([
    kit.cylinder(0.04, 0.04, 0.012, 20).rot(90, 0, 0).at(0, 0.3, -0.073),
    kit.sphere(0.018, 12).at(-0.19, 0.3, -0.081),
    kit.sphere(0.018, 12).at(0.19, 0.3, -0.081)
  ], 'aged_brass')
  .add(
    kit.cylinder(0.032, 0.032, 0.014, 20).rot(90, 0, 0).at(0, 0.3, -0.081),
    'white_ceramic'
  )
  .at(0.32, 1.07, 0.14)
  .commit();
//@@
kit.object('PRP_cart_coffee_service')
  .add([
    kit.box(0.48, 0.022, 0.29).at(-0.48, 1.081, -0.16),
    kit.box(0.48, 0.025, 0.018).at(-0.48, 1.103, -0.305),
    kit.box(0.48, 0.025, 0.018).at(-0.48, 1.103, -0.015)
  ], 'dark_wood')
  .add([
    ...kit.repeat(3, i => {
      const x = -0.63 + i * 0.15;
      return [
        kit.cylinder(0.06, 0.06, 0.012, 20).at(x, 1.098, -0.15),
        kit.lathe([
          [0.029, 0], [0.033, 0.01], [0.043, 0.079],
          [0.038, 0.079], [0.029, 0.014], [0, 0.014]
        ], 20).at(x, 1.104, -0.15),
        kit.torus(0.022, 0.006, 300, 16).at(x + 0.044, 1.15, -0.15)
      ];
    }),
    kit.lathe([
      [0.06, 0], [0.075, 0.025], [0.075, 0.12], [0.06, 0.15]
    ], 20).at(-0.68, 1.07, 0.25),
    kit.cylinder(0.066, 0.07, 0.015, 20).at(-0.68, 1.2275, 0.25),
    kit.sphere(0.018, 12).at(-0.68, 1.245, 0.25)
  ], 'pale_ceramic')
  .add([
    kit.lathe([
      [0.04, 0], [0.05, 0.012], [0.055, 0.105],
      [0.048, 0.105], [0.043, 0.018], [0, 0.018]
    ], 20).at(-0.38, 1.07, 0.24),
    kit.torus(0.034, 0.006, 270, 16).at(-0.32, 1.128, 0.24)
  ], 'polished_steel')
  .commit();
//@@
{
  const lampGroundB3 = 0.012;
  kit.object('PRP_left_iron_street_lamp')
    .add([
      kit.lathe([
        [0.23, 0], [0.23, 0.07], [0.18, 0.1],
        [0.15, 0.22], [0.13, 0.48], [0.095, 0.56],
        [0.065, 0.63], [0.055, 2.93], [0.09, 2.98],
        [0.09, 3.04], [0.06, 3.09], [0.06, 3.18]
      ], 24),
      kit.box(0.37, 0.07, 0.37).at(0, 3.18, 0),
      kit.box(0.47, 0.055, 0.47).at(0, 3.72, 0),
      ...kit.repeat(4, i =>
        kit.tube([
          [i < 2 ? -0.16 : 0.16, 3.215, i % 2 ? 0.16 : -0.16],
          [i < 2 ? -0.205 : 0.205, 3.69, i % 2 ? 0.205 : -0.205]
        ], 0.018, 12)
      ),
      kit.cone(0.36, 0.2, 4).rot(0, 45, 0).at(0, 3.845, 0),
      kit.sphere(0.035, 12).at(0, 3.97, 0),
      kit.cylinder(0.035, 0.045, 0.12, 12).at(0, 3.28, 0),
      ...kit.repeat(4, i =>
        kit.sphere(0.022, 8).at(i < 2 ? -0.13 : 0.13, 0.075, i % 2 ? 0.13 : -0.13)
      )
    ], 'blackened_iron')
    .add([
      ...kit.repeat(4, i =>
        kit.extrude([
          [-0.146, 0], [0.146, 0], [0.19, 0.455], [-0.19, 0.455]
        ], 0.006)
          .rot(5.5, i * 90, 0)
          .at(
            Math.sin(i * Math.PI / 2) * 0.153,
            3.225,
            Math.cos(i * Math.PI / 2) * 0.153
          )
      )
    ], 'glass')
    .add(
      kit.lathe([[0.025, 0], [0.052, 0.04], [0.065, 0.14], [0.04, 0.23], [0, 0.25]], 20)
        .at(0, 3.32, 0),
      'warm_lamp_light'
    )
    .at(-2.8, lampGroundB3, -1)
    .commit();
}
//@@
{
  const lampGroundB3 = 0.012;
  kit.object('PRP_right_iron_street_lamp')
    .add([
      kit.lathe([
        [0.23, 0], [0.23, 0.07], [0.18, 0.1],
        [0.15, 0.22], [0.13, 0.48], [0.095, 0.56],
        [0.065, 0.63], [0.055, 2.93], [0.09, 2.98],
        [0.09, 3.04], [0.06, 3.09], [0.06, 3.18]
      ], 24),
      kit.box(0.37, 0.07, 0.37).at(0, 3.18, 0),
      kit.box(0.47, 0.055, 0.47).at(0, 3.72, 0),
      ...kit.repeat(4, i =>
        kit.tube([
          [i < 2 ? -0.16 : 0.16, 3.215, i % 2 ? 0.16 : -0.16],
          [i < 2 ? -0.205 : 0.205, 3.69, i % 2 ? 0.205 : -0.205]
        ], 0.018, 12)
      ),
      kit.cone(0.36, 0.2, 4).rot(0, 45, 0).at(0, 3.845, 0),
      kit.sphere(0.035, 12).at(0, 3.97, 0),
      kit.cylinder(0.035, 0.045, 0.12, 12).at(0, 3.28, 0),
      ...kit.repeat(4, i =>
        kit.sphere(0.022, 8).at(i < 2 ? -0.13 : 0.13, 0.075, i % 2 ? 0.13 : -0.13)
      )
    ], 'blackened_iron')
    .add([
      ...kit.repeat(4, i =>
        kit.extrude([
          [-0.146, 0], [0.146, 0], [0.19, 0.455], [-0.19, 0.455]
        ], 0.006)
          .rot(5.5, i * 90, 0)
          .at(
            Math.sin(i * Math.PI / 2) * 0.153,
            3.225,
            Math.cos(i * Math.PI / 2) * 0.153
          )
      )
    ], 'glass')
    .add(
      kit.lathe([[0.025, 0], [0.052, 0.04], [0.065, 0.14], [0.04, 0.23], [0, 0.25]], 20)
        .at(0, 3.32, 0),
      'warm_lamp_light'
    )
    .at(2.8, lampGroundB3, 1)
    .commit();
}
//@@
function cafeTableB4(name, z) {
  kit.object(name)
    .add([
      kit.cylinder(0.27, 0.27, 0.045, 32).at(0, 0.7275, 0),
      kit.torus(0.255, 0.012, 360, 32).rot(90, 0, 0).at(0, 0.708, 0)
    ], 'worn_dark_wood')
    .add([
      kit.cylinder(0.033, 0.045, 0.64, 16).at(0, 0.37, 0),
      kit.cylinder(0.09, 0.065, 0.06, 16).at(0, 0.675, 0),
      ...kit.repeat(3, i => {
        const a = i * Math.PI * 2 / 3;
        return kit.tube([
          [0, 0.22, 0],
          [Math.cos(a) * 0.1, 0.09, Math.sin(a) * 0.1],
          [Math.cos(a) * 0.22, 0.025, Math.sin(a) * 0.22]
        ], 0.022, 16);
      })
    ], 'blackened_iron')
    .add([
      kit.cylinder(0.065, 0.065, 0.012, 20).at(-0.08, 0.756, 0.035),
      kit.lathe([
        [0.028, 0], [0.034, 0.012], [0.041, 0.071],
        [0.035, 0.071], [0.028, 0.015], [0, 0.015]
      ], 20).at(-0.08, 0.762, 0.035),
      kit.torus(0.021, 0.005, 300, 16).at(-0.037, 0.804, 0.035)
    ], 'pale_ceramic')
    .at(3.48, 0.1, z)
    .commit();
}
function cafeChairB4(name, z, rotation) {
  kit.object(name)
    .add([
      kit.cylinder(0.19, 0.185, 0.04, 24).at(0, 0.445, 0),
      ...kit.repeat(4, i => {
        const x = i < 2 ? -1 : 1;
        const zSign = i % 2 ? 1 : -1;
        return kit.tube([
          [x * 0.165, 0.018, zSign * 0.165],
          [x * 0.135, 0.24, zSign * 0.135],
          [x * 0.125, 0.425, zSign * 0.125]
        ], 0.018, 16);
      }),
      kit.tube([
        [-0.14, 0.425, 0.13],
        [-0.17, 0.69, 0.15],
        [-0.15, 0.84, 0.16],
        [0, 0.89, 0.16],
        [0.15, 0.84, 0.16],
        [0.17, 0.69, 0.15],
        [0.14, 0.425, 0.13]
      ], 0.022, 32),
      kit.tube([
        [-0.1, 0.47, 0.14],
        [-0.09, 0.7, 0.15],
        [0, 0.77, 0.16],
        [0.09, 0.7, 0.15],
        [0.1, 0.47, 0.14]
      ], 0.014, 24),
      kit.torus(0.14, 0.012, 360, 24).rot(90, 0, 0).at(0, 0.235, 0)
    ], 'worn_dark_wood')
    .at(3.48, 0.1, z, rotation)
    .commit();
}
function doorwayBarrelB4(name, z, rotation) {
  kit.object(name)
    .add([
      kit.lathe([
        [0.235, 0], [0.25, 0.045], [0.282, 0.22],
        [0.295, 0.43], [0.282, 0.65], [0.25, 0.835],
        [0.235, 0.87], [0.215, 0.87], [0.215, 0.825]
      ], 24),
      kit.cylinder(0.218, 0.218, 0.025, 24).at(0, 0.829, 0),
      ...kit.repeat(5, i => {
        const zLocal = (i - 2) * 0.075;
        const width = 2 * Math.sqrt(0.211 * 0.211 - zLocal * zLocal);
        return kit.box(width, 0.008, 0.065).at(0, 0.845, zLocal);
      })
    ], 'weathered_wood')
    .add([
      ...kit.repeat(4, i => {
        const y = [0.075, 0.255, 0.615, 0.795][i];
        const r = [0.259, 0.288, 0.288, 0.259][i];
        return kit.lathe([
          [r, y - 0.022], [r + 0.009, y - 0.022],
          [r + 0.009, y + 0.022], [r, y + 0.022]
        ], 24);
      })
    ], 'blackened_iron')
    .at(-3.53, 0.1, z, rotation)
    .commit();
}
function doorwayCrateB4(name, x, y, z, rotation) {
  kit.object(name)
    .add([
      ...kit.repeat(4, i =>
        kit.box(0.115, 0.035, 0.5).at(-0.1875 + i * 0.125, 0.0175, 0)
      ),
      ...kit.repeat(4, i => {
        const xSide = i < 2 ? -0.225 : 0.225;
        const zSide = i % 2 ? 0.225 : -0.225;
        return kit.box(0.045, 0.44, 0.045).at(xSide, 0.22, zSide);
      }),
      ...kit.repeat(3, i => [
        kit.box(0.5, 0.115, 0.025).at(0, 0.105 + i * 0.14, -0.2375),
        kit.box(0.5, 0.115, 0.025).at(0, 0.105 + i * 0.14, 0.2375),
        kit.box(0.025, 0.115, 0.45).at(-0.2375, 0.105 + i * 0.14, 0),
        kit.box(0.025, 0.115, 0.45).at(0.2375, 0.105 + i * 0.14, 0)
      ]),
      kit.box(0.055, 0.39, 0.022).rot(0, 0, -43).at(0, 0.22, 0.262)
    ], 'weathered_wood')
    .add([
      ...kit.repeat(12, i =>
        kit.sphere(0.007, 6).at(
          i % 2 ? 0.21 : -0.21,
          0.075 + Math.floor(i / 4) * 0.14,
          Math.floor(i / 2) % 2 ? 0.254 : -0.254
        )
      )
    ], 'rusty_iron')
    .at(x, y, z, rotation)
    .commit();
}
function entrancePlantB4(name, x, z, height, phase) {
  const potHeight = 0.32;
  const stems = [];
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = phase + i * 2.399963;
    const reach = 0.11 + 0.055 * Math.sin(i * 1.7 + phase);
    const tipY = potHeight + (height - potHeight) * (0.63 + 0.35 * (0.5 + 0.5 * Math.sin(i * 1.3)));
    const tipX = Math.cos(a) * reach;
    const tipZ = Math.sin(a) * reach;
    stems.push(kit.tube([
      [0, 0.29, 0],
      [tipX * 0.45, 0.35 + (tipY - 0.35) * 0.55, tipZ * 0.45],
      [tipX, tipY, tipZ]
    ], 0.009, 16));
    for (let j = 0; j < 4; j++) {
      const t = 0.42 + j * 0.17;
      const leafAngle = a + (j % 2 ? 1.1 : -1.1);
      leaves.push(
        kit.sphere(1, 10)
          .scale([0.035, 0.09, 0.025])
          .rot(25, leafAngle * 180 / Math.PI, j % 2 ? 38 : -38)
          .at(
            tipX * t + Math.cos(leafAngle) * 0.035,
            0.3 + (tipY - 0.3) * t,
            tipZ * t + Math.sin(leafAngle) * 0.035
          )
      );
    }
  }
  kit.object(name)
    .add([
      kit.lathe([
        [0.125, 0.025], [0.14, 0.045], [0.185, 0.29],
        [0.198, 0.295], [0.198, 0.325], [0.17, 0.325],
        [0.16, 0.285], [0.115, 0.05], [0, 0.05]
      ], 24),
      kit.cylinder(0.17, 0.17, 0.025, 24).at(0, 0.0125, 0)
    ], 'aged_ceramic')
    .add(kit.cylinder(0.162, 0.162, 0.018, 20).at(0, 0.285, 0), 'wet_dirt')
    .add(stems, 'dark_bark')
    .add(leaves, 'wet_foliage')
    .at(x, 0.1, z)
    .commit();
}
cafeTableB4('PRP_cafe_round_table_south', 2.6);
//@@
cafeTableB4('PRP_cafe_round_table_north', 7.4);
//@@
cafeChairB4('PRP_cafe_chair_south_outer', 2.04, 180);
//@@
cafeChairB4('PRP_cafe_chair_south_inner', 3.16, 0);
//@@
cafeChairB4('PRP_cafe_chair_north_inner', 6.84, 180);
//@@
cafeChairB4('PRP_cafe_chair_north_outer', 7.96, 0);
//@@
doorwayBarrelB4('PRP_left_doorway_barrel_01', -6.2, 12);
//@@
doorwayBarrelB4('PRP_left_doorway_barrel_02', -5.55, -8);
//@@
doorwayBarrelB4('PRP_left_doorway_barrel_03', -4.9, 24);
//@@
doorwayCrateB4('PRP_left_doorway_crate_01', -3.52, 0.1, -2.05, 0);
//@@
doorwayCrateB4('PRP_left_doorway_crate_02', -3.52, 0.54, -2.05, 4);
//@@
doorwayCrateB4('PRP_left_doorway_crate_03', -3.52, 0.1, -1.45, 0);
//@@
doorwayCrateB4('PRP_left_doorway_crate_04', -3.52, 0.1, -0.85, -5);
//@@
entrancePlantB4('PRP_cafe_potted_plant_south', 3.52, 3.95, 0.86, 0.3);
//@@
entrancePlantB4('PRP_cafe_potted_plant_north', 3.52, 6.05, 1.12, 1.6);
//@@
entrancePlantB4('PRP_left_entrance_plant_foreground', -3.53, -16.2, 0.92, 2.1);
//@@
entrancePlantB4('PRP_right_entrance_plant_foreground', 3.53, -11.8, 0.72, 0.8);
//@@
entrancePlantB4('PRP_left_entrance_plant_midstreet', -3.53, 2.2, 1.2, 3.4);
//@@
entrancePlantB4('PRP_right_entrance_plant_midstreet', 3.53, -4.85, 0.96, 4.2);
//@@
entrancePlantB4('PRP_left_entrance_plant_distance', -3.53, 11.8, 1.05, 1.2);
//@@
entrancePlantB4('PRP_right_entrance_plant_distance', 3.53, 16.2, 0.83, 5.1);
//@@
kit.describe({
  title: 'Midnight Coffee Lane',
  setting: 'An eight-metre-wide, forty-two-metre-long cobbled lane in an old European city',
  style: 'Realistic architectural grey-box with intimate street-level compositions',
  era: 'Present day within nineteenth-century buildings',
  lighting: 'Cool blue night sky, warm iron street lamps, suspended tungsten bulbs and softly glowing windows',
  palette: 'Wet charcoal cobbles, muted plaster, black iron, cream and burgundy canvas',
  mood: 'Quiet, sheltered, rain-soaked midnight coffee',
  atmosphere: 'Light fine rain drifting slightly across the lane, visible mainly against practical lights. Thin blue-grey ground mist, barely present around the cart and gradually thickening beyond z = 10 toward the far end at z = 21. Preserve readable building silhouettes and the clear street axis. Restrained warm reflections on wet cobbles and existing shallow puddles; no heavy fog or standing floodwater.'
});
kit.define('night_sky_paint', {
  base: 'paint',
  color: '#101c35',
  roughness: 1,
  emissive: '#101c35',
  emissiveIntensity: 0.45
});
kit.glow('warm_lamp_light', '#ffd29a', 2.2);
kit.define('festoon_lamp_light', {
  base: 'lamp_light',
  color: '#ffe0af',
  emissive: '#ffcd88',
  emissiveIntensity: 3
});
function festoonStringB5(name, z, anchorHeight) {
  const cablePoints = [];
  const sockets = [];
  const bulbs = [];
  for (let i = 0; i <= 24; i++) {
    const x = -3.94 + 7.88 * i / 24;
    const y = anchorHeight - 0.75 * (1 - Math.pow(x / 3.94, 2));
    cablePoints.push([x, y, z]);
  }
  for (let i = 0; i < 11; i++) {
    const x = -3.5 + i * 0.7;
    const y = anchorHeight - 0.75 * (1 - Math.pow(x / 3.94, 2));
    sockets.push(
      kit.cylinder(0.009, 0.009, 0.1, 8).at(x, y - 0.05, z),
      kit.cylinder(0.025, 0.022, 0.045, 12).at(x, y - 0.1175, z)
    );
    bulbs.push(
      kit.sphere(0.043, 12).scale([1, 1.24, 1]).at(x, y - 0.184, z)
    );
  }
  kit.object(name)
    .add([
      kit.tube(cablePoints, 0.012, 48),
      ...sockets,
      kit.box(0.055, 0.2, 0.15).at(-3.96, anchorHeight, z),
      kit.box(0.055, 0.2, 0.15).at(3.96, anchorHeight, z)
    ], 'blackened_iron')
    .add(bulbs, 'festoon_lamp_light')
    .commit();
}
//@@
kit.object('ENV_blue_night_sky_backdrop')
  .add([
    kit.plane(160, 100).rot(0, 180, 0).at(0, 39, 70),
    kit.plane(160, 100).at(0, 39, -70),
    kit.plane(140, 100).rot(0, 90, 0).at(-80, 39, 0),
    kit.plane(140, 100).rot(0, -90, 0).at(80, 39, 0),
    kit.plane(160, 140).rot(90, 0, 0).at(0, 89, 0)
  ], 'night_sky_paint')
  .commit();
//@@
festoonStringB5('PRP_festoon_string_south', -14, 5.7);
//@@
festoonStringB5('PRP_festoon_string_approach', -7, 5.65);
//@@
festoonStringB5('PRP_festoon_string_over_cart', 0, 5.7);
//@@
festoonStringB5('PRP_festoon_string_cafe', 7, 5.8);
//@@
festoonStringB5('PRP_festoon_string_distance', 14, 5.7);
//@@
kit.light('LGT_left_street_lamp_practical', {
  type: 'point',
  pos: [-2.8, 3.452, -1],
  color: '#ffd29a',
  intensity: 32,
  distance: 10
});
//@@
kit.light('LGT_right_street_lamp_practical', {
  type: 'point',
  pos: [2.8, 3.452, 1],
  color: '#ffcb8b',
  intensity: 27,
  distance: 10
});
//@@
kit.light('LGT_cafe_south_lantern_practical', {
  type: 'point',
  pos: [3.51, 2.02, 3.43],
  color: '#ffd09a',
  intensity: 7,
  distance: 4
});
//@@
kit.light('LGT_cafe_north_lantern_practical', {
  type: 'point',
  pos: [3.51, 2.02, 6.57],
  color: '#ffd09a',
  intensity: 7,
  distance: 4
});
//@@
kit.light('LGT_cart_motivated_left_key', {
  type: 'spot',
  pos: [-2.76, 3.44, -1.04],
  target: [0.15, 0.9, -0.1],
  color: '#ffd6a5',
  intensity: 22,
  distance: 8,
  angleDeg: 48
});
//@@
kit.light('LGT_cart_motivated_right_rim', {
  type: 'spot',
  pos: [2.76, 3.44, 1.04],
  target: [-0.25, 1.3, 0],
  color: '#ffca8b',
  intensity: 17,
  distance: 8,
  angleDeg: 43
});
//@@
kit.light('LGT_blue_night_directional', {
  type: 'directional',
  pos: [-9, 24, 13],
  target: [0, 0, -2],
  color: '#8aaee5',
  intensity: 0.65
});
//@@
kit.light('LGT_open_sky_soft_fill', {
  type: 'area',
  pos: [0, 14, 0],
  target: [0, 0, 0],
  color: '#8ba9d5',
  intensity: 2.2,
  width: 7,
  height: 30
});
//@@
kit.light('LGT_festoon_south_pool', {
  type: 'area',
  pos: [0, 4.72, -14],
  target: [0, 0, -14],
  color: '#ffdaa4',
  intensity: 2.5,
  width: 6.8,
  height: 0.3
});
//@@
kit.light('LGT_festoon_approach_pool', {
  type: 'area',
  pos: [0, 4.67, -7],
  target: [0, 0, -7],
  color: '#ffdaa4',
  intensity: 2.8,
  width: 6.8,
  height: 0.3
});
//@@
kit.light('LGT_festoon_cart_pool', {
  type: 'area',
  pos: [0, 4.72, 0],
  target: [0, 0, 0],
  color: '#ffdaa4',
  intensity: 3,
  width: 6.8,
  height: 0.3
});
//@@
kit.light('LGT_festoon_cafe_pool', {
  type: 'area',
  pos: [0, 4.82, 7],
  target: [0, 0, 7],
  color: '#ffdaa4',
  intensity: 2.8,
  width: 6.8,
  height: 0.3
});
//@@
kit.light('LGT_festoon_distance_pool', {
  type: 'area',
  pos: [0, 4.72, 14],
  target: [0, 0, 14],
  color: '#ffdaa4',
  intensity: 2.5,
  width: 6.8,
  height: 0.3
});
//@@
kit.light('LGT_cafe_sign_warm_spill', {
  type: 'area',
  pos: [3.7, 2.8, 5],
  target: [1.9, 1.5, 5],
  color: '#ffd6a5',
  intensity: 2,
  width: 3,
  height: 0.35
});
//@@
kit.light('LGT_left_window_south', {
  type: 'area',
  pos: [-3.78, 4.55, -19.05],
  target: [-0.8, 1.2, -18.2],
  color: '#ffd2a0',
  intensity: 3,
  width: 1.05,
  height: 1.45
});
//@@
kit.light('LGT_left_window_middle', {
  type: 'area',
  pos: [-3.78, 4.55, -5.05],
  target: [-0.8, 1.2, -4.2],
  color: '#ffd2a0',
  intensity: 3.5,
  width: 1.05,
  height: 1.45
});
//@@
kit.light('LGT_left_window_north', {
  type: 'area',
  pos: [-3.78, 4.55, 8.95],
  target: [-0.8, 1.2, 9.8],
  color: '#ffd2a0',
  intensity: 3,
  width: 1.05,
  height: 1.45
});
//@@
kit.light('LGT_right_window_south', {
  type: 'area',
  pos: [3.78, 7.35, -19.05],
  target: [0.8, 2, -18.2],
  color: '#ffce95',
  intensity: 3,
  width: 1.05,
  height: 1.45
});
//@@
kit.light('LGT_right_window_middle', {
  type: 'area',
  pos: [3.78, 7.35, -5.05],
  target: [0.8, 2, -4.2],
  color: '#ffce95',
  intensity: 3.5,
  width: 1.05,
  height: 1.45
});
//@@
kit.light('LGT_right_window_north', {
  type: 'area',
  pos: [3.78, 7.35, 8.95],
  target: [0.8, 2, 9.8],
  color: '#ffce95',
  intensity: 3,
  width: 1.05,
  height: 1.45
});
//@@
kit.camera('CAM_main', {
  pos: [0, 2, -18],
  lookAt: [0, 3.3, 1.5],
  fov: 48
});
//@@
kit.camera('CAM_cart_medium', {
  pos: [-3, 1.5, -5],
  lookAt: [0, 1.25, 0],
  fov: 40
});
//@@
kit.camera('CAM_wet_cobbles_close', {
  pos: [1, 0.2, -3],
  lookAt: [0, 0.95, 0],
  fov: 55
});
//@@
kit.define('weathered_pale_cream_plaster', { base: 'plaster', color: '#c4b49a', roughness: 0.9 });
kit.define('weathered_ochre_plaster', { base: 'plaster', color: '#ad9473', roughness: 0.9 });
kit.define('aged_stone_grey_plaster', { base: 'plaster', color: '#a99e8d', roughness: 0.9 });
kit.define('wet_dark_cobblestone', { base: 'cobblestone', color: '#343638', roughness: 0.22 });
kit.define('wet_stone_floor', { base: 'stone_floor', color: '#55514c', roughness: 0.25 });
kit.define('worn_stone_block', { base: 'stone_block', color: '#77716a', roughness: 0.65 });
streetBuildingB1('ENV_left_building_01', -1, 0, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_left_building_02', -1, 1, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_03', -1, 2, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_left_building_04', -1, 3, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_left_building_05', -1, 4, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_06', -1, 5, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_01', 1, 0, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_02', 1, 1, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_03', 1, 2, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_right_building_04_cafe', 1, 3, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_05', 1, 4, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_06', 1, 5, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_07', -1, 6, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_left_building_08', -1, 7, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_left_building_09', -1, 8, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_left_building_10', -1, 9, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_07', 1, 6, 'weathered_pale_cream_plaster');
//@@
streetBuildingB1('ENV_right_building_08', 1, 7, 'weathered_ochre_plaster');
//@@
streetBuildingB1('ENV_right_building_09', 1, 8, 'aged_stone_grey_plaster');
//@@
streetBuildingB1('ENV_right_building_10', 1, 9, 'weathered_pale_cream_plaster');
//@@
streetFacadeB2('ENV_left_facade_07', -1, 6);
//@@
streetFacadeB2('ENV_left_facade_08', -1, 7);
//@@
streetFacadeB2('ENV_left_facade_09', -1, 8);
//@@
streetFacadeB2('ENV_left_facade_10', -1, 9);
//@@
streetFacadeB2('ENV_right_facade_07', 1, 6);
//@@
streetFacadeB2('ENV_right_facade_08', 1, 7);
//@@
streetFacadeB2('ENV_right_facade_09', 1, 8);
//@@
streetFacadeB2('ENV_right_facade_10', 1, 9);
//@@
{
  const extendedStonesC1 = [];
  for (let rowC1 = 0; rowC1 < 94; rowC1++) {
    const staggerC1 = rowC1 % 2 ? 0.16 : 0;
    for (let colC1 = -1; colC1 < 20; colC1++) {
      const leftC1 = Math.max(-3.2, -3.2 + colC1 * 0.32 + staggerC1);
      const rightC1 = Math.min(3.2, -3.2 + (colC1 + 1) * 0.32 + staggerC1);
      if (rightC1 - leftC1 < 0.025) continue;
      const xC1 = (leftC1 + rightC1) / 2;
      const widthC1 = rightC1 - leftC1 - 0.012;
      const depthC1 = 0.286 - 0.004 * Math.sin(rowC1 * 2.3 + colC1 * 1.7);
      const bevelC1 = 0.025 + 0.006 * Math.sin(colC1 * 3.1 + rowC1);
      const topC1 = 0.036 * (1 - Math.pow(Math.abs(xC1) / 3.2, 1.6)) + 0.002 * Math.sin(rowC1 * 1.9 + colC1 * 2.7);
      extendedStonesC1.push(
        kit.extrude([
          [-widthC1 / 2 + bevelC1, -depthC1 / 2],
          [widthC1 / 2 - bevelC1 * 0.8, -depthC1 / 2],
          [widthC1 / 2, -depthC1 / 2 + bevelC1],
          [widthC1 / 2, depthC1 / 2 - bevelC1 * 1.2],
          [widthC1 / 2 - bevelC1, depthC1 / 2],
          [-widthC1 / 2 + bevelC1 * 0.8, depthC1 / 2],
          [-widthC1 / 2, depthC1 / 2 - bevelC1],
          [-widthC1 / 2, -depthC1 / 2 + bevelC1]
        ], 0.075).rot(-90, 0, 0).at(xC1, topC1 - 0.075, 21 + (rowC1 + 0.5) * 0.3)
      );
    }
  }
  kit.object('ENV_extended_crowned_cobblestones')
    .add(extendedStonesC1, 'wet_dark_cobblestone')
    .commit();
}
//@@
kit.define('wet_dark_stone_block', { base: 'stone_block', color: '#484744', roughness: 0.25 });
kit.object('ENV_narrow_stone_pavements')
  .add([
    ...kit.repeat(84, i => kit.box(0.77, 0.16, 0.488).at(-3.6, 0.02, -20.75 + i * 0.5)),
    ...kit.repeat(84, i => kit.box(0.77, 0.16, 0.488).at(3.6, 0.02, -20.75 + i * 0.5))
  ], 'wet_stone_floor')
  .add([
    ...kit.repeat(42, i => kit.box(0.14, 0.18, 0.982).at(-3.15, 0.01, -20.5 + i)),
    ...kit.repeat(42, i => kit.box(0.14, 0.18, 0.982).at(3.15, 0.01, -20.5 + i))
  ], 'wet_dark_stone_block')
  .commit();
//@@
kit.object('ENV_extended_stone_pavements')
  .add([
    ...kit.repeat(56, i => kit.box(0.77, 0.16, 0.488).at(-3.6, 0.02, 21.25 + i * 0.5)),
    ...kit.repeat(56, i => kit.box(0.77, 0.16, 0.488).at(3.6, 0.02, 21.25 + i * 0.5))
  ], 'wet_stone_floor')
  .add([
    ...kit.repeat(28, i => kit.box(0.14, 0.18, 0.982).at(-3.15, 0.01, 21.5 + i)),
    ...kit.repeat(28, i => kit.box(0.14, 0.18, 0.982).at(3.15, 0.01, 21.5 + i))
  ], 'wet_dark_stone_block')
  .commit();
//@@
kit.object('ENV_far_end_building_front')
  .add([
    kit.box(14.6, 12, 0.3).at(0, 6, 49.15),
    kit.extrude([[-7.3, 0], [7.3, 0], [0, 1.6]], 0.25).at(0, 12, 49)
  ], 'aged_stone_grey_plaster')
  .add([
    kit.box(14.6, 0.45, 0.5).at(0, 0.225, 48.91),
    kit.box(14.6, 0.2, 0.4).at(0, 3.05, 48.91),
    kit.box(14.6, 0.2, 0.4).at(0, 11.55, 48.91),
    ...kit.repeat(8, i => {
      const xC2 = -5.4 + (i % 4) * 3.6;
      const yC2 = i < 4 ? 4.7 : 8.05;
      return [
        kit.box(1.4, 0.14, 0.3).at(xC2, yC2 - 0.84, 48.9),
        kit.box(1.4, 0.14, 0.25).at(xC2, yC2 + 0.84, 48.9),
        kit.box(0.12, 1.56, 0.2).at(xC2 - 0.64, yC2, 48.9),
        kit.box(0.12, 1.56, 0.2).at(xC2 + 0.64, yC2, 48.9)
      ];
    })
  ], 'worn_stone_block')
  .add([
    ...kit.repeat(8, i => {
      const xC2 = -5.4 + (i % 4) * 3.6;
      const yC2 = i < 4 ? 4.7 : 8.05;
      return [
        kit.box(0.95, 1.42, 0.06).at(xC2, yC2, 48.94),
        kit.box(0.38, 1.45, 0.08).at(xC2 - 0.94, yC2, 48.86),
        kit.box(0.38, 1.45, 0.08).at(xC2 + 0.94, yC2, 48.86)
      ];
    }),
    kit.box(1.5, 2.15, 0.1).at(0, 1.18, 48.9)
  ], 'weathered_dark_wood')
  .add([
    kit.box(0.82, 1.3, 0.025).at(-1.8, 4.7, 48.86),
    kit.box(0.82, 1.3, 0.025).at(5.4, 8.05, 48.86)
  ], 'dark_glass')
  .add([
    kit.box(14.8, 0.18, 1.4).at(0, 12.05, 49.05),
    kit.box(0.65, 1.1, 0.65).at(-4.8, 12.55, 49.05),
    kit.box(0.65, 1.1, 0.65).at(4.8, 12.55, 49.05)
  ], 'aged_roof_tiles')
  .commit();
//@@
kit.object('ENV_cart_additional_shallow_puddles')
  .add([
    kit.puddle(0.72, 1.05, 103).at(-1.63, 0.035, -1.75),
    kit.puddle(0.58, 0.9, 127).at(1.55, 0.036, -1.45),
    kit.puddle(0.66, 1.15, 149).at(-1.72, 0.035, 1.46),
    kit.puddle(0.48, 0.8, 173).at(1.45, 0.036, 2.35)
  ], 'water')
  .commit();
//@@
kit.light('LGT_cafe_south_lantern_practical', {
  type: 'point', pos: [3.51, 2.02, 3.43], color: '#ffd09a', intensity: 2.33, distance: 4
});
//@@
kit.light('LGT_cafe_north_lantern_practical', {
  type: 'point', pos: [3.51, 2.02, 6.57], color: '#ffd09a', intensity: 2.33, distance: 4
});
//@@
kit.light('LGT_left_window_south', {
  type: 'area', pos: [-3.78, 4.55, -19.05], target: [-0.8, 1.2, -18.2],
  color: '#ffd2a0', intensity: 1, width: 1.05, height: 1.45
});
//@@
kit.light('LGT_left_window_middle', {
  type: 'area', pos: [-3.78, 4.55, -5.05], target: [-0.8, 1.2, -4.2],
  color: '#ffd2a0', intensity: 1.17, width: 1.05, height: 1.45
});
//@@
kit.light('LGT_left_window_north', {
  type: 'area', pos: [-3.78, 4.55, 8.95], target: [-0.8, 1.2, 9.8],
  color: '#ffd2a0', intensity: 1, width: 1.05, height: 1.45
});
//@@
kit.light('LGT_right_window_south', {
  type: 'area', pos: [3.78, 7.35, -19.05], target: [0.8, 2, -18.2],
  color: '#ffce95', intensity: 1, width: 1.05, height: 1.45
});
//@@
kit.light('LGT_right_window_middle', {
  type: 'area', pos: [3.78, 7.35, -5.05], target: [0.8, 2, -4.2],
  color: '#ffce95', intensity: 1.17, width: 1.05, height: 1.45
});
//@@
kit.light('LGT_right_window_north', {
  type: 'area', pos: [3.78, 7.35, 8.95], target: [0.8, 2, 9.8],
  color: '#ffce95', intensity: 1, width: 1.05, height: 1.45
});
//@@

//@@
kit.settings({ exposure: 0.90, lights: 0.60, background: 'auto' });
kit.actor('CHAR_barista_idle', {
  pos: [0, 0.035, 0.95],
  rotY: 180,
  height: 1.75,
  action: 'idle'
});
//@@
kit.actor('CHAR_cafe_couple_south_talking', {
  pos: [3.48, 0.1, 2.04],
  rotY: 180,
  height: 1.72,
  action: 'sit_talk'
});
//@@
kit.actor('CHAR_cafe_couple_north_talking', {
  pos: [3.48, 0.1, 3.16],
  rotY: 0,
  height: 1.78,
  action: 'sit_talk'
});
//@@
kit.actor('CHAR_passerby_walking_north', {
  pos: [-0.7, 0.035, -5],
  height: 1.76,
  action: 'walk',
  path: [[-0.7, -5], [-0.7, -1.5]],
  speed: 1.1
});
//@@
kit.actor('CHAR_passerby_walking_south', {
  pos: [0.15, 0.035, -1.5],
  height: 1.7,
  action: 'walk',
  path: [[0.15, -1.5], [0.15, -5]],
  speed: 1.1
});
//@@
kit.actor('CHAR_passerby_walking_north', {
  pos: [-1.4, 0.035, 5.4],
  height: 1.76,
  action: 'walk',
  path: [[-1.4, 5.4], [2.1, 3.3]],
  speed: 0.65,
  offset: 0
});
//@@
kit.actor('CHAR_passerby_walking_south', {
  pos: [2.1, 0.035, 4.25],
  height: 1.7,
  action: 'walk',
  path: [[2.1, 4.25], [-1.4, 6.35]],
  speed: 0.65,
  offset: 0.6
});
//@@
