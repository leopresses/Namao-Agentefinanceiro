import React, { useEffect, useState, useRef } from 'react';
import { getExpenses } from '../services/db';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDialog } from '../contexts/DialogContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCategory } from '../utils/categories';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Report() {
  const [allExpenses, setAllExpenses] = useState([]);
  const [displayedExpenses, setDisplayedExpenses] = useState([]);
  const [balance, setBalance] = useState(0);
  const [toPay, setToPay] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [totalExpenseAmount, setTotalExpenseAmount] = useState(0);
  const [chartData, setChartData] = useState([]);
  
  // Controle de Mês ('all' ou data)
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const reportRefs = useRef([]);
  const [isExporting, setIsExporting] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    async function loadData() {
      const data = await getExpenses();
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllExpenses(data);
    }
    loadData();
  }, []);

  useEffect(() => {
    let filtered = allExpenses;

    if (filterMode === 'month') {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      
      filtered = allExpenses.filter(item => {
        const itemDate = new Date(item.date + 'T12:00:00');
        return itemDate.getMonth() === month && itemDate.getFullYear() === year;
      });
    }

    setDisplayedExpenses(filtered);
    
    let currentBalance = 0;
    let currentToPay = 0;
    const catTotals = {};
    let totalExp = 0;

    filtered.forEach(item => {
      if (item.type === 'income') {
        currentBalance += item.amount;
      } else if (item.type === 'expense') {
        if (item.status !== 'planned') {
          currentBalance -= item.amount;
          
          const cat = item.category || 'outros';
          catTotals[cat] = (catTotals[cat] || 0) + item.amount;
          totalExp += item.amount;
        }
        
        if (item.status === 'unpaid') {
          currentToPay += item.amount;
        }
      }
    });

    setBalance(currentBalance);
    setToPay(currentToPay);
    setCategoryTotals(catTotals);
    setTotalExpenseAmount(totalExp);
  }, [allExpenses, filterMode, currentDate]);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  useEffect(() => {
    // Evolução últimos 6 meses
    const monthsData = {};
    for (let i = 5; i >= 0; i--) {
       const d = new Date();
       d.setMonth(d.getMonth() - i);
       const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0');
       const label = monthNames[d.getMonth()].substring(0, 3) + '/' + String(d.getFullYear()).substring(2);
       monthsData[key] = { name: label, Renda: 0, Despesa: 0 };
    }
    
    allExpenses.forEach(item => {
       if (item.status === 'planned') return;
       const itemDate = new Date(item.date + 'T12:00:00');
       const key = itemDate.getFullYear() + '-' + String(itemDate.getMonth()+1).padStart(2, '0');
       if (monthsData[key]) {
          if (item.type === 'income') monthsData[key].Renda += item.amount;
          if (item.type === 'expense') monthsData[key].Despesa += item.amount;
       }
    });
    
    setChartData(Object.values(monthsData));
  }, [allExpenses]);

  const changeMonth = (offset) => {

  const getReportTitle = () => {
    if (filterMode === 'all') return 'Relatório Geral (Todos os Meses)';
    return `Relatório - ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const handleExportPDF = async () => {
    if (!reportRefs.current || reportRefs.current.length === 0) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      for (let i = 0; i < chunks.length; i++) {
        if (!reportRefs.current[i]) continue;
        
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(reportRefs.current[i], { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      }
      
      const pdfBlob = pdf.output('blob');
      const filename = `relatorio_namao_${new Date().toISOString().split('T')[0]}.pdf`;

      if (navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], filename, { type: 'application/pdf' })] })) {
        const confirmed = await showConfirm('Compartilhar', 'Deseja compartilhar o relatório direto no WhatsApp/Outros? (Cancele para apenas salvar no dispositivo)');
        if (confirmed) {
          try {
            await navigator.share({
              title: 'Relatório NaMão',
              text: 'Aqui está meu relatório financeiro.',
              files: [new File([pdfBlob], filename, { type: 'application/pdf' })],
            });
            return;
          } catch (shareErr) {
            console.log('Compartilhamento cancelado ou falhou', shareErr);
          }
        }
      }

      pdf.save(filename);

    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Erro ao gerar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Precisamos converter a imagem da logo pra Base64 para injetar no PDF corretamente via HTML2Canvas
  // Como é local, vamos tentar renderizar a tag img normalmente, mas se falhar no CORS, html2canvas pode ignorar.
  // Como estamos no mesmo domínio, deve funcionar.

  const FIRST_PAGE_ROWS = 12;
  const OTHER_PAGE_ROWS = 22;
  
  const chunks = [];
  let remaining = [...displayedExpenses];
  if (remaining.length === 0) {
    chunks.push([]);
  } else {
    chunks.push(remaining.splice(0, FIRST_PAGE_ROWS));
    while (remaining.length > 0) {
      chunks.push(remaining.splice(0, OTHER_PAGE_ROWS));
    }
  }

  return (
    <div className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Relatórios</h1>
      </header>

      {/* Tipo de Filtro */}
      <div className="glass-card" style={{ marginBottom: '16px', display: 'flex', gap: '8px', padding: '12px' }}>
        <button 
          onClick={() => setFilterMode('all')}
          style={{ 
            flex: 1, 
            padding: '12px', 
            borderRadius: '12px',
            border: 'none',
            background: filterMode === 'all' ? 'var(--color-emerald-primary)' : 'transparent',
            color: filterMode === 'all' ? '#fff' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
        >
          Geral
        </button>
        <button 
          onClick={() => setFilterMode('month')}
          style={{ 
            flex: 1, 
            padding: '12px', 
            borderRadius: '12px',
            border: 'none',
            background: filterMode === 'month' ? 'var(--color-emerald-primary)' : 'transparent',
            color: filterMode === 'month' ? '#fff' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
        >
          Por Mês
        </button>
      </div>

      {/* Seletor de Mês (se ativado) */}
      {filterMode === 'month' && (
        <div className="glass-card animate-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', marginBottom: '16px' }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}>
            <ChevronLeft size={24} />
          </button>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: '600' }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button onClick={() => changeMonth(1)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}>
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      <div className="glass-card" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>{getReportTitle()}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Gere um PDF com layout premium e compartilhe via WhatsApp.
        </p>
        <button 
          onClick={handleExportPDF} 
          className="btn-primary" 
          style={{ width: '100%' }}
          disabled={isExporting}
        >
          {isExporting ? 'Gerando...' : 'Exportar & Compartilhar'}
        </button>
      </div>

      {/* Gráfico de Evolução (Últimos 6 Meses) */}
      <div className="glass-card animate-fade-up" style={{ marginBottom: '32px', padding: '24px' }}>
        <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)', fontSize: '1.1rem', textAlign: 'center' }}>📈 Evolução (6 Meses)</h3>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.05)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
              <Tooltip 
                contentStyle={{ background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', color: 'var(--text-primary)' }}
                itemStyle={{ fontWeight: '600' }}
                formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
              />
              <Line type="monotone" dataKey="Renda" stroke="var(--color-emerald-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Despesa" stroke="var(--color-crimson-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo de Categorias Visual */}
      {totalExpenseAmount > 0 && (
        <div className="glass-card" style={{ marginBottom: '32px', padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Despesas por Categoria</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([catId, amount]) => {
                const cat = getCategory(catId);
                const percent = ((amount / totalExpenseAmount) * 100).toFixed(1);
                return (
                  <div key={catId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{cat.icon} {cat.label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({percent}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(15, 23, 42, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: 'var(--color-crimson-primary)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* CONTEÚDO DO PDF (Oculto) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {chunks.map((chunk, pageIndex) => (
          <div key={pageIndex} ref={el => reportRefs.current[pageIndex] = el} style={{ 
            width: '800px', 
            padding: '40px', 
            background: '#F8FAFC', 
            color: '#1E293B', 
            fontFamily: 'sans-serif' 
          }}>
            {/* Cabeçalho do PDF Premium (apenas na primeira página) */}
            {pageIndex === 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '2px solid rgba(16, 185, 129, 0.2)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '16px' }} crossOrigin="anonymous" />
                    <div>
                      <h1 style={{ color: '#059669', margin: 0, fontSize: '28px' }}>NaMão</h1>
                      <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '16px' }}>Gestão Financeira Inteligente</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, color: '#1E293B', fontSize: '20px' }}>{getReportTitle()}</h2>
                    <p style={{ margin: '8px 0 0 0', color: '#64748B' }}>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
                  <div style={{ 
                    background: '#FFFFFF', 
                    padding: '24px', 
                    borderRadius: '24px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: '0 0 8px 0', color: '#64748B', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{filterMode === 'all' ? 'Saldo Histórico' : 'Saldo do Mês'}</p>
                    <h1 style={{ margin: 0, fontSize: '28px', color: balance >= 0 ? '#059669' : '#E11D48', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {balance < 0 ? '- R$ ' : 'R$ '}{Math.abs(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h1>
                  </div>
                  
                  <div style={{ 
                    background: '#FFFFFF', 
                    padding: '24px', 
                    borderRadius: '24px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(244, 63, 94, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: '0 0 8px 0', color: '#64748B', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{filterMode === 'all' ? 'Pendências Acumuladas' : 'Faturas a Pagar'}</p>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#E11D48', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      R$ {toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h1>
                  </div>
                </div>
              </>
            )}

            {pageIndex > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(15, 23, 42, 0.1)', paddingBottom: '16px' }}>
                <h2 style={{ color: '#059669', margin: 0, fontSize: '20px' }}>NaMão - Continuação</h2>
                <span style={{ color: '#64748B', fontSize: '14px' }}>Página {pageIndex + 1}</span>
              </div>
            )}
            
            {/* Tabela de Dados */}
            <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(15, 23, 42, 0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#1E293B' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    <th style={{ padding: '16px', borderRadius: '12px 0 0 12px', color: '#64748B' }}>Data</th>
                    <th style={{ padding: '16px', color: '#64748B' }}>Descrição</th>
                    <th style={{ padding: '16px', color: '#64748B' }}>Situação</th>
                    <th style={{ padding: '16px', borderRadius: '0 12px 12px 0', textAlign: 'right', color: '#64748B' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((exp, idx) => (
                    <tr key={exp.id} style={{ borderBottom: idx === chunk.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 16px', color: '#64748B' }}>{exp.date.split('-').reverse().join('/')}</td>
                      <td style={{ padding: '16px 16px', fontWeight: '500' }}>
                        {exp.type === 'expense' ? getCategory(exp.category).icon + ' ' : '💰 '}{exp.description}
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{ 
                          background: exp.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : (exp.status === 'planned' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)'), 
                          color: exp.status === 'paid' ? '#059669' : (exp.status === 'planned' ? '#f59e0b' : '#E11D48'),
                          padding: '4px 12px',
                          borderRadius: '100px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {exp.status === 'paid' ? 'Pago' : (exp.status === 'planned' ? 'Planejado' : 'Pendente')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 16px', textAlign: 'right', fontWeight: '700', color: exp.type === 'income' ? '#059669' : '#E11D48' }}>
                        {exp.type === 'income' ? '+' : '-'} R$ {exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {chunk.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                        Nenhuma movimentação neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {pageIndex === chunks.length - 1 && (
              <div style={{ textAlign: 'center', marginTop: '40px', color: '#94A3B8', fontSize: '14px' }}>
                Documento gerado automaticamente pelo aplicativo NaMão
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
