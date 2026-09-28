import * as THREE from 'three';
const skyBoxLoader = new THREE.CubeTextureLoader();
skyBoxLoader.setPath('textures/skybox/');

let ammo = 20

//dimensõoes assumidas para escala como: 1u = 1m

//algoritimo a* (e suas dependencias)
class PathNode {
  constructor(x, z, walkable = true) {
    this.x = x;
    this.z = z;
    this.walkable = walkable;
    
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = null;
  }
}

function createGrid(width, height) {
  const grid = [];
  for (let x = 0; x < width; x++) {
    grid[x] = [];
    for (let z = 0; z < height; z++) {
      grid[x][z] = new PathNode(x, z);
    }
  }
  return grid;
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function getNeighbors(grid, node) {
  const neighbors = [];
  const dirs = [
    { x: 0, z: 1 }, { x: 0, z: -1 },
    { x: 1, z: 0 }, { x: -1, z: 0 },
    { x: 1, z: 1 }, { x: -1, z: -1 },
    { x: 1, z: -1 }, { x: -1, z: 1 },
  ];
  
  for (const dir of dirs) {
    const nx = node.x + dir.x;
    const nz = node.z + dir.z;
    if (nx >= 0 && nx < grid.length && nz >= 0 && nz < grid[0].length) {
      neighbors.push(grid[nx][nz]);
    }
  }
  return neighbors;
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(entry) {
    this.items.push(entry);
    this._bubbleUp(this.items.length - 1);
  }
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].f <= this.items[i].f) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }
  _bubbleDown(i) {
    const n = this.items.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.items[left].f < this.items[smallest].f) smallest = left;
      if (right < n && this.items[right].f < this.items[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
}

function findPath(grid, start, end) {
  const openHeap = new MinHeap();
  const closedSet = new Set();
  const inOpen = new Set();
  
  start.g = 0;
  start.h = heuristic(start, end);
  start.f = start.h;
  start.parent = null;
  openHeap.push({ node: start, f: start.f });
  inOpen.add(start);
  
  const maxIterations = grid.length * grid[0].length;
  let iterations = 0;
  
  while (openHeap.size > 0) {
    if (++iterations > maxIterations) return null;
    
    const { node: current, f: enqueuedF } = openHeap.pop();
    
    if (enqueuedF > current.f || closedSet.has(current)) continue;
    
    if (current === end) {
      // reconstruir o caminho + curto
      const path = [];
      let node = current;
      while (node) {
        path.push(node);
        node = node.parent;
      }
      return path.reverse();
    }
    
    //fecha o espaço atual
    closedSet.add(current);
    inOpen.delete(current);
    
    for (const neighbor of getNeighbors(grid, current)) {
      if (!neighbor.walkable || closedSet.has(neighbor)) continue;
      
      const isDiagonal = neighbor.x !== current.x && neighbor.z !== current.z;
      const moveCost = isDiagonal ? 1.4142 : 1;
      const tentativeG = current.g + moveCost;
      
      if (!inOpen.has(neighbor) || tentativeG < neighbor.g) {
        neighbor.g = tentativeG;
        neighbor.h = heuristic(neighbor, end);
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.parent = current;
        openHeap.push({ node: neighbor, f: neighbor.f });
        inOpen.add(neighbor);
      }
    }
  }
  
  return null; // caminho n encontrado
}

function worldToGrid(worldX, worldZ, cellSize, originX, originZ) {
  return {
    x: Math.round((worldX - originX) / cellSize),
    z: Math.round((worldZ - originZ) / cellSize),
  };
}

function gridToWorld(gridX, gridZ, cellSize, originX, originZ) {
  return {
    x: originX + gridX * cellSize,
    z: originZ + gridZ * cellSize,
  };
}

function buildGridFromBoxes(obstacleMeshes, gridWidth, gridDepth, cellSize, originX, originZ) {
  const grid = [];
  const box = new THREE.Box3();
  
  for (let x = 0; x < gridWidth; x++) {
    grid[x] = [];
    for (let z = 0; z < gridDepth; z++) {
      grid[x][z] = new PathNode(x, z, true);
    }
  }
  
  for (const mesh of obstacleMeshes) {
    box.setFromObject(mesh);
    
    const minX = Math.floor((box.min.x - originX) / cellSize);
    const maxX = Math.ceil((box.max.x - originX) / cellSize);
    const minZ = Math.floor((box.min.z - originZ) / cellSize);
    const maxZ = Math.ceil((box.max.z - originZ) / cellSize);
    
    for (let x = Math.max(0, minX); x < Math.min(gridWidth, maxX); x++) {
      for (let z = Math.max(0, minZ); z < Math.min(gridDepth, maxZ); z++) {
        grid[x][z].walkable = false;
      }
    }
  }
  
  return grid;
}

//define classe para inimigo
class Enemy {
  constructor(mesh, grid, gridConfig) {
    this.mesh = mesh;
    this.grid = grid;
    this.gridConfig = gridConfig;
    
    this.path = [];
    this.pathIndex = 0;
    this.speed = 3;
    this.rotationSpeed = 8;
    
    this.repathTimer = 0;
    this.repathInterval = 0.5;
  }
  
  setTarget(targetWorldPos) {
    const { cellSize, originX, originZ } = this.gridConfig;
    const startGrid = worldToGrid(this.mesh.position.x, this.mesh.position.z, cellSize, originX, originZ);
    const endGrid = worldToGrid(targetWorldPos.x, targetWorldPos.z, cellSize, originX, originZ);
    
    const startNode = this.grid[startGrid.x]?.[startGrid.z];
    const endNode = this.grid[endGrid.x]?.[endGrid.z];
    if (!startNode || !endNode || !endNode.walkable) return;
    
    const newPath = findPath(this.grid, startNode, endNode);
    if (newPath) {
      this.path = newPath;
      this.pathIndex = 1;
    }
  }
  
  update(deltaTime, targetWorldPos) {
    this.repathTimer += deltaTime;
    if (this.repathTimer >= this.repathInterval) {
      this.repathTimer = 0;
      this.setTarget(targetWorldPos);
    }
    
    this.followPath(deltaTime);
  }
  
  followPath(deltaTime) {
    if (!this.path.length || this.pathIndex >= this.path.length) return;
    
    const { cellSize, originX, originZ } = this.gridConfig;
    const targetNode = this.path[this.pathIndex];
    const targetWorld = gridToWorld(targetNode.x, targetNode.z, cellSize, originX, originZ);
    
    const dx = targetWorld.x - this.mesh.position.x;
    const dz = targetWorld.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    const arriveThreshold = 0.15;
    if (dist < arriveThreshold) {
      this.pathIndex++;
      return;
    }
    
    const moveStep = this.speed * deltaTime;
    const t = Math.min(moveStep / dist, 1);
    this.mesh.position.x += dx * t;
    this.mesh.position.z += dz * t;
    
    const targetAngle = Math.atan2(dx, dz);
    let angleDiff = targetAngle - this.mesh.rotation.y;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    this.mesh.rotation.y += angleDiff * Math.min(this.rotationSpeed * deltaTime, 1);
  }
}

const loader = new THREE.TextureLoader();

const wallTexture = loader.load('Textures/BKCB7_2.png')
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.magFilter = THREE.NearestFilter;
wallTexture.colorSpace = THREE.SRGBColorSpace;
wallTexture.repeat.set(10, 5);

const material = new THREE.MeshStandardMaterial( {
  map: wallTexture,
  side: THREE.DoubleSide,
} );

const enemyMaterial = new THREE.MeshStandardMaterial( { color: 0xcc8888 } );
const blocker = document.querySelector('#blocker')

let wallBoxes = [];
let wallColisionMeshes = [];
let wallMeshes = []
let isLocked = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

function buildWall(x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial());
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallBoxes.push(new THREE.Box3().setFromObject(mesh));
  wallColisionMeshes.push(mesh);
  wallMeshes.push(mesh)
}

