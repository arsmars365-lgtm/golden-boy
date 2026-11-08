"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import ListingCard from "@/components/listing-card";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { formatItemDate, getAllItems } from "@/lib/items";
import { useStoredItems, useTodayDate } from "@/lib/use-stored-items";
import { useLanguage } from "@/components/language-provider";

type TimeFilter = "all" | "today" | "week";
type StatusFilter = "all" | "searching" | "found" | "returned";

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
type PaginationEntry = number | "start-ellipsis" | "end-ellipsis";
type Filters = {
  category: string;
  type: "all" | ItemType;
  time: TimeFilter;
  status: StatusFilter;
};

const ITEMS_PER_PAGE = 9;
const DEFAULT_FILTERS: Filters = {
  category: "all",
  type: "all",
  time: "all",
  status: "all",
};

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
    searchPlaceholder: string;
    searchButton: string;
    reportFound: string;
    reportLost: string;
  };
  promo: {
    kicker: string;
    title: string;
    description: string;
    action: string;
    creativeTitle: string;
  };
  filters: {
    categoryLabel: string;
    allCategories: string;
    allTypes: string;
    lost: string;
    found: string;
    today: string;
    week: string;
    allTime: string;
    open: string;
    title: string;
    close: string;
    typeLabel: string;
    dateLabel: string;
    statusLabel: string;
    anyStatus: string;
    searching: string;
    foundStatus: string;
    returned: string;
    reset: string;
    resultsFound: string;
    resultSingular: string;
    resultPlural: string;
  };
  sections: {
    title: string;
  };
  pagination: {
    previous: string;
    next: string;
    label: string;
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
      about: "Біз туралы",
      login: "Кіру",
      publish: "Елдеді жариялау",
    },
    hero: {
      searchPlaceholder: "Не іздеп жатырмыз? Мысалы, құлаққап",
      searchButton: "Затты табу",
      reportFound: "Табылған зат туралы хабарлау",
      reportLost: "Жоғалған зат туралы хабарлау",
    },
    promo: {
      kicker: "FOUNDLY · ҚАУЫМДАСТЫҚ КӨМЕГІ",
      title: "Жоғалттыңыз ба, әлде таптыңыз ба?",
      description: "Жоғалған және табылған заттар туралы хабарландыруларды бір жерден іздеңіз.",
      action: "Хабарландыруларды көру",
      creativeTitle: "ІЗДЕЙМІЗ. ТАБАМЫЗ. ҚАЙТАРАМЫЗ.",
    },
    filters: {
      categoryLabel: "Санат",
      allCategories: "Барлық санаттар",
      allTypes: "Барлық хабарламалар",
      lost: "Жоғалған",
      found: "Табылды",
      today: "Бүгін",
      week: "Апта",
      allTime: "Барлық уақыт",
      open: "Сүзгі",
      title: "Хабарландыруларды сүзу",
      close: "Дайын",
      typeLabel: "Хабарландыру түрі",
      dateLabel: "Жарияланған күні",
      statusLabel: "Хабарландыру күйі",
      anyStatus: "Кез келген күй",
      searching: "Ізделуде",
      foundStatus: "Табылды",
      returned: "Қайтарылды",
      reset: "Фильтрлерді қалпына келтіру",
      resultsFound: "Табылды",
      resultSingular: "хабарлама",
      resultPlural: "хабарлама",
    },
    sections: {
      title: "Хабарландырулар",
    },
    pagination: {
      previous: "Артқа",
      next: "Алға",
      label: "Хабарландыру беттері",
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
      about: "О нас",
      login: "Войти",
      publish: "Разместить объявление",
    },
    hero: {
      searchPlaceholder: "Что ищем? Например, наушники",
      searchButton: "Найти вещь",
      reportFound: "Заявить о находке",
      reportLost: "Заявить о пропаже",
    },
    promo: {
      kicker: "FOUNDLY · ПОМОЩЬ СООБЩЕСТВА",
      title: "Потерял или нашёл?",
      description: "Ищите потерянные вещи и сообщайте о находках в одном месте.",
      action: "Смотреть объявления",
      creativeTitle: "ИЩЕМ. НАХОДИМ. ВОЗВРАЩАЕМ.",
    },
    filters: {
      categoryLabel: "Категория",
      allCategories: "Все категории",
      allTypes: "Все объявления",
      lost: "Потеряли",
      found: "Нашли",
      today: "Сегодня",
      week: "Неделя",
      allTime: "Всё время",
      open: "Фильтр",
      title: "Фильтры объявлений",
      close: "Готово",
      typeLabel: "Тип объявления",
      dateLabel: "Дата публикации",
      statusLabel: "Статус объявления",
      anyStatus: "Любой статус",
      searching: "Ищется",
      foundStatus: "Найдено",
      returned: "Возвращено",
      reset: "Сбросить фильтры",
      resultsFound: "Найдено",
      resultSingular: "объявление",
      resultPlural: "объявлений",
    },
    sections: {
      title: "Объявления",
    },
    pagination: {
      previous: "Назад",
      next: "Вперёд",
      label: "Страницы объявлений",
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
      about: "About us",
      login: "Log in",
      publish: "Post an ad",
    },
    hero: {
      searchPlaceholder: "What are we looking for? For example, headphones",
      searchButton: "Find item",
      reportFound: "Report a found item",
      reportLost: "Report a lost item",
    },
    promo: {
      kicker: "FOUNDLY · COMMUNITY-POWERED",
      title: "Lost or found something?",
      description: "Find lost items and share your discoveries, all in one place.",
      action: "Browse listings",
      creativeTitle: "SEARCH. FIND. RETURN.",
    },
    filters: {
      categoryLabel: "Category",
      allCategories: "All categories",
      allTypes: "All listings",
      lost: "Lost",
      found: "Found",
      today: "Today",
      week: "Week",
      allTime: "All time",
      open: "Filters",
      title: "Listing filters",
      close: "Done",
      typeLabel: "Listing type",
      dateLabel: "Date posted",
      statusLabel: "Listing status",
      anyStatus: "Any status",
      searching: "Searching",
      foundStatus: "Found",
      returned: "Returned",
      reset: "Reset filters",
      resultsFound: "Found",
      resultSingular: "listing",
      resultPlural: "listings",
    },
    sections: {
      title: "Listings",
    },
    pagination: {
      previous: "Previous",
      next: "Next",
      label: "Listing pages",
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
  const [draftQuery, setDraftQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { items: storedItems, error: storageError } = useStoredItems();
  const {
    favoriteIds,
    isReady: favoritesReady,
    toggleFavorite,
  } = useFavorites();
  const today = useTodayDate();
  const items = useMemo(() => getAllItems(storedItems), [storedItems]);

  const t = translations[language];
  const activeFilterCount = Number(filters.category !== "all") +
    Number(filters.type !== "all") +
    Number(filters.time !== "all") +
    Number(filters.status !== "all");

  useEffect(() => {
    if (!isFilterDialogOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFilterDialogOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFilterDialogOpen]);

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
      const matchesType = filters.type === "all" || item.type === filters.type;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "found"
          ? item.type === "found"
          : item.status === filters.status);
      const itemCategory = localizedItem?.categoryKey ?? categoryKeyByName[item.category];
      const matchesCategory = filters.category === "all" || itemCategory === filters.category;
      const matchesTime =
        filters.time === "all" ||
        (filters.time === "today" && age === 0) ||
        (filters.time === "week" && age >= 0 && age <= 7);

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus &&
        matchesCategory &&
        matchesTime
      );
    });
  }, [filters, items, language, query, today]);
  const pageCount = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(pageCount, 1));
  const visibleItems = filteredItems.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE,
  );
  const firstPageNumber = Math.max(2, activePage - 1);
  const lastPageNumber = Math.min(pageCount - 1, activePage + 1);
  const pageEntries: PaginationEntry[] =
    pageCount <= 5
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : [
          1,
          ...(firstPageNumber > 2 ? ["start-ellipsis" as const] : []),
          ...Array.from(
            { length: Math.max(0, lastPageNumber - firstPageNumber + 1) },
            (_, index) => firstPageNumber + index,
          ),
          ...(lastPageNumber < pageCount - 1 ? ["end-ellipsis" as const] : []),
          pageCount,
        ];

  function resetFilters() {
    setQuery("");
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }

  function resetDraftFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setDraftQuery("");
  }

  function applyDraftFilters() {
    setQuery(draftQuery);
    setFilters(draftFilters);
    setCurrentPage(1);
    setIsFilterDialogOpen(false);
  }

  function goToPage(page: number) {
    setCurrentPage(page);
    document.getElementById("feed")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />

      <section aria-label="Foundly" className="foundly-promo">
        <div className="foundly-promo-inner container">
          <div className="foundly-promo-copy">
            <span className="foundly-promo-kicker">{t.promo.kicker}</span>
            <h1>{t.promo.title}</h1>
            <p>{t.promo.description}</p>
            <Link className="foundly-promo-action" href="#feed">
              {t.promo.action}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div aria-hidden="true" className="foundly-promo-art">
            <span className="foundly-promo-orbit foundly-promo-orbit-outer" />
            <span className="foundly-promo-orbit foundly-promo-orbit-inner" />
            <div className="foundly-promo-art-content">
              <span className="foundly-promo-wordmark">foundly</span>
              <span className="foundly-promo-art-title">{t.promo.creativeTitle}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="hero-section">
        <div className="container hero-content">
          <div className="report-actions">
            <Link className="report-action report-action-found" href="/report/found">
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
              <span>{t.hero.reportFound}</span>
            </Link>
            <Link className="report-action report-action-lost" href="/report/lost">
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <path d="M10.3 3.8 2.4 17.4A1.8 1.8 0 0 0 4 20.1h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4.5M12 17h.01" />
              </svg>
              <span>{t.hero.reportLost}</span>
            </Link>
          </div>
          <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
            <label className="search-field">
              <Magnifier />
              <span className="visually-hidden">{t.hero.searchPlaceholder}</span>
              <input
                type="search"
                placeholder={t.hero.searchPlaceholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>
            <Button className="search-button" type="submit" variant="contained">
              {t.hero.searchButton}
            </Button>
          </form>
        </div>
      </section>

      <section className="feed-section container" id="feed">
        <div className="feed-heading">
          <h2>{t.sections.title}</h2>
          <button
            aria-expanded={isFilterDialogOpen}
            aria-haspopup="dialog"
            aria-label={t.filters.open}
            className="filter-open-button"
            onClick={() => {
              setDraftQuery(query);
              setDraftFilters(filters);
              setIsFilterDialogOpen(true);
            }}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M4 7h16M7 12h10m-7 5h4" />
            </svg>
            {t.filters.open}
            {activeFilterCount > 0 && (
              <span aria-hidden="true" className="filter-active-count">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        {isFilterDialogOpen && (
          <div
            className="filter-dialog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsFilterDialogOpen(false);
              }
            }}
          >
            <section
              aria-labelledby="filter-dialog-title"
              aria-modal="true"
              className="filter-dialog"
              role="dialog"
            >
              <header className="filter-dialog-header">
                <h2 id="filter-dialog-title">{t.filters.title}</h2>
                <button
                  aria-label={t.filters.close}
                  className="filter-dialog-close"
                  onClick={() => setIsFilterDialogOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </header>
              <div className="filter-dialog-content">
                <label className="status-filter filter-category">
                  <span>{t.filters.categoryLabel}</span>
                  <select
                    onChange={(event) => {
                      setDraftFilters((current) => ({
                        ...current,
                        category: event.target.value,
                      }));
                    }}
                    value={draftFilters.category}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>{t.filters.typeLabel}</legend>
                  <div className="type-tabs" role="group">
                    {([
                      ["all", t.filters.allTypes],
                      ["lost", t.filters.lost],
                      ["found", t.filters.found],
                    ] as const).map(([value, label]) => (
                      <button
                        aria-pressed={draftFilters.type === value}
                        className={`type-tab ${draftFilters.type === value ? "selected" : ""}`}
                        key={value}
                        onClick={() => {
                          setDraftFilters((current) => ({ ...current, type: value }));
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t.filters.dateLabel}</legend>
                  <div className="date-filters" role="group">
                    {([
                      ["today", t.filters.today],
                      ["week", t.filters.week],
                      ["all", t.filters.allTime],
                    ] as const).map(([value, label]) => (
                      <button
                        aria-pressed={draftFilters.time === value}
                        className={`date-filter ${draftFilters.time === value ? "selected" : ""}`}
                        key={value}
                        onClick={() => {
                          setDraftFilters((current) => ({ ...current, time: value }));
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="status-filter">
                  <span>{t.filters.statusLabel}</span>
                  <select
                    onChange={(event) => {
                      const status = event.target.value;
                      if (isStatusFilter(status)) {
                        setDraftFilters((current) => ({
                          ...current,
                          status,
                        }));
                      }
                    }}
                    value={draftFilters.status}
                  >
                    <option value="all">{t.filters.anyStatus}</option>
                    {([
                      ["searching", t.filters.searching],
                      ["found", t.filters.foundStatus],
                      ["returned", t.filters.returned],
                    ] as const).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <footer className="filter-dialog-footer">
                <button
                  className="reset-button"
                  onClick={resetDraftFilters}
                  type="button"
                >
                  {t.filters.reset}
                </button>
                <button
                  className="filter-dialog-done"
                  onClick={applyDraftFilters}
                  type="button"
                >
                  {t.filters.close}
                </button>
              </footer>
            </section>
          </div>
        )}

        <div className="results-row" aria-live="polite">
          <span>
            {t.filters.resultsFound} <strong>{filteredItems.length}</strong>{" "}
            {filteredItems.length === 1 ? t.filters.resultSingular : t.filters.resultPlural}
          </span>
          {(query ||
            filters.category !== "all" ||
            filters.type !== "all" ||
            filters.time !== "all" ||
            filters.status !== "all") && (
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
                <div className="col-12 col-sm-6 col-lg-4 col-xl-3" key={item.id}>
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

        {pageCount > 1 && (
          <nav className="feed-pagination" aria-label={t.pagination.label}>
            <button
              aria-label={t.pagination.previous}
              className="pagination-direction"
              disabled={activePage === 1}
              onClick={() => goToPage(activePage - 1)}
              type="button"
            >
              {t.pagination.previous}
            </button>
            {pageEntries.map((entry) =>
              typeof entry === "number" ? (
                <button
                  aria-current={activePage === entry ? "page" : undefined}
                  aria-label={`${entry}`}
                  className={`pagination-page ${activePage === entry ? "active" : ""}`}
                  key={entry}
                  onClick={() => goToPage(entry)}
                  type="button"
                >
                  {entry}
                </button>
              ) : (
                <span aria-hidden="true" className="pagination-ellipsis" key={entry}>
                  …
                </span>
              ),
            )}
            <button
              aria-label={t.pagination.next}
              className="pagination-direction"
              disabled={activePage === pageCount}
              onClick={() => goToPage(activePage + 1)}
              type="button"
            >
              {t.pagination.next}
            </button>
          </nav>
        )}

      </section>

      <SiteFooter />
    </main>
);
}
