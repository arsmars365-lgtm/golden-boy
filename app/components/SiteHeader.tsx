import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="container site-nav" aria-label="Основная навигация">
        <Link className="brand" href="/" aria-label="Foundly — главная">
          <span className="brand-mark" aria-hidden="true">
            f
          </span>
          <span>foundly</span>
        </Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <Link className="nav-link active" href="/">
            Лента
          </Link>
          <Link className="nav-link" href="/about">
            О проекте
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="nav-add-link" href="/add">
            <span aria-hidden="true">＋</span> Разместить объявление
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function DemoNotice() {
  return (
    <div className="demo-notice" role="note">
      <span className="demo-notice-icon" aria-hidden="true">i</span>
      <p>
        <strong>Примеры объявлений.</strong> Эти карточки показывают, как
        выглядят публикации. Объявления пользователей сохраняются в общей базе.
      </p>
    </div>
  );
}
