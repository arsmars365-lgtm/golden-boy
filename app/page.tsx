"use client";

import Button from "@mui/material/Button";
import { useMemo, useState } from "react";
import { DemoNotice } from "@/app/components/SiteHeader";
import { useFavorites } from "@/components/favorites-provider";
import ListingCard from "@/components/listing-card";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { formatItemDate, getAllItems } from "@/lib/items";
import { useStoredItems, useTodayDate } from "@/lib/use-stored-items";
import { useLanguage } from "@/components/language-provider";

type TimeFilter = "all" | "today" | "week";
type StatusFilter = "all" | "searching" | "found" | "returned";

const statusLabels: Record<Exclude<StatusFilter, "all">, string> = {
  searching: "Ищется",
  found: "Найдено",
  returned: "Возвращено",
};

function isStatusFilter(value: string): value is StatusFilter {
  return (
    value === "all" ||
    value === "searching" ||
    value === "found" ||
    value === "returned"
  );
}

type Language = "kk" | "ru" | "en";
type ItemType = "lost" | "found";

type TextEntry = {
  ru: string;
  kk: string;
  en: string;
};

type Item = {
  id: string;
  title: TextEntry;
  categoryKey: string;
  type: ItemType;
  place: TextEntry;
  daysAgo: number;
  time: string;
  status: "searching" | "found" | "returned";
  art: string;
  symbol: string;
  details: TextEntry;
};

type TranslationSet = {
  nav: {
    feed: string;
    about: string;
    login: string;
    publish: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    describe: string;
    note: string;
    noteStrong: string;
    searchPlaceholder: string;
    searchHint: string;
    searchButton: string;
    categoryLabel: string;
  };
  filters: {
    allCategories: string;
    allTypes: string;
    lost: string;
    found: string;
    today: string;
    week: string;
    allTime: string;
    reset: string;
    resultsFound: string;
    resultSingular: string;
    resultPlural: string;
  };
  sections: {
    kicker: string;
    title: string;
    subtitle: string;
    community: string;
    bottomTitle: string;
    bottomText: string;
    publishFinding: string;
  };
  card: {
    found: string;
    lost: string;
    ownerSearch: string;
    returned: string;
    foundStatus: string;
    more: string;
    addFavorite: string;
    inFavorites: string;
  };
  footer: {
    about: string;
    description: string;
  };
  emptyState: {
    message: string;
  };
  brand: {
    homeLabel: string;
  };
  language: string;
  categories: Record<string, string>;
};

const categoryKeys = [
  "all",
  "documents",
  "phone",
  "keys",
  "headphones",
  "clothes",
  "bags",
  "other",
  "electronics",
  "books",
] as const;

