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
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center" role="status" aria-label="Loading 3D scene">
          <span className="loader" aria-hidden />
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
