
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


def encode_message(image_path, message, output_path="encoded.png"):
    # 1. Load the image
    image = cv2.imread(image_path, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not load the image. Check its path.")

    # 2. Convert message to bytes, then bits
    message_bytes = message.encode("utf-8")

    # Store message length as a 32-bit unsigned integer
    length_header = len(message_bytes).to_bytes(4, "big")
    header_bits = np.unpackbits(
        np.frombuffer(length_header, dtype=np.uint8)
    )
    message_bits = text_to_bits(message)

    # 3. Combine header and message
    payload = np.concatenate((header_bits, message_bits))

    # Each image channel stores one bit
    pixels = image.reshape(-1)

    if len(payload) > len(pixels):
        max_bytes = max(0, (len(pixels) - 32) // 8)
        raise ValueError(
            f"Message too large. Approximate maximum: "
            f"{max_bytes} bytes."
        )

    # 4. Replace the least significant bit of each channel
    pixels[:len(payload)] = (
        (pixels[:len(payload)] & 254) | payload
    )

    # 5. Save losslessly as PNG
    success = cv2.imwrite(output_path, image)

    if not success:
        raise IOError("Could not save the output image.")

    print(f"Message embedded successfully: {output_path}")


def decode_message(image_path):
    # 1. Load the encoded image
    image = cv2.imread(image_path, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not load the image.")

    pixels = image.reshape(-1)

    # 2. Extract the 32-bit length header
    if len(pixels) < 32:
        raise ValueError("Image is too small.")

    header_bits = pixels[:32] & 1
    header_bytes = np.packbits(header_bits).tobytes()
    message_length = int.from_bytes(header_bytes, "big")

    # 3. Validate the claimed message length
    required_bits = 32 + message_length * 8

    if required_bits > len(pixels):
        raise ValueError(
            "No valid message found, or image was modified."
        )

    # 4. Extract the message bits
    message_bits = pixels[32:required_bits] & 1

    # 5. Decode the original UTF-8 message
    try:
        message = bits_to_text(message_bits)
    except UnicodeDecodeError as error:
        raise ValueError(
            "Message could not be decoded. "
            "The image may not contain a valid message."
        ) from error

    return message


if __name__ == "__main__":
    print("IMAGE STEGANOGRAPHY TOOL")
    print("1. Hide a message")
    print("2. Extract a message")

    choice = input("Choose an option: ").strip()

    if choice == "1":
        image_path = input("Enter source image path: ").strip()
        message = input("Enter secret message: ")
        output_path = input(
            "Output PNG path [encoded.png]: "
        ).strip() or "encoded.png"

        encode_message(image_path, message, output_path)

    elif choice == "2":
        image_path = input("Enter encoded image path: ").strip()
        print("Secret message:", decode_message(image_path))

    else:
        print("Invalid option.")
