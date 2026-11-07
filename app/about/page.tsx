import type { Metadata } from "next";
import AboutContent from "@/components/about-content";

export const metadata: Metadata = {
  title: "О нас — Foundly",
  description:
    "Как пользоваться университетской доской потерянных и найденных вещей, правила публикации и ответы на вопросы.",
  openGraph: {
    title: "О нас — Foundly",
    description: "Помогаем вещам возвращаться к своим владельцам.",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutContent />;
}
