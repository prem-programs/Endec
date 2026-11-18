import os
import cv2
import numpy as np


def text_to_bits(message):
    """Convert UTF-8 text into a sequence of bits."""
    data = message.encode("utf-8")
    return np.unpackbits(np.frombuffer(data, dtype=np.uint8))


def bits_to_text(bits):
    """Convert a sequence of bits back into UTF-8 text."""
    data = np.packbits(bits).tobytes()
    return data.decode("utf-8")


def _load_image(image_input):
    """Load an image from filepath, raw bytes, file-like stream, or numpy array."""
    if isinstance(image_input, np.ndarray):
        return image_input

    if isinstance(image_input, (bytes, bytearray)):
        arr = np.frombuffer(image_input, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from provided bytes.")
        return img

    if hasattr(image_input, "read"):
        content = image_input.read()
        if hasattr(image_input, "seek"):
            image_input.seek(0)
        arr = np.frombuffer(content, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from stream.")
        return img

    if hasattr(image_input, "stream") and hasattr(image_input.stream, "read"):
        content = image_input.stream.read()
        if hasattr(image_input.stream, "seek"):
            image_input.stream.seek(0)
        arr = np.frombuffer(content, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from FileStorage stream.")
        return img

    if isinstance(image_input, (str, os.PathLike)):
        img = cv2.imread(str(image_input), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Could not load image from path: {image_input}")
        return img

    raise TypeError(f"Unsupported image input type: {type(image_input)}")


def encode_message(image_input, message, output_path="encoded.png"):
    """
    Embeds a secret UTF-8 message into the least significant bits of an image.
    Supports in-memory image input or file path.
    """
    image = _load_image(image_input)
    image = image.copy()

    # Convert message to bytes, then bits
    message_bytes = message.encode("utf-8")

    # Store message length as a 32-bit unsigned integer
    length_header = len(message_bytes).to_bytes(4, "big")
    header_bits = np.unpackbits(
        np.frombuffer(length_header, dtype=np.uint8)
    )
    message_bits = text_to_bits(message)

    # Combine header and message
    payload = np.concatenate((header_bits, message_bits))

    # Each image channel stores one bit
    pixels = image.reshape(-1)

    if len(payload) > len(pixels):
        max_bytes = max(0, (len(pixels) - 32) // 8)
        raise ValueError(
            f"Message too large. Approximate maximum: {max_bytes} bytes."
        )

    # Replace the least significant bit of each channel
    pixels[:len(payload)] = (
        (pixels[:len(payload)] & 254) | payload
    )

    if output_path:
        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        success = cv2.imwrite(output_path, image)
        if not success:
            raise IOError(f"Could not save output image to {output_path}")

    return image


def encode_message_to_bytes(image_input, message):
    """Encodes a message into the image and returns PNG formatted bytes."""
    encoded_img = encode_message(image_input, message, output_path=None)
    success, buffer = cv2.imencode('.png', encoded_img)
    if not success:
        raise IOError("Could not encode image into PNG buffer.")
    return buffer.tobytes()


def decode_message(image_input):
    """
    Extracts a hidden UTF-8 message from the least significant bits of an image.
    """
    image = _load_image(image_input)
    pixels = image.reshape(-1)

    # Extract the 32-bit length header
    if len(pixels) < 32:
        raise ValueError("Image is too small to contain a secret.")

    header_bits = pixels[:32] & 1
    header_bytes = np.packbits(header_bits).tobytes()
    message_length = int.from_bytes(header_bytes, "big")

    if message_length <= 0:
        raise ValueError("No valid secret message found in this image.")

    # Validate the claimed message length
    required_bits = 32 + message_length * 8

    if required_bits > len(pixels):
        raise ValueError(
            "No valid message found, or image was modified."
        )

    # Extract the message bits
    message_bits = pixels[32:required_bits] & 1

    # Decode the original UTF-8 message
    try:
        message = bits_to_text(message_bits)
    except UnicodeDecodeError as error:
        raise ValueError(
            "Message could not be decoded. "
            "The image may not contain a valid message."
        ) from error

    return message
