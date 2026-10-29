
//@@
kit.describe({ title: 'Temple at First Light', setting: 'ancient desert temple ruins amid dunes and low rocky hills', style: 'cinematic archaeological realism', era: 'ancient', lighting: 'dawn sun behind the temple', palette: 'warm sandstone and pale desert sand', mood: 'quiet and monumental' });
//@@
kit.object('ENV_desert_landscape').add(kit.terrain(200, 200, 7, { seed: 1847, flat: 39, roughness: 0.48 }), 'sand').commit();
//@@
kit.object('ENV_temple_terrace').add(kit.box(22, 3, 18).at(0, 1.5, -12), 'weathered_stone_block').add([kit.box(22.2, 0.16, 18.2).at(0, 3.08, -12), ...kit.repeat(11, i => kit.box(0.035, 0.02, 18).at(-10 + i * 2, 3.17, -12)), ...kit.repeat(9, i => kit.box(22, 0.02, 0.035).at(0, 3.17, -20 + i * 2))], 'worn_stone_floor').commit();
//@@
kit.object('ENV_broad_stairway').add(kit.repeat(25, i => kit.box(8, (i + 1) * 0.12, 1.04).at(0, (i + 1) * 0.06, 21.5 - i)), 'worn_stone_block').add(kit.repeat(24, i => kit.box(7.9, 0.018, 0.035).at(0, (i + 1) * 0.12 + 0.01, 21.02 - i)), 'weathered_stone_floor').commit();
//@@
kit.object('ENV_gateway_left_pier').add([kit.box(1.35, 4.7, 1.45).at(-4.72, 5.35, -3), kit.box(1.65, 0.3, 1.7).at(-4.72, 3.3, -3), kit.box(1.65, 0.36, 1.7).at(-4.72, 7.85, -3), kit.box(1.1, 0.55, 1.3).at(-4.9, 8.3, -3)], 'crumbling_stone_block').add(kit.repeat(4, i => kit.box(1.37, 0.035, 1.47).at(-4.72, 4.2 + i * 0.9, -3)), 'weathered_stone_block').commit();
//@@
kit.object('ENV_gateway_right_pier').add([kit.box(1.35, 4.7, 1.45).at(4.72, 5.35, -3), kit.box(1.65, 0.3, 1.7).at(4.72, 3.3, -3), kit.box(1.65, 0.36, 1.7).at(4.72, 7.85, -3), kit.box(0.95, 0.4, 1.2).at(4.9, 8.22, -3)], 'crumbling_stone_block').add(kit.repeat(4, i => kit.box(1.37, 0.035, 1.47).at(4.72, 4.2 + i * 0.9, -3)), 'weathered_stone_block').commit();
//@@
kit.object('ENV_gateway_lintel').add([kit.box(10.75, 0.72, 1.4).at(0, 8.18, -3), kit.box(3.4, 0.28, 1.2).at(-3.45, 8.68, -3), kit.box(2.15, 0.2, 1.1).at(4.05, 8.64, -3)], 'weathered_stone_block').add(kit.repeat(9, i => kit.box(0.06, 0.36, 0.025).at(-3.2 + i * 0.8, 8.18, -2.285)), 'worn_stone_block').commit();
//@@
kit.object('ENV_stair_left_edge').add(kit.repeat(12, i => kit.box(0.45, 0.18 + i * 0.23, 1.95).at(-4.2, (0.18 + i * 0.23) / 2, 20.95 - i * 2)), 'weathered_stone_block').commit();
//@@
kit.object('ENV_stair_right_edge').add(kit.repeat(12, i => kit.box(0.45, 0.18 + i * 0.23, 1.95).at(4.2, (0.18 + i * 0.23) / 2, 20.95 - i * 2)), 'weathered_stone_block').commit();
//@@
kit.object('ENV_scattered_desert_stones').add(kit.repeat(42, i => {
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * (7 + (i * 13 % 27));
  const z = -27 + (i * 17 % 65);
  const r = 0.12 + (i % 5) * 0.065;
  return kit.sphere(r, 8).scale([1.5, 0.55, 1.05]).at(x, r * 0.3, z);
}), 'weathered_rock').commit();
//@@
kit.object('ENV_column_west_front').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -5.5), kit.cylinder(0.55, 0.7, 4.25, 16).at(-6, 5.525, -5.5), kit.cylinder(0.83, 0.58, 0.38, 16).at(-6, 7.84, -5.5), kit.box(1.65, 0.25, 1.65).at(-6, 8.155, -5.5)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_west_second').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -8.3), kit.cylinder(0.55, 0.7, 4.25, 16).at(-6, 5.525, -8.3), kit.cylinder(0.83, 0.58, 0.38, 16).at(-6, 7.84, -8.3), kit.box(1.65, 0.25, 1.65).at(-6, 8.155, -8.3)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_west_third').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -11.1), kit.cylinder(0.55, 0.7, 4.25, 16).at(-6, 5.525, -11.1), kit.cylinder(0.83, 0.58, 0.38, 16).at(-6, 7.84, -11.1), kit.box(1.65, 0.25, 1.65).at(-6, 8.155, -11.1)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_west_fourth_broken').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -13.9), kit.cylinder(0.61, 0.7, 1.55, 12).at(-6, 4.175, -13.9), kit.box(0.42, 0.15, 0.55).rot(8, 20, -9).at(-6.18, 5.01, -13.87)], 'crumbling_stone_block').commit();
//@@
kit.object('ENV_column_west_fifth_broken').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -16.7), kit.cylinder(0.64, 0.7, 1.05, 12).at(-6, 3.925, -16.7), kit.box(0.5, 0.14, 0.4).rot(-6, 28, 8).at(-5.86, 4.49, -16.75)], 'crumbling_stone_block').commit();
//@@
kit.object('ENV_column_west_rear_broken').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(-6, 3.28, -19.5), kit.cylinder(0.59, 0.7, 2.1, 12).at(-6, 4.45, -19.5), kit.box(0.44, 0.17, 0.51).rot(7, -15, -7).at(-6.15, 5.55, -19.46)], 'crumbling_stone_block').commit();
//@@
kit.object('ENV_column_east_front').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -5.5), kit.cylinder(0.55, 0.7, 4.25, 16).at(6, 5.525, -5.5), kit.cylinder(0.83, 0.58, 0.38, 16).at(6, 7.84, -5.5), kit.box(1.65, 0.25, 1.65).at(6, 8.155, -5.5)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_east_second').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -8.3), kit.cylinder(0.55, 0.7, 4.25, 16).at(6, 5.525, -8.3), kit.cylinder(0.83, 0.58, 0.38, 16).at(6, 7.84, -8.3), kit.box(1.65, 0.25, 1.65).at(6, 8.155, -8.3)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_east_third').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -11.1), kit.cylinder(0.55, 0.7, 4.25, 16).at(6, 5.525, -11.1), kit.cylinder(0.83, 0.58, 0.38, 16).at(6, 7.84, -11.1), kit.box(1.65, 0.25, 1.65).at(6, 8.155, -11.1)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_east_fourth').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -13.9), kit.cylinder(0.55, 0.7, 4.25, 16).at(6, 5.525, -13.9), kit.cylinder(0.83, 0.58, 0.38, 16).at(6, 7.84, -13.9), kit.box(1.65, 0.25, 1.65).at(6, 8.155, -13.9)], 'weathered_stone_block').commit();
//@@
kit.object('ENV_column_east_fifth_broken').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -16.7), kit.cylinder(0.62, 0.7, 1.45, 12).at(6, 4.125, -16.7), kit.box(0.48, 0.16, 0.42).rot(-8, 12, 8).at(6.12, 4.89, -16.76)], 'crumbling_stone_block').commit();
//@@
kit.object('ENV_column_east_rear_broken').add([kit.cylinder(0.8, 0.85, 0.24, 16).at(6, 3.28, -19.5), kit.cylinder(0.65, 0.7, 0.85, 12).at(6, 3.825, -19.5), kit.box(0.4, 0.14, 0.52).rot(7, 32, -6).at(5.86, 4.29, -19.45)], 'crumbling_stone_block').commit();
//@@
kit.object('ENV_lintel_west_front').add(kit.box(1.35, 0.62, 4.15).at(-6, 8.59, -6.9), 'weathered_stone_block').add(kit.repeat(5, i => kit.box(0.025, 0.25, 0.045).at(-5.312, 8.58, -8.0 + i * 0.55)), 'worn_stone_block').commit();
//@@
kit.object('ENV_lintel_east_front').add(kit.box(1.35, 0.62, 4.15).at(6, 8.59, -6.9), 'weathered_stone_block').add(kit.repeat(5, i => kit.box(0.025, 0.25, 0.045).at(5.312, 8.58, -8.0 + i * 0.55)), 'worn_stone_block').commit();
//@@
kit.object('ENV_lintel_east_rear').add(kit.box(1.35, 0.62, 4.15).at(6, 8.59, -12.5), 'weathered_stone_block').add(kit.repeat(5, i => kit.box(0.025, 0.25, 0.045).at(5.312, 8.58, -13.6 + i * 0.55)), 'worn_stone_block').commit();
//@@
kit.object('ENV_rear_wall_west_remnant').add([kit.box(4.8, 2.5, 0.85).at(-8.2, 4.41, -20.45), kit.box(2.8, 0.7, 0.8).at(-9.1, 6.01, -20.45), kit.box(1.2, 0.45, 0.76).at(-9.9, 6.585, -20.45)], 'crumbling_stone_block').add(kit.repeat(3, i => kit.box(4.7, 0.035, 0.025).at(-8.2, 3.85 + i * 0.7, -20.01)), 'worn_stone_block').commit();
//@@
kit.object('ENV_rear_wall_east_remnant').add([kit.box(4.2, 2.1, 0.85).at(8.4, 4.21, -20.45), kit.box(2.4, 0.65, 0.8).at(9.2, 5.585, -20.45), kit.box(0.9, 0.38, 0.74).at(9.85, 6.1, -20.45)], 'crumbling_stone_block').add(kit.repeat(2, i => kit.box(4.1, 0.035, 0.025).at(8.4, 3.85 + i * 0.7, -20.01)), 'worn_stone_block').commit();
//@@
kit.object('ENV_west_side_wall_remnant').add([kit.box(0.85, 1.65, 5.2).at(-10.45, 3.985, -15.8), kit.box(0.8, 0.65, 2.4).at(-10.45, 5.135, -17.2), kit.box(0.75, 0.35, 1.1).at(-10.45, 5.635, -17.75)], 'crumbling_stone_block').add(kit.repeat(2, i => kit.box(0.025, 0.035, 5.05).at(-10.01, 3.72 + i * 0.68, -15.8)), 'worn_stone_block').commit();
//@@
kit.object('ENV_east_side_wall_remnant').add([kit.box(0.85, 1.35, 4.2).at(10.45, 3.835, -16.4), kit.box(0.8, 0.55, 1.8).at(10.45, 4.785, -17.55)], 'crumbling_stone_block').add(kit.box(0.025, 0.035, 4.05).at(10.01, 3.83, -16.4), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_01').add(kit.box(1.8, 0.9, 1.05).at(-8, 0.28, 17), 'weathered_stone_block').add(kit.repeat(5, i => kit.box(0.035, 0.25, 0.025).at(-8.6 + i * 0.3, 0.5, 17.54)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_02').add(kit.box(1.35, 0.8, 1.1).rot(0, 18, 0).at(7.2, 0.2, 19), 'crumbling_stone_block').add(kit.box(0.8, 0.035, 0.035).rot(0, 18, 0).at(7.2, 0.61, 19), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_03').add(kit.box(2.1, 1.05, 1.2).rot(0, -12, 0).at(-9.4, 0.34, 11), 'weathered_stone_block').add(kit.repeat(4, i => kit.box(0.035, 0.035, 0.75).rot(0, -12, 0).at(-10 + i * 0.38, 0.88, 11)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_04').add(kit.box(1.55, 0.85, 1.25).rot(0, 25, 0).at(9, 0.25, 12.5), 'crumbling_stone_block').add(kit.box(1, 0.025, 0.04).rot(0, 25, 0).at(9, 0.69, 12.5), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_05').add(kit.box(1.6, 0.9, 1).rot(0, -22, 0).at(-7.2, 0.28, 5), 'weathered_stone_block').add(kit.repeat(3, i => kit.box(0.045, 0.025, 0.7).rot(0, -22, 0).at(-7.65 + i * 0.42, 0.74, 5)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_06').add(kit.box(2, 1.1, 1.15).rot(0, 14, 0).at(8.1, 0.38, 4.5), 'weathered_stone_block').add(kit.box(1.4, 0.03, 0.045).rot(0, 14, 0).at(8.1, 0.94, 4.5), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_07').add(kit.box(1.4, 0.9, 1.3).rot(0, 35, 0).at(-13, 0.27, -2), 'crumbling_stone_block').add(kit.repeat(3, i => kit.box(0.035, 0.025, 0.7).rot(0, 35, 0).at(-13.35 + i * 0.35, 0.73, -2)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_08').add(kit.box(1.9, 0.95, 1.15).rot(0, -16, 0).at(13.2, 0.3, -4), 'weathered_stone_block').add(kit.box(1.25, 0.03, 0.04).rot(0, -16, 0).at(13.2, 0.79, -4), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_09').add(kit.box(1.6, 0.8, 1.1).rot(0, 12, 0).at(-13.8, 0.23, -10), 'crumbling_stone_block').add(kit.box(1, 0.025, 0.04).rot(0, 12, 0).at(-13.8, 0.64, -10), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_10').add(kit.box(2.2, 1.05, 1.3).rot(0, -28, 0).at(14, 0.35, -12), 'weathered_stone_block').add(kit.repeat(4, i => kit.box(0.04, 0.025, 0.8).rot(0, -28, 0).at(13.4 + i * 0.38, 0.89, -12)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_11').add(kit.box(1.7, 0.9, 1.1).rot(0, 20, 0).at(-13, 0.28, -20), 'weathered_stone_block').add(kit.box(1.1, 0.025, 0.04).rot(0, 20, 0).at(-13, 0.74, -20), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_12').add(kit.box(1.5, 0.85, 1.2).rot(0, -10, 0).at(12.8, 0.26, -22.5), 'crumbling_stone_block').add(kit.repeat(3, i => kit.box(0.035, 0.025, 0.75).rot(0, -10, 0).at(12.45 + i * 0.35, 0.7, -22.5)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_13').add(kit.box(1.35, 0.75, 0.95).rot(0, 12, 0).at(-8.8, 3.545, -7.3), 'weathered_stone_block').add(kit.box(0.85, 0.025, 0.04).rot(0, 12, 0).at(-8.8, 3.932, -7.3), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_14').add(kit.box(1.6, 0.7, 1).rot(0, -18, 0).at(8.9, 3.52, -10.7), 'crumbling_stone_block').add(kit.repeat(3, i => kit.box(0.035, 0.025, 0.65).rot(0, -18, 0).at(8.5 + i * 0.4, 3.882, -10.7)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_15').add(kit.box(1.7, 0.85, 1.05).rot(0, 15, 0).at(-3.4, 3.595, -17.6), 'weathered_stone_block').add(kit.box(1.1, 0.025, 0.04).rot(0, 15, 0).at(-3.4, 4.032, -17.6), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_16').add(kit.box(1.3, 0.65, 0.9).rot(0, -25, 0).at(3.1, 3.495, -18.8), 'crumbling_stone_block').add(kit.repeat(3, i => kit.box(0.035, 0.025, 0.55).rot(0, -25, 0).at(2.8 + i * 0.3, 3.832, -18.8)), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_17').add(kit.box(1.5, 0.8, 0.95).rot(0, 8, 0).at(-8.8, 3.57, -12.4), 'weathered_stone_block').add(kit.box(1, 0.025, 0.04).rot(0, 8, 0).at(-8.8, 3.982, -12.4), 'worn_stone_block').commit();
//@@
kit.object('PRP_carved_block_18').add(kit.box(1.4, 0.75, 1).rot(0, -15, 0).at(8.7, 3.545, -18.3), 'crumbling_stone_block').add(kit.box(0.9, 0.025, 0.04).rot(0, -15, 0).at(8.7, 3.932, -18.3), 'worn_stone_block').commit();
//@@
kit.object('PRP_fallen_column_west').add([kit.cylinder(0.58, 0.65, 2.6, 14).rot(90, 0, 90).at(-3.7, 3.82, -14.1), kit.cylinder(0.57, 0.61, 1.15, 14).rot(90, 0, 90).at(-1.72, 3.78, -14.1)], 'weathered_stone_block').commit();
//@@
kit.object('PRP_fallen_column_east').add([kit.cylinder(0.55, 0.65, 2.5, 14).rot(90, 0, 90).at(3.8, 3.82, -16.1), kit.cylinder(0.55, 0.6, 0.9, 14).rot(90, 0, 90).at(2.02, 3.77, -16.1)], 'crumbling_stone_block').commit();
//@@
kit.object('PRP_fallen_column_in_sand').add([kit.cylinder(0.65, 0.72, 2.8, 14).rot(90, 0, 90).at(-12.5, 0.4, 3), kit.cylinder(0.58, 0.65, 1.1, 14).rot(90, 0, 90).at(-10.45, 0.36, 3)], 'weathered_stone_block').commit();
//@@
kit.object('PRP_west_terrace_rubble').add(kit.repeat(15, i => kit.sphere(0.12 + (i % 4) * 0.07, 7).scale([1.5, 0.65, 1.1]).at(-9.5 + (i * 7 % 23) * 0.11, 3.22 + (i % 4) * 0.04, -18.7 + (i * 11 % 31) * 0.12)), 'crumbling_stone_block').commit();
//@@
kit.object('PRP_east_terrace_rubble').add(kit.repeat(15, i => kit.sphere(0.12 + (i % 4) * 0.07, 7).scale([1.45, 0.65, 1.1]).at(7.5 + (i * 7 % 23) * 0.11, 3.22 + (i % 4) * 0.04, -19.7 + (i * 11 % 27) * 0.12)), 'crumbling_stone_block').commit();
//@@
kit.object('PRP_stairside_rubble').add(kit.repeat(24, i => {
  const side = i % 2 ? 1 : -1;
  const r = 0.14 + (i % 4) * 0.06;
  return kit.sphere(r, 7).scale([1.5, 0.6, 1.1]).at(side * (5.1 + (i * 7 % 20) * 0.14), r * 0.35, 1 + (i * 11 % 19));
}), 'weathered_stone_block').commit();
//@@
kit.actor('CHAR_cloaked_traveller_left_walking', { pos: [-1.1, 0.6, 17.7], rotY: 180, height: 1.75, action: 'walk', path: [[-1.1, 17.7], [-1.1, 17.3]], speed: 0.08 });
//@@
kit.actor('CHAR_cloaked_traveller_right_walking', { pos: [1.1, 0.84, 15.7], rotY: 180, height: 1.68, action: 'walk', path: [[1.1, 15.7], [1.1, 15.3]], speed: 0.08, offset: 0.4 });
//@@
kit.describe({ title: 'Temple at First Light', setting: 'ancient desert temple ruins amid dunes and low rocky hills', style: 'cinematic archaeological realism', era: 'ancient', lighting: 'low orange dawn sun behind the temple, pale blue sky fill', palette: 'warm sandstone and pale desert sand beneath a pale blue sky', mood: 'quiet and monumental', atmosphere: 'thin distant desert haze' });
//@@
kit.light('LGT_dawn_sun', { type: 'directional', pos: [-8, 14, -90], target: [0, 3, 0], color: '#ffad68', intensity: 2.4 });
//@@
kit.light('LGT_sky_fill', { type: 'area', pos: [0, 24, 12], target: [0, 0, -6], color: '#c7ddf4', intensity: 3, width: 35, height: 20 });
//@@
kit.camera('CAM_main', { pos: [18, 5.5, 38], lookAt: [0, 4, -7], fov: 48 });
//@@
kit.camera('CAM_low_stairs', { pos: [0, 1.35, 25], lookAt: [0, 5.1, -7], fov: 46 });
//@@
kit.camera('CAM_columns', { pos: [8, 4.8, -8], lookAt: [6, 5.4, -18.5], fov: 48 });
//@@
kit.actor('CHAR_cloaked_traveller_left_walking', { pos: [-1.1, 0.6, 17.7], rotY: 180, height: 1.75, action: 'walk', path: [[-1.1, 0.6, 17.7], [-1.1, 1.2, 12.7]], speed: 0.35 });
//@@
kit.actor('CHAR_cloaked_traveller_right_walking', { pos: [1.1, 0.84, 15.7], rotY: 180, height: 1.68, action: 'walk', path: [[1.1, 0.84, 15.7], [1.1, 1.44, 10.7]], speed: 0.35, offset: 0.4 });
//@@
