import React from "react";
import { Building2, Layers, Wallet, ChevronLeft, ChevronRight, Download } from "lucide-react";
import useEstimate from "./hooks/useEstimate";
import ObjectStep from "./components/ObjectStep";
import SystemsStep from "./components/SystemsStep";
import BudgetStep from "./components/BudgetStep";
import Summary from "./components/Summary";

export default function App() {
  const vm = useEstimate();

  const steps = [
    { key: "object", label: "Объект", icon: Building2 },
    { key: "systems", label: "Системы", icon: Layers },
    { key: "budget", label: "Бюджет", icon: Wallet },
  ];

  return (
    <div className="page-shell">
      <div className="app-wrap">
        <header className="hero-card">
          <div>
            <div className="hero-kicker">Security Estimation Suite · Release 2</div>
            <h1>Калькулятор сметы систем безопасности</h1>
            <p>Модульная архитектура: шаги UI + hook состояния + lib/config расчётное ядро.</p>
          </div>
          <button className="primary-btn" onClick={vm.exportEstimate}>
            <Download size={18} /> Экспорт сметы
          </button>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === vm.step;
              const done = index < vm.step;
              return (
                <button key={item.key} className={`step-chip ${active ? "active" : ""} ${done ? "done" : ""}`} onClick={() => vm.setStep(index)} type="button">
                  <span className="step-icon"><Icon size={18} /></span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="step-actions">
            <button className="ghost-btn" type="button" onClick={() => vm.setStep((s) => Math.max(0, s - 1))} disabled={vm.step === 0}><ChevronLeft size={16} />Назад</button>
            <button className="primary-btn" type="button" onClick={() => vm.setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={vm.step === steps.length - 1}>Далее<ChevronRight size={16} /></button>
          </div>
        </section>

        {vm.step === 0 && <ObjectStep {...vm} />}
        {vm.step === 1 && <SystemsStep {...vm} />}
        {vm.step === 2 && <BudgetStep {...vm} />}

        <Summary totals={vm.totals} systemResults={vm.systemResults} />
      </div>
    </div>
  );
}
