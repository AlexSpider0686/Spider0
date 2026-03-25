import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { HeroVideo } from "../components/HeroVideo";
import { SectionHeader } from "../components/SectionHeader";
import { comparisonCards, growthPoints, metrics } from "../data/siteContent";

const sequenceSteps = [
  {
    title: "1. Базовые входные данные",
    text: "Пользователь задает тип объекта, общую и защищаемую площадь, этажность, регион и структуру зон.",
  },
  {
    title: "2. Автоматический профиль объекта",
    text: "Система определяет уровень инженерной насыщенности, сложность трасс и базовые плотности оборудования для каждой зоны.",
  },
  {
    title: "3. Расчет объемов по системам",
    text: "По АПС, СОУЭ, СОТС, СОТ, СКУД и ССОИ рассчитываются устройства, кабельный фонд, узлы, шкафы, активные элементы, объем КНС, СМР и ПНР.",
  },
  {
    title: "4. Разделение бюджета",
    text: "Каждая система раскладывается на оборудование, материалы, работы (СМР+ПНР), проектирование и интеграцию.",
  },
  {
    title: "5. Применение коэффициентов",
    text: "К трудозависимой части применяются зашитые и пользовательские коэффициенты: регион, статус здания, условия работ, сложность, стесненность, доступ.",
  },
  {
    title: "6. Итоговый бюджет и ТКП",
    text: "Система формирует финальный бюджет по системам и по объекту в целом, с объяснением происхождения каждой суммы.",
  },
];

const commonLogicBlocks = [
  {
    title: "Что вводит пользователь",
    points: [
      "Тип объекта, площадь объекта, защищаемая площадь зон.",
      "Этажность (надземная и подземная), регион РФ, статус здания.",
      "Зональную структуру: типы зон, площади, доли и количество этажей в зонах.",
      "Дополнительные коэффициенты и условия работ (при необходимости).",
    ],
  },
  {
    title: "Что система считает автоматически",
    points: [
      "Плотности насыщения оборудования по зонам и системам.",
      "Объемы оборудования и материалов, кабельный фонд и КНС.",
      "Трудозатраты (СМР, ПНР, интеграция, проектирование) по каждой системе.",
      "Структуру стоимости: оборудование, материалы, работы, проектирование, итог.",
    ],
  },
  {
    title: "Как считается стоимость оборудования",
    points: [
      "Определяется перечень ключевых позиций и их расчетное количество.",
      "Для ключевых позиций собираются рыночные цены из подключенных источников.",
      "Цена за единицу умножается на объем, формируется стоимость оборудования.",
      "По материалам применяется отдельная модель объема и стоимости по типам трасс.",
    ],
  },
  {
    title: "Как считается стоимость работ",
    points: [
      "Работы считаются укрупненными ставками за единицу объема (устройство, метр кабеля, точка интеграции и т.д.).",
      "СМР, ПНР, интеграция и КНС рассчитываются отдельно, затем суммируются.",
      "К трудозависимой части применяются коэффициенты условий работ.",
      "Региональный коэффициент и коэффициент эксплуатируемого здания применяются без двойного учета.",
    ],
  },
];

