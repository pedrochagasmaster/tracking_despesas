import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Check, CircleSlash2, Download, RefreshCw, Tags } from 'lucide-react'

const fmt = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function KeepToggle({ keep, onKeep, onDrop, busy }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-700/70 bg-slate-900/60 p-1">
      <button
        type="button"
        onClick={onKeep}
        disabled={busy}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${keep ? 'bg-emerald-500/25 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <span className="inline-flex items-center gap-1">
          <Check size={13} />
          Manter
        </span>
      </button>
      <button
        type="button"
        onClick={onDrop}
        disabled={busy}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${!keep ? 'bg-rose-500/25 text-rose-300' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <span className="inline-flex items-center gap-1">
          <CircleSlash2 size={13} />
          Descartar
        </span>
      </button>
    </div>
  )
}

function normalizeLoadError(err) {
  const text = String(err?.message || '')
  if (text === 'Not Found' || text.includes('404')) {
    return 'API de curadoria não encontrada. Reinicie o backend para carregar os endpoints /api/curation/*.'
  }
  if (text.includes('CSV not found')) {
    return 'Arquivo CSV de curadoria não foi encontrado. Gere o merged CSV antes de abrir esta tela.'
  }
  return text || 'Falha ao carregar curadoria.'
}

export default function Curation() {
  const [meta, setMeta] = useState({ csv_file: '', available_csv_files: [], categories: [] })
  const [selectedFile, setSelectedFile] = useState('')
  const [rows, setRows] = useState([])
  const [view, setView] = useState('uncategorized')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingRow, setSavingRow] = useState(null)
  const [exportStatus, setExportStatus] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [metaRes, rowsRes] = await Promise.all([
        api.curationMeta(selectedFile || undefined),
        api.curationTransactions({ file: selectedFile || undefined, view, limit: 1200 }),
      ])
      setMeta(metaRes)
      if (!selectedFile && metaRes.csv_file) {
        setSelectedFile(metaRes.csv_file)
      }
      setRows(rowsRes.items || [])
    } catch (err) {
      setError(normalizeLoadError(err))
    } finally {
      setLoading(false)
    }
  }, [view, selectedFile])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const keepCount = rows.filter((r) => r.keep).length
    const uncategorized = rows.filter((r) => r.keep && !r.categoria_orcamento).length
    return { total: rows.length, keepCount, uncategorized }
  }, [rows])

  async function updateRow(rowId, patch) {
    setSavingRow(rowId)
    setError('')
    try {
      await api.curationUpdate({
        file: selectedFile || undefined,
        updates: [{ row_id: rowId, ...patch }],
      })
      setRows((current) => {
        const updated = current.map((row) => (
          row.row_id === rowId ? { ...row, ...patch } : row
        ))
        if (view === 'all') return updated
        if (view === 'keep') return updated.filter((row) => row.keep)
        return updated.filter((row) => row.keep && !row.categoria_orcamento)
      })
    } catch (err) {
      setError(err.message || 'Falha ao salvar alteração.')
    } finally {
      setSavingRow(null)
    }
  }

  async function exportKeepOnly() {
    setExportStatus('Gerando arquivo...')
    setError('')
    try {
      const res = await api.curationExport(selectedFile || undefined)
      setExportStatus(`Arquivo gerado: ${res.output_file} (${res.rows_exported} linhas)`)
    } catch (err) {
      setExportStatus('')
      setError(err.message || 'Falha ao exportar CSV filtrado.')
    }
  }

  async function importKeepAsExpenses() {
    const uncategorized = rows.filter((row) => row.keep && !row.categoria_orcamento).length
    const confirmMsg = uncategorized > 0
      ? `Existem ${uncategorized} transação(ões) mantidas sem categoria. Elas serão ignoradas na importação. Continuar?`
      : 'Importar transações mantidas como despesas?'
    if (!window.confirm(confirmMsg)) return

    setImporting(true)
    setImportStatus('Importando despesas...')
    setError('')
    try {
      const res = await api.curationImportExpenses({
        file: selectedFile || undefined,
        require_category: true,
      })
      const months = Object.entries(res.imported_by_month || {})
        .map(([month, count]) => `${month}: ${count}`)
        .join(', ')
      setImportStatus(
        `Importadas ${res.imported_expenses} despesas. ` +
        (months ? `Meses: ${months}. ` : '') +
        `Duplicadas ignoradas: ${res.skipped?.duplicates ?? 0}.`
      )
    } catch (err) {
      setImportStatus('')
      setError(err.message || 'Falha ao importar despesas.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Curadoria de Transações</h1>
            <p className="text-sm text-slate-400 mt-1">Categorize as transações mantidas e descarte extras no mesmo fluxo.</p>
          </div>
          <button type="button" className="btn-ghost px-3 py-2" onClick={load}>
            <span className="inline-flex items-center gap-2"><RefreshCw size={15} />Atualizar</span>
          </button>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          Origem: <span className="font-semibold break-all">{meta.csv_file || '—'}</span>
        </div>
        <div>
          <label className="label block mb-1.5">Arquivo CSV</label>
          <select
            className="input-field"
            value={selectedFile}
            onChange={(event) => setSelectedFile(event.target.value)}
          >
            {(meta.available_csv_files || []).map((file) => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-slate-400 break-all">{selectedFile || '—'}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <div>{error}</div>
          <button type="button" onClick={load} className="btn-ghost mt-2 px-3 py-1.5 text-xs">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="glass-card p-3">
          <div className="label">Linhas</div>
          <div className="text-lg font-bold text-white">{stats.total}</div>
        </div>
        <div className="glass-card p-3">
          <div className="label">Mantidas</div>
          <div className="text-lg font-bold text-emerald-300">{stats.keepCount}</div>
        </div>
        <div className="glass-card p-3">
          <div className="label">Sem categoria</div>
          <div className="text-lg font-bold text-amber-300">{stats.uncategorized}</div>
        </div>
      </div>

      <div className="glass-card p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="inline-flex w-full sm:w-auto rounded-xl border border-slate-700/70 bg-slate-900/60 p-1">
          {[
            { key: 'uncategorized', label: 'Pendentes' },
            { key: 'keep', label: 'Mantidas' },
            { key: 'all', label: 'Todas' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition ${view === item.key ? 'bg-blue-600/40 text-blue-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={importKeepAsExpenses}
          disabled={importing}
          className="btn-primary w-full sm:w-auto"
        >
          <span className="inline-flex items-center gap-2">{importing ? 'Importando...' : 'Importar despesas'}</span>
        </button>

        <button type="button" onClick={exportKeepOnly} className="btn-ghost w-full sm:w-auto sm:ml-auto">
          <span className="inline-flex items-center gap-2"><Download size={14} />Exportar keep</span>
        </button>
      </div>
      {stats.uncategorized > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {stats.uncategorized} transação(ões) mantidas sem categoria serão ignoradas na importação.
        </div>
      )}

      {exportStatus && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {exportStatus}
        </div>
      )}
      {importStatus && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {importStatus}
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="glass-card p-10 text-center text-slate-400">
            <RefreshCw size={20} className="inline animate-spin" />
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="glass-card p-10 text-center text-slate-400">Nenhuma transação no filtro atual.</div>
        )}

        {!loading && rows.map((row) => {
          const busy = savingRow === row.row_id
          const primaryText = row.title || row.description || '(sem descrição)'

          return (
            <article key={row.row_id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-100 leading-tight">{primaryText}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{row.date || 'sem data'}</span>
                    <span className={row.keep ? 'text-emerald-300' : 'text-rose-300'}>{row.keep ? 'Mantida' : 'Descartada'}</span>
                    <span>{row.schema_type}</span>
                  </div>
                </div>
                <div className={`text-sm font-bold whitespace-nowrap ${Number(row.amount) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {fmt(row.amount)}
                </div>
              </div>

              <KeepToggle
                keep={row.keep}
                busy={busy}
                onKeep={() => updateRow(row.row_id, { keep: true })}
                onDrop={() => updateRow(row.row_id, { keep: false })}
              />

              <div>
                <label className="label block mb-1.5">
                  <span className="inline-flex items-center gap-1.5"><Tags size={12} />Categoria (Orçamento)</span>
                </label>
                <select
                  className="input-field"
                  value={row.categoria_orcamento || ''}
                  disabled={busy || !row.keep}
                  onChange={(event) => updateRow(row.row_id, { categoria_orcamento: event.target.value })}
                >
                  <option value="">Selecionar categoria</option>
                  {meta.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
