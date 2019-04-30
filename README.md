# THREE-CSGMesh
Conversion of a CSG - (Constructive Solid Geometry) library for use with modern THREE.js

[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/CSGScreenShot.png)](#screenshot)

Original version: 
Copyright (c) 2011 Evan Wallace (http://madebyevan.com/), under the MIT license.

THREE.js rework by thrax under MIT license.

Here's a running demo
http://vectorslave.com/csg/CSGDemo.html

CSG is the name of a technique for generating a new geometry as a function of two input geometries.

CSG is sometimes referred to as "Boolean" operators in 3d modelling packages.

Internally it uses a structure called a BSP (binary space partitioning) tree to carry out these operations.

The supported operations are .subtract, .union, and .intersect.

By using different combinations of these 3 operations, and changing the order of the input models, you can construct any combination of the input models.

In the screenshot/demo above, I show the possible results with a cube and a sphere...

In blue is the result of the .union operation, for  sphere->cube and cube->sphere (the result is same in this case )

In green is the result of the .intersect operation, for  sphere->cube and cube->sphere (the result is same in this case )

In red is the result of the .subtract operation, for  sphere->cube and cube->sphere. Here the result differs based on the order of the inputs.

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



