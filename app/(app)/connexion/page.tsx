import { redirect } from "next/navigation";
import { appUrl } from "@/lib/site";

/** Ancienne adresse de connexion : la connexion se fait désormais dans l'espace. */
export default function ConnexionPage() {
  redirect(appUrl("/espace/login"));
}
