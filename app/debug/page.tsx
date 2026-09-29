import Link from "next/link";
import { serverTranslator } from "@/lib/server-language";

export default async function DebugPage() {
  const configured = Boolean(process.env.DATABASE_URL);
  const { t } = await serverTranslator();
  return <section className="page-shell narrow"><div className="eyebrow">{t("debug.eyebrow")}</div><h1>{t("debug.title")}</h1><p className="lead">{t("debug.intro")}</p><div className="study-summary"><div><span>{t("debug.database")}</span><strong>{configured?t("debug.ready"):t("debug.missing")}</strong></div><div><span>{t("debug.schema")}</span><strong>v1</strong></div><div><span>{t("debug.auth")}</span><strong>{t("debug.dev")}</strong></div></div>{!configured&&<p>{t("debug.setup")}</p>}<Link className="primary-button" href="/library">{t("debug.open")} <span>→</span></Link></section>;
}
