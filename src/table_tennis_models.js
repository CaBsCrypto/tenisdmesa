import * as THREE from 'three';

/**
 * Procedural 3D Models for Official ITTF Table Tennis (Tenis de Mesa)
 * Table specifications: 2.74m length x 1.525m width x 0.76m height.
 * Net: 0.1525m (15.25cm) height.
 */

export const TT_SPECS = {
  TABLE_LENGTH: 2.74,     // Z: -1.37 to +1.37
  TABLE_WIDTH: 1.525,     // X: -0.7625 to +0.7625
  TABLE_HEIGHT: 0.76,     // Surface at Y = 0.76
  TABLE_THICKNESS: 0.03,  // 30mm competition board
  NET_HEIGHT: 0.1525,     // 15.25cm above table (Y: 0.76 to 0.9125)
  NET_OVERHANG: 0.1525,   // Net posts extend 15.25cm beyond table edges
  BALL_RADIUS: 0.032,     // 40mm official scale, slightly boosted for clear readability
  PLAYER_BASE_Z: 2.15,    // Server/Player baseline stance
  OPPONENT_BASE_Z: -2.15  // Opponent baseline stance
};

/**
 * Creates procedural texture for the ITTF competition tabletop with crisp lines
 */
function createTableTopTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  // ITTF Tournament Blue Surface (matte, non-reflective)
  ctx.fillStyle = '#124578';
  ctx.fillRect(0, 0, 1024, 2048);

  // Subtle table surface texture grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = 0; i < 2048; i += 8) {
    ctx.fillRect(0, i, 1024, 2);
  }

  // 2cm White border line around all 4 edges (converted to texture coordinates)
  const borderWidth = (0.02 / TT_SPECS.TABLE_WIDTH) * 1024;
  const borderHeight = (0.02 / TT_SPECS.TABLE_LENGTH) * 2048;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth / 2, borderHeight / 2, 1024 - borderWidth, 2048 - borderHeight);

  // 3mm White center line running along length (Z axis)
  const centerLineWidth = Math.max(3, (0.003 / TT_SPECS.TABLE_WIDTH) * 1024);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(512 - centerLineWidth / 2, 0, centerLineWidth, 2048);

  // Discreet ITTF Approved logo imprint in corner
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('ITTF PRO 1v1', 40, 80);
  ctx.fillText('ARGON TENNIS DE MESA', 40, 1980);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Creates procedural texture for the competition Net mesh with top white band
 */
function createNetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Clear background
  ctx.clearRect(0, 0, 512, 128);

  // Dark mesh grid
  ctx.strokeStyle = 'rgba(15, 20, 25, 0.85)';
  ctx.lineWidth = 1.5;
  const step = 8;
  for (let x = 0; x < 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  for (let y = 22; y < 128; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Official 15mm White Canvas Top Band (Tape) with cord line
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 22);
  ctx.fillStyle = '#e0e8f0';
  ctx.fillRect(0, 20, 512, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/**
 * Builds the official ITTF Table Tennis Table
 */
export function createTableTennisTable() {
  const group = new THREE.Group();
  group.name = 'TableTennisTable';

  const halfL = TT_SPECS.TABLE_LENGTH / 2; // 1.37
  const halfW = TT_SPECS.TABLE_WIDTH / 2;  // 0.7625
  const surfaceY = TT_SPECS.TABLE_HEIGHT; // 0.76
  const thick = TT_SPECS.TABLE_THICKNESS;

  // 1. Table Top (Two halves meeting at net)
  const topGeo = new THREE.BoxGeometry(TT_SPECS.TABLE_WIDTH, thick, TT_SPECS.TABLE_LENGTH);
  const topTex = createTableTopTexture();
  const topMat = new THREE.MeshStandardMaterial({
    map: topTex,
    color: 0xffffff,
    roughness: 0.38,
    metalness: 0.05
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x0e355c,
    roughness: 0.45,
    metalness: 0.1
  });

  // Material array: [right, left, top, bottom, front, back]
  const tableMaterials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  const tableMesh = new THREE.Mesh(topGeo, tableMaterials);
  tableMesh.position.set(0, surfaceY - thick / 2, 0);
  tableMesh.castShadow = true;
  tableMesh.receiveShadow = true;
  group.add(tableMesh);

  // 2. Under-frame metal apron (Dark navy steel frame under the edges)
  const apronGeo = new THREE.BoxGeometry(TT_SPECS.TABLE_WIDTH - 0.04, 0.05, TT_SPECS.TABLE_LENGTH - 0.04);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x182430,
    roughness: 0.35,
    metalness: 0.75
  });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.set(0, surfaceY - thick - 0.025, 0);
  apronMesh.castShadow = true;
  group.add(apronMesh);

  // 3. Legs & Chassis Structure
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x223242,
    roughness: 0.3,
    metalness: 0.8
  });
  const footMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8
  });

  const legGeo = new THREE.BoxGeometry(0.045, surfaceY - thick - 0.05, 0.045);
  const footGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.02, 16);

  const legOffsets = [
    [-halfW + 0.12, halfL - 0.18],
    [halfW - 0.12, halfL - 0.18],
    [-halfW + 0.12, -halfL + 0.18],
    [halfW - 0.12, -halfL + 0.18],
  ];

  legOffsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, (surfaceY - thick - 0.05) / 2, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);

    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.01, z);
    foot.castShadow = true;
    group.add(foot);
  });

  // Central Wheels & Folding Under-carriage Structure
  const centerFrameGeo = new THREE.BoxGeometry(TT_SPECS.TABLE_WIDTH * 0.7, 0.04, 0.45);
  const centerFrame = new THREE.Mesh(centerFrameGeo, legMat);
  centerFrame.position.set(0, 0.15, 0);
  centerFrame.castShadow = true;
  group.add(centerFrame);

  // 4 Wheels on central trolley
  const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.025, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6 });
  const wheelOffsets = [
    [-halfW * 0.65, 0.045, 0.18],
    [halfW * 0.65, 0.045, 0.18],
    [-halfW * 0.65, 0.045, -0.18],
    [halfW * 0.65, 0.045, -0.18],
  ];
  wheelOffsets.forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    group.add(w);
  });

  // 4. ITTF Net System
  const netTotalWidth = TT_SPECS.TABLE_WIDTH + TT_SPECS.NET_OVERHANG * 2; // ~1.83m
  const netGeo = new THREE.PlaneGeometry(netTotalWidth, TT_SPECS.NET_HEIGHT);
  const netMat = new THREE.MeshStandardMaterial({
    map: createNetTexture(),
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 0.8
  });
  const netMesh = new THREE.Mesh(netGeo, netMat);
  netMesh.position.set(0, surfaceY + TT_SPECS.NET_HEIGHT / 2, 0);
  netMesh.castShadow = true;
  group.add(netMesh);

  // Net Posts & Clamps
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x151d26,
    roughness: 0.25,
    metalness: 0.85
  });
  const postGeo = new THREE.CylinderGeometry(0.012, 0.012, TT_SPECS.NET_HEIGHT + 0.08, 16);
  const clampGeo = new THREE.BoxGeometry(0.04, 0.08, 0.04);

  [-1, 1].forEach(side => {
    const postX = side * (halfW + TT_SPECS.NET_OVERHANG);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(postX, surfaceY + TT_SPECS.NET_HEIGHT / 2, 0);
    post.castShadow = true;
    group.add(post);

    const clamp = new THREE.Mesh(clampGeo, postMat);
    clamp.position.set(side * (halfW + 0.02), surfaceY - 0.02, 0);
    clamp.castShadow = true;
    group.add(clamp);
  });

  return group;
}

