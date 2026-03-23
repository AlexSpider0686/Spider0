import React from "react";
import { Building2, Layers, Wallet, ChevronLeft, ChevronRight, Download } from "lucide-react";
import useEstimate from "./hooks/useEstimate";
import ObjectStep from "./components/ObjectStep";
import SystemsStep from "./components/SystemsStep";
import BudgetStep from "./components/BudgetStep";
import Summary from "./components/Summary";
import { BUILD_NUMBER } from "./config/estimateConfig";

export default function App() {
  const vm = useEstimate();

  const steps = [
    { key: "object", label: "Объект", icon: Building2 },
    { key: "systems", label: "Системы", icon: Layers },
    { key: "budget", label: "Бюджет", icon: Wallet },
  ];

  return (
    <div className="page-shell">
      <div className="build-badge">Сборка: {BUILD_NUMBER}</div>
      <div className="app-wrap">
        <header className="hero-card">
          <div>
            <div className="hero-kicker">Security Estimation Suite · Release 2</div>
            <h1>Калькулятор сметы систем безопасности</h1>
            <p>Модульная архитектура: шаги интерфейса, hook состояния и расчётное ядро в lib/config.</p>
          </div>
          <button className="primary-btn" onClick={vm.exportEstimate} type="button">
            <Download size={16} /> Экспорт сметы
          </button>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === vm.step;
              const done = index < vm.step;
              return (
                <button
                  key={item.key}
                  className={`step-chip ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => vm.setStep(index)}
                  type="button"
                >
                  <span className="step-icon">
                    <Icon size={14} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="step-actions">
            <button className="ghost-btn" type="button" onClick={() => vm.setStep((step) => Math.max(0, step - 1))} disabled={vm.step === 0}>
              <ChevronLeft size={14} /> Назад
            </button>
            <button
              className="primary-btn"
              type="button"
              onClick={() => vm.setStep((step) => Math.min(steps.length - 1, step + 1))}
              disabled={vm.step === steps.length - 1}
            >
              Далее <ChevronRight size={14} />
            </button>
          </div>
        </section>

        {vm.step === 0 ? <ObjectStep {...vm} /> : null}
        {vm.step === 1 ? <SystemsStep {...vm} /> : null}
        {vm.step === 2 ? <BudgetStep {...vm} /> : null}

        <Summary totals={vm.totals} systemResults={vm.systemResults} objectData={vm.objectData} />
      </div>
    </div>
  );
}
