import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer container">
      <Link className="footer-brand" href="/">
        foundly<span>.</span>
      </Link>
      <Link href="/about">{t("nav.about")}</Link>
    </footer>
  );
}