const translations: Record<Language, TranslationSet> = {
  kk: {
    nav: {
      feed: "Лента",
      about: "Жоба туралы",
      login: "Кіру",
      publish: "Елдеді жариялау",
    },
    hero: {
      eyebrow: "Кампус қауымдастығы",
      title: "Жоғалттыңыз ба",
      titleAccent: "Немесе таптыңыз ба?",
      describe: "Заттарды иелеріне қайта оралтуға көмектесеміз.",
      note: "Бір кампус —",
      noteStrong: "көптеген жақсы оқиғалар",
      searchPlaceholder: "Не іздеп жатырмыз? Мысалы, құлаққап",
      searchHint: "Атын енгізіңіз немесе санат таңдаңыз",
      searchButton: "Затты табу",
      categoryLabel: "Санат",
    },
    filters: {
      allCategories: "Барлық санаттар",
      allTypes: "Барлық хабарламалар",
      lost: "Жоғалған",
      found: "Табылды",
      today: "Бүгін",
      week: "Апта",
      allTime: "Барлық уақыт",
      reset: "Фильтрлерді қалпына келтіру",
      resultsFound: "Табылды",
      resultSingular: "хабарлама",
      resultPlural: "хабарлама",
    },
    sections: {
      kicker: "БІЗ БІРГЕ ТАБЫМЫЗ",
      title: "Жаңа хабарламалар",
      subtitle: "Біздің кампус ішінде ізделіп, табылған заттар",
      community: "Қауымдастық күн сайын көмектеседі",
      bottomTitle: "Мұнда маңызды зат бар ма?",
      bottomText: "Сіздің табылған зат басқа адамның күнін жақсарта алады.",
      publishFinding: "Табылған затты жариялау",
    },
    card: {
      found: "ТАБЫЛДЫ",
      lost: "ЖОҒАЛДЫ",
      ownerSearch: "Иесінің іздеуі",
      returned: "Қайтарылды",
      foundStatus: "Табылды",
      more: "Толығырақ",
      addFavorite: "Таңдаулыларға",
      inFavorites: "Таңдаулыларда",
    },
    footer: {
      about: "Жоба туралы",
      description: "Адамдарға және табылуға тиіс заттарға арналған.",
    },
    emptyState: {
      message: "Сұранысты өзгертіп немесе фильтрлерді қайта орнатыңыз.",
    },
    brand: {
      homeLabel: "Foundly — негізгі бет",
    },
    language: "Тіл",
    categories: {
      all: "Барлық санаттар",
      documents: "Құжаттар",
      phone: "Телефон",
      keys: "Кілттер",
      headphones: "Құлаққап",
      clothes: "Киім",
      bags: "Сөмкелер",
      other: "Басқа",
      electronics: "Электроника",
      books: "Кітаптар",
    },
  },
  ru: {
    nav: {
      feed: "Лента",
      about: "О проекте",
      login: "Войти",
      publish: "Разместить объявление",
    },
    hero: {
      eyebrow: "Сообщество кампуса",
      title: "Потерял или нашёл?",
      titleAccent: "Ты в нужном месте.",
      describe: "Помогаем вещам возвращаться к своим людям.",
      note: "Один кампус —",
      noteStrong: "много добрых историй",
      searchPlaceholder: "Что ищем? Например, наушники",
      searchHint: "Поиск по названию или выбери категорию",
      searchButton: "Найти вещь",
      categoryLabel: "Категория",
    },
    filters: {
      allCategories: "Все категории",
      allTypes: "Все объявления",
      lost: "Потеряли",
      found: "Нашли",
      today: "Сегодня",
      week: "Неделя",
      allTime: "Всё время",
      reset: "Сбросить фильтры",
      resultsFound: "Найдено",
      resultSingular: "объявление",
      resultPlural: "объявлений",
    },
    sections: {
      kicker: "НАЙДЁМ ВМЕСТЕ",
      title: "Свежие объявления",
      subtitle: "Вещи, которые ищут и уже нашли в нашем кампусе",
      community: "Сообщество помогает каждый день",
      bottomTitle: "Нашёл что-то важное?",
      bottomText: "Твоя находка может сделать чей-то день лучше.",
      publishFinding: "Опубликовать находку",
    },
    card: {
      found: "НАЙДЕНО",
      lost: "ПОТЕРЯЛИ",
      ownerSearch: "Ищем владельца",
      returned: "Возвращено",
      foundStatus: "Найдено",
      more: "Подробнее",
      addFavorite: "В избранное",
      inFavorites: "В избранном",
    },
    footer: {
      about: "О проекте",
      description: "Создано для людей и вещей, которые должны найтись.",
    },
    emptyState: {
      message: "Попробуй изменить запрос или сбросить фильтры.",
    },
    brand: {
      homeLabel: "Foundly — главная страница",
    },
    language: "Язык",
    categories: {
      all: "Все категории",
      documents: "Документы",
      phone: "Телефон",
      keys: "Ключи",
      headphones: "Наушники",
      clothes: "Одежда",
      bags: "Сумки",
      other: "Другое",
      electronics: "Электроника",
      books: "Книги",
    },
  },
  en: {
    nav: {
      feed: "Feed",
      about: "About",
      login: "Log in",
      publish: "Post an ad",
    },
    hero: {
      eyebrow: "Campus community",
      title: "Lost something?",
      titleAccent: "Or found something? You’re in the right place.",
      describe: "We help belongings find their people again.",
      note: "One campus —",
      noteStrong: "many good stories",
      searchPlaceholder: "What are we looking for? For example, headphones",
      searchHint: "Search by name or choose a category",
      searchButton: "Find item",
      categoryLabel: "Category",
    },
    filters: {
      allCategories: "All categories",
      allTypes: "All listings",
      lost: "Lost",
      found: "Found",
      today: "Today",
      week: "Week",
      allTime: "All time",
      reset: "Reset filters",
      resultsFound: "Found",
      resultSingular: "listing",
      resultPlural: "listings",
    },
    sections: {
      kicker: "LET'S FIND IT TOGETHER",
      title: "Recent listings",
      subtitle: "Items being searched for and already found around campus",
      community: "The community helps every day",
      bottomTitle: "Found something important?",
      bottomText: "Your find could make someone’s day better.",
      publishFinding: "Publish a find",
    },
    card: {
      found: "FOUND",
      lost: "LOST",
      ownerSearch: "Looking for owner",
      returned: "Returned",
      foundStatus: "Found",
      more: "More details",
      addFavorite: "Save to favorites",
      inFavorites: "In favorites",
    },
    footer: {
      about: "About",
      description: "Built for people and the things that should be found.",
    },
    emptyState: {
      message: "Try changing the search or resetting the filters.",
    },
    brand: {
      homeLabel: "Foundly — home page",
    },
    language: "Language",
    categories: {
      all: "All categories",
      documents: "Documents",
      phone: "Phone",
      keys: "Keys",
      headphones: "Headphones",
      clothes: "Clothing",
      bags: "Bags",
      other: "Other",
      electronics: "Electronics",
      books: "Books",
    },
  },
};

