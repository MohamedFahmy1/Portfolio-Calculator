import { useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'

type CashEntry = {
  id: string
  note: string
  amount: string
}

type PortfolioFields = {
  usdAmount: string
  usdRate: string
  goldGrams: string
  goldPricePerGram: string
  stocksValue: string
  cashEntries: CashEntry[]
  bankCertificates: string
}

type PortfolioSnapshot = {
  values: PortfolioFields
  updatedAt: string | null
}

type HoldingTone = 'dollar' | 'gold' | 'stocks' | 'cash' | 'certificate'

type HoldingSummary = {
  key: HoldingTone
  label: string
  note: string
  value: number
}

const STORAGE_KEY = 'portfolio-calculator.snapshot.v1'

const defaultPortfolio: PortfolioFields = {
  usdAmount: '',
  usdRate: '',
  goldGrams: '',
  goldPricePerGram: '',
  stocksValue: '',
  cashEntries: [],
  bankCertificates: '',
}

const currencyFormatter = new Intl.NumberFormat('en-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('en-EG', {
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function sanitizeField(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function createCashEntry(): CashEntry {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return {
      id: crypto.randomUUID(),
      note: '',
      amount: '',
    }
  }

  return {
    id: `cash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    note: '',
    amount: '',
  }
}

function sanitizeCashEntry(value: unknown): CashEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Partial<CashEntry>

  return {
    id: sanitizeField(entry.id) || createCashEntry().id,
    note: sanitizeField(entry.note),
    amount: sanitizeField(entry.amount),
  }
}

function hasCashEntryContent(entry: CashEntry) {
  return entry.note.trim() !== '' || entry.amount.trim() !== ''
}

function sanitizeCashEntries(value: unknown, keepEmpty: boolean) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => sanitizeCashEntry(entry))
    .filter((entry): entry is CashEntry => entry !== null)
    .filter((entry) => keepEmpty || hasCashEntryContent(entry))
}

function sanitizePortfolio(
  values?: (Partial<PortfolioFields> & { cash?: unknown }) | null,
  keepEmptyCashEntries = true,
): PortfolioFields {
  const legacyCash = sanitizeField(values?.cash)
  const cashEntries = Array.isArray(values?.cashEntries)
    ? sanitizeCashEntries(values?.cashEntries, keepEmptyCashEntries)
    : legacyCash.trim()
      ? [
          {
            ...createCashEntry(),
            amount: legacyCash,
          },
        ]
      : []

  return {
    usdAmount: sanitizeField(values?.usdAmount),
    usdRate: sanitizeField(values?.usdRate),
    goldGrams: sanitizeField(values?.goldGrams),
    goldPricePerGram: sanitizeField(values?.goldPricePerGram),
    stocksValue: sanitizeField(values?.stocksValue),
    cashEntries,
    bankCertificates: sanitizeField(values?.bankCertificates),
  }
}

function loadSnapshot(): PortfolioSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PortfolioSnapshot>

    return {
      values: sanitizePortfolio(parsed.values),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch {
    return null
  }
}

function persistSnapshot(snapshot: PortfolioSnapshot) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, '').trim()

  if (!normalized) {
    return 0
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatDecimal(value: number) {
  return decimalFormatter.format(value)
}

function formatSavedAt(value: string | null) {
  if (!value) {
    return 'No saved snapshot yet'
  }

  return dateFormatter.format(new Date(value))
}

function hasUnsavedChanges(draft: PortfolioFields, saved: PortfolioFields) {
  return JSON.stringify(sanitizePortfolio(draft, false)) !== JSON.stringify(sanitizePortfolio(saved, false))
}

function calculatePortfolio(values: PortfolioFields) {
  const usdAmount = parseAmount(values.usdAmount)
  const usdRate = parseAmount(values.usdRate)
  const goldGrams = parseAmount(values.goldGrams)
  const goldPricePerGram = parseAmount(values.goldPricePerGram)
  const stocksValue = parseAmount(values.stocksValue)
  const cashEntries = sanitizeCashEntries(values.cashEntries, false)
  const cash = roundAmount(
    cashEntries.reduce((total, entry) => total + parseAmount(entry.amount), 0),
  )
  const bankCertificates = parseAmount(values.bankCertificates)

  const dollarTotal = roundAmount(usdAmount * usdRate)
  const goldTotal = roundAmount(goldGrams * goldPricePerGram)
  const total = roundAmount(
    dollarTotal + goldTotal + stocksValue + cash + bankCertificates,
  )

  const holdings: HoldingSummary[] = [
    {
      key: 'dollar',
      label: 'Dollar balance',
      note: usdAmount > 0 ? `${formatDecimal(usdAmount)} USD` : 'No dollars entered',
      value: dollarTotal,
    },
    {
      key: 'gold',
      label: 'Gold reserve',
      note:
        goldGrams > 0 ? `${formatDecimal(goldGrams)} grams tracked` : 'No gold entered',
      value: goldTotal,
    },
    {
      key: 'stocks',
      label: 'Stocks',
      note: stocksValue > 0 ? 'Entered directly in EGP' : 'No stock value entered',
      value: stocksValue,
    },
    {
      key: 'cash',
      label: 'Cash',
      note:
        cashEntries.length > 0
          ? `${cashEntries.length} cash ${cashEntries.length === 1 ? 'line' : 'lines'} tracked`
          : 'No cash entries entered',
      value: cash,
    },
    {
      key: 'certificate',
      label: 'Bank certificates',
      note:
        bankCertificates > 0
          ? 'Entered directly in EGP'
          : 'No certificate value entered',
      value: bankCertificates,
    },
  ]

  const sortedHoldings = [...holdings].sort((left, right) => right.value - left.value)
  const largestHolding = sortedHoldings.find((item) => item.value > 0) ?? null
  const liquidValue = roundAmount(dollarTotal + cash)
  const defensiveValue = roundAmount(goldTotal + bankCertificates)
  const growthValue = roundAmount(stocksValue)

  return {
    usdAmount,
    usdRate,
    goldGrams,
    goldPricePerGram,
    dollarTotal,
    goldTotal,
    stocksValue,
    cash,
    cashEntries,
    cashEntryCount: cashEntries.length,
    bankCertificates,
    total,
    holdings,
    sortedHoldings,
    largestHolding,
    liquidValue,
    defensiveValue,
    growthValue,
  }
}

type InputFieldProps = {
  label: string
  suffix: string
  step?: string
  value: string
  onChange: (value: string) => void
}

function InputField({
  label,
  suffix,
  step = '0.01',
  value,
  onChange,
}: InputFieldProps) {
  return (
    <label className="input-field">
      <span>{label}</span>
      <div className="input-shell">
        <input
          type="number"
          min="0"
          step={step}
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <small>{suffix}</small>
      </div>
    </label>
  )
}

type ReadoutProps = {
  label: string
  value: string
}

function Readout({ label, value }: ReadoutProps) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type CurrencyValueProps = {
  className?: string
  value: number
}

function CurrencyValue({ className, value }: CurrencyValueProps) {
  return <span className={className}>{formatCurrency(value)}</span>
}

type HoldingCardProps = {
  tone: HoldingTone
  title: string
  hint: string
  total: number
  totalLabel: string
  badge: string
  delay: number
  children: ReactNode
}

function HoldingCard({
  tone,
  title,
  hint,
  total,
  totalLabel,
  badge,
  delay,
  children,
}: HoldingCardProps) {
  return (
    <article
      className={`holding-card holding-card--${tone}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="holding-card__header">
        <div>
          <span className="holding-card__kicker">{badge}</span>
          <h3>{title}</h3>
        </div>
        <span className="holding-card__badge">{tone}</span>
      </header>

      <p className="holding-card__hint">{hint}</p>

      <div className="holding-card__body">{children}</div>

      <footer className="holding-card__footer">
        <span>{totalLabel}</span>
        <CurrencyValue className="holding-card__total" value={total} />
      </footer>
    </article>
  )
}

const persistedSnapshot = loadSnapshot()
const initialSnapshot = persistedSnapshot ?? {
  values: defaultPortfolio,
  updatedAt: null,
}

function App() {
  const [savedSnapshot, setSavedSnapshot] = useState<PortfolioSnapshot>(initialSnapshot)
  const [draftValues, setDraftValues] = useState<PortfolioFields>(initialSnapshot.values)
  const [isEditing, setIsEditing] = useState(persistedSnapshot === null)

  const activeValues = isEditing ? draftValues : savedSnapshot.values
  const activePortfolio = calculatePortfolio(activeValues)
  const unsavedChanges = hasUnsavedChanges(draftValues, savedSnapshot.values)
  const totalValue = activePortfolio.total
  const totalHoldings = activePortfolio.total || 1

  const updateField = (field: keyof PortfolioFields, value: string) => {
    setDraftValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updateCashEntry = (
    entryId: string,
    field: keyof Omit<CashEntry, 'id'>,
    value: string,
  ) => {
    setDraftValues((current) => ({
      ...current,
      cashEntries: current.cashEntries.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const addCashEntry = () => {
    setDraftValues((current) => ({
      ...current,
      cashEntries: [...current.cashEntries, createCashEntry()],
    }))
  }

  const deleteCashEntry = (entryId: string) => {
    setDraftValues((current) => ({
      ...current,
      cashEntries: current.cashEntries.filter((entry) => entry.id !== entryId),
    }))
  }

  const handleEdit = () => {
    setDraftValues(sanitizePortfolio(savedSnapshot.values))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setDraftValues(sanitizePortfolio(savedSnapshot.values))
    setIsEditing(false)
  }

  const handleSave = () => {
    const snapshot: PortfolioSnapshot = {
      values: sanitizePortfolio(draftValues, false),
      updatedAt: new Date().toISOString(),
    }

    persistSnapshot(snapshot)
    setSavedSnapshot(snapshot)
    setDraftValues(snapshot.values)
    setIsEditing(false)
  }

  const largestHoldingShare = activePortfolio.largestHolding
    ? (activePortfolio.largestHolding.value / totalHoldings) * 100
    : 0

  return (
    <div className="app-shell">
      <header className="hero">
        <section className="hero-copy panel panel--transparent">
          <p className="hero-copy__eyebrow">Personal portfolio calculator</p>
          <h1>Read every asset through one EGP lens.</h1>
          <p className="hero-copy__text">
            Dollar and gold positions are converted live into Egyptian pounds,
            while stocks, cash entries, and bank certificates stay as direct EGP
            inputs. Save a clean snapshot locally on this device and jump between
            view and edit whenever you need to update the portfolio.
          </p>

          <div className="hero-copy__actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={handleCancel}
                >
                  Cancel draft
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleSave}
                  disabled={!unsavedChanges}
                >
                  Save snapshot
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={handleEdit}
              >
                Edit portfolio
              </button>
            )}
          </div>

          <div className="hero-copy__status">
            <span
              className={`status-chip ${isEditing ? 'status-chip--editing' : 'status-chip--saved'}`}
            >
              {isEditing ? 'Editing draft' : 'Viewing saved snapshot'}
            </span>
            <span className="status-chip status-chip--neutral">
              Stored only in local browser storage
            </span>
          </div>
        </section>

        <aside className="hero-summary">
          <span className="hero-summary__label">Portfolio total</span>
          <CurrencyValue className="hero-summary__total" value={totalValue} />
          <p className="hero-summary__caption">
            Every figure below is normalized to EGP, so the headline number stays
            immediately comparable.
          </p>

          <div className="hero-summary__grid">
            <div className="hero-stat">
              <span>Dollar value in EGP</span>
              <strong>{formatCurrency(activePortfolio.dollarTotal)}</strong>
            </div>
            <div className="hero-stat">
              <span>Gold value in EGP</span>
              <strong>{formatCurrency(activePortfolio.goldTotal)}</strong>
            </div>
            <div className="hero-stat">
              <span>Liquid exposure</span>
              <strong>{formatCurrency(activePortfolio.liquidValue)}</strong>
            </div>
            <div className="hero-stat">
              <span>Last saved</span>
              <strong>{formatSavedAt(savedSnapshot.updatedAt)}</strong>
            </div>
          </div>
        </aside>
      </header>

      <main className="dashboard">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__eyebrow">Holdings</p>
              <h2>Allocation inputs</h2>
            </div>
            <p className="panel-heading__text">
              The summary updates live while you edit, but only the saved snapshot
              stays after refresh.
            </p>
          </div>

          <div className="holdings-grid">
            <HoldingCard
              tone="dollar"
              title="Dollar position"
              hint="Track your USD amount and the current EGP exchange rate."
              total={activePortfolio.dollarTotal}
              totalLabel="Converted total"
              badge="FX hedge"
              delay={80}
            >
              {isEditing ? (
                <div className="input-grid">
                  <InputField
                    label="Dollar amount"
                    suffix="USD"
                    value={draftValues.usdAmount}
                    onChange={(value) => updateField('usdAmount', value)}
                  />
                  <InputField
                    label="EGP per dollar"
                    suffix="EGP"
                    value={draftValues.usdRate}
                    onChange={(value) => updateField('usdRate', value)}
                  />
                </div>
              ) : (
                <div className="readout-list">
                  <Readout
                    label="Dollar amount"
                    value={`${formatDecimal(activePortfolio.usdAmount)} USD`}
                  />
                  <Readout
                    label="Exchange rate"
                    value={`${formatDecimal(activePortfolio.usdRate)} EGP`}
                  />
                </div>
              )}
            </HoldingCard>

            <HoldingCard
              tone="gold"
              title="Gold reserve"
              hint="Enter the weight in grams and the current spot price per gram."
              total={activePortfolio.goldTotal}
              totalLabel="Computed value"
              badge="Hard asset"
              delay={140}
            >
              {isEditing ? (
                <div className="input-grid">
                  <InputField
                    label="Gold weight"
                    suffix="grams"
                    value={draftValues.goldGrams}
                    onChange={(value) => updateField('goldGrams', value)}
                  />
                  <InputField
                    label="Price per gram"
                    suffix="EGP"
                    value={draftValues.goldPricePerGram}
                    onChange={(value) => updateField('goldPricePerGram', value)}
                  />
                </div>
              ) : (
                <div className="readout-list">
                  <Readout
                    label="Gold weight"
                    value={`${formatDecimal(activePortfolio.goldGrams)} grams`}
                  />
                  <Readout
                    label="Price per gram"
                    value={`${formatDecimal(activePortfolio.goldPricePerGram)} EGP`}
                  />
                </div>
              )}
            </HoldingCard>

            <HoldingCard
              tone="stocks"
              title="Stocks value"
              hint="Keep the market value of your stock holdings directly in EGP."
              total={activePortfolio.stocksValue}
              totalLabel="Entered total"
              badge="Growth"
              delay={200}
            >
              {isEditing ? (
                <div className="input-grid">
                  <InputField
                    label="Stocks value"
                    suffix="EGP"
                    value={draftValues.stocksValue}
                    onChange={(value) => updateField('stocksValue', value)}
                  />
                </div>
              ) : (
                <div className="readout-list">
                  <Readout
                    label="Stocks value"
                    value={formatCurrency(activePortfolio.stocksValue)}
                  />
                </div>
              )}
            </HoldingCard>

            <HoldingCard
              tone="cash"
              title="Cash on hand"
              hint="Split liquid EGP cash into as many named lines as you want, then let the card total them."
              total={activePortfolio.cash}
              totalLabel="Combined total"
              badge="Liquid"
              delay={260}
            >
              {isEditing ? (
                <div className="cash-entry-list">
                  {draftValues.cashEntries.length > 0 ? (
                    draftValues.cashEntries.map((entry, index) => (
                      <div className="cash-entry-row" key={entry.id}>
                        <label className="input-field cash-entry-note">
                          <span>{`Note ${index + 1}`}</span>
                          <div className="input-shell">
                            <input
                              type="text"
                              placeholder="Wallet, drawer, account..."
                              value={entry.note}
                              onChange={(event) =>
                                updateCashEntry(entry.id, 'note', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <InputField
                          label="Amount"
                          suffix="EGP"
                          value={entry.amount}
                          onChange={(value) => updateCashEntry(entry.id, 'amount', value)}
                        />

                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => deleteCashEntry(entry.id)}
                          aria-label={`Delete cash line ${index + 1}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v7h-2v-7Zm4 0h2v7h-2v-7ZM7 10h2v7H7v-7Zm1 10h8a2 2 0 0 0 2-2V8H6v10a2 2 0 0 0 2 2Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">
                      No cash lines yet. Add one and the total will be calculated automatically.
                    </div>
                  )}

                  <button
                    type="button"
                    className="button button--ghost button--add-row"
                    onClick={addCashEntry}
                  >
                    Add cash line
                  </button>
                </div>
              ) : (
                <div className="cash-readout-list">
                  {activePortfolio.cashEntryCount > 0 ? (
                    activePortfolio.cashEntries.map((entry, index) => (
                      <div className="cash-readout" key={entry.id}>
                        <div>
                          <strong>{entry.note.trim() || `Cash line ${index + 1}`}</strong>
                          <span>EGP cash entry</span>
                        </div>
                        <strong>{formatCurrency(parseAmount(entry.amount))}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">No cash entries saved yet.</div>
                  )}
                </div>
              )}
            </HoldingCard>

            <HoldingCard
              tone="certificate"
              title="Bank certificates"
              hint="Keep the value of certificates directly in EGP for the fixed-income side."
              total={activePortfolio.bankCertificates}
              totalLabel="Entered total"
              badge="Income"
              delay={320}
            >
              {isEditing ? (
                <div className="input-grid">
                  <InputField
                    label="Certificates value"
                    suffix="EGP"
                    value={draftValues.bankCertificates}
                    onChange={(value) => updateField('bankCertificates', value)}
                  />
                </div>
              ) : (
                <div className="readout-list">
                  <Readout
                    label="Certificates value"
                    value={formatCurrency(activePortfolio.bankCertificates)}
                  />
                </div>
              )}
            </HoldingCard>
          </div>
        </section>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-heading panel-heading--stacked">
              <div>
                <p className="panel-heading__eyebrow">Mix</p>
                <h2>Allocation map</h2>
              </div>
              <p className="panel-heading__text">
                Your portfolio split updates from the current saved view or live
                draft, depending on the mode.
              </p>
            </div>

            {activePortfolio.total > 0 ? (
              <>
                <div className="allocation-bar" aria-hidden="true">
                  {activePortfolio.sortedHoldings.map((item) => (
                    <span
                      key={item.key}
                      className={`allocation-bar__segment allocation-bar__segment--${item.key}`}
                      style={{ flexGrow: item.value }}
                    />
                  ))}
                </div>

                <div className="allocation-list">
                  {activePortfolio.sortedHoldings.map((item) => {
                    const share = (item.value / totalHoldings) * 100

                    return (
                      <div className="allocation-item" key={item.key}>
                        <span
                          className={`allocation-item__dot allocation-item__dot--${item.key}`}
                        />
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.note}</p>
                        </div>
                        <div className="allocation-item__meta">
                          <strong>{formatCurrency(item.value)}</strong>
                          <span>{share.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                Add any holding to see the portfolio split and allocation signals.
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading panel-heading--stacked">
              <div>
                <p className="panel-heading__eyebrow">Signals</p>
                <h2>Quick read</h2>
              </div>
              <p className="panel-heading__text">
                A compact summary for liquidity, defense, and concentration.
              </p>
            </div>

            <div className="signal-grid">
              <article className="signal-card">
                <span>Liquid position</span>
                <strong>{formatCurrency(activePortfolio.liquidValue)}</strong>
                <p>Cash plus converted dollar exposure.</p>
              </article>

              <article className="signal-card">
                <span>Defensive bucket</span>
                <strong>{formatCurrency(activePortfolio.defensiveValue)}</strong>
                <p>Gold reserve plus bank certificates.</p>
              </article>

              <article className="signal-card">
                <span>Growth bucket</span>
                <strong>{formatCurrency(activePortfolio.growthValue)}</strong>
                <p>Stock value entered directly in EGP.</p>
              </article>

              <article className="signal-card">
                <span>Largest line</span>
                <strong>
                  {activePortfolio.largestHolding
                    ? activePortfolio.largestHolding.label
                    : 'No allocation yet'}
                </strong>
                <p>
                  {activePortfolio.largestHolding
                    ? `${largestHoldingShare.toFixed(1)}% of the portfolio`
                    : 'Save or enter values to compute the leading allocation.'}
                </p>
              </article>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
