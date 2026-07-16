import "server-only";

import QRCode from "qrcode";

export async function demoUrlToQrDataUri(demoUrl: string): Promise<string> {
  return QRCode.toDataURL(demoUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: { dark: "#18181b", light: "#ffffff" },
  });
}
