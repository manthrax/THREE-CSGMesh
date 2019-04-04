# THREE-CSGMesh
Conversion of a CSG library for use with modern THREE.js

[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/CSGScreenShot.png)](#screenshot)

Original version: 
Copyright (c) 2011 Evan Wallace (http://madebyevan.com/), under the MIT license.

THREE.js rework by thrax under MIT license.

Here's a running demo
http://vectorslave.com/csg/CSGDemo.html

Example usage:

# EXAMPLE 1:
Make a helper function to streamline the operation... (I may make this a static function in the lib itself TBD)
```
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
```

# EXAMPLE 2. Verbose... step by step..
```

// Make 2 box meshes.. 

var meshA = new THREE.Mesh(new THREE.BoxGeometry(1,1,1))
var meshB = new THREE.Mesh(new THREE.BoxGeometry(1,1,1))

//offset one of the boxes by half its width..

meshB.position.add(new THREE.Vector3( 0.5, 0.5, 0.5)

//Make sure the .matrix of each mesh is current

meshA.updateMatrix()                                     
meshB.updateMatrix()

 //Create a bsp tree from each of the meshes
 
var bspA = CSG.fromMesh( meshA )                        
var bspB = CSG.fromMesh( meshB )

// Subtract one bsp from the other via .subtract... other supported modes are .union and .intersect
 
var bspResult = bspA.subtract(bspB)

//Get the resulting mesh from the result bsp

var meshResult = CSG.toMesh( bspResult, meshA.matrix )

//Set the results material to the material of the first cube.

meshResult.material = meshA.material

//The following isn't required but illustrates how to convert the result to a bufferGeometry.

 //If the original mesh contained a bufferGeometry,
if(meshA.geometry.isBufferGeometry)
    // make the result a bufferGeometry too
   meshResult.geometry = new THREE.BufferGeometry().fromGeometry(meshResult.geometry)

```



