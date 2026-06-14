"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Effet de survol lumineux sur un texte SVG.
 * 
 * Au survol :
 * - Un stroke doré animé dessine le texte en continu
 * - Un masque radial qui suit le curseur révèle un dégradé Helm (or→navy→bleu)
 * - Le texte de fond apparaît en contour fin blanc
 * 
 * Palette Helm :
 * - Stroke principal : or #f5b335
 * - Gradient de survol : or → navy → bleu Helm
 * 
 * FIX : viewBox élargi à 500x100 pour "ACADEMIA HELM" sans troncature
 */
export const TextHoverEffect = ({
  text,
  duration,
  className,
}: {
  text: string;
  duration?: number;
  automatic?: boolean;
  className?: string;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  // Calculer la largeur du viewBox en fonction du texte
  const charCount = text.length;
  const viewBoxWidth = Math.max(300, charCount * 32);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBoxWidth} 100`}
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className={cn("select-none uppercase cursor-pointer", className)}
    >
      <defs>
        {/* Gradient de survol — palette Academia Helm : or → navy → bleu → or */}
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={viewBoxWidth}
          y2="100"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#f5b335" />
              <stop offset="25%" stopColor="#0b2f73" />
              <stop offset="50%" stopColor="#1d4fa5" />
              <stop offset="75%" stopColor="#f5b335" />
              <stop offset="100%" stopColor="#ffd166" />
            </>
          )}
        </linearGradient>

        {/* Masque radial qui suit le curseur */}
        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="30%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>

      {/* Texte de fond en contour fin — visible uniquement au hover */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-white/10 font-[system-ui,_sans-serif] font-bold"
        style={{ fontSize: '70px', opacity: hovered ? 0.7 : 0 }}
      >
        {text}
      </text>

      {/* Texte animé — stroke doré qui se dessine en continu */}
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-[#f5b335] font-[system-ui,_sans-serif] font-bold"
        style={{ fontSize: '70px' }}
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "loop",
        }}
      >
        {text}
      </motion.text>

      {/* Texte avec masque gradient qui suit le curseur */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        mask="url(#textMask)"
        className="fill-transparent font-[system-ui,_sans-serif] font-bold"
        style={{ fontSize: '70px' }}
      >
        {text}
      </text>
    </svg>
  );
};


/**
 * Fond de gradient pour le footer — palette Academia Helm.
 * Radial gradient Navy → or translucide.
 */
export const FooterBackgroundGradient = () => {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        background:
          "radial-gradient(125% 125% at 50% 10%, #0b2f7366 50%, #f5b33522 100%)",
      }}
    />
  );
};
