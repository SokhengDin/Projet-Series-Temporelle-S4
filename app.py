import matplotlib
matplotlib.use("Agg")

from flask import Flask, render_template, request, jsonify

from Dic_Aerospace import *
from Lib_Aerospace  import *

app = Flask("Projet Series Temporelle")


@app.route("/", methods=["GET", "POST"])
def Menu():
    return render_template("index.html", societes=Dic_Aerospace)

@app.route("/Menu_Liste", methods=["GET", "POST"])
def Menu_Liste():
    ticker = request.form.get("Aerospace")

    result      = analyse(ticker)
    plot_series = plot_series64(ticker)
    plot_ks     = plot_ks_scan64(ticker)
    plot_bp     = plot_breakpoint64(ticker)
    plot_fits   = plot_segment_fits64(ticker)

    return render_template(
        "Resultats.html",
        action          = ticker,
        url_Action      = result["url"],
        entreprise      = result["name"],
        k_hat           = result["k_hat"],
        bp_date         = result["bp_date"],
        D               = round(result["D"],      4),
        p_value         = result["p_value"],
        verdict         = result["verdict"],
        mu1             = round(result["mu1"],    4),
        sigma1          = round(result["sigma1"], 4),
        mu2             = round(result["mu2"],    4),
        sigma2          = round(result["sigma2"], 4),
        theta           = round(result["theta"],  4),
        n1              = result["n1"],
        n2              = result["n2"],
        interpretation  = result["interpretation"],
        plot_series     = plot_series,
        plot_ks         = plot_ks,
        plot_bp         = plot_bp,
        plot_fit_before = plot_fits["before"],
        plot_fit_after  = plot_fits["after"]
    )


@app.route("/results", methods=["POST"])
def get_results():
    ticker = request.json.get("ticker")
    return jsonify(analyse(ticker))


if __name__ == "__main__":
    import webbrowser
    webbrowser.open("http://127.0.0.1:8000/")
    app.run(debug=True, port=8000, use_reloader=False, threaded=True)
