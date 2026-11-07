"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function BackLink() {
  const { t } = useLanguage();

  return (
    <Link className="section-back-link" href="/">
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {t("nav.back")}
    </Link>
  );
}
