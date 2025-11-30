from fastapi.testclient import TestClient
import json

from main import app

client = TestClient(app)

# Sample CSV text
csv_text = """name,age,score
Alice,30,85.5
Bob,25,92
Charlie,35,78
"""

# Parsed format similar to FileUploader.parseCSV
parsed = {
    "headers": ["name", "age", "score"],
    "rows": [
        ["Alice", "30", "85.5"],
        ["Bob", "25", "92"],
        ["Charlie", "35", "78"]
    ]
}

print('--- Test: parsed {headers, rows} payload ---')
resp = client.post('/api/process_data', json={'data': parsed})
print('status', resp.status_code)
try:
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
except Exception as e:
    print('Failed to decode JSON response:', e)
    print('text:', resp.text)

print('\n--- Test: raw CSV text payload ---')
resp2 = client.post('/api/process_data', json={'data': csv_text})
print('status', resp2.status_code)
try:
    print(json.dumps(resp2.json(), indent=2, ensure_ascii=False))
except Exception as e:
    print('Failed to decode JSON response:', e)
    print('text:', resp2.text)
