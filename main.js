import * as THREE from 'three';

//Dimensions assuming u:1 = 1m

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

const geometry = new THREE.PlaneGeometry( 100, 100);
const material = new THREE.MeshPhongMaterial({
  map: texture,
  side: THREE.DoubleSide,
});
const plane = new THREE.Mesh( geometry, material );

const color = 0xFFffff;
const intensity = 1;
const light = new THREE.AmbientLight(color, intensity);
scene.add(light);

plane.rotation.x = Math.PI / 2; 
scene.add( plane );

const northWall = new THREE.BoxGeometry( 10, 10, 10 );
scene.add(northWall)

camera.position.z = 2;
camera.position.y = 1.8;

function animate( time ) {
    renderer.render( scene, camera );
    window.addEventListener('keydown', (e) => {
        if (e.key === 'w') {
            camera.position.z -= 0.0002
        }
        if (e.key === 's') {
            camera.position.z += 0.0002
        }
        if (e.key === 'd') {
            camera.position.x += 0.0002
        }
        if (e.key === 'a') {
            camera.position.x -= 0.0002
        }
    })
}
renderer.setAnimationLoop( animate );