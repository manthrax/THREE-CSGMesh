import * as THREE from "https://cdn.rawgit.com/mrdoob/three.js/master/build/three.module.js"
import {OrbitControls} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/controls/OrbitControls.js"
import {CSS3DRenderer} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/renderers/CSS3DRenderer.js"

import {HDRCubeTextureLoader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/loaders/HDRCubeTextureLoader.js"
import {RGBELoader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/loaders/RGBELoader.js"
//import {PMREMGenerator} from  "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/pmrem/PMREMGenerator.js"
//import {PMREMCubeUVPacker} from  "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/pmrem/PMREMCubeUVPacker.js"

import {EffectComposer} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/postprocessing/EffectComposer.js"
import {RenderPass} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/postprocessing/RenderPass.js"
import {ShaderPass} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/postprocessing/ShaderPass.js"
import {CopyShader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/shaders/CopyShader.js"
import {LuminosityHighPassShader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/shaders/LuminosityHighPassShader.js"
import {UnrealBloomPass} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/postprocessing/UnrealBloomPass.js"

import {SSAOShader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/shaders/SSAOShader.js"
import {SSAOPass} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/postprocessing/SSAOPass.js"
import {FXAAShader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/shaders/FXAAShader.js"

import {SimplexNoise} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/math/SimplexNoise.js"

import CSG from "./CSGMesh.js"

import reindexBufferGeometry from "./BufferGeometryOptimizer.js"

let renderer = new THREE.WebGLRenderer({
    antialias: true
})
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
//renderer.gammaInput = true;
//renderer.gammaOutput = true;
renderer.toneMapping = THREE.Uncharted2ToneMapping
//ReinhardToneMapping;//;
//renderer.toneMappingExposure = 2.0;//0.5;//2.3;
//renderer.toneMappingWhitePoint = 2.5

let domElement = renderer.domElement;
container.appendChild(domElement)
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();
camera.position.set(10, 10, 10)
let controls = new OrbitControls(camera,container)
controls.enableDamping = true;
controls.dampingFactor = 0.98

let ssaoPass;
let fxaaPass;
function setupPostProcessing() {
    var bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),1.5,0.4,0.85);
    bloomPass.threshold = 0.999;
    //0.85;   0,1.5,0
    bloomPass.strength = 1.5;
    bloomPass.radius = 0.0;
    //0.02;

    var renderScene = new RenderPass(scene,camera);

    let composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);

    composer.addPass(renderScene);

    fxaaPass = new ShaderPass(FXAAShader);

    renderer.setPixelRatio(1);

    var pixelRatio = renderer.getPixelRatio();

    let width = window.innerWidth;
    let height = window.innerHeight;
    let copyPass = new ShaderPass(CopyShader);

    ssaoPass = new SSAOPass(scene,camera,width,height);
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.28;
    ssaoPass.kernelRadius = 10.1;

    fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);

    //bloomPass.renderToScreen = false;

    composer.addPass(fxaaPass);

    //ssaoPass.clear = false;
    //composer.addPass( ssaoPass );

    //composer.addPass( copyPass );

    composer.addPass(bloomPass);

    //renderer.toneMapping = THREE.ReinhardToneMapping;
    return composer
}
let composer = setupPostProcessing();

function loadHDR(dir) {
    var hdrCubeRenderTarget;
    var hdrCubeMap;
    var hdrUrls = ['px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr'];
    dir = dir || 'venice_sunset';
    //'san_guiseppe_bridge'
    hdrCubeMap = new HDRCubeTextureLoader().setPath('./assets/' + dir + '/').setDataType(THREE.UnsignedByteType).load(hdrUrls, function() {

        var pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileCubemapShader();

        hdrCubeRenderTarget = pmremGenerator.fromCubemap(hdrCubeMap);
        pmremGenerator.dispose();
        /*
            //hdrCubeMap );
            //pmremGenerator.update( renderer );

            var pmremCubeUVPacker = new THREE.PMREMCubeUVPacker( pmremGenerator.cubeLods );
            pmremCubeUVPacker.update( renderer );

            hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;

            hdrCubeMap.magFilter = THREE.LinearFilter;
            hdrCubeMap.needsUpdate = true;

            pmremGenerator.dispose();
            pmremCubeUVPacker.dispose();

*/

        scene.background = hdrCubeMap;
        var newEnvMap = hdrCubeRenderTarget ? hdrCubeRenderTarget.texture : null;

        if (true)
            scene.traverse(e=>{
                if (e.isMesh) {
                    e.material.envMap = newEnvMap;
                    e.material.needsUpdate = true;
                    e.material.roughness = 0.7;
                    e.material.metalness = 0.7;
                    //e.material.flatShading = true;
                    e.castShadow = e.receiveShadow = true;
                    //     if(e.name!=='ground')e.material.wireframe = true;
                }
            }
            )
    });
    return {
        cubeMap: hdrCubeMap,
        cubeRenderTarget: hdrCubeRenderTarget
    }
}

let hdr = loadHDR()

function mkCanvas(dim) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = dim;
    return canvas;
}
function makeProceduralTexture(dim, fn) {
    var canv = mkCanvas(dim);
    var ctx = canv.getContext('2d');
    var pix = ctx.getImageData(0, 0, dim, dim);
    var u32view = new DataView(pix.data.buffer);
    var idx = -4;
    for (var j = 0; j < dim; j++)
        for (var i = 0; i < dim; i++)
            u32view.setUint32(idx += 4, fn(j / dim, i / dim) | 0);
    ctx.putImageData(pix, 0, 0);
    var tex = new THREE.Texture(canv);
    tex.needsUpdate = true;
    return tex;
}
var tx = makeProceduralTexture(1024, (u,v)=>{
    var rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    return (rb * 256) | (rb * 256 * 256) | (rb * 256 * 256 * 256) | 0x000000ff
}
)
tx.repeat.set(2, 2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

//let mkMat=(color) => new THREE.MeshStandardMaterial({color:color,roughness:0.51,metalness:0.7,map:tx});
let mkMat = (color)=>new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.51,
    metalness: 0.7,
    roughnessMap: tx
});
let rnd = (rng)=>((Math.random() * 2) - 1) * (rng || 1)
/*let mkLight = ()=>{
        let light1 = new THREE.PointLight();
        light1.position.set(rnd(20),rnd(3)+5,rnd(20))
        scene.add(light1);
    }
    
    for(var i=0;i<4;i++)mkLight()*/

