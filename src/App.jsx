import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Scale, AlertCircle, Loader2, 
  Building2, Users, Calendar, Gavel, FileSearch, 
  Coins, BookOpen, ChevronRight, RefreshCw, CheckCircle2, IdCard, Briefcase,
  Mail, Lock, LogIn, UserPlus, LogOut, Folder, FolderOpen, Plus, Clock, Menu, X,
  Plane, Ticket, MapPin, Copy, Trash2, Edit2, Download
} from 'lucide-react';

// --- CONFIGURAÇÃO DA API ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// --- DADOS DE EXEMPLO (MOCK) ---
const MOCK_CASES = [
  {
    id: '1',
    folder: `Análises (${new Date().toLocaleDateString('pt-PT')})`,
    date: new Date().toLocaleDateString('pt-PT'),
    title: 'Ação de Indenização (Silva vs. Tech SA)',
    result: {
      tipoProcesso: 'Ação de Indenização por Danos Morais',
      numeroProcesso: '1002345-12.2023.8.26.0100',
      varaComarcaForo: '2ª Vara Cível do Foro Central de São Paulo',
      dataDistribuicao: '20/05/2023',
      dataOcorrencia: '15/05/2023',
      autorOuRequerente: 'João da Silva',
      cpfCnpjAutor: '111.222.333-44',
      advogadoAutor: 'Dra. Maria Oliveira',
      oabAutor: 'SP 123456',
      reuOuRequerido: 'Tech Inovações S/A',
      cpfCnpjReu: '12.345.678/0001-90',
      advogadoReu: 'Dr. Carlos Mendes',
      oabReu: 'SP 654321',
      valorCausa: 'R$ 50.000,00',
      numeroVoo: 'LA3302',
      pnr: 'XYZ123',
      iataOrigem: 'GRU',
      iataIncidente: 'BSB',
      iataDestino: 'FOR',
      dataAudiencia: '25/08/2023',
      horarioAudiencia: '14:30',
      statusAudiencia: 'Adiada para 10/09/2023 devido a readequação de pauta',
      resumoFatos: 'O autor alega ter adquirido um equipamento eletrónico que apresentou defeitos após 2 dias de uso. A empresa ré recusou-se a efetuar a troca ou devolução do valor pago sob o argumento de mau uso.\n\nO autor requer a devolução do valor pago em dobro, bem como indenização pelos constrangimentos sofridos.',
      pedidosOuDecisao: ['Devolução do valor pago (R$ 5.000,00)', 'Indenização por danos morais (R$ 45.000,00)', 'Inversão do ónus da prova']
    }
  }
];

