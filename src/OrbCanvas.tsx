import { useEffect, useRef } from "react";

export type OrbState = "idle" | "focus" | "sending" | "success";

interface OrbCanvasProps {
  state: OrbState;
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

type Rgb = readonly [number, number, number];

interface Orbit {
  radius: number; // en múltiplos del radio del orbe
  tilt: readonly [number, number, number];
  speed: number;
  phase: number;
  size: number;
  color: Rgb;
}

const TEAL: Rgb = [17, 157, 164];
const DEEP: Rgb = [25, 100, 126];
const MINT: Rgb = [15, 255, 149];
const PAPER: Rgb = [242, 242, 242];

const ORBITS: Orbit[] = [
  { radius: 1.45, tilt: [0.5, 0, 0.35], speed: 0.9, phase: 0, size: 5, color: MINT },
  { radius: 1.85, tilt: [-0.4, 0, -0.6], speed: -0.6, phase: 2.1, size: 6.5, color: TEAL },
  { radius: 2.25, tilt: [0.9, 0, 0.1], speed: 0.38, phase: 4.2, size: 4, color: PAPER },
];

// Velocidad global de la animación según el estado del formulario
const SPEED: Record<OrbState, number> = {
  idle: 1,
  focus: 2.2,
  sending: 5,
  success: 2.4,
};

const SPHERE_COUNT = 520;
const SPHERE_POINTS: Vec[] = Array.from({ length: SPHERE_COUNT }, (_, i) => {
  const k = (i + 0.5) / SPHERE_COUNT;
  const phi = Math.acos(1 - 2 * k);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    x: Math.cos(theta) * Math.sin(phi),
    y: Math.cos(phi),
    z: Math.sin(theta) * Math.sin(phi),
  };
});

const RING_STEPS = 96;

const rgba = (c: Rgb, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const rotate = (p: Vec, ax: number, ay: number, az: number): Vec => {
  let { x, y, z } = p;
  let c = Math.cos(ax);
  let s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay);
  s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(az);
  s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return { x, y, z };
};

export default function OrbCanvas({ state }: OrbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const pulseRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
    if (state === "success") pulseRef.current = 1;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let spin = 0;
    let speed = 1;
    const orbitT = ORBITS.map((o) => o.phase);

    const draw = (dt: number) => {
      const target = SPEED[stateRef.current];
      speed += (target - speed) * Math.min(1, dt * 3);
      pulseRef.current = Math.max(0, pulseRef.current - dt * 0.8);
      const pulse = pulseRef.current;
      spin += dt * 0.25 * speed;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.17;
      const fov = R * 7;
      const sceneTilt = 0.38;

      const project = (p: Vec) => {
        const s = fov / (fov + p.z);
        return { x: cx + p.x * s, y: cy + p.y * s, s };
      };

      const place = (o: Orbit, a: number): Vec =>
        rotate(
          rotate(
            { x: Math.cos(a) * o.radius * R, y: 0, z: Math.sin(a) * o.radius * R },
            o.tilt[0],
            o.tilt[1],
            o.tilt[2]
          ),
          sceneTilt,
          spin * 0.2,
          0
        );

      const drawRing = (o: Orbit, front: boolean) => {
        ctx.beginPath();
        for (let i = 0; i < RING_STEPS; i++) {
          const p0 = place(o, (i / RING_STEPS) * Math.PI * 2);
          const p1 = place(o, ((i + 1) / RING_STEPS) * Math.PI * 2);
          if (((p0.z + p1.z) / 2 >= 0) !== front) continue;
          const s0 = project(p0);
          const s1 = project(p1);
          ctx.moveTo(s0.x, s0.y);
          ctx.lineTo(s1.x, s1.y);
        }
        ctx.strokeStyle = rgba(TEAL, front ? 0.5 : 0.18);
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      const drawPlanet = (o: Orbit, t: number, front: boolean) => {
        const pos = place(o, t);
        if (pos.z >= 0 !== front) return;
        const dir = Math.sign(o.speed);

        for (let k = 1; k <= 14; k++) {
          const q = project(place(o, t - dir * k * 0.045));
          const r = o.size * q.s * (1 - k / 18) * 0.6;
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(r, 0.4), 0, Math.PI * 2);
          ctx.fillStyle = rgba(o.color, (1 - k / 15) * 0.45);
          ctx.fill();
        }

        const p = project(pos);
        const rad = o.size * p.s;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 4.5);
        glow.addColorStop(0, rgba(o.color, 0.85));
        glow.addColorStop(1, rgba(o.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = rgba(o.color, 1);
        ctx.fill();
      };

      const drawSpherePoints = (front: boolean) => {
        for (const base of SPHERE_POINTS) {
          const p = rotate(
            { x: base.x * R, y: base.y * R, z: base.z * R },
            sceneTilt,
            spin,
            0
          );
          if (p.z >= 0 !== front) continue;
          const depth = (p.z / R + 1) / 2;
          const s = project(p);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.15 * s.s, 0, Math.PI * 2);
          ctx.fillStyle = rgba(mix(DEEP, MINT, depth * depth), front ? 0.35 + depth * 0.65 : 0.22);
          ctx.fill();
        }
      };

      // Resplandor de fondo (crece con el pulso de éxito)
      const halo = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 2.6);
      halo.addColorStop(0, rgba(TEAL, 0.32 + pulse * 0.3));
      halo.addColorStop(1, rgba(TEAL, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Atrás del orbe
      ORBITS.forEach((o) => drawRing(o, false));
      ORBITS.forEach((o, i) => drawPlanet(o, orbitT[i], false));
      drawSpherePoints(false);

      // Cuerpo del orbe
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      body.addColorStop(0, rgba(DEEP, 0.7));
      body.addColorStop(0.7, "rgba(3, 3, 1, 0.92)");
      body.addColorStop(1, rgba(TEAL, 0.5));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2);
      ctx.fill();

      // Frente del orbe
      drawSpherePoints(true);
      ORBITS.forEach((o) => drawRing(o, true));
      ORBITS.forEach((o, i) => drawPlanet(o, orbitT[i], true));

      // Onda expansiva al enviar con éxito
      if (pulse > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.1 + (1 - pulse) * 2.6), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(MINT, pulse * 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduceMotion) draw(0);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ORBITS.forEach((o, i) => {
        orbitT[i] += dt * speed * o.speed;
      });
      draw(dt);
      raf = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    if (!reduceMotion) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" />;
}
