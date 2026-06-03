from flask import Flask,render_template,request,jsonify
import os 
from backend.db import db , Encryptedmessage,app



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

    if not msg:
        return jsonify({"message":"No message found!"}),404

    emsg = Encryptedmessage(
        emessage = msg
    )

    id = None
    try :
        db.session.add(emsg)
        db.session.commit()
        id = emsg.id
        # Timer(20,delete,args=[emsg.id]).start() # sets timer 5 second and sends id to delete function 

    except Exception as e :
        db.session.rollback()
        print (e)
    
    return jsonify({
        "received":msg,
            "id":id

    })


@app.route('/api/secret/<int:uid>',methods=['GET'])
def get_secret(uid):
    enc_message = db.session.get(Encryptedmessage,uid)

    if not enc_message:
        return jsonify({
            "message":"Message can't retrieve"
        }),404

    return jsonify ({
        "emessage":enc_message.emessage,
        "id":uid
    })