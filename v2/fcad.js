import*as THREE from "three";
import CSG from "../three-csg.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js"
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js"
import {TextGeometry} from "three/addons/geometries/TextGeometry.js"
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
let glbLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('js/lib/draco/');
glbLoader.setDRACOLoader(dracoLoader);

let makeMat = (color,opacity)=>new THREE.MeshStandardMaterial({
    color: color,
    opacity: opacity,
    transparent: (opacity === 1) ? false : true,
    side: THREE.FrontSide
});

let csgMaterial = makeMat('white', 1)
let subtractMaterial = makeMat('red', .8)
let unionMaterial = makeMat('green', .8)
let intersectMaterial = makeMat('orange', .8)

let opmats
let backMaterial = new THREE.MeshStandardMaterial({
    color: "pink",
    opacity: 0.5,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false
});
import {BufferGeometry, Float32BufferAttribute} from 'three';

class FNode {

    constructor(fcad, type, args=[]) {
        this.fcad = fcad;
        this.type = type;
        this._size = new THREE.Vector3(1,1,1);
        this._scale = new THREE.Vector3(1,1,1);
        this._position = new THREE.Vector3(0,0,0);
        this._rotation = new THREE.Euler(0,0,0,"XYZ");
        this.args = args;
        this.bspNeedsUpdate = false;
    }
    size(x, y, z) {
        this._size.set(x, y, z);
        return this;
    }
    scale(x, y, z) {
        this._scale.set(x, y, z);
        return this;
    }
    position(x, y, z) {
        this._position.set(x, y, z);
        return this;
    }
    rotation(x, y, z, order=this.rotation.order) {
        this._rotation.set(x, y, z, order);
        return this;
    }
    getMesh() {
        let p = Prims[this.type](this, this.operation ? opmats[this.operation] : csgMaterial)
        p.updateMatrixWorld();
        return p
    }
}

class Prims {
    static bindNodeToMesh(e, m) {
        m.position.copy(e._position);
        m.scale.copy(e._scale);
        m.rotation.copy(e._rotation);
        m.castShadow = m.receiveShadow = true;
        m.userData.node = e;
        return m;
    }
    static mesh(e, geometry, material) {
        let m = new THREE.Mesh(geometry,material);
        Prims.bindNodeToMesh(e, m);
        return m;
    }
    static empty(e, material) {
        return this.mesh(e, new THREE.Geometry(), material);
    }
    static sphere(e, material) {
        return this.mesh(e, new THREE.SphereGeometry(0.5,16,16), material);
    }
    static box(e, material) {
        return this.mesh(e, new THREE.BoxGeometry(1,1,1), material);
    }
    static cylinder(e, material) {
        return this.mesh(e, new THREE.CylinderGeometry(0.5,0.5,1,16), material);
    }

    static operation(o, e) {
        if (e.args.length) {
            //debugger
            let p = e.args[0].getMesh();
            //Prims.empty(e, csgMaterial);

            let getBSP = (e)=>{
                (e.bspNeedsUpdate || (!e.cachedBSP)) && (e.cachedBSP = CSG.fromMesh(e.getMesh())) && (e.bspNeedsUpdate = false)
                return e.cachedBSP;
            }

            var bspA = getBSP(e.args[0]);
            //CSG.fromMesh(p);
            e.args.forEach((b,i)=>{
                if (!i)
                    return;
                let bspB = getBSP(b);
                //CSG.fromMesh(b.getMesh());
                let op = o;
                b.operation && (op = b.operation)

                bspA = bspA[op](bspB);

            }
            );
            //console.log(bspA)
            return Prims.bindNodeToMesh(e, CSG.toMesh(bspA, p.matrix, csgMaterial));
        }

        return Prims[e.type](e)
        //return Prims.sphere(e, csgMaterial);
    }
    static union(e) {
        return Prims.operation('union', e)
    }
    static subtract(e) {
        return Prims.operation('subtract', e)
    }
    static intersect(e) {
        return Prims.operation('intersect', e)
    }
    static invert(e) {
        return Prims.operation('invert', e)
    }
}