/**
 * Creates procedural Table Tennis Bat (Pala de Ping Pong)
 */
export function createTableTennisPaddle() {
  const paddleGroup = new THREE.Group();
  paddleGroup.name = 'TableTennisPaddle';

  // 1. Blade Core (Oval Wooden Head)
  // Dimensions: ~17cm tall, ~15cm wide, ~1.2cm thick
  const bladeHeadGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.012, 32);
  bladeHeadGeo.scale(1.0, 1.0, 1.15); // Oval ping pong shape
  bladeHeadGeo.rotateX(Math.PI / 2);

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xd9b382,
    roughness: 0.45,
    metalness: 0.05
  });
  const bladeMesh = new THREE.Mesh(bladeHeadGeo, woodMat);
  paddleGroup.add(bladeMesh);

  // 2. Red Rubber (Forehand face, +Z)
  const rubberGeo = new THREE.CylinderGeometry(0.143, 0.143, 0.003, 32);
  rubberGeo.scale(1.0, 1.0, 1.14);
  rubberGeo.rotateX(Math.PI / 2);

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xd61f28, // Vibrant ITTF Red
    roughness: 0.28,
    metalness: 0.02
  });
  const redRubber = new THREE.Mesh(rubberGeo, redMat);
  redRubber.position.set(0, 0, 0.0075);
  paddleGroup.add(redRubber);

  // 3. Black Rubber (Backhand face, -Z)
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x161616, // ITTF Black
    roughness: 0.28,
    metalness: 0.02
  });
  const blackRubber = new THREE.Mesh(rubberGeo, blackMat);
  blackRubber.position.set(0, 0, -0.0075);
  paddleGroup.add(blackRubber);

  // 4. Edge Protection Tape (Wrap around blade circumference)
  const edgeGeo = new THREE.CylinderGeometry(0.147, 0.147, 0.014, 32, 1, true);
  edgeGeo.scale(1.0, 1.0, 1.155);
  edgeGeo.rotateX(Math.PI / 2);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x1a212b,
    roughness: 0.6
  });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
  paddleGroup.add(edgeMesh);

  // 5. Flared Handle
  const handleGeo = new THREE.BoxGeometry(0.038, 0.11, 0.024);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xba8853,
    roughness: 0.5,
    metalness: 0.05
  });
  const handleMesh = new THREE.Mesh(handleGeo, handleMat);
  handleMesh.position.set(0, -0.19, 0);
  paddleGroup.add(handleMesh);

  // Handle Comfort Grip Strip (dual tone wood layer)
  const gripStripeGeo = new THREE.BoxGeometry(0.014, 0.112, 0.026);
  const gripStripeMat = new THREE.MeshStandardMaterial({
    color: 0x3d5675,
    roughness: 0.4
  });
  const gripStripe = new THREE.Mesh(gripStripeGeo, gripStripeMat);
  gripStripe.position.set(0, -0.19, 0);
  paddleGroup.add(gripStripe);

  paddleGroup.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return paddleGroup;
}

