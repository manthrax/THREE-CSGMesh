"use strict"

import * as THREE from "../../../three.js-dev/build/three.module.js";
let {Geometry}=THREE;
import {CSG} from "./csg-lib.js"
//import {Geometry} from "../three.js-dev/examples/jsm/deprecated/Geometry.js";


CSG.fromGeometry=function(geom){
    if(geom.isBufferGeometry)
        geom = new Geometry().fromBufferGeometry(geom)
    var fs = geom.faces;
    var vs = geom.vertices;
    var polys=[]
    var fm=['a','b','c']
    for(var i=0;i<fs.length;i++){
        var f = fs[i];
        var vertices=[]
        for(var j=0;j<3;j++) vertices.push(new Vertex(vs[f[fm[j]]],f.vertexNormals[j],geom.faceVertexUvs[0][i][j]))
        polys.push(new Polygon(vertices))
    }
    return CSG.fromPolygons(polys)
}

CSG.fromMesh=function(mesh){
    var csg = CSG.fromGeometry(mesh.geometry)
    for(var i=0;i<csg.polygons.length;i++){
        var p = csg.polygons[i]
        for(var j=0;j<p.vertices.length;j++){
            var v=p.vertices[j]
            v.pos.applyMatrix4(mesh.matrix);
        }
    }
    return csg;
}

CSG.toMesh=function(csg,toMatrix,toMaterial){
    var geom = new Geometry();
    var ps = csg.polygons;
    var vs = geom.vertices;
    var fvuv = geom.faceVertexUvs[0]
    for(var i=0;i<ps.length;i++){
        var p = ps[i]
        var pvs=p.vertices;
        var v0=vs.length;
        var pvlen=pvs.length
        
        for(var j=0;j<pvlen;j++)
            vs.push(new THREE.Vector3().copy(pvs[j].pos))


        for(var j=3;j<=pvlen;j++){
            var fc = new THREE.Face3();
            var fuv = []
            fvuv.push(fuv)
            var fnml = fc.vertexNormals;
            fc.a=v0;
            fc.b=v0+j-2;
            fc.c=v0+j-1;

            fnml.push(new THREE.Vector3().copy(pvs[0].normal))
            fnml.push(new THREE.Vector3().copy(pvs[j-2].normal))
            fnml.push(new THREE.Vector3().copy(pvs[j-1].normal))
            fuv.push(new THREE.Vector3().copy(pvs[0].uv))
            fuv.push(new THREE.Vector3().copy(pvs[j-2].uv))
            fuv.push(new THREE.Vector3().copy(pvs[j-1].uv))

            fc.normal = new THREE.Vector3().copy(p.plane.normal)
            geom.faces.push(fc)
        }
    }
    var inv = new THREE.Matrix4().copy(toMatrix).invert();
    geom.applyMatrix4(inv);
    geom.verticesNeedUpdate = geom.elementsNeedUpdate = geom.normalsNeedUpdate = true;
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
//    var m = new THREE.Mesh(geom.toBufferGeometry(),toMaterial);
    var m = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(geom),toMaterial);
    m.matrix.copy(toMatrix);
    m.matrix.decompose(m.position,m.rotation,m.scale)
    m.updateMatrixWorld();
    return m
}


CSG.ieval=function(tokens,index=0){
    if(typeof tokens === 'string')
        CSG.currentOp=tokens;
    else if(tokens instanceof Array){
        for(let i=0;i<tokens.length;i++)CSG.ieval(tokens[i],0);
    }else if(typeof tokens==='object'){
        var op=CSG.currentOp;
        tokens.updateMatrix();
        tokens.updateMatrixWorld();
        if(!CSG.sourceMesh)
            CSG.currentPrim =  CSG.fromMesh(CSG.sourceMesh = tokens);
        else{
            CSG.nextPrim = CSG.fromMesh(tokens);
            CSG.currentPrim = CSG.currentPrim[op](CSG.nextPrim);
        }
        if(CSG.doRemove)tokens.parent.remove(tokens);
    }//union,subtract,intersect,inverse
}

CSG.eval=function(tokens,doRemove){//[['add',mesh,mesh,mesh,mesh],['sub',mesh,mesh,mesh,mesh]]
    CSG.currentOp=null;
    CSG.sourceMesh=null;
    CSG.doRemove=doRemove;
    CSG.ieval(tokens)
    var result = CSG.toMesh( CSG.currentPrim, CSG.sourceMesh.matrix );
    result.material = CSG.sourceMesh.material;
    result.castShadow  = result.receiveShadow = true;
    return result;
}

class CSGQuery{
    constructor(sourceMesh){
        this.currentPrim =  CSG.fromMesh(this.sourceMesh = sourceMesh);
        this.tokens = []
        this.tokTop = 0;
        
    }
    get mesh(){
        if(this.tokTop < this.tokens.length){
            while(this.tokTop<this.tokens.length){
                let tok = this.tokens[this.tokTop]
                this.currentPrim = this.currentPrim[tok[0]](tok[1] && new CSG.fromMesh(tok[1]))
                this.tokTop++
            }
            this._mesh = CSG.toMesh( this.currentPrim, this.sourceMesh.matrix );
        }
        return this._mesh
    }
    union(target){this.tokens.push(['union',target]);return this}
    subtract(target){this.tokens.push(['subtract',target]);return this}
    intersect(target){this.tokens.push(['intersect',target]);return this}
    inverse(target){this.tokens.push(['inverse',target]);return this}
}

//export default CSG
// Return a new CSG solid representing space in either this solid or in the
// solid `csg`. Neither this solid nor the solid `csg` are modified.
// 
//     A.union(B)
// 
//     +-------+            +-------+
//     |       |            |       |
//     |   A   |            |       |
//     |    +--+----+   =   |       +----+
//     +----+--+    |       +----+       |
//          |   B   |            |       |
//          |       |            |       |
//          +-------+            +-------+
// 
// Return a new CSG solid representing space in this solid but not in the
// solid `csg`. Neither this solid nor the solid `csg` are modified.
// 
//     A.subtract(B)
// 
//     +-------+            +-------+
//     |       |            |       |
//     |   A   |            |       |
//     |    +--+----+   =   |    +--+
//     +----+--+    |       +----+
//          |   B   |
//          |       |
//          +-------+
// 
// Return a new CSG solid representing space both this solid and in the
// solid `csg`. Neither this solid nor the solid `csg` are modified.
// 
//     A.intersect(B)
// 
//     +-------+
//     |       |
//     |   A   |
//     |    +--+----+   =   +--+
//     +----+--+    |       +--+
//          |   B   |
//          |       |
//          +-------+
// 

export default CSG