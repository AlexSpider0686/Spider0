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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function App() {
  // 1. Состояние
  const [form, setForm] = useState({
    objectType: 'office',
    fireAlarmType: 'addressable',
    zones: [
      { id: '1', name: 'Этаж 1', type: 'office', area: 500 }
    ]
  });

  // 2. Расчет коэффициентов
  const currentFactors = useMemo(() => 
    OBJECT_FACTORS[form.objectType] || OBJECT_FACTORS.office, 
  [form.objectType]);

  // 3. Главный расчет (results)
  const results = useMemo(() => {
    let totalArea = 0;
    
    const zoneResults = form.zones.map(zone => {
      const area = Number(zone.area) || 0;
      totalArea += area;
      const profile = ZONE_PROFILES[zone.type] || ZONE_PROFILES.office;
      
      // Расчет оборудования по 6 системам
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

  // 4. Функции-обработчики
  const addZone = () => {
    const newZone = { id: Date.now().toString(), name: `Новая зона`, type: 'office', area: 100 };
    setForm(f => ({ ...f, zones: [...f.zones, newZone] }));
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
    const headers = ["Название", "Площадь (м2)", "Кабель (м)", "Оборудование (ед)"];
    const rows = results.zoneResults.map(z => 
      [z.name, z.area, Math.round(z.cable), z.totalUnits].join(";")
    );
    // Добавляем BOM для корректного отображения кириллицы в Excel
    const content = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Smeta_Systems.csv";
    link.click();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6 bg-slate-50 min-h-screen font-sans text-slate-900">
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg">
            <ShieldCheck className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">SEC-CALC <span className="text-blue-600 text-sm">PRO</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Система расчета систем безопасности</p>
          </div>
        </div>
        <Button onClick={exportCSV} variant="outline" className="rounded-xl border-slate-200 gap-2">
          <Download className="w-4 h-4" /> Экспорт CSV
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Настройки */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="bg-slate-100/50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-400" /> Параметры объекта
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Тип здания</Label>
                <Select value={form.objectType} onValueChange={(v) => setForm({...form, objectType: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Административное здание</SelectItem>
                    <SelectItem value="industrial">Склад / Промзона</SelectItem>
                    <SelectItem value="highrise">Высотное здание</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Итоговый виджет */}
          <Card className="rounded-2xl border-none bg-slate-900 text-white shadow-xl shadow-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Предварительный бюджет</p>
              <h2 className="text-3xl font-black mt-2">
                {results.summary.total.toLocaleString()} <span className="text-blue-400">₽</span>
              </h2>
              <div className="mt-6 space-y-3 pt-6 border-t border-white/10">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold">ОБОРУДОВАНИЕ</span>
                  <span className="font-mono">{Math.round(results.summary.equip).toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold">МОНТАЖ (СМР)</span>
                  <span className="font-mono">{Math.round(results.summary.labor).toLocaleString()} ₽</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Список зон */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="zones" className="w-full">
            <TabsList className="w-full bg-slate-200/50 p-1 rounded-xl mb-4">
              <TabsTrigger value="zones" className="flex-1 rounded-lg font-bold text-xs">СПИСОК ЗОН</TabsTrigger>
              <TabsTrigger value="details" className="flex-1 rounded-lg font-bold text-xs">СПЕЦИФИКАЦИЯ</TabsTrigger>
            </TabsList>

            <TabsContent value="zones" className="space-y-4 outline-none">
              {form.zones.map((zone) => (
                <div key={zone.id} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                  <div className="flex-1 min-w-[150px] space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Название</Label>
                    <Input 
                      className="rounded-xl bg-slate-50 border-none"
                      value={zone.name} 
                      onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-36 space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Тип</Label>
                    <Select value={zone.type} onValueChange={(v) => updateZone(zone.id, 'type', v)}>
                      <SelectTrigger className="rounded-xl bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(ZONE_PROFILES).map(k => <SelectItem key={k} value={k}>{ZONE_PROFILES[k].name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">М²</Label>
                    <Input 
                      type="number"
                      className="rounded-xl bg-slate-50 border-none font-mono"
                      value={zone.area} 
                      onChange={(e) => updateZone(zone.id, 'area', e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeZone(zone.id)}
                    className="rounded-xl text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button 
                onClick={addZone} 
                variant="outline" 
                className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-all font-bold"
              >
                <Plus className="w-5 h-5 mr-2" /> Добавить помещение
              </Button>
            </TabsContent>

            <TabsContent value="details">
               <Card className="rounded-2xl border-slate-100 border-dashed bg-transparent">
                 <CardContent className="p-10 text-center space-y-4">
                    <HardDrive className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-slate-500 text-sm">Здесь будет детальный список оборудования по каждой из 6 систем.</p>
                 </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
