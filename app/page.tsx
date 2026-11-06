"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const ITEMS_PER_PAGE = 6;

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
    title: string;
    searchPlaceholder: string;
    searchButton: string;
    reportFound: string;
    reportLost: string;
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
      about: "Жоба туралы",
      login: "Кіру",
      publish: "Елдеді жариялау",
    },
    hero: {
      title: "Жоғалттыңыз ба, әлде таптыңыз ба?",
      searchPlaceholder: "Не іздеп жатырмыз? Мысалы, құлаққап",
      searchButton: "Затты табу",
      reportFound: "Табылған зат туралы хабарлау",
      reportLost: "Жоғалған зат туралы хабарлау",
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
      about: "О проекте",
      login: "Войти",
      publish: "Разместить объявление",
    },
    hero: {
      title: "Потерял или нашёл?",
      searchPlaceholder: "Что ищем? Например, наушники",
      searchButton: "Найти вещь",
      reportFound: "Заявить о находке",
      reportLost: "Заявить о пропаже",
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
      about: "About",
      login: "Log in",
      publish: "Post an ad",
    },
    hero: {
      title: "Lost or found something?",
      searchPlaceholder: "What are we looking for? For example, headphones",
      searchButton: "Find item",
      reportFound: "Report a found item",
      reportLost: "Report a lost item",
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
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [category, setCategory] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
  const activeFilterCount = Number(category !== "all") +
    Number(typeFilter !== "all") +
    Number(timeFilter !== "all") +
    Number(statusFilter !== "all");

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
    setTypeFilter("all");
    setCategory("all");
    setTimeFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
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

      <section className="hero-section">
        <div className="container hero-content">
          <div className="hero-copy">
            <h1>{t.hero.title}</h1>
          </div>
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
            onClick={() => setIsFilterDialogOpen(true)}
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
        <DemoNotice />

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
                      setCategory(event.target.value);
                      setCurrentPage(1);
                    }}
                    value={category}
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
                        aria-pressed={typeFilter === value}
                        className={`type-tab ${typeFilter === value ? "selected" : ""}`}
                        key={value}
                        onClick={() => {
                          setTypeFilter(value);
                          setCurrentPage(1);
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
                        aria-pressed={timeFilter === value}
                        className={`date-filter ${timeFilter === value ? "selected" : ""}`}
                        key={value}
                        onClick={() => {
                          setTimeFilter(value);
                          setCurrentPage(1);
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
                      if (isStatusFilter(event.target.value)) {
                        setStatusFilter(event.target.value);
                        setCurrentPage(1);
                      }
                    }}
                    value={statusFilter}
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
                  onClick={resetFilters}
                  type="button"
                >
                  {t.filters.reset}
                </button>
                <button
                  className="filter-dialog-done"
                  onClick={() => setIsFilterDialogOpen(false)}
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