let light1 = new THREE.DirectionalLight();
light1.position.set(2.8, 12, -35)
light1.castShadow = true;
var setShadowSize = (sz,mapSz)=>{
    light1.shadow.camera.left = sz;
    light1.shadow.camera.bottom = sz;
    light1.shadow.camera.right = -sz;
    light1.shadow.camera.top = -sz;
    if (mapSz) {
        light1.shadow.mapSize.set(mapSz, mapSz)
    }
}
setShadowSize(15, 1024);
scene.add(light1)

let ground = new THREE.Mesh(new THREE.BoxGeometry(20,1,20),mkMat('grey'))
scene.add(ground)
ground.position.y -= 1.5;
ground.name = 'ground'

ground.material.roughnessMap = ground.material.roughnessMap.clone();
ground.material.roughnessMap.repeat.set(8, 8)
ground.material.roughnessMap.needsUpdate = true;

let box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mkMat('grey'))
scene.add(box)

let sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),mkMat('grey'))
let cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.2,0.8,2.2,8,8),mkMat('grey'))
let tsz = 1.0
let torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(tsz,tsz * 0.33,20,3),mkMat('grey'))
let subBox = box.clone()
sphere.material = cylinder.material = subBox.material;
let subMeshes = [subBox, sphere, cylinder]
//torusKnot

let light2 = new THREE.PointLight('white',1,10,1);
scene.add(light2)
light2.position.set(5, 5, 5)
var lightSphere = sphere.clone();

light2.add(lightSphere)
lightSphere.material = lightSphere.material.clone();
light2.castShadow = true;
//lightSphere.material.map = undefined;
//	lightSphere.material.color.set('lightblue')
lightSphere.material.emissive.set('lightblue')
//lightSphere.material.emissive.multiplyScalar(30)
lightSphere.scale.multiplyScalar(0.1)

function doCSG(a, b, op, mat) {
    a.updateMatrixWorld()
    b.updateMatrixWorld()
    var bspA = CSG.fromMesh(a);
    var bspB = CSG.fromMesh(b);
    var bspC = bspA[op](bspB);
    var result = CSG.toMesh(bspC, a.matrix);
    result.material = mat;
    result.castShadow = result.receiveShadow = true;
    return result;
}

let subMaterial = mkMat('pink')
let intersectMaterial = mkMat('lightgreen')
let unionMaterial = mkMat('lightblue');
let results = []

