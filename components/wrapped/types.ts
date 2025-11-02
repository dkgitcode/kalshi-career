export type PricePoint = { ts: number; price: number }

export type TradeMarkers = {
  buy_ts: number
  buy_price: number
  sell_ts?: number
  sell_price?: number
  settled_ts?: number
  settled_price?: number
}

export type WrappedSlide =
  | { type: "biggest_win"; pct: number; realized_pnl_cents: number; trade: any; series: PricePoint[]; markers: TradeMarkers }
  | { type: "biggest_loss"; loss_cents: number; realized_pnl_cents: number; trade: any; series: PricePoint[]; markers: TradeMarkers }
  | { type: "biggest_longshot"; buy_price: number; pct: number; trade: any; series: PricePoint[]; markers: TradeMarkers }
  | { type: "favorite_genre"; category: string; count: number }
  | {
      type: "missed_opportunity"
      trade: any
      best_after_sell_price: number
      best_after_sell_ts: number
      potential_gain_cents: number
      series: PricePoint[]
      markers: TradeMarkers
    }
  | {
      type: "totals"
      total_volume: number
      total_realized_pnl_cents: number
      favorite_category?: string
      favorite_count?: number
      biggest_win_pnl_cents?: number
      biggest_loss_cents?: number
      win_rate_pct?: number
      wins?: number
      total_trades?: number
      first_trade_ts?: number
    }