const localizedDemoItems: Item[] = [
  {
    id: "blue-headphones",
    title: { ru: "Наушники Sony", kk: "Sony құлаққаптары", en: "Sony headphones" },
    categoryKey: "electronics",
    type: "lost",
    place: { ru: "Библиотека, 2 этаж", kk: "Кітапхана, 2 қабат", en: "Library, 2nd floor" },
    daysAgo: 0,
    time: "12:40",
    status: "searching",
    art: "art-blue",
    symbol: "♫",
    details: {
      ru: "Синие беспроводные наушники в чехле. Последний раз видел(а) в читальном зале.",
      kk: "Көк, ұялы құлаққаптар корпустық қалтада. Соңғы рет оқу залында көрілді.",
      en: "Blue wireless headphones in a case. Last seen in the reading room.",
    },
  },
  {
    id: "student-card",
    title: { ru: "Студенческий билет", kk: "Студенттік билеті", en: "Student ID" },
    categoryKey: "documents",
    type: "found",
    place: { ru: "Главный корпус, холл", kk: "Негізгі корпуc, холл", en: "Main building, lobby" },
    daysAgo: 0,
    time: "11:15",
    status: "searching",
    art: "art-peach",
    symbol: "ID",
    details: {
      ru: "Нашёл(ла) студенческий билет у входа в главный корпус. Передал(а) на стойку охраны.",
      kk: "Негізгі корпустың кіреберісінде студенттік билетті таптым. Қауіпсіздік пәтеріне тапсырдым.",
      en: "Found a student ID by the main entrance. I left it at the security desk.",
    },
  },
  {
    id: "keychain",
    title: { ru: "Связка ключей с брелоком", kk: "Кілттер жиынтығы", en: "Key ring with charm" },
    categoryKey: "keys",
    type: "found",
    place: { ru: "Корпус Б, аудитория 204", kk: "Б корпусы, 204 аудитория", en: "Building B, room 204" },
    daysAgo: 1,
    time: "16:20",
    status: "searching",
    art: "art-green",
    symbol: "✳",
    details: {
      ru: "Три ключа на кольце и небольшой зелёный брелок. Оставил(а) у охраны корпуса.",
      kk: "Шеңбердегі үш кілт пен кішкентай жасыл брелок. Корпус күзетіне қалдырдым.",
      en: "Three keys on a ring and a small green charm. Left with the building security.",
    },
  },
  {
    id: "black-backpack",
    title: { ru: "Чёрный рюкзак", kk: "Қара рюкзак", en: "Black backpack" },
    categoryKey: "bags",
    type: "lost",
    place: { ru: "Спортивный зал", kk: "Спорт залы", en: "Gym" },
    daysAgo: 2,
    time: "18:05",
    status: "searching",
    art: "art-lilac",
    symbol: "▣",
    details: {
      ru: "Небольшой чёрный рюкзак с нашивкой. Внутри были конспекты и зарядка.",
      kk: "Штамппен кішкентай қара рюкзак. Ішінде конспектілер мен зарядтау құрылғысы болды.",
      en: "A small black backpack with a patch. It had notes and a charger inside.",
    },
  },
  {
    id: "chemistry-notes",
    title: { ru: "Тетрадь по химии", kk: "Химия дәптері", en: "Chemistry notebook" },
    categoryKey: "books",
    type: "found",
    place: { ru: "Кафетерий", kk: "Кафетерий", en: "Cafeteria" },
    daysAgo: 3,
    time: "13:30",
    status: "returned",
    art: "art-yellow",
    symbol: "✎",
    details: {
      ru: "Клетчатая тетрадь с записями по органической химии. Уже ждёт владельца у администратора.",
      kk: "Ұяшықты дәптер, органикалық химияға жазбалар бар. Әкімшілікке берілді, иесі күтуде.",
      en: "A graph notebook with organic chemistry notes. It is waiting with the administrator.",
    },
  },
  {
    id: "silver-ring",
    title: { ru: "Серебряное кольцо", kk: "Күміс сақина", en: "Silver ring" },
    categoryKey: "other",
    type: "found",
    place: { ru: "Корпус А, аудитория 108", kk: "А корпусы, 108 аудитория", en: "Building A, room 108" },
    daysAgo: 5,
    time: "10:10",
    status: "searching",
    art: "art-rose",
    symbol: "○",
    details: {
      ru: "Небольшое серебристое кольцо найдено после пары. Напишите, если это ваша вещь.",
      kk: "Кішкентай күмістен жасалған сақина сабақтан кейін табылды. Егер сіздің болса, жазыңыз.",
      en: "A small silver ring was found after class. Write if it’s yours.",
    },
  },
];
const categoryKeyByName: Record<string, string> = {
  Электроника: "electronics",
  Документы: "documents",
  Телефон: "phone",
  Ключи: "keys",
  Наушники: "headphones",
  Одежда: "clothes",
  Сумки: "bags",
  Книги: "books",
  Другое: "other",
};