const systemLogic = [
  {
    code: "АПС",
    title: "Автоматическая пожарная сигнализация",
    userInput: "Площади зон, этажность, профиль объекта, регион, статус здания.",
    autoCalc:
      "Количество извещателей по зонам, адресные линии/шлейфы, приборы, шкафы, длины кабелей, объем СМР и ПНР.",
    result:
      "Стоимость оборудования + материалов + монтаж/ПНР + проектирование + коэффициенты условий.",
  },
  {
    code: "СОУЭ",
    title: "Система оповещения и управления эвакуацией",
    userInput: "Тип объекта, зоны пребывания людей, этажность, сценарий эвакуации.",
    autoCalc:
      "Количество оповещателей, зон оповещения, узлов и линий связи, монтажные и пусконаладочные объемы.",
    result:
      "Стоимость оборудования оповещения, трасс и работ с учетом сложности объекта и региональной поправки.",
  },
  {
    code: "СОТС",
    title: "Система охранно-тревожной сигнализации",
    userInput: "Типы зон риска, защищаемая площадь, архитектура объекта.",
    autoCalc:
      "Количество датчиков, рубежей, контроллеров, приборов и кабельной инфраструктуры.",
    result:
      "Итог по оборудованию, материалам и работам с поправкой на режим и доступность зон.",
  },
  {
    code: "СОТ",
    title: "Система охранного телевидения",
    userInput: "Назначение зон, уличный периметр, этажность и требования к обзорности.",
    autoCalc:
      "Количество камер (внутренние/уличные), регистраторы, HDD, PoE/не-PoE коммутаторы, СХД/АРМ, кабельный фонд.",
    result:
      "Стоимость оборудования видеонаблюдения и полного цикла работ, включая ПНР и интеграцию.",
  },
  {
    code: "СКУД",
    title: "Система контроля и управления доступом",
    userInput: "Количество зон доступа, входные группы, паркинг, этажность.",
    autoCalc:
      "Точки прохода, считыватели, контроллеры, исполнительные устройства, кабели и объем монтажа/ПНР.",
    result:
      "Стоимость по точкам прохода, контроллерам и работам с учетом региональных и эксплуатационных коэффициентов.",
  },
  {
    code: "ССОИ",
    title: "Система сбора и обработки информации",
    userInput: "Состав подсистем, количество зон, архитектура объекта.",
    autoCalc:
      "Точки интеграции, серверы, АРМ, коммутаторы и объем интеграционных ПНР.",
    result:
      "Бюджет интеграционной платформы с учетом сложности обмена, сети и требований к отказоустойчивости.",
  },
];