let empty = new THREE.Object3D();
class FCAD {
    toJSON() {
        let id = 0;
        this.nodes.forEach(n=>(n.id = id++));
        let out = [];
        this.nodes.forEach(n=>{
            if (n.args) {
                let ids = [];
                n.args.forEach((a,i)=>ids.push(a.id));
                n.iargs = ids;
            }
        }
        );
        this.nodes.forEach(n=>{
            let o = {};
            o.type = n.type;
            n.name && (o.name = n.name);
            n.args && n.args.length && (o.args = n.iargs);
            !n._position.equals(empty.position) && (o.position = n._position);
            !n._scale.equals(empty.scale) && (o.scale = n._scale);
            !n._rotation.equals(empty.rotation) && (o.rotation = n._rotation);
            n.operation && (o.operation = n.operation)
            out.push(o);
        }
        );
        return out;
    }
    fromJSON(js) {
        js.forEach((e,i)=>this.nodes.push(new FNode(this,e.type)));
        js.forEach((e,i)=>{
            let n = this.nodes[i]
            e.args && e.args.forEach((a,ai)=>(e.args[ai] = this.nodes[a]));
            e.args && (n.args = e.args)
            //debugger
            e.position && n._position.copy(e.position);
            e.scale && n._scale.copy(e.scale);
            e.rotation && n._rotation.copy(e.rotation);
            e.operation && (n.operation = e.operation);
        }
        );
    }

