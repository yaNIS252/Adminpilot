import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Icône de l'écran d'accueil iOS : iOS n'accepte pas le SVG, on rend donc le
 * même pictogramme en PNG. iOS arrondit lui-même les coins.
 */
export default function AppleIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M40 6h20l38 88H76L57 74 39 70 24 94H2Z" fill="#ffffff" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/><path d="M70 45 27 59l16 6 7 20Z" fill="#6c5ce7" stroke="#0a0a0f" stroke-width="6" stroke-linejoin="round" paint-order="stroke"/></svg>`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          width={124}
          height={124}
          src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        />
      </div>
    ),
    size,
  );
}
