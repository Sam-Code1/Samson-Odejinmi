"use client";

import { Suspense, lazy } from "react";

/**
 * Spline 3D scene (from 21st.dev "splite"). Changes for this project: the loader uses the project's `.loader` style
 * and has an accessible label. The Spline runtime is code-split and only downloaded when this component renders.
 */
const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
  /** Called once the scene has finished loading (used to fade it in over the poster). */
  onLoad?: () => void;
}

export function SplineScene({ scene, className, onLoad }: SplineSceneProps) {
  return (
    <Suspense
      fallback={null}
    >
      <Spline scene={scene} className={className} onLoad={onLoad ? () => onLoad() : undefined} />
    </Suspense>
  );
}
