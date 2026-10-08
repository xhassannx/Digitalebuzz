import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

export type LpRevealDirection = "up" | "down" | "left" | "right";

type LpRevealProps = {
  children: ReactNode;
  direction?: LpRevealDirection;
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

const REVEAL_OFFSET: Record<LpRevealDirection, { x: number; y: number }> = {
  up: { x: 0, y: 56 },
  down: { x: 0, y: -56 },
  left: { x: 56, y: 0 },
  right: { x: -56, y: 0 },
};

export function LpReveal({
  children,
  direction = "up",
  delay = 0,
  className,
  style,
}: LpRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px -40px 0px" });
  const reduceMotion = useReducedMotion();
  const offset = REVEAL_OFFSET[direction];

  if (reduceMotion) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: offset.x, y: offset.y }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

type LpHeroParallaxStageProps = {
  children: ReactNode;
  messagesValue?: string;
};

type ParallaxCardProps = {
  className: string;
  depthX: number;
  depthY: number;
  floatDelay?: string;
  children: ReactNode;
};

function ParallaxCard({ className, depthX, depthY, floatDelay, children }: ParallaxCardProps) {
  const reduceMotion = useReducedMotion();
  const wrapStyle = {
    transform: reduceMotion
      ? undefined
      : `translate3d(calc(var(--lp-mx, 0) * ${depthX}px), calc(var(--lp-my, 0) * ${depthY}px), 0)`,
  } as CSSProperties;

  return (
    <div className={`lp-hero-card-pos ${className}`} style={wrapStyle}>
      <div className="lp-hero-card" style={{ "--lp-float-delay": floatDelay ?? "0s" } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

export function LpHeroParallaxStage({ children, messagesValue = "2,840" }: LpHeroParallaxStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (event: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = Math.max(-0.5, Math.min(0.5, nx));
      targetY = Math.max(-0.5, Math.min(0.5, ny));
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      stage.style.setProperty("--lp-mx", String(currentX));
      stage.style.setProperty("--lp-my", String(currentY));
      const heroSection = stage.closest(".lp-hero-section") as HTMLElement | null;
      if (heroSection) {
        heroSection.style.setProperty("--lp-mx", String(currentX));
        heroSection.style.setProperty("--lp-my", String(currentY));
      }
      frame = requestAnimationFrame(tick);
    };

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return (
    <div ref={stageRef} className="lp-hero-stage">
      <div
        className="lp-hero-parallax-bg"
        style={
          reduceMotion
            ? undefined
            : ({
                transform:
                  "translate3d(calc(var(--lp-mx, 0) * -18px), calc(var(--lp-my, 0) * -14px), 0)",
              } as CSSProperties)
        }
      />

      <div className="lp-hero-cards">
        <ParallaxCard className="lp-hero-card-tl" depthX={-22} depthY={-18} floatDelay="0s">
          <div className="lp-hero-card-label">Messages sent today</div>
          <div className="lp-hero-card-value">{messagesValue}</div>
          <div className="lp-hero-card-bar">
            <div className="lp-hero-card-bar-fill" style={{ width: "78%", background: "#2563eb" }} />
          </div>
        </ParallaxCard>

        <ParallaxCard className="lp-hero-card-bl" depthX={-16} depthY={20} floatDelay="-1.2s">
          <div className="lp-hero-card-label">Auto-reply triggered</div>
          <div className="lp-hero-chat lp-hero-chat-out">Where is my order?</div>
          <div className="lp-hero-chat lp-hero-chat-in">Order ships today — track it here →</div>
          <div className="lp-hero-card-foot">Replied in 0.3s</div>
        </ParallaxCard>

        <ParallaxCard className="lp-hero-card-tr" depthX={24} depthY={-16} floatDelay="-0.6s">
          <div className="lp-hero-card-label">Live campaign</div>
          <div className="lp-hero-card-title">Broadcast active</div>
          <div className="lp-hero-card-stats">
            <div>
              <div className="lp-hero-card-stat">62%</div>
              <div className="lp-hero-card-stat-label">Opened</div>
            </div>
            <div>
              <div className="lp-hero-card-stat">18%</div>
              <div className="lp-hero-card-stat-label">Replied</div>
            </div>
          </div>
        </ParallaxCard>

        <ParallaxCard className="lp-hero-card-br" depthX={18} depthY={22} floatDelay="-1.8s">
          <div className="lp-hero-card-label">Team inbox · live</div>
          <div className="lp-hero-inbox-row">
            <span className="lp-hero-inbox-name">Priya S.</span>
            <span className="lp-hero-inbox-tag">Sales</span>
          </div>
          <div className="lp-hero-inbox-msg">Can I get a bulk discount?</div>
          <div className="lp-hero-inbox-row" style={{ marginTop: 8 }}>
            <span className="lp-hero-inbox-name">Rahul M.</span>
            <span className="lp-hero-inbox-tag lp-hero-inbox-tag-alt">Support</span>
          </div>
          <div className="lp-hero-inbox-msg">Payment link sent ✓</div>
          <div className="lp-hero-card-foot">+28 more chats today</div>
        </ParallaxCard>
      </div>

      {children}
    </div>
  );
}
