import * as THREE from "../../../three.js-dev/build/three.module.js";
let vs = `
varying vec3 vertex;
  void main() {
  vertex = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`


let gridValFrag=`
float gridVal;
{
  vec2 coord = (vUv.xy-.5)*GRID_SIZE;// Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = min(grid.x, grid.y);
  gridVal =  1.0 - min(line, 1.0);
  if(gridVal<.001)gridVal=0.;//discard;
}
`
let fs = `
// License: CC0 (http://creativecommons.org/publicdomain/zero/1.0/)
//#extension GL_OES_standard_derivatives : enable
varying vec3 vertex;
uniform vec4 color;
void main() {
${gridValFrag}
  gl_FragColor = vec4(color.xyz, color.w*gridVal);// Just visualize the grid lines directly
}
`

class GridMaterial{
  constructor(template,gridSz=10.) {
    template = template.clone();
    if(template){
      template.onBeforeCompile = (shader,renderer)=>{
        shader.fragmentShader=shader.fragmentShader.replace(`#ifdef TRANSPARENCY
		diffuseColor.a`,`
#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
  //varying vec2 vUv;
  //outgoingLight.rgb=vec3(1.,0.,0.);
  ${gridValFrag}
  diffuseColor.a *= max(gridVal,diffuseColor.a);
//    diffuseColor.a *= gridVal;
//outgoingLight.rgb = vec3(1.)-outgoingLight.rgb;
outgoingLight.rgb = outgoingLight.brg;
#endif
#ifdef TRANSPARENCY
diffuseColor.a`)
//replace(`uniform`,`uniform float gridScale;
//uniform`).
.replace('GRID_SIZE',(gridSz|0)+'.')
        //console.log(shader.fragmentShader)
      }
      return template
    }else
      return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
        color: { value: new THREE.Vector4(1,1,1,1) },
        gridScale:{value:1.}
      },
      vertexShader:vs,
      fragmentShader: fs,
      extensions:{derivatives:true},
      transparent:true,
      side:THREE.DoubleSide
    })
  }
  static makeGrid(material){
    

let grid = new THREE.Mesh(
  new THREE.PlaneGeometry(20.00, 20.00),
  new GridMaterial(
    material || new THREE.MeshStandardMaterial({
      map: new THREE.TextureLoader().load(
        "https://cdn.glitch.com/02b1773f-db1a-411a-bc71-ff25644e8e51%2Fmandala.jpg?v=1594201375330"
      ),
      transparent: true,
      opacity: 1,
      alphaTest: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  )
);
grid.rotation.x = Math.PI * -0.5;
grid.renderOrder = 0;
    return grid;
  }
}

export default GridMaterial


/*

let plane = new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.ShaderMaterial({
  uniforms:{map:{value:grid.material.map}},
  vertexShader:`varying vec2 vUv;void main() {vUv = uv;gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );}`,
  fragmentShader:`varying vec2 vUv; 
float hexDist(vec2 p){
  p=abs(p);
  float c = dot(p,normalize(vec2(1,1.73)));
  c=max(c,p.x);
  return c;
}
void main(){
vec2 uv = vUv * 10.;
float s3 = 0.86602540378;

float p0=fract(dot(vec2(0,1),uv)+.2);
float p1=fract(dot(vec2( s3,.5),uv));
float p2=fract(dot(vec2(-s3,.5),uv));
gl_FragColor =vec4(0.,0.,((p0>.79)&&(p0<.8))?1.:0.,1.);
gl_FragColor+=vec4(0.,0.,((p1>.79)&&(p1<.8))?1.:0.,1.);
gl_FragColor+=vec4(0.,0.,((p2>.79)&&(p2<.8))?1.:0.,1.);

}`
,side:THREE.DoubleSide}))
plane.position.y = -.1;
plane.rotation.x = Math.PI*.5;
scene.add(plane)
*/
