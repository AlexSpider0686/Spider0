import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthModal } from '../components/AuthModal';
import { HeroVideo } from '../components/HeroVideo';
import { SectionHeader } from '../components/SectionHeader';
import { comparisonCards, growthPoints, metrics, positioningTable, siteConfig } from '../data/siteContent';

export function HomePage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <main>
      <section className="hero">
        <HeroVideo />
        <div className="container hero__content">
          <div className="hero__badge">Presale / Budget Intelligence / Security Systems</div>
          <h1>Smeta App — предварительная бюджетная оценка систем безопасности без Excel-хаоса</h1>
          <p className="hero__lead">
            Система собирает раннюю финансовую модель по АПС, СОУЭ, СОТС, СОТ, СКУД и ССОИ,
            учитывает зонирование, тип объекта и региональные коэффициенты и превращает пресейл в
            управляемый цифровой процесс.
          </p>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={() => setAuthOpen(true)}>
              Приступить к расчёту
            </button>
            <a className="btn btn--ghost-light" href="#positioning">
              Почему это работает
            </a>
          </div>
          <div className="hero__grid">
            {metrics.map((metric) => (
              <div className="metric-card" key={metric.label}>
                <div className="metric-card__value">{metric.value}</div>
                <div className="metric-card__label">{metric.label}</div>
              </div>
            ))}
          </div>
          <div className="hero__legal-note">
            Используя сайт, вы подтверждаете ознакомление с{' '}
            <Link to="/legal/privacy">политикой конфиденциальности</Link>,{' '}
            <Link to="/legal/cookies">cookies policy</Link>,{' '}
            <Link to="/legal/personal-data">политикой обработки персональных данных</Link> и{' '}
            <Link to="/legal/disclaimer">отказом от ответственности по точности расчётов</Link>.
          </div>
        </div>
      </section>

      <section className="section section--dark" id="positioning">
        <div className="container">
          <SectionHeader eyebrow="Позиционирование" title="Почему Smeta App нужен рынку прямо сейчас">
            В РФ рынок сметных и инженерных инструментов переполнен тяжёлыми системами и самодельными
            таблицами. Ниша быстрого браузерного пресейл-калькулятора для нескольких систем безопасности
            почти свободна.
          </SectionHeader>
          <div className="comparison-grid">
            {comparisonCards.map((card) => (
              <article className="comparison-card" key={card.title}>
                <div className="comparison-card__tag">{card.tag}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className="comparison-card__split">
                  <div>
                    <strong>Ограничение</strong>
                    <p>{card.disadvantage}</p>
                  </div>
                  <div>
                    <strong>Преимущество Smeta App</strong>
                    <p>{card.advantage}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--light">
        <div className="container">
          <SectionHeader eyebrow="Сравнение подходов" title="Там, где рынок даёт либо перегруз, либо самоделки, здесь появляется системный пресейл">
            Платформа не пытается заменить рабочую ПСД или экспертизу. Её задача — быстро, прозрачно и
            профессионально сформировать предварительный бюджет и коммерческую рамку проекта.
          </SectionHeader>
          <div className="table-wrap">
            <table className="positioning-table">
              <thead>
                <tr>
                  <th>Характеристика</th>
                  <th>Гранд-Смета</th>
                  <th>Excel-таблицы</th>
                  <th>Smeta App</th>
                </tr>
              </thead>
              <tbody>
                {positioningTable.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td>{row.grand}</td>
                    <td>{row.excel}</td>
                    <td>{row.smeta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="container feature-layout">
          <div>
            <SectionHeader eyebrow="Ключевые точки роста" title="Что превращает калькулятор в рабочее место пресейла">
              Система продаёт не таблицу, а инженерный интеллект: знания о плотности оборудования, трассах,
              зонах, региональной поправке и логике формирования бюджета.
            </SectionHeader>
            <ul className="growth-list">
              {growthPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="spotlight-card">
            <div className="spotlight-card__eyebrow">Для кого сайт и продукт</div>
            <h3>Пресейл-менеджеры, ГИПы, руководители проектов, интеграторы и службы развития бизнеса</h3>
            <p>
              Smeta App сокращает цикл первичной оценки, даёт единый язык для инженерии и коммерции и
              делает расчёт презентабельным для клиента уже на первой итерации переговоров.
            </p>
            <button className="btn btn--primary" onClick={() => setAuthOpen(true)}>
              Получить доступ к демо
            </button>
          </div>
        </div>
      </section>

      <section className="section section--light">
        <div className="container legal-strip">
          <div>
            <h3>Юридически прозрачная работа сайта</h3>
            <p>
              На сайте предусмотрены обязательные legal-контуры: политика конфиденциальности, политика
              обработки персональных данных, cookies policy и отдельный отказ от ответственности в точности
              расчётов, потому что система работает как инструмент предварительной бюджетной оценки проекта.
            </p>
          </div>
          <div className="legal-strip__links">
            <Link to="/legal/privacy">Политика конфиденциальности</Link>
            <Link to="/legal/personal-data">Политика обработки ПДн</Link>
            <Link to="/legal/cookies">Cookies</Link>
            <Link to="/legal/disclaimer">Дисклеймер расчётов</Link>
          </div>
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
