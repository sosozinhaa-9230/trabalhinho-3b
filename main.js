import * as THREE from 'three';

//dimensõoes assumidas para escala como: 1u = 1m

const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const enemyMaterial = new THREE.MeshBasicMaterial( { color: 0xaaaaaa } );
const blocker = document.querySelector('#blocker')

let wallColisionMeshes = [];
let isLocked = false;

function buildWall(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    wallColisionMeshes.push(new THREE.Box3().setFromObject(mesh));
}

function collides(x, z) {
    for (const box of wallColisionMeshes) {
        if (
            x < box.max.x && x > box.min.x &&
            z < box.max.z && z > box.min.z
        ) {
            return true;
        }
    }
    return false;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const planeSize = 100;

const loader = new THREE.TextureLoader();
const texture = loader.load('Textures/checker.png');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.magFilter = THREE.NearestFilter;
texture.colorSpace = THREE.SRGBColorSpace;
const repeats = planeSize / 4;
texture.repeat.set(repeats, repeats);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


//construcao do piso
const geometry = new THREE.PlaneGeometry( 100, 100);
const floorMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
});
const plane = new THREE.Mesh( geometry, floorMaterial );

//definicao de luz
const color = 0xFFffff;
const intensity = 1;
const light = new THREE.AmbientLight(color, intensity);
scene.add(light);

// rotacao do piso com conversao de radianos
plane.rotation.x = Math.PI / 2; 
scene.add( plane );

//construção das pparedes
buildWall(0, 5, -50, 100, 10, 2);
buildWall(0, 5, 50, 100, 10, 2);
buildWall(50, 5, 0, 2, 10, 100);
buildWall(-50, 5, 0, 2, 10, 100);

console.log(wallColisionMeshes)

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
camera.add(gun);

const muzzleFlash = new THREE.PointLight(0xffaa33, 0, 4);
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

const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', (e) => setKey(e.code, true));
document.addEventListener('keyup', (e) => setKey(e.code, false));
function setKey(code, value) {
    if (code === 'KeyW') { keys.w = value; }
    if (code === 'KeyA') { keys.a = value; }
    if (code === 'KeyS') { keys.s = value; }
    if (code === 'KeyD') { keys.d = value; }
}

//definicao do inimigo

const ENEMY_COUNT = 1;
const enemies = [];

function randomEnemyPosition() {
    return new THREE.Vector3(
        (Math.random() - 0.5) * 34,
        1,
        (Math.random() - 0.5) * 34
    );
}

for (let i = 0; i < ENEMY_COUNT; i++) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1), enemyMaterial.clone());
    mesh.position.copy(randomEnemyPosition());
    scene.add(mesh);
    enemies.push(mesh);
}

//shooting
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function shoot() {
    raycaster.setFromCamera(screenCenter, camera);
    const hits = raycaster.intersectObjects(enemies);
    if (hits.length > 0) {
        const hitMesh = hits[0].object;
        hitMesh.position.copy(randomEnemyPosition());
    }
}

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
    if (keys.d) move.add(right);
    
    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(MOVE_SPEED * delta);
        const nextX = playerRig.position.x + move.x;
        const nextZ = playerRig.position.z + move.z;
        if (!collides(nextX, playerRig.position.z)) playerRig.position.x = nextX;
        if (!collides(playerRig.position.x, nextZ)) playerRig.position.z = nextZ;
    }
}

document.addEventListener('mousedown', (e) => {
    shoot()
})

function animate( time ) {
    renderer.render( scene, camera );
    updateMovement(5)
}
renderer.setAnimationLoop( animate );