/**
 * Creates 40mm seamless ping pong ball
 */
export function createTableTennisBall() {
  const geo = new THREE.SphereGeometry(TT_SPECS.BALL_RADIUS, 32, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.02
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Creates the competition Table Tennis Arena:
 * Red Olympic Taraflex flooring, blue tournament barriers, lighting rigs.
 */
export function createTableTennisArena() {
  const arenaGroup = new THREE.Group();
  arenaGroup.name = 'TableTennisArena';

  // 1. Flooring: Red Olympic Taraflex court mat (8m x 14m)
  const courtMatGeo = new THREE.PlaneGeometry(8.5, 15);
  courtMatGeo.rotateX(-Math.PI / 2);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b5332e'; // ITTF Olympic Red floor
  ctx.fillRect(0, 0, 512, 512);

  // Subtle grid texture
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, 512);
    ctx.moveTo(0, i); ctx.lineTo(512, i);
    ctx.stroke();
  }
  const floorTex = new THREE.CanvasTexture(canvas);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 7);
  floorTex.colorSpace = THREE.SRGBColorSpace;

  const courtMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.65,
    metalness: 0.05
  });
  const courtMesh = new THREE.Mesh(courtMatGeo, courtMat);
  courtMesh.position.y = 0.002;
  courtMesh.receiveShadow = true;
  arenaGroup.add(courtMesh);

  // Outer Gymnasium Wood Parquet Floor (extends beyond court)
  const outerFloorGeo = new THREE.PlaneGeometry(60, 60);
  outerFloorGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x9e6c43,
    roughness: 0.45,
    metalness: 0.1
  });
  const outerFloor = new THREE.Mesh(outerFloorGeo, outerMat);
  outerFloor.position.y = 0;
  outerFloor.receiveShadow = true;
  arenaGroup.add(outerFloor);

  // 2. Tournament Surrounds (Blue Court Barriers - 0.75m high)
  const barrierTex = createBarrierTexture();
  const barrierMat = new THREE.MeshStandardMaterial({
    map: barrierTex,
    roughness: 0.5,
    side: THREE.DoubleSide
  });

  const barrierConfigs = [
    // Back line behind player (+Z)
    { pos: [0, 0.38, 7.2], rotY: 0, width: 8.5 },
    // Back line behind opponent (-Z)
    { pos: [0, 0.38, -7.2], rotY: Math.PI, width: 8.5 },
    // Left side line (-X)
    { pos: [-4.2, 0.38, 0], rotY: Math.PI / 2, width: 14.4 },
    // Right side line (+X)
    { pos: [4.2, 0.38, 0], rotY: -Math.PI / 2, width: 14.4 }
  ];

  barrierConfigs.forEach(b => {
    const geo = new THREE.PlaneGeometry(b.width, 0.76);
    const m = new THREE.Mesh(geo, barrierMat);
    m.position.set(...b.pos);
    m.rotation.y = b.rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    arenaGroup.add(m);

    // Barrier top rail
    const railGeo = new THREE.BoxGeometry(b.width, 0.04, 0.04);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1a3556, roughness: 0.4 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(b.pos[0], 0.76, b.pos[2]);
    rail.rotation.y = b.rotY;
    arenaGroup.add(rail);
  });

  // 3. Umpire Table & Digital Scoreboard Stand at midcourt
  const umpireStand = createUmpireDesk();
  umpireStand.position.set(-2.8, 0, 0);
  arenaGroup.add(umpireStand);

  // 4. Towel boxes at player sides
  [-1, 1].forEach(side => {
    const boxGeo = new THREE.BoxGeometry(0.4, 0.65, 0.4);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x163456, roughness: 0.4 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(3.2, 0.325, side * 3.8);
    box.castShadow = true;
    arenaGroup.add(box);
  });

  return arenaGroup;
}

function createBarrierTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // ITTF Tournament Blue
  ctx.fillStyle = '#0f4882';
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARGON 🏓 TENIS DE MESA', 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function createUmpireDesk() {
  const group = new THREE.Group();
  const deskGeo = new THREE.BoxGeometry(0.7, 0.85, 0.9);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x192736, roughness: 0.4 });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.position.y = 0.425;
  desk.castShadow = true;
  group.add(desk);

  // Flip Scoreboard device on desk
  const scoreGeo = new THREE.BoxGeometry(0.35, 0.22, 0.4);
  const scoreMat = new THREE.MeshStandardMaterial({ color: 0x0a1017, roughness: 0.3 });
  const scoreDevice = new THREE.Mesh(scoreGeo, scoreMat);
  scoreDevice.position.set(0, 0.95, 0);
  group.add(scoreDevice);

  return group;
}
