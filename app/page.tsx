'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const UNIDADES_MEDIDA = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'tbsp', label: 'tbsp (c. sopa)' },
  { value: 'tsp', label: 'tsp (c. chá)' },
  { value: 'unidades', label: 'unidades' },
  { value: 'cups', label: 'cups (chávenas)' },
];

// As receitas importadas guardam as tags originais em inglês (podem ser várias
// por receita, separadas por vírgula, ex: "Lunch, Dinner, Low Carb").
// Este mapa serve só para MOSTRAR em português — os valores gravados na BD
// continuam em inglês, para que o filtro funcione com os dados existentes.
const TAG_TRANSLATIONS: Record<string, string> = {
  'Breakfast': 'Pequeno-almoço',
  'Lunch': 'Almoço',
  'Dinner': 'Jantar',
  'Snacks': 'Lanche',
  'Desserts': 'Sobremesa',
  'Sweet': 'Doce',
  'Low Carb': 'Baixo Carboidrato',
  'High Protein': 'Rico em Proteína',
  'Vegan': 'Vegano',
  'Vegetarian': 'Vegetariano',
  'Gluten Free': 'Sem Glúten',
  'Dairy Free': 'Sem Lactose',
  'Keto': 'Keto',
  'Quick': 'Rápida',
  'Quick (under 30 mins)': 'Rápida (< 30 min)',
  'Meal Prep': 'Meal Prep',
  'Side': 'Acompanhamento',
  'Sauce': 'Molho',
  'Drinks': 'Bebidas',
  'Baking': 'Padaria',
};

const TAG_OPTIONS = Object.keys(TAG_TRANSLATIONS).map(en => ({
  value: en,
  label: TAG_TRANSLATIONS[en],
}));

const translateTag = (tag: string) => TAG_TRANSLATIONS[tag.trim()] || tag.trim();

const parseTags = (categoria?: string): string[] =>
  (categoria || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

const FAVORITES_KEY = 'receitas_favoritas_v1';
const SHOPPING_CHECKED_KEY = 'lista_compras_checked_v1';
const PAGE_SIZE = 12;

interface Ingrediente {
  id: string;
  nome: string;
  tipo?: string;
  categoria?: string;
  unidade_padrao?: string;
}

interface ReceitaIngrediente {
  id?: string;
  receita_id?: string;
  ingrediente_id: string;
  quantidade: number;
  unidade?: string;
  ingredientes?: Ingrediente;
}

interface Receita {
  id: string;
  nome: string;
  descricao?: string;
  instrucoes?: string;
  tempo_preparacao_min?: number;
  categoria?: string;
  imagem_url?: string;
  porcoes?: number;
  calorias_totais?: number;
  proteina_totais_g?: number;
  gordura_totais_g?: number;
  carboidratos_totais_g?: number;
  calorias_por_porcao?: number;
  proteina_por_porcao_g?: number;
  gordura_por_porcao_g?: number;
  carboidratos_por_porcao_g?: number;
  receita_ingredientes?: ReceitaIngrediente[];
}

interface PlanoRefeicao {
  id: string;
  dia_semana: string;
  tipo_refeicao: string;
  receita_id: string;
  receitas?: Receita;
}

interface ShoppingListItem {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  categoria: string;
  comprado: boolean;
}

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const TIPOS_REFEICAO = ['Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar', 'Sobremesas', 'Outros'];

function RecipeImage({ url, nome, size = 'card' }: { url?: string; nome: string; size?: 'card' | 'modal' }) {
  const h = size === 'card' ? '120px' : '160px';
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        style={{ width: '100%', height: h, objectFit: 'cover', borderRadius: size === 'card' ? '10px 10px 0 0' : '12px' }}
      />
    );
  }
  return (
    <div
      style={{ width: '100%', height: h, borderRadius: size === 'card' ? '10px 10px 0 0' : '12px' }}
      className="bg-[#F1E6D6] flex items-center justify-center"
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.4">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    </div>
  );
}

