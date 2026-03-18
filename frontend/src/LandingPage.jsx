"use client"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { useEffect, useRef } from "react"
import "./LandingPage.css"

/* ─────────────────────────────────────────────
   LineWaves — self-contained WebGL background
   ───────────────────────────────────────────── */
function hexToVec3(hex) {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;
#define HALF_PI 1.5707963
float hashF(float n) { return fract(sin(n*127.1)*43758.5453123); }
float smoothNoise(float x) {
  float i=floor(x);float f=fract(x);
  float u=f*f*(3.0-2.0*f);
  return mix(hashF(i),hashF(i+1.0),u);
}
float displaceA(float coord,float t){
  float r=sin(coord*2.123)*0.2;
  r+=sin(coord*3.234+t*4.345)*0.1;
  r+=sin(coord*0.589+t*0.934)*0.5;
  return r;
}
float displaceB(float coord,float t){
  float r=sin(coord*1.345)*0.3;
  r+=sin(coord*2.734+t*3.345)*0.2;
  r+=sin(coord*0.189+t*0.934)*0.3;
  return r;
}
vec2 rotate2D(vec2 p,float angle){
  float c=cos(angle);float s=sin(angle);
  return vec2(p.x*c-p.y*s,p.x*s+p.y*c);
}
void main(){
  vec2 coords=gl_FragCoord.xy/uResolution.xy;
  coords=coords*2.0-1.0;
  coords=rotate2D(coords,uRotation);
  float halfT=uTime*uSpeed*0.5;
  float fullT=uTime*uSpeed;
  float mouseWarp=0.0;
  if(uEnableMouse){
    vec2 mPos=rotate2D(uMouse*2.0-1.0,uRotation);
    float mDist=length(coords-mPos);
    mouseWarp=uMouseInfluence*exp(-mDist*mDist*4.0);
  }
  float warpAx=coords.x+displaceA(coords.y,halfT)*uWarpIntensity+mouseWarp;
  float warpAy=coords.y-displaceA(coords.x*cos(fullT)*1.235,halfT)*uWarpIntensity;
  float warpBx=coords.x+displaceB(coords.y,halfT)*uWarpIntensity+mouseWarp;
  float warpBy=coords.y-displaceB(coords.x*sin(fullT)*1.235,halfT)*uWarpIntensity;
  vec2 fieldA=vec2(warpAx,warpAy);
  vec2 fieldB=vec2(warpBx,warpBy);
  vec2 blended=mix(fieldA,fieldB,mix(fieldA,fieldB,0.5));
  float fadeTop=smoothstep(uEdgeFadeWidth,uEdgeFadeWidth+0.4,blended.y);
  float fadeBottom=smoothstep(-uEdgeFadeWidth,-(uEdgeFadeWidth+0.4),blended.y);
  float vMask=1.0-max(fadeTop,fadeBottom);
  float tileCount=mix(uOuterLines,uInnerLines,vMask);
  float scaledY=blended.y*tileCount;
  float nY=smoothNoise(abs(scaledY));
  float ridge=pow(step(abs(nY-blended.x)*2.0,HALF_PI)*cos(2.0*(nY-blended.x)),5.0);
  float lines=0.0;
  for(float i=1.0;i<3.0;i+=1.0)
    lines+=pow(max(fract(scaledY),fract(-scaledY)),i*2.0);
  float pattern=vMask*lines;
  float cycleT=fullT*uColorCycleSpeed;
  float rC=(pattern+lines*ridge)*(cos(blended.y+cycleT*0.234)*0.5+1.0);
  float gC=(pattern+vMask*ridge)*(sin(blended.x+cycleT*1.745)*0.5+1.0);
  float bC=(pattern+lines*ridge)*(cos(blended.x+cycleT*0.534)*0.5+1.0);
  vec3 col=(rC*uColor1+gC*uColor2+bC*uColor3)*uBrightness;
  float alpha=clamp(length(col),0.0,1.0);
  gl_FragColor=vec4(col,alpha);
}
`

function LineWavesBg() {
  const containerRef = useRef(null)
  useEffect(() => {
    let animId, cleanupFn
    async function init() {
      if (!containerRef.current) return
      const container = containerRef.current
      let oglModule
      try { oglModule = await import("ogl") }
      catch { console.warn("LineWaves: run `npm i ogl`"); return }
      const { Renderer, Program, Mesh, Triangle } = oglModule
      const renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0)
      let cur = [0.5, 0.5], tgt = [0.5, 0.5]
      const onMove = (e) => {
        const r = gl.canvas.getBoundingClientRect()
        tgt = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]
      }
      const onLeave = () => { tgt = [0.5, 0.5] }
      let program
      function resize() {
        renderer.setSize(container.offsetWidth, container.offsetHeight)
        if (program) program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height]
      }
      window.addEventListener("resize", resize)
      resize()
      const geometry = new Triangle(gl)
      program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime:            { value: 0 },
          uResolution:      { value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height] },
          uSpeed:           { value: 0.25 },
          uInnerLines:      { value: 28.0 },
          uOuterLines:      { value: 32.0 },
          uWarpIntensity:   { value: 0.75 },
          uRotation:        { value: (-45 * Math.PI) / 180 },
          uEdgeFadeWidth:   { value: 0.0 },
          uColorCycleSpeed: { value: 0.5 },
          uBrightness:      { value: 0.30 },
          /* white · cool silver · steel grey */
          uColor1:          { value: hexToVec3("#FFFFFF") },
          uColor2:          { value: hexToVec3("#C8D0DC") },
          uColor3:          { value: hexToVec3("#8A9BB0") },
          uMouse:           { value: new Float32Array([0.5, 0.5]) },
          uMouseInfluence:  { value: 1.6 },
          uEnableMouse:     { value: false },
        },
      })
      const mesh = new Mesh(gl, { geometry, program })
      container.appendChild(gl.canvas)
      gl.canvas.addEventListener("mousemove", onMove)
      gl.canvas.addEventListener("mouseleave", onLeave)
      function update(t) {
        animId = requestAnimationFrame(update)
        program.uniforms.uTime.value = t * 0.001
        cur[0] += 0.05 * (tgt[0] - cur[0])
        cur[1] += 0.05 * (tgt[1] - cur[1])
        program.uniforms.uMouse.value[0] = cur[0]
        program.uniforms.uMouse.value[1] = cur[1]
        renderer.render({ scene: mesh })
      }
      animId = requestAnimationFrame(update)
      return () => {
        cancelAnimationFrame(animId)
        window.removeEventListener("resize", resize)
        gl.canvas.removeEventListener("mousemove", onMove)
        gl.canvas.removeEventListener("mouseleave", onLeave)
        if (container.contains(gl.canvas)) container.removeChild(gl.canvas)
        gl.getExtension("WEBGL_lose_context")?.loseContext()
      }
    }
    init().then(fn => { cleanupFn = fn })
    return () => { cleanupFn?.(); cancelAnimationFrame(animId) }
  }, [])
  return <div ref={containerRef} className="lw-wrap" />
}

/* ─────────────────────────────────────────────
   Landing Page
   ───────────────────────────────────────────── */
export default function HeroGeometric({
  title1 = "Welcome to",
  title2 = "FLO.",
}) {
  const navigate = useNavigate()
  const fadeUp = {
    hidden: { opacity: 0, y: 36 },
    visible: (i) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.6, delay: 0.25 + i * 0.14, ease: [0.25, 0.4, 0.25, 1] },
    }),
  }

  return (
    <div className="lp-root">
      <LineWavesBg />
      <div className="lp-vignette" aria-hidden="true" />
      <div className="lp-dotgrid" aria-hidden="true" />
      <div className="lp-bracket lp-bracket--tl" aria-hidden="true" />
      <div className="lp-bracket lp-bracket--br" aria-hidden="true" />

      <div className="lp-center">

        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-rule" />
            <span className="lp-eyebrow-text">{title1}</span>
            <span className="lp-eyebrow-rule" />
          </div>
        </motion.div>

        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <h1 className="lp-wordmark">{title2}</h1>
        </motion.div>

        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <p className="lp-sub">Event Registration System</p>
        </motion.div>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <button className="nb-glow-btn" onClick={() => navigate("/login")}>
            <div id="container-stars">
              <div id="stars" />
            </div>
            <div id="glow">
              <div className="circle" />
              <div className="circle" />
            </div>
            <strong>ENTER</strong>
          </button>
        </motion.div>

      </div>

      <span className="lp-version">EPASS · v2.0</span>
    </div>
  )
}