    constructor(scene, materials=[csgMaterial, subtractMaterial, unionMaterial, intersectMaterial, backMaterial]) {
        //csgMat = csgMaterial,frontMat = frontMaterial,backMat = backMaterial) {
        csgMaterial = materials[0]
        subtractMaterial = materials[1]
        unionMaterial = materials[2]
        intersectMaterial = materials[3]
        backMaterial = materials[4]
        opmats = {
            'subtract': subtractMaterial,
            'union': unionMaterial,
            'intersect': intersectMaterial
        }

        this.scene = scene;
        this.nodes = [];
        this.elements = [];

        let addNode = node=>{
            this.nodes.push(node);
            return node;
        }
        
        this.addNode = addNode;

        function nnode(type, args) {
            return addNode(new FNode(self,type,Array.prototype.slice.call(args)));
        }

        let self = this;
        function render() {
            self.elements = [];
            for (let a = arguments, i = 0; i < a.length; i++) {
                let n = a[i];
                self.elements.push(n.getMesh());
            }
            return self;
        }
        this.cadRecomputeEvent = new Event('cadRecomputed')
        this.update = ()=>{
            render(...this.nodes);
            let jsobj = this.toJSON()
            localStorage.csgscene = JSON.stringify(jsobj);
            //debugger
            this.cadRecomputeEvent.jsobj = jsobj;
            document.dispatchEvent(this.cadRecomputeEvent)
            return this.elements;
        }
        ;

        let mkDefault = ()=>{
            let vec3 = (x,y,z)=>new THREE.Vector3(x,y,z);
            let sphere = ()=>addNode(new FNode(this,"sphere"));
            let box = ()=>addNode(new FNode(this,"box"));
            let cylinder = ()=>addNode(new FNode(this,"cylinder"));

            let mesh = function() {
                return nnode("mesh", arguments);
            };
            let hull = function() {
                return nnode("hull", arguments);
            };
            let union = function() {
                return nnode("union", arguments);
            };
            let subtract = function() {
                return nnode("subtract", arguments);
            };
            let intersect = function() {
                return nnode("intersect", arguments);
            };
            let invert = function() {
                return nnode("invert", arguments);
            };

            let a = box().size(1, 1, 1).position(1, 0.5, 1);

            let b = box().size(1, 1, 1).position(2, 0.5, 2);

            let c = sphere().size(1, 1, 1).position(3, 0.5, 2);

            let d = cylinder().size(1, 1, 1).position(5, 0.5, 2);

            let u = union(a, b, c, d);

            //this.update = () => {
            //  return render(a, b, c, u).elements;
            //};
        }
        ;
        let version = '1.0.0'
        try {
            if (localStorage.version != version)
                throw ""
            this.fromJSON(JSON.parse(localStorage.csgscene));
        } catch {
            localStorage.version = version
            let def = defaultScene;
            this.fromJSON(JSON.parse(def));
            //mkDefault();
        }
        this.update();
        localStorage.csgscene = JSON.stringify(this.toJSON());

        const loader = new FontLoader();
        loader.load('../assets/helvetiker_regular.typeface.json', function(font) {
            let genText = (str)=>{
                const geometry = new TextGeometry(str,{
                    font: font,
                    size: .15,
                    height: .05,
                    curveSegments: 3,
                    bevelEnabled: false,
                    bevelThickness: 0.005,
                    bevelSize: 0.005,
                    bevelOffset: 0,
                    bevelSegments: 1
                });
                let tm = new THREE.Mesh(geometry,csgMaterial.clone());
                tm.rotation.x = Math.PI * -.5
                tm.position.y += 1.34;
                tm.position.x -= .6;
                tm.position.z -= .1;
                return tm
            }

            glbLoader.load('../assets/Blonk.glb', (glb)=>{
                glbLoader.load('../assets/text2.glb', (glbt)=>{

                    let genMS = performance.now()
                    let meshes = []
                    let mm = csgMaterial.clone();
                    //new THREE.MeshStandardMaterial({color:0xff7f00,roughness:0.1,metalness:1.})
                    mm.roughness = .01
                    mm.metalness = 1.
                    mm.color.set(0x805000);
                    //0xff7f00)

                    glb.scene.traverse(e=>e.isMesh && (meshes.push(e) && (e.material = mm)))
                    glbt.scene.traverse(e=>e.isMesh && (meshes.push(e) && (e.material = mm)))

                    let ringMesh = meshes[0]
                    ringMesh.scale.multiplyScalar(.78)
                    ringMesh.position.y -= .46

                    let textMesh = meshes[1]
                    textMesh.position.x -= .6
                    textMesh.position.z += -.2
                    textMesh.position.y += 1.38
                    textMesh.scale.multiplyScalar(.25)

                    meshes.forEach(e=>e.updateMatrixWorld())

                    let sroot = new THREE.Group();
                    scene.add(sroot)
                    let box;
                    let bspBox
                    let bspRing
                    let bspPlate
                    let bx;
                    let regen = (str)=>{
                        let mshes = []
                        sroot.traverse(e=>e.isMesh && mshes.push[e])
                        while (sroot.children.length) {
                            sroot.remove(sroot.children[0])
                        }
                        mshes.forEach(m=>m.geometry.destroy())

                        let tm = genText(str)
                        sroot.add(tm)

                        textMesh = tm;
                        textMesh.updateMatrixWorld()
                        //
                        if (!box) {
                            box = new THREE.Box3();
                            box.setFromObject(textMesh);
                            box.expandByScalar(.01)
                            let sz = box.getSize(new THREE.Vector3())
                            bx = new THREE.Mesh(new THREE.BoxGeometry(sz.x,sz.y,sz.z),mm);
                            box.getCenter(bx.position);
                            bx.updateMatrixWorld()
                            bx.material = bx.material.clone()
                            bx.material.transparent = true;
                            bx.material.opacity = .5;
                            bspBox = CSG.fromMesh(bx)
                            bspRing = CSG.fromMesh(ringMesh)

                            let mesh = CSG.toMesh(bspBox.intersect(bspRing), ringMesh.matrix, ringMesh.material)
                            scene.add(mesh)
                            mesh.position.z -= 2
                            bspPlate = CSG.fromMesh(mesh)

                            mesh = CSG.toMesh(bspRing.subtract(bspBox), ringMesh.matrix, ringMesh.material)
                            scene.add(mesh)
                            mesh.position.z -= 4

                        }
                        sroot.add(ringMesh)
                        sroot.add(bx)
                        sroot.add(textMesh)

                        let bspText = CSG.fromMesh(textMesh)

                        //bspRing = JSON.stringify(bspRing)
                        //bspRing = JSON.parse(bspRing)

                        let now = performance.now()



                        if(CSG.doAsync){

                        	let js =CSG.fromJSON(JSON.parse(JSON.stringify(bspPlate)))
                        	CSG.doAsync(bspPlate,'subtract',bspText).then((result)=>{
                                let mesh = CSG.toMesh(result,ringMesh.matrix,ringMesh.material);
								sroot.add(mesh)
								mesh.position.z -= 4
								console.log("gentxt:", performance.now() - now)
                        	})
                        }else{

							let mesh = CSG.toMesh(bspPlate.subtract(bspText), ringMesh.matrix, ringMesh.material)
							sroot.add(mesh)
							mesh.position.z -= 4
							console.log("gentxt:", performance.now() - now)

                        }

                    }

                    regen(`Hello three.js!
here is a wider line..
multiline text.`)
                    /*
                    setInterval(()=>{
                        regen(`${Math.random()}
${Math.random()}                      
${(performance.now() / 1000) | 0}`)
                    }
                    , 2000)
                    */

                    let now = performance.now()
                    genMS = now - genMS
                    console.log("regen:", genMS)

                    //bspRing = JSON.stringify(bspRing)
                    //bspRing = JSON.parse(bspRing)

                    genMS = performance.now() - now
                    console.log("tojson:", genMS)

                }
                )
            }
            )
        })
    }
}

