START_DATE = "2023-01-04"
DATA_DIR   = "./data/Secteur_Aerospace"

# Dataload
def load_series(ticker):
    import os
    import pandas as pd

    path = os.path.join(DATA_DIR, f"{ticker}.csv")
    df   = pd.read_csv(path)[["Date", "Adj Close"]].copy()
    df.columns = ["Date", "X_t"]
    df["Date"]  = pd.to_datetime(df["Date"])
    df = (df[df["Date"] >= pd.Timestamp(START_DATE)]
            .sort_values("Date")
            .dropna()
            .reset_index(drop=True))
    return df


def hanning_filter(df):
    df        = df.copy()
    df["Y_t"] = (  0.25 * df["X_t"].shift(1)
                 + 0.50 * df["X_t"]
                 + 0.25 * df["X_t"].shift(-1))
    return df.dropna().reset_index(drop=True)


# KS Scan
def ks_scan(series, margin=30):
    import numpy as np
    from scipy.stats import ks_2samp

    n       = len(series)
    results = [
        (k, *ks_2samp(series[:k], series[k:]))
        for k in range(margin, n - margin + 1)
    ]
    k_values, stats, pvals = zip(*results)
    best = int(np.argmax(stats))

    return { "k_values" : list(k_values)
           , "ks_stats" : list(stats)
           , "p_values" : list(pvals)
           , "k_hat"    : k_values[best]
           , "D"        : float(stats[best])
           , "p_value"  : float(pvals[best])
           }


# Skew-Normal MLE
def skew_normal_pdf(x, mu, sigma, theta):
    from scipy.stats import norm

    z = (x - mu) / sigma
    return (2.0 / sigma) * norm.pdf(z) * norm.cdf(theta * z)

# Fit skews
def fit_skew_normal(y1, y2):
    import numpy as np
    from scipy.optimize import minimize

    def _neg_loglik(params):
        mu1, log_s1, mu2, log_s2, theta = params
        s1, s2 = np.exp(log_s1), np.exp(log_s2)
        if s1 <= 0 or s2 <= 0 or not np.isfinite(theta):
            return np.inf
        eps = 1e-12
        ll  = (  np.sum(np.log(np.clip(skew_normal_pdf(y1, mu1, s1, theta), eps, None)))
               + np.sum(np.log(np.clip(skew_normal_pdf(y2, mu2, s2, theta), eps, None))))
        return -ll

    s1_init = max(float(np.std(y1, ddof=0)), 1e-3)
    s2_init = max(float(np.std(y2, ddof=0)), 1e-3)
    x0  = np.array([np.mean(y1), np.log(s1_init),
                    np.mean(y2), np.log(s2_init), 0.0])
    res = minimize(_neg_loglik, x0=x0, method="L-BFGS-B")

    mu1, log_s1, mu2, log_s2, theta = res.x
    return { "mu1"    : float(mu1)
           , "sigma1" : float(np.exp(log_s1))
           , "mu2"    : float(mu2)
           , "sigma2" : float(np.exp(log_s2))
           , "theta"  : float(theta)
           , "neg_ll" : float(res.fun)
           }


# run analyze
def analyse(ticker):
    import numpy as np
    from Dic_Aerospace import Dic_Aerospace

    name    = Dic_Aerospace.get(ticker, ticker)
    raw_df  = load_series(ticker)
    df      = hanning_filter(raw_df)
    Y       = df["Y_t"].to_numpy()

    scan       = ks_scan(Y)
    k_hat      = scan["k_hat"]
    break_date = df.loc[k_hat, "Date"]
    verdict    = "Reject H0" if scan["p_value"] < 0.05 else "Fail to reject H0"
    mle        = fit_skew_normal(Y[:k_hat], Y[k_hat:])

    interpretation = (
        f"For {ticker}, the estimated rupture point is k_hat = {k_hat} "
        f"({break_date.date()}). The KS statistic is {scan['D']:.4f} and the "
        f"p-value is {scan['p_value']:.4e}, so the decision is: {verdict}. "
        f"The joint MLE estimates are mu1 = {mle['mu1']:.4f}, "
        f"sigma1 = {mle['sigma1']:.4f}, mu2 = {mle['mu2']:.4f}, "
        f"sigma2 = {mle['sigma2']:.4f}, theta = {mle['theta']:.4f}."
    )

    # pdf grids for both segments
    y1, y2 = Y[:k_hat], Y[k_hat:]
    xg1    = np.linspace(y1.min(), y1.max(), 400)
    xg2    = np.linspace(y2.min(), y2.max(), 400)

    chart_data = { "dates"   : raw_df["Date"].dt.strftime("%Y-%m-%d").tolist()
                 , "prices"  : raw_df["X_t"].tolist()
                 , "sm_dates": df["Date"].dt.strftime("%Y-%m-%d").tolist()
                 , "smoothed": df["Y_t"].tolist()
                 , "Y_dates" : df["Date"].dt.strftime("%Y-%m-%d").tolist()
                 , "Y"       : Y.tolist()
                 , "xg1"     : xg1.tolist()
                 , "pdf1"    : skew_normal_pdf(xg1, mle["mu1"], mle["sigma1"], mle["theta"]).tolist()
                 , "xg2"     : xg2.tolist()
                 , "pdf2"    : skew_normal_pdf(xg2, mle["mu2"], mle["sigma2"], mle["theta"]).tolist()
                 , "scan_k"  : scan["k_values"]
                 , "scan_D"  : scan["ks_stats"]
                 , "scan_p"  : scan["p_values"]
                 }

    return { "company"        : ticker
           , "name"           : name
           , "url"            : f"https://fr.finance.yahoo.com/quote/{ticker}/profile"
           , "k_hat"          : k_hat
           , "bp_date"        : str(break_date.date())
           , "D"              : scan["D"]
           , "p_value"        : scan["p_value"]
           , "reject_H0"      : scan["p_value"] < 0.05
           , "verdict"        : verdict
           , **mle
           , "n1"             : k_hat
           , "n2"             : len(Y) - k_hat
           , "interpretation" : interpretation
           , "chart_data"     : chart_data
           }


