import pytest
import numpy as np
from backend.stegano import text_to_bits


def test_normal_text():
    result = text_to_bits("A")

    expected = np.array([0, 1, 0, 0, 0, 0, 0, 1])
    np.testing.assert_array_equal(result, expected)

def test_unicode_character():
    result = text_to_bits("é")

    # UTF-8: é occupies 2 bytes = 16 bits
    assert len(result) == 16


def test_special_characters():
    message = "!@#$%"
    result = text_to_bits(message)

    assert len(result) == len(message.encode("utf-8")) * 8

def test_emoji_input():
    message = "😀"
    result = text_to_bits(message)

    assert len(result) == len(message.encode("utf-8"))*8