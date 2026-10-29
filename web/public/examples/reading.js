
//@@
kit.describe({ title: 'Golden Hour Reading Room', setting: 'enclosed old townhouse reading room', style: 'naturalistic', era: 'traditional townhouse', lighting: 'warm low golden-hour sunlight', palette: 'warm oak, muted cream, white trim, rust fabric', mood: 'quiet and cozy' });
//@@
kit.object('ENV_oak_plank_floor').add(kit.repeat(20, i => kit.box(0.298, 0.1, 5).at(-2.85 + i * 0.3, -0.05, 0)), 'warm_wood_planks').commit();
//@@
kit.object('ENV_north_wall').add([kit.box(3.05, 3.2, 0.16).at(-1.475, 1.6, 2.5), kit.box(1.45, 3.2, 0.16).at(2.275, 1.6, 2.5), kit.box(1.5, 0.75, 0.16).at(0.8, 0.375, 2.5), kit.box(1.5, 0.4, 0.16).at(0.8, 3, 2.5)], 'plaster').commit();
//@@
kit.object('ENV_south_wall').add([kit.box(4.65, 3.2, 0.16).at(-0.675, 1.6, -2.5), kit.box(0.45, 3.2, 0.16).at(2.775, 1.6, -2.5), kit.box(0.9, 1.1, 0.16).at(2.1, 2.65, -2.5)], 'plaster').commit();
//@@
kit.object('ENV_west_wall').add(kit.box(0.16, 3.2, 5).at(-3, 1.6, 0), 'plaster').commit();
//@@
kit.object('ENV_east_wall').add(kit.box(0.16, 3.2, 5).at(3, 1.6, 0), 'plaster').commit();
//@@
kit.object('ENV_ceiling').add(kit.box(6, 0.12, 5).at(0, 3.26, 0), 'white_plaster').commit();
//@@
kit.object('ENV_baseboards').add([kit.box(5.84, 0.16, 0.035).at(0, 0.08, 2.395), kit.box(4.57, 0.16, 0.035).at(-0.715, 0.08, -2.395), kit.box(0.37, 0.16, 0.035).at(2.735, 0.08, -2.395), kit.box(0.035, 0.16, 4.78).at(-2.895, 0.08, 0), kit.box(0.035, 0.16, 4.78).at(2.895, 0.08, 0)], 'white_paint').commit();
//@@
kit.object('ENV_ceiling_cornice').add([kit.box(5.85, 0.12, 0.12).at(0, 3.12, 2.36), kit.box(5.85, 0.12, 0.12).at(0, 3.12, -2.36), kit.box(0.12, 0.12, 4.6).at(-2.86, 3.12, 0), kit.box(0.12, 0.12, 4.6).at(2.86, 3.12, 0)], 'white_paint').commit();
//@@
kit.object('ENV_closed_door').add([kit.box(0.86, 2.08, 0.06).at(2.1, 1.04, -2.5), kit.box(0.93, 0.09, 0.045).at(2.1, 2.145, -2.39), kit.box(0.07, 2.17, 0.045).at(1.615, 1.085, -2.39), kit.box(0.07, 2.17, 0.045).at(2.585, 1.085, -2.39), kit.box(0.68, 0.72, 0.025).at(2.1, 1.49, -2.455), kit.box(0.68, 0.72, 0.025).at(2.1, 0.55, -2.455)], 'white_paint').add(kit.sphere(0.035, 16).at(1.8, 1.02, -2.4), 'aged_brass').commit();
//@@
kit.object('ENV_tall_window').add([kit.box(0.08, 2.05, 0.1).at(0.09, 1.775, 2.47), kit.box(0.08, 2.05, 0.1).at(1.51, 1.775, 2.47), kit.box(1.5, 0.08, 0.1).at(0.8, 2.76, 2.47), kit.box(1.5, 0.08, 0.1).at(0.8, 0.79, 2.47), kit.box(0.045, 1.9, 0.08).at(0.8, 1.775, 2.45), kit.box(1.36, 0.045, 0.08).at(0.8, 1.75, 2.45), kit.box(1.68, 0.07, 0.3).at(0.8, 0.735, 2.36), kit.box(0.08, 2.18, 0.045).at(-0.015, 1.775, 2.39), kit.box(0.08, 2.18, 0.045).at(1.615, 1.775, 2.39), kit.box(1.71, 0.08, 0.045).at(0.8, 2.825, 2.39)], 'white_paint').add(kit.box(1.36, 1.9, 0.015).at(0.8, 1.775, 2.51), 'glass').commit();
//@@
kit.define('rust_fabric', { base: 'fabric', color: '#a35438', roughness: 0.95 });
kit.object('PRP_deep_sofa').add([
  kit.box(1.02, 0.32, 2.28).at(-2.1, 0.27, 0),
  kit.box(0.24, 0.78, 2.28).at(-2.52, 0.62, 0),
  kit.box(1.02, 0.55, 0.22).at(-2.1, 0.43, -1.03),
  kit.box(1.02, 0.55, 0.22).at(-2.1, 0.43, 1.03),
  kit.box(0.75, 0.14, 0.9).at(-1.99, 0.5, -0.48),
  kit.box(0.75, 0.14, 0.9).at(-1.99, 0.5, 0.48)
], 'rust_fabric').add(kit.repeat(4, i => kit.box(0.1, 0.11, 0.1).at(i < 2 ? -2.48 : -1.72, 0.055, i % 2 ? 0.88 : -0.88)), 'dark_wood').commit();
//@@
kit.object('PRP_sofa_cushions').add([
  kit.box(0.18, 0.4, 0.38).at(-2.34, 0.8, -0.73).rot(8, 0, -10),
  kit.box(0.18, 0.36, 0.34).at(-2.34, 0.79, -0.34).rot(-6, 0, -10),
  kit.box(0.18, 0.4, 0.38).at(-2.34, 0.8, 0.38).rot(5, 0, -10),
  kit.box(0.18, 0.36, 0.34).at(-2.34, 0.79, 0.76).rot(-7, 0, -10)
], 'worn_fabric').commit();
//@@
kit.object('PRP_folded_throw').add([
  kit.box(0.62, 0.045, 0.42).at(-2.03, 0.735, 1.01),
  kit.box(0.58, 0.045, 0.37).at(-2.02, 0.78, 1.01),
  kit.box(0.12, 0.25, 0.42).at(-1.77, 0.61, 1.01)
], 'pale_fabric').commit();
//@@
kit.actor('CHAR_woman_reading', { pos: [-2.02, 0, 0], rotY: 90, height: 1.7, action: 'sit' });
//@@
kit.object('PRP_open_reading_book').add([
  kit.box(0.16, 0.016, 0.23).at(-1.59, 0.99, -0.085).rot(-12, 0, -8),
  kit.box(0.16, 0.016, 0.23).at(-1.59, 0.99, 0.085).rot(12, 0, -8)
], 'yellowed_paper').add(kit.box(0.17, 0.012, 0.35).at(-1.59, 0.975, 0).rot(0, 0, -8), 'dark_leather').commit();
//@@
kit.object('PRP_patterned_wool_rug').add(kit.box(2.4, 0.018, 1.7).at(-0.65, 0.009, 0), 'worn_fabric').add([
  kit.box(2.18, 0.004, 0.035).at(-0.65, 0.02, -0.72),
  kit.box(2.18, 0.004, 0.035).at(-0.65, 0.02, 0.72),
  kit.box(0.035, 0.004, 1.44).at(-1.72, 0.02, 0),
  kit.box(0.035, 0.004, 1.44).at(0.42, 0.02, 0),
  ...kit.repeat(5, i => kit.box(0.19, 0.004, 0.19).at(-1.45 + i * 0.4, 0.02, 0).rot(0, 45, 0))
], 'dark_fabric').commit();
//@@
kit.object('PRP_coffee_table').add([
  kit.box(1.05, 0.06, 0.62).at(-0.6, 0.46, 0),
  ...kit.repeat(4, i => kit.box(0.065, 0.43, 0.065).at(-0.6 + (i < 2 ? -0.44 : 0.44), 0.215, i % 2 ? 0.24 : -0.24)),
  kit.box(0.88, 0.045, 0.04).at(-0.6, 0.32, -0.25),
  kit.box(0.88, 0.045, 0.04).at(-0.6, 0.32, 0.25)
], 'aged_wood').commit();
//@@
kit.object('PRP_coffee_table_books').add([
  kit.box(0.3, 0.045, 0.22).at(-0.82, 0.5125, 0.03).rot(0, 8, 0),
  kit.box(0.26, 0.035, 0.19).at(-0.81, 0.5525, 0.03).rot(0, -5, 0),
  kit.box(0.25, 0.035, 0.18).at(-0.43, 0.5075, -0.12).rot(0, -12, 0)
], 'worn_leather').add([
  kit.box(0.285, 0.024, 0.205).at(-0.82, 0.5125, 0.03).rot(0, 8, 0),
  kit.box(0.245, 0.019, 0.175).at(-0.81, 0.5525, 0.03).rot(0, -5, 0),
  kit.box(0.235, 0.019, 0.165).at(-0.43, 0.5075, -0.12).rot(0, -12, 0)
], 'yellowed_paper').commit();
//@@
kit.object('PRP_ceramic_cup').add([
  kit.lathe([[0, 0], [0.035, 0], [0.045, 0.012], [0.048, 0.085], [0.042, 0.09], [0.038, 0.08], [0.035, 0.015], [0, 0.015]], 24).at(-0.34, 0.49, 0.17),
  kit.torus(0.028, 0.008, 360, 20).at(-0.286, 0.54, 0.17)
], 'white_ceramic').commit();
//@@
kit.object('PRP_tall_wooden_bookshelf').add([
  kit.box(0.34, 2.25, 1.72).at(2.76, 1.125, 0.05),
  kit.box(0.46, 2.25, 0.055).at(2.68, 1.125, -0.78),
  kit.box(0.46, 2.25, 0.055).at(2.68, 1.125, 0.88),
  kit.box(0.46, 0.07, 1.72).at(2.68, 2.25, 0.05),
  ...kit.repeat(6, i => kit.box(0.46, 0.045, 1.62).at(2.68, 0.14 + i * 0.4, 0.05))
], 'aged_wood').commit();
//@@
kit.object('PRP_bookshelf_books').add(kit.repeat(80, i => {
  const row = Math.floor(i / 16);
  const column = i % 16;
  const height = 0.22 + (column % 4) * 0.025;
  return kit.box(0.25, height, 0.085).at(2.63, 0.1625 + row * 0.4 + height / 2, -0.66 + column * 0.094);
}), 'worn_leather').add(kit.repeat(80, i => {
  const row = Math.floor(i / 16);
  const column = i % 16;
  const height = 0.22 + (column % 4) * 0.025;
  return kit.box(0.235, height - 0.018, 0.068).at(2.625, 0.1625 + row * 0.4 + height / 2, -0.66 + column * 0.094);
}), 'yellowed_paper').commit();
//@@
kit.object('PRP_low_tv_cabinet').add([
  kit.box(1.35, 0.07, 0.46).at(-0.9, 0.61, -2.1),
  kit.box(1.27, 0.43, 0.4).at(-0.9, 0.36, -2.12),
  ...kit.repeat(4, i => kit.box(0.08, 0.13, 0.08).at(-0.9 + (i < 2 ? -0.53 : 0.53), 0.065, i % 2 ? -1.96 : -2.27)),
  kit.box(0.57, 0.29, 0.025).at(-1.205, 0.36, -1.905),
  kit.box(0.57, 0.29, 0.025).at(-0.595, 0.36, -1.905)
], 'dark_wood').add([
  kit.sphere(0.025, 12).at(-0.98, 0.36, -1.88),
  kit.sphere(0.025, 12).at(-0.82, 0.36, -1.88)
], 'aged_brass').commit();
//@@
kit.object('PRP_vintage_television').add([
  kit.box(0.76, 0.53, 0.34).at(-0.9, 0.91, -2.1),
  kit.box(0.11, 0.07, 0.2).at(-1.17, 0.665, -2.1),
  kit.box(0.11, 0.07, 0.2).at(-0.63, 0.665, -2.1)
], 'dark_wood').add(
  kit.box(0.49, 0.36, 0.025).at(-0.99, 0.92, -1.92), 'dark_glass'
).add([
  kit.cylinder(0.025, 0.025, 0.025, 16).at(-0.61, 1.02, -1.91).rot(90, 0, 0),
  kit.cylinder(0.025, 0.025, 0.025, 16).at(-0.61, 0.88, -1.91).rot(90, 0, 0)
], 'aged_brass').commit();
//@@
kit.object('PRP_reading_floor_lamp').add([
  kit.cylinder(0.2, 0.23, 0.05, 24).at(-2.52, 0.025, 1.53),
  kit.cylinder(0.025, 0.025, 1.38, 16).at(-2.52, 0.74, 1.53)
], 'aged_brass').add(
  kit.cylinder(0.12, 0.25, 0.28, 24).at(-2.52, 1.5, 1.53), 'pale_fabric'
).add(
  kit.sphere(0.045, 16).at(-2.52, 1.38, 1.53), 'lamp_light'
).commit();
//@@
kit.object('PRP_picture_west_north').add(
  kit.box(0.045, 0.62, 0.74).at(-2.895, 2.05, 1.55), 'dark_wood'
).add(
  kit.box(0.012, 0.5, 0.62).at(-2.866, 2.05, 1.55), 'pale_paper'
).commit();
//@@
kit.object('PRP_picture_west_south').add(
  kit.box(0.045, 0.56, 0.66).at(-2.895, 2.12, -1.48), 'aged_wood'
).add(
  kit.box(0.012, 0.44, 0.54).at(-2.866, 2.12, -1.48), 'pale_paper'
).commit();
//@@
kit.object('PRP_picture_north_left').add(
  kit.box(0.7, 0.55, 0.045).at(-1.28, 2.13, 2.395), 'dark_wood'
).add(
  kit.box(0.58, 0.43, 0.012).at(-1.28, 2.13, 2.366), 'pale_paper'
).commit();
//@@
kit.object('PRP_picture_south_left').add(
  kit.box(0.66, 0.52, 0.045).at(-2.13, 2.03, -2.395), 'aged_wood'
).add(
  kit.box(0.54, 0.4, 0.012).at(-2.13, 2.03, -2.366), 'pale_paper'
).commit();
//@@
kit.object('PRP_picture_south_center').add(
  kit.box(0.62, 0.48, 0.045).at(-0.9, 2.04, -2.395), 'dark_wood'
).add(
  kit.box(0.5, 0.36, 0.012).at(-0.9, 2.04, -2.366), 'pale_paper'
).commit();
//@@
kit.model('PRP_floor_plant_southwest', 'lib:samples.anthurium_botany_01', { pos: [-2.55, 0, -1.85], height: 1.15, rotY: 35 });
//@@
kit.model('PRP_floor_plant_northwest', 'lib:samples.anthurium_botany_01', { pos: [-1.65, 0, 2.05], height: 1.2, rotY: 125 });
//@@
kit.model('PRP_floor_plant_northeast', 'lib:samples.anthurium_botany_01', { pos: [2.5, 0, 1.95], height: 1.35, rotY: 225 });
//@@
kit.model('PRP_windowsill_plant_left', 'lib:samples.anthurium_botany_01', { pos: [0.4, 0.77, 2.34], height: 0.29, rotY: 55 });
//@@
kit.model('PRP_windowsill_plant_right', 'lib:samples.anthurium_botany_01', { pos: [1.2, 0.77, 2.34], height: 0.32, rotY: 190 });
//@@
kit.describe({ title: 'Golden Hour Reading Room', setting: 'enclosed old townhouse reading room', style: 'naturalistic', era: 'traditional townhouse', lighting: 'warm low golden-hour sunlight and gentle reading lamp, balanced exposure with detail outside the window', palette: 'warm oak, muted cream, white trim, rust fabric', mood: 'quiet and cozy', atmosphere: 'clear, calm air' });
//@@
kit.light('LGT_golden_sun', { type: 'directional', pos: [3.8, 4.5, 6.5], target: [-1.8, 0.7, 0], color: '#ffd09a', intensity: 1.4 });
//@@
kit.light('LGT_window_fill', { type: 'area', pos: [0.8, 2.1, 2.25], target: [-1.4, 1, 0], color: '#ffe1bd', intensity: 3, width: 1.2, height: 1.4 });
//@@
kit.light('LGT_reading_lamp', { type: 'point', pos: [-2.52, 1.38, 1.53], color: '#ffcd8c', intensity: 8, distance: 3.5 });
//@@
kit.light('LGT_soft_room_fill', { type: 'area', pos: [1.7, 2.7, -1.4], target: [-1.2, 0.9, 0], color: '#fff0dc', intensity: 2, width: 1.5, height: 1 });
//@@
kit.camera('CAM_main', { pos: [2.1, 1.55, -2.15], lookAt: [-1.1, 1.15, 0.4], fov: 68 });
//@@
kit.camera('CAM_medium', { pos: [0.65, 1.35, -1.35], lookAt: [-2.02, 1.05, 0], fov: 42 });
//@@
kit.camera('CAM_coffee_table', { pos: [0.5, 0.95, -0.9], lookAt: [-0.6, 0.52, 0], fov: 42 });
//@@
kit.define('golden_sky_lamp_light', { base: 'lamp_light', color: '#eeb879', emissive: '#eeb879', emissiveIntensity: 0.65 });
kit.object('ENV_window_sky').add(kit.box(18, 9, 0.05).at(0.8, 4, 12), 'golden_sky_lamp_light').commit();
//@@
kit.object('ENV_distant_townhouse_roofs').add([
  kit.box(3.4, 2.4, 1.6).at(-2.4, 0.1, 8.3),
  kit.box(3.2, 2.7, 1.6).at(1.1, 0.05, 9.1),
  kit.box(3.6, 2.2, 1.6).at(4.6, 0.1, 8.6)
], 'aged_plaster').add([
  kit.box(2.55, 0.15, 1.9).at(-3.18, 1.63, 8.3).rot(0, 0, 25),
  kit.box(2.55, 0.15, 1.9).at(-1.62, 1.63, 8.3).rot(0, 0, -25),
  kit.box(2.4, 0.15, 1.9).at(0.37, 1.72, 9.1).rot(0, 0, 25),
  kit.box(2.4, 0.15, 1.9).at(1.83, 1.72, 9.1).rot(0, 0, -25),
  kit.box(2.7, 0.15, 1.9).at(3.78, 1.6, 8.6).rot(0, 0, 25),
  kit.box(2.7, 0.15, 1.9).at(5.42, 1.6, 8.6).rot(0, 0, -25)
], 'old_roof_tiles').add([
  kit.box(0.3, 0.8, 0.3).at(-2.9, 2.2, 8.4),
  kit.box(0.3, 0.8, 0.3).at(1.5, 2.3, 9.2),
  kit.box(0.3, 0.8, 0.3).at(4.1, 2.15, 8.7)
], 'aged_brick').commit();
//@@
kit.object('ENV_trees_beyond_window').add([
  kit.cylinder(0.11, 0.17, 2.6, 12).at(-0.4, 1.2, 7.3),
  kit.cylinder(0.1, 0.16, 2.4, 12).at(3.4, 1.1, 7.7),
  kit.cylinder(0.09, 0.15, 2.3, 12).at(-3.3, 1.05, 8)
], 'bark').add([
  kit.sphere(0.8, 16).at(-0.4, 2.65, 7.3),
  kit.sphere(0.55, 16).at(-0.92, 2.4, 7.3),
  kit.sphere(0.58, 16).at(0.1, 2.45, 7.3),
  kit.sphere(0.75, 16).at(3.4, 2.45, 7.7),
  kit.sphere(0.52, 16).at(2.9, 2.3, 7.7),
  kit.sphere(0.7, 16).at(-3.3, 2.35, 8)
], 'dark_foliage').commit();
//@@
kit.object('PRP_tall_wooden_bookshelf').add([
  kit.box(0.04, 2.25, 1.72).at(2.88, 1.125, 0.05),
  kit.box(0.46, 2.25, 0.055).at(2.68, 1.125, -0.78),
  kit.box(0.46, 2.25, 0.055).at(2.68, 1.125, 0.88),
  kit.box(0.46, 0.07, 1.72).at(2.68, 2.25, 0.05),
  ...kit.repeat(6, i => kit.box(0.46, 0.045, 1.62).at(2.68, 0.14 + i * 0.4, 0.05))
], 'aged_wood').commit();
//@@
kit.define('books_red_leather', { base: 'leather', color: '#893d34', roughness: 0.85 });
kit.define('books_blue_leather', { base: 'leather', color: '#465e70', roughness: 0.85 });
kit.define('books_green_leather', { base: 'leather', color: '#52634a', roughness: 0.85 });
kit.define('books_gold_fabric', { base: 'fabric', color: '#aa8045', roughness: 0.9 });
kit.define('books_plum_fabric', { base: 'fabric', color: '#704c59', roughness: 0.9 });
kit.object('PRP_bookshelf_books')
  .add(kit.repeat(16, i => {
    const shelfBookIndex = i * 5;
    const shelfBookRow = Math.floor(shelfBookIndex / 16);
    const shelfBookColumn = shelfBookIndex % 16;
    const shelfBookHeight = 0.22 + (shelfBookColumn % 4) * 0.025;
    return kit.box(0.25, shelfBookHeight, 0.085).at(2.68, 0.1625 + shelfBookRow * 0.4 + shelfBookHeight / 2, -0.66 + shelfBookColumn * 0.094);
  }), 'books_red_leather')
  .add(kit.repeat(16, i => {
    const shelfBookIndex = i * 5 + 1;
    const shelfBookRow = Math.floor(shelfBookIndex / 16);
    const shelfBookColumn = shelfBookIndex % 16;
    const shelfBookHeight = 0.22 + (shelfBookColumn % 4) * 0.025;
    return kit.box(0.25, shelfBookHeight, 0.085).at(2.68, 0.1625 + shelfBookRow * 0.4 + shelfBookHeight / 2, -0.66 + shelfBookColumn * 0.094);
  }), 'books_blue_leather')
  .add(kit.repeat(16, i => {
    const shelfBookIndex = i * 5 + 2;
    const shelfBookRow = Math.floor(shelfBookIndex / 16);
    const shelfBookColumn = shelfBookIndex % 16;
    const shelfBookHeight = 0.22 + (shelfBookColumn % 4) * 0.025;
    return kit.box(0.25, shelfBookHeight, 0.085).at(2.68, 0.1625 + shelfBookRow * 0.4 + shelfBookHeight / 2, -0.66 + shelfBookColumn * 0.094);
  }), 'books_green_leather')
  .add(kit.repeat(16, i => {
    const shelfBookIndex = i * 5 + 3;
    const shelfBookRow = Math.floor(shelfBookIndex / 16);
    const shelfBookColumn = shelfBookIndex % 16;
    const shelfBookHeight = 0.22 + (shelfBookColumn % 4) * 0.025;
    return kit.box(0.25, shelfBookHeight, 0.085).at(2.68, 0.1625 + shelfBookRow * 0.4 + shelfBookHeight / 2, -0.66 + shelfBookColumn * 0.094);
  }), 'books_gold_fabric')
  .add(kit.repeat(16, i => {
    const shelfBookIndex = i * 5 + 4;
    const shelfBookRow = Math.floor(shelfBookIndex / 16);
    const shelfBookColumn = shelfBookIndex % 16;
    const shelfBookHeight = 0.22 + (shelfBookColumn % 4) * 0.025;
    return kit.box(0.25, shelfBookHeight, 0.085).at(2.68, 0.1625 + shelfBookRow * 0.4 + shelfBookHeight / 2, -0.66 + shelfBookColumn * 0.094);
  }), 'books_plum_fabric').commit();
