"""Send a reproducible script to the running official Blender MCP bridge."""
import argparse
import json
from pathlib import Path
import socket

parser = argparse.ArgumentParser()
parser.add_argument('script', type=Path)
parser.add_argument('--timeout', type=int, default=180)
args = parser.parse_args()
code = args.script.read_text(encoding='utf-8')
with socket.create_connection(('127.0.0.1', 9876), timeout=5) as connection:
    connection.settimeout(args.timeout)
    connection.sendall(json.dumps({'type': 'execute', 'code': code, 'strict_json': True}).encode() + b'\0')
    response = bytearray()
    while b'\0' not in response:
        chunk = connection.recv(65536)
        if not chunk: break
        response.extend(chunk)
    payload = json.loads(response.rstrip(b'\0'))
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if payload.get('status') != 'ok': raise SystemExit(1)