export default function App() {
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // --- ESTADO DO DASHBOARD ---
  const [cases, setCases] = useState(MOCK_CASES);
  const [activeCaseId, setActiveCaseId] = useState(null); 
  const [activeFolderView, setActiveFolderView] = useState(null); // Pasta atualmente aberta na grelha principal
  const [expandedFolders, setExpandedFolders] = useState({ [`Análises (${new Date().toLocaleDateString('pt-PT')})`]: true });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  
  // Modais de Edição e Apagar
  const [actionModal, setActionModal] = useState(null); // { type: 'rename' | 'delete', case: object }
  const [renameInput, setRenameInput] = useState("");

  const activeCase = cases.find(c => c.id === activeCaseId);
  const analysisResult = activeCase ? activeCase.result : null;

  // --- ESTADO DE AUTENTICAÇÃO ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) return setAuthError('Por favor, preencha todos os campos.');
    if (password.length < 6) return setAuthError('A senha deve ter pelo menos 6 caracteres.');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    resetToNewAnalysis();
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfjsLoaded(true);
    };
    document.body.appendChild(script);
  }, []);

  const resetToNewAnalysis = () => {
    setActiveCaseId(null);
    setActiveFolderView(null);
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsSidebarOpen(false);
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
      await processDocument(selectedFile);
    } else {
      setError("Por favor, selecione um ficheiro PDF válido.");
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setError(null);
      await processDocument(droppedFile);
    } else {
      setError("Por favor, arraste e solte um ficheiro PDF válido.");
    }
  };

  const extractPagesFromPDF = async (fileObj) => {
    try {
      const arrayBuffer = await fileObj.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const maxPages = Math.min(pdf.numPages, 15); 
      const images = [];

      for (let i = 1; i <= maxPages; i++) {
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
      return { images, numPages: pdf.numPages, extractedPages: maxPages };
    } catch (err) {
      console.error(err);
      throw new Error("Não foi possível processar o PDF. O ficheiro pode estar corrompido ou protegido.");
    }
  };

  const analyzeWithAI = async (images) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const prompt = `
      És um assistente jurídico especializado em analisar documentos dos tribunais.
      Analise visualmente e textualmente estas páginas e extraia as informações essenciais.
      Presta extrema atenção aos anexos (imagens) para encontrar o PNR, número do voo e aeroportos.
      Caso o incidente (ex: cancelamento, atraso, extravio) tenha ocorrido no aeroporto de origem ou de destino, preencha o campo 'iataIncidente' com esse mesmo código IATA.
      Extraia também a data e o horário de qualquer audiência mencionada, e indique no status se ela foi agendada, cancelada ou adiada (incluindo a nova data, se houver).
      As datas devem ser obrigatoriamente extraídas no formato numérico DD/MM/AAAA (ex: 15/05/2023), nunca por extenso.
      Se não encontrares alguma informação, usa "Não identificado" ou deixa o array vazio.
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
            dataDistribuicao: { type: "STRING", description: "Formato numérico estrito DD/MM/AAAA (ex: 20/05/2023)" },
            dataOcorrencia: { type: "STRING", description: "Formato numérico estrito DD/MM/AAAA (ex: 15/05/2023)" },
            autorOuRequerente: { type: "STRING" },
            cpfCnpjAutor: { type: "STRING" },
            advogadoAutor: { type: "STRING" },
            oabAutor: { type: "STRING" },
            reuOuRequerido: { type: "STRING" },
            cpfCnpjReu: { type: "STRING" },
            advogadoReu: { type: "STRING" },
            oabReu: { type: "STRING" },
            valorCausa: { type: "STRING" },
            numeroVoo: { type: "STRING" },
            pnr: { type: "STRING" },
            iataOrigem: { type: "STRING" },
            iataIncidente: { type: "STRING" },
            iataDestino: { type: "STRING" },
            dataAudiencia: { type: "STRING", description: "Data da audiência no formato numérico estrito DD/MM/AAAA" },
            horarioAudiencia: { type: "STRING", description: "Horário da audiência (ex: 14:30)" },
            statusAudiencia: { type: "STRING", description: "Status da audiência (ex: Agendada, Cancelada, Adiada para DD/MM/AAAA)" },
            resumoFatos: { type: "STRING" },
            pedidosOuDecisao: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["tipoProcesso", "numeroProcesso", "varaComarcaForo", "resumoFatos"]
        }
      }
    };

    const data = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("A IA não retornou um resultado válido.");
    return JSON.parse(responseText);
  };

  const processDocument = async (fileObj) => {
    setIsProcessing(true);
    setError(null);
    setActiveCaseId(null);
    setActiveFolderView(null);

    try {
      setProgressText("A processar páginas e a converter anexos para análise visual...");
      const { images, numPages, extractedPages } = await extractPagesFromPDF(fileObj);
      if (images.length === 0) throw new Error("O PDF parece estar vazio ou não pôde ser lido.");

      setProgressText(`A analisar imagens, prints e textos com IA (${extractedPages} de ${numPages} páginas)...`);
      const result = await analyzeWithAI(images);
      
      const currentDate = new Date().toLocaleDateString('pt-PT');
      const folderName = `Análises (${currentDate})`;

      const newCase = {
        id: Date.now().toString(),
        folder: folderName,
        date: currentDate,
        title: result.numeroProcesso && result.numeroProcesso !== "Não identificado" 
               ? `Proc. ${result.numeroProcesso}` 
               : (fileObj.name.replace('.pdf', '')),
        result: result
      };

      setCases(prev => [newCase, ...prev]);
      setActiveCaseId(newCase.id);
      setExpandedFolders(prev => ({ ...prev, [folderName]: true })); 

    } catch (err) {
      setError(err.message || "Ocorreu um erro durante o processamento.");
    } finally {
      setIsProcessing(false);
      setProgressText("");
    }
  };

  const openFolder = (folderName) => {
    setActiveFolderView(folderName);
    setActiveCaseId(null);
    setExpandedFolders(prev => ({ ...prev, [folderName]: true }));
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const toggleFolderExpansion = (folderName, e) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  // --- ACÇÕES DOS CARTÕES (EDITAR, APAGAR, BAIXAR) ---
  const handleDownload = (caseObj, e) => {
    e.stopPropagation();
    const { result } = caseObj;
    let text = `========================================\n`;
    text += ` RELATÓRIO DE ANÁLISE JURÍDICA - JuriAI \n`;
    text += `========================================\n\n`;
    text += `Título: ${caseObj.title}\nData da Análise: ${caseObj.date}\n\n`;

    const append = (label, val) => { if (val && val !== "Não identificado") text += `${label}: ${val}\n`; };

    append("Tipo de Processo", result.tipoProcesso);
    append("Nº do Processo", result.numeroProcesso);
    append("Vara/Comarca/Foro", result.varaComarcaForo);
    append("Data Distribuição", result.dataDistribuicao);
    append("Data Ocorrência", result.dataOcorrencia);
    append("Valor da Causa", result.valorCausa);
    
    text += `\n--- PARTES ENVOLVIDAS ---\n`;
    append("Autor/Requerente", result.autorOuRequerente);
    append("CPF/CNPJ Autor", result.cpfCnpjAutor);
    append("Advogado Autor", result.advogadoAutor + (result.oabAutor && result.oabAutor !== 'Não identificado' ? ` (OAB: ${result.oabAutor})` : ''));
    text += `\n`;
    append("Réu/Requerido", result.reuOuRequerido);
    append("CPF/CNPJ Réu", result.cpfCnpjReu);
    append("Advogado Réu", result.advogadoReu + (result.oabReu && result.oabReu !== 'Não identificado' ? ` (OAB: ${result.oabReu})` : ''));
    
    if((result.numeroVoo && result.numeroVoo !== "Não identificado") || (result.pnr && result.pnr !== "Não identificado")) {
       text += `\n--- DADOS DA RESERVA DE VOO ---\n`;
       append("Voo", result.numeroVoo);
       append("Localizador (PNR)", result.pnr);
       append("Origem", result.iataOrigem);
       append("Incidente", result.iataIncidente);
       append("Destino", result.iataDestino);
    }

    if(result.dataAudiencia && result.dataAudiencia !== "Não identificado") {
       text += `\n--- DADOS DA AUDIÊNCIA ---\n`;
       append("Data", result.dataAudiencia);
       append("Horário", result.horarioAudiencia);
       append("Status", result.statusAudiencia);
    }

    text += `\n--- RESUMO DOS FATOS ---\n${result.resumoFatos || 'N/A'}\n`;
    
    if(result.pedidosOuDecisao && result.pedidosOuDecisao.length > 0) {
      text += `\n--- PEDIDOS / DECISÕES ---\n`;
      result.pedidosOuDecisao.forEach(p => text += `- ${p}\n`);
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analise_${caseObj.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = () => {
    if (actionModal?.type === 'delete') {
      setCases(prev => prev.filter(c => c.id !== actionModal.case.id));
      if (activeCaseId === actionModal.case.id) setActiveCaseId(null);
      setActionModal(null);
    }
  };

  const confirmRename = () => {
    if (actionModal?.type === 'rename' && renameInput.trim() !== '') {
      setCases(prev => prev.map(c => c.id === actionModal.case.id ? { ...c, title: renameInput } : c));
      setActionModal(null);
    }
  };

  const groupedCases = cases.reduce((acc, curr) => {
    if (!acc[curr.folder]) acc[curr.folder] = [];
    acc[curr.folder].push(curr);
    return acc;
  }, {});


  // --- ECRÃ DE LOGIN / REGISTO ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-slate-900 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">
              <Scale className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">JuriAI</h1>
            <p className="text-slate-400 text-sm mt-1">
              {authMode === 'login' ? 'Entre na sua conta para continuar' : 'Crie uma conta para começar'}
            </p>
          </div>
          
          <div className="p-8">
            {authError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{authError}</p>
              </div>
            )}
            
            <form onSubmit={handleAuthSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 transition-shadow outline-none"
                    placeholder="advogado@exemplo.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 transition-shadow outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
              >
                {authMode === 'login' ? (
                  <><LogIn className="w-5 h-5" /> Entrar no JuriAI</>
                ) : (
                  <><UserPlus className="w-5 h-5" /> Criar Conta</>
                )}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {authMode === 'login' ? 'Ainda não tem conta? Registe-se' : 'Já tem uma conta? Entre aqui'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRÃ PRINCIPAL (DASHBOARD) ---
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      
      {/* Modais de Ação */}
      {actionModal?.type === 'delete' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Apagar Análise
            </h3>
            <p className="text-slate-600 mb-6 text-sm">Tem a certeza que deseja apagar o processo <span className="font-semibold text-slate-800">"{actionModal.case.title}"</span>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Apagar</button>
            </div>
          </div>
        </div>
      )}

      {actionModal?.type === 'rename' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-500" /> Renomear Processo
            </h3>
            <input 
              autoFocus
              value={renameInput} 
              onChange={e => setRenameInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && confirmRename()}
              className="w-full border border-slate-300 rounded-lg p-2.5 mb-6 outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" 
              placeholder="Ex: Proc. 123456"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={confirmRename} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header Fixo */}
      <header className="bg-slate-900 text-white p-4 shadow-md z-20 flex-shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden text-slate-300 hover:text-white">
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Scale className="w-7 h-7 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">JuriAI</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-slate-400 text-sm font-medium hidden sm:block">
            Dashboard Processual
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      {/* Corpo (Sidebar + Main Content) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Overlay para Mobile */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-10 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Menu Lateral (Sidebar) */}
        <aside className={`
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          absolute lg:relative w-72 h-full bg-slate-800 text-slate-300 flex flex-col z-10 transition-transform duration-300 ease-in-out flex-shrink-0
        `}>
          <div className="p-4 border-b border-slate-700">
            <button 
              onClick={resetToNewAnalysis}
              className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg transition-colors ${
                !activeCaseId && !activeFolderView && !isProcessing ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
              }`}
            >
              <Plus className="w-5 h-5" /> Nova Análise
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {Object.keys(groupedCases).length === 0 ? (
              <div className="text-center p-4 text-slate-500 text-sm mt-4">
                Nenhum caso analisado ainda.
              </div>
            ) : (
              Object.keys(groupedCases).sort((a, b) => {
                const dateStrA = groupedCases[a][0].date;
                const dateStrB = groupedCases[b][0].date;
                const [dayA, monthA, yearA] = dateStrA.split('/');
                const [dayB, monthB, yearB] = dateStrB.split('/');
                return new Date(`${yearB}-${monthB}-${dayB}`) - new Date(`${yearA}-${monthA}-${dayA}`);
              }).map(folderName => (
                <div key={folderName} className="mb-2">
                  <button 
                    onClick={() => openFolder(folderName)}
                    className={`w-full flex items-center justify-between p-2 rounded transition-colors group ${activeFolderView === folderName ? 'bg-slate-700/80 text-white' : 'hover:bg-slate-700/50'}`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {expandedFolders[folderName] ? <FolderOpen className="w-4 h-4 text-blue-400" /> : <Folder className="w-4 h-4 text-blue-400" />}
                      <span className="truncate max-w-[180px] text-left">{folderName}</span>
                    </div>
                    <div 
                      onClick={(e) => toggleFolderExpansion(folderName, e)} 
                      className="p-1 rounded hover:bg-slate-600 text-slate-500 hover:text-white transition-colors"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedFolders[folderName] ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {expandedFolders[folderName] && (
                    <div className="ml-3 mt-1 pl-3 border-l border-slate-700 space-y-1">
                      {groupedCases[folderName].map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setActiveCaseId(c.id); setActiveFolderView(null); setIsSidebarOpen(false); }}
                          className={`w-full text-left p-2 rounded text-sm truncate transition-colors mt-1 ${
                            activeCaseId === c.id ? 'bg-blue-600/20 text-blue-300 font-medium' : 'hover:bg-slate-700 text-slate-400'
                          }`}
                          title={c.title}
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Área Principal de Conteúdo */}
        <main className="flex-1 h-full overflow-y-auto bg-slate-50 p-6 lg:p-8">
          
          {/* ESTADO 1: Vista da Pasta (Grelha de Cartões) */}
          {activeFolderView && !activeCaseId && !isProcessing && (
            <div className="max-w-6xl mx-auto py-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{activeFolderView}</h2>
                  <p className="text-slate-500 text-sm">{groupedCases[activeFolderView]?.length || 0} processos analisados</p>
                </div>
              </div>

              {groupedCases[activeFolderView] ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedCases[activeFolderView].map(c => (
                    <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col h-full group">
                      <div className="flex-1 cursor-pointer" onClick={() => { setActiveCaseId(c.id); setActiveFolderView(null); }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2.5 bg-slate-50 border border-slate-100 text-blue-600 rounded-lg">
                            <FileText className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {c.date}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1.5 line-clamp-2" title={c.title}>{c.title}</h3>
                        <p className="text-sm text-slate-500 mb-4 line-clamp-1">{c.result.tipoProcesso || 'Processo Jurídico'}</p>
                      </div>
                      
                      <div className="flex items-center justify-end mt-auto pt-4 border-t border-slate-100 gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setRenameInput(c.title); setActionModal({ type: 'rename', case: c }); }} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors tooltip-btn" title="Renomear Processo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDownload(c, e)} 
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors tooltip-btn" title="Baixar Cópia"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'delete', case: c }); }} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors tooltip-btn" title="Apagar Processo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500">Esta pasta está vazia.</div>
              )}
            </div>
          )}

          {/* ESTADO 2: Nova Análise (Upload) */}
          {!activeCaseId && !activeFolderView && !isProcessing && (
            <div className="flex flex-col items-center justify-center min-h-full max-w-4xl mx-auto py-10 animate-in fade-in duration-300">
              <div className="text-center max-w-2xl mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-3">Análise Inteligente de Processos</h2>
                <p className="text-slate-600 text-lg">
                  Faça o upload de peças processuais e a IA fará a extração do resumo, partes envolvidas, e decisões em segundos.
                </p>
              </div>

              {!pdfjsLoaded ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>A inicializar motor de PDF...</span>
                </div>
              ) : (
                <div 
                  className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer bg-white
                    ${error ? 'border-red-400 bg-red-50' : 'border-blue-300 hover:bg-blue-50 hover:border-blue-400 shadow-sm'}`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
                  <div className="flex flex-col items-center gap-4">
                    <div className={`p-4 rounded-full ${error ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-700">Clique ou arraste um PDF aqui</p>
                      <p className="text-sm text-slate-500 mt-1">Apenas ficheiros .pdf (Máximo recomendado: 50MB)</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg max-w-2xl w-full border border-red-200 mt-6">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ESTADO 3: Processando */}
          {isProcessing && (
            <div className="flex flex-col items-center justify-center min-h-full">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-blue-200 rounded-full"></div>
                <div className="w-24 h-24 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600">
                  <FileText className="w-8 h-8 animate-pulse" />
                </div>
              </div>
              <h3 className="mt-8 text-xl font-bold text-slate-800">A processar o documento</h3>
              <p className="text-slate-500 mt-2 font-medium">{progressText}</p>
            </div>
          )}

          {/* ESTADO 4: Visualização do Resultado Individual */}
          {activeCaseId && analysisResult && !isProcessing && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-10">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    {activeCase?.title}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                     Analisado a: <span className="font-semibold text-slate-700">{activeCase?.date}</span>
                     &bull; Pasta: <span className="font-semibold text-slate-700 cursor-pointer hover:text-blue-600" onClick={() => openFolder(activeCase.folder)}>{activeCase?.folder}</span>
                  </p>
                </div>
                
                {/* Ações no painel individual (Opcional, repete a comodidade) */}
                <div className="flex items-center gap-2">
                   <button onClick={(e) => handleDownload(activeCase, e)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
                     <Download className="w-4 h-4" /> Baixar Relatório
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Esquerda: Meta Data */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                       <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                         <Gavel className="w-5 h-5 text-blue-600" />
                         Dados do Processo
                       </h3>
                    </div>
                    <div className="p-0">
                      <MetaItem icon={<BookOpen />} label="Tipo de Processo" value={analysisResult.tipoProcesso} />
                      <MetaItem icon={<FileSearch />} label="Nº do Processo" value={analysisResult.numeroProcesso} />
                      <MetaItem icon={<Building2 />} label="Vara, Comarca e Foro" value={analysisResult.varaComarcaForo} />
                      <MetaItem icon={<Clock />} label="Data de Distribuição" value={analysisResult.dataDistribuicao} />
                      <MetaItem icon={<Calendar />} label="Data da Ocorrência" value={analysisResult.dataOcorrencia} />
                      <MetaItem icon={<Coins />} label="Valor da Causa" value={analysisResult.valorCausa} />
                    </div>
                  </div>

                  {/* Partes Envolvidas */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                       <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                         <Users className="w-5 h-5 text-blue-600" />
                         Partes Envolvidas
                       </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Autor / Requerente</p>
                        <div className="flex items-center gap-2 group">
                          <p className="text-slate-800 font-medium">{analysisResult.autorOuRequerente || 'Não identificado'}</p>
                          <CopyButton text={analysisResult.autorOuRequerente} />
                        </div>
                        <div className="text-slate-500 text-sm mt-1 flex items-center gap-1.5 group w-fit">
                          <IdCard className="w-4 h-4" /> 
                          <span>{analysisResult.cpfCnpjAutor && analysisResult.cpfCnpjAutor !== "Não identificado" ? analysisResult.cpfCnpjAutor : 'CPF/CNPJ não identificado'}</span>
                          <CopyButton text={analysisResult.cpfCnpjAutor} />
                        </div>
                        {analysisResult.advogadoAutor && analysisResult.advogadoAutor !== "Não identificado" && (
                          <div className="text-slate-500 text-sm mt-1 flex items-center gap-1.5 group w-fit">
                            <Briefcase className="w-4 h-4" /> 
                            <span>Adv: {analysisResult.advogadoAutor} {analysisResult.oabAutor && analysisResult.oabAutor !== "Não identificado" ? `(OAB: ${analysisResult.oabAutor})` : ''}</span>
                            <CopyButton text={`${analysisResult.advogadoAutor} ${analysisResult.oabAutor && analysisResult.oabAutor !== "Não identificado" ? `(OAB: ${analysisResult.oabAutor})` : ''}`} />
                          </div>
                        )}
                      </div>
                      <div className="h-px w-full bg-slate-100"></div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Réu / Requerido</p>
                        <div className="flex items-center gap-2 group">
                          <p className="text-slate-800 font-medium">{analysisResult.reuOuRequerido || 'Não identificado'}</p>
                          <CopyButton text={analysisResult.reuOuRequerido} />
                        </div>
                        <div className="text-slate-500 text-sm mt-1 flex items-center gap-1.5 group w-fit">
                          <IdCard className="w-4 h-4" /> 
                          <span>{analysisResult.cpfCnpjReu && analysisResult.cpfCnpjReu !== "Não identificado" ? analysisResult.cpfCnpjReu : 'CPF/CNPJ não identificado'}</span>
                          <CopyButton text={analysisResult.cpfCnpjReu} />
                        </div>
                        {analysisResult.advogadoReu && analysisResult.advogadoReu !== "Não identificado" && (
                          <div className="text-slate-500 text-sm mt-1 flex items-center gap-1.5 group w-fit">
                            <Briefcase className="w-4 h-4" /> 
                            <span>Adv: {analysisResult.advogadoReu} {analysisResult.oabReu && analysisResult.oabReu !== "Não identificado" ? `(OAB: ${analysisResult.oabReu})` : ''}</span>
                            <CopyButton text={`${analysisResult.advogadoReu} ${analysisResult.oabReu && analysisResult.oabReu !== "Não identificado" ? `(OAB: ${analysisResult.oabReu})` : ''}`} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Textual Content */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Resumo */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="flex items-center justify-between mb-4 group">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Resumo dos Fatos
                      </h3>
                      <CopyButton text={analysisResult.resumoFatos} />
                    </div>
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                      {analysisResult.resumoFatos?.split('\n').map((paragraph, idx) => (
                        paragraph.trim() && <p key={idx} className="mb-3">{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  {/* Card Dados da Reserva de Voo */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                       <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                         <Plane className="w-5 h-5 text-blue-600" />
                         Dados da Reserva de Voo
                       </h3>
                    </div>
                    <div className="p-0">
                      <MetaItem icon={<Ticket />} label="Nº do Voo" value={analysisResult.numeroVoo} />
                      <MetaItem icon={<FileSearch />} label="Localizador (PNR)" value={analysisResult.pnr} />
                      <MetaItem icon={<MapPin />} label="IATA Origem" value={analysisResult.iataOrigem} />
                      <MetaItem icon={<MapPin />} label="IATA Incidente" value={analysisResult.iataIncidente} />
                      <MetaItem icon={<MapPin />} label="IATA Destino" value={analysisResult.iataDestino} />
                    </div>
                  </div>

                  {/* Card Dados da Audiência */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                       <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                         <Calendar className="w-5 h-5 text-blue-600" />
                         Dados da Audiência
                       </h3>
                    </div>
                    <div className="p-0">
                      <MetaItem icon={<Calendar />} label="Data da Audiência" value={analysisResult.dataAudiencia} />
                      <MetaItem icon={<Clock />} label="Horário" value={analysisResult.horarioAudiencia} />
                      <MetaItem icon={<AlertCircle />} label="Status / Observações" value={analysisResult.statusAudiencia} />
                    </div>
                  </div>

                  {/* Pedidos / Decisão */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4 group">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Pedidos / Decisões
                      </h3>
                      <CopyButton text={analysisResult.pedidosOuDecisao?.join('\n')} />
                    </div>
                    {analysisResult.pedidosOuDecisao && analysisResult.pedidosOuDecisao.length > 0 ? (
                      <ul className="space-y-3">
                        {analysisResult.pedidosOuDecisao.map((item, idx) => (
                          <li key={idx} className="group flex gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <ChevronRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span className="flex-1">{item}</span>
                            <CopyButton text={item} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 italic">Nenhum pedido ou decisão estruturada identificada no documento.</p>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 20px; }
      `}} />
    </div>
  );
}

// --- Componentes Menores ---
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text || text === "Não identificado") return;
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar', err);
    }
    
    document.body.removeChild(textArea);
  };

  if (!text || text === "Não identificado" || text.trim() === "") return null;

  return (
    <button 
      onClick={handleCopy} 
      className={`inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 flex-shrink-0 ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
      title="Copiar texto"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function MetaItem({ icon, label, value }) {
  return (
    <div className="group flex items-start gap-3 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-start justify-between gap-2 mt-1">
          <p className="text-slate-800 font-medium text-sm leading-tight">
            {value && value !== "Não identificado" ? value : <span className="text-slate-400 italic">Não identificado</span>}
          </p>
          <CopyButton text={value} />
        </div>
      </div>
    </div>
  );
}