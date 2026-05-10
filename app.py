from operator import truediv
from flask import debughelpers,Flask,render_template
import os 

app = Flask(__name__)

@app.route('/',methods=['POST','GET'])
def index():
    
    
    return render_template('index.html')


@app.route('/decoder')
def decoder():
   
    return render_template('decoder.html')

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port,debug=True)