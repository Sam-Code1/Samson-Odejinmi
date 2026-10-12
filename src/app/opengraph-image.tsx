import { ImageResponse } from "next/og";

export const alt = "Samson Odejinmi — 3D Artist, Designer & Creative Technologist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#070A12", color: "#F5F7FF" }}>
        <div style={{ fontSize: 28, color: "#A6AEC2" }}>samson odejinmi</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, letterSpacing: -3, lineHeight: 1.02 }}>Creating worlds.</div>
          <div style={{ fontSize: 84, letterSpacing: -3, lineHeight: 1.02 }}>Designing experiences.</div>
          <div style={{ fontSize: 84, letterSpacing: -3, lineHeight: 1.02 }}>Building what&apos;s next.</div>
          <div style={{ marginTop: 40, height: 3, width: 420, background: "linear-gradient(90deg,#4D8DFF,#8B5CF6)" }} />
        </div>
      </div>
    ),
    size,
  );
}