function Magnifier() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

export default function Home() {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [category, setCategory] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const { items: storedItems, error: storageError } = useStoredItems();
  const {
    favoriteIds,
    isReady: favoritesReady,
    toggleFavorite,
  } = useFavorites();
  const today = useTodayDate();
  const items = useMemo(() => getAllItems(storedItems), [storedItems]);

  const t = translations[language];

  const categoryOptions = categoryKeys.map((key) => ({
    value: key,
    label: key === "all" ? t.filters.allCategories : t.categories[key],
  }));

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(language);

    return items.filter((item) => {
      const itemDate = item.date ? new Date(`${item.date}T00:00:00`) : null;
      const todayDate = today ? new Date(`${today}T00:00:00`) : null;
      const age =
        itemDate && todayDate
          ? Math.floor(
              (todayDate.getTime() - itemDate.getTime()) / 86_400_000,
            )
          : item.daysAgo;
      const localizedItem = localizedDemoItems.find((entry) => entry.id === item.id);
      const titleText = (localizedItem?.title[language] ?? item.title).toLocaleLowerCase(language);
      const searchableText = [
        titleText,
        localizedItem?.place[language] ?? item.place,
        localizedItem?.details[language] ?? item.details,
        item.category,
      ];
      const matchesQuery =
        !normalizedQuery ||
        searchableText.some((value) =>
          value.toLocaleLowerCase(language).includes(normalizedQuery),
        );
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "found"
          ? item.type === "found"
          : item.status === statusFilter);
      const itemCategory = localizedItem?.categoryKey ?? categoryKeyByName[item.category];
      const matchesCategory = category === "all" || itemCategory === category;
      const matchesTime =
        timeFilter === "all" ||
        (timeFilter === "today" && age === 0) ||
        (timeFilter === "week" && age >= 0 && age <= 7);

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus &&
        matchesCategory &&
        matchesTime
      );
    });
  }, [category, items, language, query, statusFilter, timeFilter, today, typeFilter]);
  const visibleItems = filteredItems.slice(0, visibleCount);

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setCategory("all");
    setTimeFilter("all");
    setStatusFilter("all");
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />

      <section className="hero-section">
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> {t.hero.eyebrow}
            </span>
            <h1>
              {t.hero.title}
              <br />
              <span>{t.hero.titleAccent}</span>
            </h1>
            <p>
              {t.hero.describe}
              <br className="desktop-break" />
            </p>
          </div>
          <div className="hero-note">
            <span className="note-icon">✳</span>
            <span>
              <strong>{t.hero.note}</strong>
              <br />
              {t.hero.noteStrong}
            </span>
          </div>

          <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
            <label className="search-field">
              <Magnifier />
              <span className="visually-hidden">{t.hero.categoryLabel}</span>
              <input
                type="search"
                placeholder={t.hero.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="select-field">
              <span className="visually-hidden">{t.hero.categoryLabel}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button className="search-button" type="submit" variant="contained">
              {t.hero.searchButton}
            </Button>
          </form>
          <p className="search-hint">{t.hero.searchHint}</p>
        </div>
      </section>

      <section className="feed-section container" id="feed">
        <div className="feed-heading">
          <div>
            <span className="section-kicker">{t.sections.kicker}</span>
            <h2>{t.sections.title}</h2>
            <p>{t.sections.subtitle}</p>
          </div>
          <div className="community-count">
            <span className="online-dot" />
            <span>{t.sections.community}</span>
          </div>
        </div>
        <DemoNotice />

        <div className="filter-toolbar">
          <div className="type-tabs" role="group" aria-label="Type filter">
            {([
              ["all", t.filters.allTypes],
              ["lost", t.filters.lost],
              ["found", t.filters.found],
            ] as const).map(([value, label]) => (
              <button
                className={`type-tab ${typeFilter === value ? "selected" : ""}`}
                key={value}
                onClick={() => setTypeFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="date-filters" role="group" aria-label="Time filters">
            {([
              ["today", t.filters.today],
              ["week", t.filters.week],
              ["all", t.filters.allTime],
            ] as const).map(([value, label]) => (
              <button
                className={`date-filter ${timeFilter === value ? "selected" : ""}`}
                key={value}
                onClick={() => setTimeFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <label className="status-filter">
            <span className="visually-hidden">Статус объявления</span>
            <select
              onChange={(event) => {
                if (isStatusFilter(event.target.value)) {
                  setStatusFilter(event.target.value);
                }
              }}
              value={statusFilter}
            >
              <option value="all">Любой статус</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="results-row" aria-live="polite">
          <span>
            {t.filters.resultsFound} <strong>{filteredItems.length}</strong>{" "}
            {filteredItems.length === 1 ? t.filters.resultSingular : t.filters.resultPlural}
          </span>
          {(query ||
            category !== "all" ||
            typeFilter !== "all" ||
            timeFilter !== "all" ||
            statusFilter !== "all") && (
            <button className="reset-button" onClick={resetFilters} type="button">
              {t.filters.reset} <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        {storageError && (
          <div className="storage-message" role="alert">
            {storageError}
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="row g-4 item-grid">
            {visibleItems.map((item) => {
              const localizedItem = localizedDemoItems.find((entry) => entry.id === item.id);
              const title = localizedItem?.title[language] ?? item.title;
              const place = localizedItem?.place[language] ?? item.place;
              const details = localizedItem?.details[language] ?? item.details;
              const itemCategory = localizedItem?.categoryKey ?? categoryKeyByName[item.category];

              return (
                <div className="col-12 col-sm-6 col-lg-4" key={item.id}>
                  <ListingCard
                    item={item}
                    title={title}
                    place={place}
                    details={details}
                    category={itemCategory ? t.categories[itemCategory] : item.category}
                    dateLabel={formatItemDate(item.daysAgo, item.time, language)}
                    labels={t.card}
                    isFavorite={favoriteIds.includes(item.id)}
                    favoritesReady={favoritesReady}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">⌕</span>
            <h3>{t.filters.reset}</h3>
            <p>{t.emptyState.message}</p>
            <Button className="empty-reset" onClick={resetFilters}>
              {t.filters.reset}
            </Button>
          </div>
        )}

        {visibleCount < filteredItems.length && (
          <div className="feed-load-more">
            <Button onClick={() => setVisibleCount((count) => count + 12)} variant="outlined">
              {language === "kk" ? "Тағы көрсету" : language === "en" ? "Load more" : "Показать ещё"}
            </Button>
          </div>
        )}

        <div className="bottom-cta">
          <div className="cta-mark">f.</div>
          <div>
            <h3>{t.sections.bottomTitle}</h3>
            <p>{t.sections.bottomText}</p>
          </div>
          <Button className="cta-button" variant="contained" href="/add">
            {t.sections.publishFinding} <span aria-hidden="true">→</span>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
