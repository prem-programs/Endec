from flask import render_template, request, jsonify
from backend.db import db, Encryptedmessage, app
from threading import Timer

@app.route('/', methods=['POST', 'GET'])
def index():
    return render_template('index.html')


@app.route('/decoder')
def decoder():
    return render_template('decoder.html')

def del_message(uid):
    msg_to_delete = db.session.get(Encryptedmessage, uid)
    if msg_to_delete:
        db.session.delete(msg_to_delete)
        db.session.commit()
        return jsonify({"message": "Message deleted"}), 200
    return jsonify({"message": "Not found"}), 404

@app.route('/secret', methods=['POST'])
def secret():
    data = request.get_json(silent=True)
    
    if not data or not data.get('message'):
        return jsonify({"message": "No message found!"}), 404
    

    msg = data.get('message')
    exp =data.get('expiry')
    print(exp)
    emsg = Encryptedmessage(
        emessage=msg
    )

    message_id = None
    try:
        db.session.add(emsg)
        db.session.commit()
        message_id = emsg.id
        if exp :
            Timer(int(exp)*3600 ,del_message , args=message_id).start()
            
    

    except Exception as e:
        db.session.rollback()
        print(e)
    
    return jsonify({
        "received": msg,
        "id": message_id
    })


@app.route('/api/secret/<int:uid>',methods=['GET'])
def get_secret(uid):
    enc_message = db.session.get(Encryptedmessage,uid)

    if not enc_message:
        return jsonify({
            "message":"Message can't retrieve"
        }),404
    else:

        return jsonify ({
            "emessage":enc_message.emessage,
            "id":uid
        })
    
@app.route('/api/del/<int:uid>',methods=['DELETE'])
def cleanup(uid):
    msg_to_delete = db.session.get(Encryptedmessage, uid)
    if msg_to_delete:
        db.session.delete(msg_to_delete)
        db.session.commit()
        return jsonify({"message": "Message deleted"}), 200
    return jsonify({"message": "Not found"}), 404