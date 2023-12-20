
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import CSG from "../three-csg.js"
import Environment from "../v2/cool-env.js"
//import "../v2/csg-toy.js"
import UI from "../v2/ui.js"
import app from "../v2/app3.js"
let {renderer,scene,camera} = app;

UI(app);
let tx = app.environment.makeProceduralTexture(256,(u,v)=>{
    let rb = ((Math.random()*128)|0) * (((((u*2)&1)^((v*2)&1))|0)?1:2)
    return (rb*256)|(rb*256*256)|(rb*256*256*256)|0x000000ff
})
tx.repeat.set(2,2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

let mkMat=(color) => new THREE.MeshStandardMaterial({color:color,roughness:1,metalness:0.8,map:tx});
let rnd=(rng)=>((Math.random()*2)-1)*(rng||1)

let box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mkMat('grey'))
scene.add(box)
let sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),mkMat('grey'))
scene.add(sphere)

function doCSG(a,b,op,mat){
    let bspA = CSG.fromMesh( a );
    let bspB = CSG.fromMesh( b );
    let bspC = bspA[op]( bspB );
    let result = CSG.toMesh( bspC, a.matrix );
    result.material = mat;
    result.castShadow  = result.receiveShadow = true;
    return result;
}

let subMaterial = mkMat('red')
let intersectMaterial = mkMat('green')
let unionMaterial = mkMat('blue');
let results = []

function recompute(){
    for(let i=0;i<results.length;i++){
        let m = results[i]
        m.parent.remove(m)
        m.geometry.dispose();
    }
    results = [];

    box.updateMatrix();
    sphere.updateMatrix();

    results.push(doCSG(box,sphere,'subtract',subMaterial))
    results.push(doCSG(box,sphere,'intersect',intersectMaterial))
    results.push(doCSG(box,sphere,'union',unionMaterial))

    results.push(doCSG(sphere,box,'subtract',subMaterial))
    results.push(doCSG(sphere,box,'intersect',intersectMaterial))
    results.push(doCSG(sphere,box,'union',unionMaterial))

    for(let i=0;i<results.length;i++){
        let r = results[i];
        r.castShadow = r.receiveShadow = true;
        scene.add(r)

        r.position.z += -5 + ((i%3)*5)
        r.position.x += -5 + (((i/3)|0)*10)
    }
}
document.addEventListener('afterRender',()=>{
    let time = performance.now()
    sphere.position.x=Math.sin(time*0.001)*2;
    sphere.position.z=Math.cos(time*0.0011)*0.5;
    sphere.position.t=Math.sin(time*-0.0012)*0.5;
    recompute();
})
