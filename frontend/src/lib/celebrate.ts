/**
 * Completion feedback — confetti and haptics (MOT-4).
 *
 * The original spec asked for this and it was never built. Ticking something
 * off is the single most repeated interaction in the app and the entire point
 * of the points economy; it currently produces a 0.4s scale bounce and nothing
 * else. This is the payoff.
 *
 * Written by hand rather than pulling in canvas-confetti: the whole thing is
 * about 90 lines of physics, and a dependency-free version keeps the route
 * chunks small, which is the other half of Phase 2.
 *
 * Everything here is best-effort and must never break a completion:
 *   - `navigator.vibrate` does not exist on iOS Safari. It is a no-op there,
 *     and there is no web API that reaches the Taptic Engine, so an installed
 *     iPhone app gets the confetti and no buzz. That is the platform, not a bug.
 *   - `prefers-reduced-motion` suppresses the confetti entirely.
 */

export interface CelebrationOrigin {
    /** Viewport coordinates — clientX/clientY, not page coordinates. */
    x: number;
    y: number;
}

const prefersReducedMotion = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Brand palette, plus a warm accent so it doesn't read as one flat colour. */
const COLORS = ['#6366F1', '#818CF8', '#10B981', '#F59E0B', '#FFFFFF'];

const PARTICLE_COUNT = 46;
const GRAVITY = 0.32;
const DRAG = 0.985;
const FADE_START = 0.65; // fraction of life after which particles fade out

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    rot: number;
    vrot: number;
    color: string;
    life: number;      // frames elapsed
    maxLife: number;   // frames until removal
    round: boolean;
}

// One canvas, reused for every burst. Creating and destroying a full-viewport
// canvas per tap is a layer thrash the compositor does not need.
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let rafId = 0;

const ensureCanvas = (): CanvasRenderingContext2D | null => {
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, {
            position: 'fixed',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            // Above the toast viewport (1000) and the prompts, below nothing
            // that matters — it is purely decorative and never interactive.
            zIndex: '2000'
        } as Partial<CSSStyleDeclaration>);
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
    }

    // Re-size on every burst: cheaper than a resize listener that has to stay
    // alive for the life of the page, and the viewport can only have changed
    // between bursts anyway.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
};

const teardown = () => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    particles = [];
    canvas?.remove();
    canvas = null;
    ctx = null;
};

const tick = () => {
    const context = ctx;
    if (!context || !canvas) return teardown();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const viewportHeight = window.innerHeight;

    particles = particles.filter(p => {
        p.life += 1;
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.vy *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        // Retire once it has fallen off the bottom or outlived its budget.
        if (p.life > p.maxLife || p.y - p.h > viewportHeight) return false;

        const progress = p.life / p.maxLife;
        context.globalAlpha = progress < FADE_START
            ? 1
            : 1 - (progress - FADE_START) / (1 - FADE_START);

        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.rot);
        context.fillStyle = p.color;
        if (p.round) {
            context.beginPath();
            context.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            context.fill();
        } else {
            // Scaling height by cos() fakes the flutter of a tumbling scrap.
            context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.14)));
        }
        context.restore();
        return true;
    });

    context.globalAlpha = 1;

    if (particles.length === 0) return teardown();
    rafId = requestAnimationFrame(tick);
};

/**
 * A short confetti burst. `origin` is in viewport coordinates and defaults to
 * slightly above centre; pass the checkbox position so the celebration comes
 * out of the thing that was tapped.
 */
export const confettiBurst = (origin?: CelebrationOrigin) => {
    if (prefersReducedMotion()) return;

    const context = ensureCanvas();
    if (!context) return;

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight * 0.4;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Bias upward — confetti that only ever falls looks like a leak.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
        const speed = 5 + Math.random() * 7;
        const round = Math.random() < 0.28;
        const size = 5 + Math.random() * 5;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            w: size,
            h: round ? size : size * (0.5 + Math.random() * 0.5),
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.35,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            life: 0,
            maxLife: 70 + Math.floor(Math.random() * 45),
            round
        });
    }

    if (!rafId) rafId = requestAnimationFrame(tick);
};

/**
 * A short vibration where the platform supports it.
 *
 * Android and desktop Chrome honour this. iOS Safari has no Vibration API at
 * all — installed or not — so this silently does nothing there.
 */
export const haptic = (pattern: number | number[] = 14) => {
    try {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch {
        // Some browsers throw if the document has never been interacted with.
        // A missing buzz is not worth a thrown error inside a completion path.
    }
};

/**
 * Full completion celebration. Call this *after* the write has succeeded —
 * celebrating an optimistic update that later fails is the same class of lie
 * Phase 1 spent its time removing.
 */
export const celebrate = (origin?: CelebrationOrigin) => {
    haptic();
    confettiBurst(origin);
};

/** Convenience: centre of an element's box, for celebrations driven by a click. */
export const originFromElement = (el: Element | null | undefined): CelebrationOrigin | undefined => {
    if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
