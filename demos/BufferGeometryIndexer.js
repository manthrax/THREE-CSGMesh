import * as THREE from "three"

function reindexBufferGeometry(bufferGeometry,options){
    let nonIndexed = bufferGeometry.index ? bufferGeometry.toNonIndexed() : bufferGeometry   
    let attribs = nonIndexed.attributes
    let extractVertex = (index) =>{
        let out={}
        for(let j in attribs){
            let attr=attribs[j];
            let isz = attr.itemSize;
            let aout = out[j]=[]
            let aisz = index * isz
            for(let k=0;k<isz;k++)
                aout.push(attr.array[k+aisz])
        }
        return out
    }
    let hashVertex = (vtx)=>{
        return JSON.stringify(vtx)
    }
    let verts = attribs.position
    let uniqueVerts=[]
    let uniqueIndices={}
    let indices=[]
    for(let i=0,ct=verts.count;i<ct;i++){
        let vert = extractVertex(i)
        let hash = ''+JSON.stringify(vert)
        let idx = uniqueIndices[hash]
        if(idx===undefined){
            idx = uniqueIndices[hash] = uniqueVerts.length;
            uniqueVerts.push(vert)
        }
        indices.push(idx)
    }
    let outAttrs={}
    for(let j in attribs){
        let attr=attribs[j];
        outAttrs[j]=[];
       // console.log("before:",j,attr.count * attr.itemSize)
    }
    for(let i=0;i<uniqueVerts.length;i++){
        let vert = uniqueVerts[i]
        for(let j in vert)
            for(let k=0;k<vert[j].length;k++)
                outAttrs[j].push(vert[j][k])
    }
    for(let j in outAttrs){
        let attr=attribs[j];
      //  console.log("after:",j,attr.count * attr.itemSize,outAttrs[j].length)
    }
}

/* test
(function(){
    let geom = new THREE.SphereGeometry(1,32,32)
    let mesh = new THREE.Mesh(geom)
    reindexBufferGeometry( mesh.geometry )
})()
*/

export default reindexBufferGeometry