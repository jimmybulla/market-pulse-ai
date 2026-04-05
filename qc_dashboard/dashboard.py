# qc_dashboard/dashboard.py
"""
QC Signal Dashboard — Streamlit UI

Layout order:
  1. CSS (dark terminal theme)
  2. Sidebar (filters + controls)
  3. Header row
  4. Metrics row (6 cards)
  5. Equity curve chart
  6. Two-column row: top picks cards | sector bar chart
  7. Signal table (search + sort + colour-coded)
  8. RSI vs Momentum scatter
  9. Footer
"""

from datetime import datetime

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from dotenv import load_dotenv

from qc_client import (
    fetch_equity_curve,
    fetch_signals,
    fetch_stats,
    fetch_top_picks,
    is_live,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Page config — must be first Streamlit call
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="QC Signal Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# 1. CSS — dark terminal theme
# ---------------------------------------------------------------------------
st.markdown("""
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

  html, body, [class*="css"] {
    font-family: 'IBM Plex Sans', sans-serif;
    background-color: #0d1117;
    color: #e6edf3;
  }
  .stApp { background-color: #0d1117; }

  /* Cards / surfaces */
  .metric-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 16px 20px;
  }
  .metric-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8b949e;
    border-bottom: 1px solid #21262d;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .metric-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 26px;
    font-weight: 600;
    color: #e6edf3;
  }
  .metric-positive { color: #3fb950; }
  .metric-negative { color: #f85149; }
  .metric-neutral  { color: #58a6ff; }

  /* Section headers */
  .section-header {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8b949e;
    border-bottom: 1px solid #21262d;
    padding-bottom: 6px;
    margin-bottom: 16px;
  }

  /* Pick cards */
  .pick-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-left: 3px solid #3fb950;
    border-radius: 6px;
    padding: 14px 16px;
    margin-bottom: 10px;
  }
  .pick-ticker {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 15px;
    font-weight: 600;
    color: #e6edf3;
  }
  .pick-sector {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8b949e;
    margin-bottom: 10px;
  }
  .pick-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
  }
  .pick-grid-label { color: #8b949e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .pick-grid-val   { color: #e6edf3; font-weight: 500; }
  .pick-upside     { color: #3fb950; font-size: 13px; font-weight: 600; }

  /* Badge */
  .badge-live { background: #3fb950; color: #0d1117; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
  .badge-demo { background: #d29922; color: #0d1117; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; }

  /* Hide Streamlit chrome */
  #MainMenu { visibility: hidden; }
  footer     { visibility: hidden; }
  header     { visibility: hidden; }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Plotly layout defaults
# ---------------------------------------------------------------------------
_PLOT_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="#0d1117",
    font=dict(family="IBM Plex Mono, monospace", color="#8b949e", size=11),
    margin=dict(l=0, r=0, t=24, b=0),
    legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="#21262d", borderwidth=1),
)
_GRID = dict(gridcolor="#21262d", zerolinecolor="#21262d")


# ---------------------------------------------------------------------------
# Cached data fetchers
# ---------------------------------------------------------------------------
@st.cache_data(ttl=300)
def _signals() -> pd.DataFrame:
    return fetch_signals()


@st.cache_data(ttl=300)
def _equity(days: int) -> pd.DataFrame:
    return fetch_equity_curve(days)


@st.cache_data(ttl=300)
def _stats() -> dict:
    return fetch_stats()


@st.cache_data(ttl=300)
def _picks() -> list[dict]:
    return fetch_top_picks()


# ---------------------------------------------------------------------------
# 2. Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    live = is_live()
    badge = '<span class="badge-live">● LIVE</span>' if live else '<span class="badge-demo">◌ DEMO</span>'
    st.markdown(badge, unsafe_allow_html=True)
    st.markdown("---")

    strategy_label = st.text_input("Strategy name", value="Alpha Signal Strategy")

    period_options = {"1 Month": 21, "3 Months": 63, "6 Months": 126, "1 Year": 252, "2 Years": 504}
    period_label = st.selectbox("Backtest period", list(period_options.keys()), index=3)
    period_days = period_options[period_label]

    st.markdown("---")
    st.markdown('<p class="metric-label">Signal Filters</p>', unsafe_allow_html=True)

    min_score = st.slider("Min score", 0, 90, 0, step=5)
    all_sectors = sorted(_signals()["Sector"].unique().tolist())
    selected_sectors = st.multiselect("Sectors", all_sectors, default=all_sectors)
    ma_options = ["All", "Bullish", "Bearish", "Neutral"]
    ma_filter = st.selectbox("MA signal", ma_options)

    st.markdown("---")
    if st.button("⟳ Refresh data"):
        st.cache_data.clear()
        st.rerun()

# ---------------------------------------------------------------------------
# Load data (sidebar filters already set)
# ---------------------------------------------------------------------------
raw_df = _signals()
stats = _stats()
equity_df = _equity(period_days)
top_picks = _picks()

# Apply filters
df = raw_df[raw_df["Score"] >= min_score]
if selected_sectors:
    df = df[df["Sector"].isin(selected_sectors)]
if ma_filter != "All":
    df = df[df["MA Signal"] == ma_filter]

# ---------------------------------------------------------------------------
# 3. Header row
# ---------------------------------------------------------------------------
h1, h2 = st.columns([3, 1])
with h1:
    st.markdown(f"### {strategy_label}")
with h2:
    st.markdown(
        f'<p style="text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#8b949e;">'
        f'Updated {datetime.utcnow().strftime("%H:%M UTC")}</p>',
        unsafe_allow_html=True,
    )

# ---------------------------------------------------------------------------
# 4. Metrics row
# ---------------------------------------------------------------------------
def _pct(val: float, positive_good: bool = True) -> str:
    cls = "metric-positive" if (val >= 0) == positive_good else "metric-negative"
    sign = "+" if val > 0 else ""
    return f'<span class="{cls}">{sign}{val:.1f}%</span>'


def _metric_card(label: str, value_html: str) -> str:
    return (
        f'<div class="metric-card">'
        f'<div class="metric-label">{label}</div>'
        f'<div class="metric-value">{value_html}</div>'
        f'</div>'
    )


m1, m2, m3, m4, m5, m6 = st.columns(6)
pairs = [
    (m1, "Total Return",  _pct(stats["total_return"])),
    (m2, "Sharpe Ratio",  f'<span class="metric-neutral">{stats["sharpe_ratio"]:.2f}</span>'),
    (m3, "Max Drawdown",  _pct(stats["max_drawdown"], positive_good=False)),
    (m4, "Win Rate",      f'<span class="metric-positive">{stats["win_rate"]:.1f}%</span>'),
    (m5, "Alpha",         _pct(stats["alpha"])),
    (m6, "Active Signals", f'<span class="metric-neutral">{len(df)}</span>'),
]
for col, label, val_html in pairs:
    with col:
        st.markdown(_metric_card(label, val_html), unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# 5. Equity curve
# ---------------------------------------------------------------------------
st.markdown('<div class="section-header">Equity Curve</div>', unsafe_allow_html=True)

fig_eq = go.Figure()
fig_eq.add_trace(go.Scatter(
    x=equity_df["Date"], y=equity_df["Strategy"],
    name="Strategy",
    line=dict(color="#3fb950", width=2),
    fill="tozeroy",
    fillcolor="rgba(63,185,80,0.07)",
))
fig_eq.add_trace(go.Scatter(
    x=equity_df["Date"], y=equity_df["Benchmark (SPY)"],
    name="Benchmark (SPY)",
    line=dict(color="#58a6ff", width=1.5, dash="dot"),
))
fig_eq.update_layout(**_PLOT_LAYOUT, height=280, xaxis=_GRID, yaxis={**_GRID, "tickprefix": "$"})
st.plotly_chart(fig_eq, use_container_width=True)

# ---------------------------------------------------------------------------
# 6. Two-column row: top picks | sector distribution
# ---------------------------------------------------------------------------
col_left, col_right = st.columns([2, 3])

with col_left:
    st.markdown('<div class="section-header">Top Picks</div>', unsafe_allow_html=True)
    if not top_picks:
        st.caption("No picks available.")
    for pick in top_picks:
        card_html = f"""
        <div class="pick-card">
          <div class="pick-ticker">{pick['ticker']}
            <span style="font-size:12px;color:#8b949e;margin-left:8px;">Score {pick['score']:.0f}</span>
          </div>
          <div class="pick-sector">{pick['sector']}</div>
          <div class="pick-grid">
            <div>
              <div class="pick-grid-label">Entry</div>
              <div class="pick-grid-val">${pick['entry']:.2f}</div>
            </div>
            <div>
              <div class="pick-grid-label">Target</div>
              <div class="pick-grid-val">${pick['target']:.2f}</div>
            </div>
            <div>
              <div class="pick-grid-label">Stop</div>
              <div class="pick-grid-val">${pick['stop']:.2f}</div>
            </div>
          </div>
          <div style="margin-top:10px;" class="pick-upside">↑ {pick['upside']:.1f}% upside</div>
        </div>
        """
        st.markdown(card_html, unsafe_allow_html=True)

with col_right:
    st.markdown('<div class="section-header">Sector Distribution</div>', unsafe_allow_html=True)
    sector_counts = df.groupby("Sector")["Score"].mean().sort_values()
    fig_sec = go.Figure(go.Bar(
        x=sector_counts.values,
        y=sector_counts.index,
        orientation="h",
        marker_color="#58a6ff",
        marker_line_width=0,
    ))
    fig_sec.update_layout(**_PLOT_LAYOUT, height=280, xaxis={**_GRID, "title": "Avg Score"}, yaxis=_GRID)
    st.plotly_chart(fig_sec, use_container_width=True)

st.markdown("<br>", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# 7. Signal table
# ---------------------------------------------------------------------------
st.markdown('<div class="section-header">Signal Table</div>', unsafe_allow_html=True)

t1, t2 = st.columns([3, 1])
with t1:
    search = st.text_input("Search ticker", placeholder="e.g. AAPL", label_visibility="collapsed")
with t2:
    sort_col = st.selectbox(
        "Sort by",
        ["Score", "RSI", "Momentum %", "Change %", "Vol Ratio"],
        label_visibility="collapsed",
    )

display_df = df.copy()
if search:
    display_df = display_df[display_df["Ticker"].str.upper().str.contains(search.upper())]
display_df = display_df.sort_values(sort_col, ascending=False, na_position="last")


def _colour_score(val):
    if pd.isna(val):
        return ""
    if val >= 70:
        return "color: #3fb950; font-weight: 600"
    if val >= 45:
        return "color: #d29922"
    return "color: #f85149"


def _colour_change(val):
    if pd.isna(val):
        return ""
    return "color: #3fb950" if val >= 0 else "color: #f85149"


def _colour_ma(val):
    if val == "Bullish":
        return "color: #3fb950"
    if val == "Bearish":
        return "color: #f85149"
    return "color: #d29922"


styled = (
    display_df.style
    .applymap(_colour_score, subset=["Score"])
    .applymap(_colour_change, subset=["Change %"])
    .applymap(_colour_ma, subset=["MA Signal"])
    .format({
        "Score":      "{:.1f}",
        "RSI":        lambda x: f"{x:.1f}" if pd.notna(x) else "—",
        "Momentum %": lambda x: f"{x:+.2f}%" if pd.notna(x) else "—",
        "Price":      "${:.2f}",
        "Change %":   "{:+.2f}%",
        "Vol Ratio":  lambda x: f"{x:.2f}x" if pd.notna(x) else "—",
    })
)

st.dataframe(styled, use_container_width=True, hide_index=True)

st.markdown("<br>", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# 8. RSI vs Momentum scatter
# ---------------------------------------------------------------------------
scatter_df = df.dropna(subset=["RSI", "Momentum %"])
if not scatter_df.empty:
    st.markdown('<div class="section-header">RSI vs Momentum</div>', unsafe_allow_html=True)

    fig_scatter = px.scatter(
        scatter_df,
        x="RSI",
        y="Momentum %",
        color="Score",
        size="Score",
        size_max=20,
        hover_data=["Ticker", "Sector", "MA Signal"],
        color_continuous_scale=[[0, "#f85149"], [0.5, "#d29922"], [1, "#3fb950"]],
    )
    fig_scatter.add_vline(x=30, line_dash="dash", line_color="#21262d", annotation_text="Oversold", annotation_font_color="#8b949e")
    fig_scatter.add_vline(x=70, line_dash="dash", line_color="#21262d", annotation_text="Overbought", annotation_font_color="#8b949e")
    fig_scatter.update_layout(
        **_PLOT_LAYOUT,
        height=340,
        xaxis={**_GRID, "title": "RSI", "range": [20, 80]},
        yaxis={**_GRID, "title": "Momentum %"},
        coloraxis_colorbar=dict(title="Score", tickfont=dict(color="#8b949e")),
    )
    st.plotly_chart(fig_scatter, use_container_width=True)

# ---------------------------------------------------------------------------
# 9. Footer
# ---------------------------------------------------------------------------
st.markdown("---")
st.caption(
    "This dashboard is for informational purposes only and does not constitute financial advice. "
    "Past performance is not indicative of future results. Demo data is generated locally and does not "
    "reflect real market conditions."
)
