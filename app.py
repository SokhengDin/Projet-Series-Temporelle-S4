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
    return render_template("Resultats.html", ticker=ticker, name=Dic_Aerospace.get(ticker, ticker))


@app.route("/results", methods=["POST"])
def get_results():
    ticker = request.json.get("ticker")
    return jsonify(analyse(ticker))


if __name__ == "__main__":
    import webbrowser
    webbrowser.open("http://127.0.0.1:8000/")
    app.run(debug=True, port=8000, use_reloader=False, threaded=True)
