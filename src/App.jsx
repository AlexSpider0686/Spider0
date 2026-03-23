import React, { useState, useMemo } from "react";
import { 
  Download, 
  Calculator, 
  Shield, 
  Camera, 
  Lock, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Settings2, 
  HardDrive,
  ShieldCheck
} from "lucide-react";

/**
 * ВНИМАНИЕ: Все UI-компоненты (Card, Button, Tabs) определены прямо здесь.
 * Это сделано специально, чтобы избежать ошибки "Rollup failed to resolve import",
 * так как в проекте отсутствуют внешние папки компонентов.
 */

// --- ВСТРОЕННЫЕ КОМПОНЕНТЫ (Автономные стили) ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>{children}</div>
);

const CardHeader = ({ children, className = "" }) => (
  <div className={`p-5 border-b border-slate-50 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = "" }) => (
  <h3 className={`font-bold text-slate-800 ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = "default", className = "" }) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 text-sm";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600",
    ghost: "text-slate-400 hover:text-red-500 hover:bg-red-50",
  };
  return (
    <button onClick={onClick} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = (props) => (
  <input 
    {...props} 
    className={`w-full p-2 bg-slate-50 rounded-xl border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-mono text-sm ${props.className}`} 
  />
);

const Label = ({ children, className = "" }) => (
  <label className={`block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ${className}`}>
    {children}
  </label>
);

const Select = ({ value, onValueChange, children }) => (
  <select 
    value={value} 
    onChange={(e) => onValueChange(e.target.value)}
    className="w-full p-2 bg-slate-50 rounded-xl border border-transparent focus:border-blue-500 outline-none cursor-pointer text-sm"
  >
    {children}
  </select>
);

// Простая реализация Табов
const Tabs = ({ children, defaultValue }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <div className="w-full">
      {React.Children.map(children, child => 
        child && React.isValidElement(child) ? React.cloneElement(child, { activeTab, setActiveTab }) : child
      )}
    </div>
  );
};

const TabsList = ({ children, activeTab, setActiveTab, className = "" }) => (
  <div className={`flex bg-slate-100 p-1 rounded-xl mb-4 ${className}`}>
    {React.Children.map(children, child => 
      child && React.isValidElement(child) ? React.cloneElement(child, { activeTab, setActiveTab }) : child
    )}
  </div>
);

