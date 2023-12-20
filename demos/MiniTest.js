import*as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import CSG from "../three-csg.js"
import UI from "../v2/ui.js"
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js"
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js"
let glbLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('../lib/draco/');
glbLoader.setDRACOLoader(dracoLoader);

let renderer = new THREE.WebGLRenderer({antialias:true})
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x404040)
let domElement = renderer.domElement;
container.appendChild(domElement)
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();
camera.position.set(2, 2, 2)
let controls = new OrbitControls(camera,container)

UI({
    renderer,
    scene,
    camera
})

let {abs, sin, cos, min, max, random} = Math;

let light = new THREE.DirectionalLight();
light.position.set(100, 100, 100)
scene.add(light)
let ambi = new THREE.AmbientLight();
scene.add(ambi)

//import "../csg-worker.js"



function animate(time) {
    if ((domElement.prevWidth != container.clientWidth) || (domElement.prevHeight != container.clientHeight)) {
        domElement.prevWidth = container.clientWidth;
        domElement.prevHeight = container.clientHeight;
        renderer.setSize(container.clientWidth, container.clientHeight)
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

let enableShadows = (root)=>root.traverse(e=>e.isMesh && (e.receiveShadow = e.castShadow = true))

renderer.setAnimationLoop(animate)









function doCSG(a, b, op, mat, mat1=mat) {
    let bspA = CSG.fromMesh(a, 0);
    let bspB = CSG.fromMesh(b, 1);

    let bspC = bspA[op](bspB);
    let result = CSG.toMesh(bspC, a.matrix);
    result.material = [mat, mat1];
    result.castShadow = result.receiveShadow = true;
    return result;
}

new THREE.TextureLoader().load('../assets/door.jpg',(tex)=>{
    let box = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:tex}));
    let cutout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1),new THREE.MeshStandardMaterial({color:'#232323'}));
    cutout.position.set(0.45, 0, 0);
    cutout.updateMatrixWorld(true);

let cut1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, .1, 1.1),new THREE.MeshStandardMaterial({color:'#230000'}));
    
    
    let mesh = doCSG(box,cutout,'subtract',box.material,cutout.material);
    scene.add(mesh)
/*
    mesh.updateMatrixWorld(true);
    cut1.updateMatrixWorld(true);
    
    let mesh1 = doCSG(mesh,cut1,'subtract',mesh.material,cut1.material);
    scene.add(mesh1)
   */
})