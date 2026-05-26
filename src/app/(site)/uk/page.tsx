import { permanentRedirect } from "next/navigation";
import { gbCountryPath } from "@/lib/directory/paths";

/** @deprecated Use /united-kingdom */
export default function UkDirectoryRedirect() {
  permanentRedirect(gbCountryPath());
}
