/**
 * Lob 4×6 postcard back HTML (portrait bleed 4.25″×6.25″).
 * Keep creative in the upper safe area; leave lower zone empty for Lob address/postage.
 */

export function buildPostcardBackHtml(input: {
  businessName: string;
  qrDataUri: string;
  demoUrl: string;
}): string {
  const name = escapeHtml(input.businessName || "your business");
  const url = escapeHtml(input.demoUrl);
  const qr = input.qrDataUri;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Postcard back</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @font-face {
      font-family: "LobBody";
      font-style: normal;
      font-weight: 400;
      src: url("https://s3-us-west-2.amazonaws.com/assets.lob.com/fonts/open-sans/opensans-regular.ttf") format("truetype");
    }
    @font-face {
      font-family: "LobBody";
      font-style: normal;
      font-weight: 700;
      src: url("https://s3-us-west-2.amazonaws.com/assets.lob.com/fonts/open-sans/opensans-bold.ttf") format("truetype");
    }
    body {
      width: 4.25in;
      height: 6.25in;
      font-family: "LobBody", sans-serif;
      color: #18181b;
      background: #fff;
      position: relative;
    }
    /* Upper creative area — leave bottom ~2.5in clear for Lob address/postage. */
    .safe {
      position: absolute;
      top: 0.3in;
      left: 0.3in;
      right: 0.3in;
      height: 3.2in;
      display: flex;
      flex-direction: column;
      gap: 0.12in;
    }
    h1 {
      font-size: 15pt;
      font-weight: 700;
      line-height: 1.25;
    }
    .pitch {
      font-size: 9.5pt;
      line-height: 1.35;
      color: #3f3f46;
    }
    .scan-row {
      display: flex;
      align-items: center;
      gap: 0.14in;
      margin-top: 0.1in;
    }
    .scan-copy {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.08in;
    }
    .scan-label {
      font-size: 12pt;
      font-weight: 700;
      color: #047857;
      line-height: 1.2;
    }
    .arrow {
      width: 0.7in;
      height: 0.4in;
      flex-shrink: 0;
    }
    .qr-wrap {
      flex-shrink: 0;
      width: 1.2in;
      height: 1.2in;
      border: 2px solid #047857;
      border-radius: 0.06in;
      padding: 0.04in;
      background: #fff;
    }
    .qr-wrap img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .url {
      font-size: 6.5pt;
      color: #71717a;
      word-break: break-all;
      margin-top: 0.08in;
    }
  </style>
</head>
<body>
  <div class="safe">
    <h1>Your site could look like this</h1>
    <p class="pitch">
      We built a live preview for <strong>${name}</strong> from your Google listing —
      services, reviews, and a clear call button.
    </p>
    <div class="scan-row">
      <div class="scan-copy">
        <p class="scan-label">Scan here to see your site</p>
        <svg class="arrow" viewBox="0 0 88 40" aria-hidden="true">
          <path d="M4 20 H58" stroke="#047857" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M52 8 L72 20 L52 32" stroke="#047857" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      <div class="qr-wrap">
        <img src="${qr}" alt="QR code to demo site" width="200" height="200" />
      </div>
    </div>
    <p class="url">${url}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
