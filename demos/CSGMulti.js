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

let renderer = new THREE.WebGLRenderer()
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x404040)
let domElement = renderer.domElement;
container.appendChild(domElement)
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();
camera.position.set(10, 10, 10)
let controls = new OrbitControls(camera,container)

UI({
    renderer,
    scene,
    camera
})

let {abs, sin, cos, min, max, random} = Math;

let mkMat = (color='white')=>new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.51,
    metalness: 0.7,
    roughnessMap: tx,
    vertexColors:true
});
function mkCanvas(dim) {
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = dim;
    return canvas;
}
function makeProceduralTexture(dim, fn) {
    var canv = mkCanvas(dim);
    var ctx = canv.getContext("2d");
    var pix = ctx.getImageData(0, 0, dim, dim);
    var u32view = new DataView(pix.data.buffer);
    var idx = -4;
    for (var j = 0; j < dim; j++)
        for (var i = 0; i < dim; i++)
            u32view.setUint32((idx += 4), fn(j / dim, i / dim) | 0);
    ctx.putImageData(pix, 0, 0);
    var tex = new THREE.Texture(canv);
    tex.needsUpdate = true;
    return tex;
}
let tx = makeProceduralTexture(256, (u,v)=>{
    let rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    return (rb * 256) | (rb * 256 * 256) | (rb * 256 * 256 * 256) | 0x000000ff
}
)
tx.repeat.set(2, 2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

let tx1 = makeProceduralTexture(256, (u,v)=>{
    let rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    let r = (abs(sin(v * 3)) * 256) | 0
    let g = (abs(cos(u * 4)) * 256) | 0
    let b = (abs(sin(v * 5)) * 256) | 0
    return (r * 256) | (g * 256 * 256) | (b * 256 * 256 * 256) | 0x000000ff
}
)

let sphereGeom = new THREE.SphereGeometry(1.2,8,8)

let box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mkMat('blue'))
let sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),mkMat('red'))


scene.add(box)
scene.add(sphere)

let addColors = geometry=>{
    let colors = geometry.attributes.position.array.slice(0)
    for (let i = 0; i < colors.length; i++)
        colors[i] = random()
    geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
}
addColors(box.geometry)
addColors(sphere.geometry)

//import "../csg-worker.js"

function doCSG(a, b, op, mat, mat1=mat) {
    let bspA = CSG.fromMesh(a, 0);
    let bspB = CSG.fromMesh(b, 1);

    let bspC = bspA[op](bspB);
    let result = CSG.toMesh(bspC, a.matrix);
    result.material = [mat, mat1];
    result.castShadow = result.receiveShadow = true;
    scene.add(result)
    return result;
}

let difMaterial = mkMat('grey', tx1)
let subMaterial = mkMat('red')
let intersectMaterial = mkMat('green')
let unionMaterial = mkMat('blue');
let results = []

let workerBusy = false;

function recompute() {

    box.updateMatrix();
    sphere.updateMatrix();

            for (let i = 0; i < results.length; i++) {
                let m = results[i]
                m.parent.remove(m)
                m.geometry.dispose();
            }
            results = [];

      results.push(doCSG(box,sphere,'subtract',subMaterial,difMaterial))
      results.push(doCSG(box,sphere,'intersect',intersectMaterial,difMaterial))
      results.push(doCSG(box,sphere,'union',unionMaterial,difMaterial))
    if(0)if (!workerBusy) {
        //  workerBusy=true

        return CSG.doAsync(CSG.fromMesh(sphere, 0), 'subtract', CSG.fromMesh(box, 1)).then(bspC=>{

            for (let i = 0; i < results.length; i++) {
                let m = results[i]
                m.parent.remove(m)
                m.geometry.dispose();
            }
            results = [];

            let result = CSG.toMesh(bspC, box.matrix);
            result.material = [sphere.material, box.material];
            result.castShadow = result.receiveShadow = true;
            scene.add(result)
            results.push(result)
            return result;
        }
        )

        //    results.push(doCSG(sphere,box,'subtract',difMaterial,subMaterial))

    }
    //return
    //   results.push(doCSG(sphere,box,'intersect',difMaterial,intersectMaterial))
    //  results.push(doCSG(sphere,box,'union',difMaterial,unionMaterial))

    for (let i = 0; i < results.length; i++) {
        let r = results[i];
        scene.add(r)

        r.position.z = -5 + ((i % 3) * 5)
        r.position.x = -5 + (((i / 3) | 0) * 10)
    }
}

let light = new THREE.DirectionalLight();
light.position.set(100, 100, 100)
scene.add(light)
let ambi = new THREE.AmbientLight();
scene.add(ambi)


function animate(time) {
    if ((domElement.prevWidth != container.clientWidth) || (domElement.prevHeight != container.clientHeight)) {
        domElement.prevWidth = container.clientWidth;
        domElement.prevHeight = container.clientHeight;
        renderer.setSize(container.clientWidth, container.clientHeight)
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    }
    //   sphere.position.x=Math.sin(time*0.001)*2;
    box.position.z = Math.cos(time * 0.0011) * 3.5;
    //box.rotation.x+=0.1
    box.rotation.z += 0.01
    //box.rotation.y+=0.1
    //   sphere.position.t=Math.sin(time*-0.0012)*0.5;
    //    renderer.render(scene,camera)

    renderer.render(scene, camera);
    //environment.composer.render()
   recompute();
}

let enableShadows = (root)=>root.traverse(e=>e.isMesh && (e.receiveShadow = e.castShadow = true))

renderer.setAnimationLoop(animate)



new THREE.TextureLoader().load('./door.jpg',(tex)=>{
    
    let box = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:tex}));
    let cutout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1),new THREE.MeshStandardMaterial({color:'#232323'}));
    //scene.add(box,cutout)
    cutout.position.set(0.45, 0, 0);
    cutout.updateMatrixWorld(true);

    let mesh = doCSG(box,cutout,'subtract',box.material,cutout.material);
   
})