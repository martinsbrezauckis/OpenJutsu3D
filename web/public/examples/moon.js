kit.describe({title:'Lunar Logistics Colony',setting:'180 by 140 metre lunar outpost; settlement west, parked transport east, rockets north',style:'grounded hard science fiction; industrial silhouettes; slow forward establishing move',era:'near future',lighting:'low sunlight from negative x and negative z; long crisp shadows; operational pad lamps',palette:'grey regolith, white insulation, silver hulls, dark glazing, restrained orange markings',mood:'quiet, remote, operational',atmosphere:'black sky, clear airless vacuum, no haze, dust clouds or exhaust'});

const DEG = Math.PI / 180;
const PAD_Y = 0.18;
const HAB = [[-65,-15,'west'],[-40,-15,'south'],[-15,-15,'east'],[-65,30,'west'],[-40,38,'north'],[-15,30,'east']];
const FLOODS = [[32,-17,47,0],[62,17,47,0],[1,-53,10,-43],[19,-33,10,-43],[34,-53,43,-43],[52,-33,43,-43],[5.6,42.5,12,48],[18.4,53.5,12,48],[35.6,42.5,42,48],[48.4,53.5,42,48],[65.6,42.5,72,48],[78.4,53.5,72,48]];
const ROUTES = [
  [[-76,-26],[0,-26],[0,25],[0,63],[82,63]],
  [[-76,-26],[-76,43],[-60,47],[-22,47],[-4,35],[0,25]],
  [[0,0],[30,0]],
  [[0,0],[-26,0],[-26,10],[-28,10]],
  [[0,-28],[43,-28]],
  [[10,-28],[10,-31]],
  [[43,-28],[43,-31]],
  [[-31,-26],[-31,-47],[-35,-47]],
  [[-76,-15],[-73,-15]],
  [[-76,30],[-73,30]],
  [[-40,-26],[-40,-21]],
  [[-40,47],[-40,44]],
  [[0,-15],[-7,-15]],
  [[0,30],[-7,30]],
  [[12,63],[12,57]],
  [[42,63],[42,57]],
  [[72,63],[72,57]],
  [[-76,10],[-68,10]]
];

kit.define('white_insulation_fabric',{base:'fabric',color:'#ccccca',roughness:0.9});
kit.define('polished_hull_metal_plate',{base:'metal_plate',color:'#999c9e',roughness:0.48,metalness:0.65});
kit.define('grey_structure_steel',{base:'steel',color:'#696d70',roughness:0.7,metalness:0.5});
kit.define('dark_viewport_glass',{base:'glass',color:'#14191d',roughness:0.22,transmission:0.02});
kit.define('orange_marking_paint',{base:'paint',color:'#ad713d',roughness:0.75});
kit.define('grey_regolith_dirt',{base:'dirt',color:'#777570',roughness:1});
kit.define('compacted_regolith_dirt',{base:'dirt',color:'#575753',roughness:1});
kit.define('lunar_sintered_concrete',{base:'concrete',color:'#666762',roughness:0.94});
kit.define('dark_solar_glass',{base:'glass',color:'#30363e',roughness:0.3,transmission:0});
kit.define('pale_radiator_metal_plate',{base:'metal_plate',color:'#bcbdb9',roughness:0.8});
kit.glow('white_lamp_light','#fff1da',2.2);