//@@
kit.define('mid_brown_wood', { base: 'wood', color: '#805437', roughness: 0.68 });
kit.object('PRP_low_tv_cabinet').add([
  kit.box(1.35, 0.07, 0.46).at(-0.9, 0.61, -2.1),
  kit.box(1.27, 0.43, 0.4).at(-0.9, 0.36, -2.12),
  ...kit.repeat(4, i => kit.box(0.08, 0.13, 0.08).at(-0.9 + (i < 2 ? -0.53 : 0.53), 0.065, i % 2 ? -1.96 : -2.27)),
  kit.box(0.57, 0.29, 0.025).at(-1.205, 0.36, -1.905),
  kit.box(0.57, 0.29, 0.025).at(-0.595, 0.36, -1.905)
], 'mid_brown_wood').add([
  kit.sphere(0.025, 12).at(-0.98, 0.36, -1.88),
  kit.sphere(0.025, 12).at(-0.82, 0.36, -1.88)
], 'aged_brass').commit();
//@@
kit.define('grey_screen_glass', { base: 'glass', color: '#777c7c', roughness: 0.55, transmission: 0 });
kit.object('PRP_vintage_television').add([
  kit.box(0.76, 0.53, 0.34).at(-0.9, 0.91, -2.1),
  kit.box(0.11, 0.07, 0.2).at(-1.17, 0.665, -2.1),
  kit.box(0.11, 0.07, 0.2).at(-0.63, 0.665, -2.1)
], 'mid_brown_wood').add(
  kit.box(0.49, 0.36, 0.025).at(-0.99, 0.92, -1.92), 'grey_screen_glass'
).add([
  kit.cylinder(0.025, 0.025, 0.025, 16).at(-0.61, 1.02, -1.91).rot(90, 0, 0),
  kit.cylinder(0.025, 0.025, 0.025, 16).at(-0.61, 0.88, -1.91).rot(90, 0, 0)
], 'aged_brass').commit();
//@@
kit.define('soft_bulb_lamp_light', { base: 'lamp_light', color: '#ffdbad', emissive: '#ffdbad', emissiveIntensity: 0.35 });
kit.object('PRP_reading_floor_lamp').add([
  kit.cylinder(0.2, 0.23, 0.05, 24).at(-2.52, 0.025, 1.53),
  kit.cylinder(0.025, 0.025, 1.38, 16).at(-2.52, 0.74, 1.53)
], 'aged_brass').add(
  kit.cylinder(0.12, 0.25, 0.28, 24).at(-2.52, 1.5, 1.53), 'pale_fabric'
).add(
  kit.sphere(0.045, 16).at(-2.52, 1.38, 1.53), 'soft_bulb_lamp_light'
).commit();
//@@
kit.light('LGT_golden_sun', { type: 'directional', pos: [4.4, 4.8, 6.5], target: [-1, 0, 0], color: '#ffc886', intensity: 1.8 });
//@@
kit.light('LGT_window_fill', { type: 'area', pos: [0.8, 2.1, 2.25], target: [-1.4, 1, 0], color: '#ffe1bd', intensity: 2, width: 1.2, height: 1.4 });
//@@
kit.light('LGT_reading_lamp', { type: 'point', pos: [-2.52, 1.38, 1.53], color: '#ffcd8c', intensity: 1.5, distance: 2 });
//@@
kit.object('PRP_tall_wooden_bookshelf').add([
  kit.box(1.72, 2.25, 0.04).at(-0.94, 1.125, 2.39),
  kit.box(0.055, 2.25, 0.46).at(-1.77, 1.125, 2.19),
  kit.box(0.055, 2.25, 0.46).at(-0.11, 1.125, 2.19),
  kit.box(1.72, 0.07, 0.46).at(-0.94, 2.25, 2.19),
  ...kit.repeat(6, i => kit.box(1.62, 0.045, 0.46).at(-0.94, 0.14 + i * 0.4, 2.19))
], 'aged_wood').commit();
//@@
kit.object('PRP_bookshelf_books')
  .add(kit.repeat(16, i => {
    const bookIndex = i * 5;
    const row = Math.floor(bookIndex / 16);
    const column = bookIndex % 16;
    const height = 0.22 + (column % 4) * 0.025;
    return kit.box(0.085, height, 0.25).at(-1.65 + column * 0.094, 0.1625 + row * 0.4 + height / 2, 2.19);
  }), 'books_red_leather')
  .add(kit.repeat(16, i => {
    const bookIndex = i * 5 + 1;
    const row = Math.floor(bookIndex / 16);
    const column = bookIndex % 16;
    const height = 0.22 + (column % 4) * 0.025;
    return kit.box(0.085, height, 0.25).at(-1.65 + column * 0.094, 0.1625 + row * 0.4 + height / 2, 2.19);
  }), 'books_blue_leather')
  .add(kit.repeat(16, i => {
    const bookIndex = i * 5 + 2;
    const row = Math.floor(bookIndex / 16);
    const column = bookIndex % 16;
    const height = 0.22 + (column % 4) * 0.025;
    return kit.box(0.085, height, 0.25).at(-1.65 + column * 0.094, 0.1625 + row * 0.4 + height / 2, 2.19);
  }), 'books_green_leather')
  .add(kit.repeat(16, i => {
    const bookIndex = i * 5 + 3;
    const row = Math.floor(bookIndex / 16);
    const column = bookIndex % 16;
    const height = 0.22 + (column % 4) * 0.025;
    return kit.box(0.085, height, 0.25).at(-1.65 + column * 0.094, 0.1625 + row * 0.4 + height / 2, 2.19);
  }), 'books_gold_fabric')
  .add(kit.repeat(16, i => {
    const bookIndex = i * 5 + 4;
    const row = Math.floor(bookIndex / 16);
    const column = bookIndex % 16;
    const height = 0.22 + (column % 4) * 0.025;
    return kit.box(0.085, height, 0.25).at(-1.65 + column * 0.094, 0.1625 + row * 0.4 + height / 2, 2.19);
  }), 'books_plum_fabric').commit();
//@@
kit.light('LGT_golden_sun', { type: 'directional', pos: [3.6, 4.8, 6.5], target: [-1, 0, 0], color: '#ffc886', intensity: 4 });
//@@
