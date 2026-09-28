"use client";

import { ReactNode, CSSProperties } from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  title?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  disableAnimation?: boolean;
  style?: CSSProperties;
}

export default function Card({
  title,
  children,
  className = "",
  delay = 0,
  disableAnimation = false,
  style,
  ...props
}: CardProps) {
  if (disableAnimation) {
    return (
      <div className={`glass-card ${className}`} style={style}>
        {title && <h3 className="card-title">{title}</h3>}
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.48,
        ease: [0.16, 1, 0.3, 1],
        delay,
      }}
      className={`glass-card ${className}`}
      style={style}
      {...props}
    >
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </motion.div>
  );
}