function collides(x, z) {
  for (const box of wallBoxes) {
    if (
      x < box.max.x && x > box.min.x &&
      z < box.max.z && z > box.min.z
    ) {
      return true;
    }
  }
  return false;
}

const planeSize = 100;

const texture = loader.load('Textures/STRR1.png');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.magFilter = THREE.NearestFilter;
texture.colorSpace = THREE.SRGBColorSpace;
const repeats = planeSize / 4;
texture.repeat.set(repeats, repeats);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

//construcao do piso
const geometry = new THREE.PlaneGeometry( 100, 100);
const floorMaterial = new THREE.MeshPhongMaterial({
  map: texture,
  side: THREE.DoubleSide,
});
const plane = new THREE.Mesh( geometry, floorMaterial );

//definicao de luz
const color = 0xfcf8e4;;
const intensity = 0.2;
const light = new THREE.AmbientLight(color, intensity);
scene.add(light);

const shadowArea = 100

const directionalLight = new THREE.DirectionalLight( color, 5 );
directionalLight.position.set(100, 100, 100);
directionalLight.castShadow = true;

directionalLight.shadow.camera.left = -shadowArea;
directionalLight.shadow.camera.right = shadowArea;
directionalLight.shadow.camera.top = shadowArea;
directionalLight.shadow.camera.bottom = -shadowArea;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;

