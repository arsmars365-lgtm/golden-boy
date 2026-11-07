"use client";

import Button from "@mui/material/Button";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import BackLink from "@/components/back-link";
import { useLanguage } from "@/components/language-provider";
import type { ItemType } from "@/lib/items";

type GuideContent = {
  title: string;
  subtitle: string;
  instructionTitle: string;
  steps: [string, string, string];
  publish: string;
};

const guideContent: Record<"kk" | "ru" | "en", Record<ItemType, GuideContent>> = {
  kk: {
    found: {
      title: "Табылған зат туралы хабарлау",
      subtitle: "Біреудің затын таптыңыз ба? Иесіне қайтаруға көмектесіңіз.",
      instructionTitle: "Не істеу керек",
      steps: [
        "Табылған затты суретке түсіріңіз",
        "Төмендегі «Хабарландыру орналастыру» батырмасын басыңыз",
        "Заттың сипаттамасы мен табылған жерін көрсетіп, хабарландыруды жариялаңыз",
      ],
      publish: "Хабарландыру орналастыру",
    },
    lost: {
      title: "Жоғалған зат туралы хабарлау",
      subtitle: "Затыңызды жоғалттыңыз ба? Оны табуға көмектесеміз.",
      instructionTitle: "Не істеу керек",
      steps: [
        "Жоғалған заттың фотосын дайындаңыз (бар болса)",
        "Төмендегі «Хабарландыру орналастыру» батырмасын басыңыз",
        "Затты және оны жоғалтқан жеріңізді сипаттаңыз",
      ],
      publish: "Хабарландыру орналастыру",
    },
  },
  ru: {
    found: {
      title: "Сообщить о находке",
      subtitle: "Нашли чужую вещь? Помогите вернуть её владельцу!",
      instructionTitle: "Инструкция",
      steps: [
        "Сфотографируйте найденный предмет",
        "Нажмите кнопку «Разместить объявление» ниже",
        "Укажите описание вещи и место находки, затем опубликуйте объявление",
      ],
      publish: "Разместить объявление",
    },
    lost: {
      title: "Сообщить о пропаже",
      subtitle: "Потеряли вещь? Мы поможем её найти!",
      instructionTitle: "Инструкция",
      steps: [
        "Подготовьте фото пропавшей вещи (если есть)",
        "Нажмите кнопку «Разместить объявление» ниже",
        "Опишите вещь и место, где вы её потеряли",
      ],
      publish: "Разместить объявление",
    },
  },
  en: {
    found: {
      title: "Report a found item",
      subtitle: "Found something that belongs to someone else? Help return it.",
      instructionTitle: "Instructions",
      steps: [
        "Take a photo of the item you found",
        "Click the “Post a listing” button below",
        "Describe the item and where you found it, then publish the listing",
      ],
      publish: "Post a listing",
    },
    lost: {
      title: "Report a lost item",
      subtitle: "Lost something? We’ll help you find it.",
      instructionTitle: "Instructions",
      steps: [
        "Prepare a photo of the missing item, if available",
        "Click the “Post a listing” button below",
        "Describe the item and where you lost it",
      ],
      publish: "Post a listing",
    },
  },
};

function ReportIcon({ type }: { type: ItemType }) {
  if (type === "found") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.2 4.2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M10.3 3.8 2.4 17.4A1.8 1.8 0 0 0 4 20.1h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}

export default function ReportGuide({ type }: { type: ItemType }) {
  const { language } = useLanguage();
  const content = guideContent[language][type];

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />
      <section className="report-guide-section">
        <div className="report-guide-container container">
          <BackLink />
          <article className={`report-guide-card report-guide-${type}`}>
            <div className="report-guide-heading">
              <span className="report-guide-icon">
                <ReportIcon type={type} />
              </span>
              <h1>{content.title}</h1>
              <p>{content.subtitle}</p>
            </div>
            <div className="report-guide-instructions">
              <h2>{content.instructionTitle}</h2>
              <ol>
                {content.steps.map((step, index) => (
                  <li key={step}>
                    <span aria-hidden="true">{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
              <Button
                className="report-guide-publish"
                href={`/add?type=${type}`}
                variant="contained"
              >
                {content.publish}
              </Button>
            </div>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
