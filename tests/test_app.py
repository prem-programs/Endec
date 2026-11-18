import io
import cv2
import numpy as np
import pytest
from backend.app import app
from backend.db import db


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client


def create_dummy_image_bytes():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    success, buf = cv2.imencode('.png', img)
    return io.BytesIO(buf.tobytes())


def test_secret_flow(client):
    res = client.post('/secret', json={
        'message': 'test cipher',
        'expiry': 1,
        'burn': True,
        'has_password': False
    })
    assert res.status_code == 201
    data = res.get_json()
    uid = data['id']

    # Get secret
    res_get = client.get(f'/api/secret/{uid}')
    assert res_get.status_code == 200
    assert res_get.get_json()['emessage'] == 'test cipher'

    # Burn secret
    res_burn = client.post(f'/api/secret/{uid}/burn')
    assert res_burn.status_code == 200

    # Get burned secret
    res_get2 = client.get(f'/api/secret/{uid}')
    assert res_get2.status_code == 404


def test_stegano_end_to_end(client):
    img_io = create_dummy_image_bytes()

    # 1. Encode secret into carrier image
    res = client.post('/api/steg/enc', data={
        'message': 'super-secret-text',
        'image': (img_io, 'carrier.png'),
        'expiry': 1,
        'burn': True,
        'has_password': False
    }, content_type='multipart/form-data')

    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    uid = data['id']
    download_url = data['download_url']

    # 2. Download encoded image
    res_download = client.get(download_url)
    assert res_download.status_code == 200
    assert res_download.content_type == 'image/png'
    encoded_png_bytes = res_download.data

    # 3. Decode secret from the encoded image
    encoded_io = io.BytesIO(encoded_png_bytes)
    res_dec = client.post('/api/steg/dec', data={
        'image': (encoded_io, 'encoded.png')
    }, content_type='multipart/form-data')

    assert res_dec.status_code == 200
    dec_data = res_dec.get_json()
    assert dec_data['success'] is True
    assert dec_data['uid'] == uid
    assert dec_data['secret']['emessage'] == 'super-secret-text'
    assert dec_data['secret']['burn_after_reading'] is True

    # 4. Burn secret and check cleanup of image
    res_burn = client.post(f'/api/secret/{uid}/burn')
    assert res_burn.status_code == 200

    # Image download should now fail (404)
    res_download_after_burn = client.get(download_url)
    assert res_download_after_burn.status_code == 404
    
def test_index_page_structure_and_no_cache(client):
    res = client.get('/')
    assert res.status_code == 200
    html = res.data.decode('utf-8')
    # Verify no file tab in tabs
    assert 'data-tab="file"' not in html
    # Verify contenteditable div instead of textarea for standard message
    assert '<textarea id="message"' not in html
    assert 'id="message"' in html
    assert 'id="attachBtn"' in html
    assert 'id="optionsContainer"' in html
    # Verify steganography cover card and message card exist
    assert 'id="stegCoverCard"' in html
    assert 'id="stegMessage"' in html
    assert 'id="loadSampleCoverBtn"' in html
    # Verify no-cache header
    assert 'no-store' in res.headers.get('Cache-Control', '')


def test_decoder_page_tabs_and_image_section(client):
    res = client.get('/decrypter')
    assert res.status_code == 200
    html = res.data.decode('utf-8')
    # Verify raw message textarea and message tabs are removed
    assert 'id="emessage"' not in html
    assert 'id="decTabCipher"' not in html
    # Verify image dropzone exists
    assert 'id="stegDecDropzone"' in html
    assert 'id="steg-decode-select"' in html



def test_stegano_validation_errors(client):
    # Missing message
    img_io = create_dummy_image_bytes()
    res = client.post('/api/steg/enc', data={
        'image': (img_io, 'carrier.png')
    }, content_type='multipart/form-data')
    assert res.status_code == 400

    # Missing image
    res = client.post('/api/steg/enc', data={
        'message': 'hello'
    }, content_type='multipart/form-data')
    assert res.status_code == 400

    # Decode without image
    res = client.post('/api/steg/dec', data={}, content_type='multipart/form-data')
    assert res.status_code == 400

    # Decode invalid image with no secret
    img_clean = create_dummy_image_bytes()
    res = client.post('/api/steg/dec', data={
        'image': (img_clean, 'clean.png')
    }, content_type='multipart/form-data')
    assert res.status_code == 400