directionalLight.shadow.normalBias = 0.06; 

directionalLight.shadow.bias = -0.0005; 

scene.add( directionalLight );

// rotacao do piso com conversao de radianos
plane.rotation.x = Math.PI / 2; 
plane.receiveShadow = true;
plane.castShadow = true
scene.add( plane );

//construção das pparedes
buildWall(0, 5, -50, 100, 10, 2);
buildWall(0, 5, 50, 100, 10, 2);
buildWall(50, 5, 0, 2, 10, 100);
buildWall(-50, 5, 0, 2, 10, 100);
buildWall(0, 5, -15, 10, 10, 10)

console.log(wallColisionMeshes)

const gridConfig = { cellSize: 2, originX: -50, originZ: -50 };
const grid = buildGridFromBoxes(
  wallColisionMeshes,
  Math.round(planeSize / gridConfig.cellSize),
  Math.round(planeSize / gridConfig.cellSize),
  gridConfig.cellSize,
  gridConfig.originX,
  gridConfig.originZ
);

//criação do *rig* do personagem¹
const playerRig = new THREE.Object3D(); //cria player com um *transform node* generico sem mesh
playerRig.position.set(0, 1.6, 10);
playerRig.add(camera); //adiciona camera como child do player
scene.add(playerRig); //adiciona player a cena

//criacao da arma
const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 0.15, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x444444 })
);
gun.position.set(0.3, -0.25, -0.6);
gun.receiveShadow = true;
gun.castShadow = true
camera.add(gun);

let muzzleFlash = new THREE.PointLight(0xffaa33, 0, 4);
muzzleFlash.position.set(0.3, -0.2, -1.1);
camera.add(muzzleFlash);

//requisição do pointer lock quando o blocker da pagina eh clicado
blocker.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

//deteccao da perda de pointer lock, vai ser necessaria pra um overlay esperando o foco
document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  blocker.style.display = isLocked ? 'none' : 'flex'
  console.log(isLocked ? 'got mouse lock' : 'lost mouse lock')
});

//movimentacao da camera
const MOUSE_SENSITIVITY = 0.002
const PITCH_LIMIT = 1.4 //limite de rotacao vertical em radianos
document.addEventListener('mousemove', (e) => {
  if (!isLocked) return;
  playerRig.rotation.y -= e.movementX * MOUSE_SENSITIVITY;
  camera.rotation.x -= e.movementY * MOUSE_SENSITIVITY;
  camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x)); //limitacao de rotacao vertical (ao longo do eixo x)
});

const keys = { w: false, a: false, s: false, d: false, space: false };
document.addEventListener('keydown', (e) => setKey(e.code, true));
document.addEventListener('keyup', (e) => setKey(e.code, false));
function setKey(code, value) {
  if (code === 'KeyW') { keys.w = value; }
  if (code === 'KeyA') { keys.a = value; }
  if (code === 'KeyS') { keys.s = value; }
  if (code === 'KeyD') { keys.d = value; }
  if (code === 'Space') { keys.space = value;}
}

