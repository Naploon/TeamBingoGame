import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgba(238,108,77,1) 0%, rgba(16,33,47,1) 100%)",
          color: "white",
          fontSize: 210,
          fontWeight: 700,
          letterSpacing: "-0.08em",
        }}
      >
        4x4
      </div>
    ),
    size,
  );
}
