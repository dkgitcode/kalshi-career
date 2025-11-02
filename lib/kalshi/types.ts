export interface KalshiIncentiveProgram {
  discount_factor_bps: number
  end_date: string
  id: string
  incentive_type: string
  market_ticker: string
  paid_out: boolean
  period_reward: number
  start_date: string
  target_size: number
}

export interface KalshiIncentiveProgramsResponse {
  incentive_programs: KalshiIncentiveProgram[]
  next_cursor?: string | null
}

export interface KalshiMarketSummary {
  id: string
  title: string
  subtitle: string | null
  source: string | null
  sourceKey: string | null
  parentSourceKey: string | null
  status: string | null
  categories: string[]
  volume: number
  volume24hr: number
  liquidity: number
  start_date: string | null
  end_date: string | null
  yes_bid_cents: number | null
  no_bid_cents: number | null
  yes_ask_cents: number | null
  no_ask_cents: number | null
  last_price_cents: number | null
}

export interface KalshiEnrichedIncentiveProgram extends KalshiIncentiveProgram {
  market: KalshiMarketSummary | null
}

// Portfolio Types
export interface KalshiPortfolioBalanceResponse {
  balance: number
  portfolio_value: number
  updated_ts: number
}

export interface KalshiMarketPositionItem {
  ticker: string
  total_traded?: number
  total_traded_dollars?: string
  position?: number
  market_exposure?: number
  market_exposure_dollars?: string
  realized_pnl?: number
  realized_pnl_dollars?: string
  resting_orders_count?: number
  fees_paid?: number
  fees_paid_dollars?: string
  last_updated_ts?: string
}

export interface KalshiEventPositionItem {
  event_ticker: string
  total_cost?: number
  total_cost_dollars?: string
  event_exposure?: number
  event_exposure_dollars?: string
  realized_pnl?: number
  realized_pnl_dollars?: string
  resting_order_count?: number
  fees_paid?: number
  fees_paid_dollars?: string
}

export interface KalshiPortfolioPositionsResponse {
  cursor?: string | null
  market_positions: KalshiMarketPositionItem[]
  event_positions: KalshiEventPositionItem[]
}

export type KalshiSettlementMarketResult = "yes" | "no" | "scalar" | "void"

export interface KalshiSettlementItem {
  ticker: string
  market_result: KalshiSettlementMarketResult
  yes_count: number
  yes_total_cost: number
  no_count: number
  no_total_cost: number
  revenue: number
  settled_time: string
  value: number | null
}

export interface KalshiSettlementsResponse {
  cursor?: string | null
  settlements: KalshiSettlementItem[]
}

export type KalshiFillSide = "yes" | "no"
export type KalshiFillAction = "buy" | "sell"

export interface KalshiFillItem {
  fill_id: string
  trade_id?: string
  order_id?: string
  client_order_id?: string
  ticker: string
  side: KalshiFillSide
  action: KalshiFillAction
  count: number
  price?: number
  yes_price?: number
  no_price?: number
  yes_price_fixed?: string
  no_price_fixed?: string
  is_taker?: boolean
  created_time: string
  ts?: number
}

export interface KalshiFillsResponse {
  cursor?: string | null
  fills: KalshiFillItem[]
}

// Market detail types
export interface KalshiMarketResponse {
  market: KalshiMarket
}

export interface KalshiMarketLeg {
  event_ticker: string
  market_ticker: string
  side: string
}

export interface KalshiMarket {
  ticker: string
  event_ticker: string
  market_type: string
  title: string
  subtitle?: string
  yes_sub_title?: string
  no_sub_title?: string
  open_time?: string
  close_time?: string
  expected_expiration_time?: string
  expiration_time?: string
  latest_expiration_time?: string
  settlement_timer_seconds?: number
  status?: string
  response_price_units?: string
  yes_bid?: number
  yes_ask?: number
  no_bid?: number
  no_ask?: number
  last_price?: number
  volume?: number
  volume_24h?: number
  result?: string
  can_close_early?: boolean
  open_interest?: number
  notional_value?: number
  previous_yes_bid?: number
  previous_yes_ask?: number
  previous_price?: number
  liquidity?: number
  settlement_value?: number
  settlement_value_dollars?: string
  expiration_value?: string | null
  category?: string
  risk_limit_cents?: number
  fee_waiver_expiration_time?: string
  early_close_condition?: string
  tick_size?: number
  strike_type?: string
  floor_strike?: number
  cap_strike?: number
  functional_strike?: string
  rules_primary?: string
  rules_secondary?: string
  mve_collection_ticker?: string
  mve_selected_legs?: KalshiMarketLeg[]
  primary_participant_key?: string
  price_level_structure?: string
}

// Event types
export interface KalshiEventResponse {
  event: KalshiEvent
}

export interface KalshiEvent {
  ticker: string
  series_ticker: string
  title?: string
  subtitle?: string | null
  category?: string
}

// Candlesticks
export type KalshiCandlestickPeriodInterval = 1 | 60 | 1440

export interface KalshiCandlestickOHLC {
  open?: number
  open_dollars?: string
  low?: number
  low_dollars?: string
  high?: number
  high_dollars?: string
  close?: number
  close_dollars?: string
}

export interface KalshiCandlestickPrice extends KalshiCandlestickOHLC {
  mean?: number
  mean_dollars?: string
  previous?: number
  previous_dollars?: string
  min?: number
  min_dollars?: string
  max?: number
  max_dollars?: string
}

export interface KalshiCandlestickItem {
  end_period_ts: number
  yes_bid?: KalshiCandlestickOHLC
  yes_ask?: KalshiCandlestickOHLC
  price: KalshiCandlestickPrice
  volume?: number
  open_interest?: number
}

export interface KalshiCandlesticksResponse {
  ticker: string
  candlesticks: KalshiCandlestickItem[]
}