let defaultScene = `
[
{
"type": "box",
"position": {
"x": 2,
"y": 0.8901888224689956,
"z": 1.699999999999993
},
"scale": {
"x": 1.7172526639167582,
"y": 1.717252663916759,
"z": 1.7172526639167582
}
},
{
"type": "box",
"position": {
"x": 2,
"y": 0.5,
"z": 1.0499999999999998
},
"scale": {
"x": 0.9999999999999943,
"y": 0.9999999999999964,
"z": 0.9999999999999943
}
},
{
"type": "sphere",
"position": {
"x": 2.0500000000000003,
"y": 2,
"z": 1.3999999999999992
},
"scale": {
"x": 0.9999999999999817,
"y": 1,
"z": 0.9999999999999817
}
},
{
"type": "cylinder",
"position": {
"x": 2,
"y": 1.2499999999999993,
"z": 1.4500000000000008
},
"scale": {
"x": 1.5796179119895322,
"y": 1.1489458710334988,
"z": 1.5796179119895322
},
"operation": "subtract"
},
{
"type": "union",
"args": [
0,
1,
2,
3
],
"position": {
"x": -0.5499999999999989,
"y": 0.5183796427711618,
"z": 1.15
},
"scale": {
"x": 0.9999999999999942,
"y": 1,
"z": 0.9999999999999942
}
}
]
`

FCAD.FNode = FNode;

export default FCAD;

/*
//import {ConvexGeometry} from "../lib/jsm/ConvexGeometry.js";

import { ConvexHull } from '../lib/jsm/ConvexHull.js';

// ConvexGeometry

var ConvexGeometry = function ( points ) {

	Geometry.call( this );

	this.fromBufferGeometry( new ConvexBufferGeometry( points ) );
	this.mergeVertices();

};

ConvexGeometry.prototype = Object.create( Geometry.prototype );
ConvexGeometry.prototype.constructor = ConvexGeometry;

// ConvexBufferGeometry

var ConvexBufferGeometry = function ( points ) {

	BufferGeometry.call( this );

	// buffers

	var vertices = [];
	var normals = [];

	if ( ConvexHull === undefined ) {

		console.error( 'THREE.ConvexBufferGeometry: ConvexBufferGeometry relies on ConvexHull' );

	}

	var convexHull = new ConvexHull().setFromPoints( points );

	// generate vertices and normals

	var faces = convexHull.faces;

	for ( var i = 0; i < faces.length; i ++ ) {

		var face = faces[ i ];
		var edge = face.edge;

		// we move along a doubly-connected edge list to access all face points (see HalfEdge docs)

		do {

			var point = edge.head().point;

			vertices.push( point.x, point.y, point.z );
			normals.push( face.normal.x, face.normal.y, face.normal.z );

			edge = edge.next;

		} while ( edge !== face.edge );

	}

	// build geometry

	this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
	this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );

};

ConvexBufferGeometry.prototype = Object.create( BufferGeometry.prototype );
ConvexBufferGeometry.prototype.constructor = ConvexBufferGeometry;

export { ConvexGeometry, ConvexBufferGeometry };
*/
