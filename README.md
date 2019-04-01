# THREE-CSGMesh
Conversion of a CSG library for use with modern THREE.js


Example usage:

 function doCSG(a,b,op,mat){
    var bspA = CSG.fromMesh( a );
    var bspB = CSG.fromMesh( b );
    var bspC = bspA[op]( bspB );
    var result = CSG.toMesh( bspC, a.matrix );
    result.material = mat;
    result.castShadow  = result.receiveShadow = true;
    return result;
}

var meshA = new THREE.Mesh(new THREE.BoxGeometry(1,1,1));

var meshB = new THREE.Mesh(new THREE.BoxGeometry(1,1,1));

meshB.position.add(new THREE.Vector3( 0.5, 0.5, 0.5);

var meshC = doCSG( meshA,meshB, 'subtract',meshA.material);
