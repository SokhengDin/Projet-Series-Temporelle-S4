# Structural Break Detection in the Aerospace Sector

**Modélisation Statistique — Séries Temporelles**
**ENSIIE Paris-Évry · Master 1 · 2026**

---

## Group 2 — Members

| Role | Name |
|------|------|
| Coordinator | SEK Sopheak Voatei |
| Member | THONG Ousaphea |
| Member | WANG Alicia |
| Member | RA Veasna |
| Member | KOUM Soknan |
| Member | DIN Sokheng |

---

## Project Overview

This project detects **structural breaks** (regime changes) in the daily adjusted closing prices of **10 major aerospace & defence companies** using a combination of:

1. **Hanning filter** — smooths the raw price series
2. **KS scan** — finds the most likely breakpoint nonparametrically
3. **Skew-Normal MLE** — fits a distribution to each regime
4. **Flask web app** — interactive dashboard to explore results

### Companies Analysed

| Ticker | Company |
|--------|---------|
| AIR.PA | Airbus SE |
| AM.PA  | Dassault Aviation |
| BA     | The Boeing Company |
| BAESY  | BAE Systems plc |
| BDRAF  | Bombardier Inc. |
| GD     | General Dynamics Corporation |
| HON    | Honeywell International Inc. |
| LMT    | Lockheed Martin Corporation |
| NOC    | Northrop Grumman Corporation |
| RTX    | RTX Corporation |

---

## Methodology

### 1. Hanning Filter

Raw prices $X_t$ are smoothed to reduce micro-structure noise:

$$Y_t = \frac{1}{4} X_{t-1} + \frac{1}{2} X_t + \frac{1}{4} X_{t+1}$$

### 2. Breakpoint Model

The filtered series follows a piecewise Skew-Normal model with unknown breakpoint $k$:

$$Y_t \sim \begin{cases} \mathrm{SN}(\mu_1, \sigma_1, \theta) & \text{if } t \leq k \\ \mathrm{SN}(\mu_2, \sigma_2, \theta) & \text{if } t > k \end{cases}$$

where the Skew-Normal density is:

$$f(y;\, \mu, \sigma, \theta) = \frac{2}{\sigma}\, \varphi\!\left(\frac{y - \mu}{\sigma}\right) \Phi\!\left(\theta \cdot \frac{y - \mu}{\sigma}\right)$$

with $\varphi$ the standard Normal pdf and $\Phi$ the standard Normal cdf.

### 3. Breakpoint Estimation

The breakpoint is estimated by maximising the two-sample Kolmogorov–Smirnov statistic over all candidate positions:

$$\hat{k} = \arg\max_{k \in \{30,\ldots,n-30\}} D_{k,\, n-k}$$

where $D_{k,\,n-k} = \sup_x |\hat{F}_1(x) - \hat{F}_2(x)|$.

### 4. Hypothesis Test (KS homogeneity)

- **H₀**: no break — both segments follow the same distribution
- **H₁**: break exists — segments follow different distributions
- Significance level: $\alpha = 0.05$

### 5. MLE Estimation

Parameters $(\mu_1, \sigma_1, \mu_2, \sigma_2, \theta)$ are estimated jointly by maximising the log-likelihood:

$$\ell = \sum_{t=1}^{\hat{k}} \log f(Y_t;\, \mu_1, \sigma_1, \theta) + \sum_{t=\hat{k}+1}^{n} \log f(Y_t;\, \mu_2, \sigma_2, \theta)$$

via the **L-BFGS-B** numerical optimiser.

---

## Project Structure

```
.
├── app.py                  # Flask web application
├── Lib_Aerospace.py        # Core library (filter, KS scan, MLE, plots)
├── Dic_Aerospace.py        # Ticker → company name dictionary
├── data/
│   └── Secteur_Aerospace/  # CSV price data (one file per ticker)
├── results/
│   ├── json/               # Cached analysis results
│   └── notebook/           # Member Jupyter notebooks
├── report/
│   ├── report.tex          # LaTeX report
│   ├── generate_figures.py # Script to generate all report figures
│   └── figures/            # Output PNGs (generated)
├── static/                 # CSS / JS for the web app
├── templates/              # HTML templates
└── pyproject.toml
```

---

## Installation

### Requirements

- Python ≥ 3.12
- [uv](https://github.com/astral-sh/uv) (recommended) or pip

### With uv (recommended)

```bash
# Clone the repo
git clone https://github.com/SokhengDin/Projet-Series-Temporelle-S4.git
cd Projet-Series-Temporelle-S4

# Create environment and install dependencies
uv sync
```

### With pip

```bash
pip install flask matplotlib numpy pandas scipy statsmodels
```

---

## Running the Web App

```bash
# With uv
uv run python app.py

# Or with plain Python
python app.py
```

The app opens automatically at [http://127.0.0.1:8000](http://127.0.0.1:8000).

Select a company from the dropdown to see:
- Raw and Hanning-filtered price series
- KS scan with estimated breakpoint
- Regime histograms with fitted Skew-Normal densities
- MLE parameter estimates and test verdict

---

## Results Summary

The KS test **rejects H₀ for all 10 companies** at the 5% level. Every stock underwent at least one distributional regime change since January 2023, with higher mean prices and increased dispersion in the post-break regime.

| Ticker | Break date  | KS stat | Decision     |
|--------|-------------|---------|--------------|
| AIR.PA | 2025-06-24  | 1.0000  | Reject H₀   |
| AM.PA  | 2025-01-21  | 1.0000  | Reject H₀   |
| BA     | 2025-12-15  | 0.6436  | Reject H₀   |
| BAESY  | 2023-02-17  | 1.0000  | Reject H₀   |
| BDRAF  | 2024-05-15  | 1.0000  | Reject H₀   |
| GD     | 2023-11-13  | 1.0000  | Reject H₀   |
| HON    | 2024-06-04  | 0.8634  | Reject H₀   |
| LMT    | 2025-12-11  | 0.7935  | Reject H₀   |
| NOC    | 2025-07-22  | 1.0000  | Reject H₀   |
| RTX    | 2024-07-25  | 1.0000  | Reject H₀   |

---

If you encounter any issues running the application, feel free to contact soknan.koum@ensiie.eu,  veasna.ra@ensiie.eu and sokheng.din@ensiie.eu