# plot as base64

def _fig_to_b64(fig, tmp="tmp_plot.png"):
    import os
    from base64 import b64encode
    import matplotlib.pyplot as plt

    fig.savefig(tmp, bbox_inches="tight")
    plt.close(fig)
    with open(tmp, "rb") as f:
        b64 = b64encode(f.read()).decode()
    os.remove(tmp)
    return b64


def plot_series64(ticker):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df = hanning_filter(load_series(ticker))
    fig, axes = plt.subplots(2, 1, figsize=(10, 8))
    for ax, col, title in zip(axes,
                               ["X_t",       "Y_t"],
                               ["Raw Series", "Hanning Filtered"]):
        ax.plot(df["Date"], df[col])
        ax.set_title(f"{title} – {ticker}")
        ax.set_xlabel("Date")
        ax.set_ylabel(col)
        ax.tick_params(axis="x", rotation=45)
        for side in ["right", "top"]:
            ax.spines[side].set_visible(False)
    fig.tight_layout()
    return _fig_to_b64(fig)


def plot_ks_scan64(ticker):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df   = hanning_filter(load_series(ticker))
    scan = ks_scan(df["Y_t"].to_numpy())

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(scan["k_values"], scan["ks_stats"])
    ax.axvline(scan["k_hat"], linestyle="--", color="red",
               label=f"k_hat = {scan['k_hat']}")
    ax.set_title(f"KS Statistic Scan – {ticker}")
    ax.set_xlabel("Candidate k")
    ax.set_ylabel("KS statistic")
    ax.legend()
    for side in ["right", "top"]:
        ax.spines[side].set_visible(False)
    fig.tight_layout()
    return _fig_to_b64(fig)


def plot_breakpoint64(ticker):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df   = hanning_filter(load_series(ticker))
    Y    = df["Y_t"].to_numpy()
    scan = ks_scan(Y)
    k    = scan["k_hat"]
    date = df.loc[k, "Date"]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(df["Date"], df["Y_t"], label="Filtered series", color="steelblue")
    ax.axvline(date, linestyle="--", color="red", label=f"k_hat = {k}")
    ax.set_title(f"Breakpoint Detection – {ticker}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Y_t")
    ax.tick_params(axis="x", rotation=45)
    ax.legend()
    for side in ["right", "top"]:
        ax.spines[side].set_visible(False)
    fig.tight_layout()
    return _fig_to_b64(fig)


def plot_segment_fits64(ticker):
    import numpy as np
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df   = hanning_filter(load_series(ticker))
    Y    = df["Y_t"].to_numpy()
    scan = ks_scan(Y)
    k    = scan["k_hat"]
    mle  = fit_skew_normal(Y[:k], Y[k:])

    plots = {}
    for segment, y, mu, sigma, label in [
        ("before", Y[:k], mle["mu1"], mle["sigma1"], "Before rupture"),
        ("after",  Y[k:], mle["mu2"], mle["sigma2"], "After rupture"),
    ]:
        x_grid = np.linspace(y.min(), y.max(), 400)
        pdf    = skew_normal_pdf(x_grid, mu, sigma, mle["theta"])
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.hist(y, bins=12, density=True, alpha=0.6)
        ax.plot(x_grid, pdf, linewidth=2)
        ax.set_title(f"{ticker} – {label} fit")
        ax.set_xlabel("Y_t")
        ax.set_ylabel("Density")
        for side in ["right", "top"]:
            ax.spines[side].set_visible(False)
        fig.tight_layout()
        plots[segment] = _fig_to_b64(fig)
    return plots
