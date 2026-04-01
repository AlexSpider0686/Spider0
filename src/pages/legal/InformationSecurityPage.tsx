import { LegalPageLayout } from "../../components/LegalPageLayout";
import { informationSecurityRegistry, informationSecurityRegistryCsv } from "../../data/informationSecurityContent";

export function InformationSecurityPage() {
  return (
    <LegalPageLayout title="Информационная безопасность" containerClassName="legal-page__container--wide">
      <section className="infosec-hero">
        <div className="infosec-hero__overlay" />
        <div className="infosec-hero__content">
          <div className="infosec-hero__eyebrow">Project.Core™ / ИБ-контур</div>
          <h2>Текущий статус ИБ-контуров сайта и платформы</h2>
          <p>
            В настоящее время ведется доработка сайта и платформы с учетом требований стандартов по информационной безопасности. Текущий
            контур используется как развиваемая рабочая среда, а сам ИБ-блок сопровождается отдельной дорожной картой по инфраструктуре,
            процессам разработки и внешним взаимодействиям.
          </p>
        </div>
      </section>

      <p>
        На текущем этапе сайт и платформа размещаются и сопровождаются с использованием репозитория GitHub. Параллельно ведется работа по
        переходу на отечественный репозиторий GitVerse и облачное хранилище Сбер для дальнейшего развития и эксплуатационного контура.
      </p>
      <p>
        Одновременно разрабатывается собственный инструментальный контур для дальнейшей разработки и сопровождения продукта взамен текущего
        использования CODEX OpenAI. Этот этап рассматривается как часть общей программы по выстраиванию более автономной и контролируемой
        среды разработки.
      </p>

      <h2>Таблица для ИБ-документа</h2>
      <p>
        Ниже приведен реестр внешних информационных взаимодействий сайта и платформы: какие внешние адреса используются, для чего именно,
        насколько взаимодействие обязательно и какие данные могут передаваться при работе соответствующего сценария.
      </p>
      <div className="infosec-table-wrap">
        <table className="infosec-table">
          <thead>
            <tr>
              <th>Внешний адрес / домен</th>
              <th>Назначение</th>
              <th>Обязательность</th>
              <th>Какие данные могут передаваться</th>
              <th>Комментарий по риску</th>
            </tr>
          </thead>
          <tbody>
            {informationSecurityRegistry.map((row) => (
              <tr key={row.domain}>
                <td>{row.domain}</td>
                <td>{row.purpose}</td>
                <td>{row.required}</td>
                <td>{row.data}</td>
                <td>{row.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Таблица для Excel / Word</h2>
      <p>
        Ниже та же информация приведена в CSV-совместимом виде с разделителем `;`. Этот блок можно использовать как основу для импорта в
        Excel, Word или внутренние документы по внешним информационным взаимодействиям.
      </p>
      <div className="infosec-csv-block">
        <pre>{informationSecurityRegistryCsv}</pre>
      </div>
    </LegalPageLayout>
  );
}