function put(g,m,p) {
  if(!g[m]) g[m]=[];
  g[m].push(...(Array.isArray(p)?p.flat(Infinity):[p]));
}
function finish(name,g,x=0,z=0,yaw=0,y=0) {
  const o=kit.object(name);
  Object.keys(g).forEach(m=>{if(g[m].length)o.add(g[m],m);});
  o.at(x,y,z,yaw).commit();
}
function hash(i,s=0) {
  const v=Math.sin(i*127.1+s*311.7)*43758.5453;
  return v-Math.floor(v);
}
function rod(a,b,r=0.08) {
  return kit.tube([a,b],r,12);
}
function lineParts(points,width,y=0.012,height=0.024) {
  const p=[];
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
    p.push(kit.box(width,height,l).rot(0,Math.atan2(dx,dz)/DEG,0).at((a[0]+b[0])/2,y,(a[1]+b[1])/2));
  }
  return p;
}
function corridorEnds(x,z) {
  const dx=x+40,dz=z-10,l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
  const edge=Math.min(6/Math.max(Math.abs(ux),0.00001),4/Math.max(Math.abs(uz),0.00001));
  return [[-40+ux*5.65,10+uz*5.65],[x-ux*(edge-0.2),z-uz*(edge-0.2)]];
}
function door(g,cx,cz,yaw,sill) {
  const a=yaw*DEG,c=Math.cos(a),s=Math.sin(a);
  function p(m,w,h,d,x,y,z) {
    put(g,m,kit.box(w,h,d).rot(0,yaw,0).at(cx+x*c+z*s,sill+y,cz-x*s+z*c));
  }
  p('black_rubber',2.22,2.62,0.12,0,1.31,0);
  p('grey_structure_steel',0.15,2.74,0.3,-1.16,1.33,0.06);
  p('grey_structure_steel',0.15,2.74,0.3,1.16,1.33,0.06);
  p('grey_structure_steel',2.46,0.15,0.3,0,2.7,0.06);
  p('polished_hull_metal_plate',1.98,2.4,0.12,0,1.28,0.12);
  p('black_rubber',0.025,2.25,0.025,0,1.28,0.19);
  p('dark_viewport_glass',0.46,0.56,0.03,0,1.83,0.2);
  p('grey_structure_steel',0.07,0.43,0.12,0.72,1.1,0.22);
  p('orange_marking_paint',0.18,0.22,0.03,-0.76,1.08,0.2);
  const n=Math.ceil(sill/0.24);
  for(let i=0;i<n;i++) {
    const h=sill*(n-i)/n;
    p('grey_structure_steel',2.65,h,0.52,0,h/2-sill,0.45+i*0.5);
  }
}
function habitat(name,x,z,side) {
  const g={};
  put(g,'white_insulation_fabric',kit.box(11.8,3.95,7.8).at(0,2.825,0));
  put(g,'grey_structure_steel',[
    kit.box(12,0.3,8).at(0,0.7,0),
    kit.box(12,0.2,8).at(0,4.9,0),
    ...kit.repeat(6,i=>kit.box(1.1,0.55,1.15).at(i%3*4.8-4.8,0.275,i<3?-2.95:2.95)),
    ...kit.repeat(4,i=>kit.box(0.22,4,0.22).at(i<2?-5.88:5.88,2.8,i%2?-3.88:3.88)),
    ...kit.repeat(10,i=>kit.box(0.12,3.95,0.16).at((i%5-2)*2.4,2.825,i<5?-3.91:3.91))
  ]);
  put(g,'grey_structure_steel',kit.repeat(8,i=>kit.box(1.95,0.94,0.15).at((i%4-1.5)*2.6,3.13,i<4?-3.93:3.93)));
  put(g,'dark_viewport_glass',kit.repeat(8,i=>kit.box(1.65,0.65,0.045).at((i%4-1.5)*2.6,3.13,i<4?-4.015:4.015)));
  put(g,'white_insulation_fabric',[
    kit.box(3.6,0.18,2.4).at(-2.5,4.82,0),
    kit.box(2.6,0.18,2.4).at(2.5,4.82,0)
  ]);
  put(g,'orange_marking_paint',[
    kit.box(0.26,2.7,0.035).at(-5.42,2.55,-4.025),
    kit.box(0.26,2.7,0.035).at(5.42,2.55,4.025)
  ]);
  if(side==='west')door(g,-6.02,0,-90,0.85);
  if(side==='east')door(g,6.02,0,90,0.85);
  if(side==='south')door(g,0,-4.03,180,0.85);
  if(side==='north')door(g,0,4.03,0,0.85);
  finish(name,g,x,z);
}
function corridor(name,x,z) {
  const g={},e=corridorEnds(x,z),a=e[0],b=e[1];
  const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz)/DEG,n=Math.ceil(l/2.2);
  put(g,'white_insulation_fabric',kit.tube([[a[0],2.65,a[1]],[b[0],2.65,b[1]]],1.35,32));
  put(g,'grey_structure_steel',[
    kit.box(2.22,0.16,l).rot(0,yaw,0).at((a[0]+b[0])/2,1.3,(a[1]+b[1])/2),
    ...kit.repeat(n+1,i=>{
      const t=i/n;
      return kit.torus(1.37,0.07,360,24).rot(0,yaw,0).at(a[0]+dx*t,2.65,a[1]+dz*t);
    }),
    ...kit.repeat(Math.max(2,Math.floor(l/4)),i=>{
      const t=(i+0.5)/Math.max(2,Math.floor(l/4));
      return kit.box(2.4,1.22,0.85).rot(0,yaw,0).at(a[0]+dx*t,0.61,a[1]+dz*t);
    })
  ]);
  finish(name,g);
}
function rectangularPad(name,x,z,w,d,r) {
  const g={};
  put(g,'lunar_sintered_concrete',kit.box(w,PAD_Y,d).at(0,PAD_Y/2,0));
  put(g,'grey_structure_steel',[
    kit.box(w,0.08,0.24).at(0,0.14,-d/2+0.12),
    kit.box(w,0.08,0.24).at(0,0.14,d/2-0.12),
    kit.box(0.24,0.08,d).at(-w/2+0.12,0.14,0),
    kit.box(0.24,0.08,d).at(w/2-0.12,0.14,0),
    ...kit.repeat(7,i=>kit.box(w-0.5,0.008,0.035).at(0,PAD_Y+0.005,(i-3)*d/7))
  ]);
  put(g,'orange_marking_paint',[
    kit.torus(r,0.065,360,64).rot(90,0,0).at(0,0.2,0),
    kit.box(w-1,0.012,0.12).at(0,0.19,-d/2+0.65),
    kit.box(w-1,0.012,0.12).at(0,0.19,d/2-0.65)
  ]);
  finish(name,g,x,z);
}
function rocketPad(name,x,z) {
  const g={};
  put(g,'lunar_sintered_concrete',kit.cylinder(9,9,PAD_Y,64).at(0,PAD_Y/2,0));
  put(g,'grey_structure_steel',kit.torus(8.85,0.09,360,64).rot(90,0,0).at(0,0.12,0));
  put(g,'orange_marking_paint',[
    kit.torus(8.1,0.07,360,64).rot(90,0,0).at(0,0.2,0),
    ...kit.repeat(8,i=>{
      const a=i*45*DEG;
      return kit.box(0.15,0.015,0.8).rot(0,i*45,0).at(Math.sin(a)*7.4,0.19,Math.cos(a)*7.4);
    })
  ]);
  finish(name,g,x,z);
}
function transport(name,x,z) {
  const g={};
  put(g,'polished_hull_metal_plate',kit.lathe([[0.32,-14],[1.05,-13.6],[1.95,-12.4],[2.6,-10.6],[3.25,-8.5],[3.4,-6],[3.4,7.8],[3.12,10.6],[2.7,12],[2.4,12.4]],48).rot(90,0,0).at(0,5.2,0));
  put(g,'white_insulation_fabric',[
    ...kit.repeat(4,i=>kit.cylinder(3.43,3.43,2.15,40).rot(90,0,0).at(0,5.2,-4.7+i*3.25)),
    ...kit.repeat(2,i=>kit.lathe([[0.7,-8.5],[1.25,-7.5],[1.35,-6],[1.35,7.3],[0.95,9.4]],24).rot(90,0,0).at(i?4.35:-4.35,4.6,1.4)),
    kit.box(2.3,0.4,3.8).at(0,8.8,2.7)
  ]);
  put(g,'polished_hull_metal_plate',[
    ...kit.repeat(7,i=>kit.torus(3.47,0.055,360,40).at(0,5.2,-6+i*2.25)),
    kit.extrude([[3.1,-4.5],[4.7,-2.2],[8,6.2],[8,7.7],[3,7.9]],0.65).rot(90,0,0).at(0,3.6,0),
    kit.extrude([[-3.1,-4.5],[-4.7,-2.2],[-8,6.2],[-8,7.7],[-3,7.9]],0.65).rot(90,0,0).at(0,3.6,0)
  ]);
  put(g,'dark_viewport_glass',[
    kit.box(1.65,0.14,2.15).rot(-18,0,-9).at(-0.9,7.72,-10.6),
    kit.box(1.65,0.14,2.15).rot(-18,0,9).at(0.9,7.72,-10.6),
    ...kit.repeat(10,i=>kit.box(0.12,0.52,1.05).at(i<5?-3.43:3.43,5.4,-4.8+(i%5)*2.25))
  ]);
  put(g,'orange_marking_paint',[
    kit.cylinder(3.47,3.47,0.48,40).rot(90,0,0).at(0,5.2,-6.4),
    kit.cylinder(3.47,3.47,0.48,40).rot(90,0,0).at(0,5.2,6.7),
    kit.box(1.25,0.025,1.9).at(-6.2,3.945,5.7),
    kit.box(1.25,0.025,1.9).at(6.2,3.945,5.7)
  ]);
  for(let i=0;i<2;i++) {
    const s=i?1:-1;
    put(g,'blackened_iron',[
      kit.cylinder(1.5,0.85,2.7,32).rot(90,0,0).at(s*4.35,4.6,12.65),
      kit.cylinder(1.29,1.29,0.08,32).rot(90,0,0).at(s*4.35,4.6,13.98)
    ]);
    put(g,'grey_structure_steel',kit.torus(1.51,0.08,360,32).at(s*4.35,4.6,13.89));
  }
  for(let i=0;i<4;i++) {
    const sx=i<2?-1:1,sz=i%2?-1:1,foot=[sx*6.35,0.22,sz*8.4];
    put(g,'grey_structure_steel',[
      rod([sx*2.7,4.1,sz*6.9],foot,0.24),
      rod([sx*4.65,3.35,sz*5.3],foot,0.11),
      kit.cylinder(0.62,0.78,0.22,12).at(foot[0],0.11,foot[2])
    ]);
    put(g,'white_insulation_fabric',kit.box(0.6,1.8,1.1).rot(0,0,sx*27).at(sx*4,2.8,sz*7.45));
  }
  finish(name,g,x,z,0,PAD_Y);
}
function shuttle(name,x,z) {
  const g={};
  put(g,'polished_hull_metal_plate',kit.lathe([[0.18,-7],[0.9,-6.5],[1.45,-5.5],[1.8,-4.2],[1.85,-2.5],[1.85,4.3],[1.55,5.7]],32).rot(90,0,0).at(0,3.3,0));
  put(g,'white_insulation_fabric',[
    ...kit.repeat(3,i=>kit.cylinder(1.88,1.88,1.4,32).rot(90,0,0).at(0,3.3,-1.8+i*2)),
    kit.box(1.1,0.6,1.8).at(0,5.5,2.4)
  ]);
  put(g,'polished_hull_metal_plate',[
    kit.extrude([[1.5,-2],[2.6,-0.5],[4.8,3.4],[4.8,4.5],[1.5,4.8]],0.4).rot(90,0,0).at(0,2.3,0),
    kit.extrude([[-1.5,-2],[-2.6,-0.5],[-4.8,3.4],[-4.8,4.5],[-1.5,4.8]],0.4).rot(90,0,0).at(0,2.3,0)
  ]);
  put(g,'dark_viewport_glass',[
    kit.box(1.05,0.12,1.6).rot(-20,0,-8).at(-0.58,4.84,-4.8),
    kit.box(1.05,0.12,1.6).rot(-20,0,8).at(0.58,4.84,-4.8)
  ]);
  put(g,'orange_marking_paint',[
    kit.cylinder(1.91,1.91,0.35,32).rot(90,0,0).at(0,3.3,-2.75),
    kit.cylinder(1.91,1.91,0.35,32).rot(90,0,0).at(0,3.3,3.45)
  ]);
  for(let i=0;i<2;i++) {
    const s=i?1:-1;
    put(g,'grey_structure_steel',kit.cylinder(0.72,0.72,3.6,24).rot(90,0,0).at(s*2.25,3.15,3.65));
    put(g,'blackened_iron',kit.cylinder(0.95,0.56,1.6,24).rot(90,0,0).at(s*2.25,3.15,6.2));
    put(g,'grey_structure_steel',kit.torus(0.96,0.055,360,24).at(s*2.25,3.15,6.95));
  }
  for(let i=0;i<4;i++) {
    const sx=i<2?-1:1,sz=i%2?-1:1;
    put(g,'grey_structure_steel',[
      rod([sx*1.5,2.7,sz*2.8],[sx*3.35,0.2,sz*4.4],0.15),
      rod([sx*2.3,2.2,sz*1.8],[sx*3.35,0.2,sz*4.4],0.075),
      kit.cylinder(0.4,0.55,0.2,12).at(sx*3.35,0.1,sz*4.4)
    ]);
  }
  finish(name,g,x,z,0,PAD_Y);
}
function rocket(name,x,z,h) {
  const g={};
  put(g,'white_insulation_fabric',kit.lathe([[1.65,2.8],[2.15,4],[2.3,6],[2.3,h-7],[1.95,h-4],[1.2,h-1.5],[0.1,h]],40));
  put(g,'grey_structure_steel',[
    ...kit.repeat(5,i=>kit.torus(2.32,0.055,360,32).rot(90,0,0).at(0,6+(h-13)*i/4,0)),
    ...kit.repeat(4,i=>{
      const a=i*90*DEG;
      return kit.box(0.22,3.1,1.5).rot(0,i*90,0).at(Math.sin(a)*2.25,4.8,Math.cos(a)*2.25);
    })
  ]);
  put(g,'blackened_iron',kit.cylinder(0.65,1.1,2.2,32).at(0,2.2,0));
  put(g,'dark_viewport_glass',kit.box(0.72,2.3,0.1).at(0,h-9.1,-2.3));
  put(g,'orange_marking_paint',[
    kit.cylinder(2.34,2.34,0.55,40).at(0,6.65,0),
    kit.cylinder(2.34,2.34,0.55,40).at(0,h-7.4,0)
  ]);
  for(let i=0;i<4;i++) {
    const a=(45+i*90)*DEG,c=Math.cos(a),s=Math.sin(a);
    put(g,'grey_structure_steel',[
      rod([c*1.95,5.7,s*1.95],[c*4.3,0.2,s*4.3],0.19),
      rod([c*2.1,3.6,s*2.1],[c*4.3,0.2,s*4.3],0.095),
      kit.cylinder(0.46,0.65,0.2,12).at(c*4.3,0.1,s*4.3)
    ]);
  }
  finish(name,g,x,z,0,PAD_Y);
}
function rover(name,x,z,yaw) {
  const g={};
  put(g,'grey_structure_steel',[
    kit.box(2.45,0.45,4.7).at(0,1.22,0),
    kit.box(2.4,0.15,2).at(0,1.55,1.25),
    ...kit.repeat(3,i=>rod([-1.5,0.65,(i-1)*1.65],[1.5,0.65,(i-1)*1.65],0.11)),
    rod([-1.15,1.75,2.2],[-1.15,2.15,0.35],0.06),
    rod([1.15,1.75,2.2],[1.15,2.15,0.35],0.06)
  ]);
  put(g,'white_insulation_fabric',[
    kit.box(2.05,1.4,2).at(0,2.2,-1.2),
    kit.box(2.2,0.16,2.2).at(0,2.98,-1.2),
    kit.box(1.6,0.7,1.2).at(0,1.98,1.25)
  ]);
  put(g,'black_rubber',kit.repeat(6,i=>kit.cylinder(0.65,0.65,0.42,16).rot(0,0,90).at(i<3?-1.47:1.47,0.65,(i%3-1)*1.65)));
  put(g,'grey_structure_steel',kit.repeat(6,i=>kit.cylinder(0.32,0.32,0.45,12).rot(0,0,90).at(i<3?-1.47:1.47,0.65,(i%3-1)*1.65)));
  put(g,'dark_viewport_glass',[
    kit.box(1.78,0.83,0.06).at(0,2.27,-2.23),
    kit.box(0.06,0.78,1.4).at(-1.05,2.27,-1.25),
    kit.box(0.06,0.78,1.4).at(1.05,2.27,-1.25)
  ]);
  put(g,'orange_marking_paint',kit.box(1.8,0.22,0.05).at(0,1.65,-2.25));
  put(g,'white_lamp_light',[
    kit.box(0.3,0.18,0.06).at(-0.75,1.5,-2.39),
    kit.box(0.3,0.18,0.06).at(0.75,1.5,-2.39)
  ]);
  put(g,'grey_structure_steel',rod([0.8,2.99,-0.4],[0.8,3.65,-0.4],0.025));
  finish(name,g,x,z,yaw);
}
function pointSegmentDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
function openGround(x,z) {
  const rects=[[47,0,19,21],[10,-43,13,14],[43,-43,13,14],[-53,-49,20,16],[-17,10,11,10],[-68,10,5,5],[-12,20,5,5],[-56,8,5,5],[-60,40,10,4],[-73,54,5,5]];
  for(const r of rects)if(Math.abs(x-r[0])<r[2]&&Math.abs(z-r[1])<r[3])return false;
  if(Math.hypot(x+40,z-10)<8)return false;
  for(const h of HAB) {
    if(Math.abs(x-h[0])<9&&Math.abs(z-h[1])<7)return false;
    const e=corridorEnds(h[0],h[1]);
    if(pointSegmentDistance(x,z,e[0],e[1])<3.2)return false;
  }
  for(const rx of [12,42,72])if(Math.hypot(x-rx,z-48)<11)return false;
  for(const p of ROUTES)for(let i=1;i<p.length;i++)if(pointSegmentDistance(x,z,p[i-1],p[i])<3.4)return false;
  return true;
}
//@@
kit.object('ENV_lunar_site').add(kit.terrain(180,140,0.5,{seed:731,flat:101,roughness:0.75}),'grey_regolith_dirt').commit();
//@@
kit.object('ENV_distant_lunar_highlands').add(kit.terrain(560,440,18,{seed:914,flat:122,roughness:0.88}).at(0,-0.4,0),'grey_regolith_dirt').commit();
//@@
{
  const g={};
  const craters=[[-80,-51,5,8],[-85,4,3,7],[-58,59,8,5],[82,-47,4.2,8]];
  for(let c=0;c<craters.length;c++) {
    const q=craters[c];
    put(g,'grey_regolith_dirt',kit.repeat(12,i=>{
      const a=i*30*DEG;
      return kit.terrain(3.2,3.1,0.45+0.25*hash(i,c+1),{seed:400+c*20+i,flat:0,roughness:0.5}).rot(0,-i*30,0).at(q[0]+Math.cos(a)*q[2],0,q[1]+Math.sin(a)*q[3]);
    }));
  }
  finish('ENV_shallow_perimeter_crater_rims',g);
}
//@@
{
  const g={};
  ROUTES.forEach(p=>put(g,'compacted_regolith_dirt',lineParts(p,3.6)));
  finish('ENV_compacted_service_tracks',g);
}
//@@
{
  const g={};
  for(const path of ROUTES) {
    for(let i=1;i<path.length;i++) {
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
      const nx=dz/l,nz=-dx/l,yaw=Math.atan2(dx,dz)/DEG;
      for(const side of [-1,1]) {
        put(g,'grey_regolith_dirt',kit.box(0.14,0.006,l).rot(0,yaw,0).at((a[0]+b[0])/2+side*nx*1.08,0.027,(a[1]+b[1])/2+side*nz*1.08));
        for(let j=0;j<Math.floor(l/1.1);j++) {
          const t=(j+0.5)/Math.floor(l/1.1);
          put(g,'compacted_regolith_dirt',kit.box(0.33,0.005,0.065).rot(0,yaw+12,0).at(a[0]+dx*t+side*nx*1.08,0.032,a[1]+dz*t+side*nz*1.08));
        }
      }
    }
  }
  finish('ENV_rover_wheel_impressions',g);
}
//@@
{
  const g={};
  let n=0;
  for(let i=0;i<480&&n<110;i++) {
    const x=-87+174*hash(i,3),z=-67+134*hash(i,8);
    if(!openGround(x,z))continue;
    const r=0.12+0.7*hash(i,17);
    put(g,'pale_lunar_rock',kit.sphere(r,5).scale([1.2+hash(i,1),0.55+hash(i,2)*0.45,0.8+hash(i,7)]).rot(8,i*73,12).at(x,r*0.28,z));
    n++;
  }
  finish('ENV_scattered_lunar_rocks',g);
}
//@@
{
  const g={};
  const rocks=[[82,-64,2.2],[74,-65,1.4],[62,-65,1.1],[87,-27,1.8],[-83,-32,1.5],[-76,65,2.1],[88,64,2.4],[-29,65,1.4],[56,66,1.2],[86,5,1.5]];
  rocks.forEach((p,i)=>put(g,'pale_lunar_rock',kit.sphere(p[2],6).scale([1.3,0.7,1.05]).rot(12,i*41,8).at(p[0],p[2]*0.33,p[1])));
  finish('ENV_foreground_and_horizon_boulders',g);
}
//@@
{
  const g={};
  put(g,'white_insulation_fabric',[
    kit.cylinder(5.9,5.9,5.8,48).at(0,3.7,0),
    kit.cylinder(5.9,6,0.4,48).at(0,6.8,0)
  ]);
  put(g,'grey_structure_steel',[
    kit.cylinder(6,6,0.28,48).at(0,0.94,0),
    kit.torus(5.94,0.12,360,48).rot(90,0,0).at(0,6.52,0),
    ...kit.repeat(8,i=>{
      const a=i*45*DEG;
      return kit.box(1.35,0.8,1.35).at(Math.sin(a)*4.7,0.4,Math.cos(a)*4.7);
    }),
    ...kit.repeat(18,i=>{
      const a=i*20*DEG;
      return kit.box(0.14,5.52,0.14).rot(0,i*20,0).at(Math.sin(a)*5.92,3.72,Math.cos(a)*5.92);
    }),
    ...kit.repeat(18,i=>{
      const a=i*20*DEG;
      return kit.box(1.15,0.95,0.18).rot(0,i*20,0).at(Math.sin(a)*5.94,4.9,Math.cos(a)*5.94);
    })
  ]);
  put(g,'dark_viewport_glass',kit.repeat(18,i=>{
    const a=i*20*DEG;
    return kit.box(0.95,0.67,0.04).rot(0,i*20,0).at(Math.sin(a)*6.045,4.9,Math.cos(a)*6.045);
  }));
  put(g,'orange_marking_paint',kit.cylinder(5.965,5.965,0.22,48).at(0,5.9,0));
  finish('ENV_sealed_command_hub',g,-40,10);
}
//@@
habitat('ENV_habitat_southwest',-65,-15,'west');
//@@
habitat('ENV_habitat_south',-40,-15,'south');
//@@
habitat('ENV_habitat_southeast',-15,-15,'east');
//@@
habitat('ENV_habitat_northwest',-65,30,'west');
//@@
habitat('ENV_habitat_north',-40,38,'north');
//@@
habitat('ENV_habitat_northeast',-15,30,'east');
//@@
corridor('ENV_corridor_southwest',-65,-15);
//@@
corridor('ENV_corridor_south',-40,-15);
//@@
corridor('ENV_corridor_southeast',-15,-15);
//@@
corridor('ENV_corridor_northwest',-65,30);
//@@
corridor('ENV_corridor_north',-40,38);
//@@
corridor('ENV_corridor_northeast',-15,30);
//@@
{
  const g={};
  put(g,'white_insulation_fabric',kit.box(4.6,3.5,3.8).at(0,2.95,0));
  put(g,'grey_structure_steel',[
    kit.box(4.8,0.2,4).at(0,4.8,0),
    kit.box(4.8,0.22,4).at(0,1.1,0),
    ...kit.repeat(4,i=>kit.box(0.7,1,0.7).at(i<2?-1.7:1.7,0.5,i%2?-1.35:1.35)),
    kit.box(0.15,3.5,3.95).at(1.8,2.95,0)
  ]);
  door(g,2.34,0,90,1.2);
  finish('ENV_eastern_airlock',g,-32,10);
}
//@@
rectangularPad('ENV_transport_pad',47,0,34,38,13.3);
//@@
rectangularPad('ENV_shuttle_west_pad',10,-43,22,24,8.2);
//@@
rectangularPad('ENV_shuttle_east_pad',43,-43,22,24,8.2);
//@@
rocketPad('ENV_rocket_west_pad',12,48);
//@@
rocketPad('ENV_rocket_middle_pad',42,48);
//@@
rocketPad('ENV_rocket_east_pad',72,48);
//@@
transport('MACH_hero_lunar_transport',47,0);
//@@
shuttle('MACH_parked_shuttle_west',10,-43);
//@@
shuttle('MACH_parked_shuttle_east',43,-43);
//@@
rocket('MACH_upright_rocket_west',12,48,24);
//@@
rocket('MACH_upright_rocket_middle',42,48,28);
//@@
rocket('MACH_upright_rocket_east',72,48,24);
//@@
{
  const g={},a=15*DEG,b=-28*DEG;
  function panelPoint(x,y,z) {
    const qx=x*Math.cos(a)-y*Math.sin(a),qy=x*Math.sin(a)+y*Math.cos(a);
    return [qx,qy*Math.cos(b)-z*Math.sin(b),qy*Math.sin(b)+z*Math.cos(b)];
  }
  for(let i=0;i<12;i++) {
    const x=-68.5+(i%4)*9,z=-57+Math.floor(i/4)*9;
    const l=panelPoint(-2,-0.16,0),r=panelPoint(2,-0.16,0);
    const lp=[x+l[0],2.4+l[1],z+l[2]],rp=[x+r[0],2.4+r[1],z+r[2]];
    put(g,'grey_structure_steel',[
      kit.box(6.4,0.2,4.6).rot(-28,0,15).at(x,2.4,z),
      rod([x-2,0.15,z+1.25],lp,0.1),
      rod([x+2,0.15,z+1.25],rp,0.1),
      rod(lp,rp,0.09),
      kit.box(5,0.2,2.7).at(x,0.1,z)
    ]);
    const q=panelPoint(0,0.13,0);
    put(g,'dark_solar_glass',kit.box(6.12,0.05,4.32).rot(-28,0,15).at(x+q[0],2.4+q[1],z+q[2]));
    for(let j=1;j<6;j++) {
      const v=panelPoint(-3.06+j*1.02,0.17,0);
      put(g,'grey_structure_steel',kit.box(0.025,0.025,4.32).rot(-28,0,15).at(x+v[0],2.4+v[1],z+v[2]));
    }
    for(let j=1;j<4;j++) {
      const v=panelPoint(0,0.17,-2.16+j*1.08);
      put(g,'grey_structure_steel',kit.box(6.12,0.025,0.025).rot(-28,0,15).at(x+v[0],2.4+v[1],z+v[2]));
    }
  }
  finish('MACH_twelve_tilted_solar_panels',g);
}
//@@
rover('MACH_utility_rover_west',-68,10,15);
//@@
rover('MACH_utility_rover_east',-12,20,-25);
//@@
{
  const g={};
  for(let i=0;i<24;i++) {
    const x=-23+(i%6)*2.65,z=5+Math.floor(i/6)*3.1;
    put(g,'worn_cargo_metal_plate',kit.box(2.15,1.9,2.35).at(x,1.11,z));
    put(g,'grey_structure_steel',[
      kit.box(2.28,0.16,2.5).at(x,0.08,z),
      ...kit.repeat(4,j=>kit.box(0.09,2,0.09).at(x+(j<2?-1.08:1.08),1.1,z+(j%2?-1.18:1.18)))
    ]);
    for(const s of [-0.68,0.68]) {
      put(g,'black_rubber',[
        kit.box(0.1,0.055,2.48).at(x+s,2.09,z),
        kit.box(0.1,1.97,0.045).at(x+s,1.1,z-1.2),
        kit.box(0.1,1.97,0.045).at(x+s,1.1,z+1.2)
      ]);
    }
    put(g,'orange_marking_paint',kit.box(0.42,0.26,0.035).at(x+0.2,1.38,z-1.205));
  }
  finish('PRP_twenty_four_secured_cargo_crates',g);
}
//@@
{
  const g={};
  put(g,'grey_structure_steel',[
    kit.box(4.8,0.25,5.8).at(0,0.125,0),
    kit.box(4.6,0.2,0.25).at(0,3.5,-1.45),
    kit.box(4.6,0.2,0.25).at(0,3.5,1.45),
    ...kit.repeat(4,i=>kit.box(0.18,3.5,0.18).at(i<2?-2.2:2.2,1.9,i%2?-1.45:1.45))
  ]);
  put(g,'white_insulation_fabric',kit.repeat(4,i=>kit.lathe([[0.48,0.25],[0.82,0.55],[0.82,3.25],[0.5,3.65]],24).at(i<2?-1.05:1.05,0,i%2?-1.35:1.35)));
  put(g,'grey_structure_steel',[
    rod([-1.05,3.65,-1.35],[-1.05,3.65,1.35],0.07),
    rod([1.05,3.65,-1.35],[1.05,3.65,1.35],0.07),
    rod([-1.05,3.65,0],[1.05,3.65,0],0.07)
  ]);
  finish('MACH_habitat_life_support_rack',g,-56,8);
}
//@@
{
  const g={};
  put(g,'grey_structure_steel',[
    kit.box(4,0.25,4).at(0,0.125,0),
    kit.cylinder(0.2,0.32,4.4,16).at(0,2.45,0),
    rod([-1.6,0.25,0],[0,3.8,0],0.1),
    rod([1.6,0.25,0],[0,3.8,0],0.1)
  ]);
  put(g,'white_insulation_fabric',kit.lathe([[0,0],[0.5,0.04],[1.1,0.2],[1.8,0.55],[2.5,1.1]],40).rot(-28,0,0).at(0,4.5,0));
  put(g,'grey_structure_steel',[
    rod([0,4.5,0],[0,6.7,-1.1],0.07),
    kit.box(0.34,0.3,0.4).at(0,6.7,-1.1)
  ]);
  finish('MACH_deep_space_communications_dish',g,-73,54);
}
//@@
{
  const g={};
  for(let i=0;i<4;i++) {
    const x=-6+i*4;
    put(g,'pale_radiator_metal_plate',kit.box(3.1,3.4,0.22).at(x,2.45,0));
    put(g,'grey_structure_steel',[
      kit.box(3.35,0.16,1.8).at(x,0.08,0),
      kit.box(0.16,0.8,0.25).at(x,0.48,0),
      ...kit.repeat(9,j=>kit.box(0.045,3.2,0.04).at(x-1.35+j*0.3375,2.45,-0.14))
    ]);
  }
  put(g,'grey_structure_steel',kit.tube([[-7,0.35,0.8],[-7,0.35,1.4],[7,0.35,1.4],[7,0.35,0.8]],0.09,32));
  finish('MACH_habitat_thermal_radiator_bank',g,-60,40);
}
//@@
{
  const g={};
  put(g,'black_rubber',kit.tube([[-35,0.065,-47],[-31,0.065,-44],[-28,0.065,-29],[-2,0.065,-25],[-2,0.065,-1],[-26,0.065,-1],[-27,0.065,8],[-30,0.065,8]],0.065,96));
  put(g,'grey_structure_steel',[
    kit.box(1.3,0.9,0.8).at(-33,0.45,-45),
    kit.box(0.7,0.45,0.6).at(-27,0.225,8)
  ]);
  finish('PRP_surface_power_distribution',g);
}
//@@
{
  const g={};
  FLOODS.forEach(f=>{
    const yaw=Math.atan2(f[2]-f[0],f[3]-f[1])/DEG,a=yaw*DEG;
    put(g,'grey_structure_steel',[
      kit.box(0.65,0.15,0.65).at(f[0],PAD_Y+0.075,f[1]),
      kit.cylinder(0.085,0.12,3.4,12).at(f[0],PAD_Y+1.85,f[1]),
      kit.box(0.95,0.45,0.32).rot(0,yaw,0).at(f[0],PAD_Y+3.775,f[1])
    ]);
    put(g,'white_lamp_light',kit.repeat(3,i=>{
      const dx=(i-1)*0.24;
      return kit.box(0.18,0.26,0.035).rot(0,yaw,0).at(f[0]+dx*Math.cos(a)+0.18*Math.sin(a),PAD_Y+3.775,f[1]-dx*Math.sin(a)+0.18*Math.cos(a));
    }));
  });
  finish('PRP_twelve_operational_pad_floodlight_masts',g);
}
//@@
kit.light('LGT_low_lunar_sun',{type:'directional',pos:[-130,52,-160],target:[0,0,0],color:'#fff2df',intensity:2.7});
//@@
kit.light('LGT_regolith_bounce',{type:'area',pos:[15,2,-65],target:[-10,8,10],color:'#bec2c8',intensity:2,width:100,height:45});
//@@
kit.light('LGT_transport_flood_south',{type:'spot',pos:[32,3.955,-17],target:[47,2,0],color:'#fff1da',intensity:28,distance:46,angleDeg:58});
//@@
kit.light('LGT_transport_flood_north',{type:'spot',pos:[62,3.955,17],target:[47,2,0],color:'#fff1da',intensity:28,distance:46,angleDeg:58});
//@@
kit.light('LGT_shuttle_west_flood_south',{type:'spot',pos:[1,3.955,-53],target:[10,1,-43],color:'#fff1da',intensity:20,distance:32,angleDeg:58});
//@@
kit.light('LGT_shuttle_west_flood_north',{type:'spot',pos:[19,3.955,-33],target:[10,1,-43],color:'#fff1da',intensity:20,distance:32,angleDeg:58});
//@@
kit.light('LGT_shuttle_east_flood_south',{type:'spot',pos:[34,3.955,-53],target:[43,1,-43],color:'#fff1da',intensity:20,distance:32,angleDeg:58});
//@@
kit.light('LGT_shuttle_east_flood_north',{type:'spot',pos:[52,3.955,-33],target:[43,1,-43],color:'#fff1da',intensity:20,distance:32,angleDeg:58});
//@@
kit.light('LGT_rocket_west_flood_south',{type:'spot',pos:[5.6,3.955,42.5],target:[12,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.light('LGT_rocket_west_flood_north',{type:'spot',pos:[18.4,3.955,53.5],target:[12,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.light('LGT_rocket_middle_flood_south',{type:'spot',pos:[35.6,3.955,42.5],target:[42,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.light('LGT_rocket_middle_flood_north',{type:'spot',pos:[48.4,3.955,53.5],target:[42,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.light('LGT_rocket_east_flood_south',{type:'spot',pos:[65.6,3.955,42.5],target:[72,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.light('LGT_rocket_east_flood_north',{type:'spot',pos:[78.4,3.955,53.5],target:[72,3,48],color:'#fff1da',intensity:23,distance:30,angleDeg:54});
//@@
kit.camera('CAM_main',{pos:[105,65,-115],lookAt:[0,4,0],fov:46});
//@@
kit.camera('CAM_advance',{pos:[91,57,-100],lookAt:[0,4,0],fov:46});
//@@
kit.camera('CAM_transport',{pos:[27,6,-24],lookAt:[47,4.5,0],fov:48});
//@@