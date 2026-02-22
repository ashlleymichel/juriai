import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Scale, AlertCircle, Loader2, 
  Building2, Users, Calendar, Gavel, FileSearch, 
  Coins, BookOpen, ChevronRight, RefreshCw, CheckCircle2, IdCard, Briefcase,
  Mail, Lock, LogIn, UserPlus, LogOut, Folder, FolderOpen, Plus, Clock, Menu, X,
  Plane, Ticket, MapPin, Copy, Trash2, Edit2, Download
} from 'lucide-react';

// --- CONFIGURAÇÃO DA API ---
// O ambiente de execução injetará a chave automaticamente se deixarmos como string vazia
const apiKey = "";

const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 403) throw new Error("Erro 403: Acesso Negado.");
        throw new Error(`Erro na API: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const MOCK_CASES = [
  {
    id: '1',
    folder: `Análises (${new Date().toLocaleDateString('pt-PT')})`,
    date: new Date().toLocaleDateString('pt-PT'),
    title: 'Exemplo: Ação de Indenização',
    result: {
      tipoProcesso: 'Danos Morais',
      numeroProcesso: '1002345-12.2023.8.26.0100',
      varaComarcaForo: '2ª Vara Cível - SP',
      dataDistribuicao: '20/05/2023',
      dataOcorrencia: '15/05/2023',
      autorOuRequerente: 'João da Silva',
      cpfCnpjAutor: '111.222.333-44',
      reuOuRequerido: 'Companhia Aérea X',
      cpfCnpjReu: '12.345.678/0001-90',
      valorCausa: 'R$ 10.000,00',
      numeroVoo: 'AD1234',
      pnr: 'KLS890',
      iataOrigem: 'LIS',
      iataIncidente: 'LIS',
      iataDestino: 'GRU',
      dataAudiencia: '10/10/2023',
      horarioAudiencia: '14:00',
      statusAudiencia: 'Agendada',
      resumoFatos: 'O passageiro sofreu um atraso de 12 horas no aeroporto de Lisboa...',
      pedidosOuDecisao: ['Danos morais', 'Reembolso de despesas']
    }
  }
];

export default function App() {
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [cases, setCases] = useState(MOCK_CASES);
  const [activeCaseId, setActiveCaseId] = useState(null); 
  const [activeFolderView, setActiveFolderView] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  
  const [actionModal, setActionModal] = useState(null);

  const activeCase = cases.find(c => c.id === activeCaseId);
  const analysisResult = activeCase ? activeCase.result : null;

  useEffect(() => {
    // Splash screen de 2 segundos
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 2000);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setPdfjsLoaded(true);
      }
    };
    document.body.appendChild(script);

    return () => clearTimeout(timer);
  }, []);

  const resetToNewAnalysis = () => {
    setActiveCaseId(null);
    setActiveFolderView(null);
    setShowSuccess(false);
    setError(null);
  };

  const processDocument = async (fileObj) => {
    setIsProcessing(true);
    setShowSuccess(false);
    setError(null);

    try {
      setProgressText("Extraindo dados jurídicos...");
      const arrayBuffer = await fileObj.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images = [];

      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        images.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
      }

      setProgressText("A IA está a organizar os dados...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      const prompt = `
        Atue como um especialista jurídico. Analise detalhadamente este processo judicial (focando na petição inicial, cartões de embarque e bilhetes aéreos) e extraia os dados com extrema precisão.
        
        ATENÇÃO ESPECIAL AOS DADOS DE VOO E RESERVA:
        - numeroVoo: Procure por siglas de companhias seguidas de números (ex: AD8733, G3 1500, LA 3300, TP 088).
        - pnr: Código localizador da reserva (exatamente 6 caracteres alfanuméricos, ex: X7BC9A).
        - iataOrigem: Código IATA de 3 letras do aeroporto de partida original (ex: GRU, LIS, VCP, CGH).
        - iataDestino: Código IATA de 3 letras do aeroporto de destino final.
        - iataIncidente: Código IATA do aeroporto onde ocorreu a falha (atraso, cancelamento, perda de conexão ou extravio de bagagem). Se o voo atrasou ou foi cancelado na origem, use o código da Origem. Se a bagagem não chegou no fim, use o código do Destino. Se o problema foi na conexão, indique o aeroporto de conexão.

        DEMAIS DADOS A EXTRAIR:
        - tipoProcesso, numeroProcesso, varaComarcaForo, dataDistribuicao, dataOcorrencia.
        - autorOuRequerente (Nome), cpfCnpjAutor.
        - reuOuRequerido (Nome da companhia aérea ou empresa), cpfCnpjReu.
        - valorCausa (Exato como consta no pedido).
        - dataAudiencia, horarioAudiencia, statusAudiencia.
        - resumoFatos (Resuma de forma técnica e direta o motivo principal da ação, incluindo tempos de atraso se aplicável).
        - pedidosOuDecisao.
        
        REGRA RÍGIDA: Formato de datas sempre em numérico DD/MM/AAAA. Devolva apenas e estritamente um JSON válido.
      `;

      const payload = {
        contents: [{ parts: [ { text: prompt }, ...images ] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              tipoProcesso: { type: "STRING" },
              numeroProcesso: { type: "STRING" },
              varaComarcaForo: { type: "STRING" },
              dataDistribuicao: { type: "STRING" },
              dataOcorrencia: { type: "STRING" },
              autorOuRequerente: { type: "STRING" },
              cpfCnpjAutor: { type: "STRING" },
              reuOuRequerido: { type: "STRING" },
              cpfCnpjReu: { type: "STRING" },
              valorCausa: { type: "STRING" },
              numeroVoo: { type: "STRING" },
              pnr: { type: "STRING" },
              iataOrigem: { type: "STRING" },
              iataIncidente: { type: "STRING" },
              iataDestino: { type: "STRING" },
              dataAudiencia: { type: "STRING" },
              horarioAudiencia: { type: "STRING" },
              statusAudiencia: { type: "STRING" },
              resumoFatos: { type: "STRING" },
              pedidosOuDecisao: { type: "ARRAY", items: { type: "STRING" } }
            }
          }
        }
      };

      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!data.candidates || data.candidates.length === 0) throw new Error("Sem resposta.");
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      
      const currentDate = new Date().toLocaleDateString('pt-PT');
      const folderName = `Análises (${currentDate})`;

      const newCase = {
        id: Date.now().toString(),
        folder: folderName,
        date: currentDate,
        title: result.numeroProcesso || fileObj.name,
        result: result
      };

      setIsProcessing(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setCases(prev => [newCase, ...prev]);
        setActiveCaseId(newCase.id);
        setActiveFolderView(null);
        setExpandedFolders(prev => ({ ...prev, [folderName]: true }));
        setShowSuccess(false);
      }, 1500);

    } catch (err) {
      setError("Falha na análise. Tente novamente.");
      setIsProcessing(false);
      console.error(err);
    }
  };

  const groupedCases = cases.reduce((acc, curr) => {
    if (!acc[curr.folder]) acc[curr.folder] = [];
    acc[curr.folder].push(curr);
    return acc;
  }, {});

  const handleDownload = (caseObj, e) => {
    e.stopPropagation();
    const { result } = caseObj;
    let text = `RELATÓRIO JuriAI\nProcesso: ${result.numeroProcesso}\nResumo: ${result.resumoFatos}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_${caseObj.title}.txt`;
    link.click();
  };

  if (isSplashActive) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-row items-center gap-4 md:gap-6 animate-pulse">
          <Scale className="text-blue-400 w-16 h-16 md:w-24 md:h-24" />
          <h1 className="text-4xl md:text-7xl font-normal text-white tracking-tight">
            JuriAI
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans text-black animate-in fade-in duration-1000">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center gap-3">
          <Scale className="text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">JuriAI</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
           <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
           Sistema Ativo
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col p-4 overflow-y-auto border-r border-slate-700">
          <button onClick={resetToNewAnalysis} className="w-full bg-blue-600 text-white p-2.5 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95">
            <Plus size={18} /> Nova Análise
          </button>
          <div className="space-y-2">
            {Object.keys(groupedCases).map(folder => (
              <div key={folder}>
                <button 
                  onClick={() => {
                    setActiveFolderView(folder);
                    setActiveCaseId(null);
                    setExpandedFolders(p => ({...p, [folder]: !p[folder]}));
                  }}
                  className={`flex items-center gap-2 text-sm font-semibold mb-2 transition-colors w-full text-left p-2 rounded-lg ${activeFolderView === folder ? 'bg-slate-700 text-white shadow-sm' : 'hover:text-white'}`}
                >
                  {expandedFolders[folder] ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />}
                  {folder}
                </button>
                {expandedFolders[folder] && (
                  <div className="ml-4 space-y-1">
                    {groupedCases[folder].map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => { setActiveCaseId(c.id); setActiveFolderView(null); }} 
                        className={`text-xs block w-full text-left p-2 rounded-lg transition-colors ${activeCaseId === c.id ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-700/50'}`}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          {isProcessing ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
              <div className="relative flex items-center justify-center mb-8">
                <div className="w-28 h-28 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute"></div>
                <div className="bg-blue-50 p-6 rounded-full animate-pulse flex items-center justify-center relative z-10 shadow-sm">
                  <FileText className="text-blue-600 w-10 h-10" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-black mb-2 tracking-tight">Estamos analisando seu processo</h3>
              <p className="text-slate-500 font-medium animate-pulse">{progressText}</p>
            </div>
          ) : showSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
              <div className="bg-green-100 p-8 rounded-full mb-6">
                <CheckCircle2 size={80} className="text-green-600" />
              </div>
              <h3 className="text-3xl font-bold text-black tracking-tighter">Análise Concluída!</h3>
              <p className="text-slate-500 mt-2 font-medium">Carregando relatório detalhado...</p>
            </div>
          ) : activeCaseId && analysisResult ? (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-2xl font-bold text-black tracking-tight">{activeCase.title}</h2>
                  <p className="text-slate-500 text-sm">Organizado em {activeCase.date}</p>
                </div>
                <button onClick={(e) => handleDownload(activeCase, e)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-colors shadow-sm">
                  <Download size={20} />
                </button>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm group">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-black">Resumo dos Fatos</h3>
                  <CopyButton text={analysisResult.resumoFatos} />
                </div>
                <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{analysisResult.resumoFatos}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-600 tracking-tight border-b pb-2"><Plane size={18} /> Reserva de Voo</h3>
                  <div className="space-y-3">
                    <DataItem label="Voo" value={analysisResult.numeroVoo} />
                    <DataItem label="PNR" value={analysisResult.pnr} />
                    <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-slate-50">
                      <div className="text-center"><p className="text-[10px] font-bold text-slate-400">PARTIDA</p><p className="font-bold text-sm text-black">{analysisResult.iataOrigem}</p></div>
                      <div className="text-center text-red-600 font-bold"><p className="text-[10px] font-bold text-slate-400">INCIDENTE</p><p className="text-sm">{analysisResult.iataIncidente}</p></div>
                      <div className="text-center"><p className="text-[10px] font-bold text-slate-400">DESTINO</p><p className="font-bold text-sm text-black">{analysisResult.iataDestino}</p></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-600 tracking-tight border-b pb-2"><Calendar size={18} /> Dados da Audiência</h3>
                  <div className="space-y-3">
                    <DataItem label="Data" value={analysisResult.dataAudiencia} />
                    <DataItem label="Horário" value={analysisResult.horarioAudiencia} />
                    <div className="p-3 bg-slate-50 rounded-xl text-xs border border-slate-100 mt-2">
                      <p className="font-bold text-slate-400 uppercase text-[9px] mb-1">Status Observado</p>
                      <span className="text-slate-700 font-semibold">{analysisResult.statusAudiencia}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold mb-4 text-black border-b pb-2 tracking-tight">Partes Envolvidas</h3>
                  <div className="space-y-5">
                    <div className="group flex justify-between items-start">
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase">Autor</p><p className="text-sm font-semibold text-black">{analysisResult.autorOuRequerente}</p></div>
                      <CopyButton text={analysisResult.autorOuRequerente} />
                    </div>
                    <div className="group flex justify-between items-start border-t border-slate-50 pt-4">
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase">Réu</p><p className="text-sm font-semibold text-black">{analysisResult.reuOuRequerido}</p></div>
                      <CopyButton text={analysisResult.reuOuRequerido} />
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold mb-4 text-black border-b pb-2 tracking-tight">Informações Processuais</h3>
                  <div className="space-y-4">
                    <DataItem label="Nº do Processo" value={analysisResult.numeroProcesso} />
                    <DataItem label="Valor Causa" value={analysisResult.valorCausa} />
                    <DataItem label="Distribuição" value={analysisResult.dataDistribuicao} />
                  </div>
                </div>
              </div>
            </div>
          ) : activeFolderView ? (
             <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
                <h2 className="text-2xl font-bold text-black flex items-center gap-2 tracking-tight">
                  <FolderOpen className="text-blue-500" /> {activeFolderView}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedCases[activeFolderView]?.map(c => (
                    <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
                       <div onClick={() => setActiveCaseId(c.id)} className="cursor-pointer flex-1">
                          <p className="font-bold text-black truncate pr-2">{c.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{c.date}</p>
                       </div>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => handleDownload(c, e)} className="p-2 text-slate-400 hover:text-blue-600"><Download size={16} /></button>
                          <button onClick={() => setActionModal({ type: 'delete', case: c })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div 
                className="p-16 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white max-w-lg w-full cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group shadow-sm" 
                onClick={() => fileInputRef.current.click()}
              >
                <div className="bg-slate-50 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-50 transition-colors">
                  <Upload size={40} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="font-bold text-slate-800 text-lg">Clique para analisar o processo</p>
                <p className="text-slate-400 text-sm mt-2 font-medium">Arraste um PDF jurídico para extração inteligente</p>
                {error && <p className="text-red-500 mt-6 p-3 bg-red-50 rounded-xl border border-red-100 text-sm font-bold animate-pulse">{error}</p>}
                <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={(e) => e.target.files[0] && processDocument(e.target.files[0])} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL APAGAR */}
      {actionModal?.type === 'delete' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
           <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <h3 className="font-bold text-xl mb-2 text-black">Apagar Análise?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">Tem a certeza que deseja remover este registo? Esta ação não pode ser desfeita.</p>
              <div className="flex flex-col gap-2">
                 <button onClick={() => { setCases(prev => prev.filter(x => x.id !== actionModal.case.id)); setActionModal(null); }} className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold shadow-lg shadow-red-200">Sim, apagar</button>
                 <button onClick={() => setActionModal(null)} className="w-full py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-semibold">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
}

function DataItem({ label, value }) {
  const displayValue = (val) => {
    if (val === null || val === undefined || val === "" || val === "Não identificado") return "---";
    return String(val);
  };
  const formattedVal = displayValue(value);
  return (
    <div className="flex justify-between items-center group min-h-[36px]">
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold \${formattedVal === '---' ? 'text-slate-300 italic font-normal' : 'text-black'}`}>{formattedVal}</span>
        <CopyButton text={formattedVal} />
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text || text === "---") return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!text || text === "---") return null;
  return (
    <button onClick={handleCopy} className={`p-1.5 rounded-lg transition-all \${copied ? 'text-green-600 bg-green-50' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100'}`}>
      {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
    </button>
  );
}