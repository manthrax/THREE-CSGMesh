# THREE-CSGMesh
Conversion of a CSG - (Constructive Solid Geometry) library for use with modern THREE.js


Original version: 
Copyright (c) 2011 Evan Wallace (http://madebyevan.com/), under the MIT license.

THREE.js rework by thrax under MIT license.

Here's a running demo
https://manthrax.github.io/THREE-CSGMesh/demos/CSGDemo.html
[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/assets/CSGScreenshot.jpg)](#screenshot)

And a shinier, slightly more complex demo:
https://manthrax.github.io/THREE-CSGMesh/demos/CSGShinyDemo.html

[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/assets/CSGShinyScreenshot.jpg)](#screenshot)

And a more complex example showing a text mesh cut into another complex mesh via an intermediate cube:

https://manthrax.github.io/THREE-CSGMesh/v2/index.html
[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/assets/V2TestScreenshot.jpg)](#screenshot)

An example showing multiple material groups, and vertex color channel:

https://manthrax.github.io/THREE-CSGMesh/demos/CSGMulti.html

[![csg screenshot](https://raw.githubusercontent.com/manthrax/THREE-CSGMesh/master/assets/CGStressScreenshot.jpg)](#screenshot)

CSG is the name of a technique for generating a new geometry as a function of two input geometries.

CSG is sometimes referred to as "Boolean" operators in 3d modelling packages.

Internally it uses a structure called a BSP (binary space partitioning) tree to carry out these operations.

The supported operations are .subtract, .union, and .intersect.

By using different combinations of these 3 operations, and changing the order of the input models, you can construct any combination of the input models.

In the first screenshot/demo above, I show the possible results with a cube and a sphere...

In blue is the result of the .union operation, for  sphere->cube and cube->sphere (the result is same in this case )

In green is the result of the .intersect operation, for  sphere->cube and cube->sphere (the result is same in this case )

In red is the result of the .subtract operation, for  sphere->cube and cube->sphere. Here the result differs based on the order of the inputs.

Example usage:


# EXAMPLE 0:
```js
//Minimal example.. subtract mesh b from mesh a:
import {CSG} from "three-csg.js"
scene.add(CSG.toMesh(CSG.subtract(CSG.fromMesh(a),CSG.fromMesh(b)),a.material))
```

# EXAMPLE 1. Verbose... step by step..
```js

// Make 2 box meshes.. 

let meshA = new THREE.Mesh(new THREE.BoxGeometry(1,1,1))
let meshB = new THREE.Mesh(new THREE.BoxGeometry(1,1,1))

//offset one of the boxes by half its width..

meshB.position.add(new THREE.Vector3( 0.5, 0.5, 0.5)

//Make sure the .matrix of each mesh is current

meshA.updateMatrix()
meshB.updateMatrix()

 //Create a bsp tree from each of the meshes
 
let bspA = CSG.fromMesh( meshA )                        
let bspB = CSG.fromMesh( meshB )

// Subtract one bsp from the other via .subtract... other supported modes are .union and .intersect
 
let bspResult = bspA.subtract(bspB)

//Get the resulting mesh from the result bsp, and assign meshA.material to the resulting mesh

let meshResult = CSG.toMesh( bspResult, meshA.matrix, meshA.material )

```