const coefficientGroups = [
  {
    title: "Зашитые в модели коэффициенты",
    points: [
      "Региональный коэффициент субъекта РФ.",
      "Коэффициент статуса здания (строящееся / действующее).",
      "Плотность инженерных коммуникаций и сложность трасс.",
      "Системные коэффициенты сложности, интеграции и проектирования.",
    ],
  },
  {
    title: "Коэффициенты, которые задает пользователь",
    points: [
      "Ночные/выходные работы и ограниченный доступ.",
      "Стесненность, высотность, фасадные и наружные работы.",
      "Требования к эстетике и доля скрытой прокладки.",
      "Дополнительные поправки на конкретные условия объекта.",
    ],
  },
];

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
            Система собирает финансовую модель по АПС, СОУЭ, СОТС, СОТ, СКУД и ССОИ, учитывает зонирование, тип
            объекта и региональные коэффициенты и превращает пресейл в управляемый цифровой процесс.
          </p>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={() => setAuthOpen(true)}>
              Приступить к расчету
            </button>
            <a className="btn btn--ghost-light" href="#positioning">
              Почему это работает
            </a>
            <a className="btn btn--ghost-light" href="#calculation-logic">
              Логика расчета
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
            Используя сайт, вы подтверждаете ознакомление с <Link to="/legal/privacy">политикой конфиденциальности</Link>,{" "}
            <Link to="/legal/cookies">cookies policy</Link>,{" "}
            <Link to="/legal/personal-data">политикой обработки персональных данных</Link> и{" "}
            <Link to="/legal/disclaimer">отказом от ответственности по точности расчетов</Link>.
          </div>
        </div>
      </section>

      <section className="section section--dark" id="positioning">
        <div className="container">
          <SectionHeader eyebrow="Позиционирование" title="Почему Smeta App нужен рынку прямо сейчас">
            В РФ рынок сметных и инженерных инструментов переполнен тяжелыми системами и самодельными таблицами. Ниша
            быстрого браузерного пресейл-калькулятора для нескольких систем безопасности почти свободна.
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
          <SectionHeader
            eyebrow="Сравнение подходов"
            title="Там, где рынок дает либо перегруз, либо самоделки, здесь появляется системный пресейл"
          >
            Платформа не пытается заменить рабочую ПСД или экспертизу. Ее задача — быстро, прозрачно и профессионально
            сформировать предварительный бюджет и коммерческую рамку проекта.
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
                <tr>
                  <td>Целевая аудитория</td>
                  <td>Профессиональный сметчик</td>
                  <td>Инженер-проектировщик</td>
                  <td>Пресейл-менеджер / ГИП / РП</td>
                </tr>
                <tr>
                  <td>Время расчета</td>
                  <td>2-5 часов</td>
                  <td>30-60 минут</td>
                  <td>5-10 минут</td>
                </tr>
                <tr>
                  <td>Точность</td>
                  <td>Для экспертизы</td>
                  <td>80-90%</td>
                  <td>75-85% для предварительного бюджета</td>
                </tr>
                <tr>
                  <td>Порог входа</td>
                  <td>Высокий</td>
                  <td>Средний</td>
                  <td>Низкий</td>
                </tr>
                <tr>
                  <td>Мобильность</td>
                  <td>ПК + ключ</td>
                  <td>Нужен Excel</td>
                  <td>Любой браузер / планшет</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="container feature-layout">
          <div>
            <SectionHeader eyebrow="Ключевые точки роста" title="Что превращает калькулятор в рабочее место пресейла">
              Система продает не таблицу, а инженерный интеллект: знания о плотности оборудования, трассах, зонах,
              региональной поправке и логике формирования бюджета.
            </SectionHeader>
            <ul className="growth-list">
              {growthPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="spotlight-card">
            <div className="spotlight-card__eyebrow">Для кого продукт</div>
            <h3>Пресейл-менеджеры, ГИПы, руководители проектов, интеграторы и коммерческие службы</h3>
            <p>
              Smeta App сокращает цикл первичной оценки, дает единый язык для инженерии и коммерции и делает расчет
              презентабельным для клиента уже на первой итерации переговоров.
            </p>
            <button className="btn btn--primary" onClick={() => setAuthOpen(true)}>
              Получить доступ к демо
            </button>
          </div>
        </div>
      </section>

      <section className="section section--light" id="calculation-logic">
        <div className="container">
          <SectionHeader
            eyebrow="Логика расчета"
            title="Как считается бюджет: от входных параметров объекта до итоговой суммы проекта"
          >
            Расчет идет в фиксированной последовательности: ввод, автоматическое определение параметров, расчет по
            системам, применение коэффициентов и формирование итогового бюджета с объяснением.
          </SectionHeader>

          <div className="logic-sequence">
            {sequenceSteps.map((step) => (
              <article key={step.title} className="logic-sequence__card">
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>

          <div className="calc-logic-grid">
            {commonLogicBlocks.map((block) => (
              <article key={block.title} className="calc-logic-card">
                <h3>{block.title}</h3>
                <ul>
                  {block.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="system-logic-grid">
            {systemLogic.map((item) => (
              <article key={item.code} className="system-logic-card">
                <div className="system-logic-card__code">{item.code}</div>
                <h3>{item.title}</h3>
                <p>
                  <strong>Ввод пользователя:</strong> {item.userInput}
                </p>
                <p>
                  <strong>Система считает автоматически:</strong> {item.autoCalc}
                </p>
                <p>
                  <strong>Результат в бюджете:</strong> {item.result}
                </p>
              </article>
            ))}
          </div>

          <div className="coefficient-grid">
            {coefficientGroups.map((group) => (
              <article key={group.title} className="coefficient-card">
                <h3>{group.title}</h3>
                <ul>
                  {group.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="budget-formula">
            <h3>Итоговая формула бюджета</h3>
            <p>
              Итог = (Оборудование + Материалы) + (СМР + ПНР + Интеграция + КНС + Проектирование) × Коэффициенты
              условий × Коэффициент статуса здания × Региональный коэффициент.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--light">
        <div className="container legal-strip">
          <div>
            <h3>Юридически прозрачная работа сайта</h3>
            <p>
              На сайте предусмотрены обязательные legal-контуры: политика конфиденциальности, политика обработки
              персональных данных, cookies policy и отдельный отказ от ответственности в точности расчетов, так как
              система работает как инструмент предварительной бюджетной оценки проекта.
            </p>
          </div>
          <div className="legal-strip__links">
            <Link to="/legal/privacy">Политика конфиденциальности</Link>
            <Link to="/legal/personal-data">Политика обработки ПДн</Link>
            <Link to="/legal/cookies">Cookies</Link>
            <Link to="/legal/disclaimer">Дисклеймер расчетов</Link>
          </div>
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
