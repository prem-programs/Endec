from flask import Flask
from threading import Timer
import time

app = Flask(__name__)


@app.route('/')
def home():
    return "server running"

from threading import Timer


@app.route('/test')
def test():

    print("request received")

    Timer(2, cleanup)

    return "started"


def cleanup():

    print("cleanup executed after 10 sec")


test()

if __name__ == "__main__":
    app.run(debug=True)