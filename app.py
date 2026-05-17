from threading  import Timer
from flask import Flask,render_template,request,jsonify
import os 
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///messages.db" 
db = SQLAlchemy(app)

class Encryptedmessage(db.Model):
    id = db.Column(db.Integer(),primary_key= True)
    emessage = db.Column(db.String(),nullable = False)


def delete(id):
    with app.app_context():
        msg = db.session.get(Encryptedmessage , id)
        db.session.delete(msg)
        db.session.commit()
        print(f"cleaned after 5 second {id}")


@app.route('/',methods=['POST','GET'])
def index():
    
    
    return render_template('index.html')


@app.route('/decoder')
def decoder():
   
    return render_template('decoder.html')


@app.route('/secret',methods = ['POST'])
def secret():
    data= request.get_json()
    msg = data.get('message')

    emsg = Encryptedmessage(
        emessage = msg
    )

    try :
        db.session.add(emsg)
        db.session.commit()
        id = emsg.id
        Timer(5,delete,args=[emsg.id]).start() # sets timer 5 second and sends id to delete function 

    except Exception as e :
        print (e)
    
    return jsonify({
        "received":msg
    })


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=port,debug=True)