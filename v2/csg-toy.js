import * as THREE from 'three';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
//import CanvasRecorder from "./canvas-recorder.js"
import UI from "./ui.js"
import CSG from "../three-csg.js";
import FCAD from "./fcad.js";

document.addEventListener('init', (e)=>{
    let {renderer, transformControls, elements, scene, materials, transformGroup} = e.app;

    let fc;
    let cadScene = new THREE.Group();
    scene.add(cadScene);
    fc = new FCAD(cadScene,materials);
    elements.set(fc.update());

    let simplified;
    let simplifier;
    simplifier = (mesh)=>{
        var modifier = new SimplifyModifier();
        if (simplified)
            scene.remove(simplified)
        simplified = mesh.clone();
        simplified.material = simplified.material.clone();
        simplified.material.flatShading = true;
        simplified.material.side = THREE.DoubleSide;
        let factor = (window.simpFactor !== undefined) ? (parseInt(window.simpFactor.value) / 1000) : 0

        var count
        if (simplified.geometry.isGeometry) {
            count = simplified.geometry.vertices.length;
            // = new THREE.BufferGeometry().fromGeometry(simplified.geometry)
        } else {
            count = simplified.geometry.attributes.position.count
        }
        //simplified.geometry.mergeVertices()
        count = Math.floor(count * factor);
        // number of vertices to remove
        simplified.geometry = modifier.modify(simplified.geometry, count);

        simplified.position.x += 5;
        simplified.rotation.y = -Math.PI * .25;
        scene.add(simplified);
    }

    let tbox = new THREE.Box3();
    let enforceGround = mesh=>{
        let par = mesh.parent;
        scene.attach(mesh)
        tbox.setFromObject(mesh);
        if (tbox.min.y < 0)
            mesh.position.y -= tbox.min.y
        par.attach(mesh)
    }

    let updateCSG = ()=>{

        elements.forSelected((e,i)=>{
            scene.attach(e);
            e.updateMatrixWorld();
            e.userData.node._position.copy(e.position)
            e.userData.node._scale.copy(e.scale)
            e.userData.node._rotation.copy(e.rotation)
            e.userData.node.bspNeedsUpdate = true;
            //console.log(e.userData.node.type,e.userData.node._position)
        }
        )

        if (simplifier && (elements.elements.length > 0))
            simplifier(elements.elements[elements.elements.length - 1])
        elements.set(fc.update());
        elements.forEach(enforceGround);
        elements.forSelected((e,i)=>transformGroup.attach(e));
        elements.update()
    }

    fc.updateCSG = updateCSG

    transformControls.addEventListener("objectChange", event=>{
        //console.log("OC")
        if (elements.selectedCount) {
            updateCSG()
        }
    }
    )

    document.addEventListener('mouseChange', (e)=>{
        let event = e.event;
        if (event.type === "mouseup") {
            updateCSG()
        }
    }
    );

    let setOperationsOnSelection = (mode)=>{
        elements.forSelected(e=>e.userData.node.operation = mode)

        elements.set(fc.update());
    }

    document.addEventListener("addButton", e=>{
        console.log("Add prim:",e.primType)
        let top = fc.nodes.pop()
        let nn = new FCAD.FNode(fc,e.primType).position(2,2,2)
        fc.addNode(nn);
        fc.addNode(top)
        top.args.push(nn);
    })

    document.addEventListener("opButton", e=>setOperationsOnSelection(e.operation))
    window.addEventListener("keydown", e=>{
        if (e.shiftKey)
            transformControls.setMode("translate");
        if (e.ctrlKey)
            transformControls.setMode("rotate");
        if (e.altKey)
            transformControls.setMode("scale");
        if (e.code === 'Equal')
            setOperationsOnSelection('union')
        if (e.code === 'Minus')
            setOperationsOnSelection('subtract')
        if (e.code === 'Backslash')
            setOperationsOnSelection('intersect')

        if (e.code === 'KeyA')
            (elements.selectedCount > 0) ? elements.forEach((e,i)=>elements.deselect(i)) : elements.forEach((e,i)=>elements.select(i))
    }
    , false);
    
    //CanvasRecorder(renderer.domElement)
    //window.canvasRecorder.style.left = '0px'

    UI(renderer.domElement)

}
)