function MacroBadges({
  cals, protein, fat, carbs, compact = false,
}: { cals?: number; protein?: number; fat?: number; carbs?: number; compact?: boolean }) {
  if (cals === undefined || cals === null) return null;
  const fmt = (n?: number) => (n === undefined || n === null ? '-' : Math.round(n));
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[#7A7160] font-mono">
        <span className="text-[#232A6B] font-semibold">{fmt(cals)} kcal</span>
        <span>P {fmt(protein)}g</span>
        <span>G {fmt(fat)}g</span>
        <span>C {fmt(carbs)}g</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-[#F6EEE1] border border-[#E8DCC8] p-2.5 rounded-xl text-center">
        <span className="text-[10px] font-bold text-[#8A8066] uppercase">Kcal</span>
        <p className="text-base font-bold text-[#232A6B] font-mono mt-0.5">{fmt(cals)}</p>
      </div>
      <div className="bg-[#F6EEE1] border border-[#E8DCC8] p-2.5 rounded-xl text-center">
        <span className="text-[10px] font-bold text-[#8A8066] uppercase">Proteína</span>
        <p className="text-base font-bold text-[#1A1A2E] font-mono mt-0.5">{fmt(protein)}g</p>
      </div>
      <div className="bg-[#F6EEE1] border border-[#E8DCC8] p-2.5 rounded-xl text-center">
        <span className="text-[10px] font-bold text-[#8A8066] uppercase">Gordura</span>
        <p className="text-base font-bold text-[#1A1A2E] font-mono mt-0.5">{fmt(fat)}g</p>
      </div>
      <div className="bg-[#F6EEE1] border border-[#E8DCC8] p-2.5 rounded-xl text-center">
        <span className="text-[10px] font-bold text-[#8A8066] uppercase">Carbs</span>
        <p className="text-base font-bold text-[#1A1A2E] font-mono mt-0.5">{fmt(carbs)}g</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'receitas' | 'plano' | 'compras' | 'calculadora'>('receitas');

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [planoSemanal, setPlanoSemanal] = useState<PlanoRefeicao[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [ingredientFilterSearch, setIngredientFilterSearch] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedReceitaDetails, setSelectedReceitaDetails] = useState<Receita | null>(null);

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [modalDia, setModalDia] = useState('Segunda');
  const [modalRefeicao, setModalRefeicao] = useState('Almoço');
  const [selectedReceitaForPlan, setSelectedReceitaForPlan] = useState('');
  const [planRecipeSearch, setPlanRecipeSearch] = useState('');

  const [novaReceita, setNovaReceita] = useState({
    nome: '',
    descricao: '',
    instrucoes: '',
    imagem_url: '',
    tempo_preparacao_min: 30,
    tags: [] as string[],
    ingredientes: [{ ingrediente_id: '', buscaIngrediente: '', quantidade: 1, unidade: 'g' }]
  });

  // ESTADOS DA CALCULADORA DE MACROS
  const [calcGenera, setCalcGenera] = useState<'feminino' | 'masculino'>('feminino');
  const [calcIdade, setCalcIdade] = useState<number>(28);
  const [calcAltura, setCalcAltura] = useState<number>(165);
  const [calcPeso, setCalcPeso] = useState<number>(62);
  const [calcAtividade, setCalcAtividade] = useState<number>(1.375);
  const [calcObjetivo, setCalcObjetivo] = useState<'perda' | 'manutencao' | 'ganho'>('perda');

  const [calcResult, setCalcResult] = useState<{
    bmr: number;
    tdee: number;
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
    try {
      const favs = localStorage.getItem(FAVORITES_KEY);
      if (favs) setFavoriteIds(JSON.parse(favs));
      const checked = localStorage.getItem(SHOPPING_CHECKED_KEY);
      if (checked) setCheckedItems(JSON.parse(checked));
    } catch (e) {
      console.error('Erro ao ler dados locais:', e);
    }
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchTerm, selectedIngredientIds, showOnlyFavorites]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ingData } = await supabase.from('ingredientes').select('*');
      const allIngredientes: Ingrediente[] = ingData || [];

      allIngredientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }));
      setIngredientes(allIngredientes);

      const { data: recIngData } = await supabase.from('receitas_ingredientes').select('*');
      const allRecIng = recIngData || [];

      const { data: receitasData } = await supabase.from('receitas').select('*');
      const allReceitas: Receita[] = receitasData || [];

      const receitasCompletas = allReceitas.map(rec => {
        const ingredientesDaReceita = allRecIng
          .filter(ri => ri.receita_id === rec.id)
          .map(ri => {
            const ingObj = allIngredientes.find(i => i.id === ri.ingrediente_id);
            return {
              ...ri,
              unidade: ri.unidade || ingObj?.unidade_padrao || 'g',
              ingredientes: ingObj
            };
          });

        return {
          ...rec,
          receita_ingredientes: ingredientesDaReceita
        };
      });

      setReceitas(receitasCompletas);

      if (selectedReceitaDetails) {
        const atualizada = receitasCompletas.find(r => r.id === selectedReceitaDetails.id);
        if (atualizada) setSelectedReceitaDetails(atualizada);
      }

      const { data: planoData } = await supabase.from('plano_refeicoes').select('*');
      setPlanoSemanal(planoData || []);

    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  };

  const persistFavorites = (ids: string[]) => {
    setFavoriteIds(ids);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); } catch (e) { console.error(e); }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = favoriteIds.includes(id) ? favoriteIds.filter(f => f !== id) : [...favoriteIds, id];
    persistFavorites(next);
  };

  const persistCheckedItems = (next: Record<string, boolean>) => {
    setCheckedItems(next);
    try { localStorage.setItem(SHOPPING_CHECKED_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  };

  const handleSaveRecipe = async () => {
    if (!novaReceita.nome.trim()) return alert('Insira o nome da receita!');

    try {
      const { data: recCreated, error: recErr } = await supabase
        .from('receitas')
        .insert([{
          nome: novaReceita.nome,
          descricao: novaReceita.descricao,
          instrucoes: novaReceita.instrucoes,
          imagem_url: novaReceita.imagem_url || null,
          tempo_preparacao_min: Number(novaReceita.tempo_preparacao_min),
          categoria: novaReceita.tags.join(', '),
        }])
        .select()
        .single();

      if (recErr) throw recErr;

      const itemsToInsert = novaReceita.ingredientes
        .filter(i => i.ingrediente_id)
        .map(i => ({
          receita_id: recCreated.id,
          ingrediente_id: i.ingrediente_id,
          quantidade: Number(i.quantidade),
          unidade: i.unidade
        }));

      if (itemsToInsert.length > 0) {
        const { error: ingErr } = await supabase.from('receitas_ingredientes').insert(itemsToInsert);
        if (ingErr) {
          const itemsFallback = itemsToInsert.map(({ unidade, ...rest }) => rest);
          await supabase.from('receitas_ingredientes').insert(itemsFallback);
        }
      }

      setShowRecipeModal(false);
      setNovaReceita({
        nome: '',
        descricao: '',
        instrucoes: '',
        imagem_url: '',
        tempo_preparacao_min: 30,
        tags: [],
        ingredientes: [{ ingrediente_id: '', buscaIngrediente: '', quantidade: 1, unidade: 'g' }]
      });
      fetchData();

    } catch (err: any) {
      alert(`Erro ao guardar receita: ${err.message || err}`);
    }
  };

  const handleAddMealToPlan = async () => {
    if (!selectedReceitaForPlan) return alert('Selecione uma receita!');

    try {
      const { error } = await supabase
        .from('plano_refeicoes')
        .insert([{
          dia_semana: modalDia,
          tipo_refeicao: modalRefeicao,
          receita_id: selectedReceitaForPlan
        }]);

      if (error) throw error;

      setShowPlanModal(false);
      setSelectedReceitaForPlan('');
      setPlanRecipeSearch('');
      fetchData();

    } catch (err: any) {
      alert(`Erro ao guardar no plano: ${err.message}`);
    }
  };

  const handleRemoveFromPlan = async (id: string) => {
    try {
      await supabase.from('plano_refeicoes').delete().eq('id', id);
      setPlanoSemanal(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`);
    }
  };

  const toggleCheckItem = (id: string) => {
    persistCheckedItems({ ...checkedItems, [id]: !checkedItems[id] });
  };

  const toggleIngredientSelection = (id: string) => {
    setSelectedIngredientIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleNovaReceitaTag = (tagValue: string) => {
    setNovaReceita(prev => ({
      ...prev,
      tags: prev.tags.includes(tagValue)
        ? prev.tags.filter(t => t !== tagValue)
        : [...prev.tags, tagValue]
    }));
  };

  const buildShoppingList = (): ShoppingListItem[] => {
    const listMap: Record<string, ShoppingListItem> = {};

    planoSemanal.forEach(plano => {
      const rec = receitas.find(r => r.id === plano.receita_id);

      if (rec && rec.receita_ingredientes) {
        rec.receita_ingredientes.forEach(ri => {
          const ingObj = ri.ingredientes || ingredientes.find(i => i.id === ri.ingrediente_id);
          if (!ingObj) return;

          const un = ri.unidade || 'g';
          const key = `${ingObj.nome.toLowerCase()}_${un.toLowerCase()}`;
          const qta = Number(ri.quantidade) || 0;

          const cat = ingObj.tipo || ingObj.categoria || 'Outros';

          if (listMap[key]) {
            listMap[key].quantidade += qta;
          } else {
            listMap[key] = {
              id: key,
              nome: ingObj.nome,
              quantidade: qta,
              unidade: un,
              categoria: cat,
              comprado: !!checkedItems[key]
            };
          }
        });
      }
    });

    return Object.values(listMap);
  };

  const handleCalculateMacros = () => {
    let bmr = 0;
    if (calcGenera === 'feminino') {
      bmr = 10 * calcPeso + 6.25 * calcAltura - 5 * calcIdade - 161;
    } else {
      bmr = 10 * calcPeso + 6.25 * calcAltura - 5 * calcIdade + 5;
    }

    const tdee = bmr * calcAtividade;

    let targetCalories = tdee;
    if (calcObjetivo === 'perda') {
      targetCalories = tdee - 400;
    } else if (calcObjetivo === 'ganho') {
      targetCalories = tdee + 300;
    }

    const proteinFactor = calcObjetivo === 'perda' ? 2.0 : 1.8;
    const proteinGrams = Math.round(calcPeso * proteinFactor);
    const proteinCalories = proteinGrams * 4;

    const fatCalories = targetCalories * 0.25;
    const fatGrams = Math.round(fatCalories / 9);

    const carbsCalories = targetCalories - (proteinCalories + fatCalories);
    const carbsGrams = Math.round(Math.max(carbsCalories / 4, 50));

    setCalcResult({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories: Math.round(targetCalories),
      proteinGrams,
      carbsGrams,
      fatGrams
    });
  };

  const shoppingList = buildShoppingList();

  const shoppingListByCategory = shoppingList.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const cat = item.categoria || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const filteredRecipes = receitas.filter(r => {
    const recipeTags = parseTags(r.categoria);
    const matchesCategory = selectedCategory === 'Todas' || recipeTags.includes(selectedCategory);
    const matchesSearch = !searchTerm.trim() || r.nome.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesFavorite = !showOnlyFavorites || favoriteIds.includes(r.id);

    if (!matchesCategory || !matchesSearch || !matchesFavorite) return false;
    if (selectedIngredientIds.length === 0) return true;

    const recIngIds = r.receita_ingredientes?.map(ri => ri.ingrediente_id) || [];
    return selectedIngredientIds.every(ingId => recIngIds.includes(ingId));
  });

  const visibleRecipes = filteredRecipes.slice(0, visibleCount);
  const filteredIngredientChips = ingredientes.filter(i =>
    i.nome.toLowerCase().includes(ingredientFilterSearch.trim().toLowerCase())
  );

  const dayTotals = (dia: string) => {
    const items = planoSemanal.filter(p => p.dia_semana === dia);
    return items.reduce((acc, p) => {
      const rec = receitas.find(r => r.id === p.receita_id);
      if (rec) {
        acc.cals += rec.calorias_por_porcao || 0;
        acc.protein += rec.proteina_por_porcao_g || 0;
      }
      return acc;
    }, { cals: 0, protein: 0 });
  };

  return (
    <div className="min-h-screen bg-[#FAF1E6] text-[#1A1A2E] pb-12" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="border-b border-[#E8DCC8] bg-[#FAF1E6]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A2E]" style={{ fontFamily: "'Fraunces', serif" }}>As minhas receitas</h1>
            <p className="text-[#5F5A4E] text-sm mt-1">
              Planeie as suas refeições, pesquise receitas e controle a sua lista de compras.
            </p>
          </div>

          <div className="flex gap-3">
            {activeTab === 'receitas' && (
              <button
                onClick={() => setShowRecipeModal(true)}
                className="bg-[#232A6B] hover:bg-[#2E3789] text-[#FAF1E6] font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
              >
                + Nova Receita
              </button>
            )}
          </div>
        </div>

        {/* Tabs Navegação */}
        <div className="max-w-6xl mx-auto px-6 flex gap-8 border-t border-[#E8DCC8] mt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('receitas')}
            className={`py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'receitas'
                ? 'border-[#232A6B] text-[#232A6B]'
                : 'border-transparent text-[#8A8066] hover:text-[#5F5A4E]'
            }`}
          >
            Receitas
          </button>
          <button
            onClick={() => setActiveTab('plano')}
            className={`py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'plano'
                ? 'border-[#232A6B] text-[#232A6B]'
                : 'border-transparent text-[#8A8066] hover:text-[#5F5A4E]'
            }`}
          >
            Plano Semanal
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`py-3 text-sm font-medium border-b-2 transition relative whitespace-nowrap ${
              activeTab === 'compras'
                ? 'border-[#232A6B] text-[#232A6B]'
                : 'border-transparent text-[#8A8066] hover:text-[#5F5A4E]'
            }`}
          >
            Lista de Compras
            {shoppingList.length > 0 && (
              <span className="ml-2 bg-[#232A6B]/10 text-[#232A6B] border border-[#232A6B]/30 text-xs px-2 py-0.5 rounded-full">
                {shoppingList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('calculadora')}
            className={`py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'calculadora'
                ? 'border-[#232A6B] text-[#232A6B]'
                : 'border-transparent text-[#8A8066] hover:text-[#5F5A4E]'
            }`}
          >
            Calculadora de Macros
          </button>
        </div>
      </header>

      {/* Faixa decorativa */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-[3px] mt-0" style={{ background: 'repeating-linear-gradient(90deg, #232A6B 0 14px, transparent 14px 22px)' }} />
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 mt-8">
        {loading ? (
          <div className="text-center py-20 text-[#8A8066]">A carregar dados...</div>
        ) : (
          <>
            {/* TAB 1: RECEITAS */}
            {activeTab === 'receitas' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-[#E8DCC8] space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <h3 className="text-xs font-bold uppercase text-[#8A8066] tracking-wider mb-2">Pesquisar por nome</h3>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Ex: frango, salada, omelete..."
                        className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-xl p-2.5 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setShowOnlyFavorites(v => !v)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition whitespace-nowrap ${
                          showOnlyFavorites
                            ? 'bg-[#232A6B] text-[#FAF1E6] border-[#232A6B]'
                            : 'bg-[#FAF1E6] text-[#5F5A4E] border-[#E8DCC8] hover:border-[#232A6B]/40'
                        }`}
                      >
                        ★ Só favoritas
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-[#E8DCC8]">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-[#8A8066] tracking-wider">Filtrar por Ingredientes</h3>
                      <p className="text-xs text-[#8A8066] mt-0.5">Pode selecionar um ou vários ingredientes para encontrar receitas correspondentes.</p>
                    </div>

                    {selectedIngredientIds.length > 0 && (
                      <button
                        onClick={() => setSelectedIngredientIds([])}
                        className="text-xs text-[#232A6B] hover:underline"
                      >
                        Limpar seleção ({selectedIngredientIds.length})
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={ingredientFilterSearch}
                    onChange={e => setIngredientFilterSearch(e.target.value)}
                    placeholder="Pesquisar ingrediente na lista abaixo..."
                    className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-lg p-2 text-xs text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                  />

                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-[#FAF1E6] rounded-lg border border-[#E8DCC8]">
                    {filteredIngredientChips.map(ing => {
                      const isSelected = selectedIngredientIds.includes(ing.id);
                      return (
                        <button
                          key={ing.id}
                          onClick={() => toggleIngredientSelection(ing.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#232A6B] text-[#FAF1E6] border border-[#232A6B]'
                              : 'bg-white text-[#5F5A4E] border border-[#E8DCC8] hover:border-[#232A6B]/40'
                          }`}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{ing.nome}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 flex-wrap pt-2 border-t border-[#E8DCC8] items-center">
                    <span className="text-xs font-bold uppercase text-[#8A8066] mr-2">Categoria:</span>
                    <button
                      onClick={() => setSelectedCategory('Todas')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        selectedCategory === 'Todas'
                          ? 'bg-[#232A6B] text-[#FAF1E6]'
                          : 'bg-[#FAF1E6] text-[#5F5A4E] border border-[#E8DCC8] hover:border-[#232A6B]/40'
                      }`}
                    >
                      Todas
                    </button>
                    {TAG_OPTIONS.map(tag => (
                      <button
                        key={tag.value}
                        onClick={() => setSelectedCategory(tag.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          selectedCategory === tag.value
                            ? 'bg-[#232A6B] text-[#FAF1E6]'
                            : 'bg-[#FAF1E6] text-[#5F5A4E] border border-[#E8DCC8] hover:border-[#232A6B]/40'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredRecipes.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-[#8A8066]">
                      Nenhuma receita encontrada para estes filtros.
                    </div>
                  ) : (
                    visibleRecipes.map((receita, idx) => (
                      <div
                        key={`${receita.id}-${idx}`}
                        onClick={() => setSelectedReceitaDetails(receita)}
                        className="bg-white hover:shadow-md border border-[#E8DCC8] hover:border-[#232A6B]/40 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                      >
                        <div className="relative">
                          <RecipeImage url={receita.imagem_url} nome={receita.nome} size="card" />
                          <button
                            onClick={(e) => toggleFavorite(receita.id, e)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-sm"
                            aria-label="Marcar como favorita"
                          >
                            {favoriteIds.includes(receita.id) ? '★' : '☆'}
                          </button>
                        </div>
                        <div className="p-4 flex-1">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {parseTags(receita.categoria).slice(0, 2).map(t => (
                              <span key={t} className="text-[10px] font-semibold text-[#232A6B] bg-[#232A6B]/10 px-1.5 py-0.5 rounded">
                                {translateTag(t)}
                              </span>
                            ))}
                          </div>
                          <h3
                            className="font-semibold text-lg text-[#1A1A2E] group-hover:text-[#232A6B] transition-colors line-clamp-1 mb-2"
                            style={{ fontFamily: "'Fraunces', serif" }}
                          >
                            {receita.nome}
                          </h3>
                          {receita.descricao && (
                            <p className="text-xs text-[#8A8066] line-clamp-2 mb-2">
                              {receita.descricao}
                            </p>
                          )}
                          <MacroBadges
                            cals={receita.calorias_por_porcao}
                            protein={receita.proteina_por_porcao_g}
                            fat={receita.gordura_por_porcao_g}
                            carbs={receita.carboidratos_por_porcao_g}
                            compact
                          />
                        </div>

                        <div className="px-4 pb-4 pt-3 border-t border-[#E8DCC8] flex items-center justify-between text-xs text-[#8A8066]">
                          <span>⏱ {receita.tempo_preparacao_min || 15} min</span>
                          <span className="text-[#232A6B] font-semibold">Ver receita →</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {visibleCount < filteredRecipes.length && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium bg-white border border-[#E8DCC8] text-[#232A6B] hover:border-[#232A6B]/50 transition"
                    >
                      Carregar mais ({filteredRecipes.length - visibleCount} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PLANO SEMANAL */}
            {activeTab === 'plano' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                  {DIAS_SEMANA.map(dia => {
                    const totals = dayTotals(dia);
                    return (
                      <div key={dia} className="bg-white border border-[#E8DCC8] rounded-xl p-3 flex flex-col">
                        <h3 className="text-center font-semibold text-sm text-[#232A6B] pb-1" style={{ fontFamily: "'Fraunces', serif" }}>
                          {dia}
                        </h3>
                        {totals.cals > 0 && (
                          <p className="text-center text-[10px] text-[#8A8066] font-mono border-b border-[#E8DCC8] pb-2 mb-3">
                            ~{Math.round(totals.cals)} kcal · {Math.round(totals.protein)}g P
                          </p>
                        )}
                        {totals.cals === 0 && <div className="border-b border-[#E8DCC8] pb-2 mb-3" />}

                        <div className="space-y-3 flex-1">
                          {TIPOS_REFEICAO.map(refeicao => {
                            const item = planoSemanal.find(
                              p => p.dia_semana === dia && p.tipo_refeicao === refeicao
                            );
                            const receitaAssociada = receitas.find(r => r.id === item?.receita_id);

                            return (
                              <div key={refeicao} className="bg-[#FAF1E6] p-2.5 rounded-lg border border-[#E8DCC8] min-h-[70px] flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase text-[#8A8066]">
                                  {refeicao}
                                </span>

                                {item ? (
                                  <div className="mt-1 flex justify-between items-start gap-1">
                                    <span
                                      onClick={() => receitaAssociada && setSelectedReceitaDetails(receitaAssociada)}
                                      className="text-xs font-medium text-[#1A1A2E] line-clamp-2 hover:text-[#232A6B] cursor-pointer"
                                    >
                                      {receitaAssociada?.nome || 'Receita'}
                                    </span>
                                    <button
                                      onClick={() => handleRemoveFromPlan(item.id)}
                                      className="text-[#8A8066] hover:text-red-500 text-xs px-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setModalDia(dia);
                                      setModalRefeicao(refeicao);
                                      setShowPlanModal(true);
                                    }}
                                    className="mt-1 text-xs text-[#8A8066] hover:text-[#232A6B] border border-dashed border-[#E8DCC8] hover:border-[#232A6B]/50 py-1 rounded transition text-center"
                                  >
                                    + Adicionar
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: LISTA DE COMPRAS AGRUPADA */}
            {activeTab === 'compras' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white border border-[#E8DCC8] rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-[#1A1A2E] mb-2" style={{ fontFamily: "'Fraunces', serif" }}>Lista de Compras</h2>
                  <p className="text-xs text-[#8A8066] mb-6">
                    Organizada por categoria de ingrediente. As marcações ficam guardadas neste dispositivo.
                  </p>

                  {shoppingList.length === 0 ? (
                    <p className="text-[#8A8066] text-center py-8 text-sm">
                      Nenhuma refeição planeada no Plano Semanal.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(shoppingListByCategory).map(([categoria, items]) => (
                        <div key={categoria} className="space-y-2">
                          <h3 className="text-xs font-bold text-[#232A6B] uppercase tracking-wider border-b border-[#E8DCC8] pb-1">
                            {categoria}
                          </h3>

                          <div className="space-y-2">
                            {items.map(item => (
                              <div
                                key={item.id}
                                onClick={() => toggleCheckItem(item.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer select-none ${
                                  checkedItems[item.id]
                                    ? 'bg-[#FAF1E6]/60 border-[#E8DCC8] text-[#8A8066] line-through'
                                    : 'bg-white border-[#E8DCC8] text-[#1A1A2E] hover:border-[#232A6B]/40'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={!!checkedItems[item.id]}
                                    onChange={() => {}}
                                    className="rounded border-[#E8DCC8] bg-white text-[#232A6B] focus:ring-[#232A6B] h-4 w-4"
                                  />
                                  <span className="font-medium text-sm">{item.nome}</span>
                                </div>
                                <span className="font-mono text-xs px-2 py-1 rounded bg-[#FAF1E6] border border-[#E8DCC8] text-[#5F5A4E]">
                                  {item.quantidade.toFixed(1).replace('.0', '')} {item.unidade}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: CALCULADORA DE MACROS */}
            {activeTab === 'calculadora' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <h2 className="text-3xl font-semibold text-[#1A1A2E]" style={{ fontFamily: "'Fraunces', serif" }}>Calculadora de Macros</h2>
                  <p className="text-[#5F5A4E] text-sm">
                    Calcula a tua taxa metabólica e descobre a quantidade ideal de calorias, proteínas, hidratos de carbono e gorduras para os teus objetivos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="bg-white border border-[#E8DCC8] rounded-2xl p-6 space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-2">Género</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCalcGenera('feminino')}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                            calcGenera === 'feminino'
                              ? 'bg-[#232A6B]/10 border-[#232A6B] text-[#232A6B]'
                              : 'bg-[#FAF1E6] border-[#E8DCC8] text-[#5F5A4E] hover:border-[#232A6B]/40'
                          }`}
                        >
                          Feminino
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcGenera('masculino')}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                            calcGenera === 'masculino'
                              ? 'bg-[#232A6B]/10 border-[#232A6B] text-[#232A6B]'
                              : 'bg-[#FAF1E6] border-[#E8DCC8] text-[#5F5A4E] hover:border-[#232A6B]/40'
                          }`}
                        >
                          Masculino
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Idade</label>
                        <input
                          type="number"
                          value={calcIdade}
                          onChange={e => setCalcIdade(Number(e.target.value))}
                          className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Altura (cm)</label>
                        <input
                          type="number"
                          value={calcAltura}
                          onChange={e => setCalcAltura(Number(e.target.value))}
                          className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Peso (kg)</label>
                        <input
                          type="number"
                          value={calcPeso}
                          onChange={e => setCalcPeso(Number(e.target.value))}
                          className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Atividade Física</label>
                      <select
                        value={calcAtividade}
                        onChange={e => setCalcAtividade(Number(e.target.value))}
                        className="w-full bg-[#FAF1E6] border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                      >
                        <option value={1.2}>Sedentário (Pouco ou nenhum exercício)</option>
                        <option value={1.375}>Ligeiramente Ativo (1-3 treinos/semana)</option>
                        <option value={1.55}>Moderadamente Ativo (3-5 treinos/semana)</option>
                        <option value={1.725}>Muito Ativo (6-7 treinos intensos/semana)</option>
                        <option value={1.9}>Extremamente Ativo (Trabalho físico / 2x treino por dia)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-2">Objetivo Nutricional</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCalcObjetivo('perda')}
                          className={`py-2 px-1 rounded-xl border text-xs font-medium text-center transition ${
                            calcObjetivo === 'perda'
                              ? 'bg-[#232A6B]/10 border-[#232A6B] text-[#232A6B]'
                              : 'bg-[#FAF1E6] border-[#E8DCC8] text-[#5F5A4E] hover:border-[#232A6B]/40'
                          }`}
                        >
                          Perder Gordura
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcObjetivo('manutencao')}
                          className={`py-2 px-1 rounded-xl border text-xs font-medium text-center transition ${
                            calcObjetivo === 'manutencao'
                              ? 'bg-[#232A6B]/10 border-[#232A6B] text-[#232A6B]'
                              : 'bg-[#FAF1E6] border-[#E8DCC8] text-[#5F5A4E] hover:border-[#232A6B]/40'
                          }`}
                        >
                          Manter Peso
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcObjetivo('ganho')}
                          className={`py-2 px-1 rounded-xl border text-xs font-medium text-center transition ${
                            calcObjetivo === 'ganho'
                              ? 'bg-[#232A6B]/10 border-[#232A6B] text-[#232A6B]'
                              : 'bg-[#FAF1E6] border-[#E8DCC8] text-[#5F5A4E] hover:border-[#232A6B]/40'
                          }`}
                        >
                          Ganhar Massa
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleCalculateMacros}
                      className="w-full bg-[#232A6B] hover:bg-[#2E3789] text-[#FAF1E6] font-semibold py-3.5 rounded-xl transition text-sm"
                    >
                      Calcular os Meus Macros
                    </button>
                  </div>

                  <div className="bg-white border border-[#E8DCC8] rounded-2xl p-6 space-y-6">
                    {!calcResult ? (
                      <div className="text-center py-16 text-[#8A8066] space-y-2">
                        <p className="text-sm">Preenche os dados ao lado e clica em calcular para ver os teus resultados.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="border-b border-[#E8DCC8] pb-4">
                          <span className="text-xs uppercase font-bold text-[#8A8066] tracking-wider">Objetivo Calórico Diário</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-4xl font-semibold text-[#232A6B] font-mono">{calcResult.targetCalories}</span>
                            <span className="text-[#8A8066] text-sm">kcal / dia</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-[#FAF1E6] border border-[#E8DCC8] p-3 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-[#8A8066] uppercase">Proteína</span>
                            <p className="text-xl font-semibold text-[#1A1A2E] font-mono mt-1">{calcResult.proteinGrams}g</p>
                          </div>
                          <div className="bg-[#FAF1E6] border border-[#E8DCC8] p-3 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-[#8A8066] uppercase">Hidratos</span>
                            <p className="text-xl font-semibold text-[#1A1A2E] font-mono mt-1">{calcResult.carbsGrams}g</p>
                          </div>
                          <div className="bg-[#FAF1E6] border border-[#E8DCC8] p-3 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-[#8A8066] uppercase">Gordura</span>
                            <p className="text-xl font-semibold text-[#1A1A2E] font-mono mt-1">{calcResult.fatGrams}g</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL DETALHES DA RECEITA */}
      {selectedReceitaDetails && (
        <div className="fixed inset-0 bg-[#1A1A2E]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF1E6] border border-[#E8DCC8] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <RecipeImage url={selectedReceitaDetails.imagem_url} nome={selectedReceitaDetails.nome} size="modal" />
            <div className="flex justify-between items-start">
              <div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {parseTags(selectedReceitaDetails.categoria).map(t => (
                    <span key={t} className="text-[10px] font-semibold text-[#232A6B] bg-[#232A6B]/10 px-1.5 py-0.5 rounded">
                      {translateTag(t)}
                    </span>
                  ))}
                </div>
                <h2 className="text-2xl font-semibold text-[#1A1A2E] mt-1" style={{ fontFamily: "'Fraunces', serif" }}>{selectedReceitaDetails.nome}</h2>
                {!!selectedReceitaDetails.porcoes && (
                  <p className="text-xs text-[#8A8066] mt-1">Rende {selectedReceitaDetails.porcoes} porç{selectedReceitaDetails.porcoes === 1 ? 'ão' : 'ões'}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => toggleFavorite(selectedReceitaDetails.id, e)}
                  className="text-xl px-2"
                  aria-label="Marcar como favorita"
                >
                  {favoriteIds.includes(selectedReceitaDetails.id) ? '★' : '☆'}
                </button>
                <button
                  onClick={() => setSelectedReceitaDetails(null)}
                  className="text-[#8A8066] hover:text-[#1A1A2E] text-lg font-bold p-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {selectedReceitaDetails.descricao && (
              <p className="text-sm text-[#5F5A4E]">{selectedReceitaDetails.descricao}</p>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#232A6B] uppercase tracking-wider">Macros por porção</h3>
              <MacroBadges
                cals={selectedReceitaDetails.calorias_por_porcao}
                protein={selectedReceitaDetails.proteina_por_porcao_g}
                fat={selectedReceitaDetails.gordura_por_porcao_g}
                carbs={selectedReceitaDetails.carboidratos_por_porcao_g}
              />
            </div>

            <div className="space-y-3 border-t border-[#E8DCC8] pt-4">
              <h3 className="text-sm font-bold text-[#232A6B] uppercase tracking-wider">Ingredientes</h3>
              <ul className="space-y-2">
                {selectedReceitaDetails.receita_ingredientes?.map((ri, i) => (
                  <li key={i} className="flex justify-between text-sm bg-white p-2.5 rounded-lg border border-[#E8DCC8]">
                    <span className="text-[#1A1A2E] font-medium">{ri.ingredientes?.nome || 'Ingrediente'}</span>
                    <span className="font-mono text-[#8A8066]">{ri.quantidade} {ri.unidade}</span>
                  </li>
                ))}
              </ul>
            </div>

            {selectedReceitaDetails.instrucoes && (
              <div className="space-y-2 border-t border-[#E8DCC8] pt-4">
                <h3 className="text-sm font-bold text-[#232A6B] uppercase tracking-wider">Instruções</h3>
                <p className="text-sm text-[#5F5A4E] whitespace-pre-line leading-relaxed">{selectedReceitaDetails.instrucoes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CRIAR RECEITA */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-[#1A1A2E]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF1E6] border border-[#E8DCC8] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-[#1A1A2E]" style={{ fontFamily: "'Fraunces', serif" }}>Criar Nova Receita</h2>
              <button onClick={() => setShowRecipeModal(false)} className="text-[#8A8066] hover:text-[#1A1A2E]">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Nome da Receita</label>
                <input
                  type="text"
                  value={novaReceita.nome}
                  onChange={e => setNovaReceita({ ...novaReceita, nome: e.target.value })}
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">URL da Imagem (opcional)</label>
                <input
                  type="text"
                  value={novaReceita.imagem_url}
                  onChange={e => setNovaReceita({ ...novaReceita, imagem_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-2">Categorias (pode escolher várias)</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map(tag => {
                    const isSelected = novaReceita.tags.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleNovaReceitaTag(tag.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          isSelected
                            ? 'bg-[#232A6B] text-[#FAF1E6] border border-[#232A6B]'
                            : 'bg-white text-[#5F5A4E] border border-[#E8DCC8] hover:border-[#232A6B]/40'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Tempo de Preparação (min)</label>
                <input
                  type="number"
                  value={novaReceita.tempo_preparacao_min}
                  onChange={e => setNovaReceita({ ...novaReceita, tempo_preparacao_min: Number(e.target.value) })}
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  value={novaReceita.descricao}
                  onChange={e => setNovaReceita({ ...novaReceita, descricao: e.target.value })}
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Instruções</label>
                <textarea
                  value={novaReceita.instrucoes}
                  onChange={e => setNovaReceita({ ...novaReceita, instrucoes: e.target.value })}
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] h-28 resize-none"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-[#232A6B] uppercase tracking-wider">Ingredientes</label>
                <datalist id="ingredientes-datalist">
                  {ingredientes.map(ing => <option key={ing.id} value={ing.nome} />)}
                </datalist>
                {novaReceita.ingredientes.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      list="ingredientes-datalist"
                      placeholder="Pesquisar ingrediente..."
                      value={item.buscaIngrediente}
                      onChange={e => {
                        const val = e.target.value;
                        const match = ingredientes.find(i => i.nome.toLowerCase() === val.toLowerCase());
                        const newIngs = [...novaReceita.ingredientes];
                        newIngs[idx] = { ...newIngs[idx], buscaIngrediente: val, ingrediente_id: match ? match.id : '' };
                        setNovaReceita({ ...novaReceita, ingredientes: newIngs });
                      }}
                      className={`flex-1 bg-white border rounded-xl p-2.5 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] ${
                        item.buscaIngrediente && !item.ingrediente_id ? 'border-red-300' : 'border-[#E8DCC8]'
                      }`}
                    />

                    <input
                      type="number"
                      placeholder="Qtd"
                      value={item.quantidade}
                      onChange={e => {
                        const newIngs = [...novaReceita.ingredientes];
                        newIngs[idx].quantidade = Number(e.target.value);
                        setNovaReceita({ ...novaReceita, ingredientes: newIngs });
                      }}
                      className="w-20 bg-white border border-[#E8DCC8] rounded-xl p-2.5 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] font-mono"
                    />

                    <select
                      value={item.unidade}
                      onChange={e => {
                        const newIngs = [...novaReceita.ingredientes];
                        newIngs[idx].unidade = e.target.value;
                        setNovaReceita({ ...novaReceita, ingredientes: newIngs });
                      }}
                      className="w-24 bg-white border border-[#E8DCC8] rounded-xl p-2.5 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B]"
                    >
                      {UNIDADES_MEDIDA.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const newIngs = novaReceita.ingredientes.filter((_, i) => i !== idx);
                        setNovaReceita({ ...novaReceita, ingredientes: newIngs });
                      }}
                      className="text-[#8A8066] hover:text-red-500 p-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setNovaReceita({
                    ...novaReceita,
                    ingredientes: [...novaReceita.ingredientes, { ingrediente_id: '', buscaIngrediente: '', quantidade: 1, unidade: 'g' }]
                  })}
                  className="text-xs text-[#232A6B] hover:underline font-medium pt-1"
                >
                  + Adicionar outro ingrediente
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DCC8]">
              <button
                onClick={() => setShowRecipeModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#5F5A4E] hover:bg-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRecipe}
                className="px-5 py-2 bg-[#232A6B] hover:bg-[#2E3789] text-[#FAF1E6] rounded-xl text-sm font-medium transition"
              >
                Guardar Receita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR AO PLANO */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-[#1A1A2E]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF1E6] border border-[#E8DCC8] rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-[#1A1A2E]" style={{ fontFamily: "'Fraunces', serif" }}>Adicionar ao Plano Semanal</h2>
              <button onClick={() => { setShowPlanModal(false); setSelectedReceitaForPlan(''); setPlanRecipeSearch(''); }} className="text-[#8A8066] hover:text-[#1A1A2E]">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Dia: {modalDia} | Refeição: {modalRefeicao}</label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A8066] uppercase tracking-wider mb-1">Selecionar Receita</label>
                <input
                  type="text"
                  autoFocus
                  value={planRecipeSearch}
                  onChange={e => { setPlanRecipeSearch(e.target.value); setSelectedReceitaForPlan(''); }}
                  placeholder="Pesquisar por nome..."
                  className="w-full bg-white border border-[#E8DCC8] rounded-xl p-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#232A6B] mb-2"
                />

                <div className="max-h-56 overflow-y-auto border border-[#E8DCC8] rounded-xl divide-y divide-[#E8DCC8] bg-white">
                  {receitas
                    .filter(rec => rec.nome.toLowerCase().includes(planRecipeSearch.trim().toLowerCase()))
                    .slice(0, 50)
                    .map(rec => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => { setSelectedReceitaForPlan(rec.id); setPlanRecipeSearch(rec.nome); }}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition ${
                          selectedReceitaForPlan === rec.id
                            ? 'bg-[#232A6B]/10 text-[#232A6B] font-medium'
                            : 'text-[#1A1A2E] hover:bg-[#FAF1E6]'
                        }`}
                      >
                        <span className="line-clamp-1">{rec.nome}</span>
                        {!!rec.calorias_por_porcao && (
                          <span className="text-[11px] text-[#8A8066] font-mono shrink-0">{Math.round(rec.calorias_por_porcao)} kcal</span>
                        )}
                      </button>
                    ))}
                  {receitas.filter(rec => rec.nome.toLowerCase().includes(planRecipeSearch.trim().toLowerCase())).length === 0 && (
                    <p className="text-center text-xs text-[#8A8066] py-4">Nenhuma receita encontrada.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DCC8]">
              <button
                onClick={() => { setShowPlanModal(false); setSelectedReceitaForPlan(''); setPlanRecipeSearch(''); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#5F5A4E] hover:bg-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMealToPlan}
                disabled={!selectedReceitaForPlan}
                className="px-5 py-2 bg-[#232A6B] hover:bg-[#2E3789] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAF1E6] rounded-xl text-sm font-medium transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
