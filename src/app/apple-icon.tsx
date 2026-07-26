import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(135deg, #0F8A7E 0%, #2F80ED 55%, #E85D4C 100%)",
          color: "white",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        ICT
      </div>
    ),
    size,
  );
}
