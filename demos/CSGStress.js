import*as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {TeapotBufferGeometry} from '../lib/jsm/TeapotBufferGeometry.js';

import CSG from "../three-csg.js"
import UI from "../v2/ui.js"

import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader"
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader"
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

import Environment from '../v2/cool-env.js';

let environment = new Environment(renderer,scene,camera)
let mkMat = environment.mkMat;

let tx = environment.makeProceduralTexture(256, (u,v)=>{
    let rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    return (rb * 256) | (rb * 256 * 256) | (rb * 256 * 256 * 256) | 0x000000ff
}
)
tx.repeat.set(2, 2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

let tx1 = environment.makeProceduralTexture(256, (u,v)=>{
    let rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    let r = (abs(sin(v * 3)) * 256) | 0
    let g = (abs(cos(u * 4)) * 256) | 0
    let b = (abs(sin(v * 5)) * 256) | 0
    return (r * 256) | (g * 256 * 256) | (b * 256 * 256 * 256) | 0x000000ff
}
)

let sphereGeom = new THREE.SphereBufferGeometry(1.2,8,8)

let box = new THREE.Mesh(new THREE.BoxBufferGeometry(2,2,2),mkMat('grey'))
let sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1.2,8,8),mkMat('grey'))

let teapotGeom = new TeapotBufferGeometry(1.2,1)

//box = new THREE.Mesh(teapotGeom,mkMat('grey'))
//sphere = new THREE.Mesh(teapotGeom,mkMat('grey'))

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
    return result;
}

let test = ()=>{
    let sphere1 = new THREE.Mesh(new THREE.TorusBufferGeometry(4,1.48,16,32),sphere.material)
    sphere1.geometry.rotateX(Math.PI * .5)
    //scene.add(sphere1);
    let slicer = new THREE.Mesh(new THREE.PlaneBufferGeometry(11,11,2,1),sphere.material)
    //scene.add(slicer);
    let res;
    let bspA = CSG.fromMesh(sphere1, 0);
    sphere1.visible = false;

let genFrame=(time)=>{

        let s = sin(time)
        let c = cos(time)
        let pts = slicer.geometry.attributes.position.array
        pts[0] = pts[9] = s * -10
        pts[2] = pts[11] = c * -10

        s = sin(-time)
        c = cos(-time)
        pts[6] = pts[15] = s * 10
        pts[8] = pts[17] = c * 10
        slicer.geometry.attributes.position.needsUpdate = true;
        //    0,9,6,15

        //    1,4,7 ,10, 13, 16, 
        //    slicer.rotation.y += 0.01;
        sphere1.updateMatrix();
        slicer.updateMatrix();
        slicer.updateMatrixWorld();

        let bspB = CSG.fromMesh(slicer, 1);

        let bspC = bspA.subtract(bspB);
        let res = CSG.toMesh(bspC, sphere1.matrix);
        res.material = [sphere1.material, sphere1.material];
        res.castShadow = res.receiveShadow = true;

        //res = doCSG(sphere1, slicer, 'subtract', sphere1.material, sphere1.material)
return res;
}
let frames=[]
for(let i=0;i<Math.PI*2;i+=.05){
    frames.push(genFrame(i))
}

let loop=0;
    scene.onBeforeRender = function() {
        let time = (performance.now() / 1000)
        if (res) {
           //res.geometry.dispose()
            res.parent.remove(res)
        }
        res=frames[loop%frames.length]
        loop++;
        scene.add(res)
    }
}

test()

let difMaterial = mkMat('grey', tx1)
let subMaterial = mkMat('red')
let intersectMaterial = mkMat('green')
let unionMaterial = mkMat('blue');
let results = []

let workerBusy = false;

function recompute() {

    box.updateMatrix();
    sphere.updateMatrix();

    //  results.push(doCSG(box,sphere,'subtract',subMaterial,difMaterial))
    //  results.push(doCSG(box,sphere,'intersect',intersectMaterial,difMaterial))
    //  results.push(doCSG(box,sphere,'union',unionMaterial,difMaterial))
    if (!workerBusy) {
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
    return
    //   results.push(doCSG(sphere,box,'intersect',difMaterial,intersectMaterial))
    //  results.push(doCSG(sphere,box,'union',difMaterial,unionMaterial))

    for (let i = 0; i < results.length; i++) {
        let r = results[i];
        scene.add(r)

        r.position.z += -5 + ((i % 3) * 5)
        r.position.x += -5 + (((i / 3) | 0) * 10)
    }
}

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
    box.rotation.z += 0.1
    //box.rotation.y+=0.1
    //   sphere.position.t=Math.sin(time*-0.0012)*0.5;
    //    renderer.render(scene,camera)
    environment.composer.render()
    //   recompute();
}

let enableShadows = (root)=>root.traverse(e=>e.isMesh && (e.receiveShadow = e.castShadow = true))

if (0)
    glbLoader.load("../assets/Pomu4.glb", (glb)=>{
        enableShadows(glb.scene)
        let m = glb.scene.getObjectByName('Pomu4')
        m.position.y += 3
        m.onBeforeRender = function() {
            this.rotation.y += .01
        }
        scene.add(m);
    }
    )
if (0)
    glbLoader.load("../assets/kiwi.glb", (glb)=>{
        enableShadows(glb.scene)
        box = glb.scene.getObjectByName('box');
        subMaterial = intersectMaterial = unionMaterial = box.material;
        sphere = glb.scene.getObjectByName('kiwi');
        difMaterial = sphere.material;
    }
    )

renderer.setAnimationLoop(animate)
