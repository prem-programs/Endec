from operator import truediv
from flask import debughelpers
from flask import Flask, render_template, url_for, request
from cryptography.fernet import Fernet
import os 
import base64

# key handeling
env_key = os.environ.get("FERNET_KEY")
if env_key:
    key = base64.b64decode(env_key)
else:
    if os.path.exists("secret.bin"):
        with open("secret.bin",'rb') as f:
            key=f.read()
    else:
        key = Fernet.generate_key()
        with open("secred.bin","wb")as f:
            f.write(key)

fernet=Fernet(key)
app = Flask(__name__)

@app.route('/',methods=['POST','GET'])
def index():
    message=""
    encryptedMessage=None
    if request.method == 'POST':
        try:
            message = request.form.get('message','')
            encryptedMessage = fernet.encrypt(message.encode()).decode()
        except Exception as e:
            encryptedMessage = f"Error: {e}"
    
    return render_template('index.html',name=encryptedMessage)


@app.route('/decoder',methods=['POST','GET'])
def decoder():
    Emessage =""
    decryptedMessage=None

    if request.method == 'POST':
        Emessage = request.form.get('message','').strip()
        
        try:
            decryptedMessage = fernet.decrypt(Emessage.encode()).decode()
        except Exception as e:
            decryptedMessage = f"Error: {e}"

    return render_template('decoder.html',name=decryptedMessage)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port,debug=True)