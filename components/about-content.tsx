"use client";

import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { useStoredItems } from "@/lib/use-stored-items";

const faq = [
  {
    question: "Как связаться с автором объявления?",
    answer:
      "Откройте карточку объявления и воспользуйтесь указанным автором способом связи. Не публикуйте пароли, банковские данные и другую чувствительную информацию.",
  },
  {
    question: "Как отметить вещь возвращённой?",
    answer:
      "Войдите в аккаунт, откройте своё объявление и выберите статус «Возвращено». Это поможет другим участникам не тратить время на уже решённый поиск.",
  },
  {
    question: "Что делать, если объявление содержит чужие личные данные?",
    answer:
      "Отправьте жалобу со страницы объявления. Администрация проекта сможет проверить обращение и принять меры.",
  },
  {
    question: "Почему я не вижу своё объявление?",
    answer:
      "Проверьте, что вы вошли в тот же аккаунт, с которого опубликовали запись, и сбросьте фильтры ленты. Если проблема осталась, обратитесь в студенческий офис университета.",
  },
];

export default function AboutContent() {
  const { items, error, isReady } = useStoredItems();
  const returnedCount = items.filter((item) => item.status === "returned").length;
  const foundCount = items.filter(
    (item) => item.type === "found" || item.status === "returned",
  ).length;

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="about" />
      <section className="about-page container">
        <div className="about-hero">
          <span className="section-kicker">FOUNDLY · СООБЩЕСТВО КАМПУСА</span>
          <h1>Пусть каждая вещь найдёт дорогу домой.</h1>
          <p>
            Foundly — университетская доска объявлений, которая помогает
            студентам сообщать о потерянных и найденных вещах.
          </p>
          <Link className="about-primary-link" href="/">
            Открыть ленту <span aria-hidden="true">→</span>
          </Link>
        </div>

        <section className="about-stats" aria-label="Статистика объявлений">
          <article>
            <strong>{isReady && !error ? foundCount : "—"}</strong>
            <span>найденных вещей</span>
          </article>
          <article>
            <strong>{isReady && !error ? returnedCount : "—"}</strong>
            <span>возвращено владельцам</span>
          </article>
          {error && <p role="status">{error}</p>}
        </section>

        <section className="about-section">
          <span className="section-kicker">ТРИ ПРОСТЫХ ШАГА</span>
          <h2>Как это работает</h2>
          <div className="about-step-grid">
            <article><span>01</span><h3>Найдите или опубликуйте</h3><p>Поищите вещь в ленте или войдите в аккаунт и создайте объявление.</p></article>
            <article><span>02</span><h3>Уточните детали</h3><p>Сверьте описание и место. Свяжитесь с автором через указанный контакт.</p></article>
            <article><span>03</span><h3>Верните владельцу</h3><p>Передайте вещь безопасно, а затем отметьте объявление как возвращённое.</p></article>
          </div>
        </section>

        <section className="about-section about-rules">
          <span className="section-kicker">БЕЗОПАСНОСТЬ СООБЩЕСТВА</span>
          <h2>Правила публикации</h2>
          <ul>
            <li>Публикуйте только правдивую информацию о потерянной или найденной вещи.</li>
            <li>Укажите понятное место и дату, но не раскрывайте полный адрес и личные данные.</li>
            <li>Не добавляйте документы целиком, банковские карты, пароли и чужие контакты.</li>
            <li>Встречайтесь в безопасном общественном месте на территории университета.</li>
            <li>Если объявление нарушает правила, отправьте жалобу на его странице.</li>
          </ul>
        </section>

        <section className="about-section about-faq">
          <span className="section-kicker">ПОМОЩЬ</span>
          <h2>Частые вопросы</h2>
          <div className="about-faq-list">
            {faq.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">＋</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="about-contact">
          <div>
            <span className="section-kicker">ЕСТЬ ВОПРОС?</span>
            <h2>Мы поможем разобраться.</h2>
            <p>По вопросам работы сервиса обратитесь в студенческий офис или деканат вашего университета.</p>
          </div>
          <Link href="/add">Опубликовать объявление <span aria-hidden="true">→</span></Link>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