function recompute() {
    for (var i = 0; i < results.length; i++) {
        var m = results[i]
        m.parent.remove(m)
        m.geometry.dispose();
    }
    results = [];

    box.updateMatrix();
    subMesh.updateMatrix();

    results.push(doCSG(box, subMesh, 'subtract', subMaterial))
    results.push(doCSG(box, subMesh, 'intersect', intersectMaterial))
    results.push(doCSG(box, subMesh, 'union', unionMaterial))

    results.push(doCSG(subMesh, box, 'subtract', subMaterial))
    results.push(doCSG(subMesh, box, 'intersect', intersectMaterial))
    results.push(doCSG(subMesh, box, 'union', unionMaterial))

    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        scene.add(r)

        r.position.z += -5 + ((i % 3) * 5)
        r.position.x += -5 + (((i / 3) | 0) * 10)

    }
}


let roundBox = (size,radius,count)=>{
    let root = new THREE.Group()
    root.position.y = 4;
    scene.add(root)

    let sphrgeom = new THREE.SphereGeometry(.5,count * 2,count)
    let sphrmesh = new THREE.Mesh(sphrgeom,unionMaterial)
    sphrmesh.scale.multiplyScalar(radius)

    let boxgeom = new THREE.BoxGeometry(1,1,1)
    let boxmesh = new THREE.Mesh(boxgeom)
    boxmesh.scale.multiplyScalar(size)
    boxmesh.userData.op = 'add'
    let mx = boxmesh.clone();
    mx.scale.x += radius;
    let my = boxmesh.clone();
    my.scale.y += radius;
    let mz = boxmesh.clone();
    mz.scale.z += radius;

    mx.userData.op = 'union'
    my.userData.op = 'union'
    mz.userData.op = 'union'
    root.add(mx)
    root.add(my)
    root.add(mz)
    //        let mxy = doCSG(mx,my,'union',unionMaterial)
    //        let mxyz = doCSG(mxy,mz,'union',unionMaterial)
    //        root.add(mxyz)

    let cylgeom = new THREE.CylinderGeometry(.5,.5,1,count * 2,count * 2)
    let cylmesh = new THREE.Mesh(cylgeom,unionMaterial)
    let sz2 = size / 2;
    cylmesh.position.set(sz2, 0, sz2)
    cylmesh.scale.set(radius, size, radius)
    cylmesh.userData.op = 'union'
    let cyl1 = cylmesh.clone()
    cyl1.position.x -= size
    let cyl2 = cylmesh.clone()
    cyl2.position.z -= size
    let cyl3 = cylmesh.clone()
    cyl3.position.x -= size
    cyl3.position.z -= size

    let cyl00 = cylmesh.clone()
    cyl00.rotation.x = Math.PI * .5
    cyl00.position.y += sz2;
    cyl00.position.z -= sz2;
    root.add(cyl00)

    let cyl01 = cyl00.clone()
    root.add(cyl01)
    cyl01.position.x -= size;

    let cyl02 = cyl00.clone()
    root.add(cyl02)
    cyl02.rotation.z = Math.PI * .5
    cyl02.position.x -= sz2;
    cyl02.position.z -= sz2;

    let cyl03 = cyl02.clone()
    root.add(cyl03)
    cyl02.position.z += size;

    let cyl10 = cylmesh.clone()
    cyl10.rotation.x = Math.PI * .5
    cyl10.position.y -= sz2;
    cyl10.position.z -= sz2;
    cyl10.position.x -= size;
    root.add(cyl10)

    let cyl11 = cyl10.clone()
    root.add(cyl11)
    //cyl11.position.y-=size
    cyl11.position.x += size;

    let cyl12 = cyl11.clone()
    root.add(cyl12)
    cyl12.rotation.z = Math.PI * .5
    cyl12.position.x -= sz2;
    cyl12.position.z -= sz2;

    let cyl13 = cyl12.clone()
    root.add(cyl13)
    cyl13.position.z += size;

    let sp0 = sphrmesh.clone()
    sp0.userData.op = 'union'
    sp0.position.set(sz2, sz2, sz2);
    //root.add(sp0)

    let mkref = (tmpl,psx,psy,psz)=>{
        let sp1 = tmpl.clone()
        sp1.position.x *= psx;
        sp1.position.y *= psy;
        sp1.position.z *= psz;
        root.add(sp1)
    }
    mkref(sp0, 1, 1, 1)
    mkref(sp0, -1, 1, 1)
    mkref(sp0, 1, -1, 1)
    mkref(sp0, -1, -1, 1)
    mkref(sp0, 1, 1, -1)
    mkref(sp0, -1, 1, -1)
    mkref(sp0, 1, -1, -1)
    mkref(sp0, -1, -1, -1)

    let off = .4;
    let sof = 1
    let dots = [[1, 0, 0], [-1, -off, -off], [-1, off, off],
    [off, -1, off], [0, -1, 0], [-off, -1, -off],
    [off, 1, off], [off, 1, -off], [-off, 1, off], [-off, 1, -off],
    [off, off, 1], [off, -off, 1], [-off, off, 1], [-off, -off, 1], [0, 0, 1],
    [off, off, -1], [off, -off, -1], [0, off, -1], [0, -off, -1], [-off, off, -1], [-off, -off, -1], ]
    let dsp = sp0.clone()
    dsp.userData.op = 'subtract'
    dsp.position.multiplyScalar((size + radius) / size)
    for (var i = 0; i < dots.length; i++) {
        mkref(dsp, dots[i][0], dots[i][1], dots[i][2])
    }
    // mxyz.position.y+=4;

    // unionMaterial.wireframe=true

    root.add(cylmesh)
    root.add(cyl1)
    root.add(cyl2)
    root.add(cyl3)

    function doCSGOperations(meshes, mat) {

        let a = meshes[0]
        a.updateMatrixWorld()
        var bspA = CSG.fromMesh(a);
        for (let x = 1, ct = meshes.length; x < ct; x++) {
            let b = meshes[x]
            b.updateMatrixWorld()
            var bspB = CSG.fromMesh(b);
            bspA = bspA[b.userData.op](bspB);
        }

        var result = CSG.toMesh(bspA, a.matrix);
        result.material = mat;
        result.castShadow = result.receiveShadow = true;
        return result;
    }

    for (let x = 0; x < root.children.length; x++)
        console.log(root.children[x].userData)
    let start = performance.now()

    let base = doCSGOperations(root.children, unionMaterial)
    root.children.length = 0;

let bgeom = new THREE.BufferGeometry().fromGeometry(base.geometry)
reindexBufferGeometry(bgeom)
base.geometry = bgeom
    root.add(base);
//base.material.wireframe = true
    let time = performance.now() - start
    console.log(time / 1000)





let gplane = new THREE.PlaneGeometry()
let p1 = new THREE.Mesh(gplane,unionMaterial)
let p2 = new THREE.Mesh(gplane,unionMaterial)
p1.position.y+=2
p2.position.x+=.3
p2.position.y+=2.3
root.add(p1)
root.add(p2)
p2.userData.op='subtract'
let out = doCSGOperations([p1,p2],unionMaterial)
root.remove(p1)
root.remove(p2)


root.add(out)

}

