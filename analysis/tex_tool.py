import os
import re
import tarfile
from typing import Dict

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives import padding as sym_padding
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


class TexExtractor:
    def __init__(self, tar_path: str):
        self._tar_path = tar_path
        self._files: Dict[str, str] = {}

    # -------------------------
    # 1. 读取所有 tex 文件
    # -------------------------
    def load_tex_files(self):
        try:
            with tarfile.open(self._tar_path, "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.endswith(".tex"):
                        f = tar.extractfile(member)
                        if f:
                            content = f.read().decode("utf-8", errors="ignore")
                            self._files[member.name] = content
        except:
            self._files["err"] = ""

    # -------------------------
    # 2. 找主文件（heuristic）
    # -------------------------
    def find_main_tex(self) -> str:
        for name, content in self._files.items():
            if "\\begin{document}" in content:
                return name
        # fallback：最大文件
        return max(self._files, key=lambda k: len(self._files[k]))

    # -------------------------
    # 3. 去注释（保留 \%）
    # -------------------------
    def remove_comments(self, text: str) -> str:
        lines = []
        for line in text.splitlines():
            if line.strip().startswith("%"):
                continue

            new_line = ""
            i = 0
            while i < len(line):
                if line[i] == "%":
                    if i > 0 and line[i - 1] == "\\":
                        new_line += "%"
                        i += 1
                    else:
                        break
                else:
                    new_line += line[i]
                    i += 1

            lines.append(new_line)

        return "\n".join(lines)

    # -------------------------
    # 4. 递归展开 \input / \include
    # -------------------------
    def resolve_inputs(self, content: str, visited=None) -> str:
        if visited is None:
            visited = set()

        pattern = re.compile(r"\\(input|include){([^}]+)}")

        def replace(match):
            filename = match.group(2)

            if not filename.endswith(".tex"):
                filename += ".tex"

            # 防止循环引用
            if filename in visited:
                return ""

            visited.add(filename)

            if filename in self._files:
                sub_content = self._files[filename]
                sub_content = self.remove_comments(sub_content)
                return self.resolve_inputs(sub_content, visited)
            else:
                return ""

        return pattern.sub(replace, content)

    # -------------------------
    # 5. 主入口
    # -------------------------
    def get_merged_tex(self) -> str:
        self.load_tex_files()

        if not self._files:
            return ""

        main_file = self.find_main_tex()
        content = self._files[main_file]

        # 去注释
        content = self.remove_comments(content)

        # 展开 input/include
        content = self.resolve_inputs(content)

        return content


class RSAKeyManager:
    """RSA 密钥管理器"""

    PUBLIC_EXPONENT = 65537
    KEY_SIZE = 2048
    CIPHER_SIZE = 256
    HASH_SIZE = 32  # SHA-256
    BLOCK_SIZE = CIPHER_SIZE - 2 * HASH_SIZE - 2  # = 190
    BASE_DIR = "files"
    PRIVATE_KEY_PEM = f"{BASE_DIR}/private_key.pem"
    PUBLIC_KEY_PEM = f"{BASE_DIR}/public_key.pem"
    CHARSET = "utf-8"
    PADDING = padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    )

    def __init__(self, key_size=KEY_SIZE):
        self.key_size = key_size
        self.private_key = None
        self.public_key = None

    def generate_private_key(self):
        """生成新的密钥对"""
        self.private_key = rsa.generate_private_key(
            public_exponent=self.__class__.PUBLIC_EXPONENT,
            key_size=self.key_size,
        )
        self.public_key = self.private_key.public_key()
        return self.private_key

    def generate_public_key(self, filepath=None, password=None):
        if filepath:
            self.load_private_key(filepath, password)

        if self.private_key is None:
            raise ValueError("请先生成或加载私钥")

        self.public_key = self.private_key.public_key()
        return self.public_key

    def save_private_key(self, filepath=PRIVATE_KEY_PEM, password=None):
        """保存私钥到文件"""
        if self.private_key is None:
            raise ValueError("请先生成或加载私钥")

        # 选择加密方式
        if password:
            encryption = serialization.BestAvailableEncryption(password.encode())
        else:
            encryption = serialization.NoEncryption()

        # 保存私钥
        with open(filepath, "wb") as f:
            f.write(
                self.private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=encryption,
                )
            )

    def load_private_key(self, filepath=PRIVATE_KEY_PEM, password=None):
        """从文件加载私钥"""
        try:
            with open(filepath, "rb") as f:
                key_data = f.read()

            # 如果有密码，转换为 bytes
            pwd = password.encode() if password else None

            self.private_key = serialization.load_pem_private_key(
                key_data,
                password=pwd,
            )
            self.public_key = self.private_key.public_key()
            return self.private_key
        except Exception as e:
            print(f"加载私钥失败: {e}")
            raise

    def save_public_key(self, filepath=PUBLIC_KEY_PEM):
        """保存公钥到文件"""
        if self.public_key is None:
            raise ValueError("请先生成或加载密钥")

        with open(filepath, "wb") as f:
            f.write(
                self.public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )
            )

    def load_public_key(self, filepath=PUBLIC_KEY_PEM):
        """从文件加载公钥"""
        with open(filepath, "rb") as f:
            public_key_data = f.read()

        self.public_key = serialization.load_pem_public_key(public_key_data)
        return self.public_key

    def encrypt(self, b: bytes) -> bytes:
        data = b
        blocks = []
        for i in range(0, len(data), self.__class__.BLOCK_SIZE):
            ciphertext = self.public_key.encrypt(
                data[i : i + self.__class__.BLOCK_SIZE], self.__class__.PADDING
            )
            blocks.append(ciphertext)
        return b"".join(blocks)

    def decrypt(self, cipher: bytes) -> bytes:
        blocks = []
        for i in range(0, len(cipher), self.__class__.CIPHER_SIZE):
            plaintext = self.private_key.decrypt(
                cipher[i : i + self.__class__.CIPHER_SIZE], self.__class__.PADDING
            )
            blocks.append(plaintext)
        return b"".join(blocks)


class AESKeyManager:
    """AES-256 加密管理器"""

    KEY_SIZE = 32  # 256-bit
    IV_SIZE = 16  # AES block size
    BLOCK_SIZE = 128  # for PKCS7 (bits)

    def __init__(self, key: bytes = None):
        """
        key: 可选，如果不传则自动生成 session key
        """
        self.key = key if key else self.generate_key()

    def generate_key(self) -> bytes:
        """生成随机 AES-256 key(session key)"""
        self.key = os.urandom(self.__class__.KEY_SIZE)
        return self.key

    def encrypt(self, data: bytes) -> bytes:
        """
        返回格式: iv + ciphertext
        """
        iv = os.urandom(self.__class__.IV_SIZE)

        # padding
        padder = sym_padding.PKCS7(self.__class__.BLOCK_SIZE).padder()
        padded_data = padder.update(data) + padder.finalize()

        cipher = Cipher(
            algorithms.AES(self.key), modes.CBC(iv), backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        return iv + ciphertext

    def decrypt(self, cipher_data: bytes) -> bytes:
        """
        输入: iv + ciphertext
        """
        iv = cipher_data[: self.__class__.IV_SIZE]
        ciphertext = cipher_data[self.__class__.IV_SIZE :]

        cipher = Cipher(
            algorithms.AES(self.key), modes.CBC(iv), backend=default_backend()
        )
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()

        # unpadding
        unpadder = sym_padding.PKCS7(self.__class__.BLOCK_SIZE).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()

        return data
