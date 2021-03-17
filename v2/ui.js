
class UI
{

}

function init(){
    let w=window
    let opButtonEvt = new Event('opButton')
    let opButton=(e)=>{
        opButtonEvt.operation = e.target.innerText
        setTimeout(()=>document.dispatchEvent(opButtonEvt),0)
        
    }
    w.csgSubtract && (w.csgSubtract.onclick = opButton)
    w.csgUnion && (w.csgUnion.onclick = opButton)
    w.csgIntersect && (w.csgIntersect.onclick = opButton)

    let opAddButtonEvt = new Event('addButton')
    let addBtnClick =(e)=>{
        opAddButtonEvt.primType = e.target.innerText
        setTimeout(()=>document.dispatchEvent(opButtonEvt),0)
    }
    w.csgAddBox && (w.csgAddBox.onclick = addBtnClick)
    w.csgAddSphere && (w.csgAddSphere.onclick = addBtnClick)
    w.csgAddCylinder && (w.csgAddCylinder.onclick = addBtnClick)

    let cvclick = (e)=>e.target.style.height = ((e.target.style.height=="15px")?e.target.scrollHeight+"px":"15px")
    window.codeView.onclick = cvclick;
    document.addEventListener('cadRecomputed',(e)=>{
        window.codeView.innerText =  '[code]\n'+JSON.stringify(e.jsobj, undefined, 4);
        window.codeView.onclick = cvclick
    })
}

export default init;