//skybox

const newSkybox = skyBoxLoader.load([
  'pngegg_posx.png', 'pngegg_negx.png', 
  'pngegg_posy.png', 'pngegg_negy.png', 
  'pngegg_posz.png', 'pngegg_negz.png'
]);

scene.background = newSkybox;

//definicao do inimigo

const ENEMY_COUNT = 5;
const enemies = [];

function randomEnemyPosition() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 34,
    1,
    (Math.random() - 0.5) * 34
  );
}

for (let i = 0; i < ENEMY_COUNT; i++) {
  const enemyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), enemyMaterial);
  enemyMesh.position.copy(randomEnemyPosition());
  enemyMesh.name = 'enemy'
  enemyMesh.castShadow = true;
  enemyMesh.receiveShadow = true;
  scene.add(enemyMesh);
  
  const enemy = new Enemy(enemyMesh, grid, gridConfig);
  enemies.push(enemy);
}

//shooting
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const ammoCounterEl = document.querySelector('#ammo-count')
function shoot() {
  if (ammo >= 1) {
    const fireSFx = new Audio('SFx/mixkit-game-gun-shot-1662.mp3');
    fireSFx.play();
    raycaster.setFromCamera(screenCenter, camera);
    const hits = raycaster.intersectObjects(enemies.map(e => e.mesh).concat(wallMeshes));
    muzzleFlash.intensity = 1000
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      console.log(hitMesh)
      if (hitMesh.name === "enemy") {
        hitMesh.position.copy(randomEnemyPosition());
      }
    }
    ammo -= 1;
  } else {
    const noAmmoSFx = new Audio('SFx/freesound_community-empty-gun-shot-6209.mp3');
    noAmmoSFx.play();
    console.log('empty')
  }
  ammoCounterEl.innerHTML = `Ammo: ${ammo}`
}

let isJumping = false
let verticalG = 0.03
const MOVE_SPEED = 0.01
function updateMovement(delta) {
  if (!isLocked) return;
  //permite movimentacao na direcao da camera com trigonometria que eu nao intendo
  const forward = new THREE.Vector3(Math.sin(playerRig.rotation.y), 0, Math.cos(playerRig.rotation.y));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = new THREE.Vector3();
  if (keys.w) move.sub(forward);
  if (keys.s) move.add(forward);
  if (keys.a) move.sub(right);
  if (keys.d) move.add(right)
  if (keys.space && isJumping === false) {
    verticalG = -0.1
    isJumping = true
  };
  
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(MOVE_SPEED * delta);
    const nextX = playerRig.position.x + move.x;
    const nextZ = playerRig.position.z + move.z;
    if (!collides(nextX, playerRig.position.z)) {playerRig.position.x = nextX;}
    if (!collides(playerRig.position.x, nextZ)) {playerRig.position.z = nextZ;}
  }

  if(playerRig.position.y > 1.8) {
    isJumping = true;
  }
  if (playerRig.position.y < 1.8) {
    playerRig.position.y = 1.8;
    verticalG = 0;
    isJumping = false;
  }
  playerRig.position.y -= verticalG
  if (isJumping === true) {
    verticalG += 0.001;
  }
}

document.addEventListener('mousedown', (e) => {
  shoot();
})
document.addEventListener('keypress', (e) => {
  if (e.code === 'KeyR') {
    const reloadSFx = new Audio('SFx/freesound_community-1911-reload-6248.mp3');
    ammo = 20;
    reloadSFx.play();
    ammoCounterEl.innerHTML = `Ammo: ${ammo}`
  }
})

const clock = new THREE.Clock();

function animate() {
  const deltaTime = clock.getDelta();
  
  if (isLocked) {
    updateMovement(5);
  
    const playerWorldPos = playerRig.position;
    for (const enemy of enemies) {
      enemy.update(deltaTime, playerWorldPos);
    }
    if (muzzleFlash.intensity > 0) {
      muzzleFlash.intensity -= 250
    }
    
    renderer.render(scene, camera);
  }
  
}
renderer.setAnimationLoop( animate );