const TabsTrigger = ({ children, value, activeTab, setActiveTab, className = "" }) => (
  <button
    onClick={() => setActiveTab(value)}
    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
      activeTab === value ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
    } ${className}`}
  >
    {children}
  </button>
);

const TabsContent = ({ children, value, activeTab }) => (
  activeTab === value ? <div className="animate-in fade-in duration-300">{children}</div> : null
);

// --- КОНСТАНТЫ И СПРАВОЧНИКИ ---

const ZONE_PROFILES = {
  office: { name: 'Офис / Open Space', density: 1.0 },
  parking: { name: 'Паркинг', density: 0.6 },
  public: { name: 'Холлы / Общие зоны', density: 1.2 },
  tech: { name: 'Серверные / Техпомещения', density: 1.5 }
};

const OBJECT_FACTORS = {
  office: { cable: 1.0, labor: 1.0, equip: 1.0 },
  industrial: { cable: 1.3, labor: 1.4, equip: 1.1 },
  highrise: { cable: 1.6, labor: 1.8, equip: 1.2 }
};

// --- ОСНОВНОЕ ПРИЛОЖЕНИЕ ---

export default function App() {
  const [form, setForm] = useState({
    objectType: 'office',
    fireAlarmType: 'addressable',
    zones: [
      { id: '1', name: 'Этаж 1', type: 'office', area: 500 }
    ]
  });

  const currentFactors = useMemo(() => 
    OBJECT_FACTORS[form.objectType] || OBJECT_FACTORS.office, 
  [form.objectType]);

  const results = useMemo(() => {
    let totalArea = 0;
    
    const zoneResults = form.zones.map(zone => {
      const area = Number(zone.area) || 0;
      totalArea += area;
      const profile = ZONE_PROFILES[zone.type] || ZONE_PROFILES.office;
      
      const cctv = Math.ceil((area / 55) * profile.density); 
      const acs = Math.ceil(area / 150) * 2; 
      const intrusion = Math.ceil(area / 100); 
      const ssoi = 1; 
      const fire = form.fireAlarmType === 'addressable' ? Math.ceil(area / 80) : Math.ceil(area / 45);
      const evac = Math.ceil(area / 60);

      const cable = area * 3.2 * currentFactors.cable;
      const totalUnits = cctv + acs + intrusion + fire + evac + ssoi;

      return { ...zone, area, cctv, acs, intrusion, fire, evac, ssoi, cable, totalUnits };
    });

    const equipCost = zoneResults.reduce((sum, z) => sum + (z.totalUnits * 8500 * currentFactors.equip), 0);
    const laborCost = totalArea * 350 * currentFactors.labor;

    return {
      totalArea,
      zoneResults,
      summary: {
        total: equipCost + laborCost,
        equip: equipCost,
        labor: laborCost
      }
    };
  }, [form, currentFactors]);

  const addZone = () => {
    setForm(f => ({ 
      ...f, 
      zones: [...f.zones, { id: Date.now().toString(), name: `Зона ${f.zones.length + 1}`, type: 'office', area: 100 }] 
    }));
  };

  const updateZone = (id, field, value) => {
    setForm(f => ({
      ...f, 
      zones: f.zones.map(z => z.id === id ? { ...z, [field]: value } : z)
    }));
  };

  const removeZone = (id) => {
    if (form.zones.length > 1) {
      setForm(f => ({ ...f, zones: f.zones.filter(z => z.id !== id) }));
    }
  };

  const exportCSV = () => {
    const headers = ["Название", "Площадь", "Кабель", "Оборудование"];
    const rows = results.zoneResults.map(z => [z.name, z.area, Math.round(z.cable), z.totalUnits].join(";"));
    const content = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "estimate.csv";
    link.click();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6 bg-slate-50 min-h-screen font-sans text-slate-900">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <ShieldCheck className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">SEC-CALC <span className="text-blue-600 text-sm">PRO</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Профессиональный расчет</p>
          </div>
        </div>
        <Button onClick={exportCSV} variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4" /> Экспорт сметы
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-400" /> Основные настройки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Тип объекта</Label>
                <Select value={form.objectType} onValueChange={(v) => setForm({...form, objectType: v})}>
                  <option value="office">Офис / Административный</option>
                  <option value="industrial">Склад / Промышленный</option>
                  <option value="highrise">Высотный комплекс</option>
                </Select>
              </div>
              <div>
                <Label>Система АПС</Label>
                <Select value={form.fireAlarmType} onValueChange={(v) => setForm({...form, fireAlarmType: v})}>
                  <option value="addressable">Адресная (рекомендуется)</option>
                  <option value="analog">Безадресная</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white shadow-xl shadow-blue-100 border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Calculator size={80} />
            </div>
            <CardContent className="p-6 relative z-10">
              <p className="text-blue-400 text-[10px] uppercase font-bold tracking-widest">Ориентировочный бюджет</p>
              <h2 className="text-3xl font-black mt-2">
                {Math.round(results.summary.total).toLocaleString()} <span className="text-blue-400 text-xl">₽</span>
              </h2>
              <div className="mt-6 space-y-3 pt-6 border-t border-white/10">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-tighter">Оборудование</span>
                  <span className="font-mono text-blue-200">{Math.round(results.summary.equip).toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-tighter">Монтаж / ПНР</span>
                  <span className="font-mono text-blue-200">{Math.round(results.summary.labor).toLocaleString()} ₽</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-8">
          <Tabs defaultValue="zones">
            <TabsList>
              <TabsTrigger value="zones">ПОМЕЩЕНИЯ ({form.zones.length})</TabsTrigger>
              <TabsTrigger value="details">ТЕХ. ПАРАМЕТРЫ</TabsTrigger>
            </TabsList>

            <TabsContent value="zones" className="space-y-4">
              {form.zones.map((zone) => (
                <div key={zone.id} className="flex flex-col md:flex-row gap-4 items-end bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                  <div className="w-full md:flex-1 space-y-1">
                    <Label>Название</Label>
                    <Input 
                      value={zone.name} 
                      onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                      placeholder="Напр: Основной зал"
                    />
                  </div>
                  <div className="w-full md:w-48 space-y-1">
                    <Label>Назначение</Label>
                    <Select value={zone.type} onValueChange={(v) => updateZone(zone.id, 'type', v)}>
                      {Object.keys(ZONE_PROFILES).map(k => (
                        <option key={k} value={k}>{ZONE_PROFILES[k].name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-full md:w-32 space-y-1">
                    <Label>Площадь (м²)</Label>
                    <Input 
                      type="number"
                      value={zone.area} 
                      onChange={(e) => updateZone(zone.id, 'area', e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" onClick={() => removeZone(zone.id)} className="w-full md:w-auto h-10 px-3">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button onClick={addZone} variant="outline" className="w-full py-8 border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 rounded-2xl">
                <Plus className="w-5 h-5 mr-2" /> Добавить помещение
              </Button>
            </TabsContent>

            <TabsContent value="details">
               <Card className="border-dashed bg-white/50 border-slate-200">
                 <CardContent className="p-16 text-center space-y-4">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <HardDrive className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700">Спецификация формируется</h4>
                      <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto italic">Подробный расчет датчиков, камер и кабельных трасс будет доступен после ввода всех площадей.</p>
                    </div>
                 </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
