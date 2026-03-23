from flask import Flask, request, jsonify

app = Flask("Projet Series Temporlle")

# TODO: Update no mock
@app.route("/", methods=["GET"])
def hello_world():
    return "<p>Hello, World!</p>"

# TODO: Update no mock
@app.route("/results", methods=["POST"])
def get_results(**kwargs):
    return "Get Returns"

# TODO: Update no mock
@app.route("/plot", methods=["POST"])
def get_plot(**kwargs):
    return "Plot"


if __name__ == "__main__":
    app.run(debug=True, port=8000)