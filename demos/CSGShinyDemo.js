import*as THREE from "three"
import {OrbitControls} from "three/addons/controls/OrbitControls.js"
import reindexBufferGeometry from "../v2/BufferGeometryIndexer.js"
import CSG from "../three-csg.js"

let renderer = new THREE.WebGLRenderer({
    antialias: true
})
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;

let domElement = renderer.domElement;
container.appendChild(domElement)
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();
camera.position.set(10, 10, 10)
let controls = new OrbitControls(camera,container)
controls.enableDamping = true;
controls.dampingFactor = 0.98

import Environment from '../v2/cool-env.js'
let env = new Environment(renderer,scene,camera)
import UI from '../v2/ui.js'

UI({
    renderer,
    scene,
    camera
})

let tx = env.makeProceduralTexture(1024, (u,v)=>{
    let rb = ((Math.random() * 128) | 0) * (((((u * 2) & 1) ^ ((v * 2) & 1)) | 0) ? 1 : 2)
    return (rb * 256) | (rb * 256 * 256) | (rb * 256 * 256 * 256) | 0x000000ff
}
)
tx.repeat.set(2, 2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

let mkMat = (color)=>new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.51,
    metalness: 0.7,
    roughnessMap: tx
});
let rnd = (rng)=>((Math.random() * 2) - 1) * (rng || 1)
let light1 = new THREE.DirectionalLight();
light1.position.set(2.8, 12, -35)
light1.castShadow = true;
let setShadowSize = (sz,mapSz)=>{
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
ground.receiveShadow = true;

let box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mkMat('grey'))
scene.add(box)

let sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),mkMat('grey'))
let cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.2,0.0,2.2,8,8),mkMat('grey'))
let tsz = 1.0
let torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(tsz,tsz * 0.33,20,3),mkMat('grey'))
let subBox = box.clone()
sphere.material = cylinder.material = subBox.material;
let subMeshes = [subBox, sphere, cylinder]
//torusKnot

let light2 = new THREE.PointLight('white',1,10,1);
scene.add(light2)
light2.position.set(5, 5, 5)
let lightSphere = sphere.clone();

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
    let bspA = CSG.fromMesh(a);
    let bspB = CSG.fromMesh(b);
    let bspC = bspA[op](bspB);
    let result = CSG.toMesh(bspC, a.matrix);
    result.material = mat;
    result.castShadow = result.receiveShadow = true;
    return result;
}

let subMaterial = mkMat('pink')
let intersectMaterial = mkMat('lightgreen')
let unionMaterial = mkMat('lightblue');
let results = []

function recompute() {
    for (let i = 0; i < results.length; i++) {
        let m = results[i]
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

    for (let i = 0; i < results.length; i++) {
        let r = results[i];
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
    let dots = [[1, 0, 0], [-1, -off, -off], [-1, off, off], [off, -1, off], [0, -1, 0], [-off, -1, -off], [off, 1, off], [off, 1, -off], [-off, 1, off], [-off, 1, -off], [off, off, 1], [off, -off, 1], [-off, off, 1], [-off, -off, 1], [0, 0, 1], [off, off, -1], [off, -off, -1], [0, off, -1], [0, -off, -1], [-off, off, -1], [-off, -off, -1], ]
    let dsp = sp0.clone()
    dsp.userData.op = 'subtract'
    dsp.position.multiplyScalar((size + radius) / size)
    for (let i = 0; i < dots.length; i++) {
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
        let bspA = CSG.fromMesh(a);
        for (let x = 1, ct = meshes.length; x < ct; x++) {
            let b = meshes[x]
            b.updateMatrixWorld()
            let bspB = CSG.fromMesh(b);
            bspA = bspA[b.userData.op](bspB);
        }

        let result = CSG.toMesh(bspA, a.matrix);
        result.material = mat;
        result.castShadow = result.receiveShadow = true;
        return result;
    }

    //    for (let x = 0; x < root.children.length; x++)
    //        console.log(root.children[x].userData)
    let start = performance.now()

    let base = doCSGOperations(root.children, unionMaterial)
    root.children.length = 0;

    let bgeom = base.geometry;
    if (!bgeom.isBufferGeometry) {
        bgeom = new THREE.BufferGeometry().fromGeometry(base.geometry)
        base.geometry = bgeom
    }
    reindexBufferGeometry(bgeom)
    root.add(base);
    //base.material.wireframe = true
    let time = performance.now() - start
    console.log(time / 1000)

    let gplane = new THREE.PlaneGeometry()
    let p1 = new THREE.Mesh(gplane,unionMaterial)
    let p2 = new THREE.Mesh(gplane,unionMaterial)
    p1.position.y += 2
    p2.position.x += .3
    p2.position.y += 2.3
    root.add(p1)
    root.add(p2)
    p2.userData.op = 'subtract'
    let out = doCSGOperations([p1, p2], unionMaterial)
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
        let pixelRatio = renderer.getPixelRatio()
        env.resize(width, height)
    }
}

let showWire = false;
let paused = false;

document.addEventListener('keydown', (e)=>{
    if (e.code == 'KeyW') {
        showWire = !!showWire;
        scene.traverse(e=>e.isMesh && (e.material.wireframe = showWire));
    }
    if (e.code == 'Space') {
        paused = !paused;
    }
}
)

let meshIdx = -1;
let subMesh;
function animate(time) {
    checkForResize();

    let tm = time * 0.001;
    let nextIdx = ((tm * 0.1) % subMeshes.length) | 0;
    if (meshIdx != nextIdx) {
        if (subMesh)
            scene.remove(subMesh)
        meshIdx = nextIdx;
        subMesh = subMeshes[meshIdx]
        scene.add(subMesh)
        subMesh.castShadow = box.castShadow = subMesh.receiveShadow = box.receiveShadow = true
    }
    if (env.composer)
        env.composer.render();
    else
        renderer.render(scene, camera)
    if (paused)
        return;
    subMesh.position.y = 0.25 + Math.sin(tm * 0.42) * 1.5;
    subMesh.position.x = Math.sin(tm * 0.3) * 2;
    subMesh.position.z = Math.cos(tm * 0.2) * 0.5;
    subMesh.position.t = Math.sin(tm * -0.3) * 0.5;

    subMesh.rotation.x += subMesh.position.t * 0.02;
    subMesh.rotation.z += subMesh.position.t * 0.021;

    light2.position.x = Math.sin(tm * 0.31) * 5;
    light2.position.z = Math.cos(tm * 0.53) * 7;
    light2.position.y = (Math.cos(tm * 0.42) * 4) + 6;

    recompute();
}
renderer.setAnimationLoop(animate)