roundBox(1, .2, 2)


function checkForResize() {
    if ((domElement.prevWidth != container.clientWidth) || (domElement.prevHeight != container.clientHeight)) {
        let width = container.clientWidth;
        let height = container.clientHeight
        domElement.prevWidth = width;
        domElement.prevHeight = height;
        renderer.setSize(width, height, true)
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        var pixelRatio = renderer.getPixelRatio()
        if(composer){
            composer.setSize(width, height)
            ssaoPass.setSize(width, height)
            fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
            fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
        }
    }

}

function dynamicExposure() {
}

var meshIdx = -1;
let subMesh;
function animate(time) {
    checkForResize();

    var tm = time * 0.001;
    var nextIdx = ((tm * 0.1) % subMeshes.length) | 0;
    if (meshIdx != nextIdx) {
        if (subMesh)
            scene.remove(subMesh)
        meshIdx = nextIdx;
        subMesh = subMeshes[meshIdx]
        scene.add(subMesh)
    }

    subMesh.position.y = 0.25
    subMesh.position.x = Math.sin(tm * 0.1) * 2;
    subMesh.position.z = Math.cos(tm * 0.1) * 0.5;
    subMesh.position.t = Math.sin(tm * -0.2) * 0.5;

    subMesh.rotation.x += subMesh.position.t * 0.02;
    subMesh.rotation.z += subMesh.position.t * 0.021;

    light2.position.x = Math.sin(tm * 0.31) * 5;
    light2.position.z = Math.cos(tm * 0.53) * 7;
    light2.position.y = (Math.cos(tm * 0.42) * 4) + 6;

    if(composer)composer.render();
    else renderer.render(scene,camera)

    recompute();
}
renderer.setAnimationLoop